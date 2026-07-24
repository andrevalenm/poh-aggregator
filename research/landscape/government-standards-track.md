# The government & standards track — eIDAS 2.0, EUDI Wallet, ISO mdoc, and ZK over government credentials

> **Salvaged.** Reconstructed from two research agents (rows 11 and 12) killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). The EU regulatory and ARF material salvaged well.
> W3C VC 2.0, OpenID4VP/VCI, and BBS+ IETF status were on the agent's list but **never researched** —
> it died first. Row 10 (national ZK identity efforts) is a separate file.

**Why this matters to us:** by **end of December 2026 — five months from now — every EU member state
must offer its citizens a digital identity wallet.** If even a fraction of that lands, a
government-issued, cryptographically verifiable credential becomes available to hundreds of millions
of people. That would be, by a wide margin, the largest personhood-adjacent credential pool in
existence, and it would arrive on standards rails rather than as a startup's API.

The catch, which is the central technical finding of this file: **the credentials being shipped are
selective-disclosure, not zero-knowledge — and they are linkable by construction.** ZK is mandated in
principle, unresolved in practice, and expected post-launch.

## eIDAS 2.0 — Regulation (EU) 2024/1183

- **Entered into force 2024-05-20.**
- **Member states must provide at least one EUDI Wallet by end of December 2026** (24 months from
  adoption of the implementing acts).
- **Relying-party acceptance obligations bite later:** obligated private-sector organisations —
  banking, healthcare, telecoms, large online platforms — must accept the wallet as an authentication
  method by **late 2027**. Per the recitals: **Article 56** covers private relying parties in
  regulated sectors where strong authentication is legally required, with requests "necessary for, and
  proportionate to, the intended use"; **Article 57** covers very large online platforms, which must
  accept the wallet "upon the voluntary request of the user."

Privacy language in the recitals — note these are **recitals, which guide interpretation but are not
directly binding operative provisions**:

| Recital | Content |
|---|---|
| 14 | zero-knowledge proof: cryptographic methods "should allow a relying party to validate whether a given statement… is true, **without revealing any data**"; member states "should integrate different privacy-preserving technologies, such as zero knowledge proof" |
| 32 | **unobservability** — providers "should ensure unobservability by not collecting data and not having insight into the transactions" |
| 59 | **selective disclosure** — users "disclose only certain parts of a larger data set" |
| 60 | pseudonymous access |
| 12, 17, 56–57 | data minimisation as a core principle |

**Implementing regulations** (all 2024-11-28): **2024/2977** (requirements for person identification
data and electronic attestations of attributes), **2024/2979** (wallet integrity and core
functionalities), **2024/2980** (notifications to the Commission), **2024/2982**. The key operative
line: providers "shall enable privacy preserving techniques which ensure **unlinkability** where the
electronic attestations of attributes do not require the identification of the user" — including
across different relying parties, and for the wallet unit attestation itself.

> `UNVERIFIED:` the exact **article numbers** for the wallet-provision obligation and the ZKP/
> unobservability requirements were never pinned down — the EUR-Lex fetch cut off mid-definitions.
> Article 56/57 above come from recital cross-references, not from reading the articles. **Verify
> against EUR-Lex before quoting an article number in anything external.**

## EUDI Wallet ARF — v3.0.0

The Architecture and Reference Framework is the technical spec.

Release history: **v3.0.0 (2026-07-23** — one day before this research; a source also gives 2026-07-21
for the tag), v2.9.0 (2025-05-21), v2.8.0 (2025-02-02), v2.7.x (Nov 2024), v2.6.0 (2024-10-13),
v2.5.0 (2024-09-15), v2.4.0 (2024-07-18).

v3.0.0 introduces a "Functional Conformance Assessment Framework," aligns with the Commission
Implementing Regulations, and addresses trust-anchor retrieval and wallet-to-wallet interactions.
**Its release notes do not mention ZKP or unlinkability** — which is itself the story.

### ZKP in the ARF — mandated in principle, unsettled in practice

