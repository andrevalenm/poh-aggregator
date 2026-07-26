/**
 * The Hub's signing authority, the parts that need no network.
 *
 * Everything decided about a sweep is decided in three pure functions — what a storage word says,
 * where to look, and whether what came back is a timeline or a failed read — so each of them is
 * exercised here against inputs a chain would take a rotation to produce. The refusals matter more
 * than the successes: a sweep that answers "unchanged" when it was actually truncated is the one
 * failure mode that would quietly reassure somebody.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  addressInSlot,
  HOLONYM_HUB_DEPLOY_BLOCK,
  HOLONYM_HUB_SIGNER,
  layoutAgrees,
  shortStringInSlot,
  signerErasFromSamples,
  signerSamplePlan,
} from './holonym-signer.ts'
import { applySignerHistory } from './holonym.ts'
import type { ProvenanceNote } from '../reconcile.ts'
import type { Address } from '../types.ts'

const HEAD = 154_714_331
const OTHER = '0x00000000000000000000000000000000deadbeef' as Address
/** The real word, copied from OP Mainnet on 2026-07-26. */
const SIGNER_WORD = '0x000000000000000000000000656d1dfb96dbd7620de0e73fb16d2b169bb8da01'
const OWNER_WORD = '0x000000000000000000000000be20d0a27b79ba2e53c9df150badaa21d4783d42'
const NAME_WORD = '0x486f6c6f6e796d20563300000000000000000000000000000000000000000014'

const sample = (block: number, signer: Address | undefined) => ({ block, signer })
const unchanged = [sample(HOLONYM_HUB_DEPLOY_BLOCK, HOLONYM_HUB_SIGNER), sample(HEAD, HOLONYM_HUB_SIGNER)]

describe('reading the Hub’s storage', () => {
  test('a lone address in a word is an address, and anything above it is not', () => {
    assert.equal(addressInSlot(SIGNER_WORD), HOLONYM_HUB_SIGNER)
    // A packed slot, or the wrong slot: the high bytes are the check that the layout is the one
    // the slot number was counted off, and there is nothing else cheap that says so.
    assert.equal(addressInSlot(`0x01${SIGNER_WORD.slice(4)}`), undefined)
    assert.equal(addressInSlot(NAME_WORD), undefined)
  })

  test('a short word is a failed read, never the zero address', () => {
    // The distinction the whole sweep rests on: an endpoint that answered nothing must not be
    // rounded into "the slot was empty", which would look exactly like a key rotated to zero.
    for (const bad of ['', '0x', '0x00', 'nonsense']) assert.equal(addressInSlot(bad), undefined)
  })

  test('the name slot decodes to the name the contract answers', () => {
    assert.equal(shortStringInSlot(NAME_WORD), 'Holonym V3')
    // Long strings live in a different place entirely; the low bit says so and this must decline
    // rather than return the first 31 bytes of a length.
    assert.equal(shortStringInSlot(`0x${'0'.repeat(62)}41`), undefined)
    assert.equal(shortStringInSlot(`0x${'0'.repeat(64)}`), undefined)
  })

  test('the layout check passes on the real words and fails on each way it can be wrong', () => {
    const real = {
      ownerWord: OWNER_WORD,
      nameWord: NAME_WORD,
      owner: '0xbe20d0A27B79BA2E53c9DF150BadAa21D4783D42',
      name: 'Holonym V3',
    }
    assert.equal(layoutAgrees(real), true)
    assert.equal(layoutAgrees({ ...real, owner: OTHER }), false)
    assert.equal(layoutAgrees({ ...real, name: 'Holonym V4' }), false)
    assert.equal(layoutAgrees({ ...real, ownerWord: NAME_WORD }), false)
    assert.equal(layoutAgrees({ ...real, nameWord: OWNER_WORD }), false)
  })
})

describe('planning a sweep with no event to follow', () => {
  test('the plan always contains both ends, ascending and without repeats', () => {
    const plan = signerSamplePlan(HOLONYM_HUB_DEPLOY_BLOCK, HEAD, 6)
    assert.equal(plan[0], HOLONYM_HUB_DEPLOY_BLOCK)
    assert.equal(plan[plan.length - 1], HEAD)
    assert.equal(plan.length, 8)
    assert.deepEqual(plan, [...plan].sort((a, b) => a - b))
    assert.equal(new Set(plan).size, plan.length)
  })

  test('a range smaller than the sample count collapses instead of repeating a block', () => {
    const plan = signerSamplePlan(100, 103, 6)
    assert.deepEqual(plan, [100, 101, 102, 103])
  })

  test('a range of nothing is one block, not an empty plan', () => {
    assert.deepEqual(signerSamplePlan(HEAD, HEAD, 6), [HEAD])
  })
})

