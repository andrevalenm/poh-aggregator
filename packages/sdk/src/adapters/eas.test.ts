/**
 * EAS adapters — unit and live.
 *
 * Unit tests pin the parts that must never move without being noticed: the `Attested` topic
 * hash, the content-derived schema UIDs, the score-v2 payload decoding (against bytes copied
 * verbatim from a real Optimism attestation), and every branch of the Coinbase
 * interpretation. Probes are additionally exercised against unreachable RPCs to hold the
 * never-throws contract.
 *
 * The LIVE=1 tests do the part a fixture cannot: they find a real attested address from the
 * chain's own recent `Attested` logs (no address is hard-coded on the positive path, since
 * Coinbase revokes half of everything it issues), confirm the raw topic layout byte-for-byte,
 * and assert that the log path, the indexer path, and the legacy EASSCAN GraphQL adapter all
 * name the same attestation.
 *
 * Run unit: node --test --experimental-strip-types src/adapters/eas.test.ts
 * Run live: LIVE=1 node --test --experimental-strip-types src/adapters/eas.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, encodeAbiParameters, http, parseAbi, parseAbiParameters, toHex, type PublicClient } from 'viem'
import { base, optimism } from 'viem/chains'
import {
  ATTESTED_TOPIC,
  ATTESTED_TOPIC_OBSERVED,
  BASE_EAS,
  BASE_EAS_ENDPOINTS,
  COINBASE_ATTESTER,
  COINBASE_INDEXER,
  COINBASE_VERIFIED_ACCOUNT_SCHEMA,
  EAS_ABI,
  PASSPORT_EAS_DEPLOYMENTS,
  PASSPORT_SCORE_LEGACY_SCHEMA,
  PASSPORT_SCORE_V2_SCHEMA,
  coinbaseVerificationOnchainAdapter,
  decodeScoreLegacy,
  decodeScoreV2,
  deriveSchemaUID,
  gitcoinPassportAdapter,
  interpretCoinbaseAttestation,
  type EasAttestation,
} from './eas.ts'
import type { Address } from '../types.ts'

const LIVE = process.env['LIVE'] === '1'

const NOW = 1_785_000_000
const ZERO32 = `0x${'0'.repeat(64)}` as const

/** Nobody holds the key to this address, so nobody has ever verified with it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

// ------------------------------------------------------------------ fixtures

/**
 * A real Coinbase Verified Account attestation, copied from `EAS.getAttestation` on Base,
 * 2026-07-25. uid was resolved by Coinbase's on-chain indexer and independently seen in the
 * `Attested` log at block 49,105,239.
 */
const COINBASE_ATT: EasAttestation = {
  uid: '0x88a10ab440a6e5e0e365b9a59cc9843f67aa490cf6cce3b87961e010adc8a8b9',
  schema: COINBASE_VERIFIED_ACCOUNT_SCHEMA,
  time: 1_784_999_825n,
  expirationTime: 0n,
  revocationTime: 0n,
  refUID: ZERO32,
  recipient: '0xcAb9B4792a9d4C55E3AD1Dc0a5B4Cba2592E7828' as Address,
  attester: COINBASE_ATTESTER as Address,
  revocable: true,
  data: '0x0000000000000000000000000000000000000000000000000000000000000001',
}

/**
 * The data payload of a real score-v2 attestation
 * (`0xd60c83d67487be858f06b6d98d42ba7c5a8b411f40f662087f813609817c4c55`, Optimism, minted
 * 2026-07-24): score 28.847, threshold 20, stamps Steam 2.8 + BinanceBABT2 10.021 +
 * HolonymGovIdProvider 16.026. Copied verbatim from `eth_call`, not re-encoded.
 */
