# Autonomous build log — ax41

Append one block per iteration. Newest at the bottom. Read this before doing anything;
future iterations start with a blank context and only know what is written here.

Format:

```
## Iteration N — <ISO date>
**Did:** …
**Verified:** (the command you ran and what it printed)
**Committed:** <sha> <subject>
**Next:** …
**Blocked:** … (or none)
```

---

## Iteration 0 — 2026-07-25, handover

**Did:** Set up this working copy on ax41 from Hugo's laptop at commit `fa6c924`. Nothing
else — the queue in `MISSION.md` is untouched and P0 items are both open.

**State of the world at handover:**

- 66 tests green as of `c743f82` (18 contract, 25 scoring, 5 input, 12 live, 6 E2E).
- Registry v2 live on Sepolia at `0x977b028b900cce8ee89c46877e814eff3060aa07`.
- Protocol subgraph on Studio, synced. Registry audit-trail subgraph self-hosted on `:8100`.
- Demo served by the `corroborate-demo` container on `:8788`.
- 15 adapters in the ontology across 10 trust roots; **only 4 have live probes**.
- `node_modules` was not copied — run `pnpm install` before building or testing.
- Foundry is not installed here; `scripts/compile.mjs` uses solc via npm instead.

**Next:** P0 subgraph-first inversion (fixes the torn-read scoring bug), then P0 landscape
aggregation. Both are described with acceptance criteria in `MISSION.md`.

**Blocked:** nothing.

## Iteration 1 — 2026-07-25

**Did:** P0 #1, the torn read. Killed it rather than merely reordering it.

- **New `packages/sdk/src/reconcile.ts`** — a pure decision table over (what the index says at
  the block it names) × (what the contract says at head). No I/O, so every branch is unit
  testable. The chain decides `held` (a revocation must not be invisible for as long as the
  index lags); the date comes from the most authoritative source available and the result
  always reports *which* and *at what block*.
- **Absence in the index is now evidence.** If the index has complete history for a credential
  class and does not have this credential at block B, the credential was issued after B — so
  its age is bounded, not unknown. Ramp weight is evaluated at that bound and capped by the old
  unknown-age midpoint: `min(bound, 0.5)`. A synced index therefore prices a brand-new
  credential as new (~0) instead of at 0.5, and an attacker who slows our index can at best
  recover the 0.5 it would have had anyway. Caveat `credential-not-yet-indexed` names the block.
- **PoH is now dated by the contract, so no index can move its score at all.**
  `getHumanityInfo(humanityId).expirationTime − humanityLifespan()` *is* the claim timestamp:
  verified live, `1815521110 − 31557600 = 1783963510`, exactly the `claimedAt` the subgraph
  reports for the same humanity. Two `eth_call`s, no indexer on the critical path. The index
  became a cross-check whose disagreements are reported (`index-date-disagrees-with-chain`).
- **Circles keeps the index-first path** because the Hub stores no registration timestamp — and
  that is where coverage honesty matters: our Circles data source is a ~2-month window, so
  absence proves nothing and must not bound anything (`index-coverage-partial`).
- **Found and flagged a second dating defect while measuring coverage.** The Circles mapping's
  `handleTrust` materialises an avatar for the trustee of an edge, stamping `registeredAt` with
  the *trust* timestamp. `inviter` is written only by `handleRegisterHuman`, so a null inviter
  is an exact discriminator for "this date is not the registration date". The SDK now detects it
  and flags `issuance-date-lower-bound`; the date is kept because it understates age (weight
  floor, never inflation). Live example: `0xd40133ea…b446` registered at block 36501311, indexed
  as 46647443 — 1.6 years late.
- Caveats added: `credential-not-yet-indexed`, `credential-ceased-since-index`,
  `issuance-date-lower-bound`, `index-date-disagrees-with-chain`, `index-coverage-partial`,
  `index-unreachable`, `freshness-check-unavailable`. `issuance-date-unknown` no longer fires
  for a bounded age, because claiming the age is unknown would be false.
- README, `docs/scoring.md` and the MCP comment corrected where they claimed a contract read
  cannot date a credential, plus the README's worked example re-run and re-stamped (it showed
  2.4409/275c from before real dates were computed; the true value today is 1.5683/36c).

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`. (Foundry was not
  installed here; installed per-user with `foundryup`, forge 1.7.1. Nothing system-wide.)
- `cd packages/sdk && npm test` → `# tests 66 # pass 66 # fail 0` (28 scoring, 18 reconcile,
  5 input, 15 live). Was 42 before this iteration.
- `node --test --experimental-strip-types src/live.test.ts` → 15/15, run 8 times, no skips.
  One run early on failed transiently on a public-RPC blip; the new live tests now skip loudly
  with the probe's error rather than failing when a source is unreachable, since an unreachable
  source says nothing about the mechanism under test.
- `cd apps/demo && npx playwright test` → `10 passed` (browsers were missing; installed
  chromium into this user's cache).
- The acceptance test asked for by `MISSION.md` is
  `reconcile.test.ts › "a credential that is real but not yet indexed is priced as new, and
  flagged"`, plus two live ones: PoH scores identically with and without the index, and a real
  Circles avatar outside the index window is flagged rather than silently re-dated (vector
  `0x3fc5c255…cb6d`, registered block 36503055, verified held on chain and absent from the
  index).

**Next, in the order I would do it:**

1. **Widen the Circles subgraph window and add a `registrationObserved` flag to both mappings**
   (PoH's `handleVouchRegistered` has the same placeholder-dating shape as `handleTrust`, and
   the schema currently cannot express it — `requestId` is *not* a discriminator, it is the
   request index, so 0 is the ordinary first claim). One resync fixes both. That turns two
   flagged approximations into real dates.
2. **P0 #2, the landscape.** Untouched. 15 ontology entries, 4 live probes.
3. PoH re-claims: `HumanityClaimed` has fired 1,391 times against ~1,364 lifetime humanities,
   so ~2% of entities have been re-claimed and both the chain-derived date and the index's
   `claimedAt` are the *latest* claim, not the first registration. On a survival ramp that
   understates age. `nbRequests` (now in `detail`) is the tell; a `firstClaimedAt` in the
   subgraph would fix it properly.

**Measured while working, worth keeping:** the PoH proxy has no code at Gnosis block 35846826
and code at 35846827, so the subgraph's `startBlock` really is the deployment block and
"complete history" is true rather than assumed. Enumerating every event the proxy has ever
emitted (20,252 logs, 30 distinct topics) shows `HumanityClaimed` is the only humanity-creating
event that fires — no manual grants, no cross-chain registrations — which is what makes absence
from the index safe to treat as evidence. Nine logs of one unidentified 3-topic event with a
uint40 payload remain unattributed; if that turns out to be a grant path, PoH's
`completeHistory` flag in `subgraph.ts` needs revisiting, but it cannot affect scores today
because PoH no longer uses the absence bound.

**Blocked:** nothing. Two notes: `MISSION.md` says to run `./test.sh` at the repo root, but the
only copy is `apps/demo/test.sh` and it `cd`s to its own directory before invoking
`packages/sdk`, so it cannot work from there — it wants moving to the root. And `pnpm install`
produced a `pnpm-lock.yaml` that is untracked and left uncommitted, since the repo tracks
`package-lock.json`; Hugo's call which to keep.

## Iteration 2 — 2026-07-25

**Did:** P0 #2, job 1 — the landscape. The ontology went from **15 adapters over 10 trust roots
to 30 over 18**, every entry with a trust root, an evidence class, forge and rent costs traced to
a cited anchor, an age curve, a liveness flag and a `sourceURI` that resolves to a real file.
Job 2 (probes) is deliberately untouched; the mission orders these two and they split cleanly.

- **New write-up: `research/landscape/ontology-coverage.md`.** The audit trail from the 21k lines
  of existing research to the deployed registry: the full roster with each protocol's disposition,
  a table of what we *refuse* to score and why, the derivation of every cost figure, the two root
  decisions that are judgement calls rather than documented facts, and a ranked queue of what is
  permissionlessly readable next. Synthesis, not new field research — every fact carries the deep
  dive it came from.
- **15 adapters added:** poh-v1, rarimo, anon-aadhaar, human-passport, holonym-gov-id,
  holonym-biometrics, billions, fractal-id, zkme-meid, sismo, nomis, trusta-sybil,
  farcaster-account, encointer, humanode.
- **Three defects found and fixed in the existing ontology.** (1) Civic Pass sat on
  `kyc-vendor:persona`; its vendor is FaceTec integrated directly — the dedup table names Civic on
  the FaceTec row and Persona's row names Coinbase. (2) BrightID sat on `social-vouching:poh`,
  which would have saturated two vouching graphs that share no vendor and no members; the source
  lists them as safe to count independently. (3) `humanity-protocol` sat on `trustRoot: "unknown"`
  — the mission asked for this one by name. `unknown` is not a root: it scores as *full
  independence*, the direction that pays an adversary. Resolved to `kyc-vendor:unattributed` (their
  own config defines `is_human` as "KYC **or** palm enrollment" and the vendor is undisclosed) and
  marked `live: false` — mainnet offline since the 2026-06 key compromise, 28 verifications in the
  oracle's entire life, none since February, and every read needs an OAuth client and a fee.
  No score moved: all three are `live: false` and contribute zero, which is exactly why the errors
  survived unnoticed.
- **Root widened deliberately:** `kyc-vendor:facetec-synaps` → `kyc-vendor:facetec`. FaceTec's 1:N
  galleries are per-integrator, so Anima's and Holonym's databases really are separate — but a
  technique that defeats FaceTec defeats every deployment, and a root prices the adversary's
  cheapest path, not database boundaries. Four adapters now saturate where three roots stood.
  More correlation costs an honest subject one root's worth; less pays the adversary a multiplier.
- **`kyc-vendor:unattributed` is one root on purpose,** covering Humanity, Holonym `gov-id`
  (one of Onfido/Sumsub/iDenfy/Veriff, and the credential does not say which) and zkMe. We cannot
  prove they are different vendors, and if two are the same, separate roots let one check score as
  two. The residual — Holonym `gov-id` might be a Sumsub check that ought to saturate against Galxe
  — is written down rather than hidden.
- **New test file `packages/sdk/src/ontology.test.ts`** (10 tests): every claimed root is declared
  and every declared root is used, no adapter sits on `unknown`, ids are unique and kebab-case
  (they are hashed into the registry key, so a rename silently forks history), curves and
  half-lives agree, costs are whole cents with rent ≤ forge (nothing in the landscape is
  rental-resistant), every `sourceURI` resolves to a file that exists, every `live: false` entry
  says why, every `implemented: true` adapter has a probe and every probe has a live entry, and
  the shipped `ontology-data.json` is byte-identical to `ontology/adapters.json`.
- **`scripts/deploy.mjs` seeds incrementally.** It reads `allAdapters()` first and only writes what
  actually differs. Every `setAdapter` bumps `revision` and emits the full record, and that event
  stream *is* the audit trail a subject reads to ask why their score moved — re-seeding an
  unchanged adapter fabricates a change that never happened. It now also records the deployed
  adapter count, root count, revision and the ids that last moved it into `deployments/sepolia.json`.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 76 # pass 76 # fail 0` (was 66; +10 ontology invariants).
- `cd apps/demo && npx playwright test` → `10 passed`.
- `node scripts/deploy.mjs --seed-only` → wrote 19 adapters (15 new + 4 corrected), left 11
  untouched, registry `0x977b028b…aa07` now **30 adapters, revision 34**. A second run wrote
  nothing and reported "30 already identical on-chain", which is the incremental path proving
  itself.
- Read back independently through `loadOntology()`: 30 adapters, 0 unnamed, `humanity-protocol`
  → `kyc-vendor:unattributed` `live=false`, `civic-pass` → `kyc-vendor:facetec`, `brightid` →
  `social-vouching:brightid`.

**Next, in the order I would do it:**

1. **P0 #2, job 2 — probes.** The ranked queue is §6 of `ontology-coverage.md`, and the top of it
   is **Human Passport**: `Decoder.getScore(address)` is a plain `eth_call` on seven mainnets with
   addresses already tabulated in `research/protocols/passport-civic-fractal-zkme-galxe.md`, and it
   is by far the largest user population available to us. Then Farcaster (`IdRegistry.idOf`, one
   call), Holonym (Optimism state + unauthenticated REST), Linea PoH (Verax attestations), World's
   document and Selfie tiers, and PoH v1 on a registry we already talk to. Read the *mechanism*,
   not a magic number, per the checklist at the bottom of `MISSION.md`.
2. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's note 1).
3. **Research debt named in the mission that I could not close honestly:** Quadrata and Talent
   Protocol are both alive (checked, 200s, 2026-07-25) but have no deep dive, and their docs are
   client-rendered so nothing about their trust roots is established. Binance BABT is probably the
   highest-value missing entry — weighted equal to a government ID inside Human Passport, and an
   ERC-721-shaped read on BNB Chain — but it needs a vendor attribution before it can be rooted.
   All three are left *out* of the ontology on purpose: an entry with an invented root is worse
   than an absent one.

**Blocked:** nothing. Two notes for the morning, both in `MORNING.md`: the KYC forge figure is
wrong by ~60× against our own research and I left it alone rather than silently rewriting eleven
weights (it does not bind today, since scoring takes `min(forge, rent)`); and two count strings in
`apps/demo/index.html` are now stale, which I cannot fix because the design agent owns that file
and the harness enforces it.

## Iteration 3 — 2026-07-25

**Did:** P0 #2, job 2 — the first probe off the ranked queue (§6 of `ontology-coverage.md`):
**Human Passport**, read permissionlessly on all seven Decoder deployments. Five adapters
implemented now, up from four.

- **Read the resolver, not `getScore`.** `Decoder.getScore` is revert-driven — `AttestationNotFound()`
  (`0x120a2e77`) when nothing was minted, `AttestationExpired(uint64)` (`0x06c09405`) when the score
  aged out, both selectors confirmed against live reverts — and it throws away the issuance date.
  That date is what the decay curve needs, so the probe calls `GitcoinResolver.getCachedScore`, the
  same struct the Decoder consults, which returns `{score, time, expirationTime}` in one hop. The
  resolver address is never hard-coded: each Decoder is asked which resolver it trusts
  (`gitcoinResolver()`), cached per process, so their upgrade cannot leave us reading a resolver
  the Decoder has stopped believing.
- **Seven chains, because one is wrong.** A passport is minted per chain and the mints disagree:
  `0xb0812e00…90F2` holds 50.015 on Optimism and Linea, 25.099 on Scroll from a year earlier, and
  nothing on Base, Arbitrum, Shape or zkSync. We read all seven in parallel and take the freshest
  unexpired mint. A chain that does not answer is dropped and *named* in `detail.chainsUnreadable`;
  only a total failure returns an `error`, because an RPC outage must not read as "no wallet history".
  Four subjects across seven chains resolve in ~1.1 s warm.
- **Two facts the ontology did not record.** `maxScoreAge()` is 7,776,000 s on every deployment, so a
  passport **hard-expires at 90 days** and the 180-day half-life only ever applies over the first 90;
  the probe flips to `held: false` at exactly the instant the Decoder starts reverting. And
  `threshold()` is 200000 — the "Passport 20+" convention as an on-chain constant. We report
  `meetsPassportThreshold` and never consume it: adopting the number would be adopting their
  weighting, adopting the threshold would be adopting their policy.
- **The finding.** `getPassport()` shows the score is largely credentials we already price.
  `0xA6b7471f…67b1`'s 22.027 is a Holonym gov-id check plus a Holonym FaceTec biometric and *nothing
  else* — two roots already in the ontology, re-scored by somebody else's weights. Iteration 2's
  pricing already defused the double count (wallet-history root, 100 cents), so **no arithmetic
  changed**. What changed is that the collapse is visible: each stamp maps to the adapter that owns
  it and the result carries `aggregate-restates-other-credentials` naming those adapters and their
  roots, resolved from the deployed registry rather than a table in the SDK. That is the product
  thesis on one address instead of in a pitch.
- **Stamp names verified, not guessed** — from the Decoder's own on-chain provider array (102 names)
  and the per-platform `Providers-config.ts` files in `passportxyz/passport`. `Biometrics` is
  id.human.tech's FaceTec liveness; `CleanHands` is the sanctions screen built on the same gov-id
  check, so it shares that root. `BinanceBABT` is deliberately **unmapped**: weighted like a
  government ID and still with no vendor attribution in our research, and an invented root scores as
  full independence. It stays visible in `detail.stamps`.
- **Two vocabularies, one on chain.** The legacy bitmap stamps index into `getProviders()`; score-v2
  attestations carry provider strings inline that never enter that array (`Biometrics`, `Steam` prove
  it). The live test holds every mapped *legacy* name to the on-chain array so an upstream rename
  fails loudly, with `Biometrics`/`CleanHands` declared as the v2-only exceptions rather than a
  blanket exemption.
- New write-up: `research/protocols/human-passport-onchain-read.md` — addresses, the expiry
  derivation from both directions, what minting activity was and was not measurable on free
  endpoints, and the stamp→root map with its two judgement calls. `ontology-coverage.md` §6 item 1
  struck through, README updated (four adapters → five, test counts corrected to 114).

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 86 # pass 86 # fail 0` (was 76: +6 Passport live,
  +4 scoring). Per file: 32 scoring, 18 reconcile, 5 input, 10 ontology, 15 live, 6 passport-live.
- `node --test --experimental-strip-types src/adapters/human-passport.live.test.ts` → 6/6, `skipped 0`,
  positive path exercised (it sources a current minter from a recent EAS `Attested` log rather than
  pinning an address, since every passport expires in 90 days).
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- End to end through `resolve()`: `0xA6b7471f…67b1` scores **2.0025**, one root, with
  `aggregate-restates-other-credentials` naming `holonym-gov-id (kyc-vendor:unattributed)` and
  `holonym-biometrics (kyc-vendor:facetec)`. The README's worked pair is unchanged at 1.5687/36.04c
  and neither address holds a passport.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is *"our derived expiry agrees with what the Decoder itself does,
  on real addresses"*: it reads the cached struct, derives `expirationTime || time + maxScoreAge`,
  and requires the Decoder's `AttestationExpired` revert payload to equal that number to the second —
  or, if unexpired, requires `getScore` to return exactly the cached score.

**No registry write, on purpose.** `implemented` and `notes` are off-chain fields and no weight
moved, so a reseed would have bumped `revision` to record nothing — which is exactly what iteration
2's incremental seeding exists to prevent. Registry stays at **30 adapters, revision 34**.

**Next, in the order I would do it:**

1. **Keep going down the queue.** Next is **Farcaster** (`IdRegistry.idOf` on OP Mainnet, one
   `eth_call`), then **Holonym** (Optimism state — and note we now have live evidence that real
   subjects hold Holonym credentials, since two of the three passports read today carried them),
   **Linea PoH** (Verax), World's document/Selfie tiers, and **PoH v1** on a registry we already
   talk to.
2. **Binance BABT is now the most expensive piece of research debt**, not the third. It is no longer
   a protocol we might add — it is a stamp *inside a score we read*, so a live passport can be one
   third BABT with that third unattributable. `0x46760723…Df74` is exactly that.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still the
   cheapest way to turn two flagged approximations into real dates (iteration 1's note 1, unchanged).

**Measured while working, worth keeping:** on-chain Passport minting is *current*, not a 2023
artefact — score-v2 attestations landed at Optimism blocks 154,646,860 and 154,643,503 against a head
of ~154,689,600, i.e. within the last day. The legacy score schema clusters around blocks 130–132 M
with nothing in the sampled windows nearer head, consistent with score-v2 having superseded it.
Total minted population and the same question on Base/Linea/Scroll stayed **unmeasured**: the free
endpoints for those chains refuse historical `eth_getLogs` without a key, and buying an archive
endpoint to answer a population question would put a vendor on a path we keep vendor-free.

**Blocked:** nothing. Iteration 1's two notes still stand unresolved and are Hugo's calls, not
blockers: `./test.sh` lives at `apps/demo/test.sh` rather than the repo root where `MISSION.md` says
to run it, and `pnpm-lock.yaml` is still untracked beside a tracked `package-lock.json`.

## Iteration 4 — 2026-07-25

**Did:** P0 #2, job 2 — the next probe off the ranked queue (§6 item 2 of `ontology-coverage.md`):
**Farcaster**, read from `IdRegistry` on OP Mainnet. Six adapters implemented now, up from five.

The interesting part is not the read — `idOf(address)` is one call — it is the **date**. A fid costs
$0.44 one-off plus $0.20/yr (`IdGateway.price()` = 107,599,771,888,484 wei and
`StorageRegistry.usdUnitPrice()` = 20,000,000 @ 8dp, both read today), and the registry tripled
inside a nine-month subsidy window that ended in 2026-04. On the `Ramp` at 20 cents and a 730-day
half-life, an id has to *predate that window* to clear the 10-cent negligible-cost floor at all, so
the age carries the entire signal — and `IdRegistry` stores no timestamps.

- **The counter dates the fid.** `Register` logs are out of reach (`mainnet.optimism.io` answers
  `Block range is too large` above ~1,000 blocks, and 43,000 requests per lookup is not a read).
  But `idCounter()` is monotone and `register()` does `id = ++idCounter` in the same transaction
  that writes custody, so **the first block where `idCounter() >= fid` is the block that fid was
  created in**. That is a monotone predicate over archive state, which two — now three — keyless
  endpoints serve. Interpolation/bisection hybrid, 15–30 `eth_call`s, every sample cached, seeded
  with a measured ladder of `(block, counter)` landmarks. No indexer on the critical path.
- **The search verifies its own answer** before returning: `counter(B-1) < fid <= counter(B)`. That
  is what makes the seeded landmarks safe — a stale landmark can cause an error, never a
  plausible-but-early date, and on a Ramp an early date is free weight.
- **Finding 1: 193,791 fids are older than their date.** `idCounter` is 0 from deployment (block
  111,816,351, 2023-11-06) until block **111,904,738**, where it becomes 193,791 in one step. That
  block registers nothing: it holds six transactions and exactly one registry event,
  `SetIdCounter(0, 193791)` (topic `0x562044dc…4eed`, tx `0x84876178…dfb3`), and `custodyOf(1)` was
  already written two blocks earlier while the counter was still 0. This deployment
  (`VERSION` "2023.11.15") imported its predecessor's registry over a run of blocks and then set the
  counter administratively. The discriminator needs no table — the counter immediately before the
  creating block is zero — and the date is kept because too-late understates age (a weight floor,
  never an inflation). Caveat `credential-imported-from-predecessor-registry`.
- **Finding 2: fids are transferable, so we date custody, not the fid.** Fid 1 moved from
  `0x8773442740C17C9d0F0B87022c722F9a136206eD` to `0x7071CfBA18280FD0bC1142D98f8e67fb094d9544` at
  block 147,097,388 (2026-01-30); fid 200,000 moved at block 126,803,669 (2024-10-17). Crediting a
  bought fid with the registry's age would sell survival weight at OTC prices, so `issuedAt` is when
  *this address* acquired it, found by searching custody between the creating block and head. The
  search is over a non-monotone predicate, so it returns *an* acquisition and not provably the
  latest; a six-block continuity ladder restarts it above any later block where the subject does not
  hold the fid, which reduces the error without eliminating it, and the caveat
  (`credential-changed-hands`) says exactly that instead of implying a proof.
- **Measured end to end through `resolve()`:** fid 5, still held by its importer, contributes
  **12.19 cents and one independent root**; fid 1, bought in January, contributes **3.07 cents and
  none**. Same protocol, four times the weight for the one that was not for sale. That is the ramp
  doing its job on real data.
- **Farcaster Pro is not readable, and that is the finding.** It is the only Farcaster signal with a
  real recurring price — `TierRegistry.tierInfo(1)` on Base decodes to 328,767 @ 6dp/day = $119.9999
  a year, verified today by raw `eth_call` — but the contract stores tier *configuration* and no
  per-fid subscription state (a `PUSH4` scan of its bytecode finds 41 selectors and no fid-keyed
  getter), so a subject's Pro status lives only in `PurchasedTier` logs, and no keyless Base endpoint
  serves those over full history. It stays out of the ontology rather than entering it as a number
  we cannot check.
- **Two new provenance notes and two new caveats**, `date-from-registry-import` and
  `credential-transferred-since-issuance`. They are the first notes in `reconcile.ts`'s vocabulary
  that are not about index-vs-chain, and the header now says why they live there: they answer the
  same question — how far can this date be trusted — and get the same caveat plumbing.
- **Endpoints.** Three keyless OP endpoints serve archive `eth_call` and agree to the id:
  `mainnet.optimism.io`, `optimism.drpc.org`, `gateway.tenderly.co/public/optimism`. Calls rotate
  across them and retry the whole set twice, because a search is a couple of dozen historical calls
  and every one of them will eventually say "your IP has exceeded its requests per second capacity".
  `publicnode`, `1rpc.io/op` and `op-pokt.nodies.app` answer at head and refuse historical state;
  `onfinality` serves archive and throttles within a handful of requests; `optimism.gateway.tenderly.co`
  has pruned past ~130 M. An endpoint answering `0x` means "no code at that block"; a pruned node
  *errors*, so a pruned node can never be mistaken for an empty registry.
- **Fixed a flake I caused, at the root.** Human Passport's Optimism read used `mainnet.optimism.io`,
  which is one of the few keyless *archive* endpoints — so the two adapters competed for the scarce
  resource and the passport suite started failing. Passport only ever reads at head, so it moved to
  `optimism-rpc.publicnode.com` (verified to return the same resolver, `maxScoreAge` and `threshold`).
  Archive quota now goes to the reader that needs it.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 96 # pass 96 # fail 0 # skipped 0` (was 86: +8 Farcaster
  live, +2 scoring). Run three times consecutively, all green. Per file: 34 scoring, 18 reconcile,
  5 input, 10 ontology, 15 live, 6 passport-live, 8 farcaster-live.
- `node --test --experimental-strip-types src/adapters/farcaster.live.test.ts` → 8/8, `skipped 0`,
  three consecutive runs.
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is *"the date derived from idCounter is the block the Register
  event is in"*: it takes a fid sampled from head, runs the counter search, then requires exactly one
  `Register` log for that fid in the derived block, with the logged registrant equal to the custodian
  the probe read from state, and **zero** such logs in the preceding 1,000 blocks. Two subsystems of
  the node agreeing about one fid, where the probe only ever consulted the first. Plus a live test
  that re-reads all 17 seeded counter landmarks against the chain, one that proves the import block
  contains a `SetIdCounter` and no `Register` at all, and one that checks the transfer bisection's
  answer at both sides of the boundary block.

**No registry write, on purpose.** `implemented` and `notes` are off-chain fields and no weight
moved, so a reseed would bump `revision` to record nothing. Registry stays at **30 adapters,
revision 34**.

**Next, in the order I would do it:**

1. **Keep going down the queue.** §6 now reads: **Holonym / Human ID** (Optimism state plus a public
   unauthenticated REST endpoint; needs us to publish a stable action-id first, which is a design
   decision rather than a lookup — and note two of the three passports read in iteration 3 carried
   Holonym credentials, so the population is real), then **Linea PoH** (Verax attestations),
   **World's document/Selfie tiers** (which P1 wants anyway, so World appears in the score and not
   only in the agent gate), and **PoH v1** on a registry we already talk to.
2. **The predecessor Farcaster registry.** Its address would date the 193,791 imported fids exactly —
   the oldest and, on a Ramp, the most valuable cohort in the registry. Neither the bulk-registration
   calldata nor `SetIdCounter` points at it, and it is not in any research file here, so it needs a
   source actually read rather than recalled.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still the
   cheapest way to turn two flagged approximations into real dates (iteration 1's note 1, unchanged
   through three iterations now).

**Measured while working, worth keeping:** the OP archive situation is the real constraint on this
class of probe, and it is worth knowing before building another one. Of eight keyless endpoints
tested, three serve full archive state, one serves it and throttles immediately, one is pruned past
~130 M, and three refuse historical state outright — so any future "search historical state" adapter
is sharing a budget of three endpoints with this one. The landmark ladder exists because of that:
seeding the two blocks that straddle the import cliff takes the imported cohort from ~85 calls to 6.

