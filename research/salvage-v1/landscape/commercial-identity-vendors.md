# Commercial identity & scoring vendors — Human Passport, Civic, Fractal, zkMe, Galxe, Privado/Billions

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). Coverage is reasonable across all six; the agent
> got GitHub API data for most and pricing for two. Contract addresses here are largely
> **unverified against explorers** — treat them as leads.

These are the commercial end of the landscape. **Two of the six are themselves aggregators** (Human
Passport, and Billions), which makes this file as much competitive research as sourcing research.

## Human Passport (formerly Gitcoin Passport) — *competitor and source*

- **One-liner:** stamp-based sybil-resistance score aggregating web2 accounts, on-chain activity and
  ZK credentials; **acquired by Holonym in Feb 2025** and folded into `human.tech`.
- **Category:** behavioral / web2-account aggregation (secondary: uniqueness via Holonym ZK credentials)
- **This is the closest existing thing to what we are building.** It aggregates many signals into one
  score behind one API. Studying it is not optional. Its weakness — and our opening — is that its
  stamps are mostly *web2 account ownership*, which is cheap to farm, rather than the strong,
  independent, cryptographic personhood roots (PoH v2, Circles topology, ZKPassport, World ID) that a
  protocol-native aggregator can route to.
- **Two products worth distinguishing:**
  - **Stamps API** — base URL `https://api.passport.xyz`, the classic stamp/score model.
  - **Passport Models** — "a real-time verification product that enables you to classify **any EVM
    address as Sybil or human, without requiring users to have a Passport Stamps account**." That is a
    passive, no-user-action classifier. Directly relevant to us: it is the fallback for addresses with
    no credentials at all, and a plausible baseline to beat.
  - **Data Services** — batch scoring for "partners who have a list of wallet addresses."
- **Holonym / Human ID credentials** (the ZK layer, separately routable): `kyc` (government ID),
  `phone`, `clean-hands` (sanctions), `biometrics`, and **NFC e-passport**. "Each verification type
  uses a different ZK circuit." Example endpoint form seen in docs:
  `https://api.holonym.io/sybil-resistance/gov-id/optimism` — note the **chain segment in the path**,
  implying per-chain attestation.
- **Scale:** "over 2M Human Passport users" (docs, undated). human.tech announced plans to roll out
  **34.5 million ZK credentials** across that base — an announcement, not a delivered number.
- **Pricing:** described as a **free API** in the docs blurb. `UNVERIFIED:` the agent searched
  explicitly for pricing tiers and found nothing usable; the quick-start page 301-redirected from
  `docs.passport.xyz` to `docs.passport.human.tech` and was never re-fetched. **Confirm whether an
  API key is required and what the rate limits are** before designing around it.
