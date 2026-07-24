# Social / game-theoretic personhood protocols: Proof of Humanity, Kleros, BrightID, Idena

**Research date: 2026-07-24.** All counts, contract reads and API probes below were executed
live on that date against public RPCs, block explorers and project APIs — not recalled.

## Verdicts at a glance

| Protocol | Category | Alive? | Population (2026-07-24) | Verdict |
|---|---|---|---|---|
| **Proof of Humanity v2** | liveness + social-trust | **Yes**, actively developed | **~1,340** valid (Gnosis) + 55 (Ethereum) | **INTEGRATE NOW**, weight low, weight by registration age |
| **Proof of Humanity v1** | same | Frozen but readable | 20,740 lifetime submissions; current-valid UNVERIFIED | Read-only fallback |
| **Kleros** | adjudication layer | Yes | PNK mcap $6.0M | Not scoreable; model it as PoH's trust root |
| **BrightID** | social-trust | Servers up, product empty | UNVERIFIED; Aura = **0** | **SKIP** |
| **Idena** | uniqueness (ceremony) | Chain yes, users no | **124 validated**, 180 total | **SKIP** (museum piece) |

Scope: the "veteran" cohort of personhood protocols whose trust root is **social graph + human
adjudication + synchronized ceremony**, i.e. explicitly *not* biometrics and *not* government
documents. Covered here: Proof of Humanity v1/v2 (+ Kleros arbitration, Democracy Earth fork,
UBI token), BrightID, Idena.

---

# Proof of Humanity (v1 / v2)

**One-liner:** A public on-chain registry where a human submits a video + a name, gets one vouch
from an existing member, and is registered unless someone disputes them in a Kleros court.
**Category:** liveness + social-trust (marketed as uniqueness; uniqueness is only as real as the
challenge rate, which is ~0.07%)
**Chains:** Ethereum mainnet (v1 legacy + v2), Gnosis Chain (v2 primary) — CONFIRMED on-chain
**Status (2026-07):** **ALIVE and actively maintained.** Repos pushed 2026-07-23; contracts
answering; ~1,340 currently-valid humanities on Gnosis; registrations running ~450–500/month —
but that growth is a PNK airdrop, confirmed on-chain below.
**Aggregator verdict:** **INTEGRATE NOW — cheap to do, weight it low, and weight it by age.**
The integration is a single permissionless `eth_call` (`isHuman(address)`) with no vendor, no
API key and no cost, and PoH is a genuinely independent trust root from every biometric and
document protocol. But the registry is small (~1.3k), 95% of it registered in the last four
months for a ~$10 PNK airdrop, and its Sybil-resistance mechanism has fired exactly once in
its history. Treat it as a weak positive signal, discount the 2026 cohort hard, and re-measure
after the airdrop pool empties (~2026-10).

> Section order note: the on-chain measurements come first here because they are the evidence
> the rest of the section argues from. **What it proves / Trust root & failure modes** follow at
> line ~226.

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

### CONFIRMED: the 2026 surge is a PNK airdrop, ~$10/head

I read the RewardDistributor directly on Gnosis (2026-07-24):

| Call on `0x906113115C0A691F7E78dB91083EFfCD415Cb978` | Result |
|---|---|
| `amountPerClaim()` | `1200e18` = **1,200 PNK** |
| `token()` | `0xcB3231aBA3b451343e0Fddfc45883c842f223846` (PNK on Gnosis) |
| `crossChainProofOfHumanity()` | `0x16044E1063C08670f8653055A786b7CC2034d2b0` (the PoH CC contract — this is what gates the claim) |
| PNK `balanceOf(distributor)` | **984,300 PNK** remaining (~820 more claims fundable) |
| `Claimed(bytes20 indexed humanityID)` events (topic0 `0x9f8543fb…de8c45`) | **1,279** all-time |

Contract source: https://github.com/Proof-Of-Humanity/reward-distributor/blob/main/contracts/RewardDistributor.sol
(`function claim()` → `require(token.transfer(msg.sender, amountPerClaim))`, gated on PoH).
Deployed **2026-01-21** (Gnosis, per `deployments/gnosis/deployments.json` and Blockscout).

**Reward claims track registrations almost 1:1:**

| Month | New PoH claims | PNK reward claims |
|---|---|---|
| 2026-01 | 9 | 20 |
| 2026-02 | 4 | 8 |
| 2026-03 | 7 | 7 |
| 2026-04 | 111 | 110 |
| 2026-05 | 217 | 209 |
| 2026-06 | 515 | 474 |
| 2026-07 (to 24th) | 456 | 451 |

