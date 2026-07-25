import { chromium } from '@playwright/test'
const base = '/tmp/claude-1000/-home-hugo-Projects/f89858e5-2ca1-420d-9d70-24112d525bae/scratchpad'
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4198/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'An Orb-verified wallet' }).click()
await page.waitForSelector('.w-result', { timeout: 60_000 })
await page.locator('.th-slider').fill('2.5')
await page.locator('.th-block').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: `${base}/ticks.png`, clip: { x: 100, y: 200, width: 1000, height: 400 } })
await browser.close()
console.log('done')
