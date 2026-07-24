# Puja Ohlhaver — corpus and intellectual lineage

> STATUS: in progress — research underway 2026-07-24

**Purpose:** absorb Ohlhaver's critique of proof-of-personhood into the aggregator's design
thinking. Not a protocol write-up. Citation / date-stamping / honesty rules from
`research/BRIEF.md` apply.

**Compiled:** 2026-07-24

## 0. Who she is / affiliations

TODO

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
## 3. Between Zero and One — sublinear identity staking
## 4. Later work: social identity / plural identity (2024-2026)
## 5. Surrounding lineage
## 6. Implications for the aggregator
## 7. Open questions for us
## 8. Quotable lines (with locators)
## 9. References
