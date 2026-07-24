# Commercial identity/sybil-score products: Human Passport, Civic, Fractal ID, zkMe, Galxe Passport

*Researched 2026-07-24. All URLs and HTTP statuses checked on that date.*

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

## Stamp-by-stamp trust roots, and what we would double-count (coordinator request)

**Direct answer on World ID: Human Passport does NOT have a World ID / Worldcoin stamp.**
Verified 2026-07-24 three ways: (a) `gitcoin_passport_weights.py` on `main` contains no `World*`,
`Orb*` or Worldcoin key; (b) no `platforms/src/Worldcoin/` or `platforms/src/WorldID/` directory
exists in `passportxyz/passport` (all four candidate paths 404); (c) the authoritative platform
registry `platforms/src/platforms.ts` on `main` lists exactly:
`GtcStaking, Gitcoin, Discord, Google, Github, Linkedin, Ens, Brightid, ETH, Snapshot, NFT, ZkSync,
Lens, GnosisSafe, Coinbase, GuildXYZ, Idena, Civic, TrustaLabs, Outdid, AllowList, Binance,
CustomGithub, CustomNFT, CleanHands, HumanIdKyc, HumanIdPhone, Biometrics, ZKEmail, X, Steam`
(+ `POAP` behind the `NEXT_PUBLIC_FF_NEW_POAP_STAMPS` feature flag). No Worldcoin.
So **there is no World-ID-through-Passport double-count path today.** If Worldcoin were ever added
it would be a re-check point; World ID 4.0's `rp_context` / Developer-Portal signing key
requirement (2026-04-17) would in any case force Passport to register as a relying party, which is
visible if it happens.

**Important discrepancy to be honest about:** the open-source `gitcoin_passport_weights.py` is
**stale relative to the shipped app**. It has no entry for `Outdid`, `ZKEmail#*`, `Steam`,
`AllowList`, `CustomGithub` or `CustomNFT`, all of which are live platforms in `platforms.ts`. So
the published weight file is a *good* but not *complete* picture; live weights presumably come from
the scorer's database/admin. `UNVERIFIED:` current weights for Outdid / ZKEmail / Steam — would
need an API key and a call to `GET /registry/stamp-metadata` (which returns
`401 {"error":"Invalid API Key"}` unauthenticated, tested 2026-07-24).

### Trust-root classification (⚠ = overlaps something we would plausibly consume directly)

