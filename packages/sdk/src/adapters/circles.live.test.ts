/**
 * Circles v2 `stop()`, against the real Gnosis Hub.
 *
 * The claim under test is not "this avatar stopped". It is that **the Hub cannot tell you which
 * avatar stopped, and stopping does not end the credential** — two facts that pull in opposite
 * directions and that the SDK previously got wrong in both.
 *
 * ```solidity
 * function stopped(address _human) external view returns (bool) {
 *     if (!isHuman(_human)) { revert CirclesErrorOneAddressArg(_human, 0x03); }
 *     MintTime storage mintTime = mintTimes[msg.sender];   // <-- msg.sender, not _human
 *     return (mintTime.lastMintTime == INDEFINITE_FUTURE);
 * }
 * ```
 *
 * So the suite makes the chain demonstrate the substitution rather than asserting a number: the
 * same call is issued three ways — no `from`, `from` the subject, and `from` a *different*
 * address that has stopped — and the answers have to be false, true, and true-about-an-avatar-
 * that-never-stopped. The last is the one that proves the argument is ignored outright, and it
 * is the reason this probe reads storage instead.
 *
 * The storage read is then held against the Hub's own `isHuman`, which is `lastMintTime > 0` and
 * therefore a public getter over the exact word being decoded. Every avatar sampled at run time
 * has to satisfy `(lastMintTime > 0) === isHuman(a)`, so the suite re-derives the slot's meaning
 * on every run rather than trusting the constant — and the same identity is why `stop()` leaves
 * a human registered: the sentinel it writes is `type(uint96).max`, which is `> 0`.
 *
 * Run: node --test --experimental-strip-types src/adapters/circles.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, fallback, http, parseAbi, type PublicClient } from 'viem'
import { gnosis } from 'viem/chains'
import {
  CIRCLES_HUB,
  CIRCLES_INDEFINITE_FUTURE,
  CIRCLES_RPCS,
  circlesMintTimeSlot,
  decodeCirclesMintTime,
  readCirclesStopped,
} from './circles.ts'
import { circlesAdapter } from './index.ts'
import type { Address } from '../types.ts'

const SUBGRAPH =
  process.env.PRINT_SUBGRAPH_URL ??
  'https://api.studio.thegraph.com/query/77602/poh/version/latest'

/**
 * Every avatar that has ever called `stop()`, with the block it happened in.
 *
 * Hard-coded as documented fixtures because they cannot be sampled: a topic-filtered
 * `eth_getLogs` for `Stopped(address)` over the Hub's entire life — 36,486,014 (the block its
 * code first appears at) to head 47,389,543, in 200,000-block pages on 2026-07-25 — returns
 * **two events**, against roughly 317,000 `RegisterHuman` and `Trust` events. Two in the
 * population is not something a run-time sample finds, and re-running the scan in a test would
 * cost 55 paged log queries.
 *
 * What the suite does re-derive is everything about them: the transition block is checked against
 * archive storage, the flag against `isHuman`, and the pair is required to be a subset of what
 * the index independently saw.
 */
const STOPPED: ReadonlyArray<{ avatar: Address; block: number }> = [
  { avatar: '0xeb94174e82d6a070dcb0135b09270de4a3a3bce0', block: 40_615_924 },
  { avatar: '0x4bfc74983d6338d3395a00118546614bb78472c2', block: 45_241_483 },
]

const HUB_ABI = parseAbi([
  'function isHuman(address) view returns (bool)',
  'function stopped(address) view returns (bool)',
])

const HUB_EVENTS = parseAbi([
  'event RegisterHuman(address indexed avatar, address indexed inviter)',
  'event Trust(address indexed truster, address indexed trustee, uint256 expiryTime)',
])

const c = createPublicClient({
  chain: gnosis,
  transport: fallback(CIRCLES_RPCS.map((url) => http(url, { timeout: 20_000, retryCount: 2 }))),
}) as PublicClient

