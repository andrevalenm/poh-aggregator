/**
 * *Which* of this contract's terms wrote an expiry — the second premise behind every PoH v2 date.
 *
 * `expirationTime - humanityLifespan()` is exact when this contract wrote the expiry (that is the
 * premise `poh-term.ts` checks with the grant sweep), and it is *still* only exact if the value at
 * head is the value that was in force at the write. `humanityLifespan` is governance-settable:
 * `changeDurations` writes it and nothing else does after `initialize`. A change would leave every
 * stored expiry alone and shift every date derived from one, by the size of the change, for every
 * subject at once, silently.
 *
 * The contract publishes the change — `DurationsChanged` — so the timeline is readable, and both
 * live instances have emitted **zero** of them (Gnosis 35,846,827 → 47,391,312; mainnet 20,685,061
 * → 25,613,069, 2026-07-26). That is the case that has to keep behaving identically, and it is the
 * first test here. The rest are the cases a single governance transaction would create, which no
 * live fixture can produce and which therefore have to be built by hand.
 *
 * PoH **v1** is why none of this is hypothetical: `submissionDuration` there has already moved,
 * from 31,557,600 to 63,115,200, and v1's `changeDurations` (line 563 of the verified source)
 * emits nothing at all.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  assumedTermHistory,
  readTermHistory,
  termForLocalExpiry,
  type TermHistory,
} from './poh-term.ts'
import { dateHumanityFromTerm, closeLapsedHumanityWindow, POH_V2_DEPLOYED_AT } from './index.ts'
import type { PublicClient } from 'viem'
import type { Address } from '../types.ts'

const NOW = 1_785_019_230
const YEAR = 31_557_600
const TWO_YEARS = 63_115_200

/** The one-era world: what the sweep returns today, and what it means. */
const PROVED: TermHistory = { eras: [{ from: POH_V2_DEPLOYED_AT, seconds: YEAR }], observed: true }

/** 2025-09-01T00:00:00Z — a plausible instant for a governance transaction to land on. */
const CHANGED_AT = 1_756_684_800
/** 2026-03-01T00:00:00Z — a second one, so a middle era exists with a term of its own. */
const CHANGED_AGAIN = 1_772_323_200

/**
 * Three eras, the shape a real sweep of two changes would build: the first era's term is absent
 * because `initialize` never emitted it, and the last era's term is the one at head.
 */
const THREE_ERAS: TermHistory = {
  observed: true,
  eras: [
    { from: POH_V2_DEPLOYED_AT, until: CHANGED_AT },
    { from: CHANGED_AT, until: CHANGED_AGAIN, seconds: TWO_YEARS, block: 40_000_000 },
    { from: CHANGED_AGAIN, seconds: YEAR, block: 44_000_000 },
  ],
}

/**
 * Two eras and one expiry both of them explain. A term shortened by two days is enough: the old
 * term dates the claim to the day before the change, the new term to the day after, and each lands
 * inside the era whose term it is.
 */
const TWO_FITTING_ERAS: TermHistory = {
  observed: true,
  eras: [
    { from: POH_V2_DEPLOYED_AT, until: CHANGED_AT, seconds: YEAR },
    { from: CHANGED_AT, seconds: YEAR - 2 * 86_400, block: 40_000_000 },
  ],
}
const AMBIGUOUS_EXPIRY = CHANGED_AT - 86_400 + YEAR

