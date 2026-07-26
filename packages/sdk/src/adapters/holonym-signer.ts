import type { PublicClient } from 'viem'
import type { Address } from '../types.ts'
import { OP_ARCHIVE_RPCS, rotatingArchive } from './op-archive.ts'
import { HOLONYM_HUB_V3 } from './holonym.ts'

/**
 * Who is allowed to say a Holonym credential exists — and the finding that the answer is one
 * ECDSA key, in a slot with no getter, changeable without an event.
 *
 * ## The Hub verifies a signature, not a proof
 *
 * Every claim this package makes about a Holonym credential — that it is held, who issued it,
 * when it was issued — comes out of `Hub.setSBT`, and the whole of what that function checks is
 * this (`contracts/Hub.sol`, verified source, OP Mainnet):
 *
 * ```solidity
 * bool success = keccak256(
 *     abi.encodePacked(circuitId, sbtReciever, expiration, customFee, nullifier, publicValues, block.chainid)
 * ).toEthSignedMessageHash().recover(signature) == verifier;
 * require(success, "The Verifier did not sign the provided arguments in the provided order");
 * ```
 *
 * There is no verifier *contract*, no pairing check, no circuit id anyone on chain has bound to a
 * proving key. `circuitId` is an opaque `bytes32` the signer chooses, `publicValues` is an array
 * the signer chooses, and the chain's entire contribution is `ecrecover`. The contract's own
 * header says so — *"This contract accepts a signed attestation from a certain Verifier that a
 * ZKP has been recieved"* — and this file exists because the adapter's documentation, and the
 * caveat the SDK prints, said something stronger: that the date rests on a ZK constraint the Hub
 * verified. It rests on an off-chain service having checked that constraint before signing.
 *
 * That is not a reason to stop counting the credential. The same signature is the *only* thing
 * standing behind held-or-not and behind `publicValues[4]`, the issuer we pin — so the date is no
 * more load-bearing on trust than the credential it dates, and the ceiling remains the most
 * conservative reading available (`holonym.ts` §"Dating a credential whose date is deliberately
 * fuzzed"). It is a reason to say what is actually being trusted, and to check the part of it the
 * chain will answer.
 *
 * ## What the chain will answer: whether the key has ever changed
 *
 * ```solidity
 * address verifier;                                    // no visibility keyword: internal
 * function changeVerifier(address newVerifier) public onlyOwner() { verifier = newVerifier; }
 * ```
 *
 * No getter, no event, no timelock. `verifier()` and `getVerifier()` both revert (checked live).
 * So a rotation of the one key the protocol's whole read surface depends on leaves **no trace in
 * any log**, and an indexer cannot see it at all. It is visible in exactly one place: storage.
 *
 * A rotation matters to a *stored* SBT because the Hub never re-checks anything. A credential
 * signed by a key that was later rotated out — because it leaked, say — reads as valid forever,
 * and our issuer pin cannot tell the difference: `publicValues[4]` is data the signer supplied.
 * So "has this contract ever had a different signer?" is a real question about every Holonym
 * credential in a score, and it is answerable without a vendor.
 *
 * ## The slot, established rather than assumed
 *
 * `Hub is Ownable, ERC721URIStorage`, and in that linearisation the slots are `_owner` (0),
 * `_name` (1), `_symbol` (2), `_owners` (3), `_balances` (4), `_tokenApprovals` (5),
 * `_operatorApprovals` (6), `_tokenURIs` (7), then the Hub's own `verifier` (8) and `_tokenIds`
 * (9). Counting slots off a source file is exactly the sort of derivation that is right until it
 * is not, so the sweep proves its own reading before it uses it, every run:
 *
 * 1. slot 0 must equal `owner()` — the same word, read two ways;
 * 2. slot 1 must be the short-string encoding of `name()`, i.e. `"Holonym V3"`;
 * 3. the slot must hold a bare address — twelve zero bytes above twenty non-zero ones.
 *
 * Read 2026-07-26: slot 0 `0xbe20d0a2…3d42` = `owner()`, slot 1 `"Holonym V3"`, slot 8
 * `0x656D1dfb96dBd7620DE0e73FB16d2B169bb8Da01`, slot 9 `0x3a479` = 238,713, which is the token
 * counter the live suite finds independently by bisecting `ownerOf`. Four agreements, one layout.
 *
 * And the slot is the signer, proven the way that leaves nothing to a comment: the live suite
 * takes real mints out of the chain's own logs, re-derives each one's digest from the transaction
 * that produced it and recovers the signing address, and requires it to equal what is in slot 8.
 * 76 mints over 150,000 blocks on 2026-07-26, every one signed by `0x656D1dfb…Da01`.
 *
 * ## Swept 2026-07-26: one signer, from the constructor to head
 *
 * Slot 8 is `0x0` at block 115,616,234, the Hub's code appears at 115,616,235, and the slot holds
 * `0x656D1dfb…Da01` in that same block and at every block sampled since. So `changeVerifier` has
 * never moved the key across the samples, and nothing at head changes because of this file — the
 * point, as with the two term timelines before it, is that an assumption becomes a check without
 * a score moving.
 *
 * ## The hole this sweep has, which the log sweeps do not
 *
 * `poh-term.ts` and `world-term.ts` read *events*, so within a range they see every change. There
 * is no event here, so a sweep can only compare the value at the blocks it reads. Sampling proves
 * the endpoints of each interval; a key rotated in and back out **between two samples** leaves the
 * same trace as no rotation at all, which is none. Bisection narrows any interval whose ends
 * disagree to the exact block, so a change that *stuck* is dated exactly — and a change that was
 * reverted is invisible however many samples are taken, because that is what "no event" means.
 * Closing it needs either a trace-capable endpoint (a vendor) or an index of transactions to the
 * Hub. It is written down rather than papered over, and the caveat says only what was checked.
 */

