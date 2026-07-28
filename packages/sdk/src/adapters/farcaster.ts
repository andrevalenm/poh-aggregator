import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  http,
  numberToHex,
  parseAbi,
  type PublicClient,
} from 'viem'
import { optimism } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import type { ProbeProvenance, ProvenanceNote } from '../reconcile.ts'
import { OP_ARCHIVE_RPCS, rotatingArchive } from './op-archive.ts'

/**
 * Farcaster account, read from the `IdRegistry` on OP Mainnet.
 *
 * ## What this is evidence of, and what it is not
 *
 * A Farcaster id is **account ownership, never personhood**, and the ontology prices it that
 * way: `IdGateway.price()` is ~0.000107 ETH one-off and `StorageRegistry.usdUnitPrice()` is
 * $0.20 per unit per year, so a fid costs an adversary less than a fresh Reddit account. The
 * registry's own growth curve is the argument — it added 2.18 M ids between 2025-07 and
 * 2026-04, peaking near 17,000/day, then collapsed to ~164/day when whatever was paying for
 * them stopped (`research/landscape/social-and-zktls-signals.md` §B.2). Roughly two thirds of
 * the registry was minted inside that window.
 *
 * That is exactly what the `Ramp` curve is for, and it is why the date matters more than the
 * boolean here. At 20 cents and a 730-day half-life, an id has to have survived longer than
 * the subsidy window before it clears the negligible-cost floor at all: a fid minted during
 * the surge contributes nothing, and one that predates it contributes a few cents. The probe's
 * whole job is to get the age right.
 *
 * ## Dating a registry that stores no dates
 *
 * `IdRegistry` keeps `idOf`, `custodyOf` and `idCounter` — and no timestamps. The obvious
 * source for a date is the `Register` event, but no keyless OP endpoint will serve a
 * full-history `eth_getLogs` (`mainnet.optimism.io` answers "Block range is too large"), and
 * putting a log-indexing vendor on the critical path is the thing this directory exists not to
 * do.
 *
 * So we date the fid from state instead. `idCounter()` only ever increments, so for any fid
 * the **first block at which `idCounter() >= fid` is the block that fid was created in** — and
 * archive `eth_call` at a historical block is a permissionless read that two independent
 * keyless endpoints serve. Finding that block is a search over a monotone predicate: an
 * interpolation/bisection hybrid, ~10–14 calls, and every sample is cached so later lookups
 * start from a tighter bracket. No indexer, no API key, no vendor.
 *
 * Two things that search then tells us for free, both of which change the answer:
 *
 * **The import.** `idCounter` is 0 from the registry's deployment (block 111,816,351,
 * 2023-11-06) until block **111,904,738**, where it jumps to **193,791** in a single block:
 * this deployment (`VERSION` "2023.11.15") imported the whole of its predecessor's registry at
 * once. So every fid ≤ 193,791 dates to 2023-11-08 by this method and is in truth older. The
 * discriminator is exact and needs no table — the counter *immediately before* the creating
 * block is zero — and the date is kept because it understates age, which on a ramp is a weight
 * floor and never an inflation. Flagged `date-from-registry-import`.
 *
 * **The transfer.** Fids are transferable (`IdRegistry.transfer`), and low fids are a traded
 * asset — fid 1 is not held by the address that held it at import. Crediting a bought fid with
 * the registry's age would sell ramp weight for the price of an OTC deal, so what we date is
 * not the fid but *this address's custody of it*: `custodyOf(fid)` at the creating block names
 * the original holder, and when that is not the subject we bisect custody to find when the
 * subject acquired it. `issuedAt` is the acquisition; the fid's own registration stays in
 * `detail`. Flagged `credential-transferred-since-issuance`.
 *
 * ## Farcaster Pro is not readable, and that is the finding
 *
 * The one Farcaster signal with a real recurring price is Pro — `TierRegistry.tierInfo(1)` on
 * Base is 0.328767 USDC/day, $120/year — which would be a genuine deterrent at farm scale. It
 * is not scored here because it cannot be read: the TierRegistry stores tier *configuration*
 * and no per-fid subscription state (no fid-keyed getter exists in its bytecode), so a
 * subject's Pro expiry is derivable only from `PurchasedTier` logs, and no keyless Base
 * endpoint serves those over full history. An adapter for it would need a log index we do not
 * have, so it stays out of the ontology rather than entering it as a number we cannot check.
 */

