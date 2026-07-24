# KYC / liveness vendors & web2 social signals

> **Salvaged.** Reconstructed from two research agents (rows 17 and 18) killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). Row 18 hit **two** limits — it also **exhausted the
> session's 200-call web search budget** before the session limit hit, so it fell back to direct
> WebFetch and covered only Farcaster. zkTLS providers (Reclaim, zkPass, Opacity, Primus, TLSNotary),
> Lens, and Bluesky were **never researched at all**.

**This file contains the only real pricing data in the entire research set.** Traditional KYC vendors
publish prices; crypto identity protocols almost universally do not.

## The analytical point that governs this whole file

A liveness check without **1:N deduplication across the entire user base** provides **no uniqueness
whatsoever**. It proves a live human was present — that human can repeat the process arbitrarily many
times with different documents or accounts. Likewise, a web2 account proof proves **an account exists**,
not that a unique human controls it; the marginal sybil cost is simply the market price of an aged
account.

Both categories are therefore *liveness* or *web2-account* tier in our taxonomy — the two weakest —
unless dedup is explicitly offered. **The agent was asked to state per-vendor whether 1:N dedup
exists, and did not get far enough to answer for any of them.** That is the key unanswered question
here.

## KYC / liveness vendors

### Sumsub — the most crypto-relevant, and it publishes prices

- **Pricing, published:** **$1.35 per verification** for non-regulated businesses (fraud deterrence),
  **$149/month minimum**. **$1.85 per verification** for regulated businesses, **$299/month minimum**,
  including AML screening, ongoing monitoring, and proof of address.
- Full-stack REST API: KYC, KYB, AML screening, transaction monitoring, Travel Rule, fraud and device
  intelligence, case management.
- **Already publishes on-chain attestations** — "Sumsub publishes on-chain identity verification
  attestations to the **Linea** blockchain via the **Sumsub Verax portal**," and partners with
  **Binance's BNB Attestation Service**, explicitly framed as mitigating sybil risk "when a single user
  controls many wallets."
- **Sumsub is also the KYC engine behind Galxe Passport** (see
  [commercial-identity-vendors.md](commercial-identity-vendors.md)) — so a Galxe Passport and a
  Sumsub attestation share a trust root and **must not be counted twice**.
- This also answers an open question from [attestation-substrates.md](attestation-substrates.md):
  Verax does have a real personhood-adjacent issuer, and it is Sumsub.

### Persona

- **Pricing, published:** **$1.50 per KYC verification**, plans from **$250/month** (Essential).
- API via Inquiries (hosted flow, embedded flow, iOS/Android SDKs), webhooks for real-time status.
- US company, founded October 2018.

### iProov

- **Dynamic Liveness** — "multi-frame face liveness with a patented, secure, passive
  challenge-response" providing **Presentation Attack Detection (PAD)**, **Injection Attack Detection
  (IAD)**, and mitigation of deepfake/genAI threats, using patented **Flashmark** illumination.
- Onboarding is explicitly three-stage: verify liveness → match face to a known identity → **create a
  reusable biometric profile**. That third step is where dedup *could* live.
