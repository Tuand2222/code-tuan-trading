"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import EquityTimeChart, { type EquityChartPoint, type EquityReferenceLine } from "./EquityTimeChart";
import { normalizeNumericInput, selectNumericInput } from "./numeric-input";

import {buildMetrixReport} from '../../../lib/classic-analysis';
import type {RiskTrade,RiskSettings} from '../../../lib/risk-analytics';
type MetrixTrade = RiskTrade;

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function cash(value: number) {
  return VND.format(Math.round(value));
}

function compactCash(value: number | null) {
 if(value===null)return "Chưa đủ dữ liệu";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)} tỷ`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)} tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute)}`;
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function positivePercent(value: string, fallback: number) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

function ObjectiveCard({
  label,
  value,
  detail,
  progress,
  state,
  usage = false,
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  state: "passed" | "safe" | "warning" | "failed" | "pending";
  usage?: boolean;
}) {
  const stateText = state === "passed" ? "Hoàn thành" : state === "safe" ? "An toàn" : state === "warning" ? "Cần chú ý" : state === "failed" ? "Vi phạm" : "Đang thực hiện";
  return (
    <article className={`metrix-objective ${state}`}>
      <div className="metrix-objective-head">
        <span>{label}</span>
        <i aria-label={stateText}>{state === "passed" || state === "safe" ? "✓" : state === "failed" ? "!" : "•"}</i>
      </div>
      <strong>{value}</strong>
      <div className="metrix-progress"><b style={{ width: `${clamp(progress)}%` }} /></div>
      <div className="metrix-objective-foot"><small>{detail}</small><em>{usage ? `${clamp(progress).toFixed(0)}% đã dùng` : stateText}</em></div>
    </article>
  );
}

