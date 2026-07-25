/**
 * The agent.
 *
 * An agent here is the smallest thing that can be held to account: a name, a wallet it can
 * sign with, and a declared operator address set. It has no reputation, produces no content,
 * and makes no claims about its own quality. The only claim it makes is a claim about a
 * human — that one stands behind it — and the counterparty is the party that checks.
 *
 * The wallet is the agent's identity, not the human's. That indirection is the point: the
 * operator never hands over their World ID, their passport proof or their social graph. They
 * register the agent's address once, and the agent proves control of that address per
 * request.
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { createAgentkitClient } from '@worldcoin/agentkit'

/** CAIP-2 for World Chain. AgentBook lookup resolves here regardless of signing chain. */
export const WORLD_CHAIN = 'eip155:480'

export class Agent {
  /**
   * @param {Object} opts
   * @param {string} opts.name
   * @param {`0x${string}`=} opts.privateKey  Omit to generate an ephemeral one.
   * @param {string[]=} opts.operatorAddresses  Addresses the operator asserts control of.
   * @param {string=} opts.note  Shown in the trace, e.g. how this identity was obtained.
   */
  constructor({ name, privateKey, operatorAddresses = [], note }) {
    this.name = name
    this.note = note
    this.operatorAddresses = operatorAddresses
    this.account = privateKeyToAccount(privateKey ?? generatePrivateKey())
    this.address = this.account.address

    this.client = createAgentkitClient({
      signer: {
        address: this.account.address,
        chainId: WORLD_CHAIN,
        type: 'eip191',
        signMessage: (message) => this.account.signMessage({ message }),
      },
      onEvent: (event) => this.events.push(event),
    })
    this.events = []
  }

  /**
   * Make a request the counterparty will challenge.
   *
   * `agentkit.fetch` does the whole dance: it calls the URL, sees `402 Payment Required` with
   * an `agentkit` extension, signs the CAIP-122/SIWE challenge with the agent's wallet, and
   * retries once with the `agentkit` header. If the counterparty does not speak AgentKit it
   * returns the original response untouched.
   */
  async request(url, init) {
    this.events = []
    const body = { operatorAddresses: this.operatorAddresses, agentName: this.name }
    const res = await this.client.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...init,
    })
    return { response: res, events: this.events }
  }
}

/**
 * An agent whose key we do not hold.
 *
 * Registering a wallet in AgentBook requires a World ID-verified human to complete the
 * ceremony in World App, which we cannot do at 2am without an Orb. So for the registered
 * half of the demo we use agents that real humans really registered on World Chain, and we
 * are explicit that we did not sign for them: the signature gate is recorded as
 * `not-exercised`, and everything downstream of it runs against live chain state.
 *
 * Set AGENT_PRIVATE_KEY to a wallet you have registered yourself and every gate goes live.
 */
export class ObservedAgent {
  constructor({ name, address, operatorAddresses = [], note }) {
    this.name = name
    this.address = address
    this.operatorAddresses = operatorAddresses
    this.note = note
    this.observedOnly = true
  }
}
