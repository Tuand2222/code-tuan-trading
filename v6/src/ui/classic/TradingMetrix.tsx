'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import EquityTimeChart, {
  type EquityChartPoint,
  type EquityReferenceLine,
} from './EquityTimeChart';
import { useLedger } from './LedgerContext';
import { classicReport } from '../../core/classic';
import { normalizeNumericInput, selectNumericInput } from './numeric-input';

const VND = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function cash(value: number) {
  return VND.format(Math.round(value));
}

function compactCash(value: number | null) {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)} tỷ`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)} tr`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute)}`;
}

function percent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function positivePercent(value: string, fallback: number) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

function ObjectiveCard({
  label,
  value,
  detail,
  progress,
  state,
  usage = false,
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  state: 'passed' | 'safe' | 'warning' | 'failed' | 'pending';
  usage?: boolean;
}) {
  const stateText =
    state === 'passed'
      ? 'Hoàn thành'
      : state === 'safe'
        ? 'An toàn'
        : state === 'warning'
          ? 'Cần chú ý'
          : state === 'failed'
            ? 'Vi phạm'
            : 'Đang thực hiện';
  return (
    <article className={`metrix-objective ${state}`}>
      <div className="metrix-objective-head">
        <span>{label}</span>
        <i aria-label={stateText}>
          {state === 'passed' || state === 'safe' ? '✓' : state === 'failed' ? '!' : '•'}
        </i>
      </div>
      <strong>{value}</strong>
      <div className="metrix-progress">
        <b style={{ width: `${clamp(progress)}%` }} />
      </div>
      <div className="metrix-objective-foot">
        <small>{detail}</small>
        <em>{usage ? `${clamp(progress).toFixed(0)}% đã dùng` : stateText}</em>
      </div>
    </article>
  );
}

export default function TradingMetrix() {
  const { derived, filters } = useLedger();
  const [initialCapitalInput, setInitialCapitalInput] = useState('200000000');
  const [profitTargetInput, setProfitTargetInput] = useState('10');
  const [maxDailyLossInput, setMaxDailyLossInput] = useState('5');
  const [maxLossInput, setMaxLossInput] = useState('10');
  const [dailyPage, setDailyPage] = useState(0);
  const initialCapital = Math.max(10_000_000, Number(initialCapitalInput) || 10_000_000);

  const rules = {
    target: positivePercent(profitTargetInput, 10),
    daily: positivePercent(maxDailyLossInput, 5),
    maximum: positivePercent(maxLossInput, 10),
  };

  const report = useMemo(
    () => classicReport(derived!.result, filters, initialCapital, rules.daily, rules.maximum),
    [derived, filters, initialCapital, rules.daily, rules.maximum],
  );
  const targetAmount = (initialCapital * rules.target) / 100;
  const profitProgress = targetAmount ? (report.net / targetAmount) * 100 : 0;
  const dailyUsage = report.dailyLimitAmount
    ? (report.worstDailyDrawdown / report.dailyLimitAmount) * 100
    : 0;
  const maximumUsage = report.maximumAmount ? (report.maxLossUsed / report.maximumAmount) * 100 : 0;

  const returnPercent = initialCapital ? (report.net / initialCapital) * 100 : 0;
  const sourceCount = new Set(report.ordered.map((trade) => trade.platform)).size;
  const firstDate = report.rows.at(0)?.date;
  const lastDate = report.rows.at(-1)?.date;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(report.rows.length / pageSize));
  const safePage = Math.min(dailyPage, pageCount - 1);
  const pageRows = [...report.rows].reverse().slice(safePage * pageSize, (safePage + 1) * pageSize);

  const equityPoints = useMemo(
    () =>
      report.rows.map<EquityChartPoint>((row) => ({
        date: row.date,
        money: row.endBalance,
        percent: ((row.endBalance - initialCapital) / Math.max(initialCapital, 1)) * 100,
      })),
    [initialCapital, report.rows],
  );

  const equityReferences = useMemo<EquityReferenceLine[]>(
    () => [
      {
        label: 'Mục tiêu',
        money: initialCapital + targetAmount,
        percent: rules.target,
        color: 'rgba(52,215,139,.72)',
      },
      {
        label: 'Vốn đầu',
        money: initialCapital,
        percent: 0,
        color: 'rgba(191,202,216,.36)',
        style: 'dotted',
      },
      {
        label: 'Giới hạn',
        money: report.currentMaxLossLimit,
        percent: -rules.maximum,
        color: 'rgba(255,85,116,.68)',
      },
    ],
    [initialCapital, report.currentMaxLossLimit, rules.maximum, rules.target, targetAmount],
  );

  const advancedStats = [
    ...report.stats,
    [
      'Độ nhất quán',
      report.consistency === undefined ? '—' : (report.consistency ?? 0).toFixed(0) + '%',
    ],
  ];
  if (!report.complete)
    return (
      <section className="hub-notice" role="status">
        Chưa thể tính Balance và giới hạn rủi ro vì phạm vi có dữ liệu Net chưa xác định. Kiểm tra
        tab Sức khỏe dữ liệu.
      </section>
    );

  return (
    <div className="metrix-shell">
      <section className="metrix-controlbar">
        <div>
          <span className="metrix-kicker">
            <i /> TUAN TRADING METRIX
          </span>
          <h2>Đánh giá hiệu suất & giới hạn rủi ro</h2>
          <p>
            Dùng chung sổ đang chọn và bộ lọc với Nhật ký. Balance tính theo từng sự kiện đã thực
            hiện, gồm chốt từng phần.
          </p>
        </div>
        <div className="metrix-controls">
          <label>
            <span>Vốn khởi điểm</span>
            <input
              type="number"
              min="10000000"
              step="10000000"
              value={initialCapitalInput}
              onFocus={selectNumericInput}
              onChange={(event) =>
                setInitialCapitalInput(normalizeNumericInput(event.target.value))
              }
              onBlur={() => setInitialCapitalInput(String(initialCapital))}
            />
          </label>
          <label>
            <span>Mục tiêu lợi nhuận (%)</span>
            <input
              aria-label="Mục tiêu lợi nhuận phần trăm"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              inputMode="decimal"
              value={profitTargetInput}
              onFocus={selectNumericInput}
              onChange={(event) => setProfitTargetInput(normalizeNumericInput(event.target.value))}
              onBlur={() => setProfitTargetInput(String(rules.target))}
            />
          </label>
          <label>
            <span>Max Daily Loss (%)</span>
            <input
              aria-label="Max Daily Loss phần trăm"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              inputMode="decimal"
              value={maxDailyLossInput}
              onFocus={selectNumericInput}
              onChange={(event) => setMaxDailyLossInput(normalizeNumericInput(event.target.value))}
              onBlur={() => setMaxDailyLossInput(String(rules.daily))}
            />
          </label>
          <label>
            <span>Max Loss (%)</span>
            <input
              aria-label="Max Loss phần trăm"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              inputMode="decimal"
              value={maxLossInput}
              onFocus={selectNumericInput}
              onChange={(event) => setMaxLossInput(normalizeNumericInput(event.target.value))}
              onBlur={() => setMaxLossInput(String(rules.maximum))}
            />
          </label>
        </div>
      </section>

      <p className="panel-copy">
        R: {report.riskCount}/{report.ordered.length} lệnh có rủi ro hợp lệ · Kỷ luật:{' '}
        {report.reviewedCount}/{report.ordered.length} lệnh đã review. Giới hạn dựa trên vốn mô
        phỏng, chưa gồm P/L đang mở.
      </p>
      <section className="metrix-account-strip">
        <div>
          <span>Ngày giao dịch</span>
          <strong>{report.rows.length} ngày</strong>
          <small>Tự động đếm từ nhật ký</small>
        </div>
        <div>
          <span>Vốn mô phỏng</span>
          <strong>{cash(initialCapital)}</strong>
          <small>Tiền tệ: VND</small>
        </div>
        <div>
          <span>Nguồn dữ liệu</span>
          <strong>{sourceCount} nhóm bản ghi</strong>
          <small>{report.ordered.length} giao dịch đã đóng</small>
        </div>
        <div>
          <span>Khoảng đánh giá</span>
          <strong>{firstDate ? DATE.format(new Date(`${firstDate}T12:00:00`)) : '—'}</strong>
          <small>
            {lastDate ? `đến ${DATE.format(new Date(`${lastDate}T12:00:00`))}` : 'Chưa có dữ liệu'}
          </small>
        </div>
        <div
          className={`metrix-evaluation ${report.anyDailyBreach || report.anyMaximumBreach ? 'failed' : 'active'}`}
        >
          <span>Trạng thái</span>
          <strong>
            {report.anyDailyBreach || report.anyMaximumBreach
              ? 'Cần kiểm tra'
              : profitProgress >= 100
                ? 'Đạt mục tiêu'
                : 'Đang đánh giá'}
          </strong>
          <small>
            <i /> Cập nhật theo journal
          </small>
        </div>
      </section>

      <section className="metrix-balance-grid">
        <article>
          <span>Balance</span>
          <strong>{cash(report.balance)}</strong>
          <small className={report.net >= 0 ? 'positive-text' : 'negative-text'}>
            {percent(returnPercent)} từ ban đầu
          </small>
        </article>
        <article>
          <span>Equity ghi nhận</span>
          <strong>{cash(report.balance)}</strong>
          <small>Không gồm vị thế đang mở</small>
        </article>
        <article>
          <span>Lãi / lỗ ròng</span>
          <strong className={report.net >= 0 ? 'positive-text' : 'negative-text'}>
            {compactCash(report.net)}
          </strong>
          <small>Đã đóng · sau phí đã nhập</small>
        </article>
        <article>
          <span>Biên an toàn còn lại</span>
          <strong>{cash(Math.max(0, report.balance - report.currentMaxLossLimit))}</strong>
          <small>So với giới hạn lỗ hiện tại</small>
        </article>
      </section>

      <section className="metrix-section">
        <div className="metrix-section-title">
          <div>
            <span>TRADING OBJECTIVES</span>
            <h3>Mục tiêu giao dịch</h3>
          </div>
          <small>Ba ngưỡng do bạn thiết lập · số ngày tự động cập nhật</small>
        </div>
        <div className="metrix-objectives">
          <ObjectiveCard
            label="Profit Target"
            value={`${compactCash(report.net)} / ${compactCash(targetAmount)}`}
            detail={`Mục tiêu ${rules.target}% vốn khởi điểm`}
            progress={profitProgress}
            state={profitProgress >= 100 ? 'passed' : report.net < 0 ? 'warning' : 'pending'}
          />
          <ObjectiveCard
            label="Maximum Daily Loss"
            value={`${compactCash(-report.worstDailyDrawdown)} / ${compactCash(-report.dailyLimitAmount)}`}
            detail={`Giới hạn ${rules.daily}% vốn ban đầu`}
            progress={dailyUsage}
            state={report.anyDailyBreach ? 'failed' : dailyUsage >= 75 ? 'warning' : 'safe'}
            usage
          />
          <ObjectiveCard
            label="Maximum Loss"
            value={`${compactCash(-report.maxLossUsed)} / ${compactCash(-report.maximumAmount)}`}
            detail={`Cố định · ${rules.maximum}% vốn khởi điểm`}
            progress={maximumUsage}
            state={report.anyMaximumBreach ? 'failed' : maximumUsage >= 75 ? 'warning' : 'safe'}
            usage
          />
          <article className="metrix-objective safe">
            <div className="metrix-objective-head">
              <span>Trading Days</span>
              <i aria-label="Tự động cập nhật">↻</i>
            </div>
            <strong>{report.rows.length} ngày</strong>
            <div className="metrix-progress">
              <b style={{ width: '100%' }} />
            </div>
            <div className="metrix-objective-foot">
              <small>Ngày có sự kiện tài chính</small>
              <em>{report.ordered.length} lệnh · tự động</em>
            </div>
          </article>
        </div>
      </section>

      <section className="metrix-main-grid">
        <article className="metrix-panel metrix-chart-panel">
          <div className="metrix-panel-head">
            <div>
              <span>ACCOUNT EQUITY</span>
              <h3>Đường cong Balance</h3>
            </div>
            <small>Trục kép · số dư đã thực hiện</small>
          </div>
          <div className="metrix-chart-summary">
            <span>
              Hiện tại{' '}
              <strong>
                {cash(report.balance)} · {percent(returnPercent)}
              </strong>
            </span>
            <span className="target">
              Mục tiêu{' '}
              <strong>
                {cash(initialCapital + targetAmount)} · +{rules.target}%
              </strong>
            </span>
            <span className="limit">
              Giới hạn{' '}
              <strong>
                {cash(report.currentMaxLossLimit)} · −{rules.maximum}%
              </strong>
            </span>
          </div>
          <EquityTimeChart
            points={equityPoints}
            references={equityReferences}
            ariaLabel="Account Equity theo thời gian với phần trăm bên trái và số tiền bên phải"
            percentLabel="Lợi nhuận (%)"
            moneyLabel="Balance (VND)"
          />
        </article>

        <aside className="metrix-panel metrix-risk-panel">
          <div className="metrix-panel-head">
            <div>
              <span>RISK MONITOR</span>
              <h3>Sức khỏe rủi ro</h3>
            </div>
            <b className={report.anyDailyBreach || report.anyMaximumBreach ? 'failed' : 'safe'}>
              {report.anyDailyBreach || report.anyMaximumBreach ? 'REVIEW' : 'SAFE'}
            </b>
          </div>
          <div
            className="metrix-risk-gauge"
            style={
              { '--risk': `${clamp(Math.max(dailyUsage, maximumUsage)) * 2.7}deg` } as CSSProperties
            }
          >
            <div>
              <strong>{Math.max(dailyUsage, maximumUsage).toFixed(0)}%</strong>
              <span>mức dùng cao nhất</span>
            </div>
          </div>
          <div className="metrix-risk-lines">
            <div>
              <span>Daily loss còn lại</span>
              <strong>
                {cash(Math.max(0, report.dailyLimitAmount - report.worstDailyDrawdown))}
              </strong>
            </div>
            <div>
              <span>Max loss còn lại</span>
              <strong>{cash(Math.max(0, report.maximumAmount - report.maxLossUsed))}</strong>
            </div>
            <div>
              <span>Max drawdown thực tế</span>
              <strong className="negative-text">{compactCash(-report.maximumDrawdown)}</strong>
            </div>
            <div>
              <span>Độ nhất quán</span>
              <strong>{(report.consistency ?? 0).toFixed(0)}%</strong>
            </div>
          </div>
          <p>
            Giới hạn được ước tính từ các lệnh đã đóng. Equity thời gian thực và P/L vị thế mở cần
            dữ liệu live từ broker.
          </p>
        </aside>
      </section>

      <section className="metrix-lower-grid">
        <article className="metrix-panel metrix-stats-panel">
          <div className="metrix-panel-head">
            <div>
              <span>DETAILED STATISTICS</span>
              <h3>Thống kê chuyên sâu</h3>
            </div>
            <small>{report.rows.length} ngày giao dịch</small>
          </div>
          <div className="metrix-stat-list">
            {advancedStats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="metrix-panel metrix-symbol-panel">
          <div className="metrix-panel-head">
            <div>
              <span>INSTRUMENT ANALYSIS</span>
              <h3>Hiệu suất theo sản phẩm</h3>
            </div>
            <small>Top {Math.min(report.symbols.length, 8)}</small>
          </div>
          <div className="metrix-symbol-list">
            {report.symbols.slice(0, 8).map((item, index) => {
              const maximum = Math.max(...report.symbols.map((symbol) => Math.abs(symbol.pnl)), 1);
              return (
                <div key={item.symbol}>
                  <span className="metrix-symbol-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <div>
                      <strong>{item.symbol}</strong>
                      <small>
                        {item.trades} lệnh · {((item.wins / item.trades) * 100).toFixed(0)}% thắng
                      </small>
                    </div>
                    <i>
                      <b
                        className={item.pnl >= 0 ? 'up' : 'down'}
                        style={{ width: `${Math.max(5, (Math.abs(item.pnl) / maximum) * 100)}%` }}
                      />
                    </i>
                  </div>
                  <strong className={item.pnl >= 0 ? 'positive-text' : 'negative-text'}>
                    {compactCash(item.pnl)}
                  </strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="metrix-panel metrix-daily-panel">
        <div className="metrix-panel-head">
          <div>
            <span>DAILY SUMMARY</span>
            <h3>Kết quả theo ngày</h3>
          </div>
          <div className="metrix-daily-summary">
            <span>
              Ngày tốt nhất <strong className="positive-text">{compactCash(report.bestDay)}</strong>
            </span>
            <span>
              Tổng ngày xanh{' '}
              <strong>{report.rows.filter((row) => row.pnl !== null && row.pnl > 0).length}</strong>
            </span>
          </div>
        </div>
        <div className="metrix-table-wrap">
          <table className="metrix-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giao dịch</th>
                <th>Mua / Bán</th>
                <th>Rủi ro</th>
                <th>Phí</th>
                <th>Kết quả ngày</th>
                <th>Balance cuối ngày</th>
                <th>Daily loss dùng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const usage = report.dailyLimitAmount
                  ? (row.dailyDrawdown / report.dailyLimitAmount) * 100
                  : 0;
                return (
                  <tr key={row.date}>
                    <td>
                      <strong>{DATE.format(new Date(`${row.date}T12:00:00`))}</strong>
                    </td>
                    <td>{row.trades}</td>
                    <td>
                      <span className="metrix-side buy">{row.buys} B</span>
                      <span className="metrix-side sell">{row.sells} S</span>
                    </td>
                    <td>
                      {row.riskCount ? compactCash(row.risk) : '—'}
                      <small>
                        {' '}
                        ({row.riskCount}/{row.trades})
                      </small>
                    </td>
                    <td>{row.fees === undefined ? '—' : compactCash(-row.fees)}</td>
                    <td
                      className={
                        row.pnl === null
                          ? undefined
                          : row.pnl >= 0
                            ? 'positive-text'
                            : 'negative-text'
                      }
                    >
                      {compactCash(row.pnl)}
                    </td>
                    <td>{cash(row.endBalance)}</td>
                    <td>
                      <div className="metrix-mini-progress">
                        <i>
                          <b
                            className={usage >= 75 ? 'warn' : ''}
                            style={{ width: `${clamp(usage)}%` }}
                          />
                        </i>
                        <span>{usage.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`metrix-day-status ${usage > 100 || row.lowestBalance < row.maxLossLimit ? 'failed' : 'ok'}`}
                      >
                        {usage > 100 || row.lowestBalance < row.maxLossLimit ? 'Vi phạm' : 'Đạt'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="metrix-pagination">
          <span>
            Hiển thị {pageRows.length} / {report.rows.length} ngày
          </span>
          <div>
            <button
              disabled={safePage === 0}
              onClick={() => setDailyPage(Math.max(0, safePage - 1))}
            >
              ‹
            </button>
            <strong>
              {safePage + 1} / {pageCount}
            </strong>
            <button
              disabled={safePage >= pageCount - 1}
              onClick={() => setDailyPage(Math.min(pageCount - 1, safePage + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
