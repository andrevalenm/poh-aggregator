# From landscape to ontology — what we score, what we refuse to score, and why

*Written 2026-07-25. This file is **synthesis**, not new field research: every protocol fact below
is carried from the deep dives in `research/protocols/` and `research/landscape/`, which were
researched against live sources on 2026-07-24 and are cited per row. The two exceptions are
labelled `CHECKED 2026-07-25` and were probed while writing this.*

Its job is to close the gap the mission names: the pitch says ~40 protocols collapse into a handful
of trust roots, and the deployed ontology described fifteen. It now describes **30 adapters over 18
trust roots**, and this file is the audit trail for every one of them — including the ones we
deliberately refuse to add.

---

## 1. The rule that decides whether a protocol becomes an adapter

A protocol earns an ontology entry when it **issues a per-subject credential we could in principle
look up**. That is a lower bar than "we can read it today" on purpose: an entry with
`implemented: false` still carries a trust root, and a trust root is what stops a credential being
double-counted whether or not we ever probe it. Saturation is a property of the *class*, so the
ontology must describe the class even where the probe does not exist.

Three things therefore do **not** get an entry:

- **Attestation substrate.** EAS, Verax, Privado ID's issuer tooling, Optimism's AttestationStation
  (superseded by EAS —`eas-and-disco.md`). These carry other people's credentials; scoring them
  would be scoring the envelope. They matter to us as *rails* — EAS is our intended output rail —
  and the credentials they carry are ontologised under their real issuers.
- **Aggregators with nothing of their own**, where we can already read the constituents. Silk /
  Human Wallet wraps Holonym; both Holonym credentials are in the ontology under their own roots.
- **Protocols with no credential to consume at all.** Unitap is a gas faucet gated on BrightID, not
  an issuer. Intuition is a publication venue. Karma3 / OpenRank was a graph-reputation protocol and
  is dead (wound down 2026-06-16, capital returned — `reputation-scoring-products.md`); it issued no
  per-subject personhood credential even when alive.

Dead-but-real issuers *do* get an entry, with `live: false`, because a competitor still awarding
points for a credential that no longer issues is a documented failure mode we exist to avoid — that
is why Civic and Sismo are in the file at all.

---

## 2. The roster, and where each protocol landed

`live` is the on-chain kill switch: `live: false` zeroes the credential's contribution outright.
`impl` is whether a probe exists in the SDK today.

### In the ontology

