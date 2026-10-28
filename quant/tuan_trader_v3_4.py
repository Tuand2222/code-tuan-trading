# -*- coding: utf-8 -*-
"""
Tuan Trader — mã tham chiếu v3.4, vá trực tiếp từ original_v3.4.py.
Q1: DD_R có mốc 0; Q2: entry_avg và entry_avg_closed; Q3: rỗng là None;
Q4: giữ cấu hình Topstep 55% / Standard không Consistency / Consistency 40%.
Không có bộ chạy lịch sử trong gói đầu vào. Kết quả thực chạy xem VERIFICATION_REPORT_V3_4.md.
Tiền/giá/khối lượng/NAV/FIFO: Decimal prec=40. Seed mô phỏng được công khai.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import math
import random
import re
from collections import deque
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import warnings, statistics, dataclasses, csv, io, json
from pathlib import Path
from html.parser import HTMLParser
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_FLOOR, InvalidOperation, getcontext
from itertools import accumulate
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

getcontext().prec = 40


# ======================================================================
# 1. TIỆN ÍCH DECIMAL + PARSE SỐ + BỎ PHIẾU DẤU THẬP PHÂN THEO CỘT (§9.2)
# ======================================================================
def D(x) -> Optional[Decimal]:
    """Decimal hữu hạn; None giữ nguyên, dữ liệu sai ném ValueError tường minh."""
    if x is None:
        return None
    if isinstance(x, bool):
        raise ValueError('bool_not_allowed')
    try:
        value = x if isinstance(x, Decimal) else Decimal(str(x))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError('invalid_number') from exc
    if not value.is_finite():
        raise ValueError('non_finite_number')
    return value


def to_dec(x) -> Optional[Decimal]:
    """Bản an toàn của D: trả None nếu không ép được hoặc không hữu hạn."""
    if isinstance(x, bool):
        return None
    try:
        v = D(x)
    except (InvalidOperation, ValueError, TypeError):
        return None
    if v is None or not v.is_finite():
        return None
    return v


def floor_step(x, step) -> Decimal:
    value, st = to_dec(x), to_dec(step)
    if value is None or st is None or st <= 0:
        raise ValueError('invalid_floor_input')
    return (value / st).to_integral_value(rounding=ROUND_FLOOR) * st


# Mã tiền tệ: PHẢI xếp dài trước ngắn (USDT trước USD) để tránh cắt nhầm.
_CUR = r"USDT|USDC|BUSD|FDUSD|VND|USD|EUR|GBP|JPY"
_CLEAN_RE = re.compile(r"[\s\u00a0'’₫$€£]|" + _CUR, re.IGNORECASE)


def _clean(s: str) -> str:
    return _CLEAN_RE.sub("", s.strip())


def classify_cell(s: str) -> Tuple[bool, str]:
    s = _clean(s)
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1]
    if s.startswith("-"):
        neg, s = True, s[1:]
    if s.startswith("+"):
        s = s[1:]
    return neg, s


def column_decimal_sep(values: Sequence[Any], locale_hint: str = ".") -> Tuple[str, bool]:
    """
    Quyết định dấu thập phân theo cả cột (§9.2):
      - Ô có cả '.' và ',' => ký tự đứng sau cùng là dấu thập phân.
      - Ô có đúng 1 loại dấu xuất hiện 1 lần và phần sau dấu có != 3 chữ số => phiếu cho dấu đó là thập phân.
      - Ô có 1 loại dấu xuất hiện nhiều lần => loại dấu đó là phân cách hàng nghìn.
      - Hòa hoặc mơ hồ => trả (locale_hint, True) để UI yêu cầu xác nhận.
    """
    votes = {".": 0, ",": 0}
    thousand = {".": 0, ",": 0}
    for v in values:
        if v is None or isinstance(v, (int, float, Decimal, bool)):
            continue
        _, s = classify_cell(str(v))
        if not s:
            continue
        if "." in s and "," in s:
            dec = "." if s.rfind(".") > s.rfind(",") else ","
            votes[dec] += 1
        else:
            for sep in ".,":
                n = s.count(sep)
                if n > 1:
                    thousand[sep] += 1
                elif n == 1:
                    tail = s.split(sep)[1]
                    if len(tail) != 3:
                        votes[sep] += 1
    if votes["."] > votes[","]:
        return ".", False
    if votes[","] > votes["."]:
        return ",", False
    if thousand["."] > 0 and thousand[","] == 0:
        return ",", False
    if thousand[","] > 0 and thousand["."] == 0:
        return ".", False
    return locale_hint, True


def is_likely_ticket_id_column(values: Sequence[Any]) -> bool:
    """Phát hiện cột ID bị nhầm thành giá (§9.2): toàn số nguyên >= 9 chữ số, gần như duy nhất."""
    cleaned = []
    for v in values:
        if v is None:
            continue
        s = str(v).strip()
        if not re.fullmatch(r"\d{9,}", s):
            return False
        cleaned.append(s)
    if len(cleaned) < 2:
        return False
    return len(set(cleaned)) >= int(0.9 * len(cleaned))


def parse_number_with_reason(v, dec_sep: str = ".") -> Tuple[Optional[Decimal], Optional[str]]:
    """
    Đọc số an toàn kèm lý do lỗi (Q3 - §9.2):
      - None / chuỗi rỗng / chỉ có dấu '-' hoặc ký hiệu tiền tệ -> (None, 'empty')
      - bool -> (None, 'bool_not_allowed')
      - NaN / Infinity / chuỗi không phải số -> (None, 'invalid_number')
      - Hợp lệ -> (Decimal, None)
    """
    if dec_sep not in ('.',','):
        return None, 'invalid_decimal_separator'
    if v is None:
        return None, "empty"
    if isinstance(v, bool):
        return None, "bool_not_allowed"
    if isinstance(v, (int, float, Decimal)):
        out = to_dec(v)
        return (None, "invalid_number") if out is None else (out, None)
    neg, s = classify_cell(str(v))
    th = "," if dec_sep == "." else "."
    s = s.replace(th, "").replace(dec_sep, ".")
    if not s:
        return None, "empty"
    try:
        x = Decimal(s)
    except InvalidOperation:
        return None, "invalid_number"
    if not x.is_finite():
        return None, "invalid_number"
    return (-x if neg else x), None


def parse_number(v, dec_sep: str = ".", default=None) -> Optional[Decimal]:
    """
    Parse số theo Decimal (Q3 - §9.2):
      - Rác hoặc chuỗi rỗng ('', '   ', '-', '$') -> trả `default` (mặc định None), KHÔNG tự biến thành 0.
      - Chỉ nơi gọi ở các cột chi phí tùy chọn mới truyền `default=Decimal(0)` hoặc dùng `parse_optional_cost()`.
    """
    val, _ = parse_number_with_reason(v, dec_sep=dec_sep)
    return default if val is None else val


def parse_optional_cost(v, dec_sep: str = ".") -> Tuple[Optional[Decimal], Optional[str]]:
    val, reason = parse_number_with_reason(v, dec_sep)
    if reason == 'empty':
        return Decimal(0), 'fee_missing_as_zero'
    if reason:
        return None, 'invalid_cost_' + reason
    return val, None


# ======================================================================
# 2. CHUẨN HÓA, GỢI Ý LEVENSHTEIN & PHÂN LOẠI MÃ (§7.1–7.3)
# ======================================================================
ISO = set("USD EUR GBP JPY AUD NZD CAD CHF SGD HKD MXN CNH ZAR SEK NOK DKK PLN TRY".split())
ALIAS = {
    "GOLD": "XAUUSD", "XAU": "XAUUSD", "XAUUSD": "XAUUSD",
    "SILVER": "XAGUSD", "XAG": "XAGUSD", "XAGUSD": "XAGUSD",
    "WTI": "USOIL", "XTIUSD": "USOIL", "USOIL": "USOIL",
    "UKOIL": "UKOIL", "BRENT": "UKOIL", "XBRUSD": "UKOIL",
    "US30": "US30", "DJ30": "US30", "WS30": "US30",
    "NAS100": "NAS100", "US100": "NAS100", "USTEC": "NAS100", "NDX": "NAS100",
    "SPX500": "SPX500", "US500": "SPX500", "SP500": "SPX500", "SPX": "SPX500",
    "GER40": "GER40", "DAX40": "GER40", "DE40": "GER40", "DE30": "GER40",
    "JPN225": "JPN225", "JP225": "JPN225", "NIKKEI225": "JPN225", "UK100": "UK100",
}
INDEX_QUOTE = {"US30": "USD", "NAS100": "USD", "SPX500": "USD",
               "GER40": "EUR", "UK100": "GBP", "JPN225": "JPY"}
CRYPTO_BASES = set("BTC ETH BNB SOL XRP ADA DOGE AVAX DOT LINK LTC TRX TON SHIB".split())
VN_TICKERS = set("FPT VNM VIC VCB HPG MWG VHM TCB SSI ACB MBB VPB".split())
STABLE = ("USDT", "USDC", "BUSD", "FDUSD")


def is_forex6(s: str) -> bool:
    return len(s) == 6 and s[:3] in ISO and s[3:] in ISO and s[:3] != s[3:]


def known(s: str) -> bool:
    u = s.upper()
    return (u in ALIAS) or is_forex6(u) or bool(re.match(r"^[A-Z0-9]{2,10}(USDT|USDC|BUSD|FDUSD)$", u))


def normalize(raw: str) -> str:
    s = re.sub(r"\s+", "", raw.strip())
    s = re.sub(r"(?i)[-_.]?PERP$", "", s)
    s = re.sub(r"(?i)\.P$", "", s)
    s = re.sub(r"(?i)\.(PRO|RAW|R|A|STD|ECN|MINI|CASH|CFD)$", "", s)
    s = re.sub(r"(?i)_I$", "", s)
    s = s.rstrip("#.")
    s = re.sub(r"[/_-]", "", s)
    if len(s) > 3 and s[-1] in "mczi" and known(s[:-1]):
        s = s[:-1]
    return s.upper()


def levenshtein(a: str, b: str) -> int:
    """Khoảng cách chỉnh sửa Levenshtein (§7.3)."""
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[-1]


def suggest(s: str, k: int = 3) -> List[str]:
    """Gợi ý tối đa k mã có khoảng cách Levenshtein <= 2 (§7.3). Không tự áp dụng."""
    pool = set(ALIAS.values()) | set(ALIAS) | {"EURUSD", "GBPUSD", "USDJPY", "BTCUSDT", "ETHUSDT"}
    sc = sorted((levenshtein(s, c), c) for c in pool)
    return [c for dist, c in sc if dist <= 2][:k]


def classify(sym: str, ctx_market: Optional[str] = None,
             vn_tickers: Optional[Iterable[str]] = None) -> Dict[str, Any]:
    """
    Thứ tự ưu tiên chuẩn v3.4 (§7.2):
      1. ALIAS (XAU, GOLD -> XAUUSD...)
      2. Phái sinh VN (^VN30F\\d+[A-Z0-9]*$)
      3. Forex 6 ký tự ISO (quote_usd / usd_base / cross)
      4. Crypto linear (USDT|USDC|BUSD|FDUSD)
      5. Crypto USD (needs_confirm: linear CFD hay inverse?)
      6. Mã tiền tệ đơn lẻ ISO (needs_confirm + suggest)
      7. Mã trần thuộc CRYPTO_BASES (nếu trùng VN hoặc ctx_market=='stock_vn' -> needs_confirm; ngược lại -> BASE+USDT)
      8. Thuộc vn_tickers hoặc (ctx_market=='stock_vn' và ^[A-Z]{3}$) -> stock_vn
      8b. Nếu ctx_market=='stock_intl' và ^[A-Z]{1,5}$ -> stock_intl (cổ phiếu quốc tế)
      9. Còn lại -> unknown kèm suggest=suggest(s) (Levenshtein <= 2).
    """
    s = normalize(sym)
    vn = set(VN_TICKERS) | {t.upper() for t in (vn_tickers or ())}

    if s in ALIAS:
        c = ALIAS[s]
        cls = "metal" if c.startswith("XA") else "oil" if c in ("USOIL", "UKOIL") else "index"
        return dict(symbol=c, cls=cls, status="auto" if c == s else "auto_notice",
                    note=f"{s}->{c}" if c != s else None)
    if re.match(r"^VN30F\d+[A-Z0-9]*$", s):
        return dict(symbol=s, cls="futures_vn", status="auto")
    if is_forex6(s):
        q, b = s[3:], s[:3]
        sub = "quote_usd" if q == "USD" else "usd_base" if b == "USD" else "cross"
        return dict(symbol=s, cls="forex", sub=sub, status="auto")
    m = re.match(r"^([A-Z0-9]{2,10})(USDT|USDC|BUSD|FDUSD)$", s)
    if m:
        return dict(symbol=s, cls="crypto_linear", base=m.group(1), quote=m.group(2), status="auto")
    m = re.match(r"^([A-Z0-9]{2,10})USD$", s)
    if m and m.group(1) in CRYPTO_BASES:
        return dict(symbol=s, cls="crypto_usd", status="needs_confirm", why="linear CFD / inverse?")
    if s in ISO:
        return dict(symbol=s, cls=None, status="needs_confirm", why="chi la tien te",
                    suggest=[s + "USD"] if s != "USD" else [])
    if s in CRYPTO_BASES:
        if s in vn or ctx_market == "stock_vn":
            return dict(symbol=s, cls=None, status="needs_confirm",
                        why="ma trung giua crypto va co phieu VN",
                        suggest=[s + "USDT", s])
        return dict(symbol=s + "USDT", cls="crypto_linear", base=s, quote="USDT",
                    status="auto_notice", note=f"{s}->{s}USDT")
    if s in vn:
        return dict(symbol=s, cls="stock_vn", status="auto")
    if ctx_market == "stock_vn" and re.fullmatch(r"[A-Z]{3}", s):
        return dict(symbol=s, cls="stock_vn", status="auto")
    if ctx_market == "stock_intl" and re.fullmatch(r"[A-Z]{1,5}", s):
        return dict(symbol=s, cls="stock_intl", status="auto")
    return dict(symbol=s, cls=None, status="unknown", suggest=suggest(s))


# ======================================================================
# 3. CONTRACT SPEC + SIZING (§7.4 & §8)
# ======================================================================
_CRYPTO_STEP = {"BTC": "0.001", "ETH": "0.01"}


def spec_for(c: Dict[str, Any]) -> Dict[str, Any]:
    cls, s = c["cls"], c["symbol"]
    if cls == "forex":
        return dict(csize=D(100000), step=D("0.01"), vmin=D("0.01"), quote=s[3:], base=s[:3])
    if cls == "metal":
        return dict(csize=D(100) if s.startswith("XAU") else D(5000),
                    step=D("0.01"), vmin=D("0.01"), quote=s[3:], base=s[:3])
    if cls == "oil":
        return dict(csize=D(1000), step=D("0.01"), vmin=D("0.01"), quote="USD", base=None)
    if cls == "index":
        return dict(csize=D(1), step=D("0.01"), vmin=D("0.01"),
                    quote=INDEX_QUOTE.get(s, "USD"), base=None)
    if cls == "crypto_linear":
        base = c.get("base") or re.sub(r"(USDT|USDC|BUSD|FDUSD)$", "", s)
        quote = c.get("quote") or s[len(base):]
        step = D(_CRYPTO_STEP.get(base, "0.01"))
        return dict(csize=D(1), step=step, vmin=step, quote=quote, base=base,
                    step_is_default=base not in _CRYPTO_STEP)
    if cls == "stock_vn":
        return dict(csize=D(1), step=D("100"), vmin=D("100"), quote="VND", base=None)
    if cls == "stock_intl":
        return dict(csize=D(1), step=D("1"), vmin=D("1"), quote="USD", base=None)
    if cls == "futures_vn":
        return dict(csize=D(100000), step=D("1"), vmin=D("1"), quote="VND", base=None)
    raise ValueError(f"cls khong ho tro: {cls}")


def size_position(equity, risk_pct, entry, sl, direction, sym, account="USD",
                  fx=None, comm_lot=0, slip=0, ctx_market=None,
                  csize_override=None, step_override=None, vmin_override=None,
                  fee_buy_rate=0, fee_sell_rate=0, tax_sell_rate=0,
                  vn_tickers=None) -> Dict[str, Any]:
    """
    risk_pct: PHẦN TRĂM (1 = 1%).
    fee_*_rate / tax_sell_rate: PHÂN SỐ (0.0015 = 0.15%). Giá trị > 0.05 bị từ chối (nghi nhập theo %).
    Bất biến: risk_actual <= budget, hoặc status='below_min' với volume = 0.
    Trả đồng thời các khóa chuẩn Python v3 (`loss_lot`, `risk_actual`, `vpoint`, `vraw`, `min_lot_risk`)
    và alias camelCase của Spec v2 (`lossPerLot`, `riskActual`, `vpointAcct`, `vRaw`, `minLotRisk`).
    """
    if not isinstance(sym, str) or not sym.strip():
        return dict(status='error', why='symbol_required')
    c = classify(sym, ctx_market, vn_tickers)
    if c["status"] in ("unknown", "needs_confirm"):
        return dict(status="needs_confirm", detail=c)
    try:
        sp = spec_for(c)
        equity, risk_pct, entry, sl = D(equity), D(risk_pct), D(entry), D(sl)
        comm_lot, slip = D(comm_lot), D(slip)
        fb, fs, tx = D(fee_buy_rate), D(fee_sell_rate), D(tax_sell_rate)
        if csize_override is not None:
            sp["csize"] = D(csize_override)
        if step_override is not None:
            sp["step"] = D(step_override)
        if vmin_override is not None:
            sp["vmin"] = D(vmin_override)
    except (InvalidOperation, ValueError, TypeError):
        return dict(status="error", why="dau vao khong phai so hop le")

    if any(x is None for x in (equity, risk_pct, entry, sl, comm_lot, slip, fb, fs, tx)):
        return dict(status='error', why='missing_numeric_input')
    if comm_lot < 0 or slip < 0 or any(sp[k] <= 0 for k in ('csize', 'step', 'vmin')):
        return dict(status='error', why='invalid_contract_or_cost')
    if equity <= 0 or entry <= 0 or sl <= 0:
        return dict(status="error", why="equity/entry/sl phai > 0")
    if not (Decimal(0) < risk_pct <= Decimal(100)):
        return dict(status="error", why="risk_pct phai trong (0, 100]")
    for name, r in (("fee_buy_rate", fb), ("fee_sell_rate", fs), ("tax_sell_rate", tx)):
        if r < 0 or r > Decimal("0.05"):
            return dict(status="error",
                        why=f"{name}={r} khong hop le: dung PHAN SO (0.0015 = 0.15%), toi da 0.05")
    if direction == "buy" and not sl < entry:
        return dict(status="error", why="SL phai < entry voi lenh Buy")
    if direction == "sell" and not sl > entry:
        return dict(status="error", why="SL phai > entry voi lenh Sell")
    if direction not in ("buy", "sell"):
        return dict(status="error", why="direction phai la 'buy' hoac 'sell'")
    if c["cls"] == "stock_vn" and direction == "sell":
        return dict(status="error", why="khong ho tro ban khong (short) co phieu co so VN")

    dP = abs(entry - sl)
    q = sp["quote"]
    assumptions: List[str] = []
    flags: List[str] = []
    if q == account:
        fxr = Decimal(1)
    elif (q in STABLE and (account == "USD" or account in STABLE)) or (q == "USD" and account in STABLE):
        fxr = Decimal(1)
        assumptions.append(f"Coi {q} = 1 {account} (stablecoin peg)")
        flags.append("stablecoin_usd_peg_assumed")
    elif c.get("sub") == "usd_base" and sp["base"] == account:
        fxr = Decimal(1) / sl            # quy đổi tại điểm cắt lỗ
    elif fx and (q, account) in fx:
        fxr = to_dec(fx[(q, account)])
        if fxr is None:
            return dict(status='error', why='invalid_fx_rate')
        if fxr <= 0:
            return dict(status="error", why="ty gia phai > 0")
    else:
        return dict(status="error", why=f"thieu ty gia {q}->{account}")
    if sp.get("step_is_default") and not step_override:
        assumptions.append("Buoc khoi luong crypto la mac dinh 0.01, hay ghi de theo san (step_override)")
        flags.append("crypto_step_default")

    vpoint = sp["csize"] * fxr
    if c["cls"] == "stock_vn":
        pct_cost = entry * fb + sl * (fs + tx)
        loss_lot = (dP + slip + pct_cost) * vpoint + comm_lot
    else:
        loss_lot = (dP + slip) * vpoint + comm_lot
    if loss_lot <= 0:
        return dict(status="error", why="loss_lot <= 0")

    budget = equity * risk_pct / Decimal(100)
    vraw = budget / loss_lot
    vfin = floor_step(vraw, sp["step"])
    if vfin < sp["vmin"]:
        min_lot_risk = sp["vmin"] * loss_lot
        return dict(status="below_min", volume=Decimal(0), vraw=vraw, vRaw=vraw,
                    min_lot_risk=min_lot_risk, minLotRisk=min_lot_risk,
                    vpoint=vpoint, vpointAcct=vpoint, loss_lot=loss_lot, lossPerLot=loss_lot,
                    assumptions=assumptions, flags=flags, warnings=flags + assumptions)
    risk_act = vfin * loss_lot
    risk_pct_act = risk_act / equity * Decimal(100)
    assert risk_act <= budget, "vi pham bat bien riskActual <= budget"
    return dict(status="ok", volume=vfin, vraw=vraw, vRaw=vraw,
                vpoint=vpoint, vpointAcct=vpoint,
                loss_lot=loss_lot, lossPerLot=loss_lot,
                risk_actual=risk_act, riskActual=risk_act,
                risk_pct_actual=risk_pct_act, riskPctActual=risk_pct_act,
                assumptions=assumptions, flags=flags, warnings=flags + assumptions)


# ======================================================================
# 4. TỶ GIÁ NGẦM ĐỊNH (implied Vpoint) & CHUỖI FALLBACK 1R (§5)
# ======================================================================
def implied_vpoint(gross_pnl, entry, exit_, volume,
                   rounding_unit="0.01", max_rel_err="0.005") -> Dict[str, Any]:
    g, e, x, v = to_dec(gross_pnl), to_dec(entry), to_dec(exit_), to_dec(volume)
    ru, tol = to_dec(rounding_unit), to_dec(max_rel_err)
    if None in (g, e, x, v, ru, tol) or min(e,x,v,ru,tol) <= 0:
        return dict(ok=False, reason="du_lieu_khong_hop_le")
    move = abs(x - e)
    if move == 0:
        return dict(ok=False, reason="exit_bang_entry")
    if g == 0:
        return dict(ok=False, reason="gross_bang_0")
    rel = (ru / 2) / abs(g)
    if rel > tol:
        return dict(ok=False, reason="gross_qua_nho_so_voi_do_lam_tron", rel_err_bound=rel)
    return dict(ok=True, vpoint=abs(g) / (move * v), rel_err_bound=rel, source="implied")


def resolve_vpoint(gross_pnl, entry, exit_, volume, fallback_vpoint=None, **kw) -> Dict[str, Any]:
    r = implied_vpoint(gross_pnl, entry, exit_, volume, **kw)
    if r["ok"]:
        return r
    if to_dec(fallback_vpoint) is not None and to_dec(fallback_vpoint)>0:
        return dict(ok=True, vpoint=D(fallback_vpoint), source="static_fx_fallback",
                    flag="vpoint_fallback", fallback_reason=r["reason"])
    return dict(ok=False, reason=r["reason"], source=None)


def risk1r(entry, sl, volume, vpoint, direction=None, side=None) -> Optional[Decimal]:
    e, s, v, p = map(to_dec, (entry, sl, volume, vpoint))
    if any(x is None or x <= 0 for x in (e, s, v, p)) or e == s:
        return None
    raw_side = direction if direction is not None else side
    if raw_side is not None:
        mapped = map_direction(raw_side)
        if mapped['status'] != 'ok':
            return None
        if (mapped['direction'] == 'buy' and s >= e) or (mapped['direction'] == 'sell' and s <= e):
            return None
    return abs(e - s) * v * p


def cycle_oneR(entry_legs: Sequence[Dict[str, Any]], vpoint,
               fallback_amount=None) -> Dict[str, Any]:
    total = Decimal(0)
    for leg in entry_legs:
        part = risk1r(leg.get("price"), leg.get("sl"), leg.get("qty"), vpoint, side=leg.get("side", leg.get("direction")))
        if part is None or part <= 0 or leg.get("sl") is None:
            fb = to_dec(fallback_amount)
            if fb is not None and fb > 0:
                return dict(oneR=fb, oneRSource="fallback")
            return dict(oneR=None, oneRSource="missing")
        total += part
    if total <= 0:
        return dict(oneR=None, oneRSource="missing")
    return dict(oneR=total, oneRSource="exact")


def resolve_fallback_1r(equity_before_entry=None, equity_pct="1.0",
                        notional_acct=None, notional_pct=None,
                        fixed_amount=None, loss_pnls: Optional[Sequence[Any]] = None,
                        min_losses: int = 5) -> Dict[str, Any]:
    """
    Chuỗi suy giảm tự động khi khuyết SL (§5.5):
      equity_pct -> notional_pct -> fixed_amount -> empirical_avg_loss (>=5 lệnh thua) -> unavailable.
    Cấm tuyệt đối giá trị gán cứng ₫100.
    """
    eq = to_dec(equity_before_entry)
    ep = to_dec(equity_pct)
    if eq is not None and eq > 0 and ep is not None and Decimal("0.1") <= ep <= Decimal("5.0"):
        return dict(oneR=eq * ep / Decimal(100), oneRSource="fallback_equity_pct")
    nt = to_dec(notional_acct)
    np = to_dec(notional_pct)
    if nt is not None and nt > 0 and np is not None and np > 0:
        return dict(oneR=nt * np / Decimal(100), oneRSource="fallback_notional_pct")
    fa = to_dec(fixed_amount)
    if fa is not None and fa > 0:
        flags = []
        if eq is not None and eq > 0:
            ratio = fa / eq * Decimal(100)
            if ratio < Decimal("0.01") or ratio > Decimal("20"):
                flags.append("fixed_1r_out_of_normal_bounds")
        return dict(oneR=fa, oneRSource="fallback_fixed", flags=flags)
    if loss_pnls is not None:
        losses = [abs(to_dec(x)) for x in loss_pnls if to_dec(x) is not None and to_dec(x) < 0]
        if len(losses) >= min_losses:
            return dict(oneR=sum(losses, Decimal(0)) / Decimal(len(losses)),
                        oneRSource="fallback_avg_loss", exclude_from_sqn=True)
    return dict(oneR=None, oneRSource=None, reason="unavailable")


# ======================================================================
# 5. KIỂM TOÁN GIÁ: ROBUST Z-SCORE TRÊN LOG-GIÁ (§9.5)
# ======================================================================
def robust_z_log(prices: Sequence, eps: float = 1e-3, min_n: int = 5) -> List[Optional[float]]:
    ps = [to_dec(p) for p in prices]
    ok = [p for p in ps if p is not None and p > 0]
    if len(ok) < min_n:
        return [None] * len(ps)
    ys = [math.log(float(p)) for p in ok]
    ys_sorted = sorted(ys)

    def med(a):
        n = len(a)
        return a[n // 2] if n % 2 else (a[n // 2 - 1] + a[n // 2]) / 2

    m = med(ys_sorted)
    mad = med(sorted(abs(y - m) for y in ys))
    den = max(mad, eps)
    out: List[Optional[float]] = []
    for p in ps:
        if p is None or p <= 0:
            out.append(None)
        else:
            out.append(0.6745 * abs(math.log(float(p)) - m) / den)
    return out


def flag_price_outliers(prices: Sequence, threshold: float = 3.5, **kw) -> List[bool]:
    return [(z is not None and z > threshold) for z in robust_z_log(prices, **kw)]


# ======================================================================
# 6. FINGERPRINT + MULTISET DEDUP + ENRICH + GỢI Ý GỘP (§10)
# ======================================================================
def canonical_raw_time(raw: str, date_order: str = "YMD") -> Optional[Dict[str, Any]]:
    if raw is None or date_order not in ('YMD', 'DMY', 'MDY'):
        return None
    s = re.sub(r'\s+', ' ', str(raw).strip().replace('T', ' '))
    parts = s.split(' ', 1)
    nums = re.findall(r'\d+', parts[0])
    if len(nums) != 3:
        return None
    values = dict(zip(date_order, nums))
    year = int(values['Y']) + (2000 if len(values['Y']) == 2 else 0)
    try:
        day = dt.date(year, int(values['M']), int(values['D']))
        stamp = day.strftime('%Y%m%d')
        if len(parts) == 1:
            return dict(canonical=stamp, day=stamp, date_only=True)
        match = re.fullmatch(r'(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?', parts[1])
        if not match:
            return None
        hh, mm, ss = [int(v or 0) for v in match.groups()]
        dt.time(hh, mm, ss)
        return dict(canonical=stamp + f'{hh:02d}{mm:02d}{ss:02d}', day=stamp, date_only=False)
    except (ValueError, OverflowError):
        return None


def _norm_dec_str(x) -> str:
    d = to_dec(x)
    return "" if d is None else format(d.normalize(), "f")


def import_fingerprint(source: str, account_id: str, raw_open_time: str, symbol: str,
                       direction: str, volume, entry_price,
                       external_ticket: Optional[str] = None,
                       date_order: str = "YMD") -> Optional[str]:
    if external_ticket:
        key = "|".join(["T", source, account_id, str(external_ticket)])
    else:
        ct = canonical_raw_time(raw_open_time, date_order)
        if ct is None:
            return None
        key = "|".join(["F", source, account_id, ct["canonical"], normalize(symbol),
                        direction, _norm_dec_str(volume), _norm_dec_str(entry_price)])
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def find_merge_candidates(new: Dict[str, Any], existing: Iterable[Dict[str, Any]],
                          price_tol) -> List[Dict[str, Any]]:
    tol = D(price_tol)
    out = []
    for e in existing:
        if (normalize(e["symbol"]) == normalize(new["symbol"])
                and e["direction"] == new["direction"]
                and D(e["volume"]) == D(new["volume"])
                and e["day"] == new["day"]
                and bool(e["date_only"]) != bool(new["date_only"])
                and abs(D(e["entry_price"]) - D(new["entry_price"])) <= tol):
            out.append(e)
    return out


USER_PROTECTED_FIELDS = frozenset({
    "setupId", "disciplineTags", "notes", "screenshots", "isReviewed"
})


def enrich_trade_record(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """
    Quy tắc ENRICH (§10.3):
      - Chỉ điền các trường đang trống (None) hoặc chuyển trạng thái từ 'open' -> 'closed'
        (cập nhật exitPrice, closeTime, grossPnl, netPnl, status, commission, swap, fee).
      - KHÔNG BAO GIỜ ghi đè các trường người dùng (setupId, disciplineTags, notes, screenshots, isReviewed)
        hoặc bất kỳ trường nào có tên trong `existing.get('userEditedFields', [])`.
    """
    updated = copy.deepcopy(existing)
    user_edited = set(updated.get("userEditedFields") or []) | USER_PROTECTED_FIELDS
    changed = False
    was_open_now_closed = (updated.get("status") == "open" and incoming.get("status") == "closed")
    transition_fields = {"status", "exitPrice", "closeTime", "grossPnl", "netPnl", "commission", "swap", "fee"}

    for k, v in incoming.items():
        if v is None or k in user_edited or k in ("id", "importFingerprint", "occurrenceIndex"):
            continue
        if updated.get(k) is None or (was_open_now_closed and k in transition_fields):
            if updated.get(k) != v:
                updated[k] = v
                changed = True
    return updated, changed


def upsert_multiset_batch(db_records: List[Dict[str, Any]], incoming_records: List[Dict[str, Any]],
                           import_batch_id: str, batch_journal=None) -> Dict[str, Any]:
    """Atomic multiset + before/after undo record; preserve user fields (§10)."""
    before=copy.deepcopy(db_records)
    working=copy.deepcopy(db_records)
    if any(not r.get('importFingerprint') for r in working+incoming_records):
        raise ValueError('missing_import_fingerprint')
    by_db={}; by_in={}
    for idx,rec in enumerate(working): by_db.setdefault(rec['importFingerprint'],[]).append(idx)
    for rec in incoming_records: by_in.setdefault(rec['importFingerprint'],[]).append(rec)
    for indices in by_db.values(): indices.sort(key=lambda i:working[i].get('occurrenceIndex',0))
    new=[]; enriched=skipped=0
    ids={r.get('id') for r in working if r.get('id')}
    for fp,group in by_in.items():
        indices=by_db.get(fp,[]); k=len(indices)
        for i,rec in enumerate(group):
            if i<k:
                updated,changed=enrich_trade_record(working[indices[i]],rec)
                if changed: working[indices[i]]=updated; enriched+=1
                else: skipped+=1
            else:
                added=copy.deepcopy(rec)
                added.update(occurrenceIndex=i,importBatchId=import_batch_id)
                if not added.get('id') or added['id'] in ids:
                    added['id']=hashlib.sha256(f'{fp}|{i}'.encode()).hexdigest()
                ids.add(added['id']); working.append(added); new.append(added)
    undo=dict(batch=import_batch_id,before=before,after=copy.deepcopy(working))
    db_records[:]=working
    if batch_journal is not None: batch_journal[import_batch_id]=copy.deepcopy(undo)
    return dict(new_count=len(new),update_count=enriched,skip_count=skipped,new_records=new,undo=undo)


def undo_import_batch(db_records: List[Dict[str, Any]], import_batch_id: str,
                       undo_record=None, batch_journal=None, db_cashflows=None) -> List[Dict[str, Any]]:
    """With receipt: restore NEW + ENRICH, refuse subsequent edits. Old two-arg call removes NEW only."""
    receipt=undo_record or (batch_journal or {}).get(import_batch_id)
    if receipt is not None:
        if receipt.get('batch')!=import_batch_id or db_records!=receipt.get('after'):
            raise ValueError('undo_conflict_later_edits')
        if 'cash_after' in receipt:
            if db_cashflows is None or db_cashflows!=receipt['cash_after']:
                raise ValueError('undo_cashflow_conflict_or_store_required')
            db_cashflows[:]=copy.deepcopy(receipt['cash_before'])
        return copy.deepcopy(receipt['before'])
    return [r for r in db_records if r.get('importBatchId')!=import_batch_id]


# ======================================================================
# 7. ÁNH XẠ HƯỚNG, NET P&L BA CẤP (A/B/C) & FIFO PHẲNG -> PHẲNG (§9.3–9.4)
# ======================================================================
def map_direction(raw_dir: Any, source_profile: str = "generic") -> Dict[str, Any]:
    """
    Ánh xạ hướng theo hồ sơ nguồn (§9.3):
      - chung: buy, long, mua -> 'buy'; sell, short, bán, ban -> 'sell'
      - nguồn tiếng Việt ('vn_broker'): 'm' -> 'buy', 'b' -> 'sell' (B = Bán)
      - nguồn tiếng Anh ('en_broker'): 'b' -> 'buy', 's' -> 'sell'
      - không rõ nguồn ('generic') mà gặp chữ cái đơn 'b'/'m'/'s' -> trả status='needs_confirm'.
    """
    if raw_dir is None:
        return dict(status="error", direction=None, why="thieu_huong")
    s = str(raw_dir).strip().lower()
    if s in ("buy", "long", "mua"):
        return dict(status="ok", direction="buy")
    if s in ("sell", "short", "bán", "ban"):
        return dict(status="ok", direction="sell")
    if s in ("balance", "credit", "deposit", "withdrawal"):
        return dict(status="cashflow", direction=None, kind=s)
    if s in ("pending", "cancelled", "canceled"):
        return dict(status="skip_non_trade", direction=None, kind=s)
    if source_profile == "vn_broker":
        if s == "m":
            return dict(status="ok", direction="buy")
        if s == "b":
            return dict(status="ok", direction="sell")
    elif source_profile == "en_broker":
        if s == "b":
            return dict(status="ok", direction="buy")
        if s == "s":
            return dict(status="ok", direction="sell")
    if len(s) == 1 and s in ("b", "m", "s"):
        return dict(status="needs_confirm", direction=None, why=f"chu_cai_don_{s}_can_ro_nguon")
    return dict(status="error", direction=None, why=f"huong_khong_hop_le:{raw_dir}")


def compute_net_pnl(level: str, gross_pnl=None, entry_price=None, exit_price=None,
                    volume=None, direction: str = "buy", vpoint_exit=None,
                    commission=None, swap=None, fee=None, tax=None,
                    source_type: str = "mt4_mt5", fee_currency: Optional[str] = None,
                    account_currency: str = "USD", fee_fx_rate=None,
                    fills=None, cycle=None, allow_short=True, fees_in_account=True,
                    account_id='', symbol='', fallback_1r=None) -> Dict[str, Any]:
    """A/B: chi phí theo nguồn. C: FIFO -> Trade; tiền phí không nhân vpoint lần hai (§9.3)."""
    if level == 'C':
        if cycle is None and fills is None:
            return dict(status='error', netPnl=None, why='thieu_fills_cap_C')
        if cycle is not None and fee_currency and fee_currency!=account_currency:
            return dict(status='needs_confirm',netPnl=None,why='prebuilt_cycle_foreign_fee_requires_original_fills')
        converted_flags=[]
        if cycle is None:
            prepared, converted_flags = _prepare_fifo_fees(fills,fee_currency,account_currency,fee_fx_rate)
            cycles, warnings_ = fifo_cycles(prepared, allow_short)
        else:
            cycles, warnings_ = [copy.deepcopy(cycle)], []
        if 'fee_fx_converted' in converted_flags:
            fees_in_account=True
        vp = to_dec(vpoint_exit)
        if vp is None or vp <= 0:
            return dict(status='error', netPnl=None, why='thieu_vpoint_cap_C')
        records = [cycle_to_trade(c, vp, account_id, symbol, account_currency,
                                 fees_in_account, fallback_1r) for c in cycles]
        for record in records:
            record.setdefault('flags',[]).extend(converted_flags)
        valid = [r['netPnl'] for r in records if r.get('netPnl') is not None]
        return dict(status='ok', netPnl=sum(valid, Decimal(0)) if valid else None,
                    netPnlSource='derived_C', trades=records, cycles=cycles, flags=warnings_+converted_flags)
    if level not in ('A', 'B'):
        return dict(status='error', netPnl=None, why=f'level_khong_hop_le:{level}')
    signed = source_type == 'mt4_mt5'
    if source_type not in ('mt4_mt5', 'binance_futures', 'spot', 'vn_stock'):
        return dict(status='needs_confirm', netPnl=None, why='unknown_cost_convention')
    costs = [commission, swap, fee, tax]
    if any(x is not None and to_dec(x) is None for x in costs):
        return dict(status='error', netPnl=None, why='invalid_cost')
    parsed = [to_dec(x) for x in costs]
    if not signed and any(parsed[i] is not None and parsed[i] < 0 for i in (0, 2, 3)):
        return dict(status='error', netPnl=None, why='positive_cost_required')
    if level == 'A':
        gross = to_dec(gross_pnl)
        if gross is None:
            return dict(status='error', netPnl=None, why='thieu_gross_cap_A')
    else:
        pe, px, vol, vp = map(to_dec, (entry_price, exit_price, volume, vpoint_exit))
        dr = map_direction(direction)
        if any(x is None or x <= 0 for x in (pe, px, vol, vp)) or dr['status'] != 'ok':
            return dict(status='error', netPnl=None, why='thieu_du_lieu_cap_B')
        gross = (Decimal(1) if dr['direction'] == 'buy' else Decimal(-1)) * (px-pe)*vol*vp
    flags = []
    fee_known = any(x is not None for x in parsed)
    if fee_currency and fee_currency != account_currency and parsed[2] is not None:
        rate = to_dec(fee_fx_rate)
        if rate is None or rate <= 0:
            return dict(status='ok', grossPnl=gross, netPnl=gross, netPnlSource='derived_'+level,
                        feeKnown=False, label='Gross ước tính (phí ngoại tệ chưa quy đổi)', flags=['fee_unconverted'])
        parsed[2] *= rate
    signs = (1, 1, 1, 1) if signed else (-1, 1, -1, -1)
    total = sum((Decimal(s) * (v if v is not None else Decimal(0)) for s, v in zip(signs, parsed)), Decimal(0))
    if not fee_known:
        flags.append('fee_missing_as_zero')
    return dict(status='ok', grossPnl=gross, netPnl=gross+total, netPnlSource='derived_'+level,
                feeKnown=fee_known, label='Net sau phí' if fee_known else 'Gross ước tính (chưa phí)', flags=flags)


def _norm_fill(f, i):
    if isinstance(f, dict):
        side, q, p = f.get("side"), f.get("qty"), f.get("price")
        fee, sl, t = f.get("fee"), f.get("sl"), f.get("time")
    else:
        side, q, p, fee = f[0], f[1], f[2], f[3] if len(f) > 3 else None
        sl = f[4] if len(f) > 4 else None
        t = f[5] if len(f) > 5 else None
    return dict(i=i, side=side, qty=to_dec(q), price=to_dec(p),
                fee=to_dec(fee) if to_dec(fee) is not None else Decimal(0), feeKnown=fee is not None, invalid_fee=fee is not None and to_dec(fee) is None, raw=copy.deepcopy(f), sl=to_dec(sl), time=t)


def fifo_cycles(fills: Iterable[Any], allow_short: bool = True):
    """
    Ghép FIFO chu kỳ phẳng -> phẳng (§9.4 & Quyết định Q2):
      - `entry_avg`: giá vào trung bình gia quyền của TOÀN BỘ các chân mở trong chu kỳ (vd 105).
      - `entry_avg_closed`: giá vào trung bình gia quyền của PHẦN KHỐI LƯỢNG ĐÃ ĐÓNG theo FIFO (vd 103.3333...).
        Khi chu kỳ đã đóng hoàn toàn (status == 'closed'), `entry_avg_closed == entry_avg`.
    """
    warnings: List[Dict[str, Any]] = []
    cycles: List[Dict[str, Any]] = []
    lots: deque = deque()
    cur: Optional[Dict[str, Any]] = None

    def new_cycle(direction):
        return dict(direction=direction, entry_legs=[], legs=[],
                    entry_qty=Decimal(0), entry_cost=Decimal(0), entry_fee_total=Decimal(0),
                    entry_cost_closed=Decimal(0),
                    exit_qty=Decimal(0), exit_rev=Decimal(0), exit_fee=Decimal(0),
                    entry_fee_realized=Decimal(0), gross=Decimal(0),
                    open_time=None, close_time=None)

    def emit(c, status):
        out = dict(status=status, direction=c["direction"], qty=c["exit_qty"],
                   entry_qty=c["entry_qty"],
                   entry_avg=(c["entry_cost"] / c["entry_qty"]) if c["entry_qty"] > 0 else None,
                   entry_avg_closed=(c["entry_cost_closed"] / c["exit_qty"]) if c["exit_qty"] > 0 else None,
                   exit_avg=(c["exit_rev"] / c["exit_qty"]) if c["exit_qty"] > 0 else None,
                   gross=c["gross"], entry_fee=c["entry_fee_realized"], exit_fee=c["exit_fee"],
                   net_price_units=c["gross"] - c["entry_fee_realized"] - c["exit_fee"],
                   entry_legs=c["entry_legs"], legs=c["legs"],
                   open_time=c["open_time"], close_time=c["close_time"])
        if status == "open":
            out["open_qty"] = sum((l["left"] for l in lots), Decimal(0))
            out["open_entry_fee_unrealized"] = c["entry_fee_total"] - c["entry_fee_realized"]
        return out

    for i, raw in enumerate(fills):
        f = _norm_fill(raw, i)
        if f['invalid_fee']:
            warnings.append(dict(code='skip_invalid_fee',index=i))
            continue
        if f["side"] not in ("buy", "sell") or f["qty"] is None or f["price"] is None \
                or f["qty"] <= 0 or f["price"] <= 0:
            warnings.append(dict(code="skip_invalid_fill", index=i))
            continue
        d = 1 if f["side"] == "buy" else -1
        q, p = f["qty"], f["price"]
        fee_u = f["fee"] / q
        rem = q

        if lots and lots[0]["dir"] != d and cur is not None:
            closed_here = Decimal(0)
            while rem > 0 and lots and lots[0]["dir"] != d:
                lot = lots[0]
                take = min(rem, lot["left"])
                cur["gross"] += take * ((p - lot["price"]) if lot["dir"] == 1 else (lot["price"] - p))
                cur["entry_cost_closed"] += take * lot["price"]
                cur["exit_qty"] += take
                cur["exit_rev"] += take * p
                cur["exit_fee"] += fee_u * take
                cur["entry_fee_realized"] += lot["fee_u"] * take
                lot["left"] -= take
                rem -= take
                closed_here += take
                if lot["left"] == 0:
                    lots.popleft()
            cur["legs"].append(dict(role="exit", index=i, side=f["side"], qty=closed_here,
                                    price=p, fee=fee_u * closed_here, time=f["time"], feeKnown=f["feeKnown"], raw=f["raw"]))
            cur["close_time"] = f["time"]
            if not lots:
                cycles.append(emit(cur, "closed"))
                cur = None

        if rem > 0:
            if not lots and d == -1 and not allow_short:
                cycles.append(dict(status="orphan_sell", qty=rem, price=p, index=i, time=f["time"], feeKnown=f["feeKnown"], raw=f["raw"]))
                warnings.append(dict(code="orphan_sell", index=i, qty=rem))
                continue
            if cur is None:
                cur = new_cycle("long" if d == 1 else "short")
                cur["open_time"] = f["time"]
            leg = dict(role="entry", index=i, side=f["side"], qty=rem, price=p,
                       fee=fee_u * rem, sl=f["sl"], time=f["time"], feeKnown=f["feeKnown"], raw=f["raw"])
            cur["legs"].append(leg)
            cur["entry_legs"].append(leg)
            cur["entry_qty"] += rem
            cur["entry_cost"] += rem * p
            cur["entry_fee_total"] += fee_u * rem
            lots.append(dict(dir=d, left=rem, price=p, fee_u=fee_u))

    if cur is not None and lots:
        cycles.append(emit(cur, "open"))
    return cycles, warnings


def cycle_net_account(cycle: Dict[str, Any], vpoint, fees_in_account: bool = True) -> Optional[Decimal]:
    vp = to_dec(vpoint)
    gross, ef, xf = map(to_dec, (cycle.get('gross'), cycle.get('entry_fee'), cycle.get('exit_fee')))
    if vp is None or vp <= 0 or None in (gross, ef, xf):
        return None
    return gross * vp - (ef + xf) * (Decimal(1) if fees_in_account else vp)


# ======================================================================
# 8. SAFETY GATE: DRAWDOWN NAV, DD THEO R (CÓ MỐC 0 - Q1), TIER & REPLAY (§4)
# ======================================================================
def _eod_aggregate(events) -> Tuple[List[Tuple[str, Decimal]], List[str]]:
    days: Dict[Any, Dict[str, Any]] = {}
    order: List[Any] = []
    for ev in events:
        k, a, day = ev[0], D(ev[1]), ev[2]
        if day not in days:
            days[day] = dict(trade=Decimal(0), cash=Decimal(0), n_trade=0, has_pos=False,
                             has_neg=False, has_cash=False)
            order.append(day)
        b = days[day]
        if k == "trade":
            b["trade"] += a
            b["n_trade"] += 1
            b["has_pos"] |= a > 0
            b["has_neg"] |= a < 0
        else:
            b["cash"] += a
            b["has_cash"] = True
    out: List[Tuple[str, Decimal]] = []
    flags: List[str] = []
    for day in sorted(order):
        b = days[day]
        if b["n_trade"]:
            out.append(("trade", b["trade"]))
        if b["has_cash"] and b["cash"] != 0:
            out.append(("cash", b["cash"]))
        if (b["has_pos"] and b["has_neg"]) or (b["n_trade"] and b["has_cash"]):
            if "intraday_order_unknown" not in flags:
                flags.append("intraday_order_unknown")
    return out, flags


def _q12(x: Decimal) -> Decimal:
    return x.quantize(Decimal("1E-12"))


def drawdown(c0, events, date_only: bool = False) -> Dict[str, Any]:
    """NAV trung lập dòng tiền; vật hóa iterable đúng một lần (§4.2)."""
    events = list(events)
    flags = []
    if any(len(e) < 2 or e[0] not in ('trade', 'cash') or to_dec(e[1]) is None for e in events):
        return dict(status='error', dd=None, max_dd=None, flags=['invalid_event'])
    if date_only:
        if any(len(e) < 3 for e in events):
            return dict(status='error', dd=None, max_dd=None, flags=['missing_day'])
        events, flags = _eod_aggregate(events)
    capital = to_dec(c0)
    n = sum(e[0] == 'trade' for e in events)
    if not n:
        return dict(status='STANDBY', dd=Decimal(0), max_dd=Decimal(0), flags=flags,
                    equity=capital, reason='no_trades')
    if capital is None or capital <= 0:
        return dict(status='STANDBY', dd=None, max_dd=None, flags=flags,
                    equity=capital, reason='missing_positive_capital')
    E, I, peak, max_dd = capital, Decimal(1), Decimal(1), Decimal(0)
    for ev in events:
        kind, amount = ev[0], D(ev[1])
        if kind == 'cash':
            E += amount
            continue
        if E <= 0:
            flags.append('nonpositive_equity_stop')
            break
        I = max(I * (Decimal(1) + amount/E), Decimal(0))
        E += amount
        peak = max(peak, I)
        max_dd = max(max_dd, (Decimal(1)-I/peak)*100)
    dd = max(Decimal(0), min(Decimal(100), (Decimal(1)-I/peak)*100))
    return dict(status='OK', dd=_q12(dd), max_dd=_q12(min(Decimal(100), max_dd)), equity=E, flags=flags)


def drawdown_r(r_multiples: Iterable[Any], include_zero_anchor: bool = True) -> Dict[str, Any]:
    """
    Chế độ DD theo R khi chưa khai báo vốn (§4.4 - Quyết định Q1):
      - `cumR_t = sum_{i<=t} R_i` (chỉ tính lệnh có R hợp lệ; đếm riêng `missing_r_count`).
      - Theo quyết định Q1 của v3.4 (`include_zero_anchor=True` mặc định):
          `PeakR_t = max(0, max_{1<=k<=t} cumR_k)`
          `DD_R(t) = PeakR_t - cumR_t`
        Với `R = [-1]` -> `DD_R = 1R` (còn v2 không mốc 0 cho `0R`).
    """
    raw_list = list(r_multiples)
    rs: List[Decimal] = []
    missing_count = 0
    for r in raw_list:
        v = to_dec(r)
        if v is None:
            missing_count += 1
        else:
            rs.append(v)
    if not rs:
        return dict(status="STANDBY", dd_r=Decimal(0), max_dd_r=Decimal(0),
                    cum_r=Decimal(0), missing_r_count=missing_count)
    cum = Decimal(0)
    peak: Optional[Decimal] = Decimal(0) if include_zero_anchor else None
    dd_r = Decimal(0)
    max_dd_r = Decimal(0)
    for r in rs:
        cum += r
        peak = cum if peak is None else max(peak, cum)
        dd_r = peak - cum
        max_dd_r = max(max_dd_r, dd_r)
    return dict(status="NO_CAPITAL_DD_R", dd_r=dd_r, max_dd_r=max_dd_r, cum_r=cum,
                missing_r_count=missing_count, display=f"DD: {dd_r:.1f}R")


def evaluate_safety_gate(c0, events, r_multiples: Optional[Iterable[Any]] = None,
                         tiers: Optional[Dict[str, Any]] = None,
                         date_only: bool = False) -> Dict[str, Any]:
    """
    Đánh giá trạng thái Safety Gate theo đúng bảng Mục 4.3:
      - N_trades == 0 -> CHƯA KHỞI TẠO VỐN (STANDBY), màu xám, DD 0.00%, can_input=True.
      - Có lệnh nhưng initialCapital = None -> CHƯA CÓ VỐN — DD tính theo R (§4.4), không áp tier %.
      - DD < t1 -> SAFE (xanh); t1 <= DD < t2 -> TIER_1 (vàng); t2 <= DD < t3 -> TIER_2 (cam);
        DD >= t3 -> TIER_3_BREACH (đỏ). Luôn cho phép nhập liệu (can_input=True).
    """
    events = list(events)
    t_cfg = tiers or {"t1": Decimal("2.5"), "t2": Decimal("4.0"), "t3": Decimal("5.0")}
    if not isinstance(t_cfg,dict):
        return dict(state='error',reason='invalid_tiers',can_input=True)
    t1,t2,t3=(to_dec(t_cfg.get(k)) for k in ('t1','t2','t3'))
    if any(v is None for v in (t1,t2,t3)):
        return dict(state='error',reason='invalid_tiers',can_input=True)
    if not Decimal(0) < t1 < t2 < t3 <= Decimal(100):
        return dict(state='error', reason='invalid_tiers', can_input=True)
    n_trades = sum(1 for e in events if e[0] == "trade")
    c0_dec = to_dec(c0)

    if n_trades == 0:
        return dict(state="STANDBY", label="CHƯA KHỞI TẠO VỐN (STANDBY)", color="gray",
                    tier=0, dd_pct=Decimal("0.00"), can_input=True)
    if c0_dec is None or c0_dec <= 0:
        ddr = drawdown_r(r_multiples or [])
        return dict(state="NO_CAPITAL_DD_R", label="CHƯA CÓ VỐN — DD tính theo R", color="gray_yellow",
                    tier=None, dd_pct=None, dd_r=ddr["dd_r"], max_dd_r=ddr["max_dd_r"],
                    display=ddr.get("display", "DD: 0.0R"), can_input=True)

    res = drawdown(c0_dec, events, date_only=date_only)
    if res['status'] == 'error':
        return dict(state='error', reason='invalid_events', can_input=True, flags=res['flags'])
    dd = res['dd']
    if dd >= t3:
        return dict(state="TIER_3_BREACH",
                    label="CẢNH BÁO RỦI RO CẤP 3 (TIER 3 BREACH)",
                    banner="Drawdown hiện tại vượt ngưỡng an toàn. Khuyến nghị dừng giao dịch thực tế để rà soát hệ thống.",
                    color="red", tier=3, dd_pct=dd, max_dd_pct=res["max_dd"],
                    equity=res["equity"], flags=res["flags"], can_input=True)
    if dd >= t2:
        return dict(state="TIER_2", label="Tier 2", color="orange", tier=2,
                    dd_pct=dd, max_dd_pct=res["max_dd"], equity=res["equity"], flags=res["flags"], can_input=True)
    if dd >= t1:
        return dict(state="TIER_1", label="Tier 1", color="yellow", tier=1,
                    dd_pct=dd, max_dd_pct=res["max_dd"], equity=res["equity"], flags=res["flags"], can_input=True)
    return dict(state="SAFE", label="An toàn", color="green", tier=0,
                dd_pct=dd, max_dd_pct=res["max_dd"], equity=res["equity"], flags=res["flags"], can_input=True)


def replay_tier_tags(c0, trades: List[Dict[str, Any]],
                     cashflows: Optional[List[Dict[str, Any]]] = None,
                     t3_pct="5.0") -> Tuple[List[Dict[str, Any]], int]:
    """Sort sự kiện UTC một lần rồi quét các openTime; O(N log N), không dùng projected DD (§4.5)."""
    capital, threshold = to_dec(c0), to_dec(t3_pct)
    if threshold is None or threshold <= 0:
        raise ValueError('invalid_tier_threshold')
    events, queries, out = [], [], copy.deepcopy(trades)
    invalid_events = False
    for index, trade in enumerate(out):
        trade['autoTags'] = [x for x in (trade.get('autoTags') or []) if x != 'tier3_breach_at_open']
        trade['flags'] = [x for x in (trade.get('flags') or []) if x != 'no_time_for_tier_check']
        op = source_to_utc(trade.get('openTime'), date_only=bool(trade.get('dateOnly')))
        if op['utc'] is None:
            trade['flags'].append('no_time_for_tier_check')
        else:
            queries.append((op['utc'], index))
        if trade.get('status') == 'closed' and not trade.get('dateOnly'):
            cl = source_to_utc(trade.get('closeTime'))
            value = to_dec(trade.get('netPnl'))
            if cl['utc'] is not None and value is not None:
                events.append((cl['utc'], 0, index, 'trade', value))
            elif trade.get('closeTime') or trade.get('netPnl') is not None:
                invalid_events = True
    for index, flow in enumerate(cashflows or []):
        tm = source_to_utc(flow.get('time'), date_only=bool(flow.get('dateOnly')))
        value = to_dec(flow.get('amount'))
        if tm['utc'] is not None and value is not None:
            events.append((tm['utc'], 1, index, 'cash', value))
        else:
            invalid_events = True
    events.sort(key=lambda x: x[:3])
    queries.sort()
    E, I, peak = capital, Decimal(1), Decimal(1)
    position = count = n_closed = 0
    stopped = False
    for opened, index in queries:
        while position < len(events) and events[position][0] <= opened:
            _, _, _, kind, value = events[position]
            position += 1
            if E is None or capital is None or capital <= 0 or stopped:
                continue
            if kind == 'cash':
                E += value
            elif E <= 0:
                stopped = True
            else:
                I = max(I * (1 + value/E), Decimal(0))
                E += value
                peak = max(peak, I)
                n_closed += 1
        if n_closed and _q12((1-I/peak)*100) >= threshold:
            out[index]['autoTags'].append('tier3_breach_at_open')
            count += 1
    if invalid_events:
        for trade in out:
            if 'replay_incomplete_invalid_event' not in trade['flags']:
                trade['flags'].append('replay_incomplete_invalid_event')
    return out, count


def daily_loss_pct(day_net_pnls: Iterable, equity_start) -> Optional[Decimal]:
    """max(0, -sum(netPnl ngày)) / vốn đầu ngày * 100. Tổng RÒNG realized của ngày (§4.6)."""
    e = to_dec(equity_start)
    if e is None or e <= 0:
        return None
    values=list(map(to_dec,day_net_pnls))
    if any(v is None for v in values):
        return None
    s = sum(values,Decimal(0))
    return max(Decimal(0), -s) / e * Decimal(100)


def trading_day_key(ts: dt.datetime, reset: str = "00:00", serverTimeZone=None,
                    fold=None) -> Optional[dt.date]:
    """Ngày kế toán tại timezone tài khoản sau khi trừ dailyResetTime; thiếu zone -> ValueError (§4.6)."""
    if not isinstance(ts, dt.datetime):
        raise ValueError('datetime_required')
    if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', reset):
        raise ValueError('invalid_reset_time')
    if ts.tzinfo is None:
        result = source_to_utc(ts.isoformat(), serverTimeZone, fold=fold)
        if result['utc'] is None:
            raise ValueError(result['reason'])
        ts = result['utc']
    if serverTimeZone:
        ts = ts.astimezone(ZoneInfo(serverTimeZone))
    hh, mm = map(int, reset.split(':'))
    return (ts - dt.timedelta(hours=hh, minutes=mm)).date()


# ======================================================================
# 9. METRICS, THANG SQN 7 BẬC, PHIÊN GIAO DỊCH & KIỂM TOÁN DỮ LIỆU (§6, §11)
# ======================================================================
def sqn_grade(sqn: Optional[float]) -> Optional[str]:
    """Thang SQN 7 bậc của Van Tharp (§6.2) [CẦN XÁC MINH với nguồn]."""
    if sqn is None or not math.isfinite(sqn):
        return None
    if sqn < 1.6:
        return "Khó giao dịch"
    if sqn < 2.0:
        return "Dưới trung bình"
    if sqn < 2.5:
        return "Trung bình"
    if sqn < 3.0:
        return "Tốt"
    if sqn <= 5.0:
        return "Xuất sắc"
    if sqn < 7.0:
        return "Rất xuất sắc"
    return "Holy Grail"


def hold_time_and_session(open_time: Optional[str], close_time: Optional[str],
                          date_only: bool = False) -> Dict[str, Any]:
    """
    Thời gian nắm giữ và Phiên giao dịch theo giờ UTC của openTime (§6.3):
      - dateOnly=True -> holdTime=None, session=None (không bịa 'trong ngày').
      - closeTime < openTime -> gắn cờ 'time_inversion', holdTime=None.
      - Phiên UTC [GIẢ ĐỊNH, cấu hình được]: Á 00–07, Âu 07–13, Mỹ 13–22, khác 22–24.
    """
    flags: List[str] = []
    if date_only or not open_time:
        return dict(holdTimeSeconds=None, session=None, flags=flags)
    try:
        ot = dt.datetime.fromisoformat(open_time.replace("Z", "+00:00"))
    except ValueError:
        return dict(holdTimeSeconds=None, session=None, flags=["invalid_open_time"])
    if ot.tzinfo is None:
        return dict(holdTimeSeconds=None, session=None, flags=['missing_timezone'])
    ot_utc = ot.astimezone(dt.timezone.utc)
    hr = ot_utc.hour
    if 0 <= hr < 7:
        session = "Asia"
    elif 7 <= hr < 13:
        session = "Europe"
    elif 13 <= hr < 22:
        session = "US"
    else:
        session = "Other"

    hold_sec: Optional[float] = None
    if close_time:
        try:
            ct = dt.datetime.fromisoformat(close_time.replace("Z", "+00:00"))
            if ct.tzinfo is None:
                return dict(holdTimeSeconds=None, session=session, flags=['missing_timezone'])
            ct_utc = ct.astimezone(dt.timezone.utc)
            diff = (ct_utc - ot_utc).total_seconds()
            if diff < 0:
                flags.append("time_inversion")
            else:
                hold_sec = diff
        except ValueError:
            flags.append("invalid_close_time")
    return dict(holdTimeSeconds=hold_sec, session=session, flags=flags)


def audit_trade_record(trade: Dict[str, Any]) -> List[str]:
    """
    Kiểm toán dữ liệu khi lưu/nhập (§11):
      - Bước 3: Hợp lệ giá và chiều trên Gross (Buy: P_exit > P_entry => Gross >= 0 và SL < P_entry; Sell ngược lại).
      - Bước 4: closeTime >= openTime (nếu có giờ).
    """
    flags = list(trade.get("flags") or [])
    d = trade.get("direction")
    pe = to_dec(trade.get("entryPrice"))
    px = to_dec(trade.get("exitPrice"))
    sl = to_dec(trade.get("slPrice"))
    gross = to_dec(trade.get("grossPnl"))

    if d in ("buy", "sell") and pe is not None:
        if sl is not None:
            if (d == "buy" and sl >= pe) or (d == "sell" and sl <= pe):
                if "invalid_sl_side" not in flags:
                    flags.append("invalid_sl_side")
        if px is not None and gross is not None:
            price_diff = (px - pe) if d == "buy" else (pe - px)
            if (price_diff > 0 and gross < 0) or (price_diff < 0 and gross > 0):
                if "pnl_sign_mismatch" not in flags:
                    flags.append("pnl_sign_mismatch")

    hs = hold_time_and_session(trade.get("openTime"), trade.get("closeTime"), bool(trade.get("dateOnly")))
    for fl in hs["flags"]:
        if fl not in flags:
            flags.append(fl)
    return flags


def _kelly_core(R: Sequence[float]) -> Dict[str, Any]:
    if not R:
        return dict(status="empty", f=None, reason="khong co lenh")
    mn, mx = min(R), max(R)
    if mn >= 0 and mx > 0:
        return dict(status="undefined_no_losses", f=None,
                    reason="khong co lenh thua: Kelly khong xac dinh (khong gioi han)")
    if mx <= 0 or sum(R) <= 0:
        return dict(status="no_edge", f=0.0, reason="ky vong <= 0")
    ub = 0.9999 / abs(mn)
    dg = lambda f: sum(r / (1.0 + f * r) for r in R) / len(R)
    if dg(ub) >= 0:
        return dict(status="ok", f=ub, reason="cham can tren")
    lo, hi = 0.0, ub
    for _ in range(200):
        mid = (lo + hi) / 2
        if dg(mid) > 0:
            lo = mid
        else:
            hi = mid
    return dict(status="ok", f=(lo + hi) / 2, reason=None)


def empirical_kelly(R: Sequence[float]) -> Dict[str, Any]:
    R=list(R)
    if any(not _finite_float(x) for x in R):
        return dict(status='error',f=None,reason='invalid_R_sample')
    return _kelly_core([float(x) for x in R])


def kelly_ci(R: Sequence[float], n_boot: int = 500, alpha: float = 0.10, seed: int = 1) -> Dict[str, Any]:
    R=list(R)
    if not isinstance(n_boot,int) or isinstance(n_boot,bool) or n_boot<1 or not _finite_float(alpha) or not 0<alpha<1:
        return dict(status='error',lo=None,hi=None,n_excluded=0,reason='invalid_bootstrap_configuration')
    if any(not _finite_float(x) for x in R):
        return dict(status='error',lo=None,hi=None,n_excluded=0,reason='invalid_R_sample')
    rs = random.Random(seed)
    Rf = [float(x) for x in R]
    vals, excl = [], 0
    for _ in range(n_boot):
        r = _kelly_core([rs.choice(Rf) for _ in Rf])
        if r["f"] is None:
            excl += 1
        else:
            vals.append(r["f"])
    if not vals:
        return dict(lo=None, hi=None, n_excluded=excl)
    vals.sort()
    lo = vals[int(alpha / 2 * (len(vals) - 1))]
    hi = vals[int((1 - alpha / 2) * (len(vals) - 1))]
    return dict(lo=lo, hi=hi, n_excluded=excl)


def metrics(R: Iterable, with_kelly_ci: bool = False, theta: float = 0.0, esWarnR: float = 2.0,
            money_pnls=None, trades=None) -> Dict[str, Any]:
    if not _finite_float(theta) or not _finite_float(esWarnR) or esWarnR < 0:
        return dict(N=0, status='error', reason='invalid_metric_configuration')
    Rf = []
    dropped = 0
    for x in R:
        v = to_dec(x)
        if v is None or not _finite_float(v):
            dropped += 1
        else:
            Rf.append(float(v))
    if not Rf:
        return dict(N=0, status='empty', dropped=dropped, label='Chưa có dữ liệu', sqn=None, median=None, omega=None, money=_money_metrics(money_pnls if money_pnls is not None else [t.get('netPnl') for t in (trades or []) if t.get('status')=='closed' and not t.get('isSimulation')]))
    N = len(Rf)
    mean = sum(Rf) / N
    sd = math.sqrt(sum((x - mean) ** 2 for x in Rf) / (N - 1)) if N > 1 else 0.0
    wins = [x for x in Rf if x > 0]
    loss = [x for x in Rf if x < 0]
    sum_win, sum_loss = sum(wins), abs(sum(loss))
    pf = (sum_win / sum_loss) if sum_loss > 0 else (float("inf") if sum_win > 0 else None)
    sqn = (math.sqrt(min(N, 100)) * mean / sd) if sd > 0 else None
    k = max(1, (5 * N + 99) // 100)                       # ceil(5N/100) bằng số nguyên
    es = -sum(sorted(Rf)[:k]) / k
    b = ((sum_win / len(wins)) / (sum_loss / len(loss))) if (wins and loss) else None
    kel = empirical_kelly(Rf)
    f = kel["f"]
    pf_api = dict(value=None, status="infinite_no_losses", display="∞") if (pf is not None and math.isinf(pf)) \
        else dict(value=pf, status="ok" if pf is not None else "empty", display=f"{pf:.2f}" if pf is not None else "—")
    out = dict(N=N, mean=mean, sd=sd, pf=pf, pf_api=pf_api, omega0_api=pf_api,
               sqn=sqn, sqn_grade=sqn_grade(sqn),
               omega0=pf, es5=es, p=len(wins) / N, q=len(loss) / N, b=b,
               kelly=f, kelly_status=kel["status"], kelly_reason=kel["reason"],
               half=(f / 2) if f is not None else None,
               quarter=(f / 4) if f is not None else None,
               kelly_note="tham_khao_N_nho" if N < 30 else "ok", dropped=dropped)
    above = sum(max(x-theta, 0) for x in Rf)
    below = sum(max(theta-x, 0) for x in Rf)
    out.update(omega=above/below if below else (float('inf') if above else None), theta=theta,
               median=statistics.median(Rf), es_k=k, es_warning=es>esWarnR, esWarnR=esWarnR,
               es_rough=N<20, sample_label='Chưa đủ mẫu' if N<30 else 'Đủ mẫu',
               sqn_sample_label='Chưa đủ mẫu' if N<30 else 'Đủ mẫu')
    if trades is not None:
        sqn_samples = [float(t['rMultiple']) for t in trades if t.get('status') == 'closed'
                       and t.get('oneRSource') != 'fallback_avg_loss' and not t.get('exclude_from_sqn')
                       and to_dec(t.get('rMultiple')) is not None and not t.get('isSimulation')]
        sn = len(sqn_samples)
        out['sqn_N'] = sn
        out['sqn'] = (math.sqrt(min(sn,100))*statistics.mean(sqn_samples)/statistics.stdev(sqn_samples)
                      if sn>1 and statistics.stdev(sqn_samples)>0 else None)
        out['sqn_grade'] = sqn_grade(out['sqn'])
        out['sqn_sample_label'] = 'Chưa đủ mẫu' if sn<30 else 'Đủ mẫu'
        if money_pnls is None:
            money_pnls = [t.get('netPnl') for t in trades if t.get('status')=='closed' and not t.get('isSimulation')]
    if money_pnls is not None:
        amounts = list(map(to_dec, money_pnls))
        known = [v for v in amounts if v is not None]
        win_total = sum((v for v in known if v>0), Decimal(0))
        loss_total = -sum((v for v in known if v<0), Decimal(0))
        out['money'] = dict(N=len(known), missing=len(amounts)-len(known),
                            expectancy=sum(known,Decimal(0))/len(known) if known else None,
                            win_rate=sum(v>0 for v in known)/len(known) if known else None,
                            pf=win_total/loss_total if loss_total else (Decimal('Infinity') if win_total else None))
    if with_kelly_ci:
        out["kelly_ci90"] = kelly_ci(Rf)
    return out


def metrics_to_json_safe(m):
    """Đệ quy qua dataclass/dict/list/tuple; Decimal hữu hạn -> chuỗi chính xác (§6.4)."""
    if dataclasses.is_dataclass(m):
        return metrics_to_json_safe(dataclasses.asdict(m))
    if isinstance(m, (float, Decimal)):
        finite=m.is_finite() if isinstance(m,Decimal) else math.isfinite(m)
        if not finite:
            nan=m.is_nan() if isinstance(m,Decimal) else math.isnan(m)
            status = 'nan' if nan else ('infinite_no_losses' if m>0 else 'negative_infinity')
            return dict(value=None, status=status, display='—' if nan else ('∞' if m>0 else '-∞'))
        return str(m) if isinstance(m, Decimal) else m
    if isinstance(m, dict):
        return {str(k):metrics_to_json_safe(v) for k,v in m.items()}
    if isinstance(m, (list, tuple, set)):
        return [metrics_to_json_safe(x) for x in m]
    if isinstance(m, (dt.datetime, dt.date)):
        return m.isoformat()
    return m


# ======================================================================
# 10. PROP PRESET V3 (CẬP NHẬT Q4 TOPSTEP 17/09/2026) + MÔ PHỎNG HAI TẦNG
# ======================================================================
MAXLOSS_TYPES = ("STATIC", "EOD_TRAILING", "INTRADAY_TRAILING")
AFTER_PAYOUT = ("KEEP_FLOOR", "LOCK_AT_INITIAL", "LOCK_AT_BUFFER", "FULL_RESET")
DL_FIXED = "FIXED_INITIAL_PCT_FROM_MIDNIGHT_BALANCE"
DL_MAXPREV = "PCT_OF_MAX_PREV_BALANCE_EQUITY"
DL_START = DL_FIXED  # Bí danh tương thích; [CẦN XÁC MINH định nghĩa chính thức]
DL_MODES = (DL_FIXED, DL_MAXPREV, DL_START)
CONSISTENCY_BEHAVIORS = ("INCREASE_TARGET_SOFT", "FAIL_HARD")


@dataclass
class PhaseRule:
    name: str
    profit_target_pct: Optional[float]
    min_trading_days: int = 0
    min_profitable_days: int = 0
    profitable_day_min_pct: float = 0.0
    max_days: Optional[int] = None


@dataclass
class MaxLossRule:
    pct: float
    type: str = "STATIC"
    lock_at_initial: bool = False
    lock_offset_amount: Decimal = Decimal(0)
    after_first_payout: str = "KEEP_FLOOR"


@dataclass
class DailyLossRule:
    enabled: bool = False
    pct: float = 0.0
    calculation_mode: str = DL_FIXED


@dataclass
class ConsistencyRule:
    enabled: bool = False
    max_day_share: float = 0.55
    behavior: str = "INCREASE_TARGET_SOFT"
    applies_to: Tuple[str, ...] = ("evaluation",)


@dataclass
class PropFeeRule:
    challenge_fee: Decimal = Decimal(0)
    activation_fee: Decimal = Decimal(0)
    refund_on_funded: bool = False


@dataclass
class PropPresetV3:
    id: str
    firm_name: str
    program_name: str
    program_version: str
    effective_from: Optional[str]
    last_verified: Optional[str]
    official_source_url: str
    capital: Decimal
    phases: List[PhaseRule]
    max_loss: MaxLossRule
    daily_loss: DailyLossRule = field(default_factory=DailyLossRule)
    consistency: Optional[ConsistencyRule] = None
    fees: PropFeeRule = field(default_factory=PropFeeRule)
    profit_split: float = 0.80
    payout_cycle_days: int = 14
    min_payout: Decimal = Decimal(0)
    stale_warn_after_months: int = 3
    currency: str = "USD"
    daily_reset_time: str = "00:00"
    verified: bool = False


# Kho Preset mặc định đã cập nhật Q4 (Topstep Help Center 17/09/2026)
DEFAULT_PROP_PRESETS: Dict[str, PropPresetV3] = {
    "topstep_50k_combine": PropPresetV3(
        id="topstep_50k_combine",
        firm_name="Topstep",
        program_name="50K Trading Combine",
        program_version="2026-09",
        effective_from="2026-09-17",
        last_verified=None,
        official_source_url="https://help.topstep.com/",
        capital=Decimal("50000"),
        phases=[PhaseRule(name="Combine", profit_target_pct=6.0)],
        max_loss=MaxLossRule(pct=4.0, type="EOD_TRAILING", lock_at_initial=True,
                             after_first_payout="LOCK_AT_INITIAL"),
        daily_loss=DailyLossRule(enabled=False, pct=0.0, calculation_mode=DL_START),
        consistency=ConsistencyRule(enabled=True, max_day_share=0.55,
                                    behavior="INCREASE_TARGET_SOFT", applies_to=("evaluation",)),
        fees=PropFeeRule(challenge_fee=Decimal("49"), activation_fee=Decimal("149"), refund_on_funded=False),
        profit_split=0.90,
        verified=False,
    ),
    "topstep_50k_xfa_standard": PropPresetV3(
        id="topstep_50k_xfa_standard",
        firm_name="Topstep",
        program_name="50K Express Funded Account (Standard Path)",
        program_version="2026-09",
        effective_from="2026-09-17",
        last_verified=None,
        official_source_url="https://help.topstep.com/",
        capital=Decimal("50000"),
        phases=[PhaseRule(name="XFA Standard", profit_target_pct=None)],
        max_loss=MaxLossRule(pct=4.0, type="EOD_TRAILING", lock_at_initial=True,
                             after_first_payout="LOCK_AT_INITIAL"),
        daily_loss=DailyLossRule(enabled=False, pct=0.0, calculation_mode=DL_START),
        consistency=ConsistencyRule(enabled=False, max_day_share=1.0,
                                    behavior="INCREASE_TARGET_SOFT", applies_to=("funded",)),
        profit_split=0.90,
        verified=False,
    ),
    "topstep_50k_xfa_consistency": PropPresetV3(
        id="topstep_50k_xfa_consistency",
        firm_name="Topstep",
        program_name="50K Express Funded Account (Consistency Path)",
        program_version="2026-09",
        effective_from="2026-09-17",
        last_verified=None,
        official_source_url="https://help.topstep.com/",
        capital=Decimal("50000"),
        phases=[PhaseRule(name="XFA Consistency", profit_target_pct=None)],
        max_loss=MaxLossRule(pct=4.0, type="EOD_TRAILING", lock_at_initial=True,
                             after_first_payout="LOCK_AT_INITIAL"),
        daily_loss=DailyLossRule(enabled=False, pct=0.0, calculation_mode=DL_START),
        consistency=ConsistencyRule(enabled=True, max_day_share=0.40,
                                    behavior="INCREASE_TARGET_SOFT", applies_to=("funded",)),
        profit_split=0.90,
        verified=False,
    ),
    "the5ers_100k_high_stakes_new": PropPresetV3(
        id="the5ers_100k_high_stakes_new",
        firm_name="The5ers",
        program_name="100K High Stakes (New 10%/5%)",
        program_version="v2025_10pct",
        effective_from="2025-01-01",
        last_verified=None,
        official_source_url="https://the5ers.com/high-stakes/",
        capital=Decimal("100000"),
        phases=[
            PhaseRule(name="Step 1", profit_target_pct=10.0, min_profitable_days=3, profitable_day_min_pct=0.5),
            PhaseRule(name="Step 2", profit_target_pct=5.0, min_profitable_days=3, profitable_day_min_pct=0.5),
        ],
        max_loss=MaxLossRule(pct=10.0, type="STATIC", lock_at_initial=False, after_first_payout="KEEP_FLOOR"),
        daily_loss=DailyLossRule(enabled=True, pct=5.0, calculation_mode=DL_MAXPREV),
        fees=PropFeeRule(challenge_fee=Decimal("495"), activation_fee=Decimal("0"), refund_on_funded=True),
        profit_split=0.80,
        verified=False,
    ),
    "the5ers_100k_high_stakes_classic": PropPresetV3(
        id="the5ers_100k_high_stakes_classic",
        firm_name="The5ers",
        program_name="100K High Stakes (Classic 8%/5%)",
        program_version="v2024_8pct",
        effective_from="2024-01-01",
        last_verified=None,
        official_source_url="https://the5ers.com/high-stakes/",
        capital=Decimal("100000"),
        phases=[
            PhaseRule(name="Step 1", profit_target_pct=8.0, min_profitable_days=3, profitable_day_min_pct=0.5),
            PhaseRule(name="Step 2", profit_target_pct=5.0, min_profitable_days=3, profitable_day_min_pct=0.5),
        ],
        max_loss=MaxLossRule(pct=10.0, type="STATIC", lock_at_initial=False, after_first_payout="KEEP_FLOOR"),
        daily_loss=DailyLossRule(enabled=True, pct=5.0, calculation_mode=DL_MAXPREV),
        fees=PropFeeRule(challenge_fee=Decimal("495"), activation_fee=Decimal("0"), refund_on_funded=True),
        profit_split=0.80,
        verified=False,
    ),
    "ftmo_100k_2step": PropPresetV3(
        id="ftmo_100k_2step",
        firm_name="FTMO",
        program_name="100K 2-Step Evaluation",
        program_version="2025-v1",
        effective_from="2025-01-01",
        last_verified=None,
        official_source_url="https://ftmo.com/",
        capital=Decimal("100000"),
        phases=[
            PhaseRule(name="FTMO Challenge", profit_target_pct=10.0, min_trading_days=4),
            PhaseRule(name="Verification", profit_target_pct=5.0, min_trading_days=4),
        ],
        max_loss=MaxLossRule(pct=10.0, type="STATIC", lock_at_initial=False, after_first_payout="FULL_RESET"),
        daily_loss=DailyLossRule(enabled=True, pct=5.0, calculation_mode=DL_FIXED),
        fees=PropFeeRule(challenge_fee=Decimal("540"), activation_fee=Decimal("0"), refund_on_funded=True),
        profit_split=0.80,
        verified=False,
    ),
    "apex_50k_intraday": PropPresetV3(
        id="apex_50k_intraday",
        firm_name="Apex Trader Funding",
        program_name="50K Evaluation / PA Intraday Trailing",
        program_version="2025-v1",
        effective_from="2025-01-01",
        last_verified=None,
        official_source_url="https://apextraderfunding.com/",
        capital=Decimal("50000"),
        phases=[PhaseRule(name="Evaluation", profit_target_pct=6.0)],
        max_loss=MaxLossRule(pct=4.0, type="INTRADAY_TRAILING", lock_at_initial=True,
                             lock_offset_amount=Decimal("100"), after_first_payout="LOCK_AT_BUFFER"),
        daily_loss=DailyLossRule(enabled=False, pct=0.0, calculation_mode=DL_START),
        consistency=ConsistencyRule(enabled=True, max_day_share=0.30,
                                    behavior="INCREASE_TARGET_SOFT", applies_to=("funded",)),
        profit_split=0.90,
        verified=False,
    ),
}


def check_consistency_rule(daily_pnls: Sequence[Any], base_target,
                           max_day_share="0.55",
                           behavior: str = "INCREASE_TARGET_SOFT") -> Dict[str, Any]:
    """
    Hàm công khai kiểm tra Quy tắc Nhất quán (Consistency Rule - §12.2, §12.4 & Q4):
      - `max_day_share`: Topstep Combine = 0.55 (55%), Topstep XFA Consistency = 0.40 (40%), Apex PA = 0.30 (30%).
      - Nếu `best_day / total_profit > max_day_share`:
          * `INCREASE_TARGET_SOFT`: mục tiêu lợi nhuận mới = `max(base_target, best_day / max_day_share)`.
          * `FAIL_HARD`: đánh rớt (`passed = False`).
    """
    pnls=list(map(to_dec,daily_pnls))
    if any(x is None for x in pnls) or to_dec(base_target) is None or D(base_target)<0 or to_dec(max_day_share) is None or not 0<D(max_day_share)<=1 or behavior not in CONSISTENCY_BEHAVIORS:
        raise ValueError('invalid_consistency_input')
    target = D(base_target)
    cap = D(max_day_share)
    total = sum(pnls, Decimal(0))
    best_day = max(pnls, default=Decimal(0))
    if best_day <= 0 or total <= 0:
        return dict(breached=False, best_day=best_day, total_profit=total,
                    day_share=Decimal(0), effective_target=target, passed=False)
    share = best_day / total
    breached = share > cap
    eff_target = max(target, best_day / cap) if (breached and behavior == "INCREASE_TARGET_SOFT") else target
    if behavior == "FAIL_HARD":
        passed = (total >= target) and (not breached)
    else:
        passed = total >= eff_target
    return dict(breached=breached, best_day=best_day, total_profit=total,
                day_share=share, max_day_share=cap,
                effective_target=eff_target, passed=passed)


def check_preset(p: PropPresetV3, today: Optional[dt.date] = None) -> List[str]:
    today = today or dt.date.today()
    w: List[str] = []
    if not p.verified:
        w.append("chua_kiem_chung_voi_nguon_chinh_thuc")
    if not p.official_source_url:
        w.append("thieu_officialSourceUrl")
    if not p.program_version:
        w.append("thieu_programVersion")
    if not p.effective_from:
        w.append("thieu_effectiveFrom")
    if not p.last_verified:
        w.append("chua_co_lastVerified")
    else:
        try:
            lv = dt.date.fromisoformat(p.last_verified)
            if (today.year - lv.year) * 12 + (today.month - lv.month) > p.stale_warn_after_months:
                w.append("quy_tac_qua_han_can_xac_minh_lai")
        except ValueError:
            w.append("lastVerified_sai_dinh_dang")
    if p.max_loss.type not in MAXLOSS_TYPES:
        w.append("maxLoss.type_khong_hop_le")
    if p.max_loss.after_first_payout not in AFTER_PAYOUT:
        w.append("afterFirstPayout_khong_hop_le")
    if p.daily_loss.calculation_mode not in DL_MODES:
        w.append("dailyLoss.calculationMode_khong_hop_le")
    if p.consistency and p.consistency.behavior not in CONSISTENCY_BEHAVIORS:
        w.append("consistency.behavior_khong_hop_le")
    if not p.phases:
        w.append("khong_co_phase")
    return w


def _normalize_samples(samples) -> List[Tuple[float, bool, Optional[float], Optional[float]]]:
    pop = []
    for s in samples:
        raw=s.get('R') if isinstance(s,dict) else s[0] if isinstance(s,(tuple,list)) and s else s
        if not _finite_float(raw):
            raise ValueError('invalid_R_sample')
        if isinstance(s, (tuple, list)):
            R = float(s[0])
            fk = bool(s[1]) if len(s) > 1 else True
            mae = float(s[2]) if len(s) > 2 and s[2] is not None else None
            mfe = float(s[3]) if len(s) > 3 and s[3] is not None else None
        elif isinstance(s, dict):
            R = float(s["R"])
            fk = bool(s.get("fee_known", True))
            mae = s.get("mae_R")
            mfe = s.get("mfe_R")
            mae = None if mae is None else float(mae)
            mfe = None if mfe is None else float(mfe)
        else:
            R, fk, mae, mfe = float(s), True, None, None
        if any(v is not None and not math.isfinite(v) for v in (mae,mfe)):
            raise ValueError('invalid_excursion')
        if mae is not None and mae>0 or mfe is not None and mfe<0:
            raise ValueError('invalid_excursion_sign')
        if math.isfinite(R):
            pop.append((R, fk, mae, mfe))
    return pop


def simulate_path(rs: random.Random, pop, cumw, phase: PhaseRule, preset: PropPresetV3,
                  risk_pct: float = 1.0, trades_per_day: int = 1,
                  sample_mode: str = "empirical", fee_drag_R: float = 0.0,
                  bound: str = "optimistic", mfe_extra_R: float = 0.5,
                  day_cap: int = 250, day_samples=None) -> Any:
    if phase.profit_target_pct is None:
        return dict(status='error', reason='phase_khong_co_muc_tieu')
    if not pop or not cumw or not _finite_float(risk_pct) or risk_pct<=0 or trades_per_day<1 or day_cap<1:
        return dict(status='error', reason='invalid_simulation_input')
    B0 = 100.0
    mx, dl = preset.max_loss, preset.daily_loss
    L = mx.pct
    cap = B0
    if mx.lock_offset_amount:
        cap = B0 + float(mx.lock_offset_amount) / float(preset.capital) * 100.0
    cons = preset.consistency if (preset.consistency and preset.consistency.enabled and 'evaluation' in preset.consistency.applies_to) else None

    def floor_of(peak: float) -> float:
        if mx.type == "STATIC":
            return B0 - L
        f = peak - L
        return min(f, cap) if mx.lock_at_initial else f

    B = peak = B0
    floor = floor_of(peak)
    best_day, prof_days = 0.0, 0
    days = phase.max_days or day_cap
    n = len(pop)
    for day in range(days):
        day_start = B
        fl_daily = None
        if dl.enabled:
            fl_daily = (day_start * (1 - dl.pct / 100.0)) if dl.calculation_mode == DL_MAXPREV \
                else (day_start - dl.pct)
        daily_samples = rs.choice(day_samples) if day_samples else [pop[i] for i in rs.choices(range(n), cum_weights=cumw, k=trades_per_day)]
        for R, fk, mae, mfe in daily_samples:
            if sample_mode == "parametric" or not fk:
                R -= fee_drag_R
            Bb = B
            Ba = Bb + R * risk_pct
            low = min(Bb, Ba) if mae is None else min(Bb + mae * risk_pct, Bb, Ba)
            if mfe is not None:
                high = max(Bb + mfe * risk_pct, Bb, Ba)
            elif bound == "pessimistic" and R > 0:
                high = Ba + mfe_extra_R * risk_pct
            else:
                high = max(Bb, Ba)
            if mx.type == "INTRADAY_TRAILING":
                if bound == "optimistic":
                    if low <= floor:
                        return 0
                    peak = max(peak, high)
                    floor = floor_of(peak)
                    if Ba <= floor:
                        return 0
                else:
                    peak = max(peak, high)
                    floor = floor_of(peak)
                    if low <= floor or Ba <= floor:
                        return 0
            elif low <= floor:
                return 0
            if fl_daily is not None and low <= fl_daily:
                return 0
            B = Ba
        gain = B - day_start
        best_day = max(best_day, gain)
        if gain > 0 and gain >= phase.profitable_day_min_pct:
            prof_days += 1
        if mx.type == "EOD_TRAILING":
            peak = max(peak, B)
            floor = floor_of(peak)
        elif mx.type == "INTRADAY_TRAILING":
            peak = max(peak, B)
            floor = floor_of(peak)
        total = B - B0
        need = phase.profit_target_pct
        if cons:
            if cons.behavior == "INCREASE_TARGET_SOFT":
                need = max(need, best_day / cons.max_day_share)
            elif total >= need and best_day > cons.max_day_share * total:
                return 0
        if total >= need and (day + 1) >= phase.min_trading_days and prof_days >= phase.min_profitable_days:
            return 1
    return 0


def _pct(sorted_ps: List[float], num: int) -> float:
    n = len(sorted_ps)
    k = max(1, (num * n + 99) // 100)
    return sorted_ps[min(n, k) - 1]


def wilson_ci95(successes: int, total: int, z: float = 1.959963984540054) -> Tuple[float, float]:
    """Khoảng tin cậy Wilson 95% cho xác suất nhị thức (§12.4)."""
    if any(not isinstance(x,int) or isinstance(x,bool) for x in (successes,total)) or total<=0 or not 0<=successes<=total or not _finite_float(z) or z<=0:
        raise ValueError('invalid_binomial_counts_or_z')
    p = successes / total
    z2 = z * z
    denom = 1.0 + z2 / total
    center = (p + z2 / (2.0 * total)) / denom
    half = (z / denom) * math.sqrt((p * (1.0 - p) / total) + (z2 / (4.0 * total * total)))
    return max(0.0, center - half), min(1.0, center + half)


def prop_pass_probability(samples, preset: PropPresetV3, phase_index: int = 0,
                          risk_pct: float = 1.0, trades_per_day: int = 1,
                          sample_mode: str = "empirical", fee_drag_R: float = 0.0,
                          b_outer: int = 200, m_inner: int = 300,
                          resample: str = "bayesian", bound: str = "optimistic",
                          mfe_extra_R: float = 0.5, seed: int = 0,
                          day_cap: int = 250, block_size: int = 5, parametric_mean=None, parametric_sd=None, parametric_n=200) -> Dict[str, Any]:
    """
    Bootstrap HAI TẦNG (hỗ trợ 'bayesian', 'efron', 'block', 'day', 'none').
    """
    samples = list(samples)
    if not samples and sample_mode=='parametric':
        if parametric_mean is None or parametric_sd is None:
            return dict(status='needs_confirm',reason='parametric_distribution_required')
        if not _finite_float(parametric_mean) or not _finite_float(parametric_sd) or parametric_sd<0 or not isinstance(parametric_n,int) or isinstance(parametric_n,bool) or parametric_n<1:
            return dict(status='error',reason='invalid_parametric_distribution')
        generator=random.Random(seed)
        samples=[dict(R=generator.gauss(float(parametric_mean),float(parametric_sd)),fee_known=False) for _ in range(parametric_n)]
    if not isinstance(phase_index, int) or isinstance(phase_index,bool) or not 0<=phase_index<len(preset.phases):
        return dict(status='error', reason='invalid_phase_index')
    if preset.phases[phase_index].profit_target_pct is None:
        return dict(status='error', reason='phase_khong_co_muc_tieu')
    if any(not isinstance(v,int) or isinstance(v,bool) or v<1 for v in (b_outer,m_inner,trades_per_day,day_cap,block_size)):
        return dict(status='error', reason='invalid_simulation_count')
    if not _finite_float(risk_pct) or risk_pct<=0 or not _finite_float(fee_drag_R) or fee_drag_R<0:
        return dict(status='error', reason='invalid_simulation_input')
    if bound not in ('optimistic','pessimistic') or sample_mode not in ('empirical','parametric'):
        return dict(status='error', reason='invalid_simulation_mode')
    groups = None
    if resample == 'day':
        grouping = _group_day_samples(samples)
        if grouping['status'] != 'ok':
            return grouping
        groups = grouping['groups']
    try:
        pop0 = _normalize_samples(samples)
    except (ValueError, TypeError, KeyError, IndexError):
        return dict(status='error', reason='invalid_R_sample')
    if not pop0:
        return dict(status="empty", reason="khong co mau R")
    if phase_index >= len(preset.phases):
        return dict(status="error", reason="phase_index vuot qua so phase")
    phase = preset.phases[phase_index]
    outer = 1 if resample == "none" else b_outer
    ps: List[float] = []
    total_wins = 0
    world_intervals = []
    for b in range(outer):
        rs = random.Random(seed * 1_000_003 + b)
        day_pop = None
        if resample == 'day':
            day_pop = [rs.choice(groups) for _ in groups]
            pop = [item for group in day_pop for item in group]
            w = [1.0]*len(pop)
        elif resample == "bayesian":
            w = [rs.expovariate(1.0) for _ in pop0]
            pop = pop0
        elif resample == "efron":
            pop = [rs.choice(pop0) for _ in pop0]
            w = [1.0] * len(pop)
        elif resample == "block":
            pop = []
            n0 = len(pop0)
            while len(pop) < n0:
                start = rs.randrange(n0)
                for j in range(block_size):
                    if len(pop) < n0:
                        pop.append(pop0[(start + j) % n0])
            w = [1.0] * len(pop)
        elif resample == "none":
            pop, w = pop0, [1.0] * len(pop0)
        else:
            return dict(status="error", reason="resample khong hop le")
        cumw = list(accumulate(w))
        wins = sum(simulate_path(rs, pop, cumw, phase, preset, risk_pct, trades_per_day, sample_mode,
                                 fee_drag_R, bound, mfe_extra_R, day_cap, day_pop) for _ in range(m_inner))
        world_intervals.append(wilson_ci95(wins,m_inner))
        total_wins += wins
        ps.append(wins / m_inner)
    s = sorted(ps)
    w_lo, w_hi = wilson_ci95(total_wins, outer * m_inner)
    return dict(status="ok", n_outer=outer, m_inner=m_inner, p5=_pct(s, 5), p50=_pct(s, 50),
                p95=_pct(s, 95), mean=sum(ps) / len(ps), ps=ps,
                wilson_ci95=(w_lo,w_hi) if outer==1 else None,
                wilson_ci95_by_world=world_intervals, wilson_scope='single_world' if outer==1 else 'conditional_per_world',
                resample=resample, seed=seed, sample_mode=sample_mode,
                small_sample_warning=len(pop0) < 30)


def prop_pass_bounds(samples, preset: PropPresetV3, **kw) -> Dict[str, Any]:
    up = prop_pass_probability(samples, preset, bound="optimistic", **kw)
    lo = prop_pass_probability(samples, preset, bound="pessimistic", **kw)
    return dict(upper=up, lower=lo, same=(preset.max_loss.type != "INTRADAY_TRAILING"))


def fail_streak_risk(ps: Sequence[float], k: int = 5) -> Dict[str, float]:
    ps=list(ps)
    if not ps:
        return dict(correlated=None,naive_independent=None,status='empty',reason='missing_probabilities')
    if not isinstance(k,int) or isinstance(k,bool) or k<1 or any(not _finite_float(p) or not 0<=p<=1 for p in ps):
        return dict(correlated=None,naive_independent=None,status='error',reason='invalid_probabilities_or_k')
    m = sum(ps) / len(ps)
    corr = sum((1 - p) ** k for p in ps) / len(ps)
    return dict(correlated=corr, naive_independent=(1 - m) ** k)


def attempts_for_confidence(ps: Sequence[float], conf: float = 0.90, n_max: int = 100) -> Optional[int]:
    ps=list(ps)
    if not _finite_float(conf) or not 0<conf<1 or not isinstance(n_max,int) or n_max<1 or any(not _finite_float(p) or not 0<=p<=1 for p in ps):
        raise ValueError('invalid_attempts_input')
    if not ps: return None
    for n in range(1, n_max + 1):
        if sum(1 - (1 - p) ** n for p in ps) / len(ps) >= conf:
            return n
    return None


def n_attempts_independent(p: float, conf: float = 0.90) -> Optional[int]:
    """Công thức N_90 độc lập (§12.4 & Test 15.8): ceil(ln(1-conf)/ln(1-P))."""
    if not _finite_float(p) or not _finite_float(conf) or not 0<=p<=1 or not 0<conf<1:
        raise ValueError('invalid_probability_or_confidence')
    if p <= 0:
        return None
    if p >= 1:
        return 1
    return math.ceil(math.log(1.0 - conf) / math.log(1.0 - p))


def eod_floor_series(b0, l_frac=None, closes: Sequence[Any] = (), lock_at_initial: bool = True,
                      *, l_pct=None) -> List[Decimal]:
    """Sàn EOD; l_frac là phân số 0.04=4%. l_pct keyword cũ giữ ngữ nghĩa, có cảnh báo (§12.4)."""
    if l_pct is not None:
        warnings.warn('l_pct deprecated; use l_frac (fraction)', DeprecationWarning, stacklevel=2)
        if l_frac is not None:
            raise ValueError('both_l_frac_and_l_pct')
        l_frac = l_pct
    B0, L = to_dec(b0), to_dec(l_frac)
    values = list(map(to_dec, closes))
    if B0 is None or B0<=0 or L is None or not 0<L<1 or any(x is None for x in values):
        raise ValueError('invalid_eod_floor_input')
    floor, peak, result = None, B0, []
    for value in values:
        peak = max(peak, value)
        candidate = peak - B0*L
        if lock_at_initial:
            candidate = min(B0,candidate)
        floor = candidate if floor is None else max(floor,candidate)
        result.append(floor)
    return result


def prop_ev_roi(p_funded: float, mean_gross_payout, profit_split: float,
                challenge_fee, activation_fee=0, refund_on_funded: bool = False) -> Dict[str, Any]:
    """
    Công thức EV và ROI đầy đủ (§12.4, bắt buộc dùng mean payout, không dùng median):
      EV_attempt = E[sum payout * split] + P(Funded) * refund - fee - P(Funded) * activationFee
      ROI        = EV_attempt / (fee + P(Funded) * activationFee) * 100
    """
    pf = to_dec(p_funded)
    mp = to_dec(mean_gross_payout)
    sp = to_dec(profit_split)
    fee = to_dec(challenge_fee)
    act = to_dec(activation_fee)
    if None in (pf, mp, sp, fee, act):
        return dict(status="missing", ev_attempt=None, roi_pct=None)
    if not 0<=pf<=1 or not 0<=sp<=1 or min(mp,fee,act)<0:
        return dict(status='error',ev_attempt=None,roi_pct=None,reason='invalid_ev_input')
    refund = fee if refund_on_funded else Decimal(0)
    expected_payout_net = mp * sp
    ev = expected_payout_net + pf * refund - fee - pf * act
    outlay = fee + pf * act
    roi = (ev / outlay * Decimal(100)) if outlay > 0 else None
    return dict(status="ok", ev_attempt=ev, roi_pct=roi, expected_outlay=outlay)


# ======================================================================
# 11. BỔ SUNG v3.4 — MÔ HÌNH, TIMEZONE, PIPELINE, VÒNG ĐỜI CẤP VỐN
# ======================================================================
def _finite_float(value):
    if isinstance(value, bool):
        return False
    try:
        return math.isfinite(float(value))
    except (ValueError, TypeError, OverflowError):
        return False


def _money_metrics(money_pnls):
    if money_pnls is None: return None
    amounts=list(map(to_dec,money_pnls))
    known=[v for v in amounts if v is not None]
    wins=sum((v for v in known if v>0),Decimal(0))
    losses=-sum((v for v in known if v<0),Decimal(0))
    return dict(N=len(known),missing=len(amounts)-len(known),
                expectancy=sum(known,Decimal(0))/len(known) if known else None,
                win_rate=sum(v>0 for v in known)/len(known) if known else None,
                pf=wins/losses if losses else (Decimal('Infinity') if wins else None))


@dataclass
class Fallback1RConfig:
    mode: str = 'equity_pct'
    equityPct: Decimal = Decimal('1.0')
    notionalPct: Optional[Decimal] = None
    fixedAmount: Optional[Decimal] = None
    minEmpiricalLosses: int = 5

    def __post_init__(self):
        self.equityPct = D(self.equityPct)
        self.notionalPct = D(self.notionalPct)
        self.fixedAmount = D(self.fixedAmount)
        if self.mode not in ('equity_pct','notional_pct','fixed_amount','empirical_avg_loss'):
            raise ValueError('invalid_fallback_mode')
        if self.equityPct is None or not Decimal('.1') <= self.equityPct <= Decimal('5'):
            raise ValueError('invalid_equity_pct')
        if self.notionalPct is not None and not 0<self.notionalPct<=100:
            raise ValueError('invalid_notional_pct')
        if self.fixedAmount is not None and self.fixedAmount<=0:
            raise ValueError('invalid_fixed_1r')
        if isinstance(self.minEmpiricalLosses,bool) or self.minEmpiricalLosses<5:
            raise ValueError('min_losses_must_be_at_least_five')


@dataclass
class AccountProfile:
    id: str
    name: str = ''
    baseCurrency: str = 'USD'
    initialCapital: Optional[Decimal] = None
    broker: Optional[str] = None
    serverTimeZone: str = 'UTC'
    dailyResetTime: str = '00:00'
    tiers: Dict[str, Any] = field(default_factory=lambda:dict(t1=Decimal('2.5'),t2=Decimal(4),t3=Decimal(5)))
    dailyLossLimitPct: Optional[Decimal] = None
    fallback1R: Fallback1RConfig = field(default_factory=Fallback1RConfig)
    fxRates: Dict[str, Any] = field(default_factory=dict)
    vnStockFees: Dict[str, Any] = field(default_factory=lambda:dict(feeBuyRate=Decimal('.0015'),feeSellRate=Decimal('.0015'),taxSellRate=Decimal('.0010')))
    costBasis: str = 'FIFO'
    strictMode: bool = False

    def __post_init__(self):
        self.initialCapital = D(self.initialCapital)
        self.dailyLossLimitPct = D(self.dailyLossLimitPct)
        if not self.id or not self.baseCurrency:
            raise ValueError('account_id_currency_required')
        if self.initialCapital is not None and self.initialCapital<=0:
            raise ValueError('initial_capital_must_be_positive_or_none')
        try:
            ZoneInfo(self.serverTimeZone)
        except (ZoneInfoNotFoundError,ValueError) as exc:
            raise ValueError('invalid_server_timezone') from exc
        if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',self.dailyResetTime):
            raise ValueError('invalid_reset_time')
        self.tiers = {k:D(self.tiers[k]) for k in ('t1','t2','t3')}
        if not 0<self.tiers['t1']<self.tiers['t2']<self.tiers['t3']<=100:
            raise ValueError('invalid_tiers')
        if isinstance(self.fallback1R,dict):
            self.fallback1R = Fallback1RConfig(**self.fallback1R)
        self.vnStockFees = {k:D(v) for k,v in self.vnStockFees.items()}
        if any(v is None or not 0<=v<=Decimal('.05') for v in self.vnStockFees.values()):
            raise ValueError('fees_must_be_fraction_le_005')
        if self.dailyLossLimitPct is not None and not 0<self.dailyLossLimitPct<=100:
            raise ValueError('invalid_daily_loss_limit')
        if self.costBasis not in ('FIFO','AVERAGE'):
            raise ValueError('invalid_cost_basis')


@dataclass
class InstrumentSpec:
    symbol: str
    cls: str
    quoteCurrency: str
    contractSize: Decimal
    volumeStep: Decimal
    volumeMin: Decimal
    baseCurrency: Optional[str] = None
    volumeMax: Optional[Decimal] = None
    tickSize: Optional[Decimal] = None
    priceUnit: str = 'full'
    confirmedByUser: bool = False
    source: str = 'builtin'

    def __post_init__(self):
        for key in ('contractSize','volumeStep','volumeMin','volumeMax','tickSize'):
            value = D(getattr(self,key))
            if value is not None and value<=0:
                raise ValueError('invalid_instrument_'+key)
            setattr(self,key,value)
        if any(getattr(self,k) is None for k in ('contractSize','volumeStep','volumeMin')):
            raise ValueError('missing_instrument_size')
        if self.volumeMax is not None and self.volumeMax<self.volumeMin:
            raise ValueError('max_volume_below_min')
        if self.cls not in ('forex','metal','oil','index','crypto_linear','stock_vn','stock_intl','futures_vn'):
            raise ValueError('invalid_instrument_class')
        if not self.symbol or not self.quoteCurrency or self.priceUnit not in ('full','thousand') or self.source not in ('builtin','user'):
            raise ValueError('invalid_instrument_identity')


@dataclass
class Trade:
    id: str
    accountId: str
    symbol: str
    direction: str
    volume: Decimal
    entryPrice: Decimal
    currency: str = 'USD'
    uidPrimary: Optional[str] = None
    importFingerprint: str = ''
    occurrenceIndex: int = 0
    externalTicketId: Optional[str] = None
    market: str = ''
    rawSymbol: str = ''
    entryQty: Optional[Decimal] = None
    openQty: Optional[Decimal] = None
    entryAvgClosed: Optional[Decimal] = None
    exitPrice: Optional[Decimal] = None
    rawOpenTime: Optional[str] = None
    openTime: Optional[str] = None
    closeTime: Optional[str] = None
    dateOnly: bool = False
    slPrice: Optional[Decimal] = None
    tpPrice: Optional[Decimal] = None
    slMayBeModified: bool = False
    commission: Optional[Decimal] = None
    swap: Optional[Decimal] = None
    fee: Optional[Decimal] = None
    feeCurrency: Optional[str] = None
    grossPnl: Optional[Decimal] = None
    netPnl: Optional[Decimal] = None
    netPnlSource: str = 'manual'
    feeKnown: bool = False
    status: str = 'open'
    oneR: Optional[Decimal] = None
    oneRSource: Optional[str] = None
    rMultiple: Optional[Decimal] = None
    mfeR: Optional[Decimal] = None
    maeR: Optional[Decimal] = None
    legs: List[Any] = field(default_factory=list)
    setupId: Optional[str] = None
    disciplineTags: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    screenshots: List[str] = field(default_factory=list)
    isReviewed: bool = False
    userEditedFields: List[str] = field(default_factory=list)
    autoTags: List[str] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    importBatchId: str = ''
    isSimulation: bool = False

    def __post_init__(self):
        for key in ('volume','entryPrice','entryQty','openQty','entryAvgClosed','exitPrice','slPrice','tpPrice',
                    'commission','swap','fee','grossPnl','netPnl','oneR','rMultiple','mfeR','maeR'):
            setattr(self,key,D(getattr(self,key)))
        if self.direction not in ('buy','sell') or self.status not in ('open','closed','orphan_sell'):
            raise ValueError('invalid_trade_direction_status')
        if not self.id or not self.accountId or not self.currency or not self.symbol:
            raise ValueError('trade_identity_required')
        if self.volume is None or self.volume<0 or self.entryPrice is None or self.entryPrice<=0:
            raise ValueError('invalid_trade_size_price')
        if self.oneR is not None and self.oneR<=0:
            raise ValueError('invalid_trade_oneR')
        if self.netPnlSource not in ('file','derived_A','derived_B','derived_C','manual'):
            raise ValueError('invalid_net_source')
        if self.oneRSource not in (None,'exact','fallback_equity_pct','fallback_notional_pct','fallback_fixed','fallback_avg_loss'):
            raise ValueError('invalid_oneR_source')
        if self.occurrenceIndex<0:
            raise ValueError('invalid_occurrence_index')


@dataclass
class CashFlow:
    id: str
    accountId: str
    time: Optional[str]
    amount: Decimal
    kind: str
    importBatchId: str = ''
    currency: str = 'USD'
    dateOnly: bool = False
    rawTime: Optional[str] = None

    def __post_init__(self):
        self.amount = D(self.amount)
        if self.amount is None or self.kind not in ('deposit','withdrawal','credit','adjustment'):
            raise ValueError('invalid_cashflow')
        if self.kind=='withdrawal' and self.amount>0 or self.kind=='deposit' and self.amount<0:
            raise ValueError('invalid_cashflow_sign')
        if not self.id or not self.accountId or not self.currency:
            raise ValueError('cashflow_identity_required')


def source_to_utc(raw, serverTimeZone=None, date_order='YMD', fold=None, date_only=False):
    """B3: không đoán DST. UTC là datetime aware hoặc None + reason; hash không gọi hàm này."""
    empty = dict(utc=None, iso=None, flags=[])
    if raw is None or not str(raw).strip():
        return dict(empty,status='error',reason='missing_time')
    if date_only:
        return dict(empty,status='date_only',reason='date_only',flags=['date_only'])
    text = str(raw).strip()
    canonical = canonical_raw_time(text,date_order)
    if canonical is None:
        return dict(empty,status='error',reason='invalid_time')
    if canonical['date_only']:
        return dict(empty,status='date_only',reason='date_only',flags=['date_only'])
    try:
        if date_order=='YMD' and re.match(r'^\d{4}-\d{2}-\d{2}',text):
            value = dt.datetime.fromisoformat(text.replace('Z','+00:00'))
        else:
            base = dt.datetime.strptime(canonical['canonical'],'%Y%m%d%H%M%S')
            suffix = re.search(r'(Z|[+-]\d{2}:?\d{2})$',text)
            if suffix:
                offset = suffix[0]
                value = dt.datetime.fromisoformat(base.isoformat()+offset.replace('Z','+00:00'))
            else:
                value = base
        if value.tzinfo is not None:
            utc = value.astimezone(dt.timezone.utc)
            return dict(status='ok',utc=utc,iso=utc.isoformat().replace('+00:00','Z'),reason=None,flags=[])
        if not serverTimeZone:
            return dict(empty,status='needs_confirm',reason='missing_timezone',flags=['missing_timezone'])
        zone = ZoneInfo(serverTimeZone)
        candidates = []
        for f in (0,1):
            candidate = value.replace(tzinfo=zone,fold=f)
            back = candidate.astimezone(dt.timezone.utc).astimezone(zone)
            if back.replace(tzinfo=None)==value and back.fold==f:
                candidates.append(candidate)
        if not candidates:
            return dict(empty,status='needs_confirm',reason='dst_nonexistent',flags=['dst_nonexistent'])
        ambiguous = len(candidates)==2 and candidates[0].utcoffset()!=candidates[1].utcoffset()
        if fold not in (None,0,1) or isinstance(fold,bool):
            return dict(empty,status='error',reason='invalid_fold')
        if ambiguous and fold is None:
            return dict(empty,status='needs_confirm',reason='dst_ambiguous',flags=['dst_ambiguous'])
        selected = value.replace(tzinfo=zone,fold=fold or 0)
        utc = selected.astimezone(dt.timezone.utc)
        return dict(status='ok',utc=utc,iso=utc.isoformat().replace('+00:00','Z'),reason=None,
                    flags=['dst_ambiguous_resolved'] if ambiguous else [],fold=selected.fold)
    except (ValueError,OverflowError,ZoneInfoNotFoundError):
        return dict(empty,status='error',reason='invalid_timezone_or_time')


def compute_r_multiple(net_pnl=None, one_r=None, entry=None, sl=None, volume=None, vpoint=None,
                       direction=None, entry_legs=None, fallback_config=None, equity_before_entry=None,
                       notional_acct=None, loss_pnls=None, oneRSource=None):
    """B2: exact -> fallback; empirical vẫn có R nhưng không dùng xếp hạng SQN (§5.6)."""
    flags = []
    if one_r is not None:
        risk = to_dec(one_r)
        resolved = dict(oneR=risk,oneRSource=oneRSource or 'exact')
    elif entry_legs is not None:
        resolved = cycle_oneR(entry_legs,vpoint)
    else:
        risk = risk1r(entry,sl,volume,vpoint,direction)
        resolved = dict(oneR=risk,oneRSource='exact' if risk else None)
        if sl is not None and direction is not None and risk is None:
            flags.append('invalid_or_missing_sl')
    risk = resolved['oneR']
    if risk is None or risk<=0:
        cfg = fallback_config or Fallback1RConfig()
        if isinstance(cfg,dict):
            cfg = Fallback1RConfig(**cfg)
        # mode là lựa chọn đầu chuỗi; không dùng một lựa chọn ưu tiên cao hơn người dùng đã chọn.
        order = ('equity_pct','notional_pct','fixed_amount','empirical_avg_loss')
        start = order.index(cfg.mode)
        resolved = resolve_fallback_1r(
            equity_before_entry if start==0 else None,cfg.equityPct,
            notional_acct if start<=1 else None,cfg.notionalPct,
            cfg.fixedAmount if start<=2 else None,loss_pnls,cfg.minEmpiricalLosses)
        risk = resolved['oneR']
    pnl = to_dec(net_pnl)
    result = dict(resolved,flags=flags+list(resolved.get('flags',[])))
    result['exclude_from_sqn'] = resolved.get('oneRSource')=='fallback_avg_loss'
    if pnl is None or risk is None or risk<=0:
        return dict(result,status='missing',rMultiple=None,reason='missing_netPnl' if pnl is None else 'unavailable_oneR')
    return dict(result,status='ok',rMultiple=pnl/risk,reason=None)


def cycle_to_trade(cycle, vpoint=1, account_id='', symbol='', currency='USD',
                    fees_in_account=True, fallback_1r=None):
    """B1: bảo toàn entry_avg / entry_avg_closed, phí tiền tài khoản, Q2 (§9.4)."""
    if cycle.get('status')=='orphan_sell':
        return dict(status='orphan_sell',accountId=account_id,symbol=symbol,currency=currency,
                    volume=cycle['qty'],netPnl=None,netPnlSource='derived_C',flags=['orphan_sell'],oneR=None,rMultiple=None)
    vp = to_dec(vpoint)
    if vp is None or vp<=0:
        return dict(status='error',reason='invalid_vpoint',netPnl=None)
    net = cycle_net_account(cycle,vp,fees_in_account)
    rr = compute_r_multiple(net,entry_legs=cycle.get('entry_legs',[]),vpoint=vp,
                            fallback_config=dict(mode='fixed_amount',fixedAmount=fallback_1r) if fallback_1r else None)
    signature = json.dumps(metrics_to_json_safe([account_id,symbol,cycle['legs']]),sort_keys=True,ensure_ascii=False)
    flags = list(rr.get('flags',[]))
    fee_known = all(leg.get('feeKnown',True) for leg in cycle.get('legs',[]))
    if not fee_known:
        flags.append('fee_missing_as_zero')
    if vp!=1:
        flags.append('net_price_units_not_account_money')
    return dict(id=hashlib.sha256(signature.encode()).hexdigest(),accountId=account_id,symbol=symbol,
                rawSymbol=symbol,currency=currency,direction='buy' if cycle['direction']=='long' else 'sell',
                status=cycle['status'],volume=cycle['qty'],entryQty=cycle['entry_qty'],openQty=cycle.get('open_qty',Decimal(0)),
                entryPrice=cycle['entry_avg'],entryAvgClosed=cycle['entry_avg_closed'],exitPrice=cycle['exit_avg'],
                rawOpenTime=cycle.get('open_time'),openTime=cycle.get('open_time'),closeTime=cycle.get('close_time'),
                grossPnl=cycle['gross']*vp,netPnl=net,netPnlSource='derived_C',feeKnown=fee_known,
                net_price_units=cycle['net_price_units'] if vp==1 else None,
                legs=copy.deepcopy(cycle['legs']),entry_legs=copy.deepcopy(cycle['entry_legs']),
                oneR=rr['oneR'],oneRSource=rr['oneRSource'],rMultiple=rr['rMultiple'],
                exclude_from_sqn=rr['exclude_from_sqn'],flags=flags)


def _prepare_fifo_fees(fills, fee_currency, account_currency, fee_fx_rate):
    prepared=[]; flags=[]
    for raw in fills:
        original=copy.deepcopy(raw)
        item=copy.deepcopy(raw)
        if isinstance(item,dict):
            currency=item.get('feeCurrency',item.get('fee_currency',fee_currency))
            fee=item.get('fee')
        else:
            item=list(item); currency=fee_currency; fee=item[3] if len(item)>3 else None
        if currency and currency!=account_currency and fee is not None:
            rate=to_dec(fee_fx_rate)
            if rate is None or rate<=0:
                converted=None
                if 'fee_unconverted' not in flags: flags.append('fee_unconverted')
            elif to_dec(fee) is None:
                converted=fee  # Keep invalid input for fifo validation; never turn corruption into zero.
            else:
                converted=to_dec(fee)*rate
                if 'fee_fx_converted' not in flags: flags.append('fee_fx_converted')
            if isinstance(item,dict):
                item['fee']=converted; item['rawFill']=original
            else:
                while len(item)<4: item.append(None)
                item[3]=converted
        prepared.append(item)
    return prepared,flags


COLUMN_ALIASES = {
    'openTime':('open time','time','thời gian','date(utc)','utc_time','trade time','ngày gd','ngày khớp','date'),
    'closeTime':('close time','time close','thời gian đóng'),
    'symbol':('symbol','item','instrument','pair','market','contract','mã ck','mã gd','ticker'),
    'direction':('type','direction','action','side','position side','loại lệnh','mua/bán'),
    'volume':('volume','size','lots','executed','quantity','qty','filled','kl khớp','khối lượng'),
    'entryPrice':('open price','price','entry price','avg entry','giá mua','giá vào'),
    'exitPrice':('close price','exit price','avg close price','giá bán','giá ra'),
    'grossPnl':('profit','realized profit','realized pnl','realizedpnl','gross pnl'),
    'netPnl':('net p&l','net pnl','lãi/lỗ ròng'),
    'commission':('commission','commissions','hoa hồng'), 'swap':('swap','funding','funding fee'),
    'fee':('fee','fees','trading fee'), 'tax':('tax','thuế'),
    'feeCurrency':('fee currency','commission asset'), 'slPrice':('s/l','sl','stop loss'),
    'tpPrice':('t/p','tp','take profit'), 'externalTicketId':('ticket','position','order','order id','trade id','id'),
    'amount':('amount','cash flow','cashflow','số tiền'),
}


def map_columns(headers, source_profile='generic'):
    """Vị trí số nguyên giữ được Time/Price lặp tên trong MT4/5."""
    names = [re.sub(r'\s+',' ',str(h).strip().casefold()) for h in headers]
    mapping = {}
    for field_name, aliases in COLUMN_ALIASES.items():
        positions = [i for i,h in enumerate(names) if h in aliases]
        if positions:
            mapping[field_name] = positions[0]
    for label,opening,closing in (('time','openTime','closeTime'),('price','entryPrice','exitPrice')):
        positions = [i for i,h in enumerate(names) if h==label]
        if len(positions)>1:
            mapping[opening],mapping[closing] = positions[0],positions[-1]
    return mapping


def detect_header(rows, source_profile='generic'):
    best = None
    for index,row in enumerate(rows):
        mapped = map_columns(row,source_profile)
        score = len(mapped)
        if {'direction','openTime'}.issubset(mapped) and (('symbol' in mapped) or ('amount' in mapped)):
            if best is None or score>best[0]:
                best = (score,index,mapped)
    return dict(status='ok',row=best[1],mapping=best[2]) if best else dict(status='error',reason='header_not_found')


class _TableReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows,self.row,self.cell = [],None,None
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.row=[]
        if tag in ('td','th') and self.row is not None: self.cell=[]
    def handle_data(self,data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.row is not None and self.cell is not None:
            self.row.append(''.join(self.cell).strip()); self.cell=None
        if tag=='tr' and self.row:
            self.rows.append(self.row); self.row=None


def read_import_rows(data):
    """CSV/HTML/sequence hoặc XLSX raw XML, không dùng formatted cell.w; không thực thi nội dung file."""
    if isinstance(data,Path):
        if data.suffix.lower()=='.xlsx':
            import zipfile, xml.etree.ElementTree as ET
            ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            with zipfile.ZipFile(data) as archive:
                if sum(i.file_size for i in archive.infolist())>100_000_000:
                    raise ValueError('xlsx_uncompressed_size_exceeded')
                shared=[]
                if 'xl/sharedStrings.xml' in archive.namelist():
                    tree=ET.fromstring(archive.read('xl/sharedStrings.xml'))
                    shared=[''.join(n.itertext()) for n in tree.findall('m:si',ns)]
                # Standard first worksheet; multi-sheet reports must choose a sheet outside this reference adapter.
                paths=sorted(n for n in archive.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',n))
                if not paths: raise ValueError('xlsx_no_worksheet')
                rows=[]
                for row in ET.fromstring(archive.read(paths[0])).findall('.//m:row',ns):
                    values=[]
                    for cell in row.findall('m:c',ns):
                        letters=re.match(r'[A-Z]+',cell.attrib.get('r','A1'))[0]
                        index=0
                        for ch in letters: index=index*26+ord(ch)-64
                        while len(values)<index: values.append(None)
                        node=cell.find('m:v',ns)
                        raw=node.text if node is not None else None
                        typ=cell.attrib.get('t','n')
                        if typ=='s' and raw is not None: value=shared[int(raw)]
                        elif typ=='inlineStr': value=''.join(cell.find('m:is',ns).itertext())
                        elif typ=='b': value=(raw=='1')
                        elif raw is not None and typ=='n': value=D(raw)
                        else: value=raw
                        values[index-1]=value
                    rows.append(values)
                return rows
        data=data.read_text(encoding='utf-8-sig')
    if isinstance(data,str):
        if re.search(r'<(?:table|tr)\b',data,re.I):
            reader=_TableReader(); reader.feed(data); return reader.rows
        sample=data[:8192]
        try: dialect=csv.Sniffer().sniff(sample,delimiters=',;\t|')
        except csv.Error:
            delimiter=max(',;\t|',key=lambda ch:sum(line.count(ch) for line in sample.splitlines()))
            return list(csv.reader(io.StringIO(data),delimiter=delimiter))
        return list(csv.reader(io.StringIO(data),dialect))
    rows=list(data)
    if rows and isinstance(rows[0],dict):
        headers=list(rows[0]); return [headers]+[[r.get(k) for k in headers] for r in rows]
    return rows


def import_pipeline(data, account=None, db_records=None, source='generic', source_profile='generic',
                    source_type='mt4_mt5', import_batch_id='preview', level=None, vpoint=None,
                    decimal_choices=None, locale_hint='.', date_order='YMD', fold=None,
                    commit=False, allow_short=True, fee_fx_rate=None, batch_journal=None, db_cashflows=None,
                    price_unit='full', confirm_fifo_order=False):
    """B4: mặc định Preview thuần; chỉ commit sau xác nhận cột mơ hồ và toàn bộ bản ghi hợp lệ."""
    try:
        profile=account if isinstance(account,AccountProfile) else AccountProfile(**(account or {'id':'default'}))
        rows=read_import_rows(data)
    except (ValueError,TypeError,OSError,KeyError) as exc:
        return dict(status='error',reason=str(exc),committed=False)
    header=detect_header(rows,source_profile)
    if header['status']!='ok': return dict(header,committed=False)
    if price_unit not in ('full','thousand'):
        return dict(status='error',reason='invalid_price_unit',committed=False)
    mapping=header['mapping']; body=rows[header['row']+1:]
    decisions={}; warnings_=[]; records=[]; cashflows=[]; skipped=0; rejected=[]; groups={}
    numeric={'volume','entryPrice','exitPrice','grossPnl','netPnl','commission','swap','fee','tax','slPrice','tpPrice','amount'}
    choices=decimal_choices or {}
    for name,index in mapping.items():
        if name not in numeric: continue
        values=[r[index] if index<len(r) else None for r in body]
        if name=='volume': values=[str(v).split('/')[0] if isinstance(v,str) else v for v in values]
        sep,ambiguous=column_decimal_sep(values,locale_hint)
        ambiguous=ambiguous and any(isinstance(v,str) and re.search(r'[.,]',v) for v in values)
        if name in choices:
            if choices[name] not in ('.',','): return dict(status='error',reason='invalid_decimal_choice',committed=False)
            sep,ambiguous=choices[name],False
        decisions[name]=dict(separator=sep,ambiguous=bool(ambiguous))
    for offset,row in enumerate(body,header['row']+2):
        if not any(v is not None and str(v).strip() for v in row): continue
        def get(name):
            idx=mapping.get(name)
            return row[idx] if idx is not None and idx<len(row) else None
        direction=map_direction(get('direction'),source_profile)
        if direction['status']=='skip_non_trade': skipped+=1; continue
        if direction['status'] not in ('ok','cashflow'):
            rejected.append(dict(row=offset,reason=direction.get('why','invalid_direction'))); continue
        parsed={}; invalid=[]
        for name in numeric & mapping.keys():
            raw=get(name)
            if name=='volume' and isinstance(raw,str): raw=raw.split('/')[0]
            value,reason=parse_number_with_reason(raw,decisions[name]['separator'])
            parsed[name]=value
            if reason and reason!='empty': invalid.append(name)
        if invalid:
            rejected.append(dict(row=offset,reason='invalid_numeric_fields',fields=invalid)); continue
        raw_time=get('openTime'); ct=canonical_raw_time(raw_time,date_order)
        tm=source_to_utc(raw_time,profile.serverTimeZone,date_order,fold)
        if ct is None or tm['status'] in ('needs_confirm','error'):
            rejected.append(dict(row=offset,reason=tm['reason'])); continue
        if direction['status']=='cashflow':
            amount=parsed.get('amount',parsed.get('netPnl',parsed.get('grossPnl')))
            if amount is None:
                rejected.append(dict(row=offset,reason='missing_cashflow_amount')); continue
            kind=direction['kind']
            if kind=='withdrawal': amount=-abs(amount)
            elif kind=='deposit': amount=abs(amount)
            elif kind=='balance': kind='adjustment'
            key=hashlib.sha256(f'{source}|{profile.id}|{raw_time}|{kind}|{amount}'.encode()).hexdigest()
            cashflows.append(dataclasses.asdict(CashFlow(key,profile.id,tm['iso'],amount,kind,import_batch_id,
                                                       profile.baseCurrency,ct['date_only'],str(raw_time))))
            continue
        symbol=get('symbol')
        if not isinstance(symbol,str) or not symbol.strip():
            rejected.append(dict(row=offset,reason='missing_symbol')); continue
        cl=classify(symbol)
        if cl['status'] in ('unknown','needs_confirm'):
            rejected.append(dict(row=offset,reason='instrument_needs_confirm',detail=cl)); continue
        if price_unit=='thousand':
            if cl['cls']!='stock_vn':
                rejected.append(dict(row=offset,reason='thousand_price_unit_only_for_vn_stock')); continue
            for name in ('entryPrice','exitPrice','slPrice','tpPrice'):
                if parsed.get(name) is not None: parsed[name]*=1000
        elif cl['cls']=='stock_vn' and parsed.get('entryPrice') is not None and parsed['entryPrice']<500:
            warnings_.append('vn_price_unit_may_need_confirmation_no_auto_scale')
        if parsed.get('volume') is None or parsed['volume']<=0 or parsed.get('entryPrice') is None or parsed['entryPrice']<=0:
            rejected.append(dict(row=offset,reason='missing_positive_price_or_volume')); continue
        chosen=level or ('A' if parsed.get('grossPnl') is not None or parsed.get('netPnl') is not None else 'B' if parsed.get('exitPrice') is not None else 'C')
        vp=to_dec(vpoint)
        if vp is None:
            sp=spec_for(cl)
            if sp['quote']==profile.baseCurrency: vp=sp['csize']
            elif sp['quote'] in STABLE and profile.baseCurrency=='USD': vp=sp['csize']; warnings_.append('stablecoin_usd_peg_assumed')
        if chosen=='C':
            if vp is None:
                rejected.append(dict(row=offset,reason='missing_vpoint')); continue
            group=groups.setdefault(cl['symbol'],dict(vpoint=vp,fills=[]))
            group['fills'].append(dict(side=direction['direction'],qty=parsed['volume'],price=parsed['entryPrice'],
                                       fee=parsed.get('fee'),feeCurrency=get('feeCurrency'),sl=parsed.get('slPrice'),
                                       time=tm['iso'] or str(raw_time),rawTime=str(raw_time),dateOnly=ct['date_only'],rawRow=copy.deepcopy(row)))
            continue
        kwargs={k:parsed.get(k) for k in ('commission','swap','fee','tax')}
        if parsed.get('netPnl') is not None:
            pnl=dict(status='ok',grossPnl=parsed.get('grossPnl'),netPnl=parsed['netPnl'],feeKnown=True,netPnlSource='file',flags=[])
        else:
            pnl=compute_net_pnl(chosen,gross_pnl=parsed.get('grossPnl'),entry_price=parsed['entryPrice'],exit_price=parsed.get('exitPrice'),
                                volume=parsed['volume'],direction=direction['direction'],vpoint_exit=vp,source_type=source_type,
                                fee_currency=get('feeCurrency'),account_currency=profile.baseCurrency,fee_fx_rate=fee_fx_rate,**kwargs)
        if pnl['status']!='ok': rejected.append(dict(row=offset,reason=pnl.get('why'))); continue
        close_raw=get('closeTime'); close=source_to_utc(close_raw,profile.serverTimeZone,date_order,fold) if close_raw else None
        if close and close['status'] in ('needs_confirm','error'):
            rejected.append(dict(row=offset,reason=close['reason'])); continue
        # Implied multiplier only for a single closed round-trip with known gross, not FIFO cycles.
        implied=resolve_vpoint(pnl.get('grossPnl'),parsed['entryPrice'],parsed.get('exitPrice'),parsed['volume'],vp)
        rr=compute_r_multiple(pnl['netPnl'],entry=parsed['entryPrice'],sl=parsed.get('slPrice'),volume=parsed['volume'],
                              vpoint=implied.get('vpoint'),direction=direction['direction'],fallback_config=profile.fallback1R,
                              equity_before_entry=None)  # current capital is not historical equity; no guessed replay.
        ticket=get('externalTicketId')
        fp=import_fingerprint(source,profile.id,str(raw_time),cl['symbol'],direction['direction'],parsed['volume'],parsed['entryPrice'],ticket,date_order)
        rec=dict(id=fp,accountId=profile.id,currency=profile.baseCurrency,importFingerprint=fp,occurrenceIndex=0,
                 externalTicketId=str(ticket) if ticket is not None else None,symbol=cl['symbol'],rawSymbol=symbol,market=cl['cls'],
                 direction=direction['direction'],volume=parsed['volume'],entryPrice=parsed['entryPrice'],exitPrice=parsed.get('exitPrice'),
                 rawOpenTime=str(raw_time),openTime=tm['iso'],closeTime=close['iso'] if close else None,dateOnly=ct['date_only'],
                 slPrice=parsed.get('slPrice'),tpPrice=parsed.get('tpPrice'),slMayBeModified=source_type=='mt4_mt5' and parsed.get('slPrice') is not None,
                 status='closed' if parsed.get('exitPrice') is not None or close else 'open',isSimulation=False,importBatchId=import_batch_id,
                 oneR=rr['oneR'],oneRSource=rr['oneRSource'],rMultiple=rr['rMultiple'],exclude_from_sqn=rr['exclude_from_sqn'],
                 flags=pnl.get('flags',[])+rr.get('flags',[])+tm['flags'],userEditedFields=[],disciplineTags=[],autoTags=[],isReviewed=False,
                 **kwargs,**{k:pnl[k] for k in ('grossPnl','netPnl','netPnlSource','feeKnown')})
        if implied.get('flag'): rec['flags'].append(implied['flag'])
        rec['flags']=audit_trade_record(rec)
        records.append(rec)
    for symbol,group in groups.items():
        if any(fill['dateOnly'] for fill in group['fills']):
            warnings_.append('fifo_intraday_order_unknown')
            if not confirm_fifo_order:
                rejected.append(dict(reason='fifo_order_confirmation_required',symbol=symbol))
                continue
        else:
            group['fills'].sort(key=lambda fill:source_to_utc(fill['time'])['utc'])
        result=compute_net_pnl('C',fills=group['fills'],vpoint_exit=group['vpoint'],allow_short=allow_short,
                               account_id=profile.id,symbol=symbol,account_currency=profile.baseCurrency,fee_fx_rate=fee_fx_rate)
        warnings_.extend(result['flags'])
        for rec in result['trades']:
            if rec['status']=='orphan_sell': skipped+=1; continue
            raw=rec['rawOpenTime']
            rec['importFingerprint']=import_fingerprint(source,profile.id,raw,symbol,rec['direction'],rec['entryQty'],rec['entryPrice'])
            rec['rawOpenTime']=next((f['rawTime'] for f in group['fills'] if (f['time']==raw)),raw)
            # Fingerprint must use the original clock text, even if UTC differs.
            rec['importFingerprint']=import_fingerprint(source,profile.id,rec['rawOpenTime'],symbol,rec['direction'],rec['entryQty'],rec['entryPrice'],date_order=date_order)
            rec['dateOnly']=bool(canonical_raw_time(rec['rawOpenTime'],date_order)['date_only'])
            rec['importBatchId']=import_batch_id; rec['isSimulation']=False
            rec['flags']=audit_trade_record(rec)
            records.append(rec)
    working=copy.deepcopy(db_records or [])
    report=upsert_multiset_batch(working,records,import_batch_id)
    ambiguous=any(d['ambiguous'] for d in decisions.values())
    status='needs_confirm' if ambiguous or rejected else 'ok'
    committed=False
    cash_working=copy.deepcopy(db_cashflows or [])
    counts={}
    for flow in cash_working:
        key=flow.get('importFingerprint',flow['id'])
        counts[key]=counts.get(key,0)+1
    seen={}; cash_new=0
    for flow in cashflows:
        key=flow['id']; occurrence=seen.get(key,0); seen[key]=occurrence+1
        flow['importFingerprint']=key; flow['occurrenceIndex']=occurrence
        flow['id']=hashlib.sha256(f'{key}|{occurrence}'.encode()).hexdigest()
        if occurrence>=counts.get(key,0): cash_working.append(copy.deepcopy(flow)); cash_new+=1
    if cashflows:
        report['undo'].update(cash_before=copy.deepcopy(db_cashflows or []),cash_after=copy.deepcopy(cash_working))
        if commit and db_cashflows is None:
            status='needs_confirm'; warnings_.append('cashflow_store_required_for_atomic_commit')
    if commit and status=='ok' and db_records is not None:
        db_records[:]=working; committed=True
        if db_cashflows is not None: db_cashflows[:]=cash_working
        if batch_journal is not None: batch_journal[import_batch_id]=report['undo']
    return dict(status=status,committed=committed,header=header,numberDecisions=decisions,
                preview=dict(NEW=report['new_count'],ENRICH=report['update_count'],SKIP=report['skip_count'],
                             cashflow=len(cashflows),cashflow_NEW=cash_new,ignored=skipped,rejected=len(rejected)),
                trades=records,cashflows=cashflows,rejected=rejected,warnings=warnings_,undo=report['undo'],
                reason='preview_requires_confirmation' if status=='needs_confirm' else None)


def _group_day_samples(samples):
    groups={}
    for sample in samples:
        if not isinstance(sample,dict) or not sample.get('day'):
            return dict(status='error',reason='day_keys_required',warnings=['day_bootstrap_requires_day_key'])
        try: normalized=_normalize_samples([sample])
        except (ValueError,TypeError,KeyError,IndexError): return dict(status='error',reason='invalid_day_sample')
        if len(normalized)!=1:
            return dict(status='error',reason='invalid_day_sample')
        groups.setdefault(str(sample['day']),[]).append(normalized[0])
    if not groups: return dict(status='empty',reason='khong co mau R')
    return dict(status='ok',groups=list(groups.values()))


def simulate_funded_phase(rs, pop, cumw, preset: PropPresetV3, risk_pct=1.0, trades_per_day=1,
                          sample_mode='empirical', fee_drag_R=0.0, bound='optimistic',
                          mfe_extra_R=0.5, day_cap=250, day_samples=None, daily_returns=None,
                          payout_fraction=1, payout_cap=None):
    """B8: mô hình cấu hình tổng quát, không chứng nhận quy tắc hiện hành của quỹ (§12.5)."""
    B0=to_dec(preset.capital); fraction=to_dec(payout_fraction); risk=to_dec(risk_pct)
    cap_amount=to_dec(payout_cap)
    if B0 is None or B0<=0 or risk is None or risk<=0 or fraction is None or not 0<fraction<=1:
        return dict(status='error',reason='invalid_funded_input')
    if not isinstance(day_cap,int) or day_cap<1 or not isinstance(trades_per_day,int) or trades_per_day<1:
        return dict(status='error',reason='invalid_simulation_count')
    if preset.payout_cycle_days<1 or preset.max_loss.after_first_payout not in AFTER_PAYOUT:
        return dict(status='error',reason='invalid_payout_configuration')
    if daily_returns is None and not pop:
        return dict(status='empty',reason='khong co mau R')
    mx=preset.max_loss; loss=B0*D(mx.pct)/100
    if loss<=0 or loss>=B0 or not 0<=D(preset.profit_split)<=1 or D(preset.min_payout)<0:
        return dict(status='error',reason='invalid_preset_amount')
    if cap_amount is not None and cap_amount<=0:
        return dict(status='error',reason='invalid_payout_cap')
    B=peak=B0; floor=B0-loss; locked=False; payout_done=False
    payouts=[]; path=[]; window=[]; since=0; reason=None
    def floor_value():
        candidate=B0-loss if mx.type=='STATIC' else peak-loss
        return min(candidate,B0+D(mx.lock_offset_amount)) if mx.lock_at_initial and mx.type!='STATIC' else candidate
    scripted=list(daily_returns) if daily_returns is not None else None
    for day in range(min(day_cap,len(scripted)) if scripted is not None else day_cap):
        start=B
        daily_floor=None
        if preset.daily_loss.enabled:
            pct=D(preset.daily_loss.pct)/100
            daily_floor=start*(1-pct) if preset.daily_loss.calculation_mode==DL_MAXPREV else start-B0*pct
        if scripted is not None:
            amount=to_dec(scripted[day])
            if amount is None: return dict(status='error',reason='invalid_daily_return')
            # Explicit deterministic cash-P&L path is also the independent-test seam.
            observations=[(amount,None,None)]
        else:
            picked=rs.choice(day_samples) if day_samples else [pop[i] for i in rs.choices(range(len(pop)),cum_weights=cumw,k=trades_per_day)]
            observations=[]
            for r,fk,mae,mfe in picked:
                rate=D(r-(fee_drag_R if sample_mode=='parametric' or not fk else 0))
                unit=B0*risk/100
                observations.append((rate*unit,D(mae)*unit if mae is not None else None,
                                     D(mfe)*unit if mfe is not None else (rate+D(mfe_extra_R))*unit if bound=='pessimistic' and rate>0 else None))
        for pnl,mae,mfe in observations:
            after=B+pnl; low=min(B,after,B+mae if mae is not None else B)
            high=max(B,after,B+mfe if mfe is not None else B)
            if mx.type=='INTRADAY_TRAILING' and not locked and bound=='pessimistic':
                peak=max(peak,high); floor=max(floor,floor_value())
            if low<=floor or daily_floor is not None and low<=daily_floor:
                reason='max_loss' if low<=floor else 'daily_loss'; B=after; break
            if mx.type=='INTRADAY_TRAILING' and not locked:
                peak=max(peak,high); floor=max(floor,floor_value())
                if after<=floor: reason='max_loss'; B=after; break
            B=after
        if reason:
            path.append(dict(day=day+1,balance=B,floor=floor,event=reason)); break
        if mx.type=='EOD_TRAILING' and not locked:
            peak=max(peak,B); floor=max(floor,floor_value())
        window.append(B-start); since+=1
        consistency=preset.consistency
        eligible=True
        if consistency and consistency.enabled and 'funded' in consistency.applies_to:
            check=check_consistency_rule(window,0,consistency.max_day_share,consistency.behavior)
            eligible=check['passed'] and not check['breached']
        available=max(Decimal(0),B-B0)
        gross=available*fraction
        if cap_amount is not None: gross=min(gross,cap_amount)
        if since>=preset.payout_cycle_days and gross>0 and gross>=D(preset.min_payout) and eligible:
            B-=gross
            payouts.append(dict(day=day+1,gross=gross,net=gross*D(preset.profit_split)))
            if not payout_done:
                behavior=mx.after_first_payout
                if behavior=='LOCK_AT_INITIAL': floor=B0; locked=True
                elif behavior=='LOCK_AT_BUFFER': floor=B0+D(mx.lock_offset_amount); locked=True
                elif behavior=='FULL_RESET': peak=B0; floor=B0-loss; locked=False
                # KEEP_FLOOR: no change, the existing trailing definition continues.
                payout_done=True
            window=[]; since=0
            if B<=floor:
                reason='post_payout_floor_reached'
        path.append(dict(day=day+1,balance=B,floor=floor,event='payout' if payouts and payouts[-1]['day']==day+1 else 'trade'))
        if reason: break
    gross_total=sum((p['gross'] for p in payouts),Decimal(0))
    return dict(status='ok',survived=reason is None,reason=reason,balance=B,floor=floor,
                gross_payout=gross_total,net_payout=gross_total*D(preset.profit_split),payouts=payouts,path=path,
                warnings=check_preset(preset)+['generic_payout_model_verify_contract_before_use'])


def prop_full_lifecycle(samples,preset: PropPresetV3,funded_preset=None,risk_pct=1.0,trades_per_day=1,
                        b_outer=20,m_inner=50,resample='bayesian',seed=0,day_cap=250,
                        funded_day_cap=250,fee_drag_R=0.0,payout_fraction=1,payout_cap=None):
    """Cùng world latent cho evaluation + funded; mean payout vô điều kiện theo mỗi lần thi (§12.5)."""
    if resample not in ('bayesian','efron','none','day'):
        return dict(status='error',reason='unsupported_lifecycle_resample')
    if any(not isinstance(v,int) or isinstance(v,bool) or v<1 for v in (b_outer,m_inner,day_cap,funded_day_cap,trades_per_day)):
        return dict(status='error',reason='invalid_simulation_count')
    if not _finite_float(risk_pct) or risk_pct<=0:
        return dict(status='error',reason='invalid_risk_pct')
    samples=list(samples)
    try: pop0=_normalize_samples(samples)
    except (ValueError,TypeError,KeyError,IndexError): return dict(status='error',reason='invalid_R_sample')
    if not pop0: return dict(status='empty',reason='khong co mau R')
    if any(phase.profit_target_pct is None for phase in preset.phases):
        return dict(status='error',reason='phase_khong_co_muc_tieu')
    grouping=_group_day_samples(samples) if resample=='day' else None
    if grouping and grouping['status']!='ok': return grouping
    funded_preset=funded_preset or preset
    worlds=1 if resample=='none' else b_outer
    total=worlds*m_inner; funded_count=0; payout_sum=Decimal(0); net_sum=Decimal(0)
    funnel=[0]*len(preset.phases); world_ps=[]; errors=[]
    for b in range(worlds):
        rs=random.Random(seed*1_000_003+b); groups=None
        if resample=='bayesian': pop=pop0; weights=[rs.expovariate(1) for _ in pop]
        elif resample=='efron': pop=[rs.choice(pop0) for _ in pop0]; weights=[1.0]*len(pop)
        elif resample=='day':
            groups=[rs.choice(grouping['groups']) for _ in grouping['groups']]
            pop=[s for g in groups for s in g]; weights=[1.0]*len(pop)
        else: pop=pop0; weights=[1.0]*len(pop)
        cumw=list(accumulate(weights)); world_wins=0
        for _ in range(m_inner):
            passed=True
            for idx,phase in enumerate(preset.phases):
                result=simulate_path(rs,pop,cumw,phase,preset,risk_pct,trades_per_day,
                                     fee_drag_R=fee_drag_R,day_cap=day_cap,day_samples=groups)
                if isinstance(result,dict): return result
                if result!=1: passed=False; break
                funnel[idx]+=1
            if not passed: continue
            funded_count+=1; world_wins+=1
            funded=simulate_funded_phase(rs,pop,cumw,funded_preset,risk_pct,trades_per_day,
                         fee_drag_R=fee_drag_R,day_cap=funded_day_cap,day_samples=groups,
                         payout_fraction=payout_fraction,payout_cap=payout_cap)
            if funded['status']!='ok': errors.append(funded); continue
            payout_sum+=funded['gross_payout']; net_sum+=funded['net_payout']
        world_ps.append(world_wins/m_inner)
    if errors: return dict(status='error',reason='funded_simulation_error',errors=errors)
    funded_prob=funded_count/total; mean=payout_sum/total
    economics=prop_ev_roi(funded_prob,mean,funded_preset.profit_split,preset.fees.challenge_fee,
                           preset.fees.activation_fee,preset.fees.refund_on_funded)
    return dict(status='ok',p_funded=funded_prob,mean_gross_payout=mean,mean_net_payout=net_sum/total,
                payout_mean_scope='unconditional_per_attempt',attempts=total,funded_count=funded_count,
                phase_pass_counts=funnel,ps=world_ps,ev_attempt=economics['ev_attempt'],roi_pct=economics['roi_pct'],
                fees=dataclasses.asdict(preset.fees),small_sample_warning=len(pop0)<30,
                warnings=check_preset(preset)+check_preset(funded_preset))
