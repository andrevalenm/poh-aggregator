import type { Address, Adapter, Caveat } from './types.ts'
import { NEGLIGIBLE_COST_CENTS, effectiveCost } from './scoring.ts'

/**
 * Fleet policy — a counterparty's limits, declared as data and enforced over a set of agents.
 *
 * ## Why a fleet needs its own decision, and why per-agent gating is not it
 *
 * Every gate in this SDK answers a question about *one* subject: does this address hold that
 * credential, and what would faking it cost. A counterparty dealing with agents has a question
 * no per-subject answer reaches — **how many of the requesters in front of me are the same
 * person?** Ten agents each clearing a threshold individually is not ten counterparties; on
 * World Chain today it is routinely one. Measured from AgentBook's own registration log
 * (`agentbook.ts`): 1,164 registered agents over 830 humans, and the largest single fleet is
 * 27 agents registered by one World ID in under a day. A venue counting agents overcounts its
 * counterparties by 40%, and its worst case by 27×.
 *
 * So the unit of policy here is the human, not the agent:
 *
 *   - **`maxAgentsPerHuman`** caps slots per person. Enforced by *allocating* the slots, not by
 *     answering yes/no — a fleet of 27 collapses to N admitted and 27−N denied, and each denial
 *     names the sibling agent that took the slot.
 *   - **`minScore` / `minIndependentRoots`** are the existing personhood line, evaluated **once
 *     per human** rather than once per agent. Evidence belongs to the person, so two agents
 *     behind one human cannot present two different address sets and be scored twice — the
 *     input type keys evidence by `humanId` precisely so that hole cannot be expressed.
 *
 * ## Three properties this engine holds to
 *
 * **A denied agent does not consume its human's slot.** The score gates run before the slot
 * allocation. The other order lets an agent that was going to be refused anyway burn the
 * allowance of a sibling that would have passed, which reads as arbitrary to the operator and
 * is free for the attacker.
 *
 * **An unreadable answer is never a denial, and never an admission.** If AgentBook could not be
 * reached for an agent, we do not know which human it belongs to: admitting it defeats the cap,
 * denying it accuses somebody of something a network failure told us. Those agents come back
 * `indeterminate`, matching the rule the rest of the SDK follows for failed probes.
 *
 * **An unbacked agent is a declared policy choice, not a default.** An agent with no AgentBook
 * registration has no human identifier at all, so `maxAgentsPerHuman` is *unenforceable* against
 * it — counting each one as its own human is exactly how an operator gets unlimited slots. The
 * policy must say which it wants (`unbackedAgents`), and choosing to admit them emits a caveat
 * saying the cap no longer binds.
 *
 * ## The cap has a price, and the price is computable
 *
 * A cap on agents per human is only worth what a second human costs. `priceOfPolicy()` reads the
 * deployed ontology and returns the cheapest set of credentials that clears the policy — the
 * floor under one extra slot. That number, times the number of slots wanted, is what the policy
 * charges an adversary, and it comes from the registry rather than from a slide.
 */

/** How a counterparty wants slots allocated when a human's agents exceed the cap. */
export type FleetAdmission =
  /**
   * The human's oldest registration keeps the slot. Requires `registeredAtBlock` on each agent
   * (AgentBook's log supplies it). Spinning up a fresh agent then never displaces an existing
   * one, so churning wallets buys nothing.
   */
  | 'earliest-registered'
  /** Slots go in the order the caller presented them — a live venue's arrival order. */
  | 'as-presented'

/** What to do with an agent nobody has registered in AgentBook. */
export type UnbackedHandling =
  /** Refuse. The cap cannot be enforced against an agent with no human identifier. */
  | 'deny'
  /**
   * Admit, treating each unbacked agent as its own human. Honest name for failing open: an
   * operator gets one slot per wallet it generates, which is free. Emits a caveat.
   */
  | 'count-as-distinct-human'

