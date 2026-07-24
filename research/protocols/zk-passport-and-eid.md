# ZK proofs over government e-passports and national eIDs

> STATUS: in progress — being researched 2026-07-24

**One-liner:** A family of ZK circuit + mobile-NFC toolkits (ZKPassport, Self Protocol/OpenPassport,
Anon Aadhaar, Rarimo) that let a user prove statements about a government-issued electronic document
(ICAO 9303 e-passport / eID, or India's Aadhaar signed QR) without revealing the document, yielding a
state-identity-rooted personhood credential.

**Category:** state-issued identity — *not* native uniqueness. Uniqueness is only as good as the
nullifier scheme, and every scheme here is **per-document**, not per-human (see nullifier section).
**Chains:** Celo (Self), Ethereum / Sepolia / Base (ZKPassport), Rarimo L2 + bridged EVM (Rarimo),
Ethereum/any EVM (Anon Aadhaar verifier contracts).
**Status (2026-07):** live, and the most actively-shipped corner of the personhood space.
**Aggregator verdict:** (TBD)

---

## 1. The shared cryptographic mechanism (ICAO 9303)

### What is on the chip

An ICAO 9303 e-passport (the "biometric passport", chip logo on cover) contains a contactless IC
holding Data Groups:

| DG | Contents |
|----|----------|
| DG1 | MRZ (machine-readable zone) — name, DOB, sex, nationality, document number, expiry |
| DG2 | Facial image (JPEG/JP2) |
| DG3 | Fingerprints (protected by Extended Access Control — normally unreadable) |
| DG7 | Signature image |
| DG11/DG12 | Additional personal / document details |
| DG15 | **Active Authentication public key** (present only if the issuer implemented AA) |
| **SOD** | Document Security Object: a CMS/PKCS#7 SignedData containing the hash of every DG, signed by the issuer's Document Signer |

### The PKI chain

```
CSCA (Country Signing Certificate Authority, one per State, self-signed, 3-5 yr cycle)
  └─ signs → DSC (Document Signer Certificate, rotated often, thousands per country over time)
       └─ signs → SOD (per-passport, contains hashes of DG1..DGn)
            └─ hashes → DG1 (MRZ), DG2 (face), ...
```

**Passive Authentication (PA)** = verify SOD signature chains to a trusted CSCA, and verify that the
DG hashes in the SOD match the DGs you read. This proves *the data was issued by a State*. It does
**not** prove the data came from a physical chip in your hand — a PA-valid data set can be copied
byte-for-byte and replayed forever.

**Active Authentication (AA)** = the chip holds a private key whose public half is in DG15; the
reader sends a random challenge, the chip signs it. This proves the *physical chip* is present.
**Chip Authentication (CA)** (part of EAC) is the newer equivalent via key agreement.

### What the ZK circuits actually prove

All of these projects implement roughly the same statement:

> "I know a byte string DG1 and a signature chain such that: H(DG1) ∈ SOD, SOD is signed by a DSC,
> that DSC is signed by a CSCA whose public key is a leaf of merkle root R, and the following
> predicates over DG1 hold (age ≥ 18, nationality ∈ set, not expired, …). I reveal only those
> predicates plus a nullifier."

The heavy lifting is verifying **RSA / ECDSA signatures over SHA-1/224/256/384/512 inside a
circuit**, for the many algorithm combinations that different countries use. This is why every one
of these projects ships dozens of circuit variants keyed by (sig alg, key size, hash alg, curve).

### The CSCA master list problem (critical for us)

`R`, the trusted-root merkle root, has to come from somewhere. ICAO runs a **Master List** —
CSCA certificates cross-signed and distributed via the ICAO PKD (Public Key Directory). Problems:

- Not every country is in the ICAO PKD. Some publish CSCAs only bilaterally or on a national
  website; some do not publish at all. Coverage is therefore a **political** variable, not a
  technical one.
- The list must be *curated*: someone parses the master list, extracts keys, and posts a merkle root
  on-chain. **Whoever controls that root can add a rogue CSCA and mint unlimited "citizens".**
- Self mitigates this partly: the CSCA/DSC trees are described as permissionless to *append*
  (anyone can add a certificate by proving validity), but the source-of-truth is still "the ICAO
  masterlist" as ingested by Self's updater service.
  ([Self docs — OFAC & CSCA auto-updaters](https://docs.self.xyz/docs/self-pass/architecture/ofac-csca-auto-updaters/):
  "Public keys are extracted and validated using Subject Key Identifiers (SKIs)… A Merkle tree is
  constructed from validated keys (~500 CSCAs, depth 12)… new certificates can be added by anyone.")

> **Aggregator implication:** the root-of-trust for *every* protocol in this file is a curated
> certificate set. If we score a passport credential highly, we are trusting (a) ~190 governments'
> signing keys and (b) the specific curator's list-update process. Treat the curator as a trusted
> party unless we independently pin the master list ourselves.

### Active authentication: who does it?

| Project | Passive Auth | Active Auth / Chip Auth | Notes |
|---|---|---|---|
| Self Protocol | Yes | **No** — explicitly "currently not supported"; architecture reserves DG15-based AA (sign a recent blockhash) for the future ([source](https://docs.self.xyz/docs/self-pass/architecture/zk-proof-architecture/)) | So a leaked/purchased passport *data dump* is sufficient to register |
| ZKPassport | Yes | TBD |  |
| Rarimo | Yes | TBD |  |
| Anon Aadhaar | N/A (different mechanism) | N/A | Signed QR, no chip at all |

> **This is the single most important finding for scoring.** Without AA, "I hold a valid passport
> proof" degrades to "I, or anyone who obtained this passport's chip dump, hold a valid proof."
> Passport data dumps are a real commodity (border/hotel scans, leaked KYC databases, resold
> document images + chip reads).

---

## 2. Per-project detail

### Self Protocol (self.xyz) — formerly OpenPassport / Proof of Passport

Acquired/merged: Self launched following Celo's acquisition of OpenPassport
([Celo blog](https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428)).
"Proof of Passport" → "OpenPassport" → "Self" is one lineage, not three projects.

- Documents: passports, EU ID cards, Indian Aadhaar, plus a "KYC attestation" path.
- Architecture: **register** (heavy RSA/ECDSA circuit, run in a **TEE**, not on device) → identity
  commitment inserted into an on-chain "identity pool" merkle tree; **disclose** (light Poseidon
  circuit, client-side) proves membership + predicates.
- Nullifiers: *attestation nullifier* = Poseidon over the DSC-signed message (incl. DG2 entropy) →
  one per document; *action nullifier* = Poseidon(user secret, app scope) → **app-scoped**, scope
  derived deterministically from DNS.
- Claimed scale: "Self Pass & Connect currently have over seven million activated users"
  (self.xyz docs, as surfaced 2026-07-24 — TO VERIFY on a primary page).
- **2026 product pivot signal:** docs navigation now leads with **"Enterprise"**, and **Self Pass is
  labelled "Legacy"**. There is a full `self-enterprise` section with API keys, billing, credits,
  plans, webhooks. Also a new **Agent ID / ERC-8004** product line.
  (Nav structure of https://docs.self.xyz, fetched 2026-07-24.)

(more per-project detail pending)

### ZKPassport

- Docs: https://docs.zkpassport.id
- Documents: "Only passports, national IDs, and residence permits that comply with ICAO 9303
  standards **whose issuing country publish their signing certificates** are supported."
  ([limitations](https://docs.zkpassport.id/limitations))
- **On-chain verifier: `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`, described as deterministic
  (same address) across Ethereum Mainnet, Ethereum Sepolia, and Base Mainnet.**
  ([onchain docs](https://docs.zkpassport.id/getting-started/onchain)) — UNVERIFIED on an explorer
  as of this writing; must confirm.
- Verifier interface:
  `function verify(ProofVerificationParams calldata params) external returns (bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper)`
  plus helpers `verifyScopes()`, `isAgeAboveOrEqual()`, `isNationalityIn()`, `isIssuingCountryIn()`,
  `getDisclosedData()`, `getBoundData()`.
- Public inputs include: **certificate registry root, circuit registry root, current date, service
  scope, parameter commitments, nullifier type, scoped nullifier.**
- Nullifier: "One passport produces one nullifier per app" → app-scoped, per-document.
- FaceMatch (liveness-ish add-on): "iPhones can provide this with good guarantees. On Android, the
  app may refuse to perform the face scan on some devices considered untrustworthy." Also notes
  that using only a *photo* of a document "provides close to no guarantee".
- SDK: `@zkpassport/sdk` and `@zkpassport/ui` (Apache-2.0, v0.16.1 published 2026-07-21).
  Monorepo: https://github.com/zkpassport/zkpassport-packages; circuits (Noir, Apache-2.0):
  https://github.com/zkpassport/circuits.

**Nullifier derivation — read from the actual circuit source (verified 2026-07-24):**

`src/noir/lib/commitment/common/src/lib.nr`:

```noir
pub fn calculate_private_nullifier<let SIG: u32>(
    dg1: DG1Data, e_content: EContentData, sod_sig: [u8; SIG],
) -> Field {  // Poseidon2 over packed(DG1) ‖ packed(eContent) ‖ packed(SOD signature)
```

and `calculate_scoped_nullifier`:

```noir
Poseidon2::hash([salted_private_nullifier.value, service_scope, service_subscope], 3)
// or, in salted mode, hash([..., service_scope, service_subscope, nullifier_secret], 4)
```

So: **private nullifier = Poseidon2(DG1 ‖ eContent ‖ SOD signature)**. DG1 is the MRZ, which
contains the **document number and the expiry date**; the SOD signature is unique per document.
Therefore the ZKPassport nullifier is strictly **per-document, not per-human**:
- passport renewal ⇒ brand-new nullifier (the same human can re-register);
- dual citizenship ⇒ two documents ⇒ two nullifiers;
- passport + national ID + residence permit from the same country ⇒ potentially three.

Salted mode uses a **vOPRF** (`src/noir/lib/commitment/scoped-nullifier/src/lib.nr` calls
`verified_oprf(...)`, BabyJubJub, domain separators `DS_OPRF`/`DS_DLOG`) so that the issuing
government — which knows DG1/eContent/SOD-sig — cannot recompute the nullifier. **Non-salted mode is
the default and is government-recomputable**; ZKPassport says so explicitly:
"The default identifier can be recomputed by anyone with complete knowledge of the ID chip data —
including the government that issued the ID" ([personhood example](https://docs.zkpassport.id/examples/personhood)).
The salted mode introduces a dependency on ZKPassport's OPRF service (its public key hash is a
public input) — i.e. **salted = private but vendor-dependent; unsalted = permissionless but
government-linkable.** That trade-off matters for us.

Circuit also emits a `nullifier_type` public input with values NON_SALTED / SALTED /
NON_SALTED_MOCK / SALTED_MOCK. Mock types are triggered by the fake issuing country code `ZKR`, so
an aggregator **must reject mock nullifier types** or accept test passports as real.

**Active authentication: no.** A full grep of `zkpassport/circuits` for `DG15`, `active_auth`,
`chip_auth` returns nothing (checked 2026-07-24, HEAD). The circuit families present are
`bind, compare, data-check, disclose, exclusion-check, facematch, inclusion-check, main, oprf-auth,
sig-check`. ZKPassport is **passive-authentication only**, like Self.

**Sybil caveat, in ZKPassport's own words:** "A person can have multiple IDs" — making it
"one-ID-per-account rather than one-person-per-account"
([personhood example](https://docs.zkpassport.id/examples/personhood)).

**Deployed contracts (from `src/solidity/deployments/*.json` in the circuits repo, HEAD 2026-07-24
— these are repo-declared, UNVERIFIED against block explorers):**

| Role | Chain | Address |
|---|---|---|
| Root verifier (stable entrypoint) | Ethereum (1), Sepolia (11155111), Base (8453) — same address | `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` |
| Certificate/root registry | Ethereum mainnet | `0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70` |
| Sub-verifier v0.20.0 | Ethereum mainnet | `0x358324e0D0deeA401078aeB2dc252157B678b43C` |
| Sub-verifier v0.20.0 | Base | `0x8c424C342211DAde4Bf40B0f4c5a09D9a8810694` |
| Sub-verifier v0.20.0 | Sepolia | `0xEFC0426f0BF0737c3c04340076361b6979127195` |
| Verifier helper v0.18.0 | Ethereum mainnet | `0x9894282C73AFaDF1c5c63b6FAc0169039fc42983` |
| Verifier helper v0.18.0 | Base | `0x1887a01437Ddbee7Dc7cFdA666eEfAd441d671BD` |
| **Admin key on sub-verifiers** | all | `0x2000ab040a899f914D6DfD2457C3dFBB22d4c762` |

Plus per-"outer_count" UltraHonk proof verifiers (`outer_count_4` … `outer_count_13`, one per
number of disclosure sub-proofs composed); e.g. mainnet `outer_count_4 =
0x1780C9009AEd02d20f6e9B7c988BF313df7519dC`.

> The `admin` address on the sub-verifier and the ability to publish new certificate-registry roots
> is the centralization surface. **We must check who can call the root-update function on
> `0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70` — if it is a single EOA, ZKPassport can mint
> arbitrary "citizens" of any country.** (See Open questions.)

### Anon Aadhaar

**Completely different trust root: no chip, no ICAO, no CSCA.** Aadhaar is India's national ID
(~1.3–1.4bn enrolled). The credential is the **Aadhaar "secure QR code"** printed on e-Aadhaar
PDFs / physical cards: a compressed byte blob of the holder's demographic data **plus a JPEG2000
photo**, RSA-signed by UIDAI. Anon Aadhaar verifies that RSA signature inside a Circom circuit.

Read from `packages/circuits/src/aadhaar-qr-verifier.circom` (HEAD, checked 2026-07-24):

```circom
template AadhaarQRVerifier(n, k, maxDataLength) {   // instantiated as (121, 17, 512*3)
  signal input qrDataPadded[...]; signal input signature[k]; signal input pubKey[k];
  signal input revealAgeAbove18, revealGender, revealPinCode, revealState;
  signal input nullifierSeed;  // public
  signal input signalHash;     // public
  signal output pubkeyHash, nullifier, timestamp, ageAbove18, gender, pinCode, state;
```

and `helpers/nullifier.circom`:

```circom
// nullifier = hash(nullifierSeed, hash(photo[0:15]), hash(photo[16:31]))
out <== Poseidon(3)([nullifierSeed, first16Hasher.out, last16Hasher.out]);
```

**Consequences (important, and different from the passport family):**

1. **The UIDAI public key is NOT constrained inside the circuit.** `pubKey` is a private input and
   `pubkeyHash` is an *output*. The verifier (contract or backend) must compare `pubkeyHash`
   against the known-good UIDAI key hash. Get that wrong and any RSA key produces a "valid" proof.
   → For an aggregator, **we must independently pin the UIDAI pubkey hash**, not trust the SDK.
2. **The trust root is a single government key**, published at
   https://uidai.gov.in (developer section → UIDAI certificate details). One key, one issuer,
   rotated at UIDAI's discretion. When it rotates, every relying party must add the new key hash;
   old proofs remain valid against the old hash, so the pinned set grows and each entry must be
   trusted forever.
3. **UIDAI is actively changing its crypto.** UIDAI Circular 4 of 2026 mandates migration from
   SHA-1 to SHA-2/SHA-256 for digital signing in the Aadhaar authentication ecosystem, with a
   **deadline of 2026-06-30**
   ([circular PDF](https://www.uidai.gov.in/images/Circular_4_of_2026_reg_SHA-1_SHA-2_SHA-256_migration.pdf),
   [technical doc](https://www.uidai.gov.in/images/Technical_Document_for_SHA-1_to_SHA-2_SHA-256_migration.pdf)).
   CAUTION / UNVERIFIED: that circular is scoped to *authentication request* signing by requesting
   entities (AUA/KUA), which is not literally the offline QR signature Anon Aadhaar consumes. But it
   is direct evidence that **UIDAI unilaterally rotates signing algorithms on a schedule that a
   dormant open-source circuit will not keep up with.** Verify current QR signature alg before
   integrating.
4. **The nullifier is the hash of the photo bytes.** Stable across re-downloads of the e-Aadhaar
   *as long as the photo does not change*; changes if the holder does a biometric/photo update.
   Seeded by an app-supplied `nullifierSeed` ⇒ **app-scoped**, so unlinkable across apps — but also
   means we cannot dedupe a user across two of our own integrations unless we fix the seed.
5. **No liveness, no possession-of-anything.** The QR is a *static file*. Anyone holding a copy of
   your e-Aadhaar PDF (landlords, telcos, hotels, employers, and every Aadhaar data breach) can
   produce a valid Anon Aadhaar proof for you. There is no chip challenge, no device binding, no
   biometric. This is materially weaker than even passive-authentication passport proofs, because
   e-Aadhaar PDFs circulate routinely.
6. `timestamp` output = when UIDAI signed the QR (i.e. when the e-Aadhaar was generated). A relying
   party can require recency, which slightly raises the bar (you need a *recent* download), but the
   PDF is still transferable.

**Liveness — this looks dormant.** `anon-aadhaar/anon-aadhaar` (MIT, 250 stars): last push
**2025-04-21**, last release **v2.4.3 on 2024-12-12**. npm `@anon-aadhaar/core`,
`@anon-aadhaar/react`, `@anon-aadhaar/contracts` all last published **2024-12-12**, all MIT.
(GitHub API + npm registry, checked 2026-07-24.) Note `privacy-scaling-explorations/anon-aadhaar`
and `anon-aadhaar/anon-aadhaar` resolve to the same repo — it was spun out of PSE.
→ ~19 months without a release. The *live* Aadhaar path in 2026 is Self Protocol's Aadhaar support.

### Rarimo ZK Passport

The most *on-chain-native* of the three passport projects, and **the only one that actually
implements Active Authentication.**

- Docs: https://docs.rarimo.com/zk-passport/ ; contracts reference:
  https://docs.rarimo.com/zk-passport/contracts/
- Circuits: https://github.com/rarimo/passport-zk-circuits (Circom, MIT, 94 ★, last push
  **2026-07-02**, last release v0.2.13 2025-02-11) + a Noir port (`passport-zk-circuits-noir`);
  migration to Noir underway.
- Contracts: https://github.com/rarimo/passport-contracts (MIT, 32 ★, last push **2025-11-20**).
- npm: `@rarimo/zk-passport`.

**Contract addresses on Rarimo Network** (from the docs page, checked 2026-07-24; UNVERIFIED on an
explorer):

| Contract | Address |
|---|---|
| StateKeeper (singleton state: identity SMT, certificate SMT, passport↔identity bonds) | `0x61aa5b68D811884dA4FEC2De4a7AA0464df166E1` |
| Registration2 | `0x11BB4B14AA6e4b836580F3DBBa741dD89423B971` |
| RegistrationSMT | `0x479F84502Db545FA8d2275372E0582425204A879` |
| CertificatesSMT | `0xA8b350d699632569D5351B20ffC1b31202AcEDD8` |

Key functions:
```solidity
register(certificatesRoot, identityKey, dgCommit, passport, zkPoints)
registerViaNoir(certificatesRoot, identityKey, dgCommit, passport, zkPoints)
revoke(identityKey, passport)
reissueIdentity(...)
registerCertificate(certificate, icaoMember, icaoMerkleProof)   // permissionless CSCA/DSC ingestion
```
Verifiers expose `verifyProof(uint[2] _pA, uint[2][2] _pB, uint[2] _pC, uint[4] _pubSignals)`; a
`TD3QueryProofVerifier` handles selective disclosure; `PublicSignalsBuilder` builds a 23-element
signal array. Cross-chain integrators call `isRootValid()` on a `RegistrationSMTReplicator`, so the
registration root can be consumed from other EVM chains.

**Active Authentication — Rarimo does it.** The contract set includes
`PECDSASHA1Authenticator` (ECDSA AA), `PRSASHAAuthenticator` (RSA AA), and **`PNOAADispatcher` for
passports *without* AA, which "returns true automatically."** That last one is the catch: AA is
enforced only where the issuing country implemented DG15, and the no-AA path is silently accepted.
Rarimo also states "Only passports with Active Authentication support recovery at the moment."
→ For scoring, we would need to know *which* dispatcher was used per registration. UNCLEAR whether
that is exposed on-chain in a readable way — worth checking `StateKeeper`'s passport bond struct.

**Rarimo says the quiet part out loud:** "There's no way to prevent a holder of multiple passports
from onboarding multiple times." ([docs.rarimo.com/zk-passport](https://docs.rarimo.com/zk-passport/))

**Trust caveat — "light verification mode":** on-device only checks passport integrity (DG hashes);
verifying the *issuer's signature* is delegated to Rarimo's verifiers. In light mode the trust root
is Rarimo, not the PKI.

---

## Repo / package liveness table (checked 2026-07-24)

| Repo / package | License | Last push | Last release | Notes |
|---|---|---|---|---|
| `selfxyz/self` (was `zk-passport/openpassport`, redirects) | NOASSERTION ("Other") | 2026-07-24 | no GH releases | 1,253 ★, very active |
| `@selfxyz/core` (npm) | MIT | — | 1.2.0-beta.1, 2026-02-05 | still beta |
| `@selfxyz/qrcode` (npm) | MIT | — | 1.0.24, 2026-05-14 | |
| `@selfxyz/contracts` (npm) | MIT | — | 1.2.3, **2025-09-26** | contract SDK is ~10mo stale |
| `zkpassport/circuits` | Apache-2.0 | 2026-07-24 | no GH releases | Noir circuits |
| `zkpassport/zkpassport-packages` | none declared | 2026-07-24 | — | monorepo |
| `@zkpassport/sdk`, `@zkpassport/ui` (npm) | Apache-2.0 | — | **0.16.1, 2026-07-21** | shipping weekly |
| `anon-aadhaar/anon-aadhaar` | MIT | **2025-04-21** | **v2.4.3, 2024-12-12** | dormant |
| `@anon-aadhaar/*` (npm) | MIT | — | **2.4.3, 2024-12-12** | dormant |
| `rarimo/passport-zk-circuits` | MIT | 2026-07-02 | v0.2.13, 2025-02-11 | maintained |
| `rarimo/passport-contracts` | MIT | 2025-11-20 | — | slower |

---

## References

- https://docs.self.xyz/docs/self-pass/architecture/zk-proof-architecture/
- https://docs.self.xyz/docs/self-pass/architecture/ofac-csca-auto-updaters/
- https://docs.zkpassport.id/getting-started/onchain
- https://docs.zkpassport.id/limitations
- https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428
- https://github.com/zkpassport/circuits
- https://github.com/rarimo/passport-zk-circuits
