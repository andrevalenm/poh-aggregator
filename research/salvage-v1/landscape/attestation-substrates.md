# Attestation substrates — EAS, Verax, Privado ID / iden3

> **Salvaged.** Reconstructed from two research agents (rows 8 and 9) killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). Contract addresses survived; the deep questions
> about resolver mechanics and gas costs did not — several doc fetches returned title-only pages.

These three are not personhood protocols. They are **the rails an aggregate credential could be
published on** — the answer to "where does our output live?", which is hard problem #4 in the
[README](../../README.md). Read this file as build-vs-buy research for our own output layer, not as
sourcing research.

## EAS — Ethereum Attestation Service

**The default choice.** Free, open, MIT-ish public good, and — critically — **included as a predeploy
in the OP Stack**, so it exists at fixed addresses on every OP Stack chain from genesis.

### Deployed addresses

| Chain | EAS | SchemaRegistry |
|---|---|---|
| Ethereum mainnet | `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587` | `0xA7b39296258348C78294F95B872b282326A97BDF` |
| OP Stack (predeploy) | `0x4200000000000000000000000000000000000021` | `0x4200000000000000000000000000000000000020` |
| Arbitrum One | `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458` | `0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB` |

Sourced from the `eas-contracts` deployment JSONs. The OP Stack predeploy addresses cover Optimism
and Base identically — that is the point of a predeploy. Also deployed on Linea, zkSync, Scroll and
others (deployment folders exist for each).

Don't hardcode these — the docs recommend "importing and using the addresses directly in your code
using the `@ethereum-attestation-service/eas-contracts/deployments` deployment artifacts."

- **SDK:** `@ethereum-attestation-service/eas-sdk` (TypeScript).
- **Indexing:** per-chain EAS Scan explorers (`base.easscan.org`, `optimism.easscan.org`,
  `arbitrum.easscan.org`) each expose a **GraphQL API and subgraph**. Coinbase's own docs point
  developers at "the EAS subgraph to query for attested wallets… to programmatically determine which
  wallets have specific Coinbase Verifications." So bulk querying is a solved problem.
- **Scale:** Optimism alone shows **1,317,667 attestations across 822 schemas**.

### Mechanics we know

- Anyone can register a schema permissionlessly; each schema gets a UID.
- **Resolver contracts** are the access-control hook. Coinbase uses one to "restrict schema usage to
  permitted attesters, and to index attestations to the indexer" — so a schema can be
  *permissionlessly readable but permissioned to write*, which is precisely the shape an aggregator's
  output credential wants.
- Attestations can be **on-chain or off-chain** (EIP-712 signed), with revocability configured per schema.

> **GAP.** The agent was specifically tasked with explaining resolver mechanics in depth and getting
> **gas costs for an on-chain attestation** — and every relevant doc fetch (`docs.attest.org` core
> concepts, resolver contracts, on-chain vs off-chain) returned **title-only pages with no body**.
> Gas cost is a real input to our economics and is currently unknown. The [SchemaResolver.sol source](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/resolver/SchemaResolver.sol)
> is the reliable route.

### Known personhood-relevant users

- **Coinbase Verifications** on Base — Verified Account schema **#87**, UID
  `0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9`, **680,232 attestations**.
  See [attestation-layers-and-adjacent.md](attestation-layers-and-adjacent.md).
