import type { Evidence, PersonhoodResult } from '@corroborate/sdk'
import { makeClient, type ProbeEvent, type ProbeState } from './client.ts'
import { adapterNotes } from './known.ts'
import { saturationBlock } from './compare.ts'
import { clear, fmtCents, fmtScore, freshnessLabel, h, rootChip, shortAddr } from './ui.ts'

const STATE_COPY: Record<ProbeState, string> = {
  idle: 'waiting',
  running: 'querying…',
  held: 'credential found',
  absent: 'no credential',
  unavailable: 'unavailable',
}

function probeList(events: Map<string, ProbeEvent>): HTMLElement {
  const ul = h('ul', { class: 'probes' })
  for (const [, ev] of [...events].sort((a, b) => a[0].localeCompare(b[0]))) {
    ul.append(
      h(
        'li',
        { class: `probe probe-${ev.state}` },
        h('span', { class: 'probe-id' }, ev.adapterId),
        h('span', { class: 'probe-addr' }, shortAddr(ev.address)),
        h('span', { class: 'probe-state' }, STATE_COPY[ev.state]),
        ev.ms !== undefined ? h('span', { class: 'probe-ms' }, `${ev.ms}ms`) : null,
        ev.error ? h('span', { class: 'probe-error' }, ev.error) : null,
      ),
    )
  }
  return ul
}

function evidenceRow(e: Evidence): HTMLElement {
  const unavailable = e.detail?.['unavailable'] === true
  const cls = unavailable ? 'is-unavailable' : e.held ? 'is-held' : 'is-absent'
  const detailEntries = Object.entries(e.detail ?? {}).filter(([k]) => k !== 'unavailable')

  return h(
    'li',
    { class: `ev ${cls}` },
    h(
      'div',
      { class: 'ev-head' },
      h('span', { class: 'ev-name' }, e.adapterName),
      h(
        'span',
        { class: 'ev-verdict' },
        unavailable ? 'unavailable' : e.held ? 'held' : 'not found',
      ),
      h('span', { class: 'ev-cost' }, e.held ? fmtCents(e.effectiveCostCents) : '—'),
    ),
    h(
      'div',
      { class: 'ev-meta' },
      rootChip(e.trustRoot),
      h('span', { class: 'ev-class' }, e.evidenceClass),
      h('span', { class: 'ev-fresh' }, freshnessLabel(e.freshness, e.issuedAt)),
      h('span', { class: 'ev-on' }, `on ${shortAddr(e.observedOn)}`),
      !e.live ? h('span', { class: 'ev-dead' }, 'protocol discontinued — scored at zero') : null,
    ),
    unavailable
      ? h(
          'p',
          { class: 'ev-unavailable' },
          `This adapter could not be reached: ${String(e.detail?.['error'] ?? 'unknown error')}. That is an absence of an answer, not a negative one — it is excluded from the score rather than counted against the subject.`,
        )
      : null,
    detailEntries.length
      ? h(
          'p',
          { class: 'ev-detail' },
          detailEntries.map(([k, v]) => `${k}: ${String(v)}`).join(' · '),
        )
      : null,
    h(
      'p',
      { class: 'ev-cost-basis' },
      `forge ${fmtCents(e.forgeCostCents)} · rent ${fmtCents(e.rentCostCents)} — we price at the cheaper of the two.`,
      h('span', { class: 'ev-source' }, ` source: ${e.sourceURI}`),
    ),
    adapterNotes[e.adapterId] ? h('p', { class: 'ev-note' }, adapterNotes[e.adapterId]!) : null,
  )
}

function caveatList(result: PersonhoodResult): HTMLElement {
  return h(
    'section',
    { class: 'caveats' },
    h('h4', {}, `Caveats (${result.caveats.length})`),
    h(
      'p',
      { class: 'caveats-lede' },
      'Reproduced in full and in the SDK’s own words. These are the result, not the small print — a score without them is a number pretending to be a fact.',
    ),
    h(
      'ul',
      {},
      ...result.caveats.map((c) =>
        h('li', { class: 'caveat' }, h('code', {}, c.code), h('span', {}, c.message)),
      ),
    ),
  )
}