const isHuman = (a: Address) =>
  c.readContract({ address: CIRCLES_HUB, abi: HUB_ABI, functionName: 'isHuman', args: [a] })

/** `stopped(subject)` as seen by `caller`. `undefined` for the default zero-address caller. */
const stoppedAsSeenBy = (subject: Address, caller?: Address) =>
  c.readContract({
    address: CIRCLES_HUB,
    abi: HUB_ABI,
    functionName: 'stopped',
    args: [subject],
    ...(caller ? { account: caller } : {}),
  })

/**
 * Recent avatars, from the Hub's own logs rather than from our index.
 *
 * Deliberately not the subgraph: the census below is what licenses a hard-coded storage slot, so
 * it should not be able to go quiet because a hosted GraphQL endpoint rate-limited us. Both
 * `RegisterHuman` avatars and `Trust` trustees are collected, because the check is much weaker if
 * every address in the sample is registered — a trustee can be an address that was vouched for
 * and never signed up, and those have to decode as unregistered.
 */
async function sampleAvatars(t: { skip: (m: string) => void }, want = 40): Promise<Address[]> {
  const found = new Set<string>()
  try {
    const head = await c.getBlockNumber()
    for (let page = 0; page < 6 && found.size < want; page++) {
      const to = head - BigInt(page * 20_000)
      const logs = await c.getLogs({
        address: CIRCLES_HUB,
        events: HUB_EVENTS,
        fromBlock: to - 19_999n,
        toBlock: to,
      })
      for (const l of logs) {
        // Topics derived by viem from the ABI, so a mistyped signature is a compile error
        // rather than a filter that quietly matches nothing.
        if (l.eventName === 'RegisterHuman') found.add(l.args.avatar!.toLowerCase())
        else if (l.eventName === 'Trust') found.add(l.args.trustee!.toLowerCase())
      }
    }
  } catch (e) {
    // Iteration 19's lesson: a search that can come back empty has to say whether the source
    // refused it or the thing does not exist, or the test degrades into a green no-op.
    t.skip(`Gnosis refused the log query: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
  if (!found.size) {
    t.skip('no Circles activity in the last 120,000 blocks, which would itself be news')
    return []
  }
  return [...found].slice(0, want) as Address[]
}

/**
 * One sampled address that is a registered, never-stopped human.
 *
 * The sample deliberately contains `Trust` trustees who never registered — that is what exercises
 * the negative side of the slot check — so anything wanting a live *avatar* has to filter, and
 * `isHuman` is the only thing that can. Picking the first address instead reddens the suite
 * whenever a trust edge happens to sort first, which is a property of block ordering and not of
 * anything under test.
 */
async function aLiveAvatar(t: { skip: (m: string) => void }): Promise<Address | undefined> {
  for (const a of await sampleAvatars(t, 12)) {
    if (STOPPED.some((s) => s.avatar === a.toLowerCase())) continue
    if (await isHuman(a)) return a
  }
  t.skip('no registered, never-stopped avatar in the sample')
  return undefined
}

describe('the Hub cannot answer the question its getter takes an argument for', () => {
  test('stopped() reads the caller, so it is false for an avatar that really did stop', async () => {
    for (const { avatar } of STOPPED) {
      assert.equal(
        await stoppedAsSeenBy(avatar),
        false,
        `${avatar} called stop() and the Hub's own getter denies it`,
      )
      assert.equal(
        await stoppedAsSeenBy(avatar, avatar),
        true,
        'and admits it the moment the caller happens to be the subject',
      )
    }
  })

  test('and it will say a live avatar stopped, if the caller did', async (t) => {
    // The assertion that rules out every innocent explanation. `_human` is validated and then
    // discarded; the answer is about `msg.sender`. A cross-check of our index against this
    // getter would have "disproved" a real stop and "confirmed" one that never happened.
    const live = await aLiveAvatar(t)
    if (!live) return
    const truth = await readCirclesStopped(c, live, true)
    assert.equal(truth?.stopped, false, 'this avatar has not stopped')
    assert.equal(
      await stoppedAsSeenBy(live, STOPPED[0]!.avatar),
      true,
      'yet the Hub reports it stopped when asked by an address that stopped',
    )
  })

  test('the getter still reverts for a non-avatar, so the argument is read and then dropped', async () => {
    await assert.rejects(
      () => stoppedAsSeenBy('0x000000000000000000000000000000000000dEaD'),
      'isHuman(_human) is checked',
    )
  })
})

