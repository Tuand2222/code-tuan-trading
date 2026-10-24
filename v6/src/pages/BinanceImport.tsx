import { useState, useRef, useEffect } from 'react';
import type { Journal } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { previewBinance, commitBinance, rollbackBinance } from '../data/binanceImport';
import { tradeFacts } from '../core/trade';
import { formatValue } from '../ui/format';
export function BinanceImport({ journal }: { journal: Journal }) {
  const { data, mutate, busy, revision } = useLedger();
  const worker = useRef<Worker>(),
    generation = useRef(0);
  const [parsing, setParsing] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
    },
    [],
  );
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBinance>>>();
  const [basis, setBasis] = useState<'gross' | 'net'>('gross');
  const [version, setVersion] = useState(0),
    [fileName, setFileName] = useState(''),
    [message, setMessage] = useState('');
  return (
    <section className="panel">
      <h2>Binance · Position History</h2>
      <p>
        Nhập CSV đối chiếu vị thế Futures tuyến tính vào sổ USDT. Cần Position ID, LONG/SHORT, giá
        vào/ra, thời điểm mở/đóng và Closed Quantity. Không dùng Max Open Interest làm khối lượng
        đóng. Chưa đối chiếu file export thực; không nhận Trade History, Income, COIN-M hoặc phí
        khác USDT.
      </p>
      <p>
        Chỉ nhận vị thế có bằng chứng một khớp vào/một khớp ra: Entry Fill ID, Exit Fill ID, Entry
        Fill Count=1, Exit Fill Count=1. Báo cáo tổng hợp cần lịch sử fills gốc, không dựng legs từ
        giá bình quân. Chi phí trả ghi dương, funding nhận ghi âm.
      </p>
      <p>
        Giờ không có múi giờ trong CSV được hiểu là UTC. Cần đầy đủ Commission, Funding, Swap, Tax,
        Other (ghi 0 nếu đã xác nhận không phát sinh); thiếu mục nào thì Net/R chưa xác định.
      </p>
      <label>
        PNL báo cáo là
        <select
          value={basis}
          onChange={(e) => {
            generation.current++;
            worker.current?.terminate();
            setParsing(false);
            setBasis(e.target.value as typeof basis);
            setPreview(undefined);
          }}
        >
          <option value="gross">Gross trước chi phí</option>
          <option value="net">Net sau toàn bộ chi phí</option>
        </select>
      </label>
      <label>
        CSV Binance Position History
        <input
          type="file"
          accept=".csv"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            const request = ++generation.current;
            worker.current?.terminate();
            setParsing(false);
            setPreview(undefined);
            if (!f) return;
            if (f.size > 20 * 1024 * 1024) {
              setMessage('IMPORT_TOO_LARGE');
              return;
            }
            const rev = revision;
            setParsing(true);
            void f
              .text()
              .then((raw) => {
                if (request !== generation.current) return;
                const w = new Worker(new URL('../app/import.worker.ts', import.meta.url), {
                  type: 'module',
                });
                worker.current = w;
                w.onmessage = (e) => {
                  if (request !== generation.current) return;
                  setParsing(false);
                  if (e.data.ok) {
                    setPreview(e.data.result);
                    setVersion(rev);
                    setFileName(f.name);
                    setMessage('');
                  } else setMessage(e.data.error);
                  w.terminate();
                };
                w.onerror = () => {
                  if (request === generation.current) {
                    setParsing(false);
                    setMessage('Không đọc được CSV.');
                  }
                  w.terminate();
                };
                w.postMessage({ raw, journal, basis });
              })
              .catch((e) => {
                if (request === generation.current) {
                  setParsing(false);
                  setMessage(String(e));
                }
              });
          }}
        />
      </label>
      {parsing && <p role="status">Đang kiểm tra CSV trên thiết bị…</p>}
      {preview && (
        <>
          <p>
            {preview.trades.length} vị thế · {preview.trades.filter((t) => !t.costsKnown).length} vị
            thế chưa đủ chi phí · bảng xem trước tối đa 100 dòng đầu
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mã</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {preview.trades.slice(0, 100).map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.symbol}</td>
                    <td>{formatValue(tradeFacts(t).net ?? null, 'money', journal.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void mutate((s) => commitBinance(s, preview, fileName), version)
                .then(() => {
                  setPreview(undefined);
                  setMessage('Đã nhập; bản trùng không được thêm lần hai.');
                })
                .catch((e) => setMessage(String(e)))
            }
          >
            Xác nhận nhập Binance
          </button>
        </>
      )}
      {data.batches
        .filter((b) => b.journalId === journal.id && b.platform === 'BINANCE')
        .map((b) => (
          <p key={b.id}>
            {b.fileName} · {b.stats.added} vị thế{' '}
            <button
              disabled={busy}
              onClick={() =>
                void mutate((s) => rollbackBinance(s, b.id))
                  .then(() => setMessage('Đã hoàn tác batch; nguồn gốc vẫn lưu.'))
                  .catch((e) => setMessage(String(e)))
              }
            >
              Hoàn tác batch {b.id}
            </button>
          </p>
        ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
