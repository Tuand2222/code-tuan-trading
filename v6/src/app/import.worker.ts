import { previewBinance } from '../data/binanceImport';
import type { Journal } from '../data/schema';
self.onmessage = (
  event: MessageEvent<{ raw: string; journal: Journal; basis: 'gross' | 'net' }>,
) => {
  const { raw, journal, basis } = event.data;
  void previewBinance(raw, journal, basis)
    .then((result) => self.postMessage({ ok: true, result }))
    .catch((error) => self.postMessage({ ok: false, error: String(error) }));
};