/**
 * The threshold control.
 *
 * It starts with nothing selected and shows no verdict until the user moves it. That is the
 * whole point: at a plausible 2% sybil rate a 95%-specificity classifier is wrong about
 * roughly three quarters of the people it flags, so a default threshold shipped by us would
 * be us making a denial decision on behalf of a consumer who never saw the tradeoff.
 */
function thresholdControl(result: PersonhoodResult): HTMLElement {
  const verdict = h('div', { class: 'verdict verdict-unset' })
  const readout = h('span', { class: 'threshold-readout' }, 'not set')
  let chosen: number | null = null

  const paint = () => {
    clear(verdict)
    if (chosen === null) {
      verdict.className = 'verdict verdict-unset'
      readout.textContent = 'not set'
      verdict.append(
        h('b', {}, 'No verdict. '),
        'Corroborate does not choose a threshold for you, and will not guess one. Move the slider to see what your own cutoff would decide — the decision, and its consequences for the person on the other side, belong to whoever is doing the admitting.',
      )
      return
    }
    const passes = result.isHuman(chosen)
    verdict.className = `verdict ${passes ? 'verdict-pass' : 'verdict-fail'}`
    readout.textContent = chosen.toFixed(2)
    verdict.append(
      h(
        'b',
        {},
        passes
          ? `Above your threshold of ${chosen.toFixed(2)}.`
          : `Below your threshold of ${chosen.toFixed(2)}.`,
      ),
      ` Score ${fmtScore(result.score)} across ${result.independentRoots} independent root${result.independentRoots === 1 ? '' : 's'}. This is your cutoff applied to our evidence, not our judgement of this subject.`,
    )
  }

  const slider = h('input', {
    type: 'range',
    min: '0',
    max: '4',
    step: '0.05',
    value: '0',
    class: 'threshold-slider is-unset',
    id: 'threshold',
  }) as HTMLInputElement

  const onMove = () => {
    chosen = Number(slider.value)
    slider.classList.remove('is-unset')
    paint()
  }
  slider.addEventListener('input', onMove)
  slider.addEventListener('change', onMove)

  const clearBtn = h(
    'button',
    {
      type: 'button',
      class: 'threshold-clear',
      onclick: () => {
        chosen = null
        slider.value = '0'
        slider.classList.add('is-unset')
        paint()
      },
    },
    'Clear threshold',
  )

  paint()

  return h(
    'section',
    { class: 'threshold' },
    h('h4', {}, 'Your threshold'),
    h(
      'p',
      { class: 'threshold-lede' },
      'The threshold is the consumer’s decision, never ours. The SDK enforces this in the type system: ',
      h('code', {}, 'isHuman(threshold)'),
      ' throws if you do not pass one.',
    ),
    h(
      'div',
      { class: 'threshold-row' },
      h('label', { for: 'threshold' }, 'Cutoff'),
      slider,
      readout,
      clearBtn,
    ),
    verdict,
  )
}

