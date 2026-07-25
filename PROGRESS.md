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
