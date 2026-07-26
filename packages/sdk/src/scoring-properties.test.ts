import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshnessOf, score } from './scoring.ts'
import type { Address, Adapter, Evidence } from './types.ts'

/**
 * Property tests: invariants of the scoring model under seeded random inputs. The unit
 * suite pins known cases; this suite tries to break the *claims* the model makes —
 * monotonicity, saturation, order-independence — with a few thousand generated ontologies
 * and evidence sets. A failure here prints the seed that produced it.
 */

// Deterministic PRNG (mulberry32) so a red run is reproducible from the printed seed.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUBJECT = '0x1111111111111111111111111111111111111111' as Address
const ROOT_POOL = ['root:a', 'root:b', 'root:c', 'root:d', 'root:e']

function randomAdapter(r: () => number, id: string): Adapter {
  const forge = Math.floor(r() * 100_000)
  return {
    id,
    name: id,
    evidenceClass: 'Uniqueness',
    trustRoot: ROOT_POOL[Math.floor(r() * ROOT_POOL.length)]!,
    forgeCostCents: forge,
    rentCostCents: Math.floor(r() * (forge + 1)), // invariant: rent <= forge
    decayHalfLifeDays: 90,
    ageCurve: 'None',
    live: r() > 0.15,
    sourceURI: 'research/test.md',
  }
}

function evidenceFor(a: Adapter, held: boolean): Evidence {
  const cheapest = Math.min(a.forgeCostCents, a.rentCostCents)
  return {
    adapterId: a.id,
    adapterName: a.name,
    evidenceClass: a.evidenceClass,
    trustRoot: a.trustRoot,
    observedOn: SUBJECT,
    forgeCostCents: a.forgeCostCents,
    rentCostCents: a.rentCostCents,
    live: a.live,
    sourceURI: a.sourceURI,
    held,
    freshness: 1,
    effectiveCostCents: held && a.live ? cheapest : 0,
  }
}

function randomWorld(seed: number, nAdapters: number) {
  const r = rng(seed)
  const adapters = new Map<string, Adapter>()
  for (let i = 0; i < nAdapters; i++) {
    const a = randomAdapter(r, `t:${i}`)
    adapters.set(a.id, a)
  }
  const evidence = [...adapters.values()].map((a) => evidenceFor(a, r() > 0.5))
  return { r, adapters, evidence }
}

const runScore = (adapters: Map<string, Adapter>, evidence: Evidence[]) =>
  score({ subjects: [SUBJECT], adapters, evidence, now: 1_785_000_000 })

describe('scoring properties (seeded fuzz)', () => {
  test('adding held evidence never lowers the score (monotonicity)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { adapters, evidence } = randomWorld(seed, 8)
      const base = runScore(adapters, evidence)
      // Flip one absent credential to held.
      const absentIdx = evidence.findIndex((e) => !e.held)
      if (absentIdx === -1) continue
      const flipped = evidence.map((e, i) =>
        i === absentIdx ? evidenceFor(adapters.get(e.adapterId)!, true) : e,
      )
      const more = runScore(adapters, flipped)
      assert.ok(
        more.score >= base.score,
        `seed ${seed}: score dropped ${base.score} -> ${more.score} after adding evidence`,
      )
      assert.ok(more.totalCostCents >= base.totalCostCents, `seed ${seed}: total cost dropped`)
    }
  })

  test('same-root evidence saturates: the sum never exceeds one credential per root', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { adapters, evidence } = randomWorld(seed, 10)
      const r = runScore(adapters, evidence)
      // Each root's contribution equals its single strongest held credential, exactly.
      for (const root of r.roots) {
        const best = Math.max(
          ...evidence.filter((e) => e.held && e.trustRoot === root.trustRoot).map((e) => e.effectiveCostCents),
        )
        assert.equal(root.contributionCents, best, `seed ${seed}: root ${root.trustRoot} != strongest`)
      }
      // And the whole is the sum of per-root strongest — never of all credentials.
      const sumStrongest = r.roots.reduce((s, x) => s + x.contributionCents, 0)
      assert.equal(r.totalCostCents, sumStrongest, `seed ${seed}: total != sum of root maxima`)
      const sumAll = evidence.filter((e) => e.held).reduce((s, e) => s + e.effectiveCostCents, 0)
      assert.ok(r.totalCostCents <= sumAll + 1e-9, `seed ${seed}: saturation exceeded additive sum`)
    }
  })

  test('evidence order never changes the result', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { r, adapters, evidence } = randomWorld(seed, 9)
      const shuffled = [...evidence]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
      }
      const a = runScore(adapters, evidence)
      const b = runScore(adapters, shuffled)
      assert.equal(a.score, b.score, `seed ${seed}: order changed score`)
      assert.equal(a.totalCostCents, b.totalCostCents, `seed ${seed}: order changed total`)
      assert.equal(a.independentRoots, b.independentRoots, `seed ${seed}: order changed roots`)
    }
  })

  test('dead protocols contribute nothing, however many are held', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { adapters, evidence } = randomWorld(seed, 8)
      const deadHeld = evidence.filter((e) => e.held && !e.live)
      const r = runScore(adapters, evidence)
      const withoutDead = runScore(adapters, evidence.filter((e) => e.live || !e.held))
      assert.equal(r.score, withoutDead.score, `seed ${seed}: dead evidence moved the score`)
      if (deadHeld.length > 0) {
        assert.ok(
          r.caveats.some((c) => c.code === 'discontinued-protocol'),
          `seed ${seed}: dead held evidence must carry its caveat`,
        )
      }
    }
  })

  test('score is exactly log10(total+1), and isHuman answers against it', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { adapters, evidence } = randomWorld(seed, 6)
      const r = runScore(adapters, evidence)
      const expected = r.totalCostCents <= 0 ? 0 : Number(Math.log10(r.totalCostCents + 1).toFixed(4))
      assert.equal(r.score, expected, `seed ${seed}: score is not log10(total+1)`)
      assert.equal(r.isHuman(r.score - 0.0001 > 0 ? r.score - 0.0001 : 0), true)
      assert.equal(r.isHuman(r.score + 0.0001), false, `seed ${seed}: isHuman inconsistent`)
    }
  })

  test('independentRoots counts only roots at or above the 10¢ floor', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { adapters, evidence } = randomWorld(seed, 10)
      const r = runScore(adapters, evidence)
      const expected = r.roots.filter((x) => x.contributionCents >= 10).length
      assert.equal(r.independentRoots, expected, `seed ${seed}: independence floor drifted`)
    }
  })
})

