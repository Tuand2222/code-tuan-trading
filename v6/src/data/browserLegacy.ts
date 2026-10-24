import { canonical, sha256 } from './backup';

// Read the original database in one read-only transaction. No schema upgrade,
// deletion, demo filter or second ledger writer is allowed in this bridge.
export async function readBrowserLegacy(): Promise<string | undefined> {
  if (!(await indexedDB.databases()).some((db) => db.name === 'trading-plan-pro-ledger-v3')) return;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('trading-plan-pro-ledger-v3');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const names = ['accounts', 'batches', 'fills', 'cashEvents', 'overlays', 'meta'];
    const rows = await new Promise<unknown[][]>((resolve, reject) => {
      const tx = db.transaction(names, 'readonly');
      const result: unknown[][] = [];
      names.forEach((name, index) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          result[index] = request.result;
        };
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error('LEGACY_READ_ABORTED'));
    });
    if (!rows[0].length) return;
    const settings =
      (rows[5] as { key: string; value: unknown }[]).find((r) => r.key === 'settings')?.value ?? {};
    const body = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      data: {
        accounts: rows[0],
        batches: rows[1],
        fills: rows[2],
        cashEvents: rows[3],
        overlays: rows[4],
        settings,
      },
    };
    return canonical({ ...body, checksum: await sha256(canonical(body)) });
  } finally {
    db.close();
  }
}
