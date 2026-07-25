# Morning brief

Overnight build log for **Corroborate** — the personhood aggregator. Read this instead of
the git log; the log has the detail if you want it.

_Last updated: 2026-07-25, during the build._

---

## What works right now

| Piece | State | Where |
|---|---|---|
| `PersonhoodRegistry.sol` | **Deployed + seeded** | Sepolia `0x17e7f009d9ef1b6fe0809e3f0a4bf89114cc66c9` |
| Ontology | 15 adapters, 10 trust roots | `ontology/adapters.json` |
| SDK | Builds, 30 tests green | `packages/sdk` |
| MCP server | Verified over stdio | `packages/mcp` |
| Subgraph | in progress | `subgraph/` |
| ENS | not started | — |
| World IDKit / AgentKit | not started | — |
| Demo | not started | — |

Run it yourself:

```bash
cd packages/sdk && npm test          # 19 unit tests
node --test --experimental-strip-types src/live.test.ts   # 11 live tests, real chains
cd ../.. && PATH=$HOME/.foundry/bin:$PATH forge test      # 17 contract tests
```

---

## Decisions I made without you

All cheap to reverse. Say the word on any of them.

1. **Name: Corroborate.** It means "confirm with independent evidence", which is the thesis.
   npm scope `@corroborate/*`. Repo dir unchanged.
2. **Deploy target moved from Base Sepolia to Sepolia** — you funded Sepolia, ENS's testnet is
   there, and Graph Studio supports it. No bridging, and the registry shares a chain with the
   ENS work.
3. **Score is log₁₀ of summed root-cost**, roughly 0–4. Continuous, never a grade.
4. **`isHuman(threshold)` throws without an explicit threshold.** At a 2% sybil rate a
   95%-specificity classifier misjudges ~73% of the people it flags, so denial is the
   caller's call. Enforced in the type system, not in a doc.
5. **Cost is `min(forge, rent)`.** Every protocol that hardened did so against *sale* and
   none against *rental*. Taking the min means security work addressing only resale cannot
   inflate a score.
6. **Registry curator is the burner EOA.** Honest and auditable, not decentralised, and the
   README will say so.

---

## The finding that changed the design

I went looking for a real address holding credentials from two protocols, to use in the demo.
**There isn't one.** Across 31 credential-holding addresses found live on Gnosis and World
Chain, not a single one held two protocols on the same address — and Proof of Humanity's own
Circles proxy pairs a PoH address with a *separate* Circles avatar. One human, one wallet per
protocol.

That breaks the address-keyed model. A real person with World ID on one wallet and Circles on
another reads as two weak subjects instead of one strong one.

So `resolve()` now takes an **address set**, supplied and authenticated by the caller. We
never infer that two addresses belong to one person — that inference is the linkage we exist
to avoid. Saturation spans the set, so spreading correlated credentials over wallets does not
pay, and there's a test asserting one passport on two wallets scores the same as on one.

Verified live: two real wallets → 2 independent roots → score 2.74.

---

## Needs your judgment

**1. The demo's multi-root example.** Since no natural multi-credential address exists, the
two-wallet comparison has to either use a real address *set* (honest, and now supported) or a
constructed illustration. I'm building it with real sets. Flagging because it's a
presentation choice you may feel differently about.

**2. World ID has no positive vector yet.** AgentBook emitted no indexable registration events
in the windows I scanned, so I have no confirmed Orb-verified address to demo against. Options:
your own World App account if you have one verified, or the World ID Simulator. Doesn't block
the build — the adapter is verified working, it just returns `false` for everyone I've tried.

**3. ENS name.** Registering `corroborate.eth` on Sepolia unless you own something on mainnet
you'd rather use.

**4. That World portal API key is in the chat transcript.** Rotate it after the hackathon.

---

## Known gaps and honest caveats

- **PoH issuance dates are unavailable** from the contract read alone, so no decay is applied
  and the result carries an `issuance-date-unknown` caveat. The subgraph will fix this.
- **Registry weights are my dated judgements**, derived from `research/`, not measurements.
  Each carries its `sourceURI`. This is the honest weak point of the whole design.
- **PoH is currently airdrop-inflated** — ~1,299 of 1,364 lifetime registrations arrived in
  four months tracking a $9.94 PNK claim. Its weight should be revisited in October when the
  pool empties.
- **Nothing attests independent control.** Every result carries a permanent
  `independent-control-not-attested` caveat. That is Ohlhaver's critique accepted into the
  design rather than argued away.
