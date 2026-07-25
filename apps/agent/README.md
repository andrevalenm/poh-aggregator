# Human-backing verification for agents

**Corroborate × World AgentKit.** An agent asks a counterparty to transact. The counterparty
will not deal with it until a real human is shown to stand behind it. This is that check,
running end to end against live World Chain state, live Gnosis state, and the live World ID
4.0 relying-party API.

Nothing here scores an agent. There is no reputation, no history, no behaviour model, and the
agent produces no content. The only claim being evaluated is a claim about a **human**: that
one exists behind the credentials this agent presents. Everything the agent itself does —
sign, request, retry — is plumbing for asking that question.

```
npm install
npm start
```

---

## The flow

```
   ┌──────────┐                                   ┌──────────────────────┐
   │  agent   │  POST /order                      │  counterparty        │
   │ "atlas"  │ ────────────────────────────────► │  "Meridian Exchange" │
   │          │                                   │                      │
   │ name +   │ ◄──────────────────────────────── │  402 Payment Required│
   │ wallet   │  402 { extensions.agentkit: {     │  + CAIP-122 challenge│
   └────┬─────┘      info, supportedChains } }    └──────────┬───────────┘
        │                                                    │
        │ agentkit.fetch signs the SIWE challenge            │
        │ with the agent's wallet and retries once           │
        │                                                    │
        │  POST /order   agentkit: <base64 payload>          │
        └──────────────────────────────────────────────────► │
                                                             │
   ╔═════════════════════════════════════════════════════════▼═══════════════╗
   ║  GATE 1   Agent identity                                                ║
   ║           Does the requester control the wallet it claims?              ║
   ║           parseAgentkitHeader → validateAgentkitMessage → verify sig     ║
   ║           binding to resource URI · 5-min freshness · nonce replay       ║
   ╠═════════════════════════════════════════════════════════════════════════╣
   ║  GATE 2   Human-backing                                    ┌──────────┐ ║
   ║           Did a World ID-verified human register it?   ───► │ AgentBook│ ║
   ║           lookupHuman(agentWallet) → humanId | 0            │World Chain│║
   ║                                                            └──────────┘ ║
   ╠═════════════════════════════════════════════════════════════════════════╣
   ║  GATE 3   Evidence — resolved once per HUMAN, not once per agent        ║
   ║           operator's declared address set  ──►  @corroborate/sdk        ║
   ║                                                     │                   ║
   ║      ┌──────────────────────────────────────────────┴───────────────┐   ║
   ║      │  world-id-orb    root iris-registry:world-orb    World Chain  │   ║
   ║      │  poh-v2          root social-vouching:poh        Gnosis       │   ║
   ║      │  circles-v2      root social-trust:circles       Gnosis       │   ║
   ║      └──────────────────────────────────────────────┬───────────────┘   ║
   ║           saturate within a trust root, sum across  │                   ║
   ║           score = log10(adversary cost in cents)  ──┘                   ║
   ╠═════════════════════════════════════════════════════════════════════════╣
   ║  GATE 4   Fleet policy                                     ┌──────────┐ ║
   ║           evaluateFleet(policy, everyAgentThisHuman    ───► │ AgentBook│ ║
   ║                          registered, evidence)             │  history │ ║
   ║           score ≥ 2.5 · ≥ 2 roots · ≤ 1 agent/human        └──────────┘ ║
   ║           every number belongs to Meridian, not to us                   ║
   ║           slots go to the earliest registration; each refusal           ║
   ║           names the sibling that took one                               ║
   ╚═════════════════════════════════════════════════════════════════════════╝
                                     │
                          ALLOW / DENY  +  every caveat, verbatim
```

`npm start` runs four passes through this.

| Run | Agent | What it isolates |
|---|---|---|
| 1 | `atlas`, an ephemeral wallet | Full HTTP round trip with a real signature. Gate 1 **passes** — the agent proves it controls its wallet — and gate 2 **fails**, because controlling a keypair is free and nobody vouched for it. |
| 2 | `mirror`, a wallet a real human registered | All four gates against live chain state. Five independent trust roots, **ALLOW**. It goes first because it is this human's *earlier* registration and the policy gives the slot to the earliest — a rule the chain decides, not the demo. |
| 3 | `beacon`, a *second* wallet the **same** human registered | AgentBook returns an identical `humanId`, so the slot is already taken and the refusal names the wallet holding it. **DENY**. Counting agents would have counted two; counting humans counts one — and the second request cost one lookup rather than ten probes, because evidence is keyed on the person. |
| 4 | the largest fleet in the registry, **found not declared** | AgentBook's whole registration history is scanned and the biggest fleet wins. Today that is **27 agents behind one human**, registered inside 0.7 days. Meridian never met the other 26; it refuses this one because the registry says they exist and that the slot is taken. The trace prints what the policy costs an adversary: **$5.50 a slot**, so 27 slots cost $148.50 with the cap and $5.50 without. |

