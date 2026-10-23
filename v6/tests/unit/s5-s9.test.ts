import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { journalSchema, type Trade } from '../../src/data/schema';
import { emptySnapshot } from '../../src/data/snapshot';
import { previewBinance, commitBinance, rollbackBinance } from '../../src/data/binanceImport';
import { replaceTradeLegs, mergeTrades } from '../../src/data/advancedTrades';
import { tradeFacts } from '../../src/core/trade';
import {
  compliance,
  tilt,
  sessionFindings,
  exitAnalysis,
  drilldown,
  whatIf,
  monteCarlo,
  movingAverage,
  ruleAssistant,
  researchBundle,
} from '../../src/core/advanced';
import { encryptBackup, decryptBackup } from '../../src/data/encryptedBackup';
import { reportHTML } from '../../src/data/staticReport';
import { encodeBackup, decodeBackup } from '../../src/data/backup';
import { imageDataURL } from '../../src/data/images';
import { chartbookZip } from '../../src/data/chartbookZip';
import JSZip from 'jszip';
const journal = journalSchema.parse({
  id: 'usdt',
  name: 'Test',
  currency: 'USDT',
  timezone: 'UTC',
  isDemo: true,
  settings: {},
  createdAt: '2026-10-01T00:00:00.000Z',
  schemaVersion: 4,
});
const raw =
  'Position ID,Symbol,Position Side,Open Time,Close Time,Entry Price,Avg Close Price,Closed Quantity,Commission,Funding,Swap,Tax,Other,Closing PNL,Entry Fill ID,Exit Fill ID,Entry Fill Count,Exit Fill Count,Fee Coin\np1,BTCUSDT,LONG,2026-10-01 09:00:00,2026-10-01 10:00:00,10,12,2,0.1,-0.02,0,0,0,4,fill1,fill2,1,1,USDT';
