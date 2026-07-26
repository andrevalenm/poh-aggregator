import { numberToHex, type PublicClient } from 'viem'
import { OP_ARCHIVE_RPCS, rotatingArchive } from './op-archive.ts'
import { HOLONYM_CREDENTIALS, HOLONYM_HUB_V3, HUB_ABI, type HolonymCredential } from './holonym.ts'

/**
 * Whether the issuer this package pins is the issuer the protocol is actually using — asked of
 * the chain, once per process, instead of asked of a repository once in July.
 *
 * ## The pin, and why it is load-bearing
 *
 * `Hub.setSBT` runs no proof verification: it `ecrecover`s a signature and stores whatever it was
 * handed (`holonym-signer.ts`). So the circuit id alone says nothing — anyone may run an issuer
 * key, prove a credential they signed themselves, and get it minted under the same circuit id a
 * real government-ID check uses. The contract's own source warns about exactly this: *"make sure
 * you check the public values such as actionId from this. Someone can forge a proof if you don't
 * check the public values, e.g., by using a different issuer or actionId"*. `publicValues[4]` is
 * that check, and `holonym.ts` refuses any SBT whose issuer is not the one it pins.
 *
 * The two pinned values are Poseidon hashes of EdDSA keys, **transcribed from Holonym's
 * repositories**. Nothing on chain declares them. That leaves the pin exposed in both directions,
 * and they are not symmetric:
 *
 * - **Too wide** — we accept a key that is not Holonym's — counts a forgery. Nothing here can
 *   close that; it is a fact about a value we copied from a source we trusted.
 * - **Too narrow** — Holonym rotates or adds an issuer key and we do not — refuses *real* people,
 *   one at a time, silently, for as long as it takes someone to notice. This is the direction the
 *   chain can speak to, because every live credential carries the issuer that signed it.
 *
 * ## The census
 *
 * Take the mints the Hub has published recently — an ERC-721 `Transfer` from the zero address
 * names the holder — and read `getSBT(holder, circuitId)` back at head for each scored circuit.
 * The result is a tally of the issuer keys **live credentials of that class are actually carrying**,
 * read from the same public value the probe pins. If the pinned key is the only one in that tally,
 * the pin is corroborated by the chain for this run. If an unpinned key is in it, real holders are
 * being refused and the score says so out loud.
 *
 * Deliberately at head and deliberately from live credentials, because that is both the cheap read
 * and the right population: one `eth_getLogs` per chunk plus one `multicall`, ~400 ms measured, and
 * the credentials it samples are exactly the ones a subject could be holding today. It is asked for
 * only when a subject holds *or is refused* a Holonym SBT — no credential, no issuer to print
 * — and memoised on success, the same shape as the signing-authority sweep beside it.
 *
 * The census over the Hub's **whole life** — every era from the deployment block to head — needs
 * archive reads and calldata decoding, because `getSBT` reverts once a credential expires and the
 * issuer of an expired SBT survives only in the transaction that minted it. That belongs in the
 * live suite rather than in a probe, and it is there: ten windows, 2024-02-01 to 2026-07-26.
 *
 * ## Measured 2026-07-26, and it is one key per circuit for the registry's whole life
 *
 * Ten windows of 30,000 blocks spread evenly from the Hub's deployment block (115,616,235) to head
 * (154,715,253), every mint transaction in each decoded from its calldata: **every `gov-id` mint in
 * every window carries `0x03fae82f…1993` and every `biometrics` mint carries `0x0d4f849d…d922`** —
 * the two pinned values, unchanged from the contract's first days to its last. A 200,000-block
 * sweep at head (104 mint transactions, the densest sample) agrees exactly.
 *
 * So the pin was right, and it is now a measurement rather than a transcription. As with the two
 * term timelines and the signer sweep before it, nothing at head moves — the point is that an
 * assumption becomes a check.
 *
 * ## The control, which is free
 *
 * A pin that matched everything would be worth nothing, so the census needs to show that
 * `publicValues[4]` discriminates at all. It does, and the proof costs no extra call: the two
 * scored circuits carry **different** issuer keys from each other in every window, and the
 * unscored `phone` circuit carries a third (`0x0040b881…30a4`). The field varies by credential
 * class, so a match is information. `censusDiscriminates` reports it per run.
 *
 * ## What this cannot see
 *
 * A window, not a history. An issuer used only for credentials that have since expired, or used
 * for a handful of mints outside the window, does not appear — so `uncorroborated` never means
 * "the pin is wrong", only "the chain did not confirm it this run", and a sparse class produces it
 * routinely. It is the same rule the rest of this package runs on: an unread source may never be
 * turned into a claim about a person, in either direction.
 *
 * The same rule costs something at the other end. A batch in which *nothing* executed is refused
 * and retried elsewhere, because that is what a rate limit looks like through `allowFailure` — and
 * a window sparse enough that no sampled holder still holds anything is refused along with it, so
 * the census answers `undefined` where it could have answered "nothing to see". Erring towards the
 * unread reading is the direction that cannot manufacture a false confirmation.
 *
 * ## A transport trap, because this is the second module to walk into it
 *
 * viem's `getLogs` **action** takes its filter from `event`/`events`/`args` and destructures
 * nothing else — a caller-supplied `topics` array is silently dropped and the request goes out
 * unfiltered (viem 2.55.8, `actions/public/getLogs.js`). It fails by *answering*: over
 * 154,700,000–154,709,999 the action returns two logs, one of which is not a `Transfer` at all,
 * where the same filter through `client.request` returns one. Every log read in this file goes
 * through `client.request` for that reason, and `mintHoldersFromLogs` re-checks each log's topics
 * client-side anyway, so an endpoint that loosens a filter cannot put a stranger in the census.
 */

