import { expect, it } from 'vitest';
import {
  appMetaSchema,
  journalSchema,
  tradeSchema,
  decSchema,
  type Trade,
} from '../../src/data/schema';

const stamp = '2026-10-19T00:00:00Z';
const trade: Trade = {
  id: 't',
  journalId: 'j',
  symbol: 'FPT',
  market: 'stocks',
  side: 'long',
  status: 'closed',
  legs: [
    { id: 'in', kind: 'in', time: stamp, price: '25000', quantity: '100' },
    { id: 'out', kind: 'out', time: stamp, price: '26000', quantity: '100' },
  ],
  costs: { commission: '100', tax: '2600', funding: '-10', swap: '0', other: '0' },
  costsKnown: true,
  errorTagIds: [],
  tags: [],
  starred: false,
  review: { done: false },
  attachments: [],
  customStats: {},
  isDemo: true,
  createdAt: stamp,
  updatedAt: stamp,
};
it('keeps decimal facts and legacy review values without derived PnL fields', () => {
  const value = tradeSchema.parse({ ...trade, disciplineLegacy: 85, initialRisk: '0.00000001' });
  expect(value.initialRisk).toBe('0.00000001');
  expect(value.costs.funding).toBe('-10');
  expect(value.disciplineLegacy).toBe(85);
  expect(value.review.done).toBe(false);
  for (const field of ['net', 'gross', 'R', 'holdMinutes', 'avgEntry', 'avgExit', 'openQty'])
    expect(tradeSchema.safeParse({ ...trade, [field]: '0' }).success, field).toBe(false);
});
it('rejects invalid prices, quantities, risk, duplicate legs and nonfinite numbers', () => {
  expect(tradeSchema.safeParse({ ...trade, initialRisk: '0' }).success).toBe(false);
  expect(tradeSchema.safeParse({ ...trade, initialRisk: '-1' }).success).toBe(false);
  expect(
    tradeSchema.safeParse({ ...trade, legs: [{ ...trade.legs[0], quantity: '0' }] }).success,
  ).toBe(false);
  expect(tradeSchema.safeParse({ ...trade, legs: [trade.legs[0], trade.legs[0]] }).success).toBe(
    false,
  );
  expect(tradeSchema.safeParse({ ...trade, legs: [trade.legs[1]] }).success).toBe(false);
  for (const invalid of ['NaN', 'Infinity', '1e8', '25,000', 1000])
    expect(decSchema.safeParse(invalid).success).toBe(false);
});
it('bounds attachments, custom statistics and discipline, and rejects executable URLs', () => {
  const attachment = {
    id: 'a',
    kind: 'url',
    url: 'https://example.com/chart.png',
    caption: 'Entry',
  };
  expect(tradeSchema.safeParse({ ...trade, attachments: [attachment] }).success).toBe(true);
  expect(
    tradeSchema.safeParse({
      ...trade,
      attachments: [{ ...attachment, url: 'javascript:alert(1)' }],
    }).success,
  ).toBe(false);
  expect(
    tradeSchema.safeParse({ ...trade, attachments: Array.from({ length: 7 }, () => attachment) })
      .success,
  ).toBe(false);
  expect(
    tradeSchema.safeParse({
      ...trade,
      customStats: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [String(i), i])),
    }).success,
  ).toBe(false);
  expect(tradeSchema.safeParse({ ...trade, disciplineLegacy: 101 }).success).toBe(false);
});
it('isolates journal currency and validates timezones and schema version', () => {
  const journal = journalSchema.parse({
    id: 'j',
    name: 'Minh họa',
    currency: 'VND',
    isDemo: true,
    settings: {},
    createdAt: stamp,
    schemaVersion: 4,
  });
  expect(journal.timezone).toBe('Asia/Ho_Chi_Minh');
  expect(journal.settings.minSample).toBe(20);
  expect(journal.settings.holdingUnit).toBe('hours');
  expect(journalSchema.safeParse({ ...journal, timezone: 'Mars/Olympus' }).success).toBe(false);
  expect(journalSchema.safeParse({ ...journal, currency: 'VND+USD' }).success).toBe(false);
  expect(
    journalSchema.safeParse({ ...journal, createdAt: '2026-10-19T07:00:00+07:00' }).success,
  ).toBe(false);
  expect(
    appMetaSchema.safeParse({
      schemaVersion: 3,
      lastOpenedAt: stamp,
      thresholds: { minSample: 20 },
    }).success,
  ).toBe(false);
});