| Adapter | Trust root | live | impl | Source |
|---|---|---|---|---|
| World ID (Orb) | `iris-registry:world-orb` | ✔ | ✔ | `protocols/world-id.md` |
| World ID (document/NFC) | `state-document:icao-9303` | ✔ | — | `protocols/world-id.md` |
| World ID (Selfie Check) | `liveness:world-selfie` | ✔ | — | `landscape/kyc-liveness-vendors.md` |
| ZKPassport | `state-document:icao-9303` | ✔ | — | `protocols/zk-passport-and-eid.md` |
| Self Protocol | `state-document:icao-9303` | ✔ | — | `protocols/zk-passport-and-eid.md` |
| **Rarimo** | `state-document:icao-9303` | ✔ | — | `protocols/zk-passport-and-eid.md` |
| **Anon Aadhaar** | `state-registry:aadhaar` | — | — | `protocols/zk-passport-and-eid.md` |
| Coinbase Verification | `kyc-vendor:persona` | ✔ | ✔ | `protocols/eas-and-disco.md` |
| Galxe Passport v3 | `kyc-vendor:sumsub` | ✔ | — | `landscape/kyc-liveness-vendors.md` |
| Linea Proof of Humanity V2 | `kyc-vendor:sumsub` | ✔ | — | `protocols/privado-id-and-verax.md` |
| Anima Proof of Uniqueness | `kyc-vendor:facetec` | ✔ | — | `landscape/kyc-liveness-vendors.md` |
| **Billions (ex-Privado)** | `kyc-vendor:facetec` | ✔ | — | `protocols/billions-…-intuition.md` |
| **Holonym / Human ID (biometrics)** | `kyc-vendor:facetec` | ✔ | — | `protocols/billions-…-intuition.md` |
| Civic Pass | `kyc-vendor:facetec` | — | — | `landscape/identity-infra-prior-art.md` |
| **Holonym / Human ID (gov-id)** | `kyc-vendor:unattributed` | ✔ | — | `protocols/billions-…-intuition.md` |
| **zkMe MeID** | `kyc-vendor:unattributed` | ✔ | — | `protocols/passport-civic-…-galxe.md` |
| Humanity Protocol | `kyc-vendor:unattributed` | — | — | `protocols/humanity-protocol.md` |
| **Fractal ID** | `kyc-vendor:fractal` | ✔ | — | `landscape/kyc-liveness-vendors.md` |
| Proof of Humanity v2 | `social-vouching:poh` | ✔ | ✔ | `protocols/poh-kleros-brightid-idena.md` |
| **Proof of Humanity v1** | `social-vouching:poh` | ✔ | — | `protocols/poh-kleros-brightid-idena.md` |
| BrightID | `social-vouching:brightid` | — | — | `protocols/poh-kleros-brightid-idena.md` |
| Circles v2 | `social-trust:circles` | ✔ | ✔ | `protocols/circles.md` |
| **Farcaster account** | `social-account:farcaster` | ✔ | — | `landscape/social-and-zktls-signals.md` |
| Idena | `ceremony:idena` | — | — | `protocols/poh-kleros-brightid-idena.md` |
| **Encointer** | `ceremony:encointer` | — | — | `landscape/poh-landscape-sweep.md` |
| **Humanode** | `biometric-registry:humanode` | ✔ | — | `landscape/poh-landscape-sweep.md` |
| **Human Passport** | `behavioral:wallet-history` | ✔ | ✔ | `protocols/passport-civic-…-galxe.md` (costs, and the `sourceURI`); `protocols/human-passport-onchain-read.md` (the read) |
| **Nomis** | `behavioral:wallet-history` | ✔ | — | `landscape/reputation-scoring-products.md` |
| **Trusta.AI** | `behavioral:wallet-history` | ✔ | — | `landscape/reputation-scoring-products.md` |
| **Sismo** | `aggregate:republished` | — | — | `protocols/billions-…-intuition.md` |

Bold rows are new in this revision.

### Considered and deliberately excluded

| Protocol | Why not an adapter |
|---|---|
| EAS, Verax, Privado ID, AttestationStation | Substrate. They transport credentials; the credentials are ontologised under their issuers. AttestationStation is additionally superseded by EAS. |
| Disco.xyz | Dead, and the domain is now hostile (`eas-and-disco.md`). Nothing to consume, no credential of its own. |
| Silk / Human Wallet | A wallet wrapping Holonym; both Holonym credentials are already entries. Adding it would count Holonym twice under a name that hides it. |
| Unitap | A gas faucet gated on BrightID. Consumes a credential, issues none. |
| Karma3 Labs / OpenRank | Wound down 2026-06-16, capital returned. Graph reputation, never a personhood credential. |
| Gitcoin GTC self-staking | Not a protocol — a *stamp inside* Human Passport (`SelfStakingBronze/Silver/Gold`, weights 0.897/2.066/2.7). Counted, at the right price, inside the Human Passport entry. |
| Discord / GitHub / X attestations | Same: stamps inside Human Passport, priced by the aged-account market at cents (`social-and-zktls-signals.md` §B.8). An entry each would multiply one purchase into many roots. |
| Kleros | The court *under* Proof of Humanity, not a credential. Its health — PNK market cap, revocation count — is a modifier on PoH's weight, tracked in the PoH write-up. |
| Reddit / Discord / Telegram age verification | Consumer deployments of other vendors' KYC. No third-party read exists, and none is planned. |
| eIDAS 2 / EUDI wallet | Consuming it is gated shut by law: an access certificate from a notified CA, plus a delete-after-forwarding obligation that forbids a persistent score (`eidas2-eudi-wallet.md`). |

