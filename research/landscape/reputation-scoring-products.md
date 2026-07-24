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

---

## 1. Market structure — who actually buys
## 2. Competitor / input / acquisition-comparable, per company
## 3. Exit and failure comparables
## 4. The self-defeating dynamic
## 5. Verdict

## References
