#!/usr/bin/env node
// ENS registration, attempt 2. The atomic resolver-data path reverted opaquely, so:
// (a) try to decode the revert via simulation on an RPC that returns error data;
// (b) register BARE (no data[], resolver still set), then write records as node owner —
//     that path depends only on registry ownership, not on controller<->resolver trust.
import { createWalletClient, createPublicClient, http, namehash, toHex } from 'viem'
import { randomBytes } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))

const LABEL='print', NAME='print.eth'
const DURATION=365n*24n*3600n
const SUBJECTS='0xd267eba602e692216703626a81157214b24c85fb,0x7D8459e2ca3f62E6d8599E98ebf8c42d88218C87'
const controller=JSON.parse(readFileSync('scripts/abi/ens-controller-sepolia.json','utf8'))
const resolver=JSON.parse(readFileSync('scripts/abi/ens-resolver-sepolia.json','utf8'))
const account=privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY)
// drpc returns revert data where publicnode strips it.
const pub=createPublicClient({chain:sepolia,transport:http('https://sepolia.drpc.org')})
const wallet=createWalletClient({account,chain:sepolia,transport:http('https://sepolia.drpc.org')})
const node=namehash(NAME)

const available=await pub.readContract({address:controller.address,abi:controller.abi,functionName:'available',args:[LABEL]})
console.log('available:',available)

if (available) {
  const registration={label:LABEL,owner:account.address,duration:DURATION,secret:toHex(randomBytes(32)),
    resolver:resolver.address,data:[],reverseRecord:0,referrer:'0x'+'0'.repeat(64)}

  const commitment=await pub.readContract({address:controller.address,abi:controller.abi,functionName:'makeCommitment',args:[registration]})
  console.log('committing (bare, no resolver data)…')
  const c=await wallet.writeContract({address:controller.address,abi:controller.abi,functionName:'commit',args:[commitment]})
  await pub.waitForTransactionReceipt({hash:c})
  const wait=Number(await pub.readContract({address:controller.address,abi:controller.abi,functionName:'minCommitmentAge'}))
  console.log(`waiting ${wait+8}s…`)
  await new Promise(r=>setTimeout(r,(wait+8)*1000))

  const price=await pub.readContract({address:controller.address,abi:controller.abi,functionName:'rentPrice',args:[LABEL,DURATION]})
  const base='base' in price?price.base:price[0], premium='premium' in price?price.premium:price[1]
  const value=((base+premium)*110n)/100n

  // Simulate first so a revert surfaces its custom error instead of burning gas.
  try {
    await pub.simulateContract({address:controller.address,abi:controller.abi,functionName:'register',
      args:[registration],value,account})
    console.log('simulation OK — registering…')
  } catch(e) {
    console.error('SIMULATION REVERT:', e.metaMessages?.[0] ?? '', e.shortMessage, e.cause?.data ?? e.cause?.raw ?? '')
    process.exit(1)
  }
  const r=await wallet.writeContract({address:controller.address,abi:controller.abi,functionName:'register',args:[registration],value})
  const rc=await pub.waitForTransactionReceipt({hash:r})
  console.log('registered in block',rc.blockNumber)
}

// Records as node owner — auth via registry, independent of controller trust.
console.log('writing records as owner…')
for (const [fn,args] of [
  ['setAddr',[node,account.address]],
  ['setText',[node,'print.subjects',SUBJECTS]],
  ['setText',[node,'description','Print — personhood scored by independent trust roots. subjects record = the wallets this name asserts as one person.']],
]) {
  try {
    const h=await wallet.writeContract({address:resolver.address,abi:resolver.abi,functionName:fn,args})
    await pub.waitForTransactionReceipt({hash:h})
    console.log(`  ${fn} ok`)
  } catch(e){ console.error(`  ${fn} FAILED:`, e.shortMessage); process.exit(1) }
}

const addr=await pub.getEnsAddress({name:NAME})
const subjects=await pub.getEnsText({name:NAME,key:'print.subjects'})
console.log(`\n${NAME} -> ${addr}\ncorroborate.subjects -> ${subjects}`)
if(!addr||!subjects){console.error('resolution failed');process.exit(1)}
writeFileSync('deployments/ens-sepolia.json',JSON.stringify({name:NAME,owner:account.address,node,
  resolver:resolver.address,controller:controller.address,textRecords:{'print.subjects':subjects}},null,2)+'\n')
try{unlinkSync('deployments/.ens-commit.json')}catch{}
console.log('saved deployments/ens-sepolia.json')
