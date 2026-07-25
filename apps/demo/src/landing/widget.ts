/**
 * The landing's live lookup — the product working, not a screenshot of it. Reuses the
 * console's instrumented client so every probe row is a real RPC round-trip, and keeps the
 * presentation compact: score, roots, caveat count, and a door to the full console for the
 * complete evidence table. The one thing we surface that the console doesn't lead with is
 * elapsed time, because "it answered in three seconds from public chains" is the point a
 * first visitor can feel.
 */
import type { PersonhoodResult } from '@corroborate/sdk'
import { makeClient, type ProbeEvent } from '../client.ts'
import { clear, fmtCents, fmtScore, h, shortAddr } from '../ui.ts'

const EXAMPLES: { label: string; value: string }[] = [
  {
    label: 'Three wallets, three protocols',
    value:
      '0x58b849f60b0515871fcfa80c7907d097571f2a12, 0xd267eba602e692216703626a81157214b24c85fb, 0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87',
  },
  { label: 'An Orb-verified wallet', value: '0x58b849f60b0515871fcfa80c7907d097571f2a12' },
  { label: 'A Proof of Humanity member', value: '0x17a91203a9e9c3519c2f76210497ef7f4be2352f' },
]

const STATE_COPY: Record<ProbeEvent['state'], string> = {
  idle: 'waiting',
  running: 'querying…',
  held: 'found',
  absent: 'none',
  unavailable: 'unreachable',
}

function probeRows(events: Map<string, ProbeEvent>): HTMLElement {
  const wrap = h('div')
  for (const [, ev] of [...events].sort((a, b) => a[0].localeCompare(b[0]))) {
    wrap.append(
      h(
        'div',
        { class: `probe-row is-${ev.state}` },
        h('span', { class: 'p-id' }, ev.adapterId),
        h('span', { class: 'p-addr' }, shortAddr(ev.address)),
        h('span', { class: 'p-state' }, STATE_COPY[ev.state]),
        h('span', { class: 'p-ms' }, ev.ms !== undefined ? `${ev.ms}ms` : ''),
      ),
    )
  }
  return wrap
}

/** The score numeral counts up like a meter settling — unless the visitor asked for calm. */
function scoreNumeral(score: number): HTMLElement {
  const el = h('span', { class: 'w-score' }, fmtScore(score))
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || score <= 0) return el
  const t0 = performance.now()
  const DURATION = 700
  const tick = (now: number) => {
    const t = Math.min((now - t0) / DURATION, 1)
    const eased = 1 - (1 - t) ** 3
    el.textContent = fmtScore(score * eased)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return el
}

function resultView(result: PersonhoodResult, elapsedMs: number): HTMLElement {
  const held = result.evidence.filter((e) => e.held).length
  const seconds = (elapsedMs / 1000).toFixed(1)

  return h(
    'div',
    { class: 'w-result' },
    h(
      'div',
      { class: 'w-score-row' },
      h(
        'div',
        {},
        h('span', { class: 'w-score-label' }, 'Root-cost score'),
        scoreNumeral(result.score),
      ),
      h(
        'p',
        { class: 'w-fact' },
        h('b', {}, `${fmtCents(result.totalCostCents)} of adversary cost`),
        ` across ${result.independentRoots} independent trust root${result.independentRoots === 1 ? '' : 's'} — ${held} credential${held === 1 ? '' : 's'} held, answered in ${seconds}s from public chains. No server involved.`,
      ),
    ),
    h(
      'div',
      { class: 'w-roots' },
      ...result.roots.map((r) =>
        h(
          'span',
          { class: `w-root${r.contributionCents > 0 ? '' : ' is-zero'}` },
          h('b', {}, r.trustRoot),
          ` ${fmtCents(r.contributionCents)}`,
          r.saturated ? ` · ${r.adapterIds.length}→1` : '',
        ),
      ),
    ),
    h(
      'p',
      { class: 'w-meta' },
      `${result.caveats.length} caveats travel with this result — they are the result, not small print. `,
      h('a', { href: '/app.html' }, 'Read them all in the console →'),
    ),
  )
}

export function mountWidget(): void {
  const form = document.getElementById('lookup-form') as HTMLFormElement
  const input = document.getElementById('lookup-input') as HTMLInputElement
  const submit = document.getElementById('lookup-submit') as HTMLButtonElement
  const streamEl = document.getElementById('probe-stream') as HTMLElement
  const resultEl = document.getElementById('widget-result') as HTMLElement
  const examplesRow = document.getElementById('examples-row') as HTMLElement

  for (const ex of EXAMPLES) {
    examplesRow.append(
      h(
        'button',
        {
          type: 'button',
          class: 'example-chip',
          onclick: () => {
            input.value = ex.value
            void run()
          },
        },
        ex.label,
      ),
    )
  }

  let inFlight = false

  async function run(): Promise<void> {
    if (inFlight) return
    const subjects = input.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    clear(streamEl)
    clear(resultEl)
    if (subjects.length === 0) {
      resultEl.append(h('p', { class: 'w-error' }, 'Give it at least one address or ENS name.'))
      return
    }

    inFlight = true
    submit.disabled = true
    submit.textContent = 'Reading chains…'
    streamEl.append(
      h(
        'p',
        { class: 'probe-lede' },
        `Probing 4 protocols against ${subjects.length} wallet${subjects.length === 1 ? '' : 's'}, live:`,
      ),
    )
    const slot = h('div')
    streamEl.append(slot)

    const events = new Map<string, ProbeEvent>()
    const client = makeClient((ev) => {
      events.set(`${ev.adapterId}:${ev.address}`, ev)
      clear(slot)
      slot.append(probeRows(events))
    })

    const started = performance.now()
    try {
      const result = await client.resolve(subjects)
      resultEl.append(resultView(result, performance.now() - started))
    } catch (err) {
      resultEl.append(
        h(
          'p',
          { class: 'w-error' },
          `Lookup failed: ${err instanceof Error ? err.message : String(err)}. A failed lookup says nothing about the subject — most likely a typo'd address or an unresolvable name.`,
        ),
      )
    } finally {
      inFlight = false
      submit.disabled = false
      submit.textContent = 'Resolve'
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void run()
  })
}
