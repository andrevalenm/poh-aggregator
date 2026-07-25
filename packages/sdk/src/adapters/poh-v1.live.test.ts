/**
 * Proof of Humanity v1, against the real Ethereum mainnet registry.
 *
 * The claim under test is not "this address is registered". It is that **the credential dies of
 * arithmetic** — `isRegistered` is `registered && now - submissionTime <= submissionDuration`,
 * and `submission.registered` itself is never cleared on expiry — so the registry keeps a
 * boolean that says "yes" for years after the thing it describes has stopped being true. A probe
 * that reads that boolean, which is the one `getSubmissionInfo` hands you, counts the dead.
 *
 * So the suite makes the chain demonstrate the comparison rather than asserting a number: it
 * takes a lapsed submission out of the registry's own logs, derives the exact second its term
 * ran out, and requires the contract to answer `true` at the block before that second and
 * `false` at the block after — with nothing written to the registry in between. Two subsystems,
 * historical state and the log index, where the probe consults neither.
 *
 * It also enumerates what is left of v1 from the chain alone (every `AddSubmission` and
 * `ReapplySubmission` inside a window wider than the term, then one `isRegistered` each), dates
 * a survivor by finding the block its `submissionTime` was written in, and checks the ForkModule
 * — PoH v2's overlay, which retires a v1 registration that v1 itself goes on honouring.
 *
 * No subject is hard-coded except one documented fixture: an address v2 retired, kept because
 * nine of 20,682 are in that state and sampling will not find one. It was measured, not guessed.
 *
 * Run: node --test --experimental-strip-types src/adapters/poh-v1.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPublicClient, fallback, getAddress, http, parseAbi, type PublicClient } from 'viem'
import { gnosis, mainnet } from 'viem/chains'
import {
  pohV1Adapter,
  POH_V1_ABI,
  POH_V1_FIRST_SUBMISSION_AT,
  POH_V1_FIRST_SUBMISSION_BLOCK,
  POH_V1_FORK_MODULE,
  POH_V1_FORK_MODULE_ABI,
  POH_V1_FORK_TIME,
  POH_V1_LIFETIME_SUBMISSIONS,
  POH_V1_REGISTRY,
  POH_V1_RPCS,
  POH_V1_SUBMISSION_DURATION,
} from './poh-v1.ts'
import { CONTRACTS } from './index.ts'
import { effectiveCost, freshnessOf, score } from '../scoring.ts'
import type { Address, Adapter } from '../types.ts'

/** Nobody holds the key to this address, so it has never submitted to the registry. */
const NEVER_SUBMITTED = '0x000000000000000000000000000000000000dEaD' as Address

/**
 * A submission PoH v2 retired through the ForkModule while v1 went on answering `true`.
 *
 * Found by sweeping `ForkModule.removed` over all 20,682 addresses that ever emitted a
 * submission event: exactly **nine** are set, so no realistic sample finds one. This one was
 * retired at block 20,692,434 (2024-09-06) and its v1 term did not run out until 2026-01-29 —
 * **510 days** in which the v1 registry said registered and the protocol that governs it said
 * otherwise. That window is why the probe reads the overlay at all.
 */
const RETIRED_BY_V2 = '0x6687c671980E65ebD722b9146Fc61e2471558dd6' as Address

/**
 * One of the two registrations still alive, and the reason the population had to be enumerated
 * over the registry's whole history rather than over a window.
 *
 * It made **one** request, on 2022-09-25, and that request was executed on 2024-10-25 — 761 days
 * later. `executeRequest` emits nothing, so nothing in the log marks the acceptance.
 */
const LATE_ACCEPTANCE = {
  who: '0xb2db7c3b4c0d901Fe1C51895CEb5c631EB3667e7' as Address,
  requestedInBlock: 15_611_027,
  submissionTime: 1_729_851_479,
}

/** PoH v2's mainnet proxy — the contract the ForkModule takes its orders from. */
const POH_V2_MAINNET = '0xbE9834097A4E97689d9B667441acafb456D0480A' as const

/** PoH v2 renamed the getter; its populated deployment is on Gnosis, not mainnet. */
const POH_V2_GNOSIS_ABI = parseAbi(['function isHuman(address) view returns (bool)'])

const c = createPublicClient({
  chain: mainnet,
  transport: fallback(POH_V1_RPCS.map((url) => http(url, { timeout: 25_000, retryCount: 2 }))),
}) as PublicClient

