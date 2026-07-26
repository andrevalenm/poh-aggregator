/**
 * Galxe Passport — unit and live.
 *
 * The unit tests pin the pure machinery: the storage-key derivation (against the literal key
 * that was verified to hold a real holder's tokenId on five independent endpoints), the
 * anchor bracketing that turns a tokenId into a proven issuance bound, and the invariants of
 * the anchor table itself. The probe is additionally held to the never-throws contract
 * against dead endpoints.
 *
 * The LIVE=1 tests do what fixtures cannot: they find a real, current passport holder from
 * the chain's own recent mint logs, then assert that the archive-bisection date **equals the
 * mint log's own block timestamp** — the two dating mechanisms are independent, so their
 * agreement on a live subject is the strongest check this adapter can run. They also
 * re-verify sampled anchors against the immutable past state they were measured from, and
 * re-assert the soulbound property on the deployed bytecode.
 *
 * Run unit: node --test --experimental-strip-types src/adapters/galxe.test.ts
 * Run live: LIVE=1 node --test --experimental-strip-types src/adapters/galxe.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, encodeFunctionData, http, parseAbi, parseAbiItem, type PublicClient } from 'viem'
import { bsc } from 'viem/chains'
import {
  GALXE_BSC_ARCHIVE_ENDPOINT,
  GALXE_MINT_ANCHORS,
  GALXE_PASSPORT,
  GALXE_PASSPORT_ABI,
  GALXE_PASSPORT_DEPLOY_BLOCK,
  GALXE_PASSPORT_DEPLOY_TIMESTAMP,
  galxeMintBracket,
  galxePassportAdapter,
  galxePassportSlotKey,
} from './galxe.ts'
import type { Address } from '../types.ts'

const LIVE = process.env['LIVE'] === '1'

/** Nobody holds the key to this address, so nobody has ever KYC'd with it. */
const NO_CREDENTIAL = '0x0000000000000000000000000000000000000001' as Address

/**
 * A real holder observed on 2026-07-25: minted token 1,047,302 at block 112,026,449. Used
 * only to pin the *derivation* of the storage key — the live suite discovers its own
 * holders, because any pinned holder can burn tomorrow.
 */
const OBSERVED_HOLDER = '0xF653c96E96febACfd3703A026959dA34b2E8DEb6' as Address
const OBSERVED_HOLDER_SLOT_KEY = '0xd8ed9b896b563f2d89bc117503a3c604aed7f4d70ff383b57e125ec7af199c4a'

// ------------------------------------------------------------------ unit

describe('storage-key derivation', () => {
  test('derives the key that was verified to hold a real tokenId on five endpoints', () => {
    // The literal was checked on 2026-07-25: eth_getStorageAt at this key returned
    // 1,047,302 on 48.club, dataseed, publicnode, 1rpc and drpc, and ownerOf(1047302)
    // returned the holder. If the encoding or the slot constant drifts, this goes loud.
    assert.equal(galxePassportSlotKey(OBSERVED_HOLDER), OBSERVED_HOLDER_SLOT_KEY)
  })

  test('the key depends on the owner', () => {
    assert.notEqual(galxePassportSlotKey(NO_CREDENTIAL), OBSERVED_HOLDER_SLOT_KEY)
  })
})

describe('the anchor table', () => {
  test('anchors are strictly increasing in block, time and count', () => {
    // The bracketing logic assumes all three monotonicities; an out-of-order edit to the
    // table would silently corrupt every issuedAfter bound.
    for (let i = 1; i < GALXE_MINT_ANCHORS.length; i++) {
      const a = GALXE_MINT_ANCHORS[i - 1]!
      const b = GALXE_MINT_ANCHORS[i]!
      assert.ok(b.block > a.block, `block order at ${i}`)
      assert.ok(b.timestamp > a.timestamp, `timestamp order at ${i}`)
      assert.ok(b.numMinted > a.numMinted, `count order at ${i}`)
    }
  })

  test('the first anchor is the deployment with zero mints', () => {
    assert.equal(GALXE_MINT_ANCHORS[0]!.block, GALXE_PASSPORT_DEPLOY_BLOCK)
    assert.equal(GALXE_MINT_ANCHORS[0]!.timestamp, GALXE_PASSPORT_DEPLOY_TIMESTAMP)
    assert.equal(GALXE_MINT_ANCHORS[0]!.numMinted, 0)
  })
})

