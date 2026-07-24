# Long tail & newer entrants: Billions, Holonym/Silk, Unitap, Sismo, Intuition

Researched 2026-07-24. Covers six small/newer/legacy projects. Deep coverage of EAS/Disco, Privado ID/Verax, and
Human Passport/Civic/zkMe/Galxe lives in sibling files; overlaps noted by pointer only.

---

# Billions Network

**One-liner:** Proof-of-personhood + AI-agent-identity network from the Privado ID / Disco.xyz team,
built on the iden3 stack, running its own EVM chain, with a face-scan-backed "Proof of Uniqueness"
credential and a $BILL token.
**Category:** **liveness + uniqueness (face-scan dedup)**; optional **state-identity** tier
(document check) on top.
**Chains:** its **own L2/appchain, "Billions Network", chainId `45056` (0xb000)**,
RPC `https://rpc-mainnet.billions.network` — confirmed live 2026-07-24 (`eth_blockNumber` =
`0x62d35d` ≈ 6.48M blocks). Marketing also lists Polygon, BNB Chain, Base, Linea, NEAR as
integration targets. $BILL is an ERC-20 on an Ethereum L2 (secondary sources).
**Status (2026-07): LIVE and shipping.** Evidence: GitHub org `BillionsNetwork` pushes —
`docs` 2026-07-09, `research-ai-system-prompts` 2026-06-17, `billions-oft-adapter` (LayerZero OFT)
2026-05-26, `billions-token` 2026-05-21, `verified-agent-identity` 2026-05-18 (754 stars),
`x402-human-proof-js` 2026-05-14, `erc-8004-contracts` 2026-04-08. Token generation event
**2026-05-04** (secondary: CoinGabbar, Binance Alpha listing guides). `wallet.billions.network`,
`demo.billions.network`, `identity-dashboard.billions.network` all HTTP 200 on 2026-07-24.

