import { useEffect, useState, type ReactNode } from 'react';
import '../app/cloud.css';
import { useLedger } from '../app/LedgerContext';
import {
  cloudBinding,
  cloudIdentity,
  cloudStatus,
  enableCloud,
  disableCloud,
  syncJournal,
  cloudManifest,
  cloudVersions,
  recoverCloudRecord,
  classicArchiveStatus,
  recordCloudFailure,
  previewCloudArchive,
  restoreCloudArchive,
  type CloudRow,
  type SyncResult,
} from '../data/cloudJournal';

export function CloudAutoSync() {
  const { repo, revision } = useLedger();
  useEffect(() => {
    const run = () => {
      void cloudBinding()
        .then((b) => {
          if (b?.enabled && navigator.onLine) return syncJournal(repo);
        })
        .catch((error) => {
          if (!String(error).includes('Đang đồng bộ')) void recordCloudFailure(error);
        });
    };
    const timer = setTimeout(run, 1500),
      interval = setInterval(run, 60000);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
    };
  }, [repo, revision]);
  return null;
}
export default function CloudArchive() {
  const { repo, data, revision } = useLedger();
  const [identity, setIdentity] = useState<Awaited<ReturnType<typeof cloudIdentity>>>(),
    [binding, setBinding] = useState<Awaited<ReturnType<typeof cloudBinding>>>();
  const [status, setStatus] = useState<SyncResult>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [rows, setRows] = useState<CloudRow[]>([]),
    [selected, setSelected] = useState(''),
    [versions, setVersions] = useState<Awaited<ReturnType<typeof cloudVersions>>>([]);
  const [exportCursor, setExportCursor] = useState(''),
    [exportRevision, setExportRevision] = useState<number>(),
    [part, setPart] = useState(1),
    [archiveFiles, setArchiveFiles] = useState<string[]>([]),
    [preview, setPreview] = useState<Awaited<ReturnType<typeof previewCloudArchive>>>();
  const [archivedImages, setArchivedImages] = useState<
    { id: string; filename: string; tradeId: string; archivedAt: string }[]
  >([]);
  const [imageCursor, setImageCursor] = useState<string | null>(null);
  const [classicStatus, setClassicStatus] =
    useState<Awaited<ReturnType<typeof classicArchiveStatus>>>();
  const refresh = async () => {
    const state = await Promise.all([
      cloudIdentity(),
      cloudBinding(),
      cloudStatus(),
      classicArchiveStatus(),
    ]);
    setIdentity(state[0]);
    setBinding(state[1]);
    setStatus(state[2]);
    setClassicStatus(state[3]);
  };
  useEffect(() => {
    let active = true;
    void Promise.all([cloudIdentity(), cloudBinding(), cloudStatus(), classicArchiveStatus()]).then(
      (state) => {
        if (!active) return;
        setIdentity(state[0]);
        setBinding(state[1]);
        setStatus(state[2]);
        setClassicStatus(state[3]);
      },
    );
    const run = () => {
      void refresh();
    };
    window.addEventListener('v6-cloud-sync', run);
    return () => {
      active = false;
      window.removeEventListener('v6-cloud-sync', run);
    };
  }, []);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const sync = async (force?: 'local' | 'cloud') => {
    const result = await syncJournal(repo, force);
    setStatus(result);
  };
  return (
    <section className="panel cloud-archive" aria-label="Lưu trữ cloud dài hạn">
      <h2>Nhật ký trên cloud</h2>
      <p>
        Giao dịch, ghi chú, ảnh gốc, cài đặt phân tích và các lần sửa được lưu riêng theo tài khoản.
        Ứng dụng không đặt thời hạn tự xóa lịch sử. Ảnh tải lên được lưu cùng nội dung; liên kết ảnh
        bên ngoài còn phụ thuộc nơi cung cấp ảnh.
      </p>
      <p>
        Máy chủ lưu chỉ mục trong D1, nội dung và phiên bản trong R2. Bản trên thiết bị vẫn dùng
        được khi mất mạng.
      </p>
      <dl>
        <dt>Tài khoản</dt>
        <dd>{identity?.name ?? 'Chưa đăng nhập'}</dd>
        <dt>Trạng thái</dt>
        <dd>{binding?.enabled ? 'Đã bật lưu cloud' : 'Chưa bật lưu cloud'}</dd>
        <dt>Lần đồng bộ được xác nhận</dt>
        <dd>{status?.at ? new Date(status.at).toLocaleString('vi-VN') : 'Chưa có'}</dd>
        <dt>Dữ liệu trên thiết bị</dt>
        <dd>
          {data.journals.length} sổ · {data.trades.length} giao dịch · {data.notes.length} ghi chú
        </dd>
      </dl>
      {identity === null ? (
        <a href="/signin-with-chatgpt?returnTo=%2Fv6%2F%23cloud" target="_top">
          Đăng nhập để lưu cloud
        </a>
      ) : (
        identity && (
          <div className="actions">
            {!binding?.enabled ? (
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await enableCloud(identity.id);
                    await sync();
                  })
                }
              >
                Bật lưu và đồng bộ nhật ký này
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={() => void action(() => sync())}>
                  Đồng bộ ngay
                </button>
                <button disabled={busy} onClick={() => void action(disableCloud)}>
                  Tạm ngừng đồng bộ
                </button>
              </>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const query = new URLSearchParams({ export: '1', after: exportCursor });
                  if (exportRevision !== undefined) query.set('at', String(exportRevision));
                  const r = await fetch('/api/journal-cloud?' + query, {
                    headers: { 'X-Journal-Owner': identity.id },
                  });
                  if (!r.ok) throw Error('Chưa tải được bản sao');
                  const raw = await r.text();
                  const lines = raw.trim().split('\n');
                  const footer = JSON.parse(lines.at(-1)!);
                  const header = JSON.parse(lines[0]);
                  if (typeof footer.complete !== 'boolean')
                    throw Error('Gói sao lưu chưa hoàn chỉnh');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([raw], { type: 'application/x-ndjson' }));
                  a.download = 'tuan-cloud-' + header.revision + '-part-' + part + '.ndjson';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  setExportCursor(footer.next ?? '');
                  setExportRevision(footer.complete ? undefined : header.revision);
                  setPart(footer.complete ? 1 : part + 1);
                })
              }
            >
              {exportCursor ? 'Tải gói sao lưu tiếp theo (' + part + ')' : 'Tải bản sao độc lập'}
            </button>
            <button
              disabled={busy}
              onClick={() => void action(async () => setRows((await cloudManifest()).records))}
            >
              Xem dữ liệu và lịch sử phiên bản
            </button>
          </div>
        )
      )}
      {(classicStatus?.pending || classicStatus?.seeding) && (
        <p role="status">
          Bản sao Classic đang được xử lý: {classicStatus.pending} mục chờ
          {classicStatus.seeding ? ' · đang rà soát dữ liệu trước đây' : ''}. Sổ Classic trên cloud
          vẫn được giữ.
        </p>
      )}
      {status?.error && <p role="alert">Chưa đồng bộ: {status.error}</p>}
      {binding?.enabled && status?.localRevision !== revision && (
        <p role="status">Có thay đổi trên thiết bị đang chờ đồng bộ.</p>
      )}
      {busy && <p role="status">Đang kiểm tra và đồng bộ…</p>}
      {error && <p role="alert">{error}</p>}
      {!!status?.conflicts.length && (
        <section role="alert">
          <h3>Cần đối chiếu {status.conflicts.length} mục</h3>
          <p>Cùng một mục đã thay đổi trên cả hai nơi. Cả hai bản vẫn được giữ; chưa ghi đè.</p>
          <ul>
            {status.conflicts.slice(0, 20).map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <div className="actions">
            <button disabled={busy} onClick={() => void action(() => sync('local'))}>
              Dùng bản trên thiết bị cho các mục xung đột
            </button>
            <button disabled={busy} onClick={() => void action(() => sync('cloud'))}>
              Dùng bản cloud cho các mục xung đột
            </button>
          </div>
          <p>Bản trước khi nhận dữ liệu cloud được giữ trong mục khôi phục trên thiết bị.</p>
        </section>
      )}
      {!!rows.length && (
        <section>
          <h3>Khôi phục một phiên bản</h3>
          <label>
            Mục dữ liệu
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setVersions([]);
              }}
            >
              <option value="">Chọn mục</option>
              {rows
                .filter((r) => !['chunks', 'preferences', 'classic'].includes(r.collection))
                .map((r) => (
                  <option key={r.record_key} value={r.record_key}>
                    {r.collection} · {r.record_id}
                    {r.deleted ? ' · đã xóa' : ''}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!selected || busy}
            onClick={() => void action(async () => setVersions(await cloudVersions(selected)))}
          >
            Xem các lần lưu
          </button>
          <ul>
            {versions.map((v) => (
              <li key={v.revision}>
                {new Date(v.updated_at).toLocaleString('vi-VN')} · phiên bản {v.revision}{' '}
                {v.deleted ? (
                  '· mốc xóa'
                ) : (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        recoverCloudRecord(
                          repo,
                          rows.find((r) => r.record_key === selected)!,
                          v.revision,
                        ),
                      )
                    }
                  >
                    Khôi phục bản này trên thiết bị
                  </button>
                )}
              </li>
            ))}
          </ul>
          {versions.length >= 50 && (
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const older = await cloudVersions(selected, versions.at(-1)?.revision);
                  setVersions((old) => [...old, ...older]);
                })
              }
            >
              Các phiên bản cũ hơn
            </button>
          )}
        </section>
      )}
      <section>
        <h3>Khôi phục từ bản sao độc lập</h3>
        <p>
          Chọn đủ tất cả các gói của cùng một lần xuất. Hệ thống kiểm tra checksum và liên kết giao
          dịch trước khi cho phép khôi phục. Bản hiện tại được giữ trong lịch sử khôi phục trên
          thiết bị.
        </p>
        <label>
          Chọn các gói NDJSON
          <input
            type="file"
            accept=".ndjson"
            multiple
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              void action(async () => {
                if (files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
                  throw Error(
                    'Khôi phục trên trình duyệt giới hạn 100 MB mỗi bộ. Dữ liệu lớn cần khôi phục theo quy trình máy chủ trong tài liệu vận hành.',
                  );
                const raw = await Promise.all(files.map((f) => f.text()));
                const parsed = await previewCloudArchive(raw);
                setArchiveFiles(raw);
                setPreview(parsed);
              });
            }}
          />
        </label>
        {preview && (
          <>
            <p>
              Đã xác minh: {preview.data.journals.length} sổ · {preview.data.trades.length} giao
              dịch · {preview.data.notes.length} ghi chú.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await restoreCloudArchive(repo, archiveFiles);
                  setPreview(undefined);
                  setArchiveFiles([]);
                })
              }
            >
              Khôi phục V6 và giữ bản hiện tại trong lịch sử
            </button>
            {!!preview.classicBackup.trades.length && (
              <>
                <p>
                  Bản sao còn có {preview.classicBackup.trades.length} giao dịch Classic. Tải tệp
                  tương thích rồi mở mục Khôi phục của Classic để xem trước và gộp.
                </p>
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(
                      new Blob([JSON.stringify(preview.classicBackup)], {
                        type: 'application/json',
                      }),
                    );
                    a.download = 'classic-restored-from-cloud.json';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  }}
                >
                  Tải tệp khôi phục Classic
                </button>
                <a href="/classic#settings">Mở khôi phục Classic ↗</a>
              </>
            )}
          </>
        )}
      </section>
      {identity && (
        <section>
          <h3>Ảnh đã gỡ khỏi Classic</h3>
          <p>Ảnh được gỡ khỏi màn hình vẫn còn bản gốc để tải về hoặc khôi phục vào giao dịch.</p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const r = await fetch(
                  '/api/evidence-archive' +
                    (imageCursor ? '?before=' + encodeURIComponent(imageCursor) : ''),
                );
                if (!r.ok) throw Error('Chưa đọc được lịch sử ảnh');
                const b = await r.json();
                setArchivedImages(
                  (old) =>
                    [
                      ...new Map(
                        [...old, ...b.images].map((x: { id: string }) => [x.id, x]),
                      ).values(),
                    ] as typeof old,
                );
                setImageCursor(b.next);
              })
            }
          >
            {imageCursor ? 'Tải các ảnh cũ hơn' : 'Xem ảnh đã lưu trữ'}
          </button>
          <ul>
            {archivedImages.map((image) => (
              <li key={image.id}>
                {image.filename} ·{' '}
                <a href={'/api/evidence-archive?id=' + encodeURIComponent(image.id)} download>
                  Tải ảnh gốc
                </a>{' '}
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const r = await fetch('/api/evidence-archive', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: image.id, expectedOwner: identity.id }),
                      });
                      if (!r.ok) {
                        const b = await r.json();
                        throw Error(b.error ?? 'Chưa khôi phục được ảnh');
                      }
                    })
                  }
                >
                  Khôi phục ảnh vào Classic
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3>Lưu 30 năm và lâu hơn</h3>
      <p>
        Ứng dụng không đặt thời hạn tự xóa. Việc lưu lâu dài còn phụ thuộc tài khoản, dịch vụ
        hosting và dung lượng được duy trì. Hãy giữ thêm bản sao ở ổ đĩa hoặc cloud do bạn kiểm soát
        và kiểm tra khôi phục định kỳ.
      </p>
      <p>
        Bản sao sang nhà cung cấp thứ hai và khóa chống xóa ở cấp nhà cung cấp chưa được cấu hình.
        Hệ thống hiện lưu phiên bản riêng và không có chức năng dọn tự động các bản này.
      </p>
    </section>
  );
}

export function CloudOwnerGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean>();
  useEffect(() => {
    let active = true;
    const check = async () => {
      const binding = await cloudBinding();
      const identity = binding ? await cloudIdentity() : null;
      if (active) setAllowed(!binding || binding.owner === identity?.id);
    };
    void check();
    window.addEventListener('focus', check);
    const timer = setInterval(() => void check(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
  if (allowed === undefined) return <p role="status">Đang kiểm tra kho nhật ký…</p>;
  if (!allowed)
    return (
      <section className="panel">
        <h1>Nhật ký trên thiết bị đã gắn với tài khoản khác</h1>
        <p>
          Đăng nhập đúng tài khoản hoặc dùng hồ sơ trình duyệt riêng. Dữ liệu không được tự chuyển
          sang tài khoản mới.
        </p>
        <a href="/signin-with-chatgpt?returnTo=%2Fv6%2F" target="_top">
          Đăng nhập để mở nhật ký
        </a>
      </section>
    );
  return children;
}