### The fleet gate, in one paragraph

The cap is enforced over every agent the human has **registered**, not only over the ones that
have asked. A venue that waits to be asked has already served the fleet's first N by the time it
notices; AgentBook's log says so in advance, and reading the whole thing is six `eth_getLogs`
calls. The policy is declared as data in `policy.js` and executed by `evaluateFleet()` in the
SDK — the same function the SDK's 30 unit tests exercise — so what a judge sees on stage is what
is tested. Three properties it holds to: an agent refused on evidence never spends its human's
slot; an unreadable registry produces `indeterminate` rather than either a denial or an
admission; and an agent nobody registered has no identifier for the cap to bind, so the policy
has to *say* what it does with those (`unbackedAgents: 'deny'`) instead of defaulting into
handing one slot per free keypair.

**What the chain cannot do here, measured.** AgentBook and the World ID Address Book issue
nullifiers under different external nullifiers — `38265997…265498` and `377593556…326541`, both
read from their initialisation events, both over Orb group 1 — so the same person is two
unlinkable identifiers across them, and of 150 AgentBook `humanId`s tested against the Address
Book, zero resolve. There is therefore no chain path from an agent to the wallets its operator
holds credentials on. `address-set-not-authenticated` is permanent, and it is permanent because
World's privacy design works. Full derivation:
[`research/protocols/world-agentbook-fleets.md`](../../research/protocols/world-agentbook-fleets.md).

---

## What is real, and what is not

Everything in the table below runs live. There are no mocks and no fixtures standing in for
network calls.

| Component | Status |
|---|---|
| AgentKit 402 challenge / `agentkit` header / SIWE signature | **real**, full HTTP round trip, `@worldcoin/agentkit@0.2.0` |
| Signature verification, message binding, freshness, nonce replay | **real**, `validateAgentkitMessage` + `verifyAgentkitSignature` |
| AgentBook `lookupHuman` | **real**, `eth_call` on World Chain `0xA23aB…944dA` |
| Corroborate resolution: World ID + Proof of Humanity + Circles | **real**, Sepolia registry rev 15, Gnosis + World Chain reads |
| Scoring, saturation, caveats | **real**, `@corroborate/sdk` |
| World ID 4.0 RP signature + proof request + `/api/v4/verify` | **real** — `npm run worldid`, needs a human to answer |

**One gate cannot run for two of the three agents, and the trace says so rather than faking
it.** Registering a wallet in AgentBook requires a World ID-verified human to complete the
ceremony in World App. We had no Orb-verified account on demo night, so runs 2 and 3 use agent
wallets that *other, real* humans registered on World Chain — found by walking AgentBook's
transaction history, verifiable with `npm run agentbook`. We do not hold their keys, so gate 1
is recorded as `SKIP` with the caveat `agent-signature-not-exercised`. Everything downstream
of it is live.

To close that: register a wallet you control and every gate goes green in one path.

```bash
npx @worldcoin/agentkit-cli register <your-agent-address>   # needs World App
AGENT_PRIVATE_KEY=0x... npm start                            # run 1 now ALLOWs
```

The operator address set in runs 2 and 3 is likewise real but asserted, not authenticated —
see `address-set-not-authenticated` in the trace, and "The claim we are not making" below.

---

## The claim we are not making

The SDK emits this on every result and will not let a caller suppress it:

> **`independent-control-not-attested`** — No protocol here proves the subject controls their
> own credentials. A verified unique human may still be operated by someone else, and that is
> not detectable from this evidence.

For an agent, that caveat is not a footnote. It is the boundary of the entire claim.

We verify that a human **exists behind** the agent's credentials. We cannot verify that the
human **controls** the agent — and no protocol today can. AgentBook records that a World ID
human performed a registration ceremony for a wallet; it records nothing about who holds that
wallet's key now, or who is issuing its instructions. A live World ID 4.0 proof narrows the
window but does not close it: a human present at request time may be a paid signer clicking
approve, and on chain that is indistinguishable from an operator approving their own agent.

This is not a limitation we could engineer around with more integrations. It is a property of
the evidence. An open resale market for verified World accounts was documented at $0.50–$15
per account (ZachXBT, 2026-04-28), which is why the scoring model prices every credential at
`min(forge, rent)` rather than at what it costs to create — every protocol that hardened did
so against *sale*, and none against *rental*, because the human stays willing.

So the honest framing of what this demo delivers is: **a counterparty can establish that a
real, unique human is entangled with this agent, and can price how expensive that entanglement
would be to fake — but not that the human is at the controls.** A system that claimed the
second would be lying, and a counterparty that assumed it would be mispricing its risk.

