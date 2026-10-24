import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { createHash } from 'node:crypto';
const canonical = (value: unknown): string => JSON.stringify(normalize(value));
function normalize(v: unknown): unknown {
  return Array.isArray(v)
    ? v.map(normalize)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b, 'en'))
            .map(([k, x]) => [k, normalize(x)]),
        )
      : v;
}
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
async function seed(page: Page) {
  await page.goto('/#debug');
  await page
    .getByLabel('Chọn bản sao JSON v3 hoặc v4')
    .setInputFiles(path.resolve('tests/golden/fixture-30-trades.json'));
  await page.getByLabel('Tôi đã kiểm tra phạm vi thay đổi và muốn lưu.').check();
  await page.getByRole('button', { name: 'Nạp và sao lưu bản gốc', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu dữ liệu' })).toBeVisible();
}
test('cloud roundtrip restores a new device, exports verifiable records and preserves thirty original trades', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  let revision = 0;
  type Row = {
    record_key: string;
    collection: string;
    record_id: string;
    hash: string;
    deleted: number;
    revision: number;
    size_bytes: number;
    updated_at: string;
    value: unknown;
  };
  const records = new Map<string, Row>();
  const mock = async (context: BrowserContext) => {
    await context.route('**/api/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname === '/api/site-session')
        return route.fulfill({ json: { user: { id: 'qa-owner', name: 'QA Owner' } } });
      if (url.pathname === '/api/auth/get-session') return route.fulfill({ json: { user: null } });
      if (url.pathname === '/api/classic-archive')
        return route.fulfill({ json: { pending: 0, next: null } });
      if (url.pathname !== '/api/journal-cloud')
        return route.fulfill({ json: { trades: [], settings: null, version: 0 } });
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        if (body.expectedOwner !== 'qa-owner' || body.expectedRevision !== revision)
          return route.fulfill({ status: 409, json: { error: 'Conflict' } });
        revision++;
        for (const d of body.records) {
          const k = d.collection + ':' + d.id;
          records.set(k, {
            record_key: k,
            collection: d.collection,
            record_id: d.id,
            hash: hash(d.deleted ? null : d.value),
            deleted: d.deleted ? 1 : 0,
            revision,
            size_bytes: canonical(d.value ?? null).length,
            updated_at: new Date().toISOString(),
            value: d.value,
          });
        }
        return route.fulfill({ json: { revision } });
      }
      const key = url.searchParams.get('key');
      if (key) {
        const row = records.get(key);
        return row
          ? route.fulfill({
              json: { owner: 'qa-owner', value: row.value, hash: row.hash, revision: row.revision },
            })
          : route.fulfill({ status: 404, json: { error: 'Missing' } });
      }
      if (url.searchParams.get('export')) {
        const lines = [
          {
            format: 'tuan-cloud-archive',
            version: 1,
            archiveId: 'qa-owner:' + revision,
            revision,
            after: '',
            exportedAt: new Date().toISOString(),
          },
          ...[...records.values()].map((r) => ({
            collection: r.collection,
            id: r.record_id,
            value: r.value,
            hash: r.hash,
            deleted: !!r.deleted,
          })),
          { complete: true, next: null, revision },
        ];
        return route.fulfill({
          contentType: 'application/x-ndjson',
          body: lines.map((v) => JSON.stringify(v)).join('\n'),
        });
      }
      return route.fulfill({
        json: {
          owner: 'qa-owner',
          revision,
          records: [...records.values()].map(({ value, ...r }) => {
            void value;
            return r;
          }),
          next: null,
        },
      });
    });
  };
  await mock(page.context());
  await seed(page);
  await page.goto('/#capital');
  await page.getByRole('button', { name: 'Mô phỏng & stress', exact: true }).click();
  await page.getByLabel('Seed tái lập', { exact: true }).fill('4321');
  await page.goto('/#cloud');
  await page.getByRole('button', { name: 'Bật lưu và đồng bộ nhật ký này', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đang kiểm tra và đồng bộ' }),
  ).toHaveCount(0);
  await expect
    .poll(() => [...records.values()].filter((r) => r.collection === 'trades' && !r.deleted).length)
    .toBe(30);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const second = await browser.newContext({
    viewport: page.viewportSize()!,
    baseURL: 'http://127.0.0.1:4176',
  });
  await mock(second);
  const other = await second.newPage();
  await other.goto('/#cloud');
  await other.getByRole('button', { name: 'Bật lưu và đồng bộ nhật ký này', exact: true }).click();
  await expect(other.getByText('1 sổ · 30 giao dịch · 30 ghi chú', { exact: true })).toBeVisible();
  await other.goto('/#capital');
  await other.getByRole('button', { name: 'Mô phỏng & stress', exact: true }).click();
  await expect(other.getByLabel('Seed tái lập', { exact: true })).toHaveValue('4321');
  await other.goto('/#overview');
  await expect(
    other.getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true }).locator('.quant-value'),
  ).toHaveText('0,32 R');
  await page.goto('/#cloud');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao độc lập', exact: true }).click();
  const file = info.outputPath('cloud-roundtrip.ndjson');
  await (await downloaded).saveAs(file);
  await page.getByLabel('Chọn các gói NDJSON', { exact: true }).setInputFiles(file);
  await expect(
    page.getByText('Đã xác minh: 1 sổ · 30 giao dịch · 30 ghi chú.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('cloud-archive.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await second.close();
});
test('shared Classic facts are edited from V6 with version protection and unit switching', async ({
  page,
}) => {
  await seed(page);
  let trade = {
    id: 'shared-one',
    version: 1,
    symbol: 'TEST',
    market: 'Crypto',
    date: '2026-10-24',
    closedAt: '2026-10-24T01:00:00.000Z',
    openedAt: '2026-10-24T00:00:00.000Z',
    pnl: 100,
    fees: 10,
    swap: 0,
    risk: 50,
    feesKnown: true,
    riskKnown: true,
    pnlKnown: true,
    quantity: 1,
    note: 'keep',
    setup: 'Trend',
  };
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('session'))
      return route.fulfill({ json: { user: { id: 'qa-owner' } } });
    if (url.pathname === '/api/trades' && route.request().method() === 'PATCH') {
      const b = route.request().postDataJSON();
      if (b.trade.version !== trade.version)
        return route.fulfill({ status: 409, json: { error: 'Conflict' } });
      trade = { ...trade, ...b.trade, version: trade.version + 1 };
      return route.fulfill({ json: { trade } });
    }
    if (url.pathname === '/api/trades')
      return route.fulfill({ json: { trades: [trade], next: null } });
    return route.fulfill({ json: { settings: null, version: 0, owner: 'qa-owner' } });
  });
  await page.goto('/#overview');
  await page.getByLabel('Nguồn phân tích', { exact: true }).selectOption('classic');
  const expectancy = page
    .getByRole('article', { name: 'Kỳ vọng mỗi lệnh', exact: true })
    .locator('.quant-value');
  await expect(expectancy).toHaveText('1,80 R');
  await page
    .locator('.quant-panel')
    .first()
    .getByRole('button', { name: '1 lệnh', exact: true })
    .click();
  await page.getByRole('button', { name: 'Sửa sổ chung', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Phí thực đã ghi nhận (VNĐ)', { exact: true }).fill('20');
  await editor.getByRole('button', { name: 'Lưu vào sổ chung', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(expectancy).toHaveText('1,60 R');
  expect(trade.fees).toBe(20);
  expect(trade.version).toBe(2);
  expect(trade.note).toBe('keep');
  await page.getByRole('button', { name: '⚙ Cài đặt V6', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Cài đặt phân tích', exact: true });
  await drawer.getByLabel('Đơn vị toàn trang', { exact: true }).selectOption('money');
  await drawer.getByRole('button', { name: 'Xong', exact: true }).click();
  await expect(expectancy).toHaveText('80,00 VNĐ');
  await expect(
    page.getByRole('img', { name: 'Số lệnh theo Kết quả (VNĐ)', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel('Nguồn phân tích', { exact: true }).selectOption('classic');
  await expect(expectancy).toHaveText('80,00 VNĐ');
});
