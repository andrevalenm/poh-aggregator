/**
 * Linea PoH V2 — the parts that decide a score, without a network.
 *
 * The adapter's claim is that it enumerates the *complete* live population, so the two things
 * worth testing offline are the arithmetic that bounds the enumeration (`ladderIds`,
 * `floorFromLadder`) and the judgement about which attestations count (`selectLivePoh`).
 * Everything in the second one is a way for somebody else's attestation, or an expired one, or
 * a revoked one, to be counted as a person — which is the failure mode that matters here.
 *
 * Run: node --test --experimental-strip-types src/adapters/linea-poh.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  floorFromLadder,
  idToBytes32,
  ladderIds,
  LINEA_POH_LADDER_STEPS,
  LINEA_POH_MAX_TERM_SECONDS,
  LINEA_POH_V2_SCHEMA,
  selectLivePoh,
  subjectToAddress,
  SUMSUB_POH_PORTAL,
  SUMSUB_PORTAL_OWNER,
  type LineaPohPortalCheck,
  type RawAttestation,
} from './linea-poh.ts'
import type { Address } from '../types.ts'

const NOW = 1_784_985_000
const SUBJECT = '0x9035b33dc075b3bf1ab71e81fdbdd20be52bfa1b' as Address
const OTHER = '0x18eb39edae803ee4fb5e4fc0e421b1a8ca4667b6' as Address
const SUMSUB_SIGNER = '0xC5db96C1348041c56e455d4cc92BB46027831C0d' as Address
const FOREIGN_PORTAL = '0x0101010101010101010101010101010101010101' as Address
const ZERO32 = `0x${'0'.repeat(64)}` as const

function attestation(over: Partial<RawAttestation> = {}): RawAttestation {
  const attestedDate = over.attestedDate ?? NOW - 86_400
  const expirationDate = over.expirationDate ?? attestedDate + 7_776_000
  return {
    attestationId: idToBytes32(6_366_000),
    schemaId: LINEA_POH_V2_SCHEMA,
    subject: SUBJECT,
    attestedDate,
    expirationDate,
    termSeconds: expirationDate - attestedDate,
    revocationDate: 0,
    portal: SUMSUB_POH_PORTAL,
    attester: SUMSUB_SIGNER,
    version: 10,
    revoked: false,
    replacedBy: ZERO32,
    ...over,
  }
}

function portals(over: Partial<LineaPohPortalCheck> = {}): Map<string, LineaPohPortalCheck> {
  const sumsub: LineaPohPortalCheck = {
    portal: SUMSUB_POH_PORTAL,
    ownerAddress: SUMSUB_PORTAL_OWNER,
    ownerName: 'Sumsub',
    ownerIsSumsub: true,
    ownerIsRegisteredIssuer: true,
    signerAddress: SUMSUB_SIGNER,
    modules: [],
    ...over,
  }
  return new Map([
    [SUMSUB_POH_PORTAL.toLowerCase(), sumsub],
    [
      FOREIGN_PORTAL.toLowerCase(),
      {
        portal: FOREIGN_PORTAL,
        // The point of the test: a portal is free to claim the name.
        ownerAddress: '0x0202020202020202020202020202020202020202' as Address,
        ownerName: 'Sumsub',
        ownerIsSumsub: false,
        ownerIsRegisteredIssuer: true,
        modules: [],
      },
    ],
  ])
}

describe('the id range the enumeration reads', () => {
  test('the ladder is strictly decreasing, doubling, and never reaches below the first id', () => {
    const rungs = ladderIds(6_366_748)
    assert.equal(rungs.length, LINEA_POH_LADDER_STEPS + 1)
    assert.deepEqual(rungs.slice(0, 4), [6_366_747, 6_366_746, 6_366_744, 6_366_740])
    for (let i = 1; i < rungs.length; i++) assert.ok(rungs[i]! < rungs[i - 1]!)
    assert.ok(rungs.every((r) => r >= 1))
  })

  test('a registry smaller than the ladder stops at its own bottom rather than going negative', () => {
    assert.deepEqual(ladderIds(5), [4, 3, 1])
    assert.deepEqual(ladderIds(1), [])
  })

  test('the floor is the nearest rung old enough that nothing below it can still be live', () => {
    // Rungs are probed nearest-first, so the first one predating the cutoff is the tightest.
    const rungs = [
      { id: 900, attestedDate: NOW - 10 },
      { id: 800, attestedDate: NOW - 1_000 },
      { id: 600, attestedDate: NOW - 9_000_000 },
      { id: 200, attestedDate: NOW - 20_000_000 },
    ]
    assert.equal(floorFromLadder(rungs, NOW - LINEA_POH_MAX_TERM_SECONDS), 600)
  })

  test('a rung that does not exist bounds the range, because nothing below it exists either', () => {
    const rungs = [
      { id: 900, attestedDate: NOW - 10 },
      { id: 800 },
      { id: 600, attestedDate: NOW - 9_000_000 },
    ]
    assert.equal(floorFromLadder(rungs, NOW - LINEA_POH_MAX_TERM_SECONDS), 800)
  })

  test('a ladder where every rung is too new scans from the bottom instead of truncating', () => {
    // Silently returning the oldest rung would drop live attestations below it and report a
    // clean negative. Scanning from 1 is expensive and correct.
    const rungs = [
      { id: 900, attestedDate: NOW - 10 },
      { id: 800, attestedDate: NOW - 20 },
    ]
    assert.equal(floorFromLadder(rungs, NOW - LINEA_POH_MAX_TERM_SECONDS), 1)
  })
})

describe('a Verax subject is not always an address', () => {
  test('20 bytes is an address, lowercased so the population map has one key per subject', () => {
    assert.equal(
      subjectToAddress('0x9035B33DC075B3BF1AB71E81FDBDD20BE52BFA1B'),
      '0x9035b33dc075b3bf1ab71e81fdbdd20be52bfa1b',
    )
  })

  test('anything else is dropped rather than coerced into an address that was never attested', () => {
    assert.equal(subjectToAddress(`0x${'ab'.repeat(32)}`), undefined)
    assert.equal(subjectToAddress('0x'), undefined)
    assert.equal(subjectToAddress('0xdeadbeef'), undefined)
  })
})

describe('which attestations count as a live credential', () => {
  test('a current attestation from the Sumsub portal is held, dated by attestedDate', () => {
    const a = attestation()
    const s = selectLivePoh([a], portals(), NOW)
    assert.equal(s.liveAttestations, 1)
    assert.equal(s.bySubject.size, 1)
    assert.equal(s.bySubject.get(SUBJECT)![0]!.attestedDate, a.attestedDate)
    assert.equal(s.rejectedForPortalOwner, 0)
    assert.equal(s.attesterNotPortalSigner, 0)
  })

  test('another schema in the same id range is not this credential', () => {
    const s = selectLivePoh([attestation({ schemaId: `0x${'11'.repeat(32)}` })], portals(), NOW)
    assert.equal(s.attestationsInRange, 0)
    assert.equal(s.liveAttestations, 0)
  })

  test('an expired attestation is not held — the whole point of the 90-day term', () => {
    const s = selectLivePoh([attestation({ expirationDate: NOW - 1 })], portals(), NOW)
    assert.equal(s.liveAttestations, 0)
    assert.equal(s.bySubject.size, 0)
    assert.equal(s.attestationsInRange, 1)
  })

  test('an attestation expiring exactly now is not held', () => {
    // Every on-chain consumer compares against `block.timestamp` with the same strictness.
    assert.equal(selectLivePoh([attestation({ expirationDate: NOW })], portals(), NOW).liveAttestations, 0)
  })

  test('a revoked attestation is counted as a revocation and not as a person', () => {
    const s = selectLivePoh([attestation({ revoked: true })], portals(), NOW)
    assert.equal(s.revokedInRange, 1)
    assert.equal(s.liveAttestations, 0)
    assert.equal(s.bySubject.size, 0)
  })

  test('a foreign portal cannot mint personhood by writing under the schema', () => {
    // Verax lets any registered portal write under any schema, so this is the check that
    // decides whether an attacker with a portal can name themselves human.
    const s = selectLivePoh([attestation({ portal: FOREIGN_PORTAL })], portals(), NOW)
    assert.equal(s.liveAttestations, 0)
    assert.equal(s.rejectedForPortalOwner, 1)
  })

  test('a portal nobody could look up is rejected, not trusted by default', () => {
    const s = selectLivePoh(
      [attestation({ portal: '0x0303030303030303030303030303030303030303' as Address })],
      portals(),
      NOW,
    )
    assert.equal(s.liveAttestations, 0)
    assert.equal(s.rejectedForPortalOwner, 1)
  })

  test('a rotated attester is reported and still counted, because a rotation is not a revocation', () => {
    const s = selectLivePoh(
      [attestation({ attester: '0x0404040404040404040404040404040404040404' as Address })],
      portals(),
      NOW,
    )
    assert.equal(s.attesterNotPortalSigner, 1)
    assert.equal(s.liveAttestations, 1)
  })

  test('an early renewal yields the newest attestation, which is the fresher Sumsub check', () => {
    const older = attestation({ attestedDate: NOW - 80 * 86_400, attestationId: idToBytes32(1) })
    const newer = attestation({ attestedDate: NOW - 2 * 86_400, attestationId: idToBytes32(2) })
    for (const order of [[older, newer], [newer, older]]) {
      const s = selectLivePoh(order, portals(), NOW)
      assert.equal(s.liveAttestations, 2)
      assert.equal(s.bySubject.size, 1)
      assert.equal(s.bySubject.get(SUBJECT)![0]!.attestedDate, newer.attestedDate)
    }
  })

  test('two subjects are two entries, and liveAttestations counts credentials not people', () => {
    const s = selectLivePoh(
      [attestation(), attestation({ subject: OTHER }), attestation({ attestedDate: NOW - 100 })],
      portals(),
      NOW,
    )
    assert.equal(s.liveAttestations, 3)
    assert.equal(s.bySubject.size, 2)
  })

  test('maxTermSeconds spans every attestation on the schema, including the dead ones', () => {
    // It is the number the window's completeness rests on, so an expired outlier still has to
    // widen the window next time — otherwise a term change would first be noticed as a gap.
    const s = selectLivePoh(
      [
        attestation(),
        attestation({ attestedDate: NOW - 200 * 86_400, expirationDate: NOW - 100 * 86_400 }),
      ],
      portals(),
      NOW,
    )
    assert.equal(s.maxTermSeconds, 100 * 86_400)
  })

  test('a portal that exposes no signer is still usable — the owner is the anchor', () => {
    const p = portals()
    delete p.get(SUMSUB_POH_PORTAL.toLowerCase())!.signerAddress
    const s = selectLivePoh([attestation()], p, NOW)
    assert.equal(s.liveAttestations, 1)
    assert.equal(s.attesterNotPortalSigner, 0)
  })
})

/**
 * The other half of the same decision: a credential that has ended is a *closed window*, and a
 * closed window is what puts a credential back into a historical score. Every branch here is a
 * way to hand somebody time they did not have, which runs in the adversary's direction — so the
 * refusals matter more than the acceptance.
 */
