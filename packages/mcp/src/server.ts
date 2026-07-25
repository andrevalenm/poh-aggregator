#!/usr/bin/env node
/**
 * Corroborate MCP server.
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
import { readFileSync } from 'node:fs'
import { Corroborate, DEFAULT_REGISTRY, weightHistory, type PersonhoodResult } from '@corroborate/sdk'

const ontologyPath = new URL('../../../ontology/adapters.json', import.meta.url)
let knownIds: string[] = []
let knownRoots: string[] = []
try {
  const o = JSON.parse(readFileSync(ontologyPath, 'utf8'))
  knownIds = o.adapters.map((a: { id: string }) => a.id)
  // Retired root names too: an as-of lookup reads revisions where they were still in force,
  // and without their preimages the interesting part of the history prints as raw hashes.
  knownRoots = [...Object.keys(o.trustRoots), ...Object.keys(o.retiredTrustRoots ?? {})]
} catch {
  // Hashes instead of names; degraded but correct.
}

const client = new Corroborate({
  registryAddress: (process.env.CORROBORATE_REGISTRY as `0x${string}`) ?? DEFAULT_REGISTRY,
  // The subgraph supplies trust-graph position, and issuance dates for protocols that keep
  // none on chain. Without it the server still works — PoH is dated from the contract either
  // way — but Circles results carry the issuance-date-unknown caveat.
  ...(process.env.CORROBORATE_SUBGRAPH_URL ? { subgraphUrl: process.env.CORROBORATE_SUBGRAPH_URL } : {}),
  // Only as_of needs this one — it is where the ontology's own history lives.
  ...(process.env.CORROBORATE_REGISTRY_SUBGRAPH_URL
    ? { registrySubgraphUrl: process.env.CORROBORATE_REGISTRY_SUBGRAPH_URL }
    : {}),
  knownIds,
  knownRoots,
})

const server = new McpServer({ name: 'corroborate', version: '0.1.0' })

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
    const url = process.env.CORROBORATE_REGISTRY_SUBGRAPH_URL
    if (!url) {
      return {
        content: [
          {
            type: 'text',
            text: 'CORROBORATE_REGISTRY_SUBGRAPH_URL is not set. The audit trail lives in the registry subgraph; without it, use explain_trust_roots for current weights (each carries its sourceURI).',
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
