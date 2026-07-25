/**
 * Whose term is this? — deciding whether PoH v2 on Gnosis is entitled to subtract its own
 * `humanityLifespan()` from a humanity's `expirationTime`.
 *
 * The date behind every PoH v2 score is one subtraction: `expirationTime - humanityLifespan`.
 * It is exact when this contract wrote the expiry, because both writing sites do
 * `expirationTime = block.timestamp + humanityLifespan` (`executeRequest` L1176, `rule` L1358 of
 * the deployed implementation `0x85b88E38…3F52`). There is a third writer, and it does not:
 *
 * ```solidity
 * function ccGrantHumanity(bytes20 _humanityId, address _account, uint40 _expirationTime)
 *     external onlyCrossChain returns (bool success) {
 *     …
 *     humanity.expirationTime = _expirationTime;          // copied from another instance
 *     emit HumanityGrantedDirectly(_humanityId, _account, _expirationTime);
 * ```
 *
 * So an imported humanity carries **another instance's term**, and subtracting ours from it is
 * arithmetic about a contract we did not read. This is not a hypothetical: of the 9 cross-chain
 * grants in the registry's life (full-history sweep, Gnosis 35,846,827 → 47,390,776), **7 came
 * from Proof of Humanity v1 on mainnet, whose `submissionDuration()` is 63,115,200 s — twice
 * this contract's 31,557,600**. Every one of the 7 matches `v1.submissionTime + submissionDuration`
 * to the second, so the local subtraction lands exactly **one v2 lifespan (365.25 days) after the
 * true registration**, and reports a two-year-old credential as a one-year-old one.
 *
 * ## `nbRequests` was the wrong discriminator
 *
 * The lapsed path used `nbRequests == 0` — "this contract never resolved a request for this
 * humanity" — and that is sound but incomplete. `ccGrantHumanity` does not push a request, but it
 * also does not clear one: **3 of the 9 imports landed on a humanity with `nbRequests >= 1`**, and
 * two of those three are held at head today. A humanity can carry a local request that is a failed
 * claim, or a renewal made *after* the import. Reading `nbRequests` therefore misses a third of the
 * population it was written for, and it can only ever refuse a date — it can never recover one.
 *
 * ## What the chain publishes instead
 *
 * `HumanityGrantedDirectly(bytes20 indexed humanityId, address indexed owner, uint40 expirationTime)`
 * carries the exact expiry it wrote, is indexed by humanity, and is immutable. If a grant exists
 * for this humanity whose `expirationTime` is still the one in storage, the term is imported —
 * exactly, with no inference. If one exists and the expiry has since moved, this contract wrote the
 * current one over it, which is a *renewal* the `nbRequests > 1` test also misses.
 *
 * The whole set is 9 logs over 22 months, so one memoised full-range `eth_getLogs` answers it for
 * every subject (measured 339 ms against `rpc.gnosischain.com`, which serves the full range in one
 * request; a node that refuses is swept in 2M-block chunks).
 *
 * Once the term is known to be imported, the origin instance still publishes the registration it
 * was computed from, and *that* is the date: `submissionTime` on PoH v1, or
 * `expirationTime - humanityLifespan()` on PoH v2 mainnet. The match is required to reproduce our
 * expiry **to the second** before either is believed — a coincidence at that resolution is not a
 * thing that happens, and anything less would be pattern-matching rather than proof.
 *
 * ## The one proof that needs no network
 *
 * A locally written expiry is `block.timestamp + humanityLifespan` for some block at or before
 * head, so it can never exceed `now + humanityLifespan`. An expiry that does is proof the premise
 * of the subtraction is false — either the term is imported or `humanityLifespan` has been changed
 * since the write — and in both cases the derived date is not usable. It is free, it is sound, and
 * it is what keeps the grant sweep from being load-bearing on its own.
 *
 * ## Which term — the second premise, and the one nothing was watching
 *
 * "Whose term" and "which term" are different questions. Even for an expiry this contract
 * unambiguously wrote, the subtraction uses `humanityLifespan()` **as it reads at head**, and the
 * field is governance-settable:
 *
 * ```solidity
 * function changeDurations(uint40 _humanityLifespan, …) external onlyGovernor {
 *     humanityLifespan = _humanityLifespan;
 *     …
 *     emit DurationsChanged(_humanityLifespan, …);
 * }
 * ```
 *
 * A change would leave every expiry written before it unchanged and silently shift every date
 * derived from one, by the full size of the change, for every subject at once. That is not
 * hypothetical for this protocol: PoH **v1**'s `submissionDuration` has already moved, from
 * 31,557,600 to 63,115,200 — and v1's `changeDurations` (line 563 of the verified source) emits
 * nothing at all, so on v1 the change is invisible.
 *
 * v2 publishes it. `DurationsChanged` is emitted by the only function that writes the field after
 * `initialize`, so a full-range sweep of that one event is a complete history of the term — and
 * with **zero logs on both instances** (Gnosis 35,846,827 → 47,391,312 in 124 ms; mainnet
 * 20,685,061 → 25,613,069 in 95 ms, both full-range in a single request, 2026-07-26) the premise
 * stops being an assumption and becomes something the probe checks every run.
 *
 * When a change does land, the sweep is better than a tripwire: it dates the change, so the era
 * an expiry belongs to can be worked out and the *right* term subtracted from it. That is what
 * `termForLocalExpiry` does. The one era it cannot recover is the first, because `initialize` sets
 * the field without emitting anything — an expiry that only that era explains is left undated
 * rather than guessed at.
 */
