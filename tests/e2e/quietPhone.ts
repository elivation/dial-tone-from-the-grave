import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

/** Mirrors INCOMING_COUNT_KEY in components/PhoneScene/useIncomingCall.ts. */
const INCOMING_COUNT_KEY = 'dtftg_incoming_count';

/**
 * A test that keeps the phone from ringing by itself. NEXT_PUBLIC_RING_IN_ENABLED is baked in at
 * build time, and these tests run against whatever `pnpm build` made, so each page starts with the
 * session cap already used up instead.
 */
export const test = base.extend<{ quietPhone: void }>({
  quietPhone: [
    async ({ page }, use) => {
      await page.addInitScript(
        (key) => window.sessionStorage.setItem(key, '999'),
        INCOMING_COUNT_KEY,
      );
      await use();
    },
    { auto: true },
  ],
});
