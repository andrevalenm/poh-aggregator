/**
 * Fleet policy, the parts that need no network.
 *
 * `evaluateFleet` is the whole decision — who is admitted, who is refused, and who could not
 * be judged — as a pure function of what the registries said, so the branches a live chain
 * will not produce on demand (an unreadable AgentBook, a human whose evidence failed to
 * resolve, two agents racing for one slot) are exercised here rather than hoped for.
 *
 * The pricing tests use the real deployed ontology, because the number they check is a claim
 * about the real world: what it costs an adversary to buy one more slot.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  costOfSlots,
  evaluateFleet,
  priceOfPolicy,
  type FleetAgent,
  type FleetPolicy,
  type HumanEvidence,
} from './fleet.ts'
import {
  AGENT_BOOK_DEPLOYED_AT_BLOCK,
  AGENT_BOOK_FIRST_REGISTRATION_BLOCK,
  AGENT_REGISTERED_TOPIC,
  buildIndex,
  scanAgentBook,
  type AgentRegistration,
} from './agentbook.ts'
import ontologyData from './ontology-data.json' with { type: 'json' }
import type { Address, Adapter } from './types.ts'

const POLICY: FleetPolicy = {
  name: 'Meridian Exchange',
  minScore: 2.5,
  minIndependentRoots: 2,
  maxAgentsPerHuman: 1,
  unbackedAgents: 'deny',
  admission: 'earliest-registered',
}

const HUMAN = '7042907892976925621923563123453278741225516872296614252028014677953508648443'
const OTHER = '3998825407980612345678901234567890123456789012345678901234567890123456789012'
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address

const backed = (agent: Address, humanId: string, block?: number): FleetAgent => ({
  agent,
  backing: { status: 'backed', humanId },
  ...(block !== undefined ? { registeredAtBlock: block } : {}),
})

const passes: HumanEvidence = { score: 3.6, independentRoots: 4, roots: ['a', 'b', 'c', 'd'] }
const weak: HumanEvidence = { score: 1.7, independentRoots: 1, roots: ['a'] }
const ev = (...pairs: [string, HumanEvidence][]) => new Map(pairs)

describe('fleet policy — the cap is per human, not per agent', () => {
  test('twenty-seven agents behind one human collapse to one admitted and twenty-six refused', () => {
    // The shape of the largest real fleet in AgentBook, registered inside one day.
    const agents = Array.from({ length: 27 }, (_, i) => backed(addr(i + 1), HUMAN, 27_994_780 + i))
    const d = evaluateFleet({ policy: POLICY, agents, evidence: ev([HUMAN, passes]) })

    assert.equal(d.summary.agents, 27)
    assert.equal(d.summary.humans, 1)
    assert.equal(d.summary.allowed, 1)
    assert.equal(d.summary.denied, 26)
    assert.equal(d.summary.largestFleet, 27)
    assert.equal(d.summary.collapseRatio, 27)
    // Every refusal names the sibling that holds the slot, rather than reporting a bare no.
    const refused = d.agents.filter((a) => a.verdict === 'deny')
    assert.equal(refused.length, 26)
    for (const r of refused) assert.match(r.because, /already holds 1 agent slot\(s\) \(0x0{39}1\)/)
    assert.ok(d.caveats.some((c) => c.code === 'fleet-detected'))
  })

  test('the cap is a number, not a boolean — three slots admit three of the twenty-seven', () => {
    const agents = Array.from({ length: 27 }, (_, i) => backed(addr(i + 1), HUMAN, 100 + i))
    const d = evaluateFleet({
      policy: { ...POLICY, maxAgentsPerHuman: 3 },
      agents,
      evidence: ev([HUMAN, passes]),
    })
    assert.equal(d.summary.allowed, 3)
    assert.equal(d.summary.denied, 24)
    assert.deepEqual(d.humans[0]!.admitted, [addr(1), addr(2), addr(3)])
  })

  test('two humans with one agent each are two counterparties, not a fleet', () => {
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1), backed(addr(2), OTHER, 2)],
      evidence: ev([HUMAN, passes], [OTHER, passes]),
    })
    assert.equal(d.summary.allowed, 2)
    assert.equal(d.summary.humans, 2)
    assert.equal(d.summary.collapseRatio, 1)
    assert.equal(
      d.caveats.some((c) => c.code === 'fleet-detected'),
      false,
    )
  })
})

describe('fleet policy — a denied agent must not spend its human’s slot', () => {
  test('an agent refused on evidence does not consume the allowance', () => {
    // Both agents belong to a human whose evidence fails. Nobody is admitted, and the refusals
    // are about the evidence — not about a slot that was never taken.
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1), backed(addr(2), HUMAN, 2)],
      evidence: ev([HUMAN, weak]),
    })
    assert.equal(d.summary.allowed, 0)
    assert.equal(d.summary.denied, 2)
    for (const a of d.agents) {
      assert.match(a.because, /score 1.7 < 2.5/)
      // The slot rule never ran: it cannot fail for an agent that never reached it.
      assert.equal(
        a.rules.some((r) => r.rule === 'max-agents-per-human'),
        false,
      )
    }
  })

  test('an agent that fails only the root count is refused on the roots, not on the score', () => {
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1)],
      evidence: ev([HUMAN, { score: 3.0, independentRoots: 1 }]),
    })
    assert.equal(d.agents[0]!.verdict, 'deny')
    assert.match(d.agents[0]!.because, /1 independent root\(s\) < 2 required/)
    assert.equal(d.agents[0]!.rules.find((r) => r.rule === 'min-score')!.pass, true)
  })

  test('an indeterminate sibling does not take the slot from a determinate one', () => {
    // The first agent's registry read failed. If that consumed the human's slot, the second —
    // fully readable and passing — would be refused for a reason that is really our outage.
    const agents: FleetAgent[] = [
      { agent: addr(1), backing: { status: 'unknown', error: 'HTTP 503' }, registeredAtBlock: 1 },
      backed(addr(2), HUMAN, 2),
    ]
    const d = evaluateFleet({ policy: POLICY, agents, evidence: ev([HUMAN, passes]) })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
    assert.equal(d.agents[1]!.verdict, 'allow')
    assert.ok(d.caveats.some((c) => c.code === 'fleet-membership-unresolved'))
  })
})

describe('fleet policy — failures are never answers', () => {
  test('an unreadable registry is neither an admission nor an accusation', () => {
    const agents: FleetAgent[] = [
      { agent: addr(1), backing: { status: 'unknown', error: 'connect ETIMEDOUT' } },
    ]
    const d = evaluateFleet({ policy: POLICY, agents, evidence: new Map() })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
    assert.match(d.agents[0]!.because, /refusing to guess in either direction/)
    assert.equal(d.summary.allowed, 0)
    assert.equal(d.summary.denied, 0)
    assert.equal(d.summary.unresolved, 1)
  })

  test('a human whose personhood could not be resolved is indeterminate, not refused', () => {
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1)],
      evidence: ev([HUMAN, { score: 0, independentRoots: 0, error: 'every probe failed' }]),
    })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
    assert.match(d.agents[0]!.because, /every probe failed/)
  })

  test('no evidence supplied for a human is indeterminate rather than a zero score', () => {
    // Scoring a missing lookup as zero would refuse a real person for our own omission.
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1)],
      evidence: new Map(),
    })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
  })
})

describe('fleet policy — the unbacked agent is a declared choice', () => {
  const unbacked = (n: number): FleetAgent => ({ agent: addr(n), backing: { status: 'unbacked' } })

  test('deny is the default posture and says why', () => {
    const d = evaluateFleet({ policy: POLICY, agents: [unbacked(1)], evidence: new Map() })
    assert.equal(d.agents[0]!.verdict, 'deny')
    assert.match(d.agents[0]!.because, /cannot attribute to a person/)
    assert.equal(d.summary.unbacked, 1)
  })

  test('counting each unbacked agent as its own human defeats the cap, and the caveat says so', () => {
    const agents = [unbacked(1), unbacked(2), unbacked(3)]
    const evidence = new Map(agents.map((a) => [`unbacked:${a.agent.toLowerCase()}`, passes]))
    const d = evaluateFleet({
      policy: { ...POLICY, unbackedAgents: 'count-as-distinct-human' },
      agents,
      evidence,
    })
    assert.equal(d.summary.allowed, 3)
    // Synthetic identities are not counted as humans: they are wallets we could not attribute.
    assert.equal(d.summary.humans, 0)
    const caveat = d.caveats.find((c) => c.code === 'fleet-cap-not-enforceable-on-unbacked-agents')
    assert.ok(caveat)
    assert.match(caveat!.message, /one slot per wallet it generates/)
  })
})

describe('fleet policy — admission order is stated, not incidental', () => {
  test('earliest registration keeps the slot, whatever order the caller presents', () => {
    // Presented newest first. Churning wallets must not displace the incumbent.
    const agents = [backed(addr(3), HUMAN, 300), backed(addr(1), HUMAN, 100), backed(addr(2), HUMAN, 200)]
    const d = evaluateFleet({ policy: POLICY, agents, evidence: ev([HUMAN, passes]) })
    assert.deepEqual(d.humans[0]!.admitted, [addr(1)])
    assert.equal(d.agents.find((a) => a.agent === addr(1))!.verdict, 'allow')
  })

  test('as-presented gives the slot to the first requester, which is a live venue’s rule', () => {
    const agents = [backed(addr(3), HUMAN, 300), backed(addr(1), HUMAN, 100)]
    const d = evaluateFleet({
      policy: { ...POLICY, admission: 'as-presented' },
      agents,
      evidence: ev([HUMAN, passes]),
    })
    assert.deepEqual(d.humans[0]!.admitted, [addr(3)])
  })

  test('a missing registration block sorts last and is flagged, never treated as the oldest', () => {
    const agents = [
      { agent: addr(9), backing: { status: 'backed' as const, humanId: HUMAN } },
      backed(addr(1), HUMAN, 100),
    ]
    const d = evaluateFleet({ policy: POLICY, agents, evidence: ev([HUMAN, passes]) })
    assert.deepEqual(d.humans[0]!.admitted, [addr(1)])
    assert.ok(d.caveats.some((c) => c.code === 'fleet-admission-order-degraded'))
  })

  test('the result is order-stable: verdicts come back in the order the caller asked', () => {
    const agents = [backed(addr(3), HUMAN, 300), backed(addr(1), HUMAN, 100), backed(addr(2), OTHER, 200)]
    const d = evaluateFleet({ policy: POLICY, agents, evidence: ev([HUMAN, passes], [OTHER, passes]) })
    assert.deepEqual(
      d.agents.map((a) => a.agent),
      [addr(3), addr(1), addr(2)],
    )
  })
})

// ---------------------------------------------------------------------------------------

const ADAPTERS = ontologyData.adapters as unknown as Adapter[]
/** What the SDK can actually read today — the same ten adapters `defaultAdapters()` builds. */
const READABLE = (ontologyData.adapters as { id: string; implemented?: boolean }[])
  .filter((a) => a.implemented)
  .map((a) => a.id)

