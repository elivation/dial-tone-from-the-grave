import { test, expect } from '@playwright/test';

const OUT = 'assets-src/renders';

test.use({ viewport: { width: 1440, height: 900 } });

for (const section of ['business', 'white'] as const) {
  test(`[render] the phone book lies open on the desk, ${section} pages`, async ({ page }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(`/dev/phone?book=${section}`);
    await page.waitForFunction(
      () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
      undefined,
      { timeout: 150_000 },
    );
    // The book drops onto the desk over 0.6 s, then settles.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/book-scene-${section}.png` });

    // Frame rate, sampled in the page. Headless Chromium draws on the CPU, so this is indicative only.
    const fps = await page.evaluate(
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
    console.log(`[book ${section}] ${fps.toFixed(1)} fps in headless Chromium`);
    expect(problems).toEqual([]);
  });
}

test.describe('close-up', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });

  test('[render] the white pages close up', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/dev/phone?book=white');
    await page.waitForFunction(
      () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
      undefined,
      { timeout: 150_000 },
    );
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: `${OUT}/book-scene-white-close.png`,
      clip: { x: 560, y: 440, width: 780, height: 300 },
    });
  });
  test('[render] the business pages close up', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/dev/phone?book=business');
    await page.waitForFunction(
      () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
      undefined,
      { timeout: 150_000 },
    );
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: `${OUT}/book-scene-business-close.png`,
      clip: { x: 560, y: 440, width: 780, height: 300 },
    });
  });
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [390, 844],
  [844, 390],
] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    test(`[render] the whole book is in view at ${width} by ${height}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto('/dev/phone?book=business');
      await page.waitForFunction(
        () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
        undefined,
        { timeout: 150_000 },
      );
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/book-fit-${width}x${height}.png` });
    });
  });
}
