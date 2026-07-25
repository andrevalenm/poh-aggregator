# Farcaster, read permissionlessly — and dated by a registry that stores no dates

**Status:** implemented, `packages/sdk/src/adapters/farcaster.ts`, live tests in
`farcaster.live.test.ts`. Everything below was measured by me against public RPC on
**2026-07-25**; where a number restates the earlier landscape work it is marked as such and was
re-read rather than copied.

The pricing and the trust-root argument live in `research/landscape/social-and-zktls-signals.md`
§B.2 and are unchanged — that file is still the ontology's `sourceURI`. This file is about the
*read*: what is on chain, what is not, and how a fid gets a date.

---

## 1. What we read, and what it is worth

`IdRegistry.idOf(address) -> uint256` on OP Mainnet. Non-zero means the address custodies a
Farcaster id. That is **account ownership, never personhood**, and the ontology prices it there:

| Contract | Chain | Address | Call | Measured 2026-07-25 |
|---|---|---|---|---|
| IdRegistry | OP Mainnet | `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` | `idCounter()` | **3,343,631** |
| IdRegistry | OP Mainnet | — | `VERSION()` | **"2023.11.15"** |
| IdGateway | OP Mainnet | `0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69` | `price()` | 107,599,771,888,484 wei = **0.00010760 ETH** |
| StorageRegistry | OP Mainnet | `0x00000000fcCe7f938e7aE6D3c335bD6a1a7c593D` | `usdUnitPrice()` | 20,000,000 @ 8dp = **$0.20 / unit / yr** |
| TierRegistry | Base | `0x00000000fc84484d585C3cF48d213424DFDE43FD` | `tierInfo(1)` | minDays 30, maxDays 365, vault `0x36b3…9790`, token `0x8335…2913` (USDC), **328,767 @ 6dp/day = $119.9999/yr**, active |

So a fid costs an adversary roughly **$0.44 one-off plus $0.20 a year** — below a fresh Reddit
account. The ontology entry keeps `forgeCostCents: 12000` (Farcaster Pro) and
`rentCostCents: 20`, and scoring takes `min(forge, rent)`, so **20 cents is what binds** and the
Pro figure never enters an arithmetic today. See §7 for why that forge figure is worth a second
look, and `MORNING.md`.

At 20 cents on a `Ramp` with a 730-day half-life, a fid clears the 10-cent negligible-cost floor
only once it is **older than 730 days**. That is not a coincidence tuned after the fact — it is
the reason the entry is on a Ramp at all. Between 2025-07 and 2026-04 the registry tripled,
adding 2.18 M ids at up to ~17,000/day, then collapsed to ~164/day when the incentive behind them
stopped (curve in `social-and-zktls-signals.md` §B.2). Roughly two thirds of every fid in
existence was minted inside that window, and this adapter prices all of them at nothing.

Measured end to end through `resolve()` on 2026-07-25: fid 5, still held by the address that
imported it, contributes **12.19 cents** (freshness 0.610, one independent root). Fid 1, bought in
January 2026, contributes **3.07 cents** and **no** independent root. Same credential, same
protocol, four times the weight for the one that was not for sale.

---

## 2. The registry stores no dates, and the logs are out of reach

`IdRegistry` holds `idOf`, `custodyOf`, `recoveryOf` and `idCounter`. There is no registration
timestamp anywhere in its state.

The obvious substitute is the `Register(address indexed to, uint256 indexed id, address recovery)`
event — topic0 `0xf2e19a901b0748d8b08e428d0468896a039ac751ec4fec49b44b7b9c28097e45`. It is not
available to us:

| Query | `mainnet.optimism.io` |
|---|---|
| `eth_getLogs` full range, filtered by fid topic | `-32062 Block range is too large` |
| `eth_getLogs` 50,000-block window | `Block range is too large` |
| `eth_getLogs` 10,000-block window | `backend response too large` |
| `eth_getLogs` 1,000-block window | works (5 logs in the sampled window) |

A ~1,000-block ceiling over a 43-million-block history is 43,000 requests per lookup. Indexing
those logs ourselves, or renting someone who has, would put exactly the kind of dependency on the
critical path that `packages/sdk/src/adapters/index.ts` exists to refuse.

---

## 3. So the counter dates the fid

`idCounter()` only ever increases, and `register()` assigns `id = ++idCounter` in the same
transaction that writes custody. Therefore:

