import type { ReactNode } from 'react';
import type { QuantReport } from '../core/quantLab';
import { QuantHelp, type QuantHelpKey } from './QuantHelp';
export const qNumber = (n: number | null, digits = 2) =>
  n === null || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
export function QuantPanel({
  title,
  help,
  count,
  onInspect,
  children,
}: {
  title: string;
  help: QuantHelpKey;
  count: string;
  onInspect?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="quant-panel">
      <header>
        <h2>
          {title}
          <QuantHelp id={help} />
        </h2>
        {onInspect ? (
          <button className="quant-count" onClick={onInspect}>
            {count}
          </button>
        ) : (
          <span className="quant-count">{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}
function Axes({
  min,
  max,
  left,
  right,
  x,
  y,
  children,
}: {
  min: number;
  max: number;
  left: number;
  right: number;
  x: string;
  y: string;
  children: ReactNode;
}) {
  return (
    <div className="quant-plot-frame">
      <span className="quant-axis-title">{y}</span>
      <div className="quant-plot">
        <span className="quant-y top">{qNumber(max, 1)}</span>
        <span className="quant-y bottom">{qNumber(min, 1)}</span>
        <svg width="100%" height="220" role="img" aria-label={y + ' theo ' + x}>
          {[0, 25, 50, 75, 100].map((v) => (
            <line key={v} x1="0" x2="100%" y1={v + '%'} y2={v + '%'} className="quant-gridline" />
          ))}
          {children}
        </svg>
        <div className="quant-x">
          <span>{qNumber(left, 1)}</span>
          <span>{x}</span>
          <span>{qNumber(right, 1)}</span>
        </div>
      </div>
    </div>
  );
}
export function QuantHistogram({
  report,
  inspect,
}: {
  report: QuantReport;
  inspect: (ids: string[], title: string) => void;
}) {
  const { bins, stats } = report;
  const max = Math.max(1, ...bins.map((b) => Math.max(b.ids.length, b.normal)));
  return (
    <QuantPanel
      title="Phân phối kết quả R"
      help="distribution"
      count={stats.n + ' lệnh'}
      onInspect={() =>
        inspect(
          report.rows.filter((r) => r.r !== null).map((r) => r.id),
          'Phân phối kết quả R',
        )
      }
    >
      {!stats.n ? (
        <p className="quant-empty">Cần lệnh đóng có P&L và 1R.</p>
      ) : (
        <>
          <Axes
            min={0}
            max={max}
            left={bins[0].from}
            right={bins.at(-1)!.to}
            x="Kết quả (R)"
            y="Số lệnh"
          >
            {bins.map((b, i) => (
              <rect
                key={i}
                x={(i * 100) / bins.length + 0.5 + '%'}
                width={100 / bins.length - 1 + '%'}
                y={100 - (b.ids.length / max) * 100 + '%'}
                height={(b.ids.length / max) * 100 + '%'}
                fill={(b.from + b.to) / 2 < 0 ? 'var(--q-negative)' : 'var(--q-positive)'}
                onClick={() => inspect(b.ids, qNumber(b.from) + ' đến ' + qNumber(b.to) + ' R')}
              >
                <title>
                  {qNumber(b.from)}…{qNumber(b.to)} R · {b.ids.length} lệnh
                </title>
              </rect>
            ))}
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                fill="none"
                stroke="var(--q-accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={bins
                  .map(
                    (b, i) => `${((i + 0.5) * 100) / bins.length},${100 - (b.normal / max) * 100}`,
                  )
                  .join(' ')}
              />
            </svg>
          </Axes>
          <div className="quant-chart-meta">
            <span>Độ lệch: {qNumber(report.skew)}</span>
            <span>Đuôi dư: {qNumber(report.kurtosis)}</span>
            <span className="quant-legend">Đường chuẩn đối chiếu</span>
          </div>
          <div className="quant-bin-controls" aria-label="Khoảng R">
            <span>Xem lệnh:</span>
            {bins
              .filter((b) => b.ids.length)
              .map((b) => (
                <button
                  key={b.from}
                  onClick={() => inspect(b.ids, 'Khoảng R')}
                  aria-label={
                    qNumber(b.from, 1) +
                    '…' +
                    qNumber(b.to, 1) +
                    ' R · Xem lệnh từ ' +
                    qNumber(b.from) +
                    ' đến ' +
                    qNumber(b.to)
                  }
                >
                  {qNumber(b.from, 1)}…{qNumber(b.to, 1)}
                </button>
              ))}
          </div>
        </>
      )}
    </QuantPanel>
  );
}
export function QuantScatter({
  report,
  kind,
  inspect,
}: {
  report: QuantReport;
  kind: 'mfe' | 'mae';
  inspect: (ids: string[], title: string) => void;
}) {
  const rows = report.excursions,
    getX = (r: (typeof rows)[number]) => (kind === 'mfe' ? r.mfeR! : r.maeR!);
  const maxX = Math.max(1, ...rows.map(getX)),
    minY = Math.min(0, ...rows.map((r) => r.r!)),
    maxY = Math.max(1, ...rows.map((r) => r.r!));
  const shown = rows.filter((_, i) => i % Math.max(1, Math.ceil(rows.length / 900)) === 0);
  return (
    <QuantPanel
      title={kind === 'mfe' ? 'Hiệu suất chốt lời' : 'Chịu nhiệt của lệnh'}
      help={kind}
      count={rows.length + '/' + report.rows.length + ' lệnh'}
      onInspect={() =>
        inspect(
          rows.map((r) => r.id),
          kind.toUpperCase() + ' · lệnh có dữ liệu',
        )
      }
    >
      {!rows.length ? (
        <div className="quant-empty">
          <strong>Chưa có {kind.toUpperCase()} được ghi nhận</strong>
          <span>Bổ sung đỉnh/đáy thực trong hồ sơ lệnh. Các thống kê R khác vẫn hoạt động.</span>
        </div>
      ) : (
        <>
          <Axes
            min={minY}
            max={maxY}
            left={0}
            right={maxX}
            x={kind.toUpperCase() + ' (R)'}
            y="R thực hiện"
          >
            {kind === 'mfe' && (
              <line
                x1="0"
                y1={100 - ((0 - minY) / (maxY - minY)) * 100 + '%'}
                x2={(Math.min(maxX, maxY) / maxX) * 100 + '%'}
                y2={100 - ((Math.min(maxX, maxY) - minY) / (maxY - minY)) * 100 + '%'}
                className="quant-diagonal"
              />
            )}
            {shown.map((r) => (
              <circle
                key={r.id}
                cx={(getX(r) / maxX) * 96 + 2 + '%'}
                cy={98 - ((r.r! - minY) / (maxY - minY)) * 96 + '%'}
                r="4.5"
                opacity="0.8"
                fill={r.r! >= 0 ? 'var(--q-positive)' : 'var(--q-negative)'}
                onClick={() => inspect([r.id], r.symbol)}
              >
                <title>
                  {r.symbol} · {kind.toUpperCase()} {qNumber(getX(r))}R · {qNumber(r.r)}R
                </title>
              </circle>
            ))}
          </Axes>
          <p className="quant-footnote">
            {shown.length < rows.length ? `${shown.length}/${rows.length} chấm hiển thị · ` : ''}Bấm
            số mẫu để xem bảng lệnh đầy đủ.
          </p>
        </>
      )}
    </QuantPanel>
  );
}
export function QuantHeatmap({
  report,
  inspect,
  minutes,
}: {
  report: QuantReport;
  minutes: number;
  inspect: (ids: string[], title: string) => void;
}) {
  const slots = [...new Set(report.heat.map((c) => c.minute))].sort((a, b) => a - b);
  const clock = (m: number) =>
    String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const cells = new Map(report.heat.map((c) => [c.weekday + ':' + c.minute, c]));
  return (
    <QuantPanel
      title="Kỳ vọng theo thời điểm"
      help="heat"
      count={report.heat.reduce((n, c) => n + c.ids.length, 0) + ' lệnh có giờ'}
    >
      {!slots.length ? (
        <p className="quant-empty">Cần giờ vào/ra chính xác để phân tích thời điểm.</p>
      ) : (
        <div className="quant-heat-scroll">
          <table className="quant-heat">
            <caption>Khung {minutes} phút · mỗi ô: kỳ vọng R / số lệnh</caption>
            <thead>
              <tr>
                <th>Giờ</th>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <th>{clock(slot)}</th>
                  {Array.from({ length: 7 }, (_, i) => {
                    const c = cells.get(i + 1 + ':' + slot);
                    return (
                      <td key={i}>
                        {c ? (
                          <button
                            className={c.mean < 0 ? 'loss' : c.mean > 0 ? 'profit' : ''}
                            onClick={() =>
                              inspect(
                                c.ids,
                                clock(slot) + ' · ' + ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i],
                              )
                            }
                          >
                            <b>
                              {c.mean > 0 ? '+' : ''}
                              {qNumber(c.mean, 1)}
                            </b>
                            <small>n={c.ids.length}</small>
                          </button>
                        ) : (
                          <span aria-label="Chưa có mẫu">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QuantPanel>
  );
}
export function QuantLine({
  report,
  kind,
  inspect,
}: {
  report: QuantReport;
  kind: 'dd' | 'rolling';
  inspect: (ids: string[], title: string) => void;
}) {
  const values =
    kind === 'dd'
      ? report.curve.map((r) => (r.dd === null ? null : -r.dd))
      : report.rolling.map((r) => r.sqn);
  const known = values.filter((x): x is number => x !== null),
    min = Math.min(0, ...known),
    max = Math.max(1, ...known);
  const segments: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    if (i % Math.max(1, Math.ceil(values.length / 900)) === 0 || i === values.length - 1)
      current += `${(i / Math.max(1, values.length - 1)) * 100},${100 - ((v - min) / (max - min)) * 100} `;
  });
  if (current) segments.push(current);
  return (
    <QuantPanel
      title={kind === 'dd' ? 'Sụt giảm theo R' : 'SQN trượt 30 lệnh'}
      help={kind === 'dd' ? 'dd' : 'rolling'}
      count={values.length + ' lệnh'}
      onInspect={() =>
        inspect(
          report.rows.map((r) => r.id),
          'Lệnh theo thứ tự đóng',
        )
      }
    >
      {!known.length ? (
        <p className="quant-empty">Chưa đủ dữ liệu liên tục để vẽ đường.</p>
      ) : (
        <Axes
          min={min}
          max={max}
          left={1}
          right={values.length}
          x="Thứ tự lệnh đóng"
          y={kind === 'dd' ? 'Drawdown (R)' : 'SQN'}
        >
          <svg
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {segments.map((p, i) => (
              <polyline
                key={i}
                points={p}
                fill="none"
                stroke={kind === 'dd' ? 'var(--q-negative)' : 'var(--q-accent)'}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </Axes>
      )}
      {kind === 'dd' && !report.complete && (
        <p className="quant-footnote">Đường dừng tại lệnh thiếu R đầu tiên.</p>
      )}
    </QuantPanel>
  );
}
