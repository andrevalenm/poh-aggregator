# Humanity Protocol

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). The docs, contract addresses, and the June 2026
> security incident survived. Team, funding detail, GitHub commit activity, and npm package
> verification are gaps.

**One-liner:** Palm-biometric personhood project ($H, Humanity Chain) that in practice ships as a
broad credential-aggregation oracle, where palm verification is one claim among dozens.
**Category:** liveness / behavioral, aspiring to uniqueness — **not** demonstrated uniqueness
**Chains:** Humanity Chain mainnet (chainId `6985385`), Humanity testnet (chainId `7080969`)
**Status (2026-07):** **mainnet offline.** Hacked 2026-06-08, ~$32–36M drained via stolen private
keys, token −80%, old token contracts sunsetted, network being relaunched.
**Aggregator verdict:** **integrate later — do not build on this now.** Two independent blockers:
the network is down, and verification is a *trusted off-chain oracle*, not something we can verify
ourselves. Revisit after relaunch. There is also a strategic wrinkle worth noting: it is partly a
competitor, since it aggregates credentials itself.

## Status first — the network is down

From the official docs at the time of capture
([Network Information — Mainnet](https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet.md)),
a `danger` banner:

> "Mainnet temporarily offline. Humanity Mainnet is being relaunched with updated infrastructure
> following a security incident. Network values below remain accurate but the network is not
> currently available for transactions. It will be restored in the coming weeks with the new H token
> as its native gas token."

