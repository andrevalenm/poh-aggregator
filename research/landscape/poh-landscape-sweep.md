# Proof-of-personhood landscape sweep

**Written:** 2026-07-24. All volatile facts date-stamped; `?` / `UNVERIFIED:` marks what I could
not confirm.

**Format note:** this is a landscape file, not a single-protocol write-up, so it does not use the
per-protocol headings from `../BRIEF.md`. It is the orienting map those files hang off.

**Scope:** the map of the whole proof-of-personhood (PoP) / sybil-resistance space, the theory
underpinning it, and the 2025-2026 repositioning of the field around AI agents. This is the
orienting document for the poh-aggregator research set (see `../BRIEF.md`). Depth on individual
protocols lives in `../protocols/`.

## Contents

1. Taxonomy of personhood evidence
2. Canonical literature
3. Roster of who exists (including projects no other agent covers)
4. The AI-agent inflection
5. Synthesis table: protocol x evidence type x scale x alive/dead
6. Implications for an aggregator

---

## 1. Taxonomy of personhood evidence

### 1.0 The two escapes from Douceur

Every PoP design is a choice between the only two escapes from the Sybil impossibility result
(Douceur 2002): **a trusted certifying authority**, or **a resource that cannot be replicated in
parallel**. Everything below is one or the other, or a hybrid.

- *Authority-rooted*: state documents, biometric dedup registries, KYC vendors, platform accounts.
  Uniqueness is asserted, not proven; you inherit the authority's error rate and its politics.
- *Resource-rooted*: your body's simultaneity (one place at one time), your social embedding
  (costly to fabricate), your money, your time. Uniqueness is *economic*: forgeable, but at a
  price.

The aggregator's real output is therefore not "human: true" but **an estimated cost to forge this
assertion at scale**, plus which authorities you had to trust to believe it. Keep that frame for
everything below.

### 1.1 Biometric uniqueness (iris / palm / face dedup)

- **Mechanism:** capture a biometric, compute a template, check it against a registry of all prior
  templates, reject on match. Optionally issue a ZK-wrapped nullifier.
- **Proves:** *global uniqueness within the registry, at the moment of enrolment*, conditional on
  (a) the sensor being genuine, (b) the dedup index being complete and honest, (c) the
  presentation-attack detection working.
- **Does not prove:** that the enrolled human still controls the credential. This is the single
  most under-stated fact in the whole space. Enrolment uniqueness and use-time uniqueness are
  different properties, and only the first is what biometrics deliver. Buterin makes exactly this
  point: renting, selling and coercion are only made "more annoying to implement and detectable."
- **Cost to forge at scale:** genuine enrolment fraud (fake iris/palm against the sensor) is
  expensive and improving-adversary-sensitive. **But the cheap attack is not forging the
  biometric — it is buying the human.** Documented market price for a real enrolment in
  low-income geographies has repeatedly been reported in the tens of dollars. So the honest
  cost-to-forge is roughly *the local price of an hour of a person's time plus travel*, not the
  cost of defeating a sensor.
