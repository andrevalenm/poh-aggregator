# Handoff — 2026-07-25

Written at the end of a laptop session so the next one starts warm. Everything below is
current as of commit `d4e574a` on `main`, pushed.

---

## What this is

**Print** — an aggregator over proof-of-humanity protocols. One API reads ~40 protocols
across four chains and returns a single answer: is a real person behind this address.
Built for ETHGlobal Lisbon 2026. Submitting to **World**, **The Graph**, and **ENS**.

Repo: `github.com/andrevalenm/poh-aggregator` (public). The repo name still says
`poh-aggregator`; the product is Print. That mismatch is deliberate and was decided on —
GitHub keeps the URL, the product carries the name.

Working copy on this machine: `~/Desktop/claude/corroborate` (directory name is stale, harmless).

---

## What changed this session

**1. Repo migration.** The canonical work lived on another machine under a different GitHub
account. All 147 commits are now authored *and* committed by `andrevalenm`, verified through
the GitHub API. Every reference to the previous owner, their Hetzner box (`ax41`), and its bare
IP is gone from files, paths, and commit messages. Build-agent scaffolding (`MISSION.md`,
`go.sh`, `scripts/ax41-*.sh`, six `.scratch-*.mjs`) deleted.

The public repo's previous 16-commit research lineage is preserved two ways: as branch
`archive/first-research-pass`, and ported into `research/salvage-v1/` with a README explaining
why it coexists with `research/`.

**2. Rename: Corroborate → Print.** 401 occurrences across 63 files. Packages are now
`@printid/sdk` and `@printid/mcp`. One genuine English use of "corroborate" survives deliberately
at `research/landscape/sybil-incidents-antipatterns.md:206`; 27 inflected forms
(`corroborated`, `corroboration`, …) were preserved intentionally.

**3. Terminology: personhood → humanity**, user-facing surfaces only. Category is lowercase
"proof of humanity"; the *protocol* of that name is always qualified — "Proof of Humanity v2",
"Kleros PoH" — never bare, because Print aggregates it.

**4. Positioning pivot.** The page used to lead with price ("What does it cost to be human?").
It now leads with the binary question and the aggregator argument. Price was demoted to the
mechanism — it is the *unit* that lets an iris be compared to a bank check, not the pitch.

**5. Landing fixes.** Wordmark set in caps and enlarged; hero on one line; scrolling ticker
removed; whorl no longer collides with the nav; the italic `?` swash no longer clipped.

---

## The pitch, as settled

> It's an aggregator for proof of humanity. Instead of integrating World, then Circles, then
> Passport, then Proof of Humanity v2 one at a time, you call one API and it checks all forty,
> live, across four chains.
>
> The catch is that once you aggregate, you need a rule for combining the answers. "Yes if any"
> lets a farm in on one cheap credential. "Yes if all" lets nobody in. So everyone adds them
> into a score — and that's the broken one, because those forty protocols collapse to about
> nineteen real trust roots. World's document tier, ZKPassport and Self are all reading the
> same passport chip. A farm's credentials are all the same document; a real person's are
> genuinely different. Add them up and the farm outranks the human.
>
> So we collapse to trust roots first, price what each would cost an attacker to fake, and
> hand you one answer.

**The judge's question is "so what number do I use?"** Do not apologise for `isHuman()`
throwing. Answer: *anyone shipping a default threshold is hiding the base rate from you; a
dating app and an airdrop need different lines.*

**Segmentation that landed:** KYC tells you *who* someone is. Print tells you *that* someone
is. Banks are regulatorily obliged to do full KYC and are not the customer. Dating apps,
social platforms, marketplaces, ticketing, free trials, survey panels, gaming, and agent
accountability all need humanity and are actively harmed by holding identity. Against KYC
vendors the axes are cost, friction, and **liability** — you give the assurance without the
custody.

A Spanish version of the pitch was worked out verbally this session but never written down.
Ask for it again if needed.

---

## Current state

- Landing and console run locally: `pnpm -C <repo> --filter @print/demo dev`, port 5173.
- **304 unit tests pass.**
- **14 tests are RED** — all in `packages/sdk/src/ens-agents.live.test.ts`, purely because
  `print.eth` does not exist on Sepolia. Not a regression; proven by running the same file
  against a pristine worktree at the pre-rename HEAD, where it passed 14/14.
- Credentials: `.env.local` in the repo (gitignored, mode 600). Backup and the original
  `README-CREDS.md` are at `~/.corroborate-secrets/`. **Verified: none of the four real
  secrets appear anywhere in git history.** Deployer holds ~1.54 SepoliaETH.

---

## Open items

**1. ENS re-registration on Sepolia — do this first.** Turns the 12 red tests green, costs
nothing, and a judge who clones the repo currently sees a failing suite. It is *three* things,
not one:
   - Register `print.eth` plus subnames `alpha.`, `beta.`, `unverified.`
   - **Re-set the text records under the new keys** — the rename changed them from
     `corroborate.{human,agents,subjects}` to `print.{human,agents,subjects}`
     (`packages/sdk/src/ens-agents.ts:64-68`). Registering the names alone will not fix the tests.
   - Regenerate `deployments/ens-sepolia.json` (namehashes were recomputed offline and are
     correct, but `owner`/`expires` still describe the old registration).
   Scripts live at `scripts/ens-*.mjs`. Nothing on-chain was run this session.

