# ZK proofs over government identity documents

> **Salvaged.** Reconstructed from the fetched sources of a research agent killed by a usage limit
> (see [SALVAGE-STATUS.md](../SALVAGE-STATUS.md)). **Coverage is very uneven.** The agent worked
> depth-first and got through ZKPassport thoroughly — full docs, Solidity interfaces, public-input
> layout — before dying. Self Protocol is thin, and **Anon Aadhaar, Rarimo, and the passport-uniqueness
> analysis were never researched at all.** Those sections say so rather than inventing content.
> The agent had delegated eIDAS 2.0/EUDI and national ZK-identity efforts to sub-agents; those are
> separate salvage rows (11, 12, 10) and are not duplicated here.

**Category:** state-identity (document authenticity), with a *document*-scoped uniqueness claim
**Aggregator verdict:** **integrate now — ZKPassport specifically.** It is the most
aggregator-friendly protocol assessed so far: fully permissionless on-chain verification against a
single deterministic address, Apache-2.0 circuits, and a scoped nullifier designed for exactly our
use case. The caveat is fundamental and applies to this whole family: **it proves a document, not a
person.**

## Comparison

| | ZKPassport | Self Protocol | Anon Aadhaar | Rarimo |
|---|---|---|---|---|
| Documents | ICAO-9303 passports, national IDs, residence permits | Passports (174+ countries), EU ID cards, Aadhaar | Aadhaar only | Passports |
| Proof system | Noir + UltraHonk (Barretenberg/Aztec) | Circom / zk-SNARKs | Circom | not researched |
| On-chain | Ethereum, Sepolia, Base | Celo | — | not researched |
| Licence | Apache-2.0 (circuits, SDK) | NOASSERTION (repo) | MIT | not researched |
| Salvage quality | **good** | thin | **none** | **none** |

## 1. ZKPassport

The user scans their document's NFC chip with the mobile app; everything happens on-device. "Your
personal data is encrypted and processed locally on your device and never leaves it."

