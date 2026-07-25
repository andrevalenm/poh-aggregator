# Research index

Master index of all research in this repo. **~25,940 lines across 43 files**, written 2026-07-24 and after
against live sources — contracts queried over RPC, repos read at HEAD, prices fetched the same day.

Every file follows [BRIEF.md](BRIEF.md). Volatile facts are date-stamped; unconfirmed claims are
marked `UNVERIFIED:` or `UNCLEAR:` rather than guessed.

> **Provenance.** This is a **full re-run**, not the salvage described in
> [SALVAGE-STATUS.md](SALVAGE-STATUS.md). The raw material from the original killed session existed
> only on the machine that ran it and was not available here, so all 21 topics were researched from
> scratch. See that file for the history.

---

## Read these first

If you read nothing else, read these four. They contain the findings that should determine whether
and how the product gets built.

| File | Why |
|---|---|
| [landscape/prior-art-scoring.md](landscape/prior-art-scoring.md) | The scoring architecture. Resolves the correlation problem without needing cross-protocol linkability. |
| [references/ohlhaver-corpus.md](references/ohlhaver-corpus.md) | The strongest argument that this product should not exist in global form, at full strength. |
| [landscape/demand-and-regulation.md](landscape/demand-and-regulation.md) | Whether anyone pays. Currently: not much, and the reference customer chose a free alternative. |
| [landscape/sybil-incidents-antipatterns.md](landscape/sybil-incidents-antipatterns.md) | What has already failed, so we don't rebuild it. |

---

## Protocols — candidate inputs

One deep-dive each: what it proves, trust root, on-chain surface, integration surface, privacy
model, and overlap with other protocols.

| File | Covers | Category | Verdict |
|---|---|---|---|
| [world-id.md](protocols/world-id.md) | World ID / World, Orb, document tier, Selfie Check, AgentKit | uniqueness + state-identity + liveness (three distinct credentials) | **Integrate now**, highest single weight, three hard caveats |
| [zk-passport-and-eid.md](protocols/zk-passport-and-eid.md) | ZKPassport, Self, Rarimo, Anon Aadhaar | state-identity (per **document**, not per human) | ZKPassport now; Self/Rarimo later; Anon Aadhaar skip (dormant) |
| [circles.md](protocols/circles.md) | Circles v1/v2 on Gnosis | social-trust | **Integrate later**, as a graph-derived modifier only |
| [poh-kleros-brightid-idena.md](protocols/poh-kleros-brightid-idena.md) | Proof of Humanity v1/v2, Kleros, BrightID, Idena | social-trust / ceremony | PoH now (low weight, weight by age); BrightID and Idena **skip** |
| [passport-civic-fractal-zkme-galxe.md](protocols/passport-civic-fractal-zkme-galxe.md) | Human Passport, Civic, Fractal ID, zkMe, Galxe | aggregate scores + KYC-rooted | Passport as a *signal* only; the rest mostly dead or vendor-rooted |
| [humanity-protocol.md](protocols/humanity-protocol.md) | Humanity Protocol, palm biometrics, Human ID | markets uniqueness, delivers state-identity | **Skip** |
| [billions-silk-unitap-sismo-intuition.md](protocols/billions-silk-unitap-sismo-intuition.md) | Billions, Holonym/Silk, Unitap, Sismo, Intuition | mixed | Billions later; the rest dead, pivoted, or negligible |
| [eas-and-disco.md](protocols/eas-and-disco.md) | Ethereum Attestation Service, Disco.xyz | substrate, not a credential | EAS **as an output rail**; Disco is dead and its domain is now hostile |
| [privado-id-and-verax.md](protocols/privado-id-and-verax.md) | Privado ID (iden3), Verax | credential plumbing | Verax as a narrow input; Privado neither |

### Added after the sweep — how a protocol is actually read

Written by the unattended build iterations while implementing a probe, so they cover the
mechanism rather than the landscape: which call, at which address, what the numbers mean, and
what the read cannot see. Each names the deep dive above that it builds on.