describe('the stop is in storage, and isHuman proves we are reading the right word', () => {
  test('every sampled avatar satisfies (lastMintTime > 0) === isHuman', async (t) => {
    // The slot is a constant in this package and constants about other people's storage go
    // stale. This is the check that makes it safe: `isHuman` is the contract's own getter over
    // the very word being decoded, so the chain re-derives the slot's meaning on every run.
    const avatars = await sampleAvatars(t, 40)
    if (!avatars.length) return
    let checked = 0
    let unregistered = 0
    for (const a of avatars) {
      const [word, human] = await Promise.all([
        c.getStorageAt({ address: CIRCLES_HUB, slot: circlesMintTimeSlot(a) }),
        isHuman(a),
      ])
      const decoded = decodeCirclesMintTime(BigInt(word ?? '0x0'))
      assert.equal(decoded.registered, human, `${a}: slot 21 disagrees with isHuman`)
      if (!human) unregistered++
      checked++
    }
    assert.ok(checked >= 20, `expected a real sample, checked ${checked}`)
    // Reported rather than asserted: a `Trust` edge can name an address that never registered,
    // and when the sample contains one the equality above has been made to hold in both
    // directions. Whether a given 120,000-block window contains one is not ours to require.
    t.diagnostic(`${checked} avatars, ${unregistered} of them never registered`)
  })

  test('a stopped avatar is still a human to the Hub, which is why it is not an ending', async () => {
    for (const { avatar } of STOPPED) {
      const human = await isHuman(avatar)
      assert.equal(human, true, `${avatar} stopped minting and is still registered`)
      const decoded = await readCirclesStopped(c, avatar, human)
      assert.equal(decoded?.stopped, true)
      assert.equal(
        decoded?.lastMintTime,
        CIRCLES_INDEFINITE_FUTURE,
        'the sentinel is uint96 max, and uint96 max is greater than zero — that is the whole point',
      )
    }
  })

  test('the sentinel appears in the block the Stopped event was mined in, and not before', async () => {
    // Dates the transition from state alone, which is the strongest available evidence that the
    // decoded field is the one `stop()` writes: nothing else in the Hub can turn a plausible
    // timestamp into uint96 max at exactly that block.
    for (const { avatar, block } of STOPPED) {
      const slot = circlesMintTimeSlot(avatar)
      const [before, at] = await Promise.all([
        c.getStorageAt({ address: CIRCLES_HUB, slot, blockNumber: BigInt(block - 1) }),
        c.getStorageAt({ address: CIRCLES_HUB, slot, blockNumber: BigInt(block) }),
      ])
      const wasStopped = decodeCirclesMintTime(BigInt(before ?? '0x0'))
      const isStopped = decodeCirclesMintTime(BigInt(at ?? '0x0'))
      assert.equal(wasStopped.stopped, false, `${avatar} was minting at ${block - 1}`)
      assert.equal(wasStopped.registered, true, 'and was already a registered human')
      assert.equal(isStopped.stopped, true, `and stopped in ${block}`)
      assert.ok(
        wasStopped.lastMintTime < CIRCLES_INDEFINITE_FUTURE,
        'the field held an ordinary mint timestamp right up to the transition',
      )
    }
  })
})

