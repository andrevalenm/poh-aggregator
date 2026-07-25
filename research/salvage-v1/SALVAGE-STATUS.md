# Salvage status

## What happened

On 2026-07-24 a research session (`efd79849-d77b-4fa5-b449-cffdff9d2159`) spawned 21 research
subagents, nested up to 3 levels deep. Between them they ran **238 web searches and 191 page
fetches**. Every one of them was then killed mid-flight by a session usage limit, and every one
ended on the identical message: `You've hit your session limit · resets 3am (Europe/Lisbon)`.

One agent hit a second ceiling first: it exhausted the session's **200-call web search budget**
("200 of 200 WebSearch calls") and fell back to direct fetches before the session limit killed it
too. Two others were blocked by the **20-concurrent-subagent limit**. So three separate resource
ceilings shaped what survives.

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
| 3 | Humanity Protocol | `a66a8ecf7a50419be` | **done** — [humanity-protocol.md](protocols/humanity-protocol.md) (mainnet offline after hack) |
| 4 | ZK passport & eID | `aaca5c458e0b44670` | **done** — [zk-passport-and-eid.md](protocols/zk-passport-and-eid.md) (ZKPassport deep; Self thin; Aadhaar/Rarimo absent) |
| 5 | PoH v1/v2, Kleros, BrightID, Idena | `aea9689e84c6782bd` | **done** — [poh-classics.md](landscape/poh-classics.md) |
| 6 | Passport, Civic, Fractal, zkMe, Galxe, Privado | `acffae4773e27fceb` | **done** — [commercial-identity-vendors.md](landscape/commercial-identity-vendors.md) |
| 7 | Billions, Silk, Unitap, Disco, Sismo, EAS, Intuition | `a11058a55ef29219b` | **done** — [attestation-layers-and-adjacent.md](landscape/attestation-layers-and-adjacent.md) |
| 8 | EAS & Disco.xyz | `a75d4b295ff0369b5` | **done** — [attestation-substrates.md](landscape/attestation-substrates.md) |
| 9 | Privado ID & Verax | `aa43b33d246444fe8` | **done** — merged into [attestation-substrates.md](landscape/attestation-substrates.md) |
| 10 | National ZK identity efforts | `a258b383334c05011` | **done** — [national-zk-identity.md](landscape/national-zk-identity.md) |
| 11 | EU eIDAS 2.0 / EUDI Wallet | `a07119e8eafc7d9b2` | **done** — [government-standards-track.md](landscape/government-standards-track.md) |
| 12 | ISO mdoc standards | `a31695934d159bf7c` | **done** — merged into [government-standards-track.md](landscape/government-standards-track.md) |
| 13 | Reputation scoring products | `a51bb1fbffb21e39a` | **done** — [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md) |
| 14 | Behavioral / reputation scorers | `a26a2ae8ab8c0ae96` | **done** — merged into [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md) |
| 15 | Demand & regulation | `a4531e46f1592e11c` | **done** — [demand-and-regulation.md](landscape/demand-and-regulation.md) (regulation only; demand side never researched) |
| 16 | Sybil incidents & antipatterns | `ae1e92824d423240f` | **done** — [sybil-incidents-and-antipatterns.md](landscape/sybil-incidents-and-antipatterns.md) |
| 17 | KYC / liveness vendors | `aa4fdd3ca2a96941f` | **done** — [kyc-vendors-and-web2-signals.md](landscape/kyc-vendors-and-web2-signals.md) |
| 18 | Social-platform & zkTLS signals | `a0302204333859327` | **done** — merged into [kyc-vendors-and-web2-signals.md](landscape/kyc-vendors-and-web2-signals.md); zkTLS never researched |
| 19 | Prior art & scoring | `ad0f283a951518b9f` | **done** — orchestrator; content merged into [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md) |
| 20 | Identity infra prior art | `aeda6ededca45f92d` | **n/a** — orchestrator only; its children are rows 8, 9 and 6 |
| 21 | PoH landscape sweep | `af6763b6be0e144d8` | **n/a** — orchestrator only; its children are rows 5, 6, 7, 14, 17, 18 |

## Salvage complete

All 21 rows are resolved: **19 write-ups produced, 2 orchestrator agents with no unique research of
their own.** Roughly 1.35 MB of deduplicated fetched page content was read and synthesized into 13
files under `protocols/` and `landscape/`.

**The largest remaining holes** — none of which are recoverable from the transcripts, because the
agents died before running the searches:

- **Credential rental and resale markets** (World ID orb accounts, KYC-as-a-service farms, aged
  social accounts). Directly undermines or supports our core premise and we have no data.
- **World ID failure modes** — regulatory bans by country, credential-selling, biometric criticism.
- **Self Protocol** — contracts, SDK, nullifier design. Nearly everything.
- **Anon Aadhaar and Rarimo** — never researched.
- **zkTLS providers** (Reclaim, zkPass, Opacity, Primus, TLSNotary) — never researched.
- **Adoption numbers almost everywhere** — PoH v2, Circles, World ID, Idena all lack verified counts.
- **The demand side** — who pays for sybil resistance today, and how much.

## Resuming on another machine

`.salvage-source/` is **not** in the repo, so a fresh clone cannot continue the salvage — the raw
material only exists on the machine that ran the original session. To continue elsewhere, either
copy `.salvage-source/` across manually, or re-run the research for the remaining rows from
[BRIEF.md](BRIEF.md).
