/**
 * ENS agent identity, against the real tree on Sepolia.
 *
 * `deployments/ens-sepolia.json` supplies the *names* — the same way a counterparty is handed a
 * name by whoever is asking for something. Every answer comes from the chain: the addr records,
 * the text records, the registry's owner mapping and the registry's subnode log. Nothing here
 * asserts a value the deployment file could have made true on its own; where the two could
 * disagree, the chain wins and the test fails.
 *
 * The claim under test is not "the records resolve". It is that the *binding* is read correctly
 * in both directions, that a one-way claim is visibly one-way, and that the fleet cap survives
 * the specific evasion a self-published binding makes free: naming a second wallet of your own
 * as a second human.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, isAddress, namehash, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AGENT_HUMAN_RECORD,
  ENS_REGISTRY,
  ENS_REGISTRY_ABI,
  HUMAN_AGENTS_RECORD,
  HUMAN_SUBJECTS_RECORD,
  creationBlocks,
  ensBatchCaveats,
  ensHumanId,
  humanAddressSets,
  resolveEnsAgents,
  scanNameTree,
  toFleetAgents,
  type EnsAgentIdentity,
  type NameTreeScan,
} from './ens-agents.ts'
import { evaluateFleet, type FleetPolicy, type HumanEvidence } from './fleet.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const deployment = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'deployments/ens-sepolia.json'), 'utf8'),
) as {
  chainId: number
  parent: string
  parentNode: string
  owner: string
  resolver: string
  agents: { name: string; address: string; human: string; acknowledged: boolean }[]
}

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
}) as PublicClient

const NAMES = deployment.agents.map((a) => a.name)

let identities: EnsAgentIdentity[]
let tree: NameTreeScan

before(async () => {
  tree = await scanNameTree(deployment.parent, { candidateLabels: NAMES })
  identities = await resolveEnsAgents(client, NAMES, { createdAtBlock: creationBlocks(tree) })
  console.log(
    `    ${deployment.parent}: ${identities.length} agent name(s) resolved; registry log shows ` +
      `${tree.subnodes.length} subnode(s) between blocks ${tree.coverage.fromBlock}–${tree.coverage.toBlock}`,
  )
})

describe('the tree resolves from public infrastructure only', () => {
  test('every agent name resolves to the wallet the deployment recorded, read from the chain', () => {
    for (const declared of deployment.agents) {
      const id = identities.find((i) => i.name === declared.name)
      assert.ok(id, `${declared.name} did not resolve`)
      assert.equal(id.error, undefined)
      assert.equal(id.agent?.toLowerCase(), declared.address.toLowerCase())
    }
  })

  test('the human side is read through ENS, and its subject set is a set of addresses', async () => {
    const human = identities.find((i) => i.human?.name === deployment.parent)?.human
    assert.ok(human, `no agent named ${deployment.parent} as its human`)
    assert.ok(human.subjects.length >= 2, 'the human declares more than its own addr record')
    for (const s of human.subjects) assert.ok(isAddress(s))
    // Same records, read the plain way: the SDK must not be inventing either of them.
    const [subjects, agents] = await Promise.all([
      client.getEnsText({ name: deployment.parent, key: HUMAN_SUBJECTS_RECORD }),
      client.getEnsText({ name: deployment.parent, key: HUMAN_AGENTS_RECORD }),
    ])
    assert.ok(subjects && subjects.length > 0)
    assert.ok(agents && agents.length > 0)
  })

  test('the registry owner of every agent node is the parent’s owner', async () => {
    for (const id of identities) {
      const owner = (await client.readContract({
        address: ENS_REGISTRY,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [namehash(id.name)],
      })) as string
      assert.equal(owner.toLowerCase(), deployment.owner.toLowerCase())
      assert.equal(id.owner?.toLowerCase(), owner.toLowerCase())
    }
  })
})

describe('the binding is read in both directions', () => {
  test('an acknowledged agent is mutual; an unacknowledged one is not, and the records say why', async () => {
    const acknowledged = await client.getEnsText({ name: deployment.parent, key: HUMAN_AGENTS_RECORD })
    const listed = (acknowledged ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    assert.ok(listed.length > 0, 'the human acknowledges nobody, so nothing can be mutual')

    for (const id of identities) {
      const expected = listed.includes(id.name) ? 'mutual' : 'agent-asserted'
      assert.equal(id.binding, expected, `${id.name} should be ${expected}`)
      const code = expected === 'mutual' ? 'agent-human-binding-mutual' : 'agent-human-binding-asserted'
      assert.ok(id.caveats.some((c) => c.code === code), `${id.name} is missing ${code}`)
    }
  })

  test('every agent’s corroborate.human record is what the SDK reports it declared', async () => {
    for (const id of identities) {
      const record = await client.getEnsText({ name: id.name, key: AGENT_HUMAN_RECORD })
      assert.equal(id.human?.declared, record)
    }
  })

  test('a human named by name and the same human named by address collapse to one id', async () => {
    const named = identities.find((i) => i.human?.name)?.human
    assert.ok(named?.address)
    assert.equal(named.humanId, ensHumanId(named.address))
  })
})

describe('the tree can be counted but not named', () => {
  test('the registry’s subnode log finds at least the agents we were handed', () => {
    assert.ok(tree.subnodes.length >= NAMES.length, `${tree.subnodes.length} subnodes < ${NAMES.length} names`)
    assert.equal(tree.named.length, NAMES.length)
    assert.equal(tree.coverage.endpoint === 'none', false, 'the log scan failed entirely')
  })

  test('every subnode the log names is confirmed against registry state', async () => {
    for (const s of tree.named) {
      const owner = (await client.readContract({
        address: ENS_REGISTRY,
        abi: ENS_REGISTRY_ABI,
        functionName: 'owner',
        args: [namehash(s.name!)],
      })) as string
      assert.equal(owner.toLowerCase(), s.owner.toLowerCase())
    }
  })

  test('creation blocks come from the chain, so slot order does not depend on the caller', () => {
    const blocks = creationBlocks(tree)
    for (const name of NAMES) {
      assert.ok(typeof blocks.get(name) === 'number', `${name} has no creation block`)
    }
    const ordered = [...blocks.values()]
    assert.equal(new Set(ordered).size > 1, true, 'all subnodes claim the same block')
  })

  test('the scan reports its window rather than implying completeness', () => {
    assert.ok(tree.caveats.some((c) => c.code === 'name-tree-scan-window'))
  })
})

/**
 * The acceptance the mission asks for: a second agent under the same name tree refused because
 * it is the same human — plus the case that makes the refusal worth anything.
 */
