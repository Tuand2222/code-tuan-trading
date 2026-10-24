import Dexie, { type Table } from 'dexie';
import type { JournalRepository } from './repository';
import { exportWorkspace } from './workspaceBackup';
import { viewRepository } from './views';
type BackupDirectory = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
};
class BackupPreferences extends Dexie {
  handles!: Table<{ id: string; directory: BackupDirectory }, string>;
  constructor() {
    super('tuan-trader-v6-backup-directory');
    this.version(1).stores({ handles: 'id' });
  }
}
const preferences = new BackupPreferences();
let writing = false;
export const directoryBackupSupported = () => 'showDirectoryPicker' in window;
export async function selectBackupDirectory() {
  const picker = (
    window as unknown as {
      showDirectoryPicker: (options: { mode: string }) => Promise<BackupDirectory>;
    }
  ).showDirectoryPicker;
  const directory = await picker({ mode: 'readwrite' });
  await preferences.handles.put({ id: 'backup', directory });
}
export async function disableDirectoryBackup() {
  await preferences.handles.delete('backup');
}
export async function writeDirectoryBackup(repo: JournalRepository, force = false) {
  if (writing) return false;
  writing = true;
  try {
    const row = await preferences.handles.get('backup');
    if (!row) return false;
    if ((await row.directory.queryPermission({ mode: 'readwrite' })) !== 'granted')
      throw Error('Quyền thư mục đã hết. Chọn lại thư mục để tiếp tục sao lưu.');
    const snapshot = await repo.snapshot(),
      last = await viewRepository.meta.get('directoryBackupAt'),
      count = await viewRepository.meta.get('directoryBackupTradeCount');
    if (
      !force &&
      last &&
      Date.now() - Date.parse(last.value) < 86400000 &&
      snapshot.data.trades.length - Number(count?.value ?? 0) < 20
    )
      return false;
    const raw = await exportWorkspace(repo),
      stamp = new Date().toISOString();
    const file = await row.directory.getFileHandle(
      'trading-plan-pro-' + stamp.replace(/[:.]/g, '-') + '.json',
      { create: true },
    );
    const stream = await file.createWritable();
    try {
      await stream.write(raw);
      await stream.close();
    } catch (e) {
      await stream.abort().catch(() => {});
      throw e;
    }
    await viewRepository.meta.bulkPut([
      { key: 'directoryBackupAt', value: stamp },
      { key: 'directoryBackupTradeCount', value: String(snapshot.data.trades.length) },
      { key: 'lastBackupAt', value: stamp },
      { key: 'backupTradeCount', value: String(snapshot.data.trades.length) },
    ]);
    return true;
  } finally {
    writing = false;
  }
}
