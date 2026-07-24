# poh-aggregator (working title)

An aggregator for proof-of-humanity / sybil-resistance protocols — "1inch for personhood."

## Thesis

Personhood credentials today are **segregated liquidity**. Each protocol (Circles, World ID,
Humanity Protocol, ZKPassport, government eIDs, …) has its own users, its own trust semantics,
its own SDK, its own chain, and its own failure modes. An app that wants to know "is this a
unique human?" must integrate each one individually, and then invent its own scoring logic.

This project aggregates them behind **one API / one embedded verification experience**:

- **Input:** an address / session / user.
- **Routing:** find which personhood protocols this user can satisfy (or already satisfies), the
  way a DEX aggregator routes across pools.
- **Output:** a single normalized humanity assertion — score, confidence, uniqueness guarantees,
  and the underlying attestations — that any app or protocol can consume.

## Consumer use cases

- Badge a post as human-written.
- Gate sybil-resistant rewards, airdrops, faucets, quadratic funding.
- Rate-limit / weight governance without full KYC.
- Give protocols a personhood oracle they can read on-chain.

## Hard problems (to be designed, not yet decided)

1. **Commensurability** — what is a Circles trust score *worth* relative to a World ID Orb
   verification or a ZK passport proof? Different protocols prove different things
   (uniqueness vs. liveness vs. social trust vs. state-issued identity).
2. **Correlated failure** — two credentials that both derive from the same document or the same
   biometric are not independent evidence. Aggregation must not double-count.
3. **Privacy composition** — combining credentials can deanonymize. The aggregate must leak less
   than the sum of its parts.
4. **Cross-chain** — World ID is World Chain-native, Circles is Gnosis Chain-native, others are
   off-chain VCs. Where does the aggregate live and how is it verified?
5. **Revocation & freshness** — scores decay, trust graphs change, credentials get revoked.

## Repo layout

```
research/
  protocols/   one deep-dive per protocol (contracts, SDKs, trust model, integration surface)
  landscape/   broad sweeps: who else exists, standards, prior-art aggregators
  INDEX.md     master index of all research + references
docs/          design docs (scoring model, API shape, USP) — written after research lands
```

## Status

Research phase. Nothing implemented yet.