export interface FleetPolicy {
  /** Whose policy this is. Appears in the decision so the trace names the party that drew it. */
  name: string
  /** Corroborate score the human behind an agent must reach. */
  minScore: number
  /** Independent trust roots that score must be spread across. */
  minIndependentRoots: number
  /** Agent slots one human may hold at once. */
  maxAgentsPerHuman: number
  unbackedAgents: UnbackedHandling
  admission: FleetAdmission
  /**
   * Refuse agents whose link to their human is only the agent's own say-so.
   *
   * Off by default, because the registry this engine was written against attests every
   * backing it returns: an AgentBook humanId is a nullifier hash out of a World ID proof, and
   * nobody can make one up. It matters the moment a *self-published* binding is admitted —
   * an ENS `corroborate.human` record, say — because then the cap is only as strong as the
   * cost of naming a human, and naming one is free. Turning it on is a counterparty deciding
   * that an unacknowledged claim about a person is not evidence about that person.
   */
  requireAttestedBinding?: boolean
}

/**
 * How the agent↔human link was established.
 *
 * `attested` means the human's own key did something: World ID's `register` carries a proof
 * whose nullifier *is* the humanId, and an ENS mutual binding means the human's name published
 * the agent back. `asserted` means only the agent said so.
 *
 * The distinction is load-bearing rather than descriptive. A cap of N agents per human groups
 * agents by the human they name, so if naming a human is free, an operator names a fresh one
 * per agent and the cap binds nothing while every individual answer stays true. See the header
 * of `ens-agents.ts` for the worked version.
 */
export type BindingStrength = 'attested' | 'asserted'

/** A registry's answer for one agent wallet. */
export type HumanBacking =
  | { status: 'backed'; humanId: string; binding?: BindingStrength; bindingDetail?: string }
  | { status: 'unbacked' }
  /** The read failed. Not a negative — see the header. */
  | { status: 'unknown'; error: string }

export interface FleetAgent {
  agent: Address
  /** Human-readable name for the trace. */
  label?: string
  backing: HumanBacking
  /** Block its AgentBook registration was mined in. Drives `earliest-registered` admission. */
  registeredAtBlock?: number
}

/**
 * One human's personhood evidence, keyed by human rather than by agent.
 *
 * Deliberately the shape of a `PersonhoodResult` projection rather than the result itself: the
 * engine needs the score, the roots and nothing else, and taking the whole result would invite
 * callers to pass a per-agent one.
 */
export interface HumanEvidence {
  score: number
  independentRoots: number
  /** Trust roots that carried weight, for the trace. */
  roots?: string[]
  /** The addresses this was resolved over, for the trace. */
  subjects?: readonly Address[]
  /** Set when personhood could not be resolved at all. Produces `indeterminate`, never a deny. */
  error?: string
}

export type Verdict = 'allow' | 'deny' | 'indeterminate'

export interface RuleOutcome {
  rule:
    | 'human-identified'
    | 'human-binding'
    | 'evidence-resolved'
    | 'min-score'
    | 'min-independent-roots'
    | 'max-agents-per-human'
  /** `null` when the rule could not be evaluated, which is different from failing it. */
  pass: boolean | null
  detail: string
}

export interface AgentVerdict {
  agent: Address
  label?: string
  /** The human this agent belongs to, when one was established. */
  humanId?: string
  verdict: Verdict
  because: string
  rules: RuleOutcome[]
}

export interface HumanVerdict {
  humanId: string
  /** True when this "human" is a synthetic identity for an unbacked agent. */
  synthetic: boolean
  agents: Address[]
  admitted: Address[]
  denied: Address[]
  evidence?: HumanEvidence
}

export interface FleetSummary {
  agents: number
  /** Humans actually identified in AgentBook. Synthetic unbacked identities are not counted. */
  humans: number
  unbacked: number
  unresolved: number
  allowed: number
  denied: number
  /**
   * Denied *by the cap* — refused only because a sibling holds the slot. Separated from
   * `denied` because "refused as a fleet" and "refused on evidence" are different claims about
   * a person, and reporting a score failure as a fleet detection would be an accusation.
   */
  deniedByCap: number
  indeterminate: number
  /** Most agents any one human presented. */
  largestFleet: number
  /**
   * Agents whose human is named only by the agent itself. Under a policy that admits them the
   * cap is soft by exactly this many agents, since each could have named a fresh human.
   */
  assertedBindings: number
  /**
   * Agents per identified human. The number a venue counting requesters gets wrong: 1.0 means
   * agent count and human count agree, 27.0 means it is off by 27×.
   */
  collapseRatio: number
}

export interface FleetDecision {
  policy: FleetPolicy
  agents: AgentVerdict[]
  humans: HumanVerdict[]
  summary: FleetSummary
  caveats: Caveat[]
}

