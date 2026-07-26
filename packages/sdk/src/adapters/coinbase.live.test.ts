/**
 * Coinbase Verified Account, against the real Base mainnet.
 *
 * The thing under test is not "does this address have an attestation". It is the claim the
 * probe rests on, which is that **Coinbase's on-chain index is a faithful pointer into EAS**
 * — because that claim is what replaced `base.easscan.org`, the last hosted endpoint on this
 * repo's critical path.
 *
 * So the suite works the other way round from a lookup: it pulls real `Attested` logs out of
 * Base's history, and for each one asks whether the indexer returns *that* uid, whether EAS's
 * record for it names *that* recipient under *that* schema, and whether its `time` is the
 * timestamp of the block the attestation was actually mined in. Nothing about a holder is
 * hard-coded; subjects come out of the chain at run time, so the suite follows the registry
 * rather than a snapshot of it. If Coinbase stops indexing, or reroutes the proxy, this
 * reddens instead of the score quietly dropping a trust root.
 *
 * Two further mechanisms are asserted rather than assumed. The schema carries a **resolver**,
 * which is what makes "only Coinbase may attest under this schema" true rather than a claim in
 * a README — and every attestation sampled across the chain's history carries one attester, so
 * the schema id is load-bearing on its own. And the index is written **at attestation time**:
 * read one block earlier it returns zero, which is what makes an archive read of this credential
 * historically honest rather than a backfill of today's answer.
 *
 * Run: node --test --experimental-strip-types src/adapters/coinbase.live.test.ts
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPublicClient,
  fallback,
  http,
  keccak256,
  numberToHex,
  toHex,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'
import {
  COINBASE_ATTESTATION_INDEXER,
  COINBASE_INDEXER_ABI,
  COINBASE_RPC,
  COINBASE_VERIFIED_ACCOUNT_SCHEMA,
  EAS_ABI,
  EAS_PREDEPLOY,
  EAS_SCHEMA_REGISTRY_PREDEPLOY,
  coinbaseVerificationAdapter,
  type EasAttestation,
} from './coinbase.ts'
import { freshnessOf } from '../scoring.ts'
import { applyAsOfToEvidence } from '../as-of.ts'
import type { Address, Adapter, AdapterProbeResult, Evidence } from '../types.ts'
import { readFileSync } from 'node:fs'

/** Nobody holds the key to this address, so nobody has ever verified with it. */
const NO_CREDENTIAL = '0x000000000000000000000000000000000000dEaD' as Address

const ontologyJson = JSON.parse(
  readFileSync(new URL('../../../../ontology/adapters.json', import.meta.url), 'utf8'),
) as { adapters: (Adapter & { id: string })[] }
const entryFor = (id: string) => ontologyJson.adapters.find((a) => a.id === id)!

/**
 * One probe result, priced as of an instant — what `Print.resolve` builds internally,
 * assembled here so a live probe can be fed straight to the as-of layer without a registry
 * subgraph in the loop. Freshness is evaluated at `at`, because a credential restored at a past
 * instant is worth what it was worth then and not what a credential of that age is worth today.
 */
const evidenceAt = (
  adapter: Adapter,
  observedOn: Address,
  r: AdapterProbeResult,
  at: number,
): Evidence => ({
  adapterId: adapter.id,
  adapterName: adapter.name,
  evidenceClass: adapter.evidenceClass,
  trustRoot: adapter.trustRoot,
  observedOn,
  held: r.held,
  ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
  ...(r.issuedAfter !== undefined ? { issuedAfter: r.issuedAfter } : {}),
  ...(r.heldUntil !== undefined ? { heldUntil: r.heldUntil } : {}),
  freshness: freshnessOf(adapter, r.issuedAt, at, r.issuedAfter),
  effectiveCostCents: 0,
  forgeCostCents: adapter.forgeCostCents,
  rentCostCents: adapter.rentCostCents,
  live: adapter.live,
  sourceURI: adapter.sourceURI,
})

/**
 * The only keyless Base endpoint that serves archive `eth_getLogs` at all: publicnode answers
 * every archive log range with "Archive requests require a personal token", and drpc caps a
 * free-plan range at 10,000 blocks. The *probe* needs none of this — reading history is exactly
 * what an on-chain index saves it from — but confirming the index against history does.
 */
const BASE_ARCHIVE_RPC = 'https://base.gateway.tenderly.co'

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const

const SCHEMA_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getSchema',
    stateMutability: 'view',
    inputs: [{ name: 'uid', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'uid', type: 'bytes32' },
          { name: 'resolver', type: 'address' },
          { name: 'revocable', type: 'bool' },
          { name: 'schema', type: 'string' },
        ],
      },
    ],
  },
] as const

