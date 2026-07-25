# Morning brief

Overnight build log for **Corroborate**. Everything below is committed; the git log has the
detail. _Last updated 2026-07-25, ~07:30. All suites green (58 tests + 1 new live enrichment test); agent flow re-verified against the final SDK; demo hosted with example chips._

---

## State: every phase shipped and tested

| Piece | State | Proof |
|---|---|---|
| `PersonhoodRegistry` v2 | Sepolia `0x977b028b900cce8ee89c46877e814eff3060aa07` | 18 forge tests; age curves + plaintext event ids with on-chain integrity check |
| Ontology | 15 adapters, 10 trust roots, per-adapter age curves | `ontology/adapters.json`, every entry cites `research/` |
| SDK | builds, publishes clean types | 23 unit + 11 live tests |
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

1. **Repo has no pushable remote.** Judges need a URL. Fork to Hugo0 or get collaborator
   access from Andrei, then `git push`. Nothing was pushed anywhere overnight.
2. **corroborate.eth — 5 minutes on mainnet.** Sepolia ENS is mid-migration (the artifact
   controller isn't authorized on the registrar; no NameRegistered events in weeks; details
   in the b33e5d6 commit message). Register `corroborate.eth` on **mainnet** in the ENS app
   (~$5/yr), set text record `corroborate.subjects` to your wallet list. The SDK feature is
   done and tested; the demo lights up the moment the record exists.
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
