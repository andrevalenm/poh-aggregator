/**
 * World ID, against the real World Chain.
 *
 * The claim under test is not "this address is verified". It is the arithmetic that turns one
 * mapping value into a date: `addressVerifiedUntil[account] - verificationLength()` is supposed
 * to be the exact timestamp of the block the verification was mined in, and the whole adapter
 * rests on that being true today, a year ago, and for the term never having been changed
 * underneath the entries already written.
 *
 * So the suite asks three different parts of the chain the same question. The `AccountVerified`
 * log index says which block a verification landed in. The block header says what time that was.
 * The mapping says when it expires. The probe only ever consults the third, and the other two
 * have to agree with what it derives — recently *and* at a sample fifteen months old, which is
 * what licenses applying today's term to yesterday's entries.
 *
 * The second claim is that an entry means somebody proved an Orb credential. That is checked by
 * simulating `verify()` and reading which check fails: a made-up merkle root fails the root
 * history, the group's real root fails the Groth16 pairing, and both fail identically for a
 * stranger, for the relayer that submits real verifications and for the contract's owner — so
 * the gate is the proof and not the caller.
 *
 * No subject is hard-coded: every address here comes out of the contract's own logs at run time.
 *
 * Run: node --test --experimental-strip-types src/adapters/world.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  type Log,
} from 'viem'
import { worldchain } from 'viem/chains'
import {
  interpretWorldRead,
  worldIdOrbAdapter,
  WORLD_ADDRESS_BOOK_ABI,
  WORLD_ADDRESS_BOOK_DEPLOYED_AT,
  WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK,
  WORLD_ADDRESS_BOOK_VERIFICATION_LENGTH,
  WORLD_AGENT_BOOK,
  WORLD_AGENT_BOOK_ABI,
  WORLD_ID_ADDRESS_BOOK,
  WORLD_ID_ORB_GROUP_ID,
  WORLD_ID_ROUTER,
  WORLD_RPC,
} from './world.ts'
import { readVerificationTermHistory } from './world-term.ts'
import type { TermHistory } from '../term-history.ts'
import { freshnessOf } from '../scoring.ts'
import { applyAsOfToEvidence } from '../as-of.ts'
import {
  AGENT_BOOK_ABI,
  AGENT_BOOK_LOG_ENDPOINTS,
  AGENT_BOOK_FIRST_REGISTRATION_AGENT,
  AGENT_BOOK_FIRST_REGISTRATION_BLOCK,
  registrationOf,
} from '../agentbook.ts'
import type { Address, Adapter, AdapterProbeResult, Evidence } from '../types.ts'

/** Nobody holds the key to this address, so nobody has ever verified with it. */
const NEVER_VERIFIED = '0x000000000000000000000000000000000000dEaD' as Address

/** Semaphore's root-history check. Raised before any pairing work happens. */
const NON_EXISTENT_ROOT = '0xddae3b71'
/** The Groth16 verifier's own failure. Reaching it proves the pairing check ran. */
const PROOF_INVALID = '0x7fcdd1f4'

const c = createPublicClient({ chain: worldchain, transport: http(WORLD_RPC, { timeout: 20_000 }) })

const ROUTER_ABI = parseAbi(['function routeFor(uint256 groupNumber) view returns (address)'])
const GROUP_ABI = parseAbi(['function latestRoot() view returns (uint256)'])
const SHIM_ABI = parseAbi(['function worldIdRouter() view returns (address)'])

const ontologyJson = JSON.parse(
  readFileSync(new URL('../../../../ontology/adapters.json', import.meta.url), 'utf8'),
) as { adapters: (Adapter & { id: string; implemented?: boolean; notes?: string })[] }
const entryFor = (id: string) => ontologyJson.adapters.find((a) => a.id === id)!

/**
 * One probe result, priced as of an instant — what `Corroborate.resolve` builds internally,
 * assembled here so a live probe can be fed straight to the as-of layer without a registry
 * subgraph in the loop. Freshness is evaluated at `at` for the same reason the scorer does it:
 * a credential restored at a past instant is worth what it was worth then.
 */
