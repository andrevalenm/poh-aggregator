# Demo video script — 3 minutes, screen + voice

Target: one recording covers The Graph tracks (2–4 min required) and doubles as the World
and ENS demo footage. Everything shown is live; nothing needs staging. Rehearse once —
the RPC waits are the only variable, and the lookup chips make them predictable.

Since the redesign: **http://37.27.67.44:8788 is the landing** (hero, ledger, research
instruments); the full workbench is at **/app.html** (comparison panel, per-adapter
evidence). The script uses both.

## Beat sheet

**0:00 — The question, over the hero.** (18s) — http://37.27.67.44:8788
- Let the thumbprint finish inking itself; move the cursor across it once so it deforms.
> "What does it cost to be human? On today's internet: about fifty cents — that's the
> documented resale price of an Orb-verified account. About forty proof-of-personhood
> protocols exist, and they collapse into a handful of trust roots — one passport, read
> by three protocols, is one credential, not three. Corroborate prices every credential
> at what an adversary would actually pay."

**0:18 — The live ledger.** (40s) — scroll to "Ask it about a wallet"
- Click "Three wallets, three protocols". Probes stream with per-adapter latencies.
> "Real wallets, live chains, no server of ours — watch thirty probes answer, ten
> adapters against three wallets. When it settles: three found, twenty-seven empty —
> the machine checked everything and says so. Three different wallets, because real
> people hold credentials on different addresses. And notice the system discounting our
> own demo: that Circles registration is days old, so the survival ramp prices it at
> zero. A farm's fresh accounts get exactly this treatment."
- Let the score STAMP land on camera — the numeral presses in like a seal. It's a beat.
- Drag the threshold slider across the lenient / standard / strict ticks; read a verdict.
> "And no verdict until you choose one — the cutoff is the consumer's decision, priced in
> the open. The API enforces the same rule: isHuman throws without a threshold."

**0:58 — The comparison, in the console.** (30s) — /app.html, comparison panel
- Both columns computed live; farm chips struck through into one root.
> "Here's the honest version of our own pitch: the farm's passport credentials saturate
> into one root. What separates farm from person isn't raw cost — a passport is genuinely
> expensive — it's independence: one root against three. A consumer requiring two
> independent roots admits the person and refuses the farm, same API call."

**1:28 — The Graph, load-bearing.** (30s)
- In the console, run the "A Proof of Humanity member" chip; point at the freshness line.
> "That age weight comes from the credential's real registration date, indexed by our
> subgraph. Proof of Humanity is airdrop-inflated right now, so age is the signal —
> without The Graph this collapses to a flagged midpoint. And it's two subgraphs:
> protocol history on Studio, plus the registry's own audit trail, self-hosted — every
> weight we've ever assigned, with its source and block. 'Why did my score change' is a
> GraphQL query."
- Flash the audit-trail endpoint (37.27.67.44:8100/subgraphs/name/corroborate-registry).

**1:58 — Agent flow.** (35s) — `cd apps/agent && npm start` (pre-run it; scroll the trace)
> "Agents are why this matters now. A counterparty demands proof a human backs the agent.
> Three agents: one unregistered — denied. One backed by a real human with independent
> evidence — allowed. And a third registered to the *same* human — denied, because a
> fleet of agents is still one person. That's World's AgentBook plus our scoring, live.
> The caveat is the honest boundary: we prove a human exists behind the credentials, not
> that the human controls the agent. No protocol today can."

**2:33 — The research instruments, and the close.** (27s) — landing, #research
- Toggle "Load: a sybil farm" then "Load: a real person" on Instrument 01.
> "Every weight is a dated, sourced judgment — so they live on-chain with their sources,
> and the research that produced them is on the page, including the criticisms we can't
> answer. Try to buy a high score yourself: the instrument uses the deployed registry's
> real prices. The registry stores protocols, never people; scoring runs in your browser;
> nobody — including us — holds the join key. Corroborate: confirm with independent
> evidence."

## Recording notes

- Pre-warm the landing ledger and the console panels once before recording so RPC caches
  are hot; probes answer sub-second warm.
- `npm start` in apps/agent takes ~60–90s live; record it separately and cut, or pre-run
  and scroll.
- If asked for per-track cuts: Graph tracks use 1:28–1:58 expanded (add the MCP
  `explain_weight_history` call in a Claude window); World uses 1:58 plus the
  `npm run worldid` QR moment; ENS footage should wait for the mainnet name + subjects
  record (5-min task, see MORNING) and then show `resolve("corroborate.eth")` expanding
  to the declared wallet set with the asserted-not-countersigned caveat.
- The hero press interaction and the ink-press on buttons read beautifully on video —
  linger on them for a beat; they are the design language doing the talking.
- B-roll worth grabbing: the receipt settling from 30 rows to the tally; the terrain
  drifting if you rest on the hero ~15s; the Ohlhaver margin notes beside the lineage
  essay (≥1280px); the sponsor marks on the azulejo tiles.
