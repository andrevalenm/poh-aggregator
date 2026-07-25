# Corroborate

**Corroborate** *(v.)* — to confirm with independent evidence.

One SDK over every proof-of-personhood protocol, scored by what an adversary would actually
pay. Built at ETHGlobal Lisbon, 2026.

---

## The problem, in one diagram

There are roughly forty proof-of-personhood protocols. They collapse into about six trust
roots. Each collapse below is traced to a primary source in [`research/`](research/INDEX.md).

```
   PROTOCOLS (what an app integrates)              TRUST ROOTS (what is actually checked)
   ───────────────────────────────────             ──────────────────────────────────────

   World ID (document tier) ──┐
   ZKPassport                 ├──────────────────► state-document:icao-9303
   Self Protocol              │                    one passport chip, one CSCA signature
   Rarimo                   ──┘

   Galxe Passport v3        ──┬──────────────────► kyc-vendor:sumsub
   Linea PoH V2             ──┘                    also idOS, Solana Attestation Service

   Coinbase Verified Acct   ──┬──────────────────► kyc-vendor:persona
   Civic Pass (discontinued)──┘                    per Coinbase's own vendor disclosure

   Anima Proof of Uniqueness ─────────────────────► kyc-vendor:facetec-synaps

   World ID (Orb)           ──────────────────────► iris-registry:world-orb
   Proof of Humanity v2     ──────────────────────► social-vouching:poh
   Circles v2               ──────────────────────► social-trust:circles
```

**One passport read by three protocols is one credential, not three.** A scorer that adds
credentials therefore fails in the adversary's favour, because a farm's credentials are
maximally correlated (one document, presented everywhere) while a real person's are diverse
(an iris, a bank KYC, a social graph). Additive scoring ranks the farm *above* the person.

We cannot fix this by deduplicating credentials: ZKPassport scopes its nullifier per service
and never publishes an unscoped value, Self publishes a global one, World hashes a
neighbouring field. Four incompatible derivations over one chip. Dedup would require linking
a user's credentials to each other — exactly the correlation those nullifier designs exist to
prevent.

**The fix:** correlation is a property of the credential *class*, not the user. We never need
to know that *your* two credentials share a root, only that those two *protocols* read the
same root — a public fact about the world.

> **Saturate within a trust root, sum across roots, price each root at min(forge, rent).**

Zero cross-protocol linkability required. Full derivation in [`docs/scoring.md`](docs/scoring.md).

---

## The farm and the person

From [`packages/sdk/src/scoring.test.ts`](packages/sdk/src/scoring.test.ts), the test named
*"the whole thesis in one test"*. Both subjects hold **three credentials**.

| | Farm — one passport, three protocols | Person — three unrelated credentials |
|---|---|---|
| Credentials | World ID (doc), ZKPassport, Self | World ID (Orb), Circles v2, Coinbase |
| Independent trust roots | **1** | **3** |
| Naive additive total | **$60.00** | $31.00 |
| Corroborate root-cost total | $20.00 | **$31.00** |
| **Corroborate score** | **3.30** | **3.49** |

Additive scoring ranks the farm first by a factor of two. Root-cost aggregation reverses it.
The test asserts both directions — that the person wins under our model, *and* that a naive
sum would have inverted the ranking. If saturation ever broke, the second assertion fails.

```bash
cd packages/sdk && npm test    # 34 tests
```

---

## Architecture

Five pieces. Nothing runs on a server of ours; there is no server of ours.

### 1. Registry — `PersonhoodRegistry.sol`, Sepolia [`0x977b028b900cce8ee89c46877e814eff3060aa07`](https://sepolia.etherscan.io/address/0x977b028b900cce8ee89c46877e814eff3060aa07)

The on-chain ontology: **15 adapters across 10 trust roots**, each with an evidence class, a
forge cost, a rent cost, an age curve, a liveness flag, and the `research/` file its weight was
derived from. Currently at revision 15.

**It stores protocols. It never stores people.** The obvious design — a mapping from address
to humanity score — is rejected on purpose. A permanent, globally enumerable record asserting
"this address is a verified human" is itself a harm: revocation cannot unpublish it, and
whoever maintains it becomes the one party able to join a user's World ID, passport proof and
social graph. We do not need that join key, because correlation is a property of the
credential class. No user is ever linked to anything here, so there is no honeypot to breach
and nothing to subpoena. Every weight change emits an event carrying the full record and a
monotonic revision, so a subject can ask "why did my score move?" and get an answer with a
block number.

