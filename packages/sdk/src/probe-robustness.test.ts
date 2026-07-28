import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Print } from './index.ts'
import type { Address, AdapterProbe, AdapterProbeResult } from './types.ts'

/**
 * The probe survivability layer: timeout, retry, cache. Tested through `resolve()` with
 * injected fake adapters whose call counts are the observable — their ids are not in the
 * registry ontology, so they contribute no evidence, but every probe still runs through
 * `#probe`. (The ontology read itself still touches the registry RPC, same as the other
 * resolve() tests in this suite.)
 */
describe('probe robustness', () => {
  const ADDR = '0xd267eba602e692216703626a81157214b24c85fb' as Address

  const counting = (
    id: string,
    impl: (call: number) => Promise<AdapterProbeResult>,
  ): AdapterProbe & { calls: number } => {
    const probe = {
      adapterId: id,
      calls: 0,
      probe(_subject: Address) {
        probe.calls += 1
        return impl(probe.calls)
      },
    }
    return probe
  }

  test('a transient error is retried, and success on the retry ends the attempts', async () => {
    const flaky = counting('test:flaky', async (call) =>
      call === 1 ? { held: false, error: 'connection reset' } : { held: true },
    )
    const c = new Print({ adapters: [flaky], probeRetries: 2 })
    await c.resolve(ADDR)
    assert.equal(flaky.calls, 2, 'one failure, one successful retry, then stop')
  })

  test('a persistent error is retried exactly probeRetries times, then degrades', async () => {
    const dead = counting('test:dead', async () => ({ held: false, error: 'always down' }))
    const c = new Print({ adapters: [dead], probeRetries: 2 })
    const r = await c.resolve(ADDR)
    assert.equal(dead.calls, 3, '1 attempt + 2 retries')
    assert.ok(r, 'resolve still answers')
  })

  test('probeRetries: 0 disables retry', async () => {
    const dead = counting('test:dead', async () => ({ held: false, error: 'always down' }))
    const c = new Print({ adapters: [dead], probeRetries: 0 })
    await c.resolve(ADDR)
    assert.equal(dead.calls, 1)
  })

  test('a hung probe is cut by probeTimeoutMs instead of hanging resolve()', async () => {
    const hung = counting('test:hung', () => new Promise<AdapterProbeResult>(() => {}))
    const c = new Print({ adapters: [hung], probeTimeoutMs: 150, probeRetries: 0 })
    const started = Date.now()
    const r = await c.resolve(ADDR)
    assert.ok(r, 'resolve completed')
    // Generous bound: the point is "did not hang forever", not a latency SLO.
    assert.ok(Date.now() - started < 10_000, 'returned promptly after the timeout')
    assert.equal(hung.calls, 1)
  })

  test('a thrown probe (adapter contract violation) degrades to error evidence, not a rejection', async () => {
    const thrower = counting('test:thrower', async () => {
      throw new Error('adapter bug')
    })
    const c = new Print({ adapters: [thrower], probeRetries: 1 })
    await assert.doesNotReject(() => c.resolve(ADDR))
    assert.equal(thrower.calls, 2, 'a throw is a transient failure: retried once')
  })

  test('successful results are cached for probeCacheTtlMs, keyed per adapter+address', async () => {
    const ok = counting('test:ok', async () => ({ held: true }))
    const c = new Print({ adapters: [ok], probeCacheTtlMs: 60_000 })
    await c.resolve(ADDR)
    await c.resolve(ADDR)
    assert.equal(ok.calls, 1, 'second resolve served from cache')
  })

  test('error results are never cached — an outage must not outlive itself', async () => {
    const dead = counting('test:dead', async () => ({ held: false, error: 'down right now' }))
    const c = new Print({ adapters: [dead], probeCacheTtlMs: 60_000, probeRetries: 0 })
    await c.resolve(ADDR)
    await c.resolve(ADDR)
    assert.equal(dead.calls, 2, 'each resolve re-asks a failing source')
  })

  test('caching is off by default', async () => {
    const ok = counting('test:ok', async () => ({ held: true }))
    const c = new Print({ adapters: [ok] })
    await c.resolve(ADDR)
    await c.resolve(ADDR)
    assert.equal(ok.calls, 2)
  })
})
