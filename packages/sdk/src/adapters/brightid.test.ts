/**
 * BrightID — the verdict as a pure function of the registry struct, the probe's shape
 * against a fake JSON-RPC server, and a live suite that discovers real registrants from the
 * chain's own `Verified` logs rather than pinning addresses that could be superseded.
 *
 * Run: node --test --experimental-strip-types src/adapters/brightid.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/brightid.test.ts
 */
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import {
  createPublicClient,
  defineChain,
  encodeFunctionResult,
  hexToString,
  http,
  toFunctionSelector,
} from 'viem'
import {
  BRIGHTID_REGISTRY_ABI,
  BRIGHTID_SNAPSHOT_REGISTRY,
  BRIGHTID_VERIFIED_TOPIC,
  IDCHAIN_ID,
  IDCHAIN_RPCS,
  brightIdAdapter,
  interpretBrightIdVerification,
} from './brightid.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

const SUBJECT = '0x1111111111111111111111111111111111111111' as Address
const PREV = '0x2222222222222222222222222222222222222222' as Address
/** Nobody holds the key to this address, so nobody could have obtained a verification for it. */
const NOBODY = '0x0000000000000000000000000000000000000001' as Address

// -------------------------------------------------------------- pure verdict

describe('interpreting the verifications struct', () => {
  test('a current verification is held, dated from the node-signed timestamp', () => {
    const v = interpretBrightIdVerification(1_642_819_837n, true)
    assert.equal(v.held, true)
    assert.equal(v.issuedAt, 1_642_819_837)
    assert.equal(v.detail['registered'], true)
  })

  test('a voided address — its human re-linked elsewhere — is superseded, not unregistered', () => {
    const v = interpretBrightIdVerification(1_642_819_837n, false)
    assert.equal(v.held, false)
    assert.equal(v.issuedAt, undefined)
    assert.equal(v.detail['superseded'], true)
    assert.equal(v.detail['verificationTime'], 1_642_819_837)
  })

  test('a never-registered address is simply not registered', () => {
    const v = interpretBrightIdVerification(0n, false)
    assert.equal(v.held, false)
    assert.deepEqual(v.detail, { registered: false })
  })
})

// --------------------------------------------------------- fake-server probe

const VERIFICATIONS_SELECTOR = toFunctionSelector('verifications(address)')
const HISTORY_SELECTOR = toFunctionSelector('history(address)')

interface FakeState {
  time: bigint
  isVerified: boolean
  previous: Address
  calls: string[]
}

