# World ID — reading it off World Chain, and where reading stops

*Written 2026-07-25 while implementing `packages/sdk/src/adapters/world.ts`. Every address,
selector, revert payload, event and count below came from a call made from this box on that date.
Where a number came from an explorer's index rather than from the chain directly, it says so. This
file extends the "On-chain surface" section of `world-id.md`, which found AgentBook and stopped
one contract short of the registry World actually populates.*

---

## 1. What was already known, and the hole in it

`world-id.md` established the read path we shipped in iteration 0: `AgentBook.lookupHuman(address)`
on World Chain, `groupId() == 1`, one `eth_call`, no `rp_id`, no API key. It called AgentBook "the
only World ID read path that is genuinely permissionless *and* gives a positive assertion about a
specific address", and noted "coverage is currently tiny".

Both halves of that were understatements in opposite directions.

- **Coverage.** AgentBook has taken **1,068 transactions in its life** (World Chain Blockscout
  counter, 2026-07-25). It is a registry of AI agents, not of humans.
- **The date.** `lookupHuman` returns a nullifier and nothing else. An undated credential on a
  `Decay` curve is scored by `freshnessOf` at freshness **1** — full weight, forever. So every
  World credential we scored was priced as though it had been issued this morning, which is the
  direction that pays an adversary. This was a live scoring defect, not a missing feature.

Both are fixed by a different contract on the same chain, which the earlier pass did not reach.

## 2. `WorldIDAddressBook` — the registry World populates

`0x57b930D551e677CC36e2fA036Ae2fe8FdaE0330D`, World Chain mainnet. Verified source on Blockscout,
which also carries the public tag **"World Chain: World ID Address Book"** sourced to
`worldcoin.org/world-chain` — so the identification does not rest on the contract's name alone.
Author `Miguel Piedrafita`. Not a proxy. Deployed **block 2,711,105, 2024-08-27T11:24:09Z**
(creation tx `0x974e70f125abe3b6abaa0b3fb9cb067c09cee359b08fa847487d6623377308fd`).

The whole contract is 200 lines. Its state:

```solidity
mapping(uint256 => address) public nullifierHashes;    // World ID nullifier -> the address it verified
mapping(address => uint256) public addressVerifiedUntil; // address -> expiry, 0 if never verified
uint256 public verificationLength;   // 14_515_200 == 168 days
uint256 public maxProofTime;         // 604_800 == 7 days
uint256 public groupId;              // 1 == Orb
```

and the only state-changing path a user can take:

```solidity
function verify(address account, uint256 root, uint256 nullifierHash,
                uint256[8] calldata proof, uint256 proofTime) external payable {
    if (proofTime > block.timestamp) revert InvalidConfiguration();
    if (block.timestamp - proofTime > maxProofTime) revert InvalidConfiguration();

    address previousAddress = nullifierHashes[nullifierHash];
    if (previousAddress != account &&
        addressVerifiedUntil[previousAddress] > block.timestamp) revert VerificationAlreadyActive();

    nullifierHashes[nullifierHash] = account;
    addressVerifiedUntil[account] = block.timestamp + verificationLength;

    worldIdRouter.verifyProof(root, groupId,
        abi.encodePacked(account, proofTime).hashToField(), nullifierHash,
        externalNullifierHash, proof);

    emit AccountVerified(account, addressVerifiedUntil[account]);
}
```

Four things fall out of those twelve lines, and the adapter uses all four.

### 2.1 `held` is a comparison, never a presence check

`addressVerifiedUntil` is never cleared. A verification that lapsed in March is a large nonzero
number sitting in the mapping forever. The contract's own definition of "still verified" is the
comparison it makes about `previousAddress`: `addressVerifiedUntil[x] > block.timestamp`. Anything
looser counts dead bindings as people.

Measured: of twelve accounts sampled from a 100-block window on **2025-04-18**, **seven** are in
exactly that state today and five have re-verified since. Of twelve sampled from **2026-01-21**,
eight are lapsed. An `!= 0` read would have counted every one of them.

### 2.2 The date is exact, and it is the block the verification was mined in

`addressVerifiedUntil[account] = block.timestamp + verificationLength`, so

    issuedAt = verifiedUntil - verificationLength()

is the *exact* second the verification transaction was mined — not an estimate, not a bound.
Confirmed against the block header for **24 sampled verifications** spanning 2025-04-18, 2026-01-21
and 2026-07-25: every one matched to the second. Worked example, block 32,825,936:

| | |
|---|---|
| `AccountVerified` | account `0xD29bE764…76F3`, `verifiedUntil` 1,799,502,711 |
| `verificationLength()` | 14,515,200 |
| derived | 1,799,502,711 − 14,515,200 = **1,784,987,511** |
| block 32,825,936 timestamp | **1,784,987,511** |

That derivation is only exact while `verificationLength` is the term the entry was written under,
and the owner can change it with `setVerificationLength`. So the full event history was scanned —
every `VerificationLengthUpdated`, `GroupIdUpdated`, `MaxProofTimeUpdated`, `WorldIdRouterUpdated`
and `WorldIDAddressBookInitialized` log from block 2,711,105 to 32,825,988, in seven chunked
`eth_getLogs` calls. **Two events exist in the contract's entire life:**

| Block | Date | Event |
|---|---|---|
| 2,711,105 | 2024-08-27 | `WorldIDAddressBookInitialized(router 0x17B354dD…, groupId 1, externalNullifierHash 0x00d5b5db…5864d, verificationLength 14515200, maxProofTime 604800)` |
| 24,251,140 | 2026-01-08 | `WorldIdRouterUpdated(0xB012Bc9D505f876394aAb1C6cdc4cA64edA65Caa)` |

So the term and the group have never moved. The probe still reads `verificationLength()` live
rather than pinning the constant, and refuses any derived date that lands before the contract
existed or after the block it read — a term change can then cost us a date, never invent one. The
live suite asserts the current term equals the one in the initialisation event, so a governance
change goes red before it silently re-dates a population.

### 2.3 At most one live verified address per human, enforced on chain

`verify` reverts `VerificationAlreadyActive()` when the proof's nullifier is already mapped to a
*different* address whose verification has not expired. A human can move their binding to a new
address only after the old one lapses. This is a per-human uniqueness property that a counterparty
can rely on directly rather than infer — and it is exactly the primitive the fleet-policy work in
`MISSION.md` P1 needs, since it bounds live World bindings per human at one *by construction*.

The reverse map `nullifierHashes(uint256) -> address` is public, so anyone holding a nullifier can
find the address it verified. Same tension `world-id.md` flagged for AgentBook: World's
"nullifiers are unlinkable across apps" story does not cover the nullifiers World publishes itself.
We read the forward direction only.

### 2.4 An entry means an Orb proof, and the chain will prove it on demand

Simulating `verify()` with a junk proof, `eth_call` at head, three different senders — a stranger
(`0x…1234`), the relayer that submits real verifications (`0x6e07f8a6…ca5e`, taken from a live
verification transaction) and the contract's own owner (`0xc50b688E…4062`):

| Root supplied | Revert, from **all three** senders |
|---|---|
| invented (`9999999`) | `0xddae3b71` = `NonExistentRoot()` — Semaphore's root-history check |
| the group's current `latestRoot()` | `0x7fcdd1f4` = `ProofInvalid()` — the Groth16 verifier |

Identical from all three, so the gate is the proof and not the caller; and supplying a real root
carries the call all the way to the pairing check, so the verification is not a rubber stamp. Both
are asserted by the live suite on every run.

Corroborated by the trace of a real verification (tx
`0x704cb0c766edfd16791f828e8e82d24c71a8f69ae8ccf1d738d1da0644c89eae`, internal transactions from
the World Chain Blockscout index):

```
Multicall3 → WorldIDAddressBook.verify
           → 0xB012Bc9D…65Caa (router shim)
             → staticcall back into the AddressBook
             → WorldIDRouter 0x17B354dD…A278
               → delegatecall WorldIDRouterImplV1 0x4055B6d4…5Ab49
                 → group-1 identity manager 0xdFCa0A88…2009E
                   → Groth16 verifier 0x79f46b94…A0e4
                     → precompiles 0x06, 0x07, 0x08  (bn256 add / mul / pairing)
```

**The shim** (`0xB012Bc9D505f876394aAb1C6cdc4cA64edA65Caa`, the 2026-01-08 router swap) is
unverified on the explorers reachable without a key, so it was read from its bytecode: 1,337 bytes,
seven `PUSH4` selectors, no EIP-1967 implementation slot. It exposes
`verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])` (`0x3bc778e3`, the
`IWorldIDGroups` interface the AddressBook calls), `worldIdRouter()` → **`0x17B354dD…A278`** and
`addressBook()` (`0xf5887cdd`) → **`0x57b930D5…0330D`**, both as `PUSH32` constants in its own code.
It is a shim in front of the canonical router, not a replacement for it. `groupId` is still 1.