export interface EvaluateFleetInput {
  policy: FleetPolicy
  agents: readonly FleetAgent[]
  /**
   * Personhood evidence per human, keyed by `humanId`. An unbacked agent admitted under
   * `count-as-distinct-human` is keyed `unbacked:<agent lowercased>`.
   */
  evidence: ReadonlyMap<string, HumanEvidence>
}

const syntheticKey = (agent: Address) => `unbacked:${agent.toLowerCase()}`

/**
 * Apply a fleet policy to a set of agents. Pure — no I/O, so every branch is unit testable.
 *
 * Order of operations is the design, not an implementation detail. Identity, then evidence,
 * then the score line, and only then the slot allocation, so that an agent refused on evidence
 * never spends the allowance of a sibling that would have passed.
 */
export function evaluateFleet(input: EvaluateFleetInput): FleetDecision {
  const { policy, agents, evidence } = input

  // ---- 1. group agents by the human behind them --------------------------------------
  const groups = new Map<string, { synthetic: boolean; agents: FleetAgent[] }>()
  const verdicts = new Map<Address, AgentVerdict>()
  const order: Address[] = []

  for (const a of agents) {
    order.push(a.agent)
    const v: AgentVerdict = {
      agent: a.agent,
      ...(a.label !== undefined ? { label: a.label } : {}),
      verdict: 'indeterminate',
      because: '',
      rules: [],
    }
    verdicts.set(a.agent, v)

    if (a.backing.status === 'backed') {
      v.humanId = a.backing.humanId
      v.rules.push({
        rule: 'human-identified',
        pass: true,
        // Source-neutral: this engine is fed by AgentBook's proof-derived identifiers and by
        // ENS's self-published ones, and naming the wrong registry in a trace is a lie about
        // where a fact came from. Which registry, and how strongly, is the next rule's job.
        detail: `attributed to human ${short(a.backing.humanId)}`,
      })
      bucket(groups, a.backing.humanId, false).agents.push(a)
      continue
    }

    if (a.backing.status === 'unknown') {
      v.rules.push({
        rule: 'human-identified',
        pass: null,
        detail: `human-backing unreadable: ${a.backing.error}`,
      })
      v.verdict = 'indeterminate'
      v.because =
        'could not establish which human registered this agent, so the per-human cap cannot be applied — refusing to guess in either direction'
      continue
    }

    // Unbacked. The cap is unenforceable here whatever we decide, so the policy has to say.
    if (policy.unbackedAgents === 'deny') {
      v.rules.push({
        rule: 'human-identified',
        pass: false,
        detail: 'no AgentBook registration: lookupHuman returned 0',
      })
      v.verdict = 'deny'
      v.because = `no human has registered this agent, and ${policy.name} does not admit agents it cannot attribute to a person`
      continue
    }
    v.rules.push({
      rule: 'human-identified',
      pass: false,
      detail: 'no AgentBook registration; admitted as its own human under policy.unbackedAgents',
    })
    bucket(groups, syntheticKey(a.agent), true).agents.push(a)
  }

  // ---- 2. evidence and score gates, per human ----------------------------------------
  // Evaluated once for the human and stamped onto each of their agents. An agent cannot carry
  // its own score: the credentials belong to the person, not to the wallet they registered.
  const humans: HumanVerdict[] = []

  for (const [humanId, group] of groups) {
    const ev = evidence.get(humanId)
    const passing: FleetAgent[] = []

    for (const a of group.agents) {
      const v = verdicts.get(a.agent)!

      // Binding strength is checked before anything is spent on this agent, and before the
      // slot allocation, so an agent refused for an unacknowledged claim never burns the
      // allowance of a sibling that would have passed — the same ordering rule the score
      // gates follow.
      const binding = a.backing.status === 'backed' ? (a.backing.binding ?? 'attested') : undefined
      if (binding !== undefined) {
        const detail =
          a.backing.status === 'backed' && a.backing.bindingDetail
            ? a.backing.bindingDetail
            : binding === 'attested'
              ? 'the human identifier came from a proof, not from a claim'
              : 'only the agent asserts this human'
        if (binding === 'asserted' && policy.requireAttestedBinding) {
          v.rules.push({ rule: 'human-binding', pass: false, detail })
          v.verdict = 'deny'
          v.because = `the human behind this agent has not acknowledged it (${detail}), and ${policy.name} does not admit one-way claims about a person`
          continue
        }
        v.rules.push({ rule: 'human-binding', pass: binding === 'attested' ? true : null, detail })
      }

      if (!ev || ev.error !== undefined) {
        v.rules.push({
          rule: 'evidence-resolved',
          pass: null,
          detail: ev?.error ?? 'no personhood evidence supplied for this human',
        })
        v.verdict = 'indeterminate'
        v.because = `personhood could not be resolved for the human behind this agent: ${ev?.error ?? 'no evidence supplied'}`
        continue
      }
      v.rules.push({
        rule: 'evidence-resolved',
        pass: true,
        detail: `score ${ev.score} across ${ev.independentRoots} independent root(s)${
          ev.roots?.length ? ` (${ev.roots.join(', ')})` : ''
        }`,
      })

      const scoreOk = ev.score >= policy.minScore
      v.rules.push({
        rule: 'min-score',
        pass: scoreOk,
        detail: `${ev.score} ${scoreOk ? '≥' : '<'} ${policy.minScore}`,
      })
      const rootsOk = ev.independentRoots >= policy.minIndependentRoots
      v.rules.push({
        rule: 'min-independent-roots',
        pass: rootsOk,
        detail: `${ev.independentRoots} ${rootsOk ? '≥' : '<'} ${policy.minIndependentRoots} required`,
      })

      if (!scoreOk || !rootsOk) {
        v.verdict = 'deny'
        v.because = !scoreOk
          ? `score ${ev.score} < ${policy.minScore}`
          : `${ev.independentRoots} independent root(s) < ${policy.minIndependentRoots} required`
        continue
      }
      passing.push(a)
    }

    // ---- 3. slot allocation, over the agents that got this far -----------------------
    const queue = admissionOrder(passing, policy.admission, order)
    const admitted: FleetAgent[] = []
    for (const a of queue) {
      const v = verdicts.get(a.agent)!
      if (admitted.length < policy.maxAgentsPerHuman) {
        admitted.push(a)
        v.rules.push({
          rule: 'max-agents-per-human',
          pass: true,
          detail: `slot ${admitted.length} of ${policy.maxAgentsPerHuman} for human ${short(humanId)}`,
        })
        v.verdict = 'allow'
        v.because = `score ${evidence.get(humanId)!.score} ≥ ${policy.minScore} across ${
          evidence.get(humanId)!.independentRoots
        } independent root(s), and this human holds ${admitted.length} of ${policy.maxAgentsPerHuman} permitted agent slot(s)`
        continue
      }
      const takenBy = admitted.map((x) => x.label ?? x.agent).join(', ')
      v.rules.push({
        rule: 'max-agents-per-human',
        pass: false,
        detail: `human ${short(humanId)} already holds ${policy.maxAgentsPerHuman} of ${policy.maxAgentsPerHuman} slot(s), taken by ${takenBy}`,
      })
      v.verdict = 'deny'
      v.because = `the human behind this agent already holds ${policy.maxAgentsPerHuman} agent slot(s) (${takenBy}) — a fleet of ${group.agents.length} agents is still one human`
    }

    humans.push({
      humanId,
      synthetic: group.synthetic,
      agents: group.agents.map((a) => a.agent),
      admitted: admitted.map((a) => a.agent),
      denied: group.agents.filter((a) => verdicts.get(a.agent)!.verdict !== 'allow').map((a) => a.agent),
      ...(ev ? { evidence: ev } : {}),
    })
  }

  // ---- 4. summary and caveats ---------------------------------------------------------
  const all = order.map((a) => verdicts.get(a)!)
  const realHumans = humans.filter((h) => !h.synthetic)
  const unbacked = agents.filter((a) => a.backing.status === 'unbacked').length
  const unresolved = agents.filter((a) => a.backing.status === 'unknown').length
  const attributed = agents.length - unbacked - unresolved
  const largestFleet = realHumans.reduce((m, h) => Math.max(m, h.agents.length), 0)
  const assertedBindings = agents.filter(
    (a) => a.backing.status === 'backed' && a.backing.binding === 'asserted',
  ).length

  const summary: FleetSummary = {
    agents: agents.length,
    humans: realHumans.length,
    unbacked,
    unresolved,
    allowed: all.filter((v) => v.verdict === 'allow').length,
    denied: all.filter((v) => v.verdict === 'deny').length,
    deniedByCap: all.filter(
      (v) =>
        v.verdict === 'deny' &&
        v.rules.some((r) => r.rule === 'max-agents-per-human' && r.pass === false),
    ).length,
    indeterminate: all.filter((v) => v.verdict === 'indeterminate').length,
    largestFleet,
    assertedBindings,
    collapseRatio: realHumans.length === 0 ? 0 : round(attributed / realHumans.length, 2),
  }

  const caveats: Caveat[] = []
  if (unbacked > 0 && policy.unbackedAgents === 'count-as-distinct-human') {
    caveats.push({
      code: 'fleet-cap-not-enforceable-on-unbacked-agents',
      message: `${unbacked} agent(s) have no AgentBook registration and this policy counts each as its own human. The per-human cap does not bind them: an operator gets one slot per wallet it generates, and generating a wallet is free.`,
    })
  }
  // An evidence map that names humans this batch does not contain, while agents in this batch
  // went unjudged for want of evidence, is a caller bug rather than a fact about the world —
  // most often the same identifier encoded two ways. It is worth a caveat because the failure
  // is otherwise indistinguishable from an honest lookup miss, and it degrades silently in the
  // permissive direction: nobody is refused, so nothing looks wrong.
  const missingEvidence = all.some((v) =>
    v.rules.some((r) => r.rule === 'evidence-resolved' && r.pass === null),
  )
  const unmatchedKeys = [...evidence.keys()].filter((k) => !groups.has(k))
  if (missingEvidence && unmatchedKeys.length) {
    caveats.push({
      code: 'fleet-evidence-keys-unmatched',
      message: `Evidence was supplied for ${unmatchedKeys.length} identifier(s) that no agent in this batch belongs to (${unmatchedKeys
        .map(short)
        .join(', ')}), while other agents were left unjudged for want of evidence. The evidence map is keyed on the same humanId the registry returns; check the two are encoded the same way.`,
    })
  }

  if (unresolved > 0) {
    caveats.push({
      code: 'fleet-membership-unresolved',
      message: `${unresolved} agent(s) could not be attributed to a human because the registry read failed. They are neither admitted nor refused. Re-run before treating this decision as complete — a fleet is only bounded if every member was identified.`,
    })
  }
  if (policy.admission === 'earliest-registered' && agents.some((a) => a.registeredAtBlock === undefined)) {
    caveats.push({
      code: 'fleet-admission-order-degraded',
      message:
        'This policy allocates slots to the earliest registration, but some agents were supplied without a registration block. Those fall back to the order they were presented in, so which sibling keeps the slot depends on the caller rather than on the chain.',
    })
  }
  if (assertedBindings > 0 && !policy.requireAttestedBinding) {
    caveats.push({
      code: 'fleet-cap-soft-on-asserted-bindings',
      message: `${assertedBindings} agent(s) name a human who has not acknowledged them, and this policy admits one-way claims. The cap groups agents by the human they name, so an operator naming a fresh identifier per agent holds one slot each — and each such agent may also be riding credentials its named human never lent it. requireAttestedBinding refuses them.`,
    })
  }
  if (largestFleet > policy.maxAgentsPerHuman) {
    caveats.push({
      code: 'fleet-detected',
      message: `One human presented ${largestFleet} agents against a cap of ${policy.maxAgentsPerHuman}. Counting requesters would have counted ${largestFleet}; counting humans counts one.`,
    })
  }
  caveats.push({
    code: 'fleet-bounded-only-within-one-registry',
    message:
      'Agents are grouped by the identifier one registry hands out. The same person registering in a different registry, or holding a second identity there, is a different identifier and is not detectable here.',
  })

  return { policy, agents: all, humans, summary, caveats }
}

