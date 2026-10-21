import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import original from '../golden/fixture-30-trades.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { JournalRepository } from '../../src/data/repository';
import {
  manualTrade,
  saveTrade,
  reviewTrade,
  toggleStar,
  ensureCatalog,
  tradeLifecycle,
  parseChecklist,
} from '../../src/data/tradeCommands';
import { tradeFacts } from '../../src/core/trade';
import { analyze } from '../../src/core/analyze';
import { journalAlerts, calendarMonth } from '../../src/core/journalSelectors';
import { classicReport, classicYear } from '../../src/core/classic';
import { emptyFilters } from '../../src/core/filters';
const fixture = async () => (await migrateV3(JSON.stringify(original))).data;
it('QT02 keeps checklist IDs stable across edits, marks removed criteria for relinking and detects 48h missing risk', async () => {
  const data = await fixture(),
    j = data.journals[0],
    trade = data.trades[0];
  const checklist = parseChecklist('A | 2\nB | 3');
  expect(parseChecklist('B | 4\nA | 2', checklist).map((c) => c.id)).toEqual([
    checklist[1].id,
    checklist[0].id,
  ]);
  const setup = data.setups.find((s) => s.id === trade.setupId)!;
  setup.checklist = checklist;
  trade.checklist = [{ criterionId: checklist[0].id, checked: true }];
  expect(tradeLifecycle(trade, data)).toBe('reviewed');
  setup.checklist = [];
  expect(tradeLifecycle(trade, data)).toBe('relink');
  trade.initialRisk = undefined;
  trade.plannedSL = undefined;
  const plan = {
    journalId: j.id,
    allowedSetupIds: [],
    sessionWindows: [],
    alertRules: [
      {
        id: 'missing',
        kind: 'missing-data' as const,
        enabled: true,
        threshold: '48',
        unit: 'hours' as const,
        severity: 'info' as const,
      },
    ],
  };
  const close = tradeFacts(trade).closeTime!;
  expect(
    journalAlerts(j, [trade], plan, new Date(Date.parse(close) + 47 * 3600000).toISOString()),
  ).toHaveLength(0);
  expect(
    journalAlerts(j, [trade], plan, new Date(Date.parse(close) + 48 * 3600000).toISOString())[0]
      .tradeIds,
  ).toEqual([trade.id]);
});
it('F08 preserves classic report controls and original metrics through the shared ledger', async () => {
  const d = await fixture(),
    journal = d.journals[0],
    source = { journal, trades: d.trades };
  const report = classicReport(source, { ...emptyFilters, journal: journal.id }, 200000000);
  expect(report.metrics.net.value).toBe('3302290');
  expect(report.balance).toBe(203302290);
  expect(report.metrics.winRate.value).toBe('60');
  expect(report.riskCount).toBe(30);
  expect(report.rows.reduce((s, d) => s + d.pnl, 0)).toBe(3302290);
  const year = classicYear(2026, source, { ...emptyFilters, journal: journal.id }, 200000000);
  expect(year.total).toBe(30);
  expect(year.net).toBe(3302290);
  expect(year.discipline).toBe(85);
  expect(classicYear(2025, source, emptyFilters, 200000000).hasData).toBe(false);
});
it('QT02 keeps exact manual trade facts, previews Net/R, saves atomically and updates every selector', async () => {
  const data = await fixture();
  data.journals[0].timezone = 'Asia/Ho_Chi_Minh';
  const journal = data.journals[0];
  const t = manualTrade(
    {
      symbol: 'TEST',
      market: 'stocks',
      side: 'long',
      status: 'closed',
      open: '2026-10-20T09:00',
      close: '2026-10-20T10:00',
      entry: '100',
      exit: '110',
      quantity: '10',
      multiplier: '1',
      risk: '50',
      sl: '95',
      tp: '120',
      commission: '2',
      tax: '1',
      funding: '-1',
      swap: '0',
      other: '0',
      costsKnown: true,
      setupId: '',
      note: 'test',
    },
    journal,
  );
  expect(tradeFacts(t)).toMatchObject({ gross: '100', net: '98', r: '1.96', holdMinutes: 60 });
  expect(t.legs[0].time).toBe('2026-10-20T02:00:00.000Z');
  const next = saveTrade(data, t, 'test');
  expect(data.trades).toHaveLength(30);
  expect(next.trades).toHaveLength(31);
  expect(analyze(journal, next.trades).metrics.net.value).toBe('3302388');
  expect(calendarMonth(journal, next.trades, '2026-10').net).toBe('1389728');
  const repo = new JournalRepository('s3-' + crypto.randomUUID());
  try {
    await repo.commit(data, 0);
    await repo.commit(next, 1);
    const reload = await repo.snapshot();
    expect(reload.data.trades.at(-1)?.id).toBe(t.id);
    await expect(repo.commit(data, 1)).rejects.toThrow('STALE_REVISION');
  } finally {
    await repo.delete();
  }
  expect(() =>
    manualTrade({ symbol: 'X' } as Parameters<typeof manualTrade>[0], journal),
  ).toThrow();
});
it('QT02/QT03 review and inline updates preserve legacy scores and T-R1 bias thresholds', async () => {
  let data = await fixture();
  const journal = data.journals[0],
    before = analyze(journal, data.trades);
  expect(before.shadow.bias).toBe(true);
  for (let i = 0; i < 6; i++) {
    const next = analyze(journal, data.trades).queue[0];
    data = reviewTrade(data, next.id, true, 'Đã đối chiếu', false);
    const a = analyze(journal, data.trades);
    if (i === 2) expect(a.shadow.bias).toBe(true);
    if (i === 3 || i === 5) expect(a.shadow.bias).toBe(false);
  }
  expect(analyze(journal, data.trades).metrics.discipline.value).toBe('85');
  const id = data.trades[0].id;
  const starred = toggleStar(data, id);
  expect(starred.trades[0].starred).toBe(true);
  expect(data.trades[0].starred).toBe(false);
  const catalog = ensureCatalog(data, journal.id);
  expect(catalog.errorTags.filter((t) => t.journalId === journal.id && t.hotkey)).toHaveLength(9);
  expect(tradeLifecycle(data.trades[0], data)).toBe('reviewed');
  expect(() => reviewTrade(data, id, true, '', false)).toThrow('REVIEW_NOTE_REQUIRED');
  expect(parseChecklist('Đúng xu hướng | 2\nĐủ điều kiện | 3')).toHaveLength(2);
  expect(() => parseChecklist('Sai | 0')).toThrow();
});
it('F05 configurable alerts identify the original MWG trade, and F10 calendar reconciles October/week 42', async () => {
  const data = await fixture(),
    journal = data.journals[0];
  const alerts = journalAlerts(journal, data.trades, undefined);
  const mwg = data.trades.find(
    (t) => t.symbol === 'MWG' && tradeFacts(t).closeTime?.startsWith('2026-10-15'),
  )!;
  expect(alerts.some((a) => a.tradeIds.includes(mwg.id) && a.rule === 'loss-over-r')).toBe(true);
  const m = calendarMonth(journal, data.trades, '2026-10');
  expect(m.net).toBe('1389630');
  expect(m.weeks.find((w) => w.label === '2026-W42')?.net).toBe('143950');
  expect(m.days.find((d) => d.date === '2026-10-15')?.tradeIds).toContain(mwg.id);
  expect(
    journalAlerts(journal, data.trades, {
      journalId: journal.id,
      allowedSetupIds: [],
      sessionWindows: [],
      alertRules: [
        {
          id: 'off',
          kind: 'loss-over-r',
          enabled: false,
          threshold: '1',
          unit: 'R',
          severity: 'warning',
        },
      ],
    }),
  ).toHaveLength(0);
});