const SCORE_V2_DATA = ('0x' +
  '0000000000000000000000000000000000000000000000000000000000000001' +
  '0000000000000000000000000000000000000000000000000000000000000004' +
  '000000000000000000000000000000000000000000000000000000000000014f' +
  '00000000000000000000000000000000000000000000000000000000000466d6' +
  '0000000000000000000000000000000000000000000000000000000000030d40' +
  '00000000000000000000000000000000000000000000000000000000000000c0' +
  '0000000000000000000000000000000000000000000000000000000000000003' +
  '0000000000000000000000000000000000000000000000000000000000000060' +
  '00000000000000000000000000000000000000000000000000000000000000e0' +
  '0000000000000000000000000000000000000000000000000000000000000160' +
  '0000000000000000000000000000000000000000000000000000000000000040' +
  '0000000000000000000000000000000000000000000000000000000000006d60' +
  '0000000000000000000000000000000000000000000000000000000000000005' +
  '537465616d000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000040' +
  '0000000000000000000000000000000000000000000000000000000000018772' +
  '000000000000000000000000000000000000000000000000000000000000000c' +
  '42696e616e636542414254320000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000040' +
  '0000000000000000000000000000000000000000000000000000000000027204' +
  '0000000000000000000000000000000000000000000000000000000000000014' +
  '486f6c6f6e796d476f76496450726f7669646572000000000000000000000000') as `0x${string}`

/** Resolver the Optimism Decoder names; the two schema UIDs observed in its registry. */
const OP_RESOLVER = '0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC' as Address
const OP_SCORE_V2_UID = '0xda0257756063c891659fed52fd36ef7557f7b45d66f59645fd3c3b263b747254'
const OP_SCORE_LEGACY_UID = '0x6ab5d34260fca0cfcf0e76e96d439cace6aa7c3c019d7c4580ed52c6845e9c89'

// ------------------------------------------------------------------ unit

describe('EAS constants and derivations', () => {
  test('the Attested topic hash matches the one observed in real Base logs', () => {
    // The derivation lives in code; the literal was read out of an actual log. If the
    // signature string ever drifts, every getLogs filter would silently match nothing —
    // this is the test that makes that loud instead.
    assert.equal(ATTESTED_TOPIC, ATTESTED_TOPIC_OBSERVED)
  })

  test('schema UIDs derive from (schema, resolver, revocable) exactly as the registry computes them', () => {
    // Both expected values were read back from the on-chain SchemaRegistry, not from docs.
    assert.equal(deriveSchemaUID(PASSPORT_SCORE_V2_SCHEMA, OP_RESOLVER, true), OP_SCORE_V2_UID)
    assert.equal(deriveSchemaUID(PASSPORT_SCORE_LEGACY_SCHEMA, OP_RESOLVER, true), OP_SCORE_LEGACY_UID)
  })

  test('endpoint list carries a measured getLogs range for every entry', () => {
    for (const e of BASE_EAS_ENDPOINTS) {
      assert.match(e.url, /^https:\/\//)
      assert.ok(e.maxLogRange >= 10_000n)
    }
  })
})

describe('score payload decoding', () => {
  test('decodes a real score-v2 payload byte-for-byte', () => {
    const d = decodeScoreV2(SCORE_V2_DATA)
    assert.equal(d.schema, 'score-v2')
    assert.equal(d.score, 28.847)
    assert.equal(d.scorerId, 335)
    assert.equal(d.passingScore, true)
    assert.equal(d.threshold, 20)
    assert.deepEqual(d.stamps, [
      { provider: 'Steam', weight: 2.8 },
      { provider: 'BinanceBABT2', weight: 10.021 },
      { provider: 'HolonymGovIdProvider', weight: 16.026 },
    ])
  })

  test('decodes a legacy score payload using its own declared decimals', () => {
    const data = encodeAbiParameters(parseAbiParameters('uint256, uint32, uint8'), [285_000n, 1n as unknown as number, 4])
    const d = decodeScoreLegacy(data)
    assert.equal(d.schema, 'score-legacy')
    assert.equal(d.score, 28.5)
    assert.equal(d.scorerId, 1)
    assert.equal(d.stamps, undefined)
  })
})

describe('Coinbase attestation interpretation', () => {
  test('a zero uid is an absence', () => {
    const v = interpretCoinbaseAttestation({ ...COINBASE_ATT, uid: ZERO32 }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['attested'], false)
    assert.equal(v.issuedAt, undefined)
  })

  test('the real fixture is held, dated from the attestation time', () => {
    const v = interpretCoinbaseAttestation(COINBASE_ATT, NOW)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, 1_784_999_825)
    assert.equal(v.detail['uid'], COINBASE_ATT.uid)
  })

  test('a revoked attestation is not held, and says when it was revoked', () => {
    // 56.4% of these are revoked — the branch is the common case, not the corner.
    const v = interpretCoinbaseAttestation({ ...COINBASE_ATT, revocationTime: 1_785_000_100n }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['revoked'], true)
    assert.equal(v.detail['revokedAt'], 1_785_000_100)
    assert.equal(v.issuedAt, undefined)
  })

  test('an attestation under the right schema from the wrong attester is not evidence', () => {
    // Schema UIDs are unowned; only the attester carries trust.
    const v = interpretCoinbaseAttestation(
      { ...COINBASE_ATT, attester: '0x0000000000000000000000000000000000000bad' as Address },
      NOW,
    )
    assert.equal(v.held, false)
    assert.equal(v.detail['reason'], 'attester-mismatch')
  })

  test('a wrong-schema struct is rejected before anything else is believed', () => {
    const v = interpretCoinbaseAttestation({ ...COINBASE_ATT, schema: ZERO32 }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['reason'], 'schema-mismatch')
  })

  test('an expiry, should Coinbase ever set one, is enforced', () => {
    const v = interpretCoinbaseAttestation({ ...COINBASE_ATT, expirationTime: BigInt(NOW - 1) }, NOW)
    assert.equal(v.held, false)
    assert.equal(v.detail['expired'], true)
  })
})

