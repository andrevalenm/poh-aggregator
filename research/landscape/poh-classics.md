# The classic PoH protocols — PoH v1/v2, Kleros Curate, BrightID, Idena

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). This agent had done most of its work — including
> direct GitHub API calls for commit dates — before it died. Coverage is good; the main gaps are
> live user counts for Idena and Kleros Curate's current status.

The first generation of proof-of-personhood. Two of these are directly routable for us today, and
**Proof of Humanity v2 is the single most important entry in this file** because it is Gnosis
Chain-native, purely on-chain, permissionless, and already wired into Circles.

## Proof of Humanity v2 — **route this first**

- **One-liner:** Kleros-arbitrated registry of verified humans with soulbound humanity IDs, deployed
  cross-chain on Gnosis Chain and Ethereum.
- **Category:** uniqueness (secondary: social-trust — registration requires a vouch)
- **What it proves:** a human submitted a photo and video, was vouched for, posted a deposit, and
  survived a challenge window; disputes go to Kleros jurors. Trust root is **economic + adversarial
  arbitration**, not biometrics or documents. That makes it a genuinely independent failure mode from
  every other protocol in our set — it fails to *bribery and juror capture*, not to spoofing.

**Contract addresses** ([Kleros integration guide](https://docs.kleros.io/products/proof-of-humanity/proof-of-humanity-2.0-integration-guide)):

| Chain | Contract | Address |
|---|---|---|
| Gnosis | `ProofOfHumanity` (local registry) | `0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc` |
| Gnosis | `CrossChainProofOfHumanity` *(primary for integrations)* | `0x16044E1063C08670f8653055A786b7CC2034d2b0` |
| Gnosis | AMB Gateway | `0x6Ef5073d79c42531352d1bF5F584a7CBd270c6B1` |
| Ethereum | `ProofOfHumanityExtended` (local registry) | `0xbE9834097A4E97689d9B667441acafb456D0480A` |
| Ethereum | `CrossChainProofOfHumanity` *(primary for integrations)* | `0xa478095886659168E8812154fB0DE39F103E74b2` |
| Ethereum | AMB Gateway | `0xddafACf8B4a5087Fc89950FF7155c76145376c1e` |
| Ethereum | Fork Module | `0x068a27Db9c3B8595D03be263d52c813cb2C99cCB` |

Gnosis `POH_Implementation` reported as `0x85B88E38FB6cbc8059009902F76C47f902373F52`; Ethereum
implementation as `0x9EcDfADA6376D221Ed1513c9F52cC44a39E89657`.
> `UNVERIFIED:` addresses come from Kleros docs and search-result text, **not** checked against a
> block explorer by the agent. Verify on Gnosisscan/Etherscan before writing any of them into code.

**Integration surface — as good as it gets:**

> "PoH V2 uses purely on-chain contract calls. **There is no API or SDK requirement.**"

```solidity
isHuman(address _account)        // bool
humanityOf(address _account)     // bytes20 humanity ID
isClaimed(bytes20 _humanityId)   // bool
boundTo(bytes20 _humanityId)     // address — current owner
```

All `view`, all permissionless. No key, no allowlist, no fee. **This is the cheapest, most
trust-minimised credential read available to us.**

The v1→v2 change matters for scoring: v1 bound a registration to a *wallet address*; v2 issues a
**soulbound `humanityId` (bytes20) that persists across wallet changes**. So the humanity ID is a
stable identifier for a person across address rotation — and `boundTo` resolves the current address.
That is exactly the primitive an aggregator wants, and it is rare.

**Already integrated with Circles.** The `PoHMembershipCondition.sol` in
[`aboutcircles/poh-group-setup`](https://github.com/aboutcircles/poh-group-setup) consumes precisely
this interface (`isHuman`, `humanityOf`, `boundTo`, plus `getHumanityInfo` for expiry) and enforces
one-PoH-ID-to-one-Circles-account. See [circles.md](../protocols/circles.md). **If we score both a
PoH credential and a Circles group membership granted by it, we double-count.**

- **Alive:** yes, actively developed. `proof-of-humanity-v2-web` pushed **2026-07-23**;
  `reward-distributor` 2026-07-20; `proof-of-humanity-v2-subgraph` 2026-06-13;
  `proof-of-humanity-v2-contracts` pushed **2026-05-07** (241 commits, 22★, not archived). Kleros
  hired a dedicated PoH lead as of Oct 2025 and is working on "enhanced privacy features."
- **Scale:** `UNVERIFIED:` — **no registered-human count was found.** The landing page shows only an
  airdrop cap ("First 10,000 humans only" for 1,200 $PNK). The
  [v2 subgraph](https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-subgraph) is the obvious
  place to get a real number and nobody has queried it yet. **Do this — it is a one-query answer.**
- **Routable?** **Yes, first.** Gnosis-native, on-chain, free, stable person-level ID.

## Proof of Humanity v1

- **One-liner:** the original 2021 Kleros/Democracy Earth registry, one registration per wallet.
- **Chains:** Ethereum mainnet. Registry `0xC5E9dDebb09Cd64DfaCab4011A0D5cEDaf7c9BDb`; the repo
  advises integrating against the **proxy** `0x1dAD862095d40d43c2109370121cf087632874dB`, which "will
  automatically be updated in case of new versions" and doubles as a pseudo-ERC20 for voting.
  Associated UBI token `0xdd1ad9a21ce722c151a836373babe42c868ce9a4` (`UNVERIFIED:` relationship not
  confirmed from a primary source).
- **Alive:** **legacy.** [`Proof-Of-Humanity/Proof-Of-Humanity`](https://github.com/Proof-Of-Humanity/Proof-Of-Humanity)
  (169★) was last *pushed* **2023-01-24** — three and a half years stale — though the repo metadata
  updated 2026-07-06 and it is not archived. V1 registrations remain reachable through the **Fork
  Module** in v2.
- **Routable?** No — read v2's cross-chain contract instead, which subsumes v1 via the Fork Module.
  Only worth touching directly if we want registration *age* back to 2021 as a signal.

## Kleros Curate (Generalized TCR)

- **One-liner:** permissionless deploy-your-own curated registry, with challenge periods and Kleros
  arbitration; personhood-adjacent infrastructure rather than a personhood credential.
- **Why it is interesting to us:** it is a general primitive for *any* list maintained by
  economic challenge — "a way for anyone to easily deploy a curated list with any combination of
  fields, listing criteria and deposit values," where "the users of the app get to write the listing
  criteria and pick an arbitrator." That is a plausible governance mechanism for **our own registry
  of which protocols/issuers we accept and at what weight** — a curated, challengeable list of trust
  roots rather than a hardcoded config.
- **Alive:** **mixed, tending stale on the classic stack.** [`kleros/gtcr-sdk`](https://github.com/kleros/gtcr-sdk)
  is **archived** (last push 2023-01-24). The Curate contracts repo last pushed 2023-08-08. But the
  [`kleros/kleros-v2`](https://github.com/kleros/kleros-v2) monorepo — which includes a Curate module —
  was pushed **2026-07-24**, the same day as the research. So Curate Classic is frozen and the action
  has moved into Kleros v2. Kleros 2.0 Beta deployed on **Arbitrum One in Nov 2024**.
- `UNCLEAR:` chains, npm packages, and current maintenance status of Curate specifically — the docs
  page did not answer, and `kleros.io/curation/` returned **HTTP 404**.
- **Routable?** Not as a credential. Track as a design pattern and possible governance substrate.

## BrightID

- **One-liner:** privacy-first social graph where users verify each other by QR-code connections in
  verification parties; no biometrics, no personal data.
- **Category:** social-trust
- **What it proves:** position in a social graph — "verified by a trusted group of close personal
  contacts plus a decentralized graph database." **Bitu Verification** grades users by their location
  in the graph. Conceptually the closest protocol to Circles in our set.
- **Scale:** **over 100,000 verified unique users as of July 2025**, 15 dApps integrated (Gitcoin
  Passport, CLR.fund among them). Secondary source; date-stamped and plausible but not primary.
- **Integration:** API docs + GitHub, **but gated by a sponsorship model** — "Already integrated and
  ran out of sponsorships for your project? Please head over to the Sponsorships Dashboard and get
  more." So integration consumes a rationed resource. `UNCLEAR:` whether sponsorships cost money and
  what the rate limit is. **This is the blocker for us** — it is not permissionless in the way PoH v2 is.
- **Alive:** **fading.** [`BrightID/BrightID`](https://github.com/BrightID/BrightID) (245★, ISC
  licence) last pushed **2025-10-20**; latest release **5.0.2 on 2025-10-16**. Nine months quiet as of
  2026-07, with 163 open issues. Not dead, not thriving.
- **Routable?** **Maybe.** Independent trust root and a real user base, but the sponsorship gate and
  the slowing development argue for treating it as a low-weight bonus signal, not a primary route.

## Idena

- **One-liner:** standalone blockchain whose consensus *is* proof-of-person — synchronised global
  validation ceremonies where participants solve human-authored "flip" puzzles.
- **Category:** liveness / uniqueness (unusual: uniqueness enforced by *synchrony*)
- **What it proves:** the most conceptually distinct mechanism in the entire landscape. Every
  participant must solve flips **simultaneously, at the same wall-clock moment, every epoch**. One
  person cannot be in two places at once, so running N identities requires solving N sets
  concurrently. Flips are created *by humans* and "solving a flip requires a semantic interpretation
  of the relationship between objects" rather than object recognition — deliberately harder for AI
  than a standard CAPTCHA.
- **The catch for an aggregator:** the credential is **perishable and demanding**. Validation must be
  repeated *every epoch* to stay valid. Statuses are Newbie / Verified / Human — a genuine built-in
  tier ladder we could map to score bands.
- **Live network data** the agent pulled from the Idena RPC: **epoch 215**, next validation
  `2026-07-26T15:00:00Z`, `minScoreForInvite` 0.9622642, `candidateCount` 9,
  `discriminationStakeThreshold` ~205.85. A separate call returned `{"result":122}`.
  > `UNCLEAR:` what the `122` counts — it is unlabelled in the transcript and **must not** be reported
  > as the identity count. The real number is at [scan.idena.io/charts/identities](https://scan.idena.io/charts/identities),
  > which the agent tried twice and could not read (the chart data is client-rendered).
  >
  > `candidateCount: 9` is worth a second look though: if that reflects new candidates for the
  > upcoming ceremony, the network is very small. Do not conclude that from one field — but do check.
- **Alive:** **slowing but running.** [`idena-go`](https://github.com/idena-network/idena-go) (153★,
  LGPL-3.0) last pushed **2025-12-22**, latest release **v1.1.2 on 2025-12-22**. `idena-web` pushed
  2025-05-29, `idena-marketplace` 2025-06-01. Most other org repos went quiet in 2023–2024. **But the
  chain is live and producing epochs on schedule** — epoch 215 with a scheduled future validation is
  hard evidence of an operating network, which matters more than repo velocity.
- **Routable?** **Maybe, low priority.** It is a separate non-EVM chain, so reading it means running
  or trusting an Idena indexer — no on-chain read from Gnosis. High friction for users (a scheduled
  synchronous ceremony), so coverage will be small. But the mechanism is *strongly* independent of
  every other trust root, which makes it valuable per-user in an aggregate. Best treated as a
  high-weight, low-coverage bonus.

## What this file changes about our design

1. **PoH v2 should be our reference integration.** Gnosis-native, free, permissionless, on-chain,
   with a stable person-level ID that survives wallet rotation. Nothing else assessed is this clean.
2. **The `humanityId` is a model for our own output.** A `bytes20` soulbound identifier plus
   `boundTo()` resolution is a better shape than address-keyed scores.
3. **Independent failure modes are the real prize.** Kleros arbitration (bribery), BrightID/Circles
   (graph collusion), Idena (physical synchrony), documents (chip cloning), World ID (iris). These
   fail for genuinely unrelated reasons — which is the entire mathematical justification for
   aggregating rather than picking one. Correlated document-based credentials are the opposite case.
4. **Watch the double-count with Circles again.** PoH v2 → `poh-group-setup` → Circles group trust is
   a live, deployed chain of derivation in our own backyard.

## Open questions

1. **How many humans are actually in PoH v2?** Query the subgraph. Blocking for any sizing work.
2. Do BrightID sponsorships cost money, and what is the rate limit?
3. What is Idena's real validated-identity count, and is `candidateCount: 9` a red flag?
4. Is Curate Classic dead in favour of the Kleros v2 module, and does the v2 module still expose GTCRs?

## Sources

- [PoH v2 integration guide](https://docs.kleros.io/products/proof-of-humanity/proof-of-humanity-2.0-integration-guide) · [Kleros PoH docs](https://docs.kleros.io/products/proof-of-humanity) · [PoH FAQ](https://docs.kleros.io/products/proof-of-humanity/poh-faq)
- [Proof-Of-Humanity org](https://github.com/Proof-Of-Humanity) · [v2 contracts](https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-contracts) · [v1 contracts](https://github.com/Proof-Of-Humanity/Proof-Of-Humanity) · [v2 subgraph](https://github.com/Proof-Of-Humanity/proof-of-humanity-v2-subgraph)
- [proofofhumanity.id](https://proofofhumanity.id/)
- [Kleros Curate docs](https://docs.kleros.io/products/curate) · [Generalized TCRs — Kleros blog](https://blog.kleros.io/generalized-token-curated-registries/) · [kleros/kleros-v2](https://github.com/kleros/kleros-v2) · [gtcr-sdk (archived)](https://github.com/kleros/gtcr-sdk)
- [BrightID](https://www.brightid.org/) · [BrightID/BrightID](https://github.com/BrightID/BrightID) · [verifications docs](https://brightid.gitbook.io/brightid/verifications) · [Bitu verification](https://brightid.gitbook.io/brightid/verifications/bitu-verification) · [whitepaper (PDF)](https://uploads-ssl.webflow.com/5e54622b3f6e65be8baf0653/5e76ab330a930fbf7dc4d1eb_BrightID%20Whitepaper.pdf)
- [Idena](https://www.idena.io/) · [technology whitepaper](https://docs.idena.io/docs/wp/technology) · [validation ceremony protocol](https://docs.idena.io/docs/developer/validation) · [idena-go](https://github.com/idena-network/idena-go) · [identities chart](https://scan.idena.io/charts/identities)
- Related: [elmol/zk-proof-of-humanity](https://github.com/elmol/zk-proof-of-humanity) — ZK layer over PoH, "prove humanity without doxing"
