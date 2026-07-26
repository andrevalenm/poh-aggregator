import type { Address, Caveat } from '../types.ts'

/**
 * Wallet forensics — a signal class that is explicitly **not personhood**.
 *
 * Wallet age, activity, balances and flow measure something real: what an address has spent,
 * done and survived. That something is *cost and effort*, and cost is a different axis from
 * humanity. A rich, old, busy wallet can be one bot among ten thousand run by the same
 * operator — exchange hot wallets are the oldest, richest, busiest addresses on every chain —
 * and a fresh, empty wallet can be a real person's first. So this module lives outside the
 * adapter roster on purpose: it produces its own result block with its own permanent caveat,
 * and nothing here is an `Evidence`, has a trust root, or can reach `score()`. Mixing these
 * numbers into the personhood score would launder capital into humanity, which is precisely
 * the substitution a sybil farm is optimised to make.
 *
 * Data sources, in order of preference:
 *  (a) plain JSON-RPC for nonce and balances — keyless public endpoints with fallback lists,
 *      following the endpoint discipline in `adapters/index.ts` and `adapters/poh-v1.ts`;
 *  (b) public Blockscout instances' REST APIs for first-seen and totals — no API key, and
 *      treated strictly as enrichment: when Blockscout is down or lagging, the RPC-only
 *      fields still return. (It does lag: measured 2026-07-25, eth.blockscout.com reported
 *      a fresh zero-history page for an address whose RPC state agreed was empty, while
 *      serving full history for a 9.9M-tx exchange wallet. Attribution per source exists so
 *      a consumer can see which backend said what.)
 *
 * Every field is optional and per-source attributed. Nothing throws: a network failure
 * surfaces in `errors` and as an absent field, never as an exception and never as a silent
 * zero pretending to be a measurement.
 */

export type WalletChain = 'ethereum' | 'gnosis' | 'base' | 'optimism' | 'arbitrum'

/**
 * The permanent caveat. Present on every result, unconditionally, and deliberately not
 * suppressible — it is the product, in the same sense as the caveats in `scoring.ts`.
 */
export const WALLET_FORENSICS_CAVEAT: Caveat = {
  code: 'wallet-forensics-are-not-personhood',
  message:
    'Wallet age, activity, balances and flow price effort, not humanity. A rich, old, busy wallet can be one bot among thousands run by a single operator, and a brand-new empty wallet can be a real person arriving for the first time. These signals measure what an address has spent and survived; they say nothing about whether a human is behind it, and they must never be folded into a personhood score.',
}

/**
 * Keyless RPC fallback lists. First entry is the one the rest of the SDK already uses
 * (`RPC` in `adapters/index.ts`, `POH_V1_RPCS`); the others answered `eth_chainId` when
 * measured 2026-07-25. `mainnet.base.org` is last because it 403s non-browser clients.
 */
export const WALLET_RPCS: Record<WalletChain, readonly string[]> = {
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
    'https://rpc.mevblocker.io',
    'https://gateway.tenderly.co/public/mainnet',
  ],
  gnosis: [
    'https://rpc.gnosischain.com',
    'https://gnosis-rpc.publicnode.com',
    'https://gnosis.drpc.org',
  ],
  base: [
    'https://base-rpc.publicnode.com',
    'https://base.drpc.org',
    'https://mainnet.base.org',
  ],
  optimism: [
    'https://optimism-rpc.publicnode.com',
    'https://optimism.drpc.org',
    'https://mainnet.optimism.io',
  ],
  arbitrum: [
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arbitrum.drpc.org',
    'https://arb1.arbitrum.io/rpc',
  ],
}

/**
 * Public Blockscout instances. Endpoint shapes verified live 2026-07-25 on all three hosts:
 *  - `GET /api/v2/addresses/{addr}/counters` → `{ transactions_count, token_transfers_count, … }`
 *  - `GET /api?module=account&action=txlist&address=…&sort=asc&page=1&offset=1`
 *      → `{ status: "1", result: [{ timeStamp, blockNumber, … }] }` (status "0" when empty)
 *  - `GET /api/v2/addresses/{addr}/transactions?filter=to`
 *      → `{ items: [{ value, … }], next_page_params }` — 50 items a page.
 */
export const WALLET_BLOCKSCOUT: Record<WalletChain, string> = {
  ethereum: 'https://eth.blockscout.com',
  gnosis: 'https://gnosis.blockscout.com',
  base: 'https://base.blockscout.com',
  // optimism.blockscout.com 301s here; this is the canonical host (verified 2026-07-25).
  optimism: 'https://explorer.optimism.io',
  arbitrum: 'https://arbitrum.blockscout.com',
}

