# KYC / Identity-Verification / Liveness Vendor Layer

*Last updated 2026-07-24.*

**One-liner:** The commercial IDV/biometrics vendors (FaceTec, iProov, Sumsub, Jumio, Persona,
Onfido/Entrust, Veriff, Incode, Au10tix, Trulioo, Socure, Regula, IDnow, Shufti) that sit *underneath*
most "web3 personhood" branding — they are the actual trust root for many protocols we score.
**Category:** liveness (mostly) + state-identity (document-based) — **rarely uniqueness**, because
uniqueness requires 1:N biometric dedup, which most of these products do not do by default.
**Chains:** none — all off-chain, Web2 SaaS.
**Status (2026-07):** live commercial market — see per-vendor notes.
**Aggregator verdict:** *not directly consumable as a credential*; these are **upstream dependencies
of other people's credentials** and the primary source of **double-counting risk** in our aggregate.

## Why this file exists

Several protocols we score are thin wrappers over these vendors. If four protocols in our aggregate
all bottom out in one Sumsub or one FaceTec check, our "four independent signals" is **one signal
counted four times**. Two collapses are already confirmed:

- **Sumsub** is the trust root for **Galxe Passport v3**, **Linea Proof of Humanity V2**, **idOS**, and
  Sumsub's own attestations on **Solana (SAS)**, **Linea (Verax)** and **Chainlink ACE**.
- **FaceTec** is the trust root, via **Synaps**, for **Anima Protocol's Proof of Uniqueness** and the
  **Linea/Privado ID/Billions "private biometric Proof of Uniqueness"** — and separately, directly, for
  **Civic's "Proof of Personhood."**

Everything else in this file exists to let us (a) detect these collapses for protocols that don't
disclose their vendor, and (b) price what a vendor-derived credential is actually worth.

## Taxonomy: what each capability actually proves

Read every vendor datasheet through this ladder. Vendors deliberately blur rungs 2-5.

| # | Capability | What it proves | Sybil-resistance |
|---|---|---|---|
| 1 | **Document OCR / visual authentication** | a document *image* looked right | ~none — AI-generated ID images cost ~$15 |
| 2 | **NFC / chip document read (ICAO 9303 passive auth)** | the document's chip is genuinely government-signed | strong *for the document*; says nothing about who's holding it. Also defeated by a **rented genuine passport** |
| 3 | **Active liveness** (blink/turn/read-a-number) | a responsive agent was in front of *some* camera | broken by real-time deepfake + camera injection (2026) |
| 4 | **Passive liveness / PAD** (single frame or short video, no user action) | no *presentation* artefact detected | good vs. print/replay/mask; **blind to injection by construction** |
| 5 | **1:1 face match (selfie ↔ document portrait)** | the live face matches the document | strong; but passes trivially when the document is legitimately rented |
| 6 | **1:N biometric dedup against an enrolled population** | **this human has not enrolled before *in this population*** | **the only rung that yields uniqueness** — and only within one integrator's database |
| 7 | **Cross-customer / global 1:N** | this human has not enrolled anywhere in the vendor's network | would be genuinely strong. **Effectively nobody offers this for privacy/legal reasons.** |

**Rule for our scoring: unless a protocol can demonstrate rung 6, its KYC-derived credential is a
liveness/bot-filter signal, not a uniqueness signal.** Marketing copy saying "proof of personhood"
does not establish rung 6.

## Vendor-by-vendor profiles

