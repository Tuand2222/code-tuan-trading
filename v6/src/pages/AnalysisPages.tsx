import { useState } from 'react';
import type { Journal } from '../data/schema';
import type { analyze } from '../core/analyze';
import type { JournalAlert } from '../core/journalSelectors';
import { useLedger } from '../app/LedgerContext';
import { formatValue, formatDate } from '../ui/format';
import vi from '../i18n/vi.json';
const t = vi.s3;
export function AlertsPage({
  alerts,
  onOpen,
}: {
  alerts: JournalAlert[];
  onOpen: (id: string) => void;
}) {
  const [page, setPage] = useState(0),
    pages = Math.ceil(alerts.length / 50);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  return (
    <section className="panel">
      <h2>
        {t.alerts} · {alerts.length}
      </h2>
      {!alerts.length && <p>{t.noAlerts}</p>}
      {alerts.slice(currentPage * 50, (currentPage + 1) * 50).map((a) => (
        <article key={a.id} className="notice">
          <h3>{t.alertNames[a.rule]}</h3>
          <p>
            {t.value}: {a.value} · {t.threshold}: {a.threshold} · {a.severity}
          </p>
          {a.tradeIds.map((id) => (
            <button key={id} className="block trade-id" onClick={() => onOpen(id)}>
              {t.viewTrade} · {id}
            </button>
          ))}
        </article>
      ))}
      {pages > 1 && (
        <div className="actions">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            Trang trước
          </button>
          <span>
            {currentPage + 1}/{pages}
          </span>
          <button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>
            Trang tiếp
          </button>
        </div>
      )}
    </section>
  );
}
export function RiskPage({
  journal,
  result,
}: {
  journal: Journal;
  result: ReturnType<typeof analyze>;
}) {
  const f = result.fees;
  return (
    <>
      <section className="panel">
        <h2>{t.fees}</h2>
        <dl className="facts">
          {[
            [t.gross, f.gross],
            [t.commissionTax, f.commissionAndTax],
            [t.carryingPaid, f.carryingPaid],
            [t.carryingReceived, f.carryingReceived],
            [t.cost, f.cost],
            [t.net, f.net],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {formatValue(f.complete ? (value ?? null) : null, 'money', journal.currency, true)}
              </dd>
            </div>
          ))}
          <dt>{t.erosion}</dt>
          <dd>{formatValue(f.erosion, 'percent')}</dd>
        </dl>
      </section>
      <section className="panel">
        <h2>{t.distribution}</h2>
        <div className="histogram">
          {['≤ −1R', '−1R → 0', '0 → 1R', '1 → 2R', '2 → 3R', '≥ 3R'].map((label, i) => (
            <div key={label}>
              <strong>{result.rBuckets[i]}</strong>
              <div
                className={'histogram-bar ' + (i === 0 ? 'tail' : '')}
                style={{
                  height: Math.max(2, (result.rBuckets[i] / Math.max(1, ...result.rBuckets)) * 120),
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>{t.drawdown}</h2>
        <svg role="img" aria-label={`${t.drawdown} (${journal.currency})`} viewBox="0 0 700 220">
          <line x1="80" y1="25" x2="680" y2="25" stroke="currentColor" />
          <line x1="80" y1="180" x2="680" y2="180" stroke="currentColor" opacity=".2" />
          <text x="8" y="20" fill="currentColor">
            0 {journal.currency}
          </text>
          <text x="5" y="200" fill="currentColor">
            −{formatValue(result.metrics.maxDrawdown.value, 'money', journal.currency)}
          </text>
          <polyline
            fill="none"
            stroke="#dc627b"
            strokeWidth="2"
            points={result.curve
              .filter((p) => p.drawdown !== null)
              .map(
                (p, i) =>
                  `${80 + (i / Math.max(1, result.curve.length - 1)) * 600},${25 + (Number(p.drawdown) / Math.max(1, Number(result.metrics.maxDrawdown.value ?? 1))) * 155}`,
              )
              .join(' ')}
          />
        </svg>
        <details>
          <summary>{vi.shell.table}</summary>
          <table>
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.tradeId}</th>
                <th>{t.drawdown}</th>
              </tr>
            </thead>
            <tbody>
              {result.curve.map((p, i) => (
                <tr key={i}>
                  <td>{formatDate(p.time, journal.timezone)}</td>
                  <td className="trade-id">{p.tradeId}</td>
                  <td>{formatValue(p.drawdown, 'money', journal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </>
  );
}
export function EdgePage({
  journal,
  result,
}: {
  journal: Journal;
  result: ReturnType<typeof analyze>;
}) {
  const { data } = useLedger();
  return (
    <section className="panel">
      <h2>{t.edge}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                t.setup,
                t.count,
                t.reviewCount,
                t.riskCount,
                'Win rate',
                'PF',
                'R',
                t.ci,
                t.sample,
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.setups.map((s) => (
              <tr key={s.setupId}>
                <td>{data.setups.find((x) => x.id === s.setupId)?.name ?? t.blank}</td>
                <td>{s.count}</td>
                <td>{s.reviewed}</td>
                <td>
                  {s.n}/{s.of}
                </td>
                <td>{s.winRate === null ? '—' : formatValue(String(s.winRate), 'percent')}</td>
                <td>{formatValue(s.profitFactor ?? null, 'ratio')}</td>
                <td>{formatValue(s.mean ?? null, 'R')}</td>
                <td>{s.ci ? s.ci.map((v) => formatValue(String(v), 'R')).join(' → ') : '—'}</td>
                <td>
                  {s.count >= journal.settings.minSample ? vi.shell.sufficient : vi.shell.small}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{vi.shell.phaseDescriptions[1]}</p>
      <p>
        {t.wilson}:{' '}
        {result.overall.winCI
          ? result.overall.winCI.map((v) => formatValue(String(v * 100), 'percent')).join(' → ')
          : '—'}
      </p>
    </section>
  );
}
export function RollingPage({ result }: { result: ReturnType<typeof analyze> }) {
  return (
    <section className="panel">
      <h2>{t.rolling}</h2>
      <table>
        <thead>
          <tr>
            <th>n</th>
            <th>{t.riskCount}</th>
            <th>Win rate</th>
            <th>PF</th>
            <th>R</th>
            <th>{t.ci}</th>
          </tr>
        </thead>
        <tbody>
          {result.rolling.map((r) => (
            <tr key={r.window}>
              <td>{r.window}</td>
              <td>
                {r.n}/{r.of}
              </td>
              <td>{r.winRate === null ? '—' : formatValue(String(r.winRate), 'percent')}</td>
              <td>{formatValue(r.profitFactor ?? null, 'ratio')}</td>
              <td>{formatValue(r.mean ?? null, 'R')}</td>
              <td>{r.ci ? r.ci.map((v) => formatValue(String(v), 'R')).join(' → ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
