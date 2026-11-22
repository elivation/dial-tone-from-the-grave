import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const OUT = 'assets-src/renders';
const SIZES = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

/** Mean absolute difference per channel, 0 to 255, between two screenshots of the same size. */
function meanDifference(a: Buffer, b: Buffer): number {
  const one = PNG.sync.read(a);
  const two = PNG.sync.read(b);
  let total = 0;
  for (let i = 0; i < one.data.length; i += 4) {
    for (let c = 0; c < 3; c++) total += Math.abs((one.data[i + c] ?? 0) - (two.data[i + c] ?? 0));
  }
  return total / (one.width * one.height * 3);
}

// Run against a production build: RENDER_URL=http://localhost:3300 and no dev server. A person
// looks at the PNGs. The numbers are indicative only, because headless Chromium draws in software.
for (const size of SIZES) {
  test(`[render] poster, swap and settled scene at ${size.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await page.addInitScript(() => window.sessionStorage.setItem('dtftg_incoming_count', '999'));
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    await expect(page.getByRole('img', { name: /rotary phone/ })).toBeVisible();
    await page.waitForTimeout(1500);
    const scriptsAtRest = scripts.length;
    const poster = await page.screenshot({ path: `${OUT}/poster-${size.name}-poster.png` });

    const tappedAt = Date.now();
    await page.mouse.click(4, 4);
    await page
      .locator('picture')
      .locator('..')
      .and(page.locator('.invisible, .opacity-0'))
      .waitFor({
        state: 'attached',
        timeout: 100_000,
      });
    const firstFrameMs = Date.now() - tappedAt;
    const swapped = await page.screenshot({ path: `${OUT}/poster-${size.name}-swap.png` });
    await page.waitForTimeout(2000);
    const settled = await page.screenshot({ path: `${OUT}/poster-${size.name}-scene.png` });

    console.log(
      `${size.name}: tap to first 3D frame ${firstFrameMs} ms, scripts before tap ${scriptsAtRest}, ` +
        `after ${scripts.length}, poster vs settled scene ${meanDifference(poster, settled).toFixed(1)}/255, ` +
        `swap vs settled ${meanDifference(swapped, settled).toFixed(1)}/255`,
    );
  });
}
