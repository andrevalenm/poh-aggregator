# Demand & regulation — who buys this, and what forces them to

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). The regulatory half (part A) salvaged well with
> precise dates. **Part B — actual paying demand: quadratic funding, airdrop distributors, DAO
> governance, social platforms, the AI-agent market — was never reached.** So this file answers "what
> forces people to buy" but not "who is paying today."

**The short version:** a wall of age-assurance and AI-transparency law lands between now and 2027,
across the EU, UK and US simultaneously. None of it asks for *proof of personhood* specifically —
almost all of it asks for **age assurance**, which is a different and more easily satisfied
requirement. Whether that regulatory pressure converts into demand for what we build depends on
whether "prove you're a unique human" rides along with "prove you're over 18." That is the central
commercial question and this research does not settle it.

## EU AI Act — Regulation (EU) 2024/1689

- **Article 50 transparency obligations enforced from 2 August 2026** — eight days from the date of
  this research. Requires **machine-readable marking of AI output** and **visible deepfake labels**.
- **Grandfathering:** the Article 50(2) machine-readable marking obligation for systems already on
  market is pushed to **2 December 2026**.
- Full application of the AI Act is **2 August 2026**.
- A **Digital Omnibus** proposal introduces "a staggered deferral of compliance deadlines" and eases
  the "safety component" definition so systems that merely assist users don't automatically become
  high-risk. `UNCLEAR:` status of the omnibus as of 2026-07 — proposed, not confirmed adopted.
- A **Code of Practice on marking and labelling of AI-generated content** exists, with a signatory
  deadline reported as **22 July 2026**.

**Relevance to us — indirect but real.** Article 50 marks *content* as AI-generated. It does not
require proving a *person* is human. But the README's first consumer use case — "badge a post as
human-written" — is the mirror image of Article 50: the law makes AI content labelled, which creates
the negative space for a positive human claim. That is a genuine tailwind, and it is the one piece of
regulation that points at personhood rather than age.

## UK Online Safety Act 2023

- **Risk assessments due 24 July 2025; mitigation measures from 25 July 2025.**
- **On 25 July 2025 the first Protection of Children Codes of Practice for user-to-user and search
  services came into force.**
- The operative standard is **"Highly Effective Age Assurance" (HEAA)** — "age verification or
  estimation methods that Ofcom deems strong enough to reliably enforce age restrictions."
- Applies to user-to-user services likely to be accessed by children, or where no HEAA restricts
  adult-only features.

**This is live law, already in force.** It is also the clearest example of the "age not personhood"
gap: HEAA can be satisfied by facial age *estimation* with no identity involved at all. Vendors like
Yoti already sell exactly that.

## US — age verification is now constitutional