/** First block holding the Hub's code — `eth_getCode` is `0x` at 115,616,234, and this is asserted rather than trusted. */
export const HOLONYM_HUB_DEPLOY_BLOCK = 115_616_235

/** `verifier`, the ninth slot: see the header for the layout and the three checks that prove it. */
export const HOLONYM_HUB_VERIFIER_SLOT = '0x8' as const

/** `Ownable._owner`, read to confirm the layout against `owner()`. */
export const HOLONYM_HUB_OWNER_SLOT = '0x0' as const

/** `ERC721._name`, read to confirm the layout against `name()`. */
export const HOLONYM_HUB_NAME_SLOT = '0x1' as const

/**
 * The key the Hub has been signing with since its constructor, lower-cased for comparison.
 *
 * Copied from storage on 2026-07-26 and independently recovered from the signatures on 76 real
 * mints; it is a pin to compare against, never a value anything is derived from.
 */
export const HOLONYM_HUB_SIGNER = '0x656d1dfb96dbd7620de0e73fb16d2b169bb8da01' as Address

/** Interior sample points, on top of the deployment block and head. Eight reads in total. */
export const HOLONYM_SIGNER_SAMPLES = 6

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

/** One stretch of blocks over which the Hub's signing key did not change, as far as was read. */
export interface SignerEra {
  signer: Address
  /** First block known to hold this signer. Half-open with `untilBlock`, as the term eras are. */
  fromBlock: number
  /** First block known to hold the *next* signer, absent for the era that reaches head. */
  untilBlock?: number
}

export interface SignerHistory {
  /** Ascending, contiguous, half-open. One entry means no change was found. */
  eras: SignerEra[]
  /** Block the sweep read as head, and the newest block any era is known to cover. */
  headBlock: number
  /** Every block actually read, ascending — the sweep's own account of what it saw. */
  sampledBlocks: number[]
  /** True when the sweep found more than one era, or one era that is not the pinned key. */
  rotated: boolean
}

/**
 * The twenty low bytes of a storage word as an address — and `undefined` unless the twelve above
 * them are zero.
 *
 * A slot holding a lone `address` has those bytes zero by construction. A slot holding something
 * else — a packed struct, the wrong slot entirely — generally does not, so this is the cheapest
 * available check that the layout being read is the layout being assumed.
 */
export function addressInSlot(word: string): Address | undefined {
  const hex = word.replace(/^0x/, '')
  // A full word or nothing: a node that answered short, or did not answer, is a failed read and
  // must not be rounded down into "the slot held the zero address".
  if (hex.length !== 64) return undefined
  if (!/^[0-9a-fA-F]+$/.test(hex)) return undefined
  if (hex.slice(0, 24) !== '0'.repeat(24)) return undefined
  return `0x${hex.slice(24).toLowerCase()}` as Address
}

/**
 * A Solidity short string out of its storage word: the bytes are stored high, and the low byte is
 * twice the length. `undefined` for the long-string encoding (low bit set), which cannot be read
 * from a single slot and is not what `"Holonym V3"` uses.
 */
