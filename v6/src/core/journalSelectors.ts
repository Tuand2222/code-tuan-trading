import type { Journal, Trade, Plan, AlertRule } from '../data/schema';
import type { Snapshot } from '../data/snapshot';
import { analyze, dayInZone } from './analyze';
import { tradeFacts } from './trade';
import { D, dec, sum } from './money';
import { tradeLifecycle } from './lifecycle';
import { getISOWeek, getISOWeekYear } from 'date-fns';
export interface JournalAlert {
  id: string;
  rule: AlertRule['kind'];
  severity: string;
  tradeIds: string[];
  date?: string;
  value: string;
  threshold: string;
}
export function journalAlerts(
  journal: Journal,
  trades: Trade[],
  plan?: Plan,
  now = new Date().toISOString(),
): JournalAlert[] {
  const result = analyze(journal, trades);
  const rules = plan?.alertRules ?? [
    {
      id: 'default-loss',
      kind: 'loss-over-r' as const,
      enabled: true,
      threshold: '1',
      toleranceR: journal.settings.lossToleranceR,
      unit: 'R' as const,
      severity: 'warning' as const,
    },
  ];
  const alerts: JournalAlert[] = [];
  for (const rule of rules.filter((r) => r.enabled)) {
    const push = (tradeIds: string[], value: string, date?: string) =>
      alerts.push({
        id: rule.id + ':' + (date ?? tradeIds.join('|')),
        rule: rule.kind,
        severity: rule.severity,
        tradeIds,
        value,
        threshold: rule.threshold,
        date,
      });
    if (rule.kind === 'missing-data') {
      for (const trade of trades.filter((t) => t.journalId === journal.id)) {
        const f = tradeFacts(trade);
        if (
          f.closeTime &&
          Date.parse(now) - Date.parse(f.closeTime) >= Number(rule.threshold) * 3600000 &&
          (!f.risk || !trade.costsKnown)
        )
          push([trade.id], String((Date.parse(now) - Date.parse(f.closeTime)) / 3600000));
      }
    }
    if (rule.kind === 'loss-over-r')
      for (const f of result.closed)
        if (
          f.r &&
          D(f.r).lte(
            D(rule.threshold)
              .plus(rule.toleranceR ?? '0.10')
              .neg(),
          )
        )
          push([f.id], f.r);
    if (rule.kind === 'daily-count')
      for (const d of result.days)
        if (d.closed > Number(rule.threshold))
          push(
            result.closed
              .filter((f) => dayInZone(f.closeTime!, journal.timezone) === d.date)
              .map((f) => f.id),
            String(d.closed),
            d.date,
          );
    if (rule.kind === 'daily-loss')
      for (const d of result.days) {
        const es = result.events.filter((e) => dayInZone(e.time, journal.timezone) === d.date);
        const value =
          rule.unit === 'R'
            ? es.every(
                (e) =>
                  e.net !== undefined && tradeFacts(trades.find((t) => t.id === e.tradeId)!).risk,
              )
              ? sum(
                  es.map((e) =>
                    dec(D(e.net!).div(tradeFacts(trades.find((t) => t.id === e.tradeId)!).risk!)),
                  ),
                )
              : null
            : d.net;
        if (value !== null && D(value).lte(D(rule.threshold).neg()))
          push([...new Set(es.map((e) => e.tradeId))], value, d.date);
      }
    if (rule.kind === 'drawdown' && result.currentDrawdown !== null) {
      const value =
        rule.unit === 'percent'
          ? journal.startingBalance && D(journal.startingBalance).gt(0)
            ? dec(D(result.currentDrawdown).div(journal.startingBalance).mul(100))
            : null
          : rule.unit === 'R'
            ? result.meanRisk
              ? dec(D(result.currentDrawdown).div(result.meanRisk))
              : null
            : result.currentDrawdown;
      if (value !== null && D(value).gte(rule.threshold) && result.closed.length)
        push([result.closed.at(-1)!.id], value);
    }
    if (
      rule.kind === 'loss-streak' &&
      result.metrics.currentStreak.value &&
      D(result.metrics.currentStreak.value).lte(D(rule.threshold).neg())
    )
      push(
        result.closed.slice(-Number(rule.threshold)).map((f) => f.id),
        result.metrics.currentStreak.value,
      );
  }
  return alerts;
}
export function calendarMonth(journal: Journal, trades: Trade[], month: string) {
  const r = analyze(journal, trades, { from: month + '-01', to: month + '-31' });
  const days = r.days.map((d) => ({
    ...d,
    tradeIds: [
      ...new Set(
        r.events
          .filter((e) => dayInZone(e.time, journal.timezone) === d.date)
          .map((e) => e.tradeId),
      ),
    ],
    week: `${getISOWeekYear(new Date(d.date + 'T12:00:00Z'))}-W${String(getISOWeek(new Date(d.date + 'T12:00:00Z'))).padStart(2, '0')}`,
  }));
  return { days, weeks: r.weeks, net: r.metrics.net.value };
}
export function health(data: Snapshot, journalId: string) {
  const trades = data.trades.filter((t) => t.journalId === journalId);
  return {
    total: trades.length,
    missingRisk: trades.filter((t) => !tradeFacts(t).risk).length,
    knownCosts: trades.filter((t) => t.costsKnown).length,
    pending: trades.filter((t) => tradeLifecycle(t, data) === 'pending').length,
    relink: trades.filter((t) => tradeLifecycle(t, data) === 'relink').length,
  };
}
