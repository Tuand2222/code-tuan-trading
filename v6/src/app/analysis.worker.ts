import { verifyGolden } from '../core/golden';
import { analyze } from '../core/analyze';
import type { Journal, Trade } from '../data/schema';
self.onmessage = (e: MessageEvent<{ journal: Journal; trades: Trade[] }>) => {
  try {
    const result = analyze(e.data.journal, e.data.trades);
    self.postMessage({
      ok: true,
      result,
      golden: e.data.journal.isDemo ? verifyGolden(e.data.journal, e.data.trades, result) : null,
    });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