At $0.00828/PNK that is **≈ $9.94 per registration**, and the public messaging (per Kleros
docs search results) is "register as human and claim 1,200 $PNK, stake to double your
allocation." **~95% of the entire PoH v2 registry joined for a ~$10 token grant.** The
33.6 xDAI deposit is *refundable*, so net cost to a registrant is gas + time.

Second-order effect worth flagging: 1,200 PNK is **exactly the `minStake` of Gnosis subcourt
18**, the court that arbitrates PoH disputes. The airdrop is sized to make every new registrant
eligible to be a juror in their own registry's court. Elegant, and also circular: the people
who would judge a Sybil challenge are the people the Sybil incentive attracted.

## What it proves

- **Liveness / not-a-bot: yes, strongly.** A submission is a video of a named person saying a
  phrase and showing their address, reviewed by other humans. As of 2026 a video deepfake
  clears this bar cheaply, so this is weakening fast.
- **Social trust: yes, but thin.** `requiredNumberOfVouches() == 1`.
- **Uniqueness: only conditionally.** Uniqueness comes from *someone challenging a duplicate*
  and winning in Kleros. With one revocation in the registry's entire history, uniqueness is
  asserted, not demonstrated.
- **Not** state identity, **not** biometric. No document, no face-embedding database. That is
  the whole reason it is worth aggregating: it is a **genuinely independent trust root**.

Precise claim: PoH proves *"a human being appeared on video, one existing member vouched, and
in the following 3.5 days nobody with 6 xDAI cared enough to dispute it."*

## Trust root & failure modes

Trust root = **Kleros jurors** (see below), backstopped by a deposit.

1. **Nobody is watching.** 1 revocation / 1,357 claims. The challenge bounty is the challenger's
   share of the loser's deposit — with a 33.6 xDAI deposit on Gnosis the bounty is ~$30, against
   6 xDAI arbitration cost plus real work assembling evidence and appeal risk. **The economics do
   not pay a full-time Sybil hunter.** Historically PoH v1 had an active community of vouchers
   and challengers on Telegram/Discord; there is no evidence of an equivalent on Gnosis v2.
2. **Deepfake video.** The v1-era assumption (a human reviewer can tell a real video from a
   fake) is the part of the design most obviously eroded by 2026 generative video. `UNVERIFIED:`
   any documented deepfake registration in PoH v2 — I found none, which given (1) may simply
   mean nobody looked.
3. **Vouch farming.** With `requiredNumberOfVouches() == 1`, one cooperating registered human
   can gate an unlimited number of registrations. Vouch-selling is the obvious market. PoH does
   penalise this: `processVouches` can punish vouchers of a revoked humanity — but that path has
   fired once.
4. **Airdrop-driven registration.** The registry's growth is currently indistinguishable from
   airdrop farming (above). Any human who can source a vouch and 33.6 xDAI of float can register
   an alt for ~$10 profit. This is the single biggest reason to discount PoH v2's 2026 cohort.
5. **Governance.** `governor()` on Gnosis is `0x821feeaa539eeb4346352f231009fbb7ff7c6b12`;
   `UNVERIFIED:` whether this is a Kleros Governor contract, a multisig, or an EOA. It can change
   the arbitrator, the deposit and the vouch requirement. **Check this before integrating** — a
   governor that can point `arbitrator` at a contract it controls can mint humanity at will.

## Integration surface

- **Best path: direct `eth_call`, no vendor.** `isHuman(address)` on
  `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc` (Gnosis) and
  `0xbE9834097A4E97689d9B667441acafb456D0480A` (Ethereum). Permissionless, no API key, no rate
  limit beyond our own RPC. Pair with `humanityOf(address)` → `bytes20` as the stable
  cross-chain identifier, and `getHumanityInfo(humanityId).expirationTime` for decay.
- **Cross-chain:** `CrossChainProofOfHumanity` (`0x16044E…d2b0` Gnosis /
  `0xa47809…74b2` Ethereum) mirrors humanity state over the Gnosis AMB. A user registered on
  Gnosis is *not* automatically `isHuman == true` on Ethereum until they bridge. **Query both
  chains**, or query the CC contract.
