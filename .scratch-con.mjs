import { chromium } from '@playwright/test'
const base = '/tmp/claude-1000/-home-hugo-Projects/f89858e5-2ca1-420d-9d70-24112d525bae/scratchpad'
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
await page.goto('http://localhost:4197/app.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${base}/con-top.png` })
await page.locator('#compare').scrollIntoViewIfNeeded()
await page.waitForTimeout(60000) // compare panel resolves live against chains
await page.screenshot({ path: `${base}/con-compare.png` })
await browser.close()
console.log('done')
