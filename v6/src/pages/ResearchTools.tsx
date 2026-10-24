import { useRef, useState, useEffect } from 'react';
import type { Journal, Trade } from '../data/schema';
import type { analyze } from '../core/analyze';
import type { Dimension, monteCarlo, researchBundle } from '../core/advanced';
import { formatValue } from '../ui/format';
import { exportReport, printReport } from '../data/staticReport';
import type { Scope } from '../core/analyze';
import { LinePlot } from '../ui/LinePlot';
import { useLedger } from '../app/LedgerContext';
export function ResearchTools({
  journal,
  trades,
  scope,
  base,
}: {
  journal: Journal;
  trades: Trade[];
  scope: Scope;
  base?: ReturnType<typeof analyze>;
}) {
  const [first, setFirst] = useState<Dimension>('symbol'),
    [second, setSecond] = useState<Dimension>('side'),
    [third, setThird] = useState<Dimension | ''>(''),
    [question, setQuestion] = useState<'missing' | 'loss' | 'review'>('missing');
  const { data, revision } = useLedger();
  const [seed, setSeed] = useState('2103'),
    [steps, setSteps] = useState('100'),
    [milestone, setMilestone] = useState('10'),
    [simulation, setSimulation] = useState<ReturnType<typeof monteCarlo>>(),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const worker = useRef<Worker>();
  const [mcMode, setMCMode] = useState<'fixedR' | 'percent'>('fixedR'),
    [riskPercent, setRiskPercent] = useState('1'),
    [ruin, setRuin] = useState('20');
  const [simulationKey, setSimulationKey] = useState('');
  useEffect(() => () => worker.current?.terminate(), []);
  const requestKey =
    journal.id +
    '|' +
    revision +
    '|' +
    JSON.stringify(scope) +
    '|' +
    first +
    '|' +
    second +
    '|' +
    question +
    '|' +
    third;
  const simulationRequestKey =
    requestKey + '|' + [seed, steps, milestone, mcMode, riskPercent, ruin].join('|');
  const [analysis, setAnalysis] = useState<{
    key: string;
    value: ReturnType<typeof researchBundle>;
  }>();
  useEffect(() => {
    const w = new Worker(new URL('../app/research.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      if (e.data.ok) setAnalysis({ key: e.data.key, value: e.data.result });
      else setMessage(e.data.error);
    };
    w.onerror = () => setMessage('Không tính được phân tích.');
    w.postMessage({
      key: requestKey,
      journal,
      trades,
      scope,
      dimensions: [first, second, ...(third ? [third] : [])],
      question,
      base,
    });
    return () => w.terminate();
  }, [requestKey, journal, trades, scope, first, second, third, question, base]);
  const bundle = analysis?.key === requestKey ? analysis.value : undefined;
  const curve = bundle?.curve ?? [],
    ma20 = bundle?.ma20 ?? [],
    ma50 = bundle?.ma50 ?? [],
    excluded = bundle?.excluded ?? [],
    scenario = bundle?.scenario ?? { net: null, averageR: null };
  const run = () => {
    worker.current?.terminate();
    const w = new Worker(new URL('../app/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    setPending(true);
    setSimulationKey(simulationRequestKey);
    setSimulation(undefined);
    w.onmessage = (e) => {
      setPending(false);
      if (e.data.ok) setSimulation(e.data.result);
      else setMessage(e.data.error);
      w.terminate();
    };
    w.onerror = () => {
      setPending(false);
      setMessage('Không chạy được mô phỏng.');
      w.terminate();
    };
    w.postMessage({
      values: bundle?.rs ?? [],
      seed: Number(seed),
      steps: Number(steps),
      milestone: Number(milestone),
      options: { mode: mcMode, riskPercent: Number(riskPercent), ruin: Number(ruin) },
    });
  };
  return (
    <section className="panel">
      <h2>Phân tích và giả định</h2>
      {!bundle && <p role="status">Đang phân tích trên thiết bị…</p>}
      <p>
        Phạm vi theo sổ và bộ lọc đang chọn. Mô phỏng và What-if là GIẢ ĐỊNH, không phải dự báo hoặc
        khuyến nghị giao dịch.
      </p>
      <h3>Drill-down đa cấp</h3>
      {[first, second].map((value, i) => (
        <label key={i}>
          Chiều nhóm {i + 1}
          <select
            value={value}
            onChange={(e) => (i === 0 ? setFirst : setSecond)(e.target.value as Dimension)}
          >
            {(
              [
                'symbol',
                'setupId',
                'market',
                'side',
                'entryHour',
                'exitHour',
                'halfHour',
                'tenMinute',
                'entryWeekday',
                'exitWeekday',
                'positionSize',
                'weekday',
                'holding',
                'rBucket',
                'errorTag',
              ] as const
            ).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      ))}
      <label>
        Chiều nhóm 3
        <select value={third} onChange={(e) => setThird(e.target.value as Dimension | '')}>
          <option value="">Không dùng cấp 3</option>
          {(
            [
              'symbol',
              'setupId',
              'market',
              'side',
              'entryHour',
              'exitHour',
              'halfHour',
              'tenMinute',
              'entryWeekday',
              'exitWeekday',
              'positionSize',
              'weekday',
              'holding',
              'rBucket',
              'errorTag',
            ] as const
          ).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          setFirst(second);
          setSecond(first);
        }}
      >
        Đảo cấp nhóm 1 và 2
      </button>
      {bundle && <GroupTree groups={bundle.groups} currency={journal.currency} depth={0} />}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nhóm</th>
              <th>n</th>
              <th>Net</th>
              <th>Winrate · CI 95%</th>
              <th>PF</th>
              <th>Kỳ vọng R · n/N</th>
              <th>Mẫu</th>
              <th>ID bằng chứng</th>
            </tr>
          </thead>
          <tbody>
            {bundle?.groups.map((g) => (
              <tr key={g.key}>
                <td>{g.key}</td>
                <td>{g.tradeIds.length}</td>
                <td>{formatValue(g.metrics.net.value, 'money', journal.currency)}</td>
                <td>
                  {formatValue(g.metrics.winRate.value, 'percent')} ·{' '}
                  {g.summary.winCI?.map((v) => (v * 100).toFixed(1) + '%').join('…') ?? '—'}
                </td>
                <td>{g.summary.profitFactor ?? '—'}</td>
                <td>
                  {formatValue(g.summary.mean, 'R')} · {g.summary.n}/{g.summary.of}
                </td>
                <td>
                  {journal.isDemo
                    ? 'Minh họa'
                    : g.summary.n < journal.settings.minSample
                      ? 'Mẫu nhỏ'
                      : 'Đủ mẫu tối thiểu'}
                </td>
                <td>
                  {g.tradeIds.slice(0, 20).join(', ')}
                  {g.tradeIds.length > 20 && (
                    <>
                      <p>Hiển thị 20/{g.tradeIds.length} ID.</p>
                      <button
                        onClick={() => {
                          const url = URL.createObjectURL(
                            new Blob([g.tradeIds.join('\n')], { type: 'text/plain' }),
                          );
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'group-trade-ids.txt';
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        Tải toàn bộ ID nhóm
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Equity và MA20/50</h3>
      <details>
        <summary>Tổng hợp 20 custom slots · n/N số hợp lệ</summary>
        <table>
          <thead>
            <tr>
              <th>Thống kê</th>
              <th>n/N</th>
              <th>Trung bình số</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((slot) => {
              const summary = bundle?.custom.find((x) => x.slot === slot) ?? {
                n: 0,
                of: 0,
                mean: null,
              };
              return (
                <tr key={slot}>
                  <td>
                    {data.customStatDefs.find(
                      (d) => d.journalId === journal.id && String(d.slot) === slot,
                    )?.name ?? 'Thống kê ' + slot}
                  </td>
                  <td>
                    {summary.n}/{summary.of}
                  </td>
                  <td>{summary.mean ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
      <LinePlot
        label={'Equity / MA20 / MA50 · ' + journal.currency}
        series={[
          {
            name: 'Net',
            values: curve.map((p) => (p.net === null ? null : Number(p.net))),
            color: '#237b62',
          },
          {
            name: 'MA20',
            values: ma20.map((v) => (v === null ? null : Number(v))),
            color: '#b98c27',
          },
          {
            name: 'MA50',
            values: ma50.map((v) => (v === null ? null : Number(v))),
            color: '#668cce',
          },
        ]}
      />
      <p>MA theo sự kiện hiện thực hóa; điểm thiếu Net làm MA chưa xác định.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Net tích lũy</th>
              <th>MA20</th>
              <th>MA50</th>
            </tr>
          </thead>
          <tbody>
            {curve.slice(-100).map((p, k) => {
              const i = Math.max(0, curve.length - 100) + k;
              return (
                <tr key={i}>
                  <td>{p.time}</td>
                  <td>{formatValue(p.net, 'money', journal.currency)}</td>
                  <td>{formatValue(ma20[i], 'money', journal.currency)}</td>
                  <td>{formatValue(ma50[i], 'money', journal.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3>Trợ lý quy tắc · chạy trên thiết bị</h3>
      <label>
        Câu hỏi dữ liệu
        <select value={question} onChange={(e) => setQuestion(e.target.value as typeof question)}>
          <option value="missing">Lệnh nào thiếu phí hoặc 1R?</option>
          <option value="loss">Lệnh nào lỗ hơn 1R?</option>
          <option value="review">Lệnh nào chưa review?</option>
        </select>
      </label>
      <ul>
        {bundle?.assistant.slice(0, 100).map((f) => (
          <li key={f.tradeId}>
            {f.tradeId} · {f.symbol} · {f.reason} · {formatValue(f.net, 'money', journal.currency)}{' '}
            · {formatValue(f.r, 'R')}
          </li>
        ))}
      </ul>
      {bundle && (
        <p>
          Hiển thị {Math.min(100, bundle.assistant.length)}/{bundle.assistant.length} kết quả.
        </p>
      )}
      <h3>What-if · GIẢ ĐỊNH bỏ lệnh có chip lỗi</h3>
      <p>
        ID bỏ: {excluded.join(', ') || 'Không có'} · Net còn lại:{' '}
        {formatValue(scenario.net, 'money', journal.currency)} · R trung bình:{' '}
        {formatValue(scenario.averageR, 'R')}
      </p>
      <h3>Monte Carlo · 1.000 đường có seed</h3>
      <p>
        Lấy mẫu lại R đã biết với hoàn lại, giả định các quan sát độc lập và phân phối không đổi;
        không bù 1R bị thiếu. n={bundle?.rs.length ?? 0}/{bundle?.n ?? 0}.
      </p>
      <label>
        Seed
        <input value={seed} onChange={(e) => setSeed(e.target.value)} />
      </label>
      <label>
        Số lệnh mỗi đường (50–500)
        <input value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <label>
        Cột mốc giả định ({mcMode === 'percent' ? '%' : 'R'})
        <input value={milestone} onChange={(e) => setMilestone(e.target.value)} />
      </label>
      <label>
        Cách mô phỏng rủi ro
        <select value={mcMode} onChange={(e) => setMCMode(e.target.value as typeof mcMode)}>
          <option value="fixedR">1R cố định</option>
          <option value="percent">% vốn hiện tại, lãi kép</option>
        </select>
      </label>
      {mcMode === 'percent' && (
        <label>
          Rủi ro mỗi lệnh (% vốn)
          <input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />
        </label>
      )}
      <label>
        Ngưỡng lỗ từ vốn ban đầu ({mcMode === 'percent' ? '%' : 'R'})
        <input value={ruin} onChange={(e) => setRuin(e.target.value)} />
      </label>
      {(bundle?.rs.length ?? 0) < 50 && (
        <p className="notice">
          Mẫu dưới 50 lệnh: độ bất định cao; cần ít nhất 20 R đã biết để mô phỏng.
        </p>
      )}
      <button disabled={pending || !bundle || bundle.rs.length < 20} onClick={run}>
        {pending ? 'Đang mô phỏng…' : 'Chạy 1.000 đường'}
      </button>
      {simulation && simulationKey === simulationRequestKey && (
        <>
          <p>
            P25 / P75: {simulation.p25.toFixed(2)} / {simulation.p75.toFixed(2)} {simulation.unit} ·
            P(Net&gt;0) {(simulation.positiveProbability * 100).toFixed(1)}% · Xác suất từng chạm
            ngưỡng −{simulation.ruin}
            {simulation.unit}: {(simulation.ruinProbability * 100).toFixed(1)}%.
          </p>
          <LinePlot
            label={'Dải phân vị theo thời gian · GIẢ ĐỊNH · ' + simulation.unit}
            series={[0, 1, 2, 3, 4].map((k) => ({
              name: ['P5', 'P25', 'P50', 'P75', 'P95'][k],
              values: simulation.band.map((b) => b[k]),
              color: ['#ba5566', '#b98c27', '#237b62', '#668cce', '#8999ad'][k],
            }))}
          />
          <p>
            GIẢ ĐỊNH · seed {simulation.seed} · {simulation.paths} đường × {simulation.steps} lệnh ·
            cuối kỳ P5/P50/P95: {simulation.p05.toFixed(2)} / {simulation.median.toFixed(2)} /{' '}
            {simulation.p95.toFixed(2)} {simulation.unit} · Drawdown P95:{' '}
            {simulation.drawdown95.toFixed(2)}{' '}
            {simulation.unit === '%' ? 'điểm % vốn ban đầu' : 'R'} · tần suất đạt mốc trong mô
            phỏng: {(simulation.milestoneFrequency * 100).toFixed(1)}%
          </p>
          <LinePlot
            label={'GIẢ ĐỊNH · 10 đường Monte Carlo mẫu · ' + simulation.unit}
            series={simulation.samples.map((values, i) => ({
              name: 'Đường ' + (i + 1),
              values,
              color: ['#237b62', '#b98c27', '#668cce', '#ba5566'][i % 4],
            }))}
          />
          <details>
            <summary>10 đường mẫu · dữ liệu có thể tái lập</summary>
            {simulation.samples.map((s, i) => (
              <p key={i}>
                {i + 1}: {s.map((v) => v.toFixed(2)).join(' → ')}
              </p>
            ))}
          </details>
        </>
      )}
      <h3>Báo cáo chỉ đọc</h3>
      <button
        onClick={() =>
          void import('../data/excelReport')
            .then((m) => m.exportJournalExcel(data, journal.id))
            .catch((e) => setMessage(String(e)))
        }
      >
        Xuất Excel toàn bộ sổ · lệnh, khớp, ghi chú, dòng tiền
      </button>
      <p>
        Xuất tổng hợp theo phạm vi đang chọn; không chứa ghi chú, URL chart hoặc ID giao dịch. Mở
        file rồi dùng In/Lưu PDF của trình duyệt.
      </p>
      <button
        onClick={() =>
          void exportReport(journal, trades, scope).catch((e) => setMessage(String(e)))
        }
      >
        Tải báo cáo HTML để In/PDF
      </button>
      <button
        onClick={() => void printReport(journal, trades, scope).catch((e) => setMessage(String(e)))}
      >
        In báo cáo / Lưu PDF
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
function GroupTree({
  groups,
  currency,
  depth,
}: {
  groups: ReturnType<typeof researchBundle>['groups'];
  currency: Journal['currency'];
  depth: number;
}) {
  const nodes = new Map<string, typeof groups>();
  for (const g of groups) {
    const key = (JSON.parse(g.key) as string[])[depth] ?? '(chưa gán)';
    const rows = nodes.get(key);
    if (rows) rows.push(g);
    else nodes.set(key, [g]);
  }
  return (
    <div>
      {[...nodes].map(([label, rows]) => (
        <details key={label}>
          <summary>
            {label} · n={rows.reduce((n, g) => n + g.tradeIds.length, 0)}
          </summary>
          {depth + 1 < (JSON.parse(rows[0].key) as string[]).length ? (
            <GroupTree groups={rows} currency={currency} depth={depth + 1} />
          ) : (
            <>
              <p>
                Net {formatValue(rows[0].metrics.net.value, 'money', currency)} ·{' '}
                {rows[0].tradeIds.slice(0, 20).join(', ')}
              </p>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([rows[0].tradeIds.join('\n')], { type: 'text/plain' }),
                  );
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'drilldown-evidence.txt';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Tải ID bằng chứng
              </button>
            </>
          )}
        </details>
      ))}
    </div>
  );
}
