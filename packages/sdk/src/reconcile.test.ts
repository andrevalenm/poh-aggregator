import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileIndexAndChain, type ChainView, type IndexView } from './reconcile.ts'
import { score, effectiveCost, freshnessOf } from './scoring.ts'
import type { Adapter, Address, Evidence } from './types.ts'

/**
 * The torn read, as a decision table.
 *
 * Every branch here was reachable in the old probe order and most of them silently produced a
 * different score than the truth. The tests are deliberately about *which source answered*
 * rather than about numbers: the property we need is that no combination of index lag and
 * chain state can move a score without saying so in the result.
 */

const NOW = 1_800_000_000
const HOUR = 3600
const DAY = 86_400

/**
 * A synced index: 10 minutes behind head, which is where ours actually sits.
 *
 * `observesEveryEnding: true` is the Circles-shaped index — one whose credential class has no
 * ending it could miss. It is the default here because most of these tests are about dates and
 * absence, where it does not participate; the PoH-shaped index that cannot see an ending gets
 * its own tests below, and it is the one our own deployment actually is.
 */
function syncedIndex(over: Partial<IndexView> = {}): IndexView {
  return {
    block: 47_000_000,
    blockTimestamp: NOW - 600,
    entity: null,
    completeHistory: true,
    observesEveryEnding: true,
    ...over,
  }
}

const chain = (over: Partial<ChainView> = {}): ChainView => ({ held: true, block: 47_000_100, ...over })

