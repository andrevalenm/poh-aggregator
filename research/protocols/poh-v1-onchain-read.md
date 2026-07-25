# Proof of Humanity v1 — reading a frozen registry, and what is actually left in it

*Written 2026-07-25 while implementing `packages/sdk/src/adapters/poh-v1.ts`. Every address,
selector, count, timestamp and revert below came from a call made from this box on that date.
Where a fact came from source rather than from the chain, the source is named and it was fetched
from Sourcify, not recalled. This file extends the "Proof of Humanity (v1 / v2)" section of
`poh-kleros-brightid-idena.md`, which established the address and the `isRegistered` selector and
left the population `UNVERIFIED`.*

---

## 1. What was already known, and the question it left open

`poh-kleros-brightid-idena.md` recorded, in June and again in July 2026:

> **Legacy v1** `0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb` still answers views
> (`submissionCounter()` = 20,740) and still has `isRegistered(address)` (selector `0xc3c5a547`).
> […] `UNVERIFIED:` how many v1 submissions are *currently* valid (v1 registrations also expire;
> most 2021-era entries have long lapsed). Next step: sweep v1 `isRegistered` over the submission
> list, or use the `proof-of-humanity-mainnet` subgraph.

Both halves of that next step turn out to be unavailable and neither is needed.

- **There is no submission list.** `submissionList(uint256)` (`0xe7b692ef`) **reverts** — checked
  by direct `eth_call`, not inferred from a bytecode scan, because the scan is unreliable here:
  it also missed `challengePeriodDuration()` (`0x0082a36d`), which answers `0x49d40` = 302,400 s.
  The registry keys submissions by address and exposes no index→address mapping.
- **The subgraph needs a key.** The production endpoints are Graph gateway URLs read from env vars
  in the PoH web app, so they are not public. Putting them on the critical path is the thing
  `packages/sdk/src/adapters/index.ts` exists not to do.

The answer came instead from the registry's own log history plus one `isRegistered` each, which
is the same shape as the Linea PoH enumeration and reaches the same kind of conclusion.

**The live population of Proof of Humanity v1 is 2 addresses, out of 20,740 lifetime submissions.**

---

## 2. The mechanism: `isRegistered` is a comparison and the struct's flag is not

Verified source, retrieved from Sourcify (`sourcify.dev/server/v2/contract/1/0xC5E9dDeb…`),
`ProofOfHumanity.sol`, 1,423 lines:

```solidity
function isRegistered(address _submissionID) external view returns (bool) {
    Submission storage submission = submissions[_submissionID];
    return submission.registered && now - submission.submissionTime <= submissionDuration;
}
```

`submission.registered` is set by `executeRequest` (L972), by `rule` when the requester wins a
dispute (L1208) and by `addSubmissionManually` (L531). It is cleared only by
`removeSubmissionManually`, by a successful removal request, or by losing a challenge. **Expiry
does not clear it.** So the registry keeps a boolean that says "registered" for years after the
credential it describes has stopped being honoured — and that boolean is exactly what
`getSubmissionInfo` returns as its fourth field, which is the natural thing for an integrator to
read.

Measured: of **215** addresses that made a submission request after block 19,000,000, **33 have
`registered == true` and `isRegistered() == false`.** An adapter built on the struct field would
have counted every one of them as a verified human.

### 2.1 The boundary, proven against history to the second

Submission `0xfc3e23d42cef14bd7f2c6709694d315578143563`, `submissionTime` **1,642,619,590**
(2022-01-19), term 63,115,200 → expiry **1,705,734,790** (2024-01-20T07:13:10Z):

| Block | Header timestamp | `isRegistered` |
|---|---|---|
| 19,046,504 | 1,705,734,779 (expiry − 11 s) | **true** |
| 19,046,505 | 1,705,734,791 (expiry + 1 s) | **false** |
| head | 2026-07-25 | false |

`eth_getLogs` on the registry across those two blocks returns **zero** logs: nothing was written,
nobody transacted, the answer changed because time passed. That is the acceptance test the live
suite runs on a freshly sampled lapsed submission every time it is invoked.

### 2.2 The term has moved, so it is read and never pinned

| Parameter | Value 2026-07-25 | Note |
|---|---|---|
| `submissionDuration()` | 63,115,200 s = **730.5 days** | was **31,557,600** (365.25 d) at block 12,012,815 |
| `renewalPeriodDuration()` | 7,889,400 s = 91.3 days | renewal window opens 91 days before expiry |
| `challengePeriodDuration()` | 302,400 s = 3.5 days | |
| `requiredNumberOfVouches()` | **1** | one vouch from an existing registered human |
| `submissionBaseDeposit()` | 0.1 ETH | |
| `submissionCounter()` | **20,740** | cumulative; never decremented |
| `governor()` | `0x327a29fcE0a6490E4236240Be176dAA282EcCfdF` | |

