# Threat model

What Corroborate defends against, and what it provably does not. Each item names the research
file it derives from, so the reasoning can be checked rather than taken on trust.

The scoring mechanics referenced here are in [scoring.md](scoring.md).

---

## Scope

Corroborate answers one question: **how expensive would it be to obtain this evidence
fraudulently, today.** It is a pricing function over public credentials, computed in the
caller's process.

It is not an authentication system, not a KYC provider, and not a fraud engine. In particular
it does not verify that the caller controls the addresses it is asked about — see
[the caller lies about the address set](#the-caller-lies-about-the-address-set), which is the
first thing an integrator must handle.

---

## What it defends against

### Double-counted trust roots

**Attack.** Present one passport to World's document tier, ZKPassport and Self; present one
Sumsub check to Galxe Passport and Linea PoH. Collect three or two "independent" credentials
for one act, and clear an additive threshold that a real person with diverse evidence cannot.

**Why it works elsewhere.** Roughly 40 protocols in the landscape collapse into about 6 trust
roots, and almost nothing in production prices that collapse. A farm's credentials are
maximally correlated by construction; a real person's are diverse. Additive scoring therefore
ranks the farm higher — it rewards exactly the pattern it exists to catch.

**Defence.** Saturation within a trust root. The strongest credential in a root counts; the
rest are discarded and reported under a `correlated-evidence-saturated` caveat naming which
adapters were folded. Because saturation operates on the credential *class*, it needs no
cross-protocol linkability and creates no correlation the protocols themselves prevent.

**Measured effect.** In the test named *"the whole thesis in one test"*, a farm holding three
ICAO-rooted credentials totals $20.00 (score 3.30) against a person holding three
differently-rooted credentials at $31.00 (score 3.49). Under naive addition the farm totals
$60.00 and wins by a factor of two. The test asserts both directions, so a regression in
saturation fails the build.

**Derives from.**
[`research/landscape/prior-art-scoring.md`](../research/landscape/prior-art-scoring.md) (why
saturation rather than Bayesian combination),
[`research/landscape/kyc-liveness-vendors.md`](../research/landscape/kyc-liveness-vendors.md)
(who actually performs each check — the root assignments come from here),
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
antipattern A1.

---

### Dead protocols scored as live

**Attack.** Acquire a credential from a protocol that has been discontinued — cheap or free,
since nobody is defending it any more — and present it to a scorer whose weights were written
while the protocol was alive.

**Why it works elsewhere.** This is not hypothetical. Civic discontinued its uniqueness and
liveness passes on 2025-07-31, and a major competitor still assigns points for a Civic stamp.
The related error is reasoning from cumulative issuance rather than live credentials: Linea PoH
V2 has issued 50,475 credentials of which roughly **502 are live**, because of a hard 90-day
expiry. Coinbase has issued 720,503 verifications and revoked 406,022 — presence alone is wrong
more than half the time.

**Defence.** Three separate mechanisms.

1. A `live` flag per adapter in the registry, with a dedicated `setAdapterLiveness(id, live,
   reason)` call that emits a reason string. Dead adapters score **0** but remain visible with
   a `discontinued-protocol` caveat, so a historical score stays explicable. Civic Pass and
   BrightID are deliberately retained in the ontology in exactly this state.
2. Explicit revocation checks in the adapters, not presence checks. The Coinbase adapter
   filters `revoked: false` in its EAS query rather than inferring from existence.
3. Decay half-lives that expire a credential on the timescale the issuer actually operates on
   — Linea PoH is set to 90 days for precisely this reason.

**Derives from.**
[`research/landscape/identity-infra-prior-art.md`](../research/landscape/identity-infra-prior-art.md),
[`research/protocols/passport-civic-fractal-zkme-galxe.md`](../research/protocols/passport-civic-fractal-zkme-galxe.md),
[`research/protocols/privado-id-and-verax.md`](../research/protocols/privado-id-and-verax.md),
[`research/protocols/eas-and-disco.md`](../research/protocols/eas-and-disco.md),
antipatterns A5 and the cumulative-vs-live illusion (§4.5).

---

### Wallet-splitting

**Attack.** Spread correlated credentials across several addresses so a scorer that saturates
per-address counts them once each instead of once in total. Or, more simply: make each wallet
look like a separate weak subject that individually clears a low bar.

**Defence.** A subject is an **address set**, and saturation spans the whole set. One passport
presented from two wallets contributes one root. There is a test asserting that the two-wallet
case scores identically to the one-wallet case.

This design was forced by a measurement rather than chosen. Across 31 credential-holding
addresses found live on Gnosis and World Chain during the build, **not one held two protocols
on the same address**, and Proof of Humanity's own Circles proxy pairs a PoH address with a
*separate* Circles avatar. An address-keyed model systematically undercounts real people while
doing nothing about the split attack.

**What we deliberately do not do.** We never infer that two addresses belong to one person.
That inference is the linkage this whole design exists to avoid, and building it would recreate
the correlation honeypot in the client. The caller supplies the set.

**Derives from.** The on-chain sweep in [`scripts/find-vectors.mjs`](../scripts/find-vectors.mjs)
and [`scripts/vectors-scored.json`](../scripts/vectors-scored.json);
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§4.4 (the deduplication problem: the same human, or the same credential, on many addresses).

---

### Airdrop inflation

**Attack.** Mass-register during a reward programme, when the protocol's own incentives have
temporarily made its credential nearly free, then present the resulting credential to a scorer
whose weight was set before the surge.

**Why it matters.** Proof of Humanity took roughly **1,299 of its 1,364 lifetime
registrations** in a four-month window, tracking a ~$9.94 PNK claim one-for-one, with
`requiredNumberOfVouches()` at 1 and `HumanityRevoked` having fired exactly once ever. The
credential did not change; its meaning did. Any protocol running a live reward programme should
be treated as compromised for its duration.

**Defence.** Two parts, and both are needed.

1. The **Ramp** age curve. For vouching registries, weight *rises* with survival rather than
   falling with age: a PoH registration seven days old carries weight 0.013 (score 0.88) while
   one that has survived three years carries 0.875 (score 2.64). The airdrop cohort discounts
   itself without anyone having to notice the airdrop. A uniform decay curve would have done
   the opposite — full weight to the surge, nothing to the organic 2021 cohort.
2. The **subgraph**, which supplies the issuance date Ramp needs. A contract read gives a
   boolean; `claimedAt` is an event. The `ProtocolDay` rollup exists so an integrator can *see*
   a registration surge happening to a credential they depend on, rather than learning about it
   from a postmortem.

Missing dates are handled asymmetrically so that suppressing the indexer is not profitable:
Ramp with an unknown date returns 0.5, never 1.

**Residual.** This is a mitigation, not a fix. A patient attacker registers during the surge
and waits a year, and Ramp will hand them 0.5. The right correction is a per-cohort weight —
discount registrations *by the window they arrived in*, not by their age — which the subgraph
now has the data for and the scorer does not implement.

**Derives from.**
[`research/protocols/poh-kleros-brightid-idena.md`](../research/protocols/poh-kleros-brightid-idena.md),
[`research/scripts/vouch_sweep.py`](../research/scripts/vouch_sweep.py) (the sweep that
produced the figure), [`subgraph/schema.graphql`](../subgraph/schema.graphql).

---

### Credentials hardened against sale but not rental

**Attack.** Rent, rather than buy. The holder keeps the credential and signs when asked, so
every anti-transfer defence in the protocol is bypassed — none of them are triggered, because
nothing is transferred.

**Defence.** `min(forgeCostCents, rentCostCents)`, with the two stored separately in the
registry so a protocol cannot raise its score by hardening only against resale. There is a test
asserting that a 90× increase in forge cost with rent held constant produces an identical
score.

**Derives from.**
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§3 (human-solver price series, $0.50–$2.99 per thousand, essentially flat since 2010), §6 (the
"can it be sold or rented?" test), antipattern A6;
[`research/protocols/world-id.md`](../research/protocols/world-id.md) (the Orb resale market).

---

### Becoming the correlation honeypot

**Attack.** Not against a user — against us. Breach, subpoena or simply buy the aggregator, and
obtain the one table that joins a person's World ID, passport proof, KYC record and social
graph. That join does not exist anywhere else by design; each protocol's nullifier scheme is
built to prevent it.

**Defence.** The registry stores protocols and never people. There is no address-to-score
mapping, no user table, no session store, no server. Scoring runs in the caller's process
against public chains. The design is possible because correlation is a property of the
credential class: to avoid double-counting one passport read by four protocols, we need to know
that those four *protocols* read one root, never that *your* four credentials do.

Consequence: a full compromise of the curator key lets an attacker publish wrong weights (see
[a dishonest curator](#a-dishonest-or-compromised-curator)). It does not leak a single user,
because there are none to leak.

**Derives from.**
[`research/references/ohlhaver-corpus.md`](../research/references/ohlhaver-corpus.md),
[`research/landscape/demand-and-regulation.md`](../research/landscape/demand-and-regulation.md)
(the correlation-honeypot liability),
[`research/landscape/prior-art-scoring.md`](../research/landscape/prior-art-scoring.md).

---

### Silent failure read as a negative verdict

**Attack.** Make a protocol unreachable — or wait for it to go down — so that a scorer treating
network errors as `false` reports an honest human as having no credentials.

**Defence.** A probe must never throw. Failures surface as an `error` with
`detail.unavailable = true` and are excluded from scoring rather than counted as a negative,
and an empty result carries a `no-evidence` caveat that says in words: *this is an absence of
evidence, not evidence of absence — most humans hold none of these.* There is a live test that
simulates an outage and asserts the failed adapter is still reported and still flagged.

---

## What it does not defend against

These are the load-bearing limitations. None of them is fixed by more adapters.

### The caller lies about the address set

`resolve()` takes the addresses it is given and **does not verify the caller controls them**.
Pasting a known credential-holding address into an unauthenticated integration produces a
perfect score for anyone.

This is deliberate — proving control is a signature check the integrator already has to perform
for their own session, and duplicating it here would mean holding user state — but it means
**Corroborate is only as good as the authentication in front of it**. An integration that lets
a user type an arbitrary address into a box has no sybil resistance at all, regardless of what
the score says. This is the single most likely way to deploy it wrong.

---

### Puppeteering and rented humans

A verified, unique, live, fresh human acting under someone else's direction passes every check
in this system and every check in every system we surveyed. The on-chain signature of
puppeteering is identical to the signature of voluntary delegation, so no amount of evidence
collection separates them.

Idena is the worked case: delegation pools grew until they controlled a decisive share of the
network, and the crisis was invisible until delegation itself made pool size measurable. It is
retained in our ontology, marked dead, because it is the best-documented failure in the field.

**What we do about it:** every result carries a permanent, non-suppressible
`independent-control-not-attested` caveat. Not a footnote, not suppressible by a flag, and
present even on an empty result. This is Ohlhaver's critique accepted into the design rather
than argued away.

**What would help and is not built:** concentration metrics. We will never *prove* puppeteering,
but top-N-entity share and a Gini coefficient over every grouping we can observe — funding
source, referrer chain, issuer, verification timing — would surface a cluster of 200
credentials that all pass, all fresh, all correlated in time. That is the shape of the problem
made visible in advance, and nobody in this space currently ships it.

**Derives from.**
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§2.3 (Idena), §3.3 (human-in-the-loop verification and the collapse of "liveness"),
antipatterns A2 and A7;
[`research/references/ohlhaver-corpus.md`](../research/references/ohlhaver-corpus.md).

---

### A dishonest or compromised curator

The registry curator is a single EOA — `0xE3C03709B2b8439Eb07Aac06CC4Fa9886CE5BF87`, a burner
wallet. It can set any weight for any adapter. A curator who wanted to inflate one protocol,
suppress a competitor, or mark a live protocol dead can do so unilaterally.

**Partial mitigations, all real but none sufficient:**

- Every mutation emits an event carrying the full record and a monotonic `revision`. Weight
  history is reconstructible from logs; a subject can ask why their score moved and get an
  answer with a block number.
- Every adapter carries a `sourceURI` pointing into `research/`, so a weight can be argued with
  rather than merely observed. Live tests assert every weight cites a `research/` file.
- Results carry the `registryRevision` they were computed against, so a score is reproducible.
- Scoring is client-side, so a consumer who disagrees can pin their own registry address
  (`registryAddress` on the client, `CORROBORATE_REGISTRY` in the MCP server) and ignore ours
  entirely.

**Not mitigated:** there is no multisig, no timelock, no curation market, and no appeal path.
`transferCuratorship` exists and has not been used. This is a hackathon deployment and should
be treated as one.

---

### Sybils below the detection floor, and wrong weights

The base rate forbids individual-level exclusion. At 90% TPR and 95% specificity against a 2%
residual sybil rate, precision is **26.9%** — 4,900 real people excluded per 100,000. Reaching
95% precision requires ~99.90% specificity, which nothing published approaches. The published
record is worse than the theory: Arbitrum open-sourced Louvain clustering and leaked 21.8%;
BlockScience's honest recall interval was 57–100%; the largest published flag rate came with no
recall figure at all.

Corroborate does not claim to beat any of that. It prices credentials; it does not detect
sybils. An attacker willing to spend $31 per identity on genuinely independent roots gets a
score of 3.49 and is indistinguishable from the person in our own headline test. **The model
raises the price; it does not close the door.** The honest product claim is bounded: *passing
threshold T costs an attacker at least $X per identity, as of date D* — and nothing stronger.

**A wrong weight breaks this directly.** Every cost in the ontology is a dated human judgement,
not a measurement. If `rentCostCents` for an adapter is wrong by a factor of k, every score
containing it is wrong by log₁₀ k, and nothing else in the model compensates. The World ID Orb
case in [scoring.md](scoring.md#the-world-id-wrinkle) is a live example of a single sourced
observation carrying a whole adapter's weight.

The right correction is red-teaming: buy the credentials at their listed prices, run them
through the pipeline, and count what passes — measuring **leakage**, not detections. That
costs a few hundred dollars and has not been done.

**Derives from.**
[`research/landscape/behavioral-scorers.md`](../research/landscape/behavioral-scorers.md) (the
base-rate arithmetic),
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
§1 and antipattern A11 (measuring detections instead of leakage).

---

### Unlinkability and deduplication cannot both be maximised

An aggregator is a cross-application deduplicator by definition. App-scoped nullifiers make
cross-app dedup impossible by construction. We chose unlinkability; saturation is the price we
pay, and it is a real price — a subject legitimately holding a passport credential and a
separate, genuinely independent document credential may be saturated as if they were one, and
we cannot tell the difference.

Stating which side you chose is the point. The failure mode of not choosing is claiming both
and delivering neither.

**Derives from.**
[`research/landscape/sybil-incidents-antipatterns.md`](../research/landscape/sybil-incidents-antipatterns.md)
(the dedup/privacy conflict),
[`research/protocols/zk-passport-and-eid.md`](../research/protocols/zk-passport-and-eid.md)
(four incompatible nullifier derivations over one chip).

---

### Unresolved trust roots

Humanity Protocol is scored under the root `unknown` because its own API defines `is_human` as
"passed a KYC check **OR** palm enrollment" and the KYC provider is unnamed. An unknown root is
scored as if independent — which is the *unsafe* direction — and flagged with an
`unresolved-trust-root` caveat saying so. If Humanity Protocol turns out to be Sumsub- or
Persona-rooted, every score combining it with a Sumsub- or Persona-rooted credential is
currently overstated.

Resolving the vendor is open question #3 in
[`research/INDEX.md`](../research/INDEX.md).

---

## Displacement

For every defence above, the discipline is to name what the next-cheapest attack becomes. The
short version for Corroborate as it stands: once saturation, `min(forge, rent)` and the age
curves are all working, **the cheapest attack is to buy genuinely independent roots** — a
rented Orb account plus a rented Persona-rooted KYC account plus a matured Circles avatar. At
the deployed weights that is about $31 per identity for a score of 3.49, and it defeats
everything in this document.

That number is the product. It is not zero, it is checkable, and it is the only claim the
evidence supports.
