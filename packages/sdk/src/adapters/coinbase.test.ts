/**
 * The Coinbase Verified Account read, without a network.
 *
 * `interpretCoinbaseVerification` is the whole decision, and the branches that matter are the
 * ones where a record exists and still is not a credential. The indexer keeps pointing at an
 * attestation after Coinbase revokes it — 5,143 revocations in the sampled windows against
 * 18,655 issuances — so treating a non-zero uid as the answer counts revoked accounts as
 * verified. The other three are faults rather than negatives: EAS not knowing the uid the
 * indexer named, a record under a different schema, and a record naming somebody else. Each
 * would be a *wrong* answer, so each surfaces as an error and is excluded from scoring.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  COINBASE_ATTESTATION_INDEXER,
  COINBASE_VERIFIED_ACCOUNT_SCHEMA,
  interpretCoinbaseVerification,
  type EasAttestation,
} from './coinbase.ts'
import type { Address } from '../types.ts'

/** A plausible 2026 timestamp and Base height; nothing here depends on the wall clock. */
const NOW = 1_784_999_825
const BLOCK = 49_105_239

const SUBJECT = '0xcab9b4792a9d4c55e3ad1dc0a5b4cba2592e7828' as Address
const UID = '0x88a10ab440a6e5e0e365b9a59cc9843f67aa490cf6cce3b87961e010adc8a8b9' as const
const ZERO = `0x${'0'.repeat(64)}` as const
const ATTESTER = '0x357458739F90461b99789350868CD7CF330Dd7EE' as Address

const attestation = (over: Partial<EasAttestation> = {}): EasAttestation => ({
  uid: UID,
  schema: COINBASE_VERIFIED_ACCOUNT_SCHEMA,
  time: 1_744_000_000n,
  expirationTime: 0n,
  revocationTime: 0n,
  refUID: ZERO,
  recipient: SUBJECT,
  attester: ATTESTER,
  revocable: true,
  data: '0x0000000000000000000000000000000000000000000000000000000000000001',
  ...over,
})

const read = (over: Partial<Parameters<typeof interpretCoinbaseVerification>[0]> = {}) =>
  interpretCoinbaseVerification({
    block: BLOCK,
    now: NOW,
    subject: SUBJECT,
    uid: UID,
    attestation: attestation(),
    ...over,
  })

