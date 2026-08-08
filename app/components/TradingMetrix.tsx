"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { normalizeNumericInput, selectNumericInput } from "./numeric-input";

type MetrixTrade = {
  id: string;
  date: string;
  symbol: string;
  side: "Buy" | "Sell";
  risk: number;
  pnl: number;
  discipline: number;
  durationMin: number;
  fees?: number;
  source?: string;
};

type DailyRow = {
  date: string;
  trades: number;
  buys: number;
  sells: number;
  pnl: number;
  risk: number;
  fees: number;
  startBalance: number;
  endBalance: number;
  lowestBalance: number;
  dailyDrawdown: number;
  maxLossLimit: number;
};

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

function compactCash(value: number) {
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

function streaks(trades: MetrixTrade[]) {
  let win = 0;
  let loss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) {
      win += 1;
      loss = 0;
      maxWin = Math.max(maxWin, win);
    } else if (trade.pnl < 0) {
      loss += 1;
      win = 0;
      maxLoss = Math.max(maxLoss, loss);
    }
  }
  return { maxWin, maxLoss };
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

export default function TradingMetrix({ trades }: { trades: MetrixTrade[] }) {
  const [initialCapitalInput, setInitialCapitalInput] = useState("200000000");
  const [profitTargetInput, setProfitTargetInput] = useState("10");
  const [maxDailyLossInput, setMaxDailyLossInput] = useState("5");
  const [maxLossInput, setMaxLossInput] = useState("10");
  const [chartMode, setChartMode] = useState<"money" | "percent">("money");
  const [dailyPage, setDailyPage] = useState(0);
  const initialCapital = Math.max(10_000_000, Number(initialCapitalInput) || 10_000_000);

  const rules = {
    target: positivePercent(profitTargetInput, 10),
    daily: positivePercent(maxDailyLossInput, 5),
    maximum: positivePercent(maxLossInput, 10),
  };

  const report = useMemo(() => {
    const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const grouped = new Map<string, MetrixTrade[]>();
    for (const trade of ordered) grouped.set(trade.date, [...(grouped.get(trade.date) ?? []), trade]);

    let balance = initialCapital;
    let allTimePeak = initialCapital;
    let maximumDrawdown = 0;
    let lowestBalance = initialCapital;
    let anyDailyBreach = false;
    let anyMaximumBreach = false;
    const maximumAmount = initialCapital * rules.maximum / 100;
    const dailyLimitAmount = initialCapital * rules.daily / 100;
    const rows: DailyRow[] = [];

    for (const [date, dayTrades] of grouped) {
      const startBalance = balance;
      const maxLossLimit = initialCapital - maximumAmount;
      let intradayBalance = startBalance;
      let intradayLow = startBalance;
      let pnl = 0;
      let risk = 0;
      let fees = 0;
      for (const trade of dayTrades) {
        pnl += trade.pnl;
        risk += trade.risk;
        fees += trade.fees ?? 0;
        intradayBalance += trade.pnl;
        intradayLow = Math.min(intradayLow, intradayBalance);
        allTimePeak = Math.max(allTimePeak, intradayBalance);
        maximumDrawdown = Math.max(maximumDrawdown, allTimePeak - intradayBalance);
        lowestBalance = Math.min(lowestBalance, intradayBalance);
      }
      balance = intradayBalance;
      const dailyDrawdown = Math.max(0, startBalance - intradayLow);
      if (dailyDrawdown > dailyLimitAmount) anyDailyBreach = true;
      if (intradayLow < maxLossLimit) anyMaximumBreach = true;
      rows.push({
        date,
        trades: dayTrades.length,
        buys: dayTrades.filter((trade) => trade.side === "Buy").length,
        sells: dayTrades.filter((trade) => trade.side === "Sell").length,
        pnl,
        risk,
        fees,
        startBalance,
        endBalance: balance,
        lowestBalance: intradayLow,
        dailyDrawdown,
        maxLossLimit,
      });
    }

    const wins = ordered.filter((trade) => trade.pnl > 0);
    const losses = ordered.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const net = balance - initialCapital;
    const totalRisk = ordered.reduce((sum, trade) => sum + trade.risk, 0);
    const positiveDays = rows.filter((row) => row.pnl > 0);
    const bestDay = positiveDays.length ? Math.max(...positiveDays.map((row) => row.pnl)) : 0;
    const worstDailyDrawdown = rows.length ? Math.max(...rows.map((row) => row.dailyDrawdown)) : 0;
    const currentMaxLossLimit = initialCapital - maximumAmount;
    const maxLossUsed = rows.length
      ? Math.max(0, ...rows.map((row) => maximumAmount - (row.lowestBalance - row.maxLossLimit)))
      : 0;
    const symbolMap = new Map<string, { symbol: string; pnl: number; trades: number; wins: number }>();
    for (const trade of ordered) {
      const item = symbolMap.get(trade.symbol) ?? { symbol: trade.symbol, pnl: 0, trades: 0, wins: 0 };
      item.pnl += trade.pnl;
      item.trades += 1;
      item.wins += trade.pnl > 0 ? 1 : 0;
      symbolMap.set(trade.symbol, item);
    }
    const symbols = [...symbolMap.values()].sort((a, b) => b.pnl - a.pnl);
    const absoluteDailySum = rows.reduce((sum, row) => sum + Math.abs(row.pnl), 0);
    const largestAbsoluteDay = rows.length ? Math.max(...rows.map((row) => Math.abs(row.pnl))) : 0;
    const consistency = absoluteDailySum ? Math.max(0, (1 - largestAbsoluteDay / absoluteDailySum) * 100) : 0;
    const streak = streaks(ordered);

    return {
      ordered,
      rows,
      balance,
      net,
      grossProfit,
      grossLoss,
      totalRisk,
      wins,
      losses,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
      expectancy: ordered.length ? net / ordered.length : 0,
      averageRR: ordered.length ? ordered.reduce((sum, trade) => sum + (trade.risk ? trade.pnl / trade.risk : 0), 0) / ordered.length : 0,
      averageWin: wins.length ? grossProfit / wins.length : 0,
      averageLoss: losses.length ? grossLoss / losses.length : 0,
      biggestWin: wins.length ? Math.max(...wins.map((trade) => trade.pnl)) : 0,
      biggestLoss: losses.length ? Math.min(...losses.map((trade) => trade.pnl)) : 0,
      averageDuration: ordered.length ? ordered.reduce((sum, trade) => sum + trade.durationMin, 0) / ordered.length : 0,
      averageDiscipline: ordered.length ? ordered.reduce((sum, trade) => sum + trade.discipline, 0) / ordered.length : 0,
      maximumDrawdown,
      lowestBalance,
      worstDailyDrawdown,
      anyDailyBreach,
      anyMaximumBreach,
      currentMaxLossLimit,
      maxLossUsed,
      maximumAmount,
      dailyLimitAmount,
      bestDay,
      consistency,
      symbols,
      streak,
    };
  }, [trades, initialCapital, rules.daily, rules.maximum]);

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

  const chart = useMemo(() => {
    const rawValues = [initialCapital, ...report.rows.map((row) => row.endBalance)];
    const transform = (value: number) => chartMode === "percent" ? (value - initialCapital) / Math.max(initialCapital, 1) * 100 : value;
    const values = rawValues.map(transform);
    const target = transform(initialCapital + targetAmount);
    const limit = transform(report.currentMaxLossLimit);
    const minimum = Math.min(...values, limit);
    const maximum = Math.max(...values, target);
    const padding = Math.max((maximum - minimum) * 0.14, chartMode === "percent" ? 1 : initialCapital * .01);
    const min = minimum - padding;
    const max = maximum + padding;
    const span = Math.max(max - min, 1);
    const y = (value: number) => 88 - ((value - min) / span) * 72;
    const coords = values.map((value, index) => {
      const x = 4 + index / Math.max(values.length - 1, 1) * 92;
      return `${x},${y(value)}`;
    });
    return {
      coords,
      area: `${coords.join(" ")} 96,92 4,92`,
      targetY: y(target),
      limitY: y(limit),
      zeroY: y(transform(initialCapital)),
      max,
      min,
      format: (value: number) => chartMode === "percent" ? `${value.toFixed(1)}%` : compactCash(value),
    };
  }, [chartMode, initialCapital, report.currentMaxLossLimit, report.rows, targetAmount]);

  const advancedStats = [
    ["Tổng số giao dịch", String(report.ordered.length)],
    ["Tỷ lệ thắng", `${winRate.toFixed(1)}%`],
    ["Profit factor", report.profitFactor >= 99 ? "∞" : report.profitFactor.toFixed(2)],
    ["Kỳ vọng / lệnh", compactCash(report.expectancy)],
    ["Kỳ vọng theo R", `${report.averageRR.toFixed(2)}R`],
    ["Lãi trung bình", compactCash(report.averageWin)],
    ["Lỗ trung bình", compactCash(-report.averageLoss)],
    ["Lệnh thắng lớn nhất", compactCash(report.biggestWin)],
    ["Lệnh thua lớn nhất", compactCash(report.biggestLoss)],
    ["Chuỗi thắng dài nhất", `${report.streak.maxWin} lệnh`],
    ["Chuỗi thua dài nhất", `${report.streak.maxLoss} lệnh`],
    ["Thời gian giữ TB", report.averageDuration >= 1440 ? `${(report.averageDuration / 1440).toFixed(1)} ngày` : `${Math.round(report.averageDuration)} phút`],
    ["Sụt giảm tối đa", compactCash(-report.maximumDrawdown)],
    ["ROI / tổng rủi ro", `${(report.totalRisk ? report.net / report.totalRisk * 100 : 0).toFixed(1)}%`],
    ["Điểm kỷ luật", `${report.averageDiscipline.toFixed(0)}%`],
    ["Độ nhất quán", `${report.consistency.toFixed(0)}%`],
  ];

  return (
    <div className="metrix-shell">
      <section className="metrix-controlbar">
        <div>
          <span className="metrix-kicker"><i /> TUAN TRADING METRIX</span>
          <h2>Đánh giá hiệu suất & giới hạn rủi ro</h2>
          <p>Dữ liệu được tính trực tiếp từ nhật ký giao dịch đã ghi nhận.</p>
        </div>
        <div className="metrix-controls">
          <label>
            <span>Vốn khởi điểm</span>
            <input type="number" min="10000000" step="10000000" value={initialCapitalInput} onFocus={selectNumericInput} onChange={(event) => setInitialCapitalInput(normalizeNumericInput(event.target.value))} onBlur={() => setInitialCapitalInput(String(initialCapital))} />
          </label>
          <label>
            <span>Mục tiêu lợi nhuận (%)</span>
            <input aria-label="Mục tiêu lợi nhuận phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={profitTargetInput} onFocus={selectNumericInput} onChange={(event) => setProfitTargetInput(normalizeNumericInput(event.target.value))} onBlur={() => setProfitTargetInput(String(rules.target))} />
          </label>
          <label>
            <span>Max Daily Loss (%)</span>
            <input aria-label="Max Daily Loss phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={maxDailyLossInput} onFocus={selectNumericInput} onChange={(event) => setMaxDailyLossInput(normalizeNumericInput(event.target.value))} onBlur={() => setMaxDailyLossInput(String(rules.daily))} />
          </label>
          <label>
            <span>Max Loss (%)</span>
            <input aria-label="Max Loss phần trăm" type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={maxLossInput} onFocus={selectNumericInput} onChange={(event) => setMaxLossInput(normalizeNumericInput(event.target.value))} onBlur={() => setMaxLossInput(String(rules.maximum))} />
          </label>
        </div>
      </section>

      <section className="metrix-account-strip">
        <div><span>Ngày giao dịch</span><strong>{report.rows.length} ngày</strong><small>Tự động đếm từ nhật ký</small></div>
        <div><span>Vốn mô phỏng</span><strong>{cash(initialCapital)}</strong><small>Tiền tệ: VND</small></div>
        <div><span>Nguồn dữ liệu</span><strong>{sourceCount} nguồn</strong><small>{report.ordered.length} giao dịch đã đóng</small></div>
        <div><span>Khoảng đánh giá</span><strong>{firstDate ? DATE.format(new Date(`${firstDate}T12:00:00`)) : "—"}</strong><small>{lastDate ? `đến ${DATE.format(new Date(`${lastDate}T12:00:00`))}` : "Chưa có dữ liệu"}</small></div>
        <div className={`metrix-evaluation ${report.anyDailyBreach || report.anyMaximumBreach ? "failed" : "active"}`}><span>Trạng thái</span><strong>{report.anyDailyBreach || report.anyMaximumBreach ? "Cần kiểm tra" : profitProgress >= 100 ? "Đạt mục tiêu" : "Đang đánh giá"}</strong><small><i /> Cập nhật theo journal</small></div>
      </section>

      <section className="metrix-balance-grid">
        <article><span>Balance</span><strong>{cash(report.balance)}</strong><small className={report.net >= 0 ? "positive-text" : "negative-text"}>{percent(returnPercent)} từ ban đầu</small></article>
        <article><span>Equity ghi nhận</span><strong>{cash(report.balance)}</strong><small>Không gồm vị thế đang mở</small></article>
        <article><span>Lãi / lỗ ròng</span><strong className={report.net >= 0 ? "positive-text" : "negative-text"}>{compactCash(report.net)}</strong><small>Đã đóng · sau phí đã nhập</small></article>
        <article><span>Biên an toàn còn lại</span><strong>{cash(Math.max(0, report.balance - report.currentMaxLossLimit))}</strong><small>So với giới hạn lỗ hiện tại</small></article>
      </section>

      <section className="metrix-section">
        <div className="metrix-section-title"><div><span>TRADING OBJECTIVES</span><h3>Mục tiêu giao dịch</h3></div><small>Ba ngưỡng do bạn thiết lập · số ngày tự động cập nhật</small></div>
        <div className="metrix-objectives">
          <ObjectiveCard label="Profit Target" value={`${compactCash(report.net)} / ${compactCash(targetAmount)}`} detail={`Mục tiêu ${rules.target}% vốn khởi điểm`} progress={profitProgress} state={profitProgress >= 100 ? "passed" : report.net < 0 ? "warning" : "pending"} />
          <ObjectiveCard label="Maximum Daily Loss" value={`${compactCash(-report.worstDailyDrawdown)} / ${compactCash(-report.dailyLimitAmount)}`} detail={`Giới hạn ${rules.daily}% vốn ban đầu`} progress={dailyUsage} state={report.anyDailyBreach ? "failed" : dailyUsage >= 75 ? "warning" : "safe"} usage />
          <ObjectiveCard label="Maximum Loss" value={`${compactCash(-report.maxLossUsed)} / ${compactCash(-report.maximumAmount)}`} detail={`Cố định · ${rules.maximum}% vốn khởi điểm`} progress={maximumUsage} state={report.anyMaximumBreach ? "failed" : maximumUsage >= 75 ? "warning" : "safe"} usage />
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
            <div className="metrix-chart-toggle"><button className={chartMode === "money" ? "active" : ""} onClick={() => setChartMode("money")}>Số tiền</button><button className={chartMode === "percent" ? "active" : ""} onClick={() => setChartMode("percent")}>%</button></div>
          </div>
          <div className="metrix-chart-summary"><span>Hiện tại <strong>{chartMode === "money" ? cash(report.balance) : percent(returnPercent)}</strong></span><span className="target">Mục tiêu <strong>{chartMode === "money" ? cash(initialCapital + targetAmount) : `${rules.target}%`}</strong></span><span className="limit">Giới hạn <strong>{chartMode === "money" ? cash(report.currentMaxLossLimit) : `−${rules.maximum}%`}</strong></span></div>
          <div className="metrix-chart" role="img" aria-label="Biểu đồ thay đổi số dư theo ngày">
            <div className="metrix-chart-grid" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs><linearGradient id="metrixArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5d8cff" stopOpacity=".28" /><stop offset="100%" stopColor="#5d8cff" stopOpacity="0" /></linearGradient></defs>
              <line x1="4" x2="96" y1={chart.targetY} y2={chart.targetY} className="target-line" vectorEffect="non-scaling-stroke" />
              <line x1="4" x2="96" y1={chart.limitY} y2={chart.limitY} className="limit-line" vectorEffect="non-scaling-stroke" />
              <line x1="4" x2="96" y1={chart.zeroY} y2={chart.zeroY} className="baseline" vectorEffect="non-scaling-stroke" />
              <polygon points={chart.area} fill="url(#metrixArea)" />
              <polyline points={chart.coords.join(" ")} fill="none" stroke="#6e98ff" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              {chart.coords.map((point, index) => { const [cx, cy] = point.split(","); return <circle key={`${point}-${index}`} cx={cx} cy={cy} r={index === chart.coords.length - 1 ? 1.3 : .62} vectorEffect="non-scaling-stroke" />; })}
            </svg>
            <div className="metrix-y-axis"><span>{chart.format(chart.max)}</span><span>{chart.format((chart.max + chart.min) / 2)}</span><span>{chart.format(chart.min)}</span></div>
            <div className="metrix-x-axis"><span>{firstDate ? DATE.format(new Date(`${firstDate}T12:00:00`)) : "Bắt đầu"}</span><span>{lastDate ? DATE.format(new Date(`${lastDate}T12:00:00`)) : "Hiện tại"}</span></div>
          </div>
        </article>

        <aside className="metrix-panel metrix-risk-panel">
          <div className="metrix-panel-head"><div><span>RISK MONITOR</span><h3>Sức khỏe rủi ro</h3></div><b className={report.anyDailyBreach || report.anyMaximumBreach ? "failed" : "safe"}>{report.anyDailyBreach || report.anyMaximumBreach ? "REVIEW" : "SAFE"}</b></div>
          <div className="metrix-risk-gauge" style={{ "--risk": `${clamp(Math.max(dailyUsage, maximumUsage)) * 2.7}deg` } as CSSProperties}><div><strong>{Math.max(dailyUsage, maximumUsage).toFixed(0)}%</strong><span>mức dùng cao nhất</span></div></div>
          <div className="metrix-risk-lines">
            <div><span>Daily loss còn lại</span><strong>{cash(Math.max(0, report.dailyLimitAmount - report.worstDailyDrawdown))}</strong></div>
            <div><span>Max loss còn lại</span><strong>{cash(Math.max(0, report.maximumAmount - report.maxLossUsed))}</strong></div>
            <div><span>Max drawdown thực tế</span><strong className="negative-text">{compactCash(-report.maximumDrawdown)}</strong></div>
            <div><span>Độ nhất quán</span><strong>{report.consistency.toFixed(0)}%</strong></div>
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
        <div className="metrix-panel-head"><div><span>DAILY SUMMARY</span><h3>Kết quả theo ngày</h3></div><div className="metrix-daily-summary"><span>Ngày tốt nhất <strong className="positive-text">{compactCash(report.bestDay)}</strong></span><span>Tổng ngày xanh <strong>{report.rows.filter((row) => row.pnl > 0).length}</strong></span></div></div>
        <div className="metrix-table-wrap"><table className="metrix-table"><thead><tr><th>Ngày</th><th>Giao dịch</th><th>Mua / Bán</th><th>Rủi ro</th><th>Phí</th><th>Kết quả ngày</th><th>Balance cuối ngày</th><th>Daily loss dùng</th><th>Trạng thái</th></tr></thead><tbody>
          {pageRows.map((row) => {
            const usage = report.dailyLimitAmount ? row.dailyDrawdown / report.dailyLimitAmount * 100 : 0;
            return <tr key={row.date}><td><strong>{DATE.format(new Date(`${row.date}T12:00:00`))}</strong></td><td>{row.trades}</td><td><span className="metrix-side buy">{row.buys} B</span><span className="metrix-side sell">{row.sells} S</span></td><td>{compactCash(row.risk)}</td><td>{compactCash(-row.fees)}</td><td className={row.pnl >= 0 ? "positive-text" : "negative-text"}>{compactCash(row.pnl)}</td><td>{cash(row.endBalance)}</td><td><div className="metrix-mini-progress"><i><b className={usage >= 75 ? "warn" : ""} style={{ width: `${clamp(usage)}%` }} /></i><span>{usage.toFixed(0)}%</span></div></td><td><span className={`metrix-day-status ${usage > 100 || row.lowestBalance < row.maxLossLimit ? "failed" : "ok"}`}>{usage > 100 || row.lowestBalance < row.maxLossLimit ? "Vi phạm" : "Đạt"}</span></td></tr>;
          })}
        </tbody></table></div>
        <div className="metrix-pagination"><span>Hiển thị {pageRows.length} / {report.rows.length} ngày</span><div><button disabled={safePage === 0} onClick={() => setDailyPage(Math.max(0, safePage - 1))}>‹</button><strong>{safePage + 1} / {pageCount}</strong><button disabled={safePage >= pageCount - 1} onClick={() => setDailyPage(Math.min(pageCount - 1, safePage + 1))}>›</button></div></div>
      </section>
    </div>
  );
}
