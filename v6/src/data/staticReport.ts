import type { Journal, Trade } from './schema';
import type { Scope } from '../core/analyze';
export { reportHTML } from './reportHTML';
export async function exportReport(journal: Journal, trades: Trade[], scope: Scope = {}) {
  const html = await buildReport(journal, trades, scope);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trading-report.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function buildReport(journal: Journal, trades: Trade[], scope: Scope) {
  return new Promise<string>((resolve, reject) => {
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
}
export async function printReport(journal: Journal, trades: Trade[], scope: Scope = {}) {
  const html = await buildReport(journal, trades, scope),
    frame = document.createElement('iframe');
  frame.title = 'Báo cáo để in PDF';
  frame.style.cssText = 'position:fixed;left:-10000px;width:1024px;height:768px';
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', () => frame.remove(), { once: true });
    frame.contentWindow?.print();
  };
  document.body.append(frame);
  setTimeout(() => frame.remove(), 120000);
}
