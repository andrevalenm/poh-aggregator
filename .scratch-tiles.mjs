import { chromium } from '@playwright/test'
const base = '/tmp/claude-1000/-home-hugo-Projects/f89858e5-2ca1-420d-9d70-24112d525bae/scratchpad'
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto('http://localhost:4193/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')))
await page.waitForTimeout(600)
await page.locator('.sponsor-tracks').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.screenshot({ path: `${base}/tiles.png` })
await browser.close()
console.log('done')
