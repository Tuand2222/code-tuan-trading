import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import original from '../golden/fixture-30-trades.json';
import { migrateV3 } from '../../src/data/migrateV3';
import { mergeSnapshots } from '../../src/data/mergeSnapshot';
import { JournalRepository } from '../../src/data/repository';
import { mergeWorkspace, prepareWorkspaceMerge } from '../../src/data/workspaceMerge';
import { exportWorkspace } from '../../src/data/workspaceBackup';
import { viewRepository } from '../../src/data/views';
import { canonical } from '../../src/data/backup';
import { readTables } from '../../src/data/tableReader';
import { tableCSV } from '../../src/data/importTables';
import { readBrowserLegacy } from '../../src/data/browserLegacy';
import { journalWorkbook } from '../../src/data/excelReport';

it('unions identical old/new histories once, including all notes and raw sources', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  const other = structuredClone(data);
  other.journals[0].createdAt = '2026-10-23T00:00:00Z';
  const merged = await mergeSnapshots(data, other);
  expect(merged.report).toEqual({ added: 0, duplicates: 30, conflictJournals: 0 });
  expect(merged.data.trades).toHaveLength(30);
  expect(canonical(merged.data.notes)).toBe(canonical(data.notes));
});
it('preserves a conflicting journal, its notes and references in an archived branch without changing active facts', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  const other = structuredClone(data);
  other.trades[0].legs[1].price = String(Number(other.trades[0].legs[1].price) + 1);
  const merged = await mergeSnapshots(data, other);
  expect(merged.report.conflictJournals).toBe(1);
  expect(merged.data.journals).toHaveLength(2);
  expect(merged.data.journals[1].archivedAt).toBeTruthy();
  expect(merged.data.trades).toHaveLength(60);
  expect(canonical(merged.data.trades.slice(0, 30))).toBe(canonical(data.trades));
  expect(merged.data.notes).toHaveLength(60);
  const repeated = await mergeSnapshots(merged.data, other);
  expect(repeated.data.trades).toHaveLength(60);
});
it('merges instead of replacing, verifies before writing, keeps recovery and rejects stale previews', async () => {
  const repo = new JournalRepository('merge-' + crypto.randomUUID());
  try {
    await repo.importV3(JSON.stringify(original), 0);
    const raw = await exportWorkspace(repo);
    const before = await repo.snapshot();
    const preview = await prepareWorkspaceMerge(raw, repo);
    expect(preview.report.duplicates).toBe(30);
    expect(canonical(await repo.snapshot())).toBe(canonical(before));
    await mergeWorkspace(raw, repo, 1);
    expect((await repo.snapshot()).data.trades).toHaveLength(30);
    expect(await viewRepository.meta.get('before-workspace-restore')).toBeTruthy();
    await expect(mergeWorkspace(raw, repo, 1)).rejects.toThrow('STALE_REVISION');
    const bad = JSON.parse(raw);
    bad.views.push({ name: 'tampered', hash: '#journal' });
    await expect(mergeWorkspace(JSON.stringify(bad), repo, 2)).rejects.toThrow('CHECKSUM_MISMATCH');
    expect((await repo.snapshot()).revision).toBe(2);
  } finally {
    await repo.delete();
    await viewRepository.meta.clear();
    await viewRepository.views.clear();
  }
});
it('reads browser legacy without filtering demo records or modifying its database', async () => {
  const name = 'trading-plan-pro-ledger-v3';
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      for (const table of ['accounts', 'batches', 'fills', 'cashEvents', 'overlays'])
        req.result.createObjectStore(table, { autoIncrement: true });
      req.result.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
  });
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction([...db.objectStoreNames], 'readwrite');
      for (const table of ['accounts', 'batches', 'fills', 'cashEvents', 'overlays'] as const)
        for (const row of original.data[table]) tx.objectStore(table).add(row);
      tx.objectStore('meta').put({ key: 'settings', value: original.data.settings });
      tx.oncomplete = () => resolve();
    });
    const raw = await readBrowserLegacy();
    expect((await migrateV3(raw!)).data.trades).toHaveLength(30);
    expect(JSON.parse(raw!).data.fills).toHaveLength(60);
  } finally {
    db.close();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
    });
  }
});
it('retains exact spreadsheet decimal text, multiple sheets and the Excel 1904 date system', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Symbol', 'Time', 'Side', 'Price', 'Qty'],
      ['BTCUSDT', 45000.5, 'BUY', '0.00000001', '1'],
    ]),
    'Fills',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Symbol', 'Time', 'Side', 'Price', 'Qty'],
      ['ETHUSDT', 45000.5, 'SELL', '2', '1'],
    ]),
    'More',
  );
  workbook.Workbook = { WBProps: { date1904: true } };
  const tables = readTables(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
    'history.xlsx',
  );
  expect(tables).toHaveLength(2);
  expect(tableCSV(tables[0])).toContain('2027-03-16T12:00:00.000Z');
  expect(tableCSV(tables[0])).toContain('0.00000001');
});
it('exports all journal notes and preserves unknown Net and risk as empty cells, without formulas', async () => {
  const { data } = await migrateV3(JSON.stringify(original));
  data.trades[0].costsKnown = false;
  data.trades[0].initialRisk = undefined;
  data.notes[0].body = '=HYPERLINK("https://example.com")';
  const wb = journalWorkbook(data, data.journals[0].id);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Lenh);
  expect(rows).toHaveLength(30);
  expect(rows[0].Net).toBeNull();
  expect(rows[0].Risk).toBeNull();
  expect(XLSX.utils.sheet_to_json(wb.Sheets['Ghi chu'])).toHaveLength(30);
  expect(wb.Sheets['Ghi chu'].C2.f).toBeUndefined();
  expect(wb.Sheets['Ghi chu'].C2.t).toBe('s');
});