import { createPublicClient, fallback, http, parseAbi, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { POH_V1_REGISTRY, POH_V1_RPCS } from './poh-v1.ts'

/** Proof of Humanity v2 on mainnet — the other side of the cross-chain bridge. */
export const POH_V2_MAINNET = '0xbE9834097A4E97689d9B667441acafb456D0480A' as const

/**
 * Deployment of the mainnet proxy: block 20,685,061, 2024-09-05T14:43:59Z, from its own creation
 * transaction `0x9d77e37f…4563`. The floor of a `DurationsChanged` sweep on that instance, and
 * 881 seconds ahead of the Gnosis one — the two are the same launch.
 */
export const POH_V2_MAINNET_DEPLOY_BLOCK = 20_685_061n
export const POH_V2_MAINNET_DEPLOYED_AT = 1_725_547_439

/** The Gnosis block PoH v2's proxy code first appears at; the floor of any grant sweep. */
export const POH_V2_DEPLOY_BLOCK = 35_846_827n

/**
 * Largest range a chunked sweep asks for when a node refuses the full history. Six requests
 * covers the registry's life today; `rpc.gnosischain.com` and `rpc.gnosis.gateway.fm` both serve
 * the whole range in one and never reach this, `gnosis-rpc.publicnode.com` refuses either way.
 */
const SWEEP_CHUNK = 2_000_000n

export const HUMANITY_GRANTED_DIRECTLY = parseAbi([
  'event HumanityGrantedDirectly(bytes20 indexed humanityId, address indexed owner, uint40 expirationTime)',
])[0]

/**
 * The only announcement the registry makes about the term it grants.
 *
 * Emitted by `changeDurations` and by nothing else — `initialize` writes `humanityLifespan`
 * silently, which is why the first era of the timeline below has no recoverable value. No
 * parameter is indexed, so the sweep is by address alone; the whole population is currently
 * empty on both instances, so that costs nothing.
 */
export const DURATIONS_CHANGED = parseAbi([
  'event DurationsChanged(uint40 humanityLifespan, uint40 renewalPeriodDuration, uint40 challengePeriodDuration, uint40 failedRevocationCooldown)',
])[0]

const POH_V1_TERM_ABI = parseAbi([
  'function getSubmissionInfo(address) view returns (uint8 status, uint64 submissionTime, uint64 index, bool registered, bool hasVouched, uint256 numberOfRequests)',
  'function submissionDuration() view returns (uint64)',
])

const POH_V2_TERM_ABI = parseAbi([
  'function getHumanityInfo(bytes20) view returns (bool vouching, bool pendingRevocation, uint48 nbPendingRequests, uint40 expirationTime, address owner, uint256 nbRequests)',
  'function humanityLifespan() view returns (uint40)',
])

/** One `HumanityGrantedDirectly` log: a term this contract copied rather than computed. */
export interface HumanityGrant {
  /** Lower-cased `bytes20` humanity id. */
  humanityId: string
  /** The expiry the grant wrote, verbatim from the origin instance. */
  expirationTime: number
  /** Gnosis block the grant was mined in. */
  block: number
  /** Header timestamp of that block: the credential provably existed by then. */
  grantedAt: number
}

/** Where a humanity's current `expirationTime` was written, as far as we can prove it. */
export type HumanityTermOrigin =
  /** This contract wrote it, so `expirationTime - humanityLifespan` is the claim instant. */
  | { kind: 'local'; renewedAfterImport?: boolean }
  /**
   * Another instance wrote it. `grant` is present when the log was read; absent when the expiry
   * simply cannot be one this contract wrote (it is further out than a full term from head).
   */
  | { kind: 'imported'; grant?: HumanityGrant }
  /** Nothing could be established: the sweep did not answer. */
  | { kind: 'unverified' }

/**
 * Decide whether the local subtraction is entitled to run, from values already in hand.
 *
 * `grants` absent means the sweep failed, not that there are none — the two are the same
 * distinction `IndexView.entity: null` draws, and conflating them here would hand every subject
 * a date on the strength of a request that never returned.
 */
export function classifyHumanityTerm(r: {
  humanityId: string
  expirationTime: number
  /** `humanityLifespan()` at head. */
  lifespan: number
  /** Header timestamp of the block everything was read at. */
  now: number
  /** Every `HumanityGrantedDirectly` the contract has emitted, keyed by lower-cased id. */
  grants?: ReadonlyMap<string, readonly HumanityGrant[]>
}): HumanityTermOrigin {
  const forThisHumanity = r.grants?.get(r.humanityId.toLowerCase()) ?? []
  const matching = forThisHumanity.find((g) => g.expirationTime === r.expirationTime)
  if (matching) return { kind: 'imported', grant: matching }

  // Free and sound, and it does not need the sweep: no local write can put an expiry more than
  // one full term past the block we read at.
  if (r.lifespan > 0 && r.expirationTime > r.now + r.lifespan) {
    return { kind: 'imported' }
  }

  if (!r.grants) return { kind: 'unverified' }
  // The sweep answered. Either this humanity was never imported, or it was and this contract has
  // written over the imported expiry since — which is a renewal, whatever `nbRequests` says.
  return forThisHumanity.length > 0 ? { kind: 'local', renewedAfterImport: true } : { kind: 'local' }
}

/**
 * Read every cross-chain grant the registry has ever emitted.
 *
 * Returns `undefined` rather than an empty map when the node refuses, because "no imports" and
 * "we could not ask" license completely different answers downstream.
 */
export async function readGrantedTerms(
  c: PublicClient,
  head: bigint,
  address: `0x${string}`,
): Promise<Map<string, HumanityGrant[]> | undefined> {
  const collect = async (): Promise<{ humanityId: string; expirationTime: number; block: bigint }[]> => {
    const shape = (
      logs: { args: { humanityId?: unknown; expirationTime?: unknown }; blockNumber: bigint | null }[],
    ) =>
      logs.flatMap((l) =>
        l.blockNumber === null || typeof l.args.humanityId !== 'string'
          ? []
          : [
              {
                humanityId: l.args.humanityId.toLowerCase(),
                expirationTime: Number(l.args.expirationTime),
                block: l.blockNumber,
              },
            ],
      )
    try {
      return shape(
        await c.getLogs({
          address,
          event: HUMANITY_GRANTED_DIRECTLY,
          fromBlock: POH_V2_DEPLOY_BLOCK,
          toBlock: head,
        }),
      )
    } catch {
      const out: ReturnType<typeof shape> = []
      for (let from = POH_V2_DEPLOY_BLOCK; from <= head; from += SWEEP_CHUNK + 1n) {
        const to = from + SWEEP_CHUNK > head ? head : from + SWEEP_CHUNK
        out.push(
          ...shape(
            await c.getLogs({ address, event: HUMANITY_GRANTED_DIRECTLY, fromBlock: from, toBlock: to }),
          ),
        )
      }
      return out
    }
  }

  try {
    const raw = await collect()
    // The grant block's timestamp is a floor on the credential's age and the fallback date when
    // the origin instance can no longer be read, so it is worth the extra header reads. Distinct
    // blocks only: the whole population is 9 logs.
    const blocks = [...new Set(raw.map((g) => g.block))]
    const stamps = new Map(
      await Promise.all(
        blocks.map(async (b) => [b, Number((await c.getBlock({ blockNumber: b })).timestamp)] as const),
      ),
    )
    const byHumanity = new Map<string, HumanityGrant[]>()
    for (const g of raw) {
      const grant: HumanityGrant = {
        humanityId: g.humanityId,
        expirationTime: g.expirationTime,
        block: Number(g.block),
        grantedAt: stamps.get(g.block) ?? 0,
      }
      const existing = byHumanity.get(g.humanityId)
      if (existing) existing.push(grant)
      else byHumanity.set(g.humanityId, [grant])
    }
    return byHumanity
  } catch {
    return undefined
  }
}

/**
 * One stretch of the registry's life over which a single term was granted to every new claim.
 *
 * Eras are half-open in time — `[from, until)` — because that is exactly how the contract behaves:
 * `changeDurations` takes effect for the block it is mined in and every block after it, and a
 * claim resolved in the same block is written under the new value.
 */
export interface TermEra {
  /** First second of the era. The deployment for the first era, the change's block for the rest. */
  from: number
  /** First second *after* the era; absent for the era still running at head. */
  until?: number
  /**
   * The term in force, in seconds. Absent only for the first era, whose value `initialize` wrote
   * without emitting anything — recoverable in principle from the deployment calldata or from an
   * archive `eth_call`, and deliberately not guessed at here.
   */
  seconds?: number
  /** Block the `DurationsChanged` that opened this era was mined in; absent for the first era. */
  block?: number
}

/** Every term the registry has granted, and when. */
export interface TermHistory {
  /** Chronological, contiguous, covering the deployment through head. Never empty. */
  eras: TermEra[]
  /**
   * The eras came from a completed sweep of `DurationsChanged`, so they are what the chain says.
   * `false` means nobody swept and head's term was *assumed* to have been in force all along —
   * the assumption this module exists to stop making silently.
   */
  observed: boolean
}

/** The history a caller who cannot sweep has to work with: head's term, assumed to be eternal. */
export function assumedTermHistory(lifespan: number, deployedAt: number): TermHistory {
  return { eras: [{ from: deployedAt, ...(lifespan > 0 ? { seconds: lifespan } : {}) }], observed: false }
}

/**
 * Read every change the registry has made to `humanityLifespan`, and lay them out as a timeline.
 *
 * Returns `undefined` when the sweep did not answer — the same distinction `readGrantedTerms`
 * draws, for the same reason: "the term has never changed" and "we could not ask" license
 * completely different confidence in every date downstream.
 *
 * It also returns `undefined` when the newest logged value **disagrees with head**, which would
 * mean the field was written by something other than `changeDurations` — a proxy upgrade
 * re-running an initializer, say. A sweep whose result cannot explain the state at head has not
 * answered the question, whatever it returned, and saying so costs a caveat rather than a wrong
 * date.
 */
export async function readTermHistory(
  c: PublicClient,
  head: bigint,
  address: `0x${string}`,
  opts: { deployBlock: bigint; deployedAt: number; lifespanAtHead: number },
): Promise<TermHistory | undefined> {
  const shape = (logs: { args: { humanityLifespan?: unknown }; blockNumber: bigint | null }[]) =>
    logs.flatMap((l) =>
      l.blockNumber === null ? [] : [{ seconds: Number(l.args.humanityLifespan), block: l.blockNumber }],
    )
  try {
    let raw: ReturnType<typeof shape>
    try {
      raw = shape(
        await c.getLogs({ address, event: DURATIONS_CHANGED, fromBlock: opts.deployBlock, toBlock: head }),
      )
    } catch {
      raw = []
      for (let from = opts.deployBlock; from <= head; from += SWEEP_CHUNK + 1n) {
        const to = from + SWEEP_CHUNK > head ? head : from + SWEEP_CHUNK
        raw.push(
          ...shape(await c.getLogs({ address, event: DURATIONS_CHANGED, fromBlock: from, toBlock: to })),
        )
      }
    }
    raw.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0))

    // The common case, and the one that turns the premise into a proof: nothing has ever changed
    // the term, so head's value is the only one this contract has had, for its whole life.
    if (raw.length === 0) {
      if (opts.lifespanAtHead <= 0) return undefined
      return { eras: [{ from: opts.deployedAt, seconds: opts.lifespanAtHead }], observed: true }
    }
    if (raw[raw.length - 1]!.seconds !== opts.lifespanAtHead) return undefined

    const stamps = new Map(
      await Promise.all(
        [...new Set(raw.map((r) => r.block))].map(
          async (b) => [b, Number((await c.getBlock({ blockNumber: b })).timestamp)] as const,
        ),
      ),
    )
    const eras: TermEra[] = [{ from: opts.deployedAt }]
    for (const change of raw) {
      const at = stamps.get(change.block)!
      // Two changes in one block, or one that moved nothing: the later write is what applied.
      if (eras[eras.length - 1]!.from === at) eras.pop()
      eras[eras.length - 1]!.until = at
      eras.push({ from: at, seconds: change.seconds, block: Number(change.block) })
    }
    return { eras, observed: true }
  } catch {
    return undefined
  }
}

