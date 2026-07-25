import { getAddress, isAddressEqual, recoverMessageAddress, type Hex, type PublicClient } from 'viem'
import { createSiweMessage, generateSiweNonce, parseSiweMessage } from 'viem/siwe'
import { normalize } from 'viem/ens'
import type { Address, Caveat } from './types.ts'

/**
 * Authenticating the party that presents an ENS name.
 *
 * `ens-agents.ts` reads what a name *says*: this wallet is the agent, that name is the human,
 * the human lists the agent back. Every one of those answers can be true while the party on the
 * connection has nothing to do with any of it. A name is public. Anyone can type
 * `alpha.corroborate.eth` into a counterparty's form and be scored on the credentials of the
 * human behind it — riding a stranger's evidence with no key, no transaction and no trace. The
 * counterparty's log then names the wrong party, which is worse than not knowing.
 *
 * That gap was reported honestly (`agent-presenter-not-authenticated` fired on every batch) and
 * left open for four iterations. This closes it: a challenge the counterparty issues, a signature
 * the presenter returns, and one comparison — **does the recovered signer equal the address the
 * name currently resolves to?**
 *
 * ## Why the wallet signs, and not the name's owner
 *
 * Both keys exist. The node owner writes the records; the `addr` record designates a wallet. They
 * are usually different keys and they prove different things:
 *
 *   - the *wallet* signing proves the presenter is the party this name currently designates —
 *     the party the counterparty is about to transact with, and the key the fleet slot is
 *     allocated to (`toFleetAgents` groups by wallet, not by name);
 *   - the *owner* signing proves only that the presenter controls the name. An operator who
 *     points a name at a wallet it does not hold could then present as that wallet, which is the
 *     impersonation this gate exists to stop.
 *
 * So the wallet signs. Whether the signer *also* owns the node is reported (`signerIsNodeOwner`)
 * because it tells a counterparty whether the key in front of it can rewrite the records it just
 * read — but it is never a condition, and an agent whose operator keeps the name key elsewhere is
 * the ordinary, healthier arrangement.
 *
 * ## Why the name is inside the signed message
 *
 * The message carries `ens:<name>` in ERC-4361 `Resources`, and verification refuses a signature
 * whose resource is any other name. Without it, one signature authenticates its signer for
 * *every* name in the tree pointing at that wallet — and more importantly a counterparty could
 * take a signature collected for one name and present it for another. A signature that does not
 * name what it authorises is a bearer token.
 *
 * ## What a signature here does and does not prove
 *
 * It proves that whoever answered the challenge holds the key for the wallet
 * `<name>` resolved to *in this same pass*. It does not prove the presenter is the agent's
 * operator (keys are shared and stolen), does not prove the human named by the record consents
 * to anything (that is the acknowledgement record's job), and does not survive the record being
 * rewritten: `addr` is mutable by the node owner, so this authenticates against the record as
 * read, not against the name forever. Each of those ships as a caveat rather than as a comment.
 *
 * ## Failure is three-valued, deliberately
 *
 * A malformed or wrong-key signature is `unauthenticated` — a fact about the presenter. But a
 * smart-account signature (ERC-1271/6492) needs a chain read to check, and an RPC failure there
 * says nothing about the presenter, so it comes back `unknown` and the fleet engine turns it into
 * `indeterminate`. This is the same rule every probe in this SDK follows: a network failure must
 * never read as a negative fact about a person.
 *
 * Nothing here mutates. The nonce is *checked* through a caller-supplied predicate and never
 * burned — burning it inside verification would spend an honest presenter's nonce on a malformed
 * retry, and replay state belongs to the counterparty that issued it.
 */

/** ERC-4361 `Resources` entry naming the ENS name a signature authorises. */
export const ENS_RESOURCE_SCHEME = 'ens:'

/** Default lifetime of a challenge. Matches the World AgentKit flow in `apps/agent`. */
export const DEFAULT_CHALLENGE_TTL_MS = 5 * 60_000

export interface EnsPresentationChallenge {
  /** The authority the counterparty serves at, as ERC-4361 defines `domain`. */
  domain: string
  /** The resource being requested. */
  uri: string
  /** Normalized ENS name the presenter claims. Bound into the message's `Resources`. */
  name: string
  /** Chain the name is resolved on. Signed, so a Sepolia signature cannot be replayed on L1. */
  chainId: number
  /** Single-use, issued by the counterparty. */
  nonce: string
  issuedAt: string
  expirationTime: string
  statement: string
  version: '1'
}

