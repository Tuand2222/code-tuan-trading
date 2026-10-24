import { test, expect, type Page } from '@playwright/test';
const sample = {
  id: 'qa-preserved',
  date: '2026-10-01',
  symbol: 'RESTORE_QA',
  side: 'Buy',
  session: 'Châu Á',
  setup: 'QA',
  timeframe: 'D1',
  risk: 100,
  pnl: 200,
  discipline: 75,
  psychology: 'QA',
  note: 'Keep original note',
  durationMin: 60,
  market: 'Chứng khoán',
  source: 'QA',
  fees: 5,
};
async function cloud(page: Page, trades: unknown[] = []) {
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: null }));
  await page.route('**/api/site-session', (r) => r.fulfill({ json: { user: { id: 'qa-owner' } } }));
  await page.route('**/api/trades', (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ json: { trades } })
      : r.fulfill({ status: 500, json: { error: 'Unexpected write' } }),
  );
  await page.route('**/api/connections', (r) => r.fulfill({ json: { connections: [] } }));
  await page.route('**/api/trade-images', (r) => r.fulfill({ json: { images: [] } }));
}
test('restored original exposes every broker and opens API, bridge and webhook configuration', async ({
  page,
}) => {
  await cloud(page);
  await page.route('**/api/connections', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ json: { webhookToken: 'qa-placeholder-token' } })
      : r.fulfill({ json: { connections: [] } }),
  );
  await page.goto('/classic#connections');
  for (const name of [
    'VPS',
    'SSI FastConnect',
    'TCX / TCBS',
    'MetaTrader 5',
    'CQG',
    'Binance',
    'Bybit',
    'TradingView',
    'Broker chứng khoán VN',
    'Auto Import Hub',
  ])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const binance = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Binance', exact: true }) });
  await binance.getByRole('button', { name: 'Kết nối', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Binance', exact: true })).toBeVisible();
  await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
  await expect(page.getByLabel('API secret', { exact: true })).toBeVisible();
  await page.getByLabel('Đóng', { exact: true }).click();
  await page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'VPS', exact: true }) })
    .getByRole('button', { name: 'Kết nối', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'VPS', exact: true })).toContainText('Push 24/7');
  await page.getByRole('button', { name: 'Tạo kết nối & token', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    new URL('/api/import/webhook', page.url()).href,
  );
  await page.getByLabel('Đóng', { exact: true }).click();
  await expect(page.getByLabel('Bật tự đồng bộ 15 phút trong phiên này')).not.toBeChecked();
});
test('empty cloud preserves the existing device journal across reload and performs no trade writes on mount', async ({
  page,
}) => {
  await cloud(page);
  let writes = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/trades') && r.method() !== 'GET') writes++;
  });
  await page.addInitScript((trade) => {
    localStorage.setItem('tuan-trader-trades:qa-owner', JSON.stringify([trade]));
    localStorage.setItem('tuan-trader-demo-mode-v1:qa-owner', 'false');
  }, sample);
  await page.goto('/classic#journal');
  await expect(page.locator('tbody tr').filter({ hasText: 'RESTORE_QA' })).toBeVisible();
  await expect(page.getByText('Trên thiết bị · cloud trống', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.locator('tbody tr').filter({ hasText: 'RESTORE_QA' })).toBeVisible();
  expect(writes).toBe(0);
});
function pdf(text: string) {
  const content = `BT /F1 12 Tf 20 80 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1400 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
test('imports a real PDF through the packaged PDF worker and only previews until confirmation', async ({
  page,
}) => {
  await cloud(page);
  await page.goto('/classic#journal');
  const input = page.locator('input[type=file][accept*=".pdf"]');
  await input.setInputFiles({
    name: 'qa-binance.pdf',
    mimeType: 'application/pdf',
    buffer: pdf('BTCUSDT Cross Long 10 12 0 2 4 2026-10-01 09:00:00 2026-10-01 10:00:00 Closed'),
  });
  await expect(page.getByText('1 giao dịch hợp lệ', { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('.binance-preview-panel')).toContainText('BTCUSDT');
  await expect(page.getByRole('button', { name: 'Thêm 1 giao dịch', exact: true })).toBeDisabled();
  await page.getByLabel('Tỷ giá nhập về VNĐ', { exact: true }).fill('25000');
  await expect(page.getByRole('button', { name: 'Thêm 1 giao dịch', exact: true })).toBeEnabled();
});
test('restored multi-account importer retains its account, history, mapping and health tools', async ({
  page,
}) => {
  await cloud(page);
  await page.goto('/legacy#connections');
  for (const name of [
    'Nguồn dữ liệu',
    'Tài khoản',
    'Lịch sử nhập',
    'Mẫu ánh xạ',
    'Sức khỏe dữ liệu',
  ])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Kết nối API sàn và đồng bộ', exact: true }),
  ).toHaveAttribute('href', '/classic#connections');
});
test('original reporting, system, valuation, notes and settings screens remain reachable with Excel and backups', async ({
  page,
}) => {
  await cloud(page, [sample]);
  await page.goto('/classic#journal');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất báo cáo Excel', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  for (const view of ['statistics', 'system-tracker', 'valuation', 'notes', 'settings']) {
    await page.goto('/classic#' + view);
    await expect(page.locator('main h1')).not.toBeEmpty();
  }
  await expect(page.getByRole('button', { name: 'Xuất bản sao JSON', exact: true })).toBeVisible();
});
