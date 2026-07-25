# Human Passport, read from the chain — mechanism, addresses, and what the stamps give away

*Field work done 2026-07-25 against the live deployments and against passportxyz's own source. Every
number below came from a call made on this box or from a file fetched from their repository; nothing
here is carried over from a document. It supersedes nothing in
`passport-civic-fractal-zkme-galxe.md` — it closes that file's open question 3 ("what fraction of
Passport users minted on chain, and how stale are those attestations") as far as public endpoints
allow, and turns its `Decoder.getScore` note into an implemented probe.*

Probe: `packages/sdk/src/adapters/human-passport.ts`.
Tests: `packages/sdk/src/adapters/human-passport.live.test.ts`.

---

## 1. The read we actually make, and why it is not `getScore`

`GitcoinPassportDecoder.getScore(user)` is revert-driven. Source (GPL,
`passportxyz/eas-proxy`, `contracts/GitcoinPassportDecoder.sol`, fetched 2026-07-25):

```solidity
function getScore(address user) public view returns (uint256) {
  IGitcoinResolver.CachedScore memory cachedScore = gitcoinResolver.getCachedScore(user);
  if (cachedScore.time == 0) { revert AttestationNotFound(); }
  _checkExpiration(cachedScore);          // reverts AttestationExpired(expirationTime)
  return cachedScore.score;
}
```

Both selectors were confirmed against live reverts on Optimism rather than computed and assumed:

| Error | Selector | Fires when |
|---|---|---|
| `AttestationNotFound()` | `0x120a2e77` | `cachedScore.time == 0` — no passport minted on this chain |
| `AttestationExpired(uint64)` | `0x06c09405` | the cached score has aged out; the payload is the expiry |

We call **`GitcoinResolver.getCachedScore(user)`** instead, which is the same struct the Decoder
consults, and is what `getScore` throws information away from:

```solidity
struct CachedScore { uint32 score; uint64 time; uint64 expirationTime; }
```

`time` is the issuance date. `getScore` discards it, and the issuance date is precisely what our
decay curve needs — so taking the ergonomic revert-driven path would have cost us the age of every
credential we read for no gain at all. The resolver is one extra hop and returns strictly more.

**We never hard-code the resolver.** Each Decoder is asked which resolver it trusts
(`gitcoinResolver()`), cached per process. It is one call, it cannot drift, and an upgrade on their
side cannot leave us reading a resolver the Decoder has stopped believing. The values it returned on
2026-07-25, recorded for reference and *not* used as inputs:

| Chain | Decoder (docs.passport.human.tech) | Resolver, as named by that Decoder |
|---|---|---|
| Optimism | `0x5558D441779Eca04A329BcD6b47830D2C6607769` | `0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC` |
| Base | `0xaa24a127d10C68C8F9Ac06199AA606953cD82eE7` | `0x90E2C4472Df225e8D31f44725B75FFaA244d5D33` |
| Arbitrum | `0x2050256A91cbABD7C42465aA0d5325115C1dEB43` | `0x90E2C4472Df225e8D31f44725B75FFaA244d5D33` |
| Linea | `0x423cd60ab053F1b63D6F78c8c0c63e20F009d669` | `0x0a774AECE542a1A819107Eb3a06E9D515C67257a` |
| Scroll | `0x8A5820030188346cC9532a1dD9FD2EF8d8F464de` | `0x90E2C4472Df225e8D31f44725B75FFaA244d5D33` |
| Shape | `0x2443D22Db6d25D141A1138D80724e3Eee54FD4C2` | `0x90E2C4472Df225e8D31f44725B75FFaA244d5D33` |
| zkSync Era | `0x1166FCDCA3B04311Ba9E2eD5ad2c660E730e1386` | `0x8789129C5968EdcA5Cb392C4a9A9D7EFB590A838` |

All seven hold code and answered on 2026-07-25 over public endpoints with no API key.

## 2. Expiry is real, uniform, and ninety days

`maxScoreAge()` returns **7,776,000 seconds — 90 days — on all seven deployments**, and
`threshold()` returns **200000**, i.e. 20.0000 on the four-decimal scale, which is the "Passport
20+" convention appearing as an on-chain constant.

