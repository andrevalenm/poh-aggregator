/**
 * Holonym / Human ID, against the real Hub V3 on OP Mainnet.
 *
 * Two things are worth testing here, and neither is "does this address have an SBT".
 *
 * **The date.** The Hub stores no issuance timestamp, and the expiry it does store is a value
 * the *holder* chose in order to blur when they were verified. The probe turns that into a date
 * by leaning on a ZK constraint — `V3.circom` requires `expiry - iat < 31,536,001` — so the
 * claim under test is not a number but an inequality about the world: for every SBT the Hub
 * accepted, the expiry cannot be more than one year past the credential's issuance, and the
 * issuance cannot be later than the block the SBT was minted in. This suite finds that block by
 * searching historical state, confirms it against the ERC-721 `Transfer` the mint emitted — a
 * different subsystem of the node from the one the search used — and then holds the probe's date
 * to it.
 *
 * **The issuer.** `Hub.sol` says in its own comments that a proof under the right circuit id
 * proves nothing unless the public values are checked, because anyone can run an issuer key. So
 * the pinned issuer constants are re-read off live credentials: an upstream key rotation has to
 * redden this suite rather than silently start counting somebody's self-issued SBT.
 *
 * No holder is hard-coded. Subjects come out of the Hub's own ERC-721 token ids at run time, so
 * the suite follows the registry rather than a snapshot of it.
 *
 * Run: node --test --experimental-strip-types src/adapters/holonym.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createPublicClient,
  fallback,
  http,
  numberToHex,
  parseAbi,
  toEventSelector,
  type Log,
} from 'viem'
import { optimism } from 'viem/chains'
import {
  holonymAdapters,
  holonymIdentifier,
  HOLONYM_CREDENTIALS,
  HOLONYM_HUB_V3,
  HOLONYM_MAX_CREDENTIAL_TERM_SECONDS,
  HOLONYM_RPC,
  HOLONYM_SYBIL_RESISTANCE_V2,
  HUB_ABI,
  type HolonymCredential,
} from './holonym.ts'
// The same three keyless OP Mainnet endpoints the Farcaster adapter measured: the only ones
// that serve archive `eth_call` without a key. The probe needs none of them — this suite does,
// because confirming a date against history is exactly what the probe avoids having to do.
import { FARCASTER_ARCHIVE_RPCS as OP_ARCHIVE_RPCS } from './farcaster.ts'
import { freshnessOf } from '../scoring.ts'
import type { Address, Adapter } from '../types.ts'

/** Nobody holds the key to this address, so nobody has ever verified with it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

const ERC721_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
])
const V2_ABI = parseAbi(['function isUniqueForAction(address,uint256) view returns (bool)'])
const TRANSFER_TOPIC = toEventSelector('Transfer(address,address,uint256)')

const head = createPublicClient({ chain: optimism, transport: http(HOLONYM_RPC, { timeout: 20_000 }) })
const archive = createPublicClient({
  chain: optimism,
  transport: fallback(
    OP_ARCHIVE_RPCS.map((url) => http(url, { timeout: 20_000, retryCount: 0 })),
    { retryCount: 3, retryDelay: 800 },
  ),
})

const probes = holonymAdapters()
const probeFor = (adapterId: string) => probes.find((p) => p.adapterId === adapterId)!

const ontologyJson = JSON.parse(
  readFileSync(new URL('../../../../ontology/adapters.json', import.meta.url), 'utf8'),
) as { adapters: (Adapter & { id: string })[] }
const entryFor = (id: string) => ontologyJson.adapters.find((a) => a.id === id)!

/** Public endpoints throttle; an exhausted quota says nothing about the mechanism. */
async function onChain(t: { skip: (m: string) => void }, what: string, body: () => Promise<void>) {
  try {
    await body()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!/rate limit|requests per second|too many requests|429|paid plan|timed out|timeout|fetch failed/i.test(message)) {
      throw e
    }
    t.skip(`${what}: OP Mainnet endpoints exhausted — ${message.split('\n')[0]}`)
  }
}

const sbtRecord = (identifier: `0x${string}`, blockNumber?: bigint) =>
  (blockNumber === undefined ? head : archive).readContract({
    address: HOLONYM_HUB_V3,
    abi: HUB_ABI,
    functionName: 'sbtOwners',
    args: [identifier],
    ...(blockNumber === undefined ? {} : { blockNumber }),
  })

