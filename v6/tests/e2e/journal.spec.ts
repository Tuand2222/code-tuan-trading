import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
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
test('QT02/QT03 one ledger: add, preview, inline edit, star, review and reload reconcile to calendar', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await seed(page);
  await page.goto('/#journal');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await page
    .locator('.topbar')
    .getByRole('button', { name: 'Thêm giao dịch', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of [
    ['Mã sản phẩm', 'TEST'],
    ['Thời gian vào', '2026-10-20T09:00'],
    ['Thời gian đóng', '2026-10-20T10:00'],
    ['Giá vào', '100'],
    ['Giá ra', '110'],
    ['Khối lượng', '10'],
    ['1R ban đầu', '50'],
    ['Phí giao dịch', '2'],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog
    .getByLabel('Tôi đã xác nhận đầy đủ phí, thuế, funding/swap', { exact: true })
    .check();
  await expect(dialog.getByRole('region', { name: 'Đối chiếu trước lưu' })).toContainText('98 đ');
  await expect(dialog).toContainText('1,96R');
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-trade-id]')).toHaveCount(31);
  const row = page
    .locator('[data-trade-id]')
    .filter({ has: page.getByText('TEST', { exact: true }) });
  await expect(row).toContainText('+98 đ');
  await row.getByRole('button', { name: /Đánh dấu sao/ }).click();
  await expect(row.getByRole('button', { name: /Đánh dấu sao/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await row.getByRole('button', { name: 'Sửa nhanh', exact: true }).click();
  await dialog.getByLabel('1R ban đầu', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('0,98R');
  await row.getByRole('button', { name: 'Sửa giao dịch', exact: true }).click();
  await dialog.getByLabel('Giá ra', { exact: true }).fill('112');
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('+118 đ');
  await row.getByRole('button', { name: 'Xem lệnh', exact: true }).click();
  const chip = dialog.getByRole('button', { name: '1 · FOMO', exact: true });
  await dialog.getByLabel('Nhận xét review', { exact: true }).pressSequentially('123r');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await chip.press('1');
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.press('1');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Đánh dấu đã review', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Mở lại review', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.reload();
  await expect(row).toContainText('Đã review');
  await expect(row.getByRole('button', { name: /Đánh dấu sao/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('s3-journal.png'), fullPage: true });
  await page.goto('/#calendar');
  await page.getByLabel('Tháng', { exact: true }).fill('2026-10');
  await expect(page.getByText('Net tháng:', { exact: false })).toContainText('+1.389.748 đ');
  await page.getByRole('button', { name: 'Mở nhật ký ngày 2026-10-20', exact: true }).click();
  await expect(page.locator('[data-trade-id]')).toHaveCount(1);
  await expect(row).toContainText('+118 đ');
  await page.goto('/#settings');
  const create = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Tạo sổ giao dịch', exact: true }) });
  await create.getByLabel('Tên sổ', { exact: true }).fill('Kiểm tra USDT');
  await create.getByLabel('Đơn vị tiền của sổ', { exact: true }).selectOption('USDT');
  await create.getByRole('button', { name: 'Tạo sổ giao dịch', exact: true }).click();
  await expect(page.getByLabel('Sổ nhật ký', { exact: true })).toContainText('Kiểm tra USDT');
  await page
    .locator('.topbar')
    .getByRole('button', { name: 'Thêm giao dịch', exact: true })
    .click();
  for (const [label, value] of [
    ['Mã sản phẩm', 'BTCUSDT'],
    ['Thời gian vào', '2026-10-20T09:00'],
    ['Thời gian đóng', '2026-10-20T10:00'],
    ['Giá vào', '100'],
    ['Giá ra', '100.11'],
    ['Khối lượng', '10'],
    ['1R ban đầu', '1'],
    ['Phí giao dịch', '0.1'],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByLabel('Thị trường', { exact: true }).selectOption('crypto');
  await dialog
    .getByLabel('Tôi đã xác nhận đầy đủ phí, thuế, funding/swap', { exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Lợi nhuận ròng', exact: true })).toContainText(
    '+1.00 USDT',
  );
  await expect(page.getByRole('button', { name: 'USDT bên phải', exact: true })).toBeVisible();
});
test('S3 F01–F10, T-R1, classic modes and full restore verification preserve the 30-trade baseline', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await seed(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#overview');
  await expect(page.getByTestId('kpi-card')).toHaveCount(24);
  await expect(page.getByRole('article', { name: 'Lợi nhuận ròng', exact: true })).toContainText(
    '+3.302.290 đ',
  );
  await expect(
    page.getByRole('article', { name: 'Chuỗi hiện tại (+ thắng / − thua)', exact: true }),
  ).toContainText('lệnh thắng');
  await page.screenshot({ path: info.outputPath('s3-overview-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: info.outputPath('s3-overview-light.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/#playbook');
  await expect(
    page.getByLabel('Checklist (mỗi dòng: tiêu chí | trọng số)', { exact: true }),
  ).toHaveAttribute('placeholder', 'Đúng xu hướng | 2\nĐủ điều kiện vào lệnh | 3');
  await page.goto('/#workspace');
  await expect(page.getByTestId('kpi-card')).toHaveCount(24);
  await page.getByLabel('Đơn vị thời gian', { exact: true }).selectOption('minutes');
  await expect(
    page.getByRole('article', { name: 'Thời gian giữ lệnh (phút)', exact: true }),
  ).toContainText('234,33 phút');
  await page.goto('/#alerts');
  const mwg = page
    .getByRole('button')
    .filter({ hasText: '80cbad1d1c6f1cc27ae2b93133fd0c273295785054fd89b5fe9edb8deca97663' });
  await expect(mwg).toBeVisible();
  await mwg.click();
  await expect(page.getByRole('dialog')).toContainText('−2,35R');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.goto('/#risk');
  await expect(page.locator('.histogram > div').locator('strong')).toHaveText([
    '8',
    '4',
    '6',
    '7',
    '5',
    '0',
  ]);
  await expect(page.getByRole('img', { name: 'Sụt giảm từ đỉnh (VND)' })).toBeVisible();
  await page.goto('/#calendar');
  await page.getByLabel('Tháng', { exact: true }).fill('2026-10');
  await expect(page.getByText('Net tháng:', { exact: false })).toContainText('+1.389.630 đ');
  await page.getByText('Báo cáo tháng → tuần', { exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '2026-W42' }).last()).toContainText(
    '+143.950 đ',
  );
  await page.goto('/#metrix');
  await expect(page.getByRole('button', { name: 'Giao diện gốc', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.metrix-controlbar')).toBeVisible();
  await page.getByRole('button', { name: 'Phân tích chi tiết', exact: true }).click();
  await expect(page.getByTestId('kpi-card')).toHaveCount(24);
  await page.goto('/#system');
  await page.getByRole('button', { name: 'Giao diện gốc', exact: true }).click();
  await expect(page.locator('.system-hero')).toBeVisible();
  await expect(page.getByText('Nhập gần nhất:', { exact: false })).not.toContainText(/\dT\d/);
  await page.goto('/#review');
  await expect(page.getByText(/Vượt 15 điểm/)).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('.review-queue li')).toHaveCount(6 - i);
    await page.locator('.review-queue li button').first().click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nhận xét review', { exact: true }).fill('Đã kiểm tra');
    await d.getByRole('button', { name: 'Đánh dấu đã review', exact: true }).click();
    await expect(d.getByRole('button', { name: 'Mở lại review', exact: true })).toBeVisible();
    await d.getByRole('button', { name: 'Đóng', exact: true }).click();
    if (i === 2) await expect(page.getByText(/Vượt 15 điểm/)).toBeVisible();
    if (i === 3) await expect(page.getByText(/Tỷ lệ review đang cân bằng/)).toBeVisible();
  }
  await expect(page.getByText('Không còn lệnh chờ review.', { exact: true })).toBeVisible();
  await page.goto('/#settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bản sao đầy đủ', exact: true }).click();
  const download = await downloadPromise;
  const file = info.outputPath('workspace.json');
  await download.saveAs(file);
  const backup = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(backup.kind).toBe('Trading Plan Pro workspace');
  await page.getByLabel('Khôi phục có xem trước', { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: 'Kiểm tra khôi phục', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('dữ liệu đang lưu không bị thay đổi');
  await expect(page.getByRole('button', { name: 'Khôi phục dữ liệu', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('s3-settings.png'), fullPage: true });
});
