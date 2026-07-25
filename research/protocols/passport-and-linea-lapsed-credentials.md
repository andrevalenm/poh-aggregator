# Human Passport and Linea PoH — the credential that ended

**Written 2026-07-25** against live contracts on Optimism and Linea. Every number below was read
the day it was written; the RPC calls are named so they can be re-run.

Companion to [poh-lapsed-credentials.md](poh-lapsed-credentials.md), which asked the same question
of both Proof of Humanity registries. This file finishes the roster: of the ten adapters with live
probes, these were the last two that publish a dated ending and were not reading it.

---

## 0. The question, and why it is not "does the contract store an expiry"

`resolve(addr, { asOf: t })` scores a subject against the ontology as the registry held it at `t`.
The ontology half is exact. The credential half is read at chain head, so a credential the subject
held at `t` and has since lost is invisible unless the chain **dates the ending**.

Iteration 16 established the rule and iteration 16 also established its limit, on Holonym: a dated
ending is *not enough*. The credential must still be **attributable** at the instant you restore
it. Holonym's `Hub.getSBT` reverts once an SBT expires, and with it goes the issuer check that
makes the credential evidence of anything rather than a self-signed proof — so restoring a lapsed
Holonym SBT would mean restoring something we can no longer verify was Holonym's.

So each candidate gets three questions:

1. Does the chain date the **end**?
2. Does it date the **start**, exactly? (A lower bound shows the credential *could* have existed at
   `t`, never that it did.)
3. Is the credential still **attributable** at head — can we still see who issued it, to whom?

Both protocols here answer yes three times. The interesting part is what each one refuses.

---

## 1. Human Passport — the resolver keeps what the Decoder stops saying

### 1.1 The asymmetry

`GitcoinPassportDecoder.getScore(user)` is revert-driven. Once a passport ages out it reverts
`AttestationExpired(uint64)` (`0x06c09405`) and returns nothing. But the Decoder is not where the
score lives: it consults `GitcoinResolver.getCachedScore(user)`, which is a plain mapping read and
**keeps answering forever**.

Read on Optimism at 2026-07-25T20:16:47Z, resolver `0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC`
(taken from `Decoder.gitcoinResolver()`, never hard-coded):

| subject | `score` | `time` | `expirationTime` | derived expiry |
|---|---|---|---|---|
| `0xb0812e0006470fE99F71165fC7C1A2312F7b90F2` | 500150 (50.015) | 1740958699 (2025-03-03) | 0 | 1748734699 (2025-06-01) |

The passport died 419.9 days ago and every field of it is still readable at head. This is exactly
the shape PoH v2 has between `getHumanityInfo` and `isHuman`, and World's between
`addressVerifiedUntil` and a presence check: **a getter that declines to answer is not a chain that
has lost the answer.**

`expirationTime` of 0 means "use `time + maxScoreAge()`", and `maxScoreAge()` is 7,776,000 s on
every one of the seven deployments. `1740958699 + 7776000 = 1748734699` — and that is precisely the
number the Decoder puts in its revert payload, which the live suite asserts to the second.

### 1.2 Attributability, checked rather than assumed

The resolver's struct is a cache. The thing it caches is an EAS attestation, and that is what makes
it evidence. Read at the same instant, via `GitcoinResolver.userAttestations(subject, schema)` and
then the EAS predeploy `0x4200000000000000000000000000000000000021`:

```
uid          0x29896d054deacc15791835eb6be595e2cac9553991321a8cef7d5460d6de4b31
schema       0x6ab5d342…e9c89   (Decoder.scoreSchemaUID — the legacy score schema)
time         1740958699          ← identical to the resolver's cached `time`
revocationTime 0
recipient    0xb0812e0006470fE99F71165fC7C1A2312F7b90F2
attester     0x843829986e895facd330486a61Ebee9E1f1adB1a
```

Nothing has been deleted, nothing reverts, the subject is still named as recipient and the
attestation is not revoked. That is question 3 answered with a read rather than an argument, and it
is the difference from Holonym. The live test performs exactly this cross-check, which means the
day Passport starts pruning old attestations the suite goes red rather than the SDK going quiet.

### 1.3 What is refused

- **A zero score.** A passport carrying no stamps is not wallet-history evidence while it is alive
  (`held` is false for it), so its expiry ends nothing. Counted as `lapsedWithZeroScore`, not
  restored.
- **A window that never opened.** `expiresAt <= time` would describe a credential that did not
  count for a second. Refused.
- **Anything that has not actually expired.** `heldUntil` may only ever mean "the chain says this
  stopped here".