**2. npm — ALREADY PUBLISHED.** `@printid/sdk` is live at **0.1.0 and 0.1.1**, `@printid/mcp` at
**0.1.0**, published as npm user `andreval`. **`@print` was not available** — that is why the
scope is `@printid`, and it is why the workspace has two scopes: the publishable packages are
`@printid/*` while the private apps are `@print/demo` and `@print/agent-demo`.

Two things outstanding on the published packages. **0.1.0 was unimportable** — `enroll.ts`
imported `ontology/enrollment.json` by a path that climbs out of the package, which resolves
into `node_modules` once published; fixed in 0.1.1 by copying the JSON into `src/` during the
build, the same way `adapters.json` was already handled. And the SDK's `description` in
`package.json` still says "proof-of-personhood", which is what renders on the npm package page
while the site says humanity throughout.

**3. Subgraph slug** `corroborate-registry` → `print-registry`, re-created in Graph Studio.

**4. `LIVE_URL_TBD` markers** — README lines 9, 12, 15, 119, 383; `docs/demo-script.md` 7, 13,
49; `apps/demo/public/llms.txt:24`; `apps/demo/index.html` 166 and 1045. These were dead links
to the old box; no host was invented. Needs a deployment decision.

**5. "nobody holds the join key"** — lost with the ticker. It was the sharpest phrasing of the
zero-custody position anywhere on the page. Belongs in the **Humanity, not identity** tablet.

**6. `MORNING.md` still describes the ticker** in four places, in a public repo.

**7. Naming seam.** Marketing says *humanity*; the API says *personhood*. The deployed contract
is `PersonhoodRegistry` (`0x977b…aa07`), the SDK type is `PersonhoodResult`, and the MCP tools
are `lookup_personhood` / `check_personhood`. Renaming means redeploying a contract. Fine for
the hackathon — just be ready for the question.

**8. Hardcoded numbers drift.** The live registry moved from 30 protocols / 18 roots / rev 34
to **32 / 19 / rev 44** during a single day. Sweep for hardcoded figures before submitting;
the manifesto's "eighteen trust roots" was already stale and was removed.

**9. Still owed by the owner:** a "third item" was mentioned twice and never specified.

**Also not started:** submission video, and a final pass on the sponsor-track copy.

---

## Gotchas — read before debugging anything

**`git grep -E` has no `\b` on this machine.** Apple Git 2.39.5 uses POSIX ERE. A word-boundary
search with `-E` silently matches nothing and returns a false all-clear. This burned a whole
verification pass. **Use `-P`.** Add `-i` when you mean case-insensitive.

**`pnpm test` is not offline.** The glob `src/**/*.test.ts` also matches `*.live.test.ts`, and
`ens-agents.live.test.ts` does not self-gate on `LIVE=1` the way the other two do. "Unit tests"
hit the network.

**Node.** The shell sometimes defaults to v16, which breaks pnpm. Always:
`export PATH="/Users/andreinavalentinamarin/.nvm/versions/node/v22.22.2/bin:$PATH"`

**The Browser preview pane is unreliable.** CSS transitions freeze partway, so the hero
headline renders as glyph fragments and `.reveal` sections look blank — an environment
artifact, not a page bug, and not something to "fix". Screenshots sometimes return blank with
`innerWidth: 0`. `getImageData` on the GPU-backed `#print` canvas returns empty unless you blit
into a detached canvas first. **Recovery: `preview_stop` then `preview_start`.** To force final
states: inject `*{transition:none!important;animation:none!important}` plus
`html.js .sl-line{transform:translateY(0)!important}` and
`.reveal{opacity:1!important;transform:none!important}`.

**`.claude/launch.json`** — the one the preview tool reads is at `~/Desktop/claude/.claude/`,
*not* the one inside the repo. Its `--filter` must match the current package name or the server
fails to start.

**The whorl's size is driven by its box height.** `fingerprint.ts` derives the radius from the
canvas box, so *shrinking* the box makes a *smaller* print that sits *further* from the nav —
the opposite of intuition. A canvas is also a replaced element, so it needs explicit
`width`/`height`; insets alone collapse it to 300×150. Current: `top: 2.6rem`,
`height: calc(100% - 2.6rem)`. Masking the whorl to clear the nav was tried twice and rejected
— it amputates the crown and reads as a rendering fault.

**Hero headline copy is width-constrained.** The split-line masks are one per line; a wrapped
line doubles the block and breaks the reveal. At 1280px that caps a line at roughly sixteen
characters *by pixel width*, not character count. The cap comes from the `clamp()` on the h1 —
adjustable if a longer line is worth it.

**`.sl-mask` clips horizontally, not just vertically.** It is `inline-block`, so it shrink-wraps
to the line's advance width — and the italic Fraunces `?` at `WONK 1` throws its swash 0.105em
*past* its advance. `overflow: hidden` then cuts it with a vertical line, which reads to the eye
as a *top* clip. Two fixes aimed at the wrong axis before this was measured. Both
`padding-bottom` (for the `y` descender) and `padding-right` (for the swash) are load-bearing.

**Don't run two subagents on the same files.** It was done once here for speed and survived only
because both used targeted edits and audited their staged diffs. It also produced transient HMR
failures and one "file changed on disk" conflict.

---

## Conventions

- Commit messages explain *why*, in prose, in the existing voice. Look at recent history.
- Local git identity is set to `andrevalenm <51712151+andrevalenm@users.noreply.github.com>`.
- Research prose in `research/` cites primary sources — do not edit findings casually.
- The landing's tone is spare and editorial. The rigour is the asset; dismissiveness is a
  liability. The Circles write-up was rewritten this session to keep every figure and drop
  "close to worthless" — the owner works at Gnosis and Circles is Gnosis-ecosystem.