### 2. Subgraph — [`api.studio.thegraph.com/query/77602/poh/version/latest`](https://api.studio.thegraph.com/query/77602/poh/version/latest` — plus a second subgraph, the registry audit trail, self-hosted at `http://37.27.67.44:8100/subgraphs/name/corroborate-registry)

Indexes Proof of Humanity v2 and Circles v2 on Gnosis. It supplies **issuance dates** where the
protocol keeps none on chain, **graph position**, and **the block every answer belongs to**.

`isHuman(addr)` answers "does this credential exist" and nothing else. It cannot say how many
avatars trust this one, which is the only part of a Circles registration that carries weight,
and it cannot date a Circles registration at all — the Hub stores no registration timestamp, so
the ramp that discounts fresh avatars has no input without an index.

**Each index read returns the entity and the block the index had reached, in the same request.**
That is not bookkeeping. Probing the contract for existence and the index for the date treats
two different moments as one, and while the index is behind, a real credential came back held
with no date — the `Ramp` 0.5 midpoint, roughly twenty-three times what a week-old registration
earns. Index lag silently moved scores, in the attacker's favour. Now absence at a *named* block
is itself evidence: a credential missing from an index with complete history was issued after
that block, which caps its age, and the result says so. Where the index covers only a window of
history, absence proves nothing, the contract read stands alone as before, and the caveat names
the gap. See [`packages/sdk/src/reconcile.ts`](packages/sdk/src/reconcile.ts).

Proof of Humanity needs none of that, because it dates itself on chain:
`expirationTime − humanityLifespan()` is the claim timestamp, two `eth_call`s, no indexer in the
path. PoH scores are therefore identical with and without the subgraph — there is a live test
asserting exactly that — and the index becomes a cross-check whose disagreements are reported
as our fault rather than the subject's.

### 3. SDK — [`packages/sdk`](packages/sdk)

Reads the ontology from the registry, probes chains directly, and scores **in the caller's
process**. An aggregator that collected credentials centrally would become the correlation
honeypot the registry design exists to avoid.

A subject is an **address set**, not an address. This was forced by a measurement: across 31
credential-holding addresses found live on Gnosis and World Chain, not one held two protocols
on the same address — and Proof of Humanity's own Circles proxy pairs a PoH address with a
*separate* Circles avatar. One human, one wallet per protocol. The caller supplies and
authenticates the set; we never infer that two addresses belong to one person, because that
inference is the linkage we exist to avoid. Saturation spans the set, so splitting credentials
across wallets cannot inflate a score — there is a test for exactly that.

Four adapters are implemented, all readable **without vendor cooperation** — no API key on the
critical path, nothing that can rate-limit or revoke us: World ID Orb (AgentBook `lookupHuman`
on World Chain), Proof of Humanity v2 (Gnosis), Circles v2 (Gnosis + trust graph), Coinbase
Verified Account (EAS on Base, revocation checked explicitly — 720,503 issued against 406,022
revoked, so presence alone is wrong more than half the time).

### 4. MCP server — [`packages/mcp`](packages/mcp)

Three tools for agents: `lookup_personhood`, `check_personhood`, `explain_trust_roots`. No
tool returns a bare boolean, and nothing writes. An agent that gets a number cannot reason
about its own uncertainty, so every response carries the evidence, the trust roots, and what
was discounted as correlated — the agent asks *why*, not just *whether*.

### 5. Demo and agent apps — [`apps/`](apps)

[`apps/demo`](apps/demo) is a browser demo: it runs the same SDK **client-side** against the
live registry, computes the farm-vs-person comparison in your browser rather than serving a
precomputed picture, and takes a comma-separated address set for lookup.

[`apps/agent`](apps/agent) is a World AgentKit demo: an agent signs a CAIP-122 challenge, a
fictional counterparty checks that a real human stands behind it via AgentBook plus
Corroborate, and picks its own threshold. The threshold lives in the counterparty's policy
file, not in our SDK — that separation is the point of the demo.

Both were built last and are the least polished thing here.

---

## Quickstart

```bash
git clone <this repo> && cd poh-aggregator
npm install
```

### SDK

