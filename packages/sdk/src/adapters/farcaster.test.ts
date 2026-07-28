/**
 * Farcaster — the parts that decide a date, without a network.
 *
 * The probe's whole risk is concentrated in two searches over historical state: the
 * `idCounter` search that dates a fid and the `custodyOf` search that dates an acquisition.
 * Both take a reader, so both run here against synthetic chains whose right answers are known
 * by construction — including the two shapes that bit in the real registry: the import cliff,
 * where the counter steps 0 → 193,791 in one block, and the away-and-back custody history,
 * where a naive bisection dates tenure from the wrong stint.
 *
 * Run: node --test --experimental-strip-types src/adapters/farcaster.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/adapters/farcaster.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, parseAbi } from 'viem'
import { optimism } from 'viem/chains'
import {
  farcasterAdapter,
  findCustodyAcquisition,
  findFidRegistration,
  FARCASTER_ARCHIVE_RPCS,
  FARCASTER_ID_REGISTRY,
  FARCASTER_ID_REGISTRY_DEPLOY_BLOCK,
} from './farcaster.ts'
import type { Address } from '../types.ts'

const LIVE = Boolean(process.env.LIVE)

/** Nobody holds the key to this address, so nobody has ever registered a fid to it. */
const NO_ACCOUNT = '0x0000000000000000000000000000000000000001' as Address
const SUBJECT = '0x1111111111111111111111111111111111111111' as Address
const OTHER = '0x2222222222222222222222222222222222222222' as Address

const DEPLOY = FARCASTER_ID_REGISTRY_DEPLOY_BLOCK

/**
 * A reader over a synthetic chain: `counter` and `custody` are pure functions of the block, so
 * every search's correct answer is known exactly. `calls` counts historical reads, because a
 * search that converges by exhaustion instead of bisection would still pass on correctness.
 */
function fakeReader(world: {
  counter: (block: bigint) => bigint
  custody?: (block: bigint) => Address
}) {
  const calls = { counter: 0, custody: 0 }
  return {
    reader: {
      call: async (fn: string, _args: readonly unknown[], block?: bigint) => {
        if (fn === 'custodyOf') {
          calls.custody++
          return world.custody!(block!)
        }
        throw new Error(`unexpected call ${fn}`)
      },
      counterAt: async (block: bigint) => {
        calls.counter++
        return world.counter(block)
      },
      blockTimestamp: async (block: bigint) => Number(block),
      headBlock: async () => 0n,
      samples: () => [] as [bigint, bigint][],
    },
    calls,
  }
}

describe('dating a fid from the counter alone', () => {
  test('a fid registered one-per-block is dated to exactly its creating block', async () => {
    // counter(b) = b - DEPLOY: fid N is created in block DEPLOY + N, nowhere else.
    const { reader, calls } = fakeReader({ counter: (b) => (b < DEPLOY ? 0n : b - DEPLOY) })
    const r = await findFidRegistration(reader, 5_000n, DEPLOY + 40_000_000n)
    assert.equal(r.block, DEPLOY + 5_000n)
    assert.equal(r.timestamp, Number(DEPLOY + 5_000n))
    assert.equal(r.idsCreated, 1n)
    assert.equal(r.counterBefore, 4_999n)
    // ~40M candidate blocks: interpolation should nail this shape almost immediately, and
    // even pure bisection needs only ~26 probes. A linear scan is a defect.
    assert.ok(calls.counter < 60, `took ${calls.counter} counter reads`)
  })

  test('the import cliff dates every imported fid to the cliff block, with counterBefore 0', async () => {
    const CLIFF = DEPLOY + 88_387n
    const counter = (b: bigint) => (b < CLIFF ? 0n : 193_791n + (b - CLIFF))
    const { reader } = fakeReader({ counter })
    for (const fid of [1n, 100_000n, 193_791n]) {
      const r = await findFidRegistration(reader, fid, DEPLOY + 40_000_000n)
      assert.equal(r.block, CLIFF, `fid ${fid} must date to the cliff`)
      // The discriminator the adapter uses for `date-from-registry-import`.
      assert.equal(r.counterBefore, 0n)
      assert.equal(r.idsCreated, 193_791n + 1n - 1n)
    }
    // The first post-import fid is NOT an import.
    const r = await findFidRegistration(reader, 193_792n, DEPLOY + 40_000_000n)
    assert.equal(r.block, CLIFF + 1n)
    assert.equal(r.counterBefore, 193_791n)
  })

  test('a fid the registry has not reached is an error, never a date', async () => {
    const { reader } = fakeReader({ counter: (b) => (b < DEPLOY ? 0n : b - DEPLOY) })
    await assert.rejects(
      () => findFidRegistration(reader, 10n, DEPLOY + 5n),
      /exceeds idCounter/,
    )
  })

  test('a chain that contradicts itself is an error, never a plausible date', async () => {
    // The counter reads 600 at every block — including the deploy block, where the search
    // assumes 0 — so no block B satisfies its own verification counter(B-1) < 500 <=
    // counter(B). An endpoint answering from the wrong state looks like this, and on a Ramp
    // a fabricated date is free weight, so the search must fail loudly, not return its bracket.
    const { reader } = fakeReader({ counter: () => 600n })
    await assert.rejects(
      () => findFidRegistration(reader, 500n, DEPLOY + 900_000n),
      /not created in block/,
    )
  })
})

