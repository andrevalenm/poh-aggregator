# Gitcoin Passport (Human Passport) — what the score attests, where it lives on chain, and why it cannot have its own trust root

*Field work done 2026-07-25 against the live Optimism and Arbitrum deployments and against
`passportxyz/eas-proxy` source. Every address, UID and payload below was read from a chain or a
primary repository on that date. This file is the credential-analysis companion to
`human-passport-onchain-read.md` (the resolver-cache read mechanism) and
`passport-civic-fractal-zkme-galxe.md` (the vendor landscape and the published stamp weights); it
adds the EAS-attestation read path — implemented in `packages/sdk/src/adapters/eas.ts` as
`gitcoinPassportAdapter` — and states the correlation argument in one place.*

---

## 1. What a Passport score actually attests

A Passport "Unique Humanity Score" is a **weighted sum over stamps**, computed off-chain by
Passport's scorer with Passport's weights, optionally minted on chain by the user. It attests, at
minting time, that *someone controlling this address completed some subset of ~100 verification
flows*, compressed to one scalar by a weighting nobody consuming the number chose.

The scalar is **not** a personhood proof, and its own issuer agrees: after the 2024 sybil analyses
of Gitcoin rounds, Gitcoin moved away from relying on the raw score alone (COCM cluster-matching,
manual review, additional ML — see `passport-civic-fractal-zkme-galxe.md` §"honest failure
modes"). The builder of the largest aggregate score in the space concluded the aggregate score was
insufficient. We should not conclude otherwise on their behalf.

What the scalar *is*: cheap, permissionlessly readable evidence that a wallet has history and that
its holder spent nonzero effort. That is real, minor signal — wallet-history-grade, not
identity-grade.

### The score decomposed, on a live subject

The score-v2 attestation format publishes the stamp list inline, so the decomposition is now
readable from the attestation itself. A real mint, Optimism, 2026-07-24 (uid
`0xd60c83d67487be858f06b6d98d42ba7c5a8b411f40f662087f813609817c4c55`, recipient
`0x46760723cf94ebd77Adae95BE06fE455ccd0Df74`):

| Field | Value |
|---|---|
| score | 28.847 (passing, threshold 20) |
| `Steam` | 2.8 — a purchasable web2 account |
| `BinanceBABT2` | 10.021 — Binance KYC token |
| `HolonymGovIdProvider` | 16.026 — Holonym government-ID check |

A "verified human at 144% of threshold" is: one government ID we already price under
`kyc-vendor:holonym`, one exchange KYC, and a Steam account. **Two of the three restate trust
roots this ontology already counts elsewhere.** That is the whole argument in one row.

## 2. The correlation problem, named explicitly

Passport's stamp list overlaps the rest of the ontology at the *trust-root* level:

| Stamp family | Where the ontology already prices that root |
|---|---|
| `Coinbase`, `CoinbaseDualVerification*` | `coinbase-verification` → `kyc-vendor:persona` |
| `HolonymGovIdProvider`, `CleanHands` | `holonym-gov-id` |
| `Biometrics` (FaceTec via id.human.tech) | `holonym-biometrics` |
| `CivicCaptchaPass/Uniqueness/Liveness` | `civic-pass` (FaceTec root) |
| `Brightid` | `brightid` |
| `Poh` | `poh-v1` |
| `IdenaState#*`, `IdenaStake#*`, `IdenaAge#*` | `idena` |
| `TrustaLabs` | `trusta-sybil` — an aggregate inside the aggregate |
| Google / Discord / LinkedIn stamps | social-account roots (where scored) |
| `ETHScore#*`, `NFTScore#*`, `zkSyncScore#*`, gas/txn/days stamps | the same **wallet history** the passport itself is rooted at, measured six ways |

Consequences, all enforced in the adapters:

1. **The scalar must never be added to our score as an independent signal.** A subject holding
   `coinbase-verification` *and* a Passport whose score is mostly the Coinbase stamp is one
   credential observed twice. Feeding both into independent roots pays the adversary the
   difference.
2. **The stamp list is the valuable output, not the number.** `STAMP_TO_ADAPTER` in
   `human-passport.ts` maps each restated stamp to the adapter that owns its root, and both
   passport adapters report `restatesAdapters` so the collapse is visible per subject.
3. **The weights encode a conflict of interest.** Holonym (human.tech) owns Passport, and
   Holonym's own Gov ID stamp is weighted 16.026 — effectively joint-highest with Passport's own
   `ETHScore#50` behavioral model at 16.021. A pure wallet-history ML score is weighted the same
   as a government ID. Those weights are a *policy* of the vendor, not measurements, and are
   changed at will off-chain (see §5 of `passport-civic-fractal-zkme-galxe.md`).

## 3. Forge and rent, dated

- **Forge (pass the 20 threshold without being a new human):** `ETHScore#50` + `NFTScore#50`
  alone are 32.267 points and are functions of purchasable wallet activity; aged wallets with
  history trade at **$1–$20** (sybil-incidents table, `research/landscape/`, collected 2026-07).
  Alternatively ~$10 of Holonym fees (Gov ID $5 + Biometrics $5 → 22.03 points, prices from
  passport.human.tech, 2026-07-24) buys a passing score with *documents* — but that path burns a
  real identity and is priced under the KYC roots, not here. The behavioral path is the cheap
  one and prices the credential: **forge ≈ $20** (`forgeCostCents: 2000`).
- **Rent (borrow a passing wallet):** farmed passing wallets rent at the bottom of the aged-wallet
  market, **≈ $1** (`rentCostCents: 100`). 2024 Gitcoin-round sybil clusters demonstrably held
  passing scores at scale (LOL/Sybil analyses cited in `passport-civic-fractal-zkme-galxe.md`).
- **Hard expiry:** every deployment's `maxScoreAge()` is 7,776,000 s (90 days, read on-chain
  2026-07-25), and score-v2 attestations carry an explicit ~90-day `expirationTime` (the live
  sample above: `1792668483 − 1784892497 = 7,775,986 s`). A Passport score is a hard-expiring
  credential.

