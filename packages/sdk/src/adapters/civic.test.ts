/**
 * Civic Pass — unit and live.
 *
 * The unit tests pin the validity rule (`interpretCivicToken`) on every branch, including
 * the branch that is the whole story of this credential in 2026: a real token fixture,
 * copied from `getToken` on Polygon, that reads `state: ACTIVE` with a lapsed expiry —
 * expired is decided by the clock, not the state machine. The probe is additionally held to
 * the never-throws contract against dead endpoints.
 *
 * The LIVE=1 tests read the world as it is: they confirm the gatekeeper networks still carry
 * the same identities on two chains, discover a real token holder from the contract's own
 * enumeration (no address pinned — any holder's tokens are equally expired), and assert the
 * probe reports the expiry rather than either resurrecting the credential or pretending the
 * tokens are not there. If Civic ever resumes issuing, the discovery test starts exercising
 * the held path with no code change.
 *
 * Run unit: node --test --experimental-strip-types src/adapters/civic.test.ts
 * Run live: LIVE=1 node --test --experimental-strip-types src/adapters/civic.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, type PublicClient } from 'viem'
import { polygon } from 'viem/chains'
import {
  CIVIC_CHAINS,
  CIVIC_GATEWAY_ABI,
  CIVIC_GATEWAY_TOKEN,
  CIVIC_NETWORKS,
  CIVIC_NETWORK_NAMES,
  civicPassAdapter,
  interpretCivicToken,
} from './civic.ts'
import type { Address } from '../types.ts'

const LIVE = process.env['LIVE'] === '1'

/** 2026-07-25, the measurement date of every fixture in this file. */
const NOW = 1_785_000_000

/** Nobody holds the key to this address, so nobody ever held a pass on it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

/**
 * Real tokens, copied from `getToken` on Polygon on 2026-07-25 — one wallet's full pass set
 * (CAPTCHA 691556, UNIQUENESS 691557, LIVENESS 691558, owner `0x508D…6E2A`). All three sit
 * at `state 0` with 2025 expirations: the protocol died by expiry, not by revocation.
 */
const REAL_UNIQUENESS = { state: 0, expiration: 1_761_566_500 } // expired 2025-10-27
const REAL_CAPTCHA = { state: 0, expiration: 1_756_381_397 } // expired 2025-08-28

// ------------------------------------------------------------------ unit

describe('the validity rule', () => {
  test('a real 2026 uniqueness token is ACTIVE and expired — the common case', () => {
    const v = interpretCivicToken(REAL_UNIQUENESS, NOW)
    assert.equal(v.valid, false)
    assert.equal(v.reason, 'expired')
  })

  test('the same token was valid while its expiry lay ahead', () => {
    // One day before it lapsed. The rule is the clock against the token's own field.
    const v = interpretCivicToken(REAL_UNIQUENESS, REAL_UNIQUENESS.expiration - 86_400)
    assert.equal(v.valid, true)
    assert.equal(v.reason, undefined)
  })

  test('expiry is exclusive at the boundary second', () => {
    assert.equal(interpretCivicToken(REAL_UNIQUENESS, REAL_UNIQUENESS.expiration).valid, false)
    assert.equal(interpretCivicToken(REAL_UNIQUENESS, REAL_UNIQUENESS.expiration - 1).valid, true)
  })

  test('a zero expiration never expires', () => {
    assert.equal(interpretCivicToken({ state: 0, expiration: 0 }, NOW).valid, true)
  })

  test('FROZEN and REVOKED are invalid whatever the expiry says', () => {
    assert.deepEqual(interpretCivicToken({ state: 1, expiration: NOW + 1_000_000 }, NOW), {
      valid: false,
      reason: 'frozen',
    })
    assert.deepEqual(interpretCivicToken({ state: 2, expiration: 0 }, NOW), {
      valid: false,
      reason: 'revoked',
    })
  })

  test('an unknown state value is invalid, never coerced to active', () => {
    const v = interpretCivicToken({ state: 7, expiration: 0 }, NOW)
    assert.equal(v.valid, false)
    assert.equal(v.reason, 'unknown-state')
  })

  test('the captcha fixture expired earlier than the uniqueness one — expiries are per token', () => {
    assert.ok(REAL_CAPTCHA.expiration < REAL_UNIQUENESS.expiration)
    assert.equal(interpretCivicToken(REAL_CAPTCHA, NOW).reason, 'expired')
  })
})

