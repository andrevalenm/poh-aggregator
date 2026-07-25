/**
 * Two playable instruments for the research section.
 *
 * Both teach a claim the product actually makes, using the weights actually deployed in the
 * registry — no illustrative numbers. That constraint changed the design of the first one:
 * the tempting version shows a sybil farm outscoring a real person and the saturation rule
 * flipping it. Run the real figures and that is false. One passport read by three protocols
 * is 2000c of rent, three times over; a real person holding Orb + PoH + Circles is 600c
 * total. The farm outranks the person under BOTH scorings, because a passport genuinely is
 * expensive. What actually separates them is independence — one root against three.
 *
 * So the instrument reports three numbers and lets the visitor find that out. Overclaiming
 * here would be the same error we criticise in every additive scorer, committed in our own
 * marketing.
 */

import './research.css'

interface Cred {
  id: string
  name: string
  root: string
  rootLabel: string
  forge: number
  rent: number
}

/**
 * Straight from ontology/adapters.json, which is what the on-chain registry serves.
 * Cost is in cents and scoring takes min(forge, rent) — a credential is worth the cheaper
 * of faking one and renting one, because a holder willing to rent theirs out defeats any
 * amount of cryptography.
 */
const CREDS: Cred[] = [
  { id: 'world-id-orb', name: 'World ID — Orb', root: 'iris-registry:world-orb', rootLabel: 'iris registry', forge: 50_000, rent: 50 },
  { id: 'world-id-document', name: 'World ID — document tier', root: 'state-document:icao-9303', rootLabel: 'passport chip', forge: 150_000, rent: 2_000 },
  { id: 'zkpassport', name: 'ZKPassport', root: 'state-document:icao-9303', rootLabel: 'passport chip', forge: 150_000, rent: 2_000 },
  { id: 'self-protocol', name: 'Self', root: 'state-document:icao-9303', rootLabel: 'passport chip', forge: 150_000, rent: 2_000 },
  { id: 'coinbase-verification', name: 'Coinbase Verification', root: 'kyc-vendor:persona', rootLabel: 'Persona KYC', forge: 120_000, rent: 3_000 },
  { id: 'galxe-passport', name: 'Galxe Passport', root: 'kyc-vendor:sumsub', rootLabel: 'Sumsub KYC', forge: 120_000, rent: 3_000 },
  { id: 'linea-poh', name: 'Linea PoH', root: 'kyc-vendor:sumsub', rootLabel: 'Sumsub KYC', forge: 120_000, rent: 3_000 },
  { id: 'poh-v2', name: 'Proof of Humanity', root: 'social-vouching:poh', rootLabel: 'PoH vouching', forge: 1_000, rent: 500 },
  { id: 'circles-v2', name: 'Circles', root: 'social-trust:circles', rootLabel: 'Circles trust graph', forge: 100, rent: 50 },
]

const PRESETS: Record<string, string[]> = {
  farm: ['world-id-document', 'zkpassport', 'self-protocol'],
  person: ['world-id-orb', 'poh-v2', 'circles-v2'],
  clear: [],
}

const cost = (c: Cred) => Math.min(c.forge, c.rent)
const score = (cents: number) => (cents <= 0 ? 0 : Math.log10(cents + 1))
const money = (cents: number) =>
  cents >= 100 ? `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}` : `${cents}¢`

