import { createPublicClient, http, parseAbi, type PublicClient } from 'viem'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import type { ProbeProvenance } from '../reconcile.ts'

/**
 * Human Passport (ex-Gitcoin Passport), read from the on-chain Decoder.
 *
 * Why this one is worth reading at all: it is the largest score in the landscape and it is
 * the only aggregate in it that can be read **without the vendor's cooperation**. Users who
 * paid to mint have their score cached on chain, and `GitcoinResolver.getCachedScore` answers
 * for anyone. No API key, no rate limit, nothing Passport can revoke.
 *
 * ## Why we do not import the number
 *
 * Passport's scalar is an aggregate over its own stamps with its own weights, and those
 * weights are not ours to inherit. `ETHScore#50` — a pure wallet-history model — is weighted
 * the same as a government ID (`research/protocols/passport-civic-fractal-zkme-galxe.md`).
 * Worse, the stamp list contains credentials this ontology already prices under their own
 * roots: Coinbase (Persona), Holonym gov-id, Holonym biometrics, Civic, BrightID, Idena,
 * TrustaLabs. Adding Passport's number to a score that already counts those would double-count
 * the exact correlation the root model exists to collapse.
 *
 * So the passport is rooted at `behavioral:wallet-history` and priced at the farmed-wallet
 * market — a dollar, not KYC money — and the score value is reported as detail and never
 * multiplied into anything. What the probe *does* do with the stamps is disclose them: it maps
 * each one to the ontology adapter that owns it and reports which roots this passport is
 * restating, so a caller can see that a score of 28.8 was three stamps, two of which we
 * already counted somewhere else. That is the "1inch for personhood" claim made legible on
 * one address rather than asserted in a pitch.
 *
 * ## Mechanism, verified against the deployed contracts on 2026-07-25
 *
 * `GitcoinPassportDecoder.getScore(user)` is revert-driven: `AttestationNotFound()` when
 * `cachedScore.time == 0`, `AttestationExpired(uint64)` when the score has aged out. We read
 * the resolver directly instead, because `getCachedScore` returns the same struct the Decoder
 * consults — `{ uint32 score, uint64 time, uint64 expirationTime }` — and it carries the
 * issuance date the Decoder throws away. That date is what feeds our decay curve, so taking
 * the revert path would have cost us the age of the credential for no gain.
 *
 * Expiry is `expirationTime` when set, else `time + maxScoreAge()` — 7,776,000 seconds, 90
 * days, on all seven deployments. That derivation is not folklore: for
 * `0xb0812e00…90F2` on Optimism, `time` 1740958699 + 7776000 = 1748734699, and
 * `getScore` reverts `AttestationExpired(1748734699)`. Same arithmetic, same number, from two
 * independent paths. `human-passport.live.test.ts` re-derives it rather than asserting it.
 *
 * ## Seven chains, because one is wrong
 *
 * A passport is minted per chain and the mints disagree. `0xb0812e00…90F2` holds 50.015 on
 * Optimism and Linea and 25.099 on Scroll — a year older — and nothing on Base, Arbitrum,
 * Shape or zkSync. Reading one chain would have reported the wrong score for two of the three
 * chains it exists on, and no score at all for most addresses. We read all seven and take the
 * most recently issued unexpired one, which is both the freshest evidence and the one the
 * subject most recently paid for.
 *
 * Per the rule at the top of `adapters/index.ts`, a probe never turns a failure into a
 * negative. A chain that does not answer is dropped; only if *every* chain fails to answer do
 * we return an `error`, because "no passport" and "we could not look" are different claims.
 *
 * ## An expired passport is a closed window, not an absence
 *
 * The resolver does not delete anything when a score ages out. `getCachedScore` keeps returning
 * `{score, time, expirationTime}` for a passport that expired a year ago — only the *Decoder*
 * goes quiet, by reverting `AttestationExpired`. That is the same asymmetry PoH v2 has between
 * `getHumanityInfo` and `isHuman`: a getter that declines to answer is not a chain that has lost
 * the answer.
 *
 * So a lapsed passport gives up both ends of its life at head, exactly, with no archive node and
 * no log query: `time` is the issuance second and the derived expiry is the second it stopped
 * counting. That closes a window an `asOf` score can decide membership of — see `as-of.ts`.
 *
 * Iteration 16 refused to do this for Holonym, and the reason is the test this one has to pass:
 * *is the credential still attributable at the instant you restore it?* For Holonym it is not —
 * `getSBT` reverts once the SBT expires, so the issuer check that makes the credential evidence
 * of anything is unreadable for exactly the credentials that would be restored. Here nothing
 * reverts and nothing is lost: the struct is read by the same call on the same resolver, and the
 * EAS attestation behind it survives too, un-revoked, with the subject still named as its
 * recipient (`0xb0812e00…90F2`, whose passport lapsed 2025-06-01, checked 2026-07-25). The
 * live suite asserts that rather than assuming it.
 *
 * Two limits, both stated rather than absorbed:
 *
 * - **One window per chain.** The resolver caches *the* score for an address, so a re-mint
 *   overwrites the previous struct. We can only ever see the most recent life on each chain;
 *   an earlier one that ended before it is gone. Reading seven chains blunts this — a mint on
 *   one chain does not touch another's cache — and `detail.perChain` shows every window we can
 *   see, but a subject who minted twice on one chain has a hole in their history there.
 * - **A zero score never was a credential.** A passport with no stamps is not wallet-history
 *   evidence while it is live (`held` is false for it), so its expiry does not close a window
 *   over anything. Those readings are excluded and counted rather than restored.
 *
 * ## Who is allowed to write a passport into that struct
 *
 * Everything above reads one mapping and trusts it. That trust was an assumption until it was
 * measured, and measuring it is what this section records — the resolver's own source
 * (`passportxyz/eas-proxy`, `GitcoinResolver.sol`, whose every selector matches the deployed
 * Optimism implementation `0x2999Ef5C…79dC`) gates the write twice:
 *
 * ```solidity
 * function attest(Attestation calldata a) external payable whenNotPaused onlyAllowlisted {…}
 * function _attest(Attestation calldata a) internal returns (bool) {
 *   if (a.attester != address(_gitcoinAttester)) revert InvalidAttester();
 * ```
 *
 * Simulated on Optimism at head, one axis at a time, because a gate you have not moved is a gate
 * you have not seen:
 *
 * | caller | `attester` in the struct | result |
 * |---|---|---|
 * | a stranger | Passport's attester | revert `NotAllowlisted()` `0x06fb10a9` |
 * | EAS | a stranger | revert `InvalidAttester()` `0xb8daf542` |
 * | EAS | Passport's attester | `true` — the write lands |
 *
 * So a cached score is Passport's or it is nobody's, and the probe now checks that per subject
 * rather than resting on it: `userAttestations(subject, schema)` gives the uid the resolver filed,
 * and the EAS attestation behind it must be un-revoked, still name this subject as recipient, and
 * carry `attester == _gitcoinAttester()`. **Neither address is hard-coded.** The resolver names
 * its own EAS and its own attester, and both differ per chain (`0x84382998…dB1a` on Optimism,
 * `0xCc90105D…F422` on Base, Scroll and Shape, `0x7848a357…0475` on Arbitrum,
 * `0xBC778313…10A2` on Linea, `0x2B5D97CB…83cC` on zkSync Era, all read 2026-07-25) — a table of
 * seven attester constants would have been seven chances to be wrong about somebody's identity.
 * This is the same shape as `gitcoinResolver()`: ask the contract what it trusts.
 *
 * A mismatch is a *statement*, not a failure, so it returns `held: false` with both keys named.
 * A read that could not be made is a failure and never moves `held`: it keeps the credential and
 * raises `issuer-check-unavailable`. That asymmetry is the rule at the top of `adapters/index.ts`
 * applied to an authority check instead of to a presence check.
 *
 * What this does **not** close: the resolver is UUPS-upgradeable and its owner can add writers to
 * the allowlist, so Passport can still write whatever it likes about anybody. The pin excludes
 * *third parties*, which is the whole of what an issuer pin can ever mean for a hosted credential.
 */

