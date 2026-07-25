/**
 * Subgraph client — the SDK's source for what a boolean contract read cannot see.
 *
 * `isHuman(addr)` answers "does this credential exist"; it cannot answer "was it revoked", or
 * "what is this avatar's position in the trust graph". Those live in indexed history, and the
 * subgraph is where we read them.
 *
 * Every read here returns the **block the index had reached**, in the same request as the
 * entity, so the answer is a statement about a named block rather than about "now". That is
 * what lets `reconcile.ts` tell three different things apart that the old code collapsed into
 * one `undefined`: the index does not have this credential *at a block it names*, the index
 * cannot see this credential's history at all, and the index did not answer. The first is
 * evidence; the last two are not.
 */

import type { IndexView } from './reconcile.ts'

export interface PohEnrichment {
  claimedAt: number
  revoked: boolean
}

export interface CirclesEnrichment {
  registeredAt: number
  trustedByCount: number
  stopped: boolean
}

/**
 * The block each protocol's first credential was created in, on chain.
 *
 * This is the yardstick coverage is measured against: an index whose earliest indexed event is
 * at or before this block has missed no credential, so its silence about one is evidence that
 * the credential did not exist. The numbers are on-chain measurements, not manifest values:
 *
 * - PoH: first `HumanityClaimed` at Gnosis block 36029465, found by a topic-filtered
 *   `eth_getLogs` over `[35846827, 36500000]` — from the proxy's own deployment block, so it is
 *   the first one there has ever been. `eth_getCode` at 35846826 is `0x`, at 35846827 is the
 *   proxy. Confirmed on two independent endpoints (`rpc.gnosischain.com`, tenderly).
 * - Circles: first `RegisterHuman` at Gnosis block 36501311. The Hub's code first appears at
 *   36486014 (`0x` at 36486013), so the same argument holds.
 *
 * A wrong value here is not a cosmetic error: too low leaves us calling a windowed index
 * complete, which turns "we cannot see it" into "it did not exist" and prices real credentials
 * as brand new.
 */
export const PROTOCOL_FIRST_CREDENTIAL_BLOCK = {
  poh: 36_029_465,
  circles: 36_501_311,
} as const

/**
 * What to assume about coverage when the deployment cannot say.
 *
 * A subgraph deployed before the `IndexCoverage` entity existed answers nothing about its own
 * lower edge, so the SDK falls back to these — which is exactly the arrangement the coverage
 * entity replaces, and the reason it exists: this table has to be kept in step with a manifest
 * in another package by hand, and when it drifts it drifts silently. `poh: true` matches every
 * deployment there has been (the data source has always started at the proxy's deployment
 * block); `circles: false` is the conservative reading of the ~2-month window that shipped
 * before 2026-07-25, and the direction that cannot invent an age bound.
 */
export const LEGACY_SUBGRAPH_COVERAGE = {
  poh: { completeHistory: true },
  circles: { completeHistory: false },
} as const

interface QueryResult<T> {
  data?: T
  /** The endpoint answered and rejected the query — a schema mismatch, not an outage. */
  rejected?: boolean
}

async function queryResult<T>(url: string, q: string, timeoutMs = 10_000): Promise<QueryResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return {}
    const json = (await res.json()) as { data?: T; errors?: unknown[] }
    if (json.errors?.length) return { rejected: true }
    return { data: json.data }
  } catch {
    return {}
  }
}

async function query<T>(url: string, q: string, timeoutMs = 10_000): Promise<T | undefined> {
  return (await queryResult<T>(url, q, timeoutMs)).data
}

/** What the index says about its own lower edge, for one data source. */
export interface IndexCoverage {
  protocol: 'poh' | 'circles'
  firstEventBlock: number
  firstEventAt: number
  firstEventKind: string
  /** True when the earliest indexed event is at or before the protocol's first credential. */
  completeHistory: boolean
}

function coverageFromRow(
  protocol: 'poh' | 'circles',
  row: { firstEventBlock: string; firstEventAt: string; firstEventKind: string },
): IndexCoverage {
  const firstEventBlock = Number(row.firstEventBlock)
  return {
    protocol,
    firstEventBlock,
    firstEventAt: Number(row.firstEventAt),
    firstEventKind: row.firstEventKind,
    completeHistory: firstEventBlock <= PROTOCOL_FIRST_CREDENTIAL_BLOCK[protocol],
  }
}

/**
 * What the index says about how far back it can see, for one data source.
 *
 * Exported because it is the answer to "is this index's silence evidence?", and a consumer that
 * only ever reads reconciled results should still be able to ask it directly. Returns
 * `undefined` when the endpoint does not answer, and `null` when it answers and has no coverage
 * record yet — a deployment mid-sync that has not reached its first event, or one that predates
 * the entity.
 */
