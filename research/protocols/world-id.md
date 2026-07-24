# World ID / World (formerly Worldcoin)

*Researched 2026-07-24. All volatile facts date-stamped inline.*

**One-liner:** Iris-biometric proof-of-personhood issued by physical "Orb" devices, presented as a
zero-knowledge proof from a self-custodial mobile authenticator; plus weaker NFC-document and
selfie-liveness credentials under the same umbrella.
**Category:** uniqueness (Orb PoH) / state-identity (NFC credential) / liveness (Selfie Check) — three
very different things sold under one brand.
**Chains:** World Chain (OP Stack L2, primary), Ethereum, Optimism, Base, Polygon (v3 legacy bridged roots).
World ID 4.0 on-chain verification exists **only on World Chain** as of 2026-07.
**Status (2026-07):** **Live and well funded**, mid-migration. World ID 4.0 announced 2026-04-17; v3 proofs
phased out on a timeline running to April 2027. $52.5M raise led by Pantera announced 2026-07-24.
`orb-software` repo actively developed. Not dead, not pivoted away from personhood — pivoted *toward*
enterprise and AI-agent use cases.

**Aggregator verdict: INTEGRATE NOW, as the highest-weight single credential — but with three hard
caveats.** (1) Always request `require_user_presence: true`; without it a World ID proof is defeated by a
~$5 account purchase on an open black market, which is a live 2026 problem, not a historical one.
(2) Uniqueness is a **trusted-issuer claim** wrapped in ZK — World can mint credentials at will — so it
must never be the sole basis of a maximum score. (3) It is legally unavailable in ~10 large jurisdictions
including Brazil, Kenya, Indonesia, the Philippines and Spain, so our router must degrade gracefully by
geography. Integrating requires registering an `rp_id` with World, which is a revocable vendor dependency;
the only World-independent read paths are the on-chain `WorldIDVerifier` and the `AgentBook` registry.

---

## What it proves

World ID is not one credential. As of the World ID 4.0 docs there are three *credentials*, each with
its own issuer, schema ID, sybil-resistance property and validity window. Treat them as separate
evidence classes; do not collapse them into "World ID verified".

| Credential | Schema ID | Issuer | Status | Sybil resistant? | Validity |
|---|---|---|---|---|---|
| **Proof of Human (PoH)** — Orb iris | `1` | World Foundation | active | Yes — "each human can only have one PoH credential" | 3 years, renewable |
| **NFC Credential** — passport / eID / JP My Number Card | `9303` | Tools for Humanity | active | Yes, *per document* — "each document can only be used with one World ID" | document expiry, max 10 years |
| **Selfie Check** (beta) — device-camera selfie | `11` | Tools for Humanity | beta | "Some" — docs explicitly say facial similarity is "not as strong as Orb or NFC" | 90 days |

Sources: <https://docs.world.org/world-id/credentials/1>, <https://docs.world.org/world-id/credentials/9303>,
<https://docs.world.org/world-id/credentials/11> (fetched 2026-07-24).

### Proof of Human (Orb)
- Captured at an Orb, a purpose-built device that images both irises. The credential is "an anonymous
  proof that the user is a unique, live human."
- Structure: attributes `genesis_issued_at` (timestamp of the user's *first* PoH credential — constant
  across renewals), `expires_at` (now + 3 years on each issuance), and `associated_data_hash =
  FieldElement::ZERO` (PoH carries no associated data).
- Claim 0 is an "Orb Credential Commitment": binds the PoH credential to the underlying Orb credential
  (`H(hashes.json)` — the hash signed by the Orb during enrollment) so the PoH Issuer can attest the
  credential came from a valid Orb capture without revealing the Orb credential to the RP.
- **Renewal:** users renew "as long as the Orb capture is deemed fresh by the issuer." So the strength
  of an old PoH depends on issuer-side freshness policy that is not publicly specified. `UNCLEAR:` what
  "fresh" means operationally — how long an Orb capture stays renewable without re-visiting an Orb.
- `genesis_issued_at` is *aggregator-relevant*: it is a monotone account-age signal that survives
  renewal, and RPs can constrain on it (`genesis_issued_at_min` / `credentialGenesisIssuedAtMin`),
  which is a built-in anti-farm knob (require the credential to be at least N months old).

**What it actually proves:** uniqueness within the set of people who have visited an Orb, conditional on
(a) the iris-uniqueness matching being sound, (b) the Orb hardware attestation not being forged, and
(c) the person who enrolled still controlling the authenticator. (c) is the weak link — see failure modes.

### NFC Credential (9303)
- ICAO-9303 passports and eIDs, plus Japanese My Number Card (different enrollment path, same credential).
- Claim 0 — **Authentication Claim**, which is the single most useful field for an aggregator because it
  tells you how strong the document check actually was:

| Value | Claim | What it proves |
|---|---|---|
| `1` | None | Passive Authentication only — document signature verified. **No guarantee the chip isn't a clone.** |
| `2` | Chip Authentication | CA per ICAO 9303 — chip is genuine, not cloned. |
| `3` | Active Authentication | AA per ICAO 9303 — chip holds a private key. |
| `4` | MNC Authentication | Japanese My Number Card SD-JWT flow. |

  Docs: "The strongest authentication available is always selected", and availability varies per country.
- Claim 1 — **SOD Signature**: blake3 hash of `SignedData.SignerInfos[0].Signature` from `EF.SOD`, reduced
  to a field element. Not set for My Number Cards.
- No renewal: one document → one enrollment, ever. New passport = new credential.
- **What it proves:** state-identity + per-document uniqueness. It does *not* prove one-human-one-credential
  — a person with two valid passports (dual nationals; ~tens of millions of people) can hold two NFC
  credentials. World's own docs frame it as "document-level Sybil resistance without requiring a proof of a
  unique human."

### Selfie Check (11, beta)
- Device-camera selfie → liveness + a "Sybil score", "a similarity signal that flags whether the user has
  created an abnormal number of accounts on your platform."
- 90-day validity. Sybil resistance rated "some" by World itself.
- **What it proves:** liveness/not-a-bot, plus a *per-RP* facial-dedup heuristic. This is roughly the same
  evidence class as a vendor liveness SDK (Persona/Onfido/iProov), not personhood.

