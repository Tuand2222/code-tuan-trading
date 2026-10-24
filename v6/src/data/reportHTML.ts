import type { Journal, Trade } from './schema';
import { analyze, type Scope } from '../core/analyze';
import { formatValue, type FormatKind } from '../ui/format';
import vi from '../i18n/vi.json';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function reportHTML(journal: Journal, trades: Trade[], scope: Scope = {}) {
  const r = analyze(journal, trades, scope);
  const periodTable = (title: string, rows: { label: string; net: string | null }[]) =>
    '<h2>' +
    esc(title) +
    '</h2><table><tr><th>Kỳ</th><th>Net</th></tr>' +
    rows
      .map(
        (row) =>
          '<tr><td>' +
          esc(row.label) +
          '</td><td>' +
          esc(formatValue(row.net, 'money', journal.currency)) +
          '</td></tr>',
      )
      .join('') +
    '</table>';
  const metrics =
    '<h2>24 chỉ số · cùng lõi tính toán</h2><table><tr><th>Chỉ số</th><th>Giá trị</th><th>n/N</th></tr>' +
    Object.entries(r.metrics)
      .map(
        ([id, m]) =>
          '<tr><td>' +
          esc(vi.metricLabels[id as keyof typeof vi.metricLabels]) +
          '</td><td>' +
          esc(
            formatValue(
              m.value,
              vi.metricHelp[id as keyof typeof vi.metricHelp].kind as FormatKind,
              journal.currency,
              false,
              journal.settings.holdingUnit,
            ),
          ) +
          '</td><td>' +
          m.n +
          '/' +
          m.of +
          '</td></tr>',
      )
      .join('') +
    '</table>';
  return (
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Báo cáo giao dịch</title><style>body{font:16px system-ui;max-width:900px;margin:32px auto;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}@media print{body{margin:0}tr{break-inside:avoid}}</style><h1>Báo cáo giao dịch</h1><p>Tiền tệ: ' +
    esc(journal.currency) +
    ' · ' +
    (journal.isDemo ? 'DỮ LIỆU MINH HỌA' : 'Dữ liệu người dùng') +
    '</p><p>Phạm vi: ' +
    esc(scope.from ?? 'đầu sổ') +
    ' → ' +
    esc(scope.to ?? 'cuối sổ') +
    '</p><p>Net: ' +
    esc(formatValue(r.metrics.net.value, 'money', journal.currency)) +
    ' · n=' +
    r.closed.length +
    '</p><h2>Theo ngày</h2><table><tr><th>Ngày</th><th>Net</th></tr>' +
    r.days
      .map(
        (d) =>
          '<tr><td>' +
          esc(d.date) +
          '</td><td>' +
          esc(formatValue(d.net, 'money', journal.currency)) +
          '</td></tr>',
      )
      .join('') +
    '</table>' +
    periodTable('Theo tuần', r.weeks) +
    periodTable('Theo tháng', r.months) +
    metrics +
    '<p>Chỉ phản ánh dữ liệu đã nhập, không phải khuyến nghị hoặc cam kết lợi nhuận. Không gồm ghi chú và định danh lệnh.</p></html>'
  );
}