- **Legacy v1** `0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb` still answers views
  (`submissionCounter()` = 20,740) and still has `isRegistered(address)` (selector
  `0xc3c5a547`). Per Blockscout its **last external transaction was 2026-02-07**
  (`withdrawSubmission()`), before that 2025-11-11 — i.e. v1 is functionally frozen but
  readable. `UNVERIFIED:` how many v1 submissions are *currently* valid (v1 registrations also
  expire; most 2021-era entries have long lapsed). Next step: sweep v1 `isRegistered` over the
  submission list, or use the `proof-of-humanity-mainnet` subgraph.
- **Subgraph:** deployed to **The Graph** under names `poh-origin-gnosis`, `poh-origin-mainnet`
  (current), and previously `pohv2-prod-gnosis` / `proof-of-humanity-gnosis`
  (see `package.json` in the subgraph repo). The web app takes the endpoints from env vars
  `GNOSIS_SUBGRAPH_URL` / `MAINNET_SUBGRAPH_URL` (`src/config/subgraph.ts`), so the production
  URLs are **Graph gateway URLs requiring an API key** — not published. A Chiado testnet copy
  is on Goldsky. `UNVERIFIED:` the exact production gateway subgraph IDs; we would query by
  name via our own Graph API key, or self-host from the repo.
- **No REST API, no SDK, no vendor account, no pricing.** This is the cleanest integration in
  the whole personhood space.

## Privacy model

**None. PoH is radically non-private.** Registration publishes to IPFS, referenced on-chain:
the registrant's **name, a photo, and a video of their face and voice**, permanently and
publicly. There is no ZK layer, no nullifier, no selective disclosure. The humanityId
(`bytes20`) is a **global, cross-app, permanent identifier** — the opposite of an app-scoped
nullifier.

Implication for us: surfacing "this user has PoH" is by construction doxxing-adjacent, since
anyone can walk from the address to the humanityId to the IPFS video. If our aggregate score is
public, a PoH contribution to it is a strong deanonymisation vector. Weigh that against the
protocol's other merits.

## Scoring-relevant facts

- **Live population (2026-07-24): ~1,357 humans ever claimed on Gnosis + 55 on Ethereum.**
  Since `humanityLifespan()` is 365.25 days and 1,337 of the 1,357 Gnosis claims are within the
  last year, currently-valid ≈ **1,340**, i.e. essentially the whole registry is "fresh."
  Compare: PoH v1 peaked near 19–20k (20,740 lifetime submissions).
- Cost to obtain: 33.6 xDAI **refundable** deposit + gas + 1 vouch + a video, ~3.5 days to
  finality. Net cost after the PNK airdrop: **negative** (~$10 profit).
- Expiry: **1 year**, renewable from day 274. Score must decay.
- Revocation: exists, has fired once.
- Geography: `UNVERIFIED:` no public breakdown. The v1 registry was heavily
  Latin-American (the UBI/Democracy Earth community); no reason to assume the 2026 Gnosis
  cohort matches.
- **Suggested weight: low-to-moderate, and specifically discount the post-2026-04 cohort.**
  A PoH credential minted before 2026-01 (pre-airdrop) is much stronger evidence than one
  minted in June 2026. We can tell these apart cheaply: the humanityId's first
  `HumanityClaimed` block is on-chain. **Recommend our scorer reads registration age, not just
  the boolean.**

## Overlap with other protocols

- **Kleros** — not an overlap, a *dependency*. PoH's trust root IS Kleros. If we ever score
  another Kleros-arbitrated registry (e.g. a Curate list), those are **not independent
  evidence**.
- **Circles** — related by integration (`ProofOfHumanityCirclesProxy`
  `0xf49aB03E980BD27ecf9352cAF4A65921DD70a554` on Gnosis, active June 2026) but per the Circles
  research agent they are **separate registries; do not merge them**. A PoH humanity can seed a
  Circles trust edge, which means Circles evidence downstream of PoH is *partially derived*
  from PoH, not independent of it.
- **Biometric / document protocols (World ID, Worldcoin orb, zkPassport, Anon Aadhaar,
  Fractal, etc.)** — **fully independent trust root.** No shared document, no shared biometric
  database, no shared issuer. This is PoH's main value to an aggregator.
- **Vouching-based protocols generally** — see the cross-cutting section at the end. PoH's
  vouch, BrightID's connections, Idena's invites and Circles' trust edges are **the same
  primitive** and must not be counted as four independent signals.

## Open questions for us

1. What is `governor()` `0x821feeaa539eeb4346352f231009fbb7ff7c6b12` on Gnosis — Kleros
   Governor, multisig, or EOA? This bounds the trust assumption.
