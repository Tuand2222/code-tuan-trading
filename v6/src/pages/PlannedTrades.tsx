import { useMemo, useState } from 'react';
import { useLedger } from '../app/LedgerContext';
import { plannedTradeSchema, altStrategySchema, type Journal } from '../data/schema';
import { formatValue } from '../ui/format';
import { TradeForm } from '../ui/TradeForm';
import { tradeFacts } from '../core/trade';
import { sum } from '../core/money';
import { capitalProtection, accountObservations } from '../core/capitalPro';
import { journalCapitalSettings } from '../data/capitalSettings';
import { PlanImages } from '../ui/Chartbook';
export function PlannedTrades({ journal }: { journal: Journal }) {
  const { data, mutate, busy, revision } = useLedger();
  const gate = useMemo(
    () =>
      capitalProtection(
        accountObservations(data.trades.filter((t) => t.journalId === journal.id)),
        journalCapitalSettings(journal, data.cashFlows),
      ),
    [data.trades, data.cashFlows, journal],
  );
  const [taking, setTaking] = useState<{ id: string; revision: number }>(),
    [individual, setIndividual] = useState<Record<string, string>>({});
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
            if (gate.tier === 'stop')
              throw Error(
                'Lớp bảo vệ vốn đang dừng kế hoạch mới; dữ liệu giao dịch đã xảy ra vẫn được ghi nhận.',
              );
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
        <button disabled={busy || gate.tier === 'stop'}>Lưu planned trade</button>
        {gate.tier === 'stop' && (
          <p role="alert">
            Lớp 1 đang dừng kế hoạch mới. Mở Quản trị vốn Pro để đối chiếu; việc ghi nhận lệnh đã
            xảy ra vẫn hoạt động.
          </p>
        )}
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
            <PlanImages plan={p} />
            <label>
              R giả định kế hoạch · không cộng ledger
              <input
                disabled={busy}
                defaultValue={p.hypotheticalR ?? ''}
                onBlur={(e) =>
                  void mutate((s) => ({
                    ...s,
                    plannedTrades: s.plannedTrades.map((x) =>
                      x.id === p.id ? { ...x, hypotheticalR: e.target.value || undefined } : x,
                    ),
                  })).catch((e) => setMessage(String(e)))
                }
              />
            </label>
            {!p.takenTradeId && (
              <button disabled={busy} onClick={() => setTaking({ id: p.id, revision })}>
                Chuyển thành lệnh thực · {p.symbol}
              </button>
            )}
            <label>
              Trạng thái kế hoạch
              <select
                disabled={busy}
                aria-label="Trạng thái kế hoạch"
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
      <h3>Thực tế và cơ hội bỏ lỡ</h3>
      <p>Chỉ tổng hợp giả định đã nhập; không suy ra lợi nhuận từ TP/SL chưa được quan sát.</p>
      <p>
        Lệnh thực:{' '}
        {sum(
          data.trades.filter((t) => t.journalId === journal.id).map((t) => tradeFacts(t).r ?? '0'),
        )}{' '}
        R đã biết · Missed:{' '}
        {sum(
          data.plannedTrades
            .filter((p) => p.journalId === journal.id && p.status === 'missed')
            .map((p) => p.hypotheticalR ?? '0'),
        )}{' '}
        R GIẢ ĐỊNH · n=
        {
          data.plannedTrades.filter(
            (p) =>
              p.journalId === journal.id && p.status === 'missed' && p.hypotheticalR !== undefined,
          ).length
        }{' '}
        có giả định /{' '}
        {
          data.plannedTrades.filter((p) => p.journalId === journal.id && p.status === 'missed')
            .length
        }{' '}
        bỏ lỡ.
      </p>
      <h3>Alternative strategy · GIẢ ĐỊNH từng lệnh trong setup</h3>
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
                .filter((t) => individual[t.id] !== undefined || r.trim() !== '')
                .map((t) => ({ tradeId: t.id, r: individual[t.id] ?? r })),
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
      <details>
        <summary>Nhập R riêng và so sánh từng lệnh</summary>
        {data.trades
          .filter((t) => t.journalId === journal.id && t.setupId === setup)
          .map((t) => (
            <label key={t.id}>
              {t.id} · R thực {tradeFacts(t).r ?? '—'}
              <input
                aria-label={'R thay thế ' + t.id}
                value={individual[t.id] ?? ''}
                placeholder={r || 'Chưa có giả định'}
                onChange={(e) => setIndividual({ ...individual, [t.id]: e.target.value })}
              />
            </label>
          ))}
      </details>
      {data.altStrategies
        .filter((a) => a.journalId === journal.id)
        .map((a) => (
          <details key={a.id}>
            <summary>
              {a.name} · GIẢ ĐỊNH · n={a.hypotheticalR.length}
            </summary>
            {a.hypotheticalR.map((x) => (
              <p key={x.tradeId}>
                {x.tradeId}: Thực{' '}
                {formatValue(
                  tradeFacts(data.trades.find((t) => t.id === x.tradeId)!).r ?? null,
                  'R',
                )}{' '}
                · GIẢ ĐỊNH {formatValue(x.r, 'R')}
              </p>
            ))}
            <p>
              Tổng R giả định: {sum(a.hypotheticalR.map((x) => x.r))}. Không cộng vào lợi nhuận
              thực.
            </p>
          </details>
        ))}
      {message && <p role="status">{message}</p>}
      {taking && data.plannedTrades.find((p) => p.id === taking.id) && (
        <TradeForm
          key={taking.id}
          journal={journal}
          planned={data.plannedTrades.find((p) => p.id === taking.id)}
          revision={taking.revision}
          onClose={() => setTaking(undefined)}
        />
      )}
    </section>
  );
}
