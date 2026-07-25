/**
 * As-of scoring — the score as it stood at a past block, not the score we would print today.
 *
 * The registry is deliberately mutable: weights are dated human judgements, and when the
 * research improves they change. Iteration 2 alone moved three trust roots, retired one
 * placeholder root, flipped a protocol's liveness and added fifteen adapters. Every one of
 * those edits silently rewrites history for anyone who kept an old score: a subject told
 * "2.56 on Tuesday" cannot check that number on Wednesday, and a counterparty who denied
 * someone at a threshold cannot show what the ontology said when they did it.
 *
 * That makes the audit trail decorative. `weightHistory()` can already print the list of
 * changes; what it cannot do is *apply* them. This module does, and it is the one thing here
 * that genuinely requires an indexer: reconstructing the ontology at block N means the entity
 * set as it stood at N, and the chain will only tell you that from an archive node, one
 * `eth_call` per adapter, if you already know the adapter ids. Graph Node stores every entity
 * version with its block range, so `adapters(block: {number: N})` is one query.
 *
 * Three rules govern what an as-of result may claim.
 *
 * 1. **It never silently degrades.** Every other read in this SDK falls back — an unreachable
 *    index becomes a caveat, a failed probe becomes an excluded error. Not here. If the
 *    historical ontology cannot be read, we throw, because the alternative is answering a
 *    question about the past with the present and labelling it with a block number.
 *
 * 2. **Credentials are read at chain head, and the result says so.** Probes read contracts
 *    now; there is no cross-chain archive path that would let ten adapters answer as of a
 *    Sepolia block. What we *can* do exactly is exclude credentials that did not exist yet:
 *    a dated credential issued after the as-of instant is dropped. That leaves one direction
 *    of error — a credential held then and revoked since is missed — which understates the
 *    subject rather than the adversary, and is named in a caveat either way.
 *
 * 3. **The reconstruction is checked, not assumed.** `AdapterSet` carries the whole record and
 *    the indexer stores it; `AdapterLivenessSet` carries only a hash, and the deployed mapping
 *    drops it (see `subgraph-registry/src/registry.ts`). So a liveness flip would be invisible
 *    in the reconstruction. We detect that from the chain rather than hoping: the registry's
 *    `revision` is bumped by *both* mutations, so if the audit trail's revisions are exactly
 *    1..`revision()` with no gaps, no liveness event has ever fired and the reconstruction is
 *    exact at every block. When that fails, `auditTrailComplete` is false and the gap is named.
 */

import { createPublicClient, http, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { REGISTRY_ABI, decodeAgeCurve, decodeEvidenceClass, rootKey } from './ontology.ts'
import type { Ontology } from './ontology.ts'
import type { Adapter, Evidence } from './types.ts'

/**
 * Sepolia block the deployed PersonhoodRegistry was created in — `deployments/sepolia.json`,
 * and the block the registry subgraph starts from. Nothing before it has an ontology at all,
 * so an as-of request below it is an error rather than an empty score.
 */
export const REGISTRY_GENESIS_BLOCK = 11344158

/** A registry block number, or an instant to resolve to one. */
export type AsOf = number | Date | string

export interface AsOfPoint {
  /** Sepolia block the ontology was read at. */
  block: number
  /** That block's header timestamp. This, not the wall clock, is what age curves use. */
  timestamp: number
}

/** Everything an as-of result needs to be reproducible and checkable. */
export interface AsOfContext extends AsOfPoint {
  /** Registry revision in force at `block`. */
  registryRevision: number
  /** Adapters the registry held at `block`. */
  adapterCount: number
  /** Block the registry subgraph had indexed when we asked. */
  indexedBlock: number
  /**
   * True when the audit trail provably records every mutation the registry has ever made —
   * see rule 3 above. False means a liveness flip happened that the indexer did not store, so
   * historical `live` flags after that revision are not to be trusted.
   */
  auditTrailComplete: boolean
  /** Revisions the registry counted but the audit trail has no record of. */
  missingRevisions?: number[]
  /**
   * False when the subgraph deployment answering us predates the `LivenessChange` entity. Its
   * `Adapter` records are still exact for every weight change; only liveness flips would be
   * missing, and `auditTrailComplete` is what says whether any happened.
   */
  recordsLivenessChanges: boolean
}

/** As-of context plus what it did to this particular subject's evidence. */
export interface AsOfScoring extends AsOfContext {
  /** Probed adapters with no ontology entry at this revision, so nothing to weigh them by. */
  adaptersNotYetInRegistry: string[]
  /** Held now, but dated after the as-of instant — excluded, because they did not exist. */
  issuedAfterAsOf: string[]
  /** Held now with no issuance date, so we cannot show they existed then. Counted, and flagged. */
  existenceUnverified: string[]
}

// ------------------------------------------------------------------ time → block

/**
 * The greatest block at or before `target`, by binary search over block headers.
 *
 * Header reads need no archive node, which is why an instant is an acceptable way to name an
 * as-of point at all: ~24 `eth_getBlockByNumber` calls against any endpoint. Pure over the
 * sampler so the search is testable without a chain.
 */
export async function blockAtOrBefore(
  target: number,
  lo: number,
  hi: number,
  timestampOf: (block: number) => Promise<number>,
): Promise<number> {
  const loTs = await timestampOf(lo)
  if (loTs > target) {
    throw new Error(
      `as-of ${new Date(target * 1000).toISOString()} is before block ${lo} (${new Date(loTs * 1000).toISOString()}), which is where this history starts`,
    )
  }
  if ((await timestampOf(hi)) <= target) return hi

  // Invariant: ts(lo) <= target < ts(hi). Narrow until they are adjacent.
  let low = lo
  let high = hi
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2)
    if ((await timestampOf(mid)) <= target) low = mid
    else high = mid
  }
  return low
}