function initSaturation(root: HTMLElement) {
  const on = new Set<string>()

  const list = root.querySelector<HTMLUListElement>('[data-sat-list]')
  const verdict = root.querySelector<HTMLElement>('[data-sat-verdict]')
  if (!list || !verdict) return

  list.innerHTML = CREDS.map(
    (c) => `
    <li class="sat-row" data-id="${c.id}" data-on="false" data-dup="false">
      <button type="button" aria-pressed="false">
        <span class="sat-tick" aria-hidden="true">○</span>
        <span class="sat-name">${c.name}<span class="sat-root">${c.rootLabel}</span></span>
        <span class="sat-cost">${money(cost(c))}</span>
      </button>
    </li>`,
  ).join('')

  function render() {
    const held = CREDS.filter((c) => on.has(c.id))

    // Saturate within a trust root: strongest credential counts, the rest are the same
    // evidence again. Across roots, add.
    const byRoot = new Map<string, Cred[]>()
    for (const c of held) {
      const g = byRoot.get(c.root)
      if (g) g.push(c)
      else byRoot.set(c.root, [c])
    }

    const additiveCents = held.reduce((s, c) => s + cost(c), 0)
    let ourCents = 0
    for (const group of byRoot.values()) ourCents += Math.max(...group.map(cost))

    const roots = [...byRoot.values()].filter((g) => Math.max(...g.map(cost)) >= 10).length
    const collapsed = held.length - byRoot.size

    // Rows show which credentials are being counted as duplicates of one another.
    for (const li of list!.querySelectorAll<HTMLLIElement>('.sat-row')) {
      const id = li.dataset.id!
      const c = CREDS.find((x) => x.id === id)!
      const isOn = on.has(id)
      li.dataset.on = String(isOn)
      li.dataset.dup = String(isOn && (byRoot.get(c.root)?.length ?? 0) > 1)
      const btn = li.querySelector('button')!
      btn.setAttribute('aria-pressed', String(isOn))
      li.querySelector('.sat-tick')!.textContent = isOn ? '●' : '○'
    }

    // log10 of cents, mapped against a ceiling a bit above the most expensive single root.
    const CEIL = 4.2
    setMeter('additive', score(additiveCents), additiveCents, CEIL)
    setMeter('ours', score(ourCents), ourCents, CEIL)

    const countEl = root.querySelector<HTMLElement>('[data-roots-count]')
    if (countEl) countEl.textContent = String(roots)

    verdict!.innerHTML = verdictFor(held.length, byRoot.size, collapsed, roots, additiveCents, ourCents)
  }

  function setMeter(kind: string, value: number, cents: number, ceil: number) {
    const el = root.querySelector<HTMLElement>(`[data-meter="${kind}"]`)
    if (!el) return
    el.querySelector<HTMLElement>('.meter-val')!.textContent = value.toFixed(2)
    el.querySelector<HTMLElement>('.meter-fill')!.style.width = `${Math.min(100, (value / ceil) * 100)}%`
    const note = el.querySelector<HTMLElement>('.meter-note')
    if (note) note.textContent = cents > 0 ? `${money(cents)} of adversary cost` : 'no evidence'
  }

  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('.sat-row')
    if (!li) return
    const id = li.dataset.id!
    on.has(id) ? on.delete(id) : on.add(id)
    for (const b of root.querySelectorAll('[data-preset]')) b.setAttribute('aria-pressed', 'false')
    render()
  })

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    btn.addEventListener('click', () => {
      on.clear()
      for (const id of PRESETS[btn.dataset.preset!] ?? []) on.add(id)
      for (const b of root.querySelectorAll('[data-preset]')) b.setAttribute('aria-pressed', 'false')
      btn.setAttribute('aria-pressed', 'true')
      render()
    })
  }

  render()
}

/** The running commentary. It has to stay honest at every state, including the awkward ones. */
function verdictFor(
  held: number,
  distinctRoots: number,
  collapsed: number,
  countedRoots: number,
  additiveCents: number,
  ourCents: number,
): string {
  if (held === 0) {
    return `Pick some credentials. Most real people hold none of these — an absence of evidence is not evidence of absence.`
  }
  if (collapsed === 0) {
    return `${held} credential${held === 1 ? '' : 's'}, ${distinctRoots} independent root${distinctRoots === 1 ? '' : 's'}, nothing collapsed. Both scorers agree, because there is no correlation to disagree about.`
  }
  const saved = additiveCents - ourCents
  return `<strong>${collapsed + 1} of these read the same root.</strong> Additive scoring credits ${money(additiveCents)}; we credit ${money(ourCents)}, discarding ${money(saved)} of the same evidence counted twice. Note what did <em>not</em> happen: the score stayed high, because a passport really is expensive. The signal that moved is <strong>independent roots — now ${countedRoots}</strong>. That is the number a consumer should gate on.`
}

// -------------------------------------------------------------- age curves

/**
 * Decay vs Ramp, plotted from the same functions the SDK scores with.
 *
 * Ramp is the counter-intuitive one and the reason it exists is empirical: Proof of Humanity
 * took roughly 95% of its lifetime registrations inside a four-month airdrop window, so on a
 * vouching registry the fresh cohort IS the suspect cohort. Uniform decay would have handed
 * that cohort full weight and discounted the organic one — exactly backwards.
 */
const freshness = (curve: 'decay' | 'ramp', ageDays: number, halfLife: number) => {
  const d = 2 ** (-ageDays / halfLife)
  return curve === 'ramp' ? 1 - d : d
}

const DECAY_HALF_LIFE = 1095 // World ID Orb, days
const RAMP_HALF_LIFE = 365 // Proof of Humanity, days
const MAX_DAYS = 1825 // five years

