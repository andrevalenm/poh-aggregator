import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import {
  PROTOCOL_FIRST_CREDENTIAL_BLOCK,
  circlesIndexRead,
  indexCoverage,
  pohIndexRead,
} from './subgraph.ts'
import { reconcileIndexAndChain } from './reconcile.ts'

/**
 * The index reporting on itself.
 *
 * `completeHistory` decides whether an index's silence is evidence, and it used to be a constant
 * compiled into this package and kept in step with a manifest in another one by hand. When that
 * drifts it drifts silently and in the dangerous direction: a windowed index called complete
 * turns "we cannot see it" into "it did not exist", which prices a real credential as brand new.
 * So the subgraph now records the earliest event it indexed and the SDK derives coverage from it.
 *
 * These run against a local server rather than the deployed subgraph because the interesting
 * cases are the ones a healthy deployment does not produce: a narrowed window, a sync that has
 * not reached its first event, a deployment predating the fields, an endpoint that fails.
 */

let server: Server
let url: string
/** What the last request asked for, so the tests can assert *how* it was asked, not just what came back. */
let requests: string[] = []
/** The response body the server will answer with next. */
let respond: (query: string) => unknown

before(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const query = String((JSON.parse(body) as { query: string }).query)
      requests.push(query)
      const answer = respond(query)
      if (answer === undefined) {
        res.writeHead(502).end('upstream is having a day')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/graphql`
})

after(() => server.close())

const META = { block: { number: 47_000_000, timestamp: 1_800_000_000 } }

/** A deployment on the current schema: it knows its own lower edge and flags observed issuance. */
function modern(opts: {
  coverage?: { firstEventBlock: number; kind?: string } | null
  avatar?: Record<string, unknown> | null
  human?: Record<string, unknown> | null
}) {
  return (query: string) => {
    assert.ok(query.includes('indexCoverage'), 'the modern read asks for coverage')
    const coverage = opts.coverage
      ? {
          firstEventBlock: String(opts.coverage.firstEventBlock),
          firstEventAt: '1729000000',
          firstEventKind: opts.coverage.kind ?? 'RegisterHuman',
        }
      : null
    return {
      data: {
        _meta: META,
        coverage,
        entity: opts.avatar ?? opts.human ?? null,
      },
    }
  }
}

/** A deployment that predates the new fields: graph-node rejects the selection outright. */
function legacy(entity: Record<string, unknown> | null) {
  return (query: string) => {
    if (query.includes('indexCoverage') || query.includes('registrationObserved') || query.includes('claimObserved')) {
      return { errors: [{ message: 'type CirclesAvatar has no field registrationObserved' }] }
    }
    return { data: { _meta: META, entity } }
  }
}

const ADDR = '0xd40133ea712e7012a95fdd3c008ab58f7918b446'

describe('coverage comes from the index, not from a constant', () => {
  test('an index whose first event precedes the protocol\'s first credential has complete history', async () => {
    requests = []
    respond = modern({
      coverage: { firstEventBlock: PROTOCOL_FIRST_CREDENTIAL_BLOCK.circles },
      avatar: { registeredAt: '1729000000', trustedByCount: 3, stopped: false, registrationObserved: true, inviter: '0x00' },
    })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(view?.completeHistory, true)
    assert.equal(view?.entity?.issuanceObserved, true)
    assert.equal(requests.length, 1, 'entity, head and coverage in one round trip — two would tear')
  })

  test('a narrowed window loses the claim to complete history by itself', async () => {
    // The failure the constant could not catch: redeploy with a later startBlock and the old SDK
    // went on asserting complete history, so every avatar registered before the window read as
    // "did not exist yet" — a real credential priced as brand new.
    respond = modern({
      coverage: { firstEventBlock: PROTOCOL_FIRST_CREDENTIAL_BLOCK.circles + 1, kind: 'Trust' },
      avatar: null,
    })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(view?.completeHistory, false)

    const r = reconcileIndexAndChain({ chain: { held: true, block: 47_000_100 }, index: view! })
    assert.equal(r.issuedAfter, undefined, 'and absence bounds nothing')
    assert.ok(r.provenance.notes.includes('index-outside-coverage'))
  })

  test('a sync that has not reached its first event claims nothing', async () => {
    respond = modern({ coverage: null, avatar: null })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(view?.completeHistory, false, 'no record yet is not the same as complete')
    assert.equal(view?.block, META.block.number, 'but the block it has reached is still reported')
  })

  test('the coverage read is also available on its own, with the yardstick applied', async () => {
    respond = () => ({
      data: {
        coverage: {
          firstEventBlock: String(PROTOCOL_FIRST_CREDENTIAL_BLOCK.poh - 1000),
          firstEventAt: '1700000000',
          firstEventKind: 'VouchRegistered',
        },
      },
    })
    const c = await indexCoverage(url, 'poh')
    assert.equal(c?.completeHistory, true)
    assert.equal(c?.firstEventKind, 'VouchRegistered')
    assert.equal(c?.protocol, 'poh')
  })

  test('an endpoint that fails reports no answer, never a coverage claim', async () => {
    respond = () => undefined
    assert.equal(await circlesIndexRead(url, ADDR), undefined)
    assert.equal(await indexCoverage(url, 'circles'), undefined)
  })

  test('an answer with no _meta is not an answer', async () => {
    respond = () => ({ data: { _meta: null, coverage: null, entity: null } })
    assert.equal(await pohIndexRead(url, ADDR), undefined)
  })
})

describe('a deployment predating these fields still answers', () => {
  test('the query is retried in the old shape and the old assumptions are used', async () => {
    requests = []
    respond = legacy({ registeredAt: '1729000000', trustedByCount: 1, stopped: false, inviter: null })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(requests.length, 2, 'one rejection, one fallback')
    assert.equal(view?.completeHistory, false, 'the declared fallback for a windowed Circles source')
    assert.equal(
      view?.entity?.issuanceObserved,
      false,
      'the old discriminator: a null inviter means the registration was never indexed',
    )
  })

  test('and a legacy PoH entity keeps being read as claim-dated, which is all it can support', async () => {
    respond = legacy({ claimedAt: '1729000000', revoked: false })
    const view = await pohIndexRead(url, ADDR)
    assert.equal(view?.completeHistory, true)
    assert.equal(view?.entity?.issuanceObserved, true)
  })
})

describe('what the index saw decides how its date is used', () => {
  test('a vouch-dated PoH entity is a bound, not a date, end to end', async () => {
    respond = modern({ human: { claimedAt: '1729000000', revoked: false, claimObserved: false } })
    const view = await pohIndexRead(url, ADDR)
    assert.equal(view?.entity?.issuanceObserved, false)
    assert.equal(view?.entity?.sideEventOrder, 'before-issuance')

    // No chain date, so the index is the only source of one — which is the branch where the
    // direction decides whether the credential is credited with age it may not have.
    const r = reconcileIndexAndChain({ chain: { held: true, block: 47_000_100 }, index: view! })
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.issuedAfter, 1_729_000_000)
    assert.ok(r.provenance.notes.includes('index-date-precedes-issuance'))
  })

  test('a claim-dated PoH entity dates the credential outright', async () => {
    respond = modern({ human: { claimedAt: '1729000000', revoked: false, claimObserved: true } })
    const view = await pohIndexRead(url, ADDR)
    const r = reconcileIndexAndChain({ chain: { held: true, block: 47_000_100 }, index: view! })
    assert.equal(r.issuedAt, 1_729_000_000)
    assert.deepEqual(r.provenance.notes, [])
  })

  test('a trust-edge-dated avatar keeps its date as a floor', async () => {
    respond = modern({
      coverage: { firstEventBlock: PROTOCOL_FIRST_CREDENTIAL_BLOCK.circles },
      avatar: { registeredAt: '1729000000', trustedByCount: 2, stopped: false, registrationObserved: false, inviter: null },
    })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(view?.entity?.sideEventOrder, 'after-issuance')
    const r = reconcileIndexAndChain({ chain: { held: true, block: 47_000_100 }, index: view! })
    assert.equal(r.issuedAt, 1_729_000_000, 'a trust edge cannot precede the registration it points at')
    assert.ok(r.provenance.notes.includes('index-date-is-lower-bound'))
  })

  test('graph position rides along in the same request', async () => {
    respond = modern({
      coverage: { firstEventBlock: PROTOCOL_FIRST_CREDENTIAL_BLOCK.circles },
      avatar: { registeredAt: '1729000000', trustedByCount: 7, stopped: false, registrationObserved: true, inviter: '0x00' },
    })
    const view = await circlesIndexRead(url, ADDR)
    assert.equal(view?.trustedByCount, 7)
  })
})
