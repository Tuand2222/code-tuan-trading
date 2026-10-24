import type { ConnectorId, ParseContext, Parsed, RawRow, SheetSample } from './types';
function request<T>(payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new Error('Đã hủy đọc file.')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Đọc file quá lâu; hãy chia file nhỏ hơn.')); }, 120000);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => { cleanup(); if (data.error) reject(new Error(data.error)); else resolve(data.result); };
    worker.onerror = () => { cleanup(); reject(new Error('Không khởi chạy được bộ đọc file.')); };
    worker.postMessage({ id: crypto.randomUUID(), ...payload });
  });
}
export const readFileWorker = async (file: File, signal?: AbortSignal) => {
  if (file.size > 10 * 1024 * 1024) throw new Error('File vượt giới hạn 10 MB.');
  return request<SheetSample[]>({ action: 'read', bytes: await file.arrayBuffer(), filename: file.name }, signal);
};
export const parseRowsWorker = (connector: ConnectorId, rows: RawRow[], context: ParseContext, signal?: AbortSignal) => request<Parsed>({ action: 'parse', connector, rows, context }, signal);
