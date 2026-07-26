/**
 * Linea Proof of Humanity V2, against the real Verax registry on Linea.
 *
 * The adapter makes a stronger claim than "this address is verified". It claims to enumerate the
 * **complete live population** from the chain, so the interesting assertions are about
 * completeness and about who is allowed to add to it:
 *
 * - **The invariant the enumeration rests on** is that `attestedDate` is monotone in attestation
 *   id. Everything else follows from it: a 90-day term plus monotonicity means every unexpired
 *   attestation lies above one bounding id. The suite re-derives that monotonicity over the whole
 *   scanned range every run, so the day Verax changes how ids are assigned this reddens.
 * - **The completeness itself** is checked against a source the probe never touches: the Verax
 *   subgraph, queried pinned to the same block, with the comparison being set equality rather
 *   than a count. A missing subject is a false negative the probe could not otherwise see.
 * - **Who may attest** is re-read rather than trusted. Our own research named the wrong Sumsub
 *   portal, so the suite asserts that the researched one is registered to the same owner *and*
 *   contributes nobody — the exact reason the anchor is the owner address and not the portal.
 * - **The vendor disagrees with the chain, and the chain is stricter.** `poh-api.linea.build`
 *   and `PohVerifier` both still call an address human ten months after its attestation expired.
 *   That is asserted here, because it is the reason to read the registry at all.
 *
 * No subject is hard-coded on the positive path: subjects come out of the enumeration at run
 * time, since every credential here dies within 90 days.
 *
 * Run: node --test --experimental-strip-types src/adapters/linea-poh.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, parseAbi, type PublicClient } from 'viem'
import { linea } from 'viem/chains'
import {
  ATTESTATION_REGISTRY_ABI,
  idToBytes32,
  lineaPohAdapter,
  lineaPohSnapshot,
  LINEA_POH_MAX_TERM_SECONDS,
  LINEA_POH_V2_SCHEMA,
  LINEA_RPC,
  PORTAL_REGISTRY_ABI,
  SUMSUB_POH_PORTAL,
  SUMSUB_POH_PORTAL_DEPLOYMENT_TEST,
  SUMSUB_PORTAL_ABI,
  SUMSUB_PORTAL_OWNER,
  VERAX_ATTESTATION_REGISTRY,
  VERAX_PORTAL_REGISTRY,
  type LineaPohSnapshot,
} from './linea-poh.ts'
import { applyAsOfToEvidence } from '../as-of.ts'
import type { Address } from '../types.ts'

/** Nobody holds the key to this address, so nobody has ever verified with it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

/** Verax `SchemaRegistry` on Linea — used only to read back what the schema says it is. */
const VERAX_SCHEMA_REGISTRY = '0x0f95dCec4c7a93F2637eb13b655F2223ea036B59' as const
/** Verax `Router`, which the registry names. */
const VERAX_ROUTER = '0x4d3a380A03f3a18A5dC44b01119839D8674a552E' as const
/**
 * `PohVerifier`, the contract Linea's docs tell integrators to use. It checks a signature from
 * `poh-signer-api.linea.build` against its own signer, which is *not* the Verax attester.
 */
const POH_VERIFIER = '0xBf14cFAFD7B83f6de881ae6dc10796ddD7220831' as const

/** Keyless, no API key, and the endpoint whose completeness we are checking ours against. */
const VERAX_SUBGRAPH = 'https://api.studio.thegraph.com/query/67521/verax-v2-linea/v0.0.1'

const SCHEMA_REGISTRY_ABI = parseAbi([
  'struct Schema { string name; string description; string context; string schema; }',
  'function getSchema(bytes32 schemaId) view returns (Schema)',
])
const POH_VERIFIER_ABI = parseAbi([
  'function verify(bytes signature, address human) view returns (bool)',
  'function getSigner() view returns (address)',
])

const client = createPublicClient({
  chain: linea,
  transport: http(LINEA_RPC, { timeout: 25_000 }),
}) as PublicClient

/**
 * One enumeration for the whole suite.
 *
 * Not an optimisation: the tests below compare the *same* population against three other
 * sources, and taking a fresh snapshot per test would let an attestation land between them and
 * turn a real disagreement into a shrug.
 */
let snapshotOnce: Promise<LineaPohSnapshot> | undefined
const snapshot = (): Promise<LineaPohSnapshot> => (snapshotOnce ??= lineaPohSnapshot(client))

/** A live source being unreachable says nothing about the mechanism, so skip loudly. */
function skipUnreachable(t: { skip(message: string): void }, what: string, e: unknown): void {
  t.skip(`${what} unreachable: ${e instanceof Error ? e.message : String(e)}`)
}

