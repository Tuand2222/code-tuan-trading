import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Snapshot } from '../../src/data/snapshot';
const normalize = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b, 'en'))
            .map(([key, v]) => [key, normalize(v)]),
        )
      : value;
const canonical = (value: unknown) => JSON.stringify(normalize(value));
test('10,000-trade ledger imports, renders virtual journal and reloads', async ({ page }, info) => {
  test.skip(
    info.project.name !== 'chromium-1280',
    'Desktop performance check; responsive workflows tested separately.',
  );
  test.setTimeout(240000);
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải sao lưu v4', exact: true }).click();
  const source = info.outputPath('source-v4.json');
  await (await downloading).saveAs(source);
  const envelope = JSON.parse(await fs.readFile(source, 'utf8')) as {
    data: Snapshot;
    checksum: string;
    exportedAt: string;
  };
  const data = envelope.data;
  const trades = Array.from({ length: 10000 }, (_, i) => ({
    ...data.trades[i % 30],
    id: i < 30 ? data.trades[i].id : 'performance:' + i,
    legs: data.trades[i % 30].legs.map((l) => ({ ...l, id: l.id + ':' + i })),
  }));
  const fixture = info.outputPath('performance-fixture-v4.json');
  envelope.data = { ...data, trades };
  envelope.exportedAt = new Date().toISOString();
  const body = Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== 'checksum'));
  await fs.writeFile(
    fixture,
    canonical({ ...body, checksum: createHash('sha256').update(canonical(body)).digest('hex') }),
  );
  const start = Date.now();
  await page.goto('/#debug');
  await page.getByLabel('Chọn bản sao JSON v3 hoặc v4').setInputFiles(fixture);
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible({
    timeout: 120000,
  });
  await page.goto('/#evidence');
  await expect(page.locator('[data-trade-id]').first()).toBeVisible({ timeout: 120000 });
  const count = await page.locator('[data-trade-id]').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(200);
  await page.reload();
  await expect(page.locator('[data-trade-id]').first()).toBeVisible({ timeout: 120000 });
  await fs.writeFile(
    info.outputPath('performance-browser.json'),
    JSON.stringify(
      { trades: 10000, visibleRows: count, importRenderReloadMs: Date.now() - start },
      null,
      2,
    ),
  );
});