## 3. Coverage: this is the mass registry, AgentBook is not

`eth_getLogs` on the public endpoint is capped at 100 blocks, which is enough: World Chain produces
a block every two seconds, so one window is ~200 seconds of traffic. `AccountVerified` counts from
100-block windows, converted to a daily rate at 43,200 blocks/day:

| Window date | Logs / 100 blocks | Implied verifications/day |
|---|---|---|
| 2024-08-30 (launch week) | 946 | ~409,000 |
| 2024-09-22 | 23 | ~9,900 |
| 2024-12-23 | 161 | ~69,600 |
| 2025-04-18 | 138 | ~59,600 |
| 2025-08-12 | 186 | ~80,400 |
| 2025-10-18 | 75 | ~32,400 |
| 2025-12-29 | 92 | ~39,700 |
| 2026-03-08 | 76 | ~32,800 |
| 2026-05-17 | 93 | ~40,200 |
| 2026-07-02 | 59 | ~25,500 |
| 2026-07-25 (head) | 65 | ~28,100 |

**Not measured: the total number of live verifications, or of distinct humans.** At ~0.45 events
per block over 30.1M blocks the contract has emitted on the order of 10⁷ `AccountVerified` events,
and enumerating them to dedupe addresses is not something a keyless endpoint will serve. The rate
table is a sample, stated as one. What it does establish is the order of magnitude: ~30,000
verifications a day against a 168-day term implies a live population of ~5M *entries*, and the
number of distinct humans behind them is smaller by however often people renew — a fraction this
pass did not measure. Even at the pessimistic end that is **three to four orders of magnitude more
coverage** than AgentBook's 1,068 lifetime transactions.

One window (2025-10-20) returned zero logs while its neighbour 100,000 blocks earlier returned 75.
A single empty 200-second window is a lull, not an outage, and it is recorded here so a later pass
does not read it as one.

## 4. What the date means — a binding, not an iris

`verifiedUntil - verificationLength` is when this address last **re-proved** a World ID. It is not
when the human enrolled at an Orb. The enrolment date lives in the v4 credential as
`genesis_issued_at` (see `world-id.md` §"What it proves"), is disclosed only inside a proof, and
never touches a chain.

The adapter dates the binding, because the binding is what the contract attests, and reports the
distinction as the provenance note `date-from-latest-reattestation` → caveat
`issuance-date-is-latest-renewal`. On a decay curve this is the conservative reading of what the
chain knows: the iris capture is older than the date we use, and the binding it proves is exactly
this fresh. Weight is therefore a ceiling on what the enrolment would earn, not a floor.

**Fourth instance of a shape this codebase keeps meeting.** A hard expiry truncates a decay curve,
so a half-life longer than the expiry never completes: Human Passport hard-expires at 90 days
against a 180-day half-life, Holonym within a year against 730, Linea PoH at 90 against 90, and now
World at **168 days against 1,095**. A held World credential can never decay below
2^(−168/1095) = **0.902**. Measured live: a binding renewed 162.0 days ago scores freshness 0.9025
and 45.13 cents against the adapter's 50; one renewed this morning scores 0.99999 and 50.00. Before
this change both scored 50.00.

## 5. The document (9303) and Selfie (11) tiers are not readable, and here is the evidence

`MISSION.md`'s queue asks for probes for these two. There is no permissionless read to build one
on, and the reason is structural rather than an oversight:

1. **World ID 4.0 verification writes no state.** `WorldIDVerifier`
   (`0x00000000009E00F9FE82CfeeBB4556686da094d7`, ERC1967 proxy → impl
   `0xFF93A0146bF6E7557B63315EFecE083ca07d4C73`) exposes `verify(...)` as a `view` function taking
   a proof. Its proxy has received **2 transactions in its entire life** and emitted 8 logs, all
   from the upgrade path — consistent with a contract nobody transacts against because there is
   nothing to write. A credential presented to a relying party leaves no trace anyone else can read.
