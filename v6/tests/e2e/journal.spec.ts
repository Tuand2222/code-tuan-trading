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
test('audit: journal configuration clone and archive preserve original trades', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/#settings');
  const management = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Quản lý sổ', exact: true }) });
  await expect(management.getByRole('button', { name: /^Lưu trữ sổ/ })).toBeDisabled();
  await management.getByRole('button', { name: /^Nhân bản cấu hình/ }).click();
  await expect(page).toHaveURL(/#evidence/);
  await page.goto('/#settings');
  await expect(management.getByRole('button', { name: /^Nhân bản cấu hình/ })).toHaveCount(2);
  await management
    .getByRole('button', { name: /^Lưu trữ sổ/ })
    .first()
    .click();
  await expect(management.getByRole('button', { name: /^Khôi phục sổ/ })).toHaveCount(1);
  await management.getByRole('button', { name: /^Khôi phục sổ/ }).click();
  await expect(management.getByRole('button', { name: /^Khôi phục sổ/ })).toHaveCount(0);
  await page.reload();
  await expect(management.getByRole('button', { name: /^Khôi phục sổ/ })).toHaveCount(0);
  await management
    .getByRole('button', { name: /^Lưu trữ sổ/ })
    .last()
    .click();
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
});

test('audit: cashflows reconcile capital, persist edits and preserve trading Net', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/#settings');
  await page.getByLabel('Vốn đầu kỳ (không có thì để trống)', { exact: true }).fill('100000000');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  const capital = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Vốn và nạp/rút', exact: true }) });
  await expect(capital).toContainText('103.302.290 đ');
  await capital.getByLabel('Thời điểm dòng tiền (UTC)', { exact: true }).fill('2026-11-01T10:00');
  await capital.getByLabel('Số tiền dòng tiền (VND)', { exact: true }).fill('100');
  await capital.getByRole('button', { name: 'Lưu dòng tiền', exact: true }).click();
  await expect(capital).toContainText('103.302.390 đ');
  await capital.getByRole('button', { name: /^Sửa dòng tiền/ }).click();
  await capital.getByLabel('Số tiền dòng tiền (VND)', { exact: true }).fill('200');
  await capital.getByRole('button', { name: 'Lưu dòng tiền', exact: true }).click();
  await expect(capital).toContainText('103.302.490 đ');
  await page.reload();
  await expect(capital).toContainText('103.302.490 đ');
  await capital.getByRole('button', { name: /^Xóa dòng tiền/ }).click();
  await capital.getByRole('button', { name: 'Xác nhận xóa dòng tiền', exact: true }).click();
  await expect(capital).toContainText('103.302.290 đ');
  await page.goto('/#evidence');
  await expect(page.getByTestId('source-reconciliation')).toContainText(
    '3.302.290',
  );
});

test('audit: stale cashflow draft cannot overwrite a newer tab revision', async ({ page }) => {
  await seed(page);
  await page.goto('/#settings');
  const capital = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Vốn và nạp/rút', exact: true }) });
  await capital.getByLabel('Thời điểm dòng tiền (UTC)', { exact: true }).fill('2026-11-01T10:00');
  await capital.getByLabel('Số tiền dòng tiền (VND)', { exact: true }).fill('100');
  const other = await page.context().newPage();
  await other.goto('/#settings');
  await other.getByLabel('Vốn đầu kỳ (không có thì để trống)', { exact: true }).fill('100000000');
  await other.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await expect(capital).toContainText('103.302.290 đ');
  await capital.getByRole('button', { name: 'Lưu dòng tiền', exact: true }).click();
  await expect(capital.getByRole('status')).toContainText('Không lưu được');
  await expect(capital.getByRole('listitem')).toHaveCount(0);
  await other.close();
});
test('missing actual costs remain missing after editing preserved execution evidence', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/#evidence');
  await page
    .locator('[data-trade-id]')
    .first()
    .getByRole('button', { name: 'Sửa giao dịch', exact: true })
    .click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Tôi đã xác nhận đầy đủ phí, thuế, funding/swap', { exact: true }).uncheck();
  await d.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.goto('/#overview');
  await expect(
    page.getByRole('article', { name: 'Sụt giảm tối đa', exact: true }).locator('.quant-value'),
  ).toHaveText('—');
  await page.getByRole('button', { name: 'Đối chiếu dữ liệu thiếu (1)', exact: true }).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(1);
});
test('evidence review, star and complete backup preserve the original thirty execution records', async ({
  page,
}, info) => {
  await seed(page);
  await page.goto('/#evidence');
  const row = page.locator('[data-trade-id]').first();
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await row.getByRole('button', { name: /Đánh dấu sao/ }).click();
  await expect(row.getByRole('button', { name: /Đánh dấu sao/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await row.getByRole('button', { name: 'Xem lệnh', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Nhận xét review', { exact: true }).fill('Đã đối chiếu dữ liệu gốc');
  const done = d.getByRole('button', { name: 'Đánh dấu đã review', exact: true });
  if (await done.count()) await done.click();
  await d.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.reload();
  await expect(row).toContainText('Đã review');
  await page.goto('/#evidence');
  await expect(page.getByTestId('source-reconciliation')).toContainText(
    '3.302.290',
  );
  await page.goto('/#settings');
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bản sao đầy đủ', exact: true }).click();
  const file = info.outputPath('preserved-workspace.json');
  await (await wait).saveAs(file);
  const backup = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(backup.kind).toBe('Trading Plan Pro workspace');
  await page.getByLabel('Khôi phục có xem trước', { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: 'Kiểm tra khôi phục', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('dữ liệu đang lưu không bị thay đổi');
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
});
test('operational duplicates live in Classic while old V6 routes preserve access to the evidence', async ({
  page,
}) => {
  await seed(page);
  for (const [old, target] of Object.entries({
    journal: 'journal',
    calendar: 'calendar',
    review: 'notes',
    playbook: 'process',
    risk: 'risk',
    metrix: 'statistics',
    system: 'system-tracker',
    valuation: 'valuation',
    connections: 'connections',
  })) {
    await page.goto('/#' + old);
    await expect(page.getByRole('link', { name: 'Mở chức năng tại Classic ↗' })).toHaveAttribute(
      'href',
      '/classic#' + target,
    );
    await expect(
      page.locator('.metrix-controlbar,.system-hero,.vlab-shell,.calendar-table'),
    ).toHaveCount(0);
  }
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]')).toHaveCount(30);
  await page.goto('/#overview');
  await expect(
    page.getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true }).locator('.quant-value'),
  ).toHaveText('0,32 R');
});
