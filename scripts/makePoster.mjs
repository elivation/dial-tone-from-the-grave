// Renders the poster stills from our own 3D scene, using the production build.
//   pnpm build && pnpm start -p 3300   (in another terminal)
//   node scripts/makePoster.mjs [http://localhost:3300]
// The sources are kept in assets-src/renders, and the encoded files go to public/poster. The
// vignette and grain are left out of the shot because the page lays them over the poster itself.
import { mkdir, stat } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.argv[2] ?? 'http://localhost:3300';
const SHOTS = [
  { name: 'landscape', width: 1600, height: 1000, scale: 1 },
  // 390 x 844 CSS pixels at twice the density, the shape of a current phone held upright.
  { name: 'portrait', width: 390, height: 844, scale: 2 },
];
const SOURCES = 'assets-src/renders';
const OUT = 'public/poster';
const HIDE_OVERLAYS =
  '.scene-vignette, .scene-grain, footer, button, [role="status"] { visibility: hidden !important; }';

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
  });
  await page.addInitScript(() => window.sessionStorage.setItem('dtftg_incoming_count', '999'));
  await page.goto(BASE);
  // Any tap wakes the scene. Wait for the poster to hand over, then for the first frames to settle.
  await page.mouse.click(4, 4);
  await page.locator('picture').locator('..').and(page.locator('.invisible')).waitFor({
    state: 'attached',
    timeout: 120_000,
  });
  await page.waitForTimeout(3000);
  await page.addStyleTag({ content: HIDE_OVERLAYS });
  const source = `${SOURCES}/poster-source-${shot.name}.png`;
  await page.screenshot({ path: source });
  await page.close();
  const image = sharp(source);
  await image.clone().avif({ quality: 58, effort: 6 }).toFile(`${OUT}/desk-${shot.name}.avif`);
  await image.clone().webp({ quality: 80, effort: 6 }).toFile(`${OUT}/desk-${shot.name}.webp`);
  for (const ext of ['avif', 'webp']) {
    const { size } = await stat(`${OUT}/desk-${shot.name}.${ext}`);
    console.log(`${shot.name}.${ext}: ${(size / 1024).toFixed(1)} KB`);
  }
}
await browser.close();
