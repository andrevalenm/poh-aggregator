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
   **→ CONFIRMED below. It is a PNK airdrop.**
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

**One-liner:** Token-weighted, randomly-drawn juror panels ("courts") that rule on evidence;
PoH's entire Sybil resistance ultimately rests on this.
**Status (2026-07):** live and used, but economically thin — PNK market cap **$6.0M**

## What PoH actually points at — read live from the contracts 2026-07-24

`arbitratorDataHistory(0..3)` on the PoH v2 proxies decodes to:

| Chain | Arbitrator | subcourtID | jurors | `arbitrationCost` |
|---|---|---|---|---|
| Gnosis | KlerosLiquid **`0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002`** | **18** | **1** | **6 xDAI** |
| Ethereum | KlerosLiquid **`0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069`** | **0** (General Court) | **23** | **0.1242 ETH** |

`courts(18)` on Gnosis KlerosLiquid returns:
`parent=0, hiddenVotes=false, minStake=1,200 PNK, alpha=10000, feeForJuror=6 xDAI,
jurorsForCourtJump=14`.

### Does arbitration actually catch Sybils? Blunt answer: not empirically.

- The **Gnosis registry — where ~99% of PoH v2 users are — resolves a challenged claim with a
  single drawn juror** whose minimum stake is **1,200 PNK ≈ $9.94 at $0.00828/PNK (2026-07-24,
  CoinGecko)**. Appeal escalates toward 14 jurors (`jurorsForCourtJump`), but the *first*
  decision is one person.
- Empirically the mechanism has fired essentially never: **exactly one `HumanityRevoked` event
  in the entire history of the Gnosis v2 registry** (2025-07-21) against 1,357 successful
  claims. Whatever the theoretical deterrent, in practice nobody is challenging.
- The economic security of the whole thing is bounded by PNK: market cap **$6.0M**, 24h volume
  **$21,245** (CoinGecko, 2026-07-24), price **-97.8% from the 2021-05 ATH of $0.380**. A 24h
  volume of $21k means an attacker cannot buy a controlling stake quickly *on market* — but it
  also means the security budget is tiny and illiquid, which cuts both ways.
- `UNVERIFIED:` total PNK staked in Gnosis subcourt 18. That, not market cap, is the real
  number to compute for an outvote-cost estimate (draw probability ∝ stake). Next step:
  read PNK `balanceOf(KlerosLiquid)` on Gnosis, or the Kleros subgraph's court stake totals.

### Documented incidents (secondary sources)