> the first block at which `idCounter() >= fid` is the block that fid was created in.

That is a monotone predicate over historical state, and archive `eth_call` at a past block is a
plain permissionless read. The probe searches it with an interpolation/bisection hybrid seeded
from a measured ladder of `(block, counter)` landmarks, caching every sample so later lookups
start from a tighter bracket. Typical cost is 15–30 `eth_call`s and 1.5–3 s cold; the imported
cohort costs 6–8 calls because the landmarks bracket it exactly.

**The search verifies its own answer.** Before returning block `B` it reads `counter(B-1)` and
`counter(B)` and requires `counter(B-1) < fid <= counter(B)`. A stale landmark, or an endpoint
that answered from the wrong state, therefore cannot produce a plausible-but-early date — only an
error. On a Ramp an early date is free weight, so this check is the one that matters.

### Confirmed against a second, independent path

For post-import fids the derived block is checked against the log index, which the probe never
touches. On 2026-07-25:

| fid | derived block | `Register` logs in that block, filtered by fid | `to` in the log | `custodyOf(fid)` at that block |
|---|---|---|---|---|
| 3,343,000 | 154,504,505 | 1 | `0x4FB3…07a0` | `0x4FB3…07a0` |
| 3,000,000 | 148,976,809 | 1 | `0xB415…62ec` | `0xB415…62ec` |
| 200,000 | 113,232,500 | 1 | `0xa18B…7938` | `0xa18B…7938` |

`farcaster.live.test.ts` re-derives this every run, on a fid sampled from head rather than from
this table, and additionally requires **zero** `Register` logs for that fid in the preceding 1,000
blocks — which is what makes the block the *first* one where the counter reached the fid, rather
than merely one where it had.

---

## 4. The import cliff: 193,791 ids that are older than their date

`idCounter` is 0 from the registry's deployment at block **111,816,351** (2023-11-06T00:44:39Z;
no code at 111,816,350, code at 111,816,351, agreed by two independent endpoints) until block
**111,904,738** (2023-11-08T01:50:53Z), where it becomes **193,791**.

That block is not 193,791 registrations. It contains six transactions and 713,791 gas, and
exactly one registry event:

```
topic0 0x562044dce594b5c0ac495e6cf3717dbef4dcc96bf978ff452457bfccd68a4eed
       = SetIdCounter(uint256 oldCounter, uint256 newCounter)
data   old = 0, new = 193791
tx     0x84876178624570e79625838ae3fb23525ae864afd786d7c53c610cf1c455dfb3
from   0x2d93c2f74b2c4697f9ea85d0450148aa45d4d5a2  (selector 0xa5ed6a6a)
```

The custody rows were written *before* it: `custodyOf(1)` already returns
`0x8773442740C17C9d0F0B87022c722F9a136206eD` at block 111,904,736, while `idCounter` there is
still 0. This deployment imported its predecessor's registry over a run of blocks and then set
the counter administratively in one transaction.

Consequences the probe acts on:

- **Every fid ≤ 193,791 dates to 2023-11-08 by this method, and is in truth older.** The
  discriminator needs no table: the counter immediately before the creating block is zero. The
  date is kept, because on a Ramp a date that is too late understates age — a weight floor, never
  an inflation — and the result carries `date-from-registry-import`, surfaced as the
  `credential-imported-from-predecessor-registry` caveat.
- **Dating that cohort exactly would need the predecessor registry**, and we have not established
  its address from a source we have actually read. Recording it from memory is precisely the
  failure mode this repo has been burned by, so it stays open (§7).

---

## 5. Fids are transferable, so we date custody, not the fid

`IdRegistry.transfer` moves a fid to a new address, and low fids are a traded asset. Measured:

| fid | registered | original custody | custody 2026-07-25 | acquired |
|---|---|---|---|---|
| 1 | import, 2023-11-08 | `0x8773442740C17C9d0F0B87022c722F9a136206eD` | `0x7071CfBA18280FD0bC1142D98f8e67fb094d9544` | block 147,097,388, **2026-01-30T17:19:13Z** |
| 200,000 | 2023-12-08 | `0xa18B6b43D300c89d8C4993Aec8519c4d6a077938` | `0xe7dD613970eeaeF416a946d110d327614694AD98` | block 126,803,669, **2024-10-17T23:01:55Z** |