/** Blocks back from head the census samples. ~12 mints per 10,000 blocks, measured 2026-07-26. */
export const HOLONYM_ISSUER_CENSUS_BLOCKS = 30_000

/** `mainnet.optimism.io` caps `eth_getLogs` at 10,000 blocks, so the window is read in chunks. */
export const HOLONYM_ISSUER_CENSUS_CHUNK = 10_000

/** Holders per `multicall`. Each entry returns a dynamic array, so the batch is kept modest. */
export const HOLONYM_ISSUER_CENSUS_BATCH = 25

/** `Transfer(address,address,uint256)`. */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const ZERO_TOPIC = `0x${'0'.repeat(64)}` as const

/** A log as `eth_getLogs` returns it, before anything is believed about it. */
export interface RawLog {
  topics?: readonly string[]
  blockNumber?: string
}

/**
 * Holders named by real mint `Transfer`s, deduplicated and in the order first seen.
 *
 * Every condition is re-checked here rather than delegated to the filter: four topics, the
 * `Transfer` signature, and a zero `from`. An endpoint that ignores the topics it was given —
 * or a client that never sent them — otherwise puts an address that received a transfer, or an
 * address out of an unrelated event, into a census of who was *issued* a credential.
 */
export function mintHoldersFromLogs(logs: readonly RawLog[]): `0x${string}`[] {
  const holders: `0x${string}`[] = []
  const seen = new Set<string>()
  for (const log of logs) {
    const topics = log.topics
    if (!topics || topics.length !== 4) continue
    if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (topics[1] !== ZERO_TOPIC) continue
    const to = topics[2]
    if (typeof to !== 'string' || to.length !== 66) continue
    const address = `0x${to.slice(26).toLowerCase()}` as `0x${string}`
    if (address === `0x${'0'.repeat(40)}`) continue
    if (seen.has(address)) continue
    seen.add(address)
    holders.push(address)
  }
  return holders
}

/** One live credential's issuer, as `publicValues[4]` had it. */
export interface IssuerObservation {
  adapterId: string
  issuer: bigint
}

/** How many live credentials of one class were seen carrying one issuer key. */
export interface IssuerCount {
  /** 32-byte hex, zero-padded — these are 254-bit Poseidon hashes, never EVM addresses. */
  issuer: `0x${string}`
  count: number
}

export interface IssuerCensus {
  /** Adapter id → issuers observed, descending by count. Classes with no live sample are absent. */
  byCredential: Record<string, IssuerCount[]>
  /** Block the census read as head. */
  headBlock: number
  /** Oldest block the mint window covered. */
  fromBlock: number
  /** Distinct holders whose live credentials were read. */
  holders: number
  /** Live credentials read, across all classes. */
  credentials: number
  /**
   * True when at least two credential classes were observed and no issuer key appears in more
   * than one of them — the evidence that `publicValues[4]` varies by class, so a match is
   * information rather than a constant everything satisfies. `undefined` when fewer than two
   * classes were seen and the question cannot be asked.
   */
  discriminates?: boolean
}

