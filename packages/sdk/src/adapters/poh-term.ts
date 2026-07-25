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
 */
import { createPublicClient, fallback, http, parseAbi, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { POH_V1_REGISTRY, POH_V1_RPCS } from './poh-v1.ts'

/** Proof of Humanity v2 on mainnet — the other side of the cross-chain bridge. */
export const POH_V2_MAINNET = '0xbE9834097A4E97689d9B667441acafb456D0480A' as const

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
 */
export async function resolveImportedTerm(
  c: PublicClient,
  humanityId: string,
  expirationTime: number,
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
    const term = Number(v2Term.result)
    if (originExpiry > 0 && term > 0 && originExpiry === expirationTime && originExpiry > term) {
      return { instance: 'poh-v2-mainnet', issuedAt: originExpiry - term, term }
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
