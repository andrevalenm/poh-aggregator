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
  decodeFunctionData,
  encodePacked,
  fallback,
  hashMessage,
  http,
  keccak256,
  numberToHex,
  parseAbi,
  recoverAddress,
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
import {
  addressInSlot,
  HOLONYM_HUB_DEPLOY_BLOCK,
  HOLONYM_HUB_OWNER_SLOT,
  HOLONYM_HUB_SIGNER,
  HOLONYM_HUB_VERIFIER_SLOT,
  readHubSignerHistory,
} from './holonym-signer.ts'
// The three keyless OP Mainnet endpoints that serve archive state. The credential read needs
// none of them; confirming a date against history, and asking whether the Hub's signing key has
// ever moved, both do.
import { OP_ARCHIVE_RPCS } from './op-archive.ts'
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
const OWNERSHIP_TRANSFERRED_TOPIC = toEventSelector('OwnershipTransferred(address,address)')

/**
 * The two shapes a mint arrives in. `Hub.setSBT` is the contract's own entry point;
 * `HubBatch.setSBTBatch` (`0xef59aC90…ee77`, verified source) is the relayer Holonym mints
 * through today, which calls `setSBT` once per element with these exact arguments.
 */
const SET_SBT_ABI = parseAbi([
  'function setSBT(bytes32 circuitId, uint256 sbtReciever, uint256 expiration, uint256 customFee, uint256 nullifier, uint256[] publicValues, bytes signature)',
])
const HUB_BATCH_ABI = parseAbi([
  'function setSBTBatch(bytes32[] circuitIds, uint256[] sbtRecievers, uint256[] expirations, uint256[] customFees, uint256[] nullifiers, uint256[][] publicValues, bytes[] signatures)',
])

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

/**
 * The authority behind every Holonym credential: one ECDSA key in a slot with no getter.
 *
 * `setSBT` runs no proof verification — it `ecrecover`s a signature over its own arguments and
 * compares the signer to a stored address — so the circuit id, the issuer we pin and the expiry
 * we date from are all fields one off-chain service chose and signed. These tests are about that
 * key: that the slot the sweep reads really is the one the contract compares against, that it has
 * not moved, and that the ceiling the date depends on is still respected by the mints the chain
 * publishes. None of them writes a number down that the run does not re-derive.
 */
