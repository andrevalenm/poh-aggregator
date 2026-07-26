/**
 * The World ID term timeline, without a network.
 *
 * `termChangesToHistory` is where every judgement about a sweep lives: which sweeps are complete
 * enough to believe, and how a change becomes an era boundary. It is separated from the I/O for
 * exactly this reason — the failure this module exists to catch is an endpoint that returns a
 * *plausible* subset with HTTP 200, and no test can ask a live endpoint to misbehave on demand.
 *
 * The end-to-end effect on a score is in `world.test.ts`; the live sweep and its era arithmetic
 * are asserted against the real chain in `world.live.test.ts`.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toEventSelector } from 'viem'
import {
  termChangesToHistory,
  VERIFICATION_LENGTH_UPDATED_TOPIC,
  WORLD_ADDRESS_BOOK_INITIALIZED_TOPIC,
  type TermChange,
} from './world-term.ts'
import { WORLD_ADDRESS_BOOK_DEPLOYED_AT, WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK } from './world.ts'

const TERM = 14_515_200
const DEPLOYED = WORLD_ADDRESS_BOOK_DEPLOYED_AT

/** The constructor's announcement, which is the only thing that opens the first era. */
const init = (seconds = TERM): TermChange => ({
  seconds,
  block: WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK,
  at: DEPLOYED,
  initial: true,
})

const change = (seconds: number, at: number, block = 20_000_000): TermChange => ({
  seconds,
  block,
  at,
  initial: false,
})

describe('a sweep becomes a timeline, or it is refused', () => {
  test('the constructor alone is one era running from the deployment to head', () => {
    const h = termChangesToHistory([init()], TERM)
    assert.deepEqual(h, { eras: [{ from: DEPLOYED, seconds: TERM }], observed: true })
  })

  test('a change splits the life in two, half-open at the second it was mined in', () => {
    const at = DEPLOYED + 40_000_000
    const h = termChangesToHistory([init(), change(TERM / 2, at, 21_000_000)], TERM / 2)
    assert.deepEqual(h!.eras, [
      { from: DEPLOYED, seconds: TERM, until: at },
      { from: at, seconds: TERM / 2, block: 21_000_000 },
    ])
    // Half-open, so the era boundary is the first second of the *new* term: an entry written in
    // that block was written under the new value, which is what the contract does.
    assert.equal(h!.eras[0]!.until, h!.eras[1]!.from)
  })

  test('every era carries a term, which is what this timeline has and PoH v2 does not', () => {
    const h = termChangesToHistory([init(), change(TERM / 2, DEPLOYED + 1000)], TERM / 2)
    assert.ok(h!.eras.every((e) => e.seconds !== undefined))
  })

  test('the sweep is sorted before it is read, so call order cannot become era order', () => {
    const at = DEPLOYED + 40_000_000
    const later = change(7_000_000, at + 1_000_000, 22_000_000)
    const earlier = change(TERM / 2, at, 21_000_000)
    const h = termChangesToHistory([later, init(), earlier], 7_000_000)
    assert.deepEqual(
      h!.eras.map((e) => e.seconds),
      [TERM, TERM / 2, 7_000_000],
    )
  })

  test('two changes in the same second collapse to the later write, as the chain does', () => {
    const at = DEPLOYED + 40_000_000
    const h = termChangesToHistory(
      [init(), change(TERM / 2, at, 21_000_000), change(9_000_000, at, 21_000_000)],
      9_000_000,
    )
    assert.deepEqual(h!.eras, [
      { from: DEPLOYED, seconds: TERM, until: at },
      { from: at, seconds: 9_000_000, block: 21_000_000 },
    ])
  })

  test('a sweep missing the constructor log is refused — the measured truncation', () => {
    // `worldchain-mainnet.gateway.tenderly.co` answers an over-wide range with HTTP 200 and a
    // silently incomplete subset, dropping the old end. That looks exactly like "no change has
    // ever been made", which is the permissive answer, so the constructor's log is required.
    assert.equal(termChangesToHistory([change(TERM, DEPLOYED + 1000)], TERM), undefined)
    assert.equal(termChangesToHistory([], TERM), undefined)
  })

  test('a constructor log from the wrong block is refused', () => {
    const wrong = { ...init(), block: WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK + 1 }
    assert.equal(termChangesToHistory([wrong], TERM), undefined)
  })

  test('a second constructor log is refused: the contract can only be deployed once', () => {
    assert.equal(termChangesToHistory([init(), { ...init(), at: DEPLOYED + 5 }], TERM), undefined)
  })

  test('a sweep whose newest term cannot explain head is refused, however real its logs', () => {
    // Something other than `setVerificationLength` wrote the field — a redeployment behind the
    // same address, or a change we did not see. The eras are then wrong even though every log in
    // them is genuine, and reporting them would date a whole registry from a broken timeline.
    assert.equal(termChangesToHistory([init(TERM)], TERM / 2), undefined)
    assert.equal(
      termChangesToHistory([init(), change(TERM / 2, DEPLOYED + 1000)], TERM),
      undefined,
    )
  })

  test('a term of zero at head is a call that did not answer, not a term', () => {
    assert.equal(termChangesToHistory([init()], 0), undefined)
  })
})

describe('the topics are the events, not magic strings', () => {
  test('they are the selectors of the signatures in the deployed source', () => {
    assert.equal(
      WORLD_ADDRESS_BOOK_INITIALIZED_TOPIC,
      toEventSelector('WorldIDAddressBookInitialized(address,uint256,uint256,uint256,uint256)'),
    )
    assert.equal(
      VERIFICATION_LENGTH_UPDATED_TOPIC,
      toEventSelector('VerificationLengthUpdated(uint256)'),
    )
  })
})
