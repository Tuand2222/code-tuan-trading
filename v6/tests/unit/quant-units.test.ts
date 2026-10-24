import { it, expect } from 'vitest';
import { quantReport, defaultQuantSettings, type QuantObservation } from '../../src/core/quantLab';
import { parseCloudArchives } from '../../src/data/cloudArchiveFormat';
import { canonical, sha256 } from '../../src/data/backup';
const row: QuantObservation = {
  id: 'a',
  symbol: 'EURUSD',
  market: 'forex',
  setup: 'x',
  openTime: '2026-10-24T00:00:00.000Z',
  closeTime: '2026-10-24T01:00:00.000Z',
  gross: '20',
  net: '18',
  risk: '10',
  mfe: '30',
  mae: '5',
  quantity: '10000',
  multiplier: '1',
};
it('changes monetary, capital percentage, pips and ticks together without changing R quality', () => {
  const s = defaultQuantSettings(),
    input = [row, { ...row, id: 'b', net: '-10' }];
  const base = quantReport(input, s, 'UTC');
  for (const [unit, expected] of [
    ['money', 18],
    ['percent', 1.8],
    ['pips', 18],
    ['ticks', 180],
  ] as const) {
    const report = quantReport(
      input,
      {
        ...s,
        unit,
        capital: 1000,
        instruments: { EURUSD: { pipSize: 0.0001, tickSize: 0.00001 } },
      },
      'UTC',
    );
    expect(report.rows[0].r).toBeCloseTo(expected);
    expect(report.stats.sqn).toBe(base.stats.sqn);
    expect(report.rolling).toEqual(base.rolling);
  }
  expect(row.net).toBe('18');
});
it('keeps missing risk visible in money mode and refuses unspecified pips or percentage baseline', () => {
  const s = defaultQuantSettings();
  const money = quantReport([{ ...row, risk: null }], { ...s, unit: 'money' }, 'UTC');
  expect(money.stats.mean).toBe(18);
  expect(money.rows[0].risk).toBeNull();
  expect(money.rStats.n).toBe(0);
  expect(money.stats.sqn).toBeNull();
  expect(quantReport([row], { ...s, unit: 'pips' }, 'UTC').stats.n).toBe(0);
  expect(quantReport([row], { ...s, unit: 'percent' }, 'UTC').stats.n).toBe(0);
});
it('deducts simulated R friction consistently after converting units', () => {
  const s = { ...defaultQuantSettings(), frictionR: 0.1 };
  expect(quantReport([row], { ...s, unit: 'money' }, 'UTC').stats.mean).toBe(17);
  expect(quantReport([row], s, 'UTC').stats.mean).toBeCloseTo(1.7);
});
it('validates all portable archive parts and refuses corruption or incomplete downloads', async () => {
  const value = { note: 'giữ nguyên' },
    record = {
      collection: 'notes',
      id: 'a',
      value,
      deleted: false,
      hash: await sha256(canonical(value)),
    };
  const first = [
    { format: 'tuan-cloud-archive', version: 1, revision: 2, after: '', archiveId: 'owner:2' },
    record,
    { complete: false, next: 'notes:a', revision: 2 },
  ]
    .map((v) => JSON.stringify(v))
    .join('\n');
  const last = [
    {
      format: 'tuan-cloud-archive',
      version: 1,
      revision: 2,
      after: 'notes:a',
      archiveId: 'owner:2',
    },
    { complete: true, next: null, revision: 2 },
  ]
    .map((v) => JSON.stringify(v))
    .join('\n');
  expect(await parseCloudArchives([last, first])).toHaveLength(1);
  await expect(parseCloudArchives([first])).rejects.toThrow('gói cuối');
  await expect(parseCloudArchives([first.replace('giữ nguyên', 'sai'), last])).rejects.toThrow(
    'Checksum',
  );
});
