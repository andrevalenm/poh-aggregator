/**
 * Corroborate lookup for the counterparty.
 *
 * The counterparty asks one question — "what independent evidence exists that a human stands
 * behind this address set?" — and gets back evidence, roots and caveats. It does the deciding
 * itself, in decide.js.
 *
 * Note what the counterparty never receives: any link between the operator's World ID, their
 * passport proof and their social graph. Corroborate runs in the counterparty's own process,
 * reads public chains, and never phones home. An aggregator that collected credentials
 * centrally would become the single party able to correlate exactly the identities these
 * protocols are built to keep apart.
 */

import { Corroborate, defaultAdapters } from '@corroborate/sdk'
import { corroborate as cfg } from '../config.js'

let client
function getClient() {
  if (!client) {
    client = new Corroborate({
      ...(cfg.registryAddress ? { registryAddress: cfg.registryAddress } : {}),
      ...(cfg.registryRpcUrl ? { registryRpcUrl: cfg.registryRpcUrl } : {}),
      ...(cfg.subgraphUrl ? { subgraphUrl: cfg.subgraphUrl } : {}),
    })
  }
  return client
}

/**
 * Resolve the agent's whole human-backing surface.
 *
 * The address set is the agent's own wallet plus every address the operator declared. The
 * agent wallet belongs in the set for a real reason: AgentBook registration *is* a World ID
 * credential observable on that address, so the World Orb trust root enters the score through
 * the same path as every other protocol — and saturates against them if it ever overlaps,
 * rather than being bolted on as a special case.
 *
 * @param {{agentAddress: string, operatorAddresses: string[]}} subject
 */
export async function resolveHumanBacking({ agentAddress, operatorAddresses }) {
  const addresses = [agentAddress, ...operatorAddresses]
  const result = await getClient().resolve(addresses)
  return { result, addresses }
}

/**
 * The ontology as the deployed registry holds it, for pricing the counterparty's policy.
 *
 * Read from the registry rather than from the copy bundled in the SDK, because the weights an
 * adversary is priced against have to be the published ones — the whole point of putting them
 * on chain. Cached inside the client after the first call.
 */
export async function ontologyAdapters() {
  return (await getClient().ontology()).adapters
}

/**
 * Adapter ids this deployment can actually read.
 *
 * An adversary cannot clear *our* score with a credential we have no probe for, so pricing the
 * policy against the whole ontology would quote a floor nobody can reach and understate what
 * the policy costs. Derived from the probe list rather than from an `implemented` flag, so it
 * cannot drift from what the process will really look up.
 */
export function readableAdapterIds() {
  return defaultAdapters().map((a) => a.adapterId)
}
