/**
 * The presenter gate, without a network.
 *
 * Every test here signs with a real key and checks a real signature — `privateKeyToAccount` is
 * arithmetic, not I/O — so the crypto is exercised rather than stubbed. What is faked is only the
 * chain read a *smart account* would need, because that is the one branch that has to be able to
 * fail in a controlled way.
 *
 * The claim under test is not "a signature verifies". It is that a signature only counts for the
 * name, the domain, the request and the wallet it was issued against, and that every other
 * outcome is refused with a sentence a presenter could act on.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import {
  DEFAULT_CHALLENGE_TTL_MS,
  ENS_RESOURCE_SCHEME,
  ensPresentationMessage,
  issueEnsPresentationChallenge,
  verifyEnsPresentation,
  verifyEnsPresentations,
  type EnsPresentationChallenge,
} from './ens-presentation.ts'
import { evaluateFleet, type FleetAgent, type FleetPolicy, type HumanEvidence } from './fleet.ts'

const AGENT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex
const STRANGER_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' as Hex
const OWNER_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as Hex

const agent = privateKeyToAccount(AGENT_KEY)
const stranger = privateKeyToAccount(STRANGER_KEY)
const owner = privateKeyToAccount(OWNER_KEY)

const NAME = 'alpha.print.eth'
const DOMAIN = 'meridian.example'
const URI = 'https://meridian.example/order'
const NOW = new Date('2026-07-25T12:00:00.000Z')

function challengeFor(overrides: Partial<EnsPresentationChallenge> = {}): EnsPresentationChallenge {
  return {
    ...issueEnsPresentationChallenge({
      domain: DOMAIN,
      uri: URI,
      name: NAME,
      chainId: 11155111,
      nonce: 'nonce0123456789',
      now: NOW,
    }),
    ...overrides,
  }
}

/** Sign whatever message the challenge produces for `account`. */
async function present(
  challenge: EnsPresentationChallenge,
  account: typeof agent,
  opts: { name?: string; message?: string } = {},
) {
  const message = opts.message ?? ensPresentationMessage(challenge, account.address)
  return { name: opts.name ?? challenge.name, message, signature: await account.signMessage({ message }) }
}

describe('the challenge and the message', () => {
  test('the name is bound into the message, not just into the prompt', () => {
    const c = challengeFor()
    const message = ensPresentationMessage(c, agent.address)
    assert.ok(message.includes(`- ${ENS_RESOURCE_SCHEME}${NAME}`), message)
    // And in the human-readable statement, so a wallet prompt shows what is being authorised.
    assert.ok(message.includes(NAME))
    assert.ok(message.startsWith(`${DOMAIN} wants you to sign in with your Ethereum account:`))
  })

  test('the challenge expires, and says when', () => {
    const c = challengeFor()
    assert.equal(
      new Date(c.expirationTime).getTime() - new Date(c.issuedAt).getTime(),
      DEFAULT_CHALLENGE_TTL_MS,
    )
  })

  test('a name is normalized once, at issue, so the bound value and the compared value are one string', () => {
    const c = issueEnsPresentationChallenge({
      domain: DOMAIN,
      uri: URI,
      name: '  ALPHA.Print.ETH ',
      chainId: 11155111,
    })
    assert.equal(c.name, NAME)
    assert.ok(ensPresentationMessage(c, agent.address).includes(`- ${ENS_RESOURCE_SCHEME}${NAME}`))
  })

  test('two challenges do not share a nonce', () => {
    const a = issueEnsPresentationChallenge({ domain: DOMAIN, uri: URI, name: NAME, chainId: 1 })
    const b = issueEnsPresentationChallenge({ domain: DOMAIN, uri: URI, name: NAME, chainId: 1 })
    assert.notEqual(a.nonce, b.nonce)
  })
})

