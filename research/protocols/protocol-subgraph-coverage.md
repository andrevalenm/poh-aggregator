# Our own index, measured: coverage, and what a side-event date is worth

**Written 2026-07-25** (unattended iteration 17), against live Gnosis and the deployed Studio
subgraph `77602/poh`. Builds on [circles.md](circles.md) and
[poh-kleros-brightid-idena.md](poh-kleros-brightid-idena.md); those cover the protocols, this
covers **the index we run over them** — how far back it can see, and which of its dates are
issuance dates.

Everything here was produced by a call made today. Block numbers were bisected or filtered out of
`eth_getLogs`, not recalled.

---

## 1. Why an index's dates need auditing at all

`reconcile.ts` (iteration 1) already treats an index read as a statement about a named block, and
already refuses to let index lag move a score. Two things it could not check were left as flagged
approximations, and both were about the index's account *of itself*:

1. **Coverage.** Whether "absent from the index" is evidence depends on whether the index has the
   protocol's whole history. That was a constant in `packages/sdk/src/subgraph.ts` describing a
   manifest in `subgraph/subgraph.yaml`. Two files, two packages, one hand-maintained agreement,
   and the failure is silent and in the dangerous direction: an index called complete when it is
   windowed reports "did not exist yet" for credentials it merely cannot see, pricing a
   twenty-one-month-old avatar as brand new.
2. **Whether a date is a date.** A subgraph entity is created by whichever handler reaches the key
   first, and that is often not the credential's own event. Such an entity carries an adjacent
   event's timestamp, and the *direction* of that error decides whether it may be used at all.

## 2. Circles: the window, and what it actually cost to remove

### Deployment and first credential

| Fact | Value | How |
|---|---|---|
| Hub v2 code first present | Gnosis **36,486,014** | bisection on `eth_getCode`; `0x` at 36,486,013 |
| That block's timestamp | 2024-10-13T15:09:10Z | `eth_getBlockByNumber` |
| First `RegisterHuman` | **36,501,311** | topic-filtered `eth_getLogs` forward from deployment |
| Log order inside that block | `Trust` → `RegisterHuman` | all Hub logs at 36,501,311 |

`RegisterHuman(address,address)` is topic `0xfea7c1e1…3f893d77`; `Trust(address,address,uint256)`
is `0xe60c754d…f57cdcec`. The self-trust edge a registration emits lands *before* the
`RegisterHuman` in the same block, which is why the index's own coverage record names `Trust` as
the earliest event it saw even though nothing was trusted before the Hub's first human.

### The event volume the old window was avoiding

The manifest asserted "~7,200 Trust events per 60k blocks, so full history would take hours" —
i.e. ~2,400 per 20k. Measured: 20k-block windows sampled every 1M blocks from deployment to head
47,388,288.

| Window from | `RegisterHuman` | `Trust` |
|---|---|---|
| 36,486,014 | 12 | 26 |
| 37,486,014 | 13 | 76 |
| 38,486,014 | 4 | 153 |
| 39,486,014 | 63 | 813 |
| 40,486,014 | 95 | 1,080 |
| 41,486,014 | 29 | 648 |
| 42,486,014 | 17 | 688 |
| 43,486,014 | 7 | 211 |
| 44,486,014 | 58 | 576 |
| 45,486,014 | 9 | 506 |
| 46,486,014 | 52 | 1,263 |

Mean **582 events per 20k blocks**, so the Hub's whole life projects to **~317,000 events** — about
a quarter of what the manifest assumed, and the densest region is the *recent* one the old window
already covered. The clinching argument is separate from the volume: the PoH data source starts at
35,846,827, so the subgraph was already syncing every one of those blocks and discarding only the
Circles events in them.

### What it was costing, end to end

Both vectors are real avatars from the Hub's first registrations, scored through `resolve()` today
against the old deployment (v0.0.2, window at 46,300,000) and the new one (v0.0.3, full history):

| Subject | Old score | New score | Old freshness | New freshness | Old caveats |
|---|---|---|---|---|---|
| `0x3fc5c255…cb6d` | 1.4150 | **1.6711** | 0.5000 (midpoint) | **0.9179** | `issuance-date-unknown`, `index-coverage-partial` |
| `0xd40133ea…b446` | 0.9438 | **1.6711** | 0.1557 (floor) | **0.9179** | `issuance-date-lower-bound` |

The second is the interesting one: it was *in* the old index, dated from a trust edge 1.6 years
after its registration, and therefore priced at 17% of the weight its survival had earned. Neither
error was ever hidden — both caveats fired — but a caveat is not a score.

## 3. A trust edge can precede a registration, which is why the overwrite matters

