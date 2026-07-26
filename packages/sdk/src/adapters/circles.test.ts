import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { PublicClient } from 'viem'
import {
  CIRCLES_INDEFINITE_FUTURE,
  CIRCLES_STOPPED_V1,
  circlesMintTimeSlot,
  decodeCirclesMintTime,
  readCirclesStopped,
} from './circles.ts'
import { circlesIndexRead } from '../subgraph.ts'
import { reconcileIndexAndChain } from './../reconcile.ts'
import { createServer, type Server } from 'node:http'
import { before, after } from 'node:test'

/**
 * `stop()` is the only thing that happens to a Circles avatar after registration, and the SDK
 * used to read it as a revocation. It is not one: `isHuman` is `lastMintTime > 0` and `stop`
 * writes `type(uint96).max` to that field, so the Hub goes on calling a stopped avatar a human.
 *
 * These are the cases the chain does not conveniently produce — a moved storage slot, an RPC
 * that fails, an index that has raced ahead of a chain read. The mechanism itself is asserted
 * against Gnosis in `circles.live.test.ts`.
 */

/** The real word at `mintTimes[0xeb94…]`, read from Gnosis at head on 2026-07-25. */
const STOPPED_WORD = 0xffffffffffffffffffffffff0000000000000000000000000000000000000001n

describe('the packed MintTime word', () => {
  test('the uint96 is the high 12 bytes and the address the low 20', () => {
    const live = decodeCirclesMintTime(0x000000006a58a6500000000000000000000000000000000000000001n)
    assert.equal(live.mintV1Status, CIRCLES_STOPPED_V1, 'the v1 status is the low half')
    assert.equal(live.lastMintTime, 0x6a58a650n, 'and the mint time the high half')
    assert.equal(live.stopped, false)
    assert.equal(live.registered, true)
  })

  test('the stopped sentinel is exactly uint96 max, not merely a large number', () => {
    const stopped = decodeCirclesMintTime(STOPPED_WORD)
    assert.equal(stopped.lastMintTime, CIRCLES_INDEFINITE_FUTURE)
    assert.equal(stopped.stopped, true)
    // The consequence the whole change turns on: the Hub's own personhood predicate is
    // `lastMintTime > 0`, and the sentinel satisfies it. A stopped avatar is still a human.
    assert.equal(stopped.registered, true, 'stopping does not deregister')

    const oneBelow = decodeCirclesMintTime(((1n << 96n) - 2n) << 160n)
    assert.equal(oneBelow.stopped, false, 'a timestamp one short of the sentinel is not stopped')
  })

  test('an address the Hub has never seen is an all-zero word, and reads as unregistered', () => {
    const absent = decodeCirclesMintTime(0n)
    assert.equal(absent.registered, false)
    assert.equal(absent.stopped, false)
    assert.equal(absent.lastMintTime, 0n)
  })

  test('the storage key is the mapping key for slot 21, pinned against the chain', () => {
    // Read from Gnosis on 2026-07-25: this exact key holds the stopped sentinel. Pinned so that
    // a change to the slot constant is a red test rather than a silently empty read.
    assert.equal(
      circlesMintTimeSlot('0xeb94174e82d6a070dcb0135b09270de4a3a3bce0'),
      '0x4cfdcc426670c680f731a7ce2772f44309d7c4034a8fdc2fe8a7e4c9df688c93',
    )
    assert.equal(
      circlesMintTimeSlot('0x4bfc74983d6338d3395a00118546614bb78472c2'),
      '0x5da05f562521fb4044baa5bea86dd7cec47c295e68209fff81e240c29b1c4f87',
    )
  })
})

/** A client that answers `getStorageAt` and nothing else. */
const clientReturning = (word: string | undefined | Error): PublicClient =>
  ({
    getStorageAt: async () => {
      if (word instanceof Error) throw word
      return word
    },
  }) as unknown as PublicClient