2. How many PoH **v1** submissions are currently valid? (Determines whether v1 is worth
   querying at all, or is purely historical.)
3. When the 984,300 remaining PNK runs out (~820 claims, i.e. ~2 months at the current rate),
   does registration collapse back to ~5/month? That is the test of whether any of this
   population is real demand. **Re-measure in 2026-10.**
4. What fraction of the 2026 cohort shares a voucher? A vouch-graph concentration analysis on
   `VouchRegistered(bytes20 indexed voucherHumanityId, bytes20 indexed vouchedHumanityId, uint256)`
   would directly measure the farm hypothesis. This is a few hours of `eth_getLogs` work and is
   **the highest-value follow-up in this whole document.**

---

# Kleros (as arbitration trust root)

**One-liner:** Token-weighted, randomly-drawn juror panels ("courts") that rule on evidence;
PoH's entire Sybil resistance ultimately rests on this.
**Category:** not a personhood protocol — an *adjudication layer*. Never score it directly.
**Status (2026-07):** live and used, but economically thin — PNK market cap **$6.0M**,
24h volume **$21k**
**Aggregator verdict:** **Not integrable and not scoreable — but you must model it.** Kleros is
the trust root under PoH (and under any Kleros Curate list we might later touch). Its practical
security for PoH on Gnosis is *one juror with a ~$10 minimum stake, in a court nobody has
invoked but once*. Whenever we assign weight to a PoH credential we are really assigning weight
to that. Track PNK market cap and the PoH revocation count as health metrics.

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
**Status (2026-07):** infrastructure UP, product hollowed out — main app node returns 502, forum
returns 503, Bitu verification no longer computed, Aura has literally zero verified users
**Aggregator verdict:** **SKIP.** Not a museum piece — it is worse: a running server with an
empty product. Verification is readable permissionlessly but **not obtainable** by us without
BrightID registering our app as a context on IDChain, which requires the cooperation of a team
that cannot keep its own primary node up. Revisit only if Aura ever shows a non-empty
verification set.

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
- No expiry semantics equivalent to PoH's `expirationTime`; verification sets are recomputed
  per block window, so "verified" is a *current* property, which is actually good for decay.
- BrightID's own DAO token is `BRIGHT` (`brightid.gitbook.io/brightid/bright/bright-dao`).
  `UNVERIFIED:` current BRIGHT price/liquidity — not checked.

## Trust root & failure modes

Trust root = **the seed group** (a small set of trusted founding members) plus the graph
algorithm run by node operators. Two consequences:

1. **It is a permissioned trust root wearing a decentralized costume.** Seeds decide who gets
   into the connected core; node operators decide which algorithm defines "verified." There is
   no economic staking, no slashing, no dispute mechanism. Nothing costs an attacker money.
2. **Connection parties are exactly the puppeteering surface Ohlhaver & Nikulin describe for
   Idena** (see the Idena section). A "farm" doesn't need bots — it needs a room of real people
   whose keys it holds. BrightID has *less* defence against this than Idena, because Idena at
   least has identity staking and a synchronous ceremony; BrightID's parties are scheduled,
   repeatable and remote.
3. **Single-operator liveness risk, realised:** the node the official app pointed at
   (`app.brightid.org/node/...`) is returning 502 today. If our verification path depends on a
   specific node being up, it is not up.

## Overlap with other protocols

- **Gitcoin / Human Passport** — historically a BrightID stamp; the `Gitcoin` app context is
  still registered on the node. Any Passport score that includes BrightID is **downstream of
  BrightID, not independent of it**. Do not double count.
- **Vouching family** — same primitive as PoH vouches, Idena invites, Circles trust edges. See
  the cross-cutting section.
- Independent of all biometric/document trust roots.

## Open questions for us

1. How many humans hold a live `BrightID` verification today? The node exposes no aggregate
   count. Getting this requires either the explorer SPA or a node DB dump.
2. Was Bitu retired deliberately or is it broken? Apps requiring `Bitu.score>0` appear
   unsatisfiable.
3. Can an outside party still get an app/context registered on IDChain in 2026, and how long
   does it take? If the answer is "no one is processing requests," BrightID is closed to us
   regardless of its user count.

---

# Idena