**Blocked:** nothing. Iteration 1's two notes still stand and are Hugo's calls, not blockers:
`./test.sh` lives at `apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it,
and `pnpm-lock.yaml` is still untracked beside a tracked `package-lock.json`. One new item for the
morning: `farcaster-account` carries `forgeCostCents: 12000`, which is the *Pro* subscription price
on an adapter that does not read Pro — untrue about the world, non-binding today because
`min(forge, rent)` takes the 20 cents, and left alone rather than silently rewritten, exactly as
iteration 2 left the KYC forge figure.

## Iteration 5 — 2026-07-25

**Did:** P0 #2, job 2 — the next probe off the ranked queue (§6 item 3 of `ontology-coverage.md`):
**Holonym / Human ID**, read from `Hub` V3 on OP Mainnet. Eight adapters implemented now, up from
six: this one contract carries two ontology entries, `holonym-gov-id` (`kyc-vendor:unattributed`)
and `holonym-biometrics` (`kyc-vendor:facetec`).

**The blocker on this item was false, and finding that out was most of the work.** §6 said it
"requires us to publish a stable action-id first, which is a design decision, not a lookup".
That is true of the *vendor's REST endpoint* — Holonym's uniqueness is scoped per action-id and
`/sybil-resistance/gov-id/optimism` will not answer without one. It is not true of the Hub:
`getSBT(address, circuitId)` is keyed on holder and circuit, and the action-id comes back inside
the proof as `publicValues[2]`. So we report the namespace the credential was minted for instead
of choosing one, and no design decision is needed. Reading the Hub also drops two things the API
would have imposed: an off-chain DynamoDB blocklist we cannot see (their endpoint answers a
question about their policy, not about the chain), and a gov-id path that silently falls back to
the zk-passport circuit — which for us would merge an ICAO root into a KYC-vendor root and let
one document score twice.

- **Presence is forgeable, and the contract says so in its own comments.** `Hub.sol`: *"make sure
  you check the public values such as actionId from this. Someone can forge a proof if you don't
  check the public values, e.g., by using a different issuer or actionId."* The circuit proves
  that *an* issuer signed the credential and anyone can run an issuer key, so the probe pins
  `publicValues[4]` against Holonym's per-credential issuer and returns `held: false` with both
  keys printed when it differs. An adapter that treated an SBT under the right circuit id as
  evidence would have counted self-issued credentials.
- **Uniqueness needs its own read.** `setSBT` burns the nullifier it is *handed*, and nothing
  constrains that argument to equal `publicValues[3]`, the nullifier the circuit derived. If they
  differ, the holder's uniqueness slot for that action was never consumed and the same human can
  hold the credential on unlimited addresses. `nullifiersToIdentifiers(publicValues[3])` must map
  back to this holder; ten SBTs sampled across the registry's life all passed, and it is reported
  per subject rather than assumed.
- **The date is a ZK constraint, not a convention.** The Hub stores no issuance timestamp, and the
  expiry it does store is chosen by the *holder* — `V3.circom` tells them to pick it randomly
  before their issuance date, for anonymity. So subtracting a fixed term would be inventing a
  date. What is provable is the ceiling: the circuit constrains `expiry - iat < 31,536,001` with a
  25-bit range check, so **`expiry - one year` is a proven lower bound on issuance** for every SBT
  the Hub accepted. A lower bound on issuance is an upper bound on age, and on a `Decay` curve the
  oldest a credential can be is the least weight it can support — so the bound is used as the
  date. It can only understate freshness, never inflate it. New provenance note
  `date-from-expiry-and-max-term`, new caveat `issuance-date-derived-from-expiry`.
- **Measured how loose that bound is, and it is looser than I first assumed.** Thirteen live SBTs
  were dated by searching historical state for the block they were minted in, then compared: for
  eleven the bound sat 4–29 days before the mint, but for two it sat **187 and 257 days** before
  it. That is not an error — the holder bought that much anonymity, or the credential really was
  issued months before it was minted, and nothing on chain distinguishes the two. My first version
  of the live test asserted the bound lands within 90 days of the mint; it passed on the first
  runs and then failed once the sampler happened to pick one of those holders. The assertion was
  wrong, not the world, and it is gone. The suite now
  asserts only the ceiling and the ordering, which are the things the protocol actually
  guarantees. The exposure is bounded on the right side: a held credential is at most a year old,
  so its weight can never fall below 2^(-365/half-life) and can never be inflated at all — an
  invariant the live suite asserts.
- **Two facts the ontology did not record, now in its notes.** A Holonym credential hard-expires
  within a year of the check behind it (`getSBT` reverts the instant `expiry < block.timestamp`;
  the whole 2024–early-2025 cohort has lapsed), so the 730-day half-life on `holonym-gov-id` only
  ever applies over that first year — the same shape as Passport's 90-day expiry against a 180-day
  half-life. And the credential is readable permissionlessly, which the old note said was possible
  and nobody had done.
- **`sbtOwners` before `getSBT`, deliberately.** `getSBT` reverts identically for expired, revoked
  and never-minted, so calling it blind turns "this person's KYC lapsed in January" into a probe
  *error* — an unreadable credential rather than an expired one, which is a different claim about
  a person. The raw mapping getter runs none of those checks. It also makes the common case (an
  address with no Holonym credential) a single `eth_call`. This was a real bug in my first draft,
  caught by running the probe against an address holding a lapsed SBT.
- **238,706 SBTs minted**, at block 154,692,312 — the hard number
  `billions-silk-unitap-sismo-intuition.md` asked for, obtained by bisecting `ownerOf` (the Hub is
  an ERC-721 with no enumeration and a private counter) rather than by the event index it
  proposed. It counts mints, not humans: among the twelve newest tokens one address holds three
  consecutively.
- **Zero archive calls in the probe** — two `eth_call`s at head, three when a credential is held.
  After iteration 4, that is a deliberate property: only three keyless OP endpoints serve archive
  state and the Farcaster adapter needs all of them. The *live test* does the state search,
  because confirming a date against history is exactly what the probe avoids having to do.
- **The loop from iteration 3 closes.** Iteration 3 read `0xA6b7471f…67b1`'s Human Passport —
  22.027 points — and found it was a Holonym gov-id stamp plus a Holonym biometrics stamp and
  nothing else. Today the same address reads directly against Holonym's own contract and both
  credentials are there: minted 2026-07-24 three minutes apart, both under Holonym's issuer keys,
  both with their nullifiers burned. The collapse is now one credential observed from two
  directions rather than a stamp name we trusted. Its score moved 2.0025 → **3.6088** with three
  independent roots, and nothing double-counted: the passport still contributes its wallet-history
  dollar and still names the two adapters it restates, which now hold evidence of their own.
- New write-up: `research/protocols/holonym-human-id-onchain-read.md` (addresses, circuit ids, the
  two conflicting passport circuit ids, the date derivation from both directions, the mint table,
  and what is deliberately not read). `ontology-coverage.md` §6 item 3 struck through, `INDEX.md`
  now lists the three implementation write-ups, README updated (six adapters → eight, test counts,
  and its trust-root diagram corrected — it still showed Civic Pass under Persona, which
  iteration 2 fixed in the ontology four iterations ago).

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 113 # pass 113 # fail 0 # skipped 0` (was 96: +10
  Holonym unit, +7 Holonym live). Per file: 34 scoring, 18 reconcile, 5 input, 10 ontology,
  10 holonym unit, 15 live, 6 passport-live, 8 farcaster-live, 7 holonym-live.
- `node --test --experimental-strip-types src/adapters/holonym.live.test.ts` → 7/7, `skipped 0`,
  three consecutive runs.
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is *"the date is the earliest issuance the circuit allows, and
  the mint block proves it"*: it samples a current holder out of the Hub's own token ids, searches
  historical state for the block the SBT was minted in, and then requires (a) the expiry to be no
  more than the circuit's 31,536,000-second ceiling past that block, (b) the probe's date to
  precede it, and (c) the mint's ERC-721 `Transfer` from the zero address to be in that exact
  block. Three sources — the mapping's history, the log index, and the probe's arithmetic — and
  the probe consults only the third.

**No registry write, on purpose.** `implemented` and `notes` are off-chain fields, `sourceURI` was
deliberately left pointing at the file the *costs* came from, and no weight moved — so a reseed
would bump `revision` to record nothing. Registry stays at **30 adapters, revision 34**.

**Next, in the order I would do it:**

1. **Keep going down the queue.** §6 now reads: **Linea Proof of Humanity V2** (Verax attestations
   on Linea, portal `0xe8a3…3922`, attester `0xc5db…1c0d` — a passive per-subject read that
   retires nothing), then **World's document/Selfie tiers** (which P1 wants anyway, so World
   appears in the score and not only in the agent gate), then **PoH v1** on a registry we already
   talk to.
2. **The Holonym passport circuit is one resolved question away from an ICAO-rooted adapter.**
   `holonym-api` and `id-server` name *different* circuit ids for it (`0x14c35133…0b747e` vs
   `0xf2ce248b…67364d`) and neither repo mentions the other's, so we do not know which one current
   issuance mints. Resolving it adds the largest correlation cluster in the landscape — the
   passport chip — to a contract we now read fluently. It needs an issuance observed end to end,
   not a constant copied out of a repository.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's note 1,
   unchanged through four iterations now).

**Measured while working, worth keeping:** one sampled token id (230,000) belongs to a holder with
no record under *any* of the six circuit ids the two Holonym repositories name, so the Hub serves
at least one circuit neither repository documents. It cannot affect a score — we read two circuits
by id — but the credential list is Holonym's to extend, and a future "read every Holonym
credential" adapter cannot be built from those constants alone. Separately, the legacy v2 store
(`0xdD748977…Fce31`) returned `false` for every V3 holder sampled and for both Passport-stamped
addresses; a live test now asserts that, so the day it changes we will hear about it.

**Blocked:** nothing. Iteration 1's two notes still stand and are Hugo's calls, not blockers:
`./test.sh` lives at `apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run
it, and `pnpm-lock.yaml` is still untracked beside a tracked `package-lock.json`.

## Iteration 6 — 2026-07-25

**Did:** P0 #2, job 2 — the next probe off the ranked queue (§6 item 4 of `ontology-coverage.md`):
**Linea Proof of Humanity V2**, read from the Verax attestation registry on Linea. Nine adapters
implemented now, up from eight.

**The queue said "passive per-subject read". There is no per-subject read, and there does not need
to be.** Verax stores `subject` as `bytes` and keys attestations by a sequential id; a subject index
requires the `IndexerModule`, which the Sumsub portal does not register (`getModules()` → `[]`,
asserted live). That is why Linea ships a signature path instead, and why our own research file
concluded "there is no efficient on-chain *does address X have a PoH attestation* read". Both
premises are true. The conclusion only follows if you have to *search*.

- **The credential expires, so the whole live population is a small contiguous id range.** A PoH V2
  attestation carries a 90-day term, and `attestedDate` is the block timestamp at write while ids are
  handed out in order — so `attestedDate` is monotone in id, and every unexpired attestation in the
  *entire* registry sits in `[first id with attestedDate >= now-90d, counter)`. Measured today: a
  **1,024-id window against a counter of 6,366,748**, read whole through Multicall3 in six batched
  calls, 4–5 s. What the probe holds is therefore not one answer but the **complete live
  population — 500 attestations over 499 addresses** — so `held: false` means *we read every live
  credential and you are not among them*, and `detail` carries the population that makes the claim
  checkable. No indexer, no vendor, no API key.
- **Galloping, not bisecting.** A doubling ladder (`counter-1, counter-2, counter-4, …`) brackets the
  window in *one* batched round trip; bisecting for an exact boundary would cost ~22 sequential
  `eth_call`s to save scanning ids we were going to scan anyway. The scan *is* the boundary search.
  Everything reads at one pinned block, so the counter cannot advance underneath it — the torn read
  `reconcile.ts` exists to prevent, in miniature — and `now` is that block's timestamp, not the local
  clock, because expiry is what on-chain consumers compare against `block.timestamp`.
- **Our own research named the wrong portal, and the fix is not a better constant.**
  `privado-id-and-verax.md` gave the Sumsub portal as `0xe8a3a57e…b73922`. That one has issued
  **four** attestations, all on 2025-07-02/03, all expired since September; production is
  `0x501e742C…7D5B46` with 50,471. An adapter pinned to the researched address would have returned
  `held: false` for the entire population **while looking like it worked** — the contract answers,
  the schema matches, nothing errors. There are *three* registered Sumsub portals, so the address is
  the wrong thing to pin. The anchor is the portal's registered **owner**,
  `0x887F94C1283697c607b321860bd95263AC0E2467`, with `PortalRegistry.isIssuer(owner)` re-read at
  runtime (Consensys' allowlist; `deployDefaultPortal` from a non-issuer reverts). The dead test
  portal is kept in the code as a tripwire and a live test asserts it shares the owner *and*
  contributes nobody.
- **`ownerName` and `attester` are both worthless as checks, and the second one took an experiment.**
  `ownerName` is a string the portal's creator supplies — it says "Sumsub" on all three portals and
  would on anyone else's. `attester` is `msg.sender` on the portal's `attest` call: simulating
  `attest` with a bogus 65-byte signature from a stranger, from Sumsub's own attester key, and from
  the portal owner returns the **identical** revert (`ECDSAInvalidSignature`, `0xf645eedf`), which
  proves the gate is the signature and not the caller. So `attester` records a relayer. The portal's
  authorised signer is instead read *from the portal* — `signerAddress()`, selector `0x5b7633d0`,
  found by brute-forcing its `PUSH4` set since it is unverified on any explorer we can reach without
  a key — and reported as corroboration rather than used as a filter, because it is a key Sumsub may
  rotate and a rotation must not retroactively un-verify anybody.
- **The finding: Linea's own reads are ten months stale, so ours is the *more correct* one, not just
  the purer one.** `poh-api.linea.build/poh/v2/{addr}` returned **`true` for 45 of 45** addresses
  whose every attestation had expired (earliest expiries 2025-09-29), sampled across eight cohorts
  spanning the schema's history. It is not only the REST boolean: the signer API signs for them, and
  `PohVerifier(0xBf14cFAF…20831).verify(sig, 0xf1d1f857…)` returns **`true` on chain** for an
  address whose attestations died 2025-09-29. A never-verified address still gets HTTP 500, so the
  endpoint distinguishes verified from not — it just answers "was **ever** verified".
  `PohVerifier.getSigner()` is a *different* key from the Verax attester, which is how the two
  authorities drifted apart. **50,475 attestations ever issued against 500 live** means the vendor
  boolean and the registry describe populations **101× apart**.
- **Issuance is a campaign, not a population.** By month: 24,723 in 2026-01 (half the protocol's
  lifetime issuance), then 1,264 / 571 / 347 / 325 / 121, and **11** in the first 25 days of July.
  With a 90-day term the campaign has fully expired. `live: true` is still right; the weight this
  credential can carry for any subject is small and short-lived by construction.
- **A bug I introduced and caught by re-running.** Extracting the selection logic into the pure
  `selectLivePoh` dropped the `revoked` guard from the live filter, so the one revoked attestation in
  the window was counted as a person (500 → 501 live, 499 → 500 subjects). Caught because I compared
  the refactored number against the pre-refactor one instead of assuming. There is now a unit test
  for it, and the pure function exists precisely so that branch is testable without a network.
- **Third instance of one shape, worth naming once.** A hard expiry truncates a decay curve, so a
  half-life longer than the expiry never completes: Human Passport hard-expires at 90 days against a
  180-day half-life, Holonym within a year against 730, and Linea PoH at 90 days against 90. The
  sampled subject scored today was 89.9 days old — freshness **0.5005**, i.e. its weight had just
  about reached the floor hours before the credential dies.
- New write-up `research/protocols/linea-poh-onchain-read.md` (addresses, selectors, revert payloads,
  the three failed anchors and why, the vendor-staleness measurement, and what is deliberately not
  read). `privado-id-and-verax.md` now carries a **CORRECTED** block at the head of its Linea PoH
  section naming its two wrong claims, since leaving a known-wrong portal address in a research file
  is exactly the hazard the mission's rule 5 is about. `ontology-coverage.md` §6 item 4 struck
  through and its roster row flipped to `impl ✔`, `INDEX.md` lists the fourth implementation
  write-up, README updated (eight adapters → nine, new section, test counts).

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 150 # pass 148 # fail 0 # skipped 2` (was 113: +19 Linea
  unit, +18 Linea live). The 2 skips are the two tests that consult the Verax subgraph, which
  returned HTTP 429 — see the honest note below. Per file: 34 scoring, 18 reconcile, 5 input,
  10 ontology, 10 holonym unit, 19 linea-poh unit, 15 live, 6 passport-live, 8 farcaster-live,
  7 holonym-live, 18 linea-poh-live.
- `node --test --experimental-strip-types src/adapters/linea-poh.live.test.ts` → **16/16, `skipped 0`**
  on the run before I exhausted the subgraph's quota; **16/18 pass, 0 fail, 2 skip** on every run
  after. Nothing failed at any point; the two skips are `t.skip("the Verax subgraph unreachable:
  HTTP 429")`, which is the designed behaviour — an unreachable source says nothing about the
  mechanism. I caused the 429 myself by paging the whole 50,475-attestation history through Studio to
  measure the term distribution, and then made it worse by launching a background counter that
  competed with the test; I killed that and the limit had not reset after ~10 minutes, so it is a
  window longer than that.
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- End to end through `resolvePersonhood()`: a subject sampled out of the live population scores
  **3.1768** / 1501.36 cents / one root, `heldFrom: chain`, `dateFrom: chain`, freshness 0.5005.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is **"the population the chain gives us is the population an
  independent indexer gives us"**: it pins both our enumeration and the Verax subgraph to the *same
  block* and asserts **set equality** of live subjects plus per-subject date equality — not a count,
  so a single missed subject fails it. It ran green (500 attestations, 499 subjects, zero symmetric
  difference in both directions) before the rate limit. Because that oracle is a third party and can
  be throttled, there is now a **second, chain-only** completeness test that never skips: *"nothing
  below the window is still alive"* reads the 600 ids immediately beneath `scannedFromId` and
  requires every attestation on our schema there to be revoked or expired — which, with the
  monotonicity test beside it, proves the window's lower edge from the chain alone. Plus a live test
  that re-derives the 90-day term ceiling over the whole live population every run, since that
  constant is the single assumption completeness rests on (the probe also self-widens and reports
  `windowWidened` if it is ever exceeded).

  **The subgraph staying throttled for twenty minutes is what made me finish that argument**, and it
  was the right prompt: an acceptance test whose oracle is somebody else's free dev endpoint can be
  silenced by anyone, including by me. Completeness is now provable from the chain with no third
  party in it, as five facts that are each separately asserted: `attestedDate` is monotone in id
  **across the whole 6.37M-id registry** (sampled logarithmically, not just inside the window — the
  test that licenses extrapolating past the 600 ids we read directly); the id immediately below the
  window predates `now - maxTerm`; those 600 ids are each revoked or expired; no live attestation
  carries a longer term than the bound; and nothing at or above the counter exists, because the
  contract reverts. The subgraph comparison is now corroboration of a proof rather than the proof.

**No registry write, on purpose.** Root, evidence class, curve, half-life and both costs are
unchanged — only `implemented` and `notes`, which are off-chain fields — so a reseed would bump
`revision` to record nothing, which is what iteration 2's incremental seeding exists to prevent.
Registry stays at **30 adapters, revision 34**.

**Next, in the order I would do it:**

1. **Keep going down the queue.** §6 now reads: **World's document/Selfie tiers** (which P1 wants
   anyway, so World appears in the *score* and not only in the agent gate), then **PoH v1** on a
   registry we already talk to. After those the passively-readable queue is empty and the remaining
   ontology entries are the ones §6 documents as *not* passively readable — at which point the next
   marginal probe is worth less than P1's as-of scoring or the ENS agent track.
2. **`docs/scoring.md` should say once what three adapters now say separately:** a hard expiry
   truncates a decay curve, so a half-life longer than the expiry is a half-life that never
   completes. Passport (90d vs 180d), Holonym (365d vs 730d) and Linea PoH (90d vs 90d) all have this
   shape and it is currently only in adapter comments.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still the
   cheapest way to turn two flagged approximations into real dates (iteration 1's note 1, unchanged
   through five iterations now).

**Measured while working, worth keeping:** the Verax Linea registry has taken **6,366,748**
attestations in its life and roughly **700 in the last 90 days**, which is what makes the
enumeration cheap — and it is a fact about *this* registry, not about Verax, so a future Verax-based
adapter on Base or Arbitrum must re-measure before assuming the same trick works. `getAttestation`
reverts `0x0e35f2bc` above the counter, so an absent id is information rather than an error. And the
Sumsub "Proof of Humanity" schema `0x0094bda6…c0d0af` (11 attestations, from a third Sumsub portal)
is a variant that never carried a population — recorded so a later iteration does not rediscover it.

**Blocked:** nothing. One measurement I could not close honestly and left written down as an open
question in the write-up rather than guessed: **how many distinct humans have ever held a Linea PoH**
(50,475 attestations over an unknown number of subjects). The exhaustive on-chain scan of the full
99,577-id history was still recovering rate-limited batches after 28 minutes when I stopped it, and
the paged indexer count hit the same 429 as the tests. The live figure (499 subjects for 500
attestations) suggests renewal is rare and the answer is probably near 50,000, but "probably" is not
a measurement and it is not in the ontology. Iteration 1's two notes still stand and are Hugo's
calls, not blockers: `./test.sh` lives at `apps/demo/test.sh` rather than the repo root where
`MISSION.md` says to run it, and `pnpm-lock.yaml` is still untracked beside a tracked
`package-lock.json`.

## Iteration 7 — 2026-07-25

**Did:** §6 item 5 of `ontology-coverage.md` — **World's document and Selfie tiers**. The answer is
that neither can be read, by us or by anyone, and establishing that properly turned up the thing
that mattered: **the tier we do read was being read from the wrong contract, and the score it
produced was wrong in the adversary's favour.**

- **The defect.** `AgentBook.lookupHuman` returns a nullifier and **no date**, and `freshnessOf`
  scores an undated `Decay` credential at freshness **1** — full weight, forever. So every World
  credential we found was priced as though issued this morning. AgentBook is also a registry of
  *agents*, not humans: **1,068 transactions in its entire life**.
- **`WorldIDAddressBook`** (`0x57b930D5…E0330D`, verified source, Blockscout tags it "World Chain:
  World ID Address Book" for worldcoin.org, deployed 2024-08-27) fixes both halves. `verify()`
  writes `addressVerifiedUntil[account] = block.timestamp + verificationLength` after the router
  accepts a group-1 proof, so `verifiedUntil − verificationLength()` is the **exact second the
  verification was mined** — checked against block headers on **24 samples spanning 2025-04-18 to
  2026-07-25, every one to the second**. Coverage measured from twelve 100-block windows:
  ~28,000 verifications/day at head, 60,000–80,000/day through 2025.
- **`held` is a comparison, never a presence check.** The mapping is never cleared, so a lapsed
  verification is a large number sitting in it forever — 7 of 12 accounts sampled from 2025-04-18
  and 8 of 12 from 2026-01-21 are in exactly that state. An `!= 0` read counts all of them.
- **The date is exact only while the term is the term the entry was written under**, so the full
  config-event history was scanned (7 chunked `eth_getLogs`, deployment → head): the contract has
  emitted **exactly two config events in its life** — initialisation (term 14,515,200 = 168 days,
  groupId 1, 2024-08-27) and one `WorldIdRouterUpdated` on 2026-01-08. The term has never moved.
  The probe reads it live anyway and refuses any derived date landing before the contract existed
  or after the block it read, so a future `setVerificationLength` can cost us a date but can never
  invent one. A live test holds the current term to the initialisation event as a tripwire.
- **The date is a binding, not an iris.** It is when this address last re-proved a World ID, not
  when the human enrolled at an Orb (`genesis_issued_at` lives inside the v4 credential and never
  touches a chain). New provenance note `date-from-latest-reattestation` → caveat
  `issuance-date-is-latest-renewal`. On a decay curve that is the conservative reading: the
  enrolment is older, so the weight is a ceiling. **Measured: a binding renewed 162.0 days ago now
  scores freshness 0.9025 and 45.13 cents against the adapter's 50; one renewed this morning
  0.99999 and 50.00. Before this change both were 50.00.**
- **One live verified address per human, enforced on chain.** `verify` reverts
  `VerificationAlreadyActive()` when the proof's nullifier already maps to a *different* address
  whose verification has not expired. P1's fleet policy can rely on that rather than infer it.
- **An entry means a real proof, and the chain will demonstrate it on demand.** Simulating
  `verify` with an invented merkle root reverts `NonExistentRoot()` (`0xddae3b71`, the root-history
  check); with the group's current `latestRoot()` it advances to `ProofInvalid()` (`0x7fcdd1f4`,
  the Groth16 pairing). **Identical from a stranger, from the relayer that submits real
  verifications, and from the contract's owner** — so the gate is the proof, not the caller. Six
  calls, asserted every run. Corroborated by the trace of a real verification: AddressBook → shim →
  WorldIDRouter → RouterImplV1 → group-1 identity manager → Groth16 verifier → bn256 precompiles.
- **The 2026-01 router swap was checked rather than assumed.** The new router
  (`0xB012Bc9D…65Caa`) is unverified, so it was read from its bytecode: 1,337 bytes, no EIP-1967
  slot, and `PUSH32` constants naming the canonical `WorldIDRouter` and the AddressBook itself. It
  is a shim in front of the canonical router, not a replacement for it, and `groupId` is still 1.
- **Why the other two tiers are unreadable, with measurements rather than an assertion.** World ID
  4.0 verification writes no state — `WorldIDVerifier` is a `view` function taking a proof and its
  proxy has received **2 transactions in its life** — and `CredentialSchemaIssuerRegistry` is keyed
  by `uint64` issuer schema id with **no address anywhere in its read surface**: it registers who
  may *issue* schema 9303, not who *holds* one. Both address-keyed World Chain registries report
  `groupId() == 1`, the Orb. Reading either tier needs the Developer Portal and a registered
  `rp_id`. Both ontology entries now carry a `no permissionless read` note naming the evidence, and
  a test asserts they keep carrying it.
- **Also fixed:** `scripts/deploy.mjs` erased the human-written `note` from
  `deployments/sepolia.json` on every re-seed — the only place the *reason* for a revision is
  written down. It is preserved now, and a no-op re-seed leaves the file byte-identical.
- New write-up `research/protocols/world-id-onchain-read.md` (addresses, the two config events, the
  revert experiment, the rate table, and §5's evidence that the other tiers cannot be read).
  `ontology-coverage.md` §6 item 5 resolved *in the opposite direction to the one it assumed* and
  its three World roster rows re-sourced; `INDEX.md` lists the fifth implementation write-up;
  README updated (World section, the stale "6 of 30 adapters" line corrected to 9 of 30, test
  counts, contract table). `docs/scoring.md` now states once what four adapters were each saying
  separately: **a hard expiry truncates a decay curve**, with the four floors (Passport 0.71,
  Holonym 0.71, World 0.90, Linea 0.50) — iteration 6's next-step 2, closed.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 172 # pass 170 # fail 0 # skipped 2` (was 150/148/0/2:
  +12 World unit, +10 World live). The 2 skips are iteration 6's Verax subgraph HTTP 429s, still
  unresolved and not touched by this change. Per file: 34 scoring, 18 reconcile, 5 input,
  10 ontology, 10 holonym unit, 19 linea-poh unit, **12 world unit**, 15 live, 6 passport-live,
  8 farcaster-live, 7 holonym-live, 18 linea-poh-live, **10 world-live**.
- `node --test --experimental-strip-types src/adapters/world.live.test.ts` → **10/10, `skipped 0`,
  three consecutive runs**.
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- `node scripts/deploy.mjs --seed-only` → `30 already identical on-chain`, registry
  `0x977b028b…aa07` unchanged at **30 adapters, revision 34**, and `deployments/sepolia.json`
  byte-identical afterwards (which is the `note`-preservation fix proving itself).
- End to end through `resolvePersonhood()`: a subject sampled from the address book scores
  **1.7076** / 50.00 cents / one root with `issuance-date-is-latest-renewal`; four subjects
  sampled from 150–162-day-old cohorts score 45.13–45.46 cents where yesterday they would have
  scored 50.00.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is **"the date the probe derives is the block the verification
  was mined in"**: it samples `AccountVerified` logs at head *and* 20M blocks back, requires
  `verifiedUntil − verificationLength()` to equal the block header's timestamp for each, and then
  requires the probe — which reads only the mapping — to land on the same second. Three parts of
  the chain (log index, block header, mapping) where the probe consults one. Beside it: the proof
  gate experiment above, the initialisation-event tripwire, the lapsed-entry test asserting a
  nonzero mapping value with `held: false`, and the decay-floor invariant.

**No registry write, on purpose.** Root, evidence class, curve, half-life and both costs are
unchanged — only `notes`, which is an off-chain field — so a reseed would bump `revision` to record
nothing, which is what iteration 2's incremental seeding exists to prevent.

**Next, in the order I would do it:**

1. **Proof of Humanity v1** — the last item in §6's passively-readable queue, and a cheap one: a
   second `isRegistered` call on a registry family we already talk to, which exercises saturation
   against v2 with real data. After that the queue is empty and every remaining ontology entry is
   documented as *not* passively readable, so the next marginal probe is worth less than P1's
   as-of scoring or the ENS agent track.
2. **P1 fleet policy now has a chain-enforced primitive to build on.** `WorldIDAddressBook` allows
   at most one live verified address per human, and `nullifierHashes(nullifier) → address` is
   public. A counterparty policy of "at most N agents per human" can therefore be *checked* against
   World rather than asserted, which is the difference between a product and an illustration.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's note 1,
   unchanged through six iterations now).

**Measured while working, worth keeping:** World Chain runs at exactly 2.0 s/block over the
address book's whole life (30,114,786 blocks in 60,229,662 s), which is what makes 100-block
`eth_getLogs` windows — the cap on the keyless endpoint — a usable sampler: one window is ~200
seconds of traffic and holds dozens of verifications. The endpoint serves those windows at any
height, so historical sampling needs no archive vendor. `worldchain-mainnet.gateway.tenderly.co`
serves wide log ranges keylessly and was used for the config-history scan; it silently *truncates*
oversized results rather than erroring (a 500k-block query returned fewer logs than a 10k-block
one), so anything counted through it must be chunked, and this file records that because the next
person to count something on World Chain will hit it.

**Blocked:** nothing. Two measurements I could not close honestly and wrote down as open questions
rather than guessing: **how many distinct humans hold a live World binding** (the contract has
emitted on the order of 10⁷ `AccountVerified` events and deduping them needs an archive log scan
no keyless endpoint will serve — the rate table is a sample and says so), and **what selector
`0xad94e556` is** on the router shim (not in the AddressBook's verified ABI, unknown to both 4byte
and OpenChain; the revert experiment pins the shim's behaviour either way). Iteration 1's two
notes still stand and are Hugo's calls, not blockers: `./test.sh` lives at `apps/demo/test.sh`
rather than the repo root where `MISSION.md` says to run it, and `pnpm-lock.yaml` is still
untracked beside a tracked `package-lock.json`.

## Iteration 8 — 2026-07-25

**Did:** §6 item 6 of `ontology-coverage.md` — **Proof of Humanity v1**, read from the original
registry on Ethereum mainnet. Ten adapters implemented now, up from nine, and **the
permissionlessly-readable queue is empty**: every remaining ontology entry is documented as gated,
off-chain or dead.

The queue called this "a second `isRegistered` call on a registry we already talk to". It is. The
two things around that call are what mattered.

- **The flag outlives the credential.** `isRegistered` is
  `registered && now - submissionTime <= submissionDuration`, and `submission.registered` — the
  fourth field `getSubmissionInfo` hands you, i.e. the obvious thing to read — is **never cleared
  on expiry**. Only a governor removal or a lost revocation clears it. **33 of 215** addresses
  sampled from the registry's recent request history have it set with the credential long dead.
  The comparison was checked against history rather than trusted: for one submission the registry
  answers **true at block 19,046,504** (timestamp 1,705,734,779, eleven seconds before its term ran
  out) and **false at 19,046,505** (one second after), with **zero logs** from the registry across
  the boundary. Nothing was written. The credential died of arithmetic, and that is the acceptance
  test — run against a freshly sampled lapsed submission every time the suite runs.
- **PoH v2 retires v1 registrations that v1 goes on honouring.** v2 cannot write to the frozen
  contract, so it keeps an overlay: `ForkModule` (`0x068a27Db…9cCB`, initialised 2024-09-05) with
  `mapping(address => bool) removed`, set by `tryRemove` on migration into v2 and by `remove` on
  revocation, a lost revocation request or a bad-vouching penalty. **9 of 20,682 are set**, and
  bisecting the flag over history shows the windows they opened: `0x6687c671…8dd6` was retired
  2024-09-06 and its v1 term did not run out until 2026-01-29 — **510 days** in which v1 said
  registered and the protocol that governs it said otherwise. So `held` is
  `v1.isRegistered && !forkModule.removed`.
- **Not `ForkModule.isRegistered`, and this one would have been silent.** The module's own getter
  adds `submissionTime < forkTime`, which is v2's *migration policy* rather than a statement about
  the v1 credential. Both registrations alive today were made **after** the fork, so that getter is
  false for the entire live population: an adapter built on it answers "not registered" for
  everybody while the contract responds, the ABI matches and nothing errors. Same failure mode as
  iteration 6's dead Linea portal, arrived at from the opposite direction.
- **The population is the finding: 2 registered addresses out of 20,740 lifetime submissions**
  (block 25,610,404). Enumerated from the registry's whole event history — 22,038 `AddSubmission`
  over 20,677 distinct addresses, 239 `ReapplySubmission` over 227, 20,682 in union — plus one
  `isRegistered` each. Both survivors expire in late 2026 (2026-09-07 and 2026-11-16). PoH v2
  mainnet has `getHumanityCount()` = 55 and the v1→v2 migration moved **9** registrations; 20,740
  lifetime submissions did not become a v2 population, they lapsed. `live: true` here means the
  contract works, not that the protocol has users, and the ontology note now says exactly that.
- **A bounded scan would have got that number wrong, and nearly did.** The tempting shortcut is
  "a live registration was accepted within the term, so scan the term plus slack". `executeRequest`
  writes `submissionTime` and **emits nothing** — neither does the `processVouches` it delegates to
  — and anyone may call it at any time after the challenge period. `0xb2db7c3b…67e7`, one of the
  two survivors with exactly **one** request in its life, emitted `AddSubmission` on **2022-09-25**
  and was accepted on **2024-10-25**: **761 days**. My first live test used a term+180-day window
  and reported a population of 1 while looking exhaustive. The window is gone; the gap is now its
  own live test, because it is the reason the method is what it is.
- **A second invisible cohort, already harmless.** `submissionCounter` (20,740) exceeds the distinct
  `AddSubmission` emitters (20,677) by **63**, constant from 2021 onward. `addSubmissionManually`
  increments the counter and emits no `AddSubmission` — the governor used it on **2021-03-12**
  (counter 59 → 63 between blocks 12,023,878 and 12,023,879). Those 63 are dated 2021 and expired
  under either term, and any that renewed would have emitted `ReapplySubmission`, so the figure
  stands. Same shape as iteration 4's Farcaster import.
- **A hard term truncates a `Ramp` too.** `docs/scoring.md` records the decay version across four
  adapters. PoH v1 is the ramp version: a registration is at most 730.5 days old before it stops
  being one, so on a 365-day ramp its weight can never exceed `1 − 2^(−730.5/365)` = **0.7500**.
  The live suite asserts it against whoever is registered on the day it runs.
- **`submissionDuration` has moved** — 31,557,600 s (365.25 d) at the registry's first submission in
  2021-03, 63,115,200 s (730.5 d) today — so the probe never recomputes the comparison. It calls
  `isRegistered`, lets the contract apply whatever term is current, and reads the term only to
  report the expiry.
- **Failure policy is asymmetric on purpose.** Losing `isRegistered` or `getSubmissionInfo` is an
  error, because a network failure must never read as "not a human". Losing `submissionDuration`
  costs the reported expiry and nothing else. Losing the **ForkModule** read while v1 says
  registered is *also* an error: the alternative is publishing a positive we cannot confirm has not
  been retired, and an unreadable credential is a truer answer than either.
- Verified source for both contracts came from **Sourcify**, fetched today, not recalled. Worth
  noting because the bytecode `PUSH4` scan this repo has leaned on **under-reports**: it missed
  `challengePeriodDuration()` (`0x0082a36d`), which answers 302,400. `submissionList(uint256)`
  really is absent, confirmed by `eth_call` reverting rather than by the scan.
- New write-up `research/protocols/poh-v1-onchain-read.md` (addresses, the ForkModule's two removal
  paths, the boundary proof, the enumeration and its two invisible cohorts, the mainnet endpoint
  table). `ontology-coverage.md` §6 item 6 struck through, its roster row flipped to `impl ✔`, its
  `social-vouching:poh` row annotated, and a line added saying the queue is now empty; `INDEX.md`
  lists the sixth implementation write-up; README updated (nine adapters → ten, new section, test
  counts, "coverage is 9 of 30" → 10 of 30 with the queue-empty note). `reconcile.ts`'s comment on
  `date-from-latest-reattestation` generalised: it is a ceiling under `Decay` and a floor under
  `Ramp`, and PoH v1 is the first user of the second case.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 195 # pass 193 # fail 0 # skipped 2` (was
  172/170/0/2: +13 PoH v1 unit, +10 PoH v1 live). The 2 skips are iteration 6's Verax subgraph
  HTTP 429s, unchanged and untouched by this work.
