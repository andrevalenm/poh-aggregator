import { createPublicClient, encodeAbiParameters, http, keccak256, pad, type PublicClient } from 'viem'
import { gnosis, worldchain } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import { circlesIndexRead, pohIndexRead } from '../subgraph.ts'
import {
  reconcileIndexAndChain,
  type ChainView,
  type IndexView,
  type Reconciled,
} from '../reconcile.ts'
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
 * - **`nbRequests == 0`.** The humanity was written by `grantHumanityDirectly`, the cross-chain
 *   path, which copies the expiry from the instance it came from rather than deriving it here.
 *   `expirationTime - humanityLifespan` is then arithmetic about a claim that happened
 *   somewhere else, and the measurement says so out loud: across the 21 lapsed humanities the
 *   derived start equals the index's observed `claimedAt` **to the second in all 19 with a
 *   locally resolved request, and misses by −215.5 and +144.7 days in exactly the two with
 *   none**. The +144.7 is the direction that would hand a subject a window they never had, so
 *   these get `heldUntil` and no start, and `asOf` lists them rather than restoring them.
 *
 * `nbRequests >= 1` proves this contract resolved a request for the humanity; it does not prove
 * the *last* write to `expirationTime` was that resolution, because a humanity transferred out
 * and back would be granted directly over an existing request history. The residual is bounded
 * by both instances running the same `humanityLifespan` (31,557,600 s on Gnosis and on mainnet,
 * read 2026-07-25), which makes the derivation identical either way — and if those two ever
 * diverge, this is the assumption that breaks.
 */
export function closeLapsedHumanityWindow(r: LapsedHumanityRead): {
  heldUntil?: number
  issuedAt?: number
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

  if (r.nbRequests === 0) {
    detail.grantedWithoutLocalRequest = true
    return { heldUntil: r.expirationTime, detail }
  }
  if (r.lifespan <= 0 || r.expirationTime <= r.lifespan) return { heldUntil: r.expirationTime, detail }

  const claimedAt = r.expirationTime - r.lifespan
  // A start before this contract existed, or after the block we read, means `humanityLifespan`
  // is not the term this expiry was written under — a governance change, or a record we have
  // misread. Better a window we decline to close than one we invent.
  if (claimedAt < POH_V2_DEPLOYED_AT || claimedAt > r.now) {
    detail.dateRejected = claimedAt
    return { heldUntil: r.expirationTime, detail }
  }
  detail.claimedAt = claimedAt
  return { heldUntil: r.expirationTime, issuedAt: claimedAt, detail }
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
  ): Promise<{ heldUntil?: number; issuedAt?: number; detail: Record<string, unknown> }> => {
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
        const closed = closeLapsedHumanityWindow({
          subject,
          humanityId,
          owner: info[4] as Address,
          expirationTime: Number(info[3]),
          nbRequests: Number(info[5]),
          lifespan: term,
          now,
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

  const readChain = async (subject: Address): Promise<ChainView & { detail: Record<string, unknown> }> => {
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
        // Guard against a nonsense subtraction if either value is ever zero or the lifespan
        // is reconfigured to something larger than the expiry: better no date than a
        // fabricated one.
        if (expirationTime > term && term > 0) {
          detail.claimedAt = expirationTime - term
          return { held: true, issuedAt: expirationTime - term, block, detail }
        }
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
        const { detail, ...chainView } = chain
        const r = await reconcileWithIndex({
          c,
          chain: chainView,
          ...(index ? { index } : {}),
          indexConfigured: Boolean(subgraphUrl),
        })
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
