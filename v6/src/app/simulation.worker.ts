import { monteCarlo } from '../core/advanced';
self.onmessage = (
  event: MessageEvent<{ values: number[]; seed: number; steps: number; milestone: number }>,
) => {
  try {
    const p = event.data;
    self.postMessage({
      ok: true,
      result: monteCarlo(p.values, p.seed, p.steps, 1000, p.milestone),
    });
  } catch (e) {
    self.postMessage({ ok: false, error: String(e) });
  }
};