/** Which term produced an expiry this contract wrote — or why that cannot be settled. */
export type TermResolution =
  /** Exactly one era can have produced it, so its term is the one to subtract. */
  | { kind: 'settled'; term: number; era: TermEra }
  /** No era can have: the expiry is not something a local write could have produced. */
  | { kind: 'no-era' }
  /** Two eras with different terms both explain it. Nothing distinguishes them; refuse. */
  | { kind: 'ambiguous'; terms: number[] }
  /** Only the first era — the one whose term `initialize` never published — can explain it. */
  | { kind: 'era-unknown' }

/**
 * Solve `expirationTime = claimedAt + term` for the era `claimedAt` falls in.
 *
 * Both local writers do `expirationTime = block.timestamp + humanityLifespan`, so a candidate era
 * explains an expiry exactly when subtracting *that era's* term lands the write inside *that era*.
 * With one era — today, on both instances — this reduces to the deployment-floor guard the probe
 * has always applied, which is why nothing at head moves.
 *
 * `now` is a ceiling on every era, not just the running one: no block has been mined in the future,
 * so no expiry can have been written after the block we read at.
 *
 * A known era wins over the unrecoverable first one rather than being called ambiguous against it.
 * The first era can be assigned a term to fit *any* expiry, so treating it as a rival would make
 * every date in the registry's history unrecoverable the moment governance touched the field once.
 * The cost is a coincidence — an expiry written in the first era that a later era's term also
 * happens to explain — and that is written down rather than traded silently.
 */
