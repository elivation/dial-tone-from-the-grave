import { test, expect, type Page } from '@playwright/test';

const OUT = 'assets-src/renders';

async function openBook(page: Page, query: string) {
  await page.goto(`/dev/phone?${query}`);
  await page.waitForFunction(
    () => document.querySelector('[aria-hidden="true"].opacity-0') !== null,
    undefined,
    { timeout: 150_000 },
  );
  // The book drops onto the desk over 0.6 s, then the camera settles.
  await page.waitForTimeout(2500);
}

test.describe('the session book', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('[render] first page, then the page flipped to', async ({ page }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await openBook(page, 'book=business');
    await page.screenshot({ path: `${OUT}/book-session-page-1.png` });
    await openBook(page, 'book=business&page=1');
    await page.screenshot({ path: `${OUT}/book-session-page-2.png` });
    expect(problems).toEqual([]);
  });

  test('[render] a pencil ring and a dog-eared corner', async ({ page }) => {
    test.setTimeout(180_000);
    await openBook(page, 'book=business&called=fixture-b2,fixture-b3&dogear=1');
    await page.screenshot({ path: `${OUT}/book-session-marked.png` });
  });

  test.describe('close-up', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
    const clip = { x: 680, y: 480, width: 700, height: 240 };

    test('[render] the marked page and the second page, close up', async ({ page }) => {
      test.setTimeout(180_000);
      await openBook(page, 'book=business&called=fixture-b2,fixture-b3&dogear=1');
      await page.screenshot({ path: `${OUT}/book-session-marked-close.png`, clip });
      await openBook(page, 'book=business&page=1');
      await page.screenshot({ path: `${OUT}/book-session-page-2-close.png`, clip });
    });
  });
});

test.describe('clicking the page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('[render] clicking a listing on the painted page opens its details', async ({ page }) => {
    test.setTimeout(180_000);
    await openBook(page, 'book=business');
    await page.mouse.move(1147, 580);
    await page.screenshot({ path: `${OUT}/book-session-hover.png` });
    await page.mouse.click(1147, 580);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Dial / })).toBeVisible();
    await page.screenshot({ path: `${OUT}/book-session-detail.png` });
  });

  test('[render] clicking bare paper on the right page opens no details', async ({ page }) => {
    test.setTimeout(180_000);
    await openBook(page, 'book=business');
    // Bare paper below the last entry, on the right page.
    await page.mouse.click(1250, 610);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[render] the book at 390 by 844', async ({ page }) => {
    test.setTimeout(180_000);
    await openBook(page, 'book=business');
    await page.screenshot({ path: `${OUT}/book-session-mobile.png` });
  });
});