async function graphql(query: string): Promise<Record<string, unknown>> {
  const res = await fetch(VERAX_SUBGRAPH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown }
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300))
  if (!json.data) throw new Error('no data')
  return json.data
}

describe('the contracts are the ones we think they are', () => {
  test('the attestation registry names the Verax router and answers with a counter', async () => {
    const [router, counter, version] = await Promise.all([
      client.readContract({
        address: VERAX_ATTESTATION_REGISTRY,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'router',
      }),
      client.readContract({
        address: VERAX_ATTESTATION_REGISTRY,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'getAttestationIdCounter',
      }),
      client.readContract({
        address: VERAX_ATTESTATION_REGISTRY,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'getVersionNumber',
      }),
    ])
    assert.equal(router.toLowerCase(), VERAX_ROUTER.toLowerCase())
    assert.ok(Number(counter) > 6_000_000, `counter is ${counter}`)
    assert.ok(Number(version) >= 10, `registry version is ${version}`)
  })

  test('the schema on chain is Sumsub Proof of Personhood, not a lookalike', async () => {
    const schema = await client.readContract({
      address: VERAX_SCHEMA_REGISTRY,
      abi: SCHEMA_REGISTRY_ABI,
      functionName: 'getSchema',
      args: [LINEA_POH_V2_SCHEMA],
    })
    assert.equal(schema.name, 'Sumsub Proof of Personhood')
    assert.equal(schema.context, 'https://id.sumsub.com/linea-liveness')
    assert.equal(schema.schema, '(string levelInfo)')
    assert.match(schema.description, /liveness, deepfake detection and duplicate search/)
  })

  test('the pinned owner is an allowlisted Verax issuer, which is what makes it an anchor', async () => {
    // `ownerName` is a string its owner chose. `isIssuer` is Consensys' allowlist. Only the
    // second one stops somebody registering a portal that calls itself Sumsub.
    const [portal, isIssuer] = await Promise.all([
      client.readContract({
        address: VERAX_PORTAL_REGISTRY,
        abi: PORTAL_REGISTRY_ABI,
        functionName: 'getPortalByAddress',
        args: [SUMSUB_POH_PORTAL],
      }),
      client.readContract({
        address: VERAX_PORTAL_REGISTRY,
        abi: PORTAL_REGISTRY_ABI,
        functionName: 'isIssuer',
        args: [SUMSUB_PORTAL_OWNER],
      }),
    ])
    assert.equal(portal.ownerAddress.toLowerCase(), SUMSUB_PORTAL_OWNER.toLowerCase())
    assert.equal(isIssuer, true)
    assert.equal(portal.ownerName, 'Sumsub')
    // No IndexerModule: this is why there is no subject-keyed read and why we enumerate.
    assert.equal(portal.modules.length, 0)
  })

  test('the portal publishes the signer it trusts, so we never hard-code Sumsub’s key', async () => {
    const signer = await client.readContract({
      address: SUMSUB_POH_PORTAL,
      abi: SUMSUB_PORTAL_ABI,
      functionName: 'signerAddress',
    })
    assert.match(signer, /^0x[0-9a-fA-F]{40}$/)
    const snap = await snapshot()
    const known = snap.portals.find(
      (p) => p.portal.toLowerCase() === SUMSUB_POH_PORTAL.toLowerCase(),
    )
    assert.equal(known?.signerAddress?.toLowerCase(), signer.toLowerCase())
  })

  test('the portal our research named is the same owner and contributes nobody', async () => {
    // Kept as a tripwire: `0xe8a3…3922` issued four attestations in July 2025 and has been dead
    // since. An adapter pinned to it would answer `held: false` for the whole population.
    const [portal, snap] = await Promise.all([
      client.readContract({
        address: VERAX_PORTAL_REGISTRY,
        abi: PORTAL_REGISTRY_ABI,
        functionName: 'getPortalByAddress',
        args: [SUMSUB_POH_PORTAL_DEPLOYMENT_TEST],
      }),
      snapshot(),
    ])
    assert.equal(portal.ownerAddress.toLowerCase(), SUMSUB_PORTAL_OWNER.toLowerCase())
    const fromTestPortal = [...snap.bySubject.values()]
      .flat()
      .filter((a) => a.portal.toLowerCase() === SUMSUB_POH_PORTAL_DEPLOYMENT_TEST.toLowerCase())
    assert.equal(fromTestPortal.length, 0)
  })
})

