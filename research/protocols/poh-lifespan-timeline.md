# Proof of Humanity v2 — which of this contract's terms wrote an expiry

**Researched 2026-07-26.** Sources: the verified PoH v2 implementation
`0x85b88E38fb6cbc8059009902F76c47F902373F52` (Blockscout, Gnosis) behind the proxy
`0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`; PoH v2 on mainnet
`0xbE9834097A4E97689d9B667441acafb456D0480A`, implementation `0x9EcDfADA6376D221Ed1513c9F52cC44a39E89657`,
deployed in tx `0x9d77e37f…4563` at block 20,685,061 (2024-09-05T14:43:59Z); PoH v1 on mainnet
`0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb` (verified source, Blockscout). Log sweeps ran against
`rpc.gnosischain.com` and `gateway.tenderly.co/public/mainnet` on 2026-07-26.

Answers open question 1 of [poh-imported-terms.md](poh-imported-terms.md), which asked what watches
`humanityLifespan()` for a change. Nothing did. The answer is that the contract has been publishing
every change all along.

---

## 1. Two premises, and only one of them was checked

Every PoH v2 date is one subtraction:

```
issuedAt = expirationTime − humanityLifespan()
```

[poh-imported-terms.md](poh-imported-terms.md) established the first premise and checked it: the
subtraction is arithmetic about **this** contract only if this contract wrote the expiry, and
`ccGrantHumanity` copies expiries settled elsewhere. That is *whose* term.

There is a second premise hiding in the same line, and it is about *which* term. `humanityLifespan`
is read **at head**, and the expiry was written at some block in the past. Those are the same number
only if the field has not moved in between — and the field is governance-settable:

```solidity
// ProofOfHumanity.sol, L591-607 of the deployed implementation
function changeDurations(
    uint40 _humanityLifespan,
    uint40 _renewalPeriodDuration,
    uint40 _challengePeriodDuration,
    uint40 _failedRevocationCooldown
) external onlyGovernor {
    humanityLifespan = _humanityLifespan;
    …
    emit DurationsChanged(
        _humanityLifespan, _renewalPeriodDuration, _challengePeriodDuration, _failedRevocationCooldown
    );
}
```

A change writes nothing to any stored `expirationTime`. Every humanity keeps the expiry it was
given; only the number we subtract from it moves. So one governance transaction would shift **every
derived date in the registry at once**, by the full size of the change, in the same direction, with
nothing in the codebase positioned to notice. On `poh-v2`'s Ramp at a 365-day half-life that is a
whole cohort of scores moving because a knob turned.

## 2. It is not hypothetical, and the near-miss is the same protocol

PoH **v1**'s equivalent field has already moved — 31,557,600 → 63,115,200 s, the change
`poh-v1.ts` has documented since iteration 18 — and v1 announces nothing when it moves:

```solidity
// ProofOfHumanity.sol (v1), L563-568. No event.
function changeDurations(uint64 _submissionDuration, uint64 _renewalPeriodDuration, uint64 _challengePeriodDuration) external onlyGovernor {
    require(_challengePeriodDuration.addCap64(_renewalPeriodDuration) < _submissionDuration, "Incorrect inputs");
    submissionDuration = _submissionDuration;
    …
}
```

Two things follow. First, "a governor changes the term" is an event this protocol's own history
contains, not a scenario invented to justify a guard. Second, v2's authors added the event v1 lacked
— so on v2 the change is readable, and the only reason it was not being read is that nobody asked.

## 3. `DurationsChanged` is a complete history of the term

Three writers of `humanityLifespan` exist in the deployed source, and only one of them runs more
than once:

| writer | when | emits |
|---|---|---|
| `initialize` (L446-471) | once, at deployment | `RequestBaseDepositChanged` only — **not** the durations |
| `changeDurations` (L591-607) | any time, `onlyGovernor` | `DurationsChanged` |

So a full-range sweep of `DurationsChanged` on the proxy recovers the term at every instant of the
contract's life, with exactly one hole: the era from the deployment to the first change, whose value
`initialize` never published.

**Both live instances have emitted zero.**

| instance | range swept | logs | wall time | `humanityLifespan()` at head |
|---|---|---:|---:|---:|
| Gnosis `0xa4AC94C4…57bc` | 35,846,827 → 47,391,312 | **0** | 124 ms | 31,557,600 |
| mainnet `0xbE983409…480A` | 20,685,061 → 25,613,069 | **0** | 95 ms | 31,557,600 |

Both served the whole range in a single `eth_getLogs`. Zero logs is the strongest possible answer
rather than the weakest: with no change ever emitted, head's value **is** the value `initialize`
wrote, and the premise stops being an assumption. The subtraction has been correct for every subject
since the deployment, and now we can say so from the chain instead of hoping.

## 4. The rule: solve for the era, don't assume the era

`readTermHistory` turns the sweep into a timeline of half-open eras `[from, until)` — half-open
because `changeDurations` takes effect in the block it is mined in, and a claim resolved in that same
block is written under the new value. `termForLocalExpiry` then solves

```
expirationTime = claimedAt + term(era)      where claimedAt ∈ era
```

An era explains an expiry exactly when subtracting *that era's* term lands the write inside *that
era*. With one era — the state of both instances today — this reduces to the deployment-floor guard
the probe has applied since iteration 18, which is why **nothing at head moved**. With more than one
it does the thing a tripwire could not: it dates the change, so the right term gets subtracted from
each cohort instead of every date being thrown away.

