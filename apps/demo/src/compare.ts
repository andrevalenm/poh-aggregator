import { score, freshnessOf, effectiveCost } from '@print/sdk'
import type { Address, Adapter, Evidence, PersonhoodResult } from '@print/sdk'
import { makeClient, type ProbeEvent } from './client.ts'
import { adapterNotes, rootDescriptions } from './known.ts'
import { clear, fmtCents, fmtScore, h, rootChip, rootHue, shortAddr } from './ui.ts'

/**
 * The comparison panel.
 *
 * Left: three protocols reading one passport. Right: one person across two wallets. Both are
 * scored twice — once the naive additive way that most reputation systems use, once by root
 * cost — so the difference is visible rather than asserted.
 */

/** Three protocols, one passport chip. All on `state-document:icao-9303`. */
const FARM_ADAPTER_IDS = ['world-id-document', 'zkpassport', 'self-protocol'] as const

/**
 * Real wallets. Proof of Humanity on one, Circles on the other — verified live during the
 * build. No single address in the wild held two protocols, which is why `resolve()` takes a
 * set in the first place.
 */
export const PERSON_ADDRESSES: Address[] = [
  '0xd267eba602e692216703626a81157214b24c85fb',
  '0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87',
]

/** Placeholder subject for the constructed column. Deliberately not a real wallet. */
const ILLUSTRATIVE_SUBJECT = '0x0000000000000000000000000000000000000000' as Address

interface Column {
  key: 'farm' | 'person'
  title: string
  caption: string
  provenance: { label: string; kind: 'illustrative' | 'live' }
  subjectLabel: string
  result: PersonhoodResult
  /** log10 of the un-saturated sum — every credential counted as its own proof. */
  additiveScore: number
  additiveCents: number
}

function additiveOf(evidence: Evidence[]): { cents: number; score: number } {
  const cents = evidence.filter((e) => e.held).reduce((s, e) => s + e.effectiveCostCents, 0)
  return { cents, score: cents <= 0 ? 0 : Number(Math.log10(cents + 1).toFixed(4)) }
}

/** Build Evidence for an adapter as if the subject held it. Used only by the farm column. */
function constructedEvidence(adapter: Adapter, observedOn: Address, now: number): Evidence {
  const freshness = freshnessOf(adapter, undefined, now)
  return {
    adapterId: adapter.id,
    adapterName: adapter.name,
    evidenceClass: adapter.evidenceClass,
    trustRoot: adapter.trustRoot,
    observedOn,
    held: true,
    freshness,
    effectiveCostCents: effectiveCost(adapter, freshness),
    forgeCostCents: adapter.forgeCostCents,
    rentCostCents: adapter.rentCostCents,
    live: adapter.live,
    sourceURI: adapter.sourceURI,
  }
}

// ---------------------------------------------------------------- rendering

function evidenceRow(e: Evidence): HTMLElement {
  return h(
    'li',
    { class: 'cred' },
    h(
      'div',
      { class: 'cred-head' },
      h('span', { class: 'cred-name' }, e.adapterName),
      h('span', { class: 'cred-cost' }, fmtCents(e.effectiveCostCents)),
    ),
    h(
      'div',
      { class: 'cred-meta' },
      rootChip(e.trustRoot),
      h('span', { class: 'cred-class' }, e.evidenceClass),
    ),
  )
}

export function saturationBlock(result: PersonhoodResult): HTMLElement {
  const box = h('div', { class: 'saturation' })
  for (const r of result.roots) {
    const strongest = result.evidence
      .filter((e) => e.held && e.trustRoot === r.trustRoot)
      .reduce((a, b) => (b.effectiveCostCents > a.effectiveCostCents ? b : a))

    const chips = h('div', { class: 'sat-chips' })
    for (const id of r.adapterIds) {
      const counted = !r.saturated || strongest.adapterId === id
      chips.append(
        h(
          'span',
          { class: `sat-chip${counted ? '' : ' is-collapsed'}` },
          id,
          h('em', {}, counted ? 'counted' : 'collapsed — same root'),
        ),
      )
    }

    const row = h(
      'div',
      { class: `sat-row${r.saturated ? ' is-saturated' : ''}` },
      h(
        'div',
        { class: 'sat-label' },
        rootChip(r.trustRoot),
        h('span', { class: 'sat-value' }, fmtCents(r.contributionCents)),
      ),
      chips,
    )
    row.style.setProperty('--hue', String(rootHue(r.trustRoot)))
    box.append(row)
  }
  if (result.roots.length === 0) box.append(h('p', { class: 'muted' }, 'No credentials found.'))
  return box
}

