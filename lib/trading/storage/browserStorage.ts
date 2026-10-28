export async function storageHealth(storage: StorageManager | undefined = typeof navigator === 'undefined' ? undefined : navigator.storage, requestPersistence = false) {
  if (!storage) return { supported: false, persisted: false, usage: undefined, quota: undefined };
  let persisted = await storage.persisted();
  if (requestPersistence && !persisted) persisted = await storage.persist();
  const estimate = await storage.estimate();
  return { supported: true, persisted, usage: estimate.usage, quota: estimate.quota };
}
export function backupReminder(lastBackupAt?: string, now = Date.now()) {
  return { due: !lastBackupAt || !Number.isFinite(Date.parse(lastBackupAt)) || now - Date.parse(lastBackupAt) >= 7 * 24 * 60 * 60 * 1000,
    message: 'Hãy tải bản sao JSON định kỳ. Dữ liệu trên thiết bị có thể mất khi xóa dữ liệu trình duyệt; quyền lưu bền không thay thế sao lưu.' };
}
