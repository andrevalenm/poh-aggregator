# Identity infrastructure prior art — the graveyard and the survivors

**Scope:** prior attempts at a crypto/web identity + credential aggregation layer, what happened to
each, and what that implies for a proof-of-humanity aggregator. Written for poh-aggregator (see
`../BRIEF.md`). This is a *landscape* file: compact per-project subsections (status / what it was /
cause of death or survival mechanism / lesson), then a hard synthesis.

**Out of scope (covered by other agents):** BrightID, Idena, Proof of Humanity, World ID, Gitcoin
Passport-as-a-protocol.

## Repo vitals snapshot (via GitHub API, 2026-07-24)

| Repo | Archived | Last push | Stars | Read |
|---|---|---|---|---|
| `decentralized-identity/veramo` | no | **2026-07-24** | 543 | alive, active today |
| `decentralized-identity/ion` | no | **2023-08-25** | 1,229 | ~3 years cold = dead |
| `ceramicnetwork/js-ceramic` | no | 2025-10-20 | 425 | maintenance-only |
| `ceramicstudio/js-composedb` | no | 2024-07-26 | 94 | ~2 years cold = dead |
| `spruceid/siwe` | no | 2025-05-30 | 1,116 | stable/finished spec impl |
| `spruceid/rebase` | **archived** | 2024-06-05 | 20 | dead |
| `spruceid/ssi` (Rust core) | no | **2026-07-20** | 262 | alive, active |
| `ethereum-attestation-service/eas-contracts` | no | **2026-07-16** | 318 | alive |
| `lens-protocol/core` | no | 2025-09-18 | 2,841 | superseded by Lens Chain repos |
| `farcasterxyz/protocol` | no | **2026-06-18** | 2,223 | alive |

(Commands: `gh api repos/<owner>/<name>`. Numbers are volatile; date-stamped 2026-07-24.)

---

## 1. uPort → Serto / Veramo

**Status (2026-07):** uPort dead (2021). Serto — UNVERIFIED, appears dormant. **Veramo alive and
actively developed** (last push 2026-07-24, now under the `decentralized-identity` GitHub org, i.e.
donated to DIF rather than kept as a company asset).

**What it was.** uPort (2016–2021) was ConsenSys' flagship self-sovereign identity stack: an Ethereum
smart-contract identity (proxy contract + registry), a mobile wallet, and JWT-based verifiable
claims (`did:ethr`). It was *the* web3 identity project of the 2017–2019 cycle.

