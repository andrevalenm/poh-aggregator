# EU eIDAS 2.0 / European Digital Identity Wallet (EUDI Wallet)

> STATUS: in progress — research started 2026-07-24

**One-liner:** TBD
**Category:** state-identity
**Chains:** none (not a blockchain system)
**Status (2026-07):** TBD
**Aggregator verdict:** TBD

## What it proves
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

`UNVERIFIED:` no reliable public **holder counts** for any national wallet were found. This is
the single most important missing number for us.

## Implementing acts
## Architecture and Reference Framework (ARF)
## Credential formats
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

### The persistent unique identifier in the PID

The PID rulebook mandates a per-person identifier. In the ARF ZKP paper the relevant example is
`personal_administrative_number` (§4.1.4), used as the thing you would want to prove a match on
*without revealing*. `UNCLEAR:` I have not yet read the current PID Rulebook text — in ARF v3.0.0
`docs/annexes/annex-3/annex-3.01-pid-rulebook.md` is a **9-line stub** that redirects to the
separate `eudi-doc-standards-and-technical-specifications` / attestation-rulebooks repo. Next place
to look: https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog and
CIR (EU) 2024/2977 (PID/EAA specification) Annex.

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
The operative implementing act is **CIR (EU) 2025/848** (registration of wallet-relying parties),
cited throughout ARF v3.0.0 — https://data.europa.eu/eli/reg_impl/2025/848/oj. Its provisions on
RP registration **apply from 24 December 2026** (secondary sources; verify against the CIR's own
"applies from" article).

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
## Reference implementations and SDKs
## The uniqueness question
## Trust root & failure modes
## Integration surface
## Scoring-relevant facts
## Overlap with other protocols
## Open questions for us
## References
