# Linea Proof of Humanity V2 — reading it off the chain, exhaustively

*Written 2026-07-25 while implementing `packages/sdk/src/adapters/linea-poh.ts`. Every address,
selector, revert payload and count below was obtained by a call made from this box on that date;
where a number came from an indexer rather than from the registry directly, it says so. This file
supersedes the "Reading Linea PoH" section of `privado-id-and-verax.md`, which named the wrong
portal — see §2.*

---

## 1. The thing that was thought impossible, and why it is not

`privado-id-and-verax.md` concluded, correctly for the read it was considering:

> `subject` is `bytes`, so address-indexed lookup on-chain requires the `IndexerModule` — which the
> Sumsub portal does **not** use. Therefore **there is no efficient on-chain "does address X have a
> PoH attestation" read for PoH V2.**

Both premises hold. `PortalRegistry.getPortalByAddress(0x501e742C…)` returns `modules: []`
(verified), Verax's `AttestationRegistry` keeps attestations in a mapping keyed by a sequential id,
and nothing indexes them by subject. Linea ships a signature path (`PohVerifier` + a signer API)
precisely because the passive read does not exist.

The conclusion only follows if you have to *search* for the subject. You do not, because **the
credential expires**, and that turns the problem inside out:

1. A PoH V2 attestation carries a term of **90 days**. Measured across all 50,475 attestations the
   schema has ever carried, `expirationDate - attestedDate` ranges over 7,775,9xx–**7,776,001**
   seconds — 90 days ± a few seconds of clock skew between Sumsub's wall clock (which computes
   `expirationDate` before the transaction is sent) and the block timestamp (which becomes
   `attestedDate`). The maximum is 7,776,001.
2. `attestedDate` is the block timestamp at write, and ids are handed out in order by
   `++attestationIdCounter`. So **`attestedDate` is monotone in attestation id.**
3. Therefore every *unexpired* attestation in the entire registry lies in the contiguous id range
   `[ first id with attestedDate >= now - 90 days , attestationIdCounter )`.

On this registry that range is **~1,000 ids wide against a counter of 6,366,748** — the Verax Linea
registry received 6.37M attestations in its life and roughly 700 in the last 90 days. Reading the
range whole costs six batched `eth_call`s through Multicall3 and takes **4–5 seconds**, and what
comes back is not one subject's answer but **the complete live population**.

So the adapter does not ask whether an address is verified. It enumerates every live credential the
protocol has issued and checks whether the address is among them. A probe is then a map lookup, and
a negative is *exhaustive* rather than a failure to find something.

Measured 2026-07-25, block 31,514,318:

| | |
|---|---|
| `getAttestationIdCounter()` | 6,366,748 |
| ids scanned (doubling ladder settled at 2^10) | 1,024 |
| attestations under the PoH V2 schema in range | 716 |
| revoked in range | 1 |
| **live attestations** | **500** |
| **distinct live subjects** | **499** (one holder renewed before expiry) |
| attestations from a non-Sumsub portal | 0 |
| attestations whose attester is not the portal's signer | 0 |

### Why a doubling ladder and not a bisection

The obvious implementation bisects for the boundary id (≈22 sequential `eth_call`s on a 6.37M
registry) and then scans forward from it. That bisection is wasted: a doubling ladder
(`counter-1, counter-2, counter-4, …`) finds a bracket at most twice the true window in **one**
batched round trip, and scanning a bracket twice as wide as it needs to be is cheaper than twenty
sequential round trips spent making it exact. **The scan is the boundary search.** Correctness needs
only that some rung predates the cutoff; tightness is an optimisation.

Two details that are correctness, not polish:

- **Everything reads at one pinned block.** The counter cannot advance underneath the scan and
  produce a view that is half of one moment and half of another — the torn read `reconcile.ts`
  exists to prevent, in miniature.
- **`now` is the pinned block's timestamp, not the local clock.** Expiry is what every on-chain
  consumer compares against `block.timestamp`; a skewed local clock must not decide whether
  somebody is verified.

The one assumption completeness rests on is the 90-day ceiling. The probe does not take it on
trust: any attestation found carrying a longer term doubles the window and repeats the scan
(`detail.windowWidened`), and the live test re-derives the maximum term over the whole live
population every run.

---

## 2. Our own research named the wrong portal, and the fix is not a better constant

`privado-id-and-verax.md` records:

> **Sumsub portal = `0xe8a3a57e84a27d55e37116af4681abd461b73922`**

That portal is real, is registered, and has issued **four** attestations — all on 2025-07-02/03,
two of them for the same subject, all expired since 2025-09-30. It is the deployment test. The
50,471 real ones came from **`0x501e742CF30eCE300E3e8CB45a975c15057D5B46`**.

