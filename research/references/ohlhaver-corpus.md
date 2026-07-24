# Puja Ohlhaver — corpus and intellectual lineage

> STATUS: in progress — research underway 2026-07-24

**Purpose:** absorb Ohlhaver's critique of proof-of-personhood into the aggregator's design
thinking. Not a protocol write-up. Citation / date-stamping / honesty rules from
`research/BRIEF.md` apply.

**Compiled:** 2026-07-24

## 0. Who she is / affiliations

**Primary source:** her own site, https://www.pujaohlhaver.com/about-7 (retrieved 2026-07-24).
Nav is `home / writings & talks / notes`, where *writings & talks* =
https://www.pujaohlhaver.com/writings-resesearch (note the typo in the slug, it is genuine) and
*notes* = her Substack https://pujaohlhaver.substack.com .

Career, in her own framing: Stanford JD → corporate law at Skadden, Arps → founded a women's
healthcare company that secured **two FDA approvals** → pandemic policy (helped steward a bipartisan
testing bill; co-author on Danielle Allen's *Pandemic Resilience* roadmap at Harvard's Safra Center,
May 2020) → consensus protocols and computational regulation. She is **not** a cryptographer and
does not present as one; she is a lawyer-institutionalist who reads mechanism design. That is
relevant to how to use her: her contribution is problem-framing and political economy, not
constructions we can implement off the page.

