/**
 * Farcaster, against the real `IdRegistry` on OP Mainnet.
 *
 * The thing worth testing here is not "does this address have a fid" — it is the **dating**,
 * because the registry stores no dates and the probe derives them by searching `idCounter`
 * over historical state. A search can be subtly wrong in a way that still returns a plausible
 * timestamp, and on a `Ramp` curve a plausible-but-early date is free weight.
 *
 * So every date this suite checks is confirmed against a second, independent path: the
 * `Register` event. State says the fid was created in block B; the log index says the same fid
 * has exactly one `Register` in block B and none in the thousand blocks before it. Those two
 * facts come from different subsystems of the node, and the probe uses only the first.
 *
 * No address is hard-coded. Subjects are read out of `custodyOf(fid)` at run time, so the
 * suite follows the registry rather than a snapshot of it.
 *
 * Run: node --test --experimental-strip-types src/adapters/farcaster.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createPublicClient,
  decodeAbiParameters,
  fallback,
  http,
  numberToHex,
  parseAbi,
  toEventSelector,
  type Log,
} from 'viem'
import { optimism } from 'viem/chains'
import {
  farcasterAdapter,
  FARCASTER_ARCHIVE_RPCS,
  FARCASTER_COUNTER_LANDMARKS,
  FARCASTER_ID_REGISTRY,
  FARCASTER_ID_REGISTRY_DEPLOY_BLOCK,
} from './farcaster.ts'
import { freshnessOf, effectiveCost } from '../scoring.ts'
import type { Address, Adapter } from '../types.ts'

/** Nobody holds the key to this address, so nobody has ever registered a fid to it. */
const NO_ACCOUNT = '0x0000000000000000000000000000000000000001' as Address

const REGISTRY_ABI = parseAbi([
  'function idCounter() view returns (uint256)',
  'function idOf(address owner) view returns (uint256)',
  'function custodyOf(uint256 fid) view returns (address)',
  'function VERSION() view returns (string)',
])

const REGISTER_TOPIC = toEventSelector('Register(address,uint256,address)')
/** Emitted when the registry's counter is set administratively rather than by a registration. */
const SET_ID_COUNTER_TOPIC = toEventSelector('SetIdCounter(uint256,uint256)')

/**
 * The suite's own reader, deliberately independent of the probe's. It fails over across the
 * same endpoints because the whole test file — and the rest of the live suite, which shares
 * `mainnet.optimism.io` with Human Passport — runs concurrently against public endpoints that
 * rate-limit per second.
 */
const client = createPublicClient({
  chain: optimism,
  transport: fallback(
    FARCASTER_ARCHIVE_RPCS.map((url) => http(url, { timeout: 20_000, retryCount: 0 })),
    { retryCount: 3, retryDelay: 800 },
  ),
})

/**
 * One adapter for the whole file. Its sample cache is the point: every search narrows the
 * bracket for the next one, so sharing it keeps this suite gentle on a public endpoint that
 * does throttle.
 */
const adapter = farcasterAdapter()

const logsIn = (from: bigint, to: bigint, topics: (string | null)[]) =>
  client.request({
    method: 'eth_getLogs',
    params: [
      { address: FARCASTER_ID_REGISTRY, fromBlock: numberToHex(from), toBlock: numberToHex(to), topics } as never,
    ],
  }) as Promise<Log[]>

const custodyOf = (fid: bigint, blockNumber?: bigint) =>
  client.readContract({
    address: FARCASTER_ID_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'custodyOf',
    args: [fid],
    ...(blockNumber === undefined ? {} : { blockNumber }),
  })

/** An unreachable public endpoint says nothing about the mechanism, so skip loudly. */
function skipIfUnreachable(t: { skip: (m: string) => void }, what: string, error?: string): boolean {
  if (!error) return false
  t.skip(`${what}: OP Mainnet archive unreachable — ${error.split('\n')[0]}`)
  return true
}

/**
 * Both keyless archive endpoints rate-limit per IP, and this file shares them with the probe
 * and with the rest of the live suite running concurrently. Running out of quota is an
 * operational fact about a free endpoint, not a statement about the registry, so it skips —
 * while an assertion failure inside the body still reddens the suite, which is the point.
 */
