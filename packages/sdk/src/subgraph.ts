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
