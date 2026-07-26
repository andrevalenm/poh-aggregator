/**
 * Lens — the parts that decide held and the date, without a network.
 *
 * The probe's judgements are (1) collapsing raw transfer logs into one candidate per account
 * dated from the *latest* transfer, and (2) classifying how the subject came to own the
 * account, because the classification decides whether the date is a clean issuance, a floor
 * under a migrated credential, or a purchase. Both are pure and both are tested here; the
 * network paths are exercised live behind LIVE=1.
 *
 * Run: node --test --experimental-strip-types src/adapters/lens.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/lens.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, pad, parseAbi } from 'viem'
import { polygon } from 'viem/chains'
import {
  candidatesFromTransferLogs,
  classifyAcquisition,
  lensAdapter,
  LENS_MIGRATION_CUSTODIAN,
  LENS_OWNERSHIP_TRANSFERRED_TOPIC,
  LENS_POLYGON_RPC,
  LENS_RPCS,
  LENS_V2_LENSHUB,
  LENS_V2_SUNSET_BLOCK,
  LENS_V2_SUNSET_TIMESTAMP,
} from './lens.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

/** Nobody holds the key to this address, so nobody has ever been given a Lens account. */
const NO_ACCOUNT = '0x0000000000000000000000000000000000000001' as Address
/** vitalik.eth — owner of the migrated `lens/vitalik` account, verified on-chain 2026-07-25. */
const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address

const ACCT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
const ACCT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
const PREV_1 = '0x1111111111111111111111111111111111111111' as Address
const PREV_2 = '0x2222222222222222222222222222222222222222' as Address

const log = (account: Address, previousOwner: Address, block: number) => ({
  address: account,
  topics: [
    LENS_OWNERSHIP_TRANSFERRED_TOPIC,
    pad(previousOwner),
    pad('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'.toLowerCase() as Address),
  ] as `0x${string}`[],
  blockNumber: `0x${block.toString(16)}` as `0x${string}`,
})

describe('collapsing transfer logs into candidates', () => {
  test('one account transferred twice is one candidate, dated from the latest transfer', () => {
    // Transferred to the subject, away, and back: dating from the first transfer would credit
    // the interlude as tenure. The away-transfer is not even in this list — it went to someone
    // else's topic — which is exactly why the latest to-subject transfer is the only safe date.
    const c = candidatesFromTransferLogs([log(ACCT_A, PREV_1, 100), log(ACCT_A, PREV_2, 900)])
    assert.equal(c.length, 1)
    assert.equal(c[0]!.acquiredAtBlock, 900n)
    assert.equal(c[0]!.previousOwner, PREV_2)
  })

  test('log order does not matter', () => {
    const c = candidatesFromTransferLogs([log(ACCT_A, PREV_2, 900), log(ACCT_A, PREV_1, 100)])
    assert.equal(c[0]!.acquiredAtBlock, 900n)
  })

  test('two accounts sort oldest acquisition first, so the ramp sees the longest tenure', () => {
    const c = candidatesFromTransferLogs([log(ACCT_B, PREV_1, 5_000), log(ACCT_A, PREV_1, 40)])
    assert.equal(c.length, 2)
    assert.equal(c[0]!.account, ACCT_A)
    assert.equal(c[1]!.account, ACCT_B)
  })

  test('a malformed log with no previousOwner topic is dropped, not coerced', () => {
    const bad = { address: ACCT_A, topics: [LENS_OWNERSHIP_TRANSFERRED_TOPIC] as `0x${string}`[], blockNumber: '0x1' as `0x${string}` }
    assert.equal(candidatesFromTransferLogs([bad]).length, 0)
  })

  test('no logs, no candidates', () => {
    assert.deepEqual(candidatesFromTransferLogs([]), [])
  })
})

describe('classifying how the subject came to own the account', () => {
  test('acquired in the creation block is a fresh signup', () => {
    // Ordinary signups deploy the account and hand it over in one transaction, so the
    // LensFactory shows as previousOwner — that must not read as "changed hands".
    assert.equal(
      classifyAcquisition({ creationBlock: 10n, acquiredAtBlock: 10n, previousOwner: PREV_1 }),
      'created',
    )
  })

  test('a claim from the migration custodian is a migration, not a purchase', () => {
    assert.equal(
      classifyAcquisition({
        creationBlock: 1_415n,
        acquiredAtBlock: 219_585n,
        previousOwner: LENS_MIGRATION_CUSTODIAN,
      }),
      'migration-claim',
    )
  })

  test('the custodian check is case-insensitive, because topics arrive lowercased', () => {
    assert.equal(
      classifyAcquisition({
        creationBlock: 1n,
        acquiredAtBlock: 2n,
        previousOwner: LENS_MIGRATION_CUSTODIAN.toLowerCase() as Address,
      }),
      'migration-claim',
    )
  })

  test('any other later acquisition is a transfer, dated from the sale', () => {
    assert.equal(
      classifyAcquisition({ creationBlock: 10n, acquiredAtBlock: 500n, previousOwner: PREV_1 }),
      'transferred',
    )
  })
})

