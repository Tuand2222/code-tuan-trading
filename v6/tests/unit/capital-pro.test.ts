import { it, expect } from 'vitest';
import {
  omega,
  tailRisk,
  solveKelly,
  logRiskMoment,
  probabilityBox,
  capitalProtection,
  capitalReport,
  simulateCapital,
  recoveryGain,
  fixedStakeRuin,
} from '../../src/core/capitalPro';
import { defaultCapitalLab, journalCapitalSettings } from '../../src/data/capitalSettings';
import { DEFAULT_RISK } from '../../../lib/risk-analytics';
import type { QuantObservation } from '../../src/core/quantLab';
import { migrateV3 } from '../../src/data/migrateV3';
import { accountObservations } from '../../src/core/capitalPro';
import { observeTrades } from '../../src/core/quantLab';
import original from '../golden/fixture-30-trades.json';
const row = (r: number, id = 'x'): QuantObservation => ({
  id,
  symbol: 'TEST',
  market: 'stocks',
  setup: 's',
  openTime: '2026-10-24T00:00:00Z',
  closeTime: '2026-10-24T01:00:00Z',
  gross: String(r * 100),
  net: String(r * 100),
  risk: '100',
  mae: null,
  mfe: null,
});
it('daily tails use the account calendar, reject an incomplete day and keep only evidenced plans', () => {
  const r = capitalReport(
    [
      { ...row(-1, 'a'), closeTime: '2026-10-23T18:00:00Z', plannedRR: 2 },
      { ...row(2, 'b'), closeTime: '2026-10-24T03:00:00Z' },
      { ...row(-5, 'c'), closeTime: '2026-10-25T01:00:00Z' },
      { ...row(2, 'missing'), closeTime: '2026-10-25T02:00:00Z', net: null },
    ],
    defaultCapitalLab(),
    'Asia/Ho_Chi_Minh',
  );
  expect(r.dailyTail?.n).toBe(1);
  expect(r.dailyTail?.es).toBe(-100);
  expect(r.excludedDays).toBe(1);
  expect(r.planned).toEqual([{ id: 'a', planned: 2, actual: -1 }]);
});
it('partial realized exits count toward the capital veto without entering the closed-position sample', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  const t = {
    ...data.trades[0],
    status: 'open' as const,
    initialRisk: '100',
    legs: [
      { id: 'in', kind: 'in' as const, time: '2026-10-24T00:00:00Z', price: '100', quantity: '2' },
      { id: 'out', kind: 'out' as const, time: '2026-10-24T01:00:00Z', price: '90', quantity: '1' },
    ],
    costs: { commission: '0', tax: '0', funding: '0', swap: '0', other: '0' },
    costsKnown: true,
  };
  expect(observeTrades([t])).toHaveLength(0);
  expect(
    capitalProtection(accountObservations([t]), { ...DEFAULT_RISK, initialCapital: 1000 }).net,
  ).toBe(-10);
});
it('Omega uses net outcomes once, crosses one at their mean and decreases with the threshold', () => {
  const x = [-2, -1, 1, 3, 4],
    mean = 1;
  expect(omega(x, 0)).toBe(8 / 3);
  expect(omega(x, mean)).toBe(1);
  expect(omega(x, -1)!).toBeGreaterThan(omega(x, 0)!);
  expect(omega([1, 2], 0)).toBe(Infinity);
  expect(omega([0, 0], 0)).toBeNull();
  expect(omega([], 0)).toBeNull();
});
it('ES weights the fractional tail and keeps the empirical inverse CDF convention', () => {
  const x = Array.from({ length: 100 }, (_, i) => -(i + 1));
  const t = tailRisk(x)!;
  expect(t.var).toBe(98);
  expect(t.es).toBeCloseTo(99.2, 10);
  expect(t.tailMass).toBeCloseTo(2.5);
  expect(tailRisk([-3, -2, -1])!.es).toBe(3);
  expect(tailRisk([1, 2, 3])!.es).toBe(-1);
  expect(tailRisk([])).toBeNull();
});
it('solves the Stanford binary fixture and maintains feasibility for gaps larger than 1R', () => {
  const o = [
      { r: 1, p: 0.55 },
      { r: -1, p: 0.45 },
    ],
    k = solveKelly(o, 0.8, 0.05);
  expect(k.full).toBeCloseTo(0.1, 10);
  expect(k.rck).toBeCloseTo(0.01390750244995026, 10);
  expect(k.lambda).toBeCloseTo(13.425134878, 9);
  expect(logRiskMoment(o, k.rck, k.lambda)).toBeLessThanOrEqual(1e-10);
  const gap = [
      { r: 5, p: 0.7 },
      { r: -4, p: 0.3 },
    ],
    g = solveKelly(gap, 0.8, 0.01);
  expect(g.full).toBeLessThan(0.25);
  expect(g.rck).toBeLessThanOrEqual(g.full);
  expect(gap.every((x) => 1 + g.rck * x.r > 0)).toBe(true);
  expect(
    solveKelly([
      { r: 1, p: 0.4 },
      { r: -1, p: 0.6 },
    ]).rck,
  ).toBe(0);
});
it('tightening the probability bound does not increase the RCK fraction', () => {
  const o = [
      { r: 2, p: 0.5 },
      { r: -1, p: 0.5 },
    ],
    loose = solveKelly(o, 0.8, 0.1),
    tight = solveKelly(o, 0.8, 0.01);
  expect(tight.rck).toBeLessThan(loose.rck);
  expect(solveKelly(o, 0.9, 0.1).rck).toBeLessThan(loose.rck);
});
it('the probability box preserves mass and moves probability toward the worst outcomes', () => {
  const o = [
      { r: -2, p: 0.2 },
      { r: 0, p: 0.3 },
      { r: 3, p: 0.5 },
    ],
    b = probabilityBox(o, 0.25);
  expect(b.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1, 12);
  expect(b.find((x) => x.r === -2)!.p).toBeGreaterThan(0.2);
  for (const x of b) {
    const original = o.find((a) => a.r === x.r)!;
    expect(x.p).toBeGreaterThanOrEqual(original.p * 0.75 - 1e-12);
    expect(x.p).toBeLessThanOrEqual(original.p * 1.25 + 1e-12);
  }
});
it('uses the entire account for the capital veto, including unknown costs and the stop boundary', () => {
  const settings = {
    ...DEFAULT_RISK,
    initialCapital: 1000,
    dailyLossPercent: 50,
    defensivePercent: 5,
    stopPercent: 15,
    maxDrawdownPercent: 20,
  };
  expect(
    capitalProtection([{ ...row(-1.5), net: '-150' }], settings, new Date('2026-10-24T12:00:00Z'))
      .tier,
  ).toBe('stop');
  expect(capitalProtection([{ ...row(1), net: null }], settings).ceiling).toBe(0);
  expect(capitalProtection([row(1)], DEFAULT_RISK).ceiling).toBe(0);
  expect(recoveryGain(0.2)).toBe(0.25);
  expect(recoveryGain(0.5)).toBe(1);
  expect(recoveryGain(1)).toBeNull();
});
it('analytical ruin is restricted to the fixed-cash integer payoff model', () => {
  expect(fixedStakeRuin(0.6, 1, 5)).toBeCloseTo((0.4 / 0.6) ** 5, 10);
  expect(fixedStakeRuin(0.4, 1, 10)).toBe(1);
  expect(fixedStakeRuin(0.6, 1.5, 5)).toBeNull();
});
it('does not fill missing risk or fees and backtests only against earlier observations', () => {
  const obs = Array.from({ length: 41 }, (_, i) =>
    row(i === 40 ? -10 : 1, String(i).padStart(2, '0')),
  );
  const r = capitalReport([...obs, { ...row(1, 'missing'), risk: null }], defaultCapitalLab());
  expect(r.n).toBe(41);
  expect(r.excluded).toBe(1);
  expect(r.backtest.n).toBe(1);
  expect(r.backtest.breaches975).toBe(1);
});
it('keeps cash flow dates in the journal timezone and excludes transfers from trading profit', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  const j = { ...data.journals[0], startingBalance: '1000', timezone: 'Asia/Ho_Chi_Minh' };
  const settings = journalCapitalSettings(j, [
    { id: 'f', journalId: j.id, date: '2026-10-23T20:00:00Z', type: 'deposit', amount: '500' },
  ]);
  expect(settings.cashFlows?.[0].date).toBe('2026-10-24');
  const a = capitalProtection([], settings, new Date('2026-10-24T12:00:00Z'));
  expect(a.balance).toBe(1500);
  expect(a.net).toBe(0);
});
it('simulation is seeded, runs the stated path count, orders fan bands and leaves inputs untouched', () => {
  const values = [-1, 1, 2],
    copy = [...values],
    s = { ...defaultCapitalLab(), steps: 20, losingStreak: 10 };
  const a = simulateCapital(values, s),
    b = simulateCapital(values, s);
  expect(a.fan).toEqual(b.fan);
  expect(a.prop).toEqual(b.prop);
  expect(a.injected).toBe(10);
  expect(a.prop.passed + a.prop.failed + a.prop.timeouts).toBe(1000);
  expect(
    a.fan.every((p) => p.p5 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p95),
  ).toBe(true);
  expect(values).toEqual(copy);
  expect(a.ruin.high).toBeGreaterThan(a.ruin.rate);
  expect(a.prop.roi).toBeNull();
});
it('zero risk keeps every path flat and yields no ruin or drawdown', () => {
  const s = { ...defaultCapitalLab(), steps: 20, riskPercent: 0, losingStreak: 10 };
  const r = simulateCapital([-1, 2], s);
  expect(r.fan.every((x) => x.p5 === s.capital && x.p95 === s.capital)).toBe(true);
  expect(r.mddP95).toBe(0);
  expect(r.ruin.rate).toBe(0);
  expect(r.ruin.high).toBeGreaterThan(0);
});
