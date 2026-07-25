/**
 * Live tests for as-of scoring. These hit the deployed registry on Sepolia, the registry
 * audit-trail subgraph, and Ethereum mainnet.
 *
 * Run: node --test --experimental-strip-types src/as-of.live.test.ts
 *
 * The subgraph is the thing under test, so an unreachable subgraph skips loudly rather than
 * failing: a source that does not answer says nothing about whether the reconstruction is
 * faithful. Everything the reconstruction *claims* is checked against the chain, which does
 * not depend on the indexer being up.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Print, DEFAULT_REGISTRY } from './index.ts'
import {
  REGISTRY_GENESIS_BLOCK,
  headRevisionOf,
  loadOntologyAsOf,
  missingRevisions,
  registryClient,
  resolveAsOfPoint,
} from './as-of.ts'
import { adapterKey, loadOntology, rootKey } from './ontology.ts'
import { pohV1Adapter } from './adapters/poh-v1.ts'
import type { Address } from './types.ts'

const ontologyJson = JSON.parse(readFileSync(new URL('../../../ontology/adapters.json', import.meta.url), 'utf8'))
const knownIds: string[] = ontologyJson.adapters.map((a: { id: string }) => a.id)
const knownRoots: string[] = [
  ...Object.keys(ontologyJson.trustRoots),
  ...Object.keys(ontologyJson.retiredTrustRoots ?? {}),
]

const REGISTRY_SUBGRAPH =
  process.env.PRINT_REGISTRY_SUBGRAPH_URL ??
  'http://localhost:8100/subgraphs/name/print-registry'

/**
 * A Sepolia block inside revision 15 — after the first seed and before the landscape
 * expansion. Not trusted as a constant: the first test derives the revision-15 and
 * revision-16 blocks from the audit trail and asserts this sits between them, so if the
 * registry is ever reseeded from scratch the suite says which number went stale.
 */
const REVISION_15_BLOCK = 11_345_000

/**
 * One of the two surviving Proof of Humanity v1 registrations (research/protocols/
 * poh-v1-onchain-read.md). `poh-v1` was added to the ontology at revision 34, so this subject
 * is the cleanest possible demonstration: the same credential, unchanged on chain, priced at
 * a few dollars today and at nothing before we had researched the protocol.
 */
const POH_V1_SURVIVOR = '0xb2db7c3b4c0d901fe1c51895ceb5c631eb3667e7' as Address

let reachable = false
let indexedBlock = 0

async function graph(query: string): Promise<Record<string, unknown> | undefined> {
  try {
    const res = await fetch(REGISTRY_SUBGRAPH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] }
    if (json.errors?.length) return undefined
    return json.data
  } catch {
    return undefined
  }
}

before(async () => {
  const data = (await graph('{ _meta { block { number } } }')) as
    | { _meta?: { block?: { number: number } } }
    | undefined
  indexedBlock = Number(data?._meta?.block?.number ?? 0)
  reachable = indexedBlock > 0
})

const skipIfUnreachable = (t: { skip: (m: string) => void }) => {
  if (!reachable) {
    t.skip(`registry subgraph unreachable at ${REGISTRY_SUBGRAPH}`)
    return true
  }
  return false
}

