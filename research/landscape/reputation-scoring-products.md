# On-chain reputation & sybil-scoring products as businesses

**Scope:** the companies selling a *score* today. Trusta Labs (MEDIA / TrustScan), Nomis, Spectral
Finance, ARCx, Karma3 Labs / OpenRank, Cred Protocol, Chainlink identity/reputation, Bello,
Zerion/Arkham-style analytics, Nansen sybil work, Chaos Labs, and sybil-detection vendors sold to
airdrop teams.

**Out of scope (other agents):** the *mathematics* of scoring (see
`research/references/` scoring file) and *raw behavioural signals*. Methodology noted only where it
bears on the business.

---

## Summary table

All liveness checks run **2026-07-24**.

| Company | What it sells | Buyer | Published price | Status 2026-07 | Verdict |
|---|---|---|---|---|---|
| **Trusta.AI** (ex-Trusta Labs) | Sybil Score, MEDIA Score, now SIGMA (AI-agent score) | airdrop teams, L2 foundations | none; 1,000 free trial calls, then "DM on Discord" | alive, **pivoting to AI-agent scoring** | **compete** |
| **Cred Protocol** | credit risk, credit reporting, identity attestations | lenders, wallets | **$0/mo → $249/mo; $0.01 per score via x402** | alive, shipping (2026-03 posts) | **consume** |
| **Nomis** | multi-chain reputation as **on-chain SBT** | **end users** (mint fees) + protocols | mint/update fee, unpublished | alive, roadmap to Q4 2026 | **consume, conditionally** |
| **Karma3 Labs / OpenRank** | decentralised graph reputation (EigenTrust) | protocols, wallets, social | free/protocol | **DEAD — wound down 2026-06-16, capital returned to investors** | **failure comparable + free code** |
| **Spectral** | MACRO credit score (2022) → Syntax onchain agents | lenders → agent builders | n/a | **pivoted**; `spectral.finance` 404, `spectrallabs.xyz` live | **ignore** |
| **ARCx** | DeFi Passport / DeFi credit score | DeFi lenders | n/a | **DEAD** — apex domain fails TLS on dead Netlify deploy | **ignore** |
| **Chaos Labs** | bespoke sybil analysis (side-line of risk consulting) | foundations, lending protocols | enterprise, unpublished | alive (core business is risk params) | **ignore** |
| **Nansen** | wallet labels + bespoke sybil reports | traders (seats); foundations (one-off) | subscription seats | alive — **the only durable recurring revenue here, and not from scores** | **ignore / consume labels** |
| **Bello (Bello Labs)** | web3 creator/collector analytics | NFT creators | n/a | **DEAD** — domain fails TLS, no news since ~2023 | **ignore** |
| **Chainlink** | DECO / compliance attestation plumbing — **no wallet score** | institutions | n/a | alive, different market | **ignore, watch** |
| **Arkham / Zerion / Dune / Etherscan** | raw + attributed on-chain data | traders, investigators | varies | alive | **consume (input)** |
| **Long tail** (RubyScore, Ethos, UTU, ChainAware, Whitebridge) | assorted scores | unclear | mostly unpublished | alive-ish | **ignore** |

**The headline:** every pure-play on-chain reputation scoring company is dead, pivoted, or on
grants. The two with durable recurring revenue sell something else and treat sybil scoring as a
by-product. Karma3 killed a technically successful product on **2026-06-16** and returned investor
capital, stating it *"never found a sustainable business model."*

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

**The prior-art agent's thesis was that airdrop sybil-filtering and grant rounds are the only two
web3 buyers with real numbers, and that both are episodic. This research supports it, and sharpens
it in three ways.**

### 1.1 The two buyers, confirmed — with their actual shapes

**Buyer A: token-distribution teams (airdrops).** Real budgets, real engagements, big numbers:
LayerZero filtered 803,093 of ~2.08M wallets across a >$700M distribution (June 2024, with Nansen
and Chaos Labs); Linea removed 516,960 of 1,297,203 eligible addresses on Nansen's analysis. These
are the largest sybil-filtering engagements on record.

