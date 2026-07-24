# Long tail & newer entrants: Billions, Holonym/Silk, Unitap, Sismo, Intuition

> STATUS: in progress

Covers six small/newer/legacy projects. Deep coverage of EAS/Disco, Privado ID/Verax, and
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

- **`gov-id`/`kyc`:** the trust root is Holonym's chosen KYC vendor, not Holonym. UNVERIFIED: the
  exact vendor in 2026-07 — historically Holonym used third-party IDV providers (Persona /
  Vouched have both been named in older material). Look in
  `github.com/holonym-foundation/id-server` for the vendor SDK calls to confirm.
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

---

# Intuition

**One-liner:** TBD

---

# Cross-cutting: trust roots

TBD

# References

TBD
