import './landing.css'
import { DEFAULT_REGISTRY, makeClient } from '../client.ts'
import { h, shortAddr } from '../ui.ts'
import { mountFingerprint } from './fingerprint.ts'
import { mountSmudge } from './smudge.ts'
import { mountWidget } from './widget.ts'

// ------------------------------------------------------------- registry line

async function paintRegistryLine(): Promise<void> {
  const el = document.getElementById('registry-line')
  if (!el) return
  const pulse = h('span', { class: 'pulse', 'aria-hidden': 'true' })
  try {
    const { adapters, revision } = await makeClient().ontology()
    const roots = new Set([...adapters.values()].map((a) => a.trustRoot))
    el.textContent = ''
    el.append(
      pulse,
      `live — ${adapters.size} protocols, ${roots.size} trust roots · registry ${shortAddr(DEFAULT_REGISTRY)} rev ${revision}, read just now`,
    )
  } catch {
    el.textContent = ''
    el.append(pulse, 'registry unreachable right now — the demo below will say so rather than guess')
  }
}

// --------------------------------------------------------------- MCP picker

interface ClientOption {
  id: string
  label: string
  command: string
  note?: string
}

const MCP_CLIENTS: ClientOption[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude mcp add corroborate -- npx -y @corroborate/mcp',
    note: 'Then ask: “is 0xd267…85fb a person? which evidence is correlated?”',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    command: `{
  "mcpServers": {
    "corroborate": {
      "command": "npx",
      "args": ["-y", "@corroborate/mcp"]
    }
  }
}`,
    note: 'Settings → MCP → Add server, or drop this in .cursor/mcp.json.',
  },
  {
    id: 'codex',
    label: 'Codex',
    command: 'codex mcp add corroborate -- npx -y @corroborate/mcp',
    note: 'Registers the four tools with the Codex CLI.',
  },
  {
    id: 'any',
    label: 'Any MCP client',
    command: 'npx -y @corroborate/mcp',
    note: 'Plain stdio server. Optional: CORROBORATE_SUBGRAPH_URL for issuance-date enrichment.',
  },
]

function mountPicker(): void {
  const tabs = document.getElementById('mcp-picker')
  const commandEl = document.getElementById('mcp-command')
  if (!tabs || !commandEl) return

  const paint = (chosen: ClientOption) => {
    for (const b of tabs.querySelectorAll('button')) {
      b.setAttribute('aria-selected', String(b.dataset['id'] === chosen.id))
    }
    commandEl.textContent = ''
    const pre = h(
      'pre',
      {},
      h('code', {}, chosen.command),
      copyButton(chosen.command, `Copy the ${chosen.label} command`),
    )
    commandEl.append(pre)
    if (chosen.note) commandEl.append(h('p', { class: 'command-note' }, chosen.note))
  }

  for (const c of MCP_CLIENTS) {
    tabs.append(
      h(
        'button',
        { type: 'button', role: 'tab', 'data-id': c.id, onclick: () => paint(c) },
        c.label,
      ),
    )
  }
  paint(MCP_CLIENTS[0]!)
}

function copyButton(text: string, label: string): HTMLElement {
  const btn = h('button', { class: 'copy-btn', type: 'button', 'aria-label': label }, 'copy')
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text)
      btn.textContent = 'copied'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = 'copy'
        btn.classList.remove('copied')
      }, 1600)
    } catch {
      btn.textContent = 'select it'
    }
  })
  return btn
}

// ------------------------------------------------------------------ reveals

function mountReveals(): void {
  const els = document.querySelectorAll('.reveal')
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of els) el.classList.add('in')
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -40px 0px' },
  )
  for (const el of els) io.observe(el)
}

// -------------------------------------------------------------------- mount

mountFingerprint(document.getElementById('print') as HTMLCanvasElement)
mountSmudge(document.getElementById('smudge') as HTMLCanvasElement)
mountWidget()
mountPicker()
mountReveals()
document.querySelectorAll<HTMLButtonElement>('.copy-btn[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset['copy'] ?? '')
      btn.textContent = 'copied'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = 'copy'
        btn.classList.remove('copied')
      }, 1600)
    } catch {
      btn.textContent = 'select it'
    }
  })
})
void paintRegistryLine()
