// One-command health check for the whole Corroborate stack. Run it in the morning:
//   node scripts/health.mjs
// Verifies, with real reads: the registry ontology, all live probes against a known
// subject, both subgraphs, the hosted landing, and ENS. Exit 0 = everything answered;
// exit 1 lists what did not. No keys needed; nothing is written anywhere.
import { Corroborate, DEFAULT_REGISTRY } from '../packages/sdk/dist/index.js'

const HOSTED = 'http://37.27.67.44:8788/'
const REGISTRY_SUBGRAPH = 'http://37.27.67.44:8100/subgraphs/name/corroborate-registry'
// A wallet that holds credentials (PoH member) — probes should find something,
// which distinguishes "answered honestly" from "answered empty because broken".
const KNOWN_SUBJECT = '0x17a91203a9e9c3519c2f76210497ef7f4be2352f'

const results = []
const check = async (name, fn) => {
  const t0 = Date.now()
  try {
    const detail = await fn()
    results.push({ name, ok: true, ms: Date.now() - t0, detail })
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: e.message?.slice(0, 120) })
  }
}

const client = new Corroborate({})

await check('registry ontology', async () => {
  const o = await client.ontology()
  if (o.adapters.size < 30) throw new Error(`only ${o.adapters.size} adapters`)
  return `${o.adapters.size} adapters, revision ${o.revision}`
})

await check('full probe sweep', async () => {
  const r = await client.resolve(KNOWN_SUBJECT)
  const unreachable = r.evidence.filter((e) => e.detail?.unavailable).map((e) => e.adapterId)
  if (unreachable.length > 2) throw new Error(`unreachable: ${unreachable.join(', ')}`)
  if (!r.evidence.some((e) => e.held)) throw new Error('known subject shows no credentials — probes may be lying empty')
  return `score ${r.score.toFixed(2)}, ${r.evidence.filter((e) => e.held).length} held, ${unreachable.length} unreachable${unreachable.length ? ` (${unreachable.join(', ')})` : ''}`
})

await check('registry audit-trail subgraph', async () => {
  const res = await fetch(REGISTRY_SUBGRAPH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ weightChanges(first: 1, orderBy: revision, orderDirection: desc) { revision } _meta { block { number } } }' }),
    signal: AbortSignal.timeout(15_000),
  })
  const j = await res.json()
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 100))
  return `latest revision ${j.data.weightChanges[0]?.revision}, indexed to block ${j.data._meta.block.number}`
})

await check('hosted landing', async () => {
  const res = await fetch(HOSTED, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (!html.includes('registry-line')) throw new Error('page served but widget markup missing')
  return `200, ${(html.length / 1024).toFixed(0)}KB`
})

await check('ENS corroborate.eth (Sepolia)', async () => {
  // The name lives on Sepolia's ENS deployment until the mainnet decision is made.
  const sepoliaEns = new Corroborate({ ensChain: 'sepolia' })
  const r = await sepoliaEns.resolveSubject('corroborate.eth')
  if (!r.declaredSubjects?.length) throw new Error('subjects record empty')
  return `${r.address.slice(0, 10)}…, ${r.declaredSubjects.length} declared subjects`
})

const width = Math.max(...results.map((r) => r.name.length))
for (const r of results) {
  console.log(`${r.ok ? ' ok ' : 'FAIL'}  ${r.name.padEnd(width)}  ${String(r.ms).padStart(6)}ms  ${r.detail}`)
}
const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.error(`\n${failed.length} of ${results.length} checks failed`)
  process.exit(1)
}
console.log(`\nall ${results.length} checks green (registry ${DEFAULT_REGISTRY.slice(0, 10)}…)`)
