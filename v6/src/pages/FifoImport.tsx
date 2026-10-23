import { useState, useRef, useEffect } from 'react';
import type { Journal, Market } from '../data/schema';
import {
  csvHeaders,
  suggestMapping,
  fillColumns,
  commitFIFO,
  rollbackFIFO,
  fifoTotals,
  type FillMapping,
  type previewFIFO,
} from '../data/fifoImport';
import { useLedger } from '../app/LedgerContext';
import { formatValue } from '../ui/format';
export function FifoImport({ journal }: { journal: Journal }) {
  const { data, mutate, revision, busy } = useLedger();
  const [raw, setRaw] = useState(''),
    [fileName, setFileName] = useState(''),
    [mapping, setMapping] = useState<FillMapping>({}),
    [broker, setBroker] = useState('Binance USDT'),
    [market, setMarket] = useState<Market>('crypto'),
    [mode, setMode] = useState<'spot' | 'futures'>('spot'),
    [multiplier, setMultiplier] = useState('1'),
    [zero, setZero] = useState(false),
    [template, setTemplate] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState<Awaited<ReturnType<typeof previewFIFO>>>(),
    [version, setVersion] = useState(0);
  const worker = useRef<Worker>();
  useEffect(() => () => worker.current?.terminate(), []);
  const totals = preview?.data ? fifoTotals(preview.data, journal.id) : undefined;
  const headers = raw ? csvHeaders(raw) : [],
    templates = journal.settings.importTemplates ?? [];
  const invalidate = () => {
    setPreview(undefined);
    setConfirmed(false);
    worker.current?.terminate();
    setPending(false);
  };
  return (
    <section className="panel">
      <h2>Kết nối dữ liệu · CSV fills / FIFO</h2>
      <p>
        Nhập các khớp thật từ CSV chung hoặc Binance Trade History. Chọn cột, kiểm tra từng dòng rồi
        xác nhận. Ngày không có offset được hiểu UTC; BUY/SELL là chiều khớp, Position Side
        LONG/SHORT là hedge mode. Spot không cho bán vượt tồn kho. Tải đủ lịch sử mở vị thế; phí
        khác tiền tệ bị từ chối. Giá trị Gross báo cáo nếu có phải khớp FIFO; báo cáo tính theo giá
        bình quân có thể không khớp.
      </p>
      <label>
        File CSV khớp lệnh
        <input
          type="file"
          accept=".csv"
          disabled={busy}
          onChange={(e) => {
            invalidate();
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) {
              setMessage('Tối đa 20 MB.');
              return;
            }
            void file
              .text()
              .then((text) => {
                setRaw(text);
                setFileName(file.name);
                setMapping(suggestMapping(csvHeaders(text)));
              })
              .catch((e) => setMessage(String(e)));
          }}
        />
      </label>
      <label>
        Nền tảng nhập
        <input
          value={broker}
          onChange={(e) => {
            invalidate();
            setBroker(e.target.value);
          }}
        />
      </label>
      <label>
        Thị trường dữ liệu
        <select
          value={market}
          onChange={(e) => {
            invalidate();
            setMarket(e.target.value as Market);
          }}
        >
          {['crypto', 'stocks', 'futures', 'forex', 'commodities', 'cfd', 'options'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label>
        Chế độ ghép vị thế
        <select
          value={mode}
          onChange={(e) => {
            invalidate();
            setMode(e.target.value as typeof mode);
          }}
        >
          <option value="spot">Spot / tồn kho, không đảo sang short</option>
          <option value="futures">Futures / net hoặc hedge theo Position Side</option>
        </select>
      </label>
      <label>
        Hệ số nhân hợp đồng
        <input
          value={multiplier}
          onChange={(e) => {
            invalidate();
            setMultiplier(e.target.value);
          }}
        />
      </label>
      <label>
        Mẫu ánh xạ đã lưu
        <select
          defaultValue=""
          onChange={(e) => {
            invalidate();
            const t = templates.find((x) => x.name === e.target.value);
            if (t) {
              setMapping(t.mapping);
              setBroker(t.broker);
            }
          }}
        >
          <option value="">Chọn mẫu</option>
          {templates.map((t) => (
            <option key={t.name}>{t.name}</option>
          ))}
        </select>
      </label>
      {headers.length > 0 && (
        <>
          <div className="filter-grid">
            {fillColumns.map((k) => (
              <label key={k}>
                Cột {k}
                <select
                  value={mapping[k] ?? ''}
                  onChange={(e) => {
                    invalidate();
                    setMapping({ ...mapping, [k]: e.target.value });
                  }}
                >
                  <option value="">Không có</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p>
            Không có ID sẽ dùng hash Mã/Thời gian/Chiều/Giá/Khối lượng/Phí; giữ số lần xuất hiện của
            các dòng giống nhau trong file và đối chiếu số lần khi nhập lại. Cần ID sàn để phân biệt
            các file chỉ chứa một phần lịch sử. Lệnh thiếu SL/1R vào trạng thái Thiếu dữ liệu. Nếu
            không xác nhận các khoản chi phí vắng mặt, Net/R giữ chưa xác định.
          </p>
          <label>
            <input
              type="checkbox"
              checked={zero}
              onChange={(e) => {
                invalidate();
                setZero(e.target.checked);
              }}
            />
            Tôi xác nhận các khoản phí/funding/swap/thuế/khác không có cột đều bằng 0.
          </label>
          <label>
            Tên mẫu ánh xạ
            <input value={template} onChange={(e) => setTemplate(e.target.value)} />
          </label>
          <button
            disabled={!template.trim() || busy}
            onClick={() =>
              void mutate((s) => ({
                ...s,
                journals: s.journals.map((j) =>
                  j.id === journal.id
                    ? {
                        ...j,
                        settings: {
                          ...j.settings,
                          importTemplates: [
                            ...(j.settings.importTemplates ?? []).filter(
                              (t) => t.name !== template,
                            ),
                            { name: template, mapping, broker },
                          ],
                        },
                      }
                    : j,
                ),
              }))
                .then(() => setMessage('Đã lưu mẫu cột.'))
                .catch((e) => setMessage(String(e)))
            }
          >
            Lưu mẫu cột
          </button>
          <button
            disabled={pending || busy}
            onClick={() => {
              invalidate();
              setPending(true);
              setVersion(revision);
              const w = new Worker(new URL('../app/fifo.worker.ts', import.meta.url), {
                type: 'module',
              });
              worker.current = w;
              w.onmessage = (e) => {
                setPending(false);
                if (e.data.ok) {
                  setPreview(e.data.result);
                  setMessage('');
                } else setMessage(e.data.error);
                w.terminate();
              };
              w.onerror = () => {
                setPending(false);
                setMessage('Không đọc được dữ liệu FIFO.');
                w.terminate();
              };
              w.postMessage([
                raw,
                journal,
                { broker, market, multiplier, mode, confirmedZeroCosts: zero, mapping },
                data,
              ]);
            }}
          >
            Xem trước FIFO
          </button>
        </>
      )}
      {pending && <p role="status">Đang ghép FIFO trên thiết bị…</p>}
      {preview && (
        <>
          <p>
            {preview.added} khớp mới · {preview.skipped} trùng bỏ qua · {preview.errors.length} lỗi.
          </p>
          {preview.errors.map((e, i) => (
            <p role="alert" key={i}>
              Dòng {e.row} · cột {e.column}: {e.message}
            </p>
          ))}
          {preview.data && (
            <>
              <p>
                Tổng FIFO sau nhập: Gross {formatValue(totals!.gross, 'money', journal.currency)} ·
                Net {formatValue(totals!.net, 'money', journal.currency)} · còn mở {totals!.open}{' '}
                đơn vị.
              </p>
              <details>
                <summary>Các lệnh sau ghép · hiển thị tối đa 100</summary>
                {preview.data.trades
                  .filter((t) => t.journalId === journal.id && t.tags.includes('fifo-import'))
                  .slice(-100)
                  .map((t) => (
                    <p key={t.id}>
                      {t.id} · {t.symbol} · {t.side} · {t.status} ·{' '}
                      {t.legs.map((l) => l.kind + ': ' + l.quantity + ' @ ' + l.price).join(' → ')}
                    </p>
                  ))}
              </details>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Tôi đã đối chiếu cột, tiền tệ, khối lượng và các lệnh xem trước.
          </label>
          <button
            disabled={!confirmed || !preview.data || !!preview.errors.length || busy}
            onClick={() =>
              void mutate((s) => commitFIFO(s, preview, fileName), version)
                .then(() => {
                  setMessage('Đã nhập FIFO.');
                  setPreview(undefined);
                  setConfirmed(false);
                })
                .catch((e) => setMessage(String(e)))
            }
          >
            Xác nhận nhập FIFO
          </button>
        </>
      )}
      <h3>Lịch sử nhập FIFO</h3>
      {data.batches
        .filter((b) => b.journalId === journal.id && b.platform.startsWith('FIFO · '))
        .map((b) => (
          <details key={b.id}>
            <summary>
              {b.fileName} · {b.stats.added} mới / {b.stats.skipped} trùng · {b.tradeIds.length}{' '}
              lệnh
            </summary>
            <p>
              Hoàn tác chỉ thay dữ liệu của các fills còn hoạt động. Từ chối nếu lệnh đã gắn hồ sơ
              cần giữ hoặc đợt sau còn phụ thuộc khớp mở của đợt này.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                const rev = revision;
                void rollbackFIFO(data, b.id, journal)
                  .then((next) => mutate(() => next, rev))
                  .then(() => setMessage('Đã hoàn tác FIFO.'))
                  .catch((e) => setMessage(String(e)));
              }}
            >
              Hoàn tác FIFO {b.fileName}
            </button>
          </details>
        ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
