# Lens, read permissionlessly — after the protocol moved chains

**Status:** implemented, `packages/sdk/src/adapters/lens.ts`, tests (offline and `LIVE=1`) in
`lens.test.ts`. Everything below was measured by me against public RPC on **2026-07-25** unless
a source and date say otherwise.

---

## 1. Which Lens is canonical in 2026

Lens has lived in three places, and two of them still answer:

| Era | Chain | Registry | State on 2026-07-25 |
|---|---|---|---|
| v1/v2, 2022–2025 | Polygon | `LensHub` `0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d` ("Lens Protocol Profiles", ERC-721) | **Alive but vestigial**: `totalSupply()` 665,569, `getState()` 0 (unpaused), and still minting — 664,922 at block 70,865,248-20M (2025-04-28, drpc archive read), so **+647 profiles in the 15 months since sunset**, ~1.4/day |
| v3, 2025– | **Lens Chain** (ZKsync-stack L2, chain id 232, GHO gas) | `AccountFactory` `0x26C7fd63B06deb4F9E4B5955D540767b9Ac7bbaa`, `lens/` namespace `0x1aA55B9042f08f45825dC4b651B64c9F98Af4615` | Canonical. First block 2025-02-21T12:26:26Z (block 1's own timestamp); public launch 2025-04-04 with ~650k v2 profiles bulk-migrated (lens.xyz, "Migrating the Lens Ecosystem to Lens Chain", accessed 2026-07-25); ~6.11M blocks at head |

Migration **copied, it did not burn**: Stani's EOA still holds 11 v2 profile NFTs on Polygon and
vitalik.eth still holds 1, while both also own claimed Lens Chain accounts. So the two registries
describe one credential, which is why the adapter is one adapter and the Polygon read is a
fallback rather than a second signal.

Governance moved too: on 2026-01-20 Avara handed operational stewardship of Lens to Mask Network,
with Avara advisory (prnewswire.com / theblock.co, 2026-01-20). The chain and contracts were
unchanged by the handoff, but a registry whose steward changed six months ago is a registry whose
future write-path guarantees are a judgement, not a fact.

## 2. What the credential attests, and what it costs

**Account ownership, never personhood** — and it is the cheapest credential in this directory.
Measured from a live signup transaction on 2026-07-25
(`0x2789e89cb0665a52385239ed682cee75bc14619e48530b02657d078b7e553f06`):

- Account creation is **gas-sponsored**: the tx was paid by a relayer
  (`0xb964…e348`), not the user. Cost to the sponsor: 440,888 gas × 2.77 gwei = **0.00122 GHO ≈
  $0.0012**. GHO is a dollar stablecoin, so this is a tenth of a cent.
- The account came with an auto-generated `lens/` username (`orb_anomaly_68560`) at no charge —
  usernames are being minted programmatically, in bulk, right now.
- Creation rate: 21–22 `Lens_Account_Created` events per 1,000 blocks at head (~7.3 s/block), i.e.
  **~250 accounts/day**, most with machine-generated names.
- There is **no storage rent and no recurring price of any kind** — nothing like Farcaster's
  $0.20/unit/yr, which was already the floor of that class.

So the forge cost is, honestly, **under a cent** — the permissionless unsponsored path
(`AccountFactory.deployAccount` at your own gas) costs ~0.12¢. Rental has no priced market I
could verify (aged Lens handles traded on OpenSea in the v1 era; current prices UNVERIFIED), so
the rent figure is a judgement by analogy to the aged-social-account markets in
`research/landscape/social-and-zktls-signals.md`, not a measurement.

One structural weakness Farcaster does not share: **the credential can be planted.**
`transferOwnership` on a Lens account needs no consent from the recipient (Farcaster's
`IdRegistry.transfer` requires the recipient's signature), so anyone can make any address "hold a
Lens account" for a tenth of a cent. Planting gives weight away rather than accruing it, so it
pays no sybil, but `held: true` here must never be read as an act of the subject.

## 3. The read: no owner-keyed state exists, but the logs are complete and served

Lens v3 has no `idOf(address)`. A profile is an `Account` **contract** deployed by the
`AccountFactory`, owned by an EOA via `owner()`; the `lens/` namespace maps
username ↔ **account contract** (`accountOf(string)`, `usernameOf(address)`), never the EOA. So
given only an EOA there is nothing to `eth_call`.

The obvious event is a trap. `Lens_Account_Created(address indexed account, address indexed
owner, …)` indexes an owner — but **every account, migrated and fresh signup alike, is created
with `owner = LensFactory`** (`0x1fa75D26819Ac733bf7B1C1B36C3F8aEF32d2Cc0`) and handed to the
user afterwards. Measured on 4 current signups (all created to LensFactory, all owned by users
one transaction later) and on the migrated cohort (vitalik's account, created block 1,415, owner
LensFactory). An owner-filtered query over creation events returns **zero** rows for real users.

What works is the handover itself: the `Account` contract emits

```
Lens_Account_OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
topic0 0x5a1371cbc5817916f19ff7b6c2ebe1e0050f17b29432e56d60188a4f391010e6
```

on construction and on every ownership change, and — the load-bearing fact — **Lens Chain's own
public RPCs serve `eth_getLogs` over the chain's entire 6.1M-block history filtered by the
indexed `newOwner`**, with no range cap. Measured: 0.3–4 s warm, 38 s worst-case cold on
`rpc.lens.xyz`, 0.3 s on `rpc.lens.dev`. One query returns every account ever handed to the
subject.

Two verifications make that spoof-proof, because anyone can emit an identically-shaped event from
their own contract:

1. `owner()` on the candidate must equal the subject at head — a spoofer's contract can fake the
   event but then the account it names either isn't a contract that answers `owner()` with the
   subject, or is, in which case:
2. the candidate must have a `Lens_Account_Created` log **emitted by the canonical
   `AccountFactory`** (address-filtered query, ~2 s). A contract not deployed by the factory is
   not a Lens account, whatever it emits.

Full probe, measured end to end: positive (vitalik) **1.0 s / 5 RPC calls**; negative **0.45 s /
2 calls** plus one Polygon call for the fallback.

## 4. Dating: acquisition, not creation — and the migration cliff

Because every ownership change emits the event, the **last transfer-to-subject block is the
acquisition, exactly** — no bisection, no continuity ladder, none of the `custodyOf` anxiety the
Farcaster adapter carries. (Writing the Lens tests is incidentally what exposed a real bug in
that ladder: `findCustodyAcquisition`'s restart bracket was inverted, so an away-and-back custody
history kept the first stint's date. Fixed in `farcaster.ts`, regression-tested in
`farcaster.test.ts`.)

Three acquisition shapes, told apart on chain (`classifyAcquisition`):

| Case | Discriminator | Date | Note carried |
|---|---|---|---|
| Fresh signup | acquired in the account's creation block | creation, exact | — |
| Migration claim | `previousOwner ==` migration custodian `0x6e32C691A2B6b9351a2C6144C01badCb568cdFEc` (an EOA — `eth_getCode` empty) | the claim; the v2 profile may date to 2022, so this **understates age → ramp floor** | `date-from-registry-import` |
| Changed hands | anything else later than creation | the sale — a bought 2022 handle is priced at its purchase date | `credential-transferred-since-issuance` |

Worked example, verified live: `lens/vitalik` → account
`0xe4AaA97cdA406c6AF7C02a5260a8013910bd683C`, created block 1,415 (genesis bulk migration, owner
LensFactory → custodian in the same block), claimed by `0xd8dA…6045` at block 219,585 =
**2025-04-04T10:36:39Z** — launch day. The probe returns `issuedAt: 1743762999`,
`acquisition: "migration-claim"`, username `vitalik`.

A migration claim routed through any address other than the known custodian is classified
`transferred` — mislabeled in the conservative direction (same date, harsher caveat). I verified
the custodian on the vitalik path only; whether Lens used exactly one custodian EOA for all
unclaimed accounts is open (§7).

## 5. The legacy fallback, bounded rather than guessed

A v2 holder who never claimed on Lens Chain reads `held: false` above — and the late Polygon
mints were *never in the migration snapshot at all*, so post-sunset profiles exist **only** on
Polygon. When Lens Chain shows nothing, the probe reads `LensHub.balanceOf(subject)` on Polygon.

The boolean alone would be dangerous: profiles are ERC-721s a farmer can buy for dust, and an
undated credential on a Ramp collects the unknown-age midpoint — free weight. So the date is
bounded with **one archive read at block 70,000,000** (its own timestamp, 1,744,013,119 =
2025-04-07T08:05:19Z — the sunset week; immutable, re-asserted by the live test):

- held at the sunset block → `issuedAt =` sunset timestamp: a floor that understates true age;
- not held there → acquired after sunset → `issuedAfter` **caps** the ramp weight instead;
- archive unreachable → no date at all, and `detail.undated` says why.

Verified live on a post-sunset mint (profile 665,560, owner `0x8775…182B`, no Lens Chain logs):
`held: true, issuedAfter: 1744013119, heldAtSunset: false` — a fresh v2 profile is worth nothing
on the ramp, which is the point.

## 6. Endpoints, and an honest centralization caveat

| Endpoint | Role | Notes |
|---|---|---|
| `rpc.lens.xyz` | Lens Chain, primary | full-history `eth_getLogs`; cold owner-scan up to ~40 s |
| `rpc.lens.dev` | Lens Chain, failover | same coverage, faster cold in my runs |
| `polygon-bor-rpc.publicnode.com` | Polygon head reads | refuses archive |
| `polygon.drpc.org` | Polygon archive (sunset read) | served every historical `eth_call` asked |

**Both Lens Chain endpoints are Lens-operated.** There is no independent keyless archive for
chain 232 that I could find — drpc's `lens.drpc.org` refused every request on 2026-07-25. So this
read is permissionless (no key, no registration, nothing to revoke per-caller) but not yet
vendor-independent in the infrastructure sense: if Lens's RPCs lied about log history, nothing in
this probe would catch it, and the live suite's two-endpoint agreement check only catches them
disagreeing. That is a weaker position than the Farcaster read's three independent OP endpoints,
and the file says so rather than implying otherwise.

## 7. Proposed ontology entries

Trust root (new):

```json
"social-account:lens": "A Lens account on Lens Chain, or the v2 profile NFT on Polygon it migrated from. One root for both registries — migration copied rather than burned, so a subject holding both holds one credential. Account ownership, not personhood: creation is free to the user and gas-sponsored."
```

Adapter entry:

```json
{
  "id": "lens-account",
  "name": "Lens account (Lens Chain)",
  "evidenceClass": "Behavioral",
  "trustRoot": "social-account:lens",
  "forgeCostCents": 1,
  "rentCostCents": 1,
  "decayHalfLifeDays": 730,
  "live": true,
  "sourceURI": "research/protocols/lens-onchain-read.md",
  "implemented": true,
  "ageCurve": "Ramp",
  "notes": "Account ownership, never personhood, and cheaper than a Farcaster id: creation is gas-sponsored (0.0012 GHO ≈ 0.12¢ to the sponsor, $0 to the user, measured 2026-07-25) with auto-generated usernames minting at ~250/day, so forge is priced at the unsponsored gas path, and rent equals forge: nobody pays more to borrow an account than minting one costs, and the aged-handle premium the resale market charges is a premium on age — which the Ramp curve prices — not on the credential. Ramp for the same reason as farcaster-account: the only thing an adversary cannot mint today is survival — a claimed 2022-era v2 profile — and the probe dates acquisition, not creation, so bought accounts are priced from the sale. Read permissionlessly from Lens Chain ownership-transfer logs (both public RPCs are Lens-operated; permissionless but not infrastructure-independent), with a Polygon LensHub fallback for never-migrated v2 profiles date-bounded at the 2025-04 sunset block. Ownership transfer needs no recipient consent, so the credential can be planted; held must never be read as an act of the subject."
}
```

At 1¢ on a Ramp (registered rent ≤ forge per the ontology invariant: rental is never the dearer attack) the credential never clears the 10¢ negligible-cost floor, which is the honest
conclusion: a Lens account is corroborating texture — a username, an acquisition date, graph
position someday — not a root that moves a score. It earns its place the way `circles-v2` does,
as a signal whose value is its age and its detail, priced so that the 250-a-day cohort is worth
exactly nothing.

## 8. Open, and deliberately not guessed

1. **Whether one custodian EOA held every unclaimed migrated account.** Verified on the vitalik
   path only; a second custodian would demote some migration claims to `transferred` (harsher
   caveat, same date). Answerable by sampling claim transactions from the launch window.
2. **The `lens/` namespace's username pricing rules.** `UsernamePricePerLengthNamespaceRule` is
   deployed on mainnet, but I did not read its config off the namespace, and auto-generated
   long names are demonstrably free. Short-name pricing would sharpen the forge figure without
   changing its order of magnitude.
3. **The resale market for aged Lens handles.** v1 handles traded on OpenSea; current volume and
   price UNVERIFIED, and the 10¢ rent figure is an analogy until priced.
4. **Population on Lens Chain.** There is no counter to read; counting `Lens_Account_Created`
   events over 6.1M blocks is one unbounded log query I chose not to lean on a free endpoint
   for. Lens's own "~650k migrated" claim is the only population figure here not measured by me.
5. **Secondary namespaces.** Apps can deploy their own username namespaces; only the global
   `lens/` one is read. An account's handle in an app namespace is invisible to this probe —
   detail lost, `held` unaffected.