/**
 * The highest minted token id, by bisecting `ownerOf` — which reverts for a token that does not
 * exist yet. The Hub's `_tokenIds` counter is private and it implements no enumeration, so this
 * is the only way to ask the contract how many credentials it has ever issued. It doubles as
 * the sampler: token ids are chronological, so counting down from the top finds current holders.
 */
async function highestTokenId(): Promise<bigint> {
  const exists = async (id: bigint) => {
    try {
      await head.readContract({ address: HOLONYM_HUB_V3, abi: ERC721_ABI, functionName: 'ownerOf', args: [id] })
      return true
    } catch {
      return false
    }
  }
  let lo = 1n
  let hi = 1n
  while (await exists(hi)) {
    lo = hi
    hi *= 2n
  }
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n
    if (await exists(mid)) lo = mid
    else hi = mid
  }
  return lo
}

interface Holder {
  address: Address
  tokenId: bigint
  expiry: number
  identifier: `0x${string}`
}

/**
 * A current holder of one credential, found by walking down from the newest token id.
 *
 * Sampling rather than pinning matters here: these credentials expire within a year of the
 * check behind them, so any address written into this file would eventually stop being a
 * holder and the suite would start failing for a reason that is not a defect.
 */
async function findHolder(credential: HolonymCredential, from: bigint, opts: { expired?: boolean } = {}): Promise<Holder | undefined> {
  const now = Math.floor(Date.now() / 1000)
  for (let tokenId = from; tokenId > from - 40n && tokenId > 0n; tokenId--) {
    let owner: Address
    try {
      owner = (await head.readContract({
        address: HOLONYM_HUB_V3,
        abi: ERC721_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      })) as Address
    } catch {
      continue
    }
    const identifier = holonymIdentifier(owner, credential.circuitId)
    const [expiry, revoked] = await sbtRecord(identifier)
    if (expiry === 0n || revoked) continue
    if (opts.expired ? Number(expiry) < now : Number(expiry) >= now) {
      return { address: owner, tokenId, expiry: Number(expiry), identifier }
    }
  }
  return undefined
}

/**
 * The block an SBT was minted in, from state alone.
 *
 * `sbtOwners[identifier].expiry` is set once per mint and a re-mint can only push it later, so
 * `expiry(block) >= current expiry` is a monotone predicate and the first block satisfying it is
 * the block the current SBT was written in. The search verifies that against the chain before
 * returning — the record must be strictly lower immediately before that block — so a bad bracket
 * can only produce an error, never a plausible date.
 */
async function findMintBlock(identifier: `0x${string}`, expiry: bigint, floor: bigint, head_: bigint) {
  let lo = floor
  let hi = head_
  const expiryAt = async (block: bigint) => (await sbtRecord(identifier, block))[0]
  if ((await expiryAt(lo)) >= expiry) throw new Error(`the search floor already holds this SBT`)
  while (hi - lo > 1n) {
    const mid = lo + (hi - lo) / 2n
    if ((await expiryAt(mid)) >= expiry) hi = mid
    else lo = mid
  }
  const [before, at] = await Promise.all([expiryAt(hi - 1n), expiryAt(hi)])
  if (!(before < expiry && at >= expiry)) {
    throw new Error(`block ${hi} does not hold the mint: expiry went ${before} -> ${at}`)
  }
  const block = await archive.getBlock({ blockNumber: hi })
  return { block: hi, timestamp: Number(block.timestamp) }
}