/** OP Mainnet. `VERSION()` == "2023.11.15", asserted in the live test. */
export const FARCASTER_ID_REGISTRY = '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as const

/**
 * First block holding the registry's code, found by bisecting `eth_getCode` and re-asserted
 * by the live test (empty at 111,816,350, non-empty here). It is the search's lower bound,
 * where `idCounter()` is provably 0 and therefore below every fid.
 */
export const FARCASTER_ID_REGISTRY_DEPLOY_BLOCK = 111_816_351n

/**
 * The keyless OP Mainnet archive endpoints, under the name this adapter has always used them by.
 *
 * The list, the survey behind it and the rotation now live in `op-archive.ts`, because a second
 * adapter reads OP history (`holonym-signer.ts`, sweeping a storage slot with no event) and which
 * endpoints serve archive state without a key is a fact about the chain rather than about either
 * protocol. One of the properties recorded there is what this search depends on: an endpoint that
 * answers `0x` means the registry had no code at that block, while one that has pruned the state
 * *errors* — so a pruned node can never be mistaken for an empty registry.
 */
export const FARCASTER_ARCHIVE_RPCS = OP_ARCHIVE_RPCS

/**
 * A measured ladder of `(block, idCounter)`, used only to bracket a search before it starts.
 *
 * Every pair here was read off the chain on 2026-07-25 by `eth_call` at that block, and
 * `farcaster.live.test.ts` re-reads all of them: `idCounter` at a past block is immutable, so
 * a landmark that ever disagrees with the chain is a defect, not drift. They cannot make a date
 * wrong even if one were — the search verifies its own answer against `counter(B-1) < fid <=
 * counter(B)` before returning, so a bad landmark can only cause an error.
 *
 * The two straddling 111,904,738 are the ones that matter. Everything at or below fid 193,791
 * resolves in *zero* calls because those two blocks bracket it exactly, and that cohort is
 * otherwise the most expensive search in the registry: the counter is flat at zero for 88,387
 * blocks and then steps to 193,791, which is the shape interpolation handles worst.
 */
export const FARCASTER_COUNTER_LANDMARKS: readonly (readonly [bigint, bigint])[] = [
  [111_816_351n, 0n], // 2023-11-06, the deployment
  [111_904_737n, 0n], // 2023-11-08, the block before the import
  [111_904_738n, 193_791n], // 2023-11-08, SetIdCounter(0, 193791)
  [114_878_826n, 225_854n], // 2024-01-15
  [117_941_301n, 410_429n], // 2024-03-26
  [121_003_776n, 637_030n], // 2024-06-05
  [124_066_251n, 831_258n], // 2024-08-15
  [127_128_726n, 870_088n], // 2024-10-25
  [130_191_201n, 934_853n], // 2025-01-04
  [133_253_676n, 1_021_470n], // 2025-03-16
  [136_316_151n, 1_089_806n], // 2025-05-26
  [139_378_626n, 1_158_537n], // 2025-08-05
  [142_441_101n, 1_382_846n], // 2025-10-14
  [145_503_576n, 1_897_675n], // 2025-12-24
  [148_566_051n, 2_857_416n], // 2026-03-05
  [151_628_526n, 3_330_441n], // 2026-05-15
  [154_691_002n, 3_343_630n], // 2026-07-25
]

const ID_REGISTRY_ABI = parseAbi([
  'function idCounter() view returns (uint256)',
  'function idOf(address owner) view returns (uint256)',
  'function custodyOf(uint256 fid) view returns (address)',
  'function VERSION() view returns (string)',
])

