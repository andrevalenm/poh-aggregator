# Circles (Gnosis)

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). This one salvaged unusually well: the agent had
> already pulled `Hub.sol` source, walked live contract state over RPC, and cloned three group repos
> before it died. Adoption numbers and sybil-resistance literature are gaps.

**One-liner:** Personal-currency protocol on Gnosis Chain where a directional, expiring trust graph
makes tokens path-fungible; the graph — not any score — is the sybil-resistance signal.
**Category:** social-trust
**Chains:** Gnosis Chain (v1 and v2), Chiado testnet
**Status (2026-07):** live and actively developed — `circles-nethermind-plugin` pushed 2026-07-20,
`sdk` 2026-07-17, ~30 repos with 2026 activity in the `aboutcircles` org
**Aggregator verdict:** **integrate now**, as a *graph-derived* signal, not a credential. Circles is
the only protocol in our set that gives us a rich social topology we can compute over ourselves, and
the group-currency mechanism is a ready-made distribution surface for an aggregate score. But we must
build the scoring ourselves — see the next section, which corrects a premise in the research brief.

## Correction: Circles has no trust score

The brief asked us to verify the belief that "Circles gives a trust score." **It does not.** Nothing
in the salvaged sources — `Hub.sol`, the docs, the SDK, the RPC method list — exposes a per-user trust
or reputation score. What exists is:

1. A **binary, directional, expiring** trust edge (`trust(address, uint96 expiry)`).
2. A **pathfinder** that finds liquid transfer paths through those edges.

