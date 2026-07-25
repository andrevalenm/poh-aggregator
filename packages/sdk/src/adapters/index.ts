import { createPublicClient, encodeAbiParameters, http, keccak256, pad, type PublicClient } from 'viem'
import { gnosis, worldchain } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import { circlesIndexRead, pohIndexRead } from '../subgraph.ts'
import {
  reconcileIndexAndChain,
  type ChainView,
  type IndexView,
  type ProvenanceNote,
  type Reconciled,
} from '../reconcile.ts'
import {
  assumedTermHistory,
  classifyHumanityTerm,
  originClient,
  readGrantedTerms,
  readTermHistory,
  resolveImportedTerm,
  termForLocalExpiry,
  POH_V2_DEPLOY_BLOCK,
  POH_V2_MAINNET,
  POH_V2_MAINNET_DEPLOYED_AT,
  POH_V2_MAINNET_DEPLOY_BLOCK,
  type HumanityGrant,
  type HumanityTermOrigin,
  type ImportedTermOrigin,
  type TermHistory,
} from './poh-term.ts'
import { readCirclesStopped, type CirclesMintTime } from './circles.ts'
import { humanPassportAdapter } from './human-passport.ts'
import { farcasterAdapter } from './farcaster.ts'
import { holonymAdapters } from './holonym.ts'
import { lineaPohAdapter } from './linea-poh.ts'
import { pohV1Adapter } from './poh-v1.ts'
import { worldIdOrbAdapter, WORLD_AGENT_BOOK, WORLD_ID_ADDRESS_BOOK, WORLD_RPC } from './world.ts'
import { coinbaseVerificationAdapter, COINBASE_RPC } from './coinbase.ts'

export * from './circles.ts'
export * from './coinbase.ts'
export * from './human-passport.ts'
export * from './farcaster.ts'
export * from './holonym.ts'
export * from './linea-poh.ts'
export * from './poh-term.ts'
export * from './poh-v1.ts'
export * from './world.ts'

/**
 * Adapters.
 *
 * Every adapter here reads a credential **without the issuing vendor's cooperation** — no
 * API key on the critical path, nothing that can rate-limit or revoke us. That constraint
 * shaped the selection: World is read through its on-chain registries rather than the
 * verification API, because `WorldIDAddressBook.addressVerifiedUntil` and
 * `AgentBook.lookupHuman` are plain `eth_call`s that return the Orb-verified status of any
 * address with no proof, no relying-party id and no user interaction.
 *
 * A probe must never throw. A network failure returning `held: false` would silently
 * become "this person is not human", so failures surface as an `error` and are excluded
 * from scoring rather than counted as a negative.
 *
 * Where a probe uses an index, it reads the index **and** the block the index has reached,
 * then confirms against the chain at head — see `reconcile.ts` for why the reverse order was
 * a live scoring bug. A probe never asks the contract for existence and the index for the
 * date as if the two described the same moment.
 */

export const RPC = {
  gnosis: 'https://rpc.gnosischain.com',
  worldchain: WORLD_RPC,
  base: COINBASE_RPC,
} as const

export const CONTRACTS = {
  /** Permissionless World ID lookup. groupId 1 == Orb-verified only. See `world.ts`. */
  worldAgentBook: WORLD_AGENT_BOOK,
  /** World's own registry of verified addresses, with a term and therefore a date. */
  worldIdAddressBook: WORLD_ID_ADDRESS_BOOK,
  /** Proof of Humanity v2 proxy on Gnosis. */
  pohV2: '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc',
  /** Circles v2 Hub on Gnosis. */
  circlesHub: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
} as const

const client = (chain: typeof gnosis | typeof worldchain, url: string) =>
  createPublicClient({ chain, transport: http(url) }) as PublicClient

