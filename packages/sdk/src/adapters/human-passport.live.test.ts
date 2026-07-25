/**
 * Human Passport, against the real deployments on all seven chains.
 *
 * These assert the *mechanism*, not a magic number, because every number here has an owner who
 * can change it. A passport expires after ninety days, so any address that scores today scores
 * nothing in three months; pinning a score would buy a test that passes until it silently
 * doesn't. What cannot drift is the arithmetic: the resolver's cached struct, the Decoder's
 * revert, and our derived expiry must all agree about the same address at the same instant.
 *
 * Run: node --test --experimental-strip-types src/adapters/human-passport.live.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem'
import {
  humanPassportAdapter,
  PASSPORT_DEPLOYMENTS,
  STAMP_TO_ADAPTER,
  SCORE_V2_ONLY_STAMPS,
  type PassportChain,
} from './human-passport.ts'
import type { Address } from '../types.ts'

/** Nobody has minted a passport to the burn address, and nobody can. */
const NEVER_MINTED = '0x000000000000000000000000000000000000dEaD' as Address

/**
 * A real minter, copied whole from an on-chain `Attested` log for Passport's score schema on
 * Optimism (EAS `0x4200…0021`, schema `0x6ab5d342…e9c89`), not from any document. It is used
 * only as a subject that has *ever* minted on more than one chain — no test below asserts what
 * its score is or whether it is currently valid.
 */
const MULTI_CHAIN_MINTER = '0xb0812e0006470fE99F71165fC7C1A2312F7b90F2' as Address

const DECODER_ABI = parseAbi([
  'function gitcoinResolver() view returns (address)',
  'function maxScoreAge() view returns (uint64)',
  'function threshold() view returns (uint256)',
  'function currentVersion() view returns (uint32)',
  'function getProviders(uint32 version) view returns (string[])',
  'function getScore(address user) view returns (uint256)',
])
const RESOLVER_ABI = parseAbi([
  'function getCachedScore(address user) view returns ((uint32 score, uint64 time, uint64 expirationTime))',
  'function userAttestations(address user, bytes32 schema) view returns (bytes32)',
])

/** The EAS predeploy, identical on every OP-stack chain. The attestation itself lives here. */
const EAS_PREDEPLOY = '0x4200000000000000000000000000000000000021' as Address
const EAS_ABI = parseAbi([
  'function getAttestation(bytes32 uid) view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))',
])
const SCHEMA_ABI = parseAbi([
  'function scoreSchemaUID() view returns (bytes32)',
  'function scoreV2SchemaUID() view returns (bytes32)',
])

/** Custom errors declared by GitcoinPassportDecoder.sol. Selectors confirmed against live reverts. */
const ATTESTATION_NOT_FOUND = '0x120a2e77'
const ATTESTATION_EXPIRED = '0x06c09405'

const clientFor = (chain: PassportChain) =>
  createPublicClient({ transport: http(PASSPORT_DEPLOYMENTS[chain].rpc, { timeout: 20_000 }) })

const ALL_CHAINS = Object.keys(PASSPORT_DEPLOYMENTS) as PassportChain[]

/**
 * An unreachable public RPC says nothing about the mechanism under test, so it is reported
 * loudly and skipped rather than failed — the same rule the rest of the live suite follows.
 * A chain that *answers* is held to the assertion in full.
 */
function reportUnreachable(where: string, failures: { chain: PassportChain; error: string }[]) {
  if (!failures.length) return
  console.log(
    `    (${where}: ${failures.length}/${ALL_CHAINS.length} endpoints unreachable — ` +
      failures.map((f) => `${f.chain}: ${f.error.split('\n')[0]}`).join('; ') +
      ')',
  )
}

/** Raw eth_call so we see the revert selector and its payload, which viem otherwise swallows. */
async function rawGetScore(chain: PassportChain, user: Address): Promise<{ ok: bigint } | { revert: string }> {
  const data = encodeFunctionData({ abi: DECODER_ABI, functionName: 'getScore', args: [user] })
  try {
    const r = await clientFor(chain).request({
      method: 'eth_call',
      params: [{ to: PASSPORT_DEPLOYMENTS[chain].decoder, data }, 'latest'],
    })
    return { ok: BigInt(r as string) }
  } catch (e) {
    const d = (e as { cause?: { data?: string }; data?: string }).cause?.data ??
      (e as { data?: string }).data
    if (typeof d !== 'string') throw e
    return { revert: d }
  }
}