export async function indexCoverage(
  subgraphUrl: string,
  protocol: 'poh' | 'circles',
): Promise<IndexCoverage | null | undefined> {
  const res = await queryResult<{
    coverage: { firstEventBlock: string; firstEventAt: string; firstEventKind: string } | null
  }>(subgraphUrl, `{ coverage: indexCoverage(id: "${protocol}") { firstEventBlock firstEventAt firstEventKind } }`)
  if (res.rejected) return null
  if (!res.data) return undefined
  return res.data.coverage ? coverageFromRow(protocol, res.data.coverage) : null
}

/** How one data source is read: the fields to ask for, and how to turn a row into a credential. */
interface IndexSource {
  protocol: 'poh' | 'circles'
  /** Entity selection against the current schema. */
  entity: string
  /** Entity selection against a deployment predating the observed-issuance and coverage fields. */
  legacyEntity: string
  /**
   * See `IndexView.observesEveryEnding`. A property of *this mapping*, so it is declared here
   * beside the query rather than derived from anything the endpoint says: an index cannot
   * report the events it does not handle, and asking it would be asking the wrong witness.
   */
  observesEveryEnding: boolean
  map: (row: Record<string, unknown>, legacy: boolean) => IndexView['entity']
}

/**
 * One index read: the entity, the block the index had reached, *and* the index's own account of
 * how far back it can see — in a single request.
 *
 * Two requests would reintroduce the tear this design exists to remove — the index can advance
 * between them, so the entity and the block would describe different worlds. The same argument
 * applies to coverage, which is why it rides along here rather than being fetched once and
 * cached: a deployment can be replaced underneath us, and a cached "complete history" outliving
 * the deployment that earned it is precisely the failure the entity exists to prevent.
 *
 * Returns `undefined` for "the index did not answer", which is categorically different from
 * `entity: null`, "the index answered and does not have it".
 */
async function indexRead(
  url: string,
  src: IndexSource,
): Promise<{ view: IndexView; row: Record<string, unknown> | null; legacy: boolean } | undefined> {
  type Row = Record<string, unknown>
  interface Shape {
    _meta: { block: { number: number; timestamp: number | null } } | null
    coverage?: { firstEventBlock: string; firstEventAt: string; firstEventKind: string } | null
    entity: Row | null
  }
  const head = '_meta { block { number timestamp } }'
  const coverageField = `coverage: indexCoverage(id: "${src.protocol}") { firstEventBlock firstEventAt firstEventKind }`
  let legacy = false
  let res = await queryResult<Shape>(url, `{ ${head} ${coverageField} entity: ${src.entity} }`)
  if (res.rejected) {
    // The endpoint answered and refused the query. Against a deployment that predates these
    // fields that is the only symptom available — graph-node rejects unknown selections
    // outright — so fall back to the old shape rather than reporting an outage that is not
    // happening. A malformed query would land here too, which is what the unit tests are for.
    legacy = true
    res = await queryResult<Shape>(url, `{ ${head} entity: ${src.legacyEntity} }`)
  }
  const data = res.data
  // A missing _meta means we cannot name the block this answer belongs to, and an unnamed
  // answer is not usable as evidence of absence. Treat it as no answer at all.
  if (!data?._meta) return undefined
  const coverage = data.coverage ? coverageFromRow(src.protocol, data.coverage) : undefined
  return {
    view: {
      block: Number(data._meta.block.number),
      ...(data._meta.block.timestamp ? { blockTimestamp: Number(data._meta.block.timestamp) } : {}),
      entity: data.entity ? src.map(data.entity, legacy) : null,
      // The index's own account wins where it exists. Where it does not, the deployment either
      // predates the entity or has not reached its first event yet; the first falls back to the
      // declared table, and the second must not claim completeness it has not demonstrated.
      completeHistory: legacy
        ? LEGACY_SUBGRAPH_COVERAGE[src.protocol].completeHistory
        : (coverage?.completeHistory ?? false),
      observesEveryEnding: src.observesEveryEnding,
    },
    row: data.entity,
    legacy,
  }
}