| File | Covers | Adds |
|---|---|---|
| [human-passport-onchain-read.md](protocols/human-passport-onchain-read.md) | Human Passport across seven Decoder deployments | Read the resolver, not `getScore`; 90-day hard expiry; the stamp→trust-root map |
| [farcaster-onchain-read.md](protocols/farcaster-onchain-read.md) | Farcaster `IdRegistry` on OP Mainnet | Dating a registry with no timestamps from `idCounter`; the 193,791-fid import; fids change hands |
| [holonym-human-id-onchain-read.md](protocols/holonym-human-id-onchain-read.md) | Holonym / Human ID Hub V3 on OP Mainnet | No action-id needed after all; the issuer must be checked or the SBT is forgeable; the circuit's one-year ceiling is the date |
| [world-id-onchain-read.md](protocols/world-id-onchain-read.md) | World ID on World Chain | `WorldIDAddressBook` is the registry World populates, not AgentBook; `verifiedUntil − 168 days` is the exact verification block; the mapping is never cleared, so held is a comparison; one live binding per human, enforced on chain; the document and Selfie tiers leave no per-holder state anywhere |
| [linea-poh-onchain-read.md](protocols/linea-poh-onchain-read.md) | Linea PoH V2 via Verax on Linea | There is no per-subject read, so enumerate the whole live population — a 90-day term confines it to 1,024 of 6.37M ids; the portal our research named is the dead test one; Linea's own `poh-api` and `PohVerifier` say yes ten months after expiry |
| [poh-v1-onchain-read.md](protocols/poh-v1-onchain-read.md) | Proof of Humanity v1 on Ethereum mainnet | `isRegistered` is a comparison and the struct's `registered` flag outlives the term; PoH v2's ForkModule retires registrations v1 keeps honouring, one for 510 days; acceptance emits nothing and can lag the request by 761 days, so only a full-history scan enumerates the registry — 2 registered out of 20,740 lifetime submissions |
| [ens-agent-identity.md](protocols/ens-agent-identity.md) | ENS as the carrier of agent identity, Sepolia | Sepolia `.eth` is free and instant today (`TestnetV1PremigrationRegistrar`, no commit/reveal) — the previous "mid-migration, parked" verdict was the wrong contract and a wrong event topic; the registrar's own atomic-records path cannot work, and why; a name tree can be **counted but never named** (labels are hashed by the caller); **a self-published human↔agent binding makes a per-human cap free to evade**, and the acknowledgement record that closes it |
| [world-agentbook-fleets.md](protocols/world-agentbook-fleets.md) | World Chain AgentBook, read as a fleet index | `humanId` is the registering proof's nullifier hash, read from calldata; the whole registry is 1,164 registrations in six calls; **830 humans run 1,164 agents and one runs 27**; AgentBook and the AddressBook use different external nullifiers, so an agent can never be walked to its operator's verified wallet; a free endpoint returns `[]` for ranges that hold 39 logs |
| [poh-lapsed-credentials.md](protocols/poh-lapsed-credentials.md) | Proof of Humanity v1 + v2 — the credential that ended | Neither registry deletes an ending, so an expired credential's window is readable at head with no archive node: v2 leaves `owner` and `expirationTime` on an expired humanity while all three "is this a human" getters go quiet, and v1's never-cleared `registered` flag makes `registered && !isRegistered` an exact statement that only arithmetic ended it; the account→humanity link is a `private` mapping read from **storage slot 62**, found by scanning and self-validated by the owner check; **21 of 1,569 humanities are lapsed and restorable, 196 had `owner` cleared and are not**, and `nbRequests == 0` — the cross-chain grant path — is exactly the population whose derived start misses (−215.5 and +144.7 days) |
| [passport-and-linea-lapsed-credentials.md](protocols/passport-and-linea-lapsed-credentials.md) | Human Passport + Linea PoH V2 — the credential that ended | The resolver keeps a cached score the Decoder has stopped honouring, and the EAS attestation behind it survives un-revoked with the subject still named — so a lapsed passport is restorable where a lapsed Holonym SBT is not; a Verax attestation is immutable, so reaching **one term further back** than the live window (30 days, 3 extra batched calls) turns 494 live subjects into **1,025 with a closed dated window**, which matters because 99% of this protocol's 50,475 attestations are lapsed; coverage is derived from the scan's own floor, not from the constant that chose it; a revocation with no `revocationDate` gets no window because the expiry is only an upper bound on it; and our own passport live test had stopped covering anything, silently, for two independent reasons at once |
| [circles-stop-and-the-broken-getter.md](protocols/circles-stop-and-the-broken-getter.md) | Circles v2 — `stop()`, and a getter that answers about the caller | The last adapter asked whether the chain dates an ending, and the answer is that Circles **has** no ending: nothing ever clears `mintTimes[a].lastMintTime`, so `isHuman` (`lastMintTime > 0`) is monotonic and a registration cannot be revoked. Its one transition, `stop()`, writes `type(uint96).max` to that same field — greater than zero, so a stopped avatar is still a registered human. Reading it as a revocation, which the SDK did until iteration 20, made one subject held at chain head and **not held whenever the Gnosis RPC failed**. And the Hub cannot be asked: `stopped(address _human)` validates `_human` and then reads `mintTimes[msg.sender]`, so with no `from` it reports `false` for both avatars that have ever stopped and `true` for one that never did when the caller has — measured three ways at head. Read instead from **storage slot 21**, checked against `isHuman` on every call (252/252 agree, including 4 unregistered), which makes a moved layout cost the flag and never invent one |
| [passport-attester-pin.md](protocols/passport-attester-pin.md) | Human Passport — who is allowed to write a passport | The adapter reads one mapping, so the question underneath it is who may write to it, and the answer is **two independent gates the resolver publishes**: `attest` is `onlyAllowlisted` on the caller and `_attest` reverts `InvalidAttester()` unless the struct's attester is `_gitcoinAttester`. Both moved under simulation — a stranger gets `0x06fb10a9`, EAS with a forged attester gets `0xb8daf542`, and the genuine pair returns `true`, which is the control that makes the two reverts mean anything. The deployed implementation was identified from its **34 bytecode selectors with none unattributed**, and it has no `onAttest` at all, which is why the open question had no answer to look up. There are **five distinct attesters across seven deployments**, so both anchors are read from the resolver at run time; the record behind every counted credential is checked against EAS, matched to the cached struct by `time` because a subject who moved to score-v2 has a uid under each schema. A contradiction removes the credential; a read that would not answer never does. What it does **not** close: the resolver is UUPS-upgradeable and its owner can allowlist writers, so the claim is "no one outside Passport", which is all an issuer pin can mean for a hosted credential |
| [poh-endings-the-index-cannot-see.md](protocols/poh-endings-the-index-cannot-see.md) | Proof of Humanity v2 — the endings an index cannot see | The audit of every index flag in the repo, asked in both directions. Our `revoked` flag is faithful — `HumanityRevoked` is emitted only where the contract does `delete humanity.owner`, proved by moving one block around the registry's **only** revocation (owned with a revocation pending at 41,268,458, unowned in 41,268,459 where the log sits) — and it is also **empty: 0 of 1,576 indexed humanities carry it**, because the one revocation was re-claimed and the mapping cleared the flag. The defect is the other direction: a humanity also ends by **expiring** (no event exists to index) and by **leaving the chain** (`HumanityDischargedDirectly`, **33 all-time, 25 since 2026-05**), so **217 of 1,576 indexed humanities — 13.8% — are not held on chain and carry no ending in our index**. At head the chain overrules them; on a failed chain read the old reconciler returned them held, dated and at full ramp weight. Fixed by `observesEveryEnding`: an index may answer alone only where it can see every way the credential stops being held — vacuously true for Circles, false here |
| [poh-imported-terms.md](protocols/poh-imported-terms.md) | Proof of Humanity v2 — the term behind an expiry is not always this contract's | Every PoH score rests on `expirationTime - humanityLifespan()`, which is exact only where *this* contract wrote the expiry. `ccGrantHumanity` copies one settled elsewhere, and the full-history grant sweep (nine, ever) says **seven of the nine came from PoH v1, whose term is 63,115,200 s against v2's 31,557,600** — every one reproducing `submissionTime + submissionDuration` to the second, so the local subtraction landed **exactly one v2 lifespan (365.25 days) after the true registration** and reported a two-year-old credential as one year old. The guard that existed, `nbRequests == 0`, is sound and **misses 3 of the 9** — two of them held and scoring today — because a discharge leaves the request history intact and a renewal after an import adds to it. Replaced by the log the registry publishes: `HumanityGrantedDirectly` carries the exact expiry it wrote, one memoised sweep costs ~400 ms once and nothing warm, and the origin instance's own registration then supplies the date. An age crosses the bridge; a window does not |
| [poh-lifespan-timeline.md](protocols/poh-lifespan-timeline.md) | Proof of Humanity v2 — which of this contract's terms wrote an expiry | The other half of the premise behind every PoH date. `expirationTime - humanityLifespan()` reads the term at **head** and subtracts it from an expiry written in the past, and the field is governance-settable — so one `changeDurations` would shift every derived date in the registry at once, by the size of the change, with nothing watching. Not hypothetical: PoH **v1**'s equivalent has already moved (31,557,600 → 63,115,200) and v1's setter emits **nothing** (L563-568). v2 emits `DurationsChanged`, and it is the only writer after `initialize`, so a full-range sweep is a complete history of the term — **0 logs on Gnosis (35,846,827 → 47,391,312, 124 ms) and 0 on mainnet (20,685,061 → 25,613,069, 95 ms)**, which turns the assumption into a proof and moves nothing at head. Where a change does land the timeline dates it, so each cohort is dated with its own era's term rather than every date being discarded; an expiry two eras explain, or one only the era `initialize` never published explains, gets no date. +~100 ms once per process, nothing warm |
| [protocol-subgraph-coverage.md](protocols/protocol-subgraph-coverage.md) | Our own Gnosis subgraph — Circles + PoH coverage and dates | The Circles Hub's first credential is block 36501311 and full history is ~317k events, a quarter of what the manifest assumed; an index must state its own lower edge or a narrowed redeploy silently turns "we cannot see it" into "it did not exist"; **10 of 21 registrations in a sampled window were trusted before they registered**, so a trust-edge date is only a floor because the registration handler overwrites it; the index's oldest PoH "claim" is a vouch 165,172 blocks before the protocol's first claim, and a vouch precedes issuance in all 6 observable cases — the one direction that pays an adversary on a ramp |

