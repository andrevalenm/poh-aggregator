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

import { Corroborate } from '@corroborate/sdk'
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