- **Alive:** **very.** [`passportxyz/passport`](https://github.com/passportxyz/passport) (1,225★) was
  pushed **2026-07-24 18:44Z** — the same day as the research. `holonym-foundation/id-server` pushed
  2026-07-23. Both organisations are active.
- **Routable?** **Yes — as a source, cautiously.** Take the Holonym ZK credentials (independent trust
  roots) and treat the aggregate Passport score as a *correlated* signal we must not stack on top of
  the stamps we already count ourselves. Double-counting risk is severe here: their score is built
  from the same GitHub/Google/ENS stamps everyone else uses.

## Civic

- **One-liner:** gateway-token identity passes; the **Uniqueness Pass** binds one 3D face map to one
  EVM wallet and one Solana wallet.
- **Category:** liveness (secondary: uniqueness, vendor-enforced)
- **What it actually proves:** the user completed a **video selfie liveness check**, producing "a 3D
  face map which is securely stored in encrypted format **in Civic's server**." Uniqueness is enforced
  by Civic deduplicating face maps centrally — *not* cryptographically. Non-transferable pass.
  **That is a custodial biometric database**, with the failure mode that implies.
- **Chains:** Solana (primary), Ethereum, Polygon, Arbitrum, other EVM. On-chain readable as a gateway
  token, which is genuinely useful — a contract can check pass possession directly.
- **Program IDs found** (Solana, from `civicteam` repo configs — `UNVERIFIED:` not explorer-checked):
  Civic Pass gatekeeper network `tgnuXXNMDLK8dy7Xm1TdeGyc95MDym4bvAQCwcW21Bf`; gateway program
  `gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs`; Token-2022 transfer hook
  `cto22FHACEgis1zXbY4QJo5Rj6soAQguh1686nZJfNY`.
- **Pricing — the only clean number in this file:** **$0.05 per active pass per month**, usage-based;
  "only active Civic Passes will be billed; revoked passes are excluded." Blockchain fees excluded.
  A recurring per-user monthly cost is a materially different cost shape from a one-off verification
  fee, and it argues against Civic as a default route.
- **Alive:** organisation active — several `civicteam` repos updated 2026-04-16 — **but the core
  gateway repos are stale**: [`token-guard`](https://github.com/civicteam/token-guard) last pushed
  **2021-12-20**. Note the 2026 activity is in repos named `langchain-nexus-reference-implementation`,
  `deepagents-reference-implementation-civic`, `kiro-reference-implementation-civic`,
  `linkedin-mcpserver` — **Civic's engineering attention has visibly moved to AI-agent tooling.**
  Read that as a pivot signal.
- **Routable?** **Maybe.** On-chain readable and cheap per-check, but centralised biometrics, a
  monthly per-user fee, and an apparent pivot away from the identity gateway product.

## Fractal ID

- **One-liner:** KYC/AML platform for regulated web3, with a proof-of-personhood tier.
- **Status — the thing the brief asked about:** **breached, but not shut down.** On **2024-07-14** an
  infostealer infection on an employee machine led to a backoffice compromise. Reporting says KYC data
  of **over 55,000 individuals** was exposed; **Fractal's own post-mortem** puts the impact at
  **6.3k users (~0.5% of the user base)**. Leaked fields included names, emails, wallet addresses,
  physical addresses, phone numbers, **facial images and photos of passports and driver's licences**.
- That is the worst-case realisation of the custodial-KYC model, and it is the strongest available
  argument for preferring ZK/on-device document verification (ZKPassport, Self) over vendor-held
  document KYC. **Cite this incident when justifying architecture choices.**
- **Current direction:** a blog post titled *"A better way is possible: Dataless KYC and Open Sourcing
  Fractal ID"* suggests a pivot toward dataless KYC and open source. `UNCLEAR:` the agent tried to
  fetch it and got `getaddrinfo ENOTFOUND web.fractal.id` — **their blog host did not resolve at
  research time**, which is itself a mild health signal. Company site `trustfractal.com` /
  `company.fractal.id` positions as "user-centric KYC/AML platform for Fintechs" — note the *fintech*
  framing, which reads as a move away from web3.
- **Alive:** ambiguous. No shutdown evidence. No 2026 product evidence either. `UNVERIFIED:` scale,
  pricing (Capterra lists it; specifics not captured), GitHub activity — never checked.
- **Routable?** **No, not now.** Custodial KYC with a breach history and an unclear pivot. Revisit only
  if the dataless/open-source direction ships.

## zkMe

- **One-liner:** ZK identity oracles for cross-chain credential verification; FATF-compliance oriented.
- **Category:** state-identity (zkPassport-style attribute proofs) + KYC compliance
- **Products:** `zkPassport` (prove sovereign-ID attributes — e.g. nationality for compliance —
  without disclosing name, passport number, or DOB), `zkKYC`, and **`zkKYA` — "Know Your Agent"**, a
  DID/VC framework for AI agents. The agent-identity theme recurs across this whole landscape
  (Self's Agent ID, Humanity's Agent products, Civic's pivot) and is worth noting as where commercial
  demand is heading.
- **Integration:** [`zkMeLabs/zkme-sdk-js`](https://github.com/zkMeLabs/zkme-sdk-js), npm packages
  under the **`@zkmelabs`** scope. Flow requires user authorisation *before* results can be queried.
  `UNCLEAR:` whether self-serve or partnership-gated — docs don't say, and the page directs partnership
  enquiries to `contact@zk.me`, which usually means gated. No pricing published.
- **Scale:** **3.5 million users as of Feb 2026**; "over 3 million verifications across 30+ blockchain
  networks" by Oct 2025. Secondary sources (Tracxn / CoinDesk), date-stamped. Won a $20k PitchFest
  prize at Consensus Hong Kong, Feb 2026, and was raising a Series A at that point.
- **Routable?** **Maybe.** Real scale and multi-chain, but likely partnership-gated and no on-chain
  read path was found. `UNVERIFIED:` contract addresses — none found.

## Galxe Passport

- **One-liner:** soulbound KYC token minted after a **Sumsub** verification; positioned as reusable
  compliance identity across Galxe's quest ecosystem.
- **Category:** state-identity via a *third-party KYC vendor* — the trust root is **Sumsub**, not Galxe.
- **How it works:** "a UUID is generated for the user and passed to Sumsub, which uses this UUID to
  uniquely identify a person and group all verifications together." So uniqueness is Sumsub-side
  deduplication. Identity data is encrypted client-side with the user's password; ZK proofs are used
  when sharing age/country. **V3** adds reusable KYC across platforms.
- **On-chain:** SBT contract **`0xe84050261cb0a35982ea0f6f3d9dff4b8ed3c012` on BNB Chain**, with a
  `getNumMinted()` view. `UNVERIFIED:` not explorer-confirmed; mint count never read — **that call is
  a one-liner and would give us a real adoption number.**
- **Routable?** **Maybe, low priority.** On-chain readable (good) but BNB Chain-only, KYC-flavoured
  rather than personhood, and the trust root is a conventional KYC vendor — which correlates with
  every other Sumsub-backed credential.

## Privado ID → Billions Network

- **One-liner:** the iden3/Circom self-sovereign-identity stack, spun out of Polygon Labs (June 2024)
  as Privado ID, then relaunched as consumer network **Billions** in Feb 2026.
- **Lineage, which is confusing and worth stating plainly:** Polygon ID → Privado ID → **Billions**.
  The GitHub org is still `0xPolygonID`, now titled "Billions Network & Privado ID". Privado ID
  continues as the enterprise/government-facing arm while Billions is the consumer network.
- **Raised $30M** on the Billions relaunch; mobile app with "over 1 million pre-registered users."
  Explicitly positioned as taking on World ("Privado ID's Billions Network takes on World",
  Biometric Update, Feb 2026) — verification "using just a passport and phone, **without biometric
  hardware**," for humans *and* AI agents.
- **Tech:** Iden3 protocol, Circom zkSNARK circuits, W3C VCs/DIDs. Contracts deployed to **Polygon PoS
  mainnet and Amoy testnet**, "could be deployed into any other EVM-compatible chain." Already
  collaborating with the **Verax attestation registry on Linea** for cross-chain identity — see the
  Privado/Verax salvage row for detail.
- **Alive:** yes. [`0xPolygonID/contracts`](https://github.com/0xPolygonID/contracts) updated
  **2026-07-03**; `issuer-node` 2026-04-06 (releases up to v2.3.0); `c-polygonid` 2026-04-02.
- **Routable?** **Maybe — and treat as a competitor too.** Billions is a direct rival to World and,
  by extension, overlaps our thesis. Privado ID's *issuer/verifier infrastructure* is the genuinely
  interesting part for us: a permissionless VC stack we could issue our own aggregate credential on.
  `UNVERIFIED:` contract addresses.

## What this file changes about our thinking

1. **We are not first.** Human Passport and Billions both aggregate. Our differentiation has to be
   the *quality and independence of the routed credentials* — cryptographic, on-chain, permissionless
   roots — not the mere act of aggregating web2 stamps.
2. **Cost shapes differ wildly and nobody publishes properly.** Civic charges $0.05/active pass/month
   (recurring); Humanity charges per verification; Human Passport claims free; zkMe, Galxe, Fractal
   publish nothing. **Any routing logic needs a cost model per source**, and most of the inputs are
   currently unknown.
3. **Fractal's 2024 breach is our architectural argument.** 55k people's passport photos leaked from
   a custodial KYC provider. Prefer on-device ZK document proofs.
4. **Everyone is pivoting to AI agents.** zkKYA, Self Agent ID, Humanity's agent products, Civic's
   agent tooling. Whether or not we follow, it tells us where these vendors' roadmaps are going —
   and that "proof of human" is increasingly being sold as "proof of *not* agent."

## Open questions

1. Does the Human Passport API need a key, and what are its limits? (301 redirect was never followed.)
2. Call `getNumMinted()` on the Galxe SBT — free adoption number.
3. Is zkMe self-serve or partnership-gated?
4. Did Fractal ID's "dataless KYC + open source" pivot actually ship? Their blog host didn't resolve.
5. Can we issue *our own* aggregate credential on the Privado/iden3 issuer stack rather than building
   credential plumbing ourselves?

## Sources

- [Human Passport docs](https://docs.passport.xyz/) · [Stamps API quick start](https://docs.passport.human.tech/building-with-passport/stamps/passport-api/quick-start-guide) · [Individual Verifications](https://docs.passport.xyz/building-with-passport/individual-verifications/introduction) · [Data Services](https://docs.passport.xyz/building-with-passport/data-services) · [passportxyz/passport](https://github.com/passportxyz/passport)
- [Human ID docs (Holonym)](https://docs.holonym.id/for-developers/start-here) · [credentials](https://docs.holonym.id/how-it-works/credentials) · [ePassport verification](https://docs.holonym.id/for-users/how-to-verify-epassport) · [holonym-foundation](https://github.com/holonym-foundation) · [Biometric Update — Holonym acquires Gitcoin Passport](https://www.biometricupdate.com/202502/holonym-acquires-gitcoin-passport-in-proof-of-personhood-expansion)
- [Civic Uniqueness Pass](https://support.civic.com/hc/en-us/articles/6855280050839-What-is-Civic-Uniqueness-Pass) · [Civic Pass pricing](https://www.civic.com/pricing/pass-pricing) · [civicteam](https://github.com/civicteam) · [token-guard](https://github.com/civicteam/token-guard)
- [Fractal ID breach post-mortem](https://web.fractal.id/fractal-id-data-breach-post-mortem/) · [Under the Breach analysis](https://medium.com/@underthebreach/infostealer-infection-results-in-blockchain-identity-platform-fractal-id-hack-09513d2af3d1) · [trustfractal.com](https://www.trustfractal.com/) · [KYC levels docs](https://docs.developer.fractal.id/kyc-levels)
- [zkMe docs](https://docs.zk.me/) · [zkPassport](https://docs.zk.me/hub/how-built/id-infra/zkpassport) · [zkKYA](https://docs.zk.me/hub/what/zkkya) · [credential catalog](https://docs.zk.me/hub/what/catalog) · [zkMeLabs/zkme-sdk-js](https://github.com/zkMeLabs/zkme-sdk-js)
- [Galxe Passport docs](https://docs.galxe.com/galxe-id/galxe-passport/introduction) · [SBT on BscScan](https://bscscan.com/address/0xe84050261cb0a35982ea0f6f3d9dff4b8ed3c012) · [Passport V2 blog](https://www.galxe.com/blog/passport-v2)
- [Privado ID](https://www.privado.id/) · [0xPolygonID](https://github.com/0xPolygonID) · [The Block — spin-out](https://www.theblock.co/post/299898/polygon-id-spins-out-from-polygon-labs-as-privado-id) · [Biometric Update — Billions takes on World](https://www.biometricupdate.com/202502/privado-ids-billions-network-takes-on-world) · [VentureBeat — Billions launch](https://venturebeat.com/business/billions-network-launches-universally-accessible-verification-platform-for-humans-and-ai)
