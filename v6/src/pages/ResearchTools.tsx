import { useRef, useState, useEffect } from 'react';
import type { Journal, Trade } from '../data/schema';
import type { analyze } from '../core/analyze';
import type { Dimension, monteCarlo, researchBundle } from '../core/advanced';
import { formatValue } from '../ui/format';
import { exportReport } from '../data/staticReport';
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
    [question, setQuestion] = useState<'missing' | 'loss' | 'review'>('missing');
  const { data, revision } = useLedger();
  const [seed, setSeed] = useState('2103'),
    [steps, setSteps] = useState('100'),
    [milestone, setMilestone] = useState('10'),
    [simulation, setSimulation] = useState<ReturnType<typeof monteCarlo>>(),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const worker = useRef<Worker>();
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
    question;
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
      dimensions: [first, second],
      question,
      base,
    });
    return () => w.terminate();
  }, [requestKey, journal, trades, scope, first, second, question, base]);
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
    setSimulationKey(requestKey);
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
      <h3>Drill-down hai cấp</h3>
      {[first, second].map((value, i) => (
        <label key={i}>
          Chiều nhóm {i + 1}
          <select
            value={value}
            onChange={(e) => (i === 0 ? setFirst : setSecond)(e.target.value as Dimension)}
          >
            {(['symbol', 'setupId', 'market', 'side'] as const).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      ))}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nhóm</th>
              <th>n</th>
              <th>Net</th>
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
        Số lệnh mỗi đường (1–1000)
        <input value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <label>
        Cột mốc R giả định
        <input value={milestone} onChange={(e) => setMilestone(e.target.value)} />
      </label>
      <button disabled={pending || !bundle} onClick={run}>
        {pending ? 'Đang mô phỏng…' : 'Chạy 1.000 đường'}
      </button>
      {simulation && simulationKey === requestKey && (
        <>
          <p>
            GIẢ ĐỊNH · seed {simulation.seed} · {simulation.paths} đường × {simulation.steps} lệnh ·
            cuối kỳ P5/P50/P95: {simulation.p05.toFixed(2)} / {simulation.median.toFixed(2)} /{' '}
            {simulation.p95.toFixed(2)} R · Drawdown P95: {simulation.drawdown95.toFixed(2)} R · tần
            suất đạt mốc trong mô phỏng: {(simulation.milestoneFrequency * 100).toFixed(1)}%
          </p>
          <LinePlot
            label="GIẢ ĐỊNH · 10 đường Monte Carlo mẫu · R"
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
      {message && <p role="status">{message}</p>}
    </section>
  );
}