/**
 * Proof of Humanity v2, as the index has it, at the block the index names.
 *
 * `claimObserved` is the field that makes this honest. A `PohHuman` entity is created by
 * whichever handler reaches the humanity first, and for the *vouched* side of a vouch that is
 * `handleVouchRegistered` — the ordinary case, since a vouch is cast on a request that has not
 * resolved yet. Those entities carry the vouch's timestamp as `claimedAt`, which is **earlier**
 * than the claim, so reading it as an issuance date makes the credential look older than it is.
 * On PoH's survival ramp older is worth more, so this is the one direction that pays an
 * adversary, and it is why the direction is declared as `before-issuance` rather than left to a
 * default. Measured on the deployed index: the oldest `PohHuman` is dated at block 35864293, a
 * vouch, while the protocol's first actual `HumanityClaimed` is at 36029465 — 165,172 blocks
 * later.
 *
 * `requestId` cannot substitute: it is the index of the request within the humanity, so 0 is
 * the ordinary first claim rather than a sentinel. Against a deployment that predates
 * `claimObserved` the old assumption is kept (every entity treated as claim-dated), because
 * that is what such a deployment can actually support — and PoH is dated from the contract
 * anyway, so there the index is a cross-check whose disagreements are reported.
 *
 * **`observesEveryEnding` is false, and `revoked` is why it has to be said out loud.** The flag
 * itself is faithful: the deployed implementation (`0x85b88E38…3F52`, verified source) emits
 * `HumanityRevoked` at the two sites that do `delete humanity.owner` — `executeRequest` and
 * `rule` — so the event *is* the ending, and the mapping records it. The problem is the endings
 * it never hears about. A humanity also ends by:
 *
 * - **expiring.** `isHuman` is `owner != 0 && block.timestamp < expirationTime`, and a term
 *   running out emits nothing. There is no event to handle.
 * - **leaving the chain.** `ccDischargeHumanity` clears the owner and emits
 *   `HumanityDischargedDirectly`, which this mapping does not handle: **33 all-time on Gnosis,
 *   25 of them since 2026-05** (topic-filtered `eth_getLogs` over the proxy's whole life,
 *   2026-07-26). Eight sampled that day are `isHuman: false` with `owner` cleared on chain and
 *   present in our index with `revoked: false` and expiries running into 2027.
 *
 * The credential is decided by the chain at head, so none of that moves a score while the RPC
 * answers. It decided one when the RPC did *not*, which is what `observesEveryEnding` now
 * prevents — see `reconcile.ts`. Indexing the two cross-chain events would make this true for
 * the second case and never for the first; only an expiry-aware entity could do that.
 */
export async function pohIndexRead(
  subgraphUrl: string,
  address: string,
): Promise<IndexView | undefined> {
  const read = await indexRead(subgraphUrl, {
    protocol: 'poh',
    entity: `pohHuman(id: "${address.toLowerCase()}") { claimedAt revoked claimObserved }`,
    legacyEntity: `pohHuman(id: "${address.toLowerCase()}") { claimedAt revoked }`,
    observesEveryEnding: false,
    map: (row, legacy) => ({
      issuedAt: Number(row.claimedAt),
      issuanceObserved: legacy ? true : Boolean(row.claimObserved),
      sideEventOrder: 'before-issuance',
      ended: Boolean(row.revoked),
    }),
  })
  return read?.view
}

/**
 * Circles v2 avatar, as the index has it, at the block the index names.
 *
 * `registrationObserved` says whether the registration itself was indexed. It replaces reading
 * a null `inviter` as the discriminator, which happened to work — the old mapping wrote
 * `inviter` only in `handleRegisterHuman` — but was incidental, depending on the registration
 * handler being the only writer of an unrelated field.
 *
 * The direction is `after-issuance`, and that is a claim about the mapping rather than about
 * Circles: `handleRegisterHuman` overwrites the date, so an avatar still carrying a trust-edge
 * timestamp is one whose registration was never indexed, which with a full-history data source
 * means it predates the Hub's own first registration — impossible — or the index has not
 * reached it yet. Either way the edge cannot precede the registration, so the date understates
 * age and is usable as a floor. (An avatar *can* be trusted before it registers, which is how
 * invitations work; that is exactly why the overwrite matters.)
 *
 * **`ended` is hard-false here, and that is the whole of Circles' revocation story.** The Hub
 * writes `mintTimes[a].lastMintTime` at registration and never writes it back to zero — there is
 * no `delete` on `avatars`, `_claimIssuance` only ever raises it, and `_updateMintV1Status`
 * takes a `_max` — so `isHuman`, which is `lastMintTime > 0`, is monotonic and a Circles
 * credential cannot be revoked. This used to read `ended: Boolean(row.stopped)`, which was the
 * only place in the SDK where an index could retire a credential the chain still honours, and it
 * produced a subject who was held at head and not-held whenever the Gnosis RPC failed: the same
 * torn read `reconcile.ts` exists to kill, in the one field the reconciler cannot second-guess.
 * `stop()` ends personal-Circles *minting* and leaves the human registered, so it comes back
 * beside the credential instead — see `adapters/circles.ts`, which reads it from Hub storage
 * because the contract's `stopped()` getter answers about the caller rather than the argument.
 *
 * The same argument is what makes `observesEveryEnding` **true** here, and it is true
 * vacuously: there are no endings to observe, so this index cannot miss one. That is the
 * opposite verdict from PoH's for the same reason each protocol's `ended` is what it is, and
 * it is worth stating rather than inheriting a default — an index earns the right to answer
 * alone by being able to see every way the credential can stop being held, and monotonicity is
 * the strongest form of that: nothing can stop it.
 */
