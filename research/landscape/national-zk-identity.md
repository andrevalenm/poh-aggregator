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
### 3. Coverage and exclusion

## Verdict
## Open questions for us
## References
