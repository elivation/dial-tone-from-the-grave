import { test, expect } from './quietPhone';
import { dial, openPhone, say } from './helpers';

// One real 1023 turn, so one Claude call. Skipped unless the run points at a deployed URL.
test.skip(!process.env['PLAYWRIGHT_BASE_URL'], 'live check: set PLAYWRIGHT_BASE_URL to run it');

test('@live [Req 4.1] a real 1023 turn answers and opens the phone book', async ({ page }) => {
  test.setTimeout(120_000);
  await openPhone(page);
  await dial(page, '1023');
  await expect(page.getByRole('heading', { name: 'Directory Enquiries' })).toBeVisible({
    timeout: 20_000,
  });
  await say(page, 'a plumber in Edenvale');
  await expect(page.getByRole('button', { name: 'Close the book' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('list', { name: 'Business listings' })).toBeAttached();
});
