# EAS & Disco.xyz — the attestation substrate

*Researched 2026-07-24. All contract addresses, counts and gas figures below were pulled from
primary sources (GitHub source files, RPC, EASSCAN GraphQL) on that date.*

**One-liner:** EAS (Ethereum Attestation Service) is a permissionless, schema-based attestation
registry deployed on ~20 EVM chains; Disco.xyz was a W3C-Verifiable-Credential "data backpack" for
off-chain identity credentials. Neither is a personhood protocol — both are **rails** on which a
personhood claim can be published, read and composed.
**Category:** n/a — substrate / publication layer, not a credential issuer. EAS proves *only* that
`attester` said `data` about `recipient` at time `t`. All trust is in the attester.
**Chains:** EAS — Ethereum L1, OP Mainnet, Base, Arbitrum One + Nova, Polygon, Scroll, zkSync,
Celo, Linea, Blast, Telos, Soneium, Ink, Unichain (+ testnets). Disco — off-chain, DID-based.
**Status (2026-07):** EAS **live and actively maintained** — last commit to `eas-contracts`
2026-07-16; 3.57M attestations on Base, 1.32M on OP Mainnet, issuing today.
Disco.xyz — **DEAD**: merged into Privado ID 2024-09-19, GitHub org silent since 2024-04-30,
`docs`/`api`/`app`/`issuer.disco.xyz` all NXDOMAIN, and the `disco.xyz` domain is now an SEO-spam
site owned by a third party.
**Aggregator verdict:** **EAS = integrate now, as an optional output rail.** Publish our aggregate
humanity assertion as an *off-chain* EAS attestation by default (free, portable, privacy-preserving),
with opt-in on-chain anchoring for consumers who need a `getAttestation()` read from a smart
contract. **Disco = skip.** Emit a plain W3C VC/JWT ourselves if a customer demands VC format —
that needs no Disco dependency.

---

## What it proves

**EAS proves nothing about humanity.** It is a notary, not an oracle. The semantic content of
`Attestation.data` is opaque bytes decoded per-schema. What EAS guarantees on-chain is:

- an address (`attester`) submitted a record under a given `schema` UID,
- naming a `recipient` (may be `address(0)`),
- at block time `time`,
- optionally with `expirationTime`, `revocable`, and a `refUID` pointer to another attestation,
- and whether that record has since been `revoked` (`revocationTime != 0`).

Everything of value — "this human is unique" — lives entirely in *who the attester is*. From the
aggregator's perspective this cuts both ways:

- **As an input:** an EAS attestation is worth exactly the reputation of its issuer. `Attested`
  events are permissionless; anyone can attest anything to any schema (unless the schema has a
  resolver that gates it). Never score an attestation by schema UID alone — always filter on
  `attester ∈ {known issuer set}`.
- **As an output:** publishing our aggregate as an EAS attestation gives consumers a
  zero-integration read path, at the cost of a permanent public link between an address and the
  claim "verified human" (see Privacy model).

## Trust root & failure modes

**EAS's own trust root** is the immutability of the deployed contracts. The `EAS.sol` /
`SchemaRegistry.sol` source has no owner, no pause, and no fee switch. But **"EAS is immutable" is
only true on some chains, and it is FALSE on exactly the chains we care about.** Verified directly
against RPC, 2026-07-24:

| Chain | `EAS` address | EIP-1967 impl slot | Verdict |
|---|---|---|---|
| Ethereum L1 | `0xA1207F3B…Ce587` | `0x0` (no proxy); 19,971 bytes of real code | **Truly immutable** |
| **Base** | `0x42…0021` | `0xbeb5fc579115071764c7423a4f12edde41f106ed` | **Upgradeable proxy** |
| **OP Mainnet** | `0x42…0021` | (proxy) | **Upgradeable proxy** |

On both Base and OP Mainnet the predeploy is a **2,055-byte EIP-1967 transparent proxy** whose
**admin slot** (`0xb531…6103`) reads
**`0x4200000000000000000000000000000000000018`** — the OP-Stack **`ProxyAdmin`** predeploy. In other
words, **on every OP-Stack chain (Base, OP, Blast, Soneium, Ink, Unichain) the EAS contract can be
upgraded by whoever controls that chain's ProxyAdmin owner** — the Optimism Security Council /
Coinbase-side multisig, not the EAS org and not us.

This materially changes the pitch. The correct statement is: *"EAS on L1 is immutable; EAS on
OP-Stack chains inherits the chain's own upgrade trust assumptions, which you are already accepting
by using that chain."* That is defensible — you already trust Base's ProxyAdmin for the bridge — but
we should never tell a customer that a Base attestation is protected by an unownable contract. It
is not.

`UNVERIFIED:` whether any OP-Stack chain has ever actually exercised this upgrade path, and the
current owner of `0x42…0018` on Base. Next step: `ProxyAdmin.owner()` on Base and the OP
`superchain-registry`.

Repro:
```bash
# admin slot -> 0x...4200000000000000000000000000000000000018 (ProxyAdmin predeploy)
cast storage 0x4200000000000000000000000000000000000021 \
  0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103 --rpc-url https://mainnet.base.org
```

Failure modes that matter to us:

1. **Schema squatting / impersonation.** Schema UIDs are content-derived, so a *different* attester
   can attest to the *same* schema UID as Coinbase. Consumers that check only `schemaUID` are
   trivially spoofable. This is the #1 integration bug in EAS-based identity. Always check
   `attestation.attester`.
2. **Off-chain data availability.** Off-chain attestations are just signed JSON; EAS stores nothing.
   If the issuer's CDN/IPFS pin dies, the credential is gone unless the holder kept a copy.
3. **Resolver griefing.** A schema's resolver can revert on `attest`, or charge ETH. If we register
   a schema with a resolver, a bug in the resolver bricks all future attestations under that schema
   permanently (schemas are immutable once registered — the resolver address cannot be changed).
4. **Revocation is issuer-controlled and on-chain-only for on-chain attestations.** Off-chain
   attestations are revoked via `revokeOffchain(bytes32 data)`, which writes a timestamp keyed by
   `(revoker, dataHash)` — so a consumer must *also* do an on-chain read to check revocation of an
   off-chain attestation. Many implementations skip this. Plan for it.
5. **Indexer dependence.** There is no on-chain "give me all attestations for address X" view on the
   core `EAS` contract. Enumeration requires either the optional `Indexer` contract, the EASSCAN
   GraphQL API, or your own log-indexer over `Attested`/`Revoked` events. Treat the hosted GraphQL
   as a convenience, not a dependency.

## On-chain surface

### Core contracts

Two contracts per chain. `SchemaRegistry` (register schema strings) and `EAS` (make/revoke/read
attestations). Optional per-chain: `EIP712Proxy` (lets a relayer pay gas for delegated attestations
while preserving the original attester) and `Indexer` (adds enumerable views).