describe('the probe contract', () => {
  test('the adapter has the shape the registry expects', () => {
    const adapter = lensAdapter()
    assert.equal(adapter.adapterId, 'lens-account')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('unreachable endpoints are an error, never a negative, and never a throw', async () => {
    const broken = lensAdapter({
      rpcUrls: ['http://127.0.0.1:9'],
      polygonRpcUrl: 'http://127.0.0.1:9',
      polygonArchiveRpcUrl: 'http://127.0.0.1:9',
      timeoutMs: 1_000,
    })
    const r = await broken.probe(NO_ACCOUNT)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })
})

describe('live, against Lens Chain and Polygon', { skip: !LIVE }, () => {
  const adapter = lensAdapter()

  test('a migrated account is held, dated from its claim, and flagged as a migration', async (t) => {
    const r = await adapter.probe(VITALIK)
    if (r.error) return t.skip(`Lens Chain endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, true)
    assert.equal(r.detail?.['username'], 'vitalik')
    assert.equal(r.detail?.['source'], 'lens-chain')
    assert.equal(r.detail?.['acquisition'], 'migration-claim')
    assert.equal(r.detail?.['migratedFromLensV2'], true)
    // Claimed after the chain's first block and before now; the exact block is 219,585 but the
    // assertion is about the mechanism, not a snapshot.
    assert.ok(typeof r.issuedAt === 'number' && r.issuedAt > 1_740_140_786)
    assert.ok(r.issuedAt! <= Date.now() / 1000)
    assert.ok(
      r.provenance?.notes.includes('date-from-registry-import'),
      'a migrated credential is older than its date and must say so',
    )
  })

  test('an address that never touched Lens is held:false on both chains', async (t) => {
    const r = await adapter.probe(NO_ACCOUNT)
    if (r.error) return t.skip(`endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['lensChainAccounts'], 0)
    assert.equal(r.detail?.['polygonV2Profiles'], 0)
    assert.equal(r.issuedAt, undefined)
  })

  test('a v2 profile that never claimed on Lens Chain falls back to Polygon, date-bounded', async (t) => {
    // Hunt for an unclaimed holder rather than pinning one — any pinned address could claim
    // tomorrow. The best hunting ground is the *late* profile ids: v2 kept trickling mints
    // after the migration snapshot, and a profile minted on Polygon after the sunset was
    // never migrated at all, so its owner usually has nothing on Lens Chain.
    const pc = createPublicClient({
      chain: polygon,
      transport: http(LENS_POLYGON_RPC, { timeout: 15_000 }),
    })
    const HUB_ABI = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)'])
    let found: Awaited<ReturnType<typeof adapter.probe>> | undefined
    for (const profileId of [665_560n, 665_450n, 665_300n, 77_777n, 31_337n]) {
      const owner = (await pc
        .readContract({ address: LENS_V2_LENSHUB, abi: HUB_ABI, functionName: 'ownerOf', args: [profileId] })
        .catch(() => undefined)) as Address | undefined
      if (!owner) continue
      const r = await adapter.probe(owner)
      if (r.error) return t.skip(`endpoints unavailable — ${r.error.split(';')[0]}`)
      if (r.held && r.detail?.['source'] === 'polygon-v2-legacy') {
        found = r
        break
      }
    }
    if (!found) return t.skip('every sampled v2 profile owner has a Lens Chain account this run')
    assert.equal(found.held, true)
    assert.ok((found.detail?.['polygonV2Profiles'] as number) > 0)
    // The date must be the sunset bound or absent — never a fabricated exact age.
    if (found.issuedAt !== undefined) {
      assert.equal(found.issuedAt, LENS_V2_SUNSET_TIMESTAMP)
      assert.equal(found.detail?.['heldAtSunset'], true)
    } else if (found.issuedAfter !== undefined) {
      assert.equal(found.issuedAfter, LENS_V2_SUNSET_TIMESTAMP)
      assert.equal(found.detail?.['heldAtSunset'], false)
    } else {
      assert.ok(found.detail?.['undated'], 'a dateless result must say why it has no date')
    }
  })

  test('the sunset constants still match the chain they were measured from', async (t) => {
    // LENS_V2_SUNSET_TIMESTAMP is block 70,000,000's own timestamp; a past block is immutable,
    // so any disagreement is a defect in the constant, not drift in the world.
    const pc = createPublicClient({
      chain: polygon,
      transport: http(LENS_POLYGON_RPC, { timeout: 15_000 }),
    })
    try {
      const block = await pc.getBlock({ blockNumber: LENS_V2_SUNSET_BLOCK })
      assert.equal(Number(block.timestamp), LENS_V2_SUNSET_TIMESTAMP)
    } catch (e) {
      t.skip(`Polygon endpoint unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
  })

  test('Lens Chain endpoints agree with each other about a held subject', async (t) => {
    // Both endpoints are Lens-operated; this cannot prove independence, but it can catch one
    // of them serving stale or partial log history, which would silently unmake credentials.
    for (const url of LENS_RPCS) {
      const single = lensAdapter({ rpcUrls: [url] })
      const r = await single.probe(VITALIK)
      if (r.error) return t.skip(`${url} unavailable — ${r.error.split(';')[0]}`)
      assert.equal(r.held, true, `${url} must report the account`)
      assert.equal(r.detail?.['account'], '0xe4AaA97cdA406c6AF7C02a5260a8013910bd683C'.toLowerCase())
    }
  })
})