`changeDurations(uint64,uint64,uint64)` (`0x26bafe5f`) is governor-only and has been used: the
term doubled at some point between 2021-03 and today. The probe therefore never recomputes the
comparison — it calls `isRegistered` and lets the contract apply whatever term is current, and
reads `submissionDuration()` only to *report* the expiry.

**A hard term truncates a ramp exactly as it truncates a decay.** `docs/scoring.md` records the
decay version (Passport 90 d against a 180 d half-life, Holonym 365 against 730, World 168 against
365, Linea 90 against 90). PoH v1 is the ramp version: a registration can be at most 730.5 days
old before it stops being one, so on a 365-day ramp its weight can never exceed
`1 − 2^(−730.5/365)` = **0.7500**, however long the human survives. The live suite asserts it.

---

## 3. The ForkModule: PoH v2 retires v1 registrations that v1 goes on honouring

v2 cannot write to the frozen v1 contract, so it keeps an overlay.

| Contract | Address |
|---|---|
| `ForkModule` (proxy) | `0x068a27Db9c3B8595D03be263d52c813cb2C99cCB` |
| `ForkModule` implementation | `0xfd6a2edaeef62e9cd828053fdd0d944ff04a4f66` |
| PoH v2 mainnet (proxy) | `0xbE9834097A4E97689d9B667441acafb456D0480A` |

Verified source, `contracts/extending-old/ForkModule.sol`. Its whole state is
`initialized`, `proofOfHumanityV1`, `proofOfHumanityV2`, `submissionDuration`, `forkTime`, and
`mapping(address => bool) removed`. Read live: `proofOfHumanityV1()` is the v1 registry,
`proofOfHumanityV2()` is the v2 mainnet proxy, `forkTime()` = **1,725,548,159** (2024-09-05),
`submissionDuration()` = 63,115,200 — a snapshot taken at initialisation, currently equal to v1's.

`removed[x]` is set by two paths, both `onlyV2`:

- `tryRemove` — the migration path, called when a v1 submission is claimed or transferred into v2.
  It requires `registered && block.timestamp < expirationTime && submissionTime < forkTime`.
- `remove` — "called when removing as result of finalized revocation request or bad vouching",
  per the contract's own comment. Unconditional.

So a set flag means the PoH ecosystem has stopped honouring that v1 registration, whether because
the human moved it to v2 or because v2's arbitration took it away. **The v1 contract keeps
answering `true` regardless, until its term runs out.**

Measured by sweeping `removed` over all 20,682 addresses that ever emitted a submission event:
**9 are set.** Three retirement blocks were located by bisecting the flag over history:

| Address | Retired at | v1 term ran until | Window where v1 said yes and v2 said no |
|---|---|---|---|
| `0x6687c671…8dd6` | block 20,692,434, 2024-09-06 | 2026-01-29 | **510 days** |
| `0xe7f13052…79bc` | block 20,695,335, 2024-09-07 | 2025-07-24 | 320 days |
| `0xfa148900…689f` | block 24,571,170, 2026-03-02 | 2026-03-26 | 24 days |

All nine have since expired on v1 as well, so today the flag changes no answer. The windows above
are why the probe reads it anyway: they were real, they lasted more than a year in one case, and
nothing about the design prevents another.

`held` is therefore **`v1.isRegistered(subject) && !ForkModule.removed(subject)`**.

### 3.1 Why not `ForkModule.isRegistered`

The module has its own `isRegistered`, which is the same two conditions plus
`submissionTime < forkTime`. That third condition is **v2's migration policy** — "this
registration is old enough to be brought across" — and not a statement about whether a v1
credential exists. It is not a hypothetical distinction: both registrations alive today were made
*after* the fork (2024-09-07 and 2024-10-25 against a fork at 2024-09-05), so
`ForkModule.isRegistered` returns **false for the entire live population**. Adopting it would have
produced an adapter that answers `false` for everybody while appearing to work perfectly — the
same failure mode iteration 6 hit with the wrong Linea portal, arrived at from a different
direction.

---

## 4. Enumerating what is left, from the chain alone

The registry emits `AddSubmission(address indexed, uint256)`
(`0x803727a6…6b19`) on every registration request and
`ReapplySubmission(address indexed, uint256)` (`0xf6cfccc8…990e`) on every renewal request.

**The scan has to be the full history, and the first version of this section got that wrong.**
The tempting shortcut is that a live registration must have been *accepted* within the term, so
scanning the term plus a few months of slack should suffice. It does not, because the gap between
a request and its acceptance is unbounded: `addSubmission` starts a `Vouching` phase that ends
only when somebody vouches and the deposit is funded, and `executeRequest` can then be called by
anyone, at any time. `0xb2db7c3b4c0d901fe1c51895ceb5c631eb3667e7` — one of the two survivors, with
exactly **one** request in its life — emitted `AddSubmission` at block 15,611,027
(**2022-09-25**) and has `submissionTime` **1,729,851,479** (**2024-10-25**): **761 days**
between the two. A window-bounded scan misses it and reports a population of 1 while looking
exhaustive. The live suite asserts this gap, because it is the reason the method is what it is.

