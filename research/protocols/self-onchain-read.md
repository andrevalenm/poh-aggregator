# Self Protocol, read permissionlessly from Celo

**Status:** implemented, `packages/sdk/src/adapters/self.ts`, tests (offline and `LIVE=1`) in
`self.test.ts`. Everything below was measured by me against public RPC and Sourcify on
**2026-07-25** unless a source and date say otherwise. Protocol background — the ICAO 9303
mechanism, nullifier derivations, the Enterprise-pivot warning — lives in
`zk-passport-and-eid.md` and is not repeated here; this file is about the *read*.

---

## 1. What exists on chain, and what deliberately does not

Self's on-chain surface on Celo mainnet splits into three layers, and only one of them knows
about addresses:

| Layer | Keyed by | Address-linkable? |
|---|---|---|
| Identity registries (per attestation type, merkle trees of commitments) | per-document nullifier + user secret | **No** — by design |
| `IdentityVerificationHubV2` `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF` (ERC-1967 proxy) | — (stateless router for disclosure proofs) | **Yes, via its event** |
| Integrator contracts (`SelfVerificationRoot` children) | whatever the integrator stores | **Yes, for some** |

**Registration** writes a commitment into a registry tree and publishes a global per-document
nullifier (`zk-passport-and-eid.md` §4b) — nothing there names an address, and per house rule
that layer alone would have been a refusal.

**Disclosure** is where addresses appear. An integrator contract calls
`verifySelfProof(proofPayload, userContextData)` on the hub; the hub verifies the Groth16
proof against the registry root and calls back `onVerificationSuccess(output, userData)` on
the caller, where `output.userIdentifier` is — for on-chain integrations — the user's wallet
address. The hub emits, on every success:

```
DisclosureVerified(address indexed requestor, uint8 indexed contractVersion,
                   bytes32 indexed attestationId, uint256 destChainId, bytes32 configId,
                   uint256 userIdentifier, bytes output, bytes userDataToPass)
topic0 0x14b70ae0a2b984327e9bcd235341661b8f8e6f4bb6d93a2c09707ca9d890cba2
```

The recipient (`userIdentifier`) is **not indexed** — that single ABI choice shapes the whole
adapter. The requestor (integrator contract) is.

The hub proxy was deployed at block **38,942,111 (2025-06-25)** (binary-searched
`eth_getCode`). The V1 hub at `0x77117D60eaB7C044e785D68edB6C7E0e134970Ea` still holds its
129-byte proxy but emitted **zero logs over the 35M blocks preceding head 73,103,787** — it
is dead weight, and the adapter ignores it. The hub *implementation*
(`0xEA0f37…8E6`) is **not** source-verified on Sourcify; the event layout above was taken
from `IdentityVerificationHubImplV2.sol` in `selfxyz/self` and then confirmed against live
logs, and the derived topic0 is pinned to the observed literal in the unit suite.

## 2. Census: every disclosure the hub has ever verified

One full-history scan (deploy block → head 73,104,000, 35 × 1M-block topic-filtered
`eth_getLogs` on `celo.gateway.tenderly.co`, ~0.3s each):

- **6,212 `DisclosureVerified` events, total, ever.** First on 2025-09-23T14:21:18Z (block
  46,736,520, tx `0x53030785…5988d`) — the hub sat idle for its first three months.
- By attestation type (`AttestationId.sol`, selfxyz/self, read 2026-07-25):
  **e-passport (1): 3,032 · EU ID card (2): 769 · Aadhaar (3): 1,636 · KYC (4): 775.**
  Only types 1 and 2 are ICAO 9303 documents — see §5.
- `userIdentifier` shapes: **3,193 address-shaped** (160-bit range), 2,859 uuid-shaped
  (off-chain sessions routed through the hub), 160 zero. `destChainId` is 42220 on all 6,212.
- ~15 distinct requestor contracts. The ones that matter:

| Requestor | Contract (Sourcify creation+runtime match) | Events | Attestation mix (1/2/3/4) | Address-keyed view |
|---|---|---|---|---|
| `0x829D…c1f0` | MinimalDisclosure | 2,814 | 953/245/983/633 | **none** (nullifier-keyed) |
| `0xF5A3…8B91` | SelfSBTV2 | 734 | 543/112/9/70 | `getTokenIdByAddress` |
| `0xa699…9e8f` | MavuVerifier | 601 | 554/25/22/0 | none |
| `0x2067…a56b` | EspressoSelfSBT | 401 | 209/55/137/0 | `getTokenIdByAddress` |
| `0x063e…e8cc` | L2SelfRegistrar | 354 | 196/40/114/4 | none |
| `0x5e05…11a8` | ProofOfHuman | 287 | 84/15/188/0 | `isVerified(address)` |
| `0xac3d…5944` | (unverified source) | 218 | 136/33/9/40 | unknown |
| `0x5aca…961a` | OpenbandsV2NationalityRegistry | 74 | 27/37/0/10 | `isUserVerified` + record |
| `0x6234…b2ff` | MerklVerifier | 67 | 53/5/5/4 | `isVerified(bytes32,address)` |
| `0xb69f…b97a` | SelfSBTV2 (2nd instance) | 48 | 43/3/0/2 | `getTokenIdByAddress` |
| `0xf094…7d9c` | SelfVerifierV2 | 44 | 39/1/4/0 | `isVerified` + `verifiedAt` |

