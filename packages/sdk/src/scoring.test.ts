import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { score, freshnessOf, effectiveCost } from './scoring.ts'
import type { Adapter, Evidence, Address } from './types.ts'

const SUBJECT = '0x1111111111111111111111111111111111111111' as Address

function adapter(over: Partial<Adapter> & Pick<Adapter, 'id' | 'trustRoot'>): Adapter {
  return {
    name: over.id,
    evidenceClass: 'StateIdentity',
    forgeCostCents: 100_000,
    rentCostCents: 100_000,
    decayHalfLifeDays: 0,
    live: true,
    sourceURI: 'test',
    ...over,
  }
}

function ev(a: Adapter, over: Partial<Evidence> = {}): Evidence {
  const freshness = over.freshness ?? 1
  return {
    adapterId: a.id,
    adapterName: a.name,
    evidenceClass: a.evidenceClass,
    trustRoot: a.trustRoot,
    held: true,
    freshness,
    effectiveCostCents: effectiveCost(a, freshness),
    forgeCostCents: a.forgeCostCents,
    rentCostCents: a.rentCostCents,
    live: a.live,
    sourceURI: a.sourceURI,
    ...over,
  }
}

function run(adapters: Adapter[], evidence: Evidence[]) {
  return score({
    subject: SUBJECT,
    adapters: new Map(adapters.map((a) => [a.id, a])),
    evidence,
    now: 1_700_000_000,
  })
}

describe('saturation within a trust root', () => {
  test('three credentials from one passport count once, not three times', () => {
    const icao = 'state-document:icao-9303'
    const a = [
      adapter({ id: 'world-id-document', trustRoot: icao }),
      adapter({ id: 'zkpassport', trustRoot: icao }),
      adapter({ id: 'self-protocol', trustRoot: icao }),
    ]
    const r = run(a, a.map((x) => ev(x)))

    assert.equal(r.roots.length, 1, 'one root')
    assert.equal(r.independentRoots, 1)
    assert.equal(r.totalCostCents, 100_000, 'saturated to the strongest, not summed to 300k')
    assert.ok(r.roots[0]!.saturated)
    assert.ok(r.caveats.some((c) => c.code === 'correlated-evidence-saturated'))
  })

  test('the strongest credential in a root wins', () => {
    const root = 'kyc-vendor:sumsub'
    const weak = adapter({ id: 'weak', trustRoot: root, forgeCostCents: 500, rentCostCents: 500 })
    const strong = adapter({ id: 'strong', trustRoot: root, forgeCostCents: 9_000, rentCostCents: 9_000 })
    const r = run([weak, strong], [ev(weak), ev(strong)])

    assert.equal(r.totalCostCents, 9_000)
    assert.deepEqual(r.roots[0]!.adapterIds.sort(), ['strong', 'weak'])
  })

  test('distinct roots sum', () => {
    const a = [
      adapter({ id: 'orb', trustRoot: 'iris-registry:world-orb', forgeCostCents: 50_000, rentCostCents: 50_000 }),
      adapter({ id: 'passport', trustRoot: 'state-document:icao-9303', forgeCostCents: 30_000, rentCostCents: 30_000 }),
      adapter({ id: 'circles', trustRoot: 'social-trust:circles', forgeCostCents: 100, rentCostCents: 100 }),
    ]
    const r = run(a, a.map((x) => ev(x)))

    assert.equal(r.roots.length, 3)
    assert.equal(r.independentRoots, 3)
    assert.equal(r.totalCostCents, 80_100)
    assert.ok(!r.roots.some((x) => x.saturated))
  })
})

describe('the farm vs the person — the whole thesis in one test', () => {
  test('a farm with more credentials scores lower than a person with diverse ones', () => {
    const icao = 'state-document:icao-9303'
    // One passport, presented to every protocol that reads passports.
    const farmAdapters = [
      adapter({ id: 'world-id-document', trustRoot: icao, forgeCostCents: 150_000, rentCostCents: 2_000 }),
      adapter({ id: 'zkpassport', trustRoot: icao, forgeCostCents: 150_000, rentCostCents: 2_000 }),
      adapter({ id: 'self-protocol', trustRoot: icao, forgeCostCents: 150_000, rentCostCents: 2_000 }),
    ]
    const farm = run(farmAdapters, farmAdapters.map((x) => ev(x)))

    // Three credentials, three genuinely different roots.
    const personAdapters = [
      adapter({ id: 'world-id-orb', trustRoot: 'iris-registry:world-orb', forgeCostCents: 50_000, rentCostCents: 50 }),
      adapter({ id: 'circles-v2', trustRoot: 'social-trust:circles', forgeCostCents: 100, rentCostCents: 50 }),
      adapter({ id: 'coinbase', trustRoot: 'kyc-vendor:persona', forgeCostCents: 120_000, rentCostCents: 3_000 }),
    ]
    const person = run(personAdapters, personAdapters.map((x) => ev(x)))

    assert.equal(farm.evidence.length, person.evidence.length, 'same credential count')
    assert.equal(farm.independentRoots, 1)
    assert.equal(person.independentRoots, 3)
    assert.ok(
      person.score > farm.score,
      `diverse roots must beat a single root: person ${person.score} vs farm ${farm.score}`,
    )

    // And the naive additive scorer would have ranked them the other way round.
    const additive = (evs: Evidence[]) => evs.reduce((s, e) => s + e.effectiveCostCents, 0)
    assert.ok(
      additive(farm.evidence) > additive(person.evidence),
      'precondition: naive additive scoring inverts the ranking, which is why we do not use it',
    )
  })
})

