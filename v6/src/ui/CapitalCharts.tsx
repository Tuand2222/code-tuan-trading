import type { CapitalSimulation } from '../core/capitalPro';
export const capitalNumber = (n: number | null | undefined, d = 2) =>
  n === Infinity
    ? '∞'
    : n === null || n === undefined || !Number.isFinite(n)
      ? '—'
      : n.toLocaleString('vi-VN', { maximumFractionDigits: d });
export function CapitalLines({
  title,
  series,
  unit = 'R',
}: {
  title: string;
  series: { name: string; values: (number | null)[]; color: string }[];
  unit?: string;
}) {
  const values = series.flatMap((s) =>
    s.values.filter((x): x is number => x !== null && Number.isFinite(x)),
  );
  const min = values.reduce((a, b) => Math.min(a, b), 0),
    max = values.reduce((a, b) => Math.max(a, b), 0),
    range = max - min || 1;
  return (
    <figure className="capital-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 760 230" role="img" aria-label={title}>
        <title>{title}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1="62" x2="748" y1={20 + t * 175} y2={20 + t * 175} stroke="var(--line)" />
            <text x="2" y={24 + t * 175}>
              {capitalNumber(max - t * range, 1)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          let d = '',
            open = false;
          for (let i = 0; i < s.values.length; i++) {
            const v = s.values[i];
            if (v === null || !Number.isFinite(v)) {
              open = false;
              continue;
            }
            d +=
              (open ? ' L' : ' M') +
              (62 + (i * 686) / Math.max(1, s.values.length - 1)).toFixed(1) +
              ' ' +
              (195 - ((v - min) / range) * 175).toFixed(1);
            open = true;
          }
          return <path key={s.name} d={d} fill="none" stroke={s.color} strokeWidth="2.5" />;
        })}
        <text x="62" y="222">
          Đầu mẫu
        </text>
        <text x="650" y="222">
          Cuối mẫu · {unit}
        </text>
      </svg>
      <div className="capital-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <details>
        <summary>Dữ liệu biểu đồ</summary>
        <div className="capital-table" tabIndex={0} role="region" aria-label={'Dữ liệu ' + title}>
          <table>
            <caption>50 điểm đầu của {title}</caption>
            <thead>
              <tr>
                <th>Điểm</th>
                {series.map((s) => (
                  <th key={s.name}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: Math.min(50, Math.max(0, ...series.map((s) => s.values.length))) },
                (_, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {series.map((s) => (
                      <td key={s.name}>{capitalNumber(s.values[i])}</td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
export function CapitalFan({ simulation, unit }: { simulation: CapitalSimulation; unit: string }) {
  return (
    <CapitalLines
      title="Dải vốn mô phỏng P5 · P25 · P50 · P75 · P95"
      unit={unit}
      series={[
        { name: 'P5 (vốn thấp)', values: simulation.fan.map((x) => x.p5), color: '#c43b54' },
        { name: 'P25', values: simulation.fan.map((x) => x.p25), color: '#bb770d' },
        { name: 'P50 (trung vị)', values: simulation.fan.map((x) => x.p50), color: '#2563eb' },
        { name: 'P75', values: simulation.fan.map((x) => x.p75), color: '#1a8573' },
        { name: 'P95 (vốn cao)', values: simulation.fan.map((x) => x.p95), color: '#805ac7' },
      ]}
    />
  );
}