async function onChain(t: { skip: (m: string) => void }, what: string, body: () => Promise<void>) {
  try {
    await body()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!/rate limit|requests per second|too many requests|429|paid plan|timed out|timeout/i.test(message)) throw e
    t.skip(`${what}: OP Mainnet endpoints exhausted — ${message.split('\n').find((l) => l.includes('Details:')) ?? message.split('\n')[0]}`)
  }
}

const ontologyJson = JSON.parse(
  readFileSync(new URL('../../../../ontology/adapters.json', import.meta.url), 'utf8'),
) as { adapters: (Adapter & { id: string })[] }
const farcasterEntry = ontologyJson.adapters.find((a) => a.id === 'farcaster-account')!

describe('Farcaster IdRegistry (live, OP Mainnet)', () => {
  test('the registry is the deployment the search assumes, and its floor is real', async (t) => {
    await onChain(t, 'deployment', async () => {
      const [version, code, codeBefore, counterAtDeploy] = await Promise.all([
        client.readContract({ address: FARCASTER_ID_REGISTRY, abi: REGISTRY_ABI, functionName: 'VERSION' }),
        client.getCode({ address: FARCASTER_ID_REGISTRY, blockNumber: FARCASTER_ID_REGISTRY_DEPLOY_BLOCK }),
        client.getCode({ address: FARCASTER_ID_REGISTRY, blockNumber: FARCASTER_ID_REGISTRY_DEPLOY_BLOCK - 1n }),
        client.readContract({
          address: FARCASTER_ID_REGISTRY,
          abi: REGISTRY_ABI,
          functionName: 'idCounter',
          blockNumber: FARCASTER_ID_REGISTRY_DEPLOY_BLOCK,
        }),
      ])
      assert.equal(version, '2023.11.15')
      assert.ok(code && code !== '0x', 'the declared deploy block must hold the registry code')
      assert.ok(!codeBefore || codeBefore === '0x', 'the block before it must not')
      // The search brackets every fid between this block and head. If the counter were ever
      // non-zero here the lower bound would be a lie and dates could come back too early.
      assert.equal(counterAtDeploy, 0n, 'idCounter must be 0 at the search floor')
    })
  })

  test('every seeded counter landmark still matches the chain', async (t) => {
    await onChain(t, 'landmarks', async () => {
      // The landmarks only bracket a search, and `findFidRegistration` verifies its own answer
      // against the chain before returning — so a stale one cannot silently misdate anybody.
      // It can still make searches slow or throw, and `idCounter` at a past block is immutable,
      // so any disagreement here is a defect in the table rather than drift in the world.
      for (const [block, counter] of FARCASTER_COUNTER_LANDMARKS) {
        const onChainValue = await client.readContract({
          address: FARCASTER_ID_REGISTRY,
          abi: REGISTRY_ABI,
          functionName: 'idCounter',
          blockNumber: block,
        })
        assert.equal(onChainValue, counter, `landmark at block ${block}`)
      }
      // The pair that carries the imported cohort: everything up to 193,791 is bracketed by
      // these two blocks alone, which is why that cohort costs no search calls at all.
      const cliff = FARCASTER_COUNTER_LANDMARKS.filter(([b]) => b === 111_904_737n || b === 111_904_738n)
      assert.equal(cliff.length, 2, 'the import cliff must be seeded from both sides')
      assert.equal(cliff[0]![1], 0n)
      assert.ok(cliff[1]![1] > 190_000n)
    })
  })

  test('an address with no fid is absent, and the registry size is reported', async (t) => {
    await onChain(t, 'absent address', async () => {
      const r = await adapter.probe(NO_ACCOUNT)
      if (skipIfUnreachable(t, 'absent address', r.error)) return
      assert.equal(r.held, false)
      assert.equal(r.detail?.['registered'], false)
      assert.ok((r.detail?.['registrySize'] as number) > 3_000_000, 'registry size should be reported')
      assert.equal(r.issuedAt, undefined, 'an absent credential has no date')
    })
  })

  test('the date derived from idCounter is the block the Register event is in', async (t) => {
    await onChain(t, 'recent fid', async () => {
      // A fid a little behind head: recent enough that the search crosses the whole range, old
      // enough that no reorg is plausible.
      const size = await client.readContract({
        address: FARCASTER_ID_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'idCounter',
      })
      const fid = size - 1_000n
      const subject = (await custodyOf(fid)) as Address

      const r = await adapter.probe(subject)
      if (skipIfUnreachable(t, 'recent fid', r.error)) return
      assert.equal(r.held, true)
      assert.equal(r.detail?.['fid'], fid.toString())
      assert.equal(r.detail?.['importedFromPredecessorRegistry'], false)

      const block = BigInt(r.detail?.['registeredAtBlock'] as number)
      const fidTopic = numberToHex(fid, { size: 32 })

      // Independent confirmation, from the log index rather than from state: exactly one
      // Register for this fid in the block the counter search picked...
      const here = await logsIn(block, block, [REGISTER_TOPIC, null, fidTopic])
      assert.equal(here.length, 1, `expected one Register for fid ${fid} in block ${block}`)
      const registeredTo = decodeAbiParameters([{ type: 'address' }], here[0]!.topics[1]!)[0]
      assert.equal(
        registeredTo.toLowerCase(),
        String(r.detail?.['transferred'] ? r.detail?.['originalCustody'] : subject).toLowerCase(),
        'the address the registry logged as registrant must be the one the probe read from state',
      )

      // ...and none in the thousand blocks before it, which is what makes it the *first* block
      // where the counter reached this fid rather than merely a block where it had.
      const before = await logsIn(block - 1_000n, block - 1n, [REGISTER_TOPIC, null, fidTopic])
      assert.equal(before.length, 0, 'the fid must not have been registered before the derived block')

      // The timestamp we hand to the ramp is that block's, not an interpolation.
      const header = await client.getBlock({ blockNumber: block })
      assert.equal(r.detail?.['registeredAt'], Number(header.timestamp))
    })
  })

  test('the imported cohort is dated to an admin SetIdCounter, and says so', async (t) => {
    await onChain(t, 'imported cohort', async () => {
      const subject = (await custodyOf(1n)) as Address
      const r = await adapter.probe(subject)
      if (skipIfUnreachable(t, 'fid 1', r.error)) return
      assert.equal(r.held, true)
      assert.equal(r.detail?.['fid'], '1')
      assert.equal(r.detail?.['importedFromPredecessorRegistry'], true)
      assert.ok(
        r.provenance?.notes.includes('date-from-registry-import'),
        'an imported credential must be flagged, since its real age is older than its date',
      )

      const block = BigInt(r.detail?.['registeredAtBlock'] as number)
      const created = r.detail?.['idsCreatedInThatBlock'] as number

      // The claim being tested is that this block did not register anything: it set the counter.
      // 193,791 ids could not be registered in one block — the custody rows were written before
      // it — so treating this date as an issuance date would be wrong, and the probe does not.
      const all = await logsIn(block, block, [])
      assert.equal(all.length, 1, 'the counter block should carry exactly one registry event')
      assert.equal(all[0]!.topics[0], SET_ID_COUNTER_TOPIC, 'and that event should be SetIdCounter')
      const [oldCounter, newCounter] = decodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        all[0]!.data as `0x${string}`,
      )
      assert.equal(oldCounter, 0n)
      assert.equal(newCounter, BigInt(created), 'idsCreatedInThatBlock must be the jump SetIdCounter made')

      const registers = await logsIn(block, block, [REGISTER_TOPIC])
      assert.equal(registers.length, 0, 'no fid was registered in the block that dates the whole cohort')

      // Custody predates the counter, which is exactly why the date is a floor and not the truth.
      const earlier = await custodyOf(1n, block - 2n)
      assert.equal(
        (earlier as string).toLowerCase(),
        String((await custodyOf(1n, block)) as string).toLowerCase(),
        'fid 1 was already custodied before the counter was set',
      )
    })
  })

  test('a transferred id is dated from acquisition, not from registration', async (t) => {
    await onChain(t, 'transfer', async () => {
      // Find a subject whose fid changed hands, rather than pinning one: an OTC sale can move
      // any particular fid at any time, and the property under test is about the mechanism.
      const size = await client.readContract({
        address: FARCASTER_ID_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'idCounter',
      })
      let found: { fid: bigint; subject: Address; result: Awaited<ReturnType<typeof adapter.probe>> } | undefined
      for (const fid of [1n, 2n, 3n, 200_000n, size / 2n]) {
        const subject = (await custodyOf(fid)) as Address
        const result = await adapter.probe(subject)
        if (skipIfUnreachable(t, 'transfer scan', result.error)) return
        if (result.detail?.['transferred'] === true) {
          found = { fid, subject, result }
          break
        }
      }
      if (!found) {
        t.skip('none of the sampled fids has changed hands — transfer path not exercised this run')
        return
      }
      const { fid, subject, result } = found

      assert.ok(
        result.provenance?.notes.includes('credential-transferred-since-issuance'),
        'a bought credential must be flagged as one',
      )
      const registeredAt = result.detail?.['registeredAt'] as number
      const custodySince = result.detail?.['custodySince'] as number
      assert.ok(custodySince > registeredAt, 'acquisition must be later than registration')
      assert.equal(result.issuedAt, custodySince, 'the ramp must be fed the acquisition, not the fid age')

      // The bisection's answer is a claim about two adjacent blocks. Check both.
      const at = BigInt(result.detail?.['custodySinceBlock'] as number)
      const [now, before] = await Promise.all([custodyOf(fid, at), custodyOf(fid, at - 1n)])
      assert.equal((now as string).toLowerCase(), subject.toLowerCase(), 'subject must hold the fid at that block')
      assert.notEqual(
        (before as string).toLowerCase(),
        subject.toLowerCase(),
        'and must not hold it in the block before, or the acquisition is dated too late',
      )
    })
  })

  test('an unreachable endpoint is an error, never a negative', async () => {
    const broken = farcasterAdapter({ rpcUrls: ['http://127.0.0.1:9'], timeoutMs: 1_500 })
    const r = await broken.probe(NO_ACCOUNT)
    assert.equal(r.held, false)
    assert.ok(r.error, 'a dead endpoint must surface as an error')
    assert.ok(r.error!.includes('127.0.0.1:9'), 'and must name the endpoint that failed')
    // The point of the rule: this result is excluded from scoring, not counted as "no account".
    assert.equal(r.detail, undefined)
  })

  test('the ramp prices the subsidy cohort at nothing and a 2023 id as a root', async (t) => {
    await onChain(t, 'ramp', async () => {
      const size = await client.readContract({
        address: FARCASTER_ID_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'idCounter',
      })
      const recent = await adapter.probe((await custodyOf(size - 1_000n)) as Address)
      if (skipIfUnreachable(t, 'ramp check', recent.error)) return

      // The old side of the comparison must be a fid still held by its importer, since a fid
      // that changed hands is deliberately dated from the sale. Find one by comparing custody
      // at the import block with custody now — much cheaper than probing each candidate. The
      // import block is the first landmark with a non-zero counter, by construction.
      const importBlock = FARCASTER_COUNTER_LANDMARKS.find(([, counter]) => counter > 0n)![0]
      let old: Awaited<ReturnType<typeof adapter.probe>> | undefined
      for (let fid = 1n; fid <= 12n; fid++) {
        const [then, now] = await Promise.all([custodyOf(fid, importBlock), custodyOf(fid)])
        if ((then as string).toLowerCase() !== (now as string).toLowerCase()) continue
        old = await adapter.probe(now as Address)
        break
      }
      if (!old) {
        t.skip('every sampled low fid has changed hands — no original-holder vector this run')
        return
      }
      if (skipIfUnreachable(t, 'ramp check', old.error)) return

      const now = Math.floor(Date.now() / 1000)
      const costOf = (issuedAt?: number) =>
        effectiveCost(farcasterEntry, freshnessOf(farcasterEntry, issuedAt, now))

      // 20 cents at a 730-day half-life: an id has to outlive the subsidy window before it is
      // worth more than the negligible-cost floor of 10 cents. That is the whole reason this
      // adapter is on a Ramp — two thirds of the registry was minted inside nine months.
      assert.ok(costOf(recent.issuedAt) < 10, `a days-old fid should be negligible, got ${costOf(recent.issuedAt)}`)
      assert.ok(costOf(old.issuedAt) >= 10, `a 2023 fid should clear the floor, got ${costOf(old.issuedAt)}`)
      assert.ok(costOf(old.issuedAt) <= farcasterEntry.rentCostCents, 'and can never exceed the rent price')
    })
  })
})