type IdRegistryFn = 'idCounter' | 'idOf' | 'custodyOf' | 'VERSION'

export interface FarcasterOptions {
  /** Archive-capable OP Mainnet endpoints, tried in rotation. */
  rpcUrls?: readonly string[]
  /** Milliseconds before one endpoint is given up on and the next is tried. */
  timeoutMs?: number
}

/**
 * A reader over the registry's historical state, with a cache of everything it has sampled.
 *
 * The cache is what makes the search cheap in aggregate: `idCounter` at a block is immutable,
 * so every probe narrows the bracket for the next one, and a process that has looked up a few
 * subjects converges in a handful of calls rather than a dozen.
 */
function archiveReader(rpcUrls: readonly string[], timeoutMs: number) {
  // The rotation, the failover and the two-pass retry are `op-archive.ts`'s; the cache below is
  // this search's, because `idCounter` at a block being immutable is a fact about this registry.
  const { tryEach } = rotatingArchive('farcasterAdapter', rpcUrls, timeoutMs)
  /** Block -> idCounter. Immutable per block, so it is safe to keep for the process's life. */
  const counters = new Map<string, bigint>(FARCASTER_COUNTER_LANDMARKS.map(([b, c]) => [b.toString(), c]))

  /**
   * `null` means the registry had no code at that block. Every caller wants that as a fact
   * about the chain — "the registry did not exist yet" — and not as a failure.
   */
  async function call(functionName: IdRegistryFn, args: readonly unknown[], block?: bigint): Promise<unknown | null> {
    const data = encodeFunctionData({ abi: ID_REGISTRY_ABI, functionName, args } as never)
    const at = block === undefined ? 'latest' : numberToHex(block)
    return tryEach(`IdRegistry.${functionName} at ${at}`, async (client) => {
      const result = (await client.request({
        method: 'eth_call',
        params: [{ to: FARCASTER_ID_REGISTRY, data }, at as never],
      })) as `0x${string}`
      if (result === '0x') return null
      return decodeFunctionResult({ abi: ID_REGISTRY_ABI, functionName, data: result } as never)
    })
  }

  async function counterAt(block: bigint): Promise<bigint> {
    const key = block.toString()
    const cached = counters.get(key)
    if (cached !== undefined) return cached
    const value = ((await call('idCounter', [], block)) as bigint | null) ?? 0n
    counters.set(key, value)
    return value
  }

  async function blockTimestamp(block: bigint): Promise<number> {
    return tryEach(`block ${block}`, async (client) =>
      Number((await client.getBlock({ blockNumber: block })).timestamp),
    )
  }

  async function headBlock(): Promise<bigint> {
    return tryEach('OP Mainnet head', (client) => client.getBlockNumber())
  }

  /** Every (block, counter) pair sampled so far, for narrowing a new search. */
  function samples(): [bigint, bigint][] {
    return [...counters].map(([b, c]) => [BigInt(b), c])
  }

  return { call, counterAt, blockTimestamp, headBlock, samples }
}

type Reader = ReturnType<typeof archiveReader>

export interface FidRegistration {
  /** First block at which `idCounter() >= fid`, i.e. the block the fid was created in. */
  block: bigint
  timestamp: number
  /** `idCounter` immediately before that block. Zero means the registry import. */
  counterBefore: bigint
  /** How many ids that block created. 1 for an ordinary registration, 193,791 for the import. */
  idsCreated: bigint
}

/**
 * The block a fid was created in, from `idCounter` alone.
 *
 * `idCounter` is monotone non-decreasing, so `counter(b) >= fid` is a monotone predicate and
 * the first block satisfying it is exactly the fid's creating block. The search alternates an
 * interpolated guess with a plain bisection step: interpolation converges in a few calls on
 * the smooth stretches, and the bisection step keeps the worst case logarithmic across the
 * import cliff, where 193,791 ids appear between one block and the next.
 */
