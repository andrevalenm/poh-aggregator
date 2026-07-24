# Credential-format standards layer — ISO mdoc / W3C VC / SD-JWT VC / OpenID4VC

*Researched 2026-07-24. Volatile facts date-stamped inline.*

**One-liner:** The wire formats and protocols that government and big-tech wallets use to carry
identity attributes — ISO/IEC 18013-5 mdoc, W3C VC 2.0, SD-JWT VC — plus the OpenID4VCI/OpenID4VP
protocols and the browser Digital Credentials API a verifier would implement to consume them.
**Category:** state-identity (format layer — the formats themselves prove nothing; they carry
whatever the issuer asserted)
**Chains:** none (all off-chain; ZK-over-mdoc work is the only chain-adjacent thread)
**Status (2026-07):** live and shipping — but unevenly. SD-JWT is a finished RFC (9901, Nov 2025);
W3C VC 2.0 is a REC (May 2025); OpenID4VP is 1.0 Final; the browser Digital Credentials API is
shipped in Chrome 141 / Safari 26 / Edge 141 and landing in Firefox 149. ISO/IEC **18013-7 is still
a Technical Specification** (TS:2025, 2nd ed.; 3rd ed. expected ~2026-09-30). Status lists and
SD-JWT VC itself are **still drafts**. ZK-over-mdoc is a shipping product at Google and an
**individual IETF draft**, not a standard.
**Aggregator verdict:** **integrate later, and not as a uniqueness source.** Door-1 (verify what we
are handed) is permissionless and cheap. Door-2 (make Apple/Google Wallet hand us a state
credential) requires platform accreditation we cannot get as a crypto-native product in 2026. And
even with full access, none of these formats yields a stable unique identifier — the stack is
explicitly engineered to prevent one. Highest-value near-term play is the inverse: **issue** our
humanity assertion as an SD-JWT VC over OpenID4VCI, which is ungated.

## What it proves

Nothing, by itself. These are *containers*. What a verified mdoc or SD-JWT VC establishes is:

- **State-issued identity (strong, where present)** — a named issuing authority signed these
  attribute values, verifiable to an IACA/trusted-list root. This is the best-provenance evidence in
  the whole personhood landscape.
- **Device possession (medium)** — device authentication proves the presenter controls the private
  key the issuer bound at enrolment. It proves *a device*, not *a human*: rented phones, farmed
  devices, and coerced presentations all pass. It is not liveness.
- **Uniqueness (none, deliberately)** — see the assessment at the end. There is no nullifier, no
  stable pseudonym, and the roadmap actively removes the accidental correlators that exist today.

Marketing-vs-reality note: platform materials describe these as "verified identity." They verify
*attribute provenance and device binding*. Whether the human in front of the phone is the subject of
the credential is out of scope for every spec here — that is a liveness/biometric problem the
standards deliberately leave to the wallet's own device unlock.

## Trust root & failure modes

**Trust root:** a state issuing authority's **IACA** root (mdoc) or an issuer JWKS/trusted list
(SD-JWT VC). In the US, discovery of those roots runs through AAMVA's Digital Trust Service VICAL;
in the EU, through member-state trusted lists.

**Failure modes:**
- **Skipped device authentication.** The single most likely implementation bug. Verify only
  `issuerAuth` and an mdoc becomes a bearer token — any captured `IssuerSigned` blob replays
  forever. Same for SD-JWT VC without the KB-JWT.
- **SessionTranscript mis-binding.** If the transcript is reconstructed loosely, a device signature
  from one session replays into another. Interop-fragile and security-critical.
- **Trust-store sloppiness.** Accepting any well-formed X.509 chain rather than a pinned IACA list
  means a self-signed "issuer" passes. Chrome's guidance to maintain an approved-issuer allowlist is
  not optional advice.
- **Wallet/device compromise.** Credential extraction from a rooted device, or provisioning onto a
  device the human does not control. Sybil farms buy devices; hardware key binding raises unit cost
  but does not change the shape of the attack.
- **Issuance-side fraud.** Everything reduces to the DMV's/state's enrolment quality. A fraudulently
  obtained real licence produces a cryptographically perfect mDL.
- **Multi-jurisdiction multiplicity.** One human legitimately holds a licence in one state, an ID in
  another, and a passport — three valid state credentials. Nothing at this layer deduplicates them.
- **Correlated failure with other protocols.** Any protocol rooted in the same physical document
  (ZK-passport tooling, KYC vendors, national eID) is **not independent evidence**.
## 1. ISO/IEC 18013-5 mdoc in detail

**ISO/IEC 18013-5:2021** — "Personal identification — ISO-compliant driving licence — Part 5:
Mobile driving licence (mDL) application". It defines a *data model* (the `mdoc` / mDL), a
*credential format*, and *proximity presentation protocols*. It is a paid ISO standard (~CHF 200),
which is itself a friction point: the normative text is not free, so most implementers work from
vendor explainers, the CDDL in public libraries, and the free ISO OBP preview.

### 1.1 Wire format — CBOR + COSE

Everything is CBOR; all signatures are COSE. A presentation is a `DeviceResponse`:

```
DeviceResponse = {
  "version": "1.0",
  "documents": [ Document ],
  "status": 0
}
Document = { "docType": "org.iso.18013.5.1.mDL",
             "issuerSigned": IssuerSigned,
             "deviceSigned": DeviceSigned }
IssuerSigned = { "nameSpaces": { "org.iso.18013.5.1": [ IssuerSignedItem, ... ] },
                 "issuerAuth": COSE_Sign1 }
IssuerSignedItem = { "digestID": 0,
                     "random": h'<salt>',
                     "elementIdentifier": "age_over_18",
                     "elementValue": true }
```

