import { projectCurve } from '../core/chartProjection';
import { analyze } from '../core/analyze';
import { selectTrades, type Filters } from '../core/filters';
import type { Snapshot } from '../data/snapshot';
self.onmessage = (e: MessageEvent<{ data: Snapshot; filters: Filters }>) => {
  try {
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
    );
    self.postMessage({
      ok: true,
      result,
      projections: {
        money: result.curve,
        percent: projectCurve(journal, trades, result, 'percent'),
        R: projectCurve(journal, trades, result, 'R'),
      },
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
