import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { D, parseDecimal, splitCosts, sum } from '../../lib/trading/domain/decimal';
import { bookKey, dedupeMultiset, fillKey, hash } from '../../lib/trading/domain/identity';
import { replayBook } from '../../lib/trading/domain/replayBook';
import { reanchorOverlays, resolveRisk } from '../../lib/trading/domain/finance';
import { calendarVM, feeImpact, metricsVM, shadowCurve, validRiskTrades } from '../../lib/trading/selectors';
import type { CashEvent, Cycle, TradeOverlay } from '../../lib/trading/domain/types';
import { account, batch, fill, golden } from './fixtures';

describe('decimal and identity', () => {
  it('parses only the confirmed column format and never invents zero', () => {
    expect(parseDecimal('25.400,25', ',', '.')).toBe('25400.25');
    expect(parseDecimal('25,400.25', '.', ',')).toBe('25400.25');
    for (const input of ['', 'abc', '1,23,4', '1,2']) expect(() => parseDecimal(input, '.', ',')).toThrow();
    expect(D('0.1').plus(D('0.2')).toString()).toBe('0.3');
  });
  it('allocates rounding residual to final piece', () => {
    let costs = [{ kind: 'commission' as const, amount: '1', ccy: 'VND', origin: 'reported' as const }];
    const taken: string[] = [];
    for (const total of ['3', '2', '1']) { const [a, b] = splitCosts(costs, '1', total); taken.push(a[0].amount!); costs = b as typeof costs; }
    expect(sum(taken)).toBe('1');
  });
  it('keeps multiple identical fills and scopes native IDs by symbol', async () => {
    const f = await fill('a', 'buy', '1', '10', '2026-01-01T00:00:00Z', { nativeId: undefined });
    const incoming = [f, { ...f, fillId: 'b' }];
    expect(dedupeMultiset(incoming, []).newEntries).toHaveLength(2);
    expect(dedupeMultiset(incoming, [f]).newEntries).toHaveLength(1);
    expect(dedupeMultiset(incoming, incoming).duplicates).toHaveLength(2);
    expect(dedupeMultiset(incoming, [{ ...f, active: false }]).newEntries).toHaveLength(2);
    const native = { ...f, nativeId: '42' };
    expect(await fillKey(native, account())).not.toBe(await fillKey({ ...native, symbol: 'HPG' }, account()));
  });
  it('detects native amendment conflicts and ignores exchange rates', async () => {
    const f = await fill('a', 'buy', '1', '10', '2026-01-01T00:00:00Z');
    expect(dedupeMultiset([{ ...f, price: '11' }], [f]).conflicts).toHaveLength(1);
    expect(dedupeMultiset([f, { ...f, price: '11' }], []).conflicts).toHaveLength(1);
    expect(await fillKey({ ...f, costs: [{ kind: 'commission', amount: '1', ccy: 'USD', origin: 'reported', rateToVND: '26000' }] }, account())).toBe(f.dedupeKey);
  });
});
describe('replay and financial invariants', () => {
  it('matches the hand-calculated January/February FIFO and average example', async () => {
    const f = await golden();
    const fifo = await replayBook(f, account(), [batch()]);
    const average = await replayBook(f, account({ costBasis: 'average' }), [batch()]);
    expect(fifo.events.map(e => e.netVND)).toEqual(['12000', '8000']);
    expect(average.events.map(e => e.netVND)).toEqual(['8000', '12000']);
    expect(fifo.cycles[0].netVND).toBe('20000'); expect(average.cycles[0].netVND).toBe('20000');
    expect(calendarVM(fifo, { from: '2026-01-01', to: '2026-01-31' })[0].netVND).toBe('12000');
    expect(await hash(await replayBook([...f].reverse(), account(), [batch()]))).toBe(await hash(fifo));
  });
  it('property: FIFO/average full-cycle P&L agrees with cash flow, fees are conserved', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 10000 }), async (p1, p2, exit) => {
      const costs = [{ kind: 'commission' as const, amount: '0.1', ccy: 'VND', origin: 'reported' as const }];
      const rows = await Promise.all([fill('1', 'buy', '3', String(p1), '2026-01-01T00:00:00Z', { costs }), fill('2', 'buy', '4', String(p2), '2026-01-02T00:00:00Z', { costs }), fill('3', 'sell', '2', String(exit), '2026-01-03T00:00:00Z', { costs }), fill('4', 'sell', '5', String(exit), '2026-01-04T00:00:00Z', { costs })]);
      const expected = D(String(exit)).mul(7).minus(D(String(p1)).mul(3)).minus(D(String(p2)).mul(4)).minus('0.4').toString();
      for (const costBasis of ['fifo', 'average'] as const) {
        const result = await replayBook(rows, account({ costBasis }), [batch()]);
        expect(result.cycles[0].netVND).toBe(expected);
        expect(sum(result.events.map(e => e.netVND!))).toBe(expected);
        expect(sum(result.events.flatMap(e => e.costs.map(c => c.amount!)))).toBe('0.4');
      }
    }), { numRuns: 60, seed: 42 });
  });
  it('splits a flip and its commission without losing the open short', async () => {
    const acct = account({ allowsShort: true });
    const rows = [await fill('1', 'buy', '2', '100', '2026-01-01T00:00:00Z', {}, acct), await fill('2', 'sell', '3', '110', '2026-01-02T00:00:00Z', { costs: [{ kind: 'commission', amount: '3', ccy: 'VND', origin: 'reported' }] }, acct)];
    const r = await replayBook(rows, acct, [batch()]);
    expect(r.cycles.find(c => c.status === 'closed')?.netVND).toBe('18');
    expect(r.openPositions[0]).toMatchObject({ direction: 'SHORT', qty: '1', costs: [{ amount: '1' }] });
  });
  it('blocks stock oversells; preserves unmatched evidence', async () => {
    const r = await replayBook([await fill('1', 'sell', '2', '100', '2026-01-01T00:00:00Z')], account(), [batch()]);
    expect(r.cycles[0].status).toBe('incomplete'); expect(r.openPositions).toHaveLength(0); expect(r.anomalies[0].code).toBe('OVERSELL');
  });
  it('flags missing fees and ambiguous equal-time sides', async () => {
    const r = await replayBook([await fill('1', 'buy', '1', '100', '2026-01-01T00:00:00Z', { seq: '1', costs: [{ kind: 'commission', origin: 'missing', ccy: 'VND' }] }), await fill('2', 'sell', '1', '110', '2026-01-01T00:00:00Z', { seq: '2' })], account(), [batch()]);
    expect(r.cycles[0].netVND).toBeUndefined(); expect(metricsVM(r).net.status).toBe('no-data');
    const f = await golden(); f[2].tsUtc = f[1].tsUtc;
    expect((await replayBook(f, account(), [batch()])).anomalies.some(a => a.code === 'AMBIGUOUS_ORDER')).toBe(true);
  });
  it('values fees at their source batch FX and P&L at close batch FX', async () => {
    const acct = account({ baseCcy: 'USD', quoteCcy: 'USD' });
    const rows = [await fill('1', 'buy', '1', '100', '2026-01-01T00:00:00Z', { costs: [{ kind: 'commission', origin: 'reported', amount: '1', ccy: 'USD' }] }, acct), await fill('2', 'sell', '1', '110', '2026-01-02T00:00:00Z', { batchId: 'c' }, acct)];
    const r = await replayBook(rows, acct, [batch('b', { fx: [{ ccy: 'USD', rateToVND: '25000', source: 'user' }] }), batch('c', { fx: [{ ccy: 'USD', rateToVND: '26000', source: 'user' }] })]);
    expect(r.cycles[0].netVND).toBe('235000');
  });
  it('funding hits its actual date and does not double count a realized-PnL cash row', async () => {
    const rows = await golden();
    const cash: CashEvent = { eventId: 'funding', batchId: 'b', accountId: 'a', active: true, tsUtc: '2026-01-02T12:00:00Z', kind: 'funding', symbol: 'FPT', amount: '10', ccy: 'VND', dedupeKey: 'cash', dedupeOcc: 1, normVersion: 1, raw: {} };
    const r = await replayBook(rows, account(), [batch()], [cash, { ...cash, eventId: 'reported', kind: 'reported-realized', amount: '20000' }]);
    expect(r.cycles[0].netVND).toBe('19990'); expect(r.events).toHaveLength(3);
    expect(calendarVM(r).find(d => d.date === '2026-01-02')?.netVND).toBe('-10');
    expect(feeImpact(r).knownCarryingPaidVND).toBe('10');
  });
  it('keeps simultaneous hedged long/short books separate', async () => {
    const acct = account({ allowsShort: true, bookMode: 'hedging' });
    const rows = [await fill('1', 'buy', '1', '100', '2026-01-01T00:00:00Z', { positionSide: 'LONG' }, acct), await fill('2', 'sell', '1', '100', '2026-01-01T00:00:00Z', { positionSide: 'SHORT' }, acct)];
    const r = await replayBook(rows, acct, [batch()]); expect(r.openPositions).toHaveLength(2); expect(r.events).toHaveLength(0);
    expect(() => bookKey(acct, { symbol: 'FPT' })).toThrow('MISSING_HEDGE_ID');
  });
});
describe('risk, overlays and selectors', () => {
  async function cycle(): Promise<Cycle> { return (await replayBook([await fill('1', 'buy', '1', '100', '2026-01-01T00:00:00Z'), await fill('2', 'sell', '1', '110', '2026-01-02T00:00:00Z')], account(), [batch()])).cycles[0]; }
  const overlay = (patch: Partial<TradeOverlay> = {}): TradeOverlay => ({ overlayId: 'o', anchorFillIds: ['1'], state: 'attached', mistakeTags: [], reviewStatus: 'needs-review', updatedAt: '2026-01-01T00:00:00Z', ...patch });
  it('requires confirmed initial stop and one entry; user risk takes priority', async () => {
    const c = await cycle();
    expect(resolveRisk(c, account(), [batch()], overlay({ stopLossPrice: '90', stopOrigin: 'reported-current' })).risk.origin).toBe('none');
    expect(resolveRisk(c, account(), [batch()], overlay({ stopLossPrice: '90', stopOrigin: 'confirmed-initial' })).risk.amountVND).toBe('10');
    expect(resolveRisk(c, account(), [batch()], overlay({ stopLossPrice: '105', stopOrigin: 'confirmed-initial' })).warnings).toContain('TRAILED_STOP_DETECTED');
    expect(resolveRisk(c, account(), [batch()], overlay({ riskOverrideVND: '20' })).risk.amountVND).toBe('20');
    expect(resolveRisk({ ...c, legs: [...c.legs, c.legs[0]] }, account(), [batch()], overlay({ stopLossPrice: '90', stopOrigin: 'confirmed-initial' })).risk.origin).toBe('none');
  });
  it('uses the same risk cohort in numerator and denominator; fixed risk is opt-in', async () => {
    const c = await cycle(); c.risk = { amountVND: '5', origin: 'user-entered' };
    const missing = { ...c, tradeId: 'missing', netVND: '1000', risk: { origin: 'none' as const } };
    const fixed = { ...c, tradeId: 'fixed', risk: { amountVND: '1', origin: 'batch-fixed' as const } };
    const r = { cycles: [c, missing, fixed], events: [], openPositions: [], anomalies: [] };
    expect(validRiskTrades(r.cycles)).toHaveLength(1); expect(metricsVM(r).roi).toEqual({ status: 'ok', value: 200, n: 1, of: 3 });
    expect(metricsVM(r).averageR).toMatchObject({ value: 2, n: 1 });
    expect(validRiskTrades(r.cycles, true)).toHaveLength(2);
  });
  it('retains detached overlays, marks ambiguous splits and excludes only reviewed violations', async () => {
    const c = await cycle(); const o = overlay({ anchorFillIds: c.sourceFillIds, reviewStatus: 'reviewed', disciplineScore: 50 });
    expect(reanchorOverlays([], [o])[0].state).toBe('detached');
    expect(reanchorOverlays([c, { ...c, tradeId: 'split' }], [o])[0].state).toBe('needs-attention');
    const r = await replayBook([await fill('1', 'buy', '1', '100', '2026-01-01T00:00:00Z'), await fill('2', 'sell', '1', '110', '2026-01-02T00:00:00Z')], account(), [batch()], [], [o]);
    expect(shadowCurve(r).points[0]).toMatchObject({ actualVND: '10', shadowVND: '0' });
  });
  it('selectors never emit NaN or Infinity for fuzzed valid trades', async () => {
    const c = await cycle();
    fc.assert(fc.property(fc.array(fc.integer({ min: -10000, max: 10000 }), { maxLength: 50 }), values => {
      const cycles = values.map((v, i) => ({ ...c, tradeId: String(i), netVND: String(v) }));
      const metrics = metricsVM({ cycles, events: [], openPositions: [], anomalies: [] });
      expect(Object.keys(metrics)).toHaveLength(24);
      for (const metric of Object.values(metrics)) if (metric.status === 'ok') expect(Number.isFinite(metric.value)).toBe(true);
    }), { numRuns: 100, seed: 7 });
  });
});
