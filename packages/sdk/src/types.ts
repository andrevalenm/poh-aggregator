/**
 * Core types.
 *
 * Design note that governs everything here: we return evidence and a score, and we let
 * the caller decide. `isHuman` takes a required threshold rather than defaulting to one,
 * because at a plausible 2% sybil rate a 95%-specificity classifier is wrong about roughly
 * three-quarters of the people it flags. Denial is the caller's decision to own, not a
 * default we ship.
 */

import type { ProbeProvenance } from './reconcile.ts'
import type { AsOfScoring } from './as-of.ts'

export type Address = `0x${string}`

/** What a credential fundamentally demonstrates. Ordering is not significance. */
export type EvidenceClass =
  | 'Uniqueness'
  | 'StateIdentity'
  | 'SocialTrust'
  | 'Liveness'
  | 'Behavioral'

/**
 * Correlation key. Two adapters sharing a trustRoot are one piece of evidence observed
 * twice — a passport read by three protocols is still one passport.
 */
export type TrustRoot = string

/**
 * How weight relates to credential age. 'Decay': weight falls with age — right for
 * liveness and KYC, where recency is the signal. 'Ramp': weight RISES with survival —
 * right for vouching registries, where a registration that survived challenge windows
 * beats one minted during last week's reward program. A single curve for all classes
 * would hand full weight to exactly the airdrop-minted cohort.
 */
export type AgeCurve = 'None' | 'Decay' | 'Ramp'

export interface Adapter {
  id: string
  name: string
  evidenceClass: EvidenceClass
  trustRoot: TrustRoot
  /** Cost for an adversary to manufacture the credential, in cents. */
  forgeCostCents: number
  /** Cost to borrow one from a willing holder, in cents. Separate on purpose. */
  rentCostCents: number
  /** Half-life in days for whichever ageCurve applies. 0 means age is ignored. */
  decayHalfLifeDays: number
  ageCurve: AgeCurve
  /** False when the upstream protocol is discontinued. */
  live: boolean
  /** Where the costs above came from. */
  sourceURI: string
}

/** A credential actually held by a subject, as observed by an adapter. */
export interface Evidence {
  adapterId: string
  adapterName: string
  evidenceClass: EvidenceClass
  trustRoot: TrustRoot
  /**
   * Which of the subject's addresses this credential was found on.
   *
   * Real people spread credentials across wallets — Proof of Humanity's own Circles proxy
   * pairs a PoH address with a *different* Circles avatar — so a single-address lookup
   * systematically undercounts them.
   */
  observedOn: Address
  /** True when the subject holds this credential. */
  held: boolean
  /** Unix seconds the credential was issued, when the protocol exposes it. */
  issuedAt?: number
  /**
   * Lower bound on issuance, set when the exact date is unknown but the credential provably
   * did not exist at this time — it was absent from an index with complete history at a block
   * the index named. On a survival ramp this caps the weight instead of granting the
   * unknown-age midpoint, so index lag can no longer be worth anything to an attacker.
   */
  issuedAfter?: number
  /** Which source decided held and the date, and at which blocks. */
  provenance?: ProbeProvenance
  /** Decay multiplier in [0,1] derived from issuedAt and the adapter's half-life. */
  freshness: number
  /** Effective adversary cost after decay and liveness, in cents. */
  effectiveCostCents: number
  forgeCostCents: number
  rentCostCents: number
  live: boolean
  sourceURI: string
  /** Adapter-specific detail — trust-graph position, revocation state, and so on. */
  detail?: Record<string, unknown>
}

/** One trust root's contribution, after saturation across its correlated adapters. */
export interface RootContribution {
  trustRoot: TrustRoot
  /** Adapter ids that contributed evidence under this root. */
  adapterIds: string[]
  /** Cost of the single strongest credential under this root. Saturated, not summed. */
  contributionCents: number
  /** True when more than one adapter matched — evidence that would have been double-counted. */
  saturated: boolean
}

export interface Caveat {
  code: string
  message: string
}

export interface PersonhoodResult {
  /** Primary address. For a multi-address subject, the first one supplied. */
  subject: Address
  /**
   * Every address the caller asserted control of. The caller is responsible for having
   * authenticated these — we aggregate what we are given and never infer that two
   * addresses belong to one person, which would be precisely the linkage we exist to avoid.
   */
  subjects: Address[]
  /** Resolved ENS name, when the lookup started from one. */
  name?: string
  /** log10 of total root-cost in cents. Continuous, roughly 0–4. Never a grade. */
  score: number
  /** Total adversary cost across independent roots, in cents. */
  totalCostCents: number
  /** Distinct trust roots with evidence. The number that actually matters. */
  independentRoots: number
  evidence: Evidence[]
  roots: RootContribution[]
  caveats: Caveat[]
  /** Registry revision the score was computed against, for reproducibility. */
  registryRevision?: number
  /**
   * Present when the score was computed as of a past block rather than now. Carries the
   * block, its timestamp, the registry revision in force then, and what that did to this
   * subject's evidence. See `as-of.ts` for what such a result may and may not claim.
   */
  asOf?: AsOfScoring
  computedAt: number
  /**
   * Verdict against a caller-supplied threshold. Deliberately a method, and deliberately
   * without a default — see the note at the top of this file.
   */
  isHuman(threshold: number): boolean
}

export interface AdapterProbe {
  adapterId: string
  /** Look up whether this subject holds the credential. Must never throw; return held:false. */
  probe(subject: Address): Promise<AdapterProbeResult>
}

export interface AdapterProbeResult {
  held: boolean
  issuedAt?: number
  /** See `Evidence.issuedAfter`: a proven lower bound on issuance, used to cap ramp weight. */
  issuedAfter?: number
  /** How this answer was reached — which source decided held, which dated it, at what block. */
  provenance?: ProbeProvenance
  detail?: Record<string, unknown>
  /** Set when the probe failed, so a network error is never silently a negative. */
  error?: string
}
