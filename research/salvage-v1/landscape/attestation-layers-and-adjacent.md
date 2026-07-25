# Attestation layers & adjacent projects — Billions, Human Wallet, Unitap, Disco, Sismo, Intuition, Coinbase Verifications

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). This one resolved two open questions from the
> brief — **Sismo is dead**, and **"Discio" was Disco.xyz** — and produced one directly usable
> on-chain fact (the Coinbase Verified Account schema). Deeper EAS and Privado/Verax coverage lives
> in the rows 8 and 9 write-ups.

## Sismo — **dead**

The brief asked us to check whether Sismo sunsetted. It did.

- [The Big Whale, **2023-11-16**](https://www.thebigwhale.io/article/exclusive-sismo-in-difficulty-could-soon-be-shut-down):
  Sismo "is set to cease trading soon and return remaining funds to investors" — founded 2021, raised
  $10M in 2022, ~10 employees, expected to return **51% of investor stakes**. Notably the shutdown was
  attributed to **technical difficulty, not insolvency**: "They're very good, but probably not strong
  enough on ZK-Rollups," plus team burnout and an unreplaced head of tech.
- **PitchBook lists ownership status as "Out of Business."** No live job postings.
- GitHub corroborates: `sismo-hub` (959★) last updated **2024-12-31**; everything else —
  `sismo-vault-api` (2024-03-16), `sismo-docs`, `sismo-badges`, `sismo-vault-app`,
  `sismo-connect-solidity` — stopped in **2023**. No archive flags or sunset notice were ever posted,
  which is why a naive check reads it as alive. **The repos are tombstones, not maintenance.**

**Lesson for us:** Sismo was a *sovereign identity aggregator with crypto-native SSO* — conceptually
adjacent to what we are building, funded at $10M, and it died on ZK engineering complexity. Worth
understanding properly before we commit to heavy in-house ZK. Do not route to it.

## Disco.xyz — merged into Privado ID

The brief's "Discio" is **Disco.xyz** (garbled in dictation). It did not die independently: **Disco
merged with Privado ID**, and founder **Evin McMullen** joined as co-founder and Chief Strategy
Officer. The stated aim was a "Unified Identity Infrastructure capable of bridging identities across
Web2 and Web3." So the Disco thread and the Privado/Billions thread are the same lineage now — see
[commercial-identity-vendors.md](commercial-identity-vendors.md).

## Billions Network

- **One-liner:** consumer human-and-AI verification network from the Privado ID team; passport + phone,
  explicitly **no biometric hardware**.
- **Lineage:** Polygon ID → Privado ID (spun out of Polygon Labs 2024) → **Billions** (Feb 2026),
  $30M raised. Co-founders include ex-Polygon CTO David Z and Disco's Evin McMullen.
- **Institutional traction, if the claims hold:** proofs-of-concept with **Deutsche Bank, HSBC, and
  Telefónica Tech**, plus work with the **Government of India on Aadhaar** verification. Secondary
  sources; unverified but specific enough to be checkable.
- **GitHub — [`BillionsNetwork`](https://github.com/BillionsNetwork)** is active and the repo list is
  revealing:
  - `verified-agent-identity` — **754★ and 6,623 forks** (updated 2026-05-18). That fork count is
    enormous and suggests either a mass workshop/airdrop-farming campaign or genuine agent-dev
    traction. Worth a look either way.
  - `x402-human-proof-js` — "Proof-of-human extension for **x402** — verified-human gating and
    **discounted pricing for API payments**, powered by Billions Network PoU attestations."
  - `erc-8004-contracts`, `billions-token`, `billions-oft-adapter` (LayerZero OFT), `docs` (2026-07-09).
- **That x402 repo is the single most interesting artifact in this file.** It is a concrete, shipped
  answer to "what is a personhood score *for*": gate machine-payable APIs and price-discriminate
  humans vs agents. That is a real commercial use case for an aggregate humanity assertion, and it is
  adjacent to our own consumer use cases without being one we listed.
- **Routable?** **Maybe — and a competitor.** `UNVERIFIED:` no contract addresses, npm packages, or
  API details were captured.

## Human Wallet (formerly Silk), by Holonym / human.tech

- **One-liner:** wallet with "Human Keys" derived from low-entropy human inputs, with built-in ZK
  identity proofs.
- **Mechanism, which is genuinely novel:** Human Keys generate "secure private keys from familiar
  inputs like passwords, emails, or biometrics," transforming low-entropy inputs into high-entropy
  keys via a **threshold Verifiable Oblivious Pseudorandom Function (tVOPRF)** on Holonym's
  decentralised **Mishti Network**, with 2PC-MPC security. Identity proofs run through Holonym's
  **Zeronym** to prove legal personhood, age, citizenship, compliance.
- Note the tVOPRF appears again here — the same primitive ZKPassport uses for salted identifiers and
  World ID uses for nullifier derivation. **Threshold OPRFs are becoming the standard building block
  for unlinkable-but-deterministic identifiers.** Worth understanding deeply; it is likely a component
  of anything we build.
- **Scale:** "over 100,000 users and $5.5 million raised" (undated, secondary).
- **Routable?** **No, not as a credential source** — it is a wallet, and its identity proofs are the
  same Holonym credentials already covered under Human Passport. Relevant instead as a *distribution
  surface* and as prior art on human-derived keys.

## Unitap — a consumer, not a source

- **One-liner:** multi-network gas faucet and Web3 loyalty platform that **consumes** proof of
  personhood rather than producing it.
- **How it uses personhood:** "All you need is a verified **BrightID** account to use the gas faucet."
  Users must **re-link their BrightID every period** and may select only a limited number of offerings
  (5 gas/token tap, 3 prize tap) — an explicit anti-**account-renting** design.
- **`unitap-pass` is a friction bypass, not a credential:** an ERC-721 "VIP pass" whose benefit is
  exemption from periodic BrightID re-linking. 18 commits.
  [`UnitapApp/unitap-pass`](https://github.com/UnitapApp/unitap-pass).
- **Unitap has drifted.** The current site describes "a Web3 loyalty platform… points, badges, and
  leaderboards" with **no mention of BrightID, proof-of-personhood, or any uniqueness API** on the
  landing page. Faucet → loyalty SaaS.
- **Routable? No.** But it is a useful *customer archetype*: exactly the kind of app that would buy an
  aggregated humanity score, and its periodic-relink and limited-selection mechanics are real,
  battle-tested anti-renting patterns we should copy. **Credential renting is a threat model we have
  not yet designed for, and Unitap already has.**

## Coinbase Verifications — the highest-volume usable attestation found

- **One-liner:** Coinbase-issued EAS attestations on Base asserting a wallet belongs to a verified
  Coinbase account, and separately its country of residence.
- **Schema (Base), the one hard identifier in this file:**
  - **Verified Account** — Schema **#87**, UID
    **`0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9`**, created **2023-10-23**,
    **680,232 attestations onchain**. Single boolean field `verifiedAccount`.
  - **Verified Country** — string field, ISO 3166-1 alpha-2 country code. `UNVERIFIED:` UID not captured.
- **Category:** web2-account / KYC-adjacent. What it actually proves is that **Coinbase completed KYC
  on this person and they control this wallet**. It is *not* uniqueness — one human can hold multiple
  Coinbase accounts in principle — but Coinbase's own KYC deduplication makes it a moderately strong
  signal, backed by a regulated entity.
- **Permissioned issuance, permissionless reading.** "A custom EAS schema resolver contract is used by
  permissioned Coinbase schemas to restrict schema usage to permitted attesters" — only Coinbase can
  attest, but **anyone can read**, on-chain or via the `base.easscan.org` GraphQL endpoint.
- **Routable? Yes.** Free to read, on-chain, six-figure coverage, well-documented, and the single
  largest ready-made attestation set encountered anywhere in this research. The catch is the trust
  root is a centralised exchange, and coverage skews to Coinbase's markets (US-heavy).
  - Note the earlier "about 9,300 attestations" figure that appears in one secondary source is stale
    or refers to a different attestation type — the schema page's **680,232** is the number to use.

## Optimism attestations / Citizens' House

- AttestationStation was "a permissionless and accessible data source… anyone can make arbitrary
  attestations about other addresses," and **has since been upgraded to the EAS standard** so
  attestations "interoperate across the Superchain and Ethereum Mainnet."
- **Citizen attestations** (first issued Season 6) identify Optimism Citizens for one-person-one-vote
  governance; the resolver checks the issuer is the Foundation at
  **`0xE4553b743E74dA3424Ac51f8C1E586fd43aE226F`**. `UNVERIFIED:` not explorer-checked.
- Scale of the substrate: **1,317,667 total attestations across 822 schemas on Optimism**.
- [citizen-attestations.xyz](https://citizen-attestations.xyz/) aggregates citizen-eligibility signals
  from **four sources — Gitcoin Passport, Praise, Regen Score, and Optimist Profiles**. That is a
  small, live, working personhood aggregator with published source weighting. **Direct prior art for
  our scoring problem — study it.**
- `UNCLEAR:` the Citizen schema UID was never captured; the docs URL 301-redirected and was not
  re-fetched.
- **Human Passport writes to EAS too** — stamps and score attestations are minted on-chain via
  [`passportxyz/eas-proxy`](https://github.com/passportxyz/eas-proxy) and a `GitcoinPassportDecoder`
  contract, so passport data is readable on-chain "rather than having to make requests to a
  centralized server." Note there is a **$3 Gitcoin fee plus gas** to mint on-chain — so on-chain
  passport coverage will be far thinner than off-chain API coverage. Don't assume parity.

## Intuition

- **One-liner:** token-curated knowledge graph where claims about identities are collateralised with
  stake — "good attestations earn rewards; bad ones cost you stake."
- **Live:** mainnet and `$TRUST` launched, public **2025-11-05**, **$8.5M raised** (ConsenSys, Polygon,
  Shima, Superscrypt, F-Prime). Implemented as an **Arbitrum Orbit L3 settling on Base**.
- **Scale:** beta on Base drew "over 244,000 participants, more than 5.3 million transactions, and
  over 5.1 million verified attestations"; a later testnet cycle saw 17.5M transactions from 900k
  unique accounts in ~8 weeks. Incentivised-testnet numbers — heavily discount them.
- **Why it matters to us conceptually:** it is the only project here that puts **economic skin behind
  a vouch**. Circles vouching costs 96 CRC; Kleros costs a deposit; Intuition generalises this to
  arbitrary claims with slashing. If we ever want *staked* attestations about humanity, this is the
  existing substrate.
- **Routable?** **No, not today.** Separate L3, `$TRUST` gas token, no personhood-specific schema
  identified. Track it.

## What this file changes about our thinking

1. **Sismo's death is a warning.** A $10M-funded identity aggregator died of ZK engineering
   complexity, not lack of demand. Prefer verifying *other people's* proofs (ZKPassport's deterministic
   verifier, PoH v2's view functions) over building our own ZK stack.
2. **Coinbase Verified Account is the cheapest large win available.** 680k attestations, free to read
   on Base, one schema UID. If we want coverage on day one, this is it.
3. **citizen-attestations.xyz is live prior art** for combining four personhood sources — the exact
   problem we are solving, at small scale, in public.
4. **Credential renting is a real, unmodelled threat.** Unitap ships periodic re-linking and forced
   selection limits specifically to defeat BrightID account rental. Our score must have a freshness
   and re-attestation story, not just a point-in-time reading.
5. **Threshold OPRFs are the recurring primitive** — World ID, ZKPassport, Human Keys all use them for
   deterministic-but-unlinkable identifiers.

## Open questions

1. What is the Optimism **Citizen** schema UID, and what weights does citizen-attestations.xyz use?
2. What is the **Verified Country** schema UID on Base?
3. How much on-chain (vs API-only) Human Passport coverage actually exists, given the $3 + gas mint cost?
4. Is Billions' `verified-agent-identity` (6,623 forks) real traction or campaign artifact?

## Sources

- [The Big Whale — Sismo in difficulty](https://www.thebigwhale.io/article/exclusive-sismo-in-difficulty-could-soon-be-shut-down) · [sismo-core](https://github.com/sismo-core) · [sismo.io](https://www.sismo.io/) · [PitchBook profile](https://pitchbook.com/profiles/company/491842-90)
- [Privado ID + Disco.xyz merger](https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems)
- [Billions Network](https://billions.network/) · [BillionsNetwork GitHub](https://github.com/BillionsNetwork) · [0xPolygonID](https://github.com/0xPolygonID) · [VentureBeat launch coverage](https://venturebeat.com/business/billions-network-launches-universally-accessible-verification-platform-for-humans-and-ai)
- [Human Wallet docs](https://wallet.human.tech/docs/methods) · [Holonym — Human Wallet](https://developer.holonym.id/protocols/silk) · [Holonym Foundation](https://holonym.id/)
- [Unitap](https://unitap.app/) · [UnitapApp/unitap-pass](https://github.com/UnitapApp/unitap-pass) · [unitap-backend](https://github.com/UnitapApp/unitap-backend)
- [coinbase/verifications](https://github.com/coinbase/verifications) · [Base EAS schema explorer](https://base.easscan.org/schemas/explore) · [EAS Base](https://base.easscan.org/)
- [Optimism identity schemas](https://docs.optimism.io/chain/identity/schemas) · [citizen-attestations.xyz](https://citizen-attestations.xyz/) · [Optimism EAS explorer](https://optimism.easscan.org/) · [passportxyz/eas-proxy](https://github.com/passportxyz/eas-proxy)
- [Intuition docs](https://www.docs.intuition.systems/docs) · [mainnet launch — Chainwire](https://chainwire.org/2025/10/29/intuition-launches-mainnet-with-8-5m-to-build-the-trust-layer-for-ai-and-the-internet/)
- Also surfaced: [Heavy-Community/I-am-Human](https://github.com/Heavy-Community/I-am-Human) (ZKPassport-SDK PoC combining device-motion, fingerprint and face ID) and NEAR's IamHuman (GoodDollar 3D selfie) — both minor, neither routable.
