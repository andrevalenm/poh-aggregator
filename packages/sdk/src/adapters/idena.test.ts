/**
 * Idena — the parts that decide held and the date, without a network.
 *
 * The probe's judgements are (1) mapping the identity-state ladder onto held, and (2) dating
 * a validated state from the current epoch's start block. Both are exercised here through the
 * injectable RPC seam; the network paths run live behind LIVE=1, discovering real identities
 * at probe time rather than pinning addresses that could lapse at the next ceremony (~5 days).
 *
 * Run: node --test --experimental-strip-types src/adapters/idena.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/idena.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  idenaAdapter,
  interpretIdenaIdentity,
  IDENA_VALIDATED_STATES,
  type IdenaIdentity,
  type IdenaRpcCall,
} from './idena.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

/** Nobody holds the key to this address; the node fabricates an all-zero Undefined identity. */
const NO_IDENTITY = '0x0000000000000000000000000000000000000001' as Address
const SUBJECT = '0xFf09b6Ff94526B41091452dDFf5e04292a56Eb8A' as Address

/** Shaped like the real epoch-215 records read from restricted.idena.io on 2026-07-25. */
const identity = (over: Partial<IdenaIdentity> = {}): IdenaIdentity => ({
  address: SUBJECT.toLowerCase(),
  state: 'Human',
  age: 87,
  stake: '589934.950895169914558774',
  online: true,
  delegatee: null,
  penalty: '0',
  ...over,
})

const EPOCH = { epoch: 215, startBlock: 11_066_316, nextValidation: '2026-07-26T15:00:00Z' }
const EPOCH_START_TS = 1_784_648_021

/** An RPC seam serving the three methods the probe uses, from fixtures. */
const fakeRpc =
  (id: IdenaIdentity, opts: { failDating?: boolean } = {}): IdenaRpcCall =>
  async (method) => {
    if (method === 'dna_identity') return id
    if (opts.failDating) throw new Error('dating endpoint down')
    if (method === 'dna_epoch') return EPOCH
    if (method === 'bcn_blockAt') return { height: EPOCH.startBlock, timestamp: EPOCH_START_TS }
    throw new Error(`unexpected method ${method}`)
  }

describe('interpreting the identity-state ladder', () => {
  test('every validated state is held, and only those', () => {
    for (const state of IDENA_VALIDATED_STATES) {
      assert.equal(interpretIdenaIdentity(identity({ state })).held, true, state)
    }
    for (const state of ['Candidate', 'Suspended', 'Zombie', 'Killed', 'Invite']) {
      const v = interpretIdenaIdentity(identity({ state }))
      assert.equal(v.held, false, state)
      // A lapsed identity is a real observation — the state must survive into the detail.
      assert.equal(v.detail['state'], state)
      assert.equal(v.detail['reason'], 'state-not-validated')
    }
  })

  test('Undefined is "no identity", not "an identity in a bad state"', () => {
    const v = interpretIdenaIdentity(identity({ state: 'Undefined', age: 0, stake: '0', online: false }))
    assert.equal(v.held, false)
    assert.equal(v.detail['identityFound'], false)
    assert.equal(v.detail['state'], undefined)
  })

  test('a pooled identity is held but says who pulls its strings', () => {
    // Delegation to pools is the puppeteering shape the Idena founder's own paper documented;
    // the credential stands (the human did validate) but the caller must be able to see it.
    const v = interpretIdenaIdentity(identity({ delegatee: '0x0d028dfb7f558c99adf0ce6e31d67e6fbaf4fafc' }))
    assert.equal(v.held, true)
    assert.equal(v.detail['pooled'], true)
    assert.equal(v.detail['delegatee'], '0x0d028dfb7f558c99adf0ce6e31d67e6fbaf4fafc')
  })

  test('stake and tenure survive into the detail as numbers', () => {
    const v = interpretIdenaIdentity(identity())
    assert.equal(v.detail['ageEpochs'], 87)
    assert.ok(Math.abs((v.detail['stakeIdna'] as number) - 589_934.95) < 0.01)
    assert.equal(v.detail['pooled'], false)
  })

  test('an unparseable stake becomes 0, not NaN', () => {
    assert.equal(interpretIdenaIdentity(identity({ stake: 'garbage' })).detail['stakeIdna'], 0)
  })
})