function bucket(
  groups: Map<string, { synthetic: boolean; agents: FleetAgent[] }>,
  key: string,
  synthetic: boolean,
) {
  let g = groups.get(key)
  if (!g) {
    g = { synthetic, agents: [] }
    groups.set(key, g)
  }
  return g
}

/**
 * Whichever order slots are handed out in has to be deterministic and stated, because it decides
 * which of a human's agents keeps working. `earliest-registered` ties break on the presented
 * order, and an agent with no registration block sorts last rather than first — an unknown age
 * must not outrank a known one.
 */
function admissionOrder(
  agents: readonly FleetAgent[],
  mode: FleetAdmission,
  presented: readonly Address[],
): FleetAgent[] {
  if (mode === 'as-presented') return [...agents]
  const pos = new Map(presented.map((a, i) => [a, i]))
  return [...agents].sort((a, b) => {
    const ab = a.registeredAtBlock ?? Number.POSITIVE_INFINITY
    const bb = b.registeredAtBlock ?? Number.POSITIVE_INFINITY
    if (ab !== bb) return ab - bb
    return (pos.get(a.agent) ?? 0) - (pos.get(b.agent) ?? 0)
  })
}

const short = (id: string) => (id.length > 14 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id)
const round = (n: number, dp: number) => Number(n.toFixed(dp))

