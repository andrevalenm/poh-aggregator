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