function columnEl(col: Column): HTMLElement {
  const held = col.result.evidence.filter((e) => e.held)
  const wins = col.additiveScore
  const el = h(
    'article',
    { class: `column column-${col.key}` },
    h(
      'div',
      { class: 'column-head' },
      h('span', { class: `badge badge-${col.provenance.kind}` }, col.provenance.label),
      h('h3', {}, col.title),
      h('p', { class: 'column-caption' }, col.caption),
      h('p', { class: 'column-subject' }, col.subjectLabel),
    ),
    h('ul', { class: 'creds' }, ...held.map(evidenceRow)),
    h('h4', { class: 'sub' }, 'Saturation — what survives grouping by trust root'),
    saturationBlock(col.result),
    h(
      'div',
      { class: 'scores' },
      h(
        'div',
        { class: 'score score-additive' },
        h('span', { class: 'score-label' }, 'Naive additive'),
        h('span', { class: 'score-value' }, fmtScore(wins)),
        h('span', { class: 'score-sub' }, `${fmtCents(col.additiveCents)} · ${held.length} credentials counted`),
      ),
      h(
        'div',
        { class: 'score score-rootcost' },
        h('span', { class: 'score-label' }, 'Root cost'),
        h('span', { class: 'score-value' }, fmtScore(col.result.score)),
        h(
          'span',
          { class: 'score-sub' },
          `${fmtCents(col.result.totalCostCents)} · ${col.result.independentRoots} independent root${col.result.independentRoots === 1 ? '' : 's'}`,
        ),
      ),
    ),
  )
  return el
}

function punchline(farm: Column, person: Column): HTMLElement {
  const additiveGap = farm.additiveScore - person.additiveScore
  const rootGap = farm.result.score - person.result.score
  const farmRoots = farm.result.independentRoots
  const personRoots = person.result.independentRoots

  return h(
    'div',
    { class: 'punchline' },
    h('h3', {}, 'What the two scorers disagree about'),
    h(
      'ol',
      { class: 'punch-list' },
      h(
        'li',
        {},
        h('b', {}, 'Additive pays the farm. '),
        `Counting each credential as its own proof puts the one-passport subject ${additiveGap.toFixed(2)} points ahead (${fmtScore(farm.additiveScore)} vs ${fmtScore(person.additiveScore)}). It got there with one trip to a passport office and three integrations.`,
      ),
      h(
        'li',
        {},
        h('b', {}, 'Root cost throws two thirds of it away. '),
        `${FARM_ADAPTER_IDS.length} credentials collapse into one root, so the farm's score drops to ${fmtScore(farm.result.score)} — a lead of ${rootGap.toFixed(2)} — while the real person loses nothing, because nothing they hold was correlated.`,
      ),
      h(
        'li',
        {},
        h('b', {}, 'On independent roots the ordering flips: '),
        `${farmRoots} for the farm against ${personRoots} for the person. That is the number a consumer should gate on, and no additive score can express it — additive has no way to say "these two proofs were the same proof".`,
      ),
    ),
    h(
      'p',
      { class: 'honest' },
      h('b', {}, 'Said plainly: '),
      `root cost does not invert the raw score here, and we are not going to pretend it does. A passport is genuinely expensive to forge, so a subject holding one outscores a subject holding a Proof of Humanity registration and a Circles account — on cost. What inverts is independence: ${personRoots} roots against ${farmRoots}. A consumer who requires two independent roots admits the person and refuses the farm, and gets there with the same API call.`,
    ),
  )
}

function footnote(ontologyAdapters: Map<string, Adapter>): HTMLElement {
  const orb = ontologyAdapters.get('world-id-orb')
  const poh = ontologyAdapters.get('poh-v2')
  const orbCost = orb ? Math.min(orb.forgeCostCents, orb.rentCostCents) : 0
  const pohCost = poh ? Math.min(poh.forgeCostCents, poh.rentCostCents) : 0

  return h(
    'aside',
    { class: 'footnote' },
    h('h4', {}, 'We score the anchor sponsor honestly'),
    h(
      'p',
      {},
      `World ID (Orb) scores ${fmtScore(Math.log10(orbCost + 1))} in this model. Proof of Humanity scores ${fmtScore(Math.log10(pohCost + 1))}. Orb is by far the harder credential to forge — defeating iris dedup at an Orb is a serious undertaking — but a credential is only as strong as the cheaper of forging one and renting one, and Orb accounts resell from $0.50. We price at the rental floor, so forge cost ${fmtCents(orb?.forgeCostCents ?? 0)} loses to rent cost ${fmtCents(orb?.rentCostCents ?? 0)}.`,
    ),
    h(
      'p',
      {},
      'This is deliberate, not an oversight, and we have not special-cased it. Every protocol that hardened did so against sale; none hardened against rental, because the human stays willing. A scorer that let security work addressing only resale inflate a number would be worth less than no scorer at all.',
    ),
    orb ? h('p', { class: 'note-source' }, adapterNotes['world-id-orb'] ?? '') : null,
  )
}

