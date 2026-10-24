import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
async function seed(page: Page) {
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
}
test('FIFO mapping, exact fees, duplicate import and rollback survive reload', async ({ page }) => {
  await seed(page);
  await page.goto('/#settings');
  const create = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Tạo sổ giao dịch', exact: true }) });
  await create.getByLabel('Tên sổ', { exact: true }).fill('FIFO USDT');
  await create.getByLabel('Đơn vị tiền của sổ', { exact: true }).selectOption('USDT');
  await create.getByRole('button', { name: 'Tạo sổ giao dịch', exact: true }).click();
  await expect(page).toHaveURL(/#evidence/);
  const id = await page.getByLabel('Sổ nhật ký', { exact: true }).inputValue();
  await page.goto('/#settings?journal=' + encodeURIComponent(id));
  const csv =
    'Trade ID,Symbol,Date(UTC),Side,Price,Quantity,Fee,Fee Coin\n9,BTCUSDT,2026-01-01 01:00:00,BUY,10,2,0.2,USDT\n10,BTCUSDT,2026-01-02 01:00:00,SELL,15,1,0.1,USDT';
  const upload = async () => {
    await page
      .getByLabel('File CSV khớp lệnh', { exact: true })
      .setInputFiles({ name: 'fills.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page
      .getByLabel('Tôi xác nhận các khoản phí/funding/swap/thuế/khác không có cột đều bằng 0.')
      .check();
    await page.getByRole('button', { name: 'Xem trước FIFO', exact: true }).click();
  };
  await upload();
  await expect(page.getByText(/Tổng FIFO sau nhập/)).toContainText('4.80');
  await page.getByLabel('Tôi đã đối chiếu cột, tiền tệ, khối lượng và các lệnh xem trước.').check();
  await page.getByRole('button', { name: 'Xác nhận nhập FIFO', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã nhập FIFO.');
  await page.reload();
  await upload();
  await expect(page.getByText('0 khớp mới · 2 trùng bỏ qua · 0 lỗi.')).toBeVisible();
  await page.getByText(/fills.csv · 2 mới/).click();
  await page.getByRole('button', { name: 'Hoàn tác FIFO fills.csv', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã hoàn tác FIFO.');
  await page.goto('/#evidence?journal=' + encodeURIComponent(id));
  await expect(page.locator('[data-trade-id]')).toHaveCount(0);
});
test('global quant units persist while legacy cash dashboards are removed', async ({ page }) => {
  await seed(page);
  await page.goto('/#overview');
  await page.getByRole('button', { name: '⚙ Cài đặt V6', exact: true }).click();
  await page.getByLabel('Đơn vị toàn trang', { exact: true }).selectOption('money');
  await page.reload();
  await page.getByRole('button', { name: '⚙ Cài đặt V6', exact: true }).click();
  await expect(page.getByLabel('Đơn vị toàn trang', { exact: true })).toHaveValue('money');
  await page.goto('/#workspace');
  await expect(page.getByRole('link', { name: 'Mở chức năng tại Classic ↗' })).toHaveAttribute(
    'href',
    '/classic#analytics',
  );
  await expect(page.getByTestId('kpi-card')).toHaveCount(0);
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await expect(page.getByTestId('source-reconciliation')).toContainText('+3.302.290 đ');
});

test('planned images, explicit missed R and transfer to real journal preserve the plan', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/#advanced');
  await page.getByLabel('Mã kế hoạch', { exact: true }).fill('PLAN');
  await page.getByLabel('Giá vào kế hoạch', { exact: true }).fill('100');
  await page.getByLabel('SL kế hoạch mới', { exact: true }).fill('90');
  await page.getByLabel('TP kế hoạch mới', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Lưu planned trade', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu kế hoạch.' })).toBeVisible();
  await page.getByText('Ảnh kế hoạch · 0/6', { exact: true }).click();
  const png = await page.screenshot();
  await page
    .getByLabel('Ảnh kế hoạch trên máy', { exact: true })
    .setInputFiles({ name: 'planned.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu ảnh kế hoạch.' })).toBeVisible();
  await page.getByLabel('Trạng thái kế hoạch', { exact: true }).selectOption('missed');
  await page.getByLabel('R giả định kế hoạch · không cộng ledger', { exact: true }).fill('2');
  await page.getByLabel('R giả định kế hoạch · không cộng ledger', { exact: true }).blur();
  await expect(page.getByText(/Missed: 2 R GIẢ ĐỊNH/)).toBeVisible();
  await page.getByLabel('Lọc Chartbook', { exact: true }).selectOption('missed');
  await expect(page.getByRole('img', { name: 'planned.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chuyển thành lệnh thực · PLAN', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Giá vào', { exact: true })).toHaveValue('100');
  await dialog.getByLabel('Khối lượng', { exact: true }).fill('10');
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /PLAN · .* · taken/ })).toBeVisible();
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]').filter({ hasText: 'PLAN' })).toHaveCount(1);
});
test('valuation runs inside the consolidated app with accessible local interface', async ({
  page,
}) => {
  await seed(page);
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(new URL(page.url()).origin) && /^https?:/.test(r.url()))
      external.push(r.url());
  });
  await page.goto('/#valuation');
  await expect(page.locator('.vlab-shell')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mở chức năng tại Classic ↗' })).toHaveAttribute(
    'href',
    '/classic#valuation',
  );
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