**What happened.** In 2020 the project split in two: **Veramo** (the open-source, unopinionated
DID/VC framework) and **Serto** (the commercial product/company), announced in
["Veramo: uPort's Open Source Evolution"](https://medium.com/uport/veramo-uports-open-source-evolution-d85fa463db1f)
and ["uPort is now Serto"](https://serto.medium.com/uport-is-now-serto-df9c73d545e6).
All uPort libraries were deprecated 2021-05-01, downloads pulled 2021-12-30, and the hosted
infrastructure behind `uport-connect` was **shut off 2021-06-01** — i.e. every app that had
integrated uPort broke. `uport-project/uport-connect` is archived.

**Cause of death (uPort).** No verifier demand. uPort shipped issuance + wallet before anybody had a
reason to *ask* for a uPort credential; the mobile-wallet-first model meant every integration cost a
consumer download. It also depended on ConsenSys funding, and when ConsenSys reorganised toward
MetaMask/Infura revenue the identity line had no P&L to defend itself with.

**Why Veramo survived.** It stopped being a product and became a **library**: a modular TypeScript
agent framework (plugins for `did:ethr`, `did:key`, `did:web`, `did:pkh`, JWT-VC, SD-JWT, etc.) with
no hosted dependency, no token, and no network to keep running. Donated to DIF, so its survival no
longer depends on one company's budget. It is used inside other people's products rather than
competing for end users.

**Lesson for us.** The *library* outlived the *network* and the *wallet*. Anything we build that
requires users to install something new, or that requires our servers to be up for a verification to
succeed, inherits uPort's death condition. Zero-infrastructure verification paths are survival
features, not nice-to-haves.

---

## 2. Microsoft ION / Sidetree

**Status (2026-07): effectively dead as a Microsoft product line.**
`decentralized-identity/ion` last pushed **2023-08-25** — no code activity for ~3 years.

**What it was.** ION = Identity Overlay Network, a **public permissionless DID network** implementing
the **Sidetree** protocol as a layer-2 over **Bitcoin**: DID operations are batched, anchored as a
hash in a Bitcoin transaction, with payloads in IPFS. Launched to mainnet ("v1") in March 2021
([Microsoft/Redmondmag, secondary](https://redmondmag.com/articles/2021/03/31/microsoft-ion-for-decentralized-identities.aspx)).
It was the most credible attempt at a *permissionless, no-token* identifier registry — no
consortium, no membership fee, anyone can anchor.

**What happened.** Microsoft's commercial product, **Entra Verified ID**, moved off `did:ion` to
`did:web`. Microsoft Learn's Entra Verified ID "what's new" documents that the option to select
`did:ion` as the trust system is removed and **`did:web` becomes the only available trust system**
([Microsoft Learn — Entra Verified ID what's new](https://learn.microsoft.com/en-us/entra/verified-id/whats-new)),
with the P-256K (secp256k1, non-FIPS) signing keys retired **2026-07-01**. `did:web` is DNS + HTTPS:
a plain well-known JSON file on a domain you control.

**Cause of death.** ION solved decentralisation of the *identifier*, which turned out to be the part
nobody was paying for. Enterprise buyers wanted an auditable, revocable, corporate-controlled issuer
— and `did:web` gives that with zero new infrastructure. Bitcoin anchoring added latency (~10s of
minutes to hours for confirmation), operational cost (running an ION node needs a full Bitcoin node +
IPFS), and no compensating benefit for the actual customer. Also: secp256k1 was a **compliance**
blocker (non-FIPS) for exactly the government/enterprise buyers who fund identity.

**Lesson for us.** The market picked the *least decentralised option that still had the standards
label* (`did:web`). When decentralisation costs the buyer something and buys them nothing they can
name, it loses. Also note the pattern: Microsoft did not announce ION's death, it just stopped
being an option in the product and the repo went quiet. Expect the same silent failure mode from
protocols we integrate — **absence of a shutdown announcement is not evidence of life**.

---

## 3. Sovrin / Hyperledger Indy / Aries

**Status (2026-07): dead.** The **Sovrin Foundation was dissolved by the State of Utah on
2025-05-21** ([Sovrin — "The Sovrin Foundation Has Been Dissolved"](https://sovrin.org/the-sovrin-foundation-has-been-dissolved-but-sovrin-mainnet-remains/)).
The MainNet ledger survives only as a **read-only archive on a single cloud server**, with
**Trinsic** (Riley Hughes, ex-Sovrin) acting as caretaker. Write keys are gone; **no new credentials
can be issued**.

**What it was.** The flagship self-sovereign-identity consortium: a permissioned public ledger
(Hyperledger Indy) run by ~50+ "Stewards" (banks, universities, telcos, governments), governed by
the Sovrin Governance Framework — a large legal/trust-framework document stack — and using AnonCreds
(CL-signature ZK credentials with selective disclosure and predicate proofs). Hyperledger Aries was
the agent/protocol layer, later spun out (AnonCreds became its own Hyperledger project; Aries
components moved to the OpenWallet Foundation).

**Cause of death — this is the important one.** Per Sovrin's own announcement
([shutdown notice](https://sovrin.org/sovrin-foundation-mainnet-ledger-shutdown-likely-on-or-before-march-31-2025/))
and secondary reporting ([ID Tech Wire — "The Community Moved On"](https://idtechwire.com/the-community-moved-on-sovrin-announces-mainnets-likely-shutdown/),
[cheqd — Sovrin mainnet shutdown](https://cheqd.io/blog/sovrin-mainnet-shutdown-what-it-means-for-your-ecosystem/)):
- **No new Transaction Endorsers joined in 2024** — the write side of the network stopped growing.
- Steward attrition: nodes were run as charity by member orgs; when identity budgets got cut, node
  operators left. Running a node had cost and no revenue.
- Governance overhead consumed the resources: "limited involvement from the Steward community in
  governance" while the Foundation still had to maintain the framework, TestNet, and legal apparatus.
- Financial exhaustion. (Note: the "$2M debt" figure appears in secondary coverage; Sovrin's own
  dissolution post only mentions "just under $10,000 USD" paid to the SBA for a COVID EIDL loan.
  `UNCLEAR:` treat the $2M figure as unconfirmed — I could not find it in a primary Sovrin document.)
- Regulatory uncertainty (GDPR + immutable ledger; eIDAS 2.0 pulling Europe toward a different,
  EU-governed stack).

**Lesson for us — the governance trap.** Sovrin built ten years of governance framework, trust
framework, steward agreements and legal opinions *before* there was credential demand. Governance is
a fixed cost that scales with participants and produces nothing a user can see. Every hour spent on
"who is allowed to be an issuer in our federation" is an hour not spent making one verifier's
conversion rate go up. **We must not build a governance framework.** Our issuer set should be a
config file we control, versioned publicly, changeable in an afternoon — not a consortium.

**Second lesson — dependency risk.** A protocol we integrate can go read-only. If our aggregate
score depends on live reads against someone else's ledger, and that ledger's write keys are
destroyed by a foundation dissolution, our score silently freezes. We need per-source liveness
monitoring and an explicit "stale source" state in the score.

---

## npm reality check (last 30 days to 2026-07-23, api.npmjs.org)

Downloads are the least gameable liveness signal available for a library.

| Package | Downloads / month | Read |
|---|---:|---|
| `siwe` | **1,058,179** | SIWE is the de facto web3 auth standard, by an order of magnitude |
| `did-jwt` | 349,443 | uPort's original JWT lib — outlived uPort itself |
| `@veramo/core` | 102,028 | real, sustained library usage |
| `@ethereum-attestation-service/eas-sdk` | 36,837 | modest but real |
| `@ceramicnetwork/http-client` | 22,022 | small, and now on a deprecated stack |
| `@spruceid/ssx` | **68** | SSX (Spruce's SIWE session product) is commercially dead |

The single most instructive row: **`siwe` = 1.06M/mo, `@spruceid/ssx` = 68/mo.** Spruce won the
standard completely and monetised none of it. The free, unbundled, no-account-needed primitive
travelled everywhere; the product built on top of it went nowhere.

---

## 4. Spruce ID — SIWE, SSX, Rebase, Credible, and the government pivot

**Status (2026-07): alive, and the healthiest survivor in this document — but not as a web3
company.** `spruceid/ssi` (Rust core) last push **2026-07-20**; `spruceid/siwe` last push 2025-05-30
(stable, spec is finished); `spruceid/rebase` **archived 2024-06-05**.

### 4a. SIWE / EIP-4361 — the one unambiguous win

Sign-In With Ethereum, [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361), authored by Spruce with
ENS/Ethereum Foundation funding. It standardised a human-readable message format for
"prove you control this address to this domain, with a nonce and expiry." That is all it does.

Why it won:
- **It is a message format, not a service.** No server of Spruce's is in the path. No API key.
  No rate limit. Nothing to shut down.
- It formalised something everybody was already doing badly (each dapp hand-rolling
  `personal_sign` auth with replay bugs and phishable blank messages).
- It is verifiable **offline, with no cooperation from the issuer** — the exact property BRIEF.md
  asks us to look for.
- Wallets integrated it because it made *their* users safer (readable messages), not because of
  a token incentive.

1.06M npm downloads/month (2026-07) vs. 68/month for Spruce's own commercial `ssx`.

### 4b. Rebase — dead

Rebase was Spruce's "link your Twitter/GitHub/Discord to your DID" credential witness — i.e. a
**social-account-linking credential aggregator**, the closest structural ancestor of what we are
building on the web3 side. `spruceid/rebase` is **archived** (2024-06-05), 20 stars. Its successor
framing, "Spruce Passport"/Credible-era social linking, did not become a business either.
`UNVERIFIED:` I did not find a formal Rebase post-mortem; the archive flag and star count are the
evidence. **This is a direct negative datapoint for us and we should not skip past it.**

### 4c. Credible / SpruceKit → mDL: the survivor path

Spruce's actual revenue is **government digital identity**, not crypto:
- **California DMV mobile driver's license (mDL)** is built on SpruceID's SpruceKit + Credible
  platform ([SpruceID case study](https://spruceid.com/success-stories/california-dmv-mobile-driver-license),
  [Spruce blog announcement](https://blog.spruceid.com/spruceid-partners-with-ca-dmv-on-mdl/)).
  Secondary reporting puts **>2M mDLs issued as of November 2025**, making CA the largest US issuer;
  Biometric Update reported California quadrupling access in 2026-07
  ([Biometric Update, secondary](https://www.biometricupdate.com/202607/california-quadruples-access-to-mobile-drivers-licenses)).
- **DHS Silicon Valley Innovation Program (SVIP)**: SpruceID won a Phase 1 award of **$199,960**,
  eligible for up to **$1.7M** across four phases, for privacy-preserving digital credential wallets
  and verifiers with USCIS/CBP/DHS Privacy Office
  ([DHS S&T award announcement, 2024-07-08](https://www.dhs.gov/science-and-technology/news/2024/07/08/homeland-security-awards-contracts-six-startups-identify-develop-and-implement),
  [DHS SpruceID page](https://www.dhs.gov/science-and-technology/spruceid)).

Note the standards they actually ship against: **ISO/IEC 18013-5 mDL, W3C VCDM, SD-JWT** — not
`did:ion`, not SBTs, not a token.

**Lessons for us.**
1. The revenue in identity is on the **verifier/issuer enterprise side**, and disproportionately in
   **government-adjacent compliance**, not consumer web3.
2. Owning the standard ≠ owning the business. If our aggregator's value is "we normalised the
   formats," that normalisation is copyable in a weekend once it's documented. **Our moat cannot be
   the schema.** It has to be the integration maintenance burden, the fraud/liveness data, or
   distribution.
3. Rebase is our closest dead ancestor: a general "aggregate a user's credentials from many
   providers" primitive, open-sourced, that nobody paid for. What made it fail is the thing we must
   answer: *who has a budget line for a personhood score, today?*

---

## 5. Ceramic / IDX / ComposeDB / 3ID Connect

**Status (2026-07): pivoted away from identity entirely; the identity-era stack is deprecated.**

**What it was.** Ceramic (3Box Labs) was the "decentralized data network" bet: mutable,
user-controlled streams keyed to a DID, so an app could store and an ecosystem could share a user's
profile/credentials. Layers over time:
- **3Box** (2019) — user profiles on IPFS.
- **3ID Connect / `did:3`** — a cross-chain DID + wallet-based auth so a user's data followed them
  between apps.
- **IDX** — the "identity index," an explicit *aggregation* primitive: a per-DID index mapping
  record types to streams. IDX was deprecated and folded into the "DID DataStore"/Glaze stack,
  which was itself later deprecated.
- **ComposeDB** (2023) — GraphQL database on Ceramic; the last serious attempt to make it a
  developer product.

**What happened.** In **February 2025** 3Box Labs merged with **Textile**, and in **April 2025** the
["The Future of Ceramic" announcement](https://blog.ceramic.network/faq-ceramic-network/) confirmed
**js-ceramic and ComposeDB are deprecated** in favour of `ceramic-one`, with the network repositioned
as "the Intelligence Layer for AI Agents" / Recall. Repo evidence matches: `ceramicstudio/js-composedb`
last push **2024-07-26**; `ceramicnetwork/js-ceramic` last push 2025-10-20 (maintenance).
`@ceramicnetwork/http-client` is at 22k npm downloads/month.

**Cause of death.** Three compounding problems:
1. **Aggregation with nothing to aggregate.** IDX was a beautifully designed index over credentials
   that mostly did not exist. The index layer was built before the credential layer had supply.
2. **Data-availability semantics nobody wanted to reason about.** Ceramic streams had no strong
   ordering/finality guarantees against an adversary; you could not use them as the trust root for
   anything valuable, so they were used for profile pictures and bios — which a database does better.
3. **Repeated stack churn.** 3Box → 3ID → IDX → Glaze → ComposeDB → ceramic-one. Every integrator
   who adopted a layer got deprecated within ~18 months. Developer trust is spent, not renewed.

**Lesson for us — the most direct one in this file.** *We are building an index/aggregation layer.
IDX is exactly our shape, and it died of demand starvation on both sides.* An aggregator's value is
strictly bounded by (supply of credentials the user actually has) × (verifiers who actually gate on
them). If either factor is near zero, elegance of the index does not matter.

Also: **do not make integrators eat a breaking migration.** Our public API surface should be small
enough that we can keep it stable for years while everything behind it churns.

---

## 6. ENS as an identity layer — became naming, not identity

**Status (2026-07): alive and healthy — as a *naming* system.** The identity ambition quietly did
not happen.

**The identity pitch.** ENS has all the ingredients on paper: a name is a stable global identifier,
[ENSIP-5 text records](https://docs.ens.domains/ensip/5/) let you attach arbitrary key/value data
(`com.twitter`, `com.github`, `email`, `url`, `description`), and
[ENSIP-12 avatar records](https://docs.ens.domains/ensip/12/) standardise a profile picture,
including NFT-backed avatars. In 2021–22 the pitch was "ENS is your web3 profile."

**What actually happened.**
- Text records are **self-asserted**. `com.twitter = @vitalikbuterin` in your text record proves
  nothing; anybody can write anything. The only records with meaning are ones a third party
  cross-verifies (and that verification lives off-chain, e.g. in a dapp's own checker).
- Usage concentrated on `addr`, `avatar`, and the primary/reverse record — i.e. *display*, not
  credentials. `UNVERIFIED:` I did not pull a records-usage histogram; the right source would be a
  Dune query over `Resolver.TextChanged` events on mainnet, and that is worth doing before we assign
  ENS any score weight.
- ENSv2's roadmap is about **name resolution and L2 scaling**, not credentials. ENS Labs announced
  the "Namechain" L2 in Nov 2024 explicitly framed as "a Layer 2 designed for onchain identity"
  ([app.ens.domains/ens-v2](https://app.ens.domains/ens-v2)), then **scrapped Namechain in Feb 2026**
  and moved ENSv2 back to Ethereum mainnet
  ([The Block, secondary](https://www.theblock.co/post/388932/ens-labs-scraps-namechain-l2-shifts-ensv2-fully-ethereum-mainnet),
  [CoinDesk, secondary](https://www.coindesk.com/tech/2026/02/06/ethereum-s-ens-identity-system-scraps-planned-rollup-amid-vitalik-s-warning-about-layer-2-networks)).

**Personhood value: near zero.** An ENS name is a *purchase*, not a person. One human can hold
thousands; sybil farms hold portfolios of them. Registration is permissionless and priced by name
length ($5/yr for 5+ chars), so the cost floor is trivially payable at scale.

**Lesson for us.** ENS is the clean example of a project that survived *by abandoning the identity
framing* and doing one narrow thing (name → address resolution) that a specific user needs at a
specific moment. It also demonstrates the difference between an *identifier* and a *credential*:
identifiers are cheap and plentiful, and the whole problem of personhood is that identifiers are
cheap and plentiful. In our score, ENS should be worth ~0 on its own; at most a weak behavioural
signal when combined with age + activity.

---

## 7. Farcaster and Lens as identity substrates

### 7a. Farcaster — the most interesting quasi-personhood signal here, but weakening

**Status (2026-07): alive protocol, contested metrics.** `farcasterxyz/protocol` last push
2026-06-18.

**On-chain surface (verified by direct RPC calls, 2026-07-24).** Contracts are on **OP Mainnet**
(plus one on Base), per [Farcaster deployments docs](https://docs.farcaster.xyz/reference/contracts/deployments):

| Contract | Chain | Address |
|---|---|---|
| IdRegistry | OP Mainnet | `0x00000000fc6c5f01fc30151999387bb99a9f489b` |
| IdGateway | OP Mainnet | `0x00000000fc25870c6ed6b6c7e41fb078b7656f69` |
| KeyRegistry | OP Mainnet | `0x00000000Fc1237824fb747aBDE0FF18990E59b7e` |
| KeyGateway | OP Mainnet | `0x00000000fc56947c7e7183f8ca4b62398caadf0b` |
| StorageRegistry | OP Mainnet | `0x00000000fcCe7f938e7aE6D3c335bD6a1a7c593D` |
| Bundler | OP Mainnet | `0x00000000fc04c910a0b5fea33b03e0447ad0b0aa` |
| TierRegistry (Farcaster Pro) | **Base** Mainnet | `0x00000000fc84484d585C3cF48d213424DFDE43FD` |

Useful reads for an aggregator (all free, permissionless, no API key):
- `IdRegistry.idOf(address) → uint256` — the FID owned by a custody address (0 if none).
- `IdRegistry.custodyOf(uint256 fid) → address`
- `IdRegistry.idCounter() → uint256` — highest FID issued.
- `IdRegistry.verifyFidSignature(...)` — check a message was signed by the fid's custody address.
- `KeyRegistry` — signer keys added by the account (a proxy for "has actually used a client").
- `TierRegistry.tierInfo(1)` / `price(tierId, days)` — Farcaster Pro subscription state.

**Live values I read directly (2026-07-24, `eth_call` against `https://mainnet.optimism.io`):**
- `IdRegistry.idCounter()` = `0x3304d1` = **3,343,569 FIDs ever issued**.
- `IdGateway.price()` = `106,862,587,627,489 wei` = **0.0001069 ETH** to register an FID
  (registration + 1 storage unit).
- `StorageRegistry.usdUnitPrice()` = `0x1312d00` = **20,000,000 → $0.20 USD per storage unit/year**
  (8-decimal fixed point).
- `TierRegistry` tier 1 (Farcaster Pro) = **328,767 wei USDC/day** = 0.328767 USDC/day =
  **$120.00/year**, min 30 days, paid in USDC on Base
  ([tier registry docs](https://docs.farcaster.xyz/reference/contracts/reference/tier-registry)).

**What an FID actually proves — and this changed recently and badly for us.**
- *Category:* **behavioral / weak economic**, **not** uniqueness and **not** liveness.
- The original 2023–24 pitch was economic sybil resistance: registration required renting storage at
  **~$7/unit/year**, so a 10,000-account farm cost $70k/yr. **That gate is gone.** Storage was
  repriced ~2025-07-16 and now reads **$0.20/unit/year** on-chain. A 10,000-FID farm now costs
  ~**$2,000/year** plus gas — trivially affordable for any sybil operation with a token airdrop in
  sight. Registration is permissionless (FIP: Permissionless Onboarding), so no one gates it.
- An FID proves: someone paid ~$0.20 and signed a transaction. Nothing more, by construction.
- **What *is* still meaningful** is the *derived* signals, none of which are single on-chain reads:
  account age (block of the `Register` event), whether signer keys were ever added, whether the
  account has a *verified* Ethereum address (a two-way signature link), social graph position
  (mutual follows with established accounts), and **Farcaster Pro ($120/yr)**. Pro is a genuinely
  costly commitment and the closest thing to a personhood signal in the stack — but it is held by a
  small minority, so it is a high-precision / very-low-recall feature.
- Sybil economics to state plainly: at $0.20/FID, **cost-of-attack is below cost-of-reward for
  almost any airdrop**. Treat raw FID existence as ~0 weight.

**Metrics caution.** Public DAU figures for Farcaster are contested and were inflated by bots
during Frames; secondary reporting in 2025–26 describes DAU in the tens of thousands with sharp
declines and revenue down heavily
([BlockEden, secondary](https://blockeden.xyz/blog/2025/10/28/farcaster-in-2025-the-protocol-paradox/),
[Yahoo Finance, secondary](https://finance.yahoo.com/news/farcaster-billion-dollar-dreams-fade-080518572.html)).
3.34M FIDs issued vs. tens of thousands of DAU = **~99% of FIDs are inactive**. Any score that
treats "has an FID" as evidence of humanity is scoring the noise, not the signal.

### 7b. Lens — weaker still

Lens V2 profiles were ERC-721 NFTs on Polygon (`0xdb46d1dc155634fbc732f92e853b10b288ad5a1d`,
"Lens Protocol Profiles"); handles were **transferable and traded on NFT marketplaces**, which by
itself disqualifies them as personhood evidence — a credential you can sell is a credential
sybil farms will buy. Lens V3 / Lens Chain (zkSync-stack L2) launched early 2025 and migrated the
data model. `lens-protocol/core` last push 2025-09-18. Secondary coverage describes a large activity
decline and a crypto-insider-only user base
([Medium, secondary](https://medium.com/@os_insights/the-rise-and-fall-of-lens-protocol-d902a2f9a1ae)).

`UNCLEAR:` current Lens Chain profile counts and whether V3 handles remain freely transferable —
worth 20 minutes on the Lens Chain explorer before assigning any weight. Default assumption: **skip**.

**Lesson for us — transferability is the killer test.** Ask of every credential: *can it be sold?*
Lens handles: yes → worthless. ENS names: yes → worthless. Farcaster FIDs: yes, the custody address
can transfer the FID → worthless as uniqueness. Only credentials bound to a biometric, a nullifier,
or a non-transferable state document survive this test. This should be a **hard filter in our
scoring model**, applied before any weight tuning.

---

## 8. SBTs and "Decentralized Society: Finding Web3's Soul"

**Status (2026-07): the thesis is intellectually influential and commercially near-empty.**

**What it was.** The May 2022 paper by E. Glen Weyl, Puja Ohlhaver and Vitalik Buterin
([SSRN 4105763](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4105763)) proposed "Souls"
(accounts) holding non-transferable **Soulbound Tokens** representing affiliations, memberships and
credentials, from which you could derive *decentralized society* primitives: community recovery,
plural/quadratic funding weighted by correlation of social attestations, undercollateralised
lending, and — directly relevant to us — **sybil resistance via correlation discounting** rather
than via one-person-one-ID.

**What actually shipped.** Very little. The standards never converged: EIP-4973 (Account-bound
tokens), EIP-5114 (Soulbound Badge), EIP-5192 (Minimal Soulbound NFT), ERC-6239, plus each chain's
own thing — none became canonical, so there is no interoperable SBT to aggregate. The credential
volume that did materialise went to **POAP** (event attendance, low stakes, no personhood value) and
to **verifiable credentials / EAS attestations**, not to SBTs. Institutional credentialing
(universities, employers) chose W3C VC + SD-JWT + mDL, i.e. the boring standards stack, because
those are the ones regulators and wallets support. Secondary retrospectives converge on this
("SBTs succeed where privacy stakes are low and struggle where privacy stakes are high"; fewer than
~50 institutions issuing on-chain credentials, mostly as VCs not SBTs — e.g.
[nftnow](https://nftnow.com/features/nfts-2-0-when-will-soulbound-tokens-arrive/), secondary).

**Why it didn't ship — four structural reasons.**
1. **Public non-transferable = permanent public linkage.** An SBT is a permanent, globally visible,
   unremovable label on an address. Nobody wants their employer, their medical history or their
   political affiliation soulbound in public forever, and the paper's answer ("we'll add privacy
   later") never got built at the layer where it mattered.
2. **Non-transferability is not enforceable.** You cannot make the *private key* non-transferable.
   Selling the wallet sells the SBTs. Every SBT scheme is really "hard to transfer casually," which
   is not a sybil-resistance property against a market.
3. **Revocation and issuer liability.** Issuers discovered that permanently publishing claims about
   people is a legal liability (GDPR erasure, defamation, discrimination), and the standards had no
   clean revocation story.
4. **No issuer incentive.** The paper assumed institutions would want to issue. They don't — issuing
   is cost and risk with no revenue, unless someone pays them.

**The one piece of the DeSoc thesis worth stealing.** Its sybil-resistance idea was *not*
"one credential per human"; it was **correlation discounting** — if a set of accounts share the same
attestation sources, weight them as fewer effective people. That is directly applicable to our
scoring model and is the correct formal answer to BRIEF.md's "overlap" requirement: our score should
not be a sum over credentials, it should be a function that **discounts correlated evidence**
(same document, same biometric, same issuer, same social cluster).

---

## 9. Prior identity-*aggregator* attempts — the closest ancestors

This is the section that matters most, because these are attempts at our exact shape.

### 9a. Gitcoin Passport → Human Passport (web3, the direct predecessor)

The canonical web3 personhood aggregator: collect "Stamps" from many providers (BrightID, ENS,
Google, Twitter/X, Discord, Coinbase, Guild, Lens, GTC staking, Holonym, Civic…), compute a single
**unique humanity score** (the well-known threshold being 20 on the Unique Humanity Score), and
expose it via API for grant rounds and airdrops. This is *precisely* the product we are proposing.

**Outcome:** acquired by **Holonym Foundation for ~$10M**, announced 2025-02-10, rebranded
**Human Passport** under human.tech
([CoinDesk, secondary](https://www.coindesk.com/business/2025/02/10/digital-identity-startup-holonym-acquires-gitcoin-passport),
[human.tech announcement](https://human.tech/blog/from-gitcoin-passport-to-human-passport-we-re-now-part-of-human-tech)).

**The numbers, which are the single most important economic datapoint in this document**
(from Passport's own retrospective):
- Spun out of Gitcoin Dec 2023 with **1.25M Passports**.
- Spring 2024 fundraise: **~75 partners and under $1M revenue**.
- At acquisition (Feb 2025): **>2M users, >35M identity credentials**.
- Sale price: ~$10M.

**Read this carefully.** With 2M users, 35M credentials, the strongest brand in web3 sybil
resistance, distribution through Gitcoin Grants (a genuine captive demand source: quadratic funding
*must* have sybil resistance or it is stolen), and ~75 integrating partners — the business generated
**less than $1M/year**. The category-defining incumbent in our exact market sold for the price of a
seed round.

That is not a story about bad execution. It is a story about **the market for a personhood score
being small**, because the people who need it (grant rounds, airdrops, faucets) are (a) few,
(b) themselves grant-funded rather than revenue-generating, and (c) extremely price-sensitive. If we
build this, we must have a different answer to "who pays" than Passport had, and we should be able to
state it in one sentence.

**Also note the deduplication problem they hit**, documented publicly:
[Deduplicating Stamps](https://docs.passport.xyz/building-with-passport/major-concepts/deduplicating-stamps).
When the same underlying account/credential is claimed by two Passports, someone loses it (they use
first-come-first-served / LIFO policies per stamp). Any aggregator inherits this: **the aggregator,
not the providers, is where cross-provider collision has to be resolved**, and it is where the
user-facing unfairness lands.

### 9b. Civic — killed its identity product in 2025

Civic ran **Civic Pass**: a gatekeeper credential (CAPTCHA, ID verification, **uniqueness**,
**liveness**) that dapps could require via an on-chain gateway token. It was one of the few web3
identity products with real paying integrations, and it issued its 1-millionth Pass in Q1 2025.

Then Civic **sunset it**: CAPTCHA and Identity Verification discontinued **2025-07-01**, and
**Uniqueness and Liveness sunset 2025-07-31**
([Civic — "An update on Civic Pass"](https://www.civic.com/blog/an-update-on-civic-pass)).
The stated pivot is to **Civic Auth** (login + embedded wallets in "under five minutes") and to
"the identity layer for Agentic AI."

**This is the most recent and most on-the-nose death in this document** — a company with a working
uniqueness+liveness product, a million issued credentials, and paying dapp customers, walked away
from personhood verification in mid-2025 to sell *auth/embedded wallets* instead. Their revealed
preference: **onboarding friction removal sells; personhood assurance does not.**

Operationally for us: **if we integrated Civic Pass, our score silently lost a component in July
2025.** Model that.

### 9c. Sismo — pivoted then wound down

Sismo built ZK Badges (prove group membership without linking addresses) and then Sismo Connect.
The **ZK Badges minting app was sunset 2023-09-01** in favour of Sismo Connect
([Sismo mirror post](https://sismo.mirror.xyz/MimvqFv45hohMwDBD9rGqY4XGZIHRR8On7nx6q9YFRc)),
and the sismo-core repos have been dormant since.
`UNVERIFIED:` exact wind-down date of Sismo Connect / the company — check `github.com/sismo-core`
commit dates and the Sismo X account for the final post. Treat as dead.

### 9d. Others, briefly

- **Quadrata** (KYC "passport" NFT for DeFi compliance): `UNCLEAR:` current status; the docs and app
  should be checked directly before assuming it is live.
- **Galxe Passport**: still shipping, but as a KYC add-on to a campaigns/quest business — i.e. the
  identity piece is a feature of a distribution product, not the product.
- **Disco.xyz, Serto, Trinsic (SSI wave)**: Trinsic notably pivoted *away* from being an SSI wallet
  vendor toward being an **identity-verification aggregator/orchestration API** ("one integration,
  many IDV providers"). That pivot direction — from SSI idealism to boring IDV aggregation — is the
  single strongest market signal in this document about where the money actually is.
  `UNVERIFIED:` I did not fetch Trinsic's current pricing/product page; do that before citing.

### 9e. The web2 analogue — what business model actually works in identity brokerage

Two distinct web2 patterns, and only one of them is a real business.

**Pattern 1 — social-connection aggregation (Auth0/Okta, Firebase Auth, Clerk, Stytch, Keycloak
identity brokering, eIDAS nodes).** "One integration, log in with 30 providers." Observations:
- Nobody pays for the *aggregation*. They pay for **sessions, user management, SSO, MFA, audit logs,
  compliance, and support** — priced per **MAU** or per **enterprise SSO connection**. The
  social-connection list is a checkbox that closes the deal, not the line item.
- The margin sits in the **enterprise tier** ("SSO tax"): SAML/SCIM/audit for B2B buyers.
- The commoditising force: every upstream provider (Google, Apple, Microsoft) gives OAuth away free,
  so the aggregator can never charge for access — only for the surrounding operational surface.
- eIDAS nodes are the government version: real interop, funded as public infrastructure, zero
  commercial margin. Standards-body-driven, adoption dragged by regulation not demand.

**Pattern 2 — verification orchestration (Persona, Alloy, Trulioo, Sardine, Footprint, Veriff/Onfido
resellers).** "One API, many IDV/KYC/AML data sources, routed by policy." This *is* a real business,
and it is the correct analogue for us:
- Pricing is **per verification**, with real gross margin over the underlying vendor cost —
  e.g. Persona's published tiers run roughly **$0.80/verification** (Essential, $49/mo minimum) to
  **$1.89/verification** (Premium, $209/mo minimum), enterprise custom
  ([beverified.org review, secondary](https://beverified.org/providers/persona/)); Trulioo sells
  access to 450+ data sources behind one integration with custom enterprise pricing
  ([beverified.org, secondary](https://beverified.org/providers/trulioo/)).
- Why it works: the buyer has a **regulatory or fraud-loss obligation**. Failing KYC costs them
  fines; failing fraud checks costs them chargebacks. There is a **pre-existing budget line** and a
  **quantifiable loss being avoided**.
- The orchestration layer's real value is (a) *routing* — try the cheap check first, escalate to the
  expensive one only when needed, which directly cuts the customer's cost per approved user, and
  (b) *conversion-rate optimisation* — same fraud rate, more approved good users.

**The mapping to us, stated bluntly.** Our product resembles Pattern 2 structurally but has
Pattern 1's economics unless the buyer has a quantifiable loss. Airdrop farming *is* a quantifiable
loss (millions in tokens to sybils), and Sybil-resistant grant funding is a quantifiable loss —
those are the only two web3 buyers with a real number attached. **Everyone else is buying a
nice-to-have.** Our pricing should be per-check with a margin, sold against a loss figure the buyer
already tracks — not a subscription for "identity infrastructure."

---

## 10. Synthesis

### 10.1 Recurring causes of death

Ranked by how many corpses they explain.

**1. Supply built before demand — the issuer/verifier chicken-and-egg, always lost on the verifier
side.** uPort, Sovrin, ION, Ceramic/IDX and SBTs all built *issuance and storage* first. In every
case the missing half was **a verifier with a budget who refused someone for lack of a credential**.
Nobody has ever failed for lack of credential supply. Note the asymmetry: users will not get a
credential nobody asks for, and verifiers will not ask for a credential nobody has — but the
verifier side is the one with money, so the correct place to break the loop is *always* to find a
verifier with a loss to prevent and work backwards.

**2. Governance/standards mass without users.** Sovrin is the pure case: a decade of governance
frameworks, steward agreements and legal opinions, dissolved 2025-05-21 with a read-only ledger.
DIF/W3C produced excellent specs; the market implemented the *cheapest* conforming option
(`did:web`) and ignored the rest. **Standards effort is not distribution.** Corollary: winning the
standard can be worth nothing commercially — `siwe` at 1.06M downloads/month, `@spruceid/ssx` at 68.

**3. Infrastructure with running costs and no revenue.** Sovrin stewards, ION nodes (full Bitcoin +
IPFS), Ceramic nodes. Whenever "someone must volunteer to run a machine forever for free," the
network's lifespan equals the enthusiasm budget of its members. Veramo and SIWE survived precisely
because **there is nothing to keep running**.

**4. Product/stack churn destroying integrator trust.** 3Box → 3ID → IDX → Glaze → ComposeDB →
ceramic-one, each within ~18 months. uPort switched off its own hosted infra on 2021-06-01, breaking
live integrations. An integrator burned once does not come back.

**5. The credential is sellable.** ENS names, Lens handles, Farcaster FIDs, and every SBT scheme are
transferable in practice, which converts "proof of personhood" into "proof of purchase" the moment a
market exists. Rental and account markets appear the instant a credential gates a token.

**6. Token/incentive corruption of the credential.** Whenever a credential gates an airdrop, the
credential's price is bid up to just under the airdrop's expected value and the farm buys it. This
is not a bug in any particular protocol; it is an equilibrium. It means **credential quality decays
exactly when the credential becomes useful.**

**7. Privacy theatre and its opposite.** Two failure directions: (a) publishing permanent public
labels about people, which issuers refuse for legal reasons (SBTs); (b) heavy ZK/AnonCreds machinery
that made the stack hard to implement, hard to audit, and non-FIPS (Sovrin's CL signatures, ION's
secp256k1 keys retired 2026-07-01), which blocked the only buyers with money. Real privacy is a
prerequisite; ceremony around privacy is a cost.

**8. Single-sponsor dependency.** uPort/ConsenSys, ION/Microsoft, Passport/Gitcoin. When the sponsor
reallocates, the project has no independent revenue to defend itself with. Veramo survived by being
donated to DIF and having no infra.

**9. The market for "identity" is smaller than everyone assumes.** The hardest lesson: Gitcoin
Passport, the category leader with 2M users and 35M credentials, made **<$1M revenue** and sold for
**~$10M**. Civic, with a working uniqueness+liveness product and 1M passes issued, **shut it down in
July 2025** to sell embedded-wallet auth instead. These are not failures of execution by weak teams.
They are the market's answer.

### 10.2 Which failure modes threaten *us*, concretely

**(a) We are IDX/Rebase again.** An aggregation index whose value equals
(credential supply) × (verifier demand). Rebase is archived; IDX is deprecated; Passport sold for
$10M. **Mitigation:** do not ship an index. Ship a *decision* for one named buyer with one named
loss. Concretely: pick the airdrop-distribution or grant-round use case, quantify the sybil loss in
dollars for a specific customer, and price against it.

**(b) The "who pays" hole.** We have no evidence any buyer pays meaningfully for a personhood score.
Passport's <$1M revenue at 2M users is the benchmark to beat, and it's a low bar that a
category-defining product failed to clear. **Mitigation:** before building, get one signed LOI or
one paid pilot. If the answer to "who pays" is "protocols doing airdrops," note that they pay once,
episodically, and then churn — that is a services business, not ARR.

**(c) Source rot / silent freezing.** Civic killed uniqueness+liveness in July 2025; Sovrin went
read-only; ION went quiet without an announcement. Our aggregate score will silently degrade as
sources die, and *nobody will tell us*. **Mitigation:** per-source liveness probes on a schedule,
an explicit `stale` / `retired` state in the score object, score versioning, and a published
changelog so a customer's threshold doesn't silently change meaning. Treat "absence of a shutdown
announcement is not evidence of life" as an engineering requirement.

**(d) Aggregation makes us the sybil surface.** We inherit the *union* of every source's weaknesses,
not the intersection. A farm attacks our weakest-weighted source at scale, or exploits
double-counting across sources sharing a trust root (same passport chip, same face, same phone
number, same underlying vendor). Passport had to build explicit stamp deduplication for exactly
this. **Mitigation:** correlation discounting (the one good idea from DeSoc), a trust-root graph
maintained as first-class data, and a hard rule that the score is never a plain sum.

**(e) Transferability contaminating the score.** If any weighted input can be bought or rented, our
score has a market price and therefore an attack cost. **Mitigation:** a pre-scoring filter —
*is this credential transferable/rentable in practice?* — applied before weights. Anything that
fails gets ≤ a floor weight forever, regardless of how good it looks.

**(f) Vendor-cooperation dependency.** If verification requires our servers, our API key, or a
partner's goodwill, we are uPort's hosted infra. **Mitigation:** every integration should have a
documented "verify without us" path (on-chain read, offline signature check), and we should publish
it. This is also the honest sales pitch: customers buy us for maintenance and routing, not lock-in.

**(g) Becoming a standards project.** The gravitational pull toward "let's define the canonical
personhood credential schema" is strong and every corpse here felt it. Schema definition is
copyable in a weekend and generates no revenue. **Mitigation:** ship the normalisation as an
implementation detail; never make it the pitch; never start a working group.

**(h) Regulatory drift under us.** eIDAS 2.0 / EUDI wallets, US state mDLs (2M+ in California
alone), and age-verification mandates are creating **state-issued, high-assurance personhood
credentials with legal force** — precisely the credentials verifiers will be *required* to accept.
This is simultaneously the biggest threat (it obsoletes crypto-native personhood signals) and the
biggest opportunity (an aggregator that routes to mDL/EUDI *and* crypto-native sources is more
valuable than either). Spruce is already positioned on the government side; we should decide
explicitly whether we are competing with that or riding it.

### 10.3 What the survivors did differently

| Survivor | The differentiating move |
|---|---|
| **SIWE (EIP-4361)** | Shipped a *message format*, not a service. No servers, no API keys, no token, nothing to shut down. Solved a problem developers already had (unsafe hand-rolled signature auth) rather than one they should have. Verifiable with zero cooperation from the author. |
| **Veramo** | Became a **library**, not a network or a product; donated to DIF so it isn't hostage to one company's budget; zero infra to fund. 102k npm downloads/month with no business model at all. |
| **Farcaster** | Kept the *identity* piece minimal and on-chain (a numeric FID + key registry, cheap permissionless reads) and put all the effort into a **product people use daily**. Identity as a by-product of an application, never as the product. |
| **EAS** | An **unopinionated primitive** — arbitrary attestations with schemas — that takes no position on what identity means, has no token gating usage, is permissionless, and costs the deployer nothing to keep alive. Repo actively developed (last push 2026-07-16). |
| **Spruce ID (the company)** | Followed the money out of crypto into **government/enterprise compliance** (CA DMV mDL >2M issued; DHS SVIP $199,960 Phase 1, up to $1.7M). Shipped against ISO 18013-5 / W3C VCDM / SD-JWT — the standards buyers are *required* to use. |
| **`did:web`** | Won by being the *least* ambitious option: DNS + an HTTPS JSON file. Beat a Bitcoin-anchored permissionless DID network because it cost the buyer nothing new. |

**The pattern across all six:** they either (i) removed themselves from the runtime path entirely
(format/library/primitive, nothing to operate), or (ii) attached themselves to a buyer with a
pre-existing legal or fraud-loss budget. **Nobody survived by selling identity aggregation as a
product to web3 on its own merits.** That is exactly the business we are proposing, so the burden of
proof is on us to name what is different this time — and "better UX" is not an answer, Passport had
good UX.

### 10.4 The three questions this research says we must answer before building

1. **Who has a budget line and a dollar-denominated loss that our score reduces?** Name the customer
   and the number. If the honest answer is "airdrop teams, episodically," accept that we are a
   services/one-off-revenue business and size it accordingly. Benchmark to beat: Passport's <$1M/yr
   at 2M users.
2. **What is the moat once the normalisation schema is public?** It cannot be the schema. Candidates
   worth testing: cross-source correlation/dedup data (which improves with volume and is genuinely
   hard to copy), integration maintenance as sources rot, and routing that cuts the buyer's
   cost-per-verified-human. Pick one and design for it.
3. **Are we complements or competitors to state-issued digital identity (mDL/EUDI)?** By 2027 the
   highest-assurance personhood credential most users hold will be issued by a government, and
   verifiers may be legally obliged to accept it. An aggregator that treats mDL/EUDI as a
   first-class source is durable; one that is purely crypto-native is betting against regulation.

---

## References

Primary:
- Sovrin Foundation — [The Sovrin Foundation Has Been Dissolved — but Sovrin MainNet Remains](https://sovrin.org/the-sovrin-foundation-has-been-dissolved-but-sovrin-mainnet-remains/) (dissolution 2025-05-21)
- Sovrin Foundation — [MainNet Ledger Shutdown Likely on or before March 31, 2025](https://sovrin.org/sovrin-foundation-mainnet-ledger-shutdown-likely-on-or-before-march-31-2025/)
- Microsoft Learn — [What's new in Entra Verified ID](https://learn.microsoft.com/en-us/entra/verified-id/whats-new) (`did:ion` removed; `did:web` only; P-256K retired 2026-07-01)
- GitHub — [decentralized-identity/ion](https://github.com/decentralized-identity/ion) (last push 2023-08-25)
- uPort — [Veramo: uPort's Open Source Evolution](https://medium.com/uport/veramo-uports-open-source-evolution-d85fa463db1f)
- Serto — [uPort is now Serto](https://serto.medium.com/uport-is-now-serto-df9c73d545e6)
- GitHub — [decentralized-identity/veramo](https://github.com/decentralized-identity/veramo) (last push 2026-07-24)
- Ceramic — [FAQ / The Future of Ceramic](https://blog.ceramic.network/faq-ceramic-network/) (js-ceramic + ComposeDB deprecated, 2025-04-17; 3Box Labs–Textile merger 2025-02-05)
- EIP-4361 — [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- SpruceID — [California DMV mDL case study](https://spruceid.com/success-stories/california-dmv-mobile-driver-license), [partnership announcement](https://blog.spruceid.com/spruceid-partners-with-ca-dmv-on-mdl/)
- DHS S&T — [SVIP awards to six startups incl. SpruceID, 2024-07-08](https://www.dhs.gov/science-and-technology/news/2024/07/08/homeland-security-awards-contracts-six-startups-identify-develop-and-implement), [SpruceID program page](https://www.dhs.gov/science-and-technology/spruceid)
- ENS — [ENSIP-5 Text Records](https://docs.ens.domains/ensip/5/), [ENSIP-12 Avatar Text Records](https://docs.ens.domains/ensip/12/), [ENSv2](https://app.ens.domains/ens-v2)
- Farcaster — [Contract deployments](https://docs.farcaster.xyz/reference/contracts/deployments), [IdRegistry](https://docs.farcaster.xyz/reference/contracts/reference/id-registry), [StorageRegistry](https://docs.farcaster.xyz/reference/contracts/reference/storage-registry), [TierRegistry](https://docs.farcaster.xyz/reference/contracts/reference/tier-registry), [FIP: Farcaster Pro](https://github.com/farcasterxyz/protocol/discussions/236)
- Civic — [An update on Civic Pass](https://www.civic.com/blog/an-update-on-civic-pass) (uniqueness + liveness sunset 2025-07-31)
- human.tech — [From Gitcoin Passport to Human Passport](https://human.tech/blog/from-gitcoin-passport-to-human-passport-we-re-now-part-of-human-tech) (2M users, 35M credentials, <$1M revenue at Spring 2024 raise)
- Passport docs — [Deduplicating Stamps](https://docs.passport.xyz/building-with-passport/major-concepts/deduplicating-stamps)
- Sismo — [ZK Badges sunset](https://sismo.mirror.xyz/MimvqFv45hohMwDBD9rGqY4XGZIHRR8On7nx6q9YFRc) (2023-09-01)
- Weyl, Ohlhaver, Buterin — [Decentralized Society: Finding Web3's Soul](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4105763) (SSRN 4105763, May 2022)
- Direct on-chain reads, OP Mainnet `eth_call` via `https://mainnet.optimism.io`, 2026-07-24 (see §7a)
- npm registry download stats, `https://api.npmjs.org/downloads/point/last-month/<pkg>`, window 2026-06-24 → 2026-07-23
- GitHub REST API `repos/<owner>/<repo>`, queried 2026-07-24

Secondary (labelled as such in text):
- [ID Tech Wire — "The Community Moved On": Sovrin announces MainNet's likely shutdown](https://idtechwire.com/the-community-moved-on-sovrin-announces-mainnets-likely-shutdown/)
- [cheqd — Sovrin mainnet shutdown: what it means for your ecosystem](https://cheqd.io/blog/sovrin-mainnet-shutdown-what-it-means-for-your-ecosystem/)
- [Redmondmag — Microsoft Unveils ION Version 1](https://redmondmag.com/articles/2021/03/31/microsoft-ion-for-decentralized-identities.aspx)
- [The Block — ENS Labs scraps Namechain L2](https://www.theblock.co/post/388932/ens-labs-scraps-namechain-l2-shifts-ensv2-fully-ethereum-mainnet)
- [CoinDesk — ENS scraps planned rollup](https://www.coindesk.com/tech/2026/02/06/ethereum-s-ens-identity-system-scraps-planned-rollup-amid-vitalik-s-warning-about-layer-2-networks)
- [CoinDesk — Holonym acquires Gitcoin Passport](https://www.coindesk.com/business/2025/02/10/digital-identity-startup-holonym-acquires-gitcoin-passport)
- [Biometric Update — California quadruples access to mobile driver's licenses (2026-07)](https://www.biometricupdate.com/202607/california-quadruples-access-to-mobile-drivers-licenses)
- [BlockEden — Farcaster in 2025: The Protocol Paradox](https://blockeden.xyz/blog/2025/10/28/farcaster-in-2025-the-protocol-paradox/)
- [Medium — The Rise and Fall of Lens Protocol](https://medium.com/@os_insights/the-rise-and-fall-of-lens-protocol-d902a2f9a1ae)
- [beverified.org — Persona review (pricing)](https://beverified.org/providers/persona/), [Trulioo review](https://beverified.org/providers/trulioo/)
- [nftnow — NFTs 2.0? When Will Soulbound Tokens Arrive?](https://nftnow.com/features/nfts-2-0-when-will-soulbound-tokens-arrive/)

## Open questions / where to look next

1. **ENS text-record usage histogram** — Dune query over `TextChanged` events on the public
   resolvers, to see whether identity-ish keys (`com.twitter`, `com.github`) are used at all.
2. **Farcaster FID quality distribution** — how many of the 3,343,569 FIDs have ever added a signer
   key, have a verified address, or hold Farcaster Pro? Readable from `KeyRegistry` events +
   TierRegistry; this converts a useless raw count into a usable feature.
3. **Human Passport's current commercial state** — pricing, partner count and whether the API is
   still free-tier. Their post-acquisition revenue is the single most relevant benchmark for us.
4. **Trinsic's IDV-orchestration pricing** — the closest live business model to ours; their public
   pricing page would tell us what per-verification aggregation actually sells for.
5. **Quadrata / Galxe Passport / Lens V3 handle transferability** — all marked `UNCLEAR:` above.
6. **EUDI wallet + US mDL verifier obligations** — what verifiers will be *legally required* to
   accept by 2027, since that defines the ceiling on crypto-native personhood signals.