describe('reconciling an index against a chain head', () => {
  test('index and chain agree: the exact date is used and nothing is flagged', () => {
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, NOW - 700 * DAY)
    assert.equal(r.provenance.dateFrom, 'index')
    assert.equal(r.provenance.indexedBlock, 47_000_000)
    assert.deepEqual(r.provenance.notes, [])
  })

  test('the contract can date a credential itself, and then index lag is irrelevant', () => {
    const onChainDate = NOW - 400 * DAY
    const withStaleIndex = reconcileIndexAndChain({
      chain: chain({ issuedAt: onChainDate }),
      index: syncedIndex({ block: 40_000_000, blockTimestamp: NOW - 300 * DAY }),
    })
    const withNoIndex = reconcileIndexAndChain({ chain: chain({ issuedAt: onChainDate }) })

    assert.equal(withStaleIndex.issuedAt, onChainDate)
    assert.equal(withNoIndex.issuedAt, onChainDate)
    assert.equal(withStaleIndex.provenance.dateFrom, 'chain')
    // A one-year-stale index would once have decided this score. Now it cannot.
    assert.deepEqual(withStaleIndex.provenance.notes, [])
  })

  test('a date the index disagrees with is reported, not averaged', () => {
    const r = reconcileIndexAndChain({
      chain: chain({ issuedAt: NOW - 400 * DAY }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 402 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.issuedAt, NOW - 400 * DAY, 'the chain wins: it needs no indexer')
    assert.ok(r.provenance.notes.includes('index-date-disagrees-with-chain'))
  })

  test('sub-hour differences are block-time jitter, not disagreement', () => {
    const r = reconcileIndexAndChain({
      chain: chain({ issuedAt: NOW - 400 * DAY }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 400 * DAY - HOUR / 2, issuanceObserved: true, ended: false },
      }),
    })
    assert.deepEqual(r.provenance.notes, [])
  })

  test('held on chain, absent from a complete index: the age is bounded, not unknown', () => {
    const r = reconcileIndexAndChain({ chain: chain(), index: syncedIndex() })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.issuedAfter, NOW - 600, 'issued after the block the index had reached')
    assert.equal(r.provenance.dateFrom, 'index-absence-bound')
    assert.ok(r.provenance.notes.includes('credential-not-yet-indexed'))
  })

  test('a windowed index proves nothing by absence, and says so', () => {
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({ completeHistory: false }),
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAfter, undefined, 'no bound: the credential may predate the window')
    assert.equal(r.provenance.dateFrom, 'none')
    assert.ok(r.provenance.notes.includes('index-outside-coverage'))
  })

  test('a side-event that cannot precede issuance is flagged as a lower bound on age', () => {
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        completeHistory: false,
        entity: {
          issuedAt: NOW - 30 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'after-issuance',
          ended: false,
        },
      }),
    })
    assert.equal(r.issuedAt, NOW - 30 * DAY, 'kept: it understates age, so it cannot inflate')
    assert.ok(r.provenance.notes.includes('index-date-is-lower-bound'))
  })

  test('a side-event that precedes issuance bounds the age instead of dating the credential', () => {
    // A PoH vouch is cast on a request that has not resolved, so its timestamp sits *below* the
    // claim. Using it as the date would credit the subject with age they have not accrued.
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        entity: {
          issuedAt: NOW - 900 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'before-issuance',
          ended: false,
        },
      }),
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined, 'the index cannot date this credential')
    assert.equal(r.issuedAfter, NOW - 900 * DAY, 'it bounds it: issuance came after the vouch')
    assert.equal(r.provenance.dateFrom, 'index-side-event-bound')
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
  })

  test('an unplaced side-event date takes the reading that cannot inflate a score', () => {
    // No sideEventOrder means nobody established the direction. The default is the safe one, and
    // it is the reverse of the old behaviour, which assumed every side-event followed issuance.
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        entity: { issuedAt: NOW - 900 * DAY, issuanceObserved: false, ended: false },
      }),
    })
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.issuedAfter, NOW - 900 * DAY)
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
  })

  test('a vouch-dated entity contradicting a chain date is named for what it is', () => {
    // PoH is dated from the contract, so the index is only a cross-check here — but a
    // disagreement caused by a vouch timestamp is not a fault in our indexing, and calling it
    // one would send whoever reads the caveat looking for a bug that is not there.
    const r = reconcileIndexAndChain({
      chain: chain({ issuedAt: NOW - 100 * DAY }),
      index: syncedIndex({
        entity: {
          issuedAt: NOW - 900 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'before-issuance',
          ended: false,
        },
      }),
    })
    assert.equal(r.issuedAt, NOW - 100 * DAY, 'the contract dates it and needs no index')
    assert.equal(r.provenance.dateFrom, 'chain')
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
    assert.ok(!r.provenance.notes.includes('index-date-disagrees-with-chain'))
  })

  test('with the chain unreachable, a vouch-dated entity still only bounds the age', () => {
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        entity: {
          issuedAt: NOW - 900 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'before-issuance',
          ended: false,
        },
      }),
    })
    assert.equal(r.held, true, 'the index is all we have, and it has the credential')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.issuedAfter, NOW - 900 * DAY)
    assert.ok(r.provenance.notes.includes('freshness-check-unavailable'))
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
  })

  test('gone at head but live in the index: the chain wins and the divergence is reported', () => {
    const r = reconcileIndexAndChain({
      chain: chain({ held: false }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, false, 'a revocation must not stay invisible for as long as the index lags')
    assert.ok(r.provenance.notes.includes('credential-ceased-since-index'))
  })

  test('revoked in the index and absent from the chain is simple agreement', () => {
    const r = reconcileIndexAndChain({
      chain: chain({ held: false }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: true },
      }),
    })
    assert.equal(r.held, false)
    assert.deepEqual(r.provenance.notes, [])
  })

  test('absent from both is a clean negative with no flags', () => {
    const r = reconcileIndexAndChain({ chain: chain({ held: false }), index: syncedIndex() })
    assert.equal(r.held, false)
    assert.deepEqual(r.provenance.notes, [])
  })

  test('no index configured: contract only, exactly as before, and flagged as such', () => {
    const r = reconcileIndexAndChain({ chain: chain() })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.ok(r.provenance.notes.includes('index-unavailable'))
  })

  test('a failed freshness check falls back to the index and says nothing confirms it', () => {
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, true, 'the index saw it; the chain read simply failed')
    assert.equal(r.issuedAt, NOW - 700 * DAY)
    assert.equal(r.error, undefined)
    assert.ok(r.provenance.notes.includes('freshness-check-unavailable'))
  })

  test('a credential the chain dates the end of comes back as a closed window', () => {
    // The chain says it is gone; the chain also says when it went. `held` is unmoved — nothing
    // here weighs a dead credential — and the two dates travel together so an as-of instant
    // inside them can be decided. `date-from-lapsed-verification` says the date is about a
    // window and not about today.
    const r = reconcileIndexAndChain({
      chain: chain({ held: false, issuedAt: NOW - 400 * DAY, heldUntil: NOW - 35 * DAY }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 400 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, NOW - 400 * DAY)
    assert.equal(r.heldUntil, NOW - 35 * DAY)
    assert.equal(r.provenance.dateFrom, 'chain')
    assert.ok(r.provenance.notes.includes('date-from-lapsed-verification'))
    // The index still lists it, which is a different fact and is still reported.
    assert.ok(r.provenance.notes.includes('credential-ceased-since-index'))
  })

  test('an ending with no start is named rather than closed over', () => {
    const r = reconcileIndexAndChain({ chain: chain({ held: false, heldUntil: NOW - 35 * DAY }) })
    assert.equal(r.heldUntil, NOW - 35 * DAY)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance.dateFrom, 'none')
    assert.ok(r.provenance.notes.includes('lapsed-credential-start-undated'))
  })

  test('an ordinary negative is still an ordinary negative', () => {
    // The safety property: only a probe that read an ending sets one. Absence, silence and a
    // subject who never held anything all reach this branch and none of them acquires a window.
    const r = reconcileIndexAndChain({ chain: chain({ held: false }), index: syncedIndex() })
    assert.equal(r.held, false)
    assert.equal(r.heldUntil, undefined)
    assert.equal(r.issuedAt, undefined)
  })

  test('a failed chain read never produces a window, however the index answered', () => {
    // `heldUntil` is a statement the chain makes. When the chain did not answer there is no
    // such statement, and the index's own `ended` flag is not one — it carries no date.
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true, heldUntil: NOW - 35 * DAY },
      index: syncedIndex({
        entity: { issuedAt: NOW - 400 * DAY, issuanceObserved: true, ended: true },
      }),
    })
    assert.equal(r.heldUntil, undefined)
  })

  test('an index blind to endings may not carry a credential through a failed chain read', () => {
    // The PoH shape, and a live one: 33 humanities have left Gnosis by cross-chain discharge,
    // 25 of them since 2026-05, and our mapping handles no such event. The index holds them
    // with `ended: false` and expiries running into 2027, so on the old code a failed Gnosis
    // read counted a credential the subject transferred away weeks ago — at full weight, with
    // a real claim date. It is now excluded as unreadable.
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, false)
    assert.ok(r.error, 'unreadable, not absent: a failed read is never a claim about a person')
    assert.equal(r.issuedAt, undefined, 'nothing to date — the credential is not counted at all')
    assert.ok(r.provenance.notes.includes('index-cannot-see-endings'))
    assert.ok(r.provenance.notes.includes('freshness-check-unavailable'))
  })

  test('the same rule applies to an ending the index *did* see, because it can be stale too', () => {
    // Symmetry is the point. An index that misses endings misses re-creations as well — a
    // revoked humanity can be granted again from another chain without our mapping hearing —
    // so its `ended` flag is no more checkable than its silence. Excluded either way, and the
    // note says which question could not be answered rather than implying an answer.
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: true },
      }),
    })
    assert.equal(r.held, false)
    assert.ok(r.error)
    assert.ok(r.provenance.notes.includes('index-cannot-see-endings'))
  })

  test('an index that observes every ending still answers alone, which is the whole point', () => {
    // Circles: `isHuman` is `lastMintTime > 0` and nothing ever writes it back down, so there
    // is no ending to miss and the index's word survives a failed chain read. The rule has to
    // discriminate, or it is just a switch that turns the index off.
    const r = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        observesEveryEnding: true,
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(r.held, true)
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, NOW - 700 * DAY)
    assert.ok(!r.provenance.notes.includes('index-cannot-see-endings'))
  })

  test('a blind index is untouched while the chain answers', () => {
    // The flag is about who may speak when nothing can check them. At head the chain decides
    // `held` and the index is a date and a cross-check, exactly as before — a protocol whose
    // endings we cannot index must not lose its ordinary scoring path.
    const held = reconcileIndexAndChain({
      chain: chain({ issuedAt: NOW - 400 * DAY }),
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 400 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(held.held, true)
    assert.equal(held.issuedAt, NOW - 400 * DAY)
    assert.deepEqual(held.provenance.notes, [])

    const gone = reconcileIndexAndChain({
      chain: chain({ held: false }),
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 400 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    assert.equal(gone.held, false)
    assert.ok(gone.provenance.notes.includes('credential-ceased-since-index'))
    assert.ok(!gone.provenance.notes.includes('index-cannot-see-endings'))
  })

  test('both sources failing is an error, never a negative', () => {
    const noIndex = reconcileIndexAndChain({ chain: { held: false, unavailable: true } })
    assert.equal(noIndex.held, false)
    assert.ok(noIndex.error, 'a failed probe must not read as "not a human"')

    const emptyIndex = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex(),
    })
    assert.ok(emptyIndex.error, 'index silence is not a negative when nothing confirmed it')
  })
})