describe('probe shape and the never-throws contract', () => {
  test('adapters expose the AdapterProbe shape', () => {
    const cb = coinbaseVerificationOnchainAdapter()
    assert.equal(cb.adapterId, 'coinbase-verification')
    assert.equal(typeof cb.probe, 'function')
    const gp = gitcoinPassportAdapter()
    assert.equal(gp.adapterId, 'human-passport-eas')
    assert.equal(typeof gp.probe, 'function')
  })

  test('coinbase probe against dead RPCs resolves with an error, never a bare negative or a throw', async () => {
    const adapter = coinbaseVerificationOnchainAdapter({
      endpoints: [{ url: 'http://127.0.0.1:1', maxLogRange: 10_000n }],
      timeoutMs: 700,
    })
    const r = await adapter.probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    // A network failure must be distinguishable from "not verified": scoring excludes
    // errored probes rather than counting them as negatives.
    assert.ok(r.error, 'expected an error to be surfaced')
  })

  test('passport probe against dead RPCs on every chain resolves with an error', async () => {
    const adapter = gitcoinPassportAdapter({
      rpcUrls: { optimism: 'http://127.0.0.1:1', arbitrum: 'http://127.0.0.1:1' },
      timeoutMs: 700,
    })
    const r = await adapter.probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    assert.ok(r.error, 'expected an error to be surfaced')
    assert.match(r.error!, /optimism/)
    assert.match(r.error!, /arbitrum/)
  })
})

// ------------------------------------------------------------------ live

/** A live source being unreachable says nothing about the mechanism, so skip loudly. */
function skipUnreachable(t: { skip(message: string): void }, what: string, e: unknown): void {
  t.skip(`${what} unreachable: ${e instanceof Error ? e.message : String(e)}`)
}

interface RawLog {
  topics: [`0x${string}`, ...`0x${string}`[]]
  data: `0x${string}`
  blockNumber: `0x${string}`
}

