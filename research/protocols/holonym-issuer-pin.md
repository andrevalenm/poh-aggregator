# Holonym / Human ID — the issuer pin, and the person it refuses

**Researched 2026-07-26.** Sources: `publicValues[4]` read live from OP Mainnet, two ways — decoded
from the calldata of real mint transactions across the Hub's entire life, and read back through
`getSBT` from live credentials at head — against `mainnet.optimism.io`, `optimism.drpc.org` and
`gateway.tenderly.co/public/optimism`, at head 154,715,906. The pinned constants themselves come
from `holonym-foundation/id-server` `src/constants/misc.ts` and `holonym-foundation/holonym-api`
`src/constants/misc.js`, transcribed 2026-07-25.

Answers open question 2 of [holonym-signed-not-proven.md](holonym-signed-not-proven.md): *is the
issuer key in `publicValues[4]` itself rotatable, and would we see it?* The short answers are **yes,
silently, at the protocol's discretion** and **now, yes** — and the more interesting finding is not
about the key at all but about what our own probe did to a person it refused.

Extends [holonym-human-id-onchain-read.md](holonym-human-id-onchain-read.md) §"Presence is not
enough" and [holonym-signed-not-proven.md](holonym-signed-not-proven.md), neither of which is
corrected by this file.

---

## 1. Why the pin is load-bearing, and why it is exposed on two sides

`Hub.setSBT` runs no proof verification — established in the previous write-up — so a circuit id is
not a claim about anything. Anyone may run an issuer key, get a credential signed under it, and have
it minted under the same `circuitId` a real government-ID check uses. The contract says so in its
own source:

> *make sure you check the public values such as actionId from this. Someone can forge a proof if
> you don't check the public values, e.g., by using a different issuer or actionId*

`publicValues[4]` is that check, and it is the *only* thing separating a real Holonym credential
from a self-signed one. The probe pins two values:

| adapter | circuit id | pinned issuer |
|---|---|---|
| `holonym-gov-id` | `0x729d660e…120b` | `0x03fae82f38bf01d9799d57fdda64fad4ac44e4c2c2f16c5bf8e1873d0a3e1993` |
| `holonym-biometrics` | `0x0b512122…3d15` | `0x0d4f849df782fb9e68d525fbda10b73e59180e59cb2a21ce5d70ccc45dbfd922` |

Both are Poseidon hashes of EdDSA public keys — 254 bits wide, which is why they are compared
numerically and never as strings; the gov-id key is exactly the kind that starts with a zero byte,
and a rendered comparison that dropped it would refuse every gov-id credential on the chain.

**Nothing on chain declares either value.** They were copied out of Holonym's repositories. That
leaves two failure directions and they are not symmetric:

- **Too wide** — we accept a key that is not Holonym's — counts a forgery. Nothing in this file
  closes that, and nothing on chain can: it is a fact about a value copied from a source we chose to
  trust, and the same is true of every issuer pin in this package.
- **Too narrow** — Holonym rotates or adds an issuing key and we do not — refuses **real people**,
  one at a time, for as long as it takes somebody to notice. This is the direction the chain speaks
  to, because every credential carries the issuer that signed it, and it is the direction the probe
  was blind in.

## 2. The defect this found, which is ours and not Holonym's

`interpretSbt` returned, for a subject holding a live SBT under an unrecognised issuer:

```ts
return { held: false, detail: { sbt: 'issuer-mismatch', issuerInProof, expectedIssuer } }
```

`held: false`, no note, no caveat. `detail` is carried on the evidence, but nothing in the score's
caveat vocabulary said a word about it — so from outside, **a refused credential and no credential
at all are the same result**. The subject sees a lower score and no reason for it. Whoever is
reading the score sees an address with nothing to show. And if the protocol has rotated its issuing
key, the refusal is *ours*, not the holder's, and the aggregator quietly reports a real human as
having done nothing.

That is the same class of bug this repo has fixed twice before — index lag silently moving a score,
a stopped Circles avatar read as a revocation — arriving from a new direction: not a wrong answer,
but a **correct answer that says nothing about the evidence it threw away**. Every other `held:
false` this adapter can produce means the subject holds nothing. Exactly one means the subject holds
something we chose not to count, and that one must not look like the others.

Two changes follow, and neither moves a score today:

1. `credential-issuer-not-recognised` — a provenance note on the refusal, and the one caveat in
   `scoring.ts` that is **not** filtered on `held`, for the same reason `index-cannot-see-endings`
   is not: a subject who loses a trust root to a decision of ours is owed the reason.
2. The census below, so the caveat can say *which* keys are actually in use rather than only that
   this one is not ours.

## 3. The census: what live credentials are actually carrying

Take the Hub's recent mints — an ERC-721 `Transfer` from the zero address names the holder — and
read `getSBT(holder, circuitId)` back at head for each scored circuit. The result is a tally of the
issuer keys **live credentials of that class are carrying right now**, from the same public value
the probe pins.

