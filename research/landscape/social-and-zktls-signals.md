# Social-platform signals & zkTLS / web-proof protocols

> STATUS: in progress (started 2026-07-24)

**One-liner:** Machinery for proving facts about web2 accounts to a chain without the platform's
cooperation (TLSNotary / Reclaim / zkPass / Opacity / Primus / Pluto / Clique), plus an honest
valuation of the social signals themselves.
**Category:** behavioral (weakest tier in BRIEF.md taxonomy) — zkTLS is a *transport*, not a
personhood claim; the personhood value is entirely in the underlying platform signal.
**Chains:** see per-protocol sections
**Status (2026-07):** TBD
**Aggregator verdict:** TBD

## Part A — zkTLS / web proofs: the mechanism
### A.0 Taxonomy of security models
### A.1 TLSNotary
### A.2 Reclaim Protocol
### A.3 zkPass
### A.4 Opacity
### A.5 Primus (ex-PADO)
### A.6 Pluto
### A.7 Clique
### A.8 Other / 2025-26 entrants
### A.9 Adversarial reality: do platforms break this?
### A.10 Legal exposure

## Part B — The social signals themselves
### B.1 X / Twitter
### B.2 Farcaster

**All numbers in this section were measured by me directly against public RPC on 2026-07-24**
(`https://mainnet.optimism.io`, `https://mainnet.base.org`), independently of the prior agent. They
confirm the prior agent's figures.

#### Contracts and measured values

| Contract | Chain | Address | Call | Raw result | Decoded |
|---|---|---|---|---|---|
| IdRegistry | OP Mainnet (10) | `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` | `idCounter()` `0xeb08ab28` | `0x3304d4` | **3,343,572 FIDs** |
| IdGateway | OP Mainnet | `0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69` | `price()` `0xa035b1fe` | `0x6130e29347e1` | 106,862,587,627,489 wei = **0.00010686 ETH** |
| StorageRegistry | OP Mainnet | `0x00000000fcCe7f938e7aE6D3c335bD6a1a7c593D` | `usdUnitPrice()` `0x40df0ba0` | `0x1312d00` | 20,000,000 @ 8dp = **$0.20 / unit / yr** |
| TierRegistry | Base (8453) | `0x00000000fc84484d585C3cF48d213424DFDE43FD` | `tierInfo(1)` `0xa267c2c4` | see below | **$120.00 / yr** |

