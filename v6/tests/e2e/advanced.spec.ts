import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
async function seed(page: Page) {
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await expect(
    page.getByRole('heading', { name: 'Đối chiếu bộ 30 lệnh minh họa: Đạt' }),
  ).toBeVisible();
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
}
const csv =
  'Position ID,Symbol,Position Side,Open Time,Close Time,Entry Price,Avg Close Price,Closed Quantity,Commission,Funding,Swap,Tax,Other,Closing PNL,Entry Fill ID,Exit Fill ID,Entry Fill Count,Exit Fill Count,Fee Coin\np1,BTCUSDT,LONG,2026-10-01 09:00:00,2026-10-01 10:00:00,10,12,2,0.1,-0.02,0,0,0,4,fill1,fill2,1,1,USDT';
test('S5 Binance preview/dedupe/rollback uses the canonical journal', async ({ page }) => {
  await seed(page);
  await page.goto('/#settings');
  const create = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Tạo sổ giao dịch', exact: true }) });
  await create.getByLabel('Tên sổ', { exact: true }).fill('Binance USDT');
  await create.getByLabel('Đơn vị tiền của sổ', { exact: true }).selectOption('USDT');
  await create.getByRole('button', { name: 'Tạo sổ giao dịch', exact: true }).click();
  await expect(page).toHaveURL(/#evidence/);
  const journalId = await page.getByLabel('Sổ nhật ký', { exact: true }).inputValue();
  const go = (route: string) =>
    page.goto('/#' + route + '?journal=' + encodeURIComponent(journalId));
  await go('settings');
  const section = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Binance · Position History', exact: true }),
  });
  const file = { name: 'binance-test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) };
  await section.getByLabel('CSV Binance Position History').setInputFiles(file);
  await expect(section).toContainText('3.92 USDT');
  await section.getByRole('button', { name: 'Xác nhận nhập Binance', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Đã nhập');
  await go('evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(1);
  await expect(page.locator('[data-trade-id]')).toContainText('BTCUSDT');
  await go('settings');
  await section.getByLabel('CSV Binance Position History').setInputFiles(file);
  await section.getByRole('button', { name: 'Xác nhận nhập Binance', exact: true }).click();
  await expect(section.getByRole('button', { name: /^Hoàn tác batch/ })).toHaveCount(1);
  await section.getByRole('button', { name: /^Hoàn tác batch/ }).click();
  await expect(section.getByRole('status')).toContainText('Đã hoàn tác');
  await go('evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(0);
});
test('S5 multi-leg editing preserves exact Net across partial exits and reload', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/#settings');
  const select = page.getByLabel('Lệnh nhiều khớp', { exact: true });
  const id = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(id!);
  const quantity = Number(await page.getByLabel('Khối lượng khớp 2', { exact: true }).inputValue()),
    price = await page.getByLabel('Giá khớp 2', { exact: true }).inputValue(),
    time = await page.getByLabel('Thời điểm khớp 2', { exact: true }).inputValue();
  await page.getByLabel('Khối lượng khớp 2', { exact: true }).fill(String(quantity / 2));
  await page.getByRole('button', { name: 'Thêm khớp', exact: true }).click();
  await page.getByLabel('Loại khớp 3', { exact: true }).selectOption('out');
  await page.getByLabel('Thời điểm khớp 3', { exact: true }).fill(time);
  await page.getByLabel('Giá khớp 3', { exact: true }).fill(price);
  await page.getByLabel('Khối lượng khớp 3', { exact: true }).fill(String(quantity / 2));
  await page.getByLabel('Tôi đã đối chiếu khối lượng, thời điểm và tổng phí.').check();
  await page.getByRole('button', { name: 'Lưu legs', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu legs' })).toBeVisible();
  await page.reload();
  await page.getByLabel('Lệnh nhiều khớp', { exact: true }).selectOption(id!);
  await expect(page.getByLabel('Loại khớp 3', { exact: true })).toHaveValue('out');
  await page.goto('/#evidence');
  await expect(page.getByTestId('source-reconciliation')).toContainText(
    '3.302.290',
  );
});
test('S6–S8 profile, command palette, planned trade, simulation and read-only export', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await seed(page);
  await page.goto('/#overview');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Bảng lệnh' });
  await expect(palette).toBeVisible();
  await palette.getByLabel('Tìm chức năng').fill('nâng cao');
  await palette.getByLabel('Tìm chức năng').press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Phân tích và giả định', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Số lệnh mỗi đường (50–500)').fill('50');
  await page.getByRole('button', { name: 'Chạy 1.000 đường', exact: true }).click();
  await expect(page.getByText(/GIẢ ĐỊNH · seed 2103 · 1000 đường × 50 lệnh/)).toBeVisible();
  const profile = page.getByLabel('Hồ sơ phân tích lệnh');
  const id = await profile.locator('option').nth(1).getAttribute('value');
  await profile.selectOption(id!);
  await page.getByLabel('Thống kê 1', { exact: true }).fill('sample-stat');
  await page.getByLabel('URL chart 1', { exact: true }).fill('https://example.com/chart');
  const chartImage = await page.screenshot();
  await page
    .getByLabel('Tải ảnh chart', { exact: true })
    .setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: chartImage });
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ nâng cao', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Lưu hồ sơ nâng cao', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu hồ sơ.' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'chart.png', exact: true })).toBeVisible();
  const zipDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Tải ZIP Chartbook và backup toàn bộ workspace', exact: true })
    .click();
  await (await zipDownload).saveAs(info.outputPath('chartbook.zip'));
  await page.getByLabel('Mã kế hoạch', { exact: true }).fill('TEST');
  await page.getByLabel('Giá vào kế hoạch', { exact: true }).fill('100');
  await page.getByLabel('SL kế hoạch mới', { exact: true }).fill('90');
  await page.getByLabel('TP kế hoạch mới', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Lưu planned trade', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu kế hoạch.' })).toBeVisible();
  await page.getByLabel('Trạng thái kế hoạch').selectOption('missed');
  await expect(page.getByRole('heading', { name: /TEST · .* · missed/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải báo cáo HTML để In/PDF' }).click();
  await (await download).saveAs(info.outputPath('read-only-report.html'));
  await page.reload();
  await expect(page.getByRole('heading', { name: /TEST · .* · missed/ })).toBeVisible();
  await page.getByLabel('Hồ sơ phân tích lệnh').selectOption(id!);
  await expect(page.getByLabel('Thống kê 1', { exact: true })).toHaveValue('sample-stat');
  await expect(page.getByLabel('URL chart 1', { exact: true })).toHaveValue(
    'https://example.com/chart',
  );
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath('advanced.png'), fullPage: true });
});
test('S9 encrypted backup restores with preview and offline preserves the ledger', async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  await seed(page);
  await page.goto('/#settings');
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Backup mã hóa tùy chọn', exact: true }) });
  await section.getByLabel('Mật khẩu backup', { exact: true }).fill('long-password');
  const downloading = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Xuất backup mã hóa', exact: true }).click();
  const file = info.outputPath('encrypted.json');
  await (await downloading).saveAs(file);
  await section.getByLabel('Mở backup mã hóa', { exact: true }).setInputFiles(file);
  await expect(section.getByRole('status')).toContainText('Giải mã hợp lệ: 1 sổ, 30 lệnh');
  await section.getByLabel('Tôi đã kiểm tra và muốn thay workspace bằng bản giải mã.').check();
  await section.getByRole('button', { name: 'Khôi phục bản giải mã', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Đã khôi phục bản mã hóa.');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.goto('/#evidence');
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await context.setOffline(false);
});
