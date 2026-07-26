/**
 * ENS agent identity, without a network.
 *
 * The live tree on Sepolia proves the records resolve; these tests pin the *decisions* made
 * over them, including the ones the live tree cannot show — an unreachable resolver, a name
 * acknowledging an agent it does not own, a human named two different ways.
 *
 * The fake client answers exactly the three reads the module makes (addr, text, registry
 * owner) and nothing else, so a test that passes because a read was skipped fails here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { namehash } from 'viem'
import {
  AGENT_HUMAN_RECORD,
  HUMAN_AGENTS_RECORD,
  HUMAN_SUBJECTS_RECORD,
  creationBlocks,
  ensBatchCaveats,
  ensHumanId,
  humanAddressSets,
  resolveEnsAgent,
  resolveEnsHuman,
  sharedWalletHumans,
  toFleetAgents,
  type EnsAgentIdentity,
  type NameTreeScan,
} from './ens-agents.ts'
import { evaluateFleet, type FleetPolicy, type HumanEvidence } from './fleet.ts'

const HUMAN_WALLET = '0x1111111111111111111111111111111111111111'
const OTHER_WALLET = '0x2222222222222222222222222222222222222222'
const AGENT_A = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'
const AGENT_B = '0xbBbBBBBbbBBBbbbBbbBbbbbbBBbBbbbbBbBbbBBb'
const AGENT_C = '0xCcCCCcCCcccCCcCCCCcCCCcCcccCCCcCCccCcccC'
const OWNER = '0x9999999999999999999999999999999999999999'

type Records = Record<string, { addr?: string; text?: Record<string, string>; owner?: string }>

/** A client that answers only what the module asks for, and throws where told to. */
function fakeClient(records: Records, opts: { failText?: string[]; failAddr?: string[] } = {}) {
  return {
    async getEnsAddress({ name }: { name: string }) {
      if (opts.failAddr?.includes(name)) throw new Error('resolver unreachable')
      return records[name]?.addr ?? null
    },
    async getEnsText({ name, key }: { name: string; key: string }) {
      if (opts.failText?.includes(name)) throw new Error('resolver unreachable')
      return records[name]?.text?.[key] ?? null
    },
    async readContract({ args }: { args: readonly unknown[] }) {
      const node = args[0] as string
      for (const [name, r] of Object.entries(records)) {
        if (namehash(name) === node) return r.owner ?? '0x0000000000000000000000000000000000000000'
      }
      return '0x0000000000000000000000000000000000000000'
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const TREE: Records = {
  'print.eth': {
    addr: HUMAN_WALLET,
    owner: OWNER,
    text: {
      [HUMAN_SUBJECTS_RECORD]: `${OTHER_WALLET}`,
      [HUMAN_AGENTS_RECORD]: 'alpha.print.eth,beta.print.eth',
    },
  },
  'alpha.print.eth': { addr: AGENT_A, owner: OWNER, text: { [AGENT_HUMAN_RECORD]: 'print.eth' } },
  'beta.print.eth': { addr: AGENT_B, owner: OWNER, text: { [AGENT_HUMAN_RECORD]: 'print.eth' } },
  'rogue.example.eth': { addr: AGENT_B, owner: OWNER, text: { [AGENT_HUMAN_RECORD]: 'print.eth' } },
  'orphan.print.eth': { addr: AGENT_A, owner: OWNER },
}

describe('resolving an agent name', () => {
  test('a name the human lists back is a mutual binding', async () => {
    const id = await resolveEnsAgent(fakeClient(TREE), 'alpha.print.eth')
    assert.equal(id.binding, 'mutual')
    assert.equal(id.agent, AGENT_A)
    assert.equal(id.owner, OWNER)
    assert.equal(id.human?.name, 'print.eth')
    assert.equal(id.human?.humanId, ensHumanId(HUMAN_WALLET))
    assert.ok(id.caveats.some((c) => c.code === 'agent-human-binding-mutual'))
    assert.equal(id.error, undefined)
  })

  test('the human’s address set is its addr record plus its declared subjects, deduped', async () => {
    const id = await resolveEnsAgent(fakeClient(TREE), 'alpha.print.eth')
    assert.deepEqual(id.human?.subjects, [HUMAN_WALLET, OTHER_WALLET])
  })

  test('a name the human does NOT list is asserted, however genuine it looks', async () => {
    // Same records, same human, same owner — the only difference is the acknowledgement, and
    // the acknowledgement is the whole difference.
    const id = await resolveEnsAgent(fakeClient(TREE), 'rogue.example.eth')
    assert.equal(id.binding, 'agent-asserted')
    assert.equal(id.human?.humanId, ensHumanId(HUMAN_WALLET))
    assert.ok(id.caveats.some((c) => c.code === 'agent-human-binding-asserted'))
  })

  test('a bare address can never acknowledge, so naming one is always one-way', async () => {
    const records: Records = {
      'solo.print.eth': { addr: AGENT_A, text: { [AGENT_HUMAN_RECORD]: HUMAN_WALLET } },
    }
    const id = await resolveEnsAgent(fakeClient(records), 'solo.print.eth')
    assert.equal(id.binding, 'agent-asserted')
    assert.equal(id.human?.address, HUMAN_WALLET)
    assert.deepEqual(id.human?.subjects, [HUMAN_WALLET])
    assert.match(
      id.caveats.find((c) => c.code === 'agent-human-binding-asserted')!.message,
      /cannot exist on a bare address/,
    )
  })

  test('a human named by name and by address is one human, not two', async () => {
    const byName = await resolveEnsHuman(fakeClient(TREE), 'print.eth')
    const byAddress = await resolveEnsHuman(fakeClient(TREE), HUMAN_WALLET)
    assert.equal(byName.humanId, byAddress.humanId)
  })

  test('an agent with no observer.print.human record names nobody, and says so', async () => {
    const id = await resolveEnsAgent(fakeClient(TREE), 'orphan.print.eth')
    assert.equal(id.binding, 'unbound')
    assert.equal(id.human, undefined)
    assert.ok(id.caveats.some((c) => c.code === 'agent-declares-no-human'))
    assert.equal(id.error, undefined)
  })

  test('an unreadable resolver is unreadable, never unbound', async () => {
    const id = await resolveEnsAgent(fakeClient(TREE, { failText: ['alpha.print.eth'] }), 'alpha.print.eth')
    assert.equal(id.binding, 'unreadable')
    assert.match(id.error!, /could not read observer.print.human/)
  })

  test('an unreadable human side is unreadable too — the agent is not judged on half a read', async () => {
    const id = await resolveEnsAgent(
      fakeClient(TREE, { failText: ['print.eth'], failAddr: ['print.eth'] }),
      'alpha.print.eth',
    )
    assert.equal(id.binding, 'unreadable')
    assert.match(id.human!.error!, /could not resolve print.eth/)
  })

  test('a malformed name is rejected without a network call', async () => {
    let called = false
    const client = { async getEnsAddress() { called = true; return null } } as never
    const id = await resolveEnsAgent(client, 'not a name')
    assert.match(id.error!, /not a valid ENS name/)
    assert.equal(called, false)
  })

  test('a human record that is neither a name nor an address errors rather than guessing', async () => {
    const records: Records = { 'x.print.eth': { addr: AGENT_A, text: { [AGENT_HUMAN_RECORD]: '!! nope !!' } } }
    const id = await resolveEnsAgent(fakeClient(records), 'x.print.eth')
    assert.equal(id.binding, 'unreadable')
    assert.match(id.human!.error!, /neither an address nor a valid ENS name/)
  })

  test('acknowledgement matching is normalized, not string-compared', async () => {
    const records: Records = {
      'human.eth': { addr: HUMAN_WALLET, text: { [HUMAN_AGENTS_RECORD]: ' ALPHA.print.eth , ' } },
      'alpha.print.eth': { addr: AGENT_A, text: { [AGENT_HUMAN_RECORD]: 'human.eth' } },
    }
    const id = await resolveEnsAgent(fakeClient(records), 'alpha.print.eth')
    assert.equal(id.binding, 'mutual')
  })
})

describe('feeding the fleet engine', () => {
  const identity = (over: Partial<EnsAgentIdentity>): EnsAgentIdentity => ({
    name: 'a.print.eth',
    node: namehash('a.print.eth'),
    binding: 'mutual',
    caveats: [],
    ...over,
  })

  test('binding strength survives the mapping', () => {
    const [mutual, asserted, broken, unbound] = toFleetAgents([
      identity({ agent: AGENT_A, human: human('mutual') }),
      identity({ name: 'b.print.eth', agent: AGENT_B, binding: 'agent-asserted', human: human('asserted') }),
      identity({ name: 'c.print.eth', agent: AGENT_C, binding: 'unreadable', error: 'RPC down' }),
      identity({ name: 'd.print.eth', agent: OTHER_WALLET, binding: 'unbound' }),
    ])
    assert.equal(mutual!.backing.status === 'backed' && mutual!.backing.binding, 'attested')
    assert.equal(asserted!.backing.status === 'backed' && asserted!.backing.binding, 'asserted')
    assert.equal(broken!.backing.status, 'unknown')
    assert.equal(unbound!.backing.status, 'unbacked')
  })

  test('an agent with no addr record still gets a distinct key, and it is not a wallet', () => {
    const [a, b] = toFleetAgents([
      identity({ name: 'a.print.eth', node: namehash('a.print.eth'), human: human('m') }),
      identity({ name: 'b.print.eth', node: namehash('b.print.eth'), human: human('m') }),
    ])
    assert.notEqual(a!.agent, b!.agent)
    assert.match(a!.agent, /^0xname:/)
  })

  test('two names for one wallet are one agent, and the acknowledged name settles the binding', () => {
    // A wallet named twice is not two agents, and judging it twice would let a cap of one
    // refuse a wallet on account of its own second name. The engine keys agents by address,
    // so the collapse has to happen here.
    const agents = toFleetAgents([
      identity({ name: 'alias.print.eth', agent: AGENT_A, binding: 'agent-asserted', human: human('h1'), createdAtBlock: 20 }),
      identity({ name: 'alpha.print.eth', agent: AGENT_A, binding: 'mutual', human: human('h1'), createdAtBlock: 10 }),
    ])
    assert.equal(agents.length, 1)
    assert.equal(agents[0]!.backing.status === 'backed' && agents[0]!.backing.binding, 'attested')
    assert.equal(agents[0]!.registeredAtBlock, 10, 'the earliest of the two names dates the wallet')
    assert.match(agents[0]!.label!, /alias.print.eth \+ alpha.print.eth/)
  })

  test('two names claiming different humans for one wallet is a contradiction, not a fact', () => {
    const agents = toFleetAgents([
      identity({ name: 'a.print.eth', agent: AGENT_A, human: human('h1') }),
      identity({ name: 'b.elsewhere.eth', agent: AGENT_A, human: human('h2') }),
    ])
    assert.equal(agents.length, 1)
    assert.equal(agents[0]!.backing.status, 'unknown')
    assert.match((agents[0]!.backing as { error: string }).error, /contradictory bindings/)
  })

  test('a wallet named twice is reported to the counterparty', () => {
    const caveats = ensBatchCaveats([
      identity({ name: 'a.print.eth', agent: AGENT_A, human: human('h1') }),
      identity({ name: 'b.print.eth', agent: AGENT_A, human: human('h1') }),
    ])
    assert.ok(caveats.some((c) => c.code === 'one-wallet-presented-under-several-names'))
  })

  test('one address set per human, not per agent', () => {
    const sets = humanAddressSets([
      identity({ agent: AGENT_A, human: human('h1') }),
      identity({ name: 'b.print.eth', agent: AGENT_B, human: human('h1') }),
    ])
    assert.equal(sets.size, 1)
  })

  test('two declared humans claiming one wallet is reported, never merged', () => {
    const ids = [
      identity({ agent: AGENT_A, human: { ...human('h1'), subjects: [HUMAN_WALLET, OTHER_WALLET] } }),
      identity({ name: 'b.print.eth', agent: AGENT_B, human: { ...human('h2'), subjects: [OTHER_WALLET] } }),
    ]
    const shared = sharedWalletHumans(ids)
    assert.equal(shared.length, 1)
    assert.equal(shared[0]!.wallet, OTHER_WALLET)
    assert.equal(humanAddressSets(ids).size, 2, 'the humans stay separate')
    assert.ok(ensBatchCaveats(ids).some((c) => c.code === 'declared-humans-share-a-wallet'))
  })

  test('the presenter is never claimed to be authenticated', () => {
    assert.ok(ensBatchCaveats([]).some((c) => c.code === 'agent-presenter-not-authenticated'))
  })
})

/**
 * The evasion this whole design exists to close, run end to end over the pure engine.
 *
 * Three agents, one operator. Two admit they belong to the same human; the third names a second
 * wallet of that same operator and is therefore a *different* human as far as any cap can tell.
 */
describe('minting humans defeats a per-human cap unless the binding is attested', () => {
  const policy = (over: Partial<FleetPolicy> = {}): FleetPolicy => ({
    name: 'Meridian',
    minScore: 2.5,
    minIndependentRoots: 2,
    maxAgentsPerHuman: 1,
    unbackedAgents: 'deny',
    admission: 'earliest-registered',
    ...over,
  })
  const strong: HumanEvidence = { score: 3.6, independentRoots: 3 }
  const agents = () =>
    toFleetAgents([
      {
        name: 'alpha.print.eth',
        node: namehash('alpha.print.eth'),
        agent: AGENT_A,
        binding: 'mutual',
        caveats: [],
        createdAtBlock: 10,
        human: { declared: 'print.eth', name: 'print.eth', address: HUMAN_WALLET, subjects: [HUMAN_WALLET], acknowledges: [], humanId: ensHumanId(HUMAN_WALLET) },
      },
      {
        name: 'beta.print.eth',
        node: namehash('beta.print.eth'),
        agent: AGENT_B,
        binding: 'mutual',
        caveats: [],
        createdAtBlock: 11,
        human: { declared: 'print.eth', name: 'print.eth', address: HUMAN_WALLET, subjects: [HUMAN_WALLET], acknowledges: [], humanId: ensHumanId(HUMAN_WALLET) },
      },
      {
        name: 'unverified.print.eth',
        node: namehash('unverified.print.eth'),
        agent: AGENT_C,
        binding: 'agent-asserted',
        caveats: [],
        createdAtBlock: 12,
        human: { declared: OTHER_WALLET, address: OTHER_WALLET, subjects: [OTHER_WALLET], acknowledges: [], humanId: ensHumanId(OTHER_WALLET) },
      },
    ])
  const evidence = new Map([
    [ensHumanId(HUMAN_WALLET), strong],
    [ensHumanId(OTHER_WALLET), strong],
  ])

  test('admitting one-way claims lets the third agent hold a slot of its own', () => {
    const d = evaluateFleet({ policy: policy(), agents: agents(), evidence })
    assert.equal(d.summary.allowed, 2, 'the cap said one agent per human and two got in')
    assert.equal(d.summary.humans, 2, 'because a second wallet is a second human')
    assert.equal(d.summary.assertedBindings, 1)
    assert.ok(d.caveats.some((c) => c.code === 'fleet-cap-soft-on-asserted-bindings'))
    assert.equal(d.agents.find((a) => a.label === 'unverified.print.eth')!.verdict, 'allow')
  })

  test('requiring an acknowledgement closes it, and one human keeps exactly one slot', () => {
    const d = evaluateFleet({ policy: policy({ requireAttestedBinding: true }), agents: agents(), evidence })
    assert.equal(d.summary.allowed, 1)
    const unverified = d.agents.find((a) => a.label === 'unverified.print.eth')!
    assert.equal(unverified.verdict, 'deny')
    assert.equal(unverified.rules.find((r) => r.rule === 'human-binding')!.pass, false)
    assert.match(unverified.because, /has not acknowledged it/)
  })

  test('a refusal on binding does not spend the human’s slot', () => {
    // The asserted agent is presented *first* and shares its human with a mutual sibling. If
    // the binding rule ran after the allocation, it would take the slot and then be refused,
    // leaving the acknowledged sibling denied for a slot nobody holds.
    const [alpha, , asserted] = agents()
    const shared = [
      { ...asserted!, backing: { ...asserted!.backing, humanId: ensHumanId(HUMAN_WALLET) } as never, registeredAtBlock: 1 },
      alpha!,
    ]
    const d = evaluateFleet({ policy: policy({ requireAttestedBinding: true }), agents: shared, evidence })
    assert.equal(d.agents.find((a) => a.label === 'unverified.print.eth')!.verdict, 'deny')
    assert.equal(d.agents.find((a) => a.label === 'alpha.print.eth')!.verdict, 'allow')
  })

  test('an unreadable binding is indeterminate under both policies', () => {
    const broken = toFleetAgents([
      { name: 'x.print.eth', node: namehash('x.print.eth'), agent: AGENT_A, binding: 'unreadable', error: 'RPC down', caveats: [] },
    ])
    for (const p of [policy(), policy({ requireAttestedBinding: true })]) {
      const d = evaluateFleet({ policy: p, agents: broken, evidence })
      assert.equal(d.agents[0]!.verdict, 'indeterminate')
    }
  })
})

describe('naming a tree', () => {
  const scan: NameTreeScan = {
    parent: 'print.eth',
    parentNode: namehash('print.eth'),
    subnodes: [],
    named: [
      { labelhash: '0x01', node: '0x01', owner: OWNER, block: 7, label: 'alpha', name: 'alpha.print.eth' },
    ],
    unnamed: [{ labelhash: '0x02', node: '0x02', owner: OWNER, block: 8 }],
    coverage: { fromBlock: 1, toBlock: 9, endpoint: 'test', calls: 1 },
    caveats: [],
  }

  test('creation blocks are keyed by full name so slot order can come from the chain', () => {
    const blocks = creationBlocks(scan)
    assert.equal(blocks.get('alpha.print.eth'), 7)
    assert.equal(blocks.size, 1, 'an unnamed subnode cannot be keyed by a name it does not have')
  })
})

function human(id: string) {
  return {
    declared: 'print.eth',
    name: 'print.eth',
    address: HUMAN_WALLET as `0x${string}`,
    subjects: [HUMAN_WALLET as `0x${string}`],
    acknowledges: [],
    humanId: `ens-human:${id}`,
  }
}