describe('which endings close a window an as-of score can use', () => {
  const ended = (over: Partial<RawAttestation> = {}) =>
    selectLivePoh([attestation(over)], portals(), NOW).endedBySubject.get(SUBJECT)?.[0]

  test('an expired attestation keeps both of its dates: attested to expiry', () => {
    const a = attestation({ attestedDate: NOW - 100 * 86_400, expirationDate: NOW - 10 * 86_400 })
    const s = selectLivePoh([a], portals(), NOW)
    assert.equal(s.endedAttestations, 1)
    assert.equal(s.endedUndated, 0)
    const w = s.endedBySubject.get(SUBJECT)![0]!
    assert.equal(w.attestedDate, a.attestedDate)
    assert.equal(w.endedAt, a.expirationDate)
    assert.equal(w.revoked, false)
    // And it is emphatically not held: the window exists precisely because the credential is gone.
    assert.equal(s.liveAttestations, 0)
    assert.equal(s.bySubject.size, 0)
  })

  test('a revocation before the term ends is the ending, because that is when it stopped counting', () => {
    const w = ended({
      attestedDate: NOW - 100 * 86_400,
      revoked: true,
      revocationDate: NOW - 40 * 86_400,
      expirationDate: NOW - 10 * 86_400,
    })
    assert.equal(w?.endedAt, NOW - 40 * 86_400)
    assert.equal(w?.revoked, true)
  })

  test('a revocation after the term ends does not extend the window past the expiry', () => {
    // Verax lets an already-dead attestation be revoked. Taking the revocation date there would
    // credit the subject with the weeks between, which they did not have.
    const w = ended({
      attestedDate: NOW - 120 * 86_400,
      revoked: true,
      revocationDate: NOW - 5 * 86_400,
      expirationDate: NOW - 30 * 86_400,
    })
    assert.equal(w?.endedAt, NOW - 30 * 86_400)
  })

  test('a revocation with no date closes nothing — the expiry is only an upper bound on it', () => {
    // Iteration 16's rule in the direction it bites: restoring against a bound would hand the
    // subject every day between the real revocation and the expiry.
    const s = selectLivePoh(
      [attestation({ revoked: true, revocationDate: 0, expirationDate: NOW - 10 * 86_400 })],
      portals(),
      NOW,
    )
    assert.equal(s.endedBySubject.size, 0)
    assert.equal(s.endedAttestations, 0)
    assert.equal(s.endedUndated, 1)
  })

  test('a foreign portal gets no window either, because it never had a credential to end', () => {
    const s = selectLivePoh(
      [attestation({ portal: FOREIGN_PORTAL, expirationDate: NOW - 10 })],
      portals(),
      NOW,
    )
    assert.equal(s.endedBySubject.size, 0)
    assert.equal(s.rejectedForPortalOwner, 1)
  })

  test('an inverted or empty window is refused rather than reported backwards', () => {
    const s = selectLivePoh(
      [attestation({ attestedDate: NOW - 10 * 86_400, expirationDate: NOW - 20 * 86_400 })],
      portals(),
      NOW,
    )
    assert.equal(s.endedBySubject.size, 0)
    assert.equal(s.endedUndated, 1)
  })

  test('a revoked attestation whose revocation predates its own attestation closes nothing', () => {
    const s = selectLivePoh(
      [attestation({ attestedDate: NOW - 10 * 86_400, revoked: true, revocationDate: NOW - 20 * 86_400 })],
      portals(),
      NOW,
    )
    assert.equal(s.endedBySubject.size, 0)
    assert.equal(s.endedUndated, 1)
  })

  test('a live attestation is never handed a window, whatever else the subject holds', () => {
    const s = selectLivePoh([attestation()], portals(), NOW)
    assert.equal(s.endedBySubject.size, 0)
    assert.equal(s.endedAttestations, 0)
  })

  test('a subject who lapsed and renewed appears in both maps, and the ending is still true', () => {
    const dead = attestation({
      attestedDate: NOW - 200 * 86_400,
      expirationDate: NOW - 110 * 86_400,
      attestationId: idToBytes32(1),
    })
    const alive = attestation({ attestedDate: NOW - 5 * 86_400, attestationId: idToBytes32(2) })
    const s = selectLivePoh([dead, alive], portals(), NOW)
    assert.equal(s.bySubject.size, 1)
    assert.equal(s.endedBySubject.size, 1)
    assert.equal(s.endedBySubject.get(SUBJECT)![0]!.endedAt, dead.expirationDate)
  })

  test('several closed windows are ordered latest ending first', () => {
    const older = attestation({
      attestedDate: NOW - 300 * 86_400,
      expirationDate: NOW - 210 * 86_400,
      attestationId: idToBytes32(1),
    })
    const newer = attestation({
      attestedDate: NOW - 150 * 86_400,
      expirationDate: NOW - 60 * 86_400,
      attestationId: idToBytes32(2),
    })
    for (const order of [[older, newer], [newer, older]]) {
      const s = selectLivePoh(order, portals(), NOW)
      assert.equal(s.endedBySubject.get(SUBJECT)!.length, 2)
      assert.equal(s.endedBySubject.get(SUBJECT)![0]!.endedAt, newer.expirationDate)
    }
  })
})
