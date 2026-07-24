# Privado ID (ex-Polygon ID / iden3) and Verax (Linea attestation registry)

> STATUS: in progress

**One-liner:** Two pieces of credential *infrastructure* — not personhood sources. Privado ID is a
ZK verifiable-credential stack (iden3); Verax is an on-chain attestation registry on Linea.
**Category:** neither (infrastructure) — see per-issuer analysis
**Chains:** TBD
**Status (2026-07):** TBD
**Aggregator verdict:** TBD

## Liveness evidence (checked 2026-07-24, via GitHub API)

| Repo | Desc | License | Last push | Latest release |
|---|---|---|---|---|
| `Consensys/linea-attestation-registry` (Verax) | shared attestation registry | MIT | 2026-07-16 | `v10`, 2025-02-04 |
| `0xPolygonID/js-sdk` | "SDK to work with Privado ID" | Apache-2.0 | 2026-06-18 | `v1.45.0`, 2026-06-17 |
| `0xPolygonID/issuer-node` (was `sh-id-platform`) | self-hosted issuer node | Apache-2.0 | 2026-06-18 | `v3.0.5`, 2025-12-22 |
| `iden3/contracts` | core State / verifier contracts | GPL-3.0 | 2026-07-21 | `state-v2.6.1`, 2025-04-29 |
| `iden3/circuits` | circom circuits | GPL-3.0 | 2026-02-06 | `v2.0.0`, 2026-01-15 |
| `0xPolygonID/contracts` | on-chain ZKP verification | GPL-3.0 | 2026-06-16 | `v1.1.1`, 2023-11-13 |

Both stacks are **alive** in 2026-07. Note Verax's *code* is active but its last tagged release is
2025-02; `iden3/circuits` cut a v2.0.0 in Jan 2026 (circuit-level change — matters for verifier
compatibility).

## What it proves

**Neither of these proves anything about humanity by itself.** This is the single most important
framing for our aggregator:

- **Privado ID / iden3** is a *credential format + ZK proof system*. It is a container. A Privado
  credential asserting "isHuman: true" is worth exactly what its **issuer DID** is worth, no more.
  The ZK machinery guarantees (a) an issuer with a given identity state signed/merklised this
  claim, (b) the claim is not revoked as of some published state, (c) the holder controls the
  subject DID. It guarantees **nothing** about the issuer's verification quality or about
  uniqueness across issuers.
- **Verax** is an *on-chain attestation registry*. It guarantees that a registered portal wrote
  bytes to storage. Nothing more. Its trust root is per-attester.

So for both: `category = infrastructure`. Score the **issuer**, never the rail.

### Privado ID / iden3 stack in detail

**Data model.** An identity is a set of three Sparse Merkle Trees (binary, deterministic,
Poseidon-hashed):
- **Claims Tree (ClT)** — leaves are issued claims. Index part hashed → leaf position; value part
  stored at that leaf.
- **Revocation Tree (ReT)** — leaves are *revocation nonces* of revoked claims.
- **Roots Tree (RoT)** — historical roots of the Claims Tree, so you can prove a claim existed at
  time *t*.

**Identity State** = `Poseidon(ClT.root, ReT.root, RoT.root)`. Confirmed against the iden3 core
tutorial code (`merkletree.HashElems(clt.Root(), ret.Root(), rot.Root())`),
https://docs.iden3.io/getting-started/identity/identity-state/ . The first state is the **Genesis
State**, and the identifier (DID) is derived from it — so the DID commits to the initial state.

**Identity State Transition** is the on-chain part: an issuer publishes `(oldState, newState, zk
proof)` to the `State` contract; the circuit proves the issuer's auth key (a Baby JubJub key in an
`AuthBJJCredential` in its own claims tree) authorised the transition and that the auth claim is
not revoked. The State contract also maintains a **GIST** (Global Identity State Tree) — a Merkle
tree of *all* identities' latest states, which is what lets a single on-chain proof simultaneously
attest to the prover's identity state. `IDENTITY_TREE_STORE` is the contract holding
revocation/roots data for on-chain-resolvable issuers.

**Two credential proof types:**
- **BJJ signature (SIG)** credentials — the issuer signs the claim with its Baby JubJub key. **No
  on-chain transaction needed at issuance.** Cheap, instant, but revocation still requires the
  issuer to publish a state (or run a Reverse Hash Service / CredentialStatus endpoint).
- **MTP (Merkle Tree Proof)** credentials — the claim is inserted into the issuer's Claims Tree and
  the new state is published on-chain. Costs an issuer transaction (batched), but the credential is
  verifiable purely against chain state.

