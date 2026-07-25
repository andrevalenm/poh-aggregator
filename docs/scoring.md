# The scoring model

Implementation: [`packages/sdk/src/scoring.ts`](../packages/sdk/src/scoring.ts).
Tests: [`packages/sdk/src/scoring.test.ts`](../packages/sdk/src/scoring.test.ts).
Weights: [`ontology/adapters.json`](../ontology/adapters.json), deployed to the registry.

Every number in this document is either read from the ontology or produced by the code. Run
`cd packages/sdk && npm test` to check the model; the worked examples below are arithmetic
over the deployed weights.

---

## The rule

> Group evidence by trust root. **Saturate within a root, sum across roots.** Price each
> credential at **min(forge cost, rent cost)**, adjusted by an age curve, zeroed if the
> upstream protocol is dead. The score is **log₁₀** of the total, in cents.

Five steps, in order.

---

## 1. Group by trust root

A trust root is the thing actually checked, underneath the branding. `state-document:icao-9303`
is a passport chip signed by a national CSCA. `kyc-vendor:sumsub` is a document-plus-selfie
check performed by Sumsub. The deployed ontology has 30 adapters over 18 roots.

Two adapters sharing a root are **one piece of evidence observed twice**. Four protocols read
the ICAO root: World's document tier, ZKPassport, Self Protocol, Rarimo. A subject holding all
four made one trip to a passport office.

The collapses are traced to primary sources in
[`research/landscape/kyc-liveness-vendors.md`](../research/landscape/kyc-liveness-vendors.md) —
that file is where the root assignments come from, not from vendor marketing — and every
adapter's assignment is justified individually in
[`research/landscape/ontology-coverage.md`](../research/landscape/ontology-coverage.md), which
also records the two roots that are judgement calls rather than documented facts.

## 2. Saturate within the root

Take the strongest credential in the root. Discard the rest.

This is not a heuristic, it is what the situation forces. The obvious alternative —
deduplicate the credentials — is unavailable, because we usually cannot tell that two came
from one document. ZKPassport scopes its nullifier per service and never publishes an unscoped
value; Self publishes a global one; World hashes a neighbouring field. Four incompatible
derivations over one chip. Dedup would require linking a user's credentials to each other,
which is precisely the correlation those nullifier designs exist to prevent.

So we work at the level of the credential **class**. We never need to know that *this
subject's* two credentials share a root — only that those two *protocols* read the same root,
which is a public fact about the world. Zero cross-protocol linkability required.

Saturation is also the right move under uncertainty. Where correlation is unobservable, it
bounds the honest user's loss at one root's worth, while the adversary's gain under additive
scoring grows without limit in the number of protocols reading the same root. Argument in
[`research/landscape/prior-art-scoring.md`](../research/landscape/prior-art-scoring.md), which
compares Bayesian, Dempster–Shafer, copula and IRT approaches and lands here.

**Saturation spans the subject's whole address set**, so a passport presented from two wallets
is still one passport. Test: *"splitting correlated credentials across wallets does not inflate
the score"*.

## 3. Price at min(forge, rent)

Two separate costs, and the cheaper one wins.

- **`forgeCostCents`** — what it costs an adversary to manufacture the credential.
- **`rentCostCents`** — what it costs to borrow one from a willing holder.

They are stored separately because **every protocol that hardened did so against sale, and
none against rental.** World's `require_user_presence`, Idena's identity staking: both raise
the cost of *transferring* a credential to someone else permanently. Neither touches the case
where the human stays willing and simply signs when asked.

If a single "strength" scalar were stored, security work addressing only resale would inflate
the score, and the model would systematically overrate exactly the protocols that did the most
work. Taking the minimum makes that impossible. There is a test asserting it directly:

```ts
// hardening only against sale cannot inflate a score
const before = { forgeCostCents: 10_000, rentCostCents: 100 }
const after  = { forgeCostCents: 900_000, rentCostCents: 100 }   // 90x harder to forge
effectiveCost(before, 1) === effectiveCost(after, 1)             // ...same score
```

Source for the rental side:
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§3 and §6 — human solvers at $0.50–$2.99 per thousand, essentially unchanged since 2010, and a
documented Orb-account resale market from $0.50.

The live tests assert `rentCostCents <= forgeCostCents` for every adapter in the registry. A
credential that were cheaper to forge than to rent would mean nobody bothers renting, which
has never been observed.

## 4. Apply the age curve

Every adapter carries an `ageCurve` and a `decayHalfLifeDays`.

