/**
 * Self Protocol — the parts that decide held and the date, without a network.
 *
 * The probe's judgements are (1) decoding the hub's `DisclosureVerified` payload, because the
 * recipient is un-indexed and a decode slip would make every scan miss silently, (2) the SBT
 * arithmetic that turns an expiry into a verification date, and (3) choosing which registry
 * reading dates the credential. All three are pure and pinned here — the disclosure fixture
 * is a real log captured from Celo (tx `0xac44608a…6f20`, block 73,082,826, 2026-07-25) — and
 * the network paths run live behind LIVE=1, discovering their subject from the chain rather
 * than pinning one that could churn.
 *
 * Run: node --test --experimental-strip-types src/adapters/self.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/self.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'
import {
  CELO_ENDPOINTS,
  DISCLOSURE_VERIFIED_TOPIC,
  DISCLOSURE_VERIFIED_TOPIC_OBSERVED,
  SELF_HUB_V2,
  SELF_HUB_V2_DEPLOY_BLOCK,
  SELF_REGISTRIES,
  decodeDisclosureVerified,
  interpretSbtRead,
  pickBestReading,
  selfAdapter,
  type RegistryReading,
} from './self.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

/** Nobody holds the key to this address, so nobody has ever disclosed to it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

/**
 * A real `DisclosureVerified` payload: Celo block 73,082,826, requestor SelfSBTV2
 * (`0xF5A3…8B91`), attestationId 4, recipient `0x9cf5…6323`. Truncated after the head words
 * plus the `output` bytes region the decoder needs — the decode only touches the five head
 * slots, but the offsets must be internally consistent for `decodeAbiParameters` to accept
 * the payload, so the tail is carried whole.
 */
const FIXTURE_DATA =
  ('0x000000000000000000000000000000000000000000000000000000000000a4ec' + // destChainId 42220
    '32332b93ed35ffa75a313b4b2f3e096490739747c872307590d30cf7e936483a' + // configId
    '0000000000000000000000009cf52513ffb71854a60c48807d4bb1e39bbf6323' + // userIdentifier
    '00000000000000000000000000000000000000000000000000000000000000a0' + // offset(output)
    '00000000000000000000000000000000000000000000000000000000000000e0' + // offset(userDataToPass)
    '0000000000000000000000000000000000000000000000000000000000000020' + // output: len 32
    '0000000000000000000000009cf52513ffb71854a60c48807d4bb1e39bbf6323' + // output payload
    '0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}` // userData: len 0

describe('the DisclosureVerified topic', () => {
  test('the derived topic equals the one observed on chain', () => {
    // If the signature string drifts from the contract, the scan filters on a topic no log
    // has, and every result quietly becomes "no disclosure found". This pin makes that loud.
    assert.equal(DISCLOSURE_VERIFIED_TOPIC, DISCLOSURE_VERIFIED_TOPIC_OBSERVED)
  })
})

describe('decoding the disclosure payload', () => {
  test('a real payload yields the chain id, config and recipient observed on chain', () => {
    const d = decodeDisclosureVerified(FIXTURE_DATA)
    assert.equal(d.destChainId, 42220n)
    assert.equal(d.configId, '0x32332b93ed35ffa75a313b4b2f3e096490739747c872307590d30cf7e936483a')
    assert.equal(d.userAddress, '0x9cf52513ffb71854a60c48807d4bb1e39bbf6323')
    assert.equal(d.userIdentifier, BigInt('0x9cf52513ffb71854a60c48807d4bb1e39bbf6323'))
  })

  test('an identifier wider than 160 bits is not an address', () => {
    const wide = FIXTURE_DATA.replace(
      '0000000000000000000000009cf52513ffb71854a60c48807d4bb1e39bbf6323',
      '0000000000000000000001009cf52513ffb71854a60c48807d4bb1e39bbf6323',
    ) as `0x${string}`
    const d = decodeDisclosureVerified(wide)
    assert.equal(d.userAddress, null)
    assert.ok(d.userIdentifier > 1n << 160n)
  })

  test('a zero identifier is not an address either', () => {
    const zero = FIXTURE_DATA.replace(
      '0000000000000000000000009cf52513ffb71854a60c48807d4bb1e39bbf6323',
      '0000000000000000000000000000000000000000000000000000000000000000',
    ) as `0x${string}`
    assert.equal(decodeDisclosureVerified(zero).userAddress, null)
  })
})

describe('the SBT arithmetic', () => {
  const DAY = 86_400

  test('token id 0 is the contract\'s "never verified"', () => {
    assert.deepEqual(interpretSbtRead(0n, 0n, 15_552_000n, 1_784_983_584), { held: false })
  })

  test('the date is expiry minus validity — the last verification, exactly', () => {
    // Real values from token 348 on SelfSBTV2 (read 2026-07-25): expiry 1,800,535,584 with a
    // 180-day validity puts the verification at 1,784,983,584 = 2026-07-25T12:46:24Z.
    const v = interpretSbtRead(348n, 1_800_535_584n, 15_552_000n, 1_784_990_000)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, 1_784_983_584)
    assert.equal(v.expiresAt, 1_800_535_584)
    assert.equal(v.registryExpired, false)
  })

  test('an expired token is still held — the proof happened; staleness is the curve\'s job', () => {
    const v = interpretSbtRead(7n, 1_700_000_000n, BigInt(180 * DAY), 1_784_990_000)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, 1_700_000_000 - 180 * DAY)
    assert.equal(v.registryExpired, true)
  })
})

