import { useMemo, type CSSProperties } from 'react';
import type { Journal, Trade } from '../data/schema';
import type { Filters } from '../core/filters';
import type { analyze } from '../core/analyze';
import { classicReport } from '../core/classic';
import { KpiCard } from '../ui/KpiCard';
import EquityTimeChart from '../ui/classic/EquityTimeChart';
import { formatValue } from '../ui/format';
import vi from '../i18n/vi.json';
import { analyze as calculate } from '../core/analyze';
import { selectTrades } from '../core/filters';
const t = vi.s3;
export function ClassicOverview({
  journal,
  trades,
  result,
  filters,
  onAdd,
  onFilters,
}: {
  journal: Journal;
  trades: Trade[];
  result: ReturnType<typeof analyze>;
  filters: Filters;
  onAdd: () => void;
  onFilters: (f: Filters) => void;
}) {
  const report = useMemo(
    () => classicReport({ journal, trades }, filters, 0),
    [journal, trades, filters],
  );
  const markets = ['', 'commodities', 'stocks', 'crypto', 'forex'];
  const rollups = useMemo(
    () =>
      ['commodities', 'stocks', 'crypto', 'forex'].map((market) => {
        const f = { ...filters, market };
        const r = calculate(journal, selectTrades(trades, f, journal.id), f);
        return { market, total: r.metrics.total.value, net: r.metrics.net.value };
      }),
    [journal, trades, filters],
  );
  const daily = Array.from({ length: 7 }, (_, i) => ({
    label: i === 6 ? 'CN' : 'T' + (i + 2),
    pnl: 0,
  }));
  for (const row of report.rows)
    daily[(new Date(row.date + 'T12:00:00Z').getUTCDay() + 6) % 7].pnl += row.pnl;
  const maximum = Math.max(1, ...daily.map((d) => Math.abs(d.pnl)));
  const total = Number(result.metrics.total.value ?? 0),
    wins = Number(result.metrics.wins.value ?? 0),
    losses = Number(result.metrics.losses.value ?? 0);
  const donut = {
    '--win': `${total ? (wins / total) * 360 : 0}deg`,
    '--loss': `${total ? ((wins + losses) / total) * 360 : 0}deg`,
  } as CSSProperties;
  return (
    <div className="classic-scope">
      <section className="overview-hero">
        <div className="overview-hero-copy">
          <span className="eyebrow">TRADING PLAN PRO</span>
          <h2>{t.overviewTitle}</h2>
          <p>{t.overviewDescription}</p>
          <button className="primary" onClick={onAdd}>
            {t.add}
          </button>
        </div>
        <div className="overview-principles">
          {t.principles.map((p, i) => (
            <article key={p}>
              <span>0{i + 1}</span>
              <strong>{p}</strong>
            </article>
          ))}
        </div>
      </section>
      <div className="market-switcher" role="group" aria-label="Lọc theo thị trường">
        {markets.map((m) => (
          <button
            key={m}
            aria-pressed={filters.market === m}
            onClick={() => onFilters({ ...filters, market: m })}
          >
            {m ? vi.shell.markets[m as keyof typeof vi.shell.markets] : 'Tất cả thị trường'}
          </button>
        ))}
      </div>
      <div className="market-overview-grid">
        {rollups.map((m) => (
          <article key={m.market}>
            <div>
              <small>{vi.shell.markets[m.market as keyof typeof vi.shell.markets]}</small>
              <strong>{m.total} lệnh</strong>
            </div>
            <b>{formatValue(m.net, 'money', journal.currency, true)}</b>
          </article>
        ))}
      </div>
      <div className="kpi-grid">
        {Object.entries(result.metrics).map(([id, metric]) => (
          <KpiCard
            key={id}
            id={id as keyof typeof vi.metricHelp}
            metric={metric}
            currency={journal.currency}
            demo={journal.isDemo}
            minSample={journal.settings.minSample}
          />
        ))}
      </div>
      <div className="dashboard-grid">
        <article className="panel panel-wide">
          <h2>{vi.shell.chart}</h2>
          {report.complete ? (
            <EquityTimeChart
              percentEnabled={report.riskCount > 0}
              percentLabel="Net / Tổng 1R (lệnh đủ R)"
              moneyLabel={journal.currency}
              ariaLabel={vi.shell.chart}
              points={report.rows.map((r) => ({
                date: r.date,
                money: r.endBalance,
                percent: r.riskPercent ?? 0,
              }))}
            />
          ) : (
            <p>{t.unknown}</p>
          )}
        </article>
        <article className="panel donut-panel">
          <h2>{t.outcome}</h2>
          <div className="donut" style={donut}>
            <div>
              <strong>{formatValue(result.metrics.winRate.value, 'percent')}</strong>
            </div>
          </div>
          <p>
            {t.wins}: {wins} · {t.losses}: {losses} · {vi.metricLabels.breakeven}:{' '}
            {result.metrics.breakeven.value ?? '—'}
          </p>
        </article>
        <article className="panel">
          <h2>Lãi / Lỗ trong tuần</h2>
          <div className="bar-chart">
            {daily.map((day) => (
              <div className="bar-column" key={day.label}>
                <div className="bar-value">
                  {formatValue(
                    report.complete ? String(day.pnl) : null,
                    'money',
                    journal.currency,
                    true,
                  )}
                </div>
                <div
                  className={'bar ' + (day.pnl >= 0 ? 'up' : 'down')}
                  style={{ height: (Math.abs(day.pnl) / maximum) * 112 }}
                />
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>{t.discipline}</h2>
          <div
            className="discipline-ring"
            style={
              {
                '--score': `${Number(result.metrics.discipline.value ?? 0) * 3.6}deg`,
              } as CSSProperties
            }
          >
            <div>
              <strong>{formatValue(result.metrics.discipline.value, 'percent')}</strong>
            </div>
          </div>
          <p>
            {t.reviewCount}: {result.shadow.reviewed}/{result.shadow.total}
          </p>
        </article>
      </div>
    </div>
  );
}
