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
import { AGENT_BOOK_DEPLOYED_AT } from '../agentbook.ts'

/** A plausible 2026 timestamp; nothing here depends on the wall clock. */
const NOW = 1_784_987_511
const BLOCK = 32_825_936

/** A registration a month before `NOW`, as the log would report it. */
const REGISTERED_AT = NOW - 30 * 86_400
const registration = (over: Record<string, unknown> = {}) => ({
  status: 'found' as const,
  block: 30_500_000,
  timestamp: REGISTERED_AT,
  humanId: '12345',
  ...over,
})

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
    assert.equal(r.detail?.addressBookLapsedAt, verifiedUntil)
    assert.equal(r.detail?.oneLiveAddressPerHuman, undefined)
  })

  test('a lapsed verification is a closed window, and both of its ends are on chain', () => {
    // The date on a dead credential weighs nothing at head — `held` is false and the scorer
    // never prices an absence. What it does is close the window: this address was bound from
    // `verifiedUntil - term` until `verifiedUntil`, so an as-of score can decide whether an
    // instant falls inside it instead of reporting the subject had nothing.
    const verifiedUntil = NOW - 86_400
    const r = read({ verifiedUntil, agentBookHumanId: '0' })
    assert.equal(r.held, false)
    assert.equal(r.heldUntil, verifiedUntil)
    assert.equal(r.issuedAt, verifiedUntil - TERM)
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.ok(r.provenance?.notes.includes('date-from-lapsed-verification'))
    assert.ok(!r.provenance?.notes.includes('date-from-latest-reattestation'))
  })

  test('an address that was never verified has no window to close', () => {
    // `heldUntil` must mean "the chain dates the end of this credential", never "we found
    // nothing". A never-verified address is the ordinary negative and gets no date at all.
    const r = read({ verifiedUntil: 0, agentBookHumanId: '0' })
    assert.equal(r.held, false)
    assert.equal(r.heldUntil, undefined)
    assert.equal(r.issuedAt, undefined)
  })

  test('a term the contract cannot have written leaves the window open at the start', () => {
    // The end is still exact — it is the stored number. The start is not, so it is withheld,
    // and an as-of score is left unable to prove the subject held this rather than free to
    // assume it. Refusing the date is the whole point of the plausibility guard.
    const r = read({
      verifiedUntil: NOW - 100,
      agentBookHumanId: '0',
      verificationLength: NOW - 100 - WORLD_ADDRESS_BOOK_DEPLOYED_AT + 1,
    })
    assert.equal(r.held, false)
    assert.equal(r.heldUntil, NOW - 100)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.dateRejected, WORLD_ADDRESS_BOOK_DEPLOYED_AT - 1)
  })

  test('expiry uses the contract’s own comparison, so the exact second of expiry is over', () => {
    // `verify()` treats a previous binding as active while `addressVerifiedUntil > block.timestamp`.
    assert.equal(read({ verifiedUntil: NOW }).held, false)
    assert.equal(read({ verifiedUntil: NOW + 1 }).held, true)
  })

  test('an AgentBook binding alone is dated from the block it was registered in', () => {
    const r = read({ agentBookHumanId: '12345', agentBookRegistration: registration() })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, REGISTERED_AT)
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.ok(r.provenance?.notes.includes('date-from-agent-registration'))
    assert.ok(!r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.equal(r.detail?.source, 'world-agentbook')
    assert.equal(r.detail?.agentBookHumanId, '12345')
    assert.equal(r.detail?.agentBookRegisteredAtBlock, 30_500_000)
  })

  test('a lapsed address book entry beside a live AgentBook binding is dated from the registration', () => {
    const r = read({
      verifiedUntil: NOW - 10,
      agentBookHumanId: '99',
      agentBookRegistration: registration({ humanId: '99' }),
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, REGISTERED_AT, 'the dead AddressBook entry cannot date a live binding')
    assert.equal(r.detail?.addressBookLapsedAt, NOW - 10)
    assert.equal(r.detail?.source, 'world-agentbook')
    // Nothing ended here. The AddressBook term ran out, but the credential is still held
    // through AgentBook, and dating an end for a credential the subject has would let an as-of
    // score restore something that never went away — or worse, read as lost at head.
    assert.equal(r.heldUntil, undefined)
    assert.ok(!r.provenance?.notes.includes('date-from-lapsed-verification'))
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

/**
 * The AgentBook date.
 *
 * The registry stores a mapping and no timestamp, so a World credential held only through it used
 * to arrive at scoring undated — and `freshnessOf` scores an undated `Decay` credential at 1, so
 * it kept full weight forever. The date is in the `AgentRegistered` log. These tests are about the
 * ways that date can be wrong, because every one of them is silent: an undated credential and a
 * correctly dated one differ only in the number that comes out at the end.
 */
describe('World ID dated from the AgentBook registration', () => {
  test('the later of the two dates wins, when the registration is the fresher one', () => {
    // Real shape, measured on World Chain: wallets verified in the AddressBook months before their
    // operator registered them as agents. Each date is a moment the chain accepted an Orb proof.
    const verifiedUntil = NOW + TERM - 120 * 86_400 // last re-attestation 120 days ago
    const r = read({
      verifiedUntil,
      agentBookHumanId: '12345',
      agentBookRegistration: registration(),
    })
    assert.equal(r.detail?.addressBookIssuedAt, verifiedUntil - TERM)
    assert.equal(r.issuedAt, REGISTERED_AT)
    assert.ok(r.provenance?.notes.includes('date-from-agent-registration'))
    assert.ok(!r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.equal(r.detail?.source, 'world-id-address-book+world-agentbook')
  })

  test('and the re-attestation wins when it is the fresher one', () => {
    const verifiedUntil = NOW + TERM - 10 * 86_400 // re-attested 10 days ago
    const r = read({
      verifiedUntil,
      agentBookHumanId: '12345',
      agentBookRegistration: registration(),
    })
    assert.equal(r.issuedAt, verifiedUntil - TERM)
    assert.equal(r.detail?.agentBookRegisteredAt, REGISTERED_AT, 'the older date is still reported')
    assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.ok(!r.provenance?.notes.includes('date-from-agent-registration'))
  })

  test('both notes fire when the two dates are the same second', () => {
    const verifiedUntil = REGISTERED_AT + TERM
    const r = read({
      verifiedUntil,
      agentBookHumanId: '12345',
      agentBookRegistration: registration(),
    })
    assert.equal(r.issuedAt, REGISTERED_AT)
    assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.ok(r.provenance?.notes.includes('date-from-agent-registration'))
  })

  test('an unreadable log leaves the credential undated, and says so', () => {
    const r = read({
      agentBookHumanId: '12345',
      agentBookRegistration: { status: 'unavailable' },
    })
    assert.equal(r.held, true, 'a failed date lookup is never a failed credential')
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookDateUnavailable, true)
  })

  test('a mapping entry the log cannot account for is flagged, not dated', () => {
    // Registrations cannot be withdrawn, so state-without-log is our read being incomplete. The
    // permissive failure is exactly the one to be loud about.
    const r = read({
      agentBookHumanId: '12345',
      agentBookRegistration: { status: 'not-found' },
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookRegistrationNotInLog, true)
  })

  test('a log naming a different human than state does not date the binding', () => {
    const r = read({
      agentBookHumanId: '12345',
      agentBookRegistration: registration({ humanId: '999' }),
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookDateRejected, 'registration-log-disagrees-with-state')
    assert.equal(r.detail?.agentBookRegisteredAt, undefined)
  })

  test('a registration dated before the registry existed is refused', () => {
    const r = read({
      agentBookHumanId: '12345',
      agentBookRegistration: registration({ timestamp: AGENT_BOOK_DEPLOYED_AT - 1 }),
    })
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookDateRejected, AGENT_BOOK_DEPLOYED_AT - 1)
  })

  test('a registration dated after the block we read is refused', () => {
    // The expensive direction on a decay curve: a future date is maximum freshness.
    const r = read({
      agentBookHumanId: '12345',
      agentBookRegistration: registration({ timestamp: NOW + 1 }),
    })
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookDateRejected, NOW + 1)
  })

  test('a log for a wallet the mapping no longer knows cannot date anything', () => {
    // `lookupHuman` is the source of held. A registration log without a live mapping entry is
    // history, and history is not a credential.
    const r = read({ agentBookHumanId: '0', agentBookRegistration: registration() })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.agentBookRegisteredAt, undefined)
  })

  test('a missing AgentBook read is not a missing date — it is a missing source', () => {
    const r = read({ verifiedUntil: NOW + 100 })
    assert.equal(r.detail?.agentBookUnreadable, true)
    assert.equal(r.detail?.agentBookDateUnavailable, undefined)
    assert.equal(r.issuedAt, NOW + 100 - TERM)
  })
})

/**
 * Which of the contract's terms wrote this entry.
 *
 * `setVerificationLength` moves `verificationLength` and touches not one stored expiry, so
 * subtracting head's term from an entry written under a different one shifts the date by the whole
 * size of the change — for every address in the book at once, in the same direction, silently. On
 * a decay curve a shortened term makes the whole registry look fresher, which is the direction
 * that pays an adversary and the reason `world-term.ts` reads the history rather than pinning a
 * constant.
 *
 * Nothing here changes a score today: the sweep finds one era, so `termForLocalExpiry` reduces to
 * the deployment-floor guard the probe always applied. These are the branches for the day it does
 * not, plus the regression that the old behaviour survives for a caller who supplies no history.
 */
describe('World ID dated with the term that was in force, not the term at head', () => {
  /** Two eras: 168 days until a change 300 days ago, 84 days since. */
  const CHANGED_AT = NOW - 300 * 86_400
  const TWO_ERAS = {
    eras: [
      { from: WORLD_ADDRESS_BOOK_DEPLOYED_AT, seconds: TERM, until: CHANGED_AT },
      { from: CHANGED_AT, seconds: TERM / 2, block: 21_000_000 },
    ],
    observed: true,
  }

  test('an entry written under the old term is dated with the old term', () => {
    // Verified 400 days ago, when the term was still 168 days: the entry has lapsed, and its
    // window opens where the *old* term puts it. Head's term would place it 84 days later.
    const verifiedAt = NOW - 400 * 86_400
    const verifiedUntil = verifiedAt + TERM
    // Head's term is the running era's, which is the halved one.
    const r = read({
      verifiedUntil,
      verificationLength: TERM / 2,
      agentBookHumanId: '0',
      terms: TWO_ERAS,
    })
    assert.equal(r.issuedAt, verifiedAt)
    assert.notEqual(r.issuedAt, verifiedUntil - TERM / 2)
    assert.equal(r.detail?.termAtVerification, TERM)
    assert.equal(r.heldUntil, verifiedUntil)
  })

  test('an entry written since the change is dated with head’s term, and says nothing extra', () => {
    const verifiedAt = NOW - 10 * 86_400
    const r = read({
      verifiedUntil: verifiedAt + TERM / 2,
      verificationLength: TERM / 2,
      agentBookHumanId: '0',
      terms: TWO_ERAS,
    })
    assert.equal(r.issuedAt, verifiedAt)
    // The term in force is the term at head, so there is nothing to qualify.
    assert.equal(r.detail?.termAtVerification, undefined)
    assert.equal(r.provenance?.notes.includes('term-origin-unverified'), false)
  })

  test('two eras that both explain the entry leave it undated rather than guessed at', () => {
    // Reachable whenever a change is smaller than the gap between the eras it separates: the same
    // `verifiedUntil` is then consistent with a write in either era, and nothing in the entry says
    // which. A date here would be a coin flip wearing a timestamp.
    const shortened = TERM - 20 * 86_400
    const ambiguous = {
      eras: [
        { from: WORLD_ADDRESS_BOOK_DEPLOYED_AT, seconds: TERM, until: CHANGED_AT },
        { from: CHANGED_AT, seconds: shortened, block: 21_000_000 },
      ],
      observed: true,
    }
    // Written 10 days before the change under the long term, or 10 days after it under the short
    // one — both land inside their own era.
    const verifiedUntil = CHANGED_AT - 10 * 86_400 + TERM
    assert.equal(verifiedUntil - shortened, CHANGED_AT + 10 * 86_400)
    const r = read({ verifiedUntil, agentBookHumanId: '0', terms: ambiguous })
    assert.equal(r.issuedAt, undefined)
    assert.deepEqual(r.detail?.termAmbiguous, [TERM, shortened])
  })

  test('a sweep that was attempted and failed keeps the date and says the check did not happen', () => {
    const verifiedUntil = NOW + 1000
    const r = read({
      verifiedUntil,
      agentBookHumanId: '0',
      terms: { eras: [{ from: WORLD_ADDRESS_BOOK_DEPLOYED_AT, seconds: TERM }], observed: false },
    })
    assert.equal(r.issuedAt, verifiedUntil - TERM)
    assert.ok(r.provenance?.notes.includes('term-origin-unverified'))
  })

  test('a caller who never asked for a sweep is told nothing, because no check was skipped', () => {
    // The pre-existing contract, and the regression that matters: an unasked question and an
    // unanswered one license different confidence, and only the second is a caveat.
    const verifiedUntil = NOW + 1000
    const r = read({ verifiedUntil, agentBookHumanId: '0' })
    assert.equal(r.issuedAt, verifiedUntil - TERM)
    assert.equal(r.provenance?.notes.includes('term-origin-unverified'), false)
  })

  test('the AgentBook date is not qualified by a term it does not use', () => {
    // The registration date comes from a log's block, with no subtraction in it. A failed
    // AddressBook sweep says nothing about it, so the note must not ride along when the date the
    // probe reports is AgentBook's.
    const r = read({
      verifiedUntil: NOW + TERM - 300 * 86_400, // an older re-attestation than the registration
      agentBookHumanId: '12345',
      agentBookRegistration: registration(),
      terms: { eras: [{ from: WORLD_ADDRESS_BOOK_DEPLOYED_AT, seconds: TERM }], observed: false },
    })
    assert.equal(r.issuedAt, REGISTERED_AT)
    assert.ok(r.provenance?.notes.includes('date-from-agent-registration'))
    assert.equal(r.provenance?.notes.includes('term-origin-unverified'), false)
  })
})
