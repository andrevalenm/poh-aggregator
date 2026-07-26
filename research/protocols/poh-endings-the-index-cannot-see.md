# Proof of Humanity v2 — the endings our index cannot see

**Written 2026-07-26** against the live PoH v2 proxy on Gnosis,
`0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc`, its deployed implementation
`0x85b88E38fb6cbc8059009902F76c47F902373F52` (verified source, Blockscout,
`contracts/ProofOfHumanity.sol`), and our own protocol subgraph at `poh/v0.0.3`. Every number
below was read the day it was written and the call that produced it is named, so it can be re-run.

This is the audit iteration 20 asked for and iteration 21 left on the queue: **can any index flag
retire a credential the chain still honours?** Asked in both directions it has a second half —
*can an index fail to retire one the chain has stopped honouring?* — and that is where the defect
was.

---

## 0. Summary

| Claim | Status |
|---|---|
| Our PoH `revoked` flag can retire a credential the chain honours | **No.** `HumanityRevoked` is emitted only where the contract does `delete humanity.owner`. |
| …so the flag is fine | **Yes, and it is also empty.** 0 of 1,576 indexed humanities carry it. |
| Our PoH index can miss an ending | **Yes, in two ways.** Expiry emits no event at all; `ccDischargeHumanity` emits one we do not handle. |
| How many indexed humanities the chain no longer honours while our index shows no ending | **217 of 1,576 (13.8%)**, at Gnosis block 47,390,676. |
| Did that move a score at chain head | **No.** The chain decides `held` at head, and did. |
| Did it move one when the chain read failed | **Yes** — `held: true`, dated, at full weight. That is the defect, fixed in iteration 22. |
| Our Circles index can miss an ending | **No**, vacuously: Circles has no ending. See [circles-stop-and-the-broken-getter.md](circles-stop-and-the-broken-getter.md). |
| Any other adapter with a non-chain source deciding `held` | **None.** §5. |

---

## 1. The three ways a PoH v2 humanity ends

`isHuman(address)` is the predicate the credential *is*:

```solidity
function isHuman(address _account) public view override returns (bool) {
    Humanity memory humanity = humanityData[accountHumanity[_account]];
    return (humanity.owner == _account && block.timestamp < humanity.expirationTime);
}
```

Two conjuncts, and three ways to break them:

| # | How it ends | What is emitted | Handled by our mapping |
|---|---|---|---|
| 1 | **Revocation.** `executeRequest` (L1163) or `rule` (L1347), both `delete humanity.owner` | `HumanityRevoked(bytes20,uint256)` | **yes** |
| 2 | **Expiry.** `expirationTime` passes | **nothing at all** — there is no transaction | no, and nothing could |
| 3 | **Cross-chain transfer out.** `ccDischargeHumanity` (L540-555), `delete humanity.owner` | `HumanityDischargedDirectly(bytes20)` | **no** |

`subgraph/subgraph.yaml` registers three handlers: `HumanityClaimed`, `HumanityRevoked`,
`VouchRegistered`. So the mapping observes exactly one of the three endings, and the entity has no
`expirationTime` field to derive the second from.

## 2. The flag that works: `revoked`

The one thing an index flag must never do is retire a credential the chain still honours — that
was iteration 20's Circles bug. For PoH the flag is faithful, and the proof is in the deployed
source at the emit site, not in the event's name:

```solidity
// executeRequest, L1169-1173
if (request.revocation) {
    delete humanity.owner;
    humanity.pendingRevocation = false;
    emit HumanityRevoked(_humanityId, _requestId);
}
```

`rule` (L1345-1349) has the same pair. There is no third emitter, and `revokeHumanity` — the
*request* — emits `RevocationRequest`, not this. So the event is the ending rather than the
intention to seek one, and the mapping's `revoked = true` is a fact about the chain.

**Measured, because a source reading is a claim about the world only once the world agrees.**
`HumanityRevoked` has fired exactly **once** in the registry's life (topic
`0x1765930c…c370`, `eth_getLogs` in 500k-block pages over `[35,846,827, 47,390,471]`):

