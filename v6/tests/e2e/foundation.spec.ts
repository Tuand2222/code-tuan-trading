import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
test('S1 previews and imports original v3 safely, persists across reload and passes accessibility checks', async ({
  page,
}, testInfo) => {
  const response = await page.goto('/#debug');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Trading Plan Pro v6');
  await expect(
    page.getByRole('heading', { name: 'Kiểm chứng & sao lưu', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await expect(
    page.getByRole('heading', { name: 'Đối chiếu bộ 30 lệnh minh họa: Đạt' }),
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Lợi nhuận ròng' })).toContainText(
    '3.302.290',
  );
  await expect(page.getByRole('button', { name: 'Nạp và sao lưu bản gốc' })).toBeDisabled();
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu dữ liệu');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Đối chiếu bộ 30 lệnh minh họa: Đạt' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải sao lưu v4', exact: true })).toBeEnabled();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  await page.screenshot({ path: testInfo.outputPath('s1-debug.png'), fullPage: true });
});