const ontologyJson = JSON.parse(
  readFileSync(new URL('../../../../ontology/adapters.json', import.meta.url), 'utf8'),
) as { adapters: (Adapter & { id: string; implemented?: boolean; notes?: string })[] }
const entryFor = (id: string) => ontologyJson.adapters.find((a) => a.id === id)!

/** Public endpoints throttle; an exhausted quota says nothing about the mechanism. */
async function onChain(t: { skip: (m: string) => void }, what: string, body: () => Promise<void>) {
  try {
    await body()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (
      !/rate limit|requests per second|too many requests|429|timed out|timeout|fetch failed|capacity|exceeds defined limit|route your request|archive/i.test(
        message,
      )
    ) {
      throw e
    }
    t.skip(`${what}: mainnet endpoint unavailable — ${message.split('\n')[0]}`)
  }
}

const AT = <T>(fn: string, args: readonly unknown[], blockNumber?: bigint) =>
  c.readContract({
    address: POH_V1_REGISTRY,
    abi: POH_V1_ABI,
    functionName: fn as never,
    args: args as never,
    ...(blockNumber === undefined ? {} : { blockNumber }),
  }) as Promise<T>

type Info = readonly [number, bigint, bigint, boolean, boolean, bigint]

/** First block at or after `ts`, by bisection over block headers. */
async function blockAtTimestamp(ts: number, from = POH_V1_FIRST_SUBMISSION_BLOCK): Promise<number> {
  let lo = from
  let hi = Number(await c.getBlockNumber())
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const block = await c.getBlock({ blockNumber: BigInt(mid) })
    if (Number(block.timestamp) < ts) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * `AddSubmission` and `ReapplySubmission` — the two events that precede every write of
 * `submissionTime`, bar the governor's bulk path (see the write-up's §4.1).
 */
const SUBMISSION_EVENTS = POH_V1_ABI.filter((x) => x.type === 'event')

/**
 * Every address that emitted a submission event in a block range, and the last block it did.
 *
 * Filtered by topic at the node, because the registry's 2021–2022 era emits thousands of
 * `Evidence` and `VouchAdded` logs per 250,000 blocks and pulling them all back takes a minute a
 * chunk. Chunked as well, because free endpoints truncate rather than error on oversized log
 * queries — a failure mode that looks exactly like a smaller population.
 */
async function submissionEventAddresses(fromBlock: number, toBlock: number, chunk = 500_000) {
  const seen = new Map<Address, number>()
  for (let from = fromBlock; from <= toBlock; from += chunk) {
    const logs = await c.getLogs({
      address: POH_V1_REGISTRY,
      events: SUBMISSION_EVENTS,
      fromBlock: BigInt(from),
      toBlock: BigInt(Math.min(from + chunk - 1, toBlock)),
    })
    for (const log of logs) {
      if (!log.topics[1]) continue
      const who = getAddress(`0x${log.topics[1].slice(26)}`) as Address
      const at = Number(log.blockNumber)
      if ((seen.get(who) ?? 0) < at) seen.set(who, at)
    }
  }
  return seen
}

