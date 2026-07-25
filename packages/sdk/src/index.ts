import { createPublicClient, getAddress, http, isAddress, type PublicClient } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { normalize } from 'viem/ens'
import { loadOntology } from './ontology.ts'
import ontologyData from './ontology-data.json' with { type: 'json' }
import { defaultAdapters } from './adapters/index.ts'
import { score, freshnessOf, effectiveCost } from './scoring.ts'
import type { Address, AdapterProbe, Evidence, PersonhoodResult } from './types.ts'

export * from './types.ts'
export { score, freshnessOf, effectiveCost } from './scoring.ts'
export { loadOntology, adapterKey, rootKey, REGISTRY_ABI } from './ontology.ts'
export * from './adapters/index.ts'
export * from './subgraph.ts'
export * from './enroll.ts'

/**
 * Named thresholds for `isHuman(threshold)`, exported as documented constants rather than
 * baked in as a default — the choice stays visible at every call site.
 *
 * Derivation, from the deployed ontology (score = log10 of adversary cost in cents):
 *  - a single rentable credential (World Orb at its observed $0.50 resale floor, or a
 *    Circles registration) scores ~1.71
 *  - a Proof of Humanity registration (~$5 rent) scores ~2.70
 *  - a KYC-rooted credential (~$30 rent) scores ~3.48; multiple independent roots go higher
 */
export const Thresholds = {
  /** Any single live credential clears this. Filters only pure zero-evidence subjects. */
  lenient: 1.5,
  /** Requires a mid-cost credential or several weak independent roots. */
  standard: 2.5,
  /** Requires a strong credential plus independent corroboration. Expect false negatives. */
  strict: 3.5,
} as const

/**
 * Registry holding the trust-root ontology. Sepolia.
 * v2 — adds age curves and plaintext ids in events. v1 (same ontology, uniform decay)
 * remains at 0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9.
 */
export const DEFAULT_REGISTRY = '0x977b028b900cce8ee89c46877e814eff3060aa07' as const

