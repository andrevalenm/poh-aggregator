/**
 * AgentBook, against World Chain.
 *
 * The claim under test is not "the contract answers". It is that **the index this module builds
 * is the whole registry** — because a fleet policy built on a partial index does not merely miss
 * agents, it silently reports a fleet as several counterparties, which is the exact failure the
 * policy exists to prevent. So completeness is asserted from three directions the scanner itself
 * does not use: a second chunk size (a silently truncating endpoint), the contract's *state*
 * (a log the node has but the mapping does not), and the registering transaction's calldata
 * (what the identifier we group on actually is).
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, decodeEventLog, decodeFunctionData, parseAbi } from 'viem'
import { worldchain } from 'viem/chains'
import {
  AGENT_BOOK,
  AGENT_BOOK_ABI,
  AGENT_BOOK_DEPLOYED_AT_BLOCK,
  AGENT_BOOK_EXTERNAL_NULLIFIER,
  AGENT_BOOK_FIRST_REGISTRATION_BLOCK,
  WORLD_STATE_RPC,
  lookupHumans,
  scanAgentBook,
  type AgentBookIndex,
} from './agentbook.ts'
import {
  WORLD_ADDRESS_BOOK_ABI,
  WORLD_ID_ADDRESS_BOOK,
  WORLD_ID_ORB_GROUP_ID,
} from './adapters/world.ts'
import { evaluateFleet, priceOfPolicy, costOfSlots, type FleetPolicy, type HumanEvidence } from './fleet.ts'
import ontologyData from './ontology-data.json' with { type: 'json' }
import type { Address, Adapter } from './types.ts'

const client = createPublicClient({ chain: worldchain, transport: http(WORLD_STATE_RPC) })

/** One scan, shared. It reads the whole history, so paying for it once per file is the point. */
let index: AgentBookIndex
/** Pinned so every assertion below describes the same registry state. */
let head: number

before(async () => {
  head = Number(await client.getBlockNumber())
  index = await scanAgentBook({ toBlock: head })
  console.log(
    `    AgentBook @ block ${head}: ${index.stats.agents} agents, ${index.stats.humans} humans, ` +
      `largest fleet ${index.stats.largestFleet}, ${index.stats.humansWithMoreThanOneAgent} humans run more than one ` +
      `(${index.source.calls} calls to ${new URL(index.source.endpoint).host})`,
  )
})

describe('AgentBook — the index is the registry, not a sample', () => {
  test('a second chunk size returns exactly the same registrations', async () => {
    // Tenderly truncates oversized log responses silently rather than erroring — measured on a
    // different World Chain contract in iteration 7. A count would not catch a truncation that
    // happened to drop and re-add; set equality on (agent, humanId, block) does.
    const again = await scanAgentBook({ toBlock: head, chunkSize: 250_000 })
    const key = (r: { agent: string; humanId: string; block: number }) =>
      `${r.agent}:${r.humanId}:${r.block}`
    const a = new Set(index.registrations.map(key))
    const b = new Set(again.registrations.map(key))
    assert.equal(a.size, index.registrations.length, 'registrations should be unique')
    assert.equal(b.size, a.size, `${again.source.calls} calls gave ${b.size}, ${index.source.calls} gave ${a.size}`)
    for (const k of a) assert.ok(b.has(k), `missing from the second scan: ${k}`)
    assert.ok(again.source.calls > index.source.calls, 'the second scan should have been more chunked')
  })

  test('the contract’s own state agrees with every log we grouped on', async () => {
    // The acceptance test. The scanner reads one subsystem of the node (the log index); this
    // reads another (the mapping) and requires them to name the same human for the same wallet.
    // A registration we mis-attributed would put an agent in the wrong fleet, which is exactly
    // how a fleet cap gets defeated.
    const all = [...new Set(index.registrations.map((r) => r.agent))]
    const step = Math.max(1, Math.floor(all.length / 60))
    const sample = all.filter((_, i) => i % step === 0)
    const state = await lookupHumans(sample as Address[])
    let checked = 0
    for (const agent of sample) {
      const backing = state.get(agent as Address)
      assert.ok(backing, `no state answer for ${agent}`)
      if (backing.status === 'unknown') continue // a transport failure says nothing either way
      assert.equal(backing.status, 'backed', `${agent} is in the log but unregistered in state`)
      assert.equal(
        backing.status === 'backed' ? backing.humanId : '',
        index.humanOf(agent as Address),
        `state and log disagree about who registered ${agent}`,
      )
      checked++
    }
    assert.ok(checked >= sample.length / 2, `only ${checked} of ${sample.length} were readable`)
  })

  test('the registry is append-only, so the log reconstructs it exactly', () => {
    // No deregistration selector exists and `register` is the only writer. If that ever stops
    // being true this fails loudly rather than the index quietly drifting from the mapping.
    assert.equal(index.registrations.length, index.stats.agents + index.stats.reRegisteredAgents)
    assert.equal(index.stats.reRegisteredAgents, 0, 'an agent has been re-registered — check buildIndex handles it')
    assert.ok(index.registrations.every((r) => r.block >= AGENT_BOOK_DEPLOYED_AT_BLOCK))
  })

  test('the canary block still holds the registration every endpoint is tested against', () => {
    // The scanner refuses any endpoint that cannot see this block. If the constant ever stopped
    // being the earliest registration the guard would still work, but the reason it is safe —
    // it is the first thing the registry ever emitted — would no longer be true.
    const first = index.registrations[0]!
    assert.equal(first.block, AGENT_BOOK_FIRST_REGISTRATION_BLOCK)
    assert.equal(
      index.registrations.filter((r) => r.block === AGENT_BOOK_FIRST_REGISTRATION_BLOCK).length,
      1,
    )
  })

  test('nothing predates the deployment block the scan starts from', async () => {
    // The scan's lower edge is only safe if the contract has no code beneath it.
    const before = await client.getCode({
      address: AGENT_BOOK,
      blockNumber: BigInt(AGENT_BOOK_DEPLOYED_AT_BLOCK - 1),
    })
    const at = await client.getCode({ address: AGENT_BOOK, blockNumber: BigInt(AGENT_BOOK_DEPLOYED_AT_BLOCK) })
    assert.ok(!before || before === '0x', 'AgentBook has code below the block we start scanning at')
    assert.ok(at && at !== '0x')
  })
})

