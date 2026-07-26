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

  test('with nobody to ask about the term, `nbRequests == 0` still refuses a start', () => {
    // The fallback, for a caller with no network: `nbRequests == 0` means this contract never
    // resolved a request for the humanity, so the expiry was written by the cross-chain path and
    // the derived start is arithmetic about a claim that happened somewhere else. Sound, and
    // incomplete — 3 of the 9 imports carry `nbRequests >= 1`, which is why it is no longer the
    // discriminator. The end is still a fact; the start is not.
    const r = close({ nbRequests: 0, expirationTime: 1_769_699_447 })
    assert.equal(r.heldUntil, 1_769_699_447)
    assert.equal(r.issuedAt, undefined, 'a bound is not a date, and only a date restores')
    assert.equal(r.detail.grantedWithoutLocalRequest, true)
  })

  test('a term that is known to be this contract’s overrules `nbRequests == 0`', () => {
    // The sweep is the better witness. A humanity with no local request whose expiry no grant
    // log accounts for was written by `executeRequest` or `rule` under some request history the
    // getter does not expose, and the subtraction is exact for it.
    const r = close({ nbRequests: 0, term: { kind: 'local' } })
    assert.equal(r.issuedAt, NOW - 86_400 - LIFESPAN)
    assert.equal(r.detail.grantedWithoutLocalRequest, undefined)
  })

  test('an imported window starts at the grant, not at the origin’s registration', () => {
    // The two dates answer different questions. `dateHumanityFromTerm` gives an *age* the
    // origin's registration, because the human has held the credential since then; a *window*
    // is about the instants this registry honoured the humanity for, and that cannot begin
    // before the grant that created it here. Restoring a Gnosis credential for a Tuesday when
    // the registration was still on mainnet would be a false statement about this adapter.
    const grantedAt = NOW - 400 * 86_400
    const r = close({
      nbRequests: 0,
      term: { kind: 'imported', grant: { humanityId: ID, expirationTime: NOW - 86_400, block: 40_000_000, grantedAt } },
      origin: { instance: 'poh-v1-mainnet', issuedAt: NOW - 900 * 86_400, term: 63_115_200 },
    })
    assert.equal(r.heldUntil, NOW - 86_400)
    assert.equal(r.issuedAt, grantedAt)
    assert.equal(r.note, 'date-from-registry-import')
    assert.equal(r.detail.originRegisteredAt, NOW - 900 * 86_400)
    assert.equal(r.detail.termOrigin, 'poh-v1-mainnet')
  })

  test('an imported term with no grant block and no origin closes nothing', () => {
    // Reachable only when the sweep failed *and* the expiry is arithmetically impossible for a
    // local write. There is no date to be had, so none is invented.
    const r = close({ term: { kind: 'imported' } })
    assert.equal(r.heldUntil, NOW - 86_400)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail.termImported, true)
  })

  test('an unverified term keeps the derived date and says it is unverified', () => {
    const r = close({ term: { kind: 'unverified' } })
    assert.equal(r.issuedAt, NOW - 86_400 - LIFESPAN)
    assert.equal(r.note, 'term-origin-unverified')
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