describe('the probe, through the RPC seam', () => {
  test('a Human identity is held, dated from the epoch start block', async () => {
    const r = await idenaAdapter({ call: fakeRpc(identity()) }).probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, EPOCH_START_TS)
    assert.equal(r.detail?.['state'], 'Human')
    assert.equal(r.detail?.['epoch'], 215)
    assert.equal(r.detail?.['lastValidationAt'], EPOCH_START_TS)
    assert.equal(r.provenance?.heldFrom, 'chain')
    assert.equal(r.provenance?.dateFrom, 'chain')
    assert.equal(r.error, undefined)
  })

  test('a Suspended identity is held:false with the state on display, and no date calls made', async () => {
    let datingCalls = 0
    const call: IdenaRpcCall = async (method) => {
      if (method === 'dna_identity') return identity({ state: 'Suspended' })
      datingCalls++
      throw new Error('should not be called')
    }
    const r = await idenaAdapter({ call }).probe(SUBJECT)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['state'], 'Suspended')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.error, undefined)
    assert.equal(datingCalls, 0, 'a negative must not spend the dating round-trips')
  })

  test('when dating fails, held stands and the result says why it is undated', async () => {
    // held was proven by dna_identity; losing dna_epoch/bcn_blockAt afterwards must degrade
    // loudly to an undated positive, never to held:false and never to a fabricated date.
    const r = await idenaAdapter({ call: fakeRpc(identity(), { failDating: true }) }).probe(SUBJECT)
    assert.equal(r.held, true)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.dateFrom, 'none')
    assert.ok(String(r.detail?.['undated']).includes('dating endpoint down'))
  })

  test('a malformed identity reply is an error, not a negative', async () => {
    const r = await idenaAdapter({ call: async () => ({ nonsense: true }) }).probe(SUBJECT)
    assert.equal(r.held, false)
    assert.ok(r.error?.includes('no identity state'))
  })

  test('an RPC-level failure is an error, never a throw', async () => {
    const r = await idenaAdapter({
      call: async () => {
        throw new Error('API key is invalid')
      },
    }).probe(SUBJECT)
    assert.equal(r.held, false)
    assert.ok(r.error?.includes('API key is invalid'))
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })

  test('the adapter has the shape the registry expects', () => {
    const adapter = idenaAdapter()
    assert.equal(adapter.adapterId, 'idena')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('a dead endpoint is an error, never a negative, and never a throw', async () => {
    const r = await idenaAdapter({ rpcUrl: 'http://127.0.0.1:9', timeoutMs: 1_000 }).probe(NO_IDENTITY)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.equal(r.issuedAt, undefined)
  })

  test('a wrong key is an error that names the plain-text 403, not a negative', async () => {
    // The real node answers bad keys with HTTP 403 and a non-JSON body; this pins the
    // transport's non-JSON path using a local fixture server rather than the live node.
    const { createServer } = await import('node:http')
    const server = createServer((_req, res) => {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('API key is invalid')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    try {
      const r = await idenaAdapter({ rpcUrl: `http://127.0.0.1:${port}`, nodeKey: 'nope' }).probe(NO_IDENTITY)
      assert.equal(r.held, false)
      assert.ok(r.error?.includes('API key is invalid'))
      assert.ok(r.error?.includes('403'))
    } finally {
      server.close()
    }
  })
})

describe('live, against restricted.idena.io', { skip: !LIVE }, () => {
  const adapter = idenaAdapter()

  /**
   * Discovery is the indexer's only role here: api.idena.io lists candidate addresses, the
   * node RPC alone decides held. Identities are discovered at run time because with ~5-day
   * epochs any pinned address could be Suspended by next week.
   */
  const discover = async (path: string): Promise<{ address: string; state?: string }[]> => {
    const res = await fetch(`https://api.idena.io/api/${path}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`indexer ${path}: HTTP ${res.status}`)
    const json = (await res.json()) as { result?: { address: string; state?: string }[] }
    return json.result ?? []
  }

  test('a currently-online identity probes as held, dated within the last epoch', async (t) => {
    let candidates: { address: string }[]
    try {
      candidates = await discover('OnlineIdentities?limit=10')
    } catch (e) {
      return t.skip(`indexer unavailable for discovery — ${e instanceof Error ? e.message : e}`)
    }
    if (candidates.length === 0) return t.skip('indexer returned no online identities')

    let held: Awaited<ReturnType<typeof adapter.probe>> | undefined
    for (const c of candidates.slice(0, 5)) {
      const r = await adapter.probe(c.address as Address)
      if (r.error) return t.skip(`node unavailable — ${r.error.split('\n')[0]}`)
      if (r.held) {
        held = r
        break
      }
    }
    if (!held) return t.skip('no sampled online identity was in a validated state this run')

    assert.ok(
      (IDENA_VALIDATED_STATES as readonly string[]).includes(held.detail?.['state'] as string),
      `state ${String(held.detail?.['state'])} must be validated`,
    )
    const now = Math.floor(Date.now() / 1000)
    assert.ok(typeof held.issuedAt === 'number', 'a validated identity must carry the ceremony date')
    assert.ok(held.issuedAt! <= now, 'the ceremony is in the past')
    // Epochs run ~5 days at current network size and lengthen with growth; 35 days is the
    // documented weekly cadence with a generous margin, not a guess about today's epoch.
    assert.ok(held.issuedAt! > now - 35 * 86_400, 'the ceremony date must be within the current epoch era')
    assert.equal(held.provenance?.heldFrom, 'chain')
    assert.equal(held.provenance?.dateFrom, 'chain')
    assert.ok((held.detail?.['ageEpochs'] as number) >= 1)
  })

  test('an address that never touched Idena is held:false with identityFound:false', async (t) => {
    const r = await adapter.probe(NO_IDENTITY)
    if (r.error) return t.skip(`node unavailable — ${r.error.split('\n')[0]}`)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['identityFound'], false)
    assert.equal(r.issuedAt, undefined)
  })

  test('a lapsed identity is held:false with its state named', async (t) => {
    // Hunt a Suspended/Zombie identity from the last epoch's roll. The indexer supplies the
    // candidate; the node's answer is what is asserted.
    let epoch: number
    try {
      const res = await fetch('https://api.idena.io/api/Epoch/Last', { signal: AbortSignal.timeout(15_000) })
      epoch = ((await res.json()) as { result: { epoch: number } }).result.epoch
    } catch (e) {
      return t.skip(`indexer unavailable — ${e instanceof Error ? e.message : e}`)
    }
    let rows: { address: string; state?: string }[]
    try {
      rows = await discover(`Epoch/${epoch - 1}/Identities?limit=100`)
    } catch (e) {
      return t.skip(`indexer unavailable — ${e instanceof Error ? e.message : e}`)
    }
    const lapsed = rows.find((r) => r.state === 'Suspended' || r.state === 'Zombie')
    if (!lapsed) return t.skip('no lapsed identity in the sampled page this run')
    const r = await adapter.probe(lapsed.address as Address)
    if (r.error) return t.skip(`node unavailable — ${r.error.split('\n')[0]}`)
    // The node may disagree with the last-epoch snapshot (states move each ceremony); what
    // must hold is that a non-validated state is never held.
    if ((IDENA_VALIDATED_STATES as readonly string[]).includes(r.detail?.['state'] as string)) {
      return t.skip(`identity re-validated since epoch ${epoch - 1}`)
    }
    assert.equal(r.held, false)
    assert.equal(r.detail?.['identityFound'], true)
    assert.ok(r.detail?.['state'], 'the lapsed state must be named')
  })

  test('the shared-node key still works and the epoch is moving forward', async (t) => {
    // Guards the load-bearing operational facts: the public constant authenticates, and the
    // chain is alive. Epoch 215 was current on 2026-07-25; epochs only increment.
    const probe = idenaAdapter()
    const r = await probe.probe(NO_IDENTITY)
    if (r.error) return t.skip(`node unavailable — ${r.error.split('\n')[0]}`)
    const res = await fetch('https://restricted.idena.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'dna_epoch', params: [], id: 1, key: 'idena-restricted-node-key' }),
      signal: AbortSignal.timeout(15_000),
    })
    assert.equal(res.status, 200)
    const epoch = ((await res.json()) as { result: { epoch: number } }).result.epoch
    assert.ok(epoch >= 215, `epoch ${epoch} must be >= the 215 observed on 2026-07-25`)
  })
})