- **Human Passport onchain stamps** via [`passportxyz/eas-proxy`](https://github.com/passportxyz/eas-proxy)
  and `GitcoinPassportDecoder`. Schema **#107** on Optimism
  (`0x0c0a936097ac2bb410fa0351ca23c4cc3f82e04d5c21d2d955d0edd8ddff6d2d`) appears in results as a
  Passport attestation, plus schema #205 on Arbitrum and #49 on zkSync.
  `UNVERIFIED:` which UID maps to which stamp/score product — not confirmed.
  **Minting costs the user a fee** — quoted as **$2** in one source and **$3** in another, plus gas.
  Either way it is a real barrier, so on-chain stamp coverage is much thinner than API coverage.
- **Optimism governance** — RetroPGF Badgeholder schema **#78**
  (`0xfdcfdad2dbe7489e0ce56b260348b7f14e8365a8a325aef9834818c00d46b31b`), plus Citizen attestations
  gated by a Foundation-issuer resolver. AttestationStation has been migrated onto EAS so attestations
  "interoperate across the Superchain and Ethereum Mainnet."

**Verdict: EAS is the strong default for publishing our aggregate.** Free, multichain, indexed,
already the substrate for the credentials we most want to consume, and the resolver pattern gives us
permissioned issuance with open reads. The one gap is **Gnosis Chain** — not seen in any deployment
list captured here. `UNCLEAR:` whether EAS is deployed on Gnosis; **check this early**, since Gnosis
is our home chain and the answer determines whether we publish to EAS elsewhere, deploy EAS to Gnosis
ourselves (it is open source and permissionless to deploy), or use Circles groups as the on-chain
surface instead.

## Verax (Linea)

- **What it is:** "a shared registry for storing attestations of public interest on EVM chains…
  designed to be deployed as a **single instance per network**, so that all dApps on that network can
  issue their attestations to the same place." **MIT licensed**, developed as a Linea public good.
- **Architecture:** schema registry + attestation registry + **Portals** and **Modules** — Portals are
  the issuance entry points, Modules are pluggable validation logic attached to them. This is
  structurally similar to EAS's resolver pattern but with more built-in composition.
  > `UNCLEAR:` the agent's three attempts to fetch a real explanation of Portal/Module semantics all
  > came back empty ("Portal/module architecture — Not discussed"). This is the main technical gap.
- **Contributors:** Consensys, Clique, Karma3 Labs, Aspecta, Primus Labs, Reclaim Protocol.
- **Alive — but with a caveat that matters:**
  [`Consensys/linea-attestation-registry`](https://github.com/Consensys/linea-attestation-registry)
  pushed **2026-07-16** (176★, 93 open issues) — healthy. **But `Consensys/verax-documentation` and
  `Consensys/verax-tutorial` are both ARCHIVED.** Live code, dead docs. That combination usually means
  a project kept on life support for existing users rather than one being promoted for new adoption.
  Weigh accordingly.
- **Privado ID is collaborating with Verax** "to create a cross-chain identity system… to address use
  cases including **Sybil resistance**." That is the most direct personhood signal on Verax found.
- > **GAP.** Three of the brief's core questions went unanswered — **who actually issues personhood
  > attestations on Verax**, whether a "Linea POH" integration is live, and any adoption numbers
  > (schemas / attestations / portals). All three searches returned nothing usable.

**Verdict: not a substrate for us.** Linea-specific, docs archived, adoption unknown. Interesting only
if we later want Linea distribution.

## Privado ID / iden3

- **What it is:** the Iden3 protocol plus tooling — self-sovereign identity with W3C VCs/DIDs and
  Circom zkSNARK circuits. Architecture is the classic **"Triangle of Trust"**: Identity Holder,
  Issuer, Verifier.
- **The interesting piece for us is [`issuer-node`](https://github.com/0xPolygonID/issuer-node)** —
  "Privado ID Self-Hosted Issuer Node" (Go, 106★, pushed **2026-06-18**, releases through v2.3.0).
  **This is a ready-made, self-hostable credential issuer.** If we want to emit our aggregate humanity
  assertion as a proper W3C Verifiable Credential with ZK presentation support — rather than a bare
  on-chain attestation — this is existing infrastructure that does exactly that, and we would not have
  to build credential plumbing or circuits ourselves.
- **Ecosystem is alive:** `js-sdk` ("SDK to work with Privado ID"), `polygonid-flutter-sdk`,
  `c-polygonid`, `contracts` (2026-07-03). The **`iden3` org is separately active** — `js-iden3-core`
  (2026-06-12), `go-iden3-auth` and `iden3comm` (2026-03-11), `driver-did-iden3` (2026-03-20).
- **Deployment:** contracts on Polygon PoS and Amoy testnet, "could be deployed into any other
  EVM-compatible chain."
- `UNVERIFIED:` contract addresses; which circuits (`credentialAtomicQuerySig`, auth, etc.) are used
  where — the agent was asked and never got there.

**Verdict: the credible alternative to EAS for our output**, and the two are not exclusive. EAS gives
a cheap, widely-indexed on-chain flag; iden3 gives a real privacy-preserving credential with selective
disclosure. A plausible design is **iden3 for the credential, EAS for the on-chain discoverability
flag** — and Circles group membership as the Gnosis-native consumption surface.

## What this means for our output design

Three plausible shapes for "where the aggregate lives," and they are complementary rather than
competing:

| Option | Pros | Cons |
|---|---|---|
| **EAS attestation** | free, multichain, already indexed, same rails as Coinbase/Passport/Optimism | on-chain reveals *that* an address scored; Gnosis deployment unconfirmed; gas per attestation unknown |
| **iden3 VC via self-hosted issuer-node** | real W3C VC, ZK selective disclosure, user-held, no per-write gas | heavier stack, needs a verifier integration on the consumer side |
| **Circles group membership** | Gnosis-native, expiry semantics built in, readable by any Gnosis protocol, zero new infrastructure | Circles-ecosystem-only; membership is binary, not a score |

The Circles option is the one nobody outside Gnosis would think of and it is nearly free for us —
see [circles.md](../protocols/circles.md). The realistic v1 is probably **Circles group for the Gnosis
ecosystem + EAS attestation for everywhere else**, with iden3 as the privacy upgrade path.

## Open questions

1. **Is EAS deployed on Gnosis Chain?** Highest-priority unknown in this file. If not, deploying it
   ourselves is permissionless and cheap.
2. What does an on-chain EAS attestation actually cost in gas?
3. What do Verax Portals and Modules actually do, and does anyone issue personhood attestations there?
4. Which Passport EAS schema UID corresponds to the score vs individual stamps?
5. Could `issuer-node` issue our aggregate credential as-is, and what would a consumer need to verify it?

## Sources

- [EAS docs](https://docs.attest.org/) · [schemas](https://docs.attest.org/docs/core--concepts/schemas) · [resolver contracts](https://docs.attest.org/docs/core--concepts/resolver-contracts) · [FAQs](https://docs.attest.org/docs/quick--start/faqs)
- [eas-contracts](https://github.com/ethereum-attestation-service/eas-contracts) · [EAS.sol](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/EAS.sol) · [SchemaResolver.sol](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/resolver/SchemaResolver.sol) · [eas-sdk](https://github.com/ethereum-attestation-service/eas-sdk) · [contracts reference](https://github.com/ethereum-attestation-service/eas-docs-site/blob/main/docs/quick--start/contracts.md)
- [Optimism EAS contracts](https://docs.optimism.io/chain/identity/contracts-eas) · [Optimism schemas](https://docs.optimism.io/chain/identity/schemas)
- [Verax](https://www.ver.ax/) · [docs.ver.ax](https://docs.ver.ax/) · [Consensys/linea-attestation-registry](https://github.com/Consensys/linea-attestation-registry) · [Verax in Linea docs](https://docs.linea.build/get-started/tooling/attestations/verax)
- [Privado ID docs](https://docs.privado.id/) · [iden3 docs](https://docs.iden3.io/) · [iden3comm](https://iden3-communication.io/) · [issuer-node](https://github.com/0xPolygonID/issuer-node) · [js-sdk](https://github.com/0xPolygonID/js-sdk) · [iden3 org](https://github.com/iden3)
- [Privado ID × Disco merger](https://www.privado.id/blog/privado-id-and-disco-xyz-announce-merger-to-launch-unified-identity-across-blockchains-and-legacy-systems) ([Tech.eu, 2024-09-19](https://tech.eu/2024/09/19/privado-id-and-disco-xyz-merge-for-a-new-era-in-multichain-digital-identity/))
