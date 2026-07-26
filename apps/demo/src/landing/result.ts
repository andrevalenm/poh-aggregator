/**
 * The answer, as a first-time visitor reads it.
 *
 * The old result led with the root-cost score — log₁₀ of adversary cost in cents. Nobody
 * arrives wanting a logarithm, and worse, a score threshold fails in the one direction we
 * cannot afford: a farm holding four credentials derived from a single passport chip
 * *outscores* a real person holding four credentials from four different sources, because a
 * passport genuinely is expensive. Only one number inverts that, and it is the count of
 * independent trust roots. So the sheet leads with a plain verdict against a plain rule —
 * **at least two independent kinds of evidence** — and the score, the cost basis and every
 * adapter read live on in the console, one keystroke down.
 *
 * Four rules this file will not break:
 *
 *  1. The verdict is never anonymous. A rule is applied by default so a visitor gets an answer
 *     without touching anything, but the rule is printed beside the answer in plain words and
 *     can be changed. Print states what a named rule decides; it never claims to have decided.
 *  2. A refusal is not a finding about a person. "No" means the public record did not clear the
 *     bar, and it says so.
 *  3. Empty is not failure. Most humans hold none of these credentials, and the zero state is
 *     written as the ordinary answer it is.
 *  4. Unavailable is not negative. A probe that could not be reached is missing evidence and is
 *     reported as missing, never folded into "not found".
 */
import type { Caveat, Evidence, PersonhoodResult, RootContribution } from '@printid/sdk'
import { clear, fmtCents, fmtScore, freshnessLabel, h, shortAddr } from '../ui.ts'

/** The SDK's `Thresholds`, handed in rather than imported — see the note in widget.ts. */
export interface ThresholdSet {
  lenient: number
  standard: number
  strict: number
}

/**
 * The default rule: two independent trust roots.
 *
 * One short sentence explains it — two different kinds of evidence, not two copies of the same
 * one — and it is the only formulation that puts a real person above a credential farm. It is
 * ours, it is visible, and it is changeable; it is not the SDK's, which deliberately ships no
 * default at all.
 */
const DEFAULT_ROOTS_REQUIRED = 2

/** Offered alternatives. Small on purpose: a rule a visitor cannot restate is not a rule. */
const ROOT_OPTIONS = [1, 2, 3]

/**
 * What a credential class demonstrates, in words a visitor already owns. Paraphrases of
 * `EvidenceClass` in the SDK — the type whose own docstring is "what a credential
 * fundamentally demonstrates".
 */
const CLASS_CLAIM: Record<Evidence['evidenceClass'], string> = {
  Uniqueness: 'One enrolment per person, enforced by the issuer.',
  StateIdentity: 'A government-issued document was checked.',
  SocialTrust: 'Other people vouched for this person.',
  Liveness: 'A live human was in front of a camera.',
  Behavioral: 'An account with a history behind it.',
}

const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

const countWord = (n: number) => NUMBER_WORD[n] ?? String(n)

const isUnavailable = (e: Evidence) => e.detail?.['unavailable'] === true

/** Plain age, no decay arithmetic — that lives in the console with the rest of the maths. */
function plainAge(e: Evidence): string {
  if (e.issuedAt !== undefined) {
    const days = Math.max(0, Math.round((Date.now() / 1000 - e.issuedAt) / 86_400))
    if (days < 45) return `issued ${days} day${days === 1 ? '' : 's'} ago`
    if (days < 730) return `issued ${Math.round(days / 30)} months ago`
    const years = days / 365
    return `issued ${years < 10 ? years.toFixed(1) : Math.round(years)} years ago`
  }
  if (e.issuedAfter !== undefined) {
    return `issued some time after ${new Date(e.issuedAfter * 1000).toISOString().slice(0, 7)}`
  }
  return 'issue date not published'
}

// ------------------------------------------------------------------ the verdict

function subjectLine(result: PersonhoodResult, elapsedMs: number): HTMLElement {
  const extra = result.subjects.length - 1
  const who = result.name ?? shortAddr(result.subjects[0]!)
  return h(
    'p',
    { class: 'ans-kicker' },
    'Read live from public chains for ',
    h('b', {}, who),
    extra > 0 ? ` and ${extra} more wallet${extra === 1 ? '' : 's'} you named` : '',
    ` · ${(elapsedMs / 1000).toFixed(1)}s, no server of ours`,
  )
}

/**
 * The verdict word, stamped. It counts nothing up — a yes/no has no intermediate states — so it
 * arrives with the squash-settle and the iron blot only, the same press as every other seal on
 * the sheet. Reduced motion gets the word.
 */
