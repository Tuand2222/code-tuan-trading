import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  defaultQuantSettings,
  quantReport,
  rStatistics,
  observeTrades,
  type QuantObservation,
} from '../../src/core/quantLab';
import { classicObservations, readClassicQuantSource } from '../../src/data/classicQuantSource';
import { tradeSchema } from '../../src/data/schema';
const row = (id: string, pnl = '100', risk: string | null = '50'): QuantObservation => ({
  id,
  symbol: id,
  market: 'futures',
  setup: 'trend',
  openTime: '2026-10-22T16:50:00.000Z',
  closeTime: '2026-10-22T17:10:00.000Z',
  gross: pnl,
  net: String(Number(pnl) - 12),
  risk,
  mfe: '150',
  mae: '25',
});
const settings = defaultQuantSettings;
afterEach(() => vi.unstubAllGlobals());
describe('V6 quantitative lab without ledger mutations', () => {
  it('reconciles gross/net/cost and friction without modifying any receipt', () => {
    const input = [row('a')],
      original = JSON.stringify(input);
    const net = quantReport(input, settings(), 'UTC');
    expect(net.stats.mean).toBeCloseTo(1.76);
    expect(quantReport(input, { ...settings(), pnl: 'gross' }, 'UTC').stats.mean).toBe(2);
    const simulated = quantReport(input, { ...settings(), frictionR: 0.1 }, 'UTC');
    expect(simulated.stats.mean).toBeCloseTo(1.66);
    expect(simulated.simulated).toBe(true);
    expect(JSON.stringify(input)).toBe(original);
  });
  it('caps SQN while preserving expectancy and uses sample standard deviation', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => (i % 2 ? 2 : -1));
    const fourHundred = Array.from({ length: 400 }, (_, i) => hundred[i % 100]);
    const a = rStatistics(fourHundred, 'cap100'),
      b = rStatistics(fourHundred, 'unlimited');
    expect(b.sqn).toBeCloseTo(a.sqn! * 2);
    expect(a.mean).toBe(b.mean);
    expect(rStatistics([1, 3]).sd).toBeCloseTo(Math.sqrt(2));
    expect(rStatistics([...Array(100).fill(-5), ...hundred], 'rolling100').sqn).toBeCloseTo(
      rStatistics(hundred, 'unlimited').sqn!,
    );
  });
  it('does not invent zero ratios for no losses, no variance, or no downside', () => {
    const report = quantReport([row('a'), row('b')], settings(), 'UTC');
    expect(report.stats.noLoss).toBe(true);
    expect(report.stats.pf).toBeNull();
    expect(report.stats.sqn).toBeNull();
    expect(report.stats.sortino).toBeNull();
    expect(report.recovery).toBeNull();
  });
  it('keeps missing risk/costs out of the relevant sample and stops underwater at a gap', () => {
    const report = quantReport(
      [row('a'), row('b', '-50', null), { ...row('c'), net: null }],
      settings(),
      'UTC',
    );
    expect(report.stats.n).toBe(1);
    expect(report.maxDD).toBeNull();
    expect(report.curve[1].dd).toBeNull();
    expect(report.curve[2].dd).toBeNull();
    expect(report.missingRisk).toBe(1);
    expect(report.missingCosts).toBe(1);
  });
  it('only imputes 1R after explicit simulation opt-in and always prefers actual risk', () => {
    const input = [row('a'), row('b', '100', null)];
    const s = { ...settings(), assumeMissingRisk: true, baseline: 100 };
    const report = quantReport(input, s, 'UTC');
    expect(report.rows[0].r).toBeCloseTo(1.76);
    expect(report.rows[0].assumed).toBe(false);
    expect(report.rows[1].r).toBeCloseTo(0.88);
    expect(report.assumed).toBe(1);
    expect(report.simulated).toBe(true);
    expect(input[1].risk).toBeNull();
  });
  it('changes date basis and heatmap slots in the journal timezone', () => {
    const s = { ...settings(), minutes: 15 as const };
    expect(
      quantReport([row('a')], s, 'Asia/Ho_Chi_Minh', { from: '2026-10-23' }).rows,
    ).toHaveLength(1);
    expect(
      quantReport([row('a')], { ...s, dateBasis: 'entry' }, 'Asia/Ho_Chi_Minh', {
        from: '2026-10-23',
      }).rows,
    ).toHaveLength(0);
    expect(quantReport([row('a')], s, 'Asia/Ho_Chi_Minh').heat[0].minute).toBe(0);
  });
  it('counts histogram membership once including both boundary values', () => {
    const rows = [row('a', '-100'), row('b', '100'), row('c', '0')];
    const r = quantReport(rows, settings(), 'UTC');
    expect(r.bins.reduce((n, b) => n + b.ids.length, 0)).toBe(3);
    expect(new Set(r.bins.flatMap((b) => b.ids)).size).toBe(3);
  });
  it('uses real long/short contract extrema and refuses synthetic extrema', () => {
    const trade = tradeSchema.parse({
      id: 'f',
      journalId: 'j',
      symbol: 'VN30F',
      market: 'futures',
      side: 'short',
      status: 'closed',
      legs: [
        { id: 'in', kind: 'in', time: '2026-10-22T00:00:00.000Z', quantity: '2', price: '100' },
        { id: 'out', kind: 'out', time: '2026-10-22T01:00:00.000Z', quantity: '2', price: '98' },
      ],
      multiplier: '100000',
      initialRisk: '200000',
      costs: { commission: '10000', tax: '0', funding: '0', swap: '0', other: '0' },
      costsKnown: true,
      highestPrice: '101',
      lowestPrice: '97',
      errorTagIds: [],
      tags: [],
      starred: false,
      review: { done: false },
      attachments: [],
      customStats: {},
      isDemo: false,
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-10-22T00:00:00.000Z',
    });
    const observed = observeTrades([trade]);
    expect(observed[0].net).toBe('390000');
    expect(observed[0].mfe).toBe('600000');
    expect(observed[0].mae).toBe('200000');
    const result = quantReport(observed, settings(), 'UTC');
    expect(result.rows[0].r).toBeCloseTo(1.95);
    trade.legs[0].synthetic = true;
    expect(observeTrades([trade])[0].mfe).toBeNull();
  });
  it('does not manufacture timestamps, risk or fees from Classic and excludes raw fills', () => {
    const input = [
      {
        id: 'c',
        symbol: 'BTCUSDT',
        date: '2026-10-22',
        market: 'Crypto',
        pnl: 100,
        fees: 10,
        swap: 2,
        risk: 50,
      },
      { id: 'fill', symbol: 'BTCUSDT', date: '2026-10-22', pnl: 1, recordKind: 'fill' },
    ];
    const before = JSON.stringify(input),
      mapped = classicObservations(input);
    expect(mapped.skipped).toBe(1);
    expect(mapped.observations[0].net).toBe('88');
    expect(
      quantReport(mapped.observations, settings(), 'Pacific/Kiritimati', {
        from: '2026-10-22',
        to: '2026-10-22',
      }).stats.n,
    ).toBe(1);
    expect(quantReport(mapped.observations, settings(), 'UTC').heat).toEqual([]);
    expect(quantReport(mapped.observations, settings(), 'UTC').maxDD).toBeNull();
    expect(quantReport(mapped.observations, settings(), 'UTC').rolling[0].sqn).toBeNull();
    expect(
      quantReport(mapped.observations, { ...settings(), dateBasis: 'entry' }, 'UTC').rows,
    ).toEqual([]);
    expect(classicObservations([{ ...input[0], fees: undefined }]).observations[0].net).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
  });
  it('reads only the signed-in Classic account cache and never writes it', async () => {
    const reads: string[] = [],
      setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => {
        reads.push(key);
        return '[]';
      },
      setItem,
    });
    const requests: string[] = [];
    vi.stubGlobal('fetch', async (path: string) => {
      requests.push(path);
      return {
        ok: true,
        json: async () => (path === '/api/trades' ? { trades: [] } : { user: { id: 'account-a' } }),
      };
    });
    await readClassicQuantSource();
    expect(reads).toEqual(['tuan-trader-trades:account-a', 'tuan-trader-demo-mode-v1:account-a']);
    expect(setItem).not.toHaveBeenCalled();
    expect(requests).toEqual(['/api/auth/get-session', '/api/site-session', '/api/trades']);
  });
});