describe('the counterparty’s decision over the live tree', () => {
  const policy = (over: Partial<FleetPolicy> = {}): FleetPolicy => ({
    name: 'Meridian',
    minScore: 2.5,
    minIndependentRoots: 2,
    maxAgentsPerHuman: 1,
    unbackedAgents: 'deny',
    admission: 'earliest-registered',
    ...over,
  })
  /** Stand-in for `resolve()`: this file tests the ENS layer, not the probes. */
  const strong: HumanEvidence = { score: 3.6, independentRoots: 3 }
  const evidenceFor = (ids: EnsAgentIdentity[]) =>
    new Map([...humanAddressSets(ids).keys()].map((humanId) => [humanId, strong]))

  test('two agents of one human, one slot: the earlier registration keeps it and the chain decides which', () => {
    const decision = evaluateFleet({
      policy: policy(),
      agents: toFleetAgents(identities),
      evidence: evidenceFor(identities),
    })
    const mutual = identities.filter((i) => i.binding === 'mutual')
    assert.ok(mutual.length >= 2, 'the live tree no longer holds two acknowledged agents')

    const humanId = mutual[0]!.human!.humanId
    const human = decision.humans.find((h) => h.humanId === humanId)!
    assert.equal(human.agents.length, mutual.length)
    assert.equal(human.admitted.length, 1)

    const earliest = mutual.reduce((a, b) => (a.createdAtBlock! <= b.createdAtBlock! ? a : b))
    assert.equal(human.admitted[0]!.toLowerCase(), earliest.agent!.toLowerCase())

    const refused = decision.agents.find(
      (a) => a.humanId === humanId && a.verdict === 'deny',
    )!
    assert.match(refused.because, /already holds 1 agent slot/)
    assert.ok(refused.because.includes(earliest.name), 'the refusal must name the sibling holding the slot')
    assert.ok(decision.caveats.some((c) => c.code === 'fleet-detected'))
  })

  test('the unacknowledged agent holds a slot of its own — the evasion, live', () => {
    const decision = evaluateFleet({
      policy: policy(),
      agents: toFleetAgents(identities),
      evidence: evidenceFor(identities),
    })
    const asserted = identities.filter((i) => i.binding === 'agent-asserted')
    assert.ok(asserted.length >= 1, 'the live tree no longer holds an unacknowledged agent')
    for (const a of asserted) {
      const verdict = decision.agents.find((v) => v.label?.includes(a.name))!
      assert.equal(verdict.verdict, 'allow')
      assert.notEqual(verdict.humanId, identities.find((i) => i.binding === 'mutual')!.human!.humanId)
    }
    assert.equal(decision.summary.assertedBindings, asserted.length)
    assert.ok(decision.caveats.some((c) => c.code === 'fleet-cap-soft-on-asserted-bindings'))
  })

  test('requiring acknowledgement closes it, and does not cost the acknowledged agents their slot', () => {
    const decision = evaluateFleet({
      policy: policy({ requireAttestedBinding: true }),
      agents: toFleetAgents(identities),
      evidence: evidenceFor(identities),
    })
    assert.equal(decision.summary.allowed, 1)
    for (const a of identities.filter((i) => i.binding === 'agent-asserted')) {
      const verdict = decision.agents.find((v) => v.label?.includes(a.name))!
      assert.equal(verdict.verdict, 'deny')
      assert.equal(verdict.rules.find((r) => r.rule === 'human-binding')!.pass, false)
    }
  })

  test('the unacknowledged agent names a wallet its own operator also declares — reported, not merged', () => {
    // The live tree is built so this is true: `unverified` names an address that appears in the
    // parent's own `corroborate.subjects`. One operator, two humans, and the only honest move
    // is to say so — merging self-asserted sets would let anyone absorb a stranger.
    const caveats = ensBatchCaveats(identities)
    assert.ok(caveats.some((c) => c.code === 'declared-humans-share-a-wallet'))
    assert.ok(caveats.some((c) => c.code === 'agent-presenter-not-authenticated'))
    assert.equal(humanAddressSets(identities).size >= 2, true)
  })
})
