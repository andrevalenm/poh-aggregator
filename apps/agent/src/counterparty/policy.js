/**
 * The counterparty's policy.
 *
 * Every number in this file belongs to the counterparty, not to Corroborate and not to
 * World. That separation is the whole architectural claim of this demo: the verification
 * layer returns evidence, and the party bearing the loss picks the line.
 *
 * The SDK enforces this in its type system — `result.isHuman(threshold)` throws if you do
 * not pass a threshold. There is no default to inherit and no way to accidentally ship
 * someone else's risk appetite. The reason is base rates: at a plausible 2% sybil rate a
 * 95%-specificity classifier is wrong about roughly three-quarters of the subjects it flags.
 * A vendor cannot own that decision on your behalf.
 *
 * "Meridian Exchange" below is a fictional counterparty invented for this demo. The policy
 * it holds is the realistic part.
 */

export const counterparty = {
  name: 'Meridian Exchange',
  what: 'a settlement venue that lets agents place orders on behalf of their operators',

  /**
   * The threshold, in Corroborate score units (log10 of adversary cost in cents).
   *
   * 2.5 means: an attacker must spend on the order of $3 in credential rent per fake
   * operator, spread across independent trust roots. Chosen because Meridian's per-agent
   * exposure is capped at a few dollars of fee credit, so anything that costs more to fake
   * than it can extract is not worth faking. A venue clearing six figures per agent would
   * pick 3.5 and accept the false negatives.
   */
  scoreThreshold: 2.5,

  /**
   * Independent trust roots required, on top of the score.
   *
   * A score can be reached by one expensive credential. Meridian wants corroboration from
   * evidence that could not have come from the same document, the same biometric or the same
   * vouching graph — because correlated failure is the failure mode that actually happens.
   */
  minIndependentRoots: 2,

  /**
   * Whether a live World ID proof is demanded in addition to AgentBook registration.
   *
   * Off for the demo, because it needs a human in the loop. `npm run worldid` runs it
   * standalone. Turning it on is the right call for a venue moving real money: registration
   * proves a human acted once, a fresh proof proves a human is acting now.
   */
  requireLiveWorldIdProof: false,

  /**
   * Requests permitted per *human*, not per agent.
   *
   * AgentBook returns the same human identifier for every agent one person registers, so a
   * budget keyed on the human survives an operator spawning a fleet. Keyed on the agent
   * wallet it would not. AgentKit's own free-trial counters work the same way, for the same
   * reason.
   */
  requestsPerHuman: 1,
}

/**
 * Caveats Meridian is required to record even when it accepts.
 *
 * These are Meridian's, not Corroborate's — they are facts about what Meridian did and did
 * not check, and they sit alongside the caveats the SDK returns.
 */
export const COUNTERPARTY_CAVEATS = {
  addressSetUnauthenticated: {
    code: 'address-set-not-authenticated',
    message:
      'The operator address set was accepted as asserted. This demo does not make the operator sign for each address, so nothing here shows the agent\'s operator controls these wallets. In production this is the counterparty\'s job and it is a signature check, not a lookup.',
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
}
