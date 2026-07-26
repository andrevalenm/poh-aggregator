# @printid/sdk

Ask which proof-of-personhood credentials an address holds, and — the part that matters — **how
many independent trust roots those credentials actually rest on.** One call, every chain the
probes read, and you get the evidence back rather than a number on its own.

One passport read by four protocols is one credential, not four. That is the whole idea.

The client holds no user state and talks to no server of ours. The ontology comes from a
public registry, credentials come from public chains, and scoring happens in your process.
That is deliberate: an aggregator that collected credentials centrally would become the one
party able to link somebody's World ID, passport proof and social graph — exactly the
correlation those protocols exist to prevent.

## Install

```bash
npm install @printid/sdk
```

## Use

```ts
import { Print, Thresholds } from '@printid/sdk'

const print = new Print({
  // Optional. Supplies issuance dates (which unlock age decay) and trust-graph position.
  // Without it the SDK degrades to bare contract reads and says so in the caveats.
  subgraphUrl: 'https://api.studio.thegraph.com/query/77602/poh/version/latest',
})

const result = await print.resolve('vitalik.eth')

result.independentRoots           // how many unrelated things had to be true
result.roots                      // each one named, with what was folded into it
result.evidence                   // every probe, held or not, with provenance
result.caveats                    // part of the answer, not a disclaimer

result.score                      // log10 of what an adversary would pay, in cents
result.isHuman(Thresholds.strict) // you pass the threshold — see below
```

Real people are plural, so `resolve` takes a set as readily as a single subject. Credentials
held on different addresses by one person are scored together, and correlated credentials
saturate *across* the set — listing more wallets cannot inflate a score.

```ts
await print.resolve([poHWallet, circlesAvatar, coldStorage])
```

If the subject is an ENS name, its `print.subjects` text record expands the set
automatically: a person declares their own wallets somewhere user-controlled, on-chain and
revocable, and nobody has to hold that mapping on their behalf.

## Why roots come first

The registry catalogues 30 adapters over **18 trust roots** (revision 34, 2026-07-25), and ten of
them are implemented as live probes. Protocol count is not evidence count. World's document tier,
ZKPassport, Self and Rarimo are all reading the same passport chip; Galxe Passport and Linea PoH
are both reading one Sumsub decision. Count credentials and a farm with one document and four
integrations outranks a person holding a passport, a social graph and a bank check.

So the SDK collapses credentials to their trust root before it weighs anything: the strongest
credential in a root counts, the rest are reported as folded under a
`correlated-evidence-saturated` caveat naming them. This needs no cross-protocol linkability,
because correlation is a property of the credential *class* — that those two protocols read the
same root is a public fact about the world, not something we have to learn about you.

**What separates a farm from a person is rarely cost.** A passport is genuinely expensive, so a
subject holding four passport-derived credentials can outscore a subject holding four unrelated
ones and the model will say so rather than pretend otherwise. What inverts is the root count: one
against four. Gate on `independentRoots` and the score becomes what it should be — a measure of
how much the evidence is worth, not the verdict.

## There is no default threshold, on purpose

`isHuman()` throws without one. At a plausible sybil rate even a strong classifier misjudges
most of the people it flags, so the decision to deny somebody belongs to whoever bears the
cost of being wrong — a dating app and an airdrop are not drawing the same line. Anyone
shipping a default is hiding the base rate from you.

Presets ship as documented constants, with their derivations:

| | Score | Clears on |
|---|---|---|
| `Thresholds.lenient` | 1.5 | any single live credential |
| `Thresholds.standard` | 2.5 | a mid-cost credential, or several weak independent roots |
| `Thresholds.strict` | 3.5 | a strong credential plus independent corroboration |

A root count is often the better policy, and it is a plain comparison:

```ts
result.independentRoots >= 2      // the rule print.observer applies, and discloses
```

Two roots is a line somebody chose. Choose your own, and say which one you chose.

## What it does not claim

Every result carries its caveats, and they are part of the answer:

- No protocol here proves the subject controls their own credentials.
- Address sets declared through ENS are self-asserted and have not been countersigned.
- A network failure reads as `indeterminate`, never as "no human". Absence of evidence is
  reported as absence of evidence.
- Most catalogued adapters are not probed — twenty of thirty at revision 34 — because they are
  gated behind a vendor, off-chain, discontinued, or unreadable by design: ZKPassport scopes its
  nullifier per service and never publishes an unscoped value, so nobody can look a holder up
  unsolicited, and that is the privacy property working. Their trust roots still count against
  double-counting, but the credentials are invisible to us, so a subject can hold more evidence
  than we report.

## Also in here

`fleet.ts` and `ens-agents.ts` cover agent accountability — an agent's ENS name declaring the
human behind it, the human's name acknowledging it back, and per-human caps that hold up when
the operator can mint addresses for free. `as-of.ts` reconstructs the ontology at a past
block, so a score can be recomputed against the weights that were actually in force.

---

MIT. Part of [Print](https://github.com/andrevalenm/poh-aggregator) — scoring model in
[`docs/scoring.md`](https://github.com/andrevalenm/poh-aggregator/blob/main/docs/scoring.md),
threat model in
[`docs/threat-model.md`](https://github.com/andrevalenm/poh-aggregator/blob/main/docs/threat-model.md).
