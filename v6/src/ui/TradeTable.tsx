import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Journal, Trade } from '../data/schema';
import { tradeFacts } from '../core/trade';
import { D } from '../core/money';
import {
  tradeLifecycle,
  toggleStar,
  saveTrade,
  ensureCatalog,
  reviewTrade,
} from '../data/tradeCommands';
import { acceptsShortcut } from '../core/filters';
import { useLedger } from '../app/LedgerContext';
import { formatDate, formatValue } from './format';
import { Modal } from './Modal';
import vi from '../i18n/vi.json';
const t = vi.s3;
const lifecycle = {
  open: t.opened,
  missing: t.missing,
  pending: t.pending,
  reviewed: t.reviewed,
  relink: t.relink,
};
export function TradeTable({
  trades,
  journal,
  onOpen,
  onEdit,
}: {
  trades: Trade[];
  journal: Journal;
  onOpen: (id: string) => void;
  onEdit: (trade: Trade) => void;
}) {
  const { data, mutate, busy } = useLedger();
  const [sort, setSort] = useState('newest'),
    [onlyStar, setOnlyStar] = useState(false),
    [error, setError] = useState('');
  const [inline, setInline] = useState<{
    id: string;
    risk: string;
    note: string;
    setup: string;
    revision: number;
  }>();
  const { revision } = useLedger();
  const [columns, setColumns] = useState({ setup: true, risk: true, hold: true });
  const rows = useMemo(
    () =>
      trades
        .filter((trade) => !onlyStar || trade.starred)
        .map(tradeFacts)
        .sort((a, b) =>
          sort === 'profit'
            ? D(b.net ?? '0').cmp(D(a.net ?? '0'))
            : sort === 'symbol'
              ? a.trade.symbol.localeCompare(b.trade.symbol)
              : (sort === 'oldest' ? 1 : -1) *
                (a.closeTime ?? a.openTime).localeCompare(b.closeTime ?? b.openTime),
        ),
    [trades, onlyStar, sort],
  );
  const parent = useRef<HTMLDivElement>(null);
  // React 18 without React Compiler: keep the virtualizer's live instance in this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 78,
    overscan: 6,
    enabled: rows.length >= 500,
  });
  const items =
    rows.length >= 500
      ? virtual
          .getVirtualItems()
          .map((v) => ({ index: v.index, key: v.key, start: v.start, end: v.end }))
      : rows.map((_, index) => ({ index, key: rows[index].id, start: 0, end: 0 }));
  const first = items[0],
    last = items.at(-1);
  async function action(fn: () => Promise<void>) {
    try {
      await fn();
      setError('');
    } catch (e) {
      setError(String(e).includes('STALE_REVISION') ? t.conflict : t.error);
    }
  }
  function csv() {
    const quote = (v: string) =>
      '"' + (/^[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"';
    const lines = [
      [t.tradeId, t.symbol, t.date, t.net, t.r],
      ...rows.map((f) => [
        f.id,
        f.trade.symbol,
        formatDate(f.closeTime ?? f.openTime, journal.timezone),
        f.net ?? '',
        f.r ?? '',
      ]),
    ];
    const a = document.createElement('a'),
      url = URL.createObjectURL(
        new Blob(['\ufeff' + lines.map((row) => row.map(quote).join(',')).join('\r\n')], {
          type: 'text/csv;charset=utf-8',
        }),
      );
    a.href = url;
    a.download = 'nhat-ky.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel">
      <div className="section-title">
        <h2>
          {t.journal} · {rows.length}
        </h2>
        <button onClick={csv}>{t.exportCSV}</button>
      </div>
      <div className="actions">
        <label>
          {t.sort}
          <select aria-label={t.sort} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">{t.newest}</option>
            <option value="oldest">{t.oldest}</option>
            <option value="profit">{t.profit}</option>
            <option value="symbol">{t.symbol}</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={onlyStar}
            onChange={(e) => setOnlyStar(e.target.checked)}
          />
          {t.starOnly}
        </label>
        <details>
          <summary>{t.showColumns}</summary>
          {Object.entries(columns).map(([key, on]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => setColumns({ ...columns, [key]: e.target.checked })}
              />
              {key === 'setup' ? t.setup : key === 'risk' ? t.risk : t.hold}
            </label>
          ))}
        </details>
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        ref={parent}
        className="table-scroll trade-scroll"
        style={rows.length >= 500 ? { height: 620 } : undefined}
      >
        <table>
          <caption>
            {t.journal} · {journal.currency}
          </caption>
          <thead>
            <tr>
              <th>{t.star}</th>
              <th>{t.symbol}</th>
              <th>{t.date}</th>
              <th>{t.state}</th>
              {columns.setup && <th>{t.setup}</th>}
              {columns.risk && <th>{t.risk}</th>}
              <th>{t.net}</th>
              <th>{t.r}</th>
              {columns.hold && <th>{t.hold}</th>}
              <th>{t.detail}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length >= 500 && first && (
              <tr aria-hidden="true">
                <td colSpan={10} style={{ height: first.start, padding: 0 }} />
              </tr>
            )}
            {items.map((item) => {
              const f = rows[item.index],
                trade = f.trade;
              return (
                <tr key={f.id} data-trade-id={f.id}>
                  <td>
                    <button
                      aria-label={`${t.star} ${trade.symbol} ${trade.id}`}
                      aria-pressed={trade.starred}
                      disabled={busy}
                      onClick={() => void action(() => mutate((s) => toggleStar(s, trade.id)))}
                    >
                      {trade.starred ? '★' : '☆'}
                    </button>
                  </td>
                  <td>
                    <strong>{trade.symbol}</strong>
                    <small className="block">{trade.side === 'long' ? t.long : t.short}</small>
                  </td>
                  <td>{formatDate(f.closeTime ?? f.openTime, journal.timezone)}</td>
                  <td>{lifecycle[tradeLifecycle(trade, data)]}</td>
                  {columns.setup && (
                    <td>{data.setups.find((s) => s.id === trade.setupId)?.name ?? '—'}</td>
                  )}
                  {columns.risk && (
                    <td>{formatValue(f.risk ?? null, 'money', journal.currency)}</td>
                  )}
                  <td>{formatValue(f.net ?? null, 'money', journal.currency, true)}</td>
                  <td>{formatValue(f.r ?? null, 'R')}</td>
                  {columns.hold && (
                    <td>
                      {formatValue(
                        f.holdMinutes === undefined ? null : String(f.holdMinutes),
                        'duration',
                        journal.currency,
                      )}
                    </td>
                  )}
                  <td>
                    <div className="actions">
                      <button onClick={() => onOpen(f.id)}>{t.detail}</button>
                      <button
                        onClick={() =>
                          setInline({
                            id: f.id,
                            risk: trade.initialRisk ?? '',
                            note:
                              data.notes.find((n) => n.refId === trade.id && n.scope === 'trade')
                                ?.body ?? '',
                            setup: trade.setupId ?? '',
                            revision,
                          })
                        }
                      >
                        {t.inline}
                      </button>
                      <button onClick={() => onEdit(trade)}>{t.edit}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length >= 500 && last && (
              <tr aria-hidden="true">
                <td
                  colSpan={10}
                  style={{ height: virtual.getTotalSize() - last.end, padding: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>{t.noTrades}</p>}
      {inline && (
        <Modal label="inline-title" onClose={() => setInline(undefined)}>
          <h2 id="inline-title">{t.inline}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await mutate((s) => {
                  const original = s.trades.find((t) => t.id === inline.id)!;
                  return saveTrade(
                    ensureCatalog(s, journal.id),
                    {
                      ...original,
                      initialRisk: inline.risk || undefined,
                      setupId: inline.setup || undefined,
                      updatedAt: new Date().toISOString(),
                    },
                    inline.note,
                  );
                }, inline.revision);
                setInline(undefined);
              });
            }}
          >
            <label>
              {t.risk}
              <input
                aria-label={t.risk}
                value={inline.risk}
                onChange={(e) => setInline({ ...inline, risk: e.target.value })}
              />
            </label>
            <label>
              {t.setup}
              <select
                aria-label={t.setup}
                value={inline.setup}
                onChange={(e) => setInline({ ...inline, setup: e.target.value })}
              >
                <option value="">—</option>
                {ensureCatalog(data, journal.id)
                  .setups.filter((s) => s.journalId === journal.id && !s.disabledAt)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t.note}
              <textarea
                value={inline.note}
                onChange={(e) => setInline({ ...inline, note: e.target.value })}
              />
            </label>
            <button className="primary" disabled={busy}>
              {t.save}
            </button>
            <button type="button" onClick={() => setInline(undefined)}>
              {t.cancel}
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </Modal>
      )}
    </section>
  );
}
export function TradeDrawer({
  id,
  ids,
  journal,
  onClose,
  onEdit,
  onNavigate,
}: {
  id: string;
  ids: string[];
  journal: Journal;
  onClose: () => void;
  onEdit: (t: Trade) => void;
  onNavigate: (id: string) => void;
}) {
  const { data, mutate, busy } = useLedger();
  const trade = data.trades.find((t) => t.id === id)!;
  const f = tradeFacts(trade);
  const catalog = ensureCatalog(data, journal.id);
  const tags = catalog.errorTags
    .filter((e) => e.journalId === journal.id && !e.disabledAt)
    .sort((a, b) => (a.hotkey ?? 10) - (b.hotkey ?? 10));
  const [note, setNote] = useState(
      data.notes.find((n) => n.id === trade.review.noteId)?.body ??
        data.notes.find((n) => n.scope === 'trade' && n.refId === id)?.body ??
        '',
    ),
    [nothing, setNothing] = useState(false),
    [error, setError] = useState('');
  const toggle = (tagId: string) => {
    void mutate((s) => {
      const c = ensureCatalog(s, journal.id),
        current = c.trades.find((t) => t.id === id)!;
      const next = current.errorTagIds.includes(tagId)
        ? current.errorTagIds.filter((x) => x !== tagId)
        : [...current.errorTagIds, tagId];
      return saveTrade(c, { ...current, errorTagIds: next, updatedAt: new Date().toISOString() });
    }).catch(() => setError(t.error));
  };
  const review = (done: boolean) =>
    void mutate((s) => reviewTrade(s, id, done, note, nothing)).catch((e) =>
      setError(
        String(e).includes('REVIEW_NOTE_REQUIRED') ? t.reviewNote + ' / ' + t.nothing : t.error,
      ),
    );
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (!acceptsShortcut(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = Number(e.key);
      if (key >= 1 && key <= 9) {
        const tag = tags.find((t) => t.hotkey === key);
        if (tag) {
          e.preventDefault();
          toggle(tag.id);
        }
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        review(!trade.review.done);
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const index = ids.indexOf(id) + (e.key === ']' ? 1 : -1);
        if (ids[index]) onNavigate(ids[index]);
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });
  return (
    <Modal label="trade-detail-title" onClose={onClose}>
      <h2 id="trade-detail-title">
        {trade.symbol} · {t.detail}
      </h2>
      <p className="trade-id">
        {t.tradeId}: {id}
      </p>
      <div className="actions">
        <button onClick={() => onEdit(trade)}>{t.edit}</button>
        <button
          disabled={ids.indexOf(id) <= 0}
          onClick={() => onNavigate(ids[ids.indexOf(id) - 1])}
        >
          {t.previous}
        </button>
        <button
          disabled={ids.indexOf(id) < 0 || ids.indexOf(id) >= ids.length - 1}
          onClick={() => onNavigate(ids[ids.indexOf(id) + 1])}
        >
          {t.next}
        </button>
      </div>
      <dl className="facts">
        <dt>{t.net}</dt>
        <dd>{formatValue(f.net ?? null, 'money', journal.currency, true)}</dd>
        <dt>{t.risk}</dt>
        <dd>{formatValue(f.risk ?? null, 'money', journal.currency)}</dd>
        <dt>{t.r}</dt>
        <dd>{formatValue(f.r ?? null, 'R')}</dd>
        <dt>{t.openQty}</dt>
        <dd>{f.openQty}</dd>
        <dt>{t.legacy}</dt>
        <dd>
          {formatValue(
            trade.disciplineLegacy === undefined ? null : String(trade.disciplineLegacy),
            'percent',
          )}
        </dd>
        <dt>{t.state}</dt>
        <dd>{lifecycle[tradeLifecycle(trade, data)]}</dd>
      </dl>
      {catalog.setups.find((s) => s.id === trade.setupId)?.checklist.length ? (
        <fieldset>
          <legend>{t.checklist}</legend>
          {catalog.setups
            .find((s) => s.id === trade.setupId)!
            .checklist.map((c) => (
              <label className="check" key={c.id}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={trade.checklist?.find((i) => i.criterionId === c.id)?.checked ?? false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    void mutate((s) => {
                      const current = s.trades.find((t) => t.id === id)!;
                      return saveTrade(s, {
                        ...current,
                        checklist: [
                          ...(current.checklist ?? []).filter((i) => i.criterionId !== c.id),
                          { criterionId: c.id, checked },
                        ],
                        updatedAt: new Date().toISOString(),
                      });
                    }).catch(() => setError(t.error));
                  }}
                />
                {c.text} · {c.weight}
              </label>
            ))}
        </fieldset>
      ) : null}
      <h3>{t.chips}</h3>
      {(['entry', 'management', 'exit'] as const).map((stage) => (
        <fieldset key={stage}>
          <legend>{t.stages[stage]}</legend>
          <div className="chips">
            {tags
              .filter((tag) => tag.stage === stage)
              .map((tag) => (
                <button
                  key={tag.id}
                  disabled={busy}
                  aria-pressed={trade.errorTagIds.includes(tag.id)}
                  onClick={() => toggle(tag.id)}
                >
                  {tag.hotkey} · {tag.name}
                </button>
              ))}
          </div>
        </fieldset>
      ))}
      <label>
        {t.reviewNote}
        <textarea
          aria-label={t.reviewNote}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button type="button" onClick={() => setNote((v) => v + (v ? '\n\n' : '') + t.tradeTemplate)}>
        {t.template}
      </button>
      <label className="check">
        <input type="checkbox" checked={nothing} onChange={(e) => setNothing(e.target.checked)} />
        {t.nothing}
      </label>
      <div className="actions">
        <button disabled={busy} className="primary" onClick={() => review(!trade.review.done)}>
          {trade.review.done ? t.reopen : t.markReview}
        </button>
        <button onClick={onClose}>{vi.shell.close}</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