async function safe(fn: () => Promise<AdapterProbeResult>): Promise<AdapterProbeResult> {
  try {
    return await fn()
  } catch (e) {
    return { held: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Reconcile one index read against one chain read, filling in the indexed block's timestamp
 * if the index did not report one.
 *
 * That timestamp is not a detail: on the absence path it *is* the bound. Graph Node returns
 * null for `_meta.block.timestamp` on some queries, and without it "absent at block B" cannot
 * be turned into "issued after time T", so the probe would fall back to the unknown-age
 * midpoint for want of one `eth_getBlockByNumber`.
 */
async function reconcileWithIndex(opts: {
  c: PublicClient
  chain: ChainView
  index?: IndexView
  indexConfigured: boolean
}): Promise<Reconciled> {
  let index = opts.index
  if (
    index &&
    index.entity === null &&
    index.completeHistory &&
    index.blockTimestamp === undefined &&
    opts.chain.held
  ) {
    try {
      const block = await opts.c.getBlock({ blockNumber: BigInt(index.block) })
      index = { ...index, blockTimestamp: Number(block.timestamp) }
    } catch {
      // Leave it unset: the reconciler then declines to bound the age, which is the honest
      // outcome rather than a guess.
    }
  }
  const reconciled = reconcileIndexAndChain({ chain: opts.chain, index })
  if (opts.indexConfigured && !index) reconciled.provenance.notes.push('index-unreachable')
  return reconciled
}

// World ID lives in `world.ts`: two registries, a date derived from a fixed term, and the
// reasoning about why the document and Selfie tiers cannot be read from any chain.

// -------------------------------------------------------- Proof of Humanity

const POH_ABI = [
  {
    type: 'function',
    name: 'isHuman',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'humanityOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bytes20' }],
  },
  {
    type: 'function',
    name: 'getHumanityInfo',
    stateMutability: 'view',
    inputs: [{ name: 'humanityId', type: 'bytes20' }],
    outputs: [
      { name: 'vouching', type: 'bool' },
      { name: 'pendingRevocation', type: 'bool' },
      { name: 'nbPendingRequests', type: 'uint48' },
      { name: 'expirationTime', type: 'uint40' },
      { name: 'owner', type: 'address' },
      { name: 'nbRequests', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'humanityLifespan',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint40' }],
  },
] as const

/**
 * Timestamp of the Gnosis block the PoH v2 proxy's code first appears at (35,846,827,
 * 2024-09-05T14:58:40Z — measured in iteration 1 by bisecting `eth_getCode`). A claim this
 * contract resolved itself cannot predate it, so it is the floor a derived claim date has to
 * clear. Note it lands 161 seconds after `POH_V1_FORK_TIME`, which is the same deployment.
 */
export const POH_V2_DEPLOYED_AT = 1_725_548_320

/**
 * Storage slot index of `mapping(address => bytes20) private accountHumanity` in the PoH v2
 * implementation, so the account → humanity link can be read for an account the contract has
 * stopped answering for.
 *
 * `private` is a Solidity concept and not a chain one: the mapping is at
 * `keccak256(pad32(account) ++ pad32(62))` like any other, and `eth_getStorageAt` is as
 * permissionless as `eth_call`. The slot was not taken from a storage layout somebody
 * published — it was found by scanning slots 0..119 for a live subject and matching the value
 * against what `humanityOf` returns, and the live suite re-derives it every run.
 *
 * Reading the wrong slot cannot produce a wrong answer, only a missing one: whatever id comes
 * back is used solely to look up `getHumanityInfo`, and nothing is reported unless that
 * record's `owner` **is the subject**. A layout change after a proxy upgrade therefore costs us
 * the lapsed window and can never invent one.
 */
export const POH_V2_ACCOUNT_HUMANITY_SLOT = 62n

/** `bytes20(0)` — what the account mapping holds for an address that has never claimed. */
const ZERO_HUMANITY_ID = '0x0000000000000000000000000000000000000000' as const

/**
 * Turn a humanity's `expirationTime` into an issuance date, or decline to, according to whose
 * term the expiry actually is.
 *
 * `expirationTime - humanityLifespan` recovers the claim instant **only** when this contract
 * wrote the expiry. `poh-term.ts` has the measurement: 7 of the 9 humanities ever imported over
 * the cross-chain bridge carry PoH v1's 730.5-day term, so the local subtraction lands one full
 * v2 lifespan after the truth and reports them as half their real age. Three of those 9 also
 * carry `nbRequests >= 1`, which is why that test — sound but incomplete — is now the fallback
 * rather than the discriminator.
 *
 * Four outcomes, and the asymmetry between them is deliberate:
 *
 * - **local** — derive it, exactly as before, under the same deployment-floor guard.
 * - **imported, origin resolved** — the origin instance's own registration date, reproduced from
 *   its own state to the second. Better than the old answer, not merely safer: it is usually the
 *   *older* date, and on a ramp older is worth more.
 * - **imported, origin unreadable** — the grant block, which is a floor on the credential's age
 *   and is exactly what `date-from-registry-import` was written for.
 * - **imported, nothing at all** — undated. Reachable only when the sweep failed *and* the expiry
 *   is arithmetically impossible for a local write, so there is no grant block to fall back to.
 *   No note: there is no date here whose provenance wants qualifying, and an undated credential is
 *   an ordinary state the scoring already describes.
 *
 * `purpose` exists because an imported credential has two honest start dates and they answer
 * different questions. **`age`** asks how long this human has held the credential, and the answer
 * runs across the bridge: the origin's registration. **`window`** asks which instants *this*
 * registry honoured the humanity for, which an as-of score turns into "held or not held on
 * Gnosis", and that cannot begin before the grant that created it here. Handing the origin's date
 * to an as-of query would restore a Gnosis credential for a Tuesday when the human's registration
 * was still on mainnet — the same fact, but a false statement about this adapter.
 *
 * `history` settles the other half of the premise: not *whose* term the expiry is, but *which* of
 * this contract's terms. `humanityLifespan` is governance-settable, and the subtraction has always
 * used its value at head — so a change would shift every derived date in the registry at once,
 * silently, by the size of the change. `DurationsChanged` publishes every such change, and a
 * full-range sweep of it is a complete timeline; `termForLocalExpiry` picks the era an expiry
 * belongs to and subtracts *that* era's term. With no change ever emitted — the state of both
 * instances today — the timeline is one era and the answer is identical to the old one, which is
 * the point: nothing at head moves, and the assumption behind it is now a checked fact.
 *
 * Omitting `history` keeps the old behaviour exactly, for a caller with no network, and marks the
 * date `term-origin-unverified` when the sweep was attempted and failed.
 */
export function dateHumanityFromTerm(r: {
  expirationTime: number
  lifespan: number
  now: number
  term: HumanityTermOrigin
  origin?: ImportedTermOrigin
  purpose?: 'age' | 'window'
  history?: TermHistory
}): { issuedAt?: number; note?: ProvenanceNote; detail: Record<string, unknown> } {
  const detail: Record<string, unknown> = {}
  if (r.term.kind === 'imported') {
    detail.termImported = true
    if (r.term.grant) detail.importedAt = r.term.grant.grantedAt
    if (r.origin) {
      detail.termOrigin = r.origin.instance
      detail.termSeconds = r.origin.term
      detail.originRegisteredAt = r.origin.issuedAt
    }
    if (r.purpose !== 'window' && r.origin) {
      detail.claimedAt = r.origin.issuedAt
      return { issuedAt: r.origin.issuedAt, note: 'date-from-origin-instance', detail }
    }
    if (r.term.grant) {
      return { issuedAt: r.term.grant.grantedAt, note: 'date-from-registry-import', detail }
    }
    return { detail }
  }

  if (r.term.kind === 'local' && r.term.renewedAfterImport) detail.renewed = true
  // Degenerate inputs, kept ahead of the timeline because they are about the read failing rather
  // than about which term applies: a lifespan of zero is an `eth_call` that did not answer.
  if (r.lifespan <= 0 || r.expirationTime <= r.lifespan) return { detail }

  const history = r.history ?? assumedTermHistory(r.lifespan, POH_V2_DEPLOYED_AT)
  const solved = termForLocalExpiry(history, r.expirationTime, r.now)
  if (solved.kind === 'ambiguous') {
    // Two terms the contract really did grant both place the write inside their own era. Nothing
    // in the record distinguishes them, so there is no date here — only a choice of two.
    detail.termAmbiguous = solved.terms
    return { detail }
  }
  if (solved.kind === 'era-unknown') {
    // Only the era before the first `DurationsChanged` explains this expiry, and `initialize`
    // never published the term that era ran under.
    detail.termEraUnpublished = true
    return { detail }
  }
  if (solved.kind === 'no-era') {
    // A start before this contract existed, or after the block we read, means no term this
    // contract has ever granted wrote this expiry — a record we have misread, or one written by
    // something we cannot see. Better a window we decline to close than one we invent.
    detail.dateRejected = r.expirationTime - r.lifespan
    return { detail }
  }

  const claimedAt = r.expirationTime - solved.term
  if (solved.term !== r.lifespan) detail.termAtClaim = solved.term
  detail.claimedAt = claimedAt
  return {
    issuedAt: claimedAt,
    // Either sweep failing leaves the date resting on the assumption that sweep exists to test:
    // `grants` on *whose* term this is, `history` on *which* of ours. The note is the same
    // because the consequence is. A caller who supplied no `history` at all is not in this case —
    // they never asked, which is the pre-existing contract and stays silent.
    ...(r.term.kind === 'unverified' || (r.history !== undefined && !r.history.observed)
      ? { note: 'term-origin-unverified' as const }
      : {}),
    detail,
  }
}

/** One head-pinned read of an account's humanity record, after `isHuman` has said false. */
export interface LapsedHumanityRead {
  /** The address asked about. */
  subject: Address
  /** `accountHumanity[subject]`, or the conventional id, whichever the record was found under. */
  humanityId: `0x${string}`
  /** `getHumanityInfo(humanityId).owner` — zero once a revocation or a transfer clears it. */
  owner: Address
  /** `.expirationTime`: the second the humanity stopped being honoured. */
  expirationTime: number
  /** `.requests.length`: claims and renewals this contract has resolved for the humanity. */
  nbRequests: number
  /** `humanityLifespan()` at the same block. */
  lifespan: number
  /** Header timestamp of the block all of it was read at. */
  now: number
  /**
   * Whose term this expiry is. Absent means nobody asked — the `nbRequests` fallback then decides
   * alone, which is the pre-`poh-term.ts` behaviour and is kept so this stays callable without a
   * network.
   */
  term?: HumanityTermOrigin
  /** The origin instance's own registration, when the term was imported and could be traced. */
  origin?: ImportedTermOrigin
  /**
   * Every term this registry has granted, and when. Absent means nobody swept `DurationsChanged`,
   * and `lifespan` is then assumed to have been in force since the deployment — the pre-sweep
   * behaviour, kept so this stays callable without a network.
   */
  history?: TermHistory
}

/**
 * Close the window on a humanity this contract no longer honours — or decline to, and say why.
 *
 * PoH v2 does not delete an expired humanity: `owner` and `expirationTime` stay in storage
 * forever, and only `isHuman`, `boundTo` and `humanityOf` apply the expiry comparison on the way
 * out. So the end of the credential is a number the chain still holds at head, and no archive
 * node is involved. What has to be established is the *start*, and two of the three ways this
 * can fail are real cases measured on the live registry (21 lapsed humanities, 2026-07-25):
 *
 * - **`owner` is not the subject.** A revocation (`delete humanity.owner`), a cross-chain
 *   transfer out (the same `delete`), or somebody else re-claiming the id after it lapsed. In
 *   every one of those the credential ended at an instant the contract does not date — 196 of
 *   the 1,569 indexed humanities are in this state — so there is no window and we report none.
 * - **the term is not this contract's.** `ccGrantHumanity` copies an expiry settled on another
 *   instance, so `expirationTime - humanityLifespan` becomes arithmetic about a contract we did
 *   not read — and for 7 of the 9 imports in the registry's life the origin is PoH v1, whose term
 *   is *twice* as long. `dateHumanityFromTerm` takes the origin's own registration date instead,
 *   which is both correct and older. See `poh-term.ts` for the sweep and the measurement.
 *
 * `nbRequests == 0` — "this contract never resolved a request for this humanity" — remains as the
 * fallback for a caller who supplies no `term`, because it is sound. It is not the discriminator
 * any more because it is incomplete: **3 of the 9 imports carry `nbRequests >= 1`**, from a failed
 * local claim or a renewal made after the transfer, and it can only ever refuse a date where the
 * grant log can recover one.
 */
export function closeLapsedHumanityWindow(r: LapsedHumanityRead): {
  heldUntil?: number
  issuedAt?: number
  note?: ProvenanceNote
  detail: Record<string, unknown>
} {
  const detail: Record<string, unknown> = {}
  if (r.owner.toLowerCase() !== r.subject.toLowerCase()) {
    // Nothing about this subject: either they never held the humanity, or whatever ended it
    // wiped the only link back to them. Both are silence rather than a negative.
    if (r.owner !== '0x0000000000000000000000000000000000000000' && r.expirationTime > 0) {
      detail.humanityOwnedByAnother = true
    }
    return { detail }
  }
  if (r.expirationTime <= 0 || r.expirationTime > r.now) return { detail }

  detail.lapsedHumanityId = r.humanityId
  detail.expirationTime = r.expirationTime
  detail.nbRequests = r.nbRequests
  detail.lapsedDaysAgo = Math.round(((r.now - r.expirationTime) / 86_400) * 10) / 10

  // No `term` supplied means nothing looked at the grant log, and then `nbRequests == 0` is the
  // only evidence there is that the expiry came from elsewhere. Once a `term` is supplied it
  // supersedes this: it is exact where this is a proxy, and it can recover a date where this can
  // only withhold one.
  if (r.term === undefined && r.nbRequests === 0) {
    detail.grantedWithoutLocalRequest = true
    return { heldUntil: r.expirationTime, detail }
  }

  const dated = dateHumanityFromTerm({
    expirationTime: r.expirationTime,
    lifespan: r.lifespan,
    now: r.now,
    term: r.term ?? { kind: 'local' },
    ...(r.origin ? { origin: r.origin } : {}),
    ...(r.history ? { history: r.history } : {}),
    purpose: 'window',
  })
  Object.assign(detail, dated.detail)
  return {
    heldUntil: r.expirationTime,
    ...(dated.issuedAt !== undefined ? { issuedAt: dated.issuedAt } : {}),
    ...(dated.note ? { note: dated.note } : {}),
    detail,
  }
}

/**
 * Proof of Humanity v2 on Gnosis.
 *
 * Weight this by registration age rather than the boolean. Roughly 1,299 of 1,364 lifetime
 * registrations arrived in a four-month window tracking a ~$9.94 PNK airdrop one-for-one,
 * `requiredNumberOfVouches()` is 1, and `HumanityRevoked` has fired exactly once ever.
 *
 * The date comes from the contract, not the index. `getHumanityInfo` returns the humanity's
 * `expirationTime`, and `humanityLifespan()` is the fixed term granted at claim, so
 * `expirationTime - humanityLifespan` is the claim timestamp — two `eth_call`s, no indexer,
 * nothing that can lag or rate-limit us. Verified against the index on a live registration:
 * 1815521110 - 31557600 = 1783963510, the exact `claimedAt` the subgraph reports.
 *
 * That removes PoH from the class of scores an index can move at all. The index stays useful
 * for what the contract cannot say — the vouch graph, revocation history, the daily
 * registration curve that exposes the airdrop — and now doubles as a cross-check: a
 * disagreement between the two dates is reported as a fault in our indexing.
 *
 * Note `nbRequests > 1` means the humanity was re-claimed or renewed, so the derived date is
 * the latest claim rather than the first registration. It is surfaced in `detail` because on
 * a survival ramp the difference matters.
 *
 * The subtraction has two premises, and both are now checked rather than assumed.
 *
 * *Whose term is this?* `ccGrantHumanity` copies a term settled on another instance, and for 7 of
 * the 9 humanities ever imported that instance is PoH v1, whose term is twice as long. One memoised
 * sweep of `HumanityGrantedDirectly` says which humanities those are, and where the origin still
 * publishes the registration behind the expiry it is read from there instead.
 *
 * *Which of our terms is it?* `humanityLifespan` is governance-settable, and the subtraction uses
 * its value at head — so a change would move every derived date in the registry at once, by the
 * size of the change, with nothing to notice it. `changeDurations` is the only writer after
 * `initialize` and it emits `DurationsChanged`, so a second memoised sweep is a complete timeline
 * of the term, and the era an expiry falls in decides which value to subtract. **Zero changes on
 * either instance to date**, so nothing at head moves — the assumption simply stopped being one.
 * See `poh-term.ts` for both.
 *
 * A subject the contract answers `false` for gets one more question asked of them: *did you
 * hold a humanity that has since expired?* The registry never deletes one — `owner` and
 * `expirationTime` outlive the credential — so both ends of that window are readable at head,
 * and `closeLapsedHumanityWindow` decides whether they can be trusted to close it. Nothing at
 * head changes: `held` stays false and the credential weighs nothing. It exists so `asOf` can
 * answer a question about a Tuesday the subject was still registered on.
 */
export function pohAdapter(rpcUrl: string = RPC.gnosis, subgraphUrl?: string): AdapterProbe {
  const c = client(gnosis, rpcUrl)
  /** Governance-settable but effectively constant; one read per adapter instance. */
  let lifespan: Promise<number> | undefined
  /**
   * Every cross-chain grant the registry has ever emitted, read once and shared. Nine logs over
   * the contract's life, so the whole set is cheaper to hold than to re-query per subject — and
   * holding it means the common case (no grant for this humanity) costs a map lookup.
   */
  let grants: Promise<Map<string, HumanityGrant[]> | undefined> | undefined
  /**
   * Every change the registry has made to `humanityLifespan`, read once and shared. Currently
   * zero logs, and the sweep is a single full-range `eth_getLogs` measured at 124 ms — so the
   * check that the term has never moved costs one request per process, not one per subject.
   */
  let terms: Promise<TermHistory | undefined> | undefined
  /** Mainnet, for the origin lookup only. Built lazily: most subjects never need it. */
  let origins: PublicClient | undefined
  /** Mainnet PoH v2's own term timeline plus the block it was read at; only imports need it. */
  let originTerms: Promise<{ history?: TermHistory; now: number } | undefined> | undefined

  /**
   * Which of this contract's terms wrote this expiry, as far as the chain says.
   *
   * Memoised on success only, exactly as the grant sweep is and for the same reason: a rate limit
   * is a moment, not a property of the registry, and a failed sweep must not mark every later
   * probe in the process `term-origin-unverified`.
   */
  const historyFor = async (lifespanAtHead: number, head: bigint): Promise<TermHistory | undefined> => {
    const read = await (terms ??= readTermHistory(c, head, CONTRACTS.pohV2, {
      deployBlock: POH_V2_DEPLOY_BLOCK,
      deployedAt: POH_V2_DEPLOYED_AT,
      lifespanAtHead,
    }))
    if (!read) terms = undefined
    return read
  }

  /**
   * Whose term wrote this expiry, and — when it was not this contract's — what the origin
   * instance says the registration date is.
   *
   * The mainnet round trip is paid only for a humanity the sweep has actually named, which is
   * currently 9 of 1,576. A failure there costs the exact date and falls back to the grant block,
   * never to a date derived from the wrong term.
   */
  const termFor = async (
    humanityId: string,
    expirationTime: number,
    term: number,
    now: number,
    head: bigint,
  ): Promise<{ term: HumanityTermOrigin; origin?: ImportedTermOrigin }> => {
    // Memoised on success only. A sweep that failed must not poison every later probe in the
    // process with `term-origin-unverified` — a rate limit is a moment, not a property of the
    // registry. The pin is the *first* head reached rather than each probe's, so a grant mined
    // during a long-lived process is missed until it restarts; that is one humanity every few
    // months against a query per subject, and it is written down rather than silently traded.
    const known = await (grants ??= readGrantedTerms(c, head, CONTRACTS.pohV2))
    if (!known) grants = undefined
    const classified = classifyHumanityTerm({
      humanityId,
      expirationTime,
      lifespan: term,
      now,
      ...(known ? { grants: known } : {}),
    })
    if (classified.kind !== 'imported') return { term: classified }
    const onMainnet = (origins ??= originClient())
    // The origin's date is a subtraction on that instance too, so it wants the same timeline —
    // read once, on the first import this process sees, and never for a subject with none.
    const mainnetTerms = await (originTerms ??= (async () => {
      const [block, lifespanAtHead] = await Promise.all([
        onMainnet.getBlock(),
        onMainnet
          .readContract({ address: POH_V2_MAINNET, abi: POH_ABI, functionName: 'humanityLifespan' })
          .then(Number),
      ])
      const history = await readTermHistory(onMainnet, block.number!, POH_V2_MAINNET, {
        deployBlock: POH_V2_MAINNET_DEPLOY_BLOCK,
        deployedAt: POH_V2_MAINNET_DEPLOYED_AT,
        lifespanAtHead,
      })
      return { ...(history ? { history } : {}), now: Number(block.timestamp) }
    })().catch(() => undefined))
    if (!mainnetTerms) originTerms = undefined
    const origin = await resolveImportedTerm(onMainnet, humanityId, expirationTime, mainnetTerms).catch(
      () => undefined,
    )
    return { term: classified, ...(origin ? { origin } : {}) }
  }

  /**
   * The subject holds no humanity now. Ask whether they held one that has since expired, and
   * bring back both ends of it if the contract can date them.
   *
   * Two candidate ids, because neither is sufficient alone. `accountHumanity[subject]` from
   * storage is the general answer and survives expiry, where `humanityOf` returns zero.
   * `bytes20(subject)` is the convention every claim in the registry has followed so far, and
   * it is the fallback for the day the storage layout moves under a proxy upgrade. Whichever
   * answers, the record is only used when its `owner` is the subject — see
   * `closeLapsedHumanityWindow`.
   *
   * Every failure here is swallowed. The subject does not hold this credential either way; an
   * unreadable *history* must not turn a clean negative into a probe error.
   */
  const readLapsedHumanity = async (
    subject: Address,
    block: number,
    now: number,
  ): Promise<{
    heldUntil?: number
    issuedAt?: number
    note?: ProvenanceNote
    detail: Record<string, unknown>
  }> => {
    const conventionalId = subject.toLowerCase() as `0x${string}`
    try {
      const slot = keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'uint256' }],
          [pad(subject, { size: 32 }), POH_V2_ACCOUNT_HUMANITY_SLOT],
        ),
      )
      const [stored, conventional, term] = await Promise.all([
        c.getStorageAt({ address: CONTRACTS.pohV2, slot, blockNumber: BigInt(block) }).catch(() => undefined),
        c
          .readContract({
            address: CONTRACTS.pohV2,
            abi: POH_ABI,
            functionName: 'getHumanityInfo',
            args: [conventionalId],
            blockNumber: BigInt(block),
          })
          .catch(() => undefined),
        (lifespan ??= c
          .readContract({ address: CONTRACTS.pohV2, abi: POH_ABI, functionName: 'humanityLifespan' })
          .then(Number)),
      ])

      const storedId =
        stored && stored.length === 66 ? (`0x${stored.slice(26)}` as `0x${string}`) : undefined
      const candidates: `0x${string}`[] = []
      if (storedId && storedId !== ZERO_HUMANITY_ID) candidates.push(storedId)
      if (!candidates.includes(conventionalId)) candidates.push(conventionalId)

      for (const humanityId of candidates) {
        const info =
          humanityId === conventionalId && conventional
            ? conventional
            : await c
                .readContract({
                  address: CONTRACTS.pohV2,
                  abi: POH_ABI,
                  functionName: 'getHumanityInfo',
                  args: [humanityId],
                  blockNumber: BigInt(block),
                })
                .catch(() => undefined)
        if (!info) continue
        const record = {
          subject,
          humanityId,
          owner: info[4] as Address,
          expirationTime: Number(info[3]),
          nbRequests: Number(info[5]),
          lifespan: term,
          now,
        }
        // Two passes on purpose. The first decides whether this record is the subject's lapsed
        // humanity at all, which costs nothing; only then is it worth asking the network whose
        // term the expiry is. Discarded candidates never reach mainnet.
        if (closeLapsedHumanityWindow(record).heldUntil === undefined) continue
        const [whose, history] = await Promise.all([
          termFor(humanityId, record.expirationTime, term, now, BigInt(block)),
          historyFor(term, BigInt(block)),
        ])
        const closed = closeLapsedHumanityWindow({
          ...record,
          ...whose,
          history: history ?? assumedTermHistory(term, POH_V2_DEPLOYED_AT),
        })
        if (closed.heldUntil !== undefined) {
          if (storedId && humanityId === storedId) closed.detail.humanityIdFrom = 'account-mapping'
          else closed.detail.humanityIdFrom = 'address-convention'
          return closed
        }
      }
      return { detail: {} }
    } catch {
      return { detail: {} }
    }
  }

  const readChain = async (
    subject: Address,
  ): Promise<ChainView & { note?: ProvenanceNote; detail: Record<string, unknown> }> => {
    const detail: Record<string, unknown> = {}
    let block: number | undefined
    try {
      const [head, held] = await Promise.all([
        c.getBlock(),
        c.readContract({
          address: CONTRACTS.pohV2,
          abi: POH_ABI,
          functionName: 'isHuman',
          args: [subject],
        }),
      ])
      block = Number(head.number)
      if (!held) {
        const lapsed = await readLapsedHumanity(subject, block, Number(head.timestamp))
        Object.assign(detail, lapsed.detail)
        return {
          held: false,
          block,
          ...(lapsed.issuedAt !== undefined ? { issuedAt: lapsed.issuedAt } : {}),
          ...(lapsed.heldUntil !== undefined ? { heldUntil: lapsed.heldUntil } : {}),
          ...(lapsed.note ? { note: lapsed.note } : {}),
          detail,
        }
      }

      const humanityId = await c.readContract({
        address: CONTRACTS.pohV2,
        abi: POH_ABI,
        functionName: 'humanityOf',
        args: [subject],
      })
      detail.humanityId = humanityId
      try {
        lifespan ??= c
          .readContract({ address: CONTRACTS.pohV2, abi: POH_ABI, functionName: 'humanityLifespan' })
          .then(Number)
        const [info, term] = await Promise.all([
          c.readContract({
            address: CONTRACTS.pohV2,
            abi: POH_ABI,
            functionName: 'getHumanityInfo',
            args: [humanityId],
          }),
          lifespan,
        ])
        const expirationTime = Number(info[3])
        const nbRequests = Number(info[5])
        detail.expirationTime = expirationTime
        detail.nbRequests = nbRequests
        if (nbRequests > 1) detail.renewed = true
        // Whose term this expiry is, and which of ours it is, decide whether the subtraction below
        // means anything. The guards inside `dateHumanityFromTerm` are the old ones: no date at all
        // beats a fabricated one when either value is zero or the lifespan outruns the expiry.
        const [whose, history] = await Promise.all([
          termFor(humanityId, expirationTime, term, Number(head.timestamp), head.number),
          historyFor(term, head.number),
        ])
        const dated = dateHumanityFromTerm({
          expirationTime,
          lifespan: term,
          now: Number(head.timestamp),
          ...whose,
          history: history ?? assumedTermHistory(term, POH_V2_DEPLOYED_AT),
          purpose: 'age',
        })
        Object.assign(detail, dated.detail)
        if (dated.issuedAt !== undefined) {
          return {
            held: true,
            issuedAt: dated.issuedAt,
            block,
            ...(dated.note ? { note: dated.note } : {}),
            detail,
          }
        }
        if (dated.note) return { held: true, block, note: dated.note, detail }
      } catch {
        // The date is optional; losing it must not turn a positive into a negative or an
        // error. The reconciler falls back to the index, then to a bound, then to unknown.
      }
      return { held: true, block, detail }
    } catch (e) {
      return {
        held: false,
        unavailable: true,
        ...(block !== undefined ? { block } : {}),
        detail: { chainError: e instanceof Error ? e.message : String(e) },
      }
    }
  }

  return {
    adapterId: 'poh-v2',
    probe: (subject: Address) =>
      safe(async () => {
        const [index, chain] = await Promise.all([
          subgraphUrl ? pohIndexRead(subgraphUrl, subject) : undefined,
          readChain(subject),
        ])
        const { detail, note, ...chainView } = chain
        const r = await reconcileWithIndex({
          c,
          chain: chainView,
          ...(index ? { index } : {}),
          indexConfigured: Boolean(subgraphUrl),
        })
        // Pushed after reconciliation, like the Passport issuer note: this is something the probe
        // learned from the protocol, not something reconciling an index against a chain produced.
        // Only when the reconciler kept the chain's date — if it fell back to the index or to a
        // bound, the note describes a number nobody is using.
        if (note && r.provenance.dateFrom === 'chain') r.provenance.notes.push(note)
        return {
          held: r.held,
          ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
          ...(r.issuedAfter !== undefined ? { issuedAfter: r.issuedAfter } : {}),
          ...(r.heldUntil !== undefined ? { heldUntil: r.heldUntil } : {}),
          provenance: r.provenance,
          ...(r.error ? { error: (detail.chainError as string) ?? r.error } : {}),
          detail: {
            ...detail,
            ...(index?.entity ? { indexClaimedAt: index.entity.issuedAt } : {}),
          },
        }
      }),
  }
}

