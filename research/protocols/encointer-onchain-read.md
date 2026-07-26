# Encointer, read permissionlessly — and why there is still no adapter

**Status: honest refusal.** No `encointer.ts` is shipped. The chain read itself is fully
implementable — I demonstrate it below with raw storage queries against public RPC — but a
Corroborate subject is an **Ethereum address**, and there is no permissionless way to map an
Ethereum address to an Encointer identity in either direction. An adapter would have to fake
that mapping or require the subject to hand over material we do not model (their Substrate
account or public key). Everything below was measured by me on **2026-07-25** unless a source
and date say otherwise.

---

## 1. What would be read, and proof that it is readable

Encointer is a Kusama system parachain; personhood is **ceremony attendance**: same-time
physical meetups where participants mutually attest presence, recorded as *reputation* keyed by
`(community, ceremony_index, account)`. The state is public and the read needs no key:

| Endpoint | State on 2026-07-25 |
|---|---|
| `https://kusama.api.encointer.org` | **Answers HTTP JSON-RPC** (`system_chain` → `"Encointer on Kusama"`). Encointer-operated |
| `wss://encointer-kusama-rpc.n.dwellir.com` | **Answers** (WSS only). Independent operator — so unlike Idena/Lens, infrastructure-independent reads exist |
| `wss://sys.ibp.network/encointer`, `wss://encointer.api.onfinality.io/public-ws` | Refused/failed from my vantage; listed publicly, may answer elsewhere |

Demonstrated reads (raw `state_getStorage` / `state_getKeysPaged`, head block 14,432,998):

- `EncointerScheduler.CurrentCeremonyIndex` = **158**; `CurrentPhase` = `0x00` (Registering).
  Ceremonies are *happening* — reputation entries exist for cindex 155–157, and
  `EncointerCeremonies.GlobalReputationCount` shows ~16–46 reputations per recent ceremony
  globally. The network is alive and community-scale, exactly as the ontology entry says.
- `EncointerCeremonies.ParticipantReputation` is a double map
  `(CommunityIdentifier, CeremonyIndex) → AccountId32 → Reputation`, both keys
  `blake2_128_concat`, so the plaintext account is recoverable from the storage key — sampled
  entries decode cleanly, e.g. community `s1vrq` (PAYNUQ), cindex 155, account
  `0x4eb1…c550` → `0x01` (`UnverifiedReputable`) and `0x039d000000` → `VerifiedLinked(157)`.
- Custom RPCs exist for exactly this purpose: `encointer_getReputations(account)`,
  `encointer_getAllCommunities` (answers: Leu Zurich, Nyota, PAYNUQ, …),
  `encointer_getAggregatedAccountData`.

So: given an **Encointer account**, personhood status, per-ceremony attendance, and dates
(via `EncointerScheduler` ceremony timing) are one keyless query away, from more than one
independent operator. The read was never the problem.

## 2. The refusal: an Ethereum address cannot name an Encointer identity

Corroborate subjects are Ethereum addresses: `address = last20(keccak256(uncompressed
secp256k1 pubkey))`. Encointer accounts are `AccountId32`, and the app-created accounts are
**sr25519** — a different curve entirely; no correspondence can exist. The one hypothetical
bridge, Substrate's ecdsa account type, does not help either: an ecdsa `AccountId32` is
`blake2_256(compressed pubkey)` while an Ethereum address is a *keccak* hash of the
*uncompressed* pubkey — two one-way hashes of different serializations. Given only the
20-byte address there is no computation, search, or chain query that yields the AccountId32;
given an AccountId32 there is no way to verify it belongs to an Ethereum address. The mapping
is not merely unindexed — it is information-theoretically absent.

That leaves a binding *registry* as the only possible path, so I checked for one:

1. **The runtime has no EVM binding.** Full metadata (209,790 bytes, fetched via
   `state_getMetadata`) contains these Encointer pallets: Ceremonies, Communities, Scheduler,
   Balances, Bazaar, Democracy, Faucet, Treasuries, OfflinePayment, ReputationCommitments,
   **ReputationRings**. No `pallet-evm`, no address-mapping pallet, no attestation-export
   pallet. Every occurrence of the string `Ethereum` in the metadata is the XCM `NetworkId`
   enum variant (byte offsets 20,459 / 28,260 / 29,810 — all inside `xcm.v3/v4 junction`
   types); `Address20` is the generic Substrate `MultiAddress` variant, unused by any
   Encointer storage.
2. **The closest things are not EVM bindings.**
   `EncointerReputationRings` stores "Bandersnatch public key per account (registered once,
   updatable)" and ring member lists per `(community, ceremony_index, …)` — a ring-signature
   personhood *export* mechanism (unlinkable proofs of reputation), and
   `EncointerOfflinePayment` stores Poseidon commitments. Both bind to AccountId32 or to
   fresh zk material, never to an EVM address. Worth re-checking in a year: a ring-proof
   verifier deployed on an EVM chain would change this file's conclusion.
3. **The personhood-oracle is experimental and EVM-less.** `github.com/encointer/
   personhood-oracle` ("single-use unlinkable proofs of personhood reputation") targets
   Integritee TEE enclaves and demos Nostr badge issuance; no production endpoint, no mainnet
   contract, no Ethereum-address binding (repo read 2026-07-25).

So an `encointerAdapter(subject: Address)` has exactly three dishonest options — probe a hash
that can never match (always `held: false`, structurally), accept an unverified user-supplied
SS58 account (a *claimed* credential, violating the permissionless-verification rule), or lean
on an off-chain linking service that does not exist. The honest option is this file.

## 3. What would change the verdict

Any one of these, verified on chain, reopens the adapter:

- An Encointer (or third-party) **binding registry** where an AccountId32 signs a statement
  naming an EVM address *and the EVM address signs back* — the bidirectional consent the Lens
  research file's "planting" caveat shows is necessary, not just sufficient.
- **Reputation-ring proofs verifiable on an EVM chain** (the Bandersnatch ring work is the
  live candidate — watch `EncointerReputationRings` and the personhood-oracle repo).
- A change in Corroborate's subject model that lets callers assert control of Substrate
  accounts the way they assert control of multiple Ethereum addresses today
  (`PersonhoodResult.subjects`). That is a protocol-design decision above any adapter's pay
  grade, and it would make Encointer implementable in an afternoon using §1's reads.

## 4. Proposed ontology change

None required — `implemented: false` is correct and stays. Suggested precision edit to the
`encointer` entry's note (main session's call): the current text says "There is also no EVM
read; the credential lives on Substrate accounts", which is right but undersells what was
verified; it could now cite this file as `sourceURI` for the refusal: chain state *is*
permissionlessly readable (two independent operators), ceremonies are live at ~150+ cindex
with tens of attendees per cycle, and the blocker is specifically that no
Ethereum↔AccountId32 binding exists on chain or off, checked against the full runtime
metadata on 2026-07-25.
