import { useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import type { Filters } from '../core/filters';
import { emptyFilters } from '../core/filters';
import type { Snapshot } from '../data/snapshot';
import { viewRepository, saveView, readView, type SavedView } from '../data/views';
import vi from '../i18n/vi.json';
export function FilterBar({
  value,
  onChange,
  data,
  compact = false,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  data: Snapshot;
  compact?: boolean;
}) {
  const [views, setViews] = useState<SavedView[]>([]),
    [name, setName] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    void viewRepository.views
      .toArray()
      .then(setViews)
      .catch(() => setMessage(vi.shell.viewError));
  }, []);
  const journal = data.journals.find((j) => j.id === value.journal) ?? data.journals[0];
  const set = (key: keyof Filters, v: string) => onChange({ ...value, [key]: v });
  const trades = data.trades.filter((t) => t.journalId === journal?.id);
  function preset(index: number) {
    if (!index) {
      onChange({ ...value, from: '', to: '' });
      return;
    }
    const today = formatInTimeZone(
      new Date(),
      journal?.timezone ?? 'Asia/Ho_Chi_Minh',
      'yyyy-MM-dd',
    );
    const date = new Date(today + 'T12:00:00Z');
    const from = new Date(date);
    if (index === 2) from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
    if (index === 3) from.setUTCDate(1);
    if (index === 4) {
      from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3, 1);
    }
    if (index === 5) from.setUTCMonth(0, 1);
    onChange({ ...value, from: from.toISOString().slice(0, 10), to: today });
  }
  const options: [keyof Filters, string, string[][]][] = [
    [
      'market',
      vi.shell.market,
      [...new Set(trades.map((t) => t.market))].map((v) => [
        v,
        vi.shell.markets[v as keyof typeof vi.shell.markets] ?? v,
      ]),
    ],
    [
      'setup',
      vi.shell.setup,
      data.setups.filter((s) => s.journalId === journal?.id).map((s) => [s.id, s.name]),
    ],
    [
      'side',
      vi.shell.side,
      [
        ['long', 'Long'],
        ['short', 'Short'],
      ],
    ],
    [
      'error',
      vi.shell.error,
      data.errorTags.filter((s) => s.journalId === journal?.id).map((s) => [s.id, s.name]),
    ],
    [
      'result',
      vi.shell.result,
      [
        ['win', 'Lãi'],
        ['loss', 'Lỗ'],
        ['breakeven', 'Hòa vốn'],
      ],
    ],
    [
      'review',
      vi.shell.review,
      [
        ['reviewed', 'Đã review'],
        ['pending', 'Chưa review'],
      ],
    ],
    [
      'tag',
      vi.shell.tag,
      [
        ...new Set(
          trades
            .flatMap((t) => t.tags)
            .filter((t) => !t.startsWith('v3-batch:') && t !== 'legacy-v3'),
        ),
      ].map((v) => [v, v]),
    ],
  ];
  return (
    <section className="panel filters">
      <details
        open={
          !compact ||
          Object.entries(value).some(([k, v]) => !['journal', 'operator'].includes(k) && !!v)
        }
      >
        <summary>{vi.shell.filter}</summary>
        <div className="filter-grid">
          <label>
            {vi.shell.date}
            <select
              aria-label={vi.shell.date}
              defaultValue=""
              onChange={(e) => preset(Number(e.target.value))}
            >
              <option value="" disabled>
                —
              </option>
              {vi.shell.presetLabels.map((v, i) => (
                <option key={v} value={i}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            {vi.shell.from}
            <input type="date" value={value.from} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label>
            {vi.shell.to}
            <input
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => set('to', e.target.value)}
            />
          </label>
          <label>
            {vi.shell.operator}
            <select value={value.operator} onChange={(e) => set('operator', e.target.value)}>
              <option value="AND">{vi.shell.and}</option>
              <option value="OR">{vi.shell.or}</option>
            </select>
          </label>
          <label>
            {vi.shell.symbol}
            <input
              id="symbol-search"
              value={value.symbol}
              onChange={(e) => set('symbol', e.target.value)}
              maxLength={80}
            />
          </label>
          {options.map(([key, label, items]) => (
            <label key={key}>
              {label}
              <select value={value[key]} onChange={(e) => set(key, e.target.value)}>
                <option value="">{vi.shell.all}</option>
                {items.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="muted">{vi.shell.scope}</p>
        <div className="chips">
          {Object.entries(value)
            .filter(([k, v]) => v && !['journal', 'operator'].includes(k))
            .map(([k, v]) => (
              <button
                key={k}
                onClick={() => set(k as keyof Filters, '')}
                aria-label={`${vi.shell.clear}: ${k} ${v}`}
              >
                {k}: {v} ×
              </button>
            ))}
          <button onClick={() => onChange({ ...emptyFilters, journal: value.journal })}>
            {vi.shell.clear}
          </button>
        </div>
        <div className="view-row">
          <label>
            {vi.shell.viewName}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <button
            disabled={!name.trim()}
            onClick={() => {
              void saveView(name, value)
                .then(() => viewRepository.views.toArray())
                .then((v) => {
                  setViews(v);
                  setMessage(vi.shell.viewSaved);
                })
                .catch(() => setMessage(vi.shell.viewError));
            }}
          >
            {vi.shell.saveView}
          </button>
          <label>
            {vi.shell.saved}
            <select
              aria-label={vi.shell.saved}
              value=""
              onChange={(e) => {
                const v = views.find((v) => v.name === e.target.value);
                if (v) onChange(readView(v));
              }}
            >
              <option value="">—</option>
              {views.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
            </select>
          </label>
        </div>
        {message && <p role="status">{message}</p>}
      </details>
    </section>
  );
}
