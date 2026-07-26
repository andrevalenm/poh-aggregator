# Holonym / Human ID — the Hub verifies a signature, not a proof

**Researched 2026-07-26.** Sources: the verified source of `Hub`
`0x2AA822e264F8cc31A2b9C22f39e5551241e94DfB` on OP Mainnet, fetched from
`optimism.blockscout.com/api/v2/smart-contracts/…` (`is_fully_verified: true`, `proxy_type: null`,
solc `0.8.9+commit.e5eed63a`, verified 2024-06-10, 19 OpenZeppelin sources alongside
`contracts/Hub.sol`); the verified source of `HubBatch`
`0xef59aC90646fc09690ed4144741f3A884282ee77`, the relayer every mint arrives through today; and
storage, calldata, logs and signature recovery read live against `mainnet.optimism.io`,
`optimism.drpc.org` and `gateway.tenderly.co/public/optimism` on 2026-07-26 at head 154,714,331.

Answers open question 1 of [world-verification-term-timeline.md](world-verification-term-timeline.md),
which asked whether Holonym's one-year ceiling — the third mechanism in the term audit — can move.
It asked the question the wrong way round. The ceiling is not a contract field that an owner
transaction could change; it is not on the contract at all.

Extends [holonym-human-id-onchain-read.md](holonym-human-id-onchain-read.md), whose §4 this file
corrects.

---

## 1. What the previous write-up claimed, and what is actually there

§4 of the read write-up says the date rests on "a lower bound on issuance, **enforced by a proof the
Hub verified before minting**", and the caveat the SDK printed said the date is "the expiry minus
the longest term the protocol's **circuit** permits". Both sentences put the constraint on chain.

Here is the whole of what `Hub.setSBT` checks:

```solidity
// contracts/Hub.sol, L71-85 of the verified source
bool success = keccak256(
    abi.encodePacked(
        circuitId, sbtReciever, expiration, customFee, nullifier, publicValues,
        block.chainid   // prevents replay of the same proof on another chain
    )
)
.toEthSignedMessageHash()
.recover(signature) == verifier;
require(success, "The Verifier did not sign the provided arguments in the provided order");
```

`ecrecover`, against one stored address. There is no verifier contract, no pairing check, no
proving key bound to a circuit id anywhere on chain. `circuitId` is an opaque `bytes32` the signer
chooses; `publicValues` is an array the signer chooses; the expiry is a number the signer chooses.
The contract's own header says exactly this, in its second line:

> *This contract accepts a signed attestation from a certain Verifier that a ZKP has been recieved.
> The attestation SHOULD be verifiable with offchain methods*

So the ZK proof is real — Holonym's circuits are published and their verifier service checks them —
but it is checked **off chain, before signing**, and the chain records only that the key signed.

**This does not mean the credential should stop being counted, and it does not make the date worse
than the credential.** The same signature is the only thing standing behind held-or-not, and behind
`publicValues[4]`, the issuer we pin — that value is data the signer supplied too. Everything this
package says about a Holonym credential rests on one key. The ceiling rests on the same key and no
more. What was wrong was the *description*: we were telling people a constraint had been verified by
a contract, and the honest sentence is that an issuing service checks it and signs.

The read write-up also over-claimed in a second, smaller way. It says `getSBT` "reverts for expired,
revoked and never-existed alike" — true — and treats a stored expiry as necessarily in the future at
mint. It is not: `setSBT` never compares `expiration` to `block.timestamp`, and **one of the 76
mints sampled below was already expired when it was minted**, by 6.5 days. Nothing downstream breaks
(the probe reads `expiry < now` as expired, which it is) but it is another place where the contract
does less than it was assumed to.

---

## 2. Which key, established four ways

`verifier` is declared with no visibility keyword, so it is `internal` and there is no getter:
`verifier()` (`0x2b7ac3f3`) and `getVerifier()` (`0x46657fe9`) both revert. The only way to read it
is storage.

In the linearisation `Hub is Ownable, ERC721URIStorage` the slots are `_owner` (0), `_name` (1),
`_symbol` (2), `_owners` (3), `_balances` (4), `_tokenApprovals` (5), `_operatorApprovals` (6),
`_tokenURIs` (7), then the Hub's own `verifier` (8) and `_tokenIds` (9). Counting slots off a source
file is the kind of derivation that is right until it is not, so all four checkable consequences
were checked, at head 154,714,331:

| Slot | Read | Cross-check |
|---|---|---|
| 0 | `0x…be20d0a27b79ba2e53c9df150badaa21d4783d42` | `owner()` returns the same address |
| 1 | `0x486f6c6f6e796d20563300…14` | decodes to `"Holonym V3"`, which is `name()` |
| 8 | `0x…656d1dfb96dbd7620de0e73fb16d2b169bb8da01` | see below |
| 9 | `0x3a479` = **238,713** | the token counter the live suite finds independently by bisecting `ownerOf` |

