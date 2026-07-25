import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAsOfToEvidence,
  blockAtOrBefore,
  decodeHistoricalAdapters,
  missingRevisions,
  type AsOfScoring,
} from './as-of.ts'
import { rootKey } from './ontology.ts'
import { score, effectiveCost } from './scoring.ts'
import type { Adapter, Address, Evidence } from './types.ts'

/**
 * Unit tests for as-of scoring's decidable parts — the pieces that must be right without a
 * network, so that the live suite is checking the world rather than the arithmetic.
 *
 * The last block here is the acceptance test the mission asks for, in its deterministic form:
 * the same subject, the same credentials, two registry revisions, two different scores.
 */

const SUBJECT = '0x1111111111111111111111111111111111111111' as Address

function adapter(over: Partial<Adapter> & Pick<Adapter, 'id' | 'trustRoot'>): Adapter {
  return {
    name: over.id,
    evidenceClass: 'StateIdentity',
    forgeCostCents: 100_000,
    rentCostCents: 100_000,
    decayHalfLifeDays: 0,
    ageCurve: 'None',
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

// A 12-second chain starting at block 1000 / t=1_000_000, so ts(b) = 1_000_000 + 12*(b-1000).
const CHAIN_START_BLOCK = 1000
const CHAIN_START_TS = 1_000_000
const chainTimestamp = async (block: number) => CHAIN_START_TS + 12 * (block - CHAIN_START_BLOCK)

describe('resolving an instant to a block', () => {
  test('finds the last block at or before the instant', async () => {
    // t = 1_006_006 falls between block 1500 (1_006_000) and 1501 (1_006_012).
    const b = await blockAtOrBefore(1_006_006, CHAIN_START_BLOCK, 5000, chainTimestamp)
    assert.equal(b, 1500)
  })

  test('an instant that is exactly a block boundary picks that block, not the one before', async () => {
    const b = await blockAtOrBefore(1_006_000, CHAIN_START_BLOCK, 5000, chainTimestamp)
    assert.equal(b, 1500)
  })

  test('an instant after the head returns the head rather than searching past it', async () => {
    const b = await blockAtOrBefore(9_999_999, CHAIN_START_BLOCK, 5000, chainTimestamp)
    assert.equal(b, 5000)
  })

  test('an instant before the history starts is an error, not block zero', async () => {
    // Silently clamping to the first block would answer a question about a time the registry
    // did not exist, which is the one thing as-of scoring must never do.
    await assert.rejects(
      () => blockAtOrBefore(999_000, CHAIN_START_BLOCK, 5000, chainTimestamp),
      /before block 1000/,
    )
  })

  test('the search is logarithmic, so an instant can name a block without an archive node', async () => {
    let calls = 0
    const counted = async (b: number) => {
      calls++
      return chainTimestamp(b)
    }
    await blockAtOrBefore(1_006_006, CHAIN_START_BLOCK, 5_000_000, counted)
    assert.ok(calls < 60, `expected a bisection, got ${calls} header reads`)
  })
})

describe('audit-trail completeness', () => {
  test('contiguous revisions mean every mutation is recorded', () => {
    assert.deepEqual(missingRevisions([1, 2, 3, 4], 4), [])
  })

  test('a gap is exactly where a liveness flip the indexer dropped would sit', () => {
    // setAdapterLiveness bumps revision and emits only a hashed id, which the deployed mapping
    // does not store. So a missing revision is not a cosmetic hole — it is a `live` flag in the
    // reconstruction that may be wrong, and `live: false` zeroes a credential outright.
    assert.deepEqual(missingRevisions([1, 2, 4, 5], 5), [3])
  })

  test('the chain having a higher revision than anything recorded is also a gap', () => {
    assert.deepEqual(missingRevisions([1, 2, 3], 5), [4, 5])
  })
})

describe('decoding a historical adapter record', () => {
  const rows = [
    {
      id: 'civic-pass',
      name: 'Civic Pass',
      evidenceClass: 4,
      trustRoot: rootKey('kyc-vendor:persona'),
      forgeCostCents: '100000',
      rentCostCents: '3000',
      decayHalfLifeDays: 365,
      ageCurve: 1,
      live: false,
      sourceURI: 'research/x.md',
      revision: '15',
    },
  ]

  test('enums and numeric strings come back in the shape the scorer takes', () => {
    const m = decodeHistoricalAdapters(rows, new Map())
    const a = m.get('civic-pass')!
    assert.equal(a.evidenceClass, 'Liveness')
    assert.equal(a.ageCurve, 'Decay')
    assert.equal(a.forgeCostCents, 100_000)
    assert.equal(a.rentCostCents, 3_000)
    assert.equal(a.live, false)
  })

  test('a retired root name resolves, and an unknown hash stays a hash rather than collapsing', () => {
    const named = decodeHistoricalAdapters(
      rows,
      new Map([[rootKey('kyc-vendor:persona').toLowerCase(), 'kyc-vendor:persona']]),
    )
    assert.equal(named.get('civic-pass')!.trustRoot, 'kyc-vendor:persona')

    // Mapping an unrecognised hash to some placeholder would merge two distinct roots into
    // one and saturate credentials that were independent. The hash is a fine correlation key.
    const raw = decodeHistoricalAdapters(rows, new Map())
    assert.equal(raw.get('civic-pass')!.trustRoot, rootKey('kyc-vendor:persona'))
  })
})

describe('credentials at a past instant', () => {
  const a = adapter({ id: 'poh-v1', trustRoot: 'social-vouching:poh' })
  const AS_OF = 1_700_000_000

  test('a credential dated after the instant is excluded, not counted', () => {
    const r = applyAsOfToEvidence([ev(a, { issuedAt: AS_OF + 86_400 })], AS_OF)
    assert.deepEqual(r.issuedAfterAsOf, ['poh-v1'])
    assert.equal(r.evidence[0]!.held, false)
    assert.equal(r.evidence[0]!.effectiveCostCents, 0)
    assert.equal(r.evidence[0]!.detail?.excludedByAsOf, 'issued after the as-of instant')
  })

  test('a credential dated before the instant is kept untouched', () => {
    const before = ev(a, { issuedAt: AS_OF - 86_400 })
    const r = applyAsOfToEvidence([before], AS_OF)
    assert.deepEqual(r.issuedAfterAsOf, [])
    assert.equal(r.evidence[0], before, 'kept by reference — nothing to correct')
  })

  test('an issuedAfter bound past the instant excludes it too', () => {
    // issuedAfter is a proven lower bound on issuance, so a bound later than the as-of instant
    // proves the credential is younger than the question.
    const r = applyAsOfToEvidence([ev(a, { issuedAfter: AS_OF + 1 })], AS_OF)
    assert.deepEqual(r.issuedAfterAsOf, ['poh-v1'])
    assert.equal(r.evidence[0]!.held, false)
  })

  test('an undated credential is counted and named, not dropped', () => {
    // Dropping it would penalise a subject for a field their protocol does not store; counting
    // it silently would let a credential minted this morning support a score from last week.
    const r = applyAsOfToEvidence([ev(a)], AS_OF)
    assert.deepEqual(r.existenceUnverified, ['poh-v1'])
    assert.equal(r.evidence[0]!.held, true)
  })

  test('evidence that was never held is left alone', () => {
    const absent = ev(a, { held: false, effectiveCostCents: 0 })
    const r = applyAsOfToEvidence([absent], AS_OF)
    assert.deepEqual(r.issuedAfterAsOf, [])
    assert.deepEqual(r.existenceUnverified, [])
    assert.equal(r.evidence[0], absent)
  })
})

describe('the same subject, two registry revisions', () => {
  const AS_OF = 1_700_000_000
  const context: AsOfScoring = {
    block: 11_345_000,
    timestamp: AS_OF,
    registryRevision: 15,
    adapterCount: 15,
    indexedBlock: 11_348_000,
    auditTrailComplete: true,
    recordsLivenessChanges: true,
    adaptersNotYetInRegistry: [],
    issuedAfterAsOf: [],
    existenceUnverified: [],
  }

  /**
   * The real revision-15-to-34 correction, in miniature: Civic Pass sat on Persona's root, and
   * revision 34 moved it to FaceTec's — where Anima already sat. One edit to the ontology turns
   * two independent roots into one, and the subject's score falls without the subject changing.
   */
  const anima = adapter({ id: 'anima-pou', trustRoot: 'kyc-vendor:facetec', forgeCostCents: 5_000, rentCostCents: 5_000 })
  const civicThen = adapter({ id: 'civic-pass', trustRoot: 'kyc-vendor:persona', forgeCostCents: 5_000, rentCostCents: 5_000 })
  const civicNow = { ...civicThen, trustRoot: 'kyc-vendor:facetec' }

  const run = (adapters: Adapter[], asOf?: AsOfScoring) =>
    score({
      subjects: [SUBJECT],
      adapters: new Map(adapters.map((x) => [x.id, x])),
      evidence: adapters.map((x) => ev(x)),
      now: AS_OF,
      registryRevision: asOf?.registryRevision ?? 34,
      ...(asOf ? { asOf } : {}),
    })

  test('a trust-root correction changes the score for evidence that did not change', () => {
    const then = run([anima, civicThen], context)
    const now = run([anima, civicNow])

    assert.equal(then.independentRoots, 2, 'revision 15 read these as two separate vendors')
    assert.equal(now.independentRoots, 1, 'revision 34 knows both are FaceTec')
    assert.equal(then.totalCostCents, 10_000)
    assert.equal(now.totalCostCents, 5_000, 'saturated to one root once the correction landed')
    assert.ok(then.score > now.score, `${then.score} should exceed ${now.score}`)
    assert.equal(then.registryRevision, 15)
    assert.equal(now.registryRevision, 34)
  })

  test('the as-of result says which block it is about and what it cannot see', () => {
    const then = run([anima, civicThen], context)
    assert.equal(then.asOf?.block, 11_345_000)
    assert.equal(then.asOf?.registryRevision, 15)
    const c = then.caveats.find((x) => x.code === 'scored-as-of-past-block')
    assert.ok(c, 'an as-of score always says it is one')
    assert.match(c.message, /read from their chains at head/)
    assert.match(c.message, /understate the subject and never the adversary/)
  })

  test('a score computed for now carries no as-of claim at all', () => {
    const now = run([anima, civicNow])
    assert.equal(now.asOf, undefined)
    assert.ok(!now.caveats.some((c) => c.code === 'scored-as-of-past-block'))
  })

  test('an incomplete audit trail is reported rather than quietly trusted', () => {
    const r = run([anima, civicThen], {
      ...context,
      auditTrailComplete: false,
      missingRevisions: [7],
    })
    const c = r.caveats.find((x) => x.code === 'registry-audit-trail-incomplete')
    assert.ok(c)
    assert.match(c.message, /revisions 7/)
  })

  test('adapters that did not exist yet are named, so a lower score is explicable', () => {
    const r = run([anima], { ...context, adaptersNotYetInRegistry: ['holonym-gov-id', 'human-passport'] })
    const c = r.caveats.find((x) => x.code === 'adapter-not-in-registry-at-asof')
    assert.ok(c)
    assert.match(c.message, /holonym-gov-id, human-passport/)
    assert.match(c.message, /a change in what we knew, not in the subject/)
  })
})
