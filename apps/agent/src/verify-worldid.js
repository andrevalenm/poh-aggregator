/**
 * `npm run worldid` — the live World ID 4.0 proof leg.
 *
 * AgentBook tells you a human registered an agent once. This tells you a human is present
 * now. For a counterparty settling value, that difference is the entire risk: a registration
 * is a fact about the past, and a rented credential looks exactly like an owned one until
 * someone is asked to answer in real time.
 *
 * Everything here is the documented World ID 4.0 flow, run for real:
 *   signRequest → IDKit.request → human answers → pollUntilCompletion → POST /api/v4/verify
 *
 * The only step this process cannot perform is the human one.
 */

import qrcode from 'qrcode-terminal'
import { openProofRequest, verifyProof, proverHint } from './world/worldid.js'
import { lookupHumanBacking } from './world/agentbook.js'
import { banner, colour as C } from './trace.js'
import { world, hasRpSigningKey } from './config.js'
import { REGISTERED_AGENTS } from './fixtures.js'

const agentAddress = process.argv[2] ?? REGISTERED_AGENTS.beacon.address

async function main() {
  banner(
    'World ID 4.0 — live human-backing proof',
    `rp ${world.rpId} · action "${world.action}" · environment ${world.environment}`,
  )

  if (!hasRpSigningKey) {
    console.log(C.red('\nWORLD_SIGNER_PRIVATE_KEY is not set in .env.local — cannot sign the RP context.\n'))
    process.exit(1)
  }

  console.log(`
  ${C.bold('What is about to happen')}

    1. This process signs an RP context with the relying party's signing key.
       That signature proves to World App that the request came from this RP.
    2. It opens a proof request bound to a signal — the agent's wallet address —
       so the resulting proof vouches for ${C.dim(agentAddress)}
       and nothing else. It cannot be replayed to back a different agent.
    3. You answer it as a human.
    4. This process polls until the proof lands, then POSTs it to
       ${C.dim(`${world.verifyHost}/api/v4/verify/${world.rpId}`)}
`)

  console.log(C.dim('  opening request…'))
  const request = await openProofRequest({ signal: agentAddress })

  console.log('')
  qrcode.generate(request.connectorURI, { small: true })
  console.log(`  ${C.bold('URI')}  ${request.connectorURI}`)
  console.log(`  ${C.bold('id ')}  ${request.requestId}`)
  console.log('')
  console.log(`  ${C.yellow('→')} ${proverHint()}`)
  console.log(C.dim('  waiting up to 5 minutes…\n'))

  const completion = await request.waitForProof()

  if (!completion.success) {
    console.log(`  ${C.red('proof not obtained')}: ${completion.error}`)
    console.log(
      C.dim(
        '\n  Nothing downstream of this is stubbed — the request, the RP signature and the\n' +
          '  verify call all work. This step needs a person with a World ID.',
      ),
    )
    process.exit(1)
  }

  console.log(`  ${C.green('proof received')} from World ID ${completion.result.protocol_version ?? ''}`)
  console.log(C.dim(`  ${JSON.stringify(completion.result).slice(0, 300)}…\n`))

  console.log(C.dim('  verifying against the Developer Portal…'))
  const verification = await verifyProof(completion.result)

  console.log('')
  if (verification.ok) {
    console.log(`  ${C.green('VERIFIED')}  nullifier ${verification.body.nullifier ?? '(see results)'}`)
    console.log(C.dim(`  environment ${verification.body.environment} · action ${verification.body.action}`))
  } else {
    console.log(`  ${C.red('NOT VERIFIED')}  HTTP ${verification.status}`)
    console.log(C.dim(`  ${JSON.stringify(verification.body)}`))
  }

  // The complementary on-chain fact, for contrast.
  const backing = await lookupHumanBacking(agentAddress)
  console.log('')
  console.log(`  ${C.bold('AgentBook, for the same address')}: ${backing.status}${backing.humanId ? ` (${backing.humanId})` : ''}`)
  console.log(
    C.dim(`
  These two answer different questions and a counterparty should want both.
  AgentBook: a World ID human registered this wallet, at some point, and has not
  been asked about it since. A live 4.0 proof: a World ID human was present at
  request time and signed for this specific agent.

  Neither shows the human controls the agent. A human present at request time may
  still be a paid signer clicking approve, and that is indistinguishable on chain
  from an operator approving their own agent. That is what
  \`independent-control-not-attested\` says, and it stays true here.`),
  )
}

main().catch((e) => {
  console.error('\nfailed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