describe('Holonym Hub V3 (live, OP Mainnet)', () => {
  test('the Hub is the contract the probe assumes, and derives keys the same way it does', async (t) => {
    await onChain(t, 'hub identity', async () => {
      const name = await head.readContract({ address: HOLONYM_HUB_V3, abi: HUB_ABI, functionName: 'name' })
      assert.equal(name, 'Holonym V3')
      // The probe computes `keccak256(abi.encodePacked(user, circuitId))` locally to save a call
      // per credential. If that ever stopped matching the Hub's own `getIdentifier`, every
      // lookup would read an empty slot and quietly report that nobody holds anything.
      for (const credential of Object.values(HOLONYM_CREDENTIALS)) {
        const onChainId = await head.readContract({
          address: HOLONYM_HUB_V3,
          abi: HUB_ABI,
          functionName: 'getIdentifier',
          args: [NO_CREDENTIAL, credential.circuitId],
        })
        assert.equal(holonymIdentifier(NO_CREDENTIAL, credential.circuitId), onChainId)
      }
    })
  })

  test('an address with no credential is absent, not an error', async (t) => {
    await onChain(t, 'absent address', async () => {
      for (const probe of probes) {
        const r = await probe.probe(NO_CREDENTIAL)
        assert.equal(r.error, undefined, `${probe.adapterId} must not error on an ordinary address`)
        assert.equal(r.held, false)
        assert.equal(r.detail?.['sbt'], 'none')
        assert.equal(r.issuedAt, undefined)
      }
    })
  })

  test('a live credential carries Holonym’s own issuer, an action-id and a burned nullifier', async (t) => {
    await onChain(t, 'live credential', async () => {
      const top = await highestTokenId()
      assert.ok(top > 200_000n, `the Hub should have issued a large number of SBTs, got ${top}`)

      let found = 0
      for (const [adapterId, credential] of Object.entries(HOLONYM_CREDENTIALS)) {
        const holder = await findHolder(credential, top)
        if (!holder) continue
        found++
        const r = await probeFor(adapterId).probe(holder.address)
        assert.equal(r.error, undefined)
        assert.equal(r.held, true, `${adapterId} should be held by ${holder.address}`)

        // Read the proof ourselves and hold the pinned issuer to it. This is the assertion that
        // makes presence mean anything: the circuit proves *an* issuer signed the credential.
        const sbt = await head.readContract({
          address: HOLONYM_HUB_V3,
          abi: HUB_ABI,
          functionName: 'getSBT',
          args: [holder.address, credential.circuitId],
        })
        assert.equal(sbt.publicValues.length, 5, 'the V3 circuits publish exactly five values')
        assert.equal(sbt.publicValues[4], credential.issuer, `${adapterId}: issuer key rotated upstream`)
        assert.equal(sbt.publicValues[1], BigInt(holder.address), 'publicValues[1] binds the proof to the holder')
        assert.equal(BigInt(String(r.detail?.['actionId'])), sbt.publicValues[2], 'the reported action-id is the minted one')

        // `setSBT` burns the nullifier it is *handed*, which nothing forces to equal the one the
        // circuit derived. If they differ, the holder's uniqueness slot for this action was
        // never consumed and the credential is not sybil-resistant at all.
        const mapped = await head.readContract({
          address: HOLONYM_HUB_V3,
          abi: HUB_ABI,
          functionName: 'nullifiersToIdentifiers',
          args: [sbt.publicValues[3]!],
        })
        assert.equal(mapped, holder.identifier, `${adapterId}: the proof's nullifier is not the burned one`)
        assert.equal(r.detail?.['uniquenessNullifierRegistered'], true)
      }
      assert.ok(found > 0, 'no current holder of either credential was found in the newest token ids')
    })
  })

  test('the date is the earliest issuance the circuit allows, and the mint block proves it', async (t) => {
    await onChain(t, 'date bound', async () => {
      const top = await highestTokenId()
      const credential = HOLONYM_CREDENTIALS['holonym-gov-id']!
      const holder =
        (await findHolder(credential, top)) ??
        (await findHolder(HOLONYM_CREDENTIALS['holonym-biometrics']!, top))
      assert.ok(holder, 'no current holder found to date')

      const adapterId =
        holonymIdentifier(holder.address, credential.circuitId) === holder.identifier
          ? 'holonym-gov-id'
          : 'holonym-biometrics'
      const r = await probeFor(adapterId).probe(holder.address)
      assert.equal(r.held, true)
      assert.equal(typeof r.issuedAt, 'number')

      // The mint is recent (token ids are chronological and this holder is at the top of them),
      // so a month of blocks brackets it and the search costs ~20 archive calls.
      const headBlock = await archive.getBlockNumber()
      const mint = await findMintBlock(holder.identifier, BigInt(holder.expiry), headBlock - 1_400_000n, headBlock)

      // The claim the probe rests on, observed on chain: an SBT's expiry is never more than one
      // year past the credential behind it, and the credential existed before it was minted. If
      // Holonym ever raised the circuit's ceiling, this fails here rather than quietly making
      // every Holonym credential look fresher than it is.
      assert.ok(
        holder.expiry - mint.timestamp <= HOLONYM_MAX_CREDENTIAL_TERM_SECONDS,
        `expiry is ${holder.expiry - mint.timestamp}s past the mint, above the circuit's ${HOLONYM_MAX_CREDENTIAL_TERM_SECONDS}s ceiling`,
      )
      assert.ok(
        r.issuedAt! <= mint.timestamp,
        `the derived date ${r.issuedAt} is after the block the SBT was minted in (${mint.timestamp})`,
      )
      // There is deliberately no assertion that the bound is *tight*. The holder picks the
      // expiry anywhere up to a year past their verification, and is advised by the circuit's
      // own comments to pick it randomly for anonymity — so how far the bound sits before the
      // mint is the holder's privacy choice, not our error. Observed on live SBTs: one day in
      // some cases, 257 in others. All of that slack costs the subject weight and none of it
      // can gain them any, which is the property that makes the bound safe to use as a date.

      // The log index agreeing with the state search, from a subsystem the search never touched:
      // the mint emitted an ERC-721 Transfer from the zero address to this holder, in this block.
      const logs = (await archive.request({
        method: 'eth_getLogs',
        params: [
          {
            address: HOLONYM_HUB_V3,
            fromBlock: numberToHex(mint.block),
            toBlock: numberToHex(mint.block),
            topics: [
              TRANSFER_TOPIC,
              `0x${'0'.repeat(64)}`,
              `0x${holder.address.slice(2).toLowerCase().padStart(64, '0')}`,
            ],
          } as never,
        ],
      })) as Log[]
      assert.ok(logs.length >= 1, `no mint Transfer to ${holder.address} in block ${mint.block}`)
    })
  })

  test('an expired credential is not held, and says why', async (t) => {
    await onChain(t, 'expired credential', async () => {
      // Old token ids are the cohort whose credentials have lapsed: the Hub's first year of
      // gov-id SBTs all expired during 2025.
      const holder = await findHolder(HOLONYM_CREDENTIALS['holonym-gov-id']!, 5_000n, { expired: true })
      if (!holder) {
        t.skip('no expired gov-id SBT found in the oldest token ids')
        return
      }
      const r = await probeFor('holonym-gov-id').probe(holder.address)
      // An expiry must not surface as a probe error: `getSBT` reverts on expired, revoked and
      // absent alike, and an error would exclude the address from scoring as *unreadable*
      // instead of reporting a credential that lapsed.
      assert.equal(r.error, undefined)
      assert.equal(r.held, false)
      assert.equal(r.detail?.['sbt'], 'expired')
      assert.equal(r.detail?.['expiredAt'], holder.expiry)
      assert.ok(holder.expiry < Math.floor(Date.now() / 1000))
    })
  })

  test('a credential can never decay below the weight its one-year term implies', async (t) => {
    await onChain(t, 'freshness floor', async () => {
      const top = await highestTokenId()
      for (const [adapterId, credential] of Object.entries(HOLONYM_CREDENTIALS)) {
        const holder = await findHolder(credential, top)
        if (!holder) continue
        const r = await probeFor(adapterId).probe(holder.address)
        assert.equal(r.held, true)
        const entry = entryFor(adapterId)
        const now = Math.floor(Date.now() / 1000)
        const freshness = freshnessOf(entry, r.issuedAt, now, r.issuedAfter)
        // The credential hard-expires within a year of the check behind it, so the worst age a
        // held credential can have is exactly one year — which pins the floor of the decay
        // curve at 2^(-365/halfLife). Anything below it would mean the date came from somewhere
        // other than the bound.
        const floor = 2 ** (-365 / entry.decayHalfLifeDays!)
        assert.ok(
          freshness >= floor - 1e-9 && freshness <= 1,
          `${adapterId}: freshness ${freshness} outside [${floor}, 1]`,
        )
        assert.ok(r.provenance?.notes.includes('date-from-expiry-and-max-term'))
      }
    })
  })

  test('the legacy v2 store answers, and answers no — which is why it is not read', async (t) => {
    await onChain(t, 'legacy v2', async () => {
      // Holonym's own API consults this before the Hub, so leaving it out is a decision that has
      // to keep being checked. It exposes a bool and no date at all; a credential we cannot date
      // scores at full weight on a decay curve, which is the direction that pays an adversary.
      // The day this starts returning true for a current holder, it is worth revisiting.
      const top = await highestTokenId()
      const holder = await findHolder(HOLONYM_CREDENTIALS['holonym-gov-id']!, top)
      if (!holder) {
        t.skip('no current gov-id holder found')
        return
      }
      const unique = await head.readContract({
        address: HOLONYM_SYBIL_RESISTANCE_V2,
        abi: V2_ABI,
        functionName: 'isUniqueForAction',
        args: [holder.address, 123_456_789n],
      })
      assert.equal(typeof unique, 'boolean')
      assert.equal(unique, false, 'a V3 holder now also registers in the v2 store — the v2 read is worth adding')
    })
  })
})
