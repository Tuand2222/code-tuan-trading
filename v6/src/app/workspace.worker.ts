import { withTradeFactsCache } from '../core/trade';
import { sum } from '../core/money';
import { displayMetric } from '../core/displayMetrics';
import vi from '../i18n/vi.json';
import type { FormatKind } from '../ui/format';
import { classicReport } from '../core/classic';
import { journalAlerts, health } from '../core/journalSelectors';
import { projectCurve } from '../core/chartProjection';
import { analyze } from '../core/analyze';
import { selectTrades, type Filters } from '../core/filters';
import type { Snapshot } from '../data/snapshot';
self.onmessage = (e: MessageEvent<{ data: Snapshot; filters: Filters; page?: string }>) => {
  const calculationStart = performance.now();
  try {
    withTradeFactsCache(() => {
      const { data, filters } = e.data;
      const journal =
        data.journals.find((j) => j.id === filters.journal && !j.archivedAt) ??
        data.journals.find((j) => !j.archivedAt);
      if (!journal) throw Error('NO_JOURNAL');
      const trades = selectTrades(data.trades, filters, journal.id);
      const result = analyze(
        journal,
        trades,
        { from: filters.from || undefined, to: filters.to || undefined },
        data.cashFlows,
        { inference: ['edge', 'metrix', 'system'].includes(e.data.page ?? '') },
      );
      const marketBase = filters.market
        ? analyze(
            journal,
            selectTrades(data.trades, { ...filters, market: '' }, journal.id),
            { from: filters.from || undefined, to: filters.to || undefined },
            [],
            { inference: false },
          )
        : result;
      const marketsById = new Map(data.trades.map((t) => [t.id, t.market]));
      const message = {
        ok: true,
        result,
        displayMetrics: Object.fromEntries(
          Object.entries(result.metrics).map(([id, metric]) => [
            id,
            displayMetric(
              id,
              metric,
              result,
              journal,
              vi.metricHelp[id as keyof typeof vi.metricHelp].kind as FormatKind,
            ),
          ]),
        ),
        report: classicReport({ journal, trades: data.trades }, filters, 0, 5, 10, result),
        rollups: ['commodities', 'stocks', 'crypto', 'forex'].map((market) => {
          const events = marketBase.events.filter((e) => marketsById.get(e.tradeId) === market);
          return {
            market,
            total: String(marketBase.closed.filter((f) => f.trade.market === market).length),
            net:
              events.length && events.every((e) => e.net !== undefined)
                ? sum(events.map((e) => e.net!))
                : null,
          };
        }),
        alerts: journalAlerts(
          journal,
          data.trades,
          data.plans.find((p) => p.journalId === journal.id),
          undefined,
          !filters.from &&
            !filters.to &&
            trades.length === data.trades.filter((t) => t.journalId === journal.id).length
            ? result
            : undefined,
        ),
        health: health(data, journal.id),
        projections: {
          money: result.curve,
          percent: projectCurve(journal, trades, result, 'percent', data.cashFlows),
          R: projectCurve(journal, trades, result, 'R'),
        },
        calculationMs: performance.now() - calculationStart,
        compact: e.data.page === 'overview',
      };
      if (message.compact) {
        message.result = {
          ...result,
          closed: [],
          open: [],
          events: [],
          curve: [],
          queue: result.queue.slice(0, 5),
        };
        message.report = { ...message.report, ordered: [] };
        const unit = journal.settings.displayUnit;
        message.projections = {
          money: unit === 'money' ? message.projections.money : [],
          percent: unit === 'percent' ? message.projections.percent : [],
          R: unit === 'R' ? message.projections.R : [],
        };
      }
      self.postMessage(message);
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
