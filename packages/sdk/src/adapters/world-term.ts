/**
 * Which term is this? — deciding which `verificationLength` `WorldIDAddressBook` wrote a given
 * `addressVerifiedUntil` under.
 *
 * Every World ID date this package produces is one subtraction. `verify()` does
 *
 * ```solidity
 * addressVerifiedUntil[account] = block.timestamp + verificationLength;
 * ```
 *
 * so `verifiedUntil - verificationLength` is the exact second the verification was mined —
 * confirmed to the second against 24 block headers in `world-id-onchain-read.md`. The premise is
 * that the term read **at head** is the term the entry was written under, and the contract does
 * not hold it still:
 *
 * ```solidity
 * function setVerificationLength(uint256 _verificationLength) external onlyOwner {
 *     if (_verificationLength == 0) revert InvalidConfiguration();
 *     verificationLength = _verificationLength;              // no stored expiry is touched
 *     emit VerificationLengthUpdated(verificationLength);
 * }
 * ```
 *
 * One owner transaction re-dates **every** entry in the book at once, in the same direction, by
 * the full size of the change — and on `world-id-orb`'s decay curve a term shortened by a month
 * makes every World credential in the registry look a month fresher than it is. The owner is
 * `0xc50b688E…4062` and cannot walk away from that power: `renounceOwnership` is overridden to a
 * `view` no-op, so the field is permanently settable for as long as the contract exists.
 *
 * ## The tripwire this replaces, and why a timeline is the better instrument
 *
 * The adapter already refused a derived date that landed before the contract existed or after the
 * block it read, and the live suite asserted `verificationLength()` still equals the term the
 * constructor announced. Both are real checks and neither can *repair* anything: the day the owner
 * moves the term, the assertion goes red and every World date in the registry becomes unusable at
 * once, with nothing to put in its place but a hard-coded new number.
 *
 * `setVerificationLength` publishes. So the same request that would have been an alarm is instead
 * a **history**, and a history keeps dating credentials correctly straight through the change:
 * each entry is dated with the term that was in force when *it* was written. `termForLocalExpiry`
 * (`../term-history.ts`) does the solving; this module only has to read the events honestly.
 *
 * ## The whole timeline is recoverable, which it is not for Proof of Humanity
 *
 * `poh-term.ts` has the same shape and one permanent hole: PoH v2's `initialize` writes
 * `humanityLifespan` while emitting nothing, so the first era's term can never be recovered from
 * logs and an expiry only that era explains is left undated. `WorldIDAddressBook`'s **constructor
 * emits** `WorldIDAddressBookInitialized(..., verificationLength, maxProofTime)`, so the first era
 * has a published term like every other one. `TermResolution.era-unknown` is therefore unreachable
 * on this timeline — handled anyway, because a contract that stops emitting is a deployment
 * change, not a code change here.
 *
 * ## Swept 2026-07-26, and the answer is zero
 *
 * Full history, block 2,711,105 → 32,843,977, filtered to this contract's five governance events:
 * **two logs in the contract's entire life** — the constructor, and one `WorldIdRouterUpdated` on
 * 2026-01-08. `VerificationLengthUpdated` has **never** been emitted, `GroupIdUpdated` and
 * `MaxProofTimeUpdated` never either. So the timeline is a single era, `termForLocalExpiry`
 * reduces to exactly the deployment-floor guard the probe already applied, and no date at head
 * moves. That is the point: the number stops being an assumption without any score changing.
 *
 * ## Why this sweep is chunked, and the measurement that forces it
 *
 * `worldchain-mainnet.gateway.tenderly.co` is the only keyless endpoint that serves World Chain
 * `eth_getLogs` over a useful range (`agentbook.ts` has the survey: Alchemy's public endpoint caps
 * at 100 blocks, thirdweb at 1,000, and drpc *lies*). Over this contract's 30.1M-block history it
 * lies too, in a quieter way — asked for the whole range in one call it answers **HTTP 200 with a
 * silently incomplete subset, and not the same subset twice**. Measured 2026-07-26, same query
 * repeated: the five-topic filter returned `[24251140]` four times out of four, dropping the
 * constructor log; the two-topic filter returned `[2711105]` on one run and `[]` on the next four.
 * An unfiltered full-range call returned 980 logs, all of them from the last 2,046 blocks.
 *
 * Chunked, it is exact and stable: 16M, 8M, 4M and 2M chunks each return both logs, repeatedly.
 * The default is 8M — four calls, ~1.4 s serial and ~0.5 s issued together — which sits at half
 * the largest size measured good, because the cost of the margin is one extra request and the cost
 * of guessing wrong is a date nobody would question.
 *
 * ## Two guards, because a chunk size is a hope and these are checks
 *
 * A sweep is refused outright unless both hold, and a refused sweep costs a caveat rather than a
 * date:
 *
 * 1. **The constructor's log must be in the result, in the block the contract was deployed in.**
 *    It is emitted unconditionally, so its absence *proves* the answer is incomplete — this is
 *    what catches the measured failure mode, an endpoint that drops the old end of a range.
 * 2. **The newest term in the sweep must equal `verificationLength()` at head.** If it does not,
 *    something we cannot see wrote the field, and the timeline is wrong however real its logs are.
 *    This catches a drop at the *new* end, which guard 1 cannot.
 *
 * What neither catches is a change dropped from the *middle* of a sweep that also contains a later
 * one agreeing with head. That is the same residual hole `poh-term.ts` carries, it needs a
 * truncation that lands strictly between two real changes, and it is written down rather than
 * papered over. The live suite re-sweeps at a second chunk size and demands the identical set,
 * which is the house check for exactly this endpoint's behaviour.
 */