**6,212 is a small population.** Self's "seven million activated users" claim
(`zk-passport-and-eid.md`, self-reported, undefined unit) is off-chain: the permissionlessly
observable footprint of the whole protocol on its home chain is six thousand disclosures.

## 3. The read: registries first, the hub's own event stream second

1. **Five pinned registries, by `eth_call`** — the Sourcify-verified integrators above with
   address-keyed state (both SelfSBTV2 instances, EspressoSelfSBT, SelfVerifierV2,
   ProofOfHuman). Cheap (≤10 calls, ~1.4s measured end-to-end warm), complete history for
   their own users. What makes them trustworthy rather than "some contract that says so":
   - the callback is **hub-gated** — `SelfVerificationRoot.onVerificationSuccess` opens with
     `if (msg.sender != address(_identityVerificationHubV2)) revert UnauthorizedCaller();`
     (verified in the matched source of every pinned registry), and the ABI shows **no other
     write path** to verification state: no owner-mint, no signature shortcut. State there
     implies a proof passed the canonical hub.
   - the SBT mint hook additionally requires an **EIP-712 signature from the receiver**
     (`_verifySignature(receiver, userData)`, SelfSBTV2 source), so unlike a Lens account
     this credential cannot be planted on an address that never consented.
   - MerklVerifier is *not* pinned despite its `isVerified(bytes32,address)`: the `bytes32`
     is a campaign key with no enumerable domain, so a probe cannot ask it a complete
     question. Its users are covered by the scan path.
2. **Fallback: bounded backward scan of `DisclosureVerified`** with client-side filtering on
   `userIdentifier == subject` (it is un-indexed; there is no server-side filter to have).
   Default bound 8M blocks (~93 days of Celo's 1s blocks) within a 12-call budget — Tenderly's
   1M-block windows make that ~139 days in practice. A miss reports
   `scannedFromBlock`/`scannedToBlock`/`scanComplete` rather than asserting an absence over
   history it never read; a full-history scan is 35 windows and is left to callers who raise
   `logScanBlocks`/`maxLogCalls` deliberately.

Endpoints, measured 2026-07-25: `forno.celo.org` caps `eth_getLogs` at 5,000 blocks;
`celo.drpc.org` at 10,000 ("free plan"); `celo.gateway.tenderly.co` served 1M-block
topic-filtered windows in ~0.3s. `celo-rpc.publicnode.com` refuses logs without a personal
token, `1rpc.io/celo` caps at 50 blocks, `rpc.ankr.com/celo` refuses outright — all excluded.
`eth_call` order is forno → tenderly → drpc; scan order is widest-window-first.

## 4. Dating: every date is a re-attestation

- **SBT registries:** `issuedAt = getTokenExpiry(tokenId) − getValidityPeriod()` — exactly
  the block time of the last successful disclosure, because the mint/renew hook sets
  `expiry = block.timestamp + validityPeriod` (SelfSBTV2 source). Renewals overwrite it.
- **SelfVerifierV2:** `verifiedAt(address)`, overwritten per proof.
- **ProofOfHuman:** boolean only — a positive with no date, reported as `dateFrom: 'none'`
  rather than decorated with one.
- **Scan hits:** the newest matching event's block timestamp; older siblings may exist
  outside the window.

All of these date the *latest* proof, not the enrolment, so every dated result carries
`date-from-latest-reattestation` — under the adapter's `Decay` curve a ceiling on age, which
errs against the credential.

Worked example, verified live 2026-07-25 (headBlock 73,104,776): subject
`0x9cf52513ffb71854a60c48807d4bb1e39bbf6323` → SelfSBTV2 token 348, expiry 1,800,535,584,
validity 15,552,000 (180 days) → `issuedAt` 1,784,983,584 = 2026-07-25T12:46:24Z, matching
the `DisclosureVerified` in tx `0xac44608a…6f20` (block 73,082,826) that minted it. Two more
live positives across the other registry kinds: `0xa586…1ca2` via EspressoSelfSBT
(issuedAt 1,771,174,987, also `held` on ProofOfHuman — one person, two integrators, one
credential) and `0xd634…ac8c` via SelfVerifierV2 (verifiedAt 1,765,060,898 =
2025-12-06).

## 5. The document-type caveat — this adapter is not purely ICAO

The ontology prices `self-protocol` under `state-document:icao-9303`, and 39% of all hub
disclosures are **not** ICAO documents: Aadhaar (26%) is a QR-code credential with a
low-entropy nullifier and no chip, and KYC (12%) is a vendor attestation
(`zk-passport-and-eid.md` §5.2, §5.4). The hub-scan path sees the document type (it is the
indexed `attestationId` topic) and reports it in `detail.documentType`; the registry path
**cannot** — an SBT does not record which document minted it, so a registry positive is
"state document, type unknown", with the requestor's observed mix (§2 table) as the prior.
For SelfSBTV2 that prior is 89% ICAO; for ProofOfHuman it is 34%. The honest treatment is a
notes-level discount on the root's figures rather than a claim this probe cannot back; a
future refinement could correlate the SBT mint transaction with its `DisclosureVerified`
event to recover the type at one extra receipt read.

## 6. Centralization and durability caveats

- **The hub is an upgradeable proxy with an unverified implementation.** An upgrade can
  change the event layout under us; the live suite's topic canary
  (derived-equals-observed, re-checked against real logs) fails loudly if it does.
- **The registries are integrator property.** Owners can `setScope`, `setValidityPeriod`,
  `setConfigId` — none can fabricate a verification, but any could be abandoned; the live
  suite probes each registry individually so "registry went away" is distinguishable from
  "subject not verified". The pinned set is a snapshot of 2026-07-25's landscape and will
  need re-surveying (one census query) as integrations churn.
- **The wide-window scan leans on one vendor's free tier** (Tenderly). The probe still
  *works* through forno/drpc at 5–10k blocks per call, but the effective scan depth drops
  from ~139 days to ~1–2 days within the same call budget. Registry reads — the primary
  path — have three independent endpoints.
- **Self Pass is the legacy branch of Self's own roadmap** (`zk-passport-and-eid.md`:
  Enterprise is vendor-verified webhooks). The on-chain disclosure volume above is real but
  modest, and the strategic direction points off-chain. This read could be reading a
  shrinking surface.