`tierInfo(1)` decoded: `minDays = 30`, `maxDays = 365`,
`vault = 0x36b3d3bdf4f7933892e18b79ac867d4f901c9790`,
`paymentToken = 0x833589fcD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC on Base),
`tokenPricePerDay = 328767` (6dp) = **0.328767 USDC/day = $119.9999/yr**, `isActive = true`.
So Farcaster Pro is $120/yr, minimum purchase 30 days ($9.86), maximum 365 days.

The prior agent read `idCounter() = 3,343,569`; I read **3,343,572**. The 3-FID delta is the
registration rate, and that is itself the finding — see below.

#### The registry growth curve — I sampled `idCounter()` at ~monthly intervals via archive `eth_call`

| Date (UTC) | idCounter | Δ month |
|---|---|---|
| 2025-07-24 | 1,138,613 | — |
| 2025-08-28 | 1,313,298 | +174,685 |
| 2025-09-27 | 1,355,951 | +42,653 |
| 2025-10-27 | 1,418,554 | +62,603 |
| 2025-11-26 | 1,536,964 | +118,410 |
| 2025-12-26 | 1,947,903 | **+410,939** |
| 2026-01-25 | 2,471,987 | **+524,084** |
| 2026-02-24 | 2,838,191 | **+366,204** |
| 2026-03-26 | 3,131,036 | +292,845 |
| 2026-04-25 | 3,321,683 | +190,647 |
| 2026-05-25 | 3,333,225 | **+11,542** |
| 2026-06-24 | 3,338,652 | +5,427 |
| 2026-07-24 | 3,343,572 | +4,920 (~164/day) |

**Read this curve.** Between 2025-07 and 2026-04, the registry added **2.18 million FIDs — it
tripled** — with a Dec-2025-to-Mar-2026 peak of 300k–520k new FIDs *per month*, i.e. up to
~17,000/day. Then in late April 2026 registration collapsed by a factor of ~40 to ~5,000/month and
has stayed there for three consecutive months.

A curve that goes 17,000/day → 164/day in a few weeks is not organic user adoption changing its
mind. It is **an incentive being switched off**. Whatever was paying for those registrations
(`UNCLEAR:` which program specifically — candidates are a points/airdrop season or a client-side
onboarding subsidy; worth pinning down) stopped, and with it ~2 million of the 3.34 million FIDs
became suspect in a single stroke.

Corroborating cost: the storage price cut to **$0.20/yr** (from roughly $7 before 2025-07-16) landed
*immediately before* the surge. Registration at ~$0.40 + $0.20/yr storage means a 10,000-FID farm
costs **~$4,000 one-off + $2,000/yr** — trivially within reach of anyone farming an airdrop worth
more than $0.60 a wallet.

#### What a raw FID is worth: approximately zero

- Attacker cost per FID ≈ **$0.40 + $0.20/yr**. That is *below* the cost of a fresh Reddit account
  and roughly equal to a bulk X account.
- FID number is **not** a reliable age proxy any more. "FID < 20,000" once meant an early adopter;
  low FIDs are also *transferable* — `IdRegistry` supports `transfer()`, so low FIDs are a traded
  asset. `UNVERIFIED:` current OTC price for a sub-10k FID — check Farcaster OTC channels / OpenSea
  wrappers.
- ~65% of the registry was created inside a nine-month subsidy window. Any scoring rule keyed on
  "has a FID" is scoring that window.

#### What *is* the right way to read Farcaster for personhood

The registry is nearly free, so **stop reading the registry and read the things that cost something
scarce**. In rough descending order of evidential value:

1. **Farcaster Pro ($120/yr, on-chain, verifiable via `TierRegistry` on Base).** This is the only
   Farcaster signal with a real, recurring, on-chain-verifiable price. $120/yr means a 10,000-account
   farm costs $1.2M/yr — an actual deterrent. **Precision high, recall catastrophically low**: only
   a small fraction of real Farcaster users pay for Pro (`UNVERIFIED:` no public subscriber count
   found; derivable by indexing `TierRegistry` purchase events on Base — that is the single most
   valuable thing to go measure). Use it as a **bonus signal, never as a requirement**.
2. **Verified Ethereum addresses (`verifications` / `VerificationAddEthAddress` messages).** A FID
   that has cryptographically bound an address with real on-chain history inherits that address's
   cost-to-fabricate. This is the cheapest useful upgrade over raw FID, and it is what makes
   Farcaster interesting to us at all: it is a *bridge* from a social handle to an address whose
   history we can independently price.
3. **Inbound social-graph edges from already-scored accounts.** Follows are free, so raw follower
   count is worthless; what is not free is being followed by accounts that *themselves* pass an
   expensive check. This is PageRank-over-a-verified-seed-set, not a follower threshold. It is the
   only follower-graph reading that survives the $0.20/yr registry.
4. **Sustained authored casts with organic reply structure over years**, weighted by whether the
   repliers are independently scored. Expensive to fake *convincingly at scale*; cheap to fake for
   one account. So it is a decent *farm detector* (farms produce structurally identical accounts)
   and a poor *individual credential*.
5. **Raw FID / FID recency / storage rented: ignore.** Actively misleading given the curve above.

The honest summary: Farcaster gives us a cheap **address-to-handle binding** and one genuinely
costly signal (Pro). Everything else in Farcaster is a graph-shape input to a *farm-detection*
model, not a personhood credential — and farm detection is a different product from personhood
attestation. See the Verdict.

### B.3 Lens
### B.4 Discord / Telegram
### B.5 Reddit
### B.6 GitHub
### B.7 Google / Apple / Microsoft OAuth
### B.8 The aged-account market (price table)

**This is the most important table in the file.** For a purchasable credential, the market price of a
convincing fake *is* the security level. If an aggregator awards N points for "X account older than
2018", an attacker's cost per sybil for those N points is the price below.

All prices retail, single-unit, from AccsMarket (a public, non-darkweb bulk-account marketplace),
checked 2026-07-24. Bulk pricing is lower; these are upper bounds on attacker cost.

#### X / Twitter — [accsmarket.com/en/catalog/twitter/s-otlezhkoj-17](https://accsmarket.com/en/catalog/twitter/s-otlezhkoj-17) (fetched 2026-07-24)

| Registration year | Verification state | USD / account |
|---|---|---|
| 2025 | email (mail.com) | $0.185 |
| 2024 | email (outlook/hotmail) | $0.167–0.222 |
| 2023 | email (outlook/hotmail) | $0.204–1.48 |
| 2022 | email (outlook/hotmail) | $1.11–1.85 |
| 2021 | email (gmx.com) | $1.11–2.04 |
| 2016 | email (outlook/hotmail) | **$1.83** |
| 2007 | email (gmx/outlook) | $18.50–46.25 |

Min observed $0.022 (2023, rambler-verified, out of stock); max $46.25 (2007, hotmail).
Fresh "softreg" accounts on the main catalog run **$0.018–1.48**
([accsmarket.com/en/catalog/twitter](https://accsmarket.com/en/catalog/twitter), fetched 2026-07-24).

**Read this carefully: a ten-year-old X account costs about two dollars.** "Account age > 8 years"
is therefore worth roughly $2 of attacker cost per sybil. Only the 2007-vintage tail (~$20–46) is
genuinely scarce, and that scarcity is supply-side (few 2007 accounts exist), not
identity-side — one attacker can still buy hundreds.

#### Reddit — [accsmarket.com/en/catalog/reddit](https://accsmarket.com/en/catalog/reddit) (fetched 2026-07-24)

| Vintage | State | USD / account |
|---|---|---|
| softreg (new) | email-verified, EU IP | $0.555 |
| softreg | email-verified + 2FA, USA IP | $0.74 |
| 02.2024 | unverified, EU IP | $0.685 |
| 01.2023 | unverified, EU IP | $0.925 |
| 2022 | unverified, USA IP | $1.39 |
| 2021 | email-verified, USA IP | $8.33 |
| 2019 | unverified, USA IP | $27.71 |
| 2020 | unverified, USA IP | $27.75 |
| 2012–2015 | email-verified | **$185–277.50** |

Reddit is the *most expensive* aged account in this table by an order of magnitude — a 2012-vintage
account is ~$200–280, ~100× the equivalent-age X account. Reddit's aggressive shadowbanning and
account-age-gated subreddits create real supply scarcity. Note the listings mostly do **not**
specify karma; karma is bought separately (see B.5).

#### GitHub

`UNVERIFIED (soft):` Aged-GitHub-account sellers advertise **~$50 basic to $300+ premium** for aged
accounts with contribution history (secondary sources: accslist.com, websellsmm.com, PlayerUp
listings, all SEO-spam-grade vendors — treat as an order-of-magnitude figure, not a quote).
PlayerUp runs an escrow ("middleman") service for GitHub account sales
([playerup.com/accounts/githubaccount](https://www.playerup.com/accounts/githubaccount/)).
GitHub ToS prohibits account transfer.
`TODO:` get a real quote from SWAPD or PlayerUp completed-sale history rather than vendor ad copy.

#### Discord — [accsmarket.com/en/catalog/games/discord](https://accsmarket.com/en/catalog/games/discord) (fetched 2026-07-24)

| Tier | USD / account |
|---|---|
| basic, email-verified only | $0.22–0.37 |
| SMS-verified + avatar | $0.46–0.64 |
| aged 2022–2023 | $2.04–3.61 |
| aged 2017–2020 | $2.44–5.55 |

Full observed range $0.031–9.25. **A 2017-vintage Discord account is under $6.** Discord tenure is
worth essentially nothing as personhood evidence.

#### Telegram — [accsmarket.com/en/catalog/telegram/telegram-s-otlezhkoj](https://accsmarket.com/en/catalog/telegram/telegram-s-otlezhkoj) (fetched 2026-07-24)

| Registration year | Country | USD / account |
|---|---|---|
| 2025 | USA | $1.30–6.94 |
| 2024 | USA | $1.67–3.33 |
| 2023 | USA | $4.35–8.88 |
| 2022 | USA | $12.95 |
| 2021 | USA | $14.62 |
| 2020 | USA | $17.58 |
| 2019 | USA | $24.05 |

Range $0.685–99.90. Telegram is meaningfully more expensive than X or Discord because every account
is bound to a **phone number** — you are really pricing SIM supply, not Telegram. This makes Telegram
tenure a partial proxy for the phone-number signal, and therefore **correlated with, not independent
of, any phone-verification protocol in the aggregate** (see Overlap).

#### Gmail / Google — [accsmarket.com/en/catalog/gmail](https://accsmarket.com/en/catalog/gmail) (fetched 2026-07-24)

| Tier | USD / account |
|---|---|
| basic softreg, unverified | $0.08–0.37 |
| SMS-verified (PVA) | $0.352–1.11 |
| with 2FA / app passwords | $1.30–6.70 |

Range $0.08–7.97. **A phone-verified Google account — the thing behind "Sign in with Google" —
costs about 35 cents to a dollar.**

#### Farcaster / Lens (on-chain, so priced by protocol not by market)

| Signal | Cost to attacker | Source |
|---|---|---|
| Farcaster FID registration | 0.0001069 ETH one-off (~$0.30–0.45) | `IdGateway.price()`, measured on-chain 2026-07-24 |
| Farcaster storage unit | **$0.20 / yr** | `StorageRegistry.usdUnitPrice()` = 20000000 (8dp) |
| Farcaster Pro | **$120.00 / yr** | `TierRegistry.tierInfo(1)` on Base, measured 2026-07-24 |
| Lens account (Lens Chain) | `UNVERIFIED:` see B.3 | |

#### Summary — attacker cost per sybil, for the strongest variant of each signal

| Credential an aggregator might reward | Attacker's marginal cost per sybil |
|---|---|
| Google account, phone-verified (OAuth login) | **$0.35–1.11** |
| X/Twitter account, any | **$0.02–0.22** |
| X/Twitter account, ≥ 10 years old (2016) | **$1.83** |
| X/Twitter account, ≥ 19 years old (2007) | $18.50–46.25 |
| X/Twitter Premium (blue check) | $8/mo retail = **$96/yr** (see B.1) |
| Discord account, 2017 vintage | **$2.44–5.55** |
| Telegram account, 2019 vintage | **$24.05** |
| Farcaster FID | **~$0.30–0.45** one-off + $0.20/yr |
| Farcaster Pro | **$120/yr** |
| Reddit account, 2019 vintage | **$27.71** |
| Reddit account, 2012–2015 | **$185–277.50** |
| GitHub account with contribution history | `UNVERIFIED:` ~$50–300 |

**The whole social-signal category tops out around $100–300 per sybil, and most of it is under $5.**
For comparison, the state-ID and biometric protocols in this landscape cost an attacker a *document
or a face*, which is either not for sale at all or costs far more per unit. That ratio is the entire
argument for how to weight this category.


## Verdict
## Overlap with other protocols
## Open questions for us
## References