- `node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts` → **10/10, `skipped 0`**,
  32 s.
- `npm run build` clean; `node_modules/.bin/tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `10 passed`.
- End to end through `resolvePersonhood()`: `0x8C01046e…2Fa0`, the surviving registration, scores
  **2.5626** / 364.22 cents / one root, freshness 0.7284, `heldFrom: chain`, `dateFrom: chain`, with
  `detail` reporting 44.1 days to expiry and `recognisedByPohV2: false`.
- The acceptance test the mission asks for ("a live test that hits the real chain and asserts the
  mechanism, not a magic number") is **"the credential dies of arithmetic, and the chain shows the
  exact second"** — described above. Beside it: the date checked by bisecting historical state for
  the block `submissionTime` was written in and requiring that block's header to carry exactly that
  timestamp (state history and block header agreeing, where the probe consults only the current
  value of the first); the 761-day request-to-acceptance gap; the ForkModule's wiring to both
  contracts and its term snapshot still equalling v1's; the retired fixture; and a scorer-level
  check that poh-v1 and poh-v2 evidence collapses to one root with
  `correlated-evidence-saturated` and buys no extra cost.

**No registry write, on purpose.** Root, evidence class, curve, half-life and both costs are
unchanged — only `implemented` and `notes`, which are off-chain fields — so a reseed would bump
`revision` to record nothing, which is what iteration 2's incremental seeding exists to prevent.
Registry stays at **30 adapters, revision 34**.

**Committed:** `f6b69a9` feat(sdk): read Proof of Humanity v1, where the flag outlives the credential

**Next, in the order I would do it:**

1. **The probe queue is empty, so the next marginal work is P1, not another adapter.** The two
   candidates, in the order I would take them: **as-of scoring** (`resolve(addr, { asOf: block })`)
   — the registry audit-trail subgraph on `:8100` already exists, it makes the audit trail
   executable rather than decorative, and it is the strongest Graph claim available; and **P1's
   fleet policy**, which iteration 7 handed a chain-enforced primitive (`WorldIDAddressBook` allows
   at most one live verified address per human, and `nullifierHashes(nullifier) → address` is
   public).
2. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still the
   cheapest way to turn two flagged approximations into real dates (iteration 1's next-step 1,
   unchanged through seven iterations now, which is itself a signal that nobody thinks it is worth
   the resync time before the deadline).
3. **PoH v1 will empty in November.** Both survivors expire (2026-09-07, 2026-11-16) and the live
   suite is written to keep passing when they do — the population test asserts agreement with the
   contract rather than a count, and the `submissionCounter` check is a monotone invariant with a
   diagnostic rather than an equality. But the *numbers in the README, the ontology note and the
   write-up* will go stale, and nothing fails when they do. If this repo is still alive in
   December, re-measure them.

**Measured while working, worth keeping:** keyless Ethereum mainnet is a *worse* environment than
OP or World Chain for this class of probe, and the table in the write-up's §6 is there so nobody
re-derives it. Only three endpoints serve archive `eth_call` *and* wide `eth_getLogs`
(`gateway.tenderly.co/public/mainnet`, `mainnet.gateway.tenderly.co`, `rpc.mevblocker.io`);
`ethereum-rpc.publicnode.com` answers at head and refuses anything historical with "Archive
requests require a personal token"; `eth-mainnet.public.blastapi.io` caps `eth_getLogs` at **10
blocks**; `cloudflare-eth.com` refuses outright. And log *volume* is the real cost, not block
range: an unfiltered 250,000-block query over the registry's 2021–2022 era returns 4,564 logs and
takes **76 seconds**, which is what made the first version of the live suite take five minutes.
Filtering by topic at the node took the same suite to 32 seconds.

**Blocked:** nothing. Two open questions written into the write-up's §8 rather than guessed:
**when `changeDurations` fired** (the term doubled somewhere between 2021-03 and today; it affects
no answer, because the probe never applies a term itself) and **who the 63 governor-seeded
submissions are** (recoverable from that day's calldata; it cannot move the population figure,
but it would make the enumeration exhaustive rather than exhaustive-modulo-an-argument).
Iteration 1's two notes still stand and are Hugo's calls, not blockers: `./test.sh` lives at
`apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it, and
`pnpm-lock.yaml` is still untracked beside a tracked `package-lock.json`.

## Iteration 9 — 2026-07-25

**Did:** P1 — **as-of scoring**, `resolve(addr, { asOf: block })`. The probe queue emptied at
iteration 8, and this was the next item: the registry audit trail existed but could only be
*printed*, never applied.

The weights are dated human judgements and they change — revision 34 alone moved three trust
roots, retired a placeholder root and added fifteen adapters. Every such edit silently rewrites
history for anyone holding an old score: a subject told "2.56 on Tuesday" cannot reproduce it on
Wednesday, and a counterparty who denied somebody at a threshold cannot show what the ontology
said when they did. Now they can.

- **This is the one read here an archive node cannot serve, which is why it is the strongest
  Graph claim available.** Reconstructing an entity *set* at block N from the chain means one
  `eth_call` per adapter and already knowing every adapter id. Graph Node stores each mutable
  entity version with the block range it was current for, so `adapters(block: {number: N})` is
  one query. Measured: 15 adapters at block 11,345,000, 30 at head, from the same endpoint.
- **It never degrades — deliberately, and against the grain of everything else in this SDK.**
  Every other read falls back: an unreachable index becomes a caveat, a failed probe becomes an
  excluded error. `asOf` without `registrySubgraphUrl` throws, and an indexer behind the
  requested block throws naming how far it got. Answering a question about the past with today's
  weights and stamping a block number on it is a worse failure than no answer.
- **Credentials are read at head, and the result says which half is reconstructed.** There is no
  cross-chain archive path that would let ten adapters answer as of a Sepolia block. What is
  fixed exactly is the direction that would pay an adversary: a credential dated after the as-of
  instant did not exist then and is excluded (`issuedAfter` counts too — it is a proven lower
  bound on issuance). What remains — held then, revoked since — understates the subject and never
  the adversary. Undated credentials are counted and listed in `asOf.existenceUnverified`, since
  dropping them would penalise a subject for a field their protocol does not store.
- **The reconstruction is checked, not assumed, and the check is a proof rather than a sample.**
  `setAdapter` and `setAdapterLiveness` both bump `revision`, but only the first carries a full
  record. So if the audit trail's revisions are exactly `1..revision()` — read from the chain at
  head, no archive needed — no liveness flip has ever fired, and the reconstruction is therefore
  exact at *every* block, not just the ones the suite samples. When it fails, `auditTrailComplete`
  goes false and the missing revisions are named. Today: 34 recorded, on-chain revision 34, no
  gaps.
- **Age is evaluated at the as-of block's own timestamp**, not the wall clock and not the
  requested instant — the ontology is a step function over blocks, and pretending to a precision
  the registry does not have would make two instants inside one block look like different states
  of the world. `asOf` accepts a Sepolia block number or a `Date`/ISO string; the latter bisects
  block headers (~24 reads, no archive node, so an instant is an acceptable way to name a point).
- **A real bug in the audit trail, found by building on it.** `AdapterLivenessSet` carries only
  the hashed adapter key, and the mapping did `Adapter.load(hash.toHexString())` against entities
  keyed on the plaintext id — matching nothing, so **every liveness flip was dropped in silence**.
  It survived because it has never fired on the deployed registry, and it is the mutation a score
  feels hardest: `live: false` zeroes a credential outright. Fixed with an `AdapterKey` reverse
  index (written on the one event carrying both halves) plus a `LivenessChange` audit entity
  carrying the curator's stated reason. **Redeployed to the self-hosted node as v0.0.3**
  (`QmU8UDtsTRsaRZ9u74bFQ7r3tidpXcUGS9157CffPd4Yfg`, was `QmRhvuGcRUYGdvSrPA5iNobdnHfhSNZPz4o7BEpcFf85y2`).
  The handler body itself has never been exercised by a real event — none exists — so what is
  asserted is the thing that was actually wrong: all 30 `AdapterKey` entries equal
  `keccak256("adapter:" ++ id)`, the key a liveness event will carry.
- **Retired root names are now recorded** in `ontology/adapters.json` under `retiredTrustRoots`:
  `unknown` (never a root — an admission of research debt that scores as full independence) and
  `kyc-vendor:facetec-synaps` (widened to `kyc-vendor:facetec` at revision 34). Without their
  preimages, a historical score prints raw hashes for exactly the roots whose correction is the
  interesting part of the history. An unrecognised hash still stays a hash rather than collapsing
  to a placeholder, because a placeholder would merge distinct roots and saturate credentials
  that were independent.
- MCP's `lookup_personhood` takes `as_of` (a block number or an ISO date) and the rendering says
  which block the ontology came from. Deliberately not wrapped in a try: the tool inherits the
  refusal rather than softening it.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 228 # pass 226 # fail 0 # skipped 2` (was
  195/193/0/2: +20 as-of unit, +12 as-of live, +1 ontology). The 2 skips are iteration 6's Verax
  subgraph HTTP 429s, unchanged and untouched by this work.
- `node --test --experimental-strip-types src/as-of.live.test.ts` → **12/12, `skipped 0`, three
  consecutive runs**, 2.7 s.
- `npm run build` clean; `tsc --noEmit` clean for `src` and, checked separately with the project's
  own flags, for both new test files (they are excluded from `tsconfig.json`); the MCP package
  typechecks.
- `cd apps/demo && npx playwright test` → `10 passed`.
- `node scripts/deploy.mjs --seed-only` → `30 already identical on-chain`, `deployments/sepolia.json`
  byte-identical. Registry stays at **30 adapters, revision 34**.
- End to end through `resolve()` on a subject holding PoH v2 plus two Holonym credentials and a
  Human Passport: **3.61 / $40.73 / 4 roots / revision 34** today against **1.0689 / $0.11 /
  1 root / revision 15** as of block 11,345,000. Nothing about the subject moved; Holonym and
  Passport are named in `adaptersNotYetInRegistry`. The PoH contribution differs by half a cent
  (11.19c vs 10.72c) because the survival ramp was evaluated twelve hours earlier — the as-of
  instant doing work rather than decorating.
- The acceptance test `MISSION.md` asks for — *"a score changes when the historical registry
  revision differs from the current one"* — exists in two forms. **Live:** one surviving Proof of
  Humanity v1 registration, on a contract frozen since 2021, scores **$3.51 under revision 34 and
  exactly nothing under revision 15**, because that is when we had not researched the protocol
  yet. **Deterministic:** the real Civic-Pass root correction in miniature — two adapters that
  were independent at revision 15 and saturate to one at revision 34, same evidence, lower score.
  Beside them the reconstruction is asserted against the chain rather than against itself: the
  ontology the indexer reports at head must equal `allAdapters()` **field by field for all 30
  adapters**, every revision the registry counted must appear in the audit trail, and a block
  before the registry existed or beyond the indexer's head must be an error rather than an empty
  ontology (an empty ontology scores everybody at zero while looking like it worked — the same
  failure shape as iteration 6's dead Linea portal).

**Committed:** `f6f52d8` feat(sdk): as-of scoring — the audit trail applied, not printed

**Next, in the order I would do it:**

1. **P1's fleet policy**, which is now the strongest remaining item and has had a chain-enforced
   primitive waiting since iteration 7: `WorldIDAddressBook` allows at most one live verified
   address per human, and `nullifierHashes(nullifier) → address` is public. "At most N agents per
   human" can be *checked* against World rather than asserted, which is the difference between a
   product and an illustration.
2. **P1's ENS agent track** — `corroborate.human` on an agent's name, the counterparty resolving
   it and checking the backing human's personhood, a second agent under the same tree refused
   because it is the same human. `corroborate.subjects` already works for humans; the record is
   self-asserted and the caveat must keep saying so. Blocked on Hugo registering a mainnet name
   (`MORNING.md` item 2, open since before iteration 1).
3. **Base EAS subgraph**, replacing the `easscan.org` GraphQL dependency in
   `coinbaseVerificationAdapter` — the last vendor on the critical path, and the last place the
   repo contradicts its own stated principle.
4. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's next-step 1,
   unchanged through eight iterations now).

**Measured while working, worth keeping:** the graph-node on this box exposes its admin JSON-RPC
on `127.0.0.1:8120` and its IPFS API on the docker bridge at `172.19.0.2:5001` — neither is on a
published port, and `docker` is not usable from this user, so the way to redeploy a subgraph here
is `npx graph deploy <name> --node http://127.0.0.1:8120 --ipfs http://172.19.0.2:5001`. The
Sepolia range is ~4,300 blocks, so a full resync completes in seconds and the name endpoint
switches to the new deployment without a visible gap. Recorded because the next iteration that
needs a subgraph change will otherwise conclude, as I first did, that deployment is impossible
here. Separately: `_meta` must be queried *unpinned* before a block-pinned query, because
graph-node fails the whole request when the pin is beyond its head, and the useful error ("we
only indexed to X") is otherwise unavailable.

**Blocked:** nothing. One thing left deliberately undone: the ontology's own history is only
~15 hours long, so as-of over it demonstrates *ontology* change convincingly and *credential*
change not at all — 14 hours of chain history is indistinguishable from now. That is a property
of the dataset rather than of the design, and it is why the credential half is a documented
exclusion plus a caveat rather than a second reconstruction. Iteration 1's two notes still stand
and are Hugo's calls, not blockers: `./test.sh` lives at `apps/demo/test.sh` rather than the repo
root where `MISSION.md` says to run it, and `pnpm-lock.yaml` is still untracked beside a tracked
`package-lock.json`. New and minor: `subgraph-registry/package-lock.json` moved because installing
graph-cli resolved a floating `@types/node` range from 12.20.55 to 26.1.1; kept, since it is the
tree that built and deployed v0.0.3.

## Iteration 10 — 2026-07-25

**Did:** P1 — **World fleet policy**. The mission asked to turn fleet detection into a real
policy engine, and named the failure it wanted fixed: *"ten agents behind one human collapsing
to one allowed reads as a product; three hard-coded agents reads as an illustration."* Both
halves are now live, and the number is twenty-seven rather than ten.

- **The counterparty declares limits as data; the SDK enforces them.** New
  `packages/sdk/src/fleet.ts`: `FleetPolicy` (`minScore`, `minIndependentRoots`,
  `maxAgentsPerHuman`, `unbackedAgents`, `admission`) and `evaluateFleet()`, a pure function
  over (what the registries said) × (the policy) with no I/O, so every branch is unit testable.
  `apps/agent/src/counterparty/policy.js` is now that object and nothing else — the demo's gate 4
  *is* the function the SDK's tests exercise, rather than a re-implementation of it.
- **Enforcement is an allocation, not a boolean.** A fleet of 27 collapses to N admitted and
  27−N refused, and each refusal names the sibling holding the slot. Three properties the engine
  holds to, each with its own test: **a denied agent never spends its human's slot** (the score
  gates run before the allocation, or an agent that was going to be refused anyway burns a
  passing sibling's allowance for free); **an unreadable registry is `indeterminate`, never a
  denial and never an admission**; and **an unbacked agent is a declared choice** — it has no
  human identifier, so the cap cannot bind it, and `count-as-distinct-human` hands an operator
  one slot per free keypair, which the caveat says out loud.
- **Evidence is keyed on the human, not the agent** — the input type makes the other shape
  inexpressible. Credentials belong to the person, so two agents of one human cannot present two
  address sets and be scored twice, and a 27-agent fleet costs one lookup instead of 270 probes.
- **New `packages/sdk/src/agentbook.ts` — AgentBook read as a fleet index.** There is no reverse
  index (a `PUSH4` scan finds 17 selectors; the reads are `lookupHuman`, `getNextNonce`,
  `groupId`, `worldIdRouter` and Ownable2Step), same shape as Verax on Linea. It does not need
  one: the registry is **1,164 registrations** since 2026-03-13 in 1,164 transactions, read whole
  in **six `eth_getLogs` calls, ~5 s**. `register` is the only writer and it emits; there is no
  admin write path and no deregistration selector, so the log reconstructs the mapping exactly —
  asserted against *state* for 60 sampled agents every run, not assumed.
- **The finding: 1,164 agents over 830 humans, and one human runs 27 of them**, all registered
  inside 0.7 days. 131 humans run more than one. A venue counting requesters over-counts its
  counterparties by **1.40× on average and 27× at the tail**. Full histogram and the fleet-shape
  table (afternoon fleets vs fleets accumulated over months) in the write-up.
- **`humanId` is the registering proof's nullifier hash, read from the chain rather than from a
  doc**: in tx `0xc19650a0…a0cfe` `register`'s fourth argument equals the event's second topic.
  That is what makes the cap enforceable — a counter would make one person several humans.
- **The identifier cannot be joined to any other World registry, and that is the answer to the
  obvious question.** `AgentBookInitialized` records external nullifier `38265997…265498`;
  `WorldIDAddressBookInitialized` records `377593556…326541`. Same router, same Orb group 1, so
  the same population — but different external nullifiers, so one person is two unlinkable
  pseudonyms across the two contracts. Measured: **0 of 150** AgentBook humanIds resolve in
  `WorldIDAddressBook.nullifierHashes`. So there is no chain path from an agent to the wallets
  its operator holds credentials on: `address-set-not-authenticated` is permanent, and permanent
  because World's privacy design works rather than because we stopped early. The caveat text now
  says that.
- **The cap has a price, computed from the deployed registry.** `priceOfPolicy()` finds the
  cheapest set of credentials clearing a policy — one per trust root, since a second credential
  on a held root adds nothing — priced at `min(forge, rent)` and full freshness, and restricted
  to adapters we can actually *read*, because an adversary cannot clear our score with a
  credential we never look up. Under Meridian's line (2.5 over 2 roots, plus the Orb root every
  AgentBook registration implies) a slot costs **550 cents: poh-v2 at $5 rent + world-id-orb at
  50c**. So 27 slots cost **$148.50** with the cap and **$5.50** without it. A unit test
  re-derives the minimum by brute force over every subset of candidate roots, so "cheapest" is a
  claim rather than a label.
- **Two real defects found by building this, one of them mine.**
  1. **A silent key-encoding mismatch.** The demo's AgentBook module returned `humanId` as hex
     (`toHex`) while the index groups on the decimal string the event carries. The evidence map
     matched nothing and *every* agent came back `indeterminate` — nobody was refused, so nothing
     looked wrong. Fixed at the source (decimal, with a comment saying why a shared map key may
     not have two encodings), and `evaluateFleet` now emits `fleet-evidence-keys-unmatched`
     naming the unmatched identifiers when agents go unjudged while evidence exists for humans
     not in the batch. Both directions have tests.
  2. **A public endpoint that lies.** `worldchain.drpc.org` answers `eth_getLogs` with HTTP 200
     and `[]` for ranges that provably hold 39 registrations — four times out of four, against
     tenderly's 39 every time. Configured briefly as a fallback, it produced a **7-registration**
     index of a 1,165-registration registry and raised nothing. That is worse than the silent
     truncation iteration 7 measured, because it is permissive in the direction that matters: an
     empty fleet index makes every human look like they run one agent. It is out of the endpoint
     list, and every endpoint must now clear a **canary** — one call for block 27,100,652, which
     has held the registry's first registration since March — before its history is used. Caught
     because the live test re-scans at a second chunk size and demands set equality; it failed
     intermittently and the intermittency was the fallback engaging.
- **The demo now has a fourth run, and nothing in it is hard-coded.** `npm start`: run 2 is the
  human's *earlier* registration and is admitted (the chain decides which, not the demo); run 3
  is its sibling, refused by name; run 4 scans the whole registry, takes the largest fleet it
  finds, and refuses a member of it — **1 of 27 admitted** — printing what the fleet would cost
  an adversary. The demo's declared operator set gained a third address
  (`0xA6b7471f…67b1`, the Holonym + Human Passport subject iterations 3 and 5 read) because the
  original two are both fresh survival-ramp credentials scoring 1.57, below Meridian's line — so
  every run refused on the *score* and no run reached the fleet gate at all. `fixtures.js` says
  that out loud, including that it is live data and will move when those credentials expire.
- New write-up `research/protocols/world-agentbook-fleets.md` (selector table, the enumeration,
  the fleet histogram, the nullifier-namespace measurement, the endpoint table with drpc's
  behaviour, and what none of it establishes). `research/INDEX.md` lists it as the seventh
  implementation write-up. README updated (test counts, the fleet gate in the apps section);
  `apps/agent/README.md`'s gate diagram, run table and file map rewritten for four gates.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 276 # pass 274 # fail 0 # skipped 2` (was
  228/226/0/2 at iteration 9; the difference is +30 fleet unit, +12 AgentBook live, and the
  6 `enroll.test.ts` tests that arrived with the laptop's `7b47e9e` routing commit, which this
  tree is rebased on). The 2 skips are iteration 6's Verax subgraph HTTP 429s, unchanged and
  untouched. Per file — unit: 34 scoring, 18 reconcile, 5 input, 11 ontology, 6 enroll,
  10 holonym, 19 linea-poh, 12 world, 13 poh-v1, 20 as-of, **30 fleet**; live: 15 live,
  6 passport, 8 farcaster, 7 holonym, 18 linea-poh, 10 world, 10 poh-v1, 12 as-of,
  **12 agentbook**.
- `node --test --experimental-strip-types src/agentbook.live.test.ts` → **12/12, `skipped 0`,
  three consecutive runs** after the drpc fix (it was 10/12 on two runs out of five before it).
- `npm run build` clean; `tsc -p tsconfig.json --noEmit` clean.
- `cd apps/demo && npx playwright test` → `13 passed` (13 now, not 10 — the landing agent added
  three; untouched by this work).
- `cd apps/agent && npm start` end to end: run 1 DENY (unregistered), run 2 **ALLOW** (score
  3.6153 across 5 roots, slot 1 of 1), run 3 **DENY** naming
  `0x30b8cc07…fbe5` as the holder of the slot, run 4 **DENY** with `admitted 1 of 27` and the
  $5.50/$148.50 price line.
- The acceptance the mission asks for — *"ten agents behind one human collapsing to one allowed
  reads as a product"* — is run 4 plus two tests. **Live:** the largest fleet in AgentBook is
  found by scanning, every member is confirmed against state to carry the identical humanId, the
  policy admits exactly one, and the slot goes to the earliest registration the *chain* names.
  **Unit:** 27 agents behind one human admit 1 and refuse 26 with each refusal naming the holder;
  the same fleet under `maxAgentsPerHuman: 3` admits exactly 3, because the cap is a number
  rather than a boolean.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — the fleet
engine reads the ontology and never edits it — so a reseed would bump `revision` to record
nothing. Registry stays at **30 adapters, revision 34**.

**Committed:** `15d1e4b` feat(sdk): fleet policy — the cap is per human, and the registry says who

**Next, in the order I would do it:**

1. **AgentBook registrations now have a date, and `world-id-orb` still does not use it.**
   Iteration 7 fixed the AddressBook half (`verifiedUntil − verificationLength` is the exact
   verification second) but left the AgentBook half undated, and an undated credential on a
   `Decay` curve scores at freshness 1 — full weight, forever. The index built this iteration
   has the block every registration was mined in, so the fix is now cheap: date an
   AgentBook-sourced World credential from its `AgentRegistered` block. It is visible in run 4's
   gate 3 today (`issuance-date-unknown` for `world-id-orb` at the full 50c). Small in
   magnitude — World Orb's half-life is 1,095 days, so a four-month-old registration loses ~7% —
   but it is the same defect shape iteration 7 called a scoring bug, and it is the last undated
   credential in the roster.
2. **Base EAS subgraph**, replacing the `easscan.org` GraphQL dependency in
   `coinbaseVerificationAdapter` — the last vendor on the critical path, and the last place the
   repo contradicts its own stated principle.
3. **P1's ENS agent track** — `corroborate.human` on an agent's name, the counterparty resolving
   it and checking the backing human's personhood, a second agent under the same tree refused
   because it is the same human. The refusal half now exists as a policy engine and would only
   need the ENS name tree; still blocked on Hugo registering a mainnet name (`MORNING.md` item 2).
4. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's next-step
   1, unchanged through nine iterations now).

**Measured while working, worth keeping:** 79 of the 1,164 AgentBook agent wallets carry a *live*
World ID Address Book verification of their own and one a lapsed one — so a small minority of
"agent" wallets are also somebody's verified human address. No AgentBook human's fleet contains
two live AddressBook-verified wallets, which is what the AddressBook's one-live-address-per-human
rule predicts and is worth knowing before anyone tries to cluster fleets that way. And the
World Chain log-endpoint situation is now a table in the write-up's §6: exactly one keyless
endpoint serves wide `eth_getLogs` correctly, two refuse loudly (100 and 1,000 blocks), and one
answers wrongly.

**Blocked:** nothing. Two things left deliberately undone and written down rather than guessed:
**who the 27-agent operator is** (the wallets were not clustered by funder, because the policy
does not need it and a guess would be an accusation) and **what `getNextNonce` implies about
delegated registration** (`register` takes a nonce and the sampled call passed 0; if
registrations can be relayed, the transaction sender is not the operator — which changes nothing
we score, since the identifier comes from the proof, but it would change anyone's attempt to
cluster fleets by funder). Iteration 1's two notes still stand and are Hugo's calls, not
blockers: `./test.sh` lives at `apps/demo/test.sh` rather than the repo root where `MISSION.md`
says to run it, and `pnpm-lock.yaml` is still untracked beside a tracked `package-lock.json`.

## Iteration 11 — 2026-07-25

**Did:** P1 — **ENS as the carrier of agent identity**, the one remaining mission item that
every iteration since 1 has recorded as *blocked on Hugo registering a mainnet name*. It was
not blocked, and the block was the interesting part.

