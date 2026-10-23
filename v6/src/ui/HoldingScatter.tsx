import type { TradeFacts } from '../core/trade';
import type { Journal } from '../data/schema';
import { formatValue } from './format';
export function HoldingScatter({ facts, journal }: { facts: TradeFacts[]; journal: Journal }) {
  const unit = journal.settings.holdingUnit,
    scale = unit === 'minutes' ? 1 : unit === 'hours' ? 60 : 1440,
    label = unit === 'minutes' ? 'Phút' : unit === 'hours' ? 'Giờ' : 'Ngày';
  const points = facts
    .filter((f) => f.holdMinutes !== undefined && f.r !== undefined)
    .map((f) => ({ id: f.id, symbol: f.trade.symbol, x: f.holdMinutes! / scale, y: Number(f.r) }));
  if (!points.length)
    return (
      <section className="panel">
        <h2>Thời gian giữ lệnh và R</h2>
        <p>Chưa có lệnh đóng đủ thời gian và 1R.</p>
      </section>
    );
  const maxX = Math.max(1, ...points.map((p) => p.x)),
    minY = Math.min(0, ...points.map((p) => p.y)),
    maxY = Math.max(1, ...points.map((p) => p.y)),
    span = maxY - minY || 1;
  return (
    <section className="panel">
      <h2>Thời gian giữ lệnh và R</h2>
      <p>
        Trục ngang {label}, trục dọc Net/1R · n={points.length}/{facts.length} đủ dữ liệu.
      </p>
      <svg
        viewBox="0 0 640 260"
        role="img"
        aria-label={'Biểu đồ phân tán thời gian giữ theo ' + label + ' và R'}
        style={{ width: '100%' }}
      >
        <title>Holding Time Scatter</title>
        <path d="M55 10V225H630" stroke="currentColor" fill="none" />
        <text x="5" y="20" fill="currentColor">
          {maxY.toFixed(1)}R
        </text>
        <text x="5" y="220" fill="currentColor">
          {minY.toFixed(1)}R
        </text>
        <text x="55" y="250" fill="currentColor">
          0
        </text>
        <text x="500" y="250" fill="currentColor">
          {maxX.toFixed(1)} {label}
        </text>
        {points.map((p) => (
          <circle
            key={p.id}
            cx={55 + (p.x / maxX) * 565}
            cy={220 - ((p.y - minY) / span) * 205}
            r={3.5}
            opacity={0.65}
            fill={p.y < 0 ? '#ba5566' : '#237b62'}
          >
            <title>
              {p.symbol} · {p.id}: {p.x.toFixed(2)} {label}, {formatValue(String(p.y), 'R')}
            </title>
          </circle>
        ))}
      </svg>
    </section>
  );
}
