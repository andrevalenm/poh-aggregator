# Galxe Passport, read permissionlessly — the SBT nobody indexed

**Status:** implemented, `packages/sdk/src/adapters/galxe.ts`, tests (offline and `LIVE=1`) in
`galxe.test.ts`. Everything below was measured by me against public RPC on **2026-07-25** unless
a source and date say otherwise. This supersedes the "passively no" verdict in
`passport-civic-fractal-zkme-galxe.md` §5: a passive read exists, and it is good.

---

## 1. Which contract, which chain — the Gravity question answered

The earlier research left the SBT address as an open question (`UNVERIFIED: the Galxe Passport
SBT contract address`) and flagged that Galxe now runs its own Gravity chain. Both resolved:

| Fact | Value | How verified |
|---|---|---|
| SBT contract | `0xE84050261CB0A35982Ea0f6F3D9DFF4b8ED3C012`, **BNB Chain** | `name()` = "Galxe Passport", symbol "GALXE passport"; Sourcify **full match** (creation + runtime), chain 56 |
| Deployed | block 21,257,482 = **2022-09-12T03:50:43Z** | bisection on code presence via archive `eth_call`; block's own timestamp |
| Still minting | tokens 1,047,301 and 1,047,302 minted **2026-07-24 and 2026-07-25** | real `Transfer(0x0 → holder)` logs, blocks 111,852,772 / 112,026,449 |
| Scale | `getNumMinted()` 1,047,302; `totalSupply()` 1,044,375 → **2,927 burned or revoked** (0.28%) | head `eth_call`s |
| On Gravity? | **No.** `eth_getCode` at the same address on Gravity (chain id 1625) returns `0x` | two RPCs, `rpc.gravity.xyz` and `rpc.ankr.com/gravity` |

Galxe's Identity Protocol registries do exist on five chains including Gravity, but they hold
type/issuer metadata for the interactive ZK path, not owner-keyed passport state — the
`BabyzkStatefulVerifier` can only check a proof the *user* generates. The SBT on BNB Chain is
the only passive `address → has-passport` read, and it is still the live artifact: Passport
V2 (2024) and V3 (2025, Sumsub) changed the KYC pipeline and the vault, not the token.

## 2. What the credential attests

A **Sumsub KYC session Galxe accepted** (Persona in the v2 era), minted as a non-transferable
ERC-721. The trust root is `kyc-vendor:sumsub`, shared with Linea PoH — one Sumsub applicant
can be both credentials, which the ontology's root-saturation already prices. Two things the
SBT does *not* carry, both in the encrypted credential only: the document class (`id_class` —
a "passport" here may be a municipal ID) and the credential version. Passive scoring cannot
weight by document strength; the research file for the interactive path keeps that option.

**Soulbound, verified on bytecode not marketing:** `_transfer` is
`require(false, "GalxePassport: passport is not transferrable")` in the verified source, and a
`transferFrom` simulated *from a live holder* reverts with exactly that string (re-asserted
every live run). So — unlike a Lens account — this credential cannot be planted, bought, or
parked: `held` is the result of a KYC flow the subject completed with the keys they hold. Both
exits exist and both zero the state the probe reads: `burn` (holder-initiated) and `revoke`
(Galxe's minter role), each clearing `_balances`, `_passports` and the token record, so a
revoked passport is `held: false` with no extra work.

## 3. The read: one call for held, one storage slot for the tokenId

- **held**: `balanceOf(subject) > 0`. One `eth_call` on any keyless endpoint.
- **tokenId**: the contract keeps `mapping(address => uint256) _passports` — an owner-keyed
  index most SBTs don't bother with. It is private, but storage is not: the mapping sits at
  **slot 7**, located empirically by scanning slots 0–14 for a known holder and matching the
  value against their mint log (slot 6 is `_balances`; five independent endpoints returned the
  same value). The contract is not a proxy and has no upgrade path, so the layout cannot move.
  `ownerOf(tokenId)` re-checks the slot read before anything is believed.
- **texture**: `passportStatus(tokenId)` (uint32, observed `1` on every token sampled across
  the id range; semantics unpublished, reported raw) and `cid(tokenId)` (campaign id, observed
  `6336` on all samples).

`tokenOfOwnerByIndex` — the standard-looking alternative — is an O(n) loop over 1M+ storage
slots and reverts on `eth_call` gas; the storage slot is not an optimization, it is the only
way to the tokenId without logs.

## 4. Dating: a mint counter the contract cannot help publishing

Token ids are `_tokens.push` array indices — **strictly sequential in mint order** — and
`getNumMinted()` is `_tokens.length - 1`, a monotone counter that burns never decrement. Both
are properties of the verified source, not observations. Consequences:

1. **Exact issuance, no logs:** the first block where `getNumMinted() >= tokenId` is the mint
   block; its timestamp is `issuedAt`. The probe binary-searches for it (~20–24 archive
   `eth_call`s inside an anchor bracket). The live suite validates the whole mechanism the
   strong way: it finds a real recent mint from `Transfer` logs and asserts the bisection date
   **equals the log's own block timestamp** — two independent dating paths agreeing on a live
   subject, exact to the second (verified 2026-07-25, token 1,047,302, block 112,026,449).
2. **Proven bounds when the archive is unreachable:** `GALXE_MINT_ANCHORS` pins seventeen
   `(block, timestamp, numMinted)` triples measured from the counter across the contract's
   whole life. Past state is immutable, so these are constants in the same sense as the Lens
   sunset timestamp, and the live suite re-reads two per run. A tokenId above an anchor's
   count was provably minted after that anchor's block → `issuedAfter`. (On this adapter's
   `Decay` curve, `scoring.ts` ignores `issuedAfter` — unknown-age Decay reads freshness 1 —
   so the bound is honesty in the evidence, not weight in the score. The exact date is what
   the decay needs, which is why the bisection is the primary path.)

