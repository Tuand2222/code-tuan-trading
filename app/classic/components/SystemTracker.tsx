"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeNumericInput, selectNumericInput } from "./numeric-input";

type TrackerTrade = {
  id: string;
  date: string;
  risk: number;
  pnl: number;
  discipline: number;
};

type YearStats = {
  year: number;
  hasData: boolean;
  total: number;
  net: number;
  winRate: number;
  avgGainR: number;
  avgLossR: number;
  winLossRatio: number;
  returnPercent: number;
  profitFactor: number;
  expectedR: number;
  top15Share: number;
  bottomR: number;
  paretoRatio: number;
  maxDrawdownPercent: number;
  recoveryFactor: number;
  discipline: number;
};

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const RANGE_STORAGE_KEY = "tuan-trader-system-range-v1";
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function normalizeYear(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(value)));
}

function EditableYearField({ label, ariaLabel, value, onCommit }: { label: string; ariaLabel: string; value: number; onCommit: (value: number) => void }) {
  return (
    <label className="year-input">
      <span>{label}</span>
      <input key={value} aria-label={ariaLabel} type="number" min={MIN_YEAR} max={MAX_YEAR} step="1" defaultValue={value} onFocus={selectNumericInput} onChange={(event) => { event.currentTarget.value = normalizeNumericInput(event.currentTarget.value); }} onBlur={(event) => { const parsed = Number(event.currentTarget.value); if (!Number.isFinite(parsed) || !event.currentTarget.value.trim()) event.currentTarget.value = String(value); else onCommit(parsed); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
    </label>
  );
}

function compactCash(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)} tỷ`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)} tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute)}`;
}

function calculateYear(year: number, trades: TrackerTrade[], capital: number): YearStats {
  const source = trades
    .filter((trade) => Number(trade.date.slice(0, 4)) === year)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (!source.length) {
    return { year, hasData: false, total: 0, net: 0, winRate: 0, avgGainR: 0, avgLossR: 0, winLossRatio: 0, returnPercent: 0, profitFactor: 0, expectedR: 0, top15Share: 0, bottomR: 0, paretoRatio: 0, maxDrawdownPercent: 0, recoveryFactor: 0, discipline: 0 };
  }

  const wins = source.filter((trade) => trade.pnl > 0);
  const losses = source.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const net = grossProfit - grossLoss;
  const winnerRs = wins.map((trade) => trade.risk ? trade.pnl / trade.risk : 0);
  const loserRs = losses.map((trade) => trade.risk ? trade.pnl / trade.risk : 0);
  const avgGainR = winnerRs.length ? winnerRs.reduce((sum, value) => sum + value, 0) / winnerRs.length : 0;
  const avgLossR = loserRs.length ? loserRs.reduce((sum, value) => sum + value, 0) / loserRs.length : 0;
  const allRs = source.map((trade) => trade.risk ? trade.pnl / trade.risk : 0).sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(source.length * .15));
  const topRs = allRs.slice(0, topCount);
  const bottomRs = allRs.slice(topCount);
  const topTrades = [...source].sort((a, b) => b.pnl - a.pnl).slice(0, topCount);
  const topProfit = topTrades.reduce((sum, trade) => sum + Math.max(0, trade.pnl), 0);
  const topNetR = topRs.reduce((sum, value) => sum + value, 0);
  const bottomNetR = bottomRs.reduce((sum, value) => sum + value, 0);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of source) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return {
    year,
    hasData: true,
    total: source.length,
    net,
    winRate: wins.length / source.length * 100,
    avgGainR,
    avgLossR,
    winLossRatio: avgLossR ? Math.abs(avgGainR / avgLossR) : 0,
    returnPercent: capital ? net / capital * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    expectedR: allRs.reduce((sum, value) => sum + value, 0) / source.length,
    top15Share: grossProfit ? topProfit / grossProfit * 100 : 0,
    bottomR: bottomRs.length ? bottomNetR / bottomRs.length : 0,
    paretoRatio: bottomNetR ? Math.abs(topNetR / bottomNetR) : 0,
    maxDrawdownPercent: capital ? maxDrawdown / capital * 100 : 0,
    recoveryFactor: maxDrawdown ? net / maxDrawdown : 0,
    discipline: source.reduce((sum, trade) => sum + trade.discipline, 0) / source.length,
  };
}

