/**
 * `npm start` — the end-to-end flow.
 *
 * An agent wants to transact. The counterparty will not deal with it until a real human is
 * shown to stand behind it. Three runs, each isolating a different way that check can go.
 */

import { startCounterparty } from './counterparty/server.js'
import { decide, resetSession } from './counterparty/decide.js'
import { counterparty, fleetPolicy } from './counterparty/policy.js'
import { Agent, ObservedAgent } from './agent.js'
import { REGISTERED_AGENTS, OPERATOR_ADDRESS_SET } from './fixtures.js'
import { banner, renderTrace, colour as C } from './trace.js'
import { agentPrivateKey, world } from './config.js'
import { scanAgentBook } from '@corroborate/sdk'

/** The human running the most agents, found by scanning rather than by being told. */
function largestFleet(index) {
  let best = ['', []]
  for (const r of index.registrations) {
    const fleet = index.fleetOf(r.humanId)
    if (fleet.length > best[1].length) best = [r.humanId, fleet]
  }
  return best
}

async function main() {
  console.log('')
  console.log(C.bold('Corroborate × World AgentKit — human-backing verification for agents'))
  console.log(
    C.dim(
      'A counterparty demands proof that a real human stands behind an agent, and shows its work.\n' +
        `World ID environment: ${world.environment} · AgentBook: World Chain ${world.agentBookAddress}`,
    ),
  )

  const server = await startCounterparty()
  console.log(C.dim(`Counterparty "${counterparty.name}" listening at ${server.url}`))
  console.log(C.dim(`It ${counterparty.what}.`))

  try {
    // ─────────────────────────────────────────────────────────── 1. unbacked agent
    banner(
      'RUN 1 — an agent with no human behind it',
      'Full HTTP round trip. The agent really signs; AgentBook really answers.',
    )

    const atlas = new Agent({
      name: 'atlas',
      ...(agentPrivateKey ? { privateKey: agentPrivateKey } : {}),
      operatorAddresses: OPERATOR_ADDRESS_SET,
      note: agentPrivateKey
        ? 'wallet from AGENT_PRIVATE_KEY'
        : 'ephemeral wallet, generated at startup — nobody registered it',
    })

    console.log(C.dim(`\n  agent wallet ${atlas.address}`))
    console.log(C.dim('  POST /order  →  402  →  sign CAIP-122 challenge  →  POST /order with `agentkit` header'))

    const { response, events } = await atlas.request(server.url)
    for (const e of events) console.log(C.dim(`  agentkit event: ${e.type}${e.reason ? ' — ' + e.reason : ''}`))
    const body = await response.json()
    console.log(C.dim(`  HTTP ${response.status}`))
    renderTrace({ ...body.trace, agent: { ...body.trace.agent, name: atlas.name, note: atlas.note } })

    const identityPassed = body.trace.gates.find((g) => g.n === 1)?.pass === true
    if (identityPassed) {
      console.log(
        C.dim(
          '\n  Note the shape of the failure: gate 1 passed. The agent proved it controls its wallet,\n' +
            '  with a real signature the counterparty really verified. Controlling a keypair is free.\n' +
            '  That is exactly why it is not the question anyone should be asking.',
        ),
      )
    }

    // ────────────────────────────────────────────────── 2. human-backed agent
    resetSession()
    banner(
      'RUN 2 — an agent a real human registered',
      'Live World Chain state. Signature gate is skipped and labelled, not faked.',
    )

    // `mirror` first because it is this human's *earlier* registration, and the policy gives
    // the slot to the earliest — a rule the chain decides, not the demo. Presenting `beacon`
    // first would have it admitted and `mirror` refused, which is the outcome an operator can
    // manufacture by racing a fresh wallet to the front of the queue.
    const mirror = new ObservedAgent({
      name: 'mirror',
      ...REGISTERED_AGENTS.mirror,
      operatorAddresses: OPERATOR_ADDRESS_SET,
    })
    const trace2 = await decide({
      agentName: mirror.name,
      agentAddress: mirror.address,
      operatorAddresses: mirror.operatorAddresses,
      note: mirror.note,
    })
    renderTrace(trace2)

    // ──────────────────────────────────────── 3. two agents, one human
    banner(
      'RUN 3 — a second agent, registered by the same human',
      'The cap is keyed on the human. A fleet of agents is still one person.',
    )

    const beacon = new ObservedAgent({
      name: 'beacon',
      ...REGISTERED_AGENTS.beacon,
      operatorAddresses: OPERATOR_ADDRESS_SET,
    })
    const trace3 = await decide({
      agentName: beacon.name,
      agentAddress: beacon.address,
      operatorAddresses: beacon.operatorAddresses,
      note: beacon.note,
    })
    renderTrace(trace3)

    const sameHuman =
      trace2.gates.find((g) => g.n === 2)?.detail?.humanId === trace3.gates.find((g) => g.n === 2)?.detail?.humanId
    console.log(
      C.dim(
        `\n  mirror and beacon are different wallets that AgentBook maps to ${sameHuman ? 'the same' : 'different'} humanId.\n` +
          '  Counting agents would have counted two. Counting humans counts one, and the second\n' +
          '  request cost one lookup rather than ten probes — evidence is keyed on the person.',
      ),
    )

    // ───────────────────────────────── 4. the largest fleet on World Chain
    banner(
      'RUN 4 — the biggest fleet in the registry, found rather than declared',
      'Nothing below is hard-coded. AgentBook’s whole registration history is scanned and the largest fleet wins.',
    )

    const index = await scanAgentBook()
    const [humanId, fleet] = largestFleet(index)
    console.log(
      C.dim(
        `  AgentBook holds ${index.stats.agents} agents over ${index.stats.humans} humans ` +
          `(${index.stats.collapseRatio}× over-count) at World Chain block ${index.head}.\n` +
          `  ${index.stats.humansWithMoreThanOneAgent} humans run more than one agent. The largest runs ${fleet.length}, ` +
          `all registered between blocks ${fleet[0].block} and ${fleet[fleet.length - 1].block}.`,
      ),
    )

    // Ask on behalf of a member that is *not* the earliest, which is what an operator does when
    // the first wallet has already spent its slot.
    const applicant = fleet[fleet.length - 1]
    const trace4 = await decide({
      agentName: `fleet-member-${fleet.length}`,
      agentAddress: applicant.agent,
      operatorAddresses: OPERATOR_ADDRESS_SET,
      note: `one of ${fleet.length} agents registered by human ${humanId.slice(0, 12)}…, registered at block ${applicant.block}`,
    })
    renderTrace(trace4)
    console.log(
      C.dim(
        `\n  Meridian never met the other ${fleet.length - 1} agents. It refused this one because the registry\n` +
          '  says they exist and that the slot is already taken. That is the difference between\n' +
          '  detecting a fleet after it has been served and pricing it before.',
      ),
    )

    // ────────────────────────────────────────────────────────────── closing
    banner('What this did and did not establish')
    console.log(`
  ${C.green('Established')}
    · The requester controls the wallet it presented          (CAIP-122 signature, run 1)
    · A World ID-verified human registered that wallet        (AgentBook, on-chain)
    · Independent evidence exists for a human behind the
      declared address set, priced by what it would cost an
      adversary to fake                                       (Corroborate, 3 trust roots)
    · Two agents can be one human, and were                   (run 3)
    · A counterparty can bound a fleet *before* serving it,
      because the registry names every agent a human
      registered — and can say what a second slot costs       (run 4, policy engine)

  ${C.red('Not established')}
    · That the human controls the agent right now.

  ${C.dim("The last one is not a gap in this implementation. No protocol in the roster attests it,")}
  ${C.dim('and the on-chain signature of a rented credential is identical to that of voluntary')}
  ${C.dim("delegation. The SDK emits `independent-control-not-attested` on every result and")}
  ${C.dim('refuses to let a caller suppress it. For an agent, "a human backs this" is precisely a')}
  ${C.dim('claim about control — so the caveat is not a footnote here, it is the boundary of the')}
  ${C.dim('claim being made.')}

  ${C.bold('Next:')} ${C.dim('`npm run worldid` runs the live World ID 4.0 proof flow — the one check that')}
  ${C.dim('does narrow the gap, because it needs a human present at request time.')}
`)
  } finally {
    await server.close()
  }
}

main().catch((e) => {
  console.error('\ndemo failed:', e)
  process.exit(1)
})
