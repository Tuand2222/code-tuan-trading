import { expect, it } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { classicReport, classicWeekdays } from '../../src/core/classic';
import { emptyFilters } from '../../src/core/filters';

it('keeps a day with unknown costs unknown, including mixed known and unknown events', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  const unknown = structuredClone(data.trades[0]);
  unknown.costsKnown = false;
  const known = structuredClone(data.trades[0]);
  known.id += '-known';
  const source = { journal: data.journals[0], trades: [unknown, known] };
  const report = classicReport(source, emptyFilters, 200000000);
  expect(report.complete).toBe(false);
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0].pnl).toBeNull();
  expect(report.bestDay).toBeNull();
  expect(report.consistency).toBeUndefined();
});

it('propagates unknown weekdays regardless of order and retains actual zero', () => {
  const rows = [
    { date: '2026-10-05', pnl: 100 },
    { date: '2026-10-12', pnl: null },
    { date: '2026-10-19', pnl: 200 },
    { date: '2026-10-06', pnl: 0 },
    { date: '2026-10-07', pnl: -50 },
  ];
  const days = classicWeekdays(rows);
  expect(days[0].pnl).toBeNull();
  expect(days[1].pnl).toBe(0);
  expect(days[2].pnl).toBe(-50);
  expect(classicWeekdays([...rows].reverse())).toEqual(days);
});