/**
 * Decoder deployments, from the "Smart contracts → Contract reference" page of
 * docs.passport.human.tech (fetched 2026-07-24, tabulated in
 * `research/protocols/passport-civic-fractal-zkme-galxe.md`). Every one of these was confirmed
 * to hold code and to answer `maxScoreAge()` on 2026-07-25.
 *
 * The resolver address is deliberately *not* listed here. We ask each Decoder which resolver
 * it trusts (`gitcoinResolver()`) rather than hard-coding a second address per chain: it is one
 * cached call, it cannot drift out of date, and it means an upgrade on their side cannot leave
 * us reading a resolver the Decoder has stopped believing.
 */
export const PASSPORT_DEPLOYMENTS = {
  // Not `mainnet.optimism.io`, which is one of the few keyless endpoints serving *archive*
  // state and is therefore spent by the Farcaster probe. Passport only ever reads at head, so
  // it takes a head-only endpoint and leaves the scarce archive quota to the reader that
  // needs it. Verified 2026-07-25 to return the same resolver, maxScoreAge and threshold.
  optimism: { decoder: '0x5558D441779Eca04A329BcD6b47830D2C6607769', rpc: 'https://optimism-rpc.publicnode.com' },
  base: { decoder: '0xaa24a127d10C68C8F9Ac06199AA606953cD82eE7', rpc: 'https://base-rpc.publicnode.com' },
  arbitrum: { decoder: '0x2050256A91cbABD7C42465aA0d5325115C1dEB43', rpc: 'https://arbitrum-one-rpc.publicnode.com' },
  linea: { decoder: '0x423cd60ab053F1b63D6F78c8c0c63e20F009d669', rpc: 'https://linea-rpc.publicnode.com' },
  scroll: { decoder: '0x8A5820030188346cC9532a1dD9FD2EF8d8F464de', rpc: 'https://rpc.scroll.io' },
  shape: { decoder: '0x2443D22Db6d25D141A1138D80724e3Eee54FD4C2', rpc: 'https://mainnet.shape.network' },
  zksyncEra: { decoder: '0x1166FCDCA3B04311Ba9E2eD5ad2c660E730e1386', rpc: 'https://mainnet.era.zksync.io' },
} as const satisfies Record<string, { decoder: Address; rpc: string }>

