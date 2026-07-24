# Sybil incidents & anti-patterns — what actually goes wrong

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). The agent got real numbers for LayerZero, Arbitrum
> and Gitcoin before dying. **Credential rental markets, social-graph attacks, and the aggregation
> anti-pattern literature were never researched** — and those were arguably the most important asks.

This file exists to keep us honest. Every other file describes what protocols *claim*. This one
records what has actually failed, with numbers.

## The scale of industrial farming

### LayerZero — the best-documented case

The most transparent sybil operation any protocol has run, and the numbers are sobering:

- LayerZero **initially flagged over 2 million addresses** as potential sybils, then applied stricter
  criteria to reduce false positives.
- Final published count: **803,093 sybil addresses** (announced 2024-05-18), identified jointly by
  LayerZero, **Chaos Labs** and **Nansen**. The full list was made **public**.
- **Self-report programme:** farmers could self-report for **15% of their intended allocation**, "no
  questions asked," deadline 2024-05-17. LayerZero's CEO said **up to 100,000 addresses
  self-reported**.
- **Bounty phase** (2024-05-18 → 05-31): the first person to report a sybil address received **10% of
  that address's intended allocation**.

Two lessons. First, **the gap between 2M initially flagged and 803k finally confirmed is the false-positive
problem in miniature** — over a million addresses were, on stricter criteria, not confidently sybil.
Any score we ship will live inside that same uncertainty band, and the cost of a false positive
(excluding a real human) is not symmetric with a false negative. Second, **LayerZero paid farmers
15% to confess and paid hunters 10% to snitch** — they bought information because detection alone was
insufficient. That is a striking admission from a well-resourced team.

### Arbitrum — detection that failed in a specific, learnable way

Per analysis by researcher **X-explore**, Arbitrum's sybil rules were exploited by
**279,328 same-person addresses and 148,595 sybil addresses** that slipped through.

Most usefully:

> Arbitrum's rules "were not effective in preventing Sybils with **fewer than 20 addresses**."

**Threshold-based detection systematically misses small operators.** A farm of 200 wallets gets
caught; 200 farms of 15 wallets each do not. This is the single most actionable failure mode in this
file, and it argues directly for *per-identity credential verification* over *cluster detection* —
which is our thesis. It also warns that any clustering component we build will have the same blind
spot.