const baseClient = (): PublicClient =>
  createPublicClient({ chain: base, transport: http('https://mainnet.base.org', { timeout: 25_000 }) }) as PublicClient

/** Tenderly serves 1M-block windows; the sampling scan uses it to find recent activity fast. */
const baseScanClient = (): PublicClient =>
  createPublicClient({
    chain: base,
    transport: http('https://base.gateway.tenderly.co', { timeout: 25_000 }),
  }) as PublicClient

/**
 * Find a recent, real Coinbase attestation from raw logs — raw on purpose: the assertions
 * about topic layout must run against bytes viem has not already interpreted.
 */
async function sampleCoinbaseLog(c: PublicClient): Promise<RawLog | undefined> {
  const head = await c.getBlockNumber()
  for (let i = 0n; i < 10n; i++) {
    const to = head - i * 20_000n
    const logs = (await c.request({
      method: 'eth_getLogs',
      params: [
        {
          address: BASE_EAS,
          fromBlock: toHex(to - 19_999n),
          toBlock: toHex(to),
          topics: [
            ATTESTED_TOPIC,
            null,
            `0x000000000000000000000000${COINBASE_ATTESTER.slice(2).toLowerCase()}`,
            COINBASE_VERIFIED_ACCOUNT_SCHEMA,
          ],
        },
      ],
    })) as RawLog[]
    if (logs.length > 0) return logs[logs.length - 1]
  }
  return undefined
}

describe('LIVE: Coinbase Verified Account from the chain', { skip: !LIVE }, () => {
  /** One sample for the whole suite, so every assertion talks about the same attestation. */
  let sampleOnce: Promise<RawLog | undefined> | undefined
  const sample = () => (sampleOnce ??= sampleCoinbaseLog(baseScanClient()))

  test('a real Attested log has the layout the adapter assumes', async (t) => {
    let log: RawLog | undefined
    try {
      log = await sample()
    } catch (e) {
      return skipUnreachable(t, 'Base log scan', e)
    }
    if (!log) return t.skip('no Coinbase attestation in the last 200k blocks')
    // The burned-before check: recipient in topics[1], attester in topics[2], schema in
    // topics[3], uid as the whole 32-byte data field. Asserted on raw bytes.
    assert.equal(log.topics[0], ATTESTED_TOPIC)
    assert.equal(log.topics.length, 4)
    assert.match(log.topics[1]!, /^0x000000000000000000000000[0-9a-f]{40}$/)
    assert.equal(log.topics[2], `0x000000000000000000000000${COINBASE_ATTESTER.slice(2).toLowerCase()}`)
    assert.equal(log.topics[3], COINBASE_VERIFIED_ACCOUNT_SCHEMA)
    assert.match(log.data, /^0x[0-9a-f]{64}$/)
  })

  test('the probe holds for a freshly attested address, dated to the attestation second', async (t) => {
    let log: RawLog | undefined
    try {
      log = await sample()
    } catch (e) {
      return skipUnreachable(t, 'Base log scan', e)
    }
    if (!log) return t.skip('no Coinbase attestation in the last 200k blocks')
    const recipient = `0x${log.topics[1]!.slice(26)}` as Address
    const uidFromLog = log.data

    const att = (await baseClient().readContract({
      address: BASE_EAS,
      abi: EAS_ABI,
      functionName: 'getAttestation',
      args: [uidFromLog],
    })) as EasAttestation

    const r = await coinbaseVerificationOnchainAdapter().probe(recipient)
    assert.equal(r.error, undefined)
    if (att.revocationTime !== 0n || (r.detail?.['uid'] !== uidFromLog && r.detail?.['revoked'] === true)) {
      // Coinbase revokes aggressively; if the sampled attestation died between the scan and
      // the probe, the probe's negative is correct and the timing assertions are moot.
      assert.equal(r.held, false)
      return
    }
    assert.equal(r.held, true, `expected held for ${recipient} (uid ${uidFromLog})`)
    assert.equal(r.issuedAt, Number(att.time))
    // The indexer path and the log path must name the same attestation — this is the
    // fallback discovery being held to the primary, on a live subject.
    assert.equal(r.detail?.['uid'], uidFromLog)
    assert.equal(r.detail?.['method'], 'indexer')
  })

  test('an address that never verified is an absence with the cross-check on record', async (t) => {
    let r
    try {
      r = await coinbaseVerificationOnchainAdapter().probe(NO_CREDENTIAL)
    } catch (e) {
      return skipUnreachable(t, 'Base RPC', e)
    }
    if (r.error) return skipUnreachable(t, 'Base RPC', r.error)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['attested'], false)
    // The zero answer was confirmed against recent logs, not just believed.
    assert.ok(typeof r.detail?.['crossCheckedFromBlock'] === 'number')
  })

  test('the on-chain adapter and the legacy GraphQL adapter agree on a live subject', async (t) => {
    let log: RawLog | undefined
    try {
      log = await sample()
    } catch (e) {
      return skipUnreachable(t, 'Base log scan', e)
    }
    if (!log) return t.skip('no Coinbase attestation in the last 200k blocks')
    const recipient = `0x${log.topics[1]!.slice(26)}` as Address

    // Imported here so the unit run never touches index.ts's network-facing module graph.
    const { coinbaseVerificationAdapter } = await import('./index.ts')
    const [onchain, graphql] = await Promise.all([
      coinbaseVerificationOnchainAdapter().probe(recipient),
      coinbaseVerificationAdapter().probe(recipient),
    ])
    if (onchain.error) return skipUnreachable(t, 'Base RPC', onchain.error)
    if (graphql.error) return skipUnreachable(t, 'EASSCAN GraphQL', graphql.error)
    // EASSCAN lags the chain by design; a just-minted attestation may not be indexed yet.
    if (onchain.held && !graphql.held) return t.skip('EASSCAN has not indexed the sampled attestation yet')
    assert.equal(onchain.held, graphql.held)
    if (onchain.held && graphql.held) {
      assert.equal(onchain.issuedAt, graphql.issuedAt)
      assert.equal(onchain.detail?.['uid'], graphql.detail?.['attestationId'])
    }
  })
})

