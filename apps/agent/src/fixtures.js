/**
 * Demo fixtures — every address here is real and live, and none of it is ours.
 *
 * Two honest caveats, stated here because they are stated in the trace and the README too:
 *
 *   1. The registered agent wallets below were found by walking AgentBook's transaction
 *      history on World Chain. Real humans registered them. We do not hold their keys, so
 *      the signature gate cannot run for them — the trace says so rather than pretending.
 *
 *   2. The operator address set is assembled from real credential-holding wallets found on
 *      Gnosis, and is *not* claimed to belong to the same human as the AgentBook humanId.
 *      It illustrates what an operator's declared set looks like and produces genuine
 *      on-chain evidence. Authenticating that set is the counterparty's job and this demo
 *      does not do it — see `address-set-not-authenticated` in the trace.
 *
 * Rediscover any of this yourself with `npm run agentbook`.
 */

/**
 * Two agent wallets registered by the *same* human, twelve seconds apart on World Chain.
 * AgentBook returns an identical humanId for both. This is the cleanest available
 * demonstration that agent count and human count are different quantities.
 */
export const REGISTERED_AGENTS = {
  beacon: {
    address: '0x58b849f60b0515871fcfa80c7907d097571f2a12',
    registeredAt: '2026-07-24T23:12:33Z',
    note: 'registered in AgentBook by a World ID-verified human; key not held by this demo',
  },
  mirror: {
    address: '0x30b8cc0729cab7e5ed52897e56ee7b8f5860fbe5',
    registeredAt: '2026-07-24T23:11:15Z',
    note: 'a second agent registered by the SAME human as beacon — AgentBook returns one humanId for both',
  },
}

/**
 * A declared operator address set.
 *
 * Two wallets, two protocols, two independent trust roots. This split is not artificial:
 * across 31 credential-holding addresses found live on Gnosis and World Chain, not one held
 * credentials from two protocols on the same address. Proof of Humanity's own Circles proxy
 * pairs a PoH address with a separate Circles avatar. One human, one wallet per protocol —
 * which is why the SDK resolves address *sets* rather than addresses.
 */
export const OPERATOR_ADDRESS_SET = [
  '0xd267eba602e692216703626a81157214b24c85fb', // Proof of Humanity v2, Gnosis
  '0x317C407725145Fa197701045c3383F58fa14204B', // Circles v2, Gnosis
]
