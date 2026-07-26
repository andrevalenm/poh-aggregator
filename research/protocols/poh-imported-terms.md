# Proof of Humanity v2 — the term behind an expiry is not always this contract's

**Researched 2026-07-26.** Sources: the verified implementation
`0x85b88E38fb6cbc8059009902F76c47F902373F52` (Blockscout, Gnosis), the proxy
`0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`, PoH v1 on mainnet
`0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb`, PoH v2 on mainnet
`0xbE9834097A4E97689d9B667441acafb456D0480A`. Every number below was read from those four
contracts at Gnosis block 47,390,776 (2026-07-25T22:40Z) or from the registry's own logs.

Answers open question 1 of [poh-endings-the-index-cannot-see.md](poh-endings-the-index-cannot-see.md),
which asked what `nbRequests == 0` should mean at head. The answer turned out to be that
`nbRequests` was the wrong question.

---

## 1. The one subtraction every PoH score rests on

`pohAdapter` dates a humanity as `expirationTime - humanityLifespan()`. Two `eth_call`s, no
indexer, nothing that can lag — which is why iteration 1 moved PoH's date onto it and out of the
subgraph. It is exact, because both places the contract writes an expiry write the same thing:

```solidity
// executeRequest, L1176 — and rule, L1358, identically
humanity.expirationTime = uint40(block.timestamp).addCap40(humanityLifespan);
```

There is a third writer, and it does not:

```solidity
// ccGrantHumanity, L502-521
function ccGrantHumanity(bytes20 _humanityId, address _account, uint40 _expirationTime)
    external onlyCrossChain returns (bool success) {
    Humanity storage humanity = humanityData[_humanityId];
    if (humanity.owner != address(0x0) && block.timestamp < humanity.expirationTime) return false;
    require(humanityData[accountHumanity[_account]].requestCount[_account] == 0);
    humanity.owner = _account;
    humanity.expirationTime = _expirationTime;        // ← copied, not computed
    accountHumanity[_account] = _humanityId;
    emit HumanityGrantedDirectly(_humanityId, _account, _expirationTime);
```

So for a humanity that arrived over the bridge, `expirationTime - humanityLifespan` is arithmetic
about a contract we did not read. Whether that matters depends entirely on whether the origin's
term is the same as ours — and this was assumed rather than measured. It is not.

## 2. Where the nine imports actually came from

`HumanityGrantedDirectly` swept over the proxy's whole life (35,846,827 → 47,390,776, full range,
served in one request by `rpc.gnosischain.com` in 339 ms). **Nine, ever.** For each: the expiry the
grant wrote, held against what mainnet publishes for the same id today.

| # | humanity | granted | expiry written | origin instance | origin's own record |
|---|---|---|---|---|---|
| 1 | `0x6687c671…8dd6` | 2024-09-06 | 2026-01-29T15:10:47 | **PoH v1** | `submissionTime` 2024-01-30T03:10:47 + 63,115,200 |
| 2 | `0xe7f13052…79bc` | 2024-09-07 | 2025-07-24T09:20:11 | **PoH v1** | 2023-07-24T21:20:11 + 63,115,200 |
| 3 | `0x6c1d079f…d373` | 2024-09-11 | 2025-04-02T18:35:11 | **PoH v1** | 2023-04-03T06:35:11 + 63,115,200 |
| 4 | `0x3b6efd21…fd8a` | 2024-10-19 | 2025-03-18T14:46:35 | **PoH v1** | 2023-03-19T02:46:35 + 63,115,200 |
| 5 | `0xb4b88049…505e` | 2024-11-29 | 2025-01-23T14:46:11 | **PoH v1** | 2023-01-24T02:46:11 + 63,115,200 |
| 6 | `0x92cf8d80…de24` | 2025-04-19 | 2025-05-31T12:44:35 | **PoH v1** | 2023-06-01T00:44:35 + 63,115,200 |
| 7 | `0xba25fd01…3854` | 2025-05-20 | 2025-06-21T16:26:23 | **PoH v1** | 2023-06-22T04:26:23 + 63,115,200 |
| 8 | `0x4fde747e…7648` | 2026-05-21 | 2026-06-06T19:37:30 | PoH v2 mainnet | `expirationTime` equal, term 31,557,600 |
| 9 | `0x000bba72…2dbe` | 2026-06-07 | 2027-04-24T19:12:40 | PoH v2 mainnet | `expirationTime` equal, term 31,557,600 |