The direction claim for Circles (`after-issuance`: a trust-edge date understates age) is a claim
about **our mapping**, not about Circles' semantics. Circles' invitation flow is *exactly* trusting
an address that has not registered yet, and it is common: in blocks 40,000,000–40,040,000 there
were 21 registrations and 415 trust edges, and **10 of the 21 registrations were preceded by a
trust edge naming them** (e.g. `0x68d96962…889a` trusted at 40,024,756, registered at 40,025,850).

So the timestamp a `handleTrust` materialisation leaves behind can sit on either side of the
registration in general. What makes it safe to read as a floor is that `handleRegisterHuman`
overwrites it: an avatar still carrying a trust-edge date is one whose `RegisterHuman` this index
never saw, which with a full-history data source means it is below the index's lower edge — older
than the date, never younger. Narrow the window again and that reasoning is what breaks, which is
why coverage is now read from the index rather than assumed.

## 4. PoH: the index's oldest "claim" is a vouch, and vouches come first

`HumanityClaimed(bytes20,uint256)` is topic `0x8f7a3d83…0904cbe9`, and neither parameter is
indexed, so the humanity id is the first word of `data`. Full history from the proxy's deployment
block (35,846,827) to head, one topic-filtered query:

- **1,409 `HumanityClaimed` logs over 1,402 distinct humanity ids** — so 7 ids (0.5%) have been
  claimed more than once. (Iteration 1 recorded ~2% re-claimed from a different denominator; this
  measurement is against the log set itself.)
- **First claim: block 36,029,465.** That is the yardstick `PROTOCOL_FIRST_CREDENTIAL_BLOCK.poh`
  uses, and it is 182,638 blocks *after* the proxy's deployment — so anchoring coverage on the
  deployment block would have been conservative but anchoring it on the first credential is exact.

The index's earliest event, meanwhile, is a `VouchRegistered` at block **35,864,293** — 165,172
blocks before the first claim. Both entities that log creates (`0x6687c671…8dd6`,
`0xfd1af514…4c8a`) are dated from the vouch, because a vouch is cast on a request that has not
resolved yet: `handleVouchRegistered` has to materialise both ends so the edge resolves, and for
the *vouched* side there is no claim to date it from.

Checked against the chain over every such entity the index holds: of the vouch-only entities,
**6 were claimed later, 2 were never claimed, 0 were claimed earlier**. Zero counterexamples, which
is what licenses treating the vouch timestamp as a proven lower bound on issuance rather than as a
date.

### Why that direction is the expensive one

A vouch timestamp precedes the claim, so reading it as the issuance date makes the credential look
*older*. PoH scores on a `Ramp` (weight rises with survival, because the fresh cohort is the
suspect one), so older is worth more: the error runs in the adversary's favour, unlike the Circles
case. It is now converted to `issuedAfter`, which caps ramp weight instead of granting it. Below
the half-life the arithmetic is unchanged; above it the cap bites — a three-year-old vouch read as
an issuance date prices a 365-day ramp at **0.875** for a credential that may have been claimed
yesterday, against **0.5** as a bound.

## 5. What the index now says about itself

`IndexCoverage` (one entity per data source, written on the first event each one sees):

```
{ id: "poh",     firstEventBlock: 35864293, firstEventKind: "VouchRegistered" }
{ id: "circles", firstEventBlock: 36501311, firstEventKind: "Trust" }
```

Both at or before their protocol's first credential (36,029,465 and 36,501,311), so both claim
complete history and both claims are checkable: the live suite asserts the chain holds no
`RegisterHuman` below the Circles edge, from the Hub's deployment block onward.

The record is written on the first event of *any* handled kind, which is conservative in the right
direction: it can only ever be at or after the manifest's `startBlock`, so coverage can be
understated and never overstated. It is also more precise than the `startBlock` would be — a data
source configured to start between a contract's deployment and its first credential is genuinely
complete, and this reports it as such.

## 6. Deliberately not done

- **`registrationObserved` is not backfilled into anything.** It is a field on the entity, so a
  consumer reading an older deployment gets the old behaviour (the null-`inviter` heuristic for
  Circles, "assume observed" for PoH) via an explicit legacy path in `subgraph.ts`, and the SDK
  says which it used. Silently upgrading an old deployment's semantics would be inventing data.
- **The Circles `stopped` flag is still the only ending we index.** Iteration 16's `heldUntil`
  machinery could restore a Circles avatar the subject has since stopped, but the Hub stores no
  stop *timestamp* we have located, and a window whose end is undated cannot be closed. Same
  question as the one that excluded Holonym: is the credential still attributable at the moment
  you restore it?
- **PoH's `firstClaimedAt`.** The index holds the *latest* claim, and so does the contract's own
  `expirationTime − humanityLifespan()` arithmetic, so a re-claimed humanity is dated from its
  most recent claim. On a survival ramp that understates age for 0.5% of humanities. Fixing it
  needs a `firstClaimedAt` field, i.e. another resync, and it is worth less than it costs today.