function stampWord(text: string, pass: boolean): HTMLElement {
  const el = h('span', { class: `verdict-word ${pass ? 'is-pass' : 'is-fail'}` }, text)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(() => el.classList.add('stamped'))
  }
  return el
}

/**
 * The headline: a binary answer, the rule that produced it, and the count behind it.
 *
 * The zero case is the same shape rather than a special sad state — it gets the same rule
 * disclosure and one extra sentence saying plainly that holding none of these is ordinary.
 */
function verdictBlock(result: PersonhoodResult, required: number): HTMLElement {
  const found = result.independentRoots
  const pass = found >= required
  const kinds = `${countWord(found)} independent kind${found === 1 ? '' : 's'} of evidence`

  return h(
    'div',
    { class: `verdict ${pass ? 'is-pass' : 'is-fail'}` },
    h(
      'p',
      { class: 'verdict-mark', 'aria-hidden': 'true' },
      pass ? '✓' : '✕',
    ),
    h(
      'div',
      { class: 'verdict-body' },
      stampWord(pass ? 'Yes' : 'No', pass),
      h(
        'p',
        { class: 'verdict-rule' },
        found === 0 ? 'No credentials found. ' : `Found ${kinds}. `,
        h('span', { class: 'verdict-rule-b' }, `The rule asks for ${required} or more.`),
      ),
      found === 0
        ? h(
            'p',
            { class: 'verdict-gloss' },
            'That is the ordinary answer and not a mark against this wallet — most people hold none of these credentials, and an absence of evidence is not evidence of absence.',
          )
        : !pass
          ? h(
              'p',
              { class: 'verdict-gloss' },
              'A no means the public record did not clear the bar. It is not a finding that no person is here.',
            )
          : h(
              'p',
              { class: 'verdict-gloss' },
              'Independent means from different sources. Credentials tracing back to the same source were collapsed before this count, so one document shown to many protocols cannot reach it.',
            ),
    ),
  )
}

/**
 * The rule, visible and changeable, sitting directly under the answer it produced.
 *
 * A visitor never has to touch this — the default is already applied above — but the verdict
 * must never be unattributed, so the rule is printed as a sentence with the number as a control
 * inside it rather than parked in a settings drawer.
 */
function ruleBlock(onChange: (n: number) => void): HTMLElement {
  const opts = h('span', {
    class: 'rule-opts',
    role: 'group',
    'aria-label': 'Independent kinds of evidence required',
  })
  const buttons = new Map<number, HTMLButtonElement>()
  // One text node for the whole tail, not a span for the plural 's': `.rule-line` lays its
  // children out with a gap, and a bare span would be spaced off as its own word — "kind s".
  const tail = h('span', { class: 'rule-tail' }, 'independent kinds of evidence.')
  const tag = h('span', { class: 'rule-tag' }, 'our default')

  // Built once and mutated in place: recreating it would steal focus from the button the
  // keyboard user just pressed.
  const select = (n: number) => {
    for (const [m, b] of buttons) b.setAttribute('aria-pressed', String(m === n))
    tail.textContent = `independent kind${n === 1 ? '' : 's'} of evidence.`
    tag.textContent = n === DEFAULT_ROOTS_REQUIRED ? 'our default' : 'your choice'
    tag.className = n === DEFAULT_ROOTS_REQUIRED ? 'rule-tag' : 'rule-tag is-custom'
    onChange(n)
  }

  for (const n of ROOT_OPTIONS) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'rule-opt',
        'aria-pressed': String(n === DEFAULT_ROOTS_REQUIRED),
        'aria-label': `Require ${n} independent kind${n === 1 ? '' : 's'} of evidence`,
      },
      String(n),
    ) as HTMLButtonElement
    btn.addEventListener('click', () => select(n))
    buttons.set(n, btn)
    opts.append(btn)
  }

  return h(
    'div',
    { class: 'rule' },
    h(
      'p',
      { class: 'rule-line' },
      h('span', {}, 'By the rule: at least'),
      opts,
      tail,
      tag,
    ),
    h(
      'p',
      { class: 'rule-why' },
      'Two independent kinds means two different sources, not two copies of the same one. That is the distinction a credential farm cannot fake by presenting one passport to four protocols — and the reason we do not lead with a score, which the farm would win.',
    ),
  )
}

// ------------------------------------------------------------- the credentials

/** Adapter names under a root, strongest first — the strongest is the one that counted. */
function namesUnder(root: RootContribution, evidence: Evidence[]): Evidence[] {
  return evidence
    .filter((e) => e.held && e.trustRoot === root.trustRoot)
    .sort((a, b) => b.effectiveCostCents - a.effectiveCostCents)
}