// --------------------------------------------------------------- the scoring consequence

const pohLike: Adapter = {
  id: 'poh-v2',
  name: 'Proof of Humanity v2',
  evidenceClass: 'SocialTrust',
  trustRoot: 'social-vouching:poh',
  forgeCostCents: 1000,
  rentCostCents: 500,
  decayHalfLifeDays: 365,
  ageCurve: 'Ramp',
  live: true,
  sourceURI: 'research/protocols/proof-of-humanity.md',
}

function evidenceFor(r: ReturnType<typeof reconcileIndexAndChain>, adapter = pohLike): Evidence {
  const freshness = freshnessOf(adapter, r.issuedAt, NOW, r.issuedAfter)
  return {
    adapterId: adapter.id,
    adapterName: adapter.name,
    evidenceClass: adapter.evidenceClass,
    trustRoot: adapter.trustRoot,
    observedOn: '0x1111111111111111111111111111111111111111' as Address,
    held: r.held,
    ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
    ...(r.issuedAfter !== undefined ? { issuedAfter: r.issuedAfter } : {}),
    provenance: r.provenance,
    freshness,
    effectiveCostCents: r.held ? effectiveCost(adapter, freshness) : 0,
    forgeCostCents: adapter.forgeCostCents,
    rentCostCents: adapter.rentCostCents,
    live: adapter.live,
    sourceURI: adapter.sourceURI,
  }
}

