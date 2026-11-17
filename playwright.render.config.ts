import { defineConfig, devices } from '@playwright/test';

/**
 * Renders the dev-only /dev/phone page, which the production build behind the main config
 * does not serve. Run with `pnpm exec playwright test -c playwright.render.config.ts`.
 */
const URL = process.env['RENDER_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/render',
  reporter: 'list',
  use: { baseURL: URL },
  webServer: {
    command: 'pnpm dev',
    url: URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
