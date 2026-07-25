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
 * Four runs:
 *
 *   1. One agent presents a name. The counterparty resolves the human behind it, scores that
 *      human across ten protocols, and decides.
 *   2. Its sibling presents. Same human, one slot: refused, naming the agent holding it.
 *   3. A third agent presents a *one-way* binding — it names a human who has not acknowledged
 *      it. Under the default policy it is admitted as a human of its own, and the cap it
 *      just walked around is the point of the run.
 *   4. The same three agents under a policy that requires the acknowledgement. One admitted.
 */

import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  Print,
  creationBlocks,
  ensBatchCaveats,
  evaluateFleet,
  humanAddressSets,
  resolveEnsAgents,
  scanNameTree,
  toFleetAgents,
} from '@print/sdk'
import { print as corroborateConfig, REPO_ROOT } from './config.js'
import { fleetPolicy } from './counterparty/policy.js'
import { banner, colour as C } from './trace.js'

const deployment = JSON.parse(readFileSync(resolve(REPO_ROOT, 'deployments/ens-sepolia.json'), 'utf8'))

const ENS_RPC = process.env.ENS_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'

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

function renderDecision(decision, identities) {
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
      `${s.denied} denied (${s.deniedByCap} by the cap) · ${s.assertedBindings} one-way binding(s)`,
  )
  for (const c of [...decision.caveats, ...ensBatchCaveats(identities)]) {
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
        'Records: print.human on each agent, print.agents + print.subjects on the human.',
    ),
  )

  const client = createPublicClient({ chain: sepolia, transport: http(ENS_RPC) })
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
    ...(corroborateConfig.registryRpcUrl ? { registryRpcUrl: corroborateConfig.registryRpcUrl } : {}),
    ...(corroborateConfig.subgraphUrl ? { subgraphUrl: corroborateConfig.subgraphUrl } : {}),
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

  const fleetAgents = toFleetAgents(identities)
  const policy = { ...fleetPolicy, admission: 'earliest-registered' }

  // ── runs 1–3: one policy, three requesters ──────────────────────────────────────────
  banner(
    `RUN 1–3 — ${policy.name}'s policy as written: ≥${policy.minScore} over ${policy.minIndependentRoots} roots, ${policy.maxAgentsPerHuman} agent per human`,
    'One-way bindings admitted. Watch what that costs.',
  )
  renderDecision(evaluateFleet({ policy, agents: fleetAgents, evidence }), identities)

  // ── run 4: the acknowledgement made mandatory ───────────────────────────────────────
  banner(
    'RUN 4 — the same three agents, requireAttestedBinding: true',
    'A counterparty deciding that an unacknowledged claim about a person is not evidence about that person.',
  )
  const strict = { ...policy, requireAttestedBinding: true }
  renderDecision(evaluateFleet({ policy: strict, agents: fleetAgents, evidence }), identities)

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
