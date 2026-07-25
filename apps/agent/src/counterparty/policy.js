/**
 * The counterparty's policy.
 *
 * Every number in this file belongs to the counterparty, not to Print and not to
 * World. That separation is the whole architectural claim of this demo: the verification
 * layer returns evidence, and the party bearing the loss picks the line.
 *
 * The SDK enforces this in its type system — `result.isHuman(threshold)` throws if you do
 * not pass a threshold. There is no default to inherit and no way to accidentally ship
 * someone else's risk appetite. The reason is base rates: at a plausible 2% sybil rate a
 * 95%-specificity classifier is wrong about roughly three-quarters of the subjects it flags.
 * A vendor cannot own that decision on your behalf.
 *
 * The policy is **declared as data and executed by `evaluateFleet()` in the SDK**, not
 * re-implemented here. That matters more than it sounds: the limits below are the same object
 * the engine's unit tests exercise, so "our demo enforces this" and "this is tested" are the
 * same statement.
 *
 * "Meridian Exchange" below is a fictional counterparty invented for this demo. The policy
 * it holds is the realistic part.
 */

/** @type {import('@print/sdk').FleetPolicy} */
export const fleetPolicy = {
  name: 'Meridian Exchange',

  /**
   * The threshold, in Print score units (log10 of adversary cost in cents).
   *
   * 2.5 means: an attacker must spend on the order of $3 in credential rent per fake
   * operator, spread across independent trust roots. Chosen because Meridian's per-agent
   * exposure is capped at a few dollars of fee credit, so anything that costs more to fake
   * than it can extract is not worth faking. A venue clearing six figures per agent would
   * pick 3.5 and accept the false negatives.
   */
  minScore: 2.5,

  /**
   * Independent trust roots required, on top of the score.
   *
   * A score can be reached by one expensive credential. Meridian wants corroboration from
   * evidence that could not have come from the same document, the same biometric or the same
   * vouching graph — because correlated failure is the failure mode that actually happens.
   */
  minIndependentRoots: 2,

  /**
   * Agent slots per *human*, not per agent wallet.
   *
   * AgentBook hands out one identifier per World ID, so a budget keyed on the human survives
   * an operator spawning a fleet; keyed on the agent wallet it would not. This is not
   * hypothetical: AgentBook's own registration log holds 1,164 agents over 830 humans, and one
   * human has registered 27 of them. A venue counting requesters is off by 40% on average and
   * by 27× at the tail.
   *
   * The cap is enforced over every agent the human has **registered**, not only over the ones
   * that have asked. A venue that waits to be asked has already served the fleet's first N by
   * the time it notices; the registry says so in advance, and reading it is one scan.
   */
  maxAgentsPerHuman: 1,

  /**
   * What to do with an agent nobody registered.
   *
   * `deny`, because the cap above is *unenforceable* against an agent with no human
   * identifier: counting each one as its own human hands an operator one slot per keypair it
   * generates, and generating a keypair is free. The SDK will admit them if a policy asks
   * (`count-as-distinct-human`) and attaches a caveat saying the cap no longer binds — the
   * choice has to be stated, not defaulted into.
   */
  unbackedAgents: 'deny',

  /**
   * Which of a human's agents keeps the slot.
   *
   * `earliest-registered`: the oldest registration wins, and AgentBook's log decides which
   * that is. Under `as-presented` an operator regains a slot by racing a fresh wallet to the
   * front of the queue; under this rule spinning up a new agent never displaces an old one.
   */
  admission: 'earliest-registered',
}

/**
 * The trust root every slot needs regardless of the score, because another gate demands it.
 *
 * Meridian requires AgentBook registration, and registering requires a World ID group-1 (Orb)
 * proof — so an adversary's cheapest slot includes the Orb root whether or not the cheapest
 * *scoring* set would have chosen it. Used only to price the policy; enforcement of the Orb
 * requirement is gate 2, on chain.
 */
export const GATE_TRUST_ROOTS = ['iris-registry:world-orb']

/**
 * Whether a live World ID proof is demanded in addition to AgentBook registration.
 *
 * Off for the demo, because it needs a human in the loop. `npm run worldid` runs it
 * standalone. Turning it on is the right call for a venue moving real money: registration
 * proves a human acted once, a fresh proof proves a human is acting now.
 */
export const requireLiveWorldIdProof = false

/** Kept for the trace header and the closing copy. */
export const counterparty = {
  name: fleetPolicy.name,
  what: 'a settlement venue that lets agents place orders on behalf of their operators',
}

/**
 * Caveats Meridian is required to record even when it accepts.
 *
 * These are Meridian's, not Print's — they are facts about what Meridian did and did
 * not check, and they sit alongside the caveats the SDK returns.
 */
export const COUNTERPARTY_CAVEATS = {
  addressSetUnauthenticated: {
    code: 'address-set-not-authenticated',
    message:
      'The operator address set was accepted as asserted. This demo does not make the operator sign for each address, so nothing here shows the agent\'s operator controls these wallets. In production this is the counterparty\'s job and it is a signature check, not a lookup. It cannot be replaced by reading the chain: AgentBook and the World ID Address Book issue nullifiers under different external nullifiers, so the same person is two unlinkable identifiers across them by design.',
  },
  signatureNotExercised: {
    code: 'agent-signature-not-exercised',
    message:
      'We do not hold this agent\'s private key, so no CAIP-122 signature was verified for this request. The wallet\'s human-backing was read from live World Chain state. Set AGENT_PRIVATE_KEY to a wallet you registered yourself to exercise this gate.',
  },
  worldIdProofNotRequested: {
    code: 'live-worldid-proof-not-requested',
    message:
      'Human-backing was established from AgentBook registration, which proves a World ID human registered this wallet at some point — not that one is present now. Run `npm run worldid` for the live World ID 4.0 proof flow.',
  },
  evidenceResolvedOncePerHuman: {
    code: 'fleet-evidence-resolved-once-per-human',
    message:
      'Personhood was resolved for the human behind this agent, not for the agent, and the same result governs every agent that human registered. That is deliberate — credentials belong to the person — but it means the address set was declared by whichever of their agents asked first.',
  },
}
