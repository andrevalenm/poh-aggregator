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
   Civic Pass (dead)        ──┘                    per Coinbase's own vendor disclosure

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

Additive scoring ranks the farm first by a factor of ~2. Root-cost aggregation reverses it.
The test asserts both directions — that the person wins under our model, *and* that a naive
sum would have inverted the ranking. If saturation ever broke, the second assertion fails.

```bash
cd packages/sdk && npm test    # 30 tests
```

---

## Architecture

Four pieces. Nothing runs on a server of ours; there is no server of ours.

### 1. Registry — `PersonhoodRegistry.sol`, Sepolia [`0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9`](https://sepolia.etherscan.io/address/0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9)

The on-chain ontology: 15 adapters across 10 trust roots, each with an evidence class, a
forge cost, a rent cost, a decay half-life, a liveness flag, and the `research/` file its
weight was derived from.

**It stores protocols. It never stores people.** The obvious design — a mapping from address
to humanity score — is rejected on purpose. A permanent, globally enumerable record asserting
"this address is a verified human" is itself a harm: revocation cannot unpublish it, and
whoever maintains it becomes the one party able to join a user's World ID, passport proof and
social graph. We do not need that join key, because correlation is a property of the
credential class. No user is ever linked to anything here, so there is no honeypot to breach
and nothing to subpoena. Every weight change emits an event, so a subject can ask "why did my
score move?" and get an answer with a block number.

### 2. Subgraph — [`api.studio.thegraph.com/query/77602/poh/v0.0.1`](https://api.studio.thegraph.com/query/77602/poh/v0.0.1)

Indexes Proof of Humanity v2 and Circles v2 on Gnosis. It supplies the two things a boolean
contract read cannot: **issuance dates** and **graph position**.

`isHuman(addr)` answers "does this credential exist". It cannot answer "when was it issued" —
decay needs an event, not a storage slot — and PoH is currently airdrop-inflated, so age is
most of the signal there. It also cannot answer "how many avatars trust this one", which is
the only part of a Circles registration that carries weight. Without the subgraph the SDK
degrades to contract reads: scores stay correct, but every result carries the
`issuance-date-unknown` caveat instead of decay.

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

### 5. Demo + agent apps — [`apps/`](apps)

**In progress at time of writing.** `apps/demo` is a browser demo that runs the same SDK
client-side against the live registry; `apps/agent` is a stub. Judge the SDK, the registry,
the subgraph and the MCP server — those are done and tested.

---

## Quickstart

### SDK

```bash
git clone <this repo> && cd poh-aggregator
npm install
```

```ts
import { readFileSync } from 'node:fs'
import { Corroborate } from '@corroborate/sdk'

// The registry stores ids as keccak hashes to keep storage cheap; supply the
// preimages to get readable names back. The ontology JSON is the source of truth.
const ontology = JSON.parse(readFileSync('ontology/adapters.json', 'utf8'))

const corroborate = new Corroborate({
  knownIds: ontology.adapters.map((a: { id: string }) => a.id),
  knownRoots: Object.keys(ontology.trustRoots),
})

// A subject is an address SET. Real people spread credentials across wallets.
// ENS names work too: resolve('vitalik.eth').
const result = await corroborate.resolve([
  '0xd267eba602e692216703626a81157214b24c85fb', // holds Proof of Humanity v2
  '0x317C407725145Fa197701045c3383F58fa14204B', // holds Circles v2
])

console.log(result.score)            // 2.7412
console.log(result.independentRoots) // 2
console.log(result.totalCostCents)   // 550  ($5.50 to defeat)

for (const r of result.roots) console.log(r.trustRoot, r.contributionCents, r.saturated)
//  social-vouching:poh   500  false
//  social-trust:circles   50  false

for (const c of result.caveats) console.log(c.code)
//  independent-control-not-attested
//  multi-address-subject
//  issuance-date-unknown
```

Those are the real values from that call, run against the live registry and live chains.