Incident report: [@Humanityprot status 2066825020530127313](https://x.com/Humanityprot/status/2066825020530127313).

Secondary reporting (labelled as such — the agent died before reading the primary incident report):

- [CoinDesk, 2026-06-09](https://www.coindesk.com/tech/2026/06/09/humanity-protocol-token-crashes-more-than-80-after-a-usd32-million-private-key-hack):
  "$32 million private-key hack," token down >80%, attackers "stole private keys tied to the project
  and drained over $30 million from at least 17 wallets."
- A separate summary gives **$36 million on 2026-06-08**, after which "the team sunsetted the old H
  token contracts and deployed a newly audited ERC-20 token on Ethereum."

> `UNCLEAR:` the $32M vs $36M discrepancy and the exact date (2026-06-08 vs 06-09) are unresolved —
> different secondary sources. Read the primary incident report before citing a figure.

**This was a private-key compromise, not a protocol break.** That distinction matters for our
assessment: it does not directly impugn the palm biometrics or the credential design. But for a
project whose entire value proposition is custody of biometric-derived identity, an operational
key-management failure of this size is squarely relevant to whether we trust it as a credential root.

## What it proves

Officially: that a unique live human enrolled a palm. In practice, **the on-chain surface treats palm
verification as one boolean claim among ~40**, and most of the others have nothing to do with
personhood. The full claim list from the
[Credentials Verification Service](https://docs.humanity.org/build-with-humanity/build-on-chain/credentials-verification-service.md):

| Category | Claim IDs |
|---|---|
| Personhood | `humanity_identity` ("User has verified via Palm check") |
| Social | `github_connected`, `google_connected`, `discord_connected`, `twitter_connected`, `linkedin_connected`, `telegram_connected`, `email_verified` |
| Identity/Finance (Mastercard) | `mc_kyc`, `mc_residency`, `mc_net_worth` ($100/$10K/$1M+ tiers), `mc_investments`, `mc_retirement`, `mc_mortgage` |
| Airline loyalty | `delta_membership`, `emirates_membership`, `singapore_airlines_membership`, `american_airlines_membership`, `cathay_pacific_membership`, `korean_air_membership`, `jetblue_membership`, `thai_airways_membership`, `virgin_australia_membership`, `frontier_airlines_membership`, `spirit_airlines_membership`, `etihad_membership`, `ryanair_membership`, `sas_membership` |
| Hotel loyalty | `marriott_membership`, `hilton_membership`, `accor_membership`, `wyndham_membership`, `radisson_membership`, `shangri_la_membership`, `taj_hotels_membership` |
| Casino | `caesars_membership`, `mgm_resorts_membership`, `wynn_resorts_membership` |
| CEX | `binance_finance`, `okx_finance` |

**Read that table again and note what it means for us.** `humanity_identity` sits in the same flat
namespace as `ryanair_membership`. Humanity Protocol is not primarily a personhood protocol with side
features — the shipped product is a **credential aggregator with a palm-scan option**. That makes it
partly a *competitor* to what we are building, not merely a source. It is also a useful signal about
where the commercial pull actually is (KYC and loyalty data, not personhood).

For our scoring: only `humanity_identity` is personhood evidence. The `mc_kyc` claim is
state-identity-adjacent but the trust root is Mastercard, not Humanity. Social claims are
account-ownership, the weakest tier in our taxonomy. Loyalty claims are irrelevant to personhood.

## Trust root & failure modes

The biometric story has a **claims-versus-evidence gap that should be treated skeptically**:

- **Phase 1 is palm *print*, not palm vein** — "a palm print recognition software program that can be
  installed on users' smartphones," capturing an "RGB image using a smartphone camera in natural
  light." This is a photograph of a palm. It is plainly weaker than iris or NFC-chip document reading,
  and a photo is a far easier spoofing target than a live vein scan.
- **Phase 2 is palm vein**, requiring "a specialized (but still low-cost and easily accessible) device
  with an infrared camera." Hardware "initially available at select crypto events."
- **The headline accuracy number is not theirs.** The whitepaper cites a **Fujitsu** study for
  "a false acceptance rate of less than `0.00008%` and a false rejection rate of `0.01%`." That
  describes palm-vein technology in general, under lab conditions, **not a measurement of Humanity
  Protocol's own system, and emphatically not of Phase 1 smartphone palm prints.** Do not carry that
  FAR into a scoring model.
- Training data: "over 500,000 palm print and palm vein features, collected using HP hardware."

Privacy claims (unaudited, as stated): raw palm images "are never stored or transmitted"; capture is
converted locally into "a protected biometric template through irreversible feature extraction."
Encrypted VC metadata are "atomized and stored on Walrus on the SUI blockchain and on IPFS,
preventing any single entity from having a full set."

Structural failure modes:

1. **Verification is a trusted oracle.** See below — the "Oracle backend checks user credentials"
   off-chain. Compromise the backend and every on-chain attestation is forgeable. Given that a
   key-compromise incident already occurred, this is not hypothetical.
2. **Permissioned validator/proofer set** — "Each node must possess a zkProofer Node License."
   Verification capacity is gated behind a purchased NFT license with KYC requirements.
3. **Issuer concentration** — "Identity Validators (Issuers) are the entities that check the private
   data submitted by users and issue verifiable credentials."

> **GAP.** The regulatory analysis the agent was asked for — GDPR Art. 9, BIPA, India DPDP exposure
> for palm biometrics — was never run. Nor were team, funding, or GitHub commit-activity checks. For
> a project whose status is "recovering from a $30M+ hack," the momentum question is important and
> currently **unanswered**. Known only: backed by Animoca Brands and Polygon Labs (secondary source,
> Cointelegraph); testnet had "over two million participants"; $H is a 10 billion fixed-supply ERC-20
> launched 2025-06-25.

## On-chain surface

Two contracts, both simple, both pointing at an off-chain oracle:

| Contract | Mainnet (`6985385`) | Testnet (`7080969`) |
|---|---|---|
| `HumanityVerificationOracle` | `0x8D71D8bD47860bd0381b272AE42162c3692c4F3a` | `0x67c0A5cA2Fb19E8E0Ff008d727aff5f128b00E09` |
| `FeeEscrow` | `0xe433f01131eAbD8060a1E34149eF0e79b2b86fEc` | `0x1a247b7d7076e4c4D97D87c62947Ab5495C13423` |

Network details — mainnet RPC `https://humanity-mainnet.g.alchemy.com/public`, explorer
`explorer.humanity.org`, gas token `H`; testnet RPC `https://humanity-testnet.g.alchemy.com/public`,
explorer `humanity-testnet.explorer.alchemy.com`, gas token `tHP`,
[faucet](https://www.alchemy.com/faucets/humanity-testnet).

**The verification flow is request/callback against a trusted backend**, per the docs' own six steps:
user signs an authorization → your contract calls the Oracle → "Oracle backend checks user
credentials" **off-chain** → "Oracle creates an on-chain attestation and calls your contract's
`onVerificationComplete` callback."

There is a read path, `oracle.isUserVerified(user, claims, maxAge)`, which the docs recommend calling
before paying for a fresh request.

**This is the single most important integration fact: there is no permissionless verification.** We
cannot independently check a Humanity credential the way we can verify a World ID ZK proof or read a
Circles trust edge. We would be trusting Humanity's backend and paying them per query. That is a
qualitatively weaker position than every other protocol assessed so far.

## Integration surface

Two paths — web2 OAuth, or on-chain oracle.

**Web2:** OAuth 2.0, explicitly modelled on "Google or Stripe." Packages
`@humanity-org/react-sdk` (components + hooks, `HumanityProvider`, `HumanityGate`,
`HumanityProfile`) and `@humanity-org/connect-sdk` (OAuth/PKCE, query engine). Sandbox at
`app.sandbox.humanity.org`, developer portal issues API credentials.
> `UNVERIFIED:` the npm packages were **never confirmed to exist** — the agent noted "let me verify
> the npm packages and GitHub activity" and was killed before doing so. These names come from doc
> page titles only. Check the registry before depending on them. Licenses unknown.

**On-chain:** prepaid fee escrow. The dApp deposits gas-token into `FeeEscrow`; "Verification fees
are deducted automatically per successful verification. **Users never pay fees directly.**" Fee
lifecycle is RESERVE → (verify) → SETTLE, with the fee released back on failure. Fee split on
success: **25% credential issuers / 25% protocol treasury / 25% staking pool / 25% proof generation**.

So **we** would carry the per-verification cost for every user we route through Humanity. That is a
direct unit-economics input for the aggregator and unlike Circles (free to read) or World ID
(on-chain verification costs only gas).

> `UNVERIFIED:` **the actual fee amount is nowhere in the salvaged material.** The docs describe the
> mechanism thoroughly and never state a price. Read `verificationFee` from the deployed contract, or
> ask. Also unverified: rate limits, and whether production API access requires a business agreement.

Errors worth knowing: `InsufficientVerificationFee`, `UnauthorizedRequest` (bad user signature),
`InvalidUser`, `NoClaimsSpecified`, `RequestNotFound`.

## Privacy model

W3C standards-based on paper: "Humanity is built on the open standards of DID and VC." Credentials
carry issuer, holder identity, VC type, and constraints (expiration, scope). ZK presentations
("customized ZK proof (VP)") are supported for selective disclosure. Revocation is "an encrypted
Merkle Tree in Humanity on-chain smart contracts."

But the *on-chain oracle* path does not appear to be zero-knowledge in practice — it produces an
on-chain attestation that a given wallet satisfies named claims, written by a trusted backend. The ZK
machinery is described in the whitepaper; the shipped verification service reads as a conventional
oracle. `UNCLEAR:` how much of the zkProofer/ZKP architecture is live versus roadmap. Given the
whitepaper's Phase 1 / Phase 2 framing throughout, assume less is live than the marketing implies,
and verify before crediting it.

Nullifier semantics: **none documented.** There is no described mechanism preventing linkage of the
same human across different dApps — verification is keyed to a wallet address, and the oracle knows
the mapping. Compare unfavourably with World ID's app-scoped nullifiers.

## Scoring-relevant facts

- `MAX_VERIFICATION_AGE_SECONDS` is a caller-supplied freshness bound; the scaffold defaults to
  `2592000` (30 days). Docs recommend 1–7 days for financial, 30 for access control, 90+ for
  preferences. **We get to choose the staleness tolerance per query**, which is genuinely useful.
- Claims are independently held — a wallet may have `google_connected` without `humanity_identity`.
  Only the latter counts as personhood evidence.
- Testnet reached "over two million participants" (secondary, undated) — a *testnet* number, and
  airdrop-farming inflated. Not evidence of two million verified humans.

> **GAP.** No verified count of `humanity_identity` holders, no geography, no cost/friction of palm
> enrolment for an end user, no scanner-availability data.

## Overlap with other protocols

- **Mastercard** is the trust root behind all `mc_*` claims. If we ever ingest Mastercard-derived
  KYC from another source, those are correlated, not independent.
- **Social claims overlap with everything** — `github_connected`/`google_connected` are the same
  OAuth-account-ownership signal that Gitcoin Passport and similar scorers already use. High
  double-count risk; weight near zero.
- **Palm biometrics are a unique trust root** in our candidate set — no other protocol we are
  looking at uses palm. That independence is the one genuinely additive thing here, and it is exactly
  the part that is least verifiable by us.
- **Competitive overlap:** the Credentials Verification Service *is* a credential aggregator with an
  on-chain oracle. Worth studying as prior art — see also the landscape write-ups.

## Open questions for us

1. **Does the network come back, and when?** Everything else is moot until then. Re-check
   `explorer.humanity.org` and the incident report.
2. **What is `verificationFee`?** We pay it per lookup; it directly sets whether Humanity can ever be
   a default route in an aggregator or only an on-demand upgrade.
3. **Can we ever verify without trusting their backend?** If not, Humanity is structurally a
   *data vendor* to us rather than a protocol we integrate — and should be scored with an explicit
   trusted-third-party discount.
4. Do `@humanity-org/react-sdk` and `@humanity-org/connect-sdk` actually exist on npm, and under what
   licence?
5. What is the real, measured FAR/FRR of Phase 1 smartphone palm print? The Fujitsu figure is not it.
6. Is production access gated behind a partnership?

## References

Primary:

- [Humanity Docs](https://docs.humanity.org/) · [sitemap](https://docs.humanity.org/sitemap.md) · [llms-full.txt](https://docs.humanity.org/llms-full.txt)
- [Whitepaper](https://docs.humanity.org/whitepaper.md)
- [Credentials Verification Service](https://docs.humanity.org/build-with-humanity/build-on-chain/credentials-verification-service.md)
- [Canonical Contracts](https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts.md) · [IVerificationOracle](https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts/iverificationoracle.md) · [IFeeEscrow](https://docs.humanity.org/build-with-humanity/build-on-chain/canonical-contracts/ifeeescrow.md)
- [Network Information — Mainnet](https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-mainnet.md) · [Testnet](https://docs.humanity.org/build-with-humanity/build-on-chain/network-information-testnet.md)
- [On-Chain QuickStart](https://docs.humanity.org/build-with-humanity/build-on-chain/on-chain-quickstart.md)
- [zkProofer Node](https://docs.humanity.org/zkproofer-node.md)
- [Incident report (X)](https://x.com/Humanityprot/status/2066825020530127313)

Secondary — labelled, and the source of every figure in the incident section:

- [CoinDesk — token crashes >80% after $32M private-key hack](https://www.coindesk.com/tech/2026/06/09/humanity-protocol-token-crashes-more-than-80-after-a-usd32-million-private-key-hack)
- [Messari — Understanding Humanity Protocol](https://messari.io/report/understanding-humanity-protocol-a-comprehensive-overview)
- [Cointelegraph — Animoca, Polygon-backed Humanity Protocol launches ZKP-powered palm recognition](https://cointelegraph.com/news/animoca-polygon-humanity-protocol-zkp)
- [Humanity blog — How Do Palm Scans Work](https://www.humanity.org/blog/how-do-palm-scans-work-on-the-humanity-protocol)
