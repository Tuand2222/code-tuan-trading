import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLedger } from '../app/LedgerContext';
import type { Journal } from '../data/schema';
import {
  capitalPolicySchema,
  journalCapitalSettings,
  readCapitalLab,
  type CapitalLab,
} from '../data/capitalSettings';
import { observeTrades } from '../core/quantLab';
import { tradeFacts } from '../core/trade';
import {
  capitalProtection,
  fixedStakeRuin,
  solveKelly,
  probabilityBox,
  accountObservations,
  type CapitalReport,
  type CapitalSimulation,
} from '../core/capitalPro';
import { readClassicQuantSource } from '../data/classicQuantSource';
import { DEFAULT_RISK, positionSize, type RiskSettings } from '../../../lib/risk-analytics';
import type { Filters } from '../core/filters';
import { selectTrades } from '../core/filters';
import { dayInZone } from '../core/analyze';
import { capitalNumber as num, CapitalLines, CapitalFan } from '../ui/CapitalCharts';
import { SharedCapital } from '../ui/SharedCapital';
import { Modal } from '../ui/Modal';
import { readCalculation, cacheCalculation } from '../data/calculationCache';
import { canonical, sha256 } from '../data/backup';
import '../app/capital.css';
const tabs = [
  ['overview', 'Ba lớp liên động'],
  ['protect', '1 · Bảo vệ vốn'],
  ['evaluate', '2 · Đánh giá chiến lược'],
  ['optimize', '3 · Tối ưu vốn'],
  ['stress', 'Mô phỏng & stress'],
] as const;
type Tab = (typeof tabs)[number][0];
const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : num(n * 100) + '%';
function Help({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="capital-help">
      <summary>{title} · công thức & giới hạn</summary>
      {children}
    </details>
  );
}
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="capital-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}
export default function CapitalPro({
  journal,
  filters,
  onOpen,
}: {
  journal: Journal;
  filters: Filters;
  onOpen: (id: string) => void;
}) {
  const { data, revision, mutate } = useLedger();
  const [lab, setLab] = useState(() => readCapitalLab(journal.id)),
    [tab, setTab] = useState<Tab>('overview'),
    [settingsOpen, setSettingsOpen] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [classic, setClassic] = useState<Awaited<ReturnType<typeof readClassicQuantSource>>>(),
    [shared, setShared] = useState<RiskSettings>(),
    [sourceError, setSourceError] = useState('');
  const [reportState, setReportState] = useState<{ request: unknown; result: CapitalReport }>(),
    [simulation, setSimulation] = useState<{ request: unknown; result: CapitalSimulation }>(),
    [error, setError] = useState(''),
    [busyRequest, setBusyRequest] = useState<unknown>();
  const simulationWorker = useRef<Worker>();
  const [entry, setEntry] = useState(''),
    [stop, setStop] = useState(''),
    [multiplier, setMultiplier] = useState(''),
    [step, setStep] = useState('1'),
    [fee, setFee] = useState('0');
  const [capitalDraft, setCapitalDraft] = useState(journal.startingBalance ?? ''),
    [policyDraft, setPolicyDraft] = useState(() =>
      capitalPolicySchema.parse(journal.settings.capitalPolicy ?? {}),
    );
  useEffect(() => {
    const reload = () => setLab(readCapitalLab(journal.id));
    window.addEventListener('v6-cloud-sync', reload);
    return () => window.removeEventListener('v6-cloud-sync', reload);
  }, [journal.id]);
  useEffect(() => {
    localStorage.setItem('tuan-v6-capital:' + journal.id, JSON.stringify(lab));
  }, [lab, journal.id]);
  useEffect(() => {
    if (lab.source !== 'classic') return;
    let active = true;
    const load = async () => {
      setClassic(undefined);
      setShared(undefined);
      setSourceError('');
      try {
        const source = await readClassicQuantSource();
        if (!active) return;
        setClassic(source);
        if (source.owner) {
          const r = await fetch('/api/risk-settings', {
            cache: 'no-store',
            headers: { 'X-Journal-Owner': source.owner },
          });
          if (!r.ok) throw Error('Chưa đọc được hồ sơ vốn Classic cùng tài khoản.');
          const b = await r.json();
          if (b.owner !== source.owner) throw Error('Tài khoản đã thay đổi.');
          if (active) setShared(b.settings ?? DEFAULT_RISK);
        }
      } catch (e) {
        if (active) setSourceError(String(e));
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [lab.source, refresh]);
  const allNative = useMemo(
    () => data.trades.filter((t) => t.journalId === journal.id),
    [data.trades, journal.id],
  );
  const nativeObservations = useMemo(() => observeTrades(allNative), [allNative]);
  const nativeSettings = useMemo(() => {
    const settings = journalCapitalSettings(journal, data.cashFlows);
    settings.exposures = allNative
      .filter((t) => t.status === 'open')
      .map((t) => ({
        id: t.id,
        group: t.symbol,
        side: t.side,
        risk: Number(tradeFacts(t).risk ?? 0),
      }));
    return settings;
  }, [journal, data.cashFlows, allNative]);
  const all = useMemo(
    () => (lab.source === 'classic' ? (classic?.observations ?? []) : nativeObservations),
    [lab.source, classic, nativeObservations],
  );
  const settings = lab.source === 'classic' ? (shared ?? DEFAULT_RISK) : nativeSettings;
  const nativeAccount = useMemo(() => accountObservations(allNative), [allNative]);
  const account = useMemo(
    () => capitalProtection(lab.source === 'v6' ? nativeAccount : all, settings),
    [all, nativeAccount, settings, lab.source],
  );
  const incompleteOpen =
    lab.source === 'v6' && allNative.some((t) => t.status === 'open' && !tradeFacts(t).risk);
  const unsupportedClassicFilter =
    lab.source === 'classic' && !!(filters.review || filters.error || filters.tag);
  const selected = useMemo(() => {
    const allowed = new Set(selectTrades(allNative, filters, journal.id).map((t) => t.id));
    return all.filter((o) => {
      const day =
        (o.exitTimeKnown === false ? o.exitDate : undefined) ??
        dayInZone(o.closeTime, settings.timezone);
      const tests = [
        ...(filters.market ? [o.market === filters.market] : []),
        ...(filters.setup ? [o.setup === filters.setup] : []),
        ...(filters.symbol ? [o.symbol.includes(filters.symbol.toUpperCase())] : []),
        ...(filters.side ? [o.side === filters.side] : []),
        ...(filters.result
          ? [
              o.net !== null &&
                (filters.result === 'win'
                  ? Number(o.net) > 0
                  : filters.result === 'loss'
                    ? Number(o.net) < 0
                    : Number(o.net) === 0),
            ]
          : []),
      ];
      return (
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to) &&
        (lab.source === 'v6'
          ? allowed.has(o.id)
          : !unsupportedClassicFilter &&
            (!tests.length ||
              (filters.operator === 'OR' ? tests.some(Boolean) : tests.every(Boolean))))
      );
    });
  }, [
    all,
    allNative,
    filters,
    journal.id,
    settings.timezone,
    lab.source,
    unsupportedClassicFilter,
  ]);
  const request = useMemo(
    () => ({ observations: selected, settings: lab, timezone: settings.timezone }),
    [selected, lab, settings.timezone],
  );
  const busy = busyRequest === request;
  const report = reportState?.request === request ? reportState.result : undefined;
  const mc = simulation?.request === request ? simulation.result : undefined;
  useEffect(() => {
    let active = true;
    let worker: Worker | undefined;
    void (async () => {
      try {
        const key = 'capital-v2:' + (await sha256(canonical(request))),
          cached = await readCalculation(key);
        if (!active) return;
        if (cached) {
          setReportState({ request, result: cached as CapitalReport });
          return;
        }
        worker = new Worker(new URL('../app/capital.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (e) => {
          if (!active) return;
          if (e.data.ok) {
            setReportState({ request, result: e.data.result });
            void cacheCalculation(key, e.data.result);
          } else setError(e.data.error);
        };
        worker.onerror = () => {
          if (active) setError('Không tải được bộ tính quản trị vốn. Hãy tải lại trang.');
        };
        worker.postMessage({ kind: 'report', ...request });
      } catch (e) {
        if (active) setError(String(e));
      }
    })();
    return () => {
      active = false;
      worker?.terminate();
    };
  }, [request]);
  useEffect(() => {
    simulationWorker.current?.terminate();
    return () => simulationWorker.current?.terminate();
  }, [request]);
  const run = () => {
    simulationWorker.current?.terminate();
    setError('');
    setBusyRequest(request);
    const worker = new Worker(new URL('../app/capital.worker.ts', import.meta.url), {
      type: 'module',
    });
    simulationWorker.current = worker;
    worker.onmessage = (e) => {
      setBusyRequest(undefined);
      if (e.data.ok) setSimulation({ request, result: e.data.result });
      else setError(e.data.error);
      worker.terminate();
    };
    worker.onerror = () => {
      setBusyRequest(undefined);
      setError('Mô phỏng chưa hoàn tất; nhật ký không bị thay đổi.');
    };
    worker.postMessage({ kind: 'simulation', ...request });
  };
  const update = <K extends keyof CapitalLab>(key: K, value: CapitalLab[K]) => {
    setError('');
    setLab((s) => ({ ...s, [key]: value }));
  };
  const field = (
    key: keyof CapitalLab,
    label: string,
    min: number,
    max: number,
    stepValue: number = 1,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={stepValue}
        value={Number(lab[key])}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) update(key, v as never);
        }}
      />
    </label>
  );
  const unit = lab.source === 'classic' ? 'VND' : journal.currency;
  const money = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : num(n, unit === 'VND' ? 0 : 2) + ' ' + unit;
  const enough = (report?.n ?? 0) >= journal.settings.minSample;
  const candidate = report?.groups.find((g) => g.setup === lab.candidateSetup && g.setup);
  const defensiveEligible =
    account.tier !== 'defensive' ||
    (!!candidate &&
      candidate.n >= journal.settings.minSample &&
      candidate.mean > 0 &&
      (candidate.omegaZero ?? 0) > 1);
  const eligible =
    !!report &&
    report.mean !== null &&
    report.mean > 0 &&
    enough &&
    defensiveEligible &&
    lab.model === 'empirical' &&
    !incompleteOpen;
  const dailySlice = Math.max(0, (account.remaining - account.exposure) / lab.lossBuffer);
  const ceiling = Math.min(account.ceiling, dailySlice);
  const suggested = eligible ? Math.min(ceiling, account.equity * report!.kelly.rck) : 0;
  const sizing = positionSize(
    suggested,
    Number(entry),
    Number(stop),
    Number(multiplier),
    Number(fee),
    Number(step),
  );
  const modelKelly =
    lab.model === 'binary'
      ? solveKelly(
          probabilityBox(
            [
              { r: lab.payoff, p: lab.winRate },
              { r: -1, p: 1 - lab.winRate },
            ],
            lab.probabilityBox,
          ),
          lab.alpha,
          lab.beta,
        )
      : report?.kelly;
  const tierNames: Record<string, string> = {
    normal: 'Bình thường',
    defensive: 'Phòng thủ · giảm 50% quy mô',
    stop: 'Dừng lập kế hoạch mới',
    unknown: 'Chưa đủ dữ liệu vốn',
  };
  const last15 = all
    .slice()
    .sort((a, b) => b.closeTime.localeCompare(a.closeTime))
    .slice(0, 15);
  const renderSizer = () => (
    <section className="capital-card">
      <h3>Định cỡ từ trần bảo vệ</h3>
      <p>
        Không tự đổi điểm dừng lỗ để ép vừa ngân sách. Khối lượng luôn làm tròn xuống theo bước.
      </p>
      <div className="capital-fields">
        <label>
          Giá vào dự kiến
          <input
            type="number"
            min="0"
            step="any"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </label>
        <label>
          Giá dừng lỗ dự kiến
          <input
            type="number"
            min="0"
            step="any"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </label>
        <label>
          Giá trị mỗi điểm / đơn vị ({unit})
          <input
            type="number"
            min="0"
            step="any"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
          />
        </label>
        <label>
          Bước lot / hợp đồng
          <input
            type="number"
            min="0"
            step="any"
            value={step}
            onChange={(e) => setStep(e.target.value)}
          />
        </label>
        <label>
          Phí dự kiến mỗi đơn vị ({unit})
          <input
            type="number"
            min="0"
            step="any"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>
      </div>
      <p className="capital-result">
        Khối lượng: <b>{sizing ? num(sizing.quantity, 8) : '—'}</b> · Rủi ro dự kiến{' '}
        {money(sizing?.actualRisk)}
      </p>
      <a href="/classic#risk">Mở checklist và công cụ vận hành Classic ↗</a>
    </section>
  );
  return (
    <section className="capital-pro" aria-label="Quản trị vốn Pro">
      <header className="capital-intro">
        <div>
          <span className="capital-eyebrow">RISK MANAGEMENT PRO · V6</span>
          <h2>Bảo vệ vốn trước, tối ưu sau</h2>
          <p>
            Ba lớp dùng cùng một nguồn dữ liệu. Giới hạn tài khoản luôn được tính trên toàn sổ, độc
            lập bộ lọc.
          </p>
        </div>
        <button
          onClick={() => {
            setCapitalDraft(journal.startingBalance ?? '');
            setPolicyDraft(capitalPolicySchema.parse(journal.settings.capitalPolicy ?? {}));
            setSettingsOpen(true);
          }}
        >
          Hồ sơ vốn & quy tắc
        </button>
      </header>
      <div className="capital-source">
        <label>
          Nguồn quản trị vốn
          <select
            value={lab.source}
            onChange={(e) => update('source', e.target.value as CapitalLab['source'])}
          >
            <option value="v6">Sổ V6 hiện tại</option>
            <option value="classic">Sổ chung với Classic</option>
          </select>
        </label>
        <div>
          <b>
            {lab.source === 'classic' ? (classic?.source ?? 'Đang đọc Classic…') : journal.name}
          </b>
          <p>
            {all.length} lệnh toàn sổ · {selected.length} trong phạm vi phân tích ·{' '}
            {report?.n ?? '…'} đủ Net và 1R{' '}
            {journal.isDemo && lab.source === 'v6' ? '· DỮ LIỆU MINH HỌA' : ''}
          </p>
        </div>
        <a href="/classic#journal">Nhập và sửa dữ liệu tại Classic ↗</a>
      </div>
      {(sourceError || error) && <p role="alert">{sourceError || error}</p>}
      {unsupportedClassicFilter && (
        <p className="capital-note">
          Nguồn Classic chưa ánh xạ nhãn, review và lỗi sang danh mục V6. Xóa các điều kiện này để
          phân tích; chưa tính mẫu hoặc gợi ý từ một bộ lọc bị bỏ qua.
        </p>
      )}
      <section
        className={'capital-survival tier-' + account.tier}
        aria-label="Trạng thái bảo vệ toàn tài khoản"
      >
        <div>
          <span>LỚP 1 · QUYỀN ƯU TIÊN</span>
          <h3>{tierNames[account.tier]}</h3>
          <p>
            {account.closedOnly
              ? 'Theo tiền đã hiện thực hóa; chưa có lãi/lỗ thả nổi.'
              : 'Có số lãi/lỗ thả nổi đã nhập.'}{' '}
            {incompleteOpen ? 'Lệnh mở thiếu rủi ro: chặn đề xuất tăng vốn.' : ''}
          </p>
        </div>
        <div>
          <span>Sụt giảm hiện tại</span>
          <strong>{account.ddPercent === null ? '—' : num(account.ddPercent) + '%'}</strong>
          <small>
            Phòng thủ {settings.defensivePercent}% · Dừng {settings.stopPercent}%
          </small>
        </div>
        <div>
          <span>Ngân sách ngày còn lại</span>
          <strong>{money(account.missingCapital ? null : account.remaining)}</strong>
          <progress
            max="100"
            value={Math.min(100, account.usage ?? 0)}
            aria-label="Ngân sách lỗ ngày đã dùng"
          />
          <small>
            {account.today} · đã dùng {money(account.used)}
          </small>
        </div>
        <div>
          <span>Trần cho một lệnh mới</span>
          <strong>{money(incompleteOpen ? 0 : ceiling)}</strong>
          <small>Đã trừ rủi ro mở {money(account.exposure)}</small>
        </div>
      </section>
      <nav className="capital-tabs" aria-label="Ba lớp quản trị vốn">
        {tabs.map(([id, name]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </nav>
      {!report && <p role="status">Đang phân tích dữ liệu trong bộ tính riêng…</p>}
      {tab === 'overview' && (
        <>
          <div className="capital-layers">
            {[
              ['01', 'Bảo vệ vốn', 'Drawdown · ngân sách ngày · phơi nhiễm', 'protect'],
              ['02', 'Đánh giá chiến lược', 'Omega · ES · kỳ vọng · chất lượng mẫu', 'evaluate'],
              ['03', 'Tối ưu vốn', 'Kelly có ràng buộc · quy mô cuối cùng', 'optimize'],
            ].map(([number, title, text, id]) => (
              <button key={number} onClick={() => setTab(id as Tab)}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <small>
                  {number === '01'
                    ? 'Quyền phủ quyết'
                    : number === '02'
                      ? 'Đánh giá, không chứng minh an toàn'
                      : 'Chỉ hoạt động khi lớp 1 cho phép'}{' '}
                  →
                </small>
              </button>
            ))}
          </div>
          <div className="capital-grid">
            <section className="capital-card">
              <h3>Điều gì quyết định quy mô?</h3>
              <ol>
                <li>Đủ dữ liệu vốn, Net sau phí và rủi ro ban đầu.</li>
                <li>Tài khoản chưa chạm sàn hoặc hết ngân sách ngày.</li>
                <li>Mẫu có kỳ vọng dương và đủ số quan sát.</li>
                <li>Lấy mức nhỏ nhất giữa nghiệm RCK và các trần lớp 1.</li>
              </ol>
              <p className="capital-result">
                Đề xuất theo mô hình: <b>{money(suggested)}</b> / lệnh
              </p>
              <p>
                {!eligible
                  ? 'Chưa đủ điều kiện dùng nghiệm tối ưu cho quy mô lệnh.'
                  : 'Dựa trên mẫu lịch sử; không phải cam kết về kết quả tương lai.'}
              </p>
            </section>
            <section className="capital-card">
              <h3>Dữ liệu và phạm vi</h3>
              <p>
                Thiếu Net/phí hoặc 1R: {report?.excluded ?? '…'} lệnh bị loại khỏi mẫu R; bản gốc
                vẫn giữ nguyên.
              </p>
              <p>
                Biểu đồ và mô phỏng chịu tác động bộ lọc. Dải bảo vệ phía trên dùng toàn tài khoản.
              </p>
              <p>Không sử dụng các số xác suất, vốn hoặc ROI cố định trong mẫu HTML.</p>
              <button onClick={() => setTab('stress')}>Mở phòng mô phỏng →</button>
            </section>
          </div>
        </>
      )}
      {tab === 'protect' && (
        <>
          <div className="capital-metrics">
            <Metric
              label="Vốn theo sổ"
              value={account.missingCapital ? 'Chưa thiết lập' : money(account.equity)}
              sub="Đã tính nạp/rút, tách khỏi P&L"
            />
            <Metric
              label="Sàn vốn"
              value={account.missingCapital ? '—' : money(account.floor)}
              sub={settings.floorMode === 'static' ? 'Sàn cố định' : 'Trượt theo đỉnh vốn'}
            />
            <Metric
              label="Lãi cần để hồi về đỉnh"
              value={pct(account.recovery)}
              sub="DD / (1 − DD), không phải dự báo thời gian"
            />
            <Metric
              label="Số lệnh thua cần đệm"
              value={String(lab.lossBuffer)}
              sub="Chia phần ngân sách ngày còn lại"
            />
          </div>
          <div className="capital-grid">
            <section className="capital-card">
              <h3>Toán học phục hồi</h3>
              <CapitalLines
                title="Sụt giảm và mức lãi cần phục hồi (%)"
                unit="% DD"
                series={[
                  {
                    name: 'Lãi cần phục hồi',
                    values: Array.from(
                      { length: 19 },
                      (_, i) => (100 * ((i * 5) / 100)) / (1 - (i * 5) / 100),
                    ),
                    color: '#2563eb',
                  },
                ]}
              />
              <p>
                DD 20% cần lãi 25%; DD 50% cần lãi 100%. Không áp dụng khi tài khoản đã hết vốn.
              </p>
              {field('lossBuffer', 'Số lệnh thua cần đệm trong ngày', 1, 100)}
            </section>
            <section className="capital-card">
              <h3>Chẩn đoán 15 lệnh gần nhất</h3>
              <p>Luôn lấy toàn sổ, không thu hẹp theo bộ lọc chiến lược.</p>
              <div
                className="capital-table"
                tabIndex={0}
                role="region"
                aria-label="Mười lăm lệnh gần nhất"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Ngày / mã</th>
                      <th>Phương pháp</th>
                      <th>Net</th>
                      <th>R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {last15.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {o.exitDate ?? o.closeTime.slice(0, 10)}
                          <br />
                          {lab.source === 'v6' ? (
                            <button onClick={() => onOpen(o.id)}>{o.symbol}</button>
                          ) : (
                            o.symbol
                          )}
                        </td>
                        <td>{data.setups.find((s) => s.id === o.setup)?.name ?? o.setup ?? '—'}</td>
                        <td>{money(o.net === null ? null : Number(o.net))}</td>
                        <td>
                          {o.net !== null && o.risk !== null
                            ? num(Number(o.net) / Number(o.risk))
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <Help title="Nguyên tắc bảo vệ">
            <p>
              Giới hạn ngày dùng ngày theo múi giờ tài khoản; nạp/rút không tạo lợi nhuận. Trần lệnh
              mới là min(rủi ro theo tầng, dư ngày − phơi nhiễm, khoảng cách sàn − phơi nhiễm, dư
              ngày / số lệnh đệm). Thiếu vốn hoặc dữ liệu tài chính sẽ trả trần 0.
            </p>
          </Help>
        </>
      )}
      {tab === 'evaluate' && report && (
        <>
          <div className="capital-metrics">
            <Metric
              label={'Omega tại L = ' + num(lab.omegaThreshold) + 'R'}
              value={num(report.omega)}
              sub={report.n + ' lệnh đủ dữ liệu'}
            />
            <Metric
              label="ES 97,5% / lệnh"
              value={num(report.tail?.es) + ' R'}
              sub={'Khối lượng đuôi ' + num(report.tail?.tailMass) + ' quan sát'}
            />
            <Metric
              label="VaR 97,5% / 99%"
              value={num(report.tail?.var) + ' / ' + num(report.var99?.var) + ' R'}
              sub="Quy ước lỗ dương; giá trị âm là lãi"
            />
            <Metric
              label="Kỳ vọng / lệnh"
              value={num(report.mean) + ' R'}
              sub={'Sharpe ' + num(report.stats.sharpe) + ' · Sortino ' + num(report.stats.sortino)}
            />
          </div>
          {report.n < 40 && (
            <p className="capital-note">
              Mẫu nhỏ: ES 97,5% hiện dựa trên chưa tới một quan sát đuôi hiệu dụng. Không đủ để
              khẳng định rủi ro tương lai.
            </p>
          )}
          <div className="capital-grid">
            <section className="capital-card">
              <h3>Đường cong Omega</h3>
              {field('omegaThreshold', 'Ngưỡng mục tiêu L (R)', -100, 100, 0.1)}
              <CapitalLines
                title="Omega theo ngưỡng mục tiêu L"
                unit="L từ P10 đến P90 (R)"
                series={[
                  {
                    name: 'Omega',
                    values: report.curve.map((x) => (x.omega === Infinity ? null : x.omega)),
                    color: '#2563eb',
                  },
                ]}
              />
              <p>Omega(L) = Σmax(R−L,0) / Σmax(L−R,0). Net đã trừ phí, không trừ thêm lần nữa.</p>
            </section>
            <section className="capital-card">
              <h3>Rủi ro đuôi và kiểm định</h3>
              <p>
                Profit Factor(R): <b>{report.stats.noLoss ? '∞' : num(report.stats.pf)}</b> · SQN:{' '}
                <b>{num(report.stats.sqn)}</b>
              </p>
              <p>
                Cửa sổ căng thẳng:{' '}
                {report.worstWindow
                  ? report.worstWindow.from.slice(0, 10) +
                    ' → ' +
                    report.worstWindow.to.slice(0, 10)
                  : '—'}
                ; ES {num(report.worstWindow?.es)}R.
              </p>
              <p>
                Kiểm định theo thời gian, dùng tối đa 100 lệnh trước mỗi lệnh:{' '}
                {report.backtest.n
                  ? `${report.backtest.breaches975}/${report.backtest.n} vượt VaR 97,5%; ${report.backtest.breaches99}/${report.backtest.n} vượt VaR 99%.`
                  : 'Chưa đủ 40 lệnh quá khứ để bắt đầu.'}
              </p>
              {field('liquidityDays', 'Kỳ hạn thanh khoản giả định (ngày)', 10, 120)}
              <p>
                ES nhân √(ngày/10): <b>{num(report.stressedEs)}R</b>. Đây là phân tích nhạy cảm,
                không phải phép tính vốn FRTB.
              </p>
            </section>
          </div>
          <section className="capital-card">
            <h3>So sánh theo phương pháp</h3>
            <div
              className="capital-table"
              tabIndex={0}
              role="region"
              aria-label="Thống kê theo phương pháp"
            >
              <table>
                <thead>
                  <tr>
                    <th>Phương pháp</th>
                    <th>N</th>
                    <th>E(R)</th>
                    <th>Omega(L)</th>
                    <th>ES(R)</th>
                    <th>ES − VaR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups.map((g) => (
                    <tr key={g.setup}>
                      <td>
                        {data.setups.find((s) => s.id === g.setup)?.name ??
                          g.setup ??
                          'Chưa phân loại'}
                      </td>
                      <td>{g.n}</td>
                      <td>{num(g.mean)}</td>
                      <td>{num(g.omega)}</td>
                      <td>{num(g.es)}</td>
                      <td>{num(g.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="capital-grid">
            <section className="capital-card">
              <h3>Rủi ro theo ngày giao dịch</h3>
              <p>
                ES 97,5%: <b>{money(report.dailyTail?.es)}</b> · VaR 97,5%:{' '}
                <b>{money(report.dailyTail?.var)}</b>.
              </p>
              <p>
                {report.dailyTail?.n ?? 0} ngày có giao dịch đủ Net, theo múi giờ{' '}
                {settings.timezone}; loại {report.excludedDays} ngày thiếu phí/Net. Không tự thêm
                ngày nghỉ hoặc cộng R để giả làm tỷ suất ngày.
              </p>
              {(report.dailyTail?.n ?? 0) < 40 && (
                <p className="capital-note">Mẫu ngày nhỏ; đuôi 2,5% chưa đủ một ngày hiệu dụng.</p>
              )}
            </section>
            <section className="capital-card">
              <h3>R:R kế hoạch và R thực nhận</h3>
              <p>
                {report.planned.length}/{report.n} lệnh có giá vào, SL và TP hợp lệ. Lệnh di trú với
                giá tổng hợp không dùng để suy đoán kế hoạch.
              </p>
              <CapitalLines
                title="Kế hoạch và kết quả thực tế"
                unit="R theo lệnh có kế hoạch"
                series={[
                  {
                    name: 'R:R kế hoạch',
                    values: report.planned.map((p) => p.planned),
                    color: '#2563eb',
                  },
                  {
                    name: 'R Net thực nhận',
                    values: report.planned.map((p) => p.actual),
                    color: '#d97706',
                  },
                ]}
              />
            </section>
          </div>
          <Help title="ES, VaR và giới hạn">
            <p>
              VaR là phân vị thực nghiệm của loss = −R. ES lấy đúng 2,5% khối lượng đuôi xấu nhất,
              chia trọng số ở quan sát biên. Đây là thống kê theo lệnh, không phải ES ngày hoặc
              chứng nhận Basel/FRTB. Cửa sổ căng thẳng chọn tối đa 30 lệnh có sụt giảm tích lũy R
              lớn nhất.
            </p>
          </Help>
        </>
      )}
      {tab === 'optimize' && report && (
        <>
          <div className="capital-grid">
            <section className="capital-card">
              <h3>Bộ giải Kelly có ràng buộc</h3>
              {account.tier === 'defensive' && (
                <label>
                  Phương pháp dự kiến trong tầng phòng thủ
                  <select
                    value={lab.candidateSetup}
                    onChange={(e) => update('candidateSetup', e.target.value)}
                  >
                    <option value="">Chọn phương pháp đủ mẫu và kỳ vọng dương</option>
                    {report.groups
                      .filter((g) => g.setup)
                      .map((g) => (
                        <option key={g.setup} value={g.setup}>
                          {data.setups.find((s) => s.id === g.setup)?.name ?? g.setup} · N={g.n}
                        </option>
                      ))}
                  </select>
                  <p className="capital-note">
                    Tầng phòng thủ giảm 50% trần và chỉ cho gợi ý khi phương pháp đã chọn đủ mẫu,
                    E(R) &gt; 0 và Omega(0) &gt; 1.
                  </p>
                </label>
              )}
              <div className="capital-fields">
                <label>
                  Mô hình đầu vào
                  <select
                    value={lab.model}
                    onChange={(e) => update('model', e.target.value as CapitalLab['model'])}
                  >
                    <option value="empirical">Phân phối R thực nghiệm</option>
                    <option value="binary">Hai kết quả · GIẢ ĐỊNH</option>
                  </select>
                </label>
                {field('alpha', 'Đáy vốn α so với vốn bắt đầu', 0.01, 0.99, 0.01)}
                {field('beta', 'Xác suất tối đa β trong mô hình', 0.0001, 0.99, 0.001)}
                {field('probabilityBox', 'Biên bất định xác suất tương đối', 0, 0.95, 0.05)}
              </div>
              {lab.model === 'binary' && (
                <div className="capital-fields">
                  {field('winRate', 'Xác suất thắng giả định', 0.001, 0.999, 0.01)}
                  {field('payoff', 'Lãi trên một đơn vị lỗ giả định', 0.1, 20, 0.1)}
                </div>
              )}
              <div className="capital-metrics">
                <Metric label="Full Kelly" value={pct(modelKelly?.full)} />
                <Metric label="Half Kelly" value={pct(modelKelly?.half)} />
                <Metric label="Quarter Kelly" value={pct(modelKelly?.quarter)} />
                <Metric
                  label="Risk-constrained Kelly"
                  value={pct(modelKelly?.rck)}
                  sub={'λ = ' + num(modelKelly?.lambda)}
                />
              </div>
              <p className="capital-result">
                Quy mô sau khóa liên tầng: <b>{money(suggested)}</b> / lệnh
              </p>
              <p>
                {!enough ? 'Mẫu chưa đủ ngưỡng của sổ. ' : ''}
                {lab.model === 'binary'
                  ? 'Đầu vào giả định không được dùng thành khuyến nghị vốn thực. '
                  : ''}
                Lớp 1 có thể đưa kết quả về 0 dù Kelly dương.
              </p>
              <Help title="RCK không phải bảo đảm MDD">
                <p>
                  Tối đa hóa Σp log(1+fR), với Σp(1+fR)^−λ ≤ 1 và λ = ln(β)/ln(α). Giới hạn nói về
                  vốn thấp hơn α lần vốn bắt đầu, không phải sụt giảm từ đỉnh chạy. Giả định IID và
                  phân phối đầu vào đúng; gap có thể vượt 1R. Biên xác suất là mô hình một tỷ lệ
                  chung, không phải tối ưu danh mục nhiều tài sản.
                </p>
              </Help>
            </section>
            {renderSizer()}
          </div>
        </>
      )}
      {tab === 'stress' && (
        <>
          <section className="capital-card">
            <h3>Phòng mô phỏng · không thay đổi nhật ký</h3>
            <p>
              Mỗi đường là kịch bản giả định lấy mẫu có hoàn lại hoặc hai kết quả. Quy mô dưới đây
              là giả định riêng, không sửa trần vốn thực.
            </p>
            <div className="capital-fields">
              <label>
                Nguồn mô phỏng
                <select
                  value={lab.model}
                  onChange={(e) => update('model', e.target.value as CapitalLab['model'])}
                >
                  <option value="empirical">Bootstrap R lịch sử đủ dữ liệu</option>
                  <option value="binary">Mô hình hai kết quả giả định</option>
                </select>
              </label>
              <label>
                Số đường chạy
                <select
                  value={lab.paths}
                  onChange={(e) => update('paths', Number(e.target.value) as 1000 | 10000)}
                >
                  <option value="1000">1.000 đường</option>
                  <option value="10000">10.000 đường</option>
                </select>
              </label>
              {field('steps', 'Số lệnh mỗi đường', 20, 1000)}
              {field('capital', 'Vốn mô phỏng (' + unit + ')', 1, 1e15)}
              {field('riskPercent', 'Rủi ro mô phỏng mỗi lệnh (%)', 0, 25, 0.1)}
              {field('seed', 'Seed tái lập', 0, 2147483647)}
              {field('losingStreak', 'Số lệnh thua liên tiếp bơm vào', 0, 100)}
              {field('tailFactor', 'Hệ số tổn thất ở đuôi', 1, 10, 0.1)}
              {field('extraCostR', 'Chi phí phát sinh thêm (R)', 0, 10, 0.01)}
              {field('tradesPerDay', 'Số lệnh mô phỏng mỗi ngày', 1, 100)}
              {field('alpha', 'Ngưỡng đáy vốn / vốn đầu', 0.01, 0.99, 0.01)}
              {lab.model === 'binary' && (
                <>
                  {field('winRate', 'Xác suất thắng giả định', 0.001, 0.999, 0.01)}
                  {field('payoff', 'Payoff giả định', 0.1, 20, 0.1)}
                </>
              )}
            </div>
            <details>
              <summary>Quy tắc mô hình quỹ và một kỳ chi trả</summary>
              <p>
                Cấu hình tùy tài khoản, không gắn tên quỹ hay tự nhận đây là quy tắc hiện hành. Kiểm
                tra vi phạm ở từng lệnh đóng, chưa mô hình hóa lỗ trong lúc giữ vị thế.
              </p>
              <div className="capital-fields">
                {field('dailyLimit', 'Giới hạn lỗ ngày mô phỏng (%)', 0.1, 50, 0.1)}
                {field('totalLimit', 'Giới hạn lỗ tổng mô phỏng (%)', 0.1, 90, 0.1)}
                {field('targetPercent', 'Mục tiêu vượt thử thách (%)', 0.1, 100, 0.1)}
                {field('minDays', 'Số ngày tối thiểu', 0, 100)}
                <label>
                  Sàn mô hình quỹ
                  <select
                    value={lab.floorMode}
                    onChange={(e) => update('floorMode', e.target.value as CapitalLab['floorMode'])}
                  >
                    <option value="static">Static theo vốn đầu</option>
                    <option value="trailing">Trailing theo số tiền</option>
                    <option value="trailing-locked">Trailing và khóa tại vốn đầu</option>
                  </select>
                </label>
                {field('challengeFee', 'Phí thử thách (' + unit + ')', 0, 1e9)}
                {field('split', 'Tỷ lệ chia lợi nhuận (%)', 0, 100)}
                {field('payoutDays', 'Số ngày một kỳ thanh toán giả định', 1, 100)}
              </div>
            </details>
            <div className="actions">
              <button
                className="primary"
                disabled={busy || (lab.model === 'empirical' && !report?.n)}
                onClick={run}
              >
                {busy ? 'Đang mô phỏng…' : 'Chạy ' + num(lab.paths, 0) + ' đường mô phỏng'}
              </button>
              {busy && (
                <button
                  onClick={() => {
                    simulationWorker.current?.terminate();
                    setBusyRequest(undefined);
                  }}
                >
                  Dừng mô phỏng
                </button>
              )}
              <button
                disabled={!mc}
                onClick={() => {
                  if (!mc) return;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(
                    new Blob(
                      [
                        JSON.stringify(
                          {
                            format: 'tuan-capital-simulation',
                            version: 1,
                            at: new Date().toISOString(),
                            journalId: journal.id,
                            source: lab.source,
                            sample: report?.n,
                            result: mc,
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: 'application/json' },
                    ),
                  );
                  a.download = 'quan-tri-von-mo-phong.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                }}
              >
                Tải kết quả và cấu hình
              </button>
            </div>
          </section>
          {mc && (
            <>
              <p role="status" className="capital-note">
                GIẢ ĐỊNH · seed {mc.config.seed} · {num(mc.config.paths, 0)} đường ×{' '}
                {mc.config.steps} lệnh · bơm đúng {mc.injected} lệnh thua/đường ·{' '}
                {num(mc.elapsedMs, 0)} ms
              </p>
              <div className="capital-metrics">
                <Metric label="Vốn cuối kỳ trung vị" value={money(mc.median)} />
                <Metric label="MDD P95 (đuôi xấu)" value={pct(mc.mddP95)} />
                <Metric
                  label="Chạm đáy α lần vốn đầu"
                  value={pct(mc.ruin.rate)}
                  sub={'Khoảng Wilson 95%: ' + pct(mc.ruin.low) + '–' + pct(mc.ruin.high)}
                />
                <Metric label="Vượt giới hạn MDD" value={pct(mc.ddBreach.rate)} />
              </div>
              <section className="capital-card">
                <CapitalFan simulation={mc} unit={unit} />
                <p>
                  Dải vốn phía trên tiếp tục chạy để đo MDD. Quy tắc dừng quỹ chỉ áp dụng trong phần
                  thử thách bên dưới.
                </p>
              </section>
              <div className="capital-grid">
                <section className="capital-card">
                  <h3>Kết quả mô hình quỹ</h3>
                  <p>
                    Vượt thử thách: <b>{pct(mc.prop.passRate)}</b> · Vi phạm: {mc.prop.failed} · Hết
                    thời gian: {mc.prop.timeouts}.
                  </p>
                  <p>Không trả về hợp lệ trong kỳ hậu thử thách: {mc.prop.payoutFailed} đường.</p>
                  <p>
                    Take-home trung vị trên tất cả lần thi: <b>{money(mc.prop.takeHome)}</b>. ROI
                    sau phí thi:{' '}
                    <b>{mc.prop.roi === null ? 'Cần nhập phí' : num(mc.prop.roi) + '%'}</b>.
                  </p>
                  <p>
                    Số kỳ bù phí (dựa trên trung vị kỳ trả dương): {mc.prop.breakEvenCycles ?? '—'}.
                    Đây là mô hình một thử thách và một kỳ hậu thử thách, không phải dòng tiền được
                    bảo đảm.
                  </p>
                </section>
                <section className="capital-card">
                  <h3>Đối chiếu Risk of Ruin</h3>
                  <p>Ruin hữu hạn trong mô phỏng là chạm α × vốn đầu, khác MDD từ đỉnh.</p>
                  <p>
                    Mô hình đặc biệt cố định +b/−1:{' '}
                    {lab.model === 'binary' && lab.riskPercent > 0
                      ? pct(
                          fixedStakeRuin(
                            lab.winRate,
                            lab.payoff,
                            lab.riskPercent > 0
                              ? Math.floor((1 - lab.alpha) / (lab.riskPercent / 100))
                              : 0,
                          ),
                        )
                      : 'Chỉ áp dụng khi chọn hai kết quả với payoff nguyên.'}
                  </p>
                  <p>
                    Không thay payoff bất đối xứng vào công thức bước ±1. 0 lần chạm sàn không có
                    nghĩa rủi ro thật bằng 0.
                  </p>
                </section>
              </div>
              <section className="capital-card">
                <h3>Bản đồ chạm sàn quanh cấu hình</h3>
                <p>
                  Mỗi ô chạy 400 đường hai kết quả, tối đa 250 lệnh, cùng seed, cùng tỷ lệ rủi ro và
                  đáy α. Đây là khảo sát tham số, không phải mẫu lịch sử.
                </p>
                <div className="capital-heatmap">
                  {mc.heatmap.map((h, i) => (
                    <div key={i} className={h.rate >= 0.1 ? 'hot' : h.rate >= 0.03 ? 'warm' : ''}>
                      <small>
                        W {num(h.p * 100, 0)}% · b {num(h.b)}
                      </small>
                      <b>{pct(h.rate)}</b>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {!mc && !busy && (
            <p>
              Chưa có kết quả cho cấu hình hiện tại. Chạy mô phỏng để tính; không hiển thị số mẫu cố
              định.
            </p>
          )}
        </>
      )}
      <footer className="capital-methods">
        Phương pháp:{' '}
        <a
          href="https://web.stanford.edu/~boyd/papers/pdf/kelly.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Busseti–Ryu–Boyd RCK
        </a>{' '}
        ·{' '}
        <a
          href="https://people.duke.edu/~charvey/Teaching/BA453_2004/Keating_A_universal_performance.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Keating–Shadwick Omega
        </a>
        . Mẫu lịch sử và mô phỏng không bảo đảm kết quả tương lai.
      </footer>
      {settingsOpen && (
        <Modal label="capital-settings-title" onClose={() => setSettingsOpen(false)}>
          <h2 id="capital-settings-title">Hồ sơ vốn & quy tắc</h2>
          {lab.source === 'classic' ? (
            <SharedCapital
              currency="VND"
              onReference={(capital) => update('capital', Math.max(1, capital))}
              onSaved={() => setRefresh((n) => n + 1)}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const policy = capitalPolicySchema.parse(policyDraft);
                  if (!Number.isFinite(Number(capitalDraft)) || Number(capitalDraft) <= 0)
                    throw Error('Nhập vốn đầu kỳ thực lớn hơn 0.');
                  void mutate(
                    (s) => ({
                      ...s,
                      journals: s.journals.map((j) =>
                        j.id === journal.id
                          ? {
                              ...j,
                              startingBalance: capitalDraft,
                              settings: { ...j.settings, capitalPolicy: policy },
                            }
                          : j,
                      ),
                    }),
                    revision,
                  )
                    .then(() => {
                      setSettingsOpen(false);
                      setError('');
                    })
                    .catch((e) => setError(String(e)));
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              <p>
                Áp dụng riêng sổ V6 {journal.name}, đơn vị {journal.currency}. Không sửa vốn Classic
                hoặc tự đổi tỷ giá.
              </p>
              <div className="capital-fields">
                <label>
                  Vốn đầu kỳ thực ({journal.currency})
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={capitalDraft}
                    onChange={(e) => setCapitalDraft(e.target.value)}
                  />
                </label>
                {(
                  [
                    'riskPercent',
                    'dailyLossPercent',
                    'defensivePercent',
                    'stopPercent',
                    'maxDrawdownPercent',
                  ] as const
                ).map((k, i) => (
                  <label key={k}>
                    {
                      [
                        'Rủi ro mỗi lệnh (%)',
                        'Giới hạn lỗ ngày (%)',
                        'Ngưỡng phòng thủ (%)',
                        'Ngưỡng dừng (%)',
                        'Giới hạn sụt giảm tối đa (%)',
                      ][i]
                    }
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={policyDraft[k]}
                      onChange={(e) =>
                        setPolicyDraft((s) => ({ ...s, [k]: Number(e.target.value) }))
                      }
                    />
                  </label>
                ))}
                <label>
                  Kiểu sàn vốn
                  <select
                    value={policyDraft.floorMode}
                    onChange={(e) =>
                      setPolicyDraft((s) => ({
                        ...s,
                        floorMode: e.target.value as 'static' | 'trailing',
                      }))
                    }
                  >
                    <option value="static">Static</option>
                    <option value="trailing">Trailing</option>
                  </select>
                </label>
              </div>
              <label className="capital-check">
                <input
                  type="checkbox"
                  checked={policyDraft.disciplineLock}
                  onChange={(e) =>
                    setPolicyDraft((s) => ({ ...s, disciplineLock: e.target.checked }))
                  }
                />
                Khóa chủ động kế hoạch lệnh mới
              </label>
              <button className="primary">Lưu hồ sơ vốn thực</button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </section>
  );
}
