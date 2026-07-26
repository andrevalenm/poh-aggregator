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
    ageCurve: 'Decay',
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
    observedOn: SUBJECT,
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
    subjects: [SUBJECT],
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

describe('multi-address subjects', () => {
  const OTHER = '0x2222222222222222222222222222222222222222' as Address

  function runMulti(adapters: Adapter[], evidence: Evidence[]) {
    return score({
      subjects: [SUBJECT, OTHER],
      adapters: new Map(adapters.map((a) => [a.id, a])),
      evidence,
      now: 1_700_000_000,
    })
  }

  /**
   * Real people spread credentials across wallets — PoH's own Circles proxy pairs a PoH
   * address with a separate Circles avatar — so an address-keyed lookup undercounts them.
   */
  test('credentials on different wallets aggregate into one subject', () => {
    const poh = adapter({ id: 'poh-v2', trustRoot: 'social-vouching:poh', forgeCostCents: 1_000, rentCostCents: 500 })
    const circles = adapter({ id: 'circles-v2', trustRoot: 'social-trust:circles', forgeCostCents: 100, rentCostCents: 50 })

    const r = runMulti([poh, circles], [ev(poh, { observedOn: SUBJECT }), ev(circles, { observedOn: OTHER })])

    assert.equal(r.independentRoots, 2, 'both wallets contribute')
    assert.equal(r.totalCostCents, 550)
    assert.deepEqual(r.subjects, [SUBJECT, OTHER])
    assert.ok(r.caveats.some((c) => c.code === 'multi-address-subject'))
  })

  /** And the obvious attack — split one credential type over many wallets — must not pay. */
  test('splitting correlated credentials across wallets does not inflate the score', () => {
    const icao = 'state-document:icao-9303'
    const a = adapter({ id: 'zkpassport', trustRoot: icao, forgeCostCents: 150_000, rentCostCents: 2_000 })
    const b = adapter({ id: 'self-protocol', trustRoot: icao, forgeCostCents: 150_000, rentCostCents: 2_000 })

    const oneWallet = run([a, b], [ev(a), ev(b)])
    const twoWallets = runMulti([a, b], [ev(a, { observedOn: SUBJECT }), ev(b, { observedOn: OTHER })])

    assert.equal(twoWallets.totalCostCents, oneWallet.totalCostCents, 'saturation spans addresses')
    assert.equal(twoWallets.independentRoots, 1)
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

  test('two discontinued credentials on one root are NOT reported as saturated', () => {
    // Regression: both contribute zero, so nothing of value was collapsed. Claiming they
    // were "counted once" is false — the discontinued caveat is what explains them.
    const persona = 'kyc-vendor:persona'
    const a = adapter({ id: 'civic-pass', trustRoot: persona, live: false })
    const b = adapter({ id: 'idena-x', trustRoot: persona, live: false })
    const r = run([a, b], [ev(a, { live: false, effectiveCostCents: 0 }), ev(b, { live: false, effectiveCostCents: 0 })])

    assert.equal(r.totalCostCents, 0)
    assert.ok(!r.roots.some((x) => x.saturated), 'a zero-value root is not saturation')
    assert.ok(!r.caveats.some((c) => c.code === 'correlated-evidence-saturated'))
    assert.ok(r.caveats.some((c) => c.code === 'discontinued-protocol'))
  })

  test('one live + one dead credential on a root is not saturation either', () => {
    // Only the live one has value; the dead one wasn't "counted once" against it.
    const persona = 'kyc-vendor:persona'
    const live = adapter({ id: 'coinbase', trustRoot: persona, forgeCostCents: 120_000, rentCostCents: 3_000 })
    const dead = adapter({ id: 'civic-pass', trustRoot: persona, live: false })
    const r = run([live, dead], [ev(live), ev(dead, { live: false, effectiveCostCents: 0 })])

    assert.equal(r.totalCostCents, 3_000)
    assert.ok(!r.roots.some((x) => x.saturated))
  })

  test('discontinued protocols score zero but stay visible', () => {
    const dead = adapter({ id: 'civic-pass', trustRoot: 'kyc-vendor:persona', live: false })
    const r = run([dead], [ev(dead, { live: false, effectiveCostCents: effectiveCost(dead, 1) })])

    assert.equal(r.totalCostCents, 0)
    assert.equal(r.evidence.length, 1, 'still reported')
    assert.ok(r.caveats.some((c) => c.code === 'discontinued-protocol'))
  })
})

describe('age curves', () => {
  const now = 1_700_000_000
  // Real ontology costs: PoH forge $10, rent $5. The evidence floor is 10¢.
  const ramp = adapter({
    id: 'poh-v2',
    trustRoot: 'social-vouching:poh',
    forgeCostCents: 1_000,
    rentCostCents: 500,
    decayHalfLifeDays: 365,
    ageCurve: 'Ramp',
  })

  test('ramp: a week-old registration weighs almost nothing', () => {
    const f = freshnessOf(ramp, now - 7 * 86_400, now)
    assert.ok(f < 0.02, `expected ~0.013, got ${f}`)
  })

  test('ramp: one half-life of survival earns half weight', () => {
    const f = freshnessOf(ramp, now - 365 * 86_400, now)
    assert.ok(Math.abs(f - 0.5) < 1e-9)
  })

  test('ramp: unknown age gets the midpoint, never full weight', () => {
    // Full weight on missing data would make subgraph downtime profitable for a farm.
    assert.equal(freshnessOf(ramp, undefined, now), 0.5)
  })

  test('ramp: a proven upper bound on age caps the weight instead of taking the midpoint', () => {
    // The credential was absent from a complete index an hour ago, so it is at most an hour
    // old — the ramp value for an hour, not the 0.5 given to a genuinely unknown age.
    const capped = freshnessOf(ramp, undefined, now, now - 3600)
    assert.ok(capped < 0.0002, `expected ~0.00008, got ${capped}`)
    assert.ok(capped < freshnessOf(ramp, undefined, now), 'strictly tighter than unknown')
  })

  test('ramp: a loose bound never beats the unknown-age midpoint', () => {
    // A three-year-stale index permits a three-year-old credential, which the curve would put
    // at 0.87 — but the bound is an upper limit on age, not a measurement, so it only ever
    // caps. Otherwise slowing our index down would be a way to buy weight.
    assert.equal(freshnessOf(ramp, undefined, now, now - 1095 * 86_400), 0.5)
  })

  test('the airdrop scenario: fresh claim vs survived claim, same protocol', () => {
    const fresh = ev(ramp, { issuedAt: now - 7 * 86_400, freshness: freshnessOf(ramp, now - 7 * 86_400, now) })
    fresh.effectiveCostCents = effectiveCost(ramp, fresh.freshness)
    const survived = ev(ramp, { issuedAt: now - 700 * 86_400, freshness: freshnessOf(ramp, now - 700 * 86_400, now) })
    survived.effectiveCostCents = effectiveCost(ramp, survived.freshness)

    const freshResult = run([ramp], [fresh])
    const survivedResult = run([ramp], [survived])
    assert.ok(
      survivedResult.score > freshResult.score * 1.5,
      `survival must dominate: survived ${survivedResult.score} vs fresh ${freshResult.score}`,
    )
    assert.equal(freshResult.independentRoots, 0, 'a week-old airdrop claim alone is below the evidence floor')
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

  test('an age bound cannot penalise a decay curve', () => {
    // On Decay the same bound says the credential is *young*, which means less decay, not
    // more — so it cannot tighten the unknown-age answer and must be ignored.
    const now = 1_700_000_000
    assert.equal(freshnessOf(decaying, undefined, now, now - 400 * 86_400), 1)
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

  /**
   * Two ways a chain-derived date can be honest and still not be the issuance date. Both are
   * Farcaster's, and both matter on a Ramp: one understates age and one would overstate it.
   */
  test('a credential imported from a predecessor registry says its date is a floor', () => {
    const a = adapter({ id: 'farcaster-account', trustRoot: 'social-account:farcaster' })
    const r = run(
      [a],
      [
        ev(a, {
          provenance: { heldFrom: 'chain', dateFrom: 'chain', notes: ['date-from-registry-import'] },
        }),
      ],
    )
    const c = r.caveats.find((x) => x.code === 'credential-imported-from-predecessor-registry')
    assert.ok(c, 'the import must be disclosed')
    assert.ok(c.message.includes('farcaster-account'))
    assert.ok(c.message.includes('floor'), 'and must say which direction the error runs in')
  })

  test('a credential that changed hands is disclosed as dated from the purchase', () => {
    const a = adapter({ id: 'farcaster-account', trustRoot: 'social-account:farcaster' })
    const r = run(
      [a],
      [
        ev(a, {
          provenance: {
            heldFrom: 'chain',
            dateFrom: 'chain',
            notes: ['credential-transferred-since-issuance'],
          },
        }),
      ],
    )
    assert.ok(r.caveats.some((x) => x.code === 'credential-changed-hands'))
    // An unheld credential is not evidence of anything, so it raises no caveat either.
    const absent = run(
      [a],
      [
        ev(a, {
          held: false,
          provenance: {
            heldFrom: 'chain',
            dateFrom: 'chain',
            notes: ['credential-transferred-since-issuance'],
          },
        }),
      ],
    )
    assert.ok(!absent.caveats.some((x) => x.code === 'credential-changed-hands'))
  })

  /**
   * The AgentBook shape: a registry with a binding and no expiry. The date is the registration,
   * which is later than the enrolment, so on Decay the weight it produces is a ceiling — and the
   * alternative is no date at all, which `freshnessOf` scores at 1 for ever.
   */
  test('a credential dated from its registration says the weight is a ceiling', () => {
    const a = adapter({
      id: 'world-id-orb',
      trustRoot: 'iris-registry:world-orb',
      decayHalfLifeDays: 1095,
    })
    const dated = ev(a, {
      issuedAt: 1_700_000_000 - 200 * 86_400,
      freshness: freshnessOf(a, 1_700_000_000 - 200 * 86_400, 1_700_000_000),
      provenance: {
        heldFrom: 'chain',
        dateFrom: 'chain',
        notes: ['date-from-agent-registration'],
      },
    })
    const r = run([a], [dated])
    const c = r.caveats.find((x) => x.code === 'issuance-date-is-registration')
    assert.ok(c, 'the registration date must be disclosed for what it is')
    assert.ok(c.message.includes('world-id-orb'))
    assert.ok(c.message.includes('ceiling'), 'and must say which direction the error runs in')

    // Having a date at all is the point: it removes the unknown-age caveat *and* the full weight
    // that came with it. 200 days against a 1,095-day half-life is ~12% off the top.
    assert.ok(!r.caveats.some((x) => x.code === 'issuance-date-unknown'))
    const undated = run([a], [ev(a, { freshness: freshnessOf(a, undefined, 1_700_000_000) })])
    assert.ok(undated.caveats.some((x) => x.code === 'issuance-date-unknown'))
    assert.ok(
      r.roots[0]!.contributionCents < undated.roots[0]!.contributionCents,
      'an undated credential must not be worth more than a dated one of the same class',
    )
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

describe('aggregates that restate other credentials', () => {
  /**
   * Human Passport is an aggregate: its score is built from stamps, and several of those
   * stamps are credentials with their own entry and their own root here. The arithmetic is
   * kept safe by pricing the aggregate at what it can claim alone, so these tests pin both
   * halves — that the restatement is disclosed, and that disclosing it changes no number.
   */
  const passport = adapter({
    id: 'human-passport',
    trustRoot: 'behavioral:wallet-history',
    evidenceClass: 'Behavioral',
    forgeCostCents: 2_000,
    rentCostCents: 100,
  })
  const holonym = adapter({
    id: 'holonym-gov-id',
    trustRoot: 'kyc-vendor:unattributed',
    forgeCostCents: 120_000,
    rentCostCents: 3_000,
  })

  test('the restated credentials are named, with the roots they belong to', () => {
    const r = run(
      [passport, holonym],
      [ev(passport, { detail: { score: 28.847, restatesAdapters: ['holonym-gov-id'] } })],
    )
    const c = r.caveats.find((x) => x.code === 'aggregate-restates-other-credentials')
    assert.ok(c, 'an aggregate carrying other roots must say so')
    assert.match(c.message, /holonym-gov-id \(kyc-vendor:unattributed\)/)
    assert.match(c.message, /behavioral:wallet-history/)
  })

  test('a restated identity credential earns identity money only from its own probe', () => {
    // The passport is worth its own rent ($1) whether or not a $30 KYC stamp is inside it.
    // If restatement ever started adding cost, this is the test that would notice.
    const bare = run([passport, holonym], [ev(passport)])
    const loaded = run(
      [passport, holonym],
      [ev(passport, { detail: { restatesAdapters: ['holonym-gov-id'] } })],
    )
    assert.equal(loaded.totalCostCents, bare.totalCostCents)
    assert.equal(loaded.totalCostCents, 100)
    assert.equal(loaded.independentRoots, 1)
  })

  test('probing the restated credential directly is what adds its root', () => {
    const r = run(
      [passport, holonym],
      [ev(passport, { detail: { restatesAdapters: ['holonym-gov-id'] } }), ev(holonym)],
    )
    assert.equal(r.independentRoots, 2)
    assert.equal(r.totalCostCents, 3_100)
    // Two roots, not one saturated root: the passport is genuinely different evidence from
    // the gov-id check, it is just cheap.
    assert.ok(!r.roots.some((x) => x.saturated))
  })

  test('an unheld aggregate discloses nothing', () => {
    const r = run(
      [passport, holonym],
      [ev(passport, { held: false, detail: { restatesAdapters: ['holonym-gov-id'] } })],
    )
    assert.ok(!r.caveats.some((x) => x.code === 'aggregate-restates-other-credentials'))
  })
})
