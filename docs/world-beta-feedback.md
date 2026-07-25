# World beta testing documentation — Selfie Check & Identity Check

Testing feedback from building Corroborate against World ID 4.0 during ETHGlobal Lisbon
2026. Everything in the developer section was hit directly during this build; nothing is
speculative. App `app_bbbec994f8bf39c2bad8d57d4b2be0d2`, relying party
`rp_1db8a6710d795086` (production + staging, both registered on-chain), action
`verify-personhood`.

## How World ID is used here

Corroborate aggregates personhood credentials across protocols and scores them by
independent trust root. World ID enters three ways:

1. **AgentBook, permissionlessly** — `lookupHuman(address)` on World Chain is our
   highest-weight uniqueness signal and needs no relying-party id at all.
2. **World ID 4.0 verify flow** — `apps/agent` runs the full 4.0 flow: `signRequest` with
   the RP signing key, `IDKit.request`, QR handoff, poll, `POST /api/v4/verify/{rp_id}`.
3. **Data minimization by architecture** — we consume *assertions*, never attributes. For
   Identity Check specifically: the aggregator's scoring needs only "a state-issued
   document was verified", so no document fields are requested. This is our answer to the
   track's attribute-necessity question: the necessary attribute set is empty.

## Developer feedback (all first-hand)

### What was genuinely good

- **The developer-portal MCP is the best provisioning experience we used all night.**
  App creation, World ID 4.0 RP registration (with the on-chain transaction handled
  server-side), action creation and status checks — all scriptable, all idempotent to
  retry. Provisioning an RP took under two minutes with no dashboard visits.
- **`/api/v4/verify/{rp_id}` needing no auth header** (`security: []`) is the right
  design — verification should not require a secret, and it means our verify path holds
  no credential that could leak.
- The signer-key-returned-exactly-once policy is sharp but correct, and clearly warned.

### Friction, in descending order of cost to us

1. **`staging-developer.worldcoin.org` is a trap for v4 RPs.** It returns
   `app_not_migrated` for an RP created via the v4 flow. Staging is actually selected by
   `environment: "staging"` in the request body against `developer.world.org`. One
   sentence in the v4 docs would have saved an hour.
2. **`@worldcoin/idkit-core@4.2.2` cannot initialize under Node** — it loads its WASM via
   `fetch(file://…)`, which Node rejects. We shim `fetch` for `file:` URLs (12 lines,
   `apps/agent/world/worldid.js`). Agents and server-side verifiers are exactly the 4.0
   audience, so Node support seems worth a CI job.
3. **`user_presence_completed` appears to be a payload field rather than a proven claim.**
   For an aggregator, presence is what separates "credential" from "rented credential"
   (Orb accounts resell from $0.50, which is why our model prices Orb at its rental floor).
   A signed presence claim in the proof itself would let us weight it honestly.
4. **AgentKit polarity traps** (`@worldcoin/agentkit`): `checkNonce` and
   `AgentKitStorage.hasUsedNonce` have opposite boolean polarity, and `domain` is compared
   against `hostname` while `uri` is compared against `host` — a spec-compliant server on
   a non-default port fails with `Domain mismatch`. Both cost real debugging time.
5. **`createAgentBookVerifier().lookupHuman()` swallows RPC errors into `null`**, making
   a network blip indistinguishable from "no human backs this agent". We read the
   contract directly instead, keeping `unknown` distinct from `unbacked` — the difference
   between "retry later" and "deny a human".
6. `@worldcoin/agentkit@0.2.0` ships without a license field; idkit is MIT.

### Suggestions

- Document the v4 staging selection explicitly next to the `rp_id` docs.
- Ship a Node-compatible WASM loader (or document the shim).
- Consider a signed presence claim (see 3) — it would materially change what a
  third-party verifier can honestly conclude from a proof.
- Publish `/api/v4/verify` rate limits; we found none documented.

## User feedback

Developer-side flow validation used the World ID Simulator against the staging RP
(`npm run worldid` in `apps/agent` prints the live QR / connector URI).

**[TO COMPLETE ON DEVICE — Hugo, morning]** Real-device pass for both tracks:

- [ ] Selfie Check via World App on the live QR: time-to-complete, retry behaviour,
      clarity of the consent copy, what a non-crypto user would make of it.
- [ ] Identity Check (needs a passport + NFC): read reliability, how the data-sharing
      screen communicates which attributes leave the device, whether "share nothing but
      the assertion" is offered plainly.
- [ ] The failure path: decline mid-flow and record what the requesting app sees — for
      escalate-don't-deny logic, distinguishing "declined" from "failed" matters.

## Data-minimization statement (Identity Check track requirement)

Corroborate requests **no document attributes**. The scoring model consumes the assertion
"a state-issued document was verified for this subject" as one credential on the
`state-document:icao-9303` trust root — where it is deliberately *saturated* against
ZKPassport, Self and every other credential reading the same chip, because one passport
presented through N protocols is one piece of evidence, not N. Requesting attributes would
add linkability risk while adding zero scoring information; the correct attribute set for
this use case is empty, and that is an argument we would make to any verifier.
