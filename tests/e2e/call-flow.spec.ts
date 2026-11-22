import { test, expect } from './quietPhone';
import { audioCounts, dial, openPhone, spyOnAudio } from './helpers';

test.beforeEach(async ({ page }) => {
  await spyOnAudio(page);
  await openPhone(page);
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
  expect((await audioCounts(page)).statics).toBe(0);
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
  expect((await audioCounts(page)).statics).toBe(1);
});

test('[Req 1.5] pressing 5 shows the digit and plays five dial clicks', async ({ page }) => {
  await page.keyboard.press('5');
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('5');
  await expect.poll(async () => (await audioCounts(page)).clicks, { timeout: 5000 }).toBe(5);
});

test('[Req 2.7] hanging up clears the number and goes back to idle', async ({ page }) => {
  await dial(page, '55');
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('55');
  await page.getByRole('button', { name: 'Hang up' }).click();
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('');
});

test('[Req 8.7] starts muted, and remembers unmuting for the session', async ({ page }) => {
  await page.getByRole('button', { name: 'Unmute' }).click();
  await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
});