const fixture = async () => {
  const p = await previewBinance(raw, journal, 'gross');
  return { p, data: commitBinance({ ...emptySnapshot(), journals: [journal] }, p, 'test.csv') };
};
it('S5 previews without writes, conserves Net, dedupes and rolls back while preserving source', async () => {
  const { p, data } = await fixture();
  expect(p.trades).toHaveLength(1);
  expect(tradeFacts(data.trades[0]).net).toBe('3.92');
  expect(commitBinance(data, p, 'again.csv')).toBe(data);
  expect(
    commitBinance(data, await previewBinance(raw + '\n', journal, 'gross'), 'overlap.csv'),
  ).toBe(data);
  const restored = await decodeBackup(await encodeBackup(data));
  expect(restored).toEqual(data);
  const rolled = rollbackBinance(data, p.batchId);
  expect(rolled.trades).toHaveLength(0);
  expect(rolled.sources[0].raw).toBe(raw);
  expect(commitBinance(rolled, p, 'again.csv').trades).toHaveLength(1);
  expect(() =>
    rollbackBinance({ ...data, trades: [{ ...data.trades[0], starred: true }] }, p.batchId),
  ).toThrow('BATCH_HAS_USER_CHANGES');
});
it('S5 rejects wrong journal/PNL, keeps missing costs unknown and rejects conflicting IDs', async () => {
  await expect(previewBinance(raw, { ...journal, currency: 'USD' }, 'gross')).rejects.toThrow(
    'USDT',
  );
  await expect(
    previewBinance(raw.replace(',0,0,0,4', ',0,0,0,5'), journal, 'gross'),
  ).rejects.toThrow('PNL');
  const missing = await previewBinance(raw.replace(',0.1,-0.02,', ',,-0.02,'), journal, 'gross');
  expect(tradeFacts(missing.trades[0]).net).toBeUndefined();
  const { data } = await fixture();
  const changed = await previewBinance(
    raw.replace(',10,12,2,', ',10,13,2,').replace(',0,0,0,4', ',0,0,0,6'),
    journal,
    'gross',
  );
  expect(() => commitBinance(data, changed, 'changed.csv')).toThrow('CONFLICT');
});
it('S5 edits partial exits losslessly and refuses over-close', async () => {
  const { data } = await fixture(),
    t = data.trades[0];
  const legs = [
    t.legs[0],
    { ...t.legs[1], id: 'partial1', price: '11', quantity: '1' },
    { ...t.legs[1], id: 'partial2', price: '13', quantity: '1' },
  ];
  const next = replaceTradeLegs(data, t.id, legs, 'closed');
  expect(tradeFacts(next.trades[0]).net).toBe('3.92');
  expect(() =>
    replaceTradeLegs(data, t.id, [t.legs[0], { ...t.legs[1], quantity: '3' }], 'closed'),
  ).toThrow('OVER_CLOSE');
});
it('S5 merges only when per-event economics and metadata are preserved', async () => {
  const { data } = await fixture();
  const a: Trade = {
    ...data.trades[0],
    importBatchId: undefined,
    costs: { commission: '0', funding: '0', tax: '0', swap: '0', other: '0' },
  };
  const b: Trade = {
    ...a,
    id: 'b',
    legs: a.legs.map((l) => ({ ...l, id: l.id + 'b', time: l.time.replace('10-01', '10-02') })),
  };
  const source = { ...data, batches: [], trades: [a, b] };
  const merged = mergeTrades(source, [a.id, b.id]);
  expect(merged.trades).toHaveLength(1);
  expect(tradeFacts(merged.trades[0]).gross).toBe('8');
  expect(merged.sources.at(-1)?.raw).toContain(a.id);
  expect(() =>
    mergeTrades({ ...source, trades: [a, { ...b, side: 'short' }] }, [a.id, b.id]),
  ).toThrow('CONFLICT');
});
it('S6 calculates weighted compliance and chip ratios without changing legacy discipline', async () => {
  const { data } = await fixture();
  const t = {
    ...data.trades[0],
    disciplineLegacy: 85,
    checklist: [{ criterionId: 'a', checked: true }],
    stageChips: { entry: ['e'], management: [], exit: [] },
  };
  expect(
    compliance(t, {
      id: 's',
      journalId: journal.id,
      name: 'Setup',
      checklist: [
        { id: 'a', text: 'A', weight: 2 },
        { id: 'b', text: 'B', weight: 3 },
      ],
    }),
  ).toBe(40);
  expect(
    tilt(
      [t],
      [{ id: 'e', journalId: journal.id, code: 'e', name: 'Error', stage: 'entry', tone: 'neg' }],
    )[0].negativePercent,
  ).toBe(100);
  expect(t.disciplineLegacy).toBe(85);
  const plan = {
    journalId: journal.id,
    maxTradesPerDay: 1,
    allowedSetupIds: [],
    alertRules: [],
    sessionWindows: [{ from: '22:00', to: '02:00' }],
  };
  expect(sessionFindings(journal, [t], plan)[0].outside).toBe(true);
});
it('S7 computes long/short excursions from explicit extrema and preserves group totals', async () => {
  const { data } = await fixture();
  const t = {
    ...data.trades[0],
    initialRisk: '1',
    highestPrice: '15',
    lowestPrice: '8',
    plannedTP: '14',
  };
  expect(exitAnalysis(t)?.mfeR).toBe('10');
  expect(exitAnalysis(t)?.maeR).toBe('-4');
  expect(exitAnalysis(t)?.otpHit).toBe(true);
  const short = {
    ...t,
    side: 'short' as const,
    plannedTP: '9',
    legs: [
      { ...t.legs[0], price: '12' },
      { ...t.legs[1], price: '10' },
    ],
  };
  expect(exitAnalysis(short)?.mfeR).toBe('8');
  expect(exitAnalysis(short)?.maeR).toBe('-6');
  expect(exitAnalysis({ ...t, highestPrice: undefined })).toBeNull();
  expect(
    drilldown(journal, [t, short], ['symbol', 'side'])
      .map((g) => Number(g.metrics.net.value))
      .reduce((a, b) => a + b, 0),
  ).toBeCloseTo(7.84);
  expect(movingAverage(['1', '2', '3', null, '5'], 3)).toEqual([null, null, '2', null, null]);
});
it('S8 seeded simulation is reproducible, bounded, distinct across seeds and labels assumptions', async () => {
  const a = monteCarlo([-1, 2, 1], 12, 20);
  expect(monteCarlo([-1, 2, 1], 12, 20)).toEqual(a);
  expect(monteCarlo([-1, 2, 1], 13, 20).samples).not.toEqual(a.samples);
  expect(a.paths).toBe(1000);
  expect(a.p05).toBeLessThanOrEqual(a.median);
  expect(a.median).toBeLessThanOrEqual(a.p95);
  expect(() => monteCarlo([1])).toThrow('INVALID');
  const { data } = await fixture();
  expect(whatIf(journal, data.trades, []).label).toBe('GIẢ ĐỊNH');
  expect(ruleAssistant(journal, data.trades, 'missing')[0].tradeId).toBe(data.trades[0].id);
});
it('research worker payload keeps date scope across evidence, simulations and custom summaries', async () => {
  const { data } = await fixture();
  const t = { ...data.trades[0], initialRisk: '1', customStats: { '1': '7' } };
  const included = researchBundle(
    journal,
    [t],
    { from: '2026-10-01', to: '2026-10-01' },
    ['symbol', 'side'],
    'review',
  );
  expect(included.rs).toEqual([3.92]);
  expect(included.groups[0].tradeIds).toEqual([t.id]);
  expect(included.custom[0]).toEqual({ slot: '1', n: 1, of: 1, mean: '7' });
  const empty = researchBundle(journal, [t], { from: '2026-10-02' }, ['symbol'], 'review');
  expect(empty.n).toBe(0);
  expect(empty.rs).toEqual([]);
  expect(empty.assistant).toEqual([]);
  expect(empty.groups).toEqual([]);
  expect(empty.custom[0].of).toBe(0);
});
it('S9 encryption roundtrips and rejects password mismatch/tampering; reports omit private notes and IDs', async () => {
  const encrypted = await encryptBackup('private workspace', 'long-password');
  expect(await decryptBackup(encrypted, 'long-password')).toBe('private workspace');
  await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toThrow();
  const bad = JSON.parse(encrypted);
  bad.ciphertext = bad.ciphertext.slice(0, -4) + 'AAAA';
  await expect(decryptBackup(JSON.stringify(bad), 'long-password')).rejects.toThrow();
  const { data } = await fixture();
  const html = reportHTML({ ...journal, name: '<script>private</script>' }, data.trades);
  expect(html).not.toContain(data.trades[0].id);
  expect(html).not.toContain('<script>');
  expect(html).toContain('3.92');
});
it('S7 image bytes survive canonical backup and chartbook ZIP; missing/unsafe sources fail closed', async () => {
  const { data } = await fixture();
  const raw = JSON.stringify({
    kind: 'image',
    mime: 'image/png',
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
  });
  const source = { id: 'image:test', raw, createdAt: new Date().toISOString() };
  const next = {
    ...data,
    sources: [...data.sources, source],
    trades: data.trades.map((t) => ({
      ...t,
      attachments: [
        { id: 'attachment', kind: 'blob' as const, blobKey: source.id, caption: 'Chart' },
      ],
    })),
  };
  expect(imageDataURL(raw)).toContain('data:image/png;base64,');
  expect((await decodeBackup(await encodeBackup(next))).sources.at(-1)?.raw).toBe(raw);
  const zip = await JSZip.loadAsync(await (await chartbookZip(next, journal.id)).arrayBuffer());
  expect(zip.file('images/1-1.png')).toBeTruthy();
  expect(zip.file('ledger.json')).toBeTruthy();
  await expect(encodeBackup({ ...next, sources: data.sources })).rejects.toThrow(
    'BLOB_SOURCE_MISSING',
  );
  expect(() =>
    imageDataURL(JSON.stringify({ kind: 'image', mime: 'image/svg+xml', base64: 'PHN2Zz4=' })),
  ).toThrow();
});
