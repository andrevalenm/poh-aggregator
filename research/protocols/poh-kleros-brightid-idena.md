# Social / game-theoretic personhood protocols: Proof of Humanity, Kleros, BrightID, Idena

> STATUS: in progress — research date 2026-07-24

Scope: the "veteran" cohort of personhood protocols whose trust root is **social graph + human
adjudication + synchronized ceremony**, i.e. explicitly *not* biometrics and *not* government
documents. Covered here: Proof of Humanity v1/v2 (+ Kleros arbitration, Democracy Earth fork,
UBI token), BrightID, Idena.

---

# Proof of Humanity (v1 / v2)

**One-liner:** _TBD_
**Category:** social-trust + liveness (human video review, vouching graph)
**Chains:** Ethereum mainnet (v1 legacy + v2), Gnosis Chain (v2 primary) — CONFIRMED on-chain
**Status (2026-07):** ALIVE and maintained — repos pushed 2026-07-23; contracts answering
**Aggregator verdict:** _TBD_

## What it proves
## Trust root & failure modes

## On-chain surface

### Contract addresses — CONFIRMED (source: `scripts/consts/addresses/addresses-mainnets.ts`
in https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-contracts, plus `scripts/consts.ts`)

**Ethereum mainnet (chainId 1)**
| Role | Address |
|---|---|
| PoH v2 proxy | `0xbE9834097A4E97689d9B667441acafb456D0480A` |
| PoH v2 implementation | `0x9EcDfADA6376D221Ed1513c9F52cC44a39E89657` |
| CrossChainProofOfHumanity | `0xa478095886659168E8812154fB0DE39F103E74b2` |
| CC implementation | `0x7BBf4551E1324CE7F87050377aE3EF645F08DBfd` |
| AMB bridge gateway | `0xddafACf8B4a5087Fc89950FF7155c76145376c1e` |
| **PoH v1 (LEGACY) registry** | `0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb` |
| ForkModule | `0x068a27Db9c3B8595D03be263d52c813cb2C99cCB` |
| Proxy token (UBI-related) | `0x134e1B6F6665329D16753973AbfFD8aD8BcF7D30` |

**Gnosis Chain (chainId 100)**
| Role | Address |
|---|---|
| PoH v2 proxy | `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc` |
| PoH v2 implementation | `0x85B88E38FB6cbc8059009902F76C47f902373F52` |
| CrossChainProofOfHumanity | `0x16044E1063C08670f8653055A786b7CC2034d2b0` |
| CC implementation | `0x20C27AB7863dC31CEaBd300Fa2787B723D490162` |
| AMB bridge gateway | `0x6Ef5073d79c42531352d1bF5F584a7CBd270c6B1` |
| Proxy token | `0xBc966489400c7D0322f2E93Cf75345360F080799` |

### The exact views an aggregator calls

From `contracts/interfaces/IProofOfHumanity.sol`
(https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-contracts/blob/master/contracts/interfaces/IProofOfHumanity.sol):

```solidity
function isHuman(address _address) external view returns (bool);            // 0xf72c436f
function isClaimed(bytes20 _humanityId) external view returns (bool);       // 0x7883018b
function humanityOf(address _account) external view returns (bytes20);      // 0xe274f78f
function boundTo(bytes20 _humanityId) external view returns (address);
function getHumanityInfo(bytes20 _humanityId) external view returns (
    bool vouching, bool pendingRevokal, uint48 nbPendingRequests,
    uint40 expirationTime, address owner, uint256 nbRequests);
function getHumanityCount() external view returns (uint256);                // 0xe80a3003
```

Implementations (from `contracts/ProofOfHumanity.sol`):
```solidity
function isHuman(address _account) public view returns (bool) {
    Humanity storage humanity = humanityData[accountHumanity[_account]];
    return humanity.owner == _account && block.timestamp < humanity.expirationTime;
}
function isClaimed(bytes20 _humanityId) external view returns (bool) {
    Humanity storage humanity = humanityData[_humanityId];
    return humanity.owner != address(0x0) && block.timestamp < humanity.expirationTime;
}
```
**`isHuman` is a single, cheap, permissionless `eth_call`. This is the ideal aggregator
surface** — no API key, no vendor, no off-chain dependency. `getHumanityInfo(...).expirationTime`
gives us decay/expiry for free.

**IMPORTANT GOTCHA:** `humanityCount` is *cumulative* — `contracts/ProofOfHumanity.sol` line
~1419 does `if (requestId == 0) humanityCount++;` and never decrements. So `getHumanityCount()`
is "humanities ever claimed", **not** currently-valid humans. Use the subgraph or an
`isHuman`/`isClaimed` sweep for the live number.