describe('the enumeration', () => {
  test('reads a window that is a rounding error of the registry, and finds a real population', async () => {
    const snap = await snapshot()
    const width = snap.counter - snap.scannedFromId
    assert.ok(width > 0 && width <= snap.counter, `window width ${width}`)
    assert.ok(
      width < snap.counter / 100,
      `the window is ${width} of ${snap.counter} ids — if it stops being a small fraction the enumeration stops being cheap`,
    )
    assert.ok(snap.liveAttestations > 0, 'no live attestations at all — the protocol or the read is broken')
    assert.equal(snap.bySubject.size <= snap.liveAttestations, true)
    // A snapshot answers for every subject, so nothing about it may depend on one.
    assert.equal(snap.rejectedForPortalOwner, 0, 'a portal outside Sumsub wrote under this schema')
  })

  test('attestedDate is monotone in id across the scanned range — the invariant everything rests on', async () => {
    const snap = await snapshot()
    const ids: number[] = []
    for (let id = snap.scannedFromId; id < snap.counter; id += Math.ceil((snap.counter - snap.scannedFromId) / 120)) {
      ids.push(id)
    }
    ids.push(snap.counter - 1)
    const dates = await client.multicall({
      contracts: ids.map((id) => ({
        address: VERAX_ATTESTATION_REGISTRY,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'getAttestation' as const,
        args: [idToBytes32(id)] as const,
      })),
      allowFailure: true,
      blockNumber: BigInt(snap.block),
    })
    let previous = 0
    let checked = 0
    dates.forEach((r) => {
      if (r.status !== 'success') return
      const date = Number((r.result as { attestedDate: bigint }).attestedDate)
      assert.ok(
        date >= previous,
        `attestedDate went backwards (${previous} then ${date}): ids are no longer issued in time order, so the window no longer bounds the live set`,
      )
      previous = date
      checked++
    })
    assert.ok(checked > 20, `only ${checked} ids were readable`)
  })

  test('attestedDate is monotone across the whole registry, not only inside the window', async () => {
    // The lower-edge test below checks 600 ids beneath the window. What licenses extending that
    // to the 6.3M ids beneath *those* is monotonicity holding globally — if it broke anywhere in
    // the registry's history, an old id could carry a recent date and a live attestation would sit
    // outside the window unseen. Sampled logarithmically so the recent, dense, PoH-heavy region
    // gets most of the points while the whole range is still covered.
    const snap = await snapshot()
    const ids = new Set<number>()
    for (let k = 0; k < 160; k++) {
      const id = Math.max(1, Math.round(snap.counter - (snap.counter - 1) * (1 - k / 160) ** 0.25))
      ids.add(Math.min(id, snap.counter - 1))
    }
    for (const id of [1, 2, snap.scannedFromId - 1, snap.scannedFromId, snap.counter - 1]) {
      if (id >= 1 && id < snap.counter) ids.add(id)
    }
    const sorted = [...ids].sort((a, b) => a - b)

    const dates = new Map<number, number>()
    for (let i = 0; i < sorted.length; i += 200) {
      const chunk = sorted.slice(i, i + 200)
      const results = await client.multicall({
        contracts: chunk.map((id) => ({
          address: VERAX_ATTESTATION_REGISTRY,
          abi: ATTESTATION_REGISTRY_ABI,
          functionName: 'getAttestation' as const,
          args: [idToBytes32(id)] as const,
        })),
        allowFailure: true,
        blockNumber: BigInt(snap.block),
      })
      results.forEach((r, k) => {
        if (r.status === 'success') {
          dates.set(chunk[k]!, Number((r.result as { attestedDate: bigint }).attestedDate))
        }
      })
    }

    let previousId = 0
    let previousDate = 0
    for (const id of sorted) {
      const date = dates.get(id)
      if (date === undefined) continue
      assert.ok(
        date >= previousDate,
        `attestedDate went backwards between id ${previousId} (${previousDate}) and id ${id} (${date}) — ids are no longer issued in time order, so a 90-day window no longer bounds the live set`,
      )
      previousId = id
      previousDate = date
    }
    assert.ok(dates.size > 100, `only ${dates.size} sampled ids were readable`)

    // And the boundary itself: the id just below the window must predate the cutoff, which is the
    // single inequality that turns global monotonicity into "nothing below is live".
    const edge = dates.get(snap.scannedFromId - 1)
    if (edge !== undefined) {
      assert.ok(
        edge < snap.takenAt - snap.maxTermSeconds,
        `the id below the window was attested at ${edge}, which is inside the ${snap.maxTermSeconds}s term of the snapshot at ${snap.takenAt} — the ladder landed too high`,
      )
    }
  })

  test('no live attestation carries a longer term than the constant that bounds the window', async () => {
    // This is the single assumption completeness depends on, so it is re-derived every run
    // rather than trusted. `windowWidened` would mean the probe had to correct for it at runtime.
    const snap = await snapshot()
    assert.ok(
      snap.maxTermSeconds <= LINEA_POH_MAX_TERM_SECONDS,
      `an attestation carries a ${snap.maxTermSeconds}s term against a bound of ${LINEA_POH_MAX_TERM_SECONDS}s — raise LINEA_POH_MAX_TERM_SECONDS`,
    )
    assert.equal(snap.windowWidened, false)
    for (const list of snap.bySubject.values()) {
      for (const a of list) {
        assert.ok(a.expirationDate > snap.takenAt, 'an expired attestation is in the live set')
        assert.ok(a.termSeconds <= LINEA_POH_MAX_TERM_SECONDS)
        assert.equal(a.attestedDate + a.termSeconds, a.expirationDate)
      }
    }
  })

  test('every live subject is a 20-byte address and appears once, newest attestation first', async () => {
    const snap = await snapshot()
    for (const [key, list] of snap.bySubject) {
      assert.match(key, /^0x[0-9a-f]{40}$/, 'a subject key is not a lowercased address')
      for (const a of list) assert.equal(a.subject, key)
      for (let i = 1; i < list.length; i++) {
        assert.ok(list[i - 1]!.attestedDate >= list[i]!.attestedDate)
      }
    }
  })

  test('nothing below the window is still alive — the lower edge, proved from the chain alone', async () => {
    // The completeness claim without any second party in it. Monotonicity says everything below
    // `scannedFromId` was attested earlier; this reads the ids immediately below it and requires
    // every attestation on our schema there to be expired. If the 90-day ceiling were wrong, or
    // the ladder landed too high, this is where a live credential would be sitting.
    const snap = await snapshot()
    const below = 600
    const from = Math.max(1, snap.scannedFromId - below)
    const ids: number[] = []
    for (let id = from; id < snap.scannedFromId; id++) ids.push(id)

    let checked = 0
    let ours = 0
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const results = await client.multicall({
        contracts: chunk.map((id) => ({
          address: VERAX_ATTESTATION_REGISTRY,
          abi: ATTESTATION_REGISTRY_ABI,
          functionName: 'getAttestation' as const,
          args: [idToBytes32(id)] as const,
        })),
        allowFailure: true,
        blockNumber: BigInt(snap.block),
      })
      for (const r of results) {
        if (r.status !== 'success') continue
        checked++
        const a = r.result as {
          schemaId: `0x${string}`
          expirationDate: bigint
          revoked: boolean
          subject: `0x${string}`
        }
        if (a.schemaId !== LINEA_POH_V2_SCHEMA) continue
        ours++
        assert.ok(
          a.revoked || Number(a.expirationDate) <= snap.takenAt,
          `attestation below the scanned window is still live (expires ${a.expirationDate}, subject ${a.subject}) — the window is cutting off part of the population`,
        )
      }
    }
    assert.ok(checked > below / 2, `only ${checked} of ${below} ids below the window were readable`)
    assert.ok(ours > 0, 'no PoH attestations below the window at all, so this proved nothing')
  })

  test('the population the chain gives us is the population an independent indexer gives us', async (t) => {
    // The acceptance test. The probe never queries the subgraph; the subgraph never reads the
    // registry the way we do. Pinning both to one block makes set equality the assertion, so a
    // single subject we failed to enumerate fails this — which a count comparison would not.
    const snap = await snapshot()
    let data: Record<string, unknown>
    try {
      data = await graphql(`{
        attestations(first: 1000, block: {number: ${snap.block}}, where: {
          schema: "${LINEA_POH_V2_SCHEMA}",
          revoked: false,
          expirationDate_gt: ${snap.takenAt}
        }) { id subject attestedDate }
      }`)
    } catch (e) {
      skipUnreachable(t, 'the Verax subgraph', e)
      return
    }
    const rows = data['attestations'] as { id: string; subject: string; attestedDate: string }[]
    assert.ok(rows.length < 1000, 'hit the page limit; the comparison would be incomplete')

    // The subgraph indexes the whole registry, including ids above the counter we pinned — it
    // cannot, since we pinned the same block, but restrict anyway so the comparison is exact.
    const indexed = new Map<string, number>()
    for (const r of rows) {
      if (Number(BigInt(r.id)) >= snap.counter) continue
      const seen = indexed.get(r.subject.toLowerCase()) ?? 0
      indexed.set(r.subject.toLowerCase(), Math.max(seen, Number(r.attestedDate)))
    }

    const missing = [...indexed.keys()].filter((s) => !snap.bySubject.has(s))
    const extra = [...snap.bySubject.keys()].filter((s) => !indexed.has(s))
    assert.deepEqual(missing, [], `the enumeration missed ${missing.length} live subjects`)
    assert.deepEqual(extra, [], `the enumeration invented ${extra.length} live subjects`)
    assert.equal(indexed.size, snap.bySubject.size)

    // And the dates agree, not just the membership: the date is what the decay curve consumes.
    for (const [subject, attestedDate] of indexed) {
      assert.equal(snap.bySubject.get(subject)![0]!.attestedDate, attestedDate, subject)
    }
  })

  test('every closed window is inside the scan, non-empty, and already over', async () => {
    const snap = await snapshot()
    assert.ok(snap.endedBySubject.size > 0, 'no ended windows at all, so nothing below proved anything')
    for (const [key, list] of snap.endedBySubject) {
      assert.match(key, /^0x[0-9a-f]{40}$/)
      for (const w of list) {
        assert.equal(w.subject, key)
        assert.ok(w.endedAt > w.attestedDate, `${key}: window ends before it starts`)
        assert.ok(w.endedAt <= snap.takenAt, `${key}: a window that has not closed is not an ending`)
        assert.ok(w.endedAt <= w.expirationDate, `${key}: ended after its own term ran out`)
        assert.ok(
          w.attestedDate >= snap.scannedFromDate,
          `${key}: attested before the scan's own floor, which cannot happen`,
        )
      }
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1]!.endedAt >= list[i]!.endedAt)
    }
    // The two maps answer different questions and a subject in both is a renewal, not a fault —
    // but a *live* attestation must never be the thing that produced a window.
    for (const [key, live] of snap.bySubject) {
      for (const w of snap.endedBySubject.get(key) ?? []) {
        assert.ok(
          live.every((a) => a.attestationId !== w.attestationId),
          `${key}: one attestation is reported both live and ended`,
        )
      }
    }
  })

  test('nothing below the window ended after the instant we claim endings from — chain alone', async () => {
    // The coverage claim, proved the same way the live population's lower edge is: with no
    // second party in it. `endingsCompleteFrom` says every ending at or after that instant is
    // inside the scan. Monotonicity says everything below `scannedFromId` was attested earlier;
    // this reads those ids and requires each one to have *finished* before the claim starts. An
    // ending sitting above the line down here would mean we report an exhaustive absence over a
    // period we did not actually read.
    const snap = await snapshot()
    const below = 600
    const from = Math.max(1, snap.scannedFromId - below)
    const ids: number[] = []
    for (let id = from; id < snap.scannedFromId; id++) ids.push(id)

    let ours = 0
    for (let i = 0; i < ids.length; i += 200) {
      const results = await client.multicall({
        contracts: ids.slice(i, i + 200).map((id) => ({
          address: VERAX_ATTESTATION_REGISTRY,
          abi: ATTESTATION_REGISTRY_ABI,
          functionName: 'getAttestation' as const,
          args: [idToBytes32(id)] as const,
        })),
        allowFailure: true,
        blockNumber: BigInt(snap.block),
      })
      for (const r of results) {
        if (r.status !== 'success') continue
        const a = r.result as {
          schemaId: `0x${string}`
          expirationDate: bigint
          revocationDate: bigint
          revoked: boolean
          subject: `0x${string}`
        }
        if (a.schemaId !== LINEA_POH_V2_SCHEMA) continue
        ours++
        const ended = a.revoked && Number(a.revocationDate) > 0
          ? Math.min(Number(a.revocationDate), Number(a.expirationDate))
          : Number(a.expirationDate)
        assert.ok(
          ended < snap.endingsCompleteFrom,
          `an attestation below the scan ended at ${ended}, after endingsCompleteFrom ${snap.endingsCompleteFrom} (subject ${a.subject}) — the coverage claim is too wide`,
        )
      }
    }
    assert.ok(ours > 0, 'no PoH attestations below the window at all, so this proved nothing')
    // And the claim is worth something: it has to reach back past the live window, or the extra
    // ids we paid for bought no history at all.
    assert.ok(
      snap.endingsCompleteFrom < snap.takenAt,
      'endings are complete only from this instant, which means no window is exhaustively known',
    )
  })

  test('the endings the chain gives us are the endings an independent indexer gives us', async (t) => {
    // The live-population test's twin, over the other half of the scan. Set equality again, so a
    // single window we failed to close fails this — and pinned to the same block and the same id
    // range, so the two sources are answering exactly the same question.
    const snap = await snapshot()
    type Row = {
      id: string
      subject: string
      attestedDate: string
      expirationDate: string
      revocationDate: string
      revoked: boolean
    }
    // Paged by id, because the lapsed half of this window is larger than the live half by
    // design — a page cap here would silently compare a prefix and call it set equality.
    const rows: Row[] = []
    let cursor = BigInt(snap.scannedFromId) - 1n
    try {
      for (let page = 0; page < 20; page++) {
        const data = await graphql(`{
          attestations(first: 1000, orderBy: id, orderDirection: asc, block: {number: ${snap.block}}, where: {
            schema: "${LINEA_POH_V2_SCHEMA}",
            id_gt: "${`0x${cursor.toString(16).padStart(64, '0')}`}",
            attestedDate_gte: ${snap.scannedFromDate},
            expirationDate_lte: ${snap.takenAt}
          }) { id subject attestedDate expirationDate revocationDate revoked }
        }`)
        const page_ = data['attestations'] as Row[]
        rows.push(...page_)
        if (page_.length < 1000) break
        cursor = BigInt(page_[page_.length - 1]!.id)
      }
    } catch (e) {
      skipUnreachable(t, 'the Verax subgraph', e)
      return
    }

    // The indexer is asked only for *expired* attestations, because a revocation date is not a
    // filterable ordering there. Ours is restricted the same way, so the comparison is exact
    // rather than nearly — a revoked-before-expiry window is a different set on both sides.
    const ourExpired = new Map<string, number>()
    for (const [subject, list] of snap.endedBySubject) {
      for (const w of list) {
        if (w.revoked) continue
        if (Number(BigInt(w.attestationId)) >= snap.counter) continue
        ourExpired.set(subject, Math.max(ourExpired.get(subject) ?? 0, w.endedAt))
      }
    }
    const indexed = new Map<string, number>()
    for (const r of rows) {
      if (r.revoked) continue
      if (Number(BigInt(r.id)) >= snap.counter) continue
      if (Number(BigInt(r.id)) < snap.scannedFromId) continue
      const key = r.subject.toLowerCase()
      indexed.set(key, Math.max(indexed.get(key) ?? 0, Number(r.expirationDate)))
    }

    const missing = [...indexed.keys()].filter((s) => !ourExpired.has(s))
    const extra = [...ourExpired.keys()].filter((s) => !indexed.has(s))
    assert.deepEqual(missing, [], `the enumeration missed ${missing.length} lapsed subjects`)
    assert.deepEqual(extra, [], `the enumeration invented ${extra.length} lapsed subjects`)
    assert.ok(indexed.size > 0, 'the indexer reports no lapsed subjects in range, so this proved nothing')
    for (const [subject, endedAt] of indexed) {
      assert.equal(ourExpired.get(subject), endedAt, `${subject}: the two sources date the ending differently`)
    }
  })
})

