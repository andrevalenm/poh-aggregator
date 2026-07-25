import type { Adapter, Caveat, Evidence, PersonhoodResult, RootContribution, Address } from './types.ts'

/**
 * Root-cost aggregation.
 *
 * The rule is one line: **saturate within a trust root, sum across trust roots.**
 *
 * Additive scoring over credentials is wrong, and wrong specifically in the adversary's
 * favour. A farm's credentials are maximally correlated — one passport presented to every
 * protocol that reads passports — while a real person's credentials are diverse. Summing
 * therefore rewards exactly the pattern it is supposed to catch. Concretely: from one
 * government document a subject can hold World's document tier, ZKPassport and Self, and a
 * naive scorer credits three independent proofs for one trip to a passport office.
 *
 * We cannot fix this by deduplicating credentials, because we usually cannot tell that two
 * came from one document: ZKPassport scopes its nullifier per service and never publishes
 * an unscoped value, while Self publishes a global one — four protocols, four incompatible
 * derivations over the same chip. Dedup would require linking a user's credentials to each
 * other, which is the correlation their nullifier designs exist to prevent.
 *
 * So we work at the level of the credential *class* instead. We never need to know that
 * *this* subject's two credentials share a root — only that those two *protocols* read the
 * same root, which is a public fact about the world. Within a root we take the strongest
 * credential and discard the rest; across roots we add. Saturation is also the right move
 * under uncertainty: when correlation is unobservable it bounds the honest user's loss at
 * one root's worth, while the adversary's gain from additive scoring would grow without
 * limit in the number of protocols reading the same root.
 *
 * Cost is denominated in what it costs an adversary, not in what it proves. A credential is
 * only as strong as the cheaper of forging one and renting one, because a holder willing to
 * rent defeats any amount of cryptography.
 */

/** Adapter costs are in cents; below this a credential is treated as free. */
const NEGLIGIBLE_COST_CENTS = 10

/** Weight retained by an adapter whose upstream protocol is discontinued. */
const DEAD_PROTOCOL_MULTIPLIER = 0

export interface ScoreInput {
  subjects: Address[]
  name?: string
  adapters: Map<string, Adapter>
  evidence: Evidence[]
  registryRevision?: number
  now?: number
}

/**
 * Age weight from the adapter's curve and half-life.
 *
 * Decay: weight falls with age — a stale selfie or KYC check means less than a fresh one.
 * Ramp: weight RISES with survival — right for vouching registries, where the suspect
 * cohort is by definition the fresh one. PoH took ~95% of its lifetime registrations in a
 * four-month reward window; under Ramp a week-old registration weighs ~0.01 while one that
 * has survived challenge windows for two years approaches full weight. Uniform decay would
 * have given the airdrop cohort full weight and discounted the organic one — exactly
 * backwards.
 *
 * Unknown age: Decay returns 1 (the credential's existence was verified live on-chain, and
 * absence of a date must not silently penalise) but Ramp returns 0.5 — Ramp exists to
 * discount fresh farms, and granting full weight on missing data would make the subgraph
 * being unreachable strictly profitable for an attacker. Both cases are flagged by the
 * issuance-date-unknown caveat.
 */
export function freshnessOf(adapter: Adapter, issuedAt: number | undefined, now: number): number {
  if (!adapter.decayHalfLifeDays || adapter.ageCurve === 'None') return 1
  if (issuedAt === undefined) return adapter.ageCurve === 'Ramp' ? 0.5 : 1
  const ageDays = (now - issuedAt) / 86_400
  if (ageDays <= 0) return adapter.ageCurve === 'Ramp' ? 0 : 1
  const decay = 2 ** (-ageDays / adapter.decayHalfLifeDays)
  return adapter.ageCurve === 'Ramp' ? 1 - decay : decay
}

/**
 * What this credential costs an adversary right now.
 *
 * The `min` of forge and rent is the crux: every protocol that hardened did so against
 * *sale* — World's user-presence check, Idena's identity staking — and none against
 * *rental*, because the human stays willing. Taking the minimum means security work that
 * only addresses sale cannot inflate a score.
 */
export function effectiveCost(adapter: Adapter, freshness: number): number {
  if (!adapter.live) return DEAD_PROTOCOL_MULTIPLIER
  const cheapestAttack = Math.min(adapter.forgeCostCents, adapter.rentCostCents)
  return cheapestAttack * freshness
}