describe('Proof of Humanity v1 — live', () => {
  test('the registry still answers, and its term is the one the adapter documents', async (t) => {
    await onChain(t, 'registry parameters', async () => {
      const [counter, duration] = await Promise.all([
        AT<bigint>('submissionCounter', []),
        AT<bigint>('submissionDuration', []),
      ])
      // Monotone, so this is an invariant rather than a snapshot. It growing is news — the
      // "2 of 20,740" figures in the adapter and the write-up would need re-measuring — but it
      // is not a defect, so it is reported rather than failed.
      assert.ok(
        Number(counter) >= POH_V1_LIFETIME_SUBMISSIONS,
        `submissionCounter went backwards: ${counter} < ${POH_V1_LIFETIME_SUBMISSIONS}`,
      )
      if (Number(counter) > POH_V1_LIFETIME_SUBMISSIONS) {
        t.diagnostic(
          `submissionCounter is ${counter}, up from the documented ${POH_V1_LIFETIME_SUBMISSIONS} — v1 has taken new submissions; re-measure the population claims.`,
        )
      }
      assert.equal(
        Number(duration),
        POH_V1_SUBMISSION_DURATION,
        'submissionDuration moved; every expiry this adapter reports is derived from it',
      )
    })
  })

  test('the credential dies of arithmetic, and the chain shows the exact second', async (t) => {
    await onChain(t, 'expiry boundary', async () => {
      // Sample a lapsed submission out of the registry's own history rather than pinning one.
      // The window is chosen from the term, not from a block number: anything submitted more
      // than two terms ago has certainly expired, whatever `submissionDuration` is set to, and
      // v1's request traffic thinned to nothing after 2024 so a recent window finds no-one.
      const term = Number(await AT<bigint>('submissionDuration', []))
      const now = Math.floor(Date.now() / 1000)
      const windowEnd = await blockAtTimestamp(now - 2 * term)
      // Walk backwards in small steps rather than scanning a wide window: this era is the
      // registry's dense one and we need one address, not a census.
      const candidates: Address[] = []
      for (let step = 0; step < 12 && candidates.length === 0; step++) {
        const to = windowEnd - step * 50_000
        candidates.push(...(await submissionEventAddresses(to - 49_999, to)).keys())
      }
      assert.ok(candidates.length > 0, `no submission events in the 600,000 blocks before ${windowEnd}`)

      let lapsed: { who: Address; submissionTime: number } | undefined
      for (const who of candidates) {
        const info = await AT<Info>('getSubmissionInfo', [who])
        const submissionTime = Number(info[1])
        // `registered` still set, term run out: the state this test exists for.
        if (info[3] && submissionTime > 0 && submissionTime + term < now - 3600) {
          lapsed = { who, submissionTime }
          break
        }
      }
      assert.ok(lapsed, 'no expired-but-flagged submission found in the sampled window')

      const expiresAt = lapsed.submissionTime + term
      const after = await blockAtTimestamp(expiresAt + 1)
      const [blockBefore, blockAfter] = await Promise.all([
        c.getBlock({ blockNumber: BigInt(after - 1) }),
        c.getBlock({ blockNumber: BigInt(after) }),
      ])
      assert.ok(
        Number(blockBefore.timestamp) <= expiresAt && Number(blockAfter.timestamp) > expiresAt,
        `blocks ${after - 1}/${after} do not straddle ${expiresAt}`,
      )

      const [wasRegistered, isRegistered] = await Promise.all([
        AT<boolean>('isRegistered', [lapsed.who], BigInt(after - 1)),
        AT<boolean>('isRegistered', [lapsed.who], BigInt(after)),
      ])
      assert.equal(wasRegistered, true, `${lapsed.who} should be registered at ${after - 1}`)
      assert.equal(isRegistered, false, `${lapsed.who} should have lapsed by ${after}`)

      // And nobody did anything: the registry emitted nothing across the boundary, so the
      // answer changed because time passed and for no other reason.
      const logs = await c.getLogs({
        address: POH_V1_REGISTRY,
        fromBlock: BigInt(after - 1),
        toBlock: BigInt(after),
      })
      assert.equal(logs.length, 0, 'the registry was written to across the expiry boundary')

      // The probe reads only the contract's own getter, so it must land on the same side.
      const probe = await pohV1Adapter().probe(lapsed.who)
      assert.equal(probe.held, false)
      assert.equal(probe.error, undefined)
      assert.equal(probe.detail?.registeredFlagOutlivedTerm, true)
      assert.equal(probe.detail?.expiresAt, expiresAt)
      t.diagnostic(
        `${lapsed.who}: registered at ${after - 1} (t=${blockBefore.timestamp}), lapsed at ${after} (t=${blockAfter.timestamp}), expiry ${expiresAt}`,
      )
    })
  })

  test('the probe’s answer is the contract’s answer, on whoever the chain hands us', async (t) => {
    await onChain(t, 'probe agreement', async () => {
      const head = Number(await c.getBlockNumber())
      const term = Number(await AT<bigint>('submissionDuration', []))
      const candidates = [...(await submissionEventAddresses(head - 6_000_000, head)).keys()]
      assert.ok(candidates.length > 0, 'the scan found no submission events at all')

      const adapter = pohV1Adapter()
      const entry = entryFor('poh-v1')
      // A hard term truncates a ramp exactly as it truncates a decay: a held registration is at
      // most `submissionDuration` old, so its weight can never exceed the ramp evaluated there —
      // 0.75 at today's 730.5-day term against a 365-day half-life.
      const ceiling = 1 - 2 ** (-term / 86_400 / entry.decayHalfLifeDays)
      let held = 0
      for (const who of candidates) {
        const [onChainAnswer, info, retired] = await Promise.all([
          AT<boolean>('isRegistered', [who]),
          AT<Info>('getSubmissionInfo', [who]),
          c.readContract({
            address: POH_V1_FORK_MODULE,
            abi: POH_V1_FORK_MODULE_ABI,
            functionName: 'removed',
            args: [who],
          }),
        ])
        const r = await adapter.probe(who)
        assert.equal(r.error, undefined, `${who} probed with an error`)
        assert.equal(
          r.held,
          onChainAnswer && !retired,
          `${who}: probe says ${r.held}, chain says isRegistered=${onChainAnswer} removed=${retired}`,
        )
        if (!r.held) {
          assert.equal(r.issuedAt, undefined, `${who} is not held and yet carries a date`)
          continue
        }
        held++
        assert.equal(r.issuedAt, Number(info[1]), `${who} dated from something other than submissionTime`)
        assert.equal(r.provenance?.heldFrom, 'chain')
        assert.equal(r.provenance?.dateFrom, 'chain')
        const freshness = freshnessOf(entry, r.issuedAt, Math.floor(Date.now() / 1000))
        assert.ok(
          freshness <= ceiling + 1e-9,
          `${who} scored freshness ${freshness}, above the ${ceiling} the term allows`,
        )
        t.diagnostic(`${who}: issuedAt ${info[1]}, freshness ${freshness.toFixed(4)} (ceiling ${ceiling.toFixed(4)})`)
      }
      t.diagnostic(
        `${candidates.length} addresses requested in the last 6 M blocks; ${held} are held today, out of ${POH_V1_LIFETIME_SUBMISSIONS} lifetime submissions`,
      )
    })
  })

  test('a request can be accepted years after it is made, so no window enumerates the registry', async (t) => {
    // This is the methodology check behind the population figures in the write-up, and it caught
    // a wrong one. `executeRequest` — the call that writes `submissionTime` — emits **nothing**,
    // and neither does the `processVouches` it delegates to, so acceptance leaves no trace in the
    // log at all. Anyone may call it, at any time after the challenge period, and for this
    // submission nobody did for two years: requested 2022-09-25, accepted 2024-10-25, one request
    // ever. A scan bounded by "the term plus some slack" would have missed it and reported a
    // smaller population while looking exhaustive. Only the full event history is complete.
    await onChain(t, 'request-to-acceptance gap', async () => {
      const info = await AT<Info>('getSubmissionInfo', [LATE_ACCEPTANCE.who])
      assert.equal(Number(info[5]), 1, 'the fixture has made more than one request; pick another')
      assert.equal(Number(info[1]), LATE_ACCEPTANCE.submissionTime)

      const logs = await c.getLogs({
        address: POH_V1_REGISTRY,
        events: SUBMISSION_EVENTS,
        args: { _submissionID: LATE_ACCEPTANCE.who },
        fromBlock: BigInt(LATE_ACCEPTANCE.requestedInBlock - 10_000),
        toBlock: BigInt(LATE_ACCEPTANCE.requestedInBlock + 10_000),
      })
      assert.equal(logs.length, 1, 'expected exactly one submission event around the request block')
      assert.equal(Number(logs[0]!.blockNumber), LATE_ACCEPTANCE.requestedInBlock)

      const requested = await c.getBlock({ blockNumber: BigInt(LATE_ACCEPTANCE.requestedInBlock) })
      const gapDays = (Number(info[1]) - Number(requested.timestamp)) / 86_400
      assert.ok(gapDays > 365, `the gap is only ${gapDays.toFixed(1)} days; the finding has changed`)
      t.diagnostic(
        `${LATE_ACCEPTANCE.who}: requested at block ${LATE_ACCEPTANCE.requestedInBlock} (t=${requested.timestamp}), accepted ${gapDays.toFixed(1)} days later`,
      )
    })
  })

  test('a survivor’s date is the block its submission was accepted in', async (t) => {
    await onChain(t, 'date derivation', async () => {
      const head = Number(await c.getBlockNumber())
      const term = Number(await AT<bigint>('submissionDuration', []))
      const from = await blockAtTimestamp(Math.floor(Date.now() / 1000) - term - 180 * 86_400)
      const candidates = [...(await submissionEventAddresses(from, head)).entries()]

      let subject: { who: Address; submissionTime: number; requestedAt: number } | undefined
      for (const [who, requestedAt] of candidates) {
        if (!(await AT<boolean>('isRegistered', [who]))) continue
        const info = await AT<Info>('getSubmissionInfo', [who])
        subject = { who, submissionTime: Number(info[1]), requestedAt }
        break
      }
      if (!subject) {
        t.skip('no registered submission left in v1 to date — the population has emptied')
        return
      }

      // `executeRequest` writes `submission.submissionTime = uint64(now)` and emits nothing, so
      // the date cannot be checked against a log. It can be checked against historical state:
      // find the first block at which the field holds its current value, and require that
      // block's header to carry exactly that timestamp. State history and the block header
      // agreeing, where the probe consulted only the current value of the first.
      let lo = subject.requestedAt
      let hi = head
      const timeAt = async (b: number) => Number((await AT<Info>('getSubmissionInfo', [subject!.who], BigInt(b)))[1])
      assert.notEqual(await timeAt(lo), subject.submissionTime, 'submissionTime was already set at the request block')
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if ((await timeAt(mid)) === subject.submissionTime) hi = mid
        else lo = mid + 1
      }
      const acceptedIn = await c.getBlock({ blockNumber: BigInt(lo) })
      assert.equal(
        Number(acceptedIn.timestamp),
        subject.submissionTime,
        `submissionTime ${subject.submissionTime} is not the timestamp of block ${lo}`,
      )

      const r = await pohV1Adapter().probe(subject.who)
      assert.equal(r.issuedAt, subject.submissionTime)
      t.diagnostic(
        `${subject.who}: requested at block ${subject.requestedAt}, accepted in block ${lo} (t=${acceptedIn.timestamp})`,
      )
    })
  })

  test('the ForkModule is wired to the two contracts it claims to bridge', async (t) => {
    await onChain(t, 'fork module wiring', async () => {
      const read = <T>(fn: string) =>
        c.readContract({
          address: POH_V1_FORK_MODULE,
          abi: POH_V1_FORK_MODULE_ABI,
          functionName: fn as never,
        }) as Promise<T>
      const [v1, v2, forkTime, snapshot, liveTerm] = await Promise.all([
        read<Address>('proofOfHumanityV1'),
        read<Address>('proofOfHumanityV2'),
        read<number>('forkTime'),
        read<number>('submissionDuration'),
        AT<bigint>('submissionDuration', []),
      ])
      assert.equal(getAddress(v1), getAddress(POH_V1_REGISTRY))
      assert.equal(getAddress(v2), getAddress(POH_V2_MAINNET))
      assert.equal(Number(forkTime), POH_V1_FORK_TIME)
      // The module snapshotted the term at initialisation and v1 can still change it. While the
      // two agree, v2's view of when a v1 registration expires is v1's view.
      assert.equal(Number(snapshot), Number(liveTerm))
    })
  })

  test('a registration PoH v2 retired is not held, though v1 still says registered', async (t) => {
    await onChain(t, 'retired registration', async () => {
      const [removed, recognised, info] = await Promise.all([
        c.readContract({
          address: POH_V1_FORK_MODULE,
          abi: POH_V1_FORK_MODULE_ABI,
          functionName: 'removed',
          args: [RETIRED_BY_V2],
        }),
        c.readContract({
          address: POH_V1_FORK_MODULE,
          abi: POH_V1_FORK_MODULE_ABI,
          functionName: 'isRegistered',
          args: [RETIRED_BY_V2],
        }),
        AT<Info>('getSubmissionInfo', [RETIRED_BY_V2]),
      ])
      assert.equal(removed, true, 'the documented retired submission is no longer flagged')
      assert.equal(recognised, false)
      assert.equal(info[3], true, 'v1 stopped saying `registered` for it — the premise has changed')

      const r = await pohV1Adapter().probe(RETIRED_BY_V2)
      assert.equal(r.held, false)
      assert.equal(r.detail?.retiredByPohV2, true)
      assert.equal(r.detail?.recognisedByPohV2, false)
    })
  })

  test('an address that never submitted is a clean negative, not an error', async (t) => {
    await onChain(t, 'negative path', async () => {
      const r = await pohV1Adapter().probe(NEVER_SUBMITTED)
      assert.equal(r.held, false)
      assert.equal(r.error, undefined)
      assert.equal(r.issuedAt, undefined)
      assert.equal(r.detail?.submissionTime, undefined)
      assert.equal(r.detail?.retiredByPohV2, undefined)
      assert.equal(r.detail?.forkModuleUnreadable, undefined)
    })
  })

  test('v1 and v2 share a trust root, so one human registered in both counts once', async (t) => {
    // The reason this adapter is worth having when its population is two people: it is the
    // cheapest live check that saturation spans protocol *versions*. Two registries, two chains,
    // one vouched identity — and the ontology is what says so.
    const v1 = entryFor('poh-v1')
    const v2 = entryFor('poh-v2')
    assert.equal(v1.trustRoot, 'social-vouching:poh')
    assert.equal(v2.trustRoot, v1.trustRoot)
    assert.equal(v1.ageCurve, 'Ramp')
    assert.equal(v1.implemented, true)

    // Run the real ontology entries through the real scorer: holding both must produce one root
    // and the caveat that says value was discarded, not two roots' worth of cost.
    const adapters = new Map<string, Adapter>([
      [v1.id, v1],
      [v2.id, v2],
    ])
    const now = 1_784_987_511
    const evidence = [v1, v2].map((a) => {
      const freshness = freshnessOf(a, now - 400 * 86_400, now)
      return {
        adapterId: a.id,
        adapterName: a.name,
        evidenceClass: a.evidenceClass,
        trustRoot: a.trustRoot,
        held: true,
        observedOn: NEVER_SUBMITTED,
        issuedAt: now - 400 * 86_400,
        freshness,
        effectiveCostCents: effectiveCost(a, freshness),
        forgeCostCents: a.forgeCostCents,
        rentCostCents: a.rentCostCents,
        live: a.live,
        sourceURI: a.sourceURI,
      }
    })
    const both = score({ subjects: [NEVER_SUBMITTED], adapters, evidence, now })
    assert.equal(both.roots.length, 1, 'v1 and v2 produced two roots')
    assert.equal(both.independentRoots, 1)
    assert.deepEqual(both.roots[0]!.adapterIds.sort(), ['poh-v1', 'poh-v2'])
    assert.equal(both.roots[0]!.saturated, true)
    assert.ok(both.caveats.some((x) => x.code === 'correlated-evidence-saturated'))

    const alone = score({ subjects: [NEVER_SUBMITTED], adapters, evidence: [evidence[0]!], now })
    assert.equal(
      both.totalCostCents,
      alone.totalCostCents,
      'holding the same identity in both registries bought extra cost',
    )

    await onChain(t, 'cross-version overlap', async () => {
      // And the live half: does anybody actually hold both? PoH v2's population is on Gnosis,
      // so this is the one read in the suite that leaves mainnet.
      const gnosisClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com', { timeout: 20_000 }),
      })
      const survivor = LATE_ACCEPTANCE.who
      const [onV1, onV2] = await Promise.all([
        AT<boolean>('isRegistered', [survivor]),
        gnosisClient.readContract({
          address: CONTRACTS.pohV2 as Address,
          abi: POH_V2_GNOSIS_ABI,
          functionName: 'isHuman',
          args: [survivor],
        }),
      ])
      t.diagnostic(`${survivor}: registered on v1 ${onV1}, a humanity on v2 Gnosis ${onV2}`)
      if (onV1 && onV2) {
        assert.equal(
          both.roots.length,
          1,
          'somebody holds both and the ontology must collapse them — it does, see above',
        )
      }
    })
  })

  test('the adapter’s documented floor is the registry’s own first submission', async (t) => {
    await onChain(t, 'first submission', async () => {
      const block = await c.getBlock({ blockNumber: BigInt(POH_V1_FIRST_SUBMISSION_BLOCK) })
      assert.equal(Number(block.timestamp), POH_V1_FIRST_SUBMISSION_AT)
      const [before, at] = await Promise.all([
        AT<bigint>('submissionCounter', [], BigInt(POH_V1_FIRST_SUBMISSION_BLOCK - 1)),
        AT<bigint>('submissionCounter', [], BigInt(POH_V1_FIRST_SUBMISSION_BLOCK)),
      ])
      assert.equal(Number(before), 0, 'the registry was not empty before its first submission')
      assert.equal(Number(at), 1)
    })
  })
})
