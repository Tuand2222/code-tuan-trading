import { useMemo, useState } from 'react';
import type { Journal, Trade } from '../data/schema';
import { calendarMonth } from '../core/journalSelectors';
import { formatValue } from '../ui/format';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import vi from '../i18n/vi.json';
const t = vi.s3;
export function CalendarPage({
  journal,
  trades,
  onDay,
}: {
  journal: Journal;
  trades: Trade[];
  onDay: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const model = useMemo(() => calendarMonth(journal, trades, month), [journal, trades, month]);
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 12));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const rows = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + week * 7 + day);
      return d;
    }),
  );
  const max = Math.max(1, ...model.days.map((d) => Math.abs(Number(d.net ?? 0))));
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{t.calendar}</h2>
        <label>
          {t.month}
          <input
            type="month"
            aria-label={t.month}
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value);
            }}
          />
        </label>
      </div>
      <p>
        {t.monthNet}: <strong>{formatValue(model.net, 'money', journal.currency, true)}</strong>
      </p>
      <div className="table-scroll">
        <table className="calendar-table">
          <caption>
            {t.calendar} · {month.split('-').reverse().join('/')}
          </caption>
          <thead>
            <tr>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN', t.week].map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((days, i) => {
              const key = `${getISOWeekYear(days[0])}-W${String(getISOWeek(days[0])).padStart(2, '0')}`,
                week = model.weeks.find((w) => w.label === key);
              return (
                <tr key={i}>
                  {days.map((date) => {
                    const key = date.toISOString().slice(0, 10),
                      day = model.days.find((d) => d.date === key),
                      active = key.startsWith(month);
                    return (
                      <td
                        key={key}
                        className={active ? '' : 'other-month'}
                        style={
                          day?.net
                            ? {
                                background: `color-mix(in srgb, ${Number(day.net) >= 0 ? '#29ae7d' : '#dc627b'} ${10 + (Math.abs(Number(day.net)) / max) * 24}%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <button
                          aria-label={`${t.openDay} ${key}`}
                          disabled={!active}
                          onClick={() => onDay(key)}
                        >
                          <strong>{date.getUTCDate()}</strong>
                          {day && (
                            <>
                              <span>{formatValue(day.net, 'money', journal.currency, true)}</span>
                              <small>
                                {t.wins} {day.wins} · {t.losses} {day.losses} · {day.closed}{' '}
                                {vi.debug.trades}
                              </small>
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <strong>{key}</strong>
                    <p>{formatValue(week?.net ?? null, 'money', journal.currency, true)}</p>
                    <small>
                      {week?.closed ?? 0} {vi.debug.trades}
                    </small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details>
        <summary>{t.report}</summary>
        <table>
          <thead>
            <tr>
              <th>{t.week}</th>
              <th>{t.net}</th>
              <th>{t.count}</th>
            </tr>
          </thead>
          <tbody>
            {model.weeks.map((w) => (
              <tr key={w.label}>
                <td>{w.label}</td>
                <td>{formatValue(w.net, 'money', journal.currency, true)}</td>
                <td>{w.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