export function score(input: ScoreInput): PersonhoodResult {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const held = input.evidence.filter((e) => e.held)

  // Group by trust root, then saturate: strongest credential wins, the rest are discarded
  // as already-counted evidence.
  const byRoot = new Map<string, Evidence[]>()
  for (const e of held) {
    const bucket = byRoot.get(e.trustRoot)
    if (bucket) bucket.push(e)
    else byRoot.set(e.trustRoot, [e])
  }

  const roots: RootContribution[] = []
  for (const [trustRoot, group] of byRoot) {
    const strongest = group.reduce((a, b) => (b.effectiveCostCents > a.effectiveCostCents ? b : a))
    roots.push({
      trustRoot,
      adapterIds: group.map((e) => e.adapterId),
      contributionCents: strongest.effectiveCostCents,
      saturated: group.length > 1,
    })
  }
  roots.sort((a, b) => b.contributionCents - a.contributionCents)

  const totalCostCents = roots.reduce((sum, r) => sum + r.contributionCents, 0)
  const independentRoots = roots.filter((r) => r.contributionCents >= NEGLIGIBLE_COST_CENTS).length

  // log10 keeps the scale readable and stops one expensive credential from dwarfing
  // everything else. +1 so an empty result is 0 rather than -Infinity.
  const scoreValue = totalCostCents <= 0 ? 0 : Math.log10(totalCostCents + 1)

  return {
    subject: input.subjects[0]!,
    subjects: input.subjects,
    ...(input.name !== undefined ? { name: input.name } : {}),
    score: Number(scoreValue.toFixed(4)),
    totalCostCents,
    independentRoots,
    evidence: input.evidence,
    roots,
    caveats: caveatsFor(input.evidence, roots),
    ...(input.registryRevision !== undefined ? { registryRevision: input.registryRevision } : {}),
    computedAt: now,
    isHuman(threshold: number) {
      if (!Number.isFinite(threshold)) {
        throw new TypeError('isHuman requires an explicit numeric threshold')
      }
      return scoreValue >= threshold
    },
  }
}

function caveatsFor(evidence: Evidence[], roots: RootContribution[]): Caveat[] {
  const caveats: Caveat[] = []

  // Always present, and deliberately not suppressible. Nothing in the roster attests that a
  // verified human acts for themselves rather than as a paid puppet, and the on-chain
  // signature of puppeteering is identical to that of voluntary delegation.
  caveats.push({
    code: 'independent-control-not-attested',
    message:
      'No protocol here proves the subject controls their own credentials. A verified unique human may still be operated by someone else, and that is not detectable from this evidence.',
  })

  for (const r of roots) {
    if (r.saturated) {
      caveats.push({
        code: 'correlated-evidence-saturated',
        message: `${r.adapterIds.length} credentials share the trust root "${r.trustRoot}" (${r.adapterIds.join(', ')}). Counted once — they are one piece of evidence, not ${r.adapterIds.length}.`,
      })
    }
  }

  // Saturation deliberately spans addresses: one passport presented from two wallets is
  // still one passport, so splitting credentials across wallets cannot inflate a score.
  const addressesWithEvidence = new Set(evidence.filter((e) => e.held).map((e) => e.observedOn))
  if (addressesWithEvidence.size > 1) {
    caveats.push({
      code: 'multi-address-subject',
      message: `Evidence aggregated across ${addressesWithEvidence.size} addresses supplied by the caller. Correlated roots still saturate across them, so distributing credentials over wallets does not raise the score.`,
    })
  }

  const dead = evidence.filter((e) => e.held && !e.live)
  if (dead.length) {
    caveats.push({
      code: 'discontinued-protocol',
      message: `Held but scored at zero because the upstream protocol is discontinued: ${dead.map((e) => e.adapterId).join(', ')}.`,
    })
  }

  const unknownAge = evidence.filter((e) => e.held && e.issuedAt === undefined)
  if (unknownAge.length) {
    caveats.push({
      code: 'issuance-date-unknown',
      message: `Issue date unavailable for: ${unknownAge.map((e) => e.adapterId).join(', ')}. Decay-class credentials keep full weight and may be stale; survival-ramp credentials are held at the 0.5 midpoint rather than granted full weight.`,
    })
  }

  const unknownRoot = roots.find((r) => r.trustRoot === 'unknown')
  if (unknownRoot) {
    caveats.push({
      code: 'unresolved-trust-root',
      message: `Evidence from ${unknownRoot.adapterIds.join(', ')} has an unestablished trust root. Scored as independent, but it may in fact be correlated with another credential here.`,
    })
  }

  if (roots.length === 0) {
    caveats.push({
      code: 'no-evidence',
      message:
        'No credentials found. This is an absence of evidence, not evidence of absence — most humans hold none of these.',
    })
  }

  return caveats
}
