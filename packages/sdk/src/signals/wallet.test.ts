/**
 * Wallet forensics — unit tests, plus live tests gated behind LIVE=1.
 *
 * The unit half exercises the two contracts that matter more than any number: the module
 * never throws, whatever the network does; and the not-personhood caveat is on every result,
 * including — especially — the empty and the failed ones. The live half discovers its own
 * busy subject from the head of the chain instead of pinning one, so it cannot rot into
 * asserting facts about an address that stopped being busy.
 *
 * Unit: node --test --experimental-strip-types src/signals/wallet.test.ts
 * Live: LIVE=1 node --test --experimental-strip-types src/signals/wallet.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  WALLET_BLOCKSCOUT,
  WALLET_FORENSICS_CAVEAT,
  WALLET_RPCS,
  summarizeWalletChains,
  walletSignals,
  type WalletChain,
  type WalletChainSignals,
} from './wallet.ts'
import type { Address } from '../types.ts'

const LIVE = process.env['LIVE'] === '1'
const skipUnlessLive = LIVE ? false : 'set LIVE=1 to run against real chains'

/** Ports 1 and 9 are unassigned on loopback: connection refused, immediately and reliably. */
const POISON = 'http://127.0.0.1:9/'
const ALL_CHAINS: WalletChain[] = ['ethereum', 'gnosis', 'base']
const poisonedOpts = {
  rpcUrls: { ethereum: [POISON], gnosis: [POISON], base: [POISON] },
  blockscoutUrls: { ethereum: POISON, gnosis: POISON, base: POISON },
  timeoutMs: 3_000,
} as const

const SUBJECT = '0x000000000000000000000000000000000000dEaD' as Address

describe('wallet forensics — caveat', () => {
  test('the permanent caveat says what it must, verbatim', () => {
    assert.equal(WALLET_FORENSICS_CAVEAT.code, 'wallet-forensics-are-not-personhood')
    // The two halves of the argument, both required: capital can be a bot, freshness can be
    // a person. A message carrying only one of them invites exactly the misreading it exists
    // to prevent.
    assert.match(WALLET_FORENSICS_CAVEAT.message, /rich, old, busy wallet can be one bot/)
    assert.match(WALLET_FORENSICS_CAVEAT.message, /empty wallet can be a real person/)
    assert.match(WALLET_FORENSICS_CAVEAT.message, /price effort, not humanity/)
    assert.match(WALLET_FORENSICS_CAVEAT.message, /never be folded into a personhood score/)
  })

  test('every result carries the caveat, even a fully failed one', async () => {
    const r = await walletSignals(SUBJECT, poisonedOpts)
    assert.deepEqual(r.caveat, WALLET_FORENSICS_CAVEAT)
  })
})

describe('wallet forensics — never throws', () => {
  test('poisoned RPC and Blockscout URLs produce errors, not exceptions', async () => {
    const r = await walletSignals(SUBJECT, poisonedOpts)
    assert.equal(r.address, SUBJECT)
    assert.equal(r.chains.length, 3)
    for (const c of r.chains) {
      // Every field is honestly absent — not zero, not NaN — and both failures are named.
      assert.equal(c.txCountOut, undefined)
      assert.equal(c.nativeBalanceWei, undefined)
      assert.equal(c.firstSeen, undefined)
      assert.deepEqual(c.sources, {})
      assert.ok(c.errors?.rpc, `${c.chain}: RPC failure was silent`)
      assert.ok(c.errors?.blockscout, `${c.chain}: Blockscout failure was silent`)
    }
    // A dead network is indistinguishable from an empty wallet in the summary — which is why
    // the summary alone must never be read without the per-chain errors.
    assert.equal(r.summary.totalTxOut, 0)
    assert.equal(r.summary.anyActivity, false)
    assert.equal(r.summary.approxAgeDays, undefined)
  })

  test('a garbage address is an error entry, never a rejection', async () => {
    const r = await walletSignals('0xnot-an-address' as Address, poisonedOpts)
    assert.equal(r.chains.length, 3)
    assert.deepEqual(r.caveat, WALLET_FORENSICS_CAVEAT)
  })

  test('an empty RPC list and a disabled Blockscout still resolve', async () => {
    const r = await walletSignals(SUBJECT, {
      chains: ['gnosis'],
      rpcUrls: { gnosis: [] },
      blockscoutUrls: { gnosis: null },
    })
    assert.equal(r.chains.length, 1)
    const c = r.chains[0]!
    assert.equal(c.chain, 'gnosis')
    assert.ok(c.errors?.rpc, 'no URLs configured must surface as an error')
    assert.equal(c.errors?.blockscout, undefined, 'a deliberately disabled source is not a failure')
  })

  test('the chains option selects and orders the result blocks', async () => {
    const r = await walletSignals(SUBJECT, { ...poisonedOpts, chains: ['base', 'ethereum'] })
    assert.deepEqual(
      r.chains.map((c) => c.chain),
      ['base', 'ethereum'],
    )
  })
})