Source: [`eas-contracts` README, deployments section](https://github.com/ethereum-attestation-service/eas-contracts#deployments)
(read 2026-07-24). Addresses are also importable programmatically from
`@ethereum-attestation-service/eas-contracts/deployments/<network>/EAS.json`.

#### Mainnets

| Chain | EAS ver | `EAS` | `SchemaRegistry` |
|---|---|---|---|
| Ethereum | 0.26 | `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` | `0xA7b39296258348C78294F95B872b282326A97BDF` |
| OP Mainnet | 1.0.1 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Base | 1.0.1 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Arbitrum One | 0.26 | `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458` | `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB` |
| Arbitrum Nova | 1.3.0 | `0x6d3dC0Fe5351087E3Af3bDe8eB3F7350ed894fc3` | `0x49563d0DA8DF38ef2eBF9C1167270334D72cE0AE` |
| Polygon | 1.3.0 | `0x5E634ef5355f45A855d02D66eCD687b1502AF790` | `0x7876EEF51A891E737AF8ba5A5E0f0Fd29073D5a7` |
| Scroll | 1.3.0 | `0xC47300428b6AD2c7D03BB76D05A176058b47E6B0` | `0xD2CDF46556543316e7D34e8eDc4624e2bB95e3B6` |
| zkSync Era | 1.3.0 | `0x21d8d4eE83b80bc0Cc0f2B7df3117Cf212d02901` | `0xB8566376dFe68B76FA985D5448cc2FbD578412a2` |
| Celo | 1.3.0 | `0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92` | `0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34` |
| Linea | 1.2.0 | `0xaEF4103A04090071165F78D45D83A0C0782c2B2a` | `0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797` |
| Blast | 1.3.0 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Telos | 1.4.0 | `0x9898C3FF2fdCA9E734556fC4BCCd5b9239218155` | `0x842511adC21B85C0B2fdB02AAcFA92fdf7Cda470` |
| Soneium | 1.4.1-beta.1 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Ink | 1.4.1-beta.1 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Unichain | 1.4.1-beta.1 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |

Note the pattern: **every OP-Stack chain uses the same two predeploy addresses**
(`0x42..21` = EAS, `0x42..20` = SchemaRegistry). That is a real integration convenience — one code
path covers OP, Base, Blast, Soneium, Ink, Unichain and any future OP-Stack rollup.

#### Testnets

| Chain | EAS ver | `EAS` | `SchemaRegistry` |
|---|---|---|---|
| Sepolia | 0.26 | `0xC2679fBD37d54388Ce493F1DB75320D236e1815e` | `0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0` |
| OP Sepolia | 1.0.2 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Base Sepolia | 1.2.0 | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Polygon Amoy | 1.3.0 | `0xb101275a60d8bfb14529C421899aD7CA1Ae5B5Fc` | `0x23c5701A1BDa89C61d181BD79E5203c730708AE7` |
| Scroll Sepolia | 1.3.0 | `0xaEF4103A04090071165F78D45D83A0C0782c2B2a` | `0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797` |
| Linea Goerli | 1.2.0 | `0xaEF4103A04090071165F78D45D83A0C0782c2B2a` | `0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797` |

Also deployed as of 2026: Hyperliquid Testnet (added in commit 2026-05-18). Version skew is real —
Ethereum L1 and Arbitrum One are still on **0.26**, which predates `multiAttest` deadline
semantics and some struct fields. If we deploy a resolver, target ≥1.2.0 chains.

### The `Attestation` struct (what a consumer actually gets back)

From [`contracts/Common.sol`](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/Common.sol):

```solidity
struct Attestation {
    bytes32 uid;            // unique id of this attestation
    bytes32 schema;         // schema UID
    uint64  time;           // created (unix)
    uint64  expirationTime; // 0 = never expires
    uint64  revocationTime; // 0 = not revoked
    bytes32 refUID;         // pointer to a related attestation (0 = none)
    address recipient;      // subject
    address attester;       // issuer  <-- the only thing that carries trust
    bool    revocable;
    bytes   data;           // ABI-encoded per the schema string
}
```

### The read path for a consumer contract

From [`contracts/IEAS.sol`](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/IEAS.sol):

```solidity
function getAttestation(bytes32 uid) external view returns (Attestation memory);
function isAttestationValid(bytes32 uid) external view returns (bool);   // exists, ignores expiry/revocation
function getTimestamp(bytes32 data) external view returns (uint64);      // off-chain: when hash was timestamped
function getRevokeOffchain(address revoker, bytes32 data) external view returns (uint64); // off-chain revocation
function getSchemaRegistry() external view returns (ISchemaRegistry);
```

Minimal correct consumer check for "is this address a verified human per issuer X":

```solidity
IEAS eas = IEAS(0x4200000000000000000000000000000000000021); // OP-Stack
Attestation memory a = eas.getAttestation(uid);
require(a.uid != bytes32(0),                       "no attestation");
require(a.schema == HUMANITY_SCHEMA_UID,           "wrong schema");
require(a.attester == TRUSTED_ISSUER,              "untrusted attester"); // <-- do not omit
require(a.recipient == user,                       "wrong subject");
require(a.revocationTime == 0,                     "revoked");
require(a.expirationTime == 0 || a.expirationTime > block.timestamp, "expired");
// then abi.decode(a.data, (...)) per the schema string
```

**Critical gap:** the consumer needs the `uid` from somewhere. `getAttestation` is UID-keyed — there
is **no** `getAttestationsFor(address)` on the core contract. Options: (a) the user passes the UID
as calldata, (b) our own on-chain registry maps `address => uid`, (c) the optional `Indexer`
contract (deployed on OP, Base, Polygon, Scroll, zkSync, Celo, Arbitrum Nova, Telos, Soneium, Ink,
Unichain — **not** on Ethereum L1, Arbitrum One, Linea or Blast per the README). This asymmetry is
an argument for shipping our own thin `HumanityRegistry` view contract that resolves
`address -> uid` and does the checks above, so integrators call one function.

### Writes and events

```solidity
function attest(AttestationRequest calldata) external payable returns (bytes32);
function attestByDelegation(DelegatedAttestationRequest calldata) external payable returns (bytes32);
function multiAttest(MultiAttestationRequest[] calldata) external payable returns (bytes32[] memory);
function revoke(RevocationRequest calldata) external payable;
function timestamp(bytes32 data) external returns (uint64);
function revokeOffchain(bytes32 data) external returns (uint64);
```

Events to index:

```solidity
event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID);
event Revoked (address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID);
event Timestamped(bytes32 indexed data, uint64 indexed timestamp);
event RevokedOffchain(address indexed revoker, bytes32 indexed data, uint64 indexed timestamp);
```

`recipient`, `attester` and `schemaUID` are all indexed — so a log filter on
`(schemaUID = ours, attester = us)` is cheap and sufficient to build our own index without any
vendor. **This is the key neutrality property:** we can reconstruct the full state of our own
credential from raw logs on any RPC, with no EASSCAN dependency.

### The schema model

`SchemaRegistry.register(string schema, ISchemaResolver resolver, bool revocable) -> bytes32`
([source](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/ISchemaRegistry.sol)).

```solidity
struct SchemaRecord {
    bytes32 uid;
    ISchemaResolver resolver;  // optional hook, IMMUTABLE once registered
    bool revocable;            // whether attestations under it may be revoked at all
    string schema;             // e.g. "bool verifiedAccount" or "uint8 score,uint64 issuedAt"
}
```

**Schema UID derivation** ([`SchemaRegistry.sol#_getUID`](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/SchemaRegistry.sol)):

```solidity
uid = keccak256(abi.encodePacked(schema, resolver, revocable));
```

Consequences worth internalising:

- A schema UID is **deterministic and content-addressed** — it is a function of the ABI string, the
  resolver address and the revocable flag *only*. It is **not** namespaced by the registerer.
  Registering the same triple twice reverts with `AlreadyExists`.
- Therefore **the same schema UID is different on every chain only if the resolver address differs.**
  A resolver-less schema like `"bool verifiedAccount"` with `resolver = address(0)` has an identical
  UID on every chain. Good for portability, bad for authorization — nothing binds a schema to its
  creator.
- Schemas are **immutable**: no way to change the resolver, the string, or the revocable flag later.
  Versioning means registering a new schema and a new UID. Design ours to be additive-friendly.
- There is no schema name/description on-chain; EASSCAN stores names/descriptions as *separate
  attestations* under meta-schemas (see `docs/tutorials/naming-your-schema.md`,
  `schema-description.md`, `schema-context.md`). So schema metadata is itself off the core contract
  and only visible via the indexer. Don't rely on names.

**Attestation UID derivation** ([`EAS.sol#_getUID`](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/EAS.sol)):

```solidity
uid = keccak256(abi.encodePacked(schema, recipient, attester, time, expirationTime,
                                 revocable, refUID, data, bump));
```

`bump` is incremented on collision. Note `time` is in there, so an identical attestation made in a
later block gets a different UID — you cannot predict a UID off-chain without knowing the block
timestamp. (Off-chain attestations use the same shape but the signer chooses `time`, so those UIDs
*are* predictable.)

### The resolver hook — this is the important one for us

A schema may declare an `ISchemaResolver`
([interface](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/resolver/ISchemaResolver.sol)):

```solidity
function attest(Attestation calldata attestation) external payable returns (bool);
function multiAttest(Attestation[] calldata, uint256[] calldata) external payable returns (bool);
function revoke(Attestation calldata attestation) external payable returns (bool);
function multiRevoke(Attestation[] calldata, uint256[] calldata) external payable returns (bool);
function isPayable() external pure returns (bool);
```

`EAS` calls the resolver *after* writing the attestation; returning `false` reverts the whole
attest. This lets us enforce arbitrary policy at attest time. Shipped example resolvers in the repo
(`contracts/resolver/examples/`): `AttesterResolver` (allowlist a single attester),
`RecipientResolver`, `ExpirationTimeResolver`, `DataResolver`, `TokenResolver`, `ValueResolver`,
`PayingResolver`, `RevocationResolver`, `AttestationResolver`, and — added 2026-07 —
`SelfVerifyingResolver` ("accept an attestation only if its claim recomputes from public on-chain
state", commit 2026-07-03).

For our aggregate humanity assertion, a resolver gives us three things a bare attestation can't:

1. **Attester allowlist** — only our signer can write under our schema. Kills the schema-squatting
   problem *for consumers*, meaning integrators can safely check schema UID alone. This is exactly
   what Coinbase does (see below), and it is the single highest-value design decision.
2. **One-attestation-per-recipient enforcement** — the resolver can maintain
   `mapping(address => bytes32)` and revert on a second live attestation, giving on-chain
   uniqueness-per-address for free.
3. **Indexing** — the resolver can write `recipient => uid` into an indexer contract so consumers
   need only an address, not a UID. Again, exactly Coinbase's design.

Caveat repeated from failure modes: the resolver address is baked into the schema UID and can never
be changed. If our resolver has a bug or its owner key is lost, the schema is dead and every
integrator must migrate to a new UID. Mitigation: make the resolver a thin, audited, minimal-logic
contract that delegates policy to a *separately upgradeable* policy contract it points at.

### Off-chain attestations & the signed format

An off-chain attestation is an **EIP-712 signed typed-data blob**. Nothing is written to any chain.
From [`eas-sdk/src/offchain/offchain.ts`](https://github.com/ethereum-attestation-service/eas-sdk/blob/master/src/offchain/offchain.ts),
the current type (`OffchainAttestationVersion.Version2`) is:

```
domain    = { name: "EAS Attestation", version: <"0.26"|"1.0.0"|…|"1.4.0">,
              chainId: <chain>, verifyingContract: <EAS address> }
primaryType = "Attest"
Attest = {
  uint16  version;         // 2
  bytes32 schema;
  address recipient;
  uint64  time;
  uint64  expirationTime;
  bool    revocable;
  bytes32 refUID;
  bytes   data;
  bytes32 salt;            // NEW in v2 — 32 random bytes
}
```

The `salt` field (v2) is significant for us: it makes the attestation's UID/hash unguessable, so a
holder can publish the *hash* (e.g. via `timestamp(bytes32)`) without an observer being able to
brute-force which `(recipient, schema)` pair it corresponds to. v0/v1 lacked this.

Legacy versions (`OffchainAttestationVersion.Legacy = 0`) have three different type layouts with
inconsistent `primaryType` (`Attestation` vs `Attest`) — a verifier must try all of them. If we
consume third-party off-chain attestations, use the SDK's version-aware verifier rather than
hand-rolling EIP-712.

**Storage is entirely our problem.** EAS stores nothing. The canonical EASSCAN trick is to gzip +
base64 the whole signed attestation into a **URL fragment** (`https://<chain>.easscan.org/offchain/
url/#attestation=<blob>`) — the server never sees it, since fragments aren't sent to servers. See
[`docs/core--concepts/privacy.md`](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/core--concepts/privacy.md).
Other documented options: IPFS, Ceramic/ComposeDB (there is a dedicated
[`ceramic-storage.md`](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/tutorials/ceramic-storage.md)
tutorial), or a plain vendor database (i.e. ours).

**Lazy on-chain verification — can we do it?** Yes, with caveats:

- *Existence/timestamping:* `timestamp(bytes32 data)` writes `block.timestamp` for a hash. Cost is
  one SSTORE (~20k gas + 21k base). This gives "this off-chain attestation existed by time T"
  without revealing content. `getTimestamp(bytes32)` reads it back.
- *Revocation:* `revokeOffchain(bytes32 data)` / `getRevokeOffchain(address revoker, bytes32 data)`.
  Note the revocation record is keyed by revoker, so a consumer must know our revoker address.
- *Full signature verification on-chain:* not provided by `EAS`. A consumer contract that wants to
  accept an off-chain attestation must itself do `ecrecover` over the EIP-712 digest and compare to
  our known signer. That's ~3-6k gas and ~30 lines of Solidity, but **it is code the integrator has
  to write** — there is no `IEAS.verifyOffchain(...)`. This is the single biggest friction argument
  against off-chain-only for smart-contract consumers.
- The SDK exposes `verifyOffchainAttestationSignature()` for off-chain (JS) verification, which is
  the realistic path for API/backend consumers.

**Cost implications — measured, not guessed.** Off-chain = **zero gas** for issuance. For on-chain,
I pulled real `eth_getTransactionReceipt` gas for live Base attestations (2026-07-24):

| Path | `gasUsed` |
|---|---|
| Coinbase Verified Account (`bool` payload) via their attester contract → resolver + indexer writes | **282,312 – 328,031** (modal **282,312**) |
| Direct `attest()` to the EAS predeploy `0x42…0021`, larger payloads | **374,303** and **513,570** |

So the honest planning number is **~280k gas for a minimal resolver-backed attestation, ~375k+ for
anything with a real payload** — roughly 1.5–2× higher than a naive "it's just one SSTORE" estimate,
because EAS writes the whole `Attestation` struct (uid, schema, 3× uint64, refUID, 2 addresses,
bool, bytes) plus the resolver/indexer hop. Note the *docs' own*
[gas-efficiency tutorial](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/tutorials/gas-efficiency.md)
gives only the components (21k base, 16 gas/non-zero calldata byte, 4/zero byte) and **publishes no
headline `attest()` figure** — hence measuring.

Implication: negligible on Base/OP (fractions of a cent at typical L2 fees), but at ~300k gas
Ethereum L1 is **decisively** out for per-user attestation at any scale. This is consistent with
L1's 14,151 lifetime attestations (below).

Docs' own recommendations that we should follow: keep `data` minimal (attest the *result*, not the
evidence), use `uint64` for timestamps and `uint8` for enums, use `refUID` for modular composition
rather than one fat schema.

### Referenced attestations (`refUID`) — attestation graphs

`AttestationRequestData.refUID` points at another attestation's UID. `EAS._attest` enforces that the
referenced UID exists (`if (!isAttestationValid(request.refUID)) revert NotFound();`) — but note it
uses `isAttestationValid`, which only checks existence, **not** expiry or revocation. So a reference
can point at an expired or revoked parent and the chain will happily accept it. Any graph traversal
we do must re-validate each hop ourselves.

This is genuinely useful for our product shape: an aggregate humanity attestation can be the *root*,
with per-source evidence attestations referencing it (or vice versa), so a consumer can drill from
"score 0.87" down to "because World ID + Coinbase + Gitcoin". Caveats: `refUID` is a single parent
pointer, not a list — a fan-out graph means N child attestations each pointing at our root, and
enumerating them requires an indexer. And on-chain evidence attestations re-expose exactly the
linkage we may want to hide (see Privacy model).

## Integration surface

### SDK

- **`@ethereum-attestation-service/eas-sdk`** — TypeScript, MIT.
  Repo [`eas-sdk`](https://github.com/ethereum-attestation-service/eas-sdk), 140★, last commit
  **2026-05-29**, most recent tagged version seen in commit log **2.9.1** (2026-05-27). Actively
  maintained. Built on `ethers` v6. Provides `EAS`, `SchemaRegistry`, `SchemaEncoder`, `Offchain`,
  `Delegated`, and offchain signature verification.
- **`@ethereum-attestation-service/eas-contracts`** — Solidity, MIT, 318★, last commit
  **2026-07-16**. Ships `deployments/<network>/EAS.json` artifacts so addresses/ABIs can be imported
  rather than hard-coded.
- There is also an **`eas-sdk-v2`** repo (last push 2025-10-15) and **`easctl`** CLI (2026-03-27) —
  both low-activity; `UNCLEAR:` whether `eas-sdk-v2` is the intended successor. Do not build on it
  without asking.
- **Wagmi** docs page exists (`docs/developer-tools/sdk-wagmi.md`) and a **MetaMask Snap**
  (`eas-metamask-snap`, last push 2024-02-27 — stale).

No API key, no auth, no rate limit, no pricing for the contracts themselves — it's just an EVM
contract. **Permissionless verification is fully possible without any vendor.**

### Indexer / GraphQL (EASSCAN)

Hosted GraphQL, no auth required, per-chain subdomains
([source](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/developer-tools/api.md)):

| Chain | Endpoint |
|---|---|
| Ethereum | `https://easscan.org/graphql` |
| Sepolia | `https://sepolia.easscan.org/graphql` |
| Base | `https://base.easscan.org/graphql` |
| Base Sepolia | `https://base-sepolia.easscan.org/graphql` |
| Optimism | `https://optimism.easscan.org/graphql` |
| OP Sepolia | `https://optimism-sepolia-bedrock.easscan.org/graphql` |
| Arbitrum | `https://arbitrum.easscan.org/graphql` |
| Arbitrum Nova | `https://arbitrum-nova.easscan.org/graphql` |
| Scroll | `https://scroll.easscan.org/graphql` |
| Polygon | `https://polygon.easscan.org/graphql` |
| Linea | `https://linea.easscan.org/graphql` |
| Celo | `https://celo.easscan.org/graphql` |

Verified live 2026-07-24: `POST https://base.easscan.org/graphql` responds; schema is
Prisma-flavoured (`attestations`, `attestation`, `schemata`, `schema`, `aggregateAttestation`,
`groupByAttestation`) with `where`/`take`/`orderBy` and a useful `decodedDataJson` field that
saves us from ABI-decoding client-side.

**Reliability caveat, observed directly:** during this research a `groupByAttestation` query
returned an HTML **"EAS Explorer - Maintenance"** page instead of JSON, while simple
`aggregateAttestation` queries succeeded seconds before and after. Treat EASSCAN as best-effort,
un-SLA'd public infrastructure. **Do not put it in a synchronous user-facing path.** For production
we should run our own indexer: options are the official
[`eas-indexing-service`](https://github.com/ethereum-attestation-service/eas-indexing-service)
(50★, last push 2026-03-16), `easter-indexer-v2` (2026-01-23), `eas-graph-server` (2025-10-21), or
— simplest and most robust — our own log-indexer over the four `Attested`/`Revoked`/`Timestamped`/
`RevokedOffchain` events, all of which have indexed `attester`/`recipient`/`schemaUID` topics.

### Who is actually using EAS for personhood/identity

#### Coinbase Verifications (Base) — the flagship

Primary source: [`github.com/coinbase/verifications`](https://github.com/coinbase/verifications).

Base mainnet contracts:

| Role | Address |
|---|---|
| Coinbase **Attester** (the address that signs every attestation) | `0x357458739F90461b99789350868CD7CF330Dd7EE` |
| Coinbase **Indexer** (`recipient` + `schemaUID` -> latest UID) | `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C` |
| Coinbase **Resolver** (schema-permission + auto-index) | `0xD867CbEd445c37b0F95Cc956fe6B539BdEf7F32f` |
| EAS / SchemaRegistry | OP-Stack predeploys `0x42..21` / `0x42..20` |

Base mainnet schema UIDs:

| Schema | UID | Schema string |
|---|---|---|
| Verified Account | `0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9` | `bool verifiedAccount` (always `true`) |
| Verified Country | `0x1801901fabd0e6189356b4fb52bb0ab855276d84f7ec140839fbd1f6801ca065` | ISO 3166-1 alpha-2 country string |
| Verified Coinbase One | `0x254bd1b63e0591fefa66818ca054c78627306f253f86be6023725a67ee6bf9f4` | `bool` (always `true`) |

Base Sepolia UIDs differ (`0x2f34a2ff…c765a69`, `0xef54ae90…c3a84028`, `0xef8a2885…974a1e8c`) — note
this confirms schema UIDs are **not** stable across chains when the resolver address differs.

Live measurements via `https://base.easscan.org/graphql`, **2026-07-24**:

| Metric | Value |
|---|---|
| Total attestations on Base (all schemas) | **3,574,218** |
| Verified Account — total ever issued | **720,503** |
| Verified Account — currently **revoked** | **406,022** (56.4%) |
| Verified Account — currently live | **~314,481** |
| Verified Country — total ever issued | **305,296** |
| Verified Coinbase One — total ever issued | **161,174** |
| Verified Account schema registered | 2023-10-23 (`creator 0x44ACE9abB148e8412AC4492e9A1AE6bd88226803`) |
| Most recent Verified Account attestation seen | 2026-07-24 21:40 UTC — actively issued today |

`UNVERIFIED:` distinct-recipient count for Verified Account — the `groupByAttestation` query hit the
maintenance page. The 56% revocation rate strongly suggests **revoke-and-reissue churn** (users
re-verify, change wallets, or Coinbase refreshes), so unique humans is materially **below** 314k.
Next step: run our own log-index of `Attested`/`Revoked` on Base filtered to
`attester = 0x3574…D7EE` and count distinct live recipients.

**What Coinbase actually proves — be precise.** `bool verifiedAccount = true` means *"this address
was claimed by someone who at attest time held a Coinbase account that had passed Coinbase's KYC for
their jurisdiction."* That is:

- ✅ **State-identity-adjacent** — Coinbase KYC is document-based, so there is a real government ID
  behind it.
- ⚠️ **NOT uniqueness.** Nothing stops one Coinbase user attesting to many self-custodial addresses;
  the attestation binds a Coinbase *account* to an *address*, and the account→address mapping is
  1-to-many. There is no nullifier. A single KYC'd person can hold many Verified Account
  attestations across many wallets. **Treat as "KYC'd-account-linked", not "unique human".**
  `UNCLEAR:` whether Coinbase's off-chain issuance flow rate-limits addresses per account — the repo
  doesn't say. Worth asking them directly; it changes the sybil weight materially.
- ⚠️ Coinbase's own legal notice in the README explicitly disclaims reliance: *"for informational
  purposes only and should not be relied upon … for any legal, compliance, or contractual
  purpose … Coinbase does not represent, warrant or guarantee that the information … is complete,
  accurate, or current."* Attestations are **not** revoked promptly when account status changes.
- Jurisdictional variance is admitted: *"the specific processes that Coinbase uses to verify the
  identities of its customers may differ by jurisdiction."*

**The design pattern we should copy:** Coinbase's resolver restricts the schema to permitted
attesters, which is why their README can say *"verifying the schema ID should be sufficient in most
cases as our schemas are protected such that only Coinbase permitted attesters may use it."* Plus a
separate `IAttestationIndexer` contract giving `(recipient, schemaUID) -> uid`, and a Foundry-
installable helper library (`forge install coinbase/verifications`) with
`AttestationVerifier.sol` / `AttestationAccessControl.sol`. That is the full stack an integrator
wants, and it's ~4 small contracts. It is the right blueprint for our on-chain output.

Also consumable via **Base OnchainKit** `getAttestations` / `<Badge />`
([docs.base.org](https://docs.base.org/onchainkit/identity/get-attestations)) — a React-level
integration path that already ships to a large wallet audience. If we publish on Base under a
resolver-protected schema, we plug into that same surface with no new consumer code.

#### Optimism / the Superchain

- **AttestationStation V1** (Optimism's original bespoke attestation contract) was **superseded by
  EAS**; EAS is now a **native OP-Stack predeploy**, which is why every OP-Stack chain has EAS at
  `0x42..21`. That is the single strongest distribution fact about EAS: it ships with the chain.
- Optimism used EAS attestations for **RetroPGF project profiles and badgeholder identity**
  (Citizens' House voting). Secondary source:
  [Optimism blog, "Building a Decentralized Identity Ecosystem, Together"](https://www.optimism.io/blog/building-a-decentralized-identity-ecosystem-together);
  [CoinDesk, 2023-05-04](https://www.coindesk.com/tech/2023/05/04/layer-2-network-optimism-to-use-ethereum-attestation-service-to-promote-user-trust).
- **Status caution (2026-07-24):** `https://community.optimism.io/identity/about-attestations` now
  **301-redirects to `https://docs.optimism.io/governance`**, and
  `https://docs.optimism.io/chain/identity/schemas` returns **404**. Optimism's dedicated identity/
  attestation docs have been retired. Separately, search results indicate **Retro Funding is paused
  through the end of 2026** — so the badgeholder-attestation use case that drove much of OP's
  attestation volume is currently dormant. `UNVERIFIED:` the current canonical location of OP's
  citizen/badgeholder schema UIDs; next step is `optimism.easscan.org` schema search or the
  `ethereum-optimism/ecosystem-contributions` repo.
- Raw activity is nonetheless real. Measured 2026-07-24 via `optimism.easscan.org/graphql`:
  **1,318,040 total attestations** on OP Mainnet, with attestations landing the same day.

#### Chain-by-chain reality check (measured 2026-07-24)

| Chain | Total EAS attestations | Note |
|---|---|---|
| Base | **3,574,218** | dominated by Coinbase Verifications |
| OP Mainnet | **1,318,040** | RetroPGF-era + ongoing |
| Ethereum L1 | **14,151** (395 schemas) | effectively unused — gas makes it pointless |

**Conclusion: EAS is an L2 protocol in practice.** Anyone who tells us "publish on Ethereum
mainnet for maximum legitimacy" is arguing against 14k lifetime attestations. Base is where the
identity gravity is.

### Governance and neutrality

Arguments that EAS is credibly neutral infrastructure:

- **No token, no plans for one** — stated explicitly in the
  [FAQ](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/quick--start/faqs.md):
  *"EAS is a tokenless protocol and does not have plans to launch a token. Being a tokenless protocol
  is critical to our design as to remain credibly neutral."*
- **No protocol fees, no admin key in the source, no rent extraction.** MIT licence. (But see Trust
  root: the *deployment* on OP-Stack chains sits behind the chain's own upgradeable proxy. Only the
  Ethereum L1 deployment is literally non-upgradeable.)
- **Audited by Spearbit** (per FAQ). `UNVERIFIED:` public link to the Spearbit report — worth
  obtaining before we put material value behind a resolver.
- **Forkability:** the whole thing is ~800 lines of Solidity across two contracts. If the EAS org
  vanished tomorrow, deployed contracts keep working forever and anyone can redeploy.
- **OP Stack predeploy status** means chain operators, not the EAS org, carry the deployment.

Arguments against, which we should weigh honestly:

- **Funding is precarious by design.** FAQ: *"EAS operates as a public good and doesn't generate
  revenue from its core services. Its funding sources include donations, grants, and retroactive
  public goods funding."* Its most-cited funding source, Optimism RetroPGF, is **paused through end
  of 2026**. A donation-funded org with no revenue is a real going-concern question for anything
  they *host* (EASSCAN explorer, GraphQL, indexer).
- **The off-chain pieces are single-org.** EASSCAN, the GraphQL endpoints, the schema-name registry
  UI, and the hosted indexer are all EAS-org-operated, un-SLA'd, and we watched one query return a
  maintenance page today. The *protocol* is neutral; the *tooling around it* is a single-org
  dependency.
- **Small team.** Development is concentrated: `eas-contracts` at 318★ with a low commit cadence
  (meaningful commits in 2026: Jan/Mar/May/Jul). Not abandoned, but not a large maintainer bench.
- **OP-Stack predeploys are governed by the chain.** See caveat in Trust root.

**Net:** the *contracts* are as close to credibly neutral as anything in this space. The *hosted
services* are not, and we must not depend on them. That distinction should be explicit in our
architecture: read from RPC + our own index; use EASSCAN only for debugging and for links in a UI.

---

# Disco.xyz — **DEAD.** Do not integrate.

**Verdict: skip.** Disco.xyz merged into Privado ID in September 2024, wound down through 2025, and
its domain has since been dropped and re-registered by an SEO spam operator. There is no API, no
docs, no app, no maintained SDK. Any integration work here is wasted.

## Evidence of death (all checked 2026-07-24)

| Signal | Finding |
|---|---|
| **Merger announcement** | [Privado ID blog, **2024-09-19**](https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems): "Privado ID and Disco.xyz Announce Merger…". Founder **Evin McMullen** joined Privado ID as cofounder & Chief Strategy Officer; combined entity operates under the **Privado ID** banner. The announcement is conspicuously silent on what happens to existing Disco users, credentials, or the API. |
| **GitHub org `discoxyz`** | Last push to *any* repo: **2024-04-30** (`disco-schemas` v2.2.0). Every other repo last touched 2022–2023. `disco-api-docs` is **archived**. Zero activity for ~27 months. |
| **`docs.disco.xyz`** | **NXDOMAIN** — DNS record removed entirely. |
| **`api.disco.xyz`** | **NXDOMAIN**. |
| **`app.disco.xyz`** | **NXDOMAIN** — the "data backpack" app itself is gone. |
| **`issuer.disco.xyz`** | **NXDOMAIN**. |
| **`disco.xyz` apex** | Resolves (Cloudflare) and returns HTTP 200 — but it is now a **WordPress SEO-spam site** titled *"Spy Apps 2025: Best Monitoring Software for Smartphones."* |
| **npm** | `disco-js`, `@disco-xyz/disco-js`, `@discoxyz/disco-js` — all **404 Not Found** on the npm registry. `UNCLEAR:` the exact historical package name; regardless, nothing under an obvious Disco scope is published. |
| **Blog `disco.mirror.xyz`** | Returns **403 / Cloudflare challenge**; content not retrievable. Not evidence of life. |

### Domain-decay timeline (Wayback Machine captures of `disco.xyz`)

| Capture | Page title / behaviour |
|---|---|
| 2025-04-23 | **"Disco (now privado.id)"** — official wind-down redirect banner |
| 2025-07-16 | JS redirect to `/lander` — **domain parked** |
| 2025-10-04 | **"Disco.xyz — Social Discovery Platform & Community"** — domain re-registered, unrelated content |
| 2025-12-11 → 2026-05-11 → today | **"Spy Apps 2025: Best Monitoring Software for Smartphones"** — WordPress SEO spam |

This is an unusually clean death certificate: an official "now privado.id" notice, then parking,
then a third party taking the domain. **The `disco.xyz` domain is now hostile.** Anything in our
codebase or docs pointing at `disco.xyz` should be treated as a supply-chain/reputation risk — and
note that any historical Disco credential whose `credentialSchema`, `issuer` DID, or `@context`
resolves to a `disco.xyz` URL is now resolving into an attacker-controlled domain. That is a real
argument against URL-resolved VC contexts in general.

## What Disco actually shipped (historical, for context only)

- **W3C Verifiable Credentials** issued to **DIDs**, with the user's collection framed as a
  "**data backpack**" — a portable, user-held bundle of credentials rather than an on-chain registry.
- DIDs were **`did:3`** (Ceramic 3ID) — e.g. the app profile URL form
  `app.disco.xyz/did:3:kjzl6cwe1jw14b7xqq94oiy0lcnndgyt0p3vtlnsscpljosx6gom46qkxcv8sjb`. Storage was
  Ceramic/IPFS-backed, i.e. off-chain with on-chain anchoring, not EVM contract state.
- **`discoxyz/disco-schemas`** — "JSON Schema schemas for Verifiable Credentials" (8★), the closest
  thing to a durable artifact. Credential types included `Attendance`, `BetaUser`, `Completion`,
  `Membership`.
- Ecosystem experiments now abandoned: `disco-gitcoin-passport-score` (a Gitcoin Passport score as a
  VC — note the overlap with our Gitcoin work), `disco-credit-score-issuer`,
  `selective-disclosure-nextjs`, `Disco-GM-Faucet`, `poc-programatic-did`.
- **Verifiability without Disco:** in principle yes — a W3C VC is a signed JSON-LD/JWT document
  verifiable against the issuer's DID document. In practice, DID resolution for `did:3` requires a
  working **Ceramic** node and 3ID resolver, and `js-3id` / `js-ceramic` in the Disco org were last
  touched in early 2023. 3ID itself was deprecated by Ceramic in favour of `did:pkh` + CACAO. So
  **old Disco credentials are probably not practically verifiable today** without standing up
  archaeological infrastructure. Treat any Disco VC a user presents as unverifiable.

## Where Disco's people went — and why the orchestrator should care

- **Privado ID** (ex-Polygon ID) absorbed Disco in 2024-09 — Iden3/circom-based ZK credentials.
- **Evin McMullen** then co-founded **Billions Network** (launched ETH Denver **2025**), which
  markets itself as a *"mobile-first identity layer that verifies both humans and AI agents —
  proving uniqueness, KYC/AML status, location, age…while preserving privacy"*
  ([billions.network](https://billions.network/); secondary sources: LinkedIn, RootData, IQ.wiki).
- **⚠️ Cross-cutting note:** *Billions Network* and *Privado ID* are live personhood/uniqueness
  claimants that appear on none of the other research files in `research/protocols/`. If Billions
  really claims uniqueness proofs at scale, it belongs in the aggregator's protocol list. **Someone
  should own a `billions-and-privado-id.md`.** This write-up does not cover them — the claims above
  are unverified marketing copy from secondary sources.

---

# Privacy model

## EAS

EAS itself has **no** privacy features. It is a public append-only log. Privacy is entirely a
function of *what you choose to put in it*. From
[`docs/core--concepts/privacy.md`](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/core--concepts/privacy.md)
the sanctioned patterns are:

1. **Off-chain attestations** — nothing published at all; the signed blob lives in a URL fragment
   (never sent to a server), IPFS, Ceramic, or our DB. Maximum privacy, minimum composability.
2. **Private data attestations** — build a Merkle tree over the underlying evidence and attest only
   the **root**; the holder selectively discloses leaves + proofs.
   ([tutorial](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/tutorials/private-data-attestations.md))
3. **Off-chain computation, on-chain result** — the docs' own example is precisely ours: *"a platform
   could verify a user's age offchain and then only attest to whether the user is over 18 on-chain,
   without revealing the exact birthdate, or even that the verification had to do with a birthdate."*
4. **Encryption** of off-chain payloads.
5. **ZKPs** derived from attestation data. There is a whole `zk--playbook` docs section
   (`overview`, `core-concepts`, `recommended-tooling`, `interoperability`, `zk-roadblocks`,
   `myths`, `roadmap`) — `UNVERIFIED:` how much of it is implemented vs aspirational; it reads as
   guidance for builders, not shipped EAS functionality. **EAS ships no ZK primitives itself.**
6. **`salt`** in off-chain attestation v2 — makes the UID unguessable, so a published hash can't be
   brute-forced back to `(recipient, schema)`.

### The unavoidable problem with our on-chain output

**A public on-chain attestation `attester=us, recipient=0xUser, schema="is verified human"` is
itself a privacy harm, and it is permanent.** Specifically:

- It **links the address forever**. Blockchain data is immutable and globally indexed. Revoking the
  attestation does not delete it; `revocationTime` is just another field. Anyone who ever indexed
  the `Attested` event has the linkage in perpetuity.
- It **creates a de-anonymisation oracle**. Anyone can enumerate our schema's `Attested` events and
  get the complete set of addresses we consider human. Combined with any one off-chain leak
  (an exchange deposit, an ENS name, a Farcaster handle), it becomes a real-identity mapping.
- It **enables adversarial exclusion**. A censor can now cheaply distinguish "verified human" from
  everyone else, and discriminate in either direction. Regimes and platforms both.
- It **leaks a fresh timestamp** on every re-attestation, which is a behavioural signal.
- `refUID` evidence graphs make this dramatically worse: publishing *which* protocols contributed
  (World ID + Coinbase + a passport check) leaks the user's KYC posture and, via country schemas,
  approximate jurisdiction. **If we publish an aggregate on-chain, publish only the scalar result —
  never the evidence set.**

Mitigations, in decreasing order of how much we should like them:

- **Default to off-chain.** Sign an EAS off-chain attestation, hand it to the user, publish nothing.
- **On-chain but pseudonymous per-app.** Attest to an app-scoped address/nullifier rather than the
  user's main address. This is the standard World-ID-style unlinkability property and EAS does not
  give it to us — we have to construct it, and it is our design decision, not EAS's.
- **On-chain Merkle root only.** Attest a root over the evidence; disclose leaves off-chain.
- **`recipient = address(0)` + data-encoded commitment.** Attest a hiding commitment to the address
  rather than the address itself, so only someone holding the opening can verify. Loses the
  "consumer reads by address" convenience entirely — which is the whole point of on-chain. Honest
  assessment: **on-chain composability and address-privacy are close to mutually exclusive here.**
- Short `expirationTime` limits the *claim*'s life but not the *linkage*'s.

**Bottom line:** on-chain publication should be **opt-in per user and per consumer**, never a
default, and the consent copy must say plainly that it is permanent and public. This is the single
most important product decision in this document.

## Disco

n/a — dead. Historically the model was strictly better on privacy (user-held VCs, off-chain,
selective disclosure) and strictly worse on availability and verifiability. Its death is itself the
lesson: **a credential whose verifiability depends on a startup's DNS is a credential with a
shutdown clock.** EAS's non-upgradeable on-chain contracts have no such clock; our own off-chain
signed attestations have one only as long as our signer key and public key registry survive — which
argues for anchoring our *public key* (not our users) on-chain.

# Scoring-relevant facts

EAS contributes no score of its own. What it contributes to *our* scoring:

- **Coinbase Verified Account is worth a moderate, capped amount** — it is KYC-account-linked, not
  unique-human. One KYC'd person can hold many. Score it as *state-identity evidence with unknown
  multiplicity*, and cap it well below a true uniqueness proof. `UNCLEAR:` per-account address
  limit — this single unknown swings its weight by a lot.
- **Revocation churn is enormous and must be handled.** 406,022 of 720,503 (56.4%) Verified Account
  attestations are revoked (Base, 2026-07-24). Any integrator naively counting `Attested` events
  overstates the population by ~2.3×. Always filter `revocationTime == 0`.
- **Population sizes (Base, 2026-07-24):** ~314k live Verified Account, 305k Verified Country ever
  issued, 161k Verified Coinbase One ever issued. For scale, Base carries 3.57M EAS attestations
  total and OP Mainnet 1.32M; Ethereum L1 has just 14,151 across 395 schemas.
- **Geography is directly readable** from the Verified Country schema
  (`0x1801901f…01ca065`, ISO 3166-1 alpha-2). Useful for regional weighting, and simultaneously the
  clearest example of the privacy leak above.
- **Cost/friction to obtain a Coinbase verification:** free to the user apart from L2 gas; requires
  an existing KYC'd Coinbase account. So it is high-friction for the unbanked/non-US and near-zero
  for existing Coinbase customers — a strong geographic and demographic skew we should model.
- **No expiry:** sampled Coinbase attestations have `expirationTime = 0` (never expires). Freshness
  is managed purely by revoke-and-reissue, so *absence of revocation is the only liveness signal*,
  and Coinbase's own disclaimer says status changes "may not be reflected immediately."
- **Cost for us to publish:** ~0 for off-chain; on-chain roughly **~150k–250k gas** (`UNVERIFIED:`
  measure it) — negligible on Base/OP, prohibitive on L1.

# Overlap with other protocols

- **Coinbase Verified Account ↔ every other KYC-document-based protocol.** Its trust root is a
  government ID checked by Coinbase's KYC vendor. That is the *same* root as Civic, zkMe, Fractal,
  Sumsub-backed flows, and (partially) passport-NFC protocols. **Do not add Coinbase KYC and a
  document-KYC protocol as independent evidence** — they largely share a failure mode (a forged or
  rented government ID defeats both). Deduplicate at the *trust-root* level, not the protocol level.
- **Coinbase Verified Country ↔ any protocol asserting jurisdiction** — same root again.
- **EAS itself overlaps with nothing** — it is a transport. But note the reverse hazard: **the same
  underlying claim can appear multiple times on EAS under different schemas and attesters**
  (e.g. a Gitcoin Passport score republished as an EAS attestation by a third party). Our ingestion
  must key on the *original* trust root, not on "how many EAS attestations does this address have" —
  which is a trivially inflatable metric since attesting is permissionless.
- **Disco ↔ Gitcoin Passport** (historically): `discoxyz/disco-gitcoin-passport-score` republished
  Passport scores as VCs. Irrelevant now, but the pattern — credential laundering through a second
  format — is exactly what we must not let inflate a score.
- **Disco → Privado ID → Billions Network:** shared team lineage. If Billions is ever integrated,
  note that its founders' prior product died; that's an operational-risk data point, not a technical
  one.

# Open questions for us

1. **Does Coinbase limit Verified Account attestations per Coinbase account?** This determines
   whether it's worth ~0.2 or ~0.6 of a uniqueness unit in our score. Ask Coinbase via their
   [builder form](https://app.deform.cc/form/69d6f46e-426a-4bcd-bfe6-d3b3678bf4bf/); or measure by
   clustering recipients by funding source.
2. ~~Actual `attest()` gas cost~~ — **ANSWERED**: ~282k gas (Coinbase-style, resolver + indexer),
   374k–514k direct with larger payloads, measured on Base 2026-07-24. Remaining sub-question: cost
   of *our* resolver design specifically.
3. ~~Are the OP-Stack EAS predeploys upgradeable?~~ — **ANSWERED: YES.** `0x42…0021` on Base and OP
   Mainnet is an EIP-1967 proxy with admin = the `ProxyAdmin` predeploy `0x42…0018`. Remaining
   sub-question: **who owns `ProxyAdmin` on Base today**, and has the EAS implementation ever been
   upgraded? Check `ProxyAdmin.owner()` and the `superchain-registry`.
4. **Where is the Spearbit audit report for EAS?** The FAQ claims it; find the PDF.
5. **Distinct live recipients for Coinbase Verified Account** — `groupByAttestation` failed
   (maintenance page). Get this from our own log index; it is the real denominator.
6. **Is `eas-sdk-v2` the successor to `eas-sdk`?** Last push 2025-10-15, 6★. Ask in the EAS
   Telegram before choosing an SDK.
7. **Do we want a resolver at all?** It buys attester-restriction + auto-indexing + uniqueness
   enforcement, but it is permanently baked into the schema UID. Decide before registering anything.
8. **Off-chain verification burden for smart-contract consumers.** If a meaningful share of our
   customers are contracts, off-chain-first forces each of them to write EIP-712 recovery. Do we
   ship a canonical verifier library (Coinbase-style `forge install`) to remove that?
9. **Which chain(s)?** Base has the identity gravity and OnchainKit distribution; OP has predeploy
   parity. Multi-chain means the same schema string with different resolver addresses → **different
   UIDs per chain**, which integrators will get wrong. Consider a resolver-free schema (identical
   UID everywhere) and enforce attester-checking in a library instead. Trade-off worth a decision
   record.

---

# Recommendation: where should our aggregate humanity assertion live?

**Both, layered — with off-chain as the default and on-chain strictly opt-in.**

### Primary: EAS **off-chain** attestation (EIP-712, v2 with `salt`)

This should be what the aggregator returns by default.

- **Zero gas**, zero chain choice, instant, works before the user has any on-chain footprint.
- **No permanent public linkage** — the single biggest risk in this whole design is avoided.
- **Portable**: it's a signed blob the user holds; we don't custody it.
- Verifiable in JS via `eas-sdk`'s `verifyOffchainAttestationSignature()`, and by anyone who knows
  our signer key — **no vendor cooperation required, including ours.**
- Revocation via `revokeOffchain(bytes32)` on a cheap L2 if we ever need hard revocation; otherwise
  short `expirationTime` + reissue.
- Cost of the format choice is essentially zero: it's EIP-712 typed data, the most widely supported
  signing format in the ecosystem.

### Secondary: EAS **on-chain** attestation on **Base**, opt-in per user

- Needed only when the consumer is a **smart contract** (airdrop gate, governance, lending) and
  can't call an API.
- Publish on **Base**: 3.57M attestations, Coinbase Verifications gravity, OnchainKit's
  `getAttestations` already in wallets. OP Mainnet as the second target (same predeploy addresses,
  so one code path).
- Copy the Coinbase architecture: a **resolver** that allowlists our attester, an **indexer**
  contract giving `(recipient, schemaUID) -> uid`, and a small **Foundry-installable verifier
  library** so integrators write three lines, not thirty.
- Publish **only the scalar** (e.g. `uint8 humanityScore, uint64 issuedAt`) — never the evidence set,
  never the country, never source protocol names.
- Gate it behind explicit consent that says: *permanent, public, and links this address forever.*

### Tertiary: W3C VC — **on demand only, and issue it ourselves**

- Emit a plain **VC-JWT** signed by our key when an enterprise/EU-flavoured customer requires the
  format. This costs us a few hundred lines, not an integration.
- Use `did:pkh` or `did:web` — **never** a DID method whose resolution depends on someone else's
  live infrastructure. Disco's `did:3` is the cautionary tale: its DIDs are effectively unresolvable
  today, and its `disco.xyz` context URLs now point at a spam domain owned by strangers.
- **Do not integrate Disco.** It has no API, no docs, no DNS, and no team.

### Trade-off table

| | Off-chain EAS | On-chain EAS (Base) | W3C VC |
|---|---|---|---|
| Cost per user | **$0** | ~$0.001–0.01 (L2); $ dollars on L1 | $0 |
| Smart-contract readable | ✗ (integrator writes `ecrecover`) | **✓ `getAttestation()`** | ✗ |
| Privacy / linkage | **✓ nothing published** | ✗ **permanent public linkage** | ✓ |
| Portability | ✓ user holds blob | ✓ but chain-bound | ✓ |
| Revocation | needs on-chain `revokeOffchain` or expiry | **✓ native, instant** | status-list infra we'd run |
| Availability if we die | ✓ if user kept the blob + our pubkey is anchored | ✓ forever on L1; on Base/OP contingent on the chain's `ProxyAdmin` | ✓ if DID method is self-contained |
| Ecosystem distribution | low | **high (OnchainKit, Base)** | enterprise / EU eIDAS-adjacent |
| Vendor lock-in | none | none (immutable contracts) | none if `did:pkh`/`did:web` |

**One-line answer:** publish as an **EAS off-chain attestation by default, an EAS on-chain
attestation on Base by explicit user opt-in, and a self-issued VC-JWT only when contractually
required** — and treat the on-chain path as a privacy liability to be minimised, not a feature to be
maximised.

# References

**EAS — primary**
- `eas-contracts` repo (MIT, 318★, last commit 2026-07-16): https://github.com/ethereum-attestation-service/eas-contracts
- Deployment addresses: https://github.com/ethereum-attestation-service/eas-contracts#deployments
- `IEAS.sol`: https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/IEAS.sol
- `Common.sol` (`Attestation` struct): https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/Common.sol
- `ISchemaRegistry.sol`: https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/ISchemaRegistry.sol
- `SchemaRegistry.sol` (`_getUID`): https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/SchemaRegistry.sol
- `ISchemaResolver.sol`: https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/resolver/ISchemaResolver.sol
- Example resolvers: https://github.com/ethereum-attestation-service/eas-contracts/tree/master/contracts/resolver/examples
- `eas-sdk` (TS, MIT, 140★, last commit 2026-05-29, v2.9.1): https://github.com/ethereum-attestation-service/eas-sdk
- Off-chain EIP-712 types: https://github.com/ethereum-attestation-service/eas-sdk/blob/master/src/offchain/offchain.ts
- `eas-indexing-service`: https://github.com/ethereum-attestation-service/eas-indexing-service
- Docs — on-chain vs off-chain: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/core--concepts/onchain-vs-offchain.md
- Docs — privacy: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/core--concepts/privacy.md
- Docs — credible neutrality: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/core--concepts/credible-neutrality.md
- Docs — FAQ (tokenless, funding, Spearbit audit): https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/quick--start/faqs.md
- Docs — gas efficiency: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/tutorials/gas-efficiency.md
- Docs — private data attestations: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/tutorials/private-data-attestations.md
- Docs — GraphQL API + endpoints: https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/developer-tools/api.md
- Live GraphQL queried 2026-07-24: `https://base.easscan.org/graphql`, `https://optimism.easscan.org/graphql`, `https://easscan.org/graphql`

**Coinbase Verifications — primary**
- https://github.com/coinbase/verifications (contracts, schema UIDs, legal disclaimer)
- Base OnchainKit `getAttestations`: https://docs.base.org/onchainkit/identity/get-attestations
- Coinbase onchain verification help page: https://help.coinbase.com/en/coinbase/getting-started/verify-my-account/onchain-verification

**Optimism — secondary**
- https://www.optimism.io/blog/building-a-decentralized-identity-ecosystem-together
- CoinDesk 2023-05-04 (secondary/news): https://www.coindesk.com/tech/2023/05/04/layer-2-network-optimism-to-use-ethereum-attestation-service-to-promote-user-trust
- `community.optimism.io/identity/about-attestations` → **301 to `docs.optimism.io/governance`** (2026-07-24)
- `docs.optimism.io/chain/identity/schemas` → **404** (2026-07-24)

**Disco.xyz**
- Merger announcement, 2024-09-19 (primary, Privado ID): https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems
- GitHub org (last push 2024-04-30): https://github.com/discoxyz
- `disco-schemas`: https://github.com/discoxyz/disco-schemas
- Wayback captures of `disco.xyz`: 2025-04-23 ("Disco (now privado.id)"), 2025-07-16 (parked), 2025-10-04 (re-registered), 2025-12-11→2026-05-11 (SEO spam)
- DNS checks 2026-07-24: `docs/api/app/issuer.disco.xyz` all NXDOMAIN
- Billions Network (secondary, marketing): https://billions.network/

