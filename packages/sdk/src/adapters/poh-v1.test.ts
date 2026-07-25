/**
 * The Proof of Humanity v1 read, without a network.
 *
 * `interpretPohV1Read` is the whole decision, and the branch that matters most is the cheapest
 * one to get wrong: `getSubmissionInfo` hands back a `registered` boolean that is never cleared
 * on expiry, so anything that treats it as the answer counts people whose registration lapsed
 * years ago. 33 of 215 addresses sampled from the registry's recent history are in exactly that
 * state. The second is the ForkModule: PoH v2 retires a v1 registration in its own overlay,
 * because it cannot write to the frozen v1 contract.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  interpretPohV1Read,
  POH_V1_FIRST_SUBMISSION_AT,
  POH_V1_SUBMISSION_DURATION as TERM,
} from './poh-v1.ts'

/** A plausible 2026 timestamp and mainnet height; nothing here depends on the wall clock. */
const NOW = 1_784_987_511
const BLOCK = 25_610_404

const read = (over: Partial<Parameters<typeof interpretPohV1Read>[0]>) =>
  interpretPohV1Read({
    block: BLOCK,
    now: NOW,
    isRegistered: false,
    registeredFlag: false,
    submissionTime: 0,
    index: 0,
    numberOfRequests: 0,
    status: 0,
    submissionDuration: TERM,
    forkRemoved: false,
    forkRecognises: false,
    ...over,
  })

describe('Proof of Humanity v1', () => {
  test('an address that never submitted is not held, and that is not an error', () => {
    const r = read({})
    assert.equal(r.held, false)
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.dateFrom, 'none')
    assert.equal(r.detail?.submissionTime, undefined)
    assert.equal(r.detail?.submissionIndex, undefined)
  })

  test('a live registration is held and dated at the block it was accepted in', () => {
    const submissionTime = NOW - 100 * 86_400
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime, index: 20_739, numberOfRequests: 1 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, submissionTime)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.equal(r.provenance?.headBlock, BLOCK)
    assert.equal(r.detail?.source, 'poh-v1-registry')
    assert.equal(r.detail?.submissionIndex, 20_739)
    assert.equal(r.detail?.expiresAt, submissionTime + TERM)
    assert.equal(r.detail?.expiresInDays, Math.round((TERM / 86_400 - 100) * 10) / 10)
  })

  test('a lapsed registration is NOT held, though the struct still says registered', () => {
    // `submission.registered` survives expiry — only a governor removal or a lost revocation
    // request clears it. This is the read that would count a 2022 registration as a human.
    const submissionTime = NOW - TERM - 86_400
    const r = read({ isRegistered: false, registeredFlag: true, submissionTime, index: 4_012, numberOfRequests: 2 })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined, 'a dead credential is not dated as if it were alive')
    assert.equal(r.detail?.registeredFlagOutlivedTerm, true)
    assert.equal(r.detail?.lapsedDaysAgo, 1)
    assert.equal(r.detail?.expiresAt, submissionTime + TERM)
  })

  test('held follows the contract’s own comparison, not our arithmetic', () => {
    // `isRegistered` is `registered && now - submissionTime <= submissionDuration`, evaluated by
    // the contract at the block we pinned. We never recompute it — recomputing is how a probe
    // and its protocol drift apart when `changeDurations` is called, and it has been: the term
    // was 365.25 days at the registry's first submission and is 730.5 days now.
    const stale = { registeredFlag: true, submissionTime: NOW - 10, numberOfRequests: 1 }
    assert.equal(read({ ...stale, isRegistered: false }).held, false)
    assert.equal(read({ ...stale, isRegistered: true }).held, true)
  })

  test('a registration retired by PoH v2 is not held, and says which', () => {
    // v2 cannot write to the frozen v1 contract, so `ForkModule.removed` is where a migration,
    // a revocation, a lost revocation request or a bad-vouching penalty is recorded. v1 goes on
    // answering `true` for up to two more years.
    const submissionTime = NOW - 300 * 86_400
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime, numberOfRequests: 1, forkRemoved: true })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.retiredByPohV2, true)
    assert.equal(r.detail?.source, undefined)
  })

  test('v2 declining to recognise a registration does not retire it', () => {
    // `ForkModule.isRegistered` also requires `submissionTime < forkTime`, which is v2's
    // migration policy and not a statement about the v1 credential. Both registrations alive
    // today were made after the fork, so adopting that condition would zero the whole
    // population.
    const submissionTime = NOW - 600 * 86_400
    const r = read({
      isRegistered: true,
      registeredFlag: true,
      submissionTime,
      numberOfRequests: 1,
      forkRecognises: false,
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, submissionTime)
    assert.equal(r.detail?.recognisedByPohV2, false)
    assert.equal(r.detail?.retiredByPohV2, undefined)
  })

  test('a renewed registration is dated from the renewal, and flagged as such', () => {
    // `executeRequest` rewrites `submissionTime` on every accepted request, so a renewal resets
    // the age. On the Ramp that understates survival, which is a floor rather than an inflation
    // — but the subject is paying for it, so the caveat says so.
    const submissionTime = NOW - 200 * 86_400
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime, numberOfRequests: 3 })
    assert.equal(r.issuedAt, submissionTime)
    assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    assert.equal(r.detail?.numberOfRequests, 3)
  })

  test('a first-and-only registration is not flagged as a renewal', () => {
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime: NOW - 86_400, numberOfRequests: 1 })
    assert.deepEqual(r.provenance?.notes, [])
  })

  test('a date before the registry took its first submission is refused, not believed', () => {
    const submissionTime = POH_V1_FIRST_SUBMISSION_AT - 1
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime, numberOfRequests: 1 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.dateRejected, submissionTime)
    assert.equal(r.provenance?.dateFrom, 'none')
  })

  test('a date after the block we read is refused — the expensive direction on a ramp', () => {
    const r = read({ isRegistered: true, registeredFlag: true, submissionTime: NOW + 1, numberOfRequests: 1 })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.dateRejected, NOW + 1)
  })

  test('losing submissionDuration costs the expiry and nothing else', () => {
    // The contract already applied the term inside `isRegistered`; the extra read only lets us
    // report when the credential dies.
    const submissionTime = NOW - 50 * 86_400
    const r = read({
      isRegistered: true,
      registeredFlag: true,
      submissionTime,
      numberOfRequests: 1,
      submissionDuration: undefined,
    })
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, submissionTime)
    assert.equal(r.detail?.expiresAt, undefined)
    assert.equal(r.detail?.submissionTime, submissionTime)
  })

  test('an unreadable ForkModule is reported rather than assumed clean', () => {
    // The probe turns this into an error before it gets here when v1 says registered; the pure
    // path still has to say what it did not know.
    const r = read({ isRegistered: false, registeredFlag: true, submissionTime: NOW - TERM - 1, forkRecognises: undefined })
    assert.equal(r.held, false)
    assert.equal(r.detail?.forkModuleUnreadable, true)
    assert.equal(r.detail?.recognisedByPohV2, undefined)
  })

  test('the pending statuses are named, because only None is settled', () => {
    const r = read({ isRegistered: false, submissionTime: NOW - 86_400, index: 900, status: 2, numberOfRequests: 1 })
    assert.equal(r.detail?.status, 'PendingRegistration')
    assert.equal(r.held, false)
  })
})
