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
import { Corroborate, DEFAULT_REGISTRY, type PersonhoodResult } from '@corroborate/sdk'

const ontologyPath = new URL('../../../ontology/adapters.json', import.meta.url)
let knownIds: string[] = []
let knownRoots: string[] = []
try {
  const o = JSON.parse(readFileSync(ontologyPath, 'utf8'))
  knownIds = o.adapters.map((a: { id: string }) => a.id)
  knownRoots = Object.keys(o.trustRoots)
} catch {
  // Hashes instead of names; degraded but correct.
}

const client = new Corroborate({
  registryAddress: (process.env.CORROBORATE_REGISTRY as `0x${string}`) ?? DEFAULT_REGISTRY,
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
  return lines.join('\n')
}

server.tool(
  'lookup_personhood',
  'Gather every proof-of-personhood credential for an address or ENS name and score it by independent trust root. Returns the evidence and what was discounted as correlated, never a bare verdict. Pass several addresses when the same person controls more than one wallet — real users hold different credentials on different addresses.',
  {
    subject: z
      .union([z.string(), z.array(z.string()).min(1)])
      .describe('An address, an ENS name, or several of either belonging to one person.'),
  },
  async ({ subject }) => {
    const r = await client.resolve(subject)
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
        'Score to clear. Rough guide: 1.0 ~ one weak credential, 2.0 ~ one solid credential, 2.5+ ~ several independent roots.',
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

const transport = new StdioServerTransport()
await server.connect(transport)