/**
 * USDC per chain, read by `eth_call balanceOf` so the balance does not depend on Blockscout.
 * Gnosis carries Circle's bridged `USDC.e` (symbol and 6 decimals verified on chain).
 */
export const WALLET_USDC: Record<WalletChain, Address> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  gnosis: '0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}

export interface WalletFirstSeen {
  /** Unix seconds of the earliest transaction the source has for this address. */
  timestamp: number
  /** Which backend said so, e.g. `eth.blockscout.com`. */
  source: string
}

/**
 * One chain's signals. Balances are decimal strings of the smallest unit (wei for the native
 * asset, token base units for ERC-20) because they routinely exceed `Number.MAX_SAFE_INTEGER`
 * and the result must survive `JSON.stringify`. "Native" means the chain's own asset — ETH on
 * Ethereum and Base, xDAI on Gnosis.
 */
export interface WalletChainSignals {
  chain: WalletChain
  /** Outgoing transaction count — `eth_getTransactionCount`, so sent txs only. Source: rpc. */
  txCountOut?: number
  /** `eth_getBalance` at head, decimal wei string. Source: rpc. */
  nativeBalanceWei?: string
  /**
   * Earliest transaction Blockscout indexes for this address. External txs only — an address
   * first funded by an internal transfer appears later than it truly is, and a lagging index
   * can miss it entirely. Absence of this field is absence of data, not proof of freshness.
   */
  firstSeen?: WalletFirstSeen
  /**
   * Sum of native value over incoming external transactions, decimal wei string. Present only
   * when Blockscout returned the *complete* incoming history in one page (≤50 txs, no
   * pagination) — a partial sum would understate flow while looking like a measurement.
   * Source: blockscout.
   */
  totalReceivedWei?: string
  /** All transactions touching the address, in and out. Source: blockscout counters. */
  totalTxCount?: number
  /** ERC-20 transfer events touching the address. Source: blockscout counters. */
  tokenTransferCount?: number
  /** Token balances in base units (USDC has 6 decimals). Source: rpc `eth_call`. */
  erc20?: { usdc?: string }
  /** Which endpoint actually answered for each source, so every field is attributable. */
  sources: { rpc?: string; blockscout?: string }
  /** Why a source's fields are missing, so absence is never silent. */
  errors?: { rpc?: string; blockscout?: string }
}

export interface WalletSignalsSummary {
  /**
   * Days since the earliest `firstSeen` across chains. Approximate by construction: it is an
   * index's view of external transactions, and it can only understate age, never overstate it.
   */
  approxAgeDays?: number
  /** Sum of `txCountOut` over the chains that answered. */
  totalTxOut: number
  /**
   * True when any source on any chain saw anything — a sent tx, a balance, a first-seen, a
   * token transfer. False means every source that answered saw nothing; if *no* source
   * answered (see `errors`), it is still false, which is why it must never be read as
   * "this wallet is fresh" without checking that the chains actually reported.
   */
  anyActivity: boolean
}

export interface WalletSignalsResult {
  address: Address
  chains: WalletChainSignals[]
  summary: WalletSignalsSummary
  /** Always `WALLET_FORENSICS_CAVEAT`. A result without it does not exist. */
  caveat: Caveat
  computedAt: number
}

export interface WalletSignalsOptions {
  /** Which chains to read. Defaults to ethereum + gnosis + base; optimism and arbitrum are opt-in to keep the default call weight down. */
  chains?: WalletChain[]
  /** Override the RPC fallback list per chain. */
  rpcUrls?: Partial<Record<WalletChain, readonly string[]>>
  /** Override the Blockscout base URL per chain; `null` disables Blockscout for that chain. */
  blockscoutUrls?: Partial<Record<WalletChain, string | null>>
  /** Per-request timeout in milliseconds. Default 10s RPC, 15s Blockscout. */
  timeoutMs?: number
}

// ------------------------------------------------------------------ plumbing

const hexToBigInt = (hex: unknown): bigint | undefined => {
  if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]*$/.test(hex)) return undefined
  return hex === '0x' ? 0n : BigInt(hex)
}

async function rpcCall(url: string, method: string, params: unknown[], timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (json.error) throw new Error(`${url}: ${json.error.message ?? 'RPC error'}`)
  if (json.result === undefined) throw new Error(`${url}: no result`)
  return json.result
}

/** `balanceOf(address)` calldata: selector `0x70a08231` + the address left-padded to 32 bytes. */
const balanceOfData = (address: string) => `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`

interface RpcProbe {
  url?: string
  txCountOut?: number
  nativeBalanceWei?: string
  usdc?: string
  error?: string
}

