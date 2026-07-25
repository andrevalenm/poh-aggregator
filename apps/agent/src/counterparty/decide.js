/**
 * The counterparty's decision procedure.
 *
 * Four gates, in order, each answering a different question. The order matters: each gate is
 * cheaper than the next and rules out a distinct class of counterparty.
 *
 *   1. IDENTITY      Does the requester control the wallet it claims?      (signature)
 *   2. HUMAN-BACKING Did a World ID human register that wallet?            (AgentBook, on-chain)
 *   3. EVIDENCE      What independent evidence backs that human?           (Corroborate)
 *   4. FLEET POLICY  Does that clear the line this counterparty drew,
 *                    and does this human already hold their slots?         (policy engine)
 *
 * Gate 1 without gate 2 is a bot with a keypair. Gate 2 without gate 1 is a claim anyone can
 * make about anyone. Gates 1 and 2 without gate 3 is a single credential with a single point
 * of failure. Gates 1–3 without gate 4 is a *fleet*: twenty-seven agents each individually
 * clearing the line, all of them one person — which is the case AgentBook's own log says is
 * live on World Chain today. And none of them, at any strength, establishes that the human is
 * *operating* the agent rather than having been paid to register it once, which is why gate 4
 * records the caveat rather than resolving it.
 *
 * Gate 4 is not implemented here. It is `evaluateFleet()` from `@corroborate/sdk`, fed the
 * policy object from `policy.js` — the same function the SDK's unit tests exercise, so the
 * behaviour a judge sees on stage is the behaviour that is tested.
 */

import { evaluateFleet, priceOfPolicy, costOfSlots, scanAgentBook } from '@corroborate/sdk'
import { lookupHumanBacking } from '../world/agentbook.js'
import { resolveHumanBacking, readableAdapterIds, ontologyAdapters } from './corroborate.js'
import {
  counterparty,
  fleetPolicy,
  requireLiveWorldIdProof,
  GATE_TRUST_ROOTS,
  COUNTERPARTY_CAVEATS,
} from './policy.js'

/**
 * Personhood evidence, keyed on the human and never on the agent.
 *
 * The credentials belong to the person. Resolving them per agent would let one operator's two
 * wallets carry two different scores for one human, and would pay for the same ten probes
 * twice — a 27-agent fleet costs exactly one lookup.
 */
const evidenceByHuman = new Map()

/** AgentBook's whole registration history, scanned once per process. */
let fleetIndex
let fleetIndexError

export function resetSession() {
  evidenceByHuman.clear()
}

/** Force the next decision to re-scan. Used by the demo between runs, not on a request path. */
export function resetFleetIndex() {
  fleetIndex = undefined
  fleetIndexError = undefined
}

