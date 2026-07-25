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
   * Two Circles avatars that the ~2-month window used to get wrong, in the two available ways.
   *
   * `0x3fc5c255…` (registered block 36503055) was outside the window entirely: held on chain,
   * absent from the index, so its age could not be bounded and it scored at the flagged 0.5
   * midpoint. `0xd40133ea…` (block 36501311, one of the Hub's first registrations) was *in* the
   * index only because a trust edge materialised it, so its `registeredAt` was ~1.6 years late.
   * With the data source starting at the Hub's deployment both are dated from their own
   * `RegisterHuman`, and these tests check that against the chain's own logs rather than
   * against a number written here.
   */
  const CIRCLES_FIRST_REGISTRATIONS = [
    '0x3fc5c255a43aa5bc07a3129a0feb6c9e212ecb6d',
    '0xd40133ea712e7012a95fdd3c008ab58f7918b446',
  ] as Address[]
  /** The Hub's own first RegisterHuman, and the yardstick coverage is measured against. */
  const CIRCLES_FIRST_REGISTRATION_BLOCK = 36_501_311
  /** keccak256("RegisterHuman(address,address)"), the event the Circles date comes from. */
  const REGISTER_HUMAN_TOPIC = '0xfea7c1e1973c8be64c654eb06dc19ffbfc2e924d57544b9da0c0a27d3f893d77'
  /** keccak256("HumanityClaimed(bytes20,uint256)"). Not indexed, so the humanity id is in `data`. */
  const HUMANITY_CLAIMED_TOPIC = '0x8f7a3d8342a820e0b4964cc989eda69c533342896a0fa4a8379336dc0904cbe9'

  const gnosisRpc = async (method: string, params: unknown[]): Promise<any> => {
    const res = await fetch('https://rpc.gnosischain.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json()) as { result?: unknown; error?: { message: string } }
    if (json.error) throw new Error(`${method}: ${json.error.message}`)
    return json.result
  }
  const hexBlock = (n: number) => `0x${n.toString(16)}`

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

  test('the index reports how far back it can see, and the chain agrees with it', async (t) => {
    // Coverage is what makes an index's silence evidence, so it must not be a constant this
    // package asserts about a manifest in another one. The index states its own lower edge; the
    // chain is then asked whether anything was missed below it.
    const { indexCoverage, PROTOCOL_FIRST_CREDENTIAL_BLOCK } = await import('./subgraph.ts')
    const coverage = await indexCoverage(SUBGRAPH, 'circles')
    if (!coverage) {
      t.skip(`no Circles coverage record yet (${coverage === null ? 'still syncing or legacy deployment' : 'index unreachable'})`)
      return
    }
    assert.equal(
      PROTOCOL_FIRST_CREDENTIAL_BLOCK.circles,
      CIRCLES_FIRST_REGISTRATION_BLOCK,
      'the yardstick is the Hub\'s first registration',
    )
    assert.ok(
      coverage.firstEventBlock <= CIRCLES_FIRST_REGISTRATION_BLOCK,
      `earliest indexed Circles event ${coverage.firstEventBlock} must be at or before the first registration`,
    )
    assert.equal(coverage.completeHistory, true)

    // The chain-only half: no RegisterHuman exists below the edge the index claims. 36486014 is
    // the block the Hub's code first appears at, so this covers the contract's whole life.
    const below = await gnosisRpc('eth_getLogs', [
      {
        address: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
        topics: [REGISTER_HUMAN_TOPIC],
        fromBlock: hexBlock(36_486_014),
        toBlock: hexBlock(coverage.firstEventBlock - 1),
      },
    ])
    assert.equal(below.length, 0, 'nothing the index cannot see ever registered a human')
  })

  test('the avatars a windowed index mis-dated are now dated from their own registration', async (t) => {
    const { circlesIndexRead } = await import('./subgraph.ts')
    // One wide, topic-filtered query gives the registration block of both subjects, from the
    // chain, at run time — so the date being asserted is never a number written in this file.
    const logs: { blockNumber: string; topics: string[] }[] = await gnosisRpc('eth_getLogs', [
      {
        address: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
        topics: [REGISTER_HUMAN_TOPIC],
        fromBlock: hexBlock(CIRCLES_FIRST_REGISTRATION_BLOCK),
        toBlock: hexBlock(CIRCLES_FIRST_REGISTRATION_BLOCK + 5_000),
      },
    ])
    for (const subject of CIRCLES_FIRST_REGISTRATIONS) {
      const log = logs.find((l) => l.topics[1]?.toLowerCase().endsWith(subject.slice(2).toLowerCase()))
      assert.ok(log, `${subject} must have a RegisterHuman in the Hub's first registrations`)
      const registeredIn = parseInt(log.blockNumber, 16)

      const index = await circlesIndexRead(SUBGRAPH, subject)
      if (!index) {
        t.skip('the index did not answer')
        return
      }
      if (index.block < registeredIn || !index.entity) {
        t.skip(`index at block ${index.block} has not reached ${subject}'s registration (${registeredIn})`)
        return
      }
      assert.equal(
        index.entity.issuanceObserved,
        true,
        'the index saw the RegisterHuman itself, so the date is the date',
      )

      const header = await gnosisRpc('eth_getBlockByNumber', [hexBlock(registeredIn), false])
      assert.equal(
        index.entity.issuedAt,
        parseInt(header.timestamp, 16),
        `${subject}: the index's registeredAt is the timestamp of the block its RegisterHuman is in`,
      )

      const r = await new Corroborate({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(subject)
      const circles = r.evidence.find((e) => e.adapterId === 'circles-v2')
      if (!answered(t, circles, 'circles-v2')) return
      assert.ok(circles!.held, 'vector must still be a registered Circles human')
      assert.equal(circles!.issuedAt, index.entity.issuedAt)
      assert.equal(circles!.provenance?.dateFrom, 'index')
      assert.ok(
        !r.caveats.some((c) => c.code === 'index-coverage-partial' || c.code === 'issuance-date-lower-bound'),
        'neither approximation applies any more',
      )
      assert.notEqual(circles!.freshness, 0.5, 'a computed weight, not the unknown-age midpoint')
    }
  })

  test('an entity the index holds only through a vouch is bounded, never dated', async (t) => {
    // The direction claim, checked against the chain over the whole observable population: a
    // vouch is cast on a request that has not resolved, so a claim that follows it is the only
    // thing the chain should ever show. If one preceded a vouch-dated entity, `before-issuance`
    // would be wrong and the SDK would be capping ages it should be reading.
    const { pohIndexRead } = await import('./subgraph.ts')
    const res = await fetch(SUBGRAPH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '{ pohHumans(first: 50, where: {claimObserved: false}, orderBy: claimedAtBlock, orderDirection: asc) { id claimedAt claimedAtBlock } }',
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.json()) as {
      data?: { pohHumans: { id: string; claimedAt: string; claimedAtBlock: string }[] }
      errors?: { message: string }[]
    }
    if (body.errors?.length || !body.data) {
      t.skip(`the index cannot report claimObserved: ${body.errors?.[0]?.message ?? 'no data'}`)
      return
    }
    const vouchDated = body.data.pohHumans
    assert.ok(vouchDated.length > 0, 'the index should hold some humanities only through a vouch')

    const claims: { blockNumber: string; data: string }[] = await gnosisRpc('eth_getLogs', [
      {
        address: '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc',
        topics: [HUMANITY_CLAIMED_TOPIC],
        fromBlock: hexBlock(35_846_827),
        toBlock: 'latest',
      },
    ])
    const firstClaim = new Map<string, number>()
    for (const log of claims) {
      const humanityId = `0x${log.data.slice(2, 42)}`
      const block = parseInt(log.blockNumber, 16)
      if (!firstClaim.has(humanityId) || block < firstClaim.get(humanityId)!) firstClaim.set(humanityId, block)
    }
    assert.ok(claims.length > 1_000, `expected the protocol's full claim history, got ${claims.length}`)

    let laterClaim = 0
    let neverClaimed = 0
    for (const e of vouchDated) {
      const claimedIn = firstClaim.get(e.id.toLowerCase())
      if (claimedIn === undefined) {
        neverClaimed++
        continue
      }
      assert.ok(
        claimedIn > Number(e.claimedAtBlock),
        `${e.id}: the claim (block ${claimedIn}) must follow the vouch the index dated it from (${e.claimedAtBlock})`,
      )
      laterClaim++
    }
    assert.ok(laterClaim + neverClaimed === vouchDated.length)

    // And the SDK turns that into a bound rather than a date.
    const subject = vouchDated[0]!
    const view = await pohIndexRead(SUBGRAPH, subject.id)
    assert.equal(view?.entity?.issuanceObserved, false)
    const { reconcileIndexAndChain } = await import('./reconcile.ts')
    const r = reconcileIndexAndChain({
      chain: { held: true, block: view!.block + 100 },
      index: view!,
    })
    assert.equal(r.issuedAt, undefined, 'a vouch timestamp is not an issuance date')
    assert.equal(r.issuedAfter, Number(subject.claimedAt))
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
  })
})
