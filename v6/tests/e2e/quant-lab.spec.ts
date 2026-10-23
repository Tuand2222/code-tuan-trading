import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
async function seed(page: Page) {
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
}
async function snapshot(page: Page) {
  await page.goto('/#debug');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải sao lưu v4', exact: true }).click();
  const file = await (await pending).path();
  return JSON.parse(await fs.readFile(file!, 'utf8')).data;
}
test('quantitative V6 is responsive, explains metrics and persists simulations without changing the ledger', async ({
  page,
}, info) => {
  await seed(page);
  const before = await snapshot(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#overview');
  await expect(page.locator('.quant-cards > article')).toHaveCount(6);
  const expectancy = page.getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true });
  await expect(expectancy.locator('.quant-value')).toHaveText('0,32 R');
  await expect(page.locator('.bar-column')).toHaveCount(0);
  await page.getByRole('button', { name: 'Giải thích Kỳ vọng mỗi lệnh', exact: true }).click();
  const help = page.getByRole('note', { name: 'Kỳ vọng mỗi lệnh', exact: true });
  for (const label of ['Chức năng', 'Công thức', 'Cách đọc', 'Điều cần đối chiếu'])
    await expect(help.getByText(label, { exact: true })).toBeVisible();
  const bounds = await help.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '⚙ Cài đặt V6', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Cài đặt phân tích', exact: true });
  await drawer.getByLabel('Ma sát giả định thêm mỗi lệnh (R)', { exact: true }).fill('0.1');
  await drawer.getByRole('button', { name: 'Xong', exact: true }).click();
  await expect(expectancy.locator('.quant-value')).toHaveText('0,22 R');
  await expect(page.locator('.quant-simulation')).toContainText('MÔ PHỎNG');
  await page.reload();
  await expect(expectancy.locator('.quant-value')).toHaveText('0,22 R');
  await expect(page.locator('.quant-overview')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('v6-quant-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: info.outputPath('v6-quant-light.png'), fullPage: true });
  expect(await snapshot(page)).toEqual(before);
});
test('Classic source is read-only, uses the same Net and does not merge or overwrite either ledger', async ({
  page,
}) => {
  await seed(page);
  const before = await snapshot(page);
  const classic = JSON.stringify([
    {
      id: 'CLASSIC_QA',
      symbol: 'CLASSIC_QA',
      market: 'Crypto',
      date: '2026-10-23',
      openedAt: '2026-10-23T00:00:00.000Z',
      closedAt: '2026-10-23T01:00:00.000Z',
      pnl: 100,
      fees: 10,
      swap: 2,
      risk: 50,
      setup: 'Trend',
    },
  ]);
  await page.evaluate((raw) => localStorage.setItem('tuan-trader-trades', raw), classic);
  const methods: string[] = [];
  await page.route('**/api/**', (r) => {
    methods.push(r.request().method());
    return r.fulfill({ json: { user: null } });
  });
  await page.goto('/#overview');
  await page.getByLabel('Nguồn phân tích', { exact: true }).selectOption('classic');
  await expect(
    page.getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true }).locator('.quant-value'),
  ).toHaveText('1,76 R');
  await expect(page.locator('.quant-source-note')).toContainText('giữ nguyên');
  expect(await page.evaluate(() => localStorage.getItem('tuan-trader-trades'))).toBe(classic);
  expect(methods.every((m) => m === 'GET')).toBe(true);
  await page.getByLabel('Nguồn phân tích', { exact: true }).selectOption('v6');
  await expect(
    page.getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true }).locator('.quant-value'),
  ).toHaveText('0,32 R');
  expect(await snapshot(page)).toEqual(before);
});
test('missing excursions stay empty while distribution, underwater and rolling SQN remain usable', async ({
  page,
}, info) => {
  await seed(page);
  await page.goto('/#overview');
  await expect(page.locator('.quant-overview')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Quản lý lệnh', exact: true }).click();
  await expect(page.getByText('Chưa có MFE được ghi nhận', { exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có MAE được ghi nhận', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sụt giảm & ổn định', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Drawdown (R) theo Thứ tự lệnh đóng', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('v6-quant-risk.png'), fullPage: true });
  await page.getByRole('button', { name: 'Phân phối & thời điểm', exact: true }).click();
  await page.locator('.quant-bin-controls button').first().click();
  await expect(page.getByRole('dialog')).toContainText('Sổ v6');
  await expect(page.getByRole('dialog').locator('tbody tr')).not.toHaveCount(0);
});