// ----------------------------------------------------------------- Circles

const CIRCLES_ABI = [
  {
    type: 'function',
    name: 'isHuman',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

/**
 * Circles v2 on Gnosis — registration plus trust-graph position.
 *
 * Registration alone is close to worthless: a sybil costs about two days of freely-minted
 * CRC, and the public indexer carries event namespaces named `BotCreated` and `FarmGrown`.
 * What carries signal is position in the trust graph, so we fetch incoming trust edges and
 * expose them as detail for the graph-derived modifier.
 *
 * `held` is `isHuman`, and `isHuman` is monotonic — nothing in the Hub ever clears
 * `lastMintTime` and there is no `delete` on `avatars` — so **Circles has no revocation**. The
 * one transition an avatar has is `stop()`, which ends personal-Circles minting and leaves the
 * registration standing. It is read from Hub storage here (see `circles.ts`: the contract's own
 * `stopped()` getter answers about the caller rather than the address you pass, so it returns
 * false for everyone) and reported as detail and a caveat, never as an ending.
 */
export function circlesAdapter(
  rpcUrl: string = RPC.gnosis,
  indexerUrl = 'https://rpc.aboutcircles.com/',
  subgraphUrl?: string,
): AdapterProbe {
  const c = client(gnosis, rpcUrl)

  const readChain = async (
    subject: Address,
  ): Promise<ChainView & { error?: string; mintTime?: CirclesMintTime }> => {
    try {
      const [head, held] = await Promise.all([
        c.getBlockNumber(),
        c.readContract({
          address: CONTRACTS.circlesHub,
          abi: CIRCLES_ABI,
          functionName: 'isHuman',
          args: [subject],
        }),
      ])
      // Same batch, so the storage word and the `isHuman` it is validated against describe the
      // same world. `undefined` means the decode failed its own check and we say nothing.
      const mintTime = await readCirclesStopped(c, subject, held)
      return { held, block: Number(head), ...(mintTime ? { mintTime } : {}) }
    } catch (e) {
      return { held: false, unavailable: true, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return {
    adapterId: 'circles-v2',
    probe: (subject: Address) =>
      safe(async () => {
        // The Hub stores no registration timestamp, so unlike PoH the date can only come from
        // an index — which is exactly why the reconciler has to be careful here. Whether an
        // avatar's absence from the index proves anything is the index's own claim to make: the
        // read carries the earliest event that index holds, and the reconciler turns absence
        // into an age bound only when that edge is at or before the Hub's first registration.
        const [index, chain] = await Promise.all([
          subgraphUrl ? circlesIndexRead(subgraphUrl, subject) : undefined,
          readChain(subject),
        ])
        const { error: chainError, mintTime, ...chainView } = chain
        const r = await reconcileWithIndex({
          c,
          chain: chainView,
          ...(index ? { index } : {}),
          indexConfigured: Boolean(subgraphUrl),
        })
        if (r.error) {
          return { held: false, provenance: r.provenance, error: chainError ?? r.error }
        }
        if (!r.held) return { held: false, provenance: r.provenance }

        // `stop()` is irreversible and does not deregister, so it is reported next to the
        // credential rather than instead of it. The chain read is authoritative; the index's
        // flag is the same protocol event seen later, so a difference is index lag and is shown
        // rather than resolved. Reporting `stop` as an ending is what this replaces — it made
        // the same subject held at head and not-held on the fallback path.
        const stoppedDetail: Record<string, unknown> = {}
        if (mintTime) {
          stoppedDetail.stopped = mintTime.stopped
          if (mintTime.stopped) r.provenance.notes.push('credential-minting-stopped')
          if (index?.stopped !== undefined && index.stopped !== mintTime.stopped) {
            stoppedDetail.stoppedIndexed = index.stopped
          }
        } else if (index?.stopped !== undefined) {
          stoppedDetail.stopped = index.stopped
          if (index.stopped) r.provenance.notes.push('credential-minting-stopped')
        }

        if (index?.entity) {
          return {
            held: true,
            ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
            provenance: r.provenance,
            detail: {
              ...(index.trustedByCount !== undefined ? { trustedBy: index.trustedByCount } : {}),
              ...stoppedDetail,
              source: 'subgraph',
            },
          }
        }

        // No indexed avatar: fall back to the vendor indexer for graph position only. It can
        // rate-limit or vanish, so it never decides `held` — the contract already did.
        let trustedBy: number | undefined
        try {
          const res = await fetch(indexerUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'circles_query',
              params: [
                {
                  Namespace: 'V_CrcV2',
                  Table: 'TrustRelations',
                  Columns: ['truster'],
                  Filter: [
                    { Type: 'FilterPredicate', FilterType: 'Equals', Column: 'trustee', Value: subject.toLowerCase() },
                  ],
                  Order: [],
                },
              ],
            }),
            signal: AbortSignal.timeout(12_000),
          })
          const json = (await res.json()) as { result?: { rows?: unknown[] } }
          trustedBy = json.result?.rows?.length
        } catch {
          // Indexer is best-effort; registration alone still counts.
        }
        return {
          held: true,
          ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
          ...(r.issuedAfter !== undefined ? { issuedAfter: r.issuedAfter } : {}),
          provenance: r.provenance,
          detail: {
            ...(trustedBy === undefined ? {} : { trustedBy }),
            ...stoppedDetail,
          },
        }
      }),
  }
}

// Coinbase Verified Account lives in `coinbase.ts`: an on-chain index the issuer maintains,
// the EAS predeploy as the only thing trusted to say what the attestation is, and the reason
// scanning `Attested` logs on Base is not an option.

/** Every adapter that can be read without vendor cooperation. */
export function defaultAdapters(opts?: { subgraphUrl?: string }): AdapterProbe[] {
  return [
    worldIdOrbAdapter(),
    pohAdapter(RPC.gnosis, opts?.subgraphUrl),
    circlesAdapter(RPC.gnosis, undefined, opts?.subgraphUrl),
    coinbaseVerificationAdapter(),
    humanPassportAdapter(),
    farcasterAdapter(),
    ...holonymAdapters(),
    lineaPohAdapter(),
    pohV1Adapter(),
  ]
}
