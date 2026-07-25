import { createPublicClient, http, type PublicClient } from 'viem'
import { gnosis, worldchain, base } from 'viem/chains'
import type { Address, AdapterProbe, AdapterProbeResult } from '../types.ts'
import { pohEnrichment, circlesEnrichment } from '../subgraph.ts'

/**
 * Adapters.
 *
 * Every adapter here reads a credential **without the issuing vendor's cooperation** — no
 * API key on the critical path, nothing that can rate-limit or revoke us. That constraint
 * shaped the selection: World is read through AgentBook rather than the verification API,
 * because `lookupHuman` is a plain `eth_call` that returns the Orb-verified status of any
 * address with no proof, no relying-party id and no user interaction.
 *
 * A probe must never throw. A network failure returning `held: false` would silently
 * become "this person is not human", so failures surface as an `error` and are excluded
 * from scoring rather than counted as a negative.
 */

export const RPC = {
  gnosis: 'https://rpc.gnosischain.com',
  worldchain: 'https://worldchain-mainnet.g.alchemy.com/public',
  // base.org returns 403 to non-browser clients; publicnode does not.
  base: 'https://base-rpc.publicnode.com',
} as const

export const CONTRACTS = {
  /** Permissionless World ID lookup. groupId 1 == Orb-verified only. */
  worldAgentBook: '0xA23aB2712eA7BBa896930544C7d6636a96b944dA',
  /** Proof of Humanity v2 proxy on Gnosis. */
  pohV2: '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc',
  /** Circles v2 Hub on Gnosis. */
  circlesHub: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
} as const

const client = (chain: typeof gnosis | typeof worldchain | typeof base, url: string) =>
  createPublicClient({ chain, transport: http(url) }) as PublicClient