**Circuits** (circom, Groth16, per iden3 spec): `credentialAtomicQuerySigV2` /
`credentialAtomicQueryMTPV2` (off-chain variants) and `...OnChain` variants, plus the **V3**
circuit (beta) which adds nullifiers, selective disclosure and linked proofs. `iden3/circuits`
cut **v2.0.0 on 2026-01-15** — a circuit-version bump means new verifying keys and potentially new
validator contracts; anything we build must pin a circuit/validator version.

**ZK Query Language.** A verifier expresses a request as a JSON query over a JSON-LD credential
schema: `{ allowedIssuers, context, type, credentialSubject: { <field>: { $eq | $ne | $lt | $gt |
$in | $nin | $between ... } } }`. The circuit proves the predicate over a merklised credential
field without revealing the field. Practically this means **we can ask "does the holder have a
credential of type X from issuer set S satisfying predicate P" and get a yes/no**, which is a good
fit for an aggregator, *if* someone is actually issuing type X.

**Important limit for us:** `allowedIssuers` is a list *we* supply. There is no protocol-level
issuer registry, no reputation, no accreditation. **We would have to curate the issuer allowlist
ourselves** — which is precisely the hard part of the personhood problem, unsolved by Privado.

## Trust root & failure modes

### Privado ID
- **Trust root = the issuer's private key + whatever off-chain process that issuer ran.** A
  compromised or malicious issuer can mint unlimited "human" credentials to unlimited DIDs. Nothing
  in the protocol caps issuance or enforces one-credential-per-human.
- **Self-hosted issuer nodes are permissionless.** Anyone can run `0xPolygonID/issuer-node`, create
  an identity, and issue `ProofOfPersonhood` credentials to themselves. A sybil farm's cheapest
  attack is *becoming an issuer*, not forging a proof. Therefore: an aggregator that accepts "any
  Privado credential of type X" is trivially farmable. Only an allowlist has any value.
- **Revocation is issuer-controlled and issuer-hosted.** `credentialStatus` points at an
  issuer-run URL (or an on-chain `IDENTITY_TREE_STORE` / Reverse Hash Service). If the issuer goes
  offline, off-chain revocation checking breaks — the credential silently becomes unverifiable or
  (worse, depending on config) unrevokable.
- **Groth16 + trusted setup.** Circuit-specific trusted setup; a compromised setup means forged
  proofs. UNVERIFIED: whether iden3 ran a public multi-party ceremony for the V3 / v2.0.0 circuits
  and where the transcript is. Worth checking before we trust on-chain verification results.
- The rebrand history (Polygon ID → Privado ID → GitHub org now titled "Billions Network & Privado
  ID") means the **legacy `0xPolygonID` npm/GitHub namespace is still authoritative** — a supply
  chain surface worth pinning.

### Verax
- **Trust root = the attester EOA behind a portal.** Verax's `AttestationRegistry` only checks that
  the calling portal is registered. Everything else is delegated to the portal's modules — and
  **the flagship Linea PoH portal registers zero modules** (see below), so trust is 100% a single
  Sumsub-controlled key.
- **Portal registration is permissioned.** Registering a portal requires being an approved issuer
  in `PortalRegistry` (Consensys/Linea-controlled during bootstrap). This is *good* for signal
  quality and *bad* for credible neutrality.
- Attestations are **public and address-linked**. Anyone can enumerate every PoH-verified address
  on Linea from the subgraph. Zero privacy.
- **Wallet-address-bound, not human-bound.** A Sumsub PoP attestation binds a *wallet* to a
  successful Sumsub check. Uniqueness across wallets is enforced by Sumsub's off-chain duplicate
  search, not by anything on-chain. If Sumsub's dedup fails or is bypassed (different document,
  different face artefacts), you get N attestations for one human and the chain cannot tell.

## On-chain surface