describe('freshness curve properties (seeded fuzz)', () => {
  const DAY = 86_400
  const NOW = 1_785_000_000
  const curveAdapter = (ageCurve: 'Decay' | 'Ramp' | 'None', halfLife: number): Adapter => ({
    id: 't',
    name: 't',
    evidenceClass: 'Uniqueness',
    trustRoot: 'root:t',
    forgeCostCents: 100,
    rentCostCents: 100,
    decayHalfLifeDays: halfLife,
    ageCurve,
    live: true,
    sourceURI: 'research/test.md',
  })

  test('freshness is always within [0, 1]', () => {
    const r = rng(42)
    for (let i = 0; i < 2000; i++) {
      const curve = (['Decay', 'Ramp', 'None'] as const)[Math.floor(r() * 3)]!
      const a = curveAdapter(curve, Math.floor(r() * 3650) + 1)
      const issuedAt = r() > 0.3 ? NOW - Math.floor(r() * 4000 * DAY) : undefined
      const issuedAfter = r() > 0.5 ? NOW - Math.floor(r() * 4000 * DAY) : undefined
      const f = freshnessOf(a, issuedAt, NOW, issuedAfter)
      assert.ok(f >= 0 && f <= 1, `f=${f} out of range (i=${i}, curve=${curve})`)
    }
  })

  test('Decay is monotone non-increasing in age; Ramp monotone non-decreasing', () => {
    const r = rng(7)
    for (let i = 0; i < 1000; i++) {
      const halfLife = Math.floor(r() * 1000) + 1
      const youngAge = Math.floor(r() * 1000 * DAY)
      const oldAge = youngAge + 1 + Math.floor(r() * 1000 * DAY)
      const decay = curveAdapter('Decay', halfLife)
      const ramp = curveAdapter('Ramp', halfLife)
      assert.ok(
        freshnessOf(decay, NOW - oldAge, NOW) <= freshnessOf(decay, NOW - youngAge, NOW),
        `Decay rose with age (i=${i})`,
      )
      assert.ok(
        freshnessOf(ramp, NOW - oldAge, NOW) >= freshnessOf(ramp, NOW - youngAge, NOW),
        `Ramp fell with age (i=${i})`,
      )
    }
  })

  test('unknown-age Ramp sits at the 0.5 midpoint, and issuedAfter can only pull it DOWN', () => {
    const r = rng(11)
    for (let i = 0; i < 1000; i++) {
      const a = curveAdapter('Ramp', Math.floor(r() * 1000) + 1)
      assert.equal(freshnessOf(a, undefined, NOW), 0.5)
      // A proven lower bound on issuance caps the benefit of the doubt: a credential
      // provably younger than the midpoint deserves less than the midpoint, never more.
      const bound = NOW - Math.floor(r() * 4000 * DAY)
      const f = freshnessOf(a, undefined, NOW, bound)
      assert.ok(f <= 0.5, `issuedAfter raised unknown-age Ramp to ${f} (i=${i})`)
    }
  })

  test('a future-dated credential gets no benefit: Decay 1 at age<=0, Ramp 0', () => {
    const decay = curveAdapter('Decay', 90)
    const ramp = curveAdapter('Ramp', 90)
    for (const dt of [0, 1, DAY, 30 * DAY]) {
      assert.equal(freshnessOf(decay, NOW + dt, NOW), 1)
      assert.equal(freshnessOf(ramp, NOW + dt, NOW), 0)
    }
  })

  test('half-life means half: Decay at exactly one half-life is 0.5, Ramp is 0.5', () => {
    for (const hl of [30, 90, 365, 3650]) {
      const decay = curveAdapter('Decay', hl)
      const ramp = curveAdapter('Ramp', hl)
      const at = NOW - hl * DAY
      assert.ok(Math.abs(freshnessOf(decay, at, NOW) - 0.5) < 1e-9)
      assert.ok(Math.abs(freshnessOf(ramp, at, NOW) - 0.5) < 1e-9)
    }
  })

  test('None curve and zero half-life always score full freshness', () => {
    const none = curveAdapter('None', 90)
    assert.equal(freshnessOf(none, NOW - 5000 * DAY, NOW), 1)
    assert.equal(freshnessOf(none, undefined, NOW), 1)
    const zero = { ...curveAdapter('Decay', 90), decayHalfLifeDays: 0 }
    assert.equal(freshnessOf(zero, NOW - 5000 * DAY, NOW), 1)
  })
})