Measured 2026-07-26, over a 30,000-block window (~17 hours), repeated three times:

```
holders 9   credentials 10   discriminates true   439–540 ms
  holonym-gov-id       0x03fae82f…1993  n=6      <- pinned
  holonym-biometrics   0x0d4f849d…d922  n=4      <- pinned
```

One `eth_getLogs` per 10,000-block chunk plus one `multicall`: four round trips, half a second, once
per process, and **only when a subject holds or is refused a credential** — a subject with no SBT
has no issuer to corroborate, and that is most subjects.

### Cost, measured against the parent commit

Same live gov-id holder (`0xb8e2fcdf…c9a5`, found from the chain at run time), two processes each:

| | parent | this commit |
|---|---|---|
| holder, cold | 752 / 784 ms | 797 / 1003 ms |
| holder, warm | 141 / 158 ms | 132 / 142 ms |
| no credential | 48 / 57 ms | 46 / 56 ms |

The census is ~450 ms of work and costs ~50–220 ms, because it is issued in the same `Promise.all`
as the signing-authority sweep and mostly hides behind it. Warm and no-credential paths are
unchanged, which is the point: the check is paid for by the subjects it is about.

## 4. The timeline: one key per circuit, from the constructor to head

The census is a window. The question *has this key ever been different* needs the whole history, and
`getSBT` cannot answer it — the function reverts once a credential expires, so the issuer of an
expired SBT survives only in the transaction that minted it. So the live suite decodes calldata
instead: ten windows of 30,000 blocks spread evenly from the Hub's deployment block (115,616,235) to
head, every mint transaction in each decoded through `setSBTBatch` or `setSBT`.

Measured 2026-07-26 (windows summarised; the suite re-derives all of it every run):

| window start | date | `gov-id` | `biometrics` | `phone` |
|---|---|---|---|---|
| 115,616,235 | 2024-02-01 | `03fae82f…` ×4 | — | `0040b881…` ×2 |
| 119,957,237 | 2024-05-12 | `03fae82f…` ×20 | — | — |
| 124,298,239 | 2024-08-20 | `03fae82f…` ×6 | — | `0040b881…` ×14 |
| 128,639,241 | 2024-11-29 | `03fae82f…` ×20 | — | — |
| 132,980,243 | 2025-03-09 | `03fae82f…` ×14 | — | `0040b881…` ×6 |
| 137,321,246 | 2025-06-18 | `03fae82f…` ×20 | — | — |
| 141,662,248 | 2025-09-26 | `03fae82f…` ×13 | `0d4f849d…` ×1 | `0040b881…` ×6 |
| 146,003,250 | 2026-01-06 | — | — | `0040b881…` ×1 |
| 150,344,252 | 2026-04-15 | `03fae82f…` ×8 | `0d4f849d…` ×3 | `0040b881…` ×1 |
| 154,685,254 | 2026-07-25 | `03fae82f…` ×7 | `0d4f849d…` ×3 | `0040b881…` ×2 |

**Every `gov-id` mint in every era carries the pinned key. Every `biometrics` mint in every era
carries the pinned key.** A denser sweep at head — 200,000 blocks, 104 mint transactions, the
largest sample taken — agrees exactly: 55 gov-id, 32 biometrics, 17 phone, one issuer each.

So the pin was right, and it is now a measurement rather than a transcription. As with the two term
timelines and the signer sweep before it, nothing at head moves — the point is that an assumption
becomes a check that runs.

### The control, which is free

A pin that matched everything would be worth nothing, so both the census and the timeline have to
show that `publicValues[4]` **discriminates**. It does, and the evidence costs no extra call: the
two scored circuits carry different keys from each other in every window, and the Hub's unscored
`phone` circuit carries a third (`0x0040b881…30a4`) throughout. The field varies by credential
class, so a match is information. `IssuerCensus.discriminates` reports it per run and the timeline
test asserts no key appears on two circuits.

## 5. What this cannot see

**A window, not a history — at probe time.** An issuer used only for credentials that have since
expired does not appear in the census. So `uncorroborated` never means "the pin is wrong", only "the
chain did not confirm it this run", and a sparse class produces it routinely. It is the rule the
rest of the package runs on: an unread source may never be turned into a claim about a person, in
either direction.

**Samples, not a proof, in the timeline.** Ten windows of 30,000 blocks is 300,000 of 39.1M — a key
used for a single era between two windows would be missed. The same shape of hole as the signer
sweep's, and for the same reason: there is no event. Unlike the signer slot, though, an issuer
*rotation* would have to affect a run of mints to be worth anything to anybody, and a run that
touches none of ten evenly spaced windows is a run that issued to almost nobody.

**The too-wide direction is untouched.** If the transcribed constants were wrong when we copied
them, everything above corroborates the wrong key beautifully. The only defence is that the values
came from Holonym's own published source, and the only improvement would be Holonym publishing them
on chain, which they do not.

