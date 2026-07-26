/**
 * `npm run ens` — agent identity carried by ENS, end to end.
 *
 * The World flow (`npm start`) asks AgentBook who registered an agent. That works because
 * World hands out one identifier per verified human and a proof stands behind it. This flow
 * asks a different question: **what can a counterparty do when the only thing it is handed is
 * a name?**
 *
 * Everything below is resolved live from Sepolia ENS. The only input is the parent name in
 * `deployments/ens-sepolia.json`; the wallets, the human, the acknowledgements, the creation
 * blocks, the subnode count and the personhood evidence all come from chain reads at run time.
 * Nothing is hard-coded, and if the records change under us the output changes with them.
 *
 * Six runs:
 *
 *   1. One agent presents a name. The counterparty resolves the human behind it, scores that
 *      human across ten protocols, and decides.
 *   2. Its sibling presents. Same human, one slot: refused, naming the agent holding it.
 *   3. A third agent presents a *one-way* binding — it names a human who has not acknowledged
 *      it. Under the default policy it is admitted as a human of its own, and the cap it
 *      just walked around is the point of the run.
 *   4. The same three agents under a policy that requires the acknowledgement. One admitted.
 *   5. The same three agents under a policy that requires the *presenter* to hold the wallet.
 *      They each signed the counterparty's challenge, so the gate costs them nothing.
 *   6. The same three names, presented by a wallet generated seconds ago that holds none of
 *      them. Same records, same human, same score — and nobody is served.
 */

import { createPublicClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  Print,
  creationBlocks,
  ensBatchCaveats,
  ensPresentationMessage,
  evaluateFleet,
  humanAddressSets,
  issueEnsPresentationChallenge,
  resolveEnsAgents,
  scanNameTree,
  toFleetAgents,
  verifyEnsPresentation,
} from '@printid/sdk'
import { print as printConfig, ensAgentKey, REPO_ROOT } from './config.js'
import { fleetPolicy } from './counterparty/policy.js'
import { banner, colour as C } from './trace.js'

const deployment = JSON.parse(readFileSync(resolve(REPO_ROOT, 'deployments/ens-sepolia.json'), 'utf8'))

const ENS_RPC = process.env.ENS_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'

/**
 * The counterparty's own identity, as ERC-4361 defines it. A signature is bound to this domain
 * and this resource, so one collected by any other venue is not a credential here.
 */
const DOMAIN = 'meridian.example'
const RESOURCE = 'https://meridian.example/order'

const client = createPublicClient({ chain: sepolia, transport: http(ENS_RPC) })

/** Nonces this counterparty has issued and not yet spent. Replay protection lives here. */
const liveNonces = new Set()

/**
 * Run the challenge/response for every name in the batch.
 *
 * `signerFor(name)` returns the account presenting that name, or undefined if nobody can sign
 * for it. That is the whole variable: run 5 hands over each agent's own key, run 6 hands over a
 * single wallet generated at start-up that owns none of the names. Every other input — the
 * challenge, the message, the verification, the address it is checked against — is identical.
 */
async function collectPresentations(identities, signerFor) {
  const results = new Map()
  for (const id of identities) {
    const account = signerFor(id.name)
    if (!account) continue
    const challenge = issueEnsPresentationChallenge({
      domain: DOMAIN,
      uri: RESOURCE,
      name: id.name,
      chainId: deployment.chainId,
    })
    liveNonces.add(challenge.nonce)
    // The presenter signs the address it controls, which is exactly how an impostor gives
    // itself away: everything about the message is well-formed and the signer is simply not
    // the wallet the name designates.
    const message = ensPresentationMessage(challenge, account.address)
    const signature = await account.signMessage({ message })
    const result = await verifyEnsPresentation({
      challenge,
      presentation: { name: id.name, message, signature },
      expectedAddress: id.agent,
      nodeOwner: id.owner,
      checkNonce: (n) => liveNonces.has(n),
      client,
    })
    liveNonces.delete(challenge.nonce)
    results.set(result.name, result)
  }
  return results
}

function renderPresentations(results) {
  for (const r of results.values()) {
    const verdict =
      r.status === 'authenticated'
        ? C.green('authenticated')
        : r.status === 'unknown'
          ? C.yellow('unreadable')
          : C.red('refused')
    console.log(
      `  ${C.bold(r.name)}  ${verdict} ${C.dim(r.status === 'authenticated' ? (r.method ?? '') : (r.failure ?? ''))}`,
    )
    console.log(`    signed by  ${r.address ?? C.dim('—')}`)
    console.log(`    name says  ${r.expected ?? C.dim('—')}`)
    if (r.error) console.log(`    ${C.dim(r.error)}`)
  }
}