### Research debt — named in the mission, not yet defensible

- **Quadrata.** `quadrata.com` and `docs.quadrata.com` both answer 200 (`CHECKED 2026-07-25`), so it
  is not dead, but no deep dive exists and its docs are client-rendered, so nothing about its trust
  root or on-chain surface is established here. It is *not* in the ontology, because an entry with
  an invented root is worse than an absent one.
- **Talent Protocol.** `docs.talentprotocol.com` now redirects to `docs.talent.app`, which answers
  200; the apex returned 429 to our client (`CHECKED 2026-07-25`). Builder Score is plausibly a
  wallet-history scorer that would share `behavioral:wallet-history`, but "plausibly" is not a root.
- **Binance BABT.** Weighted 16.021 in Human Passport — equal to a government ID — and an
  ERC-721-shaped read on BNB Chain, so it is probably the highest-value missing entry. Needs a
  vendor attribution (Binance's own KYC stack? an IDV vendor?) before it can be rooted.
- All three are ordinary next-pass research, not blockers.

---

## 3. Why the roots collapse where they do

30 adapters, 18 roots, and the six largest roots carry 18 of the 30:

| Root | Adapters | What one adversary purchase buys |
|---|---|---|
| `state-document:icao-9303` | 4 | One passport chip → World's document tier, ZKPassport, Self, Rarimo. Four "independent" proofs, one trip to a passport office. |
| `kyc-vendor:facetec` | 4 | One technique that defeats FaceTec liveness → Anima, Billions, Holonym biometrics, Civic. |
| `kyc-vendor:unattributed` | 3 | Deliberately merged; see below. |
| `behavioral:wallet-history` | 3 | One farmed wallet → Human Passport, Nomis, Trusta. |
| `kyc-vendor:sumsub` | 2 | One Sumsub check → Galxe Passport, Linea PoH V2. |
| `social-vouching:poh` | 2 | One vouched registration → PoH v1 and v2. |

Two root decisions are judgement calls and are recorded as such:

**`kyc-vendor:facetec` was widened from `kyc-vendor:facetec-synaps`.** FaceTec's 1:N gallery is
per-integrator, so Anima's population and Holonym's are genuinely separate *databases* — but a
presentation or injection attack that defeats FaceTec defeats every deployment of it, and the root
exists to price the adversary's cheapest path, not to describe database boundaries. Widening
saturates four credentials that were previously three roots. That direction — more correlation —
costs an honest subject at most one root's worth and denies the adversary a multiplier, which is
the asymmetry the whole scoring model is built on (`landscape/kyc-liveness-vendors.md`,
trust-root dedup table; `landscape/prior-art-scoring.md` on minimax saturation).

**`kyc-vendor:unattributed` is one root, not three.** Humanity Protocol's vendor is undisclosed;
Holonym's `gov-id` is issued by one of Onfido, Sumsub, iDenfy or Veriff and the credential does not
say which; zkMe does not name its document vendor. We cannot prove these are different vendors, and
if two of them are the same vendor then separate roots would let one check score as two. Merging is
the error we can afford.

Consequence worth stating plainly: Holonym `gov-id` might in fact be a *Sumsub* check, in which
case it should saturate against Galxe Passport and does not. That residual is documented rather
than hidden, and it closes the moment any of the three publishes its vendor.

---

## 4. Where every cost figure comes from

Costs are in cents and scoring takes `min(forge, rent)`, so **the rent column is what binds** almost
everywhere. Anchors, all from `landscape/sybil-incidents-antipatterns.md` §6 (the sale-vs-rental
table) unless noted:

| Class | Anchor | Applied to |
|---|---|---|
| Biometric uniqueness, no presence check | **$0.50** escrow resale, 2026-04 | World ID Orb (rent 50) |
| Cognitive ceremony + staking | **$2–$4** per ceremony (Idena, the definitive rental case) | Idena, Encointer (rent 400) |
| Face-liveness vendor credential | rental of a willing subject, ≈ ceremony rate scaled for session length; forging priced at the $50 class ceiling | Anima, Billions, Holonym biometrics (5000 / 1000) |
| Remote document + selfie KYC | **<$20** for a KYC-passing synthetic face (WEF, Jan 2026); vendor charges $0.80–$1.89 per verification | all `kyc-vendor:*` entries (120000 / 3000) |
| State document / ZK-passport | strongest class; sale is illegal and traceable, rental requires the document holder in the loop | ICAO entries (150000 / 2000) |
| Social vouching | not directly observed; genuine humans vouch, then hand over keys | PoH v1/v2 (1000 / 500) |
| On-chain behavioural history | **$1–$20** per farmed wallet (`UNVERIFIED` in source, and carried as such) | Human Passport, Nomis, Trusta (2000 / 100) |
| Web2 / social account | cents to low dollars; aged accounts cost more (2016 X account $1.83 vs 2025 $0.185) | Farcaster (rent 20, from `StorageRegistry.usdUnitPrice()` = $0.20/unit/yr; forge 12000 from `TierRegistry.tierInfo(1)` = $120/yr Pro — both published on-chain reads, `social-and-zktls-signals.md`) |

**The one figure I do not believe.** The KYC class is priced at a $1,200 forge cost while our own
research says a KYC-passing synthetic face costs under $20. Nothing turns on it today — `min()`
takes the $30 rental figure — but the forge column is wrong by ~60× and would matter the moment a
KYC credential's rental cost rose. Flagged in `MORNING.md` rather than silently rewritten, because
resetting it is a scoring change that should be a human decision.

---

## 5. Three defects found in the existing ontology, and fixed

1. **Civic Pass sat on `kyc-vendor:persona`.** Its vendor is FaceTec, integrated directly — the
   dedup table lists Civic on the "FaceTec (direct)" row and Persona's row names Coinbase, not
   Civic. Corrected to `kyc-vendor:facetec`.
2. **BrightID sat on `social-vouching:poh`.** BrightID's verification parties and PoH's vouching
   registry have no vendor under either and no members in common; the source explicitly lists them
   as "safe to count independently". Sharing a root would have saturated two independent graphs
   against each other. Corrected to `social-vouching:brightid`.
3. **Humanity Protocol sat on `unknown`.** `unknown` is not a root — it scores as full independence,
   which is the direction that pays an adversary. Resolved to `kyc-vendor:unattributed`, and marked
   `live: false`: mainnet has been offline since the 2026-06 key compromise, the verification oracle
   has processed 28 verifications in its entire life and none since 2026-02, and every read needs an
   OAuth client and a per-verification fee.

Neither of the first two changed anyone's score, because both adapters are `live: false` and
therefore contribute zero — which is exactly why they survived this long. `ontology.test.ts` now
asserts all three properties, so the next one gets caught before it ships.

---

## 6. The permissionless-read queue — what to probe next, ranked

The product principle is at the top of `packages/sdk/src/adapters/index.ts`: no API key on the
critical path, nothing that can rate-limit or revoke us. Ranked by (coverage gained) × (how clean
the read is):

1. ~~**Human Passport**~~ — **DONE 2026-07-25.** Implemented across all seven deployments, but not
   as `Decoder.getScore`: that call is revert-driven and discards the issuance date, so the probe
   reads `GitcoinResolver.getCachedScore` (the same struct the Decoder consults) and gets score,
   issuance and expiry in one hop. Write-up, addresses, expiry derivation and the stamp→root map:
   `protocols/human-passport-onchain-read.md`. Two findings that changed the ontology entry: a
   passport **hard-expires at 90 days** (`maxScoreAge` on every chain), and its stamps are largely
   credentials we already price, so the probe now names the roots it restates.
2. ~~**Farcaster**~~ — **DONE 2026-07-25.** `IdRegistry.idOf` on OP Mainnet is one call, but the
   boolean is worth nothing on its own: the registry tripled inside a nine-month subsidy window,
   so on a Ramp the *date* is the entire signal — and the registry stores no dates. It turns out
   not to need to. `idCounter()` is monotone and `register()` increments it in the same
   transaction that writes custody, so the first block where `idCounter() >= fid` is the block the
   fid was created in, found by searching archive state and verified against the log index. Two
   findings that changed the answer: fids ≤ 193,791 were imported from the predecessor registry by
   an admin `SetIdCounter(0, 193791)` and are older than their date, and fids are *transferable*,
   so what gets dated is this address's custody rather than the fid. Write-up, addresses,
   endpoint table: `protocols/farcaster-onchain-read.md`. Farcaster Pro — the one signal with a
   real price — is **not** readable: `TierRegistry` keeps no per-fid state and its logs need a key.
3. ~~**Holonym / Human ID**~~ — **DONE 2026-07-25**, and the condition on it turned out to be
   false. The action-id is only mandatory on the *vendor's REST endpoint*; `Hub.getSBT(address,
   circuitId)` is keyed on holder and circuit and returns the action-id inside the proof, so we
   report the namespace the credential was minted for instead of choosing one. Two ontology
   entries implemented off one contract, `0x2AA822e2…4DfB` on OP Mainnet. Three findings that
   shaped the adapter: the Hub's own source warns that an SBT is forgeable unless
   `publicValues[4]` is checked against Holonym's issuer key, because anyone can run an issuer;
   the Hub burns the nullifier it is *handed* rather than the one the circuit derived, so
   uniqueness has to be confirmed with a third call; and `V3.circom` constrains
   `expiry - iat < 31,536,001`, which makes *expiry minus one year* a proven lower bound on
   issuance and therefore an honest date on a decay curve — the protocol deliberately fuzzes the
   expiry to hide when the holder was verified, so a bound is the only sound reading. Write-up:
   `protocols/holonym-human-id-onchain-read.md`. The legacy v2 store is **not** read and the file
   says why. 238,706 SBTs minted, measured by bisecting `ownerOf`.
4. **Linea Proof of Humanity V2** — Verax attestations on Linea, portal `0xe8a3…3922`, attester
   `0xc5db…1c0d`. Passive per-subject read, and it retires nothing we depend on.
5. **World document / Selfie tiers** — already partly reachable through AgentBook; the mission's P1
   asks for these so World appears in the *score*, not only in the agent gate.
6. **Proof of Humanity v1** — a second `isRegistered` call on a registry we already talk to. Cheap,
   and it exercises saturation against v2 with real data.

Explicitly **not** passively readable, and the reason in each case:

- **ZKPassport, Self, Galxe Passport** — verification consumes a proof the *subject* must generate.
  There is no "is this address verified" view; that is the privacy design working as intended.
- **zkMe** — `hasApproved(dappAccount, user)` is scoped to a registered dapp account.
- **Fractal ID, Trusta, Nomis** — vendor API or user-minted product, no open per-address view.
- **Encointer, Humanode** — no EVM surface; Substrate accounts and validator identities respectively.
- **Humanity Protocol** — OAuth client plus a per-verification fee, on a chain that is offline.

---

## 7. Open questions this file could not close

1. **Is Sumsub's face-search dedup cross-client?** Unchanged from `kyc-liveness-vendors.md` and still
   the highest-leverage unknown in the landscape: if it is, every Sumsub-rooted credential collapses
   into one global uniqueness set.
2. **Are Anima's and Holonym's FaceTec galleries genuinely separate populations?** We have merged the
   root regardless, so the answer would refine the *description*, not the arithmetic — but it would
   tell us whether any FaceTec credential yields uniqueness rather than liveness.
3. **Which vendor sits under Humanity Protocol and zkMe?** Resolving either splits
   `kyc-vendor:unattributed` and is the only way that root shrinks.
4. **Quadrata, Talent Protocol, Binance BABT** — see §2, research debt. BABT rose in priority on
   2026-07-25: it is a *stamp inside a score we now read*, so a live passport can be one third BABT
   with that third unattributable. See `protocols/human-passport-onchain-read.md` §5.
5. **The $1,200 KYC forge figure** — see §4.
