import { useMemo, useState, useEffect } from 'react';
import type { Journal, Trade } from '../data/schema';
import type { analyze } from '../core/analyze';
import { exitAnalysis, movingAverage } from '../core/advanced';
import { behavior, milestones } from '../core/behavior';
import { useLedger } from '../app/LedgerContext';
import { viewRepository } from '../data/views';
import { LinePlot } from '../ui/LinePlot';
import { formatValue } from '../ui/format';
import { D, dec, sum } from '../core/money';
import { dayInZone } from '../core/analyze';
import { HoldingScatter } from '../ui/HoldingScatter';
export function DeepAnalysis({
  journal,
  trades,
  result,
}: {
  journal: Journal;
  trades: Trade[];
  result?: ReturnType<typeof analyze>;
}) {
  const { data } = useLedger(),
    [backed, setBacked] = useState(false),
    [group, setGroup] = useState<'trade' | 'day'>('trade'),
    [gross, setGross] = useState(true),
    [net, setNet] = useState(true),
    [shade, setShade] = useState(true),
    [ma20, setMA20] = useState(true),
    [ma50, setMA50] = useState(true),
    [left, setLeft] = useState(''),
    [right, setRight] = useState(''),
    [excluded, setExcluded] = useState('');
  useEffect(() => {
    void viewRepository.meta.get('lastBackupAt').then((v) => setBacked(!!v?.value));
  }, []);
  const rows = useMemo(
    () => behavior(trades, data.errorTags, data.setups),
    [trades, data.errorTags, data.setups],
  );
  const exits = useMemo(
    () => trades.map((t) => ({ t, exit: exitAnalysis(t) })).filter((x) => x.exit),
    [trades],
  );
  const goals = milestones(
    trades,
    data.notes.filter((n) => n.journalId === journal.id && n.scope === 'day').length,
    backed,
    data.setups,
    data.errorTags,
  );
  const facts = result?.closed ?? [],
    events = result?.events ?? [];
  let totalGross = D('0'),
    totalNet = D('0'),
    unknown = false;
  const equity = events.map((e) => {
    totalGross = totalGross.plus(e.gross);
    if (e.net === undefined) unknown = true;
    else totalNet = totalNet.plus(e.net);
    return {
      time: e.time,
      tradeId: e.tradeId,
      gross: dec(totalGross),
      net: unknown ? null : dec(totalNet),
    };
  });
  const points =
    group === 'trade'
      ? equity
      : [...new Map(equity.map((p) => [dayInZone(p.time, journal.timezone), p])).values()];
  const curve = (setup: string) => {
    let r = D('0'),
      missing = false;
    return facts
      .filter((f) => !setup || f.trade.setupId === setup)
      .map((f) => {
        if (f.r === undefined) missing = true;
        else r = r.plus(f.r);
        return missing ? null : Number(r);
      });
  };
  const selected = facts.filter((f) =>
    excluded.startsWith('setup:')
      ? f.trade.setupId !== excluded.slice(6)
      : !f.trade.errorTagIds.includes(excluded),
  );
  const scenario = () => {
    let r = D('0'),
      missing = false;
    return selected.map((f) => {
      if (f.r === undefined) missing = true;
      else r = r.plus(f.r);
      return missing ? null : Number(r);
    });
  };
  const bmap = new Map(rows.map((r) => [r.id, r]));
  return (
    <>
      <section className="panel">
        <h2>Kỷ luật và hiệu quả theo thời gian</h2>
        <p>
          Tiltmeter: mỗi khâu có chip tiêu cực −1; nếu không, có tích cực +1; còn lại 0. Tổng −3…+3.
          Efficiency là % không có chip tiêu cực trong 20 lệnh đã quan sát, độc lập với kỷ luật cũ.
        </p>
        <LinePlot
          label="Efficiency 20 lệnh · % tuân thủ"
          series={[{ name: 'Efficiency', values: rows.map((r) => r.efficiency), color: '#237b62' }]}
        />
        <details>
          <summary>Tiltmeter từng lệnh · {rows.length} lệnh</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tiltmeter</th>
                  <th>Checklist</th>
                  <th>Efficiency n/N</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-100).map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      <meter min={-3} max={3} value={r.score} aria-label={'Tiltmeter ' + r.id} />
                      {r.observed ? r.score : 'Chưa gắn chip'}
                    </td>
                    <td>{r.checklist ?? '—'}</td>
                    <td>
                      {r.efficiency ?? '—'} · {r.n}/{r.of}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="panel">
        <h2>Exit Analysis và Trade Management</h2>
        <p>
          Updraw xanh / Drawdown đỏ theo khoảng TP/SL; ◆ là vị trí thoát thực tế. Không có bằng
          chứng thứ tự TP/SL thì đường thụ động để trống. Chỉ lệnh hai khớp có đủ dữ liệu; không
          dựng đường giá.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Updraw / Drawdown / ◆</th>
                <th>R thực</th>
                <th>R thụ động · GIẢ ĐỊNH</th>
                <th>ΔR</th>
              </tr>
            </thead>
            <tbody>
              {exits.slice(-100).map(({ t, exit: e }) => (
                <tr key={t.id}>
                  <td>
                    {t.symbol} · {t.id}
                  </td>
                  <td>
                    <svg
                      viewBox="0 0 240 60"
                      role="img"
                      aria-label={`Updraw ${e!.updrawPercent ?? 'thiếu'}%; Drawdown ${e!.adversePercent ?? 'thiếu'}%; điểm thoát ${e!.exitPercent ?? 'thiếu'}%`}
                      style={{ width: 240, maxWidth: '100%' }}
                    >
                      <line x1="120" x2="120" y1="0" y2="60" stroke="currentColor" />
                      {e!.updrawPercent !== null && (
                        <rect
                          x="120"
                          y="8"
                          width={Math.min(110, Number(e!.updrawPercent) * 0.5)}
                          height="18"
                          fill="#237b62"
                        />
                      )}
                      {e!.adversePercent !== null && (
                        <rect
                          x={120 - Math.min(110, Number(e!.adversePercent) * 0.5)}
                          y="30"
                          width={Math.min(110, Number(e!.adversePercent) * 0.5)}
                          height="18"
                          fill="#ba5566"
                        />
                      )}
                      {e!.exitPercent !== null && (
                        <text
                          x={Math.max(10, Math.min(220, 120 + Number(e!.exitPercent) * 0.5))}
                          y="30"
                          fill="currentColor"
                        >
                          ◆
                        </text>
                      )}
                    </svg>
                    <small>
                      {e!.updrawPercent ?? '—'}% / {e!.adversePercent ?? '—'}% / ◆{' '}
                      {e!.exitPercent ?? '—'}%
                    </small>
                  </td>
                  <td>{e!.actualR ?? '—'}</td>
                  <td>{e!.plannedR ?? '—'}</td>
                  <td>{e!.managementEffectR ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LinePlot
          label="Trade Management · R mỗi lệnh · thụ động GIẢ ĐỊNH"
          series={[
            {
              name: 'R thực',
              values: exits.map((x) => (x.exit!.actualR === null ? null : Number(x.exit!.actualR))),
              color: '#237b62',
            },
            {
              name: 'Set-and-forget GIẢ ĐỊNH',
              values: exits.map((x) =>
                x.exit!.plannedR === null ? null : Number(x.exit!.plannedR),
              ),
              color: '#b98c27',
            },
          ]}
        />
      </section>
      <section className="panel">
        <h2>Đường vốn đa lớp</h2>
        <label>
          Gộp điểm vốn
          <select value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
            <option value="trade">Theo khớp hiện thực hóa</option>
            <option value="day">Theo ngày</option>
          </select>
        </label>
        {[
          [gross, setGross, 'Trước phí'],
          [net, setNet, 'Sau phí'],
          [shade, setShade, 'Phủ nền Tiltmeter'],
          [ma20, setMA20, 'Equity MA-20'],
          [ma50, setMA50, 'Equity MA-50'],
        ].map(([value, set, label]) => (
          <label key={String(label)}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
            />
            {String(label)}
          </label>
        ))}
        {shade && (
          <div aria-label="Nền Tiltmeter theo lệnh" style={{ display: 'flex', height: 18 }}>
            {rows.map((r) => (
              <span
                key={r.id}
                title={r.id + ': ' + r.score}
                style={{
                  flex: 1,
                  background: r.score < 0 ? '#ba5566' : r.score > 0 ? '#237b62' : '#8999ad',
                }}
              />
            ))}
          </div>
        )}
        <LinePlot
          label={'Vốn thực trước/sau phí và MA · ' + journal.currency}
          background={shade ? points.map((p) => bmap.get(p.tradeId)?.score ?? 0) : undefined}
          series={[
            ...(gross
              ? [{ name: 'Gross', values: points.map((p) => Number(p.gross)), color: '#668cce' }]
              : []),
            ...(net
              ? [
                  {
                    name: 'Net',
                    values: points.map((p) => (p.net === null ? null : Number(p.net))),
                    color: '#237b62',
                  },
                ]
              : []),
            ...[...(ma20 ? [20] : []), ...(ma50 ? [50] : [])].map((n) => ({
              name: 'MA' + n,
              values: movingAverage(
                points.map((p) => p.net),
                n,
              ).map((v) => (v === null ? null : Number(v))),
              color: n === 20 ? '#b98c27' : '#ba5566',
            })),
          ]}
        />
      </section>
      <HoldingScatter facts={facts} journal={journal} />
      <section className="panel">
        <h2>So sánh hai biểu đồ cạnh nhau</h2>
        <div className="dashboard-grid">
          {(
            [
              ['Trái', left, setLeft],
              ['Phải', right, setRight],
            ] as const
          ).map(([label, value, set]) => (
            <div key={label}>
              <label>
                Setup {label}
                <select value={value} onChange={(e) => set(e.target.value)}>
                  <option value="">Tất cả setup</option>
                  {data.setups
                    .filter((s) => s.journalId === journal.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <LinePlot
                label={'Nhóm ' + label + ' · R tích lũy theo lệnh'}
                series={[
                  {
                    name: label,
                    values: curve(value),
                    color: label === 'Trái' ? '#237b62' : '#668cce',
                  },
                ]}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>What-if có lựa chọn · GIẢ ĐỊNH</h2>
        <label>
          Loại khỏi giả định
          <select value={excluded} onChange={(e) => setExcluded(e.target.value)}>
            <option value="">Không loại</option>
            {data.errorTags
              .filter((e) => e.journalId === journal.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  Lỗi: {e.name}
                </option>
              ))}
            {data.setups
              .filter((s) => s.journalId === journal.id)
              .map((s) => (
                <option key={s.id} value={'setup:' + s.id}>
                  Setup: {s.name}
                </option>
              ))}
          </select>
        </label>
        <p>
          Giữ {selected.length}/{facts.length} lệnh. Không sửa lệnh thực; có thể có thiên lệch lựa
          chọn và review. {result?.shadow.bias ? 'Cảnh báo: độ lệch review >15 điểm %.' : ''}
        </p>
        <LinePlot
          label="Thực tế và What-if · GIẢ ĐỊNH · R"
          series={[
            { name: 'Thực tế', values: curve(''), color: '#237b62' },
            { name: 'What-if GIẢ ĐỊNH', values: scenario(), color: '#b98c27' },
          ]}
        />
        <details>
          <summary>ID lệnh đã loại</summary>
          {facts
            .filter((f) => !selected.includes(f))
            .map((f) => (
              <p key={f.id}>
                {f.id} · Tilt {bmap.get(f.id)?.score ?? '—'}
              </p>
            ))}
        </details>
      </section>
      <section className="panel">
        <h2>Báo cáo tháng → tuần</h2>
        {result?.months.map((m) => (
          <details key={m.label}>
            <summary>
              {m.label} · {formatValue(m.net, 'money', journal.currency)}
            </summary>
            {result.weeks
              .filter((w) =>
                result.days.some(
                  (d) =>
                    d.date.startsWith(m.label) &&
                    d.date >= isoWeekStart(w.label) &&
                    d.date < isoWeekEnd(w.label),
                ),
              )
              .map((w) => {
                const days = result.days.filter(
                  (d) =>
                    d.date.startsWith(m.label) &&
                    d.date >= isoWeekStart(w.label) &&
                    d.date < isoWeekEnd(w.label),
                );
                return {
                  ...w,
                  net: days.some((d) => d.net === null) ? null : sum(days.map((d) => d.net!)),
                  closed: days.reduce((n, d) => n + d.closed, 0),
                };
              })
              .map((w, i, ws) => (
                <p key={w.label}>
                  {w.label} · {formatValue(w.net, 'money', journal.currency)} ·{' '}
                  {i === 0 || w.net === null || ws[i - 1].net === null
                    ? '—'
                    : D(w.net).gt(ws[i - 1].net!)
                      ? '▲'
                      : D(w.net).lt(ws[i - 1].net!)
                        ? '▼'
                        : '='}{' '}
                  · {w.closed} lệnh
                </p>
              ))}
          </details>
        ))}
      </section>
      <section className="panel">
        <h2>9 cột mốc thói quen</h2>
        <p>
          Level {goals.filter((g) => g.complete).length}/9 · ghi nhận thói quen, không đánh giá khả
          năng sinh lời.
        </p>
        {goals.map((g) => (
          <div key={g.name}>
            <label>
              {g.name} · {g.value}/{g.target}
              <progress max={100} value={g.progress} />
            </label>
          </div>
        ))}
      </section>
    </>
  );
}
function isoWeekStart(label: string) {
  const [y, w] = label.split('-W').map(Number),
    d = new Date(Date.UTC(y, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return d.toISOString().slice(0, 10);
}
function isoWeekEnd(label: string) {
  const d = new Date(isoWeekStart(label) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
