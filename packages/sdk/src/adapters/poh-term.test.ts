/**
 * Whose term is behind a PoH v2 expiry, decided without a network.
 *
 * The measurement these encode, from the full-history sweep of `HumanityGrantedDirectly` over
 * the registry's life (research/protocols/poh-imported-terms.md): 9 humanities have ever been
 * imported, 7 of them carry PoH v1's 63,115,200 s term against this contract's 31,557,600, and
 * 3 of the 9 carry `nbRequests >= 1` — so the test that used to guard the subtraction misses a
 * third of the population it was written for.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { classifyHumanityTerm, type HumanityGrant } from './poh-term.ts'
import { dateHumanityFromTerm, POH_V2_DEPLOYED_AT } from './index.ts'

const NOW = 1_785_019_230
const LIFESPAN = 31_557_600
/** `0x6687c671…8dd6`, the first humanity ever imported, and its real numbers. */
const ID = '0x6687c671980e65ebd722b9146fc61e2471558dd6'
const IMPORTED_EXPIRY = 1_769_699_447
const GRANT: HumanityGrant = {
  humanityId: ID,
  expirationTime: IMPORTED_EXPIRY,
  block: 35_864_230,
  grantedAt: 1_725_637_955,
}
/** What PoH v1 on mainnet actually holds for it: submission 2024-01-30, two-year term. */
const V1_SUBMISSION_TIME = 1_706_584_247
const V1_TERM = 63_115_200

const classify = (over: Partial<Parameters<typeof classifyHumanityTerm>[0]> = {}) =>
  classifyHumanityTerm({
    humanityId: ID,
    expirationTime: IMPORTED_EXPIRY,
    lifespan: LIFESPAN,
    now: NOW,
    grants: new Map([[ID, [GRANT]]]),
    ...over,
  })

describe('PoH v2 — whose term wrote this expiry', () => {
  test('a grant log carrying this exact expiry is proof the term is not ours', () => {
    const t = classify()
    assert.equal(t.kind, 'imported')
    assert.equal(t.kind === 'imported' ? t.grant?.grantedAt : undefined, GRANT.grantedAt)
  })

  test('a humanity with no grant at all is this contract’s own', () => {
    assert.deepEqual(classify({ grants: new Map() }), { kind: 'local' })
  })

  test('a grant whose expiry has since been written over is a renewal, whatever nbRequests says', () => {
    // The real case: `0xe7f13052…79bc` was imported from v1 in 2024-09 with a v1 term, then
    // renewed here in 2025-07, which moved the expiry and left `nbRequests` at 1. The
    // `nbRequests > 1` test calls that a first claim. The grant log does not.
    const t = classify({ expirationTime: NOW + 100 * 86_400 })
    assert.equal(t.kind, 'local')
    assert.equal(t.kind === 'local' ? t.renewedAfterImport : undefined, true)
  })

  test('an expiry further out than a full term is imported with no log to read', () => {
    // Sound without the sweep: both local writers set `block.timestamp + humanityLifespan`, so
    // no local write can put an expiry more than one term past the block we read at. It fires
    // for a governance change to `humanityLifespan` too — and in that case the subtraction is
    // equally void, so the same refusal is the right one.
    const t = classify({ grants: undefined, expirationTime: NOW + LIFESPAN + 1 })
    assert.deepEqual(t, { kind: 'imported' })
  })

  test('an unread sweep is not an empty one', () => {
    // The distinction `IndexView.entity: null` draws, in a second place: "no imports" and "we
    // could not ask" license completely different answers, and conflating them would hand every
    // subject a date on the strength of a request that never returned.
    assert.deepEqual(classify({ grants: undefined }), { kind: 'unverified' })
    assert.deepEqual(classify({ grants: new Map() }), { kind: 'local' })
  })

  test('the id is matched case-insensitively, because the getter answers in EIP-55', () => {
    assert.equal(classify({ humanityId: ID.toUpperCase().replace('0X', '0x') }).kind, 'imported')
  })
})

describe('PoH v2 — dating a humanity once the term is placed', () => {
  const date = (over: Partial<Parameters<typeof dateHumanityFromTerm>[0]>) =>
    dateHumanityFromTerm({
      expirationTime: IMPORTED_EXPIRY,
      lifespan: LIFESPAN,
      now: NOW,
      term: { kind: 'local' },
      ...over,
    })

  test('the origin’s registration replaces a date that was a full year late', () => {
    // This is the defect, in one assertion. `0x6687c671…8dd6` was registered on PoH v1 on
    // 2024-01-30 under a two-year term; subtracting *this* contract's one-year term from the
    // imported expiry lands on 2025-01-29 — 365.25 days after the truth, reporting a two-year-old
    // credential as a one-year-old one.
    const naive = IMPORTED_EXPIRY - LIFESPAN
    const r = date({
      term: { kind: 'imported', grant: GRANT },
      origin: { instance: 'poh-v1-mainnet', issuedAt: V1_SUBMISSION_TIME, term: V1_TERM },
      purpose: 'age',
    })
    assert.equal(r.issuedAt, V1_SUBMISSION_TIME)
    assert.equal(naive - V1_SUBMISSION_TIME, LIFESPAN, 'the old answer was exactly one term late')
    assert.equal(r.note, 'date-from-origin-instance')
    assert.equal(r.detail.termSeconds, V1_TERM)
  })

  test('an origin we could not read falls back to the grant block, never to the wrong term', () => {
    const r = date({ term: { kind: 'imported', grant: GRANT }, purpose: 'age' })
    assert.equal(r.issuedAt, GRANT.grantedAt)
    assert.equal(r.note, 'date-from-registry-import')
    assert.notEqual(r.issuedAt, IMPORTED_EXPIRY - LIFESPAN)
  })

  test('a local term dates exactly as it always did', () => {
    const r = date({ expirationTime: 1_760_624_340 })
    assert.equal(r.issuedAt, 1_760_624_340 - LIFESPAN)
    assert.equal(r.note, undefined)
  })

  test('the deployment floor still rejects a date this contract cannot have written', () => {
    const r = date({ expirationTime: POH_V2_DEPLOYED_AT + 10 })
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail.dateRejected, POH_V2_DEPLOYED_AT + 10 - LIFESPAN)
  })

  test('a renewal after an import is flagged where nbRequests could not see it', () => {
    const r = date({ term: { kind: 'local', renewedAfterImport: true }, expirationTime: 1_760_624_340 })
    assert.equal(r.detail.renewed, true)
  })
})