describe('Holonym Hub V3 signing authority (live, OP Mainnet)', () => {
  test('the slot the sweep reads is the key that signed the registry’s real mints', async (t) => {
    await onChain(t, 'signer recovery', async () => {
      const inSlot = addressInSlot(
        (await head.getStorageAt({ address: HOLONYM_HUB_V3, slot: HOLONYM_HUB_VERIFIER_SLOT })) ?? '',
      )
      assert.ok(inSlot, 'the verifier slot must hold a bare address')

      const mints = await recentMints()
      if (mints.length < 3) {
        t.skip(`only ${mints.length} mints decoded in the sampled window`)
        return
      }
      for (const mint of mints) {
        // The Hub's own digest, rebuilt from the transaction that produced the mint, then
        // recovered. This is the only thing that makes "slot 8 is the verifier" a fact rather
        // than a slot counted off a source file — and it is re-derived every run.
        const digest = keccak256(
          encodePacked(
            ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256[]', 'uint256'],
            [mint.circuitId, mint.receiver, mint.expiry, mint.fee, mint.nullifier, mint.publicValues, 10n],
          ),
        )
        const signer = await recoverAddress({ hash: hashMessage({ raw: digest }), signature: mint.signature })
        assert.equal(
          signer.toLowerCase(),
          inSlot,
          `mint ${mint.txHash} was signed by ${signer}, which is not what the verifier slot holds`,
        )
      }
      assert.equal(inSlot, HOLONYM_HUB_SIGNER, 'the pinned signer is no longer the one the Hub checks')
    })
  })

  test('every mint the chain publishes still respects the ceiling the date depends on', async (t) => {
    await onChain(t, 'ceiling', async () => {
      const mints = await recentMints()
      if (mints.length < 3) {
        t.skip(`only ${mints.length} mints decoded in the sampled window`)
        return
      }
      // `iat <= mintTimestamp` — a credential exists before it is minted — so `expiry - mint` is
      // a lower bound on `expiry - iat`. One above the ceiling would *prove* the ceiling had been
      // exceeded, without anybody knowing the issuance date the protocol deliberately hides. It
      // is the only falsifier of this premise that the chain offers, and it is checked against
      // real mints rather than measured once into a document.
      for (const mint of mints) {
        const term = Number(mint.expiry) - mint.timestamp
        assert.ok(
          term <= HOLONYM_MAX_CREDENTIAL_TERM_SECONDS,
          `mint ${mint.txHash} carries ${(term / 86_400).toFixed(2)} days of term, above the ${(
            HOLONYM_MAX_CREDENTIAL_TERM_SECONDS / 86_400
          ).toFixed(0)}-day ceiling every Holonym date is derived from`,
        )
      }
    })
  })

  test('the signing key has not changed since the constructor wrote it', async (t) => {
    await onChain(t, 'signer sweep', async () => {
      // The deployment block is where the first era opens, so it is established rather than
      // trusted: no code the block before, code in it, and the slot empty then set.
      const [before, at, slotBefore] = await Promise.all([
        archive.getCode({ address: HOLONYM_HUB_V3, blockNumber: BigInt(HOLONYM_HUB_DEPLOY_BLOCK - 1) }),
        archive.getCode({ address: HOLONYM_HUB_V3, blockNumber: BigInt(HOLONYM_HUB_DEPLOY_BLOCK) }),
        archive.getStorageAt({
          address: HOLONYM_HUB_V3,
          slot: HOLONYM_HUB_VERIFIER_SLOT,
          blockNumber: BigInt(HOLONYM_HUB_DEPLOY_BLOCK - 1),
        }),
      ])
      assert.equal(before ?? '0x', '0x', 'the Hub already had code before its pinned deployment block')
      assert.ok((at ?? '0x').length > 2, 'the Hub has no code in its pinned deployment block')
      assert.equal(addressInSlot(slotBefore ?? ''), '0x0000000000000000000000000000000000000000')

      const headBlock = Number(await head.getBlockNumber())
      const history = await readHubSignerHistory({ headBlock })
      assert.ok(history, 'the signer sweep did not answer')

      // Mechanism, not a number: the eras must open at the deployment, be contiguous and
      // half-open, and the newest one must be the key the contract is checking right now. All of
      // those stay true on the day a rotation lands — only `rotated` changes.
      assert.equal(history.eras[0]!.fromBlock, HOLONYM_HUB_DEPLOY_BLOCK)
      for (let i = 1; i < history.eras.length; i++) {
        assert.equal(history.eras[i - 1]!.untilBlock, history.eras[i]!.fromBlock)
      }
      assert.equal(history.eras[history.eras.length - 1]!.untilBlock, undefined)
      const atHead = addressInSlot(
        (await head.getStorageAt({ address: HOLONYM_HUB_V3, slot: HOLONYM_HUB_VERIFIER_SLOT })) ?? '',
      )
      assert.equal(history.eras[history.eras.length - 1]!.signer, atHead)

      assert.equal(history.rotated, false, `the Hub's signing key has moved: ${JSON.stringify(history.eras)}`)
      assert.equal(history.eras.length, 1)
    })
  })

  test('a second sample count reads the same history, and a wrong layout reads none', async (t) => {
    await onChain(t, 'sweep stability', async () => {
      const headBlock = Number(await head.getBlockNumber())
      const [six, two] = await Promise.all([
        readHubSignerHistory({ headBlock }),
        readHubSignerHistory({ headBlock, samples: 2 }),
      ])
      assert.ok(six && two)
      // Sampling density must not change the answer. Where it would — a key rotated in and back
      // out between two samples — no density catches it, because there is no event to miss.
      assert.deepEqual(six.eras, two.eras)
      assert.ok(six.sampledBlocks.length > two.sampledBlocks.length)
    })
  })

  test('the sweep dates a change to the exact block, on the one slot here that has changed', async (t) => {
    await onChain(t, 'bisection', async () => {
      // The signing key has never moved, so on slot 8 the bisection never runs and would be
      // untested code carrying the whole weight of "when did this happen". `Ownable._owner` in
      // the same contract *did* move — the deployer handed off six seconds after deployment —
      // so it is the specimen. Nothing below is written down: the block, both addresses and the
      // era boundary all come off the chain in this run.
      const headBlock = Number(await head.getBlockNumber())
      const history = await readHubSignerHistory({ headBlock, slot: HOLONYM_HUB_OWNER_SLOT })
      assert.ok(history, 'the owner sweep did not answer')
      assert.equal(history.eras.length, 2, `expected one owner change, got ${JSON.stringify(history.eras)}`)
      const [before, after] = history.eras
      assert.equal(before!.untilBlock, after!.fromBlock)

      // The boundary is a claim about one block, and the chain publishes the same claim as a log.
      const transfers = await archive.getLogs({
        address: HOLONYM_HUB_V3,
        fromBlock: BigInt(after!.fromBlock),
        toBlock: BigInt(after!.fromBlock),
        topics: [OWNERSHIP_TRANSFERRED_TOPIC],
      })
      assert.equal(transfers.length, 1, 'the block the sweep named holds no ownership transfer')
      assert.equal(`0x${transfers[0]!.topics[1]!.slice(26)}`, before!.signer)
      assert.equal(`0x${transfers[0]!.topics[2]!.slice(26)}`, after!.signer)

      // And the block before it is still the old value, which is what makes it a boundary rather
      // than merely a block the new value is present in.
      const justBefore = addressInSlot(
        (await archive.getStorageAt({
          address: HOLONYM_HUB_V3,
          slot: HOLONYM_HUB_OWNER_SLOT,
          blockNumber: BigInt(after!.fromBlock - 1),
        })) ?? '',
      )
      assert.equal(justBefore, before!.signer)
    })
  })

  test('a subject holding a credential is told which key stands behind it', async (t) => {
    await onChain(t, 'probe provenance', async () => {
      const top = await highestTokenId()
      const holder = await findHolder(HOLONYM_CREDENTIALS['holonym-gov-id']!, top)
      if (!holder) {
        t.skip('no current gov-id holder found')
        return
      }
      const r = await probeFor('holonym-gov-id').probe(holder.address)
      assert.equal(r.held, true)
      assert.equal(r.detail?.['hubSigner'], HOLONYM_HUB_SIGNER)
      assert.equal(r.detail?.['hubSignerIsPinned'], true)
      assert.equal(r.detail?.['hubSignerSinceBlock'], HOLONYM_HUB_DEPLOY_BLOCK)
      assert.ok(!r.provenance?.notes.includes('attestation-authority-rotated'))
      assert.ok(!r.provenance?.notes.includes('attestation-authority-unverified'))

      // A subject with no credential has no authority to check, and must not pay for one.
      const absent = await probeFor('holonym-gov-id').probe(NO_CREDENTIAL)
      assert.equal(absent.held, false)
      assert.equal(absent.detail?.['hubSigner'], undefined)
      assert.deepEqual(absent.provenance?.notes, [])
    })
  })
})

