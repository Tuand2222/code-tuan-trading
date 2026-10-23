import { useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { tradeSchema, type Journal, type Trade, type PlannedTrade } from '../data/schema';
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
  planned,
}: {
  journal: Journal;
  trade?: Trade;
  revision: number;
  onClose: () => void;
  planned?: PlannedTrade;
}) {
  const { data, mutate, busy } = useLedger();
  const catalog = ensureCatalog(data, journal.id);
  const facts = trade ? tradeFacts(trade) : undefined;
  const local = (date: string) =>
    formatInTimeZone(new Date(date), journal.timezone, "yyyy-MM-dd'T'HH:mm");
  const [input, setInput] = useState<TradeInput>(() => ({
    symbol: trade?.symbol ?? planned?.symbol ?? '',
    market: trade?.market ?? 'stocks',
    side: trade?.side ?? planned?.side ?? 'long',
    status: trade?.status ?? (planned ? 'open' : 'closed'),
    open: local(facts?.openTime ?? new Date().toISOString()),
    close: local(facts?.closeTime ?? new Date().toISOString()),
    entry: facts?.avgEntry ?? planned?.plannedEntry ?? '',
    exit: facts?.avgExit ?? '',
    quantity: trade?.legs[0].quantity ?? '',
    multiplier: trade?.multiplier ?? '1',
    risk: trade?.initialRisk ?? '',
    sl: trade?.plannedSL ?? planned?.plannedSL ?? '',
    tp: trade?.plannedTP ?? planned?.plannedTP ?? '',
    ...trade?.costs,
    commission: trade?.costs.commission ?? '0',
    tax: trade?.costs.tax ?? '0',
    funding: trade?.costs.funding ?? '0',
    swap: trade?.costs.swap ?? '0',
    other: trade?.costs.other ?? '0',
    costsKnown: trade?.costsKnown ?? false,
    setupId: trade?.setupId ?? planned?.setupId ?? '',
    note: data.notes.find((n) => n.scope === 'trade' && n.refId === trade?.id)?.body ?? '',
  }));
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState<{ base: Trade; legs: Trade['legs'] }>();
  const complex = !!trade && trade.legs.length > 2;
  const candidate = () =>
    advanced
      ? tradeSchema.parse({
          ...advanced.base,
          symbol: input.symbol,
          market: input.market,
          side: input.side,
          status: input.status,
          legs: advanced.legs,
          multiplier: input.multiplier,
          initialRisk: input.risk || undefined,
          plannedSL: input.sl || undefined,
          plannedTP: input.tp || undefined,
          setupId: input.setupId || undefined,
          costs: {
            commission: input.commission,
            tax: input.tax,
            funding: input.funding,
            swap: input.swap,
            other: input.other,
          },
          costsKnown: input.costsKnown,
          review: { done: false },
          updatedAt: new Date().toISOString(),
        })
      : complex
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
      await mutate((snapshot) => {
        const saved = saveTrade(ensureCatalog(snapshot, journal.id), next, input.note);
        return planned
          ? {
              ...saved,
              plannedTrades: saved.plannedTrades.map((p) =>
                p.id === planned.id ? { ...p, status: 'taken' as const, takenTradeId: next.id } : p,
              ),
            }
          : saved;
      }, revision);
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
        {planned && (
          <p>
            Chuyển từ kế hoạch {planned.symbol}. Xác nhận thời điểm, giá khớp và khối lượng thực tế;
            kế hoạch chưa trở thành giao dịch cho tới khi bạn lưu.
          </p>
        )}
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
                disabled={
                  busy ||
                  (advanced
                    ? ['entry', 'exit', 'quantity', 'open', 'close'].includes(key)
                    : complex && key !== 'risk')
                }
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
        <button
          type="button"
          onClick={() => {
            try {
              const base = trade ?? manualTrade(input, journal);
              setAdvanced({ base, legs: structuredClone(base.legs) });
              setError('');
            } catch {
              setError('Nhập khớp vào hợp lệ trước; chọn Đang mở nếu chưa có khớp ra.');
            }
          }}
        >
          ＋ Vào / ra nhiều phần
        </button>
        {advanced && (
          <fieldset>
            <legend>Các lần khớp thực tế · UTC</legend>
            <p>
              Giá vốn theo bình quân khi nhập tay; lệnh gộp có phân bổ entry gốc riêng. Lệnh chỉ
              đóng khi khối lượng mở bằng 0.
            </p>
            {advanced.legs.map((leg, i) => (
              <div className="filter-grid" key={leg.id}>
                <label>
                  Loại khớp nâng cao {i + 1}
                  <select
                    value={leg.kind}
                    onChange={(e) =>
                      setAdvanced({
                        ...advanced,
                        legs: advanced.legs.map((l, k) =>
                          k === i ? { ...l, kind: e.target.value as 'in' | 'out' } : l,
                        ),
                      })
                    }
                  >
                    <option value="in">Vào</option>
                    <option value="out">Ra</option>
                  </select>
                </label>
                {(['time', 'price', 'quantity'] as const).map((field) => (
                  <label key={field}>
                    {{ time: 'Thời điểm', price: 'Giá', quantity: 'Khối lượng' }[field]} khớp nâng
                    cao {i + 1}
                    <input
                      value={leg[field]}
                      onChange={(e) =>
                        setAdvanced({
                          ...advanced,
                          legs: advanced.legs.map((l, k) =>
                            k === i ? { ...l, [field]: e.target.value } : l,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setAdvanced({ ...advanced, legs: advanced.legs.filter((_, k) => k !== i) })
                  }
                >
                  Bỏ khớp nâng cao {i + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAdvanced({
                  ...advanced,
                  legs: [
                    ...advanced.legs,
                    {
                      id: crypto.randomUUID(),
                      kind: 'in',
                      time: new Date().toISOString(),
                      price: '',
                      quantity: '',
                    },
                  ],
                })
              }
            >
              Thêm lần khớp thực
            </button>
            <p>
              Khối lượng còn mở: {preview?.openQty ?? 'Chưa hợp lệ'} · Vào TB{' '}
              {preview?.avgEntry ?? '—'} · Ra TB {preview?.avgExit ?? '—'}
            </p>
          </fieldset>
        )}
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
