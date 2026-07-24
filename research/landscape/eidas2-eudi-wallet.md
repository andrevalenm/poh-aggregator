# EU eIDAS 2.0 / European Digital Identity Wallet (EUDI Wallet)

**One-liner:** An EU-mandated, government-issued mobile identity wallet that every member state must
offer by 24 December 2026 and that large platforms must accept from ~December 2027 — a
state-identity credential with strong attribute proofs, deliberately weak cross-verifier
linkability, and a **closed, government-gated verifier PKI**.

**Category:** state-identity (with an *aspirational* uniqueness layer that does not exist yet)
**Chains:** none. Not a blockchain system, no on-chain surface, no contracts, no subgraph. All
trust flows through X.509/ETSI PKI and Commission-published trusted lists.
**Status (2026-07):** **Legally live, operationally barely started.** Regulation in force since
20 May 2024; six Implementing Regulations adopted; ARF at **v3.0.0 (2026-07-23)**; open-source
stack extremely active (85 repos, commits today). **One** confirmed production national wallet
(Denmark AltID, 3 June 2026). ENISA, early 2026: *"no EUDI Wallet has been deployed or certified,
and the specification remains work in progress."* Fewer than a quarter of member states are
expected to hit the December 2026 deadline.

**Aggregator verdict:** **Not an integrable input on any near-term horizon — and simultaneously the
single biggest compliance constraint on our EU business.** Two blockers, either of which is fatal
on its own: (1) **verification is permissioned** — every verifier needs an access certificate from
a Member-State-notified CA, granted only to entities *established in* an EU member state and
registered in a national register with declared attributes and purpose (CIR 2025/848 Art. 3(1),
ARF `RPA_03`/`RPA_04`); an anonymous crypto aggregator has no path in. (2) **EUDI does not yield a
stable unique-per-human identifier**: the unique attribute is *optional*, per-issuer-scoped, and
the wallet is normatively **required** to let one human hold unlimited pseudonyms per relying party
(`PA_04`). Revisit in 2028 if the *scope rate-limited pseudonym* HLRs (`PA_23`–`PA_31`) ever get a
real specification — those are a nullifier, and they would change the answer completely.

## What it proves

**Precisely: that a member state's authentic source asserts this natural person exists, with these
civil-registry attributes.** That is it.

- ✅ **State-issued identity** — the strongest form of it. LoA "high", vetted PID Providers,
  certified wallets, hardware-backed keys (WSCA/WSCD).
- ✅ **Liveness / not-a-bot, indirectly** — holding a PID in an activated Wallet Unit implies a
  real enrolment against a state identity record, plus User authentication to the secure element on
  each presentation. The ARF itself proposes this as CAPTCHA replacement (Topic G §4.1.2).
- ⚠️ **Attribute proofs** — age, nationality, residence, name. Strong, selectively disclosable,
  and about to get real ZK in the age-verification variant.
- ❌ **Uniqueness — NO.** See "The uniqueness question". There is no cross-verifier nullifier, the
  persistent identifier is optional and issuer-scoped, and multiple pseudonyms per RP are mandatory.
- ❌ **Social trust** — not applicable.

Its trust root is the **same civil-registry / breeder-document root** as passports and national ID
cards, which is why it does not stack with document-scan protocols (see Overlap).
## Legal timeline and current status

**Deadline:** Member States must make at least one EUDI Wallet available to citizens by
**24 December 2026** (24 months after the entry into force of the first implementing acts,
which were adopted 28 Nov 2024 and entered force ~Dec 2024). EEA/EFTA states (Iceland,
Liechtenstein, Norway) reportedly get roughly a further year. — secondary sources, to be
confirmed against Reg. (EU) 2024/1183 Art. 5a(1).