| | Gnosis block | `owner` | `pendingRevocation` | `nbRequests` |
|---|---|---|---|---|
| before | 41,268,458 | `0xCF3c78a7…9e70` | **true** | 2 |
| **the log** | **41,268,459** (2025-07-25T14:15:20Z) | `0x0` | false | 2 |
| head | 47,390,676 | `0xeb31c98C…5b4C` | false | 3 |

The transition and the log are the same block: two subsystems of the node agreeing about one
humanity, where the mapping only ever consulted the second. The head row is the other half of the
story — the humanity was **claimed again** by a different address, which is why
`handleHumanityClaimed` set `revoked = false` and why **the index today reports zero revoked
humanities out of 1,576**. The flag designed to carry PoH's endings has an empty population.

## 3. The endings that are missing, priced

### 3.1 Cross-chain discharge is a current path, not a historical curiosity

`HumanityDischargedDirectly` (topic `0xae36bccb…a901`), same sweep, same day:

| | count |
|---|---:|
| all-time | **33** |
| since 2026-05-16 | **25** |
| in the last 1.5M blocks (~3 months) | 25 |
| `HumanityGrantedDirectly` all-time (transfers *in*) | 9 |

Two humanities appear in both lists — `0x4fde747e…7648` and `0x000bba72…2dbe` — so the credential
does bounce between instances. Eight of the recent discharges, read at head:

| humanity | chain `isHuman` | `owner` | `expirationTime` | our index |
|---|---|---|---|---|
| `0x8a3ae976…67ef` | false | `0x0` | 2027-07-11 | present, `revoked: false` |
| `0xf679ce51…d148` | false | `0x0` | 2027-07-06 | present, `revoked: false` |
| `0xbdea2383…fd94` | false | `0x0` | 2027-06-19 | present, `revoked: false` |
| `0x7dbdd491…e3cc` | false | `0x0` | 2027-06-27 | present, `revoked: false` |
| `0x0b745703…c48f` | false | `0x0` | 2027-07-01 | present, `revoked: false` |
| `0x299b1650…f659` | false | `0x0` | 2027-06-23 | present, `revoked: false` |
| `0x266c2fef…4649` | false | `0x0` | 2027-06-18 | present, `revoked: false` |
| `0x9505479b…c436` | false | `0x0` | 2027-04-24 | present, `revoked: false` |

The expiry is what makes these the clean case: the term has a year still to run, so the credential
did not lapse — it *left*, and nothing in the index says so.

### 3.2 The census: 217 of 1,576

Every humanity our index holds, read through `getHumanityInfo` in Multicall3 batches of 100 at one
pinned block (47,390,676, 2026-07-25T22:31:55Z):

| state at head | count | our index says |
|---|---:|---|
| live | 1,359 | held |
| **expired, owner still set** | **21** | held |
| **owner cleared** | **193** | held |
| **owner is another address** | **3** | held |
| flagged `revoked` | 0 | — |

**217 humanities — 13.8% of the indexed population — are not held on chain and carry no ending in
our index.** Of the 193 owner-cleared, 31 still have an expiry in the future, which is the
signature of a discharge or a revocation rather than a lapse.

### 3.3 What that was worth

Nothing at chain head: `reconcile.ts` gives the chain the deciding vote on `held`, and the chain
said no for all 217. The exposure was the degraded path — `chain.unavailable`, which is an RPC
blip, a rate limit, or an adversary with a reason to arrange one. There the reconciler fell back
to the index, and the index said *held*, with `claimObserved: true` and a real claim date. On
`poh-v2`'s `Ramp` at a 365-day half-life, a two-year-old claim prices at 0.75 of the adapter's full
weight, and the subject collects a whole trust root for a credential they transferred to another
chain in May.

Two answers about one subject, chosen by our own uptime — the same shape as iteration 20's Circles
defect, in the opposite direction and with a hundred times the population.

## 4. The rule

An index earns the right to answer alone by being able to see every way the credential can stop
being held. `IndexView` now carries that as `observesEveryEnding`, beside `completeHistory`, and
`reconcile.ts` consults it on the one branch where nothing can check the index:

```
chain read failed
  └── index has the credential
        ├── observesEveryEnding: false → held: false, error, note `index-cannot-see-endings`
        └── observesEveryEnding: true  → the index answers, exactly as before
```

