# Circles v2 — `stop()`, and a getter that answers about the caller

**Written 2026-07-25** against the live Circles v2 Hub on Gnosis,
`0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`, and its verified source (Blockscout,
`src/hub/Hub.sol`, solc `v0.8.24+commit.e11b9ed9`). Every number below was read the day it was
written; the calls are named so they can be re-run.

Companion to [poh-lapsed-credentials.md](poh-lapsed-credentials.md) and
[passport-and-linea-lapsed-credentials.md](passport-and-linea-lapsed-credentials.md), which asked
every adapter in the roster whether the chain dates the *end* of a credential. Circles was the last
one left, and the answer turned out to be that the question does not apply: **Circles has no
ending.** Asking it anyway surfaced a live defect in our own scoring and a permanent one in the
Hub.

---

## 0. Summary

| Claim | Status |
|---|---|
| `stop()` ends the credential | **False.** `isHuman` still returns `true`. |
| Circles can revoke a registration | **False.** `isHuman` is monotonic; nothing clears it, ever. |
| `stopped(address)` tells you whether that address stopped | **False.** It answers about `msg.sender`. |
| Our index was wrong about the two stopped avatars | **No** — the index was right and the contract's getter is wrong. |
| Our SDK read `stopped` as a revocation | **Yes, until iteration 20.** That is the bug this file records. |
| Number of `Stopped` events in the protocol's entire life | **2**, against ~317,000 register/trust events. |

---

## 1. What `stop()` actually does

`Hub.sol`, lines 443–458:

```solidity
/**
 * @notice Stop allows to stop future mints of personal Circles for this avatar.
 * Must be called by the avatar itself. This action is irreversible.
 */
function stop() external {
    if (!isHuman(msg.sender)) { revert CirclesErrorOneAddressArg(msg.sender, 0x02); }
    MintTime storage mintTime = mintTimes[msg.sender];
    if (mintTime.lastMintTime == INDEFINITE_FUTURE) { return; }   // already stopped
    mintTime.lastMintTime = INDEFINITE_FUTURE;
    emit Stopped(msg.sender);
}
```

`INDEFINITE_FUTURE` is `type(uint96).max` (`Circles.sol` line 45). And two lines matter more than
the function itself:

```solidity
function isHuman(address _human) public view returns (bool) {
    return mintTimes[_human].lastMintTime > 0;                     // Hub.sol:621
}
```

**`stop()` writes the largest possible value into the field the protocol's personhood predicate
reads as "greater than zero".** So a stopped avatar is, to the Hub, still a registered human. That
is not an accident of our reading — it is the only way the two functions can coexist, since
`lastMintTime` is doing double duty as *when you last minted* and *whether you exist*.

### 1.1 Irreversible, confirmed from the other side

The doc comment says irreversible. The code makes it so in three places:

- `_calculateIssuance` returns `(0, 0, 0)` when `lastMintTime == INDEFINITE_FUTURE`
  (`Circles.sol:93`), and `_claimIssuance` returns early on a zero issuance — so the one line that
  writes `lastMintTime = uint96(block.timestamp)` (`Circles.sol:148`) is unreachable for a stopped
  human.
- `_updateMintV1Status` writes `_max(mintTime.lastMintTime, uint96(block.timestamp))`, with the
  comment *"for last mint time take the maximum to avoid resetting `INDEFINITE_FUTURE` which
  indicates stopped status of the human"* (`Hub.sol:1142–1144`).
- There is no `delete` on `avatars` and no path anywhere that assigns `lastMintTime = 0` after
  registration.

**Therefore `isHuman` is monotonic and Circles has no revocation at all.** Every other registry in
this roster can take a credential away — PoH v2 revokes, World's term lapses, Verax attestations
expire, EAS attestations are revoked. Circles cannot. That is the fact the SDK now encodes.

---

## 2. The getter

`Hub.sol`, lines 465–473:

```solidity
function stopped(address _human) external view returns (bool) {
    if (!isHuman(_human)) {
        revert CirclesErrorOneAddressArg(_human, 0x03);
    }
    MintTime storage mintTime = mintTimes[msg.sender];   // <-- msg.sender, not _human
    return (mintTime.lastMintTime == INDEFINITE_FUTURE);
}
```

The parameter is validated and then discarded. The value returned is about the **caller**.

`mintTimes` is `internal` (`Circles.sol:54`), so this is the *only* getter over it, and the Hub is
not behind a proxy — the EIP-1967 implementation slot
(`0x360894…382bbc`) reads `0x00…00` and the bytecode verifies directly as `Hub`. **The defect is
permanent.**

### 2.1 Measured, three ways, at Gnosis head on 2026-07-25

`0xeb94174e…3bce0` and `0x4bfc7498…472c2` are the only two avatars that have ever called `stop()`
(§3). `0x42cedde5…cb37` is an ordinary live avatar.

