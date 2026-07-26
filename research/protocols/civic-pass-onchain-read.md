# Civic Pass, read permissionlessly — an autopsy with a working probe

**Status:** implemented, `packages/sdk/src/adapters/civic.ts`, tests (offline and `LIVE=1`) in
`civic.test.ts`. Everything below was measured by me against public RPC on **2026-07-25**
unless a source and date say otherwise. This completes the two `UNVERIFIED` items the earlier
research left open (`passport-civic-fractal-zkme-galxe.md` §2: the deployed GatewayToken
addresses, and the EVM gatekeeper-network ids) — and confirms its "effectively dead" verdict
from chain state rather than from 404s.

---

## 1. Why implement an adapter for a retired product

Civic retired the personhood passes in mid-2025 — CAPTCHA on 2025-07-01, Uniqueness/Liveness
on 2025-07-31, dates hard-coded in Human Passport's own provider source — and the ontology
already carries `live: false` with a note naming the reason to keep the entry: a major
competitor still assigns points to Civic stamps for a product that no longer exists. The
adapter is that note made executable. Gateway tokens carry an `expiration` the contract
enforces, so the probe decides `held` from chain state, not from Civic's product page:

- **an expired token is `held: false`, with the expiry on record** — "your Civic pass lapsed
  2025-08-28" instead of a shrug, which is the honest answer and the useful one;
- if Civic ever resumed issuing under these networks, the probe would start returning
  `held: true` with no code change — the `live` flag in the ontology, not the adapter, is
  where the discontinuation is priced.

## 2. The contract surface, finally pinned

One `GatewayToken` ERC-3525 proxy, deployed **deterministically at the same address on every
chain**: `0xF65b6396dF6B7e2D8a6270E3AB6c7BB08BAEF22E` (source: the `deployments/` folder of
`identity-com/on-chain-identity-gateway`, confirmed live below). The ERC-3525 "slot" is the
gatekeeper network. `getNetwork(slot)` returns the *Solana* gatekeeper-network address as the
network's name — the EVM and Solana deployments share identity — and the values are identical
on every chain read, which the live suite re-asserts on two chains each run:

| Slot | Network name (on-chain) | Meaning | Evidence class |
|---|---|---|---|
| 4 | `ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6` | CAPTCHA | bot-resistance only |
| 6 | `bni1ewus6aMxTxBi5SAfzEmmXLf8KcVFRmTfproJuKw` | IDV | state-identity |
| **10** | `uniqobk8oGh4XBLMqM68K8M2zNu3CdYX7q5go7whQiv` | **UNIQUENESS** | biometric dedupe — **the credential** |
| 11 | `vaa1QRNEBb1G2XjPohqGWnPsvxWnwwXF67pdjrhDSwM` | LIVENESS | human present, no dedupe |

Slot 10 matches the known Solana UNIQUENESS network from Passport's source byte-for-byte. The
ontology entry is *uniqueness* (`kyc-vendor:facetec`), so only slot 10 can make `held: true`;
tokens in 4/6/11 are reported in `detail.tokens` as observations — three passes from one
vendor and one selfie session is the correlated-evidence trap Passport fell into, and it does
not get to recur here.

**Deployment survey** (head `eth_call`s, 2026-07-25):

| Chain | `totalSupply()` | Read by the adapter |
|---|---|---|
| Polygon | **689,898** | ✓ |
| Arbitrum | 115,810 | ✓ |
| Base | 76,884 | ✓ |
| Ethereum | 33,232 | ✓ |
| Optimism | 28,435 | ✓ |
| Avalanche C | 6,274 | – (0.66% of tokens) |
| Polygon zkEVM | 1,450 | – |
| Gnosis | 0 | – |
| Fantom, XDC | unmeasured — tested public RPCs down | – |

The five chains read cover ~99.3% of every gateway token observed. Solana (program
`gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs`) is a different runtime and out of scope for an
EVM adapter; it is the one place a still-valid uniqueness pass could theoretically hide from
this probe (§6).