describe('what the policy costs an adversary', () => {
  test('the cheapest slot is a real set of credentials from the deployed ontology', () => {
    const price = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: POLICY.minScore,
      minIndependentRoots: POLICY.minIndependentRoots,
      readableAdapterIds: READABLE,
      mustInclude: ['iris-registry:world-orb'],
    })
    assert.equal(price.feasible, true)
    // Every root in the answer is a distinct root, and each is priced at min(forge, rent).
    assert.equal(new Set(price.roots.map((r) => r.trustRoot)).size, price.roots.length)
    for (const r of price.roots) {
      const a = ADAPTERS.find((x) => x.id === r.adapterId)!
      assert.equal(r.costCents, Math.min(a.forgeCostCents, a.rentCostCents))
      assert.equal(a.live, true)
    }
    // It clears the policy it was priced for, by the scorer's own arithmetic.
    assert.ok(Math.log10(price.cheapestSlotCents + 1) >= POLICY.minScore)
    assert.ok(price.roots.length >= POLICY.minIndependentRoots)
    // And the gate root is in it, because AgentBook registration needs a World ID.
    assert.ok(price.roots.some((r) => r.trustRoot === 'iris-registry:world-orb'))
  })

  test('it really is the minimum: no cheaper subset of the candidate roots clears the policy', () => {
    const price = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: 2.5,
      minIndependentRoots: 2,
      readableAdapterIds: READABLE,
      mustInclude: ['iris-registry:world-orb'],
    })
    const target = 10 ** 2.5 - 1
    const c = price.candidates
    let cheaper = 0
    for (let mask = 0; mask < 1 << c.length; mask++) {
      const set = c.filter((_, i) => mask & (1 << i))
      const total = set.reduce((s, r) => s + r.costCents, 0)
      if (total >= price.cheapestSlotCents) continue
      if (total < target) continue
      if (set.length < 2) continue
      if (!set.some((r) => r.trustRoot === 'iris-registry:world-orb')) continue
      cheaper++
    }
    assert.equal(cheaper, 0)
  })

  test('pricing against credentials we cannot read would quote a floor nobody can reach', () => {
    // The unrestricted ontology contains cheap roots with no probe behind them. An adversary
    // cannot clear *our* score with a credential we never look at, so including them
    // understates what the policy costs.
    const readable = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: 2.5,
      minIndependentRoots: 2,
      readableAdapterIds: READABLE,
    })
    const everything = priceOfPolicy({ adapters: ADAPTERS, minScore: 2.5, minIndependentRoots: 2 })
    assert.ok(everything.candidates.length > readable.candidates.length)
    assert.ok(everything.cheapestSlotCents <= readable.cheapestSlotCents)
  })

  test('a policy no combination of readable credentials can clear is reported, not priced', () => {
    const price = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: 2.5,
      minIndependentRoots: 99,
      readableAdapterIds: READABLE,
    })
    assert.equal(price.feasible, false)
    assert.equal(price.cheapestSlotCents, 0)
    assert.match(price.reason, /denies everybody/)
  })

  test('requiring a root nothing readable sits on is a broken policy, and says which root', () => {
    const price = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: 1,
      minIndependentRoots: 1,
      readableAdapterIds: READABLE,
      mustInclude: ['state-document:icao-9303'],
    })
    assert.equal(price.feasible, false)
    assert.match(price.reason, /state-document:icao-9303/)
    assert.match(price.reason, /including an honest subject/)
  })

  test('the cap is what makes the marginal agent expensive', () => {
    const price = priceOfPolicy({
      adapters: ADAPTERS,
      minScore: 2.5,
      minIndependentRoots: 2,
      readableAdapterIds: READABLE,
      mustInclude: ['iris-registry:world-orb'],
    })
    const capped = costOfSlots(price, POLICY, 27)
    const loose = costOfSlots(price, { ...POLICY, maxAgentsPerHuman: 27 }, 27)
    assert.equal(capped.humansRequired, 27)
    assert.equal(loose.humansRequired, 1)
    assert.equal(capped.totalCents, 27 * price.cheapestSlotCents)
    assert.equal(loose.marginalCentsPerAgent, Number((price.cheapestSlotCents / 27).toFixed(2)))
    assert.ok(capped.totalCents > loose.totalCents)
  })
})

