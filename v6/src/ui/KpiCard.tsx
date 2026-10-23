import { useId } from 'react';
import type { Metric } from '../core/analyze';
import type { Currency } from '../data/schema';
import { formatValue, type FormatKind } from './format';
import vi from '../i18n/vi.json';
export function KpiCard({
  id,
  metric,
  currency,
  demo,
  minSample = 20,
  holding = 'hours',
  formatOverride,
}: {
  id: keyof typeof vi.metricHelp;
  metric: Metric;
  currency: Currency;
  demo: boolean;
  minSample?: number;
  holding?: 'minutes' | 'hours' | 'days';
  formatOverride?: FormatKind;
}) {
  const helpId = useId();
  const definition = vi.metricHelp[id];
  const kind = formatOverride ?? (definition.kind as FormatKind);
  const unit =
    kind === 'money'
      ? currency
      : kind === 'duration'
        ? { hours: 'giờ', minutes: 'phút', days: 'ngày' }[holding]
        : kind === 'percent'
          ? '%'
          : kind === 'R'
            ? 'R'
            : kind === 'count' || kind === 'streak'
              ? 'lệnh'
              : 'hệ số';
  return (
    <article className="kpi" data-testid="kpi-card" aria-label={vi.metricLabels[id]}>
      <h3 data-part="label">{vi.metricLabels[id].replace(' (%)', '').replace(' (phút)', '')}</h3>
      <strong data-part="value">
        {formatValue(
          metric.value,
          kind,
          currency,
          kind === 'money' && id !== 'maxDrawdown',
          holding,
        )}
      </strong>
      <span data-part="unit">
        {vi.shell.unit}: {unit}
      </span>
      <div className="kpi-meta">
        <span data-part="sample">
          n={metric.n}/{metric.of}
        </span>
        <span data-part="badge" className="badge">
          {demo ? vi.shell.demo : metric.n >= minSample ? vi.shell.sufficient : vi.shell.small}
        </span>
      </div>
      <details data-part="help">
        <summary aria-controls={helpId}>{vi.shell.help}</summary>
        <dl id={helpId}>
          {formatOverride && formatOverride !== definition.kind && (
            <div>
              <dt>Đơn vị đang chọn</dt>
              <dd>
                {formatOverride === 'R'
                  ? 'Tiền lãi/lỗ từng lệnh chia 1R của chính lệnh đó; không bù rủi ro còn thiếu.'
                  : 'Tiền lãi/lỗ chia vốn đầu kỳ; nạp/rút không cộng vào lợi nhuận. TWR xem tại Vốn/dòng tiền.'}
              </dd>
            </div>
          )}
          {definition.help.map((line, i) => (
            <div key={i}>
              <dt>{vi.shell.helpLabels[i]}</dt>
              <dd>{line}</dd>
            </div>
          ))}
        </dl>
      </details>
      {metric.value === null && <small>{vi.shell.unknown}</small>}
    </article>
  );
}