function fakeRpc(state: FakeState): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { id, method, params } = JSON.parse(body)
      const reply = (result: unknown) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result }))
      }
      if (method === 'eth_chainId') return reply('0x4a')
      if (method === 'eth_blockNumber') return reply('0x2519b57')
      if (method === 'eth_call') {
        const data = (params[0].data as string).slice(0, 10)
        state.calls.push(data)
        if (data === VERIFICATIONS_SELECTOR) {
          return reply(
            encodeFunctionResult({
              abi: BRIGHTID_REGISTRY_ABI,
              functionName: 'verifications',
              result: [state.time, state.isVerified],
            }),
          )
        }
        if (data === HISTORY_SELECTOR) {
          return reply(
            encodeFunctionResult({ abi: BRIGHTID_REGISTRY_ABI, functionName: 'history', result: state.previous }),
          )
        }
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: `unexpected ${method}` } }))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      resolve({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}` })
    })
  })
}

const ZERO = '0x0000000000000000000000000000000000000000' as Address

describe('the probe against a fake registry', () => {
  const servers: Server[] = []
  after(() => servers.forEach((s) => s.close()))

  const adapterFor = async (state: FakeState) => {
    const { server, url } = await fakeRpc(state)
    servers.push(server)
    return brightIdAdapter({ rpcUrls: [url], timeoutMs: 2_000 })
  }

  test('the adapter has the shape the registry expects', () => {
    const adapter = brightIdAdapter()
    assert.equal(adapter.adapterId, 'brightid')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('unreachable endpoints are an error, never a negative, and never a throw', async () => {
    const broken = brightIdAdapter({ rpcUrls: ['http://127.0.0.1:9'], timeoutMs: 1_000 })
    const r = await broken.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })

  test('a verified subject is held, dated, and carries its address-history link', async () => {
    const state: FakeState = { time: 1_710_265_439n, isVerified: true, previous: PREV, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, 1_710_265_439)
    assert.equal(r.detail?.['app'], 'snapshot')
    assert.equal(r.detail?.['registry'], BRIGHTID_SNAPSHOT_REGISTRY)
    assert.equal(r.detail?.['previousAddress'], PREV)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.equal(r.provenance?.headBlock, 0x2519b57)
  })

  test('a subject with no history link omits the field instead of reporting the zero address', async () => {
    const state: FakeState = { time: 1_642_819_837n, isVerified: true, previous: ZERO, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.detail?.['previousAddress'], undefined)
  })

  test('a superseded subject is not held and says so, without a date', async () => {
    const state: FakeState = { time: 1_642_819_837n, isVerified: false, previous: ZERO, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.['superseded'], true)
    assert.equal(r.provenance?.dateFrom, 'none')
  })

  test('an unregistered subject reads one call, not three', async () => {
    const state: FakeState = { time: 0n, isVerified: false, previous: ZERO, calls: [] }
    const adapter = await adapterFor(state)
    const r = await adapter.probe(SUBJECT)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['registered'], false)
    assert.deepEqual(state.calls, [VERIFICATIONS_SELECTOR], 'no time means no history lookup')
  })
})

// ------------------------------------------------------------------- live

describe('live, against IDChain', { skip: !LIVE }, () => {
  const chain = defineChain({
    id: IDCHAIN_ID,
    name: 'IDChain',
    nativeCurrency: { name: 'Eidi', symbol: 'EIDI', decimals: 18 },
    rpcUrls: { default: { http: [...IDCHAIN_RPCS] } },
  })
  const client = createPublicClient({ chain, transport: http(IDCHAIN_RPCS[0], { timeout: 60_000 }) })
  const adapter = brightIdAdapter()

  test('the registry still serves the app it was measured serving', async (t) => {
    try {
      const app = await client.readContract({
        address: BRIGHTID_SNAPSHOT_REGISTRY,
        abi: BRIGHTID_REGISTRY_ABI,
        functionName: 'app',
      })
      assert.equal(hexToString(app, { size: 32 }).replace(/\0+$/, ''), 'snapshot')
    } catch (e) {
      t.skip(`IDChain unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
  })

  test('a registrant discovered from the Verified logs is held, dated from the registry', async (t) => {
    // Full-history log scan — measured ~9 s for 237 logs on 2026-07-25. Addresses are taken
    // newest-first and checked against current state, because any pinned registrant could be
    // superseded by a re-link tomorrow.
    let logs: { topics: string[] }[]
    try {
      logs = (await client.request({
        method: 'eth_getLogs',
        params: [
          {
            address: BRIGHTID_SNAPSHOT_REGISTRY,
            fromBlock: '0x0',
            toBlock: 'latest',
            topics: [BRIGHTID_VERIFIED_TOPIC],
          } as never,
        ],
      })) as { topics: string[] }[]
    } catch (e) {
      return t.skip(`IDChain unavailable — ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
    assert.ok(logs.length > 0, 'the registry has 237 historical registrations; zero means the scan is broken')

    let held: Awaited<ReturnType<typeof adapter.probe>> | undefined
    let heldAddr: Address | undefined
    let superseded: Awaited<ReturnType<typeof adapter.probe>> | undefined
    for (const log of logs.slice(-25).reverse()) {
      const addr = `0x${log.topics[1]!.slice(26)}` as Address
      const r = await adapter.probe(addr)
      if (r.error) return t.skip(`IDChain faltered mid-probe — ${r.error}`)
      if (r.held && !held) {
        held = r
        heldAddr = addr
      }
      if (!r.held && r.detail?.['superseded'] === true && !superseded) superseded = r
      if (held && superseded) break
    }
    assert.ok(held && heldAddr, 'at least one of the latest 25 registrants must still be verified')
    assert.ok(typeof held.issuedAt === 'number' && held.issuedAt > 1_640_000_000, 'registrations began 2022-01-22')
    assert.ok(held.issuedAt! <= Date.now() / 1000)
    assert.equal(held.detail?.['app'], 'snapshot')
    assert.equal(held.provenance?.heldFrom, 'chain')
    assert.equal(held.provenance?.dateFrom, 'chain')
    // Cross-check the struct-based verdict against the view function Snapshot itself calls.
    const confirmed = await client.readContract({
      address: BRIGHTID_SNAPSHOT_REGISTRY,
      abi: BRIGHTID_REGISTRY_ABI,
      functionName: 'isVerifiedUser',
      args: [heldAddr],
    })
    assert.equal(confirmed, true, 'isVerifiedUser must agree with the verifications struct')
    if (superseded) {
      assert.equal(superseded.issuedAt, undefined)
      assert.ok((superseded.detail?.['verificationTime'] as number) > 1_640_000_000)
    }
  })

  test('an address that never touched BrightID is not held', async (t) => {
    const r = await adapter.probe(NOBODY)
    if (r.error) return t.skip(`IDChain unavailable — ${r.error}`)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['registered'], false)
    assert.equal(r.issuedAt, undefined)
  })
})