export type PassportChain = keyof typeof PASSPORT_DEPLOYMENTS

const DECODER_ABI = parseAbi([
  'function gitcoinResolver() view returns (address)',
  'function maxScoreAge() view returns (uint64)',
  'function threshold() view returns (uint256)',
  'function getPassport(address user) view returns ((string provider, bytes32 hash, uint64 time, uint64 expirationTime)[])',
])

const RESOLVER_ABI = parseAbi([
  'function getCachedScore(address user) view returns ((uint32 score, uint64 time, uint64 expirationTime))',
  // The three the authority check rests on. Every one of them is the resolver telling us what it
  // enforces, rather than us telling the resolver what we expect it to be.
  'function _gitcoinAttester() view returns (address)',
  'function _eas() view returns (address)',
  'function scoreSchema() view returns (bytes32)',
  'function scoreV2Schema() view returns (bytes32)',
  'function userAttestations(address user, bytes32 schema) view returns (bytes32)',
])

const EAS_ABI = parseAbi([
  'function getAttestation(bytes32 uid) view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))',
])

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const isZeroWord = (h: string): boolean => /^0x0*$/.test(h)
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split('\n')[0]!

/** Passport stores its score as a uint32 with four implied decimals: 288470 is 28.847. */
const SCORE_DECIMALS = 10_000

/**
 * Which ontology adapter owns each Passport stamp.
 *
 * Only the stamps that restate a credential *this ontology already prices* are listed. The
 * rest — social accounts, staking tiers, NFT and gas heuristics — are wallet-history and
 * social-account signals with no separate entry, and they are what the passport legitimately
 * contributes under its own root.
 *
 * Names come from the Decoder's own on-chain provider list (`getProviders(currentVersion())`,
 * 102 entries on Optimism, read 2026-07-25) plus the free-form provider strings that the
 * score-v2 attestation path returns; `human-passport.live.test.ts` asserts that the legacy
 * names here still appear in that on-chain list, so a rename upstream fails loudly instead of
 * silently dropping a correlation.
 *
 * `BinanceBABT` is deliberately absent. It is a real credential and Passport weights it like a
 * government ID, but it has no vendor attribution in our research and therefore no root — and
 * an invented root is worse than an absent one. It surfaces as unattributed in `detail`.
 */
export const STAMP_TO_ADAPTER: Readonly<Record<string, string>> = {
  Coinbase: 'coinbase-verification',
  CoinbaseDualVerification: 'coinbase-verification',
  CoinbaseDualVerification2: 'coinbase-verification',
  HolonymGovIdProvider: 'holonym-gov-id',
  // "Proof of Clean Hands" is a sanctions/PEP screen layered on Holonym's *government ID*
  // pipeline — its own guide says "verify your government ID and complete liveness check".
  // It restates the same document check, so it shares that credential's root rather than
  // earning one of its own.
  CleanHands: 'holonym-gov-id',
  Biometrics: 'holonym-biometrics',
  CivicCaptchaPass: 'civic-pass',
  CivicUniquenessPass: 'civic-pass',
  CivicLivenessPass: 'civic-pass',
  Brightid: 'brightid',
  Poh: 'poh-v1',
  'IdenaState#Newbie': 'idena',
  'IdenaState#Verified': 'idena',
  'IdenaState#Human': 'idena',
  'IdenaStake#1k': 'idena',
  'IdenaStake#10k': 'idena',
  'IdenaStake#100k': 'idena',
  'IdenaAge#5': 'idena',
  'IdenaAge#10': 'idena',
  TrustaLabs: 'trusta-sybil',
}

