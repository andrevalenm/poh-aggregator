/**
 * The presenter gate, against the real tree on Sepolia.
 *
 * The unit suite proves the arithmetic. What only the chain can prove is the comparison the gate
 * is actually made of: that the address a signature recovers to is checked against **the address
 * the name resolves to on chain right now**, not against a value this repo wrote down. So every
 * expected address here comes from `resolveEnsAgent`, and the deployment file is used only for
 * the names — the same way a counterparty is handed a name by whoever is asking.
 *
 * The impostor path runs everywhere, because generating a key that does not own a name needs no
 * secrets. The honest path needs the agent's own key, which lives in `.env.local` on the machine
 * that registered the tree; where it is absent the test skips loudly rather than asserting
 * something weaker and calling it a pass.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, isAddressEqual, type Hex, type PublicClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { creationBlocks, resolveEnsAgents, scanNameTree, toFleetAgents, type EnsAgentIdentity } from './ens-agents.ts'
import {
  ensPresentationMessage,
  issueEnsPresentationChallenge,
  verifyEnsPresentation,
  verifyEnsPresentations,
  type EnsPresentationResult,
} from './ens-presentation.ts'
import { evaluateFleet, type FleetPolicy, type HumanEvidence } from './fleet.ts'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const deployment = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'deployments/ens-sepolia.json'), 'utf8'),
) as {
  chainId: number
  parent: string
  owner: string
  agents: { name: string; address: string; human: string; acknowledged: boolean }[]
}

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
}) as PublicClient

const NAMES = deployment.agents.map((a) => a.name)
const DOMAIN = 'meridian.example'
const URI = 'https://meridian.example/order'

/**
 * The agent keys live in `.env.local` — gitignored, present only on the box that registered the
 * tree. No dependency on dotenv: this is one file, read once, and never printed.
 */
function envLocal(): Record<string, string> {
  const path = resolve(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i <= 0 || line.trimStart().startsWith('#')) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const ENV = { ...envLocal(), ...process.env }

/** The private key for an agent name, if this machine holds it. */
function keyFor(name: string): Hex | undefined {
  const label = name.split('.')[0]!.toUpperCase()
  const v = ENV[`AGENT_${label}_PRIVATE_KEY`]
  return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as Hex) : undefined
}

let identities: EnsAgentIdentity[]
const byName = new Map<string, EnsAgentIdentity>()

before(async () => {
  const tree = await scanNameTree(deployment.parent, { candidateLabels: NAMES })
  identities = await resolveEnsAgents(client, NAMES, { createdAtBlock: creationBlocks(tree) })
  for (const id of identities) byName.set(id.name, id)
  const holding = NAMES.filter((n) => keyFor(n)).length
  console.log(
    `    ${identities.length} name(s) resolved from Sepolia; this machine holds ${holding} of ${NAMES.length} agent key(s)`,
  )
})

const challengeFor = (name: string) =>
  issueEnsPresentationChallenge({ domain: DOMAIN, uri: URI, name, chainId: deployment.chainId })

describe('presenting a real name', () => {
  test('a stranger presenting a real name is refused against the address the chain resolves', async (t) => {
    const id = identities[0]!
    if (!id.agent) return t.skip(`${id.name} resolved to no address: ${id.error ?? 'no addr record'}`)

    const impostor = privateKeyToAccount(generatePrivateKey())
    const c = challengeFor(id.name)
    // The impostor writes an entirely well-formed message — right domain, right resource, right
    // nonce, right chain — and signs it correctly. Everything about the presentation is valid
    // except the one thing that matters.
    const message = ensPresentationMessage(c, impostor.address)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: id.name, message, signature: await impostor.signMessage({ message }) },
      expectedAddress: id.agent,
      nodeOwner: id.owner,
    })

    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'signer-is-not-the-name')
    assert.ok(isAddressEqual(r.expected!, id.agent))
    assert.ok(isAddressEqual(r.address!, impostor.address))
    console.log(`    ${id.name} → ${id.agent} on chain; presented by ${impostor.address}: refused`)
  })

  test('the address the gate checks against is the chain’s, not the deployment file’s', async () => {
    // If these ever disagree the chain wins and this fails — the deployment file is a record of
    // what was written, and a signature must be checked against what is there now.
    for (const a of deployment.agents) {
      const id = byName.get(a.name)!
      assert.ok(id.agent, `${a.name} resolved to no address`)
      assert.ok(
        isAddressEqual(id.agent!, a.address as `0x${string}`),
        `${a.name}: chain says ${id.agent}, deployment says ${a.address}`,
      )
    }
  })

  test('the agent’s own key authenticates, and it is not the key that owns the name', async (t) => {
    const id = identities.find((i) => i.agent && keyFor(i.name))
    if (!id) return t.skip(`no agent key for ${NAMES.join(', ')} in .env.local on this machine`)

    const account = privateKeyToAccount(keyFor(id.name)!)
    const c = challengeFor(id.name)
    const message = ensPresentationMessage(c, account.address)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: id.name, message, signature: await account.signMessage({ message }) },
      expectedAddress: id.agent,
      nodeOwner: id.owner,
      client,
    })

    assert.equal(r.status, 'authenticated', r.error)
    assert.equal(r.method, 'eoa-ecdsa')
    assert.ok(isAddressEqual(r.address!, id.agent!))
    // The agent holds its wallet; the tree's owner holds the name. Two keys, and the gate checks
    // the one the counterparty is about to transact with.
    assert.equal(r.signerIsNodeOwner, false)
    assert.ok(id.owner && !isAddressEqual(id.owner, r.address!))
    console.log(`    ${id.name}: signed by ${r.address} (owner of the node is ${id.owner})`)
  })

  test('a harvested signature does not transfer to a sibling name', async (t) => {
    const holder = identities.find((i) => i.agent && keyFor(i.name))
    const sibling = identities.find((i) => i.name !== holder?.name)
    if (!holder || !sibling) return t.skip('need an agent key and a second name in the tree')

    const account = privateKeyToAccount(keyFor(holder.name)!)
    const mine = challengeFor(holder.name)
    const message = ensPresentationMessage(mine, account.address)
    const signature = await account.signMessage({ message })

    // Same signer, same wallet, same counterparty, and deliberately the *same nonce*, so the
    // only thing that differs between the two challenges is the name. The refusal therefore
    // comes from the name binding and from nothing else.
    const theirs = issueEnsPresentationChallenge({
      domain: DOMAIN,
      uri: URI,
      name: sibling.name,
      chainId: deployment.chainId,
      nonce: mine.nonce,
    })
    const r = await verifyEnsPresentation({
      challenge: theirs,
      presentation: { name: sibling.name, message, signature },
      expectedAddress: sibling.agent,
    })
    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'wrong-name')
  })
})