describe('PoH v2 — which term wrote this expiry', () => {
  test('one era, and the answer is the one the probe has always given', () => {
    // The live state. A claim mined a year before `now` under the only term the contract has ever
    // had: the era check reduces to the deployment floor the probe applied before any of this.
    const claimedAt = NOW - YEAR
    const r = termForLocalExpiry(PROVED, claimedAt + YEAR, NOW)
    assert.equal(r.kind, 'settled')
    assert.equal(r.kind === 'settled' ? r.term : 0, YEAR)
  })

  test('each era’s expiries are dated with that era’s term, not with head’s', () => {
    // The defect this exists to prevent, stated as an assertion. A humanity claimed while the
    // two-year term was in force expires two years later; subtracting head's one-year term would
    // report it as claimed a year after it was, and the derived date would land in an era where
    // that term was not the term.
    const claimedAt = CHANGED_AT + 30 * 86_400
    const expiry = claimedAt + TWO_YEARS
    const r = termForLocalExpiry(THREE_ERAS, expiry, NOW)
    assert.equal(r.kind === 'settled' ? r.term : 0, TWO_YEARS)
    assert.equal(expiry - TWO_YEARS, claimedAt)
    assert.notEqual(expiry - YEAR, claimedAt, 'head’s term would have put the claim a year late')
  })

  test('a claim under the current term is still placed in the current era', () => {
    const claimedAt = CHANGED_AGAIN + 10 * 86_400
    const r = termForLocalExpiry(THREE_ERAS, claimedAt + YEAR, NOW)
    assert.equal(r.kind === 'settled' ? r.term : 0, YEAR)
  })

  test('an expiry only the unpublished first era explains is left undated', () => {
    // `initialize` sets `humanityLifespan` without emitting anything, so the term that ran from
    // the deployment to the first change is not on chain in any form. Any expiry can be explained
    // by *some* term in that era, which is exactly why none of them may be.
    const r = termForLocalExpiry(THREE_ERAS, CHANGED_AT - 86_400 + 12_000_000, NOW)
    assert.equal(r.kind, 'era-unknown')
  })

  test('two eras that both explain it settle nothing', () => {
    // Contrived on purpose, and reachable: a term shortened by two days makes one expiry solvable
    // as "claimed a day before the change under the old term" and as "claimed a day after it under
    // the new one". Nothing in the record prefers either, so there is no date — only a choice.
    const expiry = AMBIGUOUS_EXPIRY
    const r = termForLocalExpiry(TWO_FITTING_ERAS, expiry, NOW)
    assert.equal(r.kind, 'ambiguous')
    assert.deepEqual(r.kind === 'ambiguous' ? [...r.terms].sort((a, b) => a - b) : [], [
      YEAR - 2 * 86_400,
      YEAR,
    ])
    assert.equal(expiry - YEAR, CHANGED_AT - 86_400, 'the old term puts the claim just before the change')
    assert.equal(
      expiry - (YEAR - 2 * 86_400),
      CHANGED_AT + 86_400,
      'and the new one puts it just after — both inside the era whose term they are',
    )
  })

  test('no era can put the write in the future, including the era still running', () => {
    // A local write is `block.timestamp + humanityLifespan` for a block at or before the one we
    // read at, so an expiry more than a full term out is not one this contract wrote.
    assert.equal(termForLocalExpiry(PROVED, NOW + YEAR + 1, NOW).kind, 'no-era')
    assert.equal(termForLocalExpiry(PROVED, NOW + YEAR, NOW).kind, 'settled')
  })

  test('nor before the contract existed', () => {
    assert.equal(termForLocalExpiry(PROVED, POH_V2_DEPLOYED_AT + YEAR - 1, NOW).kind, 'no-era')
    assert.equal(termForLocalExpiry(PROVED, POH_V2_DEPLOYED_AT + YEAR, NOW).kind, 'settled')
  })
})

describe('PoH v2 — the sweep that builds the timeline', () => {
  /**
   * A node that answers with a fixed set of `DurationsChanged` logs. Block timestamps are derived
   * from the block number so the arithmetic in the assertions is checkable by eye.
   */
  const stub = (logs: { seconds: number; block: bigint }[], opts: { refuseFullRange?: boolean } = {}) => {
    const calls: { fromBlock: bigint; toBlock: bigint }[] = []
    const client = {
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        calls.push({ fromBlock, toBlock })
        if (opts.refuseFullRange && calls.length === 1) throw new Error('query returned more than 10000 results')
        return logs
          .filter((l) => l.block >= fromBlock && l.block <= toBlock)
          .map((l) => ({ args: { humanityLifespan: BigInt(l.seconds) }, blockNumber: l.block }))
      },
      getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
        timestamp: BigInt(POH_V2_DEPLOYED_AT + Number(blockNumber - 35_846_827n) * 5),
      }),
    }
    return { client: client as unknown as PublicClient, calls }
  }

  const OPTS = { deployBlock: 35_846_827n, deployedAt: POH_V2_DEPLOYED_AT, lifespanAtHead: YEAR }

  test('no change ever emitted is a proof, not an assumption', async () => {
    const { client } = stub([])
    const h = await readTermHistory(client, 47_391_312n, '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc', OPTS)
    assert.deepEqual(h, { eras: [{ from: POH_V2_DEPLOYED_AT, seconds: YEAR }], observed: true })
  })

  test('a change becomes a boundary at the second its block was mined', async () => {
    const { client } = stub([
      { seconds: TWO_YEARS, block: 40_000_000n },
      { seconds: YEAR, block: 44_000_000n },
    ])
    const h = await readTermHistory(client, 47_391_312n, '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc', OPTS)
    assert.ok(h)
    assert.equal(h.observed, true)
    assert.equal(h.eras.length, 3)
    assert.equal(h.eras[0]!.seconds, undefined, 'initialize published nothing, so era 0 has no term')
    assert.equal(h.eras[0]!.until, h.eras[1]!.from)
    assert.equal(h.eras[1]!.seconds, TWO_YEARS)
    assert.equal(h.eras[1]!.until, h.eras[2]!.from)
    assert.equal(h.eras[2]!.seconds, YEAR, 'the running era is the value at head')
    assert.equal(h.eras[2]!.until, undefined)
  })

  test('a sweep whose newest value cannot explain head has not answered', async () => {
    // The field was written by something that is not `changeDurations` — a proxy upgrade
    // re-running an initializer, say. The logs are real and the timeline they build is wrong, so
    // the honest report is the same as an unreachable node's.
    const { client } = stub([{ seconds: TWO_YEARS, block: 40_000_000n }])
    assert.equal(
      await readTermHistory(client, 47_391_312n, '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc', OPTS),
      undefined,
    )
  })

  test('a node that refuses the whole range is swept in chunks', async () => {
    const { client, calls } = stub([{ seconds: YEAR, block: 40_000_000n }], { refuseFullRange: true })
    const h = await readTermHistory(client, 47_391_312n, '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc', OPTS)
    assert.ok(h)
    assert.equal(h.eras.length, 2)
    assert.ok(calls.length > 2, 'the refusal is retried as a chunked sweep, not given up on')
    assert.equal(calls[1]!.fromBlock, 35_846_827n, 'and the chunks start at the deployment')
  })
})

