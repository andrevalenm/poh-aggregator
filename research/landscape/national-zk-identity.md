# National & government ZK identity programs

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). Four programs salvaged well. The long tail the
> agent was asked about — Estonia, Ukraine Diia, Aadhaar's official offline eKYC, Singpass, MOSIP
> deployments, US mDL states, UK One Login, Japan JPKI, Brazil gov.br — was **never reached**.
> Companion file: [government-standards-track.md](government-standards-track.md).

**The headline answer to the brief's key question — "has any government deployed a ZK-based identity
credential in production?" — is yes.** At least three, at meaningful scale, and one of them covers
3.6 million people. This is no longer a research topic.

## Buenos Aires — QuarkID

**The largest production deployment found.**

- **Status:** live since **2024-10-01**. All active users of **miBA**, the city's government-services
  app, were issued a decentralised identifier (DID) — **more than 3.6 million citizens**.
- **Chain:** ZKsync **Era** (L2). Anchoring only; the ZK in "ZK-backed" here is largely ZKsync's
  rollup proving, not necessarily per-credential ZK predicate proofs.
- **Credentials:** birth, marriage and death certificates, driver's licences, vaccine records, tax
  information — "over 60 other documents." Banks are reported to be adopting citizen credentials for
  **KYC**, and private companies are issuing their own credentials on it.
