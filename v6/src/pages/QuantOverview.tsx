import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { Journal, Trade, Setup } from '../data/schema';
import type { Filters } from '../core/filters';
import { emptyFilters } from '../core/filters';
import {
  defaultQuantSettings,
  quantSettingsSchema,
  sqnLabel,
  type QuantSettings,
  type QuantReport,
} from '../core/quantLab';
import { readClassicQuantSource } from '../data/classicQuantSource';
import { QuantHelp } from '../ui/QuantHelp';
import {
  QuantPanel,
  QuantHistogram,
  QuantScatter,
  QuantHeatmap,
  QuantLine,
  qNumber,
} from '../ui/QuantPlots';
import { Modal } from '../ui/Modal';
import vi from '../i18n/vi.json';
import '../app/quant.css';
const cardIds = ['expectancy', 'sqn', 'pf', 'capture', 'dd', 'recovery'] as const;
type Card = (typeof cardIds)[number];
const cardNames: Record<Card, string> = {
  expectancy: 'Kỳ vọng mỗi lệnh',
  sqn: 'Chất lượng hệ thống',
  pf: 'Hệ số lợi nhuận',
  capture: 'Hiệu suất chốt lời',
  dd: 'Sụt giảm tối đa',
  recovery: 'Hệ số phục hồi',
};
const prefSchema = z.object({
  settings: quantSettingsSchema,
  order: z.array(z.enum(cardIds)).max(6),
  hidden: z.array(z.enum(cardIds)).max(5),
});
type Preferences = z.infer<typeof prefSchema>;
function preferences(journal: Journal): Preferences {
  try {
    const raw = localStorage.getItem('tuan-v6-quant:' + journal.id);
    if (raw) {
      const p = prefSchema.parse(JSON.parse(raw));
      return { ...p, order: [...new Set([...p.order, ...cardIds])] };
    }
  } catch {
    /* A broken display preference must not affect the ledger. */
  }
  return {
    settings: { ...defaultQuantSettings(), capital: Number(journal.startingBalance ?? 0) },
    order: [...cardIds],
    hidden: [],
  };
}
const marketName = (m: string) =>
  vi.shell.markets[m as keyof typeof vi.shell.markets] ??
  { futures: 'Phái sinh', cfd: 'CFD', options: 'Quyền chọn', unclassified: 'Chưa phân loại' }[m] ??
  m;