| Stamp (provider key) | Weight | Real evidence underneath | Overlap risk |
|---|---|---|---|
| `HolonymGovIdProvider` (UI: "Government ID", $5 + gas) | 16.026 | **Holonym / human.tech** gov-ID + camera check via `@holonym-foundation/human-id-sdk` | ⚠⚠ Holonym/Human ID — and Passport's **owner** |
| `Biometrics` ($5 + gas) | 6.001 | **Holonym**, `id.human.tech/biometrics`, **FaceTec** 3D facial liveness | ⚠⚠ Holonym; also same FaceTec vendor as several others |
| `CleanHands` ("Proof of Clean Hands", $5 + gas) | 3 | **Holonym** sanctions screening on top of a gov-ID check | ⚠⚠ Holonym; not personhood at all — it is an AML screen |
| `HolonymPhone` ("Phone Verification", $5) | 1.521 | **Holonym** phone/SMS | ⚠⚠ Holonym; SMS is rentable |
| `BinanceBABT` / `BinanceBABT2` (~$1) | 16.021 / 10.021 | Binance Account Bound Token = Binance's own KYC | ⚠ if we read BABT on BNB Chain directly |
| `CoinbaseDualVerification` / `...2` (free) | 16.042 / 10.042 | Coinbase account + on-chain attestation (Coinbase Verifications, Base EAS) | ⚠ if we read Coinbase Verifications directly |
| `CivicUniquenessPass` / `CivicLivenessPass` / `CivicCaptchaPass` | 5.005 / 3.038 / 0.823 | Civic — **all three retired mid-2025** (see §2). Dead weight in the file. | ⚠ same vendor thrice; also now stale |
| `IdenaState#Newbie / #Human / #Verified` | 5.892 / 1.921 / 1.924 | Idena synchronous flip-test ceremony | ⚠ if we consume Idena directly |
| `Brightid` | 0.202 | BrightID social graph verification | ⚠ if we consume BrightID directly |
| `TrustedCitizen` | 4.009 | `UNCLEAR:` which issuer — not resolved; likely a partner allow-list | ⚠ unknown |
| `TrustaLabs` | 0.511 | Trusta.AI MEDIA sybil score — **itself an ML aggregate score** | ⚠⚠ an aggregate inside an aggregate |
| `ETHScore#50/75/90`, `ETHDaysActive#50`, `ETHGasSpent#0.25`, `ETHnumTransactions#100` | 16.021 + 2.399 + 2.926 + 0.207 + 0.778 + 0.21 | Passport's own ML model over L1 activity | ⚠⚠ all six read the **same wallet history** |
| `NFT`, `NFTScore#50/75/90` | 1.032 + 16.246 + 2.362 + 2.413 | NFT holdings model — same wallet | ⚠⚠ same wallet history again |
| `ZkSyncEra`, `zkSyncScore#5/20/50` | 0.606 + 1.67×3 | zkSync activity — same wallet, different chain | ⚠⚠ |
| `SelfStakingBronze/Silver/Gold`, `Beginner/ExperiencedCommunityStaker` | 0.897/2.066/2.7, 0.673/2.161 | $GTC staking — **capital, not personhood** | — (buyable) |
| `GitcoinContributorStatistics#…10/100/1000` | 0.223 / 1.017 / 4.997 | Past Gitcoin donations — capital + history | ⚠ same wallet |
| `githubContributionActivityGte#30/60/120` | 1.879 / 1.888 / 2.259 | One GitHub account, three thresholds | ⚠⚠ one account counted thrice |
| `X` | 3.2 | One X/Twitter account | — (cheap to farm) |
| `Linkedin` / `Google` / `Discord` | 1.531 / 0.525 / 0.516 | web2 account ownership | — |
| `Ens` / `GnosisSafe` / `Lens` / `SnapshotProposalsProvider` / `GuildAdmin` | 0.208 / 0.222 / 0.23 / 0.239 / 0.468 | on-chain artefacts, all purchasable | ⚠ same wallet |
| `Outdid`, `ZKEmail#Amazon*/Uber*`, `Steam` | **no published weight** | Outdid = ZK ID verification; ZK Email = DKIM-proved receipts; Steam account | `UNVERIFIED` |

**The killer number:** four of the highest-weight stamps — `HolonymGovIdProvider` (16.026),
`Biometrics` (6.001), `CleanHands` (3), `HolonymPhone` (1.521) — are **all issued by Holonym /
human.tech through one SDK (`@holonym-foundation/human-id-sdk`)**, and Holonym **owns Passport**.
That is **26.548 points, 1.33× the "human" threshold, from a single vendor**, largely from a single
gov-ID-plus-selfie session, priced at **$15–20 + gas** in the UI's own copy. A sybil farm needs one
document and ~$10 (Gov ID $5 + Biometrics $5 → 22.03 points) to mint a "verified human" Passport
per identity — and identity documents are rentable.

**Therefore: Passport's aggregate score cannot be fed into our aggregate as a single signal.**
It is internally correlated (six wallet-activity stamps, four Holonym stamps, three Civic stamps,
three GitHub thresholds), and it contains at least one other aggregate score (TrustaLabs). We must
consume `GET /v2/stamps/{address}` or `Decoder.getPassport(address)` — **the stamp list, not the
number** — de-duplicate by trust root, and apply our own weights. Passport's scalar is useful only
as a coarse prior and as competitive intelligence.

**Also worth noting for our own decay model:** `platforms/src/HumanID/shared/utils.ts` documents a
free **ZK Passport off-chain attestation** served from `https://id-server.holonym.io`, keyed by
wallet address, `attestationType: "zk-passport"`, `payload.uniqueIdentifier` (a nullifier-like
value), with an explicit **7-day lifetime** (`expiresAt = issuedAt + 7 days`). So Holonym itself
treats an ePassport-derived personhood attestation as expiring weekly. Any protocol that treats the
same evidence as permanent is mis-modelling it.

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