The anchor curve is also the protocol's population history, measured rather than quoted:
46,850 by 2022-11; the 2023 quest boom (116,831 → 409,002 between 2023-04 and 2023-07); the
2024 airdrop season (514,533 → 950,258 between 2024-02 and 2024-06); and a 2026 trickle of
**~2 mints/day** (1,047,231 → 1,047,302 over the last two months). Galxe's "1M+ Passport
users" marketing claim is, for once, accurate to the chain.

## 5. Endpoints, and where the archive honesty lives

| Endpoint | Role | Measured behaviour (2026-07-25) |
|---|---|---|
| `rpc-bsc.48.club` | held reads, primary | `eth_call`/`eth_getStorageAt` OK; `eth_getLogs` ≤5,000-block windows, retention ~1.15M blocks (~6 days); no archive |
| `bsc-dataseed.bnbchain.org` | held reads | call/storage OK; refuses `eth_getLogs` ("limit exceeded" even for 100 blocks); no archive |
| `bsc-rpc.publicnode.com` | held reads | call/storage OK; logs and archive "require a personal token" |
| `1rpc.io/bnb` | held reads | call/storage OK; no logs, no archive |
| `bsc.drpc.org` | (spare) | call/storage OK; logs ≤100-block windows; no archive |
| `bsc-mainnet.nodereal.io/v1/64a9…12d3` | **dating only** | full archive `eth_call` back to deployment; logs in ≤20k windows over full history |

**The caveat this file exists to state plainly:** no keyless BSC endpoint serves archive
state — I measured all five above refusing it. The one public archive is NodeReal's community
endpoint, whose URL embeds the shared API key chainlist publishes for wallet users. It is
public in practice and revocable in principle. So the adapter uses it for **dating only**:
`held` never touches it, and when it fails the probe degrades to the anchor `issuedAfter`
bound and says so in `detail.dating`. If NodeReal rotates the key, the credential keeps
working and the exact date is what dies — the failure mode is the one we chose.

Probe cost, measured: negative **2 calls** (~0.3s); positive **~5 keyless calls + ~22 archive
calls + 1 header** (~4s, dominated by the bisection).

## 6. Proposed ontology changes

The entry exists with `implemented: false`. Proposed update — flip the flag, point the source
at this file, and correct the notes (costs, root, curve and half-life are right as they
stand; the forge figure is the Sumsub-defeat price from `kyc-liveness-vendors.md`, which this
read does not move):

```json
{
  "id": "galxe-passport",
  "name": "Galxe Passport",
  "evidenceClass": "StateIdentity",
  "trustRoot": "kyc-vendor:sumsub",
  "forgeCostCents": 120000,
  "rentCostCents": 3000,
  "decayHalfLifeDays": 730,
  "live": true,
  "sourceURI": "research/protocols/galxe-passport-onchain-read.md",
  "implemented": true,
  "notes": "Sumsub underneath (Persona in the v2 era); shares its root with Linea PoH. Read passively from the soulbound ERC-721 on BNB Chain (0xE840…3C012, still minting ~2/day as of 2026-07-25) — balanceOf decides held, the owner-keyed _passports storage slot names the token, and issuance is dated exactly by bisecting the contract's monotone mint counter over archive state, with measured anchor bounds as the degraded path. Non-transferability is enforced in code, so held is an act of the subject; burn and Galxe-side revoke both zero the read. The SBT does not disclose document class or credential version — a 'passport' here may be a municipal ID — so passive scoring cannot weight by document strength.",
  "ageCurve": "Decay"
}
```

Name note: the entry currently says "Galxe Passport v3". The SBT does not distinguish
versions — one contract has served v1 through v3 — so the version suffix overstates what a
passive read can know. Suggest dropping it.

## 7. Open, and deliberately not guessed

1. **`passportStatus` semantics.** A uint32, observed `1` on every sampled token (fresh 2026
   mint, mid-range, early). `setPassportStatus` exists for the minter role; no published enum.
   The probe reports the raw value and does not gate `held` on it — `balanceOf` already
   reflects revocation, which is the mechanism Galxe demonstrably uses (2,927 removals).
2. **Whether one address can hold two passports.** `_passports` stores one tokenId per owner
   and re-mint after burn is possible; whether `mint` guards against a second concurrent
   passport was not verified from source. `balanceOf` is authoritative for `held` either way.
3. **The minter set.** `addMinter`/`removeMinter` are owner-gated and unenumerated here; who
   can currently mint (and thus revoke) was not established. It governs issuance policy, not
   the read.
4. **Version and document class of a given passport.** Not on chain (see §2). The interactive
   Identity Protocol path (`docs.galxe.com/identity`) remains the only way to see `id_class`,
   `proof_of_time` or selfie-recheck counts, and remains unbuilt — the babyzk SDK last shipped
   2024-07 and its aggregated verifier is still Sepolia-only.
5. **NodeReal key longevity.** The dating path's dependency, discussed in §5. An alternative
   would be maintaining the anchor table at higher resolution (say monthly) from any archive
   source as an offline artefact; the adapter's bound would then rarely be more than weeks
   loose even with the endpoint gone.