describe('bracketing a tokenId between anchors', () => {
  test('token 1 sits between deployment and the first sampled anchor', () => {
    const b = galxeMintBracket(1n)
    assert.equal(b.low.numMinted, 0)
    assert.equal(b.high?.block, 23_000_000n)
  })

  test('a token equal to an anchor count already existed at that anchor', () => {
    // numMinted 46,850 at block 23M means token 46,850 exists there — the anchor is the
    // upper bracket, not the lower, or the bisection would miss the mint by one.
    const b = galxeMintBracket(46_850n)
    assert.equal(b.low.numMinted, 0)
    assert.equal(b.high?.numMinted, 46_850)
  })

  test('one past an anchor count moves the lower bound up', () => {
    const b = galxeMintBracket(46_851n)
    assert.equal(b.low.block, 23_000_000n)
    assert.equal(b.high?.block, 25_000_000n)
  })

  test('a token newer than every anchor has no upper bracket and bounds from the last', () => {
    const b = galxeMintBracket(2_000_000n)
    assert.equal(b.low.block, 110_000_000n)
    assert.equal(b.high, undefined)
  })

  test('the 2024 airdrop cohort lands in the fat 36M–40M window', () => {
    const b = galxeMintBracket(700_000n)
    assert.equal(b.low.block, 36_000_000n)
    assert.equal(b.high?.block, 40_000_000n)
  })
})

describe('probe shape and the never-throws contract', () => {
  test('the adapter has the shape the registry expects', () => {
    const a = galxePassportAdapter()
    assert.equal(a.adapterId, 'galxe-passport')
    assert.equal(typeof a.probe, 'function')
  })

  test('dead endpoints are an error, never a negative, and never a throw', async () => {
    const broken = galxePassportAdapter({
      rpcUrls: ['http://127.0.0.1:9'],
      archiveRpcUrl: 'http://127.0.0.1:9',
      timeoutMs: 700,
    })
    const r = await broken.probe(NO_CREDENTIAL)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail, undefined, 'an error result must not carry partial detail')
  })
})

// ------------------------------------------------------------------ live

function skipUnreachable(t: { skip(message: string): void }, what: string, e: unknown): void {
  t.skip(`${what} unreachable: ${e instanceof Error ? e.message : String(e)}`)
}

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)')
const ZERO = '0x0000000000000000000000000000000000000000' as Address

const archiveClient = (): PublicClient =>
  createPublicClient({
    chain: bsc,
    transport: http(GALXE_BSC_ARCHIVE_ENDPOINT, { timeout: 25_000 }),
  }) as PublicClient

interface SampledMint {
  holder: Address
  tokenId: bigint
  blockNumber: bigint
  timestamp: number
}

/**
 * Find recent real mints from the chain itself — 20k-block windows backward from head,
 * enough to cover ~2 weeks of the current ~2 mints/day trickle.
 */
async function sampleRecentMints(c: PublicClient): Promise<SampledMint[]> {
  const head = await c.getBlockNumber()
  const out: SampledMint[] = []
  for (let i = 0n; i < 120n && out.length < 3; i++) {
    const to = head - i * 20_000n
    const logs = await c.getLogs({
      address: GALXE_PASSPORT,
      event: TRANSFER,
      args: { from: ZERO },
      fromBlock: to - 19_999n,
      toBlock: to,
    })
    for (const log of logs.reverse()) {
      const ts = Number((await c.getBlock({ blockNumber: log.blockNumber! })).timestamp)
      out.push({ holder: log.args.to!, tokenId: log.args.tokenId!, blockNumber: log.blockNumber!, timestamp: ts })
      if (out.length >= 3) break
    }
  }
  return out
}

