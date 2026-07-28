#!/usr/bin/env node
/**
 * Print MCP server.
 *
 * Lets an agent ask whether a real human stands behind an address, and — more usefully —
 * *why*. Every response carries the evidence, its trust roots, and what was discounted as
 * correlated, because an agent acting on a bare number cannot reason about its own
 * uncertainty.
 *
 * Two deliberate refusals shape this surface:
 *
 *  - No tool returns a bare boolean. `check_personhood` requires the caller to state a
 *    threshold, so the decision to deny is always the caller's and always explicit.
 *  - Nothing here writes. The server reads public chains and a public registry; it holds
 *    no user state and cannot be asked to remember that two addresses belong to one person.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  Print,
  DEFAULT_REGISTRY,
  weightHistory,
  suggestEnrollment,
  evaluateFleet,
  lookupHumans,
  priceOfPolicy,
  costOfSlots,
  defaultAdapters,
  walletSignals,
  type WalletChain,
  type Address,
  type FleetAgent,
  type HumanEvidence,
  type PersonhoodResult,
} from '@printid/sdk'

// Copied out of ontology/adapters.json by this package's build and shipped in the tarball.
// It used to be read at run time from a path three levels above dist, which is the repo's own
// ontology directory from packages/mcp/dist but node_modules/ontology from an installed
// node_modules/@printid/mcp/dist. Installed, that read always failed, a silent catch left the
// preimage lists empty, and every lookup came back score 0 with "no credentials found". The
// data has to travel with the code, so it is imported: a missing file is a build error now,
// not a wrong answer in the adversary's favour.
import ontologyData from './ontology-data.json' with { type: 'json' }

const knownIds = ontologyData.adapters.map((a) => a.id)
// Retired root names too: an as-of lookup reads revisions where they were still in force,
// and without their preimages the interesting part of the history prints as raw hashes.
const knownRoots = [
  ...Object.keys(ontologyData.trustRoots),
  ...Object.keys(ontologyData.retiredTrustRoots ?? {}),
]

const client = new Print({
  registryAddress: (process.env.PRINT_REGISTRY as `0x${string}`) ?? DEFAULT_REGISTRY,
  // The subgraph supplies trust-graph position, and issuance dates for protocols that keep
  // none on chain. Without it the server still works — PoH is dated from the contract either
  // way — but Circles results carry the issuance-date-unknown caveat.
  ...(process.env.PRINT_SUBGRAPH_URL ? { subgraphUrl: process.env.PRINT_SUBGRAPH_URL } : {}),
  // Only as_of needs this one — it is where the ontology's own history lives.
  ...(process.env.PRINT_REGISTRY_SUBGRAPH_URL
    ? { registrySubgraphUrl: process.env.PRINT_REGISTRY_SUBGRAPH_URL }
    : {}),
  knownIds,
  knownRoots,
})

const server = new McpServer({ name: 'print', version: '0.1.1' })

/** Compact, agent-legible rendering. Full detail stays available via the raw result. */
function render(r: PersonhoodResult): string {
  const lines: string[] = []
  lines.push(`subject: ${r.subjects.join(', ')}${r.name ? ` (${r.name})` : ''}`)
  lines.push(`score: ${r.score.toFixed(2)}  (log10 of adversary cost in cents)`)
  lines.push(`independent trust roots: ${r.independentRoots}`)
  lines.push(`total adversary cost: $${(r.totalCostCents / 100).toFixed(2)}`)
  lines.push('')

  const held = r.evidence.filter((e) => e.held)
  if (held.length === 0) {
    lines.push('credentials: none found')
  } else {
    lines.push('credentials held:')
    for (const e of held) {
      const decay = e.freshness < 1 ? `, freshness ${(e.freshness * 100).toFixed(0)}%` : ''
      const dead = e.live ? '' : ' [DISCONTINUED — scored 0]'
      lines.push(
        `  - ${e.adapterName} (${e.evidenceClass}) root=${e.trustRoot} on ${e.observedOn}${decay}${dead}`,
      )
    }
  }

  if (r.roots.length) {
    lines.push('')
    lines.push('trust roots (correlated credentials saturate, they do not sum):')
    for (const root of r.roots) {
      const flag = root.saturated ? `  <- ${root.adapterIds.length} credentials, counted once` : ''
      lines.push(`  - ${root.trustRoot}: $${(root.contributionCents / 100).toFixed(2)}${flag}`)
    }
  }

  lines.push('')
  lines.push('caveats:')
  for (const c of r.caveats) lines.push(`  - [${c.code}] ${c.message}`)

  lines.push('')
  lines.push(`registry revision ${r.registryRevision ?? 'unknown'}, computed at ${new Date(r.computedAt * 1000).toISOString()}`)
  if (r.asOf) {
    lines.push(
      `AS OF Sepolia block ${r.asOf.block} — the ontology as it stood then (${r.asOf.adapterCount} adapters), not as it stands now.`,
      'Credentials were read at chain head, so this can understate the subject and never the adversary.',
    )
  }
  return lines.join('\n')
}