**Current affiliation (2026-07):** Research Affiliate of **Harvard's Allen Lab for Democracy
Renovation** (formerly/also GETTING-Plurality Research Group, Edmond J. Safra Center for Ethics) —
https://gettingplurality.org/2023/03/15/puja-ohlhaver/ . She states she "advise[s] a handful of
experiments, nonprofits and startups" without naming them. Also listed as a RadicalxChange speaker
(https://www.radicalxchange.org/speakers/puja-ohlhaver/) and a Foresight Institute affiliate
(http://foresight.org/people/puja-ohlhaver/). **UNVERIFIED:** no evidence found of any Flashbots
affiliation; she is not an employee of any protocol, and explicitly disclosed holding no IDNA.

Her own one-line statement of the research programme (About page): *"My work supports a third way:
leveraging social ties to define context, cryptography to secure communication, and AI to bridge
cooperation."* And: *"I began making the case for **community credentials** as essential to
decentralization, collusion-resistance, and bottom-up, networked cooperation."* Note the term —
*community* credentials, not *personhood* credentials. The distinction is the whole argument.

### The complete corpus (from her own writings index, retrieved 2026-07-24)

Papers — there are only **three**:
1. "Community Currencies: The Price of Attention and Cost of Influence" (January 2025) — SSRN 5136037
2. "Compressed to 0: The Silent Strings of Proof of Personhood", with Nikulin & Berman (2024-03-06) — SSRN 4749892
3. "Decentralized Society: Finding Web3's Soul", with Weyl & Buterin (2022-05-10) — SSRN 4105763

Plus one Substack post ("Common Knowledge Machines", 2024-10-01), a set of talks/interviews, four
2020 COVID op-eds (WaPo, NYT, USA Today, Wired), and a 2009 law-review article on Rwanda's coffee
sector. **"Between Zero and One" does not appear on her own index** — see §3.

She writes slowly and publishes little. Treat each paper as load-bearing.

## 1. Compressed to 0: The Silent Strings of Proof of Personhood (2024)

**Correct citation.** Title is *"Compressed to **0**"* (numeral, not "Zero"). **Three** authors, not two:
Puja Ohlhaver, Mikhail Nikulin, Paula Berman.
- SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4749892 (SSRN abstract id 4749892)
- Full PDF (Harvard Ash Center, June 2024): https://ash.harvard.edu/wp-content/uploads/2024/06/proof-of-personhood_ohlhaver.pdf
  — 39pp + 2 appendices; PDF internal title "FINAL PAPER DRAFT". This is the version I read in full.
- Also published in *Stanford Journal of Blockchain Law & Policy* vol 8 no 1:
  https://stanford-jblp.pubpub.org/pub/compressed-to-0-proof-personhood
- Author talk (Ash Center / GETTING-Plurality): https://www.youtube.com/watch?v=oTAsln1RDWg

**Disclosures (p.1 nn.2-4):** Ohlhaver is an independent researcher, holds no IDNA and was not
compensated. Nikulin is Idena's founder and **holds IDNA**. Berman is COO of RadicalxChange and
**holds IDNA**. Two of three authors are financially exposed to the protocol being studied — worth
holding in mind, though the paper's findings are *unflattering* to Idena, which cuts against bias.

Acknowledgements name Glen Weyl, Vitalik Buterin, Phil Daian, Andrew Miller, Barnabé Monnot,
Zaki Manian, Henry Farrell, Alex Tabarrok, Nicolás Della Penna and others (p.1 n.1).

### 1.1 The claim in one paragraph

Idena **succeeded** at the thing every PoP protocol advertises — it filtered bots, verified
flesh-and-blood humans, and (uniquely) it defeated account *trading*. And it still collapsed. What
it collapsed into was not sybils but **puppets**: real, verified, unique humans paid small sums by
high-information operators to perform validation ceremonies while the operator held the keys and
took the rewards. Abstract, p.1: *"Achieving de jure sybil-resistance (filtering humans from bots)
revealed a deeper challenge of de-facto sybil resistance (filtering humans acting like bots), which
could not coherently or computationally be disentangled from the problem of collusion-resistance."*

### 1.2 Headline statistics (all from the paper; period Aug 2019 – May 2022)

| Fact | Value | Locator |
|---|---|---|
| Peak network size | 15,778 accounts, mid-April 2022 | p.16 |
| Solo accounts, Jun 2021 → May 2022 | **62% → 27%** of network | p.17, Fig. 9 |
| Large pools (>15 accts), Jun 2021 → May 2022 | **22% → 61%** of network | p.17, Fig. 9 |
| Family pools (<15 accts) | steady ~12-15% throughout | p.17 |
| Reward capture, 7 May 2022 | solo = 27% of accounts but **18% of rewards**; large pools = 61% of accounts and **70% of rewards** | p.17, Fig. 10 |
| Concentration at May 2022 peak | **23 entities = <0.6%** of distinct entities controlled **≥~40% of accounts** and distribution of **~48% of rewards** | Abstract p.1; Intro p.3 |
| Top-3 concentration | **3 entities → ~19% of accounts, ~24% of rewards** | Abstract p.1 |
| UBI per epoch (the bribe that started it all) | **$2–$14** per epoch for ~30 min work every 1–3 weeks | Abstract p.1, Intro p.3 |
| Epoch reward range Jan 2020–May 2022 | $1.60–$98; mean $18, median $14, sd 14 | p.11 n.31 |
| Implied puppet wage arbitrage | puppets paid ~local median ($0.72/hr Indonesia, $2.18/hr Russia); account earned $6.40–$56/hr ⇒ puppeteer captures **~$4–$55/hr, i.e. 2x–55x** the puppet's market wage | p.11 + nn.30-31 |
| First puppeteer confession | Dec 2020, operator with **500+** participants | p.10 |
| Indonesian operator | **1,400+** paid accounts, self-revealed Sept 2021 | p.14 n.36 |

**Numbers our transcript got wrong.** The ASR transcript says "$2 to $4" — the paper says
**$2 to $14**. It says "23 entities … less than 1%" — the paper says **<0.6%**. Prefer the paper.

### 1.3 The empirical method for detecting third-party key access

The detection signature is behavioural, not cryptographic. From p.9 (Section III.A):

- **Blocks of one-way transfers, at the same time, to the same wallet.** Many validated accounts
  sending their unlocked transferable rewards to a single address, simultaneously, with the funds
  never returning on-chain and proceeding onward to exchanges. Paper, p.9: *"Blocks of one-way
  transfers at the same time to the same wallet implied automation, which would require 3rd party
  access to a participant's private keys. Either participants had unwittingly ceded their keys to a
  3rd party, or never had them."*
- **Simultaneous OR sequential automated transactions** are the two criteria applied to pools
  post-delegation (p.18, Section IV.B).
- **Corroborating off-chain evidence:** forked Idena clients that mask the private key from the
  user — the paper cites a real fork, https://github.com/haritowa/idena-mirror , whose commits
  include hiding private-key access and "remove dangerous buttons" (p.10 n.26). This is the
  strongest single artefact in the paper: someone shipped software whose *purpose* is to keep a
  verified human from knowing their own key.
- Direct confessions via Telegram/Discord DMs to the Idena team (Figs. 3, 4, 5, 7).

**Named on-chain artefacts** (useful if we ever want to replicate the method):
`0x989daf4e639ea7438029fdbd3b04c79553f7164c` (Russian collector wallet, p.9 n.25), which later
delegated to pools `0xDDDDaDDB856901ac3e2251b8234EfeaB2188b22A` and
`0xDDDDcFdCC512FacD27038BAd958742E81e2982cB`; Indonesian pool
`0x96d11da40FDe82D81ebE0EAE61bFe6a47F43d1a6` (p.14 n.36); a *possible cooperative* (i.e. benign)
pool `0xb0C3fD00cCd9CEAf17dad2524212021953D6ce0B` (p.12 n.32). Explorer: `scan.idena.io`.

### 1.4 Puppets, defined

- **Strong puppet** — unaware of their account's private keys at all.
- **Semi-strong puppet** — "knows" their private key but is unaware of its significance in the
  protocol. (p.10 and n.27.)
- Puppeteering also covers coercion, not only payment (p.10 n.27) — the paper's most disturbing
  exhibit is Fig. 7, a video frame from an Egyptian pool operator showing **child** puppets.
- Crucially, agency is **context-relative**, not a property of a person (p.10 n.29): *"A person's
  agency is not either-or, but context-specific. A person can be an 'agent' in local contexts with
  relatively high information and control … and yet be a 'de facto sybil' (acting like a bot) in
  more socially distant … contexts."* **This is the sentence that most directly damages a global
  scalar personhood score.**

### 1.5 Why the same on-chain pattern can't distinguish puppeteering from cooperation

p.12: *"Theoretically, the same transaction pattern of blocks of one-way transfers at the same time
to the same wallet were consistent with puppeteering and voluntary cooperation. Both extremes
differed not in their coordination on-chain, but in the distribution of information and
control—or power— off-chain."*

Puppeteering vs cooperation is a **spectrum**, and a pool can slide along it over time; a
cooperative pool is exposed to exactly the same principal-agent asymmetry and can decay into a
puppeteered one (p.13). This is the single most important methodological caveat for us: **on-chain
co-movement is evidence of key-sharing, not of exploitation.** Ohlhaver needs a second, off-chain
argument to get from one to the other — which is the "silent strings" argument (§1.7).

### 1.6 Delegation: the fix that made it worse

March 2021 hard fork introduced **delegation** — accounts band under one pool account/node so the
operator no longer needs private keys (p.15-16, ref
https://medium.com/idena/idena-hard-fork-announcement-mining-delegation-and-oracle-voting-8a5f9ddd9797).
The bargain: operator can withdraw the account's 20% identity stake and terminate the account
*without* the keys; operator receives the 80% transferable rewards stream and distributes at
discretion; pooled accounts **give up their voting power**.

The paper's profit algebra (p.16) is the clearest statement of the economies-of-scale problem:

> Pre-delegation:  `P_pool = a_pool (c + m − t − n)`
> Post-delegation: `P_pool = a_pool (c + m − t) − n`

Moving the node cost `n` outside the per-account multiplier is *exactly* an economy of scale.
Delegation made pools legible **and simultaneously made them cheaper to run than being a solo
account**. Transparency was bought at the price of accelerating concentration. Note also the
second-order harm: as pools consolidated onto single nodes, node count fell, degrading throughput
and 51%-attack security (p.17-18).

**And it did not even work as intended:** despite delegation removing the *need* for key access,
all of the top pools still showed third-party key-access signatures (see §1.7).

One genuinely important counter-fact, easy to miss (p.18, p.26): because voting was **one-node,
one-vote**, and pools consolidated onto single nodes, pooled accounts' voting power was
automatically discounted. By May 2022 large pools were **61% of accounts but only ~2.4% of votes**,
while solo accounts were **27% of accounts but ~89% of votes**. That accidental correlation
discount is what let the solo minority hard-fork the protocol out of the crisis. *A correlation
discount on influence saved the network.* This is the single most constructive empirical datum in
the paper for anyone building a scoring system.

### 1.7 The "silent strings" argument (Section IV.D, pp.21-25)

This is the paper's genuinely novel epistemic move and the source of its title. The problem: third-
party key access alone is ambiguous — it is either puppeteering, or it is voluntary
"custody-as-a-service" chosen by a high-information participant who can hold the operator
accountable off-chain. Ohlhaver refuses to just assert the first, and instead argues from **the
absence of the artefacts an accountable custody market would necessarily produce.**

The formal move (p.23 and n.53): 3rd-party key access **plus absence of accountability** are jointly
sufficient conditions for puppeteering. Then she establishes the absence of accountability
evidentially, via five strands (paper's own bulleted list, pp.24-25):

1. **Silence** — no advertising of key-custody services, no formal legal disputes, and no informal
   customer complaints on community forums. Across ≥40% of a global network's accounts, at least a
   few broken bargains should have surfaced. They did not.
2. **Rule of law** — the three known large-pool jurisdictions (Russia, Egypt, Indonesia) combine
   cheap labour with weak rule of law, so legal recourse was implausible anyway (cites World Justice
   Project Rule of Law Index).
3. **Pool size and growth** — informal accountability lives in *strong ties*. Family pools (<15
   accounts, strong ties) flat-lined at ~12%; large pools (>100 accounts, weak ties) bloomed to ~40%
   of the network. Growth went exactly where accountability was weakest — "a signal of paid recruits."
4. **Communication** — the top operators (~14% of network accounts, Russia + Indonesia) openly
   confirmed paying participants to perform ceremonies. Plus Fig. 7, child puppets.
5. **Meteoric rise and fall** — the top 3 networks (~19% of accounts) show boom/bust curves
   consistent with paid enterprises sensitive to unit economics, or with puppets waking up and exiting.

She is admirably explicit about the weakness of the inference (p.24 n.58): *"While absence of
evidence around accountable key custody services is not evidence of unaccountable puppeteering, we
find this absence in a global digital protocol improbable, especially when coupled with positive
signs of on-chain 3rd party key access and other indicators."*

**Assessment for us.** The argument is good but it is *inference to the best explanation*, not
proof. It cannot be automated. Note carefully what that implies: the on-chain part of her method
detects **key-sharing**; the classification of key-sharing as **exploitation** required Telegram
DMs, jurisdiction priors, tie-strength priors, and forum archaeology. Any aggregator that hopes to
"detect puppeteering on-chain" inherits precisely this gap. See §6.1.

### 1.8 Exact criteria used on the top 31 pools (Section IV.B p.18 + Appendix B pp.40-41)

The replicable core of the method. Primary signature:

> **"the unlikely coincidence of simultaneous or sequential transactions from different accounts in
> the same pool"** — specifically `account delegation` and `account termination` transactions
> clustering in time within a pool. *All 31 pools showed this pattern.*

Three corroborating "funnelling" signatures:
- Pool operator receives **all identity stake** after an account is terminated (via `terminate
  identity` by the account, or `kill delegator` by the delegator). All 31 pools showed this.
- Delegated accounts funnel **all transferable rewards earned *before* delegation** to the operator
  — i.e. paying for a service before any service was rendered. All pools except pool 31 ("Egyptian
  Pharaoh") and pool 9.
- Operator **withholds** transferable rewards rather than distributing them, then sends them to a
  hive wallet or an exchange. All pools except 31 and 9.

Sample selection: **all 31 pools that ever exceeded 100 delegated accounts** in protocol history.
Then a second pass on **financial transfers between pools** to detect shared operators → the 31
pools collapse into **23 entities**. Within the top-31, 3 entities held ~half the pooled accounts:
Russian ~24%, Indonesian ~10%, unknown-origin ~13%.

Named networks (Appendix B): Russian operator ran **5 pools**, self-doxxed the `0xdddd` address
prefix in community Discord (May 2021); two pools each peaked >500 accounts. Indonesian pool
`0x96d11da40FDe82D81ebE0EAE61bFe6a47F43d1a6` rose to 1,400+ accounts within a year then collapsed.
"Unknown network" of 5 pools peaked at 1,280 accounts (June 2022), notable for adding 500+ accounts
in a single epoch (epoch 86, May 2022); it died after IIP-5, the sublinear identity staking change.

**Coverage caveat, stated by the authors (p.25):** the analysis covers only the top 31 pools and
**excludes 84 mid pools (15–100 accounts, 21.5% of accounts) and 411 family pools (<15 accounts)** —
i.e. **94.6% of pools**, ~30% of accounts. They argue the excluded 84 are probably also puppeteered,
on a wallet-balance argument: mean per-account transferable balance was ~64 (sd 42) for the 31
confirmed pools, ~129 (sd 132) for the 84 unconfirmed, but ~1,628 (sd 6,044) for family pools —
low balances being consistent with regular cash-out by an operator (p.25 nn.59-60). Their
conclusion: *"The statistics could only get worse, not better"* (p.25).

**Methodology (Appendix A, p.38):** data from Idena's open-source indexer
(https://github.com/idena-network/idena-indexer), API https://api.idena.io , explorer
https://scan.idena.io , triangulated with Discord/Telegram conversations. Crucially: the 31 pools
were **examined manually**. No formal chain-analysis of all pools was done; the authors explicitly
invite others to do it. So the method is *hand-audited forensics*, not a deployable classifier.

### 1.9 The five arguments that matter to us (Discussion, Section V)

**(a) PoP is reductive by construction** (p.27): *"Proof of Personhood is reductive, compressing
identity into a standardized binary ('verified' or 'not verified') and overlooking the social and
economic ties from talking and trading that differentiate people. When power is at stake—money,
votes—such global identity systems with uniform rules for qualifying as 'human' pave the way for
those who already have power … to find loopholes, align interests, and collude to exploit the
system's simplicity."*

**(b) Account trading is a *precursor*, not a symptom of weakness fixed** (pp.28-29). Idena beat
account trading with identity staking + slashing + periodic re-auth, and puppeteering came
**after**, as the next-cheapest strategy. Therefore: *"illicit account trading in protocols should
not be treated as evidence of advanced mechanisms or protections; to the contrary, illicit trading
may signal a lack of them and be a precursor to puppeteering."* Directly names Worldcoin's 2023
credential black market (CoinDesk, May 2023) and a Proof of Humanity Kleros sock-puppeteering case.
**Read that inversion carefully: a protocol with *no* observable credential market may be *further
along* the corruption curve, not safer.**

**(c) Network effects make a corrupted PoP network sticky** (pp.29-31). *"Because the incentive to
join the network increases super-linearly as the network grows, new participants may lack
alternatives but to join a partially corrupted network in order to have any influence over
governance or to earn UBI. As non-participation becomes synonymous with socio-economic exclusion,
participation risks becoming quasi-mandatory."* She calls it a "free but forced" Hobson's choice
(citing Grewal, *Network Power*). This is the passage the aggregator thesis should be read against —
see §6.2.

**(d) De facto sybil resistance ≡ collusion resistance** (Section V.C, pp.32-34). The core
theoretical claim: *"de facto sybils (puppets) are the natural objects of 'colluders'
(puppeteers), in the same way principals are the objects of agents. By extension, de facto sybil
resistance is a mutually-implicated (or mirror) challenge to 'collusion-resistance:' neither can be
solved independently but both must be tackled simultaneously."* The mechanism: puppets are simply
participants whose beliefs and desires are **correlated** with a socially-tied third party who holds
an information/control advantage. Colluders are correlated with *each other*. Both are correlation
phenomena — so both are measured on the same axis.

And the crucial framing (p.33): *"de facto sybils ('programmed puppets') is not a technical problem,
but a social one."*

**(e) Her constructive direction — plural attention mechanisms, bridging, and many identity games.**
Rather than *remove* the causes of collusion (which ends in surveillance or enforced informational
uniformity — she explicitly invokes 20th-century communism, p.36), *check its effects*. Named
mechanisms (pp.33-34):
- **Consensus across difference / bridging bonuses (anti-correlation):** elevate proposals endorsed
  by participants or clusters who *normally disagree*. Credits Audrey Tang for the "bridging bonus"
  framing (p.34 n.86).
- **Peer prediction:** surface expertise and elevate truth.
- Together these give participants an incentive to **"cross long bridges"**, which yields novel
  information, which forms new groups, which **raises the cost of influencing a participant** — i.e.
  it attacks de facto sybils by *increasing informational diversity*, not by detecting fraud.

The most directly actionable sentence in the whole paper for an aggregator is a footnote (p.34
n.87): *"if the goal is to filter 'fake' from 'authentic' accounts, the threshold for 'fake' moves
from attestations from a verification method (whether biometric, cognitive, or otherwise) to a
constellation of uncorrelated attestations from participants who are unlikely to be talking to each
other."* **That is a specification for a different product than the one our README describes.** See §6.4.

Closing thesis (p.37): *"Within the pursuit of egalitarianism, the choice is two-fold: level the
playing field, or expand it. … whereas a single identity game has inevitable economies of scale
towards one global oligopoly, a plurality of games open the possibility space for a normal
(Gaussian) distribution of power, achieved through diversity, not brute-forced equality."*

### 1.10 Off-chain migration / Dark DAOs (Section V.D, pp.35-36)

Context: Daian, Kell, Miers & Juels, "On-Chain Vote Buying and the Rise of Dark DAOs" (2018,
http://hackingdistributed.com/2018/07/02/on-chain-vote-buying/); and Complete Knowledge
(Kelkar, Babel, Daian, Austgen, Buterin, Juels — https://www.cs.cornell.edu/~babel/papers/ck.pdf),
which proves a prover has *unencumbered* access to a key, thereby making it impossible to credibly
sell a vote.

Her objection is deceptively simple and, I think, correct: *"a Proof of Complete Knowledge may
establish that someone has direct access to a private key, but doesn't guarantee that the intended
or designated participant does."* A puppeteer holding the key trivially produces a valid proof of
complete knowledge. The cryptography binds a *key* to *unencumbered access*, not a key to a *person*.

Hence: *"Thwarting on-chain vote-buying doesn't solve for off-chain vote-buying into 'meatspace,'
and may encourage it as a low-cost alternative."* (p.36). She notes identity staking is essentially
**MACI's deposit mechanism** (p.36 n.94, citing Buterin's MACI post,
https://ethresear.ch/t/minimal-anti-collusion-infrastructure/5413) — a deposit stealable by anyone
who has your key, to discourage key sharing. Idena's version worked against *trading*, and the
displaced demand reappeared as *puppeteering*. **Hardening one channel priced the adjacent channel
in.**

## 2. Decentralized Society: Finding Web3's Soul (2022)

**Ohlhaver, E. Glen Weyl, Vitalik Buterin**, 2022-05-10. SSRN 4105763
(https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4105763). Free PDF:
https://www.radicalxchange.org/updates/papers/desoc.pdf — 36pp + appendix, read in full.
**Ohlhaver is first author.** Widely (and wrongly) remembered as "Vitalik's SBT paper."

### 2.1 What it actually proposed

Primitive (§3): **Souls** = accounts/wallets holding publicly visible, **non-transferable**
(possibly issuer-revocable) tokens called **Soulbound Tokens (SBTs)** representing "commitments,
credentials, and affiliations." SBTs may be self-certified (like a CV) but derive their power from
being **attested by counterparty Souls** — a university, an employer, a conference, another person.

Abstract: *"we illustrate how non-transferable 'soulbound' tokens (SBTs) representing the
commitments, credentials, and affiliations of 'Souls' can encode the trust networks of the real
economy … Key to this sociality is decomposable property rights and enhanced governance
mechanisms—such as quadratic funding discounted by correlation scores—that reward trust and
cooperation while protecting networks from capture, extraction, and domination."*

The "stairway" of applications (§2): provenance; undercollateralized lending via reputation;
decentralized key management; thwarting coordinated strategic behaviour; **measuring
decentralization**; decomposable/shared property rights.

### 2.2 The three parts that matter for us

**(a) Community recovery — identity as the intersection of groups.** Key recovery by "the
intersectional vote of its social network," with guardians deliberately drawn "from discrete social
circles to avoid collusion" (§4.3). Security *increases* as a Soul joins more distinct communities.
The explicit theoretical basis is Georg Simmel: *"individuality emerges from the intersection of
social groups, just as social groups emerge as the intersection of individuals."* And the
anti-sale property: *"because a Seller would need to prove selling the recovery relationships, any
attempt to sell a Soul lacks credibility."* — i.e. **make the credential unsellable by rooting it in
relationships that cannot themselves be transferred.** This is the deepest idea in the paper and it
is the direct answer to the credential-rental problem. Note it is a *social* construction, not a
cryptographic one.

**(b) Correlation-discounted governance (§4.5).** Four ways DAOs could use SBTs against sybils. The
fourth is the novel one: *"checking for correlations between SBTs held by Souls who support a
particular vote, and applying a lower vote weight to voters who are highly correlated."* And the
justification is exactly Ohlhaver's later de-facto-sybil argument, two years early:

> *"A vote supported by many Souls who all share the same SBT(s) is more likely to be a Sybil
> attack and—even if not a Sybil attack—such a vote is more likely to be a group of Souls who are
> making the same error in judgment or who share the same bias, and so should reasonably be
> weighted less than a vote with the same numerical level of support but from a more diverse base
> of participants."* (§4.5, p.7)

**This single sentence is the design principle we should be arguing about.** It says: *do not try
to decide whether the correlated voters are fraudulent. Discount them either way.* It dissolves the
puppeteering-vs-cooperation ambiguity that §1.5 showed is undecidable on-chain — by making the
distinction **irrelevant to the mechanism**. Fraud and shared bias get the same treatment because
they do the same damage.

**(c) Measuring decentralization through pluralism (§4.6).** Explicitly attacks the Nakamoto
coefficient and Herfindahl-Hirschman index as inadequate because they beg the question of what a
"distinct entity" is: *"even if addresses could be traced back to unique individuals, those
individuals could be socially correlated groups prone to accidental coordination (at best) or
intentional collusion (at worst)."* Proposed three-step replacement: (1) limit voting to
SBT-rich/sybil-resistant Souls; (2) discount votes by Souls sharing many SBTs, "pooling them as
only partially separate"; (3) measure correlations across *layers of the stack* — voting, token
ownership, governance communication, control over compute. Illustrated with a photo of the mining
pool operators controlling 90% of Bitcoin hashpower sitting on one conference panel.

### 2.3 The correlation score — the actual math (Appendix A)

This is the only fully specified mechanism in her corpus, so it is worth stating exactly. It is
**Pairwise Matching**, credited to Buterin (2019). For every *pair* of agents (A,B) contributing
`x_A→P` and `x_B→P` to the same project P, the subsidy is:

```
Match_AB→P  =  2M · sqrt(x_A→P · x_B→P) / (M + CorrelationScore_AB)

CorrelationScore_AB  =  Σ over all projects P  of  sqrt(x_A→P · x_B→P)
```

Properties the paper states:
- If A and B always fund different things, `CorrelationScore ≈ 0`, the denominator is ~M, and the
  formula **reduces to ordinary quadratic funding** (`2·sqrt(x_A x_B)`), i.e. no penalty for being
  independent.
- The more two agents co-fund, the more each *further* co-contribution cannibalises subsidy from
  their own earlier ones. Total subsidy per pair is bounded: `lim(T→∞) 2MT/(M+T) = 2M`.
- **The key security property:** losses from N colluding/fake agents are bounded above by
  `M·(N² − N)`, where M is a system parameter. Under naive QF the loss is *unbounded*
  (`V·(N² − N)`). Under "Cluster Matching" the loss is also unbounded if the clustering
  misidentifies even one colluding group as independent.

That last point is the one to internalise. **Pairwise correlation discounting is a
bounded-loss design that does not require you to correctly identify who is colluding.** The paper
is explicit that it is "second-best, optimized for the case where limited outside information is
available about which actors are actually colluding" and does not achieve optimality. That is
precisely our epistemic situation, and it is the strongest argument in the whole corpus that a
*scoring* product can be made robust without a working puppet-detector. See §6.3.

The paper also flags the generalisation: the correlation score "could attempt to include similar
terms for all instances where those two actors gained a benefit by cooperating" — i.e. correlation
measured across *every* observable shared behaviour, not just one funding round. That is the shape
of a cross-protocol signal.

### 2.4 What happened to it: essentially nothing shipped

Honest assessment. Four years on (paper May 2022 → today 2026-07), the concrete legacy is:
- **The vocabulary won.** "Soulbound" entered general use.
- **Attestation infrastructure shipped, the mechanism did not.** Ethereum Attestation Service, EAS
  schemas, Optimism's attestation work, Gitcoin Passport stamps and POAP all instantiate "Souls
  holding issuer-attested non-transferable claims." What none of them shipped is the part the paper
  said was the point: **correlation-discounted governance**. We got the data structure without the
  mechanism.
- **Correlation discounting DID ship, and it is the one thing from this lineage that works.**
  Gitcoin's **COCM (Connection-Oriented Cluster Matching)** is the direct descendant of the
  Appendix A pairwise formula and is live in production: it supplied sybil resistance for **Gitcoin
  Grants 24 (GG24)**, whose main QF donation window ran **2025-10-14 to 2025-10-28**
  (https://gitcoin.co/campaigns/gitcoin-grants-24-gg24). Gitcoin reports COCM has been used across
  **20+ rounds distributing $5.5M+**, with a claimed **~50% improvement** in allocation quality vs
  plain QF (https://www.gitcoin.co/blog/leveling-the-field-how-connection-oriented-cluster-matching-strengthens-quadratic-funding
  — vendor blog, treat the 50% as marketing).
  Mechanically COCM: (1) identifies overlapping donor clusters, (2) computes pairwise similarity via
  direct and indirect connections, (3) pays more to projects whose donors span diverse clusters.
  **Its cluster signal is donation *behaviour* — recipient overlap, donation amounts, wallet
  creation timing — not credentials.** Gitcoin Passport is used alongside it for a separate,
  prior sybil-filtering step. Stated limitations: penalises newer projects and genuinely tight-knit
  communities; works best on large diverse rounds.
  *Two things to take from this.* First, correlation discounting is **not theoretical** — it has
  years of production history on real money. Second, its worked example of a caught attack ("Crypto
  Babes Club": wallets with identical donation amounts, near-simultaneous creation dates, and
  single-project focus) is **the same co-movement signature Ohlhaver used on Idena**, found
  independently, on a different chain, against a different attack. That is the strongest existing
  evidence that the cross-protocol detector in §6.1 is buildable.
- **No SBT ERC became load-bearing.** ERC-4973 / ERC-5114 exist as standards; neither anchors a
  significant ecosystem.

**Why did it not ship? Four reasons, and each one is a warning for us.**

1. **It required an issuer ecosystem that did not exist and had no incentive to appear.** SBTs are
   only useful if universities, employers and institutions issue them. The paper assumed the hard
   part was the token; the hard part was the *issuers*. Nobody was paid to attest.
2. **The mechanism needs density to work.** A correlation score over two credentials is noise. The
   design has increasing returns to coverage — which means it is worthless until it is nearly
   complete. That is a brutal bootstrapping curve, and it is *our* bootstrapping curve too.
3. **Public non-transferable credentials are a privacy catastrophe**, which the paper conceded and
   deferred to future work under the name "programmable privacy." Publicly legible affiliations are
   a targeting list. The unsolved privacy problem is a large part of why nobody built it.
4. **Non-transferability is not enforceable.** You cannot make a token non-transferable if the
   *human* is willing — you can only make the *token* non-transferable. Sell the wallet, sell the
   phone, sell your time. This is precisely the hole that *Compressed to 0* walked into two years
   later, empirically. **The 2024 paper is best read as the author auditing her own 2022 proposal
   and finding the load-bearing assumption false.** That is a mark in her favour, and it is why she
   is worth taking seriously.
## 3. Between Zero and One — sublinear identity staking
## 4. Later work: social identity / plural identity (2024-2026)
## 5. Surrounding lineage

Brief, and deliberately built from *her own citation graph* (all references below are ones she
actually cites in *Compressed to 0* or *DeSoc*), so it situates her rather than surveying the field.
Another agent covers the general PoP literature.

### 5.1 Bryan Ford — pseudonym parties and the origin of "proof of personhood"

The term is Ford's. Two anchors she cites:
- Borge, Kokoris-Kogias, Jovanovic, Gasser, Gailly & **Ford**, "Proof-of-Personhood:
  Redemocratizing Permissionless Cryptocurrencies," *IEEE EuroS&PW* (2017), pp.23-26,
  https://doi.org/10.1109/EuroSPW.2017.46 — the paper that names the concept.
- **Ford**, "Identity and Personhood in Digital Democracy: Evaluating Inclusion, Equality, Security,
  and Privacy in Pseudonym Parties and Other Proofs of Personhood" (EPFL, 2020),
  https://arxiv.org/pdf/2011.02412.pdf . She quotes his framing directly (p.29 n.68): digital
  democracy needs *"an enforceable assurance that every real, natural human person may participate
  freely in digital democracy, expressing their true and uncoerced preferences in online governance,
  while exercising one and only one vote."*

**Pseudonym parties** are the mechanism: physically co-located, simultaneous, periodic in-person
gatherings, where uniqueness follows from the fact that one body cannot be in two places at one
time. Idena is essentially a *virtualised* pseudonym party — synchronous global ceremonies at a
fixed UTC time, with FLIP puzzles standing in for physical presence.

**Note the phrase "true and uncoerced preferences" in Ford's own definition.** Ford already
specified the requirement that Idena failed. Ohlhaver's contribution is not spotting a new
desideratum — it is the empirical demonstration that satisfying the *uniqueness* half of Ford's
definition does nothing for the *uncoerced* half, and may actively undermine it by attaching money
to the credential. Her originality is evidentiary, not conceptual.

Also cited: Siddarth, Ivliev, Siri & Berman, "Who Watches the Watchmen? A Review of Subjective
Approaches for Sybil-Resistance in Proof of Personhood Protocols," *Frontiers in Blockchain* 3
(2020) — note Paula Berman is a co-author on both that survey and *Compressed to 0*.

And the root: J.R. Douceur, "The Sybil Attack" (2002),
https://doi.org/10.1007/3-540-45748-8_24 — plus Mazorra & Della Penna, "The Cost of Sybils,
Credible Commitments, and False-Name Proof Mechanisms," https://doi.org/10.48550/arXiv.2301.12813 ,
which unifies the "sybil-resistance" and "false-name-proofness" literatures around the **relative
cost of faking an identity**. That cost parameter is what our aggregate score is implicitly a proxy
for, and it is the right frame for pricing credentials — see §6.2.

### 5.2 MACI — minimal anti-collusion infrastructure

Buterin, "Minimal Anti-Collusion Infrastructure" (EthResearch, May 2019),
https://ethresear.ch/t/minimal-anti-collusion-infrastructure/5413 . She name-checks it because
**Idena's identity staking is structurally MACI's deposit**: MACI requires a voter to post a deposit
that *anyone who learns the private key can steal*, which makes sharing your key
self-destructive. Idena's locked 20% identity stake does the same job — withdraw it and you lose
your humanity status.

MACI's core is a coordinator plus ZK proofs enabling **key-switching**: a voter can invalidate an
earlier vote by re-keying, so a briber can never verify what was finally cast. That is
*receipt-freeness* — it makes on-chain vote-selling non-credible.

Her critique lands exactly here (§1.10): MACI and Complete Knowledge both bind a **key** to
**unencumbered use**. Neither binds a key to a **person**. A puppeteer who simply *is* the key
holder from registration onward satisfies every one of these constructions perfectly. Idena's
identity staking beat account trading, and the demand reappeared as puppeteering, which identity
staking does not touch at all. **Anti-collusion crypto raises the cost of the on-chain channel and
thereby subsidises the meatspace channel.** For the aggregator analogue see §6.6.

Related: Daian, Kell, Miers & Juels, "On-Chain Vote Buying and the Rise of Dark DAOs" (2018),
http://hackingdistributed.com/2018/07/02/on-chain-vote-buying/ ; and Kelkar, Babel, Daian, Austgen,
Buterin & Juels, "Complete Knowledge: Preventing Encumbrance of Cryptographic Secrets,"
https://www.cs.cornell.edu/~babel/papers/ck.pdf .

### 5.3 The collusion-resistance literature she builds on

**Miller, Weyl & Erichsen, "Beyond Collusion Resistance: Leveraging Social Information for Plural
Funding and Voting"** (SSRN, Dec 2022), https://ssrn.com/abstract=4311507 — the paper she quotes at
length (p.33 n.82) and the direct theoretical bridge between sybils and collusion:

> *"What makes Sybil agents Sybils is that the will of one entity centrally coordinates them. They
> should be recognized as precisely the same because they all listen to that same entity and that
> entity alone. … we might think of a Sybil agent as similar to an individual who identifies very
> strongly with one specific group, and mostly coordinates their actions with the will of that
> group… So as we move to the other end of the spectrum, individuals in fewer and fewer social
> groups begin to look more and more like the type of self-interested agents that economists usually
> put into their models – i.e., the homo economicus."*

**Read that carefully, because it is the load-bearing claim of the whole programme:** sybil-ness is
a *continuous* quantity, and it is measured by **how few independent groups an agent belongs to**.
A bot, a puppet and a true believer sit on one axis. This is what makes an *independence* score
coherent as an idea (§6.4) — and it is also the claim most open to challenge, since it implies a
devout, single-community person is legitimately less than one person.

Supporting sociology, both cited by her:
- **Georg Simmel**, *Conflict & The Web of Group-Affiliations* (1955/1995), p.151 — quoted at p.34
  n.87: adding group affiliations *"give[s] him a stronger awareness of individuality in general."*
  Individuality **increases** with diverse sociality. This is the intellectual root of the whole
  "person = intersection of groups" model, in both DeSoc and *Compressed to 0*.
- **Granovetter**, "The Strength of Weak Ties" (1973) and "Economic Action and Social Structure: The
  Problem of Embeddedness" (1985) — the strong/weak tie distinction doing the work in the silent-
  strings argument (§1.7, strand 3).
- **Madison, Federalist No. 10** — faction, and the two cures (remove the causes / control the
  effects). Her whole constructive position is "control the effects," and she reads the
  remove-the-causes option as ending in surveillance or totalitarian uniformity (p.36).
- **Posner & Weyl**, *Radical Markets* (2018) — tacit collusion / common ownership, her analogy for
  "tacit majorities" (p.32 n.78).

### 5.4 *Plurality* (Weyl & Tang) and the plural-identity implementations
## 6. Implications for the aggregator

Written as an argument aimed at us, at full strength. Her critique is close to fatal for the naive
version of this product and I have not softened it. Where I think she is wrong or incomplete I say
so; there are a few such places, and they are where our design should live.

**The one-paragraph version.** Every protocol we aggregate filters *bots*. None filters *puppets*.
Ohlhaver's Idena data shows that a protocol which perfectly solves bots and additionally defeats
account trading still collapsed into oligopoly within three years, because paying humans to prove
they are human creates an arbitrage that resourceful operators will always harvest. An aggregator
does not fix this. By making credentials more liquid, more valuable and cheaper to acquire in
bundles, an aggregator **raises the return to puppeteering** and lowers its unit cost. The naive
product — sum up credentials, return a humanity score — is not merely useless against her attack,
it is an accelerant. There is exactly one defensible position available to us, and it is not
"we detect fraud better." It is: **we are the only layer in the stack that can see correlation
across trust roots, and correlation is the quantity that actually matters.** Everything below
argues that.

### 6.1 De facto sybils: can an aggregator detect puppeteering that no single protocol can?

This is the question on which our reason to exist turns, so it deserves the most honest answer I
can give. **Partially yes — and not in the way that would save the naive product.**

**The case for.** An aggregator occupies a genuinely privileged vantage point. A single protocol
sees only its own graph; we see the same human across many. Four signals are available to us and to
nobody else:

1. **Cross-protocol co-enrollment cohorts.** A set of identities that all verified on protocol A in
   one window, then on protocol B in another window, in the same order, is a batch-onboarding
   signature. No single protocol can see the second leg.
2. **Common funding ancestry.** Gas funding source is the strongest and cheapest clustering signal
   in crypto forensics, and it is inherently cross-protocol. Idena's analysis was exactly this:
   funds converging on one wallet, then to an exchange.
3. **Temporal co-movement in credential lifecycle events** — renewal, revocation, re-attestation
   clustering in time within a cohort. This is a direct transplant of her top-31-pools criterion:
   *"the unlikely coincidence of simultaneous or sequential transactions from different accounts in
   the same pool"* (§1.8).
4. **Our own query telemetry** — which relying apps ask about which identities, from where, when.

And there is real precedent that the signature generalises. The *same* co-movement pattern has now
been found independently three times, on three chains, against three different attacks: Ohlhaver on
Idena pools (2024); Gitcoin's COCM catching the "Crypto Babes Club" — identical donation amounts,
near-simultaneous wallet creation, single-project focus (§2.4); and Circles, whose own public
indexer exposes event namespaces literally named `BotCreated` and `FarmGrown`, with one inviter
behind **27.5% of recent at-scale registrations laundered through 1,687 proxy bots**. That last
case is instructive twice over — it shows the pattern is real, and it shows the adversary already
laundering through proxies to break it.

**The case against — and it is stronger.** Four objections, in ascending order of severity.

**(a) The undecidability is structural, and she proved it herself.** §1.5 is the whole problem:
*"the same transaction pattern … were consistent with puppeteering and voluntary cooperation. Both
extremes differed not in their coordination on-chain, but in the distribution of information and
control—or power— off-chain."* On-chain co-movement is evidence of **coordination**, never of
**exploitation**. To close that gap Ohlhaver needed Telegram DMs, operator confessions, jurisdiction
priors and forum archaeology — a hand-audited forensic exercise on 31 pools, which she explicitly
declines to generalise and invites others to complete. **None of that is available at API latency,
and none of it is automatable.** Any claim that we "detect puppeteering" is a claim to have solved
a problem she deliberately did not claim to have solved.

**(b) The base-rate and false-positive problem is disqualifying for exclusion, and it is not
politically neutral.** This is the objection I would put in front of anyone who wants to ship a
puppet detector. The populations that trip a co-movement detector hardest are the ones that are
*legitimately* correlated: users onboarded in cohorts by an NGO or a community organiser; users of a
single custodial wallet or regional exchange; users funded from one faucet; users in one country,
one language, one time zone. Those are precisely the people for whom the credential is worth most —
aid, UBI, financial access. A detector built on correlation will red-line Nairobi and Jakarta and
wave through Palo Alto, **not because it is badly tuned but because the signal it consumes is
poverty-correlated coordination**. Note that Ohlhaver's own strand 2 — weak-rule-of-law jurisdictions
as evidence of puppeteering — is defensible as one input to a scholarly judgement about three named
pools and utterly indefensible as a production feature, where it is nationality-based
discrimination with a scoring API in front of it. Excluding real humans from money is a serious
harm, it is irreversible from the user's side, and it will land on the global poor. We should treat
any *exclusionary* use of correlation signals as out of scope.

**(c) Adversarial half-life.** She flags this herself (p.19 n.44): Idena's operators did not obfuscate
because there was no penalty for being caught, and she expects that *"there will be a cost to
getting 'caught' as a puppeteer, and the resulting strategies will incur obfuscation costs that are
less than the expected value of avoiding detection."* Circles' 1,687 proxy bots are that prediction
already coming true. Fresh wallet per credential, staggered timing and hop-laundering defeat
signals 1-3 above at trivial cost. A detector whose evasion costs less than the credential is worth
does not survive contact.

**(d) Our own privacy commitments destroy the signal.** This is the cleanest finding in this
section and it deserves to be stated plainly: **app-scoped nullifiers and unlinkability — the
privacy properties we should want from every protocol we integrate — are precisely the properties
that make cross-protocol correlation impossible.** World ID's app-scoped nullifiers exist to stop
exactly the linking we would need. We cannot simultaneously market "we never link your identities
across apps" and "we detect cross-protocol puppet cohorts." One of those two claims has to go, and
we should decide which deliberately rather than discover the contradiction in an audit.

**Verdict.** We can build a *correlated-cohort detector*. We cannot build a *puppet detector*, and
we should never claim to. But — and this is the move that rescues the whole thing — **we do not
need one.** DeSoc §4.5 already dissolved the problem: *"such a vote is more likely to be a group of
Souls who are making the same error in judgment or who share the same bias, and so should reasonably
be weighted less."* Fraud and shared bias get the same treatment because they do the same damage.
The correct output of a correlation signal is a **graded discount**, not a **binary exclusion** —
and a graded discount is robust to exactly the false-positive problem in (b), because a legitimately
correlated cohort *should* also count for somewhat less than the same number of independent people,
and because being discounted is a recoverable state whereas being denied is not. The Appendix A
bounded-loss result (§2.3) is the formal version: pairwise correlation discounting bounds attacker
gain at `M·(N²−N)` **without ever requiring you to correctly identify who is colluding.** That is
the single most important technical fact in this document for our design.

So: an aggregator *does* have a genuine reason to exist under her critique — but the reason is
measurement of correlation, not detection of fraud, and the output is a weight, not a verdict.

### 6.2 Economies of scale: does an aggregator reduce this or amplify it?

**It amplifies it. This is the sharpest critique of our thesis and I am not going to soften it.**

Her takeaway 3 is general and it is not about verification methods: *every* global protocol paying
humans to differentiate themselves from bots creates an incentive for resourceful actors to
intermediate less-resourceful humans, "just because participants don't have to run a node or do
periodic cognitive tests doesn't mean that they don't have hassles they just have a different set of
hassles which intermediaries will be happy to perform." The intermediary's product is **hassle
absorption**. Now read our own pitch back: *one API, one embedded flow, routes a user across many
personhood protocols.* **We are selling hassle absorption across personhood protocols. That is the
puppeteer's business model with a developer-facing SDK.**

Four mechanisms by which we make it worse:

1. **We raise the value of the asset.** A credential accepted in one place is worth less than the
   same credential accepted everywhere through one integration. Aggregation is an acceptance-surface
   multiplier, and the return to puppeteering scales with acceptance surface. Ohlhaver measured the
   arbitrage at **2x–55x** local wages at Idena's trivial $2–$14 per epoch. The 2026 numbers are
   worse, not better: World ID Orb-verified accounts trade openly at **$0.50–$15** (ZachXBT,
   2026-04-28), and a Circles sybil costs about **two days of freely minted currency** —
   `Hub.sol` sets `INVITATION_COST = 96 CRC` against `WELCOME_BONUS = 48 CRC` at 24 CRC/day
   issuance. Different verification methods; identical collapse. Her generalisation has now been
   confirmed outside Idena, which is the thing a good theory is supposed to do.
2. **We industrialise multi-protocol farming.** Today an operator farming World ID *and* Circles
   *and* Passport integrates three stacks, three SDKs, three flows. We hand them one. **Our
   onboarding funnel, read adversarially, is a puppet-enrollment funnel with better UX** — and it is
   better UX *for the operator*, who is the high-information party, more than for the puppet, who is
   the low-information one. Every integration we add makes the marginal farm cheaper.
3. **We are structurally Idena's delegation.** This analogy is exact and it should worry us. Idena's
   delegation was a *transparency* improvement, motivated by good intentions, that simultaneously
   moved the fixed cost outside the per-account multiplier — `P = a(c+m−t) − n` instead of
   `P = a(c+m−t−n)` (§1.6) — and thereby made pooling strictly cheaper than being a solo account.
   Concentration accelerated: solo accounts 62%→27%, large pools 22%→61%. An aggregator does the
   identical thing at ecosystem scale: the per-protocol integration cost moves outside the per-user
   multiplier. **The fix that made it worse is the product we are proposing to build.**
4. **We make credentials liquid.** A heterogeneous pile of credentials is not fungible; a normalised
   score is. Liquidity is the property a farming operation most needs and least has today.

**The one honest counter-argument** — and it is the only one — is that an aggregator which
**discounts correlated evidence** destroys the return to farming *multiple credentials that share a
trust root*. This is not speculative: roughly **40 rostered protocols collapse to about 6 distinct
trust roots**. Under additive scoring, an operator who buys one passport-derived credential can
convert it into five and quintuple the score. Under root-deduplicated scoring they get one, and the
other four are free to no one. That genuinely removes an arbitrage that exists today and that every
current aggregator leaves on the table — note that Gitcoin Passport's own deduplication
documentation pushes cross-provider collision resolution *onto the aggregator*, i.e. this is a
known-unowned problem sitting in our lane.

**Therefore: the scoring rule is not an implementation detail. It determines which side we are on.**
Ship additive scoring and we are, unambiguously, an amplifier of exactly the dynamic she documents.
Ship correlation-discounted scoring and we are a partial defence. There is no neutral option, and
"we'll add correlation handling in v2" is a decision to launch as the weapon.

A sobering commercial note alongside this. Human Passport reached **~2M users and 35M credentials on
under $1M of revenue and sold for ~$10M**. That is the market's revealed valuation of doing the
naive version competently at scale. The naive product is not just intellectually weak; it is not
obviously a business. If we are going to do this, the correlation layer is also the only part with
pricing power, because it is the only part nobody else owns.

### 6.3 Collusion resistance and sybil resistance are the same problem — what that does to a scoring API

Her claim (§1.9d): *"de facto sybil resistance is a mutually-implicated (or mirror) challenge to
'collusion-resistance:' neither can be solved independently but both must be tackled
simultaneously."* If that is right — and the Miller/Weyl/Erichsen formulation in §5.3 makes it
close to definitional — then it has a hard architectural consequence that we should confront now
rather than after we have an API in the wild.

**Collusion is a property of a set. A per-identity score is therefore ill-typed.** There is no
function of one identity alone that can answer "is this participant independent?", because
independence is *relative to the other participants in the same decision*. The same human is
maximally independent in a global population and perfectly redundant in a room full of their own
colleagues. Her p.10 n.29 says exactly this about agency: *"A person's agency is not either-or, but
context-specific. A person can be an 'agent' in local contexts … and yet be a 'de facto sybil' … in
more socially distant … contexts."*

This kills `GET /score/{address}` as the primary abstraction. Concretely:

- **The unit of analysis must be the cohort, not the user.** The natural API is closer to
  *"here is the set of participants in this airdrop/vote/round — return weights"* than to a credit
  score. That is precisely the shape Gitcoin's COCM round computation takes, and COCM is the only
  correlation-discounting system with real production history.
- **Scores are not cacheable, portable, or tokenisable.** A number that depends on the cohort cannot
  be stamped into an NFT or an attestation and carried around. Anyone who wants that has
  misunderstood the problem. (Expect this to be the single most requested feature and the one we
  should most firmly refuse in its naive form.)
- **We need the cohort, and only the app has it.** This is an awkward but clarifying business fact:
  the relying app knows who its other participants are; we know the credential structure. Neither
  side can compute the discount alone. That argues for either cohort submission or a privacy-
  preserving two-party computation, and it means our product is a *joint* computation with the
  customer, not a lookup.
- **A per-user score can still exist, but only as an honest sub-object**: "how much independent
  evidence backs this identity" (a genuine per-user quantity — see §6.4) is separable from "how much
  should this identity count in *this* decision" (irreducibly cohort-relative). Conflating those two
  into one number is the original sin, and it is what every existing product in this space does.

### 6.4 Informational uniqueness vs biological uniqueness — is our README asking the wrong question?

Her position (p.30, and the Intro): the real problem is faction — *"establishing the informational
uniqueness of participants—or the extent to which they cluster with the same interests and
biases"* — and *"this is an informational problem not a technical problem and in fact a social
one."* Our README frames the product as **"is this a unique human?"**

**Verdict: the README's question is well-posed, answerable, and mostly worthless on its own. It is
not the wrong question so much as a small subordinate part of the right one.** Two reasons to
resist adopting her framing wholesale, and then the part where she is right.

Where she overstates: (i) biological uniqueness is a genuine *floor*. If you cannot filter bots at
all, the informational question never arises, and in a world of cheap generative agents that floor
is doing more work every year, not less. (ii) "It's a social problem, not a technical one" is true
and also the kind of true that ends research programmes; the interesting question is which
technical measurements make the social problem more tractable, and she gestures at rather than
answers this. (iii) Her framing has an uncomfortable implication she never confronts: if sybil-ness
is measured by how few independent groups you belong to (§5.3), then a devout member of a single
tight community is *legitimately less than one person*. That is a real normative cost and it should
be argued for, not assumed.

Where she is right, and it bites: **the quantity our customers actually need is not uniqueness, it
is independence**, and uniqueness is a bad proxy for it. A thousand verified-unique humans under one
operator are one agent for every purpose a customer cares about — governance capture, airdrop
farming, review manipulation, UBI drain. Selling "1,000 unique humans" when the customer needs
"1,000 independent decisions" is selling the wrong quantity, and the gap between them is the entire
Idena result.

**What would a score that measured independence look like, and is it buildable?** Partially — and
the honest split matters:

*Buildable now, cheap, defensible:*
- **Trust-root diversity.** Not "how many credentials" but "how many *distinct trust roots*." With
  ~40 protocols reducing to ~6 roots, this is a real, computable, honest number, and it is the
  single highest-value thing we can ship. It converts the overlap problem from a caveat into the
  product.
- **Evidence-type diversity** across the BRIEF's categories — uniqueness / liveness / social-trust /
  state-identity / behavioural. Five weak credentials of one kind is a different epistemic object
  from three of different kinds.
- **Acquisition-cohort dispersion** — issuance-time bucketing, issuer diversity, funding ancestry
  dispersion. Computable from data we will already hold, with the §6.1(b) caveat that it must
  discount, never exclude.

*Not buildable, and we should say so:*
- Genuine **social**-affiliation independence — the Simmel/Granovetter quantity she and DeSoc
  actually mean — requires the social graph and group memberships. We will not have that data, and
  the version of us that does have it is a surveillance product. Her own paper is explicit that the
  cure must not be surveillance (p.33). **We should not pretend that trust-root diversity is social
  independence.** It is a proxy for one narrow slice: independence of *evidence*, not independence
  of *interest*.

**Concrete recommendation:** stop saying "is this a unique human?" and start saying **"how much
independent evidence supports the claim that this is a distinct person, and how correlated is this
identity with the others in your cohort?"** That is honest, it is differentiated, it is what the
overlap problem forces us to compute anyway, and — unlike a humanity score — it degrades gracefully
when it is wrong.

### 6.5 Her constructive direction: individuals as composed of groups — what that means for our data model

Her answer in the ETHBerlin Q&A, and the closing of the paper: *"just as you can represent groups as
composed of individuals you can represent individuals as composed of groups"*; the sovereign
individual "always loses against a nation state, always loses against big Tech"; power is
decentralised by forming coalitions, not by atomising. Formally (p.37): *"When identity is expressed
as a dynamic constellation of memberships to groups, participants reveal different, partial aspects
of their identity in communication."*

Translated into our stack, this is a concrete and, I think, correct instruction: **the aggregate
assertion should carry structure, not collapse to a scalar.** Sketch:

- **Replace the score with a typed assertion object.** Minimum viable structure:
  - `credentials[]` — each with issuer, category, issuance time, expiry/revocation state;
  - `trust_roots[]` — the *deduplicated* roots those credentials reduce to, with the mapping shown;
  - `independent_evidence_count` — cardinality of `trust_roots`, the headline number, replacing
    "score";
  - `cohort_markers` — coarse, privacy-budgeted bucket identifiers (issuance epoch, issuer,
    attestation batch) sufficient to compute correlation *between* identities without revealing
    anything about one identity;
  - `confidence` / `staleness` per credential.
- **Add a cohort endpoint** that takes a set of identities and returns pairwise correlation and
  derived weights, per §6.3. This is the actual product; the per-identity object is the input to it.
- **Return provenance, let the app own the policy.** Shipping the structure rather than a verdict is
  more honest, more defensible legally, keeps the risk decision with the party that understands
  their own threat model, and — commercially — makes us infrastructure rather than an oracle whose
  single number everyone will argue with.
- **Affiliations, if we ever carry them, must be consented and app-scoped.** DeSoc's unsolved
  problem was that publicly legible affiliations are a targeting list (§2.4). We should treat any
  affiliation data as high-toxicity: derive correlation from it, never expose it.

The honest framing of this pivot: **we sell the correlation structure, not the score.** That is the
only version of this product that survives her critique, and it happens to be the only part that
nobody else in the roster owns.

### 6.6 Off-chain migration: what is our analogue?

Her final technical point (§1.10): hardening on-chain vote-buying with receipt-freeness, proofs of
complete knowledge and TEEs does not eliminate the demand, it relocates it into meatspace — and may
make it *cheaper*, because the adjacent channel was never priced. Idena killed account trading and
got puppeteering. **The general law: raising the cost of one channel subsidises the next-cheapest
channel, and the next-cheapest channel is usually less observable.** Our analogues, in the order I
expect them:

1. **Credential forgery → human recruitment.** Already complete. Nobody needs to break an Orb; they
   pay someone to stand in front of one. Every protocol on our roster is currently defeated by a
   willing human, and *the operative question across the whole roster is not "can this be forged"
   but "can this be sold or rented"* — iris scans, palm scans, passports and social handles all fail
   that test, because the human stays willing.
2. **Wallet-level correlation → wallet hygiene.** The moment funding-ancestry clustering has
   consequences, farms use fresh funding paths per identity. Cost: near zero. Our best cross-protocol
   signal has the shortest half-life.
3. **Farms → "assisted onboarding" businesses.** This is the one I would flag hardest, because
   **it defeats Ohlhaver's own test.** Her silent-strings argument infers exploitation from the
   *absence* of marketing, disputes and complaints (§1.7). A professionalised intermediary — an
   onboarding vendor, a custodial wallet, a regional agent network — will have a website, terms of
   service, a support queue and a dispute log. It will pass the silence test perfectly while
   performing the identical function. **Her test detects amateur puppeteering; it is blind to
   institutionalised puppeteering, which is the form the industry is evolving toward.** We should not
   adopt her heuristic as a control.
4. **Gaming the score → capturing the scorer.** If we succeed at being the routing layer, the
   cheapest attack stops being "farm credentials" and becomes "become a large integrator and
   negotiate scoring treatment," or "acquire a trust root." This is her §1.9(c) Hobson's-choice
   dynamic pointed at us: the more essential we become, the more the rational move is to capture us
   rather than to defeat us, and the less any customer can afford to walk away. An aggregator that
   works is a single point worth capturing — which is an argument for making our scoring rules
   public, versioned, and independently reproducible from public data, so that capture is at least
   visible.
5. **Credential layer → social layer.** Any friction we add pushes the coordination we care about
   into channels we cannot see. That is not a reason to add no friction. It is a reason to be honest
   that our measurements have a ceiling, and to prefer mechanisms that are robust to being evaded
   (graded discounts, bounded loss) over mechanisms that depend on catching people (detection,
   exclusion).
## 7. Open questions for us

Ordered by how much they should change what we build.

1. **Do we ship correlation-discounted scoring in v1, or additive scoring?** §6.2 argues there is no
   neutral option and that additive scoring makes us an amplifier of the exact dynamic Ohlhaver
   documents. This is a founding decision, not a roadmap item. If the answer is "additive for now,"
   we should at least write down that we know what we are doing.
2. **Is the primary abstraction the identity or the cohort?** §6.3 argues a per-identity score is
   ill-typed for the quantity customers need. But cohort-relative scoring is harder to sell, harder
   to cache, impossible to tokenise, and requires the customer to hand us their participant set.
   Is there a customer who will actually buy that? **This is the biggest open commercial question in
   the document** — the intellectually correct architecture may have no market, and I have not
   established that it does.
3. **Do we resolve the privacy/detection contradiction in favour of privacy or detection?**
   (§6.1(d)). App-scoped nullifiers and unlinkability are exactly what defeats cross-protocol
   correlation. We cannot market both. Which?
4. **Can trust-root deduplication be done well enough to be the headline product?** ~40 protocols →
   ~6 roots is the claim. How stable is that mapping, who maintains it, what happens when a protocol
   changes its root, and can we compute it without the vendors' cooperation? If this is solid it is
   our best asset; if it is mushy, §6.4's recommendation collapses.
5. **What is our policy on exclusion?** §6.1(b) argues correlation signals must discount and never
   deny, because false positives concentrate on the global poor and denial is an irreversible harm.
   Do we commit to that publicly? Do we let customers override it? (They will want to.)
6. **How do we avoid being Idena's delegation?** Is there a version of "reduce hassle for users"
   that does not simultaneously reduce hassle for operators farming those users? I could not
   construct one. If nobody can, that is a finding worth stating in the README rather than hiding.
7. **What is the aggregate assertion's ground truth, and can we ever measure our own error rate?**
   We have no labelled set of puppets. Idena's labels came from confessions. Without ground truth we
   cannot report precision/recall, which means every quality claim we make is unfalsifiable. What
   would a credible evaluation even look like?
8. **Does the "independence" framing survive contact with a customer?** §6.4 recommends replacing
   "is this a unique human?" with an evidence-diversity claim. That is more honest and less
   sellable. Test it on a real buyer before committing the README to it.
9. **UNRESOLVED: is sublinear staking a mechanism we should borrow?** See §3 — whether the promised
   paper exists determines whether there is anything here to borrow at all.

## 8. Quotable lines (with locators)

Paper citations preferred throughout; the ETHBerlin transcript is machine-generated ASR and must not
be quoted verbatim in anything public without checking the audio. Page numbers refer to the Ash
Center PDF of *Compressed to 0*
(https://ash.harvard.edu/wp-content/uploads/2024/06/proof-of-personhood_ohlhaver.pdf).

1. **The thesis.** *"Achieving de jure sybil-resistance (filtering humans from bots) revealed a
   deeper challenge of de-facto sybil resistance (filtering humans acting like bots), which could
   not coherently or computationally be disentangled from the problem of collusion-resistance."*
   — *Compressed to 0*, Abstract, p.1.
2. **Why a boolean credential is the wrong object.** *"Proof of Personhood is reductive, compressing
   identity into a standardized binary ('verified' or 'not verified') and overlooking the social and
   economic ties from talking and trading that differentiate people."* — ibid., §V.A, p.27.
3. **Why a global scalar score cannot be right.** *"A person's agency is not either-or, but
   context-specific. A person can be an 'agent' in local contexts with relatively high information
   and control … and yet be a 'de facto sybil' (acting like a bot) in more socially distant … and
   even nested contexts."* — ibid., p.10 n.29.
4. **The undecidability at the heart of any detector.** *"Theoretically, the same transaction pattern
   of blocks of one-way transfers at the same time to the same wallet were consistent with
   puppeteering and voluntary cooperation. Both extremes differed not in their coordination on-chain,
   but in the distribution of information and control—or power— off-chain."* — ibid., §III.B, p.12.
5. **The economies-of-scale result, stated as a general law.** *"By giving humans economic incentives
   to periodically differentiate themselves from bots—even as low as $2 to $14 every few weeks—the
   protocol gave more informed, resourceful humans financial incentives to puppeteer less informed
   humans like bots."* — ibid., Abstract, p.1.
6. **The concentration finding.** *"by May 2022, 23 entities constituting less than 0.6% of the
   network's distinct entities controlled at least ~40% of accounts and the distribution of almost
   half (~48%) the network rewards. More striking, 3 entities controlled ~19% accounts and ~24%
   rewards."* — ibid., Abstract, p.1.
7. **Why a credential market is not the worst sign.** *"illicit account trading in protocols should
   not be treated as evidence of advanced mechanisms or protections; to the contrary, illicit trading
   may signal a lack of them and be a precursor to puppeteering."* — ibid., §V.A, pp.28-29.
8. **The specification for a different product.** *"if the goal is to filter 'fake' from 'authentic'
   accounts, the threshold for 'fake' moves from attestations from a verification method (whether
   biometric, cognitive, or otherwise) to a constellation of uncorrelated attestations from
   participants who are unlikely to be talking to each other."* — ibid., p.34 n.87.
9. **Sybil resistance ≡ collusion resistance.** *"de facto sybil resistance is a mutually-implicated
   (or mirror) challenge to 'collusion-resistance:' neither can be solved independently but both
   must be tackled simultaneously."* — ibid., §V.C, p.33.
10. **Why crypto alone does not fix it.** *"a Proof of Complete Knowledge may establish that someone
    has direct access to a private key, but doesn't guarantee that the intended or designated
    participant does."* — ibid., §V.D, p.35.
11. **Off-chain migration.** *"Thwarting on-chain vote-buying doesn't solve for off-chain vote-buying
    into 'meatspace,' and may encourage it as a low-cost alternative."* — ibid., §V.D, p.36.
12. **The constructive alternative.** *"Within the pursuit of egalitarianism, the choice is two-fold:
    level the playing field, or expand it. … whereas a single identity game has inevitable economies
    of scale towards one global oligopoly, a plurality of games open the possibility space for a
    normal (Gaussian) distribution of power, achieved through diversity, not brute-forced
    equality."* — ibid., §VI Conclusion, p.37.
13. **The design principle for our scoring rule** (and the reason we need no puppet detector).
    *"A vote supported by many Souls who all share the same SBT(s) is more likely to be a Sybil
    attack and—even if not a Sybil attack—such a vote is more likely to be a group of Souls who are
    making the same error in judgment or who share the same bias, and so should reasonably be
    weighted less than a vote with the same numerical level of support but from a more diverse base
    of participants."* — *Decentralized Society*, §4.5, p.7
    (https://www.radicalxchange.org/updates/papers/desoc.pdf).
14. **Why existing decentralization metrics fail.** *"even if addresses could be traced back to unique
    individuals, those individuals could be socially correlated groups prone to accidental
    coordination (at best) or intentional collusion (at worst)."* — ibid., §4.6, p.8.
15. **Making a credential unsellable.** *"because a Seller would need to prove selling the recovery
    relationships, any attempt to sell a Soul lacks credibility."* — ibid., §4.3.
16. **Sybil-ness as a continuum** (Miller, Weyl & Erichsen, quoted approvingly by her at p.33 n.82).
    *"What makes Sybil agents Sybils is that the will of one entity centrally coordinates them. They
    should be recognized as precisely the same because they all listen to that same entity and that
    entity alone."* — "Beyond Collusion Resistance," https://ssrn.com/abstract=4311507.

*From the ETHBerlin Q&A — paraphrase only, ASR unreliable, do not quote verbatim publicly:* her
answer on what to do instead is that you can think of a person as the sum of their affiliations and
conversations, that identity is the output of a networked social process, and that just as groups are
composed of individuals, individuals can be represented as composed of groups — with the political
point that the sovereign individual always loses to the nation state and to big tech, and that power
is decentralised by forming coalitions. Transcript lines 302-315 of
`research/references/ohlhaver-ethberlin-2024-transcript.md`. **If we want this in a public document,
someone must check the audio at https://www.youtube.com/watch?v=-mwUQp2qwjk (27:02).**

## 9. References