**One-liner:** A blockchain whose consensus *is* proof-of-person: everyone on the network solves
AI-hard "flip" puzzles **at the same moment**, so one human physically cannot validate many
identities.
**Category:** uniqueness (the only protocol in this document whose design actually targets
uniqueness rather than liveness or social trust) — with a fatal caveat, below.
**Chains:** its own Idena chain
**Status (2026-07):** **LIVE CHAIN, DEAD USERBASE.** Epoch 215; next ceremony 2026-07-26;
**180 total identities, 124 validated, 9 candidates** (all read live 2026-07-24). Down ~99.2%
from a 21,187 peak in Jan 2022. IDNA market cap **$114,664**.
**Aggregator verdict:** **SKIP — museum piece.** The mechanism is the most interesting design
in personhood and the API is beautiful (permissionless, no key, exact identity state and age
in one GET). It is worth ~30 lines of code. But at 124 validated humans worldwide, the
expected number of our users holding an Idena identity is approximately zero, and the
protocol's own designers published a paper concluding that even at 20x this size it had
collapsed into puppeteered pools. **Do not build for it. Keep the API note in case a
partner asks.**

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

**IDNA market (CoinGecko, 2026-07-24): price $0.001169, market cap $114,664, 24h volume
$2,906, ATH $0.314 on 2020-09-01 → −99.6%.** A market cap of ~$115k means the chain's entire
economic security is worth less than a used car.

### Concentration today (`GET /api/Pools/Count`, `GET /api/Pools`)
**13 pools** exist. The largest has **5 delegated identities**; sizes are 5, 5, 3, 3, 3, 2,
1, 1, 1, 1, … Pools are now trivially small — but only because the network is. This is the
residue of the pool crisis described below, not a fix for it.

## What it proves

Idena is the only protocol here with a *structural* uniqueness argument:

- Every identity must solve **flips** ("Filter for Live Intelligent People") — 4 images
  arranged into two candidate orderings, one of which tells a coherent story. Language-neutral,
  designed to be AI-hard (https://www.idena.io/flip-challenge).
- Critically, **all validations happen simultaneously**, at a fixed timestamp announced in
  advance (`validationTime` in `/api/Epoch/Last` — currently `2026-07-26T15:00:00Z`). One human
  cannot be in two ceremonies at once. This is a real, non-social uniqueness mechanism and is
  the reason Idena deserves respect that its user count does not.
- Identities must also **author flips** each epoch (342 in epoch 214) and are penalised for bad
  flips (23 bad-flip authors in epoch 214) — so participation is ongoing work, not a one-time
  enrollment.
- **Invites** gate entry: existing identities receive a limited number of invites
  (`minScoreForInvite: 0.9622642` at epoch 215 — only high-scoring identities may invite).
  Statuses ladder upward: Candidate → Newbie → Verified → Human, with Suspended/Zombie for
  lapsed participants.
- **Identity staking** (added post-crisis) makes an account's stake non-extractable by a buyer,
  which — per Idena's own founder — **successfully killed the account-trading market** that
  plagues biometric protocols.

So Idena proves: *"at moment T, a distinct cognitive agent solved a set of flips, and has done
so repeatedly for N epochs."* That is a stronger claim than anything PoH, BrightID or Circles
can make. **And it is still not enough — see below.**

## Trust root & failure modes

### THE key finding: Ohlhaver & Nikulin, *Compressed to Zero: The Silent Strings of Proof of Personhood* (2024)

This is the strongest documented case anywhere that a **working** proof-of-personhood protocol
can still fail completely. Co-authored with **Mikhail Nikulin, Idena's own founder**, using
Idena's internal data. Talk: ETHBerlin04 keynote, 2024-08-16,
https://www.youtube.com/watch?v=-mwUQp2qwjk — transcript at
`/home/hugo/Projects/poh-aggregator/research/references/ohlhaver-ethberlin-2024-transcript.md`
(auto-generated captions, lightly cleaned; cite the paper for anything public).

The argument, in order:

1. **Idena won the fight it set out to win.** It filtered bots. It killed account-trading via
   identity staking. On the stated goals, it worked.
2. **It lost a fight it hadn't named.** From ~Dec 2020, on-chain patterns showed reward
   transfers from many accounts to one address, simultaneously — implying third-party access to
   private keys. A user then admitted to running a **human farm**: a high-information operator
   paying low-information people ("puppets") to sit the validation ceremony, in exchange for
   control of their keys.
3. This is **not a classic Sybil attack.** The protocol authenticated flesh-and-blood humans
   perfectly. The attacker's Sybils *were real people* — humans acting as programmable bots.
   The authors coin **"de facto Sybil"** for this.
4. **The 2021 delegation hard fork made pools visible rather than banning them.** Post-fork the
   data is unambiguous: solo accounts fell **62% → 27%** of the network while large pools rose
   **22% → 61%**, and large pools captured a matching share of rewards, dumped IDNA, and
   squeezed solo participants out.
5. **The headline number:** at the **May 2022 peak**, analysis of the 31 pools that ever
   exceeded 100 accounts found **all 31 showed signs of third-party key access**, and financial
   ties collapsed them into **23 entities — <1% of distinct entities controlling ≥40% of all
   accounts and nearly half of all rewards.**
6. And that analysis was *conservative*: it excluded 84 mid-size pools (15–100 accounts) and
   411 family pools (<15), i.e. **95% of all pools**. The authors state the statistics can only
   get worse.
7. **Why so cheap:** the reward for differentiating yourself from a bot was **$2–4 every few
   weeks**. That was enough to make renting a human's time profitable. The authors' generalised
   takeaway: *any* global personhood protocol that pays humans to prove humanity creates
   economies of scale for the resourceful to puppeteer the less-informed — **including
   biometric protocols**; those participants have different hassles, not fewer.
8. Their "silent strings" evidence that this was puppeteering rather than consensual
   custody-as-a-service: an **improbable absence** of advertising, legal disputes or customer
   complaints around these custody relationships; and the three largest pools sat in weak
   rule-of-law jurisdictions (Russia, Egypt, Indonesia).

**Read this straight across to our aggregator: a personhood credential can be perfectly
sound at the individual level and worthless at the population level.** Idena did not fail
because its flips were broken. It failed because unique humans are rentable. Every protocol we
aggregate that pays a reward — and PoH v2's PNK airdrop is exactly this, at ~$10/head versus
Idena's $2–4 — inherits this failure mode.

### The AI question — is the flip test broken?

**Not documented as broken as of 2026-07.** What I can and cannot confirm:

- Idena's stated defence is adversarial perturbation plus adversarial-nonsense images, plus a
  "friendly AI" that filters trivial flips so human authors are pushed toward AI-hard ones
  (https://docs.idena.io/docs/wp/technology). Idena has advertised a **prize for the first
  verifiable AI break** of a given accuracy threshold (https://www.idena.io/flip-challenge).
- At ETHBerlin04 (2024-08) Nikulin was asked this directly. His answer was essentially *the
  economics beat the AI*: "it's much more efficient just to hire people to validate their
  accounts instead of employing AI or algorithmic bots." **That is a defence of the flip test
  and simultaneously an admission that the flip test is irrelevant** — the attacker never
  needed to solve it, because renting humans was cheaper. `UNVERIFIED:` any claim of the AI
  prize, or a published multimodal-model attack on flips, as of 2026-07. I found none. Note
  that with 124 validated identities the question is close to moot.

### Other failure modes

- **Ceremony liveness is the whole product.** Miss the ceremony and you decay
  Verified → Suspended → Zombie → Undefined. At epoch 214 that is 24 Suspended + 10 Zombie +
  22 Undefined out of 180. Any score we derive must be checked against the *current* epoch.
- **Chain security.** 122 online identities and a $115k market cap. This chain is trivially
  attackable by anyone who wants to; nobody wants to.

## On-chain / API surface — this part is genuinely excellent

Public indexer, **no auth, no API key, no rate-limit encountered** (all verified live
2026-07-24):

```
GET https://api.idena.io/api/Epoch/Last                      -> {epoch, validationTime, candidateCount, minScoreForInvite, ...}
GET https://api.idena.io/api/Epoch/{n}                       -> same shape for a past epoch
GET https://api.idena.io/api/Epoch/{n}/Identities/Count      -> integer
GET https://api.idena.io/api/Epoch/{n}/IdentityStatesSummary -> [{value:"Human",count:98}, ...]
GET https://api.idena.io/api/Epoch/{n}/Identity/{address}    -> per-identity epoch record
GET https://api.idena.io/api/Identity/{address}              -> current identity state
GET https://api.idena.io/api/Address/{address}               -> {balance, stake, txCount, flipsCount, reportedFlipsCount}
GET https://api.idena.io/api/OnlineIdentities/Count          -> integer
GET https://api.idena.io/api/Epoch/{n}/Flips/Count
GET https://api.idena.io/api/Epoch/{n}/RewardsSummary
GET https://api.idena.io/api/Epoch/{n}/Authors/Bad/Count
GET https://api.idena.io/api/Pools/Count , /api/Pools        -> pool concentration
GET https://api.idena.io/api/Coins
```

An unknown address returns `{"error":{"message":"no data found"}}` (confirmed). Endpoints that
don't exist return a bare `404 page not found` — note `/api/Identities/Count` (no epoch) does
**not** exist; you must scope by epoch.

**What we'd actually call — CONFIRMED against a live validated identity, 2026-07-24:**

```
GET https://api.idena.io/api/Identity/0x012eFb6c820F8deE0f7A28900143358824cbe90f
{"result":{"address":"0x012e…e90f","state":"Human",
           "totalShortAnswers":{"point":27.5,"flipsCount":28}}}

GET https://api.idena.io/api/Epoch/214/Identity/0x012eFb6c820F8deE0f7A28900143358824cbe90f
{"result":{"prevState":"Verified","state":"Human",
           "shortAnswers":{"point":5,"flipsCount":5},
           "longAnswers":{"point":22,"flipsCount":22},
           "shortAnswersCount":8,"longAnswersCount":23,
           "approved":true,"missed":false,
           "requiredFlips":3,"madeFlips":3,"availableFlips":4,
           "totalValidationReward":"0","birthEpoch":209}}
```

So the two fields worth scoring are **`state`** (`Human` > `Verified` > `Newbie` >
`Suspended`/`Zombie` > `Undefined`) and **`birthEpoch`**, which gives identity age in epochs
directly — `currentEpoch - birthEpoch` is a clean continuity signal. `totalShortAnswers.point`
/ `flipsCount` gives lifetime ceremony participation (27.5 points over 28 flips for the sample
identity). `approved`/`missed` per epoch tell you whether they showed up.

Note the sample `Human` has `birthEpoch: 209` against current epoch 215 — **six epochs, ~1
month old**. Do not assume Idena identities are long-lived veterans; the surviving population
churns.

There is also a node JSON-RPC (`dna_identity`) if self-hosting; see
https://docs.idena.io/docs/developer/api/api-rpc.

## Privacy model

Essentially none, but also nothing sensitive collected. No document, no biometric, no video,
no name. The Idena address **is** a global public identifier and all validation history is
public on the chain. No ZK, no nullifiers, no app-scoping. Better privacy than PoH (no face on
IPFS), worse unlinkability than BrightID (no app-scoped ids).

## Scoring-relevant facts

- **124 validated identities worldwide (epoch 214, 2026-07-21).** 9 candidates for epoch 215.
- Cost/friction to obtain: needs an **invite** from a high-scoring identity
  (`minScoreForInvite` 0.962), a stake, and attendance at a fixed-time ceremony every ~5 days.
  Extremely high friction — which is why the number is 124.
- Decay is automatic and fast (Suspended/Zombie), so any score must be epoch-current.
- If a user *does* hold a long-lived Idena `Human` status, it is one of the **highest-quality
  individual signals available anywhere** — many consecutive synchronous ceremonies, unbuyable
  stake. The problem is purely that the population is negligible.

## Overlap with other protocols

- Fully **independent** of biometric and document trust roots.
- **Invites are a vouching primitive** — same family as PoH vouches, BrightID connections,
  Circles trust edges. See cross-cutting section.
- No shared issuer with anything else in the aggregate.

## Open questions for us

1. ~~Field names for identity age/status~~ — **resolved above** (`state`, `birthEpoch`).
2. Has anyone claimed the AI flip-breaking prize? (Low value given the user count.)
3. Is `api.idena.io` run by the Idena core team as a single point of failure, and is running
   our own indexer node realistic? (Matters only if we integrate, which we should not.)
4. Did the *Between Zero and One* follow-up paper on sublinear identity staking ever publish?
   Nikulin announced it at ETHBerlin04 in 2024. If it did, it is the best available thinking on
   how to price a personhood credential against stake — directly relevant to our scorer.

---

# Cross-cutting: the vouching-correlation problem

Flagged by the Circles research agent and independently confirmed by everything above.

**PoH's vouch, BrightID's connections, Idena's invites, and Circles' trust edges are all the
same primitive: "someone already inside said I'm real."** They differ in UI and in cost, not in
epistemics. A naive aggregate that treats a user holding all four as having four independent
attestations of personhood is **wrong by roughly a factor of four** — it has one attestation,
observed four times, and the four observations share a failure mode:

- One cooperating insider can gate unlimited entries (PoH: `requiredNumberOfVouches() == 1`).
- The graph is buyable off-chain, and off-chain purchase leaves no on-chain trace.
- Ohlhaver & Nikulin's result generalises: the *humans* being vouched for can be real and the
  system still collapses, because unique humans are rentable at $2–10/head.

**Recommendation for the scorer:**
1. Put all vouching-derived credentials in **one evidence bucket** with a shared cap, rather
   than summing them.
2. Score **age and continuity**, not the boolean. PoH registration block, Idena consecutive
   epochs, BrightID connection date. Age is the one thing an airdrop farm cannot manufacture
   retroactively.
3. Treat **any protocol running a live reward program as compromised for the duration** of that
   program. PoH v2 is in exactly that state right now (984,300 PNK left, ~2 months of runway).
4. The independence that *does* hold is **between this whole family and biometric/document
   protocols.** That is real and is the reason to carry PoH at all: it fails in a completely
   different direction from a face scan or a passport chip.

---

## References

**Proof of Humanity**
- Contracts repo (v2): https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-contracts
- `IProofOfHumanity.sol`: https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-contracts/blob/master/contracts/interfaces/IProofOfHumanity.sol
- Mainnet/Gnosis address set: `scripts/consts/addresses/addresses-mainnets.ts` (same repo)
- v1 address constant: `scripts/consts.ts` → `POH_V1_Address = 0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb`
- Subgraph repo (chain configs, start blocks, Goldsky/Graph deploy names): https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-subgraph
- Web app subgraph wiring: https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-web/blob/master/src/config/subgraph.ts
- RewardDistributor: https://github.com/Proof-Of-Humanity/reward-distributor (contract `0x906113115C0A691F7E78dB91083EFfCD415Cb978` on Gnosis)
- Kleros PoH docs (secondary): https://docs.kleros.io/products/proof-of-humanity
- PoH v2 app: https://v2.proofofhumanity.id/ ; v1 landing: https://proofofhumanity.id/
- All counts, params and event sweeps above were read live from Gnosis
  (`https://rpc.gnosischain.com`), Ethereum (`https://eth.drpc.org`) and Blockscout
  (`https://gnosis.blockscout.com/api`, `https://eth.blockscout.com/api`) on **2026-07-24**.

**Kleros**
- PoH DAO governor attack write-up (secondary, self-reported): https://blog.kleros.io/how-kleros-prevented-more-than-100-000-from-being-stolen-from-proof-of-humanity-dao-a-detailed-analysis/
- KlerosLiquid Ethereum `0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069`; Gnosis `0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002` (read from PoH `arbitratorDataHistory`)
- PNK market data: CoinGecko `/api/v3/coins/kleros`, 2026-07-24

**Democracy Earth / fork drama / UBI**
- Clément Lesaege, "Making sense of recent drama in Proof of Humanity" (secondary, partisan): https://medium.com/@ClementLesaege/making-sense-of-recent-drama-in-proof-of-humanity-ccf3082eb0fa
- UBI market data: CoinGecko `/api/v3/coins/universal-basic-income`, 2026-07-24

**BrightID**
- Org: https://github.com/BrightID ; node: https://github.com/BrightID/BrightID-Node
- Docs: https://brightid.gitbook.io/brightid/ ; Bitu: https://brightid.gitbook.io/brightid/getting-verified/bitu-verification ; Meets: https://brightid.gitbook.io/brightid/verifications/meets-verification
- Aura proposal: https://forum.brightid.org/t/aura-a-new-verification-for-brightid/393 (forum currently 503)
- Live probes against `https://node.brightid.org/brightid/v6/*`, `https://aura-node.brightid.org/...`, `https://idchain.one/rpc/`, 2026-07-24

**Idena**
- Whitepaper / technology: https://docs.idena.io/docs/wp/technology
- Flip challenge: https://www.idena.io/flip-challenge ; FAQ: https://www.idena.io/faq
- Explorer: https://scan.idena.io/ ; public indexer API: https://api.idena.io/api/
- Ohlhaver & Nikulin, *Compressed to Zero: The Silent Strings of Proof of Personhood* (2024);
  ETHBerlin04 talk https://www.youtube.com/watch?v=-mwUQp2qwjk ; local transcript
  `/home/hugo/Projects/poh-aggregator/research/references/ohlhaver-ethberlin-2024-transcript.md`
- IDNA market data: CoinGecko `/api/v3/coins/idena`, 2026-07-24
