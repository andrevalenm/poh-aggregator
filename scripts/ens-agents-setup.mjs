#!/usr/bin/env node
/**
 * Register the agent-identity name tree on Sepolia ENS.
 *
 * One parent name for the operator (a human, or a party acting for one) and one subname per
 * agent. The parent carries `corroborate.subjects` — the wallets the operator declares as
 * theirs. Each agent subname carries `corroborate.human` — the name or address of the human
 * who stands behind it. That pair is the whole ENS story: identity for the person, identity
 * for the agent, and a link between them that a counterparty can resolve without asking us.
 *
 * ## Why this script exists at all, when the last attempt concluded it was impossible
 *
 * A previous run parked Sepolia registration ("the artifact controller is deployed but
 * `controllers()` is false on the canonical registrar, no NameRegistered events in recent
 * history"). That was a wrong conclusion drawn from the wrong contract. Read from the chain
 * instead of from an artifact:
 *
 *   - `ENSRegistry.owner(namehash("eth"))` is `0x57f1…eA85`, the canonical BaseRegistrar.
 *   - Its `NameRegistered` topic is `keccak256("NameRegistered(uint256,address,uint256)")`,
 *     which is `0xb3d9…70d9` — **not** the topic the earlier attempt searched for. There
 *     were 13 registrations in the last 10,000 blocks.
 *   - Every one of them was sent to `0xdF60…7078`, and `BaseRegistrar.controllers(0xdF60…)`
 *     returns true.
 *   - Sourcify has that address verified, exact match: `TestnetV1PremigrationRegistrar`,
 *     "free testnet-only v1 registration controller that immediately reserves names in
 *     ENSv2". No commitment, no price oracle, no wait; ≥3 characters and ≥28 days.
 *
 * So Sepolia ENS is not mid-migration and unusable — it is mid-migration and *free*. Every
 * address below was read from the chain or from Sourcify's verified metadata; none was
 * copied from memory or from a blog post.
 *
 * ## Idempotent, and verified by reading back
 *
 * Re-running skips anything already in the state it wants, and every write is confirmed with
 * a read afterwards. `--dry-run` prints the plan and touches nothing.
 *
 *   node scripts/ens-agents-setup.mjs --dry-run
 *   node scripts/ens-agents-setup.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  namehash,
  parseAbi,
  toBytes,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
/** Same hand-rolled reader `scripts/deploy.mjs` uses — the repo root has no dotenv. */
const env = Object.fromEntries(
  readFileSync(resolvePath(REPO_ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

// ---------------------------------------------------------------- what we read from chain

/** Same address on every network; verified here by `owner(namehash("eth"))` answering. */
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
/** `ENSRegistry.owner(namehash("eth"))` on Sepolia. */
const BASE_REGISTRAR = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'
/** `TestnetV1PremigrationRegistrar`, Sourcify exact match, authorised on the registrar. */
const REGISTRAR_CONTROLLER = '0xdf60C561Ca35AD3C89D24BbA854654b1c3477078'
/** `PublicResolver`, Sourcify exact match; the resolver the ENS app sets on Sepolia today. */
const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5'

const registryAbi = parseAbi([
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
  'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)',
])
const baseRegistrarAbi = parseAbi([
  'function available(uint256 id) view returns (bool)',
  'function nameExpires(uint256 id) view returns (uint256)',
])
const controllerAbi = parseAbi([
  'function register((string label,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,uint8 reverseRecord,bytes32 referrer) registration) payable',
])
const resolverAbi = parseAbi([
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
  'function setAddr(bytes32 node, address a)',
  'function setText(bytes32 node, string key, string value)',
  'function multicallWithNodeCheck(bytes32 node, bytes[] data) returns (bytes[])',
])

// ------------------------------------------------------------------------------ the plan

/** One year. Free here, but the expiry is real and the SDK reports it. */
const DURATION = 31_536_000n

/**
 * The tree.
 *
 * `subjects` are wallets the operator declares as theirs — real, public, credential-holding
 * addresses on Gnosis and Optimism that are **not ours**, exactly as `apps/agent/fixtures.js`
 * already declares them. The record is self-asserted and the SDK says so in a caveat; that
 * is the honest shape of the claim and it is why the caveat exists.
 *
 * Each agent's `human` is the name above it, so the binding is countersigned by the registry
 * itself: the same key owns both nodes. `unverified` declares a *raw address* that never
 * consented, which is the weaker shape the caveat is really about — kept in the tree on
 * purpose, because a demo that only shows the good case teaches nothing about the bad one.
 */
const PARENT_LABEL = process.env.ENS_AGENT_PARENT_LABEL ?? env.ENS_AGENT_PARENT_LABEL ?? 'corroborate'
const PARENT = `${PARENT_LABEL}.eth`

const OPERATOR_SUBJECTS = [
  '0xd267eba602e692216703626a81157214b24c85fb', // Proof of Humanity v2, Gnosis
  '0x317C407725145Fa197701045c3383F58fa14204B', // Circles v2, Gnosis
  '0xA6b7471fe0338F8B45266734A1346E6f1D7267b1', // Holonym gov-id + biometrics; Human Passport
]

/** The human `unverified` claims without permission: real, public, and not the node owner. */
const UNCONSENTING_HUMAN = '0xA6b7471fe0338F8B45266734A1346E6f1D7267b1'

const AGENTS = [
  { label: 'alpha', keyEnv: 'AGENT_ALPHA_PRIVATE_KEY', human: PARENT, acknowledged: true },
  { label: 'beta', keyEnv: 'AGENT_BETA_PRIVATE_KEY', human: PARENT, acknowledged: true },
  /**
   * Declares a human who never said yes — and, deliberately, a *second wallet of the same
   * operator* (it is in `OPERATOR_SUBJECTS` above). One-way bindings are not merely weak
   * evidence: they are how the per-human cap gets evaded, because "the human" is whatever
   * address the agent names, and an operator has as many addresses as it wants. The tree
   * carries this case so the demo can show the evasion working and the policy closing it.
   */
  { label: 'unverified', keyEnv: 'AGENT_UNVERIFIED_PRIVATE_KEY', human: UNCONSENTING_HUMAN, acknowledged: false },
]

// ------------------------------------------------------------------------------- helpers

const dryRun = process.argv.includes('--dry-run')

function requireEnv(name) {
  const v = env[name]
  if (!v) throw new Error(`missing ${name} in .env.local`)
  return v
}

const labelhash = (label) => keccak256(toBytes(label))
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

async function main() {
  const rpcUrl = requireEnv('SEPOLIA_RPC_URL')
  const account = privateKeyToAccount(requireEnv('DEPLOYER_PRIVATE_KEY'))
  const pub = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) })

  console.log(`ENS agent tree — Sepolia`)
  console.log(`  deployer   ${account.address}`)
  console.log(`  parent     ${PARENT}`)
  console.log(`  registrar  ${REGISTRAR_CONTROLLER} (free testnet premigration controller)`)
  console.log(`  resolver   ${PUBLIC_RESOLVER}`)
  if (dryRun) console.log(`  DRY RUN — no transaction will be sent`)
  console.log()

  const agents = AGENTS.map((a) => {
    const key = env[a.keyEnv]
    if (!key) throw new Error(`missing ${a.keyEnv} in .env.local — run scripts/ens-agents-keys.mjs`)
    return { ...a, address: privateKeyToAccount(key).address }
  })

  const send = async (what, request) => {
    if (dryRun) {
      console.log(`  would ${what}`)
      return
    }
    const hash = await wallet.writeContract(request)
    const receipt = await pub.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`${what} reverted: ${hash}`)
    console.log(`  ${what} — ${hash} (block ${receipt.blockNumber})`)
  }

  // ---- 1. the parent name ------------------------------------------------------------
  const parentNode = namehash(PARENT)
  const parentId = BigInt(labelhash(PARENT_LABEL))
  const available = await pub.readContract({
    address: BASE_REGISTRAR,
    abi: baseRegistrarAbi,
    functionName: 'available',
    args: [parentId],
  })
  const parentOwner = await pub.readContract({
    address: ENS_REGISTRY,
    abi: registryAbi,
    functionName: 'owner',
    args: [parentNode],
  })

  if (available) {
    // `data` is left empty on purpose, and this cost a transaction to learn.
    //
    // The obvious thing is to set the records in the registration transaction: the struct
    // takes resolver calldata and the controller forwards it to `multicallWithNodeCheck`,
    // which is exactly the atomic path. It cannot work on *this* controller. Read
    // `_registerV1` again: it calls `ENS_REGISTRY.setRecord(namehash, registration.owner, …)`
    // — handing ownership to us — and only *then* calls the resolver. PublicResolver
    // authorises on registry ownership, so by the time the multicall lands the caller
    // (the controller) is no longer the owner and every inner call reverts. `multicall`
    // bubbles that as a bare `require`, which is why the revert carries no reason data.
    // Confirmed below, after registration, by simulating `setText` from both addresses.
    //
    // So: register bare, then write records as the owner. The name is briefly live without
    // records, which is a real (if small) window and is why the SDK treats a missing
    // `corroborate.human` as "not an agent name" rather than as an error.
    await send(`register ${PARENT}`, {
      address: REGISTRAR_CONTROLLER,
      abi: controllerAbi,
      functionName: 'register',
      args: [
        {
          label: PARENT_LABEL,
          owner: account.address,
          duration: DURATION,
          secret: `0x${'00'.repeat(32)}`,
          resolver: PUBLIC_RESOLVER,
          data: [],
          reverseRecord: 0,
          referrer: `0x${'00'.repeat(32)}`,
        },
      ],
    })
  } else if (eq(parentOwner, account.address)) {
    console.log(`  ${PARENT} already registered to us`)
  } else {
    throw new Error(`${PARENT} is taken by ${parentOwner} — set ENS_AGENT_PARENT_LABEL to something free`)
  }

  // ---- 2. the operator's records on the parent ---------------------------------------
  //
  // Two records, and the second is the one that makes the first enforceable.
  //
  //   `corroborate.subjects` — the wallets this human declares. Self-asserted, always.
  //   `corroborate.agents`   — the agents this human *acknowledges*. Also self-asserted, but
  //                            it points the other way, and a binding both ends assert is a
  //                            different claim from one an agent makes about a stranger.
  //
  // Without the second record the per-human cap is unenforceable: the "human" behind an agent
  // is whatever address that agent names, and an operator can name a fresh wallet per agent.
  // `unverified` in the tree below is exactly that attack, run against ourselves.
  const subjects = OPERATOR_SUBJECTS.map((a) => getAddress(a)).join(',')
  const acknowledged = AGENTS.filter((a) => a.acknowledged).map((a) => `${a.label}.${PARENT}`).join(',')
  if (dryRun) {
    console.log(`  would set ${PARENT} addr=${account.address} corroborate.subjects=${subjects}`)
    console.log(`  would set ${PARENT} corroborate.agents=${acknowledged}`)
  } else {
    const currentAgents = await pub.readContract({
      address: PUBLIC_RESOLVER,
      abi: resolverAbi,
      functionName: 'text',
      args: [parentNode, 'corroborate.agents'],
    })
    if (currentAgents !== acknowledged) {
      await send(`set ${PARENT} corroborate.agents → ${acknowledged}`, {
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'setText',
        args: [parentNode, 'corroborate.agents', acknowledged],
      })
    }
    const [addr, current] = await Promise.all([
      pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'addr', args: [parentNode] }),
      pub.readContract({
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'text',
        args: [parentNode, 'corroborate.subjects'],
      }),
    ])
    if (!eq(addr, account.address)) {
      await send(`set ${PARENT} addr → ${account.address}`, {
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'setAddr',
        args: [parentNode, account.address],
      })
    }
    if (current !== subjects) {
      await send(`set ${PARENT} corroborate.subjects → ${OPERATOR_SUBJECTS.length} addresses`, {
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'setText',
        args: [parentNode, 'corroborate.subjects', subjects],
      })
    }
  }

  // ---- 3. one subname per agent ------------------------------------------------------
  for (const agent of agents) {
    const name = `${agent.label}.${PARENT}`
    const node = namehash(name)
    const owner = await pub.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: 'owner',
      args: [node],
    })
    if (owner === zeroAddress) {
      await send(`create ${name}`, {
        address: ENS_REGISTRY,
        abi: registryAbi,
        functionName: 'setSubnodeRecord',
        args: [parentNode, labelhash(agent.label), account.address, PUBLIC_RESOLVER, 0n],
      })
    } else if (!eq(owner, account.address)) {
      throw new Error(`${name} is owned by ${owner}, not us`)
    } else {
      console.log(`  ${name} already exists`)
    }

    if (dryRun) {
      console.log(`  would set ${name} addr=${agent.address} corroborate.human=${agent.human}`)
      continue
    }

    const [currentAddr, currentHuman] = await Promise.all([
      pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'addr', args: [node] }),
      pub.readContract({
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'text',
        args: [node, 'corroborate.human'],
      }),
    ])
    if (!eq(currentAddr, agent.address)) {
      await send(`set ${name} addr → ${agent.address}`, {
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'setAddr',
        args: [node, agent.address],
      })
    }
    if (currentHuman !== agent.human) {
      await send(`set ${name} corroborate.human → ${agent.human}`, {
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'setText',
        args: [node, 'corroborate.human', agent.human],
      })
    }
  }

  if (dryRun) return

  // ---- 4. read everything back -------------------------------------------------------
  console.log(`\nreading the tree back from Sepolia:`)
  const parentAddr = await pub.readContract({
    address: PUBLIC_RESOLVER,
    abi: resolverAbi,
    functionName: 'addr',
    args: [parentNode],
  })
  const subjectsRecord = await pub.readContract({
    address: PUBLIC_RESOLVER,
    abi: resolverAbi,
    functionName: 'text',
    args: [parentNode, 'corroborate.subjects'],
  })
  const expires = await pub.readContract({
    address: BASE_REGISTRAR,
    abi: baseRegistrarAbi,
    functionName: 'nameExpires',
    args: [parentId],
  })
  console.log(`  ${PARENT}`)
  console.log(`    owner    ${await pub.readContract({ address: ENS_REGISTRY, abi: registryAbi, functionName: 'owner', args: [parentNode] })}`)
  console.log(`    addr     ${parentAddr}`)
  console.log(`    subjects ${subjectsRecord}`)
  console.log(`    agents   ${await pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'text', args: [parentNode, 'corroborate.agents'] })}`)
  console.log(`    expires  ${new Date(Number(expires) * 1000).toISOString()}`)

  let ok = eq(parentAddr, account.address) && subjectsRecord.split(',').every((s) => isAddress(s.trim()))
  const record = {
    chainId: sepolia.id,
    parent: PARENT,
    parentNode,
    expires: new Date(Number(expires) * 1000).toISOString(),
    owner: account.address,
    ensRegistry: ENS_REGISTRY,
    baseRegistrar: BASE_REGISTRAR,
    registrarController: REGISTRAR_CONTROLLER,
    resolver: PUBLIC_RESOLVER,
    agents: [],
    note: 'Written by scripts/ens-agents-setup.mjs after every field was read back from Sepolia. The demo and the live suite take the names from here; the answers still come from the chain.',
  }
  for (const agent of agents) {
    const name = `${agent.label}.${PARENT}`
    const node = namehash(name)
    const [owner, resolver, addr, human] = await Promise.all([
      pub.readContract({ address: ENS_REGISTRY, abi: registryAbi, functionName: 'owner', args: [node] }),
      pub.readContract({ address: ENS_REGISTRY, abi: registryAbi, functionName: 'resolver', args: [node] }),
      pub.readContract({ address: PUBLIC_RESOLVER, abi: resolverAbi, functionName: 'addr', args: [node] }),
      pub.readContract({
        address: PUBLIC_RESOLVER,
        abi: resolverAbi,
        functionName: 'text',
        args: [node, 'corroborate.human'],
      }),
    ])
    console.log(`  ${name}`)
    console.log(`    owner    ${owner}`)
    console.log(`    resolver ${resolver}`)
    console.log(`    addr     ${addr}`)
    console.log(`    human    ${human}`)
    ok &&= eq(owner, account.address) && eq(resolver, PUBLIC_RESOLVER) && eq(addr, agent.address) && human === agent.human
    record.agents.push({ name, node, address: addr, human, acknowledged: Boolean(agent.acknowledged) })
  }
  console.log(ok ? '\nall records verified on-chain.' : '\nMISMATCH — a record did not read back as written.')
  if (!ok) {
    process.exitCode = 1
    return
  }
  // Only written when every field read back correctly — a deployment record that can disagree
  // with the chain is worse than none, because everything downstream trusts it for *names*.
  const path = resolvePath(REPO_ROOT, 'deployments/ens-sepolia.json')
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`)
  console.log(`wrote ${path}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
