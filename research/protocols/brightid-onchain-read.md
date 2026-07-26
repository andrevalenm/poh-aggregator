# BrightID, read permissionlessly — one real registry, frozen mid-2024

**Status:** implemented, `packages/sdk/src/adapters/brightid.ts`, tests (offline and `LIVE=1`)
in `brightid.test.ts`. Everything below was measured by me against public endpoints on
**2026-07-25** unless a source and date say otherwise. This file supersedes the BrightID
verdict in `poh-kleros-brightid-idena.md` (2026-07-24) in one respect only: the "readable but
not obtainable" conclusion missed that one BrightID app's contextIds *are* Ethereum
addresses, and that app has an on-chain registry. The product-is-hollow finding stands.

---

## 1. The linkability problem, and the one place it is solved

BrightID's graph labels **contextIds** — per-app UUIDs — not addresses. The node API
(`/verifications/{context}/{contextId}`) answers only for registered apps, each app sees only
its own contextIds, and none of that is on chain. That is why the general answer to "is this
address BrightID-verified" is *no such read exists*: the linkage is app-scoped by design.

The exception is the **`snapshot`** app, whose contextIds are Ethereum addresses, and for
which BrightID deployed a public registry on IDChain (their POA sidechain, chain id 74 —
`eth_chainId` `0x4a`):

> **`BrightIDSnapshot`** at `0x81591DC4997A76A870c13D383F8491B288E09344`
> — the `official.v5` registry hard-coded in Snapshot's `brightid` voting strategy
> (`snapshot-labs/snapshot-strategies`, `src/strategies/brightid/index.ts`).

Source verified on the IDChain Blockscout (`explorer.idchain.one`), contract name
`BrightIDSnapshot`; `app()` reads `"snapshot"` on chain. Semantics, from the verified source:

- `verify(address[] addrs, uint timestamp, v, r, s)` is a **permissionless relay**: anyone
  may submit; validity is `ecrecover` against a signer holding `verifierToken`
  (`0xF917c019349dD70Be96Dea78E75Dc679Dcd323F7`; contract `owner()`
  `0xb9d52BBFA575FdF0B0DFEe9fc09C5010FEaB98c9` can swap the token). `addrs[0]` becomes
  `{time: timestamp, isVerified: true}`; every older address in the submitted history is
  written `isVerified: false` with its `time` kept, and `history[newer] = older`.
- `isVerifiedUser(address)` is a plain mapping read — **no expiry on the read path** (the
  day-long `REGISTRATION_PERIOD` gates writes only). A 2022 registration still reads true.
- `verifications(address)` returns `(time, isVerified)` atomically — one `eth_call` gives
  held and the date together, which is what the adapter calls.

So `held: true` means: a BrightID node signed, at `issuedAt`, that the human behind this
address met the snapshot app's verification expression (the graph's "meets" criterion), and
someone relayed it. Social-graph vouching — not uniqueness, not liveness. The binding is
consented (the node signs over the address list the user linked) and cannot be planted.

## 2. What the registry actually contains — measured

IDChain is alive: head block 38,911,878 at 2026-07-25T18:35:57Z, still sealing. Its single
public RPC `https://idchain.one/rpc` served a **full-history** `eth_getLogs` (block 0 →
head) for the registry's `Verified(address)` topic
(`0x6a6455914f452787eb3985452aceedc1000fb545e394eb3b370e3d08958e0a5b`) in ~9 s:

| Measurement | Value |
|---|---|
| `Verified` events, all history | **237** |
| Unique addresses ever verified | **233** |
| First registration | block 10,849,443 = 2022-01-22T03:01:17Z |
| Last registration | block 25,730,771 = **2024-06-09T14:11:14Z** |
| Last transaction of any kind to the contract | 2024-06-09T22:30:23Z (`0x54689d7c…`, Blockscout) |

Worked examples, read live: `0x7A38760C295f1ea086005214a279fb1280010483` (Snapshot's own
strategy example) → `isVerifiedUser: true`, `time` 1,642,819,837 = 2022-01-22;
`0x802d6d3d3ecdaa02de0ee231db043814d40343c0` (discovered from the newest logs) → verified,
`time` 1,710,265,439 = 2024-03-12.

**The write path is dead.** New registrations need a node-signed verification, and every
BrightID node API endpoint checked on 2026-07-25 refused: `app.brightid.org/node/v5/state` →
HTTP 502, `…/node/v6/state` → 502, `node.brightid.org/brightid/v6/state` → 308 into the same
502. This matches the 2026-07-24 sweep (main node 502, forum 503, Aura verification hash =
SHA-256 of the empty string, i.e. zero Aura-verified users). A registry of 233 addresses,
frozen for over two years, in front of a product that cannot mint more.

## 3. What else was tried, so nobody re-treads it

- **`BrightID/BrightID-SmartContract`** (`BrightID.sol`, `StoppableBrightID.sol`): per-app
  registry templates with the same signer-gated `verify()`. Deployed instances are
  app-scoped; no general registry beyond the snapshot one was found.
