/**
 * The counterparty's decision procedure.
 *
 * Four gates, in order, each answering a different question. The order matters: each gate is
 * cheaper than the next and rules out a distinct class of counterparty.
 *
 *   1. IDENTITY      Does the requester control the wallet it claims?      (signature)
 *   2. HUMAN-BACKING Did a World ID human register that wallet?            (AgentBook, on-chain)
 *   3. EVIDENCE      What independent evidence backs that human?           (Corroborate)
 *   4. DECISION      Does that clear the line this counterparty drew?      (policy)
 *
 * Gate 1 without gate 2 is a bot with a keypair. Gate 2 without gate 1 is a claim anyone can
 * make about anyone. Gates 1 and 2 without gate 3 is a single credential with a single point
 * of failure. And none of them, at any strength, establishes that the human is *operating*
 * the agent rather than having been paid to register it once — which is why gate 4 records
 * the caveat rather than resolving it.
 */

import { lookupHumanBacking } from '../world/agentbook.js'
import { resolveHumanBacking } from './corroborate.js'
import { counterparty, COUNTERPARTY_CAVEATS } from './policy.js'

/** Per-human request budget. Keyed on the human, never on the agent — see policy.js. */
const humanBudget = new Map()

export function resetBudget() {
  humanBudget.clear()
}

/**
 * @param {Object} input
 * @param {string} input.agentName
 * @param {string} input.agentAddress
 * @param {string[]} input.operatorAddresses
 * @param {Object=} input.identity   Result of the signature gate, if it ran.
 * @param {string=} input.note
 */