const scoreOf = (e: Evidence) =>
  score({
    subjects: ['0x1111111111111111111111111111111111111111' as Address],
    adapters: new Map([[pohLike.id, pohLike]]),
    evidence: [e],
    now: NOW,
  })

describe('subgraph lag can no longer move a score in silence', () => {
  /**
   * The acceptance test for the inversion.
   *
   * A real, week-old registration that the index has not reached yet used to be scored as if
   * its age were unknown, which on a Ramp curve means the 0.5 midpoint — twenty-three times
   * the weight the ramp gives a week-old credential. So an attacker who could slow our index
   * bought weight for a fresh credential, and an honest subject's score depended on our
   * infrastructure. Now the same subject is either dated correctly or flagged.
   */
  test('a credential that is real but not yet indexed is priced as new, and flagged', () => {
    const r = reconcileIndexAndChain({ chain: chain(), index: syncedIndex() })
    const result = scoreOf(evidenceFor(r))
    const poh = result.evidence[0]!

    // Bounded, not unknown: absent from the index 10 minutes ago means at most 10 minutes old.
    assert.ok(poh.freshness < 0.001, `priced as brand new, got ${poh.freshness}`)
    assert.notEqual(poh.freshness, 0.5, 'never the unknown-age midpoint')
    assert.ok(
      result.caveats.some((c) => c.code === 'credential-not-yet-indexed'),
      'and the result says which block the index had reached',
    )
    assert.ok(
      result.caveats.some((c) => c.message.includes('47000000')),
      'the block is in the caveat, so a subject can check it',
    )
    assert.ok(
      !result.caveats.some((c) => c.code === 'issuance-date-unknown'),
      'the age is bounded, so claiming it is unknown would be false',
    )
  })

  test('the age bound is a cap, so making the index lag is never worth anything', () => {
    // Lag from 10 minutes to 3 years. The bound loosens as the index falls behind, but the cap
    // is min(bound, unknown-age midpoint), so the weight never rises above what an unreachable
    // index would have produced anyway.
    let previous = 0
    for (const lagDays of [0.007, 1, 30, 180, 365, 1095]) {
      const r = reconcileIndexAndChain({
        chain: chain(),
        index: syncedIndex({ blockTimestamp: NOW - lagDays * DAY }),
      })
      const f = freshnessOf(pohLike, r.issuedAt, NOW, r.issuedAfter)
      assert.ok(f <= 0.5, `lag of ${lagDays}d yielded ${f}, above the unknown-age midpoint`)
      assert.ok(f >= previous, 'monotone in lag, so there is no lag sweet spot to hunt for')
      previous = f
    }
  })

  test('a coverage gap keeps the old behaviour and names itself', () => {
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({ completeHistory: false }),
    })
    const result = scoreOf(evidenceFor(r))

    assert.equal(result.evidence[0]!.freshness, 0.5, 'unchanged: the midpoint, as before')
    assert.ok(result.caveats.some((c) => c.code === 'index-coverage-partial'))
    assert.ok(result.caveats.some((c) => c.code === 'issuance-date-unknown'))
  })

  test('a credential the chain has retired scores zero even while the index still lists it', () => {
    const r = reconcileIndexAndChain({
      chain: chain({ held: false }),
      index: syncedIndex({
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    const result = scoreOf(evidenceFor(r))
    assert.equal(result.totalCostCents, 0)
    assert.ok(result.caveats.some((c) => c.code === 'credential-ceased-since-index'))
  })

  test('an index date inferred from a side-event is scored as a floor and labelled one', () => {
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        completeHistory: false,
        entity: {
          issuedAt: NOW - 30 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'after-issuance',
          ended: false,
        },
      }),
    })
    const result = scoreOf(evidenceFor(r))
    const expected = 1 - 2 ** (-30 / 365)
    assert.ok(Math.abs(result.evidence[0]!.freshness - expected) < 1e-9)
    assert.ok(result.caveats.some((c) => c.code === 'issuance-date-lower-bound'))
  })

  test('a side-event below issuance cannot buy more than the unknown-age midpoint', () => {
    // This is the size of the fix. A vouch three years old, read as the issuance date, prices a
    // 365-day-half-life ramp at 0.875 — a credential that may have been claimed yesterday. Read
    // as the bound it is, the same evidence is capped at the 0.5 an undated credential gets, and
    // the result says the date is a bound rather than reporting one it does not have.
    const asDate = freshnessOf(pohLike, NOW - 3 * 365 * DAY, NOW)
    const r = reconcileIndexAndChain({
      chain: chain(),
      index: syncedIndex({
        entity: {
          issuedAt: NOW - 3 * 365 * DAY,
          issuanceObserved: false,
          sideEventOrder: 'before-issuance',
          ended: false,
        },
      }),
    })
    const result = scoreOf(evidenceFor(r))
    assert.ok(Math.abs(asDate - 0.875) < 1e-9, `the old reading was ${asDate}`)
    assert.equal(result.evidence[0]!.freshness, 0.5, 'capped at the unknown-age midpoint')
    assert.ok(result.caveats.some((c) => c.code === 'index-date-precedes-issuance'))
    assert.ok(
      !result.caveats.some((c) => c.code === 'issuance-date-unknown'),
      'the age is bounded, not unknown — claiming otherwise would be false',
    )
  })
})