const asInstant = (asOf: Date | string): number => {
  const ms = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf)
  if (!Number.isFinite(ms)) throw new Error(`asOf is not a parseable date: ${String(asOf)}`)
  return Math.floor(ms / 1000)
}

/**
 * Turn an `asOf` into the block-and-timestamp pair everything downstream is expressed in.
 *
 * A bare number is a *registry block number*, not a timestamp. The two are not distinguishable
 * by magnitude in any principled way, so the type carries the distinction instead: pass a
 * `Date` or an ISO string to name an instant.
 */
export async function resolveAsOfPoint(client: PublicClient, asOf: AsOf): Promise<AsOfPoint> {
  const head = Number(await client.getBlockNumber())
  const timestampOf = async (block: number) =>
    Number((await client.getBlock({ blockNumber: BigInt(block) })).timestamp)

  if (typeof asOf === 'number') {
    if (!Number.isInteger(asOf) || asOf < 0) throw new Error(`asOf block must be a whole number: ${asOf}`)
    if (asOf < REGISTRY_GENESIS_BLOCK) {
      throw new Error(
        `asOf block ${asOf} predates the registry, which was deployed at Sepolia block ${REGISTRY_GENESIS_BLOCK}. There is no ontology to score against before it.`,
      )
    }
    if (asOf > head) throw new Error(`asOf block ${asOf} is ahead of the Sepolia head (${head})`)
    return { block: asOf, timestamp: await timestampOf(asOf) }
  }

  const instant = asInstant(asOf)
  if (instant > Math.floor(Date.now() / 1000)) throw new Error('asOf is in the future')
  const block = await blockAtOrBefore(instant, REGISTRY_GENESIS_BLOCK, head, timestampOf)
  // Report the block's own timestamp rather than the requested instant: the ontology is a step
  // function over blocks, and pretending to a precision the registry does not have would make
  // two different instants inside one block look like different states of the world.
  return { block, timestamp: await timestampOf(block) }
}

// ------------------------------------------------------- ontology at a past block

interface AdapterRow {
  id: string
  name: string
  evidenceClass: number
  trustRoot: string
  forgeCostCents: string
  rentCostCents: string
  decayHalfLifeDays: number
  ageCurve: number
  live: boolean
  sourceURI: string
  revision: string
}

/** Rows out of the audit trail, in the shape the scorer already understands. */
export function decodeHistoricalAdapters(
  rows: AdapterRow[],
  rootByHash: Map<string, string>,
): Map<string, Adapter> {
  const adapters = new Map<string, Adapter>()
  for (const row of rows) {
    adapters.set(row.id, {
      id: row.id,
      name: row.name,
      evidenceClass: decodeEvidenceClass(row.evidenceClass),
      // An unrecognised hash stays a hash. It is still a distinct correlation key, so
      // saturation keeps working; only the label is lost. Retired root names live in
      // `ontology/adapters.json` under `retiredTrustRoots` precisely so this rarely happens.
      trustRoot: rootByHash.get(row.trustRoot.toLowerCase()) ?? row.trustRoot,
      forgeCostCents: Number(row.forgeCostCents),
      rentCostCents: Number(row.rentCostCents),
      decayHalfLifeDays: Number(row.decayHalfLifeDays),
      ageCurve: decodeAgeCurve(row.ageCurve),
      live: row.live,
      sourceURI: row.sourceURI,
    })
  }
  return adapters
}

