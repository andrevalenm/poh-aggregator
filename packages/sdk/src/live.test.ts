/**
 * Live integration tests. These hit real chains and the deployed registry — no mocks,
 * because the failure mode we care about is "the adapter silently stopped matching
 * reality", and a mock cannot catch that.
 *
 * Run: node --test --experimental-strip-types src/live.test.ts
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Corroborate, DEFAULT_REGISTRY } from './index.ts'
import { worldIdOrbAdapter, pohAdapter, circlesAdapter, coinbaseVerificationAdapter } from './adapters/index.ts'
import type { Address } from './types.ts'

const ontologyJson = JSON.parse(readFileSync(new URL('../../../ontology/adapters.json', import.meta.url), 'utf8'))
const knownIds: string[] = ontologyJson.adapters.map((a: { id: string }) => a.id)
const knownRoots: string[] = Object.keys(ontologyJson.trustRoots)

const UNREGISTERED = '0x000000000000000000000000000000000000dEaD' as Address

describe('registry (Sepolia, live)', () => {
  let client: Corroborate

  before(() => {
    client = new Corroborate({ knownIds, knownRoots })
  })

  test('loads the seeded ontology', async () => {
    const { adapters, revision } = await client.ontology()
    assert.ok(adapters.size >= 15, `expected >=15 adapters, got ${adapters.size}`)
    assert.ok(revision >= 15)

    const orb = adapters.get('world-id-orb')
    assert.ok(orb, 'world-id-orb must resolve by name, not hash')
    assert.equal(orb.trustRoot, 'iris-registry:world-orb')
    assert.equal(orb.evidenceClass, 'Uniqueness')
    assert.ok(orb.sourceURI.includes('research/'), 'every weight cites its source')
  })

  test('the ICAO cluster is present and shared — the core claim', async () => {
    const { adapters } = await client.ontology()
    const icao = [...adapters.values()].filter((a) => a.trustRoot === 'state-document:icao-9303')
    assert.ok(icao.length >= 3, `expected >=3 adapters on the passport root, got ${icao.length}`)
    const ids = icao.map((a) => a.id).sort()
    assert.ok(ids.includes('zkpassport') && ids.includes('self-protocol'))
  })

  test('discontinued protocols are retained and marked dead', async () => {
    const { adapters } = await client.ontology()
    assert.equal(adapters.get('civic-pass')?.live, false)
    assert.equal(adapters.get('brightid')?.live, false)
  })

  test('rent is never above forge for any adapter', async () => {
    const { adapters } = await client.ontology()
    for (const a of adapters.values()) {
      assert.ok(
        a.rentCostCents <= a.forgeCostCents,
        `${a.id}: renting (${a.rentCostCents}) should not cost more than forging (${a.forgeCostCents})`,
      )
    }
  })
})

describe('adapters against live chains', () => {
  test('World AgentBook responds and returns 0 for an unregistered address', async () => {
    const r = await worldIdOrbAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('PoH v2 responds', async () => {
    const r = await pohAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('Circles Hub responds', async () => {
    const r = await circlesAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })

  test('Coinbase/EAS responds', async () => {
    const r = await coinbaseVerificationAdapter().probe(UNREGISTERED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
  })
})

describe('end to end', () => {
  test('an address with no credentials scores 0 with an explicit no-evidence caveat', async () => {
    const client = new Corroborate({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)

    assert.equal(r.subject, UNREGISTERED)
    assert.equal(r.score, 0)
    assert.equal(r.independentRoots, 0)
    assert.ok(r.evidence.length >= 4, 'every adapter reports, even when it finds nothing')
    assert.ok(r.caveats.some((c) => c.code === 'no-evidence'))
    assert.ok(r.caveats.some((c) => c.code === 'independent-control-not-attested'))
    assert.equal(r.registryRevision! >= 15, true)
  })

  test('isHuman refuses to guess a threshold', async () => {
    const client = new Corroborate({ knownIds, knownRoots })
    const r = await client.resolve(UNREGISTERED)
    // @ts-expect-error missing required argument is the point
    assert.throws(() => r.isHuman(), TypeError)
    assert.equal(r.isHuman(1), false)
  })

  test('a failing probe degrades the result instead of failing it', async () => {
    const client = new Corroborate({
      knownIds,
      knownRoots,
      adapters: [
        { adapterId: 'world-id-orb', probe: async () => ({ held: false, error: 'simulated outage' }) },
        pohAdapter(),
      ],
    })
    const r = await client.resolve(UNREGISTERED)

    const world = r.evidence.find((e) => e.adapterId === 'world-id-orb')
    assert.ok(world, 'the failed adapter is still reported')
    assert.equal(world.detail?.unavailable, true, 'and flagged unavailable, not silently negative')
    assert.equal(world.held, false)
  })
})