export async function circlesIndexRead(
  subgraphUrl: string,
  address: string,
): Promise<(IndexView & { trustedByCount?: number; stopped?: boolean }) | undefined> {
  const id = address.toLowerCase()
  const read = await indexRead(subgraphUrl, {
    protocol: 'circles',
    entity: `circlesAvatar(id: "${id}") { registeredAt trustedByCount stopped inviter registrationObserved }`,
    legacyEntity: `circlesAvatar(id: "${id}") { registeredAt trustedByCount stopped inviter }`,
    observesEveryEnding: true,
    map: (row, legacy) => ({
      issuedAt: Number(row.registeredAt),
      issuanceObserved: legacy ? row.inviter != null : Boolean(row.registrationObserved),
      sideEventOrder: 'after-issuance',
      ended: false,
    }),
  })
  if (!read) return undefined
  // Graph position and the stop flag are not part of the credential's identity, so they ride
  // alongside the reconciled view rather than inside it — same request, no second round trip.
  const trustedByCount = read.row?.trustedByCount
  const stopped = read.row?.stopped
  return {
    ...read.view,
    ...(typeof trustedByCount === 'number' ? { trustedByCount } : {}),
    ...(typeof stopped === 'boolean' ? { stopped } : {}),
  }
}

/** PoH v2 humanity ids are the claimant's address as bytes20, so the lookup key is the address. */
export async function pohEnrichment(
  subgraphUrl: string,
  address: string,
): Promise<PohEnrichment | undefined> {
  const data = await query<{ pohHuman: { claimedAt: string; revoked: boolean } | null }>(
    subgraphUrl,
    `{ pohHuman(id: "${address.toLowerCase()}") { claimedAt revoked } }`,
  )
  if (!data?.pohHuman) return undefined
  return { claimedAt: Number(data.pohHuman.claimedAt), revoked: data.pohHuman.revoked }
}

export async function circlesEnrichment(
  subgraphUrl: string,
  address: string,
): Promise<CirclesEnrichment | undefined> {
  const data = await query<{
    circlesAvatar: { registeredAt: string; trustedByCount: number; stopped: boolean } | null
  }>(
    subgraphUrl,
    `{ circlesAvatar(id: "${address.toLowerCase()}") { registeredAt trustedByCount stopped } }`,
  )
  if (!data?.circlesAvatar) return undefined
  return {
    registeredAt: Number(data.circlesAvatar.registeredAt),
    trustedByCount: data.circlesAvatar.trustedByCount,
    stopped: data.circlesAvatar.stopped,
  }
}

/** True once the subgraph has a synced head. Used by tests to skip rather than fail while syncing. */
export async function subgraphReady(subgraphUrl: string): Promise<boolean> {
  const data = await query<{ _meta: { block: { number: number } } | null }>(
    subgraphUrl,
    `{ _meta { block { number } } }`,
  )
  return (data?._meta?.block?.number ?? 0) > 0
}

// ---------------------------------------------------------- registry audit trail

export interface WeightChange {
  revision: number
  forgeCostCents: number
  rentCostCents: number
  live: boolean
  sourceURI: string
  timestamp: number
  block: number
  txHash: string
}

/**
 * The audit trail for one adapter, from the registry subgraph — every weight the ontology
 * has ever assigned it, each with the source it was derived from and the block it landed in.
 *
 * This is the accountability half of curated weights: the weights are judgments, so the
 * least a subject is owed is the full history of those judgments and their sources. The
 * biggest sybil-filtering deployment to date drew its loudest criticism for having no
 * stated method and no appeal path; this is the opposite design.
 */
export async function weightHistory(
  registrySubgraphUrl: string,
  adapterId: string,
): Promise<WeightChange[] | undefined> {
  const data = await query<{
    weightChanges: {
      revision: string
      forgeCostCents: string
      rentCostCents: string
      live: boolean
      sourceURI: string
      timestamp: string
      block: string
      txHash: string
    }[]
  }>(
    registrySubgraphUrl,
    `{ weightChanges(where: { adapter: "${adapterId}" }, orderBy: revision, orderDirection: asc) {
        revision forgeCostCents rentCostCents live sourceURI timestamp block txHash } }`,
  )
  if (!data) return undefined
  return data.weightChanges.map((w) => ({
    revision: Number(w.revision),
    forgeCostCents: Number(w.forgeCostCents),
    rentCostCents: Number(w.rentCostCents),
    live: w.live,
    sourceURI: w.sourceURI,
    timestamp: Number(w.timestamp),
    block: Number(w.block),
    txHash: w.txHash,
  }))
}