## 6. A transport trap, because it was silently in force already

viem's `getLogs` **action** builds its filter from `event` / `events` / `args` and destructures
nothing else. A caller-supplied `topics` array is **silently dropped** and the request goes out
unfiltered (viem 2.55.8, `actions/public/getLogs.js` — `topics` is a local initialised to `[]`).

It fails by *answering*. Over blocks 154,700,000–154,709,999, identical ranges:

```
client.getLogs({ …, topics: [TRANSFER, ZERO] })   -> 2 logs, topic0s: 0xddf252ad, 0xf8e1a15a
client.request({ method: 'eth_getLogs', … })      -> 1 log,  topic0s: 0xddf252ad
```

The second topic0 is not a `Transfer` at all. Every production `eth_getLogs` in this repo already
goes through raw JSON-RPC (`agentbook.ts`, `world-term.ts`, `ens-agents.ts`) so nothing shipped was
affected — but two reads in `holonym.live.test.ts` used the action:

- `recentMints()` asked for mint `Transfer`s and was handed **every** log the Hub emitted, then
  filtered by attempting to decode each transaction. Harmless, and twice the work.
- The ownership-boundary test asked for one `OwnershipTransferred` in one block and asserted
  `logs.length === 1`. It was being handed every log in that block and **passed because the block
  happens to hold nothing else** — an assertion resting on a coincidence.

Both now use `client.request`, and `mintHoldersFromLogs` re-checks every log's topics client-side
regardless: four topics, the `Transfer` signature, a zero `from`. An endpoint that loosens a filter
cannot put a stranger into a census of who was issued a credential.

## 7. A second trap, in `multicall`

`allowFailure: true` swallows the **transport**. A rate-limited `eth_call` comes back as every entry
`status: 'failure'` carrying the same HTTP error, the promise *resolves*, and the endpoint rotation
never fails over — so a throttled `mainnet.optimism.io` reads as a registry in which nobody holds
anything. This is not hypothetical; it is how the census failed on its first live run, silently, as
`uncorroborated`.

A multicall is one `eth_call`, so the batch either executed or it did not: if nothing in it
succeeded, the read is refused and another endpoint gets it. The cost is that a window sparse enough
that no sampled holder still holds anything is refused along with it, and the census answers
`undefined` where it could have answered "nothing to see". Erring towards the unread reading is the
direction that cannot manufacture a false confirmation.

## 8. What the score now says

| state | note | caveat filtered on `held`? |
|---|---|---|
| pin is the only issuer observed | *(silent)* | — |
| pin in use, another key also in use | `attestation-issuer-unpinned-in-use` | no |
| class observed, pin not among its issuers | `attestation-issuer-unpinned-in-use` | no |
| class unobserved, or census failed | `attestation-issuer-uncorroborated` | yes |
| this subject's SBT is refused | `credential-issuer-not-recognised` | **no** |

`detail` carries `issuerPin`, `issuerPinStatus`, `issuerPinObserved`, `issuerPinMatching`,
`issuerCensusFromBlock`, `issuerCensusHolders`, `issuerCensusDiscriminates` and, where relevant,
`unpinnedIssuers` — so the caveat's claim is checkable from the same result.

## 9. How the refusal path is tested, given that it has never happened

A path that has never run is not a path — the same argument that pointed the signer sweep's
bisection at slot 0. `holonymAdapters({ credentials })` makes the pin injectable, so the live suite
takes a **real, live, currently-held** gov-id credential on OP Mainnet and probes it against a pin
one bit away from the true issuer (`issuer ^ 1n`). That is precisely what an upstream rotation would
look like from in here: same read, same holder, a key we do not have. The test requires

- `held: false` with no `error` — a refusal is a verdict, not a failed read;
- `credential-issuer-not-recognised` in the notes;
- the census to have landed on `pin-not-in-use` and to **name the real issuer** among
  `unpinnedIssuers`.

Nothing in it is written down: the holder is found from the chain each run and the "wrong" pin is
derived from the right one.

## 10. Open questions

1. **Should an unrecognised issuer be worth anything at all?** Today it is worth zero and a
   sentence. There is an argument that a credential under an unknown key with broad current usage is
   weak evidence rather than none — but it is evidence of an unpriced root, and the ontology has no
   entry to hang it on. Left at zero deliberately.
2. **The `actionId` is reported and never required.** `HOLONYM_DEFAULT_ACTION_ID` is the only value
   observed on chain across every sample taken so far, and uniqueness is scoped *per action* — so
   two credentials under different action-ids are two uniqueness slots for one human. The census
   machinery could tally action-ids at no extra cost and say whether that has ever happened.
3. **The same pin exists in `human-passport.ts` and `coinbase.ts`.** Both pin an attester read from
   documentation rather than from the chain, and neither has a census. Whether the pattern here
   generalises is the obvious next question; `passport-attester-pin.md` records what those pins are.
