import { test, expect } from './quietPhone';
/** Chromium reports the 3D scene as a canvas element, and nothing else on the page makes one. */
const SCENE = 'canvas';
test('[Req 5.3] the page shows a poster, and runs no 3D scene, until the first tap', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: /rotary phone/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator(SCENE)).toHaveCount(0);
  await page.mouse.click(4, 4);
  await expect(page.locator(SCENE)).toHaveCount(1, { timeout: 60_000 });
});
test('[Req 5.3] one press of Pick up the handset loads the scene and then picks up', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick up the handset' }).click();
  await expect(
    page.getByText('Connecting you to the exchange...').or(page.locator(SCENE)),
  ).toBeAttached();
  await expect(page.getByRole('status').filter({ hasText: 'Dial a number.' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('button', { name: 'Hang up' })).toBeVisible();
});
test('[Req 9.2] a number key also loads the scene', async ({ page }) => {
  await page.goto('/');
  // A key pressed before React has hydrated goes nowhere, so keep pressing until the page listens.
  await expect(async () => {
    await page.keyboard.press('5');
    await expect(page.locator(SCENE)).toHaveCount(1, { timeout: 1500 });
  }).toPass({ timeout: 60_000 });
});
test('[Req 9.4] with reduced motion the poster is gone as soon as the scene has drawn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.mouse.click(4, 4);
  await expect(page.getByRole('img', { name: /rotary phone/ })).toBeHidden({ timeout: 60_000 });
});
test('[Req 5.3] the fiction notice shows on the poster', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/are fictional/)).toBeVisible();
});