| Curve | Weight over time | For | Examples |
|---|---|---|---|
| `Decay` | falls, half every half-life | recency is the signal | World Selfie Check (90d), Coinbase/Persona (730d), Orb (1095d), passport (3650d) |
| `Ramp` | rises with survival: `1 − 2^(−age/halflife)` | freshness is the *suspicious* case | Proof of Humanity (365d), Circles (180d) |
| `None` | constant | age is uninformative | — |

**Ramp is the interesting one.** A single decay curve for everything would have been actively
harmful here. Proof of Humanity took ~1,299 of its 1,364 lifetime registrations inside a
four-month window tracking a ~$9.94 PNK airdrop one-for-one
([`research/protocols/poh-kleros-brightid-idena.md`](../research/protocols/poh-kleros-brightid-idena.md)).
Under uniform decay, that airdrop cohort — the *least* trustworthy registrations in the
registry — would have received full weight, and the 2021 organic cohort would have been
discounted to nothing. Exactly backwards.

Under Ramp, weight is earned by surviving:

| PoH registration age | Ramp weight | Effective cost | Solo score |
|---|---|---|---|
| 7 days | 0.013 | $0.07 | 0.88 |
| 90 days | 0.157 | $0.79 | 1.90 |
| 365 days | 0.500 | $2.50 | 2.40 |
| 1095 days | 0.875 | $4.38 | 2.64 |

A registration minted during last week's reward window scores 0.88. One that has survived
three years of challenge windows scores 2.64. The airdrop cohort discounts itself.

**Unknown issuance date is handled asymmetrically, on purpose.** `Decay` returns weight 1 — the
credential's existence was verified live on-chain, and a missing date must not silently
penalise an honest subject. `Ramp` returns 0.5. Granting full Ramp weight on missing data would
make "keep the indexer unreachable" a profitable move for an attacker, which is not a property
you want in a scoring function. Both cases raise the `issuance-date-unknown` caveat.

**An age that is bounded is not an age that is unknown.** Asking a contract *whether* a
credential is held and an index *when* it was issued is a torn read: while the index is behind,
a real credential comes back held with no date, which on a `Ramp` curve is the 0.5 midpoint —
about twenty-three times the weight a week-old registration deserves. That made index lag worth
buying. So absence in the index is now used as evidence in its own right. If the index has
complete history for a credential class and does not have this credential at block *B*, then
the credential was issued after *B*, which caps its age; the ramp is evaluated at that cap and
the result carries `credential-not-yet-indexed` naming the block. The cap is `min(bound,
midpoint)`, never a grant, so a lagging index can at worst recover the midpoint it would have
had anyway — and where the index only covers a *window* of history, absence proves nothing, the
old fallback applies unchanged, and `index-coverage-partial` says so. Full decision table:
[`packages/sdk/src/reconcile.ts`](../packages/sdk/src/reconcile.ts).

**A hard expiry truncates a decay curve, so a half-life longer than the expiry never
completes.** Four of the nine implemented adapters have this shape, and it is easy to misread
their half-lives as the range over which weight falls. Human Passport hard-expires at 90 days
against a 180-day half-life; Holonym within a year of the check behind it against 730; World's
address-book binding at 168 days against 1,095; Linea PoH at 90 against 90. Because the probe
returns `held: false` the instant the credential expires, weight for these never falls below the
value the *term* implies — 0.71, 0.71, 0.90 and 0.50 respectively — and the remainder of the curve
is unreachable. That is not a defect in the half-lives, which describe how confidence in the
underlying check decays; it means the credential's own renewal policy, not our curve, is what
bounds these four. The Holonym and World live suites assert their floor directly; the Passport and
Linea suites assert the term it is derived from — either way a term change upstream shows up as a
failing test rather than as a quiet re-pricing.

Where a protocol dates its own credentials on chain, none of this is needed. PoH v2's
`getHumanityInfo` returns `expirationTime`, and `humanityLifespan()` is the fixed term granted
at claim, so `expirationTime − humanityLifespan` is the claim timestamp — two `eth_call`s, no
indexer in the path at all. The index then serves as a cross-check on the date rather than the
source of it, and a disagreement between the two is reported as our fault, not the subject's.
Circles has no such slot, which is why the reconciler above exists.

## 5. Zero out dead protocols, then sum and take log₁₀

An adapter whose upstream protocol is discontinued contributes **0** — but is still reported,
with a `discontinued-protocol` caveat, so a historical score stays explicable. Civic Pass is
kept in the ontology for exactly this reason: it was discontinued 2025-07-31 and a major
competitor still awards points for a Civic stamp for a product that no longer exists.

Then sum the root contributions and take `log10(totalCents + 1)`. The log keeps the scale
readable (roughly 0–4) and stops one expensive credential from dwarfing everything else. The
`+1` makes an empty result 0 rather than −∞.