// ---------------------------------------------------------------------------------------
// What the policy costs an adversary
// ---------------------------------------------------------------------------------------

export interface PricedRoot {
  trustRoot: string
  /** Cheapest readable adapter on that root. */
  adapterId: string
  costCents: number
}

export interface PolicyPrice {
  /** Cheapest total, in cents, that clears both the score line and the root count. */
  cheapestSlotCents: number
  /** The credentials that make up that total. */
  roots: PricedRoot[]
  /** False when no combination of readable credentials clears the policy at all. */
  feasible: boolean
  /** Roots considered — live, readable, and priced above zero. */
  candidates: PricedRoot[]
  /** Set when the search space was too large to enumerate exhaustively. */
  approximate?: boolean
  reason: string
}

export interface PriceOfPolicyInput {
  adapters: ReadonlyMap<string, Adapter> | readonly Adapter[]
  minScore: number
  minIndependentRoots: number
  /**
   * Adapter ids this deployment can actually read. An adversary cannot clear *our* score with a
   * credential we have no probe for, so pricing against the whole ontology would quote a floor
   * nobody can reach and understate what the policy really costs. Omit to price the whole
   * ontology, which is only right if every adapter is implemented.
   */
  readableAdapterIds?: readonly string[]
  /**
   * Roots every slot needs regardless of the score, because some other gate demands them. A
   * venue that requires AgentBook registration is requiring a World ID, so its floor includes
   * `iris-registry:world-orb` whether or not the cheapest scoring set would have picked it.
   */
  mustInclude?: readonly string[]
}

