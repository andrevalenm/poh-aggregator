# ZKPassport: no permissionless read exists — a documented refusal

**Status:** **not implementable as an adapter today**, and this file is the evidence. The
question an adapter must answer — *does this address hold a ZKPassport verification?* — has
no on-chain answer anyone can read. Everything below was measured by me against public RPC
and Sourcify on **2026-07-25** unless a source and date say otherwise. Protocol background
(circuits, nullifier derivation, the admin-Safe finding) is in `zk-passport-and-eid.md`;
this file is only about why there is nothing to probe.

---

## 1. What the on-chain surface actually is

The stable entrypoint `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` (same vanity address on
Ethereum mainnet and Base) is **`ZKPassportRootVerifier`** — Sourcify creation+runtime match
on Base (chain 8453), same bytecode role on Ethereum. Its verification interface, from the
matched ABI:

```solidity
function verify(ProofVerificationParams calldata params)
    external view returns (bool verified, bytes32 uniqueIdentifier, address helper);
```

**`verify` is a `view` function.** That single keyword is the whole finding:

- it **writes nothing** — no registry of verified addresses, no nullifier-spent mapping, no
  per-user state of any kind accumulates in the verifier;
- it **emits nothing** — a successful verification leaves no log;
- verification "happens" only inside whatever transaction (or off-chain `eth_call`) an
  integrator makes, and any record of the outcome lives in *that integrator's* storage,
  under whatever schema it chose, or nowhere at all.

The prior research pass (`zk-passport-and-eid.md` §5.1, 2026-07-24) described `verify()` as
`external returns` from the docs; the deployed reality is stricter — stateless by
construction, not merely stateless in practice.

## 2. The evidence: a full-history log census

Deployment blocks were binary-searched via `eth_getCode`, then every log the verifier ever
emitted was fetched (1M-block windows, `mainnet.gateway.tenderly.co` /
`base.gateway.tenderly.co`):

| Chain | Deployed | Logs ever emitted | Breakdown |
|---|---|---|---|
| Ethereum (1) | block 23,761,984 = 2025-11-09T13:25:11Z | **19** | `SubVerifierAdded` ×8, `HelperAdded` ×8, `RootVerifierDeployed` ×1, `SubVerifierUpdated` ×1, `HelperUpdated` ×1 |
| Base (8453) | block 37,997,419 = 2025-11-10T14:16:25Z | **19** | identical mix (mirrored deployment scripts) |

Every topic0 was resolved against the matched ABI by recomputing the keccak of each event
signature — all 38 logs across both chains are **admin/config events**. In ~8.5 months of
existence, across both chains, the canonical verifier has emitted **zero
verification-shaped events**, because it has none to emit.

So even the discovery half of a probe is impossible: there is no event stream in which to
find "addresses that ever verified", let alone an address-keyed view to `eth_call`.

## 3. Why the nullifier does not rescue this

Suppose an integrator contract *does* store results (calling `verify()` in a transaction and
persisting `uniqueIdentifier`). What it holds is the **scoped nullifier** —
`Poseidon2([private_nullifier, service_scope, service_subscope])`, source-verified in
`zk-passport-and-eid.md` §4/§4b. It is:

- **app-scoped by construction**: the same passport yields unrelated identifiers for every
  `service_scope`, so nothing observed in one integrator links to anything anywhere else;
- **never published unscoped**: unlike Self, ZKPassport never emits a global per-document
  value (that is its privacy *strength*, and precisely what makes it unreadable to us);
- **not address-derived**: binding an identifier to a wallet happens, if at all, through the
  optional `bound_data` committing to a sender address — a per-integrator choice invisible
  from outside.

Per house rule, on-chain state keyed by an unlinkable nullifier is a refusal, and here even
that state does not exist at the canonical layer.

## 4. What was tried, exhaustively

1. `eth_getCode` + binary search on `0x1D000001…C0D8`, Ethereum and Base — bytecode present,
   deployment dated (§2).
2. Full-history `eth_getLogs` on the verifier, both chains, no topic filter — 19 logs each,
   all identified (§2).
3. Sourcify ABI (Base match): full function list — the only views are admin/config
   (`admin`, `guardian`, `config(bytes32)`, `getSubVerifier`, `getHelper`, `paused`,
   `rootRegistry`, counters). **No mapping keyed by address or by nullifier exists.**
4. Certificate registry `0x1D000002…8B70`: registry-root storage only, no user state
   (prior pass, 2026-07-24, including the threshold-1 admin Safe finding).
5. Search for a canonical registry-style integrator (an SBT, an airdrop gate, a "verified
   humans" registry) on Ethereum or Base: none found; ZKPassport ships no such contract in
   `zkpassport/zkpassport-packages`, and its docs' on-chain example is "call `verify()` from
   your own contract" — every integrator is its own island.

## 5. What would change the verdict

Any one of these makes an adapter worth revisiting, and each is cheap to detect:

1. **A verification event or nullifier-spent mapping on the root verifier** after an
   upgrade — detectable by re-running the census in §2 (one call per chain per month is
   plenty at current volume).
2. **A canonical public registry integrator** (a ZKPassport-operated SBT, or a third-party
   one with real volume, Sourcify-matched source, and writes gated on `verify()`) — the Self
   adapter (`self-onchain-read.md`) is the template for reading exactly that shape.
3. **A major consumer with address-keyed state** — e.g. if an airdrop or exchange publishes
   `verifiedAt(address)` backed by `verify()`. Same template.

Until then: ZKPassport remains, for this aggregator, a *proof toolkit other systems consume*,
not a credential that can be observed. That is not a criticism — never publishing an
unscoped identifier is the best privacy posture in the family — but privacy from everyone
includes privacy from us.

## 6. Proposed ontology entry

Unchanged except `sourceURI` and `notes` (still `implemented: false` — the point of this
file is that flipping it is impossible today):

```json
{
  "id": "zkpassport",
  "name": "ZKPassport",
  "evidenceClass": "StateIdentity",
  "trustRoot": "state-document:icao-9303",
  "forgeCostCents": 150000,
  "rentCostCents": 2000,
  "decayHalfLifeDays": 3650,
  "live": true,
  "sourceURI": "research/protocols/zkpassport-onchain-read.md",
  "implemented": false,
  "notes": "Not implementable: the canonical ZKPassportRootVerifier (same address on Ethereum and Base) exposes verify() as a stateless view — it stores nothing, emits nothing, and has emitted only 19 admin logs ever per chain since its 2025-11 deployment (measured 2026-07-25). Results live, if anywhere, in per-integrator contracts under app-scoped nullifiers that are never published unscoped, so no permissionless address-keyed read exists. Good privacy, unreadable evidence. Revisit if a verification event or a canonical registry integrator appears; the Self adapter is the template for reading one.",
  "ageCurve": "Decay"
}
```

## 7. Open, and deliberately not guessed

1. **Whether any Base/Ethereum integrator with meaningful volume stores results.** Finding
   one requires tracing *callers* of a view function, which leaves no chain trace —
   only bytecode search or off-chain knowledge can surface candidates. None known today.
2. **Whether the salted (OPRF) mode's identifier could ever anchor a registry.** If
   ZKPassport itself ran a registry under one shared scope, its own docs' unlinkability
   guarantees would weaken; there is no sign they intend to.
3. **Volume through the cloud "Verifier API"** (`zkpassport/zkpassport-proof-verifier`) —
   off-chain verifications are invisible by definition, so the 38 admin logs put no bound at
   all on ZKPassport's actual usage. Absence of on-chain evidence here is absence of the
   *rail*, not of the product.
