import { useState } from 'react';
import type { Journal } from '../data/schema';
import type { analyze } from '../core/analyze';
import { useLedger } from '../app/LedgerContext';
import { formatDate, formatValue } from '../ui/format';
import vi from '../i18n/vi.json';
const t = vi.s3;
export function ReviewPage({
  journal,
  result,
  onOpen,
}: {
  journal: Journal;
  result: ReturnType<typeof analyze>;
  onOpen: (id: string) => void;
}) {
  const { data, mutate, busy } = useLedger();
  const [body, setBody] = useState(''),
    [scope, setScope] = useState<'day' | 'week' | 'month'>('day'),
    [refId, setRef] = useState(new Date().toISOString().slice(0, 10)),
    [message, setMessage] = useState('');
  return (
    <>
      <section className="panel">
        <h2>{t.queue}</h2>
        <p className={result.shadow.bias ? 'notice' : ''}>
          {t.bias}: {result.shadow.reviewGap.toFixed(1)}{' '}
          {result.shadow.bias ? t.biasWarning : t.balanced} · {result.shadow.reviewed}/
          {result.shadow.total}
        </p>
        {!result.queue.length && <p>{t.noQueue}</p>}
        <ol className="review-queue">
          {result.queue.map((f) => (
            <li key={f.id}>
              <button onClick={() => onOpen(f.id)}>
                {f.trade.symbol} · {formatValue(f.net ?? null, 'money', journal.currency, true)} ·{' '}
                {formatValue(f.r ?? null, 'R')} · {formatDate(f.closeTime!, journal.timezone)}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel">
        <h2>{t.notes}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate((s) => {
              const existing = s.notes.find(
                (n) => n.journalId === journal.id && n.scope === scope && n.refId === refId,
              );
              return {
                ...s,
                notes: [
                  ...s.notes.filter((n) => n.id !== existing?.id),
                  {
                    id: existing?.id ?? crypto.randomUUID(),
                    journalId: journal.id,
                    scope,
                    refId,
                    body,
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                  },
                ],
              };
            })
              .then(() => setMessage(t.saved))
              .catch(() => setMessage(t.error));
          }}
        >
          <div className="actions">
            <label>
              {t.scope}
              <select
                aria-label={t.scope}
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
              >
                {(['day', 'week', 'month'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t.scopes[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.ref}
              <input
                aria-label={t.ref}
                required
                value={refId}
                onChange={(e) => setRef(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setBody(
                  (v) =>
                    v + (v ? '\n\n' : '') + (scope === 'day' ? t.dayTemplate : t.periodTemplate),
                )
              }
            >
              {t.template}
            </button>
          </div>
          <label>
            {t.note}
            <textarea
              required
              aria-label={t.note}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button disabled={busy} className="primary">
            {t.saveNote}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        <div className="catalog-grid">
          {data.notes
            .filter((n) => n.journalId === journal.id && n.scope !== 'trade')
            .map((n) => (
              <article key={n.id}>
                <h3>
                  {t.scopes[n.scope]} · {n.refId}
                </h3>
                <p className="pre-wrap">{n.body}</p>
                <button
                  onClick={() => {
                    setScope(n.scope as typeof scope);
                    setRef(n.refId);
                    setBody(n.body);
                  }}
                >
                  {t.edit}
                </button>
              </article>
            ))}
        </div>
      </section>
    </>
  );
}
