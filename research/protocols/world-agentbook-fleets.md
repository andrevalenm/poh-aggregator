# AgentBook, read as a fleet index

*Written 2026-07-25 while implementing `packages/sdk/src/agentbook.ts` and
`packages/sdk/src/fleet.ts`. Builds on [`world-id-onchain-read.md`](world-id-onchain-read.md),
which established what the two World Chain registries are and why the AddressBook is the one
that dates a credential. This file is about the other question: **how many of the agents in
front of a counterparty are the same person.***

Every measurement below was taken on 2026-07-25 against World Chain mainnet, keyless.

---

## 1. The question the mapping cannot answer

`AgentBook.lookupHuman(agent)` returns the anonymous identifier of the World ID human who
registered that wallet. That answers *whose* agent this is. It does not answer *how many other
agents that human registered*, and there is no reverse index to ask: a `PUSH4` scan of the
deployed bytecode (3,569 bytes) finds seventeen selectors, and the entire read surface is

| selector | signature | source |
|---|---|---|
| `0x451a02f4` | `lookupHuman(address)` | computed |
| `0xa0f44c92` | `groupId()` | computed |
| `0x9f50b66d` | `worldIdRouter()` | computed |
| `0x90193b7c` | `getNextNonce(address)` | OpenChain |
| `0x8da5cb5b` / `0xe30c3978` / `0xf2fde38b` / `0x715018a6` / `0x79ba5097` | Ownable2Step | computed |
| `0x803a100d` | `register(address,uint256,uint256,uint256,uint256[8])` | OpenChain |
| `0x93526432` / `0xa0191fd2` | `setWorldIdRouter(address)` / `setGroupId(uint256)` | computed / OpenChain |
| `0x3bc778e3` | `verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])` | OpenChain |

Same shape as Verax on Linea in [`linea-poh-onchain-read.md`](linea-poh-onchain-read.md): a
mapping keyed the wrong way round for the question being asked. And, as there, the answer is not
a better call — it is to read the whole registry, because the whole registry is small.

## 2. The whole registry, in six calls

- **Deployed** at block **27,053,063**, 2026-03-13T22:42:45Z, found by bisecting `eth_getCode`
  (no code at 27,053,062).
- **`AgentRegistered(address indexed agent, uint256 indexed humanId)`**, topic
  `0xd1b8447016…166f3306` (OpenChain; both parameters indexed, `data` is empty).
- **1,164 events** over the contract's whole life at block 32,829,438, in **1,164 distinct
  transactions** — one registration per transaction, no batching.
- Six `eth_getLogs` calls at 1M blocks each, ~4.6 s. The same query as a single 5.8M-block range
  returns the identical 1,164, and so do 200k and 25k chunks.

`register` is the only writer of the mapping and it emits. There is no admin write path — unlike
Proof of Humanity v1's `addSubmissionManually`, which moved the counter with no event
([`poh-v1-onchain-read.md`](poh-v1-onchain-read.md) §"a second invisible cohort"), or
Farcaster's `SetIdCounter` import ([`farcaster-onchain-read.md`](farcaster-onchain-read.md)) —
and no deregistration selector at all. The registry is append-only and the event stream
reconstructs it exactly.

**Checked rather than assumed.** For 41 agents sampled across the log, `lookupHuman` read from
*state* returns exactly the humanId the event carried. Two subsystems of the node agreeing,
where the index consults only the first.

## 3. What `humanId` is

It is the Semaphore nullifier hash the registering proof produced. Read from the chain, not from
documentation: in tx `0xc19650a0…a0cfe`, `register`'s fourth argument is
`0x16b562fc…4cb48e8`, which is exactly the value the event carries in its second topic. The
second argument is a merkle root and the third is the nonce (`0` in that call).

That matters because grouping is only "per human" if the identifier is a nullifier. A counter or
a sequence number would make one person several humans and the cap would enforce nothing. A
nullifier hash is deterministic in (identity, external nullifier), so one World ID always
produces the same `humanId` here — which is what makes "at most N agents per human" a rule the
chain can hold up.

## 4. The finding: 1,164 agents, 830 humans, and one human with 27

Grouping the log:

| agents per human | humans |
|---|---|
| 1 | 699 |
| 2 | 91 |
| 3 | 13 |
| 4 | 7 |
| 5 | 2 |
| 6 | 4 |
| 7 | 3 |
| 8 | 1 |
| 10 | 2 |
| 11 | 1 |
| 12 | 2 |
| 14 | 2 |
| 18 | 1 |
| 25 | 1 |
| **27** | **1** |

**131 humans run more than one agent.** A venue counting requesters over-counts its
counterparties by **1.40×** on average and by **27×** at the tail.

The largest fleets, with their registration spans:

| agents | first registration | last | span |
|---|---|---|---|
| 27 | block 27,994,780 (2026-04-04) | 28,024,879 | **0.7 days** |
| 25 | 28,487,453 (2026-04-16) | 30,957,055 | 57.2 days |
| 18 | 27,103,512 (2026-03-15) | 32,795,398 | 131.8 days |
| 14 | 28,000,547 | 31,059,136 | 70.8 days |
| 14 | 28,008,709 (2026-04-05) | 28,026,093 | 0.4 days |