describe('the on-chain signature path', () => {
  test('a contract address that cannot vouch for a signature fails closed against real Sepolia', async () => {
    const id = identities[0]!
    const stranger = privateKeyToAccount(generatePrivateKey())
    const c = challengeFor(id.name)
    // Claim to be a contract (the ENS registry — real code, no ERC-1271) and sign with an
    // unrelated key. Local recovery cannot match, so this goes to the chain: viem's ERC-6492
    // validator runs against a live Sepolia node and the answer must be "no", never "yes".
    const registry = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const
    const message = ensPresentationMessage(c, registry)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: id.name, message, signature: await stranger.signMessage({ message }) },
      expectedAddress: registry,
      client,
    })
    assert.notEqual(r.status, 'authenticated')
    if (r.status === 'unknown') assert.equal(r.failure, 'signature-unreadable')
    else assert.equal(r.failure, 'signature-invalid')
    console.log(`    ERC-1271 path against a live node: ${r.status} (${r.failure})`)
  })
})

describe('the decision it changes', () => {
  const POLICY: FleetPolicy = {
    name: 'Meridian',
    minScore: 0,
    minIndependentRoots: 0,
    maxAgentsPerHuman: 3,
    unbackedAgents: 'count-as-distinct-human',
    admission: 'earliest-registered',
    requirePresenterAuthentication: true,
  }

  /** Evidence enough to clear the (deliberately open) policy, so only the gate can refuse. */
  function evidenceFor(agents: ReturnType<typeof toFleetAgents>): Map<string, HumanEvidence> {
    const m = new Map<string, HumanEvidence>()
    for (const a of agents) {
      if (a.backing.status === 'backed') m.set(a.backing.humanId, { score: 9, independentRoots: 9 })
      else m.set(`unbacked:${a.agent.toLowerCase()}`, { score: 9, independentRoots: 9 })
    }
    return m
  }

  test('with the gate on and nobody authenticated, the whole batch is refused', () => {
    const agents = toFleetAgents(identities, new Map())
    const d = evaluateFleet({ policy: POLICY, agents, evidence: evidenceFor(agents) })
    assert.equal(d.summary.allowed, 0)
    assert.equal(d.summary.denied, agents.length)
    for (const v of d.agents) assert.ok(v.because.includes('no signed presentation'))
  })

  test('exactly the agents that signed are admitted', async (t) => {
    const holders = identities.filter((i) => i.agent && keyFor(i.name))
    if (!holders.length) return t.skip('no agent keys in .env.local on this machine')

    const presentations = await verifyEnsPresentations(
      await Promise.all(
        holders.map(async (id) => {
          const account = privateKeyToAccount(keyFor(id.name)!)
          const challenge = challengeFor(id.name)
          const message = ensPresentationMessage(challenge, account.address)
          return {
            challenge,
            presentation: { name: id.name, message, signature: await account.signMessage({ message }) },
            expectedAddress: id.agent,
            nodeOwner: id.owner,
          }
        }),
      ),
    )
    for (const [name, r] of presentations) assert.equal(r.status, 'authenticated', `${name}: ${r.error}`)

    const agents = toFleetAgents(identities, presentations as Map<string, EnsPresentationResult>)
    const d = evaluateFleet({ policy: POLICY, agents, evidence: evidenceFor(agents) })

    const signed = new Set(holders.map((h) => h.agent!.toLowerCase()))
    for (const v of d.agents) {
      const expected = signed.has(v.agent.toLowerCase()) ? 'allow' : 'deny'
      assert.equal(v.verdict, expected, `${v.label}: ${v.because}`)
    }
    assert.equal(d.summary.allowed, holders.length)
    console.log(
      `    ${d.summary.allowed} of ${agents.length} admitted; ` +
        `${d.summary.unauthenticatedPresenters} presenter(s) unproven`,
    )
  })
})
