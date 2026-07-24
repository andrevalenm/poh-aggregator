# On-chain reputation & sybil-scoring products as businesses

> STATUS: in progress — research started 2026-07-24

**Scope:** the companies selling a *score* today. Trusta Labs (MEDIA / TrustScan), Nomis, Spectral
Finance, ARCx, Karma3 Labs / OpenRank, Cred Protocol, Chainlink identity/reputation, Bello,
Zerion/Arkham-style analytics, Nansen sybil work, Chaos Labs, and sybil-detection vendors sold to
airdrop teams.

**Out of scope (other agents):** the *mathematics* of scoring (see
`research/references/` scoring file) and *raw behavioural signals*. Methodology noted only where it
bears on the business.

---

## Summary table

_(to be filled at end)_

---

## Per-product write-ups

### Trusta Labs → **Trusta.AI** (TrustScan / TrustGo / AgentGo)

**What it scores and for whom.** Two distinct scores sold to two buyers:
- **Sybil Score** — probability an EVM address is part of a coordinated sybil cluster. Built with
  "AI and knowledge graphs", asset-transfer-graph analysis plus behavioural refinement; a documented
  2-phase pipeline (graph mining to find coordinated communities, then behaviour analysis to cut
  false positives). Buyer: **airdrop/token-distribution teams and L2 foundations**.
  ([docs](https://trusta-labs.gitbook.io/trustaai/products/trustscan/introduction-to-sybil-score-and-media-score))
- **MEDIA Score** — a 5-dimension *account value* score (Monetary, Engagement, Diversity, Identity,
  Age). This is **not** a personhood or sybil score; it is a user-segmentation/loyalty score sold to
  growth teams. ([MEDIA docs](https://trusta-labs.gitbook.io/trustalabs/trustgo/media-indicator-system))
- **New in the 2025–26 pivot: SIGMA Score for AI agents** (Specialization, Influence, Engagement,
  Monetary, Adoption) under the **AgentGo** product line, plus an "IDV Agent" and an **IDV MCP
  Server**. ([trustalabs.ai, fetched 2026-07-24](https://www.trustalabs.ai/))

Note the direction of travel: the company now brands itself "No.1 Identity & On-chain Reputation
Protocol… trust network for AI and crypto". The MEDIA score is no longer surfaced on the homepage;
SIGMA (agent reputation) is. **This is a pivot from human-sybil scoring to agent reputation.**

**Coverage claims (homepage, 2026-07-24, vendor-stated, unaudited):** 3M total users
(wallet-connected), 2.5M on-chain attestations, 200K MAU (EVM + TON), 570M wallets analysed,
"10+ top chains with business contracts & grants". Sybil Score chain coverage per docs: Ethereum,
zkSync, Arbitrum, BNB Chain, Optimism (with Starkware/Linea/Base/Polygon zkEVM "planned" — that
"planned" list has been stale for a long time; treat docs as partially unmaintained).

**Business model and pricing.** Free trial API key by application: *"you'll receive a trial API key
via email with 1,000 calls each for MEDIA Score and Sybil Score APIs"*; beyond that, "contact us on
Discord."
([API application doc](https://trusta-labs.gitbook.io/trustaai/products/trustscan/how-to-apply-for-trustscan-api.md))
`UNVERIFIED:` no public commercial price list exists. Revenue appears to be **foundation grants +
bespoke engagements** ("business contracts & grants" with chain foundations) rather than
self-serve API revenue. There is also a token (`TA`/Trusta tokenomics page in docs) —
`UNCLEAR:` whether the token is live and whether it substitutes for cash revenue.

**Customers / case studies.** Partner logos listed: Solana Foundation, Arbitrum Foundation,
Starknet Foundation, Gitcoin, Uniswap, TON/AliCloud hackathons. These are mostly **grant and
hackathon relationships, not paid deployments** — exactly the "logos on a landing page" failure
mode. Genuinely evidenced work: published sybil analyses of the **zkSync** NFT airdrop
([Medium](https://medium.com/@trustalabs.ai/zksync-nft-airdrop-analysis-58341d6721e1)) and an open
ML framework repo
([github.com/TrustaLabs/Airdrop-Sybil-Identification](https://github.com/TrustaLabs/Airdrop-Sybil-Identification)).
`UNCLEAR:` whether zkSync/LayerZero *paid* Trusta or whether Trusta published analyses
opportunistically for marketing. LayerZero's June-2024 ZRO filter (803,093 wallets removed of
~2.08M) is the canonical large sybil-filter engagement, but LayerZero ran a **bounty + self-report**
scheme plus Nansen and Chaos Labs — see §Chaos Labs / §Nansen.

**Funding.** Seed ~$3M; latest round a "Seed VC-II" dated **2025-06-26**, investors listed as
ConsenSys Mesh, GSR Ventures, Starknet, UFLY Labs
([Crunchbase, secondary](https://www.crunchbase.com/organization/trusta-labs)). Amount of the second
round `UNVERIFIED:`.

**Liveness (2026-07):** **Alive and pivoted.** Site live, docs live, docs restructured under a new
`trustaai` GitBook space (old `trustalabs` space still resolves — two doc trees, a maintenance
smell). `UNVERIFIED:` GitHub org commit recency — api.github.com rate-limited from this host; check
`https://github.com/orgs/TrustaLabs/repositories?sort=pushed`.

**Integration surface for us.** REST: Sybil Score API and MEDIA Score API, gated by manual
application → emailed trial key (1,000 calls each). Not permissionless. Scores are computed
off-chain; Trusta does write **on-chain attestations** (2.5M claimed) via a "Trusta Attestation
Service" — `UNVERIFIED:` which attestation standard/registry and on which chain(s); this is the one
thing worth chasing, because an on-chain-readable Trusta attestation would be consumable without
their cooperation. Look next at the Trusta Attestation Service docs page and at EAS schema
registries on Linea/Base for a Trusta issuer address.

### Karma3 Labs / **OpenRank** — **DEAD, 2026-06-16. The single most important data point in this file.**

**What it scored and for whom.** A decentralised, EigenTrust-derived reputation compute layer:
peer-to-peer trust graphs producing rankings/reputation scores as a *protocol* rather than a
closed API. Sold to protocols, wallets, launchpads and social networks (notably Farcaster
ecosystem ranking) as ranking/anti-sybil/recommendation infrastructure. Methodology is EigenTrust
— see the scoring-mathematics file, not this one.

**Funding.** $4.5M seed, announced 2024-03-01, **led by Galaxy and IDEO CoLab Ventures**, with
Spartan, SevenX, HashKey
([TechCrunch](https://techcrunch.com/2024/03/01/karma3-labs-openrank-web3-ranking/),
[CoinDesk press release](https://www.coindesk.com/press-release/2024/03/03/karma3-labs-raises-a-45m-seed-round-led-by-galaxy-and-ideo-colab-to-build-openrank-a-decentralized-reputation-protocol)).

**Traction at death (their own numbers, so the *ceiling* not the floor):**
- reputation scores for **>10M on-chain users**
- **>$50M of incentive distribution** influenced/allocated using OpenRank
- **>50 integrations** across DeFi, L1/L2s, wallets, launchpads, social

**Death.** On **2026-06-16**, founder **Sahil Dewan** announced Karma3 Labs would wind down after
3.5 years and **return remaining capital to investors**; code, protocols, docs and "lessons
learned" to be open-sourced and the GitHub repos permanently archived
([Wu Blockchain, secondary, zh](https://www.wublock123.com/news/karma3-labs-shuts-openrank-returns-funds-opensource-code-62862);
[Tencent News, secondary, zh](https://news.qq.com/rain/a/20260616A0754V00)).
`UNVERIFIED:` the original English announcement (blog/X thread) — worth pulling verbatim from
karma3labs.com or @Karma3Labs on X; the quotes below are via translation.

**The stated reason — read this twice:**
> they "validated that on-chain reputation signals can influence capital flows and user behavior,
> but never found a sustainable business model for compounding growth" … "the correct thesis does
> not automatically translate into a scalable business."

This is a company that was *right about the technology*, had 50+ integrations and touched $50M of
incentive distribution, and still could not convert that into revenue that compounds. Returning
capital rather than raising a bridge round is a deliberate, unambiguous signal: they did not
believe a later round could fix it.

**Relevance to us.** OpenRank is the closest structural analogue to a "neutral reputation layer that
everyone integrates". Its failure mode was **not** technical and **not** distribution — it was
monetisation. Assume by default that our aggregate score has the same problem unless we can name
the buyer, the budget line, and the renewal trigger.

---

### Spectral Labs (formerly Spectral Finance) — **pivoted away from credit scoring**

**What it scored, originally.** The **MACRO Score** (Multi-Asset Credit Risk Oracle), released
**August 2022**: an on-chain credit score per address, built from 150+ features over ~8 years of
Ethereum transactions and 2.5M+ borrowing events, sold to lenders for undercollateralised lending
risk. Spectral is widely credited with coining "on-chain credit score" and raised **$23M** across
rounds ([secondary](https://www.andreiponivesc.com/portfolio-page/how-spectral-finance-raised-23m-and-coined-the-term-%E2%80%98on%E2%80%91chain-credit-score%E2%80%99)).

**What it sells now.** `spectral.finance` returns **404** (checked 2026-07-24); the live property is
**spectrallabs.xyz** (HTTP 200). The product is **Syntax** — a natural-language→smart-contract
"onchain agent" platform, plus an "Inference Network" / agentic-economy positioning, with a **SPEC**
token ([secondary overview](https://phemex.com/academy/what-is-spectral-spec)). Credit scoring is at
most legacy surface area.

**Read.** $23M raised against a credit-scoring thesis, ending in a full pivot to AI agents. Note the
identical arc at Trusta (sybil scoring → SIGMA agent scoring). **Two of the best-funded on-chain
scoring companies both pivoted to agent reputation rather than doubling down on scoring humans.**
That is a market signal, not a coincidence: agent-reputation is where the 2025–26 narrative money
is, and human-behaviour scoring did not pay.

---

### ARCx — **DEAD**

The "DeFi Passport" / DeFi Credit Score (dynamic max-LTV loans on Polygon priced off a
borrowing-history credit score), backed by **Dragonfly and Scalar Capital**
([The Block, secondary](https://www.theblock.co/linked/106806/dragonfly-scalar-arcx-defi-passport)).

**Liveness evidence, checked 2026-07-24:**
- `https://arcx.money` — **TLS handshake fails** (`tlsv1 alert internal error`). DNS resolves to
  Netlify anycast IPs (75.2.70.75 / 99.83.190.102), i.e. **the domain still points at Netlify but
  no site is deployed / no certificate is provisioned**. That is the signature of an abandoned
  Netlify project whose DNS was never cleaned up.
- `https://app.arcx.money` — HTTP 200, but serves a stale SPA shell (Segment analytics snippet,
  no meaningful server-side content).
- `https://wiki.arcx.money` — HTTP 200, still a hosted GitBook. Docs outliving the product is
  normal; GitBook keeps serving until someone stops paying.
- No news, release, or funding event found for ARCx in 2025 or 2026.

**Verdict:** functionally dead. The apex marketing domain failing TLS while a docs site lingers is
about as clear as abandonment evidence gets short of a shutdown post. `UNVERIFIED:` no formal
shutdown announcement was found — check @arcxmoney on X and arcx.substack.com for a final post.

---

### Cred Protocol — **alive, and the only one in this file with a real published price list**

**What it scores and for whom.** *Credit risk*, not personhood: probability of
liquidation/default per address, plus Credit Reporting (wallet composition, lending metrics) and
Credit Monitoring (real-time credit-event webhooks). Buyer: lenders, wallets, risk teams.
Also ships an **Identity Attestations API**.

**Pricing (credprotocol.com/pricing, fetched 2026-07-24) — quote these, they are the category's
only real numbers:**

| Tier | Price | Quota |
|---|---|---|
| Free | **$0/mo** | 1,000 CUs/mo, unlimited sandbox; Scoring + Reporting + Identity Attestations APIs |
| Pro | **$249/mo** | 50,000 CUs/mo; batch & aggregate scoring, multi-address reports, monitoring webhooks |
| Enterprise | custom | unlimited requests, offchain data, white-label dApp auth, SLA |
| On-demand (**x402**, USDC) | **$0.01 per address score** (single or batch); reports **$0.01–$0.10**; **identity attestations $0.01** | pay-per-use |

**The $0.01-per-score number is the most useful single figure in this file.** It is the market's
revealed price for an algorithmic on-chain score. Compare to Persona at roughly **$0.80–$1.89 per
verification** for KYC (per the prior-art agent) — **two orders of magnitude**. That gap is the
whole thesis: a score derived from public chain data is nearly free because the input is free and
non-exclusive; a verification that touches a government document costs real money because it
carries liability, human review, and a regulatory obligation on the buyer's side.

**Customers.** Landing-page logos: MetaMask, Celo, Quadrata, Teller, Masa, Krebit, Atlendis,
imToken, Valora, Arweave; testimonials from Quadrata, Orange Protocol, Krebit. Several of those
(Quadrata, Krebit, Orange Protocol, Masa) are themselves small or defunct identity projects —
**a logo wall composed largely of other startups in the same category is a weak revenue signal**.
`UNVERIFIED:` any named paying enterprise deal or revenue figure.

**Liveness (2026-07):** **alive and shipping.** Blog posts dated **2026-03-31** (MCP toolkit for AI
agents) and **2026-03-23** (Stripe integration for machine-to-machine commerce). Third-party
comparison (March 2026) also notes MCP endpoints and Quadrata/Kredit attestation partnerships
([ChainAware comparison, secondary](https://chainaware.ai/blog/web3-reputation-score-comparison-2026/)).

**Integration surface for us.** Best-in-class of this cohort: self-serve, documented REST, free tier
with unlimited sandbox, webhooks, **x402 pay-per-call in USDC with no contract**, MCP server. Score
is computed off-chain and delivered by API; the Identity Attestations product suggests an on-chain
attestation path — `UNVERIFIED:` which registry/standard.

**Note the same agent pivot, in miniature:** MCP toolkit + Stripe M2M + x402. Cred is repositioning
its credit score as *the thing that lets an AI agent be trusted with money*.

---

### Nomis — alive, consumer-side, **sells to the user, not the protocol**

**What it scores and for whom.** A wallet "reputation score" minted by the user as a **soul-bound
NFT**, across 50+ chains and 29 mainnet deployments. The commercial twist: the primary customer is
the **end user**, who mints/updates their score to unlock **ScoreFront** perks — Discord roles,
partner discounts, allowlists, airdrop eligibility. Protocols consume the score as a gating input.
([nomis.cc, fetched 2026-07-24](https://nomis.cc/))

**Metrics (vendor-stated, 2026-07-24):** 1.3M+ unique score holders, 2M+ wallets scored, $8.6M+ in
rewards distributed through the system, 7 named score products (zkSync, LayerZero, Linea, zkEVM,
Starknet, Manta, Core…).

**Business model and pricing.** **Mint fees and update fees paid by the end user in gas/native
token** — the only genuinely *transactional consumer* model in this cohort. No published price
list (`UNVERIFIED:` exact mint/update fee). Also an API for wallet metrics/balances/activity;
a "Nomis Pass" subscription was roadmapped for Q1 2025. `UNCLEAR:` whether Nomis Pass shipped.
No token; the score itself is the SBT.

**Customers.** "Investors" listed include Solana, Aave, Polygon, LayerZero, Linea, Galxe, zkSync,
1inch; "active users" listed: Sides, Galxe, Legion, QuickSwap, Fearless Wallet, Pentagon Games,
Eywa, MemeFi, TLend. Note again that these are mostly small ecosystem projects. Recent posts:
Nomis × Sides (prediction markets), Nomis × Pundi AI, Nomis × Demos; a Feb-2026 OptiView
collaboration.

**Liveness (2026-07):** **alive and actively maintained** — roadmap extends to Q4 2026, multiple
2026 partnership posts, site 200.

**Integration surface for us.** The most interesting of the cohort *because the score is on-chain*:
an SBT minted to the user's address on each supported chain. If we can read a Nomis SBT's
`balanceOf`/`tokenURI` directly we can consume Nomis **without their cooperation or an API key** —
the only vendor here where that appears possible. `UNVERIFIED:` contract addresses and the exact
read function; do not guess them. Next step: pull `nomis.cc` app JS or their docs for the
ScoreSBT/`NomisScore` contract address on Linea/zkSync and confirm the score is stored on-chain
(vs. a `tokenURI` pointing at their server, which would defeat the point).

---

### Chaos Labs — sybil work is a **side-line of a risk-management business**

Chaos Labs is a risk-management/parameter-optimisation firm for lending protocols (Aave, GMX et al.)
whose sybil work appears as an engagement, not a product line. Its most-cited deployment is the
**LayerZero ZRO airdrop (June 2024)**, run jointly with **Nansen**: LayerZero applied six detection
techniques, filtered **803,093 of ~2.08M** wallets, and left ~1.28M qualifying wallets sharing a
distribution valued at **>$700M**
([Crypto Briefing, secondary](https://cryptobriefing.com/layerzero-airdrop-fairness/),
[Coincu, secondary](https://coincu.com/layerzero-sybil-detection-report/)).

The structurally important detail: **LayerZero's most effective filter was not a vendor score.** It
was a **self-report bounty** — admitted sybils kept 15% of their allocation, the other 85% was
redistributed — plus a public bounty for reporting others. Mechanism design outperformed
machine learning, and the vendors were a supporting input. That is bad news for anyone selling a
score into this exact use case.

**Business model.** Enterprise consulting/retainer for risk parameters; sybil detection sold as part
of a bespoke engagement. `UNVERIFIED:` any published price for a sybil engagement.
**Liveness:** alive; the core business is risk management, so sybil detection can be dropped at zero
cost to them. Not a scoring company. **Ignore** as a competitor.

---

### Nansen — sybil detection as a **feature of an analytics subscription**

Nansen is a wallet-labelling/analytics subscription business. Its sybil work is contracted, notably:
- **LayerZero ZRO** (with Chaos Labs), above.
- **Linea**: Nansen's analysis flagged **516,960 of 1,297,203** eligible addresses as sybils,
  cutting the eligible set to **780,243**
  ([The Block, secondary](https://www.theblock.co/post/335979/linea-filters-over-half-a-million-sybil-addresses-from-upcoming-token-airdrop)).

**Why Nansen matters to this file:** it is the **only company here with proven, durable recurring
revenue** — and that revenue comes from **analytics seats sold to traders**, not from sybil scores.
Sybil detection is a marketing-visible add-on riding on a labelled-address dataset built for another
purpose. The lesson is that the sybil-scoring capability was viable only as a **by-product**; nobody
in this file built a standalone business on it.

**Integration surface.** Nansen API exists (paid, subscription-tiered) but is a general analytics
API, not a sybil-score endpoint. `UNVERIFIED:` whether a sybil/cluster score is exposed via API at
all, versus delivered as a bespoke report. **Consume-adjacent / ignore** for us: the label data would
be useful, the commercial terms are not aggregator-shaped.

---

### Bello (Bello Labs) — **dead**

Web3 creator/collector analytics (no-code wallet insights for NFT creators), backed by
Tachyon/Consensys Mesh, a16z (via accelerator), Palm Tree Crew Crypto, Plug and Play
([PitchBook profile, secondary](https://pitchbook.com/profiles/company/528297-04)).

**Liveness evidence, checked 2026-07-24:** `https://bello.lol` **fails the TLS handshake**
(`tlsv1 alert internal error`) with DNS pointing at the same Netlify anycast IPs as ARCx —
an abandoned deploy. `www.bello.lol` likewise dead. No product news, funding, or announcement found
after ~2023. `UNVERIFIED:` no shutdown post located.

Bello was never really a *scoring* product — it was audience analytics — but it belongs here as
part of the same 2021–22 cohort of "wallet intelligence" startups, and it went the same way.
Adjacent datapoint: **DappRadar shut down in 2025**, i.e. even the largest free-standing web3
analytics brands did not sustain.

---

### Chainlink — identity/reputation efforts

`UNVERIFIED / thin:` Chainlink's relevant work is **DECO** (privacy-preserving oracle proofs over
TLS data, from the Cornell/Ari Juels line) and, more recently, compliance-oriented identity
plumbing (the Automated Compliance Engine / CCIP-linked identity work aimed at institutional
tokenised assets). Chainlink does **not** sell a wallet reputation score. Its posture is
*infrastructure for institutions to attach off-chain verified attributes to on-chain transactions*,
which puts it in the regulated-finance lane, not the airdrop-sybil lane.
Next step if this matters: chain.link/education/ACE and the DECO papers. For our purposes Chainlink
is **not a competitor** and not a usable input today; if a Chainlink-brokered attestation standard
becomes the institutional default it becomes a distribution channel question, not a scoring one.

---

### Arkham / Zerion / Etherscan-class analytics — **inputs, never competitors**

Arkham (entity-attribution and deanonymisation, with a bounty marketplace and a token), Zerion
(portfolio wallet), Etherscan/Dune (explorer and query layers) all sell **raw or attributed
behavioural data**, not a personhood or sybil verdict. They are upstream of everyone in this file:
the signals another agent is cataloguing come from here. Arkham's entity clustering is the closest
to sybil-relevant, but it is sold to traders and investigators as intelligence, not to protocols as
a gate. Treat as **consume / ignore**, and see the raw-signals file rather than this one.

---

## 1. Market structure — who actually buys
## 2. Competitor / input / acquisition-comparable, per company
## 3. Exit and failure comparables
## 4. The self-defeating dynamic
## 5. Verdict

## References
