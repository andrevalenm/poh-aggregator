/**
 * Landing page E2E — the marketing surface is still a live product surface: the registry
 * line and the lookup widget both hit real chains, so these tests catch the same class of
 * silent drift the console tests do, plus plain breakage of the install CTAs.
 */
import { test, expect } from '@playwright/test'

const BEACON = '0x58b849f60b0515871fcfa80c7907d097571f2a12'

test.describe('Print landing', () => {
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

  test('widget answers a live wallet with an attributed verdict', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/')
    await page.fill('#lookup-input', BEACON)
    await page.click('#lookup-submit')
    const result = page.locator('#widget-result')

    // A visitor gets a binary answer without touching a control — the default rule is applied
    // on arrival — and the answer is a count of independent roots, never a log score.
    await expect(result.locator('.verdict-word')).toHaveText(/^(Yes|No)$/, { timeout: 180_000 })
    await expect(result.locator('.verdict-rule')).toContainText(/The rule asks for 2 or more/)
    await expect(result.locator('.rule-line')).toContainText('By the rule: at least')
    await expect(result.locator('.rule-tag')).toHaveText('our default')

    // The permanent caveat is on the sheet, not behind the disclosure.
    await expect(result.locator('.ans-note.is-permanent')).toContainText(
      /controls their own credentials/,
    )

    // The rule is the viewer's to change, and the verdict follows it.
    await result.locator('.rule-opt', { hasText: '1' }).click()
    await expect(result.locator('.verdict-rule')).toContainText(/The rule asks for 1 or more/)
    await expect(result.locator('.rule-tag')).toHaveText('your choice')

    // The console is absorbed: one keyboard-operable disclosure unfolds the whole record in
    // place, score included — demoted, never dropped.
    const toggle = result.locator('.console-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(result.locator('#console-panel')).toBeHidden()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(result.locator('.rec')).toContainText('Root-cost score')
    await expect(result.locator('.evd-rows')).toBeVisible()
    await expect(result.locator('.cv-list')).toBeVisible()
    await expect(result).toContainText('independent-control-not-attested')
  })

  test('protocol counts come from the registry, not from prose', async ({ page }) => {
    await page.goto('/')
    // The words "forty" and "thirty" used to be typed into the copy and had already drifted.
    await expect(page.locator('body')).not.toContainText(/\bforty\b|\bthirty\b/i)
    // Every count is painted from the live registry read.
    const integrated = page.locator('[data-count="integrated"]').first()
    await expect(integrated).toHaveText(/^\d+$/, { timeout: 60_000 })
    await expect(page.locator('.coverage-row')).toHaveCount(3)
  })

  test('MCP picker switches clients and shows a copyable command', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#mcp-command')).toContainText('claude mcp add print')
    await page.getByRole('tab', { name: 'Cursor' }).click()
    await expect(page.locator('#mcp-command')).toContainText('mcpServers')
    await page.getByRole('tab', { name: 'Any MCP client' }).click()
    await expect(page.locator('#mcp-command')).toContainText('npx -y @printid/mcp')
    await expect(page.locator('#mcp-command .copy-btn')).toBeVisible()
  })

  test('sequential anchor clicks land on target — no Lenis overshoot', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(800)
    // The QA repro: a SECOND anchor click, made from a Lenis-scrolled position, used to
    // land at target + currentScroll. Two clicks in a row must both land within a few px.
    const landedAt = async (href: string) => {
      await page.click(`.nav-links a[href="${href}"]`)
      await page.waitForTimeout(1900) // glide duration + settle
      return page.evaluate((h) => Math.round(document.querySelector(h)!.getBoundingClientRect().top), href)
    }
    expect(Math.abs(await landedAt('#install'))).toBeLessThan(6)
    expect(Math.abs(await landedAt('#how'))).toBeLessThan(6)
    expect(Math.abs(await landedAt('#try'))).toBeLessThan(6)
  })

  test('the SDK copy button is alive', async ({ page }) => {
    await page.goto('/')
    const btn = page.locator('button[data-copy]')
    await btn.scrollIntoViewIfNeeded()
    await btn.click()
    // Bound + clipboard path succeeded (execCommand works even without permissions).
    await expect(btn).toHaveText(/copied|select it/)
    await expect(btn).not.toHaveText('copy', { timeout: 100 })
  })

  test('the workbench deep-link still renders (unlinked, kept for tooling)', async ({ page }) => {
    await page.goto('/app.html')
    await expect(page.locator('h1')).toContainText('Print')
    await expect(page.locator('#lookup-form')).toBeVisible()
    // And the landing itself no longer links to it — the experience is one page.
    await page.goto('/')
    await expect(page.locator('.nav-links a[href="/app.html"]')).toHaveCount(0)
  })
})