## Landscape — the field, the theory, and the adversary

| File | What it establishes |
|---|---|
| [poh-landscape-sweep.md](landscape/poh-landscape-sweep.md) | The map: 8-category evidence taxonomy, canonical literature, ~40-project roster, the AI-agent inflection. **Start here for orientation.** |
| [prior-art-scoring.md](landscape/prior-art-scoring.md) | How to combine correlated evidence. Bayesian, Dempster–Shafer, copulas, IRT, minimax; recommends **root-cost aggregation**. Worked toy example. |
| [sybil-incidents-antipatterns.md](landscape/sybil-incidents-antipatterns.md) | The empirical record of failure, with numbers. Detection ceiling, rental economics, the antipattern catalogue. |
| [behavioral-scorers.md](landscape/behavioral-scorers.md) | Detector catalogue with **topology preconditions**, plus the base-rate arithmetic that constrains what we may do with a score. |
| [kyc-liveness-vendors.md](landscape/kyc-liveness-vendors.md) | Who actually performs the check underneath the branding. **The dedup buckets are built from this file.** |
| [demand-and-regulation.md](landscape/demand-and-regulation.md) | Who pays, what law forces the issue, and the correlation-honeypot liability. |
| [reputation-scoring-products.md](landscape/reputation-scoring-products.md) | The competitors as businesses. Mostly dead, pivoted, or returning capital. |
| [identity-infra-prior-art.md](landscape/identity-infra-prior-art.md) | The graveyard — uPort, Sovrin, ION, Ceramic, SBTs — and what the survivors did differently. |
| [social-and-zktls-signals.md](landscape/social-and-zktls-signals.md) | zkTLS trust models and the aged-account price table that prices every social signal. |
| [eidas2-eudi-wallet.md](landscape/eidas2-eudi-wallet.md) | EU wallet: legal status, relying-party gating, and why it yields no per-human identifier. |
| [iso-mdoc-standards.md](landscape/iso-mdoc-standards.md) | The format layer — mdoc, SD-JWT VC, OpenID4VP, Digital Credentials API. Two doors, opposite answers. |
| [national-zk-identity.md](landscape/national-zk-identity.md) | State identity worldwide, consumability per system, and the ~800m people with no ID at all. |