const ATTESTED_TOPIC = keccak256(toHex('Attested(address,address,bytes32,bytes32)'))
const REVOKED_TOPIC = keccak256(toHex('Revoked(address,address,bytes32,bytes32)'))

/** Reads go to the archive node first so that pinning a historical block works at all. */
const client = createPublicClient({
  chain: base,
  transport: fallback([http(BASE_ARCHIVE_RPC), http(COINBASE_RPC)]),
}) as PublicClient

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Skip rather than fail when the one archive endpoint is down: that is not our defect. */
async function onChain(t: { skip: (m: string) => void }, what: string, body: () => Promise<void>) {
  try {
    await body()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (e instanceof assert.AssertionError) throw e
    t.skip(`${what}: Base endpoint unavailable — ${message.split('\n')[0]}`)
  }
}

interface SampledAttestation {
  recipient: Address
  attester: Address
  uid: `0x${string}`
  block: bigint
}

/** One `Attested` log, decoded. Recipient and attester are indexed; the uid is the first word. */
const decodeAttested = (log: { topics: readonly `0x${string}`[]; data: `0x${string}`; blockNumber: bigint | null }): SampledAttestation => ({
  recipient: (`0x${log.topics[1]!.slice(26)}`) as Address,
  attester: (`0x${log.topics[2]!.slice(26)}`) as Address,
  uid: log.data.slice(0, 66) as `0x${string}`,
  block: log.blockNumber ?? 0n,
})

async function sampleAttested(
  fromBlock: bigint,
  toBlock: bigint,
  topic = ATTESTED_TOPIC,
): Promise<SampledAttestation[]> {
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [
      {
        address: EAS_PREDEPLOY,
        fromBlock: numberToHex(fromBlock),
        toBlock: numberToHex(toBlock),
        topics: [topic, null, null, COINBASE_VERIFIED_ACCOUNT_SCHEMA],
      },
    ],
  } as never) as unknown as { topics: `0x${string}`[]; data: `0x${string}`; blockNumber: `0x${string}` }[]
  return logs.map((l) => decodeAttested({ ...l, blockNumber: BigInt(l.blockNumber) }))
}

const uidFor = (subject: Address, blockNumber?: bigint) =>
  client.readContract({
    address: COINBASE_ATTESTATION_INDEXER,
    abi: COINBASE_INDEXER_ABI,
    functionName: 'getAttestationUid',
    args: [subject, COINBASE_VERIFIED_ACCOUNT_SCHEMA],
    ...(blockNumber === undefined ? {} : { blockNumber }),
  }) as Promise<`0x${string}`>

const recordFor = (uid: `0x${string}`) =>
  client.readContract({
    address: EAS_PREDEPLOY,
    abi: EAS_ABI,
    functionName: 'getAttestation',
    args: [uid],
  }) as Promise<EasAttestation>

