/**
 * Human Passport — the decision that puts a lapsed passport back into a historical score.
 *
 * `closeLapsedPassportWindow` is the only part of this adapter that can hand a subject time they
 * did not have, so it is the part worth exercising without a network. Everything it refuses is a
 * way for an expiry to be mistaken for a life: a passport that carried no stamps, one that has
 * not actually expired, a struct describing a credential that never counted for a second.
 *
 * Run: node --test --experimental-strip-types src/adapters/human-passport.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { closeLapsedPassportWindow, type ChainReading, type PassportChain } from './human-passport.ts'

const NOW = 1_785_000_000
const DAY = 86_400
/** Passport stores four implied decimals; 500_150 is 50.015. */
const SCORE = 500_150

function reading(over: Partial<ChainReading> = {}): ChainReading {
  const time = over.time ?? NOW - 200 * DAY
  const expiresAt = over.expiresAt ?? time + 90 * DAY
  return {
    chain: 'optimism',
    score: SCORE,
    time,
    expirationTime: 0,
    expiresAt,
    expired: NOW >= expiresAt,
    meetsOwnThreshold: true,
    ...over,
  }
}

describe('closing the window on a lapsed passport', () => {
  test('an expired passport gives up both ends of its life, from the struct the resolver kept', () => {
    const r = reading({ time: NOW - 200 * DAY })
    const w = closeLapsedPassportWindow([r], NOW)
    assert.equal(w.issuedAt, r.time)
    assert.equal(w.heldUntil, r.expiresAt)
    assert.equal(w.chain, 'optimism')
    assert.equal(w.detail['lapsedChain'], 'optimism')
    assert.equal(w.detail['lapsedScore'], 50.015)
  })

  test('a passport that has not expired is not a window — heldUntil means the chain says it ended', () => {
    const w = closeLapsedPassportWindow([reading({ time: NOW - 10 * DAY })], NOW)
    assert.equal(w.heldUntil, undefined)
    assert.equal(w.issuedAt, undefined)
  })

  test('a passport expiring exactly now has ended, the same instant the Decoder starts reverting', () => {
    const w = closeLapsedPassportWindow([reading({ time: NOW - 90 * DAY })], NOW)
    assert.equal(w.heldUntil, NOW)
  })

  test('a zero score closes nothing, because a stampless passport never counted while it was alive', () => {
    // `held` is false for a live zero-score passport, so restoring one would put a credential
    // into the past that would not have been counted at the time.
    const w = closeLapsedPassportWindow([reading({ score: 0 })], NOW)
    assert.equal(w.heldUntil, undefined)
    assert.equal(w.detail['lapsedWithZeroScore'], 1)
  })

  test('a struct with no issuance date closes nothing', () => {
    // time == 0 is the resolver's sentinel for "never minted here"; the probe drops those before
    // this is reached, and this is the second guard rather than a duplicate of the first.
    assert.equal(closeLapsedPassportWindow([reading({ time: 0, expiresAt: NOW - DAY })], NOW).heldUntil, undefined)
  })

  test('an expiry at or before the issuance describes a credential that never counted', () => {
    const t = NOW - 100 * DAY
    assert.equal(closeLapsedPassportWindow([reading({ time: t, expiresAt: t })], NOW).heldUntil, undefined)
    assert.equal(closeLapsedPassportWindow([reading({ time: t, expiresAt: t - 1 })], NOW).heldUntil, undefined)
  })

  test('with several lapsed chains the latest ending wins, and the others are counted', () => {
    // A passport is minted per chain and the mints disagree — the most recent life is the one an
    // as-of instant is likeliest to fall inside, and the rest stay visible in perChain.
    const scroll = reading({ chain: 'scroll' as PassportChain, time: NOW - 400 * DAY, score: 250_990 })
    const optimism = reading({ chain: 'optimism', time: NOW - 200 * DAY })
    for (const order of [[scroll, optimism], [optimism, scroll]]) {
      const w = closeLapsedPassportWindow(order, NOW)
      assert.equal(w.chain, 'optimism')
      assert.equal(w.heldUntil, optimism.expiresAt)
      assert.equal(w.detail['lapsedWindowsOnOtherChains'], 1)
    }
  })

  test('a zero-score chain never wins over a real one, whatever its dates say', () => {
    const empty = reading({ chain: 'base' as PassportChain, score: 0, time: NOW - 100 * DAY })
    const real = reading({ chain: 'optimism', time: NOW - 300 * DAY })
    const w = closeLapsedPassportWindow([empty, real], NOW)
    assert.equal(w.chain, 'optimism')
    assert.equal(w.heldUntil, real.expiresAt)
  })

  test('nothing readable at all is silence, not a window', () => {
    const w = closeLapsedPassportWindow([], NOW)
    assert.equal(w.heldUntil, undefined)
    assert.deepEqual(w.detail, {})
  })
})