**Seven of nine came from PoH v1, whose term is 63,115,200 s — exactly twice this contract's
31,557,600.** Every one reproduces to the second, so the attribution is a proof and not a
resemblance: `v1.getSubmissionInfo(address(humanityId)).submissionTime + v1.submissionDuration()`
*is* the number sitting in Gnosis storage.

The consequence, stated plainly: for those seven, `expirationTime - humanityLifespan` lands
**exactly one v2 lifespan — 365.25 days — after the true registration**. A two-year-old credential
was reported as a one-year-old one. On `poh-v2`'s `Ramp` at a 365-day half-life that is 0.75 of the
adapter's weight where 0.875 was earned. Wrong in the subject's disfavour, which is the safe
direction and not an excuse: it is also the direction that makes an as-of query about a real day
in that first year answer "not held".

The two v2-mainnet imports are the benign case — same term on both sides, so the subtraction
happens to be right — and they were right by luck rather than by argument. They are now right by
argument.

## 3. `nbRequests` was the wrong discriminator

The lapsed path already refused to date `nbRequests == 0`, on the reasoning in
[poh-lapsed-credentials.md](poh-lapsed-credentials.md) §2.4: no local request means this contract
never resolved one, so it cannot have written the expiry. That is **sound**. It is also
**incomplete**, and the head path had no guard at all.

State of the nine at head:

| | count | what `nbRequests` says |
|---|---:|---|
| imported, `nbRequests == 0` | 6 | correctly suspected |
| imported, `nbRequests >= 1` | **3** | **missed** |
| — of those, held at head today | 2 | scoring right now |

`requests` is only ever pushed to, never popped, and `ccDischargeHumanity` does `delete
humanity.owner` alone — so a humanity can leave and come back over an intact request history. It
can also carry a claim request that failed here, or, as #2 does, a **renewal made after the
import**: `0xe7f13052…79bc` arrived from v1 in 2024-09 and was renewed on Gnosis in 2025-07, which
moved the expiry and left `nbRequests` at 1. The existing `nbRequests > 1 → renewed` flag calls
that a first claim.

And `nbRequests` can only ever *withhold* a date. It has nothing to offer in its place.

## 4. What the chain publishes instead

`HumanityGrantedDirectly(bytes20 indexed humanityId, address indexed owner, uint40 expirationTime)`
carries the exact expiry it wrote, is indexed by humanity, and is immutable. Three states follow
from one comparison against storage:

- a grant exists carrying **this** expiry → the term is imported, exactly;
- a grant exists carrying a **different** one → this contract wrote over it, which is a renewal
  whatever `nbRequests` says;
- no grant → the term is ours.

The whole population is 9 logs over 22 months, so one memoised full-range sweep answers it for
every subject. Measured cost: **~400 ms once per adapter instance** (the sweep plus nine block
headers for the grant timestamps), then **zero** — three warm probes came in at 144/149/159 ms
against 147/159/… before the change, i.e. unchanged inside the noise. `rpc.gnosischain.com` and
`rpc.gnosis.gateway.fm` serve the full range in one request; `gnosis-rpc.publicnode.com` refuses
either way, so a chunked 2M-block fallback exists and takes six.

Once a term is known to be imported, the origin still publishes the registration it was computed
from, and *that* is the date — two mainnet calls, paid only for the ≤9 humanities the sweep has
named. Exactness is the whole check: a second-resolution match between two unrelated contracts is
provenance, anything looser is pattern-matching.

