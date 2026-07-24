# Circles (CirclesUBI)

**One-liner:** A personal-currency / UBI protocol on Gnosis Chain where every registered human mints
their own ERC-1155 token at 1 CRC/hour, and a directed **trust graph** between avatars decides whose
tokens are mutually acceptable — the "credential" is a *position in that graph*, not a verification event.
**Category:** social-trust (explicitly **not** uniqueness — no document, no biometric, no liveness check anywhere in the protocol)
**Chains:** Gnosis Chain (chainId 100) exclusively
**Status (2026-07):** **live and actively shipping.** v2 is canonical; v1 is legacy-but-live.
Hub v2 deployed on Gnosis mainnet ~Oct 2024, public launch 21 May 2025, 403,831 txs as of 2026-07-24
([Gnosisscan](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8)). 26,040 v2
humans / 473k v2 trust edges; 1,213 humans minted in the last 24h (queried live 2026-07-24).
`aboutcircles` GitHub org has pushes within the last week (2026-07-20).
**Aggregator verdict:** **integrate later, as a graph-derived modifier — never as a standalone proof.**
The binary "has a Circles avatar" credential is worth ~0: registration costs ~2 days of freely-minted
CRC plus gas, and there is on-chain evidence of a 5,000-account bot farm run by one maintainer. But the
trust *graph* is fully public, permissionlessly computable with zero vendor dependency, and the protocol's
own whitepaper supplies the correct attack-resistant metric (max-flow to a seed set) with a production
service already computing it. It is the only genuinely biometric-free, document-free trust root in our
set — orthogonal evidence, worth having once we can compute it properly.

---

## What it proves

**Precisely: nothing about a human's uniqueness or existence.** Registering as a "human avatar" in
Circles v2 requires exactly one thing: an existing registered human called `trust(you, expiry)` and
then you call `registerHuman(inviter, metadataDigest)`. No document, no selfie, no phone, no liveness,
no proof-of-anything. The inviter burns 96 of their own personal Circles.

What a Circles account is *weak* evidence of:
- **Social trust** — someone already in the network chose to spend 4 days of their own issuance on you.
- **Embeddedness** — if many *distinct, active, well-connected* humans trust you, and they in turn are
  trusted by disjoint parts of the graph, that is genuine (probabilistic) evidence of a real social
  presence. This is a *continuous, graph-derived* signal, not a binary credential.
- **Liveness over time** — `personalMint()` claims are on-chain and capped at 14 days retroactive, so a
  long unbroken minting history is cheap-to-verify proof of *someone* attending the account for months.
  (Trivially automatable by a bot, so this is proof of *persistence*, not of *humanity*.)

What it is emphatically **not**: it is not one-credential-per-human. There is no nullifier, no
deduplication mechanism, and nothing preventing one person from holding an arbitrary number of human
avatars. The protocol's own docs frame Circles as a money protocol, not a personhood protocol.

## Trust root & failure modes

### The invitation cost is a rate limiter, not a sybil barrier

