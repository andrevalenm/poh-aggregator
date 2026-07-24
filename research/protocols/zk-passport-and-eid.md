# ZK proofs over government e-passports and national eIDs

**One-liner:** A family of ZK-circuit + mobile-NFC toolkits (ZKPassport, Self Protocol / OpenPassport,
Rarimo ZK Passport, Anon Aadhaar) that let a user prove statements about a government-issued
electronic document — an ICAO 9303 e-passport / eID chip, or India's UIDAI-signed Aadhaar QR —
without revealing the document.

**Category:** **state-issued identity.** *Not* native uniqueness. Every scheme in this file produces
a **per-document** nullifier, not a per-human one. Marketing calls it "proof of personhood";
what it actually proves is "a State once issued a document, and someone holding that document's data
made this proof."

**Chains:**
- ZKPassport — Ethereum mainnet, Ethereum Sepolia, Base mainnet (verified on-chain, below)
- Self Protocol — Celo mainnet + Celo testnet (Identity Verification Hub V2)
- Rarimo — Rarimo Network (own EVM L2) + `RegistrationSMTReplicator` for other EVM chains
- Anon Aadhaar — chain-agnostic Groth16 Solidity verifier (deploy your own)

**Status (2026-07-24):**
- **ZKPassport — live and the most actively shipped.** `@zkpassport/sdk` v0.16.1 published
  2026-07-21; `zkpassport/circuits` pushed 2026-07-24; mainnet contracts confirmed to hold bytecode.
- **Self Protocol — live but *pivoted*.** Docs now lead with **Self Enterprise** (API keys, billing,
  credits, webhooks) and label the permissionless **Self Pass** path **"Legacy."** `@selfxyz/contracts`
  last published 2025-09-26. Raised $9M seed Nov 2025.
- **Rarimo — maintained.** `passport-zk-circuits` pushed 2026-07-02; `passport-contracts` 2025-11-20.
- **Anon Aadhaar — effectively dormant.** Last repo push 2025-04-21; last release/npm publish
  **2024-12-12** (~19 months). The live Aadhaar path in 2026 is Self's, not PSE's.

**Aggregator verdict:**
- **ZKPassport — integrate now, as the primary passport rail.** Permissionless on-chain verification
  at a fixed address on Ethereum/Base with no vendor call required, Apache-2.0 SDK, circuits readable,
  weekly releases. Discount for: no active authentication, admin-controlled certificate registry
  (Safe, threshold 1), per-document nullifier.
- **Self Protocol — integrate later / integrate the legacy on-chain hub only.** Huge reach (Aadhaar,
  7M+ claimed users) but the strategic direction is a paid, vendor-verified enterprise API, and its
  Aadhaar nullifier is dangerously low-entropy. Treat the Celo hub as the integration point, not the
  Enterprise webhook.
- **Rarimo — integrate later.** Only project that implements Active Authentication, which is exactly
  the property we want; but AA is optional (`PNOAADispatcher` auto-passes), the registry lives on its
  own L2, and momentum is lower.
- **Anon Aadhaar — skip.** Dormant, and its credential is a *static transferable file*.

**Cap on how much this family should be worth in an aggregate score:** treat the whole file as **one
evidence source**, not four. See §4b and §10 — World ID's document tier (which hashes the *same* SOD
signature), Billions, Privado, Holonym / human.tech, Galxe Passport and every KYC vendor share the
same trust root and must not be double-counted. **And note we cannot detect the double-count from
published credentials** (§4b), which is precisely why the scoring model must saturate rather than
rely on dedup.

---

## 1. The shared cryptographic mechanism (ICAO 9303)

### What is on the chip

| DG | Contents |
|----|----------|
| DG1 | MRZ — name, DOB, sex, nationality, **document number**, expiry |
| DG2 | Facial image (JPEG/JP2) |
| DG3 | Fingerprints (Extended Access Control — normally unreadable by third parties) |
| DG7 | Signature image |
| DG11 / DG12 | Additional personal / document details |
| **DG15** | **Active Authentication public key** — present only if the issuer implemented AA |
| **SOD** | Document Security Object: CMS/PKCS#7 SignedData holding the hash of every DG, signed by a Document Signer |

### The PKI chain

```
CSCA  (Country Signing CA — one per State, self-signed, key cycled every ~3-5 years)
 └─ signs → DSC  (Document Signer Certificate — rotated often; thousands per country over time)
      └─ signs → SOD  (per-passport; contains the hash of every data group)
           └─ hashes → DG1 (MRZ), DG2 (face), …
```

- **Passive Authentication (PA):** verify the SOD signature chains to a trusted CSCA, and that the DG
  hashes in the SOD match the DGs read. Proves *a State issued this data*. Does **not** prove the
  data came from a chip in your hand — a PA-valid dataset can be copied byte-for-byte and replayed
  forever, by anyone, on any device.
- **Active Authentication (AA):** the chip holds a private key whose public half sits in DG15; the
  reader sends a random challenge and the chip signs it. Proves the *physical chip* is present.
  Chip Authentication (CA, part of EAC) is the modern equivalent via key agreement.
- **Access control to read at all:** BAC (older) derives the session key from
  `document number ‖ DOB ‖ expiry date` — the MRZ. PACE (newer) is password-authenticated. Note the
  implication: **BAC keys are low-entropy and fully derivable from three fields a data broker may
  already hold.** "You had to scan the chip" is not the same as "you physically possessed the book,"
  once a chip clone exists.

### What the ZK circuits actually prove

All of these projects encode approximately the same statement:

> "I know bytes DG1 and a signature chain such that H(DG1) ∈ SOD, SOD is signed by a DSC, that DSC is
> signed by a CSCA whose public key is a leaf under merkle root R, and predicates over DG1 hold
> (age ≥ 18, nationality ∈ set, not expired…). I reveal only those predicates plus a nullifier."

