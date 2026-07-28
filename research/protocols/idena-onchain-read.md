# Idena, read permissionlessly — the node RPC behind the web app

**Status:** implemented, `packages/sdk/src/adapters/idena.ts`, tests (offline and `LIVE=1`) in
`idena.test.ts`. Everything below was measured by me against public endpoints on **2026-07-25**
unless a source and date say otherwise. The protocol background — mechanism, collapse history,
the founder's own post-mortem — is in `research/protocols/poh-kleros-brightid-idena.md` and is
not repeated here; this file is about the *read*.

---

## 1. Why an Ethereum-address subject can hold an Idena identity at all

Idena addresses are secp256k1 and derived exactly like Ethereum's: last 20 bytes of
keccak256(uncompressed pubkey). `dna_identity` returned `pubkey`
`048d18e6…aa7938` for `0xFf09…Eb8A` and the derivation checks out. So an Idena identity at
address X is a claim about **the same keypair** a Corroborate subject controls — no cross-chain
account mapping problem exists here, which is precisely what makes Idena implementable while
Encointer is a refusal (`encointer-onchain-read.md`).

The symmetric caveat: nothing forces an Idena participant to reuse their key on Ethereum. The
overlap population is "Idena users who use the same key as an Ethereum account", a subset of an
already-tiny network (124 validated identities at epoch 214).

## 2. The endpoint: permissionless, but through a shared key that is a public constant

Idena is its own chain with its own JSON-RPC dialect, and **every Idena node gates RPC behind an
`api-key`** — there is no fully keyless node protocol-wide. What exists:

| Endpoint | State on 2026-07-25 |
|---|---|
| `https://restricted.idena.io` | **Answers.** The protocol's shared node, used by the official web client. Key required — see below |
| `https://rpc.idena.io` | Empty reply |
| `https://node.idena.io` | 502 from nginx |
| `https://api.idena.io` | Indexer REST, not node RPC — enrichment only, never a `held` path |

The shared node's key is `idena-restricted-node-key`, and it is **not a secret**: it is baked
into the deployed app.idena.io bundle (verified by grepping
`https://app.idena.io/_next/static/chunks/pages/_app-fb1caf55cb95a118.js`, which contains the
literal string; the open-source `idena-web` repo reads it from
`NEXT_PUBLIC_RESTRICTED_NODE_KEY`, `shared/providers/settings-context.js`). Every keyless user
of the official web app authenticates with this constant. So the read is permissionless in
every sense that matters — nothing to register, nothing revocable per-caller — but it is the
**Lens Chain position**: protocol-operated, not infrastructure-independent. The operator can
rotate the key or retire the node for everyone at once, and there is no second public node to
fall back to. The adapter takes `rpcUrl`/`nodeKey` overrides so anyone with their own node (or
a rented shared-node key — a small market of community shared nodes exists for validation) is
not bound to it.

Wire facts worth pinning:

- The key rides **in the JSON body** (`{"method":…,"params":…,"key":…}`), not a header.
- A bad key or a disallowed method is answered with **HTTP 403 and a plain-text body**
  (`API key is invalid`, `method not available`) — not JSON-RPC errors. The adapter's
  transport treats non-JSON as a first-class error path, and a unit test pins it with a local
  403 fixture server.
- The restricted node **allowlists methods**: `dna_identity`, `dna_epoch`, `bcn_blockAt`,
  `bcn_lastBlock`, `dna_ceremonyIntervals` all answer; `dna_identities` (enumerate all
  identities) is refused. Consequence: candidate *discovery* cannot be done through this node,
  only per-address lookup — which is exactly the shape a probe needs, and the reason the live
  tests lean on the indexer for discovery while asserting only what the node says.

## 3. The read

Three calls, all verified live on 2026-07-25:

```
dna_identity(address) -> { state, age, stake, online, delegatee, penalty, pubkey, … }
dna_epoch()           -> { epoch: 215, startBlock: 11066316, nextValidation: "2026-07-26T15:00:00Z" }
bcn_blockAt(height)   -> { height, timestamp, hash }
```

`dna_identity` **never errors on absence** — for a never-seen address it fabricates an all-zero
record with `state: "Undefined"` (verified on `0x…0001`). So `Undefined` maps to
`identityFound: false`, not to "an identity in a bad state".

### Which states count as held

The ladder: Undefined → Invite → Candidate → **Newbie → Verified → Human**, with
Suspended/Zombie for validated identities that missed ceremonies and Killed for termination
(voluntary kill or missing too many). Held = **Newbie, Verified, Human** — the three states the
protocol itself calls "validated" and the composition the indexer reports per epoch
(epoch 214: 98 Human, 12 Verified, 14 Newbie = 124 validated; 24 Suspended, 10 Zombie,
22 Undefined). Newbie counts because a Newbie *did* pass the last synchronous ceremony — the
uniqueness claim — and the ladder above it measures tenure, which the probe reports as
`detail.ageEpochs` instead of gating on. Suspended/Zombie do not count: their holder provably
missed the most recent ceremony, and for a ceremony credential recency **is** the signal.

### Dating: the current epoch's start block is the last ceremony, proven

A validated state is necessarily at most one epoch old: states are only (re)assigned at
validation ceremonies, and missing one demotes immediately (Verified/Human → Suspended,
Newbie → Killed). So the last ceremony dates the credential, and the chain proves that date:
`dna_epoch().startBlock` is the first block of the current epoch — the first block after the
ceremony — and `bcn_blockAt` returns its timestamp. Verified: epoch 215 startBlock 11,066,316,
timestamp **1,784,648,021** = 2026-07-21T15:33:41Z, the afternoon of the epoch-214 ceremony
(scheduled 15:00:00Z, plus the ~37-minute lottery/short/long session sequence —
`dna_ceremonyIntervals` reports 300 + 120 + 1800 s). Minutes-accurate, from chain state.

