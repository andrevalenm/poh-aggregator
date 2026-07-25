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
  })
})

/**
 * Find an address that minted a passport on Optimism recently, by reading EAS's own `Attested`
 * log for the schema the Decoder names. Permissionless, no vendor endpoint, and it keeps the
 * positive-path test from depending on one address staying unexpired.
 */
async function findCurrentMinter(): Promise<Address | undefined> {
  const c = clientFor('optimism')
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
    for (let i = 0; i < 6; i++) {
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
      } catch {
        break // this endpoint will not serve log ranges; the caller treats that as "not found"
      }
    }
  }
  return undefined
}
