import { createPublicClient, http, parseAbi, type PublicClient } from 'viem'
import { worldchain } from 'viem/chains'
import type { Address } from './types.ts'
import type { FleetAgent, HumanBacking } from './fleet.ts'

/**
 * AgentBook — World Chain's human↔agent registry, read as a *fleet* index.
 *
 * `lookupHuman(agent)` answers the per-request question and `world.ts` already uses it. This
 * file answers the question a fleet policy needs and the mapping cannot: **which other agents
 * did this human register?** There is no reverse index — a `PUSH4` scan of the deployed
 * bytecode finds seventeen selectors and the only reads are `lookupHuman(address)`,
 * `getNextNonce(address)`, `groupId()`, `worldIdRouter()` and the ownership pair. Same shape as
 * Verax on Linea: a mapping keyed the wrong way for the question being asked.
 *
 * Unlike Verax, the whole registry fits in one scan. AgentBook was deployed at World Chain block
 * 27,053,063 (2026-03-13) and has emitted **1,164** `AgentRegistered(address indexed agent,
 * uint256 indexed humanId)` events in its life, one per transaction. Six chunked `eth_getLogs`
 * calls read the entire history in about five seconds, so the index this module builds is the
 * complete registry rather than a sample — and `fleetOf()` returns *all* of a human's agents,
 * not the ones we happened to be shown.
 *
 * ## Why the log is the whole truth here
 *
 * `register(address account, uint256 root, uint256 nonce, uint256 nullifierHash, uint256[8]
 * proof)` is the only function that writes the mapping, and it emits. There is no admin write
 * path (contrast Proof of Humanity v1's `addSubmissionManually`, which moved the counter with no
 * event, or Farcaster's `SetIdCounter` import) and no deregistration selector at all, so the
 * registry is append-only and the event stream reconstructs it exactly. That is asserted rather
 * than assumed: the live suite re-reads `lookupHuman` from *state* for a sample of the agents
 * the log names and requires the two to agree, and re-scans at a second chunk size to catch a
 * silently truncating endpoint.
 *
 * ## What `humanId` is, and what it is not
 *
 * It is the Semaphore nullifier hash the registering World ID proof produced — confirmed from
 * the chain rather than from documentation: in a real `register` transaction the fourth argument
 * equals the value the event carries in its second topic. Because a nullifier hash is
 * deterministic in (identity, external nullifier), one World ID always yields the same `humanId`
 * here, which is what makes "at most N agents per human" enforceable at all.
 *
 * It is also **scoped to this contract, and cannot be joined to any other World registry**.
 * `AgentBookInitialized` records an `externalNullifierHash` of
 * `38265997849925878342838486616706141368121079204652799064895347807228265498`, while
 * `WorldIDAddressBookInitialized` records `3775935569878740431654007528834557228959016923326436\
 * 78318174569531027326541`. Same router, same group 1 (the Orb), different external nullifier —
 * so the same human is two unlinkable pseudonyms across the two contracts by construction.
 * Measured: of 150 AgentBook humanIds tested against `WorldIDAddressBook.nullifierHashes`, zero
 * resolve. This is why an agent's operator address set stays *asserted* and carries
 * `address-set-not-authenticated`: no amount of chain reading gets from an agent to the wallets
 * its operator holds credentials on. That is a property of World's privacy design working as
 * intended, not a gap in this implementation.
 */

/** `AgentBook` on World Chain. Same address `@worldcoin/agentkit` ships. */
export const AGENT_BOOK = '0xA23aB2712eA7BBa896930544C7d6636a96b944dA' as const

/** Block AgentBook's code first appears at, found by bisecting `eth_getCode`. */
export const AGENT_BOOK_DEPLOYED_AT_BLOCK = 27_053_063

/** `AgentRegistered(address indexed agent, uint256 indexed humanId)`. */
export const AGENT_REGISTERED_TOPIC =
  '0xd1b844701695237443dd884ed7193d9c8788f3befd35adc0910472eb166f3306' as const

/** External nullifier the AgentBook was initialised with — see the header. */
export const AGENT_BOOK_EXTERNAL_NULLIFIER =
  38265997849925878342838486616706141368121079204652799064895347807228265498n