- **No published pricing** — "enterprise pricing and procurement may not suit very small-volume buyers."
- Sobering counterpoint from their own research: iProov has itself demonstrated
  [a face-swapping app fooling liveness detection on financial apps](https://www.biometricupdate.com/202512/iproov-shows-how-face-swapping-app-can-fool-liveness-detection-on-financial-apps)
  (Dec 2025). **Liveness is an arms race, not a solved problem** — relevant to how much weight any
  selfie-based credential should carry, including Civic's and World's Selfie Check.

### FaceTec

- Patented **ZoOm** FaceScan builds a **3D FaceMap from a 2-second video selfie**, proving liveness and
  matching FaceMaps "to both photo IDs for onboarding **and to stored 3D FaceMaps**" — that last
  clause implies 1:N matching capability, which would be the dedup primitive.
- A [pricing page exists](https://www.facetec.com/pricing) but values were not captured.
- `UNVERIFIED:` the brief asked specifically whether Humanity Protocol or Idena license FaceTec —
  **searched, nothing found.** Do not assert a link.

### Not researched

Onfido (now Entrust), Veriff, Jumio, Au10tix. Also **iBeta / NIST FRVT PAD certification** and
**ISO/IEC 30107-3 PAD levels** — which the brief correctly identified as *the objective quality bar*
for comparing liveness vendors. Without those we have no principled way to rank them. **Close this
gap before weighting any biometric vendor.**

The Ethereum-research proposal layer (part B of that agent's brief) was also never reached.

## Farcaster — Neynar user quality score

The only web2/social signal that got researched, and it is instructive.

- **Range 0 to 1**, reflecting "the confidence in the user being a high-quality user."
- **The docs are refreshingly explicit:** *"The score is **not** proof of humanity. It's a measure of
  the account quality / value added to the network."* The algorithm deliberately "can distinguish
  between valuable bot activity (like agents) and low-quality AI-generated content" — i.e. **a good bot
  scores well**. That is the opposite of what we want, and a perfect illustration of why behavioural
  quality scores must not be treated as personhood evidence.
- **Distribution (Dec 2024):** ~**2,500 accounts at 0.9+**, ~**27,500 at 0.7+**. Recommended starting
  threshold **0.55**. Recomputed weekly.
- **Access:** webhooks (`neynar_user_score` field), API by fid or address, SQL playground, and
  **an on-chain contract** — so it is readable without trusting Neynar's API.
- **Routable?** Maybe, as a weak behavioural input only. Its own authors say it isn't personhood.

### Farcaster sybil cost

The fid registry and storage rent are the real sybil-resistance mechanism: storage units are rented
**per year** via the Storage Registry, with a `unitPrice` in wei and refund of excess.
> `UNVERIFIED:` **the actual contract addresses, chain, and current storage price were never
> retrieved** — the docs page pointed to a Deployments page the agent didn't reach before dying.
> Farcaster contracts are on **Optimism** per the brief's premise, but that is unconfirmed here.
> Without the price, we cannot state the marginal cost of a farmed fid — which is exactly the number
> that would tell us how much a Farcaster signal is worth.

## Never researched

- **zkTLS / web-proof providers: Reclaim Protocol, zkPass (TransGate), Opacity Network, Primus Labs
  (formerly PADO), TLSNotary (PSE).** This is a significant gap. zkTLS lets a user prove facts about
  *any* web2 account — bank balance, exchange KYC status, government portal data — without the site's
  cooperation. **That is a general-purpose bridge from the entire web2 world into our aggregator**, and
  it is the single most interesting unexplored category in the salvage.
- **Lens Protocol** (profile NFT as personhood signal, handle costs), **Bluesky / AT Protocol**
  (domain-handle verification, 2025 trusted-verifier system).
- Telegram/Discord/Twitter attestation providers, Guild.xyz, Collab.Land.
- **Market prices for aged social accounts** — which is the number that determines what any web2 stamp
  is actually worth.

## What this changes about our thinking

1. **We finally have price anchors: ~$1.35–1.85 per KYC verification.** Any personhood route we build
   competes against that. If a crypto-native credential costs more than $1.85 all-in, it needs to be
   better on privacy or uniqueness to justify itself — which the good ones (PoH v2 free on-chain,
   ZKPassport, Circles free) comfortably are. **This is a strong argument for our approach: the
   cryptographic routes are cheaper *and* more private than the incumbent.**
2. **Sumsub is a trust root behind multiple "different" credentials** (Galxe Passport, Verax
   attestations, BNB Attestation Service). Deduplicate by root, not by brand.
3. **Liveness ≠ uniqueness, and liveness is breakable.** iProov's own face-swap demonstration should
   temper how much any selfie-based credential scores.
4. **Neynar's disclaimer is a model of honesty we should copy.** Publishing what our score is *not*
   is as important as publishing what it is.
5. **Investigate zkTLS next.** It is the widest unexplored on-ramp.

## Open questions

1. **Which of these vendors actually offer 1:N dedup?** Unanswered for every single one, and it
   determines whether any of them provide uniqueness at all.
2. What are iBeta / NIST FRVT PAD certifications and ISO/IEC 30107-3 levels per vendor?
3. What does a Farcaster fid + storage unit actually cost, and on which chain?
4. Full zkTLS landscape.
5. What does an aged Twitter/Discord account cost on the open market?

## Sources

- **Sumsub:** [pricing](https://sumsub.com/pricing/) · [Binance BNB Attestation Service partnership](https://sumsub.com/newsroom/sumsub-partners-with-binances-bnb-attestation-service-to-streamline-web3-identity-verification/)
- **Persona:** [API introduction](https://docs.withpersona.com/api-introduction) · [Wikipedia](https://en.wikipedia.org/wiki/Persona_(identity_verification_service)) · [Capterra pricing](https://www.capterra.com/p/199701/Persona/)
- **iProov:** [product overview docs](https://docs.iproov.com/getting_started/product_overview/) · [Face Verifier](https://www.iproov.com/iproov-system/iproov-products-for-biometric-authentication/iproov-face-verifier) · [liveness detection](https://www.iproov.com/liveness-detection) · [face-swap app fools liveness (Biometric Update, 2025-12)](https://www.biometricupdate.com/202512/iproov-shows-how-face-swapping-app-can-fool-liveness-detection-on-financial-apps)
- **FaceTec:** [facetec.com](https://www.facetec.com/) · [developers](https://www.facetec.com/developers) · [pricing](https://www.facetec.com/pricing) · [3D liveness](https://dev.facetec.com/3d-liveness)
- **Farcaster / Neynar:** [Neynar user quality score](https://docs.neynar.com/docs/neynar-user-quality-score) · [IdRegistry reference](https://docs.farcaster.xyz/reference/contracts/reference/id-registry) · [contract deployments](https://docs.farcaster.xyz/reference/contracts/deployments) · [Storage Registry](https://docs.farcaster.xyz/reference/contracts/reference/storage-registry)
