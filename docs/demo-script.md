# Demo video script — 3 minutes, screen + voice

Target: one recording covers The Graph tracks (2–4 min required) and doubles as the World
and ENS demo footage. Everything shown is live; nothing needs staging. Rehearse once —
the RPC waits are the only variable, and the lookup chips make them predictable.

**The spine of the script is independence, not price.** One passport read by four protocols is
one credential, not four. Every beat is that sentence being demonstrated on live data. The cost
model is what makes the weighting principled and it is on the page for anyone who digs, but it is
never the pitch: it needs three unfamiliar ideas before it pays off, and the punchline it seems to
promise — "the farm scores lower" — is not true in general. The root count is the claim that
survives contact with the numbers.

Two surfaces: **[print.observer](https://print.observer) is the landing** (hero, manifesto,
live lookup, install, three use cases, three case studies, tracks); the **console is at
[/app.html](https://print.observer/app.html)** (farm-vs-person comparison, per-adapter evidence).
The script uses both.

## Beat sheet

**0:00 — The claim, over the hero.** (20s) — print.observer
- Let the thumbprint finish inking itself; move the cursor across it once so it deforms.
> "Is a real person behind this address? Dozens of proof-of-personhood protocols will sell you
> an answer — our survey counts about forty. The catch is that they are not forty answers.
> Print's registry catalogues thirty of them and they sit on eighteen trust roots, because one
> passport chip is read by World's document tier, by ZKPassport, by Self and by Rarimo. **One
> passport read by four protocols is one credential, not four.** Print reports which credentials
> an address holds and how many independent roots they actually rest on."

**0:20 — The live lookup.** (45s) — scroll to "Ask it about a wallet"
- Click the first chip, "Three wallets, three protocols". Probes stream with per-adapter
  latencies; every implemented adapter runs against every wallet.
> "Real wallets, live chains, no server of ours. Every adapter against every address, and it
> reports the misses as loudly as the hits — the machine checked everything and says so. Three
> wallets, because real people hold credentials on different addresses, and correlated
> credentials still collapse across the set, so spreading them over wallets buys nothing."
- Land on the result. Point at the independent-root count and the default rule printed beside it.
> "Two independent roots, named. That is the default this page applies to give you a yes or a
> no — and it prints the rule next to the answer, because a default is somebody's choice, not a
> fact. And notice it discounting our own demo: that Circles registration is days old, so the
> survival ramp prices it near zero. A farm's fresh accounts get exactly this treatment."
- Drag the threshold slider across the lenient / standard / strict ticks; read a verdict.
> "The library ships no default at all. isHuman throws without an explicit threshold — at
> realistic sybil rates a strong classifier is wrong about most of the people it flags, so
> whoever bears the cost of being wrong picks the line."

**1:05 — The farm and the person, in the console.** (40s) — /app.html, comparison panel
- Both columns computed live from the deployed registry; the farm's chips strike through into one
  root.
> "Here is our own pitch, with the part that does not flatter us left in. On the left, one
> passport presented to every protocol that reads passports. Counting credentials, it wins — and
> after we collapse them into the single root they share it *still* outscores the person on the
> right, because a passport is genuinely expensive and our model says so rather than fudging the
> weight."
- Point at the two root counts.
> "What inverts is independence: one root against four. That is the number to gate on, and no
> additive score can express it, because addition has no way to say 'those two proofs were the
> same proof'. A consumer requiring two independent roots admits the person and refuses the
> farm, from the same API call."

**1:45 — The Graph, load-bearing.** (30s)
- In the console, run the "A Proof of Humanity v2 member" chip; point at the freshness line.
> "Independence is not the whole story — a root has to be worth something, and age is most of
> that. This weight comes from the credential's real registration date, indexed by our subgraph.
> Proof of Humanity is airdrop-inflated right now, so age is the signal, and without The Graph
> it collapses to a flagged midpoint. Two subgraphs: protocol history on Studio, plus the
> registry's own audit trail — every weight we have ever assigned, with its source and its
> block. 'Why did my score change' is a GraphQL query."
- Flash the audit-trail endpoint (REGISTRY_SUBGRAPH_URL_TBD).

**2:15 — Agents.** (30s) — `cd apps/agent && npm start` (pre-run it; scroll the trace)
> "Agents are why this matters now. A counterparty demands proof a human backs the agent. One
> unregistered — denied. One backed by a human with independent evidence — allowed. A third
> registered to the *same* human — denied, because a fleet of agents is still one person. Same
> idea one level up: count the humans, not the registrations. That is World's AgentBook plus our
> scoring, live."

**2:45 — The close.** (15s) — landing, #research then the footer
> "Every weight is a dated, sourced judgement, so they live on-chain with their sources and the
> research behind them is on the page, including the criticism we cannot answer. The registry
> stores protocols, never people. Scoring runs in your browser, so nobody — including us — holds
> the join key. And the permanent caveat: we can show a real person's evidence, not that the
> person controls their own credentials. No protocol today can. Print: count the roots, not the
> badges."

## Recording notes

- Pre-warm the landing lookup and the console panels once before recording so RPC caches
  are hot; probes answer sub-second warm.
- `npm start` in apps/agent takes ~60–90s live; record it separately and cut, or pre-run
  and scroll.
- Chip labels on both surfaces are read from the demo source and may be reworded — use the
  first chip in the row, whatever it is called, since it is the multi-wallet subject.
- The 0:20 beat assumes the landing shows a default verdict at **two independent roots** with the
  rule printed beside it. Check that is on the page before recording; if it is not, cut the two
  sentences about the default and go straight from the root count to the threshold slider.
- Do not quote a probe count on camera ("watch thirty probes answer"). The implemented-adapter
  count moves between branches, and the number times three wallets goes stale mid-edit. "Every
  adapter against every address" is true either way.
- If asked for per-track cuts: Graph tracks use 1:45–2:15 expanded (add the MCP
  `explain_weight_history` call in a Claude window — it is the audit trail, and
  `explain_trust_roots` is the one that shows the collapse); World uses 2:15 plus the `npm run worldid`
  QR moment; ENS uses `npm run ens` in apps/agent — the agent presents a name, and the
  counterparty resolves the human behind it, that human's declared wallet set and every sibling
  agent under the tree, with the asserted-not-countersigned caveat on screen.
- The hero press interaction and the ink-press on buttons read beautifully on video —
  linger on them for a beat; they are the design language doing the talking.
- B-roll worth grabbing: the probe stream settling from every-adapter-pending to the tally; the
  strike-through as the farm's four credentials fold into one root; the terrain drifting if you
  rest on the hero ~15s; the sponsor marks on the azulejo tiles.
