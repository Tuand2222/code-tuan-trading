import { readCalculation, cacheCalculation } from '../data/calculationCache';
import { lazy, Suspense, useEffect, useState } from 'react';
import { LedgerProvider, useLedger } from '../app/LedgerContext';
import type { Trade } from '../data/schema';
import {
  parseHash,
  filterHash,
  selectTrades,
  acceptsShortcut,
  type Filters,
} from '../core/filters';
import type { analyze } from '../core/analyze';
import type { journalAlerts, health } from '../core/journalSelectors';
import { FilterBar } from '../ui/FilterBar';
import { StateFrame } from '../ui/StateFrame';
import { TradeForm } from '../ui/TradeForm';
import { TradeTable, TradeDrawer } from '../ui/TradeTable';
import { Settings } from './Settings';
import { AlertsPage, EdgePage } from './AnalysisPages';
import CloudArchive, { CloudAutoSync, CloudOwnerGuard } from './CloudArchive';
import Debug from './Debug';
import vi from '../i18n/vi.json';
import { CommandPalette } from '../ui/CommandPalette';
import { Welcome } from './Welcome';
import { AutomaticBackup } from '../ui/DirectoryBackup';
import { AppInstall } from '../ui/AppInstall';
import { formatValue } from '../ui/format';
const QuantOverview = lazy(() => import('./QuantOverview'));
const AdvancedWorkspace = lazy(() =>
  import('./AdvancedWorkspace').then((m) => ({ default: m.AdvancedWorkspace })),
);
const t = vi.s3;
export default function Workspace() {
  return (
    <LedgerProvider>
      <CloudOwnerGuard>
        <AutomaticBackup />
        <CloudAutoSync />
        <Application />
      </CloudOwnerGuard>
    </LedgerProvider>
  );
}
function Application() {
  const { data, revision, cacheToken, loading, error } = useLedger();
  const [route, setRoute] = useState(() => parseHash(location.hash)),
    [menu, setMenu] = useState(false),
    [advancedFilters, setAdvancedFilters] = useState(false),
    [form, setForm] = useState<{ trade?: Trade; revision: number }>(),
    [detail, setDetail] = useState('');
  const journal =
    data.journals.find((j) => j.id === route.filters.journal && !j.archivedAt) ??
    data.journals.find((j) => !j.archivedAt);
  const filters = { ...route.filters, journal: journal?.id ?? '' };
  const scope = JSON.stringify(filters);
  const key = scope + revision;
  const [computed, setComputed] = useState<{
    key: string;
    scope: string;
    result: ReturnType<typeof analyze>;
    alerts: ReturnType<typeof journalAlerts>;
    health: ReturnType<typeof health>;
    compact: boolean;
  }>();
  const [calculationError, setCalculationError] = useState('');
  const result =
    computed?.scope === scope && (!computed.compact || route.page === 'overview')
      ? computed.result
      : undefined;
  const trades = journal ? selectTrades(data.trades, filters, journal.id) : [];
  const scopedTradeIds = new Set([
    ...(result?.closed.map((f) => f.id) ?? []),
    ...(result?.events.map((e) => e.tradeId) ?? []),
  ]);
  const alerts = computed?.scope === scope ? computed.alerts : [];
  const status = computed?.scope === scope ? computed.health : undefined;
  useEffect(() => {
    const hash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', hash);
    return () => window.removeEventListener('hashchange', hash);
  }, []);
  useEffect(() => {
    if (!journal) return;
    let active = true;
    let worker: Worker | undefined;
    const cacheKey =
      import.meta.env.VITE_CALCULATION_BUILD +
      '|' +
      cacheToken +
      '|' +
      scope +
      '|' +
      (route.page === 'overview'
        ? 'overview'
        : ['edge', 'metrix', 'system'].includes(route.page)
          ? 'inference'
          : 'full');
    void (async () => {
      if (cacheToken) {
        const cached = await readCalculation(cacheKey);
        if (!active) return;
        if (cached) {
          setComputed({ ...(cached as NonNullable<typeof computed>), key, scope });
          return;
        }
      }
      worker = new Worker(new URL('../app/workspace.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        if (!active) return;
        if (e.data.ok) {
          setComputed({ ...e.data, key, scope });
          if (cacheToken) void cacheCalculation(cacheKey, e.data);
        } else setCalculationError('Không tính được dữ liệu: ' + e.data.error);
      };
      worker.onerror = () => {
        if (active) setCalculationError('Không tải được bộ tính. Hãy tải lại ứng dụng.');
      };
      worker.postMessage({ data, filters: route.filters, page: route.page });
    })();
    return () => {
      active = false;
      worker?.terminate();
    };
  }, [data, journal, key, scope, route.filters, route.page, cacheToken]);
  useEffect(() => {
    if (!loading && !data.journals.length && !location.hash) location.hash = '#welcome';
  }, [loading, data.journals.length]);
  const update = (f: Filters, page = route.page) => {
    window.location.assign(filterHash(page, f));
    setMenu(false);
  };
  const go = (page: string) => update(filters, page);
  const openForm = (trade?: Trade) => {
    setDetail('');
    setForm({ trade, revision });
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        !acceptsShortcut(e.target) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector('dialog[open]')
      )
        return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        location.href = '/classic#journal';
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('symbol-search')?.focus();
      }
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [revision]);
  const title =
    route.page === 'overview'
      ? vi.shell.overview
      : route.page === 'journal'
        ? t.journal
        : route.page === 'calendar'
          ? t.calendar
          : route.page === 'review'
            ? t.notes
            : route.page === 'playbook'
              ? t.playbook
              : route.page === 'system'
                ? t.annual
                : route.page === 'settings'
                  ? t.settings
                  : route.page === 'alerts'
                    ? t.alerts
                    : route.page === 'edge'
                      ? t.edge
                      : route.page === 'risk'
                        ? 'Rủi ro'
                        : route.page === 'debug'
                          ? vi.shell.backup
                          : route.page === 'glossary'
                            ? vi.shell.library
                            : route.page === 'components'
                              ? vi.shell.components
                              : route.page === 'metrix'
                                ? 'Trading MetriX'
                                : vi.shell.title;
  const nav = (
    <>
      {vi.shell.nav.map((g) => (
        <div className="nav-group" key={g.name}>
          <h2>{g.name}</h2>
          {g.links.map(([label, page]) => (
            <button
              key={page}
              className={route.page === page ? 'active' : ''}
              onClick={() => go(page)}
            >
              {label}
            </button>
          ))}
        </div>
      ))}
      <div className="nav-group restored-tools">
        <h2>BUỒNG LÁI & CÔNG CỤ</h2>
        <a href="/classic#overview">Buồng lái rủi ro & báo cáo mới</a>
        <a href="/classic#risk">Khối lượng & checklist trước lệnh</a>
        <a href="/classic#connections">Kết nối sàn & đồng bộ</a>
        <a href="/legacy#connections">Nhập nâng cao · MT4/MT5</a>
      </div>
    </>
  );
  let body = loading ? (
    <StateFrame kind="loading" />
  ) : !journal ? (
    <Settings onCreated={(id) => update({ ...filters, journal: id }, 'evidence')} />
  ) : !result ? (
    <StateFrame kind="loading" />
  ) : (
    <>
      {(route.page !== 'overview' || advancedFilters) && (
        <FilterBar data={data} value={filters} onChange={update} />
      )}
      {route.page === 'overview' ? (
        <QuantOverview
          key={journal.id}
          journal={journal}
          trades={trades}
          allTrades={data.trades}
          setups={data.setups}
          filters={filters}
          onFilters={update}
          onAdvancedFilters={() => setAdvancedFilters(!advancedFilters)}
          onOpen={setDetail}
        />
      ) : ['advanced', 'discipline', 'simulation', 'analytics'].includes(route.page) ? (
        <AdvancedWorkspace
          key={journal.id + scope}
          journal={journal}
          trades={trades.filter((t) => t.status === 'open' || scopedTradeIds.has(t.id))}
          scope={{ from: filters.from || undefined, to: filters.to || undefined }}
          base={computed?.key === key ? result : undefined}
        />
      ) : route.page === 'evidence' ? (
        <>
          <p data-testid="source-reconciliation">
            Đối chiếu nguồn V6: {result.closed.length} lệnh đóng · Net{' '}
            {formatValue(result.metrics.net.value, 'money', journal.currency, true)}. Đây là dữ liệu
            phân tích được giữ lại từ V6 trước đây.
          </p>
          <TradeTable
            trades={trades.filter((trade) => {
              const fact = result.closed.find((f) => f.id === trade.id);
              return (
                fact || trade.status === 'open' || result.events.some((e) => e.tradeId === trade.id)
              );
            })}
            journal={journal}
            onOpen={setDetail}
            onEdit={openForm}
          />
        </>
      ) : route.page === 'settings' ? (
        <Settings
          journal={journal}
          onCreated={(id) => update({ ...filters, journal: id }, 'evidence')}
        />
      ) : route.page === 'alerts' ? (
        <AlertsPage alerts={alerts} onOpen={setDetail} />
      ) : route.page === 'health' ? (
        <section className="panel">
          <h2>{t.health}</h2>
          <p>
            {t.riskMissing}: {status?.missingRisk} · {t.costCoverage}: {status?.knownCosts}/
            {status?.total} · {t.relink}: {status?.relink}
          </p>
          <button onClick={() => go('evidence')}>{t.healthOpen}</button>
        </section>
      ) : route.page === 'edge' ? (
        <EdgePage journal={journal} result={result} />
      ) : (
        <StateFrame kind="empty" description={vi.shell.pending} />
      )}
    </>
  );
  if (route.page === 'cloud') body = <CloudArchive />;
  const classicPages: Record<string, string> = {
    workspace: 'analytics',
    journal: 'journal',
    calendar: 'calendar',
    review: 'notes',
    playbook: 'process',
    risk: 'risk',
    metrix: 'statistics',
    system: 'system-tracker',
    valuation: 'valuation',
    connections: 'connections',
    plans: 'process',
    chartbook: 'notes',
  };
  if (classicPages[route.page])
    body = (
      <section className="panel">
        <h2>Chức năng này được dùng chung tại Classic</h2>
        <p>
          V6 tập trung phân tích định lượng. Dữ liệu V6 trước đây vẫn được giữ và có thể đối chiếu
          trong Dữ liệu phân tích.
        </p>
        <a href={'/classic#' + classicPages[route.page]}>Mở chức năng tại Classic ↗</a>
        <p>
          <button onClick={() => go('evidence')}>Đối chiếu dữ liệu V6 trước đây</button>
        </p>
      </section>
    );
  if (route.page === 'debug') body = <Debug />;
  if (route.page === 'welcome') body = <Welcome />;
  if (route.page === 'glossary')
    body = (
      <section className="panel glossary">
        {vi.glossary.map(([term, definition]) => (
          <article key={term}>
            <h2>{term}</h2>
            <p>{definition}</p>
          </article>
        ))}
      </section>
    );
  if (route.page === 'components')
    body = (
      <section className="panel">
        <h2>{vi.shell.stateTitle}</h2>
        <p>{vi.shell.stateExample}</p>
        {(Object.keys(vi.shell.states) as (keyof typeof vi.shell.states)[]).map((kind) => (
          <StateFrame
            key={kind}
            kind={kind}
            description={kind === 'error' ? vi.shell.inputError : vi.shell.stateExample}
          />
        ))}
      </section>
    );
  return (
    <div className={'app-shell' + (route.page === 'overview' ? ' v6-quant-mode' : '')}>
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
        <a className="brand" href={filterHash('overview', filters)}>
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
              aria-label={vi.shell.journalLabel}
              value={journal?.id ?? ''}
              onChange={(e) => update({ ...filters, journal: e.target.value })}
            >
              <option value="" disabled>
                —
              </option>
              {data.journals
                .filter((j) => !j.archivedAt)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </label>
          <nav className="workspace-switch" aria-label="Chuyển giao diện">
            <span>Giao diện</span>
            <a href="/classic#overview">Classic</a>
            <a href="/v6/#overview" aria-current="page">
              v6
            </a>
          </nav>
          <button className="local-state" onClick={() => go('cloud')}>
            ● Cloud & sao lưu
          </button>
          <button
            className="primary"
            onClick={() => {
              location.href = '/classic#journal';
            }}
          >
            {t.add}
          </button>
        </header>
        {menu && (
          <nav className="mobile-drawer" aria-label={vi.shell.menu}>
            <button onClick={() => setMenu(false)}>{vi.shell.close}</button>
            {nav}
          </nav>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          aria-busy={loading || (!!journal && computed?.key !== key)}
        >
          <div className="page-heading">
            <span className="eyebrow">
              {route.page === 'overview' ? 'V6 · PHÂN TÍCH ĐỊNH LƯỢNG' : vi.shell.stage}
            </span>
            <h1>{route.page === 'overview' ? 'Lợi thế & chất lượng hệ thống' : title}</h1>
            <p>
              {route.page === 'overview'
                ? 'Kiểm chứng kết quả, hiệu suất thoát lệnh và rủi ro theo R.'
                : vi.shell.subtitle}
            </p>
            <div className="actions">
              <button onClick={() => go('advanced')}>Phân tích nâng cao</button>
              <CommandPalette go={go} />
            </div>
          </div>
          {journal?.isDemo && route.page !== 'overview' && (
            <div className="demo-banner">{vi.status.demo}</div>
          )}
          <AppInstall />
          {status && route.page !== 'overview' && (
            <div className="status-strip">
              <button onClick={() => go('alerts')}>
                {alerts.length} {t.alerts}
              </button>
              <button onClick={() => go('health')}>
                {status.missingRisk} {t.riskMissing} · {t.costCoverage} {status.knownCosts}/
                {status.total}
              </button>
              <button onClick={() => go('review')}>
                {status.pending} {t.pending}
              </button>
              <button onClick={() => go('health')}>
                {status.relink} {t.relink}
              </button>
            </div>
          )}
          {calculationError && <p role="alert">{calculationError}</p>}
          {error && (
            <p role="alert">{String(error).includes('STALE_REVISION') ? t.conflict : t.error}</p>
          )}
          {route.page === 'connections' && (
            <section className="panel">
              <h2>Kết nối sàn và công cụ nhập của web trước</h2>
              <p>
                Binance/Bybit API, TradingView, bridge VPS/SSI/TCX/MT5/CQG, ảnh cloud và báo cáo
                PDF/Excel đã có lại trong web trước. Các nguồn tổng hợp và sổ v6 được giữ riêng để
                không dựng khớp lệnh hoặc thay đổi số liệu gốc.
              </p>
              <div className="actions">
                <a href="/classic#connections">Mở kết nối sàn & đồng bộ</a>
                <a href="/classic#journal">Nhập PDF/Excel và ảnh cloud</a>
                <a href="/legacy#connections">Nhập nhiều tài khoản · MT4/MT5</a>
              </div>
            </section>
          )}
          <Suspense fallback={<StateFrame kind="loading" />}>{body}</Suspense>
        </main>
        <footer>
          {vi.app.brand} · {vi.shell.signed} · <a href="/classic">Web trước đầy đủ</a> ·{' '}
          <a href="/legacy">Nhập nâng cao</a>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng di động">
        <button onClick={() => go('overview')}>{vi.shell.overview}</button>
        <button onClick={() => go('evidence')}>{vi.shell.journal}</button>
        <button
          className="primary"
          onClick={() => {
            location.href = '/classic#journal';
          }}
          aria-label={t.add}
        >
          ＋
        </button>
        <button onClick={() => go('overview')}>{vi.shell.analysis}</button>
        <button onClick={() => setMenu(!menu)}>{vi.shell.menu}</button>
      </nav>
      {form && journal && (
        <TradeForm
          key={(form.trade?.id ?? 'new') + ':' + form.revision}
          journal={journal}
          trade={form.trade}
          revision={form.revision}
          onClose={() => setForm(undefined)}
        />
      )}{' '}
      {detail && journal && data.trades.some((t) => t.id === detail) && (
        <TradeDrawer
          key={detail}
          id={detail}
          ids={trades.map((t) => t.id)}
          journal={journal}
          onClose={() => setDetail('')}
          onNavigate={setDetail}
          onEdit={openForm}
        />
      )}
    </div>
  );
}