describe('the probe', () => {
  test('a subject sampled out of the live population is held, dated by its attestation', async () => {
    const snap = await snapshot()
    const [subject, attestations] = [...snap.bySubject.entries()][0]!
    const result = await lineaPohAdapter().probe(subject as Address)
    assert.equal(result.error, undefined)
    assert.equal(result.held, true)
    assert.equal(result.issuedAt, attestations[0]!.attestedDate)
    assert.equal(result.provenance?.heldFrom, 'chain')
    assert.equal(result.provenance?.dateFrom, 'chain')
    assert.equal(result.detail?.['attesterIsPortalSigner'], true)
    assert.equal(result.detail?.['portalOwnerIsRegisteredIssuer'], true)
    assert.equal(result.detail?.['portalValidationModules'], 0)
    assert.equal(
      result.detail?.['portalOwner']?.toString().toLowerCase(),
      SUMSUB_PORTAL_OWNER.toLowerCase(),
    )
  })

  test('a negative reports the population it searched, because the negative is exhaustive', async () => {
    // The difference that matters between this adapter and a vendor boolean: a `false` here is
    // "we read every live credential and you are not in it", and the detail is what makes that
    // claim checkable rather than asserted.
    const result = await lineaPohAdapter().probe(NO_CREDENTIAL)
    assert.equal(result.error, undefined)
    assert.equal(result.held, false)
    assert.equal(result.issuedAt, undefined)
    assert.equal(result.provenance?.dateFrom, 'none')
    assert.ok(Number(result.detail?.['liveAttestations']) > 0)
    assert.ok(Number(result.detail?.['liveSubjects']) > 0)
    assert.ok(Number(result.detail?.['scannedIds']) > 0)
    assert.equal(Number(result.detail?.['attestationIdCounter']) > 6_000_000, true)
  })

  /**
   * The acceptance test for the lapsed window: *the window we hand back is a window the subject
   * really had, and an as-of score can only see them inside it.*
   *
   * A subject is sampled out of the ended population at run time — nothing is pinned — and the
   * window the probe reports is then held against the registry's own record for that attestation
   * re-read at head, and against `applyAsOfToEvidence`, which is the only consumer of `heldUntil`
   * that exists. Restored at the midpoint of a life that really happened; absent one second after
   * it ended, and one second before it began.
   */
  test('a lapsed subject is a closed window, restorable inside it and nowhere else', async () => {
    const snap = await snapshot()
    // Someone with no live attestation: a renewal would be reported as held, and this is about
    // the credential that ended.
    const entry = [...snap.endedBySubject.entries()].find(([s]) => !snap.bySubject.has(s))
    assert.ok(entry, 'no subject with only a lapsed attestation, so this proved nothing')
    const [subject, windows] = entry
    const window = windows[0]!

    const result = await lineaPohAdapter().probe(subject as Address)
    assert.equal(result.error, undefined)
    assert.equal(result.held, false, 'a lapsed credential is not held')
    assert.equal(result.issuedAt, window.attestedDate)
    assert.equal(result.heldUntil, window.endedAt)
    assert.ok(result.provenance?.notes.includes('date-from-lapsed-verification'))
    assert.equal(result.provenance?.dateFrom, 'chain')

    // The registry, re-read at head rather than out of the snapshot: both ends of the window
    // have to still be the numbers Verax holds.
    const onChain = (await client.readContract({
      address: VERAX_ATTESTATION_REGISTRY,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: 'getAttestation',
      args: [window.attestationId],
    })) as {
      subject: `0x${string}`
      attestedDate: bigint
      expirationDate: bigint
      revocationDate: bigint
      revoked: boolean
    }
    assert.equal(onChain.subject.toLowerCase(), subject)
    assert.equal(Number(onChain.attestedDate), result.issuedAt)
    assert.equal(
      Number(onChain.revoked && Number(onChain.revocationDate) > 0
        ? Math.min(Number(onChain.revocationDate), Number(onChain.expirationDate))
        : Number(onChain.expirationDate)),
      result.heldUntil,
    )

    // And the thing the window is *for*. `applyAsOfToEvidence` is what a historical score runs,
    // and it must put this credential back inside the life it had and nowhere else.
    const ontology = (await import('../ontology-data.json', { with: { type: 'json' } })).default
    const entryFor = ontology.adapters.find((a: { id: string }) => a.id === 'linea-poh')!
    const adapters = new Map([
      [
        'linea-poh',
        {
          id: 'linea-poh',
          name: entryFor.name,
          evidenceClass: entryFor.evidenceClass,
          trustRoot: entryFor.trustRoot,
          forgeCostCents: entryFor.forgeCostCents,
          rentCostCents: entryFor.rentCostCents,
          decayHalfLifeDays: entryFor.decayHalfLifeDays,
          ageCurve: entryFor.ageCurve,
          live: entryFor.live,
          sourceURI: entryFor.sourceURI,
        } as never,
      ],
    ])
    const evidence = [
      {
        adapterId: 'linea-poh',
        adapterName: entryFor.name,
        evidenceClass: entryFor.evidenceClass,
        trustRoot: entryFor.trustRoot,
        observedOn: subject as Address,
        forgeCostCents: entryFor.forgeCostCents,
        rentCostCents: entryFor.rentCostCents,
        live: entryFor.live,
        sourceURI: entryFor.sourceURI,
        held: false,
        issuedAt: result.issuedAt!,
        heldUntil: result.heldUntil!,
        freshness: 0.5,
        effectiveCostCents: 0,
      } as never,
    ]
    const midpoint = Math.floor((result.issuedAt! + result.heldUntil!) / 2)
    const inside = applyAsOfToEvidence(evidence, midpoint, adapters)
    assert.deepEqual(inside.ceasedAfterAsOf, ['linea-poh'], 'not restored at the middle of its own life')
    assert.equal(inside.evidence[0]!.held, true)
    assert.ok((inside.evidence[0]!.effectiveCostCents ?? 0) > 0, 'restored and priced at nothing')

    const atEnd = applyAsOfToEvidence(evidence, result.heldUntil!, adapters)
    assert.deepEqual(atEnd.ceasedAfterAsOf, [], 'still held at the second it stopped counting')
    assert.equal(atEnd.evidence[0]!.held, false)

    const before = applyAsOfToEvidence(evidence, result.issuedAt! - 1, adapters)
    assert.deepEqual(before.ceasedAfterAsOf, [], 'held before it was ever attested')
  })

  test('an unreachable endpoint is an error, never a person who failed a liveness check', async () => {
    const result = await lineaPohAdapter({
      rpcUrl: 'https://127.0.0.1:9/does-not-exist',
      timeoutMs: 2_000,
    }).probe(NO_CREDENTIAL)
    assert.equal(result.held, false)
    assert.ok(result.error, 'a dead endpoint produced held:false with no error, which scores as "not a human"')
  })

  test('one enumeration answers for many subjects', async () => {
    // A multi-address subject must not cost one scan per address.
    const snap = await snapshot()
    const subjects = [...snap.bySubject.keys()].slice(0, 3) as Address[]
    const adapter = lineaPohAdapter()
    const started = Date.now()
    const results = await Promise.all([...subjects, NO_CREDENTIAL].map((s) => adapter.probe(s)))
    assert.deepEqual(
      results.map((r) => r.held),
      [...subjects.map(() => true), false],
    )
    // Three of these were answered from the cached snapshot; the wall clock proves it was not
    // four enumerations.
    assert.ok(Date.now() - started < 60_000)
  })
})