An adapter pinned to the researched address would have returned `held: false` for the entire
population **while looking like it worked**: the contract answers, the schema matches, nothing
errors. It would have been silently wrong until somebody noticed that a protocol with 50,000
credentials had never once matched.

The lesson is not "use the other constant". It is that the portal address is the wrong thing to
pin, because Sumsub demonstrably deploys more than one. There are three registered Sumsub portals:

| Portal | Attestations | Note |
|---|---|---|
| `0x501e742CF30eCE300E3e8CB45a975c15057D5B46` | 50,471 on the PoH V2 schema | production |
| `0xe8a3a57e84a27d55e37116af4681abd461b73922` | 4 on the PoH V2 schema | deployment test; the one our research named |
| `0x6c145c9cbe3f7abb930485b0e4ac69738ca03161` | 11 on the *other* schema | "Sumsub Proof of Humanity", `0x0094bda6…c0d0af` |

All three carry `ownerName: "Sumsub"`, `name: "Sumsub Identity Verification Portal"`, and the same
`ownerAddress`: **`0x887F94C1283697c607b321860bd95263AC0E2467`**. That address is what the adapter
pins, and both facts about it are re-read at runtime rather than baked in.

The test-portal address is kept in the code as a tripwire, and a live test asserts it is registered
to the same owner *and* contributes nobody to the live population — so the reason the anchor is the
owner and not the portal is executable rather than a comment.

---

## 3. Who is allowed to say you are human

Presence of an attestation under the right schema is **not** evidence. Verax's
`AttestationRegistry` checks exactly one thing on a write: that the caller is a portal registered
in `PortalRegistry`. Schema ownership does not restrict portals, so any registered portal can write
under "Sumsub Proof of Personhood".

Four candidate anchors, and why three of them fail:

- **The portal address** — fails, §2: there are three of them and our research picked the dead one.
- **`ownerName`** — fails: it is a string the portal's creator supplies at registration. It says
  "Sumsub" on all three portals and would say "Sumsub" on anyone else's.
- **The `attester` field** — fails, and this one is worth stating precisely because it is the field
  an integrator would naturally reach for. It is `msg.sender` on the portal's `attest` call. The
  portal gates on an **ECDSA signature** instead, which we established by simulating `attest`:

  ```
  eth_call portal.attest({schemaId: 0x39d023…, expirationDate: now+90d,
                          subject: 0x1111…1111, attestationData: <valid encoding>}, [<65 bogus bytes>])

    from 0x1111111111111111111111111111111111111111  →  revert 0xf645eedf
    from 0xC5db96C1348041c56e455d4cc92BB46027831C0d  →  revert 0xf645eedf   (Sumsub's own attester)
    from 0x887F94C1283697c607b321860bd95263AC0E2467  →  revert 0xf645eedf   (the portal's owner)
  ```

  `0xf645eedf` is OpenZeppelin's `ECDSAInvalidSignature()`; with an empty payload the revert becomes
  `ECDSAInvalidSignatureLength(0)` (`0xfce698f7`), and with no payload at all a `Panic(0x32)`
  array-out-of-bounds from indexing `validationPayloads[0]`. **The identical revert from Sumsub's
  own key and from a stranger is the proof: the gate is on the signature, not on the caller.** So
  `attester` records whoever relayed the transaction, and pinning it would pin a relayer.
- **The portal's registered owner** — this is the one. `PortalRegistry` is permissioned:
  `isIssuer(0x887F94C1…2467)` is `true`, `isIssuer(0x1111…1111)` is `false`, and
  `deployDefaultPortal` from a non-issuer reverts. Only a registered portal can write to the
  registry at all, and only Consensys can add issuers.

The portal's authorised signer is then read **from the portal**, not hard-coded:
`signerAddress()` (selector `0x5b7633d0`, found by brute-forcing the contract's `PUSH4` selector
set — the portal is unverified on the explorers we can reach without a key) returns
`0xC5db96C1348041c56e455d4cc92BB46027831C0d`, which is the `attester` on all 50,475 attestations.
Same pattern as asking each Human Passport Decoder which resolver it trusts.

It is reported as corroboration and **not used as a filter**, deliberately: it is a key Sumsub may
rotate, and a rotation must not retroactively un-verify people. A live test holds the whole live
population to it instead, so a rotation is loud rather than invisible.

---

## 4. The finding: Linea's own read says yes ten months after the credential died

This is the reason to read the registry rather than the endpoint, and it is checkable in three
calls.

`privado-id-and-verax.md` recommends, reasonably, the easiest path:

> **REST, no auth** — `GET https://poh-api.linea.build/poh/v2/{address}` → bare `true` / `false`