export const AGENT_BOOK_ABI = parseAbi([
  'function lookupHuman(address account) view returns (uint256)',
  'function groupId() view returns (uint256)',
  'function worldIdRouter() view returns (address)',
  'event AgentRegistered(address indexed agent, uint256 indexed humanId)',
  'event AgentBookInitialized(address worldIdRouter, uint256 groupId, uint256 externalNullifierHash)',
])

/**
 * Block holding the registry's first `AgentRegistered` event, used as a canary — see
 * `canaryOk` below. Immutable history: block 27,100,652, agent
 * `0xb667e02591db55f47bcb59beb7ff9cd6886b83a1`, tx `0xc19650a0…a0cfe`.
 */
export const AGENT_BOOK_FIRST_REGISTRATION_BLOCK = 27_100_652

/**
 * Endpoints that serve World Chain `eth_getLogs` over a useful range. Measured 2026-07-25,
 * keyless, no account.
 *
 * Only one qualifies: `worldchain-mainnet.gateway.tenderly.co` returns the whole 5.8M-block
 * history in six 1M-block calls, in about five seconds. `worldchain-mainnet.g.alchemy.com/public`
 * caps at 100 blocks (it is the endpoint `world.ts` uses for state, where that cap does not
 * matter) and `480.rpc.thirdweb.com` at 1,000 — both refuse loudly, which is fine.
 *
 * **`worldchain.drpc.org` is deliberately not here, and the reason is the interesting one.** It
 * advertises 10,000-block ranges on the free plan and answers them with HTTP 200 and an empty
 * result array: a window provably containing 39 registrations returns `[]`, four times out of
 * four. As a fallback it turned a full history into 7 registrations without erroring — an empty
 * fleet index reads as "this human runs one agent", which is the precise answer the policy
 * exists to prevent. An endpoint that lies is worse than no endpoint, so the list is one long
 * and a scan that cannot be served fails.
 *
 * Tenderly itself silently *truncates* oversized results rather than erroring — measured in
 * iteration 7 on a different World Chain contract — which is why this scanner chunks at all,
 * why every endpoint must clear the canary before its answer is used, and why the live suite
 * re-scans at a second chunk size and demands the identical set.
 */
export const AGENT_BOOK_LOG_ENDPOINTS = [
  { url: 'https://worldchain-mainnet.gateway.tenderly.co', maxRange: 1_000_000 },
] as const

/** Keyless World Chain endpoint for state reads. */
export const WORLD_STATE_RPC = 'https://worldchain-mainnet.g.alchemy.com/public'

export interface AgentRegistration {
  agent: Address
  /** Decimal string. A nullifier hash does not fit a JS number and is not an address. */
  humanId: string
  block: number
  /** Block timestamp, when the endpoint returned one. Not required for anything we decide. */
  timestamp?: number
  txHash: string
}

export interface AgentBookIndex {
  /** Highest block the scan covered. Every answer here is as of this block. */
  head: number
  /** Every registration ever emitted, in block order. */
  registrations: AgentRegistration[]
  /** The human who registered this agent, or undefined if nobody did. */
  humanOf(agent: Address): string | undefined
  /** Every agent this human registered — the fleet. */
  fleetOf(humanId: string): AgentRegistration[]
  /** Every *other* agent registered by the same human as this one. */
  siblingsOf(agent: Address): AgentRegistration[]
  /** This agent, plus its siblings, as policy input. */
  fleetAround(agent: Address): FleetAgent[]
  stats: {
    agents: number
    humans: number
    largestFleet: number
    humansWithMoreThanOneAgent: number
    /** Agents per human. What a venue counting requesters gets wrong. */
    collapseRatio: number
    /** Agents whose address appears in more than one registration. Zero as of the last scan. */
    reRegisteredAgents: number
  }
  /** How the scan was performed, for the trace. */
  source: { endpoint: string; chunkSize: number; fromBlock: number; calls: number }
}

interface RawLog {
  topics: string[]
  blockNumber: string
  blockTimestamp?: string
  transactionHash: string
}