describe('verifying a presentation', () => {
  test('the agent wallet signing its own name authenticates', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.address, agent.address)
    assert.equal(r.method, 'eoa-ecdsa')
    assert.equal(r.failure, undefined)
    // The scope caveat is not optional: an authentication that does not say what it covers is
    // the thing this file exists to stop being implied.
    assert.ok(r.caveats.some((x) => x.code === 'agent-presenter-authenticated-for-this-wallet-only'))
  })

  test('the whole point: a stranger signing a name they do not hold is refused, and told why', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, stranger),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'signer-is-not-the-name')
    // Both addresses are in the message, because "your signature is invalid" would be false.
    assert.ok(r.error?.includes(agent.address))
    assert.ok(r.error?.includes(stranger.address))
    assert.equal(r.address, stranger.address)
    assert.equal(r.expected, agent.address)
  })

  test('a signature for one name is not a signature for another', async () => {
    // The signer holds the key for both wallets in this scenario — the refusal has to come from
    // the name binding rather than from the key, or one signature is a pass for the whole tree.
    const forAlpha = challengeFor()
    const forBeta = challengeFor({ name: 'beta.print.eth' })
    const harvested = await present(forAlpha, agent)
    const r = await verifyEnsPresentation({
      challenge: forBeta,
      presentation: { ...harvested, name: 'beta.print.eth' },
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'wrong-name')
    assert.ok(r.error?.includes('bearer token'))
  })

  test('a message carrying no ENS resource at all is refused', async () => {
    const c = challengeFor()
    const message = ensPresentationMessage(c, agent.address).replace(
      `Resources:\n- ${ENS_RESOURCE_SCHEME}${NAME}`,
      '',
    )
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent, { message }),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'wrong-name')
  })

  test('a presentation for a name this challenge was not issued for is refused before anything is parsed', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent, { name: 'beta.print.eth' }),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'wrong-name')
  })

  test('a signature for another counterparty is refused', async () => {
    const c = challengeFor()
    const other = challengeFor({ domain: 'evil.example' })
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(other, agent),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'wrong-domain')
    assert.ok(r.error?.includes('evil.example'))
  })

  test('a signature for another resource on the same domain is refused', async () => {
    const c = challengeFor()
    const other = challengeFor({ uri: 'https://meridian.example/newsletter' })
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(other, agent),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'wrong-uri')
  })

  test('a signature for the same name on another chain is refused', async () => {
    const c = challengeFor()
    const other = challengeFor({ chainId: 1 })
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(other, agent),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'wrong-chain')
  })

  test('an expired challenge is refused, and the clock is the caller’s', async () => {
    const c = challengeFor()
    const p = await present(c, agent)
    const late = new Date(new Date(c.expirationTime).getTime() + 1)
    assert.equal(
      (await verifyEnsPresentation({ challenge: c, presentation: p, expectedAddress: agent.address, now: late }))
        .failure,
      'expired',
    )
    // One millisecond earlier it is still good, so the boundary is the stated one.
    const justInTime = new Date(new Date(c.expirationTime).getTime() - 1)
    assert.equal(
      (
        await verifyEnsPresentation({
          challenge: c,
          presentation: p,
          expectedAddress: agent.address,
          now: justInTime,
        })
      ).status,
      'authenticated',
    )
  })

  test('a spent nonce is refused, and verification never spends one itself', async () => {
    const c = challengeFor()
    const p = await present(c, agent)
    const spent = new Set<string>()
    const checkNonce = (n: string) => !spent.has(n)

    const first = await verifyEnsPresentation({
      challenge: c,
      presentation: p,
      expectedAddress: agent.address,
      now: NOW,
      checkNonce,
    })
    assert.equal(first.status, 'authenticated')
    // Burning the nonce is the counterparty's job. Doing it inside verification would spend an
    // honest presenter's nonce on a malformed retry, so replaying works until the caller acts.
    const again = await verifyEnsPresentation({
      challenge: c,
      presentation: p,
      expectedAddress: agent.address,
      now: NOW,
      checkNonce,
    })
    assert.equal(again.status, 'authenticated')

    spent.add(c.nonce)
    const third = await verifyEnsPresentation({
      challenge: c,
      presentation: p,
      expectedAddress: agent.address,
      now: NOW,
      checkNonce,
    })
    assert.equal(third.failure, 'nonce-not-issued')
  })

  test('a mangled signature is refused rather than throwing', async () => {
    const c = challengeFor()
    const p = await present(c, agent)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { ...p, signature: `0x${'11'.repeat(65)}` as Hex },
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'signature-invalid')
  })

  test('a message that is not ERC-4361 at all is refused as malformed', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent, { message: 'gm' }),
      expectedAddress: agent.address,
      now: NOW,
    })
    assert.equal(r.failure, 'malformed-message')
  })

  test('a name with no addr record cannot authenticate anybody, and says so instead of passing', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent),
      now: NOW,
    })
    // The signature is perfectly good. There is simply nothing to match it against, and treating
    // "valid signature" as "authenticated for this name" would authenticate any key at all.
    assert.equal(r.status, 'unknown')
    assert.equal(r.failure, 'signature-unreadable')
    assert.ok(r.caveats.some((x) => x.code === 'agent-presenter-authentication-unreadable'))
  })

  test('a signer that also owns the node is authenticated and flagged, not refused', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, owner),
      expectedAddress: owner.address,
      nodeOwner: owner.address,
      now: NOW,
    })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.signerIsNodeOwner, true)
    assert.ok(r.caveats.some((x) => x.code === 'agent-signer-owns-the-name'))
  })

  test('the ordinary arrangement — agent key separate from the name key — is not flagged', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent),
      expectedAddress: agent.address,
      nodeOwner: owner.address,
      now: NOW,
    })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.signerIsNodeOwner, false)
    assert.equal(r.caveats.some((x) => x.code === 'agent-signer-owns-the-name'), false)
  })
})

