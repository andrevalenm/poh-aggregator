# Privado ID (ex-Polygon ID / iden3) and Verax (Linea Attestation Registry)

**One-liner:** Two pieces of credential *plumbing*, not personhood sources. Privado ID is a ZK
verifiable-credential stack (iden3) — a *format*; Verax is a permissioned on-chain attestation
registry, in practice Linea-only.
**Category:** infrastructure — **neither** proves uniqueness, liveness, social trust, state
identity, or behaviour. Each is worth exactly what its issuer/attester is worth.
**Chains:**
- Privado ID / iden3: Privado Identity Chain, Ethereum, Polygon PoS, Polygon zkEVM, **Linea**
  (mainnets) + Sepolia / Amoy / Cardona / Linea-Sepolia (testnets). Unified CREATE2 addresses.
- Verax: Linea (the real one), Arbitrum, Base, BSC, + testnets.

**Status (2026-07):**
- **Privado ID: engineering alive, product line pivoted.** Repos actively committed (`iden3/contracts`
  pushed 2026-07-21; `js-sdk` v1.45.0 published 2026-06-17). But the docs' own "Releases" page still
  tops out at **Release 8, October 2024**, and the ecosystem page still advertises 2024 hackathons.
  The company's energy has moved to **Billions Network** (the GitHub org `0xPolygonID` is now titled
  "Billions Network & Privado ID"), which shipped a **$BILL token in May 2026**.
- **Verax: contracts alive, registry almost idle.** Code pushed 2026-07-16, SDK v5.4.0 published
  2026-03-24 — but the *entire Linea mainnet registry* is receiving roughly **1-4 attestations per
  day** as of 2026-07-24 (measured, see below). Last tagged contract release `v10` was 2025-02-04.

**Aggregator verdict:**
- **Privado ID: skip as a source; keep as a possible output/format later.** There is no personhood
  credential on this stack with meaningful volume that we could consume; the on-chain
  UniversalVerifier has **16 registered proof requests on Polygon PoS and 0 on Linea** (measured
  via `eth_call`, 2026-07-24). Its `allowedIssuers` model pushes the entire hard problem — who is a
  trustworthy issuer — back onto us. Revisit only if Billions Network reaches scale, and then
  integrate **Billions**, not Privado.
- **Verax: integrate later / low priority — a cheap read-only input for Linea PoH V2, weighted as
  "Sumsub KYC+liveness", not uniqueness.** One free unauthenticated GET
  (`poh-api.linea.build/poh/v2/{addr}`) gets us a boolean. But **only 502 addresses hold a live,
  unexpired PoH V2 credential** (measured 2026-07-24; 90-day expiry, no issuance in 9 days), so it
  will fire for almost none of our users. Do **not** treat it as a distinct trust root: it is
  Sumsub. Publishing our own assertion to Verax is not worth it (permissioned portal registration,
  near-zero consumers).

---

## What it proves

**Neither of these proves anything about humanity by itself.** This is the framing that matters:

- **Privado ID / iden3** is a *credential format + ZK proof system*. It is a container. A Privado
  credential asserting `isHuman: true` is worth exactly what its **issuer DID** is worth. The ZK
  machinery guarantees (a) an issuer with a given identity state signed or merklised this claim,
  (b) the claim is not revoked as of a published state, (c) the holder controls the subject DID.
  It guarantees **nothing** about verification quality or about uniqueness across issuers.
- **Verax** is an *on-chain attestation registry*. It guarantees a registered portal wrote bytes to
  storage. Nothing more. Trust root is per-attester.

Score the **issuer**, never the rail.

### Privado ID / iden3 stack in detail (enough to judge implementation effort)

**Data model.** An identity is three Sparse Merkle Trees (binary, deterministic, Poseidon-hashed):

| Tree | Contents |
|---|---|
| **Claims Tree (ClT)** | issued claims. Index part hashed → leaf position; value part at that leaf |
| **Revocation Tree (ReT)** | *revocation nonces* of revoked claims |
| **Roots Tree (RoT)** | historical roots of ClT, so you can prove a claim existed at time *t* |

**Identity State = `Poseidon(ClT.root, ReT.root, RoT.root)`** — confirmed against the iden3 core
tutorial code (`merkletree.HashElems(clt.Root(), ret.Root(), rot.Root())`),
https://docs.iden3.io/getting-started/identity/identity-state/ . The first state is the **Genesis
State**; the DID is derived from it, so the identifier commits to the initial state.

**Identity State Transition (the on-chain part).** An issuer publishes `(id, oldState, newState,
zkProof)` to the `State` contract. The `stateTransition` circuit proves the issuer's **Baby JubJub
auth key** (held as an `AuthBJJCredential` in its own claims tree) authorised the transition and is
not revoked. The State contract also maintains a **GIST** (Global Identity State Tree) — a sparse
Merkle tree over *all* identities' latest states — which is what lets one on-chain proof cover both
the credential and the prover's own identity state in a single verification.

**Two credential proof types — this is the main implementation fork:**
- **BJJ signature (SIG)** — the issuer signs the claim with its BabyJubJub key. **No on-chain tx at
  issuance.** Instant and free to issue. Revocation still needs the issuer to publish a state or run
  a `credentialStatus` endpoint / Reverse Hash Service.
- **MTP (Merkle Tree Proof)** — the claim is inserted into the issuer's Claims Tree and the new
  state published on-chain (batchable). More expensive, but verifiable purely against chain state.

