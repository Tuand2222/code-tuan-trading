import { useEffect, useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import {
  directoryBackupSupported,
  selectBackupDirectory,
  disableDirectoryBackup,
  writeDirectoryBackup,
} from '../data/autoBackup';
export function AutomaticBackup() {
  const { repo, revision, loading } = useLedger(),
    [error, setError] = useState('');
  useEffect(() => {
    if (loading || !directoryBackupSupported()) return;
    const timer = setTimeout(
      () =>
        void writeDirectoryBackup(repo)
          .then(() => setError(''))
          .catch((e) => setError(String(e))),
      1500,
    );
    return () => clearTimeout(timer);
  }, [repo, revision, loading]);
  return error ? <p role="status">Sao lưu thư mục: {error}</p> : null;
}
export function DirectoryBackup() {
  const { repo } = useLedger(),
    [message, setMessage] = useState('');
  return (
    <section className="panel">
      <h2>Sao lưu tự động vào thư mục</h2>
      <p>
        Nếu trình duyệt hỗ trợ, chọn thư mục một lần. Ứng dụng lưu bản mới khi mở sau 24 giờ hoặc có
        thêm 20 lệnh; mỗi bản có tên thời gian riêng và chứa ảnh, Views cùng dữ liệu. Khi quyền hết
        hạn, hãy chọn lại thư mục.
      </p>
      {directoryBackupSupported() ? (
        <div className="actions">
          <button
            onClick={() =>
              void selectBackupDirectory()
                .then(() => writeDirectoryBackup(repo, true))
                .then(() => setMessage('Đã bật và ghi bản sao đầu tiên.'))
                .catch((e) => setMessage(String(e)))
            }
          >
            Chọn thư mục sao lưu
          </button>
          <button
            onClick={() =>
              void writeDirectoryBackup(repo, true)
                .then((ok) => setMessage(ok ? 'Đã ghi bản sao mới.' : 'Chưa chọn thư mục.'))
                .catch((e) => setMessage(String(e)))
            }
          >
            Sao lưu vào thư mục ngay
          </button>
          <button
            onClick={() =>
              void disableDirectoryBackup().then(() =>
                setMessage('Đã tắt sao lưu thư mục. Các file đã lưu vẫn còn.'),
              )
            }
          >
            Tắt sao lưu thư mục
          </button>
        </div>
      ) : (
        <p>Trình duyệt này chưa hỗ trợ chọn thư mục. Dùng nút tải backup JSON bên trên.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