export async function decide({ agentName, agentAddress, operatorAddresses, identity, note }) {
  const trace = {
    counterparty: counterparty.name,
    agent: { name: agentName, address: agentAddress, note },
    gates: [],
    caveats: [],
    policy: {
      scoreThreshold: counterparty.scoreThreshold,
      minIndependentRoots: counterparty.minIndependentRoots,
      requestsPerHuman: counterparty.requestsPerHuman,
      owner: counterparty.name,
    },
  }

  // ---------------------------------------------------------------- gate 1: identity
  if (identity?.verified) {
    trace.gates.push({
      n: 1,
      name: 'Agent identity',
      question: 'Does the requester control the wallet it claims?',
      pass: true,
      how: 'CAIP-122/SIWE signature over a challenge bound to this resource, verified with @worldcoin/agentkit',
      detail: {
        recovered: identity.address,
        chainId: identity.chainId,
        signatureType: identity.type,
        boundTo: identity.uri,
        issuedAt: identity.issuedAt,
        nonce: identity.nonce,
        replayChecked: true,
      },
    })
  } else if (identity?.error) {
    trace.gates.push({
      n: 1,
      name: 'Agent identity',
      question: 'Does the requester control the wallet it claims?',
      pass: false,
      how: 'CAIP-122/SIWE signature verification',
      detail: { error: identity.error },
    })
    trace.decision = { allow: false, because: `signature rejected: ${identity.error}` }
    return trace
  } else {
    trace.gates.push({
      n: 1,
      name: 'Agent identity',
      question: 'Does the requester control the wallet it claims?',
      pass: null,
      how: 'not exercised — private key not held by this demo',
      detail: { address: agentAddress },
    })
    trace.caveats.push(COUNTERPARTY_CAVEATS.signatureNotExercised)
  }

  // ------------------------------------------------------------ gate 2: human-backing
  const backing = await lookupHumanBacking(agentAddress)
  trace.gates.push({
    n: 2,
    name: 'Human-backing',
    question: 'Did a World ID-verified human register this wallet?',
    pass: backing.status === 'backed',
    how: backing.source,
    detail:
      backing.status === 'backed'
        ? { humanId: backing.humanId, meaning: 'anonymous, stable across every agent this human registers' }
        : backing.status === 'unknown'
          ? { error: backing.error, note: 'transport failure — not treated as a negative' }
          : { humanId: null, note: 'lookupHuman returned 0: no human has registered this wallet' },
  })

  if (backing.status !== 'backed') {
    trace.decision = {
      allow: false,
      because:
        backing.status === 'unknown'
          ? 'could not reach World Chain to establish human-backing; refusing to guess'
          : 'no human has registered this agent in AgentBook',
    }
    return trace
  }

  if (!counterparty.requireLiveWorldIdProof) {
    trace.caveats.push(COUNTERPARTY_CAVEATS.worldIdProofNotRequested)
  }

  // ------------------------------------------------------- gate 2b: per-human budget
  const used = humanBudget.get(backing.humanId) ?? 0
  const budgetOk = used < counterparty.requestsPerHuman
  trace.gates.push({
    n: 2.5,
    name: 'Per-human budget',
    question: 'Has this human already spent their allowance through another agent?',
    pass: budgetOk,
    how: `counter keyed on humanId, limit ${counterparty.requestsPerHuman}`,
    detail: { humanId: backing.humanId, used, limit: counterparty.requestsPerHuman },
  })
  if (!budgetOk) {
    trace.decision = {
      allow: false,
      because: `this human already used their allowance through a different agent wallet — a fleet of agents is still one human`,
    }
    return trace
  }
  humanBudget.set(backing.humanId, used + 1)

  // ------------------------------------------------------------------ gate 3: evidence
  const { result, addresses } = await resolveHumanBacking({ agentAddress, operatorAddresses })
  trace.addressSet = addresses
  trace.gates.push({
    n: 3,
    name: 'Evidence',
    question: 'What independent evidence backs the human behind this agent?',
    pass: true,
    how: `@corroborate/sdk against registry revision ${result.registryRevision}`,
    detail: {
      score: result.score,
      totalCostCents: result.totalCostCents,
      independentRoots: result.independentRoots,
      evidence: result.evidence
        .filter((e) => e.held || e.detail?.unavailable)
        .map((e) => ({
          adapter: e.adapterId,
          name: e.adapterName,
          held: e.held,
          class: e.evidenceClass,
          trustRoot: e.trustRoot,
          observedOn: e.observedOn,
          costCents: e.effectiveCostCents,
          forgeCents: e.forgeCostCents,
          rentCents: e.rentCostCents,
          source: e.sourceURI,
          ...(e.detail?.unavailable ? { unavailable: e.detail.error } : {}),
        })),
      roots: result.roots,
    },
  })

  // The SDK's caveats, verbatim. Never paraphrased and never filtered.
  trace.sdkCaveats = result.caveats
  trace.caveats.push(COUNTERPARTY_CAVEATS.addressSetUnauthenticated)

  // ------------------------------------------------------------------ gate 4: decision
  const scoreOk = result.isHuman(counterparty.scoreThreshold)
  const rootsOk = result.independentRoots >= counterparty.minIndependentRoots
  const allow = scoreOk && rootsOk

  trace.gates.push({
    n: 4,
    name: 'Counterparty decision',
    question: `Does that clear the line ${counterparty.name} drew?`,
    pass: allow,
    how: `${counterparty.name}'s own policy — the SDK ships no default and isHuman() throws without an explicit threshold`,
    detail: {
      score: result.score,
      scoreThreshold: counterparty.scoreThreshold,
      scoreOk,
      independentRoots: result.independentRoots,
      minIndependentRoots: counterparty.minIndependentRoots,
      rootsOk,
    },
  })

  trace.decision = {
    allow,
    because: allow
      ? `score ${result.score} ≥ ${counterparty.scoreThreshold} across ${result.independentRoots} independent trust roots`
      : !scoreOk
        ? `score ${result.score} < ${counterparty.scoreThreshold}`
        : `${result.independentRoots} independent root(s) < ${counterparty.minIndependentRoots} required`,
  }
  trace.result = result
  return trace
}
