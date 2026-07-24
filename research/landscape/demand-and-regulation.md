# Demand and Regulation — who pays for personhood, and what law forces it

> STATUS: in progress (started 2026-07-24)

**One-liner:** …
**Category:** landscape / commercial
**Status (2026-07):** …
**Verdict:** …

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
### 1.3 DSA — VLOP obligations on inauthentic behaviour
### 1.4 US and other bot-disclosure laws
### 1.5 MiCA / travel rule / crypto AML — and why personhood ≠ KYC

## 2. Where money is actually spent today
### 2.1 Airdrop sybil filtering
### 2.2 Quadratic funding / public goods
### 2.3 Bot mitigation & CAPTCHA (incumbent spend)
### 2.4 Fraud / AML tooling (adjacent market)

## 3. The AI-agent demand shift
### 3.1 Agent payments (x402 and friends)
### 3.2 Cloudflare Web Bot Auth / pay-per-crawl
### 3.3 Identity vendors' agent products
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
## 5. Privacy law as a constraint on us
## 6. Verdict on commercial viability
## References