describe('wallet forensics — summary arithmetic', () => {
  const NOW = 1_785_000_000
  const block = (chain: WalletChain, over: Partial<WalletChainSignals> = {}): WalletChainSignals => ({
    chain,
    sources: {},
    ...over,
  })

  test('age is days since the earliest first-seen across chains', () => {
    const s = summarizeWalletChains(
      [
        block('ethereum', { firstSeen: { timestamp: NOW - 100 * 86_400, source: 'a' } }),
        block('gnosis', { firstSeen: { timestamp: NOW - 400 * 86_400, source: 'b' } }),
      ],
      NOW,
    )
    assert.equal(s.approxAgeDays, 400)
  })

  test('a first-seen in the future clamps to zero rather than going negative', () => {
    const s = summarizeWalletChains(
      [block('ethereum', { firstSeen: { timestamp: NOW + 3_600, source: 'a' } })],
      NOW,
    )
    assert.equal(s.approxAgeDays, 0)
  })

  test('totalTxOut sums only the chains that answered', () => {
    const s = summarizeWalletChains(
      [block('ethereum', { txCountOut: 7 }), block('gnosis'), block('base', { txCountOut: 2 })],
      NOW,
    )
    assert.equal(s.totalTxOut, 9)
  })

  test('a zero balance is not activity; a nonzero one is', () => {
    assert.equal(
      summarizeWalletChains([block('ethereum', { nativeBalanceWei: '0', txCountOut: 0 })], NOW).anyActivity,
      false,
    )
    assert.equal(
      summarizeWalletChains([block('ethereum', { nativeBalanceWei: '1', txCountOut: 0 })], NOW).anyActivity,
      true,
    )
  })

  test('each signal alone is enough to mark activity', () => {
    const active: Partial<WalletChainSignals>[] = [
      { txCountOut: 1 },
      { totalTxCount: 1 },
      { tokenTransferCount: 1 },
      { totalReceivedWei: '1' },
      { erc20: { usdc: '1' } },
      { firstSeen: { timestamp: NOW - 1, source: 'a' } },
    ]
    for (const over of active) {
      assert.equal(
        summarizeWalletChains([block('ethereum', over)], NOW).anyActivity,
        true,
        `expected activity from ${JSON.stringify(over)}`,
      )
    }
    assert.equal(summarizeWalletChains([block('ethereum')], NOW).anyActivity, false)
  })
})

// ------------------------------------------------------------------ live

