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
import { Print, DEFAULT_REGISTRY } from './index.ts'
import {
  worldIdOrbAdapter,
  pohAdapter,
  circlesAdapter,
  coinbaseVerificationAdapter,
  readTermHistory,
  termForLocalExpiry,
  POH_V2_DEPLOY_BLOCK,
  POH_V2_DEPLOYED_AT,
} from './adapters/index.ts'
import type { Address } from './types.ts'

const ontologyJson = JSON.parse(readFileSync(new URL('../../../ontology/adapters.json', import.meta.url), 'utf8'))
const knownIds: string[] = ontologyJson.adapters.map((a: { id: string }) => a.id)
const knownRoots: string[] = Object.keys(ontologyJson.trustRoots)

const UNREGISTERED = '0x000000000000000000000000000000000000dEaD' as Address

describe('registry (Sepolia, live)', () => {
  let client: Print

  before(() => {
    client = new Print({ knownIds, knownRoots })
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
  /**
   * The burn address turned out to hold a **planted Lens account** once the Lens probe landed —
   * 0.36c of effective cost, well under the 10c independence floor. Nobody controls 0x…dEaD, so
   * nobody consented to this: it is a live demonstration of the property the Lens research
   * documents, that a Lens account can be transferred to an address that never asked for it and
   * `held` must therefore never be read as an act of the subject.
   *
   * So this no longer asserts `score === 0`. It asserts the thing that actually matters and is
   * still true: a planted, sub-floor credential yields **no independent root**, which is what any
   * policy gates on. Asserting the score would be asserting that nobody ever plants anything on
   * this address again, which is not ours to promise.
   */
  test('an address nobody controls yields no independent root', async () => {
    const client = new Print({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)

    assert.equal(r.subject, UNREGISTERED)
    assert.deepEqual(r.subjects, [UNREGISTERED])
    assert.equal(r.independentRoots, 0, 'sub-floor evidence must not create a root')
    assert.ok(r.evidence.length >= 4, 'every adapter reports, even when it finds nothing')
    assert.ok(r.caveats.some((c) => c.code === 'independent-control-not-attested'))
    assert.equal(r.registryRevision! >= 15, true)

    // Anything found here is below the floor by construction; if something above it ever appears,
    // this fixture has stopped being an unowned address and the test should say so loudly.
    for (const e of r.evidence.filter((x) => x.held)) {
      assert.ok(
        e.effectiveCostCents < 10,
        `${e.adapterId} on the burn address is above the independence floor (${e.effectiveCostCents}c) — pick a different fixture`,
      )
    }
  })

  test('isHuman refuses to guess a threshold', async () => {
    const client = new Print({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)
    // @ts-expect-error missing required argument is the point
    assert.throws(() => r.isHuman(), TypeError)
    assert.equal(r.isHuman(1), false)
  })

  test('a failing probe degrades the result instead of failing it', async () => {
    const client = new Print({
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
  const SUBGRAPH = process.env.PRINT_SUBGRAPH_URL ?? 'https://api.studio.thegraph.com/query/77602/poh/version/latest'
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

    const r = await new Print({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(LIVE_POH)
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
      new Print({ knownIds, knownRoots }).resolve(LIVE_POH),
      new Print({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(LIVE_POH),
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

      const r = await new Print({ knownIds, knownRoots, subgraphUrl: SUBGRAPH }).resolve(subject)
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

  // ------------------------------------------- the humanity the subject has since lost
  //
  // PoH v2 never deletes an expired humanity, so the end of a credential it stopped honouring
  // is still in current state — which is the only reason an as-of score can see one. The index
  // is used here to *find* lapsed subjects and never to assert anything about them: every
  // claim below is checked against the contract, its own storage, and its own event log.

  const POH_V2 = '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc'

  /** Humanities the index knows about, oldest claim first — the cohort most likely to have lapsed. */
  async function indexedHumanities(t: { skip: (m: string) => void }, first = 60) {
    const res = await fetch(SUBGRAPH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{ pohHumans(first: ${first}, orderBy: claimedAt, orderDirection: asc) { id humanityId claimedAt } }`,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.json()) as {
      data?: { pohHumans: { id: string; humanityId: string; claimedAt: string }[] }
      errors?: { message: string }[]
    }
    if (body.errors?.length || !body.data?.pohHumans.length) {
      t.skip(`the index could not list humanities: ${body.errors?.[0]?.message ?? 'no data'}`)
      return undefined
    }
    return body.data.pohHumans
  }

  /**
   * The registry's own view of a humanity, read through viem against a fresh client rather
   * than through the adapter — the adapter is the thing under test.
   */
  const POH_V2_READ_ABI = [
    'function getHumanityInfo(bytes20) view returns (bool vouching, bool pendingRevocation, uint48 nbPendingRequests, uint40 expirationTime, address owner, uint256 nbRequests)',
    'function humanityOf(address) view returns (bytes20)',
    'function humanityLifespan() view returns (uint40)',
  ] as const

  async function pohV2Client() {
    const { createPublicClient, http, parseAbi } = await import('viem')
    const { gnosis } = await import('viem/chains')
    const client = createPublicClient({ chain: gnosis, transport: http('https://rpc.gnosischain.com') })
    const abi = parseAbi(POH_V2_READ_ABI)
    return {
      humanityInfo: async (humanityId: string) => {
        const i = await client.readContract({
          address: POH_V2,
          abi,
          functionName: 'getHumanityInfo',
          args: [humanityId as `0x${string}`],
        })
        return { expirationTime: Number(i[3]), owner: i[4] as string, nbRequests: Number(i[5]) }
      },
      humanityOf: (account: string) =>
        client.readContract({ address: POH_V2, abi, functionName: 'humanityOf', args: [account as `0x${string}`] }),
      lifespan: () =>
        client.readContract({ address: POH_V2, abi, functionName: 'humanityLifespan' }).then(Number),
    }
  }

  /**
   * Every term the registry has ever granted, swept from `DurationsChanged` at run time.
   *
   * Memoised across the tests in this suite because it is one full-range `eth_getLogs` and the
   * answer is a property of the contract, not of the subject being probed.
   */
  let termHistory: Promise<Awaited<ReturnType<typeof readTermHistory>>> | undefined
  const pohTermHistory = async (lifespanAtHead: number) => {
    const { createPublicClient, http } = await import('viem')
    const { gnosis } = await import('viem/chains')
    const client = createPublicClient({ chain: gnosis, transport: http('https://rpc.gnosischain.com') })
    return (termHistory ??= (async () =>
      readTermHistory(client, await client.getBlockNumber(), POH_V2, {
        deployBlock: POH_V2_DEPLOY_BLOCK,
        deployedAt: POH_V2_DEPLOYED_AT,
        lifespanAtHead,
      }))())
  }

  test('no term but the one at head has ever been granted, and the log is what says so', async () => {
    // The premise behind every PoH v2 date: `expirationTime - humanityLifespan()` is the claim
    // second only if the value at head is the value that was in force at the write. It is
    // governance-settable — `changeDurations` writes it, and PoH v1's equivalent has already moved
    // once — so the probe sweeps `DurationsChanged`, the only event any writer after `initialize`
    // emits, and reads the answer off the timeline rather than assuming it.
    //
    // Nothing in here is remembered. The term at head, the head block, and the whole log set are
    // read each run; the assertions are that the timeline *explains* head and covers the
    // contract's life without a gap, which stays true on the day a change does land.
    const { createPublicClient, http } = await import('viem')
    const { gnosis } = await import('viem/chains')
    const client = createPublicClient({ chain: gnosis, transport: http('https://rpc.gnosischain.com') })
    const lifespanAtHead = await (await pohV2Client()).lifespan()
    const history = await pohTermHistory(lifespanAtHead)

    assert.ok(history, 'the sweep answered — an unread sweep is not an empty one')
    assert.equal(history.observed, true)
    assert.ok(history.eras.length >= 1)
    assert.equal(history.eras[0]!.from, POH_V2_DEPLOYED_AT, 'the timeline starts at the deployment')

    const running = history.eras[history.eras.length - 1]!
    assert.equal(running.until, undefined, 'the last era is the one still running')
    assert.equal(running.seconds, lifespanAtHead, 'and its term is the one the getter returns')

    // Contiguous, with every boundary a real block on this chain — so a change, when one lands,
    // is dated by the chain rather than by us.
    for (let i = 1; i < history.eras.length; i++) {
      assert.equal(history.eras[i - 1]!.until, history.eras[i]!.from, 'eras leave no gap')
      const b = await client.getBlock({ blockNumber: BigInt(history.eras[i]!.block!) })
      assert.equal(Number(b.timestamp), history.eras[i]!.from, 'each boundary is its own block')
    }

    // And the consequence, stated as arithmetic: a claim mined a day ago expires one running-era
    // term from then, and the resolver hands back that same term rather than guessing.
    const now = Number((await client.getBlock()).timestamp)
    const solved = termForLocalExpiry(history, now - 86_400 + running.seconds!, now)
    assert.equal(solved.kind === 'settled' ? solved.term : 0, running.seconds)
  })

  test('a humanity that expired is a closed window, and the claim log is its start', async (t) => {
    // The mechanism, not a magic number: the probe reads state only, and the assertion holds
    // that state against a completely different subsystem of the node — the event log the
    // protocol emitted when it accepted the claim. If `expirationTime - humanityLifespan()` is
    // the claim second, the log for that humanity is in a block with exactly that timestamp.
    const humanities = await indexedHumanities(t)
    if (!humanities) return

    const probe = pohAdapter()
    let found: { subject: Address; evidence: Awaited<ReturnType<typeof probe.probe>> } | undefined
    for (const h of humanities) {
      const evidence = await probe.probe(h.id as Address)
      // An imported humanity is dated from its grant block, not from a claim this registry
      // logged, so it cannot answer the question below. It has its own test.
      if (evidence.detail?.termImported === true) continue
      if (evidence.heldUntil !== undefined && evidence.issuedAt !== undefined) {
        found = { subject: h.id as Address, evidence }
        break
      }
    }
    if (!found) {
      t.skip('no lapsed humanity with a locally resolved claim in the sampled cohort')
      return
    }
    const { subject, evidence } = found

    assert.equal(evidence.held, false, 'a lapsed humanity is not held today, whatever else is true')
    assert.equal(evidence.error, undefined)
    assert.ok(evidence.provenance?.notes.includes('date-from-lapsed-verification'))

    // 1. the end is the number the contract still holds, and the contract still says it is theirs
    const poh = await pohV2Client()
    const humanityId = String(evidence.detail!.lapsedHumanityId)
    const info = await poh.humanityInfo(humanityId)
    assert.equal(info.owner.toLowerCase(), subject.toLowerCase(), 'the record is still attributable')
    assert.equal(info.expirationTime, evidence.heldUntil)
    assert.ok(info.nbRequests >= 1, 'this contract resolved the request that wrote the expiry')
    assert.equal(
      (await poh.humanityOf(subject)).toLowerCase(),
      '0x0000000000000000000000000000000000000000',
      'and the contract itself will no longer name the humanity — which is why storage is read',
    )

    // 2. the start is that end minus the term the contract publishes — and specifically the term
    //    that was in force when the expiry was written, which the registry's own change log names.
    //    A literal here would have been a remembered number; `changeDurations` is governance-
    //    settable, so the term is swept rather than recalled.
    const lifespan = await poh.lifespan()
    const history = await pohTermHistory(lifespan)
    assert.ok(history, 'the DurationsChanged sweep answered')
    const era = termForLocalExpiry(history, evidence.heldUntil!, Math.floor(Date.now() / 1000))
    assert.equal(era.kind, 'settled', 'exactly one term this registry granted explains the expiry')
    assert.equal(evidence.issuedAt, evidence.heldUntil! - (era.kind === 'settled' ? era.term : 0))

    // 3. and that second is the block the chain accepted the claim in — the probe never looked
    const claims: { blockNumber: string; data: string }[] = await gnosisRpc('eth_getLogs', [
      { address: POH_V2, topics: [HUMANITY_CLAIMED_TOPIC], fromBlock: hexBlock(35_846_827), toBlock: 'latest' },
    ])
    const mine = claims.filter((l) => `0x${l.data.slice(2, 42)}` === humanityId.toLowerCase())
    assert.ok(mine.length >= 1, `the registry logged no claim for ${humanityId}`)
    const latest = mine.reduce((a, b) => (parseInt(a.blockNumber, 16) > parseInt(b.blockNumber, 16) ? a : b))
    const claimBlock = await gnosisRpc('eth_getBlockByNumber', [latest.blockNumber, false])
    assert.equal(
      parseInt(claimBlock.timestamp, 16),
      evidence.issuedAt,
      'the derived start is the second the claim was mined in',
    )

    // 4. an instant inside the window is a credential; one second after it is not
    const { applyAsOfToEvidence } = await import('./as-of.ts')
    const { adapters } = await new Print({ knownIds, knownRoots }).ontology()
    const asEvidence = [
      {
        adapterId: 'poh-v2',
        adapterName: 'Proof of Humanity v2',
        evidenceClass: 'Uniqueness' as const,
        trustRoot: 'social-vouching:poh',
        observedOn: subject,
        forgeCostCents: 0,
        rentCostCents: 0,
        live: true,
        sourceURI: '',
        held: false,
        issuedAt: evidence.issuedAt,
        heldUntil: evidence.heldUntil,
        freshness: 0.5,
        effectiveCostCents: 0,
      },
    ]
    const midpoint = Math.floor((evidence.issuedAt! + evidence.heldUntil!) / 2)
    const inside = applyAsOfToEvidence(asEvidence, midpoint, adapters)
    assert.equal(inside.evidence[0]!.held, true, 'held at an instant inside its own window')
    assert.deepEqual(inside.ceasedAfterAsOf, ['poh-v2'])
    assert.ok(inside.evidence[0]!.effectiveCostCents > 0, 'and priced at what it was worth then')

    const after = applyAsOfToEvidence(asEvidence, evidence.heldUntil!, adapters)
    assert.equal(after.evidence[0]!.held, false, 'and gone at the instant it expired')
  })

  test('a humanity another chain set the term for is not dated by subtracting ours', async (t) => {
    // The acceptance test, and every number in it is re-derived from the chain each run.
    //
    // `ccGrantHumanity` copies an expiry settled on another instance, so for an imported humanity
    // `expirationTime - humanityLifespan()` is arithmetic about a contract we never read. The
    // sample is not a fixture: the registry's own grant log is swept here, one grant whose expiry
    // is *still* the imported one is picked out of it, and the origin instance is then required to
    // reproduce that expiry to the second before anything is claimed about it.
    const grants: { blockNumber: string; topics: string[]; data: string }[] = await gnosisRpc(
      'eth_getLogs',
      [
        {
          address: POH_V2,
          topics: ['0x4a05b98253015fe18cb57d239b4209ea44674e1b9a7c9bf0889d401d97152b14'],
          fromBlock: hexBlock(35_846_827),
          toBlock: 'latest',
        },
      ],
    )
    if (!grants?.length) {
      t.skip('the node refused the cross-chain grant log sweep')
      return
    }

    const { createPublicClient, http, parseAbi } = await import('viem')
    const { mainnet } = await import('viem/chains')
    const { POH_V1_REGISTRY } = await import('./adapters/index.ts')
    const eth = createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') })
    const originAbi = parseAbi([
      'function getSubmissionInfo(address) view returns (uint8 status, uint64 submissionTime, uint64 index, bool registered, bool hasVouched, uint256 numberOfRequests)',
      'function submissionDuration() view returns (uint64)',
      'function getHumanityInfo(bytes20) view returns (bool vouching, bool pendingRevocation, uint48 nbPendingRequests, uint40 expirationTime, address owner, uint256 nbRequests)',
    ])

    const poh = await pohV2Client()
    const lifespan = await poh.lifespan()
    // The two terms differ, and that difference is the whole defect. Read live, both sides.
    const v1Term = Number(
      await eth.readContract({ address: POH_V1_REGISTRY, abi: originAbi, functionName: 'submissionDuration' }),
    )
    assert.notEqual(v1Term, lifespan, 'PoH v1 and v2 must still disagree about how long a term is')

    const imports = await Promise.all(
      grants.map(async (log) => {
        // `bytes20` is a fixed-bytes type, so an indexed one is right-padded in its topic —
        // the id is the *first* 20 bytes of the word, not the last. An `address` is not.
        const humanityId = log.topics[1]!.slice(0, 42)
        return {
          log,
          humanityId,
          owner: `0x${log.topics[2]!.slice(26)}` as Address,
          granted: parseInt(log.data, 16),
          info: await poh.humanityInfo(humanityId),
        }
      }),
    )
    assert.ok(
      imports.some((i) => i.info.nbRequests >= 1),
      'an import can land on a humanity with local request history — which is why `nbRequests == 0` is not the discriminator',
    )

    let sample:
      | { humanityId: string; owner: Address; grantedAt: number; expirationTime: number; originIssuedAt: number }
      | undefined
    for (const { log, humanityId, owner, granted, info } of imports) {
      // The term is only still foreign if nothing here has written over the imported expiry.
      if (info.expirationTime !== granted) continue

      const submission = await eth.readContract({
        address: POH_V1_REGISTRY,
        abi: originAbi,
        functionName: 'getSubmissionInfo',
        args: [humanityId as Address],
      })
      const submissionTime = Number(submission[1])
      if (submissionTime === 0 || submissionTime + v1Term !== granted) continue

      const header = await gnosisRpc('eth_getBlockByNumber', [log.blockNumber, false])
      sample = {
        humanityId,
        owner,
        grantedAt: parseInt(header.timestamp, 16),
        expirationTime: granted,
        originIssuedAt: submissionTime,
      }
      break
    }
    if (!sample) {
      t.skip('no import currently carrying an unrewritten PoH v1 term')
      return
    }

    // The defect, measured rather than remembered: subtracting this contract's term from the
    // imported expiry lands exactly one v2 lifespan after the registration PoH v1 records.
    const naive = sample.expirationTime - lifespan
    assert.notEqual(naive, sample.originIssuedAt, 'the local subtraction must be the wrong answer here')
    assert.equal(naive - sample.originIssuedAt, v1Term - lifespan, 'and wrong by the difference in terms')

    const evidence = await pohAdapter().probe(sample.owner)
    assert.equal(evidence.error, undefined)
    assert.notEqual(evidence.issuedAt, naive, 'the probe must not report the date it used to')
    if (evidence.held) {
      // Held: the age question, answered across the bridge.
      assert.equal(evidence.issuedAt, sample.originIssuedAt)
      assert.ok(evidence.provenance?.notes.includes('date-from-origin-instance'))
    } else {
      // Lapsed: the window question, which is about the instants *this* registry honoured it.
      assert.equal(evidence.heldUntil, sample.expirationTime)
      assert.equal(evidence.issuedAt, sample.grantedAt, 'a window here cannot start before the grant')
      assert.equal(evidence.detail?.originRegisteredAt, sample.originIssuedAt)
      assert.ok(evidence.provenance?.notes.includes('date-from-registry-import'))
    }
    assert.equal(evidence.detail?.termOrigin, 'poh-v1-mainnet')
    assert.equal(evidence.detail?.termSeconds, v1Term)
  })

  test('the account mapping is where a humanity survives its own expiry', async (t) => {
    // `humanityOf` applies the expiry check, so it returns zero for exactly the subjects this
    // feature is about. The link that survives is the private `accountHumanity` mapping, and the
    // slot it lives in is re-derived here every run rather than trusted: for a subject the
    // contract still answers for, the storage word must equal what `humanityOf` returns.
    const humanities = await indexedHumanities(t, 40)
    if (!humanities) return
    const { keccak256, encodeAbiParameters, pad } = await import('viem')
    const { POH_V2_ACCOUNT_HUMANITY_SLOT } = await import('./adapters/index.ts')
    const slotOf = (account: string) =>
      keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'uint256' }],
          [pad(account as `0x${string}`, { size: 32 }), POH_V2_ACCOUNT_HUMANITY_SLOT],
        ),
      )
    const poh = await pohV2Client()
    const humanityOf = (account: string) => poh.humanityOf(account).then((id) => id.toLowerCase())
    const stored = async (account: string) => {
      const raw: string = await gnosisRpc('eth_getStorageAt', [POH_V2, slotOf(account), 'latest'])
      return `0x${raw.slice(26)}`
    }

    let checkedLive = 0
    let checkedLapsed = 0
    for (const h of humanities) {
      const live = await humanityOf(h.id)
      const slot = await stored(h.id)
      if (live !== '0x0000000000000000000000000000000000000000') {
        assert.equal(slot, live, `${h.id}: the account mapping must agree with humanityOf`)
        checkedLive++
      } else if (slot !== '0x0000000000000000000000000000000000000000') {
        // Exactly the case the feature exists for: the contract has stopped answering, and the
        // link back to the humanity is still sitting in storage.
        const info = await poh.humanityInfo(slot)
        if (info.owner.toLowerCase() === h.id.toLowerCase()) checkedLapsed++
      }
      if (checkedLive >= 3 && checkedLapsed >= 1) break
    }
    assert.ok(checkedLive >= 1, 'no live humanity in the sample to derive the slot against')
    assert.ok(
      checkedLapsed >= 1,
      'no lapsed humanity whose account mapping outlived it — the premise of the read',
    )

    // And an address that never claimed has nothing in the slot, so absence stays absence.
    assert.equal(await stored(UNREGISTERED), '0x0000000000000000000000000000000000000000')
    const dead = await pohAdapter().probe(UNREGISTERED)
    assert.equal(dead.heldUntil, undefined, 'an ordinary negative is never handed a window')
  })

  test('a humanity whose owner was cleared is not restored, because nothing dates that end', async (t) => {
    // Revocation and cross-chain transfer both `delete humanity.owner` and leave no timestamp.
    // The subject may have lost the credential years before its expiry, so the expiry is not
    // the end of anything we can prove — and the probe reports no window at all.
    const humanities = await indexedHumanities(t, 60)
    if (!humanities) return
    const poh = await pohV2Client()
    let checked = 0
    for (const h of humanities) {
      const info = await poh.humanityInfo(h.humanityId)
      if (info.owner !== '0x0000000000000000000000000000000000000000') continue
      const evidence = await pohAdapter().probe(h.id as Address)
      assert.equal(evidence.held, false)
      assert.equal(evidence.heldUntil, undefined, `${h.id}: an undated ending must not close a window`)
      checked++
      if (checked >= 2) break
    }
    if (checked === 0) t.skip('no owner-cleared humanity in the sampled cohort')
  })

  // ------------------------------------- the endings our index cannot see, and what they cost
  //
  // Our PoH mapping handles `HumanityRevoked` and nothing else. A humanity also ends by
  // expiring — no event at all — and by leaving the chain through `ccDischargeHumanity`. So
  // "the index has it and has not seen it end" is a statement about our event handlers, and
  // `reconcile.ts` no longer lets it decide `held` when the chain cannot be read. These two
  // tests hold that against the registry rather than against the argument for it.

  /** keccak256("HumanityDischargedDirectly(bytes20)") — the humanity id is the indexed topic. */
  const DISCHARGED_TOPIC = '0xae36bccbd3f2d52f68869193680a9f87de51c66f345ff113017bf284437fa901'
  /** keccak256("HumanityRevoked(bytes20,uint256)"). Not indexed, so the id is in `data`. */
  const HUMANITY_REVOKED_TOPIC =
    '0x1765930ce5b4d87513bdba895a4be9f23166d2a2e58528486aa13a1e9777c370'
  /**
   * The block the registry's only revocation is in, 2025-07-25T14:15:20Z.
   *
   * Pinned for the same reason iteration 20 pinned the two Circles `Stopped` avatars: one event
   * in a protocol's entire history is not something a run-time sample finds, and sweeping
   * 11.5M blocks of logs on every test run is not a read anyone should pay for. Everything
   * *about* it is re-derived each run — the log, both sides of the state transition, and the
   * humanity id — so if the pin is ever wrong the test says so instead of passing quietly.
   */
  const ONLY_REVOCATION_BLOCK = 41_268_459

  test('the index flag that *is* an ending is faithful to the chain, to the block', async (t) => {
    // The other half of the audit. `revoked` maps `HumanityRevoked`, and the deployed
    // implementation emits that only where it does `delete humanity.owner` — so the flag is a
    // real ending and is not the problem. Proved by moving one block: the humanity is owned
    // with a revocation pending at `block - 1` and unowned at `block`, in the block the log
    // sits in. Two subsystems of the node, and the mapping only ever consulted the log.
    let logs: { topics: string[]; data: string; blockNumber: string }[]
    try {
      logs = await gnosisRpc('eth_getLogs', [
        {
          address: POH_V2,
          topics: [HUMANITY_REVOKED_TOPIC],
          fromBlock: hexBlock(ONLY_REVOCATION_BLOCK),
          toBlock: hexBlock(ONLY_REVOCATION_BLOCK),
        },
      ])
    } catch (e) {
      t.skip(`Gnosis refused the log query: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    assert.equal(logs.length, 1, 'the pinned block holds the revocation it is pinned for')
    const humanityId = `0x${logs[0]!.data.slice(2, 42)}`

    const { createPublicClient, http, parseAbi } = await import('viem')
    const { gnosis } = await import('viem/chains')
    const client = createPublicClient({ chain: gnosis, transport: http('https://rpc.gnosischain.com') })
    const abi = parseAbi(POH_V2_READ_ABI)
    const at = (blockNumber: bigint) =>
      client.readContract({
        address: POH_V2,
        abi,
        functionName: 'getHumanityInfo',
        args: [humanityId as `0x${string}`],
        blockNumber,
      })

    const before = await at(BigInt(ONLY_REVOCATION_BLOCK - 1))
    const after = await at(BigInt(ONLY_REVOCATION_BLOCK))
    assert.equal(before[1], true, 'a revocation was pending in the block before')
    assert.notEqual(
      before[4].toLowerCase(),
      '0x0000000000000000000000000000000000000000',
      'and the humanity was owned',
    )
    assert.equal(
      after[4].toLowerCase(),
      '0x0000000000000000000000000000000000000000',
      'the event and `delete humanity.owner` are the same instant',
    )
    assert.equal(after[1], false)
  })

  test('a humanity that left the chain is held in our index and gone from the registry', async (t) => {
    // The ending nothing tells us about. A cross-chain discharge clears the owner while the
    // expiry runs on for another year or more, so the subject is *not* lapsed and *not* revoked
    // — the two states the index can represent — and the index goes on listing them as held.
    const head = Number(await gnosisRpc('eth_blockNumber', []))
    let logs: { topics: string[]; blockNumber: string }[] = []
    try {
      // Recent history only: the point is that this path is *current*, not that it ever fired.
      for (let from = head - 1_500_000; from < head; from += 500_000) {
        logs.push(
          ...(await gnosisRpc('eth_getLogs', [
            {
              address: POH_V2,
              topics: [DISCHARGED_TOPIC],
              fromBlock: hexBlock(from),
              toBlock: hexBlock(Math.min(from + 499_999, head)),
            },
          ])),
        )
      }
    } catch (e) {
      t.skip(`Gnosis refused the log query: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    if (!logs.length) {
      t.skip('no cross-chain discharge in the last 1.5M blocks')
      return
    }

    const { subgraphReady, pohIndexRead } = await import('./subgraph.ts')
    if (!(await subgraphReady(SUBGRAPH))) {
      t.skip('subgraph not answering')
      return
    }
    const poh = await pohV2Client()
    const now = Math.floor(Date.now() / 1000)
    const { reconcileIndexAndChain } = await import('./reconcile.ts')

    let checked = 0
    for (const log of logs.reverse()) {
      const humanityId = `0x${log.topics[1]!.slice(2, 42)}`
      const info = await poh.humanityInfo(humanityId)
      // The discriminator that makes this test about the *unindexed event* and not about
      // expiry: the credential is gone while the term it was written with is still running.
      if (info.owner !== '0x0000000000000000000000000000000000000000') continue
      if (info.expirationTime <= now) continue

      const view = await pohIndexRead(SUBGRAPH, humanityId)
      if (!view?.entity) continue

      assert.equal(view.entity.ended, false, `${humanityId}: the index cannot see this ending`)
      assert.equal(view.observesEveryEnding, false, 'and it says so rather than being trusted')

      const probe = await pohAdapter().probe(humanityId as Address)
      assert.equal(probe.held, false, 'the chain, read at head, is not fooled')

      // The whole point, in one call: with the chain unreadable this used to come back held,
      // dated, and worth a full trust root.
      const blind = reconcileIndexAndChain({
        chain: { held: false, unavailable: true },
        index: view,
      })
      assert.equal(blind.held, false)
      assert.ok(blind.error, 'excluded as unreadable rather than counted on the index alone')
      assert.ok(blind.provenance.notes.includes('index-cannot-see-endings'))
      checked++
      break
    }
    if (checked === 0) t.skip('no discharged humanity in the sampled cohort is in the index')
  })
})