But look at the shape. A token generation event happens **once per protocol**. The buyer is a
foundation with a one-time treasury event, a deadline, and no reason to hold a subscription
afterwards. There is no renewal because there is no second TGE. Even "Season 2" airdrops are
12–24 months apart. **This is project revenue with a consulting margin structure, priced against a
one-off treasury line, sold to a buyer who will not exist as a buyer next quarter.**

**Buyer B: grant rounds / quadratic funding.** Gitcoin's own rounds, and the Human Passport
customer set. Real, recurring on a quarterly-ish cadence, but tiny: Human Passport reached
**2M users and 35M credentials on under $1M revenue**. Grant rounds are run by non-profits
optimising cost, and the sums being protected (single-digit millions of matching funds) cap what
anyone will pay to protect them.

### 1.2 The sharpening: the buyers who *did* pay, mostly did not pay a scoring company

This is the finding that most damages the category:

- **LayerZero's most effective filter was mechanism design, not a vendor score.** The self-report
  bounty (keep 15%, forfeit 85%) plus a public reporting bounty did the heavy lifting; Nansen and
  Chaos Labs were supporting inputs among "six detection techniques". A foundation with a $700M
  distribution has enormous leverage to make farmers reveal themselves — leverage a vendor cannot
  sell. **Where the stakes are highest, the buyer's own incentive design beats the purchased score.**
- **The vendors who got paid were not scoring companies.** Nansen sells analytics seats; Chaos Labs
  sells risk-parameter consulting. Both had a pre-existing business and an existing dataset; sybil
  detection was an add-on that reused it. Neither would have survived on the sybil line alone.
- **The pure-play scoring companies show grants, not contracts.** Trusta's partner wall is
  foundations, hackathons and grants; Cred's and Nomis's are largely other small identity/DeFi
  startups. Nobody in the pure-play cohort published a named, paid, enterprise sybil deal.

### 1.3 Did anyone build recurring revenue? Essentially no.

| Company | Recurring revenue? | From whom |
|---|---|---|
| Karma3 / OpenRank | **No** — said so explicitly, then shut down | — |
| Spectral | No (pivoted to agents + token) | — |
| ARCx | No (dead) | — |
| Trusta.AI | Not evidenced; grants + bespoke; now pivoting to agent scoring | chain foundations (grants) |
| Cred Protocol | **Some** — a published $249/mo tier and $0.01 x402 calls exist, so self-serve recurring is at least *possible*. Magnitude `UNVERIFIED:` and very likely small | lenders, wallets |
| Nomis | **Some** — consumer mint/update fees, i.e. recurring in aggregate but per-user micro-payments, not contracts | end users |
| Nansen | **Yes — but from analytics seats, not scores** | traders |
| Chaos Labs | Yes — risk-management retainers, not scores | lending protocols |

The two unambiguous recurring-revenue businesses in this file (Nansen, Chaos Labs) both earn it
somewhere else and treat sybil scoring as a by-product. **Nobody monetised the score itself
recurringly at meaningful scale.** Karma3 tested the thesis to destruction and said so on the way
out: *"the correct thesis does not automatically translate into a scalable business."*

### 1.4 The frame that explains all of it: no forcing function

The prior-art agent's web2 contrast is the right lens and it should be stated bluntly.

| | Web2 identity orchestration | Web3 reputation scoring |
|---|---|---|
| Buyer's motive | **Legal obligation** — KYC/AML, age assurance; regulators levy fines | Discretionary loss-reduction on a one-off event |
| Consequence of not buying | Enforcement action, licence risk, personal liability for officers | A worse airdrop distribution and some Twitter complaints |
| Price sustained | Persona ~**$0.80–$1.89 per verification**; Trulioo aggregates 450+ sources behind one API | Cred: **$0.01 per score**; Trusta: 1,000 free calls and "DM us on Discord" |
| Revenue shape | Per-verification, contractual, renews because the obligation renews | Per-project, expires when the TGE ships |