import { createPublicClient, http, type PublicClient } from 'viem'
import { worldchain } from 'viem/chains'
import { AGENT_BOOK_LOG_ENDPOINTS, WORLD_STATE_RPC } from '../agentbook.ts'
import { buildTermEras, type TermHistory } from '../term-history.ts'
import {
  WORLD_ADDRESS_BOOK_DEPLOYED_AT,
  WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK,
  WORLD_ID_ADDRESS_BOOK,
} from './world.ts'

/**
 * `WorldIDAddressBookInitialized(address,uint256,uint256,uint256,uint256)` — the constructor's
 * announcement, and the only reason this timeline has a first era with a known term.
 */
export const WORLD_ADDRESS_BOOK_INITIALIZED_TOPIC =
  '0xd3305ade78eae487b27cd60d48bc3932e1f0a4b5fb91905ffba139377cbf1385' as const

/** `VerificationLengthUpdated(uint256)` — emitted by `setVerificationLength` and nothing else. */
export const VERIFICATION_LENGTH_UPDATED_TOPIC =
  '0x64123bf7c7035196f2d7ebd814dd38723a50985772a9708ab0ec4c287c05ddf1' as const

/**
 * Word index of `verificationLength` in the constructor event's data: the parameters are
 * `(worldIdRouter, groupId, externalNullifierHash, verificationLength, maxProofTime)` and none of
 * them is indexed, so all five are ABI-encoded in order.
 */
const INIT_TERM_WORD = 3

/** See the header: half the largest chunk measured complete, and four calls over the history. */
export const WORLD_TERM_LOG_CHUNK = 8_000_000

/**
 * The endpoint list `scanAgentBook` surveyed — which endpoints serve World Chain `eth_getLogs` at
 * all is a property of the chain, so a discovery about one lands in a single place.
 *
 * The *range* is not inherited, because a range limit is a property of the query and not of the
 * endpoint. AgentBook's scan chunks at 1M blocks because it pulls 1,164 registrations and Tenderly
 * truncates on volume; this sweep's filter matches two logs in 30.1M blocks, and 16M, 8M, 4M and
 * 2M chunks were each measured returning the complete set repeatedly.
 */
export const WORLD_TERM_LOG_ENDPOINTS = AGENT_BOOK_LOG_ENDPOINTS.map((e) => ({
  url: e.url,
  maxRange: WORLD_TERM_LOG_CHUNK,
}))

/**
 * Chunks in flight at once. Four covers the history at the default size, so the sweep is a single
 * round trip; the cap exists so a caller who asks for a much smaller chunk gets a slower sweep
 * rather than thirty simultaneous requests and the rate limit that follows.
 */
const SWEEP_CONCURRENCY = 6

interface RawLog {
  topics: string[]
  data: string
  blockNumber: string
  blockTimestamp?: string
}

