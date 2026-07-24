# Raw behavioural & heuristic signals

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
And one hard precondition, measured rather than argued (§2 Precedent C, §6.2a): **no detector ships
without a per-protocol null hypothesis.** The obvious generalisation of the Circles finding, applied
to Proof of Humanity v2, flags **94.4% of an honest registry**.

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

**Precedent C — Proof of Humanity v2, the counterexample (measured 2026-07-24).** This one is worth
more than the other two, because it falsifies the obvious generalisation. A sweep of all **1,553
`VouchRegistered` events** on PoH v2 (`0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`, Gnosis, from
deploy block 35,846,827) tested whether the April–July 2026 registration surge was a farm.
*Direct* concentration was **low** — 828 distinct vouchers for 1,553 vouches, top 23 vouchers =
**10.4%** (9.0% in the surge cohort alone), against Idena's 23 entities at ≥40%. But applying the
Circles-style transitive-origin collapse to the same data gave **6 forest roots for 1,542
identities, one root subsuming 94.4%** — which reads as one entity behind almost the entire
registry, and is **wrong**. Three checks falsify the farm reading: median vouch-chain depth rises
monotonically by registration decile (7, 9, 10, 11, 12, 12, 13, 13, 13, 14); the dominant root has
exactly **one direct child**; and its depth-3 subtree spans **635 days**. It is simply a bootstrapped
invite tree — every member traces to genesis *by construction*, so root identity carries zero
information. Full write-up: `research/protocols/poh-kleros-brightid-idena.md` § "ADDENDUM — the
vouch-graph test"; reproduction script `research/scripts/vouch_sweep.py`.

**The generalisation, corrected.** The naive version — *"single-hop attribution is defeated by one
layer of indirection, so always work over the transitive closure"* — is right on Circles and
catastrophically wrong on PoH. The correct statement has two parts:

1. *Single-hop attribution is defeated by one layer of indirection, and one layer of indirection is
   cheap.* Circles is the measured proof: 47/10,000 direct vs. 2,754/10,000 transitive, a **59×**
   understatement. Direct-edge detectors will tell you everything is fine.
2. **But transitive-origin collapse is evidence of farming *only where the protocol's honest
   topology is not already a tree*.** On Circles, trust edges are unilateral and cheap, so an honest
   graph should *not* be tree-shaped and a single dominant root is anomalous. On any invite-gated
   registry — PoH, and by extension most vouch/invite protocols — the tree **is** the intended
   topology, every identity descends from a genesis seed, and root concentration is a structural
   artefact carrying no information. A detector keyed on root concentration alone would have
   **excluded 94% of a legitimate registry.**

**Therefore, the design rule that governs this whole section: every detector must be specified
together with its *topology precondition* — "what does this look like on an honest population of
this protocol's shape?" — and must be calibrated against that null, not against an abstract
intuition about what farms look like.** A detector without a stated null hypothesis is not a
detector; it is a shape recogniser, and honest populations have shapes too. Each detector below now
carries an explicit **Topology precondition** line. Where the honest topology *is* a tree, the
discriminating signals are not root concentration but **subtree width at shallow depth**,
**time-clustering within a subtree**, and **depth-versus-registration-age correlation** — organic
trees deepen as they grow; farms stay shallow, wide, and bunched in time.

### D1. Timing synchrony across identities

- **Definition:** for a candidate set of identities, test whether their event timestamps
  (registration, attestation, claim, sweep) are more clustered than a null model of independent
  arrivals. Concretely: (a) sliding-window burst count vs. a Poisson null; (b) pairwise
  minute-of-hour / second-of-minute coincidence rate; (c) same-block or adjacent-block co-occurrence;
  (d) alignment of 24h activity histograms (cosine similarity of hourly-bin vectors — the Béres et
  al. representation, repurposed from deanonymisation to cluster detection).
- **What it caught:** Idena's simultaneous delegation/termination transactions (all 31 pools).
- **Topology precondition:** the honest population must have *unsynchronised* arrivals. This fails
  for any protocol with a **snapshot, deadline, campaign, or scheduled onboarding event** — honest
  users bunch against deadlines just as hard as farms do. Before deploying, measure the honest
  arrival process for *this* protocol and use it as the null, not a Poisson assumption.
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
- **Topology precondition:** the honest population must fund itself from *many* independent sources.
  This holds on general-purpose chains and fails wherever a protocol has a **canonical funding
  path** — a faucet, a sponsored-gas paymaster, a single bridge, an official onboarding wallet, or a
  dominant regional on-ramp. In those cases a star-divergence pattern is the *honest* shape and the
  detector will flag the entire user base. Always exclude high-fan-out infrastructure nodes and
  check what fraction of the honest cohort the detector claims **before** believing it.
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
- **Topology precondition:** the honest population must not have a *designed* convergent flow. Fails
  where a protocol routes value through a common sink — a staking contract, a claim contract, a
  custodial wallet, a group/treasury account, a remittance corridor, or a savings-circle pattern.
  Circles' group tokens and PoH's `RewardDistributor` are both legitimate convergent sinks. Whitelist
  contract sinks; the detector is only meaningful for convergence on an **EOA**.
- **Cost to defeat:** stagger + vary + hop. **Cheap once known.** Its current efficacy rests on
  farms not being adversarial to *us* yet.
- **Recommended use:** **Build, and treat as perishable.** Highest signal-to-noise of the on-chain
  detectors today; assume decay after we publish or enforce.

### D4. Invitation / attestation forest structure — **topology-conditional**, in two variants

This is the detector the PoH result forced a rewrite of. It splits in two, and **which variant
applies is determined by the protocol's honest topology, not by preference.**

**Shared preprocessing (both variants).** Build the invite/vouch/delegation/attestation forest and
collapse indirection layers before doing anything else. Checklist of layers to unwind:
proxy/relayer addresses; contract-factory-deployed addresses sharing a deployer or CREATE2 salt
pattern; delegation contracts; account-abstraction bundlers and paymasters (a shared paymaster is a
strong shared-operator hint); gas-sponsorship relationships; shared session-key infrastructure.

#### D4a. Root concentration — **only where the honest topology is NOT a tree**

- **Definition:** Herfindahl index or top-k share of identities per transitive root.
- **Topology precondition (binding):** honest edges must be **unilateral, cheap, and many-to-many**,
  so that an honest graph is a dense web with *many* independent roots. Circles satisfies this:
  trust edges are unilateral and cheap, so a single root behind 27.5% of registrations is a genuine
  anomaly.
- **What it caught:** Circles — 27.5% of 10,000 recent registrations from one `originInviter` behind
  1,687 proxies, versus 0.47% for the top *direct* inviter (**59×** understatement without the
  collapse).
- **Where it catastrophically fails:** Proof of Humanity v2 — 6 roots for 1,542 identities, one root
  at **94.4%**, and it is a *bootstrapped invite tree*, not a farm. **A detector shipped on root
  concentration alone would have excluded 94% of a legitimate registry.** Do not run D4a on any
  invite-gated registry.