function resultView(result: PersonhoodResult): HTMLElement {
  const unavailable = result.evidence.filter((e) => e.detail?.['unavailable'] === true)

  return h(
    'div',
    { class: 'result' },
    h(
      'div',
      { class: 'result-head' },
      h(
        'div',
        { class: 'headline' },
        h('span', { class: 'headline-label' }, 'Root-cost score'),
        h('span', { class: 'headline-value' }, fmtScore(result.score)),
        h('span', { class: 'headline-sub' }, `log₁₀ of ${fmtCents(result.totalCostCents)} adversary cost`),
      ),
      h(
        'div',
        { class: 'headline' },
        h('span', { class: 'headline-label' }, 'Independent roots'),
        h('span', { class: 'headline-value' }, String(result.independentRoots)),
        h('span', { class: 'headline-sub' }, 'distinct, uncorrelated sources of evidence'),
      ),
      h(
        'div',
        { class: 'headline headline-small' },
        h('span', { class: 'headline-label' }, 'Subject'),
        h('span', { class: 'headline-addrs' }, result.subjects.map(shortAddr).join(' + ')),
        h(
          'span',
          { class: 'headline-sub' },
          result.name
            ? `resolved from ${result.name} · registry rev ${result.registryRevision ?? '—'}`
            : `registry rev ${result.registryRevision ?? '—'}`,
        ),
      ),
    ),
    unavailable.length
      ? h(
          'p',
          { class: 'banner banner-warn' },
          `${unavailable.length} adapter${unavailable.length === 1 ? '' : 's'} could not be reached (${unavailable.map((e) => e.adapterId).join(', ')}). The score below is computed from what did answer. An unreachable protocol is unavailable, never a negative.`,
        )
      : null,
    thresholdControl(result),
    h('h4', { class: 'sub' }, 'Saturation by trust root'),
    saturationBlock(result),
    h('h4', { class: 'sub' }, `Evidence (${result.evidence.length} adapters queried)`),
    h('ul', { class: 'evidence' }, ...result.evidence.map(evidenceRow)),
    caveatList(result),
  )
}

// ------------------------------------------------------------------ driver

/**
 * Real, live example subjects so a first-time visitor never faces an empty input.
 * All three are wallets found on-chain during the build — nothing curated by hand beyond
 * that, and nothing here is special-cased in scoring.
 */
const EXAMPLES: { label: string; value: string }[] = [
  {
    label: 'Three wallets, three roots',
    value:
      '0x58b849f60b0515871fcfa80c7907d097571f2a12, 0xd267eba602e692216703626a81157214b24c85fb, 0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87',
  },
  { label: 'An Orb-verified wallet', value: '0x58b849f60b0515871fcfa80c7907d097571f2a12' },
  { label: 'A Proof of Humanity member', value: '0x17a91203a9e9c3519c2f76210497ef7f4be2352f' },
]

export function wireLookup(): void {
  const form = document.getElementById('lookup-form') as HTMLFormElement
  const input = document.getElementById('lookup-input') as HTMLInputElement
  const submit = document.getElementById('lookup-submit') as HTMLButtonElement
  const statusEl = document.getElementById('lookup-adapters') as HTMLElement
  const resultEl = document.getElementById('lookup-result') as HTMLElement

  const examplesRow = h(
    'div',
    { class: 'examples-row' },
    h('span', { class: 'muted' }, 'Try: '),
    ...EXAMPLES.map((ex) =>
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
    ),
  )
  form.insertAdjacentElement('afterend', examplesRow)

  let inFlight = false

  async function run(): Promise<void> {
    if (inFlight) return
    const subjects = input.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    clear(resultEl)
    clear(statusEl)
    if (subjects.length === 0) {
      resultEl.append(h('p', { class: 'error' }, 'Give me at least one address or ENS name.'))
      return
    }

    inFlight = true
    submit.disabled = true
    submit.textContent = 'Resolving…'
    statusEl.append(
      h('p', { class: 'probes-lede' }, `Probing every adapter against ${subjects.length} address${subjects.length === 1 ? '' : 'es'}. Public RPCs are slow; each one reports independently.`),
    )

    const events = new Map<string, ProbeEvent>()
    const listSlot = h('div')
    statusEl.append(listSlot)
    const repaint = () => {
      clear(listSlot)
      listSlot.append(probeList(events))
    }

    const client = makeClient((ev) => {
      events.set(`${ev.adapterId}:${ev.address}`, ev)
      repaint()
    })

    try {
      const result = await client.resolve(subjects)
      clear(resultEl)
      resultEl.append(resultView(result))
    } catch (err) {
      clear(resultEl)
      resultEl.append(
        h(
          'div',
          { class: 'error' },
          h('b', {}, 'Lookup failed. '),
          String(err instanceof Error ? err.message : err),
          h(
            'p',
            {},
            'A failed lookup says nothing about the subject. Most likely an unresolvable ENS name, a malformed address, or an RPC that is down.',
          ),
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