### FaceTec (US, Las Vegas) — the liveness engine under much of web3
- **Core product:** 3D Liveness from a short video-selfie, producing a proprietary **3D FaceMap®** /
  **3D FaceVector™** template; 1:1 face match claimed at **FAR 1/125,000,000 @ <1% FRR**.
  (https://www.facetec.com/, retrieved 2026-07-24 — vendor-sourced numbers.)
- **1:N dedup: YES, and this is the important part.** FaceTec Server exposes `/3d-db/search`
  (search one FaceMap against a 3D-DB) and `/3d-db/search-n-n` (all-vs-all duplicate sweep of an
  existing DB), plus a server config flag *"Account Deduplication Search On New Enrollments."*
  Claimed **1:N up to 1/1B FAR**, ~1s search over 1M FaceMaps.
  https://dev.facetec.com/1-to-n-search ; https://dev.facetec.com/technical-support-server-sdk-guides-fraud-deduplication ;
  https://dev.facetec.com/configuration-options
  - **Critical scoping caveat for us:** the 3D-DB is *the integrator's own database*, deployed in the
    integrator's FaceTec Server. There is no global cross-customer FaceTec identity graph. So FaceTec
    1:N gives uniqueness **within one protocol's user set**, not across protocols. Two different
    protocols both using FaceTec do **not** share a dedup namespace — but they *do* share the same
    liveness failure modes and the same template extractor, so their evidence is correlated even
    though their uniqueness sets are not.
  - It is also **opt-in configuration**. A protocol can ship FaceTec with dedup off and still say
    "FaceTec-powered biometrics." Do not infer uniqueness from the presence of FaceTec.
- **Documents:** Photo ID OCR + barcode + NFC chip scanning; FaceTec states unlimited photo-ID scans
  are bundled free with 3D Liveness licences (i.e. their monetisation is the liveness call).
- **UR® Codes:** digitally-signed offline credential containing biometric data — a portable
  credential format, relevant because it is the one FaceTec artifact that could in principle be
  presented to a third party (us) rather than checked by the issuer.
- **Certifications claimed:** "ISO 30107-3 Level 1-5 PAD & IAD" via iBeta. **NOTE:** ISO/IEC 30107-3
  itself defines Levels 1-2 in the iBeta programme; "Level 3-5" is FaceTec's own extended scheme, not
  a standardised tier. Treat "Level 5" as marketing unless a test report is produced. `UNVERIFIED:`
  I did not locate the underlying iBeta report PDFs for the higher levels.
- **Pricing:** monthly billing on 3D Liveness usage with a minimum monthly commitment; per-check rate
  not published. `UNCLEAR:` public per-verification price.
- **Distribution matters for attribution:** FaceTec sells heavily through resellers/integrators who
  self-host FaceTec Server. Synaps is exactly this. **A FaceTec-powered flow can emit zero
  FaceTec-owned network traffic** — attribution must come from SDK bundle strings, not DNS.
- **Litigation note:** FaceTec and iProov have been in a mutual patent fight over selfie-based liveness
  (FaceTec sued; iProov counter-sued, 2022).
  https://www.biometricupdate.com/202204/iproov-brings-counter-suit-against-facetec-in-biometric-liveness-ip-dispute

### Synaps (France) — the web3 *reseller* layer, not a biometrics company
- **This is the most under-appreciated node in the graph.** Synaps is an IDV platform sold to crypto,
  and it **runs FaceTec on its own servers** for liveness
  (https://medium.com/@anima_protocol/inside-proof-of-personhood-cde68ec84784).
- Synaps **launched Anima Protocol** (2022, with Aleph.im) — Anima is not an independent protocol that
  chose a vendor; it *is* the vendor's web3 front-end.
  https://www.globenewswire.com/news-release/2022/04/12/2421095/0/en/Synaps-Launches-Novel-Decentralized-Identity-Solution-Anima-Protocol-In-Partnership-with-Aleph-im.html
- The **Linea "first private biometric Proof of Uniqueness"** is Synaps + Verax + Privado ID; it
  produces a "non-reversible hash of the user's face … compared with others to confirm uniqueness"
  anchored to Verax. https://billions.network/blog/first-private-biometric-proof-of-uniqueness-on-linea-blockchain
- Anima's model: the raw liveness capture is deleted; a **"FaceGraph"** (face vector) is encrypted and
  stored on **Storj**; uniqueness is asserted by comparing FaceGraphs.
  `UNCLEAR:` **the scope of that comparison** — is the FaceGraph population global across all Synaps
  deployments, or per-integrator? This determines whether Anima/Linea PoU is rung 6 or rung 7, and it is
  the single most valuable follow-up for pricing those two credentials.
- **Consequence for dedup:** Anima PoU and Linea/Billions PoU are almost certainly **the same
  underlying biometric evidence** (same FaceTec extractor, same Synaps FaceGraph pipeline). Treat them
  as one bucket unless Synaps confirms separate populations.

### Sumsub (UK/global) — the most-embedded vendor in web3
- **Full-stack:** document verification (OCR + NFC), liveness, 1:1 face match, AML/PEP/sanctions
  screening, KYB, transaction monitoring, crypto travel-rule tooling.
- **1:N-ish dedup: yes, but marketed as anti-multi-accounting, not uniqueness.** Sumsub's
  "Multi-Accounting Prevention" uses liveness results to check whether *the user already exists in its
  database*, plus a **Fraud Network Detection** graph over IP, selfie background, location, proof of
  address. https://sumsub.com/multi-accounting/ ; https://sumsub.com/blog/multi-accounting/
  `UNCLEAR:` whether the face-search population is per-client or cross-client. Sumsub's wording ("its
  database") hints cross-client, which would be unusually strong — **this needs a direct answer from
  Sumsub before we credit any Sumsub-rooted credential with uniqueness.** Highest-value question we can
  ask any vendor in this file.
- **Web3 footprint is by far the largest** — see reverse index. Sumsub has deliberately positioned as
  *the* reusable-KYC layer for web3 (idOS consortium seat, Solana Attestation Service, Verax, Chainlink
  ACE, Reown/WalletConnect).
- **Pricing:** no public rate card; third-party comparison sites quote roughly **$0.80–$3.80 per check**
  depending on bundle. Secondary/unreliable: https://primebiometry.com/blog/kyc-pricing-guide-2026
- **Publishes an annual fraud report** used widely as industry data (see deepfake section) — vendor-sourced.

### iProov (UK) — liveness specialist, best public threat telemetry
- **Genuine Presence Assurance (GPA)** — a one-time-biometric flow using controlled illumination
  ("Flashmark") from the device screen; **Liveness Assurance (LA)** — passive, for re-authentication.
  The illumination approach is specifically designed to resist *injection*, not just presentation,
  because the challenge is unpredictable and physically reflected. https://www.iproov.com/liveness-detection
- **Not a document vendor first**; often paired with a separate doc-verification provider.
- **1:N dedup:** `UNCLEAR:` iProov's core products are 1:1/liveness; I found no public 1:N ABIS offering.
- **Operates iSOC**, a monitored security operations centre over live traffic — the source of the
  threat report numbers below. This is the closest thing to real-world attack telemetry in the market,
  and it is still vendor-sourced.
- **Web3 customers:** `UNVERIFIED:` I found **no** confirmed web3/personhood-protocol customer for
  iProov. If a protocol claims "iProov-grade liveness" treat it as unsubstantiated until fingerprinted.

### Persona (US, withpersona.com)
- Configurable orchestration platform: government ID (200+ countries), selfie + liveness, database
  checks, AML screening, and a **Graph** product for link-analysis/duplicate detection across
  identities. Popular because it is self-serve and composable.
- **Crypto footprint:** **Coinbase** names *"Persona Identities, Inc."* in its published third-party
  verification vendor list as a processor of **biometric information**
  (https://www.coinbase.com/legal/privacy/third-party-verification-vendors — 403s to automated fetch;
  **re-read manually**). Persona also markets a crypto vertical and is named around **Chainlink CCID**
  (https://withpersona.com/industry/cryptocurrency — also 403 to automated fetch).
- **Pricing:** free tier ~500 government-ID verifications/month, then per-check custom contracts;
  comparison sites quote ~$2–$5/verification. Secondary: https://primebiometry.com/blog/kyc-pricing-guide-2026
- **Why it matters to us:** if Coinbase's KYC is Persona-rooted, then **Coinbase Verifications** EAS
  attestations and the **Coinbase Stamp** in Gitcoin/Human Passport are Persona-rooted too — a single
  vendor under a credential many aggregators treat as independent.

### Onfido → **Entrust** (UK/US)
- Acquired by **Entrust, completed 2024-04**; folded into "Entrust Identity Security"; the Onfido brand
  is being retired into Entrust product naming.
  https://www.businesswire.com/news/home/20240409800662/en/Entrust-Completes-Acquisition-of-Onfido-Creating-A-New-Era-of-Identity-Centric-Security
- Onfido had itself acquired **Airside** (2024) for a "verify once, share anywhere" reusable-ID play —
  the same reusable-credential thesis as ours, from the incumbent side.
  https://www.entrust.com/company/newsroom/onfido-acquires-airside
- Capabilities: document (OCR + NFC), motion/passive liveness, 1:1 match, "Known Faces"-style repeat
  detection. `UNVERIFIED:` current 1:N product naming post-rebrand.
- **Web3 customers:** `UNVERIFIED:` none confirmed in this pass. Historically common in EU exchanges.
- **Status flag:** brand consolidation means old "Onfido-powered" claims in protocol docs may now be
  stale — check whether the integration still exists.

### Jumio (US/Austria)
- Long-standing document + selfie IDV; **iBeta Level 2 PAD confirmed** (trade-press sourced).
- Strong in regulated exchanges. `UNVERIFIED:` no *personhood-protocol* customer confirmed in this pass.
- Comparison-site pricing ~$1–$5/check. Secondary only.

### Veriff (Estonia)
- Document + selfie IDV, 200+ countries. Publishes pricing openly: **from ~$0.80/verification**
  (Essential, ~$49/mo minimum); real-world spend commonly quoted **$2–$6/session**.
  https://www.vendr.com/marketplace/veriff (secondary, aggregator data)
- Has a cross-customer fraud-signal database ("Veriff has seen this face/document before") — closer to
  rung 6/7 than most, but marketed as fraud prevention, not uniqueness. `UNVERIFIED:` exact scope.

### Incode (US/Mexico)
- One of the few vendors genuinely built around **1:N ABIS-scale dedup** (national-scale elections and
  government deployments). If a protocol needs real uniqueness from a commercial vendor, Incode is a
  plausible choice. `UNVERIFIED:` no confirmed web3 personhood customer found in this pass.

### AU10TIX (Israel)
- Document forensics + **"Serial Fraudster"/repeat-offender detection** across its client network —
  one of the few vendors that explicitly advertises cross-customer linkage.
- `UNVERIFIED:` web3 customers. Worth checking: AU10TIX is a common back-end for social platforms'
  age/identity checks, which sometimes surface as "verified human" claims.

### Trulioo (Canada)
- Primarily **data-source aggregation** (GlobalGateway): match name/DOB/address/ID number against
  authoritative and commercial databases in ~195 countries, plus a document/biometric layer.
- **Evidence class is different**: it proves *a record exists*, not that a human is present. For us
  this is rung ~2 at best, and it is trivially satisfied by stolen PII. Low value in a personhood score.

### Socure (US)
- US-centric identity-graph / fraud risk scoring (Sigma), plus **DocV** document + selfie. Its core
  output is a **probabilistic risk score**, not a binary human/not-human. Beware protocols that
  translate a Socure-style score into a boolean "verified human."

### Regula (Latvia/Lithuania)
- **Component vendor, not a service**: Document Reader SDK — forensic-grade document authentication,
  MRZ, RFID/NFC chip (ICAO 9303) reading, with one of the largest document template databases. Sold as
  an SDK others embed. A protocol running Regula is doing document authentication *itself*, which is
  actually a *better* privacy posture (no third-party data controller) but gives **no liveness and no
  dedup**.

### IDnow (Germany)
- EU/DACH focus; **VideoIdent** (a human agent on a video call — genuinely hard to deepfake at scale in
  2023, meaningfully weaker in 2026), **AutoIdent**, and eID/eIDAS flows. Strong regulatory standing in
  Germany. `UNVERIFIED:` web3 customers.

### Shufti Pro (UK/Pakistan)
- The **price floor**: pay-as-you-go **~$0.20 per check**, free tier ~100 verifications/month.
  https://beverified.org/providers/shufti-pro/ (secondary) ; https://shuftipro.com/
- **Scoring implication:** the existence of a $0.20 KYC check sets a hard ceiling on what any
  KYC-derived personhood credential can be worth. If a protocol's "verified human" costs the protocol
  $0.20 to issue, it costs an attacker roughly that plus a document to obtain one.

### Others encountered
- **ID R&D, Aware, CyberLink FaceMe, Innovatrics, Identy.io, Facia, 1Kosmos** — component/PAD-algorithm
  vendors, several of them the actual top performers in NIST FATE PAD. They appear *inside* other
  vendors' stacks. Relevant only for the certification section.
- **Didit** — newer low-cost entrant explicitly marketing **biometric de-duplication / face search**
  https://didit.me/blog/biometric-de-duplication-preventing-multi-account-fraud-with-face-search/
  `UNVERIFIED:` any web3 customers.

## Certifications that mean something (iBeta PAD / ISO 30107-3, NIST FRVT/FATE)

Short version: **certification tells you a vendor beat *presentation* attacks in a lab in a given
year. It tells you nothing about injection attacks, nothing about 1:N accuracy at scale, and nothing
about whether the integrator turned the feature on.**

### iBeta / ISO-IEC 30107-3
- iBeta Quality Assurance is NVLAP-accredited by NIST for biometric testing and is the de-facto
  certifier. It publishes a public table of solutions that have passed since 2018 — **check the table,
  not the vendor's press release**: https://www.ibeta.com/ (index of approved solutions; see also
  https://idtechwire.com/ibeta-publishes-table-approved-liveness-detection-solutions-050407/).
- **Level 1** = cheap/easy PAIs (printed photo, screen replay). **Level 2** = higher-effort PAIs
  (3D masks, custom silicone, etc.). Both are *presentation* attacks. There is **no ISO Level 3+**;
  vendors advertising "Level 3/4/5" are using in-house scales (FaceTec is the notable case).
- Confirmed Level-2 holders encountered in this research: **Jumio**, **Innovatrics**, **1Kosmos**,
  **Identy.io** (Face SDK v6.3.0), **Facia**; plus 30107-3 certification for **FaceTec**, **ID R&D**,
  **Aware**, **Acuant**. https://idtechwire.com/identy-io-secures-nist-iso-30107-3-level-2-pad-certification/ ;
  https://facia.ai/news/facia-ibeta-level-2-compliant-with-iso-30107-3-presentation-attack-detection-protocols/
  `UNVERIFIED:` I did not open individual iBeta report PDFs; each claim above traces to trade press or
  vendor announcement, and the *tested version number* matters — a 2021 cert on v7 says nothing about
  the v11 SDK a protocol ships in 2026.
- **Certification is per SDK version and per configuration.** Always demand version + date.

### NIST FATE / FRTE
- The relevant NIST programme for liveness is **FATE Part 10: Passive, Software-based PAD**,
  first published as **NISTIR 8491, 2023-09-20**, covering **82 passive PAD algorithms**.
  https://www.nist.gov/publications/face-analysis-technology-evaluation-fate-part-10-performance-passive-software-based ;
  report PDF https://nvlpubs.nist.gov/nistpubs/ir/2023/NIST.IR.8491.pdf ;
  ongoing leaderboard https://pages.nist.gov/frvt/html/frvt_pad.html
- **Important negative finding for our purposes:** the vendors that top NIST PAD are *component*
  algorithm vendors — **ID R&D, Aware, CyberLink FaceMe**, etc. The consumer-facing IDV platforms most
  common in web3 (**FaceTec, iProov, Sumsub, Onfido, Persona, Veriff**) are largely **absent** from NIST
  PAD results, relying on iBeta instead. So for the vendors that actually sit under web3 credentials,
  **there is no independent, continuously-updated accuracy number.** We are trusting vendor marketing.
  `UNCLEAR:` whether any of them submitted to FATE PAD after 2023 — worth re-checking the live
  leaderboard before we publish any scoring weights.
- **1:N accuracy** is measured by **FRTE/FRVT 1:N** (identification), a *separate* track from PAD. None
  of the web3-facing IDV platforms publish an FRVT 1:N ranking either. Since 1:N is the only thing
  that yields uniqueness, this is the largest evidence gap in the whole layer.

## The attribution problem: how to detect which vendor produced a credential

Protocols rarely name their IDV vendor in marketing, and several actively obscure it ("our
proprietary biometric engine"). Ranked by reliability, here is how to unmask one:

**Tier 1 — authoritative, cheap**
1. **The vendor's own customer/case-study pages and press releases.** Vendors need logos far more
   than protocols need to disclose. This produced Galxe→Sumsub, idOS→Sumsub, Civic→FaceTec.
2. **Sub-processor / third-party-vendor disclosures.** GDPR Art. 28 + CCPA make a named
   sub-processor list common and often legally required. Coinbase publishes one at
   `coinbase.com/legal/privacy/third-party-verification-vendors`. **This is the single highest-yield
   artifact and should be checked for every protocol we score.** Note: automated fetching of that
   page 403s — check it in a real browser.
3. **On-chain attester metadata.** EAS / Verax portals carry `ownerName` and owner addresses. The
   Linea PoH V2 portal literally has `ownerName = "Sumsub"`. Free, tamper-evident, and the strongest
   evidence class available to us.

**Tier 2 — technical fingerprinting (do this ourselves, it's the moat)**
4. **Network calls during the verification flow.** Run each protocol's flow with devtools /
   mitmproxy and record hostnames. Distinctive endpoints:
   `api.facetec.com`, `*.facetec.com` (FaceTec Server is usually *self-hosted* by the integrator, so
   expect the integrator's own host — see the Synaps case, where FaceTec runs on Synaps servers and
   emits **no FaceTec-owned domain at all**); `api.sumsub.com` / `in.sumsub.com` /
   `static.sumsub.com` (WebSDK); `api.eu.iproov.com` / `*.iproov.com`; `api.onfido.com` /
   `*.onfido.com`; `withpersona.com/widget`; `*.veriff.me` / `magic.veriff.me`;
   `*.incode.id` / `demo.incode.id`; `*.jumio.com` / `netverify.com`; `*.shuftipro.com`;
   `*.au10tixservicesprod.com`. `UNVERIFIED:` these hostnames are from general familiarity with the
   SDKs — **verify each against live docs before relying on it**; do not treat this list as sourced.
5. **JS bundle strings.** Web SDK global names and CSS class prefixes are highly distinctive
   (FaceTec ships `FaceTecSDK` / `FaceTecStrings` / a `zoom-`-prefixed legacy namespace; Sumsub ships
   `SumsubWebSdk` / `idensic`; Persona ships `Persona.Client`; Onfido ships `Onfido.init`).
   `UNVERIFIED:` same caveat — spot-check before publishing.
6. **Mobile SDK fingerprints.** Unzip the APK and grep for vendor packages/assets:
   FaceTec ships `FaceTecSDK.framework` / `com.facetec.sdk` plus a large `FaceTec_*` asset bundle;
   Sumsub ships `com.sumsub.sns`; iProov ships `com.iproov.sdk`; Incode `com.incode.welcome_sdk`;
   Veriff `com.veriff.sdk`. This is the technique most likely to crack **Humanity Protocol**.
7. **Certificate transparency / DNS.** `crt.sh` for subdomains like `kyc.<protocol>.tld`,
   `verify.<protocol>.tld`, and CNAMEs pointing at vendor infrastructure.
8. **Job listings and LinkedIn.** "Experience with Sumsub/Onfido integrations" in a protocol's
   backend JD is weak but real signal.

### The Humanity Protocol case — still open, and it matters most
Humanity Protocol's own `hp-configuration` endpoint defines `is_human` as *"passed a KYC check **OR**
palm enrollment"*, with `kyc_passed` "derived from provider results" — i.e. **a Humanity "human" may
be nothing but a third-party KYC pass, with no palm biometric and therefore no uniqueness claim at
all**. They do not name the provider.

What I checked and found nothing:
- `https://www.humanity.org/privacy-policy` — collects *"Biometric Data (such as palmprint and vein
  image) collected through a hardware"*, has a GDPR section (§12), but names **no** sub-processors,
  **no** Art. 9 lawful-basis statement, and **no** BIPA language. Retrieved 2026-07-24. That absence
  is itself notable (see data-protection section).
- Their public docs and 2025-26 press coverage name only **Mastercard** (Open Finance / financial
  attributes, Nov 2025) and **Prenetics/CircleDNA** (genomics "Identity Validator", Feb 2025) — neither
  is a document/liveness IDV vendor.
  https://www.biometricupdate.com/202511/humanity-protocols-reusable-biometric-id-adds-mastercard-open-finance-capability ;
  https://www.biometricupdate.com/202502/humanity-protocol-partners-with-genomics-firm-on-blockchain-based-idv
- Note also: Humanity **pivoted away from "Proof-of-Personhood" to "Proof-of-Trust"** (Feb 2026) while
  keeping palm biometrics, and claims >8M Human IDs issued — with no published dedup methodology.
  https://www.biometricupdate.com/202602/humanity-protocol-pivots-from-proof-of-personhood-but-sticks-with-palm-biometrics

**Next actions to close it (in order):** (a) pull the Android APK of the Humanity app and grep for
vendor SDK package names; (b) run the KYC flow with a proxy and log hostnames; (c) request their DPA
/ sub-processor list directly — as a prospective integrator we can just ask, and under GDPR Art. 28
they should have one; (d) check any Mastercard press material, which sometimes names the underlying
IDV chain.

## Reverse index: vendor -> known web3 customers

*(building incrementally; each row needs a citation)*

| Vendor | Web3 customer | Evidence | Confidence |
|---|---|---|---|
| FaceTec | **Civic** (Civic Pass / "Proof of Personhood") | Civic publicly integrated FaceTec 3D Liveness + face matching in late 2023; Proof of Personhood product built on it. https://www.biometricupdate.com/202310/civic-introduces-proof-of-personhood-with-facetec-biometrics-and-liveness and https://www.biometricupdate.com/202412/civic-launches-tool-to-ease-web3-onboarding-and-sign-ins | **Confirmed** (trade press + vendor) |
| Sumsub | **idOS** (idOS Consortium member + governance committee) | https://financefeeds.com/reusable-kyc-comes-to-web3-as-sumsub-joins-idos-consortium/ ; https://idtechwire.com/sumsub-joins-idos-consortium-to-advance-reusable-identity-for-web3/ | **Confirmed** (press release) |
| Sumsub | **Solana Attestation Service**, **Linea / Verax**, **Chainlink ACE** on-chain attestations | https://ffnews.com/newsarticle/fintech/sumsub-on-chain-identity-attestations-verax/ ; https://www.prnewswire.com/news-releases/sumsub-partners-with-chainlink-to-power-cross-chain-identity-for-on-chain-compliance-302762707.html ; https://idtechwire.com/sumsub-launches-reusable-digital-id-verification-on-solana-blockchain/ | **Confirmed** (press release) |
| Sumsub | **Reown** (WalletConnect) — 450+ wallet providers via one SDK | https://reown.com/blog/how-sumsub-leveraged-reown-authentication-to-expand-compliance-offering | Confirmed (Reown case study) |
| Sumsub | **Galxe Passport v3** | Galxe Passport V3 launched with Sumsub as the KYC engine (Chainwire PR, 2025-05-06): https://www.barchart.com/story/news/32238122/galxe-launches-passport-v3-with-sumsub-to-supercharge-web3-onboarding ; Galxe help centre confirms "Sumsub, a trusted third-party KYC provider" https://help.galxe.com/en/articles/9424571-introducing-galxe-passport | **Confirmed** |
| Sumsub | **Linea Proof of Humanity V2** | Verax portal `0xe8a3a57e84a27d55e37116af4681abd461b73922` has `ownerName` = "Sumsub"; attester `0xc5db96c1348041c56e455d4cc92bb46027831c0d`; schema `0x39d0…d23f`. Registers `modules: []` — **no on-chain validation whatsoever**, the attestation is a bare Sumsub say-so. (Sourced from the on-chain agent in this research set.) | **Confirmed (on-chain)** |
| **Synaps** (itself a reseller) | **Anima Protocol** (`AnimaProofOfUniqueness` on Verax) | Synaps *is* Anima's operator — Synaps launched Anima Protocol in 2022: https://www.globenewswire.com/news-release/2022/04/12/2421095/0/en/Synaps-Launches-Novel-Decentralized-Identity-Solution-Anima-Protocol-In-Partnership-with-Aleph-im.html | **Confirmed** |
| **FaceTec (via Synaps)** | **Anima Protocol**, **Linea/Privado ID/Billions "Proof of Uniqueness"** | Synaps states it "employs … FaceTec" for liveness, **self-hosted on Synaps' own servers**: https://medium.com/@anima_protocol/inside-proof-of-personhood-cde68ec84784 . The Linea private biometric PoU is Synaps + Verax + Privado ID: https://billions.network/blog/first-private-biometric-proof-of-uniqueness-on-linea-blockchain | **Confirmed → this is the big collapse** |
| FaceTec (via Synaps) | **Verida** (Synaps partnership for private IDV) | https://www.linkedin.com/posts/synaps-id_synaps-verida-team-up-for-private-identity-activity-7131307885204004864-7dtw | Likely (LinkedIn/vendor post) |
| **Persona** | **Coinbase** (biometric collection vendor) | Coinbase's own *Third Party Identity Verification Service Vendors* disclosure names **Persona** as the vendor that "collect[s] and process[es] biometric information to verify identity, identify fraud, and improve Persona's platform." Same page also names **Unico** (Brazil users) and **Refinitiv** (facial recognition / biometric verification). https://www.coinbase.com/legal/privacy/third-party-verification-vendors (page 403s to automated fetch; text confirmed via Coinbase-domain-restricted search index, 2026-07-24) | **Confirmed** (issuer's own legal disclosure) |
| Unico | **Coinbase** (Brazil) | same page | Confirmed |
| Refinitiv (LSEG) | **Coinbase** (facial recognition / biometric verification) | same page | Confirmed |
| Persona | **Chainlink CCID / ACE** (named partner) | https://withpersona.com/industry/cryptocurrency (403 to automated fetch; surfaced via search index) | Likely, needs manual re-read |
| **Fractal ID** (itself an IDV operator) | **Polygon ID, Ripple/XRP Ledger, Avalanche, Gnosis, Near, Aurora, Acala, Polymath, BNB Chain, Lukso, Aleph Zero, Arbitrum Foundation, idOS** | Customer list surfaced by the July-2024 breach disclosures: https://cryptoslate.com/web3-kyc-vendor-fractal-id-loses-over-50k-users-passport-info-in-data-breach/ ; https://cointelegraph.com/news/blockchain-identity-platform-fractal-id-suffers-data-breach ; https://www.biometricupdate.com/202407/data-breach-raises-questions-about-fractal-ids-decentralized-identity-architecture | **Confirmed** (breach notice — an unusually reliable customer list) |
| Prenetics / CircleDNA (genomics, not IDV) | **Humanity Protocol** ("Identity Validator") | https://www.biometricupdate.com/202502/humanity-protocol-partners-with-genomics-firm-on-blockchain-based-idv | Confirmed, but not a liveness/doc vendor |
| Mastercard (Open Finance — financial attributes, not IDV) | **Humanity Protocol** | https://www.biometricupdate.com/202511/humanity-protocols-reusable-biometric-id-adds-mastercard-open-finance-capability | Confirmed, but not a liveness/doc vendor |
| **UNKNOWN** | **Humanity Protocol** `kyc_passed` | Their API defines `is_human` = "passed a KYC check OR palm enrollment", `kyc_passed` "derived from provider results"; provider unnamed; privacy policy names no sub-processor (checked 2026-07-24). | `UNVERIFIED:` **highest-value open item** — see attribution section for how to crack it |
| **In-house (no third-party vendor found)** | **World / Worldcoin** — Orb iris capture, and the World ID **Passport Credential** (NFC chip read on device) | https://www.biometricupdate.com/202412/world-id-keeps-growing-with-passport-credential-option ; https://support.world.org/hc/en-us/articles/34408020222099-What-are-World-ID-Credentials-and-how-do-I-use-them | Likely in-house; `UNVERIFIED:` whether a commercial NFC/doc SDK (e.g. Regula) is embedded in the World App — **grep the APK** |

### Interpreting this table
- **Two dedup buckets are already forced.** Anything Sumsub-rooted is one bucket; anything
  FaceTec/Synaps-rooted is another. Within a bucket, credentials are **correlated, not independent**.
- **Fractal ID's customer list is the single best-sourced vendor→web3 mapping in existence**, precisely
  because a breach notice has to be honest about who was affected. Look for equivalents.
- Do not read absence from this table as absence of a vendor. Most protocols simply don't say.


## The 2025-2026 deepfake / injection reality

**Bottom line: in 2026 a "liveness check" is a cost-imposition on the attacker, not a proof.** The
attack surface moved from *presentation* (hold a photo/mask to a camera — which PAD handles well) to
*injection* (bypass the camera entirely and feed a synthetic stream into the SDK), which PAD by
construction cannot see. iBeta PAD certification tests presentation attacks only.

- **iProov Threat Intelligence Report 2026** (published 2026-04, data from iProov's own iSOC —
  **vendor-sourced, treat as directional**):
  - **+741% year-over-year increase in iOS injection attacks** across 2025; H1 2025 was only +14%,
    but H2 2025 was **+1,151%** vs. H2 2024. The mobile platform that integrators assumed was the
    "hard" target (locked-down iOS camera stack) is the one that broke.
  - iProov frames this as the **"industrialisation"** of techniques previously limited to
    experimental/state-sponsored actors — now repeatable, packaged playbooks.
  - Deepfakes spreading from IDV flows into general corporate video workflows; image-to-video
    generation is collapsing the source material needed to build a synthetic identity.
  - https://www.iproov.com/reports/threat-intelligence-report-2026 ;
    https://www.businesswire.com/news/home/20260408812610/en/iProov-Issues-Annual-Threat-Intelligence-Report ;
    https://www.biometricupdate.com/202604/biometric-injection-attack-surge-spreads-to-ios-iproov-report
- Third-party corroboration of the deepfake wave (not IDV-specific): **Ponemon** — 41% of orgs have
  seen deepfake attacks targeting executives; **Gartner (Sept 2025)** — 37% of security leaders have
  encountered deepfake incidents on video calls. (Cited via the iProov coverage above; I did not
  retrieve the primary Ponemon/Gartner documents. `UNVERIFIED:` primary sources.)
- **Sumsub Identity Fraud Report 2025-2026** (vendor-sourced, n = 4M+ fraud attempts):
  - Global fraud rate **2.2%**; **crypto sector 2.2%**, financial services 2.7%.
  - **Deepfake incidents in crypto rose 654% from 2023 to 2024.**
  - Deepfakes are **11%** of top first-party fraud schemes (i.e. the real person is the fraudster).
  - Sumsub names crypto as the preferred target for *high-sophistication* attacks specifically
    because of fast account opening, high limits, pseudonymity and historically weak KYC.
  - https://sumsub.com/fraud-report-2025/ ;
    https://sumsub.com/newsroom/sumsubs-annual-report-fraud-shifts-to-complex-multi-step-schemes-in-2025-agentic-ai-scams-poised-to-surge-in-2026/
- **What this means for our score.** A liveness-only credential issued in 2023-2024 was worth more
  than one issued in 2026 under the same vendor, because the attacker's cost fell. Any credential we
  ingest that resolves to "passed a liveness check at time T" should be **decayed by vendor-era**, not
  just by age. And a liveness credential with no 1:N dedup behind it contributes **zero uniqueness**
  — it is at best a bot filter.

## The document-farm supply side (what it costs to defeat)

This is how we price the credential: **a credential is worth at most what it costs an attacker to
manufacture one.**

| Attack input | Reported cost | Source |
|---|---|---|
| AI-generated fake ID document image (OnlyFake-style service) | **~$15 each** | https://hackread.com/dark-web-operation-entirely-focused-on-kyc-bypass/ and coverage of OnlyFake; originally surfaced by 404 Media (2024). Secondary. |
| Forged physical Caribbean passport | **~$10,000** (2024) | Same coverage; note it was detected in ~20s by an exchange's MRZ/chip cross-check — i.e. the expensive forgery is the *worse* buy against chip-reading vendors. |
| **Genuine document + matching selfie/video, sold voluntarily by the real person** | price not disclosed in the reporting I found; described as "compensated participation," concentrated in **LATAM and Eastern Europe** | iProov dark-web investigation, Jan 2025: https://hackread.com/dark-web-operation-entirely-focused-on-kyc-bypass/ ; https://idtechwire.com/dark-web-operation-discovered-farming-biometric-data-to-bypass-kyc-systems/ `UNCLEAR:` per-identity price. |

**The critical structural point — "genuine-but-rented" identity.** iProov's investigation found a
dark-web operation whose entire product is *legitimately obtained* documents plus matching facial
imagery, acquired by paying real people for their identity. Against this input:
- document authenticity checks pass (the document is real);
- chip/NFC checks pass (the chip is real);
- 1:1 face match passes (the face is the document holder's);
- **liveness passes, because a real human really is present.**

Only **1:N dedup against the issuer's own enrolled population** catches it — and only if the same
human is re-sold twice into the same population. Against a farm with many distinct sellers, 1:N does
not catch it either. **This is the ceiling on what any KYC-derived personhood credential can prove:
it proves a human, not *this* human, and not *only once* across protocols.**

iProov's attack-tier taxonomy (useful for our scoring language):
1. **Basic** — static images / printed photos. Defeated by any iBeta L1/L2 PAD.
2. **Intermediate** — real-time face-swap and off-the-shelf deepfake software.
3. **Advanced** — custom AI models generating synthetic faces that *respond to liveness challenges*
   in real time.
Tier 3 plus camera injection is the 2026 state of the art, and it is what the +741% number is
measuring.

## Data-protection exposure (GDPR Art. 9, BIPA, Fractal ID precedent)

**Read this before designing the embedded flow. It constrains the product more than anything else in
this file.**

### GDPR
- Face/palm/vein templates used to *uniquely identify* a person are **Art. 9 special-category data**.
  Lawful basis is effectively limited to **explicit consent** (Art. 9(2)(a)) for a consumer product —
  and consent must be freely given, which is legally awkward when the verification is a gate on access.
- The exposure question is **controller vs. processor vs. joint controller**. If our aggregator merely
  *links out* to a protocol which then runs its own vendor flow, we are plausibly outside the biometric
  processing entirely. If we **embed** the flow, choose the vendor, or determine the purpose of
  processing, we risk being a **joint controller** (Art. 26) — which drags in DPIA obligations
  (Art. 35, mandatory for large-scale Art. 9 processing), Art. 28 processor contracts, a sub-processor
  register, and breach-notification duty.
- **Design implication (strong recommendation):** architect so that **we never receive, store or route
  raw biometrics or document images**. Ingest only *assertions* (attestations, VCs, signed booleans)
  produced by someone else's flow. If we must host an embedded flow, host it as a redirect/iframe where
  the protocol or vendor is the controller and we are explicitly not.

### BIPA (Illinois) — and its 2026 update, which materially changes the risk
- BIPA gives a **private right of action**, statutory damages **$1,000 negligent / $5,000
  reckless-or-intentional**, and requires written notice + written release before collecting biometric
  identifiers. It is the reason many vendors geofence Illinois.
- **Cothron v. White Castle** (Ill. 2023) held claims accrue **per scan**, producing "annihilative"
  exposure. The Illinois legislature amended BIPA in **August 2024** to make repeated collection of the
  same person by the same method **one violation**.
- **2026-04-01: the Seventh Circuit held the 2024 amendment applies retroactively**, ending per-scan
  exposure in pending cases. https://www.foley.com/insights/publications/2026/04/bipa-alert-seventh-circuit-ruling-applies-bipa-amendments-retroactively-ending-per-scan-exposure-for-companies-operating-in-illinois/ ;
  https://privacymatters.dlapiper.com/2026/04/seventh-circuit-holds-bipas-2024-damages-amendment-applies-retroactively/ ;
  https://www.biometricupdate.com/202604/bipa-damage-limitation-applies-retroactively-to-pending-class-actions-court
- **Net for us:** BIPA is now a *per-user*, not per-scan, risk. Still material at aggregator scale
  ($1,000 × affected Illinois users), but no longer existential. Texas CUBI and Washington HB 1493 are
  the other US statutes; Texas has **no** private right of action but AG enforcement has been active.
  `UNVERIFIED:` current Texas AG posture in 2026.

### The Fractal ID precedent — the exact failure mode we should fear
- **2024-07-14**: an unauthorised party obtained an **operator account** and ran an API script that
  exfiltrated user data over ~2h14m (05:14–07:29 UTC).
- **Exposed:** names, emails, **wallet addresses**, phone numbers, physical addresses, **facial images
  and uploaded ID documents (passports, driving licences)**.
- **Scale is disputed in the reporting:** Fractal's own accounting was ~**5,000–6,300 users of 1.1M**
  (~0.5%) per https://www.biometricupdate.com/202407/data-breach-raises-questions-about-fractal-ids-decentralized-identity-architecture ;
  contemporaneous coverage reported **>50,000** users' passport info
  (https://cryptoslate.com/web3-kyc-vendor-fractal-id-loses-over-50k-users-passport-info-in-data-breach/ ;
  https://cointelegraph.com/news/blockchain-identity-platform-fractal-id-suffers-data-breach). Flag the
  discrepancy; do not cite a single number.
- **Downstream blast radius:** Fractal ID served **Polygon ID, Ripple/XRP Ledger, Avalanche, Gnosis,
  Near, Aurora, Acala, Polymath, BNB Chain, Lukso, Aleph Zero, Arbitrum Foundation** and is a building
  partner of **idOS**. One vendor compromise leaked users of a dozen "decentralized" ecosystems at once
  — **the exact concentration risk this file is about, realised.**
- **In Oct 2024 the Stormous ransomware group claimed 10GB+ of Fractal customer data**
  https://www.cyberdaily.au/security/11251-exclusive-stormous-ransomware-claims-hack-of-blockchain-identity-firm-fractal-id
  `UNVERIFIED:` whether that claim was substantiated.
- **The architectural lesson:** Fractal marketed "selective data access and revocation at a user level"
  while a **single operator credential** unlocked bulk export. Decentralised branding, centralised
  honeypot. Assume the same is true of every protocol in our set until proven otherwise.
- **Also note what wasn't there:** Humanity Protocol's privacy policy (retrieved 2026-07-24) collects
  palmprint **and vein images**, states data may be transferred to "our service providers' servers" and
  used to train ML models, names **no sub-processor**, gives **no Art. 9 lawful-basis statement**, and
  contains **no BIPA notice/release language**. For a product processing raw vein imagery at 8M-user
  scale, that is a conspicuous gap. https://www.humanity.org/privacy-policy

## Trust-root dedup table

**How to use this:** protocols sharing a row share evidence. In an aggregate score, apply the row's
weight **once**, not once per protocol. Rungs refer to the taxonomy table above.

| Trust root (vendor) | Evidence class it actually produces | Rung | Protocols known / suspected to sit on it | Confidence |
|---|---|---|---|---|
| **Sumsub** | document (OCR + NFC) + passive liveness + 1:1 match + AML screening. Multi-account/face-search dedup **exists but scope unconfirmed** | 2/4/5, possibly 6 | **Galxe Passport v3**; **Linea Proof of Humanity V2** (Verax portal `0xe8a3…3922`, `ownerName` "Sumsub", attester `0xc5db…1c0d`, `modules: []` = **no on-chain validation**); **idOS** (consortium + governance seat); **Solana Attestation Service** Sumsub attestations; **Chainlink ACE / CCID**; **Reown/WalletConnect** wallet KYC | Confirmed |
| **FaceTec** (via **Synaps**, self-hosted) | 3D FaceMap liveness + 1:1 match; dedup by FaceGraph comparison, **population scope unconfirmed** | 3/4/5, possibly 6 | **Anima Protocol** `AnimaProofOfUniqueness`; **Linea / Privado ID / Billions "private biometric Proof of Uniqueness"**; **Verida** (Synaps partnership) | Confirmed (vendor named by Synaps/Anima) |
| **FaceTec** (direct) | same, plus OCR/NFC document | 1/2/3/4/5, 6 if `3d-db` dedup enabled | **Civic** — Civic Pass / "Proof of Personhood" | Confirmed |
| **Persona** (+ Unico in BR, Refinitiv) | document + selfie/liveness + database checks + Graph link-analysis | 1/2/4/5, partial 6 | **Coinbase** biometric processing → therefore, transitively, **Coinbase Verifications** EAS attestations (720,503 lifetime, 406,022 revoked) and the **Coinbase Stamp** in Gitcoin/Human Passport; **Chainlink CCID** | **Confirmed** by Coinbase's own vendor disclosure (2026-07-24). Note the ~56% revocation rate on Coinbase Verifications is a separate signal-quality problem, not a vendor problem |
| **Fractal ID** (operator, own stack + unknown sub-vendors) | document + selfie KYC, centrally stored | 1/2/5 | **Polygon ID, Ripple/XRPL, Avalanche, Gnosis, Near, Aurora, Acala, Polymath, BNB Chain, Lukso, Aleph Zero, Arbitrum Foundation, idOS** | Confirmed via breach disclosure |
| **UNKNOWN KYC provider** | whatever it is, it is sufficient to set `kyc_passed` → `is_human` **without any palm enrollment** | ≤5 — **no uniqueness** | **Humanity Protocol** | `UNVERIFIED:` provider identity. **Until resolved, treat Humanity `is_human` as a liveness/KYC signal, not a uniqueness signal**, and treat it as potentially correlated with *any* of the above buckets |
| **In-house biometrics (no commercial IDV vendor)** | iris (Orb) with genuine large-scale 1:N; passport NFC credential | 2 + 6 (real) | **World / Worldcoin** | Likely; `UNVERIFIED:` embedded doc-SDK identity |
| **No vendor at all** | social graph / Turing test / video + vouching | n/a — different evidence class entirely, **safe to count independently** | Proof of Humanity, BrightID, Idena, and other non-KYC protocols | n/a |

### Suspicions to run down (all `UNVERIFIED:`)
1. `UNVERIFIED:` **Humanity Protocol → Sumsub or Persona.** Would be confirmed by: an APK grep for
   `com.sumsub.sns` / Persona widget strings; a proxied verification flow showing `api.sumsub.com` or
   `withpersona.com`; or a sub-processor list obtained by asking them as a prospective integrator.
2. `UNVERIFIED:` **Anima PoU and Linea/Billions PoU share one FaceGraph population.** Would be
   confirmed by enrolling the same face in both and seeing whether the second rejects as duplicate —
   a cheap, decisive experiment we can run ourselves.
3. `UNVERIFIED:` **Sumsub's face-search dedup is cross-client.** Would be confirmed by Sumsub's own
   documentation/DPA, or by the same two-account experiment across two Sumsub-rooted protocols
   (e.g. Galxe Passport and Linea PoH V2). **If it *is* cross-client, Sumsub-rooted credentials
   collapse to a single global uniqueness set — which is simultaneously the strongest and the most
   concentrated result in this whole landscape.**
4. ~~`UNVERIFIED:` **Coinbase → Persona.**~~ **RESOLVED 2026-07-24** — Coinbase's own legal disclosure
   names Persona (biometrics), Unico (Brazil) and Refinitiv. Remaining sub-question: does Coinbase run
   1:N face dedup across its own user base? If yes, Coinbase Verifications is a genuine uniqueness
   signal within Coinbase's population; if no, it is KYC-grade liveness only. `UNVERIFIED:`
5. `UNVERIFIED:` **World App embeds a commercial document-reading SDK** (Regula is the most likely).
   Confirmed by APK inspection.

### The decisive experiment
Most of the above collapses can be settled empirically and cheaply: **enroll one real identity across
N protocols and observe which ones reject the second enrollment.** That single test measures the thing
we actually need — whether these credentials are independent — better than any amount of vendor
documentation. Budget for it.

## Direct answer: can we consume any of this as a credential?

**No — with one narrow, conditional exception.**

1. **These vendors do not issue credentials to third parties.** Sumsub, FaceTec, Persona, iProov et al.
   return a result **to their paying integrator**, under contract. There is no public verification
   endpoint, no signed artifact a user can carry to us, and no way for us to verify a claim without the
   integrator's cooperation. They fail BRIEF.md criterion 4 ("can we verify *without* the vendor's
   cooperation") completely. **They are upstream dependencies of other people's credentials.**
2. **Therefore this file is not an integration target — it is a scoring and dedup input.** Its output is
   (a) the dedup buckets above, and (b) a discount factor on any credential that resolves to a vendor
   check.
3. **The narrow exception — becoming a vendor customer ourselves.** We could sign with one vendor
   (Shufti at ~$0.20/check as a floor, Sumsub/Persona at ~$1–$3 for quality) and offer our *own*
   verification as a fallback tier when a user holds no protocol credential. This is a real product
   option, but it is a *different business*: we become a data controller for Art. 9 biometrics, inherit
   BIPA/GDPR exposure and Fractal-ID-shaped breach risk, and — crucially — **we would be adding an
   Nth correlated copy of exactly the evidence we're trying to deduplicate.** Recommend: not in v1.
4. **The one artifact that could in principle be user-presentable** is FaceTec's **UR Code** (digitally
   signed, contains biometric data, designed for offline presentation). If any protocol issues UR
   Codes, we could verify one without the issuer being online. `UNVERIFIED:` whether any web3 protocol
   actually issues them, and whether verification requires a FaceTec licence.

## Open questions for us

1. **Who is Humanity Protocol's KYC provider?** Blocks correct scoring of an 8M-user protocol.
2. **Is Sumsub's dedup per-client or cross-client?** Determines whether four Sumsub-rooted credentials
   are four signals or one.
3. **Is the Synaps FaceGraph population shared across Anima and Linea/Billions PoU?** Same question,
   different bucket.
4. **Does Coinbase run 1:N dedup across its own users?** (Vendor is settled — Persona.) Determines
   whether Coinbase Verifications is uniqueness or just liveness+KYC.
5. **Which protocols enable 1:N dedup at all?** Absent this, most "proof of personhood" branding on
   vendor-rooted protocols is liveness with a marketing layer.
6. **Legal:** can we structure the embedded flow so we are never a controller/joint controller for
   Art. 9 data? Needs a lawyer before the flow is designed, not after.
7. **Vendor-era decay:** what discount curve should a liveness credential get given the +741% injection
   trend? Needs a decision, not more research.

## References

**Vendor primary**
- FaceTec product page — https://www.facetec.com/ (retrieved 2026-07-24)
- FaceTec 1:N Search / ABIS — https://dev.facetec.com/1-to-n-search
- FaceTec Server dedup & fraud-list guide — https://dev.facetec.com/technical-support-server-sdk-guides-fraud-deduplication
- FaceTec configuration options — https://dev.facetec.com/configuration-options
- iProov liveness products — https://www.iproov.com/liveness-detection
- iProov Threat Intelligence Report 2026 — https://www.iproov.com/reports/threat-intelligence-report-2026
- iProov press release (2026-04-08) — https://www.businesswire.com/news/home/20260408812610/en/iProov-Issues-Annual-Threat-Intelligence-Report
- Sumsub multi-accounting prevention — https://sumsub.com/multi-accounting/ ; https://sumsub.com/blog/multi-accounting/
- Sumsub Identity Fraud Report 2025-2026 — https://sumsub.com/fraud-report-2025/
- Sumsub AI fake ID analysis — https://sumsub.com/blog/ai-fake-id-challenge-for-kyc/
- Persona crypto vertical — https://withpersona.com/industry/cryptocurrency (403 to automated fetch)
- Coinbase third-party verification vendors — https://www.coinbase.com/legal/privacy/third-party-verification-vendors (403 to automated fetch; **read manually**)
- Humanity Protocol privacy policy — https://www.humanity.org/privacy-policy (retrieved 2026-07-24)
- Shufti Pro — https://shuftipro.com/
- Anima Protocol, "Inside Proof of Personhood" — https://medium.com/@anima_protocol/inside-proof-of-personhood-cde68ec84784
- Billions Network, Linea private biometric PoU — https://billions.network/blog/first-private-biometric-proof-of-uniqueness-on-linea-blockchain
- Synaps launches Anima (2022) — https://www.globenewswire.com/news-release/2022/04/12/2421095/0/en/Synaps-Launches-Novel-Decentralized-Identity-Solution-Anima-Protocol-In-Partnership-with-Aleph-im.html

**Standards / independent testing**
- NIST FATE Part 10 (PAD), NISTIR 8491, 2023-09-20 — https://www.nist.gov/publications/face-analysis-technology-evaluation-fate-part-10-performance-passive-software-based ; PDF https://nvlpubs.nist.gov/nistpubs/ir/2023/NIST.IR.8491.pdf
- NIST FATE PAD leaderboard — https://pages.nist.gov/frvt/html/frvt_pad.html
- iBeta approved-solutions table coverage — https://idtechwire.com/ibeta-publishes-table-approved-liveness-detection-solutions-050407/
- Identy.io ISO 30107-3 L2 — https://idtechwire.com/identy-io-secures-nist-iso-30107-3-level-2-pad-certification/
- Facia iBeta L2 — https://facia.ai/news/facia-ibeta-level-2-compliant-with-iso-30107-3-presentation-attack-detection-protocols/

**Attacks / supply side (secondary)**
- iProov dark-web KYC-bypass operation — https://hackread.com/dark-web-operation-entirely-focused-on-kyc-bypass/ ; https://idtechwire.com/dark-web-operation-discovered-farming-biometric-data-to-bypass-kyc-systems/ ; https://www.technadu.com/research-unmasked-identity-fraud-operation-on-dark-web-to-bypass-kyc-systems/562939/
- iOS injection surge coverage — https://www.biometricupdate.com/202604/biometric-injection-attack-surge-spreads-to-ios-iproov-report ; https://www.intelligentciso.com/2026/04/08/ios-injection-attacks-increase-741-in-2025-as-new-report-reveals-true-scale-of-genai-threats/

**Breach / legal**
- Fractal ID breach analysis — https://www.biometricupdate.com/202407/data-breach-raises-questions-about-fractal-ids-decentralized-identity-architecture
- Fractal ID breach coverage — https://cryptoslate.com/web3-kyc-vendor-fractal-id-loses-over-50k-users-passport-info-in-data-breach/ ; https://cointelegraph.com/news/blockchain-identity-platform-fractal-id-suffers-data-breach
- Stormous ransomware claim — https://www.cyberdaily.au/security/11251-exclusive-stormous-ransomware-claims-hack-of-blockchain-identity-firm-fractal-id
- BIPA 2024 amendment retroactive (7th Cir., 2026-04-01) — https://www.foley.com/insights/publications/2026/04/bipa-alert-seventh-circuit-ruling-applies-bipa-amendments-retroactively-ending-per-scan-exposure-for-companies-operating-in-illinois/ ; https://privacymatters.dlapiper.com/2026/04/seventh-circuit-holds-bipas-2024-damages-amendment-applies-retroactively/ ; https://www.biometricupdate.com/202604/bipa-damage-limitation-applies-retroactively-to-pending-class-actions-court
- Entrust completes Onfido acquisition (2024-04) — https://www.businesswire.com/news/home/20240409800662/en/Entrust-Completes-Acquisition-of-Onfido-Creating-A-New-Era-of-Identity-Centric-Security

**Web3 vendor attributions**
- Civic + FaceTec — https://www.biometricupdate.com/202310/civic-introduces-proof-of-personhood-with-facetec-biometrics-and-liveness ; https://www.biometricupdate.com/202412/civic-launches-tool-to-ease-web3-onboarding-and-sign-ins
- Galxe Passport v3 + Sumsub — https://www.barchart.com/story/news/32238122/galxe-launches-passport-v3-with-sumsub-to-supercharge-web3-onboarding ; https://help.galxe.com/en/articles/9424571-introducing-galxe-passport
- Sumsub + idOS — https://financefeeds.com/reusable-kyc-comes-to-web3-as-sumsub-joins-idos-consortium/ ; https://idtechwire.com/sumsub-joins-idos-consortium-to-advance-reusable-identity-for-web3/
- Sumsub + Verax/Linea — https://ffnews.com/newsarticle/fintech/sumsub-on-chain-identity-attestations-verax/
- Sumsub + Chainlink ACE — https://www.prnewswire.com/news-releases/sumsub-partners-with-chainlink-to-power-cross-chain-identity-for-on-chain-compliance-302762707.html
- Sumsub + Solana Attestation Service — https://idtechwire.com/sumsub-launches-reusable-digital-id-verification-on-solana-blockchain/
- Humanity Protocol pivot to Proof-of-Trust — https://www.biometricupdate.com/202602/humanity-protocol-pivots-from-proof-of-personhood-but-sticks-with-palm-biometrics
- Humanity + Mastercard — https://www.biometricupdate.com/202511/humanity-protocols-reusable-biometric-id-adds-mastercard-open-finance-capability
- Humanity + Prenetics/CircleDNA — https://www.biometricupdate.com/202502/humanity-protocol-partners-with-genomics-firm-on-blockchain-based-idv
- World ID passport credential — https://www.biometricupdate.com/202412/world-id-keeps-growing-with-passport-credential-option

**Pricing (secondary / aggregator sites — treat as indicative only)**
- https://primebiometry.com/blog/kyc-pricing-guide-2026 (KYC pricing $0.55–$3/check)
- https://www.vendr.com/marketplace/veriff (Veriff from ~$0.80/verification; $2–6 typical)
- https://beverified.org/providers/shufti-pro/ (Shufti PAYG ~$0.20/check)

