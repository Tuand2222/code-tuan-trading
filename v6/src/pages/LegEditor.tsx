import { useState } from 'react';
import type { Journal, Trade } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { mergeTrades, replaceTradeLegs } from '../data/advancedTrades';
import { tradeFacts } from '../core/trade';
import { formatValue } from '../ui/format';
export function LegEditor({ journal }: { journal: Journal }) {
  const { data, revision, mutate, busy } = useLedger();
  const [id, setId] = useState(''),
    [legs, setLegs] = useState<Trade['legs']>([]),
    [status, setStatus] = useState<Trade['status']>('open'),
    [version, setVersion] = useState(0),
    [mergeVersion, setMergeVersion] = useState(0),
    [message, setMessage] = useState(''),
    [mergeIds, setMergeIds] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false);
  const trade = data.trades.find((t) => t.id === id);
  let summary: ReturnType<typeof tradeFacts> | undefined;
  try {
    if (trade) summary = tradeFacts({ ...trade, legs, status });
  } catch {
    /* Display invalid state until all legs reconcile. */
  }
  return (
    <section className="panel">
      <h2>Scale In/Out và Merge</h2>
      <p>
        Thời điểm khớp nhập theo UTC. Tổng phí hiện có được giữ; đối chiếu lại phí sau khi sửa khối
        lượng. Sửa legs mở lại trạng thái review.
      </p>
      <label>
        Lệnh nhiều khớp
        <select
          aria-label="Lệnh nhiều khớp"
          value={id}
          onChange={(e) => {
            const t = data.trades.find((t) => t.id === e.target.value);
            setId(t?.id ?? '');
            setLegs(structuredClone(t?.legs ?? []));
            setStatus(t?.status ?? 'open');
            setVersion(revision);
            setConfirmed(false);
            setMessage('');
          }}
        >
          <option value="">Chọn lệnh</option>
          {data.trades
            .filter((t) => t.journalId === journal.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol} · {t.id}
              </option>
            ))}
        </select>
      </label>
      {trade && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Thời điểm UTC</th>
                  <th>Giá</th>
                  <th>Khối lượng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id}>
                    <td>
                      <select
                        aria-label={'Loại khớp ' + (i + 1)}
                        value={l.kind}
                        onChange={(e) => {
                          setConfirmed(false);
                          setLegs(
                            legs.map((x, k) =>
                              k === i ? { ...x, kind: e.target.value as 'in' | 'out' } : x,
                            ),
                          );
                        }}
                      >
                        <option value="in">Vào</option>
                        <option value="out">Ra</option>
                      </select>
                    </td>
                    {(['time', 'price', 'quantity'] as const).map((field) => (
                      <td key={field}>
                        <input
                          aria-label={
                            { time: 'Thời điểm', price: 'Giá', quantity: 'Khối lượng' }[field] +
                            ' khớp ' +
                            (i + 1)
                          }
                          value={l[field]}
                          onChange={(e) => {
                            setConfirmed(false);
                            setLegs(
                              legs.map((x, k) => (k === i ? { ...x, [field]: e.target.value } : x)),
                            );
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        onClick={() => {
                          setConfirmed(false);
                          setLegs(legs.filter((_, k) => k !== i));
                        }}
                      >
                        Bỏ khớp {i + 1}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => {
              setConfirmed(false);
              setLegs([
                ...legs,
                {
                  id: crypto.randomUUID(),
                  kind: 'in',
                  time: new Date().toISOString(),
                  price: '1',
                  quantity: '1',
                },
              ]);
            }}
          >
            Thêm khớp
          </button>
          <label>
            Trạng thái sau sửa
            <select
              value={status}
              onChange={(e) => {
                setConfirmed(false);
                setStatus(e.target.value as typeof status);
              }}
            >
              <option value="open">Đang mở</option>
              <option value="closed">Đã đóng</option>
            </select>
          </label>
          <p>
            Gross: {formatValue(summary?.gross ?? null, 'money', journal.currency)} · Net:{' '}
            {formatValue(summary?.net ?? null, 'money', journal.currency)} · R:{' '}
            {formatValue(summary?.r ?? null, 'R')}
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Tôi đã đối chiếu khối lượng, thời điểm và tổng phí.
          </label>
          <button
            disabled={!confirmed || !summary || busy}
            onClick={() =>
              void mutate((s) => replaceTradeLegs(s, id, legs, status), version)
                .then(() => setMessage('Đã lưu legs; hãy review lại lệnh.'))
                .catch((e) => setMessage(String(e)))
            }
          >
            Lưu legs
          </button>
        </>
      )}
      <h3>Gộp lệnh có bảo toàn từng sự kiện</h3>
      <p>
        Chỉ gộp lệnh cùng mã/chiều, đã đóng và chưa có batch hoặc hồ sơ review. Nếu phân bổ phí hay
        sự kiện thay đổi, thao tác bị từ chối; bản gốc được lưu trước khi gộp.
      </p>
      <label>
        Chọn các lệnh để gộp
        <select
          multiple
          value={mergeIds}
          onChange={(e) => {
            setMergeIds([...e.target.selectedOptions].map((o) => o.value));
            setMergeVersion(revision);
          }}
        >
          {data.trades
            .filter((t) => t.journalId === journal.id)
            .map((t) => (
              <option value={t.id} key={t.id}>
                {t.symbol} · {t.id}
              </option>
            ))}
        </select>
      </label>
      <button
        disabled={busy || mergeIds.length < 2}
        onClick={() =>
          void mutate((s) => mergeTrades(s, mergeIds), mergeVersion)
            .then(() => {
              setMergeIds([]);
              setMessage('Đã gộp và lưu nguồn gốc.');
            })
            .catch((e) => setMessage(String(e)))
        }
      >
        Gộp các lệnh đã chọn
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