**Circuits** (circom, **Groth16**, BN254): `credentialAtomicQuerySigV2` /
`credentialAtomicQueryMTPV2` plus `...V2OnChain` variants, and the **V3** circuit (beta) adding
nullifiers, selective disclosure and linked proofs. `iden3/circuits` cut **v2.0.0 on 2026-01-15** —
a circuit-version bump means new verifying keys and possibly new validator contracts. Anything we
build must pin a circuit + validator version.

**ZK Query Language.** A verifier expresses a request as JSON over a JSON-LD credential schema:

```jsonc
{
  "allowedIssuers": ["did:iden3:..."],       // WE supply this list
  "context": "https://…/schema.jsonld",
  "type": "ProofOfPersonhood",
  "credentialSubject": { "isHuman": { "$eq": true } }   // $eq $ne $lt $gt $in $nin $between …
}
```

The circuit proves the predicate over a merklised credential field without revealing the field.
Query builder: https://docs.privado.id/docs/verifier/on-chain-verification/set-zkp-request/

**The limit that kills it for us:** `allowedIssuers` is a list *we* supply. There is **no
protocol-level issuer registry, no accreditation, no reputation**. Curating that allowlist *is* the
personhood problem, and Privado does not solve any of it.

### Verax architecture (and how it differs from EAS)

Five registries (Router, AttestationRegistry, SchemaRegistry, PortalRegistry, ModuleRegistry) per
chain. Core structs (`contracts/src/types/Structs.sol`, verified 2026-07-24):

```solidity
struct Attestation {
  bytes32 attestationId; bytes32 schemaId; bytes32 replacedBy;
  address attester; address portal;
  uint64 attestedDate; uint64 expirationDate; uint64 revocationDate;
  uint16 version; bool revoked;
  bytes subject;          // EVM address, DID, URL — NOT typed as address
  bytes attestationData;
}
struct Portal { address id; address ownerAddress; address[] modules; bool isRevocable;
                string name; string description; string ownerName; }
```

**Differences from EAS** (EAS is covered by another agent — this is only the delta):
1. **Portals.** dApps never call the registry directly; they deploy a **portal contract** they own,
   and the registry only accepts attestations from registered portals. EAS lets anyone attest
   directly. Verax therefore has an *issuer allowlist baked in at the protocol level* — better
   signal quality, worse neutrality.
2. **Modules — the genuinely interesting bit.** A module is a contract inheriting
   `AbstractModuleV2` with a single entry point:
   ```solidity
   function run(AttestationPayload calldata attestationPayload, bytes calldata validationPayload,
                address initialCaller, uint256 value, address attester, address portal,
                OperationType operationType) public virtual;   // reverts to reject
   ```
   Modules run **at attest time**, chained; each reverts to reject. `OperationType ∈ {Attest,
   BulkAttest, Replace, BulkReplace}`. Standard library: ECDSAModule, ERC1271Module, FeeModule,
   IndexerModule, IssuersModule, SchemaModule, SenderModule. This is *pluggable validation at write
   time*, which EAS approximates only with resolver contracts. In principle it lets you enforce
   e.g. "this attestation must carry a valid zk-SNARK" on-chain.
   Docs: https://docs.ver.ax/verax-documentation/core-concepts/modules
3. **Portal lifecycle hooks:** `onAttest`, `onReplace`, `onRevoke`, and bulk variants.
4. **EAS interop is explicit**: `EASPortal.sol` dual-writes to both registries; `AttestationReader`
   reads both. https://docs.ver.ax/verax-documentation/developer-guides/for-attestation-issuers/eas-compatibility

**The punchline:** the module system is Verax's best idea and **the flagship Linea PoH portal uses
zero modules** (verified — `modules: []`, see below). Nothing enforces anything on-chain; a single
Sumsub EOA writes whatever it likes.

---

## Trust root & failure modes

### Privado ID
- **Trust root = the issuer's private key + whatever off-chain process that issuer ran.** A
  compromised or malicious issuer mints unlimited "human" credentials to unlimited DIDs. Nothing in
  the protocol caps issuance or enforces one-credential-per-human.
- **Self-hosted issuer nodes are permissionless.** Anyone can run `0xPolygonID/issuer-node`, create
  an identity, and issue `ProofOfPersonhood` credentials to themselves. A sybil farm's cheapest
  attack is to *become an issuer*, not to forge a proof. An aggregator accepting "any Privado
  credential of type X" is trivially farmable. Only a curated allowlist has value.
- **Revocation is issuer-hosted.** `credentialStatus` points at an issuer URL, an on-chain
  `IDENTITY_TREE_STORE`, or a Reverse Hash Service. If the issuer goes offline, off-chain revocation
  checking breaks. For long-lived credentials that is a real availability risk for us.
- **Groth16 trusted setup.** Circuit-specific. UNVERIFIED: whether a public multi-party ceremony was
  run for the V3 / circuits-v2.0.0 verifying keys, and where the transcript lives. Next place to
  look: `iden3/circuits` releases + any `phase2`/ceremony repo under `iden3`.
- **Namespace/supply-chain smell.** Polygon ID → Privado ID → GitHub org now titled "Billions
  Network & Privado ID", but npm/GitHub namespaces are still `0xpolygonid` / `0xPolygonID`. Pin
  versions and integrity hashes.

### Verax
- **Trust root = the attester EOA behind a portal.** `AttestationRegistry` only checks the caller is
  a registered portal. Everything else is delegated to modules — and the Linea PoH portal registers
  none. Trust is 100% one Sumsub-controlled key: `0xc5db96c1348041c56e455d4cc92bb46027831c0d`.
