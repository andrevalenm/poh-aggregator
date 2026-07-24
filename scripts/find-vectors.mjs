// Find real addresses that actually hold credentials, for the demo and for tests.
import { createPublicClient, http, parseAbiItem } from 'viem'
import { gnosis, worldchain } from 'viem/chains'
import { writeFileSync } from 'node:fs'

const gn = createPublicClient({ chain: gnosis, transport: http('https://rpc.gnosischain.com') })
const wc = createPublicClient({ chain: worldchain, transport: http('https://worldchain-mainnet.g.alchemy.com/public') })

const POH = '0xa4AC94C4fa65Bb352eFa30e3408e64F72aC857bc'
const CIRCLES = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8'
const AGENTBOOK = '0xA23aB2712eA7BBa896930544C7d6636a96b944dA'

const isHumanAbi = [{ type:'function', name:'isHuman', stateMutability:'view', inputs:[{name:'a',type:'address'}], outputs:[{type:'bool'}] }]
const lookupAbi  = [{ type:'function', name:'lookupHuman', stateMutability:'view', inputs:[{name:'a',type:'address'}], outputs:[{type:'uint256'}] }]

const out = { poh: [], circles: [], world: [] }

// --- Circles: RegisterHuman(avatar, inviter) gives us addresses directly
const head = await gn.getBlockNumber()
const regs = await gn.getLogs({
  address: CIRCLES,
  event: parseAbiItem('event RegisterHuman(address indexed avatar, address indexed inviter)'),
  fromBlock: head - 40000n, toBlock: head,
})
console.log(`Circles RegisterHuman events: ${regs.length}`)
for (const l of regs.slice(-25)) {
  const a = l.args.avatar
  const [c, p, w] = await Promise.all([
    gn.readContract({ address: CIRCLES, abi: isHumanAbi, functionName: 'isHuman', args: [a] }).catch(() => false),
    gn.readContract({ address: POH, abi: isHumanAbi, functionName: 'isHuman', args: [a] }).catch(() => false),
    wc.readContract({ address: AGENTBOOK, abi: lookupAbi, functionName: 'lookupHuman', args: [a] }).catch(() => 0n),
  ])
  if (c) out.circles.push({ address: a, circles: c, poh: p, world: w !== 0n })
  if (p) out.poh.push(a)
  if (w !== 0n) out.world.push(a)
}

// --- PoH: humanity ids -> owner via CrossChainProofOfHumanity? use Transfer-ish events
const claims = await gn.getLogs({
  address: POH,
  event: parseAbiItem('event HumanityClaimed(bytes20 indexed humanityId, uint256 requestId)'),
  fromBlock: head - 300000n, toBlock: head,
})
console.log(`PoH HumanityClaimed events: ${claims.length}`)
// the claimer isn't the tx sender (relayer batches), so scan internal: check recent PoH interactions
const pohTouched = new Set()
for (const l of claims.slice(-40)) {
  const r = await gn.getTransactionReceipt({ hash: l.transactionHash })
  for (const lg of r.logs) {
    for (const t of lg.topics.slice(1)) {
      if (t && t.startsWith('0x000000000000000000000000')) pohTouched.add('0x' + t.slice(26))
    }
  }
}
console.log(`candidate addresses from PoH tx logs: ${pohTouched.size}`)
for (const a of [...pohTouched].slice(0, 60)) {
  const p = await gn.readContract({ address: POH, abi: isHumanAbi, functionName: 'isHuman', args: [a] }).catch(() => false)
  if (p) out.poh.push(a)
}

out.poh = [...new Set(out.poh)]
out.circles = out.circles.filter((v, i, s) => s.findIndex(x => x.address === v.address) === i)
console.log('\nFOUND:')
console.log('  PoH-registered:', out.poh.length, out.poh.slice(0,5))
console.log('  Circles-registered:', out.circles.length, out.circles.slice(0,5).map(x=>x.address))
console.log('  World Orb:', out.world.length, out.world.slice(0,5))
writeFileSync('scripts/vectors.json', JSON.stringify(out, null, 2))
