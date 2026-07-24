# Social-platform signals & zkTLS / web-proof protocols

*Researched 2026-07-24. All on-chain figures measured directly against public RPC on that date.*

**One-liner:** Machinery for proving facts about web2 accounts to a chain without the platform's
cooperation (TLSNotary / Reclaim / zkPass / Opacity / Primus / Pluto / Clique), plus an honest
valuation of what those web2 facts are worth.

**Category:** **behavioral** — the weakest tier in the BRIEF taxonomy. zkTLS is a *transport*, not a
personhood claim; all personhood value lives in the underlying platform signal, and Part B prices
that at **$0.20–$5 per sybil for almost everything**, $30–300 for the strongest tail.

**Chains:** Primus verifiers on Arbitrum / BNB / opBNB (+ testnets, addresses in A.5); Reclaim across
~12 EVM chains + Solana + NEAR (addresses `UNVERIFIED:`); Opacity as an EigenLayer AVS on Ethereum;
Farcaster registries on OP Mainnet, Farcaster Pro `TierRegistry` on Base.

**Status (2026-07):** Reclaim, Primus and Opacity all shipping code this week. **TLSNotary still
`v0.1.0-alpha.15`, README says "should not be used in production."** **Pluto appears to have pivoted
away from zkTLS entirely** (org last push 2026-02-12; docs now describe browser automation, not web
proofs). Clique `UNVERIFIED:` — no live repo or docs located.

**Aggregator verdict:**
- **zkTLS → integrate later, behind a swappable adapter, and not for personhood.** Every shipping
  design has a single bribable party (proxy operator or SGX enclave), collusion is *undetectable* by
  the vendors' own admission, and even perfect soundness only faithfully transports a $2 fact. Keep
  the adapter for future *non-personhood* attestations (income, exchange balances, gig ratings) where
  the category has actually found product-market fit.
- **Social signals → zero positive weight; use as negative/routing signals only, escalation-never-denial.**
  Plus a short whitelist of genuinely cost-bearing bonuses: Farcaster Pro ($120/yr, on-chain
  verifiable), X verification-by-organisation, Google Workspace `hd` claim, aged-and-seasoned Reddit.
- **Do not use zkTLS to obtain signals that have a public API** (GitHub, Reddit profiles, Farcaster
  hubs). It is strictly more trust, cost and friction for the same fact.

## Part A — zkTLS / web proofs: the mechanism

### A.0 Taxonomy of security models

TLS gives you *authenticity in transit* but the session key is symmetric and known to both endpoints,
so a transcript proves nothing to a third party — the client could have forged it. Every zkTLS design
is a different answer to "how do we stop the client forging the transcript", and the answers have
**wildly different trust roots**. This is the section that matters; the marketing collapses all four
into "zkTLS" and they are not the same product.

| Model | Who is added to the session | What they see | Breaks if… |
|---|---|---|---|
| **MPC-TLS / three-party handshake** (TLSNotary, zkPass MPC mode) | A Notary co-computes the TLS session key with the client via garbled circuits; client holds the enc-key share, notary holds part of the MAC key | Only ciphertext + what the client chooses to open | Notary and client **collude** — the notary can hand over its MAC-key share and the client forges arbitrary transcripts. Also: bandwidth blowup (~32MB uploaded for a 100KB response, per zkPass docs) |
| **Proxy-witness** (Reclaim, zkPass proxy mode, Primus proxy mode) | A proxy sits on the wire and signs the ciphertext it relayed, plus the server cert / SNI | Ciphertext + destination + timing | The proxy is **dishonest or bribed**: it can sign a transcript for a session that never happened, since only it attests that these bytes came from that server. Also breaks under BGP hijack / DNS spoofing between proxy and server |
| **TEE attestation** (Opacity, Primus TEE mode, Clique) | A notary running inside SGX/TDX/Nitro; remote attestation vouches for the code | Plaintext, inside the enclave | The **TEE is broken** (SGX has a long list of practical side-channel and fault attacks) or the **manufacturer's attestation key is compromised/coerced**. Trust root is Intel/AMD/AWS, i.e. a corporation |
| **Restaking / crypto-economic** (Opacity on EigenLayer) | A staked operator set on top of one of the above | as above | Layered *on top of* another model — it converts "trust the notary" into "trust that fraud is detectable and the bond exceeds the payoff". Only works if misbehaviour is **provable to a slasher**, which for a proxy-witness forgery it generally is **not** |

Two consequences an aggregator must internalise:

1. **None of these are trustless.** Every one has a party who, if bribed, makes the proof worthless.
   For proxy-witness — the model that actually ships and is fast — that party is a **single server run
   by the protocol company**. Reclaim's own blog states the assumption plainly: "the proxy operator is
   honest" ([blog.reclaimprotocol.org/posts/proxying-is-enough](https://blog.reclaimprotocol.org/posts/proxying-is-enough),
   fetched 2026-07-24). For a sybil-resistance use case this is exactly backwards: the attacker is
   economically motivated, well-resourced, and only needs to compromise the notary **once** to mint
   unlimited credentials.
2. **The thing being proven is still a purchasable web2 account** (Part B). zkTLS at its very best
   faithfully transports a signal that costs $2. A perfect proof of a worthless fact is worthless.

### A.1 TLSNotary