- **Portal registration is permissioned** (PortalRegistry issuer allowlist, Consensys/Linea-
  controlled in the bootstrap phase). Good for signal, fatal for "credibly neutral" claims.
- **Zero privacy.** Attestations are public and address-linked. Anyone can enumerate every
  PoH-verified Linea address from the subgraph in one query. There is no nullifier, no
  unlinkability, no selective disclosure.
- **Wallet-bound, not human-bound.** A Sumsub PoP attestation binds *a wallet* to *a successful
  Sumsub check*. Cross-wallet uniqueness is enforced by Sumsub's off-chain duplicate search only. If
  dedup is bypassed (different document, injection attack, deepfake that beats liveness), you get N
  attestations for one human and the chain cannot tell. **Sumsub duplicate-search FAR is not
  published — UNCLEAR, and it is the entire security parameter of Linea PoH.**
- **Linea PoH V1 → V2 is a documented trust-root collapse.** V1 was a multi-provider scheme (users
  picked 3 providers, ≥1 from "Group A"). V2 is one vendor. Anyone still holding a V1-derived
  credential score should have it re-weighted; the V1 schemas (Trusta Humanity 939k, etc.) are
  **airdrop-farming-era volume and near-worthless as personhood evidence**.

---

## On-chain surface

### Privado ID / iden3 — unified CREATE2 addresses (deployed via CreateX `deployCreate2`)

Same address on every supported chain (Privado Identity Chain, Ethereum, Polygon PoS, Polygon zkEVM,
Linea, + testnets). Source: https://docs.privado.id/docs/smart-contracts/ (page "Last updated on
Jan 27, 2026").

| Contract | Unified address |
|---|---|
| STATE | `0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896` |
| VALIDATOR_MTP_V2 | `0x27bDFFCeC5478a648f89764E22fE415486A42Ede` |
| VALIDATOR_SIG_V2 | `0x59B347f0D3dd4B98cc2E056Ee6C53ABF14F8581b` |
| VALIDATOR_V3 | `0xd179f29d00Cd0E8978eb6eB847CaCF9E2A956336` |
| **UNIVERSAL_VERIFIER** | `0xfcc86A79fCb057A8e55C6B853dff9479C3cf607c` |
| IDENTITY_TREE_STORE | `0x7dF78ED37d0B39Ffb6d4D527Bb1865Bf85B60f81` |
| SMT_LIB | `0x682364078e26C1626abD2B95109D2019E241F0F6` |
| POSEIDON_1/2/3/4 | `0xC72D…8D9` / `0x72F7…edB` / `0x5Bc8…240` / `0x0695…cC2` |

Exceptions (pre-existing, not redeployed to preserve historical state):
- Polygon PoS State: `0x624ce98D2d27b20b8f8d521723Df8fC4db71D79D`
- Polygon Amoy State: `0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124`

**Verified by me via `eth_getCode` (2026-07-24):** UniversalVerifier and unified State both have
bytecode on **Polygon PoS** (`https://polygon.drpc.org`) and on **Linea** (`https://rpc.linea.build`).
Legacy Polygon State also has code. So the deployment claims are real.

**Yes — a smart contract can verify a Privado credential proof directly.** Two paths, both
implementing `IZKPVerifier`:
- `EmbeddedZKPVerifier` — you inherit it in your own contract; results live in *your* storage;
  every new contract needs its own proof submissions.
- `UniversalVerifier` — standalone shared registry of verification results; a proof submitted once
  is readable by many client contracts. Methods: `setZKPRequest` / `setRequest`,
  `submitZKPResponse` / `submitZKPResponseV2`, plus getters.
  https://docs.privado.id/docs/verifier/on-chain-verification/overview/

The validator (`CredentialAtomicQuerySigValidator` / `...MTPValidator` / V3) does three things:
verify the Groth16 proof (in an auto-generated `Groth16Verifier*`), check the public inputs match the
registered query, and check issuer + user identity states against the State contract (including
revocation and expiry timestamps).

