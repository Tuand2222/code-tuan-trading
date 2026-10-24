import { calendarMonth } from '../../src/core/journalSelectors';
import { withTradeFactsCache } from '../../src/core/trade';
import { it, expect } from 'vitest';
import { journalSchema, tradeSchema, feeProfileSchema, type Trade } from '../../src/data/schema';
import { emptySnapshot } from '../../src/data/snapshot';
import {
  previewFIFO,
  commitFIFO,
  rollbackFIFO,
  suggestMapping,
  csvHeaders,
  fifoTotals,
} from '../../src/data/fifoImport';
import { exitAnalysis, monteCarlo } from '../../src/core/advanced';
import { tradeFacts } from '../../src/core/trade';
import { mergeTrades } from '../../src/data/mergeTrades';
import { profileCosts } from '../../src/core/marketRules';
import { behavior, milestones } from '../../src/core/behavior';
const journal = journalSchema.parse({
  id: 'j',
  name: 'USDT',
  currency: 'USDT',
  timezone: 'UTC',
  isDemo: true,
  settings: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  schemaVersion: 4,
});
const header = 'Trade ID,Symbol,Date(UTC),Side,Price,Quantity,Fee,Fee Coin,Funding';
const csv = (rows: string[]) => header + '\n' + rows.join('\n');
const opts = (raw: string) => ({
  broker: 'Binance',
  market: 'crypto' as const,
  multiplier: '1',
  mode: 'spot' as const,
  confirmedZeroCosts: true,
  mapping: suggestMapping(csvHeaders(raw)),
});
const initial = () => ({ ...emptySnapshot(), journals: [journal] });
async function imported(rows: string[]) {
  const raw = csv(rows),
    preview = await previewFIFO(raw, journal, opts(raw), initial());
  return { preview, data: commitFIFO(initial(), preview, 'sample.csv') };
}
const buy = '9,BTCUSDT,2026-01-01 01:00:00,BUY,10,2,0.2,USDT,0';
const sell = '11,BTCUSDT,2026-01-02 01:00:00,SELL,15,1,0.1,USDT,0';
it('FIFO matches partial lots and allocates fees without losing remaining entry fees', async () => {
  const { data } = await imported([buy, sell]);
  expect(data.trades).toHaveLength(2);
  const closed = data.trades.find((t) => t.status === 'closed')!;
  expect(tradeFacts(closed).gross).toBe('5');
  expect(tradeFacts(closed).net).toBe('4.8');
  expect(fifoTotals(data, journal.id).open).toBe('1');
  expect(data.trades.find((t) => t.status === 'open')!.costs.commission).toBe('0.1');
});
it('FIFO uses input row order for equal timestamps rather than lexical fill IDs', async () => {
  const { data } = await imported([
    buy.replace(',2,0.2', ',1,0.1'),
    '10,BTCUSDT,2026-01-01 01:00:00,BUY,20,1,0.1,USDT,0',
    sell.replace(',15,', ',30,'),
  ]);
  expect(tradeFacts(data.trades.find((t) => t.status === 'closed')!).gross).toBe('20');
  expect(data.trades.find((t) => t.status === 'open')!.legs[0].price).toBe('20');
});
it('FIFO rejects foreign currency in every cost column and invalid rows with column evidence', async () => {
  const raw = csv([buy.replace(',USDT,0', ',USDT,1BNB')]);
  const p = await previewFIFO(raw, journal, opts(raw), initial());
  expect(p.errors[0].column).toBe('funding');
  expect(p.data).toBeUndefined();
});
it('FIFO overlapping files remain lossless after rollback and exact file reimport', async () => {
  const a = csv([buy]),
    b = csv([buy, '10,BTCUSDT,2026-01-01 02:00:00,BUY,20,1,0.1,USDT,0']);
  const p = await previewFIFO(a, journal, opts(a), initial()),
    d = commitFIFO(initial(), p, 'a');
  const q = await previewFIFO(b, journal, opts(b), d),
    e = commitFIFO(d, q, 'b');
  expect(q.skipped).toBe(1);
  const f = await rollbackFIFO(e, q.batch, journal),
    g = await rollbackFIFO(f, p.batch, journal);
  expect(g.trades).toHaveLength(0);
  const again = await previewFIFO(b, journal, opts(b), g);
  expect(fifoTotals(again.data!, journal.id).open).toBe('3');
  expect(again.added).toBe(2);
});
it('FIFO refuses to discard starred/profile data or economic edits across incremental closes', async () => {
  const { data } = await imported([buy]);
  const raw = csv([sell]);
  for (const trade of [
    { ...data.trades[0], starred: true },
    { ...data.trades[0], costs: { ...data.trades[0].costs, commission: '20' } },
  ])
    await expect(
      previewFIFO(raw, journal, opts(raw), { ...data, trades: [trade] }),
    ).rejects.toThrow(/hồ sơ|sửa dữ kiện/);
});
it('FIFO rollback rejects removal of the opening batch needed by a later close', async () => {
  const { data, preview } = await imported([buy]);
  const raw = csv([sell]);
  const q = await previewFIFO(raw, journal, opts(raw), data),
    next = commitFIFO(data, q, 'b');
  await expect(rollbackFIFO(next, preview.batch, journal)).rejects.toThrow('phụ thuộc');
  expect((await rollbackFIFO(next, q.batch, journal)).trades[0].status).toBe('open');
});
function trade(id: string, entry = '10', exit = '12', fee = '0.2'): Trade {
  return tradeSchema.parse({
    id,
    journalId: journal.id,
    symbol: 'BTCUSDT',
    market: 'crypto',
    side: 'long',
    status: 'closed',
    legs: [
      { id: id + 'i', kind: 'in', time: '2026-01-01T01:00:00.000Z', price: entry, quantity: '1' },
      { id: id + 'o', kind: 'out', time: '2026-01-02T01:00:00.000Z', price: exit, quantity: '1' },
    ],
    initialRisk: '1',
    plannedSL: '9',
    plannedTP: '14',
    costs: { commission: fee, tax: '0', funding: '0', swap: '0', other: '0' },
    costsKnown: true,
    highestPrice: '15',
    lowestPrice: '8',
    tags: [],
    errorTagIds: [],
    starred: false,
    review: { done: false },
    attachments: [],
    customStats: {},
    isDemo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}
it('OTP requires explicit observed ordering and potential R follows the original SL/TP', () => {
  const t = trade('a');
  expect(exitAnalysis(t)?.otpHit).toBeNull();
  expect(exitAnalysis(t)?.plannedR).toBeNull();
  expect(exitAnalysis({ ...t, otpHit: 'yes' })?.plannedR).toBe('4');
  expect(exitAnalysis({ ...t, otpHit: 'no' })?.managementEffectR).toBe('2.8');
  expect(exitAnalysis({ ...t, otpHit: 'breakeven' })?.plannedR).toBe('0');
  expect(exitAnalysis({ ...t, otpHit: 'yes' })?.updrawPercent).toBe('125');
});
it('merge preserves per-exit PNL, uneven fees and profiles for overlapping actual fills', () => {
  const a = {
      ...trade('a'),
      plannedSL: undefined,
      plannedTP: undefined,
      highestPrice: undefined,
      lowestPrice: undefined,
      starred: true,
    },
    b = {
      ...a,
      id: 'b',
      starred: false,
      costs: { ...a.costs, commission: '0.7' },
      legs: a.legs.map((l) => ({ ...l, id: l.id + 'b', price: l.kind === 'in' ? '11' : '13' })),
    };
  const data = { ...initial(), trades: [a, b] };
  const merged = mergeTrades(data, ['a', 'b']);
  const f = tradeFacts(merged.trades[0]);
  expect(f.gross).toBe('4');
  expect(f.net).toBe('3.1');
  expect(f.events.map((e) => e.net).sort()).toEqual(['1.3', '1.8']);
  expect(merged.trades[0].starred).toBe(true);
});
it('market profile charges overnight on inventory, validates every leg date and lot size', () => {
  const t = trade('a'),
    p = feeProfileSchema.parse({
      id: 'p',
      name: 'Test',
      market: 'crypto',
      currency: 'USDT',
      effectiveFrom: '2026-01-01',
      multiplier: '1',
      quantityStep: '1',
      commissionPercent: '0.1',
      commissionPerUnit: '0',
      sellTaxPercent: '0',
      overnightPerUnit: '1',
      settlementDays: 0,
      allowShort: true,
    });
  const multi = {
    ...t,
    legs: [
      { ...t.legs[0], time: '2026-01-01T01:00:00.000Z' },
      { ...t.legs[0], id: 'late', time: '2026-01-10T01:00:00.000Z' },
      { ...t.legs[1], quantity: '2', time: '2026-01-11T01:00:00.000Z' },
    ],
  };
  expect(profileCosts(multi, p, 'USDT').costs.swap).toBe('11');
  expect(() => profileCosts(t, { ...p, effectiveTo: '2026-01-01' }, 'USDT')).toThrow(
    'ngày hiệu lực',
  );
  expect(() => profileCosts(t, { ...p, quantityStep: '100' }, 'USDT')).toThrow('lô');
});
it('Monte Carlo enforces sample/bounds, computes bands and a path-wise ruin probability', () => {
  expect(() => monteCarlo(Array(19).fill(1))).toThrow('INVALID');
  const values = Array(20).fill(-1),
    r = monteCarlo(values, 1, 50, 1000, 10, { mode: 'percent', riskPercent: 10, ruin: 20 });
  expect(r.ruinProbability).toBe(1);
  expect(r.positiveProbability).toBe(0);
  expect(r.band).toHaveLength(51);
  expect(r.band[50][0]).toBeCloseTo((0.9 ** 50 - 1) * 100);
  expect(r.samples[0][0]).toBe(0);
});
it('behavior and milestones never replace legacy discipline or count missing chip data as compliance', () => {
  const ts = Array.from({ length: 20 }, (_, i) => ({
    ...trade('b' + i),
    stageChips: { entry: ['positive'], management: [], exit: [] },
    disciplineLegacy: 85,
  }));
  const tags = [
    {
      id: 'positive',
      journalId: journal.id,
      code: 'p',
      name: 'P',
      stage: 'entry' as const,
      tone: 'pos' as const,
    },
  ];
  const b = behavior(ts, tags, []);
  expect(b.at(-1)?.efficiency).toBe(100);
  expect(b[0].efficiency).toBeNull();
  expect(b[0].score).toBe(1);
  expect(behavior([trade('empty')], tags, [])[0].efficiency).toBeNull();
  expect(milestones(ts, 7, true, [], tags)).toHaveLength(9);
  expect(ts[0].disciplineLegacy).toBe(85);
});

it('settlement checks each partial exit and midnight rollover retains the prior position', () => {
  const t = trade('settlement'),
    p = feeProfileSchema.parse({
      id: 'p',
      name: 'T2',
      market: 'crypto',
      currency: 'USDT',
      effectiveFrom: '2026-01-01',
      multiplier: '1',
      quantityStep: '1',
      commissionPercent: '0',
      commissionPerUnit: '0',
      sellTaxPercent: '0',
      overnightPerUnit: '1',
      settlementDays: 2,
      allowShort: true,
    });
  const multi = {
    ...t,
    legs: [
      { ...t.legs[0], quantity: '2' },
      { ...t.legs[1], id: 'early', time: '2026-01-01T02:00:00.000Z' },
      { ...t.legs[1], time: '2026-01-10T00:00:00.000Z' },
    ],
  };
  expect(profileCosts(multi, p, 'USDT').warnings).toHaveLength(1);
  expect(profileCosts(multi, p, 'USDT').costs.swap).toBe('9');
});
it('calendar R includes partial exits when final close is outside the month', () => {
  const t = trade('partial'),
    j = { ...journal, settings: { ...journal.settings, displayUnit: 'R' as const } };
  const multi = {
    ...t,
    costs: { ...t.costs, commission: '0' },
    legs: [
      { ...t.legs[0], quantity: '2' },
      { ...t.legs[1], id: 'jan', time: '2026-01-02T00:00:00.000Z' },
      { ...t.legs[1], id: 'feb', time: '2026-02-01T00:00:00.000Z' },
    ],
  };
  expect(calendarMonth(j, [multi], '2026-01').net).toBe('2');
});
it('request fact cache expires before the next edit and rejects excess explicit fees', () => {
  const t = trade('cache');
  withTradeFactsCache(() => expect(tradeFacts(t).net).toBe('1.8'));
  t.costs.commission = '1';
  expect(tradeFacts(t).net).toBe('1');
  const invalid = {
    ...t,
    legs: t.legs.map((l) =>
      l.kind === 'out' ? { ...l, realizedCosts: { ...t.costs, commission: '2' } } : l,
    ),
  };
  expect(() => tradeFacts(invalid)).toThrow('EXPLICIT_COST');
});

it('no-ID identical fills retain multiplicity within a file and deduplicate on exact reimport', async () => {
  const raw = csv([buy.replace(/^9,/, ','), buy.replace(/^9,/, ',')]),
    p = await previewFIFO(raw, journal, opts(raw), initial());
  expect(p.added).toBe(2);
  expect(fifoTotals(p.data!, journal.id).open).toBe('4');
  const data = commitFIFO(initial(), p, 'identical.csv'),
    q = await previewFIFO(raw, journal, opts(raw), data);
  expect(q.skipped).toBe(2);
  expect(q.added).toBe(0);
});
