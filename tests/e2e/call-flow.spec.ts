import { test, expect, type Page } from '@playwright/test';

/**
 * Presses the number keys one at a time. The dial ignores a key while it is still moving, so each
 * digit is waited for on the display, then given time to run back, with a margin for a slow machine.
 */
async function dial(page: Page, number: string) {
  let soFar = '';
  for (const digit of number) {
    await page.keyboard.press(digit);
    soFar += digit;
    await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText(soFar);
    await page.waitForTimeout((digit === '0' ? 10 : Number(digit)) * 100 + 400);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The first frames compile the scene and block the main thread for up to 650 ms at a time. A key
  // pressed then makes the dial run back late, so the next key arrives while it is still moving and
  // is ignored, as a real dial would. Wait for the veil to lift and the scene to settle first.
  await page.waitForFunction(
    () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Pick up the handset' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dial a number.' })).toBeVisible();
});

test('[Req 2.8] dialling 112 shows the plain emergency notice, and it can be dismissed', async ({
  page,
}) => {
  await dial(page, '112');
  const notice = page.getByRole('alertdialog');
  await expect(notice).toBeVisible({ timeout: 6000 });
  await expect(notice).toContainText(
    'This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111.',
  );
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible();
});

test('[Req 2.6] an unknown number says wrong number, then the line goes back to idle', async ({
  page,
}) => {
  await dial(page, '5555');
  await expect(page.getByRole('status').filter({ hasText: 'Wrong number.' })).toBeVisible({
    timeout: 6000,
  });
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible({
    timeout: 8000,
  });
});

test('[Req 2.7] hanging up clears the number and goes back to idle', async ({ page }) => {
  await dial(page, '55');
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('55');
  await page.getByRole('button', { name: 'Hang up' }).click();
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('');
});