**Two orders of magnitude of price difference, and the reason is not technical quality — it is that
one buyer is compelled and the other is not.** Everything else in this file follows from that. A
score derived from public chain data has (a) a free, non-exclusive input, (b) no liability transfer
to the buyer, and (c) no regulator asking whether you bought it. Those three facts jointly cap the
price near zero.

Corollary for us: if our aggregator's value proposition is "a better score", we are entering the
$0.01 column. The only escape routes are (i) attach to an actual obligation (age assurance under
the UK OSA / EU rules — see `demand-and-regulation.md`), (ii) sell to a buyer facing an
uninsurable loss, or (iii) carry liability the buyer wants to offload, which is what KYC vendors
actually sell.

---

## 2. Competitor, input, or acquisition comparable — per company

The right distinction is **what kind of claim the score makes**:

- A **sybil-probability score is a substitute for us.** It answers a buyer's question ("is this one
  human or fifty?") with the same output shape as our humanity assertion. A buyer choosing Trusta's
  Sybil Score is choosing *not* to buy our aggregate. It is a cheaper, weaker, behaviour-only
  substitute — which is exactly what makes it dangerous, because "cheaper and good enough" is how
  categories get commoditised from below.
- A **creditworthiness score is a complement.** "Will this address repay?" is orthogonal to "is
  this a unique human?". A lender wants both. Cred's score plus our personhood assertion compose
  into something neither sells alone.
- A **behavioural/loyalty score (MEDIA, MACRO-style value scoring) is an input**, at best, and one
  we should weight near zero for uniqueness (see the scoring-mathematics file: behavioural evidence
  is the cheapest evidence to manufacture and should carry the lowest weight).