| call | `from` | result | true answer |
|---|---|---|---|
| `stopped(0xeb94…)` | *(none — `0x0`)* | `false` | **true** |
| `stopped(0xeb94…)` | `0xeb94…` | `true` | true |
| `stopped(0x4bfc…)` | *(none)* | `false` | **true** |
| `stopped(0x4bfc…)` | `0x4bfc…` | `true` | true |
| `stopped(0x42ce…)` | `0x42ce…` | `false` | false |
| **`stopped(0x42ce…)`** | **`0xeb94…`** | **`true`** | **false** |

The last row is the one that admits no innocent explanation: an avatar that has never stopped is
reported stopped, because the address asking has. An ordinary `eth_call` sends no `from`, so
**`stopped()` returns `false` for every address anyone has ever asked about.**

Archive reads confirm it was never otherwise: `stopped(0xeb94…)` with no `from` is `false` at
blocks 40,615,923, 40,615,924 (the block the `Stopped` event was emitted in), 40,615,925 and
40,615,934. The endpoint used (`rpc.gnosischain.com`) is a real archive node — control:
`isHuman(0x4bfc…)` is `false` at 43,155,514 and `true` at 43,155,515, its registration block.

### 2.2 Why this matters beyond Circles

A cross-check of our index against the Hub's own getter would have "disproved" two real stops and
"confirmed" any number of stops that never happened, depending on which address happened to be in
`from`. It is the inverse of iteration 18's lesson — there, a getter declined to tell us something
the chain still had; here, a getter tells us something true about a **different subject** than the
one we asked about. Both return a plausible boolean.

---

## 3. The population

Topic-filtered `eth_getLogs` for `Stopped(address)`
(`0x55c4adf1f68f084b809304657594a92ba835ada8d3b5340955bf05746723c05b`) on the Hub, over
**36,486,014 → 47,389,543** — from the block the Hub's code first appears at (`eth_getCode` is
`0x` at 36,486,013) to head — in 200,000-block pages, 2026-07-25:

| avatar | block | date |
|---|---|---|
| `0xeb94174e82d6a070dcb0135b09270de4a3a3bce0` | 40,615,924 | 2025-06-16T15:11:25Z |
| `0x4bfc74983d6338d3395a00118546614bb78472c2` | 45,241,483 | 2026-03-20T05:27:05Z |