describe('the probe reports the stop and keeps the credential', () => {
  test('a stopped avatar is held, flagged, and carries the caveat note', async (t) => {
    const probe = circlesAdapter(CIRCLES_RPCS[0], undefined, SUBGRAPH)
    const r = await probe.probe(STOPPED[0]!.avatar)
    if (r.error) {
      t.skip(`Gnosis did not answer: ${r.error}`)
      return
    }
    assert.equal(r.held, true, 'stopping is not a revocation and must not read as one')
    assert.equal(r.detail?.stopped, true, 'and the fact is reported rather than dropped')
    assert.ok(
      r.provenance?.notes.includes('credential-minting-stopped'),
      'so the caveat can say the address may be abandoned',
    )
  })

  test('an ordinary avatar is held with the flag explicitly false', async (t) => {
    const live = await aLiveAvatar(t)
    if (!live) return
    const r = await circlesAdapter(CIRCLES_RPCS[0], undefined, SUBGRAPH).probe(live)
    if (r.error) {
      t.skip(`Gnosis did not answer: ${r.error}`)
      return
    }
    assert.equal(r.detail?.stopped, false, 'absent and false are different answers')
    assert.equal(r.provenance?.notes.includes('credential-minting-stopped'), false)
  })
})

describe('the index never reports a stop the chain does not have', () => {
  test('every avatar the index flags is the sentinel in storage, and both known ones are there', async (t) => {
    const res = await fetch(SUBGRAPH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ circlesAvatars(where: {stopped: true}, first: 100) { id } ' +
          'coverage: indexCoverage(id: "circles") { firstEventBlock } _meta { block { number } } }',
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => undefined)
    // The raw text first, because Studio answers a quota breach with `429 Too many requests` in
    // plain prose. Parsing straight to JSON turns that into `undefined`, which reads identically
    // to a healthy index that has never seen a stop — the exact ambiguity iteration 19's silently
    // green live test died of.
    const text = await res?.text().catch(() => undefined)
    let body:
      | {
          data?: {
            circlesAvatars?: { id: string }[]
            coverage?: { firstEventBlock: string } | null
            _meta?: { block: { number: number } }
          }
          errors?: { message: string }[]
        }
      | undefined
    try {
      body = text === undefined ? undefined : JSON.parse(text)
    } catch {
      body = undefined
    }
    const flagged = body?.data?.circlesAvatars
    if (!flagged) {
      const why =
        body?.errors?.[0]?.message ??
        (text === undefined ? 'no response' : `${res?.status}: ${text.slice(0, 120)}`)
      t.skip(`the index did not answer — ${why}`)
      return
    }
    // Direction that matters: the index may lag, so it can hold *fewer* than the chain. It must
    // never hold one the chain does not, and it must never miss a stop it has already indexed.
    for (const row of flagged) {
      const a = row.id as Address
      const decoded = await readCirclesStopped(c, a, await isHuman(a))
      assert.equal(decoded?.stopped, true, `${a} is flagged stopped and the Hub's storage is not`)
    }
    // Both edges, not just the head. A deployment windowed to recent blocks has a head well past
    // both stops and has still never seen either — asserting on `_meta` alone would redden the
    // suite for an index that is behaving exactly as configured.
    const indexed = body?.data?._meta?.block.number ?? 0
    const from = body?.data?.coverage ? Number(body.data.coverage.firstEventBlock) : undefined
    if (from === undefined) {
      t.skip('the index reports no coverage record, so what its silence means is undefined')
      return
    }
    const shouldSee = STOPPED.filter((s) => s.block >= from && s.block <= indexed).map(
      (s) => s.avatar,
    )
    if (!shouldSee.length) {
      t.skip(`the index covers ${from}..${indexed}, which contains neither stop`)
      return
    }
    const have = new Set(flagged.map((r) => r.id.toLowerCase()))
    for (const a of shouldSee) {
      assert.ok(have.has(a), `the index has passed ${a}'s stop and does not have it`)
    }
  })
})