describe('Coinbase Verified Account', () => {
  test('an address the indexer does not know is not held, and that is not an error', () => {
    const r = read({ uid: ZERO, attestation: undefined })
    assert.equal(r.held, false)
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.equal(r.provenance?.dateFrom, 'none')
    assert.equal(r.provenance?.headBlock, BLOCK)
    assert.deepEqual(r.provenance?.notes, [])
    assert.equal(r.detail?.indexer, COINBASE_ATTESTATION_INDEXER)
  })

  test('a live attestation is held and dated from the EAS record, not the indexer', () => {
    const r = read()
    assert.equal(r.held, true)
    assert.equal(r.error, undefined)
    assert.equal(r.issuedAt, 1_744_000_000)
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.equal(r.detail?.attestationUid, UID)
    assert.equal(r.detail?.attester, ATTESTER)
    assert.equal(r.detail?.revoked, false)
    assert.equal(r.detail?.expiresAt, undefined)
  })

  test('a revoked attestation is not held, even though the indexer still points at it', () => {
    const r = read({ attestation: attestation({ revocationTime: 1_760_000_000n }) })
    assert.equal(r.held, false)
    assert.equal(r.error, undefined)
    assert.equal(r.detail?.revoked, true)
    assert.equal(r.detail?.revokedAt, 1_760_000_000)
    // The date survives the negative: "revoked last month" and "lapsed in 2024" are different
    // stories and a caller reading `detail` can tell them apart.
    assert.equal(r.issuedAt, 1_744_000_000)
    assert.equal(r.provenance?.dateFrom, 'chain')
  })

  test('an expired attestation is not held; one expiring later still is', () => {
    const expired = read({ attestation: attestation({ expirationTime: BigInt(NOW - 1) }) })
    assert.equal(expired.held, false)
    assert.equal(expired.error, undefined)
    assert.equal(expired.detail?.expired, true)
    assert.equal(expired.detail?.expiresAt, NOW - 1)

    const live = read({ attestation: attestation({ expirationTime: BigInt(NOW + 1) }) })
    assert.equal(live.held, true)
    assert.equal(live.detail?.expiresAt, NOW + 1)
    assert.equal(live.detail?.expired, undefined)
  })

  test('an expiry exactly at now is spent, not held', () => {
    const r = read({ attestation: attestation({ expirationTime: BigInt(NOW) }) })
    assert.equal(r.held, false)
    assert.equal(r.detail?.expired, true)
  })

  test('revocation beats expiry: a revoked record reports why it was refused', () => {
    const r = read({
      attestation: attestation({ revocationTime: 1_760_000_000n, expirationTime: BigInt(NOW - 1) }),
    })
    assert.equal(r.held, false)
    assert.equal(r.detail?.revokedAt, 1_760_000_000)
    assert.equal(r.detail?.expired, undefined)
  })

  test('the window closes at whichever came first, not at whichever we checked first', () => {
    // The revocation branch is reported because it is the more informative negative, but the
    // credential stopped counting at the expiry. Handing an as-of score the revocation date
    // would grant the subject the months between the two, which they did not have.
    const r = read({
      attestation: attestation({ revocationTime: 1_760_000_000n, expirationTime: 1_750_000_000n }),
    })
    assert.equal(r.detail?.revokedAt, 1_760_000_000, 'the revocation is still the reported reason')
    assert.equal(r.heldUntil, 1_750_000_000, 'but the credential stopped counting at the expiry')
  })

  test('a revoked attestation closes its window at the revocation', () => {
    const r = read({ attestation: attestation({ revocationTime: 1_760_000_000n }) })
    assert.equal(r.heldUntil, 1_760_000_000)
    assert.equal(r.issuedAt, 1_744_000_000, 'both ends, so an instant between them is decidable')
  })

  test('an expired attestation closes its window at the expiry', () => {
    const r = read({ attestation: attestation({ expirationTime: BigInt(NOW - 1) }) })
    assert.equal(r.heldUntil, NOW - 1)
    assert.equal(r.issuedAt, 1_744_000_000)
  })

  test('a credential that is simply held, or simply absent, dates no ending', () => {
    // `heldUntil` may only ever mean "the chain says this ended here". A live credential has
    // not ended, and an address the indexer knows nothing about never had one to end.
    assert.equal(read({ attestation: attestation({ expirationTime: BigInt(NOW + 1) }) }).heldUntil, undefined)
    assert.equal(read({ attestation: attestation() }).heldUntil, undefined)
    assert.equal(read({ uid: ZERO, attestation: undefined }).heldUntil, undefined)
  })

  test('a uid EAS cannot follow is an error, not a negative', () => {
    // EAS returns a zeroed struct rather than reverting for a uid it does not know, so the
    // fault arrives looking exactly like an ordinary record.
    const r = read({ attestation: attestation({ uid: ZERO, time: 0n, recipient: ZERO.slice(0, 42) as Address }) })
    assert.equal(r.held, false)
    assert.match(r.error ?? '', /EAS has no record/)
  })

  test('a record under a different schema is an error, not a credential', () => {
    const r = read({
      attestation: attestation({
        schema: '0x1801901fabd0e6189356b4fb52bb0ab855276d84f7ec140839fbd1f6801ca065',
      }),
    })
    assert.equal(r.held, false)
    assert.match(r.error ?? '', /not the Verified Account schema/)
  })

  test('a record naming somebody else is an error — the indexer is a pointer, not the truth', () => {
    const other = '0x000000000000000000000000000000000000dEaD' as Address
    const r = read({ attestation: attestation({ recipient: other }) })
    assert.equal(r.held, false)
    assert.match(r.error ?? '', /names recipient/)
  })

  test('recipient matching is case-insensitive, because EAS returns it checksummed', () => {
    const r = read({
      subject: SUBJECT.toUpperCase().replace('0X', '0x') as Address,
      attestation: attestation({ recipient: SUBJECT }),
    })
    assert.equal(r.held, true)
    assert.equal(r.error, undefined)
  })

  test('a record with no issuance time is an error, never an undated credential', () => {
    // An undated credential is scored at freshness 1 on a decay curve — full weight, forever.
    // That is the one outcome this branch exists to prevent.
    const r = read({ attestation: attestation({ time: 0n }) })
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined)
    assert.match(r.error ?? '', /no issuance time/)
  })

  test('a non-zero uid with no record read is an error, not a silent negative', () => {
    const r = read({ attestation: undefined })
    assert.equal(r.held, false)
    assert.match(r.error ?? '', /no EAS record was read/)
  })
})