describe('Human Passport (live, seven chains)', () => {
  test('every deployment answers, and an address that never minted is absent everywhere', async () => {
    const r = await humanPassportAdapter().probe(NEVER_MINTED)
    assert.equal(r.error, undefined, `probe errored: ${r.error}`)
    assert.equal(r.held, false)
    assert.equal(r.detail?.['minted'], false)
    // Coverage, not the negative: if a deployment stops answering we lose the addresses that
    // only minted there, and their score drops with nothing in the result to say why. The
    // probe therefore has to *name* the chains it could not read, and that naming is what is
    // asserted here — an endpoint being down is an operational fact, hiding it is a defect.
    const unreadable = (r.detail?.['chainsUnreadable'] as string[] | undefined) ?? []
    assert.equal(
      (r.detail?.['chainsRead'] as number) + unreadable.length,
      ALL_CHAINS.length,
      'every deployment must be either read or reported unreadable',
    )
    if (unreadable.length) console.log(`    (unreadable this run: ${unreadable.join(', ')})`)
  })

  test('each Decoder names its own resolver, and expiry is a 90-day maxScoreAge everywhere', async () => {
    // We never hard-code the resolver: we ask the Decoder which one it trusts. This asserts
    // that call still works on every chain, since a failure there would take the whole probe
    // down on that chain rather than degrading it.
    const failures: { chain: PassportChain; error: string }[] = []
    let checked = 0
    for (const chain of ALL_CHAINS) {
      const c = clientFor(chain)
      const dec = PASSPORT_DEPLOYMENTS[chain].decoder
      let resolver: `0x${string}`
      let maxScoreAge: bigint
      let code: string | undefined
      try {
        ;[resolver, maxScoreAge] = await Promise.all([
          c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'gitcoinResolver' }),
          c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'maxScoreAge' }),
        ])
        code = await c.getCode({ address: resolver })
      } catch (e) {
        failures.push({ chain, error: e instanceof Error ? e.message : String(e) })
        continue
      }
      checked++
      assert.notEqual(resolver, '0x0000000000000000000000000000000000000000', `${chain}: no resolver`)
      assert.ok((code?.length ?? 0) > 2, `${chain}: the resolver the Decoder names has no code`)
      assert.ok(Number(maxScoreAge) > 0, `${chain}: maxScoreAge is zero, so nothing would ever expire`)
    }
    reportUnreachable('resolver check', failures)
    assert.ok(checked > 0, 'no Passport deployment was reachable at all')
  })

  /**
   * The one that matters. Our probe derives expiry as `expirationTime || time + maxScoreAge`
   * and decides `held` from it. The Decoder decides the same thing independently, in Solidity,
   * and tells us by reverting. If those two ever disagree we are scoring a credential the
   * issuing contract considers dead — or refusing one it considers alive.
   */
  test('our derived expiry agrees with what the Decoder itself does, on real addresses', async () => {
    const c = clientFor('optimism')
    const dec = PASSPORT_DEPLOYMENTS.optimism.decoder
    const [resolver, maxScoreAge] = await Promise.all([
      c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'gitcoinResolver' }),
      c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'maxScoreAge' }),
    ])

    let checkedMinted = 0
    for (const user of [MULTI_CHAIN_MINTER, NEVER_MINTED]) {
      const cached = await c.readContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: 'getCachedScore',
        args: [user],
      })
      const result = await rawGetScore('optimism', user)

      if (Number(cached.time) === 0) {
        assert.ok('revert' in result, `${user}: no cached score but getScore returned a value`)
        assert.equal(result.revert, ATTESTATION_NOT_FOUND, `${user}: unexpected revert ${result.revert}`)
        continue
      }
      checkedMinted++

      const expiresAt =
        Number(cached.expirationTime) > 0
          ? Number(cached.expirationTime)
          : Number(cached.time) + Number(maxScoreAge)
      const head = await c.getBlock()
      const expired = Number(head.timestamp) >= expiresAt

      if (expired) {
        assert.ok('revert' in result, `${user}: we call it expired, the Decoder returned a score`)
        assert.equal(result.revert.slice(0, 10), ATTESTATION_EXPIRED, `${user}: revert ${result.revert}`)
        // The revert payload is the expiry the contract computed. It must be the number we
        // computed — that is the whole claim, and it is checkable to the second.
        assert.equal(
          BigInt(`0x${result.revert.slice(10)}`),
          BigInt(expiresAt),
          `${user}: contract expiry disagrees with ours`,
        )
      } else {
        assert.ok('ok' in result, `${user}: we call it valid, the Decoder reverted ${JSON.stringify(result)}`)
        assert.equal(result.ok, BigInt(cached.score), `${user}: getScore disagrees with the cached struct`)
      }
    }
    assert.ok(checkedMinted > 0, 'no minted address was exercised, so the expiry branch went untested')
  })

  test('one chain is not enough: this subject minted on several, at different times', async () => {
    // Passport is minted per chain and the mints disagree, so a single-chain read is not a
    // cheaper version of this probe — it is a wrong one. This holds for any past minter
    // regardless of whether the scores are still valid.
    const seen: Record<string, number> = {}
    const failures: { chain: PassportChain; error: string }[] = []
    for (const chain of ALL_CHAINS) {
      try {
        const c = clientFor(chain)
        const resolver = await c.readContract({
          address: PASSPORT_DEPLOYMENTS[chain].decoder,
          abi: DECODER_ABI,
          functionName: 'gitcoinResolver',
        })
        const cached = await c.readContract({
          address: resolver,
          abi: RESOLVER_ABI,
          functionName: 'getCachedScore',
          args: [MULTI_CHAIN_MINTER],
        })
        if (Number(cached.time) > 0) seen[chain] = Number(cached.time)
      } catch (e) {
        failures.push({ chain, error: e instanceof Error ? e.message : String(e) })
      }
    }
    reportUnreachable('multi-chain read', failures)
    if (ALL_CHAINS.length - failures.length < 2) {
      console.log('    (fewer than two endpoints reachable; the multi-chain claim cannot be tested)')
      return
    }
    assert.ok(
      Object.keys(seen).length >= 2,
      `expected this subject on >=2 chains, found ${JSON.stringify(seen)}`,
    )
    assert.ok(
      new Set(Object.values(seen)).size >= 2,
      `the mints should carry different issuance dates: ${JSON.stringify(seen)}`,
    )
  })

  test('every legacy stamp we map is still a provider the Decoder knows', async () => {
    // The stamp map is how a Passport score gets attributed back to the roots it restates. A
    // provider renamed upstream would quietly stop matching, and the correlation it represents
    // would vanish from the caveat while still being inside the score.
    const c = clientFor('optimism')
    const dec = PASSPORT_DEPLOYMENTS.optimism.decoder
    const version = await c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'currentVersion' })
    const providers = await c.readContract({
      address: dec,
      abi: DECODER_ABI,
      functionName: 'getProviders',
      args: [version],
    })
    assert.ok(providers.length > 50, `only ${providers.length} providers on chain`)

    const onChain = new Set(providers)
    for (const stamp of Object.keys(STAMP_TO_ADAPTER)) {
      if (SCORE_V2_ONLY_STAMPS.includes(stamp)) {
        assert.ok(
          !onChain.has(stamp),
          `${stamp} is now in the on-chain provider list, so it is no longer score-v2 only`,
        )
        continue
      }
      assert.ok(onChain.has(stamp), `mapped stamp "${stamp}" is not a provider the Decoder knows`)
    }
  })

  test('a scored passport reports its restated roots, and every one resolves to a real adapter', async () => {
    // Sourced live rather than pinned: any address with a current passport will do, and the
    // set of them changes every day.
    const ontology = (await import('../ontology-data.json', { with: { type: 'json' } })).default
    const known = new Set(ontology.adapters.map((a: { id: string }) => a.id))
    for (const stamp of Object.keys(STAMP_TO_ADAPTER)) {
      const id = STAMP_TO_ADAPTER[stamp]!
      assert.ok(known.has(id), `stamp ${stamp} maps to "${id}", which is not in the ontology`)
    }

    const minter = await findCurrentMinter()
    if (!minter) {
      // Not a failure: it means no passport was minted on Optimism in the window we scanned,
      // which says nothing about our mechanism. Every other test here still ran.
      console.log('    (no freshly minted passport found in the scanned window; positive path skipped)')
      return
    }
    const r = await humanPassportAdapter({ chains: ['optimism'] }).probe(minter)
    assert.equal(r.error, undefined, `probe errored for ${minter}: ${r.error}`)
    assert.equal(r.held, true, `expected ${minter} to hold a current passport: ${JSON.stringify(r.detail)}`)
    assert.equal(typeof r.issuedAt, 'number', 'a passport read must carry its issuance date')
    assert.ok(
      (r.detail?.['expiresAt'] as number) > (r.issuedAt as number),
      'a passport must expire after it was issued',
    )
    // The score is reported and never consumed: nothing in the result scales with it.
    assert.equal(typeof r.detail?.['score'], 'number')
    assert.equal(typeof r.detail?.['meetsPassportThreshold'], 'boolean')
    for (const id of (r.detail?.['restatesAdapters'] as string[] | undefined) ?? []) {
      assert.ok(known.has(id), `restated adapter "${id}" is not in the ontology`)
    }
    // A credential that is held has not ended. `heldUntil` may only ever mean "the chain says
    // this stopped here", and a live passport is the case where inventing one would be easiest.
    assert.equal(r.heldUntil, undefined, 'a current passport must not be handed a closed window')
  })

  /**
   * The acceptance test for the lapsed window.
   *
   * The probe reads exactly one thing: the resolver's cached struct. This holds the window it
   * derives from that struct against **two contracts it never touches** — the EAS attestation
   * behind the score, which dates the start, and the Decoder, which dates the end by reverting.
   * Three sources, one window, and the probe consulted only the first.
   *
   * It also answers the question iteration 16 refused Holonym on: *is the credential still
   * attributable at the instant you restore it?* Holonym's `getSBT` reverts once an SBT expires,
   * so the issuer check that makes it evidence is unreadable for exactly the credentials that
   * would be restored. Here the EAS record survives with the subject still named as its
   * recipient and its `revocationTime` still zero, which is what the assertions below check.
   */
  test('a lapsed passport is a closed window, and both of its ends come back from elsewhere', async (t) => {
    const c = clientFor('optimism')
    const dec = PASSPORT_DEPLOYMENTS.optimism.decoder

    const r = await humanPassportAdapter({ chains: ['optimism'] }).probe(MULTI_CHAIN_MINTER)
    if (r.error) {
      t.skip(`Optimism unreachable: ${r.error.split('\n')[0]}`)
      return
    }
    if (r.held) {
      // Nothing is wrong: the subject re-minted, and a live passport has not ended. Skipping
      // loudly beats asserting against a world that moved.
      t.skip(`${MULTI_CHAIN_MINTER} holds a current passport again, so it has no lapsed window`)
      return
    }
    if (r.heldUntil === undefined) {
      t.skip(`${MULTI_CHAIN_MINTER} has no lapsed non-zero passport on Optimism: ${JSON.stringify(r.detail)}`)
      return
    }

    const head = Number((await c.getBlock()).timestamp)
    assert.equal(typeof r.issuedAt, 'number', 'a closed window needs both ends')
    assert.ok(r.heldUntil > (r.issuedAt as number), 'the window must be non-empty')
    assert.ok(r.heldUntil <= head, 'a window that has not closed yet is not a window')
    assert.ok(r.provenance?.notes.includes('date-from-lapsed-verification'))
    assert.equal(r.detail?.['lapsedChain'], 'optimism')

    // Source two: the attestation the resolver was caching. Passport writes under one of two
    // schemas and the resolver files the uid under whichever it was, so ask for both.
    const resolver = await c.readContract({ address: dec, abi: DECODER_ABI, functionName: 'gitcoinResolver' })
    const schemas = await Promise.all(
      (['scoreV2SchemaUID', 'scoreSchemaUID'] as const).map((fn) =>
        c.readContract({ address: dec, abi: SCHEMA_ABI, functionName: fn }).catch(() => null),
      ),
    )
    let matched = 0
    for (const schema of schemas) {
      if (!schema || /^0x0+$/.test(schema)) continue
      const uid = await c.readContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: 'userAttestations',
        args: [MULTI_CHAIN_MINTER, schema],
      })
      if (/^0x0+$/.test(uid)) continue
      const att = await c.readContract({
        address: EAS_PREDEPLOY,
        abi: EAS_ABI,
        functionName: 'getAttestation',
        args: [uid],
      })
      matched++
      assert.equal(att.schema, schema, 'the resolver filed this uid under a different schema')
      assert.equal(
        att.recipient.toLowerCase(),
        MULTI_CHAIN_MINTER.toLowerCase(),
        'the attestation behind a restored credential must still name this subject',
      )
      assert.equal(
        Number(att.revocationTime),
        0,
        'a revoked attestation ends earlier than its expiry, so the window would be too long',
      )
      assert.equal(
        Number(att.time),
        r.issuedAt,
        'EAS dates the attestation differently from the struct the probe read',
      )
    }
    assert.ok(matched > 0, 'the resolver holds a cached score with no attestation behind it')

    // Source three: the Decoder, which decides expiry in Solidity and tells us by reverting.
    const decoded = await rawGetScore('optimism', MULTI_CHAIN_MINTER)
    assert.ok('revert' in decoded, 'we call this passport lapsed and the Decoder returned a score')
    assert.equal(decoded.revert.slice(0, 10), ATTESTATION_EXPIRED, `unexpected revert ${decoded.revert}`)
    assert.equal(
      BigInt(`0x${decoded.revert.slice(10)}`),
      BigInt(r.heldUntil),
      'the end of our window is not the instant the Decoder says the score expired',
    )
  })

  test('an address that never minted gets no window, because absence is not an ending', async () => {
    const r = await humanPassportAdapter({ chains: ['optimism'] }).probe(NEVER_MINTED)
    if (r.error) return // covered by the first test; an outage says nothing about this claim
    assert.equal(r.held, false)
    assert.equal(r.heldUntil, undefined)
    assert.equal(r.issuedAt, undefined)
    assert.equal(r.provenance?.dateFrom, 'none')
  })
})

