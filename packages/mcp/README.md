# @print/mcp

An MCP server that lets an AI agent ask whether a real human stands behind an address —
and, more usefully, **why**. Built on [The Graph](https://thegraph.com): credential issuance
dates and trust-graph position come from a live subgraph, which is what turns a boolean
contract read into evidence with age and weight.

Works with any MCP client (Claude Code, Claude Desktop, Cursor, or your own agent loop).

## Install

```bash
# from the repo root
cd packages/sdk && npm i && npm run build
cd ../mcp && npm i && npm run build
```

Register with your MCP client — for Claude Code:

```bash
claude mcp add print \
  --env PRINT_SUBGRAPH_URL=https://api.studio.thegraph.com/query/77602/poh/version/latest \
  -- node /path/to/poh-aggregator/packages/mcp/dist/server.js
```

Or as JSON config (Claude Desktop / Cursor):

```json
{
  "mcpServers": {
    "print": {
      "command": "node",
      "args": ["/path/to/poh-aggregator/packages/mcp/dist/server.js"],
      "env": {
        "PRINT_SUBGRAPH_URL": "https://api.studio.thegraph.com/query/77602/poh/version/latest"
      }
    }
  }
}
```

| Env var | Default | Purpose |
|---|---|---|
| `PRINT_SUBGRAPH_URL` | *(unset)* | The Graph endpoint supplying issuance dates and graph position. Without it the server still works, but age weights fall back to flagged midpoints. With it, weights are computed from real registration age — a live PoH wallet moves from the 2.40 midpoint to a computed weight that reflects its actual age (freshly-renewed credentials weigh less, long-survived ones more). |
| `PRINT_REGISTRY` | Sepolia `0x977b…aa07` | The on-chain trust-root ontology to score against. |

## Tools

**`lookup_personhood`** — every credential for an address / ENS name / set of addresses,
scored by independent trust root. Returns evidence, what was discounted as correlated, and
all caveats. Pass several addresses when one person controls several wallets — real users
hold different credentials on different addresses.

**`check_personhood`** — pass/fail against a threshold **you** supply. There is no default
threshold on purpose: at a plausible sybil rate a strong classifier still misjudges most of
the people it flags, so the decision to deny belongs to the caller. Presets and their
derivations ship in the SDK (`Thresholds.lenient/standard/strict` = 1.5/2.5/3.5).

**`explain_weight_history`** — the audit trail for one adapter, from the registry
subgraph: every weight ever assigned, each with its source and the block it landed in.
Enable with `PRINT_REGISTRY_SUBGRAPH_URL`.

**`explain_trust_roots`** — the ontology itself: every known personhood protocol, what it
proves, which trust root it reads, what it costs to forge or *rent*, with shared roots
marked. Use it to understand why two credentials might not be independent evidence.

Example output:

```
subject: 0x17a91203a9e9c3519c2f76210497ef7f4be2352f
score: 2.56  (log10 of adversary cost in cents)
independent trust roots: 1
total adversary cost: $3.63

credentials held:
  - Proof of Humanity v2 (SocialTrust) root=social-vouching:poh on 0x17a9…352f, freshness 73%

caveats:
  - [independent-control-not-attested] No protocol here proves the subject controls their
    own credentials. …
```

## Design refusals

Two deliberate ones shape this surface:

1. **No tool returns a bare boolean.** Every response carries the evidence, the correlation
   structure, and the caveats — an agent acting on a bare number cannot reason about its
   own uncertainty.
2. **Nothing writes, nothing is remembered.** The server reads public chains and a public
   registry, holds no user state, and cannot be asked to remember that two addresses belong
   to one person. Aggregating credentials centrally would create exactly the correlation
   honeypot the underlying protocols' nullifier designs exist to prevent.

## Where the data comes from

- Trust-root ontology: `PersonhoodRegistry` on Sepolia (weights carry their source URI;
  every change emits an event).
- Credentials: permissionless reads on World Chain (AgentBook), Gnosis (PoH v2, Circles v2)
  and Base (EAS/Coinbase) — no vendor API on the critical path.
- Age and graph position: the Print subgraph on The Graph (PoH `claimedAt`, vouch
  edges, Circles trust edges with net-active counting).

MIT. Part of [Print](../../README.md); scoring model in [docs/scoring.md](../../docs/scoring.md).