/**
 * Which revisions the registry counted but the audit trail has no record of.
 *
 * `AdapterSet` and `AdapterLivenessSet` both bump `revision`, and only the first is stored
 * with its full record, so the recorded revisions being exactly `1..headRevision` is a proof
 * that no liveness flip has ever happened — and therefore that the reconstruction below is
 * exact at *every* block, not just at the ones we checked.
 */
export function missingRevisions(recorded: number[], headRevision: number): number[] {
  const seen = new Set(recorded)
  const gaps: number[] = []
  for (let r = 1; r <= headRevision; r++) if (!seen.has(r)) gaps.push(r)
  return gaps
}

export interface AsOfOntologyOptions {
  registrySubgraphUrl: string
  point: AsOfPoint
  /** Human-readable root names, current and retired, so on-chain hashes reverse to labels. */
  knownRoots?: string[]
  /** On-chain `revision()` at head. Supply it and the completeness check becomes a proof. */
  headRevision?: number
  timeoutMs?: number
}

async function graphql<T>(url: string, query: string, timeoutMs: number): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new Error(`registry subgraph at ${url} did not answer: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok) throw new Error(`registry subgraph at ${url} returned HTTP ${res.status}`)
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(`registry subgraph rejected the query: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  if (!json.data) throw new Error('registry subgraph returned no data')
  return json.data
}

/** Cap on one page of entities. Both sets are tens of rows today; a truncated read is reported. */
const PAGE = 1000

/**
 * The ontology exactly as the registry held it at `point.block`.
 *
 * Throws rather than degrading — see rule 1 in the header. The commonest failure by far is the
 * indexer being behind the requested block, and that gets its own message, because "score this
 * as of five minutes ago" against a subgraph that is ten minutes behind is a legitimate request
 * with a legitimate answer of "not yet".
 */
export async function loadOntologyAsOf(
  opts: AsOfOntologyOptions,
): Promise<{ ontology: Ontology; context: AsOfContext }> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const rootByHash = new Map((opts.knownRoots ?? []).map((r) => [rootKey(r).toLowerCase(), r]))

  const head = await graphql<{ _meta: { block: { number: number } } | null }>(
    opts.registrySubgraphUrl,
    '{ _meta { block { number } } }',
    timeoutMs,
  )
  const indexedBlock = Number(head._meta?.block?.number ?? 0)
  if (!indexedBlock) throw new Error('registry subgraph reports no indexed block yet')
  if (indexedBlock < opts.point.block) {
    throw new Error(
      `registry subgraph has only indexed to block ${indexedBlock}, and you asked for ${opts.point.block}. The history it holds is real; it just does not reach that far yet.`,
    )
  }

  const adaptersAndChanges = `
       adapters(block: { number: ${opts.point.block} }, first: ${PAGE}, orderBy: id) {
         id name evidenceClass trustRoot forgeCostCents rentCostCents
         decayHalfLifeDays ageCurve live sourceURI revision
       }
       changes: weightChanges(first: ${PAGE}, orderBy: revision, orderDirection: asc) { revision block }`

  type Rows = {
    adapters: AdapterRow[]
    changes: { revision: string; block: string }[]
    flips?: { revision: string; block: string }[]
  }

  // `LivenessChange` records the one mutation `weightChanges` does not — a protocol declared
  // discontinued or revived. Deployments made before it existed simply reject the field, and
  // that is a fine thing to fall back from: their `Adapter` history is still exact for every
  // weight change, and the revision-gap check below is what notices if a flip happened.
  let recordsLivenessChanges = true
  let data: Rows
  try {
    data = await graphql<Rows>(
      opts.registrySubgraphUrl,
      `{ ${adaptersAndChanges}
         flips: livenessChanges(first: ${PAGE}, orderBy: revision, orderDirection: asc) { revision block } }`,
      timeoutMs,
    )
  } catch {
    recordsLivenessChanges = false
    data = await graphql<Rows>(opts.registrySubgraphUrl, `{ ${adaptersAndChanges} }`, timeoutMs)
  }
  const flips = data.flips ?? []

  if (data.adapters.length === 0) {
    throw new Error(
      `the registry held no adapters at block ${opts.point.block}. It was deployed at ${REGISTRY_GENESIS_BLOCK} and first seeded a few blocks later.`,
    )
  }
  if (data.adapters.length === PAGE || data.changes.length === PAGE || flips.length === PAGE) {
    throw new Error(
      `registry subgraph read hit the ${PAGE}-row page cap, so this reconstruction would be silently partial`,
    )
  }

  const adapters = decodeHistoricalAdapters(data.adapters, rootByHash)
  const mutations = [...data.changes, ...flips]
  const recorded = mutations.map((c) => Number(c.revision))
  const recordedAtOrBefore = mutations
    .filter((c) => Number(c.block) <= opts.point.block)
    .map((c) => Number(c.revision))

  // Two independent statements of the same number: the highest revision the audit trail
  // recorded at or before this block, and the highest any surviving adapter record carries.
  // They come from the same events, but through different entities, so a mismatch means the
  // indexer's two writes disagree — which is worth failing on rather than picking a winner.
  const revisionFromChanges = Math.max(0, ...recordedAtOrBefore)
  const revisionFromAdapters = Math.max(0, ...data.adapters.map((a) => Number(a.revision)))
  if (revisionFromChanges !== revisionFromAdapters) {
    throw new Error(
      `registry subgraph is internally inconsistent at block ${opts.point.block}: audit trail says revision ${revisionFromChanges}, adapter records say ${revisionFromAdapters}`,
    )
  }

  const headRevision = opts.headRevision ?? Math.max(0, ...recorded)
  const gaps = missingRevisions(recorded, headRevision)

  return {
    ontology: { adapters, revision: revisionFromChanges },
    context: {
      ...opts.point,
      registryRevision: revisionFromChanges,
      adapterCount: adapters.size,
      indexedBlock,
      auditTrailComplete: gaps.length === 0,
      ...(gaps.length ? { missingRevisions: gaps } : {}),
      recordsLivenessChanges,
    },
  }
}