describe('Coinbase Verified Account (Base, live)', () => {
  let head: bigint
  /** Windows spread across Base's history, so coverage is not a claim about the recent tail. */
  let windows: [bigint, bigint][] = []

  before(async () => {
    head = await client.getBlockNumber()
    windows = [0, 1, 2, 3, 4].map((i) => {
      const to = head - BigInt(i) * 10_000_000n
      return [to - 100_000n, to] as [bigint, bigint]
    })
  })

  test('the indexer and the EAS predeploy are contracts, not empty addresses', async (t) => {
    await onChain(t, 'code check', async () => {
      for (const address of [COINBASE_ATTESTATION_INDEXER, EAS_PREDEPLOY, EAS_SCHEMA_REGISTRY_PREDEPLOY]) {
        const code = await client.getCode({ address })
        assert.ok((code?.length ?? 0) > 2, `${address} has no code on Base`)
      }
    })
  })

  test('the schema is registered, revocable, and gated by a resolver', async (t) => {
    await onChain(t, 'schema registry', async () => {
      const record = (await client.readContract({
        address: EAS_SCHEMA_REGISTRY_PREDEPLOY,
        abi: SCHEMA_REGISTRY_ABI,
        functionName: 'getSchema',
        args: [COINBASE_VERIFIED_ACCOUNT_SCHEMA],
      })) as { uid: `0x${string}`; resolver: Address; revocable: boolean; schema: string }

      assert.equal(record.uid, COINBASE_VERIFIED_ACCOUNT_SCHEMA, 'the schema id resolves to itself')
      assert.equal(record.schema, 'bool verifiedAccount')
      // Revocable is why the probe must read `revocationTime` at all: an irrevocable schema
      // could be answered from the indexer alone.
      assert.equal(record.revocable, true)
      // A zero resolver would mean anyone may attest under this schema, and the probe's
      // decision to trust the schema id rather than pin an attester would be unfounded.
      assert.notEqual(record.resolver, '0x0000000000000000000000000000000000000000')
      const resolverCode = await client.getCode({ address: record.resolver })
      assert.ok((resolverCode?.length ?? 0) > 2, 'the resolver gating this schema has no code')
    })
  })

  test('every attestation sampled from the chain is indexed, and the index names the latest one', async (t) => {
    await onChain(t, 'indexer coverage', async () => {
      let checked = 0
      let exact = 0
      let superseded = 0
      const attesters = new Set<string>()

      for (const [from, to] of windows) {
        const sample = (await sampleAttested(from, to)).slice(0, 4)
        for (const a of sample) {
          attesters.add(a.attester.toLowerCase())

          // The log's own uid, resolved through EAS. This is the pairing the probe depends on
          // and it is checked without the indexer's help.
          const record = await recordFor(a.uid)
          assert.equal(record.uid, a.uid, `EAS has no record for ${a.uid}, which the chain logged`)
          assert.equal(record.schema, COINBASE_VERIFIED_ACCOUNT_SCHEMA)
          assert.equal(record.recipient.toLowerCase(), a.recipient.toLowerCase())

          // The date is the block the attestation was mined in — checked against the block
          // header, which is a different subsystem of the node from the log that named it.
          const block = await client.getBlock({ blockNumber: a.block })
          assert.equal(Number(record.time), Number(block.timestamp), `date mismatch for ${a.uid}`)

          const uid = await uidFor(a.recipient)
          assert.notEqual(uid, ZERO_BYTES32, `${a.recipient} attested at block ${a.block} is not indexed`)
          if (uid === a.uid) {
            exact++
          } else {
            // Not a mismatch: the index keeps one uid per (recipient, schema) and Coinbase
            // re-attests, so an old log is superseded by a newer attestation to the same
            // address. It has to still be *this* subject's credential under *this* schema, and
            // it has to be newer — an index pointing backwards would be a fault.
            const latest = await recordFor(uid)
            assert.equal(latest.schema, COINBASE_VERIFIED_ACCOUNT_SCHEMA)
            assert.equal(latest.recipient.toLowerCase(), a.recipient.toLowerCase())
            assert.ok(
              latest.time >= record.time,
              `index points at ${uid} (t=${latest.time}), older than the logged ${a.uid} (t=${record.time})`,
            )
            superseded++
          }
          checked++
          await sleep(120)
        }
      }

      assert.ok(checked >= 8, `expected a sample across history, checked ${checked}`)
      assert.ok(exact > 0, `every sampled attestation was superseded (${superseded}); nothing pinned the index`)
      // One attester across every window: the schema id alone identifies the issuer, which is
      // why the probe does not pin an address it would have to chase through a rotation.
      assert.equal(attesters.size, 1, `expected one attester, saw ${[...attesters].join(', ')}`)
    })
  })

  test('the index is written when the attestation is, not backfilled', async (t) => {
    await onChain(t, 'historical index', async () => {
      const [from, to] = windows[0]!
      const sample = (await sampleAttested(from, to)).slice(0, 3)
      if (!sample.length) return t.skip('no attestations in the most recent window')

      for (const a of sample) {
        const atMint = await uidFor(a.recipient, a.block)
        const before = await uidFor(a.recipient, a.block - 1n)
        assert.equal(atMint, a.uid, `the index did not name ${a.uid} at the block it was written`)
        // Zero for a first attestation, the previous uid for a re-attestation. Either way the
        // index did not know this uid before the block that wrote it, which is what makes an
        // archive read of this credential historically honest rather than today's answer
        // projected backwards.
        assert.notEqual(before, a.uid, `the index already named ${a.uid} one block early`)
        await sleep(120)
      }
    })
  })

  test('a revoked attestation reads as not held, with the revocation dated', async (t) => {
    await onChain(t, 'revocation', async () => {
      // Find someone the indexer still points at whose attestation Coinbase has revoked. The
      // indexer keeps the pointer, so presence alone would count them as verified.
      let found: { recipient: Address; revokedAt: number; issuedAt: number } | undefined
      for (const [from, to] of windows) {
        for (const r of (await sampleAttested(from, to, REVOKED_TOPIC)).slice(0, 6)) {
          const uid = await uidFor(r.recipient)
          if (uid !== r.uid) continue // re-attested since; not the case under test
          const record = await recordFor(uid)
          if (record.revocationTime === 0n) continue
          found = {
            recipient: r.recipient,
            revokedAt: Number(record.revocationTime),
            issuedAt: Number(record.time),
          }
          break
        }
        if (found) break
        await sleep(120)
      }
      if (!found) return t.skip('every revoked account sampled has since been re-attested')

      const probed = await coinbaseVerificationAdapter().probe(found.recipient)
      assert.equal(probed.error, undefined, `probe errored: ${probed.error}`)
      assert.equal(probed.held, false, `${found.recipient} is revoked but read as held`)
      assert.equal(probed.detail?.revoked, true)
      assert.equal(probed.detail?.revokedAt, found.revokedAt)
      assert.equal(probed.issuedAt, found.issuedAt)

      // Both ends of the credential's life, off the chain, in one read. A revocation is the
      // most common way a Coinbase credential ends — 5,143 of them in the sampled windows —
      // and until now every one of them silently understated any score asked about a block
      // before it, because the probe reads at head and a revoked attestation reads as absent.
      assert.equal(probed.heldUntil, found.revokedAt)
      assert.ok(probed.issuedAt! < probed.heldUntil!, 'a window, not a point')

      const adapter = entryFor('coinbase-verification')
      const priced = new Map([[adapter.id, adapter]])
      const inside = Math.floor((found.issuedAt + found.revokedAt) / 2)
      const restored = applyAsOfToEvidence(
        [evidenceAt(adapter, found.recipient, probed, inside)],
        inside,
        priced,
      )
      assert.deepEqual(restored.ceasedAfterAsOf, ['coinbase-verification'])
      assert.equal(restored.evidence[0]!.held, true, 'they held this at the instant asked about')
      assert.ok(restored.evidence[0]!.effectiveCostCents > 0)

      const after = found.revokedAt + 1
      const gone = applyAsOfToEvidence(
        [evidenceAt(adapter, found.recipient, probed, after)],
        after,
        priced,
      )
      assert.deepEqual(gone.ceasedAfterAsOf, [])
      assert.equal(gone.evidence[0]!.held, false, 'and did not, a second after Coinbase revoked it')
    })
  })

  test('a live holder is held, dated, and old enough to move off full freshness', async (t) => {
    await onChain(t, 'live holder', async () => {
      // Oldest window first: a credential from the far end of the history is the one that
      // proves the date is doing work in the score.
      for (const [from, to] of [...windows].reverse()) {
        for (const a of (await sampleAttested(from, to)).slice(0, 6)) {
          const probed = await coinbaseVerificationAdapter().probe(a.recipient)
          assert.equal(probed.error, undefined, `probe errored: ${probed.error}`)
          if (!probed.held) continue // revoked or expired since; a different test's business

          // Not asserted equal to the log's uid: a re-attestation supersedes it, which the
          // coverage test above pins down. What must hold here is that the date is real.
          assert.ok(probed.detail?.attestationUid, 'a held credential names its attestation')
          assert.equal(probed.provenance?.dateFrom, 'chain')
          assert.equal(probed.provenance?.heldFrom, 'chain')
          assert.ok(probed.provenance?.headBlock! >= Number(a.block))
          assert.ok(typeof probed.issuedAt === 'number' && probed.issuedAt > 0)

          const adapter = {
            decayHalfLifeDays: 730,
            ageCurve: 'Decay',
          } as unknown as Adapter
          const now = Math.floor(Date.now() / 1000)
          const ageDays = (now - probed.issuedAt!) / 86_400
          const fresh = freshnessOf(adapter, probed.issuedAt, now)
          assert.ok(fresh > 0 && fresh < 1, `freshness ${fresh} at ${ageDays.toFixed(0)} days old`)
          if (ageDays > 365) {
            assert.ok(fresh < 0.75, `a ${ageDays.toFixed(0)}-day credential should have decayed`)
          }
          return
        }
        await sleep(120)
      }
      t.skip('no live holder found in any sampled window')
    })
  })

  test('an address nobody has verified is not held, and that is not an error', async (t) => {
    await onChain(t, 'negative', async () => {
      const r = await coinbaseVerificationAdapter().probe(NO_CREDENTIAL)
      assert.equal(r.error, undefined, `probe errored: ${r.error}`)
      assert.equal(r.held, false)
      assert.equal(r.issuedAt, undefined)
      assert.equal(r.provenance?.dateFrom, 'none')
      assert.ok(r.provenance?.headBlock! > 0, 'a negative still reports the block it was taken at')
      assert.equal(r.detail?.attestationUid, undefined)
    })
  })

  test('an unreachable endpoint surfaces as an error, never as "not a human"', async () => {
    // The whole point of moving off a hosted GraphQL endpoint was that an outage should not be
    // able to move a score. It still must not, now that the endpoint is an RPC.
    const r = await coinbaseVerificationAdapter('http://127.0.0.1:1/').probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must set error, so the probe is excluded not counted')
  })

  test('no easscan.org anywhere in the read path', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('./coinbase.ts', import.meta.url), 'utf8')
    const url = /https?:\/\/[^\s'"`)]+/g
    const hosts = [...source.matchAll(url)].map((m) => new URL(m[0]).host)
    assert.ok(!hosts.some((h) => h.endsWith('easscan.org')), `read path still names ${hosts}`)
  })
})