### Verax contract addresses (from repo README, 2026-07-24)
Linea Mainnet: AttestationRegistry `0x3de3893aa4Cdea029e84e75223a152FD08315138`,
SchemaRegistry `0x0f95dCec4c7a93F2637eb13b655F2223ea036B59`,
PortalRegistry `0xd5d61e4ECDf6d46A63BfdC262af92544DFc19083`.
Linea Sepolia: AttestationRegistry `0xDaf3C3632327343f7df0Baad2dc9144fa4e1001F`,
SchemaRegistry `0x90b8542d7288a83EC887229A7C727989C3b56209`,
PortalRegistry `0xF35fe79104e157703dbCC3Baa72a81A99591744D`.
Linea Mainnet also: Router `0x4d3a380A03f3a18A5dC44b01119839D8674a552E`,
ModuleRegistry `0xf851513A732996F22542226341748f3C9978438f`,
AttestationReader `0x40871e247CF6b8fd8794c9c56bB5c2b8a4FA3B6c`.
Arbitrum One: AttestationRegistry `0x335E9719e8eFE2a19A92E07BC4836160fC31cd7C`,
Router `0xa77196867bB03D04786EF636cDdD82f37A1248a9`,
SchemaRegistry `0xE96072F46EA0e42e538762dDc0aFa4ED8AE6Ec27`,
PortalRegistry `0x4042D0A54f997EE3a1b0F51e4813654199BFd8bD`.
Also Base, BSC, Ethereum Sepolia (see README).
Source: https://github.com/Consensys/linea-attestation-registry (README, fetched 2026-07-24)

### Linea Proof of Humanity (the only personhood thing actually running on Verax)
- PoH **V2** = a *single* attestation issued by **Sumsub** through Verax. It replaces the
  now-deprecated multi-provider (V1) setup.
  https://docs.linea.build/network/how-to/verify-users-with-proof-of-humanity
- On-chain helper: `PohVerifier.sol` at `0xBf14cFAFD7B83f6de881ae6dc10796ddD7220831` (Linea).
- Sumsub web SDK entry: `https://in.sumsub.com/websdk/p/uni_BKWTkQpZ2EqnGoY7`
- REST: `GET https://poh-api.linea.build/poh/v2/{address}` — **verified live 2026-07-24**,
  returns bare `true`/`false`, HTTP 200, **no API key**. (Tested with
  `0x0000000000000000000000000000000000000001` → `false`.)
  Signed variant: `https://poh-signer-api.linea.build/poh/v2/{address}` returns a signed message
  consumable by `PohVerifier`.
- Rate limit reported as 5 req/s → 429. UNVERIFIED (secondary source; not re-tested).

### Live subgraph data (queried 2026-07-24, no API key needed)
Endpoint: `https://api.studio.thegraph.com/query/67521/verax-v2-linea/v0.0.1` (Linea mainnet).
Linea Sepolia: `.../verax-v2-linea-sepolia/v0.0.2`.

Global counters on Linea mainnet: **6,366,748 attestations, 69 schemas, 54 portals, 36 modules.**

Sumsub PoP schema `0x39d02301e928bea8be757163a804167b7f7eaa5ac01c39bc3d2e6da5a65cd23f`:
- name "Sumsub Proof of Personhood"
- description: *"Simple proof of personhood and uniqueness based on Sumsub liveness, deepfake
  detection and duplicate search"*
- context `https://id.sumsub.com/linea-liveness`, schema string `(string levelInfo)`
- **50,475 attestations** total (2026-07-24)
- Portal `0xe8a3a57e84a27d55e37116af4681abd461b73922` "Sumsub Identity Verification Portal",
  ownerName "Sumsub", **`modules: []`** — no validation modules at all
- Sole attester EOA: `0xc5db96c1348041c56e455d4cc92bb46027831c0d`
- First attestation 2025-07-02; most recent seen 2026-07-16
- `decodedData` value observed: `"linea-proof-of-personhood (TM ver.) - 2"`
- expirationDate − attestedDate = 7,776,000 s = **90-day expiry**

**Verax is nearly idle.** The 12 most recent attestations on Linea mainnet span 2026-07-20 →
2026-07-24 — i.e. roughly **1-4 attestations per day across the entire registry** (mostly HAPI
Score, one Human Passport, some Trusta). The 6.37M lifetime figure is almost entirely 2023-2024
airdrop-farming volume. Latest Sumsub PoP attestation IDs are within ~20 of the global maximum,
confirming PoP issuance is also ~1/day.

Top schemas by lifetime attestation count (2026-07-24):
| Schema | Count |
|---|---|
| Trusta MEDIA | 1,487,811 |
| openid3 | 1,253,832 |
| Trusta Humanity | 939,375 |
| Nomis Score | 454,774 |
| Okapi Review | 400,857 |
| zkPass OKX KYC passed | 215,031 |
| GitcoinPassportScore | 163,585 |
| **Sumsub Proof of Personhood** | **50,475** |
| HolonymV3 | 41,042 |
| AnimaProofOfUniqueness | 9,650 |
| Human Passport | 8,966 |
| Humanode Biomapping | 17 |
| Sumsub Proof of Humanity | 11 |
| ZeronymCleanHands | 2 |

## Integration surface
## Privacy model
## Scoring-relevant facts
## Overlap with other protocols
## Open questions for us
## References