describe('PoH v2 — what the timeline does to a date', () => {
  const date = (over: Partial<Parameters<typeof dateHumanityFromTerm>[0]>) =>
    dateHumanityFromTerm({
      expirationTime: NOW - 86_400 + YEAR,
      lifespan: YEAR,
      now: NOW,
      term: { kind: 'local' },
      ...over,
    })

  test('a proved timeline dates exactly as the bare subtraction did, and says nothing extra', () => {
    const bare = date({})
    const proved = date({ history: PROVED })
    assert.equal(proved.issuedAt, bare.issuedAt)
    assert.equal(proved.note, undefined, 'a checked premise is not a caveat')
    assert.equal(proved.detail.termAtClaim, undefined, 'the term at claim is head’s, so it is not news')
  })

  test('a sweep that did not answer keeps the date and names the assumption it stands on', () => {
    // Same shape as the grant sweep failing, and the same note, because the consequence is the
    // same: the date is the one we would have given anyway, resting on a check that did not run.
    const r = date({ history: assumedTermHistory(YEAR, POH_V2_DEPLOYED_AT) })
    assert.equal(r.issuedAt, NOW - 86_400)
    assert.equal(r.note, 'term-origin-unverified')
  })

  test('a caller who supplied no timeline at all is not told a check failed', () => {
    // Nobody asked, so nothing was skipped. `dateHumanityFromTerm` stays callable with no network
    // and behaves as it did before the sweep existed.
    assert.equal(date({}).note, undefined)
  })

  test('the era’s term is subtracted, and the difference from head’s is reported', () => {
    const claimedAt = CHANGED_AT + 30 * 86_400
    const r = date({ expirationTime: claimedAt + TWO_YEARS, history: THREE_ERAS })
    assert.equal(r.issuedAt, claimedAt)
    assert.equal(r.detail.termAtClaim, TWO_YEARS)
    assert.equal(r.detail.claimedAt, claimedAt)
  })

  test('an expiry no published term explains costs the start and keeps the end', () => {
    const expiry = CHANGED_AT - 86_400 + 12_000_000
    const r = closeLapsedHumanityWindow({
      subject: '0xCE0D183b410a53144ef3FC60931911d5AE9f00E6' as Address,
      humanityId: '0xce0d183b410a53144ef3fc60931911d5ae9f00e6',
      owner: '0xCE0D183b410a53144ef3FC60931911d5AE9f00E6' as Address,
      expirationTime: expiry,
      nbRequests: 1,
      lifespan: YEAR,
      now: NOW,
      term: { kind: 'local' },
      history: THREE_ERAS,
    })
    assert.equal(r.heldUntil, expiry, 'the end is read, not derived, so it survives')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail.termEraUnpublished, true)
    assert.equal(r.detail.dateRejected, undefined, 'this is not a rejected date; it is an absent one')
  })

  test('two candidate terms produce no date and say which two', () => {
    const r = date({ expirationTime: AMBIGUOUS_EXPIRY, history: TWO_FITTING_ERAS })
    assert.equal(r.issuedAt, undefined)
    assert.deepEqual((r.detail.termAmbiguous as number[]).sort((a, b) => a - b), [
      YEAR - 2 * 86_400,
      YEAR,
    ])
  })
})