export async function findFidRegistration(
  reader: Reader,
  fid: bigint,
  head: bigint,
): Promise<FidRegistration> {
  let lo = FARCASTER_ID_REGISTRY_DEPLOY_BLOCK
  let counterLo = 0n
  let hi = head
  let counterHi = await reader.counterAt(head)
  if (counterHi < fid) {
    throw new Error(`fid ${fid} exceeds idCounter ${counterHi} at block ${head}`)
  }

  // Tighten the bracket with anything already sampled. Both guards are needed: a sample only
  // moves a bound if it stays strictly inside the current bracket.
  for (const [block, counter] of reader.samples()) {
    if (block <= lo || block >= hi) continue
    if (counter < fid) {
      lo = block
      counterLo = counter
    } else {
      hi = block
      counterHi = counter
    }
  }

  for (let step = 0; hi - lo > 1n; step++) {
    if (step > 200) throw new Error(`fid ${fid} registration search did not converge`)
    let mid: bigint
    if (step % 2 === 0 && counterHi > counterLo) {
      mid = lo + ((fid - counterLo) * (hi - lo)) / (counterHi - counterLo)
    } else {
      mid = lo + (hi - lo) / 2n
    }
    // Keep the probe strictly inside the bracket so the interval always shrinks.
    if (mid <= lo) mid = lo + 1n
    if (mid >= hi) mid = hi - 1n
    const counter = await reader.counterAt(mid)
    if (counter >= fid) {
      hi = mid
      counterHi = counter
    } else {
      lo = mid
      counterLo = counter
    }
  }

  const [counterBefore, counterAt, timestamp] = await Promise.all([
    reader.counterAt(hi - 1n),
    reader.counterAt(hi),
    reader.blockTimestamp(hi),
  ])
  // The search's own answer, checked against the chain rather than trusted. This is what makes
  // the seeded landmarks safe: a wrong bracket cannot produce a plausible date, only an error.
  if (!(counterBefore < fid && fid <= counterAt)) {
    throw new Error(
      `fid ${fid} not created in block ${hi}: idCounter went ${counterBefore} -> ${counterAt} there`,
    )
  }
  return { block: hi, timestamp, counterBefore, idsCreated: counterAt - counterBefore }
}

/**
 * When `subject` acquired custody of `fid`, by bisecting `custodyOf` between the fid's
 * creating block and head.
 *
 * `custodyOf` is not monotone — a fid can be transferred away and back — so a bisection
 * returns *an* acquisition rather than provably the latest one. Landing on an earlier stint
 * would overstate tenure, which is the direction that favours an adversary, so after the
 * bisection we sample a ladder of blocks between the candidate and head; any block where the
 * subject does not hold the fid proves a later acquisition exists and restarts the search
 * above it. That does not prove continuity, and the caveat says so.
 */
