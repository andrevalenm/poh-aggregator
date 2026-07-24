import { createPublicClient, http, isAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { loadOntology } from './ontology.ts'
import { defaultAdapters } from './adapters/index.ts'
import { score, freshnessOf, effectiveCost } from './scoring.ts'
import type { Address, AdapterProbe, Evidence, PersonhoodResult } from './types.ts'

export * from './types.ts'
export { score, freshnessOf, effectiveCost } from './scoring.ts'
export { loadOntology, adapterKey, rootKey, REGISTRY_ABI } from './ontology.ts'
export * from './adapters/index.ts'

/** Registry holding the trust-root ontology. Sepolia. */
export const DEFAULT_REGISTRY = '0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9' as const

export interface CorroborateOptions {
  registryAddress?: `0x${string}`
  registryRpcUrl?: string
  /** For resolving ENS names. Defaults to a public mainnet endpoint. */
  ensRpcUrl?: string
  adapters?: AdapterProbe[]
  knownIds?: string[]
  knownRoots?: string[]
}

/**
 * Corroborate — aggregate personhood credentials, scored by independent trust root.
 *
 * The client holds no user state and talks to no server of ours. Ontology comes from the
 * public registry, credentials come from public chains, and scoring happens here in your
 * process. That is deliberate: an aggregator that collected credentials centrally would
 * become the one party able to link a user's World ID, passport proof and social graph —
 * exactly the correlation those protocols are designed to prevent. We never need that link,
 * because correlation is a property of the credential class, not of the person.
 */
export class Corroborate {
  #opts: Required<Pick<CorroborateOptions, 'registryAddress'>> & CorroborateOptions
  #adapters: AdapterProbe[]
  #ontology?: Awaited<ReturnType<typeof loadOntology>>

  constructor(opts: CorroborateOptions = {}) {
    this.#opts = { registryAddress: opts.registryAddress ?? DEFAULT_REGISTRY, ...opts }
    this.#adapters = opts.adapters ?? defaultAdapters()
  }

  /** Ontology is cached per instance; call `refresh()` after a registry update. */
  async ontology() {
    if (!this.#ontology) {
      this.#ontology = await loadOntology({
        registryAddress: this.#opts.registryAddress,
        ...(this.#opts.registryRpcUrl ? { rpcUrl: this.#opts.registryRpcUrl } : {}),
        ...(this.#opts.knownIds ? { knownIds: this.#opts.knownIds } : {}),
        ...(this.#opts.knownRoots ? { knownRoots: this.#opts.knownRoots } : {}),
      })
    }
    return this.#ontology
  }

  async refresh() {
    this.#ontology = undefined
    return this.ontology()
  }

  /** Resolve an ENS name to an address, or pass an address straight through. */
  async resolveSubject(nameOrAddress: string): Promise<{ address: Address; name?: string }> {
    if (isAddress(nameOrAddress)) return { address: nameOrAddress as Address }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(this.#opts.ensRpcUrl ?? 'https://ethereum-rpc.publicnode.com'),
    })
    const address = await client.getEnsAddress({ name: normalize(nameOrAddress) })
    if (!address) throw new Error(`could not resolve "${nameOrAddress}"`)
    return { address, name: nameOrAddress }
  }

  /**
   * Gather every credential for a subject and score it.
   *
   * A subject may be several addresses. Real people spread credentials across wallets —
   * Proof of Humanity's own Circles proxy pairs a PoH address with a *separate* Circles
   * avatar — so a single-address lookup systematically undercounts them.
   *
   * The caller supplies the address set and is responsible for having authenticated it.
   * We never infer that two addresses belong to one person: that inference is exactly the
   * linkage this design exists to avoid. Correlated roots still saturate *across* the set,
   * so spreading credentials over wallets cannot be used to inflate a score.
   *
   * Probes run concurrently and independently: one protocol being down degrades the result
   * rather than failing it, and a failed probe is reported as an error, never as a negative.
   */
  async resolve(subject: string | readonly string[]): Promise<PersonhoodResult> {
    const inputs = typeof subject === 'string' ? [subject] : [...subject]
    if (inputs.length === 0) throw new Error('resolve requires at least one address or name')

    const [resolved, ontology] = await Promise.all([
      Promise.all(inputs.map((s) => this.resolveSubject(s))),
      this.ontology(),
    ])

    const addresses = resolved.map((r) => r.address)
    const name = resolved.find((r) => r.name)?.name
    const now = Math.floor(Date.now() / 1000)

    const probes = addresses.flatMap((address) =>
      this.#adapters.map(async (probe) => ({ address, probe, result: await probe.probe(address) })),
    )
    const results = await Promise.all(probes)

    const evidence: Evidence[] = []
    for (const { address, probe, result } of results) {
      const adapter = ontology.adapters.get(probe.adapterId)
      if (!adapter) continue // not in the registry, so nothing to weigh it by

      const base = {
        adapterId: adapter.id,
        adapterName: adapter.name,
        evidenceClass: adapter.evidenceClass,
        trustRoot: adapter.trustRoot,
        observedOn: address,
        forgeCostCents: adapter.forgeCostCents,
        rentCostCents: adapter.rentCostCents,
        live: adapter.live,
        sourceURI: adapter.sourceURI,
      }

      // A probe that errored is not evidence of absence.
      if (result.error) {
        evidence.push({
          ...base,
          held: false,
          freshness: 0,
          effectiveCostCents: 0,
          detail: { error: result.error, unavailable: true },
        })
        continue
      }

      const freshness = freshnessOf(adapter, result.issuedAt, now)
      evidence.push({
        ...base,
        held: result.held,
        ...(result.issuedAt !== undefined ? { issuedAt: result.issuedAt } : {}),
        freshness,
        effectiveCostCents: result.held ? effectiveCost(adapter, freshness) : 0,
        ...(result.detail ? { detail: result.detail } : {}),
      })
    }

    return score({
      subjects: addresses,
      ...(name !== undefined ? { name } : {}),
      adapters: ontology.adapters,
      evidence,
      registryRevision: ontology.revision,
      now,
    })
  }
}

/** Convenience for one-off lookups. */
export async function resolvePersonhood(
  nameOrAddress: string,
  opts?: CorroborateOptions,
): Promise<PersonhoodResult> {
  return new Corroborate(opts).resolve(nameOrAddress)
}