/**
 * Passport speaks two stamp vocabularies, and only one of them is published on chain.
 *
 * The legacy passport attestation packs stamps as a bitmap indexed into the Decoder's
 * `getProviders(version)` array — 102 names on Optimism as of 2026-07-25 — so every name in it
 * is verifiable against the contract. The newer score-v2 attestation carries provider strings
 * inline instead, and those names never enter the on-chain array: a live passport returning
 * `Biometrics` and `Steam` proves it. These two are the mapped names that live only in the v2
 * vocabulary, listed so the live test can hold every *other* mapped name to the on-chain array
 * without a blanket exemption that would hide a genuine rename.
 *
 * Names verified against the per-platform `Providers-config.ts` files in passportxyz/passport
 * (fetched 2026-07-25): `Biometrics` is id.human.tech's FaceTec 3D liveness with a dedup step,
 * and `CleanHands` is the sanctions screen built on the same gov-id verification.
 */
export const SCORE_V2_ONLY_STAMPS: readonly string[] = ['Biometrics', 'CleanHands']

interface CachedScore {
  /** Four implied decimals. 0 with a non-zero time is a real, empty passport. */
  score: number
  /** Unix seconds the score was attested. 0 means no passport on this chain, ever. */
  time: number
  /** Unix seconds, or 0 meaning "use time + maxScoreAge". */
  expirationTime: number
}

export interface ChainReading extends CachedScore {
  chain: PassportChain
  /** Derived, never read: `expirationTime` when set, else `time + maxScoreAge`. */
  expiresAt: number
  expired: boolean
  /** Passport's own published pass mark, reported but never adopted. */
  meetsOwnThreshold: boolean
}

/**
 * Close the window on a passport that has lapsed on every chain — or decline to, and say why.
 *
 * Pure over what was read, so every branch that can put a credential back into a historical
 * score is testable without a network. Called only when no chain holds a passport that counts
 * today; a live passport needs no window, because it has not ended.
 *
 * Three things have to be true before a window is returned, and each of them is a way this can
 * be wrong rather than a formality:
 *
 * - **The score was non-zero.** A zero-score passport does not count as held while it is alive
 *   (see the `valid` filter in the probe), so its expiry ends nothing and restoring it would put
 *   a credential into the past that would not have counted at the time.
 * - **It has actually expired.** `expiresAt > now` on a zero-score reading is a live passport
 *   that carries no evidence, not an ending. `heldUntil` may only ever mean "the chain says this
 *   ended here".
 * - **The window is non-empty.** `expiresAt > time` guards against a struct we have not seen —
 *   an explicit `expirationTime` at or before the issuance — which would describe a credential
 *   that never counted for a second.
 *
 * Where several chains have lapsed windows the latest ending wins: it is the most recent thing
 * the subject paid to publish, and the one an as-of instant is most likely to fall inside. The
 * others stay visible in `detail.perChain`.
 */
export function closeLapsedPassportWindow(
  readings: readonly ChainReading[],
  now: number,
): { heldUntil?: number; issuedAt?: number; chain?: PassportChain; detail: Record<string, unknown> } {
  const detail: Record<string, unknown> = {}
  const lapsed = readings.filter(
    (r) => r.score > 0 && r.time > 0 && r.expiresAt > r.time && r.expiresAt <= now,
  )
  const emptyScore = readings.filter((r) => r.score === 0 && r.expiresAt <= now).length
  if (emptyScore) detail.lapsedWithZeroScore = emptyScore
  if (lapsed.length === 0) return { detail }

  const best = lapsed.reduce((a, b) => (b.expiresAt > a.expiresAt ? b : a))
  detail.lapsedChain = best.chain
  detail.lapsedScore = best.score / SCORE_DECIMALS
  detail.lapsedDaysAgo = Math.round(((now - best.expiresAt) / 86_400) * 10) / 10
  if (lapsed.length > 1) detail.lapsedWindowsOnOtherChains = lapsed.length - 1
  return { heldUntil: best.expiresAt, issuedAt: best.time, chain: best.chain, detail }
}

