import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Corroborate } from './index.ts'
import type { Address } from './types.ts'

/**
 * Input normalization, tested without touching the network. Address and empty-string paths
 * in resolveSubject return or throw before any RPC call, so these are fast and offline.
 * They guard the difference between a legible error and a leaked ENS-internals error — the
 * kind of thing a first user hits in the first minute.
 */
describe('subject input handling', () => {
  const c = new Corroborate({})
  const ADDR = '0xd267eba602e692216703626a81157214b24c85fb'

  test('a space-padded address is still an address', async () => {
    const r = await c.resolveSubject(`  ${ADDR}  `)
    assert.equal(r.address.toLowerCase(), ADDR)
    assert.equal(r.name, undefined, 'a bare address is not a name')
  })

  test('mixed-case address is accepted (EIP-55 or not)', async () => {
    const r = await c.resolveSubject(ADDR.toUpperCase().replace('0X', '0x'))
    assert.equal(r.address.toLowerCase(), ADDR)
  })

  test('empty and whitespace-only inputs fail with a clear message, not an ENS error', async () => {
    await assert.rejects(() => c.resolveSubject(''), /empty subject/)
    await assert.rejects(() => c.resolveSubject('   '), /empty subject/)
  })

  test('resolve() dedupes a subject set case-insensitively before probing', async () => {
    // Both spellings of one wallet must collapse to one subject — no double-probing, and
    // no chance of a wallet appearing to contribute twice.
    const r = await c.resolve([ADDR, ADDR.toUpperCase().replace('0X', '0x') as Address])
    assert.equal(r.subjects.length, 1)
  })

  test('resolve() rejects an empty set', async () => {
    await assert.rejects(() => c.resolve([]), /at least one/)
  })
})