Four outcomes, and each refusal is a different fact:

- **settled** — one era explains it. Its term is subtracted; `detail.termAtClaim` reports it when it
  differs from head's, because a reader comparing two subjects' dates deserves to know they were
  computed with different numbers.
- **ambiguous** — two eras with different terms both explain it. Reachable with a term shortened by
  as little as two days: the old term dates the claim to just before the change, the new one to just
  after, and each lands in the era whose term it is. Nothing in the record prefers either, so there
  is no date — `detail.termAmbiguous` names both candidates.
- **era-unknown** — only the first era explains it, and `initialize` never published that era's term.
  Any expiry can be explained by *some* term in that era, which is exactly why none of them may be.
  `detail.termEraUnpublished`; the credential's *end* is read rather than derived, so it survives.
- **no-era** — no term this contract has ever granted could have produced this expiry. Generalises
  the two guards that were there before (a start before the deployment, a start after the block we
  read at) into one statement, and keeps `detail.dateRejected`.

### Three decisions inside it

**A sweep that did not answer is not a sweep that found nothing.** Same distinction
`IndexView.entity: null` and `readGrantedTerms` both draw, in a third place. `readTermHistory`
returns `undefined` on failure, the adapter falls back to `assumedTermHistory` — head's term, assumed
eternal, which is the pre-existing behaviour — and the date carries `term-origin-unverified`. It is
memoised **on success only**, so a rate limit is a moment rather than a property of the run. A caller
who supplies no history at all is a different case and gets no note: nobody asked, so no check was
skipped, and `dateHumanityFromTerm` stays callable with no network.

**A sweep that cannot explain head has not answered.** If the newest logged value differs from
`humanityLifespan()` at head, something other than `changeDurations` wrote the field — a proxy
upgrade re-running an initializer is the realistic one. The logs are real and the timeline they build
is wrong, so `readTermHistory` reports it exactly as it reports an unreachable node. This is the one
place the sweep validates itself against state, and it is what makes `observed: true` mean something.

**A known era beats the unpublished one rather than tying with it.** The first era can be assigned a
term to fit any expiry whatsoever, so treating it as a rival candidate would make every date in the
registry unrecoverable the moment a governor touched the field once. The cost is a coincidence — an
expiry actually written in the first era that a later era's term also happens to explain — and it is
written down here rather than traded silently. §7 has the two ways to close it.

## 5. Mainnet gets the same treatment, because it has the same problem

`resolveImportedTerm` reads the origin instance for an imported humanity, and its two branches fail
differently:

- **PoH v1** publishes `submissionTime` directly. The term is used only to *check* the match
  (`submissionTime + submissionDuration == expirationTime`), so a change there costs the match and
  therefore the date. Degradation, never a wrong answer — which is why v1 needs no timeline despite
  being the instance whose term actually moved and which announces nothing.
- **PoH v2 on mainnet** publishes only an expiry, so its date is a subtraction carrying the identical
  premise. It now gets the identical check: that instance's own `DurationsChanged` timeline, swept
  once, on the first imported humanity a process encounters and never for a subject with none.

## 6. Cost, measured rather than waved at

One extra full-range `eth_getLogs` per process, memoised, running concurrently with the grant sweep.
Against `rpc.gnosischain.com`, probing a live held humanity
(`0x4e6654f3…1f05`), four probes per process, two processes each:

| | before | after |
|---|---|---|
| cold (first probe in the process) | 447, 566 ms | 558, 583 ms |
| warm | 193–231 ms | 200–292 ms |

Roughly **+100 ms once per process, nothing warm** — the warm spread is network noise on an
unchanged code path, since the timeline is read once and held. Standalone, the sweep is 124 ms.

## 7. What is deliberately not done

- **The first era's term is not recovered.** Two routes exist: the deployment transaction's
  `initialize` calldata, and an archive `eth_call` at the block before the first change. Both are
  dead code today (zero changes, so the first era is the only era and its term is head's), and both
  would need a live change to test against. Written down rather than built.
- **`HumanityClaimed` is not swept.** It would remove the subtraction entirely for any humanity with
  a claim log — the log's block timestamp *is* the claim second, which is what the live test has
  asserted since iteration 18. It is not indexed by humanity, so there is no topic filter and the
  sweep is ~1,600 logs against this one's zero. Better derivation, much heavier read; queued rather
  than assumed to be worth it.
- **No registry write.** No weight, root, curve, half-life or cost moved. This decides which date a
  credential gets, not what one is worth.

## 8. Open questions

1. **Does the coincidence in §4 have a bound?** A first-era expiry that a later era's term also
   explains requires the two terms to differ by exactly the gap between the write and the era
   boundary. That looks rare, but "looks rare" is not a bound, and recovering the first era's term
   would make the question moot rather than answered.
2. **Do the other adapters subtract anything from state at head?** Holonym and World both read
   expiries and both have a live test pinning the term, but that is a tripwire and not a timeline —
   whether either protocol publishes its changes has not been asked. Same shape as this, one level
   out, and the same question iteration 22 asked about endings.
3. **Should `termAtClaim` reach the caveat vocabulary?** Today it is `detail` only. A subject dated
   under a superseded term is not less certain, so a caveat would overstate it — but two subjects
   whose dates were computed with different numbers are not quite comparable either, and the scoring
   layer currently cannot see the difference.
