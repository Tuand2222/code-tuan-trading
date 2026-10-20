import { formatInTimeZone } from 'date-fns-tz';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import type { Trade, Journal, Dec, CashFlow } from '../data/schema';
import { tradeFacts, type TradeFacts, type TradeEvent } from './trade';
import { D, dec, sum, ratio, number } from './money';
import { wilson, bootstrap } from './stats/inference';
export interface Metric {
  value: Dec | null;
  n: number;
  of: number;
  reason?: string;
}
export interface Scope {
  from?: string;
  to?: string;
  setupId?: string;
}
export const dayInZone = (ts: string, tz: string) =>
  formatInTimeZone(new Date(ts), tz, 'yyyy-MM-dd');
const mean = (values: Dec[]) => (values.length ? dec(D(sum(values)).div(values.length)) : null);
export function analyze(
  journal: Journal,
  trades: Trade[],
  scope: Scope = {},
  cashFlows: CashFlow[] = [],
) {
  const inRange = (ts: string) => {
    const day = dayInZone(ts, journal.timezone);
    return (!scope.from || day >= scope.from) && (!scope.to || day <= scope.to);
  };
  const all = trades
    .filter((t) => t.journalId === journal.id && (!scope.setupId || t.setupId === scope.setupId))
    .map(tradeFacts);
  const closed = all
    .filter((f) => f.closeTime && inRange(f.closeTime))
    .sort((a, b) => a.closeTime!.localeCompare(b.closeTime!) || a.id.localeCompare(b.id));
  const events = all
    .flatMap((f) => f.events)
    .filter((e) => inRange(e.time))
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const n = closed.length,
    known = closed.every((f) => f.net !== undefined),
    valid = closed.filter((f) => f.r !== undefined),
    reviewed = closed.filter((f) => f.trade.review.done && f.trade.disciplineLegacy !== undefined);
  const wins = closed.filter((f) => f.net !== undefined && D(f.net).gt(0)),
    losses = closed.filter((f) => f.net !== undefined && D(f.net).lt(0));
  const gp = sum(wins.map((f) => f.net!)),
    gl = sum(losses.map((f) => f.net!)),
    net = events.every((e) => e.net !== undefined) ? sum(events.map((e) => e.net!)) : null;
  const metric = (value: Dec | number | null, count = n, of = n, reason?: string): Metric => ({
    value: value === null ? null : String(value),
    n: count,
    of,
    ...(reason ? { reason } : {}),
  });
  const every = (value: Dec | number | null) => metric(n && known ? value : null);
  let current = 0,
    longestWin = 0,
    longestLoss = 0;
  for (const f of closed) {
    const sign = f.net === undefined || D(f.net).isZero() ? 0 : D(f.net).gt(0) ? 1 : -1;
    current = sign === 0 ? 0 : Math.sign(current) === sign ? current + sign : sign;
    longestWin = Math.max(longestWin, current);
    longestLoss = Math.max(longestLoss, -current);
  }
  let equity = D('0'),
    peak = D('0'),
    drawdown = D('0'),
    shadow = D('0'),
    unknown = false,
    shadowUnknown = false;
  const violationIds = new Set(
    all
      .filter(
        (f) =>
          f.trade.review.done &&
          ((f.trade.disciplineLegacy ?? 100) < 80 || f.trade.errorTagIds.length > 0),
      )
      .map((f) => f.id),
  );
  const curve = events.map((e) => {
    if (e.net === undefined) unknown = true;
    else equity = equity.plus(D(e.net));
    if (equity.gt(peak)) peak = equity;
    if (peak.minus(equity).gt(drawdown)) drawdown = peak.minus(equity);
    if (!violationIds.has(e.tradeId)) {
      if (e.net === undefined) shadowUnknown = true;
      else shadow = shadow.plus(D(e.net));
    }
    return {
      time: e.time,
      tradeId: e.tradeId,
      net: unknown ? null : dec(equity),
      shadow: shadowUnknown ? null : dec(shadow),
      drawdown: unknown ? null : dec(peak.minus(equity)),
    };
  });
  const allNet = closed.map((f) => f.net ?? '0'),
    average = mean(allNet),
    sd = n ? Math.sqrt(allNet.reduce((s, v) => s + (number(v) - Number(average)) ** 2, 0) / n) : 0;
  const durations = closed.filter((f) => f.holdMinutes !== undefined);
  const metrics: Record<string, Metric> = {
    total: metric(n),
    wins: every(wins.length),
    losses: every(losses.length),
    breakeven: every(n - wins.length - losses.length),
    winRate: metric(
      known && wins.length + losses.length
        ? dec(
            D(String(wins.length))
              .div(wins.length + losses.length)
              .mul(100),
          )
        : null,
      wins.length + losses.length,
      n,
    ),
    profitFactor: every(!D(gl).isZero() ? (ratio(gp, dec(D(gl).abs())) ?? null) : null),
    averageR: metric(mean(valid.map((f) => f.r!)), valid.length),
    avgWin: metric(known ? mean(wins.map((f) => f.net!)) : null, wins.length),
    avgLoss: metric(known ? mean(losses.map((f) => f.net!)) : null, losses.length),
    expectancy: every(average),
    net: metric(events.length ? net : null, events.length, events.length),
    currentStreak: every(current),
    longestWin: every(longestWin),
    longestLoss: every(longestLoss),
    maxDrawdown: metric(
      !unknown && events.length >= 2 ? dec(drawdown) : null,
      events.length,
      events.length,
    ),
    recovery: metric(
      !unknown && events.length >= 2 && net !== null ? (ratio(net, dec(drawdown)) ?? null) : null,
      events.length,
      events.length,
    ),
    sharpe: every(sd ? String(Number(average) / sd) : null),
    avgDuration: metric(
      durations.length
        ? String(durations.reduce((s, f) => s + f.holdMinutes!, 0) / durations.length)
        : null,
      durations.length,
    ),
    biggestWin: metric(
      known && wins.length
        ? wins.reduce((a, f) => (D(f.net!).gt(D(a)) ? f.net! : a), wins[0].net!)
        : null,
      wins.length,
    ),
    biggestLoss: metric(
      known && losses.length
        ? losses.reduce((a, f) => (D(f.net!).lt(D(a)) ? f.net! : a), losses[0].net!)
        : null,
      losses.length,
    ),
    grossProfit: every(gp),
    grossLoss: every(gl),
    roi: metric(
      valid.length
        ? dec(
            D(sum(valid.map((f) => f.net!)))
              .div(D(sum(valid.map((f) => f.risk!))))
              .mul(100),
          )
        : null,
      valid.length,
    ),
    discipline: metric(
      mean(reviewed.map((f) => String(f.trade.disciplineLegacy!))),
      reviewed.length,
    ),
  };
  if (known && n && D(gl).isZero() && D(gp).gt(0)) metrics.profitFactor.reason = 'no-losses';
  const groups = new Map<string, TradeEvent[]>();
  for (const e of events) {
    const day = dayInZone(e.time, journal.timezone);
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  const days = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, es]) => ({
      date,
      net: es.every((e) => e.net !== undefined) ? sum(es.map((e) => e.net!)) : null,
      events: es.length,
      closed: closed.filter((f) => dayInZone(f.closeTime!, journal.timezone) === date).length,
      wins: wins.filter((f) => dayInZone(f.closeTime!, journal.timezone) === date).length,
      losses: losses.filter((f) => dayInZone(f.closeTime!, journal.timezone) === date).length,
    }));
  const period = (key: (date: string) => string) => {
    const keys = [...new Set(days.map((d) => key(d.date)))];
    return keys.map((label) => {
      const ds = days.filter((d) => key(d.date) === label),
        cs = closed.filter((f) => key(dayInZone(f.closeTime!, journal.timezone)) === label);
      return {
        label,
        net: ds.every((d) => d.net !== null) ? sum(ds.map((d) => d.net!)) : null,
        events: ds.reduce((s, d) => s + d.events, 0),
        closed: cs.length,
        reviewed: cs.filter((f) => f.trade.review.done).length,
      };
    });
  };
  const weeks = period((date) => {
    const d = new Date(date + 'T12:00:00Z');
    return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
  });
  const carrying = (key: 'funding' | 'swap', sign: 1 | -1) =>
    sum(
      events
        .filter((e) => (sign === 1 ? D(e.costs[key]).gt(0) : D(e.costs[key]).lt(0)))
        .map((e) => e.costs[key]),
    );
  const gross = sum(events.map((e) => e.gross)),
    cost = sum(events.map((e) => e.cost)),
    feeComplete = events.every((e) => e.net !== undefined);
  const reviewedWins = wins.filter((f) => f.trade.review.done).length,
    reviewedLosses = losses.filter((f) => f.trade.review.done).length;
  const reviewGap =
    wins.length && losses.length
      ? Math.abs(reviewedWins / wins.length - reviewedLosses / losses.length) * 100
      : 0;
  const queue = balancedQueue(closed);
  const inference = (fs: TradeFacts[]) => {
    const rs = fs.filter((f) => f.r !== undefined).map((f) => number(f.r!)),
      w = fs.filter((f) => f.net !== undefined && D(f.net).gt(0)).length,
      l = fs.filter((f) => f.net !== undefined && D(f.net).lt(0)).length;
    return {
      n: rs.length,
      of: fs.length,
      mean: mean(fs.filter((f) => f.r !== undefined).map((f) => f.r!)),
      ci: bootstrap(rs),
      winCI: wilson(w, w + l),
      winRate: w + l ? (w / (w + l)) * 100 : null,
      profitFactor: l
        ? ratio(
            sum(fs.filter((f) => f.net !== undefined && D(f.net).gt(0)).map((f) => f.net!)),
            dec(
              D(
                sum(fs.filter((f) => f.net !== undefined && D(f.net).lt(0)).map((f) => f.net!)),
              ).abs(),
            ),
          )
        : null,
    };
  };
  const positive = [...wins].sort((a, b) => D(b.net!).cmp(D(a.net!)));
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const f of valid) {
    const r = D(f.r!);
    buckets[r.lte(-1) ? 0 : r.lt(0) ? 1 : r.lt(1) ? 2 : r.lt(2) ? 3 : r.lt(3) ? 4 : 5]++;
  }
  const starting = journal.startingBalance,
    flows = cashFlows.filter((f) => f.journalId === journal.id && inRange(f.date)),
    flowNet = sum(flows.map((f) => (f.type === 'deposit' ? f.amount : dec(D(f.amount).neg()))));
  return {
    metrics,
    closed,
    open: all.filter((f) => !f.closeTime),
    events,
    days,
    curve,
    weeks,
    months: period((date) => date.slice(0, 7)),
    currentDrawdown: curve.at(-1)?.drawdown ?? null,
    meanRisk: mean(valid.map((f) => f.risk!)),
    rBuckets: buckets,
    top5ProfitShare:
      known && D(gp).gt(0)
        ? dec(
            D(sum(positive.slice(0, 5).map((f) => f.net!)))
              .div(D(gp))
              .mul(100),
          )
        : null,
    fees: {
      gross,
      net,
      cost,
      commissionAndTax: sum(events.map((e) => sum([e.costs.commission, e.costs.tax]))),
      carryingPaid: sum([carrying('funding', 1), carrying('swap', 1)]),
      carryingReceived: dec(D(sum([carrying('funding', -1), carrying('swap', -1)])).neg()),
      complete: feeComplete,
      erosion:
        feeComplete && D(gross).gt(0) && D(cost).gt(0) ? dec(D(cost).div(D(gross)).mul(100)) : null,
    },
    shadow: {
      excluded: closed.filter((f) => violationIds.has(f.id)).length,
      reviewed: closed.filter((f) => f.trade.review.done).length,
      total: n,
      reviewedWins,
      reviewedLosses,
      reviewGap,
      bias: reviewGap > 15,
      label: 'HYPOTHETICAL',
    },
    queue,
    overall: inference(closed),
    rolling: [20, 50, 100].map((window) => ({ window, ...inference(closed.slice(-window)) })),
    setups: [...new Set(closed.map((f) => f.trade.setupId ?? ''))].map((setupId) => {
      const fs = closed.filter((f) => (f.trade.setupId ?? '') === setupId);
      return {
        setupId,
        count: fs.length,
        reviewed: fs.filter((f) => f.trade.review.done).length,
        ...inference(fs),
      };
    }),
    balance: starting !== undefined && net !== null ? sum([starting, flowNet, net]) : null,
  };
}
export function balancedQueue(closed: TradeFacts[]) {
  const remaining = closed.filter((f) => !f.trade.review.done),
    queue: TradeFacts[] = [];
  const wins = closed.filter((f) => f.net !== undefined && D(f.net).gt(0)),
    losses = closed.filter((f) => f.net !== undefined && D(f.net).lt(0));
  let rw = wins.filter((f) => f.trade.review.done).length,
    rl = losses.filter((f) => f.trade.review.done).length;
  while (remaining.length) {
    const winFirst = !losses.length || (!!wins.length && rw / wins.length <= rl / losses.length);
    const rank = (positive: boolean) =>
      remaining
        .filter((f) => f.net !== undefined && (positive ? D(f.net).gt(0) : D(f.net).lt(0)))
        .sort(
          (a, b) =>
            D(b.r ?? '0')
              .abs()
              .cmp(D(a.r ?? '0').abs()) ||
            a.closeTime!.localeCompare(b.closeTime!) ||
            a.id.localeCompare(b.id),
        );
    const next = rank(winFirst)[0] ?? rank(!winFirst)[0] ?? remaining[0];
    queue.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    if (next.net !== undefined && D(next.net).gt(0)) rw++;
    else if (next.net !== undefined && D(next.net).lt(0)) rl++;
  }
  return queue;
}
