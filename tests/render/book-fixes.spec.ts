import { test, expect, type Page } from '@playwright/test';
import {
  FIXTURE_BUSINESSES,
  FIXTURE_BUSINESSES_2,
} from '../../components/PhoneCanvas/__fixtures__/book';

const OUT = 'assets-src/renders';

/** A session of two invented pages, as the book would have kept it across a reload. */
const SESSION = JSON.stringify({
  pages: [FIXTURE_BUSINESSES, FIXTURE_BUSINESSES_2].map((results, i) => ({
    id: `p${i + 1}`,
    section: 'business',
    query: i === 0 ? 'plumber in Edenvale' : 'electrician in Bedfordview',
    results,
    calledIds: [],
    dogEared: false,
  })),
  current: 1,
  nextId: 3,
});

async function loadHome(page: Page) {
  await page.clock.install();
  await page.addInitScript((session) => {
    window.sessionStorage.setItem('dtftg_book', session);
  }, SESSION);
  await page.goto('/');
  await page.waitForFunction(
    () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
    undefined,
    { timeout: 150_000 },
  );
}

async function openBook(page: Page) {
  await page.getByRole('button', { name: 'Open the book' }).click();
  // The book drops onto the desk over 0.6 s, then the camera glides for about 0.6 s.
  await page.waitForTimeout(2500);
}

test.describe('book fixes, desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('[render] Open the book after a reload, then flip from the edge strip only', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await loadHome(page);
    await expect(page.getByRole('button', { name: 'Close the book' })).toHaveCount(0);
    await page.screenshot({ path: `${OUT}/book-fixes-open-button.png` });
    await openBook(page);
    await expect(page.getByRole('button', { name: 'Close the book' })).toBeFocused();
    await page.screenshot({ path: `${OUT}/book-fixes-book-open.png` });

    // Bare paper in the middle of the left page does nothing.
    await page.mouse.click(860, 680);
    await expect(page.getByText('Page 2 of 2')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The left edge strip goes back, with a leaf turning. The browser clock is paused and stepped
    // by hand, so the leaf can be caught at set points of a 0.7 s turn instead of by luck.
    const clip = { x: 640, y: 440, width: 760, height: 300 };
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 1000);
    await page.mouse.click(742, 600);
    await page.clock.runFor(50);
    let elapsed = 0;
    for (const [i, stop] of [200, 350, 500, 650].entries()) {
      await page.clock.runFor(stop - elapsed);
      elapsed = stop;
      await page.screenshot({ path: `${OUT}/book-fixes-turn-${i + 1}.png`, clip });
    }
    await page.clock.resume();
    await page.waitForTimeout(1200);
    await expect(page.getByText('Page 1 of 2')).toHaveCount(1);
    await page.screenshot({ path: `${OUT}/book-fixes-turned.png` });
    expect(problems).toEqual([]);
  });
});

test.describe('book fixes, phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('[render] portrait framing and the Listings sheet with big Dial buttons', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loadHome(page);
    await openBook(page);
    await page.screenshot({ path: `${OUT}/book-fixes-portrait.png` });

    await page.getByRole('button', { name: 'Listings' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Listings on this page' });
    await expect(sheet).toBeVisible();
    await page.screenshot({ path: `${OUT}/book-fixes-listings-sheet.png` });

    const dials = sheet.getByRole('button', { name: /^Dial / });
    const count = await dials.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await dials.nth(i).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const close = await sheet.getByRole('button', { name: 'Close listings' }).boundingBox();
    expect(close?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('book fixes, desktop has no Listings button', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('[render] the Listings button is hidden on a big screen', async ({ page }) => {
    test.setTimeout(180_000);
    await loadHome(page);
    await openBook(page);
    await expect(page.getByRole('button', { name: 'Listings' })).toBeHidden();
  });
});