describe('smart accounts, and the one branch a chain read can break', () => {
  const contractClient = (answer: boolean | Error) =>
    ({
      async verifyMessage() {
        if (answer instanceof Error) throw answer
        return answer
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any

  test('a contract account whose ERC-1271 check passes is authenticated', async () => {
    const c = challengeFor()
    // Signed by a key that is not the account: exactly the shape of a smart-account signature,
    // where the signer is a session key and the account vouches for it on chain.
    const message = ensPresentationMessage(c, agent.address)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: NAME, message, signature: await stranger.signMessage({ message }) },
      expectedAddress: agent.address,
      now: NOW,
      client: contractClient(true),
    })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.method, 'erc-1271')
  })

  test('a contract account that refuses the signature is unauthenticated', async () => {
    const c = challengeFor()
    const message = ensPresentationMessage(c, agent.address)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: NAME, message, signature: await stranger.signMessage({ message }) },
      expectedAddress: agent.address,
      now: NOW,
      client: contractClient(false),
    })
    assert.equal(r.status, 'unauthenticated')
    assert.equal(r.failure, 'signature-invalid')
  })

  test('an RPC failure during the ERC-1271 read is `unknown`, never a refusal', async () => {
    const c = challengeFor()
    const message = ensPresentationMessage(c, agent.address)
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: { name: NAME, message, signature: await stranger.signMessage({ message }) },
      expectedAddress: agent.address,
      now: NOW,
      client: contractClient(new Error('HTTP 503 from sepolia')),
    })
    assert.equal(r.status, 'unknown')
    assert.equal(r.failure, 'signature-unreadable')
    assert.ok(r.error?.includes('says nothing about the presenter'))
  })

  test('an EOA authenticates with no client at all — no RPC in the common path', async () => {
    const c = challengeFor()
    const r = await verifyEnsPresentation({
      challenge: c,
      presentation: await present(c, agent),
      expectedAddress: agent.address,
      now: NOW,
      // deliberately no client: a client that throws on every call would fail this test
      client: contractClient(new Error('this client must never be consulted')),
    })
    assert.equal(r.status, 'authenticated')
    assert.equal(r.method, 'eoa-ecdsa')
  })
})

describe('a batch', () => {
  test('results come back keyed by normalized name', async () => {
    const a = challengeFor()
    const b = challengeFor({ name: 'beta.print.eth' })
    const results = await verifyEnsPresentations([
      { challenge: a, presentation: await present(a, agent), expectedAddress: agent.address, now: NOW },
      { challenge: b, presentation: await present(b, stranger), expectedAddress: agent.address, now: NOW },
    ])
    assert.equal(results.get(NAME)?.status, 'authenticated')
    assert.equal(results.get('beta.print.eth')?.failure, 'signer-is-not-the-name')
  })
})

// --------------------------------------------------------------------------------------------
// What the gate is for: the decision it changes.
// --------------------------------------------------------------------------------------------

const POLICY: FleetPolicy = {
  name: 'Meridian',
  minScore: 1,
  minIndependentRoots: 1,
  maxAgentsPerHuman: 1,
  unbackedAgents: 'deny',
  admission: 'as-presented',
}

const EVIDENCE = new Map<string, HumanEvidence>([
  ['ens-human:0x1111111111111111111111111111111111111111', { score: 3.6, independentRoots: 4 }],
])
const HUMAN = 'ens-human:0x1111111111111111111111111111111111111111'