// -------------------------------------------------- credentials at a past instant

/**
 * Drop credentials that did not exist yet, and name the ones we cannot place either way.
 *
 * Probes read the chain at head (rule 2 in the header), which leaves two ways for a
 * head-observed credential to be wrong about the past, and they are not symmetric. A
 * credential *dated after* the as-of instant certainly did not exist then, and that we can fix
 * exactly — it is dropped here. A credential held then and revoked since we cannot see at all,
 * and that one understates the subject, so it stays a caveat rather than a correction.
 *
 * The third case is the one worth naming: a credential held now with no issuance date. Every
 * protocol we probe that reports no date is one where the contract stores none, so there is
 * nothing to check it against. Dropping them would gut an honest subject's result over a
 * missing field; keeping them silently would let a credential minted this morning count toward
 * a score from last week. They are kept and listed, and the caveat says which.
 */
export function applyAsOfToEvidence(
  evidence: Evidence[],
  asOfTimestamp: number,
): { evidence: Evidence[]; issuedAfterAsOf: string[]; existenceUnverified: string[] } {
  const issuedAfterAsOf: string[] = []
  const existenceUnverified: string[] = []

  const out = evidence.map((e) => {
    if (!e.held) return e
    // `issuedAfter` is a proven lower bound on issuance, so the credential is younger than it.
    const notBefore = e.issuedAt ?? e.issuedAfter
    if (notBefore === undefined) {
      existenceUnverified.push(e.adapterId)
      return e
    }
    if (notBefore <= asOfTimestamp) return e
    issuedAfterAsOf.push(e.adapterId)
    return {
      ...e,
      held: false,
      freshness: 0,
      effectiveCostCents: 0,
      detail: { ...(e.detail ?? {}), excludedByAsOf: 'issued after the as-of instant' },
    }
  })

  return { evidence: out, issuedAfterAsOf, existenceUnverified }
}

/** A Sepolia client for the registry, matching what `loadOntology` uses. */
export function registryClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl ?? 'https://ethereum-sepolia-rpc.publicnode.com'),
  }) as PublicClient
}

/** On-chain `revision()` at head — the number the completeness check is proved against. */
export async function headRevisionOf(
  client: PublicClient,
  registryAddress: `0x${string}`,
): Promise<number> {
  return Number(
    await client.readContract({ address: registryAddress, abi: REGISTRY_ABI, functionName: 'revision' }),
  )
}
