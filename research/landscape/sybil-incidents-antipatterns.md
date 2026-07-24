# Sybil incidents & antipatterns — the empirical record

> STATUS: in progress (started 2026-07-24)

**One-liner:** What has actually gone wrong in sybil-resistance systems, with numbers and primary
sources — airdrop farming, personhood-credential trading, human/click farms, and attacks on
aggregate scores.
**Category:** cross-cutting evidence file (not a protocol write-up — the BRIEF.md template is
adapted, not followed literally)
**Retrieved / date-stamped:** 2026-07-24 unless otherwise noted.
**Aggregator verdict:** N/A — this file exists to constrain our design so we do not rebuild a
failure that is already documented.

**The single most important framing**, from Ohlhaver & Nikulin's Idena study: a protocol can
*succeed completely* at filtering bots and *still* fail at sybil resistance, because the humans it
verified become **de facto sybils** — real, unique, verified people acting as programmable puppets
for a high-information operator. At Idena's peak (May 2022), **23 entities — under 1% of distinct
entities — controlled ≥40% of accounts and almost half of rewards**
(`/home/hugo/Projects/poh-aggregator/research/references/ohlhaver-ethberlin-2024-transcript.md`;
paper: *Compressed to Zero: The Silent Strings of Proof of Personhood*, 2024). Every number in this
file should be read against that framing: **detection numbers measure bots, not control.**

---

## 1. The airdrop-farming industry

Airdrop farming is the best-instrumented sybil laboratory we have: the reward is a token with a
market price, the substrate is a public ledger, and several teams published their detection
methodology. It is the closest thing to a controlled experiment on "what does a funded adversary do
to a uniqueness gate."

### 1.1 Case table

| Event | Date | Scale of sybil finding | Detection method | Outcome |
|---|---|---|---|---|
| **Hop Protocol** | 2022-05 | **10,253 of 43,058** eligible addresses flagged sybil (~23.8%) | Transfer-graph connected components + funding-source clustering + timing/gas correlation; community bounty | Excluded from airdrop; self-reporting sybils kept 25% of allocation |
| **Optimism airdrop #1** | 2022-06 | ~17k addresses removed pre-drop (see §1.3, UNVERIFIED exact figure) | Manual + heuristic clustering | Excluded |
| **Arbitrum** | 2023-03 | Foundation published its own sybil-detection code and lists | Open-sourced heuristics repo (`ArbitrumFoundation/sybil-detection`) | Excluded; large community dispute over false positives |
| **Aptos** | 2022-10 | Widely-reported mass farming of testnet/NFT criteria | X-explore on-chain analysis | Little clawback; farmers profited |
| **LayerZero** | 2024-05 | **803,093 addresses** identified as sybil (see §1.2 — the self-report bounty) | Self-report + bounty hunting + LayerZero/Chaos Labs/Nansen analysis | Self-reporters kept 15%; the remaining 85% redistributed |
| **zkSync** | 2024-06 | Criteria deliberately *not* anti-sybil; team stated sybils were expected to pass | Volume/duration criteria only | No meaningful clawback |
| **Starknet** | 2024-02 | Criteria excluded most farmed wallets by requiring pre-2023 activity + GitHub/staking identity | Eligibility design rather than detection | Farmers largely excluded by *criteria*, not by *detection* |
| **Blast** | 2024-06 | Points system; farm concentration heavily reported | Points-based, weak dedup | Farmers profited |
| **Linea** | 2024-2025 | **~516,960–654,443** LXP addresses flagged sybil out of ~1.29M (≈40–50%) | Nansen behavioural + cluster analysis on LXP holders, "precision over recall" | Excluded; appeals window opened |
| **EigenLayer** | 2024-05 | Geographic exclusions + farming controversy | Eligibility + geo-blocking | Large community backlash |

> **Honesty flag.** The rows above vary a lot in source quality. The Hop, LayerZero and Linea rows
> are the ones with hard published numbers and are detailed below. The Optimism, Aptos, zkSync,
> Starknet, Blast and EigenLayer rows are, at time of writing, from secondary reporting and are
> marked `UNVERIFIED` where I could not reach a primary artifact. Do not quote them as precise.

### 1.2 LayerZero's self-reporting bounty — the genuinely novel mechanism

This is the one design in the airdrop record that is worth studying as a *mechanism*, not just as a
detection exercise. LayerZero (May 2024) ran a three-stage process:

1. **Self-report window.** Any address that admitted to being a sybil received **15% of its
   intended allocation**; the other 85% went back to the qualified pool. Reported at the time as
   *up to 100,000 addresses self-reporting*
   ([The Block, 2024-05](https://www.theblock.co/post/294230/layerzero-labs-ceo-says-up-to-100000-addresses-have-self-reported-as-airdrop-sybils)).
2. **Bounty hunting.** Third parties could report sybil clusters; a valid report required a
   **minimum of 20 addresses plus a written, reproducible methodology**, and the *first* eligible
   reporter of each address earned **10% of that address's intended allocation**.
3. **In-house + vendor analysis** by LayerZero, **Chaos Labs** and **Nansen**.

Combined result, announced by LayerZero: **803,093 addresses** identified as sybil, refined down
from an initial >2M flagged under looser criteria
([@LayerZero_Core, 2024-05-17](https://x.com/LayerZero_Core/status/1791622471965163597);
secondary: [Cointelegraph](https://cointelegraph.com/news/layerzero-concludes-sybil-self-reporting-phase),
[crypto.news](https://crypto.news/layerzero-spots-800k-sybil-addresses-airdrop-scheme/)).

**Why the mechanism is interesting.** It is a *separating equilibrium* device. A farmer who knows
their cluster is detectable takes a guaranteed 15% rather than a coin-flip on 0%. A farmer who
believes their cluster is undetectable holds. The bounty layer then attacks exactly the second
group and moves their expected value down. It converts detection from a cost centre into a market,
and it extracts a *confession* — self-reported clusters are ground truth, which is enormously more
valuable for training the classifier than any heuristic label.

**Why it does not save us.** Three limits, all relevant to an aggregator:

- It only works when there is **a large, divisible, one-shot prize** to bargain with. A personhood
  credential has no allocation to claw back. We cannot offer a farmer 15% of a humanity score.
- It prices *detectability*, not *sybil-ness*. The equilibrium reveals the farmers who fear
  detection. The ones with good opsec — precisely the high-information operators of the Idena
  study — rationally stay silent, and the announced 803,093 is therefore a **lower bound on the
  farm population and an upper bound on the population the team could act against**.
- `UNVERIFIED:` I could not reach `sybil.layerzero.network` on 2026-07-24 (DNS `ENOTFOUND`), so the
  official rules document and final list appear to be offline. The mechanism's *post-hoc*
  evaluation (how many bounty reports were accepted, precision/recall) does not appear to have been
  published. Next place to look: LayerZero Labs' GitHub, the Chaos Labs blog, and Nansen's research
  archive.

### 1.3 Hop Protocol (2022) — the template everyone copied

Hop's May 2022 airdrop found **10,253 sybil addresses out of 43,058 eligible (~23.8%)**. The
detection criteria Hop published and the community applied — and that essentially every later
airdrop reused — were:

- a common parent funding address, or a common collection address that funds are swept to;
- batch transfers within a short window;
- identical gas parameters across addresses;
- near-identical interaction sequences and asset amounts against the protocol's contracts.

Hop also ran the first version of the two mechanisms LayerZero later refined: a **bounty**
(minimum 20 addresses per report) and a **self-report** discount (self-identified sybils kept 25%
of allocation). The community reports are still readable as raw evidence — the
`hop-protocol/hop-airdrop` issue tracker contains hundreds of "Sybil Attacker Report" issues with
address lists and the reporter's reasoning, e.g.
[issue #267](https://github.com/hop-protocol/hop-airdrop/issues/267),
[#192](https://github.com/hop-protocol/hop-airdrop/issues/192),
[#332](https://github.com/hop-protocol/hop-airdrop/issues/332). This is unusually good primary
material: it shows what the detectable farmer of 2022 looked like.

The academic write-up of the same dataset is *Fighting Sybils in Airdrops*
([arXiv:2209.04603](https://arxiv.org/pdf/2209.04603)), which formalises two farm topologies:
**star** (one treasury funds N leaves) and **chain** (funds pass A→B→C, each interacting on the
way). Its core observation is that detection works on **activity-sequence similarity plus token
flow**, not on any property of the individual account. That matters for us: **no per-account
check would have caught these clusters. Only the graph did.**

### 1.4 Linea (2024–2025) — the largest published flag rate

Linea partnered with Nansen to analyse LXP holders. Reported outcome: roughly **516,960 of
1,297,203 eligible addresses** flagged in the main pass (reducing eligible to ~780,243), with a
subsequent list adding a further tranche and reporting cited as high as **654,443 unique addresses
(50.45%)**
([The Block, 2024](https://www.theblock.co/post/335979/linea-filters-over-half-a-million-sybil-addresses-from-upcoming-token-airdrop);
[PANews on the later 476k tranche](https://www.panewslab.com/en/articles/yc4pozpa)).
Nansen's stated posture was **precision over recall** — deliberately under-flagging to avoid
false positives.

`UNCLEAR:` the exact reconciliation between the ~517k, ~476k and ~654k figures reported at
different dates. Nansen's original article (`research.nansen.ai/articles/linea-airdrop-sybil-detection`)
now 301-redirects to `nansen.ai/blog` (checked 2026-07-24) — **the methodology page is gone**.
Treat the specific numbers as approximate; the robust claim is **~40–50% of a 1.3M-address
incentive program was farm.**

**The one durable statistic from this whole section: on every incentive program that has published
a number, the sybil share of participating addresses lands between ~20% and ~50%.** That is the
prior you should hold for any unguarded, money-carrying gate on the open internet.

### 1.5 Farm economics — the floor cost

This is the number that actually determines whether a credential resists a funded adversary.

`UNVERIFIED (rough orders of magnitude — see caveat):` the commonly-cited working figures in the
farming community are on the order of **$1–$20 of gas and bridge cost per wallet** for an EVM
airdrop farm, against expected values that ran into the hundreds or thousands of dollars per wallet
in the 2021–2024 cycle. That ratio — not any cryptographic property — is why farms scale to
hundreds of thousands of wallets.

Structural features of the industry that are well-attested and matter more than the exact prices:

- **Farm-as-a-service.** Tooling is commoditised: wallet-generation and activity-scripting suites,
  anti-detect browsers (multi-profile browsers with per-profile fingerprints), residential proxy
  pools sold per-GB or per-IP, and SMS/phone-number rental by the minute. A farmer does not build
  any of this; they rent it.
- **Labour arbitrage.** Where a task genuinely requires a human (liveness check, CAPTCHA, KYC
  selfie, an in-person scan), the operator does not do it themselves — they buy the human's
  *minutes* in a low-wage jurisdiction. This is the exact mechanism Ohlhaver identifies at Idena
  ($2–$4 per participant per validation ceremony) and Singapore Police documented at World ID
  (see §2.1).
- **Consequence:** the cost of a "human-verified" credential converges to *the local price of a
  human's ten minutes*, not to the cost of defeating the biometric.

`UNVERIFIED:` I have not found a single authoritative, primary, dated price list for wallet-farm
services. Do not put a specific dollar figure in a public deck without sourcing it. Where to look
next: academic measurement papers on residential-proxy and anti-detect-browser markets, and
Chainalysis / TRM / Nansen industry reports.

---

## 2. Personhood-credential-specific incidents

### 2.1 World ID — Orb-verified account trading (the flagship case)

**The claim.** ZachXBT published an investigation on **2026-04-27/28** documenting an open market
in Orb-verified World ID accounts, including a screenshot of **Orb-verified accounts listed on
escrow platforms for as little as $0.50 each**. His framing: a system built to prove human
uniqueness "spawned the opposite: a thriving underground trade in biometric credentials"
(secondary coverage:
[Crypto Times, 2026-04-28](https://www.cryptotimes.io/2026/04/28/scam-altman-musks-jab-meets-zachxbt-claim-as-worldcoin-faces-fresh-scrutiny/);
[Stocktwits](https://stocktwits.com/news-articles/markets/cryptocurrency/sam-altman-openai-worldcoin-black-market-speculation/cZB8ziyRedh)).

`UNVERIFIED:` I could not reach ZachXBT's original post directly. The **$0.50 floor is
corroborated across the secondary coverage; the $15 upper bound cited in our task brief is not**
— the figures I could corroborate are the $0.50 escrow listings and an earlier (2023-05) range of
**~$1.40 for a basic account to ~$70 for a fully verified one on Chinese platforms including
Taobao**. Next place to look: ZachXBT's Telegram channel `@investigations` and his X timeline for
2026-04-27/28.

**The much stronger evidence — Singapore, 2024.** This is the primary-source case, because it is a
police action with seizures, not a screenshot:

- Singapore Police investigated **seven** people and **arrested five** (four men, one woman) for
  offering to buy/sell Worldcoin accounts and tokens.
- Modus operandi as described by police: **three men recruited people on behalf of entities to
  create Worldcoin accounts, then took control of those accounts and tokens in exchange for cash**;
  the credentials were then passed to a fourth man and a woman who managed transfer and resale.
- **Over 200 mobile phones were seized** as evidence.
- SPF issued a public advisory (2024-08-07) warning that surrendered Worldcoin accounts may be
  misused for **money laundering and terrorism financing**. The charging theory was under the
  **Payment Services Act 2019** — trading the accounts constituted an unlicensed payment service,
  even though Worldcoin itself is not a payment service.

Sources: [Singapore Law Watch](https://www.singaporelawwatch.sg/Headlines/7-under-police-probe-for-allegedly-buying-and-selling-worldcoin-accounts),
[The Star, 2024-09-15](https://www.thestar.com.my/aseanplus/aseanplus-news/2024/09/15/seven-under-singapore-police-probe-for-allegedly-buying-and-selling-worldcoin-accounts),
[Cointelegraph](https://cointelegraph.com/news/worldcoin-singapore-investigation-money-laundering-terrorism-financing).
`UNVERIFIED:` MAS's own parliamentary reply page returned a maintenance page on 2026-07-24 — retry
`mas.gov.sg/news/parliamentary-replies/2024/...` later for the authoritative wording.

**Read the Singapore modus operandi carefully. It is not account *theft*. It is recruitment of real
humans to be verified, followed by transfer of control.** That is Idena puppeteering, executed
against an iris-biometric system, and it demonstrates the central thesis: *the biometric worked
perfectly and provided no sybil resistance.* Each of those 200+ phones held a genuinely unique,
genuinely live-verified human's World ID, and one operator held all of them.

Worldcoin's own acknowledgment at the time was "a few hundred instances" of fraud among ~1.7M
signups — a figure that is difficult to reconcile with 200 phones seized in one Singapore
operation alone.

