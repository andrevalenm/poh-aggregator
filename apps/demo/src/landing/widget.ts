/**
 * The landing's live lookup — the product working, not a screenshot of it. Reuses the
 * console's instrumented client so every probe row is a real RPC round-trip, and keeps the
 * presentation compact: score, roots, caveat count, and a door to the full console for the
 * complete evidence table. The one thing we surface that the console doesn't lead with is
 * elapsed time, because "it answered in three seconds from public chains" is the point a
 * first visitor can feel.
 */
import type { Evidence, PersonhoodResult } from '@print/sdk'
import type { ProbeEvent } from '../client.ts'
import { clear, fmtCents, fmtScore, freshnessLabel, h, shortAddr } from '../ui.ts'

/** viem + SDK load on demand — at idle in the background, or at first resolve. */
const clientModule = () => import('../client.ts')

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

/**
 * The score numeral counts up like a meter settling, then STAMPS — a squash-spring
 * settle with an iron blot blooming beneath, the seal pressed into the sheet. The most
 * important number on the page arrives under the same physical law as everything else.
 * Reduced motion gets the plain number.
 */
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
    else el.classList.add('stamped')
  }
  requestAnimationFrame(tick)
  return el
}

/**
 * The console, brought into the sheet: the threshold is the consumer's decision (no
 * verdict until the slider moves — isHuman() throws without an explicit cutoff, and the
 * UI honours the same rule), and the full evidence and caveats unfold in place.
 */
function thresholdBlock(result: PersonhoodResult): HTMLElement {
  const readout = h('span', { class: 'th-readout' }, 'not set')
  const verdict = h(
    'p',
    { class: 'th-verdict is-unset' },
    'No verdict yet — and none until you choose a cutoff. The decision, and its consequences for the person on the other side, belong to whoever is doing the admitting.',
  )
  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '4',
    step: '0.05',
    value: '0',
    class: 'th-slider is-unset',
    'aria-label': 'Your threshold',
  }) as HTMLInputElement
  const onMove = () => {
    const v = Number(slider.value)
    slider.classList.remove('is-unset')
    readout.textContent = v.toFixed(2)
    const pass = result.isHuman(v)
    verdict.className = `th-verdict ${pass ? 'is-pass' : 'is-fail'}`
    verdict.textContent = pass
      ? `Above your ${v.toFixed(2)} cutoff — admitted by your rule, applied to our evidence.`
      : `Below your ${v.toFixed(2)} cutoff — refused by your rule, applied to our evidence.`
  }
  slider.addEventListener('input', onMove)
  // Scale marks at the SDK's exported Thresholds — the instrument matches the API.
  const tick = (v: number, label: string) =>
    h('span', { class: 'th-tick', style: `left: ${(v / 4) * 100}%` }, h('i'), label)
  return h(
    'div',
    { class: 'th-block' },
    h('span', { class: 'w-score-label' }, 'Your threshold'),
    h(
      'div',
      { class: 'th-row' },
      h(
        'div',
        { class: 'th-track' },
        slider,
        h('div', { class: 'th-ticks', 'aria-hidden': 'true' }, tick(1.5, 'lenient'), tick(2.5, 'standard'), tick(3.5, 'strict')),
      ),
      readout,
    ),
    verdict,
  )
}

function evidenceRow(e: Evidence): HTMLElement {
  const unavailable = e.detail?.['unavailable'] === true
  return h(
    'div',
    { class: `evd-row${e.held ? ' is-held' : ''}` },
    h(
      'div',
      { class: 'evd-head' },
      h('span', { class: 'evd-name' }, e.adapterName),
      h('span', { class: 'evd-verdict' }, unavailable ? 'unreachable' : e.held ? 'held' : 'not found'),
      h('span', { class: 'evd-cost' }, e.held ? fmtCents(e.effectiveCostCents) : '—'),
    ),
    h(
      'p',
      { class: 'evd-meta' },
      `${e.trustRoot} · ${freshnessLabel(e.freshness, e.issuedAt)} · on ${shortAddr(e.observedOn)} · forge ${fmtCents(e.forgeCostCents)} / rent ${fmtCents(e.rentCostCents)} — priced at the cheaper`,
    ),
  )
}