export async function findCustodyAcquisition(
  reader: Reader,
  fid: bigint,
  subject: Address,
  from: bigint,
  head: bigint,
): Promise<{ block: bigint; timestamp: number; continuitySamples: number }> {
  const target = subject.toLowerCase()
  const holdsAt = async (block: bigint) =>
    ((await reader.call('custodyOf', [fid], block)) as Address | null)?.toLowerCase() === target

  const LADDER = 6
  const REFINEMENTS = 3
  let floor = from // known: the subject did not hold it here
  let acquired = head
  let continuitySamples = 0

  for (let round = 0; round <= REFINEMENTS; round++) {
    let lo = floor
    let hi = acquired
    // Three probes per round rather than one: custody has no counter to interpolate against,
    // so this is a plain search over ~40 M blocks and quartering it keeps the round trips —
    // not the calls — down, which is what the wall clock is made of.
    while (hi - lo > 1n) {
      const span = hi - lo
      const width = span - 1n < 3n ? Number(span - 1n) : 3
      const probes = Array.from({ length: width }, (_, i) => lo + (span * BigInt(i + 1)) / BigInt(width + 1))
      const held = await Promise.all(probes.map(holdsAt))
      const first = held.indexOf(true)
      if (first === -1) lo = probes[width - 1]!
      else {
        hi = probes[first]!
        if (first > 0) lo = probes[first - 1]!
      }
    }
    acquired = hi

    if (round === REFINEMENTS || head - acquired <= BigInt(LADDER)) break
    const span = head - acquired
    const rungs = Array.from({ length: LADDER }, (_, i) => acquired + (span * BigInt(i + 1)) / BigInt(LADDER + 1))
    const held = await Promise.all(rungs.map(holdsAt))
    continuitySamples += rungs.length
    // Scan from the far end: the last block where the subject did *not* hold the fid is the
    // tightest floor this ladder can establish. The next round must search *above* it — up to
    // the first rung known to be held again, or head — not below the stale candidate: leaving
    // `acquired` under the floor made the restart bracket empty, so the search kept the first
    // stint and overstated tenure, exactly the error the ladder exists to catch. Found by the
    // away-and-back case in `farcaster.test.ts`.
    const broken = held.lastIndexOf(false)
    if (broken === -1) break
    floor = rungs[broken]!
    acquired = rungs[broken + 1] ?? head
  }

  return { block: acquired, timestamp: await reader.blockTimestamp(acquired), continuitySamples }
}

export function farcasterAdapter(opts: FarcasterOptions = {}): AdapterProbe {
  const reader = archiveReader(opts.rpcUrls ?? FARCASTER_ARCHIVE_RPCS, opts.timeoutMs ?? 12_000)

  return {
    adapterId: 'farcaster-account',
    probe: async (subject: Address): Promise<AdapterProbeResult> => {
      try {
        const head = await reader.headBlock()
        const [fid, registrySize] = await Promise.all([
          reader.call('idOf', [subject]) as Promise<bigint | null>,
          reader.counterAt(head),
        ])
        // No code at head would mean the registry itself has gone, which is an outage and not
        // an absence — reporting held:false there would read as "this address has no account".
        if (fid === null) throw new Error(`IdRegistry has no code at block ${head}`)
        if (fid === 0n) {
          return { held: false, detail: { registered: false, registrySize: Number(registrySize) } }
        }

        const registration = await findFidRegistration(reader, fid, head)
        const originalCustody = (await reader.call('custodyOf', [fid], registration.block)) as Address | null
        const transferred = originalCustody?.toLowerCase() !== subject.toLowerCase()

        const notes: ProvenanceNote[] = []
        let heldSince = registration.timestamp
        let acquisition: Awaited<ReturnType<typeof findCustodyAcquisition>> | undefined
        if (transferred) {
          acquisition = await findCustodyAcquisition(reader, fid, subject, registration.block, head)
          heldSince = acquisition.timestamp
          notes.push('credential-transferred-since-issuance')
        }
        // The counter standing at zero before the creating block is the registry import: this
        // fid was carried over from the predecessor deployment along with 193,790 others, so
        // its real registration is earlier and unrecorded here.
        if (registration.counterBefore === 0n) notes.push('date-from-registry-import')

        const provenance: ProbeProvenance = {
          heldFrom: 'chain',
          dateFrom: 'chain',
          headBlock: Number(head),
          notes,
        }

        return {
          held: true,
          issuedAt: heldSince,
          provenance,
          detail: {
            fid: fid.toString(),
            registrySize: Number(registrySize),
            registeredAt: registration.timestamp,
            registeredAtBlock: Number(registration.block),
            idsCreatedInThatBlock: Number(registration.idsCreated),
            importedFromPredecessorRegistry: registration.counterBefore === 0n,
            custodySince: heldSince,
            transferred,
            ...(transferred
              ? {
                  originalCustody,
                  custodySinceBlock: Number(acquisition!.block),
                  custodyContinuitySamples: acquisition!.continuitySamples,
                }
              : {}),
          },
        }
      } catch (e) {
        return { held: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}