/**
 * A keyless Optimism endpoint that will serve `eth_getLogs`.
 *
 * Deliberately not `PASSPORT_DEPLOYMENTS.optimism.rpc`: publicnode answers every `eth_call` the
 * probe makes and rejects this filter outright with `InvalidParams` (verified 2026-07-25), so
 * using it here turned "the endpoint will not serve logs" into "nobody has minted a passport" —
 * and the positive-path test below then skipped itself in silence. `drpc` answers the same
 * query and returns real logs. The probe itself still reads publicnode; nothing here is on the
 * scoring path.
 */
const OPTIMISM_LOG_RPC = 'https://optimism.drpc.org'

/**
 * Find an address that minted a passport on Optimism recently, by reading EAS's own `Attested`
 * log for the schema the Decoder names. Permissionless, no vendor endpoint, and it keeps the
 * positive-path test from depending on one address staying unexpired.
 *
 * The window is 16 × 9,000 blocks ≈ 1.7 days of Optimism. That is not arbitrary: score-v2 mints
 * were arriving several times a day when this adapter was written and are now down to a couple
 * every day or two — the most recent mint on 2026-07-25 was 54,000 blocks back, past the 45,000
 * this searched before, which is exactly how a thinning population turns a positive-path test
 * into a no-op.
 */
