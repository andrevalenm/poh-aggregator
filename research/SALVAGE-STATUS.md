# Salvage status — closed, superseded by a full re-run

> **Outcome (2026-07-24): the salvage was abandoned and all 21 topics were researched from
> scratch instead.** Every row below is done. See [INDEX.md](INDEX.md) for the results.
> This file is kept as a record of what happened and what it cost.

## What happened originally

On 2026-07-24 a research session (`efd79849-d77b-4fa5-b449-cffdff9d2159`) spawned 21 research
subagents, nested up to 3 levels deep. Between them they ran **238 web searches and 191 page
fetches**. Every one of them was then killed mid-flight by a session usage limit, and every one
ended on the identical message: `You've hit your session limit · resets 3am (Europe/Lisbon)`.

Critically, those agents were instructed *"Do NOT write any files — return your findings as your
final assistant message."* The parent session was supposed to collect the final messages and write
the files. No agent ever got to return one. So **zero research output was written to disk**, even
though the research itself had largely been done.

## Why the salvage did not happen

The plan was to recover the fetched page content from the subagent transcripts at
`~/.claude/projects/-Users-andreinavalentinamarin/efd79849-.../subagents/` and synthesise write-ups
from it. That directory exists only on the machine that ran the original session. Work resumed on a
different machine, where it is absent — and `.salvage-source/` is gitignored, so a fresh clone could
never have carried it.

Rather than reconstruct second-hand material, all 21 topics were re-researched directly against
primary sources. The salvage table below was reused as the topic list, and nothing else from the
original run was recovered or needed.

The re-run is **stronger** than the salvage would have been. Where the salvage would have been
limited to whatever an agent happened to quote, the re-run queried contracts over RPC, read repos at
HEAD, and fetched prices the same day — producing measured facts the original never had.

## The lesson, which is the point of keeping this file

**Agents must write to disk incrementally.** The original run lost 238 searches and 191 fetches to a
single interruption because findings lived only in memory, pending a final message that never came.

The re-run inverted that instruction: every agent wrote a skeleton file within its first few tool
calls and folded findings in every 2–4 fetches. This was tested unintentionally and decisively — the
host machine **lost power mid-run, killing 14 agents at once**. Nothing was lost. Eleven files were
already complete, twelve were partial but substantial, and all were recoverable; the interrupted
agents were resumed from their saved transcripts and finished normally.

Same failure, opposite outcome, because of one line in the prompt.

## Result

| # | Topic | Output file |
|---|---|---|
| 1 | World ID | [`protocols/world-id.md`](protocols/world-id.md) |
| 2 | Circles | [`protocols/circles.md`](protocols/circles.md) |
| 3 | Humanity Protocol | [`protocols/humanity-protocol.md`](protocols/humanity-protocol.md) |
| 4 | ZK passport & eID | [`protocols/zk-passport-and-eid.md`](protocols/zk-passport-and-eid.md) |
| 5 | PoH v1/v2, Kleros, BrightID, Idena | [`protocols/poh-kleros-brightid-idena.md`](protocols/poh-kleros-brightid-idena.md) |
| 6 | Passport, Civic, Fractal, zkMe, Galxe | [`protocols/passport-civic-fractal-zkme-galxe.md`](protocols/passport-civic-fractal-zkme-galxe.md) |
| 7 | Billions, Silk, Unitap, Sismo, Intuition | [`protocols/billions-silk-unitap-sismo-intuition.md`](protocols/billions-silk-unitap-sismo-intuition.md) |
| 8 | EAS & Disco.xyz | [`protocols/eas-and-disco.md`](protocols/eas-and-disco.md) |
| 9 | Privado ID & Verax | [`protocols/privado-id-and-verax.md`](protocols/privado-id-and-verax.md) |
| 10 | National ZK identity efforts | [`landscape/national-zk-identity.md`](landscape/national-zk-identity.md) |
| 11 | EU eIDAS 2.0 / EUDI Wallet | [`landscape/eidas2-eudi-wallet.md`](landscape/eidas2-eudi-wallet.md) |
| 12 | ISO mdoc standards | [`landscape/iso-mdoc-standards.md`](landscape/iso-mdoc-standards.md) |
| 13 | Reputation scoring products | [`landscape/reputation-scoring-products.md`](landscape/reputation-scoring-products.md) |
| 14 | Behavioral / reputation scorers | [`landscape/behavioral-scorers.md`](landscape/behavioral-scorers.md) |
| 15 | Demand & regulation | [`landscape/demand-and-regulation.md`](landscape/demand-and-regulation.md) |
| 16 | Sybil incidents & antipatterns | [`landscape/sybil-incidents-antipatterns.md`](landscape/sybil-incidents-antipatterns.md) |
| 17 | KYC / liveness vendors | [`landscape/kyc-liveness-vendors.md`](landscape/kyc-liveness-vendors.md) |
| 18 | Social-platform & zkTLS signals | [`landscape/social-and-zktls-signals.md`](landscape/social-and-zktls-signals.md) |
| 19 | Prior art & scoring | [`landscape/prior-art-scoring.md`](landscape/prior-art-scoring.md) |
| 20 | Identity infra prior art | [`landscape/identity-infra-prior-art.md`](landscape/identity-infra-prior-art.md) |
| 21 | PoH landscape sweep | [`landscape/poh-landscape-sweep.md`](landscape/poh-landscape-sweep.md) |

Added beyond the original 21, from sources supplied during the re-run:

| Topic | Output file |
|---|---|
| Puja Ohlhaver's corpus and its implications | [`references/ohlhaver-corpus.md`](references/ohlhaver-corpus.md) |
| ETHBerlin04 keynote transcript (machine-generated) | [`references/ohlhaver-ethberlin-2024-transcript.md`](references/ohlhaver-ethberlin-2024-transcript.md) |
| PoH vouch-graph sweep script | [`scripts/vouch_sweep.py`](scripts/vouch_sweep.py) |
