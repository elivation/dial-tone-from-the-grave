import { test, expect } from './quietPhone';
import { PNG } from 'pngjs';
import { greenInside, greenShapes } from '../../scripts/greenShapes';

// A fixed viewport and pixel ratio, so the camera frames the dial the same way on every machine.
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 });

/** The dial close-up, in CSS pixels. The card and the finger holes are all inside it. */
const DIAL = { x: 520, y: 440, width: 220, height: 160 };
/** The cream card in the middle of the dial, with its brass rim, in pixels of the close-up (4x the CSS size). */
const CARD = { cx: 456, cy: 260, rx: 200, ry: 134 };

test('[render] the slime shows in every finger hole, as blobs, and stays off the centre card', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));

  await page.goto('/');
  await expect(page.locator('[aria-hidden="true"].opacity-0').first()).toBeAttached({
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);

  const close = PNG.sync.read(await page.screenshot({ clip: DIAL }));
  const shapes = greenShapes(close, 400);

  // The point of the green: every hole can be seen against the black phone. Some neighbours may merge.
  expect(shapes.length, 'green shapes in the dial').toBeGreaterThanOrEqual(8);
  // Blobs, never wires. A round blob measures near 1, and a wire measures 6 or more.
  for (const shape of shapes)
    expect(shape.aspect, `shape at ${shape.cx.toFixed(0)},${shape.cy.toFixed(0)}`).toBeLessThan(4);
  // No slime shows on the 1023 card.
  expect(greenInside(close, CARD), 'green pixels on the card').toBe(0);
  expect(problems).toEqual([]);
});
