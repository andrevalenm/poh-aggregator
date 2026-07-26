/**
 * Humanode — the pure parts (storage-key hashing, SCALE decoding, selector derivation) and
 * the probe's decision tree against a fake JSON-RPC server, without a network. The live
 * suite re-verifies the constants this adapter carries — the seven-day authentication
 * lifetime above all — against the chain they were measured from.
 *
 * Run: node --test --experimental-strip-types src/adapters/humanode.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/humanode.test.ts
 */
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { createPublicClient, defineChain, http } from 'viem'
import {
  ACTIVE_AUTHENTICATIONS_KEY,
  ACTIVE_AUTHENTICATIONS_KEY_OBSERVED,
  AUTHENTICATIONS_EXPIRE_AFTER_MS,
  EVM_ACCOUNTS_PREFIX,
  HUMANODE_BIOAUTH_PRECOMPILE,
  HUMANODE_CHAIN_ID,
  HUMANODE_MAPPING_PRECOMPILE,
  HUMANODE_RPCS,
  IS_AUTHENTICATED_SELECTOR,
  IS_AUTHENTICATED_SELECTOR_OBSERVED,
  decodeActiveAuthentications,
  humanodeAdapter,
  twox128,
  xxhash64,
} from './humanode.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

const SUBJECT = '0x1111111111111111111111111111111111111111' as Address
const NATIVE = `0x${'ab'.repeat(32)}` as const

// ------------------------------------------------------------------ hashing

describe('twox128 storage-key derivation', () => {
  test('xxhash64 matches the reference implementation', () => {
    // Vectors produced by the C-backed python-xxhash on 2026-07-25.
    const enc = (s: string) => new TextEncoder().encode(s)
    assert.equal(xxhash64(enc(''), 0n), 0xef46db3751d8e999n)
    assert.equal(xxhash64(enc('abc'), 0n), 0x44bc2cf5ad770999n)
    assert.equal(xxhash64(enc('Bioauth'), 0n), 0x6400d087cf3e1b78n)
    assert.equal(xxhash64(enc('Bioauth'), 1n), 0xf10289054e5cb2b2n)
    // ≥32 bytes exercises the four-lane stripe path the short names never reach.
    assert.equal(xxhash64(enc('a'.repeat(40)), 0n), 0x569ea6843111ef03n)
  })

  test('the derived ActiveAuthentications key equals the one observed serving live state', () => {
    // A typo in a pallet or storage name would produce a key that reads null forever —
    // which decodes as "nobody is authenticated". This pin makes that impossible to miss.
    assert.equal(ACTIVE_AUTHENTICATIONS_KEY, ACTIVE_AUTHENTICATIONS_KEY_OBSERVED)
  })

  test('the selector derivation equals the literal the precompile answered to', () => {
    assert.equal(IS_AUTHENTICATED_SELECTOR, IS_AUTHENTICATED_SELECTOR_OBSERVED)
  })

  test('the accounts-map prefix is 32 bytes of twox128 pair, distinct from the bioauth key', () => {
    assert.equal(EVM_ACCOUNTS_PREFIX.length, 2 + 64)
    assert.notEqual(EVM_ACCOUNTS_PREFIX, ACTIVE_AUTHENTICATIONS_KEY)
    assert.equal(twox128('Bioauth').length, 32)
  })
})

// ------------------------------------------------------------- SCALE decode

/** SCALE-encode a Vec<(pubkey32, u64le)> the way the pallet stores it. */
function encodeAuths(entries: { publicKey: `0x${string}`; expiresAtMs: number }[]): `0x${string}` {
  const len = entries.length
  const compact =
    len < 64
      ? [(len << 2) & 0xff]
      : [((len << 2) | 1) & 0xff, (len >> 6) & 0xff] // two-byte mode, enough for MAX_AUTHENTICATIONS
  const bytes: number[] = [...compact]
  for (const e of entries) {
    for (let i = 0; i < 32; i++) bytes.push(parseInt(e.publicKey.slice(2 + i * 2, 4 + i * 2), 16))
    let v = BigInt(e.expiresAtMs)
    for (let i = 0; i < 8; i++) {
      bytes.push(Number(v & 0xffn))
      v >>= 8n
    }
  }
  return `0x${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

describe('decoding Bioauth.ActiveAuthentications', () => {
  test('empty storage decodes to no authentications', () => {
    assert.deepEqual(decodeActiveAuthentications('0x'), [])
    assert.deepEqual(decodeActiveAuthentications('0x00'), [])
  })

  test('round-trips a single entry', () => {
    const entry = { publicKey: NATIVE, expiresAtMs: 1_785_008_040_012 }
    assert.deepEqual(decodeActiveAuthentications(encodeAuths([entry])), [entry])
  })

  test('round-trips a validator-set-sized vector through the two-byte length mode', () => {
    // 82 entries was the live count on 2026-07-25; 100 forces the same compact mode.
    const entries = Array.from({ length: 100 }, (_, i) => ({
      publicKey: `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`,
      expiresAtMs: 1_785_000_000_000 + i,
    }))
    assert.deepEqual(decodeActiveAuthentications(encodeAuths(entries)), entries)
  })

  test('a truncated payload throws rather than inventing a shorter validator set', () => {
    const good = encodeAuths([{ publicKey: NATIVE, expiresAtMs: 1 }])
    assert.throws(() => decodeActiveAuthentications(good.slice(0, -8)), /truncated/)
  })

  test('an implausible big-integer length prefix throws', () => {
    assert.throws(() => decodeActiveAuthentications('0x03ffffffff'), /not a plausible/)
  })
})

// --------------------------------------------------------- fake-server probe

interface FakeState {
  mappingResult: string // eth_call output of the mapping precompile
  bioauthResult: string // eth_call output of the bioauth precompile
  storageResult: string | null | 'ERROR'
  calls: string[]
}

function fakeRpc(state: FakeState): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { id, method, params } = JSON.parse(body)
      state.calls.push(method)
      const reply = (result: unknown) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result }))
      }
      const fail = (message: string) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }))
      }
      if (method === 'eth_chainId') return reply('0x1472')
      if (method === 'eth_blockNumber') return reply('0x1234')
      if (method === 'eth_call') {
        const to = (params[0].to as string).toLowerCase()
        if (to === HUMANODE_MAPPING_PRECOMPILE.toLowerCase()) return reply(state.mappingResult)
        if (to === HUMANODE_BIOAUTH_PRECOMPILE.toLowerCase()) return reply(state.bioauthResult)
        return fail(`unexpected eth_call to ${to}`)
      }
      if (method === 'state_getStorage') {
        if (state.storageResult === 'ERROR') return fail('state backend down')
        return reply(state.storageResult)
      }
      return fail(`unexpected method ${method}`)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolve({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}` })
    })
  })
}

