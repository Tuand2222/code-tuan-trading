import { withTradeFactsCache } from '../core/trade';
import { journalAlerts, health } from '../core/journalSelectors';
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
      const message = {
        ok: true,
        result,
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
      }
      self.postMessage(message);
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
