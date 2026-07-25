# Research index

All research to date. Every file in this index was **salvaged** from a research session that was
killed by a usage limit before it could write anything — see
[SALVAGE-STATUS.md](SALVAGE-STATUS.md) for what that means and what it cost in coverage.

Treat everything here as a well-cited first draft with known holes, not finished research.

## Protocol deep-dives

| File | Verdict | One-line summary |
|---|---|---|
| [world-id.md](protocols/world-id.md) | integrate now | Largest uniqueness credential; 4.0 migration in progress; app-scoped nullifiers; not on Gnosis Chain |
| [circles.md](protocols/circles.md) | integrate now | **No trust score exists** — a binary expiring trust graph we would score ourselves; Gnosis-native |
| [humanity-protocol.md](protocols/humanity-protocol.md) | integrate later | Mainnet offline after a ~$32–36M key compromise; verification is a trusted oracle |
| [zk-passport-and-eid.md](protocols/zk-passport-and-eid.md) | integrate now | ZKPassport is the cleanest integration found; proves a *document*, not a person |

## Landscape

| File | Covers |
|---|---|
| [poh-classics.md](landscape/poh-classics.md) | **PoH v2** (the standout — Gnosis-native, on-chain, free), PoH v1, Kleros Curate, BrightID, Idena |
| [commercial-identity-vendors.md](landscape/commercial-identity-vendors.md) | Human Passport, Civic, Fractal ID, zkMe, Galxe, Privado/Billions |
| [attestation-layers-and-adjacent.md](landscape/attestation-layers-and-adjacent.md) | Coinbase Verifications, Optimism, Billions, Human Wallet, Unitap, Intuition; **Sismo is dead** |
| [attestation-substrates.md](landscape/attestation-substrates.md) | EAS, Verax, iden3 — candidate rails for publishing *our own* credential |
| [government-standards-track.md](landscape/government-standards-track.md) | eIDAS 2.0, EUDI ARF v3.0.0, ISO mdoc, Longfellow ZK |
| [national-zk-identity.md](landscape/national-zk-identity.md) | QuarkID (3.6M), Bhutan NDI, Taiwan, EU age-verification blueprint, Swiss swiyu |
| [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md) | How Passport, Trusta, Nomis and OpenRank actually compute scores — **read this first** |
| [sybil-incidents-and-antipatterns.md](landscape/sybil-incidents-and-antipatterns.md) | LayerZero, Arbitrum, Gitcoin — what has actually failed, with numbers |
| [demand-and-regulation.md](landscape/demand-and-regulation.md) | EU AI Act, UK OSA, FSC v. Paxton, US app-store acts |
| [kyc-vendors-and-web2-signals.md](landscape/kyc-vendors-and-web2-signals.md) | Sumsub, Persona, iProov, FaceTec, Farcaster/Neynar — **the only published prices** |

## The findings that should shape the design

1. **Proof of Humanity v2 should be the reference integration.** Gnosis Chain-native, purely
   on-chain, permissionless, free, with a soulbound `humanityId` that survives wallet rotation.
   Nothing else assessed is this clean. → [poh-classics.md](landscape/poh-classics.md)

2. **Circles has no trust score.** The brief assumed one exists. It does not — there is a binary,
   directional, expiring trust graph and a pathfinder, nothing more. Any score is ours to build, which
   is an opportunity rather than a problem. → [circles.md](protocols/circles.md)

3. **The correlated-failure problem is worse than the README assumes.** ZKPassport, Self, Rarimo and
   World ID's NFC credential all read the *same ICAO-9303 chip*. One passport can produce four
   "independent" credentials. And app-scoped nullifiers make it **cryptographically impossible for us
   to detect the duplication**. We must deduplicate by trust root as a design rule, not by observation.
   → [zk-passport-and-eid.md](protocols/zk-passport-and-eid.md)

4. **We are not first.** Human Passport calls itself "the first aggregate Proof of Personhood
   solution" and claims 120+ projects and $430M secured. Billions and idOS are adjacent. In web2,
   Alloy orchestrates 270+ vendors. Our differentiation has to be *credential quality* — cryptographic,
   on-chain, permissionless roots — not aggregation itself.
   → [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md)

5. **Aggregated scoring measurably works.** Gitcoin's fraud tax fell from **6.6% of the pool to about
   0.6%** after deploying identity scoring. That is the strongest evidence this project has value, and
   it is also the right evaluation metric.
   → [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md)

6. **Threshold detection misses small farms.** Arbitrum's rules "were not effective in preventing
   Sybils with fewer than 20 addresses." Per-identity credentials beat cluster detection — which is
   our thesis, now with evidence.
   → [sybil-incidents-and-antipatterns.md](landscape/sybil-incidents-and-antipatterns.md)

7. **Government credentials are arriving, and they are linkable.** EUDI wallets are mandated by end of
   December 2026, but the shipping design is salted-hash selective disclosure whose issuer signature
   is a static correlator. Longfellow ZK is the bridge to fixing that, and it already lives in the EU
   wallet's own GitHub org.
   → [government-standards-track.md](landscape/government-standards-track.md)

8. **Cost anchors, finally.** KYC verification runs **$1.35–1.85**; Civic charges **$0.05 per active
   pass per month**. The strong cryptographic routes (PoH v2, Circles, ZKPassport on-chain) are cheaper
   *and* more private than the incumbent — which is the commercial argument.
   → [kyc-vendors-and-web2-signals.md](landscape/kyc-vendors-and-web2-signals.md)

9. **Independent failure modes are the whole point.** Kleros arbitration fails to bribery; Circles and
   BrightID to graph collusion; Idena to breaking physical synchrony; documents to chip cloning; World
   ID to iris spoofing. Those are genuinely unrelated, which is the mathematical justification for
   aggregating. Document-derived credentials are the opposite case and must be collapsed.

## Where to publish our own output

Three complementary options, not competing ones — see
[attestation-substrates.md](landscape/attestation-substrates.md):

- **Circles group membership** — Gnosis-native, expiry semantics built in, readable by any Gnosis
  protocol, near-zero new infrastructure. [`poh-group-setup`](https://github.com/aboutcircles/poh-group-setup)
  already demonstrates the pattern with Kleros PoH.
- **EAS attestation** — free, multichain, already indexed, same rails as Coinbase and Passport.
  Open question: is EAS deployed on Gnosis Chain?
- **iden3 verifiable credential** via a self-hosted `issuer-node` — the privacy upgrade path.

## Reading order for someone new

1. [BRIEF.md](BRIEF.md) — the research standard these were written against
2. [scoring-and-prior-art.md](landscape/scoring-and-prior-art.md) — what everyone else does
3. [poh-classics.md](landscape/poh-classics.md) and [circles.md](protocols/circles.md) — the two Gnosis-native routes
4. [sybil-incidents-and-antipatterns.md](landscape/sybil-incidents-and-antipatterns.md) — what goes wrong
5. [SALVAGE-STATUS.md](SALVAGE-STATUS.md) — what we still don't know