- **How to decide which case you are in, mechanically:** if every identity in the protocol descends
  from a genesis seed **by construction** (registration requires an existing member's invite/vouch),
  root concentration is a structural artefact and D4a is invalid. Test it: if the number of distinct
  roots is `O(1)` rather than `O(N)`, you are in a tree and must switch to D4b.

#### D4b. Subtree shape — **for invite-gated / tree-topology protocols**

The three statistics that *did* falsify the farm hypothesis on PoH, generalised:

1. **Subtree width at shallow depth.** A farm's root fans out immediately; a bootstrap seed does
   not. PoH's dominant root has **exactly one direct child** — decisive evidence against a farm.
   Statistic: branching factor at depths 1-3, compared to the protocol's honest distribution.
2. **Time-clustering within a subtree.** Farms are time-compressed; organic trees are not. PoH's
   dominant depth-3 subtree spans **635 days** — the whole history of the registry. Statistic:
   timespan and inter-arrival dispersion of a subtree's registrations, normalised by subtree size.
3. **Depth-versus-registration-age correlation.** Organic trees *deepen* as they grow because new
   members are invited by recent members; farms stay shallow because one operator invites everyone
   directly. PoH's median vouch-chain depth by registration decile: **7, 9, 10, 11, 12, 12, 13, 13,
   13, 14** — monotone increasing, which is the organic signature. Statistic: Spearman correlation
   between registration index and chain depth; a flat or negative correlation on a growing registry
   is the farm signature.
- **Cost to defeat:** the farm must produce a **deep, time-dispersed, narrow-at-the-top** subtree —
  which means recruiting real intermediate inviters and waiting. That is genuinely expensive, and
  it is expensive in the resource the protocol intended to make scarce. **D4b is the most expensive
  detector to defeat in this catalogue.** D4a, by contrast, is cheap to defeat *and* invalid on tree
  protocols — a bad trade on both sides.
- **False-positive generator:** legitimate high-volume onboarding operators (a country lead
  onboarding thousands at meetups produces a wide, time-clustered subtree and will be flagged).
  Ohlhaver's caveat (`ohlhaver-corpus.md` §1.5) applies in full: on-chain shape is evidence of
  coordination, never of exploitation.
- **Recommended use:** **Build D4b first; build D4a only for non-tree protocols with an explicit
  precondition check.** Output a **correlation discount on the subtree**, not an exclusion of leaves.
- **Unsettled:** the PoH sweep did *not* rule out a **distributed** farm that bought many low-value
  vouches — `requiredNumberOfVouches() == 1` makes each vouch cheap to source, and a broad voucher
  base is consistent with both an organic community and a diffuse purchase. The next query is the
  *vouchers' own* registration ages and whether they cluster in registration time. Note the shape of
  this residual: **broad, cheap, diffuse sourcing defeats every concentration statistic we have.**

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
- **Topology precondition — and it is one we control, which makes it a self-inflicted risk.** The
  ordering fingerprint has power only if honest users acquire credentials in *idiosyncratic* order.
  **If our own UI presents a recommended sequence, every honest user follows it, entropy collapses to
  near zero, and the detector dies — or worse, flags the minority who deviated.** Same for
  coverage-profile clustering: a "recommended bundle" makes the honest coverage vector uniform.
  Before shipping D5.2/D5.4, measure the realised entropy of orderings and coverage vectors in our
  own funnel. If we want this signal we may need to *deliberately randomise* the order we present
  protocols in — which is a product decision with UX cost, and should be made knowingly.
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
- **Topology precondition:** honest users must be behaviourally **heterogeneous**. They are not.
  This precondition fails on essentially every consumer protocol, and fails hardest on exactly the
  cohort we most need to admit — new users, who all do the same three things.
- **False-positive generator:** **severe.** Real users are extremely similar to each other. A
  first-time user who bridges to an L2, swaps once, and stops looks identical to 100,000 other
  first-time users *and* to a farm.
- **Recommended use:** **Do not build in-house.** Buy it if we want it (vendors covered in
  `landscape/reputation-scoring-products.md`) and weight it low.

### D7. Detector-catalogue design rules (the part to carry into the product spec)

0. **State the topology precondition, or do not ship the detector.** For every detector, answer in
   writing: *what does this look like on an honest population of this protocol's shape?* Then
   calibrate against that null. PoH is the proof of why: root concentration at 94.4% is the
   **honest** signature of an invite-gated registry, and a detector without a stated null would have
   excluded 94% of a real user base. **A detector without a null hypothesis is a shape recogniser,
   and honest populations have shapes.** Corollary: detectors are **per-protocol**, not universal —
   the same statistic is diagnostic on Circles and meaningless on PoH.
1. **Operate on the transitive closure — then check whether the closure is informative.** Circles:
   59× understatement from single-hop. PoH: the closure is a structural artefact carrying zero
   information. Mechanical test: if distinct roots are `O(1)` rather than `O(N)`, the honest topology
   is a tree and you must switch from concentration statistics to **shape** statistics (subtree width
   at shallow depth, intra-subtree timespan, depth-vs-registration-age correlation).
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

## 3. Off-chain behavioural signals observable in a verification flow

If we run an embedded flow, we can observe the client. This is a much richer signal space than the
chain — and a much more legally constrained one.

### 3.1 The signals

| Signal | What it is | Discriminating power | Cost to defeat |
|---|---|---|---|
| **Device fingerprint** | Canvas/WebGL rendering, font list, audio stack, screen metrics, hardware concurrency, timezone, language — hashed into a stable ID | High for *linking sessions*; near-zero for "is a human" | Antidetect browsers (Multilogin, GoLogin, AdsPower, Dolphin) exist as a **commercial product category** whose entire purpose is generating consistent, distinct, plausible fingerprints per profile. This is a **solved problem for farms**, sold as a subscription. |
| **IP reputation / ASN classification** | Is this a datacenter IP, a known VPN exit, a residential proxy, a mobile carrier NAT? | Moderate. Datacenter/VPN detection is reliable; **residential and mobile proxy detection is not** | Residential and mobile proxies are a mature market. Farming vendors openly advise budgeting **$50-100/month per wallet** for dedicated mobile proxies plus antidetect profiles, explicitly justified as cheaper than losing a 100-wallet farm to one correlation signal (secondary, self-serving: [Coronium farming guide, 2026](https://www.coronium.io/blog/airdrop-farming-proxy-guide-2026)). **Note what that number means: it is one of the few honest published prices for defeating our detectors, and it is the top of the market — ~$600-1200/identity/year.** A farm that pays it is essentially unfalsifiable by IP signals. A farm that does not pay it is trivially caught. |
| **Mouse / touch dynamics** | Cursor trajectory curvature, velocity profiles, pressure, touch area, jerk | Moderate for scripted-vs-human; **poor** for human-farm-worker vs. genuine user, because in a human farm the mouse *is* moved by a human | Cheap to replay/synthesise; also defeated by paying a human $0.50 to click. |
| **Typing cadence / keystroke dynamics** | Inter-key intervals, dwell/flight times | Same as above. Genuinely identifying (that is the problem — see §3.2) | Same |
| **Session behaviour** | Time-on-page, scroll patterns, form-fill order, copy-paste of fields, tab-switching, error/retry patterns | Moderate. **Copy-paste of an "own" name/DOB field is a real, cheap tell** in a farm context | Cheap |
| **Cross-session / cross-identity co-occurrence** | Same device or IP presenting for N different identities | **This is the good one.** It is a D5-class correlation signal, not a per-user signal | Requires per-identity device+proxy isolation, i.e. the $50-100/mo/identity price above |

**The pattern repeats from §1:** the per-user signals are cheap to defeat and weak; the
**cross-identity correlation** signals are the valuable ones — and correlation is again a
*cluster-level* output.

### 3.2 The legal position — this is a real constraint, not a footnote

- **EU: storing or reading anything on a user's device requires consent.** EDPB **Guidelines 2/2023
  on the technical scope of Art. 5(3) ePrivacy Directive**, adopted **16 October 2024**, confirm
  that Art. 5(3) is not limited to cookies but covers tracking pixels, tracking links, **device
  fingerprinting**, and certain local processing where information leaves the device. Building on
  Opinion 9/2014, which already placed fingerprinting inside Art. 5(3).
  Primary: https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
  Practically: **passive fingerprinting for fraud prevention is not automatically exempt.** The
  ePrivacy "strictly necessary" exemption is read narrowly and is assessed against the service the
  *user* requested. Fraud/sybil prevention is a service the *relying party* requested.
  **UNVERIFIED / needs counsel:** whether "sybil prevention for an airdrop" can ever qualify as
  strictly necessary. My reading is that it usually cannot, but this is a legal question.
- **Behavioural biometrics may be Article 9 special-category data.** GDPR Art. 4(14) defines
  biometric data as personal data resulting from specific technical processing relating to physical,
  physiological **or behavioural** characteristics *which allow or confirm the unique identification*
  of a natural person; Art. 9(1) then prohibits processing biometric data *for the purpose of
  uniquely identifying* a person absent a narrow exception (in practice, explicit consent).
  Keystroke dynamics and mouse dynamics used to *identify* rather than merely to *classify
  bot/not-bot* fall on the wrong side of that line. Primary text:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj (Art. 4(14), Art. 9).
  **This is a genuine landmine for a personhood product**, because our entire purpose is unique
  identification. Note the perverse structure: the *less* we use behavioural biometrics for
  identification, the more legal they are, and the less useful.
- **US state biometric law:** Illinois BIPA is the main private-right-of-action risk; Texas CUBI and
  Washington's My Health My Data create regulator risk. **UNVERIFIED:** whether BIPA's definition of
  "biometric identifier" reaches keystroke dynamics — the statute enumerates retina/iris,
  fingerprint, voiceprint, hand/face geometry, and courts have generally read it as a closed list,
  which would *exclude* keystroke dynamics. Worth confirming with counsel before relying on it.
- **Practical consequence:** device fingerprinting and behavioural biometrics require a consent
  gate in the EU/UK, and a consent gate that users can decline makes them **optional**, which makes
  them **useless as a gate** (an adversary always declines). This is not a compliance nuisance; it
  structurally removes the strongest off-chain per-user signals from our threat model.

### 3.3 Verdict on off-chain behavioural

- **Do not build** mouse dynamics, keystroke dynamics, or a proprietary fingerprinting stack. Legal
  exposure is high, discriminating power against a *human* farm is near zero, and the antidetect
  market has already commoditised the counter.
- **Do build** the cheap, defensible pieces: **datacenter/VPN/ASN classification** (server-side,
  no device access, no ePrivacy issue — the IP is transmitted necessarily) and **cross-identity
  device/IP co-occurrence counting** with short retention.
- Note that IP-based signals **systematically penalise** VPN users, Tor users, people in countries
  where VPN use is normal or necessary, and users on carrier-grade NAT (much of mobile Africa and
  South Asia shares few egress IPs across enormous user populations). CGNAT alone can put tens of
  thousands of genuinely distinct humans behind one IP. **Never treat shared IP as sybil evidence
  without an ASN-type check.**

---

## 4. Web2 account-age, platform, and hardware-attestation signals

### 4.1 Web2 platform signals (GitHub, X, Reddit, Discord, Google/Apple)

Another agent covers the *social/zkTLS attestation* products in depth; my angle is only what the
underlying signal is worth as evidence.

- **The general shape:** every one of these is an *account*, and accounts are a **commodity with a
  spot market**. Aged Reddit accounts with karma, aged Twitter/X accounts, GitHub accounts with
  commit history, and Discord accounts with server tenure are all openly sold. The signal is
  therefore priced, and its price is its evidential weight — which is low, because the prices are
  single-digit to low-double-digit dollars.
  **UNVERIFIED:** I did not pull current spot prices from a primary marketplace for this pass
  (deliberately — I am not going to transact). Next step if we need exact figures: the
  academic literature on underground account markets (e.g. Thomas et al., "Trafficking Fraudulent
  Accounts", USENIX Security 2013) gives methodology, but 2013 prices are useless in 2026.
- **What actually differs between them:** the *cost to produce*, not the *cost to buy*.
  - **GitHub commit history** — cheap to fake (backdated commits are trivial; `git commit --date`
    accepts anything, and contribution graphs are attacker-controlled for one's own repos).
    Contributions *merged into other people's repositories* are much harder to fake. If we use
    GitHub at all, use **merged PRs into third-party repos**, not the contribution graph.
  - **X/Twitter account age** — purchasable; account age is the age of the *account*, not the human.
  - **Reddit karma** — purchasable and farmable; also gameable by reposting.
  - **Discord tenure** — near-worthless; server join dates are trivially accumulated.
  - **Google/Apple account attestation** (Sign in with Google/Apple) — attests that a
    Google/Apple account exists and is in good standing. Better than the others because Google and
    Apple run their own large-scale abuse detection, and a *banned* account is a real loss. Still:
    accounts are creatable in bulk and are sold.
- **Verdict:** **Very low weight, and only as a bundle.** A single platform account is noise. Five
  independent, long-lived, *organically-linked* platform accounts is weak but non-zero evidence of
  effort. Never let Web2 account age alone cross a threshold.

### 4.2 Phone-number verification — a collapsed signal

Phone verification was, for a decade, the default sybil gate. It is now close to worthless, and the
price collapse is documentable.

- **SMS-verification-as-a-service is a mature retail market.** 5sim advertises numbers **from
  ~$0.008**, with common services in the **$0.01-$0.10** range (Instagram/Facebook ~$0.01,
  WhatsApp ~$0.06, Telegram ~$0.10), across 180+ countries, with an API for bulk automation
  (https://5sim.net/prices ; comparison secondary sources:
  [pricing breakdown across 7 platforms, 2026](https://www.yoobfriv.com/sms-activation-services-in-2026-pricing-breakdown-across-7-platforms/)).
  Long-standing competitor SMS-Activate **shut down in 2025** but the category did not — successors
  (HeroSMS, SMS-Man, OnlineSIM, Grizzly SMS) fill the same niche at similar prices.
- **Therefore: a phone-verified account costs roughly one to ten US cents.** At that price, phone
  verification imposes **no meaningful constraint on a farm** — 800,000 numbers at $0.05 is $40,000,
  which is trivial against the airdrop values involved.
- **The one remaining use:** *non-VoIP, carrier-attested, long-held* numbers with a
  reputation/porting history are still moderately expensive — but distinguishing those from
  virtual numbers requires a carrier-lookup vendor (Twilio Lookup, Telesign, Prove), which is a
  paid dependency and imperfect. **UNVERIFIED:** current accuracy of VoIP/virtual detection against
  the specific pools these services use; vendors do not publish it.
- **Verdict:** **Phone verification is theatre for our purposes.** Do not weight it as personhood
  evidence. It retains value only as a *friction* and as a *rate-limiter*, not as evidence.

### 4.3 Hardware attestation — the genuinely interesting one

Hardware attestation is the most promising thing in this entire file, because it is **cheap for us**
and **expensive to farm at scale**, which is the opposite of every other signal here. Assess it
seriously, then read the limits carefully, because the limits are decisive.

**What each primitive actually asserts:**

- **Apple App Attest** — a hardware-backed key generated in the Secure Enclave, attested by Apple,
  asserting *"this request comes from a genuine, unmodified instance of your app on a genuine Apple
  device."* Scope: **per app installation**, not per device. Apple explicitly expects `attestKey()`
  to be called **once per app installation per device**, and enforces an **undisclosed** rate limit
  on unique devices attesting; Apple's guidance to developers is to keep total attest calls in the
  low hundreds per second and to roll out gradually
  (Apple Developer Forums threads [759285](https://developer.apple.com/forums/thread/759285),
  [778937](https://developer.apple.com/forums/thread/778937),
  [818214](https://developer.apple.com/forums/thread/818214) — note these are Apple-staff forum
  answers, not formal documentation; **Apple does not publish the quota**).
  Third-party critiques of its limits: [Approov](https://approov.io/blog/limitations-of-apple-devicecheck-and-apple-app-attest),
  [Guardsquare](https://www.guardsquare.com/blog/remove-constraints-of-ios-app-attest) (both vendors
  selling competing products — read as adversarial but informed).
- **Apple DeviceCheck** — the more interesting primitive for *us*: **two bits of persistent,
  per-device, per-developer state**, which survive app reinstall. Two bits is exactly enough to
  record "this device has already been used to claim a personhood credential."
  **UNVERIFIED:** I could not fetch Apple's DeviceCheck documentation page in this pass (it returned
  only the page title). The two-bit persistence and its reset-on-factory-reset behaviour is
  well-known but I am flagging it as unconfirmed-by-primary-source here.
  Next step: read https://developer.apple.com/documentation/devicecheck and the
  `DCDevice`/`DCAppAttestService` API reference directly.
- **Google Play Integrity API** (successor to SafetyNet) — returns device-integrity verdicts;
  `MEETS_STRONG_INTEGRITY` on Android 13+ requires device integrity **plus** security updates within
  the last year across all partitions. Since **May 2025** Google requires **hardware-backed** signals
  for the stronger verdicts by default, which materially raised the bar for rooted/custom-ROM
  devices. Primary: https://developer.android.com/google/play/integrity/verdicts and
  https://developer.android.com/google/play/integrity/overview ; October 2025 update:
  https://android-developers.googleblog.com/2025/10/stronger-threat-detection-simpler.html .
  Counter-evidence that it is not absolute: a live bypass ecosystem exists (Zygisk modules marketed
  precisely as making rooted devices pass) — see https://playintegrityfix.com/ and
  [Approov's limitations write-up](https://approov.io/blog/limitations-of-google-play-integrity-api-ex-safetynet).
- **WebAuthn / passkeys with attestation** — **this one does not work for consumer flows, and that
  is important.** The two authenticators that mint most of the world's passkeys — Apple iCloud
  Keychain and Google Password Manager — **do not return usable device attestation**, and WebAuthn
  Level 2 makes `attestation: "none"` the default conveyance. Syncable passkeys cannot assert a
  single hardware instance *by design*, because the credential is synced across the user's devices.
  **Enterprise attestation** (which can return uniquely-identifying data like a serial number) is
  restricted to managed deployments with an RP-ID allowlist and cooperating authenticator firmware —
  not available to a consumer relying party.
  Primary spec: https://www.w3.org/TR/webauthn-2/#enum-attestation-convey ;
  MDN: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Attestation_and_Assertion .
  **Conclusion: passkeys give us phishing-resistant authentication, not device evidence.** Do not
  put "WebAuthn attestation" in a personhood score. This is a common and wrong assumption.

**What hardware attestation is genuinely worth:**

The honest framing is that it is a **cost floor with a hard ceiling on precision**:

1. It proves *"a real, unmodified, current-generation device"* — that is real and it is expensive to
   fake at volume, because it requires **physical devices**. A device farm of 10,000 iPhones is a
   capital expense of millions of dollars and a logistics operation.
2. It does **not** prove one human. A single device can install and reinstall an app arbitrarily
   many times, producing many App Attest keys. Only DeviceCheck's two persistent bits push back on
   that, and only for two bits, and only until factory reset.
3. It does **not** prove one device per human either — a real human with three devices can present
   three attestations.
4. **Device farms are a real, industrialised counter.** Physical racks of hundreds or thousands of
   handsets are standard equipment in the click-farm and account-farm industries; documented cases
   belong in `landscape/sybil-incidents-antipatterns.md`, but the existence of the industry is not
   in dispute. Attestation raises the price per identity from ~$0 to the amortised cost of a
   handset-slot; it does not make it prohibitive.
5. It **excludes populations**: users on old Android (no strong integrity), rooted/de-Googled
   devices (a privacy-conscious minority we should not want to exclude), desktop-only users, and
   anyone in a region where recent-patch devices are uncommon. This is a real equity cost.
6. It creates a **hard dependency on Apple and Google** — a two-company trust root, exactly the
   centralisation this product category exists to avoid, and revocable at their discretion.

**Verdict: build it, weight it moderately, and be honest about what it is.** Specifically: use
Play Integrity / App Attest as a **rate-limiting and cost-floor primitive** (a device may support at
most k credential issuances) rather than as a personhood assertion. Combined with DeviceCheck's
persistent bits it is the cheapest available mechanism for making bulk issuance cost real money.
Recommended weight: **meaningful but capped, and only in the native-app flow** — it is unavailable
in a pure-web flow, which is where most of our users will be.

---

## 5. Proof-of-work / proof-of-cost as a floor

Sometimes the honest answer to "is this a human" is **"they paid enough that farming is
uneconomic."** This is a categorically different move from classification, and it deserves to be
evaluated on its own terms because it has one enormous advantage over everything else in this file:
**it has no false positives of the "we decided you're a bot" kind.** Anyone who pays, passes. Given
§6, that property is worth a great deal.

### 5.1 The mechanism, stated plainly

Let `v` be the expected value an attacker extracts per identity and `c` the cost to produce one. If
`c > v`, farming is unprofitable **regardless of whether any detector works**. Cost can be imposed
as:

| Form | Example | Recoverable? | Notes |
|---|---|---|---|
| **Refundable stake / deposit** | Idena identity staking; Human Passport GTC identity staking | Yes | Cheapest for honest users (opportunity cost only), but a farm with capital pays only opportunity cost too. Needs **slashing** to bite. |
| **Burn** | Circles invitation cost | No | Real cost to both sides. |
| **Fee** | Farcaster registration + storage | No | Simplest; a pure regressive tax. |
| **Time-lock / illiquidity** | vesting, lockups, minimum age | Partly | Costs *time*, which farms have in abundance if they plan ahead. Weak. |
| **Compute (proof-of-work)** | Hashcash-style client PoW, mCaptcha, Friendly Captcha | No | **Strictly worse than a fee** for our purposes: farms have GPUs and cheap electricity; honest mobile users have a phone battery. Regressive *and* environmentally wasteful. Fine as a **DoS rate-limiter**, useless as personhood evidence. |
| **Hardware** | App Attest / Play Integrity (§4.3) | Capital | Cost is a physical device slot. The most interesting form because the cost is in a resource farms cannot print. |

### 5.2 Documented instances worth learning from

- **Idena identity staking** — the mechanism that actually *defeated account trading*. Each identity
  posts a stake; anyone with the key can steal it, so selling the key means selling the stake. This
  is functionally Buterin's **MACI deposit** (https://ethresear.ch/t/minimal-anti-collusion-infrastructure/5413),
  and Ohlhaver notes the equivalence (*Compressed to 0*, p.36 n.94). **It worked** — and the
  displaced demand reappeared as puppeteering. **Hardening one channel priced the adjacent channel
  in.** This is the most important lesson about cost floors in the whole literature: they do not
  remove the demand, they redirect it.
- **Idena IIP-5, sublinear (quadratic-ish) staking** — the constructive fix for the
  one-token-one-vote problem. Reward weight is `stake^0.9`, not `stake` (proposer weight
  `= stake^0.9 × N/5`; validator weight `= stake^0.9`). Rationale given in the IIP: pool
  concentration was collapsing node count and demotivating solo operators whose ~$7-10/month node
  cost was not covered. Modelled on epoch #0087: solo miners **28k → 110k iDNA**, large pools
  **240k → 163k iDNA**, total constant at 510k. Primary: https://docs.idena.io/docs/iip/iip-5 .
  **The exponent is the whole idea:** a sublinear cost-to-influence curve makes the marginal cost of
  the Nth identity rise relative to its yield, which bites a farm and not an individual. Ohlhaver's
  corpus notes this pivot killed the largest "unknown network" pool
  (`research/references/ohlhaver-corpus.md` §1.8).
- **Circles invitation cost** — an elegant variant: the inviter **burns 96 CRC = 4 days of their own
  personal issuance**, and the invitee is credited 48 CRC. The cost is denominated in a resource
  that is *itself* rate-limited by personhood and is **non-transferable**, so it cannot simply be
  bought with outside capital. See `research/protocols/circles.md`. This is the best design pattern
  in the file: **denominate the cost in a personhood-rate-limited currency, not in money.** Its
  weakness is the same as its strength — it is only as scarce as the personhood it presupposes,
  and the Circles `originInviter` concentration (§2, Precedent B) shows one entity can accumulate
  enough of it to mint 27.5% of recent registrations.
- **Farcaster — a cost floor that collapsed.** Another agent measured this directly:
  `IdRegistry.idCounter()` = **3,343,569 FIDs** (OP Mainnet), registration ~**0.0001069 ETH**, and
  storage now **$0.20/yr** — down from ~$7 mid-2025. A **10,000-FID farm therefore costs ~$2k/yr**.
  A raw FID consequently carries **near-zero personhood weight**. The cost-bearing signal migrated
  to **Farcaster Pro at $120/yr** (`TierRegistry` on Base
  `0x00000000fc84484d585C3cF48d213424DFDE43FD`), which is **high precision, very low recall** — few
  humans pay it, but almost no farm pays it per identity. See the sister agent's Farcaster write-up
  for the measurement; my point here is purely evidential: *a fee-based cost floor is only as strong
  as the fee, and fees get cut for growth reasons.* **A cost floor set by a third party is not a
  cost floor we control, and it can vanish in a product decision.**

### 5.3 Where cost floors beat identity checks

1. **No classifier false positives.** The exclusion criterion is "did not pay", which is
   unambiguous, appealable (pay), and not a statistical judgement about a person.
2. **They do not decay.** Every detector in §2 decays as adversaries adapt. A cost floor's
   "counter" is *paying more*, which is the intended behaviour.
3. **They are legible and auditable.** A number, on-chain, that anyone can verify — a much better
   fit for the aggregator's "verify without vendor cooperation" requirement (BRIEF.md §4).
4. **They compose with slashing**, which is the only mechanism in this entire file that has
   demonstrably defeated a real attack class (account trading, on Idena).

### 5.4 Where they fail — and it is the failure mode Ohlhaver names

**Proof-of-cost converts one-person-one-vote into one-token-one-vote.** That is the exact thing
proof-of-personhood exists to prevent. Buterin's framing of the stakes:
*"If proof of personhood is not solved, decentralized governance … becomes much easier to capture by
very wealthy actors"* (https://vitalik.eth.limo/general/2023/07/24/biometric.html). And on why even
social approaches inherit it: *"each person can only have one biometric ID, but a wealthy and
socially well-connected person could use their connections to generate many IDs"* (same post).

The arithmetic is unforgiving. To deter a farm you need `c > v`. In an airdrop with `v ≈ $50` per
identity, you need `c ≈ $50` per identity. **$50 is a meaningful fraction of a week's income for a
large share of the world's population** — including exactly the population that a UBI or
public-goods-funding use case is *for*. A cost floor calibrated to deter farms is, by construction,
calibrated to exclude the global poor. **There is no setting of `c` that separates "farm" from
"poor honest user", because the farm's advantage is capital and capital is precisely what the poor
honest user lacks.**

Two partial escapes, both worth building around:

- **Sublinear cost-to-influence** (Idena IIP-5's `stake^0.9`; quadratic voting/funding generally).
  This does not lower the floor; it lowers the *return to scale*, which is the actual problem. But
  it presupposes that identities are already separated — quadratic mechanisms are famously
  sybil-vulnerable without personhood. **Circular**, and the circularity is real, not rhetorical.
- **Denominate cost in a non-transferable, personhood-rate-limited resource** (Circles' issuance
  burn; social vouching capacity; time-since-issuance quotas). This escapes the wealth problem but
  inherits the social-graph problem.

### 5.5 Verdict for the aggregator

**Expose cost-borne signals as a separate axis, not as part of a "humanity" score.** Concretely: our
API should return something like `{ personhood_evidence: …, cost_borne: … }` so an integrator
running a governance vote can weight cost at zero while an integrator running a faucet can weight it
highly. Folding proof-of-cost into a personhood number is a category error and it silently converts
our customers' one-person-one-vote systems into plutocracies. Ohlhaver's whole argument is that this
is the failure mode, not the fix.

---

## 6. What behavioural signals fundamentally cannot do

### 6.1 They cannot establish uniqueness — structurally, not incidentally

Nothing in an activity trace binds to a body. Behaviour is a property of an **account**, and the
account-to-human map fails in both directions, both of which are documented:

- **One human → many accounts.** The farm case. Behaviour cannot refute it because a patient,
  funded human can generate arbitrarily many individually-plausible traces. Every signal in §1 is
  something a human with time and money can produce N times.
- **Many humans → one account, or one operator → many humans' accounts.** The puppeteering case.
  Ohlhaver's Idena result is decisive here and should be read as the ceiling on this entire signal
  class: Idena **succeeded** at filtering bots *and* at defeating account trading (via identity
  staking), and the outcome was still that **23 entities — under 0.6% of distinct entities —
  controlled ≥~40% of accounts and ~48% of reward distribution**, with **all 31** of the pools that
  ever exceeded 100 accounts showing third-party key access. The accounts were *real humans*
  performing *real liveness ceremonies*. There is no behavioural signal that separates a paid puppet
  performing a genuine ceremony from an autonomous participant performing a genuine ceremony,
  because **there is no behavioural difference** — the difference is in off-chain distribution of
  information and control (`research/references/ohlhaver-corpus.md` §1.5, quoting p.12).

Therefore: **behavioural signals are at best evidence of *effort* and *non-automation*.** They are
never evidence of *one*. Any product copy that implies otherwise is false.

### 6.2 The base-rate problem, worked

Assume a classifier that is genuinely good by the standards of this literature: **sensitivity
(TPR) = 90%**, **specificity = 95%** (FPR = 5%). Population 100,000. Vary the true sybil prevalence
`p`:

| True sybil rate `p` | Sybils | Humans | True positives | **False positives** | **Precision (PPV)** | Honest users excluded |
|---|---|---|---|---|---|---|
| 50% (airdrop snapshot) | 50,000 | 50,000 | 45,000 | 2,500 | **94.7%** | 5.0% |
| 20% | 20,000 | 80,000 | 18,000 | 4,000 | **81.8%** | 5.0% |
| 5% | 5,000 | 95,000 | 4,500 | 4,750 | **48.6%** | 5.0% |
| **2%** | 2,000 | 98,000 | 1,800 | **4,900** | **26.9%** | 5.0% |
| 1% | 1,000 | 99,000 | 900 | 4,950 | **15.4%** | 5.0% |

**Read the 2% row.** At a 2% sybil rate — which is a plausible residual for a well-designed
personhood flow where users have already presented at least one strong credential — **73% of
everyone we flag is a real human**, and we exclude **4,900 real people per 100,000** to catch 1,800
sybils.

Tightening specificity helps, but not enough:

| Specificity | FPR | PPV at p=2% | PPV at p=1% |
|---|---|---|---|
| 95% | 5% | 26.9% | 15.4% |
| 99% | 1% | 64.7% | 47.6% |
| 99.9% | 0.1% | **94.8%** | 90.0% |

To reach **95% precision at p = 2%** you need **specificity ≈ 99.90%** (FPR ≤ ~0.097%). At
**p = 1%** you need **≈ 99.95%** (FPR ≤ ~0.048%). **No published behavioural sybil classifier
demonstrates anything close to that out-of-sample against an adaptive adversary** — and, per §6.3,
none of them publish the number at all.

**The structural point this establishes:** behavioural classification works precisely where the
sybil rate is *enormous* (an unfiltered airdrop snapshot, where LayerZero was flagging 803,093
addresses) and fails precisely where a personhood aggregator would apply it (after other credentials
have already removed most sybils). **The signal is least useful exactly where it sits in our
pipeline.** That is not a tuning problem; it is arithmetic.

### 6.2a A measured false-positive rate of 94%, from a detector that looked obviously right

The table above assumes the classifier's specificity is at least *approximately* known. In practice
the dominant failure is not a mis-tuned threshold but a **mis-specified null hypothesis**, and we
have a measured instance from this project's own research.

The Circles finding — one `originInviter` behind 27.5% of registrations, visible only after
unwinding 1,687 proxies — generalises to an obvious-looking detector: *collapse the invitation forest
and flag concentrated roots.* Run against Proof of Humanity v2's 1,553 vouches, that detector returns
**6 roots for 1,542 identities, one root at 94.4%**. Every instinct says farm. It is not: PoH is an
invite-gated registry, so **every member descends from genesis by construction**, and the 94.4% is
the *honest* signature. Median chain depth rises monotonically with registration order
(7 → 14), the dominant root has one direct child, and its depth-3 subtree spans 635 days. Full
method and data: `research/protocols/poh-kleros-brightid-idena.md` § "ADDENDUM — the vouch-graph
test"; script `research/scripts/vouch_sweep.py`.

**A specificity of 5.6% — that is what "flag the concentrated root" scores on this population.** Not
95%, not 99%. Plug that into the §6.2 table and precision at any plausible base rate is
indistinguishable from zero. And note *why* it happened: not because the detector was badly
implemented, but because it was validated on one protocol's topology and deployed against another's.
That is the realistic way behavioural detection fails in production, and it is far more dangerous
than a threshold error because **it fails silently and confidently, flagging almost everyone while
producing a plausible-sounding story about why.**

### 6.3 Four compounding problems on top of the base rate

1. **We cannot measure our own false-positive rate, because there is no ground truth.** The only
   large public label set — LayerZero's — was produced by a **self-report amnesty offering 15% of
   allocation** plus a community bounty. Self-reporters are a biased sample (the marginal farmer for
   whom 15% > 0), and bounty hunters were reporting so aggressively that LayerZero **paused the
   bounty process** ([The Block](https://www.theblock.co/post/295274/layerzero-labs-ceo-announces-pause-of-sybil-bounty-hunter-process-after-influx-of-reports)).
   Labels produced by an incentivised adversarial crowd are not a validation set.
   Correspondingly: **no vendor publishes precision/recall.** Human Passport's own GG23 model-based
   detection announcement publishes user counts and dollars protected but **no accuracy figures at
   all** (https://human.tech/blog/human-passport-x-gitcoin-grants-defending-gg23-with-model-based-sybil-detection).
   Trusta's open-source repo documents the pipeline but states thresholds are undisclosed
   (https://github.com/TrustaLabs/Airdrop-Sybil-Identification). **Assume any vendor accuracy claim
   we are given is unaudited.**
2. **Multiple testing.** Running `N` detectors and flagging on *any* of them compounds FPR:
   `1 − (1 − α)^N`. Six detectors at α = 1% each gives an effective **5.9%** FPR — which lands us
   back in the top row of the table. Detector count must be governed by a joint calibration, not by
   how many good ideas we have.
3. **Asymmetric decay.** The honest population's behaviour is roughly stationary; the adversary's is
   not. So **FPR stays put while TPR falls** after deployment. Precision decays monotonically from
   launch day. Every one of §2's detectors was validated against farms that had no adversary.
4. **Correlated, non-random false positives.** The people flagged are not a random 5%. They are:
   new users with thin histories, mobile-only users behind CGNAT, VPN/Tor users, users onboarded in
   community batches, users in regions where one operator does all onboarding, and users whose
   funding came from a friend. **Every single one of D1-D4 concentrates its false positives on the
   global south and on the newly-onboarded** — the exact populations a personhood system is supposed
   to include.

### 6.4 What this must do to our product design

Four constraints, all falling out of the above:

1. **Never let a behavioural signal cause an individual exclusion.** It may reduce a score; it may
   trigger a request for a stronger credential; it must not be terminal. The harm asymmetry is
   stark: a false negative gives a farm one extra share; a false positive denies a real person money
   or a vote, **in a permissionless system where there is no appeals desk.**
2. **Emit cluster-level correlation, not individual verdicts.** Population-level estimation is a
   well-posed problem — estimating "what fraction of this cohort is one entity" does not suffer the
   base-rate collapse, because it is estimation, not classification. Individual classification at
   low prevalence is not well-posed. Our API should be able to say *"this identity belongs to a
   correlated cluster of size 2,754 sharing one root"* and let the integrator decide.
3. **Ship a correlation discount, not a filter.** The empirical warrant is Idena's accident: pooled
   accounts ended at 61% of accounts but **~2.4% of votes** because voting was one-node-one-vote,
   and that discount is what let the honest 27% hard-fork the protocol out of the crisis
   (`ohlhaver-corpus.md` §1.6). *A correlation discount saved that network.* An exclusion filter
   would have had to be right, and at those base rates it would not have been.
4. **Cap the class.** Behavioural signals should contribute a **bounded fraction (~10-15%)** of the
   maximum score and must never be sufficient alone. They are a tiebreaker and a fraud-triage input,
   not evidence of personhood.
5. **Calibrate per protocol, and refuse to ship a detector without its null.** §6.2a is the warrant:
   a detector that is correct on Circles scores 5.6% specificity on PoH. Our architecture must treat
   "detector D, calibrated against protocol P's honest topology" as the unit of deployment — never
   "detector D" alone. A shared detector library with per-protocol nulls and per-protocol measured
   flag-rates; a hard rule that any detector flagging more than a few percent of a protocol's
   population is presumed broken until proven otherwise.

---

## 7. Signal table

Evidence class: **P1** = not-automated, **P2** = costly-to-produce, **P3** = not-correlated
(cluster-level). Cost to fake is **per sybil identity** to a professional farm.
"Legal" = usable in EU/UK without a consent gate that an adversary would simply decline.

| # | Signal | Class | Cost to fake | False-positive risk | Legally usable? | **Recommended weight** |
|---|---|---|---|---|---|---|
| **On-chain** |
| 1 | Account age (prospective) | P2 | **$0** (just forethought) | Low but useless | Yes | **Do not use** |
| 2 | Account age vs. an *unannounced* cutoff | P2 | $0 but requires pre-commitment | Medium (new users) | Yes | Low (tiebreaker only) |
| 3 | First-funding provenance = KYC'd CEX | P2 | Cost of a rented KYC account | Medium (unbanked, P2P-funded users) | Yes | **Medium — best single on-chain feature** |
| 4 | Gas-price selection fingerprint | P3 | ~$0 to randomise | High as a per-user signal | Yes | Clustering input only |
| 5 | Per-address timing "looks human" | P1 | ~$0 marginal (amortised) | **Very high** (sparse honest users) | Yes | **Do not use** |
| 6 | Cross-address timing synchrony (D1) | P3 | Low eng., moderate ops (deadlines bite) | High at individual level; OK at cluster level | Yes | **Medium — cluster output only** |
| 7 | Interaction diversity / DeFi sophistication | P2 | **$10s-$100s** (non-amortisable) | **Very high** — excludes new & poor users | Yes | Low; and never as *personhood* |
| 8 | Counterparty graph position | P3 | Moderate | High per-user | Yes | Clustering input only |
| 9 | Funding-graph clustering, transitive (D2) | P3 | Low (one CEX/bridge hop breaks it) | High (families, gas gifting) | Yes | **Medium — entity-collapse input** |
| 10 | Sweep / consolidation detection (D3) | P3 | Cheap once known; **perishable** | Medium | Yes | **Medium-high today, decaying** |
| 11a | Invitation-forest **root concentration** after transitive collapse (D4a) | P3 | Moderate | **Catastrophic on tree-topology protocols — measured 94.4% flag rate on an honest PoH registry** | Yes | **Only for non-tree protocols (Circles-like), with an explicit precondition check** |
| 11b | Invitation-forest **subtree shape**: width at shallow depth, intra-subtree timespan, depth-vs-registration-age correlation (D4b) | P3 | **Highest in file — farm must recruit real intermediate inviters and wait** | Medium (high-volume honest onboarding operators) | Yes | **Highest in file — build first** |
| 12 | NFT / DeFi holdings | P2 | Purchasable; wash-tradeable | High | Yes | **Do not use** |
| 13 | Cross-chain footprint | P2/P3 | Linear multiplier on §7.7 | High | Yes | Input to D5 only |
| **Cross-protocol (aggregator-exclusive)** |
| 14 | Co-registration burst detection (D5.1) | P3 | Costs the farm latency | Medium at cluster level | Yes (if we retain timing) | **High — differentiator** |
| 15 | Credential-acquisition **ordering** fingerprint (D5.2) | P3 | Farm must randomise script order | Medium | Yes (coarse buckets) | **High — likely novel** |
| 16 | Coverage-profile clustering (D5.4) | P3 | Farm must buy credentials it doesn't need | Medium | Yes | Medium |
| 17 | Same device/IP across claimed-distinct identities (D5.3) | P3 | **$50-100/mo/identity** (mobile proxy + antidetect) | High (CGNAT, shared devices, family) | **Conditional** — IP yes, device fingerprint needs consent | Medium, with hard ASN check |
| **Off-chain flow** |
| 18 | Datacenter / VPN / ASN classification | P1/P3 | Residential+mobile proxies, priced above | High (VPN users, Tor, censored regions) | **Yes** (server-side, IP is necessarily transmitted) | Low-medium |
| 19 | Browser/device fingerprint (canvas, fonts, WebGL…) | P3 | **Commoditised** — antidetect browsers are a product category | High | **No** without consent (EDPB Guidelines 2/2023) | **Do not build** |
| 20 | Mouse / touch dynamics | P1 | Trivial; and useless vs. human farms | High | **No** — likely GDPR Art. 9 if identifying | **Do not build** |
| 21 | Keystroke cadence | P1 | Trivial; useless vs. human farms | High | **No** — same | **Do not build** |
| 22 | Session behaviour (copy-paste of own PII, retries, dwell) | P1 | Cheap | Medium | Yes (no device storage/read) | Low — fraud triage only |
| **Web2 / platform** |
| 23 | Phone-number verification | P2 | **$0.01-$0.10** (5sim et al.) | Low | Yes | **Do not use as evidence** — rate-limiter only |
| 24 | Non-VoIP carrier-attested aged number | P2 | Higher, but detection is a paid vendor & imperfect | Medium (prepaid/eSIM users) | Yes | Low |
| 25 | X / Reddit / Discord account age | P2 | Purchasable, single-digit $ | Medium | Yes | **Very low; bundle only** |
| 26 | GitHub contribution graph | P2 | Trivial (`git commit --date`) | Medium | Yes | **Do not use** |
| 27 | GitHub **merged PRs into third-party repos** | P2 | High (requires real reviewed work) | Very high (most humans have none) | Yes | Low weight, **positive-only** |
| 28 | Google / Apple account attestation (SSO) | P2 | Bulk-creatable & sold, but ban is a real loss | Low-medium | Yes | Low |
| 29 | Farcaster raw FID | P2 | **~$0.20/yr** ⇒ 10k FIDs ≈ $2k/yr | Low | Yes | **≈ Zero weight** |
| 30 | Farcaster Pro ($120/yr) | P2 | $120/yr/identity | **Very high FN** (few humans pay) | Yes | High precision, near-zero recall — **positive-only bonus** |
| **Hardware / cost** |
| 31 | Apple App Attest | P2 | Physical device slot; per *install*, not per device | Medium (old devices, web-only users) | Yes | **Medium — native flow only** |
| 32 | Apple DeviceCheck (2 persistent bits) | P2/P3 | Physical device; survives reinstall, dies on factory reset | Medium | Yes | **Medium — best rate-limiter available** |
| 33 | Play Integrity `MEETS_STRONG_INTEGRITY` | P2 | Physical device + current patches; live bypass ecosystem exists | **High** (rooted, de-Googled, old Android, global south) | Yes | Medium, with an explicit exclusion budget |
| 34 | WebAuthn / passkey attestation | — | n/a | n/a | Yes | **Do not use — consumer passkeys return no usable attestation** |
| 35 | Refundable stake with slashing | P2 | = stake size; **defeats key-sale** | Zero classifier FP; **high wealth exclusion** | Yes | Separate axis, not personhood |
| 36 | Burn / fee | P2 | = fee | Zero classifier FP; wealth exclusion | Yes | Separate axis |
| 37 | Client-side proof-of-work | P2 | Farms have GPUs; users have phones | Medium, regressive | Yes | **Do not use** (DoS only) |
| 38 | Non-transferable issuance burn (Circles pattern) | P2 | Cannot be bought with outside capital | Medium | Yes | **Interesting — design pattern to copy** |

**Table caveat that outranks the table:** every row above is conditional on the protocol's honest
topology (§2, D7 rule 0). "Cost to fake" and "false-positive risk" are *per protocol*, not universal.
Row 11a is the worked example: identical statistic, genuine finding on Circles, 94.4% false-positive
rate on PoH.

### 7.1 Worth building — the short list

1. **D4b: invitation-forest *subtree shape*** — width at shallow depth, intra-subtree timespan, and
   depth-versus-registration-age correlation. Highest value-per-effort in the file, and the most
   expensive detector for a farm to defeat. **Not** root concentration: that is D4a, it is valid only
   where the honest topology is not a tree, and on PoH it flags 94% of a legitimate registry.
2. **D5: cross-protocol co-registration timing, ordering, and coverage clustering.** The only thing
   here that *requires* an aggregator to exist. Ordering fingerprints in particular look cheap and
   under-exploited.
3. **D2 + D3: transitive funding-graph clustering and sweep detection**, as entity-collapse inputs.
   Perishable, but currently the highest-yield on-chain detectors.
4. **CEX-funding provenance** (§1.2) — best single per-address on-chain feature; probably buy rather
   than build.
5. **Hardware attestation as a cost floor / rate-limiter** (App Attest + DeviceCheck + Play
   Integrity) in any native flow, used to cap issuances per device rather than to assert personhood.
6. **Cost-borne signals exposed as a separate API axis**, never folded into a humanity score.

### 7.2 Theatre — do not build

- **Per-address "does this timing look human"** scores. Defeated for ~$0 marginal cost, and they
  fail on the sparse honest users who most need to pass.
- **Browser/device fingerprinting, mouse dynamics, keystroke cadence.** Legally exposed in the EU,
  commoditised counters, and *structurally* useless against human farms — the mouse in a click farm
  is moved by a real hand.
- **Phone-number verification as evidence.** One to ten cents. It is a rate-limiter, nothing more.
- **NFT/DeFi holdings, Discord tenure, Reddit karma, GitHub contribution graphs, raw Farcaster
  FIDs.** All purchasable or trivially manufactured; all measure wealth or persistence, not humanity.
- **WebAuthn attestation.** A widespread misconception: consumer passkeys return
  `attestation: "none"` and cannot assert a hardware instance at all.
- **Client-side proof-of-work as personhood.** Regressive and inverted — it advantages the
  adversary's hardware over the user's.
- **Any individual-level behavioural exclusion.** §6.2's arithmetic says most of the people we would
  exclude are real.
- **Any detector shipped without a per-protocol null hypothesis** — including ones on the "worth
  building" list. §6.2a is the measured proof that a *correct* detector applied to the wrong topology
  is worse than no detector: it flags 94% of an honest population and tells a convincing story while
  doing it.

---

## Open questions for us

1. **Can we run D5 at all under app-scoped nullifiers?** App-scoped nullifiers exist precisely to
   prevent cross-protocol linkage. Our best detector requires exactly that linkage. What is the
   weakest data retention (day-buckets? salted rolling hashes? MPC?) that preserves useful power?
   This is the central design tension of the product and it should be decided explicitly.
2. **The PoH residual (highest-priority concrete follow-up).** The vouch sweep refuted the
   *concentrated* farm hypothesis but not a **distributed** one — `requiredNumberOfVouches() == 1`
   makes each vouch cheap to source, so a farm could buy 1,470 vouches from 808 unrelated vouchers
   and produce exactly the observed broad base. Next query on the same data: the **vouchers' own
   registration ages**, and whether *they* cluster in registration time. Generalise the worry:
   **broad, cheap, diffuse sourcing defeats every concentration statistic in this file**, and it is
   the natural adaptation once concentration detectors are known. What detects it?
3. **What is the actual residual sybil rate** in a population that has already presented ≥1 strong
   credential? §6.2 is parameterised on a guess of 2%. If it is really 0.5%, behavioural gating is
   even more indefensible; if it is 20%, the picture changes materially. **We should try to measure
   this** — possibly by running detectors in shadow mode on an early integration and reporting only
   aggregate cluster statistics.
4. **Ablation numbers for time-of-day vs. gas-price vs. graph-embedding features** from Béres et al.
   (arXiv:2005.14051) — I could not extract them from the PDF. Read the ar5iv/HTML version or the
   authors' code before we implement any timing feature.
5. **A current spot price for aged EVM wallets and for aged Web2 accounts.** I deliberately did not
   transact and could not find primary quotes. Without these, several "cost to fake" cells above are
   order-of-magnitude judgements, not measurements.
6. **DeviceCheck's exact persistence semantics** (does the 2-bit state survive OS upgrade, device
   migration via Quick Start, iCloud restore?). Confirm against Apple's documentation before
   designing a per-device issuance cap on it.
7. **Legal opinion needed** on (a) whether sybil prevention can be "strictly necessary" under Art.
   5(3) ePD, and (b) whether behavioural biometrics used for bot/not-bot classification (as opposed
   to identification) escape GDPR Art. 9. Both materially change §3.
8. **Do we ever want to be the entity that publishes a sybil list?** LayerZero had to pause its
   bounty under a flood of reports. Publishing exclusions creates an adversarial relationship with
   users and a reputational liability for our false positives. A *discount* has no equivalent
   blast radius.
9. **We need a per-protocol topology catalogue** before any detector ships: for each protocol we
   route to, record whether its honest registration graph is a tree (invite-gated) or a web
   (unilateral cheap edges), whether it has a canonical funding path, whether it has a deadline or
   campaign structure, and what its measured honest distributions look like for each statistic in
   §2. This is a small, concrete, high-value engineering artefact and it is a **precondition** for
   the detector work, not a follow-up to it. The PoH and Circles sweeps are the first two entries.

---

## References

**Primary — papers & specs**
- Ohlhaver, Nikulin & Berman, *Compressed to 0: The Silent Strings of Proof of Personhood* (2024) —
  https://ash.harvard.edu/wp-content/uploads/2024/06/proof-of-personhood_ohlhaver.pdf ;
  SSRN https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4749892 . Local analysis:
  `research/references/ohlhaver-corpus.md` (esp. §1.3, §1.5, §1.6, §1.8).
- Béres, Seres, Benczúr & Quintyne-Collins, *Blockchain is Watching You: Profiling and Deanonymizing
  Ethereum Users*, arXiv:2005.14051 (2020) — https://arxiv.org/abs/2005.14051 . Time-of-day activity
  histograms, gas-price selection and graph position as quasi-identifiers; ENS ground truth.
- *Detecting Sybil Addresses in Blockchain Airdrops: A Subgraph-based Feature Propagation and Fusion
  Approach*, arXiv:2505.09313 — https://arxiv.org/pdf/2505.09313 (**UNVERIFIED**: abstract-level
  reading only).
- Buterin, *What do I think about biometric proof of personhood?* (2023-07-24) —
  https://vitalik.eth.limo/general/2023/07/24/biometric.html
- Buterin, *Minimal Anti-Collusion Infrastructure* — https://ethresear.ch/t/minimal-anti-collusion-infrastructure/5413
- Idena **IIP-5: Mining rewards based on Quadratic staking** — https://docs.idena.io/docs/iip/iip-5
- W3C WebAuthn Level 2, attestation conveyance — https://www.w3.org/TR/webauthn-2/#enum-attestation-convey ;
  MDN https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Attestation_and_Assertion
- GDPR Art. 4(14) & Art. 9 — https://eur-lex.europa.eu/eli/reg/2016/679/oj
- EDPB **Guidelines 2/2023** on the technical scope of Art. 5(3) ePrivacy Directive, adopted
  2024-10-16 — https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf

**Primary — vendor / platform documentation**
- Trusta Labs, Sybil Score & MEDIA Score —
  https://trusta-labs.gitbook.io/trustalabs/trustscan/introduction-to-sybil-score-and-media-score ;
  MEDIA methodology https://trusta-labs.gitbook.io/trustalabs/trustgo/media-scoring-methodology
- Trusta Labs open-source sybil identification framework (GPL-3.0) —
  https://github.com/TrustaLabs/Airdrop-Sybil-Identification
- Google Play Integrity API — https://developer.android.com/google/play/integrity/overview ,
  verdicts https://developer.android.com/google/play/integrity/verdicts ,
  Oct 2025 update https://android-developers.googleblog.com/2025/10/stronger-threat-detection-simpler.html
- Apple DeviceCheck / App Attest — https://developer.apple.com/documentation/devicecheck
  (**page did not render for me**); Apple staff guidance on quotas in developer forum threads
  [759285](https://developer.apple.com/forums/thread/759285),
  [778937](https://developer.apple.com/forums/thread/778937),
  [818214](https://developer.apple.com/forums/thread/818214)
- 5sim pricing — https://5sim.net/prices
- LayerZero sybil result (803,093 addresses) —
  https://x.com/LayerZero_Core/status/1791622471965163597
- Human Passport / Gitcoin GG23 model-based sybil detection (**publishes no accuracy metrics**) —
  https://human.tech/blog/human-passport-x-gitcoin-grants-defending-gg23-with-model-based-sybil-detection
- Idena indexer (replication tooling for the Ohlhaver method) —
  https://github.com/idena-network/idena-indexer ; API https://api.idena.io ; explorer https://scan.idena.io

**Secondary — labelled as such**
- Cointelegraph, LayerZero self-report phase concluded —
  https://cointelegraph.com/news/layerzero-concludes-sybil-self-reporting-phase
- The Block, LayerZero pauses sybil bounty process —
  https://www.theblock.co/post/295274/layerzero-labs-ceo-announces-pause-of-sybil-bounty-hunter-process-after-influx-of-reports
- Approov, *Limitations of Apple DeviceCheck and App Attest* — https://approov.io/blog/limitations-of-apple-devicecheck-and-apple-app-attest
  (competitor vendor; adversarial but informed)
- Approov, *Limitations of Google Play Integrity API* — https://approov.io/blog/limitations-of-google-play-integrity-api-ex-safetynet
- Guardsquare, *Remove the constraints of iOS App Attest* — https://www.guardsquare.com/blog/remove-constraints-of-ios-app-attest
- Play Integrity Fix (bypass ecosystem, evidence that attestation is not absolute) — https://playintegrityfix.com/
- Coronium, airdrop farming proxy guide 2026 (**farming-vendor source, self-serving**; used only for
  the $50-100/month/identity proxy+antidetect price point) —
  https://www.coronium.io/blog/airdrop-farming-proxy-guide-2026
- Zipmex, *How to farm airdrops in 2026* (farming-guide source; used only for the $50-500 starting
  capital / 6-12 month horizon per identity) — https://zipmex.com/blog/how-to-farm-airdrops-in-2026/
- SMS activation pricing comparison 2026 —
  https://www.yoobfriv.com/sms-activation-services-in-2026-pricing-breakdown-across-7-platforms/

**Primary — measurements run by this project (2026-07-24)**
- **Proof of Humanity v2 vouch-graph sweep** — all 1,553 `VouchRegistered` events
  (topic0 `0x32d9c9fa0d68d72716d8ce6fb31141216cc8a7059b83f77c3a5c59041029ad76`) on
  `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`, Gnosis, from deploy block 35,846,827 via
  `rpc.gnosischain.com`. Write-up: `research/protocols/poh-kleros-brightid-idena.md`
  § "ADDENDUM — the vouch-graph test". Reproduction: `research/scripts/vouch_sweep.py`.
  **This is the source of §2 Precedent C, §2 D4a/D4b, and §6.2a — the single most load-bearing
  measurement in this file.**
- **Circles invitations-at-scale measurement** — `CrcV2_InvitationsAtScale.RegisterHuman(human,
  originInviter, proxyInviter)`; one `originInviter` behind 2,754/10,000 (27.5%) recent
  registrations via 1,687 proxy addresses, versus 47/10,000 for the top direct inviter. Write-up:
  `research/protocols/circles.md`.

**Internal cross-references**
- `research/references/ohlhaver-corpus.md` — the Idena detection method in full
- `research/protocols/circles.md` — `originInviter` / `proxyInviter` measurement
- `research/protocols/poh-kleros-brightid-idena.md` — the vouch-graph counterexample
- `research/landscape/sybil-incidents-antipatterns.md` — farm economics, KYC rental, credential markets
- `research/landscape/reputation-scoring-products.md` — the vendors selling these signals
- `research/landscape/prior-art-scoring.md` — scoring mathematics