describe('turning samples into a history, or refusing to', () => {
  test('one signer across the whole range is one era, and is not a rotation', () => {
    const history = signerErasFromSamples(unchanged, HEAD)
    assert.ok(history)
    assert.equal(history.eras.length, 1)
    assert.equal(history.eras[0]!.signer, HOLONYM_HUB_SIGNER)
    assert.equal(history.eras[0]!.fromBlock, HOLONYM_HUB_DEPLOY_BLOCK)
    assert.equal(history.eras[0]!.untilBlock, undefined)
    assert.equal(history.rotated, false)
  })

  test('a change becomes two contiguous half-open eras, dated at the block it was found in', () => {
    const at = 130_000_000
    const history = signerErasFromSamples(
      [sample(HOLONYM_HUB_DEPLOY_BLOCK, HOLONYM_HUB_SIGNER), sample(at, OTHER), sample(HEAD, OTHER)],
      HEAD,
    )
    assert.ok(history)
    assert.equal(history.rotated, true)
    assert.deepEqual(history.eras, [
      { signer: HOLONYM_HUB_SIGNER, fromBlock: HOLONYM_HUB_DEPLOY_BLOCK, untilBlock: at },
      { signer: OTHER, fromBlock: at },
    ])
  })

  test('a single era under a key that is not the pinned one is still a rotation', () => {
    // Reading one unchanging key that is not ours means either the pin is wrong or this is not
    // the contract we think. Both are things to say out loud, and neither is "unchanged".
    const history = signerErasFromSamples(
      [sample(HOLONYM_HUB_DEPLOY_BLOCK, OTHER), sample(HEAD, OTHER)],
      HEAD,
    )
    assert.equal(history?.rotated, true)
  })

  test('a sweep that does not reach the deployment block is refused, not trusted', () => {
    // The guard that matters most: without the constructor's own block, a sweep cannot say what
    // the first era was, and "every block I read had the same key" is not the same claim.
    assert.equal(
      signerErasFromSamples(
        [sample(HOLONYM_HUB_DEPLOY_BLOCK + 1, HOLONYM_HUB_SIGNER), sample(HEAD, HOLONYM_HUB_SIGNER)],
        HEAD,
      ),
      undefined,
    )
  })

  test('a sweep that does not reach head is refused', () => {
    assert.equal(signerErasFromSamples(unchanged, HEAD + 1), undefined)
  })

  test('an unreadable sample refuses the whole sweep rather than being skipped', () => {
    assert.equal(
      signerErasFromSamples(
        [
          sample(HOLONYM_HUB_DEPLOY_BLOCK, HOLONYM_HUB_SIGNER),
          sample(130_000_000, undefined),
          sample(HEAD, HOLONYM_HUB_SIGNER),
        ],
        HEAD,
      ),
      undefined,
    )
  })

  test('an empty slot at the deployment block means the wrong slot, and is refused', () => {
    // The constructor sets `verifier` unconditionally, so zero there cannot be a fact about the
    // Hub. It is a fact about our reading of it.
    assert.equal(
      signerErasFromSamples(
        [
          sample(HOLONYM_HUB_DEPLOY_BLOCK, '0x0000000000000000000000000000000000000000' as Address),
          sample(HEAD, HOLONYM_HUB_SIGNER),
        ],
        HEAD,
      ),
      undefined,
    )
  })

  test('nothing read is a refusal, which is not the same answer as no rotation', () => {
    assert.equal(signerErasFromSamples([], HEAD), undefined)
  })
})

describe('what a sweep says about one credential', () => {
  const apply = (history: Parameters<typeof applySignerHistory>[0]) => {
    const notes: ProvenanceNote[] = []
    const detail: Record<string, unknown> = {}
    applySignerHistory(history, notes, detail)
    return { notes, detail }
  }

  test('an unchanged key is silent, and still says which key', () => {
    const { notes, detail } = apply(signerErasFromSamples(unchanged, HEAD))
    assert.deepEqual(notes, [])
    assert.equal(detail.hubSigner, HOLONYM_HUB_SIGNER)
    assert.equal(detail.hubSignerIsPinned, true)
    assert.equal(detail.hubSignerSinceBlock, HOLONYM_HUB_DEPLOY_BLOCK)
    assert.equal(detail.hubSignerEras, 1)
  })

  test('a rotation is a caveat and carries the eras that produced it', () => {
    const { notes, detail } = apply(
      signerErasFromSamples(
        [sample(HOLONYM_HUB_DEPLOY_BLOCK, HOLONYM_HUB_SIGNER), sample(HEAD, OTHER)],
        HEAD,
      ),
    )
    assert.deepEqual(notes, ['attestation-authority-rotated'])
    assert.equal(detail.hubSigner, OTHER)
    assert.equal(detail.hubSignerIsPinned, false)
    assert.equal((detail.hubSignerHistory as unknown[]).length, 2)
  })

  test('a failed sweep is its own note, and claims nothing about the key', () => {
    const { notes, detail } = apply(undefined)
    assert.deepEqual(notes, ['attestation-authority-unverified'])
    assert.deepEqual(detail, {})
  })
})