## References

| File | What it is |
|---|---|
| [ohlhaver-corpus.md](references/ohlhaver-corpus.md) | Puja Ohlhaver's body of work read in full — *Compressed to 0*, *DeSoc*, *Community Currencies* — and its implications for us, stated as an argument against us. |
| [ohlhaver-ethberlin-2024-transcript.md](references/ohlhaver-ethberlin-2024-transcript.md) | Transcript of the ETHBerlin04 keynote (delivered May 2024). **Machine transcription — do not quote verbatim**; the corpus file carries the verified figures. |

## Scripts

| File | What it does |
|---|---|
| [scripts/vouch_sweep.py](scripts/vouch_sweep.py) | Sweeps PoH v2 `VouchRegistered` / `HumanityClaimed` logs on Gnosis. Produced the vouch-graph result in the PoH file. |

---

## Cross-cutting findings

These emerged across multiple files and matter more than any single protocol write-up.

### 1. Roughly 40 protocols collapse to about 6 trust roots

Iris registry, palm registry, ICAO passport chip, national eID, a handful of KYC/liveness vendors,
and web2 account ownership. Confirmed collapses, each traced to a primary source:

- **Sumsub** is the root for Galxe Passport v3, Linea PoH V2, idOS, Solana Attestation Service and
  Chainlink ACE.
