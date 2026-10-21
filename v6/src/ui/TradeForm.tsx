import { useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import type { Journal, Trade } from '../data/schema';
import { manualTrade, saveTrade, ensureCatalog, type TradeInput } from '../data/tradeCommands';
import { tradeFacts } from '../core/trade';
import { useLedger } from '../app/LedgerContext';
import { formatValue } from './format';
import { Modal } from './Modal';
import vi from '../i18n/vi.json';
const t = vi.s3;
export function TradeForm({
  journal,
  trade,
  revision,
  onClose,
}: {
  journal: Journal;
  trade?: Trade;
  revision: number;
  onClose: () => void;
}) {
  const { data, mutate, busy } = useLedger();
  const catalog = ensureCatalog(data, journal.id);
  const facts = trade ? tradeFacts(trade) : undefined;
  const local = (date: string) =>
    formatInTimeZone(new Date(date), journal.timezone, "yyyy-MM-dd'T'HH:mm");
  const [input, setInput] = useState<TradeInput>(() => ({
    symbol: trade?.symbol ?? '',
    market: trade?.market ?? 'stocks',
    side: trade?.side ?? 'long',
    status: trade?.status ?? 'closed',
    open: local(facts?.openTime ?? new Date().toISOString()),
    close: local(facts?.closeTime ?? new Date().toISOString()),
    entry: facts?.avgEntry ?? '',
    exit: facts?.avgExit ?? '',
    quantity: trade?.legs[0].quantity ?? '',
    multiplier: trade?.multiplier ?? '1',
    risk: trade?.initialRisk ?? '',
    sl: trade?.plannedSL ?? '',
    tp: trade?.plannedTP ?? '',
    ...trade?.costs,
    commission: trade?.costs.commission ?? '0',
    tax: trade?.costs.tax ?? '0',
    funding: trade?.costs.funding ?? '0',
    swap: trade?.costs.swap ?? '0',
    other: trade?.costs.other ?? '0',
    costsKnown: trade?.costsKnown ?? false,
    setupId: trade?.setupId ?? '',
    note: data.notes.find((n) => n.scope === 'trade' && n.refId === trade?.id)?.body ?? '',
  }));
  const [error, setError] = useState('');
  const complex = !!trade && trade.legs.length > 2;
  const candidate = () =>
    complex
      ? {
          ...trade!,
          initialRisk: input.risk || undefined,
          setupId: input.setupId || undefined,
          updatedAt: new Date().toISOString(),
        }
      : manualTrade(input, journal, trade);
  let preview: ReturnType<typeof tradeFacts> | undefined;
  try {
    preview = tradeFacts(candidate());
  } catch {
    /* Incomplete form: display missing data, never zero-fill. */
  }
  const set = (key: keyof TradeInput, value: string | boolean) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  const fields = (
    [
      'symbol',
      'open',
      'close',
      'entry',
      'exit',
      'quantity',
      'multiplier',
      'risk',
      'sl',
      'tp',
      'commission',
      'tax',
      'funding',
      'swap',
      'other',
    ] as const
  ).filter((key) => input.status === 'closed' || !['close', 'exit'].includes(key));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  async function save() {
    setError('');
    try {
      const next = candidate();
      await mutate(
        (snapshot) => saveTrade(ensureCatalog(snapshot, journal.id), next, input.note),
        revision,
      );
      onClose();
    } catch (e) {
      setError(String(e).includes('STALE_REVISION') ? t.conflict : t.error + ' ' + t.positive);
    }
  }
  return (
    <Modal label="trade-form-title" onClose={onClose}>
      <form
        className="trade-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 id="trade-form-title">{trade ? t.edit : t.add}</h2>
        <p>
          {t.currency}: {journal.currency} · {t.timezone}: {journal.timezone}
        </p>
        {complex && <p className="notice">{t.multi}</p>}
        <div className="filter-grid">
          {fields.map((key) => (
            <label key={key}>
              {t[key]}
              <input
                aria-label={t[key]}
                type={key === 'open' || key === 'close' ? 'datetime-local' : 'text'}
                inputMode={['symbol', 'open', 'close'].includes(key) ? undefined : 'decimal'}
                value={input[key]}
                onChange={(e) => set(key, e.target.value)}
                disabled={busy || (complex && key !== 'risk')}
                required={
                  ['symbol', 'open', 'entry', 'quantity', 'multiplier'].includes(key) ||
                  (input.status === 'closed' && ['exit', 'close'].includes(key))
                }
                maxLength={key === 'symbol' ? 80 : 256}
              />
            </label>
          ))}
          <label>
            {t.market}
            <select
              aria-label={t.market}
              value={input.market}
              disabled={complex}
              onChange={(e) => set('market', e.target.value)}
            >
              {Object.entries(vi.shell.markets).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.side}
            <select
              aria-label={t.side}
              value={input.side}
              disabled={complex}
              onChange={(e) => set('side', e.target.value)}
            >
              <option value="long">{t.long}</option>
              <option value="short">{t.short}</option>
            </select>
          </label>
          <label>
            {t.status}
            <select
              aria-label={t.status}
              value={input.status}
              disabled={complex}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="closed">{t.closed}</option>
              <option value="open">{t.opened}</option>
            </select>
          </label>
          <label>
            {t.setup}
            <select
              aria-label={t.setup}
              value={input.setupId}
              onChange={(e) => set('setupId', e.target.value)}
            >
              <option value="">{t.blank}</option>
              {catalog.setups
                .filter((s) => s.journalId === journal.id && !s.disabledAt)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={input.costsKnown}
            disabled={complex}
            onChange={(e) => set('costsKnown', e.target.checked)}
          />
          {t.costsKnown}
        </label>
        <button
          type="button"
          onClick={() => set('note', input.note + (input.note ? '\n\n' : '') + t.tradeTemplate)}
        >
          {t.template}
        </button>
        <label>
          {t.note}
          <textarea
            aria-label={t.note}
            value={input.note}
            onChange={(e) => set('note', e.target.value)}
            maxLength={100000}
          />
        </label>
        <section className="preview" aria-label={t.preview}>
          <h3>{t.preview}</h3>
          <p>
            {t.gross}: {formatValue(preview?.gross ?? null, 'money', journal.currency, true)} ·{' '}
            {t.cost}: {formatValue(preview?.cost ?? null, 'money', journal.currency)} · {t.net}:{' '}
            <strong>{formatValue(preview?.net ?? null, 'money', journal.currency, true)}</strong> ·{' '}
            {t.r}: {formatValue(preview?.r ?? null, 'R')}
          </p>
        </section>
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button className="primary" disabled={busy} type="submit">
            {busy ? t.saving : t.save}
          </button>
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