export function shortStringInSlot(word: string): string | undefined {
  const hex = word.replace(/^0x/, '')
  if (hex.length !== 64) return undefined
  const low = Number.parseInt(hex.slice(62), 16)
  if (Number.isNaN(low) || low % 2 !== 0) return undefined
  const length = low / 2
  if (length === 0 || length > 31) return undefined
  const bytes = hex.slice(0, length * 2)
  if (!/^[0-9a-fA-F]+$/.test(bytes)) return undefined
  return Buffer.from(bytes, 'hex').toString('utf8')
}

/**
 * Where to look, when there is no event to look for.
 *
 * Endpoints always, then `interior` points spread evenly between them. Even spacing rather than
 * anything cleverer because there is no signal to follow: unlike `idCounter`, a signer slot is not
 * monotone and carries no gradient, so every interior block is worth exactly as much as any other.
 */
export function signerSamplePlan(from: number, to: number, interior: number): number[] {
  if (to <= from) return [from]
  const points = new Set<number>([from, to])
  for (let i = 1; i <= interior; i++) {
    points.add(from + Math.round(((to - from) * i) / (interior + 1)))
  }
  return [...points].sort((a, b) => a - b)
}

/**
 * Turn what was read into eras, or refuse to.
 *
 * `undefined` always means *the sweep did not answer*, never *there was no rotation* — the same
 * distinction `IndexView.entity: null` draws, and the reason a failed read here costs a caveat
 * rather than quietly reporting an unchanged key.
 *
 * Refuses when: nothing was read; the oldest sample is not the deployment block (a sweep that does
 * not start where the constructor wrote the slot cannot say what the first era was); the
 * deployment block's slot is empty (either the wrong slot or the wrong deployment block — the
 * constructor sets `verifier` unconditionally, so it is never zero there); or the newest sample is
 * not the head the caller passed.
 */
export function signerErasFromSamples(
  samples: readonly { block: number; signer: Address | undefined }[],
  headBlock: number,
): SignerHistory | undefined {
  const sorted = [...samples].sort((a, b) => a.block - b.block)
  if (sorted.length === 0) return undefined
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (first.block !== HOLONYM_HUB_DEPLOY_BLOCK) return undefined
  if (last.block !== headBlock) return undefined
  if (sorted.some((s) => s.signer === undefined)) return undefined
  if (first.signer === ZERO_ADDRESS) return undefined

  const eras: SignerEra[] = [{ signer: first.signer!, fromBlock: first.block }]
  for (const sample of sorted.slice(1)) {
    const current = eras[eras.length - 1]!
    if (sample.signer === current.signer) continue
    current.untilBlock = sample.block
    eras.push({ signer: sample.signer!, fromBlock: sample.block })
  }

  return {
    eras,
    headBlock,
    sampledBlocks: sorted.map((s) => s.block),
    rotated: eras.length > 1 || eras[0]!.signer !== HOLONYM_HUB_SIGNER,
  }
}

export interface ReadHubSignerOptions {
  /** Archive-capable OP Mainnet endpoints, tried in rotation. */
  rpcUrls?: readonly string[]
  timeoutMs?: number
  /** Interior sample points. The live suite re-sweeps at another count and demands the same eras. */
  samples?: number
  /** Head block to sweep up to. Read from the chain when omitted. */
  headBlock?: number
  /**
   * Which slot to sweep. Defaults to `verifier`, and exists because the code that *dates* a
   * change would otherwise never run: the signing key has never moved, so on the slot that
   * matters the bisection is unexercised. `Ownable._owner` in this same contract did move — six
   * seconds after deployment, when the deployer handed off — so the live suite points this at
   * slot 0 and requires the sweep to land on the exact block, checked against the
   * `OwnershipTransferred` log sitting in it. A path that has never run is not a path.
   */
  slot?: `0x${string}`
}

/**
 * Read the Hub's signing key at the deployment block, at head, and at points in between; narrow
 * any disagreement to the exact block it happened in.
 *
 * Never throws. A sweep that cannot be completed returns `undefined`, and the caller reports the
 * credential with `attestation-authority-unverified` rather than pretending the key is unchanged.
 *
 * Cost when nothing has changed — which is the state of the world today — is `samples + 2` archive
 * reads plus three head reads for the layout check, issued in parallel batches, once per process.
 * Bisection only runs where two adjacent samples disagree, so a rotation is what makes this
 * expensive and an unchanged key is what it usually costs.
 */
