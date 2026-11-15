import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { greenInside } from '../../scripts/greenShapes';

// The same framing as the main render check, so the close-ups line up.
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 });

const DIAL = { x: 520, y: 440, width: 220, height: 160 };
const CARD = { cx: 456, cy: 260, rx: 200, ry: 134 };

for (const wheel of [0, 90, 200]) {
  test(`[render] the dial close-up with the wheel turned ${wheel} degrees`, async ({ page }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(`/dev/phone?wheel=${wheel}`);
    await page.waitForFunction(
      () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
      undefined,
      { timeout: 150_000 },
    );
    await page.waitForTimeout(2000);
    const shot = await page.screenshot({
      clip: DIAL,
      path: `assets-src/renders/goo-check-${wheel}.png`,
    });
    // No pool, smear or drip crosses the centre card, whatever the wheel angle.
    expect(greenInside(PNG.sync.read(shot), CARD), 'green pixels on the card').toBe(0);
    expect(problems).toEqual([]);
  });
}