export function termForLocalExpiry(h: TermHistory, expirationTime: number, now: number): TermResolution {
  const fits: { term: number; era: TermEra }[] = []
  let firstEraCouldFit = false
  for (const era of h.eras) {
    const until = Math.min(era.until ?? Number.POSITIVE_INFINITY, now + 1)
    if (era.from >= until) continue
    if (era.seconds === undefined) {
      // Some term, we cannot say which, would place the write inside this era.
      if (expirationTime > era.from) firstEraCouldFit = true
      continue
    }
    const claimedAt = expirationTime - era.seconds
    if (claimedAt >= era.from && claimedAt < until) fits.push({ term: era.seconds, era })
  }
  const terms = [...new Set(fits.map((f) => f.term))]
  if (terms.length > 1) return { kind: 'ambiguous', terms }
  if (fits.length > 0) return { kind: 'settled', term: fits[0]!.term, era: fits[0]!.era }
  return firstEraCouldFit ? { kind: 'era-unknown' } : { kind: 'no-era' }
}

/** The instance an imported term was computed on, and the registration date it published. */
export interface ImportedTermOrigin {
  instance: 'poh-v1-mainnet' | 'poh-v2-mainnet'
  /** The origin's own registration instant, reproduced from its own state. */
  issuedAt: number
  /** The term the origin applied, in seconds — the number this contract's differs from. */
  term: number
}

