// Generates apps/demo/public/og.png (1200x630 social card) by screenshotting
// the landing hero served at http://localhost:4188/.
// Run from the repo root: node scripts/gen-og.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: false,
  env: { ...process.env, DISPLAY: ':0' },
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('http://localhost:4188/', { waitUntil: 'networkidle' });
// Let the procedural thumbprint finish drawing and fonts settle.
await page.waitForTimeout(3500);
await page.addStyleTag({
  content:
    'nav, .scroll-hint { display: none !important; } html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }',
});
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: 'apps/demo/public/og.png' });
await browser.close();
console.log('wrote apps/demo/public/og.png');
