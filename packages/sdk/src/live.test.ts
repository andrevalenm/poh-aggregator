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

describe('index and chain, reconciled against live data', () => {
  /**
   * These assert the MECHANISM, not a specific age. PoH humanities expire (~1y) and must be
   * renewed, so "a currently-live two-year-old registration" is not a stable premise — the
   * durable invariants are that the two sources agree, and that the score does not depend on
   * which of them answered. (An earlier version of this suite hardcoded a Sept-2024 date that
   * turned out to be a vouch-timestamp artifact of a subgraph indexing bug; asserting the
   * mechanism is why corrected data no longer breaks it.) Skips while the subgraph is still
   * syncing so a fresh deployment does not redden the suite.
   */
  const SUBGRAPH = process.env.CORROBORATE_SUBGRAPH_URL ?? 'https://api.studio.thegraph.com/query/77602/poh/version/latest'
  // A currently-registered PoH human. Used only because it is live; the tests read its real
  // dates rather than assuming any.
  const LIVE_POH = '0xd267eba602e692216703626a81157214b24c85fb' as Address
  const POH_HALF_LIFE_DAYS = 365 // must match ontology/adapters.json poh-v2

  /**
   * A Circles avatar registered at block 36503055, more than ten million blocks before the
   * subgraph's Circles window opens at 46300000, and never trusted inside that window — so it
   * is genuinely held on chain and genuinely absent from our index. Found by walking the Hub's
   * own RegisterHuman history; the test re-verifies both halves rather than trusting the note.
   */
  const CIRCLES_BEFORE_WINDOW = '0x3fc5c255a43aa5bc07a3129a0feb6c9e212ecb6d' as Address
  /**
   * A Circles avatar from the Hub's very first registrations (block 36501311) that the index
   * *does* have — but only because a trust edge inside the window materialised it, so its
   * `registeredAt` is ~1.6 years late and its `inviter` is null.
   */
  const CIRCLES_SIDE_EVENT_DATED = '0xd40133ea712e7012a95fdd3c008ab58f7918b446' as Address

  /**
   * Public RPCs blip. A probe that reported an `error` tells us nothing about the mechanism
   * under test, so skip loudly with the reason rather than reddening the suite — while a
   * probe that *answered* and answered wrongly still fails, which is the whole point of
   * testing against live chains.
   */
  function answered(
    t: { skip: (m: string) => void },
    evidence: { detail?: Record<string, unknown> } | undefined,
    what: string,
  ): boolean {
    if (!evidence) {
      t.skip(`${what}: no evidence returned`)
      return false
    }
    if (evidence.detail?.unavailable) {
      t.skip(`${what}: probe could not reach its source — ${String(evidence.detail.error)}`)
      return false
    }
    return true
  }

  test('the contract dates a PoH registration, and the index agrees', async (t) => {
    const { subgraphReady, pohIndexRead } = await import('./subgraph.ts')
    const index = (await subgraphReady(SUBGRAPH)) ? await pohIndexRead(SUBGRAPH, LIVE_POH) : undefined
    if (!index?.entity) {
      t.skip('subgraph not synced past this claim yet')
      return
    }

    const r = await new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(LIVE_POH)
    const poh = r.evidence.find((e) => e.adapterId === 'poh-v2')
    if (!answered(t, poh, 'poh-v2')) return
    assert.ok(poh!.held, 'vector must still be registered on-chain')

    // expirationTime - humanityLifespan is the claim timestamp, read from the contract with no
    // indexer involved. The index is a cross-check on it, not the source.
    assert.equal(poh.provenance?.dateFrom, 'chain')
    assert.ok(poh.issuedAt, 'the chain supplied a date')
    assert.ok(
      Math.abs(poh.issuedAt - index.entity.issuedAt) < 3600,
      `chain-derived date ${poh.issuedAt} should match the index's claimedAt ${index.entity.issuedAt}`,
    )
    assert.ok(!r.caveats.some((c) => c.code === 'index-date-disagrees-with-chain'))

    // And the weight is exactly the ramp value that date implies — self-consistent, no magic
    // number anywhere in the assertion.
    const ageDays = (r.computedAt - poh.issuedAt) / 86_400
    const expected = 1 - 2 ** (-ageDays / POH_HALF_LIFE_DAYS)
    assert.ok(
      Math.abs(poh.freshness - expected) < 0.02,
      `freshness ${poh.freshness} should match ramp(${ageDays.toFixed(0)}d)=${expected.toFixed(3)}`,
    )
    assert.notEqual(poh.freshness, 0.5, 'a computed weight is not the unknown-age midpoint')
  })

  test('the same PoH score comes out with the index and without it', async (t) => {
    // This is the torn read, gone. The old probe took held from the contract and the date from
    // the index, so a subject's score moved with our indexing infrastructure; now the contract
    // answers both and the index only corroborates.
    const [bare, enriched] = await Promise.all([
      new Corroborate({ knownIds, knownRoots }).resolve(LIVE_POH),
      new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(LIVE_POH),
    ])
    const barePoh = bare.evidence.find((e) => e.adapterId === 'poh-v2')
    const richPoh = enriched.evidence.find((e) => e.adapterId === 'poh-v2')
    if (!answered(t, barePoh, 'poh-v2 without index') || !answered(t, richPoh, 'poh-v2 with index')) return
    assert.ok(barePoh!.held && richPoh!.held, 'vector must still be registered on-chain')

    assert.equal(barePoh.issuedAt, richPoh.issuedAt)
    assert.equal(barePoh.freshness, richPoh.freshness)
    assert.ok(!bare.caveats.some((c) => c.code === 'issuance-date-unknown'))
    assert.ok(barePoh.provenance?.notes.includes('index-unavailable'), 'and it says no index was used')
    assert.ok(barePoh.provenance?.headBlock, 'the block the read was taken at is reported')
  })

  test('a real credential outside the index window is flagged, not silently re-dated', async (t) => {
    const r = await new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(
      CIRCLES_BEFORE_WINDOW,
    )
    const circles = r.evidence.find((e) => e.adapterId === 'circles-v2')
    if (!answered(t, circles, 'circles-v2')) return
    assert.ok(circles!.held, 'vector must still be a registered Circles human')

    // The index answered, at a block it named, and does not have this avatar. Absence in a
    // windowed data source is not evidence, so no bound is derived from it.
    assert.ok(circles.provenance?.indexedBlock, 'the indexed block is reported either way')
    assert.equal(circles.issuedAt, undefined)
    assert.equal(circles.issuedAfter, undefined, 'a windowed index must not bound the age')
    assert.ok(circles.provenance?.notes.includes('index-outside-coverage'))
    assert.ok(r.caveats.some((c) => c.code === 'index-coverage-partial'))
    assert.equal(circles.freshness, 0.5, 'the flagged midpoint, exactly as before the change')
  })

  test('an index date inferred from a trust edge is reported as a floor on age', async (t) => {
    const { circlesIndexRead } = await import('./subgraph.ts')
    const index = await circlesIndexRead(SUBGRAPH, CIRCLES_SIDE_EVENT_DATED)
    if (!index?.entity) {
      t.skip('subgraph has not indexed a trust edge for this avatar')
      return
    }
    assert.equal(
      index.entity.issuanceObserved,
      false,
      'this avatar registered before the window, so the index never saw its RegisterHuman',
    )

    const r = await new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(
      CIRCLES_SIDE_EVENT_DATED,
    )
    const circles = r.evidence.find((e) => e.adapterId === 'circles-v2')
    if (!answered(t, circles, 'circles-v2')) return
    assert.ok(circles!.held)
    assert.equal(circles!.issuedAt, index.entity.issuedAt, 'kept: it understates age, never inflates')
    assert.ok(r.caveats.some((c) => c.code === 'issuance-date-lower-bound'))
  })
})