describe('choosing the reading that dates the credential', () => {
  const r = (registry: string, issuedAt?: number): RegistryReading => ({
    registry,
    held: true,
    ...(issuedAt !== undefined ? { issuedAt } : {}),
  })

  test('no hits, no reading', () => {
    assert.equal(pickBestReading([]), undefined)
  })

  test('the newest dated hit wins — every date is a re-attestation, and Decay wants the latest', () => {
    const best = pickBestReading([r('a', 1_700_000_000), r('b', 1_780_000_000), r('c', 1_750_000_000)])
    assert.equal(best?.registry, 'b')
  })

  test('a dated hit beats an undated one regardless of order', () => {
    assert.equal(pickBestReading([r('undated'), r('dated', 1_700_000_000)])?.registry, 'dated')
  })

  test('only undated hits still decide held, with no fabricated date', () => {
    const best = pickBestReading([r('proof-of-human')])
    assert.equal(best?.registry, 'proof-of-human')
    assert.equal(best?.issuedAt, undefined)
  })
})

describe('the probe contract', () => {
  test('the adapter has the shape the registry expects', () => {
    const adapter = selfAdapter()
    assert.equal(adapter.adapterId, 'self-protocol')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('unreachable endpoints are an error, never a negative, and never a throw', async () => {
    const broken = selfAdapter({
      endpoints: [{ url: 'http://127.0.0.1:9', maxLogRange: 999_999n }],
      timeoutMs: 1_000,
    })
    const r = await broken.probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })
})

describe('live, against Celo', { skip: !LIVE }, () => {
  const adapter = selfAdapter()
  const tenderly = createPublicClient({
    chain: celo,
    transport: http('https://celo.gateway.tenderly.co', { timeout: 30_000 }),
  })

  /**
   * Find a real, recent disclosure recipient from the hub's own logs. Discovery at runtime
   * rather than a pinned subject: any pinned address's registry row could churn (SBTs can be
   * burned, verifier configs can change), but "the most recent discloser is probed as held"
   * is an invariant of the mechanism.
   */
  const findRecentSubject = async (): Promise<{ subject: Address; block: bigint } | undefined> => {
    const head = await tenderly.getBlockNumber()
    for (let i = 0; i < 8; i++) {
      const to = head - BigInt(i) * 1_000_000n
      const from = to - 999_999n
      const logs = (await tenderly.request({
        method: 'eth_getLogs',
        params: [
          {
            address: SELF_HUB_V2,
            topics: [DISCLOSURE_VERIFIED_TOPIC],
            fromBlock: `0x${from.toString(16)}`,
            toBlock: `0x${to.toString(16)}`,
          } as never,
        ],
      })) as { data: `0x${string}`; blockNumber: `0x${string}` }[]
      for (const log of logs.reverse()) {
        const d = decodeDisclosureVerified(log.data)
        if (d.userAddress && d.destChainId === 42220n) {
          return { subject: d.userAddress, block: BigInt(log.blockNumber) }
        }
      }
    }
    return undefined
  }

  test('the topic constant matches what the chain actually emits', async (t) => {
    let logs: { topics: `0x${string}`[] }[] = []
    try {
      const head = await tenderly.getBlockNumber()
      logs = (await tenderly.request({
        method: 'eth_getLogs',
        params: [
          {
            address: SELF_HUB_V2,
            topics: [DISCLOSURE_VERIFIED_TOPIC],
            fromBlock: `0x${(head - 999_999n).toString(16)}`,
            toBlock: `0x${head.toString(16)}`,
          } as never,
        ],
      })) as { topics: `0x${string}`[] }[]
    } catch (e) {
      return t.skip(`Celo endpoint unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    if (logs.length === 0) return t.skip('no disclosures in the last ~11.5 days; topic unverifiable this run')
    assert.equal(logs[0]!.topics[0], DISCLOSURE_VERIFIED_TOPIC_OBSERVED)
  })

  test('a recent discloser probes as held, dated, with provenance from the chain', async (t) => {
    let found: Awaited<ReturnType<typeof findRecentSubject>>
    try {
      found = await findRecentSubject()
    } catch (e) {
      return t.skip(`discovery failed — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    if (!found) return t.skip('no address-shaped disclosure recipient in the last ~8M blocks')
    const r = await adapter.probe(found.subject)
    if (r.error) return t.skip(`Celo endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, true, `${found.subject} disclosed at block ${found.block} and must probe as held`)
    assert.ok(r.detail?.['source'] === 'registry' || r.detail?.['source'] === 'hub-log')
    assert.equal(r.provenance?.heldFrom, 'chain')
    if (r.issuedAt !== undefined) {
      assert.ok(r.issuedAt <= Date.now() / 1000)
      // Hub deployed 2025-06-25; nothing can have been verified before it existed.
      assert.ok(r.issuedAt >= 1_750_000_000, 'a verification cannot predate the hub')
      assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    }
  })

  test('an address that never disclosed is held:false, with the scan window reported', async (t) => {
    const r = await adapter.probe(NO_CREDENTIAL)
    if (r.error) return t.skip(`Celo endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.['registriesChecked'], SELF_REGISTRIES.length)
    assert.ok(typeof r.detail?.['scannedFromBlock'] === 'number')
    assert.ok(typeof r.detail?.['scannedToBlock'] === 'number')
    assert.ok(
      BigInt(r.detail?.['scannedFromBlock'] as number) >= SELF_HUB_V2_DEPLOY_BLOCK,
      'the scan must never claim to have searched blocks before the hub existed',
    )
  })

  test('every pinned registry still answers its address-keyed view', async (t) => {
    // The registries are integrator contracts; any of them could be abandoned or upgraded.
    // This canary distinguishes "registry went away" from "subject not verified".
    for (const registry of SELF_REGISTRIES) {
      const single = selfAdapter({ registries: [registry], maxLogCalls: 1 })
      const r = await single.probe(NO_CREDENTIAL)
      if (r.error) return t.skip(`Celo endpoints unavailable — ${r.error.split(';')[0]}`)
      assert.equal(
        r.detail?.['registriesChecked'],
        1,
        `${registry.label} (${registry.address}) failed its read — investigate before trusting negatives`,
      )
    }
  })

  test('the endpoints agree about head within tolerance', async (t) => {
    // All three endpoints are third-party infrastructure; this catches one serving a stale
    // fork or refusing service, which would silently degrade the probe to fewer fallbacks.
    const heads: number[] = []
    for (const e of CELO_ENDPOINTS) {
      try {
        const c = createPublicClient({ chain: celo, transport: http(e.url, { timeout: 15_000 }) })
        heads.push(Number(await c.getBlockNumber()))
      } catch {
        // One endpoint down is the adapter's normal fallback case, not a failure here.
      }
    }
    if (heads.length < 2) return t.skip('fewer than two Celo endpoints answered')
    assert.ok(Math.max(...heads) - Math.min(...heads) < 600, `heads diverge: ${heads.join(', ')}`)
  })
})