Full history, deployment → head, in 25,000-block chunks:

| | Events | Distinct addresses |
|---|---|---|
| `AddSubmission` | 22,038 | **20,677** |
| `ReapplySubmission` | 239 | 227 |
| Union | 22,277 | **20,682** |

**No truncation.** Free endpoints silently drop logs rather than erroring on oversized queries
(iteration 7 measured that on Tenderly's World Chain gateway), so the densest chunk —
12,325,000–12,349,999, 528 logs — was re-queried in halves: 293 + 235 = 528.

### 4.1 The 63 submissions that emit nothing

`submissionCounter()` is 20,740 and the distinct `AddSubmission` emitters number 20,677. The gap
is **63**, and it is not a scanning failure: `addSubmissionManually` increments the counter,
writes `registered = true` and `submissionTime = now`, and **emits no `AddSubmission` at all** —
only an `Evidence` event, and only when the evidence string is non-empty. Sampling
`submissionCounter` against the cumulative distinct-emitter count locates it exactly:

| Block | Date | `submissionCounter` | distinct `AddSubmission` emitters |
|---|---|---|---|
| 12,012,814 | 2021-03-10 | 0 | 0 |
| 12,012,815 | 2021-03-10 | 1 | 1 |
| 12,023,878 | 2021-03-12 | 59 | 1 |
| 12,023,879 | 2021-03-12 | 63 | 1 |
| 12,500,000 → head | 2021-05 → 2026-07 | 20,740 | 20,677 (gap constant at 63) |

This is the same shape as the Farcaster import (iteration 4): a registry populated by an admin in
bulk, invisible to the event that documents ordinary entry. It does not weaken the population
claim, and the reason is arithmetic rather than assumption: those 63 are dated 2021-03-12, so they
expired in 2022-03 under the then-365-day term and would have expired in 2023-03 under today's,
and any of them that renewed would have emitted `ReapplySubmission` and be in the union above.

### 4.2 The result

`isRegistered` over all 20,682, at block **25,610,404**:

| | |
|---|---|
| Lifetime submissions | **20,740** |
| Currently registered | **2** |
| Retired by PoH v2 (`ForkModule.removed`) | 9 |

| Address | `submissionTime` | Requests | Expires |
|---|---|---|---|
| `0xb2db7c3b4c0d901fe1c51895ceb5c631eb3667e7` | 1,729,851,479 (2024-10-25) | 1 | 2026-11-16 |
| `0x8c01046e92ced6d5f6b26929e270381310cc2fa0` | 1,725,684,719 (2024-09-07) | 1 | 2026-09-07 |

Neither is registered on PoH v2, on Gnosis or on mainnet. Both post-date the fork, so v2 will
never accept them. When they expire in late 2026 the registry holds nobody, and — since
`addSubmission` still works and still costs 0.1 ETH plus arbitration — it holds nobody until
somebody chooses to register into a superseded protocol.

For contrast, PoH v2 mainnet has `getHumanityCount()` = **55**, and PoH v2 on Gnosis had 2,606 at
the last count in `poh-kleros-brightid-idena.md`. The v1→v2 migration moved **9** registrations.
20,740 lifetime submissions did not become a v2 population; they lapsed.

`live: true` on this adapter therefore means *the contract works*, not *the protocol has users*,
and the ontology note says exactly that. Scoring it is still correct — one of those two people
asking to be scored deserves the credential they hold — and pretending the population is 20,740
would not be.

---

## 5. Dating a registration when nothing is emitted

`submissionTime` is written by `executeRequest` (L972), by `rule` (L1208) and by
`addSubmissionManually` (L532). **None of those emits an event** — `executeRequest` delegates to
`processVouches`, which only flips storage flags and emits nothing either — so the date cannot be
cross-checked against a log index the way World's and Farcaster's could. It can be cross-checked
against historical state: bisect `getSubmissionInfo(x).submissionTime` for the first block at
which it holds its current value, and require that block's header to carry exactly that timestamp.
Two subsystems — the state trie's history and the block header — where the probe consults only
the current value of the first. That is a live test.

`executeRequest` rewrites the field on **every** accepted request, so a renewal resets the age.
On this adapter's `Ramp` that understates survival, which is a weight floor and never an
inflation, and it is reported through the `date-from-latest-reattestation` provenance note
whenever `numberOfRequests > 1` — the same note World uses for the opposite curve, since the
question it answers ("is this the enrolment or the last renewal?") is the same one.

---

## 6. Endpoints — Ethereum mainnet, keyless, 2026-07-25

The probe reads at a pinned recent block and needs no archive access; the *live suite* needs
archive `eth_call` and wide `eth_getLogs`, which is the scarcer resource.

| Endpoint | head | archive `eth_call` | `eth_getLogs` |
|---|---|---|---|
| `gateway.tenderly.co/public/mainnet` | ✔ | ✔ | ✔ (1 M blocks; rate-limits on bursts) |
| `mainnet.gateway.tenderly.co` | ✔ | ✔ | ✔ |
| `rpc.mevblocker.io` | ✔ | ✔ | ✔ |
| `eth.drpc.org` | ✔ | ✔ | ≤ 10,000 blocks on the free plan |
| `ethereum-rpc.publicnode.com` | ✔ | ✖ "Archive requests require a personal token" | ✖ same |
| `eth.merkle.io` | ✔ | ✔ | ✖ "Method not found" |
| `rpc.flashbots.net` | ✔ | ✖ "rpc method is not whitelisted" | ≤ 100,000 blocks |
| `eth-mainnet.public.blastapi.io` | ✔ | ✔ | ≤ **10** blocks |
| `eth-pokt.nodies.app` | ✔ | ✔ | ≤ 250 blocks |
| `eth.api.onfinality.io/public`, `0xrpc.io/eth`, `virginia.rpc.blxrbdn.com` | ✔ | ✖ "historical state …" | mixed |
| `rpc.eth.gateway.fm` | ✔ | ✖ "old data not available due to pruning" | ✖ |
| `cloudflare-eth.com` | ✖ "Cannot fulfill request" | — | — |
| `rpc.ankr.com/eth`, `1rpc.io/eth` | ✖ key required | — | — |
| `eth.llamarpc.com` | ✖ serves HTML | — | — |

The adapter ships the four that answer at head, in a viem `fallback`: a node behind the pinned
block errors, which is precisely what the fallback is for.

---

## 7. Reads performed for this file

All from this box, 2026-07-25, no API key anywhere:

- `submissionCounter`, `submissionDuration`, `renewalPeriodDuration`, `challengePeriodDuration`,
  `requiredNumberOfVouches`, `submissionBaseDeposit`, `governor` on the v1 registry at head; the
  first two also at block 12,012,815 and across a ladder of eleven historical heights.
- `eth_getCode` on the v1 registry (23,103 bytes), on the ForkModule proxy and on the v2 mainnet
  proxy (1,159 bytes each — identical ERC-1967 minimal proxies), plus `eth_getStorageAt` on the
  EIP-1967 implementation slot of both proxies.
- Verified sources from Sourcify for the v1 registry and the ForkModule implementation.
- Full-history `eth_getLogs` for `AddSubmission` and `ReapplySubmission`, deployment → head, in
  25,000-block chunks, with the densest chunk re-queried in halves as a truncation check.
- `isRegistered` on all 20,682 event-visible submissions at block 25,610,404, via Multicall3
  (`0xcA11bde05977b3631167028862bE2a173976CA11`) in batches of 150.
- `getSubmissionInfo` and `ForkModule.removed` on the survivors and on a 215-address recent
  sample; `ForkModule.removed` on all 20,682; a bisection of that flag over history for three of
  the nine it is set on.
- `isRegistered` at blocks 19,046,504 and 19,046,505, and `eth_getLogs` across them.
- `isHuman` and `humanityOf` on PoH v2 (Gnosis `0xa4AC94C4…57bc`, mainnet `0xbE983409…480A`) for
  the survivors and for the retired fixture.

---

## 8. Open questions

1. **When did `changeDurations` fire, and what were the intermediate values?** The term was
   365.25 days at block 12,012,815 and is 730.5 days now. Locating the change would let us say
   which cohorts were scored against which term; it does not affect any answer today, because the
   probe never applies a term itself. Cheap to close: bisect `submissionDuration()` over history.
2. **What are the six unmatched `PUSH4` constants in the v1 bytecode?** `0x093225f1`,
   `0x1c3db16d`, `0x2e848506`, `0x49912f88`, `0x76390dc6`, `0x791f8b73`, `0xafe15cfb`,
   `0xb4dfe93d`, `0xc13517e1`, `0xdeb8f707`, `0xf23f16e6`, `0xf7434ea9` all revert on a bare
   call. Given the verified source is in hand this is curiosity rather than risk, and
   `challengePeriodDuration` proved the scan under-reports rather than over-reports.
3. **Who are the 63?** They were added by the governor on 2021-03-12 and are invisible to the
   event log. Their addresses could be recovered from the `addSubmissionManually` calldata in the
   governor's transactions of that day. It cannot change the population figure — the arithmetic in
   §4.1 covers them either way — but it would make the enumeration exhaustive rather than
   exhaustive-modulo-an-argument.