From `src/hub/Hub.sol` ([source](https://github.com/aboutcircles/circles-contracts-v2/blob/beta/src/hub/Hub.sol)):

```solidity
uint256 private constant WELCOME_BONUS   = 48 * EXA;   // 48 CRC minted to the invitee
uint256 private constant INVITATION_COST = 2 * WELCOME_BONUS; // 96 CRC burnt by the inviter
```

Issuance is 1 CRC/hour = **24 CRC/day**. So:

- An invitation costs the inviter **4 days of their own issuance** (96 / 24).
- The invitee is immediately credited **48 CRC = 2 days**, so a fresh sybil needs only **2 more days**
  of minting before it can itself invite.
- **Net cost of adding a node to the graph: 48 CRC ≈ 2 days of one account's issuance, plus Gnosis gas
  (fractions of a cent).**

The consequence is an exponential farm with a doubling time of roughly **2–4 days**. Starting from a
single legitimate account, an attacker reaches ~1,000 avatars in about a month and ~10^6 in two months,
bounded only by gas and by having to call `personalMint()` at least every 14 days (`MAX_CLAIM_DURATION
= 2 weeks` in `src/circles/Circles.sol`). There is **no monetary cost denominated in any scarce asset** —
CRC is minted from nothing by the accounts doing the inviting.

> **This is the single most important fact for the aggregator: "has a Circles human avatar" is worth
> approximately zero as a uniqueness signal.** Only graph structure and the identity of the trusters
> carry information.

### Trust edges are free

`trust(address _trustReceiver, uint96 _expiry)` costs only gas, is **unilateral/directional**, can point
at an unregistered address, and can be revoked by setting expiry to now. There is no stake, no bond, no
reciprocity requirement. A sybil cluster can therefore create a **complete graph among its own nodes at
gas cost only**, producing arbitrarily high in-degree, arbitrarily high clustering coefficient, and
arbitrarily long apparent history.

This means **degree-based scoring is worthless**. Only measures that are *attack-resistant on the cut
between the honest region and the sybil region* have any value:
- **Max-flow / min-cut from a trusted seed set** (SybilGuard/SybilLimit/Canal family). The Circles
  pathfinder already computes exactly this quantity (max flow through trust edges).
- **Personalized PageRank / TrustRank seeded on a hand-curated honest set** — the sybil region can only
  absorb rank proportional to the number of *attack edges* (honest→sybil trust edges), regardless of how
  many nodes or internal edges it contains.

Both reduce to the same practical requirement: **an aggregator must supply its own seed set of
believed-honest avatars.** Without a seed, no purely structural score is attack-resistant.

### The attack edge is the real bottleneck — and it is cheap

The one thing an attacker cannot mint is *trust from a genuinely honest, well-embedded human*. But in
practice these are acquired cheaply:
- Circles' own tooling actively industrialises invitations: `aboutcircles/circles-invitation-at-scale`,
  `aboutcircles/invite-api`, `aboutcircles/circles-invitation-links-manager`, and an `InvitationModule`
  Safe module where a **funding bot** grants the inviter "temporary trust valid only for the current
  block" ([docs](https://docs.aboutcircles.com/circles-sdk/invitations-and-referrals.md)). Bulk
  onboarding by a single operator is a first-class supported flow, which by construction produces
  large star-shaped clusters rooted in one entity.
- Real-world Circles onboarding has historically been meetup/market based (Berlin, Nairobi, Bangalore),
  where trusting a stranger you met once is normal.

UNVERIFIED: documented, named sybil clusters. See "Open questions".

## On-chain surface

### Deployed contracts (Gnosis Chain, chainId 100)

All addresses below were **verified live against a public Gnosis RPC (`https://rpc.gnosischain.com`) on
2026-07-24**, not just copied from docs.

| Contract | Address | Verification |
|---|---|---|
| **Hub V2** (ERC-1155, "Circles (CRC)") | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` | `name()` → `"Circles"`. [Gnosisscan](https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8) labels it "Circles: Circles Hub (V2)"; verified source, Solidity 0.8.24, AGPL-3.0, deployed ~Oct 2024, **403,831 txs** as of 2026-07-24 |
| **Hub V1** (legacy) | `0x29b9a7fBb8995b2423a71cC17cf9810798F6C543` | **Confirmed**: `name()` → `"Circles"`, and `userToToken(0x9a0bbbbd…)` → `0x333d72f5…` for a known v1 avatar. This is the v1 Hub. |
| Name Registry | `0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474` | has code (12,406 hex chars) |
| Migration (v1→v2) | `0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376` | has code (5,064) |
| Base Mint Policy (groups) | `0xcCa27c26CF7BAC2a9928f42201d48220F0e3a549` | has code (2,680) |

Address source: <https://docs.aboutcircles.com/llms-full.txt> (fetched 2026-07-24).

**`invitationOnlyTime` read live from Hub v2** (selector `0x2f01b98b`) = `0x6737e088` =
**2024-11-16T00:00:08 UTC**. Before that timestamp, any v1 user whose v1 token was *stopped* could
self-register into v2 with `inviter == address(0)` and **zero invitation cost**. Every avatar registered
before 2024-11-16 therefore inherits its trust root from Circles v1, not from a v2 invitation.

> Note: the block `47366275` in the explorer URL supplied to me is **not** the v2 deployment block — it
> is `2026-07-24T14:11:10 UTC`, i.e. a *recent* block (checked via `eth_getBlockByNumber`). It is a
> "start scanning from here" convenience parameter, not a protocol constant.

### Hub v2 read functions an aggregator would call

All from `src/hub/Hub.sol` (verified source on Gnosisscan):

| Function | Use |
|---|---|
| `isHuman(address) -> bool` | is this address a registered human avatar |
| `isGroup(address) -> bool` / `isOrganization(address) -> bool` | avatar type discrimination |
| `avatars(address) -> address` | public linked-list mapping; non-zero ⇒ registered. Also enumerable from `SENTINEL = 0x1` |
| `trustMarkers(address truster, address trustee) -> TrustMarker` | **public mapping** — raw directed trust edge + expiry |
| `isTrusted(address truster, address trustee) -> bool` | edge live now (expiry >= block.timestamp) |
| `isPermittedFlow(from, to, circlesAvatar) -> bool` | trust check including "consented flow" advanced flag |
| `calculateIssuance(address human) -> (issuance, startPeriod, endPeriod)` | **liveness oracle** — `startPeriod` is derived from `lastMintTime`, so unclaimed issuance ⇒ dormancy. `mintTimes` itself is `internal`, so this view (or the event log) is the way in |
| `stopped(address human) -> bool` | human has permanently stopped minting |
| `mintPolicies(address group)` / `treasuries(address group)` | group configuration |
| `advancedUsageFlags(address)` | consented-flow bit |
| `balanceOf(address, uint256 id)` | ERC-1155; token id = `uint256(uint160(avatar))` |

### Events (topic sources for an indexer)

```solidity
event RegisterHuman(address indexed avatar, address indexed inviter);
event RegisterOrganization(address indexed organization, string name);
event RegisterGroup(address indexed group, address indexed mint, address indexed treasury, string name, string symbol);
event Trust(address indexed truster, address indexed trustee, uint256 expiryTime);
event Stopped(address indexed avatar);
event GroupMint(address indexed sender, address indexed receiver, address indexed group, uint256[] collateral, uint256[] amounts);
event PersonalMint(address indexed human, uint256 amount, uint256 startPeriod, uint256 endPeriod); // in src/circles/Circles.sol
event StreamCompleted(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] amounts);
```

`RegisterHuman` carrying `inviter` indexed is extremely useful: **the entire invitation tree is
reconstructible from logs**, which is exactly what you need to detect farms (one root, huge subtree).

`Trust(truster, trustee, expiryTime)` with both indexed gives the full directed graph with timestamps —
edge *creation time* and *expiry* both recoverable. Revocation = a `Trust` event with expiry <= now.

### Permissionless computation

**Yes — everything above is derivable from Gnosis Chain logs alone.** No vendor, no API key. An
aggregator can run its own indexer (or use any Gnosis archive RPC) over `RegisterHuman`, `Trust`,
`PersonalMint`, `Stopped` and reconstruct the full graph plus liveness. This is a significant advantage
over most personhood protocols. Off-chain-only data is limited to: profile metadata (name/avatar image,
stored on IPFS, referenced by `metadataDigest` in the Name Registry) and the pathfinder's precomputed
flow results (which are themselves recomputable).

## Integration surface

### Circles RPC (public, no API key)

`https://rpc.aboutcircles.com` — JSON-RPC 2.0 POST to `/`. Public, no auth per docs
([API reference](https://docs.aboutcircles.com/api-reference)). UNVERIFIED: rate limits (not documented).

Methods most relevant to us:

| Method | Value |
|---|---|
| `circles_getAvatarInfo` / `...Batch` | is registered, avatar type, v1/v2 |
| `circles_getTrustRelations` | outgoing trust of an avatar |
| `circles_getAggregatedTrustRelations` | categorised (mutual / in / out) trust |
| `circles_getCommonTrust` | shared trusters between two addresses — direct graph-overlap primitive |
| `circles_getTrustNetworkSummary` | network statistics |
| `circles_getNetworkSnapshot` | full network state — likely the cheapest way to bootstrap a graph |
| `circles_getValidInviters` | who may invite a given address |
| `circles_getInvitationOrigin` | **onboarding source of a user — direct farm-detection primitive** |
| `circles_getTransactionHistory(Enriched)` | activity |
| `circles_events` | raw indexed events |
| `circles_query` / `circles_paginated_query` | generic SQL-like queries over indexed tables |
| `circles_tables` | schema discovery |
| `circlesV2_findPath` | **pathfinder max-flow between two avatars** |
| `circles_getScoreGroupMintLimits` | mint headroom for "score groups" — see Scoring-relevant facts |

Queryable namespaces via `circles_query`: `V_Crc` (v1), `CrcV2`, `CrcV2_ScoreGroup`; event families
`CrcV1_*`, `CrcV2_*`, `CrcV2_ScoreGroup_*`.

Verified live 2026-07-24: `circles_tables` and `circles_query` both respond over plain POST with no
auth. `Limit` is capped server-side at **10,000 rows** per query; use `circles_paginated_query` or
block-range filters for full scans.

### Pathfinder

Per <https://docs.aboutcircles.com/circles-sdk/pathfinder.md>:
- `sdk.rpc.pathfinder.findPath(source, destination, amount, filters)` → achievable flow + hop-by-hop legs
- **`sdk.rpc.pathfinder.findMaxFlow(source, destination)` → maximum possible flow as a `bigint`**
- Raw RPC method: `circlesV2_findPath`
- **Point-to-point only — no multi-target / set-target support.** A seed-set score therefore costs N
  queries, or must be computed locally against a single super-sink.

`findMaxFlow` is literally the whitepaper's `T(a → b | S)`. This is the trust-distance oracle, and it
already exists in production.

### Self-hosting (no vendor dependency)

`aboutcircles/circles-nethermind-plugin` (last push **2026-07-20**) is the indexer behind
`rpc.aboutcircles.com` — a Nethermind plugin that indexes Circles v1+v2 events into Postgres and
extends the node's JSON-RPC with the `circles_*` methods. The repo ships a `docker-compose` for Gnosis
Chain (Nethermind + Lighthouse + Postgres). **The entire query surface above can therefore be
self-hosted**, which removes the vendor dependency completely.

### Subgraph

UNVERIFIED / likely none for v2. `CirclesUBI/circles-subgraph` exists for v1 but I found **no
maintained The Graph subgraph for Circles v2** — the Nethermind plugin has replaced it. If we want a
Graph-based pipeline we would have to write our own subgraph; the events are simple enough that this is
a few hours of work.

### SDK

npm `@aboutcircles/sdk` (+ `-core`, `-rpc`, `-runner`, `-transfers`). Repo `aboutcircles/sdk` (pushed
2026-07-17). Older generation: `@circles-sdk/sdk` from `CirclesUBI/circles-sdk` (last push 2026-04-06) —
UNCLEAR which is canonical now; `aboutcircles/sdk` looks like the successor. Contracts are AGPL-3.0
(**note: AGPL — relevant if we ever fork or embed contract code, not for read-only RPC use**).

### Cost

Free. Public RPC, public chain, no API key, no pricing page, no rate limit documented (UNVERIFIED —
assume one exists and self-host if we scale).

## Privacy model

**None. Circles is radically transparent.** No ZK anywhere in the protocol.
- The entire trust graph is public on-chain (`Trust` events), permanently.
- Every mint and every transfer is public and attributable to a persistent address.
- Profile metadata (display name, photo) is on IPFS and publicly resolvable via the Name Registry digest.
- No nullifiers of any kind — the concept doesn't apply.

For an aggregator this cuts both ways: verification is trivially permissionless, but **querying a user's
Circles standing reveals their whole social graph to us**, and linking a Circles address to another
credential deanonymises both. Treat a Circles address as PII-equivalent.

## Scoring-relevant facts

- Issuance: 1 CRC/hour, 24 CRC/day, **7% annual demurrage**, retroactive claim window **14 days**
  (`MAX_CLAIM_DURATION = 2 weeks`).
- Registration self-trusts indefinitely (`_trust(human, human, INDEFINITE_FUTURE)`) — **exclude
  self-edges from any graph metric**; they are auto-inserted, not evidence.
- Bootstrap period: `invitationOnlyTime` is an immutable timestamp. Before it, a v1 Circles user with a
  *stopped* v1 token could self-register with `inviter == address(0)` and **no invitation cost at all**.
  Any avatar registered in that window inherits its trust root entirely from Circles v1 (which had its
  own, weaker, 3-trusts UBI-activation rule). UNVERIFIED: the exact `invitationOnlyTime` value — read it
  from the deployed contract.
- Avatar types: human (mints), organization (no mint, used by businesses/services), group (mints group
  currency against collateral of trusted member tokens via `groupMint()`/`groupRedeem()`, governed by an
  immutable per-group mint policy contract).
- **Group membership is a much better signal than raw trust.** A group's mint policy decides which
  personal Circles it accepts as collateral; a curated group whose policy admits only vetted members is
  effectively a whitelist maintained by a real community. "Is a member of group X" where X is a
  reputable group is far stronger evidence than "has N trusters".

### Live network statistics (queried from `rpc.aboutcircles.com`, `V_Crc.Stats`, 2026-07-24)

| Measure | v1 | v2 |
|---|---|---|
| avatars | 133,536 | **28,840** |
| humans | 130,254 | **26,040** |
| organizations | 3,282 | 2,133 |
| groups | — | **667** |
| trust edges | 1,082,476 | **473,493** |
| tokens | 130,254 | 40,359 |
| transitive transfers | 93,144 | 871,380 |
| raw CRC transfers | 3,684,822 | 11,440,444 |
| ERC-20 wrapper tokens | — | 13,652 |

Reproduce with:
```bash
curl -s -X POST https://rpc.aboutcircles.com/ -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"circles_query","params":[{"Namespace":"V_Crc","Table":"Stats","Columns":[],"Filter":[],"Order":[],"Limit":100}]}'
```

**v1 was ~5x larger than v2.** 130k v1 humans vs 26k v2 humans. Migration is far from complete; a large
majority of historical Circles identities never moved to v2. Treat v1 as a separate, *legacy but
non-empty* registry, and be aware that v1 is where the old "Circles Garden" cohort lives.

### Liveness / activity (queried live 2026-07-24, `CrcV2.PersonalMint`)

| Window | mint events | **distinct humans minting** |
|---|---|---|
| last 24h | 1,625 | **1,213** |
| last 72h | 4,833 | **2,296** |

So roughly **4.7% of registered v2 humans mint on a given day** and ~9% within 3 days. This is a clean,
cheap, permissionless activity filter: `PersonalMint` events per avatar over a rolling window.

Recommended liveness features per avatar:
- `days_with_mint / days_since_registration` (continuity — the 14-day cap means gaps are visible)
- `last_mint_age` (dormancy)
- `stopped` flag (permanent exit)
- **weighted in-degree from *active* trusters only** — a trust edge from an avatar that has not minted
  in 60 days should count for far less.

### Documented sybil farming — this is not hypothetical

The Circles indexer exposes a namespace `CrcV2_InvitationsAtScale` whose event names are
`BotCreated`, `FarmGrown`, `InviterQuotaSet`, `InvitesClaimed`, `RegisterHuman(human, originInviter,
proxyInviter)`. This is the Circles team's own bulk-onboarding infrastructure
(<https://github.com/aboutcircles/circles-invitation-at-scale>). Queried live 2026-07-24:

- **`BotCreated`: 5,000 rows.** A single `maintainer` `0xe4b40c78a4d8449864c8ec89b4500f60e4a0bbb7`
  grew a farm to `totalNumberOfBots = 5000` over a sequence of `FarmGrown` events on **2026-05-26**.
  The protocol's own event is literally named `FarmGrown` and the entities are literally called bots.
- **In the last 10,000 invitations-at-scale registrations (2026-04-10 → 2026-07-24), a single
  `originInviter` `0xf5ebc3753142f7c0ae381b6b775e819ea7b497d1` accounts for 2,754 of them (27.5%)**,
  routed through 1,687 distinct `proxyInviter` bot addresses so that the direct on-chain `RegisterHuman`
  `inviter` field looks diffuse (top direct inviter is only 47/10,000).
- Roughly **9,600 of the 26,040 v2 humans (~37%) registered in the last three months** (2026-04-24 →
  2026-07-24). Growth is dominated by bulk campaigns, not organic invitation.

**Implication for the aggregator:** the naive on-chain `RegisterHuman.inviter` field is *actively
obfuscated* by proxy bots. Any farm-detection must join `CrcV2.RegisterHuman` against
`CrcV2_InvitationsAtScale.RegisterHuman` to recover `originInviter`, and treat large single-origin
subtrees as one entity. This is exactly the "attack edge" set the whitepaper's theorem is about.

### There is already a published trust score — and it is weak

Undocumented but publicly queryable table **`V_TrustScores.Current`** on the Circles RPC:

```
avatar | trust_score (1-100) | trust_level (VERY_LOW..VERY_HIGH) | confidence (30-90)
       | computed_at | in_degree | out_degree | mutual_count | age_days
```

Sampled 10,000 rows on 2026-07-24 (the RPC caps `Limit` at 10,000, so this is a sample, not the census):

| trust_level | n | score range | median in-degree |
|---|---|---|---|
| VERY_LOW | 8,225 | 4–28 | 0 |
| LOW | 481 | 32–49 | 3 |
| MEDIUM | 605 | 50–69 | 6 |
| HIGH | 476 | 70–84 | 4 |
| VERY_HIGH | 213 | 85–100 | 10 |

- **82.4% of sampled avatars have in-degree 0** — literally nobody trusts them. Median score 25.
- Only **~2%** reach VERY_HIGH.
- **But the score is degree-and-age based, and therefore not sybil-resistant.** Observed VERY_HIGH rows
  with `in_degree = 1` and `mutual_count = 1`; several score-100 rows have `in_degree = 4`. The minimum
  `age_days` among VERY_HIGH is 99, so age carries a lot of the weight. A farm that creates mutual trust
  among its own bots and waits 100 days would trivially manufacture VERY_HIGH.

**Verdict on `V_TrustScores`:** useful as a *cheap prior* and as a fast negative filter (in-degree 0 ⇒
worthless), but **must not be used as the aggregator's Circles score**. We should compute our own
seed-anchored max-flow / min-cut score. UNVERIFIED: whether `V_TrustScores` is officially supported,
documented, or stable — it does not appear in the public API reference. Do not build a hard dependency
on it; if we use it, mirror the computation ourselves from `V_CrcV2.TrustRelations`.

### Groups as a stronger signal

`V_CrcV2.Groups` (667 groups) exposes `group, type, owner, mintPolicy, mintHandler, treasury, service,
feeCollection, memberCount, name, symbol` and `V_CrcV2.GroupMemberships` exposes
`group, member, expiryTime, memberType`. A group's mint policy is an **immutable contract chosen at
registration** that decides which personal Circles it will accept as collateral.

A curated group is a human-maintained allowlist with real economic stake behind it (the group's currency
is only as good as its members). "Member of group X" where X has a long history, many members, and real
mint/redeem volume is materially stronger evidence than raw trust in-degree — and it is a natural place
for the aggregator to plug in a hand-curated seed set. Also present: `CrcV2_ScoreGroup` events
(`ScoreGroupInitialized`, `MerkleRootUpdated`, `PersonalMinted`, `RouterMinted`, `OptOutStatusChanged`)
— a group type that mints against an off-chain-computed **Merkle root of scores**. UNCLEAR what scoring
function backs it; worth a follow-up, since it is Circles' own attempt at score-gated group membership.

### Other things worth knowing

- Demurrage detail from the whitepaper: applied daily at midnight UTC, factor `0.93^(1/365.25) ≈ 0.9998`.
- Equilibrium balance for a continuously-minting, non-transacting account is **120,804 CRC**, reached
  after ~80 years. Balances therefore *saturate*, which caps the balance-based capacity in max-flow —
  useful because it bounds how much a rich account can dominate a flow-based score.
- The whitepaper (§3.2) concedes Circles is **not really a UBI**: seigniorage contributes roughly
  `(0.07+g)/(V(1+g))` ≈ 9% of average money demand at 2% growth and velocity 1.
- Organization avatars cannot mint and are the sanctioned home for AI agents and apps (whitepaper fn 6),
  so `isOrganization()` is a useful explicit "not claiming to be a person" marker.

## Graph-derived scoring (the interesting part)

### The whitepaper defines the exact metric we want

Circles' own whitepaper — *"Circles – money for a multipolar world"*, Köppelmann, Boes, Ernst, v2.2.1
(<https://whitepaper.aboutcircles.com/>, PDF, read 2026-07-24) — §4.2–4.3 formalises the trust graph in
precisely the terms an aggregator needs.

**Transferable trusted balance.** For account sets `N_s` (senders) and `N_r` (receivers) in network
state `S`:

> `T(N_s → N_r | S) := max_{S' : S →_{N_s} S'} B(N_s → N_r | S')`
>
> "the maximal achievable amount of CRC, trusted by at least one account in `N_r`, that accounts in
> `N_s` can obtain by means of transitive transfers from an initial state `S`."

This is a **max-flow through the trust graph, capacity-limited by actual CRC balances**. It is not a
metaphor for a trust score — it *is* the protocol's native measure of how connected an account is.

**Relative Sybil resistance (whitepaper §4.3, boxed theorem).** Let `M` be the accounts controlled by a
malicious party, `F` the "fooled" accounts that trust at least one account in `M`, and `R` the rest of
the network. Then:

> `T(M → R | S) ≤ B_T(F → R | S)`

In words: *no matter how many sybils the attacker mints or how densely they trust each other, their
economic reach into the honest network is bounded by the trusted balance held by the boundary set `F`.*
This is exactly the min-cut-over-attack-edges result from the SybilGuard/SybilLimit literature, stated
by the protocol authors themselves. The whitepaper is explicit that this is **relative**, not absolute:

> "The absence of gatekeeping or KYC mechanisms in principle allows users to create several accounts."
> — §4.3

and it defines an honest user as "one that uses a **single account** to create CRC" (footnote 5, §2) —
i.e. multi-accounting is a norm violation the protocol *dilutes economically* rather than prevents.

**Corollary for us:** the right Circles score is **`T({user} → Seed | S)`** — the max flow of trusted CRC
from the candidate to a curated honest seed set. It is attack-resistant by the theorem above, is
denominated in a meaningful unit (CRC ≈ hours of issuance), and degrades gracefully rather than being
binary. Degree, clustering coefficient, and "number of trusters" are **not** attack-resistant and must
not be used.

**Value ordering (§4.5.2, boxed).** "Value at equilibrium flows opposite to trust": if `n` trusts `n'`
then `V(n') ≥ V(n)`. Arbitrage-free exchange rates between personal currencies therefore induce a
partial order that is a trust-rank. If a public CRC-vs-CRC market ever exists at depth, **observed
exchange rates are a market-priced trust score** — the strongest possible version of what we want,
because it is sybil-resistant by the same argument and requires no seed set curation on our part.
UNVERIFIED: whether such a market exists with real depth today (Balancer/CoW pools of wrapped CRC exist,
but per-avatar CRC markets probably do not).

**Average Spendable Fraction (§4.4).** `ASF(N̄|S) = mean over pairs of T(n→n'|S)/B(n|S)` — the fraction
of their holdings an account can actually spend to others. A per-account version, `ASF(user → Seed)`,
is a normalised 0–1 embeddedness score, which is a very natural thing to feed into an aggregate.

### The pathfinder is a usable trust-distance oracle

The Circles pathfinder is a standalone service that computes **maximum flow between avatars over the
trust graph subject to balances** — literally `T(a → b | S)`. Exposed as `circlesV2_findPath` on the
public RPC (<https://rpc.aboutcircles.com>) and used in production for transitive transfers.

Practical use as a scoring oracle:
1. Curate a seed set of believed-honest, well-embedded avatars (e.g. long-lived Berlin/Nairobi meetup
   participants, members of reputable curated groups).
2. Query max flow from the candidate to each seed (or to a synthetic aggregate receiver).
3. Score = f(total flow, number of *independent* seeds reachable, min-cut size).

Caveats, and they are real:
- **Flow is balance-capped, not purely structural.** A poor-but-well-trusted account scores low; a rich
  sybil that has been gifted CRC scores high. Consider running the same max-flow with unit capacities on
  edges (pure structure) alongside the balance-capped version. Pure-structure max-flow = number of
  edge-disjoint trust paths = the min number of attack edges, which is the cleaner sybil metric.
- **Pathfinder is a service, not a contract.** But the graph is fully on-chain, so the computation is
  reproducible locally — see below.
- UNVERIFIED: whether `circlesV2_findPath` accepts an arbitrary target *set* or only a single receiver,
  and whether it returns the flow value or only a concrete path. Check the pathfinder repo/API before
  designing around it.

### Everything is computable permissionlessly

**Confirmed yes.** The complete input to any of the above metrics is on Gnosis Chain:
- graph edges + timestamps + expiry: `Trust(truster, trustee, expiryTime)` logs from Hub v2
- node set + type + invitation tree: `RegisterHuman(avatar, inviter)`, `RegisterGroup`, `RegisterOrganization`
- balances: ERC-1155 `TransferSingle`/`TransferBatch` + `PersonalMint` + demurrage formula (deterministic)
- liveness: `PersonalMint(human, amount, startPeriod, endPeriod)` and `Stopped(avatar)`

Max flow is then a local computation on a graph of (as of 2026-07) low-hundreds-of-thousands of nodes —
trivial for a single machine. **No vendor dependency, no API key, no cooperation from the Circles team
is required.** The Circles RPC and pathfinder are conveniences, and `aboutcircles/circles-nethermind-plugin`
lets us self-host the exact same indexing stack if we want the convenience without the dependency.

This makes Circles unusually attractive operationally: it is one of the very few personhood-adjacent
signals we can compute end-to-end ourselves, with no rate limits and no vendor able to cut us off.

### Published third-party graph analysis

UNVERIFIED / gap: I did not find peer-reviewed or well-known community work applying PageRank / TrustRank /
SybilRank specifically to the Circles graph. Places to look next: the Circles forum / Discord, Gnosis
research posts, `aboutcircles/flow-visualization` and `aboutcircles/circles-explorer` repos, and academic
work on complementary currencies (Sarafu/Grassroots Economics has published network analyses of a very
similar system and is a reasonable methodological template).

## Overlap with other protocols

**Circles is genuinely independent evidence — confirmed.** Its trust root is:
- **not** a biometric (no iris, no face — unlike World ID, Humanity Protocol, Billions/Idena-style)
- **not** a government document (unlike Self/Anon Aadhaar/zkPassport/Proof of Passport)
- **not** a phone number, KYC provider, or social OAuth
- **not** on-chain behaviour of the user's *own* wallet (unlike Gitcoin Passport stamps, Nomis, etc.)

It is *other humans spending their own issuance to vouch*. The failure modes are therefore **almost
uncorrelated** with the failure modes of biometric and document protocols: a passport-forging ring does
not automatically get Circles trust, and a Circles invitation farm does not automatically pass a liveness
check. This is exactly what you want in an aggregate — orthogonal evidence.

Two caveats to the independence claim:
1. **Correlated at the top of the funnel by community.** Circles users are heavily overlapping with the
   Gnosis/Ethereum-Berlin and crypto-UBI communities, who are also disproportionately likely to hold
   Gitcoin Passport, POAPs, and Proof of Humanity. So *possession* correlates even though the *trust
   root* does not. Don't treat a Circles+Passport pair as fully independent for people in that cohort.
2. **Proof of Humanity (PoH) v1/v2 is a distinct protocol** despite the naming confusion — PoH uses
   video submission + a deposit + Kleros arbitration; Circles has none of that. Circles v1 historically
   used a "3 trusts to activate UBI" social rule which is the closest ancestor, but they are separate
   registries with separate trust roots. Do not merge them.

Where Circles *is* redundant: it should not be scored alongside any other pure trust-graph/vouching
protocol (e.g. a Gitcoin-Passport-style "community staking" stamp, or Idena's flip-based invite chain)
without discounting — those share the "someone vouched" failure mode.

## Project health (2026-07-24)

**Alive and shipping.** Evidence:
- `github.com/aboutcircles` has 40+ repos with pushes across the last 30 days; most recent
  `circles-nethermind-plugin` **2026-07-20**, `sdk` 2026-07-17, `CirclesMiniapps` 2026-07-17,
  `circles-explorer` 2026-07-01.
- `circles-contracts-v2` last *code* commit **2025-05-12** (default branch `beta`; the 2026-03-05 commit
  is a docs/`context7` change). This is expected — the contracts are deployed and immutable.
- On-chain: ~9,600 new v2 humans in the last 3 months; 1,213 humans minted in the last 24h.
- Hub v2 has 403,831 transactions.

Funding/governance (secondary sources):
- GnosisDAO **GIP-88 (2023)**: €1.7m seed for a Circles group-currency liquidity program
  ([The Block](https://www.theblock.co/post/355133/circles-v2-launches-martin-koppelmann-gnosis-dao)).
- Earlier GIP-59 proposal to fund Circles UBI R&D via Circles Coop eG / Bitspossessed
  ([Gnosis forum](https://forum.gnosis.io/t/gip-59-should-gnosisdao-fund-circles-ubi-r-d-work/5475)).
- v2 publicly launched **21 May 2025** (The Block, secondary; consistent with Hub v2 deployed Oct 2024
  and `invitationOnlyTime` = 2024-11-16, i.e. contracts shipped ~7 months before the consumer launch).
- Effectively a Gnosis-adjacent project: Martin Köppelmann (Gnosis co-founder) is the originator and a
  whitepaper author. **Concentration risk**: if Gnosis deprioritises it, the RPC/pathfinder/app layer
  could go dark. The chain data would remain, which is why we should not depend on their services.

Academic/secondary: Frontiers in Blockchain (2024), *"Universal basic income on blockchain: the case of
Circles UBI"* — a **qualitative** ethnographic study, not a network analysis. Notable quotes: "Circles
UBI accounts number around 200,000 in total" (v1 era) and "The web of trust mechanism supported by the
pathfinder algorithm is very complex and it does not work in practice."
(<https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2024.1362939/full>). It contains
**no empirical sybil analysis** — that gap is real and unfilled.

## What Circles claims vs. what is true

| Claim (source) | Reality |
|---|---|
| The 96/48 CRC invitation "acts as a barrier to prevent the creation of spam accounts" ([FAQ](https://aboutcircles.com/faqs)) | It costs 4 days of one existing account's issuance and refunds half to the sybil. Net 2 days of costless minted currency. A rate limiter with a ~2–4 day doubling time, not a barrier. |
| "Get trusted by 3 users you know" ([FAQ](https://aboutcircles.com/faqs)) | **App/product convention only.** `Hub.sol` has no 3-trust requirement anywhere — one inviter suffices at the protocol level. Don't encode "3 trusts" as a protocol invariant. |
| "One human, one account" ([FAQ](https://aboutcircles.com/faqs)) | A *norm*, enforced only by "the Circles team will actively work on identifying such behaviour and excluding malicious users" — i.e. discretionary, off-protocol, centralised. No technical enforcement exists. |
| Köppelmann: duplicate accounts give no advantage because "if you just sign up and create new tokens that no one cares about you don't get any advantage" ([The Block](https://www.theblock.co/post/355133/circles-v2-launches-martin-koppelmann-gnosis-dao)) | Correct **for the currency's economics**, and it is the whole point of Relative Sybil Resistance. It is **not** correct for a personhood aggregator: if we treat "registered human avatar" as a credential, we are precisely the party that "cares about" those tokens, and we would be handing an advantage to sybils that the currency itself withholds. |

## Recommended scoring design for the aggregator

1. **Hard gate:** `isHuman(addr) == true` on Hub v2 **and** in-degree from *active* trusters ≥ 1.
   (82% of avatars fail on in-degree alone.) Worth ~0 on its own.
2. **Core score:** seed-anchored max-flow. Build the graph locally from `Trust` logs; compute
   `minCut(candidate → Seed)` with **unit edge capacities** (structural, balance-independent) and
   separately with CRC-balance capacities (economic). Take the min-cut size as the primary feature — it
   is the number of independent honest vouchers, and by the whitepaper theorem it upper-bounds attacker
   influence.
3. **Farm penalty:** join `CrcV2.RegisterHuman` ↔ `CrcV2_InvitationsAtScale.RegisterHuman` to recover
   `originInviter`; collapse each large single-origin subtree to one entity before counting independent
   paths. Discount avatars whose entire trust neighbourhood shares an `originInviter`.
4. **Liveness multiplier:** fraction of days with a `PersonalMint` over the last 90 days;
   `stopped == true` ⇒ zero.
5. **Group bonus:** membership in a manually whitelisted set of reputable, long-lived groups
   (`V_CrcV2.GroupMemberships`).
6. **Cap the contribution.** Even a perfect Circles score should contribute a bounded, modest amount to
   an aggregate humanity assertion — it is a social prior, not a proof.

## Aggregator verdict (final)

**Integrate later, as a graph-derived *modifier*, never as a standalone humanity proof.**

Rationale: registering a Circles human avatar costs ~2 days of freely-minted currency plus gas, and the
protocol has a documented on-chain bot-farm apparatus (`FarmGrown`, 5,000 bots from one maintainer;
27.5% of recent invitations from a single origin). So the binary credential is worth ~0. But the trust
*graph* is fully public, permissionlessly computable, and the protocol's own whitepaper hands us the
correct attack-resistant metric (`T(M → R) ≤ B_T(F → R)`), with a production max-flow service
(`findMaxFlow`) already implementing it. That makes Circles the best available **pure social-trust,
biometric-free, document-free** signal — genuinely orthogonal to every other protocol in our set — at
the cost of us building a seed set and a max-flow pipeline. Defer until the core aggregator ships, then
add it as a differentiating, self-hosted signal.

## Open questions for us

1. **Seed set.** Who are our believed-honest Circles avatars? Without them no structural score is
   attack-resistant. Candidate approach: long-lived members of reputable groups, cross-referenced with
   another credential — but that partially reintroduces correlation. Needs a real design decision.
2. **`V_TrustScores` provenance.** It is queryable but undocumented. What is the formula? Is it
   supported? Who computes it, and how often (`computed_at` moved between two queries minutes apart, so
   it is continuously recomputed)? Ask the Circles team or read `circles-nethermind-plugin`.
3. **`CrcV2_ScoreGroup`.** A group type minting against a Merkle root of *scores*. What scoring function?
   If Circles is already shipping score-gated groups, that is either a competitor or a ready-made
   integration point. Look at `aboutcircles/group-tms` and `circles-groups`.
4. **Does `circlesV2_findPath` return the flow value or only a path?** And can we get min-cut, not just
   max-flow? If not, we compute locally.
5. **Empirical sybil census.** Nobody has published one. We could: reconstruct the invitation forest
   from `RegisterHuman` + `originInviter`, cluster, and measure what fraction of the 26,040 v2 humans sit
   in single-origin subtrees. This is a few hours of work and would be genuinely novel — and it is
   directly the number we need to price the credential.
6. **v1 (130k humans) — worth anything?** It is 5x bigger than v2 and its trust graph is also fully
   on-chain (`0x29b9a7fB…`, 1.08m trust edges). Older = harder to have farmed retroactively. Should the
   score include v1 graph position for non-migrated avatars?
7. **Rate limits on `rpc.aboutcircles.com`** — undocumented. Determine before depending on it; otherwise
   self-host the Nethermind plugin.
8. **Address ↔ user binding.** Circles avatars are usually **Safe** accounts (see the `Safe`/`V_Safe`
   namespaces in the indexer). Our flow must handle proving control of a Safe, not just an EOA signature.

## References

Primary:
- Whitepaper (PDF), *Circles – money for a multipolar world*, Köppelmann/Boes/Ernst v2.2.1: <https://whitepaper.aboutcircles.com/>
- Docs: <https://docs.aboutcircles.com/> · sitemap <https://docs.aboutcircles.com/sitemap.md> · LLM dump <https://docs.aboutcircles.com/llms-full.txt>
- API reference: <https://docs.aboutcircles.com/api-reference>
- Pathfinder: <https://docs.aboutcircles.com/circles-sdk/pathfinder.md>
- Invitations & referrals: <https://docs.aboutcircles.com/circles-sdk/invitations-and-referrals.md>
- FAQ: <https://aboutcircles.com/faqs>
- GitHub org: <https://github.com/aboutcircles>
- `Hub.sol`: <https://github.com/aboutcircles/circles-contracts-v2/blob/beta/src/hub/Hub.sol>
- `Circles.sol` (issuance/demurrage): <https://github.com/aboutcircles/circles-contracts-v2/blob/beta/src/circles/Circles.sol>
- Contracts v2 repo (AGPL-3.0): <https://github.com/aboutcircles/circles-contracts-v2>
- Contracts v1: <https://github.com/CirclesUBI/circles-contracts>
- Indexer (self-hostable): <https://github.com/aboutcircles/circles-nethermind-plugin>
- Bulk invitation infrastructure: <https://github.com/aboutcircles/circles-invitation-at-scale>, <https://github.com/aboutcircles/circles-invitation-escrow>
- Generated contract docs: <https://aboutcircles.github.io/circles-contracts-v2/>
- Explorer: <https://explorer.aboutcircles.com/>
- Hub V2 on Gnosisscan: <https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8>
- Live RPC used for all statistics in this document: `https://rpc.aboutcircles.com/`

Secondary (labelled as such):
- Gnosis blog, *Introducing Circles V2*: <https://www.gnosis.io/blog/introducing-circles-v2-money-for-a-multipolar-world>
- The Block, *Circles v2 launches* (21 May 2025): <https://www.theblock.co/post/355133/circles-v2-launches-martin-koppelmann-gnosis-dao>
- Frontiers in Blockchain (2024), qualitative study: <https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2024.1362939/full>
- GnosisDAO GIP-59 funding thread: <https://forum.gnosis.io/t/gip-59-should-gnosisdao-fund-circles-ubi-r-d-work/5475>
- "Humans of Gnosis" experimental group currency: <https://forum.gnosis.io/t/humans-of-gnosis-an-experimental-circles-group-currency/6365>

- Circles docs: <https://docs.aboutcircles.com/>
- Docs LLM dump (contract addresses): <https://docs.aboutcircles.com/llms-full.txt>
- Contracts v2 (AGPL-3.0): <https://github.com/aboutcircles/circles-contracts-v2>
- `Hub.sol`: <https://github.com/aboutcircles/circles-contracts-v2/blob/beta/src/hub/Hub.sol>
- `Circles.sol` (issuance/demurrage): <https://github.com/aboutcircles/circles-contracts-v2/blob/beta/src/circles/Circles.sol>
- Contracts v1: <https://github.com/CirclesUBI/circles-contracts>
- Generated contract docs: <https://aboutcircles.github.io/circles-contracts-v2/>
- Nethermind indexer plugin: <https://github.com/aboutcircles/circles-nethermind-plugin>
- Hub V2 on Gnosisscan: <https://gnosisscan.io/address/0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8>
- Invitation mechanics: <https://docs.aboutcircles.com/circles-sdk/invitations-and-referrals.md>
- Circles API reference: <https://docs.aboutcircles.com/api-reference>