server.tool(
  'lookup_personhood',
  'Gather every proof-of-personhood credential for an address or ENS name and score it by independent trust root. Returns the evidence and what was discounted as correlated, never a bare verdict. Pass several addresses when the same person controls more than one wallet — real users hold different credentials on different addresses.',
  {
    subject: z
      .union([z.string(), z.array(z.string()).min(1)])
      .describe('An address, an ENS name, or several of either belonging to one person.'),
    as_of: z
      .string()
      .optional()
      .describe(
        'Score against the ontology as it stood in the past, not as it stands now: a Sepolia registry block number, or an ISO date. Use this to answer "what would this score have been when we made that decision?" — the weights are curated judgments and they change.',
      ),
  },
  async ({ subject, as_of }) => {
    // Deliberately not caught: as-of refuses rather than degrading, because answering a
    // question about the past with today's weights and stamping a block number on it would be
    // a worse failure than no answer. The error text says which part could not be honoured.
    const asOf = as_of === undefined ? undefined : /^[0-9]+$/.test(as_of.trim()) ? Number(as_of) : as_of
    const r = await client.resolve(subject, asOf === undefined ? {} : { asOf })
    return { content: [{ type: 'text', text: render(r) }] }
  },
)

server.tool(
  'check_personhood',
  'Decide whether a subject clears a personhood threshold you specify. There is no default threshold on purpose: at a plausible sybil rate a strong classifier still misjudges most of the people it flags, so the choice to deny belongs to you. Prefer escalating (asking for another credential) over denying.',
  {
    subject: z.union([z.string(), z.array(z.string()).min(1)]),
    threshold: z
      .number()
      .describe(
        'Score to clear. From the deployed ontology: ~1.7 = one cheap-to-rent credential (World Orb resells from $0.50; Circles registration), ~2.7 = a PoH registration, ~3.5 = a KYC-rooted credential or several independent roots. Exported presets: lenient 1.5, standard 2.5, strict 3.5.',
      ),
  },
  async ({ subject, threshold }) => {
    const r = await client.resolve(subject)
    const passed = r.isHuman(threshold)
    return {
      content: [
        {
          type: 'text',
          text: `${passed ? 'PASS' : 'FAIL'} at threshold ${threshold}\n\n${render(r)}`,
        },
      ],
    }
  },
)

