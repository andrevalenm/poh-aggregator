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
### Singapore — Singpass
### Australia — myGovID / myID and the Digital ID Act 2024
### New Zealand — DISTF
### UK — GOV.UK One Login and the mandatory digital ID debate
### China — resident ID, real-name registration, one-person-one-account
### Brazil — gov.br
### Nigeria — NIN
### Indonesia — IKD / KTP-el
### Sub-Saharan Africa and World Bank ID4D
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
- `UNVERIFIED:` I could not load the zkSync Era explorer page for the anchor contract through
  WebFetch (returned an empty SPA shell), so I have **not** confirmed on-chain transaction counts or
  the date of the most recent anchor write. **This is the highest-value next step for anyone
  continuing this work**: query `0xe0055B74422Bec15cB1625792C4aA0beDcC61AA7` on zkSync Era via RPC
  (`eth_getLogs`) or the block-scout API and get first/last activity. If it stopped being written to
  in 2025, QuarkID is functionally dead regardless of the press releases.

**Did it survive? Evidence says: degraded, and possibly wound down.** This is a genuine finding:
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
- `UNCLEAR:` whether miBA still issues QuarkID-backed credentials today. Next step: install/inspect
  the miBA app, or check GCBA's current digital-identity page for what replaced it.
- Nuance on "change of administration": the relevant change is **city-level**, not Milei. QuarkID was
  conceived under Horacio Rodríguez Larreta and launched under Jorge Macri (both PRO), so it did not
  face a hostile handover in 2023. The archiving therefore reads as a *programme* wind-down /
  reorganisation rather than a political purge — which, for us, is worse news, not better: it
  suggests the thing lost its internal champion rather than being killed by opponents who might be
  voted out.

**Consumability verdict:** **The only near-permissionless state credential I found — but it is
probably not worth building against today.** Architecturally it is exactly what we want: an open DID
method, a public L2 anchor, a self-hostable resolver, W3C VCs, no accreditation gate for verifiers.
Practically: single-city scale, no published issuance/verification numbers, no published verifier
spec, archived government pages, and no 2026 code activity. **Treat as "watch, don't integrate."**
If someone confirms the zkSync anchor contract is still being written to in 2026, revisit
immediately — it would be the first genuinely permissionlessly-verifiable government credential.

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
### 3. Coverage and exclusion

## Verdict
## Open questions for us
## References
