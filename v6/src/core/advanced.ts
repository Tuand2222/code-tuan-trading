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
  if (
    !plan?.sessionWindows.length &&
    !plan?.maxTradesPerDay &&
    !plan?.allowedSetupIds.length &&
    !plan?.maxLossPerDay
  )
    return [];
  const counts = new Map<string, number>();
  const times = new Map<string, string[]>();
  const findings: {
    tradeId: string;
    date: string;
    count: number;
    outside: boolean;
    reason?: string;
  }[] = trades
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
      const disallowed =
        !!plan?.allowedSetupIds.length && (!t.setupId || !plan.allowedSetupIds.includes(t.setupId));
      return outside ||
        disallowed ||
        (plan?.maxTradesPerDay !== undefined && count > plan.maxTradesPerDay)
        ? [
            {
              tradeId: t.id,
              date,
              count,
              outside,
              reason: disallowed ? 'Setup ngoài Plan hoặc chưa gắn setup' : undefined,
            },
          ]
        : [];
    });
  if (plan?.maxLossPerDay) {
    const daily = new Map<string, { value: ReturnType<typeof D>; known: boolean }>();
    const facts = trades.filter((t) => t.journalId === journal.id).map(tradeFacts),
      byId = new Map(facts.map((f) => [f.id, f]));
    for (const e of facts
      .flatMap((f) => f.events)
      .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))) {
      const date = formatInTimeZone(e.time, journal.timezone, 'yyyy-MM-dd'),
        state = daily.get(date) ?? { value: D('0'), known: true },
        f = byId.get(e.tradeId)!;
      daily.set(date, state);
      const value =
        plan.maxLossPerDay.type === 'R'
          ? e.net !== undefined && f.risk
            ? dec(D(e.net).div(f.risk))
            : undefined
          : e.net;
      if (value === undefined) {
        state.known = false;
        continue;
      }
      state.value = state.value.plus(value);
      if (state.known && state.value.lte(D(plan.maxLossPerDay.value).neg()))
        findings.push({
          tradeId: e.tradeId,
          date,
          count: counts.get(date) ?? 0,
          outside: false,
          reason: 'Chạm ngưỡng lỗ/ngày: ' + dec(state.value) + ' ' + plan.maxLossPerDay.type,
        });
    }
  }
  return findings;
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
  const validPlan =
    trade.plannedSL &&
    trade.plannedTP &&
    entry.minus(trade.plannedSL).mul(direction).gt(0) &&
    D(trade.plannedTP).minus(entry).mul(direction).gt(0);
  // Extrema contain no ordering information. Only the user's explicit observation
  // establishes whether the original TP was reached before the original SL.
  const planned =
    !validPlan || !trade.otpHit
      ? undefined
      : trade.otpHit === 'yes'
        ? D(trade.plannedTP!).minus(entry).abs().div(entry.minus(trade.plannedSL!).abs())
        : D(trade.otpHit === 'no' ? '-1' : '0');
  const tpDistance = validPlan ? D(trade.plannedTP!).minus(entry).mul(direction) : undefined;
  const slDistance = validPlan ? entry.minus(trade.plannedSL!).mul(direction) : undefined;
  return {
    tradeId: trade.id,
    mfeR: dec(mfe),
    maeR: dec(mae),
    actualR: f.r ?? null,
    efficiencyPercent: f.r !== undefined && mfe.gt(0) ? dec(D(f.r).div(mfe).mul(100)) : null,
    plannedR: planned ? dec(planned) : null,
    managementEffectR: planned && f.r !== undefined ? dec(D(f.r).minus(planned)) : null,
    otpHit: trade.otpHit ?? null,
    updrawPercent: tpDistance
      ? dec(best.minus(entry).mul(direction).div(tpDistance).mul(100))
      : null,
    adversePercent: slDistance
      ? dec(entry.minus(worst).mul(direction).div(slDistance).mul(100))
      : null,
    exitPercent: tpDistance ? dec(exit.minus(entry).mul(direction).div(tpDistance).mul(100)) : null,
  };
}
export type Dimension =
  | 'symbol'
  | 'setupId'
  | 'market'
  | 'side'
  | 'entryHour'
  | 'exitHour'
  | 'halfHour'
  | 'tenMinute'
  | 'entryWeekday'
  | 'exitWeekday'
  | 'positionSize'
  | 'weekday'
  | 'holding'
  | 'rBucket'
  | 'errorTag';