- **Sepolia `.eth` registration is free and instant today.** Iteration 0's inherited verdict
  (`b33e5d6`: "the artifact controller is deployed but `controllers()` = false on the canonical
  registrar, no `NameRegistered` events in recent history, the deployment is mid-migration") was
  drawn from the wrong contract and a wrong event topic. Read from the chain instead:
  `owner(namehash("eth"))` → `0x57f1…eA85`, the canonical BaseRegistrar;
  `keccak256("NameRegistered(uint256,address,uint256)")` is **`0xb3d98796…70d9`**, and there
  were **13 registrations in the last 10,000 blocks**; every one went to `0xdF60…7078`, for
  which `controllers()` returns true; Sourcify has that address verified, **exact match**, as
  `TestnetV1PremigrationRegistrar` — *"free testnet-only v1 registration controller that
  immediately reserves names in ENSv2"*. No commit/reveal, no price oracle, `_refund()` returns
  any ETH you send. ≥3 characters, ≥28 days. The migration made Sepolia *easier*, not harder.
  `corroborate.eth` is now ours on Sepolia until 2027-07-25, with three agent subnames.
- **The records, and why the second one is the whole increment.** An agent's name publishes
  `corroborate.human`; the human's name publishes `corroborate.agents` back, beside the
  `corroborate.subjects` record that already existed. `packages/sdk/src/ens-agents.ts` resolves
  a name into an agent wallet, the human behind it, that human's declared address set, the
  strength of the binding and the tree it sits in — public infrastructure only, no API key.
- **The finding: a self-published binding makes iteration 10's per-human cap free to evade.**
  `maxAgentsPerHuman` groups agents by the human they *name*. AgentBook's identifier is a
  nullifier hash and cannot be minted; an ENS record is whatever the agent wrote there, and
  addresses are free — so an operator names a fresh wallet per agent, every agent is its own
  human, and **the cap binds nothing while every individual answer stays true**. Nothing looks
  wrong: nobody is refused and no rule reports a failure. The live tree runs the attack against
  us. `unverified.corroborate.eth` names an address that is *already in `corroborate.eth`'s own
  `corroborate.subjects` list*, takes a second slot, and inherits a **3.6087** credential set
  (Holonym gov-ID + FaceTec biometrics + Human Passport) it never acquired.
- **The fix is the other direction, not more cryptography.** A binding both ends assert is
  `mutual`; the acknowledgement costs a transaction from the key controlling the human's name,
  so minting humans stops being free and each mint is *visibly* a separate human with its own
  (usually empty) credential set. `FleetPolicy` gains `requireAttestedBinding`, `HumanBacking`
  gains a `binding` strength (`attested` from a proof or a mutual record, `asserted` from one
  side), and the check runs **before** slot allocation — the same ordering rule the score gates
  follow, so an agent refused on its binding never burns a sibling's allowance. New caveat
  `fleet-cap-soft-on-asserted-bindings` fires whenever a policy admits one-way claims.
- **A name tree can be counted but never named.** `setSubnodeRecord` takes the label *hashed by
  the caller*, so the string appears in no transaction field, event or storage slot anywhere.
  `scanNameTree()` reads the registry's `NewOwner` log, which still gives an exact count, owners
  and creation blocks — so slot allocation can be `earliest-registered` with the *chain* deciding
  which sibling keeps the slot, and a counterparty can learn a tree holds agents it was not
  shown. Candidate labels are hashed and matched; the remainder is reported as unnamed subnodes.
  **Deliberately no endpoint canary**, unlike `agentbook.ts`: there an empty answer makes every
  human look like they run one agent (permissive), here it can only fail to reveal agents beyond
  those already presented, so the window is reported and the count documented as a lower bound.
- **Two defects fixed on the way, one of them pre-existing.**
  1. **One wallet, several names** — ordinary in ENS, and `evaluateFleet` keys agents by address.
     Two names for one wallet were judged twice, the trace showing only the last verdict, and a
     cap of one could refuse a wallet on account of its own second name. `toFleetAgents()` now
     collapses them into one agent, takes the earliest creation block, and lets an
     acknowledgement on *any* of the names settle the binding. Names disagreeing about *which*
     human owns the wallet produce `unknown` → `indeterminate`, because a contradiction is not a
     fact about a person.
  2. **The engine named the wrong registry in its own trace.** `human-identified` read "AgentBook
     maps this wallet to human …" for every backing, which became false the moment a second
     registry existed. Source-neutral now.
- **The registrar's atomic-records path cannot work, and the revert says nothing.** The
  registration struct carries `bytes[] data` forwarded to `multicallWithNodeCheck` — the obvious
  way to register with records already set. It reverts with no reason data. `_registerV1` calls
  `ENS_REGISTRY.setRecord(namehash, registration.owner, …)` *before* calling the resolver, and
  PublicResolver authorises on registry ownership, so the controller is no longer the owner when
  the multicall lands; `multicall` bubbles that through a bare `require`. Confirmed by
  simulating `setText` from both addresses (owner succeeds, controller reverts). Records are
  therefore written in follow-up transactions, and a missing `corroborate.human` is treated as
  "not an agent name" rather than as an error.

**Verified:** all four suites, on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd packages/sdk && npm test` → `# tests 314 # pass 314 # fail 0 # skipped 0` (was
  276/274/0/2 at iteration 10: **+24 ENS unit, +14 ENS live**, and iteration 6's two Verax
  subgraph skips answered this time rather than returning HTTP 429 — untouched by this work).
- `node --test --experimental-strip-types src/ens-agents.live.test.ts` → **14/14, `skipped 0`,
  three consecutive runs.**
- `npm run build` clean; `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/demo && npx playwright test` → `13 passed`.
- `cd apps/agent && npm start` (the World flow, which this iteration changed underneath) → run 1
  DENY, run 2 ALLOW (3.6153 over 5 roots), run 3 DENY naming the sibling, run 4 **admitted 1 of
  27** with the $5.50/$148.50 price line. Unchanged from iteration 10.
- `cd apps/agent && npm run ens` end to end: 3 subnodes enumerated from the registry log,
  3 names resolved, 2 humans scored (**3.6100 over 4 roots** and **3.6087 over 3**), then
  **2 of 3 admitted** under the policy as written and **1 of 3** with `requireAttestedBinding`.
- `node scripts/ens-agents-setup.mjs` is idempotent and re-verifies: re-running prints "already
  registered", rewrites nothing, and reads every field back before writing
  `deployments/ens-sepolia.json`.
- The acceptance `MISSION.md` asks for — *"an agent's ENS name resolving records that name the
  backing human, the counterparty resolving that name and checking the human's personhood before
  agreeing to anything, and a second agent under the same name tree being refused because it is
  the same human … end-to-end test against a real testnet name, no hard-coded values anywhere in
  the demo path"* — is `src/ens-agents.live.test.ts` plus `npm run ens`. The refusal names the
  sibling holding the slot, and the sibling that keeps it is the one the **chain** says was
  created first. The only input to either is the parent name in `deployments/ens-sepolia.json`;
  wallets, humans, acknowledgements, creation blocks, subnode counts and scores are all read at
  run time, and the live test asserts the deployment file against the chain rather than trusting
  it.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this is an
identity layer over the ontology, not an edit to it — so a reseed would bump `revision` to record
nothing. Registry stays at **30 adapters, revision 34**.

**Committed:** `d730e4a` feat(sdk): ENS carries agent identity — and the acknowledgement that makes it enforceable

**Next, in the order I would do it:**

1. **AgentBook registrations still have no date in the World probe.** Iteration 10's next-step 1,
   unchanged: `world-id-orb` sourced from AgentBook is undated, and an undated credential on a
   `Decay` curve scores at freshness 1 — full weight, forever. The index built in iteration 10
   has the block of every registration, so the fix is cheap. Visible in `npm start`'s gate 3
   today (`issuance-date-unknown` at the full 50c). Small in magnitude (~7% on a four-month-old
   registration against a 1,095-day half-life) but it is the last undated credential in the
   roster and the same defect shape iteration 7 called a scoring bug.
2. **Base EAS subgraph**, replacing the `easscan.org` GraphQL dependency in
   `coinbaseVerificationAdapter` — the last vendor on the critical path, and the last place the
   repo contradicts its own stated principle. Note the constraint measured in iteration 9: the
   self-hosted graph-node here would need a Base network added to its config, which is a
   container change this mission forbids, so this is Studio or nothing.
3. **A signature gate for the ENS path.** `agent-presenter-not-authenticated` fires on every
   batch because resolving a name does not establish that the presenter controls the wallet the
   name points at. The World flow already does this with CAIP-122, and the three agent wallets'
   keys are in `.env.local` for exactly this reason, so it is a contained piece of work.
4. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's next-step
   1, unchanged through ten iterations).

**Measured while working, worth keeping:** Sepolia log endpoints are the mirror image of World
Chain's. `ethereum-sepolia-rpc.publicnode.com` — the endpoint the rest of the SDK uses for
Sepolia *state* — refuses every historical `eth_getLogs` with "Archive requests require a
personal token", which is the honest failure; `sepolia.drpc.org` serves 10,000-block ranges and
**errors** above that rather than truncating (contrast the same provider's World Chain endpoint,
which iteration 10 caught answering `[]` for ranges holding 39 logs). `rpc.sepolia.org` returns
HTML, `1rpc.io` is over quota, `eth-sepolia.public.blastapi.io` is discontinued. Also: viem's
Sepolia UniversalResolver (`0xeeee…eeee`) resolves both 2LDs and subnames correctly today — the
earlier note that it "rejects `registry()`" did not affect `getEnsAddress`/`getEnsText`, which
is all the SDK uses.

**Blocked:** nothing. Two things left deliberately undone and written down rather than guessed:
**merging humans whose declared subject sets overlap** (our own tree shows the overlap, and
`declared-humans-share-a-wallet` reports it — but the sets are self-asserted, so merging on them
would let anyone absorb a stranger by copying their record) and **clustering an agent wallet to
an operator by funding history** (a guess that reads as an accusation when it is wrong). Both are
the same principle iteration 10 applied to the 27-agent operator. Iteration 1's two notes still
stand and are Hugo's calls, not blockers: `./test.sh` lives at `apps/demo/test.sh` rather than
the repo root where `MISSION.md` says to run it, and `pnpm-lock.yaml` is still untracked beside a
tracked `package-lock.json`. New and minor: `.env.local` gained three agent wallet keys
(`AGENT_ALPHA_PRIVATE_KEY`, `AGENT_BETA_PRIVATE_KEY`, `AGENT_UNVERIFIED_PRIVATE_KEY`), generated
by `scripts/ens-agents-keys.mjs`, holding no funds and needed only to re-run the setup script or
to build next-step 3.

## Iteration 12 — 2026-07-25

**Did:** the defect iterations 7 and 10 both named and left — **`world-id-orb` held through
AgentBook had no date**, and an undated credential on a `Decay` curve is scored by `freshnessOf`
at freshness **1**: full weight, forever, for a registration of any age. It was the last undated
credential in the roster and the same shape iteration 7 called a live scoring bug. The date was on
chain the whole time: `AgentRegistered` is emitted in the transaction that writes the mapping, so
the registration's block is the second the contract accepted a group-1 Orb proof for that address.

- **`registrationOf()` (`agentbook.ts`) — the probe path, not the scan path.** Filtering
  `eth_getLogs` on the agent topic makes the *result* one log, and tenderly then serves the entire
  5.8M-block history in a **single call: 423 ms**, against ~4.6 s for the six-call fleet scan. A
  scoring request cannot pay for a fleet scan; now it does not have to. Fetched only when the
  mapping says there is a registration to date (~1,164 wallets on World Chain, not every subject),
  so ordinary subjects pay nothing.
- **The canary is wide here, and that is the whole design.** `scanAgentBook`'s canary asks one
  block because its risk is an endpoint that answers `[]` for everything. This path's risk is
  quieter: an endpoint that serves recent blocks and silently drops the old end of a wide range
  returns no log for an agent registered in March, "no log" becomes "no date", and no date is
  **back to freshness 1** — the permissive answer the function exists to remove. So the canary is
  the *same wide filtered query* for `0xb667e025…83a1`, whose registration has sat at block
  27,100,652 since 2026-03-15. A local HTTP server answering `{"result":[]}` to everything is
  refused by it (`unavailable`, never `not-found`), asserted in the live suite rather than argued
  for in a comment. drpc — the endpoint iteration 10 caught lying — fails this too, loudly (HTTP
  400 on a wide range).
- **The date is refused unless it belongs to the binding state holds.** The log's `humanId` must
  equal the one `lookupHuman` just returned, and the timestamp must fall inside the contract's own
  lifetime (`AGENT_BOOK_DEPLOYED_AT`, 1,773,441,765, read from the deploy block's header). Nothing
  has ever re-registered on this contract, so today the first check is defensive — but the mapping
  is a plain overwrite, and dating a live binding from a superseded event is precisely the torn
  read `reconcile.ts` exists to prevent.
- **Both registries can date one address, and the later date wins.** Measured going both ways:
  `0x4f40c84e…` was AddressBook-verified 2026-04-16 and registered as an agent 2026-05-13
  (registration fresher); `0xf0ffe69d…` did both within ten minutes. Each date is a moment the
  chain accepted an Orb proof for that address and neither can be produced without one, so the
  most recent is the freshest thing known and there is no cheap way for an adversary to move it.
  Both land in `detail`; new note `date-from-agent-registration` beside the existing
  `date-from-latest-reattestation`, and both fire when the two dates are the same second.
- **Four ways the lookup can fail, four flags in `detail`** — endpoint unavailable, log missing a
  registration state holds, log naming a different human, timestamp out of range. Every one of
  them is a silent return to full weight, so none of them is swallowed. New caveat
  `issuance-date-is-registration` states the direction of the error: the enrolment behind the
  registration is older and World does not publish it, so on `Decay` the weight is a **ceiling**.

**Verified:** all four suites, on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 330 # pass 330 # fail 0 # skipped 0` (was 314 at
  iteration 11: **+11 unit** — 10 in `world.test.ts`, 1 in `scoring.test.ts` — **+5 live**, 4 in
  `world.live.test.ts` and 1 in `agentbook.live.test.ts`).
- `node --test --experimental-strip-types src/adapters/world.live.test.ts` → **14/14, `skipped 0`**,
  including a real agent wallet registered **73 days ago moving from freshness 1.0000 to 0.9546**,
  the probe's date matching the registration block's header to the second on four sampled
  registrations, and the empty-answer endpoint being refused.
- `node --test --experimental-strip-types src/agentbook.live.test.ts` → **13/13, `skipped 0`**: the
  one-agent lookup returns the same block, humanId and txHash as the full scan for a sample of six,
  and its timestamp is checked against the block header rather than the log field it came from.
- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `npm run build` clean; `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/demo && npx playwright test` → `13 passed`.
- `cd apps/agent && npm start` end to end: unchanged verdicts (DENY / ALLOW 3.6153 over 5 roots /
  DENY naming the sibling / DENY `admitted 1 of 27`), and gate 3 now prints
  `issuance-date-is-registration` where it printed `issuance-date-unknown`, with `world-id-orb`
  counted at **49.98c rather than a flat 50c**. That is the honest size of the fix on agents
  registered days ago; the 73-day figure above is what it is worth on an old one.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this reads a
date the chain already had — so a reseed would bump `revision` to record nothing. Registry stays at
**30 adapters, revision 34**.

**Committed:** `278d8cd` feat(sdk): the AgentBook registration is a date, and the last undated
credential is gone

**One incident worth recording, because it will happen again.** About an hour in, `git diff` came
back empty with every edited file at HEAD content; `git reflog` showed
`reset: moving to reattributed`. The laptop session had rewritten this repo's history to reattribute
all commits to `andrevalenm` and reset `main` onto the new lineage, discarding my uncommitted work —
it left a note at the bottom of `MORNING.md` explaining exactly that, which I found afterwards. No
data was lost beyond the hour: the changes were regenerated on the new HEAD and are the commit
above. **Practice for future iterations: commit each piece as soon as its tests are green, not at
the end of the iteration** — this repo has a second writer and `git status` being clean is not proof
that nothing happened. `MORNING.md`'s "Needs you" item 1 ("repo has no pushable remote") is now
stale; the laptop's `b1a9097` says the private repo is live. Nothing has ever been pushed from here.

**Next, in the order I would do it:**

1. **Base EAS subgraph**, replacing the `easscan.org` GraphQL dependency in
   `coinbaseVerificationAdapter` — the last vendor on the critical path, and the last place the
   repo contradicts its own stated principle. Constraint measured in iteration 9 and unchanged: the
   self-hosted graph-node here would need a Base network added to its config, which is a container
   change this mission forbids, so this is Studio or nothing.
2. **A signature gate for the ENS path.** `agent-presenter-not-authenticated` fires on every batch
   because resolving a name does not establish that the presenter controls the wallet the name
   points at. The World flow already does this with CAIP-122 and the three agent wallets' keys are
   in `.env.local` for exactly this reason, so it is contained.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates (iteration 1's next-step 1,
   unchanged through eleven iterations).
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read appears.
   Iteration 7's measurement still stands: neither leaves per-holder state on any chain, so this
   stays `live: false` in the ontology with the reason written down.

**Measured while working, worth keeping:** tenderly returns `blockTimestamp` on every log
(`eth_getLogs` spec addition), so the date costs no extra header read in practice — but the code
falls back to `eth_getBlockByNumber` when it is absent, and the live suite checks the value against
the header rather than trusting the field. A topic-filtered query over the full history is served in
one call where an unfiltered one needs six, so the cost of a date is bounded by result size and not
by range. Also, of the World Chain endpoints, only tenderly serves this at all: alchemy caps at 100
blocks, thirdweb at 1,000, and drpc returns HTTP 400 above 10,000 for a filtered query rather than
the empty-array lie it tells for unfiltered ones.

**Blocked:** nothing. Iteration 1's two notes still stand and are Hugo's calls, not blockers:
`./test.sh` lives at `apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it
(and its internal `cd` assumes the root, so it only works from there), and `pnpm-lock.yaml` is still
untracked beside a tracked `package-lock.json`.

## Iteration 14 — 2026-07-25

**Did:** iteration 12's own next-step 1 — **the `easscan.org` GraphQL dependency is gone**, and it
did not need a subgraph. `coinbaseVerificationAdapter` POSTed to `base.easscan.org` on every
scoring request, which made it the one adapter in the repo contradicting the principle written at
the top of `adapters/index.ts`. That is not a coherence complaint: a hosted endpoint we do not run
is the only part of a score an adversary can reach without touching a chain, and degrading it
silently costs every Coinbase-verified subject a trust root. Our own research file had already
written "do not put EASSCAN in a synchronous user-facing path" in July, and then we did.

- **Why the obvious fix fails, measured.** A recipient-filtered `eth_getLogs` over Base's full
  49.1M-block history: 1M blocks in 197 ms, 5M in **14.0 s**, 20M **times out at 120 s** — on
  `base.gateway.tenderly.co`, the only keyless Base endpoint that serves archive logs at all.
  publicnode refuses every archive range (*"Archive requests require a personal token"*), drpc
  caps a free range at 10,000 blocks, and llamarpc/blockpi/1rpc/meowrpc return non-JSON, rate
  limits or plan limits. A scoring request cannot pay 14 s, and scanning only the recent window
  reports `held: false` for everyone verified earlier. Iteration 12's read that this leaves
  "Studio or nothing" was right about subgraphs and wrong about the problem.
- **Coinbase maintains an on-chain index, so neither is needed.** Two `eth_call`s:
  `AttestationIndexer.getAttestationUid(subject, schema)` at
  `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C`, then `EAS.getAttestation(uid)` at the predeploy
  `0x4200…0021`. Address taken from `coinbase/verifications` and then verified live rather than
  trusted: 209 bytes of code, a uid for known recipients, zero for `0x…dEaD`.
- **The indexer is a pointer; EAS is the truth.** It is a proxy Coinbase can upgrade, so schema,
  recipient, date and revocation all come from the predeploy, and a record failing to match the
  uid, schema or subject asked for is an **error, not a negative**. EAS returns a *zeroed struct*
  rather than reverting for a uid it does not know, so that fault arrives looking like an ordinary
  record — it is caught by comparing the record's own uid to the one asked for.
- **Revocation is the whole reason for the second call.** The index keeps pointing at an
  attestation after it is revoked, and the sampled windows hold **5,143 revocations against 18,655
  issuances**. A non-zero uid is not a credential.
- **A real finding from the live suite, not from reading.** The first draft asserted the indexed
  uid equals the uid in the historical `Attested` log. The chain refuted it: the index holds one
  uid per `(recipient, schema)` and Coinbase re-attests, so old logs are superseded. The test now
  asserts the superseding record is the same subject, same schema, and `time >= logged.time` — an
  index pointing *backwards* is the fault worth catching, and equality never was.
- **The index is written at attestation time, not backfilled.** Read at the attestation's own
  block it returns the uid; one block earlier it does not. That is what would make an archive read
  of this credential historically honest, which is the precondition for `as-of` on Base.
- **The schema id is load-bearing on its own.** `SchemaRegistry.getSchema(0xf8b05c79…)` →
  `bool verifiedAccount`, `revocable: true`, resolver `0xD867CbEd…F32f` (non-zero, has code) —
  the mechanism behind "only Coinbase-permitted attesters may use this schema" — and 18,655
  attestations across six windows spanning the chain carry **exactly one attester**. So the probe
  filters on schema and does not pin an attester it would have to chase through a rotation.
- **Reads are at head, not pinned, and the module says why.** Keyless Base endpoints keep ~128
  blocks of state (`head-200` is already an archive request), so pinning against a load-balanced
  node one block behind fails outright. An EAS attestation is immutable once written; the only
  field that can move between the two calls is `revocationTime`, and reading it later reads it
  fresher. The single torn read available resolves to `held: false` for one block — safe direction.
- **The one honest limit, written down rather than glossed:** an attestation Coinbase issued but
  never indexed reads as absent. None was found in any sampled window, and the direction is safe —
  a missing credential lowers a score and can never inflate one.
- **Also fixed `apps/demo/test.sh`**, unrunnable since iteration 1. It `cd`s to its own directory
  and then to `packages/sdk`, which only exists from the repo root, so every iteration has been
  running the four suites by hand. Anchored to the root; the command `MISSION.md` names now works.

**Verified:** all suites, on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 351 # pass 351 # fail 0 # skipped 0` (was 330 at
  iteration 12: **+12 unit** in `coinbase.test.ts`, **+9 live** in `coinbase.live.test.ts`).
- `node --test --experimental-strip-types src/adapters/coinbase.live.test.ts` → **9/9,
  `skipped 0`**, against real Base. Nothing about a holder is hard-coded: subjects come out of
  `Attested` logs at run time, in windows at ~9.1M (Jan 2024), ~29.1M (Apr 2025), ~39.1M, ~46.1M
  and ~49.1M. Every one indexed; every EAS record's `time` equal to its block header's timestamp;
  a revoked holder read as not held with the revocation dated; a dead endpoint setting `error`
  rather than "not a human"; and a source check that no `easscan.org` host remains in the read path.
- `./apps/demo/test.sh` → **all suites green**: forge 18 passed, sdk unit 35, sdk live 15,
  Playwright 13 passed.
- `npm run build` and `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/agent && npm start` end to end: verdicts unchanged — DENY / ALLOW 3.6153 over 5 roots /
  DENY naming the sibling / DENY `a fleet of 27 agents is still one human`. The demo subject holds
  no Coinbase attestation, so an unchanged score is the correct outcome, not an absence of effect.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this changes
where a credential is read, not what it is worth — so a reseed would bump `revision` to record
nothing. Registry stays at **30 adapters, revision 34**.

**Committed:** `f8fb52b` feat(sdk): Coinbase reads from Base, not from easscan — the last vendor is
off the critical path

**Write-up:** `research/protocols/eas-and-disco.md`, new section "Resolution, 2026-07-25", with the
endpoint table, the coverage sample, and the residual limit. The ontology's `sourceURI` for
`coinbase-verification` already points there.

**Housekeeping:** `packages/sdk/eas-probe.mjs` — a scratch feasibility script the harness committed
as `04ff534` at the start of this iteration, from an iteration 13 that left no PROGRESS block — is
deleted. Its measurement is preserved as the endpoint table in the research doc.

**Next, in the order I would do it:**

1. **A signature gate for the ENS path.** `agent-presenter-not-authenticated` fires on every batch
   because resolving a name does not establish that the presenter controls the wallet the name
   points at. The World flow already does this with CAIP-122 and the three agent wallets' keys are
   in `.env.local` for exactly that. Unchanged from iteration 12's list; now the top item.
2. **`as-of` for Base.** This iteration established the precondition — Coinbase's index answers
   historically and is not backfilled — so `resolve(addr, { asOf: block })` could cover this
   credential too. Note the constraint: only tenderly serves archive `eth_call` on Base among the
   keyless endpoints, and it rate-limits, so this is a demo path and not a hot path.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates. Iteration 1's next-step 1,
   unchanged through thirteen iterations, and now the oldest thing on the list.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** The pattern that solved this is not specific to
Coinbase: when enumeration is the problem, check whether the *issuer* already solved it on chain
before reaching for an indexer. Coinbase writes `(recipient, schema) => uid` because their own
integrators need it, and that write is public. The same question is worth asking of every
API-gated protocol still sitting at `live: false` in the ontology.

**Blocked:** nothing. Iteration 1's second note stands and is Hugo's call: `pnpm-lock.yaml` is
still untracked beside a tracked `package-lock.json`. Its first note — `./test.sh` at the wrong
path — is now half-resolved: the script works, but it lives at `apps/demo/test.sh` rather than the
repo root where `MISSION.md` says to run it. Moving it is a one-line `git mv` somebody should
approve rather than an agent doing it unasked.

## Iteration 15 — 2026-07-25

**Did:** iteration 14's own next-step 1, and the oldest open item on the ENS track — **the ENS
path now authenticates whoever is presenting the name.** `agent-presenter-not-authenticated`
had fired on every batch since iteration 11 and been carried forward as the top next-step three
times. It reported a real hole and reported it honestly: a name is public, and so is everything
read from it. Anyone could type `alpha.corroborate.eth` into a counterparty's form and be scored
on the credentials of the human behind it — riding a stranger's evidence with no key, no
transaction and no trace, while the counterparty's own log named a party that was never there.
Every individual answer stays true, which is what makes it worse than not knowing.

New `packages/sdk/src/ens-presentation.ts`: an ERC-4361 challenge the counterparty issues, a
signature the presenter returns, and one comparison against the `addr` record read in the same
pass. Four decisions in it matter more than the code.

- **The wallet signs, not the node owner.** Both keys exist and prove different things. The
  wallet proves the presenter is the party the name currently designates — the party about to be
  transacted with, and the key the fleet slot is allocated to (`toFleetAgents` groups by wallet,
  not by name). The owner would prove only control of the *name*, so an operator pointing a name
  at a wallet it does not hold could then present as that wallet, which is the impersonation the
  gate exists to stop. Whether the signer *also* owns the node is reported (`signerIsNodeOwner`,
  caveat `agent-signer-owns-the-name`) because it says whether the key in front of you can
  rewrite the records you just read — never as a condition. On the live tree they are different
  addresses (`0xA83378d2…C922` signs, `0xE3C03709…BF87` owns) and a test asserts it.
- **The name is inside the signed message**, as `ens:<name>` under ERC-4361 `Resources`, and a
  signature carrying any other name is refused. Without it, one signature authenticates its
  signer for *every* name in the tree pointing at that wallet, and a signature collected for one
  name can be presented for another. A signature that does not name what it authorises is a
  bearer token. Both the unit suite and the live suite prove this with the **same nonce** on both
  challenges, so the refusal can only be coming from the name binding.
- **The gate runs before the grouping, not merely before the slot allocation.** An impostor
  presenting a stranger's name must not be counted as one of that human's agents: grouping first
  would let it inflate a stranger's fleet size and then have the stranger refused by the cap for
  agents they never ran. Everything counted per human is now counted over the agents that
  survived the gate, and a unit test asserts `largestFleet`, `deniedByCap` and the human's agent
  list all stay clean under exactly that attack.
- **Failure is three-valued.** A wrong-key signature is a fact about the presenter and is a
  denial. A smart-account signature (ERC-1271/6492) needs a chain read, and a failed read says
  nothing about anybody, so it comes back `unknown` → `indeterminate` — the same rule every probe
  in this SDK follows. An EOA never touches the network at all: local recovery first, chain
  second, so the common path cannot be broken by an endpoint being down. Verification also never
  burns a nonce — doing so would spend an honest presenter's nonce on a malformed retry, and
  replay state belongs to the counterparty that issued it.

- **Error copy is per-failure, not boolean.** Eleven named failures (`wrong-domain`, `wrong-uri`,
  `wrong-chain`, `wrong-name`, `expired`, `nonce-not-issued`, `signer-is-not-the-name`, …), each
  with a sentence a presenter can act on. "Signature invalid" and "you signed with the wrong
  wallet" are the same thing to a boolean and completely different instructions to a person.
- **`requirePresenterAuthentication` is the policy flag**, off by default for the same reason
  `requireAttestedBinding` is: the World AgentKit path authenticates at the HTTP layer before it
  ever reaches this engine, and a policy demanding proof from a caller with no channel to collect
  it refuses everybody. That flow now carries its CAIP-122 result *into* `evaluateFleet` instead
  of leaving it implicit, so the new caveat counts only agents that really presented nothing — a
  sibling discovered by scanning AgentBook's log is not asking for anything and is expected to
  carry none.
- **Message construction and parsing are viem's `viem/siwe`**, not string concatenation: ERC-4361
  has field-ordering rules, and a message the counterparty builds one way and a wallet renders
  another way is a signature nobody can check. Field *validation* is ours, because
  `validateSiweMessage` returns a bare boolean and a boolean cannot tell a presenter which field
  was wrong.

**Verified:** on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 389 # pass 386 # fail 2 # skipped 1`. **The two
  failures are not this change** — see "Blocked" below. The same command was `382 / 382 / 0 / 0`
  earlier in this same session, before an external writer touched the shared registry.
- Everything this change touches, green: `node --test src/ens-presentation.test.ts
  src/ens-agents.test.ts src/fleet.test.ts src/scoring.test.ts src/ontology.test.ts` →
  **131/131, `skipped 0`** (31 of them new), and `node --test src/ens-presentation.live.test.ts
  src/ens-agents.live.test.ts` → **21/21, `skipped 0`** (7 new).
- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `npm run build` clean; `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/demo && npx playwright test` → `13 passed`.
- `cd apps/agent && npm start` → verdicts unchanged: DENY / ALLOW 3.6153 over 5 roots / DENY
  naming the sibling / DENY `admitted 1 of 27`.
- `cd apps/agent && npm run ens` end to end, with two new runs. **Run 5**: each agent answers the
  challenge with the wallet its name designates — **2 of 3 admitted**, the same result as without
  the gate, because proof costs an honest agent nothing. **Run 6**: the same three names
  presented by a wallet generated one second earlier (`0x593E69d8…2012` on that run), identical
  records, identical human, identical score — **0 of 3**, each refusal naming the address the
  name resolves to and the address that signed.
- The acceptance the mission asks of this track — *"no hard-coded values anywhere in the demo
  path"* — holds: the only input is still the parent name in `deployments/ens-sepolia.json`. The
  challenge, the nonce, the signer, the address it is checked against and the impostor's key are
  all produced at run time, and the live suite asserts the deployment file's addresses against
  the chain rather than trusting them.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this is an
authentication layer over the ontology, not an edit to it.

**Committed:** `0cf3e94` feat(sdk): the ENS path authenticates whoever is presenting the name

**Blocked — and it is not this work.** Two tests in `as-of.live.test.ts` are red because the
**deployed Sepolia registry moved underneath this working copy while the iteration was running.**
Another writer added two adapters at block **11,349,413**, `2026-07-25T18:29:48Z`, taking the
registry from 30 adapters / revision 34 to **32 / revision 36**:

| id | name | trust root | tx |
|---|---|---|---|
| `human-passport-eas` | Human Passport score (EAS attestation) | `behavioral:wallet-history` | `0x14302f54…e46f` (rev 35) |
| `lens-account` | Lens account (Lens Chain) | `0x35eda994…4a46` (root name not in this tree) | `0xe5b5ebdd…bab9` (rev 36) |

This tree's `ontology/adapters.json` still has 30 entries, so `loadOntology()` falls back to
hashes for both and the two tests that compare the indexer's reconstruction against the chain
(`the ontology at the indexed head is the ontology the chain reports`) and pin the current
revision (`the same credential scores differently against the ontology of that morning`, expects
34, gets 36) fail. Confirmed independent of this change: `npm test` was 382/382/0/0 at the start
of this session, the write landed at 18:29 UTC, and neither test's path touches anything this
commit edits.

**I did not fix it, deliberately.** The full records are readable from the registry, so the
fields could be copied — but both cite research files that **do not exist in this working copy**
(`research/protocols/gitcoin-passport.md`, `research/protocols/lens-onchain-read.md`), and
`lens-account` sits on a trust root this tree has no plaintext name for. Writing entries whose
`sourceURI` points at files nobody here has read is exactly what `MISSION.md` rule 5 forbids, and
`ontology.test.ts` asserts against it on purpose. The other tree holds the missing half; merging
the two is Hugo's call, and it is item 18 in `MORNING.md`.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — pull the tree that wrote revisions 35
   and 36, or re-seed from this one. Until then two as-of tests stay red and any as-of score
   spanning block 11,349,413 is computed against an ontology this repo cannot name. It is the
   only red in the suite.