That endpoint does not honour the expiry the attestation carries. Sampled **45 addresses whose
every PoH V2 attestation had expired**, drawn from eight cohorts spread across the schema's whole
history (earliest expiries 2025-09-29):

```
poh-api.linea.build/poh/v2/{addr}   →   true = 45, false = 0
```

It is not only the REST boolean. The signer API signs for them, and Linea's **on-chain** verifier
accepts the signature:

```
GET  poh-signer-api.linea.build/poh/v2/0xf1d1f85746458127f613e6cb597bf12d1eb17a27   → 200, 65-byte sig
     (that address's attestations expired 2025-09-29, 2025-09-30 and 2025-09-30)
call PohVerifier(0xBf14cFAFD7B83f6de881ae6dc10796ddD7220831).verify(sig, 0xf1d1f857…)  → true
```

A never-verified address gets HTTP 500 from the signer API, so the endpoint does distinguish
"verified" from "not verified" — it just answers **"was ever verified"** rather than **"is
currently verified"**, and the on-chain path inherits that from it. `PohVerifier.getSigner()` is
`0xdeFc3a33e18Dd479c5936F31497bc8650Dcfa070`, a *different* key from the Verax attester, so the
signature path and the attestation path are two separate authorities that have drifted apart.

The scale of the disagreement is the whole point:

| | |
|---|---|
| attestations ever issued on the schema | 50,475 |
| live on 2026-07-25 | **500** |
| distinct live subjects | **499** |

So the two answers describe populations two orders of magnitude apart. A scorer built on the vendor
boolean is pricing ~50,000 people as currently liveness-checked when ~500 are. Our reading is not
merely purer — on this protocol it is **more correct**, and it is the stricter direction, which is
the safe one.

Monthly issuance, from the Verax subgraph (indexer, not a direct registry read):

```
2025-07   813    2025-11  8,503    2026-03    571
2025-08 2,866    2025-12  5,136    2026-04    347
2025-09 1,444    2026-01 24,723    2026-05    325
2025-10 4,351    2026-02  1,264    2026-06    121
                                   2026-07     11
```

January 2026 was half the protocol's lifetime issuance and nothing has renewed since: 11
attestations in the first 25 days of July. This is a credential class that had a campaign, not a
population — and with a 90-day term the campaign has fully expired. `live: true` is still right (the
portal is registered, the signer answers, attestations landed this month), but the *weight* it can
carry for any given subject is small and short-lived by construction.

---

## 5. Addresses, selectors and payloads

**Linea mainnet, all verified to respond 2026-07-25.**

| What | Address |
|---|---|
| Verax `AttestationRegistry` (proxy; `router()` → the Router below) | `0x3de3893aa4Cdea029e84e75223a152FD08315138` |
| Verax `PortalRegistry` (proxy) | `0xd5d61e4ECDf6d46A63BfdC262af92544DFc19083` |
| Verax `SchemaRegistry` | `0x0f95dCec4c7a93F2637eb13b655F2223ea036B59` |
| Verax `Router` | `0x4d3a380A03f3a18A5dC44b01119839D8674a552E` |
| Sumsub production portal | `0x501e742CF30eCE300E3e8CB45a975c15057D5B46` |
| Sumsub portal owner — **the anchor** | `0x887F94C1283697c607b321860bd95263AC0E2467` |
| Sumsub portal signer (`signerAddress()`, read not pinned) | `0xC5db96C1348041c56e455d4cc92BB46027831C0d` |
| `PohVerifier` (the signature path, not read by the probe) | `0xBf14cFAFD7B83f6de881ae6dc10796ddD7220831` |
| `PohVerifier.getSigner()` | `0xdeFc3a33e18Dd479c5936F31497bc8650Dcfa070` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

**Schema `0x39d02301e928bea8be757163a804167b7f7eaa5ac01c39bc3d2e6da5a65cd23f`**, read back from
`SchemaRegistry.getSchema` (not from an indexer):

```
name        Sumsub Proof of Personhood
description Simple proof of personhood and uniqueness based on Sumsub liveness,
            deepfake detection and duplicate search
context     https://id.sumsub.com/linea-liveness
schema      (string levelInfo)
```

Every live attestation's `attestationData` decodes to the single string
`"linea-proof-of-personhood (TM ver.) - 2"`, and `version` is 10 on all of them.

**Registry ABI actually used.** `getAttestation(bytes32)` returns
`(bytes32 attestationId, bytes32 schemaId, bytes32 replacedBy, address attester, address portal,
uint64 attestedDate, uint64 expirationDate, uint64 revocationDate, uint16 version, bool revoked,
bytes subject, bytes attestationData)`. Ids are `bytes32(uint256(n))`; `getAttestation` reverts with
`0x0e35f2bc` above the counter, which is why an absent id is treated as information rather than as
an error.