function initCurves(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-curve-plot]')
  const slider = root.querySelector<HTMLInputElement>('[data-curve-slider]')
  if (!svg || !slider) return

  const W = 560
  const H = 240
  const PAD = { l: 34, r: 12, t: 12, b: 26 }
  const px = (d: number) => PAD.l + (d / MAX_DAYS) * (W - PAD.l - PAD.r)
  const py = (w: number) => H - PAD.b - w * (H - PAD.t - PAD.b)

  const path = (curve: 'decay' | 'ramp', halfLife: number) => {
    const pts: string[] = []
    for (let d = 0; d <= MAX_DAYS; d += 12) {
      pts.push(`${px(d).toFixed(1)} ${py(freshness(curve, d, halfLife)).toFixed(1)}`)
    }
    return `M${pts.join('L')}`
  }

  const yTicks = [0, 0.5, 1]
  const xTicks = [0, 365, 730, 1095, 1460, 1825]

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.innerHTML = `
    ${yTicks
      .map(
        (w) =>
          `<path class="curve-grid" d="M${PAD.l} ${py(w)}H${W - PAD.r}"/>
           <text class="curve-tick-text" x="${PAD.l - 6}" y="${py(w) + 3}" text-anchor="end">${w.toFixed(1)}</text>`,
      )
      .join('')}
    ${xTicks
      .map(
        (d) =>
          `<text class="curve-tick-text" x="${px(d)}" y="${H - PAD.b + 14}" text-anchor="middle">${d / 365}y</text>`,
      )
      .join('')}
    <path class="curve-axis" d="M${PAD.l} ${PAD.t}V${H - PAD.b}H${W - PAD.r}"/>
    <path class="curve-decay" d="${path('decay', DECAY_HALF_LIFE)}"/>
    <path class="curve-ramp" d="${path('ramp', RAMP_HALF_LIFE)}"/>
    <path class="curve-marker" data-marker d="M${px(0)} ${PAD.t}V${H - PAD.b}"/>
    <circle class="curve-dot-decay" data-dot-decay r="3.5" cx="${px(0)}" cy="${py(1)}"/>
    <circle class="curve-dot-ramp" data-dot-ramp r="3.5" cx="${px(0)}" cy="${py(0)}"/>
  `

  const marker = svg.querySelector<SVGPathElement>('[data-marker]')!
  const dotD = svg.querySelector<SVGCircleElement>('[data-dot-decay]')!
  const dotR = svg.querySelector<SVGCircleElement>('[data-dot-ramp]')!
  const ageEl = root.querySelector<HTMLElement>('[data-curve-age]')!
  const wD = root.querySelector<HTMLElement>('[data-weight-decay]')!
  const wR = root.querySelector<HTMLElement>('[data-weight-ramp]')!
  const caption = root.querySelector<HTMLElement>('[data-curve-caption]')!

  function update() {
    const days = Number(slider!.value)
    const fd = freshness('decay', days, DECAY_HALF_LIFE)
    const fr = freshness('ramp', days, RAMP_HALF_LIFE)

    marker.setAttribute('d', `M${px(days)} ${PAD.t}V${H - PAD.b}`)
    dotD.setAttribute('cx', String(px(days)))
    dotD.setAttribute('cy', String(py(fd)))
    dotR.setAttribute('cx', String(px(days)))
    dotR.setAttribute('cy', String(py(fr)))

    const years = days / 365
    ageEl.textContent = days < 365 ? `${days} days old` : `${years.toFixed(1)} years old`
    wD.textContent = fd.toFixed(3)
    wR.textContent = fr.toFixed(3)

    caption.textContent =
      days < 90
        ? 'A week-old vouching registration is worth almost nothing — that is the airdrop cohort. A fresh liveness check, by contrast, is at its most meaningful.'
        : days < 730
          ? 'The curves cross in here. Past this point the vouched registration has survived challenge windows, while the biometric enrolment has begun to go stale.'
          : 'A registration that has survived years of challenge windows approaches full weight; a years-old liveness check is mostly a historical fact about a face.'
  }

  slider.addEventListener('input', update)
  update()
}

// ------------------------------------------------------------------- boot

function boot() {
  const sat = document.querySelector<HTMLElement>('[data-instrument="saturation"]')
  if (sat) initSaturation(sat)
  const curves = document.querySelector<HTMLElement>('[data-instrument="curves"]')
  if (curves) initCurves(curves)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
