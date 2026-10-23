import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { viewRepository } from '../data/views';
import { useLedger } from '../app/LedgerContext';
import { readBrowserLegacy } from '../data/browserLegacy';
import { mergeWorkspace, prepareWorkspaceMerge } from '../data/workspaceMerge';

export function WorkspaceMerge() {
  const { repo, busy } = useLedger();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof prepareWorkspaceMerge>>>();
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const receipt = useLiveQuery(() => viewRepository.meta.get('last-workspace-merge'), []);
  async function inspect(value: string) {
    setPending(true);
    setPreview(undefined);
    setMessage('');
    try {
      setPreview(await prepareWorkspaceMerge(value, repo));
      setRaw(value);
    } catch (error) {
      setMessage('Chưa thể gộp; dữ liệu hiện tại được giữ nguyên. ' + String(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel">
      <h2>Gộp dữ liệu web cũ và v6</h2>
      <p>
        Giữ lệnh và ghi chú hiện có, bỏ bản trùng hoàn toàn. Bản khác được giữ trong sổ lưu trữ
        riêng để kiểm tra. Hệ thống tạo bản sao trước khi gộp; cơ sở dữ liệu cũ vẫn được giữ.
      </p>
      <button
        disabled={pending || busy}
        onClick={() => {
          setPending(true);
          setPreview(undefined);
          void readBrowserLegacy()
            .then((value) =>
              value
                ? inspect(value)
                : setMessage('Không tìm thấy sổ web cũ trong trình duyệt này.'),
            )
            .catch((e) => setMessage(String(e)))
            .finally(() => setPending(false));
        }}
      >
        Đọc dữ liệu web cũ trên thiết bị
      </button>
      <label>
        Chọn bản sao để gộp
        <input
          type="file"
          accept=".json"
          disabled={pending || busy}
          onChange={(e) => {
            setPreview(undefined);
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 100 * 1024 * 1024) {
              setMessage('Tối đa 100 MB.');
              return;
            }
            void file
              .text()
              .then(inspect)
              .catch((error) => setMessage(String(error)));
          }}
        />
      </label>
      {preview && (
        <div className="preview">
          <p>
            {preview.report.added} lệnh thêm · {preview.report.duplicates} lệnh trùng ·{' '}
            {preview.report.conflictJournals} sổ có bản khác. Sau gộp: {preview.data.trades.length}{' '}
            lệnh, {preview.data.notes.length} ghi chú.
          </p>
          <button
            className="primary"
            disabled={pending || busy}
            onClick={() => {
              setPending(true);
              void mergeWorkspace(raw, repo, preview.revision)
                .then(() => {
                  setPreview(undefined);
                  setMessage('Đã gộp dữ liệu và lưu bản sao trước khôi phục.');
                })
                .catch((e) => setMessage('Chưa thể gộp: ' + String(e)))
                .finally(() => setPending(false));
            }}
          >
            Gộp và giữ dữ liệu hiện có
          </button>
        </div>
      )}
      {pending && <p role="status">Đang đối chiếu dữ liệu…</p>}
      {message && <p role="status">{message}</p>}
      {!message && !pending && !preview && receipt && (
        <p role="status">Đã gộp dữ liệu và lưu bản sao trước khôi phục.</p>
      )}
    </section>
  );
}