- **1hive** (`1Hive/brightid-user-register`, Gnosis "Gardens"): `BrightIdRegister` stores
  per-DAO registrations with a **re-registration period** — `isVerified` is time-gated, so
  with the node down every registration decays false by design. App-scoped, expiring, last
  repo push 2023. Not a usable source. (Repo's `deployments/` holds only `goerli`.)
- **clr.fund `BrightIdUserRegistry`** (Optimism/Gnosis): same shape — app context
  (`clr.fund`), sponsorship-gated writes, per-round scope. Not general.
- **Ethereum mainnet**: no BrightID registry mapping arbitrary addresses to verification
  exists there; apps that used BrightID on mainnet (e.g. the 1hive faucet era) went through
  the app-scoped contracts above.

Conclusion: **the IDChain snapshot registry is the only general address→verified BrightID
surface on any chain**, and it is the one implemented.

## 4. Why implement rather than refuse

The refusal case was live until the registry surfaced: app-scoped contextIds genuinely are
not linkable. But this registry *is* the linkage — 233 real humans bound their addresses to
graph verifications, on chain, permissionlessly readable in one `eth_call`, dated by the
node's own signed timestamp. The evidence is real for whoever holds it; what is dead is the
mint. That maps cleanly onto the ontology's existing vocabulary: **`implemented: true`,
`live: false`** — the same shape as a frozen-but-readable registry, with `live: false`
already zeroing effective cost the way the scoring engine expects for a credential no
adversary can newly obtain (and no honest newcomer either).

`issuedAt` is the node's last attested timestamp for the address — it *understates* the
account's age (the human's BrightID predates their last re-verification), which on the Ramp
curve is the conservative direction. A superseded address (`time > 0, isVerified: false` —
its human re-linked elsewhere) is reported `held: false, detail.superseded: true`, distinct
from never-registered, with the predecessor link (`history()`) carried as detail when
present.

## 5. Trust root and failure modes, honestly

- **The signer, not the graph.** On-chain validity is "a `verifierToken` holder signed".
  The token's holder set is the real verifier quorum, and the contract `owner()` can swap
  the token at will — so the root is *BrightID-the-operator*, same as the graph itself; the
  chain only makes the attestations non-retractable and datable.
- **IDChain is protocol-operated.** A POA sidechain sealed by BrightID-community validators,
  one public RPC. Permissionless read, not infrastructure-independent — the Lens Chain
  position, worse by one endpoint. If `idchain.one/rpc` lied, nothing in the probe would
  notice. The chain outliving the product by two years is the one reassuring datum.
- **No revocation ever fires.** With the node down, even the history mechanism (the only
  thing that voids an address) cannot run. The 233 entries are effectively immutable — which
  cuts both ways: nothing decays a stolen key's credential either.
- **Same-primitive warning** (from the 2026-07-24 sweep): BrightID connections, PoH vouches,
  Idena invites and Circles trust edges are one primitive. `social-vouching:brightid` must
  never be summed with those as independent roots for the same identity claim.

## 6. Proposed ontology changes

```json
{
  "id": "brightid",
  "name": "BrightID",
  "evidenceClass": "SocialTrust",
  "trustRoot": "social-vouching:brightid",
  "forgeCostCents": 1000,
  "rentCostCents": 300,
  "decayHalfLifeDays": 365,
  "live": false,
  "sourceURI": "research/protocols/brightid-onchain-read.md",
  "implemented": true,
  "ageCurve": "Ramp",
  "notes": "Readable, frozen. The one general address->verified surface is the BrightIDSnapshot registry on IDChain (0x81591DC4997A76A870c13D383F8491B288E09344, the contract Snapshot's official strategy reads): 233 unique addresses, first 2022-01-22, last write 2024-06-09, measured over full chain history 2026-07-25. held = a verifier-token signer attested the address met the snapshot app's graph verification; issuedAt = that attestation's timestamp (understates age -> conservative on the Ramp); re-linked addresses read superseded, not unregistered. live:false because the write path needs a BrightID node signature and every node endpoint 502s (probed 2026-07-25) - nobody, honest or adversary, can newly obtain this, so forge/rent are academic and effective cost is zeroed by liveness. IDChain is protocol-operated with a single public RPC: permissionless read, not infrastructure-independent. The prior not-obtainable verdict stands for every other BrightID app: contextIds are app-scoped UUIDs with no on-chain address linkage."
}
```

Costs left as catalogued: they were placeholders for a functioning product and remain
academic under `live: false`; re-price only if BrightID's nodes ever come back.

## 7. Open, and deliberately not guessed

1. **Whether the node network returns.** Aura showed activity spasms in 2024; if any node
   API answers again, the write path revives and `live` should be re-examined — the adapter
   needs no change, only the ontology entry.
2. **Who holds `verifierToken` today.** The holder set (and whether its keys survive the
   project's decay) bounds the forgery story for the frozen registry. One Blockscout
   token-holder query away; not load-bearing while `live: false` zeroes the weight.
3. **The four duplicate `Verified` addresses** (237 events, 233 unique): re-verifications
   bumping `time`. Sampled behavior matches the contract's `require(newer timestamp)`;
   per-address event histories were not exhaustively diffed.
4. **Whether any snapshot-registry registrant overlaps our other social-vouching roots.**
   With 233 addresses this is a small cross-join worth running once the aggregate has
   multi-root subjects to test saturation against.