## 4. Proposed ontology posture

- **`evidenceClass: 'Behavioral'`** — the scalar is dominated by wallet-history stamps; the
  identity-grade stamps inside it are already classed under their own adapters.
- **`trustRoot: 'behavioral:wallet-history'`** — deliberately **not** a root of its own. A
  `gitcoin-passport` root would score the aggregate as independent of the credentials it
  aggregates, which is the exact failure the root model exists to prevent. It shares
  `behavioral:wallet-history` with `human-passport` (the resolver-cache read of the same
  credential), so the two reads saturate to one contribution however many are registered.
- **`ageCurve: 'Decay'`, `decayHalfLifeDays: 180`** — recency is the signal and the credential
  hard-dies at 90 days anyway, so the curve only ever applies over the first 90 days of life.
- **`forgeCostCents: 2000`, `rentCostCents: 100`** — the farmed-wallet market, per §3.

Proposed entry for `ontology/adapters.json` (registration happens in the main session):

```json
{
  "id": "human-passport-eas",
  "name": "Human Passport score (EAS attestation)",
  "evidenceClass": "Behavioral",
  "trustRoot": "behavioral:wallet-history",
  "forgeCostCents": 2000,
  "rentCostCents": 100,
  "decayHalfLifeDays": 180,
  "live": true,
  "sourceURI": "research/protocols/gitcoin-passport.md",
  "implemented": true,
  "notes": "The same credential as human-passport, read from the EAS attestation itself (getUserAttestation -> getAttestation) instead of the resolver's cache: adds the attester check, EAS revocation state, and the inline score-v2 stamp list for root decomposition. Shares behavioral:wallet-history with human-passport on purpose - two reads of one credential must saturate, never sum.",
  "ageCurve": "Decay"
}
```

## 5. Where Passport writes on chain (2026), verified

Passport's on-chain surface is EAS end-to-end, wrapped by three contracts from
`passportxyz/eas-proxy` (GPL): **GitcoinAttester** (the only address allowed to attest),
**GitcoinResolver** (EAS resolver hook — validates the attester, caches the score, maintains the
address→UID index), **GitcoinPassportDecoder** (consumer-facing reads). Deployments exist on
Optimism, Base, Arbitrum, Linea, Scroll, Shape and zkSync Era (decoder table in
`human-passport-onchain-read.md`).

Three schemas, all resolved by the GitcoinResolver of their chain:

| Schema | String | Status (2026-07-25) |
|---|---|---|
| **Score v2** | `bool passing_score, uint8 score_decimals, uint128 scorer_id, uint32 score, uint32 threshold, tuple(string provider, uint256 score)[] stamps` | **what new mints use** — live mints observed on Optimism the day of writing |
| Score (legacy) | `uint256 score,uint32 scorer_id,uint8 score_decimals` | held by older mints; no new mints seen in the ~11 recent days scanned |
| Passport (stamps bitmap) | `uint256[] providers,bytes32[] hashes,uint64[] issuanceDates,uint64[] expirationDates,uint16 providerMapVersion` | legacy stamp storage, indexed against `getProviders(version)` |

