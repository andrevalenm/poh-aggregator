# Commercial identity/sybil-score products: Human Passport, Civic, Fractal ID, zkMe, Galxe Passport

> STATUS: in progress

This file covers five commercial "identity score / credential as a product" vendors. These are the
closest thing to **direct competitors and prior art** for the poh-aggregator. Privado ID and Verax
are covered by a separate agent; they are mentioned here only at intersection points.

---

# 1. Human Passport (formerly Gitcoin Passport / Passport XYZ)

**One-liner:** A stamp-aggregator that mints ~50 web2/web3 "Stamps" into a single weighted 0-100
"Unique Humanity Score", read via REST API or on-chain EAS attestations.
**Category:** *aggregate* — mostly behavioral + account-ownership, with a minority of high-weight
uniqueness/state-identity stamps (Holonym gov-ID, Binance BABT, Coinbase, Civic).
**Chains (on-chain score attestations):** Optimism, Base, Arbitrum, Linea, Scroll, Shape, zkSync Era
(+ testnets). All minted to EAS; Linea attestations *also* written to Verax.
**Status (2026-07):** Live. Acquired by the **Holonym Foundation** in Dec 2024; rebranded
Gitcoin Passport → Passport XYZ → **Human Passport**, now one of three products in the
**human.tech** suite (Human Passport, Human Network, Human Wallet). Docs migrated
`docs.passport.xyz` → `docs.passport.human.tech`; support site `support.passport.xyz` →
`support.passport.human.tech` (301s observed 2026-07-24).
**Aggregator verdict:** **Integrate now — but as a *signal*, never as the humanity oracle, and
treat it as a competitor.** It is the single best-documented aggregate score in the space and it is
readable on-chain without vendor cooperation (`Decoder.getScore(address)`), which is rare. But its
score is dominated by purchasable/farmable stamps, so we must decompose it into its constituent
stamps (the API returns them) and re-weight ourselves rather than importing the 0-100 number.

## What it proves

Nothing on its own. Passport is *exactly the product category we are building*: it aggregates
heterogeneous evidence and emits a scalar. What the scalar means depends entirely on which stamps
produced it. Decomposing the published weight file (below) into BRIEF.md's taxonomy:

| Evidence class | Stamps | Max contribution |
|---|---|---|
| **state-identity** (gov ID / KYC'd exchange) | HolonymGovIdProvider 16.026, BinanceBABT 16.021 (+BABT2 10.021), CoinbaseDualVerification 16.042 (+ v2 10.042), CivicUniquenessPass 5.005, CleanHands 3 | ~76 pts of a 20-pt threshold — **any single one clears the bar 0.8×, any two clear it outright** |
| **liveness** | Biometrics 6.001, CivicLivenessPass 3.038 | 9.0 |
| **uniqueness (protocol-native)** | Idena states (Newbie 5.892 / Human 1.921 / Verified 1.924), Brightid 0.202, TrustedCitizen 4.009 | ~14 |
| **social-trust / staking** | SelfStaking Bronze/Silver/Gold 0.897/2.066/2.7, Beginner/ExperiencedCommunityStaker 0.673/2.161, GuildAdmin 0.468, Snapshot 0.239, Lens 0.23 | ~9.4 |
| **behavioral / on-chain activity** | ETHScore#50 16.021 (+#75 2.399, #90 2.926), NFTScore#50 16.246 (+#75/#90), zkSyncScore, ETHGasSpent, ETHDaysActive, ETHnumTransactions, NFT 1.032, ZkSyncEra 0.606, TrustaLabs 0.511 | **~48** |
| **web2 account ownership** | X 3.2, Linkedin 1.531, HolonymPhone 1.521, Google 0.525, Discord 0.516, github contribution tiers 1.879/1.888/2.259, Gitcoin contributor tiers, Ens 0.208, GnosisSafe 0.222, CivicCaptchaPass 0.823 | ~18 |

The single most important structural fact: **`ETHScore#50` (a purely behavioral ML model score) is
weighted 16.021 — the same as a government ID.** A wallet with enough plausible on-chain history
scores as "human" as a passport holder. That is the crux of the critique below.

## The scoring model (primary source)

Weights are published in the open-source scorer:
`https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py`
(MIT, ~179 stars). Fetched raw 2026-07-24; full contents:

```python
GITCOIN_PASSPORT_WEIGHTS = {
    "BeginnerCommunityStaker": "0.673",  "Biometrics": "6.001",
    "BinanceBABT": "16.021",             "BinanceBABT2": "10.021",
    "Brightid": "0.202",                 "CivicCaptchaPass": "0.823",
    "CivicLivenessPass": "3.038",        "CivicUniquenessPass": "5.005",
    "CleanHands": "3",                   "CoinbaseDualVerification": "16.042",
    "CoinbaseDualVerification2": "10.042","Discord": "0.516",
    "Ens": "0.208",                      "ETHDaysActive#50": "0.207",
    "ETHGasSpent#0.25": "0.778",         "ETHnumTransactions#100": "0.21",
    "ETHScore#50": "16.021",             "ETHScore#75": "2.399",
    "ETHScore#90": "2.926",              "ExperiencedCommunityStaker": "2.161",
    "GitcoinContributorStatistics#totalContributionAmountGte#10": "0.223",
    "GitcoinContributorStatistics#totalContributionAmountGte#100": "1.017",
    "GitcoinContributorStatistics#totalContributionAmountGte#1000": "4.997",
    "githubContributionActivityGte#30": "1.879",
    "githubContributionActivityGte#60": "1.888",
    "githubContributionActivityGte#120": "2.259",
    "GnosisSafe": "0.222",               "Google": "0.525",
    "GuildAdmin": "0.468",               "HolonymGovIdProvider": "16.026",
    "HolonymPhone": "1.521",             "IdenaState#Human": "1.921",
    "IdenaState#Newbie": "5.892",        "IdenaState#Verified": "1.924",
    "Lens": "0.23",                      "Linkedin": "1.531",
    "NFT": "1.032",                      "NFTScore#50": "16.246",
    "NFTScore#75": "2.362",              "NFTScore#90": "2.413",
    "SelfStakingBronze": "0.897",        "SelfStakingGold": "2.7",
    "SelfStakingSilver": "2.066",        "SnapshotProposalsProvider": "0.239",
    "TrustaLabs": "0.511",               "TrustedCitizen": "4.009",
    "X": "3.2",                          "ZkSyncEra": "0.606",
    "zkSyncScore#20": "1.67", "zkSyncScore#5": "1.67", "zkSyncScore#50": "1.67",
}
GITCOIN_PASSPORT_THRESHOLD = "20"
```

Notes for us:
- **The 20-point threshold is hard-coded in the scorer AND in the on-chain Decoder's
  `isHuman(address)`.** It originated as the Gitcoin Grants passing score for matching eligibility
  and has become an industry convention ("Passport score 20+"). It is a *policy* number, not a
  calibrated probability.
- Weights are **not** log-odds and do not compose probabilistically — they are hand-tuned integers
  the team re-tunes periodically ("Stamp Re-weight" posts; a January 2026 re-weight is referenced by
  secondary sources — UNVERIFIED, I did not find the primary changelog post; look at
  `passport.human.tech/blog` and the git log of `gitcoin_passport_weights.py`).
- Duplicated-with-decay stamps (`BinanceBABT` 16.021 vs `BinanceBABT2` 10.021,
  `CoinbaseDualVerification` 16.042 vs `...2` 10.042) look like a **deliberate devaluation of the
  older credential version** — i.e. they already learned that a static high-weight exchange stamp
  gets farmed and re-issued the stamp at a lower weight. Useful precedent for our own decay design.
- Max possible ≈ 100 by construction (docs say max 100), but no single user realistically stacks
  everything.

## Trust root & failure modes — where the scoring model proved wrong

This is the most instructive part of the whole document.

1. **The threshold is a cliff, and cliffs get optimized against.** Because 20 is binary
   (eligible / not), a farmer's objective is "cheapest basket summing to 20", not "be human". Two
   sub-20 stamps of the *same* underlying identity are worth more than one strong one.
2. **Behavioral stamps are buyable at scale.** `ETHScore#50` + `NFTScore#50` alone = 32.267 points,
   > threshold, with **zero** identity evidence — just wallet history a farmer can manufacture
   cheaply on L2s. Aged-wallet markets exist and are far cheaper than gov-ID.
3. **Stamp-farming markets.** Gitcoin's own post-round Sybil analyses repeatedly found coordinated
   clusters that had passing Passport scores. Gitcoin's response was to move *away* from relying on
   Passport alone (COCM / cluster-matching + manual review + Trusta/ML). **The builder of the
   biggest aggregate score in the space concluded the aggregate score was insufficient and added
   graph-based clustering on top.** That is the central lesson for the poh-aggregator: a scalar over
   independent-looking signals is not enough; you need cross-user correlation.
4. **Correlated stamps counted as independent.** Civic Captcha + Civic Liveness + Civic Uniqueness
   = 8.866 points from *one vendor* and largely one verification session. Similarly
   ETHScore/NFTScore/zkSyncScore are all "this wallet has activity" measured three ways. The weight
   file has no notion of covariance.
5. **KYC-provider capture.** HolonymGovIdProvider (16.026) is Holonym's own gov-ID product, and
   Holonym now *owns* Passport. A vendor grading its own credential as the joint-highest weight is a
   conflict of interest we should note explicitly when consuming their score.
6. **Revocation/expiry:** Stamps expire and must be re-verified (docs describe expiration and
   re-verification flows), so a Passport score is a *point-in-time* read — we must re-poll, not
   cache indefinitely. UNVERIFIED: exact per-stamp expiry windows (docs mention 90-day-ish for some
   web2 stamps — needs confirmation from `docs.passport.human.tech` stamp pages).

## On-chain surface (the important bit: readable without vendor cooperation)

Users may optionally **mint** their Passport/score on-chain (costs gas + a small fee). If minted,
anyone can read it permissionlessly.

**Decoder contract** (recommended entry point) — source: docs.passport.human.tech
"Smart contracts → Contract reference", fetched 2026-07-24:

| Chain | Decoder address |
|---|---|
| Arbitrum | `0x2050256A91cbABD7C42465aA0d5325115C1dEB43` |
| Base | `0xaa24a127d10C68C8F9Ac06199AA606953cD82eE7` |
| Linea | `0x423cd60ab053F1b63D6F78c8c0c63e20F009d669` |
| Optimism | `0x5558D441779Eca04A329BcD6b47830D2C6607769` |
| Optimism Sepolia | `0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56` |
| Scroll | `0x8A5820030188346cC9532a1dD9FD2EF8d8F464de` |
| Scroll Sepolia | `0x2443D22Db6d25D141A1138D80724e3Eee54FD4C2` |
| Shape | `0x2443D22Db6d25D141A1138D80724e3Eee54FD4C2` |
| Shape Sepolia | `0x2050256A91cbABD7C42465aA0d5325115C1dEB43` |
| zkSync Era | `0x1166FCDCA3B04311Ba9E2eD5ad2c660E730e1386` |
| zkSync Sepolia | `0x23AF92Af3b5D6faAD920C3CAA4F9A3d4352D6834` |

**Read functions we would call:**
- `getScore(address user)` → uint256, **divide by 10000** for the human-readable score.
- `getScore(uint32 scorerId, address user)` → score for a specific community/scorer.
- `isHuman(address user)` → bool, true iff score ≥ 20 (threshold baked in).
- `getPassport(address user)` → array of valid credentials/Stamps (lets us decompose rather than
  trust the scalar — **this is the call we actually want**).

**Deprecated/legacy path:** `GitcoinResolver` → UID → `EAS.getAttestation(uid)`.
Optimism examples: EAS `0x4200000000000000000000000000000000000021`, GitcoinResolver
`0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC`, GitcoinAttester
`0x843829986e895facd330486a61Ebee9E1f1adB1a`.
EAS schema UIDs (Optimism): Passport
`0xd7b8c4ffa4c9fd1ecb3f6db8201e916a8d7dba11f161c1b0b5ccf44ceb8e2a39`, Score
`0x6ab5d34260fca0cfcf0e76e96d439cace6aa7c3c019d7c4580ed52c6845e9c89`.
Arbitrum: Passport `0x8ae6ee946bf1c936584cacc969bf7e9d0b274631c818df7e45c246051b364341`,
Score `0x24620f482734b3806102678e4b8bb68baafb1adc1ec29e524bcd69c85f15b915`.

**Caveat that kills naive on-chain-only integration:** on-chain data only exists for users who
*paid to mint*, and it goes **stale** — the on-chain attestation reflects the score at mint time
until re-minted. So the on-chain read is a free, censorship-proof *lower bound*; the API is the
live truth. Plan for both.

## Integration surface

- **Stamps API v2**, base `https://api.passport.xyz`:
  - `GET /v2/stamps/{scorer_id}/score/{address}` — score for an address under your scorer
  - `GET /v2/stamps/{address}` — the user's stamps (decomposable evidence)
  - `GET /registry/stamp-metadata` — the stamp catalogue
- **Auth:** API key + Scorer ID, self-serve at `https://developer.passport.xyz/`.
- **Rate limits / pricing:** not stated in the public docs page; gated behind the developer portal.
  Historically there was a generous free tier with paid tiers above it. `UNVERIFIED — need to
  create a developer.passport.xyz account to see the current 2026 tiering.`
- **Passport Embed** — an embeddable React component so users verify stamps inside your dApp
  without leaving. This is **direct competition with our embedded flow**; study its UX.
  Docs: `/building-with-passport/embed/introduction`.
- **Passport Models (Model-Based Detection)** — ML classifiers scoring an address's on-chain
  activity on Ethereum L1 and several L2s for Sybil risk, **with no Passport account required**.
  This is the strategic direction: from "user collects stamps" to "we score your wallet passively".
  Docs: `/building-with-passport/models`.
- **Individual Verifications** — newer Holonym-flavoured products: gov ID, phone, biometrics and
  sanctions screening ("Proof of Clean Hands") with ZK proofs, on **Optimism, Base, Stellar**.
- Open source: `passportxyz/passport` (the app / stamp providers) and `passportxyz/passport-scorer`
  (MIT). Self-hosting a scorer is *technically* possible since the scorer is open source, but stamp
  *issuance* (the IAM server signing credentials) is the vendor-controlled part.

**Can we consume without vendor cooperation?** **Partly yes** — uniquely among the five. Minted
on-chain passports are readable by anyone via the Decoder. But coverage is limited to minters and
data is stale. Full coverage requires the API, which they can rate-limit or cut off.

## Privacy model

Stamps are W3C-style verifiable credentials signed by Passport's IAM server, holding *hashes* of
the underlying identifiers rather than the raw identifier — so the same Google account can be
detected as already used without publishing the email. Not ZK in the classic sense for the legacy
stamps; the newer Holonym "Individual Verifications" line does use ZK proofs. On-chain minting
publishes score + stamp *provider names* to EAS — i.e. **minting leaks which services you used**
(that you hold a Binance account, a LinkedIn, a gov ID) to anyone reading the chain. That is a real
privacy cost we should surface to users if we ever recommend minting.

## Scoring-relevant facts

- **~2M+ users, 35M+ credentials, 120+ integrating dApps/partners** (human.tech, at time of the
  Dec-2024 Holonym combination; date-stamp: figures are from the acquisition-era blog posts, likely
  stale by 2026-07 — treat as a floor).
- Threshold conventions: **20 = "human"** (Gitcoin Grants matching eligibility, and `isHuman()`);
  some partners use 15 or 25. Max 100.
- Cost to user: free for most stamps; gas + fee to mint on-chain; some stamps require holding
  assets (staking stamps) or a KYC'd exchange account.

---

# 2. Civic (Civic Pass / civic.me)

**One-liner:** Was a tokenised "gatekeeper network" — a non-transferable on-chain Gateway Token
minted after a CAPTCHA / video-selfie / KYC check, checkable by any smart contract. **As of 2025 the
personhood passes are retired and Civic has pivoted twice: to Civic Auth (embedded wallets/SSO),
and by 2026 to an AI-agent security platform.**
**Category (when live):** liveness + uniqueness (biometric 3D face map dedupe) + state-identity (IDV
tier).
**Chains (when live):** Solana (mainnet+devnet), Ethereum, Polygon PoS, Polygon zkEVM, Arbitrum,
XDC, Fantom (+ testnets Goerli/Sepolia/Mumbai/Arbitrum-Goerli/XDC-Apothem).
**Status (2026-07): PIVOTED / effectively dead as a personhood product.** Evidence, all checked
2026-07-24:
- Human Passport's own provider source hard-codes the retirement dates:
  `https://github.com/passportxyz/passport/blob/main/platforms/src/Civic/Providers/civic.ts` —
  `captchaDeprecationDate = 2025-07-01` ("The Civic CAPTCHA Pass has been retired as of July 1,
  2025."), `uniquenessLivenessDeprecationDate = 2025-07-31` ("The Civic Uniqueness/Liveness Pass has
  been retired as of July 31, 2025.").
- `https://docs.civic.com/pass/introduction/overview-of-civic-pass` → **HTTP 404**;
  `https://www.civic.com/pricing/pass-pricing` → **HTTP 404**.
- `docs.civic.com/sitemap.xml` (fetched 2026-07-24) contains **zero** `/pass/`, `/gatekeeper/` or
  `/civic-pass/` URLs. Sections are now `civic/` (auth), `bryn/` (agent security), `labs/`,
  `integration/` (auth SDKs), `ai-prompts/`.
- `getpass.civic.com` and `pass.civic.com` **do not resolve in DNS**.
- The old pass-lookup API `GET https://api.civic.com/pass-lookup/{address}` returns
  `403 {"message":"Missing Authentication Token"}` (AWS API Gateway's "no such route" response).
- `www.civic.com` homepage in 2026-07 markets an **"Agent Security Platform" — "the security layer
  that sits between AI agents and the tools they touch"**. No identity-verification product on the
  front page.
- npm `@civic/ethereum-gateway-react` latest 1.4.7 published **2025-04-23**;
  `@identity.com/solana-gateway-ts` latest 0.12.0 published **2023-06-26** — both stale.
  By contrast `@civic/auth` 0.15.5 published **2026-06-25** — the auth product is alive, the pass
  product is not.

**Aggregator verdict: SKIP.** The credential we would want no longer issues. Historical Gateway
Tokens may still sit on-chain but they expire and no new ones are minted for the personhood
networks. Do not build a Civic integration; do keep the *design* in mind (below), it is the
cleanest on-chain gating primitive anyone shipped.

## What it proved (and the tier semantics — worth keeping)

Passes were EIP-3525 semi-fungible "slots" on EVM and PDA-derived tokens on Solana. Slot IDs are
published in Passport's source (`platforms/src/Civic/Providers/types.ts`):

| Pass | Slot ID | What it actually proved |
|---|---|---|
| CAPTCHA | 4 | bot-resistance only. **Not** personhood. Passport weighted it 0.823. |
| IDV (ID Verification) | 6 | government ID document + liveness + sanctions screening → **state-identity** |
| UNIQUENESS | 10 | video selfie → 3D face map → **biometric dedupe**: one human ⇒ one EVM wallet + one Solana wallet. This is real uniqueness, within Civic's own enrolment database. Passport weighted it 5.005. |
| LIVENESS | 11 | video selfie, **liveness only, no dedupe** — a human was present, may hold many. Passport weighted it 3.038. |

Note how careful the distinction is: Civic separately priced *liveness* (human present) and
*uniqueness* (human present AND not enrolled before). **We should copy that split.** Passport
weighting Liveness 3.038 and Uniqueness 5.005 while also weighting CAPTCHA 0.823 means a Civic-only
user could pick up **8.87 points from one vendor and essentially one selfie session** — a clear
example of the correlated-evidence double-count we must avoid.

Known Solana gatekeeper network addresses (from Passport source, `Providers/util.ts` doc comment):
- UNIQUENESS: `uniqobk8oGh4XBLMqM68K8M2zNu3CdYX7q5go7whQiv` (slot 10)
- IDV: `bni1ewus6aMxTxBi5SAfzEmmXLf8KcVFRmTfproJuKw` (slot 6)
- Solana Gateway program ID: `gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs`
  (`identity-com/on-chain-identity-gateway`, `solana/gateway-ts/src/lib/constants.ts`)
- `UNVERIFIED:` CAPTCHA (slot 4) and LIVENESS (slot 11) gatekeeper network addresses — not found in
  a primary source; would come from archived `docs.civic.com/.../available-networks` (the live page
  is gone; the Wayback copy is a GitBook SPA that does not render server-side).

## On-chain surface (the design worth stealing)

The **Gateway Protocol** (open source, `identity-com/on-chain-identity-gateway`) is the reference
implementation of "check personhood from inside a smart contract":

```solidity
import "@identity.com/gateway-protocol-eth/contracts/interfaces/IGatewayTokenVerifier.sol";
IGatewayTokenVerifier verifier = IGatewayTokenVerifier(gatewayTokenContract);
if (!verifier.verifyToken(addressToVerify, gatekeeperNetwork)) { /* reject */ }
```
or inherit `Gated.sol` and use the `gated` modifier
(`constructor(address gatewayTokenContract, uint256 gatekeeperNetwork)`).
Networks are created on-chain via `gatewayToken.createNetwork(slotId, name, isDAO, daoAddress)` and
gatekeepers added with `addGatekeeper(gatekeeperAddress, slotId)`. Tokens are non-transferable,
have an `expiry`, and a state of `ACTIVE | FROZEN | REVOKED` — i.e. **revocation and expiry were
first-class**, which most personhood protocols still get wrong.
`UNVERIFIED:` the deployed `GatewayToken` proxy addresses per EVM chain — the repo README shows the
interface but the deployment table was in the (now-404) Civic docs. Next place to look: the
`deployments/` folder of `identity-com/on-chain-identity-gateway` on GitHub, or npm package
`@identity.com/gateway-eth-ts` which ships a default token address constant.

## Integration surface / pricing (historical)

- React SDKs: `@civic/ethereum-gateway-react` (EVM, `GatewayProvider` + `IdentityButton`,
  exposing `requestGatewayToken`, `gatewayStatus`, `gatewayToken`), `@civic/solana-gateway-react`.
- Off-chain lookup API: `GET https://api.civic.com/pass-lookup/{address|did}?includeExpired=&includeTestnets=&passTypes=UNIQUENESS,IDV,...`
  → per-wallet map of passes with `{slotId, address, name, chain, identifier, expiry, state}`.
  Supported DID lookup across all wallets bound to one DID. **Now returns 403 / route-not-found.**
- Pricing (secondary source, `civic.com/pricing/pass-pricing`, now 404; captured via search snippet
  2026-07-24 — treat as historical): **$99/month platform fee + $0.05 per active pass per month**;
  "Build Your Own" custom pass **$99 per network per month + $0.10 per API call**.
- civic.me was a Solana profile/identity front-end for the same passes. `UNVERIFIED:` current
  status of civic.me in 2026.

## Legacy value for us

Old Gateway Tokens are still on-chain and still readable via `verifyToken(addr, slot)`. Because
they carry an `expiry`, most will have lapsed. Treat any surviving `slotId 10` (UNIQUENESS) token
as **weak historical evidence with a hard decay**, not a live credential. Not worth the integration
cost on its own.

---

# 3. Fractal ID

**One-liner:** Berlin-based (founded 2017) web3 KYC provider that issued reusable
"proof-of-personhood"/KYC credentials, ran Polkadot/Gnosis/NEAR ecosystem KYC, and pivoted into
**idOS (Identity Operating System)** — a decentralised encrypted storage + access-management
network for identity data.
**Category:** **state-identity** (government ID document + selfie). Marketed at times as
"proof of personhood"; it is not uniqueness-by-construction, it is uniqueness-by-KYC-dedupe inside
one vendor's database.
**Chains:** historically Polkadot/Substrate, Gnosis Chain, NEAR, Aleph Zero, EVM. idOS storage is
its own network; an idOS "Economy Network" on an Arbitrum Orbit chain is documented as *not yet
live* (docs.idos.network, fetched 2026-07-24).
**Status (2026-07): the Fractal ID brand looks wound down; idOS is the going concern.** Evidence
checked 2026-07-24:
- `https://fractal.id/` returns **HTTP 503 "Service Unavailable"** (a static maintenance page).
- `web.fractal.id` (the blog/marketing site cited by every 2024 news article) **no longer resolves
  in DNS**; `developer.fractal.id` 301-redirects to that dead host, so the **developer docs are
  unreachable**. `docs.developer.fractal.id` does not resolve.
- `app.fractal.id` 301s to the 503 root.
- `idos.network`, `docs.idos.network`, `app.idos.network` all return **200** and are actively
  maintained.
- Fractal's own framing: "The protocol is dead, long live the protocol!" — the Fractal Protocol was
  discontinued in favour of idOS (medium.com/frctls, secondary/first-party blog).
**Aggregator verdict: SKIP as a credential source.** We cannot integrate a vendor whose developer
docs and API host are offline. Revisit only as **idOS**, and then only as a *storage/consent* layer
— idOS does not itself assert personhood, it holds someone else's KYC credential.

## Trust root & failure modes — the cautionary tale

Fractal ID is the sharpest available argument for **not centralising PII in a personhood
aggregator**, i.e. an argument about our own architecture.

**The 2024 breach (primary + secondary sources):**
- **Root cause:** an employee's machine was infected with **Raccoon infostealer on 2022-09-09**,
  leaking 500+ credentials including corporate accounts. **The password was never rotated.** Two
  years later an attacker walked in with those credentials.
  (infostealers.com / Alon Gal "Under the Breach" write-up — secondary, but the infostealer log
  provenance is specific and credible.)
- **The breach itself:** 2024-07-14, ~**2h14m** window (05:14–07:29 UTC), attacker used a
  compromised *operator* account to run an **API script** that bulk-extracted user records. So: an
  internal admin API with no rate limiting or anomaly detection on bulk export.
- **Data exposed:** names, emails, **wallet addresses**, physical addresses, phone numbers,
  **facial images**, and **photos of passports and driver's licenses**.
- **Scale — disputed:** researchers and the BreachForums listing (posted 2024-07-18) claim
  **55,000+ individuals**; Fractal's own post-mortem claims **~6,300 users (~0.5% of the user
  base)**. Both numbers are in the record; we should quote the range, not pick one.
- Remediation offered: 2 years of identity/credit monitoring for impacted users.

**Why this matters to the poh-aggregator, concretely:**
1. **Wallet addresses were leaked alongside passport scans.** That is the exact join key that makes
   a KYC leak catastrophic in crypto: it deanonymises on-chain history for 55k people permanently.
   Any aggregator that stores `wallet → PII` is building the same bomb.
2. **The linkage, not the document, is the sensitive asset.** Our design should never hold both
   sides. Prefer: hold nullifiers/hashes, never raw PII; never let *any* single operator account be
   able to bulk-export.
3. **A leaked passport corpus degrades every downstream protocol's trust root.** 55k real passport
   images in the wild are input material for injection/deepfake attacks against *other* vendors'
   document checks — including vendors used by Civic/zkMe/Galxe. Cross-protocol contagion is real.
4. **Reputational half-life is long:** two years later the company's public web presence is a 503.

`UNCLEAR:` whether Fractal ID the legal entity still operates B2B KYC under a different brand, or
whether the team fully migrated to idOS. Next place to look: idOS consortium page
(`docs.idos.network/the-idos-consortium`), German commercial register, and LinkedIn for
Fractal ID GmbH.

## Integration surface

Historically: OAuth2-style flow against `https://auth.fractal.id` with scopes for verification
levels, a `did:` / credential issued into the user's wallet, and on Polkadot an on-chain registry.
**All of this is currently unverifiable — the developer docs host is dead.** Do not plan an
integration against remembered endpoints.

idOS today: open-source SDKs on GitHub (`idos-network/idos-sdk-js`), issuer/consumer model where an
*issuer* (a KYC provider) writes an encrypted credential to idOS storage and a *consumer* (a dApp)
requests a **grant** from the user to read it. `UNVERIFIED:` current issuer roster, contract
addresses, and whether any issuer offers a *uniqueness* (dedupe) assertion rather than plain KYC.

## Overlap

Fractal ID's underlying document/selfie checks were performed by third-party IDV vendors — see the
cross-cutting section. A "Fractal ID verified" credential and a "zkMe KYC" credential can trivially
be the same Sumsub/Jumio session on the same passport.

---

# 4. zkMe

**One-liner:** A compliance-first credential vendor: **zkKYC** (document/ePassport/eID-backed KYC as
a ZK credential) plus **MeID**, a "One Face, One DID" proof-of-personhood built on FHE-encrypted
face embeddings, delivered as SBTs on ~15 mainnets and checkable on-chain via `hasApproved()`.
**Category:** MeID = **liveness + uniqueness** (biometric dedupe inside zkMe's enrolment DB);
zkKYC/PoC = **state-identity**.
**Chains (mainnet, per docs 2026-07-24):** Ethereum, Polygon, Arbitrum, Base, BNB Chain, Manta,
Ronin, Kaia, X Layer, ZetaChain, BounceBit, Aptos, Solana, TON, Neutron (Cosmos). Many more on
testnet only ("coming soon": Optimism, Scroll, zkSync, Linea, Avalanche, Mantle, Berachain, Sui,
Fantom, Plume, Lumoz, Midnight, Sei).
**Status (2026-07): live and actively developed, but pivoting toward AI-agent credentials.**
Evidence: `docs.zk.me` is current (references eIDAS 2.0 wallets due 2026, an example
`nullifierSessionID` of "Airdrop-2026-Q1", and a whole **zkKYA "Know Your Agent"** product line —
APC/ACC/AIC/ARC/APF). zk.me homepage tagline 2026-07: *"Reusable Zero-Knowledge KYC for the Agentic
Economy."* GitHub `zkMeLabs`: `zktls-*-sdk` repos updated Jan 2026, a Blockscout `frontend` fork
updated Mar 2026 — but `zkme-contracts` last updated **Dec 2024** and `zkme-circuits` **Feb 2024**.
npm `@zkmelabs/widget` latest **0.3.6, published 2025-05-16** (MIT). So: company alive, *identity
core* not much touched in 18 months, effort has moved to zkTLS and agents.
**Aggregator verdict: integrate later, and only via the on-chain read.** MeID is a genuine
uniqueness claim with a good nullifier design, and the `ZKMEVerifyUpgradeable` contracts are
deployed and publicly readable. But (a) `hasApproved(dappAccount, user)` is scoped to a *dapp
account*, so we likely need to be a registered zkMe customer for the read to mean anything about
*us*; (b) the SDK/API path requires `mchNo` + `apiKey` from `dashboard.zk.me`; (c) MeID adoption
numbers are unpublished. Low priority relative to Passport.

## What it proves — and what is actually ZK

**MeID ("One Face, One DID"), per `docs.zk.me/hub/what/zkkyc/meid.md`:**
1. liveness check → 2. face graph generation → 3. **fully homomorphic encryption** of the face
graph → 4. **encrypted face-graph cross-check** against prior enrolments → 5. unique zkMe DID
creation → 6. final report.

Assessment:
- The **uniqueness guarantee is a centralised biometric dedupe**, exactly like Civic Uniqueness or
  World ID's iris — the FHE only changes *who can read the template*, not *who decides uniqueness*.
  zkMe's servers still run the 1:N comparison. **Trust root = zkMe's enrolment database and its
  face-matching thresholds.** If it FNs, one human gets many MeIDs.
- **The FHE claim is the real cryptographic content and it is unusual** (most competitors just
  store templates encrypted at rest). But we have no audit or paper link confirming the 1:N match
  is done homomorphically at production scale. `UNVERIFIED:` there is a `zkme-python-seal` repo
  (Microsoft SEAL demo, last touched Sep 2023) and a `zkme-circuits` repo (Feb 2024) — thin
  evidence for a claim this strong. **Treat "even zkMe can't see your face" as marketing until
  audited.**
- Attack surface is the standard biometric one: presentation/injection attacks against the liveness
  step, and — relevant to the Fractal ID section — a corpus of leaked passport photos and selfies
  makes deepfake injection cheaper every year.

**Nullifiers — the best-designed part, and app-scoped (good for us):**
Per `docs.zk.me/hub/how-built/credential-sys/anti-sybil-mech.md`, the circuit's `NULLIFY` operator
(**operator code 17**) computes `Hash(userKey, credential, verifierID, nullifierSessionID)` and
emits it as a public signal. The verifier sets `nullifierSessionID` (e.g. `"Airdrop-2026-Q1"`) via
`setZkpRequest`. The contract enforces:
```solidity
function _checkNullify(uint256 nullifier, uint256 nullifierSessionID) internal pure {
    require(nullifierSessionID == 0 || nullifier != 0, "Invalid nullify pub signal");
}
mapping(uint256 => bool) public usedNullifiers;
```
So nullifiers are **scoped to (user, credential, verifier, session)** — i.e. **unlinkable across
apps**, which is the property we want. The uniqueness *registry* is explicitly left to the
application layer, not maintained by zkMe. **This is directly reusable design for our own
per-app nullifier scheme.** Note the vocabulary (`setZkpRequest`, operator codes, circom circuits)
is straight from **iden3 / Privado ID** — zkMe's GitHub carries forks of `circom`, `circuits`,
`circomlib`, `snarkjs` and `polygonId-contract`. **zkMe is an iden3 derivative**; the other agent's
Privado ID write-up covers the shared upstream.

**The "Certify" backdoor — read this before calling zkMe private.** From
`docs.zk.me/hub/how-built/id-infra/smart-contracts.md`: after Verify, a verifier may optionally
trigger **Certify**, which (with the holder's one-time signature) mints a verifier-specific SBT copy
containing **the Holder's private key shard**, "enabling the Verifier to identify the Holder when a
regulator initiates bad-actor proceedings, **even without the Holder's approval**." That is a
by-design deanonymisation escrow. It is opt-in per verifier, but it means "zkMe credential" does not
uniformly mean "unlinkable". If we surface zkMe to users we must disclose this.

## On-chain surface

Two contract families, both with published mainnet addresses (source:
`https://docs.zk.me/hub/how-built/id-infra/smart-contracts.md`, fetched 2026-07-24).

**zkMe Verify & Certify (`ZKMEVerifyUpgradeable`)** — the one an aggregator reads:

| Chain | Mainnet |
|---|---|
| Ethereum / Arbitrum / X Layer / BounceBit | `0x399488687fc3618FFaf1f5d0f61397c8E0360c02` |
| BNB Chain / Manta / Ronin / Kaia / ZetaChain | `0x3919BdCe285E82CDC6585979cfd71636b33A5582` |
| Base | `0x8c81bbc5cC9B6cdbb5c0e5DD8b9D5bfaF3575710` |
| Polygon | `0x78D247ff4543Ef08488A1127034c2cE54B12A926` |
| Solana | `6tVnLV3qrA7HddTzRGmeZs1cy5rAcTFs9sQiaoLbENAM` |
| Aptos | `0xc1e0d1fb6178f444f763bc55bda9df32b4354859925191d634a74a97924397d9` |
| TON | `EQBLZJv_DGlRJ-HqSY2yjmmGiRspStQ2G-akZVQWAcr7pUFt` |
| Neutron | `neutron19t7s6aa9289e563mu9qrx5nh80xtn4vr5afdu8yctej6f7w6k9usv87acp` |

**zkMe Mint / Delegate (the SBT itself):** Polygon Mint `0x5c2bfcf9c17CD53d55033769727196736CD188b3`
(same address reused as the Delegate on Ethereum, Base, BNB, Manta, Kaia, Ronin, ZetaChain,
BounceBit); Polygon Delegate `0x3b3364656BbB7A23133e3f26D7F6850acfaAc394`; Arbitrum/X Layer Delegate
`0x1E3D352CA8E843AC59FdE9AD605Ba1C57813Fa0b`; Solana Delegate
`6tVnLV3qrA7HddTzRGmeZs1cy5rAcTFs9sQiaoLbENAM`.

**The read we would make** (from `@zkmelabs/verify-abi` README — primary source,
`github.com/zkMeLabs/zkme-sdk-js/tree/main/packages/verify-abi`):
```typescript
import zkMeVerifyAbi from '@zkmelabs/verify-abi'
const zkMeContract = new Contract(ZKME_VERIFY_ADDRESS, zkMeVerifyAbi, provider)
const results: boolean = await zkMeContract.hasApproved(dappAccount, userWalletAddress)
```
**Critical caveat:** `hasApproved` takes a **`dappAccount`** — approval is per-verifier, not global.
So we cannot ask "is this address a unique human per zkMe?"; we can only ask "has this address been
approved *for dapp X*". To get a meaningful answer we would need either our own registered
`dappAccount` (i.e. vendor cooperation) or to enumerate known integrators' dappAccounts and read
those. `UNCLEAR:` whether a MeID-only approval is queryable without a dappAccount — worth testing
against a live contract.

Also note the zkMe **DID method** (`did:zkme:`) registry is documented as deployed **only on
ZetaChain testnet** (`github.com/zkMeLabs/zkme-did-method-spec`, README last touched May 2023). The
production identity anchor is the SBT, not the DID registry. Don't build on `did:zkme:`.

## Integration surface

- `@zkmelabs/widget` (MIT, v0.3.6, 2025-05-16) — embedded widget, `new ZkMeWidget(appId, name,
  chainId, provider, {lv: "zkKYC" | "MeID", programNo, theme, locale})`; events `kycFinished` /
  `meidFinished`. Also `@zkmelabs/kyb-widget`, `@zkmelabs/verify-abi`.
- Helper off-chain checks: `verifyKycWithZkMeServices(appId, userAccount, {programNo})` and
  `verifyMeidWithZkMeServices(...)` → `{ isGrant }`.
- REST: `POST https://agw.zk.me/zkseradmin/openapi/kyc/getUsersList` etc., body carries
  `{mchNo, apiKey, programNo, page}` — paged 50 at a time. **Requires a `dashboard.zk.me` account.**
- Mobile SDK (zkOBS), zkTLS verifier SDKs for iOS/Android (repos updated Jan 2026).
- **Notably, for MeID and cross-chain zkKYC the SDK explicitly says you do *not* need to implement
  the `delegateTransaction` methods** — meaning **MeID does not require an on-chain write**. That
  strongly implies a MeID result may exist only in zkMe's backend for many users, making the
  on-chain read useless for them. This is the key unresolved question for integrating zkMe.
- Pricing: not published. `UNVERIFIED:` per-verification cost; requires sales contact
  (`contact@zk.me`).

**Can we consume without vendor cooperation?** **Mostly no.** Contracts are public but the
`hasApproved(dappAccount, …)` scoping and the likely off-chain-only MeID make the API the real
integration path, and that is gated by `mchNo`/`apiKey`.

## Identity sources (matters for double-counting)

zkMe accepts three identity roots, documented at
`docs.zk.me/hub/what/zkkyc/zkpoc/supported-eid-providers.md`:
1. **Document verification** — zkMe itself calls this "the lowest assurance level, particularly as
   generative AI makes document forgery increasingly trivial". Their words, worth quoting to
   anyone who wants us to weight document KYC highly.
2. **ePassport NFC / national PKI** (their "zkPassport") — static data signed at issuance.
3. **Government eID** — eIDAS 2.0 EU Digital Identity Wallets, Hong Kong **iAM Smart**, Singapore
   **SingPass/Myinfo**. Highest assurance, live-registry check.

Note (2) puts zkMe on the **same trust root as every other ePassport/NFC protocol** (Rarimo,
zkPassport, Self/Holonym's passport flows, and Human Passport's `HolonymGovIdProvider`). One
passport chip can produce a zkMe credential *and* a Holonym credential *and* a Self credential —
three "independent" stamps, one document. This is the single most important overlap in this
document.

---

# 5. Galxe Passport

## Cross-cutting: shared KYC/liveness vendors (double-counting risk)
## Aggregator verdicts (summary table)
## References