async function findCurrentMinter(): Promise<Address | undefined> {
  const c = createPublicClient({ transport: http(OPTIMISM_LOG_RPC, { timeout: 20_000 }) })
  const EAS = '0x4200000000000000000000000000000000000021' as Address
  const attested = parseAbi([
    'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)',
  ])[0]
  const schemas = await Promise.all(
    (['scoreV2SchemaUID', 'scoreSchemaUID'] as const).map((fn) =>
      c
        .readContract({
          address: PASSPORT_DEPLOYMENTS.optimism.decoder,
          abi: parseAbi([`function ${fn}() view returns (bytes32)`]),
          functionName: fn,
        })
        .catch(() => null),
    ),
  )
  const head = await c.getBlockNumber()
  for (const schemaUID of schemas) {
    if (!schemaUID || /^0x0+$/.test(schemaUID)) continue
    for (let i = 0; i < 16; i++) {
      const to = head - BigInt(i) * 9_000n
      try {
        const logs = await c.getLogs({
          address: EAS,
          event: attested,
          args: { schemaUID },
          fromBlock: to - 8_999n,
          toBlock: to,
        })
        const hit = logs.at(-1)?.args.recipient
        if (hit) return hit as Address
      } catch (e) {
        // Say so. An endpoint refusing the filter and a registry with no recent mint produce
        // the same `undefined` here, and the caller cannot tell them apart — which is how this
        // search silently stopped covering anything at all.
        console.log(`    (${OPTIMISM_LOG_RPC} would not serve the filter: ${(e as Error).message.split('\n')[0]})`)
        break
      }
    }
  }
  return undefined
}