/** Beyond this many candidate roots we stop enumerating subsets and fall back to greedy. */
const EXHAUSTIVE_ROOT_LIMIT = 20

/**
 * The floor under one slot: the cheapest credentials an adversary can hold that clear this
 * policy, priced from the deployed registry.
 *
 * Two deliberate choices, both in the direction of understating our own security rather than
 * overstating it. Credentials are priced at **full freshness**, which for a survival ramp means
 * the adversary sources an aged registration rather than minting one — the cheapest case for
 * them. And costs are `min(forge, rent)` throughout, the same rule the scorer uses, because a
 * holder willing to rent defeats any amount of cryptography.
 *
 * Saturation is what makes the number meaningful: one credential per root, since a second
 * credential on a root already held adds nothing to the score. So the adversary's bill is a set
 * of *distinct* roots, which is exactly the quantity `minIndependentRoots` names.
 */
export function priceOfPolicy(input: PriceOfPolicyInput): PolicyPrice {
  const list = Array.isArray(input.adapters)
    ? (input.adapters as readonly Adapter[])
    : [...(input.adapters as ReadonlyMap<string, Adapter>).values()]
  const readable = input.readableAdapterIds ? new Set(input.readableAdapterIds) : undefined
  const mustInclude = [...new Set(input.mustInclude ?? [])]

  // Cheapest readable adapter on each root, at full freshness. `effectiveCost` zeroes
  // discontinued protocols, so a dead adapter drops out here rather than being special-cased.
  const byRoot = new Map<string, PricedRoot>()
  for (const a of list) {
    if (readable && !readable.has(a.id)) continue
    const cost = effectiveCost(a, 1)
    if (cost <= 0) continue
    const current = byRoot.get(a.trustRoot)
    if (!current || cost < current.costCents) {
      byRoot.set(a.trustRoot, { trustRoot: a.trustRoot, adapterId: a.id, costCents: cost })
    }
  }
  const candidates = [...byRoot.values()].sort((a, b) => a.costCents - b.costCents)

  // The scorer's own arithmetic, inverted: score = log10(totalCents + 1), and a root counts
  // toward independentRoots only once it carries at least NEGLIGIBLE_COST_CENTS.
  const targetCents = Math.max(0, 10 ** input.minScore - 1)

  const missing = mustInclude.filter((r) => !byRoot.has(r))
  if (missing.length) {
    return {
      cheapestSlotCents: 0,
      roots: [],
      feasible: false,
      candidates,
      reason: `no readable, live credential exists on required trust root(s) ${missing.join(', ')}, so this policy cannot be cleared by anyone — including an honest subject`,
    }
  }

  const forced = new Set(mustInclude)
  const free = candidates.filter((c) => !forced.has(c.trustRoot))
  const forcedRoots = candidates.filter((c) => forced.has(c.trustRoot))

  if (free.length > EXHAUSTIVE_ROOT_LIMIT) {
    const greedy = greedyClear(forcedRoots, free, targetCents, input.minIndependentRoots)
    return {
      ...greedy,
      candidates,
      approximate: true,
      reason: `${free.length} candidate roots is past the exhaustive limit of ${EXHAUSTIVE_ROOT_LIMIT}; this is a greedy upper bound on the cheapest slot, not the minimum`,
    }
  }

  let best: PricedRoot[] | undefined
  let bestCost = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const chosen = [...forcedRoots]
    let total = forcedRoots.reduce((s, r) => s + r.costCents, 0)
    for (let i = 0; i < free.length; i++) {
      if (mask & (1 << i)) {
        const r = free[i]!
        chosen.push(r)
        total += r.costCents
      }
    }
    if (total >= bestCost) continue
    if (total < targetCents) continue
    if (chosen.filter((r) => r.costCents >= NEGLIGIBLE_COST_CENTS).length < input.minIndependentRoots) continue
    best = chosen
    bestCost = total
  }

  if (!best) {
    return {
      cheapestSlotCents: 0,
      roots: [],
      feasible: false,
      candidates,
      reason: `no combination of the ${candidates.length} readable trust roots reaches score ${input.minScore} across ${input.minIndependentRoots} roots — this policy denies everybody`,
    }
  }

  best.sort((a, b) => b.costCents - a.costCents)
  return {
    cheapestSlotCents: bestCost,
    roots: best,
    feasible: true,
    candidates,
    reason: `cheapest readable credential set clearing score ${input.minScore} across ${input.minIndependentRoots} independent root(s), priced at min(forge, rent) and full freshness`,
  }
}