/** Hex form of an issuer key, which is how it is compared and reported everywhere but arithmetic. */
export const issuerHex = (issuer: bigint): `0x${string}` =>
  `0x${issuer.toString(16).padStart(64, '0')}`

/**
 * Observations into a census. Pure, so every shape the chain can produce is testable without one.
 */
export function tallyIssuers(
  observations: readonly IssuerObservation[],
  meta: { headBlock: number; fromBlock: number; holders: number },
): IssuerCensus {
  const counts = new Map<string, Map<string, number>>()
  for (const { adapterId, issuer } of observations) {
    const forCredential = counts.get(adapterId) ?? new Map<string, number>()
    const key = issuerHex(issuer)
    forCredential.set(key, (forCredential.get(key) ?? 0) + 1)
    counts.set(adapterId, forCredential)
  }

  const byCredential: Record<string, IssuerCount[]> = {}
  for (const [adapterId, forCredential] of counts) {
    byCredential[adapterId] = [...forCredential]
      .map(([issuer, count]) => ({ issuer: issuer as `0x${string}`, count }))
      .sort((a, b) => b.count - a.count || a.issuer.localeCompare(b.issuer))
  }

  const classes = Object.values(byCredential)
  let discriminates: boolean | undefined
  if (classes.length >= 2) {
    const seen = new Set<string>()
    discriminates = true
    for (const issuers of classes) {
      for (const { issuer } of issuers) {
        if (seen.has(issuer)) discriminates = false
        seen.add(issuer)
      }
    }
  }

  return {
    byCredential,
    headBlock: meta.headBlock,
    fromBlock: meta.fromBlock,
    holders: meta.holders,
    credentials: observations.length,
    ...(discriminates !== undefined ? { discriminates } : {}),
  }
}

/**
 * What the census says about one credential class's pin.
 *
 * - `corroborated` — every live credential of this class carried the pinned key. Silent.
 * - `unpinned-issuer-in-use` — the pinned key is in use *and* another key is too, so some real
 *   holders of this class are being refused by the pin.
 * - `pin-not-in-use` — the class was observed and the pinned key was not among its issuers. The
 *   pin has stopped matching what the protocol issues, so every new holder is being refused.
 * - `uncorroborated` — no live credential of this class was in the window, or the census did not
 *   run. Not evidence of anything; the check simply did not happen.
 */
export type IssuerPinStatus =
  | 'corroborated'
  | 'unpinned-issuer-in-use'
  | 'pin-not-in-use'
  | 'uncorroborated'

export interface IssuerPinVerdict {
  status: IssuerPinStatus
  /** Live credentials of this class the census read. */
  observed: number
  /** How many of those carried the pinned key. */
  matchingPin: number
  /** Issuer keys seen on this class that are not the pinned one, descending by count. */
  unpinned: IssuerCount[]
}

/** The verdict as a pure function of the census, which is why it is separable from the reading. */
export function issuerPinVerdict(
  census: IssuerCensus | undefined,
  credential: HolonymCredential,
  adapterId: string,
): IssuerPinVerdict {
  const empty = { observed: 0, matchingPin: 0, unpinned: [] as IssuerCount[] }
  if (!census) return { status: 'uncorroborated', ...empty }
  const issuers = census.byCredential[adapterId]
  if (!issuers || issuers.length === 0) return { status: 'uncorroborated', ...empty }

  const pin = issuerHex(credential.issuer)
  const observed = issuers.reduce((n, i) => n + i.count, 0)
  const matchingPin = issuers.find((i) => i.issuer === pin)?.count ?? 0
  const unpinned = issuers.filter((i) => i.issuer !== pin)
  if (matchingPin === 0) return { status: 'pin-not-in-use', observed, matchingPin, unpinned }
  if (unpinned.length > 0) {
    return { status: 'unpinned-issuer-in-use', observed, matchingPin, unpinned }
  }
  return { status: 'corroborated', observed, matchingPin, unpinned }
}

export interface ReadIssuerCensusOptions {
  /** OP Mainnet endpoints. Head-only reads, so archive capability is not required — just reach. */
  rpcUrls?: readonly string[]
  timeoutMs?: number
  /** Blocks back from head to take mints from. */
  blocks?: number
  /** Head block to census back from. Read from the chain when omitted. */
  headBlock?: number
  /** Credential classes to census. Defaults to the scored ones. */
  credentials?: Record<string, HolonymCredential>
}