**Selectors worth having**, since the portal is unverified on the explorers we can reach:

| Selector | Function | On |
|---|---|---|
| `0x5b7633d0` | `signerAddress()` | Sumsub portal |
| `0x07432196` | `attest((bytes32,uint64,bytes,bytes),bytes[])` | Sumsub portal |
| `0x523ba7ca` | `bulkAttest(…)` | Sumsub portal |
| `0xb75c7dc6` | `revoke(bytes32)` | Sumsub portal |
| `0xf645eedf` | `ECDSAInvalidSignature()` | revert |
| `0xfce698f7` | `ECDSAInvalidSignatureLength(uint256)` | revert |
| `0x0e35f2bc` | attestation-not-found | `AttestationRegistry` revert |

---

## 6. What the ontology entry changed to, and what did not change

`linea-poh` was already `trustRoot: kyc-vendor:sumsub`, `evidenceClass: StateIdentity`,
`ageCurve: Decay`, `decayHalfLifeDays: 90`, `forgeCostCents: 120000`, `rentCostCents: 3000`. **None
of that moved**, so no weight changed and the on-chain registry needs no reseed. What changed is
`implemented: true` and the notes.

Two facts the notes now carry:

- **The 90-day hard expiry means the 90-day half-life only ever applies over one credential
  life** — weight here can never fall below one half, and never below `2^-1` of the forge cost.
  This is the third instance of the same shape in this codebase: Human Passport hard-expires at 90
  days against a 180-day half-life, a Holonym credential expires within a year against 730. Worth
  saying once, in `docs/scoring.md`, rather than three times in three adapters: **a hard expiry
  truncates a decay curve, so a half-life longer than the expiry is a half-life that never
  completes.**
- **Cumulative issuance is not population**, with the hardest numbers we have anywhere: 50,475 vs
  500, a factor of 101.

The root is unchanged and still shared with `galxe-passport` (also Sumsub). That saturation is now
load-bearing rather than theoretical for any subject holding both, and §7 of
`landscape/ontology-coverage.md` still names the open question that decides how much it is worth:
whether Sumsub's face-search dedup is cross-client.

---

## 7. What is deliberately not read

- **`PohVerifier` + the signer API.** It is the path Linea documents, it needs no key, and it would
  be one `eth_call` — and it is wrong by ten months (§4). It also puts a vendor endpoint on the
  critical path to obtain the signature, which is the thing `adapters/index.ts` exists to avoid.
- **`poh-api.linea.build`.** Same staleness; and a boolean carries no date, so on a `Decay` curve it
  would score at full weight, which is the inflation direction.
- **The `Sumsub Proof of Humanity` schema `0x0094bda6…c0d0af`** (11 attestations, third portal). A
  variant that never carried a population. Recorded so a later iteration does not rediscover it.
- **The Verax subgraph**, in the probe. It is keyless and it agrees with us exactly — 500
  attestations, 499 subjects, zero symmetric difference at a pinned block — which is precisely why
  it makes a better *test oracle* than a dependency. It is `api.studio.thegraph.com/query/67521/…`,
  somebody else's Studio deployment, and it can vanish without notice.
- **Any of the other Verax deployments** (Arbitrum, Base, BSC). PoH V2 is Linea-only.

---

## 8. Open questions this file could not close

1. **Is the portal's signature replay-protected across subjects?** The portal reverts
   `ECDSAInvalidSignature` before we learn anything about nonce handling, and it has several
   unidentified error selectors (`0x8ffa736b`, `0x5f9bd907`, `0x01a408bd`, `0x5bae3ee3`). It does
   not affect the read — we consume whatever the registry accepted — but it is the security
   parameter of the *write*, and it is unverified. Resolving it needs the portal's source, which is
   not on any explorer we can reach without a key.
2. **Distinct humans ever verified.** 50,475 attestations over an unmeasured number of subjects; an
   exhaustive on-chain enumeration of the full 99,577-id history was still recovering rate-limited
   batches when this was written, and the paged indexer count was rate-limited too. The live figure
   (499 of 500) suggests renewal is rare, so the ever-verified count is probably close to 50,000 —
   but "probably" is not a measurement and it is not written into the ontology.
3. **Why January 2026.** 24,723 attestations in one month, half the protocol's lifetime issuance,
   and near-zero since. Almost certainly an incentive program. If it was, the January cohort is the
   farmed one — and on a `Decay` curve that cohort has already expired, so it cannot hurt us. It
   would still be worth knowing before anyone argues for a `Ramp` here.