/**
 * Try each URL in order; the first that answers the two mandatory reads wins and is recorded
 * as the source. The USDC read rides on the same endpoint and is allowed to fail alone —
 * losing a token balance must not cost the nonce and the native balance.
 */
async function rpcProbe(
  urls: readonly string[],
  address: string,
  usdcToken: string,
  timeoutMs: number,
): Promise<RpcProbe> {
  const failures: string[] = []
  for (const url of urls) {
    try {
      const [nonceHex, balanceHex] = await Promise.all([
        rpcCall(url, 'eth_getTransactionCount', [address, 'latest'], timeoutMs),
        rpcCall(url, 'eth_getBalance', [address, 'latest'], timeoutMs),
      ])
      const nonce = hexToBigInt(nonceHex)
      const balance = hexToBigInt(balanceHex)
      if (nonce === undefined || balance === undefined) throw new Error(`${url}: malformed hex quantity`)
      const out: RpcProbe = { url, txCountOut: Number(nonce), nativeBalanceWei: balance.toString() }
      try {
        const usdc = hexToBigInt(
          await rpcCall(url, 'eth_call', [{ to: usdcToken, data: balanceOfData(address) }, 'latest'], timeoutMs),
        )
        if (usdc !== undefined) out.usdc = usdc.toString()
      } catch {
        // Token balance is optional enrichment on top of the RPC read itself.
      }
      return out
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e))
    }
  }
  return { error: failures.join(' | ') || 'no RPC URLs configured' }
}