export function drilldown(
  journal: Journal,
  trades: Trade[],
  dimensions: Dimension[],
  scope: Scope = {},
) {
  const groups = new Map<string, Trade[]>();
  for (const t of trades.filter((t) => t.journalId === journal.id)) {
    const f = tradeFacts(t);
    const value = (d: Dimension): string => {
      if (d === 'symbol' || d === 'setupId' || d === 'market' || d === 'side')
        return t[d] ?? '(chưa gán)';
      if (d === 'errorTag') return [...t.errorTagIds].sort().join(', ') || '(không chip lỗi)';
      if (d === 'positionSize') {
        const q = Number(sum(t.legs.filter((l) => l.kind === 'in').map((l) => l.quantity)));
        return q < 1
          ? '< 1'
          : q < 10
            ? '1…<10'
            : q < 100
              ? '10…<100'
              : q < 1000
                ? '100…<1000'
                : '≥ 1000';
      }
      if (d === 'rBucket')
        return f.r === undefined
          ? 'Thiếu 1R'
          : Number(f.r) <= -1
            ? '≤ −1R'
            : Number(f.r) < 0
              ? '−1…0R'
              : Number(f.r) < 1
                ? '0…1R'
                : Number(f.r) < 2
                  ? '1…2R'
                  : Number(f.r) < 3
                    ? '2…3R'
                    : '≥ 3R';
      if (d === 'holding')
        return f.holdMinutes === undefined
          ? 'Đang mở'
          : f.holdMinutes < 60
            ? '< 1 giờ'
            : f.holdMinutes < 1440
              ? '1…24 giờ'
              : '≥ 1 ngày';
      const time = d === 'entryHour' || d === 'entryWeekday' ? f.openTime : f.closeTime;
      if (!time) return 'Đang mở';
      if (d === 'weekday' || d === 'entryWeekday' || d === 'exitWeekday')
        return formatInTimeZone(time, journal.timezone, 'EEEE');
      const clock = formatInTimeZone(time, journal.timezone, 'HH:mm');
      if (d === 'tenMinute')
        return (
          clock.slice(0, 3) + String(Math.floor(Number(clock.slice(3)) / 10) * 10).padStart(2, '0')
        );
      return d === 'halfHour'
        ? clock.slice(0, 3) + (Number(clock.slice(3)) < 30 ? '00' : '30')
        : clock.slice(0, 2) + ':00';
    };
    const key = JSON.stringify(dimensions.map(value));
    const group = groups.get(key);
    if (group) group.push(t);
    else groups.set(key, [t]);
  }
  return [...groups].map(([key, rows]) => {
    const result = analyze(journal, rows, scope, [], { inference: false });
    return {
      key,
      tradeIds: rows.map((t) => t.id),
      metrics: result.metrics,
      summary: result.overall,
    };
  });
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
  options: { mode?: 'fixedR' | 'percent'; riskPercent?: number; ruin?: number } = {},
) {
  const mode = options.mode ?? 'fixedR',
    risk = options.riskPercent ?? 1,
    ruin = options.ruin ?? (mode === 'percent' ? 50 : 20);
  if (
    values.length < 20 ||
    values.some((v) => !Number.isFinite(v)) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(steps) ||
    steps < 50 ||
    steps > 500 ||
    !Number.isInteger(paths) ||
    paths < 100 ||
    paths > 1000 ||
    !Number.isFinite(milestone) ||
    !Number.isFinite(risk) ||
    risk <= 0 ||
    risk > 100 ||
    !Number.isFinite(ruin) ||
    ruin <= 0 ||
    (mode === 'percent' && ruin > 100)
  )
    throw Error('INVALID_MONTE_CARLO');
  const random = mulberry32(seed),
    finals: number[] = [],
    drawdowns: number[] = [],
    samples: number[][] = [],
    columns: number[][] = Array.from({ length: steps + 1 }, () => []);
  let ruined = 0;
  for (let i = 0; i < paths; i++) {
    let equity = 0,
      peak = 0,
      dd = 0;
    const line = [0];
    let hit = false;
    columns[0].push(0);
    for (let j = 0; j < steps; j++) {
      const r = values[Math.floor(random() * values.length)];
      equity =
        mode === 'percent'
          ? Math.max(-100, equity + ((100 + equity) * risk * r) / 100)
          : equity + r;
      peak = Math.max(peak, equity);
      dd = Math.max(dd, peak - equity);
      if (equity <= -ruin) hit = true;
      columns[j + 1].push(equity);
      if (i < 10) line.push(equity);
    }
    finals.push(equity);
    drawdowns.push(dd);
    if (hit) ruined++;
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
    p25: q(finals, 0.25),
    median: q(finals, 0.5),
    p95: q(finals, 0.95),
    p75: q(finals, 0.75),
    mode,
    unit: mode === 'percent' ? '%' : 'R',
    riskPercent: risk,
    ruin,
    positiveProbability: finals.filter((v) => v > 0).length / paths,
    ruinProbability: ruined / paths,
    band: columns.map((xs) => {
      xs.sort((a, b) => a - b);
      return [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => xs[Math.floor((xs.length - 1) * p)]);
    }),
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
