"use client";
import { useEffect, useMemo, useState } from "react";
import {
  riskDesk,
  positionSize,
  netPnl,
  followed,
  type RiskSettings,
} from "../../../lib/risk-analytics";
import type { ReportTrade } from "../../../lib/governance-report";
type Props = {
  trades: ReportTrade[];
  allTrades: ReportTrade[];
  settings: RiskSettings;
  setSettings: (s: RiskSettings) => void;
  mode: "overview" | "risk" | "analytics";
  ready: boolean;
  onDay: (date: string) => void;
  onJournal: () => void;
  onEndSession: () => void;
  onNewTrade: (plan?: {
    entry: number;
    stop: number;
    target: number;
    quantity: number;
    risk: number;
    side: "Buy" | "Sell";
  }) => void;
};
const f = (n: number | null | undefined, d = 2) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: d }).format(n);
const tierNames: Record<string, string> = {
  unknown: "Chưa cấu hình vốn",
  normal: "Tầng 1 · Bình thường",
  defensive: "Tầng 2 · Phòng thủ",
  stop: "Tầng 3 · Dừng kế hoạch mới",
};
export default function UnifiedRiskAnalyticsCockpit({
  trades,
  ready,
  allTrades,
  settings,
  setSettings,
  mode,
  onDay,
  onJournal,
  onEndSession,
  onNewTrade,
}: Props) {
  const model = useMemo(() => riskDesk(trades, settings), [trades, settings]);
  // The protection model always sees the whole account, independent of performance filters.
  const protection = useMemo(
    () => riskDesk(allTrades, settings),
    [allTrades, settings],
  );
  useEffect(() => {
    if (protection.observedTier === "stop" && !settings.disciplineLock)
      setSettings({ ...settings, disciplineLock: true });
  }, [protection.observedTier, settings.disciplineLock]);
  const [axis, setAxis] = useState<"trade" | "date">("trade");
  const [month, setMonth] = useState(
    () =>
      model.days.at(-1)?.date.slice(0, 7) ??
      new Date().toISOString().slice(0, 7),
  );
  const latestMonth = allTrades
    .map((t) => t.date)
    .sort()
    .at(-1)
    ?.slice(0, 7);
  useEffect(() => {
    if (latestMonth) setMonth(latestMonth);
  }, [latestMonth]);
  const [entry, setEntry] = useState(""),
    [stop, setStop] = useState(""),
    [target, setTarget] = useState("");
  const [multiplier, setMultiplier] = useState("1"),
    [fee, setFee] = useState("0"),
    [step, setStep] = useState("1");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [strategy, setStrategy] = useState("");
  const exposures = settings.exposures ?? [];
  const setExposures = (value: NonNullable<RiskSettings["exposures"]>) =>
    setSettings({ ...settings, exposures: value });
  const [group, setGroup] = useState(""),
    [exposure, setExposure] = useState(""),
    [side, setSide] = useState("Buy");
  const sized = positionSize(
    protection.riskBudget,
    Number(entry),
    Number(stop),
    Number(multiplier),
    Number(fee),
    Number(step),
    Number(target),
  );
  const setNumber = (key: keyof RiskSettings, value: string) =>
    setSettings({ ...settings, [key]: Math.max(0, Number(value)) });
  const sumGroup =
    exposures
      .filter((e) => e.group === group && e.side === side)
      .reduce((s, e) => s + e.risk, 0) + (Number(exposure) || 0);
  const recoveryValid =
    settings.recoveryReview.trim().length >= 20 &&
    settings.recoveryPlan.trim().length >= 20;
  const allowed =
    protection.tier === "normal" || protection.tier === "defensive";
  const gate =
    allowed &&
    Object.values(checks).filter(Boolean).length === 4 &&
    (protection.tier !== "defensive" ||
      protection.allowedStrategies.includes(strategy));
  const curve = model.curve;
  const xs = curve.map((p, i) => (axis === "trade" ? i : Date.parse(p.date)));
  const x = (i: number) =>
    40 +
    ((xs[i] - (xs[0] ?? 0)) / ((xs.at(-1) ?? 0) - (xs[0] ?? 0) || 1)) * 900;
  const balances = curve.flatMap((p) => [
    p.balance,
    p.hypothetical,
    p.sma20 ?? p.balance,
  ]);
  const min = Math.min(settings.initialCapital, ...balances),
    max = Math.max(settings.initialCapital, ...balances);
  const y = (v: number) => 165 - ((v - min) / (max - min || 1)) * 135;
  const points = (key: "balance" | "hypothetical" | "sma20") =>
    curve
      .flatMap((p, i) => (p[key] === null ? [] : [`${x(i)},${y(p[key]!)}`]))
      .join(" ");
  const ddMax = Math.max(1, ...curve.map((p) => p.drawdown));
  const fields: [keyof RiskSettings, string, number][] = [
    ["initialCapital", "Vốn đầu kỳ (VNĐ)", 0],
    ["riskPercent", "Rủi ro mỗi lệnh (%)", 0.1],
    ["dailyLossPercent", "Giới hạn lỗ ngày (%)", 0.1],
    ["defensivePercent", "Bắt đầu phòng thủ DD (%)", 0.1],
    ["stopPercent", "Dừng kế hoạch ở DD (%)", 0.1],
    ["maxDrawdownPercent", "Khoảng sàn DD (%)", 0.1],
  ];
  const monthDate = new Date(month + "-01T12:00:00");
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  return (
    <fieldset
      disabled={!ready}
      className="risk-cockpit"
      data-mode={mode}
      data-colors={settings.colorMode}
    >
      <section className="cockpit-heading">
        <div>
          <span className="eyebrow">
            {mode === "analytics" ? "PHÂN TÍCH ĐỊNH LƯỢNG" : "COMMAND CENTER"}
          </span>
          <h2>
            {mode === "risk"
              ? "Bảo vệ vốn trước phiên"
              : mode === "analytics"
                ? "Hiệu suất và chất lượng thực thi"
                : "Buồng lái giao dịch"}
          </h2>
          <p>
            Cùng một nguồn tính Net, R, vốn và báo cáo.{" "}
            {model.excludedFills > 0
              ? `${model.excludedFills} execution chưa ghép được tách khỏi thống kê lệnh đóng.`
              : "P&L sau phí và swap."}
          </p>
        </div>
        <button className="gold-button compact" onClick={onEndSession}>
          Kết thúc phiên · Nhận báo cáo
        </button>
      </section>
      <section className="cockpit-kpis" aria-label="Sáu chỉ số cốt lõi">
        {[
          [
            "Net lệnh đóng",
            model.financialComplete
              ? f(model.net, 0) + " ₫"
              : "Chưa đủ phí/P&L",
            `${model.n} lệnh đã đóng`,
          ],
          ["Tỷ lệ thắng", f(model.winRate) + "%", `${model.n} lệnh`],
          [
            "Profit Factor",
            model.noLoss ? "∞" : f(model.profitFactor),
            "Theo Net sau phí",
          ],
          [
            "Expectancy",
            f(model.expectancyR) + " R",
            `${model.rN}/${model.n} lệnh có 1R`,
          ],
          ["SQN", f(model.sqn), model.sqnLabel],
          [
            "Max Drawdown",
            f(model.maxDD, 0) + " ₫",
            settings.initialCapital
              ? f(model.maxDDPercent) + "% từ đỉnh"
              : "Cần vốn để tính %",
          ],
        ].map(([label, value, hint]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>
      <section
        className={`risk-budget ${protection.level}`}
        aria-label="Ngân sách rủi ro toàn tài khoản"
      >
        <div>
          <strong>{tierNames[protection.tier]}</strong>
          <span>
            {protection.usage === null
              ? "Cần cấu hình vốn"
              : `Đã dùng ${f(protection.usage, 1)}% hạn mức ngày`}{" "}
            · {protection.today}
          </span>
        </div>
        <progress
          max="100"
          value={Math.min(100, protection.usage ?? 0)}
          aria-label="Hạn mức lỗ ngày đã dùng"
        />
        <div className="risk-budget-facts">
          <span>
            Còn lại{" "}
            <b>
              {settings.initialCapital
                ? f(protection.remaining, 0) + " ₫"
                : "—"}
            </b>
          </span>
          <span>
            Khoảng cách tới sàn{" "}
            <b>
              {settings.initialCapital ? f(protection.buffer, 0) + " ₫" : "—"}
            </b>
          </span>
          <span>
            Ngân sách/lệnh{" "}
            <b>
              {settings.initialCapital
                ? f(protection.riskBudget, 0) + " ₫"
                : "—"}
            </b>
          </span>
          <span>Còn {protection.remainingLosses} lệnh thua tối đa</span>
        </div>
        <small>
          {!protection.dataComplete
            ? "Có execution thiếu P&L hoặc tỷ giá phí; chưa thể xác nhận hạn mức. "
            : ""}
          {settings.unrealized === null
            ? "Chưa có P&L đang mở: trạng thái chỉ dựa trên vốn đã thực hiện."
            : "Đã cộng P&L đang mở do bạn cung cấp."}{" "}
          Bảo vệ vốn luôn dùng toàn bộ tài khoản.
        </small>
        {(protection.usage ?? 0) >= 70 && (
          <p role="alert">
            {(protection.usage ?? 0) >= 90
              ? "Nguy cấp"
              : (protection.usage ?? 0) >= 80
                ? "Nguy hiểm"
                : "Cảnh báo"}
            : thu hẹp rủi ro; kiểm tra hạn mức trước kế hoạch tiếp theo.
          </p>
        )}
      </section>
      <details
        className="cockpit-settings"
        open={mode === "risk" || !settings.initialCapital}
      >
        <summary>Thiết lập vốn & hạn mức</summary>
        <p>
          Nhập vốn đầu kỳ ứng với toàn bộ lịch sử đang lưu. Nạp/rút vốn cần được
          điều chỉnh trước khi dùng hạn mức; các giá trị này không thay thế quy
          định của broker/quỹ.
        </p>
        <div className="cockpit-form">
          {fields.map(([key, label, min]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                step="any"
                value={String(settings[key])}
                onChange={(e) => setNumber(key, e.target.value)}
              />
            </label>
          ))}
          <label>
            Loại tài khoản
            <select
              value={settings.accountMode}
              onChange={(e) => {
                const prop = e.target.value === "prop";
                setSettings({
                  ...settings,
                  accountMode: prop ? "prop" : "personal",
                  dailyLossPercent: prop ? 1.5 : 3,
                  defensivePercent: prop ? 2 : 5,
                  stopPercent: prop ? 5 : 15,
                  maxDrawdownPercent: prop ? 10 : 20,
                });
              }}
            >
              <option value="personal">Cá nhân</option>
              <option value="prop">Quỹ · mẫu hạn mức cần kiểm tra</option>
            </select>
          </label>
          <label>
            Cách tính sàn
            <select
              value={settings.floorMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  floorMode: e.target.value as RiskSettings["floorMode"],
                })
              }
            >
              <option value="static">Cố định từ vốn đầu kỳ</option>
              <option value="trailing">Trailing từ đỉnh vốn</option>
            </select>
          </label>
          <label>
            P&L đang mở (VNĐ, để trống nếu thiếu)
            <input
              type="number"
              step="any"
              value={settings.unrealized ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  unrealized:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Đỉnh vốn có xác nhận (VNĐ)
            <input
              type="number"
              min="0"
              value={settings.highWaterMark ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  highWaterMark:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Múi giờ
            <select
              value={settings.timezone}
              onChange={(e) =>
                setSettings({ ...settings, timezone: e.target.value })
              }
            >
              <option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">New York</option>
            </select>
          </label>
          <label>
            Màu số liệu
            <select
              value={settings.colorMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  colorMode: e.target.value as RiskSettings["colorMode"],
                })
              }
            >
              <option value="standard">Xanh / Đỏ</option>
              <option value="accessible">Xanh dương / Cam</option>
            </select>
          </label>
        </div>
      </details>
      {mode === "risk" && (
        <>
          <section className="cockpit-panel">
            <h3>Máy tính khối lượng & checklist trước lệnh</h3>
            <div className="cockpit-form">
              {[
                [entry, setEntry, "Giá vào"],
                [stop, setStop, "Giá cắt lỗ"],
                [target, setTarget, "Giá mục tiêu"],
                [multiplier, setMultiplier, "Hệ số hợp đồng / tỷ giá về VNĐ"],
                [fee, setFee, "Phí dự kiến mỗi đơn vị (VNĐ)"],
                [step, setStep, "Bước khối lượng"],
              ].map(([value, setValue, label]) => (
                <label key={String(label)}>
                  {String(label)}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={String(value)}
                    onChange={(e) =>
                      (setValue as (s: string) => void)(e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <div className="sizing-result">
              <strong>
                {sized
                  ? `${sized.side === "Buy" ? "Mua" : "Bán"} · ${f(sized.quantity, 8)} đơn vị`
                  : "Nhập Entry, SL và bước khối lượng"}
              </strong>
              <span>
                Rủi ro {f(sized?.actualRisk, 0)} ₫ · R:R {f(sized?.plannedR)}
              </span>
            </div>
            <label>
              Phương pháp
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="">Chọn phương pháp</option>
                {protection.allowedStrategies.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {[
              "Đúng điều kiện setup và phiên",
              "Dừng lỗ có hiệu lực, không nới SL",
              "Không FOMO / gỡ lỗ",
              "Đã kiểm tra tin và phơi nhiễm tương quan",
            ].map((label, i) => (
              <label className="cockpit-check" key={label}>
                <input
                  type="checkbox"
                  checked={!!checks[i]}
                  onChange={(e) =>
                    setChecks({ ...checks, [i]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
            {protection.tier === "defensive" && (
              <p className="risk-warning">
                Ngân sách đã giảm 50%; chỉ dùng 2 phương pháp đứng đầu trong dữ
                liệu, với số mẫu hiển thị ở phân tích.
              </p>
            )}
            <button
              className="gold-button compact"
              disabled={!gate || !sized}
              onClick={() => {
                if (sized)
                  onNewTrade({
                    entry: Number(entry),
                    stop: Number(stop),
                    target: Number(target),
                    quantity: sized.quantity,
                    risk: sized.actualRisk,
                    side: sized.side as "Buy" | "Sell",
                  });
              }}
            >
              Đã kiểm tra · Mở hồ sơ giao dịch
            </button>
            <p>
              Đây là cổng kiểm tra kế hoạch trong nhật ký. Bạn luôn có thể ghi
              nhận giao dịch đã xảy ra bằng “Thêm lệnh”.
            </p>
          </section>
          {protection.tier === "stop" && (
            <section className="cockpit-panel risk-warning">
              <h3>Rà soát chuỗi thua & kế hoạch phục hồi</h3>
              <button
                className="gold-button compact"
                disabled={
                  !recoveryValid ||
                  protection.observedTier === "stop" ||
                  protection.observedTier === "unknown"
                }
                onClick={() =>
                  setSettings({ ...settings, disciplineLock: false })
                }
              >
                Xác nhận rà soát · Mở lại kế hoạch
              </button>
              <label>
                Nguyên nhân / bằng chứng
                <textarea
                  value={settings.recoveryReview}
                  onChange={(e) =>
                    setSettings({ ...settings, recoveryReview: e.target.value })
                  }
                />
              </label>
              <label>
                Kế hoạch phục hồi / điều kiện quay lại
                <textarea
                  value={settings.recoveryPlan}
                  onChange={(e) =>
                    setSettings({ ...settings, recoveryPlan: e.target.value })
                  }
                />
              </label>
              <p>
                {recoveryValid
                  ? "Đã lưu bản rà soát. Cổng kế hoạch mở lại khi vốn/hạn mức trở về vùng cho phép."
                  : "Mỗi phần cần ít nhất 20 ký tự để có nội dung rà soát."}
              </p>
            </section>
          )}
          <section className="cockpit-panel">
            <h3>Phơi nhiễm tương quan do bạn khai báo</h3>
            <div className="cockpit-form">
              <label>
                Nhóm tài sản
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="Ví dụ Crypto Long"
                />
              </label>
              <label>
                Chiều
                <select value={side} onChange={(e) => setSide(e.target.value)}>
                  <option>Buy</option>
                  <option>Sell</option>
                </select>
              </label>
              <label>
                Rủi ro vị thế mới (VNĐ)
                <input
                  type="number"
                  min="0"
                  value={exposure}
                  onChange={(e) => setExposure(e.target.value)}
                />
              </label>
            </div>
            <p>
              Tổng nhóm/chiều: {f(sumGroup, 0)} ₫ ·{" "}
              {protection.equity > 0
                ? f((100 * sumGroup) / protection.equity) + "%"
                : "Cần vốn"}
            </p>
            {protection.equity > 0 && sumGroup / protection.equity >= 0.03 && (
              <p role="alert" className="risk-warning">
                Nhóm tương quan đạt trần cảnh báo 3% tài khoản.
              </p>
            )}
            <button
              className="ghost-button"
              disabled={!group || Number(exposure) <= 0}
              onClick={() => {
                setExposures([
                  ...exposures,
                  {
                    id: crypto.randomUUID(),
                    group,
                    side,
                    risk: Number(exposure),
                  },
                ]);
                setExposure("");
              }}
            >
              Thêm phơi nhiễm đang mở
            </button>
            {exposures.map((e) => (
              <p key={e.id}>
                {e.group} · {e.side} · {f(e.risk, 0)} ₫{" "}
                <button
                  onClick={() =>
                    setExposures(exposures.filter((x) => x.id !== e.id))
                  }
                >
                  Đóng vị thế
                </button>
              </p>
            ))}
            <small>
              Danh sách tạm tính trong phiên này, không có dữ liệu giá trực
              tiếp. Không suy tương quan từ tên mã.
            </small>
          </section>
        </>
      )}
      {mode !== "risk" && (
        <section className="cockpit-panel cockpit-chart">
          <header>
            <div>
              <h3>Đường vốn & sụt giảm</h3>
              <small>
                Vốn thực hiện · SMA20 · giả định chỉ giữ lệnh tuân thủ
              </small>
            </div>
            <label>
              Trục X
              <select
                value={axis}
                onChange={(e) => setAxis(e.target.value as typeof axis)}
              >
                <option value="trade">Số thứ tự lệnh</option>
                <option value="date">Thời gian</option>
              </select>
            </label>
          </header>
          {curve.length ? (
            <>
              <svg
                viewBox="0 0 980 210"
                role="img"
                aria-label="Vốn thực hiện, trung bình 20 lệnh và vốn giả định"
              >
                <line x1="40" x2="940" y1="165" y2="165" stroke="#334155" />
                <polyline
                  points={points("hypothetical")}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
                <polyline
                  points={points("sma20")}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                />
                <polyline
                  points={points("balance")}
                  fill="none"
                  stroke="var(--profit)"
                  strokeWidth="2.5"
                />
                {curve.map((p, i) => (
                  <circle
                    key={p.id}
                    cx={x(i)}
                    cy={y(p.balance)}
                    r="4"
                    fill="var(--profit)"
                    role="button"
                    tabIndex={0}
                    aria-label={`Lọc ngày ${p.date}`}
                    onClick={() => onDay(p.date)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onDay(p.date);
                    }}
                  >
                    <title>{`${p.date}: ${f(p.balance, 0)} ₫`}</title>
                  </circle>
                ))}
                <text x="40" y="195">
                  {axis === "trade" ? "Lệnh 1" : curve[0].date}
                </text>
                <text x="830" y="195">
                  {axis === "trade"
                    ? `Lệnh ${curve.length}`
                    : curve.at(-1)?.date}
                </text>
              </svg>
              <div className="underwater-label">
                Sụt giảm từ đỉnh · VNĐ (trục riêng)
              </div>
              <svg
                viewBox="0 0 980 100"
                role="img"
                aria-label="Biểu đồ sụt giảm vốn theo tiền"
              >
                <polyline
                  points={curve
                    .map((p, i) => `${x(i)},${10 + (p.drawdown / ddMax) * 65}`)
                    .join(" ")}
                  fill="none"
                  stroke="var(--loss)"
                  strokeWidth="2"
                />
                <text x="40" y="95">
                  0 → −{f(model.maxDD, 0)} ₫
                </text>
              </svg>
              {curve.at(-1)?.sma20 != null &&
                curve.at(-1)!.balance < curve.at(-1)!.sma20! && (
                  <p className="risk-warning">
                    Vốn thực hiện dưới SMA20. Đây là tín hiệu hậu kiểm, không
                    phải dự báo thị trường.
                  </p>
                )}
            </>
          ) : (
            <p>Chưa có lệnh đã đóng để vẽ đường vốn.</p>
          )}
        </section>
      )}
      {mode === "overview" && (
        <>
          <section className="cockpit-panel calendar-panel">
            <header>
              <h3>Lịch Net P&L</h3>
              <input
                aria-label="Tháng lịch P&L"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </header>
            <div className="cockpit-calendar">
              {Array.from({ length: (monthDate.getDay() + 6) % 7 }, (_, i) => (
                <span key={"pad" + i} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = month + "-" + String(i + 1).padStart(2, "0"),
                  d = model.days.find((x) => x.date === date);
                return (
                  <button
                    key={date}
                    className={d ? (d.net >= 0 ? "positive" : "negative") : ""}
                    onClick={() => onDay(date)}
                    aria-label={`Ngày ${date}, ${d?.n ?? 0} lệnh`}
                  >
                    <b>{i + 1}</b>
                    <strong>{d ? f(d.net, 0) : "—"}</strong>
                    <small>
                      {d
                        ? `${d.n} lệnh · ${f((100 * d.wins) / d.n, 0)}% thắng`
                        : ""}
                    </small>
                    {d &&
                      settings.initialCapital > 0 &&
                      -d.net >=
                        (settings.initialCapital * settings.dailyLossPercent) /
                          100 && <em>Vượt hạn mức</em>}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="cockpit-panel recent-panel">
            <header>
              <h3>10 giao dịch gần nhất</h3>
              <button className="ghost-button" onClick={onJournal}>
                Mở nhật ký
              </button>
            </header>
            <div className="cockpit-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Sản phẩm</th>
                    <th>Setup</th>
                    <th>Net (₫)</th>
                    <th>R</th>
                    <th>Quy tắc</th>
                  </tr>
                </thead>
                <tbody>
                  {model.trades
                    .slice(-10)
                    .reverse()
                    .map((t) => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td className="ticker">{t.symbol}</td>
                        <td>{t.setup}</td>
                        <td
                          className={
                            netPnl(t) < 0 ? "negative-text" : "positive-text"
                          }
                        >
                          {f(netPnl(t), 0)}
                        </td>
                        <td>
                          {t.risk > 0 && t.riskKnown !== false
                            ? f(netPnl(t) / t.risk)
                            : "—"}
                        </td>
                        <td>{followed(t) ? "Tuân thủ" : "Cần review"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {mode === "analytics" && (
        <>
          <section className="cockpit-kpis">
            {[
              [
                "Sharpe theo R/lệnh",
                f(model.sharpe),
                "Rf = 0 · không thường niên hóa",
              ],
              [
                "Sortino theo R/lệnh",
                f(model.sortino),
                "MAR = 0 · downside RMS",
              ],
              [
                "MAE trung bình",
                f(model.mae),
                `${model.excursionN}/${model.n} hồ sơ có cả MAE/MFE`,
              ],
              ["MFE trung bình", f(model.mfe), "Không suy từ giá đóng lệnh"],
              [
                "What-if tuân thủ",
                f(model.hypotheticalNet, 0) + " ₫",
                "Giả định hậu kiểm, giữ nguyên lệnh còn lại",
              ],
              [
                "Số mẫu R",
                `${model.rN}/${model.n}`,
                "SQN dùng sample SD; cap N=100",
              ],
            ].map(([label, value, hint]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </section>
          {model.rN < 20 && (
            <p className="risk-warning">
              Mẫu R dưới 20 lệnh: chỉ số mang tính mô tả, chưa đủ cơ sở để kết
              luận lợi thế.
            </p>
          )}
          <div className="cockpit-matrices">
            {[
              ["Phương pháp", model.strategies],
              ["Sản phẩm", model.symbols],
              ["Phiên", model.sessions],
              ["Tuân thủ / vi phạm", model.compliance],
            ].map(([title, raw]) => (
              <section className="cockpit-panel" key={String(title)}>
                <h3>{String(title)}</h3>
                <div className="cockpit-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhóm</th>
                        <th>N</th>
                        <th>Net (₫)</th>
                        <th>Thắng (%)</th>
                        <th>Giữ (phút)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(raw as typeof model.strategies).map((g) => (
                        <tr key={g.label}>
                          <td>{g.label}</td>
                          <td>{g.n}</td>
                          <td>{f(g.net, 0)}</td>
                          <td>{f(g.winRate, 1)}</td>
                          <td>{f(g.meanDuration, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
          <section className="cockpit-panel">
            <h3>Cảnh báo thực thi cần đối chiếu</h3>
            <ul>
              {model.trades
                .filter(
                  (t) =>
                    t.riskKnown !== false && t.risk > 0 && netPnl(t) < -t.risk,
                )
                .map((t) => (
                  <li key={t.id}>
                    {t.date} · {t.symbol}: lỗ sau phí {f(netPnl(t) / t.risk)}R.
                    Kiểm tra trượt giá, phí và lịch sử SL; chưa đủ dữ kiện để
                    kết luận đã nới SL.
                  </li>
                ))}
            </ul>
            <p>
              SQN = √min(N,100) × mean(R) / SD mẫu(R). Sharpe và Sortino ở đây
              là tỷ lệ trên R mỗi lệnh, không phải lợi suất ngày hay chỉ số
              thường niên.
            </p>
          </section>
        </>
      )}
    </fieldset>
  );
}
