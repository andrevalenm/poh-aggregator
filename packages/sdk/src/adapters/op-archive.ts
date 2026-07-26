import { createPublicClient, http, type PublicClient } from 'viem'
import { optimism } from 'viem/chains'

/**
 * The keyless OP Mainnet archive endpoints, and the rotation that makes them usable.
 *
 * Two adapters now read OP Mainnet *history* — Farcaster, which bisects `idCounter` to date a
 * registration the registry never timestamped, and Holonym, which bisects a storage slot to find
 * out whether the Hub's signing authority has ever changed. Which endpoints serve archive state
 * without an API key is a property of the chain rather than of either protocol, so the survey and
 * the failover live in one place and a discovery about an endpoint lands once.
 */

/**
 * Measured 2026-07-25 for `farcaster.ts` and re-measured 2026-07-26 for `holonym-signer.ts`: all
 * three serve archive `eth_call`, `eth_getStorageAt` and `eth_getCode` at arbitrary blocks, and
 * agree with each other where they overlap.
 *
 * The ones that are *not* here, and why: `optimism-rpc.publicnode.com`, `1rpc.io/op` and
 * `op-pokt.nodies.app` answer at head and refuse historical state, which is worse than useless —
 * a probe that mistook "this node pruned it" for "the contract said nothing" would misdate people.
 * `optimism.gateway.tenderly.co` has pruned everything before ~130 M. `optimism.api.onfinality.io`
 * does serve archive and rate-limits within a handful of requests. None of the three below are
 * listed anywhere as public archive nodes; they are simply the ones that answered.
 *
 * An endpoint that has pruned a block **errors**. That is the property the whole arrangement rests
 * on: a pruned node can never be mistaken for an empty registry or a zero slot.
 */
export const OP_ARCHIVE_RPCS = [
  'https://mainnet.optimism.io',
  'https://optimism.drpc.org',
  'https://gateway.tenderly.co/public/optimism',
] as const

export interface ArchiveRotation {
  /** One client per endpoint, in the order given. */
  clients: readonly PublicClient[]
  /**
   * Run `fn` against whichever endpoint answers, naming every one that did not.
   *
   * Naming them matters: the caller's only failure mode is "nobody answered", and someone staring
   * at a missing credential needs to see which endpoint let them down rather than a bare timeout.
   */
  tryEach<T>(what: string, fn: (client: PublicClient) => Promise<T>): Promise<T>
}

/**
 * Round-robin across the endpoints, failing over on error, twice, with a pause between passes.
 *
 * The dominant failure here is a *per-second* rate limit — one bisection is a couple of dozen
 * historical calls and `mainnet.optimism.io` says "your IP has exceeded its requests per second
 * capacity" — which clears in well under a second. Giving up on the first sweep would turn a
 * hiccup into a missing credential, and viem's transport-level retry is deliberately off in the
 * clients below because retrying underneath this would multiply the request count against exactly
 * the limit the retry exists to survive.
 */
export function rotatingArchive(
  label: string,
  rpcUrls: readonly string[],
  timeoutMs: number,
): ArchiveRotation {
  const clients: PublicClient[] = rpcUrls.map(
    (url) =>
      createPublicClient({
        chain: optimism,
        transport: http(url, { timeout: timeoutMs, retryCount: 0 }),
      }) as PublicClient,
  )
  if (clients.length === 0) throw new Error(`${label} needs at least one archive RPC endpoint`)
  let next = 0

  async function tryEach<T>(what: string, fn: (client: PublicClient) => Promise<T>): Promise<T> {
    const errors: string[] = []
    for (let pass = 0; pass < 2; pass++) {
      if (pass > 0) await new Promise((r) => setTimeout(r, 500))
      for (let i = 0; i < clients.length; i++) {
        const at = (next + i) % clients.length
        try {
          const result = await fn(clients[at]!)
          next = (at + 1) % clients.length
          return result
        } catch (e) {
          errors.push(`${rpcUrls[at]}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`)
        }
      }
    }
    throw new Error(`${what} unreadable — ${[...new Set(errors)].join('; ')}`)
  }

  return { clients, tryEach }
}
