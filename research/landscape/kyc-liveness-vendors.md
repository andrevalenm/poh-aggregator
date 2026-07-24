# KYC / Identity-Verification / Liveness Vendor Layer

> STATUS: in progress

**One-liner:** The commercial IDV/biometrics vendors (FaceTec, iProov, Sumsub, Jumio, Persona,
Onfido/Entrust, Veriff, Incode, Au10tix, Trulioo, Socure, Regula, IDnow, Shufti) that sit *underneath*
most "web3 personhood" branding — they are the actual trust root for many protocols we score.
**Category:** liveness (mostly) + state-identity (document-based) — **rarely uniqueness**, because
uniqueness requires 1:N biometric dedup, which most of these products do not do by default.
**Chains:** none — all off-chain, Web2 SaaS.
**Status (2026-07):** live commercial market — see per-vendor notes.
**Aggregator verdict:** *not directly consumable as a credential*; these are **upstream dependencies
of other people's credentials** and the primary source of **double-counting risk** in our aggregate.

## Why this file exists
## Taxonomy: what each capability actually proves
## Vendor-by-vendor profiles

### FaceTec (US, Las Vegas) — the liveness engine under much of web3
- **Core product:** 3D Liveness from a short video-selfie, producing a proprietary **3D FaceMap®** /
  **3D FaceVector™** template; 1:1 face match claimed at **FAR 1/125,000,000 @ <1% FRR**.
  (https://www.facetec.com/, retrieved 2026-07-24 — vendor-sourced numbers.)
- **1:N dedup: YES, and this is the important part.** FaceTec Server exposes `/3d-db/search`
  (search one FaceMap against a 3D-DB) and `/3d-db/search-n-n` (all-vs-all duplicate sweep of an
  existing DB), plus a server config flag *"Account Deduplication Search On New Enrollments."*
  Claimed **1:N up to 1/1B FAR**, ~1s search over 1M FaceMaps.
  https://dev.facetec.com/1-to-n-search ; https://dev.facetec.com/technical-support-server-sdk-guides-fraud-deduplication ;
  https://dev.facetec.com/configuration-options
  - **Critical scoping caveat for us:** the 3D-DB is *the integrator's own database*, deployed in the
    integrator's FaceTec Server. There is no global cross-customer FaceTec identity graph. So FaceTec
    1:N gives uniqueness **within one protocol's user set**, not across protocols. Two different
    protocols both using FaceTec do **not** share a dedup namespace — but they *do* share the same
    liveness failure modes and the same template extractor, so their evidence is correlated even
    though their uniqueness sets are not.
  - It is also **opt-in configuration**. A protocol can ship FaceTec with dedup off and still say
    "FaceTec-powered biometrics." Do not infer uniqueness from the presence of FaceTec.
- **Documents:** Photo ID OCR + barcode + NFC chip scanning; FaceTec states unlimited photo-ID scans
  are bundled free with 3D Liveness licences (i.e. their monetisation is the liveness call).
- **UR® Codes:** digitally-signed offline credential containing biometric data — a portable
  credential format, relevant because it is the one FaceTec artifact that could in principle be
  presented to a third party (us) rather than checked by the issuer.
- **Certifications claimed:** "ISO 30107-3 Level 1-5 PAD & IAD" via iBeta. **NOTE:** ISO/IEC 30107-3
  itself defines Levels 1-2 in the iBeta programme; "Level 3-5" is FaceTec's own extended scheme, not
  a standardised tier. Treat "Level 5" as marketing unless a test report is produced. `UNVERIFIED:`
  I did not locate the underlying iBeta report PDFs for the higher levels.
- **Pricing:** monthly billing on 3D Liveness usage with a minimum monthly commitment; per-check rate
  not published. `UNCLEAR:` public per-verification price.

## Certifications that mean something (iBeta PAD / ISO 30107-3, NIST FRVT/FATE)
## The attribution problem: how to detect which vendor produced a credential
## Reverse index: vendor -> known web3 customers

*(building incrementally; each row needs a citation)*

| Vendor | Web3 customer | Evidence | Confidence |
|---|---|---|---|
| FaceTec | **Civic** (Civic Pass / "Proof of Personhood") | Civic publicly integrated FaceTec 3D Liveness + face matching in late 2023; Proof of Personhood product built on it. https://www.biometricupdate.com/202310/civic-introduces-proof-of-personhood-with-facetec-biometrics-and-liveness and https://www.biometricupdate.com/202412/civic-launches-tool-to-ease-web3-onboarding-and-sign-ins | **Confirmed** (trade press + vendor) |
| Sumsub | **idOS** (idOS Consortium member + governance committee) | https://financefeeds.com/reusable-kyc-comes-to-web3-as-sumsub-joins-idos-consortium/ ; https://idtechwire.com/sumsub-joins-idos-consortium-to-advance-reusable-identity-for-web3/ | **Confirmed** (press release) |
| Sumsub | **Solana Attestation Service**, **Linea / Verax**, **Chainlink ACE** on-chain attestations | https://ffnews.com/newsarticle/fintech/sumsub-on-chain-identity-attestations-verax/ ; https://www.prnewswire.com/news-releases/sumsub-partners-with-chainlink-to-power-cross-chain-identity-for-on-chain-compliance-302762707.html ; https://idtechwire.com/sumsub-launches-reusable-digital-id-verification-on-solana-blockchain/ | **Confirmed** (press release) |
| Sumsub | **Reown** (WalletConnect) — 450+ wallet providers via one SDK | https://reown.com/blog/how-sumsub-leveraged-reown-authentication-to-expand-compliance-offering | Confirmed (Reown case study) |

## The 2025-2026 deepfake / injection reality

**Bottom line: in 2026 a "liveness check" is a cost-imposition on the attacker, not a proof.** The
attack surface moved from *presentation* (hold a photo/mask to a camera — which PAD handles well) to
*injection* (bypass the camera entirely and feed a synthetic stream into the SDK), which PAD by
construction cannot see. iBeta PAD certification tests presentation attacks only.

- **iProov Threat Intelligence Report 2026** (published 2026-04, data from iProov's own iSOC —
  **vendor-sourced, treat as directional**):
  - **+741% year-over-year increase in iOS injection attacks** across 2025; H1 2025 was only +14%,
    but H2 2025 was **+1,151%** vs. H2 2024. The mobile platform that integrators assumed was the
    "hard" target (locked-down iOS camera stack) is the one that broke.
  - iProov frames this as the **"industrialisation"** of techniques previously limited to
    experimental/state-sponsored actors — now repeatable, packaged playbooks.
  - Deepfakes spreading from IDV flows into general corporate video workflows; image-to-video
    generation is collapsing the source material needed to build a synthetic identity.
  - https://www.iproov.com/reports/threat-intelligence-report-2026 ;
    https://www.businesswire.com/news/home/20260408812610/en/iProov-Issues-Annual-Threat-Intelligence-Report ;
    https://www.biometricupdate.com/202604/biometric-injection-attack-surge-spreads-to-ios-iproov-report
- Third-party corroboration of the deepfake wave (not IDV-specific): **Ponemon** — 41% of orgs have
  seen deepfake attacks targeting executives; **Gartner (Sept 2025)** — 37% of security leaders have
  encountered deepfake incidents on video calls. (Cited via the iProov coverage above; I did not
  retrieve the primary Ponemon/Gartner documents. `UNVERIFIED:` primary sources.)
- **Sumsub Identity Fraud Report 2025-2026** (vendor-sourced, n = 4M+ fraud attempts):
  - Global fraud rate **2.2%**; **crypto sector 2.2%**, financial services 2.7%.
  - **Deepfake incidents in crypto rose 654% from 2023 to 2024.**
  - Deepfakes are **11%** of top first-party fraud schemes (i.e. the real person is the fraudster).
  - Sumsub names crypto as the preferred target for *high-sophistication* attacks specifically
    because of fast account opening, high limits, pseudonymity and historically weak KYC.
  - https://sumsub.com/fraud-report-2025/ ;
    https://sumsub.com/newsroom/sumsubs-annual-report-fraud-shifts-to-complex-multi-step-schemes-in-2025-agentic-ai-scams-poised-to-surge-in-2026/
- **What this means for our score.** A liveness-only credential issued in 2023-2024 was worth more
  than one issued in 2026 under the same vendor, because the attacker's cost fell. Any credential we
  ingest that resolves to "passed a liveness check at time T" should be **decayed by vendor-era**, not
  just by age. And a liveness credential with no 1:N dedup behind it contributes **zero uniqueness**
  — it is at best a bot filter.

## The document-farm supply side (what it costs to defeat)

This is how we price the credential: **a credential is worth at most what it costs an attacker to
manufacture one.**

| Attack input | Reported cost | Source |
|---|---|---|
| AI-generated fake ID document image (OnlyFake-style service) | **~$15 each** | https://hackread.com/dark-web-operation-entirely-focused-on-kyc-bypass/ and coverage of OnlyFake; originally surfaced by 404 Media (2024). Secondary. |
| Forged physical Caribbean passport | **~$10,000** (2024) | Same coverage; note it was detected in ~20s by an exchange's MRZ/chip cross-check — i.e. the expensive forgery is the *worse* buy against chip-reading vendors. |
| **Genuine document + matching selfie/video, sold voluntarily by the real person** | price not disclosed in the reporting I found; described as "compensated participation," concentrated in **LATAM and Eastern Europe** | iProov dark-web investigation, Jan 2025: https://hackread.com/dark-web-operation-entirely-focused-on-kyc-bypass/ ; https://idtechwire.com/dark-web-operation-discovered-farming-biometric-data-to-bypass-kyc-systems/ `UNCLEAR:` per-identity price. |

**The critical structural point — "genuine-but-rented" identity.** iProov's investigation found a
dark-web operation whose entire product is *legitimately obtained* documents plus matching facial
imagery, acquired by paying real people for their identity. Against this input:
- document authenticity checks pass (the document is real);
- chip/NFC checks pass (the chip is real);
- 1:1 face match passes (the face is the document holder's);
- **liveness passes, because a real human really is present.**

Only **1:N dedup against the issuer's own enrolled population** catches it — and only if the same
human is re-sold twice into the same population. Against a farm with many distinct sellers, 1:N does
not catch it either. **This is the ceiling on what any KYC-derived personhood credential can prove:
it proves a human, not *this* human, and not *only once* across protocols.**

iProov's attack-tier taxonomy (useful for our scoring language):
1. **Basic** — static images / printed photos. Defeated by any iBeta L1/L2 PAD.
2. **Intermediate** — real-time face-swap and off-the-shelf deepfake software.
3. **Advanced** — custom AI models generating synthetic faces that *respond to liveness challenges*
   in real time.
Tier 3 plus camera injection is the 2026 state of the art, and it is what the +741% number is
measuring.

## Data-protection exposure (GDPR Art. 9, BIPA, Fractal ID precedent)
## Trust-root dedup table
## Open questions for us
## References
