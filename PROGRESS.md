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