/**
 * Read the issuer keys that live Holonym credentials are currently carrying.
 *
 * Never throws. A census that cannot be completed returns `undefined`, and the caller reports the
 * credential with `attestation-issuer-uncorroborated` rather than pretending the pin was confirmed
 * — the same rule as every other failed read in this package.
 */
export async function readIssuerCensus(
  opts: ReadIssuerCensusOptions = {},
): Promise<IssuerCensus | undefined> {
  const rotation = rotatingArchive(
    'holonymIssuerCensus',
    opts.rpcUrls ?? OP_ARCHIVE_RPCS,
    opts.timeoutMs ?? 12_000,
  )
  const credentials = opts.credentials ?? HOLONYM_CREDENTIALS
  const entries = Object.entries(credentials)
  if (entries.length === 0) return undefined

  try {
    const headBlock =
      opts.headBlock ??
      Number(
        await rotation.tryEach('OP head block', (client: PublicClient) => client.getBlockNumber()),
      )
    const span = opts.blocks ?? HOLONYM_ISSUER_CENSUS_BLOCKS
    const fromBlock = Math.max(0, headBlock - span + 1)

    // `client.request` and not `client.getLogs`: the action drops a caller's `topics` — see the
    // header. The filter is asked for here and re-checked in `mintHoldersFromLogs` regardless.
    const logs: RawLog[] = []
    for (let start = fromBlock; start <= headBlock; start += HOLONYM_ISSUER_CENSUS_CHUNK) {
      const end = Math.min(headBlock, start + HOLONYM_ISSUER_CENSUS_CHUNK - 1)
      const chunk = await rotation.tryEach(
        `Hub mints ${start}..${end}`,
        (client: PublicClient) =>
          client.request({
            method: 'eth_getLogs',
            params: [
              {
                address: HOLONYM_HUB_V3,
                fromBlock: numberToHex(start),
                toBlock: numberToHex(end),
                topics: [TRANSFER_TOPIC, ZERO_TOPIC],
              },
            ],
          } as never) as Promise<RawLog[]>,
      )
      logs.push(...chunk)
    }

    const holders = mintHoldersFromLogs(logs)
    if (holders.length === 0) return undefined

    const observations: IssuerObservation[] = []
    for (let i = 0; i < holders.length; i += HOLONYM_ISSUER_CENSUS_BATCH) {
      const batch = holders.slice(i, i + HOLONYM_ISSUER_CENSUS_BATCH)
      const contracts = batch.flatMap((holder) =>
        entries.map(([, credential]) => ({
          address: HOLONYM_HUB_V3,
          abi: HUB_ABI,
          functionName: 'getSBT' as const,
          args: [holder, credential.circuitId] as const,
        })),
      )
      // `allowFailure`, because `getSBT` reverts for expired, revoked and never-minted alike and
      // all three are ordinary: most holders in a mint window hold one circuit and not the others.
      //
      // And a guard, because `allowFailure` also swallows the *transport*. A rate-limited
      // `eth_call` comes back as every entry `status: 'failure'` carrying the same HTTP error, so
      // the promise resolves, the rotation never fails over, and a throttled endpoint reads as a
      // registry where nobody holds anything. A multicall is one `eth_call`, so the batch either
      // executed or it did not: if nothing in it succeeded, the read is refused and another
      // endpoint gets it. Measured against `mainnet.optimism.io`, which throttles at exactly the
      // rate the log chunks above leave behind them.
      const results = (await rotation.tryEach(
        `Hub getSBT batch at ${i}`,
        async (client: PublicClient) => {
          const batchResults = (await client.multicall({
            contracts: contracts as never,
            allowFailure: true,
          })) as readonly { status: string; result?: unknown }[]
          if (!batchResults.some((r) => r.status === 'success')) {
            throw new Error('no call in the batch executed')
          }
          return batchResults
        },
      )) as readonly { status: string; result?: unknown }[]
      results.forEach((result, at) => {
        if (result.status !== 'success') return
        const sbt = result.result as { publicValues?: readonly bigint[] } | undefined
        const publicValues = sbt?.publicValues
        if (!publicValues || publicValues.length < 5) return
        observations.push({ adapterId: entries[at % entries.length]![0], issuer: publicValues[4]! })
      })
    }

    if (observations.length === 0) return undefined
    return tallyIssuers(observations, { headBlock, fromBlock, holders: holders.length })
  } catch {
    return undefined
  }
}