**Free Speech Coalition v. Paxton**, decided **27 June 2025**, **6–3**. The Court upheld Texas
**HB 1181** (age verification for sites where over one-third of content is "sexual material harmful to
minors") under **intermediate scrutiny** — "a significant departure from earlier precedents that had
applied strict scrutiny to similar online speech regulations." Kagan dissented, joined by Sotomayor
and Jackson, arguing a content-based law demands strict scrutiny.

**This is the single most consequential legal development in this file.** By lowering the standard of
review, it unblocked the entire wave of US state age-verification law. Commentary (Perkins Coie) is
explicit that the implications reach "all websites — not just adult ones."

### App Store Accountability Acts

Three states enacted; more than a dozen considering. These matter because they push verification
**down to the app-store layer**, which would make age/identity signals available to every developer.

| State | Law | Signed | Effective / obligations |
|---|---|---|---|
| **Utah** | SB 142 | 2025-03-26 | in force 2025-05-07; provider/developer obligations were 2026-05-06, then **amended by HB 498 (signed 18 March) pushing most provisions to 2027-05-06** |
| **Texas** | **SB 2420** (*not* HB 18 — the brief's premise was wrong) | 2025-05-27 | effective 2026-01-01 |
| **Louisiana** | — | 2025 | `UNVERIFIED:` dates not captured |

**Texas has had a dramatic procedural history**: a federal judge in Austin blocked SB 2420 in
December 2025 as likely violating First Amendment rights; the **Fifth Circuit stayed that injunction**,
letting the law take effect; and in **July 2026 the US Supreme Court cleared the path for Texas to
enforce** it. Age verification is reported as **mandatory for App Store users in Texas since
June 2026**.

Requirements: verify age at account creation, obtain parental consent for minors before downloads or
in-app purchases, and **share age and consent information with developers**.

## eIDAS 2.0 / EUDI Wallet

Covered in detail in [government-standards-track.md](government-standards-track.md). The two dates
that matter commercially: **member states must offer a wallet by end of December 2026**, and
**obligated private-sector relying parties must accept it by late 2027**.

## Not researched

The agent never reached: **EU DSA** minor-protection guidelines (July 2025) and the age-verification
blueprint (partially covered in [national-zk-identity.md](national-zk-identity.md)); **C2PA /
Content Credentials** — spec version, adoption across Adobe/Google/OpenAI/Sony/Leica/Cloudflare/LinkedIn,
ISO status, and critically **whether C2PA has a "human-made" assertion that a personhood credential
could plug into**; COPPA 2.0; **Australia's under-16 social media ban**; India DPDP age rules; EU TFR
and MiCA.

**The C2PA gap is the one to close first.** If C2PA supports a "not AI / human-authored" assertion,
that is a standardised slot our credential could fill — and it is directly the README's first use case.

## Demand side — entirely unresearched

Part B of the brief was never started. Nothing below is answered:

- **Quadratic funding** — how Gitcoin Grants uses sybil resistance now, Allo protocol, round sizes,
  and other QF operators (Optimism RetroPGF, Giveth, clr.fund). *Partial coverage exists in
  [scoring-and-prior-art.md](scoring-and-prior-art.md) and
  [sybil-incidents-and-antipatterns.md](sybil-incidents-and-antipatterns.md).*
- **Airdrop distributors** — who actually *paid* for sybil filtering. We know LayerZero used Chaos
  Labs and Nansen, and Trusta claims work with Celestia, Starknet and Manta — but **no commercial
  deal terms or contract values were found anywhere in this research.** We do not know what anyone
  pays for sybil filtering.
- **DAO governance** with personhood-weighted voting.
- **Social platforms** — Farcaster, Lens, Bluesky, Reddit's stated intent to verify humanness, and any
  World deals.
- **Faucets, gaming, dating apps, ticketing.**
- **The AI-agent market** — "prove this is a human not an agent": Cloudflare signed agents / Web Bot
  Auth, proof-of-human HTTP headers, **x402**, **ERC-8004**. *Note we found real artifacts here
  anyway: Billions ships [`x402-human-proof-js`](https://github.com/BillionsNetwork/x402-human-proof-js)
  for verified-human gating and discounted API pricing, and both Self and Billions ship ERC-8004 agent
  identity work — see [attestation-layers-and-adjacent.md](attestation-layers-and-adjacent.md). Every
  commercial vendor in this landscape is pivoting toward agent verification, which is the strongest
  available signal about where money actually is.*

## What this means for us

1. **The regulatory wave is about age, not personhood.** UK HEAA, US app-store acts, FSC v. Paxton —
   all age. Age assurance can be satisfied by face-estimation vendors with no identity layer.
   **We should not claim this regulation as our demand driver without a specific story for how a
   personhood credential wins where age estimation is sufficient and cheaper.**
2. **Two places where personhood specifically is implicated:** the EU AI Act's content-marking regime
   (creating the space for a human-authored claim), and the AI-agent verification market that every
   vendor is racing toward. Those are our tailwinds — not the children's-safety wave.
3. **Timing is favourable regardless.** Aug 2026 (AI Act), Dec 2026 (EUDI wallets), Jan 2026 → 2027
   (US app stores), late 2027 (EU RP acceptance). Anything we ship in the next 18 months lands into a
   market being forcibly reorganised around verified identity.
4. **We still do not know what anyone pays.** Across this entire research effort, exactly two prices
   were found: Civic's $0.05 per active pass per month, and Gitcoin's $2–3 on-chain stamp mint fee.
   **That is the biggest hole in the commercial case** and no amount of protocol research fixes it —
   it needs customer conversations.

## Open questions

1. Does C2PA have a "human-made" assertion we can plug into?
2. What did LayerZero, Arbitrum, zkSync or Starknet actually *pay* for sybil filtering?
3. Is the EU Digital Omnibus adopted, and does it move the Article 50 dates?
4. Does anyone weight DAO votes by personhood today?
5. How big is the agent-verification market really, and is "proof of not-agent" a better product
   framing than "proof of human"?

## Sources

- **EU AI Act:** [Article 50 text](https://artificialintelligenceact.eu/article/50/) · [transparency rules guide](https://artificialintelligenceact.eu/transparency-rules-article-50/) · [Code of Practice on marking AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) · [Greenberg Traurig — Commission details transparency obligations](https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act)
- **UK OSA:** [Ofcom — Age Assurance and Children's Access statement (PDF)](https://www.ofcom.org.uk/siteassets/resources/documents/consultations/category-1-10-weeks/statement-age-assurance-and-childrens-access/statement-age-assurance-and-childrens-access.pdf?v=397036) · [White & Case — Protection of Children Codes in force](https://www.whitecase.com/insight-alert/uk-online-safety-act-protection-children-codes-come-force) · [techUK](https://www.techuk.org/resource/ofcom-publishes-protection-of-children-codes-of-practice-and-guidance.html) · [Yoti — complying with Ofcom codes](https://www.yoti.com/blog/comply-ofcom-protection-of-children-codes-age-assurance/)
- **FSC v. Paxton:** [Wikipedia](https://en.wikipedia.org/wiki/Free_Speech_Coalition_v._Paxton) · [Congressional Research Service](https://www.congress.gov/crs-product/LSB11354) · [Perkins Coie — what it means for all websites](https://perkinscoie.com/insights/blog/free-speech-coalition-v-paxton-what-supreme-courts-age-verification-decision-could) · [EFF critique](https://www.eff.org/deeplinks/2025/06/todays-supreme-court-decision-age-verification-tramples-free-speech-and-undermines) · [ACLU](https://www.aclu.org/press-releases/fsc-paxton-age-verification)
- **App store acts:** [Utah ASAA enacted (Covington)](https://www.insideprivacy.com/united-states/state-legislatures/utah-enacts-app-store-accountability-act/) · [Utah amendment delays to 2027 (Wiley)](https://www.wileyconnect.com/utah-amends-app-store-accountability-act-asaa-key-obligations-delayed-until-may-6-2027) · [Texas ASAA signed (Hunton)](https://www.hunton.com/privacy-and-cybersecurity-law-blog/texas-governor-signs-texas-app-store-accountability-act-into-law) · [Fifth Circuit stays injunction (MoFo)](https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law) · [SCOTUS clears path (Al Jazeera, 2026-07-06)](https://www.aljazeera.com/news/2026/7/6/us-supreme-court-clears-path-for-texas-to-enforce-app-age-verification-law) · [overview (McDermott)](https://www.mcdermottlaw.com/insights/app-store-accountability-acts/) · [Texas & Louisiana (Orrick)](https://www.orrick.com/en/Insights/2025/07/Texas-and-Louisiana-Join-Growing-Trend-of-State-Age-Verification-Laws-for-App-Stores)
