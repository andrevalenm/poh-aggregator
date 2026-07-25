/**
 * The World ID read, without a network.
 *
 * `interpretWorldRead` is the whole decision: two registries, a mapping that is never cleared,
 * and a date that is only derivable while the contract's term is the term the entry was written
 * under. The branch that matters most is the cheapest to get wrong — `addressVerifiedUntil`
 * returns a nonzero number long after a verification has died, so "held" is a comparison and
 * never a presence check.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  interpretWorldRead,
  WORLD_ADDRESS_BOOK_DEPLOYED_AT,
  WORLD_ADDRESS_BOOK_VERIFICATION_LENGTH as TERM,
} from './world.ts'

/** A plausible 2026 timestamp; nothing here depends on the wall clock. */
const NOW = 1_784_987_511
const BLOCK = 32_825_936

const read = (over: Partial<Parameters<typeof interpretWorldRead>[0]>) =>
  interpretWorldRead({
    block: BLOCK,
    now: NOW,
    verifiedUntil: 0,
    verificationLength: TERM,
    ...over,
  })

describe('World ID address book', () => {
  test('an address that was never verified is not held, and that is not an error', () => {
    const r = read({ agentBookHumanId: '0' })
    assert.equal(r.held, false)
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.dateFrom, 'none')
    assert.equal(r.detail?.verifiedUntil, undefined)
  })

  test('a live verification is held and dated at the block it was written in', () => {
    const verifiedUntil = NOW + 1000
    const r = read({ verifiedUntil, agentBookHumanId: '0' })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, verifiedUntil - TERM)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.equal(r.provenance?.headBlock, BLOCK)
    assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.equal(r.detail?.source, 'world-id-address-book')
  })

  test('a lapsed verification is NOT held, though the mapping still holds its number', () => {
    // The contract never clears `addressVerifiedUntil`, so presence is not evidence. Roughly
    // half of a sampled 2025-04 cohort is in exactly this state today.
    const verifiedUntil = NOW - 86_400
    const r = read({ verifiedUntil, agentBookHumanId: '0' })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined, 'a dead credential is not dated as if it were alive')
    assert.equal(r.detail?.addressBookLapsedAt, verifiedUntil)
    assert.equal(r.detail?.oneLiveAddressPerHuman, undefined)
  })

  test('expiry uses the contract’s own comparison, so the exact second of expiry is over', () => {
    // `verify()` treats a previous binding as active while `addressVerifiedUntil > block.timestamp`.
    assert.equal(read({ verifiedUntil: NOW }).held, false)
    assert.equal(read({ verifiedUntil: NOW + 1 }).held, true)
  })

  test('an AgentBook binding alone is held, with no date to give', () => {
    const r = read({ agentBookHumanId: '12345' })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.dateFrom, 'none')
    assert.equal(r.detail?.source, 'world-agentbook')
    assert.equal(r.detail?.agentBookHumanId, '12345')
  })

  test('a lapsed address book entry beside a live AgentBook binding is held, and says both', () => {
    const r = read({ verifiedUntil: NOW - 10, agentBookHumanId: '99' })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined, 'the AgentBook carries no date, so neither do we')
    assert.equal(r.detail?.addressBookLapsedAt, NOW - 10)
    assert.equal(r.detail?.source, 'world-agentbook')
  })

  test('both registries answering is reported as both, not collapsed to one', () => {
    const r = read({ verifiedUntil: NOW + 5, agentBookHumanId: '7' })
    assert.equal(r.detail?.source, 'world-id-address-book+world-agentbook')
    assert.equal(r.held, true)
  })

  test('an unreadable AgentBook cannot turn an address book positive into an error', () => {
    const r = read({ verifiedUntil: NOW + 100 })
    assert.equal(r.held, true)
    assert.equal(r.error, undefined)
    assert.equal(r.detail?.agentBookUnreadable, true)
    assert.equal(r.detail?.agentBookHumanId, undefined)
  })

  test('a term change that would date an entry before the registry existed drops the date', () => {
    // If `setVerificationLength` ever raises the term, `verifiedUntil - term` walks backwards for
    // every entry written under the old one. Better no date than a fabricated one.
    const r = read({ verifiedUntil: NOW + 10, verificationLength: NOW + 10 - WORLD_ADDRESS_BOOK_DEPLOYED_AT + 1 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.dateRejected, WORLD_ADDRESS_BOOK_DEPLOYED_AT - 1)
    assert.ok(!r.provenance?.notes.includes('date-from-latest-reattestation'))
  })

  test('a term change that would date an entry in the future drops the date', () => {
    // The dangerous direction: a shortened term makes every old entry look freshly verified, and
    // on a decay curve fresh is expensive. An issuance after the block we read it at is
    // impossible, so it is refused rather than believed.
    const r = read({ verifiedUntil: NOW + 5000, verificationLength: 60 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.dateRejected, NOW + 4940)
  })

  test('a zero term is not divided into a date', () => {
    const r = read({ verifiedUntil: NOW + 100, verificationLength: 0 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
  })

  test('the term the date rests on is reported, so a consumer can check the arithmetic', () => {
    const r = read({ verifiedUntil: NOW + 86_400 })
    assert.equal(r.detail?.verificationLengthSeconds, TERM)
    assert.equal(r.detail?.verifiedUntil, NOW + 86_400)
    assert.equal(r.detail?.expiresInDays, 1)
    assert.equal(r.detail?.oneLiveAddressPerHuman, true)
  })
})
