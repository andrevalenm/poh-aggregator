/**
 * AgentBook — the human-backing registry.
 *
 * This is the part of World AgentKit that actually answers our question. A human with a
 * verified World ID registers an agent's wallet address through the AgentKit CLI; from then
 * on anyone can read `lookupHuman(agentWallet)` on World Chain and get back an anonymous,
 * stable identifier for the human who registered it. No API key, no relying-party id, no
 * cooperation from World required — a plain `eth_call`.
 *
 * What it proves, precisely: *some* World ID-verified human performed the registration
 * ceremony for this wallet. It does not prove that human is operating the wallet right now.
 * That gap is the whole reason the `independent-control-not-attested` caveat is central to
 * this demo.
 *
 * We do not call `createAgentBookVerifier().lookupHuman()` directly, even though we depend on
 * the package. AgentKit's verifier catches RPC failures and returns `null`, which is
 * indistinguishable from "this agent has no human behind it" — a network blip would read as
 * an accusation. We use AgentKit's own contract address and ABI, and surface transport
 * failures as errors. See README, "SDK friction".
 */

import { createPublicClient, http, toHex } from 'viem'
import { worldchain } from 'viem/chains'
import { createAgentBookVerifier } from '@worldcoin/agentkit'
import { world } from '../config.js'

/** Exactly the ABI @worldcoin/agentkit-core ships for AgentBook. */
export const AGENT_BOOK_ABI = [
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'lookupHuman',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

const client = createPublicClient({
  chain: worldchain,
  transport: http(world.worldChainRpc),
})

/**
 * Reference implementation, kept so the demo can show it is the same lookup and the same
 * deployment AgentKit itself uses. Not on the decision path — see the note above.
 */
export const referenceVerifier = createAgentBookVerifier({ rpcUrl: world.worldChainRpc })

/**
 * @typedef {Object} HumanBacking
 * @property {'backed'|'unbacked'|'unknown'} status
 * @property {string=} humanId    Anonymous human identifier, hex. Present when backed.
 * @property {string=} error      Transport failure. Present when unknown.
 * @property {string} source      How this was established, for the decision trace.
 */

/**
 * Resolve an agent's wallet to the human who registered it.
 *
 * @param {`0x${string}`} agentAddress
 * @returns {Promise<HumanBacking>}
 */
export async function lookupHumanBacking(agentAddress) {
  const source = `AgentBook.lookupHuman() on World Chain (${world.agentBookAddress})`
  try {
    const humanId = await client.readContract({
      address: world.agentBookAddress,
      abi: AGENT_BOOK_ABI,
      functionName: 'lookupHuman',
      args: [agentAddress],
    })
    if (humanId === 0n) return { status: 'unbacked', source }
    return { status: 'backed', humanId: toHex(humanId), source }
  } catch (e) {
    // Deliberately not 'unbacked'. A failure to ask is not a negative answer.
    return { status: 'unknown', error: e instanceof Error ? e.message : String(e), source }
  }
}
