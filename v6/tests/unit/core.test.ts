import { expect, it } from 'vitest';
import type { Trade, Journal } from '../../src/data/schema';
import { tradeFacts } from '../../src/core/trade';
import { analyze } from '../../src/core/analyze';
const time = '2026-10-01T00:00:00Z';
const journal: Journal = {
  id: 'j',
  name: 'test',
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  isDemo: false,
  settings: {
    minSample: 20,
    holdingUnit: 'hours',
    displayUnit: 'money',
    lossToleranceR: '0.10',
    backupReminderDays: 7,
  },
  createdAt: time,
  schemaVersion: 4,
};
const trade = (id: string, exit = '110'): Trade => ({
  id,
  journalId: 'j',
  symbol: 'FPT',
  market: 'stocks',
  side: 'long',
  status: 'closed',
  legs: [
    { id: id + 'i', kind: 'in', time, price: '100', quantity: '2' },
    { id: id + 'o', kind: 'out', time: '2026-10-02T00:00:00Z', price: exit, quantity: '2' },
  ],
  costs: { commission: '0', tax: '0', funding: '0', swap: '0', other: '0' },
  costsKnown: true,
  errorTagIds: [],
  tags: [],
  starred: false,
  review: { done: false },
  attachments: [],
  customStats: {},
  isDemo: false,
  createdAt: time,
  updatedAt: time,
});
it('computes closed/open quantities, shorts, funding credits and avoids counting leg fees twice', () => {
  const t = trade('t');
  t.side = 'short';
  t.costs.funding = '-5';
  t.legs[1].fee = '100';
  expect(tradeFacts(t)).toMatchObject({
    gross: '-20',
    net: '-15',
    openQty: '0',
    holdMinutes: 1440,
    r: undefined,
  });
  t.initialRisk = '10';
  expect(tradeFacts(t).r).toBe('-1.5');
  const open = { ...trade('x'), status: 'open' as const, legs: [trade('x').legs[0]] };
  expect(tradeFacts(open)).toMatchObject({
    openQty: '2',
    closeTime: undefined,
    holdMinutes: undefined,
  });
  expect(() => tradeFacts({ ...open, status: 'closed' })).toThrow('STATUS_QUANTITY');
});
it('recomputes cost basis after partial closing and adding more, while conserving costs', () => {
  const t = trade('p');
  t.legs = [
    { id: 'a', kind: 'in', time, price: '100', quantity: '2' },
    { id: 'b', kind: 'out', time: '2026-10-02T00:00:00Z', price: '120', quantity: '1' },
    { id: 'c', kind: 'in', time: '2026-10-03T00:00:00Z', price: '200', quantity: '1' },
    { id: 'd', kind: 'out', time: '2026-10-04T00:00:00Z', price: '160', quantity: '2' },
  ];
  t.costs.commission = '1';
  const f = tradeFacts(t);
  expect(f.gross).toBe('40');
  expect(f.net).toBe('39');
  expect(f.events.map((e) => e.gross)).toEqual(['20', '20']);
  expect(() => tradeFacts({ ...t, legs: [{ ...t.legs[1], quantity: '3' }, t.legs[0]] })).toThrow(
    'OVER_CLOSE',
  );
});
it('uses the explicitly approved v6 winrate denominator, keeps unknown R/review absent and isolates journals', () => {
  const a = trade('a'),
    b = trade('b', '90'),
    be = trade('be', '100');
  a.initialRisk = '10';
  a.disciplineLegacy = 80;
  a.review.done = true;
  const r = analyze(journal, [a, b, be, { ...trade('foreign'), journalId: 'other' }]);
  expect(r.metrics.winRate).toMatchObject({ value: '50', n: 2, of: 3 });
  expect(r.metrics.averageR).toMatchObject({ value: '2', n: 1, of: 3 });
  expect(r.metrics.discipline).toMatchObject({ value: '80', n: 1, of: 3 });
  expect(r.metrics.roi).toMatchObject({ value: '200' });
  a.costsKnown = false;
  expect(analyze(journal, [a, b]).metrics.net.value).toBeNull();
});
it('keeps partial realizations on their actual local days and flags review selection bias', () => {
  const t = trade('p');
  t.legs[1].quantity = '1';
  t.legs.push({ ...t.legs[1], id: 'last', time: '2026-10-03T18:00:00Z' });
  const r = analyze(journal, [t]);
  expect(r.days.map((d) => [d.date, d.net, d.closed])).toEqual([
    ['2026-10-02', '10', 0],
    ['2026-10-04', '10', 1],
  ]);
});
it('allocates fee categories to partial realizations even while the position remains open', () => {
  const t = trade('partial');
  t.status = 'open';
  t.legs[1].quantity = '1';
  t.costs = { commission: '4', tax: '2', funding: '-2', swap: '6', other: '0' };
  const r = analyze(journal, [t]);
  expect(r.fees).toMatchObject({
    gross: '10',
    cost: '5',
    commissionAndTax: '3',
    carryingPaid: '3',
    carryingReceived: '1',
  });
  expect(r.events[0].net).toBe('5');
});
