import { riskDesk, type RiskSettings, type RiskTrade } from '../../../lib/risk-analytics';
import { rStatistics, observeTrades, type QuantObservation } from './quantLab';
import { tradeFacts } from './trade';
import type { Trade } from '../data/schema';
import { capitalLabSchema, type CapitalLab } from '../data/capitalSettings';
import { dayInZone } from './analyze';
export type Outcome = { r: number; p: number };
const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function percentile(sorted: ArrayLike<number>, p: number) {
  if (!sorted.length) return null;
  const x = (sorted.length - 1) * p,
    i = Math.floor(x),
    t = x - i;
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * t;
}
export function omega(values: number[], threshold = 0): number | null {
  if (!values.length) return null;
  let up = 0,
    down = 0;
  for (const x of values) {
    up += Math.max(x - threshold, 0);
    down += Math.max(threshold - x, 0);
  }
  return down > 0 ? up / down : up > 0 ? Infinity : null;
}
export function tailRisk(values: number[], confidence = 0.975) {
  if (!values.length || !(confidence > 0 && confidence < 1)) return null;
  const loss = Float64Array.from(values, (x) => -x).sort(),
    n = loss.length,
    m = n * (1 - confidence);
  let total = 0,
    remaining = m;
  for (let i = n - 1; i >= 0 && remaining > 1e-12; i--) {
    const weight = Math.min(1, remaining);
    total += loss[i] * weight;
    remaining -= weight;
  }
  const varValue = loss[Math.max(0, Math.ceil(confidence * n) - 1)];
  return { var: varValue, es: total / m, n, tailMass: m, confidence };
}
export function empiricalOutcomes(values: number[]): Outcome[] {
  const counts = new Map<number, number>();
  for (const x of values) {
    if (!Number.isFinite(x)) throw Error('Invalid return');
    counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  return [...counts].map(([r, n]) => ({ r, p: n / values.length }));
}
export function probabilityBox(outcomes: Outcome[], radius: number): Outcome[] {
  // Exact worst distribution in this relative box for a single nonnegative fraction:
  // log-growth increases with R; the risk moment decreases with R.
  if (radius === 0) return outcomes;
  const a = outcomes
    .map((o) => ({ ...o, p: o.p * (1 - radius), upper: Math.min(1, o.p * (1 + radius)) }))
    .sort((a, b) => a.r - b.r);
  let left = 1 - a.reduce((s, o) => s + o.p, 0);
  for (const o of a) {
    const d = Math.min(left, o.upper - o.p);
    o.p += d;
    left -= d;
  }
  if (left > 1e-9) throw Error('Probability box infeasible');
  return a.map(({ r, p }) => ({ r, p }));
}
export function logRiskMoment(outcomes: Outcome[], f: number, lambda: number) {
  const terms = outcomes
    .filter((o) => o.p > 0)
    .map((o) => (1 + f * o.r > 0 ? Math.log(o.p) - lambda * Math.log1p(f * o.r) : Infinity));
  const m = terms.reduce((a, b) => Math.max(a, b), -Infinity);
  return Number.isFinite(m)
    ? m + Math.log(terms.reduce((s, x) => s + Math.exp(x - m), 0))
    : Infinity;
}
export function solveKelly(outcomes: Outcome[], alpha = 0.8, beta = 0.05) {
  if (!(alpha > 0 && alpha < 1 && beta > 0 && beta < 1))
    throw Error('Alpha/beta must be between zero and one');
  if (outcomes.some((o) => !Number.isFinite(o.r) || !Number.isFinite(o.p) || o.p < 0))
    throw Error('Invalid outcomes');
  const mass = outcomes.reduce((s, o) => s + o.p, 0);
  if (!outcomes.length || Math.abs(mass - 1) > 1e-8)
    return {
      full: 0,
      half: 0,
      quarter: 0,
      rck: 0,
      lambda: Math.log(beta) / Math.log(alpha),
      growth: 0,
      moment: 1,
    };
  const mean = outcomes.reduce((s, o) => s + o.r * o.p, 0),
    lambda = Math.log(beta) / Math.log(alpha);
  const worst = outcomes.reduce((m, o) => (o.p > 0 ? Math.min(m, o.r) : m), 0),
    cap = Math.min(1 - 1e-10, worst < 0 ? (-1 / worst) * (1 - 1e-10) : 1 - 1e-10);
  if (mean <= 0) return { full: 0, half: 0, quarter: 0, rck: 0, lambda, growth: 0, moment: 1 };
  const derivative = (f: number) => outcomes.reduce((s, o) => s + (o.p * o.r) / (1 + f * o.r), 0);
  let lo = 0,
    hi = cap;
  if (derivative(cap) < 0)
    for (let i = 0; i < 90; i++) {
      const mid = (lo + hi) / 2;
      if (derivative(mid) > 0) lo = mid;
      else hi = mid;
    }
  else lo = cap;
  const full = lo;
  lo = 0;
  hi = full;
  if (logRiskMoment(outcomes, full, lambda) <= 0) lo = full;
  else
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (logRiskMoment(outcomes, mid, lambda) <= 0) lo = mid;
      else hi = mid;
    }
  return {
    full,
    half: full / 2,
    quarter: full / 4,
    rck: lo,
    lambda,
    growth: outcomes.reduce((s, o) => s + o.p * Math.log1p(lo * o.r), 0),
    moment: Math.exp(logRiskMoment(outcomes, lo, lambda)),
  };
}
export function recoveryGain(drawdown: number) {
  return drawdown >= 0 && drawdown < 1 ? drawdown / (1 - drawdown) : null;
}
export function fixedStakeRuin(p: number, b: number, units: number): number | null {
  // This special +integer b / -1 lattice model has fixed cash stakes and an infinite horizon.
  if (!(
    p > 0 &&
    p < 1 &&
    Number.isInteger(b) &&
    b >= 1 &&
    b <= 20 &&
    Number.isInteger(units) &&
    units >= 0
  ))
    return null;
  if (units === 0 || p * b <= 1 - p) return 1;
  let lo = 0,
    hi = 1 - 1e-10;
  for (let i = 0; i < 100; i++) {
    const z = (lo + hi) / 2,
      v = p * z ** (b + 1) - z + 1 - p;
    if (v > 0) lo = z;
    else hi = z;
  }
  return ((lo + hi) / 2) ** units;
}
export function capitalTrades(observations: QuantObservation[]): RiskTrade[] {
  return observations.map((o) => ({
    id: o.id,
    date: o.exitDate ?? o.closeTime.slice(0, 10),
    closedAt: o.exitTimeKnown === false ? null : o.closeTime,
    symbol: o.symbol,
    side: '',
    setup: o.setup,
    session: o.openTime.slice(11, 16),
    discipline: 0,
    durationMin: 0,
    pnl: Number(o.net ?? 0),
    fees: 0,
    swap: 0,
    pnlKnown: o.net !== null,
    feesKnown: o.net !== null,
    risk: Number(o.risk ?? 0),
    riskKnown: o.risk !== null,
  }));
}
// Partial exits are realized money too; they affect protection, but never the
// closed-position sample used for strategy statistics or the Kelly fit.
export function accountObservations(trades: Trade[]): QuantObservation[] {
  return [
    ...observeTrades(trades),
    ...trades
      .filter((t) => t.status === 'open')
      .flatMap((t) =>
        tradeFacts(t).events.map((e) => ({
          id: t.id + ':' + e.id,
          symbol: t.symbol,
          market: t.market,
          setup: t.setupId ?? '',
          openTime: t.legs[0].time,
          closeTime: e.time,
          gross: e.gross,
          net: e.net ?? null,
          risk: null,
          mae: null,
          mfe: null,
        })),
      ),
  ];
}
export function capitalProtection(
  all: QuantObservation[],
  settings: RiskSettings,
  now = new Date(),
) {
  const desk = riskDesk(capitalTrades(all), settings, now),
    exposure = (settings.exposures ?? []).reduce((s, x) => s + Math.max(0, x.risk), 0);
  const tier =
    desk.ddPercent !== null && desk.ddPercent >= settings.stopPercent ? 'stop' : desk.tier;
  const known = desk.dataComplete && settings.initialCapital > 0 && desk.equity > 0;
  const ceiling =
    known && tier !== 'stop' && tier !== 'unknown'
      ? Math.max(0, Math.min(desk.riskBudget, desk.remaining - exposure, desk.buffer - exposure))
      : 0;
  return {
    ...desk,
    tier,
    exposure,
    ceiling,
    recovery: desk.ddPercent === null ? null : recoveryGain(desk.ddPercent / 100),
    closedOnly: settings.unrealized === null,
    missingCapital: settings.initialCapital <= 0,
  };
}
export function capitalReport(
  observations: QuantObservation[],
  lab: CapitalLab,
  timezone = 'Asia/Ho_Chi_Minh',
) {
  const days = new Map<string, { net: number; complete: boolean }>();
  for (const o of observations) {
    const day =
        (o.exitTimeKnown === false ? o.exitDate : undefined) ?? dayInZone(o.closeTime, timezone),
      d = days.get(day) ?? { net: 0, complete: true };
    d.complete &&= o.net !== null;
    d.net += Number(o.net ?? 0);
    days.set(day, d);
  }
  const completeDays = [...days.values()].filter((d) => d.complete);
  const rows = observations
    .filter((o) => o.net !== null && o.risk !== null && Number(o.risk) > 0)
    .map((o) => ({ ...o, r: Number(o.net) / Number(o.risk) }))
    .filter((o) => Number.isFinite(o.r))
    .sort((a, b) => a.closeTime.localeCompare(b.closeTime) || a.id.localeCompare(b.id));
  const values = rows.map((o) => o.r),
    n = values.length,
    sorted = Float64Array.from(values).sort();
  const tail = tailRisk(values),
    var99 = tailRisk(values, 0.99),
    mu = average(values),
    stats = rStatistics(values);
  const curve = [];
  const low = percentile(sorted, 0.1) ?? -1,
    high = percentile(sorted, 0.9) ?? 1;
  for (let i = 0; i <= 80; i++) {
    const threshold = low + ((high - low || 1) * i) / 80;
    curve.push({ threshold, omega: omega(values, threshold) });
  }
  const baseline = empiricalOutcomes(values),
    outcomes = probabilityBox(baseline, lab.probabilityBox),
    kelly = solveKelly(outcomes, lab.alpha, lab.beta);
  let worstWindow: { from: string; to: string; es: number; drawdown: number } | null = null;
  const width = Math.min(30, n);
  for (let i = 0; width > 0 && i <= n - width; i++) {
    let equity = 0,
      peak = 0,
      dd = 0;
    for (let j = i; j < i + width; j++) {
      equity += values[j];
      peak = Math.max(peak, equity);
      dd = Math.max(dd, peak - equity);
    }
    if (!worstWindow || dd > worstWindow.drawdown)
      worstWindow = {
        from: rows[i].closeTime,
        to: rows[i + width - 1].closeTime,
        es: tailRisk(values.slice(i, i + width))!.es,
        drawdown: dd,
      };
  }
  let trials = 0,
    breaches975 = 0,
    breaches99 = 0;
  for (let i = 40; i < n; i++) {
    const previous = values.slice(Math.max(0, i - 100), i);
    trials++;
    if (-values[i] > tailRisk(previous)!.var) breaches975++;
    if (-values[i] > tailRisk(previous, 0.99)!.var) breaches99++;
  }
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const a = grouped.get(row.setup) ?? [];
    a.push(row.r);
    grouped.set(row.setup, a);
  }
  const groups = [...grouped].map(([setup, x]) => {
    const t = tailRisk(x)!;
    return {
      setup,
      n: x.length,
      mean: average(x),
      omega: omega(x, lab.omegaThreshold),
      omegaZero: omega(x, 0),
      es: t.es,
      gap: t.es - t.var,
    };
  });
  const wins = values.filter((x) => x > 0),
    losses = values.filter((x) => x < 0),
    winRate = n ? wins.length / n : null,
    payoff = losses.length && wins.length ? average(wins) / -average(losses) : null;
  return {
    n,
    excluded: observations.length - n,
    rows,
    values,
    stats,
    mean: n ? mu : null,
    omega: omega(values, lab.omegaThreshold),
    curve,
    tail,
    var99,
    worstWindow,
    backtest: { n: trials, breaches975, breaches99 },
    groups,
    kelly,
    winRate,
    payoff,
    dailyTail: tailRisk(completeDays.map((d) => d.net)),
    excludedDays: days.size - completeDays.length,
    planned: rows
      .filter((o) => o.plannedRR !== undefined)
      .map((o) => ({ id: o.id, planned: o.plannedRR!, actual: o.r })),
    stressedEs: tail ? tail.es * Math.sqrt(lab.liquidityDays / 10) : null,
  };
}
function random(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sampler(outcomes: Outcome[], rng: () => number) {
  const cumulative = new Float64Array(outcomes.length);
  let s = 0;
  outcomes.forEach((o, i) => {
    s += o.p;
    cumulative[i] = s;
  });
  return () => {
    const u = rng() * s;
    let a = 0,
      b = cumulative.length - 1;
    while (a < b) {
      const m = (a + b) >>> 1;
      if (u < cumulative[m]) b = m;
      else a = m + 1;
    }
    return outcomes[a].r;
  };
}
export function wilsonRate(k: number, n: number) {
  if (!n) return { rate: 0, low: 0, high: 1 };
  const z = 1.95996398454,
    p = k / n,
    d = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / d,
    h = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / d;
  return { rate: p, low: Math.max(0, c - h), high: Math.min(1, c + h) };
}
export function simulateCapital(values: number[], input: CapitalLab) {
  const s = capitalLabSchema.parse(input),
    started = performance.now(),
    rng = random(s.seed);
  const base =
    s.model === 'binary'
      ? [
          { r: s.payoff, p: s.winRate },
          { r: -1, p: 1 - s.winRate },
        ]
      : empiricalOutcomes(values);
  if (!base.length) throw Error('Cần lệnh có Net và 1R hoặc chọn mô hình hai kết quả.');
  const outcomes = probabilityBox(base, s.probabilityBox),
    draw = sampler(outcomes, rng),
    f = s.riskPercent / 100;
  const cut = s.model === 'binary' ? 1 : (tailRisk(values)?.var ?? 1);
  const next = () => {
    const r = draw();
    return (r < 0 && -r >= cut ? r * s.tailFactor : r) - s.extraCostR;
  };
  const grid = new Float64Array((s.steps + 1) * s.paths),
    end = new Float64Array(s.paths),
    dds = new Float64Array(s.paths),
    takes = new Float64Array(s.paths);
  let ruins = 0,
    ddBreaches = 0,
    passed = 0,
    failed = 0,
    timeouts = 0,
    payoutFailed = 0;
  const floor = (peak: number) =>
    s.floorMode === 'static'
      ? s.capital * (1 - s.totalLimit / 100)
      : s.floorMode === 'trailing-locked'
        ? Math.min(s.capital, peak - (s.capital * s.totalLimit) / 100)
        : peak - (s.capital * s.totalLimit) / 100;
  for (let p = 0; p < s.paths; p++) {
    let wealth = s.capital,
      peak = wealth,
      maxDD = 0,
      min = wealth,
      prop = s.capital,
      propPeak = prop,
      dayOpen = prop,
      status = 0;
    grid[p] = wealth;
    const injection = Math.floor(s.steps / 4);
    for (let i = 0; i < s.steps; i++) {
      const r =
        i >= injection && i < injection + s.losingStreak
          ? -1 * s.tailFactor - s.extraCostR
          : next();
      wealth = Math.max(0, wealth * (1 + f * r));
      peak = Math.max(peak, wealth);
      min = Math.min(min, wealth);
      maxDD = Math.max(maxDD, (peak - wealth) / peak);
      grid[(i + 1) * s.paths + p] = wealth;
      if (!status) {
        if (i % s.tradesPerDay === 0) dayOpen = prop;
        prop = Math.max(0, prop * (1 + f * r));
        propPeak = Math.max(propPeak, prop);
        if (prop <= floor(propPeak) || prop <= dayOpen - (s.capital * s.dailyLimit) / 100)
          status = -1;
        else if (
          prop >= s.capital * (1 + s.targetPercent / 100) &&
          Math.floor(i / s.tradesPerDay) + 1 >= s.minDays
        )
          status = 1;
      }
    }
    if (min <= s.capital * s.alpha) ruins++;
    if (maxDD >= s.totalLimit / 100) ddBreaches++;
    if (status === 1) {
      passed++;
      let funded = s.capital,
        fp = funded,
        day = funded,
        ok = true;
      for (let i = 0; i < s.payoutDays * s.tradesPerDay; i++) {
        if (i % s.tradesPerDay === 0) day = funded;
        funded = Math.max(0, funded * (1 + f * next()));
        fp = Math.max(fp, funded);
        if (funded <= floor(fp) || funded <= day - (s.capital * s.dailyLimit) / 100) {
          ok = false;
          break;
        }
      }
      if (ok) takes[p] = (Math.max(0, funded - s.capital) * s.split) / 100;
      else payoutFailed++;
    } else if (status === -1) failed++;
    else timeouts++;
    end[p] = wealth;
    dds[p] = maxDD;
  }
  const fan = [];
  for (let i = 0; i <= s.steps; i++) {
    const x = grid.slice(i * s.paths, (i + 1) * s.paths).sort();
    fan.push({
      step: i,
      p5: percentile(x, 0.05)!,
      p25: percentile(x, 0.25)!,
      p50: percentile(x, 0.5)!,
      p75: percentile(x, 0.75)!,
      p95: percentile(x, 0.95)!,
    });
  }
  end.sort();
  dds.sort();
  takes.sort();
  const take = percentile(takes, 0.5)!;
  const positive = Array.from(takes).filter((x) => x > 0),
    conditional = percentile(positive, 0.5);
  const heatmap = [];
  const centerP =
    s.model === 'binary'
      ? s.winRate
      : values.length
        ? values.filter((x) => x > 0).length / values.length
        : 0.5;
  const wins = values.filter((x) => x > 0),
    losses = values.filter((x) => x < 0);
  const centerB =
    s.model === 'binary'
      ? s.payoff
      : wins.length && losses.length
        ? average(wins) / -average(losses)
        : s.payoff;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const p = Math.min(0.99, Math.max(0.01, centerP + (y - 3) * 0.05)),
        b = Math.max(0.1, centerB + (x - 3) * 0.25),
        hrng = random(s.seed),
        hd = sampler(
          [
            { r: b, p },
            { r: -1, p: 1 - p },
          ],
          hrng,
        );
      let hits = 0;
      for (let j = 0; j < 400; j++) {
        let w = 1;
        for (let i = 0; i < Math.min(s.steps, 250); i++) {
          w = Math.max(0, w * (1 + f * hd()));
          if (w <= s.alpha) {
            hits++;
            break;
          }
        }
      }
      heatmap.push({ p, b, rate: hits / 400 });
    }
  return {
    config: s,
    fan,
    median: percentile(end, 0.5),
    p5: percentile(end, 0.05),
    p95: percentile(end, 0.95),
    mddMedian: percentile(dds, 0.5),
    mddP95: percentile(dds, 0.95),
    ruin: wilsonRate(ruins, s.paths),
    ddBreach: wilsonRate(ddBreaches, s.paths),
    prop: {
      passed,
      failed,
      timeouts,
      payoutFailed,
      passRate: passed / s.paths,
      takeHome: take,
      roi: s.challengeFee > 0 ? ((take - s.challengeFee) / s.challengeFee) * 100 : null,
      breakEvenCycles:
        s.challengeFee > 0 && conditional && conditional > 0
          ? Math.ceil(s.challengeFee / conditional)
          : null,
    },
    heatmap,
    elapsedMs: performance.now() - started,
    injected: Math.min(s.losingStreak, s.steps - Math.floor(s.steps / 4)),
  };
}
export type CapitalReport = ReturnType<typeof capitalReport>;
export type CapitalSimulation = ReturnType<typeof simulateCapital>;