interface BlockscoutProbe {
  host?: string
  totalTxCount?: number
  tokenTransferCount?: number
  firstSeen?: WalletFirstSeen
  totalReceivedWei?: string
  error?: string
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

/**
 * The three Blockscout reads are independently guarded: counters failing must not cost the
 * first-seen, and vice versa. Only the errors are pooled.
 */
async function blockscoutProbe(baseUrl: string, address: string, timeoutMs: number): Promise<BlockscoutProbe> {
  const host = new URL(baseUrl).host
  const out: BlockscoutProbe = {}
  const failures: string[] = []

  const [counters, firstTx, incoming] = await Promise.allSettled([
    getJson(`${baseUrl}/api/v2/addresses/${address}/counters`, timeoutMs),
    getJson(
      `${baseUrl}/api?module=account&action=txlist&address=${address}&sort=asc&page=1&offset=1`,
      timeoutMs,
    ),
    getJson(`${baseUrl}/api/v2/addresses/${address}/transactions?filter=to`, timeoutMs),
  ])

  if (counters.status === 'fulfilled') {
    const c = counters.value as { transactions_count?: string; token_transfers_count?: string }
    const txs = Number(c?.transactions_count)
    const transfers = Number(c?.token_transfers_count)
    if (Number.isFinite(txs)) out.totalTxCount = txs
    if (Number.isFinite(transfers)) out.tokenTransferCount = transfers
  } else failures.push(`counters: ${counters.reason?.message ?? counters.reason}`)

  if (firstTx.status === 'fulfilled') {
    const f = firstTx.value as { status?: string; result?: { timeStamp?: string }[] }
    const ts = Number(f?.result?.[0]?.timeStamp)
    // status "0" with an empty result is Blockscout's spelling of "no transactions": an
    // absence, not an error, and not a first-seen of NaN.
    if (Number.isFinite(ts) && ts > 0) out.firstSeen = { timestamp: ts, source: host }
  } else failures.push(`txlist: ${firstTx.reason?.message ?? firstTx.reason}`)

  if (incoming.status === 'fulfilled') {
    const inc = incoming.value as { items?: { value?: string }[]; next_page_params?: unknown }
    // Only a complete list may be summed. With pagination pending the sum would be the most
    // recent 50 incoming transactions masquerading as lifetime flow.
    if (Array.isArray(inc?.items) && (inc.next_page_params === null || inc.next_page_params === undefined)) {
      let total = 0n
      let readable = true
      for (const item of inc.items) {
        try {
          total += BigInt(item?.value ?? '0')
        } catch {
          readable = false
          break
        }
      }
      if (readable) out.totalReceivedWei = total.toString()
    }
  } else failures.push(`transactions: ${incoming.reason?.message ?? incoming.reason}`)

  const gotAnything =
    out.totalTxCount !== undefined ||
    out.tokenTransferCount !== undefined ||
    out.firstSeen !== undefined ||
    out.totalReceivedWei !== undefined
  if (gotAnything) out.host = host
  if (failures.length) out.error = failures.join(' | ')
  return out
}

// ------------------------------------------------------------------- summary

/**
 * Pure aggregation over the per-chain blocks, exported so the logic is testable without a
 * network. `anyActivity` is deliberately generous: a single sent tx, a nonzero balance on any
 * source, a token transfer or a first-seen all count — the honest reading of "this address
 * has been touched". It still cannot distinguish "fresh" from "every source was down"; the
 * per-chain `errors` exist so a consumer can.
 */
export function summarizeWalletChains(chains: WalletChainSignals[], now: number): WalletSignalsSummary {
  let totalTxOut = 0
  let earliest: number | undefined
  let anyActivity = false
  for (const c of chains) {
    if (c.txCountOut !== undefined) totalTxOut += c.txCountOut
    if (c.firstSeen && (earliest === undefined || c.firstSeen.timestamp < earliest)) {
      earliest = c.firstSeen.timestamp
    }
    anyActivity ||=
      (c.txCountOut ?? 0) > 0 ||
      (c.totalTxCount ?? 0) > 0 ||
      (c.tokenTransferCount ?? 0) > 0 ||
      (c.nativeBalanceWei !== undefined && c.nativeBalanceWei !== '0') ||
      (c.totalReceivedWei !== undefined && c.totalReceivedWei !== '0') ||
      (c.erc20?.usdc !== undefined && c.erc20.usdc !== '0') ||
      c.firstSeen !== undefined
  }
  return {
    ...(earliest !== undefined
      ? { approxAgeDays: Math.round(Math.max(0, (now - earliest) / 86_400) * 10) / 10 }
      : {}),
    totalTxOut,
    anyActivity,
  }
}

// --------------------------------------------------------------------- entry

/**
 * Read wallet-forensics signals for one address across the configured chains.
 *
 * Never throws and never rejects: every failure is a per-source `errors` entry and an absent
 * field. The caveat is on every result, including a fully-failed one — *especially* a
 * fully-failed one, since an empty result is the easiest to misread as "no history, not a
 * person", which is wrong twice.
 */
export async function walletSignals(
  address: Address,
  opts?: WalletSignalsOptions,
): Promise<WalletSignalsResult> {
  const chains = opts?.chains ?? (['ethereum', 'gnosis', 'base'] as WalletChain[])
  const timeoutMs = opts?.timeoutMs
  const addr = String(address).toLowerCase()

  const perChain = await Promise.all(
    chains.map(async (chain): Promise<WalletChainSignals> => {
      try {
        const rpcUrls = opts?.rpcUrls?.[chain] ?? WALLET_RPCS[chain] ?? []
        const blockscoutBase =
          opts?.blockscoutUrls?.[chain] === undefined
            ? WALLET_BLOCKSCOUT[chain]
            : opts.blockscoutUrls[chain]

        const [rpc, scout] = await Promise.all([
          rpcProbe(rpcUrls, addr, WALLET_USDC[chain] ?? WALLET_USDC.ethereum, timeoutMs ?? 10_000),
          blockscoutBase
            ? blockscoutProbe(blockscoutBase, addr, timeoutMs ?? 15_000)
            : Promise.resolve<BlockscoutProbe>({}),
        ])

        const errors: { rpc?: string; blockscout?: string } = {}
        if (rpc.error) errors.rpc = rpc.error
        if (scout.error) errors.blockscout = scout.error

        return {
          chain,
          ...(rpc.txCountOut !== undefined ? { txCountOut: rpc.txCountOut } : {}),
          ...(rpc.nativeBalanceWei !== undefined ? { nativeBalanceWei: rpc.nativeBalanceWei } : {}),
          ...(scout.firstSeen ? { firstSeen: scout.firstSeen } : {}),
          ...(scout.totalReceivedWei !== undefined ? { totalReceivedWei: scout.totalReceivedWei } : {}),
          ...(scout.totalTxCount !== undefined ? { totalTxCount: scout.totalTxCount } : {}),
          ...(scout.tokenTransferCount !== undefined
            ? { tokenTransferCount: scout.tokenTransferCount }
            : {}),
          ...(rpc.usdc !== undefined ? { erc20: { usdc: rpc.usdc } } : {}),
          sources: {
            ...(rpc.url ? { rpc: rpc.url } : {}),
            ...(scout.host ? { blockscout: scout.host } : {}),
          },
          ...(errors.rpc || errors.blockscout ? { errors } : {}),
        }
      } catch (e) {
        // Belt over braces: nothing above should reach here, but "must never throw" is a
        // contract, not a hope.
        return {
          chain,
          sources: {},
          errors: { rpc: e instanceof Error ? e.message : String(e) },
        }
      }
    }),
  )

  const now = Math.floor(Date.now() / 1000)
  return {
    address,
    chains: perChain,
    summary: summarizeWalletChains(perChain, now),
    caveat: WALLET_FORENSICS_CAVEAT,
    computedAt: now,
  }
}
