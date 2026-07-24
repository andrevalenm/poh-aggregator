# Demand and Regulation — who pays for personhood, and what law forces it

**One-liner:** The world's largest identity mandate (age assurance) is real, enforced and
nine-figure — and it asks a different question than personhood does; meanwhile the buyers who
genuinely need uniqueness have repeatedly chosen $0 substitutes.
**Category:** landscape / commercial — demand-side and regulatory analysis
**Status (2026-07-24):** current as of writing; several volatile items flagged for re-check.
**Verdict (headline):** **No regulatory forcing function exists for personhood.** Age-assurance law
(UK OSA/ICO, *FSC v. Paxton* + ~23–25 US states, EU DSA Art. 28 + a free state-built AV app,
Australia's under-16 ban) forces an **attribute**, not **cardinality**, and is being served by
$0.05–$5 IDV incumbents and state-funded wallets. AI Act Art. 50 and the bot-disclosure laws put the
duty on the **bot to self-disclose**, not on the platform to verify humans. AML/KYC requires
**identification**, which a uniqueness credential structurally cannot provide. The one real emerging
pull is **per-human accountability for AI agents** (x402 / World AgentKit / Cloudflare Web Bot Auth) —
directionally strong, financially tiny today (~$50m *cumulative* x402 volume). Evidence supports a
**services business or a grant-funded public good**, plus one narrow venture path: sell **anti-abuse
per-human entitlement enforcement** priced against fraud loss, not "personhood."

**The five numbers that decide it:**
| Number | Meaning |
|---|---|
| **£14.47m** ICO fine on Reddit (2026-02-24) | a real, named, dollar-denominated identity loss — **but it was an *age* failure, cured with conventional IDV** |
| **<$1M revenue** at Human Passport on 2M users / 75 partners | measured willingness to pay for a personhood score: **<$0.50 lifetime per user** |
| **$0** — Reddit chose passkeys; LayerZero paid sybil bounties in its own token; Gitcoin moved to COCM | the three biggest buyers all priced uniqueness at zero |
| **$0.001 → $5** | the price ladder we are squeezed inside: free CAPTCHA below, richer document IDV above |
| **~$50m cumulative x402 volume** (late Apr 2026) | the agent thesis is real and directionally right, and currently too small to charge per-transaction |

## 1. Regulatory forcing functions
### 1.1 Age assurance (the big one)

**Bottom line: this is the only identity mandate on earth right now with confirmed nine-figure
aggregate enforcement exposure and confirmed seven- and eight-figure fines actually issued. It is
also, precisely, *not* personhood.** Age assurance asks "is this person over N?" — an *attribute*.
Personhood asks "is this a distinct human, and only one of them?" — *uniqueness*. A system that
proves you are 18+ says nothing about how many accounts you hold. See §1.1.6 for why this
distinction is load-bearing for our positioning.

#### 1.1.1 UK — Online Safety Act, and the fines are real

- OSA s.81/s.12 duties: services with pornographic content, and Part 3 services whose terms set a
  minimum age, must use **"highly effective age assurance" (HEAA)**. Ofcom's HEAA guidance accepts
  open banking, photo-ID matching, facial age *estimation*, mobile-network-operator checks, credit
  card checks and digital ID wallets; it explicitly **rejects self-declaration, debit-card checks
  and contractual terms** as insufficient.
  (Ofcom guidance summarised by Lewis Silkin, 2026-04-17 — secondary but lawyer-grade:
  https://www.lewissilkin.com/insights/2026/04/17/age-assurance-in-2026-what-do-digital-businesses-operating-in-the-uk-and-eu-need-to-know)
- **Enforcement actually happening (2026):**
  - Ofcom fined **8579 LLC £1.35m** for lacking HEAA on pornographic content, plus **£1,000/day**
    continuing penalties until compliance — largest OSA age-assurance penalty to date. A second
    penalty was issued against **Kick Online Entertainment S.A.** (Feb 2026).
    (Ofcom online safety industry bulletin, March 2026:
    https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-industry-bulletins/online-safety-industry-bulletin-march-2026;
    commentary: https://inforrm.org/2026/03/11/ofcom-steps-up-online-safety-act-enforcement-with-two-further-age-assurance-fines-for-pornographic-platforms-alexandros-antoniou/)
  - **77 of the top 100 dedicated porn services had age assurance in place, and a further 7 had
    geoblocked the UK, as of end-January 2026** (Ofcom). That is a near-complete forced migration of
    a whole industry onto paid IDV rails inside ~18 months.
  - **2026-03-12:** Ofcom wrote to major platforms requiring them to *enforce their own stated
    minimum ages* with HEAA, with a **2026-04-30** deadline to report intended actions. Ofcom is
    due to publish an effectiveness report **by end of July 2026** — i.e. imminent as of this
    writing (2026-07-24). Worth re-checking.
- **Separately, the ICO (data-protection regulator) fined Reddit £14.47m on 2026-02-24** for
  processing under-13s' data without a lawful basis (no effective age assurance) and for failing to
  do a DPIA before January 2025. Reddit only introduced age assurance in July 2025.
  Primary: https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/02/reddit-issued-with-1447m-fine-for-children-s-privacy-failures/
  (Secondary analysis: https://www.osborneclarke.com/insights/uk-ico-fines-online-platform-ps1447m-and-warns-age-self-declaration-not-enough-protect)
  **This is the single most useful data point in this file**: a named platform, a named number,
  £14.47m, for *not knowing something about its users*. It is also the same company as §3.4 — Reddit
  has both a bot problem and a £14.47m age problem, and chose passkeys for one and third-party IDV
  for the other. Note carefully: **it did not solve the £14.47m problem with a personhood
  credential. It solved it with conventional age verification.**
- **2026-03-26:** joint Ofcom/ICO statement — "self-declaration alone is not considered effective."
  Dual-regulator pressure (safety regulator + privacy regulator) is now the UK model.

#### 1.1.2 EU — DSA Art. 28, the age-verification app, and eIDAS2

- **DSA Article 28** requires providers accessible to minors to take appropriate measures for a high
  level of privacy/safety/security of minors, and bans profiling-based ads to minors. The Commission
  published **guidelines on the protection of minors under Art. 28 on 2025-07-14**, recommending age
  verification for adult-content and high-risk services and setting accuracy/reliability/robustness/
  non-discrimination criteria.
- **EU age-verification app ("mini-wallet" / white-label AV solution).** Blueprint v2 released
  Oct 2025 adding passport/eID onboarding and Digital Credentials API support; Commission announced
  the app **"technically ready" on 2026-04-15**; piloted with **Denmark, France, Greece, Italy,
  Spain, Cyprus, Ireland**. Architecture is deliberately **zero-knowledge-flavoured: no identity data
  transmitted to the relying service** — the app attests "over 18" and nothing else.
  Source: Lewis Silkin 2026-04-17 (above). `UNVERIFIED:` exact production launch date and whether any
  member state has mandated its use; check https://ec.europa.eu/digital-building-blocks and the
  GitHub repo `eu-digital-identity-wallet/av-app-*` for current status.
  **Strategically important: the EU is shipping a free, state-backed, privacy-preserving attribute
  attestation rail. Anything we build that competes on "privacy-preserving 18+ proof" loses to a
  government freebie.**
- **eIDAS2 / EUDI Wallet**: rollout targeted end-2026 (see sibling file
  `/home/hugo/Projects/poh-aggregator/research/landscape/eidas2-eudi-wallet.md`). Same conclusion —
  state-issued, free at point of use, and it will carry the age attribute.
- **Member states going further:** France's SREN law + Arcom's binding technical référentiel (in
  force Jan 2025), penalties up to **€150,000 or 2% of worldwide annual turnover**. Germany
  (nine-principle joint guidance, Oct 2024), Spain (AEPD guidance Dec 2023). Austria, Denmark,
  Greece and Spain have proposed minimum social-media ages of 14–16.

#### 1.1.3 US — *FSC v. Paxton* and the state-law wave

- **Free Speech Coalition, Inc. v. Paxton**, decided **2025-06-27**, **6–3**, upheld Texas HB1181's
  age-verification requirement for sites with ≥1/3 sexual material harmful to minors, applying
  **intermediate scrutiny** and holding the burden on adults' protected speech to be incidental.
  Primary: https://www.supremecourt.gov/opinions/24pdf/23-1122_3e04.pdf
  CRS analysis: https://www.congress.gov/crs-product/LSB11354
- Scope caveat (matters — don't overclaim): the reasoning covers age-verification for **sexual
  material harmful to minors**, not online age limits in general. Broader social-media age laws
  still face strict-scrutiny challenges. See AEI's "why the ruling is narrow":
  https://www.aei.org/technology-and-innovation/understanding-why-the-supreme-courts-ruling-in-free-speech-coalition-v-paxton-is-narrow/
- **~23 states** had adopted comparable laws by 2023–24 on FSC's own count (per the litigation
  record). `UNVERIFIED:` the exact 2026 count — the number has certainly grown post-*Paxton* and
  reporting varies (some trackers say 25+). Check the Free Speech Coalition's state-law tracker and
  NCSL for a current figure before using a number externally.
- Practical effect already visible pre-2026: Pornhub/Aylo geoblocked a growing list of US states
  rather than deploy AV — the same "comply or exit" dynamic Ofcom produced in the UK.

#### 1.1.4 Australia — the under-16 ban, and the honest results

- Social Media Minimum Age obligations took effect **2025-12-10** for 10 designated platforms,
  with penalties up to **AUD 49.5m** (widely reported as ~USD 33m).
- **>4.7 million accounts** deactivated, removed or restricted by mid-January 2026 (Australian
  Government figure); only a further ~310,000 by March 2026.
- **But: ~70% of under-16s were still accessing banned platforms three months in**, with eSafety
  reporting that "a substantial proportion of Australian children under the age of 16 continue to
  retain accounts, create new accounts, or pass platforms' age assurance systems." eSafety has
  issued **23 compulsory information-gathering notices** and opened formal investigations into
  **Facebook, Instagram, Snapchat, TikTok and YouTube**.
  (https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions;
  https://www.techpolicy.press/early-lessons-from-australias-teen-social-media-ban-for-the-rest-of-the-world/;
  https://www.emarketer.com/content/70-percent-australian-minors-still-use-social-media-three-months-after-ban)
- eSafety's expected method is **"successive validation" / waterfall**: try cheap signals first,
  escalate to stronger checks. **This is architecturally the same shape as our product** — a router
  over multiple verification methods returning a confidence-weighted answer. It is the closest thing
  to regulatory endorsement of aggregation that exists. It is for *age*, not personhood.

#### 1.1.5 How big is the money

`UNVERIFIED:` there is no reliable public number for total global age-assurance spend. Directional
evidence only: an entire top-100 porn industry, 10 designated Australian platforms, and every UK
Part 3 service with a stated minimum age are now buying HEAA. The vendors capturing it are the
incumbents in `/home/hugo/Projects/poh-aggregator/research/landscape/kyc-liveness-vendors.md`
(Yoti, Persona, Incode, VerifyMy, k-ID, Veriff…), not personhood protocols. If we want a number,
look at Yoti's Companies House filings (UK-registered, publishes accounts) and k-ID / Persona
funding rounds — that is the best available proxy for revenue in this niche.

#### 1.1.6 Why this mandate does *not* buy our product

The forcing function is real and large, and it is **for the wrong attribute**. Three reasons the
age wave does not automatically become personhood demand:

1. **Age is an attribute; personhood is a cardinality claim.** Regulators wrote "is this user over
   N", and every compliance product answers exactly that question and stops.
2. **The compliant answer is already commoditised and often free.** Facial age *estimation* costs
   cents and needs no identity; the EU is shipping a state-funded AV app; eIDAS2 wallets will carry
   the attribute at zero marginal cost.
3. **Age assurance is per-session and stateless by regulatory design.** Ofcom/ICO and the EU app all
   push *not* retaining identity data. Our aggregator's value proposition — a persistent,
   cross-protocol score attached to a user — is the exact architecture regulators are steering away
   from. See §5.

**Where it *does* help us:** it normalises "you must run a verification step at signup", it builds
consumer tolerance for IDV friction, and it puts an IDV vendor relationship inside every consumer
platform. That lowers our integration friction later. It does not, by itself, create a buyer.
### 1.2 EU AI Act — synthetic content & bot disclosure

**Article 50 transparency obligations become applicable 2026-08-02** — nine days after this file was
written. This is the nearest-term regulatory event in the whole landscape.

- Text: https://artificialintelligenceact.eu/article/50/ ; Commission FAQ (primary):
  https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- Obligations, in the order they matter to us:
  1. **Art. 50(1) — chatbot disclosure.** Providers of AI systems intended to interact directly with
     natural persons must design them so that persons are **informed they are interacting with an
     AI**, unless obvious from context.
  2. **Art. 50(2) — machine-readable marking** of synthetic audio/image/video/text output
     (watermarks, metadata, provenance signals), "effective, reliable, robust and interoperable".
     Commission guidance/Code of Practice on transparent AI was being finalised through June–July
     2026 (Greenberg Traurig, June 2026 — secondary:
     https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act).
     `UNVERIFIED:` reports of a grandfathering window pushing 50(2) to 2026-12-02 for systems already
     on the market come from trade press (techtimes.com) only — confirm against the Commission's own
     guidance before relying on it.
  3. **Art. 50(4) — deepfake disclosure** by deployers.
  4. **Art. 50(3)** — notice when emotion-recognition or biometric-categorisation systems are used.
- Penalties: up to **€15m or 3% of global annual turnover**, whichever is higher (AI Act Art. 99(4)),
  enforced by national market surveillance authorities.

**Why this creates far less demand for us than it looks like it should.** Article 50 is a
**self-disclosure** regime aimed at the *AI provider/deployer*. It says "the robot must announce
itself." It does **not** impose on any platform a duty to *detect* undisclosed bots or to verify that
a counterparty is human. The compliance product it creates is watermarking and provenance (C2PA,
SynthID, content credentials) — a **content**-provenance market, not a **person**-verification
market. Honest adversaries comply by adding a label; dishonest ones ignore it, and no one is fined
for failing to catch them. Our score is not a compliance artefact for Art. 50.

Second-order effect that *is* real: Art. 50 legitimises "is this AI?" as a first-class question in
product UX and pushes provenance metadata into media pipelines. If personhood ever becomes a
purchased signal, it will most plausibly ride the same rails ("provenance of the *actor*" next to
"provenance of the *content*"). That is a 2027+ bet, not a 2026 budget line.

### 1.3 DSA — VLOP obligations on inauthentic behaviour

- **Art. 34/35 systemic risk assessment and mitigation** applies to Very Large Online Platforms
  (≥45m monthly EU users). "Inauthentic use, automated exploitation of the service" and
  coordinated inauthentic behaviour are explicitly named in the systemic-risk framing, and
  mitigation measures may include "adapting… algorithmic systems", content moderation, and
  **"taking awareness-raising measures"**. Penalties up to **6% of global annual turnover** (Art. 74).
- Also relevant: **Art. 40** data access for researchers, and the **Code of Practice on
  Disinformation**, converted into a DSA **Code of Conduct** effective 2025-07-01, whose commitments
  include reducing manipulative behaviours (fake accounts, bot-driven amplification).
- `UNVERIFIED:` I did not find a DSA enforcement action in which the remedy imposed on a VLOP was
  *user-level human verification*. Every publicised DSA proceeding to date (X, TikTok, AliExpress,
  Temu, Meta) has concerned ads repositories, dark patterns, minors, illegal products or researcher
  data access. Where to look next: the Commission's DSA enforcement page
  (https://digital-strategy.ec.europa.eu/en/policies/dsa-enforcement) and the VLOPs' own
  Art. 42 transparency reports, which do publish fake-account-removal counts.

**Assessment:** Art. 34/35 is the strongest *theoretical* hook for personhood — it is the only rule
that makes a platform, not a bot operator, answerable for inauthentic accounts. But it is an
open-textured "assess and mitigate" duty with no prescribed method, and VLOPs already answer it with
in-house behavioural detection they have spent a decade building (and report in the hundreds of
millions of accounts removed per quarter). A VLOP's DSA answer is "we removed 1.3bn fake accounts";
it is not "we bought a personhood score." Treat DSA as a door-opener for enterprise conversations,
not a mandate.

### 1.4 US and other bot-disclosure laws

- **California B.O.T. Act (SB 1001, 2018)**, Bus. & Prof. Code §§17940–17943, in force since
  **2019-07-01**. Primary text:
  https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB1001
  - Unlawful to use a bot to communicate with a person in California **with intent to mislead**, in
    order to incentivise a sale/transaction or influence an election vote, **without disclosure**.
  - "Bot" = an automated online account where all or substantially all actions are not the result of
    a person.
  - Scope limited to public-facing sites/apps/networks with **≥10m monthly US visitors**.
  - **Expressly imposes no duty on platform service providers**; no private right of action;
    enforced by the AG, reported as up to ~$2,500/violation under UCL.
    (Secondary law-firm summaries: https://perkinscoie.com/insights/update/i-am-robot-californias-new-law-requires-disclosure-use-bots ,
    https://natlawreview.com/article/california-s-bot-disclosure-law-sb-1001-now-effect)
  - **In ~7 years I found no publicised AG enforcement action under the B.O.T. Act.**
    `UNVERIFIED:` absence of evidence, but a search of the California AG press-release archive would
    settle it. A law with no enforcement history creates no budget.
- Successors: state AI-companion / chatbot disclosure laws (California SB 243-type, and comparable
  bills in several states) continue the same pattern — disclosure by the bot, not detection by the
  platform.

**The structural point, and it applies to every bot law in the world:** these statutes place the duty
on the **honest bot** to identify itself. None of them place a duty on a platform to **prove its
users are human**. The regulatory arrow points at self-labelling, not at personhood proof. Anyone
pitching "bot laws will force platforms to buy humanity verification" is reading the statutes
backwards.

### 1.5 MiCA / travel rule / crypto AML — and why personhood ≠ KYC

**Read this section before writing any pitch deck. It kills the most common naive positioning in
this category.**

- **Regulated AML/CFT obligations require *identification*, not *uniqueness*.** Under FATF R.10 /
  EU AMLD & the 2024 AML package (AMLR, AMLD6, AMLA) and the **Transfer of Funds Regulation
  (EU) 2023/1113** ("crypto travel rule", applicable 2024-12-30), a CASP must obtain and verify the
  **name, address/DOB/national identifier, and account/wallet identifier** of originator and
  beneficiary, screen against sanctions lists, retain records for 5 years, and be able to produce a
  named natural person on demand to an FIU.
- **A personhood credential structurally cannot satisfy any of that.** The whole value of a
  proof-of-personhood credential is that it asserts "a distinct human" while revealing **no
  identifying attributes**. Sanctions screening requires a name. SAR filing requires a name.
  Travel-rule messaging (IVMS101 payload) has mandatory name and address fields. A nullifier is not
  a name. **Personhood credentials are, by construction, useless for KYC/AML** — and the better the
  privacy properties, the more useless.
- Narrow exceptions where uniqueness has real AML-adjacent value, and they are *risk* tools not
  *compliance* tools:
  - **Sybil-resistant rate limiting** on faucets, promos, referral bonuses and airdrops (fraud loss,
    not regulatory loss).
  - **Duplicate-account detection** *inside* an already-KYC'd population — but a CASP that has done
    KYC already has a better dedup key (the document + the biometric), which is exactly why IDV
    vendors sell 1:N dedup and personhood protocols don't get a look-in.
  - **"Same human across two regulated entities" claims** — attractive, but reusable-KYC schemes
    (and, in the EU, the EUDI wallet + eIDAS2 attestations) are the sanctioned answer, and they carry
    identity, not just uniqueness.
- **MiCA** itself (Reg. (EU) 2023/1114, fully applicable 2024-12-30) is a market-conduct and
  authorisation regime; the identity duties on CASPs come from AMLR/TFR, not MiCA. `UNVERIFIED:`
  I have not re-checked the 2026 state of AMLA's technical standards; if a specific claim about
  2026 AML rules is needed, go to https://www.eba.europa.eu and the AMLA site directly.

**Consequence for our positioning:** never sell into a compliance budget. Compliance buyers need
identification; they already buy it; and their regulator will not accept a pseudonymous uniqueness
proof. Sell into **fraud/abuse-loss budgets**, which are discretionary, ROI-measured, and where
"one human, one account" is genuinely the thing being bought.

## 2. Where money is actually spent today

The honest summary before the detail: **the value at risk is enormous, the amount actually paid to
sybil-defence vendors is tiny, and almost all of it is one-off consulting rather than recurring
licence revenue.** That gap — huge losses, no budget line — is the central commercial fact of this
category, and it is the same gap that left Human Passport at <$1M revenue on 2M users.

### 2.1 Airdrop sybil filtering

**Value at risk: very large. Documented spend on defence: near-zero in recurring terms.**

- **LayerZero ZRO (2024)** is the best-documented case. LayerZero ran sybil detection **with Chaos
  Labs and Nansen**; an initial snapshot flagged **>2 million** candidate sybil addresses, narrowed to
  **803,093** identified sybils between self-reporting and the Chaos Labs/Nansen analysis. Final
  distribution: **11.5% of supply (~85.8m ZRO) to ~1.28m qualified wallets**.
  (Secondary: https://cryptobriefing.com/layerzero-airdrop-fairness/ ,
  https://crypto.news/layerzero-spots-800k-sybil-addresses-airdrop-scheme/ ,
  https://coincu.com/layerzero-sybil-detection-report/ — LayerZero's own posts are the primary
  source; `UNVERIFIED:` I did not re-fetch layerzero.network/blog for this run.)
- **The mechanism LayerZero actually used was not a vendor product — it was an incentive design.**
  Self-report and keep **15%** of your allocation, or be reported by a bounty hunter who earns **10%**
  of your allocation (minimum 20 addresses per report). LayerZero crowdsourced sybil detection by
  paying in the airdrop's own token. **Marginal cash cost to LayerZero: approximately zero.** This is
  the competitive reality for anyone selling sybil filtering to token issuers: the buyer can pay in
  inflation instead of dollars, and has a strong incentive to do so.
- **Value at risk, order of magnitude:** 803k sybil addresses at a per-wallet allocation in the
  hundreds of dollars implies **nine figures of misdirected token value** in that single event.
  `UNVERIFIED:` precise dollar figure depends on ZRO price at claim, which varied; do not quote a
  number without pinning it.
- **Who the buyers hire:** Nansen and Chaos Labs (LayerZero), Trusta Labs (widely used for
  MEDIA/TrustScore sybil scoring across L2 airdrops), Chainalysis/TRM for the AML overlay. All of
  these are **engagement-priced consulting or analytics subscriptions**, sold to a **one-off event**.
  `UNVERIFIED:` no published contract values for any of these engagements. Where to look next:
  Chaos Labs and Trusta have posted public methodology reports; procurement values are not public
  and probably never will be.
- **Why this is a bad segment to build a company on:** (a) demand is episodic — one TGE per project,
  maybe once ever; (b) the buyer's willingness to pay is capped by the fact that mis-allocating
  tokens costs them *dilution*, not cash; (c) buyers prefer post-hoc forensics on their own on-chain
  data (which they already have) over front-loaded user friction that suppresses the farming activity
  their growth metrics depend on. Airdrop farming is simultaneously the abuse *and* the KPI.

### 2.2 Quadratic funding / public goods

**This segment is too small to matter. Say so plainly.**

- **Gitcoin Grants 23 (GG23, 2025) distributed a total of ~$1.3M** across quadratic and retro funding.
  (https://www.gitcoin.co/blog/gitcoin-grants-23-retro)
- Sybil defence for the round is Passport scoring (eligibility threshold) plus **COCM**
  (Connection-Oriented Cluster Matching), an *algorithmic* mitigation applied to the donation graph.
  (https://gitcoin.co/research/quadratic-funding-sybil-resistance)
- **Even a generous 10% of a $1.3M matching pool spent on sybil defence is $130k of TAM per round.**
  The entire QF ecosystem — Gitcoin, Optimism RetroPGF, Octant, Giveth, clr.fund — is plausibly a
  **low-single-digit-millions annual** market for sybil tooling, most of which is done in-house or by
  volunteers.
- This is the segment that Human Passport actually served, and it is exactly why Human Passport made
  **under $1M in revenue** on 2M users and 35M credentials. **The reference case for our category is
  the reference case for this segment, and it is a warning.**
- Structural note: COCM matters strategically. It shows that QF's answer to sybils has drifted from
  "verify each human" to "**make the mechanism robust to unverified humans**". Mechanism design is a
  substitute good for personhood credentials, and it is free.

### 2.3 Bot mitigation & CAPTCHA — the incumbent spend we would have to displace

**This is the real money, and it is not ours.**

- **The scale of the problem is now confirmed by the biggest possible operator.** Cloudflare CEO
  Matthew Prince, **2026-06-03**, citing Cloudflare Radar: **automated requests generate 57.5% of
  HTML traffic — the first time machines have been the majority.**
  (Secondary reporting of Cloudflare Radar data; primary would be https://radar.cloudflare.com and
  Cloudflare's blog. `UNVERIFIED:` I did not re-fetch Radar directly.)
- **Incumbents:** Cloudflare (Turnstile, Bot Management, WAF), Akamai Bot Manager, Imperva/Thales
  Advanced Bot Protection, DataDome, HUMAN Security (ex-White Ops), Kasada, Arkose Labs, hCaptcha,
  Google reCAPTCHA Enterprise, F5 Distributed Cloud Bot Defense.
- **Real revenue figures are almost all private.** `UNVERIFIED:` I could not find credible published
  revenue for Arkose Labs or hCaptcha; Arkose's only hard public datapoint is **1,005% growth on the
  2023 Deloitte Technology Fast 500 (rank #142)** — a growth rate with no base, which is not a
  revenue number. Cloudflare is public but does **not** break out bot management as a segment. Where
  to look next: HUMAN Security's disclosed funding/valuation (~$1bn+ post-Goldman-led round),
  DataDome's Series C/D, and Gartner's Magic Quadrant for Bot Management for share estimates.
- **What they charge (the number that actually constrains our pricing):**
  - **Cloudflare Turnstile: free** at ordinary volumes; a paid Enterprise tier exists.
    **This is the price floor for "not a bot" and it is zero.**
  - Google **reCAPTCHA Enterprise**: free tier then roughly **$1 per 1,000 assessments** at published
    list price, i.e. **$0.001 per check**. `UNVERIFIED:` re-check
    https://cloud.google.com/recaptcha/pricing before quoting.
  - Enterprise bot management (Cloudflare/DataDome/HUMAN): typically **five- to six-figure annual
    contracts**, priced on traffic volume, not per-human.
- **The displacement problem, stated bluntly:** the incumbent buys a *traffic-level* verdict for
  ~$0.001 per request, needs no user account, no consent flow, no PII, and no user friction. We
  would sell a *user-level* verdict that requires an onboarding flow, a consent record, and probably
  a document or biometric. **We are two to four orders of magnitude more expensive and dramatically
  higher friction.** The only place that trade is rational is where the *consequence* per account is
  large — money movement, high-value marketplace listings, one-per-person entitlements — not where
  the consequence is a spam comment.

### 2.4 Fraud / AML tooling — the adjacent market that works

- The commercially proven adjacent categories are **identity verification / KYC orchestration**
  (Persona, Trulioo, Alloy, Sumsub, Veriff, Jumio, Onfido/Entrust, Socure, Incode) and
  **transaction-fraud** (Sift, Sardine, Unit21, Feedzai, Forter, Signifyd).
- **Why they work and we might not:** every one of them sells into either (a) a legal obligation with
  fines attached (AML/KYC, sanctions) or (b) a P&L line the CFO already tracks in dollars
  (chargebacks, fraud loss, disputes). Persona and Alloy are, structurally, *exactly our product
  shape* — an orchestration/routing layer over many underlying verification vendors returning a
  normalised decision. **The pattern works. What makes it work is the buyer's dollar-denominated
  loss, not the routing.**
- **The lesson for us is precise and uncomfortable:** "aggregator over many verification providers"
  is a validated business model — it is Persona, Alloy, Trulioo GlobalGateway, IDVerse/Au10tix
  orchestration. It is validated **for identification**, where the buyer is compelled. Nobody has
  demonstrated it for **uniqueness**, where the buyer is not.
- `UNVERIFIED:` no reliable single figure for global fraud/IDV tooling spend; vendor-sponsored market
  reports put IDV at roughly $12–20bn growing ~15%/yr, but these are marketing artefacts. Do not
  quote them as fact. Use Persona's and Socure's disclosed valuations/ARR statements instead if a
  number is needed.

## 3. The AI-agent demand shift

**This is the only genuinely new demand vector, and it is the best argument for the category. It is
also, right now, revenue-tiny. Both things are true.**

The shift in the question being asked is real and important. The old question was *"is this a bot?"*
(answered by traffic-level heuristics, ~$0.001/request). The new question is *"which human is
accountable for this agent?"* — and that question **cannot** be answered by traffic heuristics,
CAPTCHAs, or passkeys, because the agent is *supposed* to be automated. It can only be answered by a
**delegation credential rooted in a verified person**. That is a genuinely new product surface, and
it is the one place where the incumbents in §2.3 structurally cannot compete.

### 3.1 Agent payments — x402

- **x402** is an open payment protocol from **Coinbase and Cloudflare** using HTTP **402 Payment
  Required** to embed stablecoin payments in web requests. Coinbase and Cloudflare announced an
  **x402 Foundation** (https://www.coinbase.com/blog/coinbase-and-cloudflare-will-launch-x402-foundation).
  **V2 is the recommended baseline spec.** Cloudflare and AWS have embedded x402 at the edge
  (InfoQ, July 2026: https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/).
- **Adoption numbers (date-stamped, and read them carefully):** Coinbase reported **~69,000 active
  agents, 165m transactions, and ~$50m cumulative volume by late April 2026**; and **>169m payments
  across 590,000 buyers and 100,000 sellers in the protocol's first year**.
  (Secondary aggregation: https://wavect.io/blog/x402-payments-comparison-2026/ — `UNVERIFIED:`
  these should be re-confirmed against Coinbase's own x402 posts / a public dashboard before use.)
- **Do the arithmetic before getting excited.** $50m *cumulative* volume across a year, at 165m
  transactions, is an **average transaction size of about $0.30**. Even a 1% take of total volume is
  ~$500k of *protocol-wide* value, split across every participant. **If we charged $0.01 per
  personhood check on every x402 transaction we would gross more than the entire payment volume of
  the network** — which is another way of saying no one can pay per-transaction prices here yet. The
  agent-payments market is enormous in narrative and microscopic in dollars as of mid-2026.
- **World's AgentKit** binds World ID into this: agents "carry cryptographic proof that they are
  backed by a unique human," linking multiple agents to one verified person via ZK proofs over
  Orb-based biometrics, so "a platform can allow someone to run several agents while still enforcing
  limits based on the underlying person" — e.g. one free trial or N bookings per day **per human**.
  Beta as of 2026-03-17.
  (https://www.coindesk.com/tech/2026/03/17/sam-altman-s-world-teams-up-with-coinbase-to-prove-there-is-a-real-person-behind-every-ai-transaction)
- **This is the single clearest articulation of a paying use case in the entire landscape:**
  *per-human rate limiting and entitlement enforcement in a world where each human runs N agents.*
  Free trials, promo abuse, API quota, seat licensing, marketplace listing limits — all of these are
  "one per human" problems that agents break, and all of them are already dollar-denominated losses
  that companies track. **If we have a wedge, it is here.**
- **The strategic threat is equally clear.** World is not selling a component into an aggregator; it
  is building the whole stack — identity, agent kit, payment rail integration, and named enterprise
  partners (per the sibling landscape file: Tinder, Zoom, DocuSign, Okta, Browserbase, Exa, Vercel),
  with a reported **$52.5m Pantera-led raise on 2026-07-24**. A vertically integrated incumbent with
  distribution into x402 is the most likely reason an aggregator becomes unnecessary: if World ID is
  natively in the payment rail, the merchant does not need a router.
  **Counter-argument for us:** the merchant *does* need a router the moment they must serve users who
  will not or cannot get orbed — which, given World's geographic and regulatory restrictions
  (multiple national bans), is most of the addressable population. Coverage is our wedge against
  World, not accuracy.

### 3.2 Cloudflare — Web Bot Auth, signed agents, pay-per-crawl

- **Web Bot Auth**: crawlers/agents register with Cloudflare, present **Ed25519 key pairs**, and sign
  every request using **HTTP Message Signatures**, so a bot can prove *which* bot it is.
  (https://blog.cloudflare.com/introducing-pay-per-crawl/ ,
  https://blog.cloudflare.com/introducing-ai-crawl-control/ ,
  https://developers.cloudflare.com/changelog/2025-12-10-pay-per-crawl-enhancements/)
- **Pay-per-crawl**: publishers charge crawlers (private beta launched at **$0.01+/page**), enforced
  via **HTTP 402** plus signed request headers; Cloudflare has said it will evolve into "pay per
  use". Cloudflare made default-blocking of AI crawlers its policy in July 2026
  (https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/).
- **Read the architecture, because it is a direct competitive fact:** Cloudflare's answer to
  "who is this automated agent" is **cryptographic bot identity + payment**, not human identity.
  The bot proves it is *Perplexity's crawler*, and then it *pays*. **Payment is being used as the
  sybil resistance.** This is the single most credible substitute for personhood in the agent
  economy: if an agent can pay $0.01, you do not care whether a human is behind it.
- **Where that substitute fails, and it is exactly where our value lives:** payment cannot enforce
  *fairness* or *one-per-person* semantics. It cannot allocate a free trial, a vote, a UBI claim, a
  government benefit, a "one review per customer" rule, or a scarce allocation. Anything where the
  point is that money **must not** be able to buy more of it is immune to the pay-to-play defence and
  requires personhood. **That set of use cases is real but small, and notably includes very few
  commercial buyers** — it is disproportionately governance, public goods, and regulated allocation.

### 3.3 Identity vendors' agent products

- **Okta** has shipped **Cross App Access (XAA)** for agent-to-app delegation inside the enterprise
  identity perimeter, plus **Auth for GenAI**, with **25+ early adopters including Anthropic, Asana,
  Atlassian, Canva, Cloudflare, Datadog, Docker, Figma and Slack**.
  (https://www.okta.com/newsroom/press-releases/okta-announces-cross-app-access-partners/ ,
  https://www.okta.com/solutions/cross-app-access/)
  `UNVERIFIED:` I could not confirm a product or feature literally named **"Human Principal"** on
  Okta's own site; the concept appears in the World/x402 partner framing. Do not attribute that name
  to Okta without checking https://www.okta.com/newsroom/ and Okta's Oktane 2026 announcements.
- **The crucial detail about Okta's approach:** XAA roots agent authority in an **enterprise
  directory identity** — an employee record in Okta/Entra. In the enterprise, the "human principal"
  problem is **already solved by HR onboarding**. Nobody needs a biometric uniqueness proof for an
  employee whose passport their employer photocopied on day one.
  **Therefore the enterprise agent market — the segment with actual budget — does not need us.**
  Personhood is only required where there is **no pre-existing relationship**: consumer signup,
  open marketplaces, public networks, permissionless protocols. That is the segment with the least
  willingness to pay. This inversion is the core commercial problem of the category and it recurs
  in every segment analysed in this file.
### 3.4 Reddit human verification — **PARTIALLY REFUTED** (important)

**Verdict: the "Reddit will mandate human verification" story is real but materially overstated,
and the way Reddit actually implemented it is bad news for our category.**

Confirmed from Reddit's own IR materials (primary source): Reddit Q1'26 earnings call transcript,
2026-04-30, hosted on Reddit's investor CDN
(https://s203.q4cdn.com/380862485/files/doc_financials/2026/q1/Reddit-Q1-26-Earnings-Call-Transcript.pdf).
CEO Steve Huffman, answering Ron Josey (Citi) on "verification processes and bot labeling":

> "So I'll start with the easiest one, bot verification. So we have what we call good bots on Reddit
> which are basically programs that mostly moderators have written to help run communities on
> Reddit. We're porting those over to our developer platform. That will both result in them being
> labeled on Reddit more transparently and also allow us to batten down the hatches more on
> unauthorized bot usage."

> "On the verification and login side, one of the key technologies there is something like passkeys.
> So passkeys is a general technology that includes things like [Face ID], Touch ID, Yubikeys --
> it's basically a log-in system that requires a person to do something, look at your phone, or
> touch something. This is both a more secure way of logging in, an easier way of logging in,
> which will help us just grow login users in general and then also serves as probably the lightest
> weight and most privacy- and user-acceptable way of doing human verification as well."

What this establishes:

1. **The demand is real.** The CEO of a ~$663M-revenue-per-quarter (Q1'26, +69% YoY, 40% adj.
   EBITDA margin — same transcript) social platform discussed human verification unprompted-ish
   on an earnings call, tied to bot defence and login growth. Authenticity is explicitly the
   company's positioning ("the most human place on the internet", same transcript).
2. **It is NOT a blanket mandate.** Per Huffman's 2026-03-25 u/spez post as reported by Engadget
   (secondary; Reddit's own domains are not fetchable by this agent), verification prompts apply
   only "in rare cases [to] accounts that seem 'fishy'" and "will not apply to most users." The
   "Reddit mandates ID for all users" framing circulating in March 2026 trade press
   (e.g. securityonline.info, recho.co — both secondary and both overstating it) is wrong.
   https://www.engadget.com/social-media/reddit-will-prompt-some-accounts-to-verify-humanness-in-latest-bot-crackdown-161000181.html
3. **They chose passkeys — the free primitive — not a personhood credential.** This is the single
   most commercially important fact in this file. Reddit evaluated the space and landed on
   device-bound WebAuthn because it is "the lightest weight and most privacy- and user-acceptable
   way of doing human verification." Passkeys prove *a device with a user-presence gesture*, i.e.
   **liveness-ish / not-a-headless-script**. They prove **nothing about uniqueness** — one person
   can enrol unlimited passkeys across unlimited accounts, and a farm with N phones has N
   "verified humans". Reddit is knowingly buying weak-but-free.
4. **World ID is "considering," not adopted.** Reported (secondary, Engadget/WinBuzzer, March 2026)
   as an alternative under consideration alongside government ID for age-verification regions.
   `UNVERIFIED:` no Reddit primary source names World ID. Do not cite this as a World ID win.
   Where to look next: Reddit Q2'26 earnings (due ~late July/early Aug 2026) and r/reddit /
   redditinc.com/blog, which this agent cannot fetch (Reddit blocks the crawler).

**Implication for us:** the flagship "reference customer" for the category picked a $0 solution that
our aggregator does not sell. If we pitch Reddit-shaped buyers, we are not competing against World
ID pricing — we are competing against **passkeys, which cost the platform nothing**. Our score has
to be worth more than the delta between "user-presence gesture" and "unique human", and Reddit's
revealed preference says that delta is currently not worth paying for at consumer-social scale.

## 4. Willingness to pay

### 4.1 The price ladder buyers already see

All figures list-price, dated 2026-07, and sourced from vendor pricing pages and comparison
roundups; treat the comparison-site numbers as **secondary and indicative** — enterprise deals are
negotiated 50–90% below list.

| What is bought | Price per unit | Source / note |
|---|---|---|
| CAPTCHA / "not a bot" (Cloudflare Turnstile) | **$0.00** | free at ordinary volumes — this is the floor |
| reCAPTCHA Enterprise assessment | **~$0.001** | ~$1 / 1,000 assessments; `UNVERIFIED:` re-check cloud.google.com/recaptcha/pricing |
| Cloudflare pay-per-crawl page access | **$0.01+** | https://blog.cloudflare.com/introducing-pay-per-crawl/ |
| Phone/email risk signal, device fingerprint | **~$0.01–0.10** | `UNVERIFIED:` typical vendor list, not confirmed this run |
| Facial **age estimation** (no ID) | **~$0.05–0.30** | `UNVERIFIED:` Yoti/VerifyMy do not publish list prices; verify via Yoti's published rate card or Companies House filings |
| Document + selfie IDV — Veriff | **$0.80** + $49/mo | https://trustswiftly.com/blog/identity-verification-pricing-comparison-and-alternatives/ (secondary) |
| Document + selfie IDV — Sumsub | **$1.35** (Basic, $149/mo min) / **$1.85** (Conformity, $299/mo min) | same (secondary) |
| Full KYC / IDV orchestration — Persona | **$2–$5** depending on config | same (secondary) |
| Enterprise bot management (Cloudflare/DataDome/HUMAN) | **5–6 figure annual contract**, priced on traffic | `UNVERIFIED:` no public rate cards |

### 4.2 What that implies for a personhood score

The uncomfortable arithmetic:

- **The band we can plausibly price into is $0.05–$0.50 per verified user**, one-off or annualised.
  Above ~$1 we are competing with a full document IDV that gives the buyer *more* information
  (a name, a DOB, an audit trail, an AML-usable record) than our score does. **A pseudonymous
  uniqueness score is strictly less useful to a compliance-minded buyer than a $1.35 Sumsub check.**
  That is a brutal comparison and it holds in every regulated vertical.
- Below ~$0.01 we are competing with free CAPTCHA, which the buyer already deploys, already trusts,
  and which imposes no consent, no PII, and no user drop-off.
- **We only escape the squeeze where the buyer needs the specific property neither alternative
  gives: cardinality across a population, without identification.** IDV gives identification without
  (cheap) cardinality. CAPTCHA gives neither. Our whole business lives in that gap.
- **Empirical willingness to pay in that gap, measured:** Human Passport — 2M users, 35M credentials,
  ~75 partners, **<$1M revenue**, sold for ~$10M. That is **under $0.50 of lifetime revenue per user
  and roughly $13,000 of lifetime revenue per partner.** If our aggregator achieved Human Passport's
  entire distribution it would be a sub-$1M-ARR business. **This is the most important number in the
  file after the £14.47m ICO fine, and the two numbers point in opposite directions.**
- **Reddit's revealed preference** (§3.4) prices the "user-presence gesture" tier at **$0** (passkeys).
- **Airdrop issuers' revealed preference** (§2.1) prices sybil detection at **$0 cash** (pay the
  bounty in your own token).
- **Where a real price exists:** in the *agent* context (§3.1), per-human entitlement enforcement
  attaches to a loss the buyer already books — free-trial abuse, promo fraud, API quota abuse, seat
  sharing. Those buyers today pay $0.50–$5 per blocked fraudulent signup to fraud vendors. That is
  the only place a $0.10–$1.00 personhood price is defensible, and it is defensible **only** because
  it is compared against fraud loss rather than against CAPTCHA.

### 4.3 The aggregator-specific pricing problem

An aggregator's gross margin is (price charged) − (cost of the underlying credential checks). Most
personhood credentials are **free to verify** (on-chain reads, public nullifier registries), which
sounds like 100% margin — but it also means **the buyer can verify them directly for free**. Our
product is not access; it is **normalisation, coverage and liability absorption**. Historically
buyers pay for normalisation only when the underlying integrations are genuinely painful (Plaid,
Trulioo) or when someone must own the decision (Alloy, Persona). We should assume **we are selling
an SLA and a risk transfer, not data** — and price accordingly (platform fee + per-decision), not
per-credential.

## 5. Privacy law as a constraint on us

**Take this section as seriously as the revenue sections. The regulatory risk here is not
theoretical — it has already killed or crippled the largest players in our supply chain.**

### 5.1 The evidence that this risk is live

- **World / Worldcoin has been fined, banned or ordered to delete data in a long list of
  jurisdictions**: Spain's AEPD precautionary ban (March 2024); Bavaria's BayLDA ordering deletion
  and GDPR-compliant rebuild (December 2024); **South Korea's PIPC fine of ~₩1.1bn (~$829,000)** for
  mishandling biometrics; **Brazil's ANPD outright ban (January 2025, reaffirmed March 2025)** with a
  threatened **R$50,000/day** penalty on resumption; **Thailand ordering shutdown and deletion
  (November 2025)**. (Secondary aggregation:
  https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/ ;
  https://www.biometricupdate.com/202403/worldcoin-fights-spanish-regulators-ban-in-court ;
  https://idtechwire.com/thailand-orders-worldcoin-to-halt-iris-scans-and-delete-biometric-data/ .
  `UNVERIFIED:` I have not re-fetched each DPA's own decision this run — do that before citing
  specific figures externally.)
- **Fractal ID's 2024 breach** exposed KYC documents of web3 users (see
  `/home/hugo/Projects/poh-aggregator/research/landscape/kyc-liveness-vendors.md`), demonstrating
  that the web3 identity supply chain is not operationally hardened.
- **Civic discontinued its uniqueness and liveness products on 2025-07-31** and pivoted to embedded
  wallet auth. The most direct precedent available: a funded, credible team in exactly our category
  decided the product was not worth operating. `UNVERIFIED:` I did not re-fetch Civic's shutdown
  notice in this run; the sibling prior-art file has it.

### 5.2 GDPR mechanics that bite an aggregator specifically

1. **Art. 9 special-category data.** Biometric data *processed for the purpose of uniquely
   identifying a natural person* is prohibited unless an Art. 9(2) exception applies. In practice for
   a consumer product the only workable basis is **Art. 9(2)(a) explicit consent** — which is
   **freely revocable**, cannot be a condition of service without consent-freeness problems, and is
   exactly the basis Bavaria and the AEPD attacked at World. *An aggregator that never touches raw
   biometrics is in a far better position than one that does* — this is a strong argument for
   **never proxying a biometric capture flow ourselves** and only ever consuming an upstream
   attestation.
2. **Controller vs. processor is genuinely hard for us, and the honest answer is unhelpful.** If we
   decide *which* protocols to query, *how* to weight them and *what* score to emit, we determine the
   purposes and means of processing → **we are a controller**, not a processor, regardless of what the
   contract says (EDPB Guidelines 07/2020). Consequences: our own Art. 13/14 notices to *the
   customer's* users, our own lawful basis, our own DPIA (Art. 35 — near-certainly mandatory:
   large-scale, systematic, special-category, innovative technology), our own Art. 30 records, and
   **direct exposure to supervisory authorities and to data-subject claims**. Being a joint
   controller with each customer (Art. 26 arrangements × N customers) is an operational nightmare.
   `UNVERIFIED:` this is my legal reading, not advice — it needs a real DPO/counsel review before it
   goes in any customer contract.
3. **Data minimisation (Art. 5(1)(c)) vs. the product's core temptation.** A better score comes from
   more history: which protocols a user has, when, revocations, cross-protocol correlations, device
   and behavioural signals. **Every improvement to score quality is a data-minimisation violation
   waiting to be argued.** This tension is structural, not fixable by engineering.
4. **Automated decision-making (Art. 22).** A score that gates access to a service — denying an
   account, blocking a claim — is plausibly a decision producing legal or similarly significant
   effects, triggering rights to human review, explanation and contestation. **Our product is
   literally an automated decision engine.** Budget for an appeals process from day one; it is a real
   cost and a real support burden.
5. **International transfers.** Personhood protocols are globally distributed; several credential
   issuers sit in jurisdictions without adequacy. SCCs + TIAs per issuer.
6. **Non-EU regimes with sharper teeth for biometrics:** Illinois **BIPA** (private right of action,
   statutory damages **$1,000/$5,000 per violation**, the reason Clearview and Meta paid nine
   figures), Texas CUBI, Washington MHMDA. **BIPA alone is an existential risk if we ever handle a
   face template for an Illinois resident.** Strong argument for a hard architectural rule:
   **we never receive, store or transit a biometric template. Ever.**

### 5.3 The correlation honeypot — our worst structural problem

**State it without softening: the aggregator is the one party in the system that holds the join key.**

Every protocol in our set is individually designed to be unlinkable. World ID uses app-scoped
nullifiers precisely so a user's actions in app A cannot be linked to app B. Passport-based ZK proofs
reveal an attribute and nothing else. Circles is a pseudonymous social graph. BrightID is a graph
identifier. **Each was built so that no one can correlate them.** Our product's entire function is to
put them side by side against a single user session — which means **we manufacture exactly the
linkage every one of those designs exists to prevent.**

Concretely, a compromise or a subpoena of our database yields, for a given person:
their World ID nullifier set → their passport-derived attributes → their Circles/on-chain addresses →
their linked social accounts → their IP and device → the list of every customer service they verified
at. **That is a deanonymisation oracle for the entire pseudonymous crypto population.** It is more
dangerous than any single protocol's database, and it is dangerous *because* we did our job.

This is simultaneously:

- **A regulatory liability.** A single database enabling cross-context identification is the paradigm
  case for Art. 5(1)(b) purpose-limitation and Art. 25 data-protection-by-design challenges, and it
  is the specific harm DPAs cite when they act against identity aggregators.
- **A product-trust problem, and the more binding one.** Our users are disproportionately
  privacy-motivated crypto users, and our customers' legal teams will ask, correctly, "so you hold a
  map from real people to all their pseudonyms?" **The answer "yes, but we're careful" loses the
  deal and loses the community.** Cypherpunk users will actively campaign against us; that is not
  hypothetical, it is what happened to every centralised identity linker in this space.
- **A moat problem in disguise.** The correlation graph is the obvious data moat and it is the one
  asset we must refuse to build. **Any business plan whose defensibility rests on accumulated
  credential-graph data is not investable and not shippable.**

**Architectural implications, if we build this at all — these are requirements, not nice-to-haves:**

1. **Stateless-by-default verification.** Compute the score in-session, return it, retain a signed
   attestation and an audit hash — **not the constituent credentials**.
2. **Per-customer scoping.** Derive customer-scoped pseudonyms so the *same* user at two customers is
   not correlatable in our own store. Accept the resulting loss of cross-customer signal as the price
   of existing. (Note this destroys the "our network effect grows with users" pitch. That is a real
   strategic cost and it should be priced into any fundraising narrative.)
3. **Never handle biometrics.** Consume upstream attestations only. This keeps us out of Art. 9 and
   BIPA.
4. **Client-side aggregation where possible.** If the scoring can run in the user's wallet/browser
   and we only verify a proof, we never hold the join at all. **This is the only architecture that
   genuinely answers the honeypot objection, and it should be the default design.**
5. **Publish the threat model.** In this community, an unpublished privacy claim is disbelieved by
   default.
## 6. Verdict on commercial viability

### 6.1 What the evidence actually says

**There is no regulatory forcing function for personhood. There is a very large forcing function for
*age*, and a smaller one for *content provenance*, and neither of them buys a uniqueness score.**

The mandate map, honestly scored:

| Regime | Forces what? | Creates demand for personhood? |
|---|---|---|
| UK OSA / ICO / Ofcom | age attribute, HEAA | **No** — buys age estimation & IDV |
| EU DSA Art. 28 + AV app + eIDAS2 | age attribute, state-funded and free | **No** — and actively crowds out paid alternatives |
| *FSC v. Paxton* + ~23–25 US states | age attribute for adult content | **No** |
| Australia SMMA | age attribute (waterfall/successive validation) | **No**, but validates the *aggregator architecture* |
| EU AI Act Art. 50 (from 2026-08-02) | **self**-disclosure by the AI, content watermarking | **No** — duty is on the bot, not the platform |
| DSA Art. 34/35 (VLOPs) | assess & mitigate inauthentic use, unspecified method | **Weakly** — best theoretical hook, no enforcement precedent |
| Cal. B.O.T. Act & successors | self-disclosure by the bot, ≥10m MAU, AG-only, no enforcement history found | **No** |
| MiCA / TFR / AMLR | **identification** of a named person | **No — and structurally incompatible** (§1.5) |

The demand map, honestly scored:

| Segment | Value at risk | Actual cash spend | Recurring? |
|---|---|---|---|
| Airdrop sybil filtering | 9 figures per major event | ~$0 cash (paid in own token; bounty crowdsourcing) | No — episodic |
| Quadratic funding / public goods | ~$1.3M per Gitcoin round | low six figures ecosystem-wide | Yes but trivially small |
| Bot mitigation / CAPTCHA | very large | large — but at **$0–$0.001/request**, to incumbents | Yes, and not available to us |
| Fraud / IDV / AML | very large | large — but requires **identification**, not uniqueness | Yes, and not available to us |
| **Agent accountability / per-human entitlements** | growing fast | tiny today ($50m *cumulative* x402 volume) | **Plausibly yes, from ~2027** |

Three independent revealed-preference signals all point the same way, and they are the strongest
evidence in this file because they are decisions, not opinions:

1. **Reddit** — the loudest "we need human verification" buyer on earth — chose **passkeys ($0)**.
2. **LayerZero** — facing 800k+ sybils — chose **token-denominated bounties ($0 cash)**.
3. **Gitcoin/QF** — the category's home turf — drifted to **COCM, an algorithmic fix ($0)**.

And three supply-side signals confirm the sellers reached the same conclusion:

4. **Human Passport**: 2M users, 35M credentials, 75 partners → **<$1M revenue, ~$10M exit.**
5. **Civic**: killed uniqueness + liveness products **2025-07-31** and pivoted to wallet auth.
6. **Humanity Protocol**: abandoned "Proof-of-Personhood" for "Proof-of-Trust" (Feb 2026) and pivoted
   to enterprise AI after a $36M hack (June 2026). **The #2 network concluded uniqueness was not the
   sellable product.**

When the two largest buyers, the flagship seller, the #2 network and a well-funded competitor all
independently price uniqueness at approximately zero, the market is telling us something, and it is
not "you need better distribution."

### 6.2 The buyer segments with a real, dollar-denominated, recurring pain

Only three survive scrutiny. Ranked by strength of evidence.

**1. Per-human entitlement enforcement in agent-mediated commerce and SaaS. (Strongest. Bet here.)**
Free-trial abuse, promo/referral fraud, API quota abuse, seat sharing, one-review-per-customer,
one-listing-per-seller. The pain is **recurring**, already **booked in dollars** as fraud/abuse loss,
and **structurally worsening** because one human now operates N agents — which breaks device- and
behaviour-based limits that used to work. World's AgentKit framing ("cap usage based on the
underlying person") is the clearest articulation anyone has published, and the fact that World,
Coinbase and Cloudflare are converging on it is corroboration. **Our differentiated wedge is
coverage**: World ID is unavailable or banned across much of the world (§5.1), so a merchant who
needs per-human limits *globally* needs a router. That is a real, defensible aggregator job.
*Caveat: dollars are small today ($50m cumulative x402 volume) and the buyer is enterprise, with an
18-month sales cycle and a security review we must pass despite §5.3.*

**2. Marketplaces, dating, and reputation systems with a fraud P&L. (Solid, unglamorous, real.)**
Dating apps (Tinder is a named World partner), gig marketplaces, ticketing, review platforms, online
gaming/gambling. They already pay **$0.80–$5 per verification** to Veriff/Sumsub/Persona, so the
budget line exists and the price point is proven. They want ban evasion prevented — a
**re-registration** problem, which is exactly a uniqueness problem and exactly what IDV does badly
and expensively. **This is the segment most likely to write a real cheque in the next 12 months.**
*Caveat: we win here only by being cheaper or higher-coverage than a document check, and the buyer
will happily take the document check if we wobble.*

**3. Token/protocol distribution and governance. (Real, but episodic and cash-poor.)**
Airdrops, governance sybil resistance, points programs, NFT allowlists. Genuinely needs uniqueness,
genuinely has value at risk, and is our natural distribution — but pays in tokens, buys once, and
often prefers post-hoc forensics. **Treat as a go-to-market channel and design partner source, not as
the revenue base.** The mistake Human Passport made was believing this was segment #1.

Explicitly **not** buyer segments, despite frequent claims: KYC/AML compliance (needs identification,
§1.5), age assurance compliance (needs an attribute, and the state is shipping it free, §1.1.6),
DSA/AI Act compliance (duty falls on bots and content, §1.2/§1.4), and enterprise agent identity
(already solved by the HR directory, §3.3).

### 6.3 The blunt answer

**On current evidence this is not a venture-scale business, and pitching it as one requires ignoring
five well-documented failures in the same category.** The honest reading:

- **As a standalone personhood-score API sold to crypto: it is a sub-$1M-ARR business.** That is not
  a forecast, it is the measured outcome for the company that reached 2M users and 75 partners doing
  exactly this. Nothing in the 2026 regulatory picture changes it, because every mandate that
  arrived asks a different question.
- **As a services / infrastructure business it works modestly.** Sybil-analysis engagements, airdrop
  design, round-integrity audits, integration consulting. Chaos Labs, Nansen and Trusta demonstrate
  demand. Ceiling: a good consultancy, single-digit millions, not a platform.
- **As a public good it is genuinely valuable and should be grant-funded.** Coverage-maximising,
  privacy-preserving, client-side, non-correlating verification is exactly what QF, governance and
  civic tech need and exactly what no one will pay market rates for. Optimism RetroPGF, Ethereum
  Foundation, Gitcoin, NLnet and EU Horizon are the realistic funders. Note this path is *consistent*
  with the architecture §5.3 forces on us anyway — the non-correlating, client-side design is both
  the ethical answer and the un-monetisable one. **That is not a coincidence; it is the category's
  core tension.**
- **The one credible venture path is to stop selling personhood and start selling per-human agent
  accountability** to segments 1 and 2 — priced against fraud loss, sold as an anti-abuse product,
  with personhood as the invisible mechanism rather than the pitch. That is a different company with
  a different name, a different buyer and a different demo. Whether that is the company we want to
  build is a founder question, not a research question.

**The disqualifying test to run before writing code:** find **three** companies that will sign an LOI
to pay **≥$0.10 per verified user per year** with a named budget line, before World ID's enterprise
motion locks up segment 1. If three months of selling cannot produce three such LOIs, the evidence in
this file says stop — and every prior team in this category learned that lesson after building the
product rather than before.

## References

Primary sources (regulator, court, company IR, official docs):

- Reddit Q1'26 earnings call transcript (Reddit IR CDN) — https://s203.q4cdn.com/380862485/files/doc_financials/2026/q1/Reddit-Q1-26-Earnings-Call-Transcript.pdf
- ICO — Reddit fined £14.47m — https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/02/reddit-issued-with-1447m-fine-for-children-s-privacy-failures/
- Ofcom online safety industry bulletin, March 2026 — https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-industry-bulletins/online-safety-industry-bulletin-march-2026
- *Free Speech Coalition, Inc. v. Paxton*, No. 23-1122 (U.S. June 27, 2025) — https://www.supremecourt.gov/opinions/24pdf/23-1122_3e04.pdf
- CRS Legal Sidebar LSB11354 — https://www.congress.gov/crs-product/LSB11354
- EU AI Act Art. 50 — https://artificialintelligenceact.eu/article/50/ ; Commission FAQ — https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- California B.O.T. Act (SB 1001) text — https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB1001
- eSafety Commissioner — social media age restrictions — https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions
- Cloudflare — pay per crawl — https://blog.cloudflare.com/introducing-pay-per-crawl/ ; AI Crawl Control — https://blog.cloudflare.com/introducing-ai-crawl-control/ ; changelog — https://developers.cloudflare.com/changelog/2025-12-10-pay-per-crawl-enhancements/
- Coinbase — x402 Foundation — https://www.coinbase.com/blog/coinbase-and-cloudflare-will-launch-x402-foundation
- Okta — Cross App Access partners — https://www.okta.com/newsroom/press-releases/okta-announces-cross-app-access-partners/ ; https://www.okta.com/solutions/cross-app-access/
- Gitcoin — GG23 retro — https://www.gitcoin.co/blog/gitcoin-grants-23-retro ; QF sybil resistance — https://gitcoin.co/research/quadratic-funding-sybil-resistance

Secondary (labelled as such throughout):

- Lewis Silkin, "Age Assurance in 2026" (2026-04-17) — https://www.lewissilkin.com/insights/2026/04/17/age-assurance-in-2026-what-do-digital-businesses-operating-in-the-uk-and-eu-need-to-know
- Osborne Clarke on the ICO/Reddit decision — https://www.osborneclarke.com/insights/uk-ico-fines-online-platform-ps1447m-and-warns-age-self-declaration-not-enough-protect
- Inforrm / Antoniou on Ofcom AV fines — https://inforrm.org/2026/03/11/ofcom-steps-up-online-safety-act-enforcement-with-two-further-age-assurance-fines-for-pornographic-platforms-alexandros-antoniou/
- AEI on the narrowness of *Paxton* — https://www.aei.org/technology-and-innovation/understanding-why-the-supreme-courts-ruling-in-free-speech-coalition-v-paxton-is-narrow/
- Greenberg Traurig on AI Act Art. 50 guidance (June 2026) — https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act
- Perkins Coie on SB 1001 — https://perkinscoie.com/insights/update/i-am-robot-californias-new-law-requires-disclosure-use-bots
- Engadget on Reddit "verify humanness" (2026-03) — https://www.engadget.com/social-media/reddit-will-prompt-some-accounts-to-verify-humanness-in-latest-bot-crackdown-161000181.html
- CoinDesk on World AgentKit + x402 (2026-03-17) — https://www.coindesk.com/tech/2026/03/17/sam-altman-s-world-teams-up-with-coinbase-to-prove-there-is-a-real-person-behind-every-ai-transaction
- InfoQ on Cloudflare/AWS x402 at the edge (2026-07) — https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/
- TechCrunch on Cloudflare's crawler policy (2026-07-01) — https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/
- Crypto Briefing / crypto.news / Coincu on LayerZero sybil detection — https://cryptobriefing.com/layerzero-airdrop-fairness/ , https://crypto.news/layerzero-spots-800k-sybil-addresses-airdrop-scheme/ , https://coincu.com/layerzero-sybil-detection-report/
- Trust Swiftly IDV pricing comparison (2026) — https://trustswiftly.com/blog/identity-verification-pricing-comparison-and-alternatives/
- Rest of World on World's bans and US partnerships (2026) — https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/
- Biometric Update / ID Tech Wire on World regulatory actions — https://www.biometricupdate.com/202403/worldcoin-fights-spanish-regulators-ban-in-court , https://idtechwire.com/thailand-orders-worldcoin-to-halt-iris-scans-and-delete-biometric-data/
- TechPolicy.Press and eMarketer on Australia's ban results — https://www.techpolicy.press/early-lessons-from-australias-teen-social-media-ban-for-the-rest-of-the-world/ , https://www.emarketer.com/content/70-percent-australian-minors-still-use-social-media-three-months-after-ban

Sibling research files relied on:

- `/home/hugo/Projects/poh-aggregator/research/landscape/identity-infra-prior-art.md` (Human Passport, Civic, Spruce numbers)
- `/home/hugo/Projects/poh-aggregator/research/landscape/kyc-liveness-vendors.md`
- `/home/hugo/Projects/poh-aggregator/research/landscape/eidas2-eudi-wallet.md`
- `/home/hugo/Projects/poh-aggregator/research/landscape/poh-landscape-sweep.md` (Humanity Protocol pivot, World AgentKit partner list)

## Open questions for us

1. **Ofcom's age-assurance effectiveness report, due end of July 2026** — publishes within days of
   this file. It will name which assurance methods actually worked and may create the first
   regulator-blessed method ranking. Re-check.
2. **Reddit Q2'26 earnings (~late July / early August 2026)** — the only reliable way to learn whether
   passkeys sufficed or whether Reddit escalated to third-party human verification. This single
   datapoint moves the verdict more than anything else pending.
3. **Exact current count of US state age-verification laws** — needed for any external claim; use the
   FSC tracker and NCSL, not press reports.
4. **Whether any DSA Art. 34/35 enforcement has ever required user-level human verification.** If one
   appears, segment ranking changes materially.
5. **Real revenue figures for hCaptcha, Arkose, DataDome, HUMAN** — the size of the pool we would be
   displacing. Best available proxies: funding rounds, Gartner MQ share estimates, Companies House
   filings for UK entities (Yoti in particular).
6. **Whether Okta ships anything literally called "Human Principal"** — check Oktane 2026.
7. **x402 volume trajectory** — if cumulative volume goes from $50m to $5bn in 12 months, segment 1
   becomes urgent; if it stalls, the agent thesis is a 2028 story.
