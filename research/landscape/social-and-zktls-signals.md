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


## Verdict
## Overlap with other protocols
## Open questions for us
## References