2. **The only v4 registry is keyed by issuer, not by holder.** `CredentialSchemaIssuerRegistry`
   (implementations `0xCBF2050f…D4FC` and `0x9b79b3b0…2e81`, both verified) has exactly these
   holder-relevant getters: `getIssuerSchemaUri(uint64)`, `getSignerForIssuerSchemaId(uint64)`,
   `issuerSchemaIdToPubkey(uint64)`, `nonceOf(uint64)`. Every key is a `uint64` issuer schema id.
   There is no address anywhere in its read surface. It registers *who may issue schema 9303*, not
   *who holds one*.
3. **Both address-keyed World registries are Orb-only.** `WorldIDAddressBook.groupId()` and
   `AgentBook.groupId()` both return **1**, and World ID v3 group 1 is the Orb group — the device
   tier was never verifiable on chain at all. Neither contract has ever changed its group.
4. **The vendor path is exactly the dependency we exclude.** Reading either tier means World's
   Developer Portal `/api/v4/verify` with a registered `rp_id`, a proof the user generates for
   *us*, and an account World can revoke. For Selfie Check it is worse than a dependency: World's
   own docs scope its Sybil signal per relying party, so the answer describes one RP's user base
   rather than the world.

So both stay in the ontology with `implemented: false` and a `no permissionless read` note naming
the measurements above. This is the honest-aggregation path `MISSION.md` describes, and a live test
asserts the ontology keeps saying it — an adapter appearing for either id without this file changing
should be treated as a bug.

**What would change the answer:** any contract on any chain that records a v4 verification per
address, the way the AddressBook records the v3 one. If World ships an "address book" for the NFC
tier, this becomes a copy of §2 with a different `issuerSchemaId`. Worth re-checking whenever the
v3 sunset (April 2027) moves.

## 6. Reads performed for this file

All against `https://worldchain-mainnet.g.alchemy.com/public` unless noted; log scans wider than
100 blocks against `https://worldchain-mainnet.gateway.tenderly.co`, which serves them keylessly.

| Read | Result |
|---|---|
| `WorldIDAddressBook.groupId()` | 1 |
| `WorldIDAddressBook.verificationLength()` | 14,515,200 (168 d) |
| `WorldIDAddressBook.maxProofTime()` | 604,800 (7 d) |
| `WorldIDAddressBook.worldIdRouter()` | `0xB012Bc9D505f876394aAb1C6cdc4cA64edA65Caa` |
| `WorldIDAddressBook.owner()` | `0xc50b688Ec147fA0E93f7Bf5Ca5e4fcefe9E74062` |
| shim `worldIdRouter()` / `addressBook()` | `0x17B354dD…A278` / `0x57b930D5…0330D` |
| `WorldIDRouter.routeFor(1)` | `0xdFCa0A882eF7793485B3d052142B60647E82009E` |
| group-1 `latestRoot()` | non-zero, moves between blocks |
| `AgentBook.groupId()` / `worldIdRouter()` | 1 / `0x17B354dD…A278` |
| config event scan, blocks 2,711,105 → 32,825,988 | 2 events (§2.2) |
| `verify()` simulation, 3 senders × 2 roots | `NonExistentRoot()` / `ProofInvalid()`, §2.4 |
| 24 `AccountVerified` logs vs block headers | date derivation exact, every one |
| 12 rate windows | §3 |
| `WorldIDVerifier` proxy tx / log counters | 2 / 8 (Blockscout index) |

## 7. Open questions

- **How many distinct humans hold a live World binding.** Bounded above by the rate table and
  below by nothing measured. Answering it needs an archive log scan of ~10⁷ events; a Substreams
  or subgraph over `AccountVerified` would settle it, and would also give the renewal rate, which
  is the interesting number — it is the fraction of Orb-verified people still actively presenting
  proofs rather than the fraction that once did. Compare the Linea finding: there, the vendor's
  boolean and the live registry were 101× apart.
- **What `0xad94e556` is.** The shim writes that selector into memory before its staticcall back
  into the AddressBook. It is not in the AddressBook's verified ABI, and neither 4byte nor
  OpenChain knows it. The shim's behaviour is fully pinned down by the revert experiment either
  way, so this is curiosity rather than exposure.
- **Whether `require_user_presence` is expressible against the AddressBook.** It is not a
  parameter of the v3 proof the AddressBook consumes, so the ~$5 resale market documented in
  `world-id.md` applies to the binding in full. Our `rentCostCents: 50` already prices that.