function credentialCard(
  root: RootContribution,
  evidence: Evidence[],
  rootNotes: Record<string, string>,
  counts: boolean,
  index: number,
): HTMLElement {
  const under = namesUnder(root, evidence)
  const lead = under[0]
  if (!lead) return h('li', { class: 'cred-card is-nil', hidden: true })
  const extra = under.length - 1
  const dead = under.every((e) => !e.live)

  return h(
    'li',
    { class: `cred-card${counts ? '' : ' is-nil'}` },
    h(
      'p',
      { class: 'cred-rank' },
      counts ? String(index + 1).padStart(2, '0') : '––',
      h('span', { class: 'cred-rank-word' }, counts ? 'counts' : 'no weight'),
    ),
    h(
      'h4',
      { class: 'cred-title' },
      lead.adapterName,
      extra > 0 ? h('span', { class: 'cred-plus' }, ` + ${extra} more`) : null,
    ),
    h('p', { class: 'cred-claim' }, CLASS_CLAIM[lead.evidenceClass]),
    h(
      'p',
      { class: 'cred-root' },
      rootNotes[root.trustRoot] ?? `Trust root: ${root.trustRoot}.`,
    ),
    root.saturated
      ? h(
          'p',
          { class: 'cred-same' },
          h('b', {}, `${under.length} protocols, one credential. `),
          `${under.map((e) => e.adapterName).join(', ')} all read the same source, so this counts once rather than ${under.length} times.`,
        )
      : null,
    counts
      ? null
      : h(
          'p',
          { class: 'cred-nil' },
          dead
            ? 'Held, but the upstream protocol is discontinued, so it adds nothing to the count above.'
            : 'Held, but its remaining weight is below the floor where it would count as independent evidence.',
        ),
    h('p', { class: 'cred-where' }, `${plainAge(lead)} · found on ${shortAddr(lead.observedOn)}`),
  )
}

function credentialList(
  result: PersonhoodResult,
  rootNotes: Record<string, string>,
): HTMLElement | null {
  if (result.roots.length === 0) return null
  // `roots` arrives sorted by contribution descending and `independentRoots` is a threshold on
  // that same key, so the first N are exactly the ones that counted. No duplicated constant.
  return h(
    'div',
    { class: 'creds-wrap' },
    h('h4', { class: 'sheet-label' }, 'What was found'),
    h(
      'ul',
      { class: 'creds' },
      ...result.roots.map((r, i) =>
        credentialCard(r, result.evidence, rootNotes, i < result.independentRoots, i),
      ),
    ),
  )
}

// ----------------------------------------------------------- honest exceptions

/** A probe that failed is missing evidence and is reported as missing. Never as a negative. */
function unreachableNote(result: PersonhoodResult): HTMLElement | null {
  const out = result.evidence.filter(isUnavailable)
  if (out.length === 0) return null
  return h(
    'p',
    { class: 'ans-note' },
    h('span', { class: 'note-tag' }, 'incomplete'),
    `${out.length} protocol${out.length === 1 ? '' : 's'} could not be reached (${out
      .map((e) => e.adapterId)
      .join(', ')}). Missing evidence is left out of the count rather than counted against the subject, so the answer above is a floor, not a ceiling.`,
  )
}

/**
 * The one caveat true of every subject, printed in the SDK's own words rather than paraphrased.
 * Unsuppressible in the API, unsuppressible here — including on a passing result, which is
 * exactly where it is easiest to forget.
 */
function permanentCaveat(caveats: Caveat[]): HTMLElement | null {
  const c = caveats.find((x) => x.code === 'independent-control-not-attested')
  if (!c) return null
  return h(
    'p',
    { class: 'ans-note is-permanent' },
    h('span', { class: 'note-tag' }, 'always true'),
    c.message,
  )
}

// ----------------------------------------------------------------- the console

function evidenceRow(e: Evidence): HTMLElement {
  const out = isUnavailable(e)
  return h(
    'div',
    { class: `evd-row${e.held ? ' is-held' : out ? ' is-out' : ''}` },
    h(
      'div',
      { class: 'evd-head' },
      h('span', { class: 'evd-name' }, e.adapterName),
      h('span', { class: 'evd-verdict' }, out ? 'unreachable' : e.held ? 'held' : 'not found'),
      h('span', { class: 'evd-cost' }, e.held ? fmtCents(e.effectiveCostCents) : '—'),
    ),
    h(
      'p',
      { class: 'evd-meta' },
      `${e.trustRoot} · ${e.evidenceClass} · ${freshnessLabel(e.freshness, e.issuedAt)} · on ${shortAddr(e.observedOn)}${
        e.held
          ? ` · forge ${fmtCents(e.forgeCostCents)} / rent ${fmtCents(e.rentCostCents)}, priced at the cheaper`
          : ''
      }`,
    ),
    out
      ? h(
          'p',
          { class: 'evd-out' },
          `Could not be reached: ${String(e.detail?.['error'] ?? 'unknown error')}. Excluded from the score rather than counted against the subject.`,
        )
      : null,
  )
}