**Schema UIDs are per-chain and must never be copied between chains.** They are content-derived —
`keccak256(abi.encodePacked(schema, resolver, revocable))` (`SchemaRegistry.sol#_getUID`) — and the
resolver address differs per chain. Verified by recomputing and reading back from each chain's
SchemaRegistry:

| Chain | Resolver (named by the Decoder) | Score v2 UID (derived == registered) |
|---|---|---|
| Optimism | `0xc94aBf0292Ac04AAC18C251d9C8169a8dd2BBbDC` | `0xda0257756063c891659fed52fd36ef7557f7b45d66f59645fd3c3b263b747254` |
| Arbitrum | `0x90E2C4472Df225e8D31f44725B75FFaA244d5D33` | `0x1f3dce6501d8aad23563c0cf4f0c32264aed9311cb050056ebf72774f89ba912` |

(Legacy score UID on Optimism, same derivation: `0x6ab5d34260fca0cfcf0e76e96d439cace6aa7c3c019d7c4580ed52c6845e9c89` —
matches the Decoder's own `scoreSchemaUID()`.) The adapter therefore hard-codes **no UID**: it asks
the Decoder for its resolver and recomputes.

**Discovery needs no indexer and no logs.** `GitcoinResolver` keeps a public
`userAttestations(address, schemaUID) → uid` mapping (`getUserAttestation`), populated atomically
by the same hook that rejects foreign attesters
(`if (attestation.attester != address(_gitcoinAttester)) revert InvalidAttester();` —
`GitcoinResolver.sol`, fetched 2026-07-25). So the strongest permissionless read is:

1. `Decoder.gitcoinResolver()`, `Decoder.maxScoreAge()`, `Resolver._gitcoinAttester()` — one-time
   config, 3 `eth_call`s per chain per process;
2. `Resolver.getUserAttestation(subject, scoreV2UID)` (falling back to the legacy UID) — 1–2
   `eth_call`s;
3. `EAS.getAttestation(uid)` — issuance time, expiry, revocation, and the full stamp payload in
   one struct — 1 `eth_call`.

Read back live and cross-checked: for the sample mint above, `getUserAttestation` returns exactly
the uid the `Attested` log carries, and the attestation's `(score, time, expirationTime)` equals
`getCachedScore`'s `(288470, 1784892497, 1792668483)` field-for-field. The EAS read and the cache
read describe the same mint; the EAS read additionally carries the attester, the revocation state
and the stamps. `eas.test.ts` holds the two adapters to that agreement on a fresh subject every
live run.

Attesters, read from each chain's resolver (2026-07-25): Optimism
`0x843829986e895facd330486a61Ebee9E1f1adB1a` (matches the attester topic of the live mints),
Arbitrum `0x7848a3578Ff2E1F134659a23f64A404a4D710475`. The adapter re-reads the attester per chain
and rejects any attestation not signed by it — a resolver migration surfaces as a loud fault, not
a quietly imported number.

## 6. What this read cannot see

- **Off-chain-only passports.** Most Passport users never mint; their scores exist only in the
  vendor's API. By design we do not read that API, so `held: false` here means "no on-chain
  passport", not "no passport". The population we can see is the paying, self-selected minority.
- **Community-scoped scores** (`communityScores` in the resolver) are keyed by `scorer_id`; the
  default `userAttestations` read returns the canonical mint. The attestation's `scorer_id` is
  decoded and reported so a community-scoped mint is at least visible as such.
- **Stamp-level dates.** Score-v2 carries stamp weights but not per-stamp issuance dates; those
  remain only in the legacy passport attestation's parallel arrays.

## References (primary unless noted)

- `passportxyz/eas-proxy` — `GitcoinResolver.sol`, `GitcoinPassportDecoder.sol`, `GitcoinAttester.sol`: https://github.com/passportxyz/eas-proxy (fetched 2026-07-25)
- Passport scorer weights: https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py
- Decoder contract reference: docs.passport.human.tech → Smart contracts → Contract reference (fetched 2026-07-24, tabulated in `passport-civic-fractal-zkme-galxe.md`)
- EAS `SchemaRegistry.sol#_getUID` (UID derivation): https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/SchemaRegistry.sol
- Live reads 2026-07-25: Optimism (`mainnet.optimism.io`, `optimism-rpc.publicnode.com`) and Arbitrum (`arbitrum-one-rpc.publicnode.com`, `arb1.arbitrum.io/rpc`) — schema records, resolver/attester getters, sample attestation `0xd60c83d6…4c55`, `getCachedScore` cross-check
- Sybil-cluster evidence and stamp weight critique: `research/protocols/passport-civic-fractal-zkme-galxe.md` (2026-07-24) and `research/landscape/` sybil-incidents table