const BOOL_TRUE = `0x${'0'.repeat(63)}1`
const BOOL_FALSE = `0x${'0'.repeat(64)}`

describe('the probe against a fake node', () => {
  const servers: Server[] = []
  after(() => servers.forEach((s) => s.close()))

  const adapterFor = async (state: FakeState) => {
    const { server, url } = await fakeRpc(state)
    servers.push(server)
    return humanodeAdapter({ rpcUrls: [url], timeoutMs: 2_000 })
  }

  test('the adapter has the shape the registry expects', () => {
    const adapter = humanodeAdapter()
    assert.equal(adapter.adapterId, 'humanode')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('unreachable endpoints are an error, never a negative, and never a throw', async () => {
    const broken = humanodeAdapter({ rpcUrls: ['http://127.0.0.1:9'], timeoutMs: 1_000 })
    const r = await broken.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })

  test('an address with no claimed mapping is not held, and the detail says which step was absent', async () => {
    const state: FakeState = { mappingResult: '0x', bioauthResult: BOOL_FALSE, storageResult: null, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.equal(r.error, undefined)
    assert.equal(r.detail?.['mapped'], false)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.ok(!state.calls.includes('state_getStorage'), 'no mapping means no reason to read state')
  })

  test('a mapped account whose weekly bioauth lapsed is not held, but the mapping is reported', async () => {
    const state: FakeState = { mappingResult: NATIVE, bioauthResult: BOOL_FALSE, storageResult: null, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['mapped'], true)
    assert.equal(r.detail?.['nativeAccount'], NATIVE)
    assert.equal(r.detail?.['bioauthActive'], false)
  })

  test('a mapped, actively bioauthenticated account is held, dated expiry-minus-seven-days', async () => {
    const expiresAtMs = Date.now() + 3 * 24 * 3600 * 1000 // authenticated ~4 days ago
    const state: FakeState = {
      mappingResult: NATIVE,
      bioauthResult: BOOL_TRUE,
      storageResult: encodeAuths([
        { publicKey: `0x${'01'.repeat(32)}`, expiresAtMs: expiresAtMs + 1000 },
        { publicKey: NATIVE, expiresAtMs },
      ]),
      calls: [],
    }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, Math.floor((expiresAtMs - AUTHENTICATIONS_EXPIRE_AFTER_MS) / 1000))
    assert.equal(r.detail?.['bioauthActive'], true)
    assert.equal(r.detail?.['expiresAt'], Math.floor(expiresAtMs / 1000))
    assert.equal(r.detail?.['activeAuthentications'], 2)
    assert.equal(r.provenance?.dateFrom, 'chain')
  })

  test('losing the state read loses the date, never the credential', async () => {
    const state: FakeState = { mappingResult: NATIVE, bioauthResult: BOOL_TRUE, storageResult: 'ERROR', calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.ok(r.detail?.['undated'], 'a dateless result must say why it has no date')
    assert.equal(r.provenance?.dateFrom, 'none')
  })

  test('a clock-skewed expiry can never date a credential in the future', async () => {
    // If the runtime's expire-after constant ever shrinks, expiry-minus-seven-days could
    // exceed now; the clamp turns that into "issued this instant", not a future issuance.
    const expiresAtMs = Date.now() + AUTHENTICATIONS_EXPIRE_AFTER_MS + 60 * 60 * 1000
    const state: FakeState = {
      mappingResult: NATIVE,
      bioauthResult: BOOL_TRUE,
      storageResult: encodeAuths([{ publicKey: NATIVE, expiresAtMs }]),
      calls: [],
    }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, true)
    assert.ok(r.issuedAt! <= Math.ceil(Date.now() / 1000))
  })

  test('a malformed mapping result is an error, not a fabricated account', async () => {
    const state: FakeState = { mappingResult: '0x1234', bioauthResult: BOOL_TRUE, storageResult: null, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.ok(r.error?.includes('32-byte account'))
  })
})

// ------------------------------------------------------------------- live

describe('live, against Humanode mainnet', { skip: !LIVE }, () => {
  const chain = defineChain({
    id: HUMANODE_CHAIN_ID,
    name: 'Humanode',
    nativeCurrency: { name: 'eHMND', symbol: 'eHMND', decimals: 18 },
    rpcUrls: { default: { http: [...HUMANODE_RPCS] } },
  })
  const client = createPublicClient({ chain, transport: http(HUMANODE_RPCS[0], { timeout: 30_000 }) })
  const adapter = humanodeAdapter()

  const readAuths = async () => {
    const raw = (await client.request({
      method: 'state_getStorage' as never,
      params: [ACTIVE_AUTHENTICATIONS_KEY] as never,
    })) as string | null
    assert.ok(typeof raw === 'string', 'ActiveAuthentications must exist on a chain whose consensus depends on it')
    return decodeActiveAuthentications(raw)
  }

  test('the derived storage key reads a decodable, non-empty validator set', async (t) => {
    let auths
    try {
      auths = await readAuths()
    } catch (e) {
      return t.skip(`Humanode endpoint unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    assert.ok(auths.length > 0, 'a live chain has live validators')
    // Re-verify the seven-day constant against reality: every active authentication must
    // expire in the future and within the lifetime this adapter dates by.
    const now = Date.now()
    for (const a of auths) {
      assert.ok(a.expiresAtMs > now - 60_000, `expiry ${a.expiresAtMs} is in the past`)
      assert.ok(
        a.expiresAtMs <= now + AUTHENTICATIONS_EXPIRE_AFTER_MS + 3_600_000,
        `expiry ${a.expiresAtMs} exceeds the 7-day lifetime — the runtime constant changed`,
      )
    }
  })

  test('the bioauth precompile agrees with state: an active key is authenticated, the zero key is not', async (t) => {
    let auths
    try {
      auths = await readAuths()
    } catch (e) {
      return t.skip(`Humanode endpoint unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    const active = auths[0]!.publicKey
    const yes = await client.call({
      to: HUMANODE_BIOAUTH_PRECOMPILE,
      data: (IS_AUTHENTICATED_SELECTOR + active.slice(2)) as `0x${string}`,
    })
    assert.equal(BigInt(yes.data ?? '0x0'), 1n)
    const no = await client.call({
      to: HUMANODE_BIOAUTH_PRECOMPILE,
      data: (IS_AUTHENTICATED_SELECTOR + '00'.repeat(32)) as `0x${string}`,
    })
    assert.equal(BigInt(no.data ?? '0x0'), 0n)
  })

  test('holders are discovered from chain, or their absence is asserted, never assumed', async (t) => {
    // The EvmAccountsMapping pallet held zero entries on 2026-07-25 — nobody has claimed an
    // EVM address. This test enumerates the map every run: the day a mapping appears, the
    // probe is exercised against it end to end; until then the zero-population claim in the
    // research file is re-checked rather than trusted.
    let keys: string[]
    try {
      keys = (await client.request({
        method: 'state_getKeysPaged' as never,
        params: [EVM_ACCOUNTS_PREFIX, 25, null] as never,
      })) as string[]
    } catch (e) {
      return t.skip(`Humanode endpoint unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    if (keys.length === 0) {
      // Zero population: any address must read unmapped, cheaply and without error.
      const r = await adapter.probe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address)
      if (r.error) return t.skip(`endpoint faltered mid-probe — ${r.error}`)
      assert.equal(r.held, false)
      assert.equal(r.detail?.['mapped'], false)
      return
    }
    // A mapping exists: the key suffix after twox64_concat is the claimed EVM address.
    const suffix = keys[0]!.slice(2 + 64 + 16)
    const evmAddress = `0x${suffix.slice(0, 40)}` as Address
    const auths = await readAuths()
    const r = await adapter.probe(evmAddress)
    if (r.error) return t.skip(`endpoint faltered mid-probe — ${r.error}`)
    assert.equal(r.detail?.['mapped'], true)
    const native = r.detail?.['nativeAccount'] as string
    const shouldHold = auths.some((a) => a.publicKey === native.toLowerCase())
    assert.equal(r.held, shouldHold, 'probe verdict must match ActiveAuthentications membership')
    if (r.held) {
      assert.ok(typeof r.issuedAt === 'number')
      assert.ok(r.issuedAt! > Date.now() / 1000 - AUTHENTICATIONS_EXPIRE_AFTER_MS / 1000 - 3_600)
      assert.ok(r.issuedAt! <= Date.now() / 1000)
    }
  })
})