/** One EAS attestation, as much of it as the authority check needs. */
export interface BackingAttestation {
  uid: string
  schema: string
  /** Unix seconds EAS recorded the attestation at. */
  time: number
  /** 0 when live. Non-zero is an ending EAS dates, and a credential we may not count. */
  revocationTime: number
  recipient: Address
  /** `msg.sender` of the `EAS.attest` call — the only field in here that carries authority. */
  attester: Address
}

export type AttestationVerdict =
  /** An un-revoked attestation by the resolver's own attester, naming this subject, at this instant. */
  | { status: 'verified'; uid: string; schema: string; attester: Address }
  /** A record exists and says something incompatible with this being Passport's credential. */
  | { status: 'rejected'; reason: string; uid?: string }
  /** Nothing contradicts the cached score; we simply could not corroborate it. Never moves `held`. */
  | { status: 'unchecked'; reason: string }

/**
 * Decide whether the struct we read is backed by an attestation Passport itself wrote.
 *
 * Pure over what was read, because this is the only part of the adapter that can turn a held
 * credential into an absent one, and every branch of it should be exercisable without a network.
 *
 * The check is worth precisely what the resolver's own gate is worth. `_attest` reverts
 * `InvalidAttester()` unless `attestation.attester == address(_gitcoinAttester)`, and EAS sets
 * `attester` to the `msg.sender` of the `attest` call it received — so an attestation carrying
 * that address really did go through `GitcoinAttester`, whose `submitAttestations` in turn
 * requires `verifiers[msg.sender]`. Nothing a third party controls appears anywhere on that path.
 *
 * Three fields have to agree and each is a distinct way of being wrong:
 *
 * - **`attester`** — the whole of the authority. Anything else is somebody else's credential
 *   filed under Passport's schema, and it is `rejected`.
 * - **`recipient`** — the binding to a person. An attestation about someone else says nothing
 *   about this subject however impeccable its issuer.
 * - **`revocationTime`** — EAS keeps a revoked attestation readable. `_revoke` normally clears
 *   the cache with it, so a revoked attestation still sitting behind a live cached score is a
 *   state we have never observed; it is rejected rather than assumed impossible.
 *
 * And one that decides *which* record to judge rather than whether to accept it. Passport files
 * a uid per schema and mints under two of them, so a subject who moved from the legacy score to
 * score-v2 has two uids on file and only one of them describes the cached struct. `time` is the
 * discriminator: the resolver copies `attestation.time` verbatim into the struct, so the record
 * behind *this* score is the one whose `time` is the score's. If no filed record carries it, the
 * cache is uncorroborated rather than disproved — the ordinary cause is Passport rotating a
 * schema after the write, which leaves the old uid on file under a key we no longer ask about —
 * so that is `unchecked` and the credential stands.
 */
export function judgeBackingAttestation(
  subject: Address,
  cachedTime: number,
  expectedAttester: Address,
  records: readonly (BackingAttestation | null)[],
): AttestationVerdict {
  const filed = records.filter((r): r is BackingAttestation => r !== null)
  if (filed.length === 0) {
    return { status: 'unchecked', reason: 'the resolver has no attestation on file under either score schema' }
  }
  const dated = filed.filter((r) => r.time === cachedTime)
  if (dated.length === 0) {
    return {
      status: 'unchecked',
      reason:
        `no attestation on file carries the cached score's instant (${cachedTime}); ` +
        `on file: ${filed.map((r) => r.time).join(', ')}`,
    }
  }

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  let firstRejection: AttestationVerdict | undefined
  for (const r of dated) {
    if (!same(r.attester, expectedAttester)) {
      firstRejection ??= {
        status: 'rejected',
        uid: r.uid,
        reason: `attested by ${r.attester}, and the resolver only accepts writes attested by ${expectedAttester}`,
      }
      continue
    }
    if (!same(r.recipient, subject)) {
      firstRejection ??= {
        status: 'rejected',
        uid: r.uid,
        reason: `the attestation behind this score names ${r.recipient}, not ${subject}`,
      }
      continue
    }
    if (r.revocationTime !== 0) {
      firstRejection ??= {
        status: 'rejected',
        uid: r.uid,
        reason: `the attestation behind this score was revoked at ${r.revocationTime}`,
      }
      continue
    }
    return { status: 'verified', uid: r.uid, schema: r.schema, attester: r.attester }
  }
  return firstRejection as AttestationVerdict
}

/** Per-chain configuration that never changes between lookups, fetched once per instance. */
interface ChainConfig {
  resolver: Address
  maxScoreAge: number
  threshold: number
  /** The EAS the resolver itself points at. Differs per chain; never hard-coded. */
  eas: Address
  /** The only attester whose writes this resolver accepts. Differs per chain; never hard-coded. */
  attester: Address
  /** `scoreSchema` and `scoreV2Schema`, minus any the resolver has not set. */
  schemas: readonly string[]
}