**`isHuman` throws without a threshold, and that is the feature:**

```ts
result.isHuman(2.5)   // true
result.isHuman()      // TypeError: isHuman requires an explicit numeric threshold
```

At a plausible 2% residual sybil rate, a classifier with 90% TPR and 95% specificity has
**26.9% precision** — it is wrong about roughly three out of four people it flags, excluding
~4,900 real people per 100,000. Reaching 95% precision needs ~99.90% specificity, which
nothing published approaches. So denial is the caller's decision to own, enforced in the type
system rather than asked for in a doc. Named presets are exported (`Thresholds.lenient` 1.5,
`.standard` 2.5, `.strict` 3.5) — as constants you must reach for, never as a default.

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
        "CORROBORATE_SUBGRAPH_URL": "https://api.studio.thegraph.com/query/77602/poh/v0.0.1"
      }
    }
  }
}
```

`CORROBORATE_SUBGRAPH_URL` is optional — without it the server still works, results just carry
the `issuance-date-unknown` caveat. `CORROBORATE_REGISTRY` overrides the registry address.

### Tests

```bash
# 17 contract tests (needs Foundry on PATH)
forge test

# 30 SDK unit tests — the scoring model, no network
cd packages/sdk && npm test

# 11 live tests — real chains, the deployed registry, no mocks
cd packages/sdk && node --test --experimental-strip-types src/live.test.ts
```

All 58 pass as of writing. The live tests hit real chains on purpose: the failure mode we care
about is "an adapter silently stopped matching reality", and a mock cannot catch that. They
assert the seeded ontology loads, that the ICAO cluster really does have three protocols on
one root, that discontinued protocols are marked dead, and that rent never exceeds forge for
any adapter.

---

## Honest limits

This section is deliberately near the top rather than buried. The biggest deployment in this
space failed loudest not on its math but on having no stated method and no appeal path.

**1. The weights are dated curated judgements, not measurements.** Every `forgeCostCents` and
`rentCostCents` in [`ontology/adapters.json`](ontology/adapters.json) is a human judgement
derived from `research/`, dated 2026-07-25. This is the honest weak point of the whole design.
What we do about it: every weight is on-chain, carries its `sourceURI`, and emits an event on
change — so it is auditable and contestable rather than an opinion in a black box. It is still
a judgement.

**2. Nothing here attests independent control.** A verified, unique, live, fresh human acting
under someone else's direction passes every check in this system and every check in every
system we surveyed. The on-chain signature of puppeteering is identical to that of voluntary
delegation. Every result carries a permanent, non-suppressible
`independent-control-not-attested` caveat. This is Ohlhaver's critique
([`research/references/ohlhaver-corpus.md`](research/references/ohlhaver-corpus.md)) accepted
into the design rather than argued away.

**3. Proof of Humanity is currently airdrop-inflated.** Roughly 1,299 of 1,364 lifetime
registrations arrived in a four-month window tracking a ~$9.94 PNK claim one-for-one,
`requiredNumberOfVouches()` is 1, and `HumanityRevoked` has fired exactly once ever. Weight by
registration age, not by the boolean — which is what the subgraph is for. Its weight should be
re-measured in October 2026 after the reward pool empties.

**4. The registry curator is a single EOA tonight.**
`0xE3C03709B2b8439Eb07Aac06CC4Fa9886CE5BF87`, a burner. Honest and fully auditable — every
change is an event — but not decentralised. `transferCuratorship` exists; a multisig or a
curation market is the obvious next step and is not built.

**5. Coverage is 4 of 15 adapters.** The other eleven are priced in the ontology but not yet
probed. An absent credential is reported as absence of evidence, never as evidence of absence.

**6. World ID has no verified positive vector yet.** The adapter is verified working against
World Chain, but no Orb-verified address turned up in the windows scanned, so every World
lookup so far has legitimately returned `false`.

**7. The subgraph is still backfilling.** It answers queries and reports no indexing errors,
but at time of writing it has not reached the Circles start block, so Circles enrichment falls
back to the vendor indexer.

**8. We cannot offer maximal unlinkability and maximal dedup at once.** An aggregator is a
cross-application deduplicator by definition; app-scoped nullifiers make cross-app dedup
impossible by construction. We chose unlinkability, and saturation is the price we pay for it.

Full adversary analysis, including what we defend and what we cannot:
[`docs/threat-model.md`](docs/threat-model.md).

---

## Deployed

| What | Where |
|---|---|
| `PersonhoodRegistry` | Sepolia (11155111) [`0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9`](https://sepolia.etherscan.io/address/0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9) |
| Deploy tx | [`0xd4d81610…1327b344`](https://sepolia.etherscan.io/tx/0xd4d81610ad85dcdfd1e7fe547f643122f6d0bbe9c06cd5eafe5999dd1327b344) at block 11343959 |
| Curator (EOA, burner) | `0xE3C03709B2b8439Eb07Aac06CC4Fa9886CE5BF87` |
| Subgraph | `https://api.studio.thegraph.com/query/77602/poh/v0.0.1` |
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
the observed resale floor, so it scores 1.71. We take the min. See
[`docs/scoring.md`](docs/scoring.md#the-world-id-wrinkle).

**The Graph.** The subgraph is not decoration — it carries the half of the model that contract
reads cannot reach. Decay needs `claimedAt`, which is an event; the airdrop-inflation
correction needs the registration-rate curve, which is a daily rollup; the Circles modifier
needs `trustedByCount`, which is a graph traversal. `ProtocolDay` exists specifically so an
integrator can *see* an airdrop happening to a credential they depend on.

**ENS.** A subject is an address set, and a set needs a handle. The SDK resolves ENS names
anywhere an address is accepted (`resolve('vitalik.eth')`, verified against mainnet), so a
person with a PoH wallet and a separate Circles avatar can be referred to by one name rather
than by two hex strings the caller must keep in sync. Registering `corroborate.eth` on Sepolia
and publishing the registry address as a text record is next and is **not done**.

---

## Docs

- [`docs/scoring.md`](docs/scoring.md) — the scoring model: root-cost aggregation, the
  sale-versus-rental argument for `min(forge, rent)`, freshness half-lives, and a worked
  example with real ontology numbers including the case where our own model produces an
  uncomfortable answer.
- [`docs/threat-model.md`](docs/threat-model.md) — what Corroborate defends against, what it
  provably cannot, each tied to the research file it derives from.

## Research

Every weight in the registry traces to [`research/INDEX.md`](research/INDEX.md) — 23 files,
~21,000 lines of primary-source research written 2026-07-24 against live sources: contracts
queried over RPC, repos read at HEAD, prices fetched the same day. Volatile facts are
date-stamped; unconfirmed claims are marked `UNVERIFIED:` rather than guessed. If you read
four files, read the four the index nominates — one of them is the strongest argument that
this product should not exist, kept at full strength.

```
research/
  protocols/   9 deep-dives: contracts, SDKs, trust model, integration surface
  landscape/  12 sweeps: prior art, standards, vendors, the adversary, the market
  references/  the Ohlhaver corpus, read in full and treated as an argument against us
  scripts/     reproducible on-chain measurement
```

## Repo layout

```
contracts/       PersonhoodRegistry.sol + 17 Foundry tests
ontology/        adapters.json — the trust-root ontology, source of truth for seeding
packages/sdk/    scoring engine, adapters, subgraph client, ENS resolution
packages/mcp/    MCP server over the SDK
subgraph/        The Graph subgraph: PoH v2 + Circles v2 on Gnosis
apps/            demo (in progress) and agent (stub)
scripts/         deploy, seed, and the on-chain vector sweep
research/        the 23 files every weight derives from
docs/            scoring model and threat model
```

## Licence

MIT. See [LICENSE](LICENSE).