| Company | Score type | Relationship | Reasoning |
|---|---|---|---|
| **Trusta.AI** | sybil probability + value score | **Compete** (weakly) | Direct substitute on the sybil question; but they are pivoting to agent scoring and their moat is data, not distribution. Compete by being the thing they are walking away from. |
| **Cred Protocol** | credit risk + identity attestations | **Consume** | Complementary, self-serve, $0.01 x402 per call, MCP server, free tier. The single easiest integration in this file, and their "Identity Attestations" API is worth an evaluation. |
| **Nomis** | multi-chain behavioural reputation, **on-chain SBT** | **Consume** (conditionally) | If the score is genuinely readable on-chain we can ingest it permissionlessly and weight it as low-grade behavioural evidence. Not a competitor — they sell to users, we sell to protocols. |
| **Karma3 / OpenRank** | graph reputation | **Acquisition comparable → now a failure comparable, and a free asset** | Dead, but code, protocol and docs are being open-sourced and archived publicly. If we ever want EigenTrust-style graph propagation, that code is now free and battle-tested at 10M users. |
| **Spectral** | credit (legacy) → agents | **Ignore** | No longer in this market. |
| **ARCx** | credit | **Ignore** (dead) | Failure comparable only. |
| **Chaos Labs** | bespoke sybil analysis | **Ignore** | Different business (risk parameters). Would only meet us inside an airdrop RFP. |
| **Nansen** | wallet labels + bespoke sybil analysis | **Consume-adjacent / ignore** | Labels are a useful signal source; commercial terms are seat-based and not aggregator-shaped. Competes only for the same one-off airdrop budget. |
| **Bello** | wallet analytics | **Ignore** (dead) | — |
| **Chainlink** | no wallet score; DECO / compliance plumbing | **Ignore now, watch** | Not a scoring competitor. If a Chainlink-brokered attestation format becomes the institutional default, that is a distribution question for us, not a scoring one. |
| **Arkham / Zerion / Dune / Etherscan** | raw + attributed data | **Consume** | Upstream inputs. See the raw-signals file. |
| **RubyScore, Ethos, UTU, ChainAware, Whitebridge** | assorted | **Ignore / long tail** | Third-party comparison lists 7+ near-identical products ([ChainAware, secondary](https://chainaware.ai/blog/web3-reputation-score-comparison-2026/)). A crowded field of undifferentiated scores with no published prices is the classic signature of a market with no buyer. Note Whitebridge claims **$3M ARR** — and it is a *background-check on real people* product, not an on-chain score. Again: the money is where a real-world identity is being checked. |

---

## 3. Exit and failure comparables

Sorted by what they tell us about valuation.

| Event | Date | Terms | Read |
|---|---|---|---|
| **Karma3 Labs / OpenRank winds down, returns remaining capital** | **2026-06-16** | $4.5M seed (Galaxy, IDEO CoLab, Spartan, SevenX, HashKey) raised 2024-03; capital **returned**; code open-sourced and repos archived. 10M users scored, $50M incentives influenced, 50+ integrations at death. | **The definitive negative result.** They had the traction and could not monetise. Returning capital means the founders judged no bridge round could fix it. |
| **Human Passport (Gitcoin Passport) → Holonym Foundation** | 2025-02-10 | **~$10M**, on **<$1M revenue**, with 2M users / 35M credentials | ~10x revenue on a sub-$1M base. Not a venture outcome — this is an acqui-asset price. |
| **Civic discontinues uniqueness + liveness products** | **2025-07-31** | Product shutdown; pivot to embedded-wallet auth. ~1M passes issued. | A working, shipped personhood product killed by its own vendor after distribution success. Distribution did not equal demand. |
| **SpruceID `rebase` (credential aggregator) archived** | **2024-06-05** | Repo archived; company now on government contracts — DHS SVIP **$199,960** Phase 1, up to **$1.7M**; CA DMV mDL | The credential-*aggregator* code was the part that got abandoned. The survivable revenue was **government procurement**. |
| **Spectral pivots off credit scoring** | ~2024–2026 | **$23M raised** against the credit-score thesis; now Syntax/agents + SPEC token | The best-funded attempt did not fail loudly, it *left*. |
| **ARCx** | ~2022–2023, no announcement | Dragonfly + Scalar backed; apex domain now fails TLS on a dead Netlify deploy | Quiet death, the most common outcome. |
| **Bello Labs** | ~2023, no announcement | a16z/Tachyon/Consensys Mesh backed; domain dead | Quiet death. |
| **DappRadar shutdown** | 2025 | — | Even the largest free-standing web3 *analytics* brand did not sustain. |

**Is the ~$10M-on-$1M pattern typical?** No — **it is the good outcome.** It is the *only* positive
liquidity event in the entire cohort. Against it sit: one company returning capital to investors,
one $23M pivot, one product shutdown by a profitable-enough parent, one archived aggregator repo,
and two silent domain deaths. **The realistic distribution of outcomes for a web3 reputation/
personhood scoring company is: mostly zero, occasionally ~$10M, never large.** Anyone modelling our
outcome should anchor on "$10M is the ceiling of the observed distribution, not the median," and
should note that the only company here with a durable revenue line (SpruceID) got it from
**government procurement**, and the only high-ARR name in the comparison set (Whitebridge, $3M ARR)
sells **real-world background checks**.

---

## 4. The self-defeating dynamic: scores that matter get farmed

The structural problem: **these products score behaviour, and behaviour is manufactured cheaply.
The moment a score gates money, producing the score becomes a job.**

### 4.1 The score becomes the target (Goodhart, with receipts)

- **Gitcoin/Human Passport published its stamp weights** — a deliberate, laudable transparency
  choice ([stamp weights, primary](https://support.passport.xyz/passport-knowledge-base/stamps/how-is-gitcoin-passports-score-calculated)).
  The threshold for grant-round eligibility is **20**. Analysis found that **at least 44 points are
  obtainable through "moderately simple sybil vectors"** — duplicate social accounts and low-tier
  on-chain activity — i.e. **more than double the passing threshold is farmable**, while the
  genuinely strong stamps (Holonym, Civic, Coinbase) are not weighted to reflect that strength
  ([Delphi Digital, secondary](https://members.delphidigital.io/feed/decentralized-identity-gitcoin-passport)).
  A published-weight system with a fixed threshold does not produce a score; it produces a
  **checklist**, and farmers complete checklists.
- **An entire tutorial economy exists for raising these scores.** "Nomis Guide for Beginners — 8
  Best Strategies to Increase Your Score" instructs users to mint/update regularly and to spread
  activity across chains and interaction types, because Nomis "analyzes over 30 parameters" and
  rewards breadth ([giveawaylisting.com, secondary](https://giveawaylisting.com/tap2earn/nomis-guide/)).
  Guides for reaching Gitcoin Passport 20+ are similarly abundant. **Farmers optimise to exactly the
  threshold** — a rational farmer buys the cheapest stamps summing to 20 and stops.
- **The counter-tooling industrialised.** 2026 airdrop-farming guides describe the baseline as
  dedicated **mobile proxies**, antidetect browsers, diversified funding sources and multi-month
  sustained activity to build an authentic "wallet narrative"
  ([Coronium](https://www.coronium.io/blog/airdrop-farming-proxy-guide-2026),
  [proxies.sx](https://www.proxies.sx/blog/airdrop-farming-anti-sybil-mobile-proxies-2026)).
  When the countermeasure to a behavioural score is *simply behaving differently for six months*,
  the score is measuring patience and capital, not humanity. **Patience and capital are exactly what
  a professional farm has more of than a real user.**

There is a perverse selection effect here worth stating plainly: a behavioural score that raises the
cost of farming filters out *casual* farmers and *casual real users* alike, while leaving the
professional farms — who amortise the cost across thousands of wallets — relatively advantaged. High
thresholds can make the surviving population *more* sybil-dense, not less.

### 4.2 The vendor response: hide the methodology — and what it cost

Every vendor in this file that survived contact with real stakes moved toward opacity:

- **Trusta** publishes dimension *names* (Monetary, Engagement, Diversity, Identity, Age) and says
  "AI and knowledge graphs" — no weights, no thresholds, no score bands anywhere in the public docs.
- **Nansen and Chaos Labs** deliver sybil verdicts as bespoke analyses; no published criteria.
- **LayerZero kept its eligibility criteria undisclosed**, and applied "six detection techniques"
  it did not enumerate.

**What concealment cost, concretely, in the largest engagement on record.** The LayerZero backlash
was **not** about filtering per se — it was about **false positives with no appeal process**. Users
running multiple addresses for legitimate reasons (security hygiene, portfolio separation) were
excluded, and commentators objected that the definition of "sybil" was ambiguous enough that highly
active genuine users could be caught
([Unchained](https://unchainedcrypto.com/why-layerzeros-new-anti-sybil-policy-is-getting-both-backlash-and-praise/),
[Unchained II](https://unchainedcrypto.com/has-layerzero-shot-itself-in-the-foot-with-its-sybil-detection-program/)).
LayerZero also **paused its bounty-hunter reporting process mid-flight** after an influx of reports
forced a redesign ([The Block](https://www.theblock.co/post/295274/layerzero-labs-ceo-announces-pause-of-sybil-bounty-hunter-process-after-influx-of-reports)).
The initial flag list of ~2M was cut to 803,093 by applying stricter criteria specifically to reduce
false positives — a public admission that the first pass was substantially wrong.

The commercial damage runs in a specific direction: **opacity makes the score unappealable, and an
unappealable score exports reputational risk to the buyer.** The foundation, not the vendor, absorbs
the community anger. A buyer who has been through that once is structurally less willing to hand the
decision to a black box next time — which is part of why LayerZero-style mechanism design
(self-report bounties, where the *user* makes the call and the incentive is transparent) gained
ground over vendor scores.

### 4.3 The trade-off has no clean answer, and it is ours too

Publish the weights → the score becomes a farmable checklist (Passport: 44 farmable points against a
20 threshold). Hide the weights → the buyer cannot audit, cannot appeal, cannot defend the decision
publicly, and takes the blame. Neither branch produces a durable product on its own.

**What actually broke the deadlock in practice was not a better model but a change in the evidence
base**: LayerZero's self-report bounty worked because it altered incentives rather than measuring
behaviour, and the strongest Passport stamps were the ones backed by something *outside* the chain
(Holonym, Civic, Coinbase KYC) — evidence that is expensive to forge because a third party bore a
cost to issue it.

**Direct implication for our design** (hand this to the scoring file):
1. **Weight by cost-to-forge, not by predictive power on historical data.** Behavioural features
   look predictive in backtest precisely because nobody was optimising against them yet.
2. **Never publish a fixed threshold against published weights.** Either randomise/rotate the
   decision boundary, express output as a distribution rather than a pass/fail, or make the
   threshold the buyer's parameter and keep our output an ordered confidence.
3. **Publish the *evidence*, hide the *aggregation*.** We can be fully transparent about which
   credentials a subject holds and what each is worth in cost-to-forge terms — that is auditable and
   appealable — while keeping correlation handling and anti-gaming adjustments unpublished. This is
   the one split that gives a buyer something to defend publicly without giving a farmer a checklist.
4. **Build the appeal path as a product feature, not an afterthought.** The single loudest complaint
   in the largest deployment in this category's history was "no appeal process." That is a
   differentiator available for free.

---

## 5. Verdict

### Per company

| Company | Verdict | One line |
|---|---|---|
| **Trusta.AI** | **Compete** (and expect them to vacate) | Only pure-play with a real sybil product and chain-foundation relationships, but pivoting to AI-agent scoring (SIGMA/AgentGo). Chase their Attestation Service for an on-chain read path. |
| **Cred Protocol** | **Consume** | Complement, not substitute. $0.01/score via x402, free tier, MCP server, Identity Attestations API. Integrate and evaluate; also the best pricing benchmark we have. |
| **Nomis** | **Consume, conditionally** | On-chain SBT score = possible permissionless ingestion. Verify the contract and whether the score is actually stored on-chain before assuming it. Low weight as behavioural evidence. |
| **Karma3 / OpenRank** | **Acquisition/failure comparable + free code** | Dead 2026-06-16, capital returned. Their open-sourced EigenTrust implementation is a free asset; their stated reason for dying is the most important sentence in this file. |
| **Spectral** | **Ignore** | Left the market; $23M pivoted into agents. |
| **ARCx** | **Ignore** | Dead. Failure comparable. |
| **Bello** | **Ignore** | Dead. Failure comparable. |
| **Chaos Labs** | **Ignore** | Risk-parameter consultancy; meets us only in an airdrop RFP. |
| **Nansen** | **Ignore as competitor / consume labels if cheap** | Proves the category works only as a by-product of another business. |
| **Chainlink** | **Ignore now, watch** | Not selling a wallet score; institutional attestation plumbing could become a distribution channel. |
| **Arkham / Zerion / Dune / Etherscan** | **Consume** | Upstream data, never competitors. |
| **RubyScore / Ethos / UTU / ChainAware / Whitebridge** | **Ignore** | Long tail of undifferentiated scores with no published prices. Whitebridge's $3M ARR is the exception and it comes from real-world background checks, not on-chain scoring. |

### Has this market ever supported a durable business?

**No — not once, not for anyone selling the score itself.** Every pure-play on-chain reputation
scoring company in this file has died, pivoted, or is running on grants: Karma3 returned its
investors' money in June 2026 after scoring 10M users and influencing $50M of incentive
distribution, explicitly stating it never found a sustainable business model; Spectral took $23M
and left for AI agents; ARCx and Bello died silently with their domains still pointed at dead
Netlify deploys; Trusta is mid-pivot to scoring AI agents rather than humans. The two companies in
this file with genuine recurring revenue — Nansen and Chaos Labs — earn it selling analytics seats
and risk consulting, and treat sybil detection as a by-product of a dataset built for another
purpose. The one positive exit, Human Passport at ~$10M on under $1M of revenue, is the ceiling of
the observed outcome distribution rather than its median, and it was an asset purchase by a
foundation, not a venture return. The cause is not execution and it is not technology — Karma3 was
right about the technology and said so on the way out. The cause is that a score computed from
free, public, non-exclusive data, sold to a buyer under no legal obligation to buy it, for a
one-time event, prices at **$0.01 a call** against **$0.80–$1.89** for a KYC check that carries a
regulatory obligation and transfers liability. Until an aggregate humanity assertion is attached to
something a buyer is *compelled* to do — age assurance, a licensing condition, an insurable loss —
we should assume the same ceiling applies to us, and design the business around a named buyer with
a budget line and a renewal trigger rather than around having the best score.

---

## Open questions / next steps

1. **Trusta Attestation Service** — which chain, which standard (EAS?), which issuer address. An
   on-chain-readable Trusta attestation would be consumable without their cooperation. Look at their
   docs page and at EAS schema registries on Linea/Base.
2. **Nomis score SBT contract addresses**, and whether the numeric score is stored on-chain or only
   in a server-hosted `tokenURI`. Pull from the nomis.cc app bundle. Do not guess addresses.
3. **The original Karma3/OpenRank shutdown post in English** — currently sourced only via Chinese
   secondary coverage. Worth the verbatim founder text; it is the strongest single piece of evidence
   about this market.
4. **Cred Protocol's actual revenue** and whether the $249/mo tier has meaningful uptake — the only
   live test of whether self-serve scoring subscriptions work at all.
5. **Whether LayerZero, zkSync or Linea *paid* Trusta** or whether Trusta published analyses
   unsolicited for marketing. Determines whether the pure-play cohort ever closed a real deal.
6. **GitHub commit recency** for TrustaLabs, Nomis, Cred — api.github.com was rate-limited from this
   host; re-run with an authenticated token.

---

## References

**Primary / vendor**
- Trusta.AI homepage — https://www.trustalabs.ai/ (fetched 2026-07-24)
- Trusta docs, Sybil & MEDIA score — https://trusta-labs.gitbook.io/trustaai/products/trustscan/introduction-to-sybil-score-and-media-score
- Trusta docs, API application & trial quota — https://trusta-labs.gitbook.io/trustaai/products/trustscan/how-to-apply-for-trustscan-api.md
- Trusta MEDIA indicator system — https://trusta-labs.gitbook.io/trustalabs/trustgo/media-indicator-system
- Trusta sybil ML framework repo — https://github.com/TrustaLabs/Airdrop-Sybil-Identification
- Cred Protocol — https://www.credprotocol.com/ and pricing https://www.credprotocol.com/pricing (fetched 2026-07-24)
- Nomis — https://nomis.cc/ (fetched 2026-07-24)
- Human Passport stamp weights — https://support.passport.xyz/passport-knowledge-base/stamps/how-is-gitcoin-passports-score-calculated
- LayerZero self-report conclusion (803,093 figure) — https://x.com/LayerZero_Core/status/1791622471965163597
- ARCx wiki (docs outliving product) — https://wiki.arcx.money/
- Liveness checks run 2026-07-24 from this host: `arcx.money` and `bello.lol` fail TLS
  (`tlsv1 alert internal error`) with DNS on Netlify anycast (75.2.70.75 / 99.83.190.102);
  `spectral.finance` returns 404 while `spectrallabs.xyz` returns 200.

**Secondary**
- TechCrunch — Karma3 Labs $4.5M seed — https://techcrunch.com/2024/03/01/karma3-labs-openrank-web3-ranking/
- CoinDesk press release — Karma3 seed led by Galaxy/IDEO CoLab — https://www.coindesk.com/press-release/2024/03/03/karma3-labs-raises-a-45m-seed-round-led-by-galaxy-and-ideo-colab-to-build-openrank-a-decentralized-reputation-protocol
- Wu Blockchain (zh) — Karma3 shuts OpenRank, returns funds, open-sources code, 2026-06-16 — https://www.wublock123.com/news/karma3-labs-shuts-openrank-returns-funds-opensource-code-62862
- Tencent News (zh) — same announcement — https://news.qq.com/rain/a/20260616A0754V00
- Crypto Briefing — LayerZero with Nansen + Chaos Labs — https://cryptobriefing.com/layerzero-airdrop-fairness/
- Coincu — LayerZero sybil detection report — https://coincu.com/layerzero-sybil-detection-report/
- Unchained — backlash and praise for LayerZero's anti-sybil policy — https://unchainedcrypto.com/why-layerzeros-new-anti-sybil-policy-is-getting-both-backlash-and-praise/
- Unchained — "Has LayerZero shot itself in the foot?" — https://unchainedcrypto.com/has-layerzero-shot-itself-in-the-foot-with-its-sybil-detection-program/
- The Block — LayerZero pauses bounty-hunter process — https://www.theblock.co/post/295274/layerzero-labs-ceo-announces-pause-of-sybil-bounty-hunter-process-after-influx-of-reports
- The Block — Linea filters 516,960 of 1,297,203 addresses — https://www.theblock.co/post/335979/linea-filters-over-half-a-million-sybil-addresses-from-upcoming-token-airdrop
- Delphi Digital — Gitcoin Passport analysis (44 farmable points vs 20 threshold) — https://members.delphidigital.io/feed/decentralized-identity-gitcoin-passport
- ChainAware — Web3 reputation score comparison, updated March 2026 — https://chainaware.ai/blog/web3-reputation-score-comparison-2026/
- Coronium — 2026 airdrop farming proxy guide — https://www.coronium.io/blog/airdrop-farming-proxy-guide-2026
- proxies.sx — anti-sybil mobile proxies 2026 — https://www.proxies.sx/blog/airdrop-farming-anti-sybil-mobile-proxies-2026
- giveawaylisting — Nomis score-raising guide — https://giveawaylisting.com/tap2earn/nomis-guide/
- Phemex Academy — Spectral / SPEC / Syntax agent pivot — https://phemex.com/academy/what-is-spectral-spec
- Spectral $23M and "on-chain credit score" coinage — https://www.andreiponivesc.com/portfolio-page/how-spectral-finance-raised-23m-and-coined-the-term-%E2%80%98on%E2%80%91chain-credit-score%E2%80%99
- The Block — Dragonfly/Scalar back ARCx DeFi Passport — https://www.theblock.co/linked/106806/dragonfly-scalar-arcx-defi-passport
- Crunchbase — Trusta Labs funding (Seed VC-II, 2025-06-26) — https://www.crunchbase.com/organization/trusta-labs
- PitchBook — Bello Labs profile — https://pitchbook.com/profiles/company/528297-04
- Trusta Medium — zkSync NFT airdrop analysis — https://medium.com/@trustalabs.ai/zksync-nft-airdrop-analysis-58341d6721e1

**Cross-file** — Human Passport (~$10M / <$1M revenue), Civic product discontinuation 2025-07-31,
SpruceID `rebase` archived 2024-06-05 + DHS SVIP $199,960/$1.7M, Persona $0.80–$1.89 per
verification, Trulioo 450+ sources: all from `identity-infra-prior-art.md` and the
prior-art agent's findings; see that file for primary citations.