describe('AgentBook — what the identifier we group on actually is', () => {
  test('humanId is the nullifier hash the registering proof produced', async () => {
    // Grouping by humanId is only "per human" if the value is a nullifier: a counter or a
    // sequence number would make one person several humans. Read from the calldata of a real
    // registration, which the index never touches.
    const r = index.registrations[index.registrations.length - 1]!
    const tx = await client.getTransaction({ hash: r.txHash as `0x${string}` })
    const decoded = decodeFunctionData({
      abi: parseAbi([
        'function register(address account, uint256 root, uint256 nonce, uint256 nullifierHash, uint256[8] proof)',
      ]),
      data: tx.input,
    })
    const [account, , , nullifierHash] = decoded.args
    assert.equal((account as string).toLowerCase(), r.agent)
    assert.equal((nullifierHash as bigint).toString(), r.humanId)
  })

  test('one World ID always yields the same humanId here, so a fleet cannot split itself', async () => {
    // Determinism is what makes the cap enforceable. It is not directly observable, but its
    // consequence is: the largest fleet's members were registered across many transactions, by
    // separate proofs, and every one carried the identical nullifier.
    const [, fleet] = largestFleet()
    assert.ok(fleet.length > 1)
    assert.equal(new Set(fleet.map((r) => r.txHash)).size, fleet.length)
    assert.equal(new Set(fleet.map((r) => r.humanId)).size, 1)
    const state = await lookupHumans(fleet.map((r) => r.agent))
    for (const r of fleet) {
      const b = state.get(r.agent)!
      if (b.status === 'unknown') continue
      assert.equal(b.status === 'backed' ? b.humanId : '', r.humanId)
    }
  })

  test('the identifier is scoped to this contract and cannot be joined to the AddressBook', async () => {
    // This is why an operator's address set stays asserted forever. Both registries consume
    // group-1 (Orb) proofs from the same router, but under different external nullifiers, so the
    // same person is two unlinkable pseudonyms across them — by design, not by omission.
    const initLogs = await client.getLogs({
      address: AGENT_BOOK,
      event: AGENT_BOOK_ABI[4] as never,
      fromBlock: BigInt(AGENT_BOOK_DEPLOYED_AT_BLOCK),
      toBlock: BigInt(AGENT_BOOK_DEPLOYED_AT_BLOCK),
    })
    assert.equal(initLogs.length, 1, 'AgentBook should be initialised exactly once, in its deployment block')
    const init = decodeEventLog({
      abi: AGENT_BOOK_ABI,
      data: initLogs[0]!.data,
      topics: initLogs[0]!.topics,
    }) as { args: { groupId: bigint; externalNullifierHash: bigint; worldIdRouter: Address } }

    assert.equal(init.args.groupId, WORLD_ID_ORB_GROUP_ID)
    assert.equal(init.args.externalNullifierHash, AGENT_BOOK_EXTERNAL_NULLIFIER)

    const [addressBookGroup, addressBookRouter] = await Promise.all([
      client.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'groupId',
      }),
      client.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'worldIdRouter',
      }),
    ])
    assert.equal(addressBookGroup, WORLD_ID_ORB_GROUP_ID, 'both registries read the same Orb group')
    assert.ok(addressBookRouter)

    // And the consequence, measured rather than argued: AgentBook humanIds are not AddressBook
    // nullifiers, so no agent can be walked to the wallet its operator verified.
    const humans = [...new Set(index.registrations.map((r) => r.humanId))].slice(0, 100)
    const hits = await client.multicall({
      allowFailure: true,
      contracts: humans.map((h) => ({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'nullifierHashes' as const,
        args: [BigInt(h)] as const,
      })),
    })
    const resolved = hits.filter(
      (h) => h.status === 'success' && h.result !== '0x0000000000000000000000000000000000000000',
    )
    assert.equal(
      resolved.length,
      0,
      `${resolved.length} of ${humans.length} AgentBook humanIds resolve in the AddressBook — the namespaces are no longer disjoint, and the operator-address caveat needs revisiting`,
    )
  })
})