The engineering cost is verifying **RSA / RSA-PSS / ECDSA over SHA-1/224/256/384/512 inside a
circuit**, across every algorithm combination that ~190 States chose. That is why each project ships
dozens of circuit variants keyed by (signature alg, key size, hash alg, curve). Self documents
support for RSA / RSAPSS / ECDSA, SHA-1/256/384/512, RSA 1024–6144 bits, ECDSA 224–521 bits
([supported countries](https://docs.self.xyz/docs/self-pass/architecture/countries-list/)).

---

## 2. The CSCA master list problem — the shared centralization point

The merkle root `R` of trusted CSCAs has to come from somewhere. ICAO runs a **Master List**
distributed via the ICAO PKD. Problems, in order of severity for us:

1. **Coverage is political, not technical.** Not every State publishes to the PKD; some publish
   bilaterally or on a national website; some do not publish at all. ZKPassport states plainly:
   "Only passports, national IDs, and residence permits that comply with ICAO 9303 standards **whose
   issuing country publish their signing certificates** are supported"
   ([limitations](https://docs.zkpassport.id/limitations)). Self reports **170+ countries/territories,
   but only 59 with full DSC+CSCA support** and 110+ with CSCA-only
   ([countries list](https://docs.self.xyz/docs/self-pass/architecture/countries-list/)).
   → Systematic geographic bias: exactly the populations least likely to be in the PKD are excluded.
2. **Someone must curate and publish the root.** Self: "certificates from the ICAO masterlist… public
   keys extracted and validated using Subject Key Identifiers (SKIs)… a Merkle tree is constructed
   from validated keys (~500 CSCAs, depth 12)… **new certificates can be added by anyone**"
   ([OFAC & CSCA auto-updaters](https://docs.self.xyz/docs/self-pass/architecture/ofac-csca-auto-updaters/)).
   Append-permissionless is good, but the *source list* is still whatever the updater ingests.
3. **Whoever can write the root can mint citizens.** If a rogue CSCA enters the tree, its holder can
   issue unlimited valid "passports." For ZKPassport this is not hypothetical — see the admin finding
   below.
4. **DSC trees are separate and permissionlessly appendable.** Self's DSC leaf is
   `poseidon2([poseidon2([dsc_hash, dsc_len]), poseidon2([csca_hash, csca_len])])`; "anyone proving
   DSC validity can add it." That part is genuinely trust-minimised — the weak link is the CSCA set.

> **Aggregator implication.** The trust root for every protocol here is (a) ~190 governments' signing
> keys, and (b) one curator's ingestion pipeline. If we want a passport credential to carry real
> weight, we should **pin our own copy of the ICAO master list** and compare it against whichever
> registry root the proof references, rather than trusting the vendor's root blindly.

---

## 3. Active authentication / clone detection — who actually does it

| Project | Passive Auth | Active Auth (DG15 chip challenge) | Evidence |
|---|---|---|---|
| **ZKPassport** | Yes | **No.** Grep of `zkpassport/circuits` HEAD (2026-07-24) for `DG15`, `active_auth`, `chip_auth` returns **zero hits**. Circuit families present: `bind, compare, data-check, disclose, exclusion-check, facematch, inclusion-check, main, oprf-auth, sig-check`. | repo inspection |
| **Self Protocol** | Yes | **No — explicitly.** "Currently not supported… presently uses Passive Authentication." Architecture reserves a future AA (sign a recent blockhash with the DG15 key). | [zk-proof-architecture](https://docs.self.xyz/docs/self-pass/architecture/zk-proof-architecture/) |
| **Rarimo** | Yes | **Yes, where available.** Ships `PECDSASHA1Authenticator` and `PRSASHAAuthenticator` — *and* `PNOAADispatcher`, "passports without AA (returns true automatically)." | [contracts reference](https://docs.rarimo.com/zk-passport/contracts/) |
| **Anon Aadhaar** | N/A — no chip | N/A | — |

**This is the single most important scoring fact in the file.** Without AA, "I hold a valid passport
proof" degrades to "I, *or anyone who ever obtained this passport's chip dump*, hold a valid proof."
Chip dumps are produced routinely at borders, hotels, banks and telcos, and passport datasets leak.
A well-funded sybil farm does not need to acquire passports; it needs to acquire *chip reads*, which
is a data-brokerage problem, not a physical one — and with BAC-derivable session keys plus a
programmable NFC emulator, a cloned chip reads identically under passive authentication.

**Partial mitigations shipped today:**
- **ZKPassport FaceMatch** — a local ML face comparison between the user's live face and the ID
  photo, with a `strict` mode that adds "a more extensive liveness check to prevent spoofing (e.g.
  using someone else's photo or holding the ID photo in front of the camera)"
  ([facematch](https://docs.zkpassport.id/examples/facematch)). This is the closest thing to
  binding *this human* to *this document*. Caveats ZKPassport itself gives: "iPhones can provide this
  with good guarantees. On Android, the app may refuse to perform the face scan on some devices
  considered untrustworthy," plus photo-extraction failures and unsupported signature algorithms.
  UNCLEAR from the docs whether the compared photo is DG2 from the chip or the visually-scanned photo
  — this matters a lot and is worth asking them directly.
- Nothing equivalent is documented for Self or Rarimo as of 2026-07.

> **Scoring rule we should adopt:** passport proof *without* FaceMatch/AA ⇒ "a state document exists"
> tier. Passport proof *with* FaceMatch-strict or with a real AA signature ⇒ one tier higher. Never
> the top tier, because of the multi-document problem below.

---

## 4. Nullifiers, uniqueness, and multi-document sybil

### ZKPassport — verified from circuit source

`src/noir/lib/commitment/common/src/lib.nr`:

```noir
pub fn calculate_private_nullifier<let SIG: u32>(
    dg1: DG1Data, e_content: EContentData, sod_sig: [u8; SIG],
) -> Field {  // Poseidon2 over packed(DG1) ‖ packed(eContent) ‖ packed(SOD signature)
```

```noir
pub fn calculate_scoped_nullifier(...) -> Field {
    // unsalted: Poseidon2([private_nullifier, service_scope, service_subscope])
    // salted:   Poseidon2([private_nullifier, service_scope, service_subscope, nullifier_secret])
}
```

So **private nullifier = Poseidon2(DG1 ‖ eContent ‖ SOD signature)**. DG1 is the MRZ (document number
and expiry included) and the SOD signature is unique per issued document. Therefore:

- **Renewal ⇒ a brand-new nullifier.** The same human re-registers cleanly, forever, every ~10 years,
  and *immediately* if they report the passport lost.
- **Dual citizenship ⇒ two nullifiers.**
- **Passport + national ID + residence permit from the same State ⇒ up to three.**

ZKPassport documents this honestly: "A person can have multiple IDs" — making it
"one-ID-per-account rather than one-person-per-account"
([personhood](https://docs.zkpassport.id/examples/personhood)).

Scope: nullifiers are `service_scope`/`service_subscope`-bound ⇒ **app-scoped, unlinkable across
apps**. Two modes:
- **Unsalted (default)** — "The default identifier can be recomputed by anyone with complete knowledge
  of the ID chip data — including the government that issued the ID."
- **Salted** — an **OPRF** (BabyJubJub vOPRF in `commitment/scoped-nullifier`, domain separators
  `DS_OPRF` / `DS_DLOG`; the OPRF public-key hash is a public input). "The servers never see the
  user's data — they only receive a blinded value… no single server holds the whole secret"
  ([salted identifiers](https://docs.zkpassport.id/examples/salted-identifiers)), i.e. a
  threshold OPRF. UNCLEAR who operates the OPRF nodes and what happens if they are unavailable.

> **Trade-off we must decide:** unsalted = fully permissionless verification but the issuing
> government can link the nullifier to a citizen. Salted = private but introduces a liveness
> dependency on ZKPassport's OPRF network. For an aggregator, unsalted+app-scoped is probably right,
> but this should be a conscious, documented choice.

The circuit also emits a `nullifier_type` public input ∈ {NON_SALTED, SALTED, NON_SALTED_MOCK,
SALTED_MOCK}. Mock types are triggered by the fake issuing-country code `ZKR`.
**An integrator that does not reject mock nullifier types will accept test passports as real.**

### Self Protocol

- **Attestation nullifier** = Poseidon over "the final message signed by the DSC certificate,"
  incorporating DG2 entropy ⇒ per-document, same renewal/dual-citizenship weaknesses.
- **Action nullifier** = Poseidon(user secret, app scope), scope derived deterministically from DNS
  ⇒ **app-scoped**.
- **Self's Aadhaar nullifier is much weaker and deserves a flag.** "UIDAI does not sign the entire
  Aadhaar number and only the last 4 digits," so Self derives the nullifier from
  **name + date of birth + gender + last-4 of the Aadhaar number**
  ([Aadhaar spec](https://docs.self.xyz/docs/self-pass/document-specification/aadhaar/)).
  Consequences: (i) a **legal name change makes you a new person**, which Self acknowledges;
  (ii) in a 1.4bn-person population, name+DOB+gender+last-4 is *not* obviously collision-free —
  a genuine second human could be locked out by a false-positive duplicate; (iii) any party knowing
  those four fields can test whether a given person registered.

### Rarimo

Registration binds `identityKey ↔ passport` in `StateKeeper`, with `revoke()` and
`reissueIdentity()` for recovery (AA-only). Docs state directly: **"There's no way to prevent a
holder of multiple passports from onboarding multiple times."**
([docs.rarimo.com/zk-passport](https://docs.rarimo.com/zk-passport/))

### Anon Aadhaar

`helpers/nullifier.circom`:

```circom
// nullifier = hash(nullifierSeed, hash(photo[0:15]), hash(photo[16:31]))
out <== Poseidon(3)([nullifierSeed, first16Hasher.out, last16Hasher.out]);
```

Nullifier = Poseidon over the **photo bytes from the QR**, seeded by an app-supplied
`nullifierSeed` ⇒ **app-scoped**, stable per Aadhaar record unless the holder updates their photo.
Because Aadhaar is a lifelong national number, this is in principle a *better* uniqueness root than a
passport — no renewal churn, and India does not issue you two Aadhaars. Its weakness is elsewhere
(section 5.4).

### Summary: how much uniqueness can we credit?

| Failure mode | ZKPassport | Self (passport) | Self (Aadhaar) | Rarimo | Anon Aadhaar |
|---|---|---|---|---|---|
| Passport renewal ⇒ new identity | ✗ breaks | ✗ breaks | n/a | ✗ breaks | n/a |
| Dual citizenship ⇒ 2 credentials | ✗ | ✗ | n/a | ✗ (admitted) | n/a |
| Passport + ID card + residence permit | ✗ | ✗ | n/a | ✗ | n/a |
| Stolen/purchased chip dump works | ✗ (unless FaceMatch) | ✗ | ✗ (QR file) | partial — AA if issuer supports it | ✗ |
| Nullifier collides between two real humans | no | no | **possible** | no | no |
| App-scoped (unlinkable across apps) | ✓ | ✓ | ✓ | UNCLEAR | ✓ |

**Practical ceiling: ~1 credential per document, and a determined individual in a rich country can
plausibly hold 2–4 valid ICAO documents.** Credit this family as *strong state-identity evidence with
a small integer sybil multiplier*, not as one-person-one-credential.

---

## 4b. Nullifier derivation, compared — **the cross-protocol dedup question**

*(Written in response to the World ID researcher's finding that World's document tier derives its
"Claim 1" from `blake3(SignedData.SignerInfos[0].Signature)`. Everything below is read from circuit
source on GitHub, not from docs prose, because the docs consistently gloss over this.)*

### The ICAO fields in play

Inside an e-passport SOD (a CMS `SignedData`) there are four distinct per-document values a circuit
could hash. They are **not** interchangeable:

| Field | What it is | Per-document unique? |
|---|---|---|
| **DG1** | the MRZ bytes: name, DOB, sex, nationality, **document number**, expiry | yes (doc number + expiry differ per issuance) |
| **eContent** (`LDSSecurityObject`) | the structure listing the hash of every data group | yes (contains H(DG2), a per-issuance photo) |
| **signedAttrs** (`SignerInfo.authenticatedAttributes`) | the actual bytes the DSC signs — contains `messageDigest = H(eContent)` plus signing time etc. | yes |
| **`SignerInfos[0].Signature`** | the DSC's RSA/ECDSA signature over signedAttrs | yes (and non-deterministic for ECDSA) |

### What each project actually hashes

| Project | Identifier | Derivation (source-verified) | Source |
|---|---|---|---|
| **ZKPassport** | `private_nullifier` → `scoped_nullifier` | `private = Poseidon2(pack(DG1) ‖ pack(eContent) ‖ pack(SOD signature))`; then `scoped = Poseidon2([private, service_scope, service_subscope])` (+ `nullifier_secret` in salted mode) | [`circuits/src/noir/lib/commitment/common/src/lib.nr`](https://github.com/zkpassport/circuits/blob/main/src/noir/lib/commitment/common/src/lib.nr) — `calculate_private_nullifier`, `calculate_scoped_nullifier` |
| **Self Protocol** | registration `nullifier` (public output) | `nullifier = PackBytesAndPoseidon(SHA-x(signedAttrs) bytes)` — **no secret, no scope** | [`circuits/circuits/register/register.circom`](https://github.com/selfxyz/self/blob/main/circuits/circuits/register/register.circom) — `signal output nullifier <== PackBytesAndPoseidon(HASH_LEN_BYTES)(passportVerifier.signedAttrShaBytes);` |
| **Self Protocol** | disclosure `nullifier` (action) | `Poseidon(user secret, app scope)`; scope derived deterministically from DNS | [zk-proof-architecture](https://docs.self.xyz/docs/self-pass/architecture/zk-proof-architecture/) |
| **Self Protocol** | `commitment` (identity-pool leaf) | `Poseidon(5)([secret, attestation_id, H(DG1), H(eContent hash), dsc_tree_leaf])` | same file |
| **Self (Aadhaar)** | nullifier | **name + DOB + gender + last-4 of Aadhaar number** (UIDAI signs only the last 4) | [Aadhaar spec](https://docs.self.xyz/docs/self-pass/document-specification/aadhaar/) |
| **Rarimo** | `passportHash` (stored in `StateKeeper`) | `Poseidon1( Bits2Num( first 252 bits of HASH_TYPE(signedAttributes), bit-reversed ) )` — **no secret, no scope** | [`circuits/passportVerification/passportVerificationBuilder.circom` L163-244](https://github.com/rarimo/passport-zk-circuits/blob/main/circuits/passportVerification/passportVerificationBuilder.circom) |
| **Rarimo** | `dg1Commitment` | `Poseidon5(dg1_chunk[0..3], Poseidon1(skIdentity))` — DG1 blinded by the user secret | [`circuits/identityManagement/identity.circom`](https://github.com/rarimo/passport-zk-circuits/blob/main/circuits/identityManagement/identity.circom) |
| **Rarimo** | query `nullifier` | `Poseidon3(sk_i, Poseidon1(sk_i), eventID)` — **a function of the user secret and the app's `eventID` only; the passport does not enter it** | [`circuits/identityManagement/queryIdentity.circom` L38, L98-107](https://github.com/rarimo/passport-zk-circuits/blob/main/circuits/identityManagement/queryIdentity.circom) |
| **Rarimo** | `dg15PubKeyHash` | `Poseidon5`/`Poseidon2` over the **Active Authentication public key** from DG15; `0` when the document has no AA | [`identity.circom`](https://github.com/rarimo/passport-zk-circuits/blob/main/circuits/identityManagement/identity.circom) |
| **Anon Aadhaar** | nullifier | `Poseidon3([nullifierSeed, H(photo[0:15]), H(photo[16:31])])` — the JPEG2000 photo bytes from the QR | [`packages/circuits/src/helpers/nullifier.circom`](https://github.com/anon-aadhaar/anon-aadhaar/blob/main/packages/circuits/src/helpers/nullifier.circom) |
| **World ID (document tier)** | "Claim 1" | `blake3(SignedData.SignerInfos[0].Signature)` reduced into the field | *reported by the World ID researcher — not independently verified in this pass* |

### Comparison table (the one the dedup logic gets built from)

| Project | Nullifier is a function of | Stable across passport renewal? | App-scoped or global? | Published on-chain as a global per-document value? |
|---|---|---|---|---|
| ZKPassport | DG1 + eContent + **SOD signature**, then scope | **No** — all three inputs change | **App-scoped** (`service_scope`, `service_subscope`) | **No** — only the scoped value is ever public |
| Self (register) | **H(signedAttrs)** | **No** | **Global** | **Yes** — public circuit output, written on registration |
| Self (disclose) | user secret + DNS-derived app scope | n/a (follows the identity commitment) | App-scoped | No |
| Self (Aadhaar) | name+DOB+gender+last-4 | n/a — but **breaks on legal name change** | Global | Yes |
| Rarimo `passportHash` | **H(signedAttrs)**, truncated to 252 bits | **No** | **Global** | **Yes** — stored in `StateKeeper` |
| Rarimo query nullifier | user secret + `eventID` | follows the identity, and Rarimo supports `revoke()`/`reissueIdentity()` | App-scoped | No |
| Anon Aadhaar | photo bytes from the UIDAI QR | **Yes** (Aadhaar is a lifelong number; breaks only on photo update) | App-scoped (`nullifierSeed`) | No |
| World ID (document) | **SOD signature** | **No** (consistent with the reported ≤10y validity and no renewal path) | UNVERIFIED | UNVERIFIED |

### The answer to "is there a canonical cross-protocol document identifier?"

**No usable one exists in published data — but the preimages collide, and two projects leak a global
per-document value.** Three findings, in order of value:

1. **Self and Rarimo hash the *same underlying field*: `H(signedAttrs)`.** Self computes
   `Poseidon(pack(SHA-x(signedAttrs)))`; Rarimo computes `Poseidon1(first-252-bits-reversed of
   HASH(signedAttrs))`. The **outputs differ** (different truncation, bit order, and packing), so
   you cannot equate two published values. But the **preimage is identical**, so *anyone holding the
   chip data can compute both.* World hashes a neighbouring field (the signature over those same
   signedAttrs) with blake3; ZKPassport hashes DG1+eContent+signature with Poseidon2. Four protocols,
   four incompatible functions, **one shared secret preimage: the chip dump.**
2. **Self and Rarimo publish a global, unscoped, per-document identifier on-chain.** Self's register
   circuit emits `nullifier` as a *public output* with no secret and no scope; Rarimo stores
   `passportHash` in `StateKeeper`. This is simultaneously:
   - a **privacy leak** — anyone with a chip dump can test "is this passport registered on Self?" or
     "…on Rarimo?" by recomputing the hash and scanning the chain. Governments, border agencies and
     anyone holding a leaked passport database can do this at scale. **This is a materially worse
     privacy posture than ZKPassport, which never publishes an unscoped value.**
   - a **dedup opportunity for us** — *if* we ever hold the chip data ourselves, we can determine
     whether the same physical document is already registered on Self and on Rarimo, without either
     vendor's cooperation.
3. **ZKPassport cannot be deduped against the others from published data at all**, because only the
   scoped nullifier is ever revealed, and (in salted mode) it is additionally OPRF-blinded.
   Rarimo's *query* nullifier likewise carries no passport entropy — Rarimo enforces uniqueness in
   the **registry** (one `passportHash` → one `identityKey` bond in `StateKeeper`), not in the
   nullifier. So for Rarimo, the on-chain bond, not the proof, is the dedup surface.

### What this means for the aggregator — design consequence

- **We cannot dedup a passport across protocols from credentials alone.** A human presenting one
  passport to ZKPassport, Self, Rarimo and World obtains four credentials that look mutually
  independent and are not. **This is the strongest possible argument for the saturating single-bucket
  scoring model in §10** — since detection is impossible, the score must not reward the second
  credential in the first place.
- **The only way to get a canonical document ID is to own the NFC read.** If our own client performs
  the chip read (native SDK, per §7), we can compute a canonical `doc_id = H(signedAttrs)` — the same
  preimage Self and Rarimo use — store only a salted HMAC of it, and dedup every credential that
  passes through *our* flow, plus query Self's and Rarimo's chains for prior registration. This is a
  concrete, high-value reason to build the native NFC path rather than only deeplinking out.
  **Caution:** doing so makes us a linkability hub holding a global per-document identifier. It must
  be an HMAC under a key we can rotate, never a bare hash, and it should be a deliberate, documented
  privacy trade-off.
- **`H(signedAttrs)` is the right canonical choice** if we build it: it is the field two of the four
  protocols already commit to, it is well-defined for every ICAO 9303 document, and unlike the
  signature it is deterministic (ECDSA signatures are not).
- **None of these anchor a long-lived humanity assertion.** Every ICAO-derived identifier here changes
  on reissuance — ZKPassport, Self, Rarimo and (per the World researcher) World alike. Only
  Anon Aadhaar's photo-hash is renewal-stable, and it is the most transferable credential in the file.
  **A passport-derived humanity assertion has a hard expiry of one document lifetime (≤10 years), and
  the user can silently re-mint a fresh identity at any renewal or reported loss.**

**UNVERIFIED / next steps:** (a) World's `blake3(SignerInfos[0].Signature)` derivation is second-hand
from the World ID researcher — verify against World's own schema-9303 spec/circuit before relying on
it; (b) whether Rarimo exposes `dg15PubKeyHash != 0` (i.e. "AA was actually performed") in a
readable `StateKeeper` view — read `rarimo/passport-contracts` `StateKeeper.sol` next; (c) whether
Self's on-chain registration nullifier is queryable by value (a mapping) or only via events — read
`@selfxyz/contracts` `IdentityRegistry` next.

---

## 5. Per-project detail

### 5.1 ZKPassport

- Docs https://docs.zkpassport.id · Circuits (Noir, **Apache-2.0**) https://github.com/zkpassport/circuits ·
  Monorepo https://github.com/zkpassport/zkpassport-packages
- SDK: **`@zkpassport/sdk`** and **`@zkpassport/ui`**, Apache-2.0, **v0.16.1 published 2026-07-21**
  (npm registry, checked 2026-07-24). Also `zkpassport/mobile-app` (Apache-2.0),
  `zkpassport/cloud-prover`, `zkpassport/zkpassport-proof-verifier` ("Verifier API").
- Proving: on-device (Noir/Barretenberg via `noir_rs`), with a cloud-prover option.
- Documents: ICAO 9303 passports, national IDs, residence permits, where the issuer publishes
  signing certificates.

**On-chain surface — confirmed live via RPC (`eth_getCode` / `eth_call`, 2026-07-24):**

| Role | Chain | Address | Verified |
|---|---|---|---|
| Root verifier (stable entrypoint) | Ethereum (1), Sepolia (11155111), **Base (8453)** — same address on all | `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` | ✔ bytecode present on Ethereum mainnet **and** Base mainnet |
| Certificate / root registry | Ethereum mainnet | `0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70` | ✔ 2,988 bytes of code |
| Sub-verifier v0.20.0 | Ethereum | `0x358324e0D0deeA401078aeB2dc252157B678b43C` | repo-declared |
| Sub-verifier v0.20.0 | Base | `0x8c424C342211DAde4Bf40B0f4c5a09D9a8810694` | repo-declared |
| Sub-verifier v0.20.0 | Sepolia | `0xEFC0426f0BF0737c3c04340076361b6979127195` | repo-declared |
| Verifier helper v0.18.0 | Ethereum | `0x9894282C73AFaDF1c5c63b6FAc0169039fc42983` | repo-declared |
| Verifier helper v0.18.0 | Base | `0x1887a01437Ddbee7Dc7cFdA666eEfAd441d671BD` | repo-declared |
| **Admin of root verifier AND registry** | Ethereum | `0x2000ab040a899f914D6DfD2457C3dFBB22d4c762` | ✔ returned by `admin()` on both |

Plus per-`outer_count` UltraHonk proof verifiers (`outer_count_4` … `outer_count_13`, one per number
of composed disclosure sub-proofs); source of truth is
`src/solidity/deployments/addresses-<chainid>.json` in the circuits repo.

Verifier interface (from [onchain docs](https://docs.zkpassport.id/getting-started/onchain)):

```solidity
function verify(ProofVerificationParams calldata params)
    external returns (bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper);
// helpers: verifyScopes(), isAgeAboveOrEqual(), isAgeBetween(), isBirthdateAfterOrEqual(),
//          isBirthdateBetween(), isNationalityIn(), isIssuingCountryIn(),
//          getDisclosedData(), getBoundData()
```

Public inputs include: **certificate registry root, circuit registry root, current date, service
scope, parameter commitments, nullifier type, scoped nullifier.** Bound data can commit to the
user's wallet address, chain id and a custom payload — so a proof can be non-replayable across
addresses. SDK helpers: `getSolidityVerifierDetails()`, `getSolidityVerifierParameters()`; query
mode `"compressed-evm"`; the EVM proof is the one named `outer_evm…`.

**⚠ Centralization finding (novel, verified on-chain 2026-07-24).**
`admin()` on both `0x1D000001…C0D8` (root verifier) and `0x1D000002…8B70` (certificate registry)
returns `0x2000ab040a899f914D6DfD2457C3dFBB22d4c762`. That address holds 171 bytes of code and
responds to Safe methods:

- `VERSION()` → `"1.3.0"` (Gnosis Safe v1.3.0)
- `getOwners()` → `0xcccf3b4d7a230e0d486c1d4a7035f5ea2ce6225d`, `0x346bf08c7fb6a976e0ba01bd056bf4aabb98ba86`
- **`getThreshold()` → `1`**

So the certificate registry that defines *which governments are trusted* is administered by a
**2-of-… Safe with a threshold of 1** — a single key compromise is sufficient. The registry is also
`Pausable` (`pause()` `0x8456cb59`, `unpause()` `0x3f4ba83a`; `paused()` currently `false`).

> **What this means for us:** ZKPassport verification is *permissionless to read* (we call the
> contract; ZKPassport cannot deny us service and cannot see our queries) but **not trust-minimised
> at the root** (one key can insert a rogue CSCA, or pause the registry). This is still materially
> better than every vendor-API alternative. Mitigation: mirror the certificate root ourselves and
> alarm on unexpected root changes.

### 5.2 Self Protocol (self.xyz) — formerly OpenPassport / Proof of Passport

Lineage confirmed: `github.com/zk-passport/openpassport` **redirects to `github.com/selfxyz/self`**
(identical `pushed_at` and star count via the GitHub API). "Proof of Passport" → "OpenPassport" →
"Self" is one project, not three. Self launched after Celo acquired OpenPassport
([Celo blog](https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428)).

- Documents: e-passports, EU ID cards, **Indian Aadhaar**, plus a "KYC attestation" path.
- Architecture: **register** (heavy RSA/ECDSA circuit run in a **TEE**, not on device — see
  `selfxyz/tee-prover-server`) → identity commitment inserted into an on-chain "identity pool"
  merkle tree; **disclose** (light Poseidon circuit, client-side) proves membership + predicates.
- Coverage: **170+ countries/territories; 59 with full DSC+CSCA support**, 110+ CSCA-only, plus UN
  Laissez-Passer. Interactive map at `map.self.xyz`.
- Aadhaar: consumed from the **mAadhaar app QR** or the **UIDAI-website e-Aadhaar PDF QR**. Discloses
  last-4 of the Aadhaar number, name, DOB, gender, nationality `IND`, age band, OFAC flags. Expiry
  reports `UNAVAILABLE`. Announced Sept 2025 as covering "99% of India's adult population"
  ([self.xyz blog](https://self.xyz/blog/self-now-supports-indian-aadhaar-expanding-support-to-99-of-india-s-adult-population),
  secondary: [Biometric Update](https://www.biometricupdate.com/202509/self-integrates-aadhaar-to-enable-age-identity-verification-with-zkps)).
- Funding / traction: **$9M seed, Nov 2025**, plus a points programme
  (secondary: [CoinDesk](https://www.coindesk.com/business/2025/11/13/zero-knowledge-identity-startup-self-raises-usd9m-introduces-points-program),
  [Biometric Update](https://www.biometricupdate.com/202511/self-completes-9m-seed-round-introduces-points-scheme-for-verification)).
  **"Self Pass & Connect currently have over seven million activated users"** — self-reported on
  self.xyz docs, surfaced 2026-07-24. UNVERIFIED independently; "activated" is undefined and may
  count Self Connect phone/email links, which are *not* document verifications.

**On-chain surface:**

| Contract | Chain | Address | Verified |
|---|---|---|---|
| IdentityVerificationHub (V2) | Celo mainnet | `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF` | ✔ 129 bytes on Celo mainnet — an **ERC-1967 proxy**; implementation slot → `0xea0f37706def0bafbf4cfcedd27beb4148c138e6` (**upgradeable**) |
| IdentityVerificationHub (V2) | Celo testnet | `0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74` | mock passports only |

Integration (legacy/on-chain path):

```solidity
// Hub entrypoint
verifySelfProof(bytes calldata proofPayload, bytes calldata userContextData)
// Hub then calls back into your contract:
onVerificationSuccess(abi.encode(output), userData)
```

`GenericDiscloseOutputV2` carries `userIdentifier, nullifier, attestationId, issuingState, name,
idNumber, nationality, dateOfBirth, gender, expiryDate, olderThan, ofac[3],
forbiddenCountriesListPacked`. Integrators extend the `SelfVerificationRoot` abstract contract from
`@selfxyz/contracts` (MIT, **v1.2.3, last published 2025-09-26**).

**⚠ Product-direction finding.** As of 2026-07-24 the docs site leads with **Self Enterprise**, and
**Self Pass is badged "Legacy."** Self Enterprise is a **vendor-verified** flow:
"Self verifies the proof and sends your backend the result"; "the authoritative result is the signed
webhook" ([how it works](https://docs.self.xyz/docs/self-enterprise/get-started/how-it-works/)).
It requires an API key, has Free / Starter (fixed monthly fee + credit allotment) / Enterprise
(custom, `sales@self.xyz`) tiers, and the **Mobile SDK is Enterprise-tier only**
([plans](https://docs.self.xyz/docs/self-enterprise/billing/plans/)). Test-environment verifications,
webhook deliveries and `expired`/`error` sessions are not billed.

> **For us:** the Enterprise path fails BRIEF requirement #4 — we could not verify without Self's
> cooperation, and we would be paying per verification. The Celo hub path *is* permissionless, but it
> is the deprecated branch and its contracts package is ~10 months stale. Integrate the hub, monitor
> for its deprecation, and do not build on the webhook API.

Also live: `selfxyz/self-sbt` (on-chain SBT for verified users), `selfxyz/proof-of-human`,
`selfxyz/self-agent-id` (ERC-8004 agent identity), `selfxyz/self-mcp`, `selfxyz/self-skill`.
Repo license is `NOASSERTION` ("Other") — **not a clean OSI license; needs legal review before we
vendor any of it**, even though the npm packages declare MIT.

Audit: zkSecurity published an audit collaboration with Celo on Self
([blog.zksecurity.xyz/posts/self-audit](https://blog.zksecurity.xyz/posts/self-audit/)) — not read in
detail here; worth reading before we weight Self heavily.

### 5.3 Rarimo ZK Passport

- Docs https://docs.rarimo.com/zk-passport/ · contracts https://docs.rarimo.com/zk-passport/contracts/
- Circuits (Circom, MIT) https://github.com/rarimo/passport-zk-circuits — 94★, pushed 2026-07-02,
  last tagged release v0.2.13 (2025-02-11). Noir port `passport-zk-circuits-noir` in progress.
- Contracts (MIT) https://github.com/rarimo/passport-contracts — 32★, pushed 2025-11-20.
- npm `@rarimo/zk-passport`. Wallet: RariMe.

Contracts on Rarimo Network (docs, checked 2026-07-24; **UNVERIFIED on an explorer — the public RPC
endpoint I tried did not respond**):

| Contract | Address |
|---|---|
| StateKeeper (singleton: identity SMT, certificate SMT, passport↔identity bonds) | `0x61aa5b68D811884dA4FEC2De4a7AA0464df166E1` |
| Registration2 | `0x11BB4B14AA6e4b836580F3DBBa741dD89423B971` |
| RegistrationSMT | `0x479F84502Db545FA8d2275372E0582425204A879` |
| CertificatesSMT | `0xA8b350d699632569D5351B20ffC1b31202AcEDD8` |

```solidity
register(certificatesRoot, identityKey, dgCommit, passport, zkPoints)
registerViaNoir(certificatesRoot, identityKey, dgCommit, passport, zkPoints)
revoke(identityKey, passport)
reissueIdentity(...)
registerCertificate(certificate, icaoMember, icaoMerkleProof)  // permissionless ICAO cert ingestion
// verifiers: verifyProof(uint[2] _pA, uint[2][2] _pB, uint[2] _pC, uint[4] _pubSignals)
// TD3QueryProofVerifier for selective disclosure; PublicSignalsBuilder builds a 23-element array
// cross-chain: RegistrationSMTReplicator.isRootValid()
```

Strengths: **real AA support** (`PECDSASHA1Authenticator`, `PRSASHAAuthenticator`), explicit
revocation and re-issuance, permissionless certificate registration with ICAO merkle proofs, and a
cross-chain root replicator so we could read the registration root from a chain we already index.

Weaknesses: `PNOAADispatcher` "returns true automatically" for passports without AA, so AA is not a
guarantee unless we can tell which path was used (UNCLEAR whether that is on-chain readable — check
the `StateKeeper` passport bond struct). **"Light verification mode"** verifies only DG-hash
integrity on-device and delegates *issuer-signature* verification to Rarimo's own verifiers — in that
mode the trust root is Rarimo, not the PKI. And the registry lives on Rarimo's own L2, adding a chain
dependency.

### 5.4 Anon Aadhaar — different trust root, and dormant

Aadhaar is India's national ID (~1.3–1.4bn enrolled; Self cites 2.21bn Aadhaar authentications per
month). The credential is the **Aadhaar "secure QR code"** on e-Aadhaar PDFs and physical cards: a
compressed blob of demographic data **plus a JPEG2000 photo**, RSA-signed by UIDAI. No chip, no
ICAO, no CSCA.

From `packages/circuits/src/aadhaar-qr-verifier.circom` (HEAD, checked 2026-07-24):

```circom
template AadhaarQRVerifier(n, k, maxDataLength) {   // instantiated as (121, 17, 512*3)
  signal input qrDataPadded[...]; signal input signature[k]; signal input pubKey[k];
  signal input revealAgeAbove18, revealGender, revealPinCode, revealState;
  signal input nullifierSeed;  // public
  signal input signalHash;     // public
  signal output pubkeyHash, nullifier, timestamp, ageAbove18, gender, pinCode, state;
```

Consequences that differ sharply from the passport family:

1. **The UIDAI public key is NOT constrained inside the circuit.** `pubKey` is a *private input* and
   `pubkeyHash` is an *output*. The relying party must compare `pubkeyHash` against the known-good
   UIDAI key hash. Get that wrong and *any* RSA key yields a "valid" proof.
   → **We must pin the UIDAI pubkey hash ourselves**, never trust an SDK default.
2. **Trust root = one government key**, published on
   [uidai.gov.in](https://uidai.gov.in/en/916-developer-section/data-and-downloads-section/19388-uidai-certificate-details-2.html),
   rotated at UIDAI's discretion. Rotation forces every verifier to pin a growing set of key hashes,
   each trusted forever.
3. **UIDAI actively changes its crypto.** **Circular 4 of 2026** mandates SHA-1 → SHA-2/SHA-256
   migration for digital signing in the Aadhaar authentication ecosystem, deadline **2026-06-30**
   ([circular PDF](https://www.uidai.gov.in/images/Circular_4_of_2026_reg_SHA-1_SHA-2_SHA-256_migration.pdf),
   [technical document](https://www.uidai.gov.in/images/Technical_Document_for_SHA-1_to_SHA-2_SHA-256_migration.pdf)).
   ⚠ **CAUTION / partially UNVERIFIED:** that circular is scoped to *authentication request* signing
   by requesting entities (AUA/KUA), which is **not literally** the offline QR signature Anon Aadhaar
   consumes (Anon Aadhaar's docs already describe SHA-256 + RSA for the QR). But it is direct evidence
   that UIDAI unilaterally rotates algorithms on timelines a dormant circuit will not survive.
   **Verify the current QR signature algorithm before integrating anything Aadhaar-based.**
4. **No liveness, no possession of anything.** The QR is a *static file*. Anyone holding a copy of
   your e-Aadhaar PDF — landlords, telcos, hotels, employers, and every Aadhaar-adjacent data breach —
   can produce a valid Anon Aadhaar proof "as you." This is **weaker than passive-authentication
   passport proofs**, because e-Aadhaar PDFs circulate as routine paperwork. The `timestamp` output
   (when UIDAI signed the QR) lets a verifier demand recency, which raises the bar slightly; the file
   is still fully transferable.
5. Nullifier = `Poseidon(nullifierSeed, H(photo))` — app-scoped, stable per record unless the photo
   is updated. Because Aadhaar is a single lifelong number, this avoids the renewal/dual-document
   problem entirely — its uniqueness *model* is the best in this file, undermined by its
   transferability.

**Liveness verdict — dormant.** `anon-aadhaar/anon-aadhaar` (MIT, 250★): last push **2025-04-21**;
last release **v2.4.3, 2024-12-12**. npm `@anon-aadhaar/core`, `/react`, `/contracts` all last
published **2024-12-12**, all MIT. Newest repo in the org is `anon-aadhaar-noir` (2025-10-24).
`privacy-scaling-explorations/anon-aadhaar` resolves to the same repo — it was spun out of PSE.
Docs still up at documentation.anon-aadhaar.pse.dev. → **~19 months without a release. Skip.**

---

## 6. Repo / package liveness table (all checked 2026-07-24)

| Repo / package | License | Last push | Last release | Verdict |
|---|---|---|---|---|
| `selfxyz/self` (← `zk-passport/openpassport`, redirects) | **NOASSERTION** | 2026-07-24 | no GH releases | very active, 1,253★ |
| `@selfxyz/core` (npm) | MIT | — | 1.2.0-**beta**.1, 2026-02-05 | still beta |
| `@selfxyz/qrcode` (npm) | MIT | — | 1.0.24, 2026-05-14 | active |
| `@selfxyz/contracts` (npm) | MIT | — | 1.2.3, **2025-09-26** | ~10 mo stale (legacy path) |
| `zkpassport/circuits` | Apache-2.0 | 2026-07-24 | no GH releases | very active |
| `zkpassport/zkpassport-packages` | none declared | 2026-07-24 | — | very active |
| `@zkpassport/sdk`, `@zkpassport/ui` (npm) | Apache-2.0 | — | **0.16.1, 2026-07-21** | shipping weekly |
| `zkpassport/mobile-app` | Apache-2.0 | 2026-07-17 | — | active |
| `rarimo/passport-zk-circuits` | MIT | 2026-07-02 | v0.2.13, 2025-02-11 | maintained |
| `rarimo/passport-contracts` | MIT | 2025-11-20 | — | slower |
| `anon-aadhaar/anon-aadhaar` | MIT | **2025-04-21** | **v2.4.3, 2024-12-12** | dormant |
| `@anon-aadhaar/*` (npm) | MIT | — | **2.4.3, 2024-12-12** | dormant |

---

## 7. Integration surface & the mobile-NFC constraint

**This is the hard operational blocker for an embedded web aggregator flow.**

- Reading an ICAO chip requires **ISO 14443 NFC with ISO 7816 APDU access**. There is no browser API
  for this — **Web NFC (Chrome/Android) is NDEF-only and cannot talk to a passport chip**, and iOS
  Safari has no NFC API at all. So **any passport tier necessarily hands off to a native app**:
  the ZKPassport app, the Self app, RariMe, or a native SDK we embed.
- **iOS:** CoreNFC `NFCISO7816Tag` reading of e-passports works from iOS 13 on iPhone 7 and later,
  and requires the `com.apple.developer.nfc.readersession.iso7816.select-identifiers` entitlement
  listing the passport AID — i.e. an Apple-granted entitlement in *our* app if we go native.
- **Android:** broad NFC support, but not universal across low-end devices; ZKPassport notes
  FaceMatch may be refused on devices it considers untrustworthy (Play Integrity–style gating).
- **BAC/PACE key derivation** needs `document number ‖ DOB ‖ expiry`, obtained by OCR'ing the MRZ or
  typing it — an extra friction step and a common drop-off point.
- Practical shape for us: **QR/deeplink handoff to a verifier app, proof returned to our backend or
  posted on-chain**, rather than an in-page flow. ZKPassport's `@zkpassport/ui` is exactly a
  "drop-in QR verification card" for this pattern; Self's legacy `@selfxyz/qrcode` is the same idea.

**Permissionless-verification scorecard:**

| Project | Can we verify without vendor cooperation? |
|---|---|
| ZKPassport | **Yes** — call `verify()` on a fixed mainnet/Base address. Vendor can pause the registry but cannot see or gate our reads. Salted-nullifier mode adds an OPRF dependency at *proof* time (user side), not verify time. |
| Self (legacy Celo hub) | **Yes** — `verifySelfProof` on the Celo hub. Hub is an upgradeable proxy. |
| Self (Enterprise, current product) | **No** — Self's servers verify; we consume a signed webhook, with an API key and per-verification credits. |
| Rarimo | **Yes** — read `RegistrationSMT` / `isRootValid()`; but *light mode* proofs are only as good as Rarimo's own verifiers. |
| Anon Aadhaar | **Yes** — deploy the Groth16 verifier ourselves; we must pin the UIDAI key hash. |

---

## 8. Privacy model

- **On-device (or TEE) proving; the document never leaves the device.** ZKPassport: "your personal
  data is encrypted and processed locally on your device and never leaves it." Self runs the heavy
  *registration* circuit in a **TEE** (`selfxyz/tee-prover-server`), which is a weaker guarantee than
  local proving — a TEE compromise or a malicious host sees raw passport data.
- **What the verifier learns:** only the requested predicates plus a scoped nullifier. Self's
  `GenericDiscloseOutputV2` is a superset — if a dapp asks for `name`/`idNumber`, those are on-chain
  in the clear. **Aggregator rule: request the minimum; never request `name` or `idNumber`.**
- **Nullifier linkability:** ZKPassport, Self and Anon Aadhaar are all app-scoped by construction.
  Rarimo's scoping is UNCLEAR. Note the flip side — **app-scoping means we cannot dedupe a user across
  our own integrations unless we deliberately use one shared scope**, which then makes the aggregator
  a linkability hub. That is a design decision with real privacy consequences.
- **The issuing government can deanonymise unsalted ZKPassport nullifiers** (their own admission),
  and can trivially deanonymise Self's Aadhaar nullifier since it is a hash of four fields the state
  already holds. Salted/OPRF mode is the only defence, and it costs permissionlessness.
- **On-chain footprint:** proofs and public inputs are permanently public. A country-restricted
  policy (`isNationalityIn`) leaks nationality-set membership to anyone reading the chain.

---

## 9. Scoring-relevant facts

- **Cost to the user:** ~zero marginal (they already own the passport), but the *acquisition* cost of
  a new legitimate document is real — a second passport means citizenship or a document renewal cycle.
  This is what makes the family valuable despite the per-document nullifier.
- **Cost to a sybil farm:** the binding constraint is **acquiring distinct chip datasets**, not
  humans. Absent AA and FaceMatch, this is a data-procurement problem. Price the credential
  accordingly.
- **Geography:** structurally biased. 59 countries at full DSC+CSCA coverage (Self); ZKPassport gated
  on the issuer publishing certificates. Large populations in Africa, Central Asia and parts of the
  Middle East are excluded, while Aadhaar covers ~1.4bn people through a *separate, weaker* rail.
- **Expiry/decay:** passports expire; DG1 carries the expiry date and circuits can compare it
  (`isExpiryDateAfter`, `compare/expiry` circuit). A credential should decay to zero at document
  expiry — but note the user simply re-registers with the new document under a *new* nullifier.
- **Revocation:** only Rarimo has explicit `revoke()` / `reissueIdentity()`. Neither ZKPassport nor
  Self offers a documented revocation path for a compromised/stolen document — **a stolen passport's
  proof stays valid until expiry.**
- **Tiers we can construct:** (1) any ICAO document, passive auth only; (2) + FaceMatch-strict or a
  real AA signature; (3) + document from a full-coverage country with a recent DSC. Aadhaar sits
  below tier 1 on transferability but above it on population coverage and nullifier stability.

---

## 10. Overlap with other protocols — **do not double-count**

**Everything in this file shares one trust root: a state-issued document.** So does a large slice of
the rest of the landscape. When two credentials both bottom out in "a government issued this person a
document," they are **correlated evidence, not independent evidence** — the marginal information of
the second is close to zero, and a single compromise (rogue CSCA, purchased chip dump, stolen
document) defeats both simultaneously.

Correlated with this file, and therefore capped jointly:

- **World ID's document tier ("schema 9303")** — **confirmed same primitive, not merely the same
  category.** Per the World ID researcher, World reads the ICAO chip's `EF.SOD` with
  Passive/Chip/Active Authentication and derives its "Claim 1" as
  **`blake3(SignedData.SignerInfos[0].Signature)`** — the DSC's signature over the very same
  `signedAttrs` that Self and Rarimo hash, inside the very same `SignedData` structure ZKPassport
  parses. Same chip, same CSCA chain, same per-document lifetime, same renewal break. **World's
  document tier belongs in this file's dedup bucket and must add ~zero score on top of a ZKPassport /
  Self / Rarimo credential.** World's **Orb iris** tier is genuinely independent (biometric, not
  documentary) — only the Orb tier should stack on a passport credential.
  (Cross-agent intel; the blake3 derivation is UNVERIFIED by me — see §4b next steps.)
- **Billions Network, Privado ID (ex-Polygon ID), Holonym / human.tech, Galxe Passport,
  Coinbase Verifications, Binance BABT** — all ultimately reduce to a KYC vendor reading a government
  document.
- **KYC vendors (Sumsub, Persona, Onfido/Entrust, Veriff, Jumio)** — same root, plus an OCR/selfie
  layer. Self's "KYC attestation" path literally wraps one.
- **EU eIDAS 2.0 / EUDI Wallet, and national eID schemes (Estonian ID, Aadhaar, Singpass, MyKad)** —
  same root, different PKI.
- **Rarimo, Self, ZKPassport with each other** — a single human can present the *same* passport to
  all three and obtain three unlinkable-looking credentials with three different nullifiers.
  **This is the most dangerous double-count in our entire design**, because the credentials look
  independent (different chains, different nullifiers, different issuers) and are not.

*Genuinely independent* of this file: Orb iris biometrics (World), palm-vein (Humanity Protocol),
social-graph attestation (Circles, BrightID), and long-lived on-chain behavioural history.

**Concrete recommendation:** model a single latent variable `has_state_document ∈ {0,1}` and let this
whole family contribute to *that one variable*, saturating quickly (first credential ~full value,
second ~10-15%, third ~0). Add an orthogonal bonus only for AA/FaceMatch, since that is evidence
about *this human*, not about the document.

---

## 11. Open questions for us

1. **Who can write the ZKPassport certificate-registry root, and can it be time-locked?** We
   confirmed `admin() = 0x2000ab04…` is a Safe v1.3.0 with **threshold 1**. Ask ZKPassport for a
   timelock or higher threshold; meanwhile, mirror the root and alarm on changes.
   Next step: decode the registry's root-update selector from `0x1D000002…8B70` bytecode and check
   its historical calls on Etherscan.
2. **Is FaceMatch comparing against DG2 (chip) or the visual photo?** If it is DG2, FaceMatch is a
   near-complete answer to the chip-dump attack (you'd need the dump *and* the person's face). If it
   is the visual photo, it is much weaker. **Ask ZKPassport directly.**
3. **Can we tell, from a Rarimo registration, whether Active Authentication was actually performed?**
   i.e. is the dispatcher (`PECDSASHA1Authenticator` vs `PNOAADispatcher`) recorded in the
   `StateKeeper` passport bond and readable on-chain? If yes, Rarimo becomes the highest-value member
   of this family for us.
4. **Is Self's legacy Celo hub going to be deprecated?** The permissionless path is badged Legacy,
   `@selfxyz/contracts` is 10 months stale, and the hub is an *upgradeable proxy*. Ask Self for a
   support commitment before we depend on it.
5. **Self's Aadhaar nullifier collision rate.** name+DOB+gender+last-4 across 1.4bn people —
   what is the actual false-duplicate rate? If non-trivial, Self's Aadhaar credential can lock out
   real humans and we must not treat its nullifier as authoritative.
6. **Which UIDAI key hashes are currently valid for the offline secure QR, and did Circular 4 of 2026
   change the QR signature algorithm?** Confirm before building any Aadhaar tier.
7. **ZKPassport OPRF operators.** Who runs the threshold-OPRF nodes for salted identifiers, what is
   the threshold, and what is the availability SLA? If we ever use salted mode we inherit that
   dependency.
8. **Licensing.** `selfxyz/self` is `NOASSERTION` at the repo level while its npm packages declare
   MIT. Legal review before vendoring any Self code.
9. **Has anyone independently audited the ZKPassport circuits?** `zkpassport/circuits` has a
   `SECURITY.md`; no published audit found in this pass. Self has a zkSecurity audit
   (blog.zksecurity.xyz/posts/self-audit) — read it.
10. **Native app strategy — now a dedup question, not just UX.** Since no browser can read a passport
    chip, do we (a) deeplink to ZKPassport/Self apps, or (b) build a native SDK and apply for the
    Apple ISO7816 entitlement? Per §4b, **(b) is the only way to obtain a canonical cross-protocol
    document identifier (`H(signedAttrs)`)** and therefore the only way to detect a human presenting
    one passport to five protocols. That materially raises the value of building it.
11. **Do we want to hold a canonical `doc_id` at all?** Owning the NFC read lets us dedup, but makes
    us a linkability hub. Proposal to decide on: store only `HMAC_k(H(signedAttrs))` under a rotatable
    key, never the bare hash, and never expose it downstream.
12. **Verify World's derivation.** Confirm `blake3(SignedData.SignerInfos[0].Signature)` against
    World's schema-9303 spec — it is currently second-hand. If World instead hashes `signedAttrs`,
    World and Self become *directly* comparable and cross-protocol dedup gets much easier.
13. **Does Rarimo expose "AA was actually performed" on-chain?** Read `StateKeeper.sol` in
    `rarimo/passport-contracts` for whether `dg15PubKeyHash != 0` is stored/readable per bond.
14. **Is Self's global registration nullifier readable by value?** Read the `IdentityRegistry` in
    `@selfxyz/contracts` — a public mapping would let us query "is this passport registered on Self?"
    directly from a chip dump; events-only would mean indexing.

---

## References

**Primary — ZKPassport**
- https://docs.zkpassport.id/intro · /limitations · /faq · /getting-started/onchain
- https://docs.zkpassport.id/examples/personhood · /examples/facematch · /examples/salted-identifiers
- https://github.com/zkpassport/circuits — `src/noir/lib/commitment/common/src/lib.nr`
  (`calculate_private_nullifier`, `calculate_scoped_nullifier`),
  `src/noir/lib/commitment/scoped-nullifier/src/lib.nr` (`nullify`, vOPRF),
  `src/solidity/deployments/addresses-{1,8453,11155111}.json`
- https://github.com/zkpassport/zkpassport-packages
- On-chain (Ethereum mainnet & Base, `eth_getCode` / `eth_call`, 2026-07-24):
  `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`, `0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70`,
  admin Safe `0x2000ab040a899f914D6DfD2457C3dFBB22d4c762` (v1.3.0, threshold 1)

**Primary — Self Protocol**
- https://docs.self.xyz/docs/welcome/
- https://docs.self.xyz/docs/self-pass/architecture/zk-proof-architecture/
- https://docs.self.xyz/docs/self-pass/architecture/ofac-csca-auto-updaters/
- https://docs.self.xyz/docs/self-pass/architecture/verification-hub/
- https://docs.self.xyz/docs/self-pass/architecture/countries-list/
- https://docs.self.xyz/docs/self-pass/contracts/deployed-contracts/
- https://docs.self.xyz/docs/self-pass/document-specification/aadhaar/
- https://docs.self.xyz/docs/self-enterprise/get-started/how-it-works/
- https://docs.self.xyz/docs/self-enterprise/billing/plans/
- https://github.com/selfxyz/self
- On-chain: Celo hub `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF` (ERC-1967 proxy →
  `0xea0f37706def0bafbf4cfcedd27beb4148c138e6`)

- Nullifier source: `circuits/circuits/register/register.circom`
  (`signal output nullifier <== PackBytesAndPoseidon(HASH_LEN_BYTES)(passportVerifier.signedAttrShaBytes);`)

**Primary — Rarimo**
- https://docs.rarimo.com/zk-passport/ · https://docs.rarimo.com/zk-passport/contracts/
- https://github.com/rarimo/passport-zk-circuits · https://github.com/rarimo/passport-contracts
- Nullifier / document-hash source:
  `circuits/passportVerification/passportVerificationBuilder.circom` L100, L163-244
  (`passportHash = PoseidonHash(HASH_TYPE(signedAttributes)[first 252 bits][::-1])`),
  `circuits/identityManagement/identity.circom` (`dg1Commitment`, `dg15PubKeyHash`),
  `circuits/identityManagement/queryIdentity.circom` L38 & L98-107
  (`nullifier = Poseidon3(sk_i, Poseidon1(sk_i), eventID)`)

**Primary — Anon Aadhaar / UIDAI**
- https://github.com/anon-aadhaar/anon-aadhaar —
  `packages/circuits/src/aadhaar-qr-verifier.circom`, `packages/circuits/src/helpers/nullifier.circom`
- https://documentation.anon-aadhaar.pse.dev/docs/how-does-it-work
- https://uidai.gov.in/en/916-developer-section/data-and-downloads-section/19388-uidai-certificate-details-2.html
- https://www.uidai.gov.in/images/Circular_4_of_2026_reg_SHA-1_SHA-2_SHA-256_migration.pdf
- https://www.uidai.gov.in/images/Technical_Document_for_SHA-1_to_SHA-2_SHA-256_migration.pdf

**Secondary (labelled as such)**
- https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428
- https://self.xyz/blog/self-now-supports-indian-aadhaar-expanding-support-to-99-of-india-s-adult-population
- https://www.coindesk.com/business/2025/11/13/zero-knowledge-identity-startup-self-raises-usd9m-introduces-points-program
- https://www.biometricupdate.com/202511/self-completes-9m-seed-round-introduces-points-scheme-for-verification
- https://www.biometricupdate.com/202509/self-integrates-aadhaar-to-enable-age-identity-verification-with-zkps
- https://blog.zksecurity.xyz/posts/self-audit/
- https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now
