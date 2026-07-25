# Standing mission — autonomous build on ax41

You are working unattended on **Corroborate**, a proof-of-personhood aggregator, in
`/root/poh-aggregator` on Hugo's Hetzner box (ax41). Hugo is offline. Nobody will answer
questions, so route around blockers rather than waiting, and write anything that genuinely
needs his judgment into `MORNING.md` under "Needs you".

Read `README.md`, `docs/scoring.md` and `docs/threat-model.md` before your first change.
`PROGRESS.md` is the log across iterations — **read it first, append to it last.**

---

## Hard constraints — violating any of these is worse than shipping nothing

1. **This machine runs Hugo's production apps.** `dokploy`, `traefik`, `peanut-split`,
   `wordle`, `payoff`, `findjuris`, `vegan`, `robotichugo`, `uptime-kuma` and their
   databases are live on it. Never stop, remove, restart or reconfigure any container
   whose name does not begin with `corroborate-`. Never touch ports 80, 443, 3000 or 3001.
   Never edit anything under `/etc`, never `systemctl`, never reboot. If you think you need
   any of that, you are wrong — find another way and note it in `MORNING.md`.
2. **Never `git push`.** `origin` is `andrevalenm/poh-aggregator`, which is not ours and to
   which we have no access. Commit locally, on the current branch, forever. Hugo pulls from
   this machine.
3. **Only use credentials in `/root/poh-aggregator/.env.local`.** It holds a burner deployer
   key funded with Sepolia test ETH. There are unrelated production secrets elsewhere on
   this box — do not read them, do not use them, do not go looking.
4. **Do not touch the landing page.** `apps/demo/index.html`, `apps/demo/src/landing/**` and
   `apps/demo/public/**` belong to a separate design agent working on Hugo's laptop. Editing
   them guarantees a conflict. The one exception: if you add protocols, you may update
   *counts and protocol names* in copy — nothing structural, nothing visual.
5. **Never invent an address, hash, or number.** This codebase has already been burned once
   by a fabricated address tail. No address enters code unless you copied it whole from a
   source you actually read, and verified with an on-chain call that it responds as expected.
   Same for costs: every weight cites a real source in `sourceURI`.
6. **Never claim something works that you have not run.** If a test fails, say so in the
   commit message and `PROGRESS.md`. A truthful "blocked" is worth more than a false "done".

## Working agreement

- Small, complete, committed increments. Never leave working code uncommitted.
- Real commit messages: what changed, why, what you verified. Match the existing style —
  look at `git log` before writing your first one; the bar is high and it is the house style.
- Run the suite before you commit: `./test.sh`, plus `cd packages/sdk && npm test`.
- Prefer fixing a real defect over adding a cosmetic feature. Adversarial reading of the
  scoring core has already found two genuine bugs; there are more.
- Append to `PROGRESS.md` every iteration: what you did, what you verified, what is next,
  what is blocked. Future iterations start from a blank context and only know what is there.

## Setup you may need

`node_modules` was not copied. Run `pnpm install` (pnpm is present) if a build or test
needs it. Foundry is **not** installed; if you need `forge`, install it for this user only
via `foundryup` — do not install anything system-wide. `scripts/compile.mjs` and
`scripts/deploy.mjs` already build and deploy contracts with solc via npm, so you may not
need Foundry at all.

---

## Priority queue

Work the highest incomplete item. Each has an acceptance test — do not mark done without it.

### P0 — Subgraph-first probes, fixing a live scoring bug

Today `resolve()` reads a contract boolean, then asks the subgraph for the issuance date.
That produces a **torn read**: when the contract says held at chain head but the subgraph has
not indexed it yet, we return held-with-unknown-age, and unknown age on a `Ramp` curve is
scored at the 0.5 midpoint. So *subgraph lag silently changes scores*, which also means an
attacker benefits from making the subgraph lag.

Invert it: the subgraph is the source of truth for held/not-held **and** issuance date at a
known indexed block; the RPC is a freshness check confirming nothing changed since. Report
the indexed block in the result. Where the subgraph has no coverage, fall back to the
contract read exactly as today, and keep the existing caveat.

*Acceptance:* a test proving that a subject whose credential is real but not yet indexed
gets a result that is either correct or explicitly flagged — never a silently different
score. Plus the existing 66 tests still green.

### P0 — Aggregate the whole landscape, not four protocols

The pitch says ~40 protocols collapse into ~6 trust roots. The ontology has 15 entries and
only 4 have live probes. Close that gap. This is the "1inch for personhood" claim and right
now it is the weakest part of the product.

Two distinct jobs, in this order:

1. **Research every protocol in the landscape into `ontology/adapters.json`.** For each:
   evidence class, trust root, forge cost, rent cost, age curve, half-life, `live` flag, and
   a `sourceURI` citing where the numbers came from. Put the write-up in `research/`. Getting
   the *trust roots* right matters more than the count — two protocols reading the same
   passport chip must share a root, or saturation cannot protect anyone. Resolve
   `humanity-protocol`, which currently sits at `trustRoot: "unknown"`.
