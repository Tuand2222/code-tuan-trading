import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4176' },
  projects: [360, 768, 1280].map((width) => ({
    name: 'chromium-' + width,
    use: { ...devices['Desktop Chrome'], viewport: { width, height: 900 } },
  })),
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: !process.env.CI,
  },
});