describe('cost model', () => {
  test('a credential is worth the cheaper of forging and renting one', () => {
    const a = adapter({ id: 'orb', trustRoot: 'r', forgeCostCents: 50_000, rentCostCents: 50 })
    assert.equal(effectiveCost(a, 1), 50, 'renting defeats any amount of cryptography')
  })

  test('hardening only against sale cannot inflate a score', () => {
    const beforeHardening = adapter({ id: 'x', trustRoot: 'r', forgeCostCents: 10_000, rentCostCents: 100 })
    const afterHardening = adapter({ id: 'x', trustRoot: 'r', forgeCostCents: 900_000, rentCostCents: 100 })
    assert.equal(effectiveCost(beforeHardening, 1), effectiveCost(afterHardening, 1))
  })

  test('discontinued protocols score zero but stay visible', () => {
    const dead = adapter({ id: 'civic-pass', trustRoot: 'kyc-vendor:persona', live: false })
    const r = run([dead], [ev(dead, { live: false, effectiveCostCents: effectiveCost(dead, 1) })])

    assert.equal(r.totalCostCents, 0)
    assert.equal(r.evidence.length, 1, 'still reported')
    assert.ok(r.caveats.some((c) => c.code === 'discontinued-protocol'))
  })
})

describe('freshness', () => {
  const decaying = adapter({ id: 'selfie', trustRoot: 'liveness:world-selfie', decayHalfLifeDays: 90 })

  test('one half-life halves the weight', () => {
    const now = 1_700_000_000
    const f = freshnessOf(decaying, now - 90 * 86_400, now)
    assert.ok(Math.abs(f - 0.5) < 1e-9)
  })

  test('a fresh credential is undecayed', () => {
    const now = 1_700_000_000
    assert.equal(freshnessOf(decaying, now, now), 1)
  })

  test('unknown issue date is not silently penalised, only flagged', () => {
    const now = 1_700_000_000
    assert.equal(freshnessOf(decaying, undefined, now), 1)

    const r = run([decaying], [ev(decaying, { issuedAt: undefined })])
    assert.ok(r.caveats.some((c) => c.code === 'issuance-date-unknown'))
  })

  test('non-decaying adapters ignore age', () => {
    const permanent = adapter({ id: 'p', trustRoot: 'r', decayHalfLifeDays: 0 })
    assert.equal(freshnessOf(permanent, 0, 1_700_000_000), 1)
  })
})

describe('caveats', () => {
  test('independent control is always flagged and never suppressible', () => {
    const empty = run([], [])
    assert.ok(empty.caveats.some((c) => c.code === 'independent-control-not-attested'))

    const a = adapter({ id: 'orb', trustRoot: 'iris-registry:world-orb' })
    const full = run([a], [ev(a)])
    assert.ok(full.caveats.some((c) => c.code === 'independent-control-not-attested'))
  })

  test('no evidence is reported as absence of evidence, not as a negative', () => {
    const r = run([], [])
    assert.equal(r.score, 0)
    assert.equal(r.independentRoots, 0)
    assert.ok(r.caveats.some((c) => c.code === 'no-evidence'))
  })

  test('an unresolved trust root is flagged as possibly correlated', () => {
    const a = adapter({ id: 'humanity-protocol', trustRoot: 'unknown' })
    const r = run([a], [ev(a)])
    assert.ok(r.caveats.some((c) => c.code === 'unresolved-trust-root'))
  })
})

describe('isHuman', () => {
  const a = adapter({ id: 'orb', trustRoot: 'iris-registry:world-orb', forgeCostCents: 50_000, rentCostCents: 50_000 })

  test('requires an explicit threshold', () => {
    const r = run([a], [ev(a)])
    // @ts-expect-error deliberately calling without the required argument
    assert.throws(() => r.isHuman(), TypeError)
    assert.throws(() => r.isHuman(Number.NaN), TypeError)
  })

  test('compares against the caller threshold', () => {
    const r = run([a], [ev(a)])
    assert.ok(r.isHuman(1))
    assert.ok(!r.isHuman(9))
  })

  test('unheld evidence does not count', () => {
    const r = run([a], [ev(a, { held: false })])
    assert.equal(r.totalCostCents, 0)
    assert.equal(r.independentRoots, 0)
  })
})
