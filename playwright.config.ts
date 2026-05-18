import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config.
 *
 * Default target is the live production site. Override per-run:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
 *
 * The smoke tests under tests/e2e/ are read-only (no sign-in, no writes).
 * They guard against regressions on every public page after a deploy.
 */
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://bigfamilykitchen.com';

export default defineConfig({
  testDir:  './tests/e2e',
  timeout:  30_000,
  retries:  process.env.CI ? 1 : 0,
  workers:  process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace:   'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop chrome',
      use:  { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile iphone',
      use:  { ...devices['iPhone 14'] },
    },
  ],
});
