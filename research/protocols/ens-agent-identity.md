# ENS as the carrier of agent identity

*Written 2026-07-25 while implementing `packages/sdk/src/ens-agents.ts`,
`scripts/ens-agents-setup.mjs` and `apps/agent/src/ens-demo.js`. Companion to
[`world-agentbook-fleets.md`](world-agentbook-fleets.md), which answered the same question —
how many of the agents in front of a counterparty are one person — using a registry where the
identifier comes out of a zero-knowledge proof. This file is about what changes when the
identifier is **self-published** instead, which is the only kind ENS can offer, and what has to
be added to make a per-human cap survive that.*

Every measurement below was taken on 2026-07-25 against Sepolia, keyless except for the
transactions the burner deployer signed.

---

## 1. Sepolia `.eth` registration is live, free, and instant

The previous attempt at this ([`b33e5d6`](../../MORNING.md), "Needs you" item 2) concluded that
Sepolia ENS was mid-migration and unusable: *"the ens-contracts artifact controller is deployed
but `controllers()` = false on the canonical registrar, no `ControllerAdded` or `NameRegistered`
events found in recent history."* Two of those three observations were correct about the wrong
contract, and the third was a hash mistake. Read from the chain instead:

| what | value | how it was established |
|---|---|---|
| ENS registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` | same on every network; `owner(namehash("eth"))` answers |
| BaseRegistrar | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` | `ENSRegistry.owner(namehash("eth"))` |
| registrar controller | `0xdf60C561Ca35AD3C89D24BbA854654b1c3477078` | the `to` of all 13 registrations in the last 10k blocks; `BaseRegistrar.controllers(…)` → true |
| resolver the ENS app sets | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` | 5 of 13 recent registrations passed it; Sourcify exact match `PublicResolver` |

The event topic is the detail that hid the whole thing:
`keccak256("NameRegistered(uint256,address,uint256)")` is **`0xb3d98796…70d9`**. Searching for
any other value returns nothing and looks exactly like a dead registrar. There were **13
registrations in the 10,000 blocks** before this was written — roughly one every two hours.

Sourcify has the controller verified, exact match, and it is not the mainnet controller at all:

> `TestnetV1PremigrationRegistrar` — *"Free testnet-only v1 registration controller that
> immediately reserves names in ENSv2."*

`register((string label, address owner, uint256 duration, bytes32 secret, address resolver,
bytes[] data, uint8 reverseRecord, bytes32 referrer))`, selector `0xef9c8805`, confirmed by
brute-forcing candidate signatures against the observed calldata. **No commit/reveal, no price
oracle, no payment** — `_refund()` returns any ETH you send. Minimum 28 days and ≥3 characters.
It registers in ENSv1 and simultaneously reserves the label in the ENSv2 `.eth` registry, which
is what "premigration" means.

So: `corroborate.eth` on Sepolia, registered in one transaction, expires 2027-07-25. The mainnet
name is still Hugo's call and still costs money; nothing in the SDK depends on which network the
name lives on.

### 1.1 The controller cannot set your records, and the revert says nothing

The struct carries `bytes[] data` for resolver calls, forwarded through
`multicallWithNodeCheck` — the atomic path, and the obvious way to register with records
already set. It reverts, with **no reason data at all**.

The cause is in the controller's own verified source. `_registerV1` calls
`ENS_REGISTRY.setRecord(namehash, registration.owner, …)` — handing ownership to the registrant
— and *then* calls the resolver. PublicResolver authorises writes on registry ownership, so by
the time the multicall lands, the caller is no longer the owner. `multicall` bubbles the inner
failure through a bare `require`, which is why nothing comes back.

Confirmed by simulation rather than by reading alone: `eth_call` of `setText` on our own node
succeeds `from` the node owner and reverts `from` the controller address.

The consequence for anyone building on this is small but real: **a name is briefly live without
its records**. `ens-agents.ts` therefore treats a missing `corroborate.human` as "this is not an
agent name" rather than as an error.

## 2. The records

```
corroborate.eth                addr                 → the human's primary wallet
                               corroborate.subjects → every wallet the human declares
                               corroborate.agents   → the agent names the human acknowledges
alpha.corroborate.eth          addr                 → that agent's wallet
                               corroborate.human    → corroborate.eth
