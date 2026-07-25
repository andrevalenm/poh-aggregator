# Research brief (shared context for all research tasks)

We are building an **aggregator for proof-of-humanity / sybil-resistance protocols** — conceptually
"1inch for personhood credentials." One API + one embedded flow that routes a user across many
personhood protocols and returns a single normalized humanity assertion.

Every research deliverable exists to answer one question: **can we integrate this, and what is its
credential actually worth in an aggregate score?**

## What every protocol write-up must cover

1. **What it actually proves.** Be precise and skeptical. Distinguish:
   - *uniqueness* (one credential per human, sybil-resistant by construction)
   - *liveness / not-a-bot* (a human was present, but they could hold many)
   - *social trust* (other humans vouch — Sybil-resistant only as far as the graph is honest)
   - *state-issued identity* (a government asserted this person exists)
   - *account age / behavioral heuristics* (weakest)
2. **Trust root & failure modes.** Who can forge it? What does a well-funded sybil farm do?
   Known attacks, documented incidents, credential-selling / rental markets.
3. **On-chain surface.** Chain(s), contract addresses, the exact read functions/views an
   aggregator could call, event topics, subgraphs/indexers. Note explicitly what is on-chain vs.
   off-chain — do not assume.
4. **Integration surface.** SDKs (name, package, language, license), REST APIs, auth/API-key
   requirements, rate limits, pricing, whether self-hosting or permissionless verification is
   possible, and whether we can verify *without* the vendor's cooperation.
5. **Privacy model.** ZK or not? What is revealed to the verifier, to the issuer, to the chain?
   Nullifiers, and whether nullifiers are app-scoped (unlinkable across apps) or global.
6. **Scoring-relevant facts.** Any published score/level semantics (e.g. verification tiers),
   user counts / geographic distribution, cost and friction to obtain, decay/expiry/revocation.
7. **Overlap.** Which other protocols share this one's trust root (same document, same biometric,
   same issuer)? This matters enormously for not double-counting evidence.

## Rules

- **Cite everything.** Every non-obvious claim gets a URL. Prefer primary sources: official docs,
  GitHub repos (link specific files/contracts), block explorers, whitepapers, audit reports.
  Secondary sources (blog posts, news) are fine but must be labeled as such.
- **Date-stamp volatile facts** (user counts, pricing, contract deployments). Today is 2026-07-24.
- **Flag uncertainty explicitly.** Write `UNVERIFIED:` or `UNCLEAR:` inline rather than guessing.
  An honest gap is more useful to us than a confident invention. Never invent a contract address,
  package name, or API endpoint — if you could not find it, say so and say where to look next.
- **Note if a project appears dead / pivoted / abandoned** — with evidence (last commit, last
  release, dead docs site).

## Output format

Write a single markdown file at the path you're given. Structure:

```markdown
# <Protocol>

**One-liner:** …
**Category:** uniqueness | liveness | social-trust | state-identity | behavioral
**Chains:** …
**Status (2026-07):** live / testnet / abandoned — evidence
**Aggregator verdict:** integrate now / integrate later / skip — and why, in 2-3 sentences

## What it proves
## Trust root & failure modes
## On-chain surface
## Integration surface
## Privacy model
## Scoring-relevant facts
## Overlap with other protocols
## Open questions for us
## References
```

Return, as your final message, a ~15-line summary: category, aggregator verdict, the 3 most
important facts, and the biggest open question. Your final text is consumed by the orchestrating
agent, not shown to a human — make it dense, no pleasantries.
