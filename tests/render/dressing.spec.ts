import { test, expect, type Page } from '@playwright/test';

const OUT = 'assets-src/renders';
const TAG = process.env['DRESSING_TAG'] ?? 'dressing';

async function wake(page: Page) {
  await page.addInitScript(() => window.sessionStorage.setItem('dtftg_incoming_count', '999'));
  await page.goto('/');
  await page.mouse.click(4, 4);
  await expect(page.locator('[aria-hidden="true"].opacity-0').first()).toBeAttached({
    timeout: 100_000,
  });
  await page.waitForTimeout(2500);
}

/** Frames per second over three seconds. Headless Chromium draws on the CPU, so this is indicative only. */
async function sampleFps(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - start >= 3000)
            resolve((frames * 1000) / (performance.now() - start));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`[render] dressing, whole scene at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height });
    await wake(page);
    await page.screenshot({ path: `${OUT}/${TAG}-scene-${width}x${height}.png` });
    const fps = await sampleFps(page);
    console.log(`[${TAG} ${width}x${height}] ${fps.toFixed(1)} fps in headless Chromium`);
  });
}

test.describe('close-up', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  const clip = {
    x: Number(process.env['CLOSE_X'] ?? 740),
    y: Number(process.env['CLOSE_Y'] ?? 120),
    width: Number(process.env['CLOSE_W'] ?? 360),
    height: Number(process.env['CLOSE_H'] ?? 320),
  };
  test('[render] dressing, cobwebs close up', async ({ page }) => {
    test.setTimeout(150_000);
    await wake(page);
    await page.screenshot({ path: `${OUT}/${TAG}-cobwebs-close.png`, clip });
  });
});