const mark = (v) => (v === 'allow' ? C.green('ALLOW') : v === 'deny' ? C.red('DENY') : C.yellow('UNKNOWN'))

function renderIdentity(id) {
  console.log(`  ${C.bold(id.name)}`)
  console.log(`    wallet   ${id.agent ?? C.yellow('no addr record')}`)
  console.log(`    owner    ${C.dim(id.owner ?? 'unowned')}`)
  console.log(
    `    human    ${id.human?.declared ?? C.yellow('none declared')}` +
      (id.human?.address ? C.dim(`  → ${id.human.address}`) : ''),
  )
  const strength =
    id.binding === 'mutual'
      ? C.green('mutual — the human lists this name back')
      : id.binding === 'agent-asserted'
        ? C.yellow('one-way — the human has not acknowledged it')
        : C.red(id.binding)
  console.log(`    binding  ${strength}`)
  if (id.createdAtBlock) console.log(`    created  ${C.dim(`block ${id.createdAtBlock}`)}`)
}

function renderDecision(decision, identities, presentations) {
  for (const v of decision.agents) {
    console.log(`  ${mark(v.verdict)}  ${C.bold(v.label ?? v.agent)}`)
    console.log(`        ${C.dim(v.because)}`)
    for (const r of v.rules) {
      const m = r.pass === true ? C.green('·') : r.pass === false ? C.red('×') : C.yellow('?')
      console.log(`        ${m} ${r.rule.padEnd(24)} ${C.dim(r.detail)}`)
    }
  }
  console.log('')
  const s = decision.summary
  console.log(
    `  ${C.bold('summary')}  ${s.agents} agent(s) · ${s.humans} human(s) · ${s.allowed} allowed · ` +
      `${s.denied} denied (${s.deniedByCap} by the cap) · ${s.assertedBindings} one-way binding(s) · ` +
      `${s.unauthenticatedPresenters} unproven presenter(s)`,
  )
  for (const c of [...decision.caveats, ...ensBatchCaveats(identities, presentations)]) {
    console.log(`  ${C.yellow('!')} ${C.bold(c.code)}`)
    console.log(`    ${C.dim(c.message)}`)
  }
}

