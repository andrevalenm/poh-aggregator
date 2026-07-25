import { chromium } from '@playwright/test'
const base = '/tmp/claude-1000/-home-hugo-Projects/f89858e5-2ca1-420d-9d70-24112d525bae/scratchpad'
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
await page.goto('http://localhost:4188/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')))
await page.waitForTimeout(600)
const h = await page.evaluate(() => {
  const g = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().height ?? -1)
  return { world: g('#track-world'), ens: g('#track-ens'), graph: g('#track-graph') }
})
console.log('tile heights:', JSON.stringify(h), '| left stack:', h.world + h.ens + 22, 'vs right:', h.graph)
await page.locator('.sponsor-tracks').scrollIntoViewIfNeeded()
await page.evaluate(() => scrollBy(0, -80))
await page.waitForTimeout(600)
await page.screenshot({ path: `${base}/grid-now.png` })
await browser.close()
