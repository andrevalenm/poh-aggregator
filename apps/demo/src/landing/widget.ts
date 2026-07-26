/**
 * The landing's live lookup — the product working, not a screenshot of it. This module owns the
 * form, the probe stream and the wiring; `result.ts` owns how the answer reads. Reuses the
 * console's instrumented client so every row is a real RPC round-trip.
 *
 * Note on imports: nothing here may import the SDK or the ontology JSON as a *value*. Both
 * arrive through `clientModule()`, the one dynamic boundary, which keeps viem off the landing's
 * critical path. `Thresholds` and the trust-root descriptions therefore travel as arguments
 * into `resultView` rather than as imports of it.
 */
import type { ProbeEvent } from '../client.ts'
import { clear, h, shortAddr } from '../ui.ts'
import { resultView } from './result.ts'

/** viem + SDK load on demand — at idle in the background, or at first resolve. */
const clientModule = () => import('../client.ts')

const EXAMPLES: { label: string; value: string }[] = [
  {
    label: 'Three wallets, three protocols',
    value:
      '0x58b849f60b0515871fcfa80c7907d097571f2a12, 0xd267eba602e692216703626a81157214b24c85fb, 0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87',
  },
  { label: 'An Orb-verified wallet', value: '0x58b849f60b0515871fcfa80c7907d097571f2a12' },
  { label: 'A Proof of Humanity v2 member', value: '0x17a91203a9e9c3519c2f76210497ef7f4be2352f' },
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
    // Retire the "borrow one of these" marginalia: the reader has clearly worked out how to
    // use the field, so the pencil mark is now just something in the way.
    document.getElementById('widget')?.classList.add('has-run')
    const { makeClient, LIVE_ADAPTER_IDS, Thresholds, rootDescriptions } = await clientModule()
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

    // With the full adapter roster a multi-wallet lookup streams dozens of rows. Watching them
    // arrive is the most direct evidence on the page that nothing is precomputed — but leaving
    // the wall above the answer makes the verdict compete with its own working-out. So the
    // stream is not thrown away on completion: the sheet keeps a one-line summary, and the rows
    // themselves are HANDED to the console, timings and arrival order intact.
    const settleReceipt = () => {
      const all = [...events.values()]
      const held = all.filter((ev) => ev.state === 'held').length
      const unavailable = all.filter((ev) => ev.state === 'unavailable').length
      const absent = all.length - held - unavailable
      // Detach rather than clear: `slot` is about to be re-parented into the console, so
      // emptying streamEl would destroy the very rows we are preserving.
      slot.remove()
      clear(streamEl)
      streamEl.append(
        h(
          'p',
          { class: 'probe-receipt' },
          `${all.length} probes · ${held} found · ${absent} empty${
            unavailable ? ` · ${unavailable} unreachable` : ''
          }`,
          h('span', { class: 'probe-receipt-note' }, 'every read is kept in the console below'),
        ),
      )
    }

    const started = performance.now()
    try {
      const result = await client.resolve(subjects)
      settleReceipt()
      resultEl.append(
        resultView(result, performance.now() - started, Thresholds, rootDescriptions, slot),
      )
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
