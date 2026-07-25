import { keccak256, toHex } from 'viem'

const SCHEMA = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9'
const EAS = '0x4200000000000000000000000000000000000021'
const ATTESTED = keccak256(toHex('Attested(address,address,bytes32,bytes32)'))
const URL = process.env.EP || 'https://base.gateway.tenderly.co'

async function rpc(method, params, ms = 120_000) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(ms),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${json.error.code}: ${json.error.message}`)
  return json.result
}

const head = BigInt(await rpc('eth_blockNumber', []))
const recipient = process.env.R || '0xcab9b4792a9d4c55e3ad1dc0a5b4cba2592e7828'
const topicR = toHex(BigInt(recipient), { size: 32 })

for (const span of [1_000_000n, 5_000_000n, 20_000_000n, head]) {
  const from = head > span ? head - span : 0n
  const t0 = Date.now()
  try {
    const logs = await rpc('eth_getLogs', [
      { address: EAS, fromBlock: toHex(from), toBlock: toHex(head), topics: [ATTESTED, topicR, null, SCHEMA] },
    ])
    console.log(`span ${span}: ${logs.length} logs in ${Date.now() - t0}ms`)
  } catch (e) {
    console.log(`span ${span}: FAIL after ${Date.now() - t0}ms — ${String(e.message).slice(0, 100)}`)
  }
}