```

`corroborate.subjects` already existed (`resolveSubject()`, iteration ~0). `corroborate.human`
is the agent→human direction the ENS-for-agents track asks for. **`corroborate.agents` is the
one this work added, and §4 is the argument for why it is not optional.**

## 3. A tree can be counted, but not named

Subnames are created with `setSubnodeRecord(parentNode, labelhash, …)`. The label is hashed by
the caller; the string appears in **no** transaction field, event or storage slot. So:

- **Enumeration works.** `NewOwner(bytes32 indexed node, bytes32 indexed label, address owner)`
  filtered on the parent node gives every subname's hash, owner and creation block. Measured on
  our tree: 3 subnodes, blocks 11,348,909 / 11,348,912 / 11,348,915, all owned by the deployer.
- **Naming does not.** Labels can only be recovered by hashing candidates. `scanNameTree()`
  hashes the names it was handed and reports the remainder as unnamed subnodes.

That is still the useful direction for a counterparty: *being shown two agents and learning from
the registry that the tree holds three* is information the operator did not volunteer. And it
supplies the creation block, which is what lets slot allocation be `earliest-registered` — the
chain deciding which sibling keeps the slot rather than the caller's argument order.

Unlike the AgentBook scanner, this one has **no endpoint canary**, deliberately. There, an
endpoint answering `[]` makes every human look like they run one agent — permissive, and worse
than an error. Here the scan only ever *adds* agents to those already presented, so a truncating
endpoint degrades to "we saw what you were shown". The window is reported and the count is
documented as a lower bound.

Endpoints, measured: `ethereum-sepolia-rpc.publicnode.com` refuses all historical `eth_getLogs`
("Archive requests require a personal token") — the honest failure. `sepolia.drpc.org` serves
10,000-block ranges and **errors** above that rather than truncating, so it is the one the
scanner uses.

## 4. The finding: a self-published binding makes a per-human cap free to evade

`maxAgentsPerHuman` groups agents by the human they name. With AgentBook that is safe, because
the humanId is a Semaphore nullifier hash — you cannot mint one without an Orb verification.
With ENS the identifier is *whatever the agent's record says*, and generating an address is
free. Name a different wallet per agent and every agent is its own human. **The cap binds
nothing, and every individual answer stays true.** Nothing looks wrong: no agent is refused, and
no rule reports a failure.

The live tree carries this attack run against ourselves. `unverified.corroborate.eth` names
`0xA6b7471f…67b1` as its human — an address that is *already in `corroborate.eth`'s own
`corroborate.subjects` list*. One operator, two humans, two slots, and the second one also
inherits a credential set (Holonym gov-ID + FaceTec biometrics + Human Passport, score 3.6087)
that it never had to acquire.

Two things close it, and neither is cryptography:

1. **The other direction.** The human's name publishes `corroborate.agents`. A binding both ends
   assert is `mutual`; a binding only the agent asserts is `agent-asserted`. Writing the
   acknowledgement costs a transaction from the key controlling the human's name, so minting
   humans stops being free — each mint must be a name you control and pay for, and each is then
   *visibly* a separate human with its own (usually empty) credential set. The evasion becomes
   expensive and legible instead of free and invisible.
2. **A policy that says so.** `FleetPolicy.requireAttestedBinding` refuses one-way claims, and
   the refusal happens *before* slot allocation, so an agent refused on its binding never burns
   a sibling's allowance.

Live, over the real tree (`npm run ens`):

| policy | alpha | beta | unverified | humans counted |
|---|---|---|---|---|
| as written | **ALLOW** | DENY (cap, names alpha) | **ALLOW** | 2 |
| `requireAttestedBinding: true` | **ALLOW** | DENY (cap, names alpha) | DENY (binding) | 2 |

The first row is the demonstration: a cap of one agent per human admitted two agents, and the
caveat `fleet-cap-soft-on-asserted-bindings` says exactly why.

### 4.1 What is *not* done about it

Two declared humans sharing a wallet — which is what our own tree shows — is reported
(`declared-humans-share-a-wallet`) and never acted on. Merging humans whose self-asserted subject
sets overlap would let anyone absorb a stranger's identity by copying their record, and
clustering an agent's wallet to an operator by funding history is a guess that reads as an
accusation when it is wrong. The counterparty gets the observation.

## 5. What a mutual binding does and does not establish

It establishes that whoever controls the human's name accepts this agent. It does not establish
that the human is a distinct person, that they are *operating* the agent, or that the wallets in
`corroborate.subjects` are theirs — that last one is the pre-existing
`address-set-asserted-by-name-owner` caveat and it is unchanged. Nor does resolving a name
authenticate the party presenting it — see §5.1, which was open when this file was written and
is now closed.

### 5.1 The presenter gate (added 2026-07-25)

A name is public and so is everything read from it, so until this was built, anyone could type
`alpha.corroborate.eth` into a counterparty's form and be scored on the credentials of the human
behind it — riding a stranger's evidence with no key, no transaction and no trace, while the
counterparty's own log named a party that was never there. `agent-presenter-not-authenticated`
reported the gap honestly on every batch for four iterations. `packages/sdk/src/ens-presentation.ts`
closes it: an ERC-4361 challenge the counterparty issues, a signature the presenter returns, and
one comparison against the `addr` record read in the same pass.

Four decisions in it are worth more than the code:

- **The wallet signs, not the node owner.** Both keys exist and prove different things. The
  wallet proves the presenter is the party the name currently designates — the party about to be
  transacted with, and the key the fleet slot is allocated to. The owner would prove only control
  of the *name*, so an operator pointing a name at a wallet it does not hold could present as
  that wallet, which is the impersonation the gate exists to stop. Whether the signer *also* owns
  the node is reported (`signerIsNodeOwner`, `agent-signer-owns-the-name`) because it says whether
  the key in front of you can rewrite the records you just read — never as a condition.
- **The name is inside the signed message**, as `ens:<name>` in ERC-4361 `Resources`, and a
  signature carrying any other name is refused. Without it one signature authenticates its signer
  for every name in the tree pointing at that wallet, and a signature collected for one name can
  be presented for another. A signature that does not name what it authorises is a bearer token.
  Both the unit suite and the live suite prove this with the *same nonce* on both challenges, so
  the refusal can only come from the name binding.
- **The gate runs before the grouping, not merely before the slot allocation.** An impostor
  presenting a stranger's name must not be counted as one of that human's agents: grouping first
  would let it inflate a stranger's fleet size and then have the stranger refused by the cap for
  agents they never ran. Everything counted per human is counted over the agents that survived
  the gate.
- **Failure is three-valued.** A wrong-key signature is a fact about the presenter and is a
  denial. A smart-account signature (ERC-1271/6492) needs a chain read, and a failed read says
  nothing about anybody, so it comes back `unknown` → `indeterminate`. An EOA never touches the
  network at all: local recovery first, chain second.

`requirePresenterAuthentication` is the policy flag, off by default for the same reason
`requireAttestedBinding` is — the World AgentKit path authenticates at the HTTP layer before it
ever reaches this engine, and a policy demanding proof from a caller with no channel to collect
it refuses everybody. `npm run ens` runs both sides: run 5 has each agent answer with its own key
(2 of 3 admitted, unchanged from run 1–3 — proof costs an honest agent nothing), and run 6
presents the *same three names* from a wallet generated a second earlier (0 of 3, identical
records, identical human, identical score).

What a signature here still does not prove: that the presenter is the agent's operator (keys are
shared and stolen), that the named human consents to anything (that is the acknowledgement
record), or anything at all after the `addr` record is rewritten by whoever owns the node. All
three ship as `agent-presenter-authenticated-for-this-wallet-only`.

## 6. Two implementation details worth keeping

**One wallet, several names.** In ENS this is ordinary: a name is an identity, a wallet is a key,
and one key can be named many times. The fleet engine keys agents by address, so two names for
one wallet would have been judged twice — the trace showing only the last verdict, and a cap of
one refusing a wallet on account of its own second name. `toFleetAgents()` collapses them into a
single agent, takes the earliest creation block, and lets an acknowledgement on *any* of the
names settle the binding. If the names disagree about **which human** owns the wallet, the
backing becomes `unknown` → `indeterminate`: a contradiction is not a fact about a person, and
the engine has no business picking a side.

**Canonicalising the human.** `corroborate.human` may hold a name or an address. Both are keyed
on the *resolved address* where there is one, so naming a human by name and by address is one
human rather than two — otherwise "name it twice" would itself be a way to hold two slots.

---

## Sources

- ENS registry / BaseRegistrar / controller / resolver: read live from Sepolia, addresses in the
  table in §1; `TestnetV1PremigrationRegistrar` and `PublicResolver` metadata and source from
  Sourcify (`sourcify.dev/server/v2/contract/11155111/…`), both exact matches.
- Registration transactions inspected: `0xfb2dea84…7311` (decoded for the calldata layout).
- Our own writes: parent registration and record set, subname creation at blocks 11,348,909–
  11,348,926; every field read back and recorded in `deployments/ens-sepolia.json`.
- Live suite: `packages/sdk/src/ens-agents.live.test.ts` (14 tests), unit suite
  `packages/sdk/src/ens-agents.test.ts` (24 tests).
- Presenter gate: `packages/sdk/src/ens-presentation.ts`, unit suite `ens-presentation.test.ts`
  (31 tests, every signature real), live suite `ens-presentation.live.test.ts` (7 tests against
  the Sepolia tree). ERC-4361 message construction and parsing via `viem/siwe`; the ERC-1271
  branch via viem's `verifyMessage`, exercised against a live Sepolia node in the live suite.