export async function readHubSignerHistory(
  opts: ReadHubSignerOptions = {},
): Promise<SignerHistory | undefined> {
  const rotation = rotatingArchive(
    'holonymAdapters',
    opts.rpcUrls ?? OP_ARCHIVE_RPCS,
    opts.timeoutMs ?? 12_000,
  )
  const slot = opts.slot ?? HOLONYM_HUB_VERIFIER_SLOT
  const slotAt = (block: number | 'head'): Promise<Address | undefined> =>
    rotation.tryEach(`Hub slot ${slot} at ${block}`, async (client: PublicClient) => {
      const word = await client.getStorageAt({
        address: HOLONYM_HUB_V3,
        slot,
        ...(block === 'head' ? {} : { blockNumber: BigInt(block) }),
      })
      return addressInSlot(word ?? '')
    })

  try {
    const headBlock =
      opts.headBlock ??
      Number(
        await rotation.tryEach('OP head block', (client: PublicClient) => client.getBlockNumber()),
      )
    if (!(await layoutHolds(rotation))) return undefined

    const plan = signerSamplePlan(HOLONYM_HUB_DEPLOY_BLOCK, headBlock, opts.samples ?? HOLONYM_SIGNER_SAMPLES)
    const samples: { block: number; signer: Address | undefined }[] = []
    // Batched rather than one big `Promise.all`: these endpoints rate-limit per second, and a
    // burst of eight is the shape that meets one. Three at a time is one per endpoint.
    for (let i = 0; i < plan.length; i += 3) {
      const batch = plan.slice(i, i + 3)
      const read = await Promise.all(batch.map((block) => slotAt(block)))
      batch.forEach((block, at) => samples.push({ block, signer: read[at] }))
    }

    // Narrow every disagreement to the block it happened in. Nothing runs here unless the key
    // actually moved, which — see the header — it never has.
    const boundaries: { block: number; signer: Address | undefined }[] = []
    for (let i = 1; i < samples.length; i++) {
      const before = samples[i - 1]!
      const after = samples[i]!
      if (before.signer === after.signer) continue
      let lo = before.block
      let hi = after.block
      while (hi - lo > 1) {
        const mid = lo + Math.floor((hi - lo) / 2)
        const signer = await slotAt(mid)
        if (signer === before.signer) lo = mid
        else hi = mid
      }
      boundaries.push({ block: hi, signer: after.signer })
    }

    return signerErasFromSamples([...samples, ...boundaries], headBlock)
  } catch {
    return undefined
  }
}

/**
 * The three layout checks from the header, at head, in one round trip.
 *
 * A layout that does not hold is not a rotation and must never be reported as one: it means the
 * contract at this address is not the one the slot numbers were counted off, so the sweep is
 * refused outright and the caller says the authority could not be checked.
 */
async function layoutHolds(rotation: ReturnType<typeof rotatingArchive>): Promise<boolean> {
  try {
    const [ownerWord, nameWord, owner, name] = await Promise.all([
      rotation.tryEach('Hub owner slot', (c: PublicClient) =>
        c.getStorageAt({ address: HOLONYM_HUB_V3, slot: HOLONYM_HUB_OWNER_SLOT }),
      ),
      rotation.tryEach('Hub name slot', (c: PublicClient) =>
        c.getStorageAt({ address: HOLONYM_HUB_V3, slot: HOLONYM_HUB_NAME_SLOT }),
      ),
      rotation.tryEach('Hub owner()', (c: PublicClient) =>
        c.readContract({ address: HOLONYM_HUB_V3, abi: LAYOUT_ABI, functionName: 'owner' }),
      ),
      rotation.tryEach('Hub name()', (c: PublicClient) =>
        c.readContract({ address: HOLONYM_HUB_V3, abi: LAYOUT_ABI, functionName: 'name' }),
      ),
    ])
    return layoutAgrees({ ownerWord: ownerWord ?? '', nameWord: nameWord ?? '', owner, name })
  } catch {
    return false
  }
}

const LAYOUT_ABI = [
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const

/** The layout check as a pure function, so a test can prove each way it fails without a chain. */
export function layoutAgrees(read: {
  ownerWord: string
  nameWord: string
  owner: string
  name: string
}): boolean {
  const ownerInSlot = addressInSlot(read.ownerWord)
  if (!ownerInSlot || ownerInSlot !== read.owner.toLowerCase()) return false
  return shortStringInSlot(read.nameWord) === read.name
}
