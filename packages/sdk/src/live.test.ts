/**
 * Live integration tests. These hit real chains and the deployed registry — no mocks,
 * because the failure mode we care about is "the adapter silently stopped matching
 * reality", and a mock cannot catch that.
 *
 * Run: node --test --experimental-strip-types src/live.test.ts
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Corroborate, DEFAULT_REGISTRY } from './index.ts'
import { worldIdOrbAdapter, pohAdapter, circlesAdapter, coinbaseVerificationAdapter } from './adapters/index.ts'
import type { Address } from './types.ts'

const ontologyJson = JSON.parse(readFileSync(new URL('../../../ontology/adapters.json', import.meta.url), 'utf8'))
const knownIds: string[] = ontologyJson.adapters.map((a: { id: string }) => a.id)
const knownRoots: string[] = Object.keys(ontologyJson.trustRoots)

const UNREGISTERED = '0x000000000000000000000000000000000000dEaD' as Address

describe('registry (Sepolia, live)', () => {
  let client: Corroborate

  before(() => {
    client = new Corroborate({ knownIds, knownRoots })
  })

  test('loads the seeded ontology', async () => {
    const { adapters, revision } = await client.ontology()
    assert.ok(adapters.size >= 15, `expected >=15 adapters, got ${adapters.size}`)
    assert.ok(revision >= 15)

    const orb = adapters.get('world-id-orb')
    assert.ok(orb, 'world-id-orb must resolve by name, not hash')
    assert.equal(orb.trustRoot, 'iris-registry:world-orb')
    assert.equal(orb.evidenceClass, 'Uniqueness')
    assert.ok(orb.sourceURI.includes('research/'), 'every weight cites its source')
  })

  test('the ICAO cluster is present and shared — the core claim', async () => {
    const { adapters } = await client.ontology()
    const icao = [...adapters.values()].filter((a) => a.trustRoot === 'state-document:icao-9303')
    assert.ok(icao.length >= 3, `expected >=3 adapters on the passport root, got ${icao.length}`)
    const ids = icao.map((a) => a.id).sort()
    assert.ok(ids.includes('zkpassport') && ids.includes('self-protocol'))
  })

  test('discontinued protocols are retained and marked dead', async () => {
    const { adapters } = await client.ontology()
    assert.equal(adapters.get('civic-pass')?.live, false)
    assert.equal(adapters.get('brightid')?.live, false)
  })

  test('rent is never above forge for any adapter', async () => {
    const { adapters } = await client.ontology()
    for (const a of adapters.values()) {
      assert.ok(
        a.rentCostCents <= a.forgeCostCents,
        `${a.id}: renting (${a.rentCostCents}) should not cost more than forging (${a.forgeCostCents})`,
      )
    }
  })
})

describe('adapters against live chains', () => {
  test('World AgentBook responds and returns 0 for an unregistered address', async () => {
    const r = await worldIdOrbAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('PoH v2 responds', async () => {
    const r = await pohAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('Circles Hub responds', async () => {
    const r = await circlesAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('Coinbase/EAS responds', async () => {
    const r = await coinbaseVerificationAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })
})

describe('end to end', () => {
  test('an address with no credentials scores 0 with an explicit no-evidence caveat', async () => {
    const client = new Corroborate({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)

    assert.equal(r.subject, UNREGISTERED)
    assert.deepEqual(r.subjects, [UNREGISTERED])
    assert.equal(r.score, 0)
    assert.equal(r.independentRoots, 0)
    assert.ok(r.evidence.length >= 4, 'every adapter reports, even when it finds nothing')
    assert.ok(r.caveats.some((c) => c.code === 'no-evidence'))
    assert.ok(r.caveats.some((c) => c.code === 'independent-control-not-attested'))
    assert.equal(r.registryRevision! >= 15, true)
  })

  test('isHuman refuses to guess a threshold', async () => {
    const client = new Corroborate({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)
    // @ts-expect-error missing required argument is the point
    assert.throws(() => r.isHuman(), TypeError)
    assert.equal(r.isHuman(1), false)
  })

  test('a failing probe degrades the result instead of failing it', async () => {
    const client = new Corroborate({
      knownIds,
      knownRoots,
      adapters: [
        { adapterId: 'world-id-orb', probe: async () => ({ held: false, error: 'simulated outage' }) },
        pohAdapter(),
      ],
    })
    const r = await client.resolve(UNREGISTERED)

    const world = r.evidence.find((e) => e.adapterId === 'world-id-orb')
    assert.ok(world, 'the failed adapter is still reported')
    assert.equal(world.detail?.unavailable, true, 'and flagged unavailable, not silently negative')
    assert.equal(world.held, false)
  })
})

describe('subgraph enrichment (live)', () => {
  /**
   * The load-bearing claim, as a test: with the subgraph, a credential's age weight is
   * computed from its real on-chain claimedAt and the unknown-age caveat clears; without
   * it, the weight is the flagged 0.5 midpoint.
   *
   * It asserts the MECHANISM, not a specific age. PoH humanities expire (~1y) and must be
   * renewed, so "a currently-live two-year-old registration" is not a stable premise — the
   * durable invariant is that the enriched freshness is exactly the ramp value implied by
   * whatever date the subgraph returns. (An earlier version hardcoded a Sept-2024 date that
   * turned out to be a vouch-timestamp artifact of a subgraph indexing bug; asserting the
   * mechanism is why the corrected data no longer breaks it.) Skips while the subgraph is
   * still syncing so a fresh deployment does not redden the suite.
   */
  const SUBGRAPH = process.env.CORROBORATE_SUBGRAPH_URL ?? 'https://api.studio.thegraph.com/query/77602/poh/version/latest'
  // A currently-registered PoH human. Used only because it is live; the test reads its real
  // claimedAt rather than assuming one.
  const LIVE_POH = '0xd267eba602e692216703626a81157214b24c85fb' as Address
  const POH_HALF_LIFE_DAYS = 365 // must match ontology/adapters.json poh-v2

  test('enriched freshness is the ramp value implied by the real claimedAt', async (t) => {
    const { subgraphReady, pohEnrichment } = await import('./subgraph.ts')
    const enrichment = (await subgraphReady(SUBGRAPH)) ? await pohEnrichment(SUBGRAPH, LIVE_POH) : undefined
    if (!enrichment) {
      t.skip('subgraph not synced past this claim yet')
      return
    }

    const bare = await new Corroborate({ knownIds, knownRoots }).resolve(LIVE_POH)
    const enriched = await new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(LIVE_POH)

    const barePoh = bare.evidence.find((e) => e.adapterId === 'poh-v2')
    const richPoh = enriched.evidence.find((e) => e.adapterId === 'poh-v2')
    assert.ok(barePoh?.held && richPoh?.held, 'vector must still be registered on-chain')

    // Without ages, Ramp holds the flagged midpoint and flags it.
    assert.equal(barePoh.freshness, 0.5)
    assert.ok(bare.caveats.some((c) => c.code === 'issuance-date-unknown'))

    // With the subgraph, the date is real, the caveat clears, and the weight is exactly the
    // ramp value that date implies — self-consistent, no magic number.
    assert.equal(richPoh.issuedAt, enrichment.claimedAt)
    assert.ok(!enriched.caveats.some((c) => c.code === 'issuance-date-unknown'))

    const ageDays = (enriched.computedAt - enrichment.claimedAt) / 86_400
    const expected = 1 - 2 ** (-ageDays / POH_HALF_LIFE_DAYS)
    assert.ok(
      Math.abs(richPoh.freshness - expected) < 0.02,
      `enriched freshness ${richPoh.freshness} should match ramp(${ageDays.toFixed(0)}d)=${expected.toFixed(3)}`,
    )
    assert.notEqual(richPoh.freshness, 0.5, 'a computed weight is not the unknown-age midpoint')
  })
})
