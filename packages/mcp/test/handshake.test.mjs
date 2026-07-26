// Spawns the built stdio server and speaks real MCP at it: initialize, tools/list,
// and (LIVE=1 only) live tools/call against public chains. Run `npm run build` first —
// the test exercises dist/server.js, the artifact users actually install.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = process.env.LIVE === '1'

let server
let nextId = 1
const pending = new Map()

before(() => {
  // LIVE runs get the self-hosted audit-trail subgraph so explain_weight_history is
  // exercised for real; an explicit env var always wins.
  const env = { ...process.env }
  if (LIVE && !env.CORROBORATE_REGISTRY_SUBGRAPH_URL) {
    env.CORROBORATE_REGISTRY_SUBGRAPH_URL = 'http://37.27.67.44:8100/subgraphs/name/corroborate-registry'
  }
  server = spawn('node', [join(root, 'dist/server.js')], { stdio: ['pipe', 'pipe', 'inherit'], env })
  let buf = ''
  server.stdout.on('data', (d) => {
    buf += d.toString()
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      const msg = JSON.parse(line)
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    }
  })
})

after(() => server?.kill())

function rpc(method, params, timeoutMs = 120_000) {
  const id = nextId++
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  return new Promise((resolve, reject) => {
    pending.set(id, resolve)
    setTimeout(() => reject(new Error(`rpc timeout: ${method}`)), timeoutMs).unref()
  })
}

test('initialize handshake', async () => {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'handshake-test', version: '0' },
  })
  assert.equal(init.result.serverInfo.name, 'corroborate')
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
})

test('tools/list exposes all nine tools', async () => {
  const tools = await rpc('tools/list', {})
  const names = tools.result.tools.map((t) => t.name)
  for (const expected of [
    'lookup_personhood',
    'check_personhood',
    'explain_trust_roots',
    'explain_weight_history',
    'suggest_enrollment',
    'check_fleet',
    'wallet_signals',
    'price_policy',
    'compare_subjects',
  ]) {
    assert.ok(names.includes(expected), `missing tool: ${expected}`)
  }
})

test('price_policy quotes a feasible standard policy', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'price_policy',
    arguments: { min_score: 2.5, min_independent_roots: 2, slots: 10 },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  assert.match(text, /cheapest slot: \$\d/)
  assert.match(text, /10 slots → 10 humans required/)
})

test('wallet_signals carries the forensics caveat', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'wallet_signals',
    arguments: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chains: ['ethereum'] },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  assert.match(text, /wallet-forensics-are-not-personhood/)
  assert.match(text, /tx sent/)
})

test('suggest_enrollment resolves a live subject', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'suggest_enrollment',
    arguments: { subject: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  assert.match(text, /current: score/)
  assert.match(text, /caveat:/)
})

test('explain_weight_history walks an adapter\'s audit trail', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'explain_weight_history',
    arguments: { adapter_id: 'lens-account' },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  // lens-account entered the registry at revision 36 on 2026-07-25; the trail must show
  // a revision, a source, and a block — the three things that make a weight accountable.
  assert.match(text, /revision|rev /i)
  assert.match(text, /lens/i)
  assert.match(text, /block/i)
})

test('compare_subjects contrasts a credentialed subject with an empty one', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'compare_subjects',
    arguments: {
      subject_a: '0x17a91203a9e9c3519c2f76210497ef7f4be2352f',
      subject_b: '0x0000000000000000000000000000000000000001',
      label_a: 'member',
      label_b: 'nobody',
    },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  assert.match(text, /member: score \d/)
  assert.match(text, /nobody: score 0\.00/)
  assert.match(text, /No verdict/)
})

test('check_fleet renders verdicts with rule traces', { skip: !LIVE }, async () => {
  const call = await rpc('tools/call', {
    name: 'check_fleet',
    arguments: {
      agents: ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', '0x0000000000000000000000000000000000000001'],
      min_score: 1.5,
    },
  })
  assert.ok(!call.result.isError, call.result.content?.[0]?.text)
  const text = call.result.content[0].text
  assert.match(text, /fleet decision/)
  assert.match(text, /human-identified/)
  assert.match(text, /humans identified:/)
})