### 1.4 The residual, stated

The resolver caches **one** score per address per chain, overwritten on re-mint. So only the most
recent life on each chain is visible; a subject who minted twice on one chain has a hole in their
history there, and nothing on chain distinguishes that from never having minted twice. Reading all
seven deployments blunts it — a mint on Optimism does not touch Base's cache — and every window we
can see is reported in `detail.perChain`. For the subject above that is three:

| chain | score | issued | expires | expired |
|---|---|---|---|---|
| optimism | 50.015 | 2025-03-03 | 2025-06-01 | yes |
| linea | 50.015 | 2025-03-03 | 2025-06-01 | yes |
| scroll | 25.099 | 2024-07-18 | 2024-10-16 | yes |

The latest ending wins, because it is the most recent thing the subject paid to publish and the one
an as-of instant is likeliest to fall inside.

---

## 2. Linea PoH V2 — the same enumeration, one term further back

### 2.1 Why this one matters more than the others

The ratio. **50,475 attestations ever issued against ~495 alive.** Almost everybody this protocol
has ever verified is in the lapsed state, so an as-of score that can only see live attestations is
blind to 99% of the population it is being asked about.

### 2.2 The arithmetic that makes it cheap

The existing enumeration reads the id range `[first id with attestedDate >= now - term, counter)`,
which is exactly the set of attestations that can still be alive. Nothing that *ended* is in it,
and that is not an accident: an attestation that ended at `E` was written no earlier than
`E - term`, so it only falls inside a scan whose floor is at or below `E - term`.

Reach back one term plus `L` and the scan additionally holds every credential that ended in the
last `L`. Measured on 2026-07-25 at Linea block 31,517,588, counter 6,366,748:

| cutoff | first id | window | batches (200/call) |
|---|---|---|---|
| 90 d (live only) | 6,365,990 | 758 | 4 |
| 100 d | 6,365,861 | 887 | 5 |
| 111 d | 6,365,688 | 1,060 | 6 |
| **120 d (term + 30 d)** | **6,365,537** | **1,211** | **7** |
| 150 d | 6,364,805 | 1,943 | 10 |
| 180 d | 6,362,852 | 3,896 | 20 |

The 180-day row is the January 2026 campaign coming back into range — 24,723 attestations in that
one month, half the protocol's lifetime issuance — which is why the lookback is a cost decision
that has to be made with the issuance curve in front of you and not a round number.

`LINEA_POH_ENDINGS_LOOKBACK_SECONDS` is **30 days**. What it buys, measured through the adapter
(the doubling ladder overshoots to 2,048 ids, one rung above the 1,211 the exact cutoff needs):

```
scannedFromId       6364700     scannedFromDate  2026-02-25T02:41:42Z
endingsCompleteFrom 2026-05-26T02:41:43Z
live      495 attestations / 494 subjects
ended   1,026 attestations / 1,025 subjects        endedUndated 0
revoked in range 2                                  snapshot 7.3 s
```

**1,025 lapsed subjects against 494 live**, for three extra batched calls.

### 2.3 Coverage is derived from the scan, not from the constant

`endingsCompleteFrom = scannedFromDate + maxTermSeconds`, where `scannedFromDate` is the
`attestedDate` of the lowest id the scan actually read and `maxTermSeconds` is the longest term it
actually saw. Neither is the constant that chose the range. A narrower scan therefore loses the
coverage claim by itself — the lesson of the subgraph's `IndexCoverage` entity
([protocol-subgraph-coverage.md](protocol-subgraph-coverage.md)), applied to an enumeration.

Below that instant an *observed* ending is still a real window read off the registry; it is only
the **absence** of one that stops meaning anything. That asymmetry is why under-coverage is safe:
it can only fail to restore a credential, never invent one.

The claim is proved from the chain alone in the live suite, in the same shape as the live
population's lower edge: read the 600 ids immediately below `scannedFromId` and require every
attestation on our schema there to have *finished* before `endingsCompleteFrom`.

### 2.4 What is refused

- **A revocation with no `revocationDate`.** The expiry is then only an *upper* bound on when the
  credential really stopped, and restoring against an upper bound hands the subject every day
  between the real revocation and the expiry. Counted as `endedUndated` and given no window. Zero
  of the two revocations in range are in this state today, which is the point of counting them.
- **A revocation *after* the term ran out.** Verax lets an already-dead attestation be revoked, so
  the ending is `min(revocationDate, expirationDate)`.
- **A foreign portal's attestation.** The same owner check the live path applies runs first: an
  attestation that would not have counted while it was open does not get a window when it closes.
