/**
 * Holonym, the parts that need no network.
 *
 * `interpretSbt` is the whole decision — held, not held, and how old — as a pure function of
 * what the Hub returned, so every branch can be exercised here instead of hoping the chain
 * produces one. The branches that matter are the ones a live test cannot conjure: a revoked
 * SBT, a forged issuer, a stored expiry that disagrees with the proof.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  HOLONYM_CREDENTIALS,
  HOLONYM_MAX_CREDENTIAL_TERM_SECONDS,
  holonymIdentifier,
  interpretSbt,
  type SbtRecord,
} from './holonym.ts'
import type { Address } from '../types.ts'

const NOW = 1_784_900_000
const GOV_ID = HOLONYM_CREDENTIALS['holonym-gov-id']!
const SUBJECT = '0xA6b7471fe0338F8B45266734A1346E6f1D7267b1' as Address

/** A well-formed record: `[expiry, recipient, actionId, actionNullifier, issuerAddress]`. */
function record(over: Partial<SbtRecord> & { expiry: number }): SbtRecord {
  return {
    revoked: false,
    publicValues: [BigInt(over.expiry), BigInt(SUBJECT), 123_456_789n, 999n, GOV_ID.issuer],
    ...over,
  }
}

describe('Holonym SBT interpretation', () => {
  test('no SBT is an absence, not an error and not a date', () => {
    for (const r of [undefined, { expiry: 0, revoked: false }]) {
      const v = interpretSbt(GOV_ID, r, NOW)
      assert.equal(v.held, false)
      assert.equal(v.detail['sbt'], 'none')
      assert.equal(v.issuedAt, undefined)
    }
  })

  test('a revoked SBT is not held, and says so rather than expiring quietly', () => {
    // The Hub's owner can revoke, and `getSBT` then reverts with the same message it uses for
    // an expiry — so the raw mapping is the only thing that can tell a caller which happened.
    const v = interpretSbt(GOV_ID, { expiry: NOW + 1000, revoked: true }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['sbt'], 'revoked')
  })

  test('an expired SBT is not held, and is reported as expired rather than missing', () => {
    const v = interpretSbt(GOV_ID, record({ expiry: NOW - 1 }), NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['sbt'], 'expired')
    assert.equal(v.detail['expiredAt'], NOW - 1)
  })

  test('an SBT signed by somebody else’s issuer is not evidence', () => {
    // The Hub's own source warns about exactly this: the circuit proves *an* issuer signed the
    // credential, and anyone can run an issuer key. Presence under the right circuit id is not
    // enough, which is why the probe pins `publicValues[4]`.
    const forged = record({ expiry: NOW + 1000 })
    const pv = [...forged.publicValues!]
    pv[4] = 0x1234n
    const v = interpretSbt(GOV_ID, { ...forged, publicValues: pv }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['sbt'], 'issuer-mismatch')
    assert.equal(v.detail['issuerInProof'], `0x${'0'.repeat(60)}1234`)
  })

  test('a valid SBT is dated at the earliest issuance its circuit permits', () => {
    const expiry = NOW + 10_000
    const v = interpretSbt(GOV_ID, record({ expiry }), NOW)
    assert.equal(v.held, true)
    // V3.circom constrains expiry - iat < 31,536,001, so this is a proven lower bound on
    // issuance and therefore an upper bound on age: the direction that cannot inflate a decay
    // weight.
    assert.equal(v.issuedAt, expiry - HOLONYM_MAX_CREDENTIAL_TERM_SECONDS)
    assert.equal(v.detail['actionId'], '123456789')
    assert.equal(v.detail['actionIdIsHolonymDefault'], true)
    assert.equal(v.detail['expiresAt'], expiry)
  })

  test('a credential minted for another action still counts, and names its namespace', () => {
    // Uniqueness is scoped per action-id, so this SBT does not dedup against the default
    // namespace — but the issuer still signed the same document check, which is the evidence.
    const r = record({ expiry: NOW + 10_000 })
    const pv = [...r.publicValues!]
    pv[2] = 7n
    const v = interpretSbt(GOV_ID, { ...r, publicValues: pv }, NOW)
    assert.equal(v.held, true)
    assert.equal(v.detail['actionId'], '7')
    assert.equal(v.detail['actionIdIsHolonymDefault'], false)
  })

  test('when the stored expiry and the proof disagree, the earlier one wins', () => {
    // `setSBT` takes the expiry as an argument and the proof carries its own in publicValues[0];
    // nothing on chain forces them to match. The earlier expiry is the older issuance and so
    // the lower weight, which is the side to be wrong on.
    const r = record({ expiry: NOW + 20_000 })
    const pv = [...r.publicValues!]
    pv[0] = BigInt(NOW + 5_000)
    const v = interpretSbt(GOV_ID, { ...r, publicValues: pv }, NOW)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, NOW + 5_000 - HOLONYM_MAX_CREDENTIAL_TERM_SECONDS)
    assert.equal(v.detail['expiryDisagreesWithProof'], true)
  })

  test('an expiry beyond the circuit’s ceiling costs the date, not the credential', () => {
    // Only reachable if Holonym changed the constraint. The date would then imply an issuance
    // in the future, so it is dropped — a credential with no date beats a credential dated
    // fresher than it can possibly be.
    const v = interpretSbt(GOV_ID, record({ expiry: NOW + HOLONYM_MAX_CREDENTIAL_TERM_SECONDS + 60 }), NOW)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, undefined)
  })

  test('a truncated public-values array is unreadable, never a pass', () => {
    const v = interpretSbt(GOV_ID, { expiry: NOW + 1000, revoked: false, publicValues: [1n, 2n] }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['sbt'], 'public-values-unreadable')
  })

  test('the identifier is keyed on bytes, so address casing cannot fork it', () => {
    // A checksummed and a lowercase address are the same 20 bytes. If they hashed differently
    // a subject would silently lose their credential depending on how they pasted it.
    assert.equal(
      holonymIdentifier(SUBJECT, GOV_ID.circuitId),
      holonymIdentifier(SUBJECT.toLowerCase() as Address, GOV_ID.circuitId),
    )
    assert.notEqual(
      holonymIdentifier(SUBJECT, GOV_ID.circuitId),
      holonymIdentifier(SUBJECT, HOLONYM_CREDENTIALS['holonym-biometrics']!.circuitId),
    )
  })
})