- **FaceTec via Synaps** is the root for Anima's Proof of Uniqueness and the Linea/Billions
  "private biometric" proof.
- **Persona** is the root for Coinbase Verifications — and therefore for the Coinbase stamp in
  Human Passport — confirmed from Coinbase's own vendor disclosure.
- **Humanity Protocol's own API** defines `is_human` as "passed a KYC check **OR** palm enrollment",
  so its flagship biometric credential is frequently just a document check.

Consequence: **additive scoring is wrong in the adversary's favour**, because a farm's credentials
are maximally correlated while a real user's are diverse.

### 2. Dedup is often impossible — and does not need to be possible

Four incompatible nullifier derivations sit over one shared preimage (the passport chip). Self and
Rarimo publish *global* unscoped per-document nullifiers on-chain; ZKPassport scopes per service and
never publishes an unscoped value; World hashes a neighbouring field. We frequently cannot detect
that two credentials came from one document.

The resolution, from [prior-art-scoring.md](landscape/prior-art-scoring.md): **correlation is a
property of the credential class, not the user.** We do not need to know that *your* two credentials
share a root — only that those two *protocols* read the same root. That is priceable from an
ontology we maintain, with **zero cross-protocol linkability**, which also avoids becoming the
correlation honeypot. Saturation is minimax-optimal where correlation is unobservable.

### 3. Consuming state credentials is gated shut; issuing is not

Reached independently by two agents, via legal text and wire protocol:

- eIDAS requires an access certificate from a member-state-notified CA, and intermediaries must
  **delete credential data immediately after forwarding** — which alone kills a persistent
  EUDI-derived score.
- Google requires a Google-signed certificate in the `x5c` header; Apple requires an entitlement
  restricted to 12 business categories, none of which fit sybil resistance.
- The Digital Credentials API does not route around this; its protocol registry was hardcoded at
  TPAC in November 2025.

**But there is no gate on being an issuer.** An OpenID4VCI endpoint issuing our aggregate as an
SD-JWT VC is ungated and consumable by any EUDI-profile verifier.

### 4. Credential sale and rental are separate problems, and only sale gets fixed

Every protocol that hardened did so against *sale* — World's `require_user_presence`, Idena's
identity staking. None addresses *rental*, because the human remains willing. Orb-verified accounts
traded from $0.50; human solvers cost $0.50–$2.99 per thousand, essentially unchanged since 2010.
The evidence vector therefore needs **two axes**, `sale_resistance` and `rental_resistance` — a
single "strength" number would systematically overrate the protocols that did the most security work.