async function getFleetIndex() {
  if (fleetIndex || fleetIndexError) return fleetIndex
  try {
    fleetIndex = await scanAgentBook()
  } catch (e) {
    // A venue that cannot read the registry has not established the fleet is bounded. It falls
    // back to the single-agent view and the trace says the cap was not enforced — it does not
    // quietly behave as though the fleet were size one.
    fleetIndexError = e instanceof Error ? e.message : String(e)
  }
  return fleetIndex
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
    policy: { ...fleetPolicy, owner: counterparty.name },
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

  if (!requireLiveWorldIdProof) {
    trace.caveats.push(COUNTERPARTY_CAVEATS.worldIdProofNotRequested)
  }

  // ------------------------------------------------------------------ gate 3: evidence
  const cached = evidenceByHuman.get(backing.humanId)
  const resolved = cached ?? (await resolveHumanBacking({ agentAddress, operatorAddresses }))
  if (!cached) evidenceByHuman.set(backing.humanId, resolved)
  else trace.caveats.push(COUNTERPARTY_CAVEATS.evidenceResolvedOncePerHuman)
  const { result, addresses } = resolved

  trace.addressSet = addresses
  trace.gates.push({
    n: 3,
    name: 'Evidence',
    question: 'What independent evidence backs the human behind this agent?',
    pass: true,
    how: `@corroborate/sdk against registry revision ${result.registryRevision}${
      cached ? ' (resolved once for this human, reused)' : ''
    }`,
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

  // -------------------------------------------------------------- gate 4: fleet policy
  // The whole fleet, not just the requester: the cap is per human, and AgentBook says in
  // advance how many agents this human runs rather than making us wait to be asked.
  const index = await getFleetIndex()
  const scanned = index
    ? index.fleetAround(agentAddress)
    : [{ agent: agentAddress.toLowerCase(), backing: { status: 'backed', humanId: backing.humanId } }]

  // Gate 1's answer, carried into the engine rather than left implicit. Only the *requester*
  // presented anything; its siblings were found by scanning AgentBook's log and are not asking
  // for anything, so they carry no presenter and the engine's caveat says why that is expected.
  const agents = scanned.map((a) =>
    a.agent.toLowerCase() === agentAddress.toLowerCase() && identity?.verified
      ? {
          ...a,
          presenter: {
            status: 'authenticated',
            detail: `CAIP-122 signature over this counterparty's challenge, recovered to ${identity.address}`,
          },
        }
      : a,
  )

  const decision = evaluateFleet({
    policy: fleetPolicy,
    agents,
    evidence: new Map([
      [backing.humanId, { score: result.score, independentRoots: result.independentRoots, roots: result.roots.map((r) => r.trustRoot), subjects: addresses }],
    ]),
  })
  const mine = decision.agents.find((a) => a.agent === agentAddress.toLowerCase()) ?? decision.agents[0]

  const price = priceOfPolicy({
    adapters: await ontologyAdapters(),
    minScore: fleetPolicy.minScore,
    minIndependentRoots: fleetPolicy.minIndependentRoots,
    readableAdapterIds: readableAdapterIds(),
    mustInclude: GATE_TRUST_ROOTS,
  })

  trace.fleet = {
    summary: decision.summary,
    siblings: index ? index.siblingsOf(agentAddress).map((r) => ({ agent: r.agent, block: r.block })) : [],
    admitted: decision.humans[0]?.admitted ?? [],
    ...(index ? { indexedTo: index.head, source: index.source } : {}),
    price: {
      cheapestSlotCents: price.cheapestSlotCents,
      credentials: price.roots.map((r) => `${r.adapterId} (${r.trustRoot}, ${r.costCents}c)`),
      fleet: costOfSlots(price, fleetPolicy, decision.summary.agents),
    },
  }

  trace.gates.push({
    n: 4,
    name: 'Fleet policy',
    question: `Does that clear the line ${counterparty.name} drew, and does this human have a slot left?`,
    pass: mine.verdict === 'allow' ? true : mine.verdict === 'deny' ? false : null,
    how: `evaluateFleet() from @corroborate/sdk against ${counterparty.name}'s declared policy — the SDK ships no default and isHuman() throws without an explicit threshold`,
    detail: {
      ...Object.fromEntries(mine.rules.map((r) => [r.rule, `${r.pass === null ? 'n/a' : r.pass ? 'pass' : 'fail'} — ${r.detail}`])),
      agentsRegisteredByThisHuman: decision.summary.agents,
      admitted: decision.summary.allowed,
      refusedBecauseASiblingHasTheSlot: decision.summary.deniedByCap,
      cheapestSlotForAnAdversary: `${price.cheapestSlotCents}c via ${price.roots.map((r) => r.adapterId).join(' + ')}`,
    },
  })

  if (fleetIndexError) {
    trace.caveats.push({
      code: 'fleet-registry-unreadable',
      message: `AgentBook's registration history could not be read (${fleetIndexError}), so this decision saw only the requesting agent. The per-human cap was not enforced against the rest of this human's fleet.`,
    })
  }
  trace.caveats.push(...decision.caveats)

  trace.decision = { allow: mine.verdict === 'allow', because: mine.because }
  trace.fleetDecision = decision
  trace.result = result
  return trace
}
