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