export default function TradingMetrix({trades,settings,onSettings}:{trades:MetrixTrade[];settings:RiskSettings;onSettings:(s:RiskSettings)=>void}) {
 const [initialCapitalInput,setInitialCapitalInput]=useState(String(settings.initialCapital));
 const [profitTargetInput,setProfitTargetInput]=useState("10");
 const [maxDailyLossInput,setMaxDailyLossInput]=useState(String(settings.dailyLossPercent));
 const [maxLossInput,setMaxLossInput]=useState(String(settings.maxDrawdownPercent));
 const [dailyPage,setDailyPage]=useState(0);
 useEffect(()=>{setInitialCapitalInput(String(settings.initialCapital));setMaxDailyLossInput(String(settings.dailyLossPercent));setMaxLossInput(String(settings.maxDrawdownPercent));},[settings.initialCapital,settings.dailyLossPercent,settings.maxDrawdownPercent]);
 const initialCapital=settings.initialCapital;
 const rules={target:positivePercent(profitTargetInput,10),daily:settings.dailyLossPercent,maximum:settings.maxDrawdownPercent};
 const report=useMemo(()=>buildMetrixReport(trades,settings),[trades,settings]);
 const ready=report.ready;
  const targetAmount = initialCapital * rules.target / 100;
  const profitProgress = targetAmount ? report.net / targetAmount * 100 : 0;
  const dailyUsage = report.dailyLimitAmount ? report.worstDailyDrawdown / report.dailyLimitAmount * 100 : 0;
  const maximumUsage = report.maximumAmount ? report.maxLossUsed / report.maximumAmount * 100 : 0;
  const winRate = report.ordered.length ? report.wins.length / report.ordered.length * 100 : 0;
  const returnPercent = initialCapital ? report.net / initialCapital * 100 : 0;
  const sourceCount = new Set(report.ordered.map((trade) => trade.source ?? "Thủ công")).size;
  const firstDate = report.ordered.at(0)?.date;
  const lastDate = report.ordered.at(-1)?.date;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(report.rows.length / pageSize));
  const safePage = Math.min(dailyPage, pageCount - 1);
  const pageRows = [...report.rows].reverse().slice(safePage * pageSize, (safePage + 1) * pageSize);

  const equityPoints = useMemo(() => report.rows.filter(row=>row.complete&&report.complete&&report.capitalReady).map<EquityChartPoint>((row) => ({
    date: row.date,
    money: row.endBalance,
    percent: (row.endBalance - initialCapital - (settings.cashFlows||[]).filter(f=>f.date<=row.date).reduce((sum,f)=>sum+(f.type==="deposit"?f.amount:-f.amount),0)) / Math.max(initialCapital,1)*100,
  })), [initialCapital, report.rows]);

  const equityReferences = useMemo<EquityReferenceLine[]>(() => [
    { label: "Mục tiêu", money: initialCapital + targetAmount, percent: rules.target, color: "rgba(52,215,139,.72)" },
    { label: "Vốn đầu", money: initialCapital, percent: 0, color: "rgba(191,202,216,.36)", style: "dotted" },
    { label: "Giới hạn", money: report.currentMaxLossLimit, percent: -rules.maximum, color: "rgba(255,85,116,.68)" },
  ], [initialCapital, report.currentMaxLossLimit, rules.maximum, rules.target, targetAmount]);

  const advancedStats = [
    ["Tổng số giao dịch", String(report.ordered.length)],
    ["Tỷ lệ thắng", report.netN?`${winRate.toFixed(1)}%`:"Chưa đủ dữ liệu"],
    ["Profit factor", report.noLoss?"∞":report.profitFactor?.toFixed(2)??"Chưa đủ dữ liệu"],
    ["Kỳ vọng / lệnh", compactCash(report.expectancy)],
    ["Kỳ vọng theo R", `${report.averageRR?.toFixed(2)??"—"}R`],
    ["Lãi trung bình", compactCash(report.averageWin)],
    ["Lỗ trung bình", compactCash(report.averageLoss===null?null:-report.averageLoss)],
    ["Lệnh thắng lớn nhất", compactCash(report.biggestWin)],
    ["Lệnh thua lớn nhất", compactCash(report.biggestLoss)],
    ["Chuỗi thắng dài nhất", `${report.streak.maxWin} lệnh`],
    ["Chuỗi thua dài nhất", `${report.streak.maxLoss} lệnh`],
    ["Thời gian giữ TB", report.averageDuration===null?"Chưa rõ":report.averageDuration >= 1440 ? `${(report.averageDuration / 1440).toFixed(1)} ngày` : `${Math.round(report.averageDuration)} phút`],
    ["Sụt giảm tối đa", ready?compactCash(-report.maximumDrawdown):"Chưa đủ dữ liệu"],
    ["ROI / tổng rủi ro", `${(report.totalRisk ? report.net / report.totalRisk * 100 : NaN).toFixed(1).replace("NaN","—")}%`],
    ["Điểm kỷ luật", `${report.averageDiscipline?.toFixed(0)??"—"}%`],
    ["Độ nhất quán", `${report.consistency?.toFixed(0)??"—"}%`],
  ];

  return (
    <div className="metrix-shell">
      <p className="import-summary" role={ready?"status":"alert"} data-testid="metrix-coverage">Đã xác minh Net: {report.netN}/{report.rawCount} lệnh · Có 1R: {report.rN}/{report.netN}. {!report.complete?"Dữ liệu chưa đầy đủ; hiệu suất chỉ phản ánh phần đã xác minh, hạn mức chưa được kết luận. ":""}{!report.capitalReady?"Chưa thiết lập vốn ban đầu.":!ready?"Chưa đủ dữ liệu để đánh giá hạn mức.":""}</p><section className="metrix-controlbar">
        <div>
          <span className="metrix-kicker"><i /> TUAN TRADING METRIX</span>
          <h2>Đánh giá hiệu suất & giới hạn rủi ro</h2>
          <p>Chỉ lệnh đã xác minh P&L được đưa vào hiệu suất. Vốn và giới hạn dùng chung với V6.</p>
        </div>
        <div className="metrix-controls">
          <label>
            <span>Vốn khởi điểm</span>
            <input type="number" min="0" step="any" value={initialCapitalInput} onFocus={selectNumericInput} onChange={(event) => setInitialCapitalInput(normalizeNumericInput(event.target.value))} onBlur={()=>{const n=Number(initialCapitalInput);if(initialCapitalInput.trim()&&Number.isFinite(n)&&n>=0)onSettings({...settings,initialCapital:n});else setInitialCapitalInput(String(initialCapital));}} />
          </label>
          <label>
            <span>Mục tiêu lợi nhuận (%)</span>
            <input aria-label="Mục tiêu lợi nhuận phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={profitTargetInput} onFocus={selectNumericInput} onChange={(event) => setProfitTargetInput(normalizeNumericInput(event.target.value))} onBlur={() => setProfitTargetInput(String(rules.target))} />
          </label>
          <label>
            <span>Max Daily Loss (%)</span>
            <input aria-label="Max Daily Loss phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={maxDailyLossInput} onFocus={selectNumericInput} onChange={(event) => setMaxDailyLossInput(normalizeNumericInput(event.target.value))} onBlur={()=>onSettings({...settings,dailyLossPercent:positivePercent(maxDailyLossInput,rules.daily)})} />
          </label>
          <label>
            <span>Max Loss (%)</span>
            <input aria-label="Max Loss phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={maxLossInput} onFocus={selectNumericInput} onChange={(event) => setMaxLossInput(normalizeNumericInput(event.target.value))} onBlur={()=>onSettings({...settings,maxDrawdownPercent:positivePercent(maxLossInput,rules.maximum)})} />
          </label>
        </div>
      </section>

      <section className="metrix-account-strip">
        <div><span>Ngày giao dịch</span><strong>{report.rows.length} ngày</strong><small>Tự động đếm từ nhật ký</small></div>
        <div><span>Vốn nhật ký</span><strong>{cash(initialCapital)}</strong><small>Tiền tệ: VND</small></div>
        <div><span>Nguồn dữ liệu</span><strong>{sourceCount} nguồn</strong><small>{report.ordered.length} giao dịch đã đóng</small></div>
        <div><span>Khoảng đánh giá</span><strong>{firstDate ? DATE.format(new Date(`${firstDate}T12:00:00`)) : "—"}</strong><small>{lastDate ? `đến ${DATE.format(new Date(`${lastDate}T12:00:00`))}` : "Chưa có dữ liệu"}</small></div>
        <div className={`metrix-evaluation ${report.anyDailyBreach || report.anyMaximumBreach ? "failed" : "active"}`}><span>Trạng thái</span><strong>{!ready?"Chưa đủ dữ liệu":report.anyDailyBreach || report.anyMaximumBreach ? "Cần kiểm tra" : profitProgress >= 100 ? "Đạt mục tiêu" : "Đang đánh giá"}</strong><small><i /> Cập nhật theo journal</small></div>
      </section>

      <section className="metrix-balance-grid">
        <article><span>Balance</span><strong>{ready?cash(report.balance):"Chưa đủ dữ liệu"}</strong><small className={report.net >= 0 ? "positive-text" : "negative-text"}>{ready?percent(returnPercent)+" từ ban đầu":"Chưa đủ dữ liệu"}</small></article>
        <article><span>Equity ghi nhận</span><strong>{ready?cash(report.balance):"Chưa đủ dữ liệu"}</strong><small>Không gồm vị thế đang mở</small></article>
        <article><span>Lãi / lỗ ròng</span><strong className={report.net >= 0 ? "positive-text" : "negative-text"}>{report.netN?compactCash(report.net):"Chưa đủ dữ liệu"}</strong><small>Phần đã xác minh · sau phí</small></article>
        <article><span>Biên an toàn còn lại</span><strong>{ready?cash(Math.max(0, report.balance - report.currentMaxLossLimit)):"Chưa đủ dữ liệu"}</strong><small>So với giới hạn lỗ hiện tại</small></article>
      </section>

      <section className="metrix-section">
        <div className="metrix-section-title"><div><span>TRADING OBJECTIVES</span><h3>Mục tiêu giao dịch</h3></div><small>Ba ngưỡng do bạn thiết lập · số ngày tự động cập nhật</small></div>
        <div className="metrix-objectives">
          <ObjectiveCard label="Profit Target" value={ready?`${compactCash(report.net)} / ${compactCash(targetAmount)}`:"Chưa đủ dữ liệu"} detail={`Mục tiêu ${rules.target}% vốn khởi điểm`} progress={profitProgress} state={profitProgress >= 100 ? "passed" : report.net < 0 ? "warning" : "pending"} />
          <ObjectiveCard label="Maximum Daily Loss" value={ready?`${compactCash(-report.worstDailyDrawdown)} / ${compactCash(-report.dailyLimitAmount)}`:"Chưa đủ dữ liệu"} detail={`Giới hạn ${rules.daily}% vốn ban đầu`} progress={dailyUsage} state={!ready?"pending":report.anyDailyBreach ? "failed" : dailyUsage >= 75 ? "warning" : "safe"} usage={ready} />
          <ObjectiveCard label="Maximum Loss" value={ready?`${compactCash(-report.maxLossUsed)} / ${compactCash(-report.maximumAmount)}`:"Chưa đủ dữ liệu"} detail={`Cố định · ${rules.maximum}% vốn khởi điểm`} progress={maximumUsage} state={!ready?"pending":report.anyMaximumBreach ? "failed" : maximumUsage >= 75 ? "warning" : "safe"} usage={ready} />
          <article className="metrix-objective safe">
            <div className="metrix-objective-head"><span>Trading Days</span><i aria-label="Tự động cập nhật">↻</i></div>
            <strong>{report.rows.length} ngày</strong>
            <div className="metrix-progress"><b style={{ width: "100%" }} /></div>
            <div className="metrix-objective-foot"><small>Ngày có ít nhất một giao dịch</small><em>{report.ordered.length} lệnh · tự động</em></div>
          </article>
        </div>
      </section>

      <section className="metrix-main-grid">
        <article className="metrix-panel metrix-chart-panel">
          <div className="metrix-panel-head">
            <div><span>ACCOUNT EQUITY</span><h3>Đường cong Balance</h3></div>
            <small>Trục kép · thời gian thực từ journal</small>
          </div>
          <div className="metrix-chart-summary"><span>Hiện tại <strong>{ready?cash(report.balance)+" · "+percent(returnPercent):"Chưa đủ dữ liệu"}</strong></span><span className="target">Mục tiêu <strong>{cash(initialCapital + targetAmount)} · +{rules.target}%</strong></span><span className="limit">Giới hạn <strong>{cash(report.currentMaxLossLimit)} · −{rules.maximum}%</strong></span></div>
          <EquityTimeChart
            points={equityPoints}
            references={equityReferences}
            ariaLabel="Account Equity theo thời gian với phần trăm bên trái và số tiền bên phải"
            percentLabel="Lợi nhuận (%)"
            moneyLabel="Balance (VND)"
          />
        </article>

        <aside className="metrix-panel metrix-risk-panel">
          <div className="metrix-panel-head"><div><span>RISK MONITOR</span><h3>Sức khỏe rủi ro</h3></div><b className={!ready?"pending":report.anyDailyBreach || report.anyMaximumBreach ? "failed" : "safe"}>{!ready?"CHƯA ĐỦ DỮ LIỆU":report.anyDailyBreach || report.anyMaximumBreach ? "REVIEW" : "SAFE"}</b></div>
          <div className="metrix-risk-gauge" style={{ "--risk": `${clamp(Math.max(dailyUsage, maximumUsage)) * 2.7}deg` } as CSSProperties}><div><strong>{ready?Math.max(dailyUsage, maximumUsage).toFixed(0)+"%":"—"}</strong><span>mức dùng cao nhất</span></div></div>
          <div className="metrix-risk-lines">
            <div><span>Daily loss còn lại</span><strong>{ready?cash(Math.max(0, report.dailyLimitAmount - report.worstDailyDrawdown)):"Chưa đủ dữ liệu"}</strong></div>
            <div><span>Max loss còn lại</span><strong>{ready?cash(Math.max(0, report.maximumAmount - report.maxLossUsed)):"Chưa đủ dữ liệu"}</strong></div>
            <div><span>Max drawdown thực tế</span><strong className="negative-text">{ready?compactCash(-report.maximumDrawdown):"Chưa đủ dữ liệu"}</strong></div>
            <div><span>Độ nhất quán</span><strong>{report.consistency?.toFixed(0)??"—"}%</strong></div>
          </div>
          <p>Giới hạn được ước tính từ các lệnh đã đóng. Equity thời gian thực và P/L vị thế mở cần dữ liệu live từ broker.</p>
        </aside>
      </section>

      <section className="metrix-lower-grid">
        <article className="metrix-panel metrix-stats-panel">
          <div className="metrix-panel-head"><div><span>DETAILED STATISTICS</span><h3>Thống kê chuyên sâu</h3></div><small>{report.rows.length} ngày giao dịch</small></div>
          <div className="metrix-stat-list">{advancedStats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        </article>
        <article className="metrix-panel metrix-symbol-panel">
          <div className="metrix-panel-head"><div><span>INSTRUMENT ANALYSIS</span><h3>Hiệu suất theo sản phẩm</h3></div><small>Top {Math.min(report.symbols.length, 8)}</small></div>
          <div className="metrix-symbol-list">
            {report.symbols.slice(0, 8).map((item, index) => {
              const maximum = Math.max(...report.symbols.map((symbol) => Math.abs(symbol.pnl)), 1);
              return <div key={item.symbol}><span className="metrix-symbol-rank">{String(index + 1).padStart(2, "0")}</span><div><div><strong>{item.symbol}</strong><small>{item.trades} lệnh · {(item.wins / item.trades * 100).toFixed(0)}% thắng</small></div><i><b className={item.pnl >= 0 ? "up" : "down"} style={{ width: `${Math.max(5, Math.abs(item.pnl) / maximum * 100)}%` }} /></i></div><strong className={item.pnl >= 0 ? "positive-text" : "negative-text"}>{compactCash(item.pnl)}</strong></div>;
            })}
          </div>
        </article>
      </section>

      <section className="metrix-panel metrix-daily-panel">
        <div className="metrix-panel-head"><div><span>DAILY SUMMARY</span><h3>Kết quả theo ngày</h3></div><div className="metrix-daily-summary"><span>Ngày tốt nhất <strong className="positive-text">{compactCash(report.bestDay)}</strong></span><span>Tổng ngày xanh <strong>{report.rows.filter((row) => (row.pnl??0) > 0).length}</strong></span></div></div>
        <div className="metrix-table-wrap"><table className="metrix-table"><thead><tr><th>Ngày</th><th>Giao dịch</th><th>Mua / Bán</th><th>Rủi ro</th><th>Phí</th><th>Kết quả ngày</th><th>Balance cuối ngày</th><th>Daily loss dùng</th><th>Trạng thái</th></tr></thead><tbody>
          {pageRows.map((row) => {
            const usage = report.dailyLimitAmount ? row.dailyDrawdown / report.dailyLimitAmount * 100 : 0;
            return <tr key={row.date}><td><strong>{DATE.format(new Date(`${row.date}T12:00:00`))}</strong></td><td>{row.trades}</td><td><span className="metrix-side buy">{row.buys} B</span><span className="metrix-side sell">{row.sells} S</span></td><td>{compactCash(row.risk)}</td><td>{compactCash(row.fees===null?null:-row.fees)}</td><td className={(row.pnl??0) >= 0 ? "positive-text" : "negative-text"}>{compactCash(row.pnl)}</td><td>{report.complete?cash(row.endBalance):"Chưa đủ dữ liệu"}</td><td><div className="metrix-mini-progress"><i><b className={usage >= 75 ? "warn" : ""} style={{ width: `${clamp(usage)}%` }} /></i><span>{row.usage===null?"—":usage.toFixed(0)+"%"}</span></div></td><td><span className={`metrix-day-status ${!ready||!row.complete?"pending":usage >= 100 || row.lowestBalance < row.maxLossLimit ? "failed" : "ok"}`}>{!ready||!row.complete?"Chưa đủ dữ liệu":usage >= 100 || row.lowestBalance < row.maxLossLimit ? "Vi phạm" : "Đạt"}</span></td></tr>;
          })}
        </tbody></table></div>
        <div className="metrix-pagination"><span>Hiển thị {pageRows.length} / {report.rows.length} ngày</span><div><button disabled={safePage === 0} onClick={() => setDailyPage(Math.max(0, safePage - 1))}>‹</button><strong>{safePage + 1} / {pageCount}</strong><button disabled={safePage >= pageCount - 1} onClick={() => setDailyPage(Math.min(pageCount - 1, safePage + 1))}>›</button></div></div>
      </section>
    </div>
  );
}