**Aggregator verdict: INTEGRATE LATER (watch, don't build yet).** It is real, funded, shipping,
and has a credible team (Circom / Polygon ID / Disco lineage). But (a) its credential is a face
scan, which correlates it with the biometric cluster rather than adding independent evidence,
(b) the whole verification path is centrally issued by Billions on a chain Billions controls, so
"on-chain" buys us nothing trust-wise, and (c) the numbers are airdrop-inflated. Revisit when we
see third-party relying parties that are not paying-for-airdrop-distribution.

## What it proves

Straight from their own developer docs
(https://github.com/BillionsNetwork/docs/blob/main/billions-wallet/overview.mdx, retrieved
2026-07-24):

- **Proof of Uniqueness** — *"Proves you are a real, unique human using a one-time **face scan**.
  The foundation for human verification across the Billions Network."*
- **Verified Human** — *"Combines uniqueness with **identity document verification** for a higher
  level of trust."*
- **Email** — OAuth email ownership.
- **Social Accounts** — Discord / X / Telegram linkage.

Badge tiers (same file):

| Badge | Requirement |
|---|---|
| Basic | Email + Proof of Uniqueness |
| Verified | Basic + government-issued ID document |
| **Premium** | Basic + **"Premium Voucher" + Affiliate enrollment** |

Note that the *top* tier, "Premium", is **not an identity assurance level at all** — it is a
purchase plus a referral-program enrollment. Any scoring we do must not read Premium as stronger
evidence than Verified. This is a genuine tell about the product's incentives.

### ⚠️ The marketing directly contradicts the docs

Billions' own homepage JSON-LD (retrieved 2026-07-24) describes the org as:
*"...humans prove their personhood privately... **No biometrics.** No centralised data storage.
No proprietary hardware needed."* The Privado ID launch post
(https://www.privado.id/blog/privado-id-introduces-billions-the-first-global-human-ai-network)
says *"users verify their identity just with their passport and phone... no iris scans, palm
scans, or specialized hardware."*

But the developer docs, the agent-identity docs (*"The face scan happens once. First-time users
claim a Proof of Uniqueness credential in the Billions Web Wallet with a one-time face scan"*),
and their own Lagrange case study (*"Liveness Face Verification"*) all confirm the core credential
**is a face biometric**. The defensible reading of "no biometrics" is "no *iris/orb* biometrics and
we claim we don't store the face template" — which is a marketing sleight of hand, not a technical
distinction. **Treat Billions as a biometric protocol.** This is the single most important finding
about them for our trust-root model.

## Trust root & failure modes

- **Trust root = Billions' own face-liveness/dedup vendor + Billions' issuer key.** UNVERIFIED:
  which face-matching vendor is used, and whether dedup is 1:N against the full enrolled gallery
  (true uniqueness) or merely 1:1 liveness (no uniqueness at all). Their claim that "no face data
  is stored, ever" is in tension with the existence of 1:N dedup — you cannot dedup against a
  gallery you did not keep. **Ask them this directly; it decides whether "Proof of Uniqueness" is
  uniqueness or just liveness.** This is the biggest open question on Billions.
- Issuance is centralized: PoU issuer DID
  `did:iden3:billions:main:2VwqkgA2dNEwsnmojaay7C5jJEb8ZygecqCSU3xVfm`
  (allowlisted issuer in their agent skill). A compromised or coerced issuer mints unlimited
  personhood.
- The iden3 **State contract** on their chain (`0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896`) is an
  **ERC-1967 upgradeable proxy** (verified by `eth_getCode`, which returns the standard
  `4f1ef286` / proxy-admin dispatch preamble, 2026-07-24). Upgrade admin can change verification
  semantics. Combined with a chain they run themselves, "on-chain" here means "in Billions' own
  database with extra steps."
- Their own reference skill points `rhsUrl` at **`https://rhs-staging.polygonid.me`** — a
  *staging* reverse-hash service in a published production skill
  (https://github.com/BillionsNetwork/verified-agent-identity/blob/main/scripts/shared/constants.js).
  Minor, but a maturity signal.
- **Airdrop-driven enrollment** is the classic sybil-farm magnet: paid farmers in low-income
  regions doing face scans for others is the documented attack pattern against every
  face-based airdrop network.

## On-chain surface

From `verified-agent-identity/scripts/shared/constants.js` (retrieved 2026-07-24) and live RPC probes:

- Chain: **chainId 45056 (`0xb000`)**, RPC `https://rpc-mainnet.billions.network` — live.
- iden3 **State contract**: `0x3c9acb2205aa72a05f6d77d708b5cf85fca3a896` (upgradeable proxy).
- Relay transaction sender: `0xB3F5d3DD47F6ca17468898291491eBDA69a67797`.
- PoU credential schema id: `0xca354bee6dc5eded165461d15ccb13aceb6f77ebbb1fd3fe45aca686097f2911`;
  credential context `ipfs://QmcUEDa42Er4nfNFmGQVjiNYFaik6kvNQjfTeBrdSx83At`.
- Nullifier session id `240416041207230509012302`, `pouScopeId = 1` (= keccak256 of that session id).
- DID resolver: `https://resolver.privado.id/1.0/identifiers` (i.e. **Privado ID's resolver** — see
  the sibling Privado ID file).
- Named-but-unaddressed contracts in the docs: an **Identity Verifier Contract** (verifies the PoU
  ZK proof, enforces one-human-one-identity) and an **Attestation Registry Contract** (human→agent
  link). **UNVERIFIED: their addresses.** Next step: run the `manualLinkHumanToAgent.js` flow, or
  inspect recent txs from the relay sender `0xB3F5d3DD…7797` on
  `https://rpc-mainnet.billions.network` (`eth_getLogs` / trace the `to` addresses) — that will
  reveal both addresses in minutes. There is no public block explorer URL I could confirm.

There is **no documented public "is this address a unique human" view function** the way Holonym
has one. Everything routes through the wallet/verifier request-response flow.

## Integration surface

- **Login with Billions** — an iden3 auth flow. Backend uses npm **`@iden3/js-iden3-auth`**;
  the wallet returns a **JWZ** (JSON Web Zero-knowledge) token which your backend verifies.
  Reference implementation:
  `https://github.com/0xPolygonID/tutorial-examples/tree/main/login-with-billions`.
  You need a **verifier DID** obtained from the Billions Wallet dashboard, e.g. the docs sample
  `did:iden3:billions:main:2qQ68JkRcf3xrHPQPWZei3YeVzHPP58wYNxx2mEouR`, and the agent skill's
  `did:iden3:privado:main:2SZu1G6YDUtk9AAY6TZic24CcCYcZvtdyp1cQv9cig`.
  Accepted proof envelope:
  `iden3comm/v1;env=application/iden3-zkp-json;circuitId=authV2,authV3,authV3-8-32;alg=groth16`.
- **AI-agent side:** `@0xpolygonid/js-sdk`, `@iden3/js-iden3-core`; skill repo
  `BillionsNetwork/verified-agent-identity` (installed via `npx clawhub@latest install
  verified-agent-identity` or `npx skills add BillionsNetwork/verified-agent-identity`).
  Relay callback base: `https://attestation-relay.billions.network/api/v1/callback?attestation=`.
- **`x402-human-proof-js`** (https://github.com/BillionsNetwork/x402-human-proof-js) —
  proof-of-human extension for x402 payment gating / discounts. Also `erc-8004-contracts`
  ("registry contracts curated by the 8004 team") — they are chasing the agent-identity standard.
- **Docs source of truth:** `https://github.com/BillionsNetwork/docs` (Mintlify, MDX).
  UNVERIFIED: the live docs hostname — `docs.billions.network`, `developers.billions.network`,
  and `billions.network/docs` all failed (DNS 000 / 404) on 2026-07-24. Read the repo instead.
- **Verification is not permissionless.** Because credentials live in the user's Billions wallet
  and are presented on request, we cannot check "is user X a verified human" from a wallet address
  alone without the user running the flow — unlike Holonym. This is a real integration cost.

## Privacy model

Genuine iden3-style ZK: BJJ/Groth16 credential proofs (authV2/authV3), credentials stored
client-side, revocation via reverse hash service. Nullifiers are **session/scope-scoped**
(`nullifierSessionId` + `pouScopeId`), so cross-app linkage is avoided by construction — same
design family as Privado ID (see that file). The verifier learns a DID and a boolean, not a face.

Caveat, as with Holonym: the **issuer sees the raw biometric** at enrolment. ZK protects the
verifier side only. "No face data stored, ever" is an unaudited claim by the party with the
incentive to make it; UNVERIFIED — no third-party audit of the biometric pipeline found.

## Scoring-relevant facts

- **User numbers are internally inconsistent on their own homepage** (2026-07-24): the visible
  counter renders **3,244,246**, another string on the same page says **2,560,606**, and the
  embedded schema.org `Verified Users` property says **2300000**. Secondary press says "over 2.4
  million." Three different numbers, one page. Treat any Billions user count as marketing.
  Earlier: 1.1M signups claimed within months of the Feb-2025 launch — i.e. **signups**, not
  verifications, is what was being counted then.
- Claimed enterprise/institutional users: Deutsche Bank, HSBC, Telefónica Tech, Sony Bank, Spanish
  Red Cross. UNVERIFIED and probably inherited from Privado ID's enterprise pipeline rather than
  Billions specifically — the Privado blog frames them as "testing."
- Token: **$BILL**, TGE **2026-05-04**, 10,000,000,000 fixed supply, ~24.28% circulating at TGE
  (secondary sources: CoinGecko/CoinMarketCap/exchange explainers). The airdrop is the growth
  engine, which is exactly the population most contaminated by farming.
- Cost/friction to user: free, mobile app (iOS `id6742451067`, Android `com.billions.app.mobile`),
  face scan takes seconds. Low friction = low sybil cost.
- Case study: Billions × Lagrange airdrop — "filtered out hundreds of thousands of duplicate or
  ineligible claims." No denominators published.
  https://billions.network/blog/proof-of-uniqueness-on-token-distribution-billions-x-lagrange

## Overlap with other protocols

- **Privado ID / iden3 / Polygon ID** — Billions *is* the Privado ID team and stack; it uses
  Privado's DID resolver and the `0xPolygonID` SDKs and tutorial repos. Same trust machinery,
  different issuer. **See the Privado ID / Verax file.** Do not count Billions and Privado ID as
  two independent signals about the same user.
- **Disco.xyz** — same founders (Evin McMullen). See the EAS/Disco file.
- **Face-scan cluster:** Billions PoU ↔ Holonym `biometrics` ↔ zkMe ↔ (differently) World ID iris.
  Different vendors, same *class* of evidence and same class of failure. Cap their combined
  contribution.
- **Document cluster:** Billions "Verified Human" ↔ Civic ↔ Holonym `gov-id` ↔ zkMe KYC.

## Open questions for us

1. **Is Proof of Uniqueness 1:N deduplicated, or only 1:1 liveness?** If the latter, it proves
   *not-a-bot*, not *uniqueness*, and their entire product name is wrong. Decisive for scoring.
2. If it is 1:N, what gallery is retained and where — which contradicts "no face data stored"?
3. Addresses of the Identity Verifier and Attestation Registry contracts on chain 45056, and
   whether there is any public read path for "address → verified human."
4. Is there a way to verify a Billions credential without the user re-running the wallet flow?
5. Who is the face vendor, and is there a published PAD/injection-attack evaluation (ISO 30107-3)?

---

# Holonym / Human Keys / Silk  →  now **human.tech**

**One-liner:** ZK identity stack (Zeronym / "Human Keys" / Mishti) plus Silk, an embedded wallet
with identity built in. As of 2026-07 the whole thing has been **absorbed into the `human.tech`
brand** together with Gitcoin Passport.

**Corporate/product reality, verified 2026-07-24 by following live redirects:**
- `docs.holonym.id` → **301** → `https://docs.id.human.tech/`  ("Human ID")
- `docs.silk.sc` → **307** → `https://docs.wallet.human.tech/` → **301** → `https://docs.waap.human.tech/`
  (Silk is now marketed as a "Wallet-as-a-Service", WaaP/WaaS)
- `holonym.io` → 301 → `holonym.id`; the Holonym Foundation landing page still resolves but is
  **stale** — its newest blog entry is dated **2024-08-02** ("Holonym Quarterly Update Q2 2024"),
  and the page returns **HTTP 502 intermittently** (roughly 1 in 3 requests on 2026-07-24), i.e.
  it is an unmaintained legacy property.
- `silk.sc` root: **404**. `blog.holonym.id`, `developer.holonym.id`, `research.holonym.id`:
  **HTTP 000 / dead**. `www.mishti.network`: **404**.
- Live and maintained: `human.tech` (200), `passport.human.tech` (200),
  `docs.id.human.tech`, `docs.waap.human.tech`.
- npm `@silk-wallet/silk-wallet-sdk` — latest **1.0.2, published 2025-10-08**, 44 versions.
  So the wallet SDK was actively shipped through late 2025 even while the Holonym-branded
  properties rotted. https://www.npmjs.com/package/@silk-wallet/silk-wallet-sdk

**Read this as:** Holonym-the-brand is gone; Human Passport / human.tech is the surviving entity.
Detailed coverage of the Human Passport scoring product belongs to the sibling
`human-passport / civic / zkMe / galxe` file. What *this* file adds is the Holonym-side
credential ("Human ID" / Zeronym / Proof of Clean Hands) and the Silk wallet SDK.

**Status (2026-07): LIVE, actively developed, but rebranded and repositioned toward wallets/AI
agents.** GitHub org `holonym-foundation` had pushes on **2026-07-24 (today)**
(`shield.human.tech`), 2026-07-23 (`tap-oss` — "credential isolation for AI agents",
`id-server`), 2026-07-22 (`human-network` — "decentralized threshold cryptography", the Mishti
successor). Recent identity-relevant repos: `passport` (2026-05-22), `NFCPassportReader-fork`
(2026-05-29), `mishti-smart-contracts` (2026-05-27), `id-hub-contracts` (2025-12-12),
`holonym-api` (2026-03-04). Source: `gh api orgs/holonym-foundation/repos?sort=pushed`,
retrieved 2026-07-24.

**Aggregator verdict: INTEGRATE NOW (cheap, permissionless read).** `api.holonym.io` is a public,
unauthenticated REST API that answers "is this address a unique person for this action-id" in one
GET, and the underlying state is on Optimism so we can also read it ourselves without the vendor.
That is one of the lowest-friction integrations in the whole landscape. Caveat: the credential's
trust root is a **KYC vendor + (optionally) a face scan**, so it correlates heavily with
Civic/zkMe/Billions — see Cross-cutting section.

## What it proves

Human ID (formerly Zeronym) issues several distinct credentials, each with its own issuer key and
ZK circuit (from `holonym-api/src/constants/misc.js`):

| Credential | What it actually proves | Category |
|---|---|---|
| `gov-id` / `kyc` | A KYC vendor verified a government ID document belonging to this person | **state-identity → uniqueness** (one gov ID = one registration per action) |
| `zk-passport` | NFC e-passport chip read + passive-authentication ZK proof (no vendor in the loop) | **state-identity → uniqueness**, strongest & most self-sovereign of the set |
| `phone` | Control of a phone number | **weak uniqueness / behavioral** — SIM farms defeat this |
| `biometrics` | **A face scan** (issuer `0x0d4f849d…d922`, circuit `0x0b512122…3d15`) | **liveness + uniqueness-by-dedup** |
| `clean-hands` | Sanctions/AML screening passed ("Proof of Clean Hands") | **not personhood** — compliance signal |
| `residence/country/us` | US residency | attribute, not personhood |

Uniqueness is enforced **per `action-id`**: a user "registers" an address as the unique person for
a given action ID. Same human + different action ID = different, unlinkable registration. This is
an **app-scoped nullifier** design, which is good for privacy but means *we* must pick and publish
a stable action-id, and cannot cross-reference a user across apps (by design).

## Trust root & failure modes

- **`gov-id`/`kyc`: the trust root is a commercial IDV vendor, and there are four of them.**
  Confirmed by reading `github.com/holonym-foundation/id-server` (pushed 2026-07-23):
  `src/routes/onfido.ts`, `src/routes/sumsub.ts`, `src/routes/idenfy.ts`,
  `src/routes/veriff-kyc.ts`, plus `src/constants/onfido.ts` and `src/constants/sumsub.ts`.
  So **Onfido, Sumsub, iDenfy and Veriff** are all wired in. A Holonym `gov-id` credential means
  "one of four IDV vendors said yes" — its strength is the *weakest* of the four, and it shares a
  root with every other protocol using those same vendors.
- **`biometrics`: the vendor is FaceTec**, self-hosted by Holonym.
  `src/routes/facetec.js`, `src/services/facetec/**`, and
  `src/constants/misc.ts` which defines `facetecServerBaseURL = https://facetec-server.holonym.io`
  (commented: *"We use this FaceTec server for silksecure.net. This server will be shut down
  eventually"*) and `facetecServer2BaseURL = https://facetec-server-2.holonym.io` (*"for
  id.human.tech"*). Uniqueness comes from FaceTec **`/3d-db/search`** (1:N gallery search) followed
  by **`/3d-db/enroll`**. So Holonym *does* retain a face gallery — which is what makes its
  biometrics credential genuinely deduplicating, unlike Billions' unaudited "no face data stored"
  claim.

### 🚩 Holonym ships an explicitly **non-sybil-resistant** biometric credential

`src/routes/facetec.js` mounts **two parallel production routes**:

```js
router.post("/v2/no-sybils/process-request",   processRequest);
router.get ("/v2/no-sybils/credentials/:_id/:nullifier", getCredentials);
router.post("/v2/allow-sybils/process-request", processRequestAllowSybils);
router.get ("/v2/allow-sybils/credentials/:_id/:nullifier", getCredentialsAllowSybils);
```

and `src/services/facetec/allow-sybils/credentials.js` enrolls into FaceTec 3d-db
`groupName "2"` with the inline comment *"reference to 3d-db groupName for non-sybil resistant
biometrics"*. There is an equivalent `src/services/biometrics-sessions/allow-sybils/endpoints.js`.

**Meaning: a "Holonym biometrics" credential may have been issued through a path that deliberately
skips deduplication.** `src/constants/misc.ts` appears to declare only one
`biometricsIssuerAddress` and one `v3BiometricsSybilResistanceCircuitId`, so **UNCLEAR** whether
allow-sybils credentials are distinguishable on-chain from no-sybils ones. If they are not, the
Holonym biometrics SBT proves *liveness only*, not uniqueness, and we must score it accordingly.
**Next step: diff `src/services/facetec/v2/allow-sybils/credentials.js` against
`.../v2/no-sybils/credentials.js` for the issuer/circuit/`sessionType` they sign, and ask Holonym
directly.** This is the highest-value unresolved question in this file.

### Documented production incident, 2026-04-28 (severity: high, their own classification)

`docs/solutions/security-issues/sandbox-kyc-endpoints-leak-into-live-userverifications-2026-04-28.md`
in `holonym-foundation/id-server`: there is only one global `UserVerifications` collection and no
`SandboxUserVerifications`, so **sandbox KYC issuance wrote into live sybil-resistance state**.
Affected paths: `POST /zk-passport/verify-and-issue`, `POST /off-chain-attestations/zk-passport`,
`GET /onfido/credentials/v3/...`, `GET /sumsub/credentials/v3/...`. Symptoms in their own words:
*"Sandbox KYC issuance writes to the live UserVerifications collection, polluting prod
sybil-resistance state"* and *"A user who verified in live cannot exercise the sandbox flow with
the same passport."* Fixed by gating reads/writes on `config.environment === "live"`.

Two things we should take from this. (1) Credit for publishing it — most protocols in this file
publish nothing. (2) The doc itself states **"AML sessions (`src/services/aml-sessions/endpoints.ts`)
still call `saveUserToDb(uuid)` unconditionally… likely have the same bug"** — i.e. a known,
unfixed variant as of that write-up. And structurally: *uniqueness state lives in a MongoDB
collection*, not in the ZK system. The on-chain proof is only as sound as that database.
- **`zk-passport`:** trust root is the issuing state's passport-signing PKI (ICAO DSC/CSCA). This
  is the same root as Rarimo/zkPassport/Self, so **do not double-count** a Holonym zk-passport
  against a Self.xyz or Rarimo passport credential — it is literally the same document.
- **`phone`:** trivially farmable. Should carry near-zero weight.
- **`biometrics`:** face-scan dedup — vulnerable to whatever the underlying face-matching vendor
  is vulnerable to (injection attacks, deepfake presentation). UNCLEAR which vendor.
- **Centralized issuance:** issuance is by a Holonym-run issuer key; a compromised issuer can mint
  arbitrary credentials. The `Hub` has `revokeSBT` and `changeVerifier` owner-only functions
  (HubV3 ABI) — so the operator can revoke and swap the verifier. Not trust-minimized.
- **Operational fragility:** legacy domains (`blog.holonym.id`, `developer.holonym.id`,
  `research.holonym.id`, `mishti.network`) are dead and `holonym.id` 502s intermittently — a real
  signal that the identity product is not the org's current priority (WaaP / AI-agent wallets are).

## On-chain surface

All addresses below transcribed verbatim from
https://github.com/holonym-foundation/holonym-api/blob/main/src/constants/contractAddresses.js and
`.../src/constants/misc.js` (retrieved 2026-07-24).

**Optimism mainnet (chainId 10):**
- `Hub` (v2): `0x87b6e03b0D57771940D7cC9E92531B6217364B3E`
- `HubV3` (current): `0x2AA822e264F8cc31A2b9C22f39e5551241e94DfB`
- `SybilResistance` (gov-id, v2): `0xdD748977BAb5782625AF1466F4C5F02Eb92Fce31`
- `SybilResistancePhone` (v2): `0xA40C8AAF7F47B18c1eDdBe7855b580f828eD9711`
- `IsUSResident` (v2): `0x7497636F5E657e1E7Ea2e851cDc8649487dF3aab`
- `MerkleTree`: `0xE848Ce0b3cF9B55F05d47DD832B8c1193Ad2D970`
- Relayer: `0xB1f50c6C34C72346b1229e5C80587D0D659556Fd`
- Attestor (live, from `GET https://api.holonym.io/attestation/attestor`, 2026-07-24):
  `0xa74772264f896843c6346ceA9B13e0128A1d3b5D`

**Base Sepolia testnet (chainId 84532):** `HubV3Testnet` `0x98221c937C51f5bBe615CB104435395c93b1AD8D`
(Optimism-Goerli addresses also in the file but that chain is dead.)

**Stellar/Soroban SBT contract:** `CCNTHEVSWNDOQAMXXHFOLQIXWUINUPTJIM6AXFSKODNVXWA4N7XV3AI5`
(so Human ID is not EVM-only; NEAR and Stellar user guides exist in docs.id.human.tech).

**Read functions an aggregator can call directly:**
- `AntiSybilStore` / SybilResistance: `function isUniqueForAction(address, uint256) view returns (bool)`
  and event `Uniqueness(address, uint)`
- `IsUSResident`: `function usResidency(address) view returns (bool)`, event `USResidency(address, bool)`
- `HubV3`: `function getSBT(address, bytes32 circuitId) view returns (tuple(uint256 expiry, uint256[] publicValues, bool revoked))`
  and `function getIdentifier(address, bytes32) pure returns (bytes32)`.
  HubV3 is also an ERC-721 (`balanceOf`, `ownerOf`) — the SBT is a non-transferable NFT.

**Circuit IDs to pass to `getSBT`** (from `misc.js`):
- KYC sybil-resistance: `0x729d660e1c02e4e419745e617d643f897a538673ccf1051e093bbfa58b0a120b`
- Phone: `0xbce052cf723dca06a21bd3cf838bc518931730fb3db7859fc9cc86f0d5483495`
- Clean Hands: `0x1c98fc4f7f1ad3805aefa81ad25fa466f8342292accf69566b43691d12742a19`
- Biometrics: `0x0b5121226395e3b6c76eb8ddfb0bf2f2075e7f2c6956567e84b38a223c3a3d15`
- zk-Passport: `0x14c3513390f8a03993c848621b1840d58c27fd50bbddba73265e22d17b0b747e`

**Issuer addresses (public inputs, so we can pin them):** govId
`0x03fae82f38bf01d9799d57fdda64fad4ac44e4c2c2f16c5bf8e1873d0a3e1993`; phone
`0x40b8810cbaed9647b54d18cc98b720e1e8876be5d8e7089d3c079fc61c30a4`; biometrics
`0x0d4f849df782fb9e68d525fbda10b73e59180e59cb2a21ce5d70ccc45dbfd922`; zkPassport
`0x231c6ff490cf3282131a301f0b7dad3dcdfa769d912e01941a80c92dd750df96`.

Clean Hands is additionally attested off Holonym's own contracts via **Sign Protocol**
(schema `onchain_evm_10_0x8` on Optimism, `onchain_evm_11155420_0xc41` on OP Sepolia) and,
per docs.id.human.tech, via **Verax** — the Verax side is covered in the sibling Privado/Verax file.

## Integration surface

**`https://api.holonym.io` — public REST, no API key observed.** Confirmed live 2026-07-24:
`GET https://api.holonym.io/sybil-resistance/gov-id/optimism?action-id=123456789&user=0x00…00`
→ `{"result":false}` (200). `GET /attestation/attestor` → `{"address":"0xa747…3b5D"}` (200).

Endpoints (from the repo README, https://github.com/holonym-foundation/holonym-api):
- `GET /sbts/{kyc|zk-passport|phone|biometrics}?address=…` → `{hasValidSbt, expirationDate}`
- `GET /sybil-resistance/{gov-id|phone|biometrics}/{optimism|base-sepolia}?user=…&action-id=…`
  → `{result: bool, expirationDate}`. Note: `gov-id` **also checks zk-passport as a fallback**.
- `GET /residence/country/us/{network}?user=…`
- `GET /attestation/sbts/{gov-id|zk-passport|phone|biometrics|clean-hands}`
- `GET /attestation/attestor`, plus `/sandbox/...` variants
- `GET /snapshot-strategies/...` — ready-made Snapshot voting strategies

Default `action-id` in their code is `123456789`. Contracts are on Optimism, so **we can verify
without the vendor's cooperation** by calling `isUniqueForAction` / `getSBT` on our own RPC. That
is a genuinely rare property and the main reason to integrate.

**Silk wallet SDK:** npm `@silk-wallet/silk-wallet-sdk`, latest **1.0.2 (2025-10-08)**, 44 versions
published. Docs now at `docs.waap.human.tech` (Silk → "Human Wallet" / WaaP). Silk is an embedded
EIP-1193 wallet with login + optional identity attached; it is a *distribution* surface, not a
credential we consume. Also `holonym-foundation/silk-wagmi-connector` (last push 2024-10-03 — stale)
and `human-wallet-SDK-vite-demo` (2025-08-29).

UNVERIFIED: pricing. The read APIs appear free/unauthenticated; issuance (the user paying to get a
credential) historically cost a few dollars in crypto. Check `docs.id.human.tech` pricing page.

## Privacy model

Real ZK. The user proves in-circuit that they hold an issuer-signed credential in the Merkle tree
and derives a nullifier bound to the `action-id`. Verifier learns only `(address, action-id) → bool`.
Nullifiers are **action-scoped, not global** — so two dApps using different action-ids cannot link
the same human. For an aggregator this cuts both ways: good privacy story to sell, but we cannot
use Holonym to detect that the same human is presenting two wallets to *us* unless we use one
stable action-id across our whole product (which we should).

The issuer *does* see the raw KYC/biometric data at issuance time — the ZK only protects the
verifier-facing side. Trust root correlation is therefore fully intact even though the proof is private.

## Scoring-relevant facts

- Credential tiers we can score differently: `zk-passport` > `gov-id/kyc` ≈ `biometrics` >> `phone`.
- SBTs **expire** — every API response carries `expirationDate`; `getSBT` returns an expiry and a
  `revoked` flag. So decay/revocation is native and we must re-check, not cache forever.
- UNVERIFIED: current user counts. Holonym historically claimed low-hundreds-of-thousands of
  verifications; no live counter found. Best next step: index `Uniqueness` events on
  `0xdD748977BAb5782625AF1466F4C5F02Eb92Fce31` (Optimism) and count unique addresses — that is a
  hard, unspinnable number and we can compute it ourselves.

## Overlap with other protocols

- **Human Passport (Gitcoin Passport)** — same company. Human ID credentials feed Human Passport
  stamps. Scoring both independently is **double counting**. See the Human Passport file.
- **zk-passport ↔ Self.xyz / Rarimo / zkPassport** — identical ICAO passport-PKI trust root.
- **gov-id/KYC ↔ Civic / zkMe / Billions** — all bottom out in a commercial IDV vendor reading a
  government document. Treat as one evidence class.
- **Clean Hands ↔ Verax / Sign Protocol** — attestation plumbing shared with the Privado/Verax file.

## Open questions for us

1. **Are `allow-sybils` biometric credentials distinguishable from `no-sybils` ones on-chain?**
   If not, the `biometrics` SBT cannot be treated as a uniqueness proof at all. Blocking question.
2. Which IDV vendor signed a given `gov-id` credential — is that exposed anywhere (public inputs,
   API field), or opaque? Determines whether we can de-correlate against Civic/zkMe.
3. Is `api.holonym.io` rate-limited or subject to future auth? It is currently open; we should
   plan an on-chain fallback path (`isUniqueForAction` on Optimism) from day one rather than
   depending on it.
4. Real user counts: index `Uniqueness` events on `0xdD748977BAb5782625AF1466F4C5F02Eb92Fce31`
   (Optimism) and on `HubV3` `0x2AA822e264F8cc31A2b9C22f39e5551241e94DfB`.
5. Given the org's visible pivot to wallets/AI agents, what is the commitment to keeping Human ID
   issuance running? The dead `blog/developer/research.holonym.id` subdomains are a bad sign.

---

# Unitap

**One-liner:** A multi-chain gas faucet / token-drop / raffle product ("Gas Tap", "Token Tap",
"Prize Tap") that had to solve sybil resistance to exist. Interesting to us as a **demand-side
consumer** of personhood signals, not as an issuer.
**Category:** n/a — it is a *relying party*, not a credential.
**Chains:** many EVM chains (distribution side); its own `unitap-pass`, `prizetap-contracts`,
`funds-manager` Solidity repos.
**Status (2026-07): SEMI-ABANDONED / degraded.** Evidence gathered 2026-07-24:
- `unitap.app/` 200, `/tokentap` 200, `/prizetap` 200, `/about` 200 — but **`/gastap` returns
  HTTP 500**, i.e. the flagship product page is broken in production.
- Frontend commit **2026-02-09: "remove gastap settings api for now"** — they deliberately ripped
  out Gas Tap plumbing. Last frontend commit 2026-06-10 and it is a chore ("read the images from
  the nextjs static files instead"), not a feature.
- **Backend (`UnitapApp/unitap-backend`) last commit 2025-06-30** — over a year stale as of
  2026-07-24, and the last commit is a CSRF config fix.
- Site footer still reads **"© Copyright 2025"**.
- Other repos all stale: `TokenTap` 2024-09-30, `prizetap-contracts` 2024-09-25,
  `point-market-backend` 2024-08-11, `unitap-pass` 2024-06-29, `BrightIDRegistry` 2023-01-30.
- Sources: https://github.com/UnitapApp , live HTTP probes.

**Aggregator verdict: SKIP as an integration.** Nothing to consume. **But keep the finding below**
— it is one of the few honest data points we have about what a real distribution product was
willing to bet money on.

## Why it matters to us: revealed preference

Unitap's backend enumerates every eligibility check it supports in
`core/constraints/__init__.py`
(https://github.com/UnitapApp/unitap-backend/blob/main/core/constraints/__init__.py, read 2026-07-24).
The complete personhood-ish set is:

- `BrightIDMeetVerification` — BrightID "Meet" (social-graph verification party)
- `BrightIDAuraVerification` — BrightID "Aura" (social-graph reputation layer)
- `HasGitcoinPassportProfile`, `HasMinimumHumanityScore` — Gitcoin Passport / Human Passport score
- `HasVerifiedCloudflareCaptcha`, `HasVerifiedHCaptcha` — plain captcha
- `HasDonatedOnGitcoin` — costly-signal proxy

Everything else in the file is *engagement/asset* gating, not personhood: Farcaster, Lens, Twitter,
Telegram, ENS, EAS (`Attest`, `BeAttestedBy`), Zora mints, Arbitrum/Optimism delegation, Octant GLM
staking, Muon node operation, NFT/token balances, allowlists.

**What is conspicuously absent: World ID, Civic, Proof of Humanity, Idena, zkMe, Holonym, any
biometric, any KYC.** A product literally giving away money to strangers, whose entire viability
depended on sybil resistance, chose **social-graph (BrightID) + score aggregation (Gitcoin
Passport) + captcha**, and never added a biometric or document credential.

Two readings, and both matter for our positioning:
1. **Coverage beats strength for consumer distribution.** Biometric/KYC credentials have too few
   holders and too much friction to gate a faucet; the relying party would lose more real users
   than sybils.
2. **Aggregation was already the answer in practice.** Their "constraints" system *is* a
   hand-rolled, per-campaign aggregator — a list of heterogeneous signals with a
   `HasMinimumHumanityScore` threshold. That is our product, built badly, by someone who needed it.
   The fact that they built it themselves rather than buying it is a demand signal; the fact that
   they then went stale is a caution about the market's willingness to *pay* for it.

Also note `BrightIDRegistry` (Solidity, last touched 2023-01-30) and the Django project literally
being named **`brightIDfaucet`** — the product was born as a BrightID faucet. BrightID's own
liveness should be checked by whoever owns the social-graph protocols file.

## Integration surface

Public REST at `api.unitap.app` (paths under `/api/v1/gastap/…`, `/api/v1/tokentap/…`); the two
paths I probed returned HTTP 400 rather than 200 on 2026-07-24, so **UNVERIFIED** whether the API
is still usefully live. Not worth chasing — Unitap consumes credentials, it does not issue any we
could aggregate.

---

# Sismo

**One-liner:** ZK attestation protocol ("ZK Badges", "Sismo Connect", "Data Vault") for selectively
disclosing group-membership proofs — **defunct**.
**Category:** n/a (it was an *aggregation/selective-disclosure layer*, not a personhood issuer)
**Chains:** Ethereum mainnet, Polygon, Gnosis (badge contracts, historical)
**Status (2026-07): DEAD.** Evidence gathered 2026-07-24:
- `docs.sismo.io` — DNS/TLS failure, curl exit, HTTP 000 (dead)
- `apps.sismo.io` (the Sismo App Store) — HTTP 000 (dead)
- `sismo.io` / `www.sismo.io` — returns 200 but the body is a **domain-parking lander**
  (`window.LANDER_SYSTEM="PW"`, `window._trfd.push({ap:"parking"})`), i.e. the domain has
  lapsed to a registrar parking page. The company site no longer exists.
- GitHub `sismo-core`: last activity `sismo-hub` 2024-12-31; `sismo-vault-api` 2024-03-16;
  `sismo-docs` 2023-11-10; `sismo-badges` 2023-10-03. https://github.com/sismo-core
- ZK Badges minting app was sunset **2023-09-01** (announced on sismo.mirror.xyz).
**Aggregator verdict: SKIP as an integration. STUDY as prior art.** There is nothing live to
consume. But Sismo is the closest existing design to our privacy-composition problem, and its
commercial failure is a market signal we should internalize rather than repeat.

## The wind-down — dated

- **2023-09-01** — the ZK Badges minting app is sunset. Lifetime totals at that point: **~160k
  badges minted, 244 distinct badge types, ~65k unique minters**. That is the whole lifetime
  volume of the flagship product. (Announcement on `sismo.mirror.xyz`; the post is behind
  Cloudflare and returned **403** to automated fetches on 2026-07-24, so this is reported at one
  remove — treat the numbers as *approximately* right, not audited.)
- **2023-11-16** — The Big Whale reports Sismo "in difficulty, could soon be shut down."
  https://www.thebigwhale.io/article/exclusive-sismo-in-difficulty-could-soon-be-shut-down
- **2023 Q4** — founder **Hadrien Charlanes** announces on X that Sismo is **returning capital to
  investors**: **$10.5M raised from ~130 investors, ~51% returned**, some closed-source work
  open-sourced, infrastructure to be maintained "for several months." (Secondary:
  https://www.coinlive.com/news-flash/389359 — note that aggregator stamps this 2023-10-12 while
  The Big Whale piece is 2023-11-16; **UNCLEAR** which is the true announcement date. The quarter
  is certain, the day is not.)
- **2024** — residual commits only (`sismo-hub` 2024-12-31, `sismo-vault-api` 2024-03-16).
- **2026-07-24** — `sismo.io` is a registrar parking page; `docs.sismo.io` and `apps.sismo.io`
  no longer resolve. Fully gone.

## Why it failed — and what that tells us

From The Big Whale's reporting (2023-11-16), corroborated by the shape of the repos:

1. **~$10M raised, ~10 employees, effectively no revenue.** They were building infrastructure and
   never found anyone to bill.
2. **Key-person ZK risk.** The head of technology burned out and was not replaced; an investor is
   quoted saying the team was "probably not strong enough on ZK-Rollups." Deep-ZK talent is scarce
   and a two-person dependency killed the roadmap.
3. **They pivoted the product twice under the same thesis.** ZK Badges (tokenized attestations,
   2022) → their own admission that badges were *"not adequately suited to manage an application's
   access control and reputation systems"* → Sismo Connect (an SSO / proof-request protocol, 2023)
   → out of money. The thesis ("apps want privacy-preserving aggregated identity") never converted
   into paying demand within the runway.
4. **The distribution problem was never solved.** Sismo required the app to integrate a bespoke
   proof-request flow *and* required the user to build up a Data Vault first. Two-sided cold start
   with no compelling day-one credential — nobody had to have a Sismo proof for anything.

**What we should take from this, bluntly:** an aggregation/selective-disclosure layer with no
credential of its own, no distribution, and no billable buyer is a known way to lose $10M. The
existence of Sismo is *not* evidence that the market wants aggregation; it is the strongest single
piece of evidence that a well-funded, technically strong team could not sell it in 2022-2023. Our
differentiator has to be that we sell to a relying party with an existing, urgent sybil problem
(airdrops, faucets, agent gating) and that we are useful on day one with credentials users
*already have* — the opposite of Sismo's "come build a vault first."

## Architecture worth stealing (this is the valuable part)

**Data Vault** — a *local, client-side* store into which the user adds **Data Sources** (Ethereum
wallets, GitHub, Twitter, Telegram accounts). Aggregation happens in the user's vault, not on a
server. https://github.com/sismo-core/sismo-docs/blob/main/data-vault/what-is-the-data-vault.md

**Data Groups** — a Data Group is a Merkle tree of eligible accounts with an associated value per
account. Membership is proven in ZK. Groups were generated by "group generators" in `sismo-hub`
(https://github.com/sismo-core/sismo-hub) — an open pipeline anyone could contribute a data source
to. This is a clean model for "any list-shaped signal becomes a provable credential."

**Vault Identifier (`vaultId`)** — the single most reusable idea for us. From
https://github.com/sismo-core/sismo-docs/blob/main/data-vault/vault-and-proof-identifiers.md :

```
vaultId = hash(vaultSecret, hash(appId, derivationKey))
```

- `vaultSecret` — the user's vault seed, known only to them.
- `appId` — the relying app's ID ⇒ **app-scoped, so users cannot be tracked across apps**.
- `derivationKey` — defaults to 0; lets an app deliberately mint *multiple* IDs per user.

Properties they call out explicitly: **anonymous** (only the vault owner can compute it),
**app-specific** (no cross-app correlation), and **deterministic** (a user cannot get two IDs at
one app *unless they create a second Data Vault* — and "Data Sources can only be added to a single
Data Vault," which is the actual uniqueness enforcement). `vaultId` doubles as the nullifier: it is
how SafeAirdrop prevented double-claims and how "Privacy Is Normal" ran a sybil-resistant lottery.

**Crucially, `vaultId` itself could be a Data Source** for further groups — i.e. proofs compose
into new provable groups. That recursion is exactly what an aggregator needs and is the design
detail most worth copying.

**Proving schemes:** Hydra-S1 / Hydra-S2 (Groth16, Poseidon, EdDSA).
https://github.com/sismo-core/sismo-docs/tree/main/data-vault/proving-schemes

**The weak joint — the Commitment Mapper.** To make account-ownership proofs SNARK-cheap, Sismo ran
a **trusted off-chain AWS Lambda** that verified an ECDSA signature or an OAuth login and signed an
EdDSA receipt binding `account → poseidonHash(secret)`. Their own docs state users must trust it to
"verify proof of account ownership correctly, authorize **only one commitment per account**, and
keep the data store private."
https://github.com/sismo-core/sismo-docs/blob/main/data-vault/commitment-mapper.md
**A compromised commitment mapper forges arbitrary group memberships and deanonymizes the account
set.** Every "trustless ZK identity" design so far — Sismo's, Holonym's, Billions' — has exactly
one of these centralized issuance oracles. We should assume ours will too, and be honest about it.

## On-chain surface (historical, do not integrate)

`sismo-core/sismo-badges` — the badge minting protocol (ERC-1155 non-transferable attestations,
plus `ZKBadgeboundERC721`). Ethereum mainnet / Polygon / Gnosis deployments existed. Last commit
2023-10-03. https://github.com/sismo-core/sismo-badges
Historical activity dashboard: https://dune.com/martingbz/sismo-zk-badges (a Dune query is the
only remaining way to reconstruct usage now that the apps and docs sites are gone).

## Integration surface (dead)

npm `@sismo-core/sismo-connect-client` / `-react` / `-server` and the Solidity
`SismoConnectLib` (https://github.com/sismo-core/sismo-connect-packages, last touched 2023).
The verifier flow depended on `apps.sismo.io` and the Sismo vault app, both of which are gone —
**the packages will not work end-to-end today.** MIT licensed, so the circuits and contracts are
free to fork.

---

# Intuition

**One-liner:** A token-curated knowledge graph — "Atoms" (identifiers) and "Triples"
(subject-predicate-object claims) that anyone can create and that anyone can **stake $TRUST on** —
marketed as "the trust layer for the internet and AI."
**Category:** **none of the five.** It is a *claim substrate*, not a personhood credential. Any
personhood semantics would come from whoever issues the triple, not from Intuition.
**Chains:**
- **Intuition Mainnet L3, chainId 1155** — confirmed live 2026-07-24
  (`eth_chainId` at `https://rpc.intuition.systems` → `0x483` = 1155). Blockscout explorer at
  `https://explorer.intuition.systems` (HTTP 200).
- **Base mainnet (8453)** — $TRUST ERC-20.
- Testnets: Base Sepolia (84532), Intuition Testnet L3 (13579).
**Status (2026-07): LIVE, mainnet since 2025-10-29, very actively developed.** GitHub org
`0xIntuition` had pushes **on 2026-07-24 (today)** across `intuition-contracts-v2`,
`intuition-docs`, and `intuition-core`; `agent-skills` 2026-07-20; `intuition-rs` 2026-07-14.
Raised **$8.5M** (Shima Capital, Superscrypt, ConsenSys, Polygon, F-Prime, CoinList, Legion).
Claimed beta/testnet activity before mainnet: **244,000 participants, 5M+ transactions and
attestations on Base** (secondary: https://cryptobriefing.com/intuition-mainnet-launch-trust-token/,
2025-10-29).

**Aggregator verdict: SKIP as a personhood source; consider LATER as a publication venue.**
Intuition does not and cannot tell us a user is human. Its economic layer adds **cost**, not
**uniqueness** — see below. It is potentially interesting as a place to *publish* our aggregated
humanity assertions as triples so that other apps can read them, but that is a distribution
decision, not a data-source decision, and it costs gas plus $TRUST.

## What it proves

Nothing about personhood. The primitives are:
- **Atom** — a token-curated identifier for any entity (a person, a URL, a contract, a concept).
  Each Atom gets an **AtomWallet** (ERC-4337 account) via `AtomWalletFactory`.
- **Triple** — `[subject] - [predicate] - [object]`, e.g. from their own docs
  (`docs/_data/intuition-concepts/trust-mechanisms.md`):
  `[Address X] - [is controlled by] - [Person Y]`, `[Account] - [verified by] - [KYC Provider]`.
- **Staking** — users deposit into a **MultiVault** position on an Atom or Triple along a
  **bonding curve** (`LinearCurve`, `ProgressiveCurve`, `OffsetProgressiveCurve`) and receive
  shares. Signal = aggregate stake for/against a triple.

Their trust model is explicitly **"many-to-one non-deterministic attestations"**: no authority,
"truth emerges from collective validation," with explicit (staked), implicit (usage) and transitive
(web-of-trust, "Reality Tunnels") trust.

## Does the staking layer add real sybil resistance? — No. It adds cost.

This is the question we were asked and the answer is unambiguous:

- Staked signal is **capital-weighted**, not person-weighted. One whale outvotes ten thousand
  humans. That is plutocracy, and plutocracy is the *opposite* of sybil resistance: a sybil farm
  with capital simply buys the position it wants. Bonding curves make it *more* expensive to move
  a heavily-staked triple, which raises the price of an attack but never bounds the number of
  identities.
- Because Atom creation is permissionless and paid, a sybil can mint **unbounded Atoms** for
  unbounded fake "people" — the cost is linear in identities, exactly the thing personhood
  protocols exist to break.
- The only sybil resistance it could ever carry is **borrowed**: if the entity staking
  `[address] - [is a unique human]` is itself a credential issuer with a real trust root, then the
  triple is worth exactly what that issuer's credential is worth, and Intuition contributes
  nothing beyond storage and discoverability. In aggregation terms it is a **transport, not a
  source** — and we must never let a triple's stake weight inflate a score, or we have built a
  pay-to-be-human oracle.
- Useful reframe for us: Intuition is a decentralized *EAS-with-a-market* (compare the EAS/Disco
  file). Same "who attested it" question, plus a price signal we should treat as noise for
  personhood purposes.

## On-chain surface

From https://www.docs.intuition.systems/docs/intuition-smart-contracts/deployments (2026-07-24):

**Base mainnet (8453)** — `Trust` (ERC-20): `0x6cd905dF2Ed214b22e0d48FF17CD4200C1C6d8A3`

**Intuition Mainnet L3 (1155)** — $TRUST is the native gas token:
- `MultiVault`: `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e`  ← the core Atom/Triple + staking contract
- `WrappedTrust`: `0x81cFb09cb44f7184Ad934C09F82000701A4bF672`
- `TrustBonding`: `0x635bBD1367B66E7B16a21D6E5A63C812fFC00617`
- `BondingCurveRegistry`: `0xd0E488Fb32130232527eedEB72f8cE2BFC0F9930`
- `LinearCurve`: `0xc3eFD5471dc63d74639725f381f9686e3F264366`
- `OffsetProgressiveCurve`: `0x23afF95153aa88D28B9B97Ba97629E05D5fD335d`
- `AtomWalletFactory`: `0x33827373a7D1c7C78a01094071C2f6CE74253B9B`
- `AtomWalletBeacon`: `0xC23cD55CF924b3FE4b97deAA0EAF222a5082A1FF`
- `AtomWarden`: `0x98C9BCecf318d0D1409Bf81Ea3551b629fAEC165`
- `SatelliteEmissionsController`: `0x73B8819f9b157BE42172E3866fB0Ba0d5fA0A5c6`
- Upgrades TimelockController: `0x321e5d4b20158648dFd1f360A79CAFc97190bAd1`;
  Parameters TimelockController: `0x71b0F1ABebC2DaA0b7B5C3f9b72FAa1cd9F35FEA`
- `EntryPoint` (4337): `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`; `Multicall3` at the canonical
  `0xcA11bde05977b3631167028862bE2a173976CA11`

**Base Sepolia (84532)**: `TestTrust` `0xA54b4E6e356b963Ee00d1C947f478d9194a1a210`,
`BaseEmissionsController` `0xC14773Aae24aA60CB8F261995405C28f6D742DCf`.
**Intuition Testnet L3 (13579)**: `MultiVault` `0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91`, etc.

Contracts are **timelock-upgradeable** (two TimelockControllers). ABIs are published in
https://github.com/0xIntuition/intuition-contracts-v2/tree/main/abis, and there are two
**Consensys Diligence audit reports** committed in `audits/`
(`Diligence-Audit-Report-1.pdf`, `Diligence-Audit-Report-2.pdf`) — better audit hygiene than most
protocols in this file.

### Documented production incident (good, they publish these)

`intuition-contracts-v2/POST-MORTEM.md`: on **2025-11-18**, ~1 minute after epoch 0 ended, an
`increase_amount(50e18)` call created a VotingEscrow checkpoint past the epoch boundary and caused
an **unsigned underflow (`Panic(0x11)`) in `VotingEscrow._supply_at`**, so **every `claimRewards`
call reverted** thereafter. Breaking tx
`0xd239a60b0d3f24b4384657184cd8256ae9d15fbf6c3e7bc450dd19d232f3b5f6`, block 115261, on
`TrustBonding` `0x635bBD1367B66E7B16a21D6E5A63C812fFC00617`; fix in PR #126. Reward-claiming, not
graph data, was affected. Three weeks into mainnet. Relevant to us only as a liveness/maturity
datapoint.

## Integration surface

- **Off-chain indexer/backend:** `0xIntuition/intuition-rs` (Rust + Postgres, 38 stars,
  last push 2026-07-14) — this is how you actually read the graph at scale rather than via RPC.
- **TypeScript monorepo:** `0xIntuition/intuition-ts` (33 stars, 2026-06-30) and
  `0xIntuition/packages`. UNVERIFIED: exact npm package names/versions — read
  `intuition-ts/packages/*/package.json`.
- **GraphQL API:** UNVERIFIED endpoint URL; the docs site (`www.docs.intuition.systems`) has an
  API section — check there and in `intuition-rs`'s hasura config.
- **MCP server:** `0xIntuition/intuition-mcp-server` (2026-03-31) and `agent-skills` (2026-07-20,
  21 stars) — they are aggressively courting the AI-agent integration path, plus
  `vital-agent-registry` and `intuition-github-action`.
- **Chrome extension:** `0xIntuition/chrome-extension` (153 stars, 2026-05-05) — "Building a Safer
  Web, Together." Their consumer surface.
- Portal: https://portal.intuition.systems (HTTP 200, 2026-07-24).

## Privacy model

**None. This is the opposite of ZK.** Atoms, Triples, and stake positions are public on a public
chain, attributable to the staking address. Publishing `[wallet] - [is a unique human] - [true]`
to Intuition **deanonymizes the very fact that Holonym/Billions went to great lengths to keep
app-scoped and private.** If we ever publish humanity assertions here, they must be about
pseudonymous, app-scoped identifiers and never about a user's main wallet. Flagging this loudly
because "publish our score to Intuition" is a superficially attractive idea that quietly destroys
the privacy properties of every upstream credential.

## Scoring-relevant facts

- No personhood tiers, no expiry semantics for personhood, no revocation of a "human" claim beyond
  people un-staking.
- 244k beta participants / 5M+ pre-mainnet attestations (their number, secondary source,
  pre-2025-10-29). UNVERIFIED: post-mainnet actives. Computable ourselves from `MultiVault` events
  on chain 1155 if we ever care.
- $TRUST is required for Atom/Triple creation and staking ⇒ a real per-claim cost to any writer.

---

# Cross-cutting: what these credentials actually bottom out in

The brief asked us to flag anything whose credential is ultimately **a KYC vendor check** or
**a face scan**. Answer, with evidence:

| Protocol | Credential | Real trust root | Class |
|---|---|---|---|
| Billions | Proof of Uniqueness | **Face liveness scan** (vendor UNVERIFIED) | **face** |
| Billions | Verified Human | Face scan + **identity document check** | **face + KYC vendor** |
| Holonym/Human ID | `biometrics` | **FaceTec** 3D liveness + `/3d-db/search` 1:N dedup, self-hosted at `facetec-server*.holonym.io` | **face** |
| Holonym/Human ID | `gov-id` / `kyc` | **Onfido, Sumsub, iDenfy, Veriff** (all four wired into `id-server`) | **KYC vendor** |
| Holonym/Human ID | `zk-passport` | ICAO passport PKI (NFC chip, no vendor) | **state PKI** — genuinely independent |
| Holonym/Human ID | `phone` | Telco / SMS | weak |
| Holonym | Clean Hands | AML/sanctions screening | compliance, not personhood |
| Silk / Human Wallet | — | none of its own; a wallet UI over the above | n/a |
| Sismo | ZK Badge / `vaultId` | **Commitment Mapper** (a trusted AWS Lambda) over ECDSA/OAuth account proofs | account control, dead |
| Unitap | — | consumes **BrightID** (social graph) + **Gitcoin/Human Passport** + captcha | n/a |
| Intuition | Triple + stake | **whoever staked it**, weighted by capital | none |

### Correlation warnings for the scoring model

1. **The face cluster.** Billions PoU, Holonym `biometrics`, and (per the sibling file) zkMe are
   all "a camera looked at you." Different vendors, but the same attack surface: presentation
   attacks, deepfake injection, and paid-farmer enrolment. They are **not** independent evidence.
   Cap the combined contribution of the whole cluster at roughly what one good face credential is
   worth, plus a small bonus for vendor diversity.
2. **The IDV-vendor cluster.** Holonym `gov-id`, Billions "Verified Human", Civic and zkMe KYC all
   resolve to a small set of commercial vendors — and Holonym alone uses four of them. A user who
   passed Onfido for Holonym and Onfido for someone else has one piece of evidence, not two. If we
   can learn *which* vendor signed, we should; if we cannot, assume overlap.
3. **The passport-PKI cluster.** Holonym `zk-passport` shares its root with Self.xyz, Rarimo and
   zkPassport — the same physical document and the same CSCA/DSC signatures. Never additive.
   But note this is the *only* root in this file that does not depend on a company staying
   solvent, which makes it the most durable thing we can build on.
4. **Sismo and Intuition contribute no root at all.** Sismo is dead; Intuition's stake weight is
   capital, and capital is the thing sybils have.
5. **Every "trustless ZK identity" here has exactly one centralized issuance oracle**: Sismo's
   Commitment Mapper (AWS Lambda), Holonym's `UserVerifications` MongoDB collection + issuer key,
   Billions' issuer DID on a chain Billions runs. ZK protects the *verifier* from learning who you
   are; it never removes the issuer's power to mint. Any claim we make about decentralization must
   be scoped to the verification path, not issuance.

### Liveness triage summary (2026-07-24)

| Project | Verdict | Hardest evidence |
|---|---|---|
| **Billions** | **Live, well-funded, shipping** | org pushes through 2026-07-09; chain 45056 live; TGE 2026-05-04 |
| **Holonym / human.tech** | **Live**, rebranded, identity is no longer the focus | `id-server` push 2026-07-23; `api.holonym.io` answers today; legacy `*.holonym.id` sites dead/502 |
| **Silk / Human Wallet** | **Live**, now "WaaP" | npm `@silk-wallet/silk-wallet-sdk` 1.0.2, 2025-10-08; docs redirect to `docs.waap.human.tech` |
| **Unitap** | **Semi-abandoned** | backend last commit 2025-06-30; `/gastap` returns HTTP 500; footer "© 2025" |
| **Sismo** | **Dead** | `sismo.io` is a parked-domain lander; docs/apps subdomains do not resolve; capital returned to investors in 2023 Q4 |
| **Intuition** | **Live**, mainnet 2025-10-29 | pushes 2026-07-24; chain 1155 answers `eth_chainId`; two Diligence audits |

### If we only do one thing from this file

**Integrate `api.holonym.io`.** It is the only credential here we can read permissionlessly from a
wallet address in a single unauthenticated GET, with an on-chain fallback we control
(`isUniqueForAction` on Optimism). Weight it as a KYC/face credential, prefer `zk-passport` when
present, resolve the allow-sybils question before trusting `biometrics`, and score `phone` at
approximately zero.

---

# References

**Holonym / human.tech / Silk**
- https://github.com/holonym-foundation — org repo listing with push dates (via `gh api`), 2026-07-24
- https://github.com/holonym-foundation/holonym-api — REST API README, endpoints
- https://github.com/holonym-foundation/holonym-api/blob/main/src/constants/contractAddresses.js
- https://github.com/holonym-foundation/holonym-api/blob/main/src/constants/misc.ts (issuers, circuit IDs, Stellar SBT)
- https://github.com/holonym-foundation/id-server — KYC vendor routes (`onfido`, `sumsub`, `idenfy`, `veriff-kyc`), `facetec` routes, `allow-sybils` services
- https://github.com/holonym-foundation/id-server/blob/main/docs/solutions/security-issues/sandbox-kyc-endpoints-leak-into-live-userverifications-2026-04-28.md
- https://github.com/holonym-foundation/id-hub-contracts/blob/main/contracts/Hub.sol
- https://docs.id.human.tech/ (was `docs.holonym.id`, 301) and https://docs.waap.human.tech/ (was `docs.silk.sc`, 307→301)
- https://www.npmjs.com/package/@silk-wallet/silk-wallet-sdk — v1.0.2, 2025-10-08 (registry metadata)
- Live probes 2026-07-24: `GET https://api.holonym.io/attestation/attestor` → `{"address":"0xa74772264f896843c6346ceA9B13e0128A1d3b5D"}`; `GET https://api.holonym.io/sybil-resistance/gov-id/optimism?...` → `{"result":false}`

**Billions Network**
- https://billions.network/ — homepage + embedded schema.org (user counts, founder, founding date), 2026-07-24
- https://github.com/BillionsNetwork/docs — developer docs source (`billions-wallet/overview.mdx`, `agents/identity-overview.mdx`, `billions-wallet/login-with-billions.mdx`)
- https://github.com/BillionsNetwork/verified-agent-identity/blob/main/scripts/shared/constants.js — chainId 45056, RPC, state contract, issuer DIDs, schema ID
- https://github.com/BillionsNetwork/x402-human-proof-js , https://github.com/BillionsNetwork/erc-8004-contracts
- https://www.privado.id/blog/privado-id-introduces-billions-the-first-global-human-ai-network (2025-02-28, primary-ish/vendor blog)
- https://billions.network/blog/proof-of-uniqueness-on-token-distribution-billions-x-lagrange (vendor blog; "Liveness Face Verification")
- https://venturebeat.com/business/billions-network-launches-universally-accessible-verification-platform-for-humans-and-ai (secondary)
- https://www.biometricupdate.com/202511/billions-network-ceo-calls-blockchain-powerful-tool-for-age-assurance-privacy (secondary, 2025-11)
- Live probes 2026-07-24: `eth_chainId` @ `https://rpc-mainnet.billions.network` → `0xb000`; `eth_blockNumber` → `0x62d35d`
- $BILL TGE 2026-05-04 — secondary only: https://www.coingabbar.com/en/crypto-currency-news/billions-network-airdrop-listing-date-may-4-claim-bill-tokens , https://coinmarketcap.com/currencies/billions-network/

**Unitap**
- https://github.com/UnitapApp — repo push dates
- https://github.com/UnitapApp/unitap-backend/blob/main/core/constraints/__init__.py — full constraint registry
- https://github.com/UnitapApp/unitap-backend/blob/main/core/constraints/bright_id.py , `.../gitcoin_passport.py`
- Live probes 2026-07-24: `unitap.app/gastap` → HTTP 500; `/tokentap`, `/prizetap`, `/about` → 200
- https://forum.metacartel.org/t/grant-proposal-unitap-the-gateway-to-web3-networks-and-communities/2725 (historical, secondary)

**Sismo**
- https://github.com/sismo-core — repo push dates (last meaningful activity 2024-12-31)
- https://github.com/sismo-core/sismo-docs/blob/main/data-vault/vault-and-proof-identifiers.md — `vaultId` formula and properties
- https://github.com/sismo-core/sismo-docs/blob/main/data-vault/commitment-mapper.md — trusted-service security model
- https://github.com/sismo-core/sismo-badges — badge contracts (last commit 2023-10-03)
- https://github.com/sismo-core/sismo-connect-packages — SDK (dead end-to-end)
- https://www.thebigwhale.io/article/exclusive-sismo-in-difficulty-could-soon-be-shut-down (2023-11-16, secondary — the post-mortem reporting)
- https://www.coinlive.com/news-flash/389359 (secondary; $10.5M / 130 investors / 51% returned)
- https://sismo.mirror.xyz/MimvqFv45hohMwDBD9rGqY4XGZIHRR8On7nx6q9YFRc (ZK Badges sunset post — **403 to automated fetch**, Cloudflare; read manually if you need the exact numbers)
- https://dune.com/martingbz/sismo-zk-badges (historical usage)
- Live probes 2026-07-24: `sismo.io` body contains `window.LANDER_SYSTEM="PW"` / `{ap:"parking"}`; `docs.sismo.io` and `apps.sismo.io` → HTTP 000

**Intuition**
- https://www.docs.intuition.systems/docs/intuition-smart-contracts/deployments — all addresses/chain IDs
- https://github.com/0xIntuition/intuition-contracts-v2 — ABIs, `audits/Diligence-Audit-Report-{1,2}.pdf`, `POST-MORTEM.md` (2025-11-18 incident)
- https://github.com/0xIntuition/intuition-docs/blob/main/docs/_data/intuition-concepts/trust-mechanisms.md
- https://github.com/0xIntuition/intuition-rs , https://github.com/0xIntuition/intuition-ts , https://github.com/0xIntuition/intuition-mcp-server
- https://github.com/0xIntuition/intuition-whitepaper
- https://cryptobriefing.com/intuition-mainnet-launch-trust-token/ (2025-10-29, secondary — mainnet date, $8.5M raise, 244k beta participants)
- Live probes 2026-07-24: `eth_chainId` @ `https://rpc.intuition.systems` → `0x483` (1155); `explorer.intuition.systems` (Blockscout) HTTP 200