describe('the slot read validates itself against isHuman', () => {
  test('a word that agrees with isHuman is used', async () => {
    const r = await readCirclesStopped(
      clientReturning('0x' + STOPPED_WORD.toString(16).padStart(64, '0')),
      '0xeb94174e82d6a070dcb0135b09270de4a3a3bce0',
      true,
    )
    assert.equal(r?.stopped, true)
  })

  test('a word that disagrees with isHuman is discarded, because that is a moved layout', async () => {
    // The failure a hard-coded storage slot has to be safe against. `isHuman` is a public getter
    // over the very word being decoded, so the chain checks our arithmetic on every call — and
    // the only thing a wrong slot can do here is cost us the flag.
    const r = await readCirclesStopped(
      clientReturning('0x' + STOPPED_WORD.toString(16).padStart(64, '0')),
      '0xeb94174e82d6a070dcb0135b09270de4a3a3bce0',
      false,
    )
    assert.equal(r, undefined, 'a decode saying "registered" against an isHuman saying no')

    const empty = await readCirclesStopped(clientReturning('0x' + '0'.repeat(64)), '0xdead', true)
    assert.equal(empty, undefined, 'and the same in the other direction')
  })

  test('an RPC that fails reports nothing and never throws', async () => {
    // A probe that throws is a subject scored as not-a-human. This one is called inside the
    // chain read, so it has to swallow its own failures rather than take the credential with it.
    assert.equal(
      await readCirclesStopped(clientReturning(new Error('rate limited')), '0xdead', true),
      undefined,
    )
    assert.equal(await readCirclesStopped(clientReturning(undefined), '0xdead', true), undefined)
  })
})

// --------------------------------------------------------------- the index side

let server: Server
let url: string
before(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          data: {
            _meta: { block: { number: 47_000_000, timestamp: 1_800_000_000 } },
            coverage: {
              firstEventBlock: '36501311',
              firstEventAt: '1728000000',
              firstEventKind: 'RegisterHuman',
            },
            entity: {
              registeredAt: '1731405565',
              trustedByCount: 126,
              stopped: true,
              inviter: '0x6b69683c8897e3d18e74b1ba117b49f80423da5d',
              registrationObserved: true,
            },
          },
        }),
      )
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/graphql`
})
after(() => server.close())

const STOPPED_AVATAR = '0xeb94174e82d6a070dcb0135b09270de4a3a3bce0'

describe('a stopped avatar is not an ended credential', () => {
  test('the index reports the flag beside the credential, never inside it', async () => {
    const view = await circlesIndexRead(url, STOPPED_AVATAR)
    assert.equal(view?.stopped, true, 'the flag is still carried')
    assert.equal(view?.entity?.ended, false, 'but Circles has no revocation, so nothing ended')
    assert.equal(view?.trustedByCount, 126)
  })

  test('and the same subject is held whether or not the chain read succeeds', async () => {
    // The bug. `ended` is the one field the reconciler cannot second-guess: on the branch where
    // the contract read failed it *is* the answer. So `stopped -> ended` made a stopped avatar
    // held at head — `isHuman` is true — and not held the moment the Gnosis RPC hiccupped. Two
    // answers about one subject, chosen by our own uptime, which is exactly the tear
    // `reconcile.ts` was written to remove.
    const view = await circlesIndexRead(url, STOPPED_AVATAR)
    const atHead = reconcileIndexAndChain({
      chain: { held: true, block: 47_000_100 },
      index: view!,
    })
    const rpcDown = reconcileIndexAndChain({
      chain: { held: false, unavailable: true },
      index: view!,
    })
    assert.equal(atHead.held, true)
    assert.equal(rpcDown.held, true, 'the index cannot retire a credential the chain still honours')
    assert.equal(rpcDown.issuedAt, 1731405565, 'and it still dates it')
    assert.ok(rpcDown.provenance.notes.includes('freshness-check-unavailable'))
  })
})