function SettingsDrawer({
  prefs,
  change,
  close,
  currency,
}: {
  prefs: Preferences;
  change: (p: Preferences) => void;
  close: () => void;
  currency: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const s = prefs.settings;
  const set = <K extends keyof QuantSettings>(key: K, value: QuantSettings[K]) =>
    change({ ...prefs, settings: { ...s, [key]: value } });
  const numeric = (key: keyof QuantSettings, title: string, max = 1e15, step = 'any') => (
    <label>
      {title}
      <input
        type="number"
        min="0"
        max={max}
        step={step}
        value={String(s[key])}
        onChange={(e) => set(key, Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
      />
    </label>
  );
  const move = (id: Card, offset: number) => {
    const order = [...prefs.order];
    const i = order.indexOf(id),
      next = i + offset;
    if (next < 0 || next >= order.length) return;
    [order[i], order[next]] = [order[next], order[i]];
    change({ ...prefs, order });
  };
  return (
    <dialog
      ref={ref}
      className="quant-drawer"
      aria-labelledby="quant-settings-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <span className="quant-eyebrow">PHÂN TÍCH V6</span>
          <h2 id="quant-settings-title">Cài đặt phân tích</h2>
        </div>
        <button onClick={close} aria-label="Đóng cài đặt">
          ✕
        </button>
      </header>
      <p className="quant-drawer-note">
        Tính lại ngay trên v6. Thiết lập này không sửa giao dịch gốc hoặc Classic.
      </p>
      <fieldset>
        <legend>Kết quả và chi phí</legend>
        <label>
          Cơ sở P&L
          <select
            value={s.pnl}
            onChange={(e) => set('pnl', e.target.value as QuantSettings['pnl'])}
          >
            <option value="net">Net · sau phí được ghi nhận</option>
            <option value="gross">Gross · trước chi phí</option>
          </select>
        </label>
        {numeric('frictionR', 'Ma sát giả định thêm mỗi lệnh (R)', 10, '0.01')}
        <p>
          Khoản giả định được trừ thêm trên mọi lệnh đủ R; không điền thay khoản phí đang thiếu.
        </p>
      </fieldset>
      <fieldset>
        <legend>Động cơ thống kê</legend>
        <label>
          Mẫu tính SQN
          <select
            value={s.sqnMode}
            onChange={(e) => set('sqnMode', e.target.value as QuantSettings['sqnMode'])}
          >
            <option value="cap100">Giới hạn hệ số √N ở 100 lệnh</option>
            <option value="unlimited">Không giới hạn hệ số √N</option>
            <option value="rolling100">Chỉ 100 lệnh đóng gần nhất</option>
          </select>
        </label>
        <label>
          Cơ sở ngày và thời điểm
          <select
            value={s.dateBasis}
            onChange={(e) => set('dateBasis', e.target.value as QuantSettings['dateBasis'])}
          >
            <option value="exit">Ngày / giờ đóng</option>
            <option value="entry">Ngày / giờ vào</option>
          </select>
        </label>
        <label>
          Độ chia khung giờ
          <select
            value={s.minutes}
            onChange={(e) => set('minutes', Number(e.target.value) as 15 | 30 | 60)}
          >
            <option value="15">15 phút</option>
            <option value="30">30 phút</option>
            <option value="60">60 phút</option>
          </select>
        </label>
        <label className="quant-check">
          <input
            type="checkbox"
            checked={s.includeBreakeven}
            onChange={(e) => set('includeBreakeven', e.target.checked)}
          />
          Tính lệnh hòa trong mẫu số tỷ lệ thắng
        </label>
      </fieldset>
      <fieldset>
        <legend>1R giả định · chỉ dùng trong mô phỏng</legend>
        {numeric('capital', `Vốn tham chiếu (${currency})`)}
        <label className="quant-check">
          <input
            type="checkbox"
            checked={s.assumeMissingRisk}
            onChange={(e) => set('assumeMissingRisk', e.target.checked)}
          />
          Cho phép mô phỏng lệnh đang thiếu 1R
        </label>
        <label>
          Cơ sở 1R giả định
          <select
            value={s.baselineMode}
            onChange={(e) => set('baselineMode', e.target.value as QuantSettings['baselineMode'])}
          >
            <option value="money">Số tiền cố định</option>
            <option value="percent">% vốn tham chiếu ban đầu</option>
          </select>
        </label>
        {s.baselineMode === 'money'
          ? numeric('baseline', `1R giả định (${currency})`)
          : numeric('riskPercent', '1R giả định (% vốn)', 100, '0.1')}
        <p>
          1R đã ghi nhận luôn được ưu tiên. Giả định không chứng minh rủi ro lịch sử và không được
          ghi ngược vào dữ liệu.
        </p>
        <a href="/classic#risk">Mở hạn mức vốn và quản trị rủi ro thực ở Classic ↗</a>
      </fieldset>
      <fieldset>
        <legend>Hiển thị chỉ số</legend>
        <p>Kéo thẻ trên tổng quan hoặc dùng các nút lên/xuống.</p>
        {prefs.order.map((id, i) => (
          <div className="quant-card-setting" key={id}>
            <label className="quant-check">
              <input
                type="checkbox"
                checked={!prefs.hidden.includes(id)}
                disabled={!prefs.hidden.includes(id) && prefs.hidden.length === 5}
                onChange={(e) =>
                  change({
                    ...prefs,
                    hidden: e.target.checked
                      ? prefs.hidden.filter((c) => c !== id)
                      : [...prefs.hidden, id],
                  })
                }
              />
              {cardNames[id]}
            </label>
            <button
              disabled={!i}
              aria-label={'Đưa ' + cardNames[id] + ' lên'}
              onClick={() => move(id, -1)}
            >
              ↑
            </button>
            <button
              disabled={i === prefs.order.length - 1}
              aria-label={'Đưa ' + cardNames[id] + ' xuống'}
              onClick={() => move(id, 1)}
            >
              ↓
            </button>
          </div>
        ))}
      </fieldset>
      <footer>
        <button
          onClick={() =>
            change({ settings: defaultQuantSettings(), order: [...cardIds], hidden: [] })
          }
        >
          Khôi phục thiết lập V6
        </button>
        <button className="primary" onClick={close}>
          Xong
        </button>
      </footer>
    </dialog>
  );
}
export default function QuantOverview({
  journal,
  trades,
  allTrades,
  filters,
  setups,
  onFilters,
  onAdvancedFilters,
  onOpen,
}: {
  journal: Journal;
  trades: Trade[];
  allTrades: Trade[];
  filters: Filters;
  setups: Setup[];
  onFilters: (f: Filters) => void;
  onAdvancedFilters: () => void;
  onOpen: (id: string) => void;
}) {
  const [prefs, setPrefs] = useState(() => preferences(journal));
  const [settingsOpen, setSettingsOpen] = useState(false),
    [source, setSource] = useState<'v6' | 'classic'>('v6');
  const [classic, setClassic] = useState<Awaited<ReturnType<typeof readClassicQuantSource>>>();
  const [sourceError, setSourceError] = useState(''),
    [sourceLoading, setSourceLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tab, setTab] = useState<'distribution' | 'exits' | 'risk'>('distribution');
  const [selection, setSelection] = useState<{ ids: string[]; title: string }>();
  const toolbar = useRef<HTMLDivElement>(null);
  const change = (p: Preferences) => {
    setPrefs(p);
    try {
      localStorage.setItem('tuan-v6-quant:' + journal.id, JSON.stringify(p));
      setSaveError('');
    } catch {
      setSaveError('Không lưu được cài đặt trên thiết bị.');
    }
  };
  useEffect(() => {
    const top = document.querySelector('.topbar');
    if (!top) return;
    const resize = new ResizeObserver(() =>
      toolbar.current?.style.setProperty(
        '--quant-toolbar-top',
        top.getBoundingClientRect().height + 'px',
      ),
    );
    resize.observe(top);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    if (source !== 'classic') return;
    let active = true;
    let generation = 0;
    const read = () => {
      const current = ++generation;
      setSourceLoading(true);
      setClassic(undefined);
      setSourceError('');
      void readClassicQuantSource()
        .then((r) => {
          if (active && current === generation) setClassic(r);
        })
        .catch(() => {
          if (active && current === generation)
            setSourceError(
              'Không đọc được Classic. Hãy kiểm tra phiên đăng nhập và bản lưu trên thiết bị.',
            );
        })
        .finally(() => {
          if (active && current === generation) setSourceLoading(false);
        });
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => {
      active = false;
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
    };
  }, [source]);
  const request = useMemo(
    () => ({
      trades,
      classic,
      source,
      sourceLoading,
      sourceError,
      settings: prefs.settings,
      timezone: journal.timezone,
      from: filters.from,
      to: filters.to,
      market: filters.market,
      setup: filters.setup,
      symbol: filters.symbol,
    }),
    [
      trades,
      classic,
      source,
      sourceLoading,
      sourceError,
      prefs.settings,
      journal.timezone,
      filters.from,
      filters.to,
      filters.market,
      filters.setup,
      filters.symbol,
    ],
  );
  const [completed, setCompleted] = useState<{
    request: typeof request;
    report?: QuantReport;
    error?: string;
  }>();
  const report = completed?.request === request ? completed.report : undefined;
  const error = saveError || (completed?.request === request ? completed.error : '');
  const calculating = !sourceError && completed?.request !== request;
  useEffect(() => {
    if (
      request.source === 'classic' &&
      (!request.classic || request.sourceLoading || request.sourceError)
    )
      return;
    const worker = new Worker(new URL('../app/quant.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => {
      setCompleted({
        request,
        ...(e.data.ok
          ? { report: e.data.report }
          : { error: 'Không tính được phân tích: ' + e.data.error }),
      });
    };
    worker.onerror = () => {
      setCompleted({ request, error: 'Không tải được bộ phân tích. Hãy tải lại trang.' });
    };
    worker.postMessage({
      trades: request.source === 'v6' ? request.trades : undefined,
      observations:
        request.source === 'classic'
          ? request.classic?.observations.filter(
              (r) =>
                (!request.market || r.market === request.market) &&
                (!request.setup || r.setup === request.setup) &&
                (!request.symbol || r.symbol.toUpperCase().includes(request.symbol.toUpperCase())),
            )
          : undefined,
      settings: request.settings,
      timezone: request.timezone,
      scope: { from: request.from, to: request.to },
    });
    return () => worker.terminate();
  }, [request]);
  const inspect = (ids: string[], title: string) => setSelection({ ids, title });
  const allMarkets =
    source === 'classic'
      ? [...new Set(classic?.observations.map((r) => r.market) ?? [])]
      : [...new Set(allTrades.filter((t) => t.journalId === journal.id).map((r) => r.market))];
  const setupOptions =
    source === 'classic'
      ? [...new Set(classic?.observations.map((r) => r.setup).filter(Boolean) ?? [])].map((s) => ({
          id: s,
          name: s,
        }))
      : setups.filter((s) => s.journalId === journal.id);
  const s = prefs.settings;
  const selectedIds = new Set(selection?.ids ?? []);
  const value = (id: Card) =>
    !report
      ? '—'
      : id === 'expectancy'
        ? qNumber(report.stats.mean) + (report.stats.mean === null ? '' : ' R')
        : id === 'sqn'
          ? qNumber(report.stats.sqn)
          : id === 'pf'
            ? report.stats.noLoss
              ? '∞'
              : qNumber(report.stats.pf)
            : id === 'capture'
              ? qNumber(report.capture, 1) + (report.capture === null ? '' : '%')
              : id === 'dd'
                ? qNumber(report.maxDD) + (report.maxDD === null ? '' : ' R')
                : qNumber(report.recovery);
  const badge = (id: Card) =>
    !report
      ? 'Đang tính'
      : id === 'sqn'
        ? sqnLabel(report.stats.sqn, report.stats.sqnN)
        : id === 'capture'
          ? report.captureN + ' lệnh thắng có MFE'
          : id === 'dd' || id === 'recovery'
            ? report.complete
              ? 'Toàn mẫu đủ R'
              : 'Thiếu R hoặc giờ đóng'
            : report.stats.n + '/' + report.rows.length + ' lệnh có R';
  return (
    <section className="quant-overview" aria-label="Phòng phân tích V6" aria-busy={calculating}>
      {(source === 'v6' ? journal.isDemo : classic?.isDemo) && (
        <div className="quant-demo">DỮ LIỆU MINH HỌA — không phản ánh hiệu suất thật.</div>
      )}
      <div className="quant-toolbar" ref={toolbar}>
        <label>
          Nguồn phân tích
          <select
            aria-label="Nguồn phân tích"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as typeof source);
              onFilters({
                ...emptyFilters,
                journal: filters.journal,
                from: filters.from,
                to: filters.to,
              });
            }}
          >
            <option value="v6">Sổ v6 hiện tại</option>
            <option value="classic">Classic · chỉ đọc</option>
          </select>
        </label>
        <label>
          Thị trường V6
          <select
            aria-label="Thị trường V6"
            value={filters.market}
            onChange={(e) => onFilters({ ...filters, market: e.target.value })}
          >
            <option value="">Tất cả thị trường</option>
            {[...new Set([...allMarkets, ...(filters.market ? [filters.market] : [])])].map((m) => (
              <option value={m} key={m}>
                {marketName(m)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Phương pháp V6
          <select
            aria-label="Phương pháp V6"
            value={filters.setup}
            onChange={(e) => onFilters({ ...filters, setup: e.target.value })}
          >
            <option value="">Tất cả phương pháp</option>
            {setupOptions.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Từ ngày V6
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          Đến ngày V6
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <button className="quant-settings-button" onClick={() => setSettingsOpen(true)}>
          ⚙ Cài đặt V6
        </button>
        <div className="quant-context">
          <span>
            {source === 'classic' ? (classic?.source ?? 'Đang đọc Classic') : journal.name}
          </span>
          <span>{report?.rows.length ?? '—'} lệnh đóng</span>
          <span>{s.pnl === 'net' ? 'Net' : 'Gross'} / R</span>
          <span>{s.dateBasis === 'exit' ? 'Theo ngày đóng' : 'Theo ngày vào'}</span>
          <span>{journal.timezone}</span>
          {source === 'v6' && <button onClick={onAdvancedFilters}>Bộ lọc nâng cao</button>}
        </div>
      </div>
      {source === 'classic' && (
        <p className="quant-source-note">
          Classic được đọc riêng để phân tích. Giao diện, sổ v6 và dữ liệu Classic giữ nguyên.
          {classic?.skipped
            ? ` ${classic.skipped} phiếu khớp hoặc dòng không đủ cấu trúc được loại khỏi số lệnh đóng.`
            : ''}
        </p>
      )}
      {sourceError && <p role="alert">{sourceError}</p>}
      {error && <p role="alert">{error}</p>}
      {report?.simulated && (
        <div className="quant-simulation" role="status">
          <b>MÔ PHỎNG</b>
          <span>
            Ma sát thêm {qNumber(s.frictionR)}R/lệnh · {report.assumed} lệnh dùng 1R giả định. Dữ
            liệu gốc không đổi.
          </span>
        </div>
      )}
      <div className="quant-cards" aria-label="Sáu chỉ số định lượng">
        {prefs.order
          .filter((id) => !prefs.hidden.includes(id))
          .map((id) => (
            <article
              key={id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain') as Card;
                if (!cardIds.includes(from) || from === id) return;
                const order = prefs.order.filter((c) => c !== from);
                order.splice(order.indexOf(id), 0, from);
                change({ ...prefs, order });
              }}
              aria-label={cardNames[id]}
            >
              <header>
                <h2>{cardNames[id]}</h2>
                <QuantHelp id={id} />
              </header>
              <strong className="quant-value">{calculating ? '…' : value(id)}</strong>
              <span className="quant-badge">{badge(id)}</span>
            </article>
          ))}
      </div>
      <div className="quant-section-nav" aria-label="Nhóm phân tích">
        {(
          [
            ['distribution', 'Phân phối & thời điểm'],
            ['exits', 'Quản lý lệnh'],
            ['risk', 'Sụt giảm & ổn định'],
          ] as const
        ).map(([id, name]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
        <span>
          {report?.stats.n ?? 0}/{report?.rows.length ?? 0} đủ R · {report?.excursions.length ?? 0}{' '}
          có MAE/MFE
        </span>
      </div>
      {calculating && (
        <p role="status" className="quant-loading">
          Đang tính lại phân tích…
        </p>
      )}
      {report && (
        <div className="quant-chart-grid" style={{ opacity: calculating ? 0.5 : 1 }}>
          {tab === 'distribution' ? (
            <>
              <QuantHistogram report={report} inspect={inspect} />
              <QuantHeatmap report={report} minutes={s.minutes} inspect={inspect} />
            </>
          ) : tab === 'exits' ? (
            <>
              <QuantScatter report={report} kind="mfe" inspect={inspect} />
              <QuantScatter report={report} kind="mae" inspect={inspect} />
            </>
          ) : (
            <>
              <QuantLine report={report} kind="dd" inspect={inspect} />
              <QuantLine report={report} kind="rolling" inspect={inspect} />
              <QuantPanel
                title="Tỷ số theo R mỗi lệnh"
                help="ratios"
                count={report.stats.n + ' mẫu'}
              >
                <dl className="quant-ratios">
                  <div>
                    <dt>Sharpe(R)</dt>
                    <dd>{qNumber(report.stats.sharpe)}</dd>
                  </div>
                  <div>
                    <dt>Sortino(R)</dt>
                    <dd>{qNumber(report.stats.sortino)}</dd>
                  </div>
                  <div>
                    <dt>Tỷ lệ thắng (ngữ cảnh)</dt>
                    <dd>{qNumber(report.winRate, 1)}%</dd>
                  </div>
                </dl>
                <p className="quant-footnote">Rf/MAR = 0 · không thường niên hóa.</p>
              </QuantPanel>
            </>
          )}
        </div>
      )}
      <div className="quant-bottom-actions">
        <button
          onClick={() =>
            inspect(
              report?.rows.filter((r) => r.r === null).map((r) => r.id) ?? [],
              'Lệnh chưa có R',
            )
          }
        >
          Đối chiếu dữ liệu thiếu ({report?.rows.filter((r) => r.r === null).length ?? 0})
        </button>
        <a href="/classic#overview">Mở Classic để xem kế toán & vận hành ↗</a>
      </div>
      {settingsOpen && (
        <SettingsDrawer
          prefs={prefs}
          change={change}
          close={() => setSettingsOpen(false)}
          currency={source === 'classic' ? 'VND' : journal.currency}
        />
      )}
      {selection && (
        <Modal label="quant-selection-title" onClose={() => setSelection(undefined)}>
          <h2 id="quant-selection-title">{selection.title}</h2>
          <p>
            {selection.ids.length} lệnh · {source === 'classic' ? 'Classic chỉ đọc' : 'Sổ v6'}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Ngày đóng (UTC)</th>
                  <th>Kết quả (R)</th>
                  <th>1R</th>
                  {source === 'v6' && <th>Hồ sơ</th>}
                </tr>
              </thead>
              <tbody>
                {report?.rows
                  .filter((r) => selectedIds.has(r.id))
                  .slice(0, 200)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.symbol}</td>
                      <td>{r.closeTime.slice(0, 16).replace('T', ' ')}</td>
                      <td>{qNumber(r.r)}</td>
                      <td>{r.assumed ? 'Giả định' : r.risk ? 'Ghi nhận' : 'Thiếu'}</td>
                      {source === 'v6' && (
                        <td>
                          <button
                            onClick={() => {
                              setSelection(undefined);
                              onOpen(r.id);
                            }}
                          >
                            Mở lệnh
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {selection.ids.length > 200 && (
            <p>Hiển thị 200/{selection.ids.length} lệnh. Thu hẹp bộ lọc để đối chiếu chi tiết.</p>
          )}
          <button onClick={() => setSelection(undefined)}>Đóng đối chiếu</button>
        </Modal>
      )}
    </section>
  );
}
