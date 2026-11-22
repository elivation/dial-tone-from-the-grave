import { test, expect } from '@playwright/test';
import { INCOMING_MESSAGES } from '../../lib/incoming';
import { finishSpeech, spokenLines, stubSpeech } from './helpers';

// A call rings for several seconds and the scene takes a while to load, so the default 30 s is short.
test.describe.configure({ timeout: 90_000 });

// This file does not use the quietPhone fixture, because the phone has to be free to ring. The
// wait before it rings is 45 to 120 seconds on the default build, so the page clock is moved on
// instead of waiting for it, and the app is not changed.
test('[Req 12.2] an idle phone rings by itself, and the message is shown and spoken', async ({
  page,
}) => {
  await stubSpeech(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Unmute' }).click();
  // Any press counts as the first interaction. This one also wakes the 3D scene.
  await page.mouse.click(4, 4);
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 60_000 });

  const ringing = page.getByRole('status').filter({ hasText: 'The phone is ringing.' });
  // Steps of 5 s, so the ring is seen before its 20 second timeout can end it.
  await expect(async () => {
    await page.clock.fastForward(5000);
    await expect(ringing).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Pick up the handset' }).click();
  const message = page.getByRole('log', { name: 'Message from the line' });
  await expect(message).toBeVisible();
  const shown = (await message.innerText()).trim();
  expect(INCOMING_MESSAGES).toContain(shown);
  await expect.poll(() => spokenLines(page)).toEqual([shown]);

  await finishSpeech(page);
  await page.clock.fastForward(2500);
  await expect(message).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible();
});