// ---------------------------------------------------------------------------------------

describe('AgentBook index — grouping, without a network', () => {
  const reg = (agent: number, humanId: string, block: number): AgentRegistration => ({
    agent: addr(agent),
    humanId,
    block,
    txHash: `0x${block.toString(16).padStart(64, '0')}`,
  })
  const source = { endpoint: 'test', chunkSize: 1, fromBlock: 0, calls: 0 }

  test('a fleet is every agent the human registered, oldest first', () => {
    const idx = buildIndex(
      [reg(1, HUMAN, 300), reg(2, HUMAN, 100), reg(3, OTHER, 200)],
      1000,
      source,
    )
    assert.deepEqual(
      idx.fleetOf(HUMAN).map((r) => r.agent),
      [addr(2), addr(1)],
    )
    assert.deepEqual(
      idx.siblingsOf(addr(1)).map((r) => r.agent),
      [addr(2)],
    )
    assert.equal(idx.stats.agents, 3)
    assert.equal(idx.stats.humans, 2)
    assert.equal(idx.stats.largestFleet, 2)
    assert.equal(idx.stats.collapseRatio, 1.5)
  })

  test('lookups are case-insensitive, because callers paste checksummed addresses', () => {
    const idx = buildIndex([reg(1, HUMAN, 1)], 10, source)
    assert.equal(idx.humanOf(addr(1).toUpperCase().replace('0X', '0x') as Address), HUMAN)
  })

  test('a re-registered agent belongs to whoever holds it now, not to whoever held it first', () => {
    // The mapping is a plain overwrite. Nothing has re-registered on the deployed contract, so
    // the count is reported rather than assumed to be zero.
    const idx = buildIndex([reg(1, HUMAN, 100), reg(1, OTHER, 500)], 1000, source)
    assert.equal(idx.humanOf(addr(1)), OTHER)
    assert.equal(idx.stats.agents, 1)
    assert.equal(idx.stats.reRegisteredAgents, 1)
    assert.deepEqual(idx.fleetOf(HUMAN), [])
  })

  test('fleetAround turns one agent into the whole fleet as policy input', () => {
    const idx = buildIndex([reg(1, HUMAN, 300), reg(2, HUMAN, 100)], 1000, source)
    const fleet = idx.fleetAround(addr(1))
    assert.equal(fleet.length, 2)
    assert.deepEqual(
      fleet.map((f) => f.registeredAtBlock),
      [100, 300],
    )
    for (const f of fleet) assert.deepEqual(f.backing, { status: 'backed', humanId: HUMAN })
  })

  test('an agent nobody registered comes back unbacked rather than missing', () => {
    const idx = buildIndex([reg(1, HUMAN, 1)], 10, source)
    const fleet = idx.fleetAround(addr(99))
    assert.deepEqual(fleet, [{ agent: addr(99), backing: { status: 'unbacked' } }])
    assert.equal(idx.humanOf(addr(99)), undefined)
    assert.deepEqual(idx.siblingsOf(addr(99)), [])
  })
})