ZKP is **Topic G** in the ARF's Annex 2 topic list (source file `g-zero-knowledge-proof.md`,
[Discussion #408](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/discussions/408),
opened 2025-02-20, 29+ comments and still active). High-level requirements:

| ID | Requirement |
|---|---|
| `ZKP_01` | generic functions for attribute proofs, validity, non-revocation, and **device binding to a key stored in the WSCD** |
| `ZKP_05` | usable in both remote and proximity flows |
| `ZKP_06` | **backward compatible with ISO 18013-5 and SD-JWT attestations** |
| `ZKP_07` | privacy preservation — no tracking or linking of communication |
| `ZKP_08` | Commission-standardised algorithms only |
| `ZKP_09` | compatible with Level of Assurance "high" |

Candidate schemes: **BBS+ / BBS#** (BBS# adds device binding via ECDSA/P-256, "requiring minimal
updates to existing secure elements"), **zk-SNARKs** (Cinderella, zk-creds, anonymous credentials
from ECDSA), plus CL signatures (Idemix, IRMA), **Baby Jubjub (iden3)**, and KVAC for constrained
devices.

Proposed performance bar: **proof generation under 1 second** (banking/transport want 300–500ms),
signature size "a few kilobytes," on a Snapdragon 680-class device.

Unresolved debates worth knowing: **everlasting privacy** (Orange, and the Spanish DPA **AEPD**,
pushing for unconditional/post-quantum privacy — currently *not* a mandatory requirement); whether
**deniable issuance** should be mandatory; and heavy criticism that the requirements optimise for
issuer burden while ignoring relying-party and holder impact. **Timeline: ZKP integration is expected
"post-launch."** Technical Specification **TS04** will carry implementation detail.

### The cryptographers' open letter

In June 2024 the Commission convened cryptographers to review ARF v1.4.0. Their published feedback is
blunt:

> "The current approach taken by SD-JWT is deeply flawed, as it relates to unlinkability and
> cryptographic agility, and has been flawed from the beginning."

They also note that achieving unlinkability via **batch issuance** of many single-use credentials is
"neither ideal for security nor usability," since the user must generate and securely store a fresh
key pair per credential.

