"use client";

import { useEffect, useMemo, useState } from "react";
import { useLedger } from './LedgerContext';
import { classicYear } from '../../lib/trading/selectors/classic';
import { normalizeNumericInput, selectNumericInput } from "./numeric-input";

type YearStats = ReturnType<typeof classicYear>;
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
  { key: "profitFactor", label: "Profit Factor", hint: "Tổng lãi chia tổng lỗ tuyệt đối.", format: (value) => value === Infinity ? "∞" : value.toFixed(2), highlight: true },
  { key: "expectedR", label: "Expected value / trade", hint: "Kỳ vọng R trung bình trên mỗi giao dịch.", format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}R` },
  { key: "top15Share", label: "% gross profit from top 15%", hint: "Tỷ trọng tổng lãi đến từ 15% lệnh tốt nhất.", format: (value) => `${value.toFixed(1)}%` },
  { key: "bottomR", label: "Average R of bottom 85%", hint: "R trung bình của phần còn lại sau khi loại 15% lệnh tốt nhất.", format: (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}R` },
  { key: "paretoRatio", label: "Pareto ratio 15 / 85", hint: "Tỷ lệ đóng góp R của 15% lệnh tốt nhất so với 85% còn lại.", format: (value) => value.toFixed(2), highlight: true },
  { key: "maxDrawdownPercent", label: "Maximum drawdown", hint: "Sụt giảm lớn nhất so với vốn tham chiếu.", format: (value) => `−${value.toFixed(2)}%` },
  { key: "recoveryFactor", label: "Recovery factor", hint: "Lợi nhuận ròng chia cho sụt giảm tối đa.", format: (value) => value.toFixed(2) },
  { key: "discipline", label: "Discipline score", hint: "Điểm tuân thủ checklist trung bình.", format: (value) => `${value.toFixed(0)}%` },
];

export default function SystemTracker({ onOpenJournal }: { onOpenJournal: () => void }) {
  const {derived,filters}=useLedger();
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
  const annual = useMemo(() => years.map((year) => classicYear(year, derived!.result, filters, capital)), [years, derived, filters, capital]);
  const yearsWithData = annual.filter((item) => item.hasData);
  const focus = annual.find((item) => item.year === currentYear) ?? annual[0];
  const average = (key: keyof YearStats) => {
    const values=yearsWithData.map(item=>item[key]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
    return values.length?values.reduce((s,v)=>s+v,0)/values.length:null;
  };
  const formatted=(metric:typeof METRICS[number],value:unknown)=>typeof value==='number'?metric.format(value):'—';
  const maxNet = Math.max(...annual.map(item=>Math.abs(item.net??0)),1);

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
        <article><span>Win rate</span><strong>{focus?.winRate!=null ? `${focus.winRate.toFixed(1)}%` : "—"}</strong><small>Năm {focus?.year}</small></article>
        <article><span>Profit Factor</span><strong className="gold-text">{focus?.profitFactor!=null ? focus.profitFactor === Infinity ? "∞" : focus.profitFactor.toFixed(2) : "—"}</strong><small>Gross profit / gross loss</small></article>
        <article><span>Kỳ vọng</span><strong className={(focus?.expectedR ?? 0) >= 0 ? "positive-text" : "negative-text"}>{focus?.expectedR!=null ? `${focus.expectedR >= 0 ? "+" : ""}${focus.expectedR.toFixed(2)}R` : "—"}</strong><small>R: {focus?.riskCount}/{focus?.total} lệnh · Review: {focus?.reviewedCount}/{focus?.total}</small></article>
        <article><span>Lợi nhuận ròng</span><strong className={(focus?.net ?? 0) >= 0 ? "positive-text" : "negative-text"}>{focus?.net!=null ? compactCash(focus.net) : "—"}</strong><small>Vốn: {VND.format(capital)}</small></article>
      </section>

      <section className="system-panel system-trend-panel">
        <div className="system-panel-head"><div><span>YEARLY PULSE</span><h3>Nhịp hiệu suất dài hạn</h3></div><div className="system-legend"><span><i className="up" /> Lãi</span><span><i className="down" /> Lỗ</span><span><i className="empty" /> Chờ dữ liệu</span></div></div>
        <div className="system-year-bars">
          {annual.map((item) => <div key={item.year} className={item.hasData ? "has-data" : "future"}><span>{item.hasData ? item.net===null?"—":compactCash(item.net) : "—"}</span><div><i className={(item.net??0) >= 0 ? "up" : "down"} style={{ height: item.hasData ? `${Math.max(12, Math.abs(item.net??0) / maxNet * 100)}%` : "8%" }} /></div><strong>{item.year}</strong><small>{item.hasData ? `${item.total} lệnh` : "Future"}</small></div>)}
        </div>
      </section>

      <section className="system-panel system-table-panel">
        <div className="system-panel-head"><div><span>ANNUAL SYSTEM SCORECARD</span><h3>Bảng thống kê hệ thống</h3></div><small>{yearsWithData.length} / {years.length} năm có dữ liệu</small></div>
        <div className="system-table-wrap">
          <table className="system-table">
            <thead><tr><th>Chỉ số</th>{annual.map((item) => <th key={item.year} className={item.year === currentYear ? "current" : ""}>{item.year}{item.year === currentYear && <small>NOW</small>}</th>)}<th className="average">Avg.</th></tr></thead>
            <tbody>{METRICS.map((metric) => <tr key={metric.key} className={metric.highlight ? "highlight" : ""}><th title={metric.hint}>{metric.label}<i>i</i></th>{annual.map((item) => <td key={item.year} className={`${item.year === currentYear ? "current" : ""} ${item.hasData && Number(item[metric.key]) < 0 ? "negative" : ""}`}>{item.hasData ? formatted(metric,item[metric.key]) : "—"}</td>)}<td className="average">{yearsWithData.length ? formatted(metric,average(metric.key)) : "—"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="system-footnote"><span>PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS</span><small>R chỉ tính trên lệnh có rủi ro hợp lệ; kỷ luật chỉ tính lệnh đã review. Avg. chỉ lấy các năm có giá trị hữu hạn. Các chỉ số tương lai sẽ được tự động điền khi giao dịch mới được thêm hoặc đồng bộ vào Nhật ký. Dữ liệu hiện tại chỉ phản ánh lệnh đã ghi nhận.</small></div>
      </section>
    </div>
  );
}
