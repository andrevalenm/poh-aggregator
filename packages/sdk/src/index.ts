import { createPublicClient, getAddress, http, isAddress, type PublicClient } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { normalize } from 'viem/ens'
import { loadOntology } from './ontology.ts'
import ontologyData from './ontology-data.json' with { type: 'json' }
import { defaultAdapters } from './adapters/index.ts'
import { score, freshnessOf, effectiveCost } from './scoring.ts'
import { HUMAN_SUBJECTS_RECORD } from './ens-agents.ts'
import {
  applyAsOfToEvidence,
  headRevisionOf,
  loadOntologyAsOf,
  registryClient,
  resolveAsOfPoint,
  type AsOf,
  type AsOfScoring,
} from './as-of.ts'
import type { Address, AdapterProbe, Evidence, PersonhoodResult } from './types.ts'

export * from './types.ts'
export { score, freshnessOf, effectiveCost } from './scoring.ts'
export { loadOntology, adapterKey, rootKey, REGISTRY_ABI } from './ontology.ts'
export * from './adapters/index.ts'
export * from './subgraph.ts'
export * from './enroll.ts'
export * from './reconcile.ts'
export * from './as-of.ts'
export * from './fleet.ts'
export * from './agentbook.ts'
export * from './ens-agents.ts'

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

export interface PrintOptions {
  registryAddress?: `0x${string}`
  registryRpcUrl?: string
  /**
   * GraphQL endpoint of the Print subgraph. Supplies issuance dates (which unlock
   * decay) and trust-graph position. Without it the SDK degrades to bare contract reads and
   * results carry the issuance-date-unknown caveat.
   */
  subgraphUrl?: string
  /**
   * GraphQL endpoint of the registry audit-trail subgraph. Required only for `asOf` scoring:
   * reconstructing the ontology at a past block is the one read here that an archive node
   * cannot serve without already knowing every adapter id. See `as-of.ts`.
   */
  registrySubgraphUrl?: string
  /** For resolving ENS names. Defaults to a public mainnet endpoint. */
  ensRpcUrl?: string
  /** Chain whose ENS deployment to resolve against. */
  ensChain?: 'mainnet' | 'sepolia'
  adapters?: AdapterProbe[]
  knownIds?: string[]
  knownRoots?: string[]
}

export interface ResolveOptions {
  /**
   * Score against the ontology as it stood at a past registry block. A number is a Sepolia
   * block; a `Date` or ISO string is an instant, resolved to the block in force at it.
   * Requires `registrySubgraphUrl`, and throws rather than degrading — see `as-of.ts`.
   */
  asOf?: AsOf
}

/**
 * Print — aggregate personhood credentials, scored by independent trust root.
 *
 * The client holds no user state and talks to no server of ours. Ontology comes from the
 * public registry, credentials come from public chains, and scoring happens here in your
 * process. That is deliberate: an aggregator that collected credentials centrally would
 * become the one party able to link a user's World ID, passport proof and social graph —
 * exactly the correlation those protocols are designed to prevent. We never need that link,
 * because correlation is a property of the credential class, not of the person.
 */
export class Print {
  #opts: Required<Pick<PrintOptions, 'registryAddress'>> & PrintOptions
  #adapters: AdapterProbe[]
  #ontology?: Awaited<ReturnType<typeof loadOntology>>