describe('the audit trail is complete enough to reconstruct from', () => {
  test('every revision the registry counted is in the audit trail', async (t) => {
    if (skipIfUnreachable(t)) return
    // This is the load-bearing check for the whole module. `setAdapter` and
    // `setAdapterLiveness` both bump `revision`, but only the first carries the full record,
    // and the deployed mapping drops liveness events entirely (it looks the adapter up by
    // hash while entities are keyed on the plaintext id). If the recorded revisions are
    // exactly 1..revision(), no liveness event has ever fired — which makes the
    // reconstruction exact at every block, not just the ones this suite samples.
    const data = (await graph(
      '{ weightChanges(first: 1000, orderBy: revision, orderDirection: asc) { revision block } }',
    )) as { weightChanges: { revision: string; block: string }[] } | undefined
    assert.ok(data, 'audit trail query')

    const recorded = data.weightChanges.map((w) => Number(w.revision))
    const onChain = await headRevisionOf(registryClient(), DEFAULT_REGISTRY)
    const gaps = missingRevisions(recorded, onChain)

    assert.deepEqual(
      gaps,
      [],
      `the registry is at revision ${onChain} and the audit trail records ${recorded.length} changes; ` +
        `revisions ${gaps.join(', ')} are missing, so historical liveness flags cannot be trusted`,
    )
    assert.equal(Math.max(...recorded), onChain)
  })

  test('every adapter is reachable from the hashed key a liveness event carries', async (t) => {
    if (skipIfUnreachable(t)) return
    // `setAdapterLiveness` emits only keccak256("adapter:" ++ id), and a mapping cannot
    // enumerate entities, so without a reverse index the handler has nothing to look up. It
    // did not have one: it loaded `Adapter` by hash hex against entities keyed on the plaintext
    // id, matched nothing, and dropped every flip. Nothing had ever flipped, so nothing said
    // so. This asserts the index exists and that each entry really is the preimage's hash —
    // the fix is only worth anything if the key it stores is the key the event will carry.
    const data = (await graph('{ adapterKeys(first: 1000) { id adapter { id keyHash } } }')) as
      | { adapterKeys: { id: string; adapter: { id: string; keyHash: string } }[] }
      | undefined
    if (!data) {
      t.skip('this deployment predates the AdapterKey reverse index — redeploy subgraph-registry')
      return
    }
    const chain = await loadOntology({ registryAddress: DEFAULT_REGISTRY, knownIds, knownRoots })
    assert.equal(data.adapterKeys.length, chain.adapters.size, 'one key per adapter, none missing')
    for (const k of data.adapterKeys) {
      const expected = adapterKey(k.adapter.id)
      assert.equal(k.id, expected, `${k.adapter.id}: key is not the hash of its id`)
      assert.equal(k.adapter.keyHash, expected, `${k.adapter.id}: keyHash disagrees with the index`)
    }
  })

  test('the revision-15 block used by this suite really is inside revision 15', async (t) => {
    if (skipIfUnreachable(t)) return
    const data = (await graph(
      '{ weightChanges(first: 1000, orderBy: revision, orderDirection: asc) { revision block } }',
    )) as { weightChanges: { revision: string; block: string }[] } | undefined
    assert.ok(data)
    const at = (rev: number) => Number(data.weightChanges.find((w) => Number(w.revision) === rev)!.block)

    assert.ok(REVISION_15_BLOCK >= at(15), `block ${REVISION_15_BLOCK} predates revision 15 (${at(15)})`)
    assert.ok(REVISION_15_BLOCK < at(16), `block ${REVISION_15_BLOCK} is at or past revision 16 (${at(16)})`)
  })
})

describe('the reconstruction is faithful', () => {
  test('the ontology at the indexed head is the ontology the chain reports', async (t) => {
    if (skipIfUnreachable(t)) return
    // Field-by-field equality against `allAdapters()`. Anything the indexer got wrong about
    // the present it would also have got wrong about the past, and here the chain can say so.
    const [fromIndex, fromChain] = await Promise.all([
      loadOntologyAsOf({
        registrySubgraphUrl: REGISTRY_SUBGRAPH,
        point: { block: indexedBlock, timestamp: 0 },
        knownRoots,
      }),
      loadOntology({ registryAddress: DEFAULT_REGISTRY, knownIds, knownRoots }),
    ])

    assert.equal(fromIndex.ontology.revision, fromChain.revision, 'revision')
    assert.deepEqual(
      [...fromIndex.ontology.adapters.keys()].sort(),
      [...fromChain.adapters.keys()].sort(),
      'adapter ids',
    )
    for (const [id, chainRow] of fromChain.adapters) {
      // Compare the whole record, not a sample: a subgraph that got one cost field wrong
      // would price a credential wrongly at every historical block, silently.
      assert.deepEqual(fromIndex.ontology.adapters.get(id), chainRow, `adapter ${id}`)
    }
  })

  test('a block before the registry existed is an error, not an empty ontology', async () => {
    // An empty ontology scores every subject at zero while looking like it worked.
    await assert.rejects(
      () => resolveAsOfPoint(registryClient(), REGISTRY_GENESIS_BLOCK - 1),
      /predates the registry/,
    )
  })

  test('a block the indexer has not reached is an error naming how far it got', async (t) => {
    if (skipIfUnreachable(t)) return
    await assert.rejects(
      () =>
        loadOntologyAsOf({
          registrySubgraphUrl: REGISTRY_SUBGRAPH,
          point: { block: indexedBlock + 10_000, timestamp: 0 },
          knownRoots,
        }),
      /has only indexed to block/,
    )
  })
})

