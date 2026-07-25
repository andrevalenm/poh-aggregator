# Demo video script — 3 minutes, screen + voice

Target: one recording covers The Graph tracks (2–4 min required) and doubles as the World
and ENS demo footage. Everything shown is live; nothing needs staging. Rehearse once —
the RPC waits are the only variable, and the lookup chips make them predictable.

## Beat sheet

**0:00 — The problem, over the README diagram.** (20s)
> "About forty proof-of-personhood protocols exist. They collapse into roughly six trust
> roots — one passport, read by three protocols, is one credential, not three. Every
> deployed scorer adds these up anyway, which means a sybil farm with correlated
> credentials outscores a real person with diverse ones. Corroborate scores what an
> adversary would actually pay."

**0:20 — Hosted demo, comparison panel.** (40s) — http://37.27.67.44:8788
- Let both columns finish. Point at the farm column: three credentials, struck through,
  one root. Then the person column: fewer dollars, more roots.
> "Same number of credentials. The farm's all come from one passport — we saturate them
> into one root. And we say plainly what inverts and what doesn't: not the raw cost —
> a passport is genuinely expensive — but independence. A consumer requiring two
> independent roots admits the person and refuses the farm, same API call."

**1:00 — Lookup panel, chip: "Three wallets, three roots".** (35s)
- Click the chip; per-adapter probes stream in.
> "Real wallets, live chains. An Orb-verified wallet, a Proof of Humanity registration,
> a Circles account — three different wallets, because real people actually hold
> credentials on different addresses. Three independent roots. And no verdict: the
> threshold slider is the consumer's, not ours. At realistic sybil rates a strong
> classifier is wrong about most of the people it flags — so denial is a decision we
> refuse to automate."
- Drag the slider once each way. Point at the caveats block, read the first line of
  `independent-control-not-attested`.

**1:35 — The Graph, load-bearing.** (30s)
- Chip: "A 2024 PoH survivor". Point at the PoH row: freshness ~73%.
> "This weight is computed from the credential's real age, indexed by our subgraph —
> registration during last week's airdrop weighs almost nothing, two years of survival
> weighs a lot. Without The Graph this number degrades to a flagged midpoint: same
> wallet, 2.40 instead of 2.56. And it's two subgraphs: protocol history on Studio, and
> the registry's audit trail self-hosted — every weight we've ever assigned, with its
> source and block. 'Why did my score change' is a GraphQL query."
- Flash the audit-trail query result (terminal or browser at
  `37.27.67.44:8100/subgraphs/name/corroborate-registry`).

**2:05 — Agent flow.** (35s) — `cd apps/agent && npm start` (pre-run it; scroll the trace)
> "Agents are why this matters now. A counterparty demands proof a human backs the
> agent. Watch three agents: one unregistered — denied. One backed by a real human with
> three independent roots — allowed. And a third, registered to the *same* human —
> denied, because a fleet of agents is still one human. That's World's AgentBook plus
> our scoring, live, and the caveat is the honest boundary: we prove a human exists
> behind the credentials, not that the human controls the agent. No protocol today can."

**2:40 — Close.** (20s) — README honest-limits section on screen
> "Weights are curated judgments — so they live on-chain with their sources, every
> change is an event, and the audit trail is public. The registry stores protocols,
> never people: scoring runs client-side and nobody, including us, holds the join key.
> Corroborate: confirm with independent evidence."

## Recording notes

- Pre-warm both panels once before recording so RPC caches are hot.
- `npm start` in apps/agent takes ~60–90s live; record it separately and cut, or pre-run
  and scroll.
- If asked for per-track cuts: Graph tracks use 1:35–2:05 expanded (add the MCP
  `explain_weight_history` call in a Claude window); World uses 2:05 plus the
  `npm run worldid` QR moment; ENS footage should wait for the mainnet name + subjects
  record (5-min task, see MORNING) and then show `resolve("corroborate.eth")` expanding
  to the declared wallet set with the asserted-not-countersigned caveat.
