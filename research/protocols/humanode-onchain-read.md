# Humanode bioauth, read permissionlessly — a real read with zero holders

**Status:** implemented, `packages/sdk/src/adapters/humanode.ts`, tests (offline and `LIVE=1`) in
`humanode.test.ts`. Everything below was measured by me against Humanode's public RPC on
**2026-07-25** unless a source and date say otherwise. Runtime facts cite
`github.com/humanode-network/humanode` at master as of that date, cross-checked against live
state wherever the chain lets me.

---

## 1. What Humanode is, and what the credential is

Humanode is a Substrate chain (spec `humanode` v131 live, `state_getRuntimeVersion`) with a
Frontier EVM layer — `eth_chainId` `0x1472` = **5234** — whose validator set is admitted by
**3D face liveness**: a human FaceTec-scans against Humanode's "robonode" server, receives a
signed auth ticket, submits it on chain, and their validator key enters
`Bioauth.ActiveAuthentications` for **exactly seven days**
(`AUTHENTICATIONS_EXPIRE_AFTER = 7 * TIMESTAMP_DAY`, `crates/humanode-runtime/src/constants.rs`).
The biometric dedup at enrollment is what makes it one-human-one-node. Measured live at head
(block 19,084,999, timestamp 1,785,004,554):

- **82 active authentications** — the whole currently-living validator-human population.
- Every expiry sat within **6.96 days** of head, which re-confirms the 7-day constant against
  the running runtime rather than trusting the repo's master branch.
- Cap: `MAX_AUTHENTICATIONS = 3 * 1024`.

So `held` here is a **liveness statement with a seven-day shelf life** — the strongest
freshness guarantee of any credential in this directory. Its evidence class is Uniqueness
(the dedup) with a built-in liveness recency no Decay curve even needs to model: an active
bioauth is *never* more than 7 days old.

## 2. The read: two precompiles, both verified live

Bioauth state is keyed by 32-byte native accounts (`BioauthId = AccountId`, runtime lib.rs
line 176), not EVM addresses. The runtime bridges both halves of the question into the EVM
itself (`frontier_precompiles.rs`):

| Precompile | Address | Interface | Verified 2026-07-25 |
|---|---|---|---|
| EvmAccountsMapping | `0x…0801` (2049) | input: **raw 20-byte address**, no ABI envelope; output: raw 32-byte native account, or empty when unmapped | unmapped address → empty output |
| Bioauth | `0x…0800` (2048) | `isAuthenticated(bytes32)`, selector `0xe3c90bb9`; ABI-encoded bool out | active validator key `0x9a2730ec…f2df71` (taken from state) → `true`; zero key → `false` |

Both addresses carry the marker code `0x5f5ffd` (`pallet-dummy-precompiles-code`), so
`eth_getCode` confirms deployment. The Bioauth precompile runs *the same membership test* the
consensus layer uses — `ActiveAuthentications.iter().any(|a| a.public_key == input)`
(`crates/precompile-bioauth/src/lib.rs`) — so there is no interpretation gap between what we
read and what the chain enforces.

**The mapping cannot be planted.** `claim_account`
(`crates/pallet-evm-accounts-mapping/src/lib.rs`) requires the native account to sign the
extrinsic *and* the Ethereum key to sign an EIP-712 claim naming that native account, rejects
double-claims on either side, and is permanent. Dual consent, one-to-one, both directions
readable (`Accounts` and `EthereumAddresses`, both `Twox64Concat` maps). Unlike a Lens
account, `held: true` here is always an act of the subject.

## 3. Dating: exact, not bounded

The precompile answers held but not when. The same endpoint serves the Substrate RPC
namespace, and `state_getStorage` of

```
twox128("Bioauth") ++ twox128("ActiveAuthentications")
= 0x781b3ecf87d00064b2b25c4e058902f160519cb84486cfd81726674390a14b74
```

returns the SCALE `Vec<Authentication>` — compact length, then 40-byte entries of 32-byte
public key + little-endian u64 `expires_at` in unix milliseconds. Because every
authentication lives exactly seven days, **`issuedAt = expires_at − 7 days`, exactly** — no
bisection, no bound. The adapter derives the storage key from a from-scratch twox128
implementation pinned to the literal above (a typo'd pallet name would otherwise read null
forever, which decodes as "nobody is authenticated"); the live suite re-asserts every run
that no expiry exceeds head + 7 days, so a runtime upgrade changing the constant fails the
suite instead of silently mis-dating. The date read is best-effort: losing it loses the
date, never the credential.

Probe cost: 2 `eth_call`s + 1 `eth_blockNumber` for a negative, plus 1 `state_getStorage`
(~3.3 KB at the current set size) for a positive.

## 4. The honest catch: the credential currently has zero holders