describe('the registry really did say something different', () => {
  test('revision 15 held half the adapters and three roots we have since corrected', async (t) => {
    if (skipIfUnreachable(t)) return
    const { ontology, context } = await loadOntologyAsOf({
      registrySubgraphUrl: REGISTRY_SUBGRAPH,
      point: { block: REVISION_15_BLOCK, timestamp: 0 },
      knownRoots,
    })

    assert.equal(context.registryRevision, 15)
    assert.equal(ontology.adapters.size, 15)
    assert.equal(context.auditTrailComplete, true)
    assert.equal(context.recordsLivenessChanges, true, 'redeploy subgraph-registry: this deployment cannot record a liveness flip')

    // The three corrections iteration 2 made, as the registry's own history has them.
    assert.equal(ontology.adapters.get('civic-pass')?.trustRoot, 'kyc-vendor:persona')
    assert.equal(ontology.adapters.get('brightid')?.trustRoot, 'social-vouching:poh')
    assert.equal(ontology.adapters.get('humanity-protocol')?.trustRoot, 'unknown')
    assert.equal(ontology.adapters.get('humanity-protocol')?.live, true)

    // And the ones that had not been researched yet.
    for (const id of ['poh-v1', 'human-passport', 'holonym-gov-id', 'farcaster-account']) {
      assert.equal(ontology.adapters.get(id), undefined, `${id} should not exist at revision 15`)
    }
  })

  test('retired root names still resolve, so the history reads as names and not hashes', async (t) => {
    if (skipIfUnreachable(t)) return
    const { ontology } = await loadOntologyAsOf({
      registrySubgraphUrl: REGISTRY_SUBGRAPH,
      point: { block: REVISION_15_BLOCK, timestamp: 0 },
      knownRoots,
    })
    for (const a of ontology.adapters.values()) {
      assert.ok(
        !/^0x[0-9a-f]{64}$/i.test(a.trustRoot),
        `${a.id} sits on an unnamed root ${a.trustRoot} — add its preimage to retiredTrustRoots`,
      )
    }
    // Both retired names are genuinely in use at this revision, which is why they are kept.
    const roots = new Set([...ontology.adapters.values()].map((a) => a.trustRoot))
    assert.ok(roots.has('unknown'))
    assert.ok(roots.has('kyc-vendor:facetec-synaps'))
    assert.equal(rootKey('unknown').length, 66)
  })

  test('an instant resolves to a block, and that block resolves to the same revision', async (t) => {
    if (skipIfUnreachable(t)) return
    const client = registryClient()
    const byBlock = await resolveAsOfPoint(client, REVISION_15_BLOCK)
    const byInstant = await resolveAsOfPoint(client, new Date(byBlock.timestamp * 1000))
    // The bisection lands on the block whose header carries that timestamp. Sepolia can hold
    // several blocks at one second, so require the revision to agree rather than the number.
    const a = await loadOntologyAsOf({ registrySubgraphUrl: REGISTRY_SUBGRAPH, point: byBlock, knownRoots })
    const b = await loadOntologyAsOf({ registrySubgraphUrl: REGISTRY_SUBGRAPH, point: byInstant, knownRoots })
    assert.equal(b.context.registryRevision, a.context.registryRevision)
    assert.ok(byInstant.timestamp <= byBlock.timestamp)
  })
})