describe('AgentBook — the fleet, and what a policy does with it', () => {
  test('agent count and human count are different quantities, on live data', () => {
    assert.ok(index.stats.agents > 0)
    assert.ok(index.stats.humans > 0)
    assert.ok(
      index.stats.agents > index.stats.humans,
      'no human on World Chain runs more than one agent — the fleet claim needs re-measuring',
    )
    assert.ok(index.stats.largestFleet >= 2)
    console.log(
      `    counting agents gives ${index.stats.agents}; counting humans gives ${index.stats.humans} ` +
        `(${index.stats.collapseRatio}× over, worst case ${index.stats.largestFleet}×)`,
    )
  })

  test('the largest fleet is one human’s, and the policy collapses it to the cap', () => {
    const [humanId, fleet] = largestFleet()
    const policy: FleetPolicy = {
      name: 'live test',
      minScore: 2.5,
      minIndependentRoots: 2,
      maxAgentsPerHuman: 1,
      unbackedAgents: 'deny',
      admission: 'earliest-registered',
    }
    // Evidence that clears the line, supplied rather than resolved: what is live here is the
    // *fleet*, and every branch of the evidence gate is covered in `fleet.test.ts` without a
    // network. Nothing about this fleet's real credentials is claimed.
    const evidence: HumanEvidence = { score: 3.6, independentRoots: 4 }
    const d = evaluateFleet({
      policy,
      agents: index.fleetAround(fleet[0]!.agent),
      evidence: new Map([[humanId, evidence]]),
    })

    assert.equal(d.summary.agents, fleet.length)
    assert.equal(d.summary.humans, 1)
    assert.equal(d.summary.allowed, 1)
    assert.equal(d.summary.denied, fleet.length - 1)
    // The slot goes to the human's first registration, and the chain decides which that is.
    const earliest = fleet.reduce((a, b) => (b.block < a.block ? b : a))
    assert.deepEqual(d.humans[0]!.admitted, [earliest.agent])
    assert.ok(d.caveats.some((c) => c.code === 'fleet-detected'))
    console.log(
      `    ${fleet.length} agents → 1 human → ${d.summary.allowed} admitted, ${d.summary.denied} refused; ` +
        `slot held by ${earliest.agent} (block ${earliest.block})`,
    )
  })

  test('any agent in the fleet reaches the whole fleet, from any starting member', () => {
    const [, fleet] = largestFleet()
    for (const member of fleet.slice(0, 5)) {
      const around = index.fleetAround(member.agent)
      assert.equal(around.length, fleet.length)
      assert.ok(around.some((a) => a.agent === member.agent))
    }
  })

  test('the cap has a price, and it comes from the deployed ontology', () => {
    // A per-human cap is worth exactly what a second human costs. Priced against the credentials
    // this SDK can actually read, because an adversary cannot clear our score with one we never
    // look at, and including the Orb root because AgentBook registration *is* a World ID proof.
    const price = priceOfPolicy({
      adapters: ontologyData.adapters as unknown as Adapter[],
      minScore: 2.5,
      minIndependentRoots: 2,
      readableAdapterIds: (ontologyData.adapters as { id: string; implemented?: boolean }[])
        .filter((a) => a.implemented)
        .map((a) => a.id),
      mustInclude: ['iris-registry:world-orb'],
    })
    assert.equal(price.feasible, true)
    const [, fleet] = largestFleet()
    const capped = costOfSlots(price, { maxAgentsPerHuman: 1 } as FleetPolicy, fleet.length)
    assert.equal(capped.humansRequired, fleet.length)
    console.log(
      `    cheapest slot: $${(price.cheapestSlotCents / 100).toFixed(2)} (${price.roots
        .map((r) => r.adapterId)
        .join(' + ')}); ${fleet.length} slots under a 1-agent cap: $${(capped.totalCents / 100).toFixed(2)}`,
    )
  })
})

function largestFleet(): [string, ReturnType<AgentBookIndex['fleetOf']>] {
  let best: [string, ReturnType<AgentBookIndex['fleetOf']>] = ['', []]
  const seen = new Set<string>()
  for (const r of index.registrations) {
    if (seen.has(r.humanId)) continue
    seen.add(r.humanId)
    const fleet = index.fleetOf(r.humanId)
    if (fleet.length > best[1].length) best = [r.humanId, fleet]
  }
  return best
}
