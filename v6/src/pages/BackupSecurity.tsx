import { useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import { encryptBackup, decryptBackup } from '../data/encryptedBackup';
import { exportWorkspace, previewWorkspace, restoreWorkspace } from '../data/workspaceBackup';
export function BackupSecurity() {
  const { repo, revision, busy } = useLedger();
  const [password, setPassword] = useState(''),
    [raw, setRaw] = useState(''),
    [version, setVersion] = useState(0),
    [message, setMessage] = useState(''),
    [working, setWorking] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel">
      <h2>Backup mã hóa tùy chọn</h2>
      <p>
        AES-256-GCM, khóa dẫn xuất PBKDF2-SHA256. Mật khẩu không được lưu; mất mật khẩu sẽ không
        khôi phục được file. Bản backup thường vẫn dùng được.
      </p>
      <label>
        Mật khẩu backup
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setRaw('');
            setConfirmed(false);
          }}
        />
      </label>
      <button
        disabled={busy || working || password.length < 8}
        onClick={() => {
          setWorking(true);
          void exportWorkspace(repo)
            .then((raw) => encryptBackup(raw, password))
            .then((raw) => {
              const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = 'workspace-encrypted.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage('Đã xuất backup mã hóa.');
            })
            .catch((e) => setMessage(String(e)))
            .finally(() => setWorking(false));
        }}
      >
        Xuất backup mã hóa
      </button>
      <label>
        Mở backup mã hóa
        <input
          type="file"
          accept=".json"
          disabled={working || password.length < 8}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setRaw('');
            setConfirmed(false);
            if (!f) return;
            if (f.size > 150 * 1024 * 1024) {
              setMessage('File quá lớn.');
              return;
            }
            const rev = revision;
            setWorking(true);
            void f
              .text()
              .then((raw) => decryptBackup(raw, password))
              .then(async (raw) => {
                const preview = await previewWorkspace(raw, repo);
                setRaw(raw);
                setVersion(rev);
                setMessage(
                  `Giải mã hợp lệ: ${preview.data.journals.length} sổ, ${preview.data.trades.length} lệnh. Chưa ghi dữ liệu.`,
                );
              })
              .catch(() => setMessage('Không giải mã được: mật khẩu sai hoặc file bị thay đổi.'))
              .finally(() => setWorking(false));
          }}
        />
      </label>
      {raw && (
        <>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Tôi đã kiểm tra và muốn thay workspace bằng bản giải mã.
          </label>
          <button
            disabled={busy || working || !confirmed}
            onClick={() => {
              setWorking(true);
              void restoreWorkspace(raw, repo, version)
                .then(() => {
                  setRaw('');
                  setPassword('');
                  setMessage('Đã khôi phục bản mã hóa.');
                })
                .catch((e) => setMessage(String(e)))
                .finally(() => setWorking(false));
            }}
          >
            Khôi phục bản giải mã
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
