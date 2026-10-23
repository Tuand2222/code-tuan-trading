import { test, expect, type Page } from '@playwright/test';
const receipt = {
  id: 'risk-qa',
  date: '2026-10-23',
  symbol: 'RISK_QA',
  side: 'Buy',
  session: 'London',
  setup: 'Trend',
  timeframe: 'H1',
  risk: 50,
  pnl: 100,
  fees: 10,
  swap: 2,
  discipline: 100,
  psychology: 'Calm',
  durationMin: 30,
  note: 'private note',
  entryPrice: 100,
  quantity: 1,
  version: 1,
};
async function device(page: Page, trades: unknown[] = [receipt]) {
  await page.route('**/api/auth/get-session**', (r) => r.fulfill({ json: null }));
  await page.route('**/api/site-session', (r) => r.fulfill({ json: { user: null } }));
  await page.route('**/api/trades**', (r) =>
    r.fulfill({ status: 401, json: { error: 'Authentication required' } }),
  );
  await page.route('**/api/connections', (r) => r.fulfill({ status: 401, json: {} }));
  await page.route('**/api/trade-images**', (r) => r.fulfill({ status: 401, json: {} }));
  await page.addInitScript((rows) => {
    localStorage.setItem('tuan-trader-trades', JSON.stringify(rows));
    localStorage.setItem('tuan-trader-demo-mode-v1', 'false');
  }, trades);
}
test('desktop cockpit reconciles Net, sizing, PDF and frozen five-sheet workbook without changing broker data', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await device(page);
  await page.goto('/classic#overview');
  await expect(page.locator('.cockpit-kpis article')).toHaveCount(6);
  await expect(page.locator('.cockpit-kpis article').first()).toContainText('88');
  await page.getByLabel('Vốn đầu kỳ (VNĐ)', { exact: true }).fill('50000');
  await expect(page.getByText('Tầng 1 · Bình thường', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('cockpit-1440.png') });
  const y = await page.locator('.recent-panel').evaluate((el) => el.getBoundingClientRect().bottom);
  expect(y).toBeLessThanOrEqual(900);
  await page.goto('/classic#risk');
  await page.getByLabel('Giá vào', { exact: true }).fill('100');
  await page.getByLabel('Giá cắt lỗ', { exact: true }).fill('95');
  await expect(page.locator('.sizing-result')).toContainText('100 đơn vị');
  await page.goto('/classic#settings');
  let pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel · 5 trang tính', exact: true }).click();
  expect((await pending).suggestedFilename()).toMatch(/^TuanNhatKy_Report_.*\.xlsx$/);
  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF · 1 trang', exact: true }).click();
  expect((await pending).suggestedFilename()).toMatch(/\.pdf$/);
});
test('notes and trade draft survive a reload after the 200ms local save', async ({ page }) => {
  await device(page);
  await page.goto('/classic#journal');
  await page.getByRole('button', { name: 'Thêm lệnh', exact: true }).click();
  const note = page.locator('.trade-modal textarea').first();
  await note.fill('Bản nháp tiếng Việt cần được giữ nguyên khi mất mạng.');
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Thêm lệnh', exact: true }).click();
  await expect(page.locator('.trade-modal textarea').first()).toHaveValue(
    'Bản nháp tiếng Việt cần được giữ nguyên khi mất mạng.',
  );
});
test('one confirmed import automatically returns an Excel reconciliation file', async ({
  page,
}) => {
  await device(page, []);
  await page.goto('/classic#journal');
  await page
    .locator('input[accept*="application/pdf"]')
    .setInputFiles({
      name: 'journal.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Date,Symbol,Side,Pnl,Fees,Risk,ExternalId,EntryPrice,Quantity\n2026-10-23,IMPORT_QA,Buy,100,10,50,execution-one,100,1',
      ),
    });
  await expect(page.getByText('1 giao dịch hợp lệ', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Thêm 1 giao dịch', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  await expect(page.locator('tbody tr').filter({ hasText: 'IMPORT_QA' })).toBeVisible();
});
test('command palette and date drill-down retain shared URL filters', async ({ page }) => {
  await device(page);
  await page.goto('/classic?q=RISK_QA#overview');
  await expect(page.getByLabel('Tìm kiếm toàn không gian')).toHaveValue('RISK_QA');
  await page.keyboard.press('Control+k');
  await page
    .getByRole('dialog', { name: 'Lệnh nhanh' })
    .getByRole('button', { name: 'Bảo vệ vốn & khối lượng', exact: true })
    .click();
  await expect(page).toHaveURL(/q=RISK_QA.*#risk/);
  await page.goto('/classic?q=RISK_QA#overview');
  await page.getByRole('button', { name: 'Ngày 2026-10-23, 1 lệnh', exact: true }).click();
  await expect(page.getByLabel('Ngày đang lọc')).toHaveValue('2026-10-23');
  await expect(page).toHaveURL(/#journal/);
});
test('360px layout keeps the demo banner and risk panels within the viewport', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 840 });
  await page.route('**/api/**', (r) => r.fulfill({ status: 401, json: { error: 'Anonymous' } }));
  await page.route('**/api/site-session', (r) => r.fulfill({ json: { user: null } }));
  await page.goto('/classic#overview');
  await expect(
    page.getByRole('heading', { name: 'Buồng lái giao dịch', exact: true }),
  ).toBeVisible();
  expect(
    await page.locator('.demo-banner').evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(361);
  await page.screenshot({ path: info.outputPath('cockpit-360.png') });
});
