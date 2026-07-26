# Human Passport — who is allowed to write a passport

**Written 2026-07-25** against the live deployments on Optimism, Base, Arbitrum, Linea, Scroll,
Shape and zkSync Era. Every number below was read the day it was written; the calls are named so
they can be re-run.

Closes open question 1 of
[passport-and-linea-lapsed-credentials.md](passport-and-linea-lapsed-credentials.md) §6.

---

## 0. The question

Our Passport probe reads one thing: `GitcoinResolver.getCachedScore(subject)`. Everything else —
`held`, the issuance date, the lapsed window an as-of score restores from — is derived from that
struct. Which means the adapter's entire authority model is a single sentence nobody had checked:

> a cached score is Passport's, or it is nobody's.

That sentence is either a fact about the resolver's access control or it is an assumption. It was
an assumption. It is now three `eth_call`s, and the answer turns out to be *yes, on two separate
grounds*, both of which the resolver publishes so that we never have to hard-code either.

This is the same question asked of Holonym in iteration 5 (`Hub.sol`'s own comment: *"Someone can
forge a proof if you don't check the public values, e.g., by using a different issuer"*) and of
Linea PoH in iteration 6 (where the answer was that `attester` records a relayer and the real
anchor is the portal owner). The Passport answer is the strongest of the three, and it is the
only one where the protocol enforces the check itself and merely lets us confirm it.

---

## 1. The source, and why it is the deployed source

`GitcoinResolver` at `0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC` on Optimism is an ERC-1967
proxy: 708 bytes of code, EIP-1967 implementation slot
(`0x360894a1…382bbc`) = **`0x2999Ef5C943b1f7085C299EFD30556DAf48879dC`**, admin slot zero (it is
UUPS, so upgrade authority is `onlyOwner` on the implementation, not a separate admin).

Rather than trust a repository to describe a deployment, the implementation's bytecode was
scanned for `PUSH4` and every one of its **34** selectors identified against
`passportxyz/eas-proxy@main`'s `GitcoinResolver.sol`:

| selector | function |
|---|---|
| `0x0d2a3c0f` | `getCachedScore(address)` |
| `0xd7c7378b` | `getCachedScore(uint32,address)` |
| `0xd757e575` | `userAttestations(address,bytes32)` |
| `0x79300e56` | `getUserAttestation(address,bytes32)` |
| `0x76dd110f` | `scores(address)` |
| `0x0583343d` | `communityScores(uint32,address)` |
| `0x1e8c8c07` | `communityScoreAttestations(uint32,address)` |
| `0x30f97eea` | `_eas()` |
| `0x8c0a485c` | `_gitcoinAttester()` |
| `0xa7cd52cb` | `allowlist(address)` |
| `0xf8e86ece` / `0x5da93d7e` | `addToAllowlist` / `removeFromAllowlist` |
| `0xb6b1a9b7` / `0x9a44279e` | `scoreSchema()` / `scoreV2Schema()` |
| `0xc927ee37` / `0x3dbc8938` | `setScoreSchema` / `setScoreV2Schema` |
| `0x19aa9f1d` / `0xf37747f8` | `defaultCommunityId()` / `setDefaultCommunityId` |
| `0xe60c3505` / `0x91db0b7e` | `attest` / `multiAttest` |
| `0xe49617e1` / `0x88e5b2d9` | `revoke` / `multiRevoke` |
| `0xce46e046` | `isPayable()` |
| `0x485cc955` | `initialize(address,address)` |
| OZ standard | `owner`, `transferOwnership`, `renounceOwnership`, `pause`, `unpause`, `paused`, `upgradeTo`, `upgradeToAndCall`, `proxiableUUID` |

**Zero unattributed selectors.** The deployed implementation is that source, not a cousin of it.

Note what is *absent*: there is no `onAttest`. This resolver implements the older
`ISchemaResolver` shape, `attest(Attestation)`, which is why the open question phrased in terms
of `onAttest` had no answer to look up.

The two gates are four lines:

```solidity
modifier onlyAllowlisted() { if (!allowlist[msg.sender]) revert NotAllowlisted(); _; }

function attest(Attestation calldata a) external payable whenNotPaused onlyAllowlisted returns (bool) {
  return _attest(a);
}
function _attest(Attestation calldata a) internal returns (bool) {
  if (a.attester != address(_gitcoinAttester)) revert InvalidAttester();
  …
}
```

---

## 2. The experiment

A gate you have not moved is a gate you have not seen. Iteration 20's Circles getter answered
truthfully about the wrong subject and never errored once; the lesson was to vary the argument
and require the answer to move. So each axis is varied on its own, everything else held at what a
genuine write looks like — a well-formed legacy score attestation for 100.0000 in the default
community, recipient `0x…dEaD`.

`eth_call` to `0xc94aBf02…BBbDC`, Optimism, head, 2026-07-25:

| `from` | `attester` in the struct | result |
|---|---|---|
| `0x…DeaDBeef` (a stranger) | `0x843829986e895facd330486a61Ebee9E1f1adB1a` | revert **`0x06fb10a9`** = `NotAllowlisted()` |
| `0x4200…0021` (the EAS the resolver names) | `0x…DeaDBeef` | revert **`0xb8daf542`** = `InvalidAttester()` |
| `0x4200…0021` | `0x843829986e…dB1a` | **`0x…01`** — accepted |

The third row is the control and it is not optional: without it the first two prove only that the
contract reverts, which a contract that reverts unconditionally also does. With it, the pair of
reverts means the gate discriminates on exactly the two things it claims to.

Both selectors were derived from the source (`keccak("NotAllowlisted()")[0:4]`,
`keccak("InvalidAttester()")[0:4]`) and matched what the chain returned, which is the same
argument in the other direction: the reverts are the ones this source produces.

### What that leaves

`attester` on an EAS attestation is the `msg.sender` of the `attest` call EAS received, so an
attestation carrying `0x84382998…dB1a` really did come through `GitcoinAttester`, whose
`submitAttestations` in turn requires `verifiers[msg.sender]`. The chain of authority is:

```
scores[subject]  ←  GitcoinResolver.attest   (caller must be allowlisted)
                 ←  EAS.attest               (sets attester = msg.sender)
                 ←  GitcoinAttester          (caller must be in verifiers[])
                 ←  Passport's issuer key
```

Nothing a third party controls appears anywhere on it.

---

## 3. What the probe now does

Per chain, once, cached: ask the **resolver** for `_gitcoinAttester()`, `_eas()`, `scoreSchema()`
and `scoreV2Schema()`. Per subject, on the one chain whose reading is actually used: read
`userAttestations(subject, schema)` for each schema, then the EAS record behind each non-zero
uid, and require it to be un-revoked, to still name this subject as `recipient`, and to carry
that attester.

**Nothing is hard-coded, and that is not stylistic.** There are *five distinct attesters across
the seven deployments*, and three distinct EAS instances:

| chain | resolver | EAS | attester |
|---|---|---|---|
| optimism | `0xc94aBf02…BBbDC` | `0x4200…0021` | `0x84382998…dB1a` |
| base | `0x90E2C447…5D33` | `0x4200…0021` | `0xCc90105D…F422` |
| arbitrum | `0x90E2C447…5D33` | `0xbD75f629…c458` | `0x7848a357…0475` |
| linea | `0x0a774AEC…257a` | `0xaEF4103A…2B2a` | `0xBC778313…10A2` |
| scroll | `0x90E2C447…5D33` | `0xC4730042…E6B0` | `0xCc90105D…F422` |
| shape | `0x90E2C447…5D33` | `0x4200…0021` | `0xCc90105D…F422` |
| zksyncEra | `0x8789129C…A838` | `0x21d8d4eE…2901` | `0x2B5D97CB…83cC` |

A table of seven attester constants in our source would have been seven chances to be wrong about
somebody's identity, and it would have gone stale silently. Asking the resolver is one call, it
cannot drift, and it is the same discipline that already keeps the *resolver* address out of our
code (`Decoder.gitcoinResolver()`).

`allowlist(eas)` is `true` on all seven, checked.

### Which record to judge

Passport files a uid per schema and mints under two of them, so a subject who moved from the
legacy score to score-v2 has two uids on file and only one describes the struct we read. The
resolver copies `attestation.time` verbatim into the cached struct, so **`time` is the
discriminator**: the record behind *this* score is the one whose `time` is the score's. Judging
the wrong one would reject a real passport.

Confirmed end to end on `0xb0812e0006470fE99F71165fC7C1A2312F7b90F2`:

```
getCachedScore   → (500150, 1740958699, 0)
userAttestations(subject, 0x6ab5d342…e9c89)  → 0x29896d05…4b31
userAttestations(subject, 0xda025775…7254)   → 0x00…00        (never minted under v2)
EAS.getAttestation(0x29896d05…4b31)
   time 1740958699   ← identical to the cached struct
   revocationTime 0
   recipient 0xb0812e00…90F2
   attester  0x843829986e895facd330486a61Ebee9E1f1adB1a   ← == _gitcoinAttester()
```

### The three outcomes, and why they are not two

| verdict | meaning | effect |
|---|---|---|
| `verified` | an un-revoked record by the resolver's attester, naming this subject, at this instant | credential stands, `detail.attestation` names the uid |
| `rejected` | a record exists and says something incompatible | **`held: false`**, both keys named; the chain is dropped and the choice made again over the rest |
| `unchecked` | we could not corroborate — nothing contradicts it | credential stands, note `issuer-check-unavailable` → caveat `credential-issuer-unverified` |

The asymmetry is the rule at the top of `adapters/index.ts` applied one level up. A network
failure that removed a credential would mean an RPC blip decided somebody is not a person, which
is the same defect in the same direction as a failed presence read returning `held: false`. A
*contradiction*, by contrast, is a statement the chain made, and it is treated as one.

`unchecked` has one ordinary, innocent cause worth naming: Passport rotating a schema after a
write leaves the old uid filed under a key we no longer ask about. That is a fact about our
lookup, not about the subject.

### What is refused

- **Rejecting on a rotated attester.** Considered and kept as a rejection anyway. There is no
  setter for `_gitcoinAttester` in this implementation — it is written once in `initialize` — so a
  rotation requires an upgrade, and an upgrade is a thing that should make our suite go red rather
  than something we absorb quietly. The live suite reads the attester independently of the probe
  and requires the two to agree, so we will hear about it.
- **Verifying all seven chains.** Only the reading that reaches a score is checked. The other six
  are disclosure in `detail.perChain` and are marked as such. Checking them would be four more
  `eth_call`s per chain to corroborate numbers that nothing consumes.
- **Reading `getUserAttestation` instead of `userAttestations`.** Same mapping, same answer; the
  public mapping getter is what the live suite and the probe both use so there is one call site.

---

## 4. The residual, stated

**This pin excludes third parties. It does not exclude Passport.** The resolver is UUPS-upgradeable
by its owner, and that owner can also `addToAllowlist(anyone)`, after which that address can hand
`_attest` a fabricated struct — subject to the `attester` check, which the owner can defeat by
upgrading. So the honest claim is: *no one outside Passport can put a score in this mapping*, which
is the whole of what an issuer pin can ever mean for a hosted credential. The trust root in the
ontology says the same thing (`behavioral:wallet-history`, one dollar), and it is priced for it.

Two smaller residuals:

- The **score value** in the cached struct is still Passport's arithmetic, not something we
  re-derive from the attestation payload. Nothing consumes it — the adapter is deliberately
  weighted by root and not by score — so this is disclosure that could be wrong, not weight.
- `allowlist` is a mapping with no event, so it **cannot be enumerated**. We can confirm EAS is on
  it; we cannot confirm nobody else is. This is exactly why the per-subject EAS cross-check is
  worth its calls: a rogue allowlisted writer can fabricate `scores[]`, but to survive the check
  it would need a real EAS attestation by `GitcoinAttester` naming the subject at the very second
  it claimed — that is, a genuine passport.

---

## 5. Cost

Four extra `eth_call`s per chain at cold start (`_gitcoinAttester`, `_eas`, and the two schemas),
cached for the life of the adapter, plus at most four per probe on the single chain being used
(two `userAttestations`, up to two `getAttestation`). Measured on one subject across all seven
deployments, three consecutive probes on the same adapter instance:

| | cold | warm | warm |
|---|---|---|---|
| before | 407 ms | 165 ms | 156 ms |
| after | 865 ms | 255 ms | 374 ms |

Roughly 100–200 ms of warm latency for a per-subject authority check, on a probe that already
fans out to seven chains. That is the price, and it is worth writing down rather than rounding to
"negligible": it is the largest single cost this adapter has taken on, and it buys the difference
between reading a mapping and knowing who may write to it.

---

## 6. Open questions

1. **Who owns each resolver, and is it the same key on all seven?** `owner()` is a public getter
   and was not read. It bounds the residual in §4 precisely — a multisig and an EOA are very
   different answers to "can Passport unilaterally write a score for anybody".
2. **Is `GitcoinAttester.verifiers` a single key?** Also a public mapping with no enumeration, and
   the same unanswerable-by-enumeration shape. The known verifier is whatever address the current
   issuance path uses; observing one write end to end would name it.
3. **Do the `communityScores` mappings carry populations we are ignoring?** `getCachedScore(user)`
   reads only the default community, and on Shape `defaultCommunityId` is **335** rather than 0 —
   the one deployment where a non-default community exists. A subject scored under a different
   community on Shape is invisible to us and to the Decoder alike, so this is a question about
   coverage, not correctness.