### Note: "Device verification" is gone
The old World ID 2.0 "Device" level (mobile-device attestation, no biometrics) does **not** appear as a
credential in the World ID 4.0 credential registry. It has been functionally superseded by Selfie Check.
`UNVERIFIED:` whether legacy Device-verified World IDs still resolve as anything in the v4 stack, or
whether existing v3 `verification_level: "device"` proofs continue to validate through the legacy endpoint
until the v3 sunset. Next place to look: `docs.world.org/api-reference/developer-portal/verify-legacy` and
the v3→v4 migration timeline.

## Trust root & failure modes

### The chain of trust (Orb / PoH)
1. **Orb hardware**: a purpose-built device with a **dedicated secure element** — "a dedicated security
   hardened chip that provides a hardware root of trust and… signing functionality", cryptographically
   paired with the Nvidia Jetson compute module **at manufacturing time**
   (<https://world.org/blog/engineering/worldcoin-foundation-open-sources-core-components-orb-software>).
2. **`orb-attest`** talks to the secure element to produce an attestation token for World's signup backend
   (<https://github.com/worldcoin/orb-software>, dual MIT / Apache-2.0-with-LLVM-exceptions, actively
   developed — ~1,514 commits on main, 23 open PRs as of 2026-07-24).
3. **Signup backend / uniqueness service**: receives signed iris codes, split into 3 shares
   (`iris_code_shares_0/1/2` in the Personal Custody Package — see
   <https://docs.world.org/world-id/reference/poh-issuer>), and runs the dedup in MPC.
4. **PoH Issuer** signs a `Credential` (Rust type `world_id_primitives::credential::Credential`) with an
   issuer key registered in the `CredentialSchemaIssuerRegistry`.
5. **User authenticator** (World App / the new World ID app) holds the credential and generates ZK proofs.
6. **`WorldIDVerifier`** on World Chain, or the Developer Portal `/api/v4/verify`, checks the proof.

**Who can forge it:** World itself, at steps 3–4, trivially and undetectably. The issuer key is the root of
authority; the ZK layer proves "an issuer registered for this schema signed a credential", not "a real iris
was unique". A compromised or coerced World Foundation / Tools for Humanity could mint unlimited valid PoH
credentials and no verifier — on-chain or off — could tell. **World ID's uniqueness is a centralised claim
with a decentralised presentation layer.** This is the single most important thing to internalise for
scoring: it is the best-executed personhood credential in the market and it is still a trusted-issuer
system.

Secondary forgery surface: the Orb secure-element pairing. World's own tech-tree acknowledges that
*"anyone should be able to perform these attestations"* is aspirational — reproducible builds and public
secure-version reporting were described as "engineering projects underway" in the 2024 open-sourcing post.
`UNVERIFIED:` whether independent third-party Orb attestation verification is actually possible in 2026.
Next place to look: `worldcoin/orb-software` `orb-attest` README and any public attestation transparency log.

### Orb operator model
Orbs are run by **World Operators** — independent individuals and businesses who earn WLD for each
verification they facilitate, plus a **Community Operator** program letting people buy or rent an Orb
(<https://world.org/blog/world/what-is-worldcoin-operator>, <https://world.org/community-operator>).
The PoH issuer's PCP explicitly carries `operator_id`, `orb_id`, `orb_country`, `signup_reason` and
`software_version` (each with a salt) — so World *can* attribute a credential to an operator and revoke by
operator, but **none of these fields are exposed to a relying party**. We cannot ask "was this credential
minted by an operator later found fraudulent?"

The operator model is a **direct financial incentive to maximise signups**, which is the classic setup for
farm-style abuse: operators paid per head, in low-income markets, verifying people who are paid to show up.
This is exactly the dynamic regulators objected to.

### Documented attacks and incidents
- **Credential black market (2023, original).** Buyers in China purchased World ID credentials from people
  in Cambodia, Kenya and elsewhere for ~$30. World's own framing at the time was that what was sold was the
  *verified World ID transferred into a third-party World App*, not the raw iris scan.
  Secondary: <https://www.coindesk.com/policy/2023/05/24/black-market-for-worldcoin-credentials-pops-up-in-china>,
  <https://www.biometricupdate.com/202305/worldcoin-may-have-a-biometric-data-black-market-problem>
- **Credential black market (2026, still live).** On **2026-04-28** ZachXBT publicly alleged that
  World "has instead produced a black market for verified accounts", posting screenshots of verified
  accounts being sold on escrow platforms **for as little as $0.50, and commonly $5–$15**, alongside claims
  of insider OTC selling and unsustainable token supply.
  Secondary: <https://ambcrypto.com/prey-on-users-zachxbts-worldcoin-criticism-puts-wld-under-pressure/>,
  <https://finbold.com/zachxbt-slams-sam-altmans-worldcoin-over-exploiting-users-for-biometric-data/>
  **This is the most damaging fact for scoring purposes.** A ~$5 acquisition cost for an Orb-verified
  credential means the *sybil-resistance* property is economically defeated for any attacker whose per-
  identity payoff exceeds ~$15. Note this is **not a break of the cryptography** — the humans are real and
  unique; they sold their credential. Uniqueness is preserved, *control* is not.
  **The mitigation is `require_user_presence: true`**, which forces a live face match against the Orb
  enrollment image at proof time and makes a sold credential unusable without the original human sitting
  there. We must use it.
- **Iris spoofing (generic, academic).** Printed high-resolution iris patterns on contact lenses defeat
  commercial iris systems lacking liveness detection. The Orb has dedicated presentation-attack detection
  and this is not a demonstrated Orb break — treat as an open risk, not an incident. `UNVERIFIED:` any
  published third-party red-team of the Orb's PAD.
- **China national-security warning (2025-08).** China's security ministry publicly flagged
  Worldcoin-style iris collection as a national security threat.
  Secondary: <https://www.coindesk.com/policy/2025/08/06/china-warns-worldcoin-style-iris-scanning-a-national-security-threat>
- **Proprietary hardware / backdoor risk.** Orb hardware remains proprietary even though the software is
  open source; the risk that operators or the manufacturer could manufacture fake identities is
  structurally unresolved.

### Regulatory status by country (as of 2026-07-24)
The single biggest practical failure mode for an aggregator is **coverage gaps caused by regulators**, not
cryptography. Compiled from Rest of World (2026-04-27) plus follow-ups; all secondary sources.

| Country | Status | Detail |
|---|---|---|
| **Kenya** | **Banned/illegal** | Suspended Aug 2023; probe dropped Jun 2024 and ops resumed; then the **High Court declared operations illegal in May 2025** and ordered deletion of Kenyans' biometric data, which World complied with. |
| **Brazil** | **Banned** | ANPD ban Jan 2025 over paying for biometrics; **appeal denied**, ban reaffirmed Mar 2025 with daily fines (R$50,000 ≈ $8,800/day). |
| **Indonesia** | **Suspended** | Permits pulled / data collection suspended May 2025; probe into two local entities. |
| **Philippines** | **Halted** | NPC cease-and-desist Oct 2025 over consent and "exploitation of vulnerable populations"; World contesting. |
| **Thailand** | **Shut down** | Biometric collection halted, data deletion mandated Nov 2025. |
| **Spain** | **Halted** | AEPD precautionary GDPR block 2024-03-06; relaunch postponed indefinitely. |
| **Portugal** | **Banned** | CNPD prohibited data collection Mar 2024 (minors, consent, age verification failures). |
| **Germany** | **Iris scanning paused** | BayLDA (Bavaria) ordered deletion of non-compliant iris data Dec 2024; World paused Orb operations Jul 2025 citing "station upgrades". World App still operates. |
| **Hong Kong** | **Ceased** | Ordered to halt May 2024. |
| **France** | **Withdrawn** | Dropped off the official country list Dec 2023. |
| **India** | **Halted** | Sign-ups discontinued ~Apr 2023. |
| **Argentina** | **Operating, restricted** | Buenos Aires flagged "abusive clauses" Apr 2024; signups continue. |
| **USA** | **Operating** | Orb Mini launched 2025-05-01. |

Sources: <https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/> (2026-04-27),
<https://iclg.com/news/22583-kenyan-high-court-delivers-landmark-biometric-data-ruling/>,
<https://decrypt.co/305639/brazilian-regulator-denies-worldcoin-appeal-ban>,
<https://idtechwire.com/worldcoin-pauses-iris-scanning-in-germany-amid-station-upgrades-and-regulatory-review/>,
<https://bitpinas.com/regulation/worldcoin-cease-desist/>.
`UNCLEAR:` whether any of these were lifted between 2026-04 and 2026-07 — no evidence found either way in
this pass, and I did not find a source dated after 2026-04-27 for any individual country. **Treat the table
as "no known change since April 2026" rather than confirmed-current.**

**Aggregator consequence:** World ID is unobtainable or legally fraught for users in Brazil, Kenya,
Indonesia, the Philippines, Thailand, Spain, Portugal, Hong Kong, India, and (for new Orb signups) Germany
and France — a population well north of 2 billion people. Our routing layer must be able to fall back to
other protocols by jurisdiction, and we should not surface "verify with World ID" as a primary CTA in those
markets. There is also **reputational contagion risk**: several regulators framed World's model as
exploitative, and being seen to launder that credential is a real product risk.

### AI agents changed the semantics — read this carefully
World now explicitly supports **delegating a World ID to an AI agent** via AgentKit (launched 2026-03-17,
<https://world.org/blog/announcements/now-available-agentkit-proof-of-human-for-the-agentic-web>,
<https://techcrunch.com/2026/03/17/world-launches-tool-to-verify-humans-behind-ai-shopping-agents/>).

The claim an AgentKit-backed request makes is **"a unique verified human stands behind this agent"**, which
is strictly weaker than "a unique verified human is doing this right now". World also markets deepfake
resistance for video calls and a Vercel Workflow SDK "human in the loop" step.

For us this means: **"World ID verified" is no longer synonymous with "a human performed this action."**
An aggregator that markets a humanity assertion must decide and disclose which it means. Concretely:
- `require_user_presence: true` → a live human, face-matched to enrollment, at proof time.
- Plain PoH proof → someone holding the authenticator; could be the human, a buyer of the account, or an
  agent the human delegated to.
- AgentBook `lookupHuman` hit → explicitly an agent, human-backed at *registration* time only.
These are three different assertions and our normalized score should not collapse them.

## On-chain surface

### World ID 4.0 (current) — World Chain only
`WorldIDVerifier`, an upgradeable proxy on World Chain, exposes a `view` function:

```solidity
function verify(
    uint256 nullifier,
    uint256 action,
    uint64  rpId,
    uint256 nonce,
    uint256 signalHash,
    uint64  expiresAtMin,
    uint64  issuerSchemaId,
    uint256 credentialGenesisIssuedAtMin,
    uint256[5] calldata zeroKnowledgeProof
) external view;
```

| Environment | Chain | `WorldIDVerifier` proxy |
|---|---|---|
| Production | World Chain | `0x00000000009E00F9FE82CfeeBB4556686da094d7` |
| Staging | World Chain | `0x703a6316c975DEabF30b637c155edD53e24657DB` |

Source: <https://docs.world.org/world-id/idkit/onchain-verification> (fetched 2026-07-24).
**Both addresses confirmed on-chain by this agent, 2026-07-24** (`eth_getCode` non-empty on World Chain
mainnet). Production address is an **ERC1967 proxy** (verified on the World Chain explorer); its EIP-1967
implementation slot currently points to `0xFF93A0146bF6E7557B63315EFecE083ca07d4C73`.
Implication: **World can swap the verification logic under us at any time**. If we verify on-chain we
should pin and monitor the implementation slot
(`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) and alert on change.

Key observations for us:
- `issuerSchemaId` is an argument → the *same* verifier handles PoH (1), NFC (9303), Selfie (11). An
  aggregator reading a proof must check which schema was actually proven. A contract that hardcodes the
  wrong schema id silently accepts a weaker credential.
- `rpId` is an argument and it is the numeric form of the RP's registered `rp_` identifier. Proofs are
  **bound to a relying party at proof-generation time**. This is the crux of the "can we verify without
  World's cooperation" question — see Integration surface.
- `expiresAtMin` and `credentialGenesisIssuedAtMin` let a verifier demand credential freshness / minimum
  age on-chain. Useful anti-farm knobs for scoring.
- Proof is `uint256[5]` (v4) vs `uint256[8]` (v3 Semaphore/Groth16).

### ⭐ AgentBook — a permissionless, globally-scoped human identifier on World Chain
**This is the most important on-chain finding of this research pass and it is not advertised as such.**

`AgentBook` — World Chain mainnet `0xA23aB2712eA7BBa896930544C7d6636a96b944dA`
(canonical deployment per <https://docs.world.org/agents/agent-kit/sdk-reference>).
**Verified 2026-07-24 by this agent** against `https://worldchain-mainnet.g.alchemy.com/public`
(`eth_getCode` returns 7140 bytes) and the World Chain Blockscout API, which reports it as a
**verified, non-proxy contract named `AgentBook`** with this ABI:

```
view       lookupHuman(address)  -> uint256      // <- the interesting one
view       getNextNonce(address) -> uint256
view       groupId()             -> uint256
view       worldIdRouter()       -> address
nonpayable register(address, uint256, uint256, uint256, uint256[8])
nonpayable setGroupId(uint256) / setWorldIdRouter(address) / Ownable2Step fns
```

Live state read by this agent, 2026-07-24:
- `groupId()` = **`1`** → **AgentBook registration requires an Orb (PoH) World ID.** Not device, not NFC.
- `worldIdRouter()` = **`0x17B354dD2595411ff79041f930e491A4Df39A278`** → independently confirms the
  documented World Chain `WorldIDRouter` address.
- `owner()` = `0xe340b00B6B622c136FfA5cFf130Ec8EdcDDCB39d`. Owner can `setGroupId` and `setWorldIdRouter`
  — i.e. **World can unilaterally change which credential tier AgentBook trusts**. Centralisation risk.
- `register(...)` takes a `uint256[8]` → it consumes a **legacy World ID 3.0 Semaphore/Groth16 proof**,
  not a v4 proof. So AgentBook is currently pinned to the v3 stack that is scheduled to sunset by
  April 2027. `UNCLEAR:` migration plan.
- Probe results: `lookupHuman(0xdead…beef)` and `lookupHuman(0x1111…)` → `0` (unregistered);
  `lookupHuman(0x0)` → `0x2e969183…7c72`; `lookupHuman(0xe340…b39d)` → `0x01b695ae…00f5`. So it is a real
  registry returning `0` for unknown addresses and a distinct nonzero id per registered human.

**Why this matters to us — two ways:**

1. **We can check "is this wallet backed by an Orb-verified human?" with zero World cooperation.**
   One `eth_call` to a public World Chain RPC. No `rp_id`, no signing key, no API key, no rate limit,
   no ToS. This is the only World ID read path that is genuinely permissionless *and* gives a positive
   assertion about a specific address. It only covers wallets that opted into AgentKit registration, so
   coverage is currently tiny — but for those wallets it is free, instant, and un-deplatformable.
2. **It is a global nullifier in all but name, published on a public blockchain.** The returned
   `uint256` is stable per human (it is the World ID nullifier for AgentBook's own app/action, since
   `register` verifies a v3 proof against the router). Anyone can iterate registered wallets and
   **cluster multiple wallets belonging to the same human**. This directly cuts against World's stated
   "nullifiers are unlinkable across apps" privacy model — for anyone who registers an agent, it is not.
   Flag this to whoever writes our privacy analysis. `UNVERIFIED:` whether World publishes this caveat
   anywhere in the AgentKit docs (it does not appear in the pages fetched).

Read it with any World Chain RPC:
```bash
curl -s -X POST https://worldchain-mainnet.g.alchemy.com/public \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{
        "to":"0xA23aB2712eA7BBa896930544C7d6636a96b944dA",
        "data":"0x451a02f4000000000000000000000000<WALLET_NO_0x>"},"latest"]}'
# selector 0x451a02f4 = lookupHuman(address); returns 0x00..00 if not registered
```

### World ID 3.0 (legacy) — Semaphore, multi-chain
`WorldIDRouter.verifyProof(root, groupId, signalHash, nullifierHash, externalNullifierHash, uint256[8] proof)`.
`groupId` must be `1` — **only Orb credentials were ever supported on-chain in v3**; device-level proofs
were cloud-API only.

| Chain | `WorldIDRouter` mainnet | Testnet |
|---|---|---|
| World Chain | `0x17B354dD2595411ff79041f930e491A4Df39A278` | `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` (Sepolia) |
| Ethereum | `id.worldcoin.eth` = `0x163b09b4fE21177c455D850BD815B6D583732432` | `0x469449f251692E0779667583026b5A1E99512157` |
| Base | `0xBCC7e5910178AFFEEeBA573ba6903E9869594163` | `0x42FF98C4E85212a5D31358ACbFe76a621b50fC02` |
| Optimism | `optimism.id.worldcoin.eth` = `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` | `0x11cA3127182f7583EfC416a8771BD4d11Fae4334` |
| Polygon | `polygon.id.worldcoin.eth` = `0x515f06B36E6D3b707eAecBdeD18d8B384944c87f` | — |

Source: <https://docs.world.org/world-id/idkit/onchain-verification>. Note the Ethereum/Optimism/Polygon
rows are given as ENS names in the docs with the hex in the explorer link.

v3 architecture (<https://docs.world.org/world-id/reference/contracts>):
- `WorldIdIdentityManager` — Ethereum only, owns the Semaphore instance; World's **signup sequencers**
  call it to insert/remove identity commitments. Centralised write path.
- `OpStateBridge` / `PolygonStateBridge` on Ethereum — publish merkle roots to each bridged chain.
- `OpWorldId` / `PolygonWorldId` on the destination chain — receive roots, verify proofs against them.
- Anyone can permissionlessly deploy their own state bridge + bridged World ID to a new chain.
- Repos: <https://github.com/worldcoin/world-id-contracts>, <https://github.com/worldcoin/world-id-state-bridge>

v3 external nullifier construction:
`externalNullifier = abi.encodePacked(hashToField(appId), action)`, `externalNullifierHash = hashToField(externalNullifier)`.
So the v3 nullifier is deterministic per (identity, app_id, action) — **stable and replayable within an app**.

## Integration surface

### Packages (all fetched from <https://docs.world.org/world-id/idkit/integrate>, 2026-07-24)
| Package | Language | Notes |
|---|---|---|
| `@worldcoin/idkit` | React widget (`IDKitRequestWidget`) | use `4.x` |
| `@worldcoin/idkit-core` | JS/TS core (`IDKit.request(...)`), also `@worldcoin/idkit-core/signing` | use `4.x` |
| `@worldcoin/idkit-server` | Node backend, exports `signRequest` | |
| `@worldcoin/idkit-standalone` | **discontinued** — replaced by `@worldcoin/idkit-core` | |
| `github.com/worldcoin/idkit-swift` | Swift SPM | |
| `com.worldcoin:idkit` | Kotlin/Gradle | |
| `github.com/worldcoin/idkit/go/idkit` | Go | |
| `@worldcoin/minikit-js` | Mini Apps inside World App (`MiniKit`, `verify` command) | separate surface; MiniKit 2.0 migration guide exists |
| `@worldcoin/agentkit` + `@worldcoin/agentkit-cli` | AgentKit / x402 | |

Versions and licenses read from the npm registry **2026-07-24**:

| Package | Latest | License | Last publish |
|---|---|---|---|
| `@worldcoin/idkit` | 4.2.1 | MIT | 2026-07-17 |
| `@worldcoin/idkit-core` | 4.2.2 | MIT | 2026-07-17 |
| `@worldcoin/idkit-server` | 1.1.1 | MIT | 2026-04-08 |
| `@worldcoin/minikit-js` | 2.0.3 | MIT | 2026-04-06 |
| `@worldcoin/agentkit` | 0.2.0 | **no license field** | 2026-04-29 |
| `@worldcoin/idkit-standalone` | 2.2.5 | — | 2025-10-02, **npm-deprecated** ("Package no longer supported") |

Notes: the core SDKs are MIT and shipping actively (last publish one week before this research), so the
integration surface is healthy. **`@worldcoin/agentkit@0.2.0` publishes with no `license` field** — legally
that is "all rights reserved" by default. Flag for legal before depending on it; the on-chain AgentBook
read does not require the package (it's one `eth_call`), so we can avoid the dependency entirely.
Orb software is dual MIT / Apache-2.0-with-LLVM-exceptions.

### Presets (what you ask the user to prove)
v4 presets: `proofOfHuman(...)`, `passport(...)`, `identityCheck({attributes})` (preview, contact-sales gated),
`selfieCheckLegacy(...)` (v4 support "rolling out soon").

Legacy v3 presets are *monotone in the legacy hierarchy* — this is the old verification-level ladder and
it still matters for reading old integrations:

| Preset | Requests | Returns |
|---|---|---|
| `orbLegacy` | Orb | Orb |
| `secureDocumentLegacy` | ≥ Secure Document | Secure Document or Orb |
| `documentLegacy` | ≥ Document | Document, Secure Document, or Orb |
| `deviceLegacy` | ≥ Device | Device, Document, Secure Document, or Orb |

So the historical ladder was `device < document < secure_document < orb`. In v4 that ladder is replaced by
explicit `issuer_schema_id`s, which is *better* for an aggregator (no more "at least" ambiguity).

### `require_user_presence` — the most important flag for us
Request-level boolean, not a credential. "asks World ID for a fresh liveness check before returning the
proof and fails with `user_presence_failed` if the check does not complete… World ID matches the user's
live selfie to the credential image, such as the passport photo or the image captured during Orb
verification."
(<https://docs.world.org/world-id/idkit/credentials>)

**This directly counters the account-selling / account-rental attack class.** Without it, a proof only shows
someone controls the authenticator; with it, the live face must match the enrollment face. The response
carries `user_presence_completed: boolean` and the docs warn "IDKit always sends it; treat a missing value
as false" — i.e. it is a claim in the payload, so an aggregator must verify it via the API result, not trust
the client. **Recommendation: our World ID adapter should always set `require_user_presence: true` for the
PoH credential and score a proof without user presence materially lower.**

### Cloud verification
`POST https://developer.world.org/api/v4/verify/{rp_id}` — the OpenAPI spec declares `security: []`, i.e.
**no API key / bearer token required**. Legacy domain `developer.worldcoin.org`, staging
`staging-developer.worldcoin.org`. Handles v3 legacy, v4 uniqueness, and v4 session proofs.
Errors of note: `app_not_migrated`, `all_verifications_failed`, 404 "App not found or no longer active".
Legacy v2 endpoint: `POST /api/v2/verify/{app_id}` (see verify-legacy).
(<https://docs.world.org/api-reference/developer-portal/verify>)

### User-flow friction (matters for our conversion funnel)
Three flows (<https://docs.world.org/world-id/idkit/verification-flows>):
- **Hot** (World ID app already installed): proof consent, "typically under 10 seconds". If the user lacks
  the requested credential, World ID silently walks them through enrollment — our integration sees no
  difference, which means a "verify" call can silently turn into a full Orb trip.
- **Cold** (no app, no account): install + onboarding.
- **Semi-cold** (no app, has account): install + login. **Android resumes automatically** via Play Store
  deferred deep linking; **iOS cannot** — the user must return to our app and rescan the QR, unless we use
  **invite-code mode** (a 6-character code the user types into World ID).
**Implication:** on iOS web, World ID is a materially worse funnel than on Android. Budget for invite-code
mode from day one.

`UNVERIFIED:` rate limits on `/api/v4/verify`. Not stated in the OpenAPI spec or the integrate guide.
Next place to look: the Developer Portal dashboard after registering an app, and response headers on a
live call. Historically World ID cloud verification has been free; **`UNVERIFIED:` current pricing for
World ID 4.0 verification, Identity Check, and Selfie Check** — Identity Check is explicitly "contact us",
which usually means priced.

### Can we verify a World ID proof *without* World's cooperation?
Partly. Split the question:

1. **Verifying a proof someone hands us: YES, permissionlessly.** `WorldIDVerifier.verify(...)` on World
   Chain is a public `view` function; anyone can `eth_call` it against a public World Chain RPC. No API key,
   no registration. Same for legacy `WorldIDRouter.verifyProof` on 5 chains.
2. **Requesting a proof from a user: NO.** World ID 4.0 requires `rp_context` = `{rp_id, nonce, created_at,
   expires_at, signature}`, where the signature is an EIP-191 secp256k1 signature over a versioned message
   using a `signing_key` issued by the Developer Portal. "World ID enforces RP signatures for World ID 4.0
   requests." The user's authenticator refuses to generate a proof without a valid RP signature.
   (<https://docs.world.org/world-id/idkit/signatures>)
3. Consequently: **World can de-platform us at the RP level** by revoking/disabling our `rp_id` (the verify
   endpoint returns 404 "App not found or no longer active"), and every proof is bound to `rpId` on-chain,
   so we cannot even relay another RP's proof. **This is a hard vendor dependency.** It is also a privacy
   feature from the user's side, and it means World has a per-RP view of verification volume.
4. The signature algorithm is fully specified with test vectors, so we can implement RP signing ourselves in
   any language — we just cannot mint the key.

**Practical consequence for the aggregator:** we must register as an RP, and each *action* string we use
becomes a nullifier namespace. We should design action names deliberately (see Privacy model).

## Privacy model

### What the RP learns
A v4 uniqueness proof returns: `identifier` (e.g. `proof_of_human`), `issuer_schema_id`, `nullifier`,
`expires_at_min`, `signal_hash`, `proof` (`uint256[5]`). No PII, no wallet address, no country.
`identity_attested` is added for Identity Check. The credential's actual attribute values are never
revealed — Identity Check returns a boolean match against attributes the RP requested.

### Nullifiers — app-scoped, and now also one-time
- v3: `nullifierHash` deterministic in (identity, `app_id`, `action`) via
  `externalNullifier = abi.encodePacked(hashToField(appId), action)`. **Stable across time** — the same user
  hitting the same app+action always produced the same nullifier. Cross-app linkage was impossible without
  the identity secret, but *within* an app the nullifier was a permanent pseudonymous user ID.
- v4: the IDKit sample calls it `rp_scoped_nullifier`; docs: "different apps or actions produce different
  ones, making nullifiers unlinkable across apps." The 4.0 announcement adds "one-time-use nullifiers
  preventing interaction correlation", and the migration guide says "previously nullifiers were persistent…
  use `nullifier` for one-time uniqueness and `session_id` for continuity."
- **There is no global nullifier exposed to RPs.** World deliberately does not give RPs a stable cross-app
  identifier.

**What this means for us (important):**
- We *cannot* use a World ID nullifier to correlate a user to their Gitcoin Passport / BrightID / Proof of
  Humanity identity. The nullifier is scoped to *our* `rp_id` + action. Cross-protocol dedup must be done on
  something else — a wallet address bound via `signal`, or the user's session.
- Because our aggregator is a *single RP*, all our users share one nullifier namespace per action. That is
  actually what we want: `action = "poh-aggregator-identity"` gives us exactly one nullifier per human, so
  we get uniqueness *within our own service* for free. But it also means we become a linkage point that
  World ID's design was trying to avoid — worth stating in our privacy policy.
- If we ever want per-customer unlinkability (customer A cannot tell customer B they saw the same human),
  we must use per-customer `action` strings, and then we lose cross-customer dedup. This is a genuine design
  fork; pick deliberately.
- `signal` binds arbitrary data (e.g. the user's wallet address) into the proof, tamper-evidently. Use it to
  bind the World ID proof to the same subject we bind other credentials to.

### Backend cryptography
World ID 4.0 uses TACEO's **OPRF network** for distributed proof/key derivation and **anonymized multi-party
computation (AMPC)** for the iris uniqueness check (vendor blog,
<https://world.org/blog/announcements/world-id-full-stack-proof-of-human>, 2026-04-17). Iris codes are split
into three shares (`iris_code_shares_0/1/2` in the PoH issuer's Personal Custody Package upload —
<https://docs.world.org/world-id/reference/poh-issuer>), consistent with a 3-party MPC dedup.
The uniqueness check itself is therefore performed by World-operated (or World-selected) MPC parties, not by
anything we can audit at verification time. **The uniqueness property is an assertion by the issuer, wrapped
in a ZK proof — the ZK part hides the identity, it does not make the uniqueness trustless.**

## Scoring-relevant facts

### Scale (date-stamped)
| Metric | Value | As of | Source |
|---|---|---|---|
| People joined World Network (World App) | 39 million | 2026-07-24 | CoinDesk, secondary: <https://www.coindesk.com/business/2026/07/24/sam-altman-backed-world-network-secures-fresh-funding-to-fight-online-ai-deepfakes> |
| **Orb-verified humans** | **18 million** | 2026-07-24 | same |
| World ID proofs issued (cumulative) | 475 million | 2026-07-24 | same |
| Countries with verified users | 160 | 2026-04-27 | Rest of World, secondary: <https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/> |
| Orb-verified humans | ~10 million | 2025-01 | Biometric Update, secondary: <https://www.biometricupdate.com/202501/world-network-reaches-10-million-verified-humans-amid-continued-legal-blocks> |
| Orb-verified humans | 16.9 million | ~2025-Q4 (Eightco PR) | secondary: <https://www.eqs-news.com/news/corporate/eightco-holdings-inc-orbs-announces-16-9-million-verified-world-humans-...> |

Growth read: ~10M (Jan 2025) → ~17M (late 2025) → 18M (Apr and Jul 2026). **Orb verification has visibly
plateaued in 2026** — roughly flat between April and July 2026 while World App downloads kept growing. That
is consistent with the regulatory blocks below and with the strategic pivot to NFC/Selfie credentials and
enterprise deals. For scoring: the Orb-verified population is ~0.2% of humanity and heavily skewed to
countries where World was allowed to operate and where the WLD grant was a meaningful financial incentive
(historically Kenya, India, Indonesia, Argentina, Brazil, Chile, Portugal, Spain, Germany, Korea, Japan,
Mexico, and later the US). **`UNVERIFIED:` an authoritative current per-country breakdown.** Next place to
look: World's own transparency/stats page and Dune dashboards on World Chain
(<https://docs.world.org/world-chain/quick-start/data>).

### Funding / liveness of the project
World Foundation raised **$52.5M** via a locked token sale led by **Pantera Capital**, with Bain Capital
Crypto and Eightco Holdings — announced **2026-07-24** (today). Clearly not abandoned; actively pivoting to
enterprise ("Proof of Human" for Tinder, Zoom, Docusign, announced April 2026).

### Cost & friction to obtain
- **Orb (PoH):** must physically travel to an Orb or Orb Mini operated by a local operator. Free to the
  user; historically *paid* the user in WLD in eligible countries, which is precisely the incentive that
  drove regulators (Brazil, Kenya) to act. Friction is high and geographically gated. Validity 3 years,
  renewable.
- **NFC (9303):** free, ~2 minutes, needs an NFC phone and a chipped passport/eID. Global-ish but excludes
  the ~75%+ of humans without a biometric passport. Validity = document expiry, max 10 years, **no renewal**.
- **Selfie Check:** free, seconds, no document. 90-day validity — so it must be re-obtained quarterly.

### Decay / expiry / revocation
- PoH expires 3 years after last issuance; renewals reset `expires_at` but preserve `genesis_issued_at`.
- NFC expires with the document (≤10y).
- Selfie Check expires in 90 days.
- Verifiers can enforce `expires_at_min` and `credentialGenesisIssuedAtMin` **inside the proof**, on-chain
  or via the API. This is unusually good: we can demand "PoH credential first issued at least 6 months ago"
  as a cheap anti-fresh-farm filter.
- `UNVERIFIED:` explicit revocation semantics — what happens to outstanding proofs when World revokes a
  credential for fraud, and whether there is a public revocation list an aggregator can poll. Next place to
  look: `CredentialSchemaIssuerRegistry` on World Chain and the `world-id-protocol` repo.

### Suggested scoring treatment
| Credential | Evidence class | Suggested weight |
|---|---|---|
| PoH (schema 1) with `require_user_presence: true` and `genesis_issued_at` > 6 months | uniqueness, strongest available in the market | highest tier |
| PoH without user presence | uniqueness of *credential*, not of *live human* — account-rental exposed | one tier down |
| NFC (9303) with auth claim 2 or 3 (Chip/Active Auth) | state-identity + document uniqueness | mid tier; **must be deduped against ZKPassport/Self/eID protocols** |
| NFC (9303) with auth claim 1 (Passive only) | state-identity, clone-vulnerable by World's own admission | low tier |
| Selfie Check (11) | liveness only | lowest tier; near-zero uniqueness value |
| Legacy v3 `device` | device attestation | treat as ~zero |

## Overlap with other protocols

### ⚠️ Shared trust root with ZKPassport / Self / Rarimo / any eID protocol — CONFIRMED
World's **NFC Credential (schema 9303) is built on exactly the same primitive as every ZK-passport
protocol**: the ICAO-9303 `EF.SOD` (Security Object Document), Passive / Chip / Active Authentication, and
the CSCA/DS certificate chain. Evidence, from World's own docs:
- Claim 0 enumerates ICAO-9303 Passive Authentication, Chip Authentication (CA), and Active Authentication
  (AA) — the standard ICAO 9303 Part 11 mechanisms.
  (<https://docs.world.org/world-id/credentials/9303>)
- Claim 1 is `blake3(SignedData.SignerInfos[0].Signature)` from `EF.SOD`, per ICAO-9303 Part 10 §4.6.2.1 —
  reduced to a field element. This is a **document-unique fingerprint derived from the passport's own
  signature**, which is precisely the construction other ZK-passport protocols use to build their
  document nullifier.
- The NFC issuer's migration endpoint literally takes `credential.sod` (base64 DER `EF.SOD`).
  (<https://docs.world.org/world-id/reference/nfc-issuer>)

**Therefore: a World ID NFC credential and a ZKPassport / Self / Rarimo credential held by the same person
are the same evidence, issued by the same government, from the same chip.** Counting them as two
independent signals would roughly double the apparent strength of what is one passport.
**Action for the aggregator: put World's schema-9303 credential in the same dedup bucket as all other
passport/eID protocols, and cap the contribution of that bucket.**

Corollary risk in the other direction: if we *could* compare Claim-1 SOD-signature hashes across protocols
we would have a genuine cross-protocol document dedup key. World hashes with **blake3** then reduces mod
the field prime; other protocols may use Poseidon/SHA-256 over different byte ranges. `UNVERIFIED:`
whether IDKit exposes any way for an RP to obtain or compare Claim 1, and whether any other protocol uses
`blake3(SignerInfos[0].Signature)`. **This is worth a dedicated follow-up** — a shared canonical document
identifier across passport-based protocols would be the highest-value primitive in our whole system.
Next place to look: the `world-id-protocol` repo (`crates/primitives/src/credential.rs`) and the
ZKPassport / Self nullifier specs.

Note also `identityCheck` returns document attributes (`document_number`, `issuing_country`,
`nationality`, `full_name`) as *attested matches*. If we already know a user's passport number from another
protocol, World's Identity Check can confirm it — which is a dedup channel, at the cost of us handling the
document number.

### Overlap with other biometric-liveness vendors
Selfie Check (schema 11) is a device-camera liveness + facial-similarity product. It shares an evidence
class (and likely underlying vendor tech) with Persona, Onfido, iProov, and with the liveness steps inside
other personhood protocols. Do not count Selfie Check plus another liveness credential as independent.

### Overlap with the Orb
The Orb iris credential is, as far as I can find, **unique in the market** — no other live protocol uses
iris. Proof of Humanity / BrightID / Idena / Humanity Protocol (palm) all use different roots, so a World
PoH is genuinely independent evidence from those. (Humanity Protocol's palm biometric is a different
modality but the same *class* — a proprietary biometric with a trusted issuer; a determined sybil can be
unique in both. They are independent but correlated in failure mode: both fail to a compromised issuer.)

### Downstream consumers
World ID is itself an input to other scoring systems (Gitcoin Passport historically carried a World ID
stamp; Coinbase, Discord, Reddit, Shopify, Telegram, Razer, Tinder/Zoom/Docusign integrations exist).
`UNVERIFIED:` whether Gitcoin/Human Passport still carries a World ID stamp in 2026 — if it does, and we
also consume Human Passport, **we would double-count World ID through two paths**. Check this before
shipping. Next place to look: the Human Passport stamp registry.

## Open questions for us

1. **Rate limits and pricing for `/api/v4/verify`.** Nowhere in the docs. Must be resolved before we
   architect around cloud verification. Register an app and read the Developer Portal / response headers.
2. **Does World's ToS permit an aggregator?** We would be an RP verifying on behalf of *third parties* and
   re-selling the assertion. That is a plausible ToS violation and World can kill our `rp_id` unilaterally
   (verify returns 404 "App not found or no longer active"). **Get this in writing before building.**
   Mitigation path: use on-chain `WorldIDVerifier` + AgentBook, which they cannot revoke — but we still
   need an `rp_id` to *request* proofs.
3. **Is `require_user_presence` available on every credential and every client version, and is
   `user_presence_completed` authenticated?** The docs say IDKit always sends it and to "treat a missing
   value as false" — that phrasing suggests it is a *payload field*, not a proven claim. If it is not
   inside the ZK proof, an attacker who controls the client can lie about it and we must rely on the
   Developer Portal's verdict rather than the payload. **Verify this experimentally.**
4. **What exactly is the AgentBook `humanId`?** Almost certainly the v3 nullifier for AgentBook's own
   app_id/action, but confirm from source. If so it is a stable per-human ID readable by anyone forever —
   both an opportunity (permissionless dedup) and a privacy landmine.
5. **Revocation.** No documented revocation list. What happens to a PoH credential whose owner is caught
   selling accounts? Is there an on-chain signal we can poll?
6. **Selfie Check v4 timeline and whether it produces a nullifier at all**, or only a per-RP "Sybil score".
   If the latter, it is not a credential in our sense.
7. **Current regulatory status after 2026-04.** Nothing found dated after Rest of World's 2026-04-27 piece.
   Re-check before we publish per-country routing.
8. **Cross-protocol SOD dedup key** (see Overlap) — highest-value open question in this document.
9. **v3 sunset timing.** Migration runs to April 2027 and AgentBook still consumes `uint256[8]` v3 proofs.
   We should build against v4 but keep `allow_legacy_proofs: true` for the transition.

## References

- World ID docs index (machine-readable): <https://docs.world.org/llms.txt>
- Core concepts: <https://docs.world.org/world-id/concepts>
- PoH credential: <https://docs.world.org/world-id/credentials/1>
- NFC credential: <https://docs.world.org/world-id/credentials/9303>
- Selfie Check: <https://docs.world.org/world-id/credentials/11>
- Contracts 3.0 (legacy): <https://docs.world.org/world-id/reference/contracts>
- On-chain verification: <https://docs.world.org/world-id/idkit/onchain-verification>
- World ID 4.0 migration: <https://docs.world.org/world-id/4-0-migration>
- World ID 4.0 announcement (2026-04-17, vendor blog): <https://world.org/blog/announcements/world-id-full-stack-proof-of-human>
- Credential Rust type: <https://docs.rs/world-id-primitives/latest/world_id_primitives/credential/struct.Credential.html>
- IDKit integration guide: <https://docs.world.org/world-id/idkit/integrate>
- Configure credentials / presets / `require_user_presence`: <https://docs.world.org/world-id/idkit/credentials>
- RP signature spec + test vectors: <https://docs.world.org/world-id/idkit/signatures>
- Verify API (OpenAPI): <https://docs.world.org/api-reference/developer-portal/verify>
- Legacy verify API: <https://docs.world.org/api-reference/developer-portal/verify-legacy>
- PoH Issuer reference (Personal Custody Package fields, iris code shares): <https://docs.world.org/world-id/reference/poh-issuer>
- NFC Issuer reference (`EF.SOD` handling): <https://docs.world.org/world-id/reference/nfc-issuer>
- AgentKit integrate: <https://docs.world.org/agents/agent-kit/integrate>
- AgentKit SDK reference (AgentBook address, `lookupHuman`): <https://docs.world.org/agents/agent-kit/sdk-reference>
- World Chain contracts: <https://docs.world.org/world-chain/developers/world-chain-contracts>, <https://docs.world.org/world-chain/reference/useful-contracts>
- Orb software (MIT / Apache-2.0-with-LLVM-exceptions): <https://github.com/worldcoin/orb-software>
- Orb open-sourcing post (secure element, hardware root of trust) — vendor blog: <https://world.org/blog/engineering/worldcoin-foundation-open-sources-core-components-orb-software>
- Operator program — vendor: <https://world.org/blog/world/what-is-worldcoin-operator>, <https://world.org/community-operator>
- AgentKit launch (2026-03-17) — vendor: <https://world.org/blog/announcements/now-available-agentkit-proof-of-human-for-the-agentic-web>
- AgentKit launch — secondary: <https://techcrunch.com/2026/03/17/world-launches-tool-to-verify-humans-behind-ai-shopping-agents/>, <https://www.coindesk.com/tech/2026/03/17/sam-altman-s-world-teams-up-with-coinbase-to-prove-there-is-a-real-person-behind-every-ai-transaction>
- $52.5M raise + 39M/18M/475M numbers (2026-07-24) — secondary: <https://www.coindesk.com/business/2026/07/24/sam-altman-backed-world-network-secures-fresh-funding-to-fight-online-ai-deepfakes>
- Country-by-country ban roundup (2026-04-27) — secondary: <https://restofworld.org/2026/sam-altman-worldcoin-zoom-tinder-partnerships/>
- Kenya High Court ruling — secondary: <https://iclg.com/news/22583-kenyan-high-court-delivers-landmark-biometric-data-ruling/>
- Brazil ANPD appeal denied — secondary: <https://decrypt.co/305639/brazilian-regulator-denies-worldcoin-appeal-ban>
- Germany / BayLDA pause — secondary: <https://idtechwire.com/worldcoin-pauses-iris-scanning-in-germany-amid-station-upgrades-and-regulatory-review/>
- Philippines NPC cease-and-desist — secondary: <https://bitpinas.com/regulation/worldcoin-cease-desist/>
- ZachXBT black-market allegations, 2026-04-28 — secondary: <https://ambcrypto.com/prey-on-users-zachxbts-worldcoin-criticism-puts-wld-under-pressure/>, <https://finbold.com/zachxbt-slams-sam-altmans-worldcoin-over-exploiting-users-for-biometric-data/>
- 2023 black market — secondary: <https://www.coindesk.com/policy/2023/05/24/black-market-for-worldcoin-credentials-pops-up-in-china>
- China national-security warning (2025-08) — secondary: <https://www.coindesk.com/policy/2025/08/06/china-warns-worldcoin-style-iris-scanning-a-national-security-threat>
- 10M verified milestone (2025-01) — secondary: <https://www.biometricupdate.com/202501/world-network-reaches-10-million-verified-humans-amid-continued-legal-blocks>

### On-chain reads performed by this agent (2026-07-24, `https://worldchain-mainnet.g.alchemy.com/public`)
| Check | Result |
|---|---|
| `eth_getCode` AgentBook `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` | 7140 bytes; explorer reports verified source, name `AgentBook`, not a proxy |
| `AgentBook.groupId()` (`0xa0f44c92`) | `1` (Orb-only) |
| `AgentBook.worldIdRouter()` (`0x9f50b66d`) | `0x17B354dD2595411ff79041f930e491A4Df39A278` |
| `AgentBook.owner()` (`0x8da5cb5b`) | `0xe340b00B6B622c136FfA5cFf130Ec8EdcDDCB39d` |
| `AgentBook.lookupHuman(0xdead…beef)` (`0x451a02f4`) | `0` — unregistered returns zero |
| `AgentBook.lookupHuman(0xe340…b39d)` | `0x01b695aef6365db7c531bbff217ed6523c2c0c21503a17ead020a284235600f5` |
| `eth_getCode` WorldIDVerifier prod `0x00000000009E00F9FE82CfeeBB4556686da094d7` | 176 bytes; explorer reports `ERC1967Proxy`, eip1967 |
| EIP-1967 impl slot of the above | `0xFF93A0146bF6E7557B63315EFecE083ca07d4C73` |
| `eth_getCode` WorldIDVerifier staging `0x703a6316c975DEabF30b637c155edD53e24657DB` | 284 bytes |
| `eth_getCode` WorldIDRouter `0x17B354dD2595411ff79041f930e491A4Df39A278` | 356 bytes |

Not independently verified on-chain this pass: the Ethereum / Base / Optimism / Polygon `WorldIDRouter`
addresses (taken from World's docs only).