And slot 8 is the signer, proved the way that leaves nothing to a comment. Every mint in the last
150,000 blocks (76 of them, 2026-07-22 → 2026-07-26) was pulled out of the chain's own ERC-721
`Transfer(0x0 → holder)` logs, its transaction decoded, the Hub's digest rebuilt from the arguments,
and the signing address recovered:

```
signers: { 0x656D1dfb96dBd7620DE0e73FB16d2B169bb8Da01: 76 }
circuits: gov-id 39, biometrics 23, phone 14
nullifier == publicValues[3]: 76/76      stored expiry == publicValues[0]: 76/76
```

One key, every mint. This is now a live test, re-derived each run, and it is what turns "slot 8 is
the verifier" from a slot count into a fact.

Two details worth recording. The signing key `0x656D1dfb…Da01` has **nonce 0** — it has never sent
a transaction, it only signs; the relayer `0xB1f50c6C…56Fd` submits. And mints arrive through `HubBatch`
`0xef59aC90…ee77`, a verified batching contract that calls `setSBT` once per element, so a decoder
that only knew `setSBT` would find nothing at all in recent history. Both shapes are decoded.

---

## 3. What can move, and what publishes when it does

```solidity
address verifier;                                             // internal: no getter
function changeVerifier(address newVerifier) public onlyOwner() { verifier = newVerifier; }
```

No event, no timelock, no getter. A rotation of the one key the protocol's entire read surface
depends on leaves **no trace in any log**, so no indexer can see it — the storage slot is the only
record that it happened.

It matters to credentials that already exist, because the Hub never re-checks anything it has
stored. An SBT signed under a key that was later rotated out — because it leaked, say — reads as
valid for as long as its expiry allows, and our issuer pin cannot separate the two cases: the issuer
is a field that same signer supplied. So "has this registry ever accepted a different authority?" is
a live question about every Holonym credential in a score.

**The owner has already changed hands once.** Slot 0 held `0x51fEb8C5…D073` — the deployer — at
block 115,616,235 and holds `0xbe20d0A2…3D42` from block 115,616,238, six seconds later, with the
`OwnershipTransferred` log sitting in that block. That is an ordinary deployment hand-off rather
than a governance event, and it is useful for a different reason: it is the one slot in this
contract that has actually moved, so the code that *dates* a change has a real specimen to be tested
against instead of being a path that has never run.

---

## 4. The sweep: one signer, from the constructor to head

`eth_getCode` is `0x` at 115,616,234 and 17,166 bytes at 115,616,235, and slot 8 goes from zero to
`0x656D1dfb…Da01` across the same boundary — so the deployment block is established rather than
pinned, and the constructor's write is the first era's opening. Sampling slot 8 at 19 blocks spread
over the contract's whole life (115,616,235 → 154,714,275):

| Block | Date | Slot 8 |
|---|---|---|
| 115,616,234 | 2024-02-01 | `0x0000…0000` (no code yet) |
| 115,616,235 | 2024-02-01 | `0x656d1dfb…da01` |
| 16 evenly spaced samples | 2024-02 → 2026-07 | `0x656d1dfb…da01` |
| 154,714,275 | 2026-07-26 | `0x656d1dfb…da01` |

**The key has never moved across any block sampled.** So nothing at head changes because of this
work — the same outcome as the two term timelines before it, and the same point: an assumption
becomes a check without a score moving.

### The hole, which is bigger here than in the log sweeps

`poh-term.ts` and `world-term.ts` read *events*, so within a range they see every change that
happened. There is no event here. A sweep can only compare the value at the blocks it reads, which
means:

- a change that **stuck** is caught by any two samples that straddle it, and bisection then dates it
  to the exact block (25 calls over this range, validated against the owner slot, where the block it
  names holds the matching `OwnershipTransferred` log and the block before still holds the old
  value);
- a change that was made and **reverted between two samples** leaves precisely the trace that no
  change leaves, which is none. No sampling density fixes this; it is what "no event" means.

Closing it needs a trace-capable endpoint or an index of transactions to the Hub — both vendors, and
`adapters/index.ts` explains why that is not a trade this directory makes. So the caveat says only
what was checked: sampled, from the constructor to head, and unchanged across those samples.

The guards that make a *refusal* possible rather than a false reassurance, all in
`signerErasFromSamples` and unit-tested:

1. the oldest sample must be the deployment block — without the constructor's own block a sweep
   cannot say what the first era was;
2. the newest must be the head the caller passed;
3. every sample must have parsed as a bare address — a short or missing word is a failed read, never
   the zero address, which would otherwise look exactly like a key rotated to zero;
4. the deployment block's slot must be non-empty — the constructor sets `verifier` unconditionally,
   so zero there is a fact about our reading and not about the Hub;
5. `owner()` and `name()` must agree with slots 0 and 1 before any of it is believed.

A refused sweep costs a caveat (`attestation-authority-unverified`), never a date and never a
credential.