const backed = (address: string, label: string, presenter?: FleetAgent['presenter']): FleetAgent => ({
  agent: address as `0x${string}`,
  label,
  backing: { status: 'backed', humanId: HUMAN, binding: 'attested' },
  ...(presenter ? { presenter } : {}),
})

describe('the policy enforcing it', () => {
  test('with the gate off, an impostor is served on a stranger’s credentials', () => {
    const d = evaluateFleet({
      policy: POLICY,
      agents: [backed(agent.address, 'alpha.print.eth', { status: 'unauthenticated', detail: 'signed by a stranger' })],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'allow')
    // ... and the decision says so out loud rather than looking clean.
    assert.equal(d.summary.unauthenticatedPresenters, 1)
    assert.ok(d.caveats.some((c) => c.code === 'fleet-presenter-not-authenticated'))
  })

  test('with the gate on, the same request is refused', () => {
    const d = evaluateFleet({
      policy: { ...POLICY, requirePresenterAuthentication: true },
      agents: [backed(agent.address, 'alpha.print.eth', { status: 'unauthenticated', detail: 'signed by a stranger' })],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'deny')
    assert.ok(d.agents[0]!.because.includes('did not prove control of its wallet'))
    assert.equal(d.caveats.some((c) => c.code === 'fleet-presenter-not-authenticated'), false)
  })

  test('an impostor does not inflate the fleet of the human whose name it borrowed', () => {
    // The victim presents its own agent; an impostor presents a second name of the same human.
    // If the impostor were grouped first, the victim could be refused by the cap for an agent it
    // never ran — the gate has to happen before the grouping, not merely before the allocation.
    const d = evaluateFleet({
      policy: { ...POLICY, requirePresenterAuthentication: true },
      agents: [
        backed('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', 'impostor', {
          status: 'unauthenticated',
          detail: 'signed by a stranger',
        }),
        backed('0xbBbBBBBbbBBBbbbBbbBbbbbbBBbBbbbbBbBbbBBb', 'the real agent', {
          status: 'authenticated',
          detail: 'signed',
        }),
      ],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'deny')
    assert.equal(d.agents[1]!.verdict, 'allow')
    assert.equal(d.summary.largestFleet, 1)
    assert.equal(d.summary.deniedByCap, 0)
    assert.equal(d.humans.find((h) => h.humanId === HUMAN)!.agents.length, 1)
    assert.equal(d.caveats.some((c) => c.code === 'fleet-detected'), false)
  })

  test('a request offering no presentation at all is refused under the gate, with its own reason', () => {
    const d = evaluateFleet({
      policy: { ...POLICY, requirePresenterAuthentication: true },
      agents: [backed(agent.address, 'alpha.print.eth')],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'deny')
    assert.ok(d.agents[0]!.because.includes('carried no signed presentation'))
  })

  test('an unreadable signature check is indeterminate, not a denial', () => {
    const d = evaluateFleet({
      policy: { ...POLICY, requirePresenterAuthentication: true },
      agents: [backed(agent.address, 'alpha.print.eth', { status: 'unknown', error: 'HTTP 503' })],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'indeterminate')
    assert.equal(d.agents[0]!.rules[0]!.rule, 'presenter-authenticated')
    assert.equal(d.agents[0]!.rules[0]!.pass, null)
  })

  test('an authenticated presenter passes the gate and the trace records it', () => {
    const d = evaluateFleet({
      policy: { ...POLICY, requirePresenterAuthentication: true },
      agents: [backed(agent.address, 'alpha.print.eth', { status: 'authenticated', detail: 'signed for alpha' })],
      evidence: EVIDENCE,
    })
    assert.equal(d.agents[0]!.verdict, 'allow')
    assert.deepEqual(d.agents[0]!.rules[0], {
      rule: 'presenter-authenticated',
      pass: true,
      detail: 'signed for alpha',
    })
    assert.equal(d.summary.unauthenticatedPresenters, 0)
  })

  test('a policy that does not ask for authentication is unchanged by agents that carry none', () => {
    const d = evaluateFleet({ policy: POLICY, agents: [backed(agent.address, 'alpha')], evidence: EVIDENCE })
    assert.equal(d.agents[0]!.verdict, 'allow')
    assert.equal(d.agents[0]!.rules[0]!.rule, 'human-identified')
  })
})
