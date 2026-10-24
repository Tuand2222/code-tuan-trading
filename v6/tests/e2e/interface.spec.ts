import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
test('S2 shared filters, preserved source reconciliation, saved views and accessible responsive shell', async ({
  page,
}, info) => {
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
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  const net = page.getByTestId('source-reconciliation');
  await expect(net).toContainText('+3.302.290 đ');
  await page.getByLabel('Mã sản phẩm', { exact: true }).fill('VCB');
  await expect(page).toHaveURL(/symbol=VCB/);
  await expect(page.locator('[data-trade-id]')).toHaveCount(5);
  await page.getByLabel('Tên góc nhìn', { exact: true }).fill('VCB review');
  await page.getByRole('button', { name: 'Lưu góc nhìn', exact: true }).click();
  await expect(page.getByText('Đã lưu góc nhìn.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mã sản phẩm', { exact: true })).toHaveValue('VCB');
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await page.getByLabel('Góc nhìn đã lưu', { exact: true }).selectOption('VCB review');
  await expect(page.getByLabel('Mã sản phẩm', { exact: true })).toHaveValue('VCB');
  await page.getByLabel('Mã sản phẩm', { exact: true }).fill('n');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(net).toContainText('+3.302.290 đ');
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: info.outputPath('s2-workspace.png'), fullPage: true });
});