Expiry is `expirationTime` when non-zero, else `time + maxScoreAge`. That derivation is checkable
from two independent directions and the live test re-derives it every run rather than asserting a
constant. For `0xb0812e0006470fE99F71165fC7C1A2312F7b90F2` on Optimism:

```
getCachedScore → { score: 500150, time: 1740958699, expirationTime: 0 }
1740958699 + 7776000 = 1748734699
getScore     → revert 0x06c09405 0000…683b92eb   →   AttestationExpired(1748734699)
```

Same number, Solidity's arithmetic and ours. **This makes a Passport score a hard-expiring
credential**, which the ontology did not previously record: the adapter's 180-day half-life can only
ever apply over the first 90 days of a passport's life, because on day 90 the issuing contract stops
answering for it. Our probe returns `held: false` with `reason: "score-expired"` at exactly the
instant the Decoder does.

## 3. One chain is the wrong number of chains

A passport is minted per chain, the mints are independent, and they disagree. Same subject,
same instant:

| Chain | Score | Issued | Expired by our derivation |
|---|---|---|---|
| Optimism | 50.015 | 2025-03-02 | 2025-05-31 |
| Linea | 50.015 | 2025-03-02 | 2025-05-31 |
| Scroll | 25.099 | 2024-07-18 | 2024-10-16 |
| Base, Arbitrum, Shape, zkSync Era | — no attestation ever — | | |

Reading one chain would have reported the wrong score on two of the three chains this subject
exists on, and nothing at all for a subject who minted only on Scroll. The probe reads all seven in
parallel and takes the most recently issued unexpired score — the freshest evidence, and the one the
subject most recently paid to publish. Four subjects across seven chains resolved in 1.1 s warm.

A chain that does not answer is dropped and **named** in `detail.chainsUnreadable`; only if every
deployment fails do we return an `error`. An RPC outage must not read as "this address has no wallet
history".

## 4. On-chain minting is alive — measured, not assumed

`passport-civic-fractal-zkme-galxe.md` left open whether the free on-chain read is worth anything.
Partial answer, from EAS `Attested` logs on Optimism (EAS `0x4200…0021`, score schema
`0x6ab5d342…e9c89`, score-v2 schema `0xda025775…747254`, both read from the Decoder's own
`scoreSchemaUID()` / `scoreV2SchemaUID()`):

- Score-v2 attestations landed at Optimism blocks **154,646,860** and **154,643,503** against a head
  of ~154,689,600 — i.e. **within the last day**. Minting is current, not a 2023 artefact.
- Sampling ten-thousand-block windows every two million blocks back to block 95,000,000 found the
  legacy score schema clustered around blocks 130–132 M and nothing in the windows nearer head, which
  is consistent with the legacy path having been superseded by score-v2 rather than with minting
  having stopped.
- **Not measured:** total minted population, and the same question on Base, Linea and Scroll. The
  free public endpoints for those chains refuse historical `eth_getLogs` without a key, and paying
  for an archive endpoint to answer a population question would put a vendor on a path we keep
  vendor-free. The live test therefore sources its positive-path subject from a recent log window
  rather than depending on any fixed address.

## 5. The finding that matters: the passport is mostly other people's credentials

`Decoder.getPassport(user)` returns the stamp list. Two live subjects, read 2026-07-25:

| Subject | Score | Stamps |
|---|---|---|
| `0x46760723cf94ebd77Adae95BE06fE455ccd0Df74` | 28.847 | `Steam`, `BinanceBABT2`, `HolonymGovIdProvider` |
| `0xA6b7471fe0338F8B45266734A1346E6f1D7267b1` | 22.027 | `HolonymGovIdProvider`, `Biometrics` |

The second subject's passport is **entirely** Holonym: a government-ID check and a FaceTec
biometric, both of which this ontology already prices, under `kyc-vendor:unattributed` and
`kyc-vendor:facetec` respectively. Its "22.027" is not a twenty-two-point independent signal; it is
two credentials we have entries for, re-scored by somebody else's weights.

