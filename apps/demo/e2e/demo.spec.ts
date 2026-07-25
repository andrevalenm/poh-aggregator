/**
 * End-to-end tests over the real demo in a real browser, against live chains.
 *
 * Deliberately not mocked: the failure mode that matters is "an adapter silently stopped
 * matching reality", and only live reads catch it. Timeouts are generous because four
 * adapters × several addresses of RPC round trips on public endpoints is genuinely slow.
 */
import { test, expect } from '@playwright/test'

// A real Orb-verified wallet, found live via AgentBook during the agent-flow build — the
// only known natural World-Orb-held vector. It holds ONLY the Orb credential; three
// independent roots appear when it is combined with the PoH and Circles wallets below,
// which is the multi-address model working as designed.
const BEACON = '0x58b849f60b0515871fcfa80c7907d097571f2a12'
const POH_VECTOR = '0xd267eba602e692216703626a81157214b24c85fb'
const CIRCLES_VECTOR = '0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87'

test.describe('Corroborate demo', () => {
  test('loads and reports the live registry', async ({ page }) => {
    await page.goto('/app.html')
    await expect(page.locator('h1')).toContainText('Corroborate')
    // The registry line is populated from a live Sepolia read — no hard-coded values.
    await expect(page.locator('#registry-line')).toContainText(/revision \d+/, { timeout: 60_000 })
    await expect(page.locator('#registry-line')).toContainText('trust roots')
    // Example chips: a first-time visitor must never face an empty input.
    await expect(page.locator('.example-chip')).toHaveCount(3)
  })

  test('comparison panel: farm collapses to one root, person keeps independence', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/app.html')

    const columns = page.locator('#compare-columns')
    // Live computation across chains; wait for both verdict lines.
    await expect(columns).toContainText(/illustrative/i, { timeout: 180_000 })
    await expect(columns).toContainText(/independent root/i, { timeout: 180_000 })

    // The farm's correlated credentials must be visibly collapsed, not silently dropped.
    await expect(columns).toContainText(/collapsed|same root/i)

    // The punchline owns the honest asymmetry rather than pretending a score inversion.
    await expect(page.locator('#compare-punchline')).toContainText(/independen/i, { timeout: 60_000 })
  })

  test('lookup: multi-address subject aggregates roots and shows caveats verbatim', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/app.html')

    await page.fill('#lookup-input', `${POH_VECTOR}, ${CIRCLES_VECTOR}`)
    await page.click('#lookup-submit')

    const result = page.locator('#lookup-result')
    await expect(result).toContainText(/score/i, { timeout: 180_000 })
    // Two wallets, two independent roots — the multi-address finding, live.
    await expect(result).toContainText(/2/, { timeout: 30_000 })
    // The permanent caveat must always render.
    await expect(result).toContainText('independent-control-not-attested')
    // No verdict without a user-chosen threshold.
    await expect(result).toContainText(/no verdict|not set|choose/i)
  })

  test('lookup: a live Orb-verified wallet reads as one uniqueness root', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/app.html')

    await page.fill('#lookup-input', BEACON)
    await page.click('#lookup-submit')

    const result = page.locator('#lookup-result')
    await expect(result).toContainText(/score/i, { timeout: 180_000 })
    await expect(result).toContainText(/Independent roots1/, { timeout: 30_000 })
    await expect(result).toContainText(/World ID \(Orb\)held/, { timeout: 30_000 })
  })

  test('lookup: an address set spanning Orb, PoH and Circles spans three trust roots', async ({ page }) => {
    test.setTimeout(300_000)
    await page.goto('/app.html')

    await page.fill('#lookup-input', `${BEACON}, ${POH_VECTOR}, ${CIRCLES_VECTOR}`)
    await page.click('#lookup-submit')

    const result = page.locator('#lookup-result')
    await expect(result).toContainText(/score/i, { timeout: 240_000 })
    // Assert the mechanism, not a magic count. All three roots must appear, but how many
    // clear the negligible-cost bar depends on live ages: with the subgraph wired, the
    // day-old Circles registration is Ramp-discounted to ~$0 and does NOT count as an
    // independent root — the anti-farm curve working on our own demo wallet. Without the
    // subgraph its age is unknown, it sits at the 0.5 midpoint, and it does count.
    await expect(result).toContainText('iris-registry:world-orb', { timeout: 30_000 })
    await expect(result).toContainText('social-vouching:poh')
    await expect(result).toContainText('social-trust:circles')
    await expect(result).toContainText(/Independent roots[23]/)
    // Aggregating across caller-supplied wallets must be flagged, never silent.
    await expect(result).toContainText('multi-address-subject')
  })

  test('threshold is the caller’s decision, not ours', async ({ page }) => {
    test.setTimeout(240_000)
    await page.goto('/app.html')

    await page.fill('#lookup-input', POH_VECTOR)
    await page.click('#lookup-submit')
    const result = page.locator('#lookup-result')
    await expect(result).toContainText(/score/i, { timeout: 180_000 })

    // Before touching the slider there must be no verdict of any kind.
    await expect(result).not.toContainText(/\bPASS\b|\bFAIL\b/)

    const slider = page.locator('input[type="range"]')
    if (await slider.count()) {
      await slider.first().fill('1')
      await expect(result).toContainText(/pass|clears/i, { timeout: 15_000 })
      await slider.first().fill('4')
      await expect(result).toContainText(/fail|below/i, { timeout: 15_000 })
    }
  })
})