Signatories include Carsten Baum, Olivier Blazy, Jaap-Henk Hoepman, Anja Lehmann, Anna Lysyanskaya,
René Mayrhofer, Hart Montgomery, Ngoc Khanh Nguyen, abhi shelat, Daniel Slamanig, Søren Eller
Thomsen, plus Jan Camenisch, Eysa Lee, Bart Preneel, Stefano Tessaro and Carmela Troncoso.
([PDF](https://files.dyne.org/eudi/cryptographers-feedback-june2024.pdf) ·
[Discussion #211](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/discussions/211))

**When that many serious cryptographers co-sign a statement that a deployed design is broken on
unlinkability, we should not build a privacy claim on top of that design.**

## ISO/IEC 18013-5 mdoc — and why it is linkable

- **ISO/IEC 18013-5:2021**, Edition 1, published **2021-09**, 152 pages, now at **stage 90.92 —
  "International Standard to be revised."**
- **Second edition in progress:** CD ballot opened 2024-12-11 (comments due 2025-02-05), then a
  5-month DIS ballot; `ISO/IEC DIS 18013-5` exists and "will replace ISO/IEC 18013-5:2021." The
  European Commission expected a stable second edition by end of 2025 — **which appears to have
  slipped.** The second edition adds **revocation**, absent from edition 1: an **Attestation Status
  List (ASL)** and **Attestation Revocation List (ARL)**, with ASL referencing IETF's **Token Status
  List**.
- **ISO/IEC TS 18013-7:2025** (2nd edition, cancels and replaces TS 18013-7:2024) covers online /
  unattended presentation. **Annex B specifies an OpenID4VP profile**, mdoc-specific, using a custom
  `mdoc://` scheme.
- **ISO/IEC TS 18013-6:2025** covers mDL test methods.

### The linkability problem, stated precisely

This is the most important technical distinction in this file, and it is easy to get wrong:

- **mdoc selective disclosure is salted-hash based, not zero-knowledge.** The issuer signs a
  `MobileSecurityObject` (MSO) containing `ValueDigests` — hashes of each `IssuerSignedItem`
  (`digestID`, `random` salt, `elementIdentifier`, `elementValue`). To disclose an attribute you
  reveal the item and its salt; the verifier hashes it and checks it against the signed digest.
- Therefore **the verifier learns the exact claim value.** "Over 18" means revealing the date of birth
  — there is no predicate proof.
- And crucially, **the issuer's signature over the MSO is a static correlator, reused across every
  presentation.** So is the device key signature in `DeviceAuth`. Two different verifiers, or one
  verifier over time, can trivially correlate presentations as the same credential.

Mitigation in practice is **batch issuance** of many one-time-use credentials — which is exactly what
the cryptographers called out as unsatisfactory.

**This is the difference between selective disclosure and ZK, and it is the gap our whole thesis has
to reckon with.** A wallet-issued government credential is high-assurance and linkable; a ZKPassport
proof is lower-assurance-of-issuance but unlinkable. An aggregator that ingests both must not treat
them as equivalent privacy-wise.

> `UNVERIFIED:` **ISO/IEC 23220 series** (23220-1 through -4, generalising mdoc beyond driving
> licences) — titles, scope, and publication status were requested and never obtained. The agent hit
> its search budget and noted that `iso.org` blocks WebFetch. Same for any ISO work item on ZKP for
> mdoc.

## ZK over government credentials — Longfellow

This is the bridge between the two worlds, and it is real, shipped code.

**[`google/longfellow-zk`](https://github.com/google/longfellow-zk)** — "Implementation of the Google
Zero-Knowledge library for Identity Protocols," designed to build ZK proofs over **legacy** identity
standards: **ISO mdoc, JWT, and W3C VCs**. It combines two circuits that together verify **ECDSA
(P-256) signatures and SHA-256 digests** found in a signed mdoc/mDL — i.e. it proves, in zero
knowledge, that you hold a validly-issued mdoc, without handing over the correlating signature.

- **In Google Wallet today:** mDL implementations "can change the request format to `mso_mdoc_zk` and
  provide the required `zk_system_type` configuration" to prove e.g. over-18 without revealing the
  birthdate. Google has [open-sourced its ZKP libraries for age assurance](https://blog.google/innovation-and-ai/technology/safety-security/opening-up-zero-knowledge-proof-technology-to-promote-privacy-in-age-assurance/).
- **European fork:** [`dyne/longfellow-zk`](https://github.com/dyne/longfellow-zk), maintained by the
  Dyne.org foundation in Amsterdam "to best serve the purposes of the EUDI ARF development."
- **And the EU wallet project itself has a Swift binding:**
  [`eu-digital-identity-wallet/av-lib-ios-longfellow-zkp`](https://github.com/eu-digital-identity-wallet/av-lib-ios-longfellow-zkp)
  — ZKP generation and verification of mdoc credentials on iOS, built on Google's MdocZK native
  library. **That repo living under the official EU wallet org is a strong signal about where this is
  heading**, notwithstanding that Longfellow is *not* named in the ARF's Topic G scheme list.
- Related: [`openwallet-foundation/multipaz`](https://github.com/openwallet-foundation/multipaz).

**This is the most actionable thing in this file.** If Longfellow matures, a EUDI/mDL credential
becomes an unlinkable ZK personhood signal that we could consume the same way we consume a ZKPassport
proof — with a *government* trust root and, by 2027, potentially continent-scale coverage.

## What this changes about our design

1. **Put a 2027 line in the roadmap.** EUDI wallets land end-2026; RP acceptance obligations bite
   late 2027. Whatever we build should have a clean slot for "government wallet credential."
2. **Do not conflate selective disclosure with ZK in our scoring.** An mdoc presentation is linkable
   and reveals exact values. Our privacy story (hard problem #3 in the README) has to treat these as a
   distinct, lower privacy tier — and we should say so to users.
3. **Track Longfellow specifically.** It is the mechanism by which a government credential becomes
   privacy-preserving, it is already in the EU wallet org, and it works over the same ICAO/mdoc
   substrate ZKPassport uses.
4. **Same correlated-failure warning as ever:** an EUDI PID, a World ID NFC credential and a
   ZKPassport proof can all derive from one national identity. One root, one score.
5. **Watch revocation.** mdoc edition 2 adds ASL/ARL over IETF Token Status List — that is a real
   answer to freshness/revocation (README hard problem #5) that we could adopt rather than invent.

## Open questions

1. Exact article numbers in 2024/1183 for wallet provision and privacy requirements.
2. W3C VC 2.0 recommendation status, `vc-di-bbs` cryptosuite status, VC-JOSE-COSE — **never researched.**
3. OpenID4VP / OpenID4VCI current spec status and how DCQL requests claims — **never researched.**
4. `draft-irtf-cfrg-bbs-signatures` status, plus blind BBS and pseudonyms drafts — **never researched.**
5. ISO/IEC 23220 series status.
6. Is TS04 published, and does it settle BBS# vs zk-SNARK?
7. Confirmed: **SD-JWT is now RFC 9901** (published November 2025, Fett / Yasuda / Campbell), superseding
   `draft-ietf-oauth-selective-disclosure-jwt-22`. SD-JWT VC status separately unconfirmed.

## Sources

- [Regulation (EU) 2024/1183 on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1183/oj)
- Implementing Regulations [2024/2977](https://eur-lex.europa.eu/eli/reg_impl/2024/2977/oj/eng) · [2024/2979](https://eur-lex.europa.eu/eli/reg_impl/2024/2979/oj/eng) · [2024/2982 (PDF)](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202402982) · [amendments to 2024/2977 (2026)](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=PI_COM:Ares(2026)1286304)
- [EUDI ARF repo](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework) · [releases](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/releases) · [eudi.dev](https://eudi.dev/latest/) · [Topic G — ZKP discussion](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/discussions/408) · [ZKP overview (DeepWiki)](https://deepwiki.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/5.2-zero-knowledge-proofs)
- [Cryptographers' Feedback (PDF)](https://files.dyne.org/eudi/cryptographers-feedback-june2024.pdf) · [Discussion #211](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/discussions/211) · [Lysyanskaya, NIST WPEC 2024 slides](https://csrc.nist.gov/csrc/media/presentations/2024/wpec2024-3b5/images-media/wpec2024-3b5-slides-anna--anon-cred-EUDI.pdf)
- [ISO/IEC 18013-5:2021](https://www.iso.org/standard/69084.html) · [ISO/IEC DIS 18013-5](https://www.iso.org/standard/91081.html) · [ISO/IEC TS 18013-7:2025](https://www.iso.org/obp/ui#!iso:std:iso-iec:ts:18013:-7:ed-2:v1:en) · [EUDI standards tracker issue #84](https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/issues/84)
- [RFC 9901 — SD-JWT](https://datatracker.ietf.org/doc/html/rfc9901)
- [google/longfellow-zk](https://github.com/google/longfellow-zk) · [docs](https://google.github.io/longfellow-zk/) · [dyne/longfellow-zk](https://github.com/dyne/longfellow-zk) · [EU iOS Longfellow binding](https://github.com/eu-digital-identity-wallet/av-lib-ios-longfellow-zkp) · [Google blog — open-sourcing ZKP for age assurance](https://blog.google/innovation-and-ai/technology/safety-security/opening-up-zero-knowledge-proof-technology-to-promote-privacy-in-age-assurance/) · [Verify with Google Wallet](https://developers.google.com/wallet/identity/verify/accepting-ids-from-wallet-online)
- ETSI TR 119 476 v1.2.1 (ZKP survey, referenced in Topic G) · [Bringing data minimization to digital wallets at scale (arXiv)](https://arxiv.org/pdf/2301.00823)