async function getLogs(url: string, from: number, to: number): Promise<RawLog[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [
        {
          address: WORLD_ID_ADDRESS_BOOK,
          topics: [[WORLD_ADDRESS_BOOK_INITIALIZED_TOPIC, VERIFICATION_LENGTH_UPDATED_TOPIC]],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  const body = (await res.json()) as { result?: RawLog[]; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message ?? 'eth_getLogs failed')
  if (!body.result) throw new Error('eth_getLogs returned no result')
  return body.result
}

/**
 * Public endpoints rate-limit, and a sweep issued as a burst is exactly the shape that meets one.
 * Same backoff `scanAgentBook` uses: a rate limit is a moment, and losing the whole timeline to
 * one costs every World credential in the process its checked date.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/** The nth 32-byte word of a log's data, as a number. */
const word = (data: string, n: number): number =>
  Number(BigInt(`0x${data.replace(/^0x/, '').slice(n * 64, (n + 1) * 64)}`))

/**
 * One `VerificationLengthUpdated` (or the constructor's term), before it becomes an era.
 *
 * Exported because `termChangesToHistory` is where every judgement lives and it is worth being
 * able to test that judgement without a network.
 */
export interface TermChange {
  /** The term this write put in force, in seconds. */
  seconds: number
  block: number
  /** Header timestamp of that block: the first second the new term applied. */
  at: number
  /** True for the constructor's announcement, which opens the first era rather than closing one. */
  initial: boolean
}

/**
 * Turn a completed sweep into a timeline, or refuse it.
 *
 * Both guards from the header live here, so a caller can prove they fire without an endpoint that
 * misbehaves on demand. `undefined` always means *the sweep did not answer*, never *there were no
 * changes* — the same distinction `IndexView.entity: null` draws, and conflating them would hand
 * every subject a date on the strength of a request that came back wrong.
 */
export function termChangesToHistory(
  changes: readonly TermChange[],
  termAtHead: number,
): TermHistory | undefined {
  if (termAtHead <= 0) return undefined
  const sorted = [...changes].sort((a, b) => a.block - b.block)
  const first = sorted[0]
  // Guard 1. The constructor emits unconditionally and in the deployment block, so a sweep that
  // does not open with it has been truncated at the old end — the measured failure mode.
  if (!first?.initial || first.block !== WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK) return undefined
  if (sorted.slice(1).some((c) => c.initial)) return undefined
  // Guard 2. A sweep whose newest value cannot explain the state at head has not answered,
  // whatever it returned: something other than `setVerificationLength` wrote the field.
  if (sorted[sorted.length - 1]!.seconds !== termAtHead) return undefined

  return {
    eras: buildTermEras({ from: first.at, seconds: first.seconds }, sorted.slice(1)),
    observed: true,
  }
}

export interface ReadVerificationTermsOptions {
  /** Endpoints to try in order. Defaults to `WORLD_TERM_LOG_ENDPOINTS`. */
  endpoints?: readonly { url: string; maxRange: number }[]
  /** Override the block range per call — the live suite uses this to re-sweep at another size. */
  chunkSize?: number
  /** State endpoint, used only when the log endpoint omits `blockTimestamp`. */
  stateRpcUrl?: string
}

/**
 * Read every term `WorldIDAddressBook` has ever been set to, and lay them out as a timeline.
 *
 * The chunks are issued together rather than in sequence. The history is 30.1M blocks and the
 * result set is two logs, so the sweep is latency and not work: four concurrent requests cost one
 * round trip instead of four, which is what makes checking the premise affordable on a probe that
 * a demo waits on.
 *
 * Never throws. A sweep that fails returns `undefined` and the caller falls back to head's term
 * assumed eternal — the pre-existing behaviour — with the date marked `term-origin-unverified`.
 */
export async function readVerificationTermHistory(
  termAtHead: number,
  head: number,
  opts: ReadVerificationTermsOptions = {},
): Promise<TermHistory | undefined> {
  const endpoints = opts.endpoints ?? WORLD_TERM_LOG_ENDPOINTS
  for (const ep of endpoints) {
    const chunk = Math.max(1, Math.min(opts.chunkSize ?? WORLD_TERM_LOG_CHUNK, ep.maxRange))
    try {
      const ranges: [number, number][] = []
      for (let from = WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK; from <= head; from += chunk) {
        ranges.push([from, Math.min(from + chunk - 1, head)])
      }
      const logs: RawLog[] = []
      for (let i = 0; i < ranges.length; i += SWEEP_CONCURRENCY) {
        const batch = ranges.slice(i, i + SWEEP_CONCURRENCY)
        logs.push(
          ...(await Promise.all(batch.map(([f, t]) => withRetry(() => getLogs(ep.url, f, t))))).flat(),
        )
      }

      // `blockTimestamp` on a log is a recent JSON-RPC addition and this endpoint does not send
      // it. One header read per change block — currently zero, because only the constructor's
      // block is ever in the result and its timestamp is the pinned deployment instant.
      let client: PublicClient | undefined
      const changes: TermChange[] = []
      for (const l of logs) {
        const block = Number.parseInt(l.blockNumber, 16)
        const initial = l.topics[0] === WORLD_ADDRESS_BOOK_INITIALIZED_TOPIC
        let at: number
        if (initial && block === WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK) {
          // The constructor's block *is* the deployment, so the pinned constant is the same
          // second — and it is only used once the log has proved which block that is.
          at = WORLD_ADDRESS_BOOK_DEPLOYED_AT
        } else if (l.blockTimestamp) {
          at = Number.parseInt(l.blockTimestamp, 16)
        } else {
          client ??= createPublicClient({
            chain: worldchain,
            transport: http(opts.stateRpcUrl ?? WORLD_STATE_RPC),
          }) as PublicClient
          at = Number((await client.getBlock({ blockNumber: BigInt(block) })).timestamp)
        }
        changes.push({
          seconds: initial ? word(l.data, INIT_TERM_WORD) : word(l.data, 0),
          block,
          at,
          initial,
        })
      }

      const history = termChangesToHistory(changes, termAtHead)
      if (history) return history
    } catch {
      // Try the next endpoint; a rate limit is a moment, not a fact about the registry.
    }
  }
  return undefined
}
