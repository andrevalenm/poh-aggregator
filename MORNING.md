# Morning brief

Overnight build log for **Corroborate**. Everything below is committed; the git log has the
detail. _Last updated 2026-07-25, ~06:00._

---

## State: every phase shipped and tested

| Piece | State | Proof |
|---|---|---|
| `PersonhoodRegistry` v2 | Sepolia `0x977b028b900cce8ee89c46877e814eff3060aa07` | 18 forge tests; age curves + plaintext event ids with on-chain integrity check |
| Ontology | 15 adapters, 10 trust roots, per-adapter age curves | `ontology/adapters.json`, every entry cites `research/` |
| SDK | builds, publishes clean types | 23 unit + 11 live tests |
| Subgraph | Studio, syncing, serving | `api.studio.thegraph.com/query/77602/poh/v0.0.1` — feeds claimedAt into the ramp weights |
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

## Needs you (in priority order)

1. **Repo has no pushable remote.** Judges need a URL. Fork to Hugo0 or get collaborator
   access from Andrei, then `git push`. Nothing was pushed anywhere overnight.
2. **corroborate.eth — 5 minutes on mainnet.** Sepolia ENS is mid-migration (the artifact
   controller isn't authorized on the registrar; no NameRegistered events in weeks; details
   in the b33e5d6 commit message). Register `corroborate.eth` on **mainnet** in the ENS app
   (~$5/yr), set text record `corroborate.subjects` to your wallet list. The SDK feature is
   done and tested; the demo lights up the moment the record exists.
3. **World tracks need your phone.** Selfie Check + Identity Check beta submissions want
   *user testing docs*. `apps/agent`: `npm run worldid` prints a live World ID 4.0 QR —
   scan with World App (staging build works, no Orb needed for Selfie Check). 20 minutes.
4. **Registry curator + deployer is the burner EOA** — fine for judging, say it out loud in
   the pitch. Rotate the World portal API key after the event (it's in chat history).
5. **ENS booth Sunday morning** (both ENS tracks require presenting).

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
