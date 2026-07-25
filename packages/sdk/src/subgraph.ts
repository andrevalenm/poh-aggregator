/**
 * Subgraph client — the SDK's source for what a boolean contract read cannot see.
 *
 * `isHuman(addr)` answers "does this credential exist"; it cannot answer "when was it
 * issued" (decay needs an event, not a storage slot), "was it revoked", or "what is this
 * avatar's position in the trust graph". Those live in indexed history, and the subgraph is
 * where we read them. When the subgraph is unreachable the SDK degrades to contract reads —
 * scores stay correct but carry the `issuance-date-unknown` caveat instead of decay.
 */

export interface PohEnrichment {
  claimedAt: number
  revoked: boolean
}

export interface CirclesEnrichment {
  registeredAt: number
  trustedByCount: number
  stopped: boolean
}

async function query<T>(url: string, q: string, timeoutMs = 10_000): Promise<T | undefined> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as { data?: T; errors?: unknown[] }
    if (json.errors?.length) return undefined
    return json.data
  } catch {
    return undefined
  }
}

/** PoH v2 humanity ids are the claimant's address as bytes20, so the lookup key is the address. */
export async function pohEnrichment(
  subgraphUrl: string,
  address: string,
): Promise<PohEnrichment | undefined> {
  const data = await query<{ pohHuman: { claimedAt: string; revoked: boolean } | null }>(
    subgraphUrl,
    `{ pohHuman(id: "${address.toLowerCase()}") { claimedAt revoked } }`,
  )
  if (!data?.pohHuman) return undefined
  return { claimedAt: Number(data.pohHuman.claimedAt), revoked: data.pohHuman.revoked }
}

export async function circlesEnrichment(
  subgraphUrl: string,
  address: string,
): Promise<CirclesEnrichment | undefined> {
  const data = await query<{
    circlesAvatar: { registeredAt: string; trustedByCount: number; stopped: boolean } | null
  }>(
    subgraphUrl,
    `{ circlesAvatar(id: "${address.toLowerCase()}") { registeredAt trustedByCount stopped } }`,
  )
  if (!data?.circlesAvatar) return undefined
  return {
    registeredAt: Number(data.circlesAvatar.registeredAt),
    trustedByCount: data.circlesAvatar.trustedByCount,
    stopped: data.circlesAvatar.stopped,
  }
}

/** True once the subgraph has a synced head. Used by tests to skip rather than fail while syncing. */
export async function subgraphReady(subgraphUrl: string): Promise<boolean> {
  const data = await query<{ _meta: { block: { number: number } } | null }>(
    subgraphUrl,
    `{ _meta { block { number } } }`,
  )
  return (data?._meta?.block?.number ?? 0) > 0
}

// ---------------------------------------------------------- registry audit trail

export interface WeightChange {
  revision: number
  forgeCostCents: number
  rentCostCents: number
  live: boolean
  sourceURI: string
  timestamp: number
  block: number
  txHash: string
}

/**
 * The audit trail for one adapter, from the registry subgraph — every weight the ontology
 * has ever assigned it, each with the source it was derived from and the block it landed in.
 *
 * This is the accountability half of curated weights: the weights are judgments, so the
 * least a subject is owed is the full history of those judgments and their sources. The
 * biggest sybil-filtering deployment to date drew its loudest criticism for having no
 * stated method and no appeal path; this is the opposite design.
 */
export async function weightHistory(
  registrySubgraphUrl: string,
  adapterId: string,
): Promise<WeightChange[] | undefined> {
  const data = await query<{
    weightChanges: {
      revision: string
      forgeCostCents: string
      rentCostCents: string
      live: boolean
      sourceURI: string
      timestamp: string
      block: string
      txHash: string
    }[]
  }>(
    registrySubgraphUrl,
    `{ weightChanges(where: { adapter: "${adapterId}" }, orderBy: revision, orderDirection: asc) {
        revision forgeCostCents rentCostCents live sourceURI timestamp block txHash } }`,
  )
  if (!data) return undefined
  return data.weightChanges.map((w) => ({
    revision: Number(w.revision),
    forgeCostCents: Number(w.forgeCostCents),
    rentCostCents: Number(w.rentCostCents),
    live: w.live,
    sourceURI: w.sourceURI,
    timestamp: Number(w.timestamp),
    block: Number(w.block),
    txHash: w.txHash,
  }))
}