describe('wallet forensics — live', { skip: skipUnlessLive }, () => {
  /**
   * Find a busy address by asking the chain itself: take the latest block and pick the
   * sender with the highest nonce. Any block's busiest sender is, by construction, an
   * address with outgoing history — no fixture to go stale.
   */
  async function busiestSenderInLatestBlock(): Promise<{ address: Address; nonce: number }> {
    const res = await fetch(WALLET_RPCS.ethereum[0]!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['latest', true],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const json = (await res.json()) as { result: { transactions: { from: string; nonce: string }[] } }
    const txs = json.result.transactions
    assert.ok(txs.length > 0, 'the latest block is empty; rerun')
    const busiest = txs.reduce((a, b) => (parseInt(b.nonce, 16) > parseInt(a.nonce, 16) ? b : a))
    return { address: busiest.from as Address, nonce: parseInt(busiest.nonce, 16) }
  }

  test('a busy mainnet address has counted, dated, attributed signals', async (t) => {
    const busy = await busiestSenderInLatestBlock()
    t.diagnostic(`subject ${busy.address}, nonce ${busy.nonce} in the latest block`)

    const r = await walletSignals(busy.address, { chains: ['ethereum'] })
    const eth = r.chains[0]!
    assert.equal(eth.chain, 'ethereum')

    // The sender of a mined transaction has, at minimum, sent that transaction.
    assert.ok(eth.txCountOut !== undefined && eth.txCountOut > 0, 'txCountOut must be positive')
    assert.ok(eth.txCountOut >= busy.nonce, 'nonce cannot go backwards')
    assert.ok(eth.nativeBalanceWei !== undefined, 'balance field must be present')
    assert.match(eth.nativeBalanceWei, /^\d+$/)
    assert.ok(eth.sources.rpc, 'the RPC field must name the endpoint that answered')

    // Blockscout is enrichment: assert its fields when it answered, name it when it did not.
    if (eth.errors?.blockscout === undefined && eth.sources.blockscout) {
      assert.ok((eth.totalTxCount ?? 0) > 0, 'Blockscout counters must see a busy address')
      assert.ok(eth.firstSeen && eth.firstSeen.timestamp > 1_438_269_973, 'first-seen after genesis')
      assert.equal(eth.firstSeen.source, new URL(WALLET_BLOCKSCOUT.ethereum).host)
      assert.ok(r.summary.approxAgeDays !== undefined && r.summary.approxAgeDays > 0)
    } else {
      t.diagnostic(`Blockscout degraded, RPC fields intact: ${eth.errors?.blockscout}`)
    }

    assert.equal(r.summary.anyActivity, true)
    assert.ok(r.summary.totalTxOut > 0)
    assert.deepEqual(r.caveat, WALLET_FORENSICS_CAVEAT)
    t.diagnostic(
      `txCountOut ${eth.txCountOut}, balance ${eth.nativeBalanceWei} wei, ` +
        `totalTxCount ${eth.totalTxCount}, firstSeen ${eth.firstSeen?.timestamp} (${eth.firstSeen?.source}), ` +
        `usdc ${eth.erc20?.usdc}, ageDays ${r.summary.approxAgeDays}`,
    )
  })

  test('a freshly generated address shows no activity on any chain', async (t) => {
    // 160 random bits: the chance any chain has ever seen this address is cryptographically
    // negligible, which is the point — "fresh" is sampled, not curated.
    const fresh = `0x${randomBytes(20).toString('hex')}` as Address
    t.diagnostic(`fresh subject ${fresh}`)

    const r = await walletSignals(fresh)
    assert.equal(r.chains.length, 3)
    for (const c of r.chains) {
      if (c.errors?.rpc === undefined) {
        assert.equal(c.txCountOut, 0, `${c.chain}: a fresh address has sent nothing`)
        assert.equal(c.nativeBalanceWei, '0', `${c.chain}: a fresh address holds nothing`)
      }
      assert.equal(c.firstSeen, undefined, `${c.chain}: a fresh address has no first-seen`)
    }
    assert.ok(
      r.chains.some((c) => c.errors?.rpc === undefined),
      'every RPC on every chain failed; the negative result would be vacuous',
    )
    assert.equal(r.summary.anyActivity, false)
    assert.equal(r.summary.totalTxOut, 0)
    assert.equal(r.summary.approxAgeDays, undefined)
    assert.deepEqual(r.caveat, WALLET_FORENSICS_CAVEAT)
  })


  test('optimism and arbitrum answer over RPC with attributed sources', async (t) => {
    // The opt-in chains, same burn-address contract as the gnosis/base test.
    const r = await walletSignals(SUBJECT, { chains: ['optimism', 'arbitrum'] })
    for (const c of r.chains) {
      assert.equal(c.errors?.rpc, undefined, `${c.chain}: ${c.errors?.rpc}`)
      assert.equal(c.txCountOut, 0, `${c.chain}: nobody holds the dEaD key`)
      assert.ok(c.nativeBalanceWei !== undefined)
      assert.ok(c.sources.rpc, `${c.chain}: source attribution missing`)
      t.diagnostic(
        `${c.chain}: balance ${c.nativeBalanceWei} via ${c.sources.rpc}, ` +
          `totalTxCount ${c.totalTxCount} via ${c.sources.blockscout ?? 'blockscout unavailable'}`,
      )
    }
  })

  test('gnosis and base answer over RPC with attributed sources', async (t) => {
    // The chains beyond mainnet, on their own endpoints. dEaD is a burn address: guaranteed
    // to exist conceptually on every chain and to have sent nothing from any of them.
    const r = await walletSignals(SUBJECT, { chains: ['gnosis', 'base'] })
    for (const c of r.chains) {
      assert.equal(c.errors?.rpc, undefined, `${c.chain}: ${c.errors?.rpc}`)
      assert.equal(c.txCountOut, 0, `${c.chain}: nobody holds the dEaD key`)
      assert.ok(c.nativeBalanceWei !== undefined)
      assert.ok(c.sources.rpc, `${c.chain}: source attribution missing`)
      t.diagnostic(
        `${c.chain}: balance ${c.nativeBalanceWei} via ${c.sources.rpc}, ` +
          `totalTxCount ${c.totalTxCount} via ${c.sources.blockscout ?? 'blockscout unavailable'}`,
      )
    }
  })
})