// ------------------------------------------------------------------ driver

export async function renderComparison(container: HTMLElement): Promise<void> {
  clear(container)
  const farmSlot = h('div', { class: 'column-slot' }, skeleton('One passport, three protocols'))
  const personSlot = h('div', { class: 'column-slot' }, skeleton('One person, two wallets'))
  container.append(farmSlot, personSlot)

  const punchSlot = document.getElementById('compare-punchline')!
  const footSlot = document.getElementById('compare-footnote')!
  clear(punchSlot)
  clear(footSlot)

  const statuses = new Map<string, ProbeEvent>()
  const statusEl = h('ul', { class: 'inline-probes' })
  personSlot.append(statusEl)
  const paintStatus = () => {
    clear(statusEl)
    for (const [, ev] of statuses) {
      statusEl.append(
        h(
          'li',
          { class: `probe probe-${ev.state}` },
          `${ev.adapterId} @ ${shortAddr(ev.address)}`,
          h('em', {}, ev.state === 'running' ? 'querying…' : ev.state),
        ),
      )
    }
  }

  const client = makeClient((ev) => {
    statuses.set(`${ev.adapterId}:${ev.address}`, ev)
    paintStatus()
  })

  let ontology: Awaited<ReturnType<typeof client.ontology>>
  let person: PersonhoodResult
  try {
    ;[ontology, person] = await Promise.all([client.ontology(), client.resolve(PERSON_ADDRESSES)])
  } catch (err) {
    clear(container)
    container.append(
      h(
        'div',
        { class: 'error' },
        h('b', {}, 'Could not reach the registry or the chains. '),
        String(err instanceof Error ? err.message : err),
        h('p', {}, 'This is an infrastructure failure, not a statement about anyone’s humanity.'),
      ),
    )
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const farmAdapters = FARM_ADAPTER_IDS.map((id) => ontology.adapters.get(id)).filter(
    (a): a is Adapter => Boolean(a),
  )
  const farmEvidence = farmAdapters.map((a) => constructedEvidence(a, ILLUSTRATIVE_SUBJECT, now))
  const farm = score({
    subjects: [ILLUSTRATIVE_SUBJECT],
    adapters: ontology.adapters,
    evidence: farmEvidence,
    registryRevision: ontology.revision,
    now,
  })

  const farmAdditive = additiveOf(farmEvidence)
  const personAdditive = additiveOf(person.evidence)

  const farmCol: Column = {
    key: 'farm',
    title: 'One passport, three protocols',
    caption:
      'A single ICAO-9303 passport chip, read by World’s document tier, ZKPassport and Self. Three credentials, three integrations, one trip to a passport office.',
    provenance: { label: 'Illustrative — constructed evidence', kind: 'illustrative' },
    subjectLabel:
      'No wallet holds these detectably: ZKPassport scopes its nullifier per service, so this column is built by handing constructed Evidence to the same score() the live column uses. The weights are the real on-chain ones.',
    result: farm,
    additiveScore: farmAdditive.score,
    additiveCents: farmAdditive.cents,
  }

  const personCol: Column = {
    key: 'person',
    title: 'One person, two wallets',
    caption:
      'Proof of Humanity on one address, Circles on another. Two unrelated trust roots — a vouching registry and a social graph — that no single document can produce.',
    provenance: { label: 'Live — resolved against Gnosis, World Chain and Base', kind: 'live' },
    subjectLabel: person.subjects.map(shortAddr).join('  +  '),
    result: person,
    additiveScore: personAdditive.score,
    additiveCents: personAdditive.cents,
  }

  clear(container)
  container.append(columnEl(farmCol), columnEl(personCol))
  punchSlot.append(punchline(farmCol, personCol))
  footSlot.append(footnote(ontology.adapters))

  // Correlation callout, straight from the registry's own description of the shared root.
  const icao = rootDescriptions['state-document:icao-9303']
  if (icao) {
    punchSlot.append(
      h(
        'p',
        { class: 'root-note' },
        h('b', {}, 'state-document:icao-9303 — '),
        icao,
      ),
    )
  }
}

function skeleton(label: string): HTMLElement {
  return h(
    'article',
    { class: 'column column-skeleton' },
    h('h3', {}, label),
    h('p', { class: 'muted' }, 'Reading the ontology from Sepolia and probing live chains…'),
  )
}
