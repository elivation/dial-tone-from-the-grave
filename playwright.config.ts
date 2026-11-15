import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 3200;
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? E2E_URL,
    trace: 'on-first-retry',
  },
  // Tests run against the production build. Run `pnpm build` first. It gets its own port and is
  // never reused, so a dev server already running on 3000 is not tested by mistake.
  webServer: process.env['PLAYWRIGHT_BASE_URL']
    ? undefined
    : {
        command: `pnpm start -p ${E2E_PORT}`,
        url: E2E_URL,
        reuseExistingServer: false,
        timeout: 60_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