describe('LIVE: Galxe Passport from BNB Chain', { skip: !LIVE }, () => {
  let sampleOnce: Promise<SampledMint[]> | undefined
  const sample = () => (sampleOnce ??= sampleRecentMints(archiveClient()))

  test('the contract is the one the constants describe, and still refuses transfers', async (t) => {
    try {
      const c = archiveClient()
      const name = await c.readContract({
        address: GALXE_PASSPORT,
        abi: parseAbi(['function name() view returns (string)']),
        functionName: 'name',
      })
      assert.equal(name, 'Galxe Passport')
      // The soulbound property, re-asserted against deployed bytecode rather than trusted
      // from the source read: a transfer simulated from a real holder must revert.
      const mints = await sample()
      if (mints.length === 0) return t.skip('no mint found to simulate a transfer from')
      await assert.rejects(
        c.call({
          account: mints[0]!.holder,
          to: GALXE_PASSPORT,
          data: encodeFunctionData({
            abi: parseAbi(['function transferFrom(address,address,uint256)']),
            functionName: 'transferFrom',
            args: [mints[0]!.holder, NO_CREDENTIAL, mints[0]!.tokenId],
          }),
        }),
        /not transferrable/,
      )
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e
      return skipUnreachable(t, 'BSC archive endpoint', e)
    }
  })

  test('sampled anchors still match the immutable state they were measured from', async (t) => {
    try {
      const c = archiveClient()
      for (const anchor of [GALXE_MINT_ANCHORS[4]!, GALXE_MINT_ANCHORS[11]!]) {
        const n = (await c.readContract({
          address: GALXE_PASSPORT,
          abi: GALXE_PASSPORT_ABI,
          functionName: 'getNumMinted',
          blockNumber: anchor.block,
        })) as bigint
        assert.equal(Number(n), anchor.numMinted, `numMinted at block ${anchor.block}`)
        const b = await c.getBlock({ blockNumber: anchor.block })
        assert.equal(Number(b.timestamp), anchor.timestamp, `timestamp of block ${anchor.block}`)
      }
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e
      return skipUnreachable(t, 'BSC archive endpoint', e)
    }
  })

  test('a freshly minted holder is held, and the bisection date equals the mint log timestamp', async (t) => {
    let mints: SampledMint[]
    try {
      mints = await sample()
    } catch (e) {
      return skipUnreachable(t, 'BSC mint-log scan', e)
    }
    if (mints.length === 0) return t.skip('no mint in the scanned window')

    for (const mint of mints) {
      const r = await galxePassportAdapter().probe(mint.holder)
      if (r.error) return skipUnreachable(t, 'BSC RPC', r.error)
      if (!r.held) continue // burned or revoked between the scan and the probe — not a fault
      assert.equal(r.detail?.['tokenId'], Number(mint.tokenId), 'storage slot and mint log must name the same token')
      // The two dating mechanisms are independent — the log's own block versus a bisection
      // over the mint counter. On the same subject they must agree exactly.
      if (r.detail?.['dating'] === 'archive-mint-counter-bisection') {
        assert.equal(r.issuedAt, mint.timestamp)
        assert.equal(r.detail?.['mintBlock'], Number(mint.blockNumber))
      } else {
        // Archive was unreachable mid-probe: the bound must still be sound.
        assert.ok(r.issuedAfter !== undefined && r.issuedAfter <= mint.timestamp)
      }
      assert.equal(r.provenance?.heldFrom, 'chain')
      return
    }
    t.skip('every sampled mint was burned before the probe ran')
  })

  test('an address that never verified is an absence, not an error', async (t) => {
    const r = await galxePassportAdapter().probe(NO_CREDENTIAL)
    if (r.error) return skipUnreachable(t, 'BSC RPC', r.error)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['passports'], 0)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.issuedAfter, undefined)
  })

  test('anchor-only dating still yields a sound issuedAfter when the archive is dead', async (t) => {
    let mints: SampledMint[]
    try {
      mints = await sample()
    } catch (e) {
      return skipUnreachable(t, 'BSC mint-log scan', e)
    }
    if (mints.length === 0) return t.skip('no mint in the scanned window')
    const adapter = galxePassportAdapter({ archiveRpcUrl: 'http://127.0.0.1:9', timeoutMs: 5_000 })
    const r = await adapter.probe(mints[0]!.holder)
    if (r.error) return skipUnreachable(t, 'BSC RPC', r.error)
    if (!r.held) return t.skip('sampled holder burned before the probe ran')
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.detail?.['dating'], 'anchor-lower-bound')
    // A recent mint is newer than the newest anchor, and the bound must not overstate age.
    assert.ok(r.issuedAfter !== undefined)
    assert.ok(r.issuedAfter! <= mints[0]!.timestamp)
    assert.equal(r.issuedAfter, GALXE_MINT_ANCHORS[GALXE_MINT_ANCHORS.length - 1]!.timestamp)
  })
})
