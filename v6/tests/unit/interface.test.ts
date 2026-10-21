import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { formatValue, formatDate } from '../../src/ui/format';
import { KpiCard } from '../../src/ui/KpiCard';
import { emptyFilters, selectTrades, parseHash, filterHash } from '../../src/core/filters';
import { migrateV3 } from '../../src/data/migrateV3';
import { analyze } from '../../src/core/analyze';
import vi from '../../src/i18n/vi.json';
it('formats money, signs, R, percent, holding and local time without changing source precision', () => {
  const original = '425462.78';
  expect(formatValue(original, 'money')).toBe('425.463 đ');
  expect(original).toBe('425462.78');
  expect(formatValue('-1243950', 'money')).toBe('−1.243.950 đ');
  expect(formatValue('1234.567', 'money', 'USD')).toBe('$1,234.57');
  expect(formatValue('1234.567', 'money', 'USDT')).toBe('1,234.57 USDT');
  expect(formatValue('0.3229', 'R')).toBe('0,32R');
  expect(formatValue('60', 'percent')).toBe('60,0%');
  expect(formatValue('1.7581', 'ratio')).toBe('1,76');
  expect(formatValue('-1', 'streak')).toBe('1 lệnh thua');
  expect(formatValue('234.333333', 'duration')).toBe('3,91 giờ');
  expect(formatValue(null, 'money')).toBe('—');
  expect(formatDate('2026-10-19T06:29:00Z')).toBe('19/10/2026 13:29');
});
it('renders all six required KPI parts and all four help lines for every registered metric', () => {
  for (const id of Object.keys(vi.metricHelp) as (keyof typeof vi.metricHelp)[]) {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        id,
        metric: { value: '0', n: 2, of: 30 },
        currency: 'VND',
        demo: false,
      }),
    );
    for (const part of ['label', 'value', 'unit', 'sample', 'badge', 'help'])
      expect(html).toContain(`data-part="${part}"`);
    for (const label of vi.shell.helpLabels) expect(html).toContain(label);
    expect(html).toContain('n=2/30');
    expect(html).toContain(vi.shell.small);
  }
});
describe('global filter scope', () => {
  it('round trips URL values and never broadens OR beyond the selected journal', async () => {
    const { data } = await migrateV3(
      fs.readFileSync('tests/golden/fixture-30-trades.json', 'utf8'),
    );
    const j = data.journals[0];
    const f = {
      ...emptyFilters,
      journal: j.id,
      symbol: data.trades[0].symbol,
      review: 'pending',
      operator: 'OR' as const,
      tag: 'FOMO & a/b',
    };
    expect(parseHash(filterHash('risk', f))).toEqual({ page: 'risk', filters: f });
    const foreign = { ...data.trades[0], id: 'foreign', journalId: 'other' };
    const selected = selectTrades([...data.trades, foreign], f, j.id);
    expect(selected.every((t) => t.journalId === j.id)).toBe(true);
    expect(selected.length).toBeGreaterThan(0);
    const and = selectTrades(data.trades, { ...f, operator: 'AND' }, j.id);
    expect(and.length).toBe(0);
    const october = { ...emptyFilters, journal: j.id, from: '2026-10-01', to: '2026-10-31' };
    expect(analyze(j, selectTrades(data.trades, october, j.id), october).metrics.net.value).toBe(
      '1389630',
    );
  });
});
it('projects cumulative money to account percent and R without guessing missing risks', async () => {
  const { projectCurve } = await import('../../src/core/chartProjection');
  const { data } = await migrateV3(fs.readFileSync('tests/golden/fixture-30-trades.json', 'utf8'));
  const j = { ...data.journals[0], startingBalance: '100000000' };
  const result = analyze(j, data.trades);
  expect(projectCurve(j, data.trades, result, 'percent').at(-1)?.net).toBe('3.30229');
  const projected = projectCurve(j, data.trades, result, 'R');
  expect(projected.at(-1)?.net).not.toBeNull();
  const missing = data.trades.map((t) => ({ ...t, initialRisk: undefined, plannedSL: undefined }));
  expect(projectCurve(j, missing, analyze(j, missing), 'R').every((p) => p.net === null)).toBe(
    true,
  );
  expect(
    projectCurve({ ...j, startingBalance: undefined }, data.trades, result, 'percent').every(
      (p) => p.net === null,
    ),
  ).toBe(true);
});