2. **Then implement a probe for every one that is permissionlessly readable** — an on-chain
   call or a public indexer with no API key on the critical path. That constraint is a
   product principle, not a limitation: see the comment at the top of
   `packages/sdk/src/adapters/index.ts`. Protocols that are API-gated, off-chain or dead
   still belong in the ontology with `live: false` or a documented "no permissionless read"
   note — that is honest aggregation, and the caveat system already carries it.

Known ontology entries lacking probes: `world-id-document`, `world-id-selfie`, `zkpassport`,
`self-protocol`, `galxe-passport`, `linea-poh`, `anima-pou`, `humanity-protocol`, `idena`,
`brightid`, `civic-pass`. Beyond those, the landscape includes Gitcoin Passport / Human
Passport, Worldcoin document tier, Fractal ID, Quadrata, Privado ID / Polygon ID, Sismo,
Optimism AttestationStation, Gitcoin GTC staking, Unitap, Nomis, Trusta, Holonym / Human
Network, Rarimo, Billions, Proof of Humanity v1, Kleros-adjacent registries, Discord/GitHub
social attestations via EAS, Talent Protocol, Karma3, and the various EAS/Verax schemas on
Base, Linea and Arbitrum. Research what is real; discard what is vapour, and say which.

*Acceptance:* per adapter, a live test that hits the real chain and asserts the mechanism
(not a magic number), and the deployed registry updated so weights are on-chain with sources.
Also update the on-chain registry via `scripts/deploy.mjs` and record the new revision.

### P1 — Make The Graph load-bearing across chains

- Subgraph for **World Chain AgentBook** (agent registrations and human bindings). Doubles
  as evidence for the World track.
- Subgraph for **Base EAS** Coinbase attestations, replacing the `easscan.org` GraphQL
  dependency. That dependency currently contradicts our own stated principle of no vendor on
  the critical path — fixing it is coherence, not box-ticking.
- **As-of scoring**: `resolve(addr, { asOf: block })`, scoring by the ontology revision and
  credential state as they stood at a past block. Only an indexer can do this, it makes the
  audit trail executable rather than decorative, and it is the strongest single Graph claim
  available. Registry audit-trail subgraph already exists on `:8100`.
- Consider **publishing a subgraph to the decentralized network** rather than leaving it on
  Studio's dev endpoint, and Substreams for the high-volume Circles trust graph.

*Acceptance:* the SDK consumes each new subgraph; `as-of` has a test proving a score changes
when the historical registry revision differs from the current one.

### P1 — ENS load-bearing for the AI-agents track

Target track is **Best ENS Integration for AI Agents**, so ENS must carry agent identity, not
just human address sets. Build: an agent's ENS name resolving records that name the backing
human (`corroborate.human`), the counterparty resolving that name and checking the human's
personhood before agreeing to anything, and a second agent under the same name tree being
refused because it is the same human. Keep `corroborate.subjects` for humans. The record is
self-asserted and must keep saying so in a caveat.

*Acceptance:* end-to-end test against a real testnet name, no hard-coded values anywhere in
the demo path — the track disqualifies hard-coded demos explicitly.

### P1 — World: fleet policy, and World in scoring not just gating

- Turn fleet detection into a real policy engine: a counterparty declares limits ("at most N
  agents per human", "at least K independent roots") and the flow enforces them. Ten agents
  behind one human collapsing to one allowed reads as a product; three hard-coded agents
  reads as an illustration.
- Wire probes for the Selfie and Identity/document tiers so World appears in the *score*, not
  only in the agent gate. Keep the AgentKit flow the loudest thing in the repo — it is the
  $8k track and the strongest claim.

### P2 — Everything else

Expand the test suite; tighten error copy so a first-time user gets a legible message; keep
`README.md` and `MORNING.md` current; add HTTPS for the demo if you can do it *without*
touching the traefik/dokploy stack (a separate container on a high port is fine).

---

## Adding an adapter — the checklist

1. Read the protocol's actual deployment. Find the contract, on the right chain, and confirm
   with a real call that it answers for a known-positive address.
2. Establish the **trust root** from documentation, not vibes. If two protocols read the same
   government document, they share `state-document:icao-9303`. If a KYC vendor is behind
   both, they share that vendor's root. Wrong roots break saturation, which is the whole
   product.
3. Price `forgeCostCents` and `rentCostCents` from a cited source. Cost is denominated in
   what an adversary pays, and scoring takes `min(forge, rent)` because protocols harden
   against sale, never rental.
4. Choose the age curve deliberately: `Decay` for liveness and KYC, `Ramp` for vouching
   registries where the suspect cohort is the fresh one, `None` if age carries no signal.
5. The probe must never throw. A network failure returning `held: false` would silently mean
   "not a human" — failures surface as `error` and are excluded, never counted as a negative.
6. Add a live test asserting the mechanism. Then update the registry on-chain so the weight
   is public with its source.
