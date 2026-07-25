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

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Corroborate } from '@corroborate/sdk'
import { corroborate as cfg, REPO_ROOT } from '../config.js'

/**
 * The registry stores adapter ids and trust roots as keccak hashes to keep storage cheap, so
 * the SDK needs the plaintext list to reverse them. Without it, `resolve()` silently returns
 * zero evidence for everyone: probes run, hit, and are then dropped because the ontology map
 * is keyed by hash and the probes are keyed by name.
 *
 * `ontology/adapters.json` calls itself the single source of truth shared by the deploy
 * script and the SDK, so we read it from there. See README, "SDK friction" — this should be
 * the SDK's default, not every caller's chore.
 */
let clientPromise
async function client() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const raw = await readFile(resolve(REPO_ROOT, 'ontology/adapters.json'), 'utf8')
      const ontology = JSON.parse(raw)
      return new Corroborate({
        registryAddress: cfg.registryAddress,
        ...(cfg.registryRpcUrl ? { registryRpcUrl: cfg.registryRpcUrl } : {}),
        ...(cfg.subgraphUrl ? { subgraphUrl: cfg.subgraphUrl } : {}),
        knownIds: ontology.adapters.map((a) => a.id),
        knownRoots: Object.keys(ontology.trustRoots),
      })
    })()
  }
  return clientPromise
}

/**
 * Resolve the agent's whole human-backing surface.
 *
 * The address set is the agent's own wallet plus every address the operator declared. The
 * agent wallet belongs in the set for a real reason: AgentBook registration *is* a World ID
 * credential observable on that address, so including it lets the World Orb trust root enter
 * the score through the same path as every other protocol, and saturate against them if it
 * ever overlaps.
 *
 * @param {{agentAddress: string, operatorAddresses: string[]}} subject
 */
export async function resolveHumanBacking({ agentAddress, operatorAddresses }) {
  const addresses = [agentAddress, ...operatorAddresses]
  const c = await client()
  const result = await c.resolve(addresses)
  return { result, addresses }
}
