# TODO

The working plan, ranked. (MORNING.md is the log; this is the queue.)

## In flight now

- [x] **Score stamp ceremony** — shipped: count-up completes, the numeral presses in
      (squash-spring settle + iron blot soaking away beneath). Reduced-motion exempt.
- [x] **Research margin notes** — shipped: at ≥1280px the long-form reserves a Tufte
      margin and the Ohlhaver pull-quotes float into it at natural flow height — iron
      rules, mono citations, CSS-only, author's markup untouched.
- [ ] **9-probe SDK consolidation** — the ax41 build agent's tree (30-adapter ontology,
      9 live probes, reconcile.ts) is being merged into this machine. Once it lands: the
      landing's dynamic counts pick it up automatically; re-run E2E + redeploy. *(agent,
      in progress)*

## Blocked on Hugo (each unlocks a chunk)

- [ ] **Name decision** — thumb / print / corroborate. Gates: npm scope, mainnet ENS,
      public repo name, og/meta copy. Rename is a find-replace; do it BEFORE publish/push.
- [ ] **Repo push** — fork to Hugo0 or collaborator access; judges need a URL.
- [ ] **Domain + HTTPS** — point a (sub)domain at ax41; Claude wires TLS through the
      existing traefik stack. Kills the "Not secure" bar and the http-clipboard class of
      bugs for good.
- [ ] **ENS mainnet** — register the name (~5 min, ~$5/yr) + set `corroborate.subjects`
      text record; the SDK feature is live-tested and the demo lights up on its own.
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