Crediting a bought fid with the registry's own age would sell ramp weight at OTC prices, so what
the probe dates is **this address's custody**: `custodyOf(fid)` at the creating block names the
original holder, and when that is not the subject the acquisition block is found by searching
custody between the two. `issuedAt` is the acquisition; the fid's registration stays in `detail`;
the result carries `credential-transferred-since-issuance` → the `credential-changed-hands`
caveat.

**The honest limit.** `custodyOf` is not monotone — a fid can be transferred away and back — so a
search returns *an* acquisition, not provably the latest one, and landing on an earlier stint
would overstate tenure. After the search the probe samples six blocks between the candidate and
head; any block where the subject does not hold the fid proves a later acquisition and restarts
the search above it. That reduces the error, does not eliminate it, and the caveat says so
rather than implying a proof we do not have.

---

## 6. Farcaster Pro is not readable, and that is the finding

Pro at $120/yr is the only Farcaster signal with a real recurring price — a 10,000-account farm
would cost $1.2 M a year, which is an actual deterrent — and it is exactly the signal we cannot
have:

- **`TierRegistry` stores tier configuration, not subscriptions.** Scanning its deployed bytecode
  for `PUSH4` selectors turns up 41 candidates, including `tierInfo(uint32)` `0xa267c2c4`,
  `nextTierId()`, `owner()`, `paused()` — and **no fid-keyed getter of any kind**. A subject's Pro
  expiry is computed off chain from `PurchasedTier` events.
- **Those events are not queryable without a key.** Full-history `eth_getLogs` against the
  TierRegistry fails on `base-rpc.publicnode.com`, `mainnet.base.org` and `base.llamarpc.com`.

So Pro stays out of the ontology entirely rather than entering it as a number we cannot check.
It would need a log index — which is a legitimate future subgraph, and a small one.

---

## 7. Endpoints, and what is still open

Keyless OP Mainnet endpoints, checked 2026-07-25 by asking each for `idCounter()` at blocks
112,000,000 and 130,000,000 and comparing against each other:

| Endpoint | Archive | Used |
|---|---|---|
| `mainnet.optimism.io` | yes | yes |
| `optimism.drpc.org` | yes | yes |
| `gateway.tenderly.co/public/optimism` | yes | yes |
| `optimism.api.onfinality.io/public` | yes | no — rate-limits within a handful of requests |
| `optimism.gateway.tenderly.co` | partial — pruned past ~130 M | no |
| `optimism-rpc.publicnode.com` | no — "archive requests require a personal token" | no |
| `1rpc.io/op`, `op-pokt.nodies.app` | no — "state at block … is pruned" | no |

Three is not generosity, it is necessity: a search is a couple of dozen historical calls and every
one of these endpoints will eventually answer "your IP has exceeded its requests per second
capacity". The probe rotates across them and retries the whole set twice before giving up, and a
total failure surfaces as an `error` — never as "this address has no account".

Because archive endpoints are the scarce resource, Human Passport's Optimism read was moved off
`mainnet.optimism.io` to `optimism-rpc.publicnode.com` in the same change: Passport only ever
reads at head, so it has no claim on archive quota. Verified to return the same resolver,
`maxScoreAge` and `threshold`.

**Open, and deliberately not guessed:**

1. **The predecessor registry's address.** Without it the 193,791 imported fids — the oldest and,
   on a Ramp, the most valuable cohort in the registry — cannot be dated better than 2023-11-08.
   The bulk-registration calldata carries no pointer to it and neither does `SetIdCounter`.
2. **How many Pro subscribers there are.** Still the single most valuable thing to go measure
   about Farcaster, and still blocked on a Base log index.
3. **The OTC price of a low fid.** Fid 1 changed hands on 2026-01-30 and fid 200,000 in
   2024-10-17; what they sold for would price the aged-account market directly instead of by
   analogy to X accounts. `UNVERIFIED` in the landscape file and still unverified here.
4. **The forge figure.** `forgeCostCents: 12000` is the Pro subscription price attached to an
   adapter that does not read Pro; forging a plain fid costs the $0.44 + $0.20/yr measured in §1.
   Nothing turns on it — `min(forge, rent)` takes the 20 — but it is a published weight that says
   something untrue about the world. Left alone rather than silently rewritten, per the precedent
   set for the KYC forge figure; noted in `MORNING.md`.