### 5. The registration surge tells you what a credential is worth

PoH v2's 2026 growth is a $9.94 PNK airdrop: ~1,299 of 1,364 lifetime claims arrived in four months,
tracking reward claims ~1:1, with `requiredNumberOfVouches() == 1` and `HumanityRevoked` having
fired exactly once ever. Any protocol running a live reward programme should be treated as
compromised for its duration. Re-measure PoH in October 2026 after the pool empties.

### 6. Detectors must state their topology precondition

Transitive-origin collapse exposed a real farm on Circles and produces a **94.4% false positive** on
PoH v2, where the honest topology is already a tree — measured at 5.6% specificity. Where the honest
structure is a tree, the discriminating signals are subtree width at shallow depth, intra-subtree
timespan, and depth-versus-age correlation. See the addendum in
[poh-kleros-brightid-idena.md](protocols/poh-kleros-brightid-idena.md).

### 7. The base rate forbids individual-level exclusion

At 90% TPR and 95% specificity against a 2% residual sybil rate, precision is **26.9%** — 4,900 real
people excluded per 100,000. Reaching 95% precision needs ~99.90% specificity, which nothing
published approaches. Scores may **escalate**; they must not silently **deny**.

### 8. Nobody has made money selling a personhood score

Human Passport: ~2M users, 35M credentials, **under $1M revenue**, sold for ~$10M. OpenRank wound
down in June 2026 and returned capital, its founder saying the thesis was right but never became a
business. Civic discontinued uniqueness and liveness outright in July 2025. Spruce archived its
credential aggregator and now lives on government contracts. Cred prices address scores at **$0.01**
against Persona's $0.80–$1.89 per KYC verification — and the gap is not quality, it is that one
buyer is legally compelled. Reddit, the presumed reference customer, chose **passkeys**.

### 9. The strongest objection is not technical

Ohlhaver's *Community Currencies* §3.3.3 argues global credentials require global enforcement, that
cooperation-versus-collusion is irreducibly context-sensitive, and that a single observer's errors
force ratcheting surveillance which then destroys the social structure enforcement depends on.
Sharper still: *"global sybil resistance makes participants the same and reduces the cost of
influence"* — and an aggregator is a standardisation layer by definition. Her constructive programme
is local and in-person, and has no place for us in it. This should be answered in the design doc,
not cited.

---

## Open questions ranked by how much they would change the plan

1. **Is Sumsub's biometric dedup per-client or cross-client?** If cross-client, every Sumsub-rooted
   credential collapses into one global uniqueness set — simultaneously the strongest and most
   concentrated result in the landscape. Ask Sumsub directly.
2. **Enroll one real identity across N protocols and see which reject the second enrollment.** This
   measures trust-root independence better than any vendor document. Cheap; should be budgeted.
3. **Which KYC vendor backs Humanity Protocol?** Unnamed in their privacy policy. Route: APK grep
   for vendor SDK strings, then a proxied flow, then request their Art. 28 sub-processor list.
4. **Re-measure PoH v2 registrations in October 2026**, after the PNK pool empties. If it reverts to
   ~5/month, none of that cohort was real demand.
5. **Can a non-EU entity register as an EUDI relying party** via a subsidiary? The regulation is
   silent on third countries. If no, the EU door is shut regardless of anything else.
6. **Does UIDAI Circular 4 of 2026 change the signature on offline Aadhaar e-KYC**, or only online
   auth? If the former, every Aadhaar ZK circuit has been broken since 2026-06-30.
7. **Can an Apple Wallet mDL be presented to an arbitrary website via Safari today?** Apple's docs
   and WebKit's shipping status contradict each other. Empirically testable in ~30 minutes.
8. **Does zkTLS still work against a hostile platform?** Nobody publishes success rates. Run 50
   proof attempts against X/Reddit/GitHub via Reclaim and Primus, residential vs datacenter IPs.
9. **A graded correlation measure does not exist.** Ohlhaver calls quantifying it "an open, active
   research question"; COCM is boolean, DeSoc single-round. Real territory to own — and unsolved
   for reasons.
