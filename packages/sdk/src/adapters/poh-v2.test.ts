/**
 * Closing the window on a Proof of Humanity v2 humanity that has expired, without a network.
 *
 * The contract keeps `owner` and `expirationTime` on a humanity it has stopped honouring, so
 * both ends of a lapsed credential are readable at head. `closeLapsedHumanityWindow` is the
 * decision about whether they can be trusted to close it, and every refusal in it is a case
 * measured on the live registry: 196 of 1,569 indexed humanities have had `owner` cleared by a
 * revocation or a transfer, and the two whose expiry was written by the cross-chain grant path
 * are exactly the two whose derived start disagrees with the index (by −215.5 and +144.7 days;
 * the other 19 agree to the second).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { closeLapsedHumanityWindow, POH_V2_DEPLOYED_AT } from './index.ts'
import type { Address } from '../types.ts'

/** A plausible 2026 instant, and one year in the seconds the contract counts them in. */
const NOW = 1_785_008_665
const LIFESPAN = 31_557_600

const SUBJECT = '0xCE0D183b410a53144ef3FC60931911d5AE9f00E6' as Address
/** The humanity id every claim in the registry has used so far: the claimer's own address. */
const ID = '0xce0d183b410a53144ef3fc60931911d5ae9f00e6' as const
const ZERO = '0x0000000000000000000000000000000000000000' as Address

const close = (over: Partial<Parameters<typeof closeLapsedHumanityWindow>[0]>) =>
  closeLapsedHumanityWindow({
    subject: SUBJECT,
    humanityId: ID,
    owner: SUBJECT,
    expirationTime: NOW - 86_400,
    nbRequests: 1,
    lifespan: LIFESPAN,
    now: NOW,
    ...over,
  })

describe('Proof of Humanity v2 — the humanity that expired', () => {
  test('an expired humanity still owned by the subject is a closed window', () => {
    const expirationTime = 1_760_624_340
    const r = close({ expirationTime })
    assert.equal(r.heldUntil, expirationTime)
    assert.equal(r.issuedAt, expirationTime - LIFESPAN)
    assert.equal(r.detail.lapsedHumanityId, ID)
    assert.equal(r.detail.claimedAt, expirationTime - LIFESPAN)
  })

  test('the case is insensitive, because a checksummed owner is still the subject', () => {
    // `getHumanityInfo` returns EIP-55 mixed case; callers hand us whatever they were given.
    const r = close({ owner: ID as Address, subject: SUBJECT })
    assert.equal(r.heldUntil, NOW - 86_400)
  })

  test('a cleared owner is a credential that ended at an instant nobody wrote down', () => {
    // Revocation and cross-chain transfer both `delete humanity.owner`, and neither leaves a
    // timestamp behind. 196 of the 1,569 indexed humanities are in this state; every one of
    // them stays invisible to an as-of score rather than being restored from its expiry.
    const r = close({ owner: ZERO })
    assert.equal(r.heldUntil, undefined)
    assert.equal(r.issuedAt, undefined)
  })

  test('a humanity somebody else now owns is not the subject’s to restore', () => {
    // An id can be re-claimed once it has lapsed. Its expiry then describes the new owner's
    // term, and reading it as the subject's would hand them a stranger's window.
    const r = close({ owner: '0x8773442740C17C9d0F0B87022c722F9a136206eD' as Address })
    assert.equal(r.heldUntil, undefined)
    assert.equal(r.detail.humanityOwnedByAnother, true)
  })

  test('a humanity this contract never resolved a request for gets an end and no start', () => {
    // `nbRequests == 0` means `grantHumanityDirectly` wrote the expiry — the cross-chain path,
    // which copies a term settled on another instance. The derived start is then arithmetic
    // about a claim that happened somewhere else, and on the live registry it misses by
    // months in both directions. The end is still a fact; the start is not.
    const r = close({ nbRequests: 0, expirationTime: 1_769_699_447 })
    assert.equal(r.heldUntil, 1_769_699_447)
    assert.equal(r.issuedAt, undefined, 'a bound is not a date, and only a date restores')
    assert.equal(r.detail.grantedWithoutLocalRequest, true)
  })

  test('a humanity that has not expired is not a window, whatever else is true', () => {
    // The probe only asks this question after `isHuman` says false, so an expiry in the future
    // means the record does not belong to the subject in the way it appears to.
    assert.equal(close({ expirationTime: NOW + 86_400 }).heldUntil, undefined)
    assert.equal(close({ expirationTime: 0 }).heldUntil, undefined)
  })

  test('a start before the contract existed is rejected, and the end survives it', () => {
    // A `humanityLifespan` reconfigured since the expiry was written would produce exactly
    // this: a plausible-looking date that predates the deployment. The end is read, not
    // derived, so it stands — but nothing is restored without a start.
    const r = close({ expirationTime: POH_V2_DEPLOYED_AT + 10, lifespan: LIFESPAN })
    assert.equal(r.heldUntil, POH_V2_DEPLOYED_AT + 10)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail.dateRejected, POH_V2_DEPLOYED_AT + 10 - LIFESPAN)
  })

  test('a lifespan we could not read costs the start and not the end', () => {
    const r = close({ lifespan: 0 })
    assert.equal(r.heldUntil, NOW - 86_400)
    assert.equal(r.issuedAt, undefined)
  })

  test('the window is reported in days as well as seconds, for a human reading it', () => {
    const r = close({ expirationTime: NOW - 10 * 86_400 })
    assert.equal(r.detail.lapsedDaysAgo, 10)
  })
})
