# World ID — which of the AddressBook's terms wrote a `verifiedUntil`

**Researched 2026-07-26.** Sources: the verified source of `WorldIDAddressBook`
`0x57b930D551e677CC36e2fA036Ae2fe8FdaE0330D` on World Chain, fetched from the Blockscout instance at
`worldchain-mainnet.explorer.alchemy.com` (`getsourcecode`, `IsProxy: "false"`, compiler settings
`optimizer.runs 1000000`, author Miguel Piedrafita); creation tx
`0x974e70f125abe3b6abaa0b3fb9cb067c09cee359b08fa847487d6623377308fd` at block 2,711,105
(2024-08-27T11:24:09Z). Log sweeps and state reads ran against
`worldchain-mainnet.gateway.tenderly.co` and `worldchain-mainnet.g.alchemy.com/public` on
2026-07-26 at head 32,843,977.

Answers open question 2 of [poh-lifespan-timeline.md](poh-lifespan-timeline.md), which asked whether
the other adapters that subtract a term have the same unchecked premise, and whether the protocols
publish their changes. World does have it, and World does publish.

---

## 1. The premise

Every World ID date this package produces is one subtraction:

```
issuedAt = addressVerifiedUntil[account] − verificationLength()
```

[world-id-onchain-read.md](world-id-onchain-read.md) §2.2 established that this is *exact* — not an
estimate, not a bound — because `verify()` writes

```solidity
addressVerifiedUntil[account] = block.timestamp + verificationLength;
```

and confirmed it to the second against 24 block headers spanning 2025-04-18 to 2026-07-25.

The premise nobody stated is that `verificationLength()` **read at head** is the term the entry was
written under. The entry was written at some block in the past. Those are the same number only if
the field has not moved in between — and it is a mutable owner-controlled field:

```solidity
// WorldIDAddressBook.sol, L473-482 of the verified source
/// @notice Update the verificationLength
/// @param _verificationLength The new verificationLength
function setVerificationLength(
    uint256 _verificationLength
) external onlyOwner {
    if (_verificationLength == 0) revert InvalidConfiguration();

    verificationLength = _verificationLength;
    emit VerificationLengthUpdated(verificationLength);
}
```

Not one stored `addressVerifiedUntil` is touched. So a single owner transaction moves **every**
derived date in the book at once, in the same direction, by the full size of the change — and
`world-id-orb` is a `Decay` curve, so a shortened term makes the whole registry look uniformly
fresher than it is. That is the direction that pays an adversary.

### 1.1 The owner cannot give the power up

```solidity
// L493-496
/// @notice Prevent the owner from renouncing ownership
function renounceOwnership() public view override onlyOwner {
    revert CannotRenounceOwnership();
}
```

`WorldIDAddressBook` is `Ownable2Step` with `renounceOwnership` overridden to revert. Owner at head
is `0xc50b688Ec147fA0E93f7Bf5Ca5e4fcefe9E74062`. The field is therefore settable for as long as the
contract exists; there is no future state in which the premise becomes safe by itself.

---

## 2. What was there before, and why it was the wrong instrument

Two checks already guarded this, and both are real:

- The probe refused a derived date landing before the contract's deployment or after the block it
  read at. That is a plausibility guard on the *result*.
- The live suite asserted `verificationLength()` still equalled the term
  `WorldIDAddressBookInitialized` announced. That is a tripwire on the *cause*.

Neither can repair anything. The day the owner calls `setVerificationLength`, the assertion goes red
and every World date in the registry becomes unusable at once — the plausibility guard will still
accept most of them, because a term change of a few weeks moves a date by a few weeks and lands it
comfortably inside the contract's lifetime. The only remedy the tripwire offers is a human editing a
new constant into the repo.

This is the same shape as [poh-lifespan-timeline.md](poh-lifespan-timeline.md) §2: **when the queue
asks for a tripwire, check whether the event it watches is one the chain publishes.** Here it is.
The alarm and the repair are the same read, and the read costs the same either way.

---

## 3. The sweep — 2026-07-26, and the answer is zero

`setVerificationLength` is the only writer of the field after the constructor, and it emits. The
constructor emits too. So a complete history of the term is a sweep of two topics.

Full range, block 2,711,105 → 32,843,977, filtered to all five of the contract's governance events:

| Block | Date | Event |
|---|---|---|
| 2,711,105 | 2024-08-27 | `WorldIDAddressBookInitialized(router 0x17B354dD…, groupId 1, externalNullifierHash 0x00d5b5db…5864d, verificationLength 14515200, maxProofTime 604800)` |
| 24,251,140 | 2026-01-08 | `WorldIdRouterUpdated(0xB012Bc9D505f876394aAb1C6cdc4cA64edA65Caa)` |

