# Sybil incidents & antipatterns — the empirical record

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
| **Optimism airdrop #1** | 2022-05 | **17,000 addresses removed**, **>14,000,000 OP recovered** | Post-hoc clustering after the drop was announced | Recovered OP **redistributed proportionally** to legitimate airdrop-1 recipients |
| **Arbitrum** | 2023-03 | **148,595 sybil addresses received the airdrop — ~253M ARB, 21.8% of tokens dropped** (X-explore, post-hoc) | Foundation open-sourced its heuristics (`ArbitrumFoundation/sybil-detection`): transaction graph + funder/sweep graph, **Louvain community detection**, clusters >20 addresses, exchange/bridge/contract filtering using Nansen + Hop + Offchain Labs lists | Some exclusion pre-drop; **the 21.8% is what got through**. Large dispute over false positives |
| **Aptos** | 2022-10 | Widely-reported mass farming of testnet/NFT criteria | X-explore on-chain analysis | Little clawback; farmers profited. `UNVERIFIED:` no primary figure located |
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

### 1.6 Arbitrum — the number that should actually scare us

Every other figure in this section is *how many sybils were caught*. Arbitrum's is **how many got
through after a serious, well-funded, open-sourced detection effort**: X-explore's post-hoc
analysis found **148,595 sybil addresses that successfully received the airdrop, taking ~253M ARB —
21.8% of all tokens distributed**
([X-explore analysis](https://paragraph.com/@x-explore/LkyJPs8v4QkRWxZAx2gc); summarised in
[Beosin](https://beosin.com/resources/a-closer-look-at-the-anti-sybil-mechanism-under-the-arbitrum)).

The Arbitrum Foundation's detection stack was not naive. Per its published repo
(<https://github.com/ArbitrumFoundation/sybil-detection>): two transaction graphs (value transfers,
and a "funder"/"sweep" graph of first-in/last-out transfers), **Louvain community detection** on
strongly/weakly connected subgraphs, a rule flagging clusters of **>20 addresses** moving funds
together, plus entity filtering for bridges, exchanges, contracts and donation addresses using
Nansen, Hop and Offchain Labs label data. It is roughly the state of the art for graph-based sybil
detection, it is open source, and **it still let a fifth of the airdrop go to farms.**

**Take this as the empirical ceiling on graph-based detection under adversarial conditions: on the
order of 80% recall, in the best-resourced public attempt, against 2023-era farms.** Anyone
promising better should be asked to publish their confusion matrix.

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

**Earlier market data (2023).** A black market in Worldcoin credentials appeared on Chinese
platforms including Taobao in May 2023, with sellers in Cambodia and Kenya reported as selling iris
scans/accounts for around **$30**, and listings ranging from **~$1.40 for a basic account to ~$70
for a fully verified one**. The buyers were largely in China, where World App was unavailable
([Rest of World, 2023](https://restofworld.org/2023/worldcoin-kenya-suspended-scammers-cash-in/);
[TIME](https://time.com/6300522/worldcoin-sam-altman/)).

**The mitigation World shipped, and why it is weaker than it looks.** World's response to account
trading is **Face Auth / user-presence**: a live selfie taken in World App, matched **on-device**
against the Orb enrolment, so that (in World's framing) "only the person who was verified at the
Orb can access the World ID on the device"
([World Help Center / World ID FAQs](https://world.org/blog/world/world-id-faqs); relying-party
integrations such as [Zoom's deepfake-verification beta, 2026-05](https://www.biometricupdate.com/202605/zoom-opens-beta-for-world-id-deepfake-verification-in-enterprise-meetings)
compare a live video stream against the World ID enrolment plus the on-device Face Auth selfie).

Three problems, and they generalise far beyond World:

1. **It is a product control, not a cryptographic one.** Nothing in the ZK proof asserts presence.
   Per this research set's World ID write-up
   (`/home/hugo/Projects/poh-aggregator/research/protocols/world-id.md`), the presence signal
   surfaces to integrators as a **payload field** (`user_presence_completed` / a
   `require_user_presence` request flag), i.e. **an assertion made by the verifying service about a
   check it performed**, not a proven claim carried in the credential. A verifier who trusts that
   field is trusting World's backend, not a proof. `UNVERIFIED:` I did not independently re-confirm
   the exact field names against `docs.world.org` in this pass — treat the names as from the sibling
   write-up and re-check before writing integration code.
2. **It defeats *resale* but not *rental*.** Face Auth stops Alice from handing Bob a credential and
   walking away. It does not stop Alice from remaining on the payroll, holding the phone in a room
   with 199 other phones, and doing a selfie on demand. That is precisely the Singapore
   configuration — the operators kept the *people*, not just the accounts.
3. **It raises the price of a farmed credential from ~$0.50 to "the cost of a person's minute, on
   call"** — which is the Idena number, $2–$4 per ceremony. That is a real improvement and it is
   nowhere near enough to resist a funded adversary.

### 2.2 Orb operator fraud and the incentive structure underneath it

The operator layer is a separate failure surface from the biometric:

- Orb operators were paid on **earn-as-you-scan contracts** — compensation tied to signup volume —
  and recruited sub-operators on campuses; MIT Technology Review's investigation documented
  "egregious manipulation and exploitation," operators given minimal information about what they
  were collecting, and frequent Orb/app malfunction
  ([MIT Tech Review, 2022-04-06](https://www.technologyreview.com/2022/04/06/1048981/worldcoin-cryptocurrency-biometrics-web3/)).
  A Ugandan operator's per-signup bonus structure was reported by
  [CNBC, 2023-08](https://www.cnbc.com/2023/08/24/worldcoin-rep-in-uganda-earns-bonus-for-each-person-he-signs-up.html).
- **Attackers went after the operators, not the Orbs.** Malware was installed on Orb-operator
  devices to capture login credentials and access operator dashboards; those credentials were
  listed for sale on dark-web markets (reported 2023).
  `UNVERIFIED:` I have not located the original CoinDesk/TechCrunch piece in this pass — search
  "Worldcoin operator credentials dark web 2023" for the primary report.
- Kenya suspended Worldcoin in 2023 after **>350,000** signups, with parliamentarians arguing the
  token grant constituted illegal financial inducement to consent
  ([TechCrunch](https://techcrunch.com/2023/08/03/worldcoin-plans-to-resume-iris-scans-in-kenya)).

**The generalisable point:** in any protocol with a **human issuing agent paid per issuance**, the
agent's incentives are aligned with the farmer's, not the protocol's. The trust root is not the
sensor; it is the operator's employment contract.

### 2.3 Idena — the puppeteering crisis (the most important case in this file)

Full transcript:
`/home/hugo/Projects/poh-aggregator/research/references/ohlhaver-ethberlin-2024-transcript.md`.
Paper: Ohlhaver & Nikulin, *Compressed to Zero: The Silent Strings of Proof of Personhood* (2024).
The transcript is a machine ASR track — cite the paper for anything public.

**Timeline and numbers:**

| Date | Event |
|---|---|
| 2019 | Idena launches. Uniqueness via synchronous **validation ceremonies** (flip tests) — you cannot be in two places at once. |
| ~2020 | On-chain anomaly: rewards from many accounts swept to one address, simultaneously. Implies third-party key access. |
| 2020-12 | A user contacts the team and **admits to running a human farm** — paying low-information humans to perform ceremonies while the operator holds the keys. |
| 2021-03 | Community declines to slash; instead hard-forks in **on-chain delegation**, deliberately legitimising pools to make them *measurable*. |
| 2021→2022-05 | Solo accounts fall **62% → 27%** of the network; large pools rise **22% → 61%**. Large pools capture the largest share of rewards, sell, and depress the price, squeezing solo accounts further. |
| 2022-05 (peak) | **23 entities (<1% of distinct entities) control ≥40% of accounts and ~half of rewards.** |
| — | Of the **top 31 pools ever >100 accounts**, **all 31** showed signs of third-party key access *even after delegation removed the need for it*. Financial ties collapsed the 31 into **23 entities**. |
| after | Idena abandons pure proof-of-personhood for **sublinear identity staking** (paper: *Between Zero and One*). |

**What makes this the decisive case:** Idena had *already solved* the two problems everyone else is
still solving.

- It **solved bot filtering** — flip tests, synchronous, human-generated, adversarially maintained.
- It **solved account trading** — via *identity staking* (the account carries a stake the seller
  would forfeit; conceptually similar to MACI), which is a stronger anti-resale mechanism than
  anything World, Passport or a document-based system has.

And it failed anyway. Because when you close the resale channel, the next-cheapest attack is not
"give up" — it is **rent the human instead of the credential**. Puppeteering. Ohlhaver's phrase:
these are **de facto sybils** — "humans acting like programmable bots."

**Ohlhaver's five takeaways, restated for us:**

1. Paying humans *anything* to periodically distinguish themselves from bots — even **$2–$4 every
   few weeks** — creates a business for better-informed humans to puppeteer worse-informed ones.
2. When participants sell their *time* (not their account), one-person-one-vote silently becomes
   one-token-one-vote.
3. **The economy of scale is universal.** "Just because participants don't have to run a node or do
   periodic cognitive tests doesn't mean they don't have hassles — they just have a *different* set
   of hassles, which intermediaries will happily perform for a fee." Biometric protocols have
   hassles too: getting to an Orb, keeping the app, cashing out.
4. **Account trading is not the disease; it is the *symptom of a system too weak to have reached
   puppeteering yet*.** A protocol with an observable account-trading market has not yet been
   attacked seriously. Conversely, the *absence* of a visible market can mean the attack moved to
   a channel you cannot see.
5. Proof of personhood filters humans from bots; it does **not** filter *biases*, and colluders
   deliberately acquire correlated humans. De-facto-sybil resistance and collusion resistance are
   the same problem and cannot be solved separately.

**And the sixth, which is the load-bearing one for any protocol designer:** Ohlhaver's closing
argument is that **hardening a layer displaces the attack downward, it does not remove it**.
Receipt-freeness and proofs-of-complete-knowledge defeat *on-chain* vote buying — and thereby
*encourage* off-chain vote buying as the cheaper alternative. TEEs push collusion into meatspace.
Identity staking defeated account trading at Idena, and the next-cheapest alternative was buying
participants' time. **Every mitigation in this file should be evaluated by asking "what is the
next-cheapest attack after this works?" rather than "does this work?"**

**One methodological gem worth stealing.** Ohlhaver's argument that third-party key access was
*puppeteering* rather than *consensual custody-as-a-service* rested on an **absence-of-evidence
argument made rigorous**: an accountable principal-agent custody relationship would generate
marketing, customer complaints, and disputes. There were none. She calls it "the silent strings."
Corroborating factors: the three largest pools were in **weak rule-of-law jurisdictions (Russia,
Egypt, Indonesia)**; small **family pools with strong social ties stayed small** while large
weak-tie pools ballooned; and the operators of the top pools (14% of accounts) **confirmed in
conversation** that they paid participants. The published analysis covered only ~5% of pools —
**it excluded 84 pools of 15–100 accounts and 411 family pools under 15 — so the statistics can
only get worse.**

### 2.4 Circles — invitation farming, measured on-chain (2026)

Measured directly on the Circles v2 public indexer by this research set on **2026-07-24**
(see `/home/hugo/Projects/poh-aggregator/research/protocols/circles.md` for the queries):

- The indexer exposes a namespace **`CrcV2_InvitationsAtScale`** whose events are literally named
  **`BotCreated`** and **`FarmGrown`** (plus `InviterQuotaSet`, `InvitesClaimed`,
  `RegisterHuman(human, originInviter, proxyInviter)`). Source:
  <https://github.com/aboutcircles/circles-invitation-at-scale>.
- **`BotCreated`: 5,000 rows.** One maintainer, `0xe4b40c78a4d8449864c8ec89b4500f60e4a0bbb7`, grew a
  farm to `totalNumberOfBots = 5000` on **2026-05-26**.
- **In the last 10,000 at-scale registrations (2026-04-10 → 2026-07-24), a single `originInviter`
  `0xf5ebc3753142f7c0ae381b6b775e819ea7b497d1` accounts for 2,754 — 27.5% — routed through 1,687
  distinct `proxyInviter` bot addresses**, so the direct on-chain `RegisterHuman.inviter` field
  looks diffuse (top *direct* inviter: 47/10,000).
- **~37% of all v2 humans registered in the preceding three months.** Growth is dominated by bulk
  campaigns, not organic invitation.

**Why it is cheap.** From `Hub.sol`: `INVITATION_COST = 96 CRC` burnt by the inviter,
`WELCOME_BONUS = 48 CRC` minted to the invitee, against an issuance rate of **24 CRC/day**. A sybil
therefore costs **about two days of freely-minted currency plus Gnosis gas** — the marginal cost of
an identity is denominated in a currency the attacker mints for free, giving a **~2–4 day doubling
time**.

**Two antipatterns fall straight out of this, and both are ours to inherit:**

- **The naive attribution field is defeated by one hop of indirection.** A verifier reading
  `RegisterHuman.inviter` sees a healthy, diffuse graph. The farm is only visible if you follow
  `originInviter` through the proxy layer. *Any* single-field provenance check on a public graph is
  one indirection away from useless. If we ever attribute a credential to an issuer, referrer or
  cluster by reading one field, assume it has been laundered.
- **Costing an identity in a currency the attacker mints is not a cost.** Sybil cost must be
  denominated in something exogenous to the protocol.

### 2.5 Proof of Humanity (Kleros) — vouching-ring defence, and its limit

PoH's design does anticipate ring attacks: **if a submission is rejected for "Sybil attack" or
"Identity theft," every voucher for that profile is also removed from the registry**, and any
profile can be challenged for 3.5 days with the case escalating to a Kleros juror panel
([Kleros PoH docs](https://docs.kleros.io/products/proof-of-humanity/poh-faq),
[remove & challenge tutorial](https://docs.kleros.io/products/proof-of-humanity/proof-humanity-tutorial-remove-and-challenge)).

This is a genuinely well-designed graph defence — vouching carries **correlated downside**, which is
the right shape. But note precisely what it defends against and what it does not:

- It defends against **one person holding many profiles** (the classic sybil).
- It does **nothing** against the Idena attack: 500 real, photogenic, distinct humans, each
  submitting a truthful profile with a truthful video, each vouched for by a genuine acquaintance,
  every one of whom hands their key to an operator afterwards. No juror can rule against any of
  them, because none of them is lying.
- Its cost model is **deposit + juror attention**, which means the *challenger* must be motivated.
  Enforcement is only as strong as the bounty relative to the effort of watching.

`UNVERIFIED:` I did not find a published post-mortem quantifying how many PoH profiles were
actually removed as sybils or duplicates. That number would be very useful to us. Where to look:
the PoH subgraph's removal-request events, and Kleros's court case archive.

### 2.6 BrightID

`UNVERIFIED:` I did not, in this pass, find a primary, dated post-mortem of a specific BrightID
sybil incident with numbers. The structural criticism is well-known — BrightID's assurance rests on
verification-party attendance and social-graph analysis, so a "seed group" that is itself farmed,
or a set of humans who genuinely meet and then sell access, defeats it by exactly the Idena
mechanism. Treat "BrightID was attacked" as **unproven with numbers** until someone points at data.
Where to look: the BrightID forum/Discord archives, and the Gitcoin FDD analyses which used
BrightID as a stamp.

---

## 3. Human farms and click-farm labour — the floor cost of defeating liveness

This section sets a hard lower bound. **No liveness-based system can cost an attacker more than the
market price of a human's attention, and that market is deep, priced, and about twenty years old.**

### 3.1 The CAPTCHA-solving market — a two-decade price series

The academic baseline is Motoyama et al., *Re: CAPTCHAs — Understanding CAPTCHA-Solving Services in
an Economic Context* (USENIX Security 2010,
[PDF](https://www.cs.uic.edu/~ckanich/papers/motoyama2010recaptchas.pdf)), which measured the retail
rate at roughly **$1–$2 per 1,000 solves** and mapped the labour markets behind it.

Sixteen years later, 2Captcha's public price list (**retrieved 2026-07-24**,
<https://2captcha.com/for-customer>) — a service that states plainly *"100% of captchas are solved
by human workers from around the world"*:

| Task | Price per 1,000 | Per unit |
|---|---|---|
| Normal image captcha | $0.50–$1.00 | $0.0005–$0.001 |
| reCAPTCHA v2 | $1.00–$2.99 | ~$0.001–$0.003 |
| reCAPTCHA v3 | $1.45–$2.99 | ~$0.0015–$0.003 |
| Cloudflare Turnstile | $1.45 | $0.00145 |
| GeeTest | $2.99 | $0.003 |
| FunCaptcha (Arkose) | $1.45–$50.00 | up to $0.05 |
| Audio captcha | $0.50 | $0.0005 |

Two observations that matter more than the numbers:

1. **The price did not rise in sixteen years.** Every generation of CAPTCHA hardening — image →
   reCAPTCHA v2 → invisible v3 → behavioural risk scoring → Turnstile — moved the retail price
   within a single order of magnitude and never out of the sub-cent range. Hardening the *puzzle*
   never touched the *labour supply*, which is the actual bottleneck. This is Ohlhaver's
   displacement argument, observed over two decades in a different domain.
2. **The most expensive item is FunCaptcha/Arkose at up to $0.05.** That is the empirical ceiling
   on "an interactive challenge a human must personally complete." Any protocol whose per-identity
   friction is *a puzzle* is priced at ≤5 cents.

### 3.2 Physical device farms

The physical infrastructure is well-documented by seizures — these are court-adjacent primary facts,
not estimates:

- **Thailand, 2017 (Aranyaprathet).** Thai police and army raided two rented houses and seized
  **474 iPhones and 347,200 SIM cards** (other reporting: ~500k SIMs), plus the control computers.
  Three Chinese nationals were arrested; they said they were paid **150,000 baht/month (~US$4,400)**
  by a company in China. They had located in Thailand specifically because **mobile charges were
  cheaper there** — pure jurisdictional arbitrage on the cost of a phone number.
  ([The Register](https://www.theregister.com/2017/06/14/click_farm/),
  [VOA](https://www.voanews.com/a/thai-police-raid-click-farm-finds-hundreds-of-thousands-of-sim-cards/3898497.html))
- **Thailand, recent.** An FBI/Thai police operation against a scam compound seized **~8,000 mobile
  phones** and froze ~$580M in crypto. `UNVERIFIED:` exact date and operation name not pinned down
  in this pass.
- **Singapore, 2024 (World ID).** **200+ phones** seized — see §2.1. This is the one that is
  directly a personhood-credential farm rather than a click farm.
- **India, 2026-03.** CBI arrested two and searched six locations in Meerut and Noida over a
  **SIM-box-based** cyber-enabled fraud operation
  ([News on AIR, 2026-03-27](https://www.newsonair.gov.in/cbi-conducts-searches-at-six-locations-arrested-two-accused-persons-in-connection-with-sim-box-based-cyber-enabled-fraud-operation)).

**Implication:** phone-number possession, device fingerprint uniqueness, and IP diversity are all
*rentable at industrial scale*, and have been for a decade. A "one phone number, one human"
assumption is refuted by a single 2017 police photograph of 474 iPhones on a rack.

### 3.3 Human-in-the-loop verification and the collapse of "liveness"

This is the most alarming and most current part of the picture, and it is the part that has changed
fastest since 2024. **The attack on document-and-selfie liveness has moved from
*presentation* (hold a photo up to the camera) to *injection* (feed a synthetic video stream
directly into the app, bypassing the camera entirely).**

Vendor threat-intelligence numbers (secondary — these are vendors with a commercial interest in
alarm, so treat the *direction* as solid and the *magnitude* as marketing-adjacent):

- iProov: **+783% injection attacks in 2024**; **native virtual-camera attacks +2,665% YoY**; 2024
  was the year injection attacks overtook presentation attacks as the primary vector; **iOS
  injection attacks +1,151% YoY in H2 2025** (iProov 2026 Threat Intelligence Report).
- Jumio: **+88% YoY in 2025**.
- Sumsub: **deepfakes = 11% of all global fraudulent activity in 2026**, up from 7% in 2024.
- **World Economic Forum, January 2026** — *Unmasking Cybercrime: Strengthening Digital Identity
  Verification against Deepfakes*
  ([PDF](https://reports.weforum.org/docs/WEF_Unmasking_Cybercrime_Strengthening_Digital_Identity_Verification_against_Deepfakes_2026.pdf)).
  This is the best-sourced item in the section: WEF tested **17 face-swapping tools and 8 camera
  injection tools** and found **most were able to bypass standard biometric onboarding checks**.

Pricing, from reporting on the Telegram fraud-as-a-service market
([MIT Technology Review, 2026-04-15](https://www.technologyreview.com/2026/04/15/1135898/cyberscammers-bypassing-bank-telegram/);
[tech-insider survey of 22 KYC-bypass Telegram channels, 2026](https://tech-insider.org/telegram-kyc-bypass-tools-deepfake-liveness-bypass-2026/)):

- An AI-generated face capable of passing KYC: **under $20 and about 30 minutes**.
- Organised groups run **fraud-as-a-service**, renting bypass tooling and charging **per successful
  account opening**.
- Named target SDKs in the reporting include **Onfido, Sumsub, Jumio, Veriff, Persona, Socure,
  FaceTec, iProov** — i.e. the entire commercial liveness vendor set, which is the same set our
  `kyc-liveness-vendors.md` covers.

**The synthesis of §3 — three price tiers for defeating a "human" check:**

| What the check requires | Market price per identity | Source quality |
|---|---|---|
| Solve an interactive puzzle | **$0.0005 – $0.05** | primary (published price list, 2026-07-24) |
| Possess a distinct phone/SIM/IP/device fingerprint | **cents to low dollars**, rented | primary (seizures) |
| Pass a remote document + selfie liveness check | **~$20 one-off** for a synthetic identity; or per-success FaaS pricing | secondary (journalism) + WEF study |
| Be a specific, unique, verified human on call | **$2–$4 per session** (Idena, 2022) / **$0.50–$70** per traded World ID account | primary-ish (paper + police + investigator) |

Note the ordering. **The last row — genuine, unique, live human — is the most expensive thing on
the list, and it is still only single-digit dollars.** That is the ceiling on what *any*
personhood protocol can charge an attacker per identity, because the attacker's alternative is
simply to hire the human.

---

## 4. Attacks on the aggregation layer specifically

This is our product. Everything above is context; this section is the actual threat model.

### 4.1 The Gitcoin/Human Passport record — the only aggregator with a public history

Gitcoin Passport (rebranded **Human Passport**, now part of **human.tech**;
`docs.passport.xyz` and `support.passport.xyz` both 301 to `*.human.tech` as of 2026-07-24) is the
closest existing thing to what we are building: many credentials ("Stamps"), each carrying a
weight, summed into a single **Unique Humanity Score**, compared against a **threshold of 20**
([scoring thresholds docs](https://docs.passport.human.tech/building-with-passport/stamps/major-concepts/scoring-thresholds)).

Hard numbers from the pre-Passport era, when Gitcoin was still doing ML-based post-hoc detection —
BlockScience's **Grants Round 11** anti-fraud evaluation
([blog.block.science](https://blog.block.science/gitcoin-grants-round-11-anti-fraud-evaluation-results/)):

| Metric | GR11 value |
|---|---|
| Contributors flagged as potential sybil | **853 of 15,986 (5.3%)** |
| Statistically estimated true sybil incidence | **6.4% (range 3.6%–9.3%)** |
| "Fraud tax" (matching funds captured by sybils) | **$5,787 = 0.6% of a $965,000 pool** |
| GR10 fraud tax | **$14,400 = 2.1%** |
| GR9 fraud tax | **$33,000 = 6.6%** |
| Estimated detection recall | **~83% (range 57–100%)** |

Note the honesty of that last row and treat it as the standard we should hold ourselves to: a
**recall confidence interval of 57–100%** is what a well-run, ML-assisted, human-in-the-loop sybil
programme could actually claim. BlockScience's own framing — *"while the ML algorithm learns, so do
the attackers"* — is the whole game in one sentence. Gitcoin's post-round guidance still lists the
red flags operators should eyeball manually (donation timing, donation amounts, passport scores,
projects with anomalously many voters, **donors who support exactly one project and nothing else**)
and lets operators zero out a donor's coefficient by hand
([Gitcoin round operations](https://roundoperations.gitcoin.co/round-operations/post-round/sybil-analysis)).

### 4.2 The threshold *is* the attack surface

The docs state the design plainly and, to their credit, state its weakness plainly too:

- The Unique Humanity Scorer *"adds up the weights of each Stamp owned by each user and compares
  the result to a pre-defined threshold value"*, threshold **20** of a maximum 100.
- *"Not all Sybils will be eliminated at that threshold."*
- Higher thresholds (25, 30) are *"more effective"* / *"most effective"* against sybils but carry
  *"medium"* to *"high"* risk of screening out legitimate users.
- The rationale for why higher thresholds work: *"the time, effort and possibly money expended…
  are greater."*

Read that last clause carefully, because it concedes the entire structure of the attack. **The
system is not asking "is this a human?" It is asking "did someone spend more than X?"** Once you
say that out loud, four consequences follow, and all four are visible in the record:

1. **A published threshold plus published weights is a specification for the cheapest passing
   basket.** Passport publishes both the threshold (20) and per-Stamp weights, and re-weights them
   periodically (there was a **Stamp re-weight in January 2026**). A farmer solves a trivial
   knapsack problem: minimise `Σ cost(stamp)` subject to `Σ weight(stamp) ≥ 20`. They will never
   score 55. They will score 20–22, across every wallet, forever.
2. **The distribution of scores becomes bimodal at the threshold, not at "humanness."** `UNVERIFIED:`
   I could not find a published score-distribution histogram showing the spike just above 20 — this
   would be the single most persuasive piece of evidence in this file and I was unable to source it
   in this pass. **Where to look:** Passport's Analytics/scorer API over a large address set, or
   Gitcoin round Vote Coefficients CSVs, which are published per round. **We can generate this
   ourselves once we hold any real score data — do it early, it is the canonical health metric for
   a scoring product.**
3. **The cheapest basket is always the correlated basket.** Stamps that are cheap to farm are cheap
   *for the same reason* — they are web2 accounts, or on-chain activity, or an email. A farmer
   buying "Google + Discord + Twitter + LinkedIn + a funded wallet" buys five stamps and *one*
   underlying capability: the ability to rent identity infrastructure. An additive score treats
   that as five independent pieces of evidence. It is one.
4. **A binary output throws away everything the system knew.** The scorer's job is to return
   sybil/not-sybil, so a 20 and a 95 are the same answer, and the relying party cannot distinguish
   "barely cleared the bar" from "unambiguously a person."

### 4.3 The publish-vs-hide trade-off, observed inside one product

Human Passport contains **both** answers to this question simultaneously, which makes it an
unusually clean natural experiment:

- **Stamps: weights and threshold are public.** Users can see what to get and why. This is
  legible, auditable, appealable — and it is a cost menu for the attacker.
- **Models API: features are secret.** The docs say it outright: *"model features are hidden from
  the public, making it more difficult for Sybils to cheat"*
  ([Models API introduction](https://docs.passport.human.tech/building-with-passport/models/introduction)).
  The Models API scores an EVM address 0–100 purely from on-chain transaction history against
  "dozens of data features," with **`-1` for addresses with insufficient history**, and ships
  per-chain models (Ethereum, Arbitrum, Base, Optimism, Polygon, zkSync, NFT) plus an aggregate
  model.

**Be honest about the cost of the second choice.** A hidden model:

- **cannot be audited, contested, or appealed.** A user told "you are 34/100" has no remedy and no
  explanation. In the EU, an automated decision that gates access to a service with no explanation
  and no human review is squarely in **GDPR Art. 22** territory.
- **cannot be independently validated.** Passport publishes **no false-positive rate and no
  accuracy figure** for the Models API. Compare BlockScience, who published a 57–100% recall
  interval. The secret model is the one making claims we cannot check.
- **is only secret until it is probed.** An adversary with an API key and a budget can query the
  model against wallets they control, do gradient-free search on the input space, and recover a
  usable approximation of the decision boundary. Secrecy buys *time* and raises the *fixed cost* of
  the first attack; it does not change the marginal cost once solved. And it is exactly the funded,
  high-information operator — the one that matters — who can afford that fixed cost.
- **`-1` is a real problem for us.** An address with no history is unscoreable, which means a
  behavioural model is structurally unable to help with the population we most want to serve (new,
  real users) while being most confident about the population that is cheapest to fake (aged,
  active wallets — which are, per §1, a commodity).

**Our position should be: publish the *structure* and the *evidence classes*, publish the
*rationale*, and keep only the *calibration* private and rotating.** Attackers learn the structure
anyway; users, integrators and regulators need it. What genuinely must stay dynamic is the
weighting and the correlation model, and the honest reason is not secrecy — it is that any fixed
weighting is a target, so it must move.

### 4.4 The deduplication problem — the same human, or the same credential, on many addresses

Three distinct failure modes hide under the word "deduplication," and conflating them is an
antipattern in itself:

1. **One credential, many addresses.** If a credential is presented rather than bound (an API says
   "this passport is verified" and we attach it to whatever address asked), then N addresses can
   claim it. **The defence is a nullifier**, and nullifiers must be *per-credential and
   deterministic* for this to work.
2. **One human, many credentials, one address each.** This is the *legitimate-looking* farm. The
   Singapore World ID case is exactly this shape from the operator's side. No nullifier helps: each
   credential is genuinely distinct because each underlying human is genuinely distinct.
3. **App-scoped vs. global nullifiers — an unavoidable conflict with our own product.** A
   *global* nullifier makes cross-application dedup possible and destroys unlinkability. An
   *app-scoped* nullifier preserves privacy and makes cross-app dedup **impossible by
   construction**. An aggregator is, by definition, a cross-app deduplicator. **We cannot offer
   both strong cross-protocol dedup and app-scoped unlinkability.** Any marketing claim that we do
   both is false. Pick, document the choice, and tell integrators what they are buying.

The Circles finding in §2.4 is the cleanest available demonstration that *naive* dedup/attribution
loses: `RegisterHuman.inviter` looked diffuse; `originInviter` showed **27.5% from one entity
behind 1,687 proxies**. One hop of indirection defeated the field a verifier would naturally read.

### 4.5 The cumulative-vs-live illusion

Two measured findings from this research set (2026-07-24) that belong here because they attack the
*denominator* of any aggregate score:

- **Linea PoH V2:** **50,475 lifetime credentials issued** but a hard **90-day expiry**, leaving
  **502 live**. (See the sibling protocol write-ups in `research/protocols/`.)
- **Coinbase Verifications:** **720,503 attestations issued, 406,022 revoked** — **56% churn**.

Both look like large, healthy credential populations in cumulative terms and are nearly empty or
half-dead in live terms. If our aggregator's coverage estimate, or an integrator's expectation of
"how many users can pass," is built on issued counts, it is wrong by one to two orders of
magnitude. **Always compute live, non-revoked, non-expired counts, and show integrators that
number.** Conversely — the freshness policy that produced Linea's 502 is not a bug in the data, it
is a *deliberate* design choice, and it is the correct one for sybil resistance; it just has to be
priced into coverage.

---

## 5. Antipatterns synthesis

Each entry: the mistake, the evidence, the rule.

### A1. Additive scoring over correlated evidence

**Mistake.** Summing weights from credentials that share a trust root, a supplier, or a cost
driver, as if they were independent observations.

**Evidence.** Human Passport sums Stamp weights against a threshold of 20, and its own docs
concede *"not all Sybils will be eliminated at that threshold"* and justify higher thresholds by
the *"time, effort and possibly money expended"*
([scoring thresholds](https://docs.passport.human.tech/building-with-passport/stamps/major-concepts/scoring-thresholds)).
Meanwhile §3 shows that web2 accounts, phone numbers, device fingerprints and IPs are all supplied
by **the same rental market** at cents to dollars. A farmer buying five cheap stamps has purchased
one capability, not five facts.

**Rule.** **Score the maximum over evidence classes, not the sum — and only add across classes you
can argue are causally independent.** Before adding two credentials, answer: *does one supplier
outage, one document, one biometric, one human, or one rented service produce both?* If yes, they
are one piece of evidence. Maintain an explicit **overlap matrix** (BRIEF.md §7 already asks every
protocol write-up for this — it exists precisely to feed this calculation) and cap the contribution
of any correlated group at the strongest single member.

### A2. Treating credential *possession* as evidence of *control*

**Mistake.** Concluding "a unique human is behind this request" from "a unique human's credential
is presented."

**Evidence.** The strongest in the file. Idena: **all 31** pools ever exceeding 100 accounts showed
third-party key access, **even after delegation removed any operational need for it**; 23 entities
held ≥40% of accounts. World ID/Singapore: three men recruited humans to be Orb-verified, then
**took control of the accounts and tokens in exchange for cash**; 200+ phones seized in one raid.
In both cases every credential was genuine, unique and correctly issued.

**Rule.** **A credential proves the issuance event, never the current session.** Design as if every
credential in the system may be operated by someone other than its subject, and put the sybil
resistance somewhere that assumption does not destroy — in the *graph* between credentials, in
*freshness*, and in *behaviour at use time*, not in the credential itself.

### A3. Publishing the weights vs. hiding them — the honest trade-off

**Mistake (either direction, taken purely).**

*Published weights* turn the score into a shopping list: minimise `Σ cost` subject to
`Σ weight ≥ threshold`. Passport publishes the threshold, publishes weights, and re-weights
periodically (a Stamp re-weight shipped in **January 2026**) — the re-weighting cadence is itself
an admission that a static published weighting gets solved.

*Hidden weights* buy real time — Passport's Models API docs say it explicitly: *"model features are
hidden from the public, making it more difficult for Sybils to cheat"* — but at four costs, all of
which we would inherit:
(i) **unfalsifiability** — Passport publishes no accuracy or false-positive figure for the hidden
model, while BlockScience, doing open work, published a **57–100% recall interval**;
(ii) **no appeal path** — a user scored 34/100 with no explanation has no remedy, and under **GDPR
Art. 22** an automated decision gating access to a service needs explanation and human review;
(iii) **it is only secret until probed** — an adversary with an API key and controlled wallets can
map the decision boundary; secrecy raises the *fixed* cost of the first attack, not the *marginal*
cost after, which selectively protects us from small farmers and not from the funded operator who
is the actual threat;
(iv) **obscurity is a liability with integrators**, who must explain to their own users why they
were rejected.

**Rule.** **Publish structure and rationale; keep only calibration private, and rotate it.** State
which evidence classes exist, what each is worth *relative to* the others, why, and what the
overlap assumptions are. Keep the numeric calibration versioned, dated and rotating — and say
publicly that it rotates, because *the honest reason for privacy is not secrecy, it is that any
fixed weighting is a stationary target*. Publish accuracy metrics on a held-out labelled set even
when the weights are private. **If we cannot publish a confusion matrix, we do not have a product,
we have an opinion.**

### A4. Thresholds instead of continuous scores

**Mistake.** Emitting a boolean. It creates a precise, published target; it discards all
information above and below the line; and it silently transfers the risk decision from the relying
party (who knows what is at stake) to us (who do not).

**Evidence.** Passport's Unique Humanity Scorer is explicitly *"binary"*, comparing the weight sum
to a *"pre-defined threshold value"* of 20; the docs then present a threshold-vs-false-positive
trade-off table (20 / 25 / 30 → higher sybil resistance, higher exclusion of real users). That
table is the relying party's decision, being made centrally on their behalf.

**Rule.** **Return a calibrated continuous score plus the evidence vector plus a confidence
interval; let the integrator pick the cut.** Do not ship a single blessed threshold as the default
API response. Where a boolean is unavoidable, ship *several* named policies (`low-friction`,
`balanced`, `high-assurance`) with **published measured base rates for each**, so the integrator
chooses knowingly. And **monitor our own score histogram for a spike just above whatever cut
integrators actually use** — that spike is the signature of A4 being exploited, and is the single
most valuable health metric we can build.

### A5. One-shot verification with no freshness

**Mistake.** Treating a credential issued once as valid indefinitely — or, in the other direction,
shipping an expiry policy without measuring what it does to live coverage.

**Evidence, in both directions.** *Against staleness:* Coinbase Verifications — **720,503
attestations issued, 406,022 revoked (56% churn)**; the cumulative count is 2.3× the live one.
*Against naive freshness:* Linea PoH V2 — **50,475 lifetime credentials, hard 90-day expiry,
502 live**. A freshness policy is a **silent kill switch**: a credential set that looks large
cumulatively and is nearly empty in live terms, with no error raised anywhere.

**Rule.** **Never store or serve a cumulative count. Every population number we publish is live,
non-revoked, non-expired, as of a timestamp.** Re-check revocation and expiry at *query* time, not
at ingest. Expose credential age and last-verification time in the evidence vector so integrators
can apply their own decay. Monitor expiry cliffs per protocol — if a source silently drops from
50,475 to 502, our coverage collapses and nothing will tell us unless we look.

### A6. Assuming a credential expensive to *obtain* is expensive to *rent*

**Mistake.** Pricing sybil resistance by acquisition cost.

**Evidence.** An Orb scan requires physical travel to a device and an iris enrolment — genuinely
expensive to obtain, and the biometric worked. The resulting accounts traded at **$0.50**
(ZachXBT, 2026-04) and at **$1.40–$70** on Chinese platforms in 2023. Idena's flip ceremonies were
expensive in attention and could not be sold at all thanks to identity staking — and the humans
rented themselves for **$2–$4 per ceremony**.

**Rule.** **Price every credential by its rental rate, not its issuance cost** (see §6). If we
cannot estimate a rental rate, we cannot claim a sybil-resistance level; say so explicitly.

### A7. Ignoring that the human may be a puppet

**Mistake.** Ending the threat model at "is there a human." Building for *bot* resistance and
marketing *sybil* resistance.

**Evidence.** The whole of §2.3. Idena solved bots, solved account trading, and still collapsed:
solo accounts **62% → 27%**, large pools **22% → 61%**, terminating at **23 entities holding ≥40%
of accounts and ~half of rewards**. Ohlhaver's term is exactly right: **de facto sybils**.

**Rule.** State in our own documentation, in plain words, that **we do not and cannot detect a
verified human acting under another party's direction**, and that no credential in our set does
either. Then measure what we *can*: concentration. **Publish a concentration metric** — Gini or
top-N share over whatever grouping we can observe (funding source, referrer, issuer, device, IP
ASN, on-chain cluster) — because Idena's crisis only became visible when delegation made pool size
*measurable*. A system that cannot measure concentration cannot notice this failure at all.

### A8. Costing an identity in a currency the attacker mints

**Mistake.** Denominating sybil cost in the protocol's own freely-issued asset.

**Evidence.** Circles: `INVITATION_COST = 96 CRC` against issuance of `24 CRC/day` ⇒ an identity
costs **two days of free money plus gas**, giving a **~2–4 day doubling time**; the indexer's own
events are named `BotCreated` and `FarmGrown`, and one maintainer minted **5,000 bots** on
2026-05-26.

**Rule.** Sybil cost must be **exogenous** — external money, scarce physical presence, or scarce
social attachment. Any cost denominated in the system's own emissions is not a cost.

### A9. Trusting a single attribution field on a public graph

**Mistake.** Reading one field (`inviter`, `issuer`, `referrer`, `source`) and believing it.

**Evidence.** Circles: `RegisterHuman.inviter` looked healthy (top direct inviter 47/10,000) while
`originInviter` showed **2,754/10,000 = 27.5% from a single entity, laundered through 1,687 proxy
addresses**. One hop of indirection defeated the field a verifier would naturally read.

**Rule.** Any provenance signal must be computed **transitively** over the graph, assuming an
indirection layer has already been inserted. If we cannot compute it transitively, we must not use
it as a sybil signal at all — a defeated signal is worse than no signal, because it produces false
confidence.

### A10. Hardening one layer and calling it solved (the displacement antipattern)

**Mistake.** Believing a mitigation *removes* an attack rather than *relocating* it to the
next-cheapest layer. **This is the master pattern; every other entry is a special case.**

**Evidence, from four independent domains:**

- **CAPTCHA, 2010 → 2026.** Image → reCAPTCHA v2 → invisible v3 → behavioural risk → Turnstile.
  Retail human solve price went from **~$1–2 per 1,000** (Motoyama et al., USENIX 2010) to
  **$0.50–$2.99 per 1,000** (2Captcha, retrieved 2026-07-24). Sixteen years of hardening the
  *puzzle* never touched the *labour market*, which was the real bottleneck.
- **Liveness.** Hardening presentation-attack detection pushed attackers *below* the camera:
  iProov reports **injection attacks overtook presentation attacks as the primary vector in 2024**;
  WEF (Jan 2026) tested 17 face-swap and 8 camera-injection tools and found **most bypassed
  standard biometric onboarding checks**.
- **Idena.** Identity staking killed account trading → the next-cheapest attack was **renting the
  human**, at $2–$4 per ceremony.
- **World ID.** Face Auth kills resale → the next-cheapest attack is **keeping the human on call**,
  which is the Singapore configuration precisely.
- **Ohlhaver's own version, and the one to keep:** receipt-freeness and proofs-of-complete-knowledge
  defeat *on-chain* vote buying and thereby **encourage off-chain vote buying as the cheap
  alternative**; TEEs push collusion into meatspace rather than eliminating it. "When on-chain vote
  buying becomes costly, we can expect the resourceful to simply move offchain into meat space."

**Rule.** Evaluate every mitigation by **"what is the next-cheapest attack once this works?"** —
never by "does this work?" Write the displacement target down beside the mitigation in the design
doc. If the next-cheapest attack is *cheaper* than the current one, the mitigation is **negative
value**: it costs us engineering and users, and moves the adversary somewhere we can see less.

### A11. Measuring detections instead of leakage

**Mistake.** Reporting "we caught N sybils" as evidence the system works.

**Evidence.** Arbitrum ran open-source Louvain cluster detection with Nansen labels and
**148,595 sybil addresses still received 21.8% of the tokens**. LayerZero's 803,093 counts the
farms that **either confessed or were detectable** — by construction it excludes the high-opsec
operators. BlockScience were the only ones honest enough to publish a recall *interval*
(**57–100%**), which is both the correct shape and an admission that the true denominator is
unknown.

**Rule.** Detection counts are a **vanity metric**. What matters is **leakage**: the share of value
or access that reached farms. Build our evaluation around a **labelled red-team set we generate
ourselves** — buy credentials on the open market at §3 prices, run them through our own pipeline,
count how many pass — rather than around counts of what we flagged. **A red-team budget of a few
hundred dollars will tell us more about our product than any amount of heuristic engineering.**

---

## 6. The "can it be sold or rented?" test

Stated once: **a credential whose holder can profitably rent it out provides no sybil resistance
against a funded adversary, however good its cryptography.** Sale and rental are different, and
rental is the harder problem — sale is a one-shot transfer that binding, staking or biometric
re-check can block; rental is an ongoing service relationship that none of those touch, because the
legitimate subject is genuinely present every time.

| Credential class | Sellable? | Rentable? | Observed price | Residual sybil resistance |
|---|---|---|---|---|
| **Biometric uniqueness, no presence check** (World ID pre-Face-Auth) | **Yes** — transfer the account | Yes | **$0.50** escrow (2026-04); **$1.40–$70** (2023); ~$30 iris scans in KE/KH | **~zero** |
| **Biometric uniqueness + on-device presence** (World ID + Face Auth) | Mostly **no** — re-check binds subject to device | **Yes** — subject stays on payroll and does the selfie | ≈ Idena's $2–$4/session (not directly observed) | **Low.** Raises unit cost ~4–8×, still single-digit dollars |
| **Cognitive-test uniqueness + identity staking** (Idena) | **No** — genuinely solved | **Yes** — the definitive case | **$2–$4** per ceremony | **~zero at scale.** 23 entities → ≥40% of accounts |
| **Social-graph vouching** (PoH/Kleros, BrightID) | Partly — vouchers are slashed on rejection, a real deterrent | **Yes** — genuine humans, genuine vouches, keys handed over afterwards | Not directly observed | **Low against a patient adversary**; good against casual sybils |
| **Invitation/graph currency** (Circles) | n/a | n/a — **minting is cheaper than renting** | ~2 days of self-minted CRC + gas | **Zero for the binary flag.** Non-zero only for the *max-flow trust metric* |
| **Remote document + selfie KYC** (Onfido/Sumsub/Jumio/Veriff/Persona class) | **Yes** — and increasingly unnecessary | Yes; also **synthesisable** | **<$20** for a KYC-passing synthetic face; FaaS priced per successful account | **Low and falling.** WEF Jan 2026: most tested tools bypass standard checks |
| **State-issued eID / ZK-passport** (eIDAS 2 / EUDI, zk-passport) | **Sale is illegal and traceable** — strongest class | **Yes, but expensively** — the document holder must participate, and impersonation is criminal | fraudulent-ID markets exist but carry legal risk | **Highest available** — and **legal deterrence, not cryptography, does the work** |
| **Web2 account stamps** (Google, Discord, X, LinkedIn) | **Yes** — mature market | Yes | cents to low dollars | **~zero**, and mutually correlated (see A1) |
| **Phone / SIM possession** | **Yes** | Yes | cents; **347,200 SIMs in one Thai house** | **~zero** |
| **On-chain behavioural history / aged wallets** | **Yes** — wallets are an asset class | Yes | $1–$20 per farmed wallet (`UNVERIFIED`) | **~zero against a funded adversary**; also `-1`/unscoreable for real new users |
| **Interactive puzzle / CAPTCHA** | n/a | Yes, industrially | **$0.0005–$0.05** per solve, human-solved | **~zero** |

**Three conclusions, in descending order of how much they should change our behaviour:**

1. **Nothing in the table is rental-resistant.** Every row is rentable. The spread across the whole
   credential set is roughly **$0.001 → ~$20 per identity** — four orders of magnitude, but the top
   of the range is a rounding error against any prize worth farming. **We are not building a system
   that stops a funded adversary. We are building one that prices them.** That claim is defensible
   and true; the stronger claim is not.
2. **Legal deterrence outperforms cryptography.** The only row with meaningfully high residual
   resistance — state eID — gets it from *criminal liability attaching to a named person*, not from
   any protocol property. Worth internalising: our strongest signal is strong for a non-technical
   reason, and will therefore behave differently (jurisdictionally, and under political change)
   from everything else in the vector.
3. **Sale-resistance and rental-resistance must be scored separately.** World ID's Face Auth and
   Idena's identity staking both move a credential from column-1-yes to column-1-no while leaving
   column 2 untouched. A model with one "strength" number cannot represent that, and will
   systematically **overrate exactly the protocols that have done the most visible security work.**
   Our evidence vector needs two axes: `sale_resistance` and `rental_resistance`.

---

## What this means for our design

Concrete, and pessimistic where the evidence warrants it.

**1. Do not sell "sybil resistance." Sell *priced* friction, with the price published.**
The honest product claim is: *"passing our `high-assurance` policy costs an attacker at least $X
per identity, measured, as of date D."* Every number in this file supports that claim and none
supports a stronger one. LayerZero, Chaos Labs and Nansen spent real money and produced 803,093
addresses and no recall figure. Arbitrum open-sourced Louvain clustering and leaked **21.8%**.
BlockScience's honest recall interval was **57–100%**. **If our marketing implies we do better than
those, we are lying.**

**2. Build the aggregate as `max`-with-bounded-addition over independent evidence classes, never a
flat sum.** Define a small number of classes (state-identity, biometric-uniqueness, social-graph,
behavioural, web2-possession); score within class; take the strongest; allow only a capped bonus
for genuinely independent additional classes. Maintain the **overlap matrix** as a first-class
artifact — BRIEF.md already requires every protocol write-up to declare shared trust roots, and
this is what that field is for. **Concretely: World ID, a zk-passport, and a document-based KYC
that all bottom out in the same face and the same passport are one piece of evidence, not three.**

**3. Return a continuous score, an evidence vector, and a confidence interval. Never a lone
boolean.** Ship named policies with published measured base rates. Then **build the score histogram
on day one** and alert on a spike immediately above any commonly used cut. That spike is the
signature of farmers optimising to the threshold; it is the failure we are most likely to suffer;
it is cheap to detect and **impossible to see if we never plot it**.

**4. Every credential in the evidence vector carries two resistance axes — `sale_resistance` and
`rental_resistance` — plus `issued_at`, `expires_at`, `revocation_checked_at`.** Rental resistance
is near-zero for everything in our set (§6); encoding that in the data model prevents us quietly
assuming otherwise in the scoring code.

**5. Live counts only.** Never publish or internally reason from a cumulative issuance figure.
Coinbase: **56% revoked**. Linea PoH V2: **502 live of 50,475 issued**. Check revocation and expiry
at query time. Alert on expiry cliffs.

**6. Compute provenance transitively, or not at all.** The Circles `originInviter` result is the
warning shot: the naive field is one hop from useless. Any clustering, referrer or issuer signal we
ship must be graph-based and must assume an indirection layer is already present.

**7. Denominate cost exogenously.** Never let a credential's sybil cost be paid in a currency the
issuer or the attacker mints (Circles), and never treat *acquisition* cost as *rental* cost
(World ID, Idena).

**8. Concentration is the metric that would have caught Idena. Build it.**
Idena's crisis was invisible until delegation made pool size measurable — and then it was obvious.
Publish, per integrator and globally, a **top-N-entity share and Gini** over every grouping we can
observe: funding source, on-chain cluster, referrer chain, issuer, device, IP ASN, verification
timing. **A cluster of 200 credentials that all pass, all fresh, all correlated in time, is the
Singapore raid visible in advance.** We will never be able to *prove* puppeteering — nobody can —
but we can surface concentration and hand it to the relying party, and that is a differentiated
feature nobody in this space currently ships.

**9. Budget for red-teaming ourselves, and treat it as the primary evaluation.**
§3 is the price list. A few hundred dollars buys CAPTCHA solves, aged wallets, web2 accounts, and
possibly a traded personhood credential. Run them through our own pipeline and **count what
passes**. This measures **leakage**, which is what matters, rather than detections, which are
vanity (A11). It is also the only route to the confusion matrix we owe integrators. Do it **before**
launch and repeat quarterly — the adversary's price list moves.

**10. Write down the displacement target for every defence we ship.**
Beside each mitigation in the design doc: *"once this works, the next-cheapest attack is ___, at
approximately $___."* If that number is lower than the current attack cost, the mitigation is
negative value. This one line of discipline is the entire lesson of Idena, of sixteen years of
CAPTCHA pricing, and of injection attacks overtaking presentation attacks.

**11. Accept the dedup/privacy conflict openly.** An aggregator is by definition a cross-application
deduplicator; app-scoped nullifiers make cross-app dedup impossible by construction. We cannot
offer maximal unlinkability *and* maximal dedup. Choose, document, and tell integrators exactly
which they are buying — the failure mode of not choosing is claiming both and delivering neither.

**12. The thing we most want to detect is the thing we cannot detect.** A verified, unique, live,
fresh human acting under someone else's direction passes every check in our system and every check
in every system in this file. Say so, in our public documentation, in one sentence, without
hedging. It costs nothing, it is true, and every serious integrator already suspects it — the ones
who do not are the ones who will blame us later.

---

## References

**Primary / near-primary**

- Ohlhaver & Nikulin, *Compressed to Zero: The Silent Strings of Proof of Personhood* (2024) —
  local ETHBerlin04 keynote transcript at
  `/home/hugo/Projects/poh-aggregator/research/references/ohlhaver-ethberlin-2024-transcript.md`
  (machine ASR — cite the paper, not the transcript, in anything public).
- Motoyama, Levchenko, Kanich, McCoy, Voelker, Savage, *Re: CAPTCHAs — Understanding
  CAPTCHA-Solving Services in an Economic Context*, USENIX Security 2010 —
  <https://www.cs.uic.edu/~ckanich/papers/motoyama2010recaptchas.pdf>
- World Economic Forum, *Unmasking Cybercrime: Strengthening Digital Identity Verification against
  Deepfakes*, Jan 2026 —
  <https://reports.weforum.org/docs/WEF_Unmasking_Cybercrime_Strengthening_Digital_Identity_Verification_against_Deepfakes_2026.pdf>
- Arbitrum Foundation sybil-detection source — <https://github.com/ArbitrumFoundation/sybil-detection>
- Hop airdrop sybil reports (raw community evidence) —
  <https://github.com/hop-protocol/hop-airdrop/issues/267>,
  <https://github.com/hop-protocol/hop-airdrop/issues/192>,
  <https://github.com/hop-protocol/hop-airdrop/issues/332>
- *Fighting Sybils in Airdrops* — <https://arxiv.org/pdf/2209.04603>
- *Airdrops: Giving Money Away Is Harder Than It Seems* — <https://arxiv.org/abs/2312.02752>
  (nine airdrops; **up to 66%** of recipients sold in their first post-claim transaction)
- BlockScience, *Gitcoin Grants Round 11 Anti-Fraud Evaluation & Results* —
  <https://blog.block.science/gitcoin-grants-round-11-anti-fraud-evaluation-results/>
- Human Passport docs — scoring thresholds:
  <https://docs.passport.human.tech/building-with-passport/stamps/major-concepts/scoring-thresholds>;
  Models API: <https://docs.passport.human.tech/building-with-passport/models/introduction>
- Gitcoin round operations, sybil analysis —
  <https://roundoperations.gitcoin.co/round-operations/post-round/sybil-analysis>
- 2Captcha price list (retrieved 2026-07-24) — <https://2captcha.com/for-customer>
- Circles invitations-at-scale source — <https://github.com/aboutcircles/circles-invitation-at-scale>
- LayerZero announcement of 803,093 — <https://x.com/LayerZero_Core/status/1791622471965163597>
- Optimism announcement of 17k removals / 14M OP recovered —
  <https://x.com/Optimism/status/1528830231322165249>
- Kleros PoH docs — <https://docs.kleros.io/products/proof-of-humanity/poh-faq>,
  <https://docs.kleros.io/products/proof-of-humanity/proof-humanity-tutorial-remove-and-challenge>

**Secondary (journalism / analysis — labelled as such throughout)**

- MIT Technology Review, Worldcoin's recruitment of its first 500k users (2022-04-06) —
  <https://www.technologyreview.com/2022/04/06/1048981/worldcoin-cryptocurrency-biometrics-web3/>
- MIT Technology Review, Telegram KYC-bypass tooling (2026-04-15) —
  <https://www.technologyreview.com/2026/04/15/1135898/cyberscammers-bypassing-bank-telegram/>
- Singapore Worldcoin account-trading arrests —
  <https://www.singaporelawwatch.sg/Headlines/7-under-police-probe-for-allegedly-buying-and-selling-worldcoin-accounts>,
  <https://www.thestar.com.my/aseanplus/aseanplus-news/2024/09/15/seven-under-singapore-police-probe-for-allegedly-buying-and-selling-worldcoin-accounts>,
  <https://cointelegraph.com/news/worldcoin-singapore-investigation-money-laundering-terrorism-financing>
- ZachXBT Worldcoin black-market coverage (2026-04-28) —
  <https://www.cryptotimes.io/2026/04/28/scam-altman-musks-jab-meets-zachxbt-claim-as-worldcoin-faces-fresh-scrutiny/>
- Rest of World, Worldcoin Kenya scammers (2023) —
  <https://restofworld.org/2023/worldcoin-kenya-suspended-scammers-cash-in/>
- X-explore Arbitrum sybil analysis — <https://paragraph.com/@x-explore/LkyJPs8v4QkRWxZAx2gc>;
  summary at <https://beosin.com/resources/a-closer-look-at-the-anti-sybil-mechanism-under-the-arbitrum>
- The Block, Linea sybil filtering —
  <https://www.theblock.co/post/335979/linea-filters-over-half-a-million-sybil-addresses-from-upcoming-token-airdrop>
- The Block, LayerZero self-reporting —
  <https://www.theblock.co/post/294230/layerzero-labs-ceo-says-up-to-100000-addresses-have-self-reported-as-airdrop-sybils>
- The Register / VOA, Thai click-farm seizure (2017) —
  <https://www.theregister.com/2017/06/14/click_farm/>,
  <https://www.voanews.com/a/thai-police-raid-click-farm-finds-hundreds-of-thousands-of-sim-cards/3898497.html>
- Biometric Update, World ID live-presence integrations (2026-05) —
  <https://www.biometricupdate.com/202605/zoom-opens-beta-for-world-id-deepfake-verification-in-enterprise-meetings>

**Sibling files in this research set (measured on-chain findings, 2026-07-24)**

- `/home/hugo/Projects/poh-aggregator/research/protocols/circles.md` — `BotCreated`/`FarmGrown`,
  `originInviter` concentration, `Hub.sol` invitation economics
- `/home/hugo/Projects/poh-aggregator/research/protocols/world-id.md` — presence-flag semantics
- `/home/hugo/Projects/poh-aggregator/research/landscape/kyc-liveness-vendors.md` — the vendor set
  named in the KYC-bypass reporting

**Known gaps — where to look next**

1. **A score-distribution histogram showing a spike at a published threshold.** The single most
   persuasive missing artifact in this file (§4.2). Source: Passport scorer API over a large
   address set, or Gitcoin per-round Vote Coefficients CSVs.
2. **ZachXBT's original 2026-04 post** and the **$15 upper bound** — only the $0.50 floor is
   corroborated here. Check his Telegram `@investigations` and X timeline for 2026-04-27/28.
3. **LayerZero's post-hoc evaluation** (bounty precision/recall). `sybil.layerzero.network` was
   `ENOTFOUND` on 2026-07-24. Try LayerZero Labs GitHub, Chaos Labs blog, Nansen archive.
4. **Nansen's Linea methodology page** — 301s to `nansen.ai/blog`; the methodology appears gone.
   Try the Wayback Machine.
5. **PoH/Kleros removal statistics** — how many profiles were removed as sybils or duplicates.
   Source: PoH subgraph removal-request events; Kleros court archive.
6. **A dated, primary price list for wallet-farm / anti-detect-browser / residential-proxy
   services.** Everything in §1.5 is currently order-of-magnitude only.
7. **A documented BrightID incident with numbers** — I found structural criticism only.
8. **MAS's parliamentary reply on Worldcoin** — the page was in maintenance on 2026-07-24.