describe('the vendor and the chain disagree, and the chain is the stricter one', () => {
  test('poh-api agrees with us about a currently attested address', async (t) => {
    const snap = await snapshot()
    const subject = [...snap.bySubject.keys()][0]!
    try {
      const res = await fetch(`https://poh-api.linea.build/poh/v2/${subject}`, {
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(res.status, 200)
      assert.equal((await res.text()).trim(), 'true')
    } catch (e) {
      skipUnreachable(t, 'poh-api.linea.build', e)
    }
  })

  test('poh-api and PohVerifier still call an address human after its attestation expired', async (t) => {
    // The finding that justifies reading the registry rather than the endpoint. The vendor's
    // boolean answers "was ever verified"; the attestation says "expired". With 50,475 issued
    // against ~500 live, those are answers about populations two orders of magnitude apart.
    let data: Record<string, unknown>
    const snap = await snapshot()
    try {
      data = await graphql(`{
        attestations(first: 25, orderBy: attestedDate, orderDirection: asc, where: {
          schema: "${LINEA_POH_V2_SCHEMA}"
        }) { subject expirationDate }
      }`)
    } catch (e) {
      skipUnreachable(t, 'the Verax subgraph', e)
      return
    }
    const rows = data['attestations'] as { subject: string; expirationDate: string }[]
    const lapsed = rows.find(
      (r) => Number(r.expirationDate) < snap.takenAt && !snap.bySubject.has(r.subject.toLowerCase()),
    )
    assert.ok(lapsed, 'no lapsed subject in the oldest cohort — unexpected, but not a failure of ours')

    // Our own read first: this address is not in the live population.
    const ours = await lineaPohAdapter().probe(lapsed.subject as Address)
    assert.equal(ours.held, false)
    assert.equal(ours.error, undefined)

    try {
      const boolean = await fetch(`https://poh-api.linea.build/poh/v2/${lapsed.subject}`, {
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(boolean.status, 200)
      assert.equal(
        (await boolean.text()).trim(),
        'true',
        'poh-api has started honouring the expiry — good news, and this test should become an equality',
      )

      const signed = await fetch(`https://poh-signer-api.linea.build/poh/v2/${lapsed.subject}`, {
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(signed.status, 200, 'the signer API refused to sign — it now honours the expiry')
      const signature = (await signed.text()).trim() as `0x${string}`
      const accepted = await client.readContract({
        address: POH_VERIFIER,
        abi: POH_VERIFIER_ABI,
        functionName: 'verify',
        args: [signature, lapsed.subject as Address],
      })
      assert.equal(
        accepted,
        true,
        'PohVerifier rejected a signature for a lapsed credential — the on-chain path now honours the expiry',
      )
    } catch (e) {
      skipUnreachable(t, 'the Linea PoH vendor endpoints', e)
      return
    }

    // And the two authorities are different keys, which is how they came to disagree.
    const verifierSigner = await client.readContract({
      address: POH_VERIFIER,
      abi: POH_VERIFIER_ABI,
      functionName: 'getSigner',
    })
    const portalSigner = await client.readContract({
      address: SUMSUB_POH_PORTAL,
      abi: SUMSUB_PORTAL_ABI,
      functionName: 'signerAddress',
    })
    assert.notEqual(verifierSigner.toLowerCase(), portalSigner.toLowerCase())
  })
})