**Proof structure — at least 4 subproofs:** 2 proofs verifying the issuing country's signatures over
the ID data, 1 proof of ID-data integrity, and a 4th *disclosure* proof selectively revealing
requested attributes. The 3 base proofs are generated once at scan time (**10–50s**, depending on the
document's signature algorithm) and **cached**; disclosure proofs then take <1–10s. RAM: under 1GB for
RSA documents, up to 2GB for large ECDSA curves (P521, Brainpool P512r1) — which "may get close to the
limit of some low-end devices."

### Uniqueness — how it actually works

From the [FAQ](https://docs.zkpassport.id/faq):

> "The unique identifier is derived from the ID data (retrieved from the chip). This data is combined
> with the domain name and the scope the service specified and hashed using **Poseidon2**. […] This
> ensures the unique identifier is the same for the same ID while differing between different services."

So: **per-(document, domain, scope)**, i.e. app-scoped and unlinkable across services — the same
property World ID gives. Good.

But the docs are refreshingly blunt about two limits, and both matter enormously to us:

> "A single individual may possess numerous identification documents, so the guarantee is truly
> **'one ID ↔ one account', not necessarily 'one person ↔ one account'**."

> "it's possible to derive the unique identifier from the ID data if you have complete knowledge of
> the ID chip data, the domain name and scope. **This could include the issuing government** (if they
> keep a record of all the IDs they signed)."

The second is mitigable: request a **salted unique identifier**, which adds a secret via **vOPRFs**
(Verifiable Oblivious Pseudo-Random Functions) so the issuer cannot recompute it. **We should default
to salted identifiers.** The first is not mitigable by cryptography at all — see §5.

For anti-spoofing, ZKPassport offers **Private FaceMatch**, comparing a live face capture to the
photo in the chip, on-device, using 180MB of bundled ML models. It requires device attestation
(Google Play Integrity / Apple App Attestation) and **will refuse to run on jailbroken, rooted, or
GrapheneOS devices**. That is a real accessibility/ideology cost worth noting: the privacy-conscious
users most likely to want ZK identity are the ones most likely to be running GrapheneOS. FaceMatch
modes are `NONE`, `REGULAR`, `STRICT`; the docs recommend strict mode for personhood.

### On-chain surface — the best in class so far

Verifier: [`ZKPassportVerifier`](https://etherscan.io/address/0x1D000001000EFD9a6371f4d90bB8920D5431c0D8#code)
at **`0x1D000001000EFD9a6371f4d90bB8920D5431c0D8`** — and critically:

> "Since the verifier address is **deterministic, it is the same for all networks**."

Deployed on **Ethereum Mainnet, Ethereum Sepolia, Base Mainnet**. Other chains on request
(`company@zkpassport.id`). Gnosis Chain is not currently deployed — but a deterministic-address
deployment is a far lighter lift than World ID's satellite bridge, and is worth simply asking for.

```solidity
interface IZKPassportVerifier {
    function verify(ProofVerificationParams calldata params)
        external
        returns (bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper);
}
```

Public inputs layout (from the documented `ProofVerificationParams`), which tells us exactly what an
aggregator can read:

| Index | Field |
|---|---|
| `[0]` | `certificate_registry_root` |
| `[1]` | `circuit_registry_root` |
| `[2]` | `current_date` (u64) |
| `[3]` | `service_scope` |
| `[4]` | `service_subscope` |
| `[5 : 5+N]` | `param_commitments` |
| `[5+N]` | `nullifier_type` (u8) |
| `[6+N]` | `scoped_nullifier` |

Note **`service_subscope`** and **`nullifier_type`** exist as first-class public inputs. The docs the
agent fetched never explained them (the personhood page explicitly "does not contain specific
information about nullifiers, subscope, or bind parameters"), but their presence suggests more
nullifier flexibility than the FAQ describes. **Worth investigating — `nullifier_type` may be the
mechanism that lets us choose linkability semantics per query.**

`ServiceConfig` carries `validityPeriodInSeconds`, `domain`, `scope`, `devMode` — so proof freshness
is enforced on-chain and configurable by us.

The helper contract exposes a rich predicate library so a contract never touches raw PII:
`isAgeAboveOrEqual` / `isAgeAbove` / `isAgeBetween` / `isAgeBelow(OrEqual)` / `isAgeEqual`, the same
family for `Birthdate` and `ExpiryDate`, country inclusion/exclusion, **sanctions root validation**,
FaceMatch verification, `verifyScopes`, plus `getDisclosedData` and `getBoundData`.

`DisclosedData` fields: `name` (with MRZ angle brackets), `issuingCountry`, `nationality`, `gender`,
`birthDate`, `expiryDate`, `documentNumber`, `documentType`.
`BoundData`: `senderAddress`, `chainId`, `customData` — so a proof can be **bound to the claiming
wallet and chain**, which kills proof-replay and front-running of claims. For an aggregator issuing
an on-chain assertion, that binding is exactly the primitive we need.

Query building is fluent and the disclosure is explicit:

```typescript
queryBuilder
  .disclose("nationality")
  .disclose("document_type")
  .gte("age", 18)
  .bind("user_address", "0x...")
  .bind("chain", "ethereum")
  .bind("custom_data", "my-custom-data")
  .done()
```

For EVM verification set `mode: "compressed-evm"`, then pick the proof whose `name` starts with
`outer_evm` and pass it to `getSolidityVerifierParameters`. Verifier ABI/address come from
`getSolidityVerifierDetails()`.

### Integration surface

Packages: **`@zkpassport/sdk`** and **`@zkpassport/ui`** (with a `@zkpassport/ui/react`
`ZKPassportQRCode` component). Circuits and SDK are **Apache-2.0**; the mobile app will be
open-sourced "when out of the testing phase." Proofs are composable into your own Noir circuits via
Barretenberg's recursive `verify_proof`.

**Very actively developed** — as of 2026-07-24, `zkpassport-packages` (35★) and `circuits` (90★) both
had commits *that same day*. Note the older `zkpassport-sdk` (31★) and `zkpassport-utils` repos are
**archived**; the monorepo `zkpassport-packages` is canonical now. There is also a `cloud-prover` and
a `zkpassport-proof-verifier` ("Verifier API") — the latter suggests a hosted verification option
alongside the on-chain path.

Two integration models: **self-served** (define queries in code) or **dashboard** (centralised policy
management with auditable proof storage).

> `UNVERIFIED:` **pricing is not disclosed anywhere in the salvaged material** — neither the FAQ nor
> the docs state a cost. Also unverified: gas cost of on-chain `verify()`, which for an UltraHonk
> verifier is likely substantial and is a real input to our unit economics. Measure it.

## 2. Self Protocol

Thin salvage — the docs fetch returned mostly product-overview material.

What is sourced: privacy-first open-source identity protocol using **zk-SNARKs** (Circom, per the
repo language), attesting over **passports (174+ countries), EU ID cards, and Indian Aadhaar**.
On-chain attestations settle on **Celo**. Provable facts: real unique human, over a certain age,
nationality, **not on a sanctions list**. Self launched at EthDenver 2025 following Celo's
**acquisition of OpenPassport**, and raised **$9M seed** (Biometric Update, 2025-11). Aadhaar support
was added 2025-09, which the same source frames as reaching "99 percent of Indian adults."

Product structure per the docs: **Self Enterprise** (managed platform), **Self Connect** (links
phone/email/social identifiers to on-chain addresses), **Agent ID** (on-chain identities for AI
agents, ERC-8004), and **Self Pass** (legacy open-source SDK, *superseded*).

The main [`selfxyz/self`](https://github.com/selfxyz/self) repo is the most-starred thing in this
whole landscape (**1253★**, pushed 2026-07-24) and the org is busy: `self-sbt` (Solidity),
`self-agent-id` (EIP-8004 proof of human/uniqueness for agents), `self-mcp`, `tee-prover-server`
(Rust), `self-layerzero-example`. Notably the org also hosts a fork of **`anon-aadhaar`** (MIT) —
confirming the Aadhaar lineage.

There is a **published audit**: [zksecurity — Auditing Self](https://blog.zksecurity.xyz/posts/self-audit/).
That is a point in its favour and none of the salvaged material contradicts it.

> **GAP.** Contract addresses, chain IDs, SDK package names, nullifier design, and disclosure-field
> list for Self were **all "not specified in provided content."** The `docs.self.xyz` sitemap fetch
> returned empty. Self is plausibly as important as ZKPassport for us — Celo-native, sanctions
> screening, Aadhaar reach — and it is currently the **biggest single hole in our research**. Redo it
> first.
>
> Also note the drift toward enterprise/managed products, with the open-source SDK marked
> "superseded." Check whether permissionless self-serve verification is still a supported path.

## 3. Anon Aadhaar — not researched

> **GAP — nothing salvageable.** The agent never searched for it. The only trace in the material is
> [`selfxyz/anon-aadhaar`](https://github.com/selfxyz/anon-aadhaar) (MIT, last pushed 2025-08-20),
> described as "a zero-knowledge protocol that allows Aadhaar ID owners to prove their identity in a
> privacy preserving way."
>
> The brief's question — whether Aadhaar proves *uniqueness* by default — is unanswered here and is
> important, because Aadhaar is a genuinely unique national identifier at ~1.4B scale, unlike a
> passport. Start at the PSE / 0xPARC repos.

## 4. Rarimo — not researched

> **GAP — nothing salvageable.** One URL surfaced in search results and was never fetched:
> [ZK Passport smart contracts reference | Rarimo Docs](https://docs.rarimo.com/zk-passport/contracts/).
> Freedom Tool voting deployments were not investigated.

## 5. The passport-uniqueness problem

Not researched as a topic, but ZKPassport's own docs state the core of it plainly, and the conclusion
is important enough to record now:

**A document proof binds to a document, not a human.** ZKPassport: the guarantee is "one ID ↔ one
account, not necessarily one person ↔ one account." Concretely:

- Dual and multiple citizens hold several valid passports and can produce several distinct valid
  nullifiers for the same scope.
- Renewal produces a *new* document with a new document number, hence a new nullifier — so this cuts
  both ways: **renewal also silently breaks continuity for honest users**, who look like a new person
  after they renew. `isExpiryDateAfterOrEqual` lets us at least require an unexpired document.
- Passports and national ID cards are separate documents — one person, two credentials.
- There is no global registry of document nullifiers, and none can exist without a privacy
  catastrophe.

**Implication for our scoring model:** a passport proof is strong evidence of *document authenticity*
and weak-to-moderate evidence of *uniqueness*. Uniqueness degrades in exactly the population most
likely to be adversarial (people with the means to hold multiple nationalities) — a scoring model
that treats a passport proof as one-human-one-account is wrong in a way that favours well-resourced
sybils. FaceMatch in strict mode partially mitigates (the same face must appear across documents) but
only if we can compare across proofs, which app-scoped nullifiers deliberately prevent.

> **GAP.** Country coverage, Active Authentication availability, and the observation that many
> countries' CSCA master lists are not public — all un-researched. Note that
> `certificate_registry_root` is a public input to every ZKPassport proof, so **whatever the
> supported-issuer set is, it is committed to on-chain** and is presumably enumerable from the
> circuits repo. That is where to look.

## Overlap with other protocols

**This is the highest-overlap family in our entire set, and the correlated-failure risk is severe.**

Everything here reads the same ICAO-9303 chip: ZKPassport, Self, Rarimo, **and World ID's NFC
Credential (`9303`)**. A person with one passport can obtain a ZKPassport proof, a Self attestation,
*and* a World ID NFC credential from that single document. Naively summed, one passport becomes three
"independent" credentials. **They are one piece of evidence.**

Any aggregate score must therefore deduplicate by *trust root*, not by protocol. The cruel part is
that app-scoped nullifiers — the correct privacy design — make it cryptographically impossible for us
to detect that two proofs came from the same document. **We cannot solve this by observation.** The
options are: (a) score the *strongest* document credential and ignore the rest, (b) require the user
to prove distinctness some other way, or (c) accept the double-count. Option (a) is the only sound
default, and it needs to be a deliberate, documented rule.

Aadhaar (Self, Anon Aadhaar) is a separate trust root from ICAO passports and genuinely independent.

## Open questions for us

1. **Redo Self Protocol from scratch** — it is Celo-native, audited, has sanctions screening and
   Aadhaar, and we know almost nothing concrete about it.
2. **What are `nullifier_type` and `service_subscope`?** They may let us choose linkability semantics
   per query — potentially the single most useful lever for aggregate deduplication.
3. **Ask ZKPassport to deploy to Gnosis Chain.** Deterministic address, so this is cheap for them.
4. What does on-chain `verify()` cost in gas? UltraHonk verification is not free.
5. What is ZKPassport's pricing model?
6. How do we implement "score the strongest document credential, once" when nullifiers are
   deliberately unlinkable across protocols?
7. Does the GrapheneOS/rooted-device exclusion from FaceMatch matter for our user base?

## References

- [ZKPassport docs](https://docs.zkpassport.id/) — [intro](https://docs.zkpassport.id/intro) · [FAQ](https://docs.zkpassport.id/faq) · [on-chain](https://docs.zkpassport.id/getting-started/onchain) · [personhood](https://docs.zkpassport.id/examples/personhood) · [salted identifiers](https://docs.zkpassport.id/examples/salted-identifiers) · [facematch](https://docs.zkpassport.id/examples/facematch) · [limitations](https://docs.zkpassport.id/limitations) · [API](https://docs.zkpassport.id/api)
- [zkpassport/circuits](https://github.com/zkpassport/circuits) (Apache-2.0) · [zkpassport-packages](https://github.com/zkpassport/zkpassport-packages) · [ZKPassportVerifier on Etherscan](https://etherscan.io/address/0x1D000001000EFD9a6371f4d90bB8920D5431c0D8#code) · [demo](https://demo.zkpassport.id)
- [Noir](https://noir-lang.org/) · [Barretenberg](https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg)
- [selfxyz/self](https://github.com/selfxyz/self) · [Self.xyz](https://self.xyz/) · [Build with Self — Celo Docs](https://docs.celo.org/build-on-celo/build-with-self) · [zksecurity audit of Self](https://blog.zksecurity.xyz/posts/self-audit/)
- [selfxyz/anon-aadhaar](https://github.com/selfxyz/anon-aadhaar)
- [Rarimo ZK Passport contracts](https://docs.rarimo.com/zk-passport/contracts/) — *not fetched*
- Secondary: [Celo blog — Self Protocol launch / OpenPassport acquisition](https://blog.celo.org/self-protocol-a-sybil-resistant-identity-primitive-for-real-people-launches-following-acquisition-74fd3461a428) · [Biometric Update — $9M seed](https://www.biometricupdate.com/202511/self-completes-9m-seed-round-introduces-points-scheme-for-verification) · [Biometric Update — Self integrates Aadhaar](https://www.biometricupdate.com/202509/self-integrates-aadhaar-to-enable-age-identity-verification-with-zkps)
