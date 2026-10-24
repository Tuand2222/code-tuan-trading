import { previewFIFO } from '../data/fifoImport';
self.onmessage = async (e: MessageEvent<Parameters<typeof previewFIFO>>) => {
  try {
    self.postMessage({ ok: true, result: await previewFIFO(...e.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