- **Failure mode under a well-funded adversary:** (i) credential-rental markets — the human
  enrols honestly and sells session access or the recovery secret; (ii) issuer compromise or
  backdoor — a registry operator can mint uniqueness ex nihilo and it is externally
  undetectable (Buterin's centralisation risk); (iii) template-registry breach turns a
  privacy-preserving system into a permanent global biometric database, and biometrics are not
  revocable; (iv) coerced enrolment at population scale by a state.
- **Hidden aggregator hazard:** *iris, palm and face are different modalities but the same person
  and often the same enrolment session.* Two biometric credentials are not two independent
  pieces of evidence about uniqueness unless the registries are disjoint populations.

### 1.2 State-document evidence (passport NFC / eID / mDL)

- **Mechanism:** read a chip-signed document (ICAO 9303 passive authentication, eIDAS/EUDI, ISO
  18013-5 mDL), optionally with chip-active authentication and a liveness match to the portrait.
  ZK variants prove predicates without revealing the document.
- **Proves:** *a state asserts this natural person exists and holds this document*, plus (with
  active auth) that a genuine chip was physically present, plus (with face match) that the
  presenter resembles the portrait. Uniqueness is derivative: nullifier = hash(document number ‖
  issuer), or better, a passport-scoped nullifier.
- **Does not prove:** one-per-human globally. **A person can legitimately hold several passports**
  (dual/multiple nationality, plus new documents on renewal with fresh numbers). Naïve
  document-number nullifiers therefore over-count: one human, N valid credentials, all genuine.
  This is a structural, not incidental, weakness and it is systematically under-disclosed by ZK
  passport projects.
- **Cost to forge at scale:** forging chip signatures is infeasible without a national signing
  key — so direct forgery is essentially state-only. The practical attacks are: **stolen or
  purchased genuine documents** (a liquid criminal market, low hundreds of dollars), **relay of
  a genuine chip read** where active authentication is not enforced, and **complicit issuance** by
  a state that will sell citizenship documents. Also: **passport-chip data dumps are replayable**
  against verifiers that only do passive authentication.
- **Failure mode under a well-funded adversary:** buy a few thousand genuine documents in a
  jurisdiction with weak controls; or be a state. Also relevant: verification is only as good as
  the CSCA master list the verifier trusts — an incomplete or stale trust list silently accepts or
  rejects whole countries.
- **Coverage failure:** roughly a billion people lack any state ID at all. Any score that weights
  documents heavily is structurally exclusionary, which is Ford's "inclusion" axis.

### 1.3 Social graph / vouching

- **Mechanism:** existing members vouch for a newcomer; sybil resistance comes from the difficulty
  of embedding fake nodes into an honest graph (plus, usually, a challenge/deposit game).
- **Proves:** *social trust* — that some set of already-accepted identities asserted this one is a
  distinct human. Nothing more. It is explicitly **subjective** in the Siddarth et al. sense, and
  that is a feature: it is the only construction that does not bottom out in an authority.
- **Does not prove:** uniqueness, absent an honest majority in the relevant neighbourhood of the
  graph. Vouching is transitive-trust and therefore fails locally before it fails globally.
- **Cost to forge at scale:** the *attack edge* cost. Cheap in practice: bribing existing members
  to vouch has an observed market price, and a sybil region only needs a handful of attack edges
  to inject many fake nodes if the resistance metric is naïve. Deposit/challenge games raise the
  cost to roughly (deposit × sybils) minus the chance of not being challenged — i.e. it is really
  economic-stake resistance wearing a social costume.
- **Failure mode under a well-funded adversary:** buy an established sub-community outright
  (whole-region capture), or exploit the fact that challengers are only paid if they win — under
  a large enough sybil influx, challenge capacity is the bottleneck, not detection.
- **Under-appreciated strength:** it is the only category that **degrades gracefully and is
  revocable**. Biometrics cannot be revoked; a vouch can.

### 1.4 Synchronous ceremony (pseudonym parties, Idena-style epochs, Encointer meetups)

- **Mechanism:** all participants must act *simultaneously* at a globally-fixed instant — attend a
  physical gathering, or solve/validate flips in a synchronised epoch. Uniqueness comes from
  **non-parallelisability of one body / one attention**.
- **Proves:** that at time T, N distinct simultaneous participants existed. In the physical
  variant, this is the strongest anonymity-preserving uniqueness argument in the literature:
  no identity, no biometric, no document, no issuer.
- **Does not prove:** anything between ceremonies; credentials are inherently **term-limited**,
  which is why Ford treats periodicity as essential rather than a defect.
- **Cost to forge at scale:** the cost of physically renting N bodies for one hour, at N venues,
  simultaneously — genuinely linear in N and hard to compress. For the *online* variants (Idena),
  the cost is running N human-equivalent solvers at one instant, which in 2026 is the weak point:
  **LLM/vision models have collapsed the cost of the "only a human can do this" step.** Idena's
  flip puzzles were designed pre-multimodal-LLM.
- **Failure mode under a well-funded adversary:** for physical ceremonies — organiser capture of a
  venue (fake attendee lists), and the brutal logistics/exclusion problem that has kept every
  pseudonym-party implementation sub-100k. For online ceremonies — model-based solving, plus
  low-wage human farms, both cheap.
- **Verdict:** theoretically the best, empirically the least scaled. Nothing in this category has
  produced a credential base worth aggregating. Track, don't integrate.

### 1.5 Hardware / device attestation (secure enclave, TEE, SIM, eSIM, phone number)

- **Mechanism:** a hardware root of trust signs an attestation (Apple App Attest / DeviceCheck,
  Android Play Integrity + hardware-backed key attestation, TPM, or a mobile-network SIM binding).
- **Proves:** *a genuine unrevoked device in good standing exists and is running unmodified
  software*. Combined with per-device rate limits, that is a real anti-automation signal. Combined
  with a carrier SIM, it adds a weak, jurisdiction-dependent identity link.
- **Does not prove:** personhood at all. A person can hold many devices; a farm can hold thousands
  of genuine devices. **Device attestation is anti-emulation, not anti-sybil.**
- **Cost to forge at scale:** the retail price of a phone (~$50-100 used) plus a SIM, so
  ~$100/identity — cheap enough that device farms are a mature commercial industry. Attesting
  keys extracted from a single device have historically been leaked and enabled mass forgery.
- **Failure mode under a well-funded adversary:** buy a rack of real phones; or rent residential
  devices via consented-SDK "peer-to-peer proxy" networks; or exploit a leaked OEM attestation
  key. Also: platform-attestation is a **hard dependency on Apple and Google** — the two most
  centralised trust roots available.
- **Where it is genuinely useful:** as a *multiplier that lowers a score* (unattested/emulated
  device is strong negative evidence), not as positive personhood evidence.

### 1.6 Economic stake / cost-of-forgery

- **Mechanism:** bond capital, burn gas, hold a deposit subject to challenge, or pay a fee, so
  that N identities cost N × stake (or, in Buterin's pluralistic-ID target, **N²**).
- **Proves:** nothing about humanity. It proves only that acquiring this credential cost money.
- **Does not prove:** uniqueness — a rich adversary just pays. Its resistance is purely a budget
  comparison against the value of the attack.
- **Cost to forge at scale:** exactly the stake, times N, minus whatever is recoverable. Because
  stakes are usually refundable, the *true* cost is only the cost of capital plus the challenge
  risk — often 1-2 orders of magnitude below the headline stake.
- **Failure mode under a well-funded adversary:** trivially defeated by being well-funded. This is
  the definitional weakness: it converts sybil resistance into plutocracy, which is precisely the
  property one-person-one-vote exists to avoid.
- **Correct role:** a rate limiter and a spam filter, and a *superlinear* one if possible. Never a
  personhood signal on its own. In an aggregate score, stake should cap or gate, not add.

### 1.7 Behavioural / account history

- **Mechanism:** account age, transaction history, gas spent, graph position, staking history,
  ENS/POAP/NFT holdings, on-chain activity heuristics, ML risk scoring.
- **Proves:** that an account has a costly-to-fabricate *history*. It is a lower bound on time and
  money spent, nothing else.
- **Does not prove:** that a human is behind it — indeed the best-scoring accounts in most
  behavioural systems are bots, because bots transact more.
- **Cost to forge at scale:** the cost of *patience*. Farms pre-age wallets years in advance; a
  seasoned wallet is a purchasable commodity with a public market price. Costs are amortised
  across airdrops, so the marginal cost per campaign is low.
- **Failure mode under a well-funded adversary:** industrialised wallet-aging plus purchase of
  aged accounts. Also **adaptive**: any published scoring rubric is immediately optimised against,
  and unlike biometrics the adversary gets instant feedback on whether they passed.
- **Correct role:** a tie-breaker and a *negative* signal (fresh + funded-from-a-mixer = bad). Its
  positive weight should be small and decaying, and it should never be able to reach a passing
  score on its own.

### 1.8 zkTLS-attested web2 accounts (Reclaim, zkPass, TLSNotary, Opacity, Primus)

- **Mechanism:** an MPC/proxy/TEE-mediated TLS session lets a user prove statements about the
  contents of an authenticated web2 session (bank balance, Uber rides, X account age, Google
  account, government portal page) without the site's cooperation.
- **Proves:** *that some account at site S has property P*, cryptographically, without S opting
  in. This is the most powerful *evidence-portability* primitive in the space — it turns every
  existing KYC'd web2 relationship into a source.
- **Does not prove:** that the account belongs to the prover — only that the prover had access to
  it at proof time. **A rented or purchased login produces a perfectly valid proof.** Nor does it
  prove one-per-human: the source site's own uniqueness guarantees are inherited, and most web2
  sites have none.
- **Cost to forge at scale:** the price of accounts on the account-selling market — verified
  Gmail/X/Discord/Telegram accounts trade for single-digit dollars, KYC'd exchange and bank
  accounts for tens to low hundreds. So a zkTLS proof is worth roughly *the black-market price of
  the underlying account*, and that number is the honest scoring weight.
- **Failure mode under a well-funded adversary:** buy accounts; or, where the scheme uses a
  notary/proxy, collude with or compromise the notary. Trust models differ sharply — TEE-based
  (trust a chip vendor), MPC-based (trust a threshold), proxy-based (trust a witness not to
  collude with the prover). Several vendors blur which one they use. Also, sites can and do
  fingerprint and block proxy-based provers, so liveness of the integration is fragile.
- **Correct role:** excellent for *attributes* (age, residency, income band, account age), weak
  for *uniqueness*. In an aggregate score it belongs on a separate axis from personhood.

### 1.9 Cross-cutting: what none of them prove

1. **Continuity of control.** Every category proves something at issuance; none proves the human
   is still the one holding the key. Only repeated liveness does, and only for that moment.
2. **Non-coercion.** Only the synchronous physical ceremony offers a designed answer (an enforced
   private moment). Everything else is coercible, and ZK does not help — you can be forced to
   prove.
3. **Non-rental.** Nothing on this list survives a willing human who sells access. This is the
   attack that scales best against *every* category and is the one least discussed by vendors.
4. **Independence.** Most credentials in the market share a small number of roots (a passport
   chip, an Orb session, a phone number, a Google account). Summing them double-counts.

---

## 2. Canonical literature

### 2.1 Siddarth, Ivliev, Siri, Berman — "Who Watches the Watchmen?" (2020)

- **Full title:** *Who Watches the Watchmen? A Review of Subjective Approaches for Sybil-resistance
  in Proof of Personhood Protocols*
- **Authors:** Divya Siddarth, Sergey Ivliev, Santiago Siri, Paula Berman.
  **CORRECTION to the task brief:** the authors are *not* Ricón or Cortes — verified against the
  arXiv listing. (Siri and Berman are Democracy Earth / Proof of Humanity people; Ivliev is
  Humanode; Siddarth is RadicalxChange / Collective Intelligence Project.)
- **Dates:** submitted 2020-07-26 (arXiv 2008.05300); v5 2020-10-13. Published in
  *Frontiers in Blockchain* (2020).
- **URL:** https://arxiv.org/abs/2008.05300 · PDF https://arxiv.org/pdf/2008.05300
- **Core argument:** self-sovereign identity as built consists of "cryptographically signed
  statements issued by trusted third party attestors" — which is circular: it never answers *who
  verifies the verifier*. Objective credentials always bottom out in a centralised issuer
  (usually a state). The paper's move is to legitimise **subjective** inputs — voting, vouching,
  interpreting — as the only non-circular Sybil-resistance primitive, and to argue that good
  designs "do not abstract away subjectivity but instead embrace it as a necessity and strength."
- **Why it matters to us:** it is the canonical framing for why an aggregator cannot just pick the
  "most objective" credential. Every objective credential inherits the issuer's trust
  assumptions; the aggregate score has to model issuers, not just evidence.

### 2.2 Ford & Strauss — "Pseudonym Parties" (2008) and Ford (2020)

- *An Offline Foundation for Online Accountable Pseudonyms*, Bryan Ford & Jacob Strauss, SocialNets
  2008. Idea: a periodic, physical, in-person, federated event where each attendee receives exactly
  one anonymous token. The security root is **"you cannot be in two places at once"** — physical
  co-presence at a synchronous ceremony, not any attribute of the person.
- *Identity and Personhood in Digital Democracy: Evaluating Inclusion, Equality, Security, and
  Privacy in Pseudonym Parties and Other Proofs of Personhood*, Bryan Ford, Nov 2020
  (arXiv 2011.02412). URL: https://bford.info/pub/soc/personhood/ ·
  PDF https://arxiv.org/pdf/2011.02412
  - Four-axis evaluation framework: **inclusion, equality, security, privacy**. This is the best
    scoring rubric in the literature and we should reuse it.
  - Distinguishes *digital identity* (attributes about a person) from *digital personhood*
    (inalienable participation rights independent of identity). The aggregator is selling the
    second, using evidence of the first.
  - Surveys online ID verification, biometrics, SSI, and social trust networks and finds each has
    "severe flaws in security, privacy, and transparency."
  - Argues pseudonym parties are the only construction that gets strong accountability *and*
    strong anonymity simultaneously, plus **coercion resistance** — the physical event provides an
    enforced moment of privacy in which a coerced user can act freely.
- Follow-on work: EPFL DEDIS PoP test runs https://pop.dedis.ch/ and
  https://personhood.epfl.ch/ (referenced 2026-07-24 — UNVERIFIED whether these are still
  maintained; check last commit on github.com/dedis).

### 2.3 Buterin — "What do I think about biometric proof of personhood?" (2023-07-24)

- URL: https://vitalik.eth.limo/general/2023/07/24/biometric.html
- **The three-way taxonomy that the whole field now uses:**
  1. **social-graph-based** (Proof of Humanity, BrightID, Circles)
  2. **general-hardware biometric** (Idena, PoH video uploads — webcam/phone, no special device)
  3. **specialised-hardware biometric** (Worldcoin Orb iris)
- **Four risks:** privacy ("the registry of iris scans may reveal information"), accessibility
  (specialised hardware needs enormous geographic distribution), centralisation ("even if the
  software layer is perfect… the Worldcoin Foundation still has the ability to insert a
  backdoor"), security (phone hacking, ID selling, fake biometric creation, coerced scanning).
- **The key negative result for an aggregator:** biometric PoP *cannot* prevent credential renting
  / vote-selling, government coercion, or resale of an issued identity. It can only make these
  "more annoying to implement and detectable." Uniqueness-at-issuance ≠ uniqueness-at-use.
- **Direction:** combine all three; a social-graph system bootstrapped off tens of millions of
  biometric ID holders "could actually work."

### 2.4 Buterin — "Why I support privacy" / pluralistic identity (2025-06-28)

- URL: https://vitalik.eth.limo/general/2025/06/28/zkid.html (post on ZK-wrapped digital IDs)
- **Thesis:** ZK-wrapping does not fix the harm of *one-per-person* enforcement. "Under
  one-per-person ID, even if ZK-wrapped, we risk coming closer to a world where all of your
  activity must de-facto be under a single public identity." Meaningful pseudonymity "generally
  requires having multiple accounts."
- **Coercion:** perfect cryptography does not stop forced disclosure — "a government could force
  someone to reveal their secret, so that they can see their entire activity" (cf. visa
  applications demanding social-media handles).
- **Pluralistic identity:** an identity regime with **no single dominant issuing authority**.
  Two forms: *explicit* (social-graph / web of peer attestations, e.g. Circles) and *implicit*
  (many ZK-ID types coexisting, none dominant). Target property: **N identities cost O(N²)** —
  cheap to have a few, prohibitive to farm thousands.
- **This is, verbatim, the strategic argument for an aggregator.** A router across many issuers
  *is* implicit pluralism. Worth quoting in the pitch. It also implies the product should not
  hard-enforce one-account-per-human but expose a *cost-to-forge* number.

### 2.5 Weyl, Ohlhaver, Buterin — "Decentralized Society: Finding Web3's Soul" (2022-05)

- SSRN 4105763: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4105763 ·
  PDF https://www.radicalxchange.org/updates/papers/desoc.pdf
- Introduces **Souls** (accounts) and **soulbound tokens (SBTs)** — non-transferable tokens
  encoding commitments, credentials, affiliations.
- The PoP-relevant claim: Sybil resistance can be an **emergent property of the SBT graph**
  rather than a single credential. Correlation of SBT holdings across Souls reveals collusion;
  "novel markets with decomposable, shared rights", community recovery, quadratic-funding
  discounting by correlated affiliation.
- **What it actually delivered:** the *mechanism* (correlation discounting over an attestation
  graph) is directly what an aggregator should implement. The *artifact* (SBT standards) largely
  did not happen — see `identity-infra-prior-art.md`. Treat DeSoc as a scoring-design paper, not
  as a live standard.

### 2.6 Adler, Hitzig, Jain et al. — "Personhood credentials" (2024-08, rev. 2025-01)

- arXiv 2408.07892: https://arxiv.org/abs/2408.07892 — **32 authors** across OpenAI, Microsoft,
  MIT, Harvard, a16z, UC Berkeley, and others. This is the single most important paper for the
  2025-26 repositioning of the field, and it is *not* a crypto paper.
- Coins the term **personhood credential (PHC)**: a credential letting users "demonstrate that
  they are real people — not AIs — to online services, without disclosing any personal
  information." Two defining properties: (1) credential issuance requires an offline,
  hard-to-forge indicator of personhood, (2) service providers learn nothing beyond
  one-per-person-per-service.
- Explicitly issuer-agnostic: "issued by a range of trusted institutions — governments or
  otherwise."
- Frames the *demand*: CAPTCHAs are "inadequate against sophisticated AI"; full KYC is
  "insufficiently private for many use-cases." PHCs sit in between. **This is the aggregator's
  market thesis, written by OpenAI-affiliated researchers.**
- Companion press: MIT Tech Review, 2024-09-02 —
  https://www.technologyreview.com/2024/09/02/1103466/how-personhood-credentials-could-help-prove-youre-a-human-online/
  (secondary source).

### 2.7 Choudhuri, Garg, Lee, Montgomery, Policharla, Sinha — "A Cryptographic Framework for Proof of Personhood" (2026)

- IACR ePrint 2026/333: https://eprint.iacr.org/2026/333 — posted 2026-02-20, revised 2026-06-03.
  **Post-training-cutoff; the newest formal treatment found.** (Garg/Policharla are the Berkeley
  group behind zk-passport work — likely trust-root overlap with the ZK-passport agent's file.)
- Formalises two credential types: **PHCs** (issued by trusted authorities, attest uniqueness +
  basic attributes) and **VRCs — verifiable relationship credentials** (issued *peer-to-peer*,
  capturing reputation and real-world interaction). Composed with ZK proofs.
- Three formal security properties, which are exactly the right vocabulary for our score:
  **Sybil-resistance**, **authenticated personhood**, **unlinkability across contexts**.
- Significance for us: it is the first paper to treat *hierarchical issuer credentials + peer
  attestations* as one system with a joint security definition — i.e. an aggregator's math.
  UNVERIFIED: whether it evaluates deployed systems; the abstract does not, and I did not read
  the full PDF. Next step: read https://eprint.iacr.org/2026/333.pdf sections 4-6.

### 2.8 Foundational / supporting

- **Douceur, "The Sybil Attack" (IPTPS 2002)** — the origin. Result: without a trusted certifying
  authority *or* a resource-parity assumption, a single entity can always present multiple
  identities. Every PoP protocol is a choice of which of those two escapes to take.
  https://www.microsoft.com/en-us/research/publication/the-sybil-attack/
- **Noema, "We Need A Way To Prove Personhood Online"** —
  https://www.noemamag.com/we-need-a-way-to-prove-personhood-online/ (essay, secondary).
- UNVERIFIED / to chase: any 2025-26 systematisation-of-knowledge paper specifically comparing
  deployed PoP protocols on measured sybil rates. I found no such empirical paper; the field's
  numbers are still self-reported by protocols.

---

## 3. Roster of who exists

One line each, URL, and a **[DEEP DIVE]** flag where I think a dedicated file is warranted that no
current agent covers. Items already assigned to another agent are listed for completeness with
`→ agent` and no commentary.

### 3.1 Assigned elsewhere (map only)

| Project | URL | Assigned to |
|---|---|---|
| World / World ID (Tools for Humanity) | https://world.org | World ID agent |
| Circles / aboutcircles | https://aboutcircles.com | Circles agent |
| Humanity Protocol | https://www.humanity.org | Humanity agent |
| Proof of Humanity v1/v2, Kleros | https://proofofhumanity.id | PoH/Kleros agent |
| BrightID | https://www.brightid.org | PoH/Kleros agent |
| Idena | https://www.idena.io | PoH/Kleros agent |
| Human Passport (ex-Gitcoin Passport) | https://passport.human.tech | Passport agent |
| Civic | https://www.civic.com | Passport agent |
| Fractal ID | https://web.fractal.id | Passport agent |
| zkMe | https://zk.me | Passport agent |
| Galxe Passport | https://galxe.com/passport | Passport agent |
| Billions Network (ex-Privado ID) | https://billions.network | Billions agent |
| Silk (Human Wallet) | https://www.silk.sc | Billions agent |
| Sismo | https://sismo.io | Billions agent |
| Intuition | https://www.intuition.systems | Billions agent |
| EAS (Ethereum Attestation Service) | https://attest.org | EAS/Disco agent |
| Disco.xyz | https://www.disco.xyz | EAS/Disco agent |
| Privado ID | https://www.privado.id | Privado/Verax agent |
| Verax | https://www.ver.ax | Privado/Verax agent |
| ZK passport / eID family (Rarimo, OpenPassport/Self, zkPassport, Anon Aadhaar, Proof of Passport) | see below | ZK-passport agent |

### 3.2 Not assigned to anyone — the gaps I found

**Biometric-uniqueness protocols**
- **Humanode** — https://humanode.io — Substrate L1 where *consensus itself* is one-node-per-human
  via 3D face liveness (FaceTec-derived), "biometric processing in confidential VMs, template
  stays on device". Distinct from all others: personhood at the *consensus* layer, not as a
  credential. Blog: https://blog.humanode.io/proof-of-personhood-approaches/ .
  **[DEEP DIVE]** — it is the only serious non-World specialised-biometric network with a live
  chain, and its `bioauth` pallet is a readable on-chain surface. UNVERIFIED: 2026 active-node
  count and whether it exposes a credential consumable off its own chain.
- **FaceTec** — https://www.facetec.com — not a protocol; the 3D-liveness *vendor* underneath a
  large share of "liveness" claims across crypto and fintech. **Trust-root overlap alert:** if
  several protocols in our score all use FaceTec, they are one signal. Worth confirming per
  protocol.
- **Realeyes** — https://www.realeyesit.com — liveness/attention vendor, listed in the
  awesome-PoP index; peripheral.
- **Privasea / FheID** — https://www.privasea.ai — FHE-based "human likeness" verification with a
  **Telegram bot (`BotOr_NotABot`)** that binds a Telegram account to a biometric check.
  Notable as one of the few *chat-platform-native* personhood products.

**Synchronous ceremony**
- **Encointer** — https://encointer.org — Kusama **common-good parachain** (onboarded 2022-01-09),
  the only production implementation of Ford's pseudonym parties: globally-simultaneous,
  randomised physical meetups at random locations per community, issuing a term-limited PoP plus a
  local community currency. 2025-26 work is Tanzania field deployments, rotating savings groups
  ("Mchezo") and community loans — i.e. it has pivoted toward *financial inclusion*, not
  credential export. https://kusama.subsquare.io/polkassembly/posts/2683 ·
  https://parachains.info/details/encointer .
  **[DEEP DIVE — low priority]** Theoretically the most interesting PoP in existence, practically
  tiny; integrate only if we want a "gold standard, low coverage" tier.
- **EPFL DEDIS PoP / personhood.online** — https://pop.dedis.ch/ ,
  https://personhood.epfl.ch/ — Ford's own lab implementation. UNVERIFIED liveness in 2026; check
  github.com/dedis last commits.

**Social graph / vouching (beyond PoH, BrightID, Circles)**
- **First Person Project** — https://www.firstperson.network — cooperative trust-graph personhood.
  **[DEEP DIVE]** — genuinely unexamined by any agent; check whether it is more than a website.
- **Greencheck** — https://greencheck.world — bot-resistant verification network.
  **[DEEP DIVE]** — same caveat.
- **Veranon** — https://github.com/decentralized-identity/labs-veranon/ — a **DIF Labs** project
  doing ZK personhood verification. Notable because it puts personhood work inside the
  *Decentralized Identity Foundation*, i.e. the standards track rather than the token track.

**State-rooted / national**
- **Aadhaar (UIDAI, India)** — https://uidai.gov.in — ~1.4bn enrolled; the largest biometric
  dedup registry on earth and the de-facto uniqueness root for any India-facing product. The
  crypto surface is **Anon Aadhaar** (ZK proof over the signed Aadhaar QR) — assigned to the
  ZK-passport agent, but note that Anon Aadhaar proves *possession of a signed Aadhaar payload*,
  not liveness, and payloads are shareable.
- **EU eIDAS 2.0 / EUDI Wallet**, **ISO 18013-5 mDL**, national eIDs — covered by rows 11/12 of
  the salvage plan; if those files do not exist, they are a gap.
- UNVERIFIED gap: regional personhood efforts outside the US/EU/India axis — Brazil (Gov.br +
  the Worldcoin payment ban), Nigeria NIN, Indonesia, Kenya (Worldcoin suspension/reinstatement
  saga). Recommend a dedicated **[DEEP DIVE]** on *regulatory geography of biometric PoP*, since
  it determines coverage far more than technology does.

**Platform-native personhood (the largest deployments, all outside crypto)**
- **Reddit human verification** (from ~March 2026) — mandatory for suspected-bot accounts;
  reportedly World ID / government ID / anonymous-verification options. Secondary source only:
  https://www.recho.co/blog/reddit-launches-human-verification-to-combat-bot-crisis .
  **[DEEP DIVE]** — if real, this is the reference customer for the entire category.
- **Discord age verification** — ML age inference plus government-ID or face-scan escalation via
  third-party vendors; global rollout delayed to H2 2026 after backlash and a vendor breach
  reportedly exposing ~70k user IDs. Regulatory-driven (online-safety statutes), not bot-driven —
  but it is the same verification stack.
- **Telegram** — has a documented age-verification API surface:
  https://core.telegram.org/api/age-verification . Chat-platform-native identity primitives are
  an under-explored distribution channel for us.
- **X / Meta / TikTok paid-verification and age-assurance** — all now run identity vendors at
  population scale. UNVERIFIED which vendors; worth a sweep because their nullifier-free
  credentials are exactly what an aggregator could not currently consume.
- **Apple / Google device attestation** (App Attest, Play Integrity) — the largest deployed
  "not-an-emulator" signal in existence, free, and consumable today. Under-rated as a *negative*
  signal (see §1.5).

**Agent-side / AI-era (see §4)**
- **Web Bot Auth** (Cloudflare + IETF WG) — https://blog.cloudflare.com/web-bot-auth/ .
  **[DEEP DIVE]** — the standards-track counterpart to everything we do.
- **World AgentKit** — announced 2026-04-17, lets an agent authenticate its human operator via
  World ID; partners named include **Browserbase**, **Exa**, **Okta**, **Vercel**.
  https://world.org/blog/announcements/world-id-full-stack-proof-of-human
- **Okta "Human Principal"** — agent-acts-for-verified-human binding (beta).
- **C2PA / Content Credentials** — https://c2pa.org , https://contentcredentials.org — content
  provenance, adjacent not overlapping.

**Aggregators / scorers already in our lane (competitive)**
- **Human Passport** (assigned) is the incumbent aggregator; **Galxe Passport**, **Gitcoin**
  model, **Nomis** (https://nomis.cc), **Trusta Labs** (https://www.trustalabs.ai), **Chainlink
  DECO/zkTLS-adjacent**, **Quest platforms' internal sybil scoring** (Layer3, Zealy, Guild.xyz).
  **[DEEP DIVE]** on Trusta/Nomis-style behavioural scorers is nominally assigned (salvage rows
  13/14) — verify those files exist, else it is a gap.

### 3.3 Volatile facts worth pinning (all checked 2026-07-24)

- **World:** ~18m Orb-verified, 39m+ total World Network joiners, 160 countries, 475m+ World ID
  proofs issued (announced 2026-04-17, https://world.org/blog/announcements/world-id-full-stack-proof-of-human
  and secondary reporting). World Foundation raised **$52.5m** led by Pantera in a locked token
  sale, reported 2026-07-24 —
  https://www.coindesk.com/business/2026/07/24/sam-altman-backed-world-network-secures-fresh-funding-to-fight-online-ai-deepfakes .
  Reached 10m verified in Jan 2025 (https://www.biometricupdate.com/202501/world-network-reaches-10-million-verified-humans-amid-continued-legal-blocks)
  → ~18m by Apr 2026: **growth is roughly linear, not exponential**, against a stated 1bn target.
- **Humanity Protocol:** **>8 million Human IDs issued**; **publicly abandoned the term
  "Proof-of-Personhood" in favour of "Proof-of-Trust"** — biometric-backed *verifiable
  credentials* about attributes (identity, age, residency, employment eligibility, access) rather
  than a uniqueness network. Reported 2026-02-23:
  https://www.biometricupdate.com/202602/humanity-protocol-pivots-from-proof-of-personhood-but-sticks-with-palm-biometrics .
  Raised $20m Jan 2025 at a reported $1.1bn valuation.
  **This is a category-level signal: the #2 PoP network decided uniqueness was not the sellable
  product.** Flag to the Humanity agent — its file must lead with this pivot.
- **Rarimo:** raised $2.5m (Dec 2024) for ZK PoP; strategy is **zk-wrapping existing PoP methods**
  — i.e. a partial competitor to us on the aggregation axis.
  https://www.biometricupdate.com/202412/rarimo-raises-2-5m-to-advance-zero-knowledge-proof-of-personhood
- **Anima Protocol** — https://anima.io (UNVERIFIED current domain) — "Proof of Personhood" as one
  attribute among many. Appears low-activity; verify before including.
- **Useful running index:** https://github.com/andorsk/awesome-proof-of-personhood — small
  (17 stars, 15 commits) and *not* comprehensive, but its categorisation (biometrics /
  proof-of-work / social graph / identity proofs) is close to ours.
- **Trade press worth monitoring:** https://www.biometricupdate.com/tag/proof-of-personhood is the
  single best-maintained news source on this category. Recommend it as a standing feed.
- **Holonym Foundation acquired Gitcoin Passport in February 2025** (now Human Passport /
  passport.human.tech). Reported in
  https://www.biometricupdate.com/202505/proof-of-personhood-protocols-jockey-to-establish-networks-of-verified-humans
  (2025-05-09). Relevant because the incumbent aggregator changed owner and strategy recently —
  the Passport agent must not describe it as a Gitcoin product.
- **Regulatory status of World, as of the May 2025 sweep** (secondary, same article): **fully
  banned in Hong Kong**, **suspended in Indonesia**, with objections raised by **Germany, Kenya
  and Brazil**; US operations only launched May 2025. UNVERIFIED whether any of these were lifted
  by 2026-07. This is coverage-defining and belongs in its own file.
- **Also named in that sweep and otherwise invisible:** **HumanCode** (palm biometrics, partnered
  with TON Society Apr 2024) and **IDNTTY** — both `?`, both possibly dormant; check GitHub/docs
  before including in any scoring table.

---

## 4. The AI-agent inflection

> The demand driver moved between 2023 and 2026. 2021-2023 PoP demand was **airdrop-farming
> defence and quadratic-funding sybil defence** — a crypto-internal problem, low willingness to
> pay, adversary = mercenary farmer. 2025-2026 demand is **"is this account / this content / this
> counterparty a human at all"** — a mainstream-internet problem, real budget, adversary = anyone
> with an LLM. The protocols did not change much; the buyers did.

### 4.1 Evidence the repositioning is real (all post-cutoff, verified 2026-07-24)

- **World repositioned from "crypto UBI" to "full-stack proof of human" (2026-04-17).** Announced
  Tinder (global rollout after a Japan pilot; verified users get a World ID emblem), **Zoom**
  (deepfake defence on business calls), **DocuSign** (signer is an authenticated human), **Okta**
  (beta: verifying that *agents act on behalf of verified humans*, via a "Human Principal"
  framework), plus a ticketing product. Source (secondary):
  https://techcrunch.com/2026/04/17/sam-altmans-project-world-looks-to-scale-its-human-verification-empire-first-stop-tinder/
  and https://www.coindesk.com/tech/2026/04/17/sam-altman-s-world-project-launches-major-upgrade-to-fight-deepfakes-and-bots
  - **Structurally important:** World now ships **three tiers** — Orb (iris), mid-tier government
    ID via **NFC chip scan**, and **Selfie Check** (low-friction, on-device). That means World is
    itself becoming an aggregator of evidence types, not a single-evidence protocol. Any
    aggregate score must therefore ask *which World tier*, not just "has World ID". Hand this to
    the World ID agent as a required question.
- **Reddit made human verification mandatory for suspected-bot accounts (March 2026).** Options
  reportedly include World ID, government ID, and an "anonymous verification" path. Secondary:
  https://www.recho.co/blog/reddit-launches-human-verification-to-combat-bot-crisis —
  UNVERIFIED against a Reddit primary announcement; next step: search redditinc.com/blog and
  r/reddit for the official post. If true this is the largest consumer PoP deployment outside
  finance and materially validates the category.
- **Tinder / dating and ticketing** are the demand verticals that actually pay. Note these are
  *liveness + uniqueness* buyers, not *state-identity* buyers.

### 4.2 The counter-position: agent identity is the other half

The mirror-image market matured faster than PoP did, and it is standards-track rather than
token-funded:

- **Web Bot Auth** — Cloudflare-led, now an **IETF working group (chartered 2026)**. A bot signs
  each HTTP request with **Ed25519** under **RFC 9421 HTTP Message Signatures**, carrying
  `Signature-Input` (created/expires, key ID as JSON Web Thumbprint, tag `web-bot-auth`),
  `Signature`, and `Signature-Agent` pointing at a JWKS directory (e.g. `operator.openai.com`,
  `crawler.search.google.com`). Drafts: `draft-meunier-web-bot-auth-architecture`,
  `draft-meunier-http-message-signatures-directory`, `draft-meunier-web-bot-auth-glossary`.
  https://blog.cloudflare.com/web-bot-auth/ · https://blog.cloudflare.com/signed-agents/ ·
  https://blog.cloudflare.com/verified-bots-with-cryptography/
  - Backers per secondary reporting: Cloudflare, Amazon (AWS WAF shipped support 2025-11:
    https://aws.amazon.com/about-aws/whats-new/2025/11/aws-waf-web-bot-auth-support), Akamai,
    OpenAI. Cloudflare added a **Verified AI Agent** bot category and a **Challenge Agent** rule
    action — "prove you're a *known agent*" replacing "prove you're not a bot."
  - **What it proves:** that a request came from a keyholder claiming to be a named agent
    operator, untampered. **What it does not prove:** that a human is behind it, that the
    operator is honest, or anything about the end user. It is *attribution*, not personhood.
- **World AgentKit + x402 (beta, announced 2026-03-17)** — the concrete delegation credential that
  already exists. An SDK for e-commerce sites: a user registers their AI agent against their
  World ID, and the site is told "a distinct and verified human approves of this agent's
  purchasing decisions." It is wired into **x402 v2**, the payment protocol built by **Coinbase
  and Cloudflare**. Secondary:
  https://techcrunch.com/2026/03/17/world-launches-tool-to-verify-humans-behind-ai-shopping-agents/
  - **This is the shape to copy.** Agentic commerce is the first place where someone is actually
    paying for a personhood assertion, and the assertion is *delegated*, not direct. An aggregator
    that can back an x402-style flow with *any* of N personhood roots — rather than only an Orb —
    is directly substitutable for AgentKit and strictly more available (AgentKit's strongest tier
    requires an Orb, which is unavailable or banned in several large markets).
- **Okta "Human Principal"** (beta, announced with World 2026-04) — binds an agent's actions to a
  verified human principal. UNVERIFIED technical detail; next step: okta.com developer blog /
  "Auth for GenAI".
- UNVERIFIED / to chase in a dedicated pass: Google **AP2** (Agent Payments Protocol), **Visa
  Trusted Agent Protocol**, Skyfire, Catena Labs, and "KYA / know-your-agent" vendors. These
  matter because they carry a *delegation* field that an aggregator could consume.
- **Market note:** an agent-funding survey (2026) observes that "human approval is conspicuously
  underfunded as a standalone category" — oversight is being bundled into agent platforms rather
  than bought separately. Read that two ways: thin standalone budgets today, but also no
  entrenched incumbent. Secondary: https://aifundingtracker.com/top-ai-agent-startups/
- **C2PA / Content Credentials** — provenance for *content*, not accounts:
  https://c2pa.org/ , https://contentcredentials.org/ . Signs "this media came from this
  device/tool with this edit history." Adjacent but orthogonal: it answers "was this
  camera-captured or AI-generated", never "is the account human." An aggregate humanity assertion
  should not absorb C2PA claims, but a *content*-facing customer may want both.

### 4.3 What this means for what our aggregate assertion should assert

1. **"Human" is no longer the whole question.** The three live questions are:
   (a) is there a unique human? (b) is a human *present right now*? (c) is a human
   *accountable* for this action (possibly via a delegated agent)? These decay differently — (a)
   is durable, (b) is per-session, (c) is per-action. A single scalar score conflates them. Our
   assertion should be at minimum a triple.
2. **Freshness becomes first-class.** Airdrop defence tolerated a credential minted two years ago.
   Deepfake-defence on a Zoom call does not. Any assertion needs `last_proven_at` and an explicit
   liveness recency field, not just "holds credential X."
3. **Agent-positive, not agent-negative.** The valuable assertion in 2026 is not "not a bot" but
   **"this actor is a human, OR an agent with a verifiable human principal, and here is which."**
   Refusing all agents is commercially wrong — the fastest-growing traffic is *authorised* agent
   traffic. Design the schema so `agent_delegation` is a populated field, not a rejection.
4. **The cheapest credible signal wins the volume.** World's own Selfie Check tier, Cloudflare's
   Challenge Agent, and Reddit's "anonymous verification" all point the same way: buyers want a
   ~zero-friction default with an escalation ladder. An aggregator that *routes by required
   assurance level* rather than always demanding the strongest credential is the right product
   shape.
5. **Beware evidence collapse.** As World, Reddit, Tinder etc. converge on the same few
   underlying roots (Orb iris, NFC passport chip, on-device selfie), a user "verified" by three
   platforms may be three readings of one root. Correlated evidence must be discounted — this is
   exactly the DeSoc correlation-discounting mechanism (§2.5) and the practical core of our
   scoring problem.

---

## 5. Synthesis table

Evidence-type codes (from §1): **BIO** biometric-uniqueness · **DOC** state document ·
**SOC** social graph/vouch · **CER** synchronous ceremony · **HW** device/hardware attestation ·
**ECON** economic stake · **BEH** behavioural/account history · **ZKTLS** zkTLS web2 attestation ·
**AGT** agent identity (not personhood) · **AGG** aggregator/scorer (no native evidence).

"Proves" uses BRIEF.md vocabulary: *uniq* = uniqueness, *live* = liveness, *soc* = social trust,
*state* = state identity, *beh* = behavioural.

Scale figures are **as of 2026-07-24** and are self-reported by the projects unless noted.
`?` = UNVERIFIED, and the "next step" is given in §3 or the protocol file.

| Project | Evidence | Actually proves | Rough scale | Status 2026-07 |
|---|---|---|---|---|
| World / World ID | BIO (iris) + now DOC (NFC) + BIO-lite (Selfie Check) | uniq at enrolment; live at check | ~18m Orb-verified, 39m+ joined, 160 countries, 475m+ proofs | **Alive, dominant, expanding**; banned HK, suspended Indonesia, objections DE/KE/BR; $52.5m raise 2026-07-24 |
| Humanity Protocol | BIO (palm) | attributes via VCs; **no longer claims uniq** | >8m Human IDs | **Alive, pivoted** to "Proof-of-Trust" (2026-02) |
| Humanode | BIO (3D face) at consensus layer | uniq per node | ? nodes | Alive; scale unverified **[DEEP DIVE]** |
| Billions Network (ex-Privado) | DOC (passport) + phone | state + weak uniq | ? | Alive |
| Rarimo | DOC/ZK wrapper over other PoP | inherits wrapped source | ? | Alive; $2.5m Dec 2024 |
| zkPassport / OpenPassport-Self / Proof of Passport | DOC (ICAO chip, ZK) | state; uniq only per-document | ? | Alive |
| Anon Aadhaar | DOC (signed Aadhaar payload) | possession of payload; **not** live | India-scale addressable | Alive |
| EUDI Wallet / eIDAS 2.0 | DOC (state eID) | state identity | EU-mandated rollout | Regulatory, not yet a consumable credential at scale |
| Proof of Humanity v1/v2 | SOC + video + ECON deposit | soc + live; uniq only as far as jurors | low tens of thousands `?` | Alive (Gnosis + mainnet; Kleros dev update Jun 2026) |
| BrightID | SOC (verification parties) | soc | ? declining | Alive but low momentum `?` |
| Circles | SOC (trust graph, personal currency) | soc | ? | Alive; Buterin-endorsed as *explicit pluralistic identity* |
| Idena | CER (synchronous flip epochs) + BEH | uniq-at-epoch; **weakened by multimodal LLMs** | epoch 215, 9 candidates in the current epoch — small | **Alive but tiny** (api.idena.io/api/Epoch/Last, checked 2026-07-24) |
| Encointer | CER (physical pseudonym parties) | uniq, strongest anonymity | small, community-scale | Alive as Kusama common-good parachain; pivoted to financial inclusion |
| EPFL DEDIS PoP | CER | uniq | research | `?` maintenance |
| First Person Project | SOC | soc | ? | `?` **[DEEP DIVE]** |
| Greencheck | SOC | soc | ? | `?` **[DEEP DIVE]** |
| Veranon (DIF Labs) | ZK over identity | uniq `?` | research | Alive, standards-track |
| Human Passport (Holonym, ex-Gitcoin) | AGG over BEH/DOC/ZKTLS | composite; mostly beh | large in Gitcoin rounds | Alive; acquired by Holonym Feb 2025 — **direct competitor** |
| Galxe Passport | AGG + DOC (KYC) | state | large `?` | Alive |
| Civic | DOC + BIO (KYC vendor) | state + live | large `?` | Alive |
| Fractal ID | DOC (KYC) | state | ? | Alive `?` — check for 2021 breach history |
| zkMe | DOC + BIO, ZK-wrapped | state, uniq `?` | ? | Alive |
| Silk / Human Wallet | AGG (wallet-embedded) | composite | ? | Alive |
| Sismo | ZK attestation aggregation (Sismo Connect) | attributes | — | **Dormant** — no shutdown notice found, but github.com/sismo-core repo activity trails off in 2023 (checked 2026-07-24) |
| Disco.xyz | AGG (VC data backpack) | none native | — | `?` likely dead/pivoted — verify last release |
| EAS | infra (attestation registry) | none native | wide | Alive; a substrate, not a credential |
| Verax | infra (attestation registry, Linea) | none native | — | Alive `?` |
| Intuition | infra (attestation/knowledge graph) | none native | — | Alive `?` |
| Privado ID | infra (Iden3/Polygon ID lineage) | issuer tooling | — | Alive; spun Billions out |
| Nomis / Trusta Labs | BEH scoring | beh only | — | Alive, commercial |
| Aadhaar (UIDAI) | BIO + DOC, state registry | uniq (national) + state | ~1.4bn | Alive; the largest dedup registry on earth |
| FaceTec | BIO liveness vendor | live | embedded everywhere | Alive — **shared trust root, watch for double-counting** |
| Privasea / FheID | BIO + FHE, Telegram-native | live | small | Alive `?` |
| HumanCode | BIO (palm, TON Society) | uniq `?` | ? | `?` — check whether it survived past 2024 |
| IDNTTY | ? | ? | ? | `?` — thin evidence, may be vapour |
| Anima | AGG + attributes | composite | small | `?` low activity |
| Reddit human verification | DOC/BIO via vendors | live + state | Reddit-scale | **Rolling out 2026** — largest consumer deployment `?` |
| Discord age verification | BEH (ML age inference) + DOC/BIO escalation | age, not personhood | Discord-scale | Delayed to H2 2026 after breach/backlash |
| Telegram age verification API | DOC/BIO via partners | age | Telegram-scale | Documented API |
| Apple App Attest / Google Play Integrity | HW | genuine device, not personhood | ~all smartphones | Alive; free; underused |
| Web Bot Auth (Cloudflare/IETF) | AGT | agent operator attribution | Cloudflare-scale | **Alive, IETF WG chartered 2026**; AWS WAF support Nov 2025 |
| World AgentKit / Okta Human Principal | AGT + BIO delegation | human-behind-agent | beta | New Mar-Apr 2026 |
| C2PA / Content Credentials | content provenance | media origin, not personhood | industry-wide | Alive; adjacent |
| Pseudonym parties (Ford, concept) | CER | uniq, coercion-resistant | — | Literature, not a deployment |

**Reading of the table.**
- The **entire non-World credential base is small**. Nothing in crypto-native PoP except World is
  clearly above single-digit millions of *verified* users, and Humanity's 8m are now
  attribute-credentials rather than uniqueness claims.
- The **big deployments are all outside crypto** (Aadhaar, Reddit, Discord, Apple/Google) and none
  of them currently exposes a nullifier an aggregator can consume. That gap *is* the product.
- **Evidence diversity is much lower than protocol diversity.** ~40 rows collapse to maybe six
  distinct trust roots: an iris registry, a palm registry, ICAO passport chips, national eID
  registries, a handful of KYC/liveness vendors (FaceTec et al.), and web2 account ownership.

---

## 6. Implications for an aggregator

1. **Score trust roots, not credentials.** The unit of independence is the root (this passport
   chip, this Orb session, this Google account), not the badge. Build a root-graph and discount
   correlated evidence — this is the DeSoc mechanism (§2.5) and the single highest-value piece of
   IP in the product. Naïve additive scoring is not just imprecise, it is *wrong in the adversary's
   favour*, because a farm's credentials are maximally correlated.
2. **Publish a cost-to-forge, not a probability.** Every category in §1 has a market price. An
   assertion of the form "forging this profile costs ≥ $X at scale, under these issuer trust
   assumptions" is defensible, auditable, and directly usable by a customer sizing an attack. A
   0-100 "humanity score" is not.
3. **Assert a triple, not a scalar:** `unique_human`, `live_recently` (with timestamp), and
   `accountable_principal` (human, or agent with named human principal). §4.3.
4. **Adopt Ford's four axes** (inclusion, equality, security, privacy) as the per-protocol rubric
   in every protocol file, so the files are comparable.
5. **The aggregator is the "implicit pluralism" Buterin asked for** (§2.4). That is both the pitch
   and a design constraint: do not become a single dominant issuer, and do not enforce
   one-account-per-human — expose the cost curve and let the app choose its point on it.
6. **Route by required assurance, not maximum assurance.** The 2026 buyers (dating, ticketing,
   conferencing, forums) mostly want a cheap default with escalation. A router that can say "for
   this action, Selfie-Check-tier is enough" is more valuable than one that always demands an Orb.
7. **Coverage is a regulatory question, not a technical one.** World is banned or suspended in
   several large markets; ~1bn people have no state ID; palm/iris registries are regional. Our
   routing table has to be jurisdiction-aware from day one.
8. **Watch the competition on both flanks:** Human Passport (Holonym) as the incumbent web3
   aggregator, Rarimo as a zk-wrapper aggregator, and World itself, which by shipping three
   verification tiers plus AgentKit is becoming a vertically-integrated aggregator that does not
   need us.

---

## Open questions this file could not close

- Is the Reddit human-verification rollout real and at what scale? Only secondary sources found.
  Next: redditinc.com/blog, r/reddit official posts, Reddit's 2026 10-K/earnings language.
- Full text of IACR ePrint 2026/333 — does it evaluate deployed systems, and does its
  PHC+VRC composition give us a usable formal scoring model? Next: read the PDF, §§4-6.
- Live registered-human counts for PoH v2, BrightID, Circles — must come from subgraphs/contracts,
  not marketing pages. Assigned agents should pull these on-chain.
- Whether Sismo, Disco, Anima, HumanCode, IDNTTY are alive. Next: last commit / last release on
  GitHub, docs-site liveness.
- Which liveness vendor sits under each "liveness" claim (FaceTec vs in-house vs Onfido/Persona) —
  this determines double-counting and no protocol advertises it.
- Regulatory geography of biometric PoP (Kenya, Indonesia, Hong Kong, Brazil, Germany, Spain,
  Portugal, Colombia) — deserves its own file; it bounds coverage more than technology does.