Arbitrum published [`ArbitrumFoundation/sybil-detection`](https://github.com/ArbitrumFoundation/sybil-detection).
Note that Starknet's community forum ran a thread explicitly titled *"Arbitrum Airdrop Sybil Loophole:
Proposed Measures to Address the Issue for the StarkNet Project"* — protocols do learn from each
other's failures in public.

### Gitcoin — the quantified case

- **GR15 Fraud Report:** "Contributor Fraud (Sybil Donations) Prevented amounted to **$285k**,
  affecting **23% of contributors**." Nearly a quarter of contributors in a major round were
  fraudulent.
- Gitcoin's stated model is three-layered: **"humans, algorithms and passports"** — Passport
  proactively vets before participation, algorithms retrospectively detect during the round, and
  humans "resolve disputes and provide subjective input… as well as setting thresholds and round
  eligibility requirements."
- **The human layer never goes away.** Every mature deployment in this file keeps a manual dispute
  path. We should design for one from the start rather than pretending a score is final.
- **GG19 was "the first round in years without closed-source elimination of Sybils/donors"**, moving
  instead to a clustering-based QF variant that "moves Sybil and collusion resistance natively inside
  the mechanism." That is a genuinely different philosophy — instead of filtering people out, change
  the payout function so that collusion doesn't pay. Worth considering as an alternative to scoring
  altogether for some use cases.
- By **GG23**, Gitcoin was defended with **model-based sybil detection** from Human Passport.

Passport's own current framing, which is a good description of a mature product shape:

> "Passport Stamps, Direct zk Verification, and Machine Learning Sybil Classification are **modular
> and can be combined**, either individually or stacked to build the protection model that fits your
> ecosystem."

Note a **discrepancy worth resolving**: this source describes the model score as **0 to 100**
("closer to 0 indicates a higher likelihood of the address being a Sybil"), while the Models API docs
describe a range of **−1 to 100** (see [scoring-and-prior-art.md](scoring-and-prior-art.md)). Probably
−1 is a sentinel for "no data." Check before consuming.

**Direct pointer for us:** the actual stamp weights are in source control at
[`passportxyz/passport-scorer` → `api/scorer/settings/gitcoin_passport_weights.py`](https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py).
**That file is the closest thing to a published answer to "how much is each credential worth," and its
git history is a record of how those weights changed after each attack.** Reading that history is
probably the single highest-value hour of research available to this project.

## Anti-patterns to design against

Drawn from the above plus the structure of the incidents:

1. **Threshold detection misses small farms.** (Arbitrum, <20 addresses.) Any cluster-based component
   must be paired with per-identity credentials.
2. **False positives are expensive and asymmetric.** LayerZero's 2M → 803k revision. Excluding a real
   human is a worse product failure than admitting a sybil, but scores get tuned as if they're equal.
3. **A published score becomes a target.** Once a threshold is public (Passport's 20), farming
   optimises to just clear it. This is Goodhart's law and it is unavoidable for any public threshold —
   which is an argument for score *distributions* and per-consumer thresholds rather than one blessed
   number.
4. **Buying information beat detection.** LayerZero's self-report and bounty economics suggest
   incentive design may outperform pure classification.
5. **Keep a human dispute path.** Every mature system has one.
6. **Consider mechanism-level resistance instead of filtering.** GG19's clustered QF changes the
   payoff rather than the eligibility.

## What was never researched — and matters

The agent was explicitly asked for these and **died before reaching any of them.** Their absence is
not a finding; these are open holes, and several are directly load-bearing for our design:

- **Credential rental and resale markets.** Reported World ID orb-verified account black markets
  (Cambodia/China, 2023–24) with price points; Passport stamp selling; BrightID connection farming;
  SMS-PVA phone-verified account markets; aged Twitter/Discord/Reddit account marketplaces; and
  "KYC-as-a-service" farms where people rent their identity documents for exchange onboarding.
  **This is the most important gap in the whole salvage.** Our entire value proposition assumes
  credentials are hard to obtain fraudulently; the rental market is the direct counter-evidence, and
  we have zero data on it. Note that [Unitap already designs against credential rental](attestation-layers-and-adjacent.md)
  with periodic re-linking — someone considers it a live threat.
- **Social-graph attacks** — BrightID's documented weaknesses, any Circles trust-graph attack
  analysis, PoH vouching abuse and the PoH/Democracy Earth fork history, Kleros registry challenges.
  Directly relevant to any Circles-derived score.
- **Hop, Optimism airdrop 1, zkSync, Starknet, Blast, Linea sybil filtering numbers** — searched,
  no results captured.
- **Score gaming** of Trusta MEDIA, Nomis, Galxe, Layer3, Zealy; Farcaster/Warpcast bot cleanups.
- **Aggregation-specific literature** — Goodharting composite scores, whitewashing and re-entry
  attacks in reputation systems, "reputation laundering." **This is the academic grounding for hard
  problem #2 in our [README](../../README.md) and we have none of it.**
- Worldcoin regulatory bans (searched here, no results captured; also a gap in
  [world-id.md](../protocols/world-id.md)).

## Open questions

1. Read the git history of `gitcoin_passport_weights.py` — how did weights change after each attack?
2. Research credential rental markets properly. Prices, volumes, which credentials are rentable.
3. What is the false-positive rate of any deployed sybil score? Nobody publishes one.
4. Does whitewashing/re-entry literature offer a defence we can adopt?
5. Should thresholds be per-consumer and private rather than a single public number?

## Sources

- **LayerZero:** [self-report conclusion, 803,093 addresses (X)](https://x.com/LayerZero_Core/status/1791622471965163597) · [self-report terms (X)](https://x.com/LayerZero_Core/status/1786441554816532646) · [Invezz](https://invezz.com/news/2024/05/20/layerzero-flags-over-800k-sybil-addresses-in-airdrop-farming-crackdown/) · [The Block — 100k self-reported](https://www.theblock.co/post/294230/layerzero-labs-ceo-says-up-to-100000-addresses-have-self-reported-as-airdrop-sybils) · [The Defiant](https://thedefiant.io/news/defi/layerzero-labs-identifies-800-000-potential-sybil-addresses-in-public-list)
- **Arbitrum:** [X-explore analysis](https://mirror.xyz/x-explore.eth/AFroG11e24I6S1oDvTitNdQSDh8lN5bz9VZAink8lZ4) · [ArbitrumFoundation/sybil-detection](https://github.com/ArbitrumFoundation/sybil-detection) · [$ARB airdrop eligibility spec](https://docs.arbitrum.foundation/airdrop-eligibility-distribution) · [Starknet forum — Arbitrum sybil loophole](https://community.starknet.io/t/arbitrum-airdrop-sybil-loophole-proposed-measures-to-address-the-issue-for-the-starknet-project/54545) · [Beosin analysis](https://beosin.com/resources/a-closer-look-at-the-anti-sybil-mechanism-under-the-arbitrum)
- **Gitcoin:** [GR15 Fraud Report](https://gov.gitcoin.co/t/gr15-fraud-report/11609) · [Insights from GR15 identity analysis](https://gov.gitcoin.co/t/insights-from-gr15-identity-analysis/11866) · [A Community Based Roadmap for Sybil Detection](https://www.gitcoin.co/blog/a-community-based-roadmap-for-sybil-detection-across-web-3) · [Sybil attack vectors](https://support.gitcoin.co/gitcoin-knowledge-base/about-gitcoin/policy/understanding-potential-attack-vectors/sybil-attack) · [FDD Sybil defense model (HackMD)](https://hackmd.io/@jmcook/SJpaeH_3q)
- **Passport internals:** [passport-scorer weights file](https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py) · [passport-scorer](https://github.com/passportxyz/passport-scorer) · [stamp weights KB](https://support.passport.xyz/passport-knowledge-base/stamps/how-is-gitcoin-passports-score-calculated) · [Defending GG23 with model-based Sybil detection](https://human.tech/blog/human-passport-x-gitcoin-grants-defending-gg23-with-model-based-sybil-detection)