**Two, ever.** Against roughly 317,000 `RegisterHuman` + `Trust` events over the same range (iteration 17's measurement, recorded in `subgraph/subgraph.yaml`). Both
are registered humans at head (`isHuman` → `true`), both hold trust edges (126 and 5 incoming), and
both were dated from their own `RegisterHuman` by our index.

Two in the population is why these are hard-coded fixtures in the live suite rather than sampled:
no realistic sample finds them, and re-running the 55-page log scan inside a test is not a test.
Everything *about* them is re-derived each run: the transition against archive storage, the flag against `isHuman`, and the pair against what the index independently saw.

---

## 4. Reading it: storage, and a slot that checks itself

`mapping(address => MintTime) internal mintTimes` sits at **slot 21**, so the word is at
`keccak256(abi.encode(avatar, uint256(21)))`. `MintTime { address mintV1Status; uint96 lastMintTime }`
packs into one word, address in the low 20 bytes, `uint96` in the high 12.

The slot was **found, not counted off the inheritance chain**: scanning indices 0..59 against a
known-stopped avatar, a live one and an address the Hub has never seen gives exactly one index
whose three words are the sentinel, a plausible recent timestamp, and zero.

```
slot 21, 0xeb94…  0xffffffffffffffffffffffff0000000000000000000000000000000000000001
slot 21, 0x42ce…  0x00000000000000006a58a6500000000000000000000000000000000000000001
slot 21, 0x…dEaD  0x0000000000000000000000000000000000000000000000000000000000000000
```

(The low half is `0x01` = `CIRCLES_STOPPED_V1`, the sentinel for "this avatar's v1 token has been
stopped" — a different mechanism, and not what we read.)

### 4.1 The self-check, which is what makes a hard-coded slot safe here

Iteration 18 reached past a `private` mapping on PoH v2 and made the read safe by requiring the
record it found to name the subject as its owner. Circles gives something stronger for free:

> `isHuman(a)` **is** `mintTimes[a].lastMintTime > 0`.

So the contract publishes a getter over the exact word being decoded, and
`(decoded.lastMintTime > 0) === isHuman(a)` is a check the chain performs for us on every single
call. `readCirclesStopped` takes the `isHuman` result the probe already has — same batch, so the
two describe the same world — and returns `undefined` when they disagree. **A moved layout costs us
the stop flag and can never invent one.**

Census, 2026-07-25, 252 avatars taken from the index (250 most recent plus the two stopped ones):

- **252 / 252** satisfy `(lastMintTime > 0) === isHuman`.
- 4 of the 252 are *not* registered — trust-graph entries for addresses that were vouched for and
  never signed up — so the identity is exercised in both directions, not just on positives.
- Exactly **2** carry `lastMintTime == type(uint96).max`, and they are the two from the log scan.

---

## 5. The bug this found in our own code

`circlesIndexRead` mapped the index's `stopped` flag onto `IndexedCredential.ended`:

```ts
ended: Boolean(row.stopped),      // before
ended: false,                      // after
```

`ended` is the one field `reconcile.ts` cannot second-guess. On the ordinary path the chain decides
`held`, and `isHuman` says `true`, so a stopped avatar scored normally. But on the branch where the
contract read **fails**, `ended` *is* the answer (`reconcile.ts`, `if (index.entity.ended)` →
`held: false`). So the same subject was:

| Gnosis RPC | `held` |
|---|---|
| up | `true` |
| down | `false` |

Two answers about one subject, chosen by our own uptime. That is precisely the tear `reconcile.ts`
was written to remove — the file's own header calls index/chain disagreement "a torn read" and
argues that index lag must never move a score — reappearing in the one field the reconciler treats
as authoritative. It is also a **false negative**, the direction the mission's adapter checklist
singles out: "a network failure returning `held: false` would silently mean 'not a human'".

Nobody noticed because the failure needs a stopped avatar *and* a failed chain read, and there are
two stopped avatars in the world.

### 5.1 What replaced it

`stop()` is now reported beside the credential instead of instead of it:

- `detail.stopped` — from Hub storage, authoritative.
- `detail.stoppedIndexed` — only when the index's flag differs, which means index lag. Shown, not
  resolved.
- provenance note `credential-minting-stopped` → caveat `credential-minting-stopped`, which says
  the credential is held and counted and that the address may be one its human has walked away
  from. Stopping is, in practice, what you do before moving to a new address.

Nothing about the score at head changes, because `isHuman` already decided it. What changes is that
the fallback path now agrees with the head path, and that a fact the SDK was throwing away is
reported.

---

## 6. What is deliberately not done

**No `stoppedAt` in the subgraph, and no resync.** Iteration 19 proposed dating the stop, on the
model of every other adapter's dated ending. That was the right question and it has an answer: there
is no window to close, because there is no ending. Dating a `stop()` would produce a `heldUntil` for
a credential the protocol still honours, which is exactly the error §5 removes. The `Stopped` event
does date itself if it is ever wanted for a caveat — a mapping change plus a full resync — and the
transition is in any case recoverable from archive storage at one block's precision, which §5 of the
live suite demonstrates by reading slot 21 at `block − 1` and `block`.

**No weight change.** No forge cost, rent cost, root, curve or half-life moved. This changes what a
degraded read reports, not what a Circles registration is worth.

---

## 7. Open questions

1. **Is `stop()` a signal we should price?** It is voluntary, free and irreversible, and the
   plausible reading is "this human has moved to a new address". If both addresses were ever scored
   as one subject, they would saturate on `social-trust:circles` anyway, so the double-count is
   already handled. Whether an abandoned avatar's *trust edges* should still count is a live
   question — the answer probably depends on whether the trusters have since re-trusted the new
   address, which the index could answer. Not enough population to measure: n=2.
2. **Has anyone reported the getter upstream?** Not checked. It is not exploitable — `stopped()` is
   `view` and nothing in the Hub calls it internally — but any integrator using it is getting
   `false` unconditionally.

---

## 8. Re-running everything here

```bash
# the getter, three ways
cast call 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8 "stopped(address)(bool)" \
  0xeb94174e82d6a070dcb0135b09270de4a3a3bce0 --rpc-url https://rpc.gnosischain.com          # false
cast call 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8 "stopped(address)(bool)" \
  0xeb94174e82d6a070dcb0135b09270de4a3a3bce0 --from 0xeb94174e82d6a070dcb0135b09270de4a3a3bce0 \
  --rpc-url https://rpc.gnosischain.com                                                      # true

# the storage word
cast storage 0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8 \
  $(cast index address 0xeb94174e82d6a070dcb0135b09270de4a3a3bce0 21) \
  --rpc-url https://rpc.gnosischain.com    # 0xffffffffffffffffffffffff...01

# the whole thing, as tests
cd packages/sdk
node --test --experimental-strip-types src/adapters/circles.test.ts        # 9, no network
node --test --experimental-strip-types src/adapters/circles.live.test.ts   # 9, live Gnosis
```

Foundry is not installed on the build box; the numbers above were taken with raw `eth_call` /
`eth_getStorageAt` over JSON-RPC and the `cast` forms are given as the readable equivalent.