describe('LIVE: Human Passport score from EAS', { skip: !LIVE }, () => {
  const opClient = (): PublicClient =>
    createPublicClient({
      chain: optimism,
      transport: http('https://mainnet.optimism.io', { timeout: 25_000 }),
    }) as PublicClient

  const REGISTRY_ABI = parseAbi([
    'struct SchemaRecord { bytes32 uid; address resolver; bool revocable; string schema; }',
    'function getSchema(bytes32 uid) view returns (SchemaRecord)',
  ])

  test('derived schema UIDs resolve to registered schemas on both chains', async (t) => {
    // The derivation is unit-pinned; this holds it to each chain's actual SchemaRegistry —
    // including Arbitrum's standalone (non-predeploy) deployment.
    const registries = { optimism: '0x4200000000000000000000000000000000000020', arbitrum: '0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB' } as const
    for (const chain of ['optimism', 'arbitrum'] as const) {
      const d = PASSPORT_EAS_DEPLOYMENTS[chain]
      try {
        const c = createPublicClient({ transport: http(d.rpc, { timeout: 25_000 }) }) as PublicClient
        const resolver = (await c.readContract({
          address: d.decoder,
          abi: parseAbi(['function gitcoinResolver() view returns (address)']),
          functionName: 'gitcoinResolver',
        })) as Address
        const uid = deriveSchemaUID(PASSPORT_SCORE_V2_SCHEMA, resolver, true)
        const rec = await c.readContract({
          address: registries[chain],
          abi: REGISTRY_ABI,
          functionName: 'getSchema',
          args: [uid],
        })
        assert.equal(rec.uid, uid, `${chain}: derived score-v2 UID is not registered`)
        assert.equal(rec.schema, PASSPORT_SCORE_V2_SCHEMA)
        assert.equal(rec.resolver.toLowerCase(), resolver.toLowerCase())
      } catch (e) {
        if (e instanceof assert.AssertionError) throw e
        return skipUnreachable(t, `${chain} RPC`, e)
      }
    }
  })

  test('a freshly minted score attestation is read back held, dated, decomposed — and agrees with the resolver-cache adapter', async (t) => {
    // Find a real recent recipient from the chain itself.
    let raw: RawLog | undefined
    try {
      const c = opClient()
      const head = await c.getBlockNumber()
      const resolver = (await c.readContract({
        address: PASSPORT_EAS_DEPLOYMENTS.optimism.decoder,
        abi: parseAbi(['function gitcoinResolver() view returns (address)']),
        functionName: 'gitcoinResolver',
      })) as Address
      const v2uid = deriveSchemaUID(PASSPORT_SCORE_V2_SCHEMA, resolver, true)
      for (let i = 0n; i < 60n && !raw; i++) {
        const to = head - i * 9_999n
        const logs = (await c.request({
          method: 'eth_getLogs',
          params: [
            {
              address: PASSPORT_EAS_DEPLOYMENTS.optimism.eas,
              fromBlock: toHex(to - 9_998n),
              toBlock: toHex(to),
              topics: [ATTESTED_TOPIC, null, null, v2uid],
            },
          ],
        })) as RawLog[]
        if (logs.length > 0) raw = logs[logs.length - 1]
      }
    } catch (e) {
      return skipUnreachable(t, 'Optimism log scan', e)
    }
    if (!raw) return t.skip('no score-v2 attestation in the last ~600k Optimism blocks')
    const recipient = `0x${raw.topics[1]!.slice(26)}` as Address

    const att = (await opClient().readContract({
      address: PASSPORT_EAS_DEPLOYMENTS.optimism.eas,
      abi: EAS_ABI,
      functionName: 'getAttestation',
      args: [raw.data],
    })) as EasAttestation
    const decoded = decodeScoreV2(att.data)

    const r = await gitcoinPassportAdapter().probe(recipient)
    assert.equal(r.error, undefined)
    if (decoded.score === 0 || att.revocationTime !== 0n) {
      assert.equal(r.held, false)
      return
    }
    assert.equal(r.held, true, `expected held for ${recipient} (uid ${raw.data})`)
    const perChain = r.detail?.['perChain'] as Record<string, { score: number; issuedAt: number }>
    assert.equal(perChain['optimism']!.issuedAt, Number(att.time))
    assert.equal(perChain['optimism']!.score, decoded.score)
    if (r.detail?.['chain'] === 'optimism') {
      assert.equal(r.issuedAt, Number(att.time))
      assert.equal(r.detail?.['uid'], raw.data)
      assert.equal(r.detail?.['score'], decoded.score)
    }

    // The EAS read and the resolver-cache read describe the same mint or one of them lies.
    const { humanPassportAdapter } = await import('./human-passport.ts')
    const cached = await humanPassportAdapter({ chains: ['optimism'] }).probe(recipient)
    if (cached.error) return skipUnreachable(t, 'Optimism resolver cache', cached.error)
    assert.equal(cached.held, true)
    assert.equal(cached.issuedAt, Number(att.time))
    assert.equal(cached.detail?.['score'], decoded.score)
  })

  test('an address that never minted reports absence on every chain, without error', async (t) => {
    let r
    try {
      r = await gitcoinPassportAdapter().probe(NO_CREDENTIAL)
    } catch (e) {
      return skipUnreachable(t, 'Passport RPC', e)
    }
    if (r.error) return skipUnreachable(t, 'Passport RPC', r.error)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['attested'], false)
  })
})