### Live on-chain reads — 2026-07-24 (public RPCs, `eth_call`)

| Call | Chain | Raw | Decoded |
|---|---|---|---|
| `getHumanityCount()` on `0xa4AC...57bc` | Gnosis | `0x…0a2e` | **2,606** humanities ever claimed |
| `getHumanityCount()` on `0xbE98…480A` | Ethereum | `0x…0037` | **55** humanities ever claimed |
| `submissionCounter()` on v1 `0xC5E9…9BDb` | Ethereum | `0x…5104` | **20,740** submissions ever |

So the v1 mainnet registry did reach ~20.7k lifetime submissions, and v2 activity is
overwhelmingly on **Gnosis** (2,606 vs 55). Ethereum-mainnet v2 is essentially unused.

### Registration economics — read live from the contracts 2026-07-24

| Param | Gnosis | Ethereum |
|---|---|---|
| `requestBaseDeposit()` | 33.6 xDAI (`0x1d24b2dfac5200000`) | 0.0475 ETH |
| `humanityLifespan()` | 31,557,600 s = **365.25 days** | same |
| `renewalPeriodDuration()` | 7,889,400 s = **91.3 days** | — |
| `requiredNumberOfVouches()` | **1** | **1** |
| `challengePeriodDuration()` | 302,400 s = **3.5 days** | — |
| `governor()` | `0x821feeaa539eeb4346352f231009fbb7ff7c6b12` | `0xbfacf556934f6703bb341b6875a15b12afeaa28c` |

**`requiredNumberOfVouches() == 1` is a major scoring input.** The vouching graph requirement
is a *single* vouch from an existing registered human — far weaker than the "web of trust"
marketing implies. Sybil resistance therefore rests almost entirely on (a) the 3.5-day
challenge window and (b) somebody bothering to challenge and take it to Kleros.

Credential **expires after 1 year** and must be renewed (renewal window opens 91 days before
expiry). Any aggregate score must decay/expire accordingly — and `getHumanityInfo` hands us
`expirationTime` directly.

### Registry population — measured directly from event logs, 2026-07-24

I swept `eth_getLogs` on the Gnosis PoH v2 proxy `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`
from its deploy block **35,846,827** (per `config/gnosis.json` in the subgraph repo) to head
block **47,373,525**, for these topics:

| Event | topic0 | All-time count |
|---|---|---|
| `HumanityClaimed(bytes20,uint256)` | `0x8f7a3d8342a820e0b4964cc989eda69c533342896a0fa4a8379336dc0904cbe9` | **1,364** (1,357 unique humanityIds) |
| `HumanityRevoked(bytes20,uint256)` | `0x1765930ce5b4d87513bdba895a4be9f23166d2a2e58528486aa13a1e9777c370` | **1** |
| `HumanityGrantedDirectly(bytes20,address,uint40)` | `0x4a05b98253015fe18cb57d239b4209ea44674e1b9a7c9bf0889d401d97152b14` | **9** (cross-chain transfers in) |

**Monthly successful claims on Gnosis** (block→date via ~5.2 s Gnosis block time, ±few days):

| Month | Claims | | Month | Claims |
|---|---|---|---|---|
| 2024-09 | 1 | | 2026-01 | 9 |
| 2024-10 | 8 | | 2026-02 | 4 |
| 2024-11 | 7 | | 2026-03 | 7 |
| 2025-03 | 1 | | **2026-04** | **111** |
| 2025-05 | 4 | | **2026-05** | **217** |
| 2025-06 | 2 | | **2026-06** | **515** |
| 2025-07 | 5 | | **2026-07** (to 24th) | **456** |
| 2025-08 → 2025-12 | 17 total | | | |

### The two facts that matter most about PoH v2

1. **PoH v2 was effectively a ghost town for 19 months and then exploded in 2026-Q2.**
   Sept 2024 – Mar 2026 produced roughly **65 successful claims total**. April–July 2026
   produced **~1,299**. ~95% of everyone in the v2 registry registered in the last four months.
   `UNCLEAR:` what triggered this. The subgraph config
   (https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-subgraph/blob/master/config/gnosis.json)
   now indexes a **RewardDistributor** at `0x906113115C0A691F7E78dB91083EFfCD415Cb978`
   (start block 44,271,442 ≈ 2026-01) and a **ProofOfHumanityCirclesProxy** at
   `0xf49aB03E980BD27ecf9352cAF4A65921DD70a554` (start block 43,089,534 ≈ 2025-11).
   A live money faucet appearing right before a 20x registration surge is the obvious
   hypothesis and must be treated as a **sybil-incentive red flag**, not as organic demand.