describe('dating custody rather than the fid', () => {
  const registration = DEPLOY + 1_000n
  const head = DEPLOY + 10_000_000n

  test('a single transfer is found at its exact block', async () => {
    const acquired = DEPLOY + 4_000_000n
    const { reader } = fakeReader({
      counter: () => 0n,
      custody: (b) => (b >= acquired ? SUBJECT : OTHER),
    })
    const r = await findCustodyAcquisition(reader, 1n, SUBJECT, registration, head)
    assert.equal(r.block, acquired)
    assert.equal(r.timestamp, Number(acquired))
  })

  test('an away-and-back history is dated from the return, not the first stint', async () => {
    // Held [A1, GONE), lost [GONE, A2), held [A2, head]. Dating from A1 would credit the
    // interlude as tenure — the exact overstatement the continuity ladder exists to catch.
    const A1 = DEPLOY + 1_000_000n
    const GONE = DEPLOY + 3_000_000n
    const A2 = DEPLOY + 9_000_000n
    const { reader } = fakeReader({
      counter: () => 0n,
      custody: (b) => ((b >= A1 && b < GONE) || b >= A2 ? SUBJECT : OTHER),
    })
    const r = await findCustodyAcquisition(reader, 1n, SUBJECT, registration, head)
    assert.equal(r.block, A2, 'must date from the re-acquisition')
    assert.ok(r.continuitySamples > 0, 'the ladder is what found the gap')
  })

  test('custody held since registration dates to the registration bound', async () => {
    const { reader } = fakeReader({
      counter: () => 0n,
      custody: (b) => (b > registration ? SUBJECT : OTHER),
    })
    const r = await findCustodyAcquisition(reader, 1n, SUBJECT, registration, head)
    assert.equal(r.block, registration + 1n)
  })
})

describe('the probe contract', () => {
  test('the adapter has the shape the registry expects', () => {
    const adapter = farcasterAdapter()
    assert.equal(adapter.adapterId, 'farcaster-account')
    assert.equal(typeof adapter.probe, 'function')
  })

  test('an unreachable endpoint is an error, never a negative, and never a throw', async () => {
    const broken = farcasterAdapter({ rpcUrls: ['http://127.0.0.1:9'], timeoutMs: 1_000 })
    const r = await broken.probe(NO_ACCOUNT)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })

  test('an adapter with no endpoints refuses to construct rather than failing at probe time', () => {
    assert.throws(() => farcasterAdapter({ rpcUrls: [] }))
  })
})

describe('live, against the real registry on OP Mainnet', { skip: !LIVE }, () => {
  const client = createPublicClient({
    chain: optimism,
    transport: http(FARCASTER_ARCHIVE_RPCS[0], { timeout: 20_000 }),
  })
  const REGISTRY_ABI = parseAbi([
    'function idCounter() view returns (uint256)',
    'function custodyOf(uint256 fid) view returns (address)',
  ])

  test('a subject read off the chain at run time holds its fid, with a date', async (t) => {
    // No pinned address: take a fid a little behind head and ask the registry who holds it.
    const size = await client.readContract({
      address: FARCASTER_ID_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'idCounter',
    })
    const fid = size - 1_000n
    const subject = (await client.readContract({
      address: FARCASTER_ID_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'custodyOf',
      args: [fid],
    })) as Address

    const r = await farcasterAdapter().probe(subject)
    if (r.error) return t.skip(`OP archive endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, true)
    assert.equal(r.detail?.['fid'], fid.toString())
    assert.ok(typeof r.issuedAt === 'number' && r.issuedAt > 1_699_000_000, 'dated after deployment')
    assert.ok(r.issuedAt! <= Date.now() / 1000)
  })

  test('an address that never registered is held:false with the registry size', async (t) => {
    const r = await farcasterAdapter().probe(NO_ACCOUNT)
    if (r.error) return t.skip(`OP archive endpoints unavailable — ${r.error.split(';')[0]}`)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['registered'], false)
    assert.ok((r.detail?.['registrySize'] as number) > 3_000_000)
  })
})
