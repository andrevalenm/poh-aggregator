/**
 * The issuer pin, the parts that need no network.
 *
 * The census turns three questions into pure functions — which logs name a holder, what the
 * observations add up to, and what that says about the pin — and each is exercised here against
 * inputs the chain would take a rotation, or a broken endpoint, to produce.
 *
 * The refusals matter more than the confirmations, in both directions. A census that reports
 * "corroborated" from a sample that contained nothing would quietly retire the check; a probe that
 * refuses a real credential without saying so is the defect this file exists to close.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  HOLONYM_ISSUER_CENSUS_BLOCKS,
  issuerHex,
  issuerPinVerdict,
  mintHoldersFromLogs,
  tallyIssuers,
  TRANSFER_TOPIC,
  type IssuerCensus,
  type IssuerObservation,
} from './holonym-issuer.ts'
import { applyIssuerCensus, HOLONYM_CREDENTIALS, interpretSbt } from './holonym.ts'
import type { ProvenanceNote } from '../reconcile.ts'

const GOV = HOLONYM_CREDENTIALS['holonym-gov-id']!
const BIO = HOLONYM_CREDENTIALS['holonym-biometrics']!
/** A key nobody pins — the shape a self-issued credential, or a rotation, arrives in. */
const STRANGER = 0x0040b8810cbaed9647b54d18cc98b720e1e8876be5d8e7089d3c079fc61c30a4n