/**
 * Ask both mainnet instances which of them wrote this expiry, and take the registration date from
 * whichever reproduces it exactly.
 *
 * Exactness is the whole check. `submissionTime + submissionDuration` and `expirationTime` are
 * second-resolution values written by unrelated transactions; requiring equality means a match is
 * a proof of provenance rather than a resemblance. Neither matching is a real outcome — the origin
 * record can move after the transfer, when a v1 submission is reapplied or a mainnet humanity is
 * claimed by somebody else — and it returns `undefined`, which costs the date and invents nothing.
 *
 * The two branches fail differently, and only one of them needs `mainnet`.
 *
 * - **v1** publishes `submissionTime` directly, and the term is used only to *check* the match.
 *   `submissionDuration` there is governance-settable, has already moved once, and `changeDurations`
 *   emits nothing — but because the check is an equality rather than a subtraction, a change costs
 *   the match and therefore the date. Degradation, never a wrong answer.
 * - **v2 mainnet** publishes only an expiry, so the date *is* a subtraction and carries the same
 *   premise as the local one. `mainnetTerms` supplies that instance's own `DurationsChanged`
 *   timeline so the premise is checked there too; without it the branch subtracts head's term as
 *   before, which is what a caller with no network budget gets and is why it is optional.
 */
export async function resolveImportedTerm(
  c: PublicClient,
  humanityId: string,
  expirationTime: number,
  mainnetTerms?: { history?: TermHistory; now: number },
): Promise<ImportedTermOrigin | undefined> {
  const account = (`0x${humanityId.slice(2)}`) as `0x${string}`
  const [v1, v1Term, v2, v2Term] = await c.multicall({
    allowFailure: true,
    contracts: [
      { address: POH_V1_REGISTRY, abi: POH_V1_TERM_ABI, functionName: 'getSubmissionInfo', args: [account] },
      { address: POH_V1_REGISTRY, abi: POH_V1_TERM_ABI, functionName: 'submissionDuration' },
      { address: POH_V2_MAINNET, abi: POH_V2_TERM_ABI, functionName: 'getHumanityInfo', args: [humanityId as `0x${string}`] },
      { address: POH_V2_MAINNET, abi: POH_V2_TERM_ABI, functionName: 'humanityLifespan' },
    ],
  })

  if (v1.status === 'success' && v1Term.status === 'success') {
    const submissionTime = Number(v1.result[1])
    const term = Number(v1Term.result)
    if (submissionTime > 0 && term > 0 && submissionTime + term === expirationTime) {
      return { instance: 'poh-v1-mainnet', issuedAt: submissionTime, term }
    }
  }
  if (v2.status === 'success' && v2Term.status === 'success') {
    const originExpiry = Number(v2.result[3])
    const headTerm = Number(v2Term.result)
    if (originExpiry > 0 && headTerm > 0 && originExpiry === expirationTime && originExpiry > headTerm) {
      // Same expiry, so this instance wrote it — but which of its terms wrote it is the question
      // the timeline answers. With no timeline supplied the answer is head's term, unchecked.
      if (!mainnetTerms) return { instance: 'poh-v2-mainnet', issuedAt: originExpiry - headTerm, term: headTerm }
      const solved = termForLocalExpiry(
        mainnetTerms.history ?? assumedTermHistory(headTerm, POH_V2_MAINNET_DEPLOYED_AT),
        originExpiry,
        mainnetTerms.now,
      )
      if (solved.kind === 'settled') {
        return { instance: 'poh-v2-mainnet', issuedAt: originExpiry - solved.term, term: solved.term }
      }
      // The origin cannot say when it wrote this expiry, so it cannot date the credential. The
      // grant block still can, and `dateHumanityFromTerm` falls back to it.
    }
  }
  return undefined
}

/** A mainnet client for the origin lookup, sharing PoH v1's measured endpoint list. */
export function originClient(rpcUrls: readonly string[] = POH_V1_RPCS): PublicClient {
  return createPublicClient({
    chain: mainnet,
    transport: fallback(rpcUrls.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
  }) as PublicClient
}
