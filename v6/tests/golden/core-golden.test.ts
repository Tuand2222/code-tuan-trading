import { beforeAll, expect, it } from 'vitest';
import original from './fixture-30-trades.json';
import expected from './golden.expected.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { analyze, dayInZone } from '../../src/core/analyze';
import { D } from '../../src/core/money';
import { tradeFacts } from '../../src/core/trade';
import { wilson } from '../../src/core/stats/inference';
import type { Snapshot } from '../../src/data/snapshot';
let data: Snapshot, result: ReturnType<typeof analyze>;
const near = (a: string | number | null | undefined, b: number, tolerance = 0.005) => {
  expect(a).not.toBeNull();
  expect(a).not.toBeUndefined();
  expect(D(String(a)).minus(String(b)).abs().lte(String(tolerance)), `${a} vs ${b}`).toBe(true);
};
beforeAll(async () => {
  data = (await migrateV3(JSON.stringify(original))).data;
  result = analyze(data.journals[0], data.trades);
});
it('4.1: derives the full KPI set with original precision and explicit source time unit', () => {
  for (const [key, value] of Object.entries(expected.summary)) {
    if (!result.metrics[key]) continue;
    near(
      result.metrics[key].value,
      value,
      [
        'total',
        'wins',
        'losses',
        'breakeven',
        'longestWin',
        'longestLoss',
        'currentStreak',
      ].includes(key)
        ? 0
        : ['winRate', 'discipline'].includes(key)
          ? 0.05
          : [
                'grossProfit',
                'grossLoss',
                'avgWin',
                'avgLoss',
                'net',
                'expectancy',
                'maxDrawdown',
                'biggestWin',
                'biggestLoss',
              ].includes(key)
            ? 0.5
            : 0.005,
    );
  }
  near(result.currentDrawdown, expected.summary.currentDrawdown, 0);
  near(result.meanRisk, expected.summary.meanRisk, 0.5);
  near(result.top5ProfitShare, expected.summary.top5ProfitShare, 0.05);
  near(result.metrics.avgDuration.value, expected.holding.observedMeanMinutes, 0.000000001);
  near(Number(result.metrics.avgDuration.value) / 60, 3.9055555555555554, 0.000000001);
});
it('4.2–4.4: reconciles Gross → fees → Net, R buckets, every October day/week/month', () => {
  near(result.fees.gross, 4330000, 0);
  near(result.fees.commissionAndTax, 1027710, 0);
  near(result.fees.net, 3302290, 0);
  near(result.fees.carryingPaid, 0, 0);
  near(result.fees.carryingReceived, 0, 0);
  near(result.fees.erosion, 23.73, 0.05);
  expect(result.fees.complete).toBe(true);
  expect(result.rBuckets).toEqual([8, 4, 6, 7, 5, 0]);
  expect(
    result.months.map((m) => ({ month: m.label, net: Number(m.net), events: m.events })),
  ).toEqual(expected.months);
  expect(
    Object.fromEntries(
      result.days.filter((d) => d.date.startsWith('2026-10')).map((d) => [d.date, Number(d.net)]),
    ),
  ).toEqual(expected.octoberDays);
  for (const w of expected.octoberWeeks)
    near(
      result.days
        .filter((d) => d.date >= w.from && d.date <= w.to)
        .reduce((s, d) => s + Number(d.net), 0),
      w.net,
      0,
    );
  expect(result.weeks.find((w) => w.label === '2026-W42')).toMatchObject({
    closed: 5,
    events: 5,
    net: '143950',
    reviewed: 4,
  });
});
it('4.5 and T-R1: retains seven violations, original 24 reviews and correct bias transitions', () => {
  expect(result.shadow).toMatchObject({
    excluded: 7,
    reviewed: 24,
    reviewedWins: 12,
    reviewedLosses: 12,
    bias: true,
  });
  expect(result.queue).toHaveLength(6);
  for (const p of expected.pendingTrades) {
    const f = result.queue.find(
      (f) =>
        f.trade.symbol === p.symbol &&
        dayInZone(f.closeTime!, data.journals[0].timezone) === p.date,
    )!;
    near(f.net, p.net, 0);
    near(f.r, p.r);
  }
  for (const s of expected.reviewScenarios) {
    const trades = structuredClone(data.trades),
      ids = result.queue.slice(0, s.additionalWins).map((f) => f.id);
    trades.forEach((t) => {
      if (ids.includes(t.id)) t.review.done = true;
    });
    const analysis = analyze(data.journals[0], trades);
    near(analysis.shadow.reviewGap, s.gapPoints, 0.00000001);
    expect(analysis.shadow.bias).toBe(s.warning);
  }
});
it('4.6–4.8: matches setup and rolling statistics, seeded confidence intervals and VCB facts', () => {
  for (const e of expected.setups) {
    const setup = data.setups.find((s) => s.name === e.name)!,
      s = result.setups.find((s) => s.setupId === setup.id)!;
    expect(s).toMatchObject({ count: e.count, reviewed: e.reviewed });
    near(s.winRate, e.winRate, 0.05);
    near(s.profitFactor, e.pf);
    near(s.mean, e.expectancyR);
    s.ci!.forEach((value, i) => near(value, e.ci[i], 0.1));
  }
  for (const e of expected.rolling) {
    const s = result.rolling.find((s) => s.window === e.window)!;
    expect(s.of).toBe(e.available);
    near(s.winRate, e.winRate, 0.05);
    near(s.profitFactor, e.pf);
    near(s.mean, e.expectancyR);
    s.ci!.forEach((value, i) => near(value, e.ci[i], 0.1));
  }
  const f = result.closed.find(
    (f) =>
      f.trade.symbol === 'VCB' &&
      dayInZone(f.closeTime!, data.journals[0].timezone) === '2026-10-13',
  )!;
  near(f.gross, 180000, 0);
  near(f.net, 159620, 0);
  near(f.risk, 200000, 0);
  near(f.r, 0.7981, 0.00005);
  expect(f.trade.disciplineLegacy).toBe(90);
  wilson(18, 30)!.forEach((value, i) => near(value * 100, expected.wilson.all[i], 0.05));
  wilson(6, 10)!.forEach((value, i) => near(value * 100, expected.wilson.setup[i], 0.05));
});
it('roundtrip derivation cannot mutate stored facts or create persistent derived fields', () => {
  const before = JSON.stringify(data);
  data.trades.forEach(tradeFacts);
  analyze(data.journals[0], data.trades);
  expect(JSON.stringify(data)).toBe(before);
  expect(
    data.trades.every(
      (t) => !('net' in t) && !('gross' in t) && !('r' in t) && !('holdMinutes' in t),
    ),
  ).toBe(true);
});