**An ABI trap worth writing down:** the repo's current ABI JSON exposes
`getTokenIdsByOwnerAndNetwork(address,uint256)`, but that selector is **absent from the
deployed bytecode** — checked selector-by-selector against the implementation behind the
EIP-1967 proxy (`0xcd86…40f7` on Polygon). The deployed signature is
`getTokenIdsByOwnerAndNetwork(address owner, uint256 network, bool onlyActive)`. Code built
against the repo ABI reverts on every call; this cost an hour and is exactly the kind of
drift the "confirm against live state" house rule exists for.

## 3. The read

Discovery is owner-keyed state — no logs, no indexer:

1. Per chain, in parallel: `getTokenIdsByOwnerAndNetwork(subject, network, false)` for the
   four networks (the `false` matters: `true` filters expired tokens out, and the expired
   tokens are the story).
2. `getToken(tokenId)` → `(owner, state, identity, expiration, bitmask)` for each hit.
3. Pure rule (`interpretCivicToken`, every branch unit-tested): valid iff
   `state == ACTIVE(0)` and `expiration` unset or in the future. `FROZEN(1)`/`REVOKED(2)`
   invalid regardless of expiry; unknown states invalid, never coerced.
4. `held` requires a valid slot-10 token **and** the contract's own `verifyToken(subject, 10)`
   agreeing — a second opinion from the gate Civic's integrators actually called, so a
   misreading of the state machine cannot mint evidence the contract would refuse. The live
   suite asserts the pure rule and `verifyToken` return the same verdict on a real holder.

Measured cost: ~20 parallel `eth_call`s across five chains for a full negative (~2s), plus one
`getToken` per token found.

## 4. What the chain says in 2026: everything expired, nothing minting

Sampling the newest tokens on each chain (enumeration via `tokenByIndex`, walking back from
`totalSupply`):

- **Every personhood-network token sampled is expired.** The latest expiry found anywhere:
  **2025-10-27T12:01:40Z** — UNIQUENESS token 691,557 on Polygon, `state ACTIVE`, owner
  `0x508D…6E2A`. Ethereum's latest: 2025-10-18; Arbitrum's: 2025-10-22. The pattern (state
  still `ACTIVE`, expiry lapsed) says the protocol died by expiry, not revocation — nobody
  ran a shutdown, the passes just stopped being renewed, which squares with the 2025-07-31
  retirement plus a ~90-day validity tail.
- **Zero mints in the trailing 1M blocks** on Polygon, Arbitrum, Base and Optimism (recipient
  and tokenId-filtered `Transfer` scans, Tenderly gateways).
- `verifyToken(owner, network)` returns `false` for every sampled holder on every network —
  the contract itself already denies everyone.
- Non-personhood gatekeeper networks still exist and some do not expire (a slot-26 token on
  Polygon carries a 2123 expiry) — partner gating networks, nothing to do with personhood,
  invisible to the probe by construction.

So the expected steady-state result for every subject is `held: false` with
`reason: 'expired'` (holders) or `reason: 'no-uniqueness-token'` (everyone else), and that is
what the live suite asserts against a holder discovered from the registry at runtime. No
address is pinned: any holder's tokens are equally expired.

## 5. Dating

For a valid token, issuance is the mint `Transfer(0x0 → subject, tokenId)` log — `_tokenId`
is indexed, so the filter matches exactly one event. The scan runs newest-first in windows
sized to what each endpoint serves (measured: Tenderly gateways 1M-block windows on
Polygon/Arbitrum/Base/Optimism; Ethereum has no keyless wide-window endpoint and gets 10k
windows), with a call budget and the eas.ts honesty contract: budget exhausted →
`scanComplete: false` plus the blocks searched, never a fabricated date. A valid token cannot
be older than its own validity window, so the recency bias of a bounded scan matches where
the log must be. **Expired tokens are not dated** — `held: false` carries no `issuedAt`, and
crediting "held once, lapsed" is exactly the resurrection this adapter exists to refuse. The
path is dormant today (no valid tokens exist) but tested at the unit level and correct if
slot 10 ever mints again.

