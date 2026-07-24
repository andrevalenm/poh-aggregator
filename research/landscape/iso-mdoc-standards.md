# Credential-format standards layer — ISO mdoc / W3C VC / SD-JWT VC / OpenID4VC

> STATUS: in progress (agent writing incrementally — 2026-07-24)

**One-liner:** The wire formats and protocols that government and big-tech wallets use to carry
identity attributes — ISO/IEC 18013-5 mdoc, W3C VC 2.0, SD-JWT VC — plus the OpenID4VCI/OpenID4VP
protocols and the browser Digital Credentials API a verifier would implement to consume them.
**Category:** state-identity (format layer — the formats themselves prove nothing; they carry
whatever the issuer asserted)
**Chains:** none (all off-chain; ZK-over-mdoc work is the only chain-adjacent thread)
**Status (2026-07):** TBD
**Aggregator verdict:** TBD

## What it proves
## Trust root & failure modes
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

### 5a. Browser Digital Credentials API — shipped, and narrower than it looks

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
## Open questions for us
## References