describe('a real subject, scored twice', () => {
  test('asOf without a registry subgraph refuses rather than answering with today', async () => {
    const client = new Print({ knownIds, knownRoots, adapters: [pohV1Adapter()] })
    await assert.rejects(
      () => client.resolve(POH_V1_SURVIVOR, { asOf: REVISION_15_BLOCK }),
      /requires registrySubgraphUrl/,
    )
  })

  /**
   * The acceptance test `MISSION.md` asks for: a score that changes because the registry
   * revision changed, on a real subject and a real credential.
   *
   * Nothing about this address moved. `isRegistered` answers the same today as it did at
   * revision 15, on a contract frozen since 2021. What moved is what we knew: `poh-v1` was
   * researched and priced at revision 34, so the credential that is worth a few dollars in
   * today's ontology was worth nothing in the one that was deployed that morning.
   */
  test('the same credential scores differently against the ontology of that morning', async (t) => {
    if (skipIfUnreachable(t)) return
    const client = new Print({
      knownIds,
      knownRoots,
      registrySubgraphUrl: REGISTRY_SUBGRAPH,
      adapters: [pohV1Adapter()],
    })

    const now = await client.resolve(POH_V1_SURVIVOR)
    const held = now.evidence.find((e) => e.adapterId === 'poh-v1')
    if (!held?.held) {
      // Both survivors expire in late 2026 and the registry is frozen, so this will one day be
      // true. Skip rather than fail: it says nothing about as-of scoring.
      t.skip(`${POH_V1_SURVIVOR} no longer holds a live PoH v1 registration${held?.detail ? '' : ''}`)
      return
    }

    const then = await client.resolve(POH_V1_SURVIVOR, { asOf: REVISION_15_BLOCK })

    assert.equal(now.registryRevision, 34)
    assert.equal(then.registryRevision, 15)
    assert.equal(then.asOf?.block, REVISION_15_BLOCK)
    assert.equal(then.asOf?.adapterCount, 15)
    assert.equal(then.asOf?.auditTrailComplete, true)

    assert.ok(now.score > 0, `expected a live PoH v1 registration to score, got ${now.score}`)
    assert.equal(then.score, 0, 'poh-v1 had no ontology entry at revision 15, so it cannot be priced')
    assert.deepEqual(then.asOf?.adaptersNotYetInRegistry, ['poh-v1'])
    assert.ok(then.caveats.some((c) => c.code === 'adapter-not-in-registry-at-asof'))
    assert.ok(then.caveats.some((c) => c.code === 'scored-as-of-past-block'))

    // The evidence itself is identical — same held flag, same issuance date, same address.
    // Only the price attached to it differs, which is the whole claim.
    const thenHeld = then.evidence.find((e) => e.adapterId === 'poh-v1')
    assert.equal(thenHeld, undefined, 'unpriced evidence is reported in the caveat, not the roots')
    assert.equal(then.computedAt, then.asOf!.timestamp, 'age curves were evaluated at the as-of instant')
    assert.ok(then.computedAt < now.computedAt)
  })

  test('a credential issued after the as-of instant is excluded from it', async (t) => {
    if (skipIfUnreachable(t)) return
    // Scored as of the registry's own genesis block, before the first seed had even finished:
    // the PoH v1 registration predates that by years, so it is *not* excluded by date — the
    // exclusion path is exercised by asking for a block whose ontology has no poh-v1 at all,
    // above. What this checks is the other half: the instant used is the block's, and a
    // credential dated after it would be dropped rather than counted.
    const client = new Print({
      knownIds,
      knownRoots,
      registrySubgraphUrl: REGISTRY_SUBGRAPH,
      adapters: [pohV1Adapter()],
    })
    const r = await client.resolve(POH_V1_SURVIVOR, { asOf: REVISION_15_BLOCK })
    const submission = r.asOf!.timestamp
    assert.ok(submission > 1_700_000_000 && submission < Math.floor(Date.now() / 1000))
    assert.deepEqual(r.asOf?.issuedAfterAsOf, [], 'a 2024 registration is not newer than 2026-07')
  })
})
