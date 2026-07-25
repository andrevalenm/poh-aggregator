/**
 * `npm run agentbook [address…]` — check human-backing for any wallet, and rediscover the
 * registered agents this demo uses.
 *
 * Nothing in this file is privileged. AgentBook is a public contract on World Chain and the
 * lookup is a plain `eth_call`, which is the property that makes the whole design work: a
 * counterparty can check human-backing without asking World's permission, without an API key
 * on the critical path, and without anything that can be rate-limited or revoked.
 *
 * With no arguments it walks AgentBook's recent transaction history and reports which
 * addresses resolve to a human — the same walk that found the fixtures.
 */

import { lookupHumanBacking } from './world/agentbook.js'
import { referenceVerifier } from './world/agentbook.js'
import { world } from './config.js'
import { REGISTERED_AGENTS, OPERATOR_ADDRESS_SET } from './fixtures.js'
import { banner, colour as C } from './trace.js'

const EXPLORER = 'https://worldchain-mainnet.explorer.alchemy.com/api/v2'

async function discover(limit = 40) {
  const url = new URL(`${EXPLORER}/addresses/${world.agentBookAddress}/transactions`)
  url.searchParams.set('filter', 'to')
  const res = await fetch(url).then((r) => r.json())
  const seen = new Map()
  for (const tx of res.items ?? []) {
    const input = tx.raw_input ?? ''
    // Every registration call takes the agent address as its first argument.
    if (input.length >= 74) seen.set('0x' + input.slice(34, 74), tx.timestamp)
    if (seen.size >= limit) break
  }
  return [...seen.entries()]
}

async function main() {
  banner('AgentBook — human-backing lookup', `World Chain · ${world.agentBookAddress}`)

  const args = process.argv.slice(2)
  const targets = args.length
    ? args.map((a) => [a, null])
    : [
        [REGISTERED_AGENTS.beacon.address, 'fixture: beacon'],
        [REGISTERED_AGENTS.mirror.address, 'fixture: mirror'],
        ...OPERATOR_ADDRESS_SET.map((a) => [a, 'operator-declared wallet (not an agent)']),
        ...(await discover()).slice(0, 12).map(([a, ts]) => [a, `seen in AgentBook history ${ts ?? ''}`]),
      ]

  const seenAddress = new Set()
  const unique = targets.filter(([a]) => {
    const key = a.toLowerCase()
    if (seenAddress.has(key)) return false
    seenAddress.add(key)
    return true
  })

  const byHuman = new Map()
  console.log('')
  for (const [address, note] of unique) {
    const backing = await lookupHumanBacking(address)
    const label =
      backing.status === 'backed'
        ? C.green('BACKED  ')
        : backing.status === 'unbacked'
          ? C.dim('unbacked')
          : C.yellow('unknown ')
    console.log(`  ${label} ${address}  ${C.dim(note ?? '')}`)
    if (backing.humanId) {
      console.log(`           ${C.dim('humanId ' + backing.humanId)}`)
      const list = byHuman.get(backing.humanId) ?? []
      list.push(address)
      byHuman.set(backing.humanId, list)
    }
    if (backing.error) console.log(`           ${C.yellow('error ' + backing.error)}`)
  }

  const fleets = [...byHuman.entries()].filter(([, addrs]) => addrs.length > 1)
  if (fleets.length) {
    console.log('')
    console.log(C.bold('  Wallets sharing one human'))
    for (const [humanId, addrs] of fleets) {
      console.log(`    ${C.dim(humanId)}`)
      for (const a of addrs) console.log(`      · ${a}`)
    }
    console.log(
      C.dim(
        '\n  This is why a counterparty budget must be keyed on the human, not the agent.\n' +
          "  AgentKit's own usage counters work the same way.",
      ),
    )
  }

  // Sanity check that our reader agrees with AgentKit's own.
  const sample = REGISTERED_AGENTS.beacon.address
  const ours = await lookupHumanBacking(sample)
  const theirs = await referenceVerifier.lookupHuman(sample)
  console.log('')
  console.log(
    C.dim(
      `  cross-check on ${sample}: ours=${ours.humanId ?? 'null'} · ` +
        `@worldcoin/agentkit createAgentBookVerifier()=${theirs ?? 'null'} · ` +
        `${ours.humanId === theirs ? 'agree' : 'DISAGREE'}`,
    ),
  )
}

main().catch((e) => {
  console.error('failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
