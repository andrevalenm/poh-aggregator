#!/usr/bin/env node
// Deploy PersonhoodRegistry and seed it from ontology/adapters.json.
// Usage: node scripts/deploy.mjs [--seed-only]

import { createWalletClient, createPublicClient, http, keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const EVIDENCE_CLASS = {
  Unspecified: 0,
  Uniqueness: 1,
  StateIdentity: 2,
  SocialTrust: 3,
  Liveness: 4,
  Behavioral: 5,
}
const AGE_CURVE = { None: 0, Decay: 1, Ramp: 2 }

const artifact = JSON.parse(readFileSync('contracts/out/PersonhoodRegistry.json', 'utf8'))
const ontology = JSON.parse(readFileSync('ontology/adapters.json', 'utf8'))

const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY)
const transport = http(env.SEPOLIA_RPC_URL)
const pub = createPublicClient({ chain: sepolia, transport })
const wallet = createWalletClient({ account, chain: sepolia, transport })

const DEPLOYMENTS = 'deployments/sepolia.json'

const bal = await pub.getBalance({ address: account.address })
console.log(`deployer ${account.address}  balance ${Number(bal) / 1e18} ETH`)
if (bal === 0n) {
  console.error('deployer has no funds')
  process.exit(1)
}

let registry
const seedOnly = process.argv.includes('--seed-only')

if (seedOnly && existsSync(DEPLOYMENTS)) {
  registry = JSON.parse(readFileSync(DEPLOYMENTS, 'utf8')).PersonhoodRegistry
  console.log(`reusing registry at ${registry}`)
} else {
  console.log('deploying PersonhoodRegistry…')
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [account.address],
  })
  const receipt = await pub.waitForTransactionReceipt({ hash })
  registry = receipt.contractAddress
  console.log(`  deployed at ${registry} (block ${receipt.blockNumber}, gas ${receipt.gasUsed})`)

  mkdirSync('deployments', { recursive: true })
  writeFileSync(
    DEPLOYMENTS,
    JSON.stringify(
      {
        chainId: sepolia.id,
        PersonhoodRegistry: registry,
        deployedAtBlock: Number(receipt.blockNumber),
        deployer: account.address,
        txHash: hash,
      },
      null,
      2,
    ) + '\n',
  )
}

// ---- seed ------------------------------------------------------------------

console.log(`\nseeding ${ontology.adapters.length} adapters…`)
let nonce = await pub.getTransactionCount({ address: account.address })
const pending = []

// Only write what actually differs. Every setAdapter bumps `revision` and emits the full
// record, and that event stream is the audit trail a subject reads to ask why their score
// moved — so re-seeding an unchanged adapter would fabricate a change that never happened.
const onChain = new Map()
if (seedOnly) {
  const [ids, rows] = await pub.readContract({
    address: registry,
    abi: artifact.abi,
    functionName: 'allAdapters',
  })
  ids.forEach((id, i) => onChain.set(id, rows[i]))
}

const unchanged = (id, a) => {
  const r = onChain.get(id)
  return (
    r &&
    r.name === a.name &&
    r.evidenceClass === EVIDENCE_CLASS[a.evidenceClass] &&
    r.trustRoot === keccak256(toHex(`root:${a.trustRoot}`)) &&
    r.forgeCostCents === BigInt(a.forgeCostCents) &&
    r.rentCostCents === BigInt(a.rentCostCents) &&
    r.decayHalfLifeDays === a.decayHalfLifeDays &&
    r.ageCurve === AGE_CURVE[a.ageCurve] &&
    r.live === a.live &&
    r.sourceURI === a.sourceURI
  )
}

let skipped = 0
for (const a of ontology.adapters) {
  const id = keccak256(toHex(`adapter:${a.id}`))
  if (unchanged(id, a)) {
    skipped++
    continue
  }
  const hash = await wallet.writeContract({
    address: registry,
    abi: artifact.abi,
    functionName: 'setAdapter',
    nonce: nonce++,
    args: [
      keccak256(toHex(`adapter:${a.id}`)),
      a.id,
      a.name,
      EVIDENCE_CLASS[a.evidenceClass],
      keccak256(toHex(`root:${a.trustRoot}`)),
      BigInt(a.forgeCostCents),
      BigInt(a.rentCostCents),
      a.decayHalfLifeDays,
      AGE_CURVE[a.ageCurve],
      a.live,
      a.sourceURI,
    ],
  })
  pending.push({ id: a.id, root: a.trustRoot, hash })
  process.stdout.write(`  ${a.id} … `)
  console.log(hash.slice(0, 12))
}

if (skipped) console.log(`  (${skipped} already identical on-chain, left alone)`)

console.log('\nwaiting for confirmations…')
await Promise.all(pending.map((p) => pub.waitForTransactionReceipt({ hash: p.hash })))

const count = await pub.readContract({
  address: registry,
  abi: artifact.abi,
  functionName: 'adapterCount',
})
const revision = await pub.readContract({
  address: registry,
  abi: artifact.abi,
  functionName: 'revision',
})
console.log(`\nregistry ${registry}: ${count} adapters, revision ${revision}`)

// Record what is actually deployed, so the revision a score cites can be resolved to an
// ontology without trusting anyone's memory of which seed ran when.
{
  const record = JSON.parse(readFileSync(DEPLOYMENTS, 'utf8'))
  record.ontology = {
    adapters: Number(count),
    trustRoots: new Set(ontology.adapters.map((a) => a.trustRoot)).size,
    revision: Number(revision),
    seededAt: new Date().toISOString().slice(0, 10),
    // A no-op re-seed must not erase the record of which adapters last moved the revision, nor
    // the prose explaining what that revision was — this rewrite is otherwise lossy, and the
    // note is the only place the reason for a revision is written down.
    ...(record.ontology?.note ? { note: record.ontology.note } : {}),
    changedInLastSeed: pending.length
      ? pending.map((p) => p.id)
      : (record.ontology?.changedInLastSeed ?? []),
  }
  writeFileSync(DEPLOYMENTS, JSON.stringify(record, null, 2) + '\n')
}

// Prove the correlation grouping works on real deployed data.
const roots = [...new Set(ontology.adapters.map((a) => a.trustRoot))]
console.log('\ncorrelated sets (these saturate rather than sum):')
for (const r of roots) {
  const ids = await pub.readContract({
    address: registry,
    abi: artifact.abi,
    functionName: 'adaptersByTrustRoot',
    args: [keccak256(toHex(`root:${r}`))],
  })
  const names = ontology.adapters.filter((a) => a.trustRoot === r).map((a) => a.id)
  const flag = ids.length > 1 ? '  <-- shared root' : ''
  console.log(`  ${r}: ${ids.length} (${names.join(', ')})${flag}`)
}
