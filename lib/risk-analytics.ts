/** Classic's financial boundary: pnl is gross, fees/swap are positive costs. */
import {AccountBaselineSettings} from './journal-lifecycle.js';
export interface RiskTrade {
  id: string;
  date: string;
  closedAt?: string | null;
  openedAt?: string | null;
  symbol: string;
  side: string;
  pnl: number;
  risk: number;
  fees?: number;
  swap?: number;
  setup: string;
  session: string;
  discipline: number;
  durationMin: number;
  mae?: number | null;
  mfe?: number | null;
  recordKind?: string;
  feesKnown?: boolean;
  pnlKnown?: boolean;
  rules?: Record<string, boolean>;
  riskKnown?: boolean;
}
export interface RiskSettings {
  cashFlows?: Array<{
    id: string;
    date: string;
    type: "deposit" | "withdrawal";
    amount: number;
  }>;
  disciplineLock?: boolean;
  weeklyAutoPack?: boolean;
  exposures?: Array<{ id: string; group: string; side: string; risk: number }>;
  initialCapital: number;
  riskPercent: number;
  dailyLossPercent: number;
  defensivePercent: number;
  stopPercent: number;
  maxDrawdownPercent: number;
  floorMode: "static" | "trailing";
  accountMode: "personal" | "prop";
  unrealized: number | null;
  highWaterMark: number | null;
  timezone: string;
  colorMode: "standard" | "accessible";
  recoveryReview: string;
  recoveryPlan: string;
}
export const DEFAULT_RISK: RiskSettings = {
  weeklyAutoPack: true,
  initialCapital: AccountBaselineSettings.initialCapital,
  riskPercent: 1,
  dailyLossPercent: 3,
  defensivePercent: 5,
  stopPercent: 15,
  maxDrawdownPercent: 20,
  floorMode: "static",
  accountMode: "personal",
  unrealized: null,
  highWaterMark: null,
  timezone: "Asia/Ho_Chi_Minh",
  colorMode: "standard",
  recoveryReview: "",
  recoveryPlan: "",
};
export function netPnl(t: Pick<RiskTrade, "pnl" | "fees" | "swap">) {
  return t.pnl - (t.fees ?? 0) - (t.swap ?? 0);
}
export function followed(t: RiskTrade) {
  return t.rules && Object.keys(t.rules).length
    ? Object.values(t.rules).every(Boolean)
    : t.discipline === 100;
}
const mean = (a: number[]) =>
  a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