**One-liner:** A KYC-backed, ZK-provable credential (currently v2.1, with a v3 KYC pipeline) issued
by Galxe after a third-party IDV check, stored as password-encrypted PII in Galxe's vault plus a
non-transferable SBT, and verifiable on-chain through Galxe's own **Identity Protocol** (a
BabyJubjub/Groth16 "babyzk" stack with registries deployed on five chains).
**Category:** **state-identity** (government ID) + **liveness** (selfie, with a re-verification
counter). **Not** uniqueness-by-construction: uniqueness is enforced by the IDV vendor's dedupe and
Galxe's database, not by anything in the credential schema.
**Chains (Identity Protocol registries):** Gravity Alpha Mainnet, Ethereum mainnet, Ethereum
Sepolia, BNB Chain, Polygon.
**Status (2026-07): live, and the most institutionally healthy of the five after Human Passport.**
Galxe claims **1M+ Passport users** and 33M+ platform users (Galxe PR, May 2025 — marketing figure,
treat sceptically). **Passport V3 launched 2025-05-07 with Sumsub** as the KYC vendor. Docs are
current (`docs.galxe.com`, Terms/Privacy last updated 2025-09-10). **But the ZK layer looks
becalmed:** npm `@galxe-identity-protocol/sdk` latest **1.0.9, published 2024-07-02** (MIT), and the
aggregated verifier is still "Sepolia only, pending NEBRA mainnet". `UNCLEAR:` whether v3's Sumsub
pipeline still issues the babyzk credential or whether Passport has quietly become a plain
KYC-as-a-service product with an SBT.
**Aggregator verdict: integrate later, low weight.** It is a real, deduped, document-backed
credential with a genuinely well-specified schema, and on-chain verification is permissionless once
you have the proof. But **the user must generate the proof for you** (their PII is
password-encrypted client-side), so we cannot passively read "is this address Galxe-verified" —
and the evidence underneath is a Sumsub/Persona check we may already be counting elsewhere.

## What it proves — read the schema, not the marketing

Galxe markets Passport as "proof of personhood". The credential schema (primary source:
`https://docs.galxe.com/identity/use-cases/galxe-passport.md`) says what it really contains.

**Galxe Passport v2.1** — registered on-chain as custom primitive **type ID 10001**:
```
birthdate:uint<64>; gender:prop<8,c,1>; id_country:prop<16,c,1>; id_class:prop<8,c,1>;
document_expiration_date:uint<64>; proof_of_time:uint<64>; last_revoke_time:uint<64>;
last_selfie_date:uint<64>; total_sefie_verified:uint<8>
```
(v2.0 is type ID **10000**, with `issue_date` and `first_verification_date` instead of
`document_expiration_date` / `proof_of_time` / `last_revoke_time`.)

Three fields are genuinely good ideas we should steal:
- **`proof_of_time`** — the delta between first and most recent verification. "If a user first
  verified their government ID in 2022 and re-verified their selfie in 2024, the time delta is 2
  years, increasing confidence in the user's authenticity." **This is an age-of-identity signal
  that a freshly-minted sybil cannot fake**, and it is the single cheapest anti-farm heuristic in
  this whole document.
- **`total_sefie_verified` + `last_selfie_date`** — a *count* of liveness re-checks and a
  freshness timestamp. Repeated liveness over time is much stronger than one selfie.
- **`last_revoke_time`** — revocation is in the schema, so a verifier can penalise a
  re-registered identity.

What is **absent**: any nullifier, uniqueness flag, or dedupe assertion. The `id_class` enum is
extremely permissive — 27 document types including `MunicipalID`, `VoterID`, `WorkPermit`,
`CanadaHealthInsuranceCard`, `ImmigrationVisa`, and `IndiaPermanentAccountNumberCard`. **A
Galxe Passport does not mean "passport"**; it can mean a municipal ID. If we score it, we should
read `id_class` and `id_country` and weight by document strength and by the issuing country's
document-security level — Galxe hands us those fields precisely so we can.

## Trust root — and a straight answer on the vendor question

