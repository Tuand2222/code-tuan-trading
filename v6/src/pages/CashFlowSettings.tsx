import { useState } from 'react';
import type { Journal } from '../data/schema';
import { cashFlowSchema } from '../data/schema';
import { useLedger } from '../app/LedgerContext';
import { capitalReport } from '../core/capital';
import { formatValue, formatDate } from '../ui/format';

export function CashFlowSettings({ journal }: { journal: Journal }) {
  const { data, revision, mutate, busy } = useLedger();
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [draftRevision, setDraftRevision] = useState<number>();
  const [deleteRevision, setDeleteRevision] = useState<number>();
  const touch = () => setDraftRevision((previous) => previous ?? revision);
  const report = capitalReport(journal, data.trades, data.cashFlows);
  return (
    <section className="panel">
      <h2>Vốn và nạp/rút</h2>
      <p>
        Toàn bộ sổ {journal.name} · {journal.currency}. Số dư theo lãi/lỗ đã hiện thực hóa, chưa gồm
        lãi/lỗ vị thế mở. TWR loại ảnh hưởng nạp/rút; dòng tiền cùng thời điểm được ghi trước sự
        kiện giao dịch.
      </p>
      <p>
        Số dư: <strong>{formatValue(report.balance, 'money', journal.currency)}</strong> · TWR:{' '}
        <strong>{formatValue(report.twrPercent, 'percent')}</strong>
      </p>
      {report.twrPercent === null && (
        <p>Chưa đủ vốn đầu kỳ hoặc dữ liệu Net hợp lệ để tính tỷ suất.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const flow = cashFlowSchema.parse({
              id: editing ?? crypto.randomUUID(),
              journalId: journal.id,
              type,
              date: new Date(date + 'Z').toISOString(),
              amount,
              note,
            });
            void mutate(
              (s) => ({
                ...s,
                cashFlows: [...s.cashFlows.filter((f) => f.id !== flow.id), flow],
              }),
              draftRevision ?? revision,
            )
              .then(() => {
                setAmount('');
                setNote('');
                setEditing(undefined);
                setDraftRevision(undefined);
                setMessage('Đã lưu dòng tiền.');
              })
              .catch(() =>
                setMessage('Không lưu được. Hãy tải lại dữ liệu và kiểm tra thay đổi ở tab khác.'),
              );
          } catch {
            setMessage('Kiểm tra thời điểm và số tiền dương, không có dấu phân cách hàng nghìn.');
          }
        }}
      >
        <label>
          Loại dòng tiền
          <select
            value={type}
            onChange={(e) => {
              touch();
              setType(e.target.value as typeof type);
            }}
          >
            <option value="deposit">Nạp vốn</option>
            <option value="withdrawal">Rút vốn</option>
          </select>
        </label>
        <label>
          Thời điểm dòng tiền (UTC)
          <input
            type="datetime-local"
            step="any"
            required
            value={date}
            onChange={(e) => {
              touch();
              setDate(e.target.value);
            }}
          />
        </label>
        <label>
          Số tiền dòng tiền ({journal.currency})
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              touch();
              setAmount(e.target.value);
            }}
          />
        </label>
        <label>
          Ghi chú dòng tiền
          <input
            value={note}
            onChange={(e) => {
              touch();
              setNote(e.target.value);
            }}
          />
        </label>
        <button disabled={busy}>Lưu dòng tiền</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setAmount('');
              setNote('');
            }}
          >
            Hủy sửa dòng tiền
          </button>
        )}
      </form>
      <ul>
        {data.cashFlows
          .filter((f) => f.journalId === journal.id)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((f) => (
            <li key={f.id}>
              {formatDate(f.date, journal.timezone)} · {f.type === 'deposit' ? 'Nạp' : 'Rút'} ·{' '}
              {formatValue(f.amount, 'money', journal.currency)} · {f.note}
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(f.id);
                  setDraftRevision(revision);
                  setType(f.type);
                  setDate(f.date.replace(/Z$/, ''));
                  setAmount(f.amount);
                  setNote(f.note ?? '');
                }}
              >
                Sửa dòng tiền {f.id}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setDeleting(f.id);
                  setDeleteRevision(revision);
                }}
              >
                Xóa dòng tiền {f.id}
              </button>
            </li>
          ))}
      </ul>
      {deleting && (
        <div className="notice">
          <p>
            Xóa dòng tiền này sẽ thay đổi số dư và TWR. Bản trước thay đổi được giữ trong lịch sử
            khôi phục.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void mutate(
                (s) => ({
                  ...s,
                  cashFlows: s.cashFlows.filter((f) => f.id !== deleting),
                }),
                deleteRevision ?? revision,
              )
                .then(() => {
                  setDeleting(undefined);
                  setEditing(undefined);
                  setMessage('Đã xóa dòng tiền.');
                })
                .catch(() => setMessage('Không xóa được dòng tiền.'))
            }
          >
            Xác nhận xóa dòng tiền
          </button>
          <button onClick={() => setDeleting(undefined)}>Hủy xóa dòng tiền</button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