export interface CorroborateOptions {
  registryAddress?: `0x${string}`
  registryRpcUrl?: string
  /**
   * GraphQL endpoint of the Corroborate subgraph. Supplies issuance dates (which unlock
   * decay) and trust-graph position. Without it the SDK degrades to bare contract reads and
   * results carry the issuance-date-unknown caveat.
   */
  subgraphUrl?: string
  /** For resolving ENS names. Defaults to a public mainnet endpoint. */
  ensRpcUrl?: string
  /** Chain whose ENS deployment to resolve against. */
  ensChain?: 'mainnet' | 'sepolia'
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
    this.#adapters =
      opts.adapters ?? defaultAdapters(opts.subgraphUrl ? { subgraphUrl: opts.subgraphUrl } : undefined)
  }

  /**
   * Ontology is cached per instance; call `refresh()` after a registry update.
   *
   * The bundled id/root preimages are only for reversing on-chain hashes into readable
   * names — the registry stays the source of truth for every weight. Without defaults,
   * omitting knownIds silently keyed adapters by hash, matched nothing, and returned
   * score 0 with a no-evidence caveat: a wrong answer in the adversary's favour.
   */
  async ontology() {
    if (!this.#ontology) {
      this.#ontology = await loadOntology({
        registryAddress: this.#opts.registryAddress,
        ...(this.#opts.registryRpcUrl ? { rpcUrl: this.#opts.registryRpcUrl } : {}),
        knownIds: this.#opts.knownIds ?? ontologyData.adapters.map((a) => a.id),
        knownRoots: this.#opts.knownRoots ?? Object.keys(ontologyData.trustRoots),
      })
    }
    return this.#ontology
  }

  async refresh() {
    this.#ontology = undefined
    return this.ontology()
  }

  #ensClient(): PublicClient {
    const chain = this.#opts.ensChain === 'sepolia' ? sepolia : mainnet
    const url =
      this.#opts.ensRpcUrl ??
      (this.#opts.ensChain === 'sepolia'
        ? 'https://ethereum-sepolia-rpc.publicnode.com'
        : 'https://ethereum-rpc.publicnode.com')
    return createPublicClient({ chain, transport: http(url) }) as PublicClient
  }

  /**
   * Resolve an ENS name to an address — and, when the name carries a
   * `corroborate.subjects` text record, to the full address set it declares.
   *
   * The record is the product idea in one line: ENS is where a person asserts which
   * wallets are theirs. Real people hold different credentials on different addresses
   * (PoH's own Circles proxy pairs a PoH address with a separate avatar), and this gives
   * that address set a user-controlled, on-chain, revocable home — no server of ours
   * involved. The record is SELF-asserted: the name owner can list any addresses, the
   * listed addresses have not countersigned, and scoring flags exactly that.
   */
  async resolveSubject(nameOrAddress: string): Promise<{ address: Address; name?: string; declaredSubjects?: Address[] }> {
    // Trim before the address check: a space-padded address is still an address, and
    // failing that check sends it into ENS normalization, which rejects the spaces with a
    // baffling "disallowed character" error. Callers paste with whitespace constantly.
    const trimmed = nameOrAddress.trim()
    if (trimmed === '') throw new Error('empty subject: pass an address or ENS name')
    // Accept any valid 20-byte hex address regardless of case — checksum casing is a
    // typo-guard, not an identity, and users paste lowercase constantly. Return it
    // checksummed so downstream comparisons are canonical.
    if (isAddress(trimmed, { strict: false })) return { address: getAddress(trimmed) }

    const client = this.#ensClient()
    let name: string
    try {
      name = normalize(trimmed)
    } catch {
      // Not an address and not a normalizable name — say so plainly rather than leaking a
      // normalization internal error.
      throw new Error(`not an address or a valid ENS name: "${nameOrAddress}"`)
    }
    const [address, subjectsRecord] = await Promise.all([
      client.getEnsAddress({ name }),
      client.getEnsText({ name, key: 'corroborate.subjects' }).catch(() => null),
    ])
    if (!address) throw new Error(`ENS name does not resolve to an address: "${trimmed}"`)

    const declared = (subjectsRecord ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => isAddress(s)) as Address[]

    return {
      address,
      name: trimmed,
      ...(declared.length ? { declaredSubjects: declared } : {}),
    }
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
    const raw = typeof subject === 'string' ? [subject] : [...subject]
    // Dedupe case-insensitively: the same wallet pasted twice must not probe twice.
    const seen = new Set<string>()
    const inputs = raw.filter((s) => {
      const k = s.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (inputs.length === 0) throw new Error('resolve requires at least one address or name')

    const [resolved, ontology] = await Promise.all([
      Promise.all(inputs.map((s) => this.resolveSubject(s))),
      this.ontology(),
    ])

    // A name's corroborate.subjects record expands the set; dedupe again afterwards.
    const expandedSeen = new Set<string>()
    const addresses: Address[] = []
    let subjectsDeclaredByName = false
    for (const r of resolved) {
      const batch = [r.address, ...(r.declaredSubjects ?? [])]
      if (r.declaredSubjects?.length) subjectsDeclaredByName = true
      for (const a of batch) {
        const k = a.toLowerCase()
        if (!expandedSeen.has(k)) {
          expandedSeen.add(k)
          addresses.push(a)
        }
      }
    }
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

    const result = score({
      subjects: addresses,
      ...(name !== undefined ? { name } : {}),
      adapters: ontology.adapters,
      evidence,
      registryRevision: ontology.revision,
      now,
    })
    if (subjectsDeclaredByName) {
      result.caveats.push({
        code: 'address-set-asserted-by-name-owner',
        message:
          'Part of this address set comes from a corroborate.subjects ENS text record. The name owner asserted it; the listed addresses have not countersigned, so ownership of every listed wallet is a claim, not a proof.',
      })
    }
    return result
  }
}

/** Convenience for one-off lookups. */
export async function resolvePersonhood(
  nameOrAddress: string,
  opts?: CorroborateOptions,
): Promise<PersonhoodResult> {
  return new Corroborate(opts).resolve(nameOrAddress)
}
