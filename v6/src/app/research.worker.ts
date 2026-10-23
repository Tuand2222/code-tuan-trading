import { researchBundle, type Dimension } from '../core/advanced';
import type { Journal, Trade } from '../data/schema';
import type { Scope, analyze } from '../core/analyze';
self.onmessage = (
  e: MessageEvent<{
    key: string;
    journal: Journal;
    trades: Trade[];
    scope: Scope;
    dimensions: Dimension[];
    question: 'missing' | 'loss' | 'review';
    base?: ReturnType<typeof analyze>;
  }>,
) => {
  try {
    const p = e.data;
    self.postMessage({
      ok: true,
      key: p.key,
      result: researchBundle(p.journal, p.trades, p.scope, p.dimensions, p.question, p.base),
    });
  } catch (error) {
    self.postMessage({ ok: false, key: e.data.key, error: String(error) });
  }
};
