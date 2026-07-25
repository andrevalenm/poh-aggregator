/**
 * World ID 4.0 — the interactive leg.
 *
 * AgentBook (see agentbook.js) answers "did a World ID human register this agent?" from
 * chain state alone. This module answers the complementary question: "is a World ID human
 * present *right now*, willing to sign for this specific request?"
 *
 * That distinction matters for an agent. AgentBook proves a registration happened once;
 * a live 4.0 proof, bound to a signal, proves a human took an action at a point in time.
 * A counterparty transacting on value should want the second, and it is the only one of the
 * two that materially narrows the control gap.
 *
 * Flow, exactly as documented at docs.world.org/world-id/idkit/integrate:
 *
 *   1. Backend signs an RP context with the relying party's signing key   [signRequest]
 *   2. Backend opens a request and gets a connector URI                   [IDKit.request]
 *   3. Human scans it — World App in production, the Simulator in staging
 *   4. Backend polls until the proof arrives                              [pollUntilCompletion]
 *   5. Backend POSTs the proof to /api/v4/verify/{rp_id}
 *
 * Steps 1, 2, 4 and 5 all run here for real. Step 3 needs a person.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { world, rpSigningKey } from '../config.js'

/**
 * IDKit 4.x ships its proof-request logic as WASM and loads it with
 * `fetch(new URL('idkit_wasm_bg.wasm', import.meta.url))`. In a browser that is an HTTP
 * URL; under Node it is a `file:` URL, and Node's fetch refuses `file:`. The module is
 * therefore unusable server-side out of the box — it throws
 * `Failed to initialize IDKit WASM: TypeError: fetch failed`.
 *
 * The bytes are present in the package, so we teach fetch to read them. This is a shim
 * around an upstream packaging bug, not a workaround for a protocol issue.
 */
let shimmed = false
function shimFileFetch() {
  if (shimmed) return
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input))
    if (url.startsWith('file:')) {
      const bytes = await readFile(fileURLToPath(url))
      return new Response(bytes, { status: 200, headers: { 'content-type': 'application/wasm' } })
    }
    return realFetch(input, init)
  }
  shimmed = true
}

/**
 * Open a World ID 4.0 proof request and return the connector URI for a human to scan.
 *
 * @param {Object} opts
 * @param {string} opts.signal  Bound into the proof. We bind the agent's wallet address, so
 *                              the proof attests to backing *this* agent and cannot be
 *                              replayed to vouch for another.
 * @returns {Promise<{connectorURI: string, requestId: string, waitForProof: (ms?: number) => Promise<any>, environment: string}>}
 */
export async function openProofRequest({ signal }) {
  if (!world.appId || !world.rpId) throw new Error('WORLD_APP_ID and WORLD_RP_ID must be set')
  const key = rpSigningKey()
  if (!key) throw new Error('WORLD_SIGNER_PRIVATE_KEY must be set to sign the RP context')

  shimFileFetch()
  const { signRequest } = await import('@worldcoin/idkit-core/signing')
  const { IDKit, proofOfHuman } = await import('@worldcoin/idkit-core')

  // The RP signature proves to World App that this request really came from our relying
  // party. Signed here, in-process, never on a client.
  const rp = signRequest({ signingKeyHex: key, action: world.action })

  const request = await IDKit.request({
    app_id: world.appId,
    action: world.action,
    rp_context: {
      rp_id: world.rpId,
      nonce: rp.nonce,
      created_at: rp.createdAt,
      expires_at: rp.expiresAt,
      signature: rp.sig,
    },
    // Accept 3.0 proofs too. Most Orb-verified humans alive today still hold one, and
    // refusing them would be a migration decision dressed up as a security decision.
    allow_legacy_proofs: true,
    environment: world.environment,
  }).preset(proofOfHuman({ signal }))

  return {
    connectorURI: request.connectorURI,
    requestId: request.requestId,
    environment: world.environment,
    waitForProof: (timeout = 300_000) => request.pollUntilCompletion({ timeout, pollInterval: 1500 }),
  }
}

/**
 * Verify a completed IDKit response against the Developer Portal.
 *
 * The IDKit 4.x response is passed through unmodified — 4.0 removed the old requirement to
 * reshape the payload or compute `signal_hash` yourself.
 *
 * @param {any} idkitResult  `completion.result` from `waitForProof()`
 * @returns {Promise<{ok: boolean, status: number, body: any, request: any}>}
 */
export async function verifyProof(idkitResult) {
  const url = `${world.verifyHost}/api/v4/verify/${world.rpId}`

  // The endpoint takes no credentials: the RP is named in the path and the proof carries its
  // own authenticity. Confirmed live — see README, "What we learned about the verify API".
  const body = { ...idkitResult, environment: world.environment }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const parsed = await res.json().catch(() => ({ parseError: true }))
  return { ok: res.ok && parsed.success === true, status: res.status, body: parsed, request: { url, body } }
}

/**
 * Where the human goes to answer.
 * @returns {string}
 */
export function proverHint() {
  return world.environment === 'staging'
    ? 'Open https://simulator.worldcoin.org and paste the URI above (World ID Simulator).'
    : 'Scan the QR above with World App.'
}
