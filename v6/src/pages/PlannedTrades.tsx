import { useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import { plannedTradeSchema, altStrategySchema, type Journal } from '../data/schema';
import { formatValue } from '../ui/format';
export function PlannedTrades({ journal }: { journal: Journal }) {
  const { data, mutate, busy } = useLedger();
  const [symbol, setSymbol] = useState(''),
    [side, setSide] = useState<'long' | 'short'>('long'),
    [entry, setEntry] = useState(''),
    [sl, setSL] = useState(''),
    [tp, setTP] = useState(''),
    [message, setMessage] = useState('');
  const [name, setName] = useState(''),
    [setup, setSetup] = useState(''),
    [r, setR] = useState('');
  return (
    <section className="panel">
      <h2>Planned / Missed và phương án thay thế</h2>
      <p>Các kế hoạch và R thay thế là GIẢ ĐỊNH, được lưu riêng và không cộng vào ledger thực.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const planned = plannedTradeSchema.parse({
              id: crypto.randomUUID(),
              journalId: journal.id,
              symbol: symbol.toUpperCase(),
              side,
              plannedEntry: entry,
              plannedSL: sl,
              plannedTP: tp,
              status: 'planned',
            });
            if (
              (side === 'long' && !(Number(sl) < Number(entry) && Number(tp) > Number(entry))) ||
              (side === 'short' && !(Number(sl) > Number(entry) && Number(tp) < Number(entry)))
            )
              throw Error('SL/TP không đúng chiều.');
            void mutate((s) => ({ ...s, plannedTrades: [...s.plannedTrades, planned] }))
              .then(() => setMessage('Đã lưu kế hoạch.'))
              .catch((e) => setMessage(String(e)));
          } catch (e) {
            setMessage(String(e));
          }
        }}
      >
        <label>
          Mã kế hoạch
          <input required value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        </label>
        <label>
          Chiều kế hoạch
          <select value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        {[
          ['Giá vào kế hoạch', entry, setEntry],
          ['SL kế hoạch mới', sl, setSL],
          ['TP kế hoạch mới', tp, setTP],
        ].map(([label, value, set]) => (
          <label key={String(label)}>
            {String(label)}
            <input
              required
              value={String(value)}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            />
          </label>
        ))}
        <button disabled={busy}>Lưu planned trade</button>
      </form>
      {data.plannedTrades
        .filter((p) => p.journalId === journal.id)
        .map((p) => (
          <article key={p.id}>
            <h3>
              {p.symbol} · {p.id} · {p.status}
            </h3>
            <p>
              {p.plannedEntry} / SL {p.plannedSL} / TP {p.plannedTP}
            </p>
            <label>
              Trạng thái kế hoạch
              <select
                value={p.status}
                onChange={(e) => {
                  const status = e.target.value as typeof p.status;
                  if (status === 'taken' && !p.takenTradeId) {
                    setMessage('Chọn ID lệnh thực trước khi đánh dấu Taken.');
                    return;
                  }
                  void mutate((s) => ({
                    ...s,
                    plannedTrades: s.plannedTrades.map((x) =>
                      x.id === p.id ? { ...x, status } : x,
                    ),
                  })).catch((e) => setMessage(String(e)));
                }}
              >
                <option value="planned">Planned</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
                <option value="taken">Taken</option>
              </select>
            </label>
            <label>
              Lý do bỏ lỡ
              <input
                defaultValue={p.missedReason ?? ''}
                onBlur={(e) =>
                  void mutate((s) => ({
                    ...s,
                    plannedTrades: s.plannedTrades.map((x) =>
                      x.id === p.id ? { ...x, missedReason: e.target.value } : x,
                    ),
                  })).catch((e) => setMessage(String(e)))
                }
              />
            </label>
            <label>
              ID lệnh thực liên kết
              <select
                value={p.takenTradeId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  void mutate((s) => ({
                    ...s,
                    plannedTrades: s.plannedTrades.map((x) =>
                      x.id === p.id
                        ? { ...x, takenTradeId: id || undefined, status: id ? 'taken' : 'planned' }
                        : x,
                    ),
                  })).catch((e) => setMessage(String(e)));
                }}
              >
                <option value="">Chưa liên kết</option>
                {data.trades
                  .filter(
                    (t) => t.journalId === journal.id && t.symbol === p.symbol && t.side === p.side,
                  )
                  .map((t) => (
                    <option key={t.id}>{t.id}</option>
                  ))}
              </select>
            </label>
          </article>
        ))}
      <h3>Alternative strategy · GIẢ ĐỊNH R cố định cho setup</h3>
      <label>
        Tên phương án
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Setup phương án
        <select value={setup} onChange={(e) => setSetup(e.target.value)}>
          <option value="">Chọn setup</option>
          {data.setups
            .filter((s) => s.journalId === journal.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        R giả định trên mỗi lệnh
        <input value={r} onChange={(e) => setR(e.target.value)} />
      </label>
      <button
        disabled={busy}
        onClick={() => {
          try {
            const alt = altStrategySchema.parse({
              id: crypto.randomUUID(),
              journalId: journal.id,
              setupId: setup,
              name,
              hypotheticalR: data.trades
                .filter((t) => t.journalId === journal.id && t.setupId === setup)
                .map((t) => ({ tradeId: t.id, r })),
            });
            if (!alt.hypotheticalR.length) throw Error('Không có lệnh trong setup.');
            void mutate((s) => ({ ...s, altStrategies: [...s.altStrategies, alt] }))
              .then(() => setMessage('Đã lưu giả định riêng.'))
              .catch((e) => setMessage(String(e)));
          } catch (e) {
            setMessage(String(e));
          }
        }}
      >
        Lưu phương án giả định
      </button>
      {data.altStrategies
        .filter((a) => a.journalId === journal.id)
        .map((a) => (
          <details key={a.id}>
            <summary>
              {a.name} · GIẢ ĐỊNH · n={a.hypotheticalR.length}
            </summary>
            {a.hypotheticalR.map((x) => (
              <p key={x.tradeId}>
                {x.tradeId}: {formatValue(x.r, 'R')}
              </p>
            ))}
          </details>
        ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
