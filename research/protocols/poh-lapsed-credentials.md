# Proof of Humanity — the credential that ended, and whether the chain dates the ending

*Written 2026-07-25 while implementing the closed-window path in `packages/sdk/src/adapters/index.ts`
(v2) and `packages/sdk/src/adapters/poh-v1.ts` (v1). Every count, slot, timestamp and delta below
came from a call made from this box on that date, against Gnosis (`rpc.gnosischain.com`) and
Ethereum mainnet (`gateway.tenderly.co/public/mainnet`). Source lines are quoted from
`Proof-Of-Humanity/proof-of-humanity-v2-contracts@master/contracts/ProofOfHumanity.sol`, fetched
here rather than recalled. Extends `poh-v1-onchain-read.md` and the PoH sections of
`poh-kleros-brightid-idena.md`.*

---

## 1. The question

`as-of` scoring reads every credential at chain head and then corrects it to a past instant. One
correction was already exact — a credential *dated after* the instant did not exist then and is
dropped. The other direction, a credential held then and lost since, needs both ends of a window:
an exact issuance date and a dated ending. Iteration 16 built the mechanism and wired the two
registries that obviously had one (EAS revocations on Base, `WorldIDAddressBook`'s lapsed term).

The question this file answers is whether Proof of Humanity has one, on either of its two
registries, and the answer is yes on both — for the same reason it was yes for World. **Neither
contract deletes the ending.** The generalisation is worth stating before the detail: *when history
is the problem, ask what the contract declines to delete.*

The rule that governs every decision below is iteration 16's, and it killed the Holonym candidate:
a dated ending is not enough; **the credential must still be attributable to the subject at the
moment you restore it**.

---

## 2. PoH v2 (Gnosis) — an expired humanity is still in storage, and still names its owner

### 2.1 What the contract does on expiry: nothing

`ProofOfHumanity.sol` applies the expiry comparison on the way *out*, in the getters, and never
writes anything when a term runs out:

```solidity
function isHuman(address _account) public view override returns (bool) {
    Humanity storage humanity = humanityData[accountHumanity[_account]];
    return humanity.owner == _account && block.timestamp < humanity.expirationTime;
}
function boundTo(bytes20 _humanityId) external view override returns (address) {
    return block.timestamp < humanity.expirationTime ? humanity.owner : address(0x0);
}
function humanityOf(address _account) external view override returns (bytes20 humanityId) {
    humanityId = accountHumanity[_account];
    if (humanity.owner != _account || humanity.expirationTime < block.timestamp) humanityId = bytes20(0x0);
}
```

`getHumanityInfo(bytes20)` applies **no** comparison: it returns the raw struct. So for an expired
humanity `owner` and `expirationTime` are both still readable at head, while all three of the
"is this a human" getters have gone quiet. That asymmetry is the whole mechanism.

Confirmed on five lapsed subjects (2026-07-25, Gnosis block 47,388,675):

| address | `isHuman` | `humanityOf` | `boundTo(id)` | `getHumanityInfo(id).owner` | `expirationTime` |
|---|---|---|---|---|---|
| `0xce0d183b…00e6` | false | `0x00…00` | `0x00…00` | `0xCE0D183b…00E6` | 1760624340 |
| `0x85c6737a…6410` | false | `0x00…00` | `0x00…00` | `0x85C6737a…6410` | 1760988790 |
| `0x41cd6228…c5e7` | false | `0x00…00` | `0x00…00` | `0x41cD6228…c5e7` | 1761089670 |
| `0x3b6efd21…fd8a` | false | `0x00…00` | `0x00…00` | `0x3B6eFd21…fD8a` | 1742309195 |
| `0x6687c671…8dd6` | false | `0x00…00` | `0x00…00` | `0x6687C671…8dd6` | 1769699447 |

### 2.2 The link back to the humanity is private, and `private` is not a chain concept

`getHumanityInfo` is keyed by humanity id, and the id is *chosen by the claimer*:
`claimHumanity(bytes20 _humanityId, …)` takes it as an argument. So a subject-keyed read needs
`accountHumanity`, which is declared

```solidity
/// @dev Maps the address to the humanityId. […] accountHumanity[address].
mapping(address => bytes20) private accountHumanity;
```

`private` restricts other *contracts*, not `eth_getStorageAt`. The mapping is at
`keccak256(pad32(account) ++ pad32(slot))` like any other, and the slot index was **found rather
than assumed**: scanning indices 0..119 for a live subject and comparing each word against what
`humanityOf` returns gives exactly one hit, **slot 62**. Verified against all 21 lapsed subjects
(21/21 agree with the humanity id the record is filed under) and re-derived by the live suite on
every run.

Two properties make this safe to depend on:

- **A wrong slot cannot invent a credential.** Whatever comes back is used only to look up
  `getHumanityInfo`, and nothing is reported unless that record's `owner` **is the subject**. A
  proxy upgrade that moves the layout costs us the window; it cannot fabricate one.
- **The convention is a fallback, not the mechanism.** Every humanity in the sampled population is
  filed under its owner's own address, so `bytes20(subject)` finds the same record — but 3 of 1,569
  indexed humanities have an `owner` that is *not* the id, so the convention is not a rule and is
  used only when the storage read comes back empty.

### 2.3 The census: which endings are dated, and which are not

All 1,569 humanities the protocol subgraph holds, each read through `getHumanityInfo` at Gnosis
block 47,388,718 (2026-07-25):

| state | count | restorable? |
|---|---:|---|
| live (`expirationTime` in the future) | 1,352 | n/a — held today |
| **lapsed, still owned by the subject** | **21** | **yes — both ends dated** |
| `owner` cleared | 196 | **no** — the ending is undated |
| owner is an address other than the id | 3 | (orthogonal; the owner check still decides) |

The 196 are the honest limit. `delete humanity.owner` happens on a successful revocation
(`ProofOfHumanity.sol` L1170, L1347) and on a cross-chain transfer out (L552,
`HumanityDischargedDirectly`), and neither leaves a timestamp in storage. The credential may have
ended years before its expiry, so its expiry is not the end of anything provable, and the SDK
reports no window at all rather than the wrong one.

### 2.4 The start: `expirationTime - humanityLifespan()`, and the two subjects it is wrong for

Claim and renewal resolution both write

```solidity
humanity.owner = request.requester;
humanity.expirationTime = uint40(block.timestamp).addCap40(humanityLifespan);
```

so the subtraction recovers the second the claim was accepted. Measured against the index's
independently observed `claimedAt` over all 21 lapsed humanities:

- **19 agree to the second.** (Also checked from a third direction in the live suite: the block
  the humanity's own `HumanityClaimed` log sits in has exactly that timestamp — e.g.
  `0xce0d183b…00e6`, claim log at Gnosis block 36,531,197, header timestamp **1729066740**, equal
  to `1760624340 − 31557600`.)
- **2 disagree, by −215.5 and +144.7 days.** Both are the entire `nbRequests == 0` population.

`nbRequests` is `humanity.requests.length`, and the only path that writes `expirationTime` without
pushing a request is `grantHumanityDirectly` (L505-521), the cross-chain instance's entry point,
which copies an expiry settled on another chain. So **`nbRequests == 0` is an exact discriminator
for "this contract did not derive this expiry"**, and it is precisely the two subjects the
derivation misses. The +144.7 case is the dangerous direction — a start *later* than the truth
would have handed a subject a window they did not hold — so those get `heldUntil` and no start,
and `as-of` lists them in `ceasedStartUndated` rather than restoring them.

The residual, stated rather than hidden: `nbRequests >= 1` proves this contract resolved *a*
request, not that the last write to `expirationTime` was that resolution — a humanity transferred
out and back would be granted directly over an existing request history. What bounds the damage is
that both live instances run the same term: `humanityLifespan()` is **31,557,600 s on Gnosis and
31,557,600 s on mainnet** (`0xbE9834097A4E97689d9B667441acafb456D0480A`), and
`renewalPeriodDuration()` is 7,889,400 on both, read 2026-07-25. If those ever diverge, this is the
assumption that breaks.

Floor: a derived start below **1,725,548,320** (the timestamp of Gnosis block 35,846,827, where the
proxy's code first appears — 161 seconds after `POH_V1_FORK_TIME`) is rejected as evidence that
`humanityLifespan` is not the term the expiry was written under.

---

## 3. PoH v1 (mainnet) — the flag that outlives the credential also dates its death

`poh-v1-onchain-read.md` §2 established the defect: `submission.registered` is **never cleared on
expiry**, so 33 of 215 sampled addresses have it set with the credential dead, and reading it as
the answer counts them as humans. Read the other way round, the same fact is the mechanism:

> `registered && !isRegistered()` says the credential ended **by arithmetic and nothing else**.

Nothing was written, nobody acted; the term ran out. Both ends are therefore still in the registry:
`submissionTime` and `submissionTime + submissionDuration()`. The SDK reports them as `issuedAt`
and `heldUntil` with `held: false`.

The two ways it stays open are the informative ones, and both are refusals:

- **`ForkModule.removed(subject)`** — PoH v2 retired the registration. The overlay is a bare
  boolean with no timestamp, and `poh-v1-onchain-read.md` §3 measured one registration v1 went on
  honouring for **510 days** after v2 retired it. The credential may have died anywhere in that
  gap, so no window is reported.
- **`registered == false` with a `submissionTime` behind it** — a governor removal or a lost
  revocation request. Again undated.

### 3.1 The term the window is computed from has moved exactly once

`submissionDuration()` is governance-settable, so a change moves every window this adapter
reports, including retroactively. Bisected over archive state (`gateway.tenderly.co/public/mainnet`
serves it; `ethereum-rpc.publicnode.com` refuses):

| block | `submissionDuration()` |
|---|---|
| 12,012,815 (first submission) | 31,557,600 (365.25 d) |
| 14,330,754 | 31,557,600 |
| **14,330,755** (ts **1,646,535,074**, 2022-03-06T02:51:14Z) | **63,115,200** (730.5 d) |
| head (25.6 M) | 63,115,200 |

Every as-of instant this SDK can be asked about is at or after the registry's own genesis block
(Sepolia 11,344,158, 2026-07-25), four years the other side of that change, so today's term is the
term that governed every window we can be asked to decide. A live test pins all three readings, so
the day that stops being true is a red suite rather than a silent shift.

### 3.2 Verified against the registry's own answer, on both sides of both ends

For a lapsed submission sampled out of the registry's request history at run time, archive
`isRegistered(subject)` is read at four blocks: `false` immediately before the reported start,
`true` at it, `true` immediately before the reported end, `false` at it. The window we hand back is
the window the contract itself honoured — not an interval derived from it.

---

## 4. What this changes, and what it does not

- **No score moves today.** `held` stays false for every credential discussed here, and
  `effectiveCostCents` is zero for anything not held. The window is consumed only by
  `resolve(addr, { asOf })`.
- **The safety property is unchanged and asserted.** `heldUntil` may only be set by a probe that
  *read* an ending. An ordinary absence, an address that never registered, and a failed probe all
  reach the same branch and none of them acquires a window — unit tests hold each of those in
  place, and the live suite checks the dead-address case against the chain.
- **Restoring still requires an exact start.** `issuedAfter` — a lower bound — never restores
  anything, which is what excludes the two cross-chain-granted humanities.
- **Circles is still open, and for a documented reason.** The Hub's `stopped()` is a boolean with
  no timestamp, exactly like `ForkModule.removed`, so a stopped avatar's ending cannot be dated
  from state. The subgraph *could* record the block a `Stopped` event was seen in, which would
  close it — that is a mapping change and a resync, and it is the obvious next candidate.

---

## 5. Reproducing the numbers

```bash
# the census (needs the protocol subgraph for the humanity ids, chain for everything else)
cd packages/sdk && node --test --experimental-strip-types src/live.test.ts   # tests 6-8 of the last suite
node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts      # tests 3-4
```

Both suites source their subjects from the chain or the index at run time and assert the
mechanism, so neither carries an address that can go stale into a false pass.