server.tool(
  'explain_trust_roots',
  'List the trust-root ontology: every known personhood protocol, what it proves, which root it reads, and what it costs to forge or rent. Use this to understand why two credentials might not be independent evidence.',
  {
    root: z.string().optional().describe('Filter to a single trust root, e.g. state-document:icao-9303'),
  },
  async ({ root }) => {
    const { adapters, revision } = await client.ontology()
    const all = [...adapters.values()].filter((a) => !root || a.trustRoot === root)

    const byRoot = new Map<string, typeof all>()
    for (const a of all) {
      const b = byRoot.get(a.trustRoot)
      if (b) b.push(a)
      else byRoot.set(a.trustRoot, [a])
    }

    const lines = [`registry revision ${revision}, ${all.length} adapters across ${byRoot.size} trust roots`, '']
    for (const [r, group] of [...byRoot].sort((a, b) => b[1].length - a[1].length)) {
      const shared = group.length > 1 ? '  <- SHARED: these are one piece of evidence, not several' : ''
      lines.push(`${r}${shared}`)
      for (const a of group) {
        const dead = a.live ? '' : ' [DISCONTINUED]'
        lines.push(
          `  - ${a.id}: ${a.name} (${a.evidenceClass}) forge $${(a.forgeCostCents / 100).toFixed(2)} / rent $${(a.rentCostCents / 100).toFixed(2)}${dead}`,
        )
        lines.push(`      source: ${a.sourceURI}`)
      }
      lines.push('')
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'explain_weight_history',
  'The full audit trail for one adapter: every weight the ontology has ever assigned it, each with the source it was derived from and the block it landed in. Weights here are curated judgments, so this history is what makes them accountable — if a score changed, this shows exactly when, why, and on whose evidence.',
  {
    adapter_id: z.string().describe('Adapter id, e.g. world-id-orb, poh-v2, circles-v2'),
  },
  async ({ adapter_id }) => {
    const url = process.env.PRINT_REGISTRY_SUBGRAPH_URL
    if (!url) {
      return {
        content: [
          {
            type: 'text',
            text: 'PRINT_REGISTRY_SUBGRAPH_URL is not set. The audit trail lives in the registry subgraph; without it, use explain_trust_roots for current weights (each carries its sourceURI).',
          },
        ],
      }
    }
    const history = await weightHistory(url, adapter_id)
    if (!history) return { content: [{ type: 'text', text: 'Registry subgraph unreachable.' }] }
    if (!history.length)
      return { content: [{ type: 'text', text: `No weight history for "${adapter_id}" — check the id via explain_trust_roots.` }] }

    const lines = [`weight history for ${adapter_id} (${history.length} change${history.length === 1 ? '' : 's'}):`, '']
    for (const w of history) {
      lines.push(
        `  rev ${w.revision} · ${new Date(w.timestamp * 1000).toISOString()} · block ${w.block}`,
        `    forge $${(w.forgeCostCents / 100).toFixed(2)} / rent $${(w.rentCostCents / 100).toFixed(2)} · ${w.live ? 'live' : 'DISCONTINUED'}`,
        `    source: ${w.sourceURI}`,
        `    tx: ${w.txHash}`,
      )
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'suggest_enrollment',
  'Which trust root is this subject missing, and where do they actually go to get it. Only ever suggests roots the subject does not already hold — a second passport-derived credential saturates against the first and raises nothing, which is also why this cannot be turned into a farming manual: the roots a farm can cheaply replicate are exactly the ones that gain it nothing.',
  {
    subject: z.union([z.string(), z.array(z.string()).min(1)]),
  },
  async ({ subject }) => {
    const r = await client.resolve(subject)
    const { adapters } = await client.ontology()
    const advice = suggestEnrollment(r, adapters)
    const lines: string[] = []
    lines.push(`current: score ${r.score.toFixed(2)} across ${r.independentRoots} independent root${r.independentRoots === 1 ? '' : 's'}`)
    lines.push('')
    if (!advice.suggestions.length) {
      lines.push('No unheld live roots to suggest — the subject already holds every root the ontology can price.')
    } else {
      lines.push('unheld roots, ranked by score gain (each priced at min(forge, rent) of its cheapest credential):')
      for (const s of advice.suggestions) {
        lines.push(`  - ${s.trustRoot}: +${s.scoreGain.toFixed(2)} → projected score ${s.projectedScore.toFixed(2)} across ${s.projectedRoots} roots ($${(s.contributionCents / 100).toFixed(2)} adversary cost)`)
        for (const o of s.options) {
          lines.push(`      ${o.name} — ${o.url} · ${o.effort} · ${o.price} · you give: ${o.youGive}`)
        }
      }
    }
    if (advice.wouldAddNothing.length) {
      lines.push('')
      lines.push('would add NOTHING (root already held — a second credential here saturates):')
      for (const w of advice.wouldAddNothing) lines.push(`  - ${w.trustRoot}: ${w.options.map((o) => o.name).join(', ')}`)
    }
    lines.push('')
    lines.push(`caveat: ${advice.caveat}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'check_fleet',
  'Apply a fleet policy to a set of agent wallets: who is the human behind each (read attested from World AgentBook), does that human clear your score and independence bar, and does any one human exceed your per-human agent cap. A fleet of agents is still one person. Verdicts come with the full rule trace; an unreadable registry yields indeterminate, never a deny.',
  {
    agents: z.array(z.string()).min(1).describe('Agent wallet addresses to evaluate together.'),
    min_score: z.number().default(1.5).describe('Print score the backing human must reach.'),
    min_independent_roots: z.number().int().default(1),
    max_agents_per_human: z.number().int().default(1).describe('Agent slots one human may hold at once.'),
    unbacked: z
      .enum(['deny', 'count-as-distinct-human'])
      .default('deny')
      .describe('What to do with an agent nobody registered in AgentBook.'),
  },
  async ({ agents, min_score, min_independent_roots, max_agents_per_human, unbacked }) => {
    const addrs = agents as Address[]
    const backings = await lookupHumans(addrs)
    const fleetAgents: FleetAgent[] = addrs.map((a) => ({
      agent: a,
      backing: backings.get(a) ?? { status: 'unknown', error: 'no lookup result' },
    }))

    // One personhood resolve per DISTINCT human — the whole point of the grouping.
    const evidence = new Map<string, HumanEvidence>()
    const humanIds = [...new Set(fleetAgents.flatMap((f) => (f.backing.status === 'backed' ? [f.backing.humanId] : [])))]
    for (const humanId of humanIds) {
      // AgentBook humanIds are World nullifiers, not addresses — personhood is resolved over
      // the agent wallets that share the backing, which is the address set we actually have.
      const wallets = fleetAgents.filter((f) => f.backing.status === 'backed' && f.backing.humanId === humanId).map((f) => f.agent)
      try {
        const r = await client.resolve(wallets)
        evidence.set(humanId, { score: r.score, independentRoots: r.independentRoots, subjects: r.subjects, roots: r.roots.filter((x) => x.contributionCents > 0).map((x) => x.trustRoot) })
      } catch (e) {
        evidence.set(humanId, { score: 0, independentRoots: 0, error: e instanceof Error ? e.message : String(e) })
      }
    }
    if (unbacked === 'count-as-distinct-human') {
      // An unbacked agent admitted as its own human is scored on its own wallet.
      for (const f of fleetAgents) {
        if (f.backing.status !== 'unbacked') continue
        try {
          const r = await client.resolve(f.agent)
          evidence.set(`unbacked:${f.agent.toLowerCase()}`, { score: r.score, independentRoots: r.independentRoots, subjects: r.subjects, roots: r.roots.filter((x) => x.contributionCents > 0).map((x) => x.trustRoot) })
        } catch (e) {
          evidence.set(`unbacked:${f.agent.toLowerCase()}`, { score: 0, independentRoots: 0, error: e instanceof Error ? e.message : String(e) })
        }
      }
    }

    const decision = evaluateFleet({
      policy: {
        name: 'mcp-caller',
        minScore: min_score,
        minIndependentRoots: min_independent_roots,
        maxAgentsPerHuman: max_agents_per_human,
        unbackedAgents: unbacked,
        admission: 'as-presented',
      },
      agents: fleetAgents,
      evidence,
    })

    const lines: string[] = []
    lines.push(`fleet decision — policy: minScore ${min_score}, minRoots ${min_independent_roots}, cap ${max_agents_per_human}/human, unbacked=${unbacked}`)
    lines.push('')
    for (const v of decision.agents) {
      lines.push(`  ${v.agent}: ${v.verdict.toUpperCase()} — ${v.because}`)
      for (const o of v.rules) lines.push(`      [${o.pass === null ? '?' : o.pass ? 'ok' : 'FAIL'}] ${o.rule}: ${o.detail}`)
    }
    const s = decision.summary
    lines.push('')
    lines.push(
      `humans identified: ${s.humans} · allowed ${s.allowed} · denied ${s.denied} (${s.deniedByCap} by cap) · indeterminate ${s.indeterminate} · collapse ratio ${s.collapseRatio.toFixed(1)}× (${s.agents} agents → ${s.humans} humans)`,
    )
    for (const c of decision.caveats) lines.push(`  caveat: [${c.code}] ${c.message}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'wallet_signals',
  'Wallet forensics for an address — age, outbound activity, balances, USDC holdings across Ethereum, Gnosis and Base. These price effort, NOT humanity: a rich old busy wallet can be one bot among thousands run by one operator, and a fresh empty wallet can be a real person arriving. Every result carries the wallet-forensics-are-not-personhood caveat; this tool will never fold these numbers into a personhood score, and neither should you.',
  {
    address: z.string().describe('The wallet address to read.'),
    chains: z
      .array(z.enum(['ethereum', 'gnosis', 'base', 'optimism', 'arbitrum']))
      .optional()
      .describe('Which chains to read. Default: ethereum + gnosis + base; optimism and arbitrum on request.'),
  },
  async ({ address, chains }) => {
    const result = await walletSignals(address as Address, chains ? { chains: chains as WalletChain[] } : undefined)
    const lines: string[] = []
    const s = result.summary
    lines.push(`wallet ${result.address}`)
    lines.push(
      `summary: ${s.anyActivity ? 'active' : 'no activity seen'} · ${s.totalTxOut} tx sent across answering chains${s.approxAgeDays !== undefined ? ` · first seen ~${Math.round(s.approxAgeDays)} days ago` : ''}`,
    )
    lines.push('')
    for (const c of result.chains) {
      const parts: string[] = []
      if (c.txCountOut !== undefined) parts.push(`${c.txCountOut} tx out`)
      if (c.nativeBalanceWei !== undefined) parts.push(`balance ${(Number(c.nativeBalanceWei) / 1e18).toFixed(4)} native`)
      if (c.erc20?.usdc !== undefined) parts.push(`USDC ${(Number(c.erc20.usdc) / 1e6).toFixed(2)}`)
      if (c.firstSeen) parts.push(`first seen ${new Date(c.firstSeen.timestamp * 1000).toISOString().slice(0, 10)}`)
      if (c.totalTxCount !== undefined) parts.push(`${c.totalTxCount} total tx (indexed)`)
      lines.push(`  ${c.chain}: ${parts.length ? parts.join(' · ') : 'nothing seen'}`)
      for (const [source, err] of Object.entries(c.errors ?? {})) lines.push(`      unreachable: ${source} — ${err}`)
    }
    lines.push('')
    lines.push(`caveat: [${result.caveat.code}] ${result.caveat.message}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'price_policy',
  'What it costs an adversary to defeat a personhood policy: the cheapest set of real credentials that clears your score line and root count, priced at min(forge, rent) from the deployed registry, one credential per root because saturation makes a second one worthless. Priced only over adapters this deployment can actually read — quoting the whole ontology would state a floor nobody can reach. With a per-human agent cap, also composes the bill for N agent slots: each batch of max_agents_per_human slots needs a whole new human, credentials and all.',
  {
    min_score: z.number().describe('The score line the policy demands.'),
    min_independent_roots: z.number().int().default(2),
    max_agents_per_human: z.number().int().default(1),
    slots: z.number().int().default(1).describe('How many agent slots the adversary wants to hold.'),
    must_include: z
      .array(z.string())
      .optional()
      .describe('Trust roots every slot needs regardless of score (e.g. iris-registry:world-orb when AgentBook registration is also required).'),
  },
  async ({ min_score, min_independent_roots, max_agents_per_human, slots, must_include }) => {
    const { adapters } = await client.ontology()
    const readable = defaultAdapters().map((a) => a.adapterId)
    const price = priceOfPolicy({
      adapters,
      minScore: min_score,
      minIndependentRoots: min_independent_roots,
      readableAdapterIds: readable,
      ...(must_include ? { mustInclude: must_include } : {}),
    })
    const lines: string[] = []
    lines.push(`policy: score ≥ ${min_score}, ≥ ${min_independent_roots} independent roots, ${max_agents_per_human} agent slot${max_agents_per_human === 1 ? '' : 's'} per human`)
    lines.push('')
    if (!price.feasible) {
      lines.push(`INFEASIBLE with the ${readable.length} adapters this deployment reads: ${price.reason}`)
      lines.push('No combination of readable credentials clears this policy — for a defender that means nobody can pass it either.')
    } else {
      lines.push(`cheapest slot: $${(price.cheapestSlotCents / 100).toFixed(2)}${price.approximate ? ' (approximate — greedy search)' : ''}`)
      for (const r of price.roots) lines.push(`  - ${r.trustRoot} via ${r.adapterId}: $${(r.costCents / 100).toFixed(2)}`)
      lines.push(`  (${price.reason})`)
      const bill = costOfSlots(price, { name: 'priced', minScore: min_score, minIndependentRoots: min_independent_roots, maxAgentsPerHuman: max_agents_per_human, unbackedAgents: 'deny', admission: 'as-presented' }, slots)
      lines.push('')
      lines.push(
        `${bill.slots} slot${bill.slots === 1 ? '' : 's'} → ${bill.humansRequired} human${bill.humansRequired === 1 ? '' : 's'} required → $${(bill.totalCents / 100).toFixed(2)} total, $${(bill.marginalCentsPerAgent / 100).toFixed(2)} marginal per agent`,
      )
      lines.push('Without the per-human cap, the marginal agent costs a keypair.')
    }
    lines.push('')
    lines.push(`candidates considered: ${price.candidates.map((c) => `${c.trustRoot} ($${(c.costCents / 100).toFixed(2)})`).join(', ')}`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.tool(
  'compare_subjects',
  'Two subjects side by side, scored identically: per-root contributions, where their credentials overlap, and whose evidence is more independent. The instructive case is a real person against a sybil farm — the farm can hold MORE credentials and still collapse to fewer roots, because its credentials are maximally correlated. Returns the factual comparison only; which one to admit is a threshold decision that stays with you.',
  {
    subject_a: z.union([z.string(), z.array(z.string()).min(1)]).describe('First subject: address, ENS name, or set.'),
    subject_b: z.union([z.string(), z.array(z.string()).min(1)]).describe('Second subject.'),
    label_a: z.string().default('A'),
    label_b: z.string().default('B'),
  },
  async ({ subject_a, subject_b, label_a, label_b }) => {
    const [a, b] = await Promise.all([client.resolve(subject_a), client.resolve(subject_b)])
    const lines: string[] = []
    const side = (label: string, r: PersonhoodResult) => {
      lines.push(`${label}: score ${r.score.toFixed(2)} · ${r.independentRoots} independent root${r.independentRoots === 1 ? '' : 's'} · $${(r.totalCostCents / 100).toFixed(2)} adversary cost · ${r.evidence.filter((e) => e.held).length} credential${r.evidence.filter((e) => e.held).length === 1 ? '' : 's'} held`)
      for (const root of r.roots) {
        lines.push(`    ${root.trustRoot}: $${(root.contributionCents / 100).toFixed(2)}${root.saturated ? `  <- ${root.adapterIds.length} credentials, counted once` : ''}`)
      }
    }
    side(label_a, a)
    lines.push('')
    side(label_b, b)
    lines.push('')

    const rootsA = new Map(a.roots.map((r) => [r.trustRoot, r.contributionCents]))
    const rootsB = new Map(b.roots.map((r) => [r.trustRoot, r.contributionCents]))
    const shared = [...rootsA.keys()].filter((r) => rootsB.has(r))
    if (shared.length) {
      lines.push(`shared roots (${shared.length}): ${shared.join(', ')} — evidence on a shared root is the same class of thing, not corroboration between the two subjects`)
    }
    const heldA = a.evidence.filter((e) => e.held).length
    const heldB = b.evidence.filter((e) => e.held).length
    if ((heldA > heldB && a.independentRoots < b.independentRoots) || (heldB > heldA && b.independentRoots < a.independentRoots)) {
      const many = heldA > heldB ? label_a : label_b
      lines.push(`note: ${many} holds more credentials but fewer independent roots — the extra credentials are correlated and saturate. This is the sybil-farm signature: quantity that collapses.`)
    }
    lines.push('')
    lines.push('No verdict: admitting either is a threshold decision, and it stays with the caller (check_personhood takes one explicitly).')
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