**Model:** MPC-TLS, the original. Rust implementation at
[github.com/tlsnotary/tlsn](https://github.com/tlsnotary/tlsn). Prover and Notary jointly run the TLS
handshake so neither holds the full session key; the Notary signs a commitment to the transcript; the
Prover later opens selected byte ranges. Redaction is byte-range-level (commit to the whole
transcript, reveal substrings), which is genuinely good selective disclosure but leaks *structure* —
a verifier sees the shape and lengths of what was withheld.

**Status (2026-07):** Alive but explicitly **not production-ready**. Latest release
**`v0.1.0-alpha.15`, published 2026-05-21**; previous `alpha.14` 2026-01-14 (via GitHub releases API,
checked 2026-07-24). Latest commit on `main` 2026-06-23 (`fix(tlsn): do not write into a closed
client_io`). The README still says: *"This project is currently under active development and should
not be used in production. Expect bugs and regular major breaking changes."* Six years in and still
`0.1.0-alpha` — that is the single most informative fact about MPC-TLS as a production technology.
Funded by PSE (Ethereum Foundation), so it will not die, but it is a research artefact.

**Trust root:** the Notary must not collude with the Prover. Note the asymmetry: TLSNotary protects
the *verifier* against a lying prover, and protects the *prover's privacy* against the notary. It does
**not** protect against notary+prover collusion, which is precisely the sybil attacker's move.

**Cost/latency:** MPC-TLS is bandwidth-bound. `UNVERIFIED:` current alpha.15 figures; historically
seconds-to-minutes and tens of MB for a modest response. Needs a native prover process or WASM in
browser — not a one-click flow.

**Aggregator relevance:** as a *dependency of other people's products* (several projects fork tlsn),
not as something we integrate directly.

### A.2 Reclaim Protocol

**Model:** proxy-witness ("attestor"). The client opens a TLS session to the target *through* a
Reclaim attestor. The attestor sees only ciphertext, records the request/response, and signs a claim.
The client then reveals selected plaintext and proves in ZK (ChaCha20 circuit) that the revealed
plaintext is consistent with the ciphertext the attestor signed. Repo:
[github.com/reclaimprotocol/attestor-core](https://github.com/reclaimprotocol/attestor-core).

**Security claim and its actual content:** Reclaim cites a formal analysis (Z. Luo et al.) giving a
forgery probability of **10⁻⁴⁰**, driven by the number of valid openings in the revealed data, the
length of revealed padding, and the IV size
([blog.reclaimprotocol.org/posts/proxying-is-enough](https://blog.reclaimprotocol.org/posts/proxying-is-enough)).
Additional hardening: only HTTP 200 responses accepted, timestamps must be within 10 minutes, the URL
is fixed in advance. **But that 10⁻⁴⁰ bounds the wrong adversary** — it bounds a *client* forging
against an *honest* proxy. The blog does not analyse a malicious or bribed attestor, and Reclaim
acknowledges honest-proxy as an assumption. Reclaim's answer is to decentralise attestors (they run
an EigenLayer AVS), which converts the assumption into "≥1 honest attestor in a quorum" — better, but
`UNCLEAR:` whether quorum attestation is the default path in the shipped SDK or an opt-in, and
whether an attestor forging a transcript is even *detectable* after the fact (I could find no fraud-
proof construction; without one, slashing is decorative).

**Selective disclosure:** yes, regex/template-based — you declare a "provider" schema with match
patterns, and only matched groups are revealed. Redaction quality depends entirely on the provider
template being written correctly; a sloppy template over-reveals.

**Replayability:** proofs are signed claims over `(provider, params, context)`. The `context` field
is where you bind a proof to an address/nonce. **If an integrator omits context binding, the proof is
fully transferable** — anyone can replay someone else's proof. This is the single most common
integration bug in this whole category and we must treat it as our responsibility, not the vendor's.

**On-chain surface:** `reclaim-solidity-sdk`, contract exposes
`verifyProof(Reclaim.Proof memory proof) public view`
([docs.reclaimprotocol.org/onchain/solidity/quickstart](https://docs.reclaimprotocol.org/onchain/solidity/quickstart)).
Deployed across BNB Chain, Optimism, Celo, Base, Arbitrum, Polygon, Avalanche, Aurora, Hedera, Oasis
Sapphire, plus non-EVM Solana and NEAR. **`UNVERIFIED:` exact per-chain addresses** — the docs point
to `/onchain/solidity/supported-networks`; I was unable to retrieve that page in this session. Get
them from that page or from `reclaimprotocol/reclaim-solidity-sdk` deployment artifacts before
integrating. Do **not** take an address from anywhere else.

**Cost/UX:** Reclaim's landing page markets "Global Verification from $0.10 at Scale"
([reclaimprotocol.org](https://www.reclaimprotocol.org/), fetched 2026-07-24) and claims 2–4 second
mobile proofs across ~889 data sources (secondary: Shoal Research). UX requires the user to **log in
to the target platform inside Reclaim's webview / mobile SDK / browser extension**. That is the
crux — see A.9.

**Liveness:** clearly the most commercially active project in the category; also shipping adjacent
products (`reclaim-8004-validator` for ERC-8004 agent validation, zkFetch for API oracles, a Solana
program). Alive.

### A.3 zkPass

**Model:** explicitly **hybrid** — "Proxy Mode" as the production path, "MPC Mode" as a fallback,
marketed together as 3P-TLS
([docs.zkpass.org/overview/technical-overview](https://docs.zkpass.org/overview/technical-overview),
fetched 2026-07-24). Proof system is **VOLEitH** (SoftSpokenOT + Line-Point ZK + Fiat–Shamir), chosen
to avoid trusted setup and to be fast enough to run in a browser — a genuinely sensible engineering
choice, and notably *not* a SNARK.

**Trust assumptions, from their own docs:**
- Proxy mode "requires network assumptions preventing BGP hijacking and message tampering between V
  and S", and V must maintain a reliable connection to S throughout.
- MPC mode: "**A malicious notary could cache session data and collude with a compromised client**",
  and because the decrypted key is hidden for privacy, "external verification is impossible, meaning
  collusion or manipulation could go undetected."

That last quotation is the most honest sentence any project in this category has published, and it
should be read as applying to the whole category: **collusion is undetectable, therefore
crypto-economic slashing cannot fix it.**

- **Cost of MPC mode:** their own figure — a 1KB request / 100KB response needs **~32MB uploaded by
  the prover**. That is why nobody ships MPC mode.

**UX:** TransGate browser extension (Chrome) and a TransGate Android app
([play.google.com/store/apps/details?id=com.zkpass.transgate](https://play.google.com/store/apps/details?id=com.zkpass.transgate)).
An extension install is a brutal funnel step — see A.9.

**Selective disclosure / on-chain:** `UNVERIFIED:` the technical-overview page documents neither
claim-level selective disclosure granularity, nor proof transferability, nor any on-chain verifier
schema or contract address. Next place to look: `paper.zkpass.org/zkPass_WP2025.pdf` and the
zkPass "schema" / "allocator" developer docs. Do not assume an address exists.

**Liveness:** whitepaper dated 2025, roadmap advertises "Phase IV (2026+)" with DAO governance and an
enterprise suite — i.e. the 2026 roadmap items are governance and sales, not core protocol. Has a
token (ZKP). Alive, commercial.

### A.4 Opacity Network

**Model:** TEE + restaking. Notaries run inside **Intel SGX enclaves**; the enclave holds plaintext
but attests to the code that processed it. Layered on **EigenLayer as an AVS** so operators are
staked and slashable, with a whistleblower bounty: "any user who can prove a notary misbehaved gets a
share of their slashed stake" (secondary:
[medium.com/@vinayak_35433 — "Opacity Network: Trust but Verify"](https://medium.com/@vinayak_35433/opacity-network-trust-but-verify-eb819ebb0b0a)).

**The honest read of this design:** it swaps a *cryptographic* trust assumption for a *hardware +
economic* one. The trust root becomes **Intel**. SGX has a long, well-documented history of practical
breaks (Foreshadow/L1TF, Plundervolt, SGAxe, ÆPIC, and repeated microcode-revocation cycles). An
attacker who breaks or extracts an enclave key once can mint unlimited proofs, and — critically —
**the whistleblower mechanism only works if misbehaviour is provable**, which for a compromised
enclave producing well-formed attestations it is not. Restaking makes the *ordinary* failure mode
(operator downtime, obvious equivocation) expensive, and does nothing about the *interesting* one.

Note also the privacy asymmetry vs. Reclaim/TLSNotary: **an Opacity notary sees your plaintext.** It
is a *policy* promise (enclave code) rather than a *cryptographic* one that it forgets it.

**Status (2026-07):** Alive and shipping hard. `github.com/OpacityLabs` had pushes on **2026-07-24**
(the day of writing) across `tambour`, `react-native-opacity`, `dcap-verify`, `opacity-ferveo`, plus
`opacity-ios` / `opacity-android` on 2026-07-15 (GitHub API, checked 2026-07-24). Two signals worth
naming: `dcap-verify` = Intel DCAP quote verification, i.e. on-chain/programmatic TEE attestation
verification; `opacity-ferveo` = threshold decryption (Ferveo is a DKG/threshold-crypto library),
suggesting they are moving off "one enclave sees plaintext" toward threshold custody. Raised **$12M
seed** (secondary:
[theblock.co/post/321160](https://www.theblock.co/post/321160/opacity-network-funding-zk-data-verification)).
AVS is on EigenLayer mainnet (address `0xce06c5fe42d22ff827a519396583fd9f5176e3d3` per EigenExplorer
URL; `UNVERIFIED:` operator count and restaked TVL — EigenExplorer returned HTTP 402 for me; check
[app.eigenlayer.xyz](https://app.eigenlayer.xyz) directly).

**Aggregator relevance:** the SDK story (native iOS/Android/React Native) is the best in the category
for a *mobile* embedded flow, which matters for us. Their customers are DePIN gig-work verifications
(Nosh, Teleport, Heale, Earnifi) — i.e. *income/employment* attestations, not personhood.

### A.5 Primus (formerly PADO)

**Model:** dual-mode — MPC mode and Proxy mode behind **unified APIs**, and the whole zkTLS protocol
additionally **deployed inside a Phala TEE**
([docs.primuslabs.xyz/primus-network/tech-intro](https://docs.primuslabs.xyz/primus-network/tech-intro/);
secondary: [Primus × Phala](https://medium.com/@primuslabs/primus-x-phala-network-build-trustless-zktls-with-tee-332a26d48c83)).
So Primus is the one project that offers all three trust models. MPC mode uses **QuickSilver**
(their own VOLE-based interactive ZK) to cut prover cost. Their docs concede proxy mode "introduces a
network trust assumption requiring the attestor to verify it communicates with the intended server."

**On-chain surface — real, verified addresses.** From deployment broadcasts in
[github.com/primus-labs/zktls-contracts](https://github.com/primus-labs/zktls-contracts)
(`broadcast/PrimusZkTLS.s.sol/<chainId>/run-latest.json`, read via GitHub API 2026-07-24):

| Chain | Chain ID | Implementation (`PrimusZKTLS`) | Proxy (use this) |
|---|---|---|---|
| Arbitrum One | 42161 | `0x2b5c792d3897ea759a15d44d9b4f5d585c2ee6cd` | `0x982cef8d9f184566c2bec48c4fb9b6e7b0b4a58b` |
| BNB Chain | 56 | `0x14f8fb6ac0bd3999f4cffed21ebf1b97733e7ad7` | `0xf3c20a5216d669c521ffe3724c1439ae0897ac33` |
| opBNB | 204 | `0xc30b99cc6a4bd7628da385fa36bd769a5cd03300` | `0xadd538d8c857072efc29c4c05f574c68f94137ef` |

Also deployed to Sepolia (11155111), Holesky (17000), Taiko Hekla (167009), Scroll Sepolia (534351),
Scroll (534352), opBNB testnet (5611), Linea Sepolia (59141) — testnets, from the same broadcast dir.
**Caveat: these are `CREATE` addresses recorded in committed Foundry broadcast artifacts, not
independently confirmed against a block explorer.** Verify on Arbiscan/BscScan before use. Note the
contracts are **`TransparentUpgradeableProxy` behind a `ProxyAdmin`** (BNB Chain adds a
`TimelockController`) — i.e. **Primus can upgrade the verifier**. For an aggregator that is a live
trust dependency, not a static one.

Interface: `IPrimusZKTLS(primusAddress).verifyAttestation(attestation)` from
`@primuslabs/zktls-contracts/src/IPrimusZKTLS.sol`. The README's own usage example warns:
*"Example: Verify that proof.context matches your expectations"* — again, **context binding is the
integrator's job**, and forgetting it makes proofs replayable.

**Status (2026-07):** very much alive. `primus-labs` org pushes on 2026-07-22 (`primus-emp`, `otls`),
2026-07-16 (`network-core-sdk`), 2026-07-15 (`zktls-core-sdk`); `zktls-contracts` last commit
2026-06-11. Also developing `primus-fhe` — the FHE work suggests attention is drifting toward
confidential compute rather than proofs.

### A.6 Pluto — **appears to have pivoted away from zkTLS**

Pluto pitched three modes: **MPC mode, Origo proxy mode, and TEE mode**
([pluto.xyz/blog/web-proof-techniques-tee-mode](https://pluto.xyz/blog/web-proof-techniques-tee-mode),
[…/origo-mode](https://pluto.xyz/blog/web-proof-techniques-origo-mode)), with `caratls` for
TLS channel-binding to a TEE quote. Team ex-Stripe/Aztec/Uber/HubSpot.

**Evidence of pivot / wind-down (GitHub API, checked 2026-07-24):** the entire `github.com/pluto`
org's most recent push to *any* repo is **2026-02-12** (`aes-circuits`). The core zkTLS repos are
older still: `web-prover-circuits` last pushed **2025-04-25**, `solidity-verifier` ("Contract to
verify notary signatures on chain") **2025-07-03**, `pluto-frame-examples` 2025-04-30. Meanwhile
[docs.pluto.xyz](https://docs.pluto.xyz/) now describes the product as **"Embedded Automations",
"Pluto Frame" and "Pluto Functions" (execute arbitrary JavaScript)** — with no mention of MPC/Origo/
TEE modes in the introduction at all.

Read together: Pluto has repositioned from *web proofs* to *browser automation*, which is the
commercially honest version of the same underlying tech and quietly drops the cryptographic claim.
**Do not build on Pluto for verification.** `UNCLEAR:` whether the notary infrastructure is still
operated; treat as unavailable.

### A.7 Clique

**Model:** TEE-based attestation — "low computation and network overhead but introduces reliance on
trusted hardware" (secondary:
[BlockBeats zkTLS overview](https://en.theblockbeats.news/news/57312)). Clique's actual business is
broader off-chain attestation / campaign infrastructure (social task verification, airdrop
eligibility) rather than a general zkTLS primitive.

**Status:** `UNVERIFIED:` I could not locate an authoritative Clique GitHub org (`clique2046` 404s)
or current docs in this session; the references I have are secondary overview articles. Given their
model is "trust our enclave", their attestations are **functionally a vendor API with a TEE
marketing layer**, and for our purposes the relevant question is not the cryptography but whether we
trust Clique the company. Next place to look: `clique.social` / `@Clique2046` on X, and whether any
verifier contract exists on-chain.

**Aggregator relevance:** low. If we are trusting a company's signature anyway, a plain signed REST
attestation is simpler and we should price it as "vendor-attested", not "cryptographically proven".

### A.8 Other / adjacent 2025-26 entrants

- **DECO** (Chainlink Labs, the academic ancestor of all of this — Zhang et al. CCS'20). Research
  lineage, not a product we can integrate. Referenced in
  [Stanford Blockchain Review #74](https://review.stanfordblockchain.xyz/p/74-cryptography-research-spotlight).
- **TACEO** — multiparty notaries for zkTLS ([blog.taceo.io/mpc-zktls](https://blog.taceo.io/mpc-zktls)):
  the interesting research direction, because it attacks the exact weakness above (single bribable
  notary) by threshold-izing the notary. `UNVERIFIED:` production readiness.
- **Nillion** — publishing on "evolving zkTLS" as part of privacy-preserving computation
  ([nillion.com](https://nillion.com/news/evolving-zktls-part-3-of-privacy-preserving-computation-from-decentralized-oracles/)).
- **Reclaim is adding TEE**: a `reclaim-tee` repo in the Reclaim org was **pushed 2026-07-24**
  (GitHub API). That the leading proxy-witness vendor is building TEE infrastructure is a tell: the
  honest-proxy assumption is not selling to serious counterparties.
- `UNVERIFIED:` I did not find a *new* credible zkTLS entrant founded in 2026. The category looks
  consolidated around Reclaim (volume), Primus (breadth), Opacity (mobile/TEE), with TLSNotary as the
  research substrate.

### A.9 Adversarial reality: does this still work in 2026?

This is the section that decides the verdict, and the news is bad.

**1. Anti-bot detection is now baseline and TLS-layer.** TLS fingerprinting "moved from advanced
anti-bot to baseline in 2024 and is now table stakes in 2026"; **JA4+ is universally adopted by
Cloudflare, AWS, VirusTotal and NetWitness**
([proxylabs.app/blog/ja4-tls-fingerprinting-2026](https://proxylabs.app/blog/ja4-tls-fingerprinting-2026),
[cside.com/blog/tls-fingerprinting](https://cside.com/blog/tls-fingerprinting) — both vendor blogs,
secondary). A Feb-2026 arXiv paper reports a CatBoost classifier on JA4 features hitting **AUC 0.998
/ accuracy 0.9863** for bad-bot detection ([arxiv.org/abs/2602.09606](https://arxiv.org/abs/2602.09606)).

Why this hits zkTLS specifically: **proxy-mode zkTLS terminates and re-originates or at minimum
relays the TLS session from the vendor's server IP**, and MPC-mode zkTLS produces a
*non-browser ClientHello* by construction (it is a custom Rust/WASM TLS stack). Both are exactly
what JA4 + IP-reputation systems are built to flag. The user is a real human with real credentials,
but the connection looks like a bot from a datacenter ASN. Result: CAPTCHAs, 403s, and
**account-level flags on the user's real account** — the worst possible outcome for a consumer
onboarding flow.

**2. Post-quantum TLS landed in 2026 and it is a structural problem for MPC-TLS.** PQ key exchange
became the default for client-to-Akamai connections on **2026-01-31**, with network rollout complete
in **March 2026** (secondary:
[scrapfly.io/blog/posts/post-quantum-tls-bot-detection](https://scrapfly.io/blog/posts/post-quantum-tls-bot-detection));
Cloudflare and the major CDNs are on the same path, and `X25519MLKEM768`
([draft-ietf-tls-ecdhe-mlkem](https://datatracker.ietf.org/doc/draft-ietf-tls-ecdhe-mlkem/)) is now
the ordinary handshake. Scrapfly's framing is the operative one: traffic that reaches Akamai
**without a PQ key share now sits outside the baseline of normal browser behaviour** — i.e. failing
to do PQ is itself a bot signal.

`MY ANALYSIS, NOT A CITED CLAIM:` MPC-TLS three-party handshakes are constructed around *splitting an
ECDHE secret* between prover and notary inside a garbled circuit. ML-KEM is a lattice KEM with very
different structure and much larger operands; doing it in 2PC is not a parameter change, it is new
research. So the PQ transition plausibly forces MPC-TLS either to negotiate down to classical ECDHE
(which is now itself a fingerprintable anomaly) or to be rebuilt. Proxy-mode is less affected — the
proxy relays ciphertext and need not touch the key exchange — but proxy-mode is the weak trust model.
**`UNVERIFIED:` I found no source addressing PQ-TLS × MPC-TLS directly. This is the single highest-value
open question in Part A and should be put to the TLSNotary maintainers directly.**

**3. Platforms prohibit it by ToS and enforce.** X's Developer Agreement and Terms prohibit scraping
and accessing the service by automated means without permission; the same is true of Google, Reddit
(post-2023 API lockdown), and LinkedIn. zkTLS vendors' answer is "the *user* is accessing their own
data, with their own credentials, so it is not scraping." That argument is legally untested for
zkTLS specifically, and it does not help operationally: the platform does not need a legal theory to
ban the account.

**4. So — is proving an X fact practical in 2026?** `UNVERIFIED, and this is the one thing I would
test before believing any vendor:` Reclaim advertises ~889 data sources and X is certainly among the
advertised ones, but **the existence of a provider template is not evidence it currently works**.
Provider templates in this category rot constantly — a DOM/JSON change or a new anti-bot rule kills
one silently. **Concrete next step for us: take Reclaim's and Primus's X/Twitter providers and
actually run 50 proof attempts from residential and datacenter IPs, and measure the success rate and
the account-flag rate.** Any integration decision made without that number is a guess. My prior,
given the JA4 evidence above and that X is one of the most aggressively defended targets on the
internet, is that success rates are materially below what the marketing implies and are degrading.

**5. The UX tax, independent of whether it works.** Every design requires the user to authenticate
to the target platform inside the vendor's surface: zkPass needs the **TransGate Chrome extension**
or Android app; Reclaim needs its mobile SDK / webview / extension; Opacity ships native iOS/Android
SDKs. `UNVERIFIED:` no published funnel numbers, but a browser-extension install step in a consumer
onboarding flow is conventionally a **50–90% drop-off**, and asking a user to type their X or Google
password into a third-party webview is a phishing-shaped interaction that security-aware users
should and will refuse. For an aggregator whose pitch is "one embedded flow", this is a serious
product problem: zkTLS is the highest-friction, lowest-value input in the entire landscape.

### A.10 Legal exposure

- **CFAA / unauthorised access (US).** *hiQ v. LinkedIn* (9th Cir. 2022) held that scraping *public*
  data likely does not violate the CFAA — but zkTLS is the opposite case: it operates on
  **authenticated, non-public** data behind a login, where "exceeds authorized access" bites and where
  ToS breach is squarely in play. *Van Buren* (SCOTUS 2021) narrowed CFAA to gates-based access, which
  helps somewhat, but a credentialed session routed through a third-party proxy in violation of an
  explicit ToS is not the fact pattern *hiQ* blessed. `UNVERIFIED:` no zkTLS-specific case law found.
- **Where the exposure sits.** In proxy-witness designs the vendor's server is literally in the data
  path of an authenticated session. If we embed a zkTLS vendor, we are inducing our users to breach
  the platform's ToS, and we are shipping their credentials-derived traffic through a third party.
- **Credential handling / DPA and GDPR.** In **TEE mode the notary sees plaintext**, which for
  EU users means a processor relationship and a data-transfer story over data the user never intended
  to share with anyone but the platform. Proxy/MPC modes are far better here (ciphertext only).
- **Practical posture for us:** never take custody of platform credentials; keep the login inside the
  vendor's SDK; require the vendor to carry the ToS risk contractually; and do **not** market
  "prove your X account" as a headline feature in a jurisdiction-sensitive product.

## Part B — The social signals themselves

Framing for the whole of Part B: for each signal, the only question that matters is **what does one
additional unit cost an attacker**, because a sybil farm buys in bulk and does not care about
anything else. Where the number exists it is in B.8.

### B.1 X / Twitter

**Account age.** Priced in B.8: **$1.83 for a 2016-vintage account**, ~$0.20 for anything from
2023–2025. Account age on X is therefore worth approximately nothing. Worse, it is worth *less* than
it looks, because a buyer of an aged account inherits genuine-looking history — the signal is not
merely cheap, it is cheap *and* indistinguishable from the real thing by construction.

**Blue check = X Premium = a purchased subscription, not an identity check.** Pricing (2026, secondary
sources — [tweethunter.io](https://tweethunter.io/blog/twitter-blue-vs-x-premium),
[tweetbe.at](https://tweetbe.at/blog/x-verification-guide-2026/), checked 2026-07-24):

| Tier | Price | Gives blue check? |
|---|---|---|
| Basic | $3/mo | No |
| **Premium** | **$8/mo (~$84/yr)** | **Yes** |
| Premium+ | $16/mo | Yes |
| Premium Business (org) | from **$200/mo** | Gold/org check |
| Premium Organizations (gov/multilateral) | **$1,000/mo** | Gold check |

X Premium *does* require a verified phone number, so it inherits the phone-number signal — but that
is the phone signal, not an X signal, and it is **correlated with every phone-based protocol in the
aggregate**. At $84–96/yr, blue check is priced comparably to Farcaster Pro ($120/yr) and is a
similar kind of evidence: real recurring cost, therefore a real (if modest) sybil deterrent, and
**purchasable at scale by anyone with a budget** — 1,000 blue checks is $84k/yr, which is nothing to
a serious airdrop farm.

**Rentability is the killer.** Unlike biometric or document-based credentials, a blue-check X account
can be *rented* — the seller keeps the account and sells access, so the same $84/yr credential can be
monetised across many verification events. `UNVERIFIED:` I did not find a specific X-account-rental
price list, but account rental is well-established for Discord/Telegram and there is no structural
reason X differs. **Any credential whose secret is a password is rentable; any credential whose
secret is a face or a passport chip is much less so.** This distinction should drive our weighting more
than anything else in Part B.

**Verification by organisation** (an org vouches for an employee, `affiliates` badge) is
qualitatively different — it is a *human-in-the-loop attestation by an accountable entity*, and the
org pays $200–1,000/mo. It is the only genuinely interesting X signal, and it has near-zero recall
outside corporate accounts. `UNVERIFIED:` there is no public API that cleanly exposes affiliation
status in a way a zkTLS provider template can reliably match — worth checking.

**Follower graph.** Follows are free and follower counts are directly purchasable (AccsMarket's
"boosting" catalogue sells engagement "from as low as $0.001 per action", fetched 2026-07-24). Raw
follower count is worthless. The only defensible reading is the same one as for Farcaster: *inbound
edges from accounts that independently pass an expensive check*, i.e. trust propagation over a
verified seed set — not a threshold on a number.

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

Lens relaunched in 2025 as **Lens Chain** (a ZKsync-stack L2) with "the new Lens": accounts are
ERC-6551-style smart accounts, gas is paid in USD terms, and onboarding is explicitly designed to be
frictionless — "account abstraction, USD gas fees, and easy onboarding via email and phone
verification" ([lens.xyz/docs/chain/overview](https://lens.xyz/docs/chain/overview),
[lens.xyz/news/introducing-the-new-lens](https://lens.xyz/news/introducing-the-new-lens)).

**`UNVERIFIED:` Lens account count, current registration cost, and Lens Chain contract addresses.** I
could not confirm these from primary sources in this session and I will not guess. Where to look
next: (a) the `LensFactory` / account-registry contract on Lens Chain via
[explorer.lens.xyz](https://explorer.lens.xyz) — read the equivalent of an `idCounter`; (b)
[lens.xyz/docs/protocol/accounts/create](https://lens.xyz/docs/protocol/accounts/create) for the fee
model; (c) whether the old Polygon `LensHub` (`0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d`) is
frozen — **note I have not re-verified that address this session, treat it as recall, not a citation.**

**Structural read, which does not depend on the missing numbers:** the entire design goal of new Lens
is *cheap, abstracted, low-friction account creation*. That is the same design goal that took
Farcaster's registry from 1.1M to 3.3M FIDs in nine months. A protocol optimising for onboarding
friction is, by construction, optimising *against* sybil cost. Expect Lens handles to be worth what
Farcaster FIDs are worth: about nothing. The one exception worth checking is whether Lens **namespace
/ handle** registration has a length-tiered price (the old Lens did) — a short handle with a real
price is a cost-bearing signal in the same way Farcaster Pro is.

### B.4 Discord / Telegram

**Discord: $0.22 fresh, $2.44–5.55 for a 2017-vintage account** (B.8). "Server tenure" and roles are
worth nothing: an attacker buys aged accounts in bulk and joins servers for free. Discord exposes no
account-creation date via any public API a proof system could attest to — *although* the snowflake ID
encodes creation timestamp, which is at least honestly derivable. That makes Discord tenure trivially
*provable* and trivially *purchasable* — the worst possible combination, because it looks like a
crisp cryptographic fact while carrying no evidence.

**Telegram: $1.30 fresh (USA) up to $24.05 for 2019-vintage** (B.8). Telegram is materially costlier
because accounts are **phone-bound**, so you are pricing SIM supply. This has two consequences:
(1) Telegram tenure is a *usable-but-weak* proxy for phone possession; (2) it is therefore
**not independent evidence** if the aggregate already contains a phone-verification or
SMS-based signal — see Overlap.

### B.5 Reddit

**The one social platform where the market price is genuinely non-trivial:** $27.71 for a 2019
account, **$185–277.50 for a 2012–2015 account** (B.8). This is 100× the equivalent-vintage X account
and it deserves an explanation, because the explanation tells us what actually creates sybil cost:

- Reddit aggressively shadowbans and rate-limits new accounts, and many subreddits gate participation
  on account age and karma. So a Reddit account only becomes *useful* after surviving a long,
  actively-adversarial seasoning process. That process is what costs money — not the registration.
- **This is the general principle: sybil cost comes from a platform that actively fights farms, not
  from a registration fee.** Farcaster charges $0.20/yr and fights nobody, so a FID is worth $0.20.
  Reddit charges nothing and fights constantly, so a good Reddit account is worth $200. When we score
  a platform signal we should be scoring *the platform's own anti-abuse investment*, which we are
  free-riding on.

**Karma** is separable and purchasable — karma-farming is an established service, and accsmarket's
adjacent "boosting" catalogue prices engagement actions from ~$0.001. `UNVERIFIED:` I did not find a
current per-1,000-karma price; look at accsmarket boosting and SWAPD listings. Treat karma as
**cheap**, and treat *age + karma + sustained comment history in moderated subs* as the ~$200 bundle.

**Provability:** Reddit account age and karma are on the public profile, so a zkTLS provider template
for Reddit is unusually easy and unusually robust (Pluto's original demo was Reddit + Venmo). Of all
Part B signals, Reddit has the best ratio of *cost-to-fake* to *ease-of-proving*. If we integrate any
social signal at all, **Reddit is the strongest candidate**, not X.

### B.6 GitHub

The interesting asymmetry the brief flags is real: a multi-year contribution graph with merged PRs
into other people's repos is **genuinely expensive to fabricate convincingly** — you cannot buy
years of accepted code review. But this is defeated in one move: **you don't fabricate it, you buy
the account.** `UNVERIFIED:` advertised ~$50 basic to $300+ for aged accounts with contribution
history (B.8, vendor ad copy only).

Two further problems:
- **The contribution graph is trivially forgeable in the direction people usually measure it.** Green
  squares come from commits to *your own* repos with *arbitrary author dates*; backdating a five-year
  commit history is a shell script. Any scoring rule keyed on "contribution streak" or "commits in
  the last N years" measures nothing. Only **merged PRs into repositories the account does not
  control, reviewed by accounts that are themselves independently scored** is expensive — and that is
  a graph computation, not a profile field.
- GitHub is a *skill* signal, not a *personhood* signal, and it is heavily biased by geography,
  profession and age. Using it in a personhood score is a fairness problem as much as a security one.

**Provability:** GitHub has a generous public REST/GraphQL API, so this is one of the few signals we
could verify **without zkTLS at all** — just an OAuth scope or even an unauthenticated API read of a
claimed username, bound to an address by a signed gist. That is dramatically simpler, cheaper and
more robust than any zkTLS integration. **Where a public API exists, zkTLS is the wrong tool.**

### B.7 Google / Apple / Microsoft OAuth

**What an OAuth login actually proves: that someone currently controls an account at that provider.
Nothing more.** It does not prove uniqueness, personhood, liveness, or age of the account. It is an
*authentication* protocol being misread as an *identity* protocol.

- A phone-verified Google account costs **$0.35–1.11** (B.8). "Sign in with Google" as a personhood
  gate therefore has a security level of about **one dollar**.
- Apple is the outlier worth respecting: Apple ID creation is friction-heavy, frequently tied to a
  device and a payment method, and **Sign in with Apple** deliberately supports private relay email,
  which destroys cross-app linkability (good for privacy, bad for us as a dedup key). `UNVERIFIED:`
  aged-Apple-ID market price — Apple IDs *are* traded but mostly for App Store region/purchase
  reasons; get a quote before assuming Apple is stronger.
- Microsoft accounts are the cheapest of all — outlook/hotmail addresses are the *bundled email* in
  the $0.02–0.20 X account listings above. That tells you exactly what a Microsoft account is worth.

**A genuinely useful sub-signal exists and is usually ignored:** Google Workspace accounts on a
*verified domain* (`hd` claim in the OIDC ID token) are issued by an accountable organisation that
paid for a domain and per-seat licences. `hd=<some-real-company.com>` is a meaningfully better signal
than a `@gmail.com` — it is the OAuth analogue of X's verification-by-organisation. Recall is low and
it correlates with employment, but it is real. Consumer Gmail is not.

**Attestation vs. OAuth — do not confuse them.** Google Play Integrity API and Apple DeviceCheck /
App Attest attest to a *genuine, unmodified device and app instance*. That is a real anti-bot signal
with real cost (you need a physical unrooted device, or an expensive emulator-detection bypass), and
it is **completely different from an OAuth login**. If we want a cheap anti-automation signal from
the mobile platforms, that is the API to look at, not sign-in. `UNVERIFIED:` current cost of
farming Play Integrity `MEETS_DEVICE_INTEGRITY` at scale — this is worth its own research task,
because it may be the best cheap signal in this whole document.
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

### Verdict 1 — Is zkTLS a viable input for us in 2026, or a demo technology?

**Neither, quite: it is real infrastructure aimed at a different problem than ours. For personhood
specifically, it is close to a demo technology, and we should skip it in v1.**

The case against, in order of decisiveness:

1. **The trust model is wrong for an adversary with money.** Every shipping design has a single party
   — a proxy operator, or an Intel enclave — who can mint arbitrary proofs if compromised. zkPass's
   own documentation concedes that MPC-mode collusion "could go undetected"; Reclaim's own blog
   concedes the proxy is assumed honest. Undetectable collusion means restaking and slashing cannot
   fix it, because there is nothing to slash *on*. A sybil farmer's entire job is to find the cheapest
   party to compromise, and in zkTLS that party is a company's server. Contrast a passport chip
   signature or an iris hash: those have no bribable intermediary.
2. **A perfect proof of a $2 fact is worth $2.** This is the argument that ends the discussion. Even
   granting zkTLS perfect soundness, it transports the signals in Part B — and Part B tops out at
   $200–300 per sybil and mostly sits under $5. zkTLS cannot add evidence that was not in the
   underlying account.
3. **The environment is turning against it.** JA4+ fingerprinting is universal in 2026 and the
   published classifiers are at ~0.99 accuracy; PQ-TLS became the default handshake in Q1 2026 and
   plausibly breaks MPC-mode three-party handshakes outright. Proxy-mode traffic originates from
   datacenter ASNs, which is exactly what these systems flag. **The failure mode is not just "the
   proof fails" — it is "our onboarding flow gets the user's real account flagged."**
4. **The UX tax is the highest in the landscape** — browser extension or native SDK, plus typing a
   platform password into a third-party surface — for the lowest-value credential in the landscape.
   That is the wrong end of every trade-off.
5. **Where a public API exists (GitHub, Reddit profiles, Farcaster hubs), zkTLS is strictly the wrong
   tool** — more moving parts, more trust, more friction, for the same fact.

The case *for*, honestly stated: the projects are not vaporware. Reclaim, Primus and Opacity are all
pushing code this week, Primus has real verifier contracts on Arbitrum/BSC, Opacity has real native
mobile SDKs and $12M. If our product later needs **non-personhood** attestations — income, employment,
order history, exchange balances, gig-work ratings — zkTLS is the only way to get them, and Opacity's
DePIN customer list shows that market is where the category has actually found fit. So:

**Integrate later, and for a different reason.** Do not build zkTLS into the personhood score. Keep a
thin, swappable adapter interface so that if a customer wants "prove you have >$X on Coinbase" or
"prove your Uber rating", we can plug Reclaim or Primus in behind it. Revisit for personhood only if
someone ships a **threshold notary** (TACEO's direction) that removes the single bribable party —
that would be a genuine change in kind, not degree.

**Before spending another day on this, run the one experiment that settles it:** 50 real proof
attempts against X, Reddit and GitHub via Reclaim and Primus, from residential and datacenter IPs,
measuring success rate, median latency, and whether any test account gets flagged. Every vendor claim
in Part A is downstream of that number and I could not find it published anywhere.

### Verdict 2 — Given every social signal is purchasable, can they ever add real evidence?

**As positive evidence: essentially no. As negative evidence: yes, and this is the right way to use
them — but with a serious caveat that we must not paper over.**

**Why positive scoring fails.** The security level of a positive rule is the market price of the
credential, and Part B says that price is $0.20–$5 for almost everything, $30–300 for the good tail.
A farm buys 10,000 aged Discord accounts for $30k and passes any "aged social account" rule
completely. Worse, positive rules are **regressive in exactly the wrong direction**: they are trivial
for the funded attacker and burdensome for the ordinary user, who must hand over social accounts they
had no reason to link. Worst of all, several are **rentable** — the same $84/yr blue-check account can
service unlimited verification events, so the attacker's *amortised* cost is far below even the
purchase price.

**Why negative scoring is different, mathematically.** The asymmetry is real and worth stating
precisely. A positive rule is defeated by the *cheapest* way to acquire the signal — attacker cost is
`min` over acquisition methods. A negative rule ("no history anywhere is a red flag") must be defeated
on *every* axis simultaneously — attacker cost is a `sum`, and it multiplies with the number of
independent axes. Buying one aged Discord account is $5; assembling a *coherent* identity with an
aged X account, an aged Reddit account with karma in moderated subs, a GitHub account with merged PRs,
and a Farcaster graph position — for **each** of 10,000 sybils — is a different order of problem. Not
because any one piece is expensive, but because coherence across pieces is expensive and does not
bulk-discount.

So the defensible configuration is:

- **Never award points for having a social account.** Zero. Not a small number — zero.
- **Use absence and incoherence as a penalty or a routing signal**: a wallet with no history on any
  platform, or with accounts whose creation dates cluster suspiciously, or whose graph neighbours are
  each other, gets routed to a *stronger* check (document, biometric) rather than being rejected.
- **Only ever consume the cost-bearing variants as small bonuses:** Farcaster Pro ($120/yr,
  on-chain-verifiable via `TierRegistry`), X verification-by-organisation, Google Workspace `hd`
  claim, a Reddit account with 2012–2015 vintage *and* karma in moderated subreddits. These have
  real recurring cost and high precision; all have terrible recall, so they can only ever be bonuses.
- **Read graphs, not counts.** The only follower-graph reading that survives is trust propagation from
  an independently-verified seed set. A threshold on a follower number is worthless.

**Now the caveat, honestly.** Negative signalling is not free, and I do not want to sell it as the
clever escape hatch:

1. **It has a brutal false-positive profile.** "No social history" describes privacy-conscious users,
   people in jurisdictions where pseudonymity is safety, older users, and users outside the
   English-language crypto-social bubble — i.e. exactly the populations a personhood system must not
   exclude. A red flag that fires on the privacy-conscious and not on the funded farmer is worse than
   useless; it is actively unjust. **Mitigation is structural: a negative signal may only ever
   *escalate* to a stronger check, never deny.** If it can deny, we have built a system that punishes
   privacy.
2. **It is not a credential, it is fraud scoring.** Sybil-farm detection is a statistical, adversarial,
   continuously-decaying ML problem — a different product with different economics from issuing and
   aggregating personhood credentials. It needs labels, retraining, and it degrades silently. We
   should be clear-eyed that shipping this means running a fraud team, and we should not accidentally
   commit to that inside a "credential aggregator" product.
3. **The coherence argument has an expiry date.** "Coherent multi-platform history is expensive to
   fabricate" was much more true before generative models could produce years of plausible posting
   history cheaply. In 2026, the cost of *coherence* is falling faster than the cost of *accounts*.
   I would not build a five-year bet on it.

**Bottom line:** social signals belong in the aggregator as a **negative/routing layer with an
escalation-only policy**, plus a **short whitelist of cost-bearing bonuses** (Farcaster Pro, X org
verification, Workspace `hd`, aged-and-seasoned Reddit). They must contribute **no positive weight**
in the headline humanity score, and we should not use zkTLS to obtain them.

## Overlap with other protocols

Double-counting is the main risk this file identifies for the aggregate score:

| Signal | Shares a trust root with | Consequence |
|---|---|---|
| Telegram tenure | **any phone/SMS-verification protocol** (accounts are phone-bound) | Not independent. If we score both, we count SIM supply twice. |
| X Premium (blue check) | phone verification (Premium requires a verified phone) + **payment card** | Partially dependent on the same two roots. |
| Google / Microsoft OAuth | phone verification (PVA accounts), and **each other** — the email bundled with a cheap X or Reddit account is usually an outlook/hotmail address from the same seller | Strongly correlated: a single vendor supplies the email *and* the social account. Scoring "has Google + has X" is often scoring one $0.20 purchase. |
| Farcaster verified addresses | whatever the **linked Ethereum address** already scores | Explicitly a bridge — do not let a FID inherit score from an address and then also score the address. |
| Farcaster Pro / X Premium / Workspace | **payment instrument** (card / USDC wallet) | All are "someone paid money", i.e. the same underlying scarce thing. Cap the combined contribution. |
| Any zkTLS-proved fact | the **zkTLS vendor** | Two facts proved via the same Reclaim attestor set are *one* trust assumption, not two. |
| Reddit vintage, GitHub PR history | genuinely more independent — cost comes from *time under adversarial moderation*, not from a purchasable root | The only two worth treating as semi-independent. |

Cross-cutting note for the orchestrator: **the phone number is the hidden common root under most of
Part B.** Telegram, X Premium, PVA Gmail and most "aged account" listings all bottom out in SIM
supply. Whatever the phone-verification write-up concludes about SIM-farm economics is therefore the
*real* ceiling on this entire category, and Part B should be weighted as largely-dependent on it
rather than additive.

## Open questions for us

1. **Does zkTLS against X actually work today?** Nobody publishes a success rate. Run 50 attempts via
   Reclaim and Primus from residential and datacenter IPs; measure success, latency, and account-flag
   rate. This is the single highest-value experiment in this file. (A.9)
2. **PQ-TLS × MPC-TLS.** Does `X25519MLKEM768` break three-party handshakes, and what is TLSNotary's
   plan? Ask the maintainers directly. If MPC-TLS cannot do PQ, the only surviving models are
   proxy-witness and TEE — both of which have a bribable party. (A.9)
3. **What caused the Farcaster registration surge (Dec 2025 – Mar 2026, +1.59M FIDs) and its collapse
   in April 2026?** Identify the incentive program. If it was an airdrop/points season, ~2M FIDs are
   farm inventory and any FID-based rule must exclude that cohort. (B.2)
4. **How many Farcaster Pro subscribers are there?** Index `TierRegistry` purchase events on Base
   (`0x00000000fc84484d585C3cF48d213424DFDE43FD`). This gives us the exact recall of the one Farcaster
   signal that costs something. (B.2)
5. **Lens numbers.** Account count, registration cost, Lens Chain registry address — all
   `UNVERIFIED:` here. Read the registry on `explorer.lens.xyz`. (B.3)
6. **Reclaim per-chain verifier addresses** — I could not retrieve `/onchain/solidity/supported-networks`.
   Needed before any integration; never source an address from a third party. (A.2)
7. **Is a fraud proof possible against a lying proxy-witness attestor?** If not, Reclaim's and
   Opacity's slashing is decorative and their "decentralised attestor" story does not change the trust
   model at all. This determines whether the category can ever be fixed. (A.0, A.2, A.4)
8. **Play Integrity / App Attest farming cost.** Possibly the best cheap anti-bot signal available and
   entirely outside the zkTLS frame. Deserves its own research task. (B.7)
9. **Aged-account bulk pricing.** All B.8 figures are single-unit retail. Get 1,000-unit quotes; the
   real attacker cost is likely 2–10× lower and the table's conclusions get correspondingly worse.
10. **Account *rental* market pricing** for blue-check X, aged Reddit, and Discord. Rental amortises
    the credential across many verifications and is the true attacker cost for a per-event check.

## References

**Primary — measured by me on-chain (2026-07-24, `mainnet.optimism.io` / `mainnet.base.org`)**
- Farcaster `IdRegistry` OP Mainnet `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` — `idCounter()` = 3,343,572
- Farcaster `IdGateway` OP Mainnet `0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69` — `price()` = 0.00010686 ETH
- Farcaster `StorageRegistry` OP Mainnet `0x00000000fcCe7f938e7aE6D3c335bD6a1a7c593D` — `usdUnitPrice()` = $0.20/yr
- Farcaster `TierRegistry` Base `0x00000000fc84484d585C3cF48d213424DFDE43FD` — `tierInfo(1)` = $120.00/yr, 30–365 days, USDC
- Monthly `idCounter()` archive samples 2025-07-24 → 2026-07-24 (table in B.2)

**Primary — protocol docs & repos**
- TLSNotary: [github.com/tlsnotary/tlsn](https://github.com/tlsnotary/tlsn) — README "should not be used in production"; releases API: `v0.1.0-alpha.15` 2026-05-21; last commit 2026-06-23
- Reclaim: [attestor-core](https://github.com/reclaimprotocol/attestor-core) · [docs](https://docs.reclaimprotocol.org/) · [onchain quickstart](https://docs.reclaimprotocol.org/onchain/solidity/quickstart) · [reclaimprotocol.org](https://www.reclaimprotocol.org/)
- Reclaim, "Proxying Is Enough": [blog.reclaimprotocol.org/posts/proxying-is-enough](https://blog.reclaimprotocol.org/posts/proxying-is-enough) — honest-proxy assumption, 10⁻⁴⁰ bound
- Reclaim, "The zk in zkTLS": [blog.reclaimprotocol.org/posts/zk-in-zktls](https://blog.reclaimprotocol.org/posts/zk-in-zktls)
- zkPass technical overview: [docs.zkpass.org/overview/technical-overview](https://docs.zkpass.org/overview/technical-overview) — 3P-TLS, VOLEitH, collusion "could go undetected", ~32MB MPC upload
- zkPass whitepaper: [paper.zkpass.org/zkPass_WP2025.pdf](https://paper.zkpass.org/zkPass_WP2025.pdf) · [tech.pdf](https://paper.zkpass.org/tech.pdf)
- Primus: [docs.primuslabs.xyz/primus-network/tech-intro](https://docs.primuslabs.xyz/primus-network/tech-intro/) · [zktls-contracts](https://github.com/primus-labs/zktls-contracts) (addresses read from `broadcast/` artifacts)
- Pluto: [docs.pluto.xyz](https://docs.pluto.xyz/) · [TEE mode](https://pluto.xyz/blog/web-proof-techniques-tee-mode) · [Origo mode](https://pluto.xyz/blog/web-proof-techniques-origo-mode) · [github.com/pluto](https://github.com/orgs/pluto/repositories) (org last push 2026-02-12)
- TACEO, multiparty notaries: [blog.taceo.io/mpc-zktls](https://blog.taceo.io/mpc-zktls)
- Lens: [lens.xyz/docs/chain/overview](https://lens.xyz/docs/chain/overview) · [introducing the new Lens](https://lens.xyz/news/introducing-the-new-lens)
- GitHub API (org repo push timestamps for tlsnotary, reclaimprotocol, primus-labs, OpacityLabs, pluto), queried 2026-07-24

**Primary — market pricing (fetched 2026-07-24)**
- [accsmarket.com/en/catalog/twitter](https://accsmarket.com/en/catalog/twitter) · [aged X](https://accsmarket.com/en/catalog/twitter/s-otlezhkoj-17)
- [accsmarket.com/en/catalog/reddit](https://accsmarket.com/en/catalog/reddit)
- [accsmarket.com/en/catalog/games/discord](https://accsmarket.com/en/catalog/games/discord)
- [accsmarket.com/en/catalog/telegram/telegram-s-otlezhkoj](https://accsmarket.com/en/catalog/telegram/telegram-s-otlezhkoj)
- [accsmarket.com/en/catalog/gmail](https://accsmarket.com/en/catalog/gmail)
- [playerup.com/accounts/githubaccount](https://www.playerup.com/accounts/githubaccount/) (GitHub, vendor listings only)

**Secondary (labelled as such)**
- Shoal Research, "zkTLS: Verifiable Data Composability": [shoal.gg/p/zktls-verifiable-data-composability](https://www.shoal.gg/p/zktls-verifiable-data-composability)
- Gate Learn, "zkTLS Explained": [gate.com/learn/articles/zk-tls-unlocking-crypto-consumer-apps/7509](https://www.gate.com/learn/articles/zk-tls-unlocking-crypto-consumer-apps/7509)
- BlockBeats zkTLS overview (Clique TEE model): [en.theblockbeats.news/news/57312](https://en.theblockbeats.news/news/57312)
- The Block, Opacity $12M seed: [theblock.co/post/321160](https://www.theblock.co/post/321160/opacity-network-funding-zk-data-verification)
- Vinayak Kurup, "Opacity Network: Trust but Verify": [medium.com](https://medium.com/@vinayak_35433/opacity-network-trust-but-verify-eb819ebb0b0a)
- Primus × Phala: [medium.com/@primuslabs](https://medium.com/@primuslabs/primus-x-phala-network-build-trustless-zktls-with-tee-332a26d48c83)
- Stanford Blockchain Review #74 (DECO): [review.stanfordblockchain.xyz/p/74-cryptography-research-spotlight](https://review.stanfordblockchain.xyz/p/74-cryptography-research-spotlight)
- X Premium pricing 2026: [tweethunter.io](https://tweethunter.io/blog/twitter-blue-vs-x-premium) · [tweetbe.at](https://tweetbe.at/blog/x-verification-guide-2026/) · [techbuzz.ai on 3-tier org verification](https://www.techbuzz.ai/articles/x-splits-business-verification-into-3-tier-premium-system)
- TLS fingerprinting 2026: [proxylabs.app/blog/ja4-tls-fingerprinting-2026](https://proxylabs.app/blog/ja4-tls-fingerprinting-2026) · [cside.com/blog/tls-fingerprinting](https://cside.com/blog/tls-fingerprinting)
- Post-quantum TLS & bot detection: [scrapfly.io/blog/posts/post-quantum-tls-bot-detection](https://scrapfly.io/blog/posts/post-quantum-tls-bot-detection)
- arXiv 2602.09606, "When Handshakes Tell the Truth: Detecting Web Bad Bots via TLS Fingerprints": [arxiv.org/abs/2602.09606](https://arxiv.org/abs/2602.09606)
- IETF `draft-ietf-tls-ecdhe-mlkem`: [datatracker.ietf.org](https://datatracker.ietf.org/doc/draft-ietf-tls-ecdhe-mlkem/)
