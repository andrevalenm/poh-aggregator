# Raw behavioural & heuristic signals

> STATUS: in progress — restarted 2026-07-24 after a host power failure destroyed the first pass.
> Sections 1 and 2 are written; 3-7 in progress.

**One-liner:** The evidence class that is free on every user and the weakest in the taxonomy —
behavioural signals measure *effort*, *non-automation* and *correlation*, and never *uniqueness*.
**Category:** behavioral (BRIEF.md §1, class 5)
**Chains:** chain-agnostic; practically EVM (Ethereum + L2s) + Solana where an indexer exists
**Status (2026-07):** N/A — this file describes a signal class, not a protocol
**Aggregator verdict:** **Build a narrow subset; treat most of it as theatre.** Behavioural signals
are worth building for exactly two jobs: (a) **negative evidence at the population level** —
cross-protocol correlation detectors that flag *clusters*, not individuals; and (b) a **cost floor**
(proof-of-cost / hardware attestation) that changes farm unit economics. They are worth close to
nothing as *positive* per-user evidence of humanity, and §6's base-rate arithmetic shows that using
them to gate individual users at plausible sybil rates produces mostly false positives — i.e. it
excludes real humans from money. Recommended aggregate contribution to a personhood score: **cap the
entire behavioural class at ~10-15% of maximum score, and never let it be sufficient on its own.**

---

## 0. Framing: what this class can be evidence *of*

Three distinct propositions get conflated under "behavioural signals". Keep them apart, because they
have different costs to fake and different legal exposure:

| Proposition | Signal family | What it buys us |
|---|---|---|
| **P1 — not automated** | timing distributions, session dynamics, interaction diversity | Weak. Automation is cheap to humanise; a human doing 100 accounts defeats it entirely (Ohlhaver's puppets). |
| **P2 — costly to have produced** | account age, gas spent, stake, hardware attestation, paid tiers | The strongest thing in this class. Doesn't prove a human; proves *money was spent*. |
| **P3 — not correlated with a cluster** | funding-graph structure, timing synchrony, invitation-forest concentration, cross-protocol co-registration | The only proposition where an *aggregator* has an intrinsic advantage over any single protocol. |

Ohlhaver's central result is that P1 and P2 both fell to a determined operator on Idena while P3 was
the thing that actually detected the attack — and even P3 detected *key-sharing*, not exploitation
(`research/references/ohlhaver-corpus.md` §1.5). Our design should follow that ordering.

**The load-bearing asymmetry:** P3 evidence is *negative and relational*. It never says "this is a
human"; it says "these 2,754 accounts are one entity". That is a discount function on a group, not a
score on a person. Our data model must be able to express it — see §6.4.

---

## 1. On-chain behavioural signals, and what each costs to fake

Cost figures below are **per sybil identity** unless stated. The reference adversary is a
professional airdrop farm, because that is the only behavioural-sybil economy with published
numbers: LayerZero's 2024 airdrop ended with **803,093 addresses flagged as sybil**, refined down
from an initial set of **over 2 million**, via a combination of a self-report amnesty (~100k
addresses took 15% of allocation), a community bounty, and analysis by Chaos Labs and Nansen
([LayerZero announcement, 2024-05-17](https://x.com/LayerZero_Core/status/1791622471965163597);
secondary: [Cointelegraph](https://cointelegraph.com/news/layerzero-concludes-sybil-self-reporting-phase),
[The Block on the bounty pause](https://www.theblock.co/post/295274/layerzero-labs-ceo-announces-pause-of-sybil-bounty-hunter-process-after-influx-of-reports)).
That is the scale of the industry we are pricing against: **six figures of addresses is a routine
farm output, not an outlier.**

### 1.1 Account age / first-seen timestamp

- **What it is:** block timestamp of the address's first outbound tx (or first inbound funding).
- **What it discriminates:** nothing about humanity. It discriminates *pre-meditation*: an address
  created before the target program was announced could not have been created *for* it.
- **Cost to fake:** ~**$0**, only *forethought*. Farms create wallet inventory continuously and
  cheaply; a wallet created today costs one L2 transaction (sub-cent post-EIP-4844) and becomes a
  "2-year-old wallet" in two years at zero marginal cost. There is a live market in pre-aged
  accounts across Web2; for wallets the "aging" is done in-house because it is nearly free.
  **UNVERIFIED:** I did not find a credible price quote for aged EVM wallets from a primary source;
  farming-vendor blogs discuss aging as a practice but do not publish a wallet spot price. Next
  place to look: OTC channels indexed by Nansen/Arkham research posts, or the LayerZero bounty
  submission corpus if it was ever published.
- **Verdict:** *Retrospective* age (relative to a fixed cutoff we did not announce) is mildly useful.
  *Prospective* age is worthless. **Never let age alone add score.**

### 1.2 First-funding source and its provenance

- **What it is:** the address(es) that first sent value to this address, and what *they* are —
  a CEX hot wallet (which implies a KYC'd deposit somewhere upstream), a bridge, a mixer, or another
  fresh EOA.
- **What it discriminates:** funding from a *KYC'd* CEX withdrawal is the single most informative
  on-chain fact available, because it implies a real exchange account existed. Funding from a fresh
  EOA that was itself funded by a fresh EOA is the canonical farm topology.
- **Cost to fake:** CEX-provenance costs whatever a KYC'd exchange account costs. This is the
  binding constraint on farms and it is **not** free: it requires documents and, increasingly,
  liveness. But it is *rentable* — the documented KYC-account rental market is covered in
  `landscape/sybil-incidents-antipatterns.md`; my scope stops at noting that the cost is
  "one rented KYC account", not "one wallet".
- **Verdict:** **Worth building.** CEX-funding provenance is the highest-value single on-chain
  feature we can compute. It is also the one most likely to be already covered by a vendor
  (Chainalysis/TRM/Nansen entity labels) rather than by us.

### 1.3 Gas-payment patterns

- **What it is:** gas price / priority fee selection over time, and *who paid* (self-paid vs.
  sponsored via ERC-4337 paymaster / relayer).
- **What it discriminates:** Béres, Seres, Benczúr & Quintyne-Collins showed **gas-price selection
  is a genuine quasi-identifier** — users have idiosyncratic, persistent fee-selection habits that
  help link addresses to the same owner ("Blockchain is Watching You: Profiling and Deanonymizing
  Ethereum Users", arXiv:2005.14051, 2020, https://arxiv.org/abs/2005.14051; validated against ENS
  ground truth). Note the direction of that result: it is a **linkage** tool, i.e. a P3 signal, not
  a humanity signal.
- **Cost to fake:** ~$0 to *randomise* (any farm script can jitter gas). But note the asymmetry: a
  farm that does *not* bother is trivially clustered, and historically most did not. Default wallet
  behaviour (everyone using MetaMask's suggested fee) also destroys the signal for honest users.
- **Verdict:** Use as a **clustering feature only**, never as a personhood feature.

### 1.4 Transaction timing distributions — circadian vs. bot schedules

This is the cheapest real discriminator in the class and deserves precision.

- **The signal:** bin an address's transaction timestamps into 24 hourly bins (UTC), normalise, and
  compare. Humans produce a **unimodal, timezone-anchored diurnal curve with a sleep trough**; naive
  bots produce either a **flat** distribution (uniform over 24h) or a **spiky periodic** one
  (cron at :00, fixed inter-arrival times).
- **Primary literature:** Béres et al. (arXiv:2005.14051) build exactly this — a *time-of-day
  activity histogram in hourly bins*, alongside mean/median/sd of gas price — as one of three
  quasi-identifier families (the third being graph position via representation learning), and show
  it contributes to successfully linking Ethereum addresses to a common owner, using ENS names as
  ground truth. They also apply it to Tornado Cash to link mixing parties.
  **UNCLEAR:** I could not extract per-feature ablation numbers (how much time-of-day alone
  contributes vs. gas price vs. graph embedding) — the arXiv PDF did not parse cleanly for me.
  Next step: pull the HTML/ar5iv rendering or the authors' code
  (search GitHub for `ferencberes` / `ethereum-profiling`) and read Table 3-5 directly.
- **Two distinct statistics, do not conflate:**
  1. **Trough depth** (is there a sleep gap?) — evidence for P1 (not automated). Cheap to fake:
     a farm simply schedules within a 16h window. Cost: one line of cron config, **~$0**.
  2. **Inter-arrival regularity** (Kolmogorov–Smirnov against exponential; autocorrelation at fixed
     lags; digit-level clustering of second-of-minute) — evidence for P1, and harder to fake well
     because *realistic* jitter is a modelling problem, not a randomisation problem. Still cheap:
     **hours of engineering, amortised across the whole farm.** That amortisation is the point —
     any per-farm fixed cost divides by 800,000.
  3. **Cross-address trough *alignment*** — do 500 addresses share the *same* sleep window to the
     minute? This is a P3 signal and is much more expensive to defeat, because defeating it requires
     the farm to give each identity an *independent* schedule, which fights against the farm's own
     operational convenience. See §2.1.
- **Honest caveat:** timezone-anchored diurnal structure is also produced by *any* scheduled process
  run by a human operator during their own working day. And it is *absent* from real humans who
  transact three times a year. The signal has almost no power on low-activity addresses, which is
  most real users.
- **Verdict:** **Build the cross-address alignment statistic (§2.1). Do not build a per-address
  "does this look human" timing score** — it fails on sparse honest users and is defeated for
  ~$0 marginal cost by any farm that reads this file.

### 1.5 Interaction diversity and contract sophistication

- **What it is:** count of distinct contracts/protocols touched, breadth across categories (DEX,
  lending, NFT, bridge, governance), depth of unusual call paths, use of features a script wouldn't
  bother with (setting an ENS reverse record, voting in a DAO, revoking an approval).
- **Cost to fake:** this is the *headline* farm cost, because it is the one thing that must be paid
  **per identity** rather than amortised. Every "diverse" interaction is a real transaction with
  real gas and often real capital at risk (a swap has slippage; a lending position has rate risk).
  Rough order of magnitude for a credible farmed identity on an L2 in 2026: **tens of dollars of
  gas + slippage + bridge fees per wallet**, plus working capital that must be recycled. Farming
  guides quote **$50-500 of starting capital and 6-12 months of activity per identity**
  (secondary, self-serving: [zipmex farming guide, 2026](https://zipmex.com/blog/how-to-farm-airdrops-in-2026/)).
  Multiply by 800,000 and the LayerZero farm was a **materially capitalised industry**, which is
  itself the reason the signal has any value at all.
- **The catch:** cost-to-fake is high *per wallet* but the farm only needs the wallets that survive
  filtering to be profitable in expectation. And it discriminates **wealth and crypto-nativeness**,
  not humanity — a first-time user with one transaction scores identically to a bot.
- **Verdict:** This is a **user-quality / anti-airdrop-farming signal**, and it is the core of the
  commercial products (Trusta's MEDIA score explicitly allocates Monetary 25 / Engagement 30 /
  Diversity 15 / Identity 10 / Age 20 points —
  https://trusta-labs.gitbook.io/trustalabs/trustgo/media-scoring-methodology). It is **not a
  personhood signal** and we must not launder it into one. Reference
  `landscape/reputation-scoring-products.md` for the vendors.

### 1.6 Counterparty graph structure

- **What it is:** the shape of the address's transaction neighbourhood — degree, clustering
  coefficient, whether counterparties are themselves in a dense component, embedding position.
- **Cost to fake:** to look *organic*, a farm's wallets must transact with the *outside* world, not
  each other — and every such edge costs money that leaves the farm. Making 800k wallets each have
  independent external counterparties is genuinely expensive. Making them *look* independent by
  routing through a shared DEX (everyone swaps on Uniswap) is free, but that produces near-zero
  discriminating structure for honest users too.
- **Verdict:** Only usable as a **cluster detector** (§2.2), not as a per-user score.

### 1.7 Funding-graph clustering — the classic tell

- **What it is:** the four canonical farm topologies, as catalogued by Trusta Labs over "Asset
  Transfer Graphs": **star-like divergence** (many addresses funded from one source),
  **star-like convergence** (many addresses sweeping to one target), **tree-structured**
  (hierarchical distribution), and **chain-like** (A→B→C→D sequential)
  (https://trusta-labs.gitbook.io/trustalabs/trustscan/introduction-to-sybil-score-and-media-score;
  open-source implementation, GPL-3.0: https://github.com/TrustaLabs/Airdrop-Sybil-Identification).
  Trusta's pipeline is two-phase: partition the ATG into connected components, run community
  detection (Louvain / K-core) to split large components into dense subcommunities, then refine with
  a k-means-style behavioural pass over transactional variables (first/last tx date, contracts
  touched) and profile variables (amount, frequency, volume), excluding addresses beyond a distance
  threshold from the cluster centroid. **The numeric thresholds are not disclosed.**
- **Cost to fake:** **low to moderate, and falling.** Breaking a funding star requires only that the
  farm launder the funding hop — through a CEX (deposit from one account, withdraw to N addresses),
  a bridge, or a mixer. Each break costs a fee and some latency, not a redesign. The published
  farming literature treats this as solved practice.
- **Verdict:** **Build it, but expect it to catch only the lazy tier.** Its real value is in
  combination — see §2.2 and §2.3, where funding structure is used to *collapse entities* rather
  than to *flag individuals*.

### 1.8 Dust, consolidation and sweep patterns

- **What it is:** many addresses receiving identical or near-identical amounts within a short window
  (distribution), or many addresses sending their entire balance to one destination within a short
  window (sweep/consolidation). Also: sending *exactly* the balance minus gas, which no human does
  deliberately at scale.
- **What it caught, historically:** this is precisely Ohlhaver & Nikulin's primary Idena signature —
  *"Blocks of one-way transfers at the same time to the same wallet implied automation, which would
  require 3rd party access to a participant's private keys"* (Compressed to 0, p.9; see
  `research/references/ohlhaver-corpus.md` §1.3).
- **Cost to fake:** **cheap to break, if you know to.** Stagger the sweep over days, vary amounts,
  route through intermediate hops. The Idena farms did not bother — but they had no adversary.
  After a public detection, the same farms would.
- **Verdict:** **High value now, decaying.** Build it; do not assume it keeps working.

### 1.9 NFT / DeFi history and "sophistication"

Same analysis as §1.5. One extra note: NFT ownership is a **purchasable** credential and NFT
transfer history is cheap to manufacture (wash-trade with yourself for gas). Treat NFT holdings as
**wealth evidence at best** and probably as noise. **Do not use.**

### 1.10 Cross-chain footprint

- **What it is:** does the same identity have coherent activity on multiple chains, and is the
  bridging pattern natural (bridge → use → bridge back) or farm-shaped (bridge in, one tx, bridge
  out, next wallet)?
- **Cost to fake:** each additional chain multiplies the per-identity gas/capital cost of §1.5,
  so this is one of the few places where cost genuinely scales with the signal. But it is a
  **linear** multiplier on a cost that is already being paid by professional farms.
- **The aggregator-specific value:** cross-chain footprint is where **timing correlation across
  chains** lives, and a per-chain protocol cannot see it. See §2.5.
- **Verdict:** Use as an input to cross-protocol correlation, not as a standalone score.

### 1.11 What the on-chain class costs a farm, summed

Order-of-magnitude for a *credible*, filter-surviving farmed identity in 2026, assembled from the
above (each component individually cited above; the sum is my arithmetic, not a published figure):

| Component | Per identity | Amortisable across farm? |
|---|---|---|
| Wallet creation + aging | ~$0 | n/a (free) |
| Randomised timing / gas jitter engineering | ~$0 marginal | **Yes** — fixed cost ÷ N |
| Funding-graph laundering (CEX round-trip or bridge) | cents to low $ | Partly |
| Diverse protocol interaction (gas, slippage, bridge fees) | **$10s-$100s** | **No** |
| KYC'd CEX account for provenance | rented, see sybil-incidents file | Partly (one account funds many) |
| Proxy / antidetect infrastructure (if a web flow exists) | see §3 | Partly |

**The structural conclusion:** everything that is *amortisable* is effectively free to a farm of
800,000, and everything that is *not* amortisable is a cost that also falls on poor honest users.
Behavioural gating therefore has a built-in regressive bias: **the on-chain signals a farm cannot
cheaply fake are the same ones a low-income real human cannot cheaply produce.** This is the single
most important design constraint in this file after §6.

---

## 2. The co-movement / synchrony detector catalogue

**This is the most valuable section for us**, because cross-protocol correlation is the one
computation an aggregator can perform that no single protocol can. Each individual protocol sees its
own registration event; we see the *joint distribution over registrations across protocols*. That
joint distribution is where farms are visible.

Two documented precedents to generalise from:

**Precedent A — Idena (Ohlhaver, Nikulin & Berman, *Compressed to 0*, 2024).** The detection
signature was *"the unlikely coincidence of simultaneous or sequential transactions from different
accounts in the same pool"* — specifically `account delegation` and `account termination`
transactions clustering in time. Applied to **all 31 pools that ever exceeded 100 delegated
accounts**: **all 31 showed the pattern.** A second pass on **financial transfers between pools**
collapsed the 31 pools into **23 distinct entities**, which turned out to be <0.6% of entities
controlling ≥~40% of accounts and ~48% of reward distribution. Full detail and the corroborating
"funnelling" signatures in `research/references/ohlhaver-corpus.md` §1.3 and §1.8; source paper
https://ash.harvard.edu/wp-content/uploads/2024/06/proof-of-personhood_ohlhaver.pdf.

**Precedent B — Circles.** The naive on-chain `Hub.RegisterHuman(avatar, inviter)` field looked
**diffuse** — the top direct inviter accounted for only 47 of 10,000 recent registrations. But the
bulk-onboarding contract emits `CrcV2_InvitationsAtScale.RegisterHuman(human, originInviter,
proxyInviter)`, and once you attribute through the proxy layer, **a single `originInviter`
(`0xf5ebc3753142f7c0ae381b6b775e819ea7b497d1`) accounts for 2,754 of 10,000 (27.5%)**, routed
through **1,687 distinct proxy bot addresses**. Detail and verification path in
`research/protocols/circles.md` (§ on invitations-at-scale).

**The generalisation, stated once:** *single-hop attribution is defeated by one layer of
indirection, and one layer of indirection is cheap.* Every detector below must therefore be defined
over the **transitive closure** of the relevant relation (funding, invitation, delegation,
attestation), not over its direct edges. A detector that reads only direct edges will report that
everything is fine, and will be wrong by an order of magnitude — Circles is the measured proof of
exactly that failure: 47/10,000 vs. 2,754/10,000, a **59×** understatement.

### D1. Timing synchrony across identities

- **Definition:** for a candidate set of identities, test whether their event timestamps
  (registration, attestation, claim, sweep) are more clustered than a null model of independent
  arrivals. Concretely: (a) sliding-window burst count vs. a Poisson null; (b) pairwise
  minute-of-hour / second-of-minute coincidence rate; (c) same-block or adjacent-block co-occurrence;
  (d) alignment of 24h activity histograms (cosine similarity of hourly-bin vectors — the Béres et
  al. representation, repurposed from deanonymisation to cluster detection).
- **What it caught:** Idena's simultaneous delegation/termination transactions (all 31 pools).
- **Cost to defeat:** the farm must **de-synchronise**, which means either a human clicking at
  irregular times per identity (expensive — reintroduces per-identity labour) or a scheduler that
  spreads events over days/weeks with independent jitter (cheap — but it costs the farm *latency*,
  and latency matters when there is a snapshot deadline or a limited invite window). **Estimated
  cost: low engineering, moderate operational.** The real leverage is that farms have deadlines.
- **False-positive generator:** genuine coordinated onboarding — a workshop, a conference booth, a
  community that all registers the same afternoon, a country coming online after an announcement.
  **This is the killer.** Idena's own paper is explicit that the same on-chain pattern is consistent
  with *voluntary cooperation* and that separating the two required off-chain evidence
  (`ohlhaver-corpus.md` §1.5). Do not automate the exploitation inference.
- **Recommended use:** **cluster-level flag, never individual-level.** Output "these N identities
  registered in a correlated burst", feed it to a correlation *discount*, not an exclusion.

### D2. Funding-graph clustering over the transitive closure

- **Definition:** build the asset-transfer graph, take connected components, run community detection
  (Louvain/k-core, per Trusta), and match against the four canonical topologies (star-divergence,
  star-convergence, tree, chain). **Then** — the part that matters — do not stop at direct funding
  edges: compute the *ancestry set* of each identity up to k hops, discounting hops through
  high-fan-out nodes (CEX hot wallets, bridges, routers) which carry no attribution.
- **The hard sub-problem:** distinguishing a **laundering hop** (CEX round-trip used to break the
  graph) from a **legitimate CEX withdrawal** is genuinely hard on-chain and requires either
  exchange cooperation or vendor entity labels. Flag this as the main technical dependency.
- **Cost to defeat:** low — one CEX round trip per wallet, or funding from a fresh mixer output.
  Documented as standard practice in the farming literature.
- **False-positive generator:** families, teams, shared custody, someone onboarding their friends by
  sending them gas. Sending someone their first $5 of gas is a **normal, prosocial act** and it
  creates a star-divergence edge.
- **Recommended use:** entity-collapse input. **Build.**

### D3. Sweep / consolidation detection

- **Definition:** detect convergent value flow — N identities sending ≥X% of balance to a common
  destination within a window W, with the destination not being an exchange. Parameterise over
  (N, X, W) and report the *entity*, not the leaves. Include the "balance minus exact gas" tell.
- **What it caught:** the primary Idena signature (blocks of one-way transfers at the same time to
  the same wallet, funds proceeding onward to exchanges). Also Ohlhaver's three corroborating
  funnelling signatures: operator receives all identity stake on termination; delegated accounts
  funnel pre-delegation rewards to the operator; operator withholds rewards then forwards to a hive
  wallet or exchange (all 31 pools except 2 on the latter two).
- **Cost to defeat:** stagger + vary + hop. **Cheap once known.** Its current efficacy rests on
  farms not being adversarial to *us* yet.
- **Recommended use:** **Build, and treat as perishable.** Highest signal-to-noise of the on-chain
  detectors today; assume decay after we publish or enforce.

### D4. Invitation / attestation forest concentration after transitive collapse

- **Definition:** for any protocol with an invite, vouch, delegation, or attestation relation, build
  the **forest**, collapse indirection layers (proxy inviters, delegate contracts, factory-deployed
  bot addresses, relayers), and compute the concentration of the resulting root distribution —
  Herfindahl index or top-k share of identities per root.
- **What it caught:** Circles — 27.5% of 10,000 recent registrations from **one** root behind 1,687
  proxies, versus 0.47% for the top *direct* inviter. **This detector exists specifically because
  the naive version gave the wrong answer by 59×.**
- **Indirection layers to unwind (checklist):** proxy/relayer addresses; contract-factory-deployed
  addresses sharing a deployer or CREATE2 salt pattern; delegation contracts; account-abstraction
  bundlers and paymasters (a shared paymaster is a strong shared-operator hint); gas-sponsorship
  relationships; shared session-key infrastructure.
- **Cost to defeat:** the farm must acquire *genuinely independent roots* — i.e. real separate
  inviters — which in a social protocol means real separate humans, which is the actual cost the
  protocol intended to impose. **This is the most expensive detector to defeat in the catalogue**,
  and not by accident: it attacks the thing that is actually scarce.
- **False-positive generator:** legitimate onboarding operators. A country lead onboarding 2,754
  people at meetups produces exactly this shape. Ohlhaver's §1.5 caveat applies in full force.
- **Recommended use:** **Build first.** Highest value-per-unit-effort in this file. Output a
  **correlation discount on the subtree**, not an exclusion of the leaves.

### D5. Cross-protocol co-registration timing — the aggregator's exclusive

- **Definition:** we observe, per identity, the vector of (protocol, credential-issuance timestamp)
  across every protocol we route to. Test for:
  1. **Co-registration bursts** — sets of identities that acquired the *same sequence* of
     credentials within tight windows. A farm working a checklist produces near-identical
     credential-acquisition *orderings and inter-arrival gaps*; organic users do not.
  2. **Ordering fingerprints** — the permutation of protocols acquired is a high-entropy signature.
     With 6 protocols there are 720 orderings; a farm reuses one script and therefore one ordering.
     This is a *very* cheap statistic and, as far as I can tell, **novel to an aggregator** — no
     single protocol can compute it because no single protocol sees the other credentials' timing.
  3. **Session-level co-occurrence** — same device/IP/session fingerprint across identities that
     claim to be different people, observed *at the aggregator's flow* rather than at any one
     protocol's flow (subject to §3's legal constraints).
  4. **Coverage-profile clustering** — the *set* of protocols held is itself a low-entropy vector;
    identical, unusual coverage profiles appearing in bulk is a farm tell.
- **Cost to defeat:** the farm must randomise **order, timing, and coverage** per identity, which
  costs it operational simplicity and, for order/coverage randomisation, real money (some protocols
  are expensive; a farm randomising coverage pays for credentials it did not need). This is the one
  detector where our cost to compute is ~zero and the adversary's cost to defeat is real.
- **Critical caveat — this only works if we retain cross-identity timing data**, which is in direct
  tension with the privacy model most of these protocols advertise (app-scoped nullifiers exist
  precisely to make cross-app linkage impossible). **We cannot both honour unlinkable app-scoped
  nullifiers and run D5 at full strength.** That tension is a product decision, not a technical one,
  and it should be surfaced explicitly in the design doc. Minimum viable honest version: run D5 on
  *coarse* data (day-resolution buckets, no raw identifiers retained) and accept lower power.
- **Recommended use:** **Build — this is our differentiator.** But scope it to cluster-level output
  and be honest in the privacy policy about what we retain.

### D6. Behavioural-similarity clustering (the vendor approach)

- **Definition:** feature-vector similarity across identities — Trusta's phase 2: first/last tx
  dates, contracts interacted with, interaction amount/frequency/volume, k-means-style centroid
  refinement with a distance threshold. Also the arXiv line of work on subgraph-based feature
  propagation for airdrop sybil detection (arXiv:2505.09313,
  https://arxiv.org/pdf/2505.09313 — **UNVERIFIED:** I have the abstract-level description only,
  not the reported metrics; worth reading properly before we copy anything from it).
- **Cost to defeat:** moderate — requires per-identity behavioural diversity, which costs money
  (§1.5). But this is exactly what farms already learned to do post-LayerZero.
- **False-positive generator:** **severe.** Real users are extremely similar to each other. A
  first-time user who bridges to an L2, swaps once, and stops looks identical to 100,000 other
  first-time users *and* to a farm.
- **Recommended use:** **Do not build in-house.** Buy it if we want it (vendors covered in
  `landscape/reputation-scoring-products.md`) and weight it low.

### D7. Detector-catalogue design rules (the part to carry into the product spec)

1. **Operate on the transitive closure, always.** Circles: 59× understatement from single-hop.
2. **Output is a group, not a person.** Every detector here returns "these identities are
   correlated". Converting that into an individual exclusion requires an additional inference the
   evidence does not support (Ohlhaver needed Telegram DMs, jurisdiction priors, and forum
   archaeology to get from key-sharing to exploitation).
3. **Therefore: discount, do not exclude.** Idena's accidental one-node-one-vote correlation
   discount is the empirical proof this works — large pools ended at 61% of accounts but ~2.4% of
   votes, which is what let the honest minority hard-fork out of the crisis
   (`ohlhaver-corpus.md` §1.6). A correlation discount saved that network; an exclusion filter would
   have had to be *right*, and it would not have been.
4. **Assume every detector is perishable.** All of them were caught by farms that had no adversary.
   Budget for the post-publication regime, not the current one.
5. **Never ship a detector whose false-positive population is "people who were onboarded at a
   community event in the global south."** That is the population every one of D1-D4 flags.

---