Enumerating `EvmAccountsMapping.Accounts` with `state_getKeysPaged` over the pallet prefix on
2026-07-25 returned **zero entries** (the pallet's only key is its `:__STORAGE_VERSION__:`;
the reverse `EthereumAddresses` map is empty too). Eighty-two humans are actively
bioauthenticated; **not one has ever claimed an EVM↔native binding on mainnet**. Nothing in
the protocol pushes them to — validator rewards, staking and bioauth all operate on native
accounts, and Humanode's EVM dApp traffic uses free-standing EVM accounts
(`pallet-evm-system`) that need no mapping.

So this adapter, today, returns `held: false, detail.mapped: false` for every address on
Earth. It is implemented anyway, deliberately: the read path is real, verified end to end,
and entirely permissionless, and a Humanode human who hands us an EVM address they have
claimed *should* be recognized the day they do it. The live suite enumerates the map every
run — the zero-population claim is re-measured, not remembered, and the first mapping to
appear gets the probe exercised against it automatically.

What this is *not*: a way to read the 82 validators' personhood. Their credential exists on
chain but is keyed by accounts no EVM-addressed subject can prove to us they hold. An
aggregator keyed on 32-byte Humanode accounts could read it today; ours is keyed on EVM
addresses, and the honest statement is that the intersection is currently empty.

## 5. Endpoints, and the centralization caveat

| Endpoint | Role | Notes |
|---|---|---|
| `explorer-rpc-http.mainnet.stages.humanode.io` | everything | serves `eth_*` and `state_*` on one HTTP endpoint, no key; the only public RPC for chain 5234 I could find |

**The single public endpoint is Humanode-operated.** Same position as the Lens Chain read:
permissionless (no key, no registration, nothing to revoke per-caller) but not
infrastructure-independent. If it lied, nothing in the probe would catch it. The node also
exposes `bioauth_status` as JSON-RPC, but it reports the *node's own* enrollment ("Unknown"
on the public endpoint) — it is not a per-subject read and the adapter does not use it.

The deeper root is not the RPC anyway: enrollment runs through Humanode's robonode (a
centralized biometric server signing auth tickets, `RobonodePublicKey` in the runtime) and
FaceTec's liveness SDK. The chain verifiably enforces *what the robonode signed*; that the
robonode admitted one live human per key is a trust assumption about Humanode's operation of
it, which is what `biometric-registry:humanode` as a trust root has to mean.

## 6. Proposed ontology changes

The existing `humanode` entry stays at its catalogued costs (face-liveness class,
placeholder until priced — unchanged) but its claims need updating:

```json
{
  "id": "humanode",
  "name": "Humanode",
  "evidenceClass": "Uniqueness",
  "trustRoot": "biometric-registry:humanode",
  "forgeCostCents": 5000,
  "rentCostCents": 1000,
  "decayHalfLifeDays": 365,
  "live": true,
  "sourceURI": "research/protocols/humanode-onchain-read.md",
  "implemented": true,
  "ageCurve": "Decay",
  "notes": "One node, one human, enforced by 3D face liveness at the consensus layer, re-proved every 7 days. Read permissionlessly from the chain's own EVM precompiles: address -> native account (0x..0801, a permanent dual-consent binding that cannot be planted) then isAuthenticated (0x..0800, the consensus layer's own membership test), dated exactly from ActiveAuthentications state (expiry minus the 7-day lifetime, re-verified live every test run). The decay curve is a formality: an active bioauth is never more than 7 days old. Honest population caveat: 82 humans were actively bioauthenticated on 2026-07-25 and zero had claimed an EVM mapping, so no EVM-addressed subject can currently hold this credential; the adapter re-measures that emptiness rather than assuming it. Single Humanode-operated RPC (permissionless, not infrastructure-independent); enrollment trust root is Humanode's robonode + FaceTec, not the chain. Costs remain the face-liveness-class placeholder until priced."
}
```

`decayHalfLifeDays` is left at 365 explicitly because it is a no-op — freshness over a ≤7-day
age is ~1 under any sane half-life — and changing it would imply the number does work it
does not.

## 7. Open, and deliberately not guessed

1. **Whether mapping claims ever start.** The adapter's usefulness is gated on Humanode
   giving validators a reason to claim EVM addresses (an EVM-side reward, a dApp gate). The
   live suite will notice the first one; worth re-measuring the count quarterly.
2. **Robonode uniqueness quality.** The dedup is FaceTec 3D liveness operated by Humanode;
   its false-accept economics (the real forge cost) are unpriced. The 5,000¢ figure is the
   class placeholder, not a measurement.
3. **A second RPC.** No independent endpoint for chain 5234 was found; if one appears the
   adapter's `rpcUrls` rotation is already built for it.
4. **The testnet mapping population.** Testnet5 may have claimed mappings that would let the
   full positive path (mapped + authenticated) be exercised against a real chain before
   mainnet has any. Not done: the adapter targets mainnet and a testnet-green result proves
   little about mainnet's emptiness.
