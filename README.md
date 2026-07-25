# Corroborate

**Corroborate** *(v.)* — to confirm with independent evidence.

One SDK over every proof-of-personhood protocol, scored by what an adversary would actually
pay. Built at ETHGlobal Lisbon, 2026.

[![What does it cost to be human?](apps/demo/public/og.jpg)](http://37.27.67.44:8788)

**Live:** [landing + demo](http://37.27.67.44:8788) · [console](http://37.27.67.44:8788/app.html) ·
[registry on Sepolia](https://sepolia.etherscan.io/address/0x977b028b900cce8ee89c46877e814eff3060aa07) ·
[protocol subgraph](https://api.studio.thegraph.com/query/77602/poh/version/latest) ·
[weight audit trail](http://37.27.67.44:8100/subgraphs/name/corroborate-registry)
— everything computes in your browser against live chains; nothing is precomputed.

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

   Coinbase Verified Acct   ──────────────────────► kyc-vendor:persona
                                                    per Coinbase's own vendor disclosure

   Anima Proof of Uniqueness──┐
   Civic Pass (discontinued)  ├──────────────────► kyc-vendor:facetec
   Holonym (biometrics)     ──┘                    Synaps-hosted, Civic-direct or Holonym's
                                                   own server — one technique defeats all

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
cd packages/sdk && npm test    # 389 tests
```

---

## Architecture

Five pieces. Nothing runs on a server of ours; there is no server of ours.

### 1. Registry — `PersonhoodRegistry.sol`, Sepolia [`0x977b028b900cce8ee89c46877e814eff3060aa07`](https://sepolia.etherscan.io/address/0x977b028b900cce8ee89c46877e814eff3060aa07)

The on-chain ontology: **30 adapters across 18 trust roots**, each with an evidence class, a
forge cost, a rent cost, an age curve, a liveness flag, and the `research/` file its weight was
derived from. Currently at revision 34. The six largest roots carry 18 of the 30 adapters —
one passport chip alone is read by four of them, which is the whole argument for saturation.
`research/landscape/ontology-coverage.md` is the audit trail: every adapter, every root, every
cost anchor, and the protocols we deliberately refuse to score.

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

**The registry subgraph makes the audit trail executable rather than printable.** The weights are
dated human judgements and they change: one seed moved three trust roots, retired a placeholder
root and added fifteen adapters. Every such edit silently rewrites history for anybody holding an
old score. `resolve(addr, { asOf: block })` scores against the ontology as the registry actually
held it then — and that is the one read here an archive node cannot serve, because reconstructing
an entity *set* at block N means already knowing every adapter id. Graph Node keeps each mutable
entity version with the block range it was current for, so it is one query. The reconstruction is
checked rather than trusted: a live test requires the ontology the indexer reports at head to
equal `allAdapters()` from the chain field by field, all thirty adapters. See
[`packages/sdk/src/as-of.ts`](packages/sdk/src/as-of.ts).

Building on it found a real bug in the audit trail. `AdapterLivenessSet` carries only the hashed
adapter key, and the mapping loaded `Adapter` by that hash while entities are keyed on the
plaintext id — so it matched nothing and **every liveness flip was dropped silently**. It had
never fired on the deployed registry, which is why nobody noticed; it also happens to be the
mutation a score feels hardest, since `live: false` zeroes a credential outright. There is now an
`AdapterKey` reverse index (asserted live to be `keccak256("adapter:" ++ id)` for all thirty
adapters) and a `LivenessChange` entity, so the flip lands in the audit trail beside the reason
the curator gave for it.

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

Ten adapters are implemented, all readable **without vendor cooperation** — no API key on the
critical path, nothing that can rate-limit or revoke us: World ID Orb (`WorldIDAddressBook` and
AgentBook on World Chain), Proof of Humanity v2 (Gnosis), Proof of Humanity v1 (the original
registry on Ethereum mainnet), Circles v2 (Gnosis + trust graph), Coinbase
Verified Account (EAS on Base, revocation checked explicitly — 720,503 issued against 406,022
revoked, so presence alone is wrong more than half the time), Human Passport
(`GitcoinResolver.getCachedScore` across all seven Decoder deployments), Farcaster
(`IdRegistry` on OP Mainnet), Holonym / Human ID's two credentials — the government-ID check
and the FaceTec biometric — from Hub V3 on OP Mainnet, and Linea Proof of Humanity V2 from the
Verax registry on Linea.

Farcaster is where the age curve does the work. A fid costs an adversary $0.44 and $0.20 a year,
and two thirds of the registry was minted inside a nine-month subsidy window — so the boolean is
worth nothing and the *date* is the entire signal. The registry stores no dates. It does not need
to: `idCounter` is monotone and `register()` increments it in the same transaction that writes
custody, so the first block where `idCounter() >= fid` is the block that fid was created in, found
by searching archive state and confirmed against the `Register` log the probe never reads. Two
things fall out of that search and change the answer — fids ≤ 193,791 were imported wholesale from
the predecessor registry by an admin `SetIdCounter`, so they are older than their date; and fids
are transferable, so what gets dated is *this address's custody*, not the fid. A fid still held by
its importer is worth 12.19 cents and one independent root; fid 1, bought in January 2026, is
worth 3.07 cents and none.
[`research/protocols/farcaster-onchain-read.md`](research/protocols/farcaster-onchain-read.md).

Human Passport is the interesting one, because it is itself an aggregator. Its stamps are
frequently credentials this ontology already prices: one live subject's score of 22.027 is a
Holonym government-ID check plus a Holonym FaceTec biometric and *nothing else* — two roots we
already had, re-scored by somebody else's weights. So we never import the number. The passport
is rooted at wallet history and priced at the farmed-wallet market (a dollar), its stamps are
mapped back to the adapters that own them, and the result says so out loud:
`aggregate-restates-other-credentials`. The whole thesis, on one address:
[`research/protocols/human-passport-onchain-read.md`](research/protocols/human-passport-onchain-read.md).

That read is one mapping lookup, so the question underneath it is *who is allowed to write to
that mapping*. Passport's resolver answers on two independent grounds and both were moved rather
than read: a stranger calling it reverts `NotAllowlisted()`, and EAS itself calling it with a
struct attesting to anyone but Passport's own attester contract reverts `InvalidAttester()`. So
every credential we count is now checked against the attestation behind it — un-revoked, still
naming this subject, written by the attester **the resolver names at run time** — five distinct
addresses across the seven chains, so a table of constants would have been five chances to be
wrong about somebody's identity. A mismatch removes the credential; a read that
would not answer never does. [`research/protocols/passport-attester-pin.md`](research/protocols/passport-attester-pin.md).

Holonym closes that loop, because it is the protocol behind both of those stamps. The same
address now reads directly against Holonym's Hub on Optimism and both credentials are there —
so the collapse is one credential seen from two directions rather than a stamp name we trusted.
Reading it properly took three things the vendor's own API skips or hides. The Hub's source
warns that an SBT is **forgeable unless you check the issuer in its public values**, since
anyone can run an issuer key; the Hub burns the nullifier it is *handed* rather than the one the
circuit derived, so uniqueness needs its own read; and there is no issuance date anywhere,
deliberately — the circuit tells users to pick a random expiry to hide when they were verified.
What survives that is a proof: `V3.circom` constrains `expiry - iat < 31,536,001`, so *expiry
minus one year* is the earliest a credential can have been issued, which on a decay curve is the
oldest it can be and therefore a weight floor rather than a guess. It also means a Holonym
credential hard-expires within a year of the check behind it.
[`research/protocols/holonym-human-id-onchain-read.md`](research/protocols/holonym-human-id-onchain-read.md).

Linea PoH V2 is the one where the *absence* of a read turned out not to matter. Verax stores an
attestation's subject as raw bytes and the Sumsub portal registers no indexer module, so there is
genuinely no "does address X hold this" call — which is why Linea ships a signature-based path
instead. It does not need one, because the credential **expires in 90 days** and `attestedDate` is
monotone in attestation id: every unexpired attestation in the whole registry therefore sits in a
**1,024-id window out of 6,366,748**, read whole in six batched calls. So the probe holds the
complete live population — 500 attestations over 499 addresses — and a `false` here means *we read
every live credential and you are not in it*, which is a stronger claim than a vendor boolean can
make. It is also a more accurate one: `poh-api.linea.build` returned `true` for 45 of 45 addresses
whose attestations had all lapsed, the signer API signs for them, and Linea's own `PohVerifier`
accepts that signature on chain — so the documented integration answers "was ever verified" for a
population 101× larger than the one that exists. And the authority worth pinning is not the portal
(our own research had named the dead test one, which would have matched nobody while appearing to
work) nor the `attester` field (simulating `attest` from a stranger and from Sumsub's own key gives
the identical `ECDSAInvalidSignature` revert, so the gate is a signature and the attester is just a
relayer) but the portal's registered **owner**, in a registry only Consensys can add to.
[`research/protocols/linea-poh-onchain-read.md`](research/protocols/linea-poh-onchain-read.md).

World is the one where the *date* was the defect. `AgentBook.lookupHuman` — the read this project
shipped first — returns a nullifier and no date, and an undated credential on a decay curve is
scored at full weight forever, so every World credential we found was priced as if issued this
morning. World Chain has a second contract that fixes both halves of that: `WorldIDAddressBook`
writes `addressVerifiedUntil[account] = block.timestamp + 168 days` after a Semaphore proof of an
Orb credential clears, which makes `verifiedUntil − 168 days` the **exact** second the verification
was mined — checked against block headers on 24 samples spanning fifteen months — and makes `held`
a comparison rather than a presence check, because the mapping is never cleared and more than half
of a sampled 2025-04 cohort is lapsed. A binding renewed 162 days ago is now worth 45.13 cents
instead of 50.00. The contract also refuses a second live binding per World ID nullifier, so **one
live verified address per human is enforced on chain** rather than assumed — and that an entry means
a real proof is demonstrable on demand: simulating `verify` reverts `NonExistentRoot()` with an
invented merkle root and `ProofInvalid()` with the group's real one, identically for a stranger, for
World's own relayer and for the contract's owner. The document and Selfie tiers, by contrast, leave
no per-holder state anywhere, and the write-up says so with the measurements rather than leaving a
gap in the queue. The AgentBook half is dated now too, from the block its `AgentRegistered` event
was mined in — a topic-filtered query over the whole history in one call, guarded by a canary wide
enough that an endpoint which cannot see a registration from March is refused rather than believed,
because "no log" would silently become "no date" and no date is full weight. An agent registered 73
days ago is worth 47.73 cents instead of 50.00.
[`research/protocols/world-id-onchain-read.md`](research/protocols/world-id-onchain-read.md),
[`research/protocols/world-agentbook-fleets.md`](research/protocols/world-agentbook-fleets.md) §7.

Proof of Humanity v1 is the one that measures how much of a protocol is left. Same trust root as
v2 on purpose — a subject registered in both holds one vouched identity, not two, and saturation
is the thing that says so. `isRegistered` is `registered && now - submissionTime <=
submissionDuration`, and the struct's `registered` flag is **never cleared on expiry**: 33 of 215
sampled submitters have it set with the credential long dead, so the field `getSubmissionInfo`
hands you is wrong about them. The comparison was checked against history rather than trusted —
`true` eleven seconds before a submission's term ran out, `false` one second after, with zero logs
from the registry in between. PoH v2 cannot write to the frozen contract, so it keeps an overlay
(`ForkModule.removed`) recording registrations it has retired, and one of the nine set there went
on being honoured by v1 for **510 days** after v2 retired it — which is why `held` reads both.
Enumerating the whole registry from its own event history gives the number worth knowing:
**2 registered addresses out of 20,740 lifetime submissions**, both expiring in late 2026. `live:
true` here means the contract works, not that the protocol has users, and the ontology note says
exactly that.
[`research/protocols/poh-v1-onchain-read.md`](research/protocols/poh-v1-onchain-read.md).

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
Corroborate, and picks its own limits. The limits live in the counterparty's policy file, not
in our SDK — that separation is the point of the demo.

`npm run ens` in the same app is the second flow: the same counterparty, the same policy
engine, but the agent presents an **ENS name** instead of an AgentBook registration. It resolves
the human behind the name, the human's acknowledgement of that agent, every sibling under the
tree, and then shows what a self-published binding costs — one agent walks the per-human cap by
naming a second wallet of its own operator, until the policy requires the acknowledgement.

Its last two runs are the **presenter gate**: everything above is read from public records, so
none of it says the party on the connection holds anything. Each agent answers an ERC-4361
challenge with the wallet its name designates and 2 of 3 are admitted — the same result as
without the gate, because proof costs an honest agent nothing. Then the *same three names* are
presented by a wallet generated one second earlier, with identical records, identical human and
identical score: **0 of 3**.

Its fourth gate is a **fleet policy**, `evaluateFleet()` in the SDK. A counterparty declares
`maxAgentsPerHuman`, `minScore`, `minIndependentRoots`, what to do with agents nobody
registered, and which of a human's agents keeps the slot; the engine allocates the slots and
each refusal names the sibling that took one. It runs over the whole fleet rather than the
requester, because AgentBook's registration log says in advance how many agents a human has —
a venue that waits to be asked has already served the first N. Live, at the time of writing:
**1,164 registered agents over 830 humans, and one human runs 27 of them**, all registered
inside 0.7 days. The engine also prices the policy from the deployed registry: under
Meridian's line a slot costs an adversary at least **$5.50**, so those 27 slots cost $148.50
with the cap and $5.50 without it.

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

result.score            // 1.5683  — log10 of adversary cost in cents, stamped 2026-07-25.
                        // It creeps upward daily: the PoH credential is on a survival ramp,
                        // so surviving is the thing that earns the weight. 1.5687 today.
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

**A score is only meaningful with the revision it was computed against, so you can ask for a
past one:**

```ts
const corroborate = new Corroborate({
  registrySubgraphUrl: 'http://37.27.67.44:8100/subgraphs/name/corroborate-registry',
})

const subject = [
  '0xd267eba602e692216703626a81157214b24c85fb', // Proof of Humanity v2
  '0xA6b7471fe0338F8B45266734A1346E6f1D7267b1', // Holonym gov-ID + biometric, Human Passport
]

await corroborate.resolve(subject)                          // 3.61  · 4 roots · revision 34
await corroborate.resolve(subject, { asOf: 11_345_000 })    // 1.07  · 1 root  · revision 15
await corroborate.resolve(subject, { asOf: '2026-07-25T02:00:00Z' })  // same, by instant
```

Nothing about that subject moved between those two calls. What moved is what we knew: at revision
15 the ontology had fifteen adapters and Holonym and Human Passport were not among them, so the
result names them in `adaptersNotYetInRegistry` and the caveat says the drop is *a change in what
we knew, not in the subject*. The surviving PoH credential is priced at 10.72 cents rather than
11.19, because the survival ramp is evaluated at the as-of block's timestamp and not at the wall
clock. It refuses rather than degrades: without `registrySubgraphUrl` it throws, because answering
a question about the past with today's weights and stamping a block number on it is worse than not
answering. And it says what it cannot see — credentials are read at chain head, so the corrections
it can make it makes exactly, and it names the residue.

Both corrections come from dates the protocol already stores. One dated *after* the as-of instant
did not exist then and is dropped. And one the chain dates the *end* of — an EAS revocation, a
World verification term that ran out, a Proof of Humanity registration or humanity whose term
expired — was held for the whole window between its issuance and that end, so if the instant falls
inside it the credential is **restored and priced at what it was worth then**, and the result says
so in `ceasedAfterAsOf`. Six registries produce those windows, and each does so for the same
reason: none of them deletes the ending. EAS attestations are immutable, `WorldIDAddressBook`
keeps a lapsed `addressVerifiedUntil` forever, PoH v1 never clears `submission.registered` when a
term runs out, PoH v2 leaves `owner` and `expirationTime` on an expired humanity, Human Passport's
resolver keeps a cached score long after the Decoder has started reverting on it, and a lapsed
Verax attestation still carries both its `attestedDate` and its ending. That matters more than
it sounds: 5,143 of the Coinbase attestations in our sampled windows are revoked, about half a
sampled World cohort has let its term lapse, and Linea PoH has issued **50,475 attestations of
which ~495 are alive** — so for that protocol the lapsed population *is* the population, and
reading it costs three extra batched calls. Every one of those used to make a historical score
quietly lower than the subject's real position. Restoring
requires an *exact* issuance date, never a lower bound — a bound shows a credential could have
existed at an instant, never that it did — so the cases where only the ending is dated are listed
in `ceasedStartUndated` and left out. What remains invisible is a credential whose ending the
protocol does not date at all, which still understates the subject and never the adversary.

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

# 389 SDK tests: 271 unit (scoring model, index reconciliation, input, ontology, SBT
# interpretation, Verax attestation selection, World address-book interpretation, PoH v1
# submission interpretation, as-of reconstruction, fleet policy, ENS agent identity,
# ENS presenter authentication) + 118 live
cd packages/sdk && npm test

# the live ones alone — real chains, the deployed registry, no mocks
cd packages/sdk && node --test --experimental-strip-types src/live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/human-passport.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/farcaster.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/holonym.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/linea-poh.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/world.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/as-of.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/agentbook.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/ens-agents.live.test.ts
cd packages/sdk && node --test --experimental-strip-types src/ens-presentation.live.test.ts

# 13 browser E2E against the built demo, real chains
cd apps/demo && npx playwright test
```

564 of them exist as of 2026-07-26 (18 forge + 533 SDK + 13 browser) and 562 pass. Two SDK tests
are red and named: the deployed registry gained two adapters from another working copy and this
tree's ontology has not caught up (`MORNING.md`, "Needs you" item 18). Nothing skips against a
pinned subgraph version; against Studio's `version/latest` the free-tier quota can throttle the
four tests that consult it, and some live tests likewise skip rather than fail when the
third-party Verax indexer they cross-check against returns HTTP 429 — an unreachable source says
nothing about the mechanism under test. The live tests hit real chains on purpose: the failure mode we
care about is "an adapter silently stopped matching reality", and a mock cannot catch that. They
assert the seeded ontology loads, that the ICAO cluster really does have three protocols on
one root, that discontinued protocols are marked dead, that every weight cites a `research/`
file, that rent never exceeds forge for any adapter, that the chain-derived PoH date matches the
index's to within the hour, and that a real credential outside the index's window is flagged
rather than silently re-dated. The Passport suite asserts the mechanism rather than a score,
because every score in it expires in ninety days: our derived expiry must equal the one the
Decoder computes in Solidity and returns in its revert payload, on whatever address it is
pointed at. The Farcaster suite does the same for a date rather than a number: the block our
counter search picks must be the block the registry's own `Register` log for that fid is in, with
none in the thousand blocks before it — two subsystems of the node agreeing about one fid, where
the probe only ever consulted the first. The as-of suite asserts the reconstruction against the
chain rather than against itself: the ontology the indexer reports at head must equal
`allAdapters()` field by field, every revision the registry counted must appear in the audit
trail, and the acceptance test scores one real PoH v1 registration twice — unchanged on a
contract frozen since 2021, worth $3.51 under revision 34 and nothing under revision 15, because
that is when we had not researched the protocol yet.

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

**6. Coverage is 10 of 30 adapters.** The other twenty are priced in the ontology but not yet
probed — and that is now the end of the road rather than a backlog: every remaining entry is
documented in `research/landscape/ontology-coverage.md` §6 as gated, off-chain or dead, so no
further probe is possible without putting a vendor on the critical path. An absent credential is
reported as absence of evidence, never as evidence of absence.

**7. World's document and Selfie tiers cannot be read at all.** Not by us and not by anyone
without World's cooperation: a World ID 4.0 credential leaves no per-holder state on any chain,
and the only v4 registry is keyed by issuer rather than by holder. Both tiers stay in the ontology
priced, rooted and `implemented: false`, with the measurements behind that in
[`research/protocols/world-id-onchain-read.md`](research/protocols/world-id-onchain-read.md) §5.
What *is* readable — the Orb tier — is now read from the registry World actually populates.

**8. The index is trusted about its own coverage, and only about that.** Both data sources now
run from their protocol's own first block — Circles from the Hub's deployment (36486014) rather
than the two-month window that shipped first — so an avatar's absence is evidence about the world
and its date is its own `RegisterHuman`. The index states its earliest indexed event in an
`IndexCoverage` entity and the SDK compares that against the protocol's first credential block to
decide whether absence counts; a redeploy with a narrower window therefore loses the claim to
complete history by itself instead of leaving a constant in this package asserting it. What is
*not* fixed by this: a credential the index holds only through a side-event still cannot be dated
from it, and which direction that error runs is protocol-specific — a Circles trust edge cannot
precede the registration it points at (`issuance-date-lower-bound`, a floor), while a PoH vouch is
cast on a claim that has not resolved and therefore precedes it (`index-date-precedes-issuance`, a
bound that caps weight rather than a date).

**9. We cannot offer maximal unlinkability and maximal dedup at once.** An aggregator is a
cross-application deduplicator by definition; app-scoped nullifiers make cross-app dedup
impossible by construction. We chose unlinkability, and saturation is the price.

**10. The score raises the price; it does not close the door.** An attacker willing to spend
~$31 per identity on genuinely independent roots scores 3.49 and is indistinguishable from the
person in our own headline test. That number *is* the product claim, and it is the only one the
evidence supports.

**11. A stopped Circles avatar still scores, and we read that from storage because the Hub's own
getter cannot answer it.** `stop()` is irreversible and ends personal-Circles minting; it does not
deregister, because it writes `type(uint96).max` to `mintTimes[a].lastMintTime` and `isHuman` is
that same field `> 0`. So the credential is held, and the most we can say is that the address may
be one its human has walked away from — a `credential-minting-stopped` caveat, not a revocation.
The reason it is read from slot 21 rather than from the contract is that
`stopped(address _human)` validates `_human` and then reads `mintTimes[msg.sender]`: an `eth_call`
with no `from` runs as the zero address and reports **false for every avatar that has ever
stopped**, and reports *true* for one that never did if the caller happens to have. The Hub is not
behind a proxy, so that cannot be fixed in place. Our residual is the mirror image: a hard-coded
slot in someone else's contract. It is checked against `isHuman` on every call, so a moved layout
costs us the flag and can never invent one — measured over 40 avatars sampled from the Hub's logs
each live run. [`research/protocols/circles-stop-and-the-broken-getter.md`](research/protocols/circles-stop-and-the-broken-getter.md).

**12. Pinning an issuer excludes third parties, not the issuer.** Passport's cached score is now
checked per subject against the EAS attestation behind it, and the resolver enforces the same
thing itself on two independent grounds — so nobody outside Passport can put a score in that
mapping. But the resolver is UUPS-upgradeable by its owner and that owner can also add writers to
an allowlist that emits no event and cannot be enumerated, so *Passport* can write whatever it
likes about anybody. The same holds for every hosted credential in the ontology: Holonym's issuer
key, Linea's portal owner, World's Orb. This is what a trust root *is*, which is why the weight
tracks the root's cost rather than the strength of any signature check — and why a passport is
priced at a dollar. [`research/protocols/passport-attester-pin.md`](research/protocols/passport-attester-pin.md).

**13. Our PoH index cannot see two of the three ways a humanity ends, so it is no longer allowed
to answer alone.** The mapping handles `HumanityRevoked` — faithful, and empty: the registry has
had exactly one revocation, it was re-claimed afterwards, and 0 of 1,576 indexed humanities carry
the flag today. What it cannot handle is an expiry, which emits no event for anyone to index, and
a cross-chain transfer out, which emits one we do not handle — 33 all-time and **25 since
2026-05**. So **217 of those 1,576 humanities (13.8%) are not held on chain and carry no ending in
the index**. At head that costs nothing: the chain decides. When the Gnosis read *failed*, the
reconciler fell back to the index and returned them held, dated and at a full trust root — the
same subject scored differently depending on our own uptime, which is the torn read this
architecture exists to remove. An index now declares whether it observes every ending
(`observesEveryEnding`), and one that does not is excluded as **unreadable** rather than counted
or denied, with `index-cannot-see-endings`. Circles keeps its fallback for the opposite reason:
its credential is monotonic, so there is no ending to miss. The residual is that PoH's degraded
path is now silence — a subject whose credential is real loses it from the score whenever Gnosis
is unreachable, which is the direction we would rather be wrong in.
[`research/protocols/poh-endings-the-index-cannot-see.md`](research/protocols/poh-endings-the-index-cannot-see.md).

**14. A PoH credential that arrived from another chain carries that chain's term, and we used to
subtract ours from it.** Every PoH v2 score is dated `expirationTime − humanityLifespan()`, which
is exact only where this contract wrote the expiry. Its cross-chain bridge writes ones it did not
compute, and of the **nine humanities ever imported, seven came from PoH v1, whose term is twice as
long** — so the subtraction landed exactly one v2 lifespan (365.25 days) after the true
registration and priced a two-year-old credential as one year old. The guard that existed
(`nbRequests == 0`) is sound and **misses three of the nine**, two of them held and scoring today,
because a transfer out leaves the request history intact and a renewal after an import adds to it.
Now the registry's own `HumanityGrantedDirectly` log decides it — one memoised sweep, ~400 ms once
per process and nothing warm — and where the term is foreign the origin instance's own registration
supplies the date, required to reproduce our expiry to the second first. What it does **not**
close: both terms are governance-settable, and a change to Gnosis's would silently invalidate every
locally derived date without anything noticing. The direction of the old error was in the subject's
disfavour rather than an adversary's, which is why it survived this long.
[`research/protocols/poh-imported-terms.md`](research/protocols/poh-imported-terms.md).

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
| World ID (Orb) read | `WorldIDAddressBook` `0x57b930D551e677CC36e2fA036Ae2fe8FdaE0330D` and AgentBook `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` — World Chain |
| Proof of Humanity v2 | `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc` — Gnosis |
| Circles v2 Hub | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` — Gnosis |
| Coinbase Verified Account | EAS predeploy `0x4200…0021` and Coinbase's attestation indexer `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C`, schema `0xf8b05c79…70f0de9` — Base |

Canonical values live in [`deployments/sepolia.json`](deployments/sepolia.json).

### Tracks

**World.** World ID is the highest-weight uniqueness credential in the ontology and the one
that forced the cost model. We read the Orb tier permissionlessly from two World Chain contracts —
`WorldIDAddressBook.addressVerifiedUntil` and AgentBook's `lookupHuman`, both plain `eth_call`s,
no API key, no relying-party id, no user interaction — which is why the adapter cannot be
rate-limited or revoked out from under an integrator. It is also the
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
than two hex strings the caller must keep in sync.

ENS also carries **agent** identity, which is the harder half. `corroborate.eth` and its
subnames are live on Sepolia ([`deployments/ens-sepolia.json`](deployments/ens-sepolia.json)):
each agent's name publishes `corroborate.human`, and the human's name publishes
`corroborate.agents` back. A counterparty handed nothing but a name resolves the agent's wallet,
the human behind it, that human's declared address set, and every sibling agent under the same
tree — from public infrastructure, with no server of ours involved. `npm run ens` in
[`apps/agent`](apps/agent) does exactly that, live, against the real tree.

The second record is the one that matters, and it exists because of a defect we found by
building the first. A cap of *N agents per human* groups agents by the human they name — and if
naming a human is free, an operator names a fresh wallet per agent and the cap binds nothing
while every individual answer stays true. Our own tree runs that attack against us:
`unverified.corroborate.eth` names a wallet its own operator already declares, and walks the cap.
An acknowledgement from the human's side makes the binding `mutual`, `requireAttestedBinding`
refuses one-way claims, and the caveat `fleet-cap-soft-on-asserted-bindings` fires whenever a
policy admits them.

A third piece answers the other question a public name cannot: **who is presenting it?** A name
is public, so until this existed anyone could type `alpha.corroborate.eth` into a counterparty's
form and be scored on the credentials of the human behind it. `verifyEnsPresentation()` closes
that with an ERC-4361 challenge bound to the name (`ens:<name>` in `Resources`, so a signature
collected for one name is refused for another) and one comparison: does the signer equal the
`addr` record read in the same pass? The **wallet** signs, not the name's owner — the owner
signing would prove only control of the name, which is exactly the impersonation the gate stops.
An EOA never touches the network; a smart account's ERC-1271 check does, and a failed read comes
back `unknown` → `indeterminate` rather than as an accusation. `requirePresenterAuthentication`
is the policy flag; `agent-presenter-authenticated-for-this-wallet-only` states what a signature
does not prove. Full write-up:
[`research/protocols/ens-agent-identity.md`](research/protocols/ens-agent-identity.md), which
also documents how to register a Sepolia `.eth` name today (free, no commit/reveal — the
migration made it easier, not harder).

---

## Docs

- [`docs/scoring.md`](docs/scoring.md) — the scoring model: root-cost aggregation, the
  sale-versus-rental argument for `min(forge, rent)`, the decay-versus-ramp age curves, a
  worked example over the real ontology, and the case where our own model produces an answer
  we do not like.
- [`docs/threat-model.md`](docs/threat-model.md) — what Corroborate defends against, what it
  provably cannot, each tied to the research file it derives from.

## Research

Every weight in the registry traces to [`research/INDEX.md`](research/INDEX.md) — **24 files,
~21,000 lines** of primary-source research written 2026-07-24 against live sources: contracts
queried over RPC, repos read at HEAD, prices fetched the same day. Volatile facts are
date-stamped; unconfirmed claims are marked `UNVERIFIED:` rather than guessed. If you read four
files, read the four the index nominates — one of them is the strongest argument that this
product should not exist, kept at full strength.

```
research/
  protocols/  17 deep-dives: contracts, SDKs, trust model, integration surface
  landscape/  12 sweeps: prior art, standards, vendors, the adversary, the market
  references/  the Ohlhaver corpus, read in full and treated as an argument against us
  scripts/     reproducible on-chain measurement
```

## Repo layout

```
contracts/       PersonhoodRegistry.sol + 18 Foundry tests
ontology/        adapters.json — the trust-root ontology, source of truth for seeding
packages/sdk/    scoring engine, adapters, subgraph client, ENS human + agent identity
packages/mcp/    MCP server over the SDK
subgraph/        The Graph subgraph: PoH v2 + Circles v2 on Gnosis
apps/demo/       browser demo — same SDK, client-side, live registry
apps/agent/      World AgentKit demo — human-backing check for an agent
scripts/         deploy, seed, ENS, and the on-chain vector sweep
research/        the 24 files every weight derives from
docs/            scoring model and threat model
```

## Licence

MIT. See [LICENSE](LICENSE).
