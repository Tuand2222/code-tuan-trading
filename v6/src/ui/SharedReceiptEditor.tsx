import { useState } from 'react';
import { receipt } from '../data/classicQuantSource';
import { Modal } from './Modal';
export function SharedReceiptEditor({
  value,
  close,
  saved,
}: {
  value: unknown;
  close: () => void;
  saved: () => void;
}) {
  const [trade, setTrade] = useState(() => receipt.parse(value)),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false);
  const numeric = (k: 'pnl' | 'fees' | 'swap' | 'risk' | 'mae' | 'mfe', label: string) => (
    <label>
      {label}
      <input
        type="number"
        step="any"
        value={trade[k] ?? ''}
        onChange={(e) =>
          setTrade({ ...trade, [k]: e.target.value === '' ? undefined : Number(e.target.value) })
        }
      />
    </label>
  );
  return (
    <Modal label="shared-trade-title" onClose={close}>
      <h2 id="shared-trade-title">Sửa giao dịch dùng chung · {trade.symbol}</h2>
      <p>
        Cùng mã giao dịch với Classic. Lưu tại đây cập nhật bản cloud; nếu nơi khác vừa sửa, hệ
        thống sẽ yêu cầu đối chiếu.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage('');
          if (!receipt.safeParse(trade).success) {
            setMessage('Kiểm tra ngày, thời điểm đóng và số liệu trước khi lưu.');
            return;
          }
          if (
            !Number.isFinite(trade.pnl) ||
            (trade.feesKnown !== false && (!Number.isFinite(trade.fees) || trade.fees! < 0)) ||
            (trade.riskKnown !== false && (!Number.isFinite(trade.risk) || trade.risk! <= 0)) ||
            [trade.mae, trade.mfe].some(
              (v) => v !== null && v !== undefined && (!Number.isFinite(v) || v < 0),
            )
          ) {
            setMessage(
              'Nhập đủ số liệu thực: lợi nhuận hữu hạn, phí không âm, 1R lớn hơn 0. Bỏ đánh dấu đã biết nếu chưa có dữ liệu.',
            );
            return;
          }
          if (!trade.userId) {
            setMessage('Đăng nhập và tải sổ chung từ cloud trước khi sửa.');
            return;
          }
          setBusy(true);
          void fetch('/api/trades', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Journal-Owner': trade.userId },
            body: JSON.stringify({ trade }),
          })
            .then(async (r) => {
              const b = (await r.json()) as { error?: string };
              if (!r.ok) {
                if (r.status === 409) {
                  setConflict(true);
                  saved();
                }
                throw Error(
                  r.status === 409
                    ? 'Giao dịch đã thay đổi ở nơi khác. Bản đang nhập được giữ để đối chiếu.'
                    : (b.error ?? 'Chưa lưu được'),
                );
              }
              localStorage.setItem('tuan-shared-ledger-updated', new Date().toISOString());
              saved();
              close();
            })
            .catch((e) => setMessage(String(e)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Ngày trên phiếu (khi không có giờ đóng)
          <input
            type="date"
            value={trade.date}
            onChange={(e) => setTrade({ ...trade, date: e.target.value })}
            required
          />
        </label>
        <label>
          Thời điểm đóng thực (UTC · ISO 8601)
          <input
            value={trade.closedAt ?? ''}
            placeholder="2026-10-24T09:30:00.000Z"
            onChange={(e) => setTrade({ ...trade, closedAt: e.target.value || null })}
          />
        </label>
        {numeric('pnl', 'Lợi nhuận gộp (VNĐ)')}
        {numeric('fees', 'Phí thực đã ghi nhận (VNĐ)')}
        {numeric('swap', 'Swap / Funding có dấu (VNĐ)')}
        {numeric('risk', '1R ban đầu thực tế (VNĐ)')}
        {numeric('mae', 'MAE thực đã đo (VNĐ)')}
        {numeric('mfe', 'MFE thực đã đo (VNĐ)')}
        <label>
          <input
            type="checkbox"
            checked={trade.feesKnown !== false}
            onChange={(e) => setTrade({ ...trade, feesKnown: e.target.checked })}
          />
          Đã biết đầy đủ phí
        </label>
        <label>
          <input
            type="checkbox"
            checked={trade.riskKnown !== false}
            onChange={(e) => setTrade({ ...trade, riskKnown: e.target.checked })}
          />
          Đã xác nhận 1R ban đầu
        </label>
        <label>
          <input
            type="checkbox"
            checked={trade.pnlKnown !== false}
            onChange={(e) => setTrade({ ...trade, pnlKnown: e.target.checked })}
          />
          Đã xác nhận lợi nhuận gộp
        </label>
        <label>
          Phương pháp
          <input
            value={trade.setup ?? ''}
            onChange={(e) => setTrade({ ...trade, setup: e.target.value })}
          />
        </label>
        <label>
          Ghi chú
          <textarea
            value={trade.note ?? ''}
            onChange={(e) => setTrade({ ...trade, note: e.target.value })}
          />
        </label>
        {!trade.version && (
          <p role="alert">
            Bản này chỉ có trên thiết bị. Mở Classic để đưa vào cloud trước khi chỉnh sửa dùng
            chung.
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        {conflict && (
          <button
            type="button"
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(
                new Blob([JSON.stringify(trade, null, 2)], { type: 'application/json' }),
              );
              a.download = 'giao-dich-dang-sua.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            Tải bản đang sửa để đối chiếu
          </button>
        )}
        <button disabled={busy || !trade.version || conflict}>Lưu vào sổ chung</button>
        <button type="button" onClick={close}>
          Đóng
        </button>
      </form>
    </Modal>
  );
}
