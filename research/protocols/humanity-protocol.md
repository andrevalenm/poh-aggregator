# Humanity Protocol

> STATUS: in progress

**One-liner:** Palm-biometric "proof of personhood" network with its own EVM L2, a $H token, a node-sale
("zkProofer") operator economy, and a W3C-VC-flavoured credential (Human ID).
**Category:** claims *uniqueness*; in practice **liveness + weak uniqueness** (see below)
**Chains:** Humanity Protocol mainnet L2 (chain ID **6985385**), Humanity testnet (Rome / chain ID TBC)
**Status (2026-07):** ⚠️ **Mainnet is OFFLINE as of the current docs** — "The Mainnet is temporarily offline
following a security incident. It will be relaunched in the coming weeks with updated infrastructure."
(https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet — fetched 2026-07-24)
**Aggregator verdict:** TBD (leaning **skip / integrate later**)

---

## What it proves

### Two very different capture paths, marketed as one thing

The docs describe **two** enrollment paths under the same "biometric proof-of-humanity" banner
(https://docs.humanity.org/understanding-humanity/how-biometric-proof-of-humanity-works):

1. **Mobile app** — "scan their palm print capturing the **surface patterns of the palm**" processed by a
   **CNN machine-learning model**. This is *palm print* (an optical image of the palm surface), **not**
   palm vein.
2. **Hardware devices** — "use **infrared light to map the unique vein patterns beneath the skin**". This
   is the actual palm-vein modality, and it needs a dedicated IR sensor.

This distinction is the single most important fact for scoring this credential. The marketing is
"palm vein"; the at-scale consumer path is a **phone-camera palm-print photo**. Palm print from a
visible-light phone camera is:
- **presentable from a photograph** (a high-res photo of someone's open palm is enough raw material for a
  print-matching model, unlike subdermal vein patterns which do not appear in visible light);
- much weaker for **global deduplication** than iris — palm-print inter-class separability from an
  uncontrolled phone camera (variable lighting, pose, distance, skin condition) is materially worse than
  controlled NIR iris capture.

### The accuracy numbers are borrowed, not measured

The whitepaper's only quantitative accuracy claim is **FAR < 0.00008%, FRR 0.01%, cited to Fujitsu's
palm-vein research** (https://docs.humanity.org/whitepaper, read 2026-07-24). That is a **vendor figure for a
dedicated Fujitsu near-infrared PalmSecure sensor under controlled conditions** — it says nothing about
Humanity's own pipeline, and *certainly* nothing about their phone-camera palm-**print** CNN.

`UNVERIFIED:` Humanity has published **no** FAR/FRR of its own, no NIST/FVC-style third-party evaluation, no
PAD (presentation-attack-detection) level, and no 1:N deduplication accuracy at population scale. There is no
public operating point. **This is a hard blocker for treating the credential as uniqueness evidence.**

Note also that FAR quoted for 1:1 verification is the wrong metric for a personhood network. What matters is
**1:N deduplication error over N users**: at N = 10⁷ even a 1:1 FAR of 10⁻⁶ produces mass false matches unless
the matcher is tuned very differently — and at that tuning FRR explodes. Nobody at Humanity has published the
1:N operating curve.

### Comparison to iris (World ID)
| | Humanity (consumer path) | Humanity (hardware path) | World ID |
|---|---|---|---|
| Modality | palm **print**, visible light | palm **vein**, NIR | iris, NIR |
| Sensor | **user's phone camera** | dedicated IR device (docs describe an IR camera attached to a phone) | purpose-built Orb, custody-controlled |
| Capturable from a photo? | **Plausibly yes** — the palm surface is visible in ordinary photographs | No — subdermal veins do not appear in visible light | No (though iris photos are a known research concern) |
| Attacker controls the sensor? | **Yes** (it's their own phone) | Partly | No |
| Published FAR/FRR at scale | **None** | None (Fujitsu's number is borrowed) | Published + externally audited |
| Entropy / inter-class separability | Lowest | Middle | Highest |

The "attacker controls the sensor" row is decisive. When enrollment runs on the claimant's own device, the
security of the whole scheme reduces to **remote presentation-attack detection over an untrusted camera** —
the hardest possible setting, and one where Humanity has published nothing.

### Verdict on what it proves
- `palm_verified` via **hardware**: plausibly *uniqueness*, but the deployed population is tiny and unpublished.
- `palm_verified` via **mobile app**: at best *liveness / a human was present*, with **weak** uniqueness.
- `is_human`: **not a biometric claim at all** — Humanity's own API says it is true on **KYC pass OR** palm
  enrollment (see Integration surface). That makes it a *state-identity* claim with a shared trust root.
- Everything else in their catalogue (`*_connected`, `mc_*`) is **account-linking or financial-data
  attestation**, with zero sybil resistance.

## Trust root & failure modes

### The June 2026 $36M key compromise — and the pivot

**This dominates the entire assessment.** Timeline (secondary sources, all consistent):

- **2026-06-08/09** — Humanity Protocol confirmed a **$32–36M exploit**. Root cause was **not** a smart-contract
  bug: a **malware-infected developer laptop** exposed **7 production private keys** (1 admin hot-wallet key,
  3 Ethereum Safe owner keys, 3 BSC Safe owner keys) that had been **accidentally backed up to that machine
  during the June-2025 mainnet launch**.
  (Halborn post-mortem: https://www.halborn.com/blog/post/explained-the-humanity-protocol-hack-june-2026;
  CoinDesk: https://www.coindesk.com/tech/2026/06/09/humanity-protocol-token-crashes-more-than-80-after-a-usd32-million-private-key-hack)
- Attacker: moved 6,045,060 H with the hot key; used the **ETH Safe to push a malicious upgrade to the bridge
  contract**, draining ~141M H; used the **BSC Safe to grant itself admin and mint ~300M H**. Total ~**447M H**
  stolen/minted. H fell from ~$1.00 to ~$0.05 intraday, stabilising ~$0.20. (Halborn, ibid.;
  https://blockchain.news/news/humanity-protocol-36m-h-token-exploit)
- **Remediation:** old H retired, replaced 1:1 by a **new audited ERC-20 H** on Ethereum across Binance Alpha,
  MEXC, Bitget, KuCoin, Bybit, Gate; the **multi-chain bridge architecture was abandoned**. The new token is
  slated to be the mainnet gas token *when mainnet relaunches*.
  (https://en.cryptonomist.ch/2026/06/17/humanity-protocol-token-swap/)
- **Mainnet has been offline since.** As of **2026-07-24** the official docs still read: *"The Mainnet is
  temporarily offline following a security incident. It will be relaunched in the coming weeks with updated
  infrastructure."* (https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet)
- **Pivot:** founder **Terence Kwok** is steering the project **toward enterprise AI**, "departing from its
  original decentralized identity platform focused on Proof of Humanity". Kwok said odds of recovering the
  $36M are "low". Backers Animoca Brands and Polygon Labs remain.
  (https://cryptobriefing.com/humanity-protocol-pivots-enterprise-ai-36m-hack/ — secondary)

**Aggregator reading:** an identity network whose *entire on-chain surface is currently down*, whose operational
security put seven production keys on one laptop, and whose founder is publicly redirecting to a different
market, is not a credential source we can depend on. The security failure is also directly relevant to the
credential itself: the same class of key custody protects the **oracle/issuer keys** that mint personhood
attestations.

### Structural trust root (independent of the hack)

- **Fully centralized issuance.** `submitVerificationResult(...)` is called by their oracle/validator set;
  `updateSchemas`, `updateEAS`, `updateVerificationFee`, `pause()` are admin functions. Whoever holds the
  oracle admin key can **mint arbitrary "verified human" attestations**. Given the June-2026 key-custody
  record, treat this as a live risk, not a theoretical one.
- **zkProofer nodes are a bought seat, not a trust-minimising mechanism.** Node "licenses" were **sold in
  priced tiers** (docs: zkproofer-node/how-to-purchase-zkproofer-nodes/tiers-and-pricing) and operators
  can **delegate to NaaS providers** (e.g. EaseFlow). Buying capacity ≠ independence; a capital-rich actor
  can buy a large share of the proving set. Node operators also require **KYC** (docs:
  zkproofer-node/kyc-and-eligibility) — meaning the "decentralised" layer sits on top of a
  centrally gated, KYC'd operator whitelist.
- **The biometric itself is the weakest link on the consumer path.** A visible-light phone photo of a palm
  is (a) capturable from ordinary photographs/social media, (b) far less separable than NIR iris across a
  large population, and (c) has **no published PAD/liveness standard** from Humanity. A funded sybil farm's
  cheapest attack is not breaking crypto — it is enrolling many synthetic/borrowed palms through the mobile
  CNN path.
- **`UNVERIFIED:` document/KYC fallback.** I have not found evidence that end-user personhood enrollment
  falls back to document KYC. `KYC & Eligibility` in the docs applies to **node purchasers**, not to
  end-user palm enrollment. Flagging as UNRESOLVED — see "Overlap".

## On-chain surface

### Mainnet (currently offline)
| Field | Value |
|---|---|
| Network name | Humanity |
| Chain ID | **6985385** |
| RPC | `https://humanity-mainnet.g.alchemy.com/public` |
| Native token | H |
| Explorer | `explorer.humanity.org` |
| Chainlist | https://chainlist.org/chain/6985385 |

Source: https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet (2026-07-24)

### Testnet
| Field | Value |
|---|---|
| Chain ID | **7080969** |
| RPC | `https://humanity-testnet.g.alchemy.com/public` |

Source: https://github.com/humanity-developers/verification-airdrop-dapp `apps/web/src/config/wagmi.ts`.
Note viem ships a built-in `humanityTestnet` chain (`viem/chains`), which the reference dApp extends.

### Liveness probe (I ran this myself, 2026-07-24 ~21:55 UTC)

Both RPCs **respond and are producing blocks**, despite the docs banner saying mainnet is offline:

| Chain | `eth_chainId` | latest block | latest block timestamp | observed block time |
|---|---|---|---|---|
| mainnet | `0x6a96a9` = 6985385 ✓ | 27,691,278 | 2026-07-24T21:54:48Z | ~1.24 s (5000 blocks in ~104 min) |
| testnet | `0x6c0c09` = 7080969 ✓ | 3,935,898 | 2026-07-24T21:51:54Z | **~285 s** (5000 blocks in ~16.4 days) |

Interpretation: the mainnet **chain** is running; what is "offline" is the *user-facing network / token / bridge*
layer pending the token migration and relaunch. **Testnet is nearly idle** (5000 blocks spanning 2026-07-08 →
2026-07-24), which is a strong signal of almost no developer activity.
`UNCLEAR:` whether mainnet blocks contain real user traffic or only validator/system transactions — sampled
blocks contained 2 txs / 21,000 gas, i.e. a bare ETH transfer's worth of work.

### Canonical contracts
Docs define two canonical interfaces but the "Canonical Contracts" page **does not publish addresses**
(fetched 2026-07-24):
- **`IFeeEscrow`** — verification fees, escrow deposits, payment distribution for on-chain verification requests.
- **`IVerificationOracle`** — query user credentials on-chain, verify claims.

Addresses are published on a *different* docs page —
https://docs.humanity.org/build-with-humanity/build-on-chain/credentials-verification-service — and I
**verified every one of them on-chain myself on 2026-07-24**:

| Contract | Chain | Proxy address | Implementation (EIP-1967 slot) |
|---|---|---|---|
| HumanityVerificationOracle | mainnet 6985385 | `0x8D71D8bD47860bd0381b272AE42162c3692c4F3a` | `0x8714b31f7b2ac85494c9a641a94652a00536373a` |
| FeeEscrow | mainnet 6985385 | `0xe433f01131eAbD8060a1E34149eF0e79b2b86fEc` | `0x82fc0b3f88411cfc57be956c007ced89983d0de7` |
| HumanityVerificationOracle | testnet 7080969 | `0x67c0A5cA2Fb19E8E0Ff008d727aff5f128b00E09` | `0x4a196211e77a34da88c0933bf62ed1167fd32d77` |
| FeeEscrow | testnet 7080969 | `0x1a247b7d7076e4c4D97D87c62947Ab5495C13423` | `0x32403be364956fa61c33b2c809aa0a1c3675e0b6` |

All four are **170-byte OpenZeppelin `ERC1967Proxy` stubs (solc 0.8.20)** — i.e. **upgradeable**. A malicious
proxy upgrade is precisely the mechanism used to drain the Ethereum bridge in June 2026.

**Live state I read from mainnet (`eth_call`, 2026-07-24):**

| Getter | Value |
|---|---|
| `owner()` | `0xfB21FFF1C50440EE7F1368cb64941983940EBB5E` |
| `paused()` | `false` — **the oracle is running** |
| `verificationFee()` | `0x016345785d8a0000` = **0.1 H per verification** |
| `eas()` | `0xc1ad8256fCA18EA04FBd3E4499F345d95C321353` (EAS deployment on Humanity mainnet) |
| `requestSchemaUID()` | `0xf09808267d03260c31eabf7d9b2f98a4dc13c6b26e2bb4f2e05fc28329a8e142` |
| `resultSchemaUID()` | `0x229b8a05033b439bcdae4641ba8e0df2efc947fa532b48358cce1338acf87d7f` |

> 🚩 **`owner()` is an EOA, not a multisig.** `eth_getCode` on `0xfB21…BB5E` returns `0x` (no code); nonce 0;
> balance ~102.55 H. **A single externally-owned key owns the upgradeable proxy that issues personhood
> attestations on mainnet.** Compromise of that one key lets an attacker upgrade the oracle implementation and
> mint unlimited "verified human" attestations. This is the *same* operational-security pattern that produced
> the $36M June-2026 loss, still in place in July 2026.
> `UNCLEAR:` whether the EOA is a Safe-owner-style cold key behind an off-chain policy; nonce 0 means it has
> never transacted on this chain, so it may be a placeholder from deployment. Either way, on-chain there is
> no multisig or timelock between that key and the oracle.

### `IVerificationOracle` surface
(https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts/iverificationoracle)

Read functions an aggregator would care about:
- `isUserVerified(user, requiredClaims[], maxAge) -> (bool verified, bytes32 attestationUID, uint64 expiresAt)`
- `getRequest(requestUID) -> VerificationRequest`
- `getResult(resultUID)`
- `getUserRequests(user) -> bytes32[]`
- `resultToRequest(resultUID)`
- `getPermissionMessageHash(user, dapp, requiredClaims[], maxAge, callbackContract)`, `getUserNonce(user)`
- `decodeRequestAttestation(...)`, `decodeResultAttestation(...)`

Write / operator functions:
- `requestVerification(dapp, user, requiredClaims[], maxAge, callbackContract, userSignature) -> requestId`
- `submitVerificationResult(requestUID, verified, expiresAt, usedIssuers[], usedCategories[])`
- `revokeVerificationRequest(attestationUID)`
- Admin: `updateVerificationFee`, `updateTreasuryAddress`, `updateEAS`, `updateSchemas(requestSchemaUID, resultSchemaUID)`, `pause()/unpause()`

DApp callback: `onVerificationComplete(bytes32 requestId, address user, bool verified, bytes32 attestationUID)`

### 🔴 Actual on-chain usage — I pulled the full transaction history of the mainnet oracle

Blockscout API (`https://humanity-mainnet.explorer.alchemy.com/api/v2/...`), read 2026-07-24:

**`HumanityVerificationOracle` mainnet: 31 transactions in its entire lifetime.** Complete history:

| Date | Method | From |
|---|---|---|
| 2025-11-26 | contract creation / init | `0x33837C1E…4008c` |
| 2025-11-28 | `updateSchemas` | `0x33837C1E…4008c` |
| 2026-02-06 | **`upgradeToAndCall`** (proxy upgrade) | `0x33837C1E…4008c` |
| 2026-02-09 | `grantRole` | `0x33837C1E…4008c` |
| 2026-02-09 → 2026-02-10 | **28 × `submitVerificationResult`** | `0x65c69355…58e8` |
| **2026-07-01** | `transferOwnership` | `0x33837C1E…4008c` |

- **Total verifications ever written on mainnet: 28**, all inside a **~30-hour window on 9–10 Feb 2026**, all
  submitted by a single EOA. **Zero on-chain verifications since 2026-02-10.**
- `FeeEscrow` mainnet: **2 transactions, ever.**
- The EAS instance the oracle points at (`0xc1ad8256…1353`): **0 transactions.**
- Chain-wide mainnet: `total_addresses` = **16,863**, network utilisation 1.9e-9. (Contrast with the "8 million
  Human IDs" marketing number.) Testnet: 428,712 addresses, average block time **290,909 ms ≈ 4.8 minutes**.

**All privileged keys are EOAs** (verified via `eth_getCode` = `0x`):
- `0x33837C1E679A3474F200a027d70758444684008c` — deployer/upgrader, nonce 10,036 (a hot key)
- `0x65c6935531b8cAAC9adB6B4ec0711Ab3FDA958e8` — the credential-issuing oracle submitter, nonce 36
- `0xfB21FFF1C50440EE7F1368cb64941983940EBB5E` — current `owner()` since 2026-07-01, nonce 0

There is **no multisig and no timelock** anywhere in the personhood issuance path.

### The claim taxonomy — what Humanity actually attests today

The Credentials Verification Service exposes these `requiredClaims`
(https://docs.humanity.org/build-with-humanity/build-on-chain/credentials-verification-service, 2026-07-24):

- **Social OAuth (zero sybil resistance):** `google_connected`, `twitter_connected`, `github_connected`,
  `discord_connected`, `linkedin_connected`, `telegram_connected`, `email_verified`
- **Personhood:** `humanity_identity` ← *the only one that could carry biometric uniqueness*
- **Mastercard-sourced (`mc_` prefix):** `mc_kyc`, `mc_residency`, `mc_net_worth`, `mc_investments`,
  `mc_retirement`, `mc_mortgage`
- **Exchange:** `binance_finance`, `okx_finance`
- **Loyalty memberships:** airlines (`delta_membership`, `emirates_membership`, …), hotels
  (`marriott_membership`, `hilton_membership`, …), casinos (`caesars_membership`, `mgm_resorts_membership`, …)

The reference dApp only uses `ClaimType.IS_HUMAN = 'is_human'`
(https://github.com/humanity-developers/verification-airdrop-dapp `apps/web/src/constants/claim.ts`).
`UNCLEAR:` relationship between `is_human` and `humanity_identity` — the docs and the reference
implementation use different strings.

**Read this list carefully: it is an aggregator, not a biometric protocol.** The overwhelming majority of what
Humanity sells is *OAuth account linking and third-party data attestation*. That means **Humanity Protocol is
a competitor to us, not a credential source**, and most of its claims are things we would never score as
personhood.

**Fee (mainnet, on-chain): `verificationFee() = 0.1 H` per verification**, prepaid into `FeeEscrow`; docs say
distribution is 25% each to credential issuers / protocol treasury / staking pool / proof generation, and
"you only pay for successful verifications."

**Critical architectural findings:**
1. The oracle is built on **EAS** (`updateEAS`, `updateSchemas`, attestationUIDs) — Ethereum Attestation
   Service schemas, on their own chain.
2. **Verification is NOT permissionless and NOT free.** A dApp must (a) obtain a **user signature** over
   `(user, dapp, requiredClaims[], maxAge, callbackContract, nonce)`, (b) **pre-fund an escrow** via
   `FeeEscrow.deposit()` — reverts `InsufficientAvailableBalance` otherwise, and (c) wait for an
   **off-chain oracle operator** to call `submitVerificationResult`. There is an
   `isUserVerified(...)` view, but the result it reads was minted by their oracle.
3. Fees are "distributed to issuers, staking, and proof mechanisms" — i.e. a **rent-extracting** read path.

## Integration surface

- **`@humanity-org/react-sdk`** — React components + hooks (docs: build-with-the-sdk-api/humanity-org-react-sdk)
- **`@humanity-org/connect-sdk`** — JS/TS OAuth client
- **REST API** — "Humanity Developer Platform API" (docs.humanity.org/api-reference/…)
- Model is **"Sign in with Humanity" via OAuth 2.0 / OIDC** with scopes + "presets" → **vendor-cooperation-
  required** (client ID/secret from a Developer Portal). Not permissionless.
- Sandbox / **mock credentials** generator exists for testing. Demo hub: demo.humanity.org

### npm reality check (queried registry.npmjs.org, 2026-07-24)

| Package | Latest | First publish | Last publish | License | Downloads / last 30d |
|---|---|---|---|---|---|
| `@humanity-org/connect-sdk` | **0.2.1** | 2025-12-19 | **2026-03-04** | MIT | **89** |
| `@humanity-org/react-sdk` | **0.0.3** | 2026-03-04 | **2026-04-02** | MIT | **48** |

Both **pre-1.0**, both **unreleased since the pivot and the hack**, and combined **137 downloads/month** — i.e.
essentially zero third-party adoption. Repos: `github.com/humanity-org/humanity-sdk`,
`github.com/humanity-developers/react-sdk` (last pushed 2026-07-20).

### REST API — I probed it live (2026-07-24, both hosts return HTTP 200)

| | |
|---|---|
| Production | `https://api.humanity.org` — `/health` → `{"status":"OK - release-socrates"}` |
| Sandbox | `https://api.sandbox.humanity.org` — `/health` → `{"status":"ok","version":"0.0.0",...}` |
| Discovery | `GET /.well-known/hp-configuration`, `GET /.well-known/openid-configuration`, `GET /.well-known/jwks.json` |
| Issuer | `https://api.humanity.org/v2` |
| Authorize | `https://app.humanity.org/oauth/authorize` |
| Token | `https://api.humanity.org/v2/oauth/token` |
| Userinfo | `https://api.humanity.org/v2/userinfo` |
| Presets | `/v2/presets`, `/v2/presets/{name}`, `POST /v2/presets/batch` |
| Credentials | `https://api.humanity.org/v2/v2/credentials` *(note the doubled `/v2/v2` — theirs, not a typo of mine)* |
| Queries | `POST /v2/queries/evaluate` (declarative queries against credentials) |
| Auth | Bearer token; `client_secret_basic` / `client_secret_post`; grants `authorization_code` + `refresh_token`; PKCE supported |
| ID token | **RS256**, JWKS published → tokens are offline-verifiable once obtained |
| **Rate limit** | **`rate_limit_default: 300`, `rate_limit_unit: "requests_per_minute"`** |

**OAuth scopes (`scopes_supported`, live):** `openid`, `profile.full`, `data.read`, `identity:read`,
`identity:date_of_birth`, `identity:legal_name`, `identity:address_postal_code`, `identity:address_full`,
`kyc:read`, `kyc:document_number`, `financial:read`, `financial:net_worth`, `financial:bank_balance`,
`financial:loan_balance`.

**Claims supported:** `sub, iss, aud, exp, iat, auth_time, acr, scope, azp, authorization_id,
app_scoped_user_id, nonce`. → **`app_scoped_user_id` exists**, which is the pseudonym an aggregator should use.

### 🔴 The `presets_available` list — the single most important thing I found

Pulled verbatim from `https://api.humanity.org/.well-known/hp-configuration` (2026-07-24). The personhood-
relevant presets:

| Preset | Type | Humanity's own description (verbatim) |
|---|---|---|
| `humanity_uuid` | string | "A global UUID scoped to Humanity" |
| **`humanity_score`** | number | **"Confidence score for 'human + unique' status"** |
| **`is_human`** | boolean | **"True if passed a KYC check OR palm enrollment via mobile app or hardware"** |
| **`palm_verified`** | boolean | **"User has completed Humanity palm biometric verification"** |
| `kyc_passed` | boolean | "Overall KYC status derived from **provider results** + freshness" |
| `document_country`, `document_expiry_date`, `document_number` | | ID-document fields |
| `age_over_18` / `age_over_21` | boolean | derived from DOB |
| `proof_of_residency` / `proof_of_assets` / `proof_of_investments` / `proof_of_mortgage` / `proof_of_retirement` | boolean | **"via Mastercard Open Finance"** / "via Mastercard bank account data" |
| `google_connected`, `linkedin_connected`, `facebook_connected`, `twitter_connected`, `discord_connected`, `github_connected`, `telegram_connected` | boolean | plain OAuth account links |

> 🚩 **`is_human` is TRUE for a user who only passed document KYC — no biometric involved.**
> Humanity documents this themselves. If we consume `is_human`, we are **not** consuming a biometric
> uniqueness signal; we are consuming a KYC-vendor signal that overlaps directly with every other
> KYC-backed credential in our basket. **Only `palm_verified` is the biometric flag, and it must be
> requested explicitly.** See "Overlap".

## Privacy model

From the whitepaper (https://docs.humanity.org/whitepaper, read 2026-07-24):

- Raw palm images are "never stored"; capture undergoes **irreversible feature extraction** locally into a
  protected template.
- **Phase 1: the encrypted palm signature is stored on IPFS, with its decryption key split across
  "decentralized nodes."** → biometric templates live in a **shared, network-held escrow**, not on the user's
  device. A threshold-sized coalition of node operators is, by construction, able to reconstruct the key.
  For a network whose operators bought their seats and are KYC-gated by the foundation, that is a weak
  privacy guarantee.
- **Deduplication (1:N uniqueness) is performed by the Identity Validator** on the encrypted signature, and a
  credential is issued only on passing a "uniqueness check", framed as a **non-membership proof**. So the
  anti-sybil property rests entirely on validators honestly running 1:N matching. **A colluding validator set
  can simply assert uniqueness** and mint a credential — and on mainnet today a *single EOA*
  (`0x65c6…58e8`) has the role that writes results.
- **ZK proof system: UNSPECIFIED.** The docs never name Groth16 / PLONK / Halo2 / STARK, never publish a
  circuit, and there is **no public repo for the proving system**. "ZK" here is currently a marketing term
  with no verifiable artifact behind it. `UNVERIFIED:` next place to look would be the zkProofer node binary
  and any audit report of the proving stack — I found neither published.
- **Nullifiers: not mentioned anywhere.** There is no documented app-scoped vs. global nullifier design.
  The on-chain surface is keyed on **Ethereum addresses** (`isUserVerified(address,…)`), so from an
  aggregator's viewpoint the linkage primitive is the wallet address — i.e. **globally linkable**, not
  app-scoped and unlinkable like World ID's per-app nullifiers.
- **W3C VC / DID claims are unsubstantiated.** The docs talk about "Verifiable Credentials" and "SSI"
  conceptually but **never name a VC Data Model version (1.1 / 2.0) nor a DID method** (no `did:hmnty:` or
  similar registered/documented). `UNVERIFIED:` I found no DID method spec, no JSON-LD context URL, no
  `credentialSchema`, and no interoperability test suite. Treat "W3C verifiable credentials" as
  aspirational until a `did:` method and context are published.
- What a verifier learns on-chain: the **user's address, a boolean, the attestation UID, `expiresAt`, and
  `usedIssuers[]` / `usedCategories[]`** — i.e. which issuers were relied upon. That last field leaks the
  *provenance* of the claim to the verifier.

## Scoring-relevant facts

### The user-count story — read it carefully

The headline numbers are **reservations, not verifications**:

| Number | What it actually is | Source |
|---|---|---|
| "over 2 million" testnet participants | **testnet wallet signups**, incentivised | Messari / MEXC secondary |
| **8,000,000+ "Human IDs" issued/reserved** | Users who **signed up and referred others** to reserve a Human ID. Explicitly *not* palm-verified. | https://www.biometricupdate.com/202602/humanity-protocol-pivots-from-proof-of-personhood-but-sticks-with-palm-biometrics (2026-02); https://www.humanity.org/blog/palm-scanning-begins-on-humanity-protocol |
| **~600** | **first users to actually complete a palm scan**, June 2025 | humanity.org blog / secondary |
| "the first batch of users have successfully completed their biometric verification" | Humanity's own wording as of the *palm-scanning* blog post — **no number given** | https://www.humanity.org/blog/palm-scanning-begins-on-humanity-protocol |

**As of 2026-07 palm verification is still a waved, gated rollout**, with access granted "based on a mix of
referral activity, region, device compatibility, and waitlist position", continuing "in waves over the coming
weeks" (humanity.org blog, ibid.). `UNVERIFIED:` **no published count of actually-palm-verified unique humans
exists.** This is the single number an aggregator needs and Humanity does not publish it.

**Therefore: the 8M figure must never be used as a personhood population.** It is a referral-farmed waitlist.
An 8M waitlist against ~10^3–10^5 real biometric enrollments is exactly the marketing-vs-substance gap the
brief warned about.

### Farming pressure on the credential
The reservation mechanic was **explicitly referral-driven and airdrop-linked**, and early palm-scan access was
allocated *by referral activity*. That is a direct incentive to create many reservations per human — i.e. the
protocol's own growth loop manufactured the sybils it claims to defeat. Reservation-tier "Human IDs" are
therefore **worthless as uniqueness evidence**; only a completed biometric enrollment could count, and that
population is tiny and unpublished.
`UNVERIFIED:` I did not find a specific published forensic write-up quantifying multi-account farming of
Humanity reservations (the way e.g. Worldcoin orb-farming has been documented). Next place to look:
airdrop-analytics posts and Dune dashboards on the H distribution.

### Cost / friction
- Consumer: free, but gated by waitlist/waves + device compatibility → **cannot be acquired on demand** by an
  aggregator's user today.
- dApp verifier: **pays per verification** into `FeeEscrow`; fee set by `updateVerificationFee`. `UNVERIFIED:`
  actual fee amount and fiat pricing not published in the docs pages I read.

### Expiry / revocation
`IVerificationOracle` results carry `expiresAt` and `maxAge`, and `revokeVerificationRequest(attestationUID)`
exists → credentials are **explicitly revocable by the issuer and time-bounded**. Any cached score must
re-check.

## Overlap with other protocols

### 🚩 CROSS-CUTTING FLAG FOR THE ORCHESTRATOR — document/KYC trust-root sharing is *confirmed*, not hypothetical

The brief asked us to flag "if their verification ever falls back to document/KYC vendors." **It does, by
design, and it is baked into their primary personhood boolean.** Humanity's own live API config states:

> `is_human` — *"True if passed a KYC check **OR** palm enrollment via mobile app or hardware"*
> (`https://api.humanity.org/.well-known/hp-configuration`, read 2026-07-24)

and

> `kyc_passed` — *"Overall KYC status derived from **provider results** + freshness"*

Consequences for the aggregator:

1. **Never score `is_human` as an independent personhood signal.** It collapses into whatever KYC vendor sits
   behind it. If our basket also contains any document-KYC-rooted credential (zkPassport / Anon Aadhaar /
   Proof-of-Passport / Coinbase or Binance verification / Gitcoin Passport's KYC stamps / Civic / Fractal /
   Galxe Passport), **`is_human` is the same evidence counted twice.**
2. **Only `palm_verified` may contribute independent biometric evidence** — and only at a low weight given the
   unpublished accuracy and the phone-camera path.
3. **`mc_*` / `proof_of_*` presets are Mastercard Open Finance data** — bank-account-derived. Any other
   protocol we cover that uses open-banking (Plaid-style) verification shares that root too.
4. **`*_connected` presets are bare OAuth links.** These overlap with Gitcoin Passport's social stamps and are
   worth ~nothing for sybil resistance; a farm buys aged Google/X/Discord accounts for a few dollars each.
5. `UNVERIFIED:` **which** KYC vendor(s) sit behind `kyc_passed`. Humanity does not name them. This is the
   most important remaining question for de-duplication of trust roots — the docs only say "provider results".
   Next place to look: their privacy policy / DPA at humanity.org, sub-processor list, or the Moongate
   acquisition materials.

### Other overlaps
- **Biometric modality overlap with World ID is zero** (palm vs iris) — so in principle they are independent
  evidence *if* both are biometric. But because `is_human` is KYC-backed, the *practical* overlap is with the
  KYC cluster, not with World.
- **Moongate acquisition** brings event-ticketing/POAP-style credentialing into their stack; that overlaps
  with attendance-based credentials, which are not personhood at all.
- **Mastercard partnership** means part of their "credential ecosystem" is literally a TradFi data feed.

## Open questions for us

1. **Which KYC provider(s) back `kyc_passed` / `is_human`?** Blocking for trust-root de-duplication.
2. **How many humans have actually completed `palm_verified`?** No number is published anywhere. Without it we
   cannot size the credential. Ask their BD directly; also check whether `/v2/presets` exposes any aggregate.
3. **What is `humanity_score` numerically?** The preset exists ("Confidence score for 'human + unique' status")
   but no scale, no bands, no methodology is documented. If it's a black box we cannot use it as an input to
   our own score without laundering an unknown model.
4. **Is `is_human` == `humanity_identity` == `ClaimType.IS_HUMAN`?** Three different strings across API config,
   on-chain docs, and the reference dApp. Needs disambiguation before any integration.
5. **Will mainnet actually relaunch, and with what oracle key custody?** The current mainnet `owner()` is a
   nonce-0 EOA. Any integration should be gated on them moving to a multisig + timelock.
6. **Does the enterprise-AI pivot mean the consumer personhood product is being wound down?** Kwok's public
   statements point that way; the palm-scan rollout blog is still being updated. These are contradictory.
7. **Is there any DID method / W3C VC artifact at all?** If we ever consume their "verifiable credential", we
   need a context URL, a proof suite, and a resolvable issuer DID. None found.
8. **Documented farming of the reservation programme** — I could not find a forensic write-up. Worth a Dune
   query on the H airdrop distribution before we assign any weight to reservation-tier IDs.

## Funding, team, and momentum

- Total raised **~$50M across 3 rounds**; emerged from stealth 2024-02-20; backers **Animoca Brands,
  Blockchain.com, Polygon Labs**; latest was a **$20M round on 2025-01-27**. Team ~48 people (2026).
  (Tracxn / Decrypt — secondary: https://decrypt.co/219390/worldcoin-rival-humanity-protocol-nets-funding-from-polygon-animoca-founders)
- Founder/CEO **Terence Kwok**. Protos has reported on his previous company (Tink Labs / "handy") going
  insolvent — https://protos.com/how-humanity-protocol-ceo-drove-his-previous-firm-to-insolvency/ (secondary,
  adversarial source; treat as context not fact).
- **Node sale as a revenue line:** "Verifier Node Licenses" sold in **100 tiers from $1,000 to $10,400**,
  **25,000 licenses in phase 1** and an intended **100,000 total**, with **half of each tier reserved for
  whitelisted buyers**
  (https://docs.humanity.org/zkproofer-node/how-to-purchase-zkproofer-nodes/tiers-and-pricing). At phase-1
  volumes that is a **nine-figure retail raise for the right to run a proving node** — the "decentralisation"
  of the verification set is *purchased*, and the operator whitelist is **KYC-gated by the foundation**
  (https://docs.humanity.org/zkproofer-node/kyc-and-eligibility).
- **Momentum signals (all checked 2026-07-24):**
  - GitHub `humanity-org` (30 public repos) is **active today** — but almost entirely **forks of Uniswap,
    Safe{Wallet}, EAS and Blockscout infra** being rebranded for the L2 relaunch. The identity core
    (palm matcher, zkProofer, oracle implementation) is **closed source**.
  - `humanity-developers` last pushes: react-sdk 2026-07-20, the rest Jan–Jun 2026.
  - npm SDKs unreleased since 2026-04-02; 137 downloads/month combined.
  - On-chain oracle: **0 verifications since 2026-02-10**.
  - Docs "On-Chain Quick Start Guide" page still says **"Coming soon."**
  - Their own reference dApp's `docs/DEPLOYMENT.md` still ships **HashKey Chain testnet** addresses
    (`VITE_TOKEN_ADDRESS=0xBa3B7d3CC18cEaA52eb487fc6A2c70e798da35FF`,
    `VITE_AIRDROP_ADDRESS=0x6c1f1ab8615c495c5D92AB055d7E53c4D60F30dc`) — a copy-paste artefact indicating the
    "reference implementation" was never wired to their own chain.

## References

Primary — Humanity docs:

- https://docs.humanity.org/llms.txt (full docs index)
- https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet
- https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts
- https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts/iverificationoracle
- https://docs.humanity.org/understanding-humanity/how-biometric-proof-of-humanity-works