The trace prints the SDK's caveats verbatim, plus the counterparty's own record of what it
chose not to check.

---

## The threshold belongs to the counterparty

`2.5` appears exactly once in this codebase, in `src/counterparty/policy.js`, next to the
reasoning for it. It is not a default, and the SDK does not ship one — `result.isHuman(t)`
throws a `TypeError` if you call it without a threshold, and `FleetPolicy` has no optional
fields, so a policy that has not decided its own limits does not typecheck.

That is deliberate and it is a base-rate argument. At a plausible 2% sybil rate, a
95%-specificity classifier is wrong about roughly three-quarters of the subjects it flags.
Denial is a decision with a victim, and the party bearing the loss is the only party entitled
to set the line. A venue clearing six figures per agent should pick 3.5 and eat the false
negatives; Meridian caps exposure at a few dollars of fee credit, so 2.5 is right for
Meridian and would be wrong for someone else.

The counterparty also demands **two independent trust roots**, separately from the score,
because a score can be reached with one expensive credential and correlated failure is the
failure mode that actually happens. A passport read by World's document tier, ZKPassport and
Self is one passport, not three proofs; the SDK saturates within a trust root and only sums
across them.

---

## Running it

Prerequisites: Node 22+, and `.env.local` at the repo root (already present).

```bash
cd apps/agent
npm install
npm start                 # the three-run demo above, ~30s, live network
```

```bash
npm run agentbook                  # human-backing for the fixtures + recent AgentBook history
npm run agentbook 0xYourAddress…   # …or any address you like
```

```bash
npm run worldid           # live World ID 4.0 proof — needs a human
```

`npm run worldid` prints a QR code and a URI, then blocks for up to five minutes.

* **Staging (default).** Open <https://simulator.worldcoin.org>, paste the printed URI. The
  simulator plays the part of World App.
* **Production.** `WORLD_ENV=production npm run worldid`, then scan the QR with World App.
  This needs a real Orb-verified account. The RP `rp_1db8a6710d795086` is registered on-chain
  for both environments, so this is the only change required — one environment variable, no
  code change. It is carried in the *request body*, not the hostname.

Optional environment overrides, all with sensible defaults: `WORLD_ENV`, `WORLD_ACTION`,
`WORLD_VERIFY_HOST`, `WORLDCHAIN_RPC_URL`, `SEPOLIA_RPC_URL`, `REGISTRY_ADDRESS`,
`AGENT_PRIVATE_KEY`.

---

## Layout

```
src/
  agent.js                  the agent: a name, a wallet, an AgentKit client
  fixtures.js               real on-chain addresses used by the demo, with provenance
  config.js                 everything that differs staging → production
  demo.js                   npm start
  verify-worldid.js         npm run worldid — live World ID 4.0 proof
  agentbook-status.js       npm run agentbook — human-backing lookups
  trace.js                  decision-trace rendering
  world/
    agentbook.js            lookupHuman on World Chain, errors kept distinct from negatives
    worldid.js              RP signing, proof request, /api/v4/verify
  counterparty/
    server.js               the 402 challenge and the AgentKit verification
    policy.js               the counterparty's FleetPolicy — every number it owns
    decide.js               the four gates; gate 4 delegates to evaluateFleet()
    corroborate.js          @corroborate/sdk lookup
```

---

## What we learned about the World APIs

Written down because none of it is in the docs, and all of it cost time.

**`POST /api/v4/verify/{rp_id}` takes no credentials.** The OpenAPI spec declares
`security: []` and it is accurate — the RP is named in the path and the proof carries its own
authenticity. No `Authorization` header, no developer API key. Confirmed by sending a
well-formed v4 body with a deliberately invalid proof:

```
POST https://developer.world.org/api/v4/verify/rp_1db8a6710d795086
{"protocol_version":"4.0","nonce":"0xabab…","action":"verify-personhood",
 "environment":"staging","responses":[{"identifier":"proof_of_human","issuer_schema_id":1,
 "nullifier":"0x1111…","expires_at_min":49012345,"signal_hash":"0x0",
 "proof":["0x111","0x222","0x333","0x444","0x555"]}]}

→ 400 {"success":false,"code":"all_verifications_failed",
       "detail":"All proof verifications failed.",
       "results":[{"identifier":"proof_of_human","success":false,
                   "code":"verification_failed",
                   "detail":"execution reverted (unknown custom error)"}]}
```

The request shape, the path, and the RP id are all accepted; only the fake proof is rejected.

**Do not use `staging-developer.worldcoin.org` for a v4 RP.** It is listed as the staging
server in the OpenAPI document, but the same request there returns:

```
→ 400 {"code":"app_not_migrated",
       "detail":"This app has not been migrated to World ID 4.0. Please use the v2 verify endpoint.",
       "app_id":"rp_1db8a6710d795086"}
```

Staging is selected by `environment: "staging"` in the **body**, against
`developer.world.org`. That is what `WORLD_VERIFY_HOST` defaults to.

**`@worldcoin/idkit-core@4.2.2` cannot initialise under Node without a shim.** It loads its
WASM with `fetch(new URL('idkit_wasm_bg.wasm', import.meta.url))`. In a browser that resolves
to an HTTP URL; under Node it is a `file:` URL, and Node's `fetch` refuses the `file:` scheme:

```
Error: Failed to initialize IDKit WASM: TypeError: fetch failed
    at node_modules/@worldcoin/idkit-core/dist/index.js:2234:13
```

The `.wasm` is present in the package, so `src/world/worldid.js` wraps `globalThis.fetch` to
read `file:` URLs from disk. Twelve lines, and it makes the whole server-side flow work. This
is an upstream packaging bug, not a protocol problem — the fix upstream is to read the file
directly when `process.versions.node` is set.

**`.preset()` and `.constraints()` take different things.** `IDKit.request(…).preset(…)` wants
a preset object (`proofOfHuman()`, `orbLegacy()`, …). Passing `any(CredentialRequest(…))` —
which is what the 4.0 migration guide shows for *sessions* — fails with
``Invalid preset: Error: missing field `type` ``. Constraint trees go to `.constraints()`.

---

## SDK friction

Reported rather than silently patched.

**`@worldcoin/agentkit`**

1. **`createAgentBookVerifier().lookupHuman()` swallows RPC errors and returns `null`.** A
   transport failure becomes indistinguishable from "no human backs this agent" — a network
   blip renders as an accusation. `src/world/agentbook.js` reads the same contract with the
   same ABI and keeps `unknown` distinct from `unbacked`; the counterparty refuses rather than
   guessing. Suggested fix: throw, or return a discriminated result.

2. **`checkNonce` and `AgentKitStorage.hasUsedNonce` have opposite polarity.**
   `validateAgentkitMessage({ checkNonce })` expects `true` when the nonce is *acceptable*;
   `hasUsedNonce` is documented to return `true` when the nonce has *already been seen*. The
   docs describe `checkNonce` only as "optional replay validation hook", so the natural reading
   is the wrong one — and getting it backwards rejects every honest request as a replay, with
   the message `Nonce validation failed (possible replay attack)`. Cost us a debugging cycle.

3. **`domain` is compared against `hostname`, not `host`.** CAIP-122 defines the domain as the
   authority, port included. `validateAgentkitMessage` compares `payload.domain` to
   `new URL(resourceUri).hostname` while comparing `payload.uri`'s host to `.host`. Any
   resource server on a non-default port that follows the spec has every signature rejected
   with `Domain mismatch: expected "127.0.0.1", got "127.0.0.1:37411"`.

**`@corroborate/sdk`** — both of these were fixed upstream mid-build by the SDK author; noted
because they are the failure modes to watch for.

4. **Omitting `knownIds`/`knownRoots` used to fail silently and catastrophically.** The
   registry stores ids as keccak hashes; without the plaintext list the ontology map is keyed
   by hash while probes are keyed by name, so every probe hit and every hit was then discarded.
   The result was `score: 0, roots: 0` for a subject holding three live credentials — a
   confident, well-formed, completely wrong answer. Now defaulted from a bundled
   `ontology-data.json`. Silent zero is the worst possible failure shape for a personhood
   score; it should have been a throw from the start.

5. **`DEFAULT_REGISTRY` and the deployed contract must be versioned together.** When the
   registry was redeployed with an extra struct field, the stale address plus the new ABI gave
   `Bytes value "1,96" is not a valid boolean` from `allAdapters()` — an ABI decode error that
   reads like a corrupt RPC. This app now pins nothing and lets the SDK's own default win.

---

## Track fit

World's *AgentKit New Use Cases* track asks for something that **verifies human-backed agents**
with a **working end-to-end flow**. That is precisely and only what this does.

Explicitly out of scope for the track, and absent here: agent reputation (no scoring of the
agent, no history, no behaviour); content generation (the agent generates nothing).

What Corroborate adds on top of AgentKit alone: AgentBook answers *whether* a human backs an
agent, as a boolean. It cannot answer *how much that human's identity would cost to fake*, and
it has one trust root, so an attack on World's iris registry is an attack on every answer it
gives. Corroborate resolves the operator's other credentials across protocols, saturates the
ones that share a trust root, and prices the whole set in adversary cost — turning a boolean
into evidence a counterparty can put a number on and set its own line against.