If the two dating calls fail after a successful identity read, the probe returns `held: true`
**undated** (`detail.undated` says why, `provenance.dateFrom: 'none'`) — held was proven, the
date was not, and neither is faked from the other.

`issuedAt` = last validation, deliberately **not** first validation: recency is the signal
(see §5 on the ontology curve). Tenure is not discarded — `age` (epochs since first
validation) rides in `detail.ageEpochs`, and 87 epochs at recent ~5-day cadence is years of
repeated ceremonies. Converting `age` to a first-validation *date* is not provable from the
node RPC (epoch lengths vary with network size), so the probe does not.

### What else the detail carries

- `stakeIdna` — identity stake, non-extractable by a buyer (the post-2022 fork that killed the
  account-trading market).
- `pooled` / `delegatee` — delegation to a pool is exactly the puppeteering shape the
  founder's own paper documented; the credential stands (the human did solve the flips) but a
  caller must be able to see the string-puller. The live Suspended example below is pooled.
- `online`, `epoch`, `lastValidationAt`, `nextValidation`.

## 4. Live evidence (2026-07-25)

Discovered at run time (indexer for candidates, node for the verdict), not pinned — with
~5-day epochs, any pinned address can lapse within a week:

**Held** — `0xFf09b6Ff94526B41091452dDFf5e04292a56Eb8A` (from `/api/OnlineIdentities`):

```json
{ "held": true, "issuedAt": 1784648021,
  "provenance": { "heldFrom": "chain", "dateFrom": "chain", "notes": [] },
  "detail": { "identityFound": true, "state": "Human", "ageEpochs": 87,
              "stakeIdna": 589936.0, "online": true, "pooled": false,
              "epoch": 215, "lastValidationAt": 1784648021,
              "nextValidation": "2026-07-26T15:00:00Z" } }
```

**Lapsed** — `0x03eb4C518941bDc2B937aFA55a200AcD58Da7C7e` (Suspended in the epoch-214 roll):

```json
{ "held": false,
  "detail": { "identityFound": true, "state": "Suspended", "ageEpochs": 29,
              "stakeIdna": 1035.8, "online": false, "pooled": true,
              "delegatee": "0x0d028dfb7f558c99adf0ce6e31d67e6fbaf4fafc",
              "reason": "state-not-validated" } }
```

**Never seen** — `0x…0001`: `held: false, detail.identityFound: false`.

Full suite: 17/17 pass under `LIVE=1` (no skips on the 2026-07-25 run); offline 13/13;
`npx tsc --noEmit` clean.

## 5. Proposed ontology changes

The catalogue entry (`ontology/adapters.json`, id `idena`) predates this read. Two changes
proposed, neither made by me (central registration owns that file):

1. **`implemented: false` → `true`**, `sourceURI` → this file. Whether `live` flips from
   `false` is a judgement call that belongs to the main session: the chain is alive and the
   read works, but the not-live marking was made on *scale* grounds (124 validated humans
   worldwide) and those grounds still hold at epoch 215. The probe works either way; `live`
   governs pricing, not probing.
2. **`ageCurve: "Ramp"` → `"Decay"`** (keeping `decayHalfLifeDays: 90`). The credential
   expires if a ceremony is missed — a validated state is at most one epoch old, and an
   identity that stops validating goes Suspended → Zombie → Killed. That is a liveness shape:
   recency is the signal, and the probe dates from the last ceremony accordingly. A Ramp would
   reward exactly nothing here (there is no survival-without-participation to reward — tenure
   already shows up as repeated revalidation, and `ageEpochs` is in the detail for any future
   refinement). If the Ramp was intentional — pricing multi-epoch tenure — the right shape
   would still need `issuedAt` = first validation, which the node RPC cannot prove.

Costs (`forgeCostCents: 20000`, `rentCostCents: 400`) were researched in
`poh-kleros-brightid-idena.md` and are not re-litigated here.

## 6. Honest limitations

1. **One node, one operator, one shared key.** No independent public RPC exists; the key is a
   public constant but globally rotatable. If restricted.idena.io lied about identity state,
   nothing in this probe would catch it. (The indexer could serve as a cross-check the way
   `reconcile.ts` does for PoH — not built, because both are operated by the same protocol
   team, so agreement proves little.)
2. **Discovery is impossible through the node.** `dna_identities` is allowlisted off, so the
   live tests discover candidates via `api.idena.io` — discovery only; every `held`/date
   assertion is the node's answer. A partner wanting population-level reads needs their own
   node.
3. **`issuedAt` is minutes-coarse and epoch-quantized.** All validated identities in an epoch
   share the same `issuedAt` (the ceremony). Harmless for a 90-day half-life.
4. **Killed-vs-never-existed is not distinguished.** A killed identity's record returns to
   `Undefined`-shaped emptiness (unverified by me on a real killed identity; the indexer could
   tell, the node alone cannot). Both map to `identityFound: false`, which is the conservative
   direction.
5. **The population argument stands.** This adapter exists because the read is cheap, honest,
   and the mechanism is the most interesting uniqueness design in the field — not because we
   expect subjects to hold it. At 124 validated identities worldwide, most probes will return
   `identityFound: false` forever.