describe('fleet policy — a mis-keyed evidence map fails loudly', () => {
  test('evidence for a human nobody in the batch belongs to is named, not ignored', () => {
    // The bug that produced this test: the same nullifier hash was hex in one code path and
    // decimal in the other, so every agent came back indeterminate and no gate reported a
    // problem. Nobody was refused, which is exactly why nothing looked wrong.
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1)],
      evidence: ev([`0x${BigInt(HUMAN).toString(16)}`, passes]),
    })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
    const c = d.caveats.find((x) => x.code === 'fleet-evidence-keys-unmatched')
    assert.ok(c)
    assert.match(c!.message, /encoded the same way/)
  })

  test('a wider evidence map than the batch needs is not a problem', () => {
    // A caller reusing a per-human cache legitimately holds evidence for humans not present.
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(addr(1), HUMAN, 1)],
      evidence: ev([HUMAN, passes], [OTHER, passes]),
    })
    assert.equal(d.agents[0]!.verdict, 'allow')
    assert.equal(
      d.caveats.some((x) => x.code === 'fleet-evidence-keys-unmatched'),
      false,
    )
  })
})

describe('AgentBook scanner — an endpoint that lies is refused', () => {
  /**
   * The failure this guards against was observed, not imagined: a free World Chain endpoint
   * answers `eth_getLogs` with HTTP 200 and an empty array for ranges that provably contain
   * registrations. Downstream that is indistinguishable from an empty registry — and an empty
   * fleet index is the *permissive* answer, because every human then appears to run one agent.
   */
  async function serve(handler: (from: number, to: number) => unknown[]) {
    const { createServer } = await import('node:http')
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const { params } = JSON.parse(body)
        const from = Number.parseInt(params[0].fromBlock, 16)
        const to = Number.parseInt(params[0].toBlock, 16)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: handler(from, to) }))
      })
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r as () => void))
    const { port } = server.address() as { port: number }
    return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r(undefined))) }
  }

  const log = (block: number) => ({
    topics: [
      AGENT_REGISTERED_TOPIC,
      `0x000000000000000000000000${'1'.repeat(40)}`,
      `0x${'0'.repeat(63)}7`,
    ],
    blockNumber: `0x${block.toString(16)}`,
    transactionHash: `0x${block.toString(16).padStart(64, '0')}`,
  })

  test('an endpoint returning nothing for the canary block is not used', async () => {
    const s = await serve(() => [])
    try {
      await assert.rejects(
        scanAgentBook({
          endpoints: [{ url: s.url, maxRange: 1_000_000 }],
          toBlock: AGENT_BOOK_DEPLOYED_AT_BLOCK + 10,
        }),
        /not trustworthy/,
      )
    } finally {
      await s.close()
    }
  })

  test('an endpoint that can see the canary is used, and its logs are indexed', async () => {
    const s = await serve((from, to) =>
      from <= AGENT_BOOK_FIRST_REGISTRATION_BLOCK && AGENT_BOOK_FIRST_REGISTRATION_BLOCK <= to
        ? [log(AGENT_BOOK_FIRST_REGISTRATION_BLOCK)]
        : [],
    )
    try {
      const idx = await scanAgentBook({
        endpoints: [{ url: s.url, maxRange: 1_000_000 }],
        toBlock: AGENT_BOOK_FIRST_REGISTRATION_BLOCK + 10,
      })
      assert.equal(idx.stats.agents, 1)
      assert.equal(idx.stats.humans, 1)
      assert.equal(idx.registrations[0]!.humanId, '7')
    } finally {
      await s.close()
    }
  })
})