The score is **not** a grade and **not** a probability. It is a dollar figure on a log scale:
*this is what it would cost, today, to obtain this evidence fraudulently.*

---

## Worked example

A subject holding World ID (Orb), ZKPassport, Self Protocol and Circles v2 — four credentials,
read against the deployed ontology, with no issuance dates available.

**Step 1–3, per credential:**

| Credential | Trust root | Forge | Rent | min | Curve |
|---|---|---|---|---|---|
| World ID (Orb) | `iris-registry:world-orb` | $500.00 | $0.50 | **$0.50** | Decay |
| ZKPassport | `state-document:icao-9303` | $1500.00 | $20.00 | **$20.00** | Decay |
| Self Protocol | `state-document:icao-9303` | $1500.00 | $20.00 | **$20.00** | Decay |
| Circles v2 | `social-trust:circles` | $1.00 | $0.50 | **$0.50** | Ramp |

**Step 4–5, per root:**

```
  iris-registry:world-orb    $0.50   (Decay, no date -> weight 1.0)
  state-document:icao-9303  $20.00   SATURATED: zkpassport + self-protocol, counted once
  social-trust:circles       $0.25   (Ramp, no date -> weight 0.5)
                            ───────
                            $20.75   ->  log10(2076) = 3.32
```

Four credentials, three roots, **score 3.32**.

A naive additive scorer sums all four: $0.50 + $20.00 + $20.00 + $0.25 = $40.75 → **3.61**. It
credits two independent proofs for one passport, and inflates the subject by 0.29 on a log
scale — a factor of two in the underlying dollars.

If the subgraph supplies a Circles registration date of 547 days, the Ramp weight rises from
0.5 to 0.878, the root contributes $0.44 instead of $0.25, and the total moves to $20.94 →
**3.32**. Barely at all: this subject's score is dominated by a passport, and the model says
so. That is the point of reporting `roots` alongside the score.

---

## The World ID wrinkle

Here is the number our own model produces that we like least.

| Credential, alone | Effective cost | Score |
|---|---|---|
| World ID (Orb) — an iris scan at a physical device | **$0.50** | **1.71** |
| Proof of Humanity v2 — one vouch, mature registration | **$4.38** | **2.64** |

An Orb enrolment is, by any honest reading of the evidence, a far better uniqueness check than
a single PoH vouch: global 1:N iris dedup against a physical device, versus
`requiredNumberOfVouches() == 1` on a registry where `HumanityRevoked` has fired exactly once
ever. Our model ranks it **below**. We are not going to bury that.

**Why it happens.** We do not price how good the check is. We price what it costs to obtain one
fraudulently *today*. World's Orb credential has a documented open resale market with a $0.50
floor (ZachXBT, 2026-04-28;
[`research/protocols/world-id.md`](../research/protocols/world-id.md) and
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§2.1). PoH does not have one at that price — a humanity is bound to an address, and moving it
means a re-registration a challenger can contest during the window. Forging is where World
wins: $500 versus $10. We take the min, so World's strength is invisible to the score and its
weakness is not.

**Why we are keeping it.** The alternative is to override the measurement with an intuition
about which protocol *deserves* to rank higher, which is exactly the failure mode this whole
design is a reaction to. If the model produces an uncomfortable answer from a sourced input,
the honest move is to publish the answer and the input together.

**What would legitimately change it.** Three things, none of which is fudging the weight:

1. A better rental-floor measurement. The $0.50 figure is one researcher's observation on one
   date. If the real floor is $15 — the top of the observed range — the Orb score becomes 3.18
   and the wrinkle disappears. Update `rentCostCents`, and every consumer's score moves at
   once, with an event and a block number.
2. `require_user_presence` in wide deployment raises the rent floor materially, because a
   rented account then needs the holder live at verification time rather than once at handover.
3. Graph-position and concentration signals, which would penalise a rented account by its
   company rather than by its credential. Not built.

