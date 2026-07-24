import { Corroborate } from '../packages/sdk/dist/index.js'
import { readFileSync, writeFileSync } from 'node:fs'
const ont = JSON.parse(readFileSync('ontology/adapters.json','utf8'))
const knownIds = ont.adapters.map(a=>a.id), knownRoots = Object.keys(ont.trustRoots)
const vec = JSON.parse(readFileSync('scripts/vectors.json','utf8'))

const candidates = [
  ...vec.circles.map(c=>c.address),
  '0xd267eba602e692216703626a81157214b24c85fb',
  '0xf7e4d92f94d9cae4ca5fd7bf5faebc239e3f7045',
  '0x91f640387ea7d050376f9e6854f090c08da9af7b',
  '0x34bb05bd9ffc2a815be6fa2662b22efb1611bf18',
  '0x02d8520991855aa20af158cbcead471792539892',
  '0xa38ba430ce67a8dc6b511204ce7a0fe6e8c60c51',
]
const client = new Corroborate({ knownIds, knownRoots })
const results = []
for (const a of candidates) {
  const r = await client.resolve(a)
  const held = r.evidence.filter(e=>e.held)
  if (held.length) {
    results.push({ address:a, score:r.score, roots:r.independentRoots, held: held.map(e=>e.adapterId), detail: held.map(e=>e.detail) })
    console.log(`${a}  score=${r.score.toFixed(2)}  roots=${r.independentRoots}  [${held.map(e=>e.adapterId).join(', ')}]`)
  }
}
results.sort((a,b)=>b.roots-a.roots || b.score-a.score)
writeFileSync('scripts/vectors-scored.json', JSON.stringify(results,null,2))
console.log(`\n${results.length} addresses with at least one credential`)
console.log('best (most independent roots):', JSON.stringify(results[0],null,2))
