import { chromium } from '@playwright/test'
const base = '/tmp/claude-1000/-home-hugo-Projects/f89858e5-2ca1-420d-9d70-24112d525bae/scratchpad'
const browser = await chromium.launch({ headless: false })
for (const [w, hgt, name] of [[768, 1024, 't768'], [390, 844, 't390']]) {
  const page = await browser.newPage({ viewport: { width: w, height: hgt } })
  await page.goto('http://localhost:4198/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${base}/${name}-hero.png` })
  await page.close()
}
await browser.close()
console.log('done')
