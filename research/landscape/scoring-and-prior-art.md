# Scoring systems & prior art — how everyone else computes a humanity score

> **Salvaged.** Reconstructed from three research agents (rows 13, 14, 19) killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). This is the most directly useful file in the
> salvage set: it contains real published weights, thresholds, and one hard empirical result about
> whether aggregate scoring actually works.

**The blunt finding the brief asked for:** yes, someone has already built this. Human Passport
describes itself as "**the first aggregate Proof of Personhood solution available on the market**,"
and claims Sybil resistance for **120+ projects, 150+ campaigns, securing over $430M in capital flow**.
We are not entering an empty field. What we can do differently is route to *strong, independent,
cryptographic* roots rather than web2 stamps — see [the verdict section](#what-this-means-for-our-design).

## Human Passport — the incumbent aggregator

**Two products, and the second one matters more than it first appears.**

### Stamps → Unique Humanity Score

> "Passport aggregates identity credentials — called Stamps — from trusted sources, then returns a
> Unique Humanity Score in real time."

- **The threshold is 20.** "The Unique Humanity Score is compared against a threshold that you set,
  or you can utilize the binary `passing_score` field that uses a recommended threshold of **20**. The
  threshold used by the Passport app is 20, which is designed to be an effective default threshold
  value for general-purpose use."
- Scale of the stamp system, historically: **19 stamps and 61 data points** as of Gitcoin Round 15
  (up from 8 stamps the round before).
- **GTC Staking stamp** — staking GTC on your identity raises your score. This is *economic* rather
  than evidentiary sybil resistance: it makes a fake identity cost money. Only claimable during
  Gitcoin Grants rounds. `UNCLEAR:` whether it is deprecated — the agent searched specifically and
  found no deprecation notice.

### Models API — passive ML classification

> "It can score any EVM addresses against several different models that analyze transaction history
> against dozens of different data features to identify if that address is likely Human or Sybil."

- The **ETH activity model** is "trained on known Sybil and human EVM account data," is explicitly
  "a **black box** whose outcome is based on **50+ features**," and returns a score in the range
  **−1 to 100**.
- Requires no user action and no Passport account.
- Passport documents a **"double verification"** pattern combining model-based and stamp-based APIs.

**That combination — a passive ML prior plus an active credential score — is a strong design and we
should probably copy the shape.** It solves the cold-start problem: an address with no credentials
still gets a number.

### The Gitcoin Trust Bonus — and the one hard number that justifies this whole field

Historically, Passport scores fed a **Trust Bonus** in Gitcoin Grants quadratic funding: contributors
started at **50%** of their eligible matching and could reach **150%** by verifying more stamps. The
"APU scoring method maps scores to individual Passports according to the number of stamps and **the
uniqueness of their combination**" — note that, it is not a naive sum.

And then:

> "Between Grants Rounds 9 to 11, the **Fraud Tax** paid out by the Gitcoin team has decreased from
> **6.6% of the pool to about 0.6%**."

**A ~10× reduction in successful sybil extraction, measured in real money, after deploying aggregated
identity scoring.** This is the single best piece of evidence in the entire research set that what we
are building has measurable value. It should go in any pitch. It is also a benchmark: whatever we
build should be evaluated on realised fraud rate, not on credential counts.

## Trusta Labs — the most transparent published methodology

**MEDIA Score** — 0–100, computed purely from on-chain behaviour across five dimensions, with
**published weights summing to 100**:

| Dimension | Weight |
|---|---|
| **M**onetary | 25 |
| **E**ngagement | 30 |
| **D**iversity | 15 |
| **I**dentity | 10 |
| **A**ge | 20 |

Method: within each dimension a sub-score is a weighted sum of its variables; sub-scores are then
scaled to 0–100 "which standardizes the sub-scores and makes them easier to interpret and compare
across dimensions"; the final MEDIA score is a weighted sum of the scaled sub-scores.

**This is the clearest worked example of the commensurability problem being solved by fiat** — hard
problem #1 in our [README](../../README.md). Trusta did not derive those weights from first
principles; they chose them. Note that "Identity" is weighted *lowest* (10) in a system marketed for
sybil detection, which tells you their signal actually comes from behaviour.

**Sybil Score / TrustScan** detects "suspicious sybil attack patterns based on comprehensive on-chain
activity, considering **four categories of patterns: star-like transfer graph, chain-like transfer
graph, bulk operations and similar behavior sequences**." That taxonomy is directly reusable — those
four shapes are what funded sybil farms actually look like on-chain, and any graph-derived Circles
score we build should test for them.

- **Coverage:** Ethereum, zkSync, Arbitrum, BNB Chain, Optimism, expanding to Starknet, Linea, Base,
  Polygon zkEVM.
- **Adoption:** published sybil reports for Celestia, Starknet, Manta; partnerships with Binance,
  Galxe, and Gitcoin Passport; grants from Solana, Starknet, Arbitrum, Linea. Claims to be **"the top
  POH provider on Linea."**
- **Open source:** [`TrustaLabs/Airdrop-Sybil-Identification`](https://github.com/TrustaLabs/Airdrop-Sybil-Identification)
  — "Trusta's AI and machine learning framework for robust Sybil identification in airdrops."
  **Worth reading before we design any scoring.**
- `UNVERIFIED:` pricing — the methodology doc fetch hit a GitBook redirect and the exact formulas,
  sigmoid details, and thresholds were never captured. Also `UNVERIFIED:` API auth and rate limits,
  though a public API reference exists at `trustscan.readme.io`.

## Nomis

- On-chain reputation scores across **50+ chains**, from **30+ parameters** including wallet balance,
  transaction volume, and wallet age.
- **Seven distinct reputation scores** rather than one: zkSync, LayerZero, Linea, zkEVM (+ Polygon
  ID), Starknet, Manta, and a Multichain Score (Polygon/BNB/Ethereum) that is "integrated into Galxe
  as an Anti-Sybil credential."
- Issues **Score SBTs**; **ScoreFront** lets holders use scores for perks, with ~20 partner projects.
- **The per-ecosystem score design is worth noting** — Nomis concluded that one universal number is
  less useful than chain-specific ones. That is a real argument against our "single normalized
  assertion" framing and deserves a considered answer rather than dismissal.
- `UNVERIFIED:` score range, formula, pricing.

## OpenRank / Karma3 Labs — EigenTrust in production

- EigenTrust-based reputation compute, used for **Farcaster** ranking and recommendation.
- [`ts-eigencaster`](https://github.com/Karma3Labs/ts-eigencaster) "abstracts EigenTrust
  implementation details away from developers by wrapping the core EigenTrust API with necessary
  pre-/post-processing steps, so Farcaster clients don't have to speak in EigenTrust terms such as
  **local trust, pre-trust, and alpha/epsilon parameters**."
- Repos: [`openrank-sdk`](https://github.com/Karma3Labs/openrank-sdk) (also on PyPI),
  `GoEigentrust`, [`farcaster-openrank-neynar`](https://github.com/Karma3Labs/farcaster-openrank-neynar)
  (a fork "to be hosted by Neynar"), [`openrankprotocol`](https://github.com/openrankprotocol).
- Produces "global profile ranking systems, personalized recommendations **and sybil lists**."

**This is the closest existing thing to what we would need for a Circles-derived score.** Circles
gives us a trust graph and no score ([circles.md](../protocols/circles.md)); EigenTrust is the
canonical algorithm for turning a trust graph into one, and OpenRank is a production implementation
with an SDK we could use rather than reimplement.

> `UNVERIFIED:` the agent was asked for the actual EigenTrust math — normalized local trust matrix
> **C**, the iteration **t⁽ᵏ⁺¹⁾ = Cᵀt⁽ᵏ⁾**, pre-trusted vector **p**, and the damped form
> **t = (1−a)Cᵀt + ap** — and never retrieved the paper. **The critical known limitation stands
> regardless and must be stated: EigenTrust's sybil resistance comes almost entirely from the
> pre-trusted peer set p.** Choose p badly and the score is capturable. For a Circles-based score,
> "who seeds p" is the central security question, not an implementation detail.

## The competitive picture

**Web3 aggregators that already exist:**

- **Human Passport** — the incumbent, described above.
- **idOS** ([docs.idos.network](https://docs.idos.network/)) — "identity operating system," a
  decentralised storage and access-management network for user data, chain-agnostic and open source,
  with an idOS Storage Network (L1) and a planned Economy Network on Arbitrum Orbit. **Announced work
  with Billions** ("idOS x Billions: Building Usable Decentralized Identity at Scale"). This is
  adjacent rather than identical — idOS is the *storage/consent* layer where credentials live, not a
  scoring router. Potentially a partner rather than a competitor. `UNCLEAR:` the agent flagged this
  one as possibly very close to our idea and did not finish evaluating it.
- **Quadrata** — Web3 passport network on Ethereum mainnet since 2022, proving "humanity and KYC/AML
  status." Reported operational; `UNVERIFIED:` no 2026 evidence found either way.
- **Anima Protocol** — searched twice, **nothing found**. Explicit negative result.

**Web2 KYC orchestration — the mature version of this business model:**

- **Alloy** — "orchestrates **270+ data solutions** into a single KYC onboarding workflow."
- **Trulioo GlobalGateway** — "partners with hundreds of data vendors," combining orchestration,
  onboarding workflow and risk management.
- IDVerse, Ping Identity, 1Kosmos — `UNVERIFIED:`, not found in results.

**The web2 orchestration layer is a fully mature, well-funded category, and it is exactly our
business model applied to KYC.** Alloy routing 270+ vendors is the same shape as routing personhood
protocols. That is strong validation of the *pattern* — and a warning that the eventual competitor may
be an incumbent orchestrator adding crypto sources rather than another crypto startup.

## What this means for our design

1. **Copy the two-tier shape.** A passive ML/behavioural prior for cold addresses, plus an active
   credential score for users who verify. Passport already proved the pattern and even documents the
   "double verification" combination.
2. **Steal Trusta's sybil pattern taxonomy** — star-like transfers, chain-like transfers, bulk
   operations, similar behaviour sequences. Concrete, testable, and directly applicable to a Circles
   graph score.
3. **Weights will be chosen, not derived.** Trusta's 25/30/15/10/20 is a judgement call published
   without justification. We should at least be honest that ours is too, and ideally tie weights to
   something falsifiable — realised fraud rate, as Gitcoin did.
4. **The Gitcoin fraud-tax number (6.6% → 0.6%) is our proof of value** and our evaluation metric.
5. **EigenTrust is the algorithm for the Circles graph — and `p` is the attack surface.** Use
   OpenRank rather than reimplementing.
6. **Consider per-ecosystem scores.** Nomis deliberately ships seven. A single global number may be
   the wrong product even if it is the better story.
7. **Our differentiation is credential quality, not aggregation.** Passport aggregates GitHub, Google
   and ENS — cheap, farmable signals. PoH v2, Circles topology, ZKPassport and World ID are
   cryptographic and expensive to fake. That is the gap.

## Open questions

1. Read [`TrustaLabs/Airdrop-Sybil-Identification`](https://github.com/TrustaLabs/Airdrop-Sybil-Identification) properly.
2. Get the actual EigenTrust paper math and decide how `p` gets seeded for Circles.
3. Evaluate idOS seriously — partner, competitor, or storage layer we should build on?
4. What are Trusta's and Nomis's actual prices? Neither publishes.
5. Is the GTC Staking stamp still live, and is staked-economic-cost a mechanism we want to copy?
6. What is Human Passport's stamp weighting — i.e. what makes 20 the threshold?

## Sources

- **Human Passport:** [Developer docs](https://docs.passport.xyz/) · [Models API introduction](https://docs.passport.xyz/building-with-passport/models/introduction) · [available models & recommended scores](https://docs.passport.xyz/building-with-passport/model-based-detection/available-models) · [double verification tutorial](https://docs.passport.xyz/building-with-passport/models/tutorials/double-verification) · [Scoring 20, for humans](https://support.passport.xyz/passport-knowledge-base/using-passport/scoring-20-for-humans) · [GTC staking](https://stake.passport.xyz/)
- **Gitcoin:** [WTF is Trust Bonus](https://www.gitcoin.co/blog/wtf-is-trust-bonus) · [Grants Verification Score](https://www.gitcoin.co/blog/trust-bonus) · [How is Trust Bonus calculated](https://support.gitcoin.co/gitcoin-knowledge-base/gitcoin-passport/commonly-asked-passport-questions/how-is-gitcoin-passports-trust-bonus-calculated) · [GR15 results](https://www.gitcoin.co/blog/gr15-results) · [Quadratic Funding](https://gitcoin.co/mechanisms/quadratic-funding)
- **Trusta Labs:** [MEDIA Indicator System](https://trusta-labs.gitbook.io/trustalabs/trustgo/media-indicator-system) · [MEDIA scoring methodology](https://trusta-labs.gitbook.io/trustalabs/trustgo/media-scoring-methodology) · [Sybil Score & MEDIA Score](https://trusta-labs.gitbook.io/trustalabs/trustscan/introduction-to-sybil-score-and-media-score) · [API reference](https://trustscan.readme.io/reference/query-media-score) · [Airdrop-Sybil-Identification](https://github.com/TrustaLabs/Airdrop-Sybil-Identification)
- **Nomis:** [docs](https://docs.nomis.cc/faq) · [Scores](https://docs.nomis.cc/core-primitives/scores) · [Score SBT](https://docs.nomis.cc/nomis-api/score-tokens) · [API](https://nomis.cc/about-api)
- **OpenRank / Karma3:** [openrank.com](https://openrank.com/) · [Karma3Labs](https://github.com/Karma3Labs) · [openrank-sdk](https://github.com/Karma3Labs/openrank-sdk) · [ts-eigencaster](https://github.com/Karma3Labs/ts-eigencaster) · [openrankprotocol](https://github.com/openrankprotocol)
- **Others:** [idOS docs](https://docs.idos.network/) · [idOS system design](https://docs.idos.network/how-it-works/system-design) · [Quadrata](https://quadrata.com/) · [Quadrata passport attributes](https://docs.quadrata.com/integration/introduction/passport-attributes) · [Alloy](https://www.alloy.com/) · [Trulioo GlobalGateway](https://www.trulioo.com/)
