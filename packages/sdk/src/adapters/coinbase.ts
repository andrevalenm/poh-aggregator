import { createPublicClient, http, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import type { ProbeProvenance } from '../reconcile.ts'

/**
 * Coinbase Verified Account, read from Base with no vendor on the critical path.
 *
 * ## What changed, and why it mattered
 *
 * This probe used to POST a GraphQL query to `base.easscan.org`. That made it the one adapter
 * in the repo contradicting the rule the other eight are built on: a hosted endpoint we do not
 * run, which can rate-limit us, change its schema, or disappear, sitting between a subject and
 * their score. It is also the *only* kind of dependency an adversary can attack from outside
 * the chain — degrade the endpoint and every Coinbase-verified subject silently loses a trust
 * root, which on a five-root subject is a real move in the score.
 *
 * The obvious replacement — scan `Attested` logs ourselves — does not survive contact with
 * Base. A recipient-filtered `eth_getLogs` over the full 49.1M-block history takes 14s across
 * the most recent 5M blocks and **times out past 20M** on the only keyless endpoint that serves
 * archive logs at all (measured 2026-07-25; `base-rpc.publicnode.com` refuses archive log
 * ranges outright). A scoring request cannot pay that, and a probe that only scans the recent
 * window would report `held: false` for everyone verified before it.
 *
 * ## The read that does work
 *
 * Coinbase's attester writes each attestation's uid into an **on-chain index** keyed by
 * `(recipient, schemaUID)`, so the enumeration problem the EAS core contract does not solve is
 * solved by the issuer itself, on chain, for free. Two `eth_call`s and it is done:
 *
 *   1. `AttestationIndexer.getAttestationUid(subject, schema)` → the uid, or zero.
 *   2. `EAS.getAttestation(uid)` → the record: issuance time, revocation time, expiry,
 *      recipient, schema, attester.
 *
 * **The indexer is only a pointer; EAS is the truth.** The indexer is a 209-byte proxy Coinbase
 * controls and can upgrade, so nothing it says is taken on faith: every field that decides the
 * answer — schema, recipient, date, revocation — is read from the EAS predeploy at
 * `0x4200…0021`, and a record that does not match the uid asked for, the schema asked for, or
 * the subject asked for is reported as an **error rather than a negative**. The worst an
 * upgraded indexer can do is point us at an attestation that fails those checks, and that is
 * loud.
 *
 * ## What is measured, not assumed
 *
 * - **Coverage.** 20 of 20 attestations sampled from `Attested` logs across Base's history —
 *   Jan 2024, Apr 2025, and three 2026 windows — resolve through the indexer, and in every case
 *   the uid it returns is the uid in the log. The live suite re-samples this from the chain
 *   rather than trusting the number.
 * - **The gate.** `SchemaRegistry.getSchema` gives this schema a non-zero resolver
 *   (`0xD867CbEd…F32f`), which is the mechanism behind Coinbase's claim that only their
 *   attesters may use it, and **18,655 attestations sampled across six windows spanning the
 *   chain carry exactly one attester** (`0x357458739F…d7EE`). So the schema id is load-bearing
 *   and the probe does not additionally pin an attester address it would have to chase.
 * - **Revocation.** 5,143 revocations in the same sample. Presence is not the credential;
 *   `revocationTime` is checked on every read, which is the reason the record is fetched at all
 *   rather than stopping at the indexer's non-zero uid.
 *
 * ## The one honest limit
 *
 * An attestation Coinbase issued but did not index reads as absent. We could not produce such a
 * case, but the failure direction is the safe one: a missing credential lowers a score and can
 * never inflate one, and it is the same direction as every other adapter's negatives. The
 * indexer is Coinbase's own contract for their own credential, so an unindexed attestation is a
 * fault in the issuer's pipeline, not something an adversary can arrange for someone else.
 *
 * ## Why the two reads are not pinned to one block
 *
 * They are taken at head, not at a fixed block, because the keyless Base endpoints keep only
 * ~128 blocks of state (`head-200` is already an archive request) and a pinned read against a
 * load-balanced node that is one block behind fails outright. Nothing is lost: an EAS
 * attestation is immutable once written, so the only field that can move between the two calls
 * is `revocationTime`, and reading it a moment later reads it *fresher*. The single torn read
 * available — the subject is revoked and re-attested between call one and call two — resolves
 * to `held: false` for one block, in the safe direction.
 */

/** EAS core, an OP-Stack predeploy: same address on Base, Optimism and every OP chain. */
export const EAS_PREDEPLOY = '0x4200000000000000000000000000000000000021' as const

/** EAS schema registry predeploy. Only the live suite reads it, to assert the resolver gate. */
export const EAS_SCHEMA_REGISTRY_PREDEPLOY = '0x4200000000000000000000000000000000000020' as const

/**
 * Coinbase's attestation indexer on Base, from `coinbase/verifications`. Verified live: it
 * answers `getAttestationUid` for known recipients and returns zero for an address with no
 * attestation.
 */
export const COINBASE_ATTESTATION_INDEXER =
  '0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C' as const

/** `bool verifiedAccount`, per the schema registry read live. */
export const COINBASE_VERIFIED_ACCOUNT_SCHEMA =
  '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as const

/** base.org returns 403 to non-browser clients; publicnode does not. */
export const COINBASE_RPC = 'https://base-rpc.publicnode.com'

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const

export const COINBASE_INDEXER_ABI = [
  {
    type: 'function',
    name: 'getAttestationUid',
    stateMutability: 'view',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'schemaUid', type: 'bytes32' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

export const EAS_ABI = [
  {
    type: 'function',
    name: 'getAttestation',
    stateMutability: 'view',
    inputs: [{ name: 'uid', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'uid', type: 'bytes32' },
          { name: 'schema', type: 'bytes32' },
          { name: 'time', type: 'uint64' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'revocationTime', type: 'uint64' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'recipient', type: 'address' },
          { name: 'attester', type: 'address' },
          { name: 'revocable', type: 'bool' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
  },
] as const

/** The EAS record, as the contract returns it. */
export interface EasAttestation {
  uid: `0x${string}`
  schema: `0x${string}`
  time: bigint
  expirationTime: bigint
  revocationTime: bigint
  refUID: `0x${string}`
  recipient: Address
  attester: Address
  revocable: boolean
  data: `0x${string}`
}

export interface CoinbaseVerificationRead {
  /** Chain head the reads were taken at. */
  block: number
  /** Wall clock in unix seconds, for the expiry check. */
  now: number
  subject: Address
  /** What the indexer returned for `(subject, schema)`. Zero means it knows of none. */
  uid: `0x${string}`
  /** The EAS record for that uid. Absent only when `uid` was zero. */
  attestation?: EasAttestation
}

/**
 * The whole decision, with no network in it.
 *
 * Three of these branches are the difference between a credential and a number that looks like
 * one: a revoked attestation is still returned by the indexer, an expired one is still a valid
 * record, and a record whose recipient is not the subject is a fault rather than a credential.
 */
export function interpretCoinbaseVerification(read: CoinbaseVerificationRead): AdapterProbeResult {
  const provenance: ProbeProvenance = {
    heldFrom: 'chain',
    dateFrom: 'none',
    headBlock: read.block,
    notes: [],
  }
  const indexer = COINBASE_ATTESTATION_INDEXER

  if (read.uid === ZERO_BYTES32) {
    return { held: false, provenance, detail: { indexer } }
  }

  const att = read.attestation
  if (!att) {
    return {
      held: false,
      provenance,
      error: `indexer named attestation ${read.uid} but no EAS record was read`,
    }
  }

  // EAS returns a zeroed struct for a uid it does not know — so an unknown uid arrives here as
  // a record whose own uid is zero, not as a revert. The indexer pointing somewhere EAS cannot
  // follow is a fault in the pointer, and the honest report of a fault is an error.
  if (att.uid !== read.uid) {
    return {
      held: false,
      provenance,
      error: `EAS has no record for ${read.uid} named by the indexer`,
    }
  }
  if (att.schema !== COINBASE_VERIFIED_ACCOUNT_SCHEMA) {
    return {
      held: false,
      provenance,
      error: `attestation ${att.uid} is schema ${att.schema}, not the Verified Account schema`,
    }
  }
  if (att.recipient.toLowerCase() !== read.subject.toLowerCase()) {
    return {
      held: false,
      provenance,
      error: `attestation ${att.uid} names recipient ${att.recipient}, not ${read.subject}`,
    }
  }
  if (att.time === 0n) {
    return { held: false, provenance, error: `attestation ${att.uid} carries no issuance time` }
  }

  const issuedAt = Number(att.time)
  const detail: Record<string, unknown> = {
    indexer,
    attestationUid: att.uid,
    attester: att.attester,
    revocable: att.revocable,
    revoked: att.revocationTime !== 0n,
  }
  if (att.expirationTime !== 0n) detail.expiresAt = Number(att.expirationTime)

  // Revoked and expired are both "not held" and both keep their date, because the date is what
  // makes the negative legible: a credential revoked last week is a different story from one
  // that lapsed in 2024, and `detail` is where a caller reads which.
  //
  // Both also carry `heldUntil`, and the *earlier* of the two ends it: an attestation that
  // expired in March and was revoked in June stopped being a credential in March, and reporting
  // June would hand an as-of score three months the subject did not have. EAS stores both
  // numbers, so taking the minimum of the non-zero ones is a read, not an estimate.
  const ends = [att.revocationTime, att.expirationTime].filter((t) => t !== 0n).map(Number)
  const heldUntil = ends.length ? Math.min(...ends) : undefined

  if (att.revocationTime !== 0n) {
    detail.revokedAt = Number(att.revocationTime)
    return {
      held: false,
      provenance: { ...provenance, dateFrom: 'chain' },
      detail,
      issuedAt,
      ...(heldUntil !== undefined ? { heldUntil } : {}),
    }
  }
  if (att.expirationTime !== 0n && Number(att.expirationTime) <= read.now) {
    detail.expired = true
    return {
      held: false,
      provenance: { ...provenance, dateFrom: 'chain' },
      detail,
      issuedAt,
      ...(heldUntil !== undefined ? { heldUntil } : {}),
    }
  }

  return { held: true, issuedAt, provenance: { ...provenance, dateFrom: 'chain' }, detail }
}

async function safe(fn: () => Promise<AdapterProbeResult>): Promise<AdapterProbeResult> {
  try {
    return await fn()
  } catch (e) {
    return { held: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Coinbase Verified Account.
 *
 * Persona-rooted, per Coinbase's own third-party vendor disclosure — so it shares a trust root
 * with every other Persona-backed credential and must not be counted beside them.
 */
export function coinbaseVerificationAdapter(rpcUrl: string = COINBASE_RPC): AdapterProbe {
  const c = createPublicClient({ chain: base, transport: http(rpcUrl) }) as PublicClient

  return {
    adapterId: 'coinbase-verification',
    probe: (subject: Address) =>
      safe(async () => {
        const [head, uid] = await Promise.all([
          c.getBlockNumber(),
          c.readContract({
            address: COINBASE_ATTESTATION_INDEXER,
            abi: COINBASE_INDEXER_ABI,
            functionName: 'getAttestationUid',
            args: [subject, COINBASE_VERIFIED_ACCOUNT_SCHEMA],
          }),
        ])
        const block = Number(head)
        const now = Math.floor(Date.now() / 1000)
        if (uid === ZERO_BYTES32) {
          return interpretCoinbaseVerification({ block, now, subject, uid })
        }

        const attestation = (await c.readContract({
          address: EAS_PREDEPLOY,
          abi: EAS_ABI,
          functionName: 'getAttestation',
          args: [uid],
        })) as EasAttestation

        return interpretCoinbaseVerification({ block, now, subject, uid, attestation })
      }),
  }
}
