# Salvage status

## What happened

On 2026-07-24 a research session (`efd79849-d77b-4fa5-b449-cffdff9d2159`) spawned 21 research
subagents, nested up to 3 levels deep. Between them they ran **238 web searches and 191 page
fetches**. Every one of them was then killed mid-flight by a session usage limit, and every one
ended on the identical message: `You've hit your session limit · resets 3am (Europe/Lisbon)`.

Critically, those agents were instructed *"Do NOT write any files — return your findings as your
final assistant message."* The parent session was supposed to collect the final messages and write
the files. No agent ever got to return one. So **zero research output was written to disk**, even
though the research itself had largely been done.

## What is being salvaged

The fetched page content still exists in the subagent transcripts at:

```
~/.claude/projects/-Users-andreinavalentinamarin/efd79849-d77b-4fa5-b449-cffdff9d2159/subagents/
```

These have been extracted and deduplicated into `.salvage-source/` (gitignored — it is verbatim
third-party page text and is not redistributable). Write-ups below are synthesized from that
material, following the format in [BRIEF.md](BRIEF.md).

## Caveats on salvaged write-ups

Every file produced this way carries a `> Salvaged` note at the top. Salvage is **weaker than
first-pass research**:

- Only what an agent actually fetched survives. Anything it reasoned about but never quoted is gone.
- The agents never got to self-critique or fill their own gaps, so coverage is uneven.
- Claims are only as good as the fetched page. Where a fact could not be confirmed from the
  salvaged material it is marked `UNVERIFIED:` or `UNCLEAR:` rather than guessed.

Treat these as a strong first draft with citations, not as finished research.

## Progress

Written incrementally; each file is committed and pushed as it lands.

| # | Topic | Source agent | Status |
|---|-------|--------------|--------|
| 1 | World ID | `a4434d921a2f98c87` | **done** — [world-id.md](protocols/world-id.md) (failure modes/scale are gaps) |
| 2 | Circles | `a5fe8e1a11cbe3fe7` | **done** — [circles.md](protocols/circles.md) (no adoption numbers) |
| 3 | Humanity Protocol | `a66a8ecf7a50419be` | pending |
| 4 | ZK passport & eID | `aaca5c458e0b44670` | pending |
| 5 | PoH v1/v2, Kleros, BrightID, Idena | `aea9689e84c6782bd` | pending |
| 6 | Passport, Civic, Fractal, zkMe, Galxe, Privado | `acffae4773e27fceb` | pending |
| 7 | Billions, Silk, Unitap, Disco, Sismo, EAS, Intuition | `a11058a55ef29219b` | pending |
| 8 | EAS & Disco.xyz | `a75d4b295ff0369b5` | pending |
| 9 | Privado ID & Verax | `aa43b33d246444fe8` | pending |
| 10 | National ZK identity efforts | `a258b383334c05011` | pending |
| 11 | EU eIDAS 2.0 / EUDI Wallet | `a07119e8eafc7d9b2` | pending |
| 12 | ISO mdoc standards | `a31695934d159bf7c` | pending |
| 13 | Reputation scoring products | `a51bb1fbffb21e39a` | pending |
| 14 | Behavioral / reputation scorers | `a26a2ae8ab8c0ae96` | pending |
| 15 | Demand & regulation | `a4531e46f1592e11c` | pending |
| 16 | Sybil incidents & antipatterns | `ae1e92824d423240f` | pending |
| 17 | KYC / liveness vendors | `aa4fdd3ca2a96941f` | pending |
| 18 | Social-platform & zkTLS signals | `a0302204333859327` | pending |
| 19 | Prior art & scoring | `ad0f283a951518b9f` | pending |
| 20 | Identity infra prior art | `aeda6ededca45f92d` | pending |
| 21 | PoH landscape sweep | `af6763b6be0e144d8` | pending |

## Resuming on another machine

`.salvage-source/` is **not** in the repo, so a fresh clone cannot continue the salvage — the raw
material only exists on the machine that ran the original session. To continue elsewhere, either
copy `.salvage-source/` across manually, or re-run the research for the remaining rows from
[BRIEF.md](BRIEF.md).
