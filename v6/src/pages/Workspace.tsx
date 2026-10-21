import { Modal } from '../ui/Modal';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { JournalRepository } from '../data/repository';
import { emptySnapshot, type Snapshot } from '../data/snapshot';
import { parseHash, filterHash, acceptsShortcut, type Filters } from '../core/filters';
import type { analyze } from '../core/analyze';
import { KpiCard } from '../ui/KpiCard';
const EquityChart = lazy(() =>
  import('../ui/EquityChart').then((m) => ({ default: m.EquityChart })),
);
import { FilterBar } from '../ui/FilterBar';
import { StateFrame } from '../ui/StateFrame';
import Debug from './Debug';
import vi from '../i18n/vi.json';
const old = 'https://tuannhatky.fabledcoot2.chatgpt.site/';
export default function Workspace() {
  const repo = useMemo(() => new JournalRepository(), []);
  const [route, setRoute] = useState(() => parseHash(location.hash)),
    [data, setData] = useState<Snapshot>(emptySnapshot()),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [menu, setMenu] = useState(false),
    [add, setAdd] = useState(false),
    [holding, setHolding] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [computed, setComputed] = useState<{
    key: string;
    result: ReturnType<typeof analyze>;
    projections: Record<'money' | 'percent' | 'R', ReturnType<typeof analyze>['curve']>;
  }>();
  const journal = data.journals.find((j) => j.id === route.filters.journal) ?? data.journals[0];
  const key =
    JSON.stringify(route.filters) + JSON.stringify(data.trades.map((t) => [t.id, t.updatedAt]));
  const result = computed?.key === key ? computed.result : undefined;
  useEffect(() => {
    const change = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    let active = true;
    repo
      .snapshot()
      .then((s) => {
        if (active) {
          setData(s.data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [repo, route.page]);
  useEffect(() => () => repo.close(), [repo]);
  useEffect(() => {
    if (!journal) return;
    const worker = new Worker(new URL('../app/workspace.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => {
      if (e.data.ok) setComputed({ key, result: e.data.result, projections: e.data.projections });
      else setError(e.data.error);
    };
    worker.postMessage({ data, filters: route.filters });
    return () => worker.terminate();
  }, [data, journal, key, route.filters]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!acceptsShortcut(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setAdd(true);
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('symbol-search')?.focus();
      }
      if (e.key === 'Escape') {
        setMenu(false);
        setAdd(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const update = (filters: Filters) => {
    location.hash = filterHash(route.page, filters);
  };
  const go = (page: string) => {
    location.hash = filterHash(page, route.filters);
    setMenu(false);
  };
  const nav = (
    <>
      {vi.shell.nav.map((group) => (
        <div className="nav-group" key={group.name}>
          <h2>{group.name}</h2>
          {group.links.map(([label, page]) =>
            page === 'overview' || page === 'valuation' ? (
              <a key={page} href={old + '#' + page}>
                {label} ↗
              </a>
            ) : (
              <button
                className={route.page === page ? 'active' : ''}
                key={page}
                onClick={() => go(page)}
              >
                {label}
              </button>
            ),
          )}
        </div>
      ))}
    </>
  );
  const body = loading ? (
    <StateFrame kind="loading" />
  ) : error ? (
    <StateFrame
      kind="error"
      description={error}
      action={<button onClick={() => location.reload()}>{vi.shell.retry}</button>}
    />
  ) : !journal ? (
    <StateFrame
      kind="empty"
      description={vi.shell.emptyDescription}
      action={<button onClick={() => go('debug')}>{vi.shell.load}</button>}
    />
  ) : (
    <>
      <FilterBar value={{ ...route.filters, journal: journal.id }} onChange={update} data={data} />
      {route.page !== 'workspace' && (
        <div className="notice">
          {vi.shell.pending} <button onClick={() => go('workspace')}>{vi.shell.title}</button>
        </div>
      )}
      <div className="phase-grid">
        {vi.shell.phases.map((phase, i) => (
          <article key={phase}>
            <span className="eyebrow">{phase}</span>
            <h3>{vi.shell.questions[i]}</h3>
            <p>{vi.shell.phaseDescriptions[i]}</p>
          </article>
        ))}
      </div>
      {result ? (
        <>
          <div className="section-title">
            <div>
              <span className="eyebrow">
                {vi.shell.local} · {journal.currency}
              </span>
              <h2>{vi.shell.analysis}</h2>
            </div>
            <label>
              {vi.shell.timeUnit}
              <select
                value={holding}
                onChange={(e) => setHolding(e.target.value as typeof holding)}
              >
                <option value="hours">Giờ</option>
                <option value="minutes">Phút</option>
                <option value="days">Ngày</option>
              </select>
            </label>
          </div>
          {!result.events.length && <StateFrame kind="empty" description={vi.shell.noMatches} />}
          <div className="kpi-grid">
            {Object.entries(result.metrics).map(([id, metric]) => (
              <KpiCard
                key={id}
                id={id as keyof typeof vi.metricHelp}
                metric={metric}
                currency={journal.currency}
                demo={journal.isDemo}
                minSample={journal.settings.minSample}
                holding={holding}
              />
            ))}
          </div>
          <Suspense fallback={<StateFrame kind="loading" />}>
            <EquityChart projections={computed!.projections} journal={journal} />
          </Suspense>
        </>
      ) : (
        <StateFrame kind="loading" />
      )}
    </>
  );
  return (
    <div className="app-shell">
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Đi đến nội dung
      </a>
      <aside className="sidebar">
        <a className="brand" href={filterHash('workspace', route.filters)}>
          ↗ Tuan <b>Trader</b>
        </a>
        <p className="motto">{vi.app.motto}</p>
        {nav}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {vi.shell.menu}
          </button>
          <label>
            {vi.shell.journalLabel}
            <select
              value={journal?.id ?? ''}
              onChange={(e) => update({ ...route.filters, journal: e.target.value })}
            >
              <option value="" disabled>
                —
              </option>
              {data.journals.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>
          <button className="local-state" onClick={() => go('debug')}>
            ● {vi.shell.local}
          </button>
          <button className="primary" onClick={() => setAdd(true)}>
            {vi.shell.add}
          </button>
        </header>
        {menu && (
          <nav className="mobile-drawer" aria-label={vi.shell.menu}>
            <button onClick={() => setMenu(false)}>{vi.shell.close}</button>
            {nav}
          </nav>
        )}
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <span className="eyebrow">{vi.shell.stage}</span>
            <h1>
              {route.page === 'debug'
                ? vi.shell.backup
                : route.page === 'glossary'
                  ? vi.shell.library
                  : route.page === 'components'
                    ? vi.shell.components
                    : vi.shell.title}
            </h1>
            <p>{vi.shell.subtitle}</p>
          </div>
          {journal?.isDemo && <div className="demo-banner">{vi.status.demo}</div>}
          {route.page === 'debug' ? (
            <Debug />
          ) : route.page === 'glossary' ? (
            <section className="panel glossary">
              {vi.glossary.map(([term, definition]) => (
                <article key={term}>
                  <h2>{term}</h2>
                  <p>{definition}</p>
                </article>
              ))}
            </section>
          ) : route.page === 'components' ? (
            <section className="panel">
              <h2>{vi.shell.stateTitle}</h2>
              <p>{vi.shell.stateExample}</p>
              {(Object.keys(vi.shell.states) as (keyof typeof vi.shell.states)[]).map((kind) => (
                <StateFrame
                  key={kind}
                  kind={kind}
                  description={
                    kind === 'error'
                      ? vi.shell.inputError
                      : kind === 'missing'
                        ? vi.shell.missingDescription
                        : vi.shell.stateExample
                  }
                  action={
                    kind === 'empty' || kind === 'missing' ? (
                      <button onClick={() => go('debug')}>{vi.shell.load}</button>
                    ) : undefined
                  }
                />
              ))}
            </section>
          ) : (
            body
          )}
        </main>
        <footer>
          {vi.app.brand} · {vi.shell.signed}
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng di động">
        <a href={old + '#overview'}>{vi.shell.overview}</a>
        <button onClick={() => go('journal')}>{vi.shell.journal}</button>
        <button className="primary" onClick={() => setAdd(true)} aria-label={vi.shell.add}>
          ＋
        </button>
        <button onClick={() => go('workspace')}>{vi.shell.analysis}</button>
        <button onClick={() => setMenu(!menu)}>{vi.shell.menu}</button>
      </nav>
      {add && (
        <Modal label="add-title" onClose={() => setAdd(false)}>
          <div>
            <h2 id="add-title">{vi.shell.add}</h2>
            <p>{vi.shell.addNotice}</p>
            <a className="primary" href={old + '#journal'}>
              {vi.shell.old}
            </a>
            <button autoFocus onClick={() => setAdd(false)}>
              {vi.shell.close}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