```ts
import { Corroborate, Thresholds } from '@corroborate/sdk'

const corroborate = new Corroborate()

// A subject is an address SET. Real people spread credentials across wallets.
// ENS names work anywhere an address does: resolve('vitalik.eth').
const result = await corroborate.resolve([
  '0xd267eba602e692216703626a81157214b24c85fb', // holds Proof of Humanity v2
  '0x317C407725145Fa197701045c3383F58fa14204B', // holds Circles v2
])

result.score            // 1.5683  — log10 of adversary cost in cents
result.independentRoots // 2
result.totalCostCents   // 36      — $0.36 to obtain this evidence fraudulently

result.roots
//  { trustRoot: 'social-trust:circles', contributionCents: 25.0, saturated: false }
//  { trustRoot: 'social-vouching:poh',  contributionCents: 11.0, saturated: false }

result.evidence[0].provenance
//  { heldFrom: 'chain', dateFrom: 'chain', headBlock: 47382483, notes: ['index-unavailable'] }

result.caveats.map((c) => c.code)
//  independent-control-not-attested
//  multi-address-subject
//  issuance-date-unknown          // circles only: the Hub keeps no registration date
```

Those are the real values from that call against the live registry and live chains on
2026-07-25, and they will drift, because both credentials sit on `Ramp` curves and the ramp
moves with the calendar. The PoH claim is 11.7 days old, so survival weight prices it at 0.022
of its $5.00 rent — the anti-airdrop curve discounting a real credential of ours, which is the
model working rather than the model failing. `dateFrom: 'chain'` is PoH being dated by
`expirationTime − humanityLifespan()` with no indexer involved; Circles has no such slot, so
without a `subgraphUrl` it takes the flagged 0.5 midpoint. Pass one and this same call returns
**1.0909** with **1** independent root, because the real Circles avatar turns out to be 1.6 days
old and the ramp prices it at $0.003 — below the floor at which a root counts as independent.
See [`docs/scoring.md`](docs/scoring.md#4-apply-the-age-curve).

**`isHuman` throws without a threshold, and that is the feature:**

```ts
result.isHuman(1.5)                  // true
result.isHuman(Thresholds.standard)  // false  (standard = 2.5)
result.isHuman()                     // TypeError: isHuman requires an explicit numeric threshold
```

At a plausible 2% residual sybil rate, a classifier with 90% TPR and 95% specificity has
**26.9% precision** — it is wrong about roughly three out of four people it flags, excluding
~4,900 real people per 100,000. Reaching 95% precision needs ~99.90% specificity, which
nothing published approaches. So denial is the caller's decision to own, enforced in the type
system rather than asked for in a doc. `Thresholds.lenient` (1.5), `.standard` (2.5) and
`.strict` (3.5) are exported as constants you must reach for, never as a default.

### MCP server

```bash
cd packages/mcp && npm run build
```

```json
{
  "mcpServers": {
    "corroborate": {
      "command": "node",
      "args": ["/absolute/path/to/poh-aggregator/packages/mcp/dist/server.js"],
      "env": {
        "CORROBORATE_SUBGRAPH_URL": "https://api.studio.thegraph.com/query/77602/poh/version/latest"
      }
    }
  }
}
```

`CORROBORATE_SUBGRAPH_URL` is optional — without it the server still works, and PoH is dated
from the chain either way; what is lost is Circles' registration date and graph position, so
those results carry the `issuance-date-unknown` caveat. `CORROBORATE_REGISTRY` pins a different registry, so a
consumer who disagrees with our weights can run their own and ignore ours entirely.

### Demo

```bash
cd apps/demo && npm run dev     # http://localhost:5173
```

### Tests

```bash
# 18 contract tests (needs Foundry on PATH)
forge test

# 66 SDK tests: 51 unit (scoring model, index reconciliation, input handling) + 15 live
cd packages/sdk && npm test

# the 15 live ones alone — real chains, the deployed registry, no mocks
cd packages/sdk && node --test --experimental-strip-types src/live.test.ts

# 10 browser E2E against the built demo, real chains
cd apps/demo && npx playwright test
```

All 94 pass as of 2026-07-25. The live tests hit real chains on purpose: the failure mode we
care about is "an adapter silently stopped matching reality", and a mock cannot catch that. They
assert the seeded ontology loads, that the ICAO cluster really does have three protocols on
one root, that discontinued protocols are marked dead, that every weight cites a `research/`
file, that rent never exceeds forge for any adapter, that the chain-derived PoH date matches the
index's to within the hour, and that a real credential outside the index's window is flagged
rather than silently re-dated.

---

## Honest limits

This section is deliberately near the top rather than buried. The biggest deployment in this
space failed loudest not on its math but on having no stated method and no appeal path.

**1. The weights are dated curated judgements, not measurements.** Every `forgeCostCents` and
`rentCostCents` in [`ontology/adapters.json`](ontology/adapters.json) is a human judgement
derived from `research/`, dated 2026-07-25. This is the honest weak point of the whole design.
What we do about it: every weight is on-chain, carries its `sourceURI`, and emits an event on
change — auditable and contestable rather than an opinion in a black box. It is still a
judgement. If a rent cost is wrong by a factor of *k*, every score containing it is wrong by
log₁₀ *k*, and nothing else in the model compensates.

**2. Nothing here attests independent control.** A verified, unique, live, fresh human acting
under someone else's direction passes every check in this system and every check in every
system we surveyed. The on-chain signature of puppeteering is identical to that of voluntary
delegation. Every result carries a permanent, non-suppressible
`independent-control-not-attested` caveat. This is Ohlhaver's critique
([`research/references/ohlhaver-corpus.md`](research/references/ohlhaver-corpus.md)) accepted
into the design rather than argued away.

**3. Corroborate does not authenticate the address set.** `resolve()` scores whatever addresses
it is handed. An integration that lets a user type an arbitrary address into a box has no sybil
resistance at all, regardless of what the score says. Proving control is the integrator's job
and duplicating it here would mean holding user state — but this is the most likely way to
deploy it wrong.

**4. Proof of Humanity is currently airdrop-inflated.** Roughly 1,299 of 1,364 lifetime
registrations arrived in a four-month window tracking a ~$9.94 PNK claim one-for-one,
`requiredNumberOfVouches()` is 1, and `HumanityRevoked` has fired exactly once ever. We weight
by registration age rather than the boolean — a `Ramp` curve, where a week-old registration
scores 0.88 and a three-year-old one scores 2.64, so the airdrop cohort discounts itself. That
is a mitigation, not a fix: a patient attacker registers during the surge and waits. Re-measure
in October 2026 after the pool empties.

**5. The registry curator is a single EOA tonight.**
`0xE3C03709B2b8439Eb07Aac06CC4Fa9886CE5BF87`, a burner. Honest and fully auditable — every
change is an event — but not decentralised. There is no multisig, no timelock, and no appeal
path. `transferCuratorship` exists and has not been used.

**6. Coverage is 4 of 15 adapters.** The other eleven are priced in the ontology but not yet
probed. An absent credential is reported as absence of evidence, never as evidence of absence.

**7. World ID has no verified positive vector yet.** The adapter is verified working against
World Chain, but no Orb-verified address turned up in the windows scanned, so every World
lookup so far has legitimately returned `false`.

**8. The subgraph covers only a two-month window of Circles.** It is synced and reports no
indexing errors, but its Circles data source starts at block 46300000 while the Hub's first
registration was at 36501311, so the oldest and most legitimate avatars are missing from it — and
avatars it *does* have may be dated from a trust edge rather than their registration, which
understates their age. Both cases are now detected and flagged (`index-coverage-partial`,
`issuance-date-lower-bound`) instead of silently mis-dated, and both are fixed by widening the
window and re-syncing. PoH is indexed from its deployment block and is dated from the chain
regardless.

**9. We cannot offer maximal unlinkability and maximal dedup at once.** An aggregator is a
cross-application deduplicator by definition; app-scoped nullifiers make cross-app dedup
impossible by construction. We chose unlinkability, and saturation is the price.

**10. The score raises the price; it does not close the door.** An attacker willing to spend
~$31 per identity on genuinely independent roots scores 3.49 and is indistinguishable from the
person in our own headline test. That number *is* the product claim, and it is the only one the
evidence supports.

Full adversary analysis: [`docs/threat-model.md`](docs/threat-model.md).

---

## Deployed

| What | Where |
|---|---|
| `PersonhoodRegistry` (v2) | Sepolia (11155111) [`0x977b028b900cce8ee89c46877e814eff3060aa07`](https://sepolia.etherscan.io/address/0x977b028b900cce8ee89c46877e814eff3060aa07) |
| Deploy tx | [`0xe6b715cd…4677e427`](https://sepolia.etherscan.io/tx/0xe6b715cde4c0d7cb27041ee61f8b4de8d06dfe7bd2e2f306b67e0ca24677e427) at block 11344158 |
| Curator (EOA, burner) | `0xE3C03709B2b8439Eb07Aac06CC4Fa9886CE5BF87` |
| `PersonhoodRegistry` (v1) | [`0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9`](https://sepolia.etherscan.io/address/0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9) — superseded by v2 (age curves, plaintext event ids), left deployed, same ontology |
| Subgraph | `https://api.studio.thegraph.com/query/77602/poh/version/latest` |
| World ID (Orb) read | AgentBook `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` — World Chain |
| Proof of Humanity v2 | `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc` — Gnosis |
| Circles v2 Hub | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` — Gnosis |
| Coinbase Verified Account | EAS schema `0xf8b05c79…70f0de9` — Base |

Canonical values live in [`deployments/sepolia.json`](deployments/sepolia.json).

### Tracks

**World.** World ID is the highest-weight uniqueness credential in the ontology and the one
that forced the cost model. We read the Orb tier permissionlessly — AgentBook's `lookupHuman`
is a plain `eth_call`, no API key, no relying-party id, no user interaction — which is why the
adapter cannot be rate-limited or revoked out from under an integrator. It is also the
protocol we price *down*: forging an iris enrolment costs ~$500, but renting one costs $0.50 at
the observed resale floor, so it scores 1.71 — below Proof of Humanity. We own that result
rather than fudging it: [`docs/scoring.md`](docs/scoring.md#the-world-id-wrinkle). The AgentKit
demo in [`apps/agent`](apps/agent) puts the whole thing to work: an agent proves a human stands
behind it, and the counterparty — not us — picks the line.

**The Graph.** The subgraph is not decoration — it carries the half of the model contract reads
cannot reach. Circles keeps no registration timestamp on chain, so its ramp has no input without
an index; the airdrop-inflation correction needs the registration-rate curve, which is a daily
rollup; the Circles modifier needs `trustedByCount`, which is a graph traversal. `ProtocolDay`
exists specifically so an integrator can *see* an airdrop happening to a credential they depend
on, rather than reading about it in a postmortem. And every read returns the block the index had
reached, which is what lets *absence* from the index be used as evidence — a credential missing
from a fully-indexed history was issued after that block, so the index bounds an age it has not
yet seen. Where we found a date the chain could answer for itself (PoH's `expirationTime`), we
took it off the index and left the index cross-checking it, because an indexer on the critical
path of a score is a dependency we would rather not have.

**ENS.** A subject is an address set, and a set needs a handle. The SDK resolves ENS names
anywhere an address is accepted (`resolve('vitalik.eth')`, verified against mainnet), so a
person with a PoH wallet and a separate Circles avatar can be referred to by one name rather
than two hex strings the caller must keep in sync. Registering `corroborate.eth` on Sepolia and
publishing the registry address as a text record was in flight at the time of writing — check
[`deployments/`](deployments) for whether it landed.

---

## Docs

- [`docs/scoring.md`](docs/scoring.md) — the scoring model: root-cost aggregation, the
  sale-versus-rental argument for `min(forge, rent)`, the decay-versus-ramp age curves, a
  worked example over the real ontology, and the case where our own model produces an answer
  we do not like.
- [`docs/threat-model.md`](docs/threat-model.md) — what Corroborate defends against, what it
  provably cannot, each tied to the research file it derives from.

## Research

Every weight in the registry traces to [`research/INDEX.md`](research/INDEX.md) — **23 files,
~21,000 lines** of primary-source research written 2026-07-24 against live sources: contracts
queried over RPC, repos read at HEAD, prices fetched the same day. Volatile facts are
date-stamped; unconfirmed claims are marked `UNVERIFIED:` rather than guessed. If you read four
files, read the four the index nominates — one of them is the strongest argument that this
product should not exist, kept at full strength.

```
research/
  protocols/   9 deep-dives: contracts, SDKs, trust model, integration surface
  landscape/  12 sweeps: prior art, standards, vendors, the adversary, the market
  references/  the Ohlhaver corpus, read in full and treated as an argument against us
  scripts/     reproducible on-chain measurement
```

## Repo layout

```
contracts/       PersonhoodRegistry.sol + 18 Foundry tests
ontology/        adapters.json — the trust-root ontology, source of truth for seeding
packages/sdk/    scoring engine, adapters, subgraph client, ENS resolution
packages/mcp/    MCP server over the SDK
subgraph/        The Graph subgraph: PoH v2 + Circles v2 on Gnosis
apps/demo/       browser demo — same SDK, client-side, live registry
apps/agent/      World AgentKit demo — human-backing check for an agent
scripts/         deploy, seed, ENS, and the on-chain vector sweep
research/        the 23 files every weight derives from
docs/            scoring model and threat model
```

## Licence

MIT. See [LICENSE](LICENSE).