export interface IssueEnsChallengeOptions {
  domain: string
  uri: string
  name: string
  chainId: number
  /** Supply one to use an existing nonce store; otherwise a fresh SIWE nonce is generated. */
  nonce?: string
  now?: Date
  ttlMs?: number
  statement?: string
}

/** The name in the human-readable statement, so a wallet prompt shows what is being authorised. */
export const presentationStatement = (name: string) =>
  `Prove you control the wallet ${name} names, so this request can be attributed to it.`

/**
 * Issue a challenge for one name. Pure but for the nonce, which is random by construction.
 *
 * The name is normalized here rather than at verification time, so the value that goes into the
 * message and the value compared against it are the same string by construction.
 */
export function issueEnsPresentationChallenge(
  opts: IssueEnsChallengeOptions,
): EnsPresentationChallenge {
  const name = safeNormalize(opts.name) ?? opts.name.trim()
  const now = opts.now ?? new Date()
  const ttl = opts.ttlMs ?? DEFAULT_CHALLENGE_TTL_MS
  return {
    domain: opts.domain,
    uri: opts.uri,
    name,
    chainId: opts.chainId,
    nonce: opts.nonce ?? generateSiweNonce(),
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + ttl).toISOString(),
    statement: opts.statement ?? presentationStatement(name),
    version: '1',
  }
}

/**
 * The exact ERC-4361 text to sign. Built with viem's `createSiweMessage` rather than by
 * concatenation: the format is a spec with field-ordering rules, and a message the counterparty
 * builds one way and a wallet renders another way is a signature nobody can check.
 */
export function ensPresentationMessage(
  challenge: EnsPresentationChallenge,
  address: Address,
): string {
  return createSiweMessage({
    domain: challenge.domain,
    address: getAddress(address),
    statement: challenge.statement,
    uri: challenge.uri,
    version: challenge.version,
    chainId: challenge.chainId,
    nonce: challenge.nonce,
    issuedAt: new Date(challenge.issuedAt),
    expirationTime: new Date(challenge.expirationTime),
    resources: [`${ENS_RESOURCE_SCHEME}${challenge.name}`],
  })
}

/** What the presenter hands back. */
export interface EnsPresentation {
  /** The name presented. Must be the one the challenge was issued for. */
  name: string
  /** The verbatim ERC-4361 text that was signed. */
  message: string
  signature: Hex
}

/**
 * Why a presentation was refused. Named rather than boolean because the presenter has to be able
 * to fix it: "signature did not verify" and "you signed with the wrong wallet" are the same
 * failure to a boolean and completely different instructions to a person.
 */
export type EnsPresentationFailure =
  | 'malformed-message'
  | 'wrong-name'
  | 'wrong-domain'
  | 'wrong-uri'
  | 'wrong-chain'
  | 'nonce-not-issued'
  | 'expired'
  | 'not-yet-valid'
  | 'signature-invalid'
  | 'signer-is-not-the-name'
  | 'signature-unreadable'

export type PresenterStatus = 'authenticated' | 'unauthenticated' | 'unknown'

export interface EnsPresentationResult {
  name: string
  status: PresenterStatus
  /** The signer, once recovered. Present even on `signer-is-not-the-name`, which is the point. */
  address?: Address
  /** The address the name resolved to, as supplied by the caller's identity read. */
  expected?: Address
  /** How the signature was checked. `erc-1271` means a contract wallet answered on chain. */
  method?: 'eoa-ecdsa' | 'erc-1271'
  /** True when the signer is also the registry owner of the node — it can rewrite these records. */
  signerIsNodeOwner?: boolean
  failure?: EnsPresentationFailure
  /** Legible sentence for the presenter. Every failure sets one. */
  error?: string
  caveats: Caveat[]
}

export interface VerifyEnsPresentationOptions {
  challenge: EnsPresentationChallenge
  presentation: EnsPresentation
  /**
   * The `addr` record the name resolved to, from the same resolution pass that produced the
   * identity. Taking it as an argument rather than resolving it here is deliberate: the address
   * a signature is checked against and the address the rest of the decision uses must be one
   * read, or the two can disagree across a record rewrite — the torn read `reconcile.ts` exists
   * to prevent, in miniature.
   */
  expectedAddress?: Address
  /** Registry owner of the node, for `signerIsNodeOwner`. Reported, never required. */
  nodeOwner?: Address
  now?: Date
  /**
   * Returns true when the nonce is ACCEPTABLE — i.e. issued by this counterparty and not yet
   * spent. Note the polarity: `AgentKitStorage.hasUsedNonce` is the opposite, and getting it
   * backwards rejects every honest request as a replay. Omit to skip the check entirely, which
   * is only right in a test.
   */
  checkNonce?: (nonce: string) => boolean
  /**
   * Needed only for smart-account signatures. An EOA signature is checked by local recovery with
   * no network at all, so an ordinary agent authenticates without an RPC in the path.
   */
  client?: PublicClient
}