Two distinct shapes are visible: fleets assembled in an afternoon (27 in 0.7 days, 14 in 0.4)
and fleets accumulated over months. Nothing here says either is abusive — an operator running
27 agents may be entirely legitimate — but "twenty-seven requesters" and "one counterparty" are
different facts and a venue is entitled to know which it has.

## 5. The identifier cannot be joined to any other World registry

`AgentBookInitialized(address,uint256,uint256)` fires once, in the deployment block:

    worldIdRouter          0x17B354dD2595411ff79041f930e491A4Df39A278
    groupId                1                              (the Orb group)
    externalNullifierHash  38265997849925878342838486616706141368121079204652799064895347807228265498

`WorldIDAddressBookInitialized` in the AddressBook's deployment block:

    worldIdRouter          0x17B354dD2595411ff79041f930e491A4Df39A278
    groupId                1
    externalNullifierHash  377593556987874043165400752883455722895901692332643678318174569531027326541
    verificationLength     14515200                       (168 days)
    maxProofTime           604800

Same router, same Orb group — **the same human population** — under **different external
nullifiers**, so the same person is two unlinkable pseudonyms across the two contracts. Measured
consequence: of 150 AgentBook `humanId`s passed to
`WorldIDAddressBook.nullifierHashes(uint256)`, **zero** resolve to an address.

This is the answer to a question worth asking out loud: could we authenticate an agent's
declared operator address set by walking the chain from the agent to its human's own verified
wallet? No — not by us and not by anyone without World's cooperation. The `address-set-not-
authenticated` caveat is therefore permanent, and it is permanent because World's privacy design
is working, not because the implementation is incomplete. A counterparty who wants that link has
to obtain a signature from the operator; it is not a lookup.

**A related measurement, for completeness.** 79 of the 1,164 agent wallets carry a *live*
AddressBook verification of their own and 1 a lapsed one, so a small minority of "agent" wallets
are also somebody's verified human address. No AgentBook human's fleet contains two live
AddressBook-verified wallets, which is consistent with the AddressBook's one-live-address-per-
human rule.

## 6. Endpoints: one works, and one lies

| endpoint | `eth_getLogs` range | verdict |
|---|---|---|
| `worldchain-mainnet.gateway.tenderly.co` | unbounded in practice | **usable**; whole history in 6 calls, ~5 s |
| `worldchain-mainnet.g.alchemy.com/public` | 100 blocks | refuses loudly; fine for state, which is what `world.ts` uses it for |
| `480.rpc.thirdweb.com` | 1,000 blocks | refuses loudly |
| `worldchain.drpc.org` | advertises 10,000 blocks | **answers wrongly** — see below |
| `worldchain-mainnet-rpc.publicnode.com` | — | malformed response |

drpc returns **HTTP 200 with an empty result array** for ranges that provably contain
registrations: blocks 27,994,780–28,004,779 hold 39 `AgentRegistered` events and drpc reports
`[]`, four times out of four, while tenderly reports 39 every time. It was briefly configured as
a fallback and produced a **7-registration** index of a 1,165-registration registry without
raising anything.

That is worse than the silent *truncation* iteration 7 measured on tenderly, because it is
permissive in the direction that matters: an empty fleet index makes every human look like they
run exactly one agent, which is the answer the whole policy exists to prevent. Two consequences,
both implemented:

1. drpc is **not** in the endpoint list. A scan that cannot be served fails, because a wrong
   fleet index is worse than no fleet index.
2. Every endpoint must clear a **canary** before its history is used: one call for block
   **27,100,652**, which has held the registry's first registration
   (agent `0xb667e025…83a1`, tx `0xc19650a0…a0cfe`) since 2026-03-15. An endpoint that cannot
   see it is not asked anything else.

## 7. What this does not establish

- **That a fleet is abusive.** The cap is a counterparty's policy, not a verdict about a person.
- **That a human has only one identity.** Grouping holds within *one* registry's nullifier
  namespace. The same person enrolled at an Orb twice, or registering in some other registry, is
  a different identifier and is not detectable here — which is exactly the property §5 measures
  from the other direction.
- **That the human operates the agent.** Unchanged, and unchangeable from any of this:
  `independent-control-not-attested` is on every result.
- **How many agents exist that AgentBook has never seen.** An agent nobody registered has no
  identifier at all, so a per-human cap cannot bind it. That is why the policy has to declare
  what it does with unregistered agents rather than defaulting.

## 8. Open questions

- **Who the 27-agent operator is, and whether the fleet is one product.** The wallets share no
  observable funding pattern that was checked here; the question was not pursued because the
  policy does not need it.
- **Whether `getNextNonce` implies a delegated registration path.** `register` takes a nonce and
  the one sampled call passed `0`. If registrations can be relayed on an operator's behalf, the
  transaction sender is not the operator — which affects nothing we score, since the identifier
  comes from the proof, but it would affect anyone trying to cluster fleets by funder.
- **Selector `0xf207da81`, `0x8461093f`, `0x4300081e`** are unknown to OpenChain and unmatched by
  the signature guesses tried here. None of them is on any path we read.
