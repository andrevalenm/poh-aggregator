import { createPublicClient, http, type PublicClient } from 'viem'
import { gnosis, worldchain } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import { circlesIndexRead, pohIndexRead } from '../subgraph.ts'
import {
  reconcileIndexAndChain,
  type ChainView,
  type IndexView,
  type Reconciled,
} from '../reconcile.ts'
import { humanPassportAdapter } from './human-passport.ts'
import { farcasterAdapter } from './farcaster.ts'
import { holonymAdapters } from './holonym.ts'
import { lineaPohAdapter } from './linea-poh.ts'
import { pohV1Adapter } from './poh-v1.ts'
import { worldIdOrbAdapter, WORLD_AGENT_BOOK, WORLD_ID_ADDRESS_BOOK, WORLD_RPC } from './world.ts'
import { coinbaseVerificationAdapter, COINBASE_RPC } from './coinbase.ts'

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
 */
export function pohAdapter(rpcUrl: string = RPC.gnosis, subgraphUrl?: string): AdapterProbe {
  const c = client(gnosis, rpcUrl)
  /** Governance-settable but effectively constant; one read per adapter instance. */
  let lifespan: Promise<number> | undefined

  const readChain = async (subject: Address): Promise<ChainView & { detail: Record<string, unknown> }> => {
    const detail: Record<string, unknown> = {}
    let block: number | undefined
    try {
      const [head, held] = await Promise.all([
        c.getBlockNumber(),
        c.readContract({
          address: CONTRACTS.pohV2,
          abi: POH_ABI,
          functionName: 'isHuman',
          args: [subject],
        }),
      ])
      block = Number(head)
      if (!held) return { held: false, block, detail }

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
 */
export function circlesAdapter(
  rpcUrl: string = RPC.gnosis,
  indexerUrl = 'https://rpc.aboutcircles.com/',
  subgraphUrl?: string,
): AdapterProbe {
  const c = client(gnosis, rpcUrl)

  const readChain = async (subject: Address): Promise<ChainView & { error?: string }> => {
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
      return { held, block: Number(head) }
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
        const { error: chainError, ...chainView } = chain
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
        if (index?.entity) {
          return {
            held: true,
            ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
            provenance: r.provenance,
            detail: {
              ...(index.trustedByCount !== undefined ? { trustedBy: index.trustedByCount } : {}),
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
          detail: trustedBy === undefined ? {} : { trustedBy },
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
