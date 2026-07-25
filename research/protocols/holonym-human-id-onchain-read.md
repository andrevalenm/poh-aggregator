# Holonym / Human ID, read on chain

**Date:** 2026-07-25. Everything below was read from OP Mainnet or from the protocol's own
published source on the day, and every number in it was produced by a call this file records how
to repeat. Companion to `billions-silk-unitap-sismo-intuition.md`, which established what the
credential *is*, who issues it and what its trust roots are; this file is about **reading it**.

Implemented as `packages/sdk/src/adapters/holonym.ts`, covering two ontology entries —
`holonym-gov-id` (root `kyc-vendor:unattributed`) and `holonym-biometrics` (root
`kyc-vendor:facetec`).

---

## 1. The blocker was wrong, and that is the finding

`ontology-coverage.md` §6 ranked Holonym third and put a condition on it: *"Requires us to
publish a stable action-id first, which is a design decision, not a lookup."* That came from the
integration surface Holonym documents — the REST API

```
GET https://api.holonym.io/sybil-resistance/gov-id/optimism?user=0x…&action-id=…
```

which will not answer without an action-id, because uniqueness in this protocol is **scoped per
action**: a human registers once per action-id, and two applications using different action-ids
cannot link the same person. Choosing ours is a product decision with privacy consequences, and
it is not the sort of thing an unattended iteration should decide.

The Hub does not work that way. `Hub.getSBT(address, circuitId)` is keyed on the **holder and
the circuit**, and the action-id comes back *inside* the proof, as `publicValues[2]`. So we read
whichever action a credential was minted for rather than asserting one, and the design decision
evaporates — we are not choosing a namespace, we are reporting the one the subject already used.

Two further things fall out of reading the Hub instead of the vendor:

- **The API applies an off-chain blocklist we cannot see.** `sybilResistanceGovId` in
  `holonym-foundation/holonym-api` calls `blocklistGetAddress(address)` against DynamoDB and
  returns `{result:false}` on a hit, before it ever touches a contract. So their endpoint answers
  a question about their policy; the Hub answers a question about the chain. Ours is the one we
  can audit.
- **The API's gov-id endpoint falls back to the zk-passport circuit.** If the KYC SBT is absent
  it retries with `v3ZKPassportSybilResistanceCircuitId` and returns the same `true`. For us that
  would be a root error, not a convenience: a passport chip is `state-document:icao-9303` and a
  vendor KYC check is not, and merging them would let one document score under two roots. The
  adapter reads the KYC circuit and only the KYC circuit.

---

## 2. Addresses, circuits and issuers

Hub V3, OP Mainnet (chainId 10): **`0x2AA822e264F8cc31A2b9C22f39e5551241e94DfB`**.
`name()` → `"Holonym V3"`. First block holding its code — found by bisecting `eth_getCode` —
**115,616,235**, timestamp 1706831247 (2024-02-01T23:47:27Z).

Source read for this file: `holonym-foundation/id-hub-contracts` (`contracts/Hub.sol`,
`zk/circuits/circom/V3.circom`, `zk/circuits/circom/V3SybilResistance.circom`),
`holonym-foundation/holonym-api` (`src/services/sybil-resistance.js`, `src/constants/misc.js`),
`holonym-foundation/id-server` (`src/constants/misc.ts`,
`src/services/admin/issue-verax-attestation.ts`). All retrieved 2026-07-25.

