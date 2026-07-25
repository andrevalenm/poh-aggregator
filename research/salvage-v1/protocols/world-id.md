# World ID

> **Salvaged.** Reconstructed from the fetched sources of a research agent that was killed by a
> usage limit before it could write up its findings (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)).
> Protocol mechanics, contracts, and integration surface are well covered because the agent had
> fetched the primary docs. **Failure modes, regulatory history, and adoption numbers are largely
> missing** — the agent was cut off before it ran those searches. Those sections are marked as gaps
> rather than filled in.

**One-liner:** Iris-biometric proof of unique personhood from Tools for Humanity / World Foundation,
now a general credential protocol (World ID 4.0) carrying biometric, document, and liveness credentials.
**Category:** uniqueness (Proof of Human) + state-identity (NFC Credential) + liveness (Selfie Check)
**Chains:** World Chain (canonical for 4.0), Ethereum, Optimism, Polygon, Base (3.0 bridged)
**Status (2026-07):** live, mid-migration — World ID 4.0 shipped, v3 cut-off scheduled 2027-04-01
**Aggregator verdict:** **integrate now**, but budget for the 4.0 migration and for RP registration.
It is the largest single uniqueness credential and the only one with a real on-chain verification
path. The catch is that registration is gated (an RP must be registered on-chain) and Gnosis Chain
is not a supported destination today.

## What it proves

World ID 4.0 is no longer one credential — it is a credential protocol with distinct issuers. The
distinction matters enormously for scoring, and the specs are explicit that **uniqueness sets are
independent**:

