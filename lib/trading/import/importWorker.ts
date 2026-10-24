import { readTables } from './tableReader';
import { getAdapter } from './adapters';
import type { ConnectorId, ParseContext, RawRow } from './types';
type Request = { id: string } & ({ action: 'read'; bytes: ArrayBuffer; filename: string } | { action: 'parse'; connector: ConnectorId; rows: RawRow[]; context: ParseContext });
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    let result;
    if (data.action === 'read') {
      const fileSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data.bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
      result = readTables(data.bytes, data.filename).map(s => ({ ...s, name: s.name === data.filename ? data.filename : `${data.filename} · ${s.name}`, fileName: data.filename, fileSha256 }));
    } else result = await getAdapter(data.connector).parse(data.rows, data.context);
    self.postMessage({ id: data.id, result });
  }
  catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
};
