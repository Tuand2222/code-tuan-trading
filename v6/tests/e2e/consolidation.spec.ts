import { test, expect } from '@playwright/test';
import path from 'node:path';
test('merges original backup twice without duplicating trades or notes and exports the complete workspace', async ({
  page,
}) => {
  await page.goto('/#settings');
  const file = page.getByLabel('Chọn bản sao để gộp', { exact: true });
  await file.setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await expect(page.getByText('30 lệnh thêm · 0 lệnh trùng', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Gộp và giữ dữ liệu hiện có', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã gộp dữ liệu' })).toBeVisible();
  await page.reload();
  await file.setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await expect(page.getByText('0 lệnh thêm · 30 lệnh trùng', { exact: false })).toBeVisible();
  await expect(page.getByText('Sau gộp: 30 lệnh, 30 ghi chú.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Gộp và giữ dữ liệu hiện có', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã gộp dữ liệu' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bản sao đầy đủ', exact: true }).click();
  const backup = await download;
  expect(await backup.path()).toBeTruthy();
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
});