## 7. Forge and rent, honestly

No new *priced* evidence found this pass. The ontology's `forgeCostCents: 150000` ($1,500)
and `rentCostCents: 2000` ($20) remain judgements from `zk-passport-and-eid.md` §9: the
binding constraint for a farm is acquiring distinct chip datasets (passive authentication
only — a chip dump verifies as well as the chip), and renting is bounded by "ask a
document-holder to run the app once". Two observations from this pass that bear on the
figures without repricing them: (a) the Aadhaar/KYC admixture (§5) means the *observed*
credential population is cheaper to join than the pure-ICAO figure implies — an e-Aadhaar
PDF is routine paperwork in circulation, and Self's KYC attestation inherits whatever the
cheapest accepted KYC vendor charges; (b) the EIP-712 receiver-signature in the SBT path
prices *renting onto a specific address* at "holder runs one wallet signature", i.e. no
friction premium over the $20 judgement. Neither moves an order of magnitude.

## 8. Proposed ontology entry

`trustRoot` unchanged (`state-document:icao-9303` — correlated with `zkpassport` and World's
document tier by construction; saturation, not dedup). Changes: `implemented`, `sourceURI`,
`notes`.

```json
{
  "id": "self-protocol",
  "name": "Self Protocol",
  "evidenceClass": "StateIdentity",
  "trustRoot": "state-document:icao-9303",
  "forgeCostCents": 150000,
  "rentCostCents": 2000,
  "decayHalfLifeDays": 3650,
  "live": true,
  "sourceURI": "research/protocols/self-onchain-read.md",
  "implemented": true,
  "notes": "Read from Celo: five Sourcify-verified integrator registries by eth_call (hub-gated callbacks, no non-proof write path, EIP-712 receiver consent so it cannot be planted), then a bounded client-filtered scan of the hub's DisclosureVerified events, whose recipient is un-indexed. All dates are latest-re-attestation ceilings. Caveats that discount the root's figures: 39% of all 6,212 hub disclosures ever (measured 2026-07-25) are Aadhaar or KYC attestations, not ICAO documents, and the registry path cannot tell which document type minted a positive; the hub is an upgradeable proxy with an unverified implementation; and the global per-document nullifier still means one chip can also feed ZKPassport and World — saturate, never sum. Publishes a global unscoped per-document nullifier on-chain.",
  "ageCurve": "Decay"
}
```

## 9. Open, and deliberately not guessed

1. **Recovering the document type on the registry path.** The SBT mint tx contains the
   `DisclosureVerified` event; one `eth_getTransactionReceipt` per positive would upgrade
   "type unknown" to the exact attestation id. Needs the mint tx hash, which needs one
   contract-scoped log query — bounded, just not free, and not built yet.
2. **The unverified requestor at `0xac3d…5944`** (218 events, 62% ICAO mix). No source, no
   ABI, so no read — its users are scan-path only.
3. **What the SBT configs actually require.** `verificationConfigId`
   `0x32332b93…483a` governs olderThan/OFAC/excluded-countries for SelfSBTV2; the hub's
   config store is readable but I did not decode it. Affects what a positive *proves* beyond
   "document exists".
4. **Whether Self's points/airdrop programme lands on-chain.** If a claim contract with
   address-keyed state appears, it would likely dwarf every registry above and should be
   pinned in `SELF_REGISTRIES` within a day of existing.
5. **Cross-chain userIdentifiers.** Every event so far says `destChainId` 42220, but
   EspressoSelfSBT's own event schema carries both a `celoAddress` and an `ethereumAddress` —
   if integrators start binding foreign-chain addresses, the subject match needs to widen.
