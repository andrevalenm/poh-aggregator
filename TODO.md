# TODO

The working plan, ranked. (MORNING.md is the log; this is the queue.)

## In flight now

- [x] **Score stamp ceremony** — shipped: count-up completes, the numeral presses in
      (squash-spring settle + iron blot soaking away beneath). Reduced-motion exempt.
- [x] **Research margin notes** — shipped: at ≥1280px the long-form reserves a Tufte
      margin and the Ohlhaver pull-quotes float into it at natural flow height — iron
      rules, mono citations, CSS-only, author's markup untouched.
- [x] **9-probe SDK consolidation** — landed in-tree; all page counts self-updated via
      the dynamic derivation. Design absorbed the new density: the probe receipt settles
      on completion (found rows + one tally line) and full evidence sorts held-first.
- [x] **Infra run, Jul 25 evening** (overnight autonomous, log in MORNING.md):
      **12 probes / 32 adapters / 19 roots / registry rev 36.** New: Gitcoin Passport
      via EAS (OP+Arbitrum), Lens (Lens Chain + Polygon fallback), Coinbase read moved
      fully on-chain, Farcaster custody-dating bug fixed. MCP grew 4 → 8 tools
      (suggest_enrollment, check_fleet, wallet_signals, price_policy) with a real stdio
      handshake test suite. SDK: wallet-forensics signals module (permanent
      not-personhood caveat), probe timeout/retry/cache layer, registry reads on a
      3-endpoint fallback transport. READMEs + coverage audit current. A second
      provider tranche (Self/zkPassport, Galxe/Civic, Humanode/BrightID) is being
      researched by builder agents — honest-refusal allowed, so some may land as
      research files documenting why no permissionless read exists.

## Blocked on decisions (each unlocks a chunk)

- [x] **Name decision** — **print** (picked over thumb and the original working name).
      Find-replace landed across the tree. Still gated on: npm scope, mainnet ENS,
      public repo name, og/meta copy. Sepolia ENS names need re-registering under
      `print.eth` before the live demo works again.
- [x] **Repo push (private)** — pushed to a private remote after a secrets audit (only
      `0x...` placeholders in history; no real keys). andrevalenm has write access and
      continues from here. Judges still need a PUBLIC URL eventually — flip visibility
      or re-push after the name decision.
- [ ] **Domain + HTTPS** — point a (sub)domain at the host and wire TLS through the
      reverse proxy. Kills the "Not secure" bar and the http-clipboard class of
      bugs for good.
- [ ] **ENS mainnet** — register the name (~5 min, ~$5/yr) + set `observer.print.subjects`
      text record. **No longer blocking anything:** the whole ENS story is live on Sepolia
      (`print.eth` + agent subnames, `deployments/ens-sepolia.json`, `npm run ens`),
      because Sepolia registration turned out to be free and instant. Mainnet is now a
      presentation choice — and one to make *after* the name decision.
- [ ] **Demo video** — script is current (docs/demo-script.md), beat-timed at 3:00.
- [ ] **ENS booth, Sunday MORNING (required)** — both ENS prizes require in-person
      presentation at the ENS booth. Talking points + prize mapping now in
      docs/demo-script.md §ENS booth. Video OR live demo link also required.
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
- [ ] **print.subjects countersigning** — roadmap item already documented in the
      ENS caveat copy; design sketch lives in docs/threat-model.md notes.

## Considered and parked

- **Ambient sound** — twice considered, twice declined: gimmick risk exceeds payoff.
      Revisit only with a muted-by-default toggle and a real sound-design idea.
- **More motion layers** — the page is at the right density; the flowing terrain +
      ink-press + reveals are the budget. Additions must replace, not stack.
