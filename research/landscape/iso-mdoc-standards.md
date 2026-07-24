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
## 2. The mdoc linkability problem, batch issuance, and ZK
## 3. W3C VC 2.0
## 4. SD-JWT and SD-JWT VC
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
## 7. Real deployments

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