- **Open source:** [`ssi-quarkid`](https://github.com/ssi-quarkid) on GitHub. Built on W3C, Trust Over
  IP and Sovrin standards; described as "decentralized, public, permissionless, open, extensible, and
  capable of interoperating with other similar protocols."
- **Assessment — be careful with the marketing.** Sources describe it as "the first city worldwide to
  implement blockchain and zero-knowledge cryptography for self-sovereign digital identities," but
  the substantiated claims are **DIDs + verifiable credentials anchored on a ZK-rollup**. That is not
  the same as unlinkable ZK presentation of a credential. `UNCLEAR:` whether QuarkID does per-proof
  ZK selective disclosure — the agent was asked exactly this and did not resolve it. **Do not
  describe QuarkID as ZK personhood without checking the protocol repo.**
- **Routable?** `UNVERIFIED:` — no DID method, contract address, or verification path was captured.
  But a permissionless, open-source protocol on an EVM L2 with 3.6M government-issued credentials is
  worth real investigation. **The most interesting unexplored lead in this file.**

## Bhutan NDI

**The clearest case of genuine ZK predicate proofs in a national ID.**

- **Status:** launched **2023** by Druk Holding and Investments — "the first country to implement a
  national-scale SSI-based digital identity."
- **ZK: yes, and structurally so.** The ecosystem "leverages **AnonCreds**-based verifiable
  credentials, allowing parties to exchange verifiable data supported by zero-knowledge proof
  protocols. For example, someone can confirm they are over 18 without showing their exact date of
  birth." AnonCreds uses CL signatures, which give genuine unlinkable presentation and predicate
  proofs — **materially stronger privacy than the mdoc/SD-JWT salted-hash approach the EU is
  shipping**. See [government-standards-track.md](government-standards-track.md).
- **Chain migration is unusual and worth noting:** Hyperledger **Indy** → **Polygon** (Aug 2024) →
  **Ethereum** (migration begun Oct 2025, targeted early 2026). A sovereign state anchoring its
  national identity registry on Ethereum mainnet is a notable precedent.
- `UNVERIFIED:` user numbers — never sourced. Bhutan's population is ~800k, so the absolute ceiling
  is small regardless.
- **Routable?** Probably not directly — small population, and third-party verification without
  government cooperation is unconfirmed. **Valuable as a design reference**: it is the working
  existence proof that AnonCreds-style ZK credentials can run a national ID.

## Taiwan Digital Identity Wallet (TW DIW)

- **Status:** launched **December 2025** by the Ministry of Digital Affairs (moda) — a **voluntary**
  mobile app. A sandbox programme is open for applications; now "entering the second year" of the
  project.
- **Credentials:** Citizen Digital Certificates, National Health Insurance cards, driver's licences.
- **ZK:** claimed — "the selective disclosure feature, **powered by zero-knowledge proof technology**…
  enables users to selectively disclose only necessary information, such as verifying age without
  revealing birthdate." `UNCLEAR:` whether this is real ZK or the usual loose use of the term for
  salted-hash selective disclosure. Given that the example given (age without birthdate) is precisely
  the predicate salted-hash disclosure *cannot* do, it may be genuine — but verify.
- **Routable?** No. Voluntary, new, and no third-party verification path documented.

## EU Age Verification Blueprint — unlinkable by design

Distinct from the EUDI Wallet itself, and the most privacy-forward government artifact found:

> "Unlinkability is achieved by design through Zero-Knowledge Proof cryptography… the link between the
> user and the proof provider is cut after the proof of age is issued, and no further data is
> exchanged. A ZKP-based approach… makes it computationally infeasible for the Relying Party to
> associate multiple proofs with the same individual."

**Piloted by seven front-runner member states — France, Denmark, Greece, Italy, Spain, Cyprus and
Ireland — who plan to integrate the app into their national EUDI Wallets.**

This matters more than it first appears: it is the EU shipping *actual unlinkable ZK* in a narrow
vertical (age) ahead of the general wallet, and it is the likely on-ramp by which ZK reaches the EUDI
mainline. Age verification is not personhood — but the *mechanism* is exactly what a personhood
credential would need.

## Switzerland — swiyu / E-ID

- Uses **JSON-LD verifiable credentials with BBS+ signatures**, chosen explicitly for unlinkability:
  "BBS+ has the ability of blinding, or randomizing, its signatures, resulting in verifiable
  presentations of credentials that do not contain any constants and therefore cannot be linked to a
  specific holder."
- Forward-looking: "In the future, zero-knowledge proofs should be used, allowing users to prove
  information like being over 18 with predicates calculated via ZKPs without disclosing complete
  information," with research agreements on unlinkability, ZKP and post-quantum crypto **running
  until 2029**.
- **Switzerland has made the choice the EU has not** — BBS+ as the default signature scheme rather
  than salted-hash SD-JWT. If we ever want the strongest government credential to consume, this is
  the design to watch.
- `UNVERIFIED:` launch status, user numbers, and whether swiyu is in production as of 2026-07.

## MOSIP / Inji

- [`mosip/inji-wallet`](https://deepwiki.com/mosip/inji-wallet) — React Native wallet for storing and
  sharing VCs, supporting **OpenID4VP** and Bluetooth Low Energy presentation.
- MOSIP is the open-source ID platform behind several national deployments (Ethiopia Fayda, Zambia,
  Sri Lanka were on the agent's list). **None of those deployments were researched.**
- `UNVERIFIED:` whether MOSIP/Inji supports ZK at all.

## Negative and unknown results

The brief explicitly asked for negative results, and honesty about coverage matters more than a long
list. **The following were on the list and never searched at all** — their absence here is *not*
evidence of absence:

Estonia (eID / Smart-ID / Mobile-ID / X-Road), Ukraine **Diia**, **India Aadhaar's official offline
eKYC** (the signed UIDAI XML, Virtual ID, tokenisation, and the 2025 face-auth app — this is the
**trust root for Anon Aadhaar** and is a significant gap), Singapore **Singpass**, Nigeria NIN,
Ethiopia **Fayda**, South Korea mobile ID, Japan **My Number Card / JPKI**, US state **mDL** issuance
and Apple/Google Wallet ID support, **UK GOV.UK One Login**, Brazil **gov.br**, and Italy's
**IT-Wallet**.

## What this changes about our thinking

1. **Government ZK credentials exist in production today.** Buenos Aires (3.6M), Bhutan (AnonCreds
   predicates), Taiwan (Dec 2025), and the EU age-verification pilot across seven states. The question
   is no longer "will governments do this" but "when does the coverage become material to us."
2. **AnonCreds and BBS+ are the serious privacy designs; salted-hash SD-JWT is the one shipping at
   scale.** Bhutan and Switzerland chose the former, the EU mainline the latter. We should score a
   BBS+/AnonCreds government credential *higher on privacy* than an mdoc one, and be explicit that the
   privacy of an aggregate depends on the weakest ingredient.
3. **QuarkID is the one to investigate next.** Open source, EVM L2, permissionless, 3.6M real
   government-issued credentials, banks already consuming it for KYC. If a third party can verify a
   QuarkID credential without the city's cooperation, that is a genuinely routable
   state-identity source at a scale nothing else in our landscape matches.
4. **Aadhaar's official path is a hole we should close.** Anon Aadhaar's trust root is UIDAI's
   signature, and we never examined what UIDAI actually signs. ~1.4B people makes this the
   highest-leverage unknown in the entire research set.

## Open questions

1. Does QuarkID do per-credential ZK selective disclosure, or only ZK-rollup anchoring? What DID
   method, and can a third party verify without the city?
2. What does UIDAI actually sign in Aadhaar Paperless Offline e-KYC, and is it ZK-friendly?
3. Is Taiwan's "ZKP-powered selective disclosure" real ZK?
4. Is Swiss swiyu in production, and on what timeline?
5. Which US states issue ISO 18013-5 mDLs, and can they be verified online via 18013-7?

## Sources

- **QuarkID:** [ssi-quarkid GitHub](https://github.com/ssi-quarkid) · [ZKsync case study (PDF)](https://www.zksync.io/papers/QuarkID_and%20Government%20of_Buenos_Aires_Case_Study.pdf) · [Biometric Update — Buenos Aires moves to decentralized ID](https://www.biometricupdate.com/202410/buenos-aires-moves-from-centralized-to-decentralized-digital-identity-with-quarkid) · [Biometric Update — open sourcing QuarkID](https://www.biometricupdate.com/202402/buenos-aires-integrates-open-sources-self-sovereign-identity-protocol-quarkid) · [GlobeNewswire — 3.6M citizens](https://www.globenewswire.com/news-release/2024/10/22/2967256/0/en/Buenos-Aires-Sets-Global-Precedent-by-Empowering-3-6-Million-Citizens-with-Blockchain-based-Digital-Identity-on-miBA-platform.html) · [CoinDesk, 2023-09-28](https://www.coindesk.com/tech/2023/09/28/buenos-aires-releases-blockchain-digital-identity-solution-powered-by-matter-labs-zk-proofs)
- **Bhutan NDI:** [ToIP case study (PDF, 2024-05-21)](https://trustoverip.org/wp-content/uploads/Case-Study-Bhutan-NDI-National-Digital-Identity-ToIP-Digital-Trust-Ecosystems-V1.0-2024-05-21.ext_.pdf) · [Web of Trust project page](https://www.weboftrust.org/project/bhutan_national_digital_identity-182) · [Biometric Update — migration to Ethereum](https://www.biometricupdate.com/202510/bhutan-begins-migrating-self-sovereign-digital-id-to-ethereum) · [ID Tech — shift to Polygon](https://idtechwire.com/bhutans-digital-id-system-shifts-to-polygon-blockchain/)
- **Taiwan:** [What Is the Taiwan Digital Identity Wallet?](https://civictech.moda.gov.tw/en/what-is-the-taiwan-digital-identity-wallet/) · [moda press release](https://moda.gov.tw/en/press/press-releases/15544) · [sandbox programme](https://moda.gov.tw/en/press/press-releases/15752) · [W3C TPAC 2025 — year two](https://denkeni.org/W3C-TPAC-2025/Templates/Overview.html)
- **MOSIP:** [mosip/inji-wallet](https://deepwiki.com/mosip/inji-wallet)
- **Background:** [Bringing data minimization to digital wallets at scale with general-purpose ZKPs (arXiv)](https://arxiv.org/pdf/2301.00823) · [zk-X509: Privacy-Preserving On-Chain Identity from Legacy PKI (arXiv)](https://arxiv.org/pdf/2603.25190) · [IOTA ZK-SD-VCs docs](https://docs.iota.org/developer/iota-identity/how-tos/verifiable-credentials/zero-knowledge-selective-disclosure) · [The Decentralisation Paradox in Digital Identity (arXiv)](https://arxiv.org/pdf/2603.16403)