export function analyzeRiskTrades(
  input: readonly RiskTrade[],
  capital = 0,
  timezone = "Asia/Ho_Chi_Minh",
  cashFlows: NonNullable<RiskSettings["cashFlows"]> = [],
) {
  // Execution receipts are not closed positions. Never invent R or a win from a raw fill.
  const trades = input
    .map((t) => ({ ...t, date: eventDay(t, timezone) }))
    .filter((t) => t.recordKind !== "fill")
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.closedAt || a.date) - Date.parse(b.closedAt || b.date) ||
        a.id.localeCompare(b.id),
    );
  const financialComplete = trades.every(
    (t) => t.feesKnown !== false && t.pnlKnown !== false,
  );
  const known = trades.filter(
    (t) => t.feesKnown !== false && t.pnlKnown !== false,
  );
  const values = known.map(netPnl);
  const r = known
    .filter((t) => t.riskKnown !== false && t.risk > 0)
    .map((t) => netPnl(t) / t.risk);
  const averageR = mean(r);
  const sdR =
    r.length > 1 && averageR !== null
      ? Math.sqrt(
          r.reduce((s, n) => s + (n - averageR) ** 2, 0) / (r.length - 1),
        )
      : null;
  const downside = r.length
    ? Math.sqrt(r.reduce((s, n) => s + Math.min(n, 0) ** 2, 0) / r.length)
    : null;
  const profit = values.reduce((s, n) => s + Math.max(n, 0), 0);
  const loss = values.reduce((s, n) => s + Math.max(-n, 0), 0);
  let balance = capital,
    peak = capital,
    maxDD = 0,
    maxDDPercent = 0,
    hypothetical = capital;
  const balances: number[] = [];
  const external = [...cashFlows].sort((a, b) => a.date.localeCompare(b.date));
  let cashIndex = 0,
    cashTotal = 0;
  const applyCash = (until: string) => {
    while (cashIndex < external.length && external[cashIndex].date <= until) {
      const f = external[cashIndex++],
        amount = f.type === "deposit" ? f.amount : -f.amount;
      balance += amount;
      peak += amount;
      hypothetical += amount;
      cashTotal += amount;
    }
  };
  let rolling = 0;
  const curve = known.map((trade, i) => {
    applyCash(trade.date);
    const net = netPnl(trade);
    balance += net;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const drawdownPercent = peak > 0 ? (100 * drawdown) / peak : null;
    maxDD = Math.max(maxDD, drawdown);
    maxDDPercent = Math.max(maxDDPercent, drawdownPercent ?? 0);
    if (followed(trade)) hypothetical += net;
    balances.push(balance);
    rolling += balance;
    if (i >= 20) rolling -= balances[i - 20];
    return {
      id: trade.id,
      date: trade.date,
      balance,
      peak,
      drawdown,
      drawdownPercent,
      hypothetical,
      sma20: i >= 19 ? rolling / 20 : null,
    };
  });
  applyCash("9999-12-31");
  const sqn =
    averageR !== null && sdR
      ? (Math.sqrt(Math.min(r.length, 100)) * averageR) / sdR
      : null;
  const groups = (key: "setup" | "session" | "symbol" | "compliance") => {
    const grouped = new Map<string, RiskTrade[]>();
    for (const t of known) {
      const label =
        key === "compliance" ? (followed(t) ? "Tuân thủ" : "Vi phạm") : t[key];
      grouped.set(label, [...(grouped.get(label) ?? []), t]);
    }
    return [...grouped]
      .map(([label, items]) => ({
        label,
        n: items.length,
        net: items.reduce((s, t) => s + netPnl(t), 0),
        winRate:
          (100 * items.filter((t) => netPnl(t) > 0).length) / items.length,
        meanDuration:
          items.reduce((s, t) => s + t.durationMin, 0) / items.length,
      }))
      .sort((a, b) => b.net - a.net);
  };
  const days = [...new Set(known.map((t) => t.date))].map((date) => {
    const items = known.filter((t) => t.date === date);
    return {
      date,
      net: items.reduce((s, t) => s + netPnl(t), 0),
      n: items.length,
      wins: items.filter((t) => netPnl(t) > 0).length,
    };
  });
  return {
    trades,
    financialComplete,
    knownN: known.length,
    n: trades.length,
    excludedFills: input.length - trades.length,
    rN: r.length,
    net: values.reduce((s, n) => s + n, 0),
    winRate: known.length
      ? (100 * values.filter((n) => n > 0).length) / known.length
      : null,
    profitFactor: loss ? profit / loss : null,
    noLoss: loss === 0 && profit > 0,
    expectancyR: averageR,
    sqn,
    sqnLabel:
      sqn === null
        ? "Chưa xác định"
        : sqn < 1.6
          ? "Kém"
          : sqn < 2.5
            ? "Trung bình – Khá"
            : sqn < 3
              ? "Tốt"
              : "Xuất sắc",
    sharpe: averageR !== null && sdR ? averageR / sdR : null,
    sortino: averageR !== null && downside ? averageR / downside : null,
    mae: mean(trades.flatMap((t) => (t.mae == null ? [] : [t.mae]))),
    mfe: mean(trades.flatMap((t) => (t.mfe == null ? [] : [t.mfe]))),
    excursionN: trades.filter((t) => t.mae != null && t.mfe != null).length,
    curve,
    days,
    balance,
    peak,
    maxDD,
    maxDDPercent: capital > 0 ? maxDDPercent : null,
    strategies: groups("setup"),
    sessions: groups("session"),
    symbols: groups("symbol"),
    compliance: groups("compliance"),
    hypotheticalNet: hypothetical - capital - cashTotal,
    discipline: trades.length
      ? trades.reduce((s, t) => s + t.discipline, 0) / trades.length
      : null,
  };
}
export function eventDay(
  t: Pick<RiskTrade, "date" | "closedAt">,
  timezone = "Asia/Ho_Chi_Minh",
) {
  const time = t.closedAt ? new Date(t.closedAt) : null;
  return time && Number.isFinite(time.getTime())
    ? dayInZone(time, timezone)
    : t.date;
}
export function dayInZone(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function riskDesk(
  trades: readonly RiskTrade[],
  settings: RiskSettings,
  now = new Date(),
) {
  const today = dayInZone(now, settings.timezone);
  const a = analyzeRiskTrades(
    trades,
    settings.initialCapital,
    settings.timezone,
    (settings.cashFlows ?? []).filter((f) => f.date <= today),
  );
  const events = trades
    .map((t) => ({ ...t, date: eventDay(t, settings.timezone) }))
    .filter((t) => !t.id.startsWith("cycle:"));
  const flows = (settings.cashFlows ?? [])
    .filter((f) => f.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const signed = (f: (typeof flows)[number]) =>
    f.type === "deposit" ? f.amount : -f.amount;
  let flowIndex = 0,
    flowTotal = 0;
  let realized = settings.initialCapital,
    realizedPeak = realized;
  for (const t of [...events].sort(
    (a, b) =>
      Date.parse(a.closedAt || a.date) - Date.parse(b.closedAt || b.date) ||
      a.id.localeCompare(b.id),
  )) {
    while (flowIndex < flows.length && flows[flowIndex].date <= t.date) {
      const n = signed(flows[flowIndex++]);
      realized += n;
      realizedPeak += n;
      flowTotal += n;
    }
    realized += netPnl(t);
    realizedPeak = Math.max(realizedPeak, realized);
  }
  while (flowIndex < flows.length) {
    const n = signed(flows[flowIndex++]);
    realized += n;
    realizedPeak += n;
    flowTotal += n;
  }
  const before = events
    .filter((t) => t.date < today)
    .reduce(
      (s, t) => s + netPnl(t),
      settings.initialCapital +
        flows.filter((f) => f.date < today).reduce((s, f) => s + signed(f), 0),
    );
  const dayNet = events
    .filter((t) => t.date === today)
    .reduce((s, t) => s + netPnl(t), 0);
  const equity = realized + (settings.unrealized ?? 0);
  const peak = Math.max(realizedPeak, settings.highWaterMark ?? 0, equity);
  const ddPercent =
    settings.initialCapital > 0 && peak > 0
      ? (100 * (peak - equity)) / peak
      : null;
  const dailyBudget = (Math.max(0, before) * settings.dailyLossPercent) / 100;
  const used = Math.max(0, -dayNet - Math.min(0, settings.unrealized ?? 0));
  const usage = dailyBudget > 0 ? (100 * used) / dailyBudget : null;
  const floor =
    settings.floorMode === "trailing"
      ? peak - (settings.initialCapital * settings.maxDrawdownPercent) / 100
      : settings.initialCapital * (1 - settings.maxDrawdownPercent / 100) +
        flowTotal;
  const dataComplete = events.every(
    (t) => t.feesKnown !== false && t.pnlKnown !== false,
  );
  const observedTier =
    !dataComplete || ddPercent === null
      ? "unknown"
      : ddPercent >= settings.stopPercent ||
          equity <= floor ||
          (usage ?? 0) >= 100
        ? "stop"
        : ddPercent >= settings.defensivePercent
          ? "defensive"
          : "normal";
  const tier =
    settings.disciplineLock && observedTier !== "unknown"
      ? "stop"
      : observedTier;
  const riskBudget =
    (((dataComplete ? Math.max(0, equity) : 0) * settings.riskPercent) / 100) *
    (tier === "defensive"
      ? 0.5
      : tier === "stop" || tier === "unknown"
        ? 0
        : 1);
  return {
    ...a,
    dataComplete,
    balance: realized,
    today,
    equity,
    peak,
    ddPercent,
    dailyOpening: before,
    dayNet,
    dailyBudget,
    used,
    usage,
    remaining: Math.max(0, dailyBudget - used),
    floor,
    buffer: equity - floor,
    tier,
    observedTier,
    riskBudget,
    remainingLosses:
      riskBudget > 0
        ? Math.floor(Math.max(0, dailyBudget - used) / riskBudget)
        : 0,
    level:
      usage === null
        ? "unknown"
        : usage >= 90
          ? "critical"
          : usage >= 80
            ? "danger"
            : usage >= 70
              ? "warning"
              : usage >= 50
                ? "amber"
                : "safe",
    allowedStrategies:
      tier === "defensive"
        ? a.strategies.slice(0, 2).map((g) => g.label)
        : a.strategies.map((g) => g.label),
  };
}
export function positionSize(
  budget: number,
  entry: number,
  stop: number,
  multiplier: number,
  feePerUnit: number,
  lotStep: number,
  target?: number,
) {
  if (
    ![budget, entry, stop, multiplier, feePerUnit, lotStep].every(
      Number.isFinite,
    ) ||
    budget < 0 ||
    entry <= 0 ||
    stop <= 0 ||
    entry === stop ||
    multiplier <= 0 ||
    feePerUnit < 0 ||
    lotStep <= 0
  )
    return null;
  const unitRisk = Math.abs(entry - stop) * multiplier + feePerUnit;
  const quantity =
    Math.floor((budget / unitRisk + Number.EPSILON) / lotStep) * lotStep;
  const side = stop < entry ? "Buy" : "Sell";
  const reward = target
    ? (side === "Buy" ? target - entry : entry - target) * multiplier -
      feePerUnit
    : null;
  return {
    quantity: Number(quantity.toPrecision(12)),
    unitRisk,
    actualRisk: quantity * unitRisk,
    side,
    plannedR: reward !== null && reward > 0 ? reward / unitRisk : null,
  };
}
