#!/usr/bin/env node
// Register print.eth on Sepolia via commit-reveal, setting the address and the
// print.subjects text record atomically inside the registration's resolver-data array.
//
// The subjects record is the product idea, not a convenience: ENS is where a person
// declares which wallets are theirs. resolve("name.eth") expands the set from the record —
// user-controlled, on-chain, serverless, revocable. Self-asserted, so the SDK attaches an
// address-set-asserted-by-name-owner caveat; listed addresses have not countersigned.

import { createWalletClient, createPublicClient, http, namehash, encodeFunctionData, toHex } from 'viem'
import { randomBytes } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const LABEL = 'print'
const NAME = `${LABEL}.eth`
const DURATION = 365n * 24n * 3600n
// The demo subject set: real credential-holding wallets (PoH on one, Circles on the other),
// demonstrating the one-person-many-wallets mechanism. Demo assertion, not a claim of
// personal control — the SDK's caveat covers exactly this distinction.
const SUBJECTS = '0xd267eba602e692216703626a81157214b24c85fb,0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87'

const controller = JSON.parse(readFileSync('scripts/abi/ens-controller-sepolia.json', 'utf8'))
const resolver = JSON.parse(readFileSync('scripts/abi/ens-resolver-sepolia.json', 'utf8'))

const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY)
const transport = http(env.SEPOLIA_RPC_URL)
const pub = createPublicClient({ chain: sepolia, transport })
const wallet = createWalletClient({ account, chain: sepolia, transport })

const node = namehash(NAME)
const resolverData = [
  encodeFunctionData({ abi: resolver.abi, functionName: 'setAddr', args: [node, account.address] }),
  encodeFunctionData({ abi: resolver.abi, functionName: 'setText', args: [node, 'print.subjects', SUBJECTS] }),
  encodeFunctionData({
    abi: resolver.abi, functionName: 'setText',
    args: [node, 'description', 'Print — personhood scored by independent trust roots. subjects record = the wallets this name asserts as one person.'],
  }),
]

import('node:fs').then(()=>{}) // (fs already imported above)
const COMMIT_STATE = 'deployments/.ens-commit.json'
let secret
let reusing = false
try {
  const prev = JSON.parse(readFileSync(COMMIT_STATE, 'utf8'))
  if (prev.label === LABEL && prev.subjects === SUBJECTS) { secret = prev.secret; reusing = true }
} catch {}
if (!secret) secret = toHex(randomBytes(32))

const registration = {
  label: LABEL,
  owner: account.address,
  duration: DURATION,
  secret,
  resolver: resolver.address,
  data: resolverData,
  reverseRecord: 0,
  referrer: '0x' + '0'.repeat(64),
}

const available = await pub.readContract({ address: controller.address, abi: controller.abi, functionName: 'available', args: [LABEL] })
if (!available) {
  console.log(`${NAME} not available — checking whether we already own it`)
} else {
  const commitment = await pub.readContract({
    address: controller.address, abi: controller.abi, functionName: 'makeCommitment', args: [registration],
  })
  if (!reusing) {
    writeFileSync(COMMIT_STATE, JSON.stringify({ label: LABEL, subjects: SUBJECTS, secret }) + '\n', { mode: 0o600 })
    console.log(`committing ${NAME} …`)
    const c = await wallet.writeContract({ address: controller.address, abi: controller.abi, functionName: 'commit', args: [commitment] })
    await pub.waitForTransactionReceipt({ hash: c })
  } else {
    console.log('reusing persisted commitment')
  }

  const wait = Number(await pub.readContract({ address: controller.address, abi: controller.abi, functionName: 'minCommitmentAge' }))
  console.log(`waiting ${wait + 5}s commit age …`)
  await new Promise((r) => setTimeout(r, (wait + 5) * 1000))

  const price = await pub.readContract({
    address: controller.address, abi: controller.abi, functionName: 'rentPrice', args: [LABEL, DURATION],
  })
  const base = typeof price === 'object' && 'base' in price ? price.base : price[0]
  const premium = typeof price === 'object' && 'premium' in price ? price.premium : price[1]
  const value = ((base + premium) * 110n) / 100n
  console.log(`registering for ${Number(value) / 1e18} ETH …`)
  const r = await wallet.writeContract({
    address: controller.address, abi: controller.abi, functionName: 'register', args: [registration], value,
  })
  const receipt = await pub.waitForTransactionReceipt({ hash: r })
  console.log(`registered in block ${receipt.blockNumber}`)
}

// Verify end to end through public ENS resolution — no hard-coded values downstream.
const addr = await pub.getEnsAddress({ name: NAME })
const subjects = await pub.getEnsText({ name: NAME, key: 'print.subjects' })
console.log(`\nverification via Sepolia ENS:`)
console.log(`  ${NAME} -> ${addr}`)
console.log(`  print.subjects -> ${subjects}`)
if (!addr || !subjects) { console.error('resolution failed'); process.exit(1) }

writeFileSync('deployments/ens-sepolia.json', JSON.stringify({
  name: NAME, owner: account.address, node,
  resolver: resolver.address, controller: controller.address,
  textRecords: { 'print.subjects': subjects },
}, null, 2) + '\n')
try { const { unlinkSync } = await import('node:fs'); unlinkSync(COMMIT_STATE) } catch {}
console.log('\nsaved deployments/ens-sepolia.json')