async function getLogs(url: string, from: number, to: number): Promise<RawLog[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [
        {
          address: AGENT_BOOK,
          topics: [AGENT_REGISTERED_TOPIC],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  const body = (await res.json()) as { result?: RawLog[]; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message ?? 'eth_getLogs failed')
  if (!body.result) throw new Error('eth_getLogs returned no result')
  return body.result
}

/**
 * One block, one call: does this endpoint return the registration we know is in it?
 *
 * A log endpoint that answers `[]` with HTTP 200 cannot be distinguished from an empty registry
 * by anything downstream, and an empty registry is a *permissive* answer here — every human
 * looks like they run one agent. So no endpoint's history is used before it has proved it can
 * see a registration that has been on chain since March.
 */
async function canaryOk(url: string): Promise<boolean> {
  try {
    const logs = await getLogs(url, AGENT_BOOK_FIRST_REGISTRATION_BLOCK, AGENT_BOOK_FIRST_REGISTRATION_BLOCK)
    return logs.length > 0
  } catch {
    return false
  }
}

/** Public endpoints rate-limit; a scan is a couple of dozen calls and will meet one. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

export interface ScanAgentBookOptions {
  /** Endpoints to try in order. Defaults to `AGENT_BOOK_LOG_ENDPOINTS`. */
  endpoints?: readonly { url: string; maxRange: number }[]
  /** Override the block range per call — the live suite uses this to re-scan at another size. */
  chunkSize?: number
  /** Highest block to scan. Defaults to the chain head. */
  toBlock?: number
  /** State endpoint, used only to find the head. */
  stateRpcUrl?: string
}

/**
 * Read AgentBook's entire registration history and build the fleet index.
 *
 * Chunked, and endpoints are tried in order rather than raced: the fallback serves a hundredth
 * of the range per call, so preferring it when the first works would turn a five-second scan
 * into a nine-minute one.
 */
export async function scanAgentBook(opts: ScanAgentBookOptions = {}): Promise<AgentBookIndex> {
  const endpoints = opts.endpoints ?? AGENT_BOOK_LOG_ENDPOINTS
  const client = createPublicClient({
    chain: worldchain,
    transport: http(opts.stateRpcUrl ?? WORLD_STATE_RPC),
  }) as PublicClient
  const head = opts.toBlock ?? Number(await client.getBlockNumber())

  let logs: RawLog[] | undefined
  let used: { url: string; chunkSize: number; calls: number } | undefined
  let lastError: unknown
  for (const ep of endpoints) {
    const chunk = Math.max(1, Math.min(opts.chunkSize ?? ep.maxRange, ep.maxRange))
    try {
      if (!(await canaryOk(ep.url))) {
        throw new Error(
          `${new URL(ep.url).host} returned no logs for block ${AGENT_BOOK_FIRST_REGISTRATION_BLOCK}, which has held a registration since 2026-03; its history is not trustworthy`,
        )
      }
      const acc: RawLog[] = []
      let calls = 1
      for (let from = AGENT_BOOK_DEPLOYED_AT_BLOCK; from <= head; from += chunk) {
        const to = Math.min(from + chunk - 1, head)
        acc.push(...(await withRetry(() => getLogs(ep.url, from, to))))
        calls++
      }
      logs = acc
      used = { url: ep.url, chunkSize: chunk, calls }
      break
    } catch (e) {
      lastError = e
    }
  }
  if (!logs || !used) {
    throw new Error(
      `AgentBook history unreadable from every configured endpoint (${endpoints
        .map((e) => new URL(e.url).host)
        .join(', ')}): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
  }

  const registrations: AgentRegistration[] = logs
    .map((l) => ({
      agent: `0x${(l.topics[1] ?? '').slice(26)}`.toLowerCase() as Address,
      humanId: BigInt(l.topics[2] ?? '0x0').toString(),
      block: Number.parseInt(l.blockNumber, 16),
      ...(l.blockTimestamp ? { timestamp: Number.parseInt(l.blockTimestamp, 16) } : {}),
      txHash: l.transactionHash,
    }))
    .sort((a, b) => a.block - b.block)

  return buildIndex(registrations, head, {
    endpoint: used.url,
    chunkSize: used.chunkSize,
    fromBlock: AGENT_BOOK_DEPLOYED_AT_BLOCK,
    calls: used.calls,
  })
}

/**
 * Turn a registration list into the index. Separated from the scan so the whole grouping,
 * fleet-shape and re-registration logic is testable without a network.
 *
 * Later registrations win when an address appears twice. Nothing has ever re-registered on the
 * deployed contract, but the mapping is a plain overwrite, so an index that kept the first entry
 * would attribute an agent to a human who no longer holds it.
 */
export function buildIndex(
  registrations: AgentRegistration[],
  head: number,
  source: AgentBookIndex['source'],
): AgentBookIndex {
  const latest = new Map<Address, AgentRegistration>()
  let reRegistered = 0
  for (const r of registrations) {
    const prev = latest.get(r.agent)
    if (prev) {
      reRegistered++
      if (prev.block > r.block) continue
    }
    latest.set(r.agent, r)
  }

  const fleets = new Map<string, AgentRegistration[]>()
  for (const r of latest.values()) {
    const f = fleets.get(r.humanId)
    if (f) f.push(r)
    else fleets.set(r.humanId, [r])
  }
  for (const f of fleets.values()) f.sort((a, b) => a.block - b.block)

  const sizes = [...fleets.values()].map((f) => f.length)
  const humanOf = (agent: Address) => latest.get(agent.toLowerCase() as Address)?.humanId
  const fleetOf = (humanId: string) => [...(fleets.get(humanId) ?? [])]

  return {
    head,
    registrations,
    humanOf,
    fleetOf,
    siblingsOf(agent) {
      const id = humanOf(agent)
      if (id === undefined) return []
      const a = agent.toLowerCase()
      return fleetOf(id).filter((r) => r.agent !== a)
    },
    fleetAround(agent) {
      const id = humanOf(agent)
      const members =
        id === undefined
          ? [{ agent: agent.toLowerCase() as Address, humanId: undefined, block: undefined }]
          : fleetOf(id).map((r) => ({ agent: r.agent, humanId: r.humanId, block: r.block }))
      return members.map((m) => ({
        agent: m.agent,
        backing: (m.humanId === undefined
          ? { status: 'unbacked' }
          : { status: 'backed', humanId: m.humanId }) as HumanBacking,
        ...(m.block !== undefined ? { registeredAtBlock: m.block } : {}),
      }))
    },
    stats: {
      agents: latest.size,
      humans: fleets.size,
      largestFleet: sizes.length ? Math.max(...sizes) : 0,
      humansWithMoreThanOneAgent: sizes.filter((n) => n > 1).length,
      collapseRatio: fleets.size === 0 ? 0 : Number((latest.size / fleets.size).toFixed(2)),
      reRegisteredAgents: reRegistered,
    },
    source,
  }
}

/**
 * Per-request human-backing for a set of agent wallets, from state rather than from the log.
 *
 * This is the cheap path — one multicall, no history — and it is what a live venue runs on every
 * request. It answers "which human" but never "how many siblings"; that needs the index.
 *
 * A failed read comes back `unknown`, never `unbacked`. AgentKit's own verifier catches RPC
 * failures and returns null, which is indistinguishable from "no human registered this wallet" —
 * a network blip would read as an accusation.
 */
export async function lookupHumans(
  agents: readonly Address[],
  rpcUrl: string = WORLD_STATE_RPC,
): Promise<Map<Address, HumanBacking>> {
  const out = new Map<Address, HumanBacking>()
  if (agents.length === 0) return out
  const client = createPublicClient({ chain: worldchain, transport: http(rpcUrl) }) as PublicClient
  try {
    const results = await client.multicall({
      allowFailure: true,
      contracts: agents.map((a) => ({
        address: AGENT_BOOK,
        abi: AGENT_BOOK_ABI,
        functionName: 'lookupHuman' as const,
        args: [a] as const,
      })),
    })
    results.forEach((r, i) => {
      const agent = agents[i]!
      if (r.status !== 'success') {
        out.set(agent, { status: 'unknown', error: r.error?.message ?? 'call failed' })
      } else if (r.result === 0n) {
        out.set(agent, { status: 'unbacked' })
      } else {
        out.set(agent, { status: 'backed', humanId: r.result.toString() })
      }
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    for (const a of agents) out.set(a, { status: 'unknown', error })
  }
  return out
}