const ZERO = `0x${'0'.repeat(64)}`
const asTopic = (a: string) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`
const HOLDER = '0x17f0b0bd6a91339f1f02a1594286e14466d55acc'
const OTHER_HOLDER = '0xb8e2fcdfac8bae28331f0ecd8d334f080f15c9a5'

const mintLog = (to: string) => ({ topics: [TRANSFER_TOPIC, ZERO, asTopic(to), `0x${'0'.repeat(63)}1`] })

const meta = { headBlock: 154_715_253, fromBlock: 154_685_254, holders: 9 }
const census = (observations: readonly IssuerObservation[]): IssuerCensus =>
  tallyIssuers(observations, meta)
const obs = (adapterId: string, issuer: bigint, n: number): IssuerObservation[] =>
  Array.from({ length: n }, () => ({ adapterId, issuer }))

describe('which logs name someone who was issued a credential', () => {
  test('a mint Transfer names its holder, once, in the order first seen', () => {
    const holders = mintHoldersFromLogs([mintLog(HOLDER), mintLog(OTHER_HOLDER), mintLog(HOLDER)])
    assert.deepEqual(holders, [HOLDER, OTHER_HOLDER])
  })

  test('a transfer that is not a mint names nobody', () => {
    // `from` is a real address: this is a resale or a move, not an issuance, and the address on
    // the receiving end was never issued anything by anybody.
    assert.deepEqual(
      mintHoldersFromLogs([{ topics: [TRANSFER_TOPIC, asTopic(OTHER_HOLDER), asTopic(HOLDER), ZERO] }]),
      [],
    )
  })

  test('an endpoint that ignores the topic filter cannot put a stranger in the census', () => {
    // Measured, not hypothetical: viem's `getLogs` action drops a caller-supplied `topics` array
    // and the request goes out unfiltered, so a log from an entirely different event arrives
    // looking like an answer. Every condition is therefore re-checked here.
    const unrelated = { topics: ['0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7'] }
    const wrongArity = { topics: [TRANSFER_TOPIC, ZERO, asTopic(HOLDER)] }
    const noTopics = {}
    assert.deepEqual(mintHoldersFromLogs([unrelated, wrongArity, noTopics, mintLog(HOLDER)]), [HOLDER])
  })

  test('a mint to the zero address is not a holder', () => {
    assert.deepEqual(mintHoldersFromLogs([{ topics: [TRANSFER_TOPIC, ZERO, ZERO, ZERO] }]), [])
  })
})

describe('what the observations add up to', () => {
  test('issuers are tallied per credential class, commonest first', () => {
    const c = census([
      ...obs('holonym-gov-id', GOV.issuer, 6),
      ...obs('holonym-gov-id', STRANGER, 2),
      ...obs('holonym-biometrics', BIO.issuer, 4),
    ])
    assert.deepEqual(c.byCredential['holonym-gov-id'], [
      { issuer: issuerHex(GOV.issuer), count: 6 },
      { issuer: issuerHex(STRANGER), count: 2 },
    ])
    assert.equal(c.credentials, 12)
    assert.equal(c.fromBlock, meta.fromBlock)
    assert.equal(c.headBlock, meta.headBlock)
  })

  test('the control: an issuer that appears in two classes means the field is not discriminating', () => {
    // A pin that everything satisfies is worth nothing. The two scored circuits carry different
    // keys on the real chain, and this is the run's own evidence of it — so the case that would
    // hollow out the check has to be visible when it happens.
    assert.equal(census([...obs('a', GOV.issuer, 3), ...obs('b', BIO.issuer, 3)]).discriminates, true)
    assert.equal(census([...obs('a', GOV.issuer, 3), ...obs('b', GOV.issuer, 3)]).discriminates, false)
  })

  test('one class alone cannot answer the control question, and does not pretend to', () => {
    assert.equal(census(obs('holonym-gov-id', GOV.issuer, 8)).discriminates, undefined)
  })
})

describe('what the census says about the pin', () => {
  test('the pinned key alone is a corroborated pin', () => {
    const v = issuerPinVerdict(census(obs('holonym-gov-id', GOV.issuer, 6)), GOV, 'holonym-gov-id')
    assert.deepEqual(v, { status: 'corroborated', observed: 6, matchingPin: 6, unpinned: [] })
  })

  test('a second key beside the pin means real holders are being refused', () => {
    const v = issuerPinVerdict(
      census([...obs('holonym-gov-id', GOV.issuer, 6), ...obs('holonym-gov-id', STRANGER, 2)]),
      GOV,
      'holonym-gov-id',
    )
    assert.equal(v.status, 'unpinned-issuer-in-use')
    assert.equal(v.matchingPin, 6)
    assert.deepEqual(v.unpinned, [{ issuer: issuerHex(STRANGER), count: 2 }])
  })

  test('the class in use and the pin absent from it is a stale pin, not a quiet pass', () => {
    const v = issuerPinVerdict(census(obs('holonym-gov-id', STRANGER, 5)), GOV, 'holonym-gov-id')
    assert.equal(v.status, 'pin-not-in-use')
    assert.equal(v.matchingPin, 0)
    assert.equal(v.observed, 5)
  })

  test('a class the sample never saw is uncorroborated, never corroborated', () => {
    // The whole point. An empty sample and a confirming sample must not produce the same word:
    // sparse classes produce this routinely and a rotation produces it too, and neither is
    // evidence about anybody.
    const other = census(obs('holonym-biometrics', BIO.issuer, 4))
    assert.equal(issuerPinVerdict(other, GOV, 'holonym-gov-id').status, 'uncorroborated')
    assert.equal(issuerPinVerdict(undefined, GOV, 'holonym-gov-id').status, 'uncorroborated')
  })

  test('the pin is compared numerically, so a differently written key is the same key', () => {
    // These are 254-bit Poseidon hashes that Holonym calls addresses; a leading zero drops off
    // whenever one is written by hand. Comparing the rendered strings would refuse every gov-id
    // credential on the chain, since that key is exactly the kind that starts with one.
    assert.ok(issuerHex(GOV.issuer).startsWith('0x03'))
    assert.equal(issuerHex(GOV.issuer).length, 66)
    assert.equal(
      issuerPinVerdict(census(obs('holonym-gov-id', BigInt(issuerHex(GOV.issuer)), 3)), GOV, 'holonym-gov-id')
        .status,
      'corroborated',
    )
  })
})

describe('what the score is told', () => {
  const apply = (c: IssuerCensus | undefined) => {
    const notes: ProvenanceNote[] = []
    const detail: Record<string, unknown> = {}
    applyIssuerCensus(c, GOV, 'holonym-gov-id', notes, detail)
    return { notes, detail }
  }

  test('a corroborated pin is silent, and still shows its working', () => {
    const { notes, detail } = apply(census([...obs('holonym-gov-id', GOV.issuer, 6), ...obs('holonym-biometrics', BIO.issuer, 4)]))
    assert.deepEqual(notes, [])
    assert.equal(detail['issuerPinStatus'], 'corroborated')
    assert.equal(detail['issuerPin'], issuerHex(GOV.issuer))
    assert.equal(detail['issuerPinObserved'], 6)
    assert.equal(detail['issuerCensusDiscriminates'], true)
  })

  test('an unpinned key in use is a caveat, and names the keys', () => {
    const { notes, detail } = apply(
      census([...obs('holonym-gov-id', GOV.issuer, 6), ...obs('holonym-gov-id', STRANGER, 2)]),
    )
    assert.deepEqual(notes, ['attestation-issuer-unpinned-in-use'])
    assert.deepEqual(detail['unpinnedIssuers'], [{ issuer: issuerHex(STRANGER), count: 2 }])
  })

  test('a stale pin raises the same caveat, because the consequence is the same', () => {
    const { notes, detail } = apply(census(obs('holonym-gov-id', STRANGER, 5)))
    assert.deepEqual(notes, ['attestation-issuer-unpinned-in-use'])
    assert.equal(detail['issuerPinStatus'], 'pin-not-in-use')
    assert.equal(detail['issuerPinMatching'], 0)
  })

  test('a census that did not run says so, and reports no counts it does not have', () => {
    const { notes, detail } = apply(undefined)
    assert.deepEqual(notes, ['attestation-issuer-uncorroborated'])
    assert.equal(detail['issuerPinStatus'], 'uncorroborated')
    assert.equal(detail['issuerPinObserved'], undefined)
    assert.equal(detail['issuerCensusFromBlock'], undefined)
  })
})

describe('a credential this package refuses', () => {
  const now = 1_800_000_000
  const record = (issuer: bigint) => ({
    expiry: now + 86_400,
    revoked: false,
    publicValues: [BigInt(now + 86_400), 1n, 123_456_789n, 42n, issuer],
  })

  test('an SBT under a stranger’s key is refused, and the refusal is flagged', () => {
    const v = interpretSbt(GOV, record(STRANGER), now)
    assert.equal(v.held, false)
    assert.equal(v.issuerMismatch, true)
    assert.equal(v.detail['sbt'], 'issuer-mismatch')
    assert.equal(v.detail['issuerInProof'], issuerHex(STRANGER))
    assert.equal(v.detail['expectedIssuer'], issuerHex(GOV.issuer))
  })

  test('every other way of not holding is not a refusal, and must not be reported as one', () => {
    // The distinction the flag exists for: these subjects hold nothing, and only the mismatch
    // above means the subject holds something we chose not to count.
    for (const r of [
      undefined,
      { expiry: 0, revoked: false },
      { expiry: now + 10, revoked: true },
      { expiry: now - 10, revoked: false },
      { expiry: now + 10, revoked: false, publicValues: [1n, 2n] },
    ]) {
      const v = interpretSbt(GOV, r, now)
      assert.equal(v.held, false)
      assert.equal(v.issuerMismatch, undefined, JSON.stringify(v.detail))
    }
  })

  test('the pinned key is still held, and carries no refusal', () => {
    const v = interpretSbt(GOV, record(GOV.issuer), now)
    assert.equal(v.held, true)
    assert.equal(v.issuerMismatch, undefined)
  })

  test('the window is a window, and the module says how wide', () => {
    assert.equal(HOLONYM_ISSUER_CENSUS_BLOCKS, 30_000)
  })
})