async function safe(fn: () => Promise<AdapterProbeResult>): Promise<AdapterProbeResult> {
  try {
    return await fn()
  } catch (e) {
    return { held: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// --------------------------------------------------------------- World ID

const AGENTBOOK_ABI = [
  {
    type: 'function',
    name: 'lookupHuman',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/**
 * World ID (Orb tier), read permissionlessly from World Chain.
 *
 * A non-zero humanId means the address is bound to an Orb-verified human. Note this is
 * also a stable global identifier published on a public chain, which sits awkwardly beside
 * World's unlinkability story — we read it, we do not republish it.
 */
export function worldIdOrbAdapter(rpcUrl: string = RPC.worldchain): AdapterProbe {
  const c = client(worldchain, rpcUrl)
  return {
    adapterId: 'world-id-orb',
    probe: (subject: Address) =>
      safe(async () => {
        const humanId = await c.readContract({
          address: CONTRACTS.worldAgentBook,
          abi: AGENTBOOK_ABI,
          functionName: 'lookupHuman',
          args: [subject],
        })
        return { held: humanId !== 0n, detail: { humanId: humanId.toString(), tier: 'orb' } }
      }),
  }
}

// -------------------------------------------------------- Proof of Humanity

const POH_ABI = [
  {
    type: 'function',
    name: 'isHuman',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'humanityOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bytes20' }],
  },
] as const

/**
 * Proof of Humanity v2 on Gnosis.
 *
 * Weight this by registration age rather than the boolean. Roughly 1,299 of 1,364 lifetime
 * registrations arrived in a four-month window tracking a ~$9.94 PNK airdrop one-for-one,
 * `requiredNumberOfVouches()` is 1, and `HumanityRevoked` has fired exactly once ever.
 */
export function pohAdapter(rpcUrl: string = RPC.gnosis, subgraphUrl?: string): AdapterProbe {
  const c = client(gnosis, rpcUrl)
  return {
    adapterId: 'poh-v2',
    probe: (subject: Address) =>
      safe(async () => {
        const held = await c.readContract({
          address: CONTRACTS.pohV2,
          abi: POH_ABI,
          functionName: 'isHuman',
          args: [subject],
        })
        if (!held) return { held: false }

        let humanityId: string | undefined
        try {
          humanityId = await c.readContract({
            address: CONTRACTS.pohV2,
            abi: POH_ABI,
            functionName: 'humanityOf',
            args: [subject],
          })
        } catch {
          // Optional detail; absence must not turn a positive into a negative.
        }

        // The subgraph supplies what the contract read cannot: WHEN this was claimed. PoH
        // is airdrop-inflated, so age is most of the signal — a 2022 registration and one
        // from last week's reward window are different evidence.
        if (subgraphUrl) {
          const enriched = await pohEnrichment(subgraphUrl, subject)
          if (enriched) {
            return {
              held: !enriched.revoked,
              issuedAt: enriched.claimedAt,
              detail: {
                ...(humanityId ? { humanityId } : {}),
                claimedAt: enriched.claimedAt,
                source: 'subgraph',
              },
            }
          }
        }
        return { held: true, detail: humanityId ? { humanityId } : {} }
      }),
  }
}

// ----------------------------------------------------------------- Circles

const CIRCLES_ABI = [
  {
    type: 'function',
    name: 'isHuman',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

/**
 * Circles v2 on Gnosis — registration plus trust-graph position.
 *
 * Registration alone is close to worthless: a sybil costs about two days of freely-minted
 * CRC, and the public indexer carries event namespaces named `BotCreated` and `FarmGrown`.
 * What carries signal is position in the trust graph, so we fetch incoming trust edges and
 * expose them as detail for the graph-derived modifier.
 */
export function circlesAdapter(
  rpcUrl: string = RPC.gnosis,
  indexerUrl = 'https://rpc.aboutcircles.com/',
  subgraphUrl?: string,
): AdapterProbe {
  const c = client(gnosis, rpcUrl)
  return {
    adapterId: 'circles-v2',
    probe: (subject: Address) =>
      safe(async () => {
        const held = await c.readContract({
          address: CONTRACTS.circlesHub,
          abi: CIRCLES_ABI,
          functionName: 'isHuman',
          args: [subject],
        })
        if (!held) return { held: false }

        // Subgraph first: registeredAt enables decay, trustedByCount is the graph position,
        // and neither depends on the vendor's indexer staying up.
        if (subgraphUrl) {
          const enriched = await circlesEnrichment(subgraphUrl, subject)
          if (enriched) {
            return {
              held: !enriched.stopped,
              issuedAt: enriched.registeredAt,
              detail: { trustedBy: enriched.trustedByCount, source: 'subgraph' },
            }
          }
        }

        let trustedBy: number | undefined
        try {
          const res = await fetch(indexerUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'circles_query',
              params: [
                {
                  Namespace: 'V_CrcV2',
                  Table: 'TrustRelations',
                  Columns: ['truster'],
                  Filter: [
                    { Type: 'FilterPredicate', FilterType: 'Equals', Column: 'trustee', Value: subject.toLowerCase() },
                  ],
                  Order: [],
                },
              ],
            }),
            signal: AbortSignal.timeout(12_000),
          })
          const json = (await res.json()) as { result?: { rows?: unknown[] } }
          trustedBy = json.result?.rows?.length
        } catch {
          // Indexer is best-effort; registration alone still counts.
        }
        return { held: true, detail: trustedBy === undefined ? {} : { trustedBy } }
      }),
  }
}

// ---------------------------------------------------- Coinbase Verifications

const COINBASE_VERIFIED_ACCOUNT_SCHEMA =
  '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9'

/**
 * Coinbase Verified Account, read from EAS on Base.
 *
 * Persona-rooted, per Coinbase's own third-party vendor disclosure — so it shares a trust
 * root with every other Persona-backed credential and must not be counted beside them.
 *
 * Revocation is checked explicitly rather than inferred from presence: 720,503 of these
 * have been issued and 406,022 revoked, so presence alone is wrong more than half the time.
 */
export function coinbaseVerificationAdapter(
  easGraphQL = 'https://base.easscan.org/graphql',
): AdapterProbe {
  return {
    adapterId: 'coinbase-verification',
    probe: (subject: Address) =>
      safe(async () => {
        const res = await fetch(easGraphQL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query($where: AttestationWhereInput) {
              attestations(where: $where, orderBy: { time: desc }, take: 1) {
                id revoked revocationTime time expirationTime attester
              }
            }`,
            variables: {
              where: {
                recipient: { equals: subject },
                schemaId: { equals: COINBASE_VERIFIED_ACCOUNT_SCHEMA },
                revoked: { equals: false },
              },
            },
          }),
          signal: AbortSignal.timeout(15_000),
        })
        const json = (await res.json()) as {
          data?: { attestations?: { id: string; revoked: boolean; time: number; attester: string }[] }
        }
        const att = json.data?.attestations?.[0]
        if (!att) return { held: false }
        return {
          held: true,
          issuedAt: Number(att.time),
          detail: { attestationId: att.id, attester: att.attester, revoked: att.revoked },
        }
      }),
  }
}

/** Every adapter that can be read without vendor cooperation. */
export function defaultAdapters(opts?: { subgraphUrl?: string }): AdapterProbe[] {
  return [
    worldIdOrbAdapter(),
    pohAdapter(RPC.gnosis, opts?.subgraphUrl),
    circlesAdapter(RPC.gnosis, undefined, opts?.subgraphUrl),
    coinbaseVerificationAdapter(),
  ]
}