**The honest bound:** if the $0.50 figure is wrong, the Orb score is wrong by exactly
log₁₀ of the ratio, and nothing else in the model compensates. That is the cost of a curated
weight, stated plainly. See
[threat-model.md](threat-model.md#sybils-below-the-detection-floor-and-wrong-weights).

---

## Thresholds

`isHuman(threshold)` throws without an explicit numeric threshold. That is enforced in the type
system rather than requested in a doc, because it is the single decision most likely to be
skipped.

At a plausible 2% residual sybil rate, a classifier at 90% TPR and 95% specificity has **26.9%
precision** — it is wrong about roughly three of every four people it flags, excluding ~4,900
real people per 100,000. Reaching 95% precision needs ~99.90% specificity, which nothing
published approaches
([`research/landscape/behavioral-scorers.md`](../research/landscape/behavioral-scorers.md)).

Therefore: **a score may escalate; it must not silently deny.** Ask for another credential
rather than refusing. Named presets exist as constants you have to reach for —
`Thresholds.lenient` 1.5, `.standard` 2.5, `.strict` 3.5 — and never as a default.

Rough calibration against the deployed ontology:

| Score | What clears it |
|---|---|
| ~0.9 | a Proof of Humanity registration minted last week |
| ~1.7 | one cheap-to-rent credential: an Orb account, or a Circles avatar |
| ~2.4 | a PoH registration a year old, or two weak independent roots |
| ~3.3 | a passport-rooted credential, or several independent roots |
| ~3.5+ | a KYC-rooted credential plus independent corroboration |

Note that the threshold is itself an attack surface. Farmers optimise to whatever cut is in
use, and the signature is a spike in the score histogram immediately above it
([`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§4.2). Corroborate does not currently plot that histogram — an integrator running at scale
should.

---

## The revision is part of the answer

Every number above comes from a weight that is a **dated human judgement**, and judgements get
corrected. Revision 34 alone moved three trust roots, retired a placeholder root and added
fifteen adapters. Each of those edits changes historical scores retroactively: a subject told
"2.56 on Tuesday" cannot reproduce that number on Wednesday, and a counterparty who denied
somebody at a threshold cannot show what the ontology said at the moment they did it.

So a score is only meaningful alongside the revision it was computed against — `registryRevision`
is on every result for that reason — and the registry's own event history can be replayed:

```ts
await corroborate.resolve(subject, { asOf: 11_345_000 })            // a Sepolia registry block
await corroborate.resolve(subject, { asOf: '2026-07-25T02:00:00Z' }) // or an instant
```

Two things change, and it is worth being exact about which.

**The ontology is reconstructed exactly.** Weights, roots, curves, liveness and the adapter set
come from the registry's own `AdapterSet`/`AdapterLivenessSet` events as an indexer stored them,
and a live test requires that reconstruction to equal `allAdapters()` from the chain, field by
field, at head. Whether it is exact at *every* block reduces to one checkable fact: both mutations
bump `revision`, so recorded revisions forming exactly `1..revision()` proves nothing is missing.
When that fails the result says so and stops claiming exactness.

**The age curve is evaluated at the as-of instant**, not at the wall clock — the block's own
timestamp, so two instants inside one block do not produce two different states of the world. A
credential 100 days old then is scored at 100 days.

**Credential state is not reconstructed**, and the result says so every time. Probes read their
own chains at head; there is no cross-chain archive path that would let ten adapters answer as of
a Sepolia block. What *is* fixed exactly is the direction that would favour an adversary: a
credential dated after the as-of instant did not exist then and is excluded. What remains is a
credential held then and revoked since, which we cannot see — so an as-of score can understate the
subject and never the adversary. Undated credentials are the third case: they are counted, because
dropping them would penalise a subject for a field their protocol does not store, and they are
listed in `asOf.existenceUnverified` so that part of the score is legibly a statement about today.

Worked, on a real subject holding Proof of Humanity v2 plus two Holonym credentials and a Human
Passport:

| | now (revision 34) | as of block 11,345,000 (revision 15) |
|---|---|---|
| Score | **3.61** | **1.07** |
| Independent roots | 4 | 1 |
| Total cost | $40.73 | $0.11 |
| PoH v2 contribution | 11.19c | 10.72c |

Nothing about the subject moved between those two calls. The Holonym and Passport credentials are
unpriced at revision 15 because they had not been researched yet — named in
`asOf.adaptersNotYetInRegistry`, with a caveat saying the drop is *a change in what we knew, not
in the subject*. The PoH contribution differs by half a cent because the survival ramp was
evaluated twelve hours earlier.

---

## What the model does not do

- It does not weight by evidence class. A `Uniqueness` credential and a `SocialTrust`
  credential of equal cost contribute equally. Class is reported, not scored.
- It does not use Circles graph position. `trustedByCount` is fetched and exposed in
  `detail`, but no modifier consumes it yet.
- It does not bound the sum. Enough independent roots will keep adding, where a real model
  should probably concave off.
- It does not compute confidence intervals, and it should. Every weight is a point estimate
  with no stated error.
- It does not reconstruct credential *state* at a past block, only the ontology. `asOf` scores
  the past against credentials read at head, minus the ones provably issued since. See above for
  which direction the residual error runs in.