---

## 5. The ceiling, which the chain will not prove but will falsify

The date every Holonym credential gets is `expiry − 31,536,000`, from `V3.circom`:

```
component lt = LessThan(25);   lt.in[0] <== expiry - iat;   lt.in[1] <== 31536001;   lt.out === 1;
```

Since §1, that is a property of the circuit the issuing service runs, not of the Hub. Nothing on
chain enforces it and nothing publishes a change to it — a new circuit with a looser ceiling would
be a deployment on Holonym's side, invisible here. On a `Decay` curve the failure direction is the
bad one: a term longer than a year makes our derived issuance *later* than the truth, so the
credential looks fresher than it is.

The chain does offer a falsifier, and it needs no knowledge of the issuance date the protocol
deliberately hides. A credential exists before it is minted, so `iat ≤ mintTimestamp`, so

```
expiry − mintTimestamp   ≤   expiry − iat
```

and any mint whose `expiry − mintTimestamp` exceeds the ceiling **proves** the ceiling was exceeded.
Measured over the same 76 mints:

| | days |
|---|---|
| largest `expiry − mint` | **364.969** |
| smallest | −6.50 (minted already expired; see §1) |
| ceiling | 365.000 |

Nothing above it, and the largest observation is 45 minutes below it — which says the ceiling is not
a loose bound the issuer stays well inside but the operative constraint, so a change to it would show
up immediately in this measurement. That is now a live test over whatever mints the run finds, rather
than a number measured once into a document. What it cannot catch is a looser circuit combined with
a fuzzed expiry that still lands under 365 days from the mint; that residual is real and is why the
caveat now names the issuing service instead of the contract.

---

## 6. What changed in the code

| | |
|---|---|
| `src/adapters/holonym-signer.ts` | new: the layout checks, the sample plan, the sweep, the era builder and the refusals |
| `src/adapters/op-archive.ts` | new: the three keyless OP archive endpoints and the rotation, moved out of `farcaster.ts` because a second adapter now reads OP history |
| `src/adapters/holonym.ts` | header corrected (§1); the sweep memoised per process, asked for only when a subject holds something; `applySignerHistory` folds it into notes and detail |
| `src/reconcile.ts` | `attestation-authority-rotated`, `attestation-authority-unverified` |
| `src/scoring.ts` | a caveat for each, and the `issuance-date-derived-from-expiry` copy no longer says a circuit on chain enforced the ceiling |

**Cost, measured against the parent commit** — same held subject, both credentials, two processes
each:

| | before | after |
|---|---|---|
| subject holding a credential, cold | 174 ms | **534 ms** |
| the same subject, warm (memoised) | 132 ms | **141 ms** |
| subject with no Holonym credential | 56 ms | **56 ms** |

The sweep is eight storage reads plus four head reads for the layout, issued in batches of three
(one per endpoint), memoised on success only, and asked for **only when the subject actually holds a
credential** — which is almost nobody. A failed sweep is not cached, so a rate limit costs one
subject its check rather than every subject in the process.

---

## 7. What is deliberately not done

- **No score moves.** No weight, root, curve, half-life or cost changed: this decides what we *say*
  about a credential's authority, not what one is worth.
- **The date still uses the ceiling.** It is the most conservative reading available and it rests on
  exactly the key the credential itself rests on. Dropping it would leave a `Decay` credential
  undated, which scores it *higher*, not lower — the wrong direction for a trust concern.
- **The v2 store is still not read**, unchanged from the read write-up §6.
- **The mint block is not searched per subject.** It would make the ceiling checkable for one
  credential rather than for the corpus, and it costs ~21 archive calls against a bound that can only
  ever cost the subject weight. The live suite does it; the probe does not.

## 8. Open questions

1. **Can the owner slot be watched cheaply?** `OwnershipTransferred` is an event, unlike
   `changeVerifier`'s silence, so the *power* to rotate the key is indexable even though the
   rotation is not. Whether that is worth a second sweep depends on whether an owner change should
   caveat credentials at all — the argument for is that it is the only published signal that
   anything about this authority has moved.
2. ~~**Is the issuer key in `publicValues[4]` itself rotatable?**~~ **Answered 2026-07-26 in
   [holonym-issuer-pin.md](holonym-issuer-pin.md).** Yes, silently and at the protocol's discretion —
   and the timeline the tripwire was missing now exists: ten windows from the deployment block to
   head, every mint decoded from calldata, one issuer per circuit in every era. The larger finding
   was not about the key. A subject holding an SBT under an *unrecognised* issuer was refused with
   `held: false`, no note and no caveat, so a credential we threw away and a subject who had nothing
   were the same result — and if the key ever does rotate, that refusal is ours rather than the
   holder's.
3. **`HubBatch` is unowned and permissionless** — anyone may call `setSBTBatch` — which is harmless
   because the Hub checks the signature, and is worth stating because it means "minted through the
   relayer" carries no authority of its own.
