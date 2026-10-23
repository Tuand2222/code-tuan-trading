import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/hosted',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.SITE_TEST_URL ?? 'http://127.0.0.1:4180',
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15000,
  },
});