  constructor(opts: PrintOptions = {}) {
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
        knownIds: this.#knownIds(),
        knownRoots: this.#knownRoots(),
      })
    }
    return this.#ontology
  }

  /**
   * Adapter ids we can reverse a registry hash into.
   *
   * `?? bundled` was not enough: an *empty* array is not nullish, so a caller that built its
   * preimage list from a file it failed to read passed `[]` and got the exact failure the
   * defaults exist to prevent — every adapter keyed by hash, no probe matching any ontology
   * entry, score 0 with a no-evidence caveat. @printid/mcp 0.1.0 shipped that way. An empty
   * list is never a meaningful intent (nothing to reverse means nothing to score against),
   * so it is read here as "unset" rather than honoured toward the adversary's answer.
   */
  #knownIds(): string[] {
    return this.#opts.knownIds?.length
      ? this.#opts.knownIds
      : ontologyData.adapters.map((a) => a.id)
  }

  /**
   * Root names we can reverse a registry hash into — current *and* retired.
   *
   * Retired names matter because `asOf` reads revisions where they were still in force: the
   * placeholder `unknown` root and the narrower `kyc-vendor:facetec-synaps` both lived in the
   * registry until revision 34. Without their preimages a historical score would print raw
   * hashes for exactly the roots whose correction is the interesting part of the history.
   * They are harmless at head, where nothing carries them.
   *
   * Empty is treated as unset for the same reason as `#knownIds` — see there.
   */
  #knownRoots(): string[] {
    return this.#opts.knownRoots?.length
      ? this.#opts.knownRoots
      : [
          ...Object.keys(ontologyData.trustRoots),
          ...Object.keys(ontologyData.retiredTrustRoots ?? {}),
        ]
  }

  /**
   * The ontology as the registry held it at a past block, from the audit-trail subgraph.
   *
   * Deliberately throws when no registry subgraph is configured. Falling back to the current
   * ontology would answer a question about the past with the present and stamp a block number
   * on it, which is worse than not answering.
   */
  async #ontologyAsOf(asOf: AsOf) {
    const url = this.#opts.registrySubgraphUrl
    if (!url) {
      throw new Error(
        'asOf scoring requires registrySubgraphUrl. The ontology at a past block is reconstructed from the registry audit-trail subgraph; scoring the past against today’s weights would be a different answer wearing a block number.',
      )
    }
    const client = registryClient(this.#opts.registryRpcUrl)
    const point = await resolveAsOfPoint(client, asOf)
    // Read at head, no archive needed. It is what turns the audit trail's completeness from an
    // assumption into a check — see rule 3 in `as-of.ts`.
    const headRevision = await headRevisionOf(client, this.#opts.registryAddress)
    return loadOntologyAsOf({
      registrySubgraphUrl: url,
      point,
      knownRoots: this.#knownRoots(),
      headRevision,
    })
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
   * `observer.print.subjects` text record, to the full address set it declares.
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
      // Canonical ENSIP-5 service key, with the pre-compliance name as a fallback so records
      // already published against the old key keep resolving. See ens-agents.ts.
      client
        .getEnsText({ name, key: HUMAN_SUBJECTS_RECORD })
        .then((v) => v ?? client.getEnsText({ name, key: 'print.subjects' }))
        .catch(() => null),
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
   *
   * `opts.asOf` scores against the ontology as it stood at a past registry block instead of
   * against today's — the audit trail applied rather than merely printed. It changes what the
   * result may claim, so read the header of `as-of.ts` before using it.
   */
  async resolve(
    subject: string | readonly string[],
    opts: ResolveOptions = {},
  ): Promise<PersonhoodResult> {
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

    // Resolved before anything else runs: an as-of request that cannot be honoured must fail
    // before we spend ten probes producing a result we would have to relabel.
    const historical = opts.asOf !== undefined ? await this.#ontologyAsOf(opts.asOf) : undefined

    const [resolved, ontology] = await Promise.all([
      Promise.all(inputs.map((s) => this.resolveSubject(s))),
      historical ? historical.ontology : this.ontology(),
    ])

    // A name's observer.print.subjects record expands the set; dedupe again afterwards.
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
    // Age curves are evaluated at the as-of instant, not at the wall clock: a credential 100
    // days old then is 100 days old in the answer, whatever it is now.
    const now = historical ? historical.context.timestamp : Math.floor(Date.now() / 1000)

    const probes = addresses.flatMap((address) =>
      this.#adapters.map(async (probe) => ({ address, probe, result: await probe.probe(address) })),
    )
    const results = await Promise.all(probes)

    const evidence: Evidence[] = []
    const notYetInRegistry = new Set<string>()
    for (const { address, probe, result } of results) {
      const adapter = ontology.adapters.get(probe.adapterId)
      if (!adapter) {
        // Not in the registry, so nothing to weigh it by. At head that is a configuration
        // mistake; as of a past revision it is ordinary history — the adapter had not been
        // researched yet — and the result says so rather than dropping it in silence.
        if (historical) notYetInRegistry.add(probe.adapterId)
        continue
      }

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
          ...(result.provenance ? { provenance: result.provenance } : {}),
          detail: { error: result.error, unavailable: true },
        })
        continue
      }

      const freshness = freshnessOf(adapter, result.issuedAt, now, result.issuedAfter)
      evidence.push({
        ...base,
        held: result.held,
        ...(result.issuedAt !== undefined ? { issuedAt: result.issuedAt } : {}),
        ...(result.issuedAfter !== undefined ? { issuedAfter: result.issuedAfter } : {}),
        ...(result.provenance ? { provenance: result.provenance } : {}),
        freshness,
        effectiveCostCents: result.held ? effectiveCost(adapter, freshness) : 0,
        ...(result.detail ? { detail: result.detail } : {}),
      })
    }

    let scored = evidence
    let asOf: AsOfScoring | undefined
    if (historical) {
      const applied = applyAsOfToEvidence(evidence, historical.context.timestamp)
      scored = applied.evidence
      asOf = {
        ...historical.context,
        adaptersNotYetInRegistry: [...notYetInRegistry].sort(),
        issuedAfterAsOf: [...new Set(applied.issuedAfterAsOf)].sort(),
        existenceUnverified: [...new Set(applied.existenceUnverified)].sort(),
      }
    }

    const result = score({
      subjects: addresses,
      ...(name !== undefined ? { name } : {}),
      adapters: ontology.adapters,
      evidence: scored,
      registryRevision: ontology.revision,
      now,
      ...(asOf ? { asOf } : {}),
    })
    if (subjectsDeclaredByName) {
      result.caveats.push({
        code: 'address-set-asserted-by-name-owner',
        message:
          'Part of this address set comes from an observer.print.subjects ENS text record. The name owner asserted it; the listed addresses have not countersigned, so ownership of every listed wallet is a claim, not a proof.',
      })
    }
    return result
  }
}

/** Convenience for one-off lookups. */
export async function resolvePersonhood(
  nameOrAddress: string,
  opts?: PrintOptions & ResolveOptions,
): Promise<PersonhoodResult> {
  return new Print(opts).resolve(
    nameOrAddress,
    opts?.asOf !== undefined ? { asOf: opts.asOf } : {},
  )
}