describe('the scoring consequence of an index that cannot see an ending', () => {
  test('a departed credential is worth nothing and the caveat says why', () => {
    // Same subject, same index answer, one difference: whether the chain could be reached.
    // Before this rule the two disagreed by the whole weight of the credential, and which one
    // a subject got was decided by our own RPC.
    const departed = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })
    const readable = reconcileIndexAndChain({
      chain: chain({ held: false }),
      index: syncedIndex({
        observesEveryEnding: false,
        entity: { issuedAt: NOW - 700 * DAY, issuanceObserved: true, ended: false },
      }),
    })

    const blind = scoreOf(evidenceFor(departed))
    const seeing = scoreOf(evidenceFor(readable))
    assert.equal(blind.totalCostCents, 0)
    assert.equal(seeing.totalCostCents, 0, 'the chain says gone, and now so does the failed read')
    assert.equal(blind.evidence[0]!.held, false)
    assert.ok(blind.caveats.some((c) => c.code === 'index-cannot-see-endings'))
  })

  test('the old behaviour, priced: this is what the rule stops paying out', () => {
    // The credential the index still lists is 700 days old on a 365-day ramp, so reading it as
    // held hands the subject 0.75 of a root's full weight for a humanity that left the chain.
    const asHeld = freshnessOf(pohLike, NOW - 700 * DAY, NOW)
    assert.ok(Math.abs(asHeld - (1 - 2 ** (-700 / 365))) < 1e-9)
    assert.ok(effectiveCost(pohLike, asHeld) > 0, 'it was real weight, not a rounding error')
  })
})
