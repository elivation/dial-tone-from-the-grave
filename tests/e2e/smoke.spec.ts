import { test, expect } from '@playwright/test';

test('[smoke] page has html element', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toBeAttached();
});
