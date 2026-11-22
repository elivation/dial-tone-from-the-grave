import { test, expect, type Page } from '@playwright/test';

/** Collects every CSP violation the page reports, from the console and from the DOM event. */
async function watchForViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber} ${event.sample}`,
      );
    });
  });
  return violations;
}

async function waitForScene(page: Page) {
  await expect(page.locator('[aria-hidden="true"].opacity-0').first()).toBeAttached({
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
}

test('[Req 10.8] the home page sends a CSP and the other security headers', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain('supabase.co');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy'] ?? '').not.toMatch(/microphone=\(\)/);
});

test('[Req 10.8] the phone loads and a call is dialled with no CSP violations', async ({
  page,
}) => {
  const violations = await watchForViolations(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick up the handset' }).click();
  await waitForScene(page);
  await expect(page.getByRole('status').filter({ hasText: 'Dial a number.' })).toBeVisible();
  await page.keyboard.press('5');
  await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText('5');
  await page.waitForTimeout(1000);
  expect(violations).toEqual([]);
});