| Credential | circuitId | issuer (`publicValues[4]`) | in our ontology |
|---|---|---|---|
| gov-id / KYC | `0x729d660e…0a120b` | `0x03fae82f…3e1993` | `holonym-gov-id` |
| biometrics | `0x0b512122…3c3a3d15` | `0x0d4f849d…dbfd922` | `holonym-biometrics` |
| phone | `0xbce052cf…5483495` | `0x40b8810c…c61c30a4` | no — SIM farms |
| clean-hands | `0x1c98fc4f…742a19` | — | no — sanctions screen, not personhood |
| zk-passport (API's id) | `0x14c35133…0b747e` | `0x231c6ff4…50df96` | no — ICAO root, needs its own entry |
| e-passport (id-server's id) | `0xf2ce248b…67364d` | — | no — same |

Note the last two rows: `holonym-api` and `id-server` name **different** circuit ids for the
passport credential (`v3ZKPassportSybilResistanceCircuitId` vs
`v3EPassportSybilResistanceCircuitId`). Neither repository mentions the other's. That is one
reason the passport tier is not implemented here: we do not yet know which of the two the current
issuance path mints, and an ICAO-rooted adapter reading the wrong circuit would silently find
nobody. It is worth resolving — the ICAO root is the largest correlation cluster in the landscape
— but it needs an issuance observed end to end, not a constant copied from a repository.

Legacy v2 store, recorded and **not** read: `SybilResistance`
`0xdD748977BAb5782625AF1466F4C5F02Eb92Fce31`, `isUniqueForAction(address, uint256)`. See §6.

---

## 3. Reading it: three calls, no archive node, no vendor

```
sbtOwners(keccak256(abi.encodePacked(user, circuitId)))  -> (uint256 expiry, bool revoked)
getSBT(user, circuitId)                                  -> (expiry, uint256[5] publicValues, revoked)
nullifiersToIdentifiers(publicValues[3])                 -> bytes32 identifier
```

**The mapping first, deliberately.** `getSBT` reverts with `"SBT is expired or does not exist"`
for expired, revoked *and* never-minted alike (`Hub.sol` `_getSBT`), so calling it blind turns a
KYC check that lapsed in January into a probe *error* — an unreadable credential rather than an
expired one, which is a different claim about a person. The automatic getter for the `sbtOwners`
mapping runs none of those checks and returns the struct's non-array members, and `expiry == 0`
is the one value a holder can never have. It also means the common case — an address with no
Holonym credential — costs a single `eth_call`.

**`publicValues` is `[expiry, recipient, actionId, actionNullifier, issuerAddress]`**, from
`V3SybilResistance.circom` and confirmed against the validation Holonym performs on itself in
`issue-verax-attestation.ts`. The issuer is a Poseidon hash of an EdDSA public key — 254 bits,
not an EVM address — so it is compared numerically. Holonym's own API compares it as a *string*
against a constant they store unpadded, which for the phone issuer is a 62-hex-character literal;
we did not chase whether that comparison ever fails for them, but it is why ours is a BigInt.

**Checking the issuer is not optional, and the contract says so.** `Hub.sol` carries the warning
three times in its own comments:

> *IMPORTANT: make sure you check the public values such as actionId from this. Someone can forge
> a proof if you don't check the public values e.g., by using a different issuer or actionId*

The circuit proves that *an* issuer signed the credential; anyone can run an issuer key. An SBT
under the right circuit id whose `publicValues[4]` is not Holonym's key is a self-issued
credential in the right shape, and a probe that treated presence as proof would count it. Ours
returns `held: false` with `detail.sbt = "issuer-mismatch"` and prints both keys.

**The third call is about uniqueness, not existence.** `setSBT` burns a nullifier only
`if (nullifier != 0)`, and the value it burns is a *parameter* — nothing constrains it to equal
`publicValues[3]`, the nullifier the circuit derived from the holder's secret and the action.
If the two disagree, the human's uniqueness slot for that action was never consumed and the same
person can hold the credential on any number of addresses, which would make it a liveness signal
wearing a uniqueness credential's clothes. `nullifiersToIdentifiers(publicValues[3])` must equal
this holder's identifier. Ten SBTs sampled across the registry's whole life all passed;
`detail.uniquenessNullifierRegistered` reports it per subject rather than assuming it.

Nothing in the probe reads historical state. That is worth saying out loud after the Farcaster
adapter: of eight keyless OP endpoints, only three serve archive `eth_call`, and this adapter
leaves all three of them to the reader that genuinely needs them.

---

## 4. The date: a protocol that fuzzes its own timestamps, and the proof that survives it

The Hub stores **no issuance date**. It stores an expiry, and `V3.circom` says exactly what that
expiry is:

```
// A time the user can choose for their credential to expire. Max is one year from iat.
// To keep anonymity, the user should choose a random time slightly before iat, depending
// On how long they want the anonymity
signal input expiry;
```

So the expiry is not issuance-plus-a-constant. It is a value the *holder* picked, and they were
advised to pick it randomly, precisely to blur the question we are asking. Any adapter that
subtracted a fixed term and called the result an issuance date would be inventing one.

What the circuit *does* give up is a constraint, and constraints are provable:

```
// Check that expiry is <= 1 year of issuance
component n2b = Num2Bits(25);          n2b.in <== expiry - iat;
component lt  = LessThan(25);          lt.in[0] <== expiry - iat;
                                       lt.in[1] <== 31536001;   // 1 year + 1 second
lt.out === 1;
```

`expiry - iat` is range-checked to 25 bits (so it cannot be negative) and required to be under
31,536,001. Therefore, for **every** SBT the Hub holds:

```
iat >= expiry - 31,536,000
```

That is a lower bound on issuance, enforced by a proof the Hub verified before minting. A lower
bound on issuance is an **upper bound on age**, and on a `Decay` curve — where weight falls with
age — the oldest the credential can be is the least weight it can support. So the adapter uses
the bound *as* the date: it can only understate freshness, never inflate it, and the error is
bounded by however much anonymity the holder bought. Flagged `date-from-expiry-and-max-term`,
which surfaces as the `issuance-date-derived-from-expiry` caveat.

This is the same principle iteration 1 applied to Circles and iteration 4 to the Farcaster
import — keep the date that can only cost the subject weight, and say so — arriving from the
opposite direction: there the date was too *late* on a ramp, here it is too *early* on a decay.

**How loose is it in practice?** Fifteen SBTs were dated by searching historical state for the
block they were minted in (§5) and compared against their expiry. The mint is an upper bound on
issuance — the credential existed before it was minted — so "bound before mint" is the *most*
the bound can be understating the credential's freshness:

| token | credential | minted | `expiry − mint` | bound before mint |
|---|---|---|---|---|
| 238,706 | gov-id | 2026-07-25 12:42 | 107.98 d | **257.02 d** |
| 238,705 | gov-id | 2026-07-25 11:40 | 352.54 d | 12.46 d |
| 238,704 | gov-id | 2026-07-25 10:18 | 340.44 d | 24.56 d |
| 238,704 | biometrics | 2026-07-24 20:32 | 336.72 d | 28.28 d |
| 238,702 | biometrics | 2026-07-25 09:33 | 177.53 d | **187.47 d** |
| 238,701 | gov-id | 2026-07-25 08:45 | 350.60 d | 14.40 d |
| 238,700 | biometrics | 2026-07-25 07:52 | 350.39 d | 14.61 d |
| 238,698 | gov-id | 2026-07-25 04:04 | 360.60 d | 4.40 d |
| 238,698 | biometrics | 2026-07-25 04:15 | 360.88 d | 4.12 d |
| 238,695 | gov-id | 2026-07-25 03:58 | 339.21 d | 25.79 d |
| 238,000 | gov-id | 2026-06-21 01:23 | 363.97 d | 1.03 d |
| `0xA6b7471f…` | gov-id | 2026-07-24 09:32 | 355.14 d | 9.86 d |
| `0xA6b7471f…` | biometrics | 2026-07-24 09:35 | 362.72 d | 2.28 d |

Every one is under the 365-day ceiling, as the constraint requires. Most bounds land 4–29 days
before the mint, which against a 730-day half-life is a weight difference of a few percent — but
**two of thirteen are 187 and 257 days off**, and that is not an error. The holder chooses the
expiry, and the circuit's comments tell them to choose it randomly for anonymity, so a short
expiry is a privacy purchase and the slack it creates is theirs. It is also possible those two
credentials really were issued months before they were minted, in which case the bound is simply
right; nothing on chain distinguishes the two cases.

The worst case is bounded and it is bounded in the safe direction. A held credential's age can
never exceed one year, so its decay weight can never fall below 2^(−365/730) = 0.707 for gov-id
or 0.5 for biometrics — the floor is asserted as an invariant in the live suite. All of the slack
costs the subject weight and none of it can gain them any, which is the property that makes a
bound safe to use as a date. The live test therefore asserts the ceiling and the ordering
(`issuedAt ≤ mint`) and deliberately asserts *nothing* about tightness.

**Two facts the ontology did not record, both now in its notes.** A Holonym credential
**hard-expires within a year of the check behind it**: `getSBT` reverts the instant
`expiry < block.timestamp`, and `sbtOwners` shows the whole 2024–early-2025 cohort has lapsed.
So the 730-day half-life on `holonym-gov-id` only ever applies over the first year of a
credential's life, and the decay weight of a *held* credential can never fall below
2^(−365/730) = 0.707. That is the same shape as Human Passport's 90-day expiry against a
180-day half-life, and it is asserted as an invariant in the live suite.

---

## 5. Dating an SBT from state, which is what the tests use to check the bound

`sbtOwners[identifier].expiry` is written once per mint, and a re-mint can only push it later, so
`expiry(block) >= current expiry` is monotone and the first block satisfying it is the block the
current SBT was minted in — the same shape of search the Farcaster adapter runs on `idCounter`,
over the three keyless archive endpoints. ~21 calls when bracketed to the last month.

The probe does **not** do this: the bound in §4 is free and the search is not, and a credential
whose expiry is at most a year past its issuance does not need the mint block to be scored
honestly. The *live test* does it, because it is the only way to check the bound against
something the probe never consulted. It then closes the loop against a third source: the mint's
ERC-721 `Transfer(0x0 → holder)` must be in that exact block. State search, log index, and the
probe's arithmetic all have to agree.

The Hub is an ERC-721 with no enumeration and a private `_tokenIds` counter, so the number of
credentials it has ever issued is not a public getter — but `ownerOf(id)` reverts above the
counter, which is monotone, so a bisection answers it: **238,706 SBTs minted** as of block
154,692,312 (2026-07-25T12:43:21Z). That is the hard number
`billions-silk-unitap-sismo-intuition.md` §"Scoring-relevant facts" asked for, obtained without
the event index it proposed. It counts *mints*, not humans: re-verification mints a new token,
expired credentials are still counted, and among the twelve newest tokens one address holds three
consecutively and another holds two — so the distinct-holder count is materially lower than the
mint count and cannot be derived from state alone.
Token ids are also chronological, which is what lets the live tests sample current holders instead
of pinning an address that will expire within the year.

One sampled token id (230,000) belongs to a holder with **no** record under any of the six
circuits above. So the Hub serves at least one circuit that neither repository names, and the
five-credential picture is incomplete. It cannot affect a score — we read only two circuits, by
id — but it is a reminder that the credential list is Holonym's to extend.

---

## 6. What is deliberately not read

**The legacy v2 store.** `SybilResistance` at `0xdD748977…Fce31` still answers
`isUniqueForAction(address, actionId)`, and Holonym's API consults it *before* the Hub, so an
address could in principle be v2-only. We do not read it, for a scoring reason rather than a
technical one: it exposes a bool and nothing else — no expiry, no public values, no issuance
evidence of any kind — and an undatable credential on a `Decay` curve takes full weight, which is
the inflation direction. It also returned `false` for every V3 holder sampled and for both
Passport-stamped addresses in §7, so we could not find a positive to test against. A live test
asserts that a current V3 holder is still `false` in the v2 store; the day that changes, the v2
read is worth adding — with a state search to date it.

**Phone** (farmable), **clean-hands** (a sanctions screen, not personhood), and the **passport
circuits** (ICAO root, and the two repositories disagree about the circuit id — §2) are all left
out, each for its own reason.

**The REST API** is not on the critical path anywhere, by design (§1).

---

## 7. What this proves about the product

Iteration 3 read `0xA6b7471fe0338F8B45266734A1346E6f1D7267b1`'s Human Passport — 22.027 points —
and found it was a `HolonymGovIdProvider` stamp plus a `Biometrics` stamp and *nothing else*: an
aggregate made entirely of two credentials this ontology already prices. That was a claim about
Passport's stamp list.

Today the same address reads directly against Holonym's own contract, and both credentials are
there: gov-id expiring 2027-07-13, biometrics expiring 2027-07-24, both minted on 2026-07-24
three minutes apart, both under Holonym's issuer keys and the default action-id, both with their
nullifiers burned. `0x46760723cf94ebd77Adae95BE06fE455ccd0Df74`, the other Passport-stamped
address from that file, holds the gov-id credential too.

So the collapse is no longer inferred from a stamp name — it is the same credential observed from
two directions, and the arithmetic behaves the way the root model promises. Through `resolve()`
on 2026-07-25:

```
0xA6b7471f…67b1   score 3.6088   4,062 cents   3 independent roots
  holonym-gov-id       kyc-vendor:unattributed   2,968.85c   freshness 0.9896
  holonym-biometrics   kyc-vendor:facetec          993.59c   freshness 0.9936
  human-passport       behavioral:wallet-history    99.57c   freshness 0.9957
  caveats: independent-control-not-attested, aggregate-restates-other-credentials,
           issuance-date-derived-from-expiry
```

The passport still contributes a dollar of wallet history and not a cent of identity money, and
it still names the two adapters it is restating — which now hold evidence of their own, under
their own roots, priced by their own curves. Adding the source of an aggregate we already read
did not double-count anything; it moved the money to where the evidence actually is.