async function main() {
  console.log('')
  console.log(C.bold('Print × ENS — an agent’s name, the human behind it, and the cap that follows'))
  console.log(
    C.dim(
      `Sepolia ENS · parent ${deployment.parent} · resolver ${deployment.resolver}\n` +
        'Records: observer.print.human on each agent, observer.print.agents + observer.print.subjects on the human.',
    ),
  )

  const names = deployment.agents.map((a) => a.name)

  // ── the tree, from the registry's own log ───────────────────────────────────────────
  banner(
    'The name tree, read from the ENS registry',
    'Subnames are enumerated from NewOwner logs. ENS stores the label hash, never the label — a tree can be counted but not named.',
  )
  const tree = await scanNameTree(deployment.parent, { candidateLabels: names })
  console.log(
    `  ${tree.subnodes.length} subnode(s) under ${deployment.parent} between blocks ` +
      `${tree.coverage.fromBlock}–${tree.coverage.toBlock} (${tree.coverage.endpoint}, ${tree.coverage.calls} call(s))`,
  )
  for (const s of tree.subnodes) {
    console.log(
      `    ${s.name ?? C.yellow(`${s.labelhash.slice(0, 12)}… (label not recoverable)`)}  ${C.dim(`block ${s.block}`)}`,
    )
  }

  const identities = await resolveEnsAgents(client, names, { createdAtBlock: creationBlocks(tree) })
  console.log('')
  for (const id of identities) renderIdentity(id)

  // ── personhood, resolved once per human ─────────────────────────────────────────────
  banner(
    'Personhood, resolved once per human',
    'The credentials belong to the person. Two agents of one human are one lookup, not two.',
  )
  const sdk = new Print({
    ...(printConfig.registryRpcUrl ? { registryRpcUrl: printConfig.registryRpcUrl } : {}),
    ...(printConfig.subgraphUrl ? { subgraphUrl: printConfig.subgraphUrl } : {}),
  })
  const sets = humanAddressSets(identities)
  const evidence = new Map()
  for (const [humanId, addresses] of sets) {
    try {
      const result = await sdk.resolve(addresses)
      // `roots` on the result are contributions; the fleet trace wants their names.
      const rootNames = result.roots.map((r) => r.trustRoot)
      evidence.set(humanId, {
        score: result.score,
        independentRoots: result.independentRoots,
        roots: rootNames,
        subjects: addresses,
      })
      console.log(
        `  ${C.bold(humanId)}\n    ${addresses.length} address(es) → score ${C.bold(result.score.toFixed(4))} ` +
          `across ${result.independentRoots} independent root(s) ${C.dim(`(${rootNames.join(', ')})`)}`,
      )
      const held = result.evidence.filter((e) => e.held)
      for (const e of held) {
        console.log(`      ${C.dim('·')} ${e.adapterName ?? e.adapterId} ${C.dim(`— ${e.trustRoot}`)}`)
      }
    } catch (e) {
      // A failed lookup is `indeterminate` downstream, never a denial.
      evidence.set(humanId, { score: 0, independentRoots: 0, error: e.message })
      console.log(`  ${C.bold(humanId)}  ${C.red('unresolved')} ${C.dim(e.message)}`)
    }
  }

  // ── the challenge/response ──────────────────────────────────────────────────────────
  banner(
    'The presenter gate — who is actually asking?',
    'Everything above was read from public records. A name is public, so none of it says the party on this connection holds anything at all.',
  )
  const agentAccounts = new Map()
  for (const id of identities) {
    const key = ensAgentKey(id.name)
    if (key) agentAccounts.set(id.name, privateKeyToAccount(key))
  }
  const presentations = await collectPresentations(identities, (name) => agentAccounts.get(name))
  if (presentations.size === 0) {
    console.log(C.yellow('  No agent keys on this machine, so nobody can answer a challenge.'))
    console.log(C.dim('  scripts/ens-agents-keys.mjs writes them to .env.local; they hold no funds.'))
  } else {
    renderPresentations(presentations)
  }

  const fleetAgents = toFleetAgents(identities, presentations)
  const policy = { ...fleetPolicy, admission: 'earliest-registered' }

  // ── runs 1–3: one policy, three requesters ──────────────────────────────────────────
  banner(
    `RUN 1–3 — ${policy.name}'s policy as written: ≥${policy.minScore} over ${policy.minIndependentRoots} roots, ${policy.maxAgentsPerHuman} agent per human`,
    'One-way bindings admitted. Watch what that costs.',
  )
  renderDecision(evaluateFleet({ policy, agents: fleetAgents, evidence }), identities, presentations)

  // ── run 4: the acknowledgement made mandatory ───────────────────────────────────────
  banner(
    'RUN 4 — the same three agents, requireAttestedBinding: true',
    'A counterparty deciding that an unacknowledged claim about a person is not evidence about that person.',
  )
  const strict = { ...policy, requireAttestedBinding: true }
  renderDecision(evaluateFleet({ policy: strict, agents: fleetAgents, evidence }), identities, presentations)

  // ── run 5: the presenter gate, with the agents themselves presenting ────────────────
  banner(
    'RUN 5 — the same three agents, requirePresenterAuthentication: true',
    'Each answered the challenge with the wallet its name designates, so requiring proof costs an honest agent nothing.',
  )
  const gated = { ...policy, requirePresenterAuthentication: true }
  renderDecision(evaluateFleet({ policy: gated, agents: fleetAgents, evidence }), identities, presentations)

  // ── run 6: the same three names, presented by somebody else ────────────────────────
  const impostor = privateKeyToAccount(generatePrivateKey())
  banner(
    `RUN 6 — the same three names, presented by ${impostor.address}`,
    'A wallet generated one second ago, holding none of these names. Identical records, identical human, identical score.',
  )
  const stolen = await collectPresentations(identities, () => impostor)
  renderPresentations(stolen)
  console.log('')
  renderDecision(
    evaluateFleet({ policy: gated, agents: toFleetAgents(identities, stolen), evidence }),
    identities,
    stolen,
  )

  console.log('')
  console.log(C.dim('  Everything above was read from Sepolia at run time. Re-run after editing a text'))
  console.log(C.dim('  record on the tree and the decision moves with it — that is the point of ENS'))
  console.log(C.dim('  carrying the identity rather than a config file in this repo.'))
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