const METRICS: Array<{
  key: keyof YearStats;
  label: string;
  hint: string;
  format: (value: number) => string;
  highlight?: boolean;
}> = [
  { key: "winRate", label: "Win rate", hint: "Tỷ lệ giao dịch có lợi nhuận.", format: (value) => `${value.toFixed(1)}%` },
  { key: "total", label: "Trading frequency", hint: "Tổng số giao dịch trong năm.", format: (value) => `${Math.round(value)}` },
  { key: "avgGainR", label: "Average gain", hint: "Lợi nhuận R trung bình của các lệnh thắng.", format: (value) => `+${value.toFixed(2)}R` },
  { key: "avgLossR", label: "Average loss", hint: "Mức lỗ R trung bình của các lệnh thua.", format: (value) => `${value.toFixed(2)}R` },
  { key: "winLossRatio", label: "Win / Loss size", hint: "Tỷ lệ độ lớn lệnh thắng trung bình so với lệnh thua.", format: (value) => `${value.toFixed(2)}x` },
  { key: "returnPercent", label: "Return on reference capital", hint: "Lợi nhuận ròng chia cho vốn tham chiếu.", format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` },
  { key: "profitFactor", label: "Profit Factor", hint: "Tổng lãi chia tổng lỗ tuyệt đối.", format: (value) => value >= 99 ? "∞" : value.toFixed(2), highlight: true },
  { key: "expectedR", label: "Expected value / trade", hint: "Kỳ vọng R trung bình trên mỗi giao dịch.", format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}R` },
  { key: "top15Share", label: "% gross profit from top 15%", hint: "Tỷ trọng tổng lãi đến từ 15% lệnh tốt nhất.", format: (value) => `${value.toFixed(1)}%` },
  { key: "bottomR", label: "Average R of bottom 85%", hint: "R trung bình của phần còn lại sau khi loại 15% lệnh tốt nhất.", format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}R` },
  { key: "paretoRatio", label: "Pareto ratio 15 / 85", hint: "Tỷ lệ đóng góp R của 15% lệnh tốt nhất so với 85% còn lại.", format: (value) => value.toFixed(2), highlight: true },
  { key: "maxDrawdownPercent", label: "Maximum drawdown", hint: "Sụt giảm lớn nhất so với vốn tham chiếu.", format: (value) => `−${value.toFixed(2)}%` },
  { key: "recoveryFactor", label: "Recovery factor", hint: "Lợi nhuận ròng chia cho sụt giảm tối đa.", format: (value) => value.toFixed(2) },
  { key: "discipline", label: "Discipline score", hint: "Điểm tuân thủ checklist trung bình.", format: (value) => `${value.toFixed(0)}%` },
];

export default function SystemTracker({ trades, onOpenJournal }: { trades: TrackerTrade[]; onOpenJournal: () => void }) {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + 9);
  const [capitalInput, setCapitalInput] = useState("200000000");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const capital = Math.max(10_000_000, Number(capitalInput) || 10_000_000);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(RANGE_STORAGE_KEY);
        if (stored) {
          const saved = JSON.parse(stored) as { startYear?: number; endYear?: number; capital?: number };
          const nextStart = normalizeYear(Number(saved.startYear), currentYear);
          const nextEnd = normalizeYear(Number(saved.endYear), currentYear + 9);
          setStartYear(Math.min(nextStart, nextEnd));
          setEndYear(Math.max(nextStart, nextEnd));
          if (Number(saved.capital) >= 10_000_000) setCapitalInput(String(saved.capital));
        }
      } catch { /* keep the default range */ }
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentYear]);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify({ startYear, endYear, capital }));
    } catch { /* local preferences are optional */ }
  }, [startYear, endYear, capital, preferencesReady]);

  const changeStartYear = (value: number) => {
    const next = normalizeYear(value, startYear);
    setStartYear(next);
    if (next > endYear) setEndYear(next);
  };
  const changeEndYear = (value: number) => {
    const next = normalizeYear(value, endYear);
    setEndYear(next);
    if (next < startYear) setStartYear(next);
  };

  const years = useMemo(() => Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index), [startYear, endYear]);
  const annual = useMemo(() => years.map((year) => calculateYear(year, trades, capital)), [years, trades, capital]);
  const yearsWithData = annual.filter((item) => item.hasData);
  const focus = annual.find((item) => item.year === currentYear) ?? annual[0];
  const average = (key: keyof YearStats) => {
    if (!yearsWithData.length) return 0;
    return yearsWithData.reduce((sum, item) => sum + Number(item[key]), 0) / yearsWithData.length;
  };
  const maxNet = Math.max(...annual.map((item) => Math.abs(item.net)), 1);

  return (
    <div className="system-shell">
      <section className="system-hero">
        <div>
          <span className="system-kicker"><i /> PERFORMANCE ARCHIVE · {startYear} → {endYear}</span>
          <h2>Hồ sơ hệ thống giao dịch theo năm</h2>
          <p>Chọn bất kỳ khoảng năm nào; bảng sẽ tự tổng hợp dữ liệu tương ứng từ Nhật ký.</p>
        </div>
        <div className="system-controls">
          <label><span>Vốn tham chiếu</span><input type="number" min="10000000" step="10000000" value={capitalInput} onFocus={selectNumericInput} onChange={(event) => setCapitalInput(normalizeNumericInput(event.target.value))} onBlur={() => setCapitalInput(String(capital))} /></label>
          <EditableYearField label="Năm bắt đầu" ariaLabel="Năm bắt đầu thống kê" value={startYear} onCommit={changeStartYear} />
          <EditableYearField label="Năm kết thúc" ariaLabel="Năm kết thúc thống kê" value={endYear} onCommit={changeEndYear} />
          <button onClick={onOpenJournal}>Mở Nhật ký →</button>
        </div>
      </section>

      <section className="system-summary">
        <article><span>Năm tiêu điểm</span><strong>{focus?.year}</strong><small className={focus?.year === currentYear ? "live" : ""}>{focus?.year === currentYear && <i />}{focus?.year === currentYear ? "Đang cập nhật" : "Theo khoảng đã chọn"}</small></article>
        <article><span>Giao dịch đã ghi</span><strong>{focus?.total ?? 0}</strong><small>Tự đồng bộ từ journal</small></article>
        <article><span>Win rate</span><strong>{focus?.hasData ? `${focus.winRate.toFixed(1)}%` : "—"}</strong><small>Năm {focus?.year}</small></article>
        <article><span>Profit Factor</span><strong className="gold-text">{focus?.hasData ? focus.profitFactor >= 99 ? "∞" : focus.profitFactor.toFixed(2) : "—"}</strong><small>Gross profit / gross loss</small></article>
        <article><span>Kỳ vọng</span><strong className={(focus?.expectedR ?? 0) >= 0 ? "positive-text" : "negative-text"}>{focus?.hasData ? `${focus.expectedR >= 0 ? "+" : ""}${focus.expectedR.toFixed(2)}R` : "—"}</strong><small>Mỗi giao dịch</small></article>
        <article><span>Lợi nhuận ròng</span><strong className={(focus?.net ?? 0) >= 0 ? "positive-text" : "negative-text"}>{focus?.hasData ? compactCash(focus.net) : "—"}</strong><small>Vốn: {VND.format(capital)}</small></article>
      </section>

      <section className="system-panel system-trend-panel">
        <div className="system-panel-head"><div><span>YEARLY PULSE</span><h3>Nhịp hiệu suất dài hạn</h3></div><div className="system-legend"><span><i className="up" /> Lãi</span><span><i className="down" /> Lỗ</span><span><i className="empty" /> Chờ dữ liệu</span></div></div>
        <div className="system-year-bars">
          {annual.map((item) => <div key={item.year} className={item.hasData ? "has-data" : "future"}><span>{item.hasData ? compactCash(item.net) : "—"}</span><div><i className={item.net >= 0 ? "up" : "down"} style={{ height: item.hasData ? `${Math.max(12, Math.abs(item.net) / maxNet * 100)}%` : "8%" }} /></div><strong>{item.year}</strong><small>{item.hasData ? `${item.total} lệnh` : "Future"}</small></div>)}
        </div>
      </section>

      <section className="system-panel system-table-panel">
        <div className="system-panel-head"><div><span>ANNUAL SYSTEM SCORECARD</span><h3>Bảng thống kê hệ thống</h3></div><small>{yearsWithData.length} / {years.length} năm có dữ liệu</small></div>
        <div className="system-table-wrap">
          <table className="system-table">
            <thead><tr><th>Chỉ số</th>{annual.map((item) => <th key={item.year} className={item.year === currentYear ? "current" : ""}>{item.year}{item.year === currentYear && <small>NOW</small>}</th>)}<th className="average">Avg.</th></tr></thead>
            <tbody>{METRICS.map((metric) => <tr key={metric.key} className={metric.highlight ? "highlight" : ""}><th title={metric.hint}>{metric.label}<i>i</i></th>{annual.map((item) => <td key={item.year} className={`${item.year === currentYear ? "current" : ""} ${item.hasData && Number(item[metric.key]) < 0 ? "negative" : ""}`}>{item.hasData ? metric.format(Number(item[metric.key])) : "—"}</td>)}<td className="average">{yearsWithData.length ? metric.format(average(metric.key)) : "—"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="system-footnote"><span>PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS</span><small>Các chỉ số tương lai sẽ được tự động điền khi giao dịch mới được thêm hoặc đồng bộ vào Nhật ký. Dữ liệu hiện tại chỉ phản ánh lệnh đã ghi nhận.</small></div>
      </section>
    </div>
  );
}
