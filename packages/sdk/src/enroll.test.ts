import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { suggestEnrollment, enrollableRoots } from './enroll.ts'
import type { Adapter, Evidence } from './types.ts'

/**
 * The recommender's correctness IS the saturation rule, restated. If it ever suggests a root
 * the subject already holds, it is telling them to waste a trip to a passport office — and
 * quietly contradicting the scoring engine in the same breath.
 */

const adapter = (id: string, trustRoot: string, cents: number): Adapter => ({
  id,
  name: id,
  evidenceClass: 'Uniqueness',
  trustRoot,
  forgeCostCents: cents * 10,
  rentCostCents: cents,
  decayHalfLifeDays: 0,
  ageCurve: 'None',
  live: true,
  sourceURI: '',
})

const ONTOLOGY = new Map<string, Adapter>(
  (
    [
      ['world-id-orb', 'iris-registry:world-orb', 50],
      ['zkpassport', 'state-document:icao-9303', 2000],
      ['self-protocol', 'state-document:icao-9303', 2000],
      ['poh-v2', 'social-vouching:poh', 500],
      ['circles-v2', 'social-trust:circles', 50],
      ['coinbase-verification', 'kyc-vendor:persona', 3000],
    ] as const
  ).map(([id, root, cents]) => [id, adapter(id, root, cents)]),
)

const evidence = (adapterId: string, trustRoot: string, cents: number, held = true): Evidence => ({
  adapterId,
  adapterName: adapterId,
  evidenceClass: 'Uniqueness',
  trustRoot,
  observedOn: '0x0000000000000000000000000000000000000001',
  forgeCostCents: cents * 10,
  rentCostCents: cents,
  live: true,
  sourceURI: '',
  held,
  freshness: 1,
  effectiveCostCents: held ? cents : 0,
})

const resultOf = (ev: Evidence[]) => {
  const roots = new Set(ev.filter((e) => e.held && e.effectiveCostCents >= 10).map((e) => e.trustRoot))
  let total = 0
  for (const r of roots) {
    total += Math.max(...ev.filter((e) => e.trustRoot === r).map((e) => e.effectiveCostCents))
  }
  return {
    score: Number(Math.log10(total + 1).toFixed(4)),
    totalCostCents: total,
    independentRoots: roots.size,
    evidence: ev,
  }
}

describe('enrollment routing', () => {
  test('never suggests a root the subject already holds', () => {
    const r = resultOf([evidence('zkpassport', 'state-document:icao-9303', 2000)])
    const advice = suggestEnrollment(r, ONTOLOGY)

    assert.ok(
      !advice.suggestions.some((s) => s.trustRoot === 'state-document:icao-9303'),
      'suggesting a second passport credential would add nothing and contradict saturation',
    )
    assert.ok(
      advice.wouldAddNothing.some((w) => w.trustRoot === 'state-document:icao-9303'),
      'it should be named explicitly as adding nothing, not silently omitted',
    )
  })

  test('every suggestion actually raises the score, and by the amount claimed', () => {
    const r = resultOf([evidence('circles-v2', 'social-trust:circles', 50)])
    const advice = suggestEnrollment(r, ONTOLOGY)

    assert.ok(advice.suggestions.length > 0)
    for (const s of advice.suggestions) {
      assert.ok(s.scoreGain > 0, `${s.trustRoot} claims a non-positive gain`)
      assert.equal(s.projectedRoots, r.independentRoots + 1)
      // The projection must match what score() would actually produce for that total.
      const expected = Number(Math.log10(r.totalCostCents + s.contributionCents + 1).toFixed(4))
      assert.equal(s.projectedScore, expected, `${s.trustRoot} projection disagrees with log10`)
    }
  })

  test('ranked by gain, largest first', () => {
    const advice = suggestEnrollment(resultOf([]), ONTOLOGY)
    const gains = advice.suggestions.map((s) => s.scoreGain)
    assert.deepEqual(gains, [...gains].sort((a, b) => b - a))
  })

  test('a discontinued credential leaves its root open to routing', () => {
    // Held but scored at zero — the root is genuinely empty, so we should still route there.
    const dead = evidence('poh-v2', 'social-vouching:poh', 500)
    dead.effectiveCostCents = 0
    dead.live = false
    const advice = suggestEnrollment(resultOf([dead]), ONTOLOGY)
    assert.ok(
      advice.suggestions.some((s) => s.trustRoot === 'social-vouching:poh'),
      'a zero-weight credential must not block routing to its root',
    )
  })

  test('a subject with nothing gets every routable root, and the caveat is not optional', () => {
    const advice = suggestEnrollment(resultOf([]), ONTOLOGY)
    assert.equal(advice.currentRoots, 0)
    assert.ok(advice.suggestions.length >= 5)
    assert.match(advice.caveat, /privacy price|absence of evidence/)
  })

  test('every routable root carries at least one option with a real URL', () => {
    for (const root of enrollableRoots()) {
      const advice = suggestEnrollment(resultOf([]), ONTOLOGY)
      const all = [...advice.suggestions, ...advice.wouldAddNothing]
      const entry = all.find((s) => s.trustRoot === root)
      if (!entry) continue // priced below the negligible floor, or absent from this ontology
      assert.ok(entry.options.length > 0, `${root} has no enrolment options`)
      for (const o of entry.options) {
        assert.match(o.url, /^https:\/\//, `${root}: ${o.name} has no https URL`)
        assert.ok(o.youGive.length > 10, `${root}: ${o.name} does not say what it costs the person`)
      }
    }
  })
})