Source (concrete structures, worked example):
[abhvio.us — Mobile Driver License format](https://abhvio.us/posts/mdoc/) (secondary but technically
detailed and consistent with the standard's CDDL).

**Selective disclosure = salted hashes.** Each attribute is a `IssuerSignedItem` with a random
salt. The issuer hashes each item and puts the digests in the MSO. To disclose an attribute, the
holder sends the full pre-image item; the verifier recomputes `SHA-256(CBOR(IssuerSignedItem))` and
matches it against `valueDigests`. Undisclosed attributes leave only an unmatched digest. Note the
consequence: **the verifier always sees the *number* of attributes in the credential and their
digest IDs**, even undisclosed ones. Same basic construction as SD-JWT, different serialisation.

### 1.2 The MSO and its signature chain

```
MobileSecurityObject = {
  "version": "1.0",
  "digestAlgorithm": "SHA-256",
  "docType": "org.iso.18013.5.1.mDL",
  "valueDigests": { "org.iso.18013.5.1": { 0: h'…', 1: h'…', … } },
  "deviceKeyInfo": { "deviceKey": COSE_Key },
  "validityInfo": { "signed": …, "validFrom": …, "validUntil": … }
}
```

The MSO is wrapped in `issuerAuth`, a `COSE_Sign1`:
`[ protected_headers, {x5chain: certs}, payload=MSO_bytes, signature ]`, typically ES256.
The signing certificate is a **Document Signer (DS)** certificate, chained to an
**IACA (Issuing Authority Certificate Authority)** root held by the issuing state. A verifier
therefore needs a **trusted IACA root list** — the equivalent of the passport world's ICAO PKD
master list. Google's docs are explicit: *"You must use the `issuerSigned` data and validate it
against the official IACA certificates."*
([Google](https://developers.google.com/wallet/identity/verify/accepting-ids-from-wallet-online))
`UNCLEAR:` there is no single global public IACA trust list comparable to the ICAO PKD; in the US
AAMVA operates the Digital Trust Service. Confirm access terms — this is a real gating question
(see assessment).

### 1.3 Issuer data authentication vs device authentication — two distinct proofs

This distinction is load-bearing and routinely conflated:

- **Issuer data authentication** — verify `issuerAuth` (COSE_Sign1 over MSO) up to an IACA root,
  then verify each disclosed item's digest is in `valueDigests`. Proves: *a recognised state
  authority signed these attribute values, and they have not been altered.* Proves nothing about
  who is presenting them. **A copied/replayed `IssuerSigned` blob passes this check.**
- **Device authentication** — the MSO commits to a `deviceKey` (COSE_Key) whose private half lives
  in the phone's secure element. At presentation the holder signs a `DeviceAuthentication`
  structure (which embeds the `SessionTranscript`, i.e. the verifier's nonce and the session's
  handover data) producing `deviceSigned.deviceAuth.deviceSignature` (`COSE_Sign1`) or
  `deviceMac` (`COSE_Mac0`, used when an ECDH session key exists in proximity flows). Proves:
  *this presentation came from the device the issuer bound the credential to, freshly, for this
  session.*

Both are required for a meaningful check. Skipping device authentication is the classic
implementation bug — it turns an mDL into a bearer token that any leaked blob replays.
`elementValue` is not proof of anything without both.

Note the asymmetry: device auth binds to *a device*, not to *a human*. A rented phone, or a
credential provisioned onto a device controlled by a farm operator, still passes. For our purposes
this matters — see "What it proves".

### 1.4 Presentation flows

**Proximity (18013-5)** — device engagement via **QR code or NFC**, then data transfer over
**BLE** (most common), **NFC**, or **Wi-Fi Aware**. Session keys are established by ECDH; the
`SessionTranscript` binds the device signature to that specific engagement so a signature cannot be
replayed into another session. Reader authentication (`COSE_Sign1` over the reader request) is
supported so the mDL app can know who is asking. In 18013-5 reader auth is a *capability*, and
whether it is mandatory is an issuing-authority policy decision. `UNVERIFIED:` normative
"MUST/MAY" wording for reader auth in 18013-5:2021 — paywalled; check clause 9.1.4 if a copy is
available.

**Online / unattended (18013-7)** — **ISO/IEC TS 18013-7** is a *Technical Specification*, not yet a
full International Standard. Current published edition: **ISO/IEC TS 18013-7:2025** (2nd ed.,
cancelling and replacing TS 18013-7:2024)
([ISO OBP](https://www.iso.org/obp/ui#!iso:std:iso-iec:ts:18013:-7:ed-2:v1:en)). A **3rd edition is
expected around end of Q3 2026 (planned 2026-09-30)** per the EU's standards tracking issue
([eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications#1](https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/issues/1)).
Its annexes profile how mdoc rides existing web protocols: an **OpenID4VP over HTTP redirect**
annex, and an annex for the **W3C Digital Credentials API**. Chrome's implementation names
**"ISO 18013-7 Annex C"** as the `org-iso-mdoc` protocol; the EU tracker refers to Annexes B and D.
`UNCLEAR:` annex lettering differs between editions — pin the edition before citing an annex
letter. The practically important fact is stable: **the online mdoc profile is defined in 18013-7
and it delegates transport to OpenID4VP and/or the DC API.** OIDF and ISO agreed that ISO owns the
mdoc profile of OpenID4VP, which is why the mdoc-specific profile was *removed* from the OpenID4VP
spec itself.

**ISO/IEC 23220 series** generalises 18013-5 beyond driving licences to arbitrary mobile
eID documents (23220-1 building blocks, -2 issuance, -3 protocols, -4 protocols for remote/online).
It is the base the EUDI Wallet's mdoc profile leans on and it adds *holder* authentication concepts
beyond 18013-5's device binding.
([MATTR Learn — ISO mdoc standards](https://learn.mattr.global/docs/concepts/iso-mdoc-standards))
`UNVERIFIED:` publication status of individual 23220 parts as of 2026-07 — several were still DIS.

## 2. The mdoc linkability problem, batch issuance, and ZK

### 2.1 The problem

The MSO is a **fixed, static ECDSA signature over fixed salted digests**. Every presentation of the
same credential re-sends:

- the same `issuerAuth` signature bytes,
- the same `valueDigests` (all of them, disclosed or not),
- the same per-attribute `random` salts for whatever *is* disclosed,
- the same `deviceKey`.

Any one of those is a **global correlator**. Two verifiers who compare notes — or one verifier
across two sessions — trivially link presentations to the same credential instance. The EUDI ARF
says this plainly:

> "every attestation that is presented to a Relying Party contains a number of elements having a
> unique value. These elements include: The salt of every attribute that is presented, The hash
> values of all attributes…"
> — [EUDI ARF, Privacy risks and mitigations](https://eudi.dev/2.9.0/discussion-topics/a-privacy-risks-and-mitigations/)

Both *Relying Party linkability* (colluding verifiers) and *Attestation Provider linkability*
(issuer recognises its own signature if a verifier reports it) are in scope. Selective disclosure
does **not** fix this; it limits *what attributes* are shown, not *whether the showings link*.

### 2.2 The standardised mitigation: batch issuance of single-use credentials

The only mitigation that is actually standardised today is **brute force: issue many copies**.
OpenID4VCI supports batch issuance; the wallet holds N credential instances, each with fresh salts
and (importantly) **a distinct device key per instance**, and burns one per presentation.

From the ARF's mitigation catalogue:
- **Method A — once-only attestations**: *"the Wallet Unit must store a batch of attestations… must
  have a lower limit for the number of unused attestations"*. This *"fully mitigates Relying Party
  linkability"* but "creates unpredictable loads on issuers proportional to user activity."
- **Method C — rotating batches**: illustrative example of *"a batch of 20 attestations"* each used
  for *"5% of all transactions"* — partial mitigation, explicitly framed as illustrative, not
  normative. The ARF **does not prescribe a batch size.**
- OpenID4VCI's guidance is that the batch size should be **constant over time and independent of
  usage**, precisely so the refill request itself does not leak activity level.

**Operational cost, honestly:** batch issuance turns a one-time issuance into a metered
subscription. The issuer must stay online forever, must sign N× as much, must be re-contacted
whenever the wallet runs low (a refill request that itself leaks "this user is active"), and the
wallet must manage secure-element key material for every instance — which is the real bottleneck,
because each instance wants its own hardware-backed device key and secure elements have limited key
slots and slow key generation. And the whole scheme collapses if the wallet ever reuses an
instance. It is a mitigation, not a solution.

**And it does not stop issuer-verifier collusion.** If the issuer and verifier compare data, or the
issuer *is* the verifier, presentations link back to issuance regardless of batching.

### 2.3 Unlinkable alternatives — what is real

- **BBS / BBS+**: multi-message signature scheme with native selective disclosure *and*
  unlinkable proof-of-knowledge presentation (each showing is a fresh randomised proof). This is
  the "right" cryptographic answer for VC-style credentials. Status: IRTF CFRG draft
  (`draft-irtf-cfrg-bbs-signatures`) + W3C `bbs-2023` Data Integrity cryptosuite — **not adopted by
  ISO mdoc at all**, and notably **BBS+ is not even mentioned** in the ARF privacy-mitigations
  document. It also has no hardware-secure-element story (secure elements do ECDSA, not BBS), which
  is the practical reason governments have not taken it up.
- **ZK proofs over mdoc — the live thread.** Google's **Longfellow ZK** (a.k.a. `google-zk`,
  `libzk`) proves statements *about an existing ECDSA-signed mdoc* in zero knowledge, so the ECDSA
  signature never leaves the device and presentations become unlinkable *without changing the
  issuance format*. Based on Frigo & Shelat, "Anonymous credentials from ECDSA". Claimed
  performance: **ECDSA proof ~60 ms; full mdoc presentation proof ~1.2 s on mobile**.
  - Standardisation: **IETF CFRG Internet-Draft `draft-google-cfrg-libzk`** (rev -01), presented at
    IETF 125 (March 2026) — an **individual draft, not an RFC, not yet a CFRG work item** as far as
    I can confirm.
    ([datatracker](https://datatracker.ietf.org/doc/draft-google-cfrg-libzk/),
    [IETF 125 CFRG slides](https://datatracker.ietf.org/meeting/125/materials/slides-125-cfrg-longfellow-zk-00))
  - Implementations: [google/longfellow-zk](https://google.github.io/longfellow-zk/) (C++),
    a **European fork** [dyne/longfellow-zk](https://github.com/dyne/longfellow-zk), and — telling —
    an official EU wallet repo
    [eu-digital-identity-wallet/av-lib-ios-longfellow-zkp](https://github.com/eu-digital-identity-wallet/av-lib-ios-longfellow-zkp)
    (Swift bindings for ZKP generation/verification over mdoc, for the EU **age-verification** app).
    So the EU is shipping Longfellow in its AV app, not merely studying it.
    `UNVERIFIED:` licences of each repo — check `LICENSE` before use (Google's is `UNVERIFIED:`
    likely Apache-2.0).
  - Google Wallet documents a ZKP path for age verification in production
    ([Google online acceptance docs](https://developers.google.com/wallet/identity/verify/accepting-ids-from-wallet-online)).
- **ISO adding ZK to mdoc**: work is under way but the ARF's own position as of the cited version is
  merely *"Zero-Knowledge Proofs (ZKP) offer strong potential… This topic will be revisited in
  Topic G"* — i.e. **not yet specified**. `UNVERIFIED:` the exact ISO work item number for ZKP in
  18013-5/23220 (there is an amendment effort; I could not confirm its designation). Look at the
  ISO/IEC JTC1/SC17 WG10 programme of work.

**Precise summary of standardised vs proposed:**

| Mechanism | Status 2026-07 |
|---|---|
| Salted-hash selective disclosure (mdoc, SD-JWT) | **standardised, deployed** |
| Batch issuance of single-use credentials | **standardised** (OpenID4VCI), recommended by ARF, no prescribed size |
| BBS / BBS+ unlinkable presentation | IRTF draft + W3C cryptosuite; **not in mdoc, not in EUDI mitigation doc** |
| ZK over mdoc (Longfellow) | **IETF individual draft**, shipping in Google Wallet AV + EU AV app; **not an ISO standard** |
| ISO-native ZKP profile for mdoc | **proposed / future work**, not published |

## 3. W3C VC 2.0

**VCDM 2.0 became a W3C Recommendation on 2025-05-15**, together with a family of seven RECs
([W3C news](https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/),
[spec](https://www.w3.org/TR/vc-data-model-2.0/)). v1.1 was a REC from 2022-03-03.

What actually changed for an implementer:

- **Securing is now explicitly pluggable and out of the core data model.** VCDM 2.0 defines the
  *data model*; how you sign it is a separate REC. Two families:
  - **Data Integrity 1.0** (`proof` object; JSON-LD canonicalisation; cryptosuites incl.
    `eddsa-2022`, `ecdsa-2019`, and the selective-disclosure/unlinkable `bbs-2023`).
  - **Securing VCs using JOSE and COSE** ("VC-JOSE-COSE") — wrap the credential as a JWT/CWT, or
    use SD-JWT. This is the option that interoperates with the OAuth world and with wallets.
- Terminology cleanup, `validFrom`/`validUntil` replacing `issuanceDate`/`expirationDate`, media
  types (`application/vc`, `application/vp`), better extensibility, and companion RECs for
  **Bitstring Status List** and controller documents.
- JSON-LD remains in the core, and remains the thing implementers complain about: canonicalisation
  (RDFC) is a heavy dependency, and `@context` resolution is a live availability/security concern.
  The JOSE/COSE path lets you avoid most of it.

**Ecosystem reality.** VC and mdoc are two competing stacks with different constituencies: mdoc is
the ISO/government/DMV/ICAO lineage (CBOR, X.509, IACA); VC is the W3C/decentralised-identity
lineage (JSON-LD, DIDs). The EU did not pick one — the EUDI ARF mandates support for **both**
mdoc *and* SD-JWT VC, and OpenID4VP carries all of them as format identifiers (`mso_mdoc`,
`dc+sd-jwt`, `jwt_vc_json`). Practically, **W3C VC 2.0 with Data Integrity/JSON-LD is losing the
wallet layer to SD-JWT VC and mdoc**: those are the two formats named in the EUDI profile and the
two the DC API's allowed protocols carry. See the EUDI agent's file
(`research/landscape/eidas2-eudi-wallet.md`) for the policy story; do not treat the coexistence as
a technical convergence — it is a political one, and it doubles our verifier work.

## 4. SD-JWT and SD-JWT VC

**SD-JWT is now RFC 9901** (Selective Disclosure for JWTs), published **November 2025**
([RFC 9901](https://datatracker.ietf.org/doc/html/rfc9901); commentary:
[Sakimura, "Congratulations on RFC 9901"](https://www.sakimura.org/en/2025/11/7764/)). That is a
significant maturity marker: the format layer for online credentials is a *finished Internet
Standard-track RFC*, while the ISO online-presentation profile (18013-7) is still a TS.

**SD-JWT VC** — `draft-ietf-oauth-sd-jwt-vc`, at **draft-17** as of late 2025 / 2026, Standards
Track, **still a draft** ([datatracker](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)).
It adds credential semantics on top of SD-JWT: `vct` (verifiable credential type), issuer
identification/`iss` + JWT VC Issuer Metadata (`/.well-known/jwt-vc-issuer`), type metadata, and
status references.

Mechanics:

- **Serialisation**: `<Issuer-signed JWT>~<Disclosure1>~<Disclosure2>~…~[<KB-JWT>]`.
- **Disclosures**: each is base64url(JSON `[salt, claim_name, claim_value]`); the JWT payload holds
  `_sd: [ <hash>, … ]` in place of the claims, plus `_sd_alg`. Structurally identical idea to
  mdoc's `IssuerSignedItem`/`valueDigests` — salted hashes — just JSON-and-`~` instead of CBOR.
  Decoy digests are permitted to hide how many claims exist (mdoc has no equivalent).
- **Key binding**: `cnf` claim in the issuer-signed JWT holds the holder's public key; the holder
  appends a **KB-JWT** signed over `aud`, `nonce`, and `sd_hash` (a hash of the presented
  SD-JWT+disclosures). RFC 9901 defines the `SD-JWT+KB` form where key binding is **required**,
  explicitly to resist credential copying. This is the SD-JWT analogue of mdoc device
  authentication, and the same rule applies: **without verifying the KB-JWT you are accepting a
  bearer token.**

**Why it is winning online:** JSON not CBOR, plain JOSE not COSE, no JSON-LD, no BLE state machine,
trivially transported over HTTP, and it is a real RFC. Every OpenID4VP implementation supports
`dc+sd-jwt`.

**Linkability, honestly:** SD-JWT is *exactly as linkable as mdoc*. The issuer's JWS signature is a
fixed byte string presented identically every time; so are the `_sd` digest array and the salts of
whatever you disclose; so is the `cnf` public key. Two verifiers comparing the issuer signature link
the user instantly. RFC 9901's own security considerations say unlinkability requires batch-issued
single-use credentials (or a different cryptographic scheme). **Selective disclosure is not
unlinkability.** The only structural advantage over mdoc is decoy digests, which hide claim *count*,
not identity.
## 5. OpenID4VCI / OpenID4VP / Digital Credentials API

This is the layer we would actually implement. OpenID4VCI is issuance (wallet ← issuer);
**OpenID4VP is presentation (wallet → us)** and is the only part an aggregator needs unless we also
want to *issue* our humanity assertion as a wallet credential (we might — see assessment).

### 5.0 OpenID4VP 1.0 — status and shape

OpenID4VP reached **1.0 Final** at the OpenID Foundation
([spec](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)). Key mechanics:

- **Request**: an Authorization Request carrying `dcql_query`, `nonce`, `client_id`,
  `client_metadata`, and a `response_mode`. Delivered either by redirect/QR (`direct_post.jwt`) or
  through the browser DC API (`dc_api`, `dc_api.jwt`).
- **Response**: a `vp_token` containing one presentation per matched credential query.
  Encrypted response modes (`dc_api.jwt`, `direct_post.jwt`) use ephemeral JWKs supplied in
  `client_metadata`; default content encryption `A128GCM`.
- **DCQL** (Digital Credentials Query Language) replaced W3C Presentation Exchange. Structure:
  `credentials[]` each with `id`, `format` (`mso_mdoc`, `dc+sd-jwt`, `jwt_vc_json`), `meta`,
  `claims[]` (each a claims-path-pointer `path` array, optional `values` for matching),
  `claim_sets`, `trusted_authorities`, `require_cryptographic_holder_binding` (default `true`),
  plus `credential_sets` for "any one of these" logic. DCQL is a small, sane JSON language — a few
  hundred lines to implement the matching side, and as a verifier we only *emit* it.
- **`transaction_data`** binds a presentation to a specific transaction the user is authorising
  (§5.1) — potentially useful for binding a humanity proof to an on-chain address/nonce.

### 5.1 Verifier identification — the decisive mechanism

OpenID4VP does not have "registration" as a single switch; it has **Client Identifier Prefixes**,
and *which prefixes a given wallet accepts* is the real gate. From the 1.0 spec:

| Prefix | What the verifier must have | Gate? |
|---|---|---|
| `redirect_uri` | nothing — **unsigned requests only**, metadata inline | **no gate** |
| `https` / `openid_federation` | membership in a federation trust chain | yes |
| `decentralized_identifier` | a DID + signing key | weak (self-asserted) |
| `verifier_attestation` | a JWT issued by an attester the wallet trusts | **yes — third party must vouch** |
| `x509_san_dns` | X.509 leaf cert whose SAN matches your domain, chain validated by wallet | **yes — CA the wallet trusts** |
| `x509_hash` | as above, cert chain in `x5c`, identified by SHA-256 hash | yes |
| pre-registered (no prefix) | out-of-band registration with the wallet | yes |

Two normative sentences matter:

> "Requests using the `redirect_uri` Client Identifier Prefix cannot be signed because there is no
> method for the Wallet to obtain a trusted key for verification."

> "To use the Client Identifier Prefixes `openid_federation`, `decentralized_identifier`,
> `verifier_attestation`, `x509_san_dns` and `x509_hash`, Verifiers MUST be capable of securely
> storing private key material."

And for `verifier_attestation`: *"The Wallet MUST validate the signature on the Verifier attestation
JWT. The `iss` claim value … MUST identify a party the Wallet trusts … If the Wallet cannot
establish trust, it MUST refuse the request."*

So: **the protocol permits an unregistered verifier (`redirect_uri`, unsigned).** The spec does not
forbid us. But every *production wallet that holds a government credential* requires a signed
request — Google's docs mandate the signed cert in `x5c` (§7b), and EUDI-profile wallets require
registered relying parties (see the EUDI agent's file). The permissionless path exists on paper and
is closed in practice for state-issued documents. It is fully open for credentials whose issuer
*we* control or whose wallet is crypto-native.

There is also `verifier_info` (§5.11): optional attestations about the verifier attached to a
request, where *"It is at the discretion of the Wallet whether it uses the information."* This is the
hook through which EU-style "registration certificates" (which attributes an RP is legally allowed
to request) get enforced technically.

### 5.2 OpenID4VCI (issuance) — the ungated side

OpenID4VCI is an OAuth 2.0 extension: the wallet obtains an access token (authorization-code flow,
or **pre-authorized code** flow where the issuer hands the user a code/QR out of band), then calls a
**Credential Endpoint** to receive one or more credentials in a requested format. Issuer metadata
lives at `/.well-known/openid-credential-issuer` and advertises the supported
`credential_configurations_supported` (format, `vct`/`doctype`, claims, cryptographic binding
methods). **Batch issuance** — the key privacy mitigation of §2.2 — is a first-class feature here
(the wallet supplies N proofs of possession and gets N credentials back).

For us the important asymmetry: **there is no gate on being an issuer.** Nobody registers issuers;
wallets decide whether to *trust* an issuer, but any server can stand up an OpenID4VCI endpoint and
any wallet can be pointed at it. If we want a standards-layer play that is available to us today,
issuing our aggregate humanity assertion as an SD-JWT VC over OpenID4VCI is it.

### 5.3 Browser Digital Credentials API — shipped, and narrower than it looks

The W3C **Digital Credentials API** (`navigator.credentials.get({digital: {...}})`) is the piece that
matters most to us: it is the only path by which a *website* can request a wallet credential without
shipping a native app.

Status as of 2026-07:

| Browser | Version | Status | Notes |
|---|---|---|---|
| Chrome | 141 | stable, default-on (2025-09-30) | supports `openid4vp-*` **and** `org-iso-mdoc` |
| Edge | 141 | stable (2025-10) | Chromium, same surface |
| Safari | 26 | stable (2025-09-15) | **`org-iso-mdoc` only** — no OpenID4VP |
| Firefox | 149 | code landed, UX in progress | Mozilla's public standards position remains negative |

Sources: [Chrome for Developers — "Digital Credentials API shipped"](https://developer.chrome.com/blog/digital-credentials-api-shipped),
[Corbado, Digital Credentials API 2026 (secondary/vendor blog)](https://www.corbado.com/blog/digital-credentials-api),
[WebKit/Safari 26 coverage (secondary)](https://ppc.land/webkit-introduces-digital-credentials-api-for-safari-26/).

The spec is a **W3C Working Draft** under the Federated Identity WG (first Public Working Draft
2025-07); Candidate Recommendation is expected 2026–2027.
[idtechwire (secondary)](https://idtechwire.com/w3c-releases-digital-credentials-api-draft-to-advance-standardized-identity-verification-on-the-web/)

**Important governance change:** at TPAC (Nov 2025) the FedID WG *removed the open protocol
registry* and hardcoded the allowed protocol identifiers into the spec. The listed set is
`openid4vp-v1-unsigned`, `openid4vp-v1-signed`, `openid4vp-v1-multisigned`, `org-iso-mdoc`
(presentation) and `openid4vci-v1` (issuance); user agents reject anything else.
`UNVERIFIED:` exact current list — confirm against the live spec at
https://w3c-fedid.github.io/digital-credentials/ before implementing. The consequence for us is
that **a crypto-native credential format cannot be plugged into the browser API** — you cannot
define `protocol: "world-id-v1"`. Anything we want carried through the browser DC API must be
expressed as OpenID4VP or mdoc.

Chrome request shape (from the Chrome blog):

```js
const cred = await navigator.credentials.get({
  digital: {
    requests: [{
      protocol: "openid4vp-v1-unsigned",
      data: { response_type: "vp_token", nonce: "...", client_metadata: {...}, dcql_query: {...} }
    }]
  }
});
```

Platform behaviour:
- **Android** — the OS Credential Manager surfaces a wallet picker; *third-party* native apps can
  register as credential providers, so the ecosystem is comparatively open.
- **iOS** — third-party wallets must implement Apple's `IdentityDocumentServices` framework plus an
  "Identity Document Provider" app extension; otherwise only Apple Wallet participates.
- **Desktop** — cross-device: Chrome renders a QR code and does the actual exchange over a
  **CTAP/BLE** hybrid transport to the phone (same tunnel as WebAuthn cross-device auth). This is
  the answer to the "browsers can't read chips" problem — see the note in §7.

**Issuance in the browser (`navigator.credentials.create()`, `openid4vci-v1`)** was an Origin Trial
in Chrome 143, but per the Corbado writeup government issuers have said they will not adopt
browser-mediated issuance until a wallet-selection binding weakness (malicious wallet intercepting
the pre-authorization code) is fixed. Treat browser issuance as **not usable in 2026**.

## 6. Revocation and freshness

Our README calls freshness an unsolved problem. The standards' answers, and what each costs a
verifier:

**(a) Validity windows.** Every mdoc MSO carries `validityInfo {signed, validFrom, validUntil}`;
SD-JWT VC uses `exp`/`nbf`/`iat`. Free to check, but coarse — an mDL is valid for years.

**(b) Short-lived credentials.** Issue with a lifetime of hours/days so revocation is implicit.
This needs no status infrastructure and leaks nothing to the issuer at verification time, and it
pairs naturally with batch issuance (refill and rotate at once) — but it makes the issuer a
permanently-online dependency. Cost to verifier: zero. Cost to issuer: everything.

**(c) Status lists.** Two competing specs, both bitstring designs:
- **IETF Token Status List (TSL)** — `draft-ietf-oauth-status-list`, at **draft-21** as of 2026 and
  **still not an RFC** ([datatracker](https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/);
  draft-15 was published 2026-01-06). Explicitly covers JWT, SD-JWT VC, CWT **and ISO mdoc**. The
  credential carries a `status.status_list` pointer with a `uri` and an integer `idx`; the verifier
  fetches a DEFLATE-compressed bitstring, indexes it, and reads a 1–8 bit status
  (valid / invalid / suspended / application-specific).
- **W3C Bitstring Status List v1.0** — a **W3C Recommendation** (part of the VC 2.0 family, May
  2025). Same idea in VC clothing. Two ecosystems, two revocation specs — again, we would implement
  both.

**Verifier cost, concretely:** one cacheable HTTPS GET per issuer per refresh window, of a signed
bitstring sized to ≥100k entries (tens of KB compressed). Cheap in compute. **The privacy cost is
the real cost and it lands on the user:** if the verifier fetches live, the issuer learns that a
verification is happening and from where. The mitigation is herd privacy — lists large enough that
`idx` is not identifying, and whole-list caching rather than per-credential queries. A verifier that
fetches per-presentation without caching leaks the correlation to the issuer.

**(d) What none of them solve for us.** Status lists tell you the *credential* is still valid. They
say nothing about whether the human still controls the device, whether the credential was rented for
the session, or whether the same human already claimed via another protocol. Freshness of a
*personhood assertion* is a different problem from credential revocation, and the standards stack
does not address it. Our aggregate must carry its own freshness semantics.

## 7. Real deployments

### 7.0 US state mDLs

As of **2026-07**, **21 US states plus Puerto Rico** issue a standards-based (ISO/IEC 18013-5) mDL
that TSA accepts at checkpoints: Alaska, Arkansas, Arizona, California, Colorado, Delaware, Georgia,
Hawaii, Illinois, Iowa, Kentucky, Louisiana, Maryland, Montana, New Mexico, New York, North Dakota,
Ohio, Utah, Virginia, West Virginia (+ PR). Alabama, Maine, Massachusetts and Nebraska are reported
as the only states not working on one.
([Regula, "Mobile Driver's License in 2026: Global Status" — secondary](https://regulaforensics.com/blog/mobile-drivers-license-verification/);
[AAMVA mDL topic page](https://www.aamva.org/topics/mobile-driver-license))
Caveat from the [Credence ID tracker (secondary, updated March 2026)](https://credenceid.com/resources/blog/us-mobile-drivers-license-mdl-state-tracker/):
**Delaware and Mississippi programs do not follow ISO/IEC 18013-5** and are not TSA-accepted.

Wallet split (Credence ID, March 2026): Apple Wallet ~15 jurisdictions, Google Wallet ~11,
Samsung Wallet ~9, state-run apps ~12. Many states appear in several.

**Adoption is thin.** The best concrete number I found: **California — >3.5M applied, ~1.7M active**,
of which ~900k are in the state's own CA DMV Wallet and the remainder spread across Apple/Google/
Samsung Wallet (reported 2026, secondary). California has ~27M licensed drivers, so this is
single-digit-percent penetration after several years. For an aggregator this is decisive:
**US mDL is not a mass-market personhood signal in 2026** — it is a niche credential held by a small,
self-selected, US-only slice of users. `UNVERIFIED:` a national total of issued mDLs; AAMVA does not
publish one that I could find.

### 7.0b Trust roots: AAMVA VICAL is *free and open* to relying parties

Important and under-appreciated: AAMVA runs the **mDL Digital Trust Service (DTS)**, which publishes
a **VICAL** — the list of participating issuing authorities' IACA public keys — and
[AAMVA's relying-party page](https://www.aamva.org/identity/mobile-driver-license-digital-trust-service/for-relying-parties)
states: *"All relying parties can download the VICAL and load it in their mDL reader
technologies… Relying parties can gain free access to the VICAL"* — subject only to accepting the
DTS Terms and Conditions, at https://vical.dts.aamva.org/. No stated vetting, no fee.

**So the US trust root is open.** If an mdoc lands in our hands we can validate it to a state IACA
without anyone's permission. The gate is not verification — it is *acquisition*.

### 7.0c Conformance / certification

`UNVERIFIED:` I could not confirm a formal, publicly-documented mDL **verifier** certification
programme in the US as of 2026-07. What exists: AAMVA's *mDL Implementation Guidelines* (v1.4 → v1.6
referenced in 2026 material) which issuing authorities must follow to join the DTS, ISO conformance
test specifications (18013-6 covers test methods), and vendor/industry interop events (OSIA, OpenID
Foundation certification for OpenID4VP implementations). The **OpenID Foundation runs conformance
certification for OpenID4VCI/OpenID4VP** — worth checking whether a verifier profile certification
exists that would help our credibility. Where to look next: openid.net/certification, ISO/IEC
18013-6, and the AAMVA DTS terms.

### 7a. Apple Wallet — "Verify with Wallet" API (native iOS only, entitlement-gated)

Source: [Apple Developer — Get started with the Verify with Wallet API](https://developer.apple.com/wallet/get-started-with-verify-with-wallet/) (read 2026-07-24).

- Access is via an **entitlement granted per bundle ID** by Apple, requested through a form. The
  entitlement (`com.apple.developer.in-app-identity-presentment`) enumerates the exact
  `document-types` and `elements` your app may ever request — Apple pins your request scope at
  grant time. Apple Pay's `com.apple.developer.in-app-payments` entitlement does *not* work.
- **Eligibility, verbatim:** *"In order to be eligible, your app must: Require an equivalent age or
  identity verification process for each user who obtains the same goods or services for the
  relevant jurisdiction; and Be in one of the following categories:"* — Access (Physical Security),
  Air Travel, Alcohol Purchase, Car Rental, Financial Services, Gig Economy, Government Services,
  Healthcare, Hospitality, Insurance, Scooter Rentals, Ticketing.
  **There is no category for "web3 sybil resistance" / "proof of personhood".** A crypto
  aggregator would have to argue itself into "Financial Services" and would still need to show it
  applies an equivalent non-ID verification path to users without an Apple ID credential.
- Supported credentials (as listed 2026-07-24): US driver's licences / state IDs in **Arizona,
  Colorado, Georgia, Hawaii, Illinois, Iowa, Maryland, Montana, New Mexico, North Dakota, Ohio,
  West Virginia, Arkansas, California, Puerto Rico**; **Japan My Number Card** (iOS 18.5+);
  **US Passport digital ID** (iOS 26.1+).
- **Web is not yet supported.** Apple's own wording: *"For browser-based online presentment, we
  intend to support the mDoc request API as developed in the W3C, pending its final definition, in
  a way that also enables presentment of conforming identity credentials from third party
  applications that meet appropriate privacy and security guidelines."* Note that Safari 26 ships
  the DC API with `org-iso-mdoc`, but Apple's *Wallet* documentation still frames web presentment
  as forthcoming — `UNCLEAR:` whether an Apple Wallet mDL can today be presented to an arbitrary
  website in Safari, or only to entitled native apps. This is worth an empirical test.

### 7b. Google Wallet — registration + CSR + signed reader certificate

Source: [Google — Online Acceptance of Digital Credentials](https://developers.google.com/wallet/identity/verify/accepting-ids-from-wallet-online) (read 2026-07-24).

- Sandbox development is open (pre-trusted test keys, no intake form). **Production requires an
  intake form** with a production **Certificate Signing Request**, display assets (logo, privacy
  policy, ToS URLs) and an **end-to-end demo video**. Google returns a signed certificate plus
  `gw_rp_metadata_bytes`.
- The verifier must present that certificate in the **`x5c` header of the signed OpenID4VP request**
  — this is **reader authentication**: the wallet checks who is asking before it releases anything.
- Two onboarding paths: **Relying Party (RP)** — you register yourself with Google; **Verifier
  Registrar (VR)** — an IDV/aggregator acts as its own CA for downstream clients. *That VR role is
  structurally the role an aggregator like us would want, and it is exactly the role that requires
  a commercial relationship with Google.*
- Protocol: **OpenID4VP 1.0**, DCQL queries, doctypes `org.iso.18013.5.1.mDL` and
  `com.google.wallet.idcard.1`. Verifier validates `issuerSigned` against **official IACA
  certificates**.
- Google documents a **ZKP path for privacy-preserving age verification** (see §2).

### 7c. Verdict on the gating question (short version)

**Both consumer wallet platforms gate the verifier.** Apple gates by entitlement + business
category; Google gates by certificate issuance. Neither is "anyone can call the API in production."
The browser DC API removes the *app-store* gate, not the *reader-authentication* gate — the wallet
still decides whether to answer based on the signed request and its trusted-reader list. Expanded
in the engineering assessment at the end.

## Engineering assessment for the aggregator

### A. What it would take to build a verifier accepting mdoc + SD-JWT VC

Scoping this as an actual work item. Assume a web product; assume we want both formats because the
EU forces both and the browsers split (Safari = mdoc only, Chrome = both).

**Components:**

1. **Request builder (OpenID4VP 1.0).** Emit `dcql_query` for the credentials we want, generate
   `nonce`, choose `response_mode` (`dc_api.jwt` for browser, `direct_post.jwt` for QR/cross-device),
   publish `client_metadata` with an ephemeral encryption JWK. *Small — days.*
2. **Browser integration.** `navigator.credentials.get({digital:{requests:[...]}})` with
   `protocol: "openid4vp-v1-unsigned"` (Chrome) **and** a separate `org-iso-mdoc` path for Safari.
   Two backends, as the Corbado writeup notes. Plus a cross-device QR fallback for desktop and for
   Firefox. *Small-medium.*
3. **Response decryption + parsing.** JWE decrypt; then two parsers:
   - **SD-JWT VC**: split on `~`, verify the issuer JWS, recompute disclosure digests against `_sd`,
     verify the **KB-JWT** (`aud`, `nonce`, `sd_hash`) against `cnf`. *Straightforward.*
   - **mdoc**: CBOR-decode `DeviceResponse`; verify `issuerAuth` `COSE_Sign1` and its `x5chain` to a
     trusted IACA; recompute `SHA-256(CBOR(IssuerSignedItem))` per disclosed item against
     `valueDigests`; reconstruct the **`SessionTranscript`** correctly for the transport in use and
     verify `deviceSignature`/`deviceMac` against the MSO's `deviceKey`. *The `SessionTranscript`
     reconstruction is the classic source of interop failure — budget real time here.*
4. **Trust stores.** IACA roots (US: AAMVA VICAL, free download; EU: member-state trusted lists —
   see the EUDI agent's file), plus SD-JWT VC issuer key resolution via
   `/.well-known/jwt-vc-issuer`. Refresh, pin, and monitor.
5. **Status checking.** IETF Token Status List fetch + cache (and W3C Bitstring Status List for the
   VC path), with whole-list caching for herd privacy.
6. **Policy layer.** Approved-issuer allowlist. Chrome's own guidance: *"maintain a list of approved
   issuers and reject any issuer that doesn't match."* An unknown-issuer mdoc is worthless.

**Honest estimate:** a competent engineer gets SD-JWT VC verification working in ~1–2 weeks;
mdoc verification including device auth and session transcript in ~3–6 weeks; the browser/wallet
integration matrix and trust-store operations are the long tail. Call it **one engineer-quarter for
a production-grade dual-format verifier**, most of it spent on interop rather than cryptography.

### B. Libraries (name + language + licence)

| Library | Language | Scope | Licence |
|---|---|---|---|
| [openwallet-foundation/multipaz](https://github.com/openwallet-foundation/multipaz) | Kotlin Multiplatform (Android/iOS/JVM server), + Swift & JS/WASM bindings | The most complete: mdoc + SD-JWT VC, wallet **and** `multipaz-verifier` reader, 18013-5 proximity, 18013-7:2025 DC API, OpenID4VP 1.0, **and `multipaz-longfellow` (ZKP)** | **Apache-2.0** |
| [spruceid/openid4vp](https://github.com/spruceid/openid4vp) (crates.io `openid4vp`) | Rust | OID4VP 1.0, verifier and wallet sides; formats `jwt_vc_json`, `ldp_vc`, `dc+sd-jwt`, `mso_mdoc` | **MIT** |
| [openwallet-foundation-labs/oid4vc-ts](https://github.com/openwallet-foundation-labs/oid4vc-ts) | TypeScript | OpenID4VCI + OpenID4VP; formats incl. `vc+sd-jwt`, `dc+sd-jwt`, `mso_mdoc` | **Apache-2.0** |
| [animo/mdoc](https://github.com/animo/mdoc) — npm `@owf/mdoc` (also published as `@animo-id/mdoc`) | TypeScript (Node/browser/RN) | Issue **and verify** mdoc/mDL CBOR per ISO 18013-5/-7 | **Apache-2.0** (confirmed on repo, 2026-07-24). `UNCLEAR:` whether device-auth verification is implemented — check before relying on it |
| [eu-digital-identity-wallet/eudi-srv-web-verifier-endpoint-23220-4-kt](https://github.com/eu-digital-identity-wallet/eudi-srv-web-verifier-endpoint-23220-4-kt) | Kotlin | EU reference **Verifier/RP backend** implementing OpenID4VP 1.0 | `UNVERIFIED:` stated as Apache-2.0 across the EUDI repos — confirm |
| [stelauconseil/mdoc-web-verifier](https://github.com/stelauconseil/mdoc-web-verifier) | JS (browser) | mDL/mdoc 18013-5 reader+verifier entirely in-browser — good reference/test harness | **Apache-2.0** |
| [google/longfellow-zk](https://google.github.io/longfellow-zk/) / [dyne/longfellow-zk](https://github.com/dyne/longfellow-zk) / [eu-digital-identity-wallet/av-lib-ios-longfellow-zkp](https://github.com/eu-digital-identity-wallet/av-lib-ios-longfellow-zkp) | C++ / Swift | ZK proofs over mdoc (Longfellow) | `UNVERIFIED:` — check each `LICENSE`; Google's is likely Apache-2.0 |
| spruceid `isomdl` | Rust | ISO 18013-5 mdoc primitives | `UNVERIFIED:` — I did not confirm this crate's existence/licence directly; verify on crates.io before citing |

**Recommendation:** if we build server-side in JVM/Kotlin, **Multipaz** is the single best bet —
it is the OpenWallet Foundation's flagship, Apache-2.0, covers both formats, both roles, proximity
and DC API, and already integrates Longfellow ZK. Caveat: **pre-1.0 (v0.99.0), 1.0 expected late
2026/early 2027**, releases every 4–8 weeks — expect churn. For a Node/TS stack, combine
`oid4vc-ts` (protocol) with `@animo-id/mdoc` (format).

### C. The decisive question: can an unaccredited crypto-native verifier participate?

**Answer: it depends on which door, and the two doors have opposite answers.**

**Door 1 — verifying a credential we already have: OPEN.** Nothing in mdoc, SD-JWT VC, or OpenID4VP
requires the *verifier* to be accredited in order to *check a signature*. The AAMVA VICAL is a free
download under click-through terms; EU trusted lists are public. Cryptographic verification is
permissionless. OpenID4VP explicitly permits the `redirect_uri` client identifier prefix with
**unsigned** requests and no key material — a wallet is free to answer an anonymous verifier, and
the spec says so.

**Door 2 — getting a real wallet to hand us a government credential: CLOSED without accreditation.**
Every production path gates:

- **Google Wallet:** production requires an intake form, a **Certificate Signing Request**, display
  assets, an end-to-end demo video, and Google returns a signed certificate that **must** appear in
  the `x5c` header of the signed OpenID4VP request. Sandbox is open; production is not.
- **Apple Wallet:** an **entitlement per bundle ID**, granted only to apps in one of twelve
  enumerated business categories, that can show a *legal requirement* for identity verification,
  with the exact document types and data elements pinned into the entitlement plist. **Native iOS
  only** — Apple's own text still frames browser presentment as future work. There is no category
  that fits "sybil resistance for a crypto protocol."
- **EU:** relying-party registration + registration certificates constrain which attributes an RP
  may request; OpenID4VP's `verifier_info` / `verifier_attestation` are the technical hooks.
  (Detail in the EUDI agent's file.)
- **The browser Digital Credentials API does not open this door.** It removes the app-store
  distribution gate, not the reader-authentication gate: the wallet still decides whether to answer
  based on the signed request and its trusted-reader policy. And the DC API's protocol registry was
  *hardcoded* at TPAC Nov 2025, so we cannot introduce a crypto-native protocol into it either.

**Conclusion, plainly: no.** An unaccredited, crypto-native verifier cannot obtain state-issued
mDL/PID presentations from Apple Wallet or Google Wallet in production in 2026. The permissionless
path exists in the specs and is unavailable in the deployments. **This matches the EU-legal-side
finding the sister agent is chasing — the gate is enforced both legally (RP registration) and
technically (reader auth certificates / entitlements), independently.**

Realistic options for us, in order of practicality:
1. **Don't be the verifier — consume one.** Partner with or resell an accredited IDV that already
   holds the Google certificate / Apple entitlement (Google's **Verifier Registrar** role exists
   precisely for aggregators acting as a CA for downstream clients — that is our shape, but it is a
   commercial relationship with Google, not a permissionless integration).
2. **Accept mdoc/SD-JWT VC from crypto-native wallets we can influence**, where no platform gate
   exists — this is real and cheap, and lets us support EUDI-style credentials without touching
   Apple/Google.
3. **Apply for accreditation ourselves** and accept that it means legal entity, jurisdiction, stated
   purpose, and a business category. Expensive, slow, and constrains the product.
4. **Route around the format layer entirely** for state identity — use ZK-passport tooling
   (see the ZK-passport agent's file) which reads the eMRTD chip via a native app and needs no
   relying-party accreditation because it verifies ICAO passive-authentication signatures directly.

### C.1 The chip-reading constraint — does it apply to mdoc?

The ZK-passport agent's finding (no browser can read a passport chip; Web NFC is NDEF-only; iOS
ISO7816 needs an Apple entitlement) **does not apply to mdoc presentation**, and this is a genuine
product difference:

- An mdoc is **already provisioned into a wallet app**. Presentation reads from the wallet, not from
  a chip. The Digital Credentials API therefore genuinely works from a web page: on Android the OS
  Credential Manager brokers to the wallet; on desktop Chrome tunnels to the phone over **CTAP/BLE**
  (the WebAuthn hybrid transport). **No native app required on our side.**
- The chip constraint moves upstream to **issuance**: getting the mDL into the wallet in the first
  place required a native, state-run enrolment (often including a chip/document scan). We inherit
  that work for free, and inherit its coverage limits (21 US states, low penetration).
- So: **mdoc = web-native presentation, gated by platform accreditation. ZK-passport = native-app
  presentation, ungated.** They trade a distribution constraint for a permission constraint. Given
  our position, the ungated-but-native path is likely more valuable than the web-native-but-gated
  one.

### D. Can any of this yield a stable unique identifier for sybil resistance?

**No — and the absence is deliberate, systematic, and getting stronger.**

Enumerate the candidate identifiers and why each fails:

| Candidate | Why it fails as a sybil key |
|---|---|
| Document number (`document_number`) | Disclosable in principle, but it is **not stable per human** — it changes on renewal, and one human legitimately holds licences from multiple jurisdictions plus a passport. Also maximally privacy-invasive, so wallets/RP-registration will not permit requesting it. Apple pins requestable elements in the entitlement. |
| Name + DOB | Not unique, not stable, and a full-attribute request is exactly what RP registration exists to prevent. |
| `deviceKey` in the MSO | Per-credential-instance, and **deliberately rotated per instance under batch issuance** — the mitigation for linkability is precisely making this non-stable. |
| Issuer signature bytes / `valueDigests` / salts | These *are* stable correlators today — which is why the entire standards effort is aimed at destroying them (batch issuance now, ZK later). Building on them means building on a bug the ecosystem is actively fixing. |
| SD-JWT `cnf` key | Same as `deviceKey`: per-instance, rotated. |
| A ZK nullifier | **Does not exist in any of these standards.** mdoc, SD-JWT VC, VC 2.0, OpenID4VP: none defines a per-verifier deterministic nullifier. Longfellow proves *predicates* over an mdoc (e.g. `age_over_18`) in ZK; it does not derive a stable pseudonym. |

The design intent is explicit in the ARF privacy work: the goal is that repeated presentations
**cannot** be linked, by anyone, including the issuer. A stable unique identifier is the precise
thing these standards are engineered to eliminate. The ideal end state of this stack —
ZK-over-mdoc, per-verifier unlinkable — is **the exact opposite of what a sybil-resistance
aggregator wants**.

The residual, uncomfortable truth: **today's linkability bug is tomorrow's absence.** If we built
sybil resistance on "same issuer signature = same human," it would work right now against most
deployed mDLs and would break the moment batch issuance or ZK lands. That is not a foundation.

**What this stack *can* give us**, and we should scope to exactly this:
- A **high-quality, state-rooted attribute assertion** (age band, jurisdiction, name) with real
  cryptographic provenance and device binding — strong *evidence*, weak *uniqueness*.
- A **liveness/possession signal**: device auth proves control of a hardware key the state bound to
  a real enrolment.
- If we need uniqueness on top, **we must derive the nullifier ourselves** in a layer we control —
  e.g. our own ZK circuit over a disclosed stable field, or a registry keyed on something we
  extract at enrolment. That means being the accredited verifier (Door 2), which loops back to §C.

Consequently: **the standards layer is an input to our score, not a source of uniqueness.** Weight
it as state-identity evidence with a jurisdiction tag, deduplicate against other state-identity
protocols that share the same root document (US mDL and a US passport-based ZK proof are *not*
independent evidence about the same person), and never treat two mdoc presentations as necessarily
two people or one person.

## Open questions for us

1. **Can an Apple Wallet mDL be presented to an arbitrary website via Safari 26's DC API today**, or
   does Apple still restrict presentment to entitled native apps? Apple's Wallet docs say web is
   "intended"; WebKit shipped `org-iso-mdoc`. This is empirically testable and worth 30 minutes with
   a test page and a real California mDL.
2. **What are Google's actual approval criteria** for the RP intake form and the Verifier Registrar
   role — is there a published policy, and would a crypto product be rejected on category grounds
   the way Apple's list implies? Where to look: the intake form itself, Google Wallet partner terms.
3. **Do any crypto-native wallets speak OpenID4VP?** If a wallet accepts a `redirect_uri`-prefix
   unsigned request, the permissionless path is live for credentials we or partners issue. Worth
   surveying (Animo/Paradym, walt.id, Talao, Sphereon).
4. **Should we *issue* our humanity assertion as an SD-JWT VC** and offer an OpenID4VCI endpoint? We
   would control the format, there is no gate on issuers, and it makes our output consumable by any
   EUDI-profile verifier. Low cost, real distribution upside. This is probably the strongest
   standards-layer play available to us.
5. **Longfellow licence and portability** — if ZK-over-mdoc is Apache-2.0 and the EU is shipping it,
   can we verify Longfellow proofs server-side, and could we ever get a *nullifier* added to such a
   circuit (it would be a small circuit change, and it is exactly what nobody in this ecosystem
   wants)?
6. **ISO ZKP work item number** — unconfirmed. Check ISO/IEC JTC1/SC17 WG10's programme of work.
7. **Is there an OpenID Foundation conformance certification for *verifiers*** that would give us
   third-party credibility without platform accreditation? Check openid.net/certification.

## References

**Standards / specs**
- ISO/IEC 18013-5:2021 — mDL application (paid). Free preview via ISO OBP.
- ISO/IEC TS 18013-7:2025 (2nd ed.) — mDL add-on functions / internet presentation:
  https://www.iso.org/obp/ui#!iso:std:iso-iec:ts:18013:-7:ed-2:v1:en — 3rd edition expected
  ~2026-09-30 per https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/issues/1
- ISO/IEC 23220 series — generalised mobile eID building blocks (overview:
  https://learn.mattr.global/docs/concepts/iso-mdoc-standards)
- W3C Verifiable Credentials Data Model v2.0 (REC 2025-05-15): https://www.w3.org/TR/vc-data-model-2.0/
  — family announcement: https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/
- RFC 9901 — Selective Disclosure for JWTs (SD-JWT), Nov 2025: https://datatracker.ietf.org/doc/html/rfc9901
- draft-ietf-oauth-sd-jwt-vc (draft-17, Standards Track, not yet RFC):
  https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/
- OpenID for Verifiable Presentations 1.0 (Final): https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
- draft-ietf-oauth-status-list (Token Status List, draft-21, not yet RFC):
  https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/
- W3C Digital Credentials API (Working Draft, FedID WG): https://w3c-fedid.github.io/digital-credentials/
- draft-google-cfrg-libzk (Longfellow ZK, individual I-D): https://datatracker.ietf.org/doc/draft-google-cfrg-libzk/
  — IETF 125 CFRG slides: https://datatracker.ietf.org/meeting/125/materials/slides-125-cfrg-longfellow-zk-00

**Platform / deployment**
- Apple — Get started with the Verify with Wallet API: https://developer.apple.com/wallet/get-started-with-verify-with-wallet/
- Google — Online Acceptance of Digital Credentials: https://developers.google.com/wallet/identity/verify/accepting-ids-from-wallet-online
- Google — Verify with Google Wallet overview: https://developers.google.com/wallet/identity/verify
- Android Credential Manager Verifier API: https://developer.android.com/identity/digital-credentials/credential-verifier
- Chrome for Developers — Digital Credentials API shipped: https://developer.chrome.com/blog/digital-credentials-api-shipped
- AAMVA mDL Digital Trust Service — for relying parties (free VICAL):
  https://www.aamva.org/identity/mobile-driver-license-digital-trust-service/for-relying-parties
- AAMVA mDL topic page: https://www.aamva.org/topics/mobile-driver-license
- EUDI ARF — privacy risks and mitigations: https://eudi.dev/2.9.0/discussion-topics/a-privacy-risks-and-mitigations/

**Libraries**
- https://github.com/openwallet-foundation/multipaz (Apache-2.0)
- https://github.com/spruceid/openid4vp (MIT)
- https://github.com/openwallet-foundation-labs/oid4vc-ts (Apache-2.0)
- https://github.com/animo/mdoc — npm `@animo-id/mdoc`, `@owf/mdoc`
- https://github.com/eu-digital-identity-wallet/eudi-srv-web-verifier-endpoint-23220-4-kt
- https://github.com/stelauconseil/mdoc-web-verifier (Apache-2.0)
- https://google.github.io/longfellow-zk/ · https://github.com/dyne/longfellow-zk ·
  https://github.com/eu-digital-identity-wallet/av-lib-ios-longfellow-zkp

**Secondary / commentary (labelled as such)**
- Corbado, "Digital Credentials API (2026): Chrome, Safari & Firefox": https://www.corbado.com/blog/digital-credentials-api
- Credence ID, US mDL state tracker (March 2026): https://credenceid.com/resources/blog/us-mobile-drivers-license-mdl-state-tracker/
- Regula, "Mobile Driver's License in 2026: Global Status": https://regulaforensics.com/blog/mobile-drivers-license-verification/
- abhvio.us, "Mobile Driver License format" (concrete CBOR structures): https://abhvio.us/posts/mdoc/
- N. Sakimura on RFC 9901: https://www.sakimura.org/en/2025/11/7764/
- ppc.land on WebKit/Safari 26 DC API: https://ppc.land/webkit-introduces-digital-credentials-api-for-safari-26/
- ID Tech Wire on the W3C DC API draft: https://idtechwire.com/w3c-releases-digital-credentials-api-draft-to-advance-standardized-identity-verification-on-the-web/

**Cross-references (do not duplicate)**
- EU policy, eIDAS 2.0, EUDI rollout, RP registration law → `research/landscape/eidas2-eudi-wallet.md`
- ZK passport tooling, nullifier derivations, chip-reading constraints → the ZK-passport agent's file
  in `research/protocols/`