2. **`as-of` for Base.** Iteration 14 established the precondition — Coinbase's index answers
   historically and is not backfilled — so `resolve(addr, { asOf: block })` could cover that
   credential too. Constraint: only tenderly serves archive `eth_call` on Base among the keyless
   endpoints, and it rate-limits, so this is a demo path and not a hot path.
3. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates. Iteration 1's next-step 1,
   unchanged through fourteen iterations, and still the oldest thing on the list.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** The three-valued failure is the same shape as every
probe in this SDK, and it turned out to matter here in a way it does not for a probe: an EOA
signature is *pure arithmetic*, so putting local recovery first means the ordinary agent
authenticates with no RPC in the path at all, and only the smart-account case can be degraded by
an endpoint. Cheap authentication that cannot be rate-limited is the same property the adapters
chase by refusing vendor endpoints — the reason is identical and it is worth saying once: any
part of a decision an adversary can reach without touching a chain is a part of the decision they
can move.

**Also blocked, unchanged:** iteration 1's second note stands and is Hugo's call — `pnpm-lock.yaml`
is still untracked beside a tracked `package-lock.json`. `./test.sh` works but lives at
`apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it; moving it is a
one-line `git mv` somebody should approve.

## Iteration 16 — 2026-07-25

**Did:** iteration 15's next-step 2 in substance — **as-of scoring can now see a credential the
subject held then and has since lost.** Not by the route that list proposed (archive `eth_call`
on Base), which turns out to be unnecessary: the same correctness win is available at head, on
every chain, with no archive endpoint and no rate limit in the path.

Iteration 15's #1 — reconcile the ontology with the deployed registry — is **still blocked on
Hugo** and was re-confirmed blocked before starting: `npm test` reproduces exactly the two
failures, the deployed registry still reports revision 36 against this tree's 30 adapters, and
`research/protocols/gitcoin-passport.md` and `research/protocols/lens-onchain-read.md` still do
not exist here. Nothing has changed since iteration 15 wrote it up; MORNING "Needs you" item 18
stands.

**The defect.** Rule 2 in `as-of.ts` has said the same thing since the feature landed: credentials
are read at chain head, one dated after the as-of instant is dropped, and "one held then and
revoked since cannot be seen". The second half is not a footnote. Iteration 14 measured **5,143
revocations against 18,655 issuances** in the sampled Coinbase windows, and iteration 7 measured
that **roughly half a sampled 2025-04 World cohort** has let its 168-day term lapse. So an as-of
score asked about a block those subjects were verified at reported evidence they did not have — in
the one place the product claims to be exact. A counterparty auditing *"why did you deny me on
Tuesday"* got a reconstruction of Tuesday that was quietly not Tuesday.

**Why no archive node is needed.** Both registries already store the *end* of the credential and
never clear it. EAS keeps `revocationTime` and `expirationTime` on an immutable record;
`WorldIDAddressBook` keeps the lapsed `addressVerifiedUntil` forever — the same property that made
"presence is not evidence" a bug in iteration 3 is what makes history readable now. A credential
with a dated start and a dated end is a *closed window*, and `issuedAt <= t < heldUntil` is a
proof rather than an estimate. Five decisions in it matter more than the code.

- **`heldUntil` is a probe field, not an inference.** It may only ever be set by a probe that read
  an ending off a contract, never by one that failed to find a credential. That is the whole
  safety property: every negative in this SDK — a failed probe, a never-verified address, an
  ordinary absence — reaches the same branch, and only the ones carrying a real end date can come
  back. Unit tests assert each of those three stays exactly where it was.
- **Restoring requires an exact issuance date, never a lower bound.** `issuedAfter` says a
  credential is younger than some instant; it never says the credential already existed at one.
  Using it here would turn a bound into a credential. Those cases go to `ceasedStartUndated` and
  are left out — the residue of rule 2 made visible rather than absorbed into the score in either
  direction, which is the same reason `existenceUnverified` exists.
- **The window closes at whichever end came first.** An attestation that expired in March and was
  revoked in June stopped counting in March. The revocation stays the reported *reason* — it is
  the more informative negative — but `heldUntil` takes the minimum of the non-zero ends, because
  handing an as-of score the later one grants the subject three months they did not have.
- **A restored credential is priced at what it was worth then.** Freshness is already evaluated at
  the as-of instant by the caller, so the restore recomputes `effectiveCost` from it rather than
  granting full weight. Otherwise an expired credential would be the most valuable thing a subject
  could own.
- **World's lapsed entries get a start date they did not have.** `verifiedUntil -
  verificationLength()` was run only for live entries; it is the same arithmetic for a dead one
  under the same plausibility guard. It is set only when nothing else holds the credential up — a
  lapsed AddressBook entry beside a live AgentBook binding has not ended anything, and a test
  asserts `heldUntil` stays unset there.

**Holonym is deliberately not wired to this, and the reason generalises.** Its expiry is exact and
its credentials hard-expire within a year, so it looked like the best candidate in the roster. But
`getSBT` reverts once an SBT has expired, so the public values — and with them the issuer check
that makes an SBT evidence of anything at all — are unreadable for exactly the credentials that
would be restored. A window we cannot attribute would restore a self-signed credential. The rule
worth carrying: *a dated ending is not enough; the credential must still be attributable at the
moment you restore it.*

**Verified:** on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 407 # pass 403 # fail 2` (**+18 tests** over iteration
  15's 389). The two failures are iteration 15's registry-drift pair, unchanged: `the ontology at
  the indexed head is the ontology the chain reports` and `the same credential scores differently
  against the ontology of that morning` (expects 34, gets 36). Neither path touches this commit.
- `node --test --experimental-strip-types src/adapters/coinbase.live.test.ts` → **9/9,
  `skipped 0`**, against real Base. The revocation test finds a real revoked recipient in the
  chain's own `Revoked` logs, asserts `heldUntil` equals the EAS `revocationTime`, restores the
  credential at the midpoint of its real life, and confirms it is still absent one second after
  the revocation. Nothing about a holder is hard-coded.
- `node --test --experimental-strip-types src/adapters/world.live.test.ts` → **15/15, twice,
  `skipped 0`**, against real World Chain. A sampled lapsed address yields both ends off the chain
  — the stored number and the contract's own `verificationLength()` — and the same inside/outside
  pair, with `date-from-lapsed-verification` in the provenance.
- **A real finding from the live suite, not from reading.** The first draft asserted the derived
  start equals the timestamp of the `AccountVerified` log it was sampled from. The chain refuted
  it: the mapping holds only the *latest* verification, so an address that re-verified after that
  log and then lapsed has a later start (1765162927 against the log's 1745005467). The test now
  asserts `issuedAt >= minedAt`, which is the property that can actually be violated. This is the
  same supersession the Coinbase suite met in iteration 14, in a second registry.
- `./apps/demo/test.sh` → **all suites green**: forge 18 passed, sdk unit 35, sdk live 15,
  Playwright 13 passed.
- `npm run build` and `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/agent && npm start` end to end: verdicts unchanged — DENY / ALLOW 3.6153 over 5 roots /
  DENY naming the sibling / DENY `a fleet of 27 agents is still one human`.

**Honest limit on the demo path, stated rather than glossed.** The restore is exercised
end-to-end at the *evidence* layer against real chain data, not through `resolve(addr, { asOf })`,
and that is not a shortcut — it is arithmetic. `REGISTRY_GENESIS_BLOCK` is Sepolia 11,344,158,
deployed today, so every legal as-of instant is inside the registry's few hours of life. A
credential has to have ended *within those hours* for a full `resolve()` call to restore it, and
none of the sampled subjects has. The mechanism is asserted where it can be: real revoked
Coinbase recipients, real lapsed World addresses, both ends read off the chain at run time. As the
registry accumulates history this becomes the ordinary path with no code change.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this changes
what a past instant can be shown to have contained, not what anything is worth. Registry stays as
the chain has it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**Committed:** `aaae9dc` feat(sdk): as-of scoring can see a credential the subject has since lost

**Docs:** `README.md`'s as-of section rewritten — it previously ended on "one held then and revoked
since is invisible", which is no longer true, and stating a limit that has been fixed is as wrong
as hiding one that has not.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iteration 15, still the
   only red in the suite, still Hugo's call. Pull the tree that wrote revisions 35 and 36, or
   re-seed from this one.
2. **Widen the Circles subgraph window** and add `registrationObserved` to both mappings — still
   the cheapest way to turn two flagged approximations into real dates. Iteration 1's next-step 1,
   unchanged through fifteen iterations, and now by a wide margin the oldest thing on the list.
3. **A dated ending for Circles and PoH v2.** This iteration built the mechanism and wired the two
   adapters whose contracts already store an end. PoH v2's `humanityCount`/expiry surface and
   Circles' `stopped()` are the next two candidates, and each would need the same question asked
   of it that killed Holonym: is the credential still *attributable* at the moment you restore it?
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** Iteration 14's lesson was *when enumeration is the
problem, check whether the issuer already solved it on chain*. This one is its twin for time:
**when history is the problem, check what the contract declines to delete.** Both registries here
answer a historical question at head purely because neither clears its mapping — EAS because
attestations are immutable, World because `verify()` only ever overwrites. The archive node this
iteration was queued to need was never needed, and the same question is worth asking of every
adapter before reaching for an indexer: *is the past still sitting in current state?*

**Blocked:** nothing new. Iteration 15's two carried notes stand, both Hugo's call —
`pnpm-lock.yaml` untracked beside a tracked `package-lock.json`, and `./test.sh` living at
`apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it.

## Iteration 17 — 2026-07-25

**Did:** the oldest open item in this log — iteration 1's next-step 1, carried unchanged through
fifteen iterations: **widen the Circles subgraph window and add a `registrationObserved` flag to
both mappings.** Both halves landed, plus the thing that turned out to be underneath them: the
index now reports *which events it saw* and *how far back it saw them*, and the SDK stops assuming
either.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the two red tests reproduce exactly, the chain still reports 32
adapters at revision 36 against this tree's 30, and `research/protocols/gitcoin-passport.md` and
`research/protocols/lens-onchain-read.md` still do not exist here. MORNING "Needs you" item 18
stands, unchanged.

**The window was avoiding a cost that is not there.** The manifest said Circles emits ~7,200 Trust
events per 60k blocks so full history "would not sync inside a hackathon". Measured today —
20k-block windows sampled every 1M blocks from the Hub's deployment to head 47,388,288 — the mean
is **582 events per 20k blocks**, projecting to **~317,000 events** over the Hub's whole life,
about a quarter of the assumption. And the argument that settles it is not the volume: the PoH data
source already starts at 35,846,827, so the subgraph was **already syncing every one of those
blocks** and discarding only the Circles events in them. `startBlock` is now **36,486,014**, the
block the Hub's code first appears at (`eth_getCode` is `0x` at 36,486,013, 2024-10-13T15:09:10Z);
its first `RegisterHuman` is 36,501,311.

**What the window was costing, end to end, on real avatars.** Both scored through `resolve()`
against the old deployment and the new one, in the same minute:

| Subject | old | new | old freshness | new freshness | caveats cleared |
|---|---|---|---|---|---|
| `0x3fc5c255…cb6d` | 1.4150 | **1.6711** | 0.5000 (midpoint) | **0.9179** | `issuance-date-unknown`, `index-coverage-partial` |
| `0xd40133ea…b446` | 0.9438 | **1.6711** | 0.1557 (floor) | **0.9179** | `issuance-date-lower-bound` |

The second is the one worth looking at: it was in the index all along, dated from a trust edge 1.6
years after its registration, so a twenty-one-month-old avatar was priced at **17%** of the weight
its survival had earned. Neither error was ever hidden — both caveats fired every time — but a
caveat is not a score, and "we know this number is wrong" is not the same as a right number.

**Coverage is now the index's claim to make, not a constant in this package.** `completeHistory` is
what decides whether an index's *silence* is evidence, and it lived in `subgraph.ts` as a table
describing a manifest in another package. Two files, one hand-maintained agreement, and the drift is
silent and in the dangerous direction: a windowed index called complete turns "we cannot see it"
into "it did not exist" and prices a real credential as brand new. New `IndexCoverage` entity —
each data source records the earliest event it indexed — and the SDK compares that against the
block the protocol's first credential was created in (`PROTOCOL_FIRST_CREDENTIAL_BLOCK`: PoH's
first `HumanityClaimed` at **36,029,465**, from the complete 1,409-log claim history; Circles'
first `RegisterHuman` at **36,501,311**). Live now: `poh` from 35,864,293 (a `VouchRegistered`),
`circles` from 36,501,311 (a `Trust` — the self-trust edge a registration emits is ordered *before*
the `RegisterHuman` in the same block). Coverage rides in the same request as the entity and the
head, because a cached completeness claim outliving the deployment that earned it is the same error
one layer up. A redeploy with a narrower window now loses the claim by itself, and a unit test
asserts exactly that.

**The direction of a side-event date is the whole safety question, and the two protocols run
opposite ways.** The schema could not say whether an entity's date was its issuance or an adjacent
event's timestamp; PoH's read hard-coded "observed" and Circles inferred it from a null `inviter`.
Both are now explicit fields (`claimObserved`, `registrationObserved`), and the reconciler treats
them oppositely:

- **A Circles trust edge cannot precede the registration it points at** — not because Circles says
  so (it does not: in blocks 40,000,000–40,040,000 there were 21 registrations and **10 of them
  were preceded by a trust edge naming them**, which is what the invitation flow *is*) but because
  `handleRegisterHuman` overwrites the date. An avatar still carrying an edge timestamp is one
  whose registration this index never saw. So the date understates age: kept, flagged a floor.
- **A PoH vouch is cast on a request that has not resolved**, so it *precedes* the claim and
  reading it as an issuance date makes the credential look older. PoH scores on a `Ramp` where
  older is worth more, so this is the one direction that pays an adversary. It is no longer used as
  a date at all: it becomes `issuedAfter`, a proven lower bound on issuance, which caps ramp weight
  exactly as an absence bound does. New note `index-date-precedes-issuance`, new `dateFrom` value
  `index-side-event-bound`, new caveat.

**The honest size of that second fix:** below the half-life the number does not move (the ramp
evaluated at the bound *is* the ramp evaluated at the date). Above it the cap bites — a three-year
-old vouch read as an issuance date prices a 365-day ramp at **0.875** for a credential that may
have been claimed yesterday, against **0.5** as a bound. It also stops `as-of` treating that
timestamp as an exact date, which it never was, and it stops the caveat blaming our own indexing
for a disagreement that is a property of vouching.

**Where the direction has not been established, the unsafe reading is assumed.** An
`issuanceObserved: false` entity with no declared order bounds rather than dates. That is the
reverse of the old default, which assumed every side-event followed issuance on an argument that
holds for Circles trust edges and is false for PoH vouches.

**Verified:** on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 425 # pass 418 # fail 2 # skipped 5` (**+18** over
  iteration 16's 407: 12 in the new `subgraph.test.ts`, 5 in `reconcile.test.ts`, 1 live). The two
  failures are iteration 15's registry-drift pair, unchanged and untouched by this commit.
- `node --test --experimental-strip-types src/live.test.ts` against the new deployment → **16
  tests, 15 pass, 1 skip** (the index has not reached the PoH vector's claim yet). The three new
  live tests each assert against the chain rather than against a number in the file: the index's
  stated lower edge is at or before the Hub's first registration **and** the chain holds no
  `RegisterHuman` below it (chain-only, no third-party oracle, in the spirit of iteration 6); both
  avatars the window mis-dated now carry the timestamp of the block their own `RegisterHuman` is
  in, read from the header at run time; and every entity the index holds only through a vouch has
  its claim *after* that vouch on chain — **6 later, 2 never claimed, 0 earlier**, checked against
  the full 1,409-log claim history.
- `PATH=$HOME/.foundry/bin:$PATH forge test` → `18 passed; 0 failed`.
- `cd apps/demo && npx playwright test` → `13 passed`.
- `npm run build` and `tsc -p tsconfig.json --noEmit` clean; `packages/mcp` builds clean.
- `cd apps/agent && npm start` end to end: verdicts unchanged — DENY / ALLOW **3.6152** over 5
  roots / DENY naming the sibling / DENY `a fleet of 27 agents is still one human`. (3.6153 →
  3.6152 is hours of decay, not this change.)
- The 5 skips in the full run are the tests that need the new schema and were taken against
  `version/latest`, which still serves v0.0.2: the legacy path answers, reports no coverage, and
  they skip loudly with the reason instead of asserting against a deployment that cannot answer.

**Deployment state, and the one thing left running.** v0.0.3 is deployed to Studio (`77602/poh`)
and **still syncing** — 40.17M of 47.39M at the time of writing, and the rate through the dense
Circles region is ~37k blocks/min, so the remainder is on the order of hours. Nothing waits on it:
**Studio's `/version/latest` tracks the latest *synced* version, not the newest deployed one**
(verified — `version/latest` still returns v0.0.2's deployment hash `QmeYTnn…` while v0.0.3 answers
at its own label), so no consumer reads a half-indexed subgraph and the cutover happens by itself.
Until it does, the hosted demo and the default endpoint keep the old flagged behaviour for those
two Circles avatars; the numbers in the table above are what they become, measured against both
deployments rather than predicted. `.env.local`'s `SUBGRAPH_URL` was pinned to `v0.0.2` while I
deployed and is restored to `version/latest` (byte-identical to how I found it).

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this changes
what the index is allowed to claim about its own dates, not what anything is worth. Registry stays
as the chain has it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**Committed:** `23c8f31` feat(subgraph): the index reports which events it saw, and how far back it
saw them

**Write-up:** `research/protocols/protocol-subgraph-coverage.md` — the Hub's deployment bisection,
the event-volume table, the trust-before-registration measurement, the PoH claim-history counts,
and what is deliberately still not read. Indexed in `research/INDEX.md` (whose header count was
stale at "24 files / ~21,300 lines"; it is 36 files / ~24,250 lines). `docs/scoring.md` gained the
two paragraphs this argument belongs in, README limit 8 rewritten (it described the window as
current), and the `~2-month window` comment in the Circles adapter is gone.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15 and 16,
   still the only red in the suite, still Hugo's call.
2. **Check the cutover.** When v0.0.3 finishes, `version/latest` should flip to it; the five
   skipped tests then assert instead of skipping, and the two Circles avatars pick up their real
   dates everywhere including the hosted demo. If it has *not* flipped, pin `SUBGRAPH_URL` to
   `v0.0.3` and note that Studio's `latest` needs a manual publish.
3. **A dated ending for Circles and PoH v2** (iteration 16's #3, unchanged). Circles' `stopped()`
   has no timestamp we have located, so the window cannot be closed; PoH v2's expiry surface can.
   Each needs the question that killed Holonym asked of it: is the credential still *attributable*
   at the moment you restore it?
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** Iteration 14's lesson was *when enumeration is the
problem, ask whether the issuer already solved it on chain*; iteration 16's was *when history is
the problem, ask what the contract declines to delete*. This one is about our own layer: **an index
must be able to state what it saw, or its consumer will assume it.** Every assumption removed here
was load-bearing and silent — a coverage constant in a different package from the manifest it
described, a hard-coded `issuanceObserved: true`, a null field standing in for a fact nobody
recorded — and each one failed in the direction that flatters the score. The generalisation for the
next adapter: if a read's correctness depends on a property of the *source* rather than of the
subject, the source has to assert that property in the same answer, or it is not being checked.

**Blocked:** nothing new. Iteration 1's two carried notes stand, both Hugo's call —
`pnpm-lock.yaml` untracked beside a tracked `package-lock.json`, and `./test.sh` living at
`apps/demo/test.sh` rather than the repo root. One new, minor: the hosted demo bundle is the one
built at the last deploy and this box's user has no docker access (`docker ps` → permission
denied), so `scripts/deploy-demo-ax41.sh` cannot be run from here. It does not need to be — the
bundle reads `version/latest` and every field it queries still exists in the new schema, so it
picks the new index up at cutover without a rebuild.

## Iteration 18 — 2026-07-25

**Did:** iteration 17's next-step 3 — **a dated ending for Proof of Humanity, on both registries.**
Iteration 16 built the restore path and wired the two registries that obviously kept an ending
(EAS revocations on Base, `WorldIDAddressBook`'s lapsed term); PoH keeps one too, on v1 and v2,
and for the same reason: neither contract deletes anything when a term runs out.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the two red tests reproduce exactly (`as-of.live.test.ts`, 10
pass / 2 fail), the chain still reports 32 adapters at revision 36 against this tree's 30, and
`research/protocols/gitcoin-passport.md` and `research/protocols/lens-onchain-read.md` still do
not exist here. MORNING "Needs you" item 18 stands, unchanged for a fourth iteration.

**PoH v2 keeps the whole record and stops answering for it.** `isHuman`, `humanityOf` and
`boundTo` each apply `block.timestamp < expirationTime` *on the way out*; `getHumanityInfo`
applies nothing and returns the raw struct. So for an expired humanity the owner and the expiry
are both still readable at head while all three "is this a human" getters have gone quiet — the
same shape as World's `addressVerifiedUntil`, one layer deeper.

- **The link back is `private`, which is a Solidity concept and not a chain one.**
  `getHumanityInfo` is keyed by humanity id and the id is *chosen by the claimer*
  (`claimHumanity(bytes20 _humanityId, …)`), so a subject-keyed read needs
  `mapping(address => bytes20) private accountHumanity`. It sits at **storage slot 62**, and the
  slot was found rather than assumed: scanning indices 0..119 for a live subject and comparing
  each word against `humanityOf` gives exactly one hit, it agrees with all 21 lapsed subjects, and
  the live suite re-derives it every run. **A wrong slot cannot invent a credential** — whatever
  comes back is only used to look up the record, and nothing is reported unless that record's
  `owner` *is the subject*. A proxy upgrade that moves the layout costs us the window and can
  never fabricate one. `bytes20(subject)` is kept as a fallback because every humanity in the
  sampled population is filed under its owner's address — but 3 of 1,569 are not, so it is a
  convention and not the mechanism.
- **The census is the argument.** All 1,569 humanities the index knows, read through
  `getHumanityInfo` at Gnosis block 47,388,718: **1,352 live, 21 lapsed and still owned by the
  subject, 196 with `owner` cleared.** Those 196 are the honest limit — `delete humanity.owner`
  happens on a successful revocation and on a cross-chain transfer out, and neither writes a
  timestamp, so the credential may have ended years before its expiry and none of them is
  restored.
- **`nbRequests == 0` is an exact discriminator, and it is exactly the population the derivation
  misses.** Claim and renewal resolution write `expirationTime = block.timestamp + humanityLifespan`,
  so the subtraction recovers the claim second — measured against the index's independently
  observed `claimedAt` over all 21 lapsed humanities, **19 agree to the second and 2 miss, by
  −215.5 and +144.7 days**. Both are the entire `nbRequests == 0` cohort, and the only path that
  writes an expiry without pushing a request is `grantHumanityDirectly`, the cross-chain entry
  point, which copies a term settled on another instance. The +144.7 is the direction that would
  hand a subject a window they never had, so those get `heldUntil` and no start and land in
  `ceasedStartUndated` — iteration 16's "a bound is not a date" rule, demonstrated on live data
  rather than asserted.
- The residual is written down rather than hidden: `nbRequests >= 1` proves this contract resolved
  *a* request, not that the last write to the expiry was that resolution. What bounds it is that
  both instances run the same term — `humanityLifespan()` is 31,557,600 s on Gnosis **and** on
  mainnet `0xbE9834097A4E97689d9B667441acafb456D0480A`, read today — so the derivation is identical
  either way, and if those ever diverge that is the assumption that breaks.

**PoH v1's defect, read from the other side.** `submission.registered` is never cleared on expiry
— the thing iteration 8 built the adapter to avoid, since 33 of 215 sampled addresses have it set
with the credential dead. Read the other way round it is the mechanism: `registered &&
!isRegistered` says the credential ended **by arithmetic and nothing else**, so both ends are
still in the registry. A ForkModule removal gets no window (a bare boolean, and v1 went on
honouring one such registration for 510 days), and a cleared `registered` flag gets none either.

- **Closed a research question to do it.** Every v1 window is `submissionTime +
  submissionDuration()`, and that term is governance-settable, so when it last moved decides
  whether a window is right. Bisected over mainnet archive state: **365.25 days at block
  14,330,754, 730.5 days at 14,330,755** (header timestamp 1,646,535,074, 2022-03-06T02:51:14Z),
  unchanged since. Every as-of instant this SDK can be asked about is at or after the registry's
  own genesis (Sepolia 11,344,158, today), four years the other side of that, so today's term
  governed every window we can be asked to decide. `poh-v1-onchain-read.md` §8 question 1 is now
  **CLOSED** in place, and a live test pins all three readings so the day it stops being true is a
  red suite rather than a silent shift.

**One layer moved underneath both.** `reconcile.ts` dropped every date on the `!chain.held` branch,
so a probe could not report a window through it at all. `ChainView`/`Reconciled` now carry
`heldUntil`, the not-held branch passes a closed window through with
`date-from-lapsed-verification`, and an ending with no start is named
(`lapsed-credential-start-undated`) instead of being silently dropped. Nothing infers an ending
there: `heldUntil` only ever comes from the chain view, so a failed read, an index that thinks the
credential ended, and an ordinary absence all still reach the same branch with nothing in it.

**Verified:** on this box, at this commit.

- `cd packages/sdk && npm test` → `# tests 450 # pass 445 # fail 2 # skipped 3` (**+25** over
  iteration 17's 425: 9 new `poh-v2.test.ts`, 7 `poh-v1.test.ts`, 4 `reconcile.test.ts`, 3 live in
  `live.test.ts`, 2 live in `poh-v1.live.test.ts`). The 2 failures are iteration 15's registry-drift
  pair, confirmed unchanged by running `as-of.live.test.ts` alone: `the ontology at the indexed head
  is the ontology the chain reports` and `the same credential scores differently against the
  ontology of that morning`.
- `node --test --experimental-strip-types src/live.test.ts` → **16 pass, 3 skip, 0 fail**. The
  skips are the three tests that need subgraph v0.0.3's schema, which is still syncing.
- `node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts` → **12/12, 0 skipped.**
- `./apps/demo/test.sh` → all suites green: forge **18 passed**, sdk unit, sdk live, Playwright
  **13 passed**.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → verdicts unchanged: DENY / ALLOW **3.6152** over 5 roots / DENY
  naming the sibling / DENY `a fleet of 27 agents is still one human`.
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") is *"a humanity that expired is a closed window, and the
  claim log is its start"*: it samples a lapsed subject at run time, then holds the probe's two
  dates against three other sources the probe never consulted — `getHumanityInfo`'s own `owner` and
  `expirationTime`, `humanityLifespan()` at head, and the block header of the humanity's own
  `HumanityClaimed` log, which must have **exactly** the derived start as its timestamp. Then it
  restores the credential at the window's midpoint and confirms it is gone at the second it ended.
  The v1 twin is stronger still: archive `isRegistered` is read at four blocks and must be false
  immediately before the reported start, true at it, true immediately before the reported end and
  false at it — *the window we hand back is the window the contract itself honoured*.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this changes
what a past instant can be shown to have contained, not what anything is worth. Both `notes` fields
gained the new facts (an off-chain field; `setAdapter` does not carry it, checked in
`PersonhoodRegistry.sol`). Registry stays as the chain has it (32 adapters / revision 36, written by
the other tree; this tree still has 30).

**Committed:** `d92d159` feat(sdk): both Proof of Humanity registries date the end of a credential,
so as-of can see it

**Write-up:** `research/protocols/poh-lapsed-credentials.md` — the getter asymmetry with the source
quoted, the slot-62 derivation, the full census, the `nbRequests` measurement table, the term-change
bisection, and what is deliberately not restored. Indexed in `research/INDEX.md`.
`docs/scoring.md` corrected: it still said an as-of score "cannot see" a credential held then and
revoked since, which iteration 16 fixed two iterations ago — stating a limit that no longer exists
is as wrong as hiding one that does. README's as-of section now names all four registries and why
each can produce a window.

**The v0.0.3 cutover, checked (iteration 17's next-step 2).** Still syncing, healthily: **42,287,007
of 47,389,000** at the time of writing, `hasIndexingErrors: false`, measured at **~65,000
blocks/min** over two samples 25 minutes apart, so ~75 minutes remain. `version/latest` still serves
v0.0.2 (`QmeYTnn…`), which is the designed behaviour — Studio's `latest` tracks the latest *synced*
version — so no consumer is reading a half-indexed index and the flip happens by itself. **One
operational trap worth recording, because it cost me ten minutes:** a labelled version is queried at
`/query/77602/poh/v0.0.3`, *not* `/query/77602/poh/version/v0.0.3`. The `version/` prefix works only
for `latest`; every other path under it returns `{"message":"Not found"}`, which reads exactly like a
deployment that has been deleted.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15, 16 and 17,
   still the only red in the suite, still Hugo's call.
2. **Circles is the last undated ending, and the subgraph can close it.** The Hub's `stopped()` is a
   boolean with no timestamp, exactly like PoH v1's ForkModule, so state cannot date it — but the
   mapping already handles the stop event and could record the block it saw. That is a mapping
   change plus a resync, and the resync should wait for v0.0.3 to land rather than queue behind it.
3. **Ask the same question of the adapters that have not been asked it.** Human Passport's cached
   score carries an `expirationTime` and Linea PoH's attestations carry `expirationDate` and
   `revocationDate` — both are dated endings on records that stay readable, so both are candidates.
   Each needs the question that killed Holonym in iteration 16: is the credential still
   *attributable* at the moment you restore it?
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** Iteration 16's lesson was *when history is the problem,
ask what the contract declines to delete*. This iteration is the same question asked one level down:
**a getter that hides a value is not a chain that has lost it.** Every one of PoH v2's three
personhood getters returns zero for a lapsed humanity, and all three are reading a struct that still
has the answer in it — the expiry check is in the getter, not in the storage. The same holds for
`private`, which restricts other contracts and not `eth_getStorageAt`. The rule for the next adapter:
when a contract says *no*, check whether it is saying "there is nothing here" or "I decline to tell
you", because those two answers live in the same `0x0000…0000` and only one of them is a fact about
the subject. And when you do reach past a getter, make the read *self-validating* — the owner check
here is what makes an unverifiable storage slot safe, because every way of getting it wrong produces
silence rather than a credential.

**Blocked:** nothing new. Iteration 1's two carried notes stand, both Hugo's call —
`pnpm-lock.yaml` untracked beside a tracked `package-lock.json`, and `./test.sh` living at
`apps/demo/test.sh` rather than the repo root where `MISSION.md` says to run it.

## Iteration 19 — 2026-07-25

**Did:** iteration 18's next-step 3 — **a dated ending for Human Passport and Linea PoH V2.** With
these two the roster is finished: every adapter that publishes an ending now reads it, and the
ones that do not are documented as not being able to.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests are red in `as-of.live.test.ts` and nothing
else is. MORNING "Needs you" item 18 stands, unchanged for a fifth iteration. Iteration 18's
next-step 2 (Circles' undated ending, which needs a mapping change plus a resync) was deliberately
left for after the v0.0.3 cutover rather than queued behind it, exactly as iteration 18 proposed.

**Human Passport: the resolver keeps what the Decoder stops saying.** `getScore` reverts
`AttestationExpired` once a score ages out, but the Decoder is not where the score lives —
`GitcoinResolver.getCachedScore` is a plain mapping read and answers forever. `0xb0812e00…90F2`'s
passport died **419.9 days ago** and its `{score: 500150, time: 1740958699, expirationTime: 0}` is
still there at head, so the whole life of the credential is available with no archive node and no
log query. Third instance of one shape now: PoH v2's `getHumanityInfo` vs `isHuman`, World's
`addressVerifiedUntil`, and this.

- **The test that mattered was iteration 16's refusal, not the expiry.** A dated ending is
  necessary and not sufficient — the credential has to still be *attributable* at the instant you
  restore it, which is why lapsed Holonym SBTs are excluded (`getSBT` reverts and takes the issuer
  check with it). Passport passes it with a read rather than an argument: `userAttestations` →
  EAS `getAttestation` returns `time` **1740958699, identical to the resolver's**, `revocationTime`
  0, and the subject still named as `recipient`. The live suite does that cross-check every run.
- **Refused:** a zero score (not evidence while it was alive, so its expiry ends nothing), a window
  that never opened (`expiresAt <= time`), anything not actually expired.
- **Residual, stated:** the resolver caches one score per address per chain and a re-mint
  overwrites it, so only the most recent life on each chain is visible. Reading all seven
  deployments blunts it — this subject has three lapsed windows, Optimism and Linea from 2025-03
  and Scroll from 2024-07 — and `detail.perChain` shows every one we can see.

**Linea PoH: the same enumeration, one term further back — and here it is most of the protocol.**
A Verax attestation is immutable, so an expired or revoked one still carries `attestedDate` beside
its ending. The existing scan reads a one-term-wide id range, which is exactly the set that can
still be *alive*: a credential that ended at `E` was written no earlier than `E − term`, so nothing
ended is in it. That is arithmetic, not an oversight, and reaching further back fixes it.

- **The ratio is the argument. 50,475 attestations ever issued, ~495 alive.** Nearly everyone this
  protocol has verified is lapsed, so an as-of score that sees only live attestations is blind to
  99% of the population it is being asked about. Thirty days of reach costs three extra batched
  calls (758 ids → 2,048 through the doubling ladder, 7.3 s against ~4 s) and turns **494 live
  subjects into 1,025 with a closed, dated window**.
- **The lookback is a cost decision made with the issuance curve in front of me,** not a round
  number: measured today, 90 d → 758 ids, 120 d → 1,211, 150 d → 1,943, **180 d → 3,896**, because
  at 180 days the January 2026 campaign (24,723 attestations in one month, half the protocol's
  lifetime issuance) comes back into range.
- **Coverage is derived from the scan, not from the constant that chose it.**
  `endingsCompleteFrom = attestedDate(lowest id actually read) + longest term actually seen`, so a
  narrower scan loses the claim by itself — iteration 17's `IndexCoverage` lesson applied to an
  enumeration. Below that instant an *observed* ending is still a real window; it is only the
  **absence** of one that stops meaning anything, which is why under-coverage can only fail to
  restore a credential and never invent one.
- **Refused:** a revocation Verax recorded with no `revocationDate` — the expiry is then only an
  *upper* bound on when it really stopped, and restoring against a bound hands the subject every
  day between. Also a revocation *after* the term ran out (Verax lets a dead attestation be
  revoked, so the ending is `min(revocationDate, expirationDate)`; the one dated revocation in
  range has a 16.4-day window, not 90), a foreign portal's attestation, and inverted or future
  windows.

**End to end, on a subject found at run time.** `0x39473b54ff152461298a93ed6913ee0fa7f2fab1` holds
one Linea PoH attestation, written 2026-04-26T08:04:57Z, expired **2026-07-25T08:04:56Z**:

| as of | score | roots | `linea-poh` |
|---|---|---|---|
| 2026-07-25T07:04:56Z | **3.1765** | 1 | held, 1500.48c, `ceasedAfterAsOf: [linea-poh]` |
| 2026-07-25T09:04:56Z | **0.0000** | 0 | not held |
| chain head | **0.0000** | 0 | not held |

Nine subjects are in that state right now — a window that has already closed and whose closing
instant is *after* the registry's own genesis, which is the only range an as-of question can be
asked about at all (Sepolia 11,344,158, 2026-07-25T00:21:36Z). **Human Passport has the same
mechanism and no such subject today:** every lapsed passport window closed long before the registry
existed, so its restoration is real, unit- and live-tested, and currently undemonstrable end to
end. That is a fact about the registry's age, not about the read, and it is worth saying out loud
rather than quietly presenting the Linea number as if it covered both.

**A live test of ours had stopped covering anything, silently, for two reasons at once.**
`human-passport.live.test.ts` sourced a *current* minter from EAS `Attested` logs on Optimism.
Iteration 4 moved the Passport probe off `mainnet.optimism.io` to publicnode (correctly — the
archive quota belongs to Farcaster) and the test followed it; **publicnode rejects that log filter
outright** with `InvalidParams`, and the search caught the exception and returned `undefined`,
which the caller read as "nobody minted recently" and skipped in silence. Separately, the mint rate
had fallen: the most recent score-v2 mint on 2026-07-25 was **54,000 blocks back**, past the 45,000
the search covered. Fixed by pointing the search at `optimism.drpc.org` (which answers), widening
to 16 windows, and **printing the refusal** — an endpoint that will not serve the filter and a
registry with no recent mint produced the same `undefined` and the caller could not tell them
apart. The positive path now actually runs.

**Verified:** on this box, at this commit.

- `./apps/demo/test.sh` → forge **18 passed**; sdk scoring **35 pass**; sdk live **16 pass, 3 skip,
  0 fail**; Playwright **13 passed**. Exit 0.
- `cd packages/sdk && npm test` → `# tests 475 # pass 470 # fail 2 # skipped 3` (**+25** over
  iteration 18's 450). Per file: `human-passport.test.ts` +9 (new), `linea-poh.test.ts` +10
  (19 → 29), `linea-poh.live.test.ts` +4 (18 → 22), `human-passport.live.test.ts` +2 (6 → 8). The
  commit message's per-file breakdown is off by one on two of those lines; the totals in it are
  right and this is the accurate split.
- The 2 failures are iteration 15's registry-drift pair in `as-of.live.test.ts` — *the ontology at
  the indexed head is the ontology the chain reports* and *the same credential scores differently
  against the ontology of that morning* — unchanged and untouched by this commit. The 3 skips are
  the tests waiting on subgraph v0.0.3.
- `node --test src/adapters/linea-poh.live.test.ts` → **22/22, 0 skipped**, three consecutive runs.
  One earlier run had the probe suite red once and I could not reproduce it in three attempts; it
  is recorded here rather than dismissed.
- `node --test src/adapters/human-passport.live.test.ts` → **8/8, 0 skipped.**
- `npm run build` and `tsc -p tsconfig.json --noEmit` clean in `packages/sdk`; `packages/mcp`
  builds clean.
- `cd apps/agent && npm start` → verdicts unchanged: DENY / ALLOW **3.6152** over 5 roots / DENY
  naming the sibling / DENY `a fleet of 27 agents is still one human`. Nothing at head moved,
  which is the point: a credential that is not held is priced at zero either way.
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") is two, one per adapter. Passport's is *"a lapsed passport is
  a closed window, and both of its ends come back from elsewhere"*: the probe reads one struct, and
  the test holds the window it derives against **two contracts the probe never touches** — EAS's
  own attestation record, whose `time` must equal the start to the second and whose
  `revocationTime` must be zero and whose `recipient` must still be the subject, and the Decoder,
  whose `AttestationExpired` revert payload must equal the end. Linea's is *"a lapsed subject is a
  closed window, restorable inside it and nowhere else"*: a subject sampled out of the ended
  population at run time, its window re-read from the registry at head, then pushed through
  `applyAsOfToEvidence` — restored at the midpoint of a life that really happened, absent one
  second after it ended and one second before it began. Plus the coverage claim proved from the
  chain alone (the 600 ids below the scan must each have *finished* before `endingsCompleteFrom`)
  and cross-checked against the Verax subgraph by **set equality** over lapsed subjects, paged,
  because the lapsed half of the window is larger than the live half.

**Committed:** `976b0a2` feat(sdk): Human Passport and Linea PoH date the end of a credential, so
as-of can see it

**The commit needed a new tool, and that is an environment fault worth knowing about.** `git add`
failed with `insufficient permission for adding an object to repository database`. Cause:
**another process runs git in this repo as root** — 258 files under `.git` are root-owned,
including `.git/config`, `ORIG_HEAD` and two pack files, with timestamps from 17:57 to 21:40
today. Two of the 258 loose-object directories, `f5` and `fe`, were *created* by that process and
are therefore owned by root and mode 755, so any object whose SHA-1 starts with those bytes cannot
be written — a 2-in-256 lottery per object, which is why iterations 17 and 18 committed fine and
this one could not. Neither the directories nor their contents can be removed without root
(deleting an entry needs write permission on its parent), and I did not try to force it. What is
writable is `.git/objects/pack`, so `scripts/commit-via-fast-import.mjs` commits through
`git fast-import`, which packs its objects. `git fsck` (full, not just `--connectivity-only`) is
**clean before and after**, `git status` is empty, and `git show --stat HEAD` renders all 13 files,
which requires every blob to be present and readable. The three root-owned objects were verified
intact and untouched. This is a workaround for a broken environment and not a replacement for
`git commit`; the script's header says so and MORNING has it as a "Needs you".

**Write-up:** `research/protocols/passport-and-linea-lapsed-credentials.md` — the resolver/Decoder
asymmetry with the live struct, the EAS attributability cross-check, the window-cost table by
lookback, the coverage derivation, everything refused and why, the end-to-end table, and the live
test defect in §4. Indexed in `research/INDEX.md` (header recount: 38 files / ~24,750 lines).
`docs/scoring.md` and README both said **four** registries produce a window; it is six, and both
now say which and why the ratio makes Linea the one that matters. README's test-count paragraph
was two iterations stale and claimed "All 420 pass" while two are red — corrected to name the red
ones rather than round them away.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — this changes
what a past instant can be shown to have contained, not what anything is worth. Both `notes` fields
gained the new facts (an off-chain field; `setAdapter` does not carry it). Registry stays as the
chain has it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**The v0.0.3 cutover, checked.** Still syncing, healthily and faster than iteration 18 measured:
**45,117,475 of ~47,389,400**, `hasIndexingErrors: false`, ~81,000 blocks/min over two samples 34
minutes apart, so roughly half an hour left. `version/latest` still serves v0.0.2 (`QmeYTnn…`),
which is the designed behaviour. Nothing waits on it.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–18, still
   the only red in the suite, still Hugo's call.
2. **Circles is the last undated ending, and v0.0.3 should have landed by now.** The Hub's
   `stopped()` is a boolean with no timestamp, so state cannot date it, but the mapping already
   handles the stop event and could record the block it saw. A mapping change plus a resync —
   and the resync no longer has to queue behind v0.0.3.
3. **Pin Passport's attester.** §6 question 1 of the new write-up: the probe's authority model
   rests on only EAS being able to write to the resolver, and the EAS record now read for the
   window hands us the attester (`0x84382998…dB1a`) for free. Pinning it the way Holonym's issuer
   and Linea's portal owner are pinned would close the question instead of assuming it. This is
   the cheapest remaining correctness item in the roster.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** Iteration 18's lesson was *a getter that hides a value
is not a chain that has lost it*. This iteration is the same question asked of an **enumeration**
rather than a getter: our Linea scan was not missing lapsed credentials because the chain had
deleted them, it was missing them because the range we chose was defined by *what could still be
alive*. The window was answering a different question from the one an as-of score asks, and it
looked complete because it was complete — for the other question. The rule for the next adapter:
**when a read is bounded, write down the predicate the bound enforces, because that predicate is
what the read is actually exhaustive over** — and if a second consumer asks something else, the
bound has to move rather than the answer being trusted.

The other one is smaller and cost me a real hole: **a live test that sources its own subject can
stop covering anything without failing.** If the search can come back empty, "the source refused
me" and "the thing does not exist" must be distinguishable, or the test degrades into a green
no-op and stays that way for fifteen iterations.

**Blocked:** nothing. One new item for Hugo, in MORNING: the root-owned `.git` objects above, which
will silently block roughly one commit in a hundred-and-something until the ownership is fixed.
Iteration 1's two carried notes stand, both Hugo's call — `pnpm-lock.yaml` untracked beside a
tracked `package-lock.json`, and `MISSION.md` pointing at a `./test.sh` that lives at
`apps/demo/test.sh`.

## Iteration 20 — 2026-07-25

**Did:** iteration 19's next-step 2 — **the Circles ending**. The item was "date the stop, which
needs a mapping change plus a resync". Asking the question closed it a different way and turned up
a live defect in our own scoring instead: **Circles has no ending, and we were reading one.** No
subgraph change, no resync.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: `as-of.live.test.ts` is 10 pass / 2 fail, the same two, and
nothing else. MORNING "Needs you" item 18 stands, unchanged for a sixth iteration.

**`isHuman` is monotonic, so a Circles registration cannot be revoked.** The Hub writes
`mintTimes[a].lastMintTime` at registration and never writes it back to zero: `_claimIssuance` only
ever raises it, `_updateMintV1Status` takes `_max(lastMintTime, block.timestamp)` with a comment
saying it does so precisely to protect the stop sentinel, and there is no `delete` on `avatars`.
`isHuman(a)` is `mintTimes[a].lastMintTime > 0`. The one transition an avatar has after
registration is `stop()`, which writes `type(uint96).max` — irreversible, and greater than zero, so
**the Hub goes on calling a stopped avatar a human**.

**The defect that made it worth an iteration.** `circlesIndexRead` mapped the index's `stopped`
flag onto `IndexedCredential.ended`, and `ended` is the one field `reconcile.ts` cannot
second-guess — on the branch where the contract read *fails*, it is the answer
(`if (index.entity.ended) return { held: false }`). So one subject was:

| Gnosis RPC | `held` |
|---|---|
| up | `true` (`isHuman` decides) |
| down | `false` |

Two answers about one subject, chosen by our own uptime. That is the torn read `reconcile.ts` was
written to remove, reappearing in the field the reconciler treats as authoritative, and it is a
**false negative** — the direction the mission's adapter checklist singles out ("a network failure
returning `held: false` would silently mean 'not a human'"). It survived because it needs a stopped
avatar *and* a failed chain read, and there are two stopped avatars in the world.

Fixed as `ended: false` with the monotonicity argument in place. The stop is now reported beside
the credential rather than instead of it: `detail.stopped`, `detail.stoppedIndexed` when the index
differs (index lag — shown, not resolved), and a `credential-minting-stopped` note and caveat
saying the credential is held and counted and that the address may be one its human has walked
away from. Stopping is, in practice, what you do before moving to a new address.

**And the Hub cannot be asked which avatars stopped.** `mintTimes` is `internal`, so
`stopped(address)` is the only intended read, and it is broken:

```solidity
function stopped(address _human) external view returns (bool) {
    if (!isHuman(_human)) { revert CirclesErrorOneAddressArg(_human, 0x03); }
    MintTime storage mintTime = mintTimes[msg.sender];   // <-- msg.sender, not _human
    return (mintTime.lastMintTime == INDEFINITE_FUTURE);
}
```

Measured three ways at head, and the third row is the one that admits no innocent reading:

| call | `from` | result | true answer |
|---|---|---|---|
| `stopped(0xeb94…)` | *(none — `0x0`)* | `false` | **true** |
| `stopped(0xeb94…)` | `0xeb94…` | `true` | true |
| **`stopped(<a live avatar>)`** | **`0xeb94…`** | **`true`** | **false** |

An ordinary `eth_call` sends no `from` and runs as the zero address, whose `lastMintTime` is 0, so
**`stopped()` returns false for every address anyone has ever asked about** — including both that
really stopped. Archive reads confirm it was false even *in the block the `Stopped` event was
emitted in* (control: `isHuman` is false at 43,155,514 and true at 43,155,515, so the endpoint is
genuinely archive). The Hub is not behind a proxy — EIP-1967 implementation slot is `0x00…00`,
bytecode verifies directly as `Hub` — so it cannot be fixed in place. **Our index was right and the
contract's getter is wrong**, which is worth saying out loud: the obvious "cross-check the index
against the contract" would have disproved two real stops and confirmed any number that never
happened.

**So the probe reads storage, and the slot checks itself.** `mintTimes` is at **slot 21**, found by
scanning indices against a known-stopped avatar, a live one and an address the Hub has never seen —
one index gives the sentinel, a plausible timestamp and zero. What makes a hard-coded slot in
someone else's contract safe here is stronger than iteration 18's owner check: **`isHuman` is a
public getter over the exact word being decoded**, so `(lastMintTime > 0) === isHuman(a)` is a check
the chain performs on every call, in the same batch as the `held` read. Census: **252/252 sampled
avatars agree**, including **4 that never registered** (trust-graph entries), so the identity is
exercised in both directions. Disagreement returns `undefined` — a moved layout costs the flag and
can never invent one.

**The population is two, ever.** Topic-filtered `eth_getLogs` for `Stopped(address)` over the Hub's
whole life (36,486,014 → head 47,389,543, 200,000-block pages): `0xeb94174e…` at block 40,615,924
(2025-06-16T15:11:25Z) and `0x4bfc7498…` at 45,241,483 (2026-03-20T05:27:05Z), against ~317,000
register/trust events. Both are `isHuman` at head, with 126 and 5 incoming trust edges. Hard-coded
as fixtures for the same reason iteration 8's `RETIRED_BY_V2` is — two in the population is not
something a run-time sample finds — but everything *about* them is re-derived each run.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green**: forge **18
  passed**; sdk scoring **35 pass**; sdk live **19 pass, 0 skip, 0 fail**; Playwright **13 passed**.
  Exit 0. The three skips iterations 17–19 carried are gone: **v0.0.3 finished syncing during this
  iteration** (47,389,943, `hasIndexingErrors: false`, at head).
- `circles.test.ts` → **9/9**, no network. `circles.live.test.ts` → **9/9, 0 skipped** against
  v0.0.3; 8 pass / 1 skip against `version/latest`.
- `cd packages/sdk && npm test` → `# tests 493` (**+18** over iteration 19's 475: 9 unit, 9 live).
  **2** failures are iteration 15's registry-drift pair, unchanged. A further **4** in
  `live.test.ts` are a Studio `429 Too many requests` on the `version/latest` endpoint and are
  **19/19 green against v0.0.3**, so they are quota and not code — I exhausted the free-tier quota
  running the 252-avatar census, and it had not reset by the end of the iteration.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6178 over 6 roots** / DENY naming the sibling /
  DENY `a fleet of 27 agents is still one human`. Iteration 19 recorded **3.6152 over 5**. **That
  difference is not this change** — I stashed the whole working tree and re-ran, and the old code
  gives 3.6178 over 6 as well. Circles is the sixth root and something outside this commit brought
  it back; worth a look, but it is not ours.
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") is *"the Hub cannot answer the question its getter takes an
  argument for"*: the same `stopped()` call issued three ways, with the answers required to be
  false, true, and **true about an avatar that never stopped**. Then the storage read held against
  `isHuman` over 40 avatars sampled at run time **from the Hub's own logs, not from our index** —
  deliberately, since the census is what licenses the hard-coded slot and it must not be able to go
  quiet because a hosted GraphQL endpoint rate-limited us. Then the transition dated from archive
  storage: the word at `block − 1` is an ordinary mint timestamp and at `block` it is the sentinel.
  Then set containment against the index, guarded on the index's *own* coverage record rather than
  its head, because a windowed deployment has a head past both stops and has seen neither.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved — nothing at
head changes, because `isHuman` already decided it. What changes is that the degraded path now
agrees with the head path. `circles-v2`'s `notes` gained the facts (an off-chain field;
`setAdapter` does not carry it). Registry stays as the chain has it (32 adapters / revision 36,
written by the other tree; this tree still has 30).

**Committed:** `e96fe5c` fix(sdk): a stopped Circles avatar is not a revoked one, and the Hub
cannot tell you which is which

**Write-up:** `research/protocols/circles-stop-and-the-broken-getter.md` — the source quoted, the
three-way measurement, the archive controls, the slot derivation and census, the two-event
population, the bug with its truth table, and what is deliberately not done. Indexed in
`research/INDEX.md` (header recount: 39 files / ~25,050 lines). `docs/scoring.md` corrected: it
listed "Circles' undated `stopped()`" among the protocols that erase an ending, and Circles has no
ending to erase. README gains honest-limit 11.

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–19, still
   the only *real* red in the suite, still Hugo's call.
2. **Pin Passport's attester** — iteration 19's next-step 3, untouched and still the cheapest
   remaining correctness item. `passport-and-linea-lapsed-credentials.md` §6 question 1: the
   probe's authority model rests on only EAS being able to write to the resolver, and the EAS
   record already read for the window hands us the attester (`0x84382998…dB1a`) for free.
3. **Ask whether any other adapter's index flag can retire a credential the chain still honours.**
   That is the shape of this iteration's bug stated generally, and Circles was found by accident
   rather than by looking. `pohIndexRead` maps `ended: Boolean(row.revoked)`, which *is* a real
   revocation, so PoH is fine — but the audit is one grep and has never been done deliberately.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands.

**Worth keeping, because it generalises.** Iteration 18's lesson was *a getter that hides a value
is not a chain that has lost it*; iteration 19's was *when a read is bounded, write down the
predicate the bound enforces*. This one is the third face of the same die: **a getter can answer
truthfully about the wrong subject.** `stopped(_human)` validates its argument and then reads
`msg.sender` — it never errors, never returns nonsense, and is wrong about almost every address you
could pass it. The rule for the next adapter: when a getter takes an argument, check that the
answer actually *moves* with it. One call with a second `from` would have caught this in ten
seconds, and nothing short of that would have caught it at all.

The other one is about our own design. **The safest storage read is one the contract publishes a
predicate over.** Iteration 18 made a `private` slot safe by requiring the record to name the
subject; here `isHuman` *is* `lastMintTime > 0`, so the chain audits our arithmetic on every single
call and a moved layout produces silence by construction. When you must reach past a getter, look
first for a getter that reads the same word — that is a free, permanent, self-updating test.

And the smaller one: **an index flag named after an event is not a fact about a credential.**
`stopped` faithfully recorded a `Stopped` event; the error was one layer up, in deciding that
`Stopped` meant *ended*. The mapping was right and the meaning was wrong, which is why no amount of
testing the subgraph would have found it.

**Blocked:** nothing new. Carried: iteration 15's ontology/registry drift (Hugo), iteration 19's
root-owned `.git` objects (`git add` and `git commit` both worked this iteration — the object
hashes did not land in `f5`/`fe` — so the lottery is still running and the fix is still needed),
and iteration 1's two notes, `pnpm-lock.yaml` untracked beside a tracked `package-lock.json` and
`MISSION.md` pointing at a `./test.sh` that lives at `apps/demo/test.sh`.

## Iteration 21 — 2026-07-25

**Did:** iteration 19's next-step 3 / iteration 20's next-step 2 — **pin Passport's attester**. It
was the cheapest remaining correctness item and it did not want the fix the queue proposed.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests in `as-of.live.test.ts` are red and nothing
else is. MORNING "Needs you" item 18 stands, unchanged for a seventh iteration.

**The queue said "pin it the way Holonym's issuer is pinned". A constant would have been wrong.**
The Passport probe reads one mapping and derives everything from it, so its whole authority model
was one unverified sentence: *a cached score is Passport's, or it is nobody's*. The resolver
enforces that itself, on two independent grounds, and publishes both anchors as public getters:

```solidity
function attest(Attestation calldata a) external payable whenNotPaused onlyAllowlisted {…}
function _attest(Attestation calldata a) internal { if (a.attester != address(_gitcoinAttester)) revert InvalidAttester(); … }
```

- **Moved one axis at a time, with a control.** `eth_call` to the live resolver on Optimism: from a
  stranger with Passport's attester → revert `0x06fb10a9` `NotAllowlisted()`; from the EAS the
  resolver names, with a stranger as attester → `0xb8daf542` `InvalidAttester()`; from EAS with
  Passport's attester → **accepted**. The third row is not optional — without it the two reverts
  prove only that the contract reverts, which a contract that reverts unconditionally also does.
- **Nothing hard-coded, because the addresses are not one address.** The attester, the EAS and both
  score schemas are read from the resolver at run time. There are **five distinct attesters across
  the seven deployments** (`0x84382998…dB1a` Optimism, `0xCc90105D…F422` Base/Scroll/Shape,
  `0x7848a357…0475` Arbitrum, `0xBC778313…10A2` Linea, `0x2B5D97CB…83cC` zkSync Era) and three
  distinct EAS instances. A table of constants would have been five chances to be wrong about
  somebody's identity, going stale in silence. Same discipline as `Decoder.gitcoinResolver()`.
- **Three outcomes, and the asymmetry is the whole design.** `verified` → the credential stands and
  `detail.attestation` names the uid. `rejected` (a record exists and contradicts) → **`held: false`**
  with both keys named, that chain dropped and the choice made again over the rest, so one disowned
  record cannot hide a genuine passport on another chain. `unchecked` (we could not look) → the
  credential stands, note `issuer-check-unavailable` → caveat `credential-issuer-unverified`. That is
  the rule at the top of `adapters/index.ts` applied one level up from presence: an RPC blip deciding
  somebody is not a person is the same defect in the same direction. `unchecked` also has an innocent
  cause worth naming rather than punishing — Passport rotating a schema leaves the old uid filed
  under a key we no longer ask about.
- **Which record to judge had to be decided, not assumed.** Passport files a uid per schema and mints
  under two, so a subject who moved from the legacy score to score-v2 has two on file and only one
  describes the struct we read. The resolver copies `attestation.time` verbatim into the cache, so
  `time` is the discriminator. Judging the wrong one would have rejected a real passport.
- **The deployed implementation is the source it claims to be, checked rather than assumed.**
  `0x2999Ef5C…79dC`'s bytecode yields **34 `PUSH4` selectors and all 34 are accounted for** by
  `passportxyz/eas-proxy`'s `GitcoinResolver.sol`, none left over. It has **no `onAttest`** at all —
  it implements the older `attest(Attestation)` shape — which is why iteration 19's open question,
  phrased against `onAttest`, had nothing to look up.
- **Fixed a live-test defect of exactly the shape iteration 19 found.** `findCurrentMinter()` wrapped
  `getLogs` but not the `getBlockNumber` before it, so a drpc rate limit threw uncaught and failed an
  assertion about Passport rather than reporting an unreachable source. It now prints the refusal and
  returns `undefined`, and the search is memoised — three tests want a minter and the endpoint that
  serves that filter is free-tier.
- **Measured, not waved at:** three probes on one adapter instance across seven chains went
  **407/165/156 ms → 865/255/374 ms**. ~100–200 ms of warm latency, the largest single cost this
  adapter has taken on, and worth stating rather than rounding to "negligible".
- **Shape's `defaultCommunityId` is 335, not 0** — the one deployment where a non-default community
  exists, so a subject scored under another community there is invisible to us *and to the Decoder*.
  Coverage, not correctness, and written down rather than discovered later.

**Verified:** on this box, at this commit.

- `PATH=$HOME/.foundry/bin:$PATH forge test` → **18 passed; 0 failed**.
- `cd packages/sdk && npm test` → `# tests 506 # pass 504 # fail 2 # skipped 0` (**+13** over
  iteration 20's 493: 9 unit on `judgeBackingAttestation`, 4 live). The 2 failures are iteration
  15's registry-drift pair, unchanged and untouched. Against Studio's `version/latest` rather than a
  pinned version, 4 more in `live.test.ts` go red on a free-tier `Too many requests`; they are
  **19/19 green against v0.0.3**, and `git stash` confirmed the same 4 fail without this commit — so
  quota, not code.
- `node --test src/adapters/human-passport.live.test.ts` → **12/12, 0 skipped**, three consecutive
  runs. `human-passport.test.ts` → **18/18**, no network.
- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**;
  Playwright **13 passed**.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6178 over 6 roots** / DENY naming the sibling /
  DENY `a fleet of 27 agents is still one human`. Unchanged from iteration 20 — a passport that
  verifies is a passport that scores exactly as it did.
- End to end on `0xb0812e00…90F2`: the lapsed window is unchanged (`issuedAt` 1740958699,
  `heldUntil` 1748734699) and now carries
  `attestation: {uid: 0x29896d05…4b31, attester: 0x84382998…dB1a, verified: true}`.
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") is the three-row simulation, re-derived every run with the EAS
  and the attester both read out of the resolver in the same run. Beside it: **the same real
  attestation judged twice** — verifying against the attester the resolver enforces and rejected
  against a stranger, which is how we know the check discriminates rather than passing everything
  that happens to be on chain; and a test that the seven deployments really do name different
  attesters, so the argument against a constant table is asserted rather than remembered.

**Committed:** `d952da5` feat(sdk): a cached Passport score is Passport's or it is nobody's, and now
we check. (`git commit` worked this time — iteration 19's root-owned-`.git` lottery did not bite.)

**Write-up:** `research/protocols/passport-attester-pin.md` — the selector census, the source with
both gates quoted, the three-row experiment with its control, the seven-chain address table, the
three verdicts, everything refused and why, the cost table, and the residual. Indexed in
`research/INDEX.md` (header recount: 40 files / ~25,300 lines). Open question 1 of
`passport-and-linea-lapsed-credentials.md` struck through and answered. README gains honest limit
12 and a paragraph under Human Passport; its test-count paragraph was two iterations stale (it
claimed 506 total when 506 is now the SDK alone, and still described three skips waiting on a
subgraph that landed in iteration 20) — corrected to 537 exist / 535 pass.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this changes
what we are willing to believe about a credential, not what one is worth. `human-passport`'s `notes`
gained the facts (an off-chain field; `setAdapter` does not carry it). Registry stays as the chain
has it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–20, still the
   only *real* red in the suite, still Hugo's call.
2. **Ask whether any other adapter's index flag can retire a credential the chain still honours** —
   iteration 20's next-step 3, untouched. That is iteration 20's bug stated generally, and Circles was
   found by accident rather than by looking. `pohIndexRead` maps `ended: Boolean(row.revoked)`, which
   *is* a real revocation, so PoH is probably fine — but the audit is one grep and has never been done
   deliberately.
3. **Ask the same authority question of the adapters that have not been asked it.** This iteration
   asked "who may write this record" of Passport and got a real answer. Coinbase's EAS attestation on
   Base and World's `WorldIDAddressBook` have never been asked it; PoH v1/v2 and Circles are
   permissionless registries where the question is different but not absent. §6 of the new write-up
   has the two cheapest follow-ups for Passport itself: `owner()` on each of the seven resolvers
   (which bounds the residual precisely — a multisig and an EOA are very different answers), and
   whether `GitcoinAttester.verifiers` is one key.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read appears.
   Iteration 7's measurement stands: neither leaves per-holder state on any chain.

**Worth keeping, because it generalises.** Iteration 20's lesson was *a getter can answer truthfully
about the wrong subject; check that the answer moves with the argument*. This iteration is that
lesson used deliberately instead of learned by accident, and it wants one addition: **when you move
an argument to prove a gate exists, you also need the row where it opens.** Two reverts prove
nothing on their own — a contract that reverts unconditionally produces the same two. The control is
the assertion; the failures are the setup.

The other one is about how the queue said to do this. The task was written as *pin the attester
address*, and doing that would have shipped seven constants, five of them different, all silently
rotatable. **When a protocol already enforces the thing you want to check, the fix is to read what
it enforces, not to copy the value into your source.** The address was right there in iteration 19's
notes, which is exactly what made the wrong fix so easy — a verified constant is still a constant.

**Blocked:** nothing. Nothing new for Hugo this iteration; MORNING is untouched. Carried: iteration
15's ontology/registry drift (Hugo), iteration 19's root-owned `.git` objects (still a ~1-in-128
lottery per commit; did not bite this time), and iteration 1's two notes, `pnpm-lock.yaml` untracked
beside a tracked `package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at
`apps/demo/test.sh`.

## Iteration 22 — 2026-07-26

**Did:** iteration 20's next-step 3 / iteration 21's next-step 2 — **the index-flag audit**. It was
written down as "one grep", and the grep was the cheap half. Asking the question in both directions
turned up a live defect with a hundred times the population of the Circles one it was modelled on.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests in `as-of.live.test.ts` are red and nothing
else is. MORNING "Needs you" item 18 stands, unchanged for an eighth iteration.

**The flag we went looking for is faithful, and empty.** `pohIndexRead` maps
`ended: Boolean(row.revoked)`, and `revoked` is set by `handleHumanityRevoked`. The deployed
implementation (`0x85b88E38…3F52`, verified source via Blockscout) emits `HumanityRevoked` at
exactly the two sites that do `delete humanity.owner` — `executeRequest` L1170 and `rule` L1347 —
while `revokeHumanity`, the *request*, emits `RevocationRequest` instead. So the event is the
ending and not the intention to seek one. Proved by moving one block around the registry's **only**
revocation (topic-filtered sweep over the proxy's whole life, 35,846,827 → 47,390,471):

| | Gnosis block | `owner` | `pendingRevocation` | `nbRequests` |
|---|---|---|---|---|
| before | 41,268,458 | `0xCF3c78a7…9e70` | **true** | 2 |
| **the log** | **41,268,459** (2025-07-25T14:15:20Z) | `0x0` | false | 2 |
| head | 47,390,676 | `0xeb31c98C…5b4C` | false | 3 |

The head row is the rest of the story: that humanity was **claimed again** by another address, so
`handleHumanityClaimed` set `revoked = false`, and **0 of 1,576 indexed humanities carry the flag
today**. The mechanism designed to carry PoH's endings has an empty population.

**The defect is the other direction, and it is ours.** A PoH v2 humanity ends three ways.
`isHuman` is `owner == account && block.timestamp < expirationTime`, so it ends by **revocation**
(indexed), by **expiring** — which emits nothing at all, so no mapping could hear it — and by
**leaving the chain**: `ccDischargeHumanity` clears the owner and emits
`HumanityDischargedDirectly`, which our `subgraph.yaml` does not register. That is not a historical
curiosity: **33 all-time, 25 of them since 2026-05-16**, against 9 grants in. Two humanities appear
in both lists, so the credential bounces between instances.

**Census, every humanity our index holds, through Multicall3 at one pinned block (47,390,676):**

| state at head | count | our index says |
|---|---:|---|
| live | 1,359 | held |
| expired, owner still set | 21 | held |
| owner cleared | 193 | held |
| owner is another address | 3 | held |
| flagged `revoked` | **0** | — |

**217 of 1,576 — 13.8% — are not held on chain and carry no ending in the index**, 31 of them with
a year of term still to run (the signature of a discharge rather than a lapse). At chain head that
costs nothing: `reconcile.ts` gives the chain the deciding vote and the chain said no for all 217.
The exposure was `chain.unavailable` — an RPC blip, a rate limit, or an adversary with a reason to
arrange one — where the reconciler fell back to the index, and the index said *held*, with
`claimObserved: true` and a real claim date. On `poh-v2`'s Ramp at a 365-day half-life a two-year
claim prices at 0.75 of the adapter's full weight, so a subject collected a whole trust root for a
credential they moved to another chain in May. Same shape as iteration 20's Circles bug, opposite
direction, ~100× the population.

**The fix is one predicate with a real justification on each side.** `IndexView` now carries
`observesEveryEnding` beside `completeHistory` — different questions with the same failure mode:
one is how far *back* an index reaches, the other is which transitions its mapping handles. On the
one branch where nothing can check the index, an index without it is excluded as **unreadable**
(`held: false` + `error` + note `index-cannot-see-endings` + caveat) rather than counted or denied.
Three decisions inside that:

- **Declared per mapping, in `subgraph.ts`, not asked of the endpoint.** An index cannot report the
  events it does not handle, so asking it is asking the wrong witness.
- **It applies to `ended: true` as well.** An index that misses endings misses the re-grants that
  undo them — a revoked humanity can be granted again from another instance without our mapping
  hearing — so its ending is no more checkable than its silence.
- **The result is an error, not a negative.** Same weight either way; the difference is that a
  subject who loses a trust root to *our* RPC failing is told so. `MISSION.md`'s adapter rule 5
  read in both directions.

**Circles goes the other way, and that is what makes it a rule rather than a switch.** `isHuman` is
`lastMintTime > 0` and nothing ever writes that word back down (iteration 20), so there is no
ending to miss and the index's word survives a failed chain read unchanged.

**The rest of the audit, since it had never been done deliberately:** the Circles vendor indexer
(`rpc.aboutcircles.com`) supplies `trustedBy` only and a failure leaves it absent — it cannot touch
`held`; Coinbase reads the EAS predeploy and Coinbase's own on-chain indexer, the `easscan.org`
dependency having been removed earlier; Linea PoH enumerates the registry itself and consults the
Verax subgraph only in tests; the registry subgraph reconstructs weights, not credentials. Human
Passport, Holonym, Farcaster, World and PoH v1 read chain state only. **No other adapter has a
non-chain source in its answer.**

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**:
  forge **18 passed**; sdk scoring **35 pass**; sdk live **21 pass, 0 skip, 0 fail**; Playwright
  **13 passed**.
- `cd packages/sdk && npm test` → `# tests 517 # pass 514 # fail 2 # skipped 1` (**+11** over
  iteration 21's 506: 6 reconcile, 3 subgraph, 2 live). The 2 failures are iteration 15's
  registry-drift pair, unchanged and untouched. The 1 skip is a Coinbase live test whose Base
  endpoint refused the `Attested` log filter — an unreachable source, not a fault in the mechanism.
- `node --test src/live.test.ts` → **21/21, 0 skipped** against v0.0.3.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6178 over 6 roots** / DENY naming the sibling /
  DENY `a fleet of 27 agents is still one human`. Identical to iterations 20 and 21, which is the
  point: nothing at head was ever wrong, so nothing at head moved.
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") is *"a humanity that left the chain is held in our index and
  gone from the registry"*: a discharge sampled from the chain's own logs at run time, required to
  have its owner cleared **and** its term still running so it cannot be an expiry, then held
  against the index (entity present, `ended: false`, `observesEveryEnding: false`) and pushed
  through the reconciler with the chain unreadable, where it must come back excluded and named.
  Beside it, the revocation transition above — the log re-read, and both sides of the state change
  re-derived, every run.

**Committed:** `f628c4d` fix(sdk): an index that cannot see an ending may not say a credential is
held. (`git commit` worked; iteration 19's root-owned-`.git` lottery did not bite.)

**Write-up:** `research/protocols/poh-endings-the-index-cannot-see.md` — the three ending paths from
the deployed source, the revocation transition, the discharge sweep with the eight-subject table,
the 1,576-humanity census, the rule and its three decisions, the full audit table of every non-chain
source in the repo, what is deliberately not done, and three open questions. Indexed in
`research/INDEX.md` (header recount: 41 files / ~25,550 lines). `docs/scoring.md` gains the rule
beside the coverage one it is easily confused with; README gains honest limit 13 and its test-count
paragraph is re-stamped (548 exist / 546 pass).

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this changes
who is allowed to answer when the chain cannot, not what anything is worth. Registry stays as the
chain has it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–21, still
   the only *real* red in the suite, still Hugo's call.
2. **`nbRequests == 0` at head.** Open question 1 of the new write-up, and the sharpest remaining
   correctness item. `closeLapsedHumanityWindow` refuses to derive a start from
   `expirationTime - humanityLifespan` for a humanity this contract never resolved a request for —
   the measurement in `poh-lapsed-credentials.md` §2.4 puts the error at −215.5 and +144.7 days —
   and the **head** path does the same subtraction with no guard and no caveat. Nine humanities
   arrived by cross-chain grant; whether any is held today is unmeasured. The honest answer may be
   that the derived date *is* the origin instance's claim date, which is a real date for the same
   human — which is exactly why it should be decided rather than left implicit.
3. **Index the two cross-chain events** (`HumanityGrantedDirectly`, `HumanityDischargedDirectly`)
   and give `PohHuman` an `expirationTime`. That is what would earn PoH `observesEveryEnding: true`
   and hand the degraded path back — a mapping change, a schema field and a ~2.5-hour resync.
   Deliberately not queued ahead of the fix: two of three endings handled still may not answer
   alone, so the resync buys a better index and not a different rule.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands.

**Worth keeping, because it generalises.** Iteration 20's lesson was *an index flag named after an
event is not a fact about a credential*. This iteration is that lesson asked about the events that
are **not** in the mapping, and it wants a sharper form: **an index's silence is only as strong as
the set of events it handles, and that set is not something the index can tell you.** Coverage
entities, `_meta` blocks and sync status all describe how far back an endpoint reaches; none of
them describes what it listens for. So the completeness question splits in two, and we had been
answering only one of them since iteration 1.

The other one is about how the audit was scoped. The queue said *can an index flag retire a
credential the chain still honours* — a one-directional question, inherited from the bug that
prompted it. Reading it that way, the audit closes in ten minutes with "PoH's flag is fine". The
defect was in the direction nobody had thought to ask about, and it was larger. **When a past bug
turns into an audit item, widen the question before running it**: the shape that bit you once is
the shape you will look for, and the same mechanism usually fails both ways.

**Blocked:** nothing. Nothing new for Hugo; MORNING is untouched. Carried: iteration 15's
ontology/registry drift (Hugo), iteration 19's root-owned `.git` objects (still a ~1-in-128 lottery
per commit; did not bite this time), and iteration 1's two notes, `pnpm-lock.yaml` untracked beside
a tracked `package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at
`apps/demo/test.sh`.

## Iteration 23 — 2026-07-26

**Did:** iteration 22's next-step 2 — **`nbRequests == 0` at head**. It was queued as "decide what
the derived date means for a cross-chain grant", and the decision turned out to be that the
discriminator was wrong, the date was wrong for most of the population, and both had a better
answer sitting in the registry's own logs.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests in `as-of.live.test.ts` are red and nothing
else is. MORNING "Needs you" item 18 stands, unchanged for a ninth iteration.

**Every PoH score rests on one subtraction, and it has a premise nobody had checked.**
`expirationTime - humanityLifespan()` recovers the claim second, exactly, because both local
writers do `expirationTime = block.timestamp + humanityLifespan` (`executeRequest` L1176, `rule`
L1358). There is a third writer:

```solidity
function ccGrantHumanity(bytes20 _humanityId, address _account, uint40 _expirationTime)
    external onlyCrossChain returns (bool success) {
    …
    humanity.expirationTime = _expirationTime;        // copied, not computed
    emit HumanityGrantedDirectly(_humanityId, _account, _expirationTime);
```

Swept the whole life of the proxy (35,846,827 → 47,390,776; the full range in one request,
339 ms) and traced each grant back to mainnet. **Nine imports, ever. Seven came from PoH v1**, and
v1's `submissionDuration()` is **63,115,200 s against this contract's 31,557,600** — every one
reproducing `submissionTime + submissionDuration` to the second, so the attribution is a proof and
not a resemblance.

| origin | count | what our subtraction did |
|---|---:|---|
| PoH v1 mainnet (term 63,115,200) | **7** | landed **exactly one v2 lifespan — 365.25 days — after the true registration** |
| PoH v2 mainnet (term 31,557,600) | 2 | right, by luck rather than by argument |

A two-year-old credential reported as a one-year-old one: 0.75 of the adapter's weight on a
365-day Ramp where 0.875 was earned. **Wrong in the subject's disfavour**, which is the safe
direction and is probably why it survived twenty-two iterations — and it is also the direction that
makes an as-of query about a real day in that first year answer "not held".

**`nbRequests` was the wrong question.** The lapsed path already refused to date `nbRequests == 0`,
which is sound — no local request, so this contract cannot have written the expiry. It is also
**incomplete**: `requests` is only ever pushed to, `ccDischargeHumanity` does `delete humanity.owner`
alone, so a humanity leaves and comes back over an intact history. **3 of the 9 imports carry
`nbRequests >= 1`, two of them held at head today.** One of the three, `0xe7f13052…79bc`, arrived
from v1 in 2024-09 and was **renewed here in 2025-07**, which moved the expiry and left
`nbRequests` at 1 — so the existing `nbRequests > 1 → renewed` flag called a renewal a first claim.
And the test can only ever *withhold* a date; it has nothing to put in its place.

**The chain publishes the answer.** `HumanityGrantedDirectly(bytes20 indexed, address indexed,
uint40)` carries the exact expiry it wrote and is immutable. Three states from one comparison
against storage: a grant carrying **this** expiry → foreign; a grant carrying a **different** one →
this contract wrote over it, which is a renewal whatever `nbRequests` says; no grant → ours. Nine
logs over 22 months, so one memoised sweep answers it for every subject. Then the origin instance
still publishes the registration behind the expiry, and *that* is the date — two mainnet calls, paid
only for the ≤9 humanities the sweep has named, and required to reproduce our expiry **to the
second** before it is believed.

**Three decisions inside the rule.**

- **An age crosses the bridge; a window does not.** `purpose: 'age'` asks how long this human has
  held the credential — the answer is the origin's registration. `purpose: 'window'` asks which
  instants *this* registry honoured the humanity for, which is what an as-of score turns into "held
  on Gnosis", and that cannot begin before the grant. Handing the origin's date to an as-of query
  would restore a Gnosis credential for a Tuesday when the registration was still on mainnet: the
  same fact about the human, a false statement about this adapter.
- **A sweep that did not answer is not a sweep that found nothing** — the same distinction
  `IndexView.entity: null` draws, in a second place. `term-origin-unverified` keeps the date and
  names the assumption it stands on, and the sweep is memoised **on success only**, so a rate limit
  is a moment rather than a property of the run.
- **One proof survives with no network at all.** No local write can put an expiry more than one
  full term past the block we read at, so an expiry that does is imported — or `humanityLifespan`
  has moved, in which case the subtraction is equally void and the same refusal is right.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**:
  forge **18 passed**; sdk live **22/22, 0 skipped, 0 failed**; Playwright **13 passed**.
- `cd packages/sdk && npm test` → `# tests 533 # pass 531 # fail 2 # skipped 0` (**+16** over
  iteration 22's 517: 11 unit on `classifyHumanityTerm`/`dateHumanityFromTerm`, 4 on the lapsed
  path, 1 live). The 2 failures are iteration 15's registry-drift pair, unchanged and untouched.
  Re-run twice more at HEAD: `530 pass / 2 fail / 1 skipped` both times, the skip being iteration
  22's Coinbase live test whose Base endpoint refuses the `Attested` log filter — it varies run to
  run, so the honest figure is **530–531 pass with 0–1 skip depending on whether Base answers**.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6178 over 6 roots** / DENY naming the sibling /
  DENY `a fleet of 27 agents is still one human`. Byte-identical to iterations 20–22, which is the
  point: nothing at head was wrong for that subject, so nothing at head moved.
- **Cost, measured rather than waved at:** cold probe 293 → 692 ms (the sweep plus nine block
  headers), warm probes 144/149/159 ms against 147/159 before — unchanged inside the noise.
- End to end, four subjects: `0x6687c671…8dd6` went from `heldUntil` and **no start at all** to a
  closed window `2024-09-06 → 2026-01-29` carrying `originRegisteredAt` 2024-01-30; `0x000bba72…2dbe`
  keeps its date and gains `termOrigin: poh-v2-mainnet`; `0xe7f13052…79bc` gains `renewed: true`
  where `nbRequests` could not see it; an ordinary local claim is unchanged at 1783963510.
  **Six previously undatable lapsed windows are now closed and dated.**
- **The acceptance test the mission asks for** ("a live test that hits the real chain and asserts
  the mechanism, not a magic number") re-derives every number each run: the grant log is swept from
  the chain, one import whose expiry is *still* the granted one is picked out of it, PoH v1 is
  required to reproduce that expiry exactly, the two terms are asserted to still differ live, and
  the probe is then held to the origin's date — with `assert.notEqual(evidence.issuedAt, naive)`
  spelling out that it must not report the date it used to. Beside it, an assertion straight from
  the chain that an import can land on a humanity with local request history, which is the argument
  against `nbRequests` asserted rather than remembered.

**One live test needed fixing, and the reason is worth recording.** `a humanity that expired is a
closed window, and the claim log is its start` picks the first lapsed humanity the probe can date.
Imported humanities are now datable, so it started picking one and then failed asserting the
registry had logged a claim for it — a true assertion about a subject the test was never about. It
now skips `termImported` candidates. **A fix that widens what can be dated widens what a sampling
test can sample**, and that is a place to look after any change of this shape.

**Committed:** `1c2f7f5` fix(sdk): a term this contract did not set may not have this contract's
term subtracted from it. (`git commit` worked; iteration 19's root-owned-`.git` lottery did not
bite.)

**Write-up:** `research/protocols/poh-imported-terms.md` — the three expiry writers from the
deployed source, the nine-row origin table with every reproduction, the `nbRequests` census, the
rule and its three decisions, the end-to-end before/after, what is deliberately not done, and three
open questions. Indexed in `research/INDEX.md` (header recount: 42 files / ~25,750 lines).
`docs/scoring.md` gains the premise beside the subtraction it qualifies; README gains honest limit
14 and its test-count paragraph is re-stamped (564 exist / 562 pass).

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this changes
which date a credential gets, not what one is worth. Registry stays as the chain has it (32
adapters / revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–22, still
   the only *real* red in the suite, still Hugo's call.
2. **Nothing watches `humanityLifespan()` for a change.** Open question 1 of the new write-up, and
   the sharpest remaining correctness item. Both PoH terms are governance-settable and v1's has
   already moved once (31,557,600 → 63,115,200); a change to *Gnosis's* would silently invalidate
   every locally derived date in the registry, and the only guard is the `dateRejected` floor,
   which catches solely the cases that land before the deployment. The cheap version is a live test
   asserting the term is still what the derivation assumes — the Holonym and World suites already
   do exactly this for their expiries, so it is a pattern in the repo rather than a new idea.
3. **Index the two cross-chain events** (`HumanityGrantedDirectly`, `HumanityDischargedDirectly`)
   and give `PohHuman` an `expirationTime`. Iteration 22's next-step 3, still standing, and now
   worth slightly more: the same sweep this iteration does per process would come from our own
   index, and it is what would earn PoH `observesEveryEnding: true`. A mapping change, a schema
   field and a ~2.5-hour resync.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands.

**Worth keeping, because it generalises.** Iteration 22's lesson was *an index's silence is only as
strong as the set of events it handles*. This one is the same shape aimed at arithmetic:
**a derivation has a premise, and the premise is a claim about the world that can be false.**
`expirationTime - humanityLifespan` was verified against the index on a live registration in
iteration 1 and has been correct every time it was checked — because every subject it was ever
checked against was one this contract claimed. The failing population was 9 of 1,576, invisible to
any spot check, and the thing that made it findable was asking *who else can write this field*.
That is the same question iteration 21 asked of Passport's attester, one level down: not "who may
write this credential" but "who may write the number I do arithmetic on".

The other one is about how the queue framed it. The task was written as *decide what the derived
date means when `nbRequests == 0`* — a question that takes the discriminator as given and asks only
what to do downstream of it. Answered in those terms, the iteration ships a caveat and leaves seven
subjects mis-dated. **When a queue item names the test to change, check whether the test is the
right test first**: `nbRequests` was inherited from a measurement that only ever looked at lapsed
humanities, where it happened to be complete.

**Blocked:** nothing. Nothing new for Hugo this iteration; MORNING is untouched. Carried: iteration
15's ontology/registry drift (Hugo), iteration 19's root-owned `.git` objects (still a ~1-in-128
lottery per commit; did not bite this time), and iteration 1's two notes, `pnpm-lock.yaml` untracked
beside a tracked `package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at
`apps/demo/test.sh`.

## Iteration 24 — 2026-07-26

**Did:** iteration 23's next-step 2 — **nothing watches `humanityLifespan()` for a change**. It was
queued as "the cheap version is a live test asserting the term is still what the derivation
assumes", and a test was the wrong instrument: a tripwire tells you a date moved, it does not tell
you what the date should have been. The contract has been publishing the answer since 2024.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests in `as-of.live.test.ts` are red (the chain has
`human-passport-eas` and `lens-account`, this tree does not) and nothing else is. MORNING "Needs
you" item 18 stands, unchanged for a tenth iteration.

**Every PoH v2 date is one subtraction with two premises, and only one had been checked.**
Iteration 23 checked *whose* term: `ccGrantHumanity` copies expiries settled elsewhere, so the
subtraction is arithmetic about a contract we did not read. The second premise sits in the same
line and is about *which* term — `humanityLifespan()` is read at **head**, while the expiry was
written at some past block:

```solidity
function changeDurations(uint40 _humanityLifespan, …) external onlyGovernor {
    humanityLifespan = _humanityLifespan;              // and nothing writes any stored expiry
    …
    emit DurationsChanged(_humanityLifespan, …);
```

A change leaves every `expirationTime` in storage alone and moves only the number we subtract from
it. So one governance transaction shifts **every derived date in the registry at once**, in the same
direction, by the full size of the change, with nothing positioned to notice — and on `poh-v2`'s
365-day Ramp that is a whole cohort re-priced because a knob turned.

**It is this protocol's own history, not a scenario.** PoH **v1**'s `submissionDuration` has already
moved, 31,557,600 → 63,115,200, and v1's `changeDurations` (L563-568 of the verified source) emits
**nothing at all**. v2's authors added the event v1 lacked. The only reason it was not being read is
that nobody asked.

**Swept both instances over their whole lives. Zero logs, ever.**

| instance | range | logs | wall | `humanityLifespan()` at head |
|---|---|---:|---:|---:|
| Gnosis `0xa4AC94C4…57bc` | 35,846,827 → 47,391,312 | **0** | 124 ms | 31,557,600 |
| mainnet `0xbE983409…480A` | 20,685,061 → 25,613,069 | **0** | 95 ms | 31,557,600 |

Both served the full range in a single `eth_getLogs`. **Zero is the strongest answer available, not
the weakest**: `changeDurations` is the only writer after `initialize`, so with none ever emitted
head's value *is* the value the contract launched with, and every PoH date since 2024 rests on a
checked fact instead of a hope. Nothing at head moved — which is the point.

**The rule solves for the era rather than assuming one.** `readTermHistory` turns the sweep into
half-open eras `[from, until)` — half-open because a change takes effect in the block it is mined
in and a claim resolved in that block is written under the new value. `termForLocalExpiry` then
solves `expirationTime = claimedAt + term(era)` for the era `claimedAt` lands in. With one era it
*is* the deployment-floor guard the probe already had. With more it does what a tripwire cannot: it
dates the change, so each cohort is dated with the term that was in force for it rather than every
date being thrown away. Three refusals, each a different fact — two eras that both explain an expiry
(`termAmbiguous`, reachable with a term shortened by two days), only the era `initialize` never
published (`termEraUnpublished`), and no era at all (`dateRejected`, generalising both old guards
into one statement).

**Three decisions inside it.**

- **A sweep that did not answer is not a sweep that found nothing** — the `IndexView.entity: null`
  distinction in a third place. Memoised on success only, falls back to head's term assumed eternal,
  and the date carries `term-origin-unverified`. A caller who supplied *no* history is a different
  case and is told nothing: nobody asked, so no check was skipped.
- **A sweep that cannot explain head has not answered.** If the newest logged value differs from
  `humanityLifespan()` at head, something other than `changeDurations` wrote the field, and the
  timeline the logs build is wrong however real the logs are. Reported exactly as an unreachable
  node is. This is what makes `observed: true` mean something.
- **A known era beats the unpublished first one rather than tying with it.** That era can be
  assigned a term to fit *any* expiry, so treating it as a rival would make every date unrecoverable
  the moment a governor touched the field once.

**Mainnet gets the same check; v1 needs none, and the asymmetry is the interesting part.** PoH v2 on
mainnet publishes only an expiry, so its date is the identical subtraction and now gets the
identical timeline (swept once, on the first import a process sees, never for a subject with none).
PoH v1 publishes `submissionTime` directly and uses its term only to *check* an equality — so a
change there costs the match and therefore the date. Degradation, never a wrong answer. The instance
whose term actually moved is the one that needed no fix.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**:
  forge **18 passed**; sdk live **23/23, 0 skipped, 0 failed**; Playwright **13 passed**.
- `cd packages/sdk && npm test` → `# tests 551 # pass 549 # fail 2 # skipped 0` (**+18** over
  iteration 23's 533: 17 unit in a new `poh-lifespan.test.ts`, 1 live). The 2 failures are iteration
  15's registry-drift pair, unchanged and untouched.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6177 over 6 roots** / DENY naming the sibling /
  DENY the fleet. Iterations 20–23 recorded 3.6178; **measured at the parent commit too and it is
  also 3.6177**, so the last digit is a Decay curve moving with the clock and not this change.
- End to end on live subjects: an ordinary local claim still dates to `expirationTime - 31557600`
  exactly (`0x4e6654f3…1f05`, 1816580105 − 31557600 = 1785022505) with no extra note and no
  `termAtClaim`; the imported `0x6687c671…8dd6` is unchanged at `2024-09-06 → 2026-01-29` with
  `termOrigin: poh-v1-mainnet`.
- **Cost, measured against the parent commit rather than estimated** (four probes per process, two
  processes each): cold 447/566 → 558/583 ms, warm 193–231 → 200–292 ms. One extra request per
  process, none warm; the warm spread is noise on an unchanged path.
- **The acceptance test** re-derives every number each run — the term at head, the head block and
  the whole log set come off the chain — and asserts *mechanism*: that the timeline explains head,
  that it starts at the deployment, that its eras leave no gap, and that every boundary is the
  timestamp of its own block. All of those stay true on the day a change lands. The
  `assert.equal(lifespan, 31_557_600)` it replaces did not.

**Committed:** `a5873bb` fix(sdk): the term we subtract was read at head, and the expiry was written
in the past. (`git commit` worked; iteration 19's root-owned-`.git` lottery did not bite.)

**Write-up:** `research/protocols/poh-lifespan-timeline.md` — the three writers of the field from
the deployed source, the v1 contrast, both sweeps with their ranges and timings, the era rule and
its three decisions, the mainnet/v1 asymmetry, the measured cost table, what is deliberately not
done, and three open questions. Indexed in `research/INDEX.md` (header recount: 43 files / ~25,940
lines). `docs/scoring.md` gains the second premise beside the first, which is easily confused with
it; README gains honest limit 15 and **closes limit 14's open clause**, which said in as many words
that a change to Gnosis's term would silently invalidate every locally derived date.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this decides
which date a credential gets, not what one is worth. Registry stays as the chain has it (32 adapters
/ revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–23, still
   the only *real* red in the suite, still Hugo's call.
2. **Ask the same question of the other adapters.** Open question 2 of the new write-up. Holonym and
   World both read an expiry and both have a live test pinning the term — but a pin is a tripwire,
   not a timeline, and whether either protocol publishes its changes has not been asked. This is
   iteration 22's ending audit and this iteration's term audit aimed at a third mechanism, and the
   pattern says the answer will differ per protocol rather than being uniformly fine.
3. **Index the two cross-chain events** (`HumanityGrantedDirectly`, `HumanityDischargedDirectly`)
   and give `PohHuman` an `expirationTime`. Iteration 22's next-step 3 and iteration 23's next-step
   3, still standing: it is what would earn PoH `observesEveryEnding: true` and would move both
   per-process sweeps into our own index. A mapping change, a schema field, a ~2.5-hour resync.
4. **World's Selfie and document tiers in the score**, if and only if a permissionless read
   appears. Iteration 7's measurement stands.

**Worth keeping, because it generalises.** Iteration 23's lesson was *a derivation has a premise,
and the premise is a claim about the world that can be false*. This is the same subtraction, and the
finding is that **it had two premises, and finding one of them made the other harder to see**. The
grant sweep answered "whose term is this?" so completely that the line read as settled — but "whose"
and "which" are different questions about the same expression, and the second one had been sitting
in `humanityLifespan()`'s parentheses the whole time. *Checking one premise of an expression is
evidence that the expression has premises, not that you have found them all.*

The other one is about the shape of the fix, and it is the more useful. The queue asked for a
**tripwire** — "a live test asserting the term is still what the derivation assumes" — and a
tripwire would have been cheap, correct, and the wrong instrument. It fires *after* the term moves
and it has nothing to put in place of the broken date; every PoH date would go red at once and the
only remedy would be to hard-code a new number. Reading the same governance action as **data**
instead of as an alarm costs about the same and produces a timeline that keeps dating credentials
correctly through the change. **When the queue asks for a tripwire, check whether the event it
watches is one the chain publishes** — if it is, the alarm and the repair are the same read.

**Blocked:** nothing. Nothing new for Hugo this iteration; MORNING is untouched. Carried: iteration
15's ontology/registry drift (Hugo), iteration 19's root-owned `.git` objects (still a ~1-in-128
lottery per commit; did not bite this time), and iteration 1's two notes, `pnpm-lock.yaml` untracked
beside a tracked `package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at
`apps/demo/test.sh`. One environment note, not a defect: Studio's `poh/version/latest` endpoint was
returning "Too many requests" for the whole session, so every run here pins `poh/v0.0.3`; the
unpinned default makes four live tests skip or fail on quota alone.

## Iteration 25 — 2026-07-26

**Did:** iteration 24's next-step 2 — **ask the term question of the other adapters**. It was queued
as an audit of "Holonym and World, which both read an expiry and both have a live test pinning the
term". The audit's first job was to find out which adapters actually subtract a term at all, and the
answer is two: `poh-v2` (done, iteration 24) and `world-id-orb`. Everything else — PoH v1,
Human Passport, Coinbase, Farcaster, Circles, Linea — reads a real timestamp and has no premise of
this shape. Holonym subtracts a **circuit constant**, not a contract field, which is a different
mechanism and is left open (see below).

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two tests in `as-of.live.test.ts` are red and nothing
else is. MORNING "Needs you" item 18 stands, unchanged for an eleventh iteration.

**World has the identical premise, and its owner can never give it up.** Every World date is

```
issuedAt = addressVerifiedUntil[account] − verificationLength()
```

exact to the second because `verify()` writes `block.timestamp + verificationLength`. The term is
read at **head**; the entry was written in the past. And:

```solidity
function setVerificationLength(uint256 _verificationLength) external onlyOwner {
    if (_verificationLength == 0) revert InvalidConfiguration();
    verificationLength = _verificationLength;          // no stored entry is touched
    emit VerificationLengthUpdated(verificationLength);
}
```

One owner transaction re-dates the whole book at once, in the same direction, by the full size of
the change — and on `world-id-orb`'s Decay curve a **shortened** term makes every World credential
look uniformly fresher, which is the direction that pays an adversary. There is no future in which
this becomes safe by itself: `renounceOwnership` is overridden to `revert CannotRenounceOwnership()`,
so `0xc50b688E…4062` holds the power for as long as the contract exists.

**The thing being replaced was a tripwire, and iteration 24's lesson said to check for the event.**
The live suite asserted `verificationLength() === init.args.verificationLength`. That is a real
check and it cannot repair anything: it fires *after* the term moves, and the plausibility guard
beside it would still accept most of the now-wrong dates, because a change of a few weeks moves a
date by a few weeks and lands it comfortably inside the contract's lifetime. The chain publishes
`VerificationLengthUpdated`, so the alarm and the repair are the same read.

**Swept the whole history. Two logs in the contract's life, zero term changes ever.**

| Block | Date | Event |
|---|---|---|
| 2,711,105 | 2024-08-27 | `WorldIDAddressBookInitialized(… verificationLength 14515200, maxProofTime 604800)` |
| 24,251,140 | 2026-01-08 | `WorldIdRouterUpdated(0xB012Bc9D…65Caa)` |

`VerificationLengthUpdated` has never been emitted; neither has `GroupIdUpdated` nor
`MaxProofTimeUpdated`. So the timeline is one era, `termForLocalExpiry` reduces to exactly the
deployment-floor guard the probe already applied, and **no date at head moves** — the agent demo
still reads 3.6177 over 6 roots.

**Better than PoH's, and the asymmetry is the interesting part.** PoH v2's `initialize` writes
`humanityLifespan` while emitting nothing, so its first era's term is permanently unrecoverable and
an expiry only that era explains stays undated (`termEraUnpublished`). `WorldIDAddressBook`'s
**constructor emits its own term**. So every era of this timeline has a published term, and no
cohort can ever be lost to an unpublished era — a governance change here costs *nothing*, where on
PoH it would cost the pre-change cohort. `era-unknown` is unreachable on this contract and handled
anyway, because a contract that stops emitting is a deployment change and not a code change.

**The sharp edge was the endpoint, not the contract — and it is the finding worth keeping.**
`worldchain-mainnet.gateway.tenderly.co` is the one keyless World Chain log endpoint (`agentbook.ts`
has the survey). Over this contract's 30.1M-block history it answers a full-range query with
HTTP 200 and a **silently incomplete subset, and not the same subset twice**. Measured, identical
queries back to back:

| Query | Result |
|---|---|
| five governance topics, full range | `[24251140]` four runs out of four — the constructor dropped |
| two topics, full range | `[2711105]` on one run, `[]` on the next four |
| no topic filter, full range | 980 logs, all from the last 2,046 blocks |

Chunked it is exact and stable: 16M / 8M / 4M / 2M each return the complete set repeatedly
(721 ms / 1,421 ms / 2,777 ms / 5,620 ms). Default is **8M**, four chunks issued together — half
the largest size measured good, because the margin costs one request and guessing wrong costs a date
nobody would question.

**So a chunk size is a hope, and the sweep carries two checks instead.** Refused outright unless
both hold, and a refused sweep costs a caveat rather than a date:

1. **The constructor's log must be in the result, in the deployment block.** Emitted
   unconditionally, so its absence *proves* the answer is incomplete. This is what catches the
   measured failure mode, and it matters because "no `VerificationLengthUpdated` in the sweep" is
   the *permissive* answer.
2. **The newest term must equal `verificationLength()` at head.** Otherwise something we cannot see
   wrote the field and the timeline is wrong however real its logs are. Catches a drop at the new
   end, which guard 1 cannot.

What neither catches — written down rather than papered over — is a change dropped from the *middle*
of a sweep that also holds a later one agreeing with head. Same residual hole `poh-term.ts` carries.

**Refactor, because a second protocol needed it.** `TermEra`, `TermHistory`, `assumedTermHistory`,
`termForLocalExpiry` and a new shared `buildTermEras` move to `src/term-history.ts`. `poh-term.ts`
re-exports the names every caller already reached through it, so no import anywhere changed.

**One real defect fixed on the way, which the new load surfaced.** Adding a second Tenderly consumer
made `agentbook.live.test.ts`'s "a second chunk size returns exactly the same registrations" fail on
roughly one full-suite run in two — `scanAgentBook`'s canary had **no retry**, so a single rate limit
failed the entire scan. `registrationOf`'s canary has always retried; this was an oversight, not a
distinction. Retried only for a *throw*: an endpoint that answers `[]` successfully is still refused
on the spot, because that is precisely the lie the canary exists to catch. Also collapsed the World
live suite from nine adapter instances (nine sweeps) to one, which is how a process actually uses it.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**:
  forge **18 passed**; sdk unit **35**; sdk live **23/23, 0 skipped**; Playwright **13 passed**.
- `cd packages/sdk && npm test` → **571 tests, 569 pass, 2 fail, 0 skipped** (**+20** over iteration
  24's 551: 11 unit in a new `world-term.test.ts`, 6 in `world.test.ts`, 3 live). The 2 failures are
  iteration 15's registry-drift pair, unchanged and untouched. **Five full runs** after the canary
  fix; the AgentBook flake is gone. One run showed an unrelated one-off on the PoH index path, which
  is the known Studio-quota noise.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6177 over 6 roots** / DENY the sibling / DENY the
  fleet. Identical to iteration 24, which is the point: nothing at head moved.
- **Cost, measured against the parent commit** rather than estimated — same subject, four probes per
  process, two processes each: cold **64–67 → 292–306 ms**, warm **58–62 → 59–63 ms**, subject with
  **no** AddressBook entry **60–61 → 60–62 ms**. The sweep is memoised on success only and asked for
  only when the subject *has* an entry: no entry, no subtraction, no premise to check, and that is
  most subjects.
- **The acceptance test asserts mechanism, not a number.** It re-derives the term, the head block and
  the whole log set each run, and asserts that the timeline explains head, that it opens at the
  deployment block's own header timestamp, that its eras are contiguous and half-open, that every era
  carries a term, and that every boundary is the timestamp of its own block. All of those stay true
  on the day a change lands. The `assert.equal(term, init.args.verificationLength)` it replaces does
  not. A second test re-sweeps at another chunk size and demands the identical timeline; a third
  takes a real verification out of the contract's logs and requires the probe's date to be that
  block's timestamp, with no number written down anywhere.

**Committed:** `4710f40` fix(sdk): World's term was read at head too, and its owner can never give
it up.

**The root-owned `.git` lottery is closed, and it never needed root.** It bit this iteration —
`research/INDEX.md`'s blob hashed into `f5`. Iteration 19 concluded the two root-owned loose-object
directories could not be removed without root and shipped a `git fast-import` workaround. That was
half right: the *files* cannot be unlinked, but **`.git/objects` itself is ours**, and renaming an
entry needs write permission on the *parent*, not on the child. So `f5` and `fe` were renamed aside,
recreated as ours, and the three objects copied in — content identical, `git cat-file -t` answers for
all three, `git fsck` clean apart from pre-existing dangling objects. `git add` and `git commit` then
worked normally and this is an ordinary commit. Two dead root-owned directories remain, ignored by
git because their names are not two hex characters; one `sudo rm -rf` for Hugo, noted in MORNING.

**Write-up:** `research/protocols/world-verification-term-timeline.md` — the setter and the
un-renounceable owner from the deployed source, the tripwire it replaces, the full sweep, the
constructor-emits asymmetry against PoH, the endpoint's non-determinism with every measurement, the
two guards and the hole they leave, the cost table, and a survey of which adapters subtract a term at
all. Indexed in `research/INDEX.md` (header recount: 44 files / ~26,240 lines). `docs/scoring.md`
gains World beside PoH in the second-premise section; README gains **honest limit 16**.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this decides
which date a credential gets, not what one is worth. Registry stays as the chain has it (32 adapters
/ revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–24, still
   the only *real* red in the suite, still Hugo's call.
2. **Can Holonym's ceiling move?** Open question 1 of the new write-up, and the one adapter the term
   audit did not close. `HOLONYM_MAX_CREDENTIAL_TERM_SECONDS` is a *circuit* constant
   (`expiry − iat < 31,536,001`), not a settable slot, so no owner transaction moves it — but the
   Hub could in principle be pointed at a verifier for a circuit with a looser ceiling, and if it
   can be and the change is not published, the bound becomes too *late* and inflates freshness. That
   is an upgrade path rather than a setter, which is a third mechanism and worth a fourth look.
3. **`maxProofTime` is a second unread World term.** `verify()` rejects a proof older than 7 days,
   settable the same way. It enters no date today, but it bounds how stale the underlying Orb proof
   may be at the moment the entry is written — which is a real statement about what our date means.
4. **Index the two PoH cross-chain events** (`HumanityGrantedDirectly`, `HumanityDischargedDirectly`)
   and give `PohHuman` an `expirationTime`. Iterations 22–24's standing next step. Same argument now
   applies to World: both term sweeps are per-process `eth_getLogs` against an endpoint demonstrated
   to truncate, and a subgraph over the governance events would remove that class of bug entirely.

**Worth keeping, because it generalises.** Iteration 24's lesson was *when the queue asks for a
tripwire, check whether the event it watches is one the chain publishes*. This iteration is that
lesson applied where it was already written down — `world-id-onchain-read.md` §2.2 had recorded, in
2026-07-25, that "the owner can change it with `setVerificationLength`" and that a full event scan
found none. The sweep had been *done*; it had just been done **once, by hand, into a document**,
and then compressed into a tripwire in code. **A measurement in a research file is not a check in
the probe.** The gap between "we looked and it was fine" and "the code looks every time and knows
what to do when it is not" is the whole distance travelled here, and it is invisible precisely
because the research was good.

The other one is smaller and more practical: **the endpoint was a bigger risk than the contract.**
The contract's behaviour took twenty minutes to establish from verified source and one sweep. The
endpoint took an hour, because it fails by *answering* — HTTP 200, plausible shape, wrong content,
different content each time. Both guards in this module exist because of the transport and neither
because of World. When a probe reads history rather than state, budget the suspicion accordingly.

**Blocked:** nothing. One new small thing for Hugo (the two dead `.rootowned` directories, folded
into MORNING item 19, which is otherwise now closed). Carried: iteration 15's ontology/registry drift
(Hugo), and iteration 1's two notes, `pnpm-lock.yaml` untracked beside a tracked `package-lock.json`
and `MISSION.md` pointing at a `./test.sh` that lives at `apps/demo/test.sh`. Environment note,
unchanged from iteration 24: Studio's `poh/version/latest` endpoint still returns "Too many requests",
so every run here pins `poh/v0.0.3`.

## Iteration 26 — 2026-07-26

**Did:** iteration 25's next-step 2 — **can Holonym's ceiling move?** The queue's framing was that
`HOLONYM_MAX_CREDENTIAL_TERM_SECONDS` is a *circuit* constant rather than a settable slot, so no
owner transaction moves it, but the Hub could in principle be pointed at a verifier for a looser
circuit. That is the wrong shape of question, and finding out why is the iteration.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two `as-of.live.test.ts` tests are red and nothing else
is. MORNING "Needs you" item 18 stands, unchanged for a twelfth iteration.

**The Hub verifies a signature, not a proof.** There is no verifier contract to point anywhere.
`Hub.setSBT` is, in its entirety:

```solidity
bool success = keccak256(
    abi.encodePacked(circuitId, sbtReciever, expiration, customFee, nullifier, publicValues, block.chainid)
).toEthSignedMessageHash().recover(signature) == verifier;
require(success, "The Verifier did not sign the provided arguments in the provided order");
```

`ecrecover`, against one stored address. No pairing check, no proving key bound to a circuit id, and
`circuitId` is an opaque `bytes32` the signer chooses — as are `publicValues` and the expiry. The
contract's own header says so in its second line (*"accepts a signed attestation from a certain
Verifier that a ZKP has been recieved"*). Our write-up said the date rests on "a proof the Hub
verified before minting" and the SDK's caveat said "the longest term the protocol's **circuit**
permits". Both put the constraint on chain. It is checked off chain, before signing.

**That is a correction, not a downgrade of the credential.** The same signature is the only thing
behind held-or-not *and* behind `publicValues[4]`, the issuer we pin — that is data the signer
supplied too. So the ceiling is trusted exactly as far as the credential itself, and the date stays:
dropping it would leave a `Decay` credential undated, which scores it **higher**. What was wrong was
the sentence we printed to users, and that is what changed.

**Which key, established four ways and then proved.** `verifier` is `internal` — `verifier()` and
`getVerifier()` both revert — so storage is the only read. Slot 8 by the `Ownable, ERC721URIStorage`
layout, and every checkable consequence checked at head: slot 0 == `owner()`, slot 1 decodes to
`"Holonym V3"` == `name()`, slot 9 == 238,713 == the token counter the live suite finds
independently by bisecting `ownerOf`. Then the part that makes it a fact rather than a slot count:
**every mint in the last 150,000 blocks — 76 of them — pulled from the chain's own `Transfer`
logs, its transaction decoded, the digest rebuilt and the signer recovered. One key, 76/76**,
`0x656D1dfb96dBd7620DE0e73FB16d2B169bb8Da01`. It has nonce 0; it only ever signs. Mints arrive via
`HubBatch` `0xef59aC90…ee77` (unowned, permissionless, harmless because the Hub checks the
signature), so a decoder that only knew `setSBT` would find nothing in recent history.

**`changeVerifier` is `onlyOwner`, has no getter and emits nothing.** A rotation of the one key the
whole read surface depends on leaves **no trace in any log** — no indexer can see it. It matters to
stored credentials because the Hub never re-checks anything: an SBT signed under a key later rotated
out reads as valid until it expires, and the issuer pin cannot separate the cases. Swept: slot 8 is
`0x0` at 115,616,234, the code appears at 115,616,235 and the key is there in that same block and at
every block sampled since. **Never moved**, so nothing at head changes — the third time in three
iterations that an assumption becomes a check without a score moving.

**The hole is bigger than the log sweeps' and is written down rather than papered over.** PoH's and
World's timelines read *events*, so within a range they see every change. With no event, sampling
proves only the blocks it reads: a change that **stuck** is caught by any straddling pair and
bisected to the exact block, but one made and **reverted between two samples** leaves exactly the
trace no change leaves. No density fixes that. Closing it needs a trace endpoint or a transaction
index — both vendors.

**The bisection had never run, so it is tested against the one slot here that did move.** Slot 0
held the deployer at 115,616,235 and the operational owner from 115,616,238, six seconds later. A
live test points the sweep at slot 0 and requires it to land on that exact block — checked against
the `OwnershipTransferred` log sitting in it and against the slot still holding the old value one
block earlier. Nothing written down: the block and both addresses come off the chain each run.

**The ceiling is unprovable on chain and *falsifiable* on it.** A credential exists before it is
minted, so `iat <= mint`, so `expiry - mintTimestamp <= expiry - iat` — any mint above the ceiling
would prove the ceiling exceeded, with no knowledge of the issuance date the protocol deliberately
hides. Over the same 76 mints the largest is **364.969 days** against a 365-day ceiling, 45 minutes
below: the ceiling is the operative constraint, not a loose bound, so a change to it shows up here
immediately. Now a live test over whatever mints the run finds. One mint in the sample was **already
expired when it was minted** (by 6.5 days) — `setSBT` never compares `expiration` to
`block.timestamp`, another place the contract does less than was assumed.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**: forge,
  sdk unit, sdk live **23/23, 0 skipped**, Playwright **13 passed**.
- `cd packages/sdk && npm test` → **595 tests, 593 pass, 2 fail, 0 skipped** (**+24** over iteration
  25's 571: 18 unit in a new `holonym-signer.test.ts`, 6 live). The 2 failures are iteration 15's
  registry-drift pair, unchanged and untouched.
- `holonym.live.test.ts` alone: **13/13, 0 skipped**, twice.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6151 over 5 roots** / DENY the sibling / DENY the
  fleet. Iteration 25 recorded 3.6177 over 6; **that difference is not this change** — the parent
  commit was run (stash, run, pop) and gives the identical 3.6151, so it is a day's decay drift plus
  whatever moved upstream, and this change moves nothing.
- **Cost, measured against the parent commit** — same held subject, both credentials, two processes
  each: subject holding a credential **174 → 534 ms** cold and **132 → 141 ms** warm; subject with
  **no** Holonym credential **56 → 56 ms**. The sweep is memoised on success only and asked for only
  when a subject holds something: no credential, no authority to check, and that is most subjects.
- **The acceptance tests assert mechanism.** The signer is recovered from real mints each run rather
  than compared to a constant; the ceiling is checked against whatever mints the window holds; the
  era boundary is checked against a log in the block it names. All stay true the day a rotation
  lands — only the `rotated` flag changes.

**Committed:** `39637cc` fix(sdk): Holonym's Hub verifies a signature, not a proof.

**Write-up:** `research/protocols/holonym-signed-not-proven.md` — the deployed source, the four-way
layout proof, the 76-mint recovery, the sweep with its guards and its hole, the ceiling measurement,
the cost table and three open questions. `holonym-human-id-onchain-read.md` §4 gains a correction
box. Indexed in `research/INDEX.md` (header recount: 45 files / ~26,530 lines). `docs/scoring.md`
gains the third premise beside PoH's and World's; README gains **honest limit 17**.

**Refactor, because a second adapter needed it.** `op-archive.ts` now holds the three keyless OP
archive endpoints and the round-robin failover, moved out of `farcaster.ts` — which endpoints serve
archive state without a key is a fact about the chain, not about either protocol.
`FARCASTER_ARCHIVE_RPCS` still exports, so no caller changed.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this decides what
we *say* about a credential's authority, not what one is worth. Registry stays as the chain has it
(32 adapters / revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–25, still
   the only *real* red in the suite, still Hugo's call.
2. **Is the issuer key itself rotatable?** Open question 2 of the new write-up. We pin two Poseidon
   hashes transcribed from Holonym's repositories, and *nothing on chain says those are the
   issuers* — the verifier signs whatever the circuit accepted. That is the same class of silent
   change one level down, and the live suite's re-read off live credentials is a tripwire, not a
   timeline. It is also the last unexamined pin in this adapter.
3. **`maxProofTime` is a second unread World term.** Iteration 25's next-step 3, still standing:
   `verify()` rejects a proof older than 7 days, settable the same way. It enters no date, but it
   bounds how stale the underlying Orb proof may be when the entry is written.
4. **Index the two PoH cross-chain events** and give `PohHuman` an `expirationTime`. Iterations
   22–25's standing next step. Now three of the four term/authority sweeps are per-process reads
   against public endpoints; a subgraph over them removes that whole class of fragility.

**Worth keeping, because it generalises.** Iteration 25's lesson was *a measurement in a research
file is not a check in the probe*. This one is a level underneath it: **the research file can be
measuring the wrong thing entirely, and good research is what makes that invisible.** The Holonym
write-up is careful, cites `V3.circom` by line, quotes the constraint, tabulates thirteen real mints
against it — and it never asked whether the contract runs the circuit. Every check downstream
inherited that. The tell was available for free the whole time: the deployed source is 146 lines and
the answer is in its second comment line. **When a derivation cites a document, check that the thing
enforcing the document is the thing you are reading.**

The other one is about what to do when the answer is bad. The honest reading here could have been
"the ceiling is unverifiable, drop the date" — and that would have been *worse*, because an undated
`Decay` credential scores at full weight. A conservative-sounding move in the wrong direction is
still the wrong direction; the useful question was not "can we still trust this?" but "what does the
chain publish that would contradict it?", which turned out to be the mint block, sitting in a log.

**Blocked:** nothing. Nothing new for Hugo this iteration; MORNING is untouched. Carried: iteration
15's ontology/registry drift (Hugo), iteration 25's two dead `.rootowned` directories (one
`sudo rm -rf`), and iteration 1's two notes, `pnpm-lock.yaml` untracked beside a tracked
`package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at `apps/demo/test.sh`.
Environment note, unchanged from iterations 24–25: Studio's `poh/version/latest` still returns "Too
many requests", so every run here pins `poh/v0.0.3`.

## Iteration 27 — 2026-07-26

**Did:** iteration 26's next-step 2 — **is the issuer key in `publicValues[4]` itself rotatable?**
It is, silently and at the protocol's discretion. But the answer that mattered was one level up, in
our own probe, and finding it is the iteration.

Iteration 15's #1 — reconcile the ontology with the deployed registry — was re-confirmed **still
blocked on Hugo** before starting: the same two `as-of.live.test.ts` tests are red and nothing else
is. MORNING "Needs you" item 18 stands, unchanged for a thirteenth iteration.

**We were refusing credentials without telling anyone.** `publicValues[4]` is the only thing
separating a real Holonym credential from one somebody signed for themselves under the same circuit
id — `Hub.setSBT` runs no proof verification and anyone may run an issuer key, which is why the
contract's own source warns consumers to check it. We pin that issuer from two Poseidon hashes
transcribed out of Holonym's repositories, because nothing on chain declares them. So the pin can be
wrong in two directions and they are not symmetric:

- **too wide** — we accept a key that is not Holonym's — counts a forgery, and no read closes that;
- **too narrow** — Holonym rotates or adds a key and we do not — refuses **real people**, one at a
  time, for as long as it takes somebody to notice.

The second was live and it was silent. `interpretSbt` returned `{ held: false, detail: { sbt:
'issuer-mismatch', … } }` — no note, no caveat. From outside, **a credential we threw away and an
address that holds nothing are the same result**: the subject sees a lower score and no reason, and
whoever reads the score sees somebody who has done nothing. Every other `held: false` this adapter
produces means the subject holds nothing; exactly one means the subject holds something we chose not
to count, and that one must not look like the others. It is the same class as index lag moving a
score and a stopped Circles avatar read as a revocation, arriving from a new direction: not a wrong
answer, but a **correct answer that says nothing about the evidence it discarded**.
`credential-issuer-not-recognised` is now on the refusal, and it is the second caveat in
`scoring.ts` deliberately **not** filtered on `held` — the reason `index-cannot-see-endings` is not:
a subject who loses a trust root to a decision of *ours* is owed the reason.

**And the pin is no longer a transcription.** Ten windows of 30,000 blocks spread evenly from the
Hub's deployment block (115,616,235) to head (154,715,253), every mint transaction in each decoded
from its calldata: **every `gov-id` mint in every era carries `0x03fae82f…1993` and every
`biometrics` mint carries `0x0d4f849d…d922`** — 2024-02-01 to 2026-07-25, unchanged. A denser
200,000-block sweep at head (104 mint transactions, the largest sample taken) agrees exactly: 55
gov-id, 32 biometrics, 17 phone, one issuer each. `getSBT` cannot answer this — it reverts once a
credential expires, so the issuer of an expired SBT survives only in the transaction that minted it
— which is why the timeline is a live test and not a probe.

**At probe time, a census of what live credentials are actually carrying.** `holonym-issuer.ts`
takes recent mint `Transfer`s, reads `getSBT(holder, circuitId)` back at head through one
`multicall`, and reports whether the pin is still the key in use: 439–540 ms measured over three
runs, 9 holders / 10 live credentials in a 30,000-block window, four round trips. Asked for once per
process and **only when a subject holds or is refused something** — no credential, no issuer to
corroborate, and that is most subjects.

**The control is free and it is load-bearing.** A pin that matched everything would be worth
nothing, so both the census and the timeline have to show `publicValues[4]` *discriminates*. It
does, at no extra call: the two scored circuits carry different keys from each other in every
window, and the Hub's unscored `phone` circuit carries a third (`0x0040b881…30a4`) throughout.
`IssuerCensus.discriminates` reports it per run; the timeline test asserts no key appears on two
circuits.

**Two transport traps, both of which fail by answering.**

1. **viem's `getLogs` action silently drops a caller-supplied `topics` array** (2.55.8 — `topics` is
   a local built from `event`/`events`/`args` and the caller's is never destructured), so the
   request goes out unfiltered. Over blocks 154,700,000–154,709,999 the action returns two logs, one
   of which is not a `Transfer` at all, where `client.request` with the identical filter returns
   one. Every production `eth_getLogs` in this repo already goes through raw JSON-RPC, so nothing
   shipped was affected — but two reads in `holonym.live.test.ts` used the action, including one
   asserting `logs.length === 1` for a filter it was never sending, which **passed because that
   block happens to hold nothing else**. An assertion resting on a coincidence.
2. **`multicall`'s `allowFailure: true` swallows the transport.** A rate-limited `eth_call` comes
   back as every entry `status: 'failure'` carrying the same HTTP error, the promise *resolves*, and
   the endpoint rotation never fails over — so a throttled `mainnet.optimism.io` reads as a registry
   in which nobody holds anything. Not hypothetical: it is how the census failed on its first live
   run, silently, as `uncorroborated`. A multicall is one `eth_call`, so a batch in which nothing
   succeeded is refused and another endpoint gets it.

**The refusal path is tested against the real chain, because it has never happened.** A path that
has never run is not a path — the same argument that pointed the signer sweep's bisection at slot 0.
`holonymAdapters({ credentials })` makes the pin injectable, so the live suite takes a **real,
currently-held** gov-id credential and probes it against `issuer ^ 1n`: same read, same holder, a
key we do not have, which is exactly what an upstream rotation looks like from in here. It requires
`held: false` with no `error`, the note present, and the census to have landed on `pin-not-in-use`
and to **name the real issuer** among `unpinnedIssuers`. Nothing written down: the holder is found
from the chain each run and the wrong pin is derived from the right one.

**Verified:** on this box, at this commit.

- `CORROBORATE_SUBGRAPH_URL=…/poh/v0.0.3 ./apps/demo/test.sh` → **all suites green, exit 0**: forge
  18, sdk unit 35, sdk live **23/23, 0 skipped**, Playwright **13 passed**. Run twice.
- `cd packages/sdk && npm test` → **619 tests, 616 pass, 2 fail, 1 skip** (**+24** over iteration
  26's 595: 20 unit in a new `holonym-issuer.test.ts`, 4 live). The 2 failures are iteration 15's
  registry-drift pair, unchanged and untouched; the skip is a Base endpoint hiccup, not this change.
- `holonym.live.test.ts` alone: **17/17, 0 skipped**, three times.
- `npm run build` and `tsc --noEmit` clean in `packages/sdk`; `packages/mcp` builds clean.
- `cd apps/agent && npm start` → DENY / ALLOW **3.6151 over 5 roots** / DENY the sibling / DENY the
  fleet. **Identical to iteration 26**, so nothing at head moves.
- **Cost, measured against the parent commit** — same live gov-id holder found from the chain
  (`0xb8e2fcdf…c9a5`), two processes each: cold **752/784 → 797/1003 ms**, warm **141/158 →
  132/142 ms**, no credential **48/57 → 46/56 ms**. The census is ~450 ms of work costing ~50–220 ms
  because it shares a `Promise.all` with the signer sweep; the warm and no-credential paths do not
  move, which is the point — the check is paid for by the subjects it is about.
- **The acceptance tests assert mechanism.** The timeline decodes whatever mints each window holds;
  the census reads whatever live credentials the window holds; the refusal is exercised against a
  real held credential with a derived pin. All stay true the day a rotation lands — only the status
  changes.

**Committed:** `396b05a` fix(sdk): a Holonym credential we refuse is a credential the score never
mentions.

**Write-up:** `research/protocols/holonym-issuer-pin.md` — the two failure directions, the defect,
the census with its cost table, the ten-window timeline, both transport traps and three open
questions. Indexed in `research/INDEX.md` (header recount, actually counted: **46 files / 26,786
lines**). `holonym-signed-not-proven.md` open question 2 struck through and answered.
`docs/scoring.md` §4 gains the exclusion-by-premise paragraph beside the three term premises; README
gains **honest limit 18**.

**No registry write, on purpose.** No weight, root, curve, half-life or cost moved: this decides
what we say about a credential we *refuse*, not what one is worth. Registry stays as the chain has
it (32 adapters / revision 36, written by the other tree; this tree still has 30).

**Next, in the order I would do it:**

1. **Reconcile the ontology with the deployed registry** — unchanged from iterations 15–26, still
   the only *real* red in the suite, still Hugo's call.
2. **The same pin exists in `human-passport.ts` and `coinbase.ts`, uncensused.** Open question 3 of
   the new write-up, and the one that generalises furthest. Both pin an attester read from
   documentation rather than from the chain, both refuse on mismatch, and neither says a word when
   it does. The machinery built here — a census of what live credentials actually carry, plus an
   audible refusal — is protocol-independent; what differs is only where the mints come from.
   `passport-attester-pin.md` records what those pins are.
3. **`maxProofTime` is a second unread World term.** Iteration 25's next-step 3, standing since:
   `verify()` rejects a proof older than 7 days, settable the same way. It enters no date, but it
   bounds how stale the underlying Orb proof may be when the entry is written.
4. **Index the two PoH cross-chain events** and give `PohHuman` an `expirationTime`. Iterations
   22–26's standing next step. Four of the five term/authority/issuer checks are now per-process
   reads against public endpoints; a subgraph over them removes that whole class of fragility.

**Worth keeping, because it generalises.** Iteration 26's lesson was *when a derivation cites a
document, check that the thing enforcing the document is the thing you are reading*. This one is the
same instinct pointed the other way: **check what the code does with the answer it does not like.**
The issuer check was correct, well-documented, adversarially motivated, and the *only* branch nobody
had followed to the end was the branch where it fires. Everything in this package is built to say
loudly when a read is degraded or a date is a bound; the one place it fell silent was where it was
most confident, because a refusal *feels* like a finished decision rather than a partial one. The
tell was cheap and available: `interpretSbt` has five `held: false` returns and four of them mean
"nothing here" — a fifth that means something completely different, returning through the same
channel with the same shape, was the whole bug.

The other one is about the two traps. Both were in *transport plumbing that appeared to work*, both
were found only because a new read exercised them, and both fail by answering rather than by
erroring — the third and fourth instances of that pattern in four iterations (Tenderly's truncated
log range, the Circles `stopped()` getter, and now these). It is worth stating as a rule rather than
a coincidence: **when a dependency can return a plausible wrong answer instead of an error, assume
it will, and re-check its contract on our side of the boundary.** `mintHoldersFromLogs` re-checks
every log's topics even though it asked for them; that is not paranoia, it is the only thing that
would have caught the viem behaviour before it mattered.

**Blocked:** nothing. Nothing new for Hugo this iteration; MORNING is untouched. Carried: iteration
15's ontology/registry drift (Hugo), iteration 25's two dead `.rootowned` directories (one
`sudo rm -rf`), and iteration 1's two notes, `pnpm-lock.yaml` untracked beside a tracked
`package-lock.json` and `MISSION.md` pointing at a `./test.sh` that lives at `apps/demo/test.sh`.
Environment note, unchanged from iterations 24–26: Studio's `poh/version/latest` still returns "Too
many requests", so every run here pins `poh/v0.0.3`.