That is all. Any "score" is something **we** would compute from graph topology. The protocol's own
spec is explicit that this is an aspiration rather than a delivered feature —
[TCIP002-trust-graph.md](https://github.com/aboutcircles/circles-contracts-v2/blob/beta/specifications/TCIP002-trust-graph.md)
states the second objective is "to derive a local, **soft** measure of sybil resistance," and the
spec body is largely an unfilled outline (`## Scope`, `## System Overview` are empty headings).

Two things could be mistaken for a score, and neither is one:

- **Score groups** (`CrcV2_ScoreGroup` namespace, `OffchainScoreBasedMintPolicy.sol`) — this is a
  *mint policy* that caps how much group currency can be minted against collateral. The "score" is a
  supply limit computed from historical supply, not a judgment about a person.
- **`dappcon25-leaderboard`** — a one-off hackathon repo that scores "users based on different trust
  relations and connections." Evidence that people *want* this, not that the protocol provides it.

**This is good news for us, not bad.** An unscored graph is raw material only we would package.

## What it proves

Social trust, and weakly. A trust edge means one avatar asserted another's tokens are fungible with
theirs — in the protocol's words, that they "believe are authentic, and non-sybil." It is a human
vouching, with all that implies: as sybil-resistant as the honesty and diligence of the vouchers.

Circles does have real, non-graph sybil resistance in registration economics:

```solidity
uint256 private constant WELCOME_BONUS = 48 * EXA;        // 48 Circles
uint256 private constant INVITATION_COST = 2 * WELCOME_BONUS; // 96 Circles, burnt
```

After the bootstrap period (`invitationOnlyTime`, on-chain value `0x6737e088` =
**2024-11-15T22:34:16Z**, now long past), registration is **invitation-only**: an existing human must
trust your address *and* burn 96 of their own personal Circles. So a sybil account has a real, direct
cost paid by a real, established account. That cost is denominated in a currency that only accrues at
one Circle per hour, which makes mass fabrication expensive in *time*, not just capital.

## Trust graph & on-chain surface

**Everything is on-chain and readable.** No indexer is required for correctness — only for speed.

`Hub.sol` (v2), [aboutcircles/circles-contracts-v2](https://github.com/aboutcircles/circles-contracts-v2), AGPL-3.0:

```solidity
mapping(address => mapping(address => TrustMarker)) public trustMarkers;

struct TrustMarker {
    address previous;  // linked-list pointer — makes the graph iterable from contract state
    uint96  expiry;    // unix seconds
}

function trust(address _trustReceiver, uint96 _expiry) external;
function isTrusted(address _truster, address _trustee) public view returns (bool);
event Trust(address indexed truster, address indexed trustee, uint256 expiryTime);
```

Design notes that matter for us:

- Trust is **directional** and can be set toward an address that is not yet registered — that is
  exactly how invitations work.
- Trust is **binary with an expiry**, replacing v1's trust *limits*. The changelog states the intent:
  "Make the trust relationship binary (and deprecate the trust limit). Rather than storing a binary
  mapping, we opt to store a **linked list** of the trusted nodes. This facilitates iterating from the
  contract state." So the full graph is enumerable on-chain, per truster.
- `isTrusted` is just `expiry >= block.timestamp` — expiry in the past means untrusted, and untrusting
  is `trust(addr, 0)` (clamped to `block.timestamp`).
- Self-trust is set at registration to `INDEFINITE_FUTURE` and **cannot be altered**.
- **Consented flow** (advanced usage flag, least-significant bit) upgrades transfers to require
  *bi-directional* trust. Relevant to scoring: a mutual edge under consented flow is a meaningfully
  stronger signal than a one-way edge.

### Verified deployed addresses (Gnosis Chain)

The original agent confirmed these have bytecode on-chain via `eth_getCode` at block `0x2d2db7c`:

| Contract | Address | Codesize |
|---|---|---|
| Hub v2 | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` | 24,451 |
| Hub v1 | `0x29b9a7fBb8995b2423a71cC17cf9810798F6C543` | 15,190 |
| Name Registry | `0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474` | 6,202 |
| Migration | `0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376` | 2,531 |
| Base mint policy | `0xcCa27c26CF7BAC2a9928f42201d48220F0e3a549` | not checked |

Hub v1 live parameters, read on-chain: `deployedAt()` = `0x5f88941a` (**2020-10-15**),
`inflation()` = 107, `divisor()` = 100 (i.e. **7% annual**), `period()` = 31557600 s (1 year),
`timeout()` = 7776000 s (90 days), `signupBonus()` = 50e18.

Useful selectors the agent computed: `trust(address,uint96)` = `0x75dcebc7`,
`isTrusted(address,address)` = `0x6713e230`, `trustMarkers(address,address)` = `0x7cd0cea6`,
`avatars(address)` = `0xedeeb93c`, `isHuman(address)` = `0xf72c436f`.
`Trust(address,address,uint256)` topic0 = `0xe60c754d...`.

The agent demonstrated the graph is walkable directly: it read the avatar linked list from the
`SENTINEL` (`0x1`) head and enumerated registered avatars, then walked one truster's trust list.
**We can reconstruct the entire graph from chain state with no vendor cooperation.**

> `UNCLEAR:` the v2 deployment date and the current registered-avatar count. The Chiado 0.3.0
> deployment (2024-03-25) is in the changelog but those are **testnet** addresses — do not confuse
> them with the mainnet ones above.

## Integration surface

Fully permissionless. Three ways in, in increasing order of independence:

1. **Hosted RPC** — `https://rpc.aboutcircles.com`, JSON-RPC 2.0, POST to `/`. No API key mentioned
   in the docs. `UNVERIFIED:` rate limits are not documented; assume they exist.
2. **Self-hosted** — [`circles-nethermind-plugin`](https://github.com/aboutcircles/circles-nethermind-plugin)
   (C#, actively developed) is a Nethermind plugin that indexes Circles events into Postgres and
   serves the same RPC. `docker compose -f docker/docker-compose.gnosis.yml up -d`. Ships an indexer,
   pathfinder (REST on `:8080`), RPC host, cache service, and a Prometheus exporter. **We can run the
   entire Circles data layer ourselves.**
3. **Direct chain reads** — as above, the graph is enumerable from `trustMarkers` + `avatars`.

Relevant RPC methods for an aggregator:

- `circles_getTrustRelations` — effective trust for an avatar; expired/removed edges are omitted
- `circles_getCommonTrust` — **mutual-trust intersection between two avatars; the most directly
  score-relevant method in the API**
- `circles_getAvatarInfo` / `...Batch` — human vs group vs organization
- `circles_query` — generic table query over indexed namespaces
- `circles_getNetworkSnapshot`, `circles_searchProfiles`, `circles_events`,
  `eth_subscribe("circles")` for live updates
- `circlesV2_findPath` — pathfinding
- `circles_tables` — schema discovery

Namespaces: `CrcV1`, `CrcV2`, `V_CrcV1`, `V_CrcV2`, `V_Crc` (combined v1+v2 views),
`CrcV2_ScoreGroup`. Trust relations live in `V_CrcV2.TrustRelations`, which carries `expiryTime`.

SDKs: [`circles-sdk`](https://github.com/aboutcircles/circles-sdk) (TypeScript, branch `dev`, last
pushed 2026-04-06) and a newer [`sdk`](https://github.com/aboutcircles/sdk) repo (pushed 2026-07-17)
— the newer one is more active and may be the successor.
> `UNVERIFIED:` **the npm package name was never confirmed.** The agent was asked for it explicitly
> and died before checking. Do not guess it — check the `package.json` in whichever repo is canonical.
> Neither SDK repo declares a license (the contracts are AGPL-3.0); worth resolving before we depend on one.

## Group currencies — the hook, and it already exists

This is the most actionable finding in the whole salvage.

A Circles **group** is an avatar that mints its own currency backed by collateral of members' personal
Circles, and it decides who to trust via a pluggable **membership condition**:

```solidity
interface IMembershipCondition {
    function passesMembershipCondition(address avatar) external returns (bool);
}
```

[`circles-groups`](https://github.com/aboutcircles/circles-groups) already ships conditions including
`IsHumanCondition.sol`, `CirclesBackingCondition.sol`, and LBP-backer conditions — plus
`BaseGroup`, `BaseGroupFactory`, `BaseMintPolicy`, `CoreMembersGroup`, and an affiliate-group registry.

**And someone has already built exactly the pattern we would build.**
[`poh-group-setup`](https://github.com/aboutcircles/poh-group-setup) ("Proof of humanity group
contracts and scripts", last pushed 2025-08-20, no license declared) is a Circles group gated on
Kleros Proof of Humanity:

- `PoHMembershipCondition.sol` — maintains bidirectional `circlesToPoH` / `PoHToCircles` maps so
  **each PoH ID can back only one Circles account**. Checks both `IProofOfHumanity` and
  `ICrossChainProofOfHumanity`. Supports resolving a PoH ID held by a *linked* account via
  `CirclesLinkRegistry`, walking up to 50 linked accounts.
- `PoHGroupService.sol` — calls `group.trustBatchWithConditions(members, expiry)`, and critically
  **sets the group's trust expiry equal to the PoH credential's expiry**. When the credential lapses,
  the trust edge lapses with it.
- `trust-management-service/` — a TypeScript watcher that listens for PoH revocation/renewal and
  pushes updates on-chain.

That third piece is the design lesson: **credential expiry maps cleanly onto trust expiry.** Circles'
`uint96 expiry` is a natural carrier for credential freshness, which is one of the five hard problems
in our README. A "verified humans" group whose trust edges expire exactly when the underlying
credential does is a working answer to revocation-and-freshness — and it is a *pull* interface any
Gnosis Chain protocol can already read, with no integration on their side.

The design is also honest about correlated failure: one PoH ID → one Circles account, enforced
on-chain. We would need the same constraint per source protocol.

> Note it is built against **Kleros PoH**, not World ID — and it is a single-source gate, not an
> aggregate. An aggregator-backed group would be the generalization: `passesMembershipCondition`
> returns true when *our* composite score clears a threshold. `group-tms` ("Maintains the trust
> relations of a circles group based on their conditions", pushed 2026-07-18) is the actively
> maintained generic version of the same idea.

## Trust root & failure modes

Trust root: other humans, plus the economic cost of invitation.

- **The graph is only as honest as its vouchers.** A colluding cluster can vouch for each other. What
  the topology guarantees is *local*, not global — hence "local, soft measure" in TCIP002.
- **Invitation cost is the real defence** — 96 personal Circles burnt per new account, and personal
  Circles accrue at 1/hour. Farming N sybils costs 96N Circles held by *established* accounts.
- **7% annual demurrage** means holdings decay, so stockpiling mint capacity for a future sybil burst
  is penalised.
- **Bootstrap-era accounts got in free** — before `invitationOnlyTime` (2024-11-15), v1 users could
  self-register with no invitation. Accounts registered before that date have a weaker provenance
  and arguably deserve a different weight.
- Trust edges expire, so a stale graph over-counts. Any score must respect `expiryTime`.
- The changelog flags a real operational hazard: *"removing (untrusting) edges can cause concurrency
  problems with path solvers"* — edge removal is deliberately slowed relative to token flow. A score
  computed from a live graph can be transiently wrong.

Audits: the repo has a `/reviews` directory with `202407-gnosis` and `202409-hats` (a 14KB Hats
report). `UNVERIFIED:` contents not read.

**The contracts are beta.** The README carries explicit beta warnings and "provided as-is without any
warranties"; the default branch is `beta` and the release candidate is `rc-v1.0.0-beta`. Meanwhile
`docs/unwritten-docs/` contains **19 zero-byte placeholder files** — including
`trust-management.md`, `hub-contract.md`, `contract-addresses.md`, and `integration-guidelines.md`.
Circles is under-documented in exactly the areas we need, which is precisely why reading the Solidity
directly (as done here) is the only reliable route.

> **GAP.** No adoption numbers — registered avatars, active avatars, trust-edge count, geography —
> were captured. No academic or team analysis of Circles' sybil resistance was found either; the
> agent was cut off. Both are directly answerable: the counts from `circles_getNetworkSnapshot` or a
> `circles_query`, the analysis by searching the forum at `forum.aboutcircles.com`.

## Scoring-relevant facts

Signals available to us today, all derivable from chain state or the RPC:

| Signal | Source | Why it matters |
|---|---|---|
| In-degree (who trusts you) | `trustMarkers` / `TrustRelations` | the base vouch count |
| Mutual edges | `circles_getCommonTrust` | far stronger than one-way |
| Consented-flow flag | `advancedUsageFlags` | opt-in to bidirectional-trust semantics |
| Inviter identity | `RegisterHuman(avatar, inviter)` event | provenance chain back to bootstrap |
| Registration before/after 2024-11-15 | `invitationOnlyTime` | free-registration era vs paid-invite era |
| Trust expiry distribution | `TrustMarker.expiry` | freshness; distinguishes live from abandoned |
| Group memberships | group trust edges | inherits whatever the group's condition asserts |
| v1 → v2 migration | Migration contract | account age back to 2020 |

**Not** available: any protocol-native score, any liveness or uniqueness assertion, any identity
document. Circles proves *embeddedness in a social graph*, nothing more.

## Overlap with other protocols

- **Kleros Proof of Humanity** — already directly wired via `poh-group-setup`. If we score both a
  Circles group membership *and* the underlying PoH credential, we would be **double-counting the same
  evidence**: the group edge exists *because of* the PoH ID. This is the cleanest live example of the
  correlated-failure problem in our README, and it is in our own backyard.
- **No biometric or document overlap** — Circles shares no trust root with World ID, ZKPassport, or
  eIDAS. It is genuinely independent evidence relative to those, which makes it valuable in an
  aggregate precisely because it fails differently.
- Gnosis Chain-native, so no bridging needed for us — the opposite of the World ID situation.

## Open questions for us

1. **What is the right graph metric?** In-degree is trivially gameable within a colluding cluster.
   Something like personalized PageRank seeded on a trusted set, or trust-path distance to a known-good
   anchor, is more defensible. This is real design work and is the core of any Circles-derived score.
2. **Do we publish our score as a Circles group?** A group whose `passesMembershipCondition` reads our
   aggregate would make the score consumable on-chain by any Gnosis protocol, with expiry semantics
   for free. Strong candidate for a first shipped artifact.
3. **Which SDK is canonical** — `circles-sdk` or the newer `sdk`? And what is the npm name and license?
4. How do we avoid double-counting group membership against the credential that granted it?
5. Is the beta contract status a blocker for anything we would deploy?

## References

- [circles-contracts-v2](https://github.com/aboutcircles/circles-contracts-v2) (AGPL-3.0, branch `beta`) — `src/hub/Hub.sol`, `src/hub/TypeDefinitions.sol`
- [TCIP002 — trust graph](https://github.com/aboutcircles/circles-contracts-v2/blob/beta/specifications/TCIP002-trust-graph.md) · [TCIP009 — demurrage](https://github.com/aboutcircles/circles-contracts-v2/blob/beta/specifications/TCIP009-demurrage.md) · [TCIP004 — flow matrix](https://github.com/aboutcircles/circles-contracts-v2/blob/beta/specifications/TCIP004-flow-matrix.md)
- [circles-nethermind-plugin](https://github.com/aboutcircles/circles-nethermind-plugin)
- [poh-group-setup](https://github.com/aboutcircles/poh-group-setup) · [circles-groups](https://github.com/aboutcircles/circles-groups) · [group-tms](https://github.com/aboutcircles/group-tms)
- [circles-sdk](https://github.com/aboutcircles/circles-sdk) · [sdk](https://github.com/aboutcircles/sdk) · [circles-link-registry](https://github.com/aboutcircles/circles-link-registry)
- [Circles Architecture](https://docs.aboutcircles.com/overview/circles-architecture) · [The Circles Stack](https://docs.aboutcircles.com/circles-sdk/the-circles-protocol) · [Query Circles Data](https://docs.aboutcircles.com/developer-docs/query-data) · [API Reference](https://docs.aboutcircles.com/api-reference)
- [v2 whitepaper PDFs](https://github.com/aboutcircles/whitepaper-public)
- Secondary: [Gnosis blog — Credibly Neutral Money: Circles 2.0 at Devcon](https://www.gnosis.io/blog/credibly-neutral-money-circles-2-0-at-devcon) · [Circles Forum — Circles Contract v2](https://forum.aboutcircles.com/t/circles-contract-v2/562)