**Actual state as of 2026-07 (from a July-2026 tracker, secondary source
https://www.eideasy.com/blog/eu-digital-identity-wallets-july-2026):**

- **Denmark** — the only confirmed *production* launch: **AltID went live 3 June 2026**.
  Caveat quoted by the tracker: "the current AltID Relying Party Registry is not yet an
  eIDAS 2.0 relying party registry" — i.e. even the leader is not yet running the
  regulation's RP-registration machinery.
- **Ireland** — citizen-facing *public pilot* of the Government Digital Wallet; no public
  relying-party sandbox.
- **France** (France Identité) and **Germany** — public sandbox/playground only.
  Germany's state EUDI Wallet has a **staged public rollout expected early 2027**, and one
  secondary source states Germany announced **2 January 2027** for its launch — i.e. Germany,
  the largest member state, misses the December 2026 deadline outright.
- Majority of EU27 remain at "announced project / sandbox / plan to upgrade an existing
  national app" stage. `UNVERIFIED:` no official Commission scoreboard consulted yet.

**Adoption/awareness:** an IDnow survey reported by Biometric Update (2026-07) found **51% of
French and German respondents had never heard of the EUDI Wallet**, only ~20% claimed clear
understanding. (https://www.biometricupdate.com/202607/eudi-what-as-wallet-deadline-looms-awareness-remains-low)

**Did the deadline slip?** Formally, no — 24 December 2026 still stands and no amendment or
infringement moratorium was found. In practice it is missing badly:

- **ENISA** (EU cybersecurity agency), in a draft certification scheme published early 2026:
  *"In early 2026, no EUDI Wallet has been deployed or certified, and the specification remains
  work in progress."*
- A report from the **EUDI Wallets Launchpad** event: only **16 of 27** member states participated
  in testing, showing *"a spectrum in maturity and readiness"*, and *"fewer than one quarter of
  Member States are likely to meet the … EUDIW deadline"*.
  (both via https://www.biometricupdate.com/202604/eu-commission-doubtful-all-member-states-will-be-able-launch-eudi-wallets-this-year — secondary source, April 2026)
- **The Netherlands** has signalled it will not meet the deadline; **Malta** expects a product that
  is available but not fully functional; **Bulgaria** reportedly has not started. (secondary,
  2026-07 trackers)
- **France Identité** is a live production national eID service being upgraded into an EUDI Wallet
  — arguably a second "live" case depending on how strictly you read "EUDI-conformant".
  `UNCLEAR:` whether France Identité is yet a *certified* EUDI Wallet Unit or a national eID app on
  a path to becoming one. These are very different things and trackers blur them.

**Holder counts.** `UNVERIFIED:` **no reliable public holder count exists for any national EUDI
wallet as of 2026-07.** The only adjacent hard number is that **87% of Danish adults use MitID at
least weekly** — and AltID *requires an existing MitID account to enrol*, so Denmark has a very
high ceiling but an unknown floor. This is the single most important missing number for us: without
it, "largest state-issued personhood credential in existence" is an aspiration, not a fact. Next
place to look: Danish Agency for Digital Government (Digitaliseringsstyrelsen) statistics pages,
the Commission's eIDAS Dashboard / Digital Decade reporting.

**Denmark AltID specifics** (secondary, Biometric Update Dec 2025 + Jun 2026): launched as *"a
digital age certificate and ID"*; the announcement explicitly claims **zero-knowledge proofs** for
age — *"AltID shares only a zero-knowledge proof"* — without naming the scheme. Signicat won the
Denmark wallet + mDL contract. `UNCLEAR:` whether AltID's "ZKP" is a genuine ZK proof or marketing
for salted-hash selective disclosure of an `age_over_18` boolean; given TS4's position that no ZKP
scheme is mature enough, **treat the ZKP claim as unverified**. Next place to look: AltID developer
docs / the Danish Agency for Digital Government technical spec.

## Implementing acts

Reg. (EU) 2024/1183 is a framework; the operative technical detail lives in Commission Implementing
Regulations (CIRs). The ones the ARF v3.0.0 normatively cites:

| CIR | Subject | Adopted | Notes |
|---|---|---|---|
| **(EU) 2024/2977** | **PID and electronic attestations of attributes** issued to the wallet | 28 Nov 2024 | Defines PID attribute set incl. the persistent identifier; amended by a later CIR per ARF v3.0.0 release notes |
| **(EU) 2024/2979** | **Integrity and core functionalities** of the wallet | 28 Nov 2024 | Contains the data-protection/unlinkability obligations; cited by ARF Topic E as a source of pseudonym requirements |
| **(EU) 2024/2980** | **Notifications to the Commission** re. the EUDI Wallet ecosystem | 28 Nov 2024 | Feeds the trusted lists |
| **(EU) 2024/2981** | **Certification of European Digital Identity Wallets** | 28 Nov 2024 | Annex 1 is the **Risk Register** referenced by the ARF |
| **(EU) 2024/2982** | **Protocols and interfaces** | 28 Nov 2024 | The one that mandates ISO/IEC 18013-5 and OpenID4VP/OpenID4VCI profiles; Annex 2 (as amended) carries the registration-certificate transport extension per ARF `RPRC_20` |
| **(EU) 2025/848** | **Registration of wallet-relying parties** | 6 May 2025 | **Applies from 24 Dec 2026.** See "Relying party registration" below — this is the one that decides whether we can play at all. |

The 28 Nov 2024 batch entering into force is what starts the **24-month clock to 24 December 2026**
for Member States to offer a wallet. ARF v3.0.0's release notes state it "incorporated amending
Implementing Regulations (2024/2977, 2024/2979, 2024/2980, 2024/2982, and 2025/848)" — i.e. a
**second, amending batch of CIRs landed in 2026**. `UNVERIFIED:` I did not obtain the CELEX numbers
or adoption dates of the 2026 amending CIRs. Next place to look: EUR-Lex search for implementing
regulations amending 2024/2977 et seq., and the ARF v3.0.0 release notes on GitHub.

There is a separate, later obligation: **regulated relying parties named in eIDAS 2.0 (banks,
telcos, platforms designated as VLOPs under the DSA, etc.) must *accept* the wallet by
December 2027** — roughly 12 months after wallets are issued. (secondary source; verify against
Art. 5f of Reg. 2024/1183.)

## Architecture and Reference Framework (ARF)

Repo: https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework
**Current release: v3.0.0, 23 July 2026** (clone at commit `6373eee`, 2026-07-23 — i.e. one day
before this file was written; the ARF is a live document, treat any quote here as versioned).
v2.9.0 was 21 May 2026. Release notes for v3.0.0 say it incorporates the **amending** Implementing
Regulations 2024/2977, 2024/2979, 2024/2980, 2024/2982 and 2025/848, adds a "Functional Conformance
Assessment Framework" and shareable functional test cases at `conformance.eudi.dev`, and adds
support for both ETSI TS 119 612 **Trusted Lists** and **Lists of Trusted Entities (LoTE)**.

The ARF is not itself law; it is the Commission's architecture doc that the CIRs and national
implementations track. Its Annex 2 High-Level Requirements (HLRs) are the closest thing to a
normative technical spec and are now maintained as a single CSV
(`hltr/high-level-requirements.csv`, ~800 requirements) with harmonised IDs of the form
`PART-CATEGORY-TOPIC-ID` (e.g. `AS-WP-11-004`).

### Roles and trust model (ARF main §6)

- **Wallet Provider** → issues the **Wallet Solution**; a **Wallet Unit** = Wallet Instance +
  WSCA/WSCD (secure crypto device) + keystore(s). The provider vouches for the unit via a
  **Wallet Instance Attestation (WIA)** and one or more **Key Attestations (KA)**, and revokes the
  unit by flipping the WIA/KA revocation status.
- **PID Provider** → issues **PID** (Person Identification Data). Member State approves it via a
  *"well-defined policy"* and *"specific vetting processes"* (`Reg_19`).
- **Attestation Providers** issue three tiers:
  - **QEAA** — qualified electronic attestation of attributes, from a **qualified trust service
    provider** (Annex V of Reg. 2024/1183). Carries the strongest legal effect.
  - **PuB-EAA** — attestation issued by or on behalf of a **public sector body** responsible for an
    authentic source (Art. 45f / Annex VII).
  - **(non-qualified) EAA** — anything else. Note `ARB_01a`: non-qualified EAAs may use a
    **third** format beyond mdoc and SD-JWT VC, and per ARF §6.1 *"Non-qualified EAAs may adopt
    alternative trust models and verification mechanisms."* **This is the only crack in the wall
    for a non-state issuer** — see "Integration surface".
- **Registrar** (Member State) → registers PID Providers, Attestation Providers and Relying
  Parties; associated **Access Certificate Authority** issues access certificates and an associated
  **Provider of registration certificates** issues registration certificates.
- **Trust anchors** live in per-Member-State **Trusted Lists** (ETSI TS 119 612, for qualified
  services) and Commission-published **Lists of Trusted Entities / LoTE** (ETSI TS 119 602, for
  Wallet Providers, ACAs, registration-certificate providers, PID Providers). A Wallet Unit
  *"SHALL accept only the trust anchors in the LoTE(s) … notified by Member States"* (`RPA_04`).

Net: it is a **closed PKI with government-controlled trust anchors at every edge**. Nothing about
it is permissionless.

## Credential formats

**Cross-reference:** the mechanics of ISO/IEC 18013-5 mdoc/mDL, SD-JWT VC, OpenID4VCI/OpenID4VP and
the W3C Digital Credentials API are covered in the sibling research file on mdoc/formats — do not
duplicate. What matters here is that eIDAS 2.0 **mandates both formats simultaneously**:

- `PID_02`: *"A PID Provider SHALL issue any PID in **both** the format specified in ISO/IEC 18013-5
  **and** the format specified in [SD-JWT VC]."*
- `PID_04`/`PID_05`: mdoc doctype and namespace are both **`eu.europa.ec.eudi.pid.1`**.
- `PID_14`: SD-JWT VC `vct` is **`urn:eudi:pid:1`**.
- `PID_21`: for SD-JWT VC PIDs, *all* claims SHALL be individually selectively disclosable except
  those explicitly excluded.
- `ISSU_01`/`ISSU_15`/`ISSU_26`: issuance is **OpenID4VCI** profiled by **HAIP** sections 4 and 6.
- `OIA_03b/c`, `OIA_08/08a`: remote presentation is **OpenID4VP**, either by redirect or via the
  **W3C Digital Credentials API**, profiled by HAIP.
- `ProxId_01`/`ProxId_02`: proximity is ISO/IEC 18013-5 **device retrieval only** — *server
  retrieval SHALL NOT be supported* (an explicit anti-phone-home privacy decision).
- Revocation (`VCR_01`, `VCR_11`, `VCR_11a`): either **short-lived attestations (≤24h)** or an
  Attestation Status List / Token Status List.

These formats are the same wire formats used by ISO mDL deployments (US mDLs, Google/Apple
wallets), so an EUDI verifier stack is largely a superset of an mdoc verifier stack — **plus** the
access-certificate/registration-certificate machinery that is EUDI-specific and is exactly the part
we cannot obtain.

## Selective disclosure and unlinkability

### Where the law sits

The binding text is **Regulation (EU) 2024/1183 Art. 5a(16)**, quoted verbatim in multiple ARF
documents:

> (a) not allow providers of electronic attestations of attributes or any other party, after the
> issuance of the attestation of attributes, to obtain data that allows transactions or user
> behaviour to be tracked, linked or correlated, or knowledge of transactions or user behaviour to
> be otherwise obtained, unless explicitly authorised by the user;
> (b) enable privacy preserving techniques which ensure unlinkability, **where the attestation of
> attributes does not require the identification of the user**.

Recital 14 names zero-knowledge proof explicitly. Note the carve-out in (b): unlinkability is only
mandated where identification is *not* required. The ARF ZKP paper says this plainly: "In cases
where full identity verification is necessary, achieving unlinkability is not possible."
(`/docs/discussion-topics/g-zero-knowledge-proof.md` §4.1)

### What is actually normative in the ARF (v3.0.0, released 2026-07-23)

ZKP requirements **are** now in the normative Annex 2 as **Topic 53 (ZKP_01 … ZKP_09)**
(`docs/annexes/annex-2/annex-2.02-high-level-requirements-by-topic.md`, §A.2.3.31). Highlights,
quoted:

- **ZKP_01 (SHALL)** — a ZKP scheme SHALL prove attribute inclusion, validity period,
  non-revocation and device binding *while hiding all attributes*; SHOULD also support
  **issuer hiding**.
- **ZKP_02 (SHALL)** — SHALL support proving **possession of an attestation of a given type**
  (i.e. bare "I hold a PID" with nothing else revealed).
- **ZKP_04** — SHOULD support **derivation of a verifiable User pseudonym by combining an
  attribute value unique for the User with Relying-Party-specific context (e.g. the RP
  identifier)**, with the underlying unique attribute hidden from both the RP *and* the issuer
  (blind issuance).
- **ZKP_07 (SHALL)** — a ZKP scheme SHALL NOT introduce any additional communication or
  information that could be used to track or link User activity.
- **ZKP_08 (SHALL)** — algorithms must come from the ECCG Agreed Cryptographic Mechanisms v2.0.

### But: no ZKP scheme is mandated or shipped yet

**TS4 "Specification for ZKP Implementation in EUDI Wallet"** (v1.0 2025-05-21, editorial update
v1.0.1 2026-01-30) states outright:

> "At present, no existing ZKP approach can be deemed fully suitable or mature enough for direct
> integration into the EUDI Wallet."

Two follow-on specs exist and are more advanced:

- **TS13 — ZKPs based on arithmetic circuits** (v1.0, 2025-12-15; editorial 2026-01-30). Targets
  ZK proofs over *existing* mdoc / SD-JWT VC credentials with **no trusted setup**; references
  Google's **Longfellow-ZK** and Ligero. Explicit note: *"This technical specification captures
  exploratory work … It is not intended to be a final specification. Instead, it will be handed
  over to ETSI … under ETSI TS 119 476-2."* It also says the approach "will be tested in the
  [Age Verification](https://ageverification.dev/)" app.
- **TS14 — ZKPs based on multi-message signatures** (v1.0, 2026-02-27). BBS+/BBS#. Same "not a
  final specification, handed to ETSI" caveat.

Repo: https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications
(last commit 2026-06-08 as of clone on 2026-07-24). Licence: **CC BY 4.0**.

**Bottom line (2026-07):** the regulation demands unlinkability, the ARF has normative ZKP
requirements, but **there is no adopted ZKP scheme and the first production wallets (Denmark
AltID) do not ship one.** Interim unlinkability relies on the weaker mechanisms: salted-hash
selective disclosure (SD-JWT VC / mdoc) plus **batch issuance of single-use attestations**
(ARF Topic B, `b-re-issuance-and-batch-issuance-of-pids-and-attestations.md`). Batch issuance
gives *presentation* unlinkability but **not** issuer-RP collusion resistance, and it does not
hide the device-binding public key across a batch unless a fresh key is used per copy.

### The civil-society / cryptographers' pushback, and how it landed

- **"Cryptographers' Feedback on the EU Digital Identity's ARF"** (June 2024, ARF v1.4.0) — an open
  letter organised after the Commission invited cryptographers to a 5-6 June 2024 meeting. PDF:
  https://files.dyne.org/eudi/cryptographers-feedback-june2024.pdf ; GitHub discussion #211:
  https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/discussions/211
  Core argument: mdoc and SD-JWT VC rely on a **conventional issuer signature that is itself a
  unique identifier**, recognisable across presentations, so the mandated unlinkability is not
  achieved; they recommended the **BBS family of anonymous credentials**, noting mature standards
  work and open-source libraries already exist.
- Open ARF issues on the same point, still worth watching:
  - Issue #200 "Cryptographers' Feedback on the EU Digital Identity's ARF"
  - Issue #305 "Not compliant with eIDAS 2.0 unlinkability. No support for pseudonym PID or
    trustworthy identity"
  - Issue #572 "**Webauthn / FIDO2 Pseudonyms does not solve the unlinkability problem**" — this is
    the exact objection to the WebAuthn-only pseudonym design described below.
- The Spanish DPA (AEPD) has published a critical blog series "eIDAS2, the EUDI wallet and the
  GDPR" — https://www.aepd.es/en/press-and-communication/blog/eidas2-the-eudi-wallet-and-the-gdpr-ii
  (secondary source, but a regulator's view).

**Resolution status (2026-07): partially conceded, not delivered.** The Commission responded by
(a) creating Topic 53 and putting ZKP HLRs into normative Annex 2, (b) writing TS4/TS13/TS14, and
(c) mandating short-lived + batch-issued technical credentials as an interim mitigation. It did
**not** adopt BBS as a mandatory scheme; TS13 and TS14 are both explicitly labelled non-final and
handed off to **ETSI TS 119 476-2**. So the wallets that ship for the December 2026 deadline will
ship with the linkable signature the cryptographers objected to. `UNVERIFIED:` I did not find a
2026-dated EFF or noyb position paper specifically on the EUDI ARF; the 2024 cryptographers' letter
and the GitHub issues are the sourced record. Next place to look: noyb.eu press releases and EDPB
/ EDPS opinions on the amending CIRs.

### The "proof of personhood" use case is literally in the ARF

`g-zero-knowledge-proof.md` §4.1.2 is titled **"Proof of personhood"**:

> "Many online services require users to prove that they are not robots. Currently, this is usually
> done using CAPTCHA. … If a user could prove possession of a PID, this would serve as a sufficient
> indication that the user is a human being. A ZKP scheme can be used to provide a
> privacy-preserving proof of personhood."

It adds that "a suitable rate limiting mechanism shall be used in order to prevent users from
re-using an attestation in a malicious way", and points at WSCD user authentication as that
mechanism — i.e. the EU's own model of PoP is *rate-limited liveness*, not a nullifier.

## Pseudonymity and the unique identifier problem

Source: ARF v3.0.0 `docs/discussion-topics/e-rr-pseudonyms-including-user-authentication-mechanism.md`
(Topic E, Refinement Round, **v1.2 dated 26 June 2026** — this is current) and Annex 2 Topic 11
(HLRs `PA_01`–`PA_31`).

### Three pseudonym designs, only one of which exists today

| Implementation | Unlinkable across RPs? | Bound to PID attributes? | Rate-limitable (sybil-resistant)? | Spec status (2026-07) |
|---|---|---|---|---|
| **WebAuthn/FIDO2 credential** (public key / Credential ID *is* the pseudonym) | Yes | **No** | **No** | **This is "today's concept in ARF"**; [W3C WebAuthn] available |
| **Attested Pseudonym** (an EAA containing a pseudonym attribute) | "Limited, implementation dependent" | Yes | Yes in principle | "**No dedicated specification**" |
| **ZKP-based Pseudonym** (derived from PID/attestation) | Yes | Yes | Yes | "Concept mentioned in ARF, **no specification ready**" |

(table condensed from §4.2.2 of the Topic E RR paper)

The paper states flatly (§4.1.2): *"The current concept … **does not support the Scope Rate Limited
Pseudonym type or the related Rate Limited Participation use case** — WebAuthn/FIDO2 specification
is not designed for this purpose."* And (§4.1.3, focus-meeting update): *"as of today, there are no
final technical specifications available for Pseudonym Attestations or ZKP-based pseudonyms."*

### The normative anti-uniqueness requirements

These are the ones that matter to a sybil-resistance system:

- **PA_04 (SHALL):** *"A Wallet Unit SHALL enable the User to use **multiple different Pseudonyms
  at a given Relying Party**, unless it is explicitly designed as a scope rate-limited
  attestation."* — i.e. by default the wallet is required to let one human hold unlimited
  pseudonyms at one RP. That is the *opposite* of a personhood credential.
- **PA_15 (SHALL):** *"A Relying Party SHALL NOT be able to derive the User's true identity, or any
  data identifying the User, from the Pseudonym value received."*
- **PA_16 (SHALL):** *"A Wallet Unit SHALL NOT reveal the same Pseudonym to different Relying
  Parties, unless the User explicitly chooses otherwise."*
- **PA_17 (SHALL):** Wallet Providers *"SHALL use method(s) and/or protocol(s) … which make it
  impossible to correlate Pseudonyms based on their values or on metadata"* — note: *"colluding
  Relying Parties will not be able to conclude that different Pseudonyms belong to the same User."*

(HLR IDs verified against `hltr/high-level-requirements.csv` in the ARF repo at commit `6373eee`,
2026-07-23. Harmonised IDs: PA_04 = AS-WP-11-004, PA_15 = AS-WP-11-016, PA_16 = AS-WP-11-017,
PA_17 = AS-WP-11-018, PA_23–PA_31 = AS-WP-11-024…032.)

### The scope rate-limited pseudonym HLRs — a nullifier, spelled out in EU law-adjacent text

Annex 2 Topic 11 §E defines `PA_23`–`PA_31`. These describe, almost exactly, an app-scoped
nullifier of the Semaphore / World-ID kind:

- **PA_24/PA_26:** the wallet generates a scope rate-limited pseudonym and proves it is *"within
  the rate and scope restrictions determined by the Relying Party"*; **the RP chooses the scope and
  the rate**.
- **PA_25:** the RP can *"verify that the rate is not exceeded for this User"*.
- **PA_27:** no entity or collusion (excluding the User) can link such pseudonyms **across**
  different RPs, *"even if the scope and rate are identical across the different Relying Parties"*.
- **PA_31:** *"A User's scope rate limited pseudonyms for a particular scope and rate SHALL be
  **persistent over time even if they start using another Wallet Unit**."* — i.e. device-independent,
  identity-derived. This is the uniqueness anchor.

**This is precisely the primitive an aggregator would want.** It is also, as of 2026-07,
**unimplemented and unspecified**; PA_30 is even marked "Remove" in the refinement round. Timeline
for it is explicitly tied to ZKP maturity, which TS4 says is not there yet.

### The persistent unique identifier in the PID — **it is optional and only issuer-scoped**

Read from the live PID Rulebook, which moved out of the ARF into
https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog
(`rulebooks/pid/pid-rulebook.md`, repo at commit `36f8adc`, 2026-07-20):

**Mandatory PID attributes (CIR 2024/2977 §2.2):** `family_name`, `given_name`, `birth_date`,
`birth_place`, `nationality`, `portrait`. Note `portrait` — a **full-frontal facial image**
(ISO/IEC 39794-5) — becomes mandatory *"as of 24 months after entry into force of the Regulation
amending [CIR 2024/2977]"*, with a user opt-out.

**`personal_administrative_number` is in §2.3 — OPTIONAL.** Its definition:

> "A value assigned to the user … that is **unique among all personal administrative numbers issued
> by the provider of person identification data**. **Where Member States opt to include this
> attribute**, they shall describe in their electronic identification schemes … the policy that
> they apply to the values of this attribute, including, where applicable, specific conditions for
> the processing of this value."

Three things follow, and they are decisive for sybil resistance:

1. It is **per-PID-Provider unique, not EU-unique**. A person with two nationalities holding two
   PIDs has two unrelated numbers.
2. **Member States may simply not include it**, and several will not (many EU states legally
   restrict use of a universal personal number — Germany's constitutional position on a single
   `Personenkennzeichen` is the obvious example). `UNVERIFIED:` I did not find a per-Member-State
   table of who includes it; that table does not appear to exist publicly yet.
3. Even where present, an RP may only request it if it is in that RP's **registration certificate**
   for that intended use (`RPRC_21`), and the User can refuse.

**There is no `age_over_18` attribute in the PID.** The rulebook changelog (v1.1, 4 Sep 2025) says
explicitly: *"Age verification attributes removed, following CIR 2024/2977."* Age proofs come from
`birth_date` or from a **separate age attestation** — see the age-verification section.

**Anti-tracking by short-lived credentials.** The rulebook distinguishes a *logical* PID
(administrative validity, years) from *technical* PIDs (the actual issued credentials). It says the
technical validity period *"typically is short, a few days or weeks at most, if not shorter, **to
mitigate challenges regarding tracking of Users by malicious Relying Parties based on the repeated
presentation of the same PID**"*, and that the provider silently re-issues successive technical
PIDs. Combined with batch issuance (`ISSU_64`), this is the deployed unlinkability story.

**What an RP learns today (no ZKP):** if it requests PID attributes it gets exactly the attributes
it asked for, salted-hash-selective-disclosed from an mdoc or SD-JWT VC — but it also gets the
**device-binding public key** it must challenge to check holder binding, which is a linkable
handle unless the wallet uses batch-issued one-time credentials with fresh keys. If the RP requests
the personal identifier attribute it gets a **stable national identifier in the clear**.

## Relying party registration

**This is the decisive section for us. Short answer: no, not anyone can verify an EUDI credential.
Verification is a permissioned role, cryptographically enforced by the wallet.**

### The legal hook

Art. 5b(1) of Reg. (EU) 2024/1183: *"Where a relying party intends to rely upon European Digital
Identity Wallets for the provision of public or private services by means of digital interaction,
the relying party **shall register in the Member State where it is established**."*
The operative implementing act is **Commission Implementing Regulation (EU) 2025/848 of 6 May 2025
laying down rules for the application of Regulation (EU) No 910/2014 … as regards the registration
of wallet-relying parties** — https://eur-lex.europa.eu/eli/reg_impl/2025/848/oj/eng.
**Article 11: "It shall apply from the 24 December 2026."** (verified against the EUR-Lex text,
fetched 2026-07-24.)

**Article 3(1) is the killer clause for a non-EU verifier:**

> "Member States shall establish and maintain at least one national register of wallet-relying
> parties with information regarding registered wallet-relying parties **established in that Member
> State**."

The CIR contains **no provision for third-country / non-EU-established relying parties**. On the
face of the text there is no registration path for an entity with no EU establishment, and without
registration there is no access certificate, and without an access certificate the wallet will not
present. `UNCLEAR:` whether a Member State's national registration policy (Art. 4) may in practice
accept a non-EU entity with an EU representative — Art. 4 requires "business registration"
documentation and a national redress mechanism, which points to "no". Next place to look: the
national registration policies once published (Art. 4 requires publication), and the Commission's
guidance/FAQ.

### How the wallet enforces it (ARF v3.0.0 Annex 2, Topics 6 / 27 / 44)

Two certificates are involved, and both come only from the Member State registration process:

1. **Access certificate** — issued by a Member-State-notified **Access Certificate Authority**
   ([ETSI TS 119 411-8], [ETSI TS 119 475]).
   - `Reg_10` (AS-MS-27-012): a Member State SHALL ensure an ACA *"issues one or more access
     certificates to all … Relying Parties **registered in one of the Member State's registries**."*
   - `RPA_03` (AS-WP-06-004): *"A Wallet Unit and a Relying Party Instance SHALL perform Relying
     Party authentication in **all** PID or attestation presentation transactions to Relying
     Parties, whether proximity or remote, **using an access certificate**."*
   - `RPA_04` (AS-WP-06-005): the wallet *"SHALL accept only the trust anchors in the LoTE(s) of
     all Access Certificate Authorities notified by Member States."*
   - `Reg_32`: the access certificate carries an **EU-wide unique identifier for the RP**.

   → **An entity with no access certificate cannot complete a presentation transaction.** There is
   no anonymous-verifier path. Note `RPA_05`/`RPA_06a`: on failure the wallet warns and *"SHALL
   either not present the requested attributes … or give the User the choice"* — so the hard block
   is at the certificate-chain level, not merely a UX warning.

2. **Registration certificate** — issued by a "Provider of registration certificates" attached to
   the Member State Registrar. `RPRC_09`: **one certificate per (intended use × Relying Party
   Service)**. `RPRC_19`: the RP Instance *"SHALL include a single registration certificate
   applicable for its current Service and intended use in each presentation request … by value,
   not by reference"*. `RPRC_21`: the wallet verifies **every requested attribute is inside the
   registration certificate's attribute list**, and warns the User if not. `RPRC_03`: contents per
   Annex V of CIR 2025/848.

So the wallet is doing purpose-limitation enforcement in the client, against a
government-issued, per-purpose certificate.

### Is registration an *approval* gate or just a register?

Nuance worth having: `Reg_01b` (AS-MS-27-002/003) says Member States collect contact info, service
description, registered attributes per intended use *"only for the purpose of transparency and
**SHALL NOT apply any pre-authorisation process on it**."* And `Reg_04` says registries must be
public with *"NOT require authentication or prior registration"* to **read**. `Reg_24`: RPs must be
able to register **remotely via an API or UI**.

So it is closer to a *notification* regime than a licensing regime — but `Reg_25` still requires
the Member State to *"identify a Relying Party at a level of confidence proportionate to the risk"*,
and `Reg_29` allows cancellation on request of *"a competent national authority"*. In practice you
must be a **legally identifiable entity established in an EU Member State**.

### The intermediary role — directly relevant to an aggregator

ARF **Topic 52 "Relying Party intermediaries"** (`RPI_01`–`RPI_10`) describes almost exactly our
product shape, and permits it — with heavy conditions:

- `RPI_01`: *"An intermediary SHALL register as a Relying Party … while indicating it intends to
  act as an intermediary."*
- `RPI_03`: the intermediary *"SHALL ensure that **each intermediated Relying Party** … is
  registered at a Registrar in the Member State where [it] is established"* and that it holds their
  registration certificates. `RPI_04`: the Registrar must obtain **legally valid evidence** of the
  intermediary↔RP relationship before registering it.
- `RPI_06`: each request carries the **intermediary's access certificate + the intermediated RP's
  registration certificate**.
- `RPI_07`: the wallet must **not** show the intermediary's name to the User — the User sees the
  end RP.
- `RPI_09`: the intermediary verifies authenticity, revocation, device binding, User binding.
- `RPI_10`: the intermediary *"SHALL **delete any PIDs or attestations it obtained** from the
  Wallet Unit, including any User attributes, **completely and immediately** after it has sent the
  User attributes to the intermediated Relying Party."*

**Implication for us:** an EUDI-consuming aggregator would be an *intermediary* under Topic 52. That
means (a) EU legal establishment + national registration, (b) every downstream customer must also
be individually EU-registered as an RP with declared attributes and purpose, (c) we may **not
retain** the credential data we pass through. A pseudonymous crypto aggregator serving global,
unregistered dApps is **structurally ineligible**.

## Age verification / mini-wallet

This is the part of the EU stack most likely to touch a real user before 2027, and the closest
thing to a consumer-grade "over 18 + one per person" primitive.

- **What it is:** the Commission's **age-verification blueprint**, a white-label "mini wallet" app
  that proves *age over a threshold* and nothing else. Technical portal:
  **https://ageverification.dev/** ; policy page:
  https://digital-strategy.ec.europa.eu/en/policies/eu-age-verification
- **Timeline (secondary sources, Commission news pages):** blueprint published **14 July 2025**;
  **second, enhanced version** released and declared "feature ready" **15 April 2026**; an EU-wide
  **coordination mechanism** for accrediting national solutions and cross-border issuance/acceptance
  of proof-of-age attestations announced **15 April 2026**.
  (https://digital-strategy.ec.europa.eu/en/news/commission-releases-enhanced-second-version-age-verification-blueprint)
- **Pilot member states:** **France, Denmark, Greece, Italy, Spain, Cyprus, Ireland** — front-runners
  intending to fold the app into their national EUDI Wallets. (secondary source; date-stamp 2026-07)
- **Why it matters technically:** ARF **TS13** (ZK from arithmetic circuits, Longfellow-style) says
  its approach *"will be tested in the [Age Verification]"* app. So **the age-verification
  mini-wallet is where EU ZK proofs get their first production trial**, ahead of the full wallet.
- **Why it matters to us:** "over 18" is a *predicate*, not an identity. It carries **no uniqueness
  whatsoever** — one human can obtain age attestations from multiple issuers, and the whole design
  goal is that presentations are unlinkable. As a personhood signal it is worth roughly what a
  document-scan liveness check is worth, minus the dedup.

`UNVERIFIED:` whether the mini-wallet's relying parties are subject to the same
access-certificate/registration regime as full EUDI RPs. Given it is being folded into national
EUDI Wallets and the coordination mechanism speaks of *"accreditation of national solutions"*, the
working assumption should be **yes, verifiers are accredited**. Next place to look: the
`ageverification.dev` verifier onboarding docs and the blueprint's own architecture document.

## Reference implementations and SDKs

GitHub org: **https://github.com/eu-digital-identity-wallet** — **85 repos**, and it is very much
alive: 4 repos had commits on **2026-07-24** (the day this file was written). Checked via the
GitHub API on 2026-07-24.

### Licences — two regimes, and the difference matters

- **Libraries and server components: Apache-2.0.** Permissive, commercially usable.
- **Reference *apps*: EUPL-1.2.** A copyleft licence (network-use is not a trigger, but derivative
  distribution is). If we forked the reference wallet UI, we'd inherit EUPL obligations.

### The pieces relevant to a verifier (all Apache-2.0)

| Repo | What | Lang | Last push |
|---|---|---|---|
| `eudi-srv-verifier-endpoint` | *"Web application (Backend Restful service) that acts as a Verifier/RP trusted end-point"* — the reference verifier backend | Kotlin | 2026-07-24 |
| `eudi-web-verifier` | Verifier web UI | TypeScript | 2026-07-24 |
| `eudi-app-multiplatform-verifier-ui` | Proximity verifier app | Kotlin | 2026-07-21 (EUPL-1.2) |
| `eudi-lib-jvm-openid4vp-kt` | OpenID4VP (verifier side) | Kotlin | 2026-07-23 |
| `eudi-lib-jvm-openid4vci-kt` | OpenID4VCI | Kotlin | 2026-07-20 |
| `eudi-lib-jvm-sdjwt-kt` / `eudi-lib-sdjwt-swift` | SD-JWT VC | Kotlin / Swift | 2026-07-20 / 07-01 |
| `eudi-lib-kmp-statium`, `eudi-lib-ios-statium-swift`, `eudi-srv-status-validator-py` | Token Status List / revocation checking | KMP / Swift / Python | 2026-07-20 |
| `eudi-srv-trust-validator` | Trusted-list / trust-anchor validation service | Kotlin | 2026-07-22 |
| `eudi-lib-kmp-etsi-1196x2` | ETSI TS 119 6x2 (trusted lists / LoTE) | Kotlin | 2026-07-24 |
| **`eudi-srv-web-relyingparty-registration-py`** | *"Relying Party registration service"* — reference registrar | Python | 2026-07-06 (1 star) |

Holder-side: `eudi-lib-android-wallet-core` (Kotlin, Apache-2.0), `eudi-lib-ios-wallet-kit` (Swift,
Apache-2.0), `eudi-lib-ios-iso18013-*` family, `eudi-app-android-wallet-ui` / `eudi-app-ios-wallet-ui`
(EUPL-1.2, 215 / 85 stars). Issuer-side: `eudi-srv-pid-issuer` (Kotlin),
`eudi-srv-web-issuing-eudiw-py` (Python), `eudi-srv-wallet-provider` (Kotlin).

### The age-verification app is a separate `av-*` family — and it has real ZK code

- `av-app-android-wallet-ui` (EUPL-1.2, **294 stars — the most-starred repo in the org**, pushed
  2026-07-17), `av-app-ios-wallet-ui` (EUPL-1.2, 2026-07-12)
- `av-srv-verifier-endpoint`, `av-srv-trust-validator`, `av-web-verifier-ui`, `av-dc-api-backend`
  (Digital Credentials API backend), `av-verifier-frontend-cinema` (a demo RP) — all Apache-2.0,
  all pushed within the last month
- **`av-lib-ios-longfellow-zkp`** — *"A Swift library for zero-knowledge proof (ZKP) generation and
  verification of **mdoc** credentials using the **Longfellow** ZK system"*, Apache-2.0, pushed
  2026-07-09, 4 stars.

**This is the single most concrete signal that EU ZK is real:** Longfellow (Google's
`eprint 2024/2010`, ZK over ECDSA-signed mdocs, no trusted setup) is being coded into the shipping
age-verification app, matching TS13's statement that it "will be tested in the Age Verification"
app. It is *not* in the mainline EUDI wallet repos yet.

### Are these usable by a third party?

**The code, yes; the credential, no.** The verifier stack is Apache-2.0 and self-hostable, and the
Commission runs public test infrastructure (`conformance.eudi.dev` for functional test cases; there
are public issuer/verifier sandboxes). You can stand up a working verifier this afternoon.

What you **cannot** get from GitHub is an **access certificate chaining to a Member-State-notified
Access Certificate Authority**. Without it, a real wallet refuses (`RPA_03`/`RPA_04`). So the
open-source stack lets you *develop*; it does not let you *operate*. `UNVERIFIED:` whether the
public sandbox wallets accept self-signed/test access certificates — almost certainly yes for the
sandbox, which is the only way the demos work; but that is a test trust anchor, not a production
one.

## The uniqueness question

**Direct answer: no. As specified and as shipping, an EUDI credential does not give a
stable, unique-per-human identifier that a sybil-resistance system can use. For our purposes it is
not a personhood credential — it is a very strong attribute credential.**

The four things that would have to be true, and their status:

| Requirement for sybil resistance | Status (2026-07) |
|---|---|
| A stable identifier per human | `personal_administrative_number` is **optional** (PID Rulebook §2.3) and unique only *"among all personal administrative numbers issued by the provider"* — per-issuer, not EU-wide, and Member States may omit it entirely |
| Exactly one credential per human | Not guaranteed. A dual national can hold PIDs from two Member States. Nothing prevents a person holding multiple Wallet Units from multiple Wallet Providers |
| A per-verifier nullifier that is one-per-human *within* a verifier | **Explicitly negated today.** `PA_04` (SHALL): the wallet *must* let a user hold **multiple different Pseudonyms at a given Relying Party**. The only shipping pseudonym is a WebAuthn keypair, and a user can mint as many as they like |
| A rate-limited, RP-scoped, identity-derived pseudonym | Specified as `PA_23`–`PA_31` and **exactly** the nullifier we would want (RP chooses scope and rate; cross-RP unlinkable; persists across wallet changes). **No technical specification exists**; the Topic E refinement round (v1.2, 26 June 2026) states the current concept "does not support" it and that "there are no final technical specifications available for Pseudonym Attestations or ZKP-based pseudonyms" |

The nuance that saves it slightly: **the design is not accidentally non-unique, it is
deliberately non-unique** as the default, with a deliberate, specified escape hatch
(`PA_23`–`PA_31`) for exactly the sybil-resistance case. The EU understands the problem — Topic G
§4.1.2 is literally titled "Proof of personhood" and §4.1.5 describes deriving a pseudonym from a
user-unique secret attribute combined with the RP identifier, with the attribute blind-issued so
neither RP nor issuer can correlate. That is World-ID-shaped thinking inside a Commission document.
It is just **years from shipping**, gated on ZKP maturity that TS4 says does not yet exist.

**What we could actually squeeze out of a real EUDI presentation today**, if we were a registered
RP: the mandatory PID attributes — `family_name`, `given_name`, `birth_date`, `birth_place`,
`nationality`, `portrait`. That tuple is a **strong probabilistic dedup key** (a fuzzy natural key,
plus a biometric). Deduping on it is legally radioactive under GDPR (biometric = Art. 9 special
category; the name+DOB tuple is directly identifying) and would blow straight through the
purpose-limitation that the registration certificate encodes. It is technically possible and
practically a non-starter.

## Trust root & failure modes

**Trust root:** national civil registries and breeder documents, via Member-State-approved PID
Providers (`Reg_19`: vetting policy required), anchored in Commission-published Lists of Trusted
Entities. Same root as an ePassport, an eID card, and any bank KYC check in the EU.

**Who can forge it?**
- Not a normal attacker. Forging a PID requires an issuer private key held by a state-vetted PID
  Provider, plus a certified WSCD to satisfy device binding.
- **A member state can mint arbitrary identities at will.** This is not a bug from the EU's point
  of view but it is the ceiling on trustworthiness: a hostile or compromised member state is an
  unbounded sybil source, and every other member state's wallet ecosystem must accept its PIDs.
  There is a suspension mechanism (LoTE status → Invalid) but it is political, not cryptographic.
- **Wallet Provider compromise** — a compromised Wallet Provider could issue WIAs/KAs for fake
  Wallet Units. Mitigated by CIR 2024/2981 certification and LoTE revocation.

**What a well-funded sybil farm does:**
1. **Buys or rents real people.** Enrolment is per-person and requires a state identity plus a
   phone; there is no "one" enforcement across RPs, so a farm with N recruited humans gets N
   identities, and each of those humans can generate **unlimited pseudonyms at each RP** by design
   (`PA_04`). Credential *rental* is the natural attack: the presentation requires user
   authentication to the secure element, so it needs the human at the moment of presentation — but
   this is exactly the low-cost attack that already works against every liveness protocol.
2. **Exploits multi-state issuance** for dual nationals and long-term residents.
3. **Does nothing at all**, because the credential does not claim uniqueness, so there is nothing
   to break.

**Failure modes relevant to us:**
- **Registration revocation as a kill switch.** `Reg_29`: a Relying Party is cancelled at least on
  request of *"a competent national authority"*. If we were ever a registered intermediary, an EU
  member state can switch us off unilaterally. That is a business-continuity risk on par with an
  app-store ban.
- **Purpose-limitation enforced in the client.** `RPRC_21`: the wallet checks requested attributes
  against our registration certificate and warns the user if we over-ask. Sybil-scoring is an
  awkward "intended use" to declare.
- **Data retention prohibition.** `RPI_10` forbids an intermediary from retaining anything after
  forwarding. A persistent humanity score derived from EUDI data is, on the face of it, not
  permitted through the intermediary route.
- **Fragmentation risk.** 27 national registers, 27 registration policies (CIR 2025/848 Art. 4),
  27 sets of supporting documentation. Even a compliant EU entity faces a heavy per-country lift.

## Integration surface

**No on-chain surface at all** — no contracts, no events, no subgraph. Everything is HTTPS + PKI.

**The technical integration is easy; the legal integration is the wall.**

Technical (all Apache-2.0, self-hostable — see "Reference implementations"):
- **Presentation:** OpenID4VP (HAIP-profiled), by redirect or via the **W3C Digital Credentials
  API** in the browser. Reference verifier: `eudi-srv-verifier-endpoint` (Kotlin) + `eudi-web-verifier`
  (TS). Cross-reference the sibling mdoc/formats file for protocol mechanics.
- **Proximity:** ISO/IEC 18013-5 device retrieval (BLE/NFC/QR), server retrieval forbidden.
- **Verification inputs:** issuer trust anchors from Trusted Lists / LoTE
  (`eudi-srv-trust-validator`, `eudi-lib-kmp-etsi-1196x2`), revocation via Token Status List
  (`eudi-lib-kmp-statium`, `eudi-srv-status-validator-py`).
- **Cost:** no vendor, no API key, no rate limit, no pricing page. The software is free.

Legal — and this is the actual integration surface:
1. **Be established in an EU member state.** CIR 2025/848 Art. 3(1) registers RPs *"established in
   that Member State"*; the CIR provides no third-country route.
2. **Register in that state's national register** under its national registration policy (Art. 4:
   identity + business registration + entitlements + supporting documentation + a national redress
   mechanism).
3. **Declare intended use(s) and the exact attribute list per intended use** (`Reg_10d`, TS6).
4. **Receive an access certificate** from the notified Access CA (`Reg_10`) and a **registration
   certificate per (intended use × service)** (`RPRC_09`).
5. **If we act for third-party customers, register as an *intermediary*** (`RPI_01`) — and every
   downstream customer must *itself* be individually registered in its own member state
   (`RPI_03`), with the registrar holding *"legally valid evidence"* of the relationship
   (`RPI_04`), and we must **delete all credential data immediately after forwarding** (`RPI_10`).

**Can we verify without the ecosystem's cooperation?** No. Unlike an mdoc from a US state (where a
verifier can just be a reader), the EUDI wallet performs **RP authentication in every transaction**
and accepts only Member-State-notified trust anchors. There is no permissionless read.

**The one crack: non-qualified EAAs.** `ARB_01a` lets a non-qualified EAA use a third format beyond
mdoc/SD-JWT VC, and ARF §6.1 notes *"Non-qualified EAAs may adopt alternative trust models and
verification mechanisms."* A crypto-native personhood credential could in principle be issued
**into** an EUDI wallet as a non-qualified EAA. `UNCLEAR:` whether a non-qualified EAA **Provider**
must also register and hold an access certificate — `Reg_01`/`Reg_10` lists "non-qualified EAA
Providers" among registered entities, and `RPRC_22`/`RPRC_23` make the wallet check the issuer's
registration certificate before accepting issuance, which suggests **yes, issuers are gated too**.
Next place to look: ARF §6.3 and TS6, and whether any member state has published a
non-qualified-EAA-provider registration policy.

## Scoring-relevant facts

- **Assurance tier:** the highest available anywhere. Level of Assurance **High**, hardware-backed,
  state-vetted issuer, certified wallet (CIR 2024/2981). If we ever *could* consume it, it should
  dominate every other state-identity signal in a score.
- **But it carries no uniqueness weight.** In a scoring model it should contribute to an
  "identity strength / not-a-bot" axis and contribute **zero** to a "unique human" axis, because
  nothing in the credential is one-per-human across verifiers.
- **Population ceiling:** ~449M EU residents; mandated availability to all citizens and residents
  by 24 Dec 2026. Actual holders as of 2026-07: `UNVERIFIED`, plausibly low six figures at most
  (one production wallet, launched 7 weeks ago, awareness at ~49%).
- **Cost and friction to obtain:** free to the user, but requires an existing national eID
  (AltID requires MitID), a supported smartphone with a secure element, and a state enrolment.
  Friction is low for EU residents, **infinite for everyone else** — this is a hard geographic
  ceiling. No non-EU person can ever hold one.
- **Decay/expiry/revocation:** *technical* credentials are short-lived by design (*"a few days or
  weeks at most, if not shorter"*, PID Rulebook §2.5) with silent re-issuance; the *logical* PID
  has a multi-year administrative validity. Revocation via Attestation Status List / Token Status
  List, or by ≤24h validity. So a cached "user has EUDI" assertion should carry a short TTL.
- **Acceptance mandate:** regulated relying parties (banks, telcos, VLOPs and others named in
  eIDAS 2.0) must **accept** the wallet from ~December 2027. This is the moment EUDI stops being a
  pilot and becomes infrastructure — and the moment a European consumer of ours may reasonably ask
  "why would I pay you when I can take the wallet directly?"
- **Age-verification variant** is the near-term reality: 7 pilot member states, feature-ready
  15 April 2026, real Longfellow ZK code in the repos. Proves "over N" and **nothing else** —
  scoring weight for uniqueness: zero.

## Overlap with other protocols

**Critical for not double-counting.** EUDI's PID derives from the **same state civil-registry and
breeder-document trust root as ICAO passport chips and national ID cards**. It therefore lands in
the **same dedup bucket** as:

- **ZKPassport**, **Self (Self.xyz)**, **Rarimo** — all read the ICAO 9303 passport/ID chip
- **World ID's document/passport verification tier**
- Every **KYC vendor credential** (Onfido/Sumsub/Persona-derived attestations, Coinbase
  verifications, etc.) that ultimately reads a government document
- National eID logins (BankID, iDIN, itsme) which are themselves being folded into EUDI Wallets

**Treat all of these as one evidence source, not many.** A user presenting EUDI + ZKPassport +
a KYC-vendor credential has demonstrated **one** state identity three ways, not three independent
humanity signals. Correlated failure: whatever compromises the underlying document (a corrupt
issuing authority, a stolen passport, a sold identity) compromises all of them simultaneously.

EUDI is *strictly stronger* than the document-scan protocols on assurance (live state issuance +
hardware binding vs. reading a chip) and *strictly weaker* on usability for us (permissioned
verification, no nullifier, EU-only).

**Genuinely independent from:** biometric-uniqueness protocols (World ID orb iris, Humanity
Protocol palm) — different root, different failure mode. Also independent from social-graph
protocols (BrightID, Proof of Humanity vouching) and behavioural/on-chain heuristics
(Gitcoin Passport stamps, account age).

**Note for the orchestrator:** the age-verification mini-wallet shares the *same* root again, since
its proof-of-age attestation is derived from the national identity. It is not an independent signal
from EUDI PID.

## Aggregator verdict — blunt

**All three, on three different clocks.**

### 1. As an *input*: no, and probably never on the terms we'd want. Horizon: 2028+, conditional.

Blocked twice over. **Legally**, we cannot get an access certificate without EU establishment and
registration in a national register with a declared purpose and attribute list (CIR 2025/848
Art. 3(1); ARF `RPA_03`, `RPA_04`, `Reg_10`). **Substantively**, even if we could, the credential
does not carry uniqueness: the persistent identifier is optional and issuer-scoped, and `PA_04`
*requires* the wallet to support unlimited pseudonyms per relying party. We would be paying a heavy
regulatory price for a signal that adds assurance but not sybil resistance — and that overlaps
completely with credentials we can already consume permissionlessly (ZKPassport, Self, Rarimo).

**The condition that flips this:** `PA_23`–`PA_31` (scope rate-limited pseudonyms) getting a real
specification and shipping. Those HLRs describe a genuine app-scoped nullifier — RP-chosen scope
and rate, cross-RP unlinkable, persistent across wallet changes. If that ships, EUDI becomes the
strongest personhood credential on earth for EU residents overnight. It is gated on ZKP maturity
(TS4: *"no existing ZKP approach can be deemed fully suitable or mature enough"*), currently being
handed to ETSI TS 119 476-2. Realistic earliest: **2028**, and that is optimistic given the wallet
itself is missing its 2026 deadline.

### 2. As a *competitor*: yes, in the EU, from ~December 2027.

Once regulated relying parties must accept the wallet, any EU service that needs "real human,
verified attributes" gets a free, state-backed, universally-held answer. Our EU value proposition
narrows to exactly the things EUDI refuses to do: **cross-verifier uniqueness**, **non-EU users**,
and **pseudonymous / crypto-native contexts where nobody will register as a relying party.** That
is a real niche — it is just a much smaller EU niche than it looks today. Note the asymmetry: EUDI
takes our *attribute verification* business but leaves our *sybil resistance* business intact,
because it explicitly declines to solve uniqueness.

### 3. As a *compliance constraint*: yes, immediately.

Even without touching EUDI, it sets the European expectation for what an identity interaction looks
like: verifier authentication, declared purpose, per-purpose attribute lists, in-client purpose
enforcement, user-visible transaction logs, one-click data-deletion requests, DPA-reporting
endpoints (ARF Topics 48/50). Any European customer or regulator will benchmark us against that.
Building our request model to be *shaped* like an EUDI presentation request — explicit purpose,
minimal attribute set, user-approved, logged — is cheap now and expensive to retrofit.

### Where "being a regulated entity" is unavoidable

Flagging these explicitly, because each is a hard fork in the roadmap:

- **Consuming EUDI credentials at all** → must be a registered wallet-relying party, established in
  an EU member state (CIR 2025/848 Art. 3(1)). There is no third-country path in the text.
- **Consuming them on behalf of customers** → must register as an **intermediary** (`RPI_01`), and
  **every downstream customer must itself be individually registered** in its own member state
  (`RPI_03`) with the registrar holding *"legally valid evidence"* of the relationship (`RPI_04`).
  That is fatal for a self-serve API with anonymous/global consumers.
- **Retaining anything** → `RPI_10` requires an intermediary to delete PIDs, attestations and user
  attributes *"completely and immediately"* after forwarding. A persistent EUDI-derived humanity
  score is, on the face of the ARF, not available via the intermediary route.
- **Issuing a credential into EUDI wallets** (the "crack" of non-qualified EAAs) → likely also
  requires registration as an EAA Provider plus an access certificate (`Reg_01`, `RPRC_22`/`_23`).
  `UNCLEAR:` needs confirmation — see Open Question 4.
- **A member state can switch us off** (`Reg_29`) at the request of a competent national authority.

**Recommendation:** do not build for EUDI. Build *around* it — design our request semantics to look
EUDI-shaped for European credibility, keep watching `PA_23`–`PA_31` and ETSI TS 119 476-2 as the
single trigger to revisit, and in the meantime treat EUDI-adjacent credentials
(ZKPassport/Self/Rarimo, national eIDs) as the same evidence bucket so we never double-count the
state-document root.

## Open questions for us

1. **Can a non-EU entity register as a wallet-relying party at all?** CIR 2025/848 Art. 3(1) says
   registers cover RPs *"established in that Member State"* and the CIR is silent on third
   countries. If a national registration policy (Art. 4) accepts an EU subsidiary or an
   Art.-27-GDPR-style EU representative, the picture changes materially. **This is the single
   highest-value follow-up.** Look at: published national registration policies (Ireland, Estonia,
   Netherlands first), Commission FAQ, and the `eudi-srv-web-relyingparty-registration-py`
   reference implementation's data model.
2. **What is the actual number of EUDI wallet holders?** Nobody publishes it. Until someone does,
   "largest personhood credential in existence" is a forecast.
3. **Is Denmark AltID's "zero-knowledge proof" claim real?** TS4 says no ZKP scheme is mature; the
   Danish press release says AltID "shares only a zero-knowledge proof". One of these is wrong.
   Check AltID developer documentation.
4. **Do non-qualified EAA *issuers* need registration and an access certificate?** If not, issuing
   a crypto-native personhood attestation into EUDI wallets is a real product. If yes (which the
   HLRs suggest), that door is shut too.
5. **Will `PA_23`–`PA_31` (scope rate-limited pseudonyms) ever get a specification, and when?**
   This is the difference between EUDI being irrelevant to sybil resistance and being the endgame.
   Watch ETSI TS 119 476-2 and ARF Topic 11/53 revisions.
6. **Does the mini-wallet's age-verification verifier flow require the same accreditation?** If age
   verification has a lighter-touch verifier regime, that is the one EUDI surface we might actually
   reach. Check `ageverification.dev` onboarding and `av-srv-verifier-endpoint` docs.
7. **Does the December 2027 acceptance mandate for regulated RPs create demand for us**, as a
   normalisation layer over EUDI + everything else, or does it eat our EU market? Probably both.
8. `UNVERIFIED:` the CELEX identifiers and dates of the **2026 amending CIRs** referenced by ARF
   v3.0.0. Worth pinning before quoting any CIR article number in a customer-facing doc.

## References

### Primary — law
- Regulation (EU) 2024/1183 (eIDAS 2.0) — https://eur-lex.europa.eu/eli/reg/2024/1183/oj
- CIR (EU) 2024/2977 — PID and EAA specification
- CIR (EU) 2024/2979 — integrity and core functionalities — https://eur-lex.europa.eu/eli/reg_impl/2024/2979/oj/eng
- CIR (EU) 2024/2980 — notifications to the Commission
- CIR (EU) 2024/2981 — wallet certification (Annex 1 = Risk Register)
- CIR (EU) 2024/2982 — protocols and interfaces — https://eur-lex.europa.eu/eli/reg_impl/2024/2982/oj/eng
- **CIR (EU) 2025/848 of 6 May 2025 — registration of wallet-relying parties. Applies from
  24 December 2026 (Art. 11).** https://eur-lex.europa.eu/eli/reg_impl/2025/848/oj/eng

### Primary — ARF and specs (all read directly, 2026-07-24)
- ARF repo, **v3.0.0**, commit `6373eee` (2026-07-23) —
  https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework
  - `docs/main/06-trust-model.md` — trust model, LoTE, roles
  - `docs/annexes/annex-2/annex-2.02-high-level-requirements-by-topic.md` and
    `hltr/high-level-requirements.csv` — all HLRs cited (RPA_*, Reg_*, RPRC_*, RPI_*, PA_*, ZKP_*,
    PID_*, ISSU_*, OIA_*, ARB_*, VCR_*)
  - `docs/discussion-topics/g-zero-knowledge-proof.md` (v1.4, 30 Mar 2025) — ZKP, incl. §4.1.2
    "Proof of personhood"
  - `docs/discussion-topics/e-rr-pseudonyms-including-user-authentication-mechanism.md`
    (**v1.2, 26 June 2026**) — pseudonym state of play
  - `docs/discussion-topics/x-rr-relying-party-registration.md` — RP registration
  - `docs/discussion-topics/a-privacy-risks-and-mitigations.md` — privacy risk register
- Technical specifications repo, commit dated 2026-06-08 —
  https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications
  - `ts4-zkp.md` (v1.0 2025-05-21 / v1.0.1 2026-01-30) — *"no existing ZKP approach can be deemed
    fully suitable or mature enough"*
  - `ts13-zksnarks.md` (v1.0, 2025-12-15) — arithmetic-circuit ZK, Longfellow, → ETSI TS 119 476-2
  - `ts14-zkps-from-mms.md` (v1.0, 2026-02-27) — BBS+/BBS#, → ETSI TS 119 476-2
  - `ts5`, `ts6` — RP registration formats/API and the common set of registered RP information
- Attestation rulebooks catalog, commit `36f8adc` (2026-07-20) —
  https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog
  - `rulebooks/pid/pid-rulebook.md` — mandatory/optional PID attributes,
    `personal_administrative_number`, short-lived technical PIDs

### Primary — code
- Org: https://github.com/eu-digital-identity-wallet (85 repos; libraries Apache-2.0, reference
  apps EUPL-1.2; metadata read via GitHub API 2026-07-24)
- `av-lib-ios-longfellow-zkp` — Longfellow ZK over mdoc, Swift, Apache-2.0, pushed 2026-07-09
- `eudi-srv-web-relyingparty-registration-py` — reference RP registration service
- Conformance test cases: https://conformance.eudi.dev

### Primary — criticism
- Cryptographers' Feedback on the EU Digital Identity's ARF (June 2024) —
  https://files.dyne.org/eudi/cryptographers-feedback-june2024.pdf
- ARF GitHub issues #200, #305, #572 (unlinkability / WebAuthn pseudonyms)

### Secondary (labelled as such)
- EU Digital Identity Wallet rollout tracker, July 2026 —
  https://www.eideasy.com/blog/eu-digital-identity-wallets-july-2026
- Biometric Update, "EUDI What? As wallet deadline looms, awareness remains low" (2026-07) —
  https://www.biometricupdate.com/202607/eudi-what-as-wallet-deadline-looms-awareness-remains-low
- Biometric Update, "EU Commission doubtful all member states will be able launch EUDI wallets this
  year" (2026-04) — ENISA quote, Launchpad readiness figures —
  https://www.biometricupdate.com/202604/eu-commission-doubtful-all-member-states-will-be-able-launch-eudi-wallets-this-year
- Biometric Update, Denmark AltID launch (2026-06) and AltID/ZKP announcement (2025-12)
- Commission age-verification blueprint pages —
  https://digital-strategy.ec.europa.eu/en/policies/eu-age-verification ,
  https://digital-strategy.ec.europa.eu/en/news/commission-releases-enhanced-second-version-age-verification-blueprint ,
  https://ageverification.dev/
- AEPD (Spanish DPA) blog, "eIDAS2, the EUDI wallet and the GDPR (II)" —
  https://www.aepd.es/en/press-and-communication/blog/eidas2-the-eudi-wallet-and-the-gdpr-ii
