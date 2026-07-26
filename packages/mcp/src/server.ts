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
import { Print, DEFAULT_REGISTRY, weightHistory, type PersonhoodResult } from '@printid/sdk'
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

/**
 * Compact, agent-legible rendering. Full detail stays available via the raw result.
 *
 * Root count leads and the score comes after it, because an agent that reads only the score
 * can be misled in the adversary's favour. Costs saturate within a trust root and sum across
 * roots, so on the deployed ontology four credentials derived from one passport chip
 * (world-id-document, zkpassport, self-protocol, rarimo) score 3.30 off a single root, while
 * four credentials from four different roots (World Orb, PoH, Circles, wallet history) score
 * 2.85. The farm outscores the person; only the root count inverts. Ordering the output so the
 * misleading number arrives first was an output-format bug, not a matter of taste.
 */
function render(r: PersonhoodResult): string {
  const lines: string[] = []
  lines.push(`subject: ${r.subjects.join(', ')}${r.name ? ` (${r.name})` : ''}`)
  lines.push(
    `independent trust roots: ${r.independentRoots}   <- read this first: it is what separates a person from a farm`,
  )
  lines.push('')

  const held = r.evidence.filter((e) => e.held)
  if (held.length === 0) {
    lines.push('credentials: none found')
  } else {
    lines.push(`credentials held (${held.length}):`)
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
  lines.push(
    `score: ${r.score.toFixed(2)}  (log10 of adversary cost in cents; cheapest attack costs $${(r.totalCostCents / 100).toFixed(2)})`,
  )
  lines.push(
    '  Do not rank subjects on this alone. It prices the cheapest attack, and because costs',
    '  saturate within a root, many credentials off one root can outscore few credentials off',
    '  several — 3.30 for four proofs of one passport chip against 2.85 for four separate roots.',
  )

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
  'Find which proof-of-personhood credentials an address or ENS name holds, and how many INDEPENDENT trust roots stand behind them. The root count is the number to read: credentials tracing to the same root — one passport chip presented to four protocols — are one piece of evidence, not four, and the response names the ones discounted as correlated. Returns the evidence and the caveats, never a bare verdict. Pass several addresses when the same person controls more than one wallet — real users hold different credentials on different addresses.',
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
  'Decide whether the credentials a subject holds clear a threshold you specify. There is no default threshold on purpose: at a plausible sybil rate a strong classifier still misjudges most of the people it flags, so the choice to deny belongs to you. The full evidence and its independent-trust-root count come back with the verdict — check the root count before acting on PASS, because a threshold cannot see the difference between several independent roots and several credentials off one. Prefer escalating (asking for another credential) over denying.',
  {
    subject: z.union([z.string(), z.array(z.string()).min(1)]),
    threshold: z
      .number()
      .describe(
        'Score to clear. Calibration against the deployed ontology: ~1.7 is cleared by a single easily-rented credential, ~2.7 by a PoH registration, ~3.5 by a KYC-rooted credential OR by several independent roots — and those last two are not the same finding, which is why the root count in the result matters more than where you put this number. Exported presets: lenient 1.5, standard 2.5, strict 3.5.',
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
  'The map of which personhood protocols read which trust root — what you need to tell whether two credentials are independent evidence or the same evidence counted twice. Protocols sharing a root are marked SHARED. Each entry also carries what it proves and what it costs to forge or rent, but the sharing structure is the point of this tool.',
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
  'Whether one protocol\'s standing in the ontology has changed, and on whose evidence: the full audit trail for a single adapter, every revision it has ever been given, each with the source it was derived from and the block it landed in. The ontology\'s judgments are curated, and this history is what makes them accountable — if an adapter was re-rated or marked discontinued, this shows exactly when and why.',
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

const transport = new StdioServerTransport()
await server.connect(transport)