function evidenceDetails(result: PersonhoodResult): HTMLElement {
  const rank = (e: Evidence) => (e.held ? 0 : e.detail?.['unavailable'] === true ? 1 : 2)
  const sorted = [...result.evidence].sort(
    (a, b) => rank(a) - rank(b) || b.effectiveCostCents - a.effectiveCostCents,
  )
  return h(
    'details',
    { class: 'ledger-details' },
    h('summary', {}, `Full evidence — ${result.evidence.length} adapter reads`),
    h('div', { class: 'evd-rows' }, ...sorted.map(evidenceRow)),
  )
}

function caveatsDetails(result: PersonhoodResult): HTMLElement {
  return h(
    'details',
    { class: 'ledger-details' },
    h('summary', {}, `Caveats, in the SDK's own words — ${result.caveats.length}`),
    h(
      'ul',
      { class: 'cv-list' },
      ...result.caveats.map((c) => h('li', {}, h('code', {}, c.code), h('span', {}, c.message))),
    ),
  )
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
    thresholdBlock(result),
    fullDetailBlock(result),
  )
}

/**
 * The console, absorbed: one button unfolds the complete technical record in place —
 * evidence first, caveats a beat later, then the view glides to it. No separate page.
 */
function fullDetailBlock(result: PersonhoodResult): HTMLElement {
  const evidence = evidenceDetails(result)
  const caveats = caveatsDetails(result)
  const wrap = h('div', { class: 'w-full-detail' }, evidence, caveats)

  const btn = h(
    'button',
    { type: 'button', class: 'detail-btn', 'aria-expanded': 'false' },
    'Show the full technical detail',
  )
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true'
    if (open) {
      evidence.removeAttribute('open')
      caveats.removeAttribute('open')
      btn.setAttribute('aria-expanded', 'false')
      btn.textContent = 'Show the full technical detail'
      return
    }
    btn.setAttribute('aria-expanded', 'true')
    btn.textContent = 'Fold the detail away'
    evidence.setAttribute('open', '')
    setTimeout(() => caveats.setAttribute('open', ''), 180)
    setTimeout(() => evidence.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120)
  })

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'w-meta' },
      h('span', {}, 'The caveats are the result, not small print. '),
      btn,
    ),
    wrap,
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
    const { makeClient, LIVE_ADAPTER_IDS } = await clientModule()
    streamEl.append(
      h(
        'p',
        { class: 'probe-lede' },
        `Probing the ${LIVE_ADAPTER_IDS.length} live adapters against ${subjects.length} wallet${subjects.length === 1 ? '' : 's'}:`,
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

    // With the full adapter roster a multi-wallet lookup streams dozens of rows — the
    // drama is worth it live, the residue is not. On completion the receipt settles:
    // credentials found stay line-by-line, the empties fold into one tally.
    const settleReceipt = () => {
      const all = [...events.values()]
      const held = all.filter((ev) => ev.state === 'held')
      const unavailable = all.filter((ev) => ev.state === 'unavailable')
      const absent = all.length - held.length - unavailable.length
      const settled = new Map(
        [...events].filter(([, ev]) => ev.state === 'held' || ev.state === 'unavailable'),
      )
      clear(slot)
      slot.append(probeRows(settled))
      slot.append(
        h(
          'div',
          { class: 'probe-row is-summary' },
          h('span', { class: 'p-id' }, `${all.length} probes`),
          h(
            'span',
            { class: 'p-state' },
            `${held.length} found · ${absent} empty${unavailable.length ? ` · ${unavailable.length} unreachable` : ''}`,
          ),
        ),
      )
    }

    const started = performance.now()
    try {
      const result = await client.resolve(subjects)
      settleReceipt()
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
