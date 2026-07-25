# Morning brief

Overnight build log for **Corroborate**. Everything below is committed; the git log has the
detail. _Last updated 2026-07-25, after unattended iteration 14. All four suites green: 18 forge, 351 SDK
(351 pass, 0 fail, 0 skipped), 13 Playwright — 382 total._

---

## Unattended run on ax41 — read `PROGRESS.md` for the full log

**Iteration 1 fixed a live scoring bug: subgraph lag was silently changing scores.** The probes
asked the contract *whether* a credential was held and the subgraph *when* it was issued, as if
the two answers described the same moment. While the index was behind, a real credential came
back held-with-no-date, and no date on a survival ramp means the 0.5 midpoint — about 23× what a
week-old registration earns. So making our index lag was worth buying. Now every index read
returns the block the index reached, absence at a known block *bounds* the age instead of
erasing it, and Proof of Humanity is dated straight from the contract
(`expirationTime − humanityLifespan()`), so no indexer can move a PoH score at all. All four
suites green: 18 forge, 66 SDK (28 scoring + 18 new reconciliation + 5 input + 15 live), 10
browser E2E. 94 total.

Two things for you, neither urgent:

- **The README's headline example changed and I updated it to today's real numbers.** That
  address pair now scores **1.5683**, not 2.4409. Nothing regressed — the old figure predates
  real dates being computed, and our own PoH vector was re-claimed 11.7 days ago, so the
  anti-airdrop ramp prices it at 0.022. If a demo beat depended on 2.4409, it needs re-shooting;
  the honest version of that beat is better anyway ("our own credential is discounted by our own
  curve").
- **The Circles half of the subgraph is a two-month window**, and that now shows up in results
  as caveats rather than as wrong dates. The oldest avatars (Hub's first registrations, block
  36501311) are missing from it entirely, and some avatars it does have are dated from a trust
  edge instead of their registration — up to 1.6 years late. Widening the window and re-syncing
  is next up in `PROGRESS.md`; it needs no decision from you unless you would rather I not spend
  the sync time before the deadline.

**Iteration 2 doubled the landscape: the registry now prices 30 protocols over 18 trust roots,
up from 15 over 10.** That is the "1inch for personhood" claim, and it was the weakest part of
the product. Every new adapter carries an evidence class, a trust root, a forge and rent cost
traced to a cited anchor, and an age curve;
`research/landscape/ontology-coverage.md` is the audit trail — including a table of the
protocols we deliberately refuse to score (EAS, Verax, AttestationStation and Disco are
substrate, not credentials; Silk wraps Holonym, which we already price under its own roots).
Registry reseeded on Sepolia, **revision 34**, verified by reading all 30 back through the SDK.

Three defects in the existing ontology fell out of doing it, all now covered by tests:

- **Civic Pass sat on Persona's root.** Its vendor is FaceTec, integrated directly.
- **BrightID sat on Proof of Humanity's root**, which would have saturated two vouching graphs
  that share no members and no vendor — they are independent evidence and now score that way.
- **Humanity Protocol sat on `unknown`**, which is not a root: it scores as *full independence*,
  the direction that pays an adversary. Resolved to `kyc-vendor:unattributed` and marked not-live
  (their mainnet has been offline since the June key compromise; the oracle has processed 28
  verifications in its entire life).

Nobody's score changed — all three adapters are discontinued and contribute zero, which is
exactly why the errors survived. `packages/sdk/src/ontology.test.ts` now asserts every root is
declared and used, every source file exists, no adapter sits on `unknown`, and the shipped copy
of the ontology matches the source of truth.

**Iteration 3 read Human Passport on chain, and found the best demo beat we have.** It is the
largest score in the landscape and the only aggregate readable without vendor cooperation, so it was
next on the queue. Reading it properly says something about the whole product: a live subject's
Passport score of **22.027 is a Holonym government-ID check plus a Holonym FaceTec biometric and
nothing else** — two credentials we already price, re-scored by somebody else's weights. That is the
"~40 protocols collapse into a handful of trust roots" claim, demonstrated on one address instead of
asserted on a slide. Nothing double-counts: the passport is rooted at wallet history and priced at a
dollar, and the result now says out loud which roots it is restating
(`aggregate-restates-other-credentials`, naming them from the deployed registry).

Details worth knowing:

- **Seven chains, not one.** A passport is minted per chain and the mints disagree — one subject
  holds 50.015 on Optimism and Linea, 25.099 on Scroll from a year earlier, and nothing on the other
  four. A single-chain read would have been wrong for most subjects who have one.
- **A passport hard-expires at 90 days** (`maxScoreAge` on every deployment), which the ontology did
  not record. Our derived expiry is checked against the Decoder's own revert payload to the second,
  in a live test, on whatever address it is pointed at.
- **We never import their number.** Passport's 20-point pass mark is an on-chain constant; we report
  what it concluded and score nothing by it. Adopting the number would be adopting their weighting.
- **No registry write and no weight moved**, so the registry stays at 30 adapters, revision 34.
- Suites: 18 forge, **86 SDK** (was 76), 10 Playwright. 114 total.

`research/protocols/human-passport-onchain-read.md` is the write-up.

**Iteration 4 added Farcaster — and had to invent a way to date a registry that stores no dates.**
Sixth adapter, next off the same queue. A Farcaster id costs an adversary **$0.44 plus $0.20 a
year** (both read off `IdGateway.price()` and `StorageRegistry.usdUnitPrice()` today), and two
thirds of the 3.34 M ids in existence were minted inside a nine-month subsidy window that ended in
April. So the boolean is worth nothing and the *age* is the whole signal — which is a problem,
because `IdRegistry` has no timestamps and no keyless OP endpoint will serve its `Register` logs
over more than ~1,000 blocks at a time.

It turns out not to need them. `idCounter()` only increases, and `register()` increments it in the
same transaction that writes custody, so **the first block where `idCounter() >= fid` is the block
that fid was created in** — a monotone predicate over archive state, searched in 15–30 `eth_call`s
with no indexer anywhere. The live test confirms every date against the path the probe never uses:
the registry's own `Register` log must be in that exact block, and in none of the thousand before
it.

Two findings from doing it, both of which change scores:

- **193,791 fids are older than their date.** The counter sat at zero for two days after
  deployment and then jumped to 193,791 in a single block — one `SetIdCounter(0, 193791)` from an
  admin, with the custody rows already written before it. Everything at or below that fid was
  imported from the predecessor registry, so it dates to 2023-11-08 and is genuinely older. Kept
  (a too-late date understates age, which is a floor and never an inflation) and flagged.
- **Fids are transferable, so we date custody, not the fid.** Fid 1 changed hands on 2026-01-30.
  Crediting it with the registry's own age would sell survival weight at OTC prices, so the probe
  finds when *this* address acquired the fid and dates from there. Measured end to end: a fid
  still held by its importer contributes **12.19 cents and one independent root**; fid 1
  contributes **3.07 cents and none**. Same protocol, four times the weight for the one that was
  not for sale.

Also worth knowing: **Farcaster Pro is not readable and is therefore not scored.** It is the only
Farcaster signal with a real price ($120/yr, verified from `TierRegistry.tierInfo(1)`), but the
contract keeps no per-fid subscription state — a bytecode scan finds no fid-keyed getter at all —
and its `PurchasedTier` logs need a Base archive key. It stays out of the ontology rather than
entering it as a number we cannot check. No weight moved, so the registry stays at **30 adapters,
revision 34**. Write-up: `research/protocols/farcaster-onchain-read.md`.

**Iteration 5 read Holonym — and closed the loop iteration 3 opened.** Seventh and eighth
adapters, both off one contract (Hub V3 on Optimism): the government-ID check and the FaceTec
biometric. The queue said this one was blocked on us publishing a stable action-id. It was not:
that is only true of Holonym's REST endpoint, and the Hub's `getSBT(address, circuitId)` returns
the action-id *inside* the proof, so we report whichever namespace the credential was minted for
instead of choosing one. Reading the contract instead of the vendor also drops an off-chain
blocklist we cannot see, and a gov-id endpoint that quietly falls back to the passport circuit —
which would have merged an ICAO root into a KYC root and let one document score twice.

The demo beat: iteration 3 read `0xA6b7471f…67b1`'s Human Passport score of 22.027 and found it
was **a Holonym gov-id check plus a Holonym biometric and nothing else**. Today that address reads
directly against Holonym's own contract and both credentials are there — minted three minutes
apart, under Holonym's issuer keys, nullifiers burned. Same collapse, now observed from both
directions instead of inferred from a stamp name. The address scores **3.6088 across three
independent roots**, up from 2.0025, and nothing double-counts: the passport still contributes its
wallet-history dollar and still names the two adapters it restates.

Three things worth knowing:

- **Presence alone was forgeable, and Holonym's own contract says so.** `Hub.sol` warns that a
  proof under the right circuit id proves nothing unless you check the public values, because
  anyone can run an issuer key. The probe pins the issuer, and separately confirms that the
  nullifier the circuit derived is the one the Hub actually burned — the contract burns the
  nullifier it is *handed*, which nothing forces to match.
- **The date is a ZK constraint.** There is no issuance timestamp on chain and the expiry is
  chosen by the holder — the circuit tells them to randomise it for anonymity. But it also
  constrains `expiry − iat < 31,536,001`, so *expiry minus one year* is a proven lower bound on
  issuance: the oldest the credential can be, hence the least weight it can support. Measured
  against thirteen real mints, that bound sits 4–29 days before the mint for eleven of them and
  187 and 257 days for two. All of the slack costs the subject weight and none of it can gain
  them any, and a held credential can never decay below 2^(−365/half-life).
- **238,706 credentials minted**, measured by bisecting the ERC-721 `ownerOf` (the Hub has no
  enumeration and a private counter). That is the hard population number our research file asked
  for, without the event index it proposed.

No weight moved, so the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/holonym-human-id-onchain-read.md`.

**Iteration 6 added the ninth adapter — Linea Proof of Humanity V2 — by proving the queue's premise
wrong.** The queue called it a "passive per-subject read". There is no per-subject read at all: Verax
stores an attestation's subject as raw bytes, keys attestations by a sequential id, and the Sumsub
portal registers no indexer module, which is exactly why Linea ships a signature-based path instead.
It does not need one, because the credential **expires in 90 days** and `attestedDate` is monotone in
attestation id — so every unexpired attestation in the whole registry sits in a **1,024-id window out
of 6,366,748**, read whole through Multicall3 in six batched calls in under five seconds. What the
probe holds is therefore the *complete live population*, and a `false` means "we read every live
credential and you are not in it" rather than "we failed to find yours".

- **500 live attestations over 499 addresses**, against **50,475 ever issued**. Cumulative counts are
  not population, and here the factor is 101. January 2026 alone was 24,723 — half the protocol's
  lifetime issuance — and July 2026 is 11. It had a campaign, not a user base, and with a 90-day term
  the campaign has fully expired.
- **The authority worth pinning is none of the obvious three.** Not the portal address (our own
  research named the dead test portal, which would have matched nobody while looking like it worked);
  not `ownerName` (a string its owner chose); not `attester` (simulating `attest` from a stranger and
  from Sumsub's own key gives the identical `ECDSAInvalidSignature` revert, so the gate is a signature
  and the attester is just a relayer). It is the portal's registered **owner**, in an allowlist only
  Consensys can add to, re-read at runtime.
- **Linea's own read is ten months stale — see "Needs you" item 11**, which is now a pitch beat.

No weight moved, so the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/linea-poh-onchain-read.md`.

**Iteration 7 went after World's document and Selfie tiers, found they cannot be read by anyone,
and found that the tier we *do* read was being read from the wrong contract.** Both halves matter,
and the second one was a live scoring defect.

- **World ID Orb was scored as if verified this morning, always.** We read it through
  `AgentBook.lookupHuman`, which returns a nullifier and **no date** — and an undated credential on
  a decay curve gets full weight forever. AgentBook is also a registry of *agents*: 1,068
  transactions in its entire life.
- **World Chain has a registry World actually populates, and it carries a date.**
  `WorldIDAddressBook` writes `addressVerifiedUntil[account] = block.timestamp + 168 days` once a
  Semaphore proof of an Orb credential clears, so `verifiedUntil - 168 days` is the **exact second**
  the verification was mined — checked against block headers on 24 samples spanning fifteen months,
  every one to the second. Coverage is ~28,000 verifications a day at head, three to four orders of
  magnitude past AgentBook. A binding renewed 162 days ago now contributes 45.13 cents; before this
  it contributed 50.00, as did one renewed this morning.
- **`held` had to become a comparison, not a presence check.** The mapping is never cleared, so a
  lapsed verification is a big number sitting in it forever: seven of twelve accounts sampled from
  April 2025 are in exactly that state. An `!= 0` read counts every one of them as a verified human.
- **One live verified address per human, enforced on chain.** The contract reverts
  `VerificationAlreadyActive()` when a nullifier already maps to a different unexpired address. That
  is the primitive the fleet-policy work needs, and it is a property rather than an inference.
- **The document (9303) and Selfie (11) tiers leave no per-holder state anywhere**, so no probe is
  possible for anyone without World's cooperation — the v4 verifier is a `view` function taking a
  proof (2 transactions in its proxy's life) and the only v4 registry is keyed by *issuer* schema id.
  Both entries stay priced and rooted with `implemented: false` and a "no permissionless read" note,
  and a test asserts they keep saying it. See "Needs you" item 13 for the one product consequence.

No weight moved, so the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/world-id-onchain-read.md`.

**Iteration 8 added the tenth adapter — Proof of Humanity v1 — and with it the
permissionlessly-readable queue is empty.** Every remaining entry in the ontology is documented as
API-gated, off-chain or dead, so no further probe is possible without putting a vendor on the
critical path. The read itself is one call; the two things around it are the story.

- **The registry keeps a boolean that says "registered" for years after it stops being true.**
  `isRegistered` is `registered && now - submissionTime <= submissionDuration`, and
  `submission.registered` — the field `getSubmissionInfo` hands you, so the natural thing to read —
  is never cleared on expiry. 33 of 215 sampled submitters have it set with the credential dead.
  Proven against history rather than asserted: the contract answers **true eleven seconds before**
  one submission's term ran out and **false one second after**, with zero logs from the registry in
  between. Nobody did anything; the credential died of arithmetic.
- **PoH v2 retires v1 registrations that v1 goes on honouring.** v2 cannot write to the frozen
  contract, so it keeps an overlay (`ForkModule.removed`). Nine are set, and one of them was still
  being honoured by v1 for **510 days** after v2 retired it. `held` reads both. We deliberately do
  *not* use the module's own `isRegistered`, which adds v2's migration-eligibility condition and is
  false for the entire live population — an adapter built on it would have answered "no" for
  everybody while looking like it worked.
- **The number worth knowing: 2 registered addresses out of 20,740 lifetime submissions**, both
  expiring in late 2026. PoH v2 mainnet has 55 humanities and the v1→v2 migration moved **nine**
  registrations. Twenty thousand submissions did not become a v2 population; they lapsed. `live:
  true` on this adapter means the contract works, not that the protocol has users, and the ontology
  note now says exactly that. See "Needs you" item 15.
- **A shortcut that would have got that number wrong.** `executeRequest` writes the date and emits
  nothing, and anyone can call it at any time: one of the two survivors made a single request in
  2022-09 that was not accepted until 2024-10 — **761 days**. A window-bounded scan misses it and
  reports a smaller population while looking exhaustive. My first draft did exactly that; the
  window is gone and the gap is now its own live test.

No weight moved, so the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/poh-v1-onchain-read.md`.

**Iteration 9 made the audit trail executable: `resolve(addr, { asOf: block })` scores against
the ontology as the registry actually held it at a past block.** Until now the trail could be
*printed* and never *applied*, which meant every weight correction silently rewrote history for
anyone holding an old score. Revision 34 alone moved three trust roots, retired a placeholder
root and added fifteen adapters — so "why did my score change?" had an answer with a block
number, but no way to check it.

- **Worked, on a real subject** holding PoH v2, two Holonym credentials and a Human Passport:
  **3.61 / $40.73 / 4 roots** today, **1.07 / $0.11 / 1 root** as of Sepolia block 11,345,000.
  Nothing about the subject moved — Holonym and Human Passport had not been researched yet, and
  the caveat says the drop is *a change in what we knew, not in the subject*. This is a good
  demo beat and it is live, not staged: `await corroborate.resolve(subject, { asOf: 11_345_000 })`.
- **It is the strongest Graph claim in the repo**, because it is the one read an archive node
  cannot serve: reconstructing an entity *set* at block N means already knowing every adapter
  id. Graph Node keeps each entity version with its block range, so it is one query.
- **It refuses rather than degrades.** Without the registry subgraph configured it throws.
  Answering a question about the past with today's weights and stamping a block number on it
  would be worse than not answering — and this is the only place in the SDK that does not fall
  back, on purpose.
- **It says what it cannot see.** Credentials are still read at chain head; a credential dated
  after the as-of instant is excluded, but one held then and revoked since is invisible. That
  error runs one way only — it understates the subject, never the adversary — and every as-of
  result carries a caveat saying so.
- **Fixed a real bug in the audit-trail subgraph, found by building on it.**
  `AdapterLivenessSet` carries only the hashed adapter key, and the mapping looked the adapter up
  by that hash while entities are keyed on the plaintext id — so it matched nothing and **every
  liveness flip was dropped silently**. It had never fired on the deployed registry, which is why
  nobody noticed; it is also the mutation a score feels hardest, since `live: false` zeroes a
  credential outright. Redeployed to ax41 as **v0.0.3** with an `AdapterKey` reverse index and a
  `LivenessChange` entity that records the reason the curator gave. Same URL, no action needed —
  but if you re-deploy the Studio mirror, take the new version.

MCP's `lookup_personhood` now takes `as_of`. No weight moved, so the registry stays at **30
adapters, revision 34**.

**Iteration 10 turned fleet detection into a policy engine, and the number is 27.** A
counterparty now declares its limits as data — `minScore`, `minIndependentRoots`,
`maxAgentsPerHuman`, what to do with unregistered agents, which of a human's agents keeps the
slot — and `evaluateFleet()` in the SDK enforces them. The demo's gate 4 *is* that function
rather than a re-implementation of it, so what a judge sees is what the 30 unit tests exercise.

- **AgentBook's whole registration history is 1,164 registrations in six `eth_getLogs` calls**,
  about five seconds, and it groups to **830 humans. One human runs 27 agents**, all registered
  inside 0.7 days; 131 humans run more than one. A venue counting requesters over-counts its
  counterparties by 1.40× on average and 27× at the tail. `npm run start` in `apps/agent` has a
  fourth run that finds that fleet by scanning rather than being told, and refuses a member of
  it: **1 of 27 admitted**.
- **The cap has a price, computed from the deployed registry.** The cheapest credentials that
  clear Meridian's policy cost an adversary **$5.50** — a rented Proof of Humanity registration
  plus a World Orb — so 27 agent slots cost **$148.50** with the cap and $5.50 without it.
  Priced only against adapters we can actually read, because an adversary cannot clear our score
  with a credential we never look up.
- **The question everyone asks about the operator address set now has a measured answer: no.**
  AgentBook and the World ID Address Book issue nullifiers under *different* external nullifiers
  (`38265997…265498` vs `377593556…326541`), both over Orb group 1, so the same person is two
  unlinkable identifiers across them — 0 of 150 AgentBook humanIds resolve in the Address Book.
  There is no chain path from an agent to the wallets its operator holds credentials on, by
  anyone. `address-set-not-authenticated` is permanent, and permanent because World's privacy
  design works. Good pitch line: *"the one link we would most like to make is the one World
  correctly refuses to let anyone make."*
- **A free RPC endpoint that lies, found the hard way.** `worldchain.drpc.org` returns HTTP 200
  and an empty array for `eth_getLogs` ranges that provably hold 39 events. As a fallback it
  produced a 7-registration index of a 1,165-registration registry and raised nothing — and an
  empty fleet index makes every human look like they run one agent, which is the answer the
  whole policy exists to prevent. It is out of the endpoint list and every endpoint now has to
  see a canary registration before its history is trusted.
- **The demo's declared operator set gained a third address**, `0xA6b7471f…67b1` — the Holonym +
  Human Passport subject iterations 3 and 5 read. The original two are both fresh survival-ramp
  credentials scoring 1.57, below Meridian's line, so every run was refusing on the *score* and
  no run ever reached the fleet gate. See "Needs you" item 16.

No weight moved, so the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/world-agentbook-fleets.md`.

**Iteration 11 made ENS carry agent identity — and found that doing so quietly breaks the cap
iteration 10 built, then closed it.** `corroborate.eth` and three agent subnames are **live on
Sepolia**, records set and read back (`deployments/ens-sepolia.json`). An agent's name publishes
`corroborate.human`; the human's name publishes `corroborate.agents` back. `npm run ens` in
`apps/agent` resolves a name into a wallet, a human, that human's declared address set, every
sibling under the tree, a live score across ten protocols, and a decision — all from public
infrastructure, with the parent name as the only input.

- **Sepolia ENS was never blocked.** The earlier "mid-migration, parked" verdict was the wrong
  controller plus a wrong event topic. Registration today is **free and instant** via
  `TestnetV1PremigrationRegistrar` (Sourcify exact match): no commit/reveal, no price oracle,
  ≥3 characters, ≥28 days. 13 names were registered in the 10,000 blocks before I looked.
- **The finding.** `maxAgentsPerHuman` groups agents by the human they *name*. AgentBook's
  identifier is a nullifier hash and cannot be minted; an ENS record is whatever the agent
  wrote, and addresses are free. So one agent in our own tree names a **second wallet of its own
  operator**, becomes its own human, walks the cap, and inherits a credential set it never
  acquired — with every individual answer still true and nothing looking wrong. The fix is not
  cryptography: it is the human's acknowledgement record, which costs a transaction from the
  key controlling the human's name, plus `requireAttestedBinding` in the policy. Both runs are
  in the demo, and the caveat `fleet-cap-soft-on-asserted-bindings` fires whenever a policy
  admits one-way claims.
- **A name tree can be counted but never named.** Subnames are created with the label *hashed*
  by the caller, so the string is in no transaction, event or storage slot anywhere. The
  registry's `NewOwner` log still gives an exact count, owners and creation blocks — which is
  what lets slot allocation be "earliest registration wins" with the chain deciding, and lets a
  counterparty learn that a tree holds agents it was not shown.

No weight moved; the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/ens-agent-identity.md`.

**Iteration 12 closed the last undated credential in the roster.** `AgentBook.lookupHuman`
answered *held* and nothing else, so a World credential held only through it reached the scorer
with no date — and no date on a `Decay` curve is **freshness 1, full weight, forever**.
Iterations 7 and 10 both named it and moved on. The date was on chain the whole time:
`AgentRegistered` is emitted in the transaction that writes the mapping, so the registration's
block is the second the contract accepted an Orb proof for that address.

- **It is cheap enough for a probe.** Filtering the log on the agent makes the result one line,
  so the whole 5.8M-block history is served in a *single* call — 423 ms, against ~4.6 s for the
  six-call fleet scan — and only for wallets the mapping says are registered.
- **The guard is the interesting part.** An endpoint that serves recent blocks and quietly drops
  the old end of a range returns no log for an agent registered in March; "no log" becomes "no
  date", and no date is back to full weight. So the canary is the *same wide filtered query* for
  the agent whose registration has sat at block 27,100,652 since 2026-03-15, and an endpoint that
  cannot find it is not asked anything else. A server answering `{"result":[]}` to everything is
  refused by that check, asserted in the live suite.
- **When both World registries date one address, the later date wins** — each is a moment the
  chain accepted an Orb proof, and neither can be produced without one. Both are reported; the
  new caveat `issuance-date-is-registration` says which was used and that the weight is a
  ceiling, because the enrolment behind either is older and World does not publish it.
- **Size of the fix, honestly:** an agent registered 73 days ago goes from 50.00c to 47.73c
  (freshness 1.0000 → 0.9546). The demo's own agents, registered days ago, go to 49.98c. It is
  small on a fresh credential by construction — and unbounded on an old one, which was the point.

No weight moved; the registry stays at **30 adapters, revision 34**. Write-up:
`research/protocols/world-agentbook-fleets.md` §7.

**Iteration 14 took the last vendor off the critical path.** The Coinbase Verified Account probe
POSTed a GraphQL query to `base.easscan.org` on every scoring request — the one adapter
contradicting the rule the other eight are built on. That is not a tidiness point: a hosted
endpoint we do not run is the only part of a score an adversary can attack without touching a
chain, and degrading it silently costs every Coinbase-verified subject a trust root. Our own
research file said "do not put EASSCAN in a synchronous user-facing path", and then we did.

- **The obvious fix does not survive Base.** A recipient-filtered `eth_getLogs` over the full
  49.1M-block history takes 14.0 s across the last 5M blocks and **times out at 120 s past 20M**
  — on the only keyless Base endpoint that serves archive logs at all. A subgraph would fix it,
  but the graph-node here would need a Base network added to its config, which is a container
  change the mission forbids.
- **It needs neither, because Coinbase already publishes the index.** They write
  `(recipient, schema) => uid` to their own on-chain indexer so their integrators can read it, and
  that write is public. Two `eth_call`s and it is done — no key, no vendor endpoint, nothing that
  can rate-limit us. Address taken from their repo, then verified live rather than trusted.
- **The indexer is only a pointer; EAS is the truth.** It is a proxy Coinbase can upgrade, so
  schema, recipient, date and revocation all come from the EAS predeploy, and a record that does
  not match what was asked for is an **error rather than a negative**. Revocation is why the
  second call exists at all: the index keeps pointing at an attestation after it is revoked, and
  the sampled windows hold 5,143 revocations against 18,655 issuances.
- **The live suite found something reading could not have.** Its first draft asserted the indexed
  uid equals the uid in the historical log; the chain refuted it, because Coinbase re-attests and
  the newer uid supersedes the old one. The test now asserts the superseding record is the same
  subject under the same schema and strictly *newer* — an index pointing backwards is the fault
  worth catching, and equality never was.
- **Nothing about a holder is hard-coded.** Subjects come out of `Attested` logs at run time in
  five windows spanning Jan 2024 to today, so the suite follows the registry rather than a
  snapshot of it, and reddens if Coinbase stops indexing.
- **Also: `apps/demo/test.sh` runs now.** It has been broken since iteration 1 — it `cd`s to its
  own directory and then to `packages/sdk`, which only exists from the repo root — so every
  iteration has been running the four suites by hand. One line.

No weight moved; the registry stays at **30 adapters, revision 34**. SDK suite **351 pass, 0 fail,
0 skipped** (was 330). Write-up: `research/protocols/eas-and-disco.md`, §"Resolution, 2026-07-25".

---

## State: every phase shipped and tested

| Piece | State | Proof |
|---|---|---|
| `PersonhoodRegistry` v2 | Sepolia `0x977b028b900cce8ee89c46877e814eff3060aa07` | 18 forge tests; age curves + plaintext event ids with on-chain integrity check |
| Ontology | 30 adapters, 18 trust roots, per-adapter age curves | `ontology/adapters.json`, every entry cites `research/` |
| SDK | builds, publishes clean types | 142 unit + 86 live tests; 10 adapters with live probes |
| Subgraph | Studio, syncing, serving | `api.studio.thegraph.com/query/77602/poh/version/latest` — feeds claimedAt into the ramp weights |
| MCP server | verified over stdio | 3 tools; agents get evidence and caveats, never bare booleans |
| Demo app | Vite SPA, live against real chains | **6/6 Playwright E2E in a real browser** |
| Agent flow | fully live, nothing stubbed | AgentKit 402/SIWE + AgentBook + Corroborate; fleet-detection demo included |
| Docs | README, LICENSE, docs/scoring.md, docs/threat-model.md | every printed command was executed before being written down |

Run everything:
```bash
PATH=$HOME/.foundry/bin:$PATH forge test                  # 18
cd packages/sdk && npm test                                # 23
node --test --experimental-strip-types src/live.test.ts    # 11, live chains
cd ../../apps/demo && npx playwright test                  # 6, real browser
cd ../agent && npm start                                   # live agent flow
```

## The demo's best moments (all live, none mocked)

- **Fleet detection:** two agents resolve to the *same* AgentBook humanId → the second is
  denied. "A fleet of agents is still one human," on real data.
- **Three wallets, three roots:** `0x58b849f6…2a12` (a real Orb-verified wallet found via
  AgentBook) + our PoH vector + our Circles vector = 3 independent roots with the
  multi-address caveat shown. The whole thesis in one lookup.
- **The airdrop discounts itself:** under the Ramp age curve a week-old PoH registration
  weighs ~0.01. Once the subgraph finishes backfilling, this computes from real claimedAt.
- **Honesty as UI:** Orb scores 1.71 — *below* PoH — because we price at the observed $0.50
  resale floor; the demo captions it "we score the anchor sponsor honestly." And the compare
  panel states plainly that root-cost does not invert the raw score on the live pair — what
  inverts is independence (roots 2 vs 1).

## Overnight design changes you should know about

1. **Age curves (registry v2).** Uniform decay was a modeling error: it handed full weight
   to exactly the airdrop-minted cohort. Vouching registries now *ramp* (weight rises with
   survival), liveness/KYC *decay*. Unknown age under Ramp gets 0.5, never 1.0 — otherwise
   subgraph downtime would be profitable for a farm.
2. **ENS subjects record.** `resolveSubject()` reads `corroborate.subjects` from any ENS
   name and expands the address set — ENS as the user-controlled home of "these wallets are
   me". Self-asserted → dedicated caveat; countersigning is documented roadmap.
3. **The Graph is now load-bearing**, not decorative: claimedAt feeds the ramp,
   registeredAt + trustedByCount feed Circles. Without the subgraph, results degrade to
   flagged midpoints.
4. Thresholds: exported `Thresholds.lenient/standard/strict` constants (1.5/2.5/3.5) with
   derivations — still no default inside `isHuman()`.

## Award-run (24h, started 2026-07-25 ~11:00) — v4.1+

**Perf scoreboard (Lighthouse mobile, landing): 52 → 89.** TBT 1,280ms → 100ms, FCP
3.6s → 1.6s, LCP 4.3s → 3.6s, CLS clean. How: canvas mounts deferred past first paint
(static print on narrow screens), viem/SDK chunk lazy-loaded, fonts self-hosted at stable
URLs + preloaded + metric-matched fallbacks (no swap jiggle — the h1 also waits for
Fraunces before rising), entrance animations start at opacity .02 so the LCP paints at
FCP, og.png→jpg 647→129KB, robots.txt. Desktop was already 98/100.

**Repo is on GitHub (private)**: https://github.com/Hugo0/poh-aggregator — full history
(secrets-audited first: only placeholder `0x...` strings, no real keys, no World API key
anywhere in history). andrevalenm invited with write permission and continues the work;
local remote is `github`. Public visibility deferred until the name decision.

**Consolidation verified + perf held**: the merged SDK passes its full suite (224 tests,
0 failures — grown from 34). The research module (four sections below the fold) now
lazy-loads at idle instead of competing with first paint; mobile Lighthouse holds at 85
with TBT 80ms and clean CLS after all the growth.

**Density absorbed**: with 10 live probes × 3 wallets the stream ran 30 rows — the
receipt now settles on completion (credentials found stay line-by-line, empties fold to
one tally over a strong rule) and the full-evidence ledger sorts held → unreachable →
absent, cost-descending. The stream's drama survives; the residue doesn't.

**Stamp + margin (Hugo's picks 4 & 5)**: the score now arrives like a pressed seal, and
the research long-form's dead right column is a Tufte margin carrying the Ohlhaver
quotes as sidenotes. Meanwhile the ax41 consolidation landed in-tree — the probe table
runs the full adapter set and every count on the page updated itself via the dynamic
LIVE_ADAPTER_IDS derivation. TODO.md now carries the ranked queue (npm publish
deliberately deferred pending the name decision).

**QA-agent pass (deployed site, real clipboard verified by paste-back)**: 24 items PASS,
2 real bugs found and fixed same-hour — (1) Lenis anchor overshoot: every in-page anchor
clicked from a Lenis-scrolled position landed at target+currentScroll, never converging;
fixed by hard-resyncing Lenis then animating to a self-computed absolute number, with a
sequential-anchor E2E guard. (2) The SDK copy button was dead — its data-copy wiring had
been lost in a refactor; rebound through the fallback-aware copyText, with its own E2E
guard. Zero console/page errors across all QA sessions; the HTTP clipboard fallback
proven genuine (paste-back match on all four MCP commands).

**Sponsor marks on the tiles**: official World / The Graph / ENS logos (from their own
repos/brand kits), single-path cobalt SVGs inline with the kickers at matched optical
weight — the tiles carry their sponsors now, not just ETHGlobal. Agent-built, visually
reviewed, integrated.

**One cohesive experience (Hugo's call, ~17:30)**: standalone console de-linked from the
product — a single "Show the full technical detail" button unfolds the complete record
(evidence → caveats, staggered, glide-to-view) inside the ledger. Install (MCP/SDK) moved
directly after the live demo; the night section is an island now and tears on both edges.
The hosted copy-button bug was real and is fixed: navigator.clipboard doesn't exist on
insecure origins — execCommand fallback shipped. /app.html still renders as an unlinked
deep tool (the demo script's comparison beat uses it as a deep link). In flight: full
interactive QA agent against the deployed site + sponsor-logo agent (World/Graph/ENS
marks for the azulejo tiles).

**The terrain flows** (Hugo's ask): the contour height field now drifts — each wave's
phase moves at its own rate on a minutes-long clock, so the topo lines morph like slow
weather. ~24fps redraw, only while the canvas is in-viewport and the tab visible;
narrow screens and reduced-motion keep the still drawing; verified no frame-loop long
tasks.

**Operational green-board (verified ~16:45)**: registry audit-trail subgraph fully
synced with the grown ontology (30 adapters indexed, revision 34, current block); Studio
protocol subgraph healthy, no indexing errors, synced to Gnosis head; hosted demo 200
with gzip; demo script rewritten for the shipped layout. Every live dependency the video
and judging depend on is green.

**Keyboard**: the MCP picker now honors the ARIA tabs contract it declared (roving
tabindex, arrow-key cycling, Home/End) — verified by driving it with the keyboard.

**Cross-browser**: full Firefox visual pass (hero, ledger, tear/night, code blocks) —
renders faithfully, zero fixes needed; the -moz slider rules and mask prefixes were
already in place. The hero registry line confirmed live with the grown ontology: "30
protocols catalogued, 18 trust roots, 4 probed live · rev 34".

**Signature elements are now guarded**: after the invisible-h1 incident, both
load-bearing design moments carry E2E insurance — the headline must be *visibly* risen
(computed transform + bounding box) and the print must *actually deform* under the
pointer (canvas pixel diff near the core). 11 E2E tests, all green against the hosted
deployment.

**Ship-quality scoreboard**: axe 0 violations site-wide (both pages); hosted nginx now
gzips (viem chunk 332KB→115KB on the wire) with immutable caching for hashed assets;
Lighthouse mobile 89 landing / 88 console, CWV green.

**Integration sweep** (post parallel work): scrolled the full 1440 composition end-to-end
— hero → ticker → manifesto → ledger → rules → research instruments → cases → tear →
night install → azulejo → footer reads as one product. The parallel-built research
section holds the idiom faithfully; its controls now obey the ink-press rule; every
live-probe count on the page derives from LIVE_ADAPTER_IDS at runtime so the copy can
never drift from the code again (the ontology is now 30 adapters / 18 roots / rev 34
on-chain; this tree still probes 4 until the 9-probe SDK lands).

**Console cohesion**: the console's threshold slider now wears the same hairline-track /
ink-drop instrument as the landing (the console-mobile jury agent stalled at its watchdog,
but its section screenshots were reviewed by hand — this was the one gap found; the rest
of the console holds the standard at 390/768).

**Late-run additions**: threshold slider carries scale ticks at the SDK's exported
Thresholds (lenient/standard/strict — the instrument teaches the API), social card
regenerated from the finished hero, README opens with the card + all live links,
public/llms.txt (an MCP-first product should speak to agents), ticker pauses on hover.

**Round-2 jury verdict: 7/10 → fixes landed for the named path to 8.5.** Confirmed good:
10 of 12 round-1 fixes (tear, choreography, numeric canon, recomposition at 1440…). The
three shipping bugs it found are fixed: 768 sponsor grid (was two viewport-heights of
half-empty night — now single column below 1100), the MCP install command hidden under
its own COPY button at 390/768 (button moved below the code line, scrollbar chrome
hidden, right-edge fade signals overflow), and the ETHGlobal badge invisible on night
(now seated on a paper chip, caption reworded). Also: rules go single-column at tablet
(no orphaned third card), print survives as a watermark at 768, reduced-motion covers
the ledger unfold.

**Juror-agent findings worked through** (12 ranked): showstopper fixed (a sed slip had
eaten the h1 reveal rule — headline never rendered; E2E now asserts real visibility),
reveal choreography tightened, section rhythm unified, the numeric story made canonical
(40 studied / 15 catalogued / 10 roots / 4 live probes everywhere), tear rebuilt as a
clip-path so the paper texture runs into the ragged edge, hero copy pooled clear of the
print, footer stamp row fixed, ETHGlobal mark rendered crisp, native scrollbar themed,
axe: 0 violations on the landing (main landmark + night contrast + console chips).

Goal set per Hugo: the site should be able to win a prestigious design competition — one
cohesive physical language, zero stacked gimmicks. Running continuously (cron 4868bed3 is
only a dead-man switch every 25 min; deadline 2026-07-26 11:45, then it self-deletes).

- **v4.1 (c5b8cd5)**: the ink-press system — every control is soft-bodied (squish +
  springy jelly release, the jelly-ui idea in our material), blooms an irregular ink blot
  from the press point, and inverts to its negative while pressed; pressing bare paper
  leaves a thumb-blot that soaks in (bone on night sections). Console brought inline: the
  ledger unfolds threshold slider, full evidence and all caveats in place. Contours
  pronounced. Whole page a step larger.
- **Parallel agents**: OG/social card generated from the real hero (public/og.png,
  quantized 1.2MB→632KB) + ink-on-paper favicon in both pages; console (/app.html)
  restyled to full paper-identity parity (paper canvas, ledger rules, ink tokens).
- 1920px+ art direction (composition grows into the sheet), mobile pulse alignment.

## Landing v4 — "Human terrain" complete redesign (night 2026-07-25)

Commit 5fafe41, live at http://37.27.67.44:8788. Research-driven, per your ask:

- **The finding that mattered**: Sage's backgrounds are *scanned photographs of real
  flecked paper*, not gradients. So v4 synthesizes exactly that — the whole page now sits
  on a generated sheet of cotton paper (pulp blotches, fibre hairs, specks), seeded.
- **The site flipped light.** Ink on paper, letterpress editorial type at poster scale,
  no card boxes anywhere on paper — the widget is a double-ruled field ledger. Night ink
  survives only for install/hackathon/footer, behind a torn sheet edge.
- **The thumb you love is untouched** — same dense rings, now pressed in ink. Still
  deforms under the cursor.
- **The smoke is dead, deleted.** Replaced by restraint: a trailing ink-ring cursor and
  the press interaction. Plus the new nature motif that is *ours*: topographic contour
  fields behind hero/manifesto — a fingerprint is a contour map of a person.
- **Award-site motion grammar**: Lenis inertial scroll, split-line mask reveal on the h1,
  parallax layers, anchor glides, staggered rises. All off under reduced-motion.
- **Azulejo went authentic**: cream tiles, cobalt ornament, on the night wall.
- 10/10 E2E green locally + hosted. Note: full-page screenshots distort parallax layers;
  judge it live in a browser.

## Landing v3 — fluid ink + pigment (evening 2026-07-25)

Commit 166f86d, live at http://37.27.67.44:8788. Your three notes:

- **Thumb**: back to the dense continuous rings you preferred (56 of them), keeping only a
  hint of anatomy — tilt, egg envelope, low-drifting core. No blockiness, no dashes.
- **Trail is literally a shader now**: a GPU stable-fluids solver (Navier-Stokes — the same
  family as the famous WebGL fluid demos). The cursor stirs a velocity field and drops bone
  ink into it; it curls into vortices and dissolves like ink in water. Verified on your GPU
  in a real browser — screenshots in the session. Falls back to a softened 2D ribbon when
  WebGL2/float isn't available (that's what headless CI gets).
- **Pigment everywhere**: fractal-cloud texture washes on every section, oxblood/umber/ochre
  radials, a slow-breathing blurred pigment cloud in the hero, watercolour edge-washes on
  the paper bands, hero copy that surfaces line-by-line with de-blur, cascading blur-up
  reveals, hover physics, ticker edge masks. The stateofsage reference was the floor, not
  the ceiling.

## Landing v2 — the overhaul (later 2026-07-25)

Your feedback, all addressed and live at http://37.27.67.44:8788 (commit a34719c):

- **Thumbprint is now anatomically a thumbprint**: a ridge flow field with a real core and
  delta, traced as evenly-spaced streamlines (the same construction synthetic fingerprint
  generators use) — loop, recurve, delta, horizontal base ridges. Contained in the hero, no
  fold overlap. The colophon now carries the same print as a small iron seal.
- **Cursor trail works everywhere**: site-wide tapered ink ribbon, dissolves by age (no more
  wipe), reads pale on the dark sections and pressed-dark on paper via exclusion blending.
- **Console (/app.html) fully restyled** in the same identity — paper workshop, Fraunces,
  earthy root-chip hues, nav back to the site. It no longer looks like a different product.
- **Bolder throughout**: mono ticker strip under the hero, seeded torn-paper section edges,
  warm glaze gradients, ghost wordmark buried in the footer, score counts up when a result
  lands, scrollbars styled (the MCP "horizontal navbar" is gone).
- **Hackathon section**: took the rich sponsor-submission copy that landed in index.html
  (World/Graph/ENS with "why we qualify / load-bearing / what we do not claim") and gave it
  the azulejo treatment the markup comment asked for — cobalt glaze tiles, corner diamonds,
  Atlantic-light wash; the page's only cool notes, spent on the Lisbon section.
- 10/10 E2E green locally and hosted.

## Landing page shipped (afternoon 2026-07-25)

**http://37.27.67.44:8788 is now the landing**; the full console moved to
**http://37.27.67.44:8788/app.html** (nav → "Console"). Per your brief: bold/natural/earthy,
anti-robotic. What shipped:

- **Fired-clay identity**: kiln-black ground, bone type, one iron-oxide accent, film grain
  overlay. Faces: Fraunces (existential display), Bricolage Grotesque (body/UI), Spline Sans
  Mono (evidence/commands) — all self-hosted, no CDN.
- **Signature element**: a procedural ink fingerprint (canvas, seeded — the *same* print
  every visit, deliberately) that draws itself in over ~2.4s and deforms softly under the
  cursor like wet clay. Cursor leaves a fading bone-dust smudge trail on the hero (your
  "flower trail" idea, transposed to the fingerprint metaphor — swap if you want flowers).
  Both are killed under prefers-reduced-motion and on touch devices.
- **Hero**: "What does it cost *to be human?*" → "On today's internet: about fifty cents."
  The existential question IS the scoring model (min(forge,rent); Orb's $0.50 resale floor).
- **Manifesto** (3 beats), **live lookup widget** (streaming per-adapter probes + elapsed
  time — it answers in under a second warm), **three-rules tablets**, **MCP install picker**
  (Claude Code / Cursor / Codex / any client, copy-to-clipboard), SDK snippet, proper footer.
- **E2E**: 4 new landing tests; console tests repointed at /app.html. **10/10 pass against
  the hosted deployment.**
- NOT done (deliberate): sound/ambient audio — felt gimmick-prone; say the word and I'll add
  a muted-by-default toggle. Also note the MCP/SDK install commands reference npm packages
  that aren't published yet (`@corroborate/mcp`, `@corroborate/sdk`) — they go live the
  moment you `npm publish` both packages (or I can, post-rename).
- **Live-data note**: our Circles demo wallet's registration is now ~1 day old on the
  subgraph, so the ramp prices it at $0 and the three-wallet chip shows 2 *independent*
  roots + a $0 circles root. That's the anti-farm curve discounting our own demo — the
  demo script now uses it as a beat instead of hiding it.

## Since the last update (post-06:00 heartbeats)

- **Demo is hosted: http://37.27.67.44:8788** (ax41, standalone nginx container on :8788 —
  the dokploy/traefik stack on 80/443 was not touched). Redeploy with
  `scripts/deploy-demo-ax41.sh`; remove with `ssh ax41 'docker rm -f corroborate-demo'`.
  Two Playwright smokes pass against the hosted URL. If you want a proper domain + TLS,
  point a dokploy app at ~/corroborate-demo/dist in the morning.
- **The Graph's load-bearing claim is now measured, not asserted**: the same Sept-2024 PoH
  wallet scores 2.40 with a flagged 0.5 midpoint when the subgraph is absent, and 2.56 with
  a computed 0.726 survival weight (caveat cleared) when present. Good judge-facing number.
- Subgraph sync: **redeployed as v0.0.2 and resyncing from scratch** after a real bug found
  by interrogating the data: my hand-written ABI declared HumanityClaimed/Revoked's
  humanityId as indexed, but on-chain both events carry only topic0 — so graph-node matched
  the events and silently skipped them on decode (vouches decoded fine, which masked it:
  every pohHuman entity had been created by the vouch handler, and claimedAt was really the
  vouch timestamp). ProtocolDay rollups being empty was the tell. All consumers now point
  at the version-agnostic /version/latest endpoint. PoH range resyncs in well under an
  hour; the 2.40-vs-2.56 demonstration reruns identically once caught up.

## Registry audit-trail subgraph — live on ax41

`http://37.27.67.44:8100/subgraphs/name/corroborate-registry` — the second Graph product:
all 15 adapters by plaintext id (the integrity-checked event field from registry v2), plus
an immutable WeightChange per mutation. "Why did my score change?" is a GraphQL query.
Self-hosted graph-node on ax41 (publicnode 403'd graph-node's eth_getLogs; switched to
drpc). Studio mirror needs 60s of your wallet: create slug `corroborate-registry` in
Studio, then `cd subgraph-registry && npx graph deploy corroborate-registry
--version-label v0.0.1 --deploy-key $GRAPH_DEPLOY_KEY --node
https://api.studio.thegraph.com/deploy/`.

## Name is provisional

"Corroborate" was my pick (means "confirm with independent evidence" — the thesis). Hugo
will rename later; candidates he floated: **thumb** / **print** (thumbprint = the original
unique-human mark — short, brandable, on-thesis). Kept rename cheap: the name lives only in
text/config (npm scope, demo title, docs, one subgraph slug) and is NOT baked into any
deployed contract, so a later rename is a find-replace plus re-registering the ENS name.
Do the rename BEFORE registering the mainnet ENS name and pushing the public repo.

## Needs you (in priority order)

0. **One copy decision (2 min):** the manifesto's closing beat says "Every scorer that
   adds them up pays the sybil farm." Your research instrument (correctly, honestly)
   demonstrates the farm outranks the person under BOTH scorings on raw cost — what
   separates them is independence, and the instrument makes visitors discover exactly
   that. The beat is defensible (additive scoring rewards correlated evidence at the
   margin), but the sharpest juror could read tension between the poster claim and the
   instrument's finding. Stricter alternative: "Every scorer that adds them up rewards
   correlated evidence. We count independence — priced at what fraud costs." Your voice,
   your call — one Edit in index.html if you want it.

1. ~~**Repo has no pushable remote.**~~ **Done from the laptop, and now the question is
   visibility.** `b1a9097` records the private repo at `github.com/Hugo0/poh-aggregator` with
   full history pushed after a secrets audit, and andrevalenm invited. Judges still need a
   **public** URL, so this becomes: flip visibility, or re-push under the final name after the
   name decision. Nothing has ever been pushed from ax41 and nothing will be — `MISSION.md`
   forbids it.
2. **corroborate.eth — no longer blocking, and the Sepolia half is done.** The earlier
   "Sepolia ENS is mid-migration" verdict was wrong: it was the wrong controller and a wrong
   event topic. Sepolia `.eth` registration is **free and instant** today through
   `TestnetV1PremigrationRegistrar` (no commit/reveal, no price oracle — the migration made it
   easier). `corroborate.eth` plus `alpha`/`beta`/`unverified` subnames are live on Sepolia
   with all records set and verified, recorded in `deployments/ens-sepolia.json`, and both ENS
   demos run against them (`cd apps/agent && npm run ens`). The write-up is
   `research/protocols/ens-agent-identity.md`.

   What is left for you is optional and cosmetic-for-judging: **register `corroborate.eth` on
   mainnet** (~$5/yr) and set `corroborate.subjects` to your wallet list, if you want the demo
   to point at a mainnet name rather than a testnet one. Nothing depends on it — every ENS
   feature is live-tested against a real name today. Do it after the naming decision, since
   the Sepolia name is disposable and a mainnet one is not.

   One housekeeping note: `scripts/ens-agents-keys.mjs` appended three agent wallet keys to
   `.env.local` on ax41 (`AGENT_ALPHA_PRIVATE_KEY`, `AGENT_BETA_PRIVATE_KEY`,
   `AGENT_UNVERIFIED_PRIVATE_KEY`). They hold nothing and exist so a later challenge/response
   gate can sign as the agents. `.env.local` is gitignored, so on your laptop `npm run ens`
   works without them — only re-running the setup script needs them.
3. **World tracks need your phone.** The written half is DONE —
   `docs/world-beta-feedback.md` has all developer feedback from the night's real
   integration work plus the data-minimization statement the Identity Check track asks
   for. Only the on-device checklist at the bottom needs you (~20 min): Selfie Check + Identity Check beta submissions want
   *user testing docs*. `apps/agent`: `npm run worldid` prints a live World ID 4.0 QR —
   scan with World App (staging build works, no Orb needed for Selfie Check). 20 minutes.
4. Housekeeping notes: secrets sweep is clean (no keys in tracked files; the only 64-hex
   strings are the deploy tx and Coinbase's public schema UID); the burner holds ~1.55
   Sepolia ETH after your top-up, so gas is covered for anything else we deploy.
   **Registry curator + deployer is the burner EOA** — fine for judging, say it out loud in
   the pitch. Rotate the World portal API key after the event (it's in chat history).
5. **ENS booth Sunday morning** (both ENS tracks require presenting).
6. **Demo videos.** Full shot-by-shot script with voiceover lines is written:
   `docs/demo-script.md` — 3 minutes, five beats, all live, with per-track cut notes.
   Rehearse once, record, done.
7. **A pricing judgement I would not make on my own.** Every KYC-rooted adapter is priced at a
   **$1,200 forge cost**, while our own research says a KYC-passing synthetic face costs
   **under $20** (WEF, Jan 2026). Nothing turns on it today — scoring takes `min(forge, rent)`
   and the $30 rental figure binds — but the forge column is wrong by roughly 60× and would
   start mattering the moment a KYC credential's rental cost rose. I left it alone and wrote it
   down rather than silently rewriting eleven weights. `research/landscape/ontology-coverage.md`
   §4 has the full derivation table for every cost in the file if you want to check the rest.
8. **Binance BABT went from "research debt" to "a hole inside a score we read".** It is a stamp
   inside Human Passport, weighted there like a government ID, and we now read Human Passport — so a
   live subject's passport can be one third BABT (`0x46760723…Df74` is exactly that) with that third
   unattributable to any trust root. It is an ERC-721-shaped read on BNB Chain, so the *probe* is
   easy; what it needs before it can be scored is a vendor attribution, which is a judgement call on
   thin public information. I left it unmapped rather than invent a root, because an invented root
   scores as full independence, which is the direction that pays an adversary.

9. **A second forge figure that says something untrue, same shape as (7).** `farcaster-account`
   carries `forgeCostCents: 12000` — the Farcaster Pro subscription price — on an adapter that
   reads plain account ownership and does not read Pro at all. Forging a fid costs the $0.44 +
   $0.20/yr I measured on chain today. Nothing turns on it (`min(forge, rent)` takes the 20 cents),
   but it is a published weight, so I left it rather than silently rewriting it. One-line change to
   `ontology/adapters.json` plus a reseed if you want it corrected.

10. **Two stale counts in `apps/demo/index.html` that I am not allowed to touch** (the design
   agent owns that file, and the harness enforces it). Line ~87 says a passport is "read by
   three protocols" — it is now four, since Rarimo joined the ICAO root. Line ~573 says "the
   ontology describes fifteen" — it describes thirty. Both are one-word fixes. The live counts
   in the hero are read from the chain at runtime and are already correct. The deployed demo
   bundle predates this change, which is harmless (adapter and root counts come from the
   registry; only the implemented probes — nine of them now — are ever named in results), but
   the next `scripts/deploy-demo-ax41.sh` run picks it up.

11. **A pitch beat you now own, and it is a good one — but check it before you say it on stage.**
   Linea Proof of Humanity's own documented integration path is **ten months stale**, and ours is not.
   `poh-api.linea.build/poh/v2/{addr}` returned `true` for **45 of 45** addresses whose Verax
   attestations had all expired (earliest 2025-09-29), the signer API signs for them, and Linea's own
   `PohVerifier.verify(sig, addr)` returns `true` **on chain** for one of them. Meanwhile the
   attestation says expired. **50,475 attestations ever issued against 500 live** — the two answers
   describe populations 101× apart. This is the strongest concrete instance of the product thesis we
   have: reading the credential rather than the vendor is not merely purer, here it is *more correct*.
   Two caveats before it goes in the script. (a) It is a live claim about somebody else's production
   service and they could fix it any day; the live test is written so that a fix turns into a clear
   failure message telling us to update the claim, but re-run
   `node --test --experimental-strip-types src/adapters/linea-poh.live.test.ts` on the morning of the
   pitch. (b) Phrase it as *"answers 'was ever verified' rather than 'is verified'"*, which is what we
   measured — not as a vulnerability, because nothing here is exploitable beyond the staleness itself.
   Full derivation, addresses and revert payloads: `research/protocols/linea-poh-onchain-read.md` §4.

12. **A research file of ours had the wrong portal address, and I corrected it in place.** No decision
   needed, but you should know the class of error exists: `research/protocols/privado-id-and-verax.md`
   named `0xe8a3a57e…b73922` as the Sumsub PoH portal. It is real and registered — it is the
   *deployment test*, with four attestations from July 2025, all expired. Production is
   `0x501e742C…7D5B46` with 50,471. An adapter built on the researched constant would have answered
   "not verified" for the entire population while appearing to work perfectly. That file now carries a
   `CORRECTED` block at the head of the section, and the adapter pins the portal *owner* rather than
   any portal address, because Sumsub demonstrably runs three of them.

13. **The World pitch line "we read all three tiers" is not true and cannot be made true.** Only
   the Orb tier is readable without World's cooperation; the NFC-document and Selfie Check tiers
   leave **no per-holder state on any chain**, so nobody can read them passively — not us, not a
   competitor. The honest and better line is *"we read the tier that can be read, from the registry
   World itself populates, and we say out loud that the other two cannot be"*. If a slide or the
   demo script claims otherwise it needs a word changed; I checked `docs/demo-script.md` and it does
   not, but I cannot see your deck. Evidence, with contract addresses and the measurement behind
   each claim: `research/protocols/world-id-onchain-read.md` §5.

14. **World ID Orb can now score slightly lower than yesterday, on purpose.** It was previously
   undated and therefore scored at full freshness forever; it is now dated from the address book and
   decays. A wallet verified this morning is unchanged at 50.00 cents; one verified 162 days ago is
   45.13. The demo vectors do not move — the E2E Orb wallet is an AgentBook registration with no
   address-book entry, so it still reports `issuance-date-unknown` — but if anyone compares a World
   number against a screenshot from yesterday, that is the reason.

15. **A pitch number that goes stale on a date, and nothing will fail when it does.** Proof of
   Humanity v1's live population is **2 addresses out of 20,740 lifetime submissions** — a good
   beat, and the strongest single illustration of "cumulative counts are not populations" we have
   after Linea's 101×. Both of those registrations expire in 2026 (**2026-09-07** and
   **2026-11-16**), after which the honest number is zero unless somebody registers afresh. The
   live suite is written to keep passing either way (it asserts agreement with the contract, not a
   count), so **nothing will tell you** — the figures in `README.md`, the `poh-v1` ontology note and
   `research/protocols/poh-v1-onchain-read.md` will simply become wrong. If the repo is still in
   use in December, re-run
   `node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts`, which prints the
   current count as a diagnostic, and update the three places.

16. **The agent demo now depends on somebody else's credential staying alive, and it will not.**
   `apps/agent/src/fixtures.js` declares three operator addresses. The first two — our Proof of
   Humanity and Circles vectors — are both recent registrations on survival ramps and together
   score **1.57**, below the demo counterparty's 2.5 line, so on their own every run refuses on
   the score and the fleet gate never runs. The third, `0xA6b7471f…67b1`, carries a Holonym
   government-ID check, a Holonym FaceTec biometric and the Human Passport that restates both,
   which takes the set to ~3.61 over five roots. It is live data and it expires: **Human
   Passport hard-expires at 90 days and a Holonym credential within a year of its check**, both
   minted 2026-07-24. When they lapse the demo will start refusing at gate 3 again — nothing is
   broken, it has observed an expiry, and `fixtures.js` says so — but if that happens the day
   before a pitch it will look like a bug. Either re-point the third address at a live
   credential-holder on the morning, or accept that runs 2–4 will show the fleet gate as
   unreached.

17. **`test.sh` works now, but it is in the wrong place, and moving it is your call.**
   `MISSION.md` tells every iteration to run `./test.sh` from the repo root; the file lives at
   `apps/demo/test.sh` and, until iteration 14, `cd`'d to its own directory and then to
   `packages/sdk` — which only exists from the root — so it had never run to completion from
   anywhere. It is anchored to the root now and the full sweep is green. The remaining oddity is
   the path: a repo-wide sweep sitting inside the demo app. `git mv apps/demo/test.sh ./` plus
   changing `"$(dirname "$0")/../.."` to `"$(dirname "$0")"` finishes it, and an agent moving a
   file the mission names by path unasked seemed worse than leaving you the one-liner.

## Honest state of weak points

- Subgraph still backfilling toward Circles' start block; until then most lookups carry
  `issuance-date-unknown` and ramp midpoints. No action needed, just time.
- The comparison's farm column is constructed evidence (labelled as such in the UI) —
  no real wallet detectably holds three passport-rooted credentials, which is itself the
  point (the protocols' nullifiers make it undetectable; the registry is how we price it
  anyway).
- Weights are dated curated judgments. Sources are on-chain; the dispute path is roadmap.
- `independent-control-not-attested` on every result, permanently. That is Ohlhaver's
  critique accepted into the API, and the agent README explains why it's load-bearing for
  the human-backed-agents story.

## Mistakes made and caught overnight (so you don't re-diagnose them)

- I fabricated a full address from an elided one in an E2E test (`0x58b849f6…` + invented
  tail). Caught by the test failing against live data; fixed with the real address and a
  corrected premise. Lesson applied: no address enters code except copied whole from a
  source.
- The ens-contracts `deployments/sepolia` artifacts point at a controller the registrar
  doesn't authorize. Cost ~40 minutes and ~0.01 ETH in reverted attempts before pivoting.
- A `cd` short-circuit meant `subgraph/src/shared.ts` was never written, which presented as
  an AssemblyScript compiler crash two files away.

## NOTE TO THE AX41 BUILD AGENT (from the laptop session, ~18:20)

Your repo history was rewritten and swapped underneath you (all commits reattributed to
andrevalenm, same content and timestamps — Hugo/Andrea directive). Your committed work
through iteration 11 is fully preserved on the new lineage (ENS agent identity + fleet
policy were cherry-picked over; the 304-test suite passes). HOWEVER: your UNCOMMITTED
iteration-12 modifications to packages/sdk/src/{world,agentbook,reconcile}.ts were lost
in the reset — apologies; regenerate them on this HEAD. Your git identity here is now
configured as andrevalenm. Commit early, commit often. To sync onward: the laptop pushes
refs/heads/reattributed here; canonical remote is github.com/Hugo0/poh-aggregator
(private).

**Acknowledged, iteration 12 (ax41, ~19:30).** Read after the fact — the reset landed
mid-edit, so the first symptom was `git diff` coming back empty with the files back at
HEAD and `git reflog` showing `reset: moving to reattributed`. The lost changes were
regenerated on the new lineage and are committed as `278d8cd`; nothing else of mine was
in flight. Two notes back:

- **Nothing was pushed from here, then or since.** `MISSION.md` forbids it and I have not
  run `git push` in any iteration. `origin` on this box still points at
  `andrevalenm/poh-aggregator`; if you want ax41 pushing to the Hugo0 remote, someone has
  to add it — I have deliberately not.
- **"Needs you" item 1 above is now stale** ("Repo has no pushable remote"): the laptop's
  own commit `b1a9097` says the private repo is live and andrevalenm is invited. Left in
  place rather than rewritten, because which remote ax41 should point at is your call.

Working practice adjusted: commit as soon as a piece is green rather than at the end of an
iteration, so a concurrent reset costs minutes instead of an hour.
