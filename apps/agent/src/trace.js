/**
 * Decision trace rendering.
 *
 * The trace is the deliverable. A boolean at the end of a verification pipeline is not
 * auditable and cannot be argued with; a trace shows which gate each fact came from, which
 * party owns each threshold, and what was not checked. An operator who is refused should be
 * able to read exactly why, and a counterparty who accepts should be able to show its work.
 */

const C = process.stdout.isTTY
  ? {
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    }
  : { dim: (s) => s, bold: (s) => s, green: (s) => s, red: (s) => s, yellow: (s) => s, cyan: (s) => s }

const line = (ch = '─', n = 78) => C.dim(ch.repeat(n))

const mark = (pass) => (pass === true ? C.green('PASS') : pass === false ? C.red('FAIL') : C.yellow('SKIP'))

const money = (cents) => (cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}c`)

export function banner(title, subtitle) {
  console.log('')
  console.log(line('═'))
  console.log(C.bold(title))
  if (subtitle) console.log(C.dim(subtitle))
  console.log(line('═'))
}

export function renderTrace(trace) {
  console.log('')
  console.log(`${C.bold('agent')}        ${trace.agent?.name ?? '?'}  ${C.dim(trace.agent?.address ?? '')}`)
  if (trace.agent?.note) console.log(`             ${C.dim(trace.agent.note)}`)
  console.log(`${C.bold('counterparty')} ${trace.counterparty}`)
  if (trace.addressSet) {
    console.log(`${C.bold('address set')}  ${trace.addressSet.length} address(es) — agent wallet + operator-declared`)
    for (const a of trace.addressSet) console.log(`             ${C.dim('·')} ${a}`)
  }
  console.log(line())

  for (const g of trace.gates) {
    console.log(`  ${C.bold(`gate ${g.n}`)}  ${g.name.padEnd(20)} ${mark(g.pass)}`)
    console.log(`          ${C.dim(g.question)}`)
    console.log(`          ${C.dim('via ')}${C.dim(g.how)}`)
    renderDetail(g)
    console.log('')
  }

  if (trace.sdkCaveats?.length) {
    console.log(line())
    console.log(C.bold('  Caveats returned by @corroborate/sdk, verbatim'))
    for (const c of trace.sdkCaveats) {
      console.log(`    ${C.yellow('!')} ${C.bold(c.code)}`)
      console.log(wrap(c.message, 6))
    }
    console.log('')
  }

  if (trace.caveats?.length) {
    console.log(line())
    console.log(C.bold(`  Caveats recorded by ${trace.counterparty} about its own check`))
    for (const c of trace.caveats) {
      console.log(`    ${C.yellow('!')} ${C.bold(c.code)}`)
      console.log(wrap(c.message, 6))
    }
    console.log('')
  }

  console.log(line('═'))
  const d = trace.decision
  const verdict = d.allow ? C.green('  ALLOW  ') : C.red('  DENY   ')
  console.log(`${verdict} ${trace.counterparty}: ${d.because}`)
  if (trace.policy) {
    console.log(
      C.dim(
        `         policy owner: ${trace.policy.owner} · threshold ${trace.policy.scoreThreshold} · ` +
          `min independent roots ${trace.policy.minIndependentRoots} · ${trace.policy.requestsPerHuman} request/human`,
      ),
    )
  }
  console.log(line('═'))
}

function renderDetail(g) {
  const d = g.detail ?? {}

  if (g.n === 3) {
    console.log(
      `          ${C.bold('score')} ${C.cyan(d.score)}   ${C.bold('cost')} ${money(d.totalCostCents)}   ` +
        `${C.bold('independent roots')} ${d.independentRoots}`,
    )
    for (const e of d.evidence ?? []) {
      if (e.unavailable) {
        console.log(`          ${C.yellow('?')} ${e.adapter.padEnd(22)} ${C.dim('unavailable: ' + e.unavailable.slice(0, 40))}`)
        continue
      }
      console.log(
        `          ${C.green('+')} ${e.adapter.padEnd(22)} ${C.dim('root')} ${e.trustRoot.padEnd(28)} ` +
          `${C.dim('on')} ${e.observedOn.slice(0, 10)}…`,
      )
      console.log(
        `            ${C.dim(`${e.class} · forge ${money(e.forgeCents)} / rent ${money(e.rentCents)} → counted ${money(e.costCents)} · ${e.source}`)}`,
      )
    }
    for (const r of d.roots ?? []) {
      if (r.saturated) {
        console.log(
          `          ${C.yellow('~')} root ${r.trustRoot} saturated: ${r.adapterIds.join(', ')} counted once`,
        )
      }
    }
    return
  }

  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue
    console.log(`          ${C.dim(k.padEnd(18))} ${format(v)}`)
  }
}

function format(v) {
  if (v === null) return C.dim('null')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function wrap(text, indent) {
  const width = 78 - indent
  const pad = ' '.repeat(indent)
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      lines.push(cur.trim())
      cur = w
    } else cur += ' ' + w
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines.map((l) => C.dim(pad + l)).join('\n')
}

export { C as colour }
