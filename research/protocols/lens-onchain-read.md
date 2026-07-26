# Lens account — reading it on chain

*Written 2026-07-26. Every figure below was measured against live chains on 2026-07-25 while the
adapter was built; this file records what the implementation in
`packages/sdk/src/adapters/lens.ts` established, so the ontology entry cites the evidence rather
than the code that happens to embed it.*

## Which Lens, in 2026

Lens left Polygon. **Lens Chain** — a ZKsync-stack L2, chain id 232, GHO gas — produced its first
block on **2025-02-21** and launched publicly on **2025-04-04**, migrating roughly **650k v2
profiles**. On **2026-01-20** stewardship passed from Avara to Mask Network.

The v2 `LensHub` on Polygon was **not** frozen. It still answers, it still holds every profile NFT
— the migration copied, it did not burn — and it still trickles new mints: **+647 profiles in the
15 months after sunset**, measured 2026-07-25. The canonical registry is now the Lens Chain one,
so the probe reads that first and falls back to Polygon for never-migrated v2 profiles,
date-bounded at the 2025-04 sunset block.

## What the credential is evidence of

**Account ownership, never personhood** — and cheaper than a Farcaster id.

Account creation on Lens Chain is **gas-sponsored**: a fresh account plus an auto-generated
`lens/` username costs the user nothing and the sponsor **0.0012 GHO (~0.12 cents)**, measured
from a live creation transaction on 2026-07-25 (gasUsed 440,888 at 2.77 gwei). There is no storage
rent and no recurring price of any kind. Auto-generated usernames mint at roughly **250/day**.

So the ontology prices it at effectively zero and leans entirely on the `Ramp` curve. An account
that has survived since the v2 era carries a few cents of aged-account-market value; one minted
this week carries nothing. Rent equals forge because nobody pays more to borrow an account than
minting one costs — the aged-handle premium the resale market charges is a premium on *age*, which
the Ramp already prices, not on the credential.

## The read: every account leaves an ownership-transfer log

Lens v3 has no owner-keyed registry, which makes the obvious lookup impossible.

A user's "profile" is an `Account` **contract** deployed by the `AccountFactory`, owned by their
EOA, and nothing on chain maps owner → account as state. Worse,
`Lens_Account_Created.owner` is useless for a reverse lookup: **every** account, migrated and
brand-new alike, is created with `owner = LensFactory` and only then transferred to the user —
verified against both migrated and current signups on 2026-07-25.

What does work: the `Account` contract emits

```
Lens_Account_OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```

on construction and on every subsequent ownership change, and Lens Chain's public RPC serves
`eth_getLogs` over the chain's entire history (6.1M blocks at measurement) filtered by that topic.

## Two consequences worth stating plainly

**The probe dates acquisition, not creation.** Because the signal is an ownership-transfer log, a
bought account is priced from the sale rather than from the mint. That is the correct behaviour
for a Ramp: the only thing an adversary cannot mint today is *survival*, and survival under the
current owner is what the log actually attests.

**Ownership transfer needs no recipient consent.** An account can therefore be *planted* on an
address that never asked for it. `held` must never be read as an act of the subject — which is why
this credential sits at 1¢, below the independence floor, and never moves a score on its own.

## Infrastructure honesty

Both Lens Chain public RPCs are Lens-operated. The read is permissionless — no API key, no
registration — but it is **not infrastructure-independent** in the way a read against a
multi-client chain is. That distinction is worth keeping in view when weighing how much this
credential should ever be allowed to carry.
