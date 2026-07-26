import enrollmentData from '../../../ontology/enrollment.json' with { type: 'json' }
import type { Adapter, PersonhoodResult } from './types.ts'

/**
 * Routing — the half of an aggregator that does something for the person, not the consumer.
 *
 * A price quote is only half of what "1inch for personhood" implies. 1inch does not merely
 * tell you the rate; it routes you. So: given what a subject already holds, which trust root
 * are they missing, and where do they actually go to get it.
 *
 * The recommendation rule falls straight out of the scoring rule and is the whole reason this
 * is worth shipping rather than being a links page: **we only ever suggest roots the subject
 * does not already hold.** A second passport-derived credential raises nothing, because it
 * saturates against the first. Every other scorer in this space would happily tell you to
 * collect ZKPassport *and* Self *and* World's document tier, and you would end up with three
 * credentials, one root, and no more evidence than you started with.
 *
 * On the obvious objection — that this tells a sybil farm what to buy next. Three answers.
 * The ontology is open and on-chain, so a farm already has this; only the honest user was
 * missing it. The advice a farm receives here is deliberately useless to it: it is told that
 * the roots it can cheaply replicate are the ones that gain it nothing. And what it would
 * actually need is an unheld *root*, which by construction means a distinct real-world
 * enrolment — the cost we are trying to impose in the first place. A recommender that obeys
 * the saturation rule cannot be turned into a farming manual.
 */

export interface EnrollmentOption {
  name: string
  url: string
  /** What it takes: time, place, hardware. */
  effort: string
  price: string
  /** What the person hands over. Stated because a score is not worth an unwanted biometric. */
  youGive: string
  note: string
}

export interface RootSuggestion {
  trustRoot: string
  /** Cheapest-to-attack credential in this root, in cents — what the root would contribute. */
  contributionCents: number
  /** Score after adding this root, and the delta from now. */
  projectedScore: number
  scoreGain: number
  /** Independent roots after adding this one. */
  projectedRoots: number
  options: EnrollmentOption[]
}

export interface EnrollmentAdvice {
  currentScore: number
  currentRoots: number
  /** Roots the subject already has positive-cost evidence in — suggesting these would be a lie. */
  heldRoots: string[]
  /** Ranked by score gain, largest first. */
  suggestions: RootSuggestion[]
  /**
   * Roots the subject already holds where MORE credentials are available. Surfaced explicitly
   * so a caller can show "these would add nothing" rather than leaving the user to discover it
   * by wasting an afternoon at a passport office.
   */
  wouldAddNothing: { trustRoot: string; options: EnrollmentOption[] }[]
  caveat: string
}

const NEGLIGIBLE_COST_CENTS = 10

const byRoot = enrollmentData.byRoot as Record<string, EnrollmentOption[]>

/** Every root we can actually route someone to. */
export function enrollableRoots(): string[] {
  return Object.keys(byRoot)
}

/**
 * What would raise this subject's independence, and where to go.
 *
 * `adapters` is the ontology (from `Print#ontology()`), used to price each unheld root at
 * its strongest available credential — the same figure scoring would credit.
 */
export function suggestEnrollment(
  result: Pick<PersonhoodResult, 'score' | 'totalCostCents' | 'independentRoots' | 'evidence'>,
  adapters: Map<string, Adapter>,
): EnrollmentAdvice {
  // A root counts as held only if it carries real weight. A discontinued protocol leaves the
  // root genuinely empty, so we should still route the person there.
  const held = new Set(
    result.evidence
      .filter((e) => e.held && e.effectiveCostCents >= NEGLIGIBLE_COST_CENTS)
      .map((e) => e.trustRoot),
  )

  // Strongest credential per root, priced as scoring prices it: min(forge, rent).
  const strongestByRoot = new Map<string, number>()
  for (const a of adapters.values()) {
    if (!a.live) continue
    const cents = Math.min(a.forgeCostCents, a.rentCostCents)
    const prev = strongestByRoot.get(a.trustRoot) ?? 0
    if (cents > prev) strongestByRoot.set(a.trustRoot, cents)
  }

  const suggestions: RootSuggestion[] = []
  const wouldAddNothing: EnrollmentAdvice['wouldAddNothing'] = []

  for (const [trustRoot, options] of Object.entries(byRoot)) {
    if (held.has(trustRoot)) {
      wouldAddNothing.push({ trustRoot, options })
      continue
    }
    // Fall back to the enrolment list's own root if the ontology has no live adapter for it.
    const contributionCents = strongestByRoot.get(trustRoot) ?? 0
    if (contributionCents < NEGLIGIBLE_COST_CENTS) continue

    const projectedCents = result.totalCostCents + contributionCents
    const projectedScore = Number(Math.log10(projectedCents + 1).toFixed(4))
    suggestions.push({
      trustRoot,
      contributionCents,
      projectedScore,
      scoreGain: Number((projectedScore - result.score).toFixed(4)),
      projectedRoots: result.independentRoots + 1,
      options,
    })
  }

  suggestions.sort((a, b) => b.scoreGain - a.scoreGain)

  return {
    currentScore: result.score,
    currentRoots: result.independentRoots,
    heldRoots: [...held],
    suggestions,
    wouldAddNothing,
    caveat:
      'These are ranked by what they would add to your score, which is not the same as what they cost you. Each one is a real-world enrolment with a privacy price stated on it — a permanent public video, a biometric in someone else\'s registry, a KYC file at a vendor. Raising a number is a bad reason to hand over any of that. There is also no obligation: most people hold none of these credentials, and an absence of evidence is not evidence of absence.',
  }
}