const evidenceAt = (
  adapter: Adapter,
  observedOn: Address,
  r: AdapterProbeResult,
  at: number,
): Evidence => ({
  adapterId: adapter.id,
  adapterName: adapter.name,
  evidenceClass: adapter.evidenceClass,
  trustRoot: adapter.trustRoot,
  observedOn,
  held: r.held,
  ...(r.issuedAt !== undefined ? { issuedAt: r.issuedAt } : {}),
  ...(r.issuedAfter !== undefined ? { issuedAfter: r.issuedAfter } : {}),
  ...(r.heldUntil !== undefined ? { heldUntil: r.heldUntil } : {}),
  freshness: freshnessOf(adapter, r.issuedAt, at, r.issuedAfter),
  effectiveCostCents: 0,
  forgeCostCents: adapter.forgeCostCents,
  rentCostCents: adapter.rentCostCents,
  live: adapter.live,
  sourceURI: adapter.sourceURI,
})

/** Public endpoints throttle; an exhausted quota says nothing about the mechanism. */
async function onChain(t: { skip: (m: string) => void }, what: string, body: () => Promise<void>) {
  try {
    await body()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!/rate limit|requests per second|too many requests|429|timed out|timeout|fetch failed|capacity/i.test(message)) {
      throw e
    }
    t.skip(`${what}: World Chain endpoint unavailable — ${message.split('\n')[0]}`)
  }
}

type VerifiedLog = Log<bigint, number, false, undefined, true, typeof WORLD_ADDRESS_BOOK_ABI, 'AccountVerified'>

/**
 * `AccountVerified` logs from a 100-block window, walking back until one is non-empty.
 *
 * 100 blocks is the largest range this endpoint serves, which is a limit and not a problem: the
 * contract writes tens of thousands of verifications a day, so a single window at head holds
 * dozens of them. Walking back matters only for the historical samples.
 */
async function verificationsNear(from: bigint, attempts = 8): Promise<VerifiedLog[]> {
  for (let i = 0; i < attempts; i++) {
    const start = from - BigInt(i) * 100n
    const logs = await c.getLogs({
      address: WORLD_ID_ADDRESS_BOOK,
      event: WORLD_ADDRESS_BOOK_ABI.find((x) => x.type === 'event' && x.name === 'AccountVerified')!,
      fromBlock: start - 99n,
      toBlock: start,
    })
    if (logs.length) return logs as VerifiedLog[]
  }
  return []
}

/**
 * The one endpoint that serves World Chain logs over a useful range — `agentbook.ts` explains why
 * the list is one long. Used here only to *find* subjects; the probe is what is under test.
 */
const logClient = createPublicClient({
  chain: worldchain,
  transport: http(AGENT_BOOK_LOG_ENDPOINTS[0].url, { timeout: 30_000 }),
})

const AGENT_REGISTERED = AGENT_BOOK_ABI.find(
  (x) => x.type === 'event' && x.name === 'AgentRegistered',
)!

/**
 * One adapter for the whole suite, which is how a process uses it.
 *
 * Not a convenience. The probe memoises its `verificationLength` sweep per instance, so nine
 * instances meant nine full-history sweeps against the one keyless World Chain log endpoint — the
 * same endpoint `agentbook.live.test.ts` scans twice, in parallel, under `node --test`. Sharing the
 * instance keeps the suite's footprint on it to one sweep, and exercises the memo besides.
 */
const orb = worldIdOrbAdapter()

/**
 * The default-chunk term sweep, read once for the whole suite — same reason as `orb` above.
 * Pinned to the head it first saw, which is what a process does.
 */
let sweptTerms: Promise<{ termAtHead: number; head: number; history: TermHistory | undefined }> | undefined
const termTimeline = () =>
  (sweptTerms ??= (async () => {
    const [head, term] = await Promise.all([
      c.getBlockNumber(),
      c.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'verificationLength',
      }),
    ])
    const termAtHead = Number(term)
    return {
      termAtHead,
      head: Number(head),
      history: await readVerificationTermHistory(termAtHead, Number(head)),
    }
  })())

/** Recent `AgentRegistered` logs, walking back in 200k-block windows until one is non-empty. */
async function registrationsNear(from: bigint, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const to = from - BigInt(i) * 200_000n
    const logs = await logClient.getLogs({
      address: WORLD_AGENT_BOOK,
      event: AGENT_REGISTERED,
      fromBlock: to - 199_999n,
      toBlock: to,
    })
    if (logs.length) return logs
  }
  return []
}

