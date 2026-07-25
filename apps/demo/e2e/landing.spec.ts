/**
 * Landing page E2E — the marketing surface is still a live product surface: the registry
 * line and the lookup widget both hit real chains, so these tests catch the same class of
 * silent drift the console tests do, plus plain breakage of the install CTAs.
 */
import { test, expect } from '@playwright/test'

const BEACON = '0x58b849f60b0515871fcfa80c7907d097571f2a12'

test.describe('Corroborate landing', () => {
  test('hero loads with the live registry line', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText(/to be human/i)
    // The headline must be VISIBLE, not merely present — the split-line masks hide the
    // text until a reveal class lands, and a missing CSS rule once shipped an invisible
    // hero. Assert the first line has actually risen into place.
    await expect
      .poll(
        async () =>
          page
            .locator('.sl-line')
            .first()
            .evaluate((el) => {
              const t = getComputedStyle(el).transform
              return (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)') && el.getBoundingClientRect().top < innerHeight
            }),
        { timeout: 10_000 },
      )
      .toBe(true)
    // Live Sepolia read, not copy: protocols + trust roots + revision.
    await expect(page.locator('#registry-line')).toContainText(/rev \d+/, { timeout: 60_000 })
    await expect(page.locator('#registry-line')).toContainText('trust roots')
    // A first-time visitor never faces an empty input.
    await expect(page.locator('.example-chip')).toHaveCount(3)
  })

  test('the print deforms under the pointer — the signature interaction', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    // Let the draw-in finish (it starts at idle and runs ~2.6s).
    await page.waitForTimeout(3600)
    const sample = () =>
      page.evaluate(() => {
        const c = document.getElementById('print') as HTMLCanvasElement
        const ctx = c.getContext('2d')!
        const d = ctx.getImageData(Math.round(c.width * 0.68), Math.round(c.height * 0.4), 200, 200).data
        let s = 0
        for (let i = 3; i < d.length; i += 40) s += d[i]
        return s
      })
    const before = await sample()
    expect(before).toBeGreaterThan(0) // the print must actually be drawn
    await page.mouse.move(1050, 430)
    await page.mouse.move(1062, 446, { steps: 4 })
    await page.waitForTimeout(400)
    const after = await sample()
    // Pressing near the core must displace ridges — pixel content changes in the region.
    expect(after).not.toBe(before)
  })

  test('widget resolves a live wallet and links to the console', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/')
    await page.fill('#lookup-input', BEACON)
    await page.click('#lookup-submit')
    const result = page.locator('#widget-result')
    await expect(result).toContainText(/adversary cost/i, { timeout: 180_000 })
    await expect(result).toContainText(/independent trust root/i)
    // The caveats are surfaced, not hidden, and the console is one click away.
    await expect(result).toContainText(/caveats/i)
    await expect(result.locator('a[href="/app.html"]')).toBeVisible()
  })

  test('MCP picker switches clients and shows a copyable command', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#mcp-command')).toContainText('claude mcp add corroborate')
    await page.getByRole('tab', { name: 'Cursor' }).click()
    await expect(page.locator('#mcp-command')).toContainText('mcpServers')
    await page.getByRole('tab', { name: 'Any MCP client' }).click()
    await expect(page.locator('#mcp-command')).toContainText('npx -y @corroborate/mcp')
    await expect(page.locator('#mcp-command .copy-btn')).toBeVisible()
  })

  test('console is reachable from the landing', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-links a[href="/app.html"]').click()
    await expect(page.locator('h1')).toContainText('Corroborate')
    await expect(page.locator('#lookup-form')).toBeVisible()
  })
})