/** Fallback for an ontology too wide to enumerate: cheapest-first until both limits are met. */
function greedyClear(
  forced: PricedRoot[],
  free: PricedRoot[],
  targetCents: number,
  minRoots: number,
): Omit<PolicyPrice, 'candidates' | 'reason'> {
  const chosen = [...forced]
  let total = forced.reduce((s, r) => s + r.costCents, 0)
  for (const r of free) {
    if (total >= targetCents && chosen.filter((c) => c.costCents >= NEGLIGIBLE_COST_CENTS).length >= minRoots) break
    chosen.push(r)
    total += r.costCents
  }
  const ok =
    total >= targetCents && chosen.filter((c) => c.costCents >= NEGLIGIBLE_COST_CENTS).length >= minRoots
  return {
    cheapestSlotCents: ok ? total : 0,
    roots: ok ? chosen.sort((a, b) => b.costCents - a.costCents) : [],
    feasible: ok,
  }
}

/**
 * What it costs an adversary to hold `slots` agent slots under this policy.
 *
 * The composition is the point of a per-human cap: slots come in batches of
 * `maxAgentsPerHuman`, and each batch needs a whole new human, credentials and all. Without the
 * cap the marginal agent costs a keypair.
 */
export function costOfSlots(price: PolicyPrice, policy: FleetPolicy, slots: number): {
  slots: number
  humansRequired: number
  totalCents: number
  marginalCentsPerAgent: number
} {
  const humansRequired = Math.ceil(Math.max(0, slots) / Math.max(1, policy.maxAgentsPerHuman))
  const totalCents = humansRequired * price.cheapestSlotCents
  return {
    slots,
    humansRequired,
    totalCents,
    marginalCentsPerAgent: slots === 0 ? 0 : round(totalCents / slots, 2),
  }
}
