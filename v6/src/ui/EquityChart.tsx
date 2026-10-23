import { useEffect, useRef, useState } from 'react';
import { init, use as registerCharts, type EChartsType } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { analyze } from '../core/analyze';
import type { Journal } from '../data/schema';
import { formatDate, formatValue } from './format';
import vi from '../i18n/vi.json';
import { useLedger } from '../app/LedgerContext';
registerCharts([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  CanvasRenderer,
]);
export function EquityChart({
  projections,
  journal,
}: {
  projections: Record<'money' | 'percent' | 'R', ReturnType<typeof analyze>['curve']>;
  journal: Journal;
}) {
  const { mutate } = useLedger();
  const unit = journal.settings.displayUnit;
  const setUnit = (displayUnit: typeof unit) =>
    void mutate((s) => ({
      ...s,
      journals: s.journals.map((j) =>
        j.id === journal.id ? { ...j, settings: { ...j.settings, displayUnit } } : j,
      ),
    })).catch(() => {});
  const curve = projections[unit];
  const kind = unit === 'money' ? 'money' : unit === 'percent' ? 'percent' : 'R';
  const axisUnit = unit === 'money' ? journal.currency : unit === 'percent' ? '%' : 'R';
  const host = useRef<HTMLDivElement>(null),
    chart = useRef<EChartsType>();
  const [failed, setFailed] = useState(false);
  const [tableOpen, setTableOpen] = useState(false),
    [tablePage, setTablePage] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    const instance = init(host.current);
    chart.current = instance;
    const labels = new Map<string, string>();
    const dateLabel = (time: string) => {
      let label = labels.get(time);
      if (label === undefined) {
        label = formatDate(time, journal.timezone);
        labels.set(time, label);
      }
      return label;
    };
    try {
      instance.setOption({
        animation: false,
        aria: { enabled: true },
        color: ['#2baf83', '#c49638'],
        legend: { textStyle: { color: '#8999ad' }, data: [vi.shell.actual, vi.shell.shadow] },
        grid: { left: 80, right: 25, top: 52, bottom: 65 },
        tooltip: {
          trigger: 'axis',
          renderMode: 'richText',
          formatter: (params: unknown) => {
            const ps = params as { dataIndex: number }[];
            const p = curve[ps[0]?.dataIndex];
            return p
              ? `${formatDate(p.time, journal.timezone)}\n${vi.shell.tradeId}: ${p.tradeId}\n${vi.shell.actual}: ${formatValue(p.net, kind, journal.currency)}\n${vi.shell.shadow}: ${formatValue(p.shadow, kind, journal.currency)}`
              : '';
          },
        },
        xAxis: {
          type: 'category',
          data: curve.map((p) => dateLabel(p.time)),
          axisLabel: { hideOverlap: true, color: '#8999ad' },
        },
        yAxis: {
          type: 'value',
          name: axisUnit,
          axisLabel: { color: '#8999ad' },
          splitLine: { lineStyle: { color: '#8999ad33' } },
        },
        dataZoom: curve.length > 100 ? [{ type: 'inside' }, { type: 'slider' }] : [],
        series: [
          {
            name: vi.shell.actual,
            type: 'line',
            showSymbol: curve.length < 50,
            connectNulls: false,
            data: curve.map((p) => (p.net === null ? null : Number(p.net))),
          },
          {
            name: vi.shell.shadow,
            type: 'line',
            showSymbol: false,
            connectNulls: false,
            lineStyle: { type: 'dashed' },
            data: curve.map((p) => (p.shadow === null ? null : Number(p.shadow))),
          },
        ],
      });
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, [curve, journal, kind, axisUnit]);
  function download() {
    const href = chart.current?.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#111821',
    });
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.download = 'tuan-trader-equity.png';
      a.click();
    }
  }
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">
            n={curve.length} · {journal.isDemo ? vi.shell.demo : ''}
          </span>
          <h2>{vi.shell.chart}</h2>
        </div>
        <button onClick={download} disabled={!curve.length}>
          {vi.shell.png}
        </button>
      </div>
      <p>{vi.shell.chartNote}</p>
      {unit === 'percent' && (
        <p>
          Tỷ lệ Net giao dịch / vốn đầu kỳ. TWR có điều chỉnh nạp/rút xem tại Cài đặt → Vốn và
          nạp/rút.
        </p>
      )}
      <p className="muted">
        {vi.shell.chartUnit}: {axisUnit}
      </p>
      {failed && <p role="alert">{vi.shell.errorTitle}</p>}
      <div className="chips" role="group" aria-label={vi.shell.chartUnit}>
        {(['money', 'percent', 'R'] as const).map((v) => (
          <button key={v} aria-pressed={unit === v} onClick={() => setUnit(v)}>
            {v === 'money' ? vi.shell.money : v === 'percent' ? vi.shell.percent : vi.shell.r}
          </button>
        ))}
      </div>
      {curve.length > 0 && curve.every((p) => p.net === null) && <p>{vi.shell.unknown}</p>}
      <div className="chart" ref={host} role="img" aria-label={vi.shell.chart} />
      <details onToggle={(e) => setTableOpen(e.currentTarget.open)}>
        <summary>{vi.shell.table}</summary>
        {tableOpen && (
          <>
            <div className="table-scroll">
              <table>
                <caption>{vi.shell.chart}</caption>
                <thead>
                  <tr>
                    <th>{vi.shell.chartDate}</th>
                    <th>{vi.shell.tradeId}</th>
                    <th>{vi.shell.actual}</th>
                    <th>{vi.shell.shadow}</th>
                  </tr>
                </thead>
                <tbody>
                  {curve.slice(tablePage * 100, (tablePage + 1) * 100).map((p, i) => (
                    <tr key={i}>
                      <td>{formatDate(p.time, journal.timezone)}</td>
                      <td>{p.tradeId}</td>
                      <td>{formatValue(p.net, kind, journal.currency, true)}</td>
                      <td>{formatValue(p.shadow, kind, journal.currency, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <button disabled={tablePage === 0} onClick={() => setTablePage(tablePage - 1)}>
                100 điểm trước
              </button>
              <span>
                {tablePage * 100 + 1}–{Math.min(curve.length, (tablePage + 1) * 100)}/{curve.length}
              </span>
              <button
                disabled={(tablePage + 1) * 100 >= curve.length}
                onClick={() => setTablePage(tablePage + 1)}
              >
                100 điểm tiếp
              </button>
            </div>
          </>
        )}
      </details>
    </section>
  );
}