export interface HumanPassportOptions {
  /** Restrict to a subset of deployments. Defaults to all seven. */
  chains?: readonly PassportChain[]
  /** Override an RPC endpoint per chain. */
  rpcUrls?: Partial<Record<PassportChain, string>>
  /** Milliseconds before a single chain is given up on. */
  timeoutMs?: number
}

export function humanPassportAdapter(opts: HumanPassportOptions = {}): AdapterProbe {
  const chains = opts.chains ?? (Object.keys(PASSPORT_DEPLOYMENTS) as PassportChain[])
  const timeout = opts.timeoutMs ?? 12_000

  const clients = new Map<PassportChain, PublicClient>()
  const clientFor = (chain: PassportChain): PublicClient => {
    let c = clients.get(chain)
    if (!c) {
      const url = opts.rpcUrls?.[chain] ?? PASSPORT_DEPLOYMENTS[chain].rpc
      c = createPublicClient({ transport: http(url, { timeout }) }) as PublicClient
      clients.set(chain, c)
    }
    return c
  }

  // Cached as the in-flight promise, not the value, so N concurrent probes at cold start
  // still make one round trip per chain. A rejected config is evicted so a transient RPC
  // failure does not poison the adapter for the life of the process.
  const configs = new Map<PassportChain, Promise<ChainConfig>>()
  const configFor = (chain: PassportChain): Promise<ChainConfig> => {
    let p = configs.get(chain)
    if (!p) {
      const c = clientFor(chain)
      const decoder = PASSPORT_DEPLOYMENTS[chain].decoder as Address
      p = Promise.all([
        c.readContract({ address: decoder, abi: DECODER_ABI, functionName: 'gitcoinResolver' }),
        c.readContract({ address: decoder, abi: DECODER_ABI, functionName: 'maxScoreAge' }),
        c.readContract({ address: decoder, abi: DECODER_ABI, functionName: 'threshold' }),
      ]).then(async ([resolver, maxScoreAge, threshold]) => {
        const at = { address: resolver as Address, abi: RESOLVER_ABI } as const
        // A resolver that will not name its attester leaves us unable to check the credential,
        // not free to skip checking it — so this failure takes the chain down to
        // `chainsUnreadable` rather than producing a probe that trusts whatever it finds.
        const [attester, eas] = await Promise.all([
          c.readContract({ ...at, functionName: '_gitcoinAttester' }),
          c.readContract({ ...at, functionName: '_eas' }),
        ])
        // The two schema getters are allowed to be missing: `scoreV2Schema` arrived in a later
        // implementation, and a deployment without it still has a legacy score worth reading.
        const schemas = (
          await Promise.all([
            c.readContract({ ...at, functionName: 'scoreSchema' }).catch(() => ZERO_BYTES32),
            c.readContract({ ...at, functionName: 'scoreV2Schema' }).catch(() => ZERO_BYTES32),
          ])
        ).filter((s) => !isZeroWord(s))
        return {
          resolver: resolver as Address,
          maxScoreAge: Number(maxScoreAge),
          threshold: Number(threshold),
          attester,
          eas,
          schemas,
        }
      })
      p.catch(() => configs.delete(chain))
      configs.set(chain, p)
    }
    return p
  }

  const readChain = async (chain: PassportChain, subject: Address, now: number): Promise<ChainReading | null> => {
    const cfg = await configFor(chain)
    const raw = await clientFor(chain).readContract({
      address: cfg.resolver,
      abi: RESOLVER_ABI,
      functionName: 'getCachedScore',
      args: [subject],
    })
    const time = Number(raw.time)
    // time == 0 is the resolver's own sentinel for "no attestation cached here" — it is what
    // the Decoder tests before reverting AttestationNotFound. An address with no passport on
    // this chain is not evidence of anything, so it is dropped rather than reported as absent.
    if (time === 0) return null
    const expirationTime = Number(raw.expirationTime)
    const expiresAt = expirationTime > 0 ? expirationTime : time + cfg.maxScoreAge
    const score = Number(raw.score)
    return {
      chain,
      score,
      time,
      expirationTime,
      expiresAt,
      expired: now >= expiresAt,
      meetsOwnThreshold: score >= cfg.threshold,
    }
  }

  /**
   * Ask the chain whether Passport really wrote this score, and never let the asking break it.
   *
   * Two `eth_call`s for the uids the resolver filed, then one per distinct uid for the record
   * behind it — at most four, and only on the chain whose reading is actually being used. The
   * other six deployments stay disclosure in `detail.perChain`, unchecked and marked as such,
   * because nothing there reaches a score.
   *
   * Everything in here is wrapped: an RPC that will not answer must produce `unchecked`, which
   * cannot move `held`. Turning an outage into a rejected credential is the exact failure the
   * rule at the top of `adapters/index.ts` forbids, one level up from presence.
   */
  const verifyAttestation = async (
    chain: PassportChain,
    subject: Address,
    reading: ChainReading,
  ): Promise<AttestationVerdict> => {
    let cfg: ChainConfig
    try {
      cfg = await configFor(chain)
    } catch (e) {
      return { status: 'unchecked', reason: `resolver configuration unavailable: ${errText(e)}` }
    }
    if (cfg.schemas.length === 0) {
      return { status: 'unchecked', reason: 'the resolver has no score schema set, so nothing is filed by uid' }
    }
    const c = clientFor(chain)
    try {
      const uids = await Promise.all(
        cfg.schemas.map((schema) =>
          c.readContract({
            address: cfg.resolver,
            abi: RESOLVER_ABI,
            functionName: 'userAttestations',
            args: [subject, schema as `0x${string}`],
          }),
        ),
      )
      const distinct = [...new Set(uids.filter((u) => !isZeroWord(u)))]
      const records = await Promise.all(
        distinct.map(async (uid): Promise<BackingAttestation> => {
          const a = await c.readContract({
            address: cfg.eas,
            abi: EAS_ABI,
            functionName: 'getAttestation',
            args: [uid],
          })
          return {
            uid,
            schema: a.schema,
            time: Number(a.time),
            revocationTime: Number(a.revocationTime),
            recipient: a.recipient as Address,
            attester: a.attester as Address,
          }
        }),
      )
      return judgeBackingAttestation(subject, reading.time, cfg.attester, records)
    } catch (e) {
      return { status: 'unchecked', reason: `EAS record unreadable: ${errText(e)}` }
    }
  }

  return {
    adapterId: 'human-passport',
    probe: async (subject: Address): Promise<AdapterProbeResult> => {
      const now = Math.floor(Date.now() / 1000)
      const settled = await Promise.all(
        chains.map(async (chain) => {
          try {
            return { chain, reading: await readChain(chain, subject, now) }
          } catch (e) {
            return { chain, error: e instanceof Error ? e.message : String(e) }
          }
        }),
      )

      const failures = settled.filter((s) => 'error' in s) as { chain: PassportChain; error: string }[]
      // Every deployment unreachable is an outage, not an absence. Reporting held:false here
      // would make an RPC blip read as "this address has no wallet history".
      if (failures.length === chains.length) {
        return {
          held: false,
          error: `no Passport deployment answered (${failures.map((f) => `${f.chain}: ${f.error.split('\n')[0]}`).join('; ')})`,
        }
      }

      const readings = settled
        .map((s) => ('reading' in s ? s.reading : null))
        .filter((r): r is ChainReading => r !== null)

      const perChain = Object.fromEntries(
        readings.map((r) => [
          r.chain,
          {
            score: r.score / SCORE_DECIMALS,
            issuedAt: r.time,
            expiresAt: r.expiresAt,
            expired: r.expired,
          },
        ]),
      )
      const unreadable = failures.length
        ? { chainsUnreadable: failures.map((f) => f.chain) }
        : {}

      const provenance: ProbeProvenance = { heldFrom: 'chain', dateFrom: 'chain', notes: [] }
      if (readings.length === 0) {
        return {
          held: false,
          provenance: { ...provenance, dateFrom: 'none' },
          detail: { minted: false, chainsRead: chains.length - failures.length, ...unreadable },
        }
      }

      /**
       * A reading whose backing attestation the chain disowns is dropped, and the choice is made
       * again over what is left. One chain carrying a record we cannot attribute to Passport must
       * not hide a genuine passport on another — the same reason we read seven chains at all.
       */
      const rejections: { chain: PassportChain; reason: string }[] = []
      const disowned = new Set<PassportChain>()
      const surviving = () => readings.filter((r) => !disowned.has(r.chain))
      const attestationDetail = (v: AttestationVerdict | undefined): Record<string, unknown> => {
        if (v === undefined) return {}
        if (v.status === 'verified') {
          return { attestation: { uid: v.uid, schema: v.schema, attester: v.attester, verified: true } }
        }
        return { attestationUnverified: v.reason }
      }
      const rejectedList = () =>
        rejections.length
          ? { attestationsRejected: rejections.map((r) => `${r.chain}: ${r.reason}`) }
          : {}

      // Freshest unexpired mint wins: it is the strongest evidence available and the one the
      // subject most recently paid to publish. A score of 0 is a real passport carrying no
      // stamps, which is not wallet-history evidence, so it does not count as held.
      let best: ChainReading | undefined
      let verdict: AttestationVerdict | undefined
      for (;;) {
        const pool = surviving().filter((r) => !r.expired && r.score > 0)
        if (pool.length === 0) break
        const candidate = pool.reduce((a, b) => (b.time > a.time ? b : a))
        const v = await verifyAttestation(candidate.chain, subject, candidate)
        if (v.status === 'rejected') {
          rejections.push({ chain: candidate.chain, reason: v.reason })
          disowned.add(candidate.chain)
          continue
        }
        best = candidate
        verdict = v
        break
      }
      if (best === undefined) {
        // The resolver keeps the struct after the Decoder stops honouring it, so this negative
        // can carry the whole life of the credential rather than only its absence — but only for
        // a credential we can still attribute, which is the test iteration 16 refused Holonym on.
        let window = closeLapsedPassportWindow(surviving(), now)
        let lapsedVerdict: AttestationVerdict | undefined
        while (window.chain !== undefined) {
          const r = surviving().find((x) => x.chain === window.chain)!
          const v = await verifyAttestation(window.chain, subject, r)
          if (v.status !== 'rejected') {
            lapsedVerdict = v
            break
          }
          rejections.push({ chain: window.chain, reason: v.reason })
          disowned.add(window.chain)
          window = closeLapsedPassportWindow(surviving(), now)
        }
        if (window.heldUntil !== undefined) provenance.notes.push('date-from-lapsed-verification')
        if (window.heldUntil !== undefined && lapsedVerdict?.status === 'unchecked') {
          provenance.notes.push('issuer-check-unavailable')
        }
        const left = surviving()
        const newest = left.length ? left.reduce((a, b) => (b.expiresAt > a.expiresAt ? b : a)) : undefined
        return {
          held: false,
          ...(window.issuedAt !== undefined ? { issuedAt: window.issuedAt } : {}),
          ...(window.heldUntil !== undefined ? { heldUntil: window.heldUntil } : {}),
          provenance: {
            ...provenance,
            ...(window.heldUntil === undefined ? { dateFrom: 'none' as const } : {}),
          },
          detail: {
            minted: true,
            reason:
              newest === undefined
                ? 'attestation-not-passports'
                : newest.score === 0
                  ? 'score-zero'
                  : 'score-expired',
            ...(newest ? { expiredAt: newest.expiresAt } : {}),
            ...window.detail,
            ...(window.heldUntil !== undefined ? attestationDetail(lapsedVerdict) : {}),
            ...rejectedList(),
            perChain,
            ...unreadable,
          },
        }
      }
      if (verdict?.status === 'unchecked') provenance.notes.push('issuer-check-unavailable')

      // Stamps are disclosure only — they never change `held` or the weight. Best-effort:
      // getPassport reverts AttestationNotFound when only a community-scoped score is cached,
      // and a passport we can price is worth more than a stamp list we cannot fetch.
      let stamps: string[] | undefined
      try {
        const credentials = await clientFor(best.chain).readContract({
          address: PASSPORT_DEPLOYMENTS[best.chain].decoder as Address,
          abi: DECODER_ABI,
          functionName: 'getPassport',
          args: [subject],
        })
        stamps = credentials.map((c) => c.provider).filter((p) => p.length > 0)
      } catch {
        // Leave undefined: absent disclosure is honest, invented disclosure is not.
      }

      const restatedAdapters = stamps
        ? [...new Set(stamps.map((s) => STAMP_TO_ADAPTER[s]).filter((a): a is string => Boolean(a)))]
        : []

      return {
        held: true,
        issuedAt: best.time,
        provenance,
        detail: {
          minted: true,
          score: best.score / SCORE_DECIMALS,
          chain: best.chain,
          expiresAt: best.expiresAt,
          /**
           * Passport's own 20-point pass mark, read from `threshold()` rather than hard-coded.
           * Reported so a caller can see what Passport concluded; never used here, because
           * adopting it would be adopting their weighting.
           */
          meetsPassportThreshold: best.meetsOwnThreshold,
          ...(stamps ? { stamps } : {}),
          ...(restatedAdapters.length ? { restatesAdapters: restatedAdapters } : {}),
          ...attestationDetail(verdict),
          ...rejectedList(),
          perChain,
          ...unreadable,
        },
      }
    },
  }
}
