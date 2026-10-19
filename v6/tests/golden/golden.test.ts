import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fixture from './fixture-30-trades.json';
import provenance from './provenance.json';
import expected from './golden.expected.json';

it('loads the original v3 demo export and validates its envelope/file checksums', () => {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
      return (
        '{' +
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([key, v]) => JSON.stringify(key) + ':' + canonical(v))
          .join(',') +
        '}'
      );
    return JSON.stringify(value);
  };
  const { checksum, ...body } = fixture;
  const digest = createHash('sha256').update(canonical(body)).digest('hex');
  expect(digest).toBe(checksum);
  expect(
    createHash('sha256')
      .update(readFileSync(new URL('./fixture-30-trades.json', import.meta.url)))
      .digest('hex'),
  ).toBe(provenance.fileSHA256);
  expect(fixture.schemaVersion).toBe(3);
  expect(fixture.data.accounts).toHaveLength(1);
  expect(fixture.data.accounts[0].label.startsWith('MINH HỌA')).toBe(true);
  expect(fixture.data.fills).toHaveLength(60);
  expect(fixture.data.overlays).toHaveLength(30);
  expect(fixture.data.overlays.filter((o) => o.reviewStatus === 'reviewed')).toHaveLength(24);
});
it('locks the specification values and preserves unresolved unit differences explicitly', () => {
  expect(expected.summary.total).toBe(
    expected.summary.wins + expected.summary.losses + expected.summary.breakeven,
  );
  expect(expected.summary.net).toBe(expected.fees.gross - expected.fees.commissionAndTax);
  expect(expected.months.reduce((s, m) => s + m.net, 0)).toBe(expected.summary.net);
  expect(expected.octoberWeeks.reduce((s, w) => s + w.net, 0)).toBe(expected.months[1].net);
  expect(expected.rBuckets.reduce((s, b) => s + b.count, 0)).toBe(30);
  expect(expected.holding.status).toBe('TODO-VERIFY_SPEC_CONFLICT');
  expect(expected.verification.v6Core).toBe('S1_PENDING');
});
it.todo('S1: validate all section 4.1–4.9 values against the new pure v6 core');
it.todo('TODO-VERIFY: resolve 234.33 hours in spec versus 234.33 minutes in original timestamps');
it.todo(
  'TODO-VERIFY: choose winrate denominator with breakeven trades before adopting changed v6 formula',
);