interface DecodedMint {
  txHash: string
  block: number
  timestamp: number
  circuitId: `0x${string}`
  receiver: bigint
  expiry: bigint
  fee: bigint
  nullifier: bigint
  publicValues: readonly bigint[]
  signature: `0x${string}`
}

/**
 * Real mints out of the chain's own logs, with the arguments that produced them.
 *
 * `mainnet.optimism.io` caps `eth_getLogs` at 10,000 blocks, so this walks back in chunks until
 * it has enough — nothing here is pinned, so the suite follows the registry rather than a
 * snapshot of it. Mints arrive through `HubBatch.setSBTBatch` today and arrived through
 * `Hub.setSBT` directly before it; both are decoded, and anything else is counted and skipped
 * rather than failed, because a new relayer is not a defect.
 */
let mintCache: DecodedMint[] | undefined
async function recentMints(): Promise<DecodedMint[]> {
  if (mintCache) return mintCache
  const headBlock = await head.getBlockNumber()
  const logs: Log[] = []
  for (let chunk = 0; chunk < 6 && logs.length < 6; chunk++) {
    const to = headBlock - BigInt(chunk * 10_000)
    logs.push(
      ...(await archive.getLogs({
        address: HOLONYM_HUB_V3,
        fromBlock: to - 9_999n,
        toBlock: to,
        topics: [TRANSFER_TOPIC, `0x${'0'.repeat(64)}`],
      })),
    )
  }

  const timestamps = new Map<string, number>()
  const mints: DecodedMint[] = []
  const seen = new Set<string>()
  for (const log of logs) {
    if (!log.transactionHash || seen.has(log.transactionHash)) continue
    seen.add(log.transactionHash)
    const tx = await archive.getTransaction({ hash: log.transactionHash })
    let calls: readonly (readonly [`0x${string}`, bigint, bigint, bigint, bigint, readonly bigint[], `0x${string}`])[]
    try {
      const { args } = decodeFunctionData({ abi: HUB_BATCH_ABI, data: tx.input })
      const [ids, receivers, expiries, fees, nullifiers, publicValues, signatures] = args
      calls = ids.map((id, i) => [
        id,
        receivers[i]!,
        expiries[i]!,
        fees[i]!,
        nullifiers[i]!,
        publicValues[i]!,
        signatures[i]!,
      ])
    } catch {
      try {
        calls = [decodeFunctionData({ abi: SET_SBT_ABI, data: tx.input }).args]
      } catch {
        continue
      }
    }
    const key = log.blockNumber!.toString()
    if (!timestamps.has(key)) {
      timestamps.set(key, Number((await archive.getBlock({ blockNumber: log.blockNumber! })).timestamp))
    }
    for (const [circuitId, receiver, expiry, fee, nullifier, publicValues, signature] of calls) {
      mints.push({
        txHash: log.transactionHash,
        block: Number(log.blockNumber),
        timestamp: timestamps.get(key)!,
        circuitId,
        receiver,
        expiry,
        fee,
        nullifier,
        publicValues,
        signature,
      })
    }
  }
  mintCache = mints
  return mints
}