**Galxe does not do identity verification. It resells someone else's.**
- **Persona (`withpersona.com`)** — v2/v2.1. The `id_class` enum links directly to
  `docs.withpersona.com/reference/government-id-verifications#government-id-types`, and the
  credential's `attachments` block contains a literal **`persona_id`** field.
- **Sumsub** — v3 (announced 2025-05-06/07). The Galxe Passport data-flow doc
  (`docs.galxe.com/galxe-id/galxe-passport/introduction.md`) now describes the flow end-to-end as:
  Galxe generates a UUID → passes it to **Sumsub** as `externalUserId` → Sumsub does the ID check
  and dedupes under that UUID → on `reviewAnswer: "GREEN"` Galxe pulls the full applicant record
  (name, dob, country, `idDocs[]` with document number) via the Sumsub API and builds the credential.

So the **trust root of Galxe Passport is a Sumsub (formerly Persona) applicant record**, and the
uniqueness property is "Sumsub says this applicant is not a duplicate". That is the same trust root
as an unknown number of other products (see cross-cutting section).

**Failure modes:**
- Whatever defeats Sumsub defeats Galxe Passport: document forgery (Galxe's competitor zkMe openly
  says document verification is "the lowest assurance level… as generative AI makes document
  forgery increasingly trivial"), injection attacks on the selfie step, and **document rental**
  markets in low-cost jurisdictions.
- **Galxe holds the join key.** Galxe stores a "Vendor Reference ID" (the Sumsub UUID) in its own
  database mapping a Galxe account to a Sumsub applicant. The PII itself is client-side encrypted
  under a user password, which is good — but the *linkage* wallet↔applicant is Galxe's plaintext.
  Compare the Fractal ID breach: the linkage is the dangerous asset.
- **Password loss = credential loss.** User-chosen password encryption with no recovery is a real
  support/attrition failure mode and a reason claimed user counts overstate live credentials.
- Galxe Passport was heavily used for Galxe's own quest/airdrop ecosystem, which is *the* natural
  habitat of airdrop farmers. Assume adversarial pressure on it has been high.

## On-chain surface

Source: `https://docs.galxe.com/identity/resources/contracts.md` (fetched 2026-07-24). Same
addresses across **Gravity Alpha Mainnet, Ethereum mainnet, Ethereum Sepolia, BNB Chain, Polygon**:

| Contract | Address |
|---|---|
| Type Registry | `0x77dA3Cf4418009D171B4963db815Ca46d6F2E79D` |
| Context Registry | `0x42D6444840842F0484C1624899c9a3E835738592` |
| Issuer Registry | `0xc4525dA874A6A3877db65e37f21eEc0b41ef9877` |
| BabyzkDefaultPublicSignalGetter | `0x1418b5e79eE53396dE4a454d78DF2ab522CE24CC` |
| **BabyzkStatefulVerifier** | `0xF3D3404eb75D076Ab8A0F728C7FAA3c0A5e6549F` |
| AggregatedBabyzkStatefulVerifier | `0x217F3a88653F84C26ce159BC5417d9A54e6eA7F1` — **Sepolia only**, pending NEBRA mainnet |

Source: `github.com/Galxe/identity-protocol/tree/main/packages/evm-contracts` (MIT).
Type artifacts (circuit/verification key) for v2.0 are pinned on IPFS:
`ipfs.io/ipfs/QmZ4UghikEohVtpJaiAQorBeHNPFZ9vq5TfnE8jTAyLU9k`.

**How verification works, and the decisive limitation:** the on-chain `BabyzkStatefulVerifier`
checks a Groth16 proof against the type/context/issuer registries and the issuer's public key —
this is **permissionless**: anyone can verify a Galxe Passport proof without Galxe's cooperation,
and the registries are public. **But the proof is generated client-side from the user's decrypted
credential.** There is no public mapping `address → hasGalxePassport` that we can index. So:
- **Interactive integration (user present, in our flow): yes, no vendor cooperation needed.** We
  define a context, ask the user's Galxe credential to produce a proof, verify against
  `BabyzkStatefulVerifier`. This is the good path.
- **Passive/background scoring of an arbitrary address: no.** Would require Galxe's API.
`UNVERIFIED:` the Galxe Passport **SBT** contract address(es) — the docs describe an SBT minted to
the user's wallet, but I did not find a published address. If such an SBT is a standard
non-transferable ERC-721 it *would* give us a passive read. Next place to look: `app.galxe.com/passport`
mint transaction on BNB Chain / Gravity explorer, or the `evm-contracts` package.

## Integration surface (Galxe platform API — separate from the ZK protocol)

- GraphQL endpoint `https://graphigo-business.prd.galaxy.eco/query`, access-token auth.
- **Free tier: 10 QPS, 100,000 requests/month.** `HTTP 429` on breach of either.
  Enterprise: "up to 1000+ QPS", 10M requests/month, SLA. (Primary source:
  `docs.galxe.com/galxe-integration/resources/rate-limits.md`.) **This is the most concretely
  documented rate limit of any vendor in this file** — useful benchmark for our own tiering.
- `@galxe-identity-protocol/sdk` (MIT, npm, v1.0.9 2024-07-02) for credential/proof handling;
  monorepo also ships a CLI, a GRPC `issuer` microservice, and `sstyper` (self-sovereign credential
  type setup). **The issuer service being open source means we could in principle become an issuer
  of our own credential types on Galxe's registries** — interesting as a distribution channel.
- "Sign in with Galxe" OAuth exists (`docs.galxe.com/galxe-id/galxe-id-integration/galxe-id-oauth.md`),
  claiming 14M Galxe ID users — that is Galxe *accounts*, not verified humans. Do not confuse them.

**Usable outside the Galxe quest ecosystem?** Technically yes — the Identity Protocol is a general
ZK credential system, the contracts are deployed on Ethereum/BNB/Polygon, and Galxe cites Transak
and Banxa as non-Galxe consumers. Practically, adoption outside Galxe looks thin and the SDK has
not shipped in two years.

## Privacy model

Better than average. PII never sits in Galxe plaintext: it is fetched from Sumsub, signed by a
"Galxe witness" for integrity, then **encrypted client-side under a user-chosen password** before
being handed back to Galxe for storage. Sharing requires a non-replayable signature plus client-side
decryption. Proofs are Groth16 over BabyJubjub with selective disclosure of schema fields (e.g.
prove `birthdate` implies 18+ without revealing it). `identity_commitment` binds the credential to a
key. Caveats: (1) Galxe still holds the wallet↔Sumsub-UUID linkage; (2) Sumsub holds the raw
documents regardless; (3) no app-scoped nullifier in the schema, so cross-app linkage prevention
depends on how the verifier defines `context`.

---

## Cross-cutting: shared KYC/liveness vendors — the double-counting problem

Another agent covers the IDV vendors themselves. What this file adds is **which of our five sits on
which vendor**, established from primary sources:

| Product | Underlying IDV / biometric vendor | Evidence |
|---|---|---|
| **Galxe Passport v3** | **Sumsub** | Galxe data-flow docs name Sumsub explicitly, with the applicant-record JSON and `externalUserId` UUID mechanic |
| **Galxe Passport v2 / v2.1** | **Persona** (`withpersona.com`) | `id_class` enum links to Persona's government-ID-types reference; credential `attachments` contains `persona_id` |
| **Human Passport → Biometrics stamp** | **FaceTec** (3D facial liveness), run by Holonym at `id.human.tech/biometrics` | `platforms/src/Biometrics/Providers-config.ts` in `passportxyz/passport` |
| **Human Passport → Gov ID / Phone / Clean Hands** | Holonym's own pipeline (`@holonym-foundation/human-id-sdk`); `UNVERIFIED:` which IDV vendor Holonym uses underneath | `platforms/src/HumanID/shared/utils.ts` |
| **Civic Pass (retired)** | Civic's own 3D face map for Uniqueness; `UNVERIFIED:` the document-check subcontractor for the IDV pass | Civic support docs (now partly 404) |
| **Fractal ID** | `UNVERIFIED:` — developer docs offline; historically a mix of in-house review and third-party IDV | — |
| **zkMe** | In-house FHE face matching; documents via own pipeline; **ePassport NFC/national PKI**; **government eIDs**: eIDAS 2.0 wallets, HK iAM Smart, Singapore SingPass/Myinfo | `docs.zk.me/hub/what/zkkyc/zkpoc/supported-eid-providers.md` |

**Two concrete double-count traps this creates:**

1. **The passport-chip trap (biggest).** zkMe's zkPassport, Holonym/Human ID's gov-ID and
   `zk-passport` attestation, and every NFC-passport protocol in our set (Rarimo, zkPassport, Self,
   …) all read **the same ICAO chip signed by the same national PKI**. One passport ⇒ N
   "independent" credentials. **Our score must key uniqueness off a document-derived nullifier
   where one is available, and cap the total contribution of the ePassport trust-root class**,
   rather than summing per-protocol.
2. **The Sumsub/Persona trap.** Galxe Passport and any other vendor reselling the same IDV provider
   dedupe against *that provider's* applicant DB. Two products on the same provider are one check.
   Conversely, two products on *different* providers genuinely are two checks against the same
   document — better, but still one document.

**And the intra-product trap, which is the one Human Passport actually fell into:** four Holonym
stamps (26.5 pts), three Civic stamps (8.9 pts), six wallet-activity stamps (~22 pts), three GitHub
thresholds (6.0 pts) — each cluster is one piece of evidence sold as three or four. **A weighted sum
over correlated signals is the failure mode of this entire product category, and it is the exact
mistake we are being paid not to make.**

---

## Aggregator verdicts (summary)

| Product | Category | Consume without vendor cooperation? | Verdict |
|---|---|---|---|
| **Human Passport** | aggregate (behavioral-heavy) | **Partly** — `Decoder.getPassport/getScore/isHuman` on 7 mainnets, but only for users who paid to mint, and stale | **Integrate now**, decomposed into stamps, never the scalar. Also our closest competitor. |
| **Civic Pass** | liveness + uniqueness + state-ID | Moot | **Skip** — retired 2025-07; docs 404, DNS dead, API dead |
| **Fractal ID** | state-identity | No — dev docs offline | **Skip**; revisit as idOS (storage layer, not a personhood claim) |
| **zkMe (MeID)** | liveness + uniqueness | **Mostly no** — `hasApproved(dappAccount, user)` is verifier-scoped; MeID may not touch chain at all | **Integrate later**, medium weight, pending the dappAccount question |
| **Galxe Passport** | state-identity + liveness | **Interactively yes** (permissionless Groth16 verify); **passively no** | **Integrate later**, low-medium weight; read `id_class`/`proof_of_time`, not the badge |

## Open questions for us

1. **Passport API commercials.** Rate limits and pricing are behind `developer.passport.xyz`
   signup. We need real numbers before assuming Passport is a cheap input. *(Action: register.)*
2. **Passport live weights vs. repo weights.** The public `gitcoin_passport_weights.py` omits
   `Outdid`, `ZKEmail#*`, `Steam`, `AllowList`. Get `/registry/stamp-metadata` with a key and diff.
3. **On-chain Passport coverage.** What fraction of the ~2M Passport users have actually minted
   on-chain, and how stale are those attestations? Answer by indexing EAS on Optimism/Base for the
   score schema — this determines whether the free on-chain read is worth anything.
4. **zkMe `hasApproved` without a dappAccount.** Test against
   `0x399488687fc3618FFaf1f5d0f61397c8E0360c02` on Ethereum whether any global/MeID-scoped read
   exists. If not, zkMe is API-only and drops in priority.
5. **Galxe Passport SBT address.** If a passively-readable SBT exists, Galxe becomes far more
   attractive. Find the mint tx from `app.galxe.com/passport`.
6. **Does Galxe v3 still issue the babyzk ZK credential?** The SDK has not shipped since Jul 2024.
   If v3 is just Sumsub + a badge, the ZK story is dead and the credential is worth less.
7. **Who does Holonym use for document IDV?** Passport's highest-weighted stamp (16.026) rests on
   it, and it determines overlap with everything else in our set.
8. **Legal status of Fractal ID GmbH**, and whether any surviving Fractal credentials are readable.
9. **Cap design.** Concretely: what is the maximum score contribution we allow from (a) the
   ePassport/national-PKI trust root, (b) any single vendor, (c) wallet-behavioural evidence? Human
   Passport's failure says these caps are the core of the product.

## References

**Human Passport**
- Stamp weights (primary, MIT): https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py
- Platform registry (primary): https://github.com/passportxyz/passport/blob/main/platforms/src/platforms.ts
- Holonym-backed stamps: https://github.com/passportxyz/passport/blob/main/platforms/src/HumanID/shared/utils.ts , `.../Biometrics/Providers-config.ts` , `.../HumanIdKyc/Providers-config.ts`
- Civic provider with retirement dates: https://github.com/passportxyz/passport/blob/main/platforms/src/Civic/Providers/civic.ts
- Civic slot IDs / gatekeeper networks: https://github.com/passportxyz/passport/blob/main/platforms/src/Civic/Providers/types.ts and `util.ts`
- Docs: https://docs.passport.human.tech/ — Stamps API, Embed, Models, Individual Verifications, Smart contracts → Contract reference
- Scoring-20 convention: https://support.passport.human.tech/passport-knowledge-base/using-passport/scoring-20-for-humans
- Acquisition by Holonym: https://human.tech/blog/from-gitcoin-passport-to-human-passport-we-re-now-part-of-human-tech (first-party blog) ; https://finance.yahoo.com/news/digital-identity-startup-holonym-acquires-203241993.html (secondary)
- Critique of stamp strength (secondary, FDD): https://hackmd.io/@jmcook/SJpaeH_3q
- Gitcoin sybil defense evolution (secondary): https://www.gitcoin.co/blog/streamlining-sybil-defense

**Civic**
- Gateway Protocol source (primary): https://github.com/identity-com/on-chain-identity-gateway — `ethereum/smart-contract/README.md` (`IGatewayTokenVerifier.verifyToken`, `Gated.sol`), `solana/gateway-ts/src/lib/constants.ts` (program ID)
- Current Civic docs sitemap (no Pass section): https://docs.civic.com/sitemap.xml
- npm: https://www.npmjs.com/package/@civic/ethereum-gateway-react , https://www.npmjs.com/package/@civic/auth
- Historical pricing (secondary, page now 404): https://www.civic.com/pricing/pass-pricing

**Fractal ID / idOS**
- Breach analysis (secondary): https://www.infostealers.com/article/infostealer-infection-results-in-data-breach-of-blockchain-identity-platform-fractal-id/ ; https://cointelegraph.com/news/blockchain-identity-platform-fractal-id-suffers-data-breach ; https://cryptoslate.com/web3-kyc-vendor-fractal-id-loses-over-50k-users-passport-info-in-data-breach/
- Fractal's own post-mortem (first-party, host now dead): https://web.fractal.id/fractal-id-data-breach-post-mortem/
- idOS: https://docs.idos.network/ ; https://github.com/idos-network

**zkMe**
- Contracts + addresses (primary): https://docs.zk.me/hub/how-built/id-infra/smart-contracts.md
- MeID: https://docs.zk.me/hub/what/zkkyc/meid.md
- Nullifiers: https://docs.zk.me/hub/how-built/credential-sys/anti-sybil-mech.md
- eID providers: https://docs.zk.me/hub/what/zkkyc/zkpoc/supported-eid-providers.md
- SDK (primary): https://github.com/zkMeLabs/zkme-sdk-js — `packages/widget`, `packages/verify-abi`
- DID method (ZetaChain testnet only): https://github.com/zkMeLabs/zkme-did-method-spec
- Docs index: https://docs.zk.me/llms.txt

**Galxe**
- Passport v2/v2.1 credential schema (primary): https://docs.galxe.com/identity/use-cases/galxe-passport.md
- Sumsub data flow (primary): https://docs.galxe.com/galxe-id/galxe-passport/introduction.md
- Contracts (primary): https://docs.galxe.com/identity/resources/contracts.md
- Rate limits (primary): https://docs.galxe.com/galxe-integration/resources/rate-limits.md
- Source (MIT): https://github.com/Galxe/identity-protocol
- Passport V3 + Sumsub launch (secondary press release, 2025-05-06): https://chainwire.org/2025/05/06/galxe-launches-passport-v3-with-sumsub-to-supercharge-web3-onboarding/
