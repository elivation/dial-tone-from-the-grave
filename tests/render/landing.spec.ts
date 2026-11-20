import { test, expect } from '@playwright/test';

const OUT = 'assets-src/renders';
const SIZES = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

// Run with RENDER_URL pointing at a production build. A person looks at the PNGs.
for (const size of SIZES) {
  test(`[render] landing at ${size.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    await expect(page.locator('[aria-hidden="true"].opacity-0').first()).toBeAttached({
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/landing-${size.name}.png` });
  });

  test(`[render] landing without WebGL at ${size.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof real>
      ) {
        const type: string = args[0];
        if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
        return real.apply(this, args);
      } as typeof real;
    });
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    await expect(page.getByText('This switchboard needs WebGL')).toBeVisible();
    await page.screenshot({ path: `${OUT}/landing-nowebgl-${size.name}.png` });
  });
}
