import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('S0 serves the foundation without a journal UI', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Trading Plan Pro v6');
  await expect(page.locator('#root')).toBeEmpty();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
    [],
  );
});