describe('constants', () => {
  test('the personhood network ids are the four Human Passport pins', () => {
    assert.equal(CIVIC_NETWORKS.captcha, 4n)
    assert.equal(CIVIC_NETWORKS.idv, 6n)
    assert.equal(CIVIC_NETWORKS.uniqueness, 10n)
    assert.equal(CIVIC_NETWORKS.liveness, 11n)
  })

  test('every configured chain names an endpoint and a measured log window', () => {
    for (const [name, cfg] of Object.entries(CIVIC_CHAINS)) {
      assert.match(cfg.rpc, /^https:\/\//, name)
      assert.match(cfg.logRpc, /^https:\/\//, name)
      assert.ok(cfg.maxLogRange >= 10_000n, name)
    }
  })
})

describe('probe shape and the never-throws contract', () => {
  test('the adapter has the shape the registry expects', () => {
    const a = civicPassAdapter()
    assert.equal(a.adapterId, 'civic-pass')
    assert.equal(typeof a.probe, 'function')
  })

  test('every chain dead is an error, never a negative, and never a throw', async () => {
    const broken = civicPassAdapter({
      chains: ['polygon', 'ethereum'],
      rpcUrls: { polygon: 'http://127.0.0.1:9', ethereum: 'http://127.0.0.1:9' },
      timeoutMs: 700,
    })
    const r = await broken.probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    assert.ok(r.error, 'expected an error to be surfaced')
    assert.match(r.error!, /polygon/)
    assert.match(r.error!, /ethereum/)
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })

  test('one dead chain degrades to a partial read that names the casualty', async () => {
    // Only meaningful when the live chain answers; offline both fail and the previous test's
    // contract applies. Run against real endpoints only under LIVE.
    if (!LIVE) return
    const r = await civicPassAdapter({
      chains: ['polygon', 'ethereum'],
      rpcUrls: { ethereum: 'http://127.0.0.1:9' },
    }).probe(NO_CREDENTIAL)
    if (r.error) return // polygon also unreachable this run; nothing to assert
    assert.equal(r.held, false)
    assert.deepEqual(r.detail?.['chainsUnreadable'], ['ethereum'])
  })
})

// ------------------------------------------------------------------ live

function skipUnreachable(t: { skip(message: string): void }, what: string, e: unknown): void {
  t.skip(`${what} unreachable: ${e instanceof Error ? e.message : String(e)}`)
}

const polygonClient = (): PublicClient =>
  createPublicClient({
    chain: polygon,
    transport: http(CIVIC_CHAINS['polygon']!.rpc, { timeout: 25_000 }),
  }) as PublicClient

/**
 * Discover a real holder from the contract's own enumeration: the newest tokens are the
 * closest the registry has to a "recent" holder, and their owners held passes at retirement.
 */
async function sampleHolder(c: PublicClient): Promise<{ owner: Address; tokenId: bigint } | undefined> {
  const supply = (await c.readContract({
    address: CIVIC_GATEWAY_TOKEN,
    abi: CIVIC_GATEWAY_ABI,
    functionName: 'totalSupply',
  })) as bigint
  for (let i = 1n; i <= 40n && i <= supply; i++) {
    const tokenId = (await c.readContract({
      address: CIVIC_GATEWAY_TOKEN,
      abi: CIVIC_GATEWAY_ABI,
      functionName: 'tokenByIndex',
      args: [supply - i],
    })) as bigint
    const slot = (await c.readContract({
      address: CIVIC_GATEWAY_TOKEN,
      abi: CIVIC_GATEWAY_ABI,
      functionName: 'slotOf',
      args: [tokenId],
    })) as bigint
    if (slot !== CIVIC_NETWORKS.uniqueness) continue
    const [owner] = (await c.readContract({
      address: CIVIC_GATEWAY_TOKEN,
      abi: CIVIC_GATEWAY_ABI,
      functionName: 'getToken',
      args: [tokenId],
    })) as readonly [Address, number, string, bigint, bigint]
    return { owner, tokenId }
  }
  return undefined
}

describe('LIVE: Civic Gateway tokens from five chains', { skip: !LIVE }, () => {
  test('the gatekeeper networks carry the same identity on two chains', async (t) => {
    // The network name is the Solana gatekeeper-network address; identical values on
    // independent chains is what makes "slot 10 = Civic Uniqueness" a fact rather than a
    // convention read off one deployment.
    for (const chainName of ['polygon', 'arbitrum'] as const) {
      const cfg = CIVIC_CHAINS[chainName]!
      try {
        const c = createPublicClient({
          chain: cfg.chain,
          transport: http(cfg.rpc, { timeout: 25_000 }),
        }) as PublicClient
        for (const [kind, id] of Object.entries(CIVIC_NETWORKS) as ['captcha' | 'idv' | 'uniqueness' | 'liveness', bigint][]) {
          const name = await c.readContract({
            address: CIVIC_GATEWAY_TOKEN,
            abi: CIVIC_GATEWAY_ABI,
            functionName: 'getNetwork',
            args: [id],
          })
          assert.equal(name, CIVIC_NETWORK_NAMES[kind], `${chainName} network ${id}`)
        }
      } catch (e) {
        if (e instanceof assert.AssertionError) throw e
        return skipUnreachable(t, `${chainName} RPC`, e)
      }
    }
  })

  test('a real holder discovered from the registry gets the honest answer about their tokens', async (t) => {
    let sampled
    try {
      sampled = await sampleHolder(polygonClient())
    } catch (e) {
      return skipUnreachable(t, 'Polygon RPC', e)
    }
    if (!sampled) return t.skip('no uniqueness token among the newest 40 on Polygon')

    const r = await civicPassAdapter().probe(sampled.owner)
    if (r.error) return skipUnreachable(t, 'GatewayToken chains', r.error)

    const tokens = r.detail?.['tokens'] as { network: string; tokenId: number; valid: boolean; reason?: string }[]
    assert.ok(Array.isArray(tokens) && tokens.length > 0, 'the sampled tokens must be reported')
    assert.ok(
      tokens.some((tok) => tok.tokenId === Number(sampled.tokenId)),
      'the discovered token must be among them',
    )

    if (r.held) {
      // Civic resumed issuing: the held path must then be fully formed.
      assert.equal(r.detail?.['network'], 'uniqueness')
      assert.equal(r.detail?.['verifyToken'], true)
      assert.ok((r.detail?.['expiration'] as number) === 0 || (r.detail?.['expiration'] as number) > Date.now() / 1000)
    } else {
      // The world as measured 2026-07-25: every personhood token has lapsed. The probe must
      // say *expired with a date*, not shrug — and every uniqueness token must be invalid.
      assert.equal(r.detail?.['reason'], 'expired')
      assert.ok(typeof r.detail?.['newestUniquenessExpiry'] === 'number')
      for (const tok of tokens) {
        if (tok.network === 'uniqueness') assert.equal(tok.valid, false)
      }
      assert.equal(r.issuedAt, undefined, 'an expired credential must not carry an issuance date')
    }
  })

  test('verifyToken agrees with the interpretation on the sampled holder', async (t) => {
    let sampled
    try {
      sampled = await sampleHolder(polygonClient())
    } catch (e) {
      return skipUnreachable(t, 'Polygon RPC', e)
    }
    if (!sampled) return t.skip('no uniqueness token among the newest 40 on Polygon')
    try {
      const verified = await polygonClient().readContract({
        address: CIVIC_GATEWAY_TOKEN,
        abi: CIVIC_GATEWAY_ABI,
        functionName: 'verifyToken',
        args: [sampled.owner, CIVIC_NETWORKS.uniqueness],
      })
      const [, state, , expiration] = (await polygonClient().readContract({
        address: CIVIC_GATEWAY_TOKEN,
        abi: CIVIC_GATEWAY_ABI,
        functionName: 'getToken',
        args: [sampled.tokenId],
      })) as readonly [Address, number, string, bigint, bigint]
      const ours = interpretCivicToken(
        { state: Number(state), expiration: Number(expiration) },
        Math.floor(Date.now() / 1000),
      )
      assert.equal(verified, ours.valid, 'the pure rule must match the contract gate')
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e
      return skipUnreachable(t, 'Polygon RPC', e)
    }
  })

  test('an address that never held a pass is an absence across every readable chain', async (t) => {
    const r = await civicPassAdapter().probe(NO_CREDENTIAL)
    if (r.error) return skipUnreachable(t, 'GatewayToken chains', r.error)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['reason'], 'no-uniqueness-token')
    assert.deepEqual(r.detail?.['tokens'], [])
    assert.equal(r.issuedAt, undefined)
  })
})
