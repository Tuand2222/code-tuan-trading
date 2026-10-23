import { formatInTimeZone } from 'date-fns-tz';
import type { Journal, Trade, Setup, ErrorTag, Plan } from '../data/schema';
import { tradeFacts } from './trade';
import { D, dec, sum } from './money';
import { analyze, type Scope } from './analyze';
import { mulberry32 } from './stats/inference';

export function compliance(trade: Trade, setup?: Setup) {
  if (!setup?.checklist.length) return null;
  const weights = setup.checklist.reduce((n, c) => n + c.weight, 0);
  return (
    (setup.checklist.reduce(
      (n, c) =>
        n + (trade.checklist?.some((x) => x.criterionId === c.id && x.checked) ? c.weight : 0),
      0,
    ) /
      weights) *
    100
  );
}
export function tilt(trades: Trade[], errors: ErrorTag[]) {
  return (['entry', 'management', 'exit'] as const).map((stage) => {
    const chips = trades.flatMap((t) =>
      (t.stageChips?.[stage] ?? [])
        .map((id) =>
          errors.find((e) => e.id === id && e.journalId === t.journalId && e.stage === stage),
        )
        .filter((e) => e !== undefined),
    );
    return {
      stage,
      n: chips.length,
      negative: chips.filter((e) => e.tone === 'neg').length,
      negativePercent: chips.length
        ? (chips.filter((e) => e.tone === 'neg').length / chips.length) * 100
        : null,
    };
  });
}
export function sessionFindings(journal: Journal, trades: Trade[], plan?: Plan) {
  if (!plan?.sessionWindows.length && !plan?.maxTradesPerDay) return [];
  const counts = new Map<string, number>();
  const times = new Map<string, string[]>();
  return trades
    .filter((t) => t.journalId === journal.id)
    .map((t) => ({
      t,
      time: t.legs
        .filter((l) => l.kind === 'in')
        .reduce((a, b) => (Date.parse(a.time) <= Date.parse(b.time) ? a : b)).time,
    }))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.t.id.localeCompare(b.t.id))
    .flatMap(({ t, time }) => {
      let parts = times.get(time);
      if (!parts) {
        parts = formatInTimeZone(time, journal.timezone, 'yyyy-MM-dd HH:mm').split(' ');
        times.set(time, parts);
      }
      const [date, clock] = parts;
      const count = (counts.get(date) ?? 0) + 1;
      counts.set(date, count);
      const outside =
        !!plan?.sessionWindows.length &&
        !plan.sessionWindows.some((w) =>
          w.from <= w.to ? clock >= w.from && clock <= w.to : clock >= w.from || clock <= w.to,
        );
      return outside || (plan?.maxTradesPerDay !== undefined && count > plan.maxTradesPerDay)
        ? [{ tradeId: t.id, date, count, outside }]
        : [];
    });
}
export function exitAnalysis(trade: Trade) {
  const f = tradeFacts(trade);
  if (trade.legs.length !== 2 || !trade.highestPrice || !trade.lowestPrice || !f.avgExit || !f.risk)
    return null;
  const hi = D(trade.highestPrice),
    lo = D(trade.lowestPrice),
    entry = D(f.avgEntry),
    exit = D(f.avgExit);
  if (hi.lt(lo) || hi.lt(entry) || hi.lt(exit) || lo.gt(entry) || lo.gt(exit)) return null;
  const direction = trade.side === 'long' ? 1 : -1,
    scale = D(trade.legs[0].quantity)
      .mul(trade.multiplier ?? '1')
      .div(f.risk);
  const best = trade.side === 'long' ? hi : lo,
    worst = trade.side === 'long' ? lo : hi;
  const mfe = best.minus(entry).mul(direction).mul(scale),
    mae = worst.minus(entry).mul(direction).mul(scale);
  const planned = trade.plannedTP
    ? D(trade.plannedTP).minus(entry).mul(direction).mul(scale)
    : undefined;
  return {
    tradeId: trade.id,
    mfeR: dec(mfe),
    maeR: dec(mae),
    actualR: f.r ?? null,
    efficiencyPercent: f.r !== undefined && mfe.gt(0) ? dec(D(f.r).div(mfe).mul(100)) : null,
    plannedR: planned ? dec(planned) : null,
    managementEffectR: planned && f.r !== undefined ? dec(D(f.r).minus(planned)) : null,
    otpHit: trade.plannedTP
      ? trade.side === 'long'
        ? hi.gte(trade.plannedTP)
        : lo.lte(trade.plannedTP)
      : null,
  };
}
export type Dimension = 'symbol' | 'setupId' | 'market' | 'side';
export function drilldown(
  journal: Journal,
  trades: Trade[],
  dimensions: Dimension[],
  scope: Scope = {},
) {
  const groups = new Map<string, Trade[]>();
  for (const t of trades.filter((t) => t.journalId === journal.id)) {
    const key = JSON.stringify(dimensions.map((d) => t[d] ?? '(chưa gán)'));
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups].map(([key, rows]) => ({
    key,
    tradeIds: rows.map((t) => t.id),
    metrics: analyze(journal, rows, scope).metrics,
  }));
}
export function ruleAssistant(
  journal: Journal,
  trades: Trade[],
  question: 'missing' | 'loss' | 'review',
) {
  return trades
    .filter((t) => t.journalId === journal.id)
    .map(tradeFacts)
    .filter((f) =>
      question === 'missing'
        ? f.net === undefined || !f.risk
        : question === 'loss'
          ? f.r !== undefined && D(f.r).lt(-1)
          : !f.trade.review.done,
    )
    .map((f) => ({
      tradeId: f.id,
      symbol: f.trade.symbol,
      net: f.net ?? null,
      r: f.r ?? null,
      reason:
        question === 'missing'
          ? 'Thiếu phí hoặc 1R'
          : question === 'loss'
            ? 'Net/1R < −1'
            : 'Chưa review',
    }));
}
export function whatIf(journal: Journal, trades: Trade[], excluded: string[], scope: Scope = {}) {
  const kept = trades.filter((t) => t.journalId === journal.id && !excluded.includes(t.id));
  const result = analyze(journal, kept, scope);
  return {
    label: 'GIẢ ĐỊNH',
    tradeIds: kept.map((t) => t.id),
    net: result.metrics.net.value,
    averageR: result.metrics.averageR.value,
  };
}
export function monteCarlo(
  values: number[],
  seed = 2103,
  steps = 100,
  paths = 1000,
  milestone = 10,
) {
  if (
    values.length < 2 ||
    values.some((v) => !Number.isFinite(v)) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 1000 ||
    !Number.isInteger(paths) ||
    paths < 100 ||
    paths > 1000 ||
    !Number.isFinite(milestone)
  )
    throw Error('INVALID_MONTE_CARLO');
  const random = mulberry32(seed),
    finals: number[] = [],
    drawdowns: number[] = [],
    samples: number[][] = [];
  for (let i = 0; i < paths; i++) {
    let equity = 0,
      peak = 0,
      dd = 0;
    const line = [0];
    for (let j = 0; j < steps; j++) {
      equity += values[Math.floor(random() * values.length)];
      peak = Math.max(peak, equity);
      dd = Math.max(dd, peak - equity);
      if (i < 10) line.push(equity);
    }
    finals.push(equity);
    drawdowns.push(dd);
    if (i < 10) samples.push(line);
  }
  const q = (xs: number[], p: number) =>
    [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
  return {
    label: 'GIẢ ĐỊNH',
    seed,
    paths,
    steps,
    n: values.length,
    p05: q(finals, 0.05),
    median: q(finals, 0.5),
    p95: q(finals, 0.95),
    drawdown95: q(drawdowns, 0.95),
    milestoneFrequency: finals.filter((v) => v >= milestone).length / paths,
    samples,
  };
}
export function movingAverage(values: (string | null)[], window: number) {
  if (!Number.isInteger(window) || window < 1) throw Error('INVALID_WINDOW');
  return values.map((_, i) => {
    const slice = values.slice(i - window + 1, i + 1);
    return i + 1 < window || slice.some((v) => v === null)
      ? null
      : dec(D(sum(slice as string[])).div(window));
  });
}
export function customSummary(trades: Trade[], slot: string) {
  const values = trades
    .map((t) => t.customStats[slot])
    .filter((v) => v !== undefined && String(v).trim() !== '');
  const numeric = values.map(String).filter((v) => /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v));
  return {
    slot,
    n: numeric.length,
    of: values.length,
    mean: numeric.length ? dec(D(sum(numeric)).div(numeric.length)) : null,
  };
}
export function researchBundle(
  journal: Journal,
  trades: Trade[],
  scope: Scope,
  dimensions: Dimension[],
  question: 'missing' | 'loss' | 'review',
  base?: ReturnType<typeof analyze>,
) {
  const result = base ?? analyze(journal, trades, scope);
  const ids = new Set([...result.closed.map((f) => f.id), ...result.events.map((e) => e.tradeId)]),
    selected = trades.filter((t) => ids.has(t.id));
  const excluded = selected.filter((t) => t.errorTagIds.length).map((t) => t.id);
  return {
    curve: result.curve,
    ma20: movingAverage(
      result.curve.map((p) => p.net),
      20,
    ),
    ma50: movingAverage(
      result.curve.map((p) => p.net),
      50,
    ),
    excluded,
    groups: drilldown(journal, selected, dimensions, scope),
    scenario: whatIf(journal, trades, excluded, scope),
    assistant: ruleAssistant(journal, selected, question),
    custom: Array.from({ length: 20 }, (_, i) => customSummary(selected, String(i + 1))),
    rs: result.closed.filter((f) => f.r !== undefined).map((f) => Number(f.r)),
    n: result.closed.length,
  };
}
