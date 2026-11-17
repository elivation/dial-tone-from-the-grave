import { test, expect } from '@playwright/test';

test('[Req 9.8] going offline shows the in-character message and coming back clears it', async ({
  page,
  context,
}) => {
  await page.goto('/');
  // Next.js keeps its own empty route announcer with the alert role, so match on the text.
  const notice = page.getByRole('alert').filter({ hasText: 'The exchange has gone dark' });
  await expect(notice).toHaveCount(0);

  await context.setOffline(true);
  await expect(notice).toHaveText(/Check your connection/);
  await expect(page.locator('[inert]')).toHaveCount(1);

  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
});
