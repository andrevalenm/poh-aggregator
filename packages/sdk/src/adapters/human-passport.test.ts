/**
 * Human Passport — the two decisions that can move a subject's score, without a network.
 *
 * `closeLapsedPassportWindow` is the only part of this adapter that can hand a subject time they
 * did not have. Everything it refuses is a way for an expiry to be mistaken for a life: a
 * passport that carried no stamps, one that has not actually expired, a struct describing a
 * credential that never counted for a second.
 *
 * `judgeBackingAttestation` is the only part that can take a credential *away*, so its branches
 * matter in the other direction: a rejection has to be a statement the chain made, and anything
 * short of that has to leave the credential where it was.
 *
 * Run: node --test --experimental-strip-types src/adapters/human-passport.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  closeLapsedPassportWindow,
  judgeBackingAttestation,
  type BackingAttestation,
  type ChainReading,
  type PassportChain,
} from './human-passport.ts'
import type { Address } from '../types.ts'

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

/**
 * The authority check. Values below are shaped like the live ones on Optimism but none of them
 * is asserted as a constant — the attester is passed in, because the probe reads it from the
 * resolver at run time and it is a different address on every chain.
 */
const SUBJECT = '0xb0812e0006470fE99F71165fC7C1A2312F7b90F2' as Address
const ATTESTER = '0x843829986e895facd330486a61Ebee9E1f1adB1a' as Address
const STRANGER = '0x00000000000000000000000000000000DeaDBeef' as Address
const LEGACY_SCHEMA = '0x6ab5d34260fca0cfcf0e76e96d439cace6aa7c3c019d7c4580ed52c6845e9c89'
const V2_SCHEMA = '0xda0257756063c891659fed52fd36ef7557f7b45d66f59645fd3c3b263b747254'
const MINTED_AT = 1_740_958_699

function attestation(over: Partial<BackingAttestation> = {}): BackingAttestation {
  return {
    uid: '0x29896d054deacc15791835eb6be595e2cac9553991321a8cef7d5460d6de4b31',
    schema: LEGACY_SCHEMA,
    time: MINTED_AT,
    revocationTime: 0,
    recipient: SUBJECT,
    attester: ATTESTER,
    ...over,
  }
}

describe('pinning the attester behind a cached passport score', () => {
  test('the ordinary case: one attestation, by the resolver’s own attester, naming this subject', () => {
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [attestation()])
    assert.equal(v.status, 'verified')
    assert.equal(v.status === 'verified' && v.schema, LEGACY_SCHEMA)
  })

  test('a score attested by anyone else is not Passport’s, and the credential goes', () => {
    // This is the whole point of the pin. The resolver's own `_attest` reverts InvalidAttester()
    // on this, so seeing it would mean the write did not come through the gate we read.
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [attestation({ attester: STRANGER })])
    assert.equal(v.status, 'rejected')
    assert.match(v.status === 'rejected' ? v.reason : '', /attested by 0x0{32}DeaDBeef/i)
  })

  test('an impeccable attestation about somebody else says nothing about this subject', () => {
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [attestation({ recipient: STRANGER })])
    assert.equal(v.status, 'rejected')
  })

  test('a revoked attestation is rejected, because EAS keeps a revoked record readable', () => {
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [
      attestation({ revocationTime: MINTED_AT + 100 }),
    ])
    assert.equal(v.status, 'rejected')
  })

  test('the attester comparison is case-insensitive, since only checksums differ between sources', () => {
    const v = judgeBackingAttestation(SUBJECT.toLowerCase() as Address, MINTED_AT, ATTESTER.toUpperCase() as Address, [
      attestation(),
    ])
    assert.equal(v.status, 'verified')
  })

  test('two schemas on file: the one carrying the cached score’s instant is the one judged', () => {
    // A subject who moved from the legacy score to score-v2 has a uid under each, and only one
    // of them describes the struct we read. Judging the wrong one would reject a real passport.
    const stale = attestation({ uid: '0xaa', schema: LEGACY_SCHEMA, time: MINTED_AT - 5_000_000, attester: STRANGER })
    const current = attestation({ uid: '0xbb', schema: V2_SCHEMA })
    for (const order of [[stale, current], [current, stale]]) {
      const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, order)
      assert.equal(v.status, 'verified')
      assert.equal(v.status === 'verified' && v.uid, '0xbb')
    }
  })

  test('no uid on file is uncorroborated, not disproved — the credential stands', () => {
    // Passport rotating a schema leaves the old uid filed under a key we no longer ask about.
    // That is a fact about our lookup, not about the subject, so it may not remove a credential.
    for (const records of [[], [null, null]]) {
      const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, records)
      assert.equal(v.status, 'unchecked')
    }
  })

  test('a uid on file that dates a different mint is uncorroborated, and says which instants it saw', () => {
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [attestation({ time: MINTED_AT - 900 })])
    assert.equal(v.status, 'unchecked')
    assert.match(v.status === 'unchecked' ? v.reason : '', new RegExp(String(MINTED_AT - 900)))
  })

  test('a rejection survives a second record that is merely uncorroborated', () => {
    // The two live paths differ: `unchecked` keeps the credential, `rejected` removes it. A
    // forged record must not be laundered by an unrelated one filed under the other schema.
    const forged = attestation({ uid: '0xaa', attester: STRANGER })
    const wrongDate = attestation({ uid: '0xbb', schema: V2_SCHEMA, time: MINTED_AT - 900 })
    const v = judgeBackingAttestation(SUBJECT, MINTED_AT, ATTESTER, [wrongDate, forged])
    assert.equal(v.status, 'rejected')
    assert.equal(v.status === 'rejected' && v.uid, '0xaa')
  })
})
