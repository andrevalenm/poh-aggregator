# @printid/sdk

Ask whether a real person is behind an address, across ~40 proof-of-humanity protocols on
four chains, in one call — and get back the evidence rather than a number on its own.

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

## Why scores, and why roots first

Forty protocols collapse to about nineteen real trust roots. World's document tier,
ZKPassport and Self are all reading the same passport chip — one document read three times is
one credential, not three. Add them up naively and a farm holding four passport-derived
credentials outranks a person holding a passport, a social graph and a bank check.

So the SDK collapses credentials to their trust root first, prices what each would cost an
adversary to forge or *rent*, and takes the cheaper of the two. What separates a farm from a
person is rarely raw cost — a passport is genuinely expensive — it is independence.

## What it does not claim

Every result carries its caveats, and they are part of the answer:

- No protocol here proves the subject controls their own credentials.
- Address sets declared through ENS are self-asserted and have not been countersigned.
- A network failure reads as `indeterminate`, never as "no human". Absence of evidence is
  reported as absence of evidence.

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