**Gas (official, per Privado's own FAQ,
https://docs.privado.id/docs/faqs/content/verifier-on-chain-verification-gas-costs/):**
- full verification flow ≈ **770k gas (V3 circuit)** / **≈700k gas (V2 circuits)**
- the verification step alone ≈ **500k gas**

That is expensive — ~3× a Groth16 pairing check alone (~200-250k on BN254), because of the state,
GIST and revocation lookups. On L1 it is prohibitive; on Linea/Polygon it's tolerable but still far
worse than a Verax `SLOAD`.

**Measured adoption of the on-chain path (this is the killer stat).**
`eth_call getZKPRequestsCount()` (`0x6508e1b4`) on `UNIVERSAL_VERIFIER`, 2026-07-24:

| Chain | Registered ZKP requests |
|---|---|
| Polygon PoS | **16** (`0x10`) |
| Linea | **0** |

Sixteen. On the flagship chain. After three years. The on-chain verifier is technically real and
practically unused. (Caveat: `EmbeddedZKPVerifier` usage is invisible to this count — dApps that
inherited the verifier into their own contracts would not appear. Still, 0 on Linea and 16 on
Polygon is not a thriving ecosystem.)

### Verax — contract addresses (repo README, fetched 2026-07-24; Lineascan/Arbiscan-linked)

**Linea Mainnet**
| Contract | Address |
|---|---|
| Router | `0x4d3a380A03f3a18A5dC44b01119839D8674a552E` |
| **AttestationRegistry** | `0x3de3893aa4Cdea029e84e75223a152FD08315138` |
| ModuleRegistry | `0xf851513A732996F22542226341748f3C9978438f` |
| PortalRegistry | `0xd5d61e4ECDf6d46A63BfdC262af92544DFc19083` |
| SchemaRegistry | `0x0f95dCec4c7a93F2637eb13b655F2223ea036B59` |
| AttestationReader (Verax+EAS) | `0x40871e247CF6b8fd8794c9c56bB5c2b8a4FA3B6c` |
| Std lib: ECDSA / ERC1271 / Fee / Indexer / Issuers / Schema / Sender | `0x2878bdc6A7615600e9b6Aa04f7802267891FFAE5` / `0xb2553A7E443DFA7C9dEc01D327FdDff1A5eF59b0` / `0xD2B60076a83C6f6fad2506aF51b297a8725e8E0b` / `0x29205492435E1b06B20CeAeEC4AC41bcF595DFFd` / `0x5bfe4626632e424C616155e67319767239160871` / `0x0EE9fCFc4A6eDB21F8bf8D2b694EA5C84F382c6E` / `0x2790E1E589aBDbC7Ee53390aacC995539228bC5f` |

**Linea Sepolia:** Router `0xAfA952790492DDeB474012cEA12ba34B788ab39F`, AttestationRegistry
`0xDaf3C3632327343f7df0Baad2dc9144fa4e1001F`, ModuleRegistry
`0x3C443B9f0c8ed3A3270De7A4815487BA3223C2Fa`, PortalRegistry
`0xF35fe79104e157703dbCC3Baa72a81A99591744D`, SchemaRegistry
`0x90b8542d7288a83EC887229A7C727989C3b56209`.

**Arbitrum One:** Router `0xa77196867bB03D04786EF636cDdD82f37A1248a9`, AttestationRegistry
`0x335E9719e8eFE2a19A92E07BC4836160fC31cd7C`, ModuleRegistry
`0x3acF4daAB6cbc01546Dd4a96c9665B398d48A4ba`, PortalRegistry
`0x4042D0A54f997EE3a1b0F51e4813654199BFd8bD`, SchemaRegistry
`0xE96072F46EA0e42e538762dDc0aFa4ED8AE6Ec27`, AttestationReader
`0x324C060A26444c3fB9B93e03d31e8cfF4b1715C1`.

Base and BSC (mainnet + testnets) and Arbitrum Sepolia are also in the README; addresses omitted
here as low-value — see https://github.com/Consensys/linea-attestation-registry#contract-addresses

### Linea Proof of Humanity — the only personhood thing actually running on Verax

- **PoH V2 = a single attestation issued by Sumsub through Verax**, replacing the "now-deprecated
  multi-provider setup". https://docs.linea.build/network/how-to/verify-users-with-proof-of-humanity
- **`PohVerifier.sol` = `0xBf14cFAFD7B83f6de881ae6dc10796ddD7220831`** on Linea — verified to have
  bytecode (7,256 hex chars) via `eth_getCode`, 2026-07-24. This is the contract that consumes the
  signed message from the signer API.
- **Sumsub portal = `0xe8a3a57e84a27d55e37116af4681abd461b73922`**, `ownerName: "Sumsub"`, name
  "Sumsub Identity Verification Portal" — verified to have bytecode (16,504 hex chars).
  **`modules: []`.**
- **Sole attester EOA = `0xc5db96c1348041c56e455d4cc92bb46027831c0d`.**
- Sumsub web SDK entry point: `https://in.sumsub.com/websdk/p/uni_BKWTkQpZ2EqnGoY7`

**Schema `0x39d02301e928bea8be757163a804167b7f7eaa5ac01c39bc3d2e6da5a65cd23f`** ("Sumsub Proof of
Personhood"):
- description (verbatim from chain/subgraph): *"Simple proof of personhood and uniqueness based on
  Sumsub liveness, deepfake detection and duplicate search"*
- context `https://id.sumsub.com/linea-liveness`; schema string `(string levelInfo)`
- observed `decodedData` value: `"linea-proof-of-personhood (TM ver.) - 2"`
- **`expirationDate − attestedDate = 7,776,000 s = exactly 90 days`** → PoH V2 **expires every 90
  days**. This is critical for scoring: a Linea PoH is a *rolling 90-day* credential, not permanent.
- first attestation 2025-07-02; most recent observed 2026-07-16.

There is also a near-empty `Sumsub Proof of Humanity` schema
`0x0094bda65c04f129cd066376bac11d053cc587a0fe550ff37517fa26bcc0d0af` (11 attestations) — looks like a
test/abandoned variant. Do not key off it.

---

## Integration surface

### Reading Linea PoH (easiest path, no vendor cooperation needed)

1. **REST, no auth** — `GET https://poh-api.linea.build/poh/v2/{address}` → bare `true` / `false`,
   HTTP 200. **Tested live 2026-07-24** with `0x0000000000000000000000000000000000000001` → `false`.
   No API key, no signup.
   - `GET https://poh-signer-api.linea.build/poh/v2/{address}` → signed message for on-chain use.
     **Tested 2026-07-24: returns HTTP 500 for a non-verified address** (it only signs for verified
     ones), so error handling must not treat 500 as an outage.
   - `POST https://poh-api.linea.build/poh/batch` — **does NOT exist**; tested 2026-07-24 → HTTP 404
     `Cannot POST /poh/batch`. A secondary source claimed it; it is wrong. UNVERIFIED whether a batch
     endpoint exists on another host.
   - Rate limit reported as 5 req/s → 429. UNVERIFIED (secondary source, not re-tested).
2. **Subgraph, no API key** — `https://api.studio.thegraph.com/query/67521/verax-v2-linea/v0.0.1`.
   Verified working without any key on 2026-07-24. Query:
   ```graphql
   { attestations(where: {
       subject: "0x…",
       schema: "0x39d02301e928bea8be757163a804167b7f7eaa5ac01c39bc3d2e6da5a65cd23f",
       revoked: false })
     { id attestedDate expirationDate decodedData attester portal { id ownerName } } }
   ```
   Note the field is `schema` (not `schemaId`) and `Attestation` has **no** `schemaString` field —
   the docs' example queries are partly stale for this deployment.
   Other subgraphs: `verax-v2-linea-sepolia/v0.0.3`, `verax-v2-arbitrum/v0.0.2`,
   `verax-v2-base/v0.0.1`, `verax-v2-bsc/v0.0.2`, `verax-v2-arbitrum-sepolia/v0.0.3`,
   `verax-v2-base-sepolia/v0.0.3`, `verax-v2-bsc-testnet/v0.0.2`.
3. **Direct contract read** — `AttestationRegistry` on Linea. Note `subject` is `bytes`, so
   address-indexed lookup on-chain requires the `IndexerModule`
   (`0x29205492435E1b06B20CeAeEC4AC41bcF595DFFd`) — which the Sumsub portal does **not** use.
   Therefore **there is no efficient on-chain "does address X have a PoH attestation" read for
   PoH V2.** On-chain consumers are expected to use `PohVerifier` + the signer API instead. This is
   a genuine limitation and the reason Linea ships a signature-based path.

### Verax SDK / contracts
- `@verax-attestation-registry/verax-sdk` — npm, **v5.4.0 published 2026-03-24**, **MIT**
  (TypeScript; wraps contracts + Graph client).
- `@verax-attestation-registry/verax-contracts` — npm, MIT.
- Repo `Consensys/linea-attestation-registry`, MIT, monorepo (contracts / sdk / subgraph / explorer /
  examples / tutorial). Explorer: https://explorer.ver.ax
- **Writing** an attestation requires deploying + registering a **portal**, and portal registration
  is permissioned via `PortalRegistry`. We cannot unilaterally publish to Verax.

### Privado ID SDKs
| Package / repo | What | License | Latest |
|---|---|---|---|
| `@0xpolygonid/js-sdk` (`0xPolygonID/js-sdk`) | wallet + prover + verifier in TS | **MIT or Apache-2.0** (repo tagged Apache-2.0) | **v1.45.0, 2026-06-17** |
| `@iden3/js-iden3-core` | core identity/claim primitives | MIT or Apache-2.0 | v1.8.1, 2026-06-12 |
| `0xPolygonID/issuer-node` (was `sh-id-platform`) | **self-hostable issuer node** (Go + UI + REST) | Apache-2.0 | v3.0.5, 2025-12-22 |
| `0xPolygonID/polygonid-flutter-sdk` | mobile wallet SDK | — | see repo releases |
| `iden3/contracts` | State, validators, verifiers | **GPL-3.0** | `state-v2.6.1`, 2025-04-29; pushed 2026-07-21 |
| `iden3/circuits` | circom circuits | **GPL-3.0** | **v2.0.0, 2026-01-15**; pushed 2026-02-06 |
| Verifier Backend | JSON API for off-chain proof verification | — | https://docs.privado.id/docs/verifier/verifier-backend/ |

**Is the stack usable without Privado the company? Yes, genuinely.** Contracts are deployed and
permissionless; circuits, SDKs and the issuer node are open source; you can self-host an issuer node,
register your own identity, publish states to the public State contract, and verify off-chain or
on-chain without asking anyone. The **GPL-3.0** on `iden3/contracts` and `iden3/circuits` is worth
flagging to legal if we ever vendor circuit or contract code (the SDKs are permissive; the crypto
core is not).

**Caveat:** "usable without the company" also means "worthless without a trusted issuer set". The
open-sourceness is exactly what makes an unfiltered Privado credential meaningless.

---

## Privacy model

### Privado ID — genuinely strong, and the best thing about it
- **ZK by construction.** The verifier learns only that a predicate holds over a credential from an
  allowed issuer. Underlying field values are never revealed unless the query asks for disclosure.
- **No issuer↔verifier communication.** The issuer does not learn where the credential is used. (This
  is the opposite of every REST-API personhood vendor, where the vendor sees every check.)
- **Identity Profiles** — a holder derives per-verifier profile DIDs (`Poseidon(genesisID, nonce)`),
  so the same human presents different identifiers to different verifiers → cross-app unlinkability
  by default.
- **Nullifiers** exist in the **V3 circuit (beta)** and are the mechanism for "one action per human".
  UNCLEAR from docs whether V3 nullifiers are *app-scoped* (scope/externalNullifier per verifier,
  Semaphore-style) or global. This matters a lot to us — it determines whether Privado could ever be
  a dedup primitive rather than just a container. **Next place to look:**
  `iden3/circuits/circuits/lib/query/credentialAtomicQueryV3.circom` (inspect the `nullifier` signal
  and its inputs) and the V3 beta docs at
  https://docs.privado.id/docs/verifier/circuits/v3-circuit/ .
- **What leaks:** the issuer DID and the schema type are typically public in the request; the issuer's
  identity state transitions are on-chain and reveal issuance *volume* and *timing* (though not
  recipients). On-chain verification reveals to the chain that *some* address satisfied *this*
  request — pseudonymous but permanently linked to the submitting EOA.

### Verax — none
Fully public, address-linked, enumerable. `subject` is the raw wallet address. There is no
nullifier, no unlinkability, no selective disclosure. Anyone can dump the complete list of
PoH-verified Linea addresses in one subgraph query. Sumsub retains the KYC/biometric data off-chain
under its own policy; the chain holds only `"linea-proof-of-personhood (TM ver.) - 2"`.

If we consume Linea PoH we should treat it as **a public, correlatable fact about a wallet** and be
careful not to expose it further than the user expects.

---

## Scoring-relevant facts

### Measured on-chain (Linea mainnet subgraph, 2026-07-24)
Registry totals: **6,366,748 attestations · 69 schemas · 54 portals · 36 modules.**

Attestation counts by schema (lifetime), personhood-relevant ones bolded:

| Schema | Lifetime attestations |
|---|---|
| Trusta MEDIA | 1,487,811 |
| openid3 | 1,253,832 |
| **Trusta Humanity** (PoH V1 era) | **939,375** |
| Nomis Score | 454,774 |
| Okapi Review | 400,857 |
| 0xScore v0.4 | 272,972 |
| RubyScore Linea Lvl3 | 242,962 |
| zkPass OKX KYC passed | 215,031 |
| GitcoinPassportScore | 163,585 |
| **Sumsub Proof of Personhood (PoH V2)** | **50,475** |
| **HolonymV3** | **41,042** |
| **AnimaProofOfUniqueness** (Synaps/Anima) | **9,650** |
| **Human Passport** | **8,966** |
| **AnimaProofOfLife** | **20** |
| **Humanode Biomapping** | **17** |
| **Sumsub Proof of Humanity** (test?) | **11** |
| **ZeronymCleanHands** | **2** |
| **Trusta Non-Sybil** | **3** |

### Linea PoH V2: 50,475 lifetime, but only **502 live** (measured 2026-07-24)
Because of the hard 90-day expiry, the *usable* population is what matters. Subgraph query
`attestations(where: {schema: 0x39d0…d23f, expirationDate_gt: <now>, revoked: false})` returns
**502** attestations — oldest issued 2026-04-26, newest **2026-07-15** (nine days before this
write-up, with nothing since). So at any given moment fewer than ~600 Linea addresses hold a valid
PoH V2 credential. **This is the number to score against, not 50,475 and certainly not the 1.5M
"unique users" in Linea's 2024 marketing.** It also means Linea PoH will contribute signal for
essentially none of our users; integrate it because it is nearly free, not because it is impactful.

### Verax is nearly idle — this is the headline
The 12 most recent attestations on Linea mainnet span **2026-07-20 → 2026-07-24**, i.e. **~1-4
attestations/day across the entire registry** (mostly HAPI Score, one Human Passport, some Trusta).
The most recent Sumsub PoP attestation IDs sit within ~20 of the global maximum attestation ID,
confirming PoP issuance is also on the order of **~1/day**. The 6.37M lifetime number is essentially
all 2023-2024 LXP airdrop-farming volume and says nothing about current relevance.

### Adoption outside Linea is negligible — Verax is a Linea registry in practice
| Chain | Attestations | Schemas | Portals |
|---|---|---|---|
| Linea | 6,366,748 | 69 | 54 |
| Base | 72,168 | 7 | 3 |
| BSC | 62,015 | 5 | 2 |
| Arbitrum | 16,008 | 10 | 6 |

**~2.3% of all Verax attestations are outside Linea.** "Shared registry for EVM chains" is
aspirational. Treat Verax as a Linea-scoped Consensys product.

### Credibly neutral? No.
- Repo lives under `Consensys/`, MIT-licensed. Governance is a documented **bootstrap-phase
  consortium**: a **Core Council** (representatives of "Networks" + Core Contributors) with an
  Advisory Board and NFT-holding stakeholder voters, **off-chain Snapshot voting**, and the Core
  Council holding **explicit veto power** ("training wheels" to be removed later). Portal
  registration is gated. https://docs.ver.ax/verax-documentation/get-involved/governance/overview-of-governance
- No token, no on-chain governance, no evidence of the veto being removed. Combined with the
  adoption data, "credibly neutral" is not a supportable claim; it is a Consensys/Linea registry
  that other chains are welcome to use and largely don't.

### Cost & friction (Linea PoH V2)
- User-side: Sumsub web SDK flow — wallet connect + signature + document + 3D face/liveness scan,
  then an attestation is written for them. **Free to the user** at V2 (Linea/Sumsub pay). The earlier
  Privado/Synaps PoU product charged **$1 per credential ($2 for both levels)** plus Linea gas
  (https://billions.network/blog/first-private-biometric-proof-of-uniqueness-on-linea-blockchain).
- **90-day expiry** (measured). Re-verification is required quarterly.
- Verification requires a **government ID document** in practice (Sumsub) → excludes the
  undocumented; strong geographic skew toward Linea's user base.

### Privado ID / Billions Network
- Privado ID spun out of Polygon Labs in **June 2024**. Co-founders: **David Schwartz (CEO)**,
  **Antoni Martin (COO)**; **Evin McMullen** (Disco founder) joined as co-founder/CSO following the
  **Privado ID × Disco.xyz merger**. Reported total raised **~$35M**. (Secondary sources: The Block,
  CryptoBriefing, CB Insights — https://www.theblock.co/post/299898/polygon-id-spins-out-from-polygon-labs-as-privado-id
  and https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems ).
  **NOTE for the orchestrator: the Disco agent and this one overlap here — Disco is now inside
  Privado ID.**
- **Billions Network** is the consumer personhood product built on this stack: **non-biometric-first,
  passport + phone**, mobile app, credentials issued as Privado/iden3 VCs. **$BILL token launched
  early May 2026** with major CEX listings.
  https://www.privado.id/blog/privado-id-introduces-billions-the-first-global-human-ai-network
- **UNVERIFIED: Billions Network verified-user count.** I could not find a primary, dated figure.
  Marketing copy cites "150M+ users" of *Circom-based tech generally* (Worldcoin/TikTok), which is
  not a Billions number — do not use it. Next place to look: the Billions whitepaper PDF
  (`Billions_WhitePaper_v5.pdf` on billions.network), any BILL tokenomics/airdrop disclosure, and
  Dune dashboards for the Billions attestation contract.
- Privado's **docs "Releases" page tops out at Release 8, October 2024**
  (https://docs.privado.id/docs/releases/) even though the page footer says "Last updated Jan 27,
  2026". The ecosystem page still lists EthGlobal Brussels/Bangkok 2024 as upcoming. **Privado ID as
  a developer platform is in maintenance; the company is executing Billions.**

---

## Overlap with other protocols

This is where these two matter most for us — they are **shared rails**, so naive double-counting is
very easy.

- **Linea PoH V2 ≡ Sumsub.** Any other product that runs Sumsub liveness+duplicate-search shares
  its exact trust root. If another protocol in our basket uses Sumsub (or the same document + face
  pair), Linea PoH adds ~zero independent evidence.
- **AnimaProofOfUniqueness on Verax ≡ Synaps.** Anima/Synaps supplies the "advanced computer vision
  / 3D face scan + liveness" for the Privado ID PoU that was anchored to Verax. So **Verax hosts two
  face-biometric personhood credentials (Sumsub and Synaps) that are technologically the same class
  of evidence.** Count the class once.
- **Verax hosts other agents' protocols.** `Human Passport` (8,966), `GitcoinPassportScore`
  (163,585), `HolonymV3` (41,042), `zkPass OKX KYC` (215,031), `Humanode Biomapping` (17),
  `ZeronymCleanHands` (2). Reading these from the Verax subgraph is **not an independent signal** —
  it is a stale mirror of those protocols' native state. **Always read those protocols natively;
  use Verax only for Sumsub PoH.** (Cross-ref: Human Passport is covered by another agent.)
- **Privado ID ⊃ Disco.** Disco.xyz merged into Privado ID. Whatever the Disco agent finds about
  Disco's data backplane is now the same corporate entity as this one.
- **Privado ID ⊃ Billions Network.** Billions credentials are iden3 VCs. If we ever integrate
  Billions, the Privado verification path (js-sdk / verifier backend / UniversalVerifier) *is* the
  integration — do not treat them as two integrations.
- **Verax vs EAS** (other agent): overlapping purpose, EAS is bigger and permissionless, Verax is
  permissioned and Linea-scoped, and they are bridged (`EASPortal`, `AttestationReader`). If we index
  EAS we should not assume Verax is a superset or subset — the Linea PoH attestation lives only on
  Verax.
- **Trusta Humanity / Trusta MEDIA / RubyScore / Nomis / 0xScore** (≈3.4M attestations combined) are
  **behavioural/heuristic scores from the LXP farming era**. They are the weakest category in the
  BRIEF's taxonomy and they were themselves the target of the farming they were meant to detect.
  Weight ≈ 0.

---

## Open questions for us

1. **Are V3-circuit nullifiers app-scoped or global?** Determines whether Privado could ever serve as
   a dedup primitive for us or only as a container. Look at
   `iden3/circuits/.../credentialAtomicQueryV3.circom` and the V3 beta docs.
2. **What is Sumsub's duplicate-search false-accept rate for Linea PoH?** Undisclosed, and it is the
   *entire* uniqueness guarantee of the 50,475 PoP attestations. Without it we cannot honestly weight
   Linea PoH above "KYC'd once".
3. ~~How many *unexpired* Linea PoH V2 attestations are there right now?~~ **ANSWERED — 502.**
   Measured 2026-07-24 via `attestations(where: {schema: 0x39d0…d23f, expirationDate_gt: <now>,
   revoked: false})`: **502 live, unexpired PoH V2 attestations**, oldest issued 2026-04-26, newest
   2026-07-15 (i.e. **none in the last 9 days**). Lifetime 50,475 vs live 502 — the credential is
   effectively dormant. See "Scoring-relevant facts".
4. **Billions Network real verified-user count and whether its credential is readable without their
   API.** If Billions has scale, it — not Privado — is the integration target.
5. **Was there a public trusted-setup ceremony for iden3 circuits v2.0.0 / V3?** Needed before we
   ever trust an on-chain Privado verification result.
6. **Is Linea PoH V1 data still being served?** V1 (`/poh/{address}`, multi-provider) host
   `linea-xp-poh-api.linea.build` **did not resolve/connect on 2026-07-24** (curl exit, HTTP 000).
   Likely decommissioned. If any partner still quotes "Linea PoH" they may mean the dead V1.
7. **Does a batch PoH endpoint exist anywhere?** `POST /poh/batch` on `poh-api.linea.build` is 404.
   At 1 req/address and a claimed 5 req/s cap, bulk backfill would be slow.

---

## Verdict: inputs, outputs, or neither?

| | Verdict |
|---|---|
| **Privado ID / iden3** | **Neither, today.** Not an input: there is no personhood credential on the stack we can consume at volume, and the `allowedIssuers` model hands the hard problem back to us. Not an output: publishing our assertion as a Privado VC costs ~700-770k gas on-chain and there are **16 registered ZKP requests on Polygon and 0 on Linea** — nobody would read it. **Keep on the watchlist as a credential *format*** for the day we want ZK selective disclosure of our own aggregate score, and as the integration path if **Billions Network** gets traction. |
| **Verax** | **A cheap input, narrowly — and low-priority.** Consume exactly one thing: the Sumsub PoP attestation (schema `0x39d0…d23f`) or equivalently `GET poh-api.linea.build/poh/v2/{addr}`. Free, unauthenticated, ~1 line of code. But **only 502 addresses hold a live one** (2026-07-24), so it will fire for almost nobody: build it because it costs an afternoon, not because it moves the score. Weight it as **"Sumsub document + liveness + off-chain dedup, ≤90 days old"** — state-identity + liveness, *not* protocol-guaranteed uniqueness. Ignore every other Verax schema (read those protocols natively). **Not an output:** portal registration is permissioned by Consensys, the registry receives ~1-4 attestations/day, and 98% of it is Linea. |

**If you only remember one line:** Privado ID is a beautifully engineered container with almost
nothing in it; Verax is a real registry that has gone quiet, holding one credential worth reading —
and that credential is just Sumsub.

---

## References

**Verax**
- Repo + contract addresses: https://github.com/Consensys/linea-attestation-registry (MIT; pushed 2026-07-16)
- Structs: https://github.com/Consensys/linea-attestation-registry/blob/dev/contracts/src/types/Structs.sol
- Docs high-level overview: https://docs.ver.ax/verax-documentation/core-concepts/high-level-overview
- Modules: https://docs.ver.ax/verax-documentation/core-concepts/modules
- Portals: https://docs.ver.ax/verax-documentation/core-concepts/portals
- EAS compatibility: https://docs.ver.ax/verax-documentation/developer-guides/for-attestation-issuers/eas-compatibility
- Governance: https://docs.ver.ax/verax-documentation/get-involved/governance/overview-of-governance
- Subgraphs: https://docs.ver.ax/verax-documentation/developer-guides/using-the-subgraph
- Explorer: https://explorer.ver.ax
- npm: `@verax-attestation-registry/verax-sdk` v5.4.0 (2026-03-24), MIT
- Linea docs (secondary/official): https://docs.linea.build/get-started/tooling/attestations/verax

**Linea PoH**
- https://docs.linea.build/network/how-to/verify-users-with-proof-of-humanity
- https://linea.build/blog/your-identity-on-linea (2024-10-30; describes the *deprecated* V1
  multi-provider scheme; cites ~6M attestations / 1.5M unique users) — **secondary/marketing**
- https://billions.network/blog/first-private-biometric-proof-of-uniqueness-on-linea-blockchain
  (Synaps biometrics + Verax anchoring + $1/credential pricing) — **secondary/marketing**

**Privado ID / iden3**
- https://docs.privado.id/docs/introduction/
- https://docs.privado.id/docs/smart-contracts/ (unified CREATE2 addresses; updated 2026-01-27)
- https://docs.privado.id/docs/verifier/on-chain-verification/overview/
- https://docs.privado.id/docs/faqs/content/verifier-on-chain-verification-gas-costs/ (700-770k gas)
- https://docs.privado.id/docs/releases/ (**latest product release: R8, October 2024**)
- iden3 protocol spec: https://docs.iden3.io/protocol/spec/
- Identity State = Poseidon(ClT, ReT, RoT): https://docs.iden3.io/getting-started/identity/identity-state/
- Repos: https://github.com/iden3/contracts (GPL-3.0), https://github.com/iden3/circuits (GPL-3.0,
  v2.0.0 2026-01-15), https://github.com/0xPolygonID/js-sdk (v1.45.0 2026-06-17),
  https://github.com/0xPolygonID/issuer-node (Apache-2.0, v3.0.5 2025-12-22)
- Spin-out (secondary): https://www.theblock.co/post/299898/polygon-id-spins-out-from-polygon-labs-as-privado-id
- Disco merger: https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems
- Billions launch: https://www.privado.id/blog/privado-id-introduces-billions-the-first-global-human-ai-network

**Primary measurements I made on 2026-07-24 (reproducible)**
- Verax Linea subgraph counters / schema list / Sumsub schema + portal + attester + 90-day expiry:
  `POST https://api.studio.thegraph.com/query/67521/verax-v2-linea/v0.0.1`
- Verax Arbitrum / Base / BSC counters (same host, per-chain subgraph paths)
- `eth_getCode` for STATE, UNIVERSAL_VERIFIER (Polygon PoS via `https://polygon.drpc.org`, Linea via
  `https://rpc.linea.build`), `PohVerifier`, Sumsub portal
- `eth_call` `getZKPRequestsCount()` (`0x6508e1b4`) on `UNIVERSAL_VERIFIER`: Polygon = 16, Linea = 0
- `GET https://poh-api.linea.build/poh/v2/0x…01` → `false` (200);
  `poh-signer-api…` → 500; `POST /poh/batch` → 404
