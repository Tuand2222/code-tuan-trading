import type { Journal, Trade } from './schema';
import type { Scope } from '../core/analyze';
export { reportHTML } from './reportHTML';
export async function exportReport(journal: Journal, trades: Trade[], scope: Scope = {}) {
  const html = await new Promise<string>((resolve, reject) => {
    const w = new Worker(new URL('../app/report.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      w.terminate();
      if (e.data.ok) resolve(e.data.html);
      else reject(Error(e.data.error));
    };
    w.onerror = () => {
      w.terminate();
      reject(Error('REPORT_WORKER_FAILED'));
    };
    w.postMessage({ journal, trades, scope });
  });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trading-report.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