/** eth_call that returns the revert payload instead of throwing it away. */
async function revertDataOf(from: Address, to: Address, data: `0x${string}`): Promise<string> {
  const res = await fetch(WORLD_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ from, to, data }, 'latest'],
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const json = (await res.json()) as { error?: { data?: string; message?: string }; result?: string }
  if (!json.error) return `NO REVERT: ${json.result}`
  return json.error.data ?? json.error.message ?? 'unknown'
}

describe('World ID on World Chain', () => {
  test('the date the probe derives is the block the verification was mined in', async (t) => {
    await onChain(t, 'date derivation', async () => {
      const head = await c.getBlockNumber()
      const logs = await verificationsNear(head)
      assert.ok(logs.length >= 3, `expected recent verifications, saw ${logs.length}`)
      const term = await c.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'verificationLength',
      })

      // Claim 1: the log's own payload is the block timestamp plus the term, to the second.
      const sample = logs.slice(0, 6)
      for (const log of sample) {
        const block = await c.getBlock({ blockNumber: log.blockNumber })
        assert.equal(
          log.args.verifiedUntil - term,
          block.timestamp,
          `verifiedUntil - term should be the mining timestamp for ${log.args.account}`,
        )
      }

      // Claim 2: the probe, which reads only the mapping, lands on the same second.
      const first = sample[0]!
      const block = await c.getBlock({ blockNumber: first.blockNumber })
      const current = await c.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'addressVerifiedUntil',
        args: [first.args.account],
      })
      if (current !== first.args.verifiedUntil) {
        t.skip('the sampled account re-verified between the log and the read')
        return
      }
      const r = await orb.probe(getAddress(first.args.account))
      assert.equal(r.held, true)
      assert.equal(r.issuedAt, Number(block.timestamp))
      assert.equal(r.provenance?.dateFrom, 'chain')
      assert.ok(r.provenance?.notes.includes('date-from-latest-reattestation'))
    })
  })

  test('the same arithmetic holds on verifications from fifteen months ago', async (t) => {
    await onChain(t, 'historical date derivation', async () => {
      // ~20M blocks at two seconds a block, so 2025-04 — before the router was swapped in
      // 2026-01, which is the only configuration change the contract has ever seen.
      const head = await c.getBlockNumber()
      const logs = await verificationsNear(head - 20_000_000n)
      assert.ok(logs.length >= 3, `expected historical verifications, saw ${logs.length}`)
      const term = await c.readContract({
        address: WORLD_ID_ADDRESS_BOOK,
        abi: WORLD_ADDRESS_BOOK_ABI,
        functionName: 'verificationLength',
      })
      const block = await c.getBlock({ blockNumber: logs[0]!.blockNumber })
      assert.ok(
        Number(block.timestamp) < WORLD_ADDRESS_BOOK_DEPLOYED_AT + 400 * 86_400,
        'the historical sample should be genuinely old',
      )
      for (const log of logs.slice(0, 6)) {
        const b = await c.getBlock({ blockNumber: log.blockNumber })
        assert.equal(log.args.verifiedUntil - term, b.timestamp)
      }
    })
  })

  test('the term and the group are the ones the contract was initialised with', async (t) => {
    await onChain(t, 'configuration', async () => {
      // The single-block window the contract was deployed in.
      const [init] = await c.getLogs({
        address: WORLD_ID_ADDRESS_BOOK,
        event: WORLD_ADDRESS_BOOK_ABI.find(
          (x) => x.type === 'event' && x.name === 'WorldIDAddressBookInitialized',
        )!,
        fromBlock: BigInt(WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK),
        toBlock: BigInt(WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK),
      })
      assert.ok(init, 'the deployment block should carry the initialisation event')
      const deployBlock = await c.getBlock({ blockNumber: BigInt(WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK) })
      assert.equal(Number(deployBlock.timestamp), WORLD_ADDRESS_BOOK_DEPLOYED_AT)

      const [term, groupId] = await Promise.all([
        c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'verificationLength',
        }),
        c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'groupId',
        }),
      ])
      assert.equal(Number(init.args.verificationLength), WORLD_ADDRESS_BOOK_VERIFICATION_LENGTH)
      assert.equal(groupId, init.args.groupId)
      assert.equal(groupId, WORLD_ID_ORB_GROUP_ID, 'group 1 is the Orb group')
      // `term === init.args.verificationLength` used to be asserted here, and it was a tripwire:
      // it fires the day the owner calls `setVerificationLength` and has nothing to offer in
      // place of the date it invalidates. The timeline below replaces it — it holds whether or
      // not the term has moved, and it keeps dating entries correctly when it does.
      assert.ok(Number(term) > 0)
    })
  })

  /**
   * The term is not a constant, and the sweep that says so.
   *
   * Every World date is `verifiedUntil - verificationLength`, and `setVerificationLength` moves
   * that field without touching a single stored expiry — one owner transaction re-dates the whole
   * book at once, in the same direction, by the full size of the change. `world-term.ts` reads
   * every such change as a timeline so each entry is dated with the term in force when it was
   * written.
   *
   * These assertions are about the *mechanism* and stay true on the day a change lands: that the
   * timeline explains head, that it opens at the deployment, that its eras are contiguous and
   * half-open, and that every boundary is the header timestamp of its own block. Zero
   * `VerificationLengthUpdated` logs exist today, so today it is one era — which is the finding,
   * not the assumption.
   */
  test('the term timeline is swept from the chain and explains the value at head', async (t) => {
    await onChain(t, 'term timeline', async () => {
      const { termAtHead, history } = await termTimeline()
      assert.ok(history, 'the governance sweep should answer from a keyless endpoint')
      assert.equal(history.observed, true)

      // Opens at the deployment, because the constructor's own log is what opens it — the guard
      // that catches an endpoint dropping the old end of a range.
      const deployBlock = await c.getBlock({
        blockNumber: BigInt(WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK),
      })
      assert.equal(history.eras[0]!.from, Number(deployBlock.timestamp))

      // Contiguous, half-open, and the running era is open at the top.
      for (let i = 0; i < history.eras.length - 1; i++) {
        assert.equal(history.eras[i]!.until, history.eras[i + 1]!.from)
      }
      assert.equal(history.eras[history.eras.length - 1]!.until, undefined)

      // Every era has a published term — `WorldIDAddressBook`'s constructor emits its own, which
      // PoH v2's `initialize` does not — and the newest one is the state at head.
      assert.ok(history.eras.every((e) => e.seconds !== undefined && e.seconds > 0))
      assert.equal(history.eras[history.eras.length - 1]!.seconds, termAtHead)

      // Every boundary after the first is the timestamp of the block its change was mined in.
      for (const era of history.eras.slice(1)) {
        const b = await c.getBlock({ blockNumber: BigInt(era.block!) })
        assert.equal(era.from, Number(b.timestamp))
      }

      // Today's answer, recorded rather than asserted so the test survives a real change.
      t.diagnostic(
        `verificationLength eras: ${history.eras.map((e) => `${e.from}:${e.seconds}`).join(' ')}`,
      )
    })
  })

  test('the sweep gives the same timeline at a second chunk size', async (t) => {
    await onChain(t, 'term timeline, re-swept', async () => {
      // `worldchain-mainnet.gateway.tenderly.co` answers an over-wide `eth_getLogs` with HTTP 200
      // and a silently incomplete subset — measured 2026-07-26, and not the same subset twice. So
      // a sweep is only worth believing if it is stable under the one parameter that governs
      // truncation. Same check `scanAgentBook`'s live suite makes, for the same endpoint.
      const { termAtHead, head, history: narrow } = await termTimeline()
      // 16M is the largest chunk measured returning the complete set; the default is 8M. Only the
      // second size is paid for here — two requests, against a shared sweep — because the endpoint
      // is the same one the AgentBook scan runs on and it rate-limits a suite that leans on it.
      const wide = await readVerificationTermHistory(termAtHead, head, { chunkSize: 16_000_000 })
      assert.ok(wide && narrow)
      assert.deepEqual(wide.eras, narrow.eras)
    })
  })

  test('a live subject is dated by the timeline, to the second the verification was mined', async (t) => {
    await onChain(t, 'timeline end to end', async () => {
      // The whole chain of reasoning in one assertion, with no number written down: take a real
      // verification out of the contract's own logs, ask the probe, and require the date it
      // reports to be the timestamp of the block that log is in. It passes whichever era the
      // entry belongs to, which an assertion against a fixed term does not.
      const logs = await verificationsNear(await c.getBlockNumber())
      assert.ok(logs.length > 0, 'World Chain should verify somebody near head')
      const log = logs[0]!
      const account = getAddress(log.args.account as string)
      const [block, result] = await Promise.all([
        c.getBlock({ blockNumber: log.blockNumber! }),
        orb.probe(account),
      ])
      assert.equal(result.held, true)
      assert.equal(result.issuedAt, Number(block.timestamp))
      assert.equal(
        result.provenance?.notes.includes('term-origin-unverified'),
        false,
        'the sweep answered, so the date is not resting on an unchecked term',
      )
    })
  })

  test('both address-keyed registries consume the same Orb group, through the same router', async (t) => {
    await onChain(t, 'router topology', async () => {
      const [agentGroup, agentRouter, bookRouter] = await Promise.all([
        c.readContract({ address: WORLD_AGENT_BOOK, abi: WORLD_AGENT_BOOK_ABI, functionName: 'groupId' }),
        c.readContract({ address: WORLD_AGENT_BOOK, abi: WORLD_AGENT_BOOK_ABI, functionName: 'worldIdRouter' }),
        c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'worldIdRouter',
        }),
      ])
      assert.equal(agentGroup, WORLD_ID_ORB_GROUP_ID)
      assert.equal(getAddress(agentRouter), getAddress(WORLD_ID_ROUTER))

      // The address book was pointed at a shim in 2026-01. Whatever it points at must still lead
      // to the canonical router — either directly, or by naming it.
      const viaShim =
        getAddress(bookRouter) === getAddress(WORLD_ID_ROUTER)
          ? bookRouter
          : await c.readContract({ address: bookRouter, abi: SHIM_ABI, functionName: 'worldIdRouter' })
      assert.equal(getAddress(viaShim), getAddress(WORLD_ID_ROUTER))

      const group = await c.readContract({
        address: WORLD_ID_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'routeFor',
        args: [WORLD_ID_ORB_GROUP_ID],
      })
      const root = await c.readContract({ address: group, abi: GROUP_ABI, functionName: 'latestRoot' })
      assert.ok(root > 0n, 'the Orb group has a live merkle root')
    })
  })

  test('the gate on a verification is the zero-knowledge proof, not the caller', async (t) => {
    await onChain(t, 'proof gate', async () => {
      const now = Number((await c.getBlock()).timestamp)
      const group = await c.readContract({
        address: WORLD_ID_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'routeFor',
        args: [WORLD_ID_ORB_GROUP_ID],
      })
      const realRoot = await c.readContract({ address: group, abi: GROUP_ABI, functionName: 'latestRoot' })

      const callData = (root: bigint) =>
        encodeFunctionData({
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'verify',
          args: [NEVER_VERIFIED, root, 12_345n, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n], BigInt(now - 60)],
        })

      // A stranger, the relayer that submits real verifications, and the contract's own owner.
      const senders: Address[] = [
        '0x0000000000000000000000000000000000001234',
        getAddress('0x6e07f8a68f444e489d9b47358a94ee2c7527ca5e'),
        getAddress('0xc50b688ec147fa0e93f7bf5ca5e4fcefe9e74062'),
      ]
      for (const from of senders) {
        assert.equal(
          await revertDataOf(from, WORLD_ID_ADDRESS_BOOK, callData(9_999_999n)),
          NON_EXISTENT_ROOT,
          `an invented root must fail the root history for ${from}`,
        )
        assert.equal(
          await revertDataOf(from, WORLD_ID_ADDRESS_BOOK, callData(realRoot)),
          PROOF_INVALID,
          `the group's real root must carry the call as far as the pairing check for ${from}`,
        )
      }
    })
  })

  test('a lapsed verification is a number in the mapping and not a credential', async (t) => {
    await onChain(t, 'lapsed entries', async () => {
      const head = await c.getBlockNumber()
      const now = Number((await c.getBlock({ blockNumber: head })).timestamp)
      const logs = await verificationsNear(head - 20_000_000n)
      assert.ok(logs.length, 'expected a historical cohort to sample')

      for (const log of logs.slice(0, 10)) {
        const account = getAddress(log.args.account)
        const current = await c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'addressVerifiedUntil',
          args: [account],
        })
        if (current === 0n || current > BigInt(now)) continue // re-verified since; keep looking
        const r = await orb.probe(account)
        assert.notEqual(current, 0n, 'the mapping still holds a number')
        assert.equal(r.held, false, 'and the probe still says not held')
        assert.equal(r.detail?.addressBookLapsedAt, Number(current))
        return
      }
      t.skip('every sampled historical account has re-verified since')
    })
  })

  test('a lapsed entry closes a window an as-of score can ask a question of', async (t) => {
    await onChain(t, 'lapsed window', async () => {
      // The point of a registry that never clears its mapping: a lapsed entry is not an
      // absence, it is a *dated interval*. Both ends come off the chain here — the stored
      // `addressVerifiedUntil` and the term the contract reports — and neither is written into
      // this test. What is asserted is that an instant inside the interval restores the
      // credential and an instant after it does not, which is the difference between a
      // historical score that reflects what the subject had and one that reflects what is left.
      const head = await c.getBlockNumber()
      const now = Number((await c.getBlock({ blockNumber: head })).timestamp)
      const term = Number(
        await c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'verificationLength',
        }),
      )
      const logs = await verificationsNear(head - 20_000_000n)
      assert.ok(logs.length, 'expected a historical cohort to sample')

      const adapter = entryFor('world-id-orb') as Adapter
      for (const log of logs.slice(0, 10)) {
        const account = getAddress(log.args.account)
        const current = await c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'addressVerifiedUntil',
          args: [account],
        })
        if (current === 0n || current > BigInt(now)) continue
        const r = await orb.probe(account)
        if (r.issuedAt === undefined) continue // term changed under this entry; a different test

        const lapsedAt = Number(current)
        assert.equal(r.held, false)
        assert.equal(r.heldUntil, lapsedAt, 'the end is the number the contract stores')
        assert.equal(r.issuedAt, lapsedAt - term, 'the start is that number less the term')
        assert.ok(r.provenance?.notes.includes('date-from-lapsed-verification'))

        // The window is anchored in a block the chain really mined. Not asserted *equal* to the
        // sampled log: the mapping holds only the latest verification, so an address that
        // re-verified after this log and then lapsed has a later start — which is the same
        // supersession the Coinbase suite meets, and it can only move the start forwards.
        const minedAt = Number((await c.getBlock({ blockNumber: log.blockNumber! })).timestamp)
        assert.ok(r.issuedAt >= minedAt, `${r.issuedAt} predates the log it was sampled from`)

        const priced = new Map([[adapter.id, adapter]])
        const inside = Math.floor((r.issuedAt + lapsedAt) / 2)
        const restored = applyAsOfToEvidence([evidenceAt(adapter, account, r, inside)], inside, priced)
        assert.deepEqual(restored.ceasedAfterAsOf, ['world-id-orb'])
        assert.equal(restored.evidence[0]!.held, true)
        assert.ok(restored.evidence[0]!.effectiveCostCents > 0, 'and it is priced, not merely flagged')

        const outside = lapsedAt + 1
        const after = applyAsOfToEvidence([evidenceAt(adapter, account, r, outside)], outside, priced)
        assert.deepEqual(after.ceasedAfterAsOf, [])
        assert.equal(after.evidence[0]!.held, false, 'a second after the term ran out, it is gone')
        return
      }
      t.skip('every sampled historical account has re-verified since')
    })
  })

  test('an address that never verified is not held, and is not an error', async (t) => {
    await onChain(t, 'negative', async () => {
      const r = await orb.probe(NEVER_VERIFIED)
      assert.equal(r.held, false)
      assert.equal(r.error, undefined)
      assert.equal(r.provenance?.heldFrom, 'chain')
      assert.ok((r.provenance?.headBlock ?? 0) > WORLD_ADDRESS_BOOK_DEPLOYED_AT_BLOCK)
    })
  })

  test('the 168-day term truncates the decay curve, so weight has a floor and a ceiling', async (t) => {
    await onChain(t, 'decay bounds', async () => {
      const head = await c.getBlockNumber()
      const logs = await verificationsNear(head)
      assert.ok(logs.length, 'expected recent verifications')
      const adapter = entryFor('world-id-orb')
      const now = Number((await c.getBlock({ blockNumber: head })).timestamp)
      const r = await orb.probe(getAddress(logs[0]!.args.account))
      assert.equal(r.held, true)
      assert.ok(r.issuedAt !== undefined, 'a live verification is always dated')

      const freshness = freshnessOf(adapter, r.issuedAt, now)
      // A held credential cannot be older than the term, so its weight cannot fall below the
      // value the term implies on this half-life — 168 days against 1,095 is ~0.90. The old
      // AgentBook-only read had no date at all, which `freshnessOf` scores at 1.
      const floor = 2 ** (-WORLD_ADDRESS_BOOK_VERIFICATION_LENGTH / 86_400 / adapter.decayHalfLifeDays)
      assert.ok(freshness >= floor, `freshness ${freshness} should not fall below ${floor}`)
      assert.ok(freshness <= 1)
      assert.equal(adapter.ageCurve, 'Decay')
    })
  })

  test('the document and Selfie tiers stay unimplemented, because no chain records them', () => {
    // Not a network assertion — a promise about what this adapter does not claim. World ID 4.0's
    // NFC (9303) and Selfie (11) credentials are verified by a `view` function taking a proof,
    // and the only registry that stores anything is keyed by issuer schema id, not by holder.
    for (const id of ['world-id-document', 'world-id-selfie']) {
      const entry = entryFor(id)
      assert.equal(entry.implemented, false, `${id} must not claim a probe it cannot have`)
      assert.match(entry.notes ?? '', /no permissionless read/i, `${id} must say why`)
    }
    assert.equal(entryFor('world-id-orb').implemented, true)
  })

  test('an AgentBook registration is dated from the block it was mined in', async (t) => {
    await onChain(t, 'agentbook date', async () => {
      const head = await c.getBlockNumber()
      const logs = await registrationsNear(head)
      assert.ok(logs.length, 'expected recent agent registrations')

      // The log says which block. The mapping says which human. The probe consults neither
      // directly — it asks `registrationOf` — and has to land on the same second and the same id.
      for (const log of logs.slice(0, 4)) {
        const agent = getAddress(log.args.agent!)
        const state = await c.readContract({
          address: WORLD_AGENT_BOOK,
          abi: WORLD_AGENT_BOOK_ABI,
          functionName: 'lookupHuman',
          args: [agent],
        })
        assert.equal(state.toString(), log.args.humanId!.toString(), 'log and mapping must agree')

        const block = await c.getBlock({ blockNumber: log.blockNumber })
        const r = await orb.probe(agent)
        assert.equal(r.held, true)
        assert.equal(r.detail?.agentBookRegisteredAtBlock, Number(log.blockNumber))
        assert.equal(r.detail?.agentBookRegisteredAt, Number(block.timestamp))
        assert.ok(
          r.issuedAt !== undefined && r.issuedAt >= Number(block.timestamp),
          'the credential is dated at the registration or at a later re-attestation, never earlier',
        )
      }
    })
  })

  test('the registration date is what stops an agent credential scoring at full weight forever', async (t) => {
    await onChain(t, 'agentbook freshness', async () => {
      // The defect this closes: `AgentBook` has no expiry and no timestamp, so a wallet held only
      // through it reached `freshnessOf` undated — and undated on a Decay curve is freshness 1.
      // A registration from months ago was priced exactly like one from this morning.
      const head = await c.getBlockNumber()
      const now = Number((await c.getBlock({ blockNumber: head })).timestamp)
      const adapter = entryFor('world-id-orb')
      const logs = await registrationsNear(head - 3_000_000n) // ~2 months back at 2s blocks
      assert.ok(logs.length, 'expected an older registration cohort')

      for (const log of logs.slice(0, 8)) {
        const agent = getAddress(log.args.agent!)
        const verifiedUntil = await c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'addressVerifiedUntil',
          args: [agent],
        })
        // Agent-only wallets are the ones the old read left undated; a live AddressBook entry
        // would have supplied a date of its own and hidden the defect.
        if (verifiedUntil > BigInt(now)) continue

        const r = await orb.probe(agent)
        assert.equal(r.held, true, 'an agent registration is a held World credential')
        assert.equal(r.detail?.source, 'world-agentbook')
        assert.ok(r.issuedAt !== undefined, 'and it now carries a date')
        assert.ok(r.provenance?.notes.includes('date-from-agent-registration'))

        const dated = freshnessOf(adapter, r.issuedAt, now)
        const undated = freshnessOf(adapter, undefined, now)
        assert.equal(undated, 1, 'the old behaviour, named: no date is full weight')
        assert.ok(dated < undated, `dated ${dated} must be worth less than undated ${undated}`)
        const ageDays = (now - r.issuedAt!) / 86_400
        assert.ok(
          Math.abs(dated - 2 ** (-ageDays / adapter.decayHalfLifeDays)) < 1e-9,
          'and it must be the curve, not a constant',
        )
        console.log(
          `    ${agent} registered ${Math.round(ageDays)} days ago → freshness ${dated.toFixed(4)} (was 1)`,
        )
        return
      }
      t.skip('every sampled agent from that window also holds a live AddressBook verification')
    })
  })

  test('a wallet nobody registered is not-found, which is not an error and not a date', async (t) => {
    await onChain(t, 'agentbook absence', async () => {
      const lookup = await registrationOf(NEVER_VERIFIED)
      assert.equal(lookup.status, 'not-found')
      // And the canary proves the same query shape does find a registration that is really there.
      const canary = await registrationOf(AGENT_BOOK_FIRST_REGISTRATION_AGENT as Address)
      assert.equal(canary.status, 'found')
      assert.equal(
        canary.status === 'found' ? canary.registration.block : 0,
        AGENT_BOOK_FIRST_REGISTRATION_BLOCK,
      )
    })
  })

  test('an endpoint that answers [] for everything is refused, not believed', async (t) => {
    // The quiet failure this guard exists for. An empty answer is indistinguishable from "never
    // registered", and "never registered" costs nothing — but here it would mean "no date", and
    // no date is full weight. So the endpoint must clear a wide filtered canary for a
    // registration that has been on chain since March before anything it says is used.
    const { createServer } = await import('node:http')
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    try {
      const lookup = await registrationOf(AGENT_BOOK_FIRST_REGISTRATION_AGENT as Address, {
        endpoints: [{ url: `http://127.0.0.1:${port}`, maxRange: 1_000_000 }],
      })
      assert.equal(lookup.status, 'unavailable', 'a liar must not be able to say "not registered"')
      assert.match(lookup.status === 'unavailable' ? lookup.error : '', /did not return the registration/)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('the pure interpreter and the live read agree about a real subject', async (t) => {
    await onChain(t, 'interpreter agreement', async () => {
      const head = await c.getBlockNumber()
      const logs = await verificationsNear(head)
      assert.ok(logs.length, 'expected recent verifications')
      const account = getAddress(logs[0]!.args.account)
      const block = await c.getBlock({ blockNumber: head })
      const [verifiedUntil, term, humanId] = await Promise.all([
        c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'addressVerifiedUntil',
          args: [account],
          blockNumber: head,
        }),
        c.readContract({
          address: WORLD_ID_ADDRESS_BOOK,
          abi: WORLD_ADDRESS_BOOK_ABI,
          functionName: 'verificationLength',
          blockNumber: head,
        }),
        c.readContract({
          address: WORLD_AGENT_BOOK,
          abi: WORLD_AGENT_BOOK_ABI,
          functionName: 'lookupHuman',
          args: [account],
          blockNumber: head,
        }),
      ])
      // The sampled account is usually not an agent; when it is, the interpreter needs the same
      // registration read the probe does, or the two would disagree by construction.
      const lookup = humanId === 0n ? undefined : await registrationOf(account)
      const expected = interpretWorldRead({
        block: Number(head),
        now: Number(block.timestamp),
        verifiedUntil: Number(verifiedUntil),
        verificationLength: Number(term),
        agentBookHumanId: humanId.toString(),
        ...(lookup === undefined
          ? {}
          : {
              agentBookRegistration:
                lookup.status === 'found'
                  ? { status: 'found' as const, ...lookup.registration }
                  : { status: lookup.status },
            }),
      })
      const actual = await orb.probe(account)
      assert.equal(actual.held, expected.held)
      assert.equal(actual.issuedAt, expected.issuedAt)
      assert.equal(actual.detail?.source, expected.detail?.source)
    })
  })
})