const CAVEAT_SCOPE: Caveat = {
  code: 'agent-presenter-authenticated-for-this-wallet-only',
  message:
    'The presenter proved control of the key for the wallet this name resolved to, at this moment, for this request. It does not follow that they are the agent’s operator (keys are shared and stolen), that the human named by the record consents to anything (that is the acknowledgement record), or that the name will keep pointing at this wallet — addr is mutable by whoever owns the node, so this authenticates against the record as read, not against the name.',
}

const CAVEAT_SIGNER_OWNS_NODE: Caveat = {
  code: 'agent-signer-owns-the-name',
  message:
    'The wallet that signed is also the registry owner of this node, so the same key that authenticated can rewrite the records this decision was read from — including which wallet the name designates and which human it names. Nothing is wrong with that; it means the agent and the name are one keyholder, and a counterparty caching either should re-read rather than trust an earlier pass.',
}

/**
 * Check one presentation. Never throws; every failure is a named result.
 *
 * Order is cheapest-and-most-diagnostic first: the message is parsed and every claimed field
 * checked before any key work, and the key work before any chain read. A presenter that got the
 * domain wrong learns that instead of "signature invalid", and a wrong-name signature never costs
 * an `eth_call`.
 */
export async function verifyEnsPresentation(
  opts: VerifyEnsPresentationOptions,
): Promise<EnsPresentationResult> {
  const { challenge, presentation } = opts
  const name = safeNormalize(presentation.name) ?? presentation.name.trim()
  const now = opts.now ?? new Date()
  const fail = (failure: EnsPresentationFailure, error: string): EnsPresentationResult => ({
    name,
    status: 'unauthenticated',
    ...(opts.expectedAddress ? { expected: getAddress(opts.expectedAddress) } : {}),
    failure,
    error,
    caveats: [],
  })

  if (name !== challenge.name) {
    return fail(
      'wrong-name',
      `this challenge was issued for ${challenge.name}, and the presentation is for ${name}. A challenge authorises one name.`,
    )
  }

  let parsed: ReturnType<typeof parseSiweMessage>
  try {
    parsed = parseSiweMessage(presentation.message)
  } catch (e) {
    return fail('malformed-message', `the signed message is not an ERC-4361 message: ${errText(e)}`)
  }
  if (!parsed.address) {
    return fail('malformed-message', 'the signed message names no address, so there is nothing to check a signature against')
  }

  if (parsed.domain !== challenge.domain) {
    return fail(
      'wrong-domain',
      `the message was signed for domain "${parsed.domain ?? '(absent)'}" and this counterparty is "${challenge.domain}". A signature for another site is not a signature for this one.`,
    )
  }
  if (parsed.uri !== challenge.uri) {
    return fail(
      'wrong-uri',
      `the message authorises ${parsed.uri ?? '(no uri)'} and this request is for ${challenge.uri}.`,
    )
  }
  if (parsed.chainId !== challenge.chainId) {
    return fail(
      'wrong-chain',
      `the message was signed for chain ${parsed.chainId ?? '(absent)'} and this name is resolved on chain ${challenge.chainId}.`,
    )
  }
  if (parsed.nonce !== challenge.nonce) {
    return fail(
      'nonce-not-issued',
      'the message carries a nonce this counterparty did not issue for this challenge.',
    )
  }
  if (opts.checkNonce && !opts.checkNonce(parsed.nonce)) {
    return fail(
      'nonce-not-issued',
      'the nonce was not issued by this counterparty, or has already been spent. Ask for a fresh challenge.',
    )
  }

  // Times come out of the parser as ISO strings in some viem versions and as Dates in others.
  const expiry = asDate(parsed.expirationTime) ?? new Date(challenge.expirationTime)
  if (now >= expiry) {
    return fail(
      'expired',
      `the challenge expired at ${expiry.toISOString()} and it is now ${now.toISOString()}. Ask for a fresh one.`,
    )
  }
  const notBefore = asDate(parsed.notBefore)
  if (notBefore && now < notBefore) {
    return fail('not-yet-valid', `the message is not valid until ${notBefore.toISOString()}.`)
  }

  const resources = parsed.resources ?? []
  const bound = resources.filter((r) => r.startsWith(ENS_RESOURCE_SCHEME))
  if (bound.length !== 1 || bound[0]!.slice(ENS_RESOURCE_SCHEME.length) !== challenge.name) {
    return fail(
      'wrong-name',
      `the message must authorise exactly one ENS name, as "${ENS_RESOURCE_SCHEME}${challenge.name}" under Resources; it carries ${
        bound.length === 0 ? 'none' : bound.map((b) => `"${b}"`).join(', ')
      }. A signature that does not name what it authorises is a bearer token.`,
    )
  }

  const claimed = getAddress(parsed.address)

  // ---- the key work -------------------------------------------------------------------
  // Local recovery first: an EOA is pure arithmetic, so the common case needs no network and
  // cannot be broken by an endpoint being down.
  let method: 'eoa-ecdsa' | 'erc-1271' | undefined
  let recovered: Address | undefined
  try {
    recovered = getAddress(
      await recoverMessageAddress({ message: presentation.message, signature: presentation.signature }),
    )
  } catch {
    recovered = undefined
  }
  if (recovered && isAddressEqual(recovered, claimed)) {
    method = 'eoa-ecdsa'
  } else if (opts.client) {
    // A smart account (ERC-1271, or ERC-6492 for one not yet deployed) can only be checked by
    // asking the chain. This is the one branch that can be defeated by an RPC failure, and the
    // one branch that returns `unknown` rather than a verdict about the presenter.
    try {
      const valid = await opts.client.verifyMessage({
        address: claimed,
        message: presentation.message,
        signature: presentation.signature,
      })
      if (!valid) {
        return fail(
          'signature-invalid',
          `the signature does not verify for ${claimed}, by ECDSA recovery or by that account's own ERC-1271 check.`,
        )
      }
      method = 'erc-1271'
    } catch (e) {
      return {
        name,
        status: 'unknown',
        address: claimed,
        ...(opts.expectedAddress ? { expected: getAddress(opts.expectedAddress) } : {}),
        failure: 'signature-unreadable',
        error: `the signature is not a plain ECDSA signature for ${claimed}, and the contract-account check could not be made: ${errText(e)}. This says nothing about the presenter.`,
        caveats: [
          {
            code: 'agent-presenter-authentication-unreadable',
            message: `Whether ${claimed} authorised this request could not be determined: it is not a valid ECDSA signature for that address, and the ERC-1271 read a smart account would need failed (${errText(e)}). That is a fact about our connection to the chain, not about the presenter, so it is neither an authentication nor a refusal.`,
          },
        ],
      }
    }
  } else {
    return fail(
      'signature-invalid',
      `the signature does not recover to ${claimed}. If this is a smart-account signature, verifying it needs a chain read and no client was supplied.`,
    )
  }

  // ---- the comparison the whole gate exists for ---------------------------------------
  const expected = opts.expectedAddress ? getAddress(opts.expectedAddress) : undefined
  if (!expected) {
    return {
      name,
      status: 'unknown',
      address: claimed,
      method,
      failure: 'signature-unreadable',
      error: `${claimed} signed a valid challenge for ${name}, but ${name} resolved to no address, so there is nothing to match the signer against.`,
      caveats: [
        {
          code: 'agent-presenter-authentication-unreadable',
          message: `${name} carries no readable addr record, so a valid signature from ${claimed} proves control of a key and not that the key is the one this name designates. The presenter is neither authenticated nor refused.`,
        },
      ],
    }
  }
  if (!isAddressEqual(claimed, expected)) {
    return {
      name,
      status: 'unauthenticated',
      address: claimed,
      expected,
      method,
      failure: 'signer-is-not-the-name',
      error: `${name} resolves to ${expected}, and this request was signed by ${claimed}. Whoever is presenting this name does not hold the key it designates.`,
      caveats: [],
    }
  }

  const signerIsNodeOwner = opts.nodeOwner ? isAddressEqual(claimed, getAddress(opts.nodeOwner)) : undefined
  return {
    name,
    status: 'authenticated',
    address: claimed,
    expected,
    method,
    ...(signerIsNodeOwner !== undefined ? { signerIsNodeOwner } : {}),
    caveats: signerIsNodeOwner ? [CAVEAT_SCOPE, CAVEAT_SIGNER_OWNS_NODE] : [CAVEAT_SCOPE],
  }
}

/** Verify a batch, keyed by normalized name. Never rejects; failures ride on each result. */
export async function verifyEnsPresentations(
  items: readonly VerifyEnsPresentationOptions[],
): Promise<Map<string, EnsPresentationResult>> {
  const results = await Promise.all(items.map((i) => verifyEnsPresentation(i)))
  const map = new Map<string, EnsPresentationResult>()
  for (const r of results) map.set(r.name, r)
  return map
}

function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name.trim())
  } catch {
    return undefined
  }
}

function asDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