## 6. Endpoints

| Endpoint | Role | Measured (2026-07-25) |
|---|---|---|
| `polygon-bor-rpc.publicnode.com` | Polygon calls | `eth_call` OK; refuses keyless `eth_getLogs` |
| `arbitrum-one-rpc.publicnode.com` | Arbitrum calls | same shape |
| `mainnet.base.org` | Base calls | `eth_call` OK; logs ≤10k (unused) |
| `ethereum-rpc.publicnode.com` | Ethereum calls + logs | calls OK; logs refused keyless — Ethereum's date scan is the weakest link |
| `optimism-rpc.publicnode.com` | Optimism calls | `eth_call` OK |
| `{polygon,arbitrum,base,optimism}.gateway.tenderly.co` | date scans | 1M-block `eth_getLogs` windows, 90–280ms |

## 7. Proposed ontology changes

Flip `implemented`, point the source here, and extend the note with the measured death date.
Everything else — root (`kyc-vendor:facetec`, corrected 2026-07-25), `live: false`, costs,
curve — stands:

```json
{
  "id": "civic-pass",
  "name": "Civic Pass (uniqueness)",
  "evidenceClass": "Uniqueness",
  "trustRoot": "kyc-vendor:facetec",
  "forgeCostCents": 100000,
  "rentCostCents": 3000,
  "decayHalfLifeDays": 365,
  "live": false,
  "sourceURI": "research/protocols/civic-pass-onchain-read.md",
  "implemented": true,
  "notes": "Discontinued 2025-07-31. Root corrected 2026-07-25: FaceTec integrated directly, not Persona — the dedup table names Civic on the FaceTec (direct) row. Retained deliberately: a major competitor still assigns points to Civic stamps for a product that no longer exists, which is exactly the failure the live flag prevents. Now read on-chain from the GatewayToken proxy (0xF65b…F22E, same address on every chain; ERC-3525, gatekeeper network 10 = uniqueness): tokens carry first-class expiry, and the chain confirms the retirement — the latest uniqueness expiry anywhere is 2025-10-27, zero mints since, so every probe honestly answers held:false with the lapse date. An expired biometric dedupe proves a face check happened once, not that the subject is currently unique; the probe refuses to resurrect it, and would notice — without a code change — if Civic ever resumed issuing.",
  "ageCurve": "Decay"
}
```

## 8. Open, and deliberately not guessed

1. **Solana.** The UNIQUENESS network is natively a Solana gatekeeper network and the Solana
   program still exists. Whether any unexpired uniqueness PDA survives there was not checked —
   different runtime, and the EVM evidence (uniform ~90-day expiries, protocol-wide
   non-renewal since 2025-07) makes a surviving valid token unlikely anywhere. If one exists,
   this probe cannot see it.
2. **Avalanche / Polygon zkEVM / Fantom / XDC / Celo.** Same contract, same networks, ~0.7% of
   tokens, unread. Adding a chain is one config entry; the omission is a cost/coverage
   judgement, not a technical gap.
3. **The `identity` and `bitmask` fields.** `getToken` returns both; observed empty/zero on
   every sample. The bitmask feeds `FlagsStorage` (KYC flags in the v2 design); not decoded.
4. **Whether "held once, now expired" deserves any weight.** The earlier research suggested
   treating surviving slot-10 tokens as "weak historical evidence with a hard decay". The
   adapter deliberately does not: an expired token is `held: false` with the expiry in detail,
   and if the ontology ever wants to price credential *history*, that is a scoring-layer
   decision that should be taken looking at `detail.tokens`, not smuggled in by a probe
   calling a dead pass held.
5. **The IDV pass as a separate credential.** Slot 6 is state-identity under a different
   (unverified) document-check subcontractor — a distinct trust root from FaceTec uniqueness.
   All slot-6 tokens are equally expired, so the question is moot unless Civic revives; the
   probe already reports them in detail if it ever matters.