> "users may have both a PoH and a government document Credential, but this doesn't mean that by
> accepting both as an RP you can get guarantees that only a single human is behind each. A user may
> choose to obtain a PoH Credential and a document Credential in different World IDs."
> — [World ID 4.0 specs](https://github.com/worldcoin/world-id-protocol/blob/main/docs/world-id-4-specs/README.md)

That single paragraph is the most important scoring-relevant fact in this document: **you cannot add
a World ID PoH score and a World ID document score together as independent evidence.**

| Credential | ID | What it proves | Sybil-resistant | Validity |
|---|---|---|---|---|
| Proof of Human (PoH) | `1` | Unique, live human via Orb iris capture | Yes — one PoH per human | 3 years, renewable |
| NFC Credential | `9303` | A unique government document (passport/eID, plus Japanese My Number Card) | Per *document*, not per human | Document expiry, max 10 years |
| Selfie Check | `11` | Low-assurance device-camera liveness/facial similarity | No | — |
| Identity Check | preview | Document-backed attributes (`minimum_age`, `nationality`, `document_type`) | No | — |

Sources: [PoH credential](https://docs.world.org/world-id/credentials/1.md),
[NFC credential](https://docs.world.org/world-id/credentials/9303.md),
[Configure Credentials](https://docs.world.org/world-id/idkit/credentials.md).

The NFC Credential is document-unique, not human-unique — "guaranteed to be issued to a single World
ID per unique document." A person with two passports can hold two. Its **Claim 0 (Authentication
Claim)** is worth scoring on directly, because it grades the document check itself:

| Value | Claim | Meaning |
|---|---|---|
| `1` | None | Passive authentication only — **no guarantee the chip isn't cloned** |
| `2` | Chip Authentication | ICAO 9303 CA — chip is genuine, not cloned |
| `3` | Active Authentication | ICAO 9303 AA — chip holds a private key |
| `4` | MNC Authentication | Japanese My Number Card SD-JWT flow |

A `1` and a `3` are very different evidence and should not score the same.

## Trust root & failure modes

Trust root: Tools for Humanity operates the Orb hardware and the PoH issuer; the World Foundation is
the named issuer of PoH. Issuers must be registered in `CredentialSchemaIssuerRegistry`, so the
issuer set is a permissioned, on-chain-visible list.

Documented in the specs themselves:

- **Authenticator risk** — an Authenticator learns the user's raw `leafIndex` and "can misuse this to
  track the user, even though that tracking cannot be correlated to nullifiers provided to RPs on its
  own."
- **Recovery Agent risk** — a designated Recovery Agent "has a special permission that allows it to
  gain access to the user's World ID, which could be misused." `recoverAccount` in `WorldIDRegistry`
  registers a new authenticator and revokes all old ones on a Recovery Agent's signature.
- **OPRF non-collusion assumption** — nullifier unlinkability holds "assuming **non-collusion** of
  nodes of each multi-party system." A threshold of colluding OPRF nodes recovers the OPRF key. The
  OPRF key registry is owned by a multi-sig described in the deployment artifacts as "managed by
  TACEO."

Audits referenced in the repo: Least Authority on circuits (2026-01-26), Nethermind on contracts
(2026-02-24), Nethermind on registry/verifier v2 (2026-06-26).

> **GAP — not salvageable.** The original agent was tasked with enumerating Orb credential-selling
> markets, country-level bans/suspensions with dates, and biometric-template criticisms. It was
> killed before running any of those searches, and **none of that material is in the transcript.**
> Nothing here should be read as evidence that those concerns are absent — they are simply
> un-researched. This is the single biggest hole in the World ID picture and should be the first
> thing redone.

## On-chain surface

**World ID 3.0 (legacy, live until 2027-04-01).** `WorldIDRouter.verifyProof(root, groupId,
signalHash, nullifierHash, externalNullifierHash, proof)`. `groupId` **must be `1`** — only Orb
credentials were ever verifiable on-chain in 3.0.

| Chain | `WorldIDRouter` mainnet |
|---|---|
| World Chain | `0x17B354dD2595411ff79041f930e491A4Df39A278` |
| Ethereum | `id.worldcoin.eth` → `0x163b09b4fe21177c455d850bd815b6d583732432` |
| Base | `0xBCC7e5910178AFFEEeBA573ba6903E9869594163` |
| Optimism | `optimism.id.worldcoin.eth` → `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` |
| Polygon | `polygon.id.worldcoin.eth` → `0x515f06B36E6D3b707eAecBdeD18d8B384944c87f` |

Source: [On-chain Verification](https://docs.world.org/world-id/idkit/onchain-verification.md).
Identity availability lags Ethereum: ~5 min on World Chain, ~40 min Polygon, ~60 min Ethereum.

**World ID 4.0.** `WorldIDVerifier` on World Chain, upgradeable proxy:

| Environment | Proxy |
|---|---|
| Production | `0x00000000009E00F9FE82CfeeBB4556686da094d7` |
| Staging | `0x703a6316c975DEabF30b637c155edD53e24657DB` |

```solidity
interface IWorldIDVerifier {
    function verify(
        uint256 nullifier, uint256 action, uint64 rpId, uint256 nonce,
        uint256 signalHash, uint64 expiresAtMin, uint64 issuerSchemaId,
        uint256 credentialGenesisIssuedAtMin, uint256[5] calldata zeroKnowledgeProof
    ) external view;
}
```

Core 4.0 registries on World Chain (production config):

- `WorldIDRegistry` — `0x0000000000aE079eB8a274cD51c0f44a9E4d67d4`
- `CredentialSchemaIssuerRegistry` — `0x941239840F4d9668da8be76b568e836b50685d2c`
- OPRF key registry — `0x0D8b461799474207A3d223553d4d5e6609cb0c69`

In both versions, **the contract does not track nullifiers for you.** You must store used nullifiers
and reject duplicates yourself; that is what makes an integration sybil-resistant.

### Gnosis Chain — the answer is no, but the door is open

**Gnosis Chain is not a supported destination as of 2026-07.** It appears in none of the 3.0 router
deployments and in none of the 4.0 cross-chain configs.

But the 4.0 cross-chain architecture is a general bridge, not a fixed list. It consists of
`WorldIDSource.sol` (on World Chain) and `WorldIDSatellite.sol` (on each destination), with pluggable
gateway adapters found in the repo:

- `LightClientGatewayAdapter.sol`
- `EthereumMPTGatewayAdapter.sol`
- `PermissionedGatewayAdapter.sol`

Chains configured in staging include base, arbitrum, zksync, scroll, polygon, mythos, arc, tempo —
each added by dropping an entry into `contracts/script/crosschain/config/{env}.json` and running the
deploy task. The bridge carries a root with `rootValidityWindow: 3600` and `treeDepth: 30`.

For 3.0 the docs state bridging was permissionless: *"You can deploy your own State Bridge contract
on Ethereum and Bridged World ID contract to any chain to bridge World ID to that chain
permissionlessly."*

> `UNCLEAR:` whether the 4.0 `WorldIDSource`/`WorldIDSatellite` bridge is equally permissionless, or
> whether adding a satellite requires authorization from the source owner. The production config
> shows gateways being explicitly authorized (`crosschain-gateway-add`), which suggests **permissioned**.
> This is the highest-value open question for us and is answerable by reading
> [`WorldIDSource.sol`](https://github.com/worldcoin/world-id-protocol) directly.

## Integration surface

- **SDKs:** `@worldcoin/idkit` (React), `@worldcoin/idkit-core` (vanilla JS). `@worldcoin/idkit-standalone`
  is **discontinued** in 4.x. `UNVERIFIED:` license not captured in the salvaged material.
- **Backend verify:** `POST /api/v4/verify/{rp_id}` on `https://developer.world.org`. Legacy:
  `POST /api/v2/verify/{app_id}`.
- **4.0 requires `rp_context`** — `rp_id`, `nonce`, `created_at`, `expires_at`, `signature`, signed by
  your backend. This is a real architectural constraint: an aggregator needs a signing backend per RP,
  it cannot be a pure client-side shim.
- **Registration is mandatory and now on-chain.** Each RP commits an authorized public key to the
  `RpRegistry`. Registering "is a public action that anyone can take, but this requires paying a
  one-time registration fee." At launch **only one authorized key per RP is allowed**.
- `RpRegistry.sol` exposes `feeRecipient`, `feeToken`, and `registrationFee` with a documented
  **default of `0`**. `UNVERIFIED:` the actual production fee value — read the deployed
  `RpRegistry` at runtime rather than trusting the default.

**Implication for a permissionless aggregator:** we cannot verify World ID proofs on behalf of
arbitrary third-party apps without each being its own RP. Either the aggregator is itself the RP (and
then *our* nullifier space is shared across all our consumers — an unlinkability problem, since one
user hitting two of our customers under one `rpId` produces correlatable behaviour), or each consumer
registers separately and we orchestrate. **This is a genuine design fork and should be decided early.**

## Privacy model

Fully ZK. The 4.0 flow: user queries an Indexer for `leafIndex` + inclusion proof in
`WorldIDRegistry`, generates query proof π₁, sends a **blinded** `leafIndex` to threshold OPRF nodes,
unblinds, then generates final proof π₂ which proves — among other constraints — that the credential's
`sub` matches the blinded `leafIndex`, that it is signed by a registered issuer, that it is not
expired, and that it meets the RP's `genesis_issued_at_min`.

Documented nullifier properties: Deterministic, Unguessable, Authenticated, Anonymous, Unlinkable,
Pre-image resistant. Formally:

> "For any two nullifiers with different contexts, the probability that an adversary can correctly
> distinguish whether they were derived from the same user is at most negligibly better than random guessing."

**Nullifiers are app-scoped** — derived from (blinded `leafIndex`, `rpId`, `action`). Same person +
same action ⇒ same nullifier; different app or action ⇒ different, unlinkable nullifier.

Three things that directly shape aggregator design:

1. **The nullifier is deliberately credential-independent.** "the action can be performed only once
   regardless of which credentials are available at the time." We cannot tell from the nullifier which
   credential backed it — that comes from `issuer_schema_id` in the response.
2. **In 4.0 nullifiers are one-time-use.** In 3.0 many RPs used them as persistent user IDs. That
   pattern is dead. Continuity now comes from `session_id` (`session_` + 128 hex chars) via Session
   Proofs. An **Oblivious Nullifier Pool** enforces single-use; the docs concede "the main limitation
   of the nullifier pool is performance at scale."
3. **Blinded subjects** prevent correlation even between issuers:
   `subjectBlindingFactor = H_k(issuerSchemaId || leafIndex)`.

So: we can dedupe a user *within our own RP scope* without deanonymizing them, but we **cannot** use a
World ID nullifier as a cross-protocol join key. Correct by design; inconvenient for us.

## Scoring-relevant facts

- PoH validity **3 years**, renewable at an Orb while the capture is "fresh." `genesis_issued_at`
  survives renewal — so credential *age* is available as a signal, and `genesis_issued_at_min` can be
  enforced at request time.
- NFC credential **cannot be renewed**; a new document is a new credential.
- Storage guidance: nullifiers are 256-bit; store as `NUMERIC(78, 0)` in Postgres. Casing/parsing
  bugs here are called out as a security risk.
- `require_user_presence` adds a liveness check to any credential request, failing with
  `user_presence_failed`. This is a request-level flag, not a credential — a cheap way to upgrade
  confidence at verification time.

**Migration timeline** (affects any integration we build):

| Phase | Dates | State |
|---|---|---|
| 1 — Migration | through 2026-06-01 | new users get both v3 and v4 credentials |
| 2 — Transition | 2026-06-01 → 2027-03-31 | new users are v4-only; both proof types accepted |
| 3 — v3 cut-off | from 2027-04-01 | v3 proofs no longer generated |

We are currently in **Phase 2**. Anything we build must accept both, keyed on `protocol_version`.

> **GAP.** Verified-human counts and geographic distribution were not researched. Two weak numbers
> appear incidentally in search-result text and are **secondary sources, uncorroborated**: "nearly 18
> million unique people have verified" (undated, from a 2026 search snippet) and "4.8 million people
> with a World ID" (World ID 2.0 era, i.e. historical). Do not put either in a deck without
> re-verifying. No pricing or rate-limit data was captured either.

## Overlap with other protocols

- **Any passport/NFC protocol** — the NFC Credential reads ICAO-9303 documents, the *same trust root*
  as ZKPassport, Self, and eIDAS document flows. A World ID NFC credential and a ZKPassport proof from
  the same passport are **one piece of evidence, not two.** Correlated-failure risk is direct.
- **Within World ID itself** — as quoted above, PoH and NFC are independent uniqueness sets and may
  belong to *different World IDs*. Never sum them.
- Orb iris capture is, as far as the salvaged material shows, unique to World — no shared biometric
  root with other protocols in our set. `UNVERIFIED:`

## Open questions for us

1. **Is the 4.0 satellite bridge permissionless?** If yes, we can put World ID verification on Gnosis
   Chain ourselves. If no, we need Tools for Humanity's cooperation. Highest-value unknown here.
2. **One RP or many?** Aggregator-as-RP is simpler but collapses our customers into one nullifier
   scope. Per-consumer RP registration preserves unlinkability but makes onboarding heavier and costs
   a registration fee each.
3. **What is the production `registrationFee`?** Default is `0` in code; read the live contract.
4. How do we score `authentication_claim = 1` (passive-only, cloneable) versus `3`? They are currently
   the same credential type but very different evidence.
5. Redo the failure-modes research from scratch — bans, credential markets, biometric criticism.

## References

Primary (fetched by the original agent):

- [Core Concepts](https://docs.world.org/world-id/concepts.md)
- [World ID 4.0 Migration](https://docs.world.org/world-id/4-0-migration.md)
- [Configure Credentials](https://docs.world.org/world-id/idkit/credentials.md)
- [On-chain Verification](https://docs.world.org/world-id/idkit/onchain-verification.md)
- [Contracts 3.0](https://docs.world.org/world-id/reference/contracts.md)
- [Verify API (v4)](https://docs.world.org/api-reference/developer-portal/verify.md) · [Verify (legacy v2)](https://docs.world.org/api-reference/developer-portal/verify-legacy.md)
- [PoH credential](https://docs.world.org/world-id/credentials/1.md) · [NFC credential](https://docs.world.org/world-id/credentials/9303.md)
- [world-id-protocol 4.0 specs](https://github.com/worldcoin/world-id-protocol/blob/main/docs/world-id-4-specs/README.md)
- [world-id-contracts](https://github.com/worldcoin/world-id-contracts) · [world-id-state-bridge](https://github.com/worldcoin/world-id-state-bridge)
- [TACEO OPRF whitepaper](https://github.com/TaceoLabs/nullifier-oracle-service/blob/main/docs/oprf.pdf)
- [Credential struct (docs.rs)](https://docs.rs/world-id-primitives/latest/world_id_primitives/credential/struct.Credential.html)
- [Introducing World ID 4.0](https://world.org/blog/engineering/introducing-world-id-4.0)

Secondary / uncorroborated — flagged, not relied on:

- [Computerworld on World ID's AI-era expansion](https://www.computerworld.com/article/4160511/world-id-expands-its-proof-of-human-vision-for-the-ai-era.html)
- [Introducing World ID 2.0](https://world.org/blog/announcements/introducing-world-id-2.0)
