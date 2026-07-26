/**
 * Circles v2 — reading `stop()`, and why the Hub's own getter cannot tell you about it.
 *
 * `stop()` is the only state transition a Circles avatar has after registration. It is
 * documented "irreversible", and the source bears that out: `lastMintTime` is written to
 * `INDEFINITE_FUTURE` and nothing ever writes it back down — `_claimIssuance` returns early
 * because `_calculateIssuance` yields 0 for a stopped human, and `_updateMintV1Status` takes
 * `_max(lastMintTime, block.timestamp)` with a comment saying it does so precisely to avoid
 * resetting the sentinel.
 *
 * Two things follow, and they pull in opposite directions.
 *
 * **A stopped avatar is still a human, to the Hub.** `isHuman(a)` is
 * `mintTimes[a].lastMintTime > 0`, and `INDEFINITE_FUTURE` is `type(uint96).max`, which is
 * emphatically `> 0`. So `stop()` ends personal-Circles *minting* and changes nothing about
 * registration. Nothing in the Hub ever sets `lastMintTime` back to 0 and there is no `delete`
 * on `avatars`, so **`isHuman` is monotonic: Circles has no revocation at all.** That is the
 * fact this file exists to make usable, because the index used to report `stopped` as the
 * credential having *ended*, and a probe that reads `isHuman` at head and an index that reports
 * an ending disagree about the same subject — one answer when our RPC is up, another when it is
 * not.
 *
 * **And the Hub cannot tell you whether an avatar stopped.** `mintTimes` is `internal`, so
 * `stopped(address)` is the only intended read, and it is broken:
 *
 * ```solidity
 * function stopped(address _human) external view returns (bool) {
 *     if (!isHuman(_human)) { revert CirclesErrorOneAddressArg(_human, 0x03); }
 *     MintTime storage mintTime = mintTimes[msg.sender];   // <-- msg.sender, not _human
 *     return (mintTime.lastMintTime == INDEFINITE_FUTURE);
 * }
 * ```
 *
 * It validates the address you pass and then answers about the *caller*. An `eth_call` with no
 * `from` runs as `0x0`, whose `lastMintTime` is 0, so `stopped()` returns **false for every
 * address, forever** — including the two that have actually stopped. Measured on Gnosis at
 * head: `stopped(0xeb94…)` is false with no `from` and true with `from: 0xeb94…`, and
 * `stopped(<a live avatar>)` called `from` a stopped one is **true**, which is the argument
 * being ignored outright. The Hub is not behind a proxy (EIP-1967 implementation slot is zero,
 * bytecode verified directly as `Hub`), so this cannot be fixed in place.
 *
 * So the read here goes to storage. `mintTimes` is at **slot 21**, found by scanning slot
 * indices for a known avatar rather than counted off the inheritance chain, and it is
 * self-validating in a way no other storage read in this codebase is: `isHuman` is *itself* a
 * public getter over the exact word being decoded, so `(lastMintTime > 0) === isHuman` is a
 * check the chain answers for us on every call. It held for all 252 avatars sampled on
 * 2026-07-25 — including 4 that are trust-graph entries and were never registered, where both
 * sides are correctly negative. When it fails, this module reports nothing: a moved layout can
 * cost us the stop flag and can never invent one.
 *
 * `research/protocols/circles-stop-and-the-broken-getter.md`.
 */

import { encodeAbiParameters, keccak256, type PublicClient } from 'viem'
import type { Address } from '../types.ts'

/** Circles v2 Hub on Gnosis. Not a proxy; `eth_getCode` is the verified `Hub` itself. */
export const CIRCLES_HUB = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8' as const

/**
 * Gnosis endpoints, in preference order. All keyless, all answered `eth_getStorageAt` at an
 * archive block on 2026-07-25. `rpc.gnosischain.com` rate-limits hard under a burst, which is
 * why the live suite runs behind a `fallback` over the whole list rather than the single URL.
 */