- **An inverted or empty window**, and any ending in the future.

The one revocation with a date, for the record:
`0x48b02cc4d79cff6c11570914cd76851f535003ee`, attestation `0x…61210f`, attested 1774228015,
revoked 1775646416, term would have run to 1782004012 — so its window is 16.4 days, not 90.

---

## 3. End to end, on a real subject, today

`0x39473b54ff152461298a93ed6913ee0fa7f2fab1` holds a Linea PoH attestation written
2026-04-26T08:04:57Z that expired **2026-07-25T08:04:56Z**, and nothing else this SDK reads.
Scored through `resolve()` against the deployed registry and the audit-trail subgraph:

| as of | score | roots | `linea-poh` |
|---|---|---|---|
| 2026-07-25T07:04:56Z (one hour before it lapsed) | **3.1765** | 1 | held, 1500.48c, `ceasedAfterAsOf: [linea-poh]` |
| 2026-07-25T09:04:56Z (one hour after) | **0.0000** | 0 | not held |
| chain head | **0.0000** | 0 | not held |

Nine subjects are in that state right now — a window that has already closed and whose closing
instant is *after* the registry's own genesis, which is the only range an as-of question can be
asked about at all (Sepolia block 11,344,158, 2026-07-25T00:21:36Z). Human Passport has the same
mechanism and no such subject today: its lapsed windows all closed before the registry existed, so
the restoration is real and currently undemonstrable end to end. That is a fact about the
registry's age and not about the read.

---

## 4. A defect found while doing this, in our own test suite

`human-passport.live.test.ts` sourced a *current* minter from EAS `Attested` logs on Optimism to
exercise the positive path. Iteration 4 moved the Passport probe's Optimism endpoint from
`mainnet.optimism.io` to `optimism-rpc.publicnode.com` (correctly — the archive quota belongs to
the Farcaster probe), and the test followed it. **publicnode rejects that log filter outright**
with `InvalidParams`, and the search caught the exception and returned `undefined`, which the
caller read as "nobody has minted recently" and skipped the test in silence.

Both halves were wrong at once: the endpoint would not answer, *and* the search window had stopped
being wide enough. Score-v2 mints were arriving several times a day when the adapter was written;
on 2026-07-25 the most recent one on Optimism was **54,000 blocks back**, past the 45,000 the
search covered. Fixed by pointing the search at `optimism.drpc.org` (which answers), widening to 16
windows, and **printing the refusal** — an endpoint that will not serve the filter and a registry
with no recent mint produced the same `undefined`, and the caller could not tell them apart.

The generalisation, which is worth more than the fix: *a live test that sources its own subject can
stop covering anything without failing.* If the search can come back empty, the reason has to be
distinguishable from the subject not existing.

---

## 5. Deliberately not read

- **Passport's stamps on a lapsed passport.** `getPassport` reverts for an expired attestation, and
  the stamp list is disclosure rather than evidence. No loss.
- **An earlier Passport life on the same chain.** Recoverable in principle from EAS `Attested` logs
  over full history; not recoverable from any keyless endpoint we have (§4 — publicnode refuses the
  filter, and the archive endpoints that would serve it are spent by Farcaster). Left as the stated
  residual in §1.4.
- **Linea endings older than the scan.** A 90-day lookback would reach the January campaign and
  cost 20 batched calls; the coverage is instead *reported*, so a consumer can see the edge.
- **Verax's `replacedBy`.** A replacement revokes the old attestation, so it already produces a
  dated ending through the revocation path. The pointer itself adds nothing a score consumes.

---

## 6. Open questions

1. **Does `GitcoinResolver.onAttest` constrain the attester?** The probe's authority model rests on
   only EAS being able to write to the resolver and on Passport's schema pointing at it. That was
   true before this change and is unchanged by it, but the EAS record read in §1.2 now gives us the
   attester (`0x843829986e895facd330486a61Ebee9E1f1adB1a`) for free — pinning it the way Holonym's
   issuer and Linea's portal owner are pinned would close the question rather than assume it.
2. **How often does a Passport re-mint overwrite a window we would have wanted?** Unmeasurable
   without historical `Attested` logs on seven chains (§5). It bounds how complete Passport's
   as-of coverage can ever be.
3. **Is 30 days the right lookback once the registry is older than 30 days?** Today the whole
   as-of range is under two days, so the lookback has 15× headroom. It does not grow by itself.
   `endingsCompleteFrom` makes the shortfall visible rather than silent, but visible is not the
   same as handled.