2. **The adversarial layer has essentially never fired.** `HumanityRevoked` has been emitted
   **once, ever** (2025-07-21, humanityId `0xcf3c78a77ff01b451a21301a522c48b92a029e70`).
   With `requiredNumberOfVouches() == 1` and a 3.5-day challenge window, PoH v2's Sybil
   resistance is theoretical: nobody is challenging. See the Kleros section — the deterrent
   only works if someone is watching, and on Gnosis the empirical challenge rate is ~0.07%.

Note also the discrepancy: `getHumanityCount()` = **2,606** but only **1,357** unique
humanities were ever successfully claimed. `humanityCount` increments on the *first request*
for a humanityId (`if (requestId == 0) humanityCount++;`), not on success, so ~1,250 request
flows were started and never executed — pending, withdrawn, or abandoned. **Do not quote
`getHumanityCount()` as a user count.**

## Integration surface
## Privacy model
## Scoring-relevant facts
## Overlap with other protocols
## Open questions for us

---

# Kleros (as arbitration trust root)

_TBD_

---

# BrightID

**One-liner:** _TBD_
**Category:** social-trust
**Status (2026-07):** _TBD_
**Aggregator verdict:** _TBD_

---

# Idena

**One-liner:** _TBD_
**Category:** uniqueness (synchronous ceremony)
**Status (2026-07):** LIVE CHAIN, DEAD USERBASE — 180 total identities at epoch 214 (2026-07-21)
**Aggregator verdict:** _TBD (leaning SKIP)_

## HARD DATA — pulled live from the Idena public indexer 2026-07-24

Source: `https://api.idena.io/api/...` (public indexer, no auth needed).

Current epoch: **215**, next validation ceremony **2026-07-26T15:00:00Z**
(`GET https://api.idena.io/api/Epoch/Last`). Chain is producing blocks
(validationFirstBlockHeight for epoch 214 = 11,066,197).

### Identity count by epoch (`GET /api/Epoch/{n}/Identities/Count`)

| Epoch | Validation date | Total identities |
|---|---|---|
| 60  | 2021-01-03 | 7,091 |
| 80  | 2022-01-22 | **21,187** (peak observed) |
| 100 | 2023-02-02 | 3,468 |
| 120 | 2023-10-14 | 2,344 |
| 140 | 2024-07-20 | 2,599 |
| 160 | 2025-04-26 | 905 |
| 180 | 2026-01-15 | 412 |
| 200 | 2026-05-12 | 245 |
| 210 | 2026-07-01 | 196 |
| 213 | 2026-07-16 | 182 |
| 214 | 2026-07-21 | **180** |

**~99.2% decline from the Jan-2022 peak.** This is the single most important fact
about Idena for us.

### Composition at epoch 214 (`GET /api/Epoch/214/IdentityStatesSummary`)

| State | Count |
|---|---|
| Human | 98 |
| Verified | 12 |
| Newbie | 14 |
| Suspended | 24 |
| Zombie | 10 |
| Undefined | 22 |

Only **124 identities are in a "validated" state** (Human + Verified + Newbie).
Online (mining) identities: **122** (`GET /api/OnlineIdentities/Count`).
Flips submitted in epoch 214: 342. Bad flip authors in epoch 214: 23.

### Epoch length is now ~5 days, which itself is the tell

`/api/Epoch/214/RewardsSummary` reports `epochDuration: 22065` blocks and
`prevEpochDurations: [21885, 21917]`. Epoch 214 validated 2026-07-21, epoch 215
validates 2026-07-26 — a **5-day epoch**. Idena's protocol lengthens the epoch as the
network grows and shortens it when the network shrinks; the docs state validation moves
to weekly (Saturdays) only once the network exceeds 291 identities
(https://www.idena.io/faq). Idena is now *below its own weekly-cadence threshold*, i.e.
the protocol itself has downgraded the network to sub-291-identity mode.

### Token/economy
`GET /api/Coins` (2026-07-24): minted 166,766,709 iDNA; burnt 10,183,464; total balance
117,471,798; total stake 39,069,696. Epoch 214 total rewards minted: 132,390 iDNA, of
which **validation rewards = 0** — rewards are now going almost entirely to flip
authorship and reporting, not to validation.

---

## References
