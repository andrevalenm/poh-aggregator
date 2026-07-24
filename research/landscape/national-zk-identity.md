# National digital identity systems & state-led ZK/privacy identity (ex-EU)

> STATUS: in progress — started 2026-07-24. Whatever is here is already usable.

**One-liner:** State identity is the largest personhood root on earth (~5.5bn people with some
digital ID), but it is almost universally gated behind accredited-relying-party regimes, so a
permissionless verifier can consume almost none of it.
**Category:** state-identity
**Chains:** mostly none (Web2 federated). Exceptions: Buenos Aires QuarkID (zkSync Era / Polygon),
Bhutan NDI (Hyperledger-based), Anon Aadhaar (EVM, covered by another agent).
**Status (2026-07):** TBD
**Aggregator verdict:** TBD

Cross-references (do not duplicate):
- EU eIDAS 2.0 / EUDI Wallet → `eidas2-eudi-wallet.md`
- ISO 18013-5/-7 mdoc/mDL → (separate agent's file)
- Anon Aadhaar ZK tooling → protocols/ (separate agent). This file covers the *Aadhaar system*.

## System-by-system

### India — Aadhaar

**What it is.** A 12-digit random number issued by UIDAI (Unique Identification Authority of India)
against a de-duplicated biometric enrolment (10 fingerprints + 2 iris + face). It is *by
construction* a uniqueness system: enrolment runs a 1:N biometric de-duplication against the entire
database before a number is issued. This is the only system in this file whose design goal is
literally "one number per living human."

**Scale (2026-07).**
- Cumulative authentication transactions: **177,592,055,110** (~177.6bn) per the UIDAI Aadhaar
  Dashboard — of which ~124.9bn biometric (118.3bn fingerprint, 2.10bn iris, 4.46bn face),
  ~33.4bn demographic, ~19.4bn OTP. https://uidai.gov.in/aadhaar_dashboard/auth_trend.php
  (figures read 2026-07-24; the dashboard is live and increments continuously)
- Monthly run rate: **221 crore = 2.21bn authentications in August 2025**, +10% YoY.
  https://www.uidai.gov.in/en/media-resources/media/press-releases/19390-uidai-records-221-crore-aadhaar-authentication-transactions-in-august-2025-10-increase-over-august-2024.html
- Aadhaar numbers generated: **UNVERIFIED at exact 2026 figure** — commonly cited as ~1.40–1.42bn
  with >100% claimed adult saturation. UIDAI publishes a "Aadhaar Saturation Report" PDF and a
  state-wise saturation page (https://uidai.gov.in/en/16-english-uk/aapka-aadhaar/994-state-wise-aadhaar-enrolment-ranking.html);
  I did not extract a dated headline number. Next step: the saturation PDF on that page.

**The offline / QR path (why Anon Aadhaar exists).** Two UIDAI artefacts are *self-contained,
UIDAI-signed, and verifiable by anyone holding UIDAI's public certificate*, with no call back to
UIDAI:
1. **Aadhaar Paperless Offline e-KYC** — a ZIP the holder downloads from myaadhaar.uidai.gov.in
   containing an XML of name/DOB/gender/address/photo plus a UIDAI digital signature, encrypted
   under a user-chosen 4-character "share code". Docs:
   https://uidai.gov.in/en/ecosystem/authentication-devices-documents/about-aadhaar-paperless-offline-e-kyc.html
   Sample data: https://uidai.gov.in/en/915-developer-section/tutorial-section/11347-offline-ekyc-sample-data.html
2. **Aadhaar Secure QR code** on the e-Aadhaar / PVC card — signed payload including a photo.

This is the crucial architectural fact for us: **Aadhaar has an offline, issuer-signed, pull-model
artefact.** That is what makes ZK-over-Aadhaar (Anon Aadhaar et al., covered by the ZK-tooling
agent) possible at all without UIDAI's cooperation. Almost no other system in this file has an
equivalent — most are online, redirect-based federation where the IdP sees every verification.

**Key/algorithm rotation risk — a live, documented example.** UIDAI **Circular 4 of 2026**
mandates migration from SHA-1 to SHA-2/SHA-256 for digital signing in the Aadhaar authentication
ecosystem, with SHA-1-signed requests **not accepted after 2026-06-30**. Primary source PDF (a
scanned document, dated 2026-04-15 in its metadata):
https://www.uidai.gov.in/images/Circular_4_of_2026_reg_SHA-1_SHA-2_SHA-256_migration.pdf
Secondary summary: https://complinity.com/legal-update/uidai-issues-technical-document-for-migration-from-sha-1-to-sha-2-sha-256-for-digital-signing-in-aadhaar-authentication-ecosystem-23735/
`UNCLEAR:` the PDF is a scan and did not extract as text, so I could not confirm from the primary
source whether the mandate covers **only requesting entities' signing of authentication requests**
(digest method + signature method on the AUA/KUA side) or **also UIDAI's own signature on the
offline e-KYC XML / secure QR payload**. The distinction matters enormously to us: only the latter
breaks offline ZK verifiers. Next step: OCR the PDF, and diff a freshly downloaded offline e-KYC
ZIP's signature algorithm against a 2024 sample.
Regardless of which, treat this as the canonical example of the general risk class
**"the issuing state unilaterally rotates keys or algorithms and every downstream verifier breaks,
with no obligation to notify or support third parties."** It applies to every system in this file
and to ICAO passport chips.

**Legal restrictions on private use — this is the blocker.**
- *Justice K.S. Puttaswamy (Retd.) v. Union of India* (Supreme Court of India, 2018) upheld Aadhaar
  for state subsidies/benefits but **struck down s.57 of the Aadhaar Act**, which had allowed "any
  body corporate or person" to use Aadhaar for establishing identity by contract. Effect: private
  companies could no longer *require* Aadhaar authentication.
- The **Aadhaar and Other Laws (Amendment) Act, 2019** partially reopened this: voluntary use, and
  a route for private entities to be permitted by notification.
- The **Aadhaar Authentication for Good Governance (Social Welfare, Innovation, Knowledge)
  Amendment Rules, 2025** (notified 2025-01-31 by MeitY) build the current gate: an entity applies
  via the **Aadhaar Good Governance Portal** to a sponsoring ministry/department; UIDAI examines;
  MeitY approves on UIDAI's recommendation; the ministry then notifies the entity.
  PIB: https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2098223
  UIDAI Circular 4 of 2025 (template for the Rule 5 notification):
  https://uidai.gov.in/en/ecosystem/authentication-devices-documents/authentication-document/18880-circular-4-of-2025-regarding-sample-template-for-notification-pursuant-to-rule-5-of-aadhaar-authentication-for-good-governance-social-welfare-innovation-knowledge-rules-2020.html
  Analysis (secondary, law firms): https://www.khaitanco.com/thought-leadership/Aadhaar-authentication-for-private-entities

**Consumability verdict for Aadhaar:** split.
- *Online authentication / e-KYC API*: **NO.** Requires being an AUA/KUA licensed through an ASA,
  now additionally gated by the 2025 Good Governance Rules approval chain (ministry → UIDAI →
  MeitY). A permissionless foreign crypto verifier has no realistic path.
- *Offline e-KYC ZIP / secure QR*: **YES, technically** — the user hands you a UIDAI-signed blob and
  you verify the signature against UIDAI's published certificate with no UIDAI involvement. This is
  the single most important exception in this entire file. The constraints are legal and practical,
  not cryptographic: no Aadhaar-number storage, DPDP Act 2023 obligations, and UIDAI has
  historically been hostile to unsanctioned use of Aadhaar data.

**Uniqueness / identifier semantics.** The Aadhaar number itself is a **stable, global,
per-person identifier** — exactly what a sybil-resistance system wants and exactly what Indian law
and UIDAI policy try to stop you from storing. UIDAI's own privacy layer is the **Virtual ID (VID)**
(revocable, maps to Aadhaar) and the **UID Token** — a per-AUA, agency-specific 72-character token
that is stable for that agency but different across agencies, i.e. **per-relying-party
pseudonymisation**. So: a sanctioned AUA gets a stable pseudonym; an unsanctioned offline verifier
gets the real Aadhaar number (or a hash of it) but is not supposed to keep it.

**Fraud / duplicate rate.** UIDAI does cancel duplicates and false-document enrolments (its own FAQ
and the Aadhaar (Enrolment and Update) Regulations give it that power). Concrete 2025 datapoint:
UIDAI **deactivated over 2 crore (20m+) Aadhaar numbers of deceased individuals** in a 2025 cleanup
(https://www.newsonair.gov.in/uidai-deactivates-over-two-crore-aadhaar-numbers-of-deceased-individuals/,
Nov 2025, state broadcaster — secondary). `UNVERIFIED:` I found **no** authoritative published
duplicate-enrolment *rate*. UIDAI does not publish a false-accept rate for its 1:N de-duplication.
Historic parliamentary answers have cited a few lakh cancelled duplicates against >1.2bn enrolments
(i.e. order 10^-4 or better as *reported*), but the reported number is a lower bound on the true
rate by construction — it only counts duplicates UIDAI found. Next step: Lok Sabha/Rajya Sabha
starred question answers on "duplicate Aadhaar cancelled", and CAG audit report No. 24 of 2021 on
UIDAI, which criticised UIDAI on exactly this.
Separately: biometric de-duplication at 1.4bn scale is the largest such system ever run, and there
is a documented population of people whose biometrics do not enrol or authenticate reliably
(manual labourers with worn fingerprints, the elderly) — the exclusion problem, see §3.

### Estonia + the Nordic/Baltic model (mobile-ID, Smart-ID, BankID)

(Estonia, Sweden, Norway, Finland and Denmark are all in the EU/EEA and therefore also inside the
eIDAS 2.0 story — see `eidas2-eudi-wallet.md`. Here I cover the *national* schemes as they exist
today, because eIDAS 2.0 does not replace them in the 2-3 year window.)

**Sweden — BankID.** The highest-usage consumer digital identity per capita in the world.
- **~8.5–8.6m active users** in a country of ~10.5m; commonly cited as **~99% of adults aged
  18–67**. **7.1 billion uses in 2023** (~840 authentications per user per year). ~7,500 connected
  services. (Figures are 2023–2025 vintage from secondary sources; BankID's own statistics page is
  the primary to check. `UNVERIFIED:` a 2026 figure.)
- **Ownership:** BankID is *not* a government system. It is run by **Finansiell ID-Teknik BID AB**,
  owned by the large Swedish banks. This matters: it is a private consortium credential that
  happens to be universal, which is why Swedish public authorities consume it rather than issue it.
- **Consumability: NO, hard no.** To become a relying party you must sign a contract with a
  **BankID-issuing bank**, which issues you an RP certificate (mutual-TLS client cert) used to call
  the RP API. Banks require a Swedish organisation number, KYB on the business, and a commercial
  agreement; there is per-transaction pricing set by the bank, not published centrally. The BankID
  Relying Party Guidelines additionally **prohibit "ID switching"** — you may not use BankID to
  authenticate on behalf of another identity scheme, which is *precisely* what an aggregator does.
  (Relying Party Guidelines v3.4, 2020-06-08, mirrored at
  https://webapp.sebgroup.com/mb/mbcc.nsf/alldocsbyunid/2708B7754A045A6DC12585E5002DEC10/$FILE/bankid-relying-party-guidelines-v3.4.pdf
  — check for a newer version at bankid.com; the bankid.com "connect" page 404'd for me on
  2026-07-24.) `UNVERIFIED:` whether the current guidelines still contain the ID-switching clause
  verbatim — but the commercial logic (RPs fund the scheme, so reselling access is banned) is
  structural and will persist.
- **Practical route:** aggregators like **Criipto** (https://www.criipto.com/pricing) and Signicat
  resell BankID/Nordic eIDs — but they are themselves accredited, contractually bound RPs. Using
  them means we are a *sub-processor* of an accredited RP, inheriting all the same restrictions plus
  a per-verification fee. That is a legitimate product path but it is not permissionless and it does
  not give us a credential we can verify without the vendor.
- **Uniqueness:** BankID is bound to the Swedish **personnummer** — a stable, national,
  cross-relying-party unique identifier. Excellent sybil resistance in principle, catastrophic
  privacy properties, and completely walled off from us.

**Norway BankID / Finland Trust Network (FTN) / Denmark MitID:** same architecture, same answer.
All are bank-federation or bank+state schemes where the relying party contracts with an accredited
broker. Norway publishes pricing (https://bankid.no/en/company/pricing). Finland's FTN and Denmark's
MitID require a broker agreement. **Consumability: NO.**

**Estonia — ID-card, Mobile-ID, Smart-ID, e-Residency.**
- Estonian ID-card and Mobile-ID are **PKI smartcards/SIMs issued by the state** (via SK ID
  Solutions as CA). Because they are plain X.509 + qualified signatures, **anyone can verify an
  Estonian qualified signature offline** against the published CA chain and the EU Trusted List.
  This is a genuine partial exception: signature *verification* is permissionless, even though
  *authentication* against the OCSP/auth service is contracted.
- **Smart-ID** (SK ID Solutions, launched 2017): **~3.3–3.4m users across EE/LV/LT**, ~5m accounts,
  ~**79m transactions/month**, 700+ services (SK's own figures; https://www.skidsolutions.eu/ ).
  It is a QSCD, so Smart-ID signatures are Qualified Electronic Signatures under eIDAS. Mobile-ID by
  contrast is small: ~230k users in Estonia, ~260k in Lithuania.
- **e-Residency**: ~120k+ e-residents issued a digital ID card since 2014 (`UNVERIFIED:` 2026
  figure; check e-resident.gov.ee/statistics). Important caveat for us: **e-Residency is not
  residency and involves no biometric de-duplication against the Estonian population** — it is a
  business-identity credential. It is also *purchasable* (~€100–150 state fee), which makes it a
  poor sybil root: a well-funded attacker can obtain many identities only if they have many
  underlying passports, so it is really a *proxy for holding a passport*, i.e. the same trust root
  as ICAO chips.
- **Consumability of an Estonian qualified signature: PARTIAL YES.** If a user signs a challenge
  with their Estonian ID-card/Smart-ID, we can verify the signature and read the certificate, which
  contains their **isikukood (personal ID code)** — a stable national identifier — with no
  agreement with anyone. Revocation checking (OCSP) is the part that may require an agreement.
  `UNCLEAR:` SK's OCSP terms for high-volume unregistered use; SK historically required a contract
  for production OCSP. Next step: SK ID Solutions' "OCSP service" terms page.
  **This is the second-loudest exception in this file after QuarkID.** Scale is small (~1.3m
  Estonians + 3.4m Baltic Smart-ID users), but the pattern — *a state-rooted certificate the user
  can present and anyone can verify* — is exactly the shape we want, and it generalises to every
  EU/EEA qualified-certificate scheme.

### Singapore — Singpass

- **Scale:** effectively universal for citizens and PRs (>97% of eligible residents;
  `UNVERIFIED:` exact 2026 figure — GovTech publishes it). Products: **Myinfo** (verified personal
  data), **Singpass Login**, **Verify**, **Sign**, **Identiface** (face verification).
- **Consumability: NO.** Private-sector access to Myinfo/Singpass APIs requires onboarding as a
  Singpass partner through GovTech, an application and approval process, and (since Apr 2022)
  **paid charges for Myinfo API usage** with a pricing table that is itself behind a Singpass login.
  Developer docs: https://docs.developer.singpass.gov.sg/ ; business product page:
  https://www.tech.gov.sg/products-and-services/for-businesses/corporate-transactions/singpass-api/
  There is no offline, self-contained, user-held signed artefact equivalent to Aadhaar's offline
  e-KYC. Everything is an OIDC redirect where GovTech sees the verification.
- **Face Verification** is explicitly **restricted to high-risk use cases only** (e.g. bank digital
  token setup) — so even accredited partners cannot get the strongest signal on demand.
- **Issuer-side breaking changes (the rotation risk class again):** Myinfo v3/v4 partners must
  migrate to **v5 by end-Sep 2026**, and all partner apps must be **FAPI 2.0 compliant by
  2026-12-31**. Unilateral, deadline-driven, non-negotiable.
- **Uniqueness:** Singpass is bound to **NRIC/FIN**, a stable national identifier, and Myinfo
  returns it to accredited partners. So the uniqueness is strong and the access is closed.

### Australia — myID (ex-myGovID) and the Digital ID Act 2024

**This is the cleanest example in the file of "the rule that blocks a permissionless verifier",
because Australia wrote it into statute.**

- The **Digital ID Act 2024 (Cth)** commenced **2024-12-01**, creating (a) an economy-wide voluntary
  **accreditation scheme** for digital-ID service providers and (b) the statutory **Australian
  Government Digital ID System (AGDIS)**. Co-regulated by the **ACCC** (Digital ID Regulator) and the
  **OAIC** (privacy). Official: https://www.digitalidsystem.gov.au/what-is-digital-id/digital-id-act-2024
  ; ACCC: https://www.accc.gov.au/by-industry/digital-platforms-and-services/digital-id-regulation
- `myGovID` was renamed **myID** (Nov 2024). It is the government's own IdP.
- **Timeline that matters to us:** **from 2026-11-30 accredited private entities may apply to
  participate in AGDIS**; by **Dec 2026** AGDIS expands to private-sector relying parties. The
  government will **charge relying parties for myID from 2027-01-01 at the latest**, and approved
  private providers may charge commercially.
  https://www.digitalidsystem.gov.au/news/policy-settings-for-charging-and-user-choice-in-the-australian-government-digital-id-system
- **Important nuance, do not overstate the block:** a relying party is **not required to be
  accredited** merely to consume an accredited provider's digital ID — accreditation binds the
  *providers*. But to consume **AGDIS/myID** specifically you must be onboarded as an AGDIS relying
  party, and from Dec 2026 that route opens to private entities on application + fee. There is also
  a statutory rule that **an entity cannot require an individual to create a Digital ID** to access
  a service.
- **Consumability: NO today; "apply and pay" from Dec 2026.** No user-held offline signed artefact;
  everything is a redirect flow. `UNVERIFIED:` whether the Data Standards Body's Digital ID Data
  Standards (https://dsb.gov.au/digital-id/data-standards) mandate any verifiable-credential format
  that could later be presented offline — worth one look, since if AGDIS lands on ISO mdoc /
  SD-JWT VC it converges with the mdoc agent's file and becomes interesting.
- **Uniqueness:** myID has identity **proofing levels (IP1/IP1+/IP2/IP3)** tied to document
  verification via the DVS. No public unique identifier is exposed to relying parties; Australia has
  a long-standing political allergy to a national ID number (the 1987 "Australia Card" defeat), and
  the TFN is legally restricted. So: **pseudonymous per relying party**, no cross-RP correlator.

**Trusted Exchange (TEx)** is the adjacent Australian initiative (a government "digital ID
exchange"/wallet play). `UNVERIFIED:` current status mid-2026; law-firm commentary exists
(Ashurst). Not a route for us either way.

### New Zealand — DISTF

- **Digital Identity Services Trust Framework Act 2023**; the **DISTF Authority** (in DIA) is the
  regulator and maintains a public **Trust Framework Register** of accredited services:
  https://www.dia.govt.nz/Trust-Framework-Register
- **First accreditation: NEC New Zealand Ltd**, four services (its Identity Verification Service).
  Uptake is thin — this is a framework, not yet a population-scale credential.
- Updated **Trust Framework Rules in force from 2026-06-29**.
- **Consumability: NO, and irrelevant at current scale.** Accreditation is voluntary but is the only
  way to make the "trust mark" claim; the framework governs *providers*, and there is no NZ
  citizen-held verifiable credential to read. Skip.

### UK — GOV.UK One Login, GOV.UK Wallet, and the mandatory digital ID U-turn

**Headline: the UK's mandatory national digital ID was cancelled five days before I wrote this.**

Timeline (dates matter here; the picture changed twice in 2026):
- **2025-09-25** — PM Keir Starmer announces a mandatory digital ID ("BritCard"), framed as a
  right-to-work check to deter illegal working. To be in place by end of parliament, no later than
  2029.
- **2025-10-23** — the parliamentary petition against it passes **2.9 million signatures**, one of
  the largest in UK parliamentary history.
- **2026-01** — first U-turn: government says the ID will **not** be compulsory for citizens and
  other forms of ID will remain acceptable for right-to-work; digital right-to-work checks
  themselves stay mandatory.
- **2026-03-10** — consultation published; closes **2026-05-05**.
- A cross-party Home Affairs Committee report called the programme a "fiasco"
  (https://publications.parliament.uk/pa/cm5901/cmselect/cmhaff/986/report.html).
- **2026-07-19/21** — **Andy Burnham, on becoming Prime Minister, scrapped the digital ID scheme**,
  reallocating the money to cost-of-living measures (a tax cut on household electricity bills).
  Bloomberg 2026-07-19:
  https://www.bloomberg.com/news/articles/2026-07-19/burnham-to-scrap-uk-digital-id-to-focus-on-cost-of-living-policies
  ; CNBC https://www.cnbc.com/2026/07/19/uks-incoming-pm-andy-burnham-to-prioritize-cost-of-living-say-allies.html
  ; TechCrunch https://techcrunch.com/2026/07/21/uk-government-scraps-plans-for-digital-id-cards-after-millions-of-brits-opposed/
  ; Al Jazeera https://www.aljazeera.com/news/2026/7/20/burnhams-move-to-scrap-uks-digital-id-plans-earns-cheers-and-criticism
  (All secondary/news. `UNVERIFIED:` I have not found the corresponding primary GOV.UK statement —
  next step: gov.uk news and the DSIT/Cabinet Office pages, which may lag.)
  Historical rhyme worth noting: Burnham was the Home Office minister who implemented much of
  Blair's 2006 ID card scheme, which was itself scrapped in 2010. **The UK has now killed a national
  ID scheme twice in sixteen years.**

**What survives the cancellation** — and this is the part that still matters to us:
- **GOV.UK One Login** — the cross-government citizen sign-in. Continues; it is plumbing, not a
  card. `UNVERIFIED:` current registered-user count (GDS publishes it; it was in the tens of
  millions by 2025).
- **GOV.UK Wallet + digital driving licence** — DVLA digital driving licence was in private testing
  in early 2026 with a **wider public rollout during 2026** to England, Wales and Scotland; **~40m
  motorists** in scope; **adoption explicitly optional**, physical licences continue. This is an
  **mDL**, so the format layer belongs to the ISO mdoc agent's file. `UNCLEAR:` whether the
  cancellation of "digital ID" touches the Wallet/mDL programme — it was a separate DfT/DVLA
  workstream and the reporting is about the identity card, not the licence. Check this.
- **DIATF** — the UK Digital Identity and Attributes Trust Framework, with **50+ certified Digital
  Verification Service providers** (secondary: techUK). In 2025-10 **Vidos** became the first
  DIATF-certified *Component* Service Provider, selling pre-certified verification modules by API
  (https://www.biometricupdate.com/202510/vidos-first-certified-component-provider-for-diatf-ahead-of-gov-uk-wallet-launch).
  DIATF certification is a **paid, audited annual scheme**.

**Consumability: NO.** To verify a GOV.UK Wallet credential in a regulated context (right to work,
right to rent, DBS) you must be a **DIATF-certified IDSP/DVS** — certification requires an
independent conformity assessment against the trust framework by a UKAS-accredited body, annually,
at real cost. Nothing stops you *technically* from parsing an mDL a user hands you, but you cannot
claim the regulated outcome. There is no permissionless route.

**Uniqueness:** the UK has **no national identity number** for general use (NINo is restricted; NHS
number is health-only). One Login identities are per-person but there is no exposed cross-RP unique
identifier. **Pseudonymous.**

**Lesson for our roadmap, stated plainly:** a state identity programme can be announced, become the
centrepiece of national policy, and be **cancelled within ten months**. Any product design that
depends on a specific national scheme existing in 2029 is uninsurable. This is the second general
risk class alongside key rotation: **political cancellation**.

### China — resident ID, real-name registration, Cyberspace ID, RealDID

**Layer 1: the resident identity card (居民身份证).** An 18-digit national ID number, universal for
citizens, embedded in a contactless card. The number is a **stable global unique identifier** and is
the root of everything below. There is **no** third-party verification route: the authoritative
check is against the Ministry of Public Security (MPS) population database, accessible only to
licensed domestic entities.

**Layer 2: real-name registration (实名制).** Since 2010–2017 legislation (Cybersecurity Law art. 24
and sectoral rules), Chinese platforms must verify users' real identity against the MPS database
before allowing posting, gaming, payments or phone numbers. Online gaming has an especially strict
regime (NPPA anti-addiction system, minors' curfews) where accounts are bound to a verified
identity. This is **the largest de facto "one person, one account" enforcement on earth** — but the
enforcement lives *inside* the platforms and the state, and produces no artefact a foreign verifier
can consume. Overview (secondary): https://appinchina.co/blog/the-complete-guide-to-chinas-real-name-verification/

**Layer 3: Cyberspace ID / 网号-网证 ("net number" + "net certificate").** Jointly run by the CAC and
MPS; the *Measures for the Administration of National Network Identity Authentication Public
Services* took effect **2025-07-15**. Architecture is notable and, ironically, privacy-forward in
one narrow sense: the citizen registers once with the state and receives a **网号** (an
alphanumeric pseudonymous identifier) and a **网证** (a certificate). Platforms then verify the user
*via the state service* and receive the pseudonym **instead of** the real name and ID number.
- Adoption: **>6 million** registrations by **2025-05** (Xinhua / China Daily, state media —
  secondary: https://www.chinadaily.com.cn/a/202505/23/WS68303502a310a04af22c1384.html ). 67 apps in
  the Aug-2024 pilot including 12306 (railways), Taobao, Xiaohongshu.
  `UNVERIFIED:` a 2026 adoption figure. Against ~1.1bn Chinese internet users, 6m is <1%.
- Officially **voluntary**; alternative real-name channels must remain available.
- Rules translation (useful primary-ish English source):
  https://www.chinalawtranslate.com/en/on-network-codes-and-credentials/
- **What it really does for us: it *centralises* identity verification into a single state service
  and removes the platform's ability to see the underlying ID.** It is per-person stable (one 网号
  per person) but issued and validated only by the state; there is no offline signed artefact.

**Layer 4: RealDID.** A blockchain-based DID scheme launched Dec 2023 on the state-backed **BSN**
(Blockchain-based Service Network), tied to real-name identity — "anonymous on-chain, real-name
off-chain." https://en.wikipedia.org/wiki/China_RealDID (secondary). `UNVERIFIED:` adoption, and
`UNVERIFIED:` whether any resolver is reachable from outside China. Treat as not integrable: BSN's
open-permissioned chains are not something a Western verifier can practically depend on, and the
credential is meaningless without MPS attestation.

**Consumability: NO, absolutely and at every layer.** Verification requires being a domestic,
licensed, ICP-filed entity connected to MPS infrastructure. There is no offline signed credential,
no public key infrastructure a foreigner can use, and the whole system is a state-security asset.
**Zero product path. Do not spend more time here.**

**Uniqueness:** the strongest in the world in principle (18-digit ID → one person; 网号 → one person)
and the least accessible in practice.

**ZK/privacy work:** the 网号/网证 design is *pseudonymisation by state intermediation*, not
cryptographic unlinkability — the state sees every verification. That is the opposite of what we
mean by privacy. No credible state-deployed ZK identity in China that I could find.

### Brazil — gov.br, CPF and the CIN

- **gov.br** is the federal single sign-on. It uses **three assurance tiers — bronze / prata
  (silver) / ouro (gold)** — an unusually explicit, publicly documented level semantic that maps
  well onto a scoring model:
  - *bronze*: self-asserted / basic (CPF-linked)
  - *prata*: facial recognition against the **CNH** (driving licence) database, or validation via a
    partner bank's internet banking
  - *ouro*: **QR code of the new CIN national identity card**, or facial recognition against the
    **Electoral Justice (TSE) biometric** database, or an **ICP-Brasil** digital certificate
  Official: https://www.gov.br/governodigital/pt-br/noticias/imposto-de-renda-2026-saiba-como-ter-uma-conta-prata-ou-ouro-no-gov.br
  ; tier explainer: https://agenciagov.ebc.com.br/noticias/202402/entenda-a-diferenca-entre-os-selos-de-confiabilidade-do-gov.br
- **CIN (Carteira de Identidade Nacional)** — the new national ID that finally makes the **CPF** the
  single national number (previously each state issued its own RG). **48.2 million Brazilians hold a
  CIN** as of early 2026 (gov.br press, 2026-03). The CIN carries a **QR code** and an ICAO-style
  MRZ.
- **Consumability: NO for gov.br SSO** (federation is for government services and accredited
  partners; no open relying-party registration). **PARTIAL / `UNCLEAR:` for the CIN QR code** —
  this is the item worth chasing. If the CIN QR contains an ICP-Brasil-signed payload verifiable
  against the published ICP-Brasil root, it is structurally the same opportunity as Aadhaar's
  offline e-KYC. `UNVERIFIED:` I did not confirm the CIN QR's contents or signature scheme.
  **Next step:** the Serpro / Ministério da Gestão CIN technical spec and the ICP-Brasil AC root
  list at https://www.gov.br/iti/ . This is a high-value open question given Brazil's large crypto
  population.
- **Uniqueness:** **CPF is a stable national unique identifier**, is semi-public in Brazil (widely
  disclosed, and has leaked at scale), and is *already* used by Brazilian crypto/fintech KYC. Note
  the sybil implication: a leaked-CPF market exists, so possession of a CPF number alone proves
  nothing; only a *live biometric match* to the TSE/CNH database (i.e. prata/ouro) does.

### Nigeria — NIN

- **137,371,080 NINs** enrolled as of **mid-July 2026** (secondary reporting; NIMC's own dashboard is
  the primary — https://nimc.gov.ng ). Up from 121m at 2025-06-30.
- **World Bank target: 180m NINs by end-2026**, requiring ~3.3m enrolments/month — a target Nigeria
  is clearly going to miss. https://www.biometricupdate.com/202508/nigeria-must-issue-59m-digital-ids-in-18-months-to-meet-world-bank-target
  This is funded through the World Bank **ID4D**-supported ID4D/Nigeria Digital Identification for
  Development project (~US$430m, World Bank + AFD + EIB).
- **NIMC Act 2026** took effect in 2026, positioning NIMC as *"the only body authorised for digital
  identity management in Nigeria."* (secondary: https://innovation-village.com/nin-enrolment-hits-136-million-as-nimcs-new-act-takes-effect/
  and https://idtechwire.com/nigeria-intensifies-national-digital-id-enrolment-under-new-nimc-act/ ).
  `UNVERIFIED:` exact statutory wording — get the gazetted Act. **If that exclusivity language is
  real, it is a direct legal threat to any private biometric personhood registry operating in
  Nigeria**, and that is a scoring-relevant fact for World ID-style protocols, not just for us.
- **Consumability: NO.** NIN verification runs through NIMC-licensed verification agents/partners
  with contracts and per-verification fees. Nigeria has also repeatedly suspended and re-priced
  third-party NIN verification after data-leak scandals (NIN details were found being sold via
  unauthorised sites in 2024). No offline signed artefact.
- **Uniqueness:** NIN is a **stable national unique identifier**; enrolment is biometrically
  de-duplicated. Strong in principle, inaccessible in practice.

### Indonesia — KTP-el, IKD, and INA Digital

- **KTP-el** (electronic ID card) issued to **>170 million** residents; the underlying number is the
  **NIK**, a 16-digit stable national identifier now also used as the taxpayer number.
- **IKD (Identitas Kependudukan Digital)** — the smartphone KTP, run by Dukcapil (Ministry of Home
  Affairs). **~17 million users as of 2025-12**, up from ~11m in 2024-07. App:
  https://play.google.com/store/apps/details?id=gov.dukcapil.mobile_id
  Dukcapil pushed a system update **2026-04-28**; Dukcapil has said it will stop producing new
  physical e-KTP stock in favour of IKD.
- IKD presents as a **photo or QR code**. `UNVERIFIED:` whether the QR is a signed, offline-verifiable
  payload or a lookup token that must be resolved against Dukcapil's server. My working assumption
  is the latter (a short-lived QR resolved by a verifier app), which would make it useless to us.
  **Next step:** decode an IKD QR, or read Dukcapil's Permendagri on IKD.
- **Consumability: NO.** NIK verification for the private sector goes through Dukcapil's data-access
  agreements (`hak akses`), signed with each institution; banks and fintechs have them, foreign
  entities do not.
- **Uniqueness:** NIK is a stable global identifier. Same story as everywhere else.

### Sub-Saharan Africa, World Bank ID4D, and the conflict with private biometric registries

**The programme.** The World Bank's **Identification for Development (ID4D)** initiative funds
national foundational ID systems, largely in Africa and South Asia, with the **MOSIP** open-source
platform (Modular Open Source Identity Platform, IIIT-Bangalore) as the most common technology base.
Country programmes with real scale: Ethiopia (Fayda, MOSIP-based), Morocco, Philippines (PhilSys,
MOSIP-based), Nigeria, Togo, Guinea, Sri Lanka, Madagascar. `UNVERIFIED:` current 2026 country
counts — check https://id4d.worldbank.org and https://mosip.io/deployments .
Cross-reference: MOSIP-based systems are the most likely future source of a standards-based,
offline-verifiable citizen credential, because MOSIP ships **verifiable-credential and offline-QR
modules** by default. That is a thing to watch.

**The conflict with private biometric registries — this is documented and severe.** World ID / Tools
for Humanity has been suspended, banned or ordered to delete data in a long list of jurisdictions,
overwhelmingly in the Global South where it recruited most aggressively:

| Jurisdiction | Action | Date |
|---|---|---|
| Kenya | Operations suspended 2023-08; **High Court declared operations illegal and ordered data deletion** | 2023-08 / **2025-05** |
| Brazil | **ANPD banned** paying for iris scans (financial incentive vitiates consent under LGPD); reaffirmed with **R$50,000/day** fine for resumption | 2025-01 / 2025-03 |
| Indonesia | **Komdigi suspended all operations** over biometric collection and permit violations | 2025-05 |
| Philippines | **National Privacy Commission ordered a halt** citing consent and "exploitation of vulnerable populations" | 2025-10 |
| Colombia | **Ordered deletion of biometric data and suspension** | 2025-11-22 |
| Spain, Portugal, Hong Kong, Thailand, Germany (Bavaria DPA) | various suspensions / deletion orders | 2024–2025 |

Sources (secondary/news, but the underlying regulator orders are public):
https://bitpinas.com/regulation/indonesia-kenya-worldcoin-issue/ ,
https://idtechwire.com/worldcoin-fights-philippines-biometric-ban/ ,
https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/ ,
https://en.tempo.co/read/2004666/these-are-8-countries-banning-worldcoin-from-spain-to-indonesia
`UNVERIFIED:` I have not checked which of these orders have since been lifted or appealed; several
(Kenya, Spain) had interim/appeal phases. **Anyone integrating World ID must check current
jurisdiction status themselves** — and the aggregator will need a per-jurisdiction availability
matrix, which is itself a product feature.

**Why this happens, stated structurally:** a private biometric registry that de-duplicates a
national population is *functionally a competing civil register*. States that are mid-rollout on
their own foundational ID (Kenya's Maisha Namba, Indonesia's IKD, Nigeria's NIN, the Philippines'
PhilSys) treat it as both a data-protection violation and an encroachment on a sovereign function.
Nigeria's **NIMC Act 2026** exclusivity language (above) is the sharpest version of this. Expect
more of it, not less.

**Implication for us:** protocols rooted in private biometric de-duplication carry **jurisdictional
availability risk** that state-rooted and document-rooted protocols do not. Conversely, state-rooted
credentials carry the political-cancellation risk the UK just demonstrated. Neither leg is safe
alone; that is an argument *for* the aggregator, and it should be said in the pitch.

### Kenya — Maisha Namba / Huduma Namba (brief)

Kenya's Huduma Namba (NIIMS) was **struck down by the High Court in 2021** for lack of a data
protection impact assessment, then relaunched as **Maisha Namba** in 2023, which itself faced court
challenges. `UNVERIFIED:` 2026 status. The point for us: **African foundational ID rollouts are
routinely halted by courts**, so any coverage assumption built on them should be discounted heavily.
### USA — mDL deployments, NIST, and state-led ZK
### Buenos Aires — QuarkID  ← the single most important case in this file

**What it is.** A self-sovereign-identity protocol (DID + W3C Verifiable Credentials, Sidetree-based
DID operations) built by the Buenos Aires City Government (GCBA) with Extrimian and Matter Labs,
anchored on **zkSync Era mainnet**. Open-sourced Feb 2024. In Oct 2024 GCBA replaced the backend of
its existing **miBA** citizen app with QuarkID, so every active miBA user got a DID.

**Scale (as announced).** **3.6 million** miBA users given DIDs from 2024-10-01; **~60+ document
types** available (birth certificates, marriage certificates, citizen credential, tax/income
documents, academic records).
- GCBA/Matter Labs press release, 2024-10-22:
  https://www.globenewswire.com/news-release/2024/10/22/2967256/0/en/Buenos-Aires-Sets-Global-Precedent-by-Empowering-3-6-Million-Citizens-with-Blockchain-based-Digital-Identity-on-miBA-platform.html
- Biometric Update (secondary), 2024-10:
  https://www.biometricupdate.com/202410/buenos-aires-moves-from-centralized-to-decentralized-digital-identity-with-quarkid
- Note: "3.6m users got a DID" is *not* "3.6m people actively present verifiable credentials to third
  parties." I found **no** published figure for credentials actually issued or presentations
  actually verified. `UNVERIFIED:` real usage.

**Hard technical surface (this is the good part).** From the official quickstart repo
https://github.com/ssi-quarkid/Nodo-QuickStart :
- DID method: **`did:quarkid`** (testnet variant `did:quarkid:zksync`), Sidetree-style operations.
- **zkSync Era mainnet (chain ID 324, https://mainnet.era.zksync.io)**, anchor contract
  **`0xe0055B74422Bec15cB1625792C4aA0beDcC61AA7`**
- **zkSync Sepolia testnet (chain ID 300)**, contract **`0x2535412fA22D9ad83384D7Ab7b636DDA37eFA872`**
- Node stack is `docker pull`-able: `api-proxy`, `api-zksync`, MongoDB, IPFS. **Anyone can run a
  resolver node**; resolution is `GET /resolve/:did` on the api-proxy.
**ON-CHAIN VERIFICATION — I checked the contract directly, and it is very much alive.**
Queried 2026-07-24 against `https://mainnet.era.zksync.io` (JSON-RPC) and
`https://block-explorer-api.mainnet.zksync.io` (public explorer API, no key required):

| Fact | Value |
|---|---|
| Anchor contract | `0xe0055B74422Bec15cB1625792C4aA0beDcC61AA7` (zkSync Era, chain 324) |
| Deployed | **2023-04-28T16:56:59Z**, block 2,424,399, creator `0x9CAA73a4865fa9dbb696758b6C7B2f03b6620712` |
| `totalTransactions` (explorer) | **190,030** |
| Most recent tx at time of check | **2026-07-24T22:12:13Z** — i.e. *the same day*, minutes before I looked |
| Throughput | **100 anchor txs in a 9h21m window (12:51Z→22:12Z on 2026-07-24) ≈ 250–260 batches/day** |
| Distinct anchor operators (in that 100-tx sample) | **4**: `0xCd340E92a3588532bc879e4E68f9E0c7C2c95549` (nonce 39,859), `0x88a5db8ae0AFAFc85b8F00d0Fb664D6a47779c62` (26,458), `0xFa3098642CE05674F49e52DD1F722b0A899b12f6` (8,321), `0x15C279404d72e33BB3FdfFD818e9DDa8E6Ea1b78` (140) |
| Method | one selector only: **`0x4cd27ad5`**, args `(bytes32 anchorHash, uint256 numOperations)` — a Sidetree batch anchor |
| DID operations | **1,786 operations across 100 batches** (min 1, max 89 per batch) → **~4,500–4,700 DID operations/day**; extrapolating 190,030 batches × ~17.9 ops ≈ **~3.4m lifetime DID operations**, consistent with the claimed 3.6m citizen DIDs |

`UNVERIFIED:` the 4 operator accounts are almost certainly QuarkID/Extrimian/GCBA batch-writers, not
independent third parties — do not read "4 operators" as decentralisation. Next step: label them.
Also note the contract's only balance is a spam airdrop token ("Claim on: zk-official.live"),
which is noise, not signal.

**Did it survive the change of administration? Yes on-chain, no on the website.** This split is the
real finding:
- The GCBA QuarkID pages now live under **`buenosaires.gob.ar/gcaba_historico/...`** — the city's
  *historical/archive* path. `https://buenosaires.gob.ar/innovacionytransformaciondigital/protocolo-quarkid`
  issues a **301 redirect into `/gcaba_historico/jefaturadegabinete/innovacionytransformaciondigital/quarkid/...`**
  (observed 2026-07-24). Governments archive programme pages when the programme or the sponsoring
  office ceases. The sponsoring office was the Jefatura de Gabinete's Secretaría de Innovación y
  Transformación Digital under Diego Fernández.
- GitHub activity on `github.com/ssi-quarkid` is thin and mostly stale (read 2026-07-24): `WhitePaper`
  last updated Aug 2024, `api-zkSync` Aug 2024, `dwn` Aug 2024, `Nodo-QuickStart` Aug 2024,
  `agente-mobile` Jun 2025, `VCSL` Jul 2025, `Paquetes-NPMjs` Oct 2025. Star counts are in single
  digits (top repo: 8 stars). **No repo shows 2026 activity.**
- The public technical documentation is conceptual, not a verifier spec: it cites the W3C VC Data
  Model but does not publish the concrete credential format, signature suite, DID-method spec
  details, or revocation mechanism a third party would need. (Checked
  `.../documentacion/credenciales-verificables`, 2026-07-24.)
- Nuance on "change of administration": the relevant change is **city-level**, not Milei. QuarkID was
  conceived under Horacio Rodríguez Larreta and launched under Jorge Macri (both PRO), so it did not
  face a hostile handover. The archiving therefore reads as a marketing/comms reorganisation, not a
  political kill — and the on-chain data says the machine is still running at ~250 anchors/day.
- `UNCLEAR:` whether *new credential issuance* continues or whether the daily anchor traffic is
  routine DID key rotation / update operations for an existing installed base. The op counts
  (1–89 per batch, avg ~18) look like ordinary create+update mix, but I cannot distinguish create
  from update from the anchor tx alone — you would have to fetch the Sidetree anchor file from IPFS
  and decode it. Next step: resolve one anchorHash through a QuarkID node's `/resolve` or pull the
  CAS file.

**Consumability verdict:** **This is the exception. Flagging it loudly.** QuarkID is, as far as I can
establish, the only *government-issued* identity credential in the world that a permissionless third
party can verify today with no accreditation, no contract with the issuer, and no API key:
- open DID method (`did:quarkid`), public spec-ish repo, Sidetree operations
- anchored on a **public L2 anyone can read** — no gatekeeper can stop you resolving a DID
- **self-hostable resolver** (`docker pull` the api-proxy + api-zksync + MongoDB + IPFS,
  `GET /resolve/:did`) — you do not need GCBA's servers
- W3C Verifiable Credentials, so signature verification is standard once you have the issuer DID doc
- the contract is **provably live in July 2026**

The blockers are quality, not permission: single-city scale (~3.6m people, ~0.04% of humanity), a
public documentation set that is conceptual rather than a verifier spec (no published signature
suite, credential schema, or revocation semantics), a status-list repo (`VCSL`) with 0 stars, and
essentially no third-party ecosystem. **Verdict: integrate later / build a spike now.** Concretely:
a 1–2 day spike to stand up a QuarkID resolver node, resolve a real `did:quarkid`, and verify one
real GCBA-issued VC end-to-end would tell us more about "can a crypto stack read a government
credential" than any amount of eIDAS reading. Do that spike.

**Uniqueness value even if live:** weak-to-moderate. A `did:quarkid` DID asserts "GCBA had an active
miBA account for this person." One human could plausibly hold only one miBA account (it is tied to a
DNI), so it *is* uniqueness-bearing — but only over ~3.6m porteños, and the DID is user-generated,
so an attacker who controls one miBA account cannot trivially mint many *credentials*, but nothing
on-chain distinguishes a government-issued DID from a self-created one without resolving and
checking the issuer of the VC.

**Related Argentine expansion (all pilot-stage, `UNVERIFIED:` current status):** Jujuy, Tucumán,
Luján de Cuyo (Mendoza), and reported experiments in Uruguay. Separately, Argentina's *national*
electronic DNI (`argentina.gob.ar/interior/dni/nuevo-dni-electronico`) is an ICAO-style chip
document — that trust root belongs to the ZK-passport agent's file, not here.

### Bhutan — NDI
### Other national SSI deployments

## Analysis

### 1. The consumability question (per system)
### 2. The uniqueness question
### 3. Coverage and exclusion — a design constraint, not a footnote

**The numbers (World Bank ID4D, Global Findex 2025 vintage, published 2025-11):**
- **~800 million people worldwide lack any official proof of identity**, down from ~850m in the 2021
  ID4D estimate.
  Blog: https://blogs.worldbank.org/en/digital-development/850-million-people-globally-dont-have-id-why-matters-and-what-we-can-do-about
  Dataset: https://datacatalog.worldbank.org/search/dataset/0040787/identification-for-development-id4d-global-dataset
  ID4D portal: https://id4d.worldbank.org/
  Secondary summary: https://www.biometricupdate.com/202511/new-world-bank-data-shows-800m-people-worldwide-still-lack-legal-identity
- **Over half of the unregistered are children whose births were never registered.** (Less relevant
  to us directly — most personhood protocols gate on adulthood — but it forecasts the adult gap 15
  years out.)
- **Women in low-income countries are 8 percentage points less likely to hold an ID than men.**
- The gap concentrates in **Sub-Saharan Africa and South Asia**, in low- and lower-middle-income
  economies, and within those, in rural, poor and marginalised populations.
- **A second, larger gap that ID4D's headline number hides:** having *an ID* ≠ having a *digital,
  online-usable* ID. ID4D's own 2024 analysis found government-issued IDs are still mostly limited
  in digital capability (https://www.biometricupdate.com/202402/world-bank-id4d-report-shows-govt-issued-ids-still-limited-in-digital-capabilities).
  For our purposes the relevant denominator is not "has an ID" (~7.3bn) but "has an ID that can
  produce a credential a remote verifier can check" — which is far smaller, plausibly **1.5–2bn**
  and concentrated in the EU, India, China, Brazil, the Nordics, Singapore and a handful of others.
  `UNVERIFIED:` I could not find an authoritative figure for this narrower denominator. It would be
  a genuinely useful thing for us to estimate and publish.
- **Third gap: smartphone + connectivity.** Every wallet-based scheme in this file requires a
  reasonably modern smartphone. GSMA's mobile-internet usage gap is ~3bn people. Even where the ID
  exists and is digital, the *presentation channel* excludes.

**The fairness consequence, stated plainly.** If the aggregate humanity score weights state identity
heavily, then:
1. We systematically score **~800m people at zero** on that axis for reasons entirely outside their
   control, and a much larger number below the threshold because their state ID is not remotely
   verifiable.
2. The exclusion is **not random**: it is poorer, more rural, more female, more Sub-Saharan African
   and South Asian. Any downstream allocation gated on our score (airdrops, UBI, governance weight,
   rate limits) inherits that skew and amplifies it.
3. It also **correlates with the populations that crypto personhood projects claim to serve**. A
   sybil score that de facto requires a Nordic bank account or an Aadhaar number is a score for the
   already-included.

**Design responses (opinionated):**
- **Never make state identity necessary.** It should be one of several *sufficient-ish* paths, with
  a per-path ceiling, not a multiplier on the whole score.
- **Cap the state-identity contribution** at a level below "full humanity", so that a user with
  strong non-state evidence (biometric uniqueness, social graph, long-lived on-chain history) can
  reach the same top score by a different route.
- **Publish per-country score-distribution stats.** If our median score in Nigeria is half our median
  score in Sweden, that is a fact our integrators must know before they gate anything on it.
- **Do not double-count the same root.** See §Overlap — state ID, ICAO passport chip, EUDI PID and
  KYC-vendor document checks are all the *same* underlying government assertion. Stacking them
  multiplies the advantage of the already-documented.
- Treat "no state ID" as **missing data, not negative evidence.** These are different and the
  difference is the whole fairness argument.

## Verdict
## Open questions for us
## References