- **2023-12** — an attempt to drain >46 ETH (reported as >$100,000) from the PoH DAO's Kleros
  Governor contract; caught by the Kleros community before execution.
  https://blog.kleros.io/how-kleros-prevented-more-than-100-000-from-being-stolen-from-proof-of-humanity-dao-a-detailed-analysis/
  (secondary source, Kleros's own blog — self-reported, treat accordingly.)
- The known theoretical attack on Kleros is the classic **p+ε bribe / Schelling-point attack**
  on token-weighted juries, plus **appeal-fee exhaustion** (an attacker with more capital keeps
  appealing until the honest side cannot fund the next round). Neither is unique to PoH.

## The Democracy Earth / PoH fork drama and UBI token

Corrective on a widely-repeated claim: **there was no successful registry fork.** Per Clément
Lesaege (Kleros co-founder, PoH's actual author) —
https://medium.com/@ClementLesaege/making-sense-of-recent-drama-in-proof-of-humanity-ccf3082eb0fa
(secondary, and a partisan account from one side):

- 2021: Kleros Cooperative built PoH; **Democracy Earth** (Santiago Siri) integrated the **UBI**
  token that streams to registered humans.
- Mid-2022: governance war. **HIP-49**, which would have replaced Kleros as PoH's arbitrator
  with a UBI-token-based alternative, **was voted down by ~21 votes**. The registry stayed
  under Kleros arbitration throughout.
- The UBI token round-tripped from ~$110 to near zero after a large holder dumped.

**UBI token today (CoinGecko, 2026-07-24): price $0.0000832, market cap $0, 24h volume $21.26,
ATH $1.39 on 2021-10-19 → −99.994%.** The UBI stream is economically irrelevant. It is *not*
what is driving the 2026 registration surge.

The mainnet **ForkModule `0x068a27Db9c3B8595D03be263d52c813cb2C99cCB`** exists in the v2
deployment and, per Blockscout, its only external transaction is its own **contract creation
on 2024-09-05**. It is the v1→v2 migration shim (letting v2 read/retire v1 registrations),
not evidence of a community fork.

---

# BrightID

**One-liner:** Off-chain social graph on a dedicated chain (IDChain); "connection parties" build
the graph, graph-analysis algorithms label nodes as unique humans.
**Category:** social-trust (explicitly NOT uniqueness — see below)
**Chains:** its own **IDChain** (EVM sidechain); optional on-chain relays to Ethereum/Gnosis
**Status (2026-07):** infrastructure UP, product hollowed out — see live probes
**Aggregator verdict:** _TBD_

## Liveness evidence — live probes 2026-07-24

| Probe | Result |
|---|---|
| `https://app.brightid.org/node/v6/state` (the node the mobile app used) | **502 Bad Gateway** (nginx) |
| `https://forum.brightid.org/` | **503** — forum down |
| `https://www.brightid.org/` | 200 |
| `https://node.brightid.org/brightid/v6/state` | **200**, node version **6.18.0**, `lastProcessedBlock` 38,897,099 |
| `https://aura-node.brightid.org/brightid/v6/state` | **200**, node version 6.17.2 |
| IDChain RPC `https://idchain.one/rpc/` `eth_blockNumber` | **0x25185d5 = 38,899,157** — chain producing blocks |
| `https://explorer.brightid.org`, `https://aura.brightid.org` | 200 (SPAs) |

GitHub org https://github.com/BrightID — **still being committed to**:
`aura` pushed **2026-07-24** (today), `BrightID-Node-Backup-Script` 2026-07-22,
`BrightID-Alert` 2026-06-18, `BrightID-Node` 2026-05-03, `aura-frontend` 2026-04-03.
But the *core* repos are stale: the main mobile app repo `BrightID` last pushed **2025-10-20**,
`BrightID-Docs` **2025-01-19**, `BrightID-SmartContract` **2023-11-08**,
`brightid-javascript-sdk` **2023-03-10**, `BrightID-Soulbound-Token` **2022-09-30**.
Read: a small crew keeps the nodes and the Aura sub-project breathing; the client, the SDK and
the on-chain integration layer are abandoned.

## Verification methods and what each proves

From `verificationsHashes` in the live `/state` response, the verification sets the node
actually computes at block 38,896,800 are:
`Seed`, `SeedConnected`, `SeedConnectedWithFriend`, `BrightID`, `DollarForEveryone`,
`SocialRecoverySetup`, `predefined` (main node) plus `Aura` (aura node).

- **Meets** (`BrightID` / `SeedConnected*`) — you attend a video "connection party" with seed
  members and get connected. Proves *social trust*, i.e. "some existing member vouched after
  seeing your face live." It does **not** prove uniqueness — the graph can be gamed by anyone
  who can be at multiple parties or who buys connections.
- **Bitu** — graph-analysis scoring; nodes inside dense honest regions get verified, outliers
  are called Sybils (https://brightid.gitbook.io/brightid/getting-verified/bitu-verification).
  **`Bitu` does not appear in the live `verificationsHashes` at all on either public node
  (2026-07-24)** — i.e. the node is not currently producing a Bitu verification set. Some apps
  still *ask* for it (`Manna` requires `"BrightID and Bitu and Bitu.score>0"`), which means
  those apps are presumably unsatisfiable today. `UNCLEAR:` whether Bitu was deliberately
  retired or is simply broken — check the BrightID-Node release notes / Discord.
- **Aura** — a human-reviewer-based reputation layer meant to replace Bitu
  (https://forum.brightid.org/t/aura-a-new-verification-for-brightid/393). On the aura node the
  `Aura` verification hash is **`47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU`**, which is
  base64url(SHA-256("")) — **the hash of the empty set. Zero Aura-verified users at that
  block.** Aura is the most actively developed BrightID repo and has no users.

## On-chain surface

BrightID is fundamentally **off-chain**: the social graph and verification sets live on
BrightID nodes (ArangoDB) with consensus anchored to IDChain. There is no permissionless
Ethereum contract you can just `eth_call` to ask "is this address a unique human." Relays exist
(`BrightID-SmartContract`, `BrightID-Soulbound-Token`) but both repos are **abandoned (2023-11
and 2022-09 last push)** — treat any address you find in them as stale.
`UNVERIFIED:` current canonical BrightID verifier contract addresses on Ethereum/Gnosis. I did
not find a maintained deployment list. Next place to look: the `dev-guides` repo and
https://brightid.gitbook.io/brightid/linking-brightid-to-applications.

## Integration surface

Node REST API, **no API key, permissionless read** (confirmed live 2026-07-24):

```
GET https://node.brightid.org/brightid/v6/state
GET https://node.brightid.org/brightid/v6/apps                 -> 58 registered apps
GET https://node.brightid.org/brightid/v6/apps/{appId}
GET https://node.brightid.org/brightid/v6/verifications/{appId}/{appUserId}
```
Error shape confirmed: querying an unknown id returns
`{"error":true,"errorNum":61,"errorMessage":"... app generated id is not found.","code":404}`.

**The catch:** `verifications/{appId}/{appUserId}` is keyed by an *app-scoped* user id. To
verify anyone we would have to be registered as a BrightID **app/context** — which requires
BrightID's cooperation (app registration is an operation on IDChain performed by BrightID
admins). So verification is *permissionlessly readable* but **not permissionlessly issuable to
us**. We cannot bootstrap without the (barely-staffed) BrightID team.

Apps registered: **58** (`/brightid/v6/apps`), including `Gitcoin` (context "Gitcoin",
`verifications: ["BrightID"]`), `1hive`, `clr.fund`, `unitap`, `Manna`, `RabbitHole`, `Muon`,
`Discord`. **Gitcoin/Passport historically carried a BrightID stamp** — the app registration is
still present in the node. `UNVERIFIED:` whether Human Passport (ex-Gitcoin Passport) still
scores the BrightID stamp in 2026; see the passport/Gitcoin write-up.

Blind-signature mode (`usingBlindSig: true`, used by `Manna`, `clr.fund`, `clrfund-arbitrum`)
is BrightID's unlinkability feature — a WI-Schnorr blind signature (the node's
`wISchnorrPublic` p/q/g/y params are in `/state`), so the node signs a credential it cannot
link back to the user's BrightID.

`brightid-python-sdk` (pushed 2025-11-18) is the least-stale SDK.
`UNVERIFIED:` its PyPI package name and license.

## Privacy model

App-scoped ids → **nullifiers are app-scoped, not global**, so a user is unlinkable across
apps by default. With `usingBlindSig` the node additionally cannot link the issued credential
to the graph identity. This is genuinely better privacy than most protocols in this space.
Downside: because ids are app-scoped, **we cannot dedupe a BrightID user against our own
records across contexts**, and we cannot verify anyone in an app context we don't own.

## Scoring-relevant facts

- `UNVERIFIED:` current count of BrightID-verified humans. The node API exposes no public
  aggregate count endpoint (`/verifications`, `/users`, `/groups` all 404). Next place to look:
  https://explorer.brightid.org (SPA — would need browser rendering) or the node's ArangoDB
  dumps / `BrightID-Node-Backup-Script`.
- Cost to obtain: free, but requires attending a scheduled live connection party — **high
  friction, low cost**. That is the wrong shape for sybil resistance: a farm with time and
  cheap labor can attend many parties.
- Aura verified users: **0** (empty-set hash, 2026-07-24).

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