Three things about the shape of that, each of which was a decision:

- **It is a property of the mapping, not of the endpoint.** An index cannot report the events it
  does not handle, so asking it would be asking the wrong witness. It is declared in `subgraph.ts`
  next to the query, with the argument written out.
- **It applies to `ended: true` as well.** An index that misses endings misses re-creations too: a
  revoked humanity can be granted again from another instance without our mapping hearing, so its
  ending is no more checkable than its silence. Both become "unreadable".
- **The result is an error, not a negative.** A credential excluded this way weighs the same as one
  the chain says is absent, but a subject who loses a trust root to *our* RPC failing is owed the
  reason, and `MISSION.md`'s adapter rule 5 — a failure must never read as "not a human" — is the
  same rule read in the other direction.

Circles goes the other way for a reason established in iteration 20: `isHuman` is
`lastMintTime > 0`, nothing ever writes that word back down, so there is no ending to miss and the
index's word survives a failed chain read. The flag has to discriminate or it is just a switch
that turns the index off.

## 5. The rest of the audit

Every place a non-chain source touches an answer, and what it is allowed to decide:

| source | consumer | may decide `held`? |
|---|---|---|
| protocol subgraph, `pohHuman` | `poh-v2` | only when the chain is unreadable — **and now not even then** (§4) |
| protocol subgraph, `circlesAvatar` | `circles-v2` | yes, on the degraded path; the credential is monotone |
| `rpc.aboutcircles.com` | `circles-v2` | **no** — it supplies `trustedBy` only, and a failure leaves it absent |
| `base.easscan.org` | *(none — removed)* | Coinbase reads the EAS predeploy and Coinbase's own on-chain indexer |
| Verax subgraph | `linea-poh` **tests only** | no; the probe enumerates the registry itself |
| Studio registry subgraph | `asOf` audit trail | no; it reconstructs weights, not credentials |

Human Passport, Holonym, Farcaster, World, PoH v1 and Coinbase read chain state only, so the
question does not arise for them.

## 6. What is deliberately not done

**The subgraph is not being resynced for this.** Handling `HumanityGrantedDirectly` and
`HumanityDischargedDirectly` would close ending #3 and cost a redeploy plus a ~2.5-hour full
resync; it would not close #2, because an expiry is not an event and no mapping can hear one. An
index that handles two of the three endings still may not answer alone, so the resync buys a
better index and *not* a different rule — worth doing, not worth blocking a correctness fix on.
The only shape that would earn `observesEveryEnding: true` for PoH is an entity carrying
`expirationTime`, so the SDK can evaluate the term itself against the indexed block.

**The head path is untouched.** A protocol whose endings we cannot index must not lose its ordinary
scoring path, and PoH's date comes from the contract anyway (`expirationTime - humanityLifespan`),
so index lag has been unable to move a PoH score since iteration 1.

## 7. Open questions

1. **`nbRequests == 0` at head.** `closeLapsedHumanityWindow` refuses to derive a start from
   `expirationTime - humanityLifespan` for a humanity this contract never resolved a request for —
   it is an expiry settled on another instance, and the measurement in
   [poh-lapsed-credentials.md](poh-lapsed-credentials.md) §2.4 puts the error at −215.5 and +144.7
   days. The **head** path applies the same subtraction with no such guard and no caveat. Nine
   humanities have arrived that way; whether any is held today was not measured. The derived date
   is arguably the origin instance's claim date, which is a real date for the same human — that is
   exactly why it needs deciding rather than leaving implicit.
2. **The unattributed 3-topic event** iteration 1 found in the proxy's log census (nine
   occurrences, uint40 payload) is still unattributed. If it turns out to grant a humanity,
   `completeHistory` for PoH needs revisiting; it cannot affect a score today because PoH does not
   use the absence bound.
3. **`grantHumanityDirectly` vs the absence bound.** The index does not observe the 9 cross-chain
   grants either, so absence in it is not evidence that a humanity did not exist. The direction is
   safe — an unobserved creation makes a credential look *younger*, which caps ramp weight rather
   than granting it — and the bound is only reachable when the contract cannot date the credential,
   which for PoH is the read that already failed. Written down rather than fixed.