This is the double-count the root model exists to prevent, and iteration 2's pricing decision
already defuses it: the passport is rooted at `behavioral:wallet-history` and priced at the
farmed-wallet market — 100 cents rent — so even a passport made entirely of restated identity stamps
cannot contribute identity money. What the probe adds is that the collapse is now **visible**. Each
stamp is mapped to the ontology adapter that owns it, and the result carries
`aggregate-restates-other-credentials` naming the adapters and their roots, resolved from the
deployed registry rather than from a table in the SDK.

That is the product thesis demonstrated on one address rather than asserted in a pitch: a score of
22 collapses to two roots we already knew about, plus a dollar of wallet history.

### The stamp map

Only stamps that restate a credential *with its own ontology entry* are mapped. The rest — social
accounts, staking tiers, NFT and gas heuristics, `Steam`, `ZKEmail` — are the wallet-history and
social signal the passport legitimately contributes under its own root.

| Stamp | Ontology adapter | Root |
|---|---|---|
| `Coinbase`, `CoinbaseDualVerification`, `CoinbaseDualVerification2` | `coinbase-verification` | `kyc-vendor:persona` |
| `HolonymGovIdProvider`, `CleanHands` | `holonym-gov-id` | `kyc-vendor:unattributed` |
| `Biometrics` | `holonym-biometrics` | `kyc-vendor:facetec` |
| `CivicCaptchaPass`, `CivicUniquenessPass`, `CivicLivenessPass` | `civic-pass` | `kyc-vendor:facetec` |
| `Brightid` | `brightid` | `social-vouching:brightid` |
| `Poh` | `poh-v1` | `social-vouching:poh` |
| `IdenaState#*`, `IdenaStake#*`, `IdenaAge#*` | `idena` | `ceremony:idena` |
| `TrustaLabs` | `trusta-sybil` | `behavioral:wallet-history` |

Provider names are verified, not guessed: they come from the Decoder's own on-chain provider array
and from the per-platform `Providers-config.ts` files in `passportxyz/passport` (fetched
2026-07-25). Two attributions worth stating explicitly:

- **`Biometrics`** is `id.human.tech/biometrics` — Human ID's FaceTec 3D liveness with a dedup step
  before enrolment. Same credential as our `holonym-biometrics`, hence the FaceTec root.
- **`CleanHands`** is Holonym's sanctions/PEP screen, and its own guide describes it as "verify your
  government ID and complete liveness check". It restates the same document check as
  `HolonymGovIdProvider` rather than earning a root of its own.

**`BinanceBABT` and `BinanceBABT2` are deliberately unmapped.** BABT is a real credential and
Passport weights it like a government ID, but it still has no vendor attribution in our research and
therefore no defensible root — and an invented root scores as full independence, which is the
direction that pays an adversary. It is left visible in `detail.stamps` and absent from
`restatesAdapters`. This is the single highest-value piece of remaining research debt on this
protocol: `0x46760723…Df74`'s passport above is one third BABT.

### Two vocabularies, one of which is on chain

`getProviders(currentVersion())` returns **102 provider names** on Optimism (`currentVersion()` is
0). That array is the index for the legacy bitmap-packed passport attestation, so every legacy stamp
name is verifiable against the contract — and the live test holds every mapped legacy name to it, so
an upstream rename fails loudly instead of silently dropping a correlation.

The newer score-v2 attestation carries provider strings inline and those names never enter the
on-chain array; `Biometrics` and `Steam` coming back from a live `getPassport` while being absent
from the 102 is the proof. `Biometrics` and `CleanHands` are the two mapped names that live only in
the v2 vocabulary, and they are listed as such in the adapter so the test's exemption is explicit
rather than a blanket escape hatch.

## 6. What we still refuse to import

Passport's scalar is an aggregate over its own stamps with its own weights, and `ETHScore#50` — a
pure wallet-history model — is weighted the same as a government ID. We report the score and
`meetsPassportThreshold` (read from `threshold()`, not hard-coded) so a caller can see what Passport
concluded, and nothing in our result scales with either. Adopting the number would be adopting the
weighting; adopting the threshold would be adopting the policy. Both are theirs to change.
