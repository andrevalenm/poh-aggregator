# TODO

The working plan, ranked. (MORNING.md is the log; this is the queue.)

## In flight now

- [x] **Score stamp ceremony** — shipped: count-up completes, the numeral presses in
      (squash-spring settle + iron blot soaking away beneath). Reduced-motion exempt.
- [x] **Research margin notes** — shipped: at ≥1280px the long-form reserves a Tufte
      margin and the Ohlhaver pull-quotes float into it at natural flow height — iron
      rules, mono citations, CSS-only, author's markup untouched.
- [x] **No vendor on the critical path** — shipped (iteration 14): the Coinbase probe reads
      Base's EAS predeploy through Coinbase's own on-chain attestation index, so
      `base.easscan.org` is gone. Every adapter is now a chain read or a self-hosted index.
      Two `eth_call`s, no key. `research/protocols/eas-and-disco.md` §"Resolution, 2026-07-25".
- [x] **ENS presenter authentication** — shipped (iteration 15): a name is public, so
      resolving one said nothing about who was presenting it. `verifyEnsPresentation()` is an
      ERC-4361 challenge bound to the name (`ens:<name>` in Resources) checked against the
      `addr` record read in the same pass; `requirePresenterAuthentication` enforces it.
      `npm run ens` gains two runs: the agents themselves (2 of 3, unchanged — proof is free
      for an honest agent) and the same three names from a wallet made a second earlier
      (0 of 3). `research/protocols/ens-agent-identity.md` §5.1.
- [x] **As-of sees credentials since lost** — shipped (iteration 16): the standing caveat "one
      held then and revoked since cannot be seen" is no longer true. EAS and
      `WorldIDAddressBook` both keep the *end* of a credential and never clear it, so a dated
      start plus a dated end is a closed window and `issuedAt <= t < heldUntil` is a proof. No
      archive node needed. Restoring requires an exact issuance date, never a lower bound;
      Holonym is excluded because `getSBT` reverts once expired, so an expired SBT is no longer
      attributable to its issuer. `as-of.ts` rule 2, `heldUntil` in `types.ts`.
- [x] **The index says what it saw** — shipped (iteration 17): the Circles data source runs
      from the Hub's deployment block (36486014) instead of a two-month window, so absence is
      evidence and an avatar is dated from its own `RegisterHuman` — two real avatars moved
      1.4150 → 1.6711 and 0.9438 → 1.6711. Coverage is now an `IndexCoverage` entity the index
      writes about itself rather than a constant in the SDK, and `claimObserved` /
      `registrationObserved` make a side-event date explicit: a Circles trust edge is a floor,
      a PoH vouch is a *bound* (it precedes the claim, so reading it as a date buys ramp weight
      — 0.875 vs 0.5 on a three-year-old vouch).
      `research/protocols/protocol-subgraph-coverage.md`.
- [x] **9-probe SDK consolidation** — landed in-tree; all page counts self-updated via
      the dynamic derivation. Design absorbed the new density: the probe receipt settles
      on completion (found rows + one tally line) and full evidence sorts held-first.

## Blocked on Hugo (each unlocks a chunk)

- [ ] **Reconcile the ontology with the deployed registry** — the only red in the suite.
      Another working copy added `human-passport-eas` and `lens-account` to the shared Sepolia
      registry at block 11,349,413 (2026-07-25 18:29 UTC), taking it to 32 adapters / revision
      36; this tree's `ontology/adapters.json` has 30, and two `as-of.live.test.ts` tests fail
      on the difference. Their `sourceURI`s name two research files that do not exist here, so
      an agent cannot write the entries without inventing citations. Bring the other tree over
      or re-seed from this one. MORNING "Needs you" item 18.
- [ ] **Name decision** — thumb / print / corroborate. Gates: npm scope, mainnet ENS,
      public repo name, og/meta copy. Rename is a find-replace; do it BEFORE publish/push.
- [x] **Repo push (private)** — https://github.com/Hugo0/poh-aggregator (private),
      full history pushed after a secrets audit (only `0x...` placeholders in history;
      no real keys). andrevalenm invited with write access — she continues from here.
      Local remote name: `github` (origin still points at the original clone source).
      Judges still need a PUBLIC URL eventually — flip visibility or re-push after the
      name decision.
- [ ] **Domain + HTTPS** — point a (sub)domain at ax41; Claude wires TLS through the
      existing traefik stack. Kills the "Not secure" bar and the http-clipboard class of
      bugs for good.
- [ ] **ENS mainnet** — register the name (~5 min, ~$5/yr) + set `corroborate.subjects`
      text record. **No longer blocking anything:** the whole ENS story is live on Sepolia
      (`corroborate.eth` + agent subnames, `deployments/ens-sepolia.json`, `npm run ens`),
      because Sepolia registration turned out to be free and instant. Mainnet is now a
      presentation choice — and one to make *after* the name decision.
- [ ] **Demo video** — script is current (docs/demo-script.md), beat-timed at 3:00.
- [ ] **World on-device beta checklist** — Selfie Check + Identity Check need a phone
      (~20 min); written half already in docs/world-beta-feedback.md.
- [ ] **Manifesto copy decision** — "pays the sybil farm" vs the stricter independence
      framing (see MORNING top item). One Edit if wanted.

## Planned, not yet (deliberately)

- [ ] **npm publish** (@…/sdk + @…/mcp) — AFTER the name decision. Prep list when we do:
      package.json metadata + files whitelist; fix dist `.d.ts` re-export specifiers so
      the package works without the demo's source alias; `bin` + shebang for the MCP;
      prove both via `npm pack` → install tarball → smoke (SDK: live ontology read;
      MCP: stdio initialize handshake); per-package READMEs in the landing's voice.
- [ ] **CI workflow** (.github/workflows/ci.yml) — after repo push: typecheck + unit
      tests + demo build on every push; Playwright E2E job initially gated off (SwiftShader
      breaks the WebGL/canvas guards) with instructions to enable on a GPU runner.
- [ ] **Rotate the World portal API key** — it passed through chat history. Post-event.
- [ ] **corroborate.subjects countersigning** — roadmap item already documented in the
      ENS caveat copy; design sketch lives in docs/threat-model.md notes.

## Considered and parked

- **Ambient sound** — twice considered, twice declined: gimmick risk exceeds payoff.
      Revisit only with a muted-by-default toggle and a real sound-design idea.
- **More motion layers** — the page is at the right density; the flowing terrain +
      ink-press + reveals are the budget. Additions must replace, not stack.
