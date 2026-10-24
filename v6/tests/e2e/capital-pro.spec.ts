import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
test('capital architecture uses actual history, preserves it during stress and applies the account veto', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
  await page.goto('/#capital');
  await page.getByRole('button', { name: '2 · Đánh giá chiến lược', exact: true }).click();
  await expect(page.getByText('30 lệnh đủ dữ liệu', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rủi ro theo ngày giao dịch' })).toBeVisible();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Mô phỏng & stress', exact: true }).click();
  await page.getByLabel('Số lệnh mỗi đường', { exact: true }).fill('20');
  await page.getByLabel('Số lệnh thua liên tiếp bơm vào', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Chạy 1.000 đường mô phỏng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả mô hình quỹ' })).toBeVisible();
  await expect(page.getByText(/bơm đúng 10 lệnh thua\/đường/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('capital-stress.png'), fullPage: true });
  await page.getByRole('button', { name: 'Hồ sơ vốn & quy tắc', exact: true }).click();
  await page.getByLabel('Vốn đầu kỳ thực (VND)', { exact: true }).fill('100000000');
  await page.getByLabel('Khóa chủ động kế hoạch lệnh mới', { exact: true }).check();
  await page.getByRole('button', { name: 'Lưu hồ sơ vốn thực', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Dừng lập kế hoạch mới', exact: true }),
  ).toBeVisible();
  await page.getByText('Bộ lọc chung', { exact: true }).click();
  await page.getByLabel('Mã sản phẩm', { exact: true }).fill('VCB');
  await expect(
    page.getByRole('heading', { name: 'Dừng lập kế hoạch mới', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await page.goto('/#advanced');
  await expect(page.getByRole('button', { name: 'Lưu planned trade', exact: true })).toBeDisabled();
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await expect(page.getByTestId('source-reconciliation')).toContainText('+3.302.290 đ');
  await page.goto('/#capital');
  await page.screenshot({ path: info.outputPath('capital-cockpit.png'), fullPage: true });
});