**Two logs in the contract's entire life.** `VerificationLengthUpdated` has never been emitted;
neither has `GroupIdUpdated` or `MaxProofTimeUpdated`. This reproduces the count
[world-id-onchain-read.md](world-id-onchain-read.md) §2.2 measured at block 32,825,988 and extends
it to head.

Zero is the strongest answer available, not the weakest. `setVerificationLength` is the only writer
after the constructor, so with none ever emitted, head's value *is* the value the contract was
deployed with — and every World date since 2024-08 rests on a checked fact instead of a hope.

Topic selectors, pinned in the code against `toEventSelector` of the signatures rather than pasted:

| Event | topic0 |
|---|---|
| `WorldIDAddressBookInitialized(address,uint256,uint256,uint256,uint256)` | `0xd3305ade78eae487b27cd60d48bc3932e1f0a4b5fb91905ffba139377cbf1385` |
| `VerificationLengthUpdated(uint256)` | `0x64123bf7c7035196f2d7ebd814dd38723a50985772a9708ab0ec4c287c05ddf1` |

---

## 4. The whole timeline is recoverable here, and it is not for Proof of Humanity

PoH v2's `initialize` writes `humanityLifespan` while emitting nothing, so its first era's term can
never be recovered from logs; an expiry that only that era explains is left undated
(`termEraUnpublished`). `WorldIDAddressBook`'s **constructor emits its own term**:

```solidity
// L392-400
emit WorldIDAddressBookInitialized(
    worldIdRouter,
    groupId,
    externalNullifierHash,
    verificationLength,
    maxProofTime
);
```

So every era of this timeline has a published term, and `TermResolution.era-unknown` is unreachable
on it. The branch is handled anyway — a contract that stops emitting is a deployment change, not a
code change here — but no World credential can ever be lost to an unpublished era.

That asymmetry is worth stating plainly because it decides how much a change would cost. On PoH, a
governance change makes the pre-change cohort unrecoverable unless the era's term can be found some
other way. On World, a change costs nothing: each entry is simply dated with the term that was in
force when it was written.

---

## 5. The endpoint lies, and the shape of the lie decides the guards

`worldchain-mainnet.gateway.tenderly.co` is the only keyless endpoint that serves World Chain
`eth_getLogs` over a useful range — [world-agentbook-fleets.md](world-agentbook-fleets.md) and the
header of `agentbook.ts` carry the survey (Alchemy's public endpoint caps at 100 blocks, thirdweb at
1,000, and `worldchain.drpc.org` answers wide ranges with HTTP 200 and `[]`).

Over this contract's 30.1M-block history Tenderly lies too, more quietly. Asked for the whole range
in one call it returns **HTTP 200 with a silently incomplete subset, and not the same subset twice**.
Measured 2026-07-26, identical queries repeated back to back:

| Query | Result |
|---|---|
| all five governance topics, 2,711,105 → head | `[24251140]`, four runs out of four — the constructor log dropped |
| two topics (init + `VerificationLengthUpdated`), same range | `[2711105]` on one run, `[]` on the next four |
| no topic filter, same range | 980 logs, every one of them from the last 2,046 blocks |

Chunked, it is exact and stable. Same queries, chunked, repeated:

| Chunk | Calls | Wall | Result |
|---|---:|---:|---|
| 16,000,000 | 2 | 721–747 ms | both logs, every run |
| 8,000,000 | 4 | 1,421–1,463 ms | both logs, every run |
| 4,000,000 | 8 | 2,777–3,038 ms | both logs, every run |
| 2,000,000 | 16 | 5,620 ms | both logs |

The default is **8M** — half the largest size measured complete, because the cost of that margin is
one extra request and the cost of guessing wrong is a date nobody would question. The four chunks
are issued together, so the sweep is one round trip rather than four.

### 5.1 Two guards, because a chunk size is a hope and these are checks

`termChangesToHistory` refuses a sweep outright unless both hold, and a refused sweep costs a caveat
rather than a date:

1. **The constructor's log must be in the result, in the deployment block.** It is emitted
   unconditionally, so its absence *proves* the answer is incomplete. This is what catches the
   measured failure mode — an endpoint dropping the old end of a range — and it matters because
   "no `VerificationLengthUpdated` in the sweep" is the *permissive* answer.
2. **The newest term in the sweep must equal `verificationLength()` at head.** If it does not,
   something other than `setVerificationLength` wrote the field, and the timeline is wrong however
   real its logs are. This catches a drop at the new end, which guard 1 cannot.

**What neither catches**, written down rather than papered over: a change dropped from the *middle*
of a sweep that also contains a later change agreeing with head. It needs a truncation landing
strictly between two real changes. It is the same residual hole `poh-term.ts` carries. The live
suite's mitigation is the house one for this endpoint — re-sweep at a second chunk size and demand
the identical set.