## 5. The rule, and the three decisions inside it

**A term this contract did not set may not have this contract's term subtracted from it.**

- **The origin's date is taken where it can be read** — not merely withheld. It is the correct
  answer and usually the older one, so this is a fix that *raises* six subjects' evidence rather
  than a conservative retreat. Where the origin can no longer be read (a v1 submission reapplied,
  a mainnet humanity re-claimed since), the grant block stands in as a floor under the existing
  `date-from-registry-import` note, which was written for exactly this shape.
- **An age and a window want different numbers.** `purpose: 'age'` asks how long this human has
  held the credential and the answer runs across the bridge. `purpose: 'window'` asks which
  instants *this* registry honoured the humanity for, which is what an as-of score turns into
  "held on Gnosis", and that cannot begin before the grant. Handing the origin's date to an as-of
  query would restore a Gnosis credential for a Tuesday when the registration was still on
  mainnet — the same fact about the human, a false statement about this adapter.
- **A sweep that did not answer is not a sweep that found nothing.** The same distinction
  `IndexView.entity: null` draws. A failed sweep yields `term-origin-unverified`: the date stands,
  and says it stands on the assumption the check exists to test. It is memoised on success only,
  so a rate limit is a moment rather than a property of the run. One arithmetic proof survives
  even then — no local write can put an expiry more than one full term past the block we read at,
  so an expiry that does is imported (or `humanityLifespan` has moved, in which case the
  subtraction is equally void and the same refusal is right).

## 6. What this changes, end to end

Measured through `pohAdapter().probe()` at 2026-07-26:

| subject | before | after |
|---|---|---|
| `0x000bba72…2dbe` (held, from v2 mainnet) | `issuedAt` 2026-04-24, unexplained | same date, `date-from-origin-instance`, `termOrigin: poh-v2-mainnet` |
| `0xe7f13052…79bc` (renewed here after import) | `renewed` unset | `renewed: true`, term correctly local |
| `0x6687c671…8dd6` (lapsed, v1 term, `nbRequests` 0) | `heldUntil` and **no start** — as-of could prove nothing | window `2024-09-06 → 2026-01-29`, `originRegisteredAt` 2024-01-30 |
| `0xd267eba6…85fb` (ordinary local claim) | `claimedAt` 1783963510 | unchanged |

Six previously undatable lapsed windows are now closed and dated. Nothing at head moved for any
subject in the demo: `apps/agent` still reports 3.6178 over 6 roots, identical to iterations 20–22.

## 7. Deliberately not done

- **No registry write.** No weight, root, curve, half-life or cost moved. This changes which date a
  credential gets, not what a credential is worth.
- **Renewal archaeology.** A locally renewed humanity is still dated from the renewal, and the
  `renewed` flag still says so. Recovering a first-registration date through renewal history is a
  separate question that applies to every renewed humanity, not just imported ones.
- **The sweep is pinned at the first head an adapter instance sees.** A grant mined during a
  long-lived process is missed until it restarts. That is one humanity every few months against a
  log query per subject.

## 8. Open questions

1. **Do both terms stay put?** `humanityLifespan()` is governance-settable on both v2 instances and
   `submissionDuration()` on v1 has already moved once (31,557,600 → 63,115,200). The origin lookup
   reads them live rather than pinning them, so a change is absorbed — but a change to *Gnosis's*
   would silently invalidate every locally derived date in the registry, which nothing currently
   watches. The `dateRejected` floor catches only the cases that land before the deployment.
2. **The mainnet cross-chain proxy has not been read.** The attribution here is by exact
   reproduction of the expiry, which is a proof of arithmetic rather than of plumbing. Reading
   `CrossChainProofOfHumanity` on both sides would name the bridge that carried each grant and turn
   an inference about which instance into an observation.
3. **Does the same defect exist in the other direction?** Humanities *discharged* to mainnet carry
   this contract's term into a registry that may subtract a different one. Not our score to get
   wrong, but worth reporting upstream.
