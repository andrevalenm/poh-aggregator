import './landing.css'
import Lenis from 'lenis'
import { h, shortAddr } from '../ui.ts'
import { mountFingerprint, stampPrint } from './fingerprint.ts'
import { mountPaper } from './paper.ts'
import { mountContours } from './contours.ts'
import { mountCursor } from './cursor.ts'
import { mountInkPress } from './inkpress.ts'
import { mountWidget } from './widget.ts'

// ------------------------------------------------------------- registry line

async function paintRegistryLine(): Promise<void> {
  const el = document.getElementById('registry-line')
  if (!el) return
  const pulse = h('span', { class: 'pulse', 'aria-hidden': 'true' })
  try {
    // The SDK (and viem underneath) is 116 KiB gz — off the critical path, on demand.
    const { DEFAULT_REGISTRY, makeClient } = await import('../client.ts')
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
      h('button', { type: 'button', role: 'tab', 'data-id': c.id, onclick: () => paint(c) }, c.label),
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
  const els = document.querySelectorAll<HTMLElement>('.reveal')
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of els) el.classList.add('in')
    return
  }
  // Siblings cascade rather than arriving as one block.
  for (const el of els) {
    const siblings = el.parentElement
      ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal'))
      : []
    const idx = Math.max(siblings.indexOf(el), 0)
    el.style.transitionDelay = `${Math.min(idx * 110, 440)}ms`
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

// ------------------------------------------------------------ torn edge

/** The one place the sheet tears: where paper gives way to the night sections. */
function mountTornEdges(): void {
  let s = 0x7041
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  for (const svg of document.querySelectorAll<SVGElement>('svg[data-torn]')) {
    svg.setAttribute('viewBox', '0 0 100 24')
    const pts: string[] = ['0,24']
    for (let x = 0; x <= 100; x += 1.1 + rand() * 1.3) {
      const y = 6 + rand() * 12 + Math.sin(x * 0.5) * 2
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    pts.push('100,24')
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    poly.setAttribute('points', pts.join(' '))
    svg.append(poly)
  }
}

// ----------------------------------------------- smooth scroll + parallax

function mountScroll(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const parallaxEls = [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    speed: Number(el.dataset['parallax'] ?? 0.1),
    baseCenter: 0,
  }))
  const measure = () => {
    for (const p of parallaxEls) {
      // offsetTop chains ignore transforms, so measurement is feedback-free.
      let top = 0
      let node: HTMLElement | null = p.el
      while (node) {
        top += node.offsetTop
        node = node.offsetParent as HTMLElement | null
      }
      p.baseCenter = top + p.el.offsetHeight / 2
    }
  }
  measure()
  addEventListener('resize', measure)

  const applyParallax = () => {
    const vh = innerHeight
    const sy = scrollY
    for (const p of parallaxEls) {
      const progress = sy + vh / 2 - p.baseCenter
      p.el.style.transform = `translate3d(0, ${(progress * p.speed).toFixed(1)}px, 0)`
    }
  }

  if (reduced) return

  const lenis = new Lenis({ autoRaf: false, lerp: 0.11 })
  let lastApplied = -1
  const raf = (time: number) => {
    lenis.raf(time)
    if (scrollY !== lastApplied) {
      lastApplied = scrollY
      applyParallax()
    }
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  // Anchor links glide instead of jumping.
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href') ?? '')
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: 0, duration: 1.4 })
    })
  }
}

// -------------------------------------------------------------------- mount

// Canvas work held past the first paint: the sheet lands one frame in, the print and
// contours at idle. Mobile Lighthouse put 3s of element-render delay on these mounts
// running synchronously at module scope.
requestAnimationFrame(() => {
  mountPaper(document.getElementById('paper') as HTMLCanvasElement)
})
const idle: (cb: () => void) => void =
  'requestIdleCallback' in window ? (cb) => requestIdleCallback(cb, { timeout: 900 }) : (cb) => setTimeout(cb, 120)
idle(() => {
  // The print is ink on paper now. Narrow screens get the finished print instantly —
  // at 0.16 alpha behind text, a 2.6s stroke animation is pure main-thread waste.
  mountFingerprint(document.getElementById('print') as HTMLCanvasElement, {
    rgb: '42 35 27',
    wideAlpha: 0.78,
    narrowAlpha: 0.16,
  })
})
idle(() => {
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-contours]')) {
    mountContours(canvas, 0x7e44a1 + Number(canvas.dataset['contours']) * 0x1f2e3d)
  }
})
mountCursor()
mountInkPress()
mountWidget()
mountPicker()
mountReveals()
mountTornEdges()
mountScroll()

// The headline rises line-by-line out of its masks — after Fraunces is ready, so the
// lines never slide up in a fallback face and swap mid-transition. 400ms cap: a slow
// font must not hold the page hostage.
void Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 400))]).then(() =>
  requestAnimationFrame(() => document.querySelector('.hero h1')?.classList.add('sl-in')),
)

// Seamless ticker: the track needs its content twice for the -50% translate loop.
const tickerTrack = document.getElementById('ticker-track')
if (tickerTrack) tickerTrack.innerHTML += tickerTrack.innerHTML

// The colophon seal: the same print, pressed small in iron.
const stamp = document.getElementById('stamp') as HTMLCanvasElement | null
if (stamp) stampPrint(stamp, '#a6431f', 0.95)

void paintRegistryLine()