`undefined` from the sweep always means *it did not answer*, never *there were no changes*. The two
license completely different confidence downstream, and the probe falls back to head's term assumed
eternal with the date marked `term-origin-unverified` — the same distinction `IndexView.entity:
null` draws everywhere else in this codebase.

---

## 6. The rule: solve for the era rather than assume one

`termForLocalExpiry` (now in `packages/sdk/src/term-history.ts`, shared with PoH) solves

```
verifiedUntil = writtenAt + term(era)
```

for the era `writtenAt` lands in. Eras are half-open, `[from, until)`, because a change takes effect
in the block it is mined in and an entry written in that block is written under the new value.

With one era — the state today — this reduces *exactly* to the deployment-floor plausibility guard
the probe already had, which is why **no date at head moves**. That is the point: the number stopped
being an assumption without any score changing.

Three refusals, each a different fact:

- `termAmbiguous` — two eras with different terms both explain the entry. Reachable whenever a
  change is smaller than the gap between the eras it separates; nothing in the entry says which, and
  a date here would be a coin flip wearing a timestamp.
- `termEraUnpublished` — only an era whose term the contract never published explains it.
  Unreachable on this contract (§4), handled anyway.
- `dateRejected` — no era at all explains it. The generalisation of the old floor/ceiling guard.

When an entry is settled under a term other than head's, `detail.termAtVerification` says which, so
a consumer can check the choice rather than trust it.

---

## 7. Cost, measured against the parent commit

Same subject, a wallet verified in the 90 blocks before head, four probes per process, two processes
each:

| | parent commit | this commit |
|---|---:|---:|
| cold probe, subject **with** an AddressBook entry | 64–67 ms | 292–306 ms |
| warm probe, same subject | 58–62 ms | 59–63 ms |
| probe, subject with **no** entry | 60–61 ms | 60–62 ms |

The sweep is memoised on success only — a rate limit is a moment, not a property of the registry —
and it is asked for **only when the subject has an entry at all**. No entry, no subtraction, no
premise to check, and that is most subjects. So the cost is ~230 ms once per process for the
population that actually gets a World date, nothing warm, and nothing at all otherwise.

The pin is the *first* head the process reaches, so a term change mined during a long-lived process
is missed until it restarts. That is one owner transaction which has never happened, against a
four-call sweep per subject; the trade is deliberate and recorded here.

---

## 8. The other adapters, for completeness

`poh-lifespan-timeline.md` open question 2 asked this of the whole roster. Two adapters derive a
date by subtracting a term, and this file closes the second:

| adapter | date | term | status |
|---|---|---|---|
| `poh-v2` | `expirationTime − humanityLifespan()` | governance-settable, `DurationsChanged` | swept, iteration 24 |
| `world-id-orb` | `verifiedUntil − verificationLength()` | owner-settable, `VerificationLengthUpdated` | swept, this file |
| `holonym-gov-id`, `holonym-biometrics` | `expiry − 31,536,000` | **not a contract field** — a circuit constraint | see below |
| `poh-v1` | `submissionTime`, published directly | used only to *check* an equality | degradation, never a wrong date |
| `human-passport-*`, `coinbase-*`, `farcaster`, `circles`, `linea-poh` | a real timestamp, read or logged | — | no subtraction |

Holonym is a different animal and deliberately left alone here. Its bound comes from
`V3.circom`'s `expiry − iat < 31,536,001` range check, which is a property of the *proving circuit*,
not of a settable storage slot — no owner transaction can move it, and an SBT that violated it could
not have been minted. The question that would apply there is whether the Hub's verifier can be
swapped for one compiled from a circuit with a looser ceiling, which would make the bound too late
and therefore inflate freshness. That is a different mechanism (an upgrade path, not a setter) and
it is open question 1 below.

---

## 9. Open questions

1. **Can Holonym's ceiling move?** `HOLONYM_MAX_CREDENTIAL_TERM_SECONDS` is a circuit constant, so
   the governance question is whether `Hub` V3 can be pointed at a verifier for a different circuit,
   and whether such a change is published. If it can and is not, the bound is exactly the World
   premise wearing different clothes — and it fails in the inflating direction. Not investigated.
2. **`maxProofTime` is a second unread term.** `verify()` rejects a proof older than
   `maxProofTime` (604,800 s, 7 days) and it is settable the same way. It does not enter any date we
   derive today, but it *bounds how stale the underlying Orb proof may be at the moment of writing*,
   which is a real statement about what `verifiedUntil − verificationLength` dates. Worth reading if
   the World date is ever presented as an enrolment rather than a binding.
3. **Nothing indexes this.** Both sweeps in this repo are per-process `eth_getLogs` against a public
   endpoint that has been demonstrated to truncate. A subgraph over the AddressBook's governance
   events would make the timeline a query rather than a sweep, remove the truncation class of bug
   entirely, and cost one data source. It is the same argument as
   [protocol-subgraph-coverage.md](protocol-subgraph-coverage.md).
