import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { greenInside } from '../../scripts/greenShapes';

/** The same close-up as the other render checks, so the shots line up. */
const DIAL = { x: 520, y: 440, width: 220, height: 160 };
/** The run down the front of the phone and the puddle at its foot. */
const RUN = { x: 560, y: 555, width: 110, height: 180 };
const CARD = { cx: 456, cy: 260, rx: 200, ry: 134 };
const OUT = 'assets-src/renders';

async function open(page: Page, url: string, problems: string[]) {
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  await page.goto(url);
  // The scene has loaded once the candlelit veil has faded, and any replayed dialling is over.
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-hidden="true"].opacity-0') !== null &&
      document.querySelector('[data-replay="done"]') !== null,
    undefined,
    { timeout: 170_000 },
  );
  await page.waitForTimeout(1500);
}

test.describe('close-ups', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 });

  test('[render] goo-horror run', async ({ page }) => {
    test.setTimeout(200_000);
    const problems: string[] = [];
    await open(page, '/dev/phone', problems);
    await page.screenshot({ clip: RUN, path: `${OUT}/goo-horror-run.png` });
    expect(problems).toEqual([]);
  });

  for (const [name, url] of [
    ['dial-rest', '/dev/phone'],
    ['dial-1023', '/dev/phone?dial=1023'],
  ] as const) {
    test(`[render] goo-horror ${name}`, async ({ page }) => {
      test.setTimeout(200_000);
      const problems: string[] = [];
      await open(page, url, problems);
      const shot = await page.screenshot({ clip: DIAL, path: `${OUT}/goo-horror-${name}.png` });
      expect(greenInside(PNG.sync.read(shot), CARD), 'green pixels on the card').toBe(0);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('wide shots', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  for (const [name, url] of [
    ['wide-rest', '/dev/phone'],
    ['wide-1023', '/dev/phone?dial=1023'],
  ] as const) {
    test(`[render] goo-horror ${name}`, async ({ page }) => {
      test.setTimeout(200_000);
      const problems: string[] = [];
      await open(page, url, problems);
      await page.screenshot({ path: `${OUT}/goo-horror-${name}.png` });
      expect(problems).toEqual([]);
    });
  }
});
