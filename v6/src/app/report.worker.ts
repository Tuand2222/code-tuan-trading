import { reportHTML } from '../data/reportHTML';
import type { Journal, Trade } from '../data/schema';
import type { Scope } from '../core/analyze';
self.onmessage = (e: MessageEvent<{ journal: Journal; trades: Trade[]; scope: Scope }>) => {
  try {
    self.postMessage({ ok: true, html: reportHTML(e.data.journal, e.data.trades, e.data.scope) });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