export const CIRCLES_RPCS = [
  'https://rpc.gnosischain.com',
  'https://gnosis-rpc.publicnode.com',
  'https://rpc.gnosis.gateway.fm',
  'https://gnosis.drpc.org',
] as const

/**
 * Storage slot of `mapping(address => MintTime) internal mintTimes`.
 *
 * Derived, not assumed: scanning slots 0..59 for `keccak256(abi.encode(avatar, slot))` against a
 * known-stopped avatar, a live one and an unregistered one gives exactly one slot whose word is
 * `0xffffffffffffffffffffffff…` for the first, a plausible recent timestamp for the second and
 * zero for the third. Every call re-checks it against `isHuman` rather than trusting this
 * number, so a redeploy that moves the layout produces silence, never a wrong answer.
 */
export const CIRCLES_MINT_TIMES_SLOT = 21n

/** `uint96 internal constant INDEFINITE_FUTURE = type(uint96).max`, the stopped sentinel. */
export const CIRCLES_INDEFINITE_FUTURE = (1n << 96n) - 1n

/** `address internal constant CIRCLES_STOPPED_V1 = address(0x1)`. */
export const CIRCLES_STOPPED_V1 = '0x0000000000000000000000000000000000000001' as const

/** One decoded `MintTime { address mintV1Status; uint96 lastMintTime }`. */
export interface CirclesMintTime {
  /** The `uint96`, packed into the high 12 bytes of the word. */
  lastMintTime: bigint
  /** The `address`, packed into the low 20 bytes. `0x…01` once the v1 token was stopped. */
  mintV1Status: Address
  /** `lastMintTime == INDEFINITE_FUTURE`: the avatar called `stop()`, irreversibly. */
  stopped: boolean
  /** `lastMintTime > 0`, which is exactly what `isHuman` returns. The self-check. */
  registered: boolean
}

/**
 * Decode one `mintTimes` word. Pure, so the packing is testable without a chain.
 *
 * Solidity packs a struct's fields from the low end of the word in declaration order, so
 * `mintV1Status` occupies bits 0..159 and `lastMintTime` bits 160..255.
 */
export function decodeCirclesMintTime(word: bigint): CirclesMintTime {
  const lastMintTime = word >> 160n
  const mintV1Status = `0x${(word & ((1n << 160n) - 1n)).toString(16).padStart(40, '0')}` as Address
  return {
    lastMintTime,
    mintV1Status,
    stopped: lastMintTime === CIRCLES_INDEFINITE_FUTURE,
    registered: lastMintTime > 0n,
  }
}

/** Storage key of `mintTimes[subject]`. */
export function circlesMintTimeSlot(subject: Address): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [subject, CIRCLES_MINT_TIMES_SLOT],
    ),
  )
}

/**
 * Whether an avatar has stopped, read from the Hub's storage and checked against the Hub's own
 * `isHuman` for the same address.
 *
 * `isHumanAtHead` is the answer the caller already has from its `held` read — passing it in
 * keeps both halves of the check in one batch, so this cannot validate a decode against an
 * `isHuman` taken at a different block.
 *
 * Returns `undefined` when the two disagree, which is the only symptom a moved storage layout
 * can produce here. Never throws: the caller is a probe, and a probe that throws is a subject
 * scored as not-a-human.
 */
export async function readCirclesStopped(
  c: PublicClient,
  subject: Address,
  isHumanAtHead: boolean,
): Promise<CirclesMintTime | undefined> {
  try {
    const word = await c.getStorageAt({ address: CIRCLES_HUB, slot: circlesMintTimeSlot(subject) })
    if (word === undefined) return undefined
    const decoded = decodeCirclesMintTime(BigInt(word))
    // The slot check. `isHuman` reads the same word through the contract's own getter, so a
    // layout that has moved cannot survive this, and a layout that has not cannot fail it.
    if (decoded.registered !== isHumanAtHead) return undefined
    return decoded
  } catch {
    return undefined
  }
}