/**
 * The record the headline deliberately sets aside — including the score and what each of the
 * SDK's named thresholds would say about it. Demoted, never removed: the SDK and the MCP still
 * return all of it, and a consumer tuning a cutoff needs to see it.
 */
function recordBlock(
  result: PersonhoodResult,
  elapsedMs: number,
  thresholds: ThresholdSet,
): HTMLElement {
  const verdicts = (['lenient', 'standard', 'strict'] as const)
    .map((k) => `${k} ${thresholds[k].toFixed(2)} → ${result.isHuman(thresholds[k]) ? 'true' : 'false'}`)
    .join(' · ')
  const rows: [string, string][] = [
    ['Independent trust roots', `${result.independentRoots} — the number the verdict above uses`],
    ['Trust roots with evidence', String(result.roots.length)],
    ['Root-cost score', `${fmtScore(result.score)} — log₁₀ of adversary cost in cents`],
    ['Total adversary cost', `${fmtCents(result.totalCostCents)}, summed across independent roots`],
    ['isHuman(threshold)', verdicts],
    ['Adapters read', String(result.evidence.length)],
    ['Wallets supplied', result.subjects.map(shortAddr).join(' + ')],
    ['Registry revision', String(result.registryRevision ?? '—')],
    ['Elapsed', `${(elapsedMs / 1000).toFixed(2)}s, in your browser`],
  ]
  return h('dl', { class: 'rec' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))
}

/**
 * The console, absorbed into the sheet. One keyboard-operable disclosure holds the whole
 * technical record — every read, every caveat, and the numbers the headline set aside — so the
 * detail never costs a page change.
 */
function consoleBlock(
  result: PersonhoodResult,
  elapsedMs: number,
  thresholds: ThresholdSet,
): HTMLElement {
  const rank = (e: Evidence) => (e.held ? 0 : isUnavailable(e) ? 1 : 2)
  const sorted = [...result.evidence].sort(
    (a, b) => rank(a) - rank(b) || b.effectiveCostCents - a.effectiveCostCents,
  )

  const panel = h(
    'div',
    { class: 'console-panel', id: 'console-panel', hidden: true },
    h('h5', { class: 'sheet-label' }, 'The record'),
    recordBlock(result, elapsedMs, thresholds),
    h('h5', { class: 'sheet-label' }, `Every read — ${result.evidence.length} adapters`),
    h('div', { class: 'evd-rows' }, ...sorted.map(evidenceRow)),
    h('h5', { class: 'sheet-label' }, `Caveats — ${result.caveats.length}, in the SDK's own words`),
    h(
      'ul',
      { class: 'cv-list' },
      ...result.caveats.map((c) => h('li', {}, h('code', {}, c.code), h('span', {}, c.message))),
    ),
  )

  const label = h('span', { class: 'console-label' }, 'Open the console')
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'console-toggle',
      'aria-expanded': 'false',
      'aria-controls': 'console-panel',
    },
    label,
    h('span', { class: 'console-caret', 'aria-hidden': 'true' }),
  )
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!open))
    label.textContent = open ? 'Open the console' : 'Fold the console away'
    if (open) panel.setAttribute('hidden', '')
    else panel.removeAttribute('hidden')
  })

  return h(
    'div',
    { class: 'console' },
    h(
      'p',
      { class: 'console-lede' },
      'Everything above comes out of the record below — every adapter read, every caveat, and the score and cost arithmetic the answer sets aside.',
    ),
    btn,
    panel,
  )
}

// ------------------------------------------------------------------- assembly

export function resultView(
  result: PersonhoodResult,
  elapsedMs: number,
  thresholds: ThresholdSet,
  rootNotes: Record<string, string>,
): HTMLElement {
  // Only the verdict depends on the chosen number; the rule control mutates in place.
  const answer = h('div', { class: 'answer', role: 'status', 'aria-live': 'polite' })
  const repaint = (required: number) => {
    clear(answer)
    answer.append(verdictBlock(result, required))
  }
  const rule = ruleBlock(repaint)
  repaint(DEFAULT_ROOTS_REQUIRED)

  return h(
    'div',
    { class: 'w-result' },
    subjectLine(result, elapsedMs),
    answer,
    rule,
    unreachableNote(result),
    permanentCaveat(result.caveats),
    credentialList(result, rootNotes),
    consoleBlock(result, elapsedMs, thresholds),
  )
}
