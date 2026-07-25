/**
 * The counterparty, as an HTTP service.
 *
 * This is a real AgentKit resource server, stripped to the part this demo is about. The
 * x402 machinery — price, network, facilitator, settlement — is deliberately absent: money
 * is not the question here, human-backing is. What remains is the exact challenge/response
 * AgentKit defines:
 *
 *   agent  →  POST /order                                      (no credentials)
 *   server →  402 { extensions: { agentkit: { info, supportedChains, schema } } }
 *   agent  →  POST /order  with  `agentkit: <base64 signed SIWE payload>`
 *   server →  parse → validate binding+freshness+nonce → recover address → AgentBook
 *
 * `agentkit.fetch` on the agent side drives this without being told to; it detects the 402,
 * signs, and retries once.
 */

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import {
  AGENTKIT,
  buildAgentkitSchema,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
} from '@worldcoin/agentkit'
import { decide } from './decide.js'
import { counterparty } from './policy.js'
import { world } from '../config.js'

/** Nonces we have issued and not yet seen used. Replay protection lives here. */
const issuedNonces = new Set()
const spentNonces = new Set()

/**
 * The 402 challenge.
 *
 * `agentkitResourceServerExtension` builds this inside the x402 pipeline. We build it
 * directly because we have no payment pipeline for it to live in — same fields, same
 * CAIP-122 semantics.
 */
function challenge(resourceUri, domain) {
  const nonce = randomBytes(16).toString('hex')
  issuedNonces.add(nonce)
  const now = new Date()
  return {
    info: {
      domain,
      uri: resourceUri,
      statement: 'Prove a real human stands behind this agent',
      version: '1',
      nonce,
      issuedAt: now.toISOString(),
      expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString(),
    },
    // World Chain, because AgentBook lives there. AgentKit would let the agent sign on Base
    // and still resolve on World Chain; we keep it to one chain so the trace stays readable.
    supportedChains: [{ chainId: 'eip155:480', type: 'eip191', signatureScheme: 'eip191' }],
    schema: buildAgentkitSchema(),
  }
}

async function readJson(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

export async function startCounterparty({ port = 0 } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname !== '/order') return send(res, 404, { error: 'not found' })

    const body = await readJson(req)
    const resourceUri = url.href
    // AgentKit compares `domain` against the URL's *hostname* while comparing the payload's
    // `uri` against the *host*. CAIP-122 defines domain as the authority, port included, so
    // any resource server on a non-default port that follows the spec has every signature
    // rejected with "Domain mismatch". We follow AgentKit. See README, "SDK friction".
    const domain = url.hostname
    const header = req.headers[AGENTKIT]

    // No AgentKit credentials: challenge.
    if (!header) {
      return send(res, 402, {
        error: 'human-backing required',
        counterparty: counterparty.name,
        extensions: { [AGENTKIT]: challenge(resourceUri, domain) },
      })
    }

    // ------------------------------------------------ gate 1, for real, over the wire
    let identity
    try {
      const payload = parseAgentkitHeader(header)

      const validation = await validateAgentkitMessage(payload, resourceUri, {
        maxAge: 5 * 60_000,
        // Returns true when the nonce is ACCEPTABLE. Note this is the opposite polarity to
        // AgentKitStorage.hasUsedNonce, which returns true when the nonce has been seen.
        // Getting it backwards rejects every honest request as a replay.
        checkNonce: (nonce) => !spentNonces.has(nonce),
      })
      if (!validation.valid) {
        identity = { error: `message validation failed: ${validation.error}` }
      } else if (!issuedNonces.has(payload.nonce)) {
        identity = { error: 'nonce was not issued by this counterparty' }
      } else {
        const verification = await verifyAgentkitSignature(payload, world.worldChainRpc)
        if (!verification.valid || !verification.address) {
          identity = { error: verification.error ?? 'signature did not verify' }
        } else if (verification.address.toLowerCase() !== payload.address.toLowerCase()) {
          identity = { error: 'recovered signer does not match the claimed address' }
        } else {
          spentNonces.add(payload.nonce)
          identity = {
            verified: true,
            address: verification.address,
            chainId: payload.chainId,
            type: payload.type,
            uri: payload.uri,
            issuedAt: payload.issuedAt,
            nonce: payload.nonce,
            statement: payload.statement,
          }
        }
      }

      const trace = await decide({
        agentName: body.agentName ?? 'unnamed agent',
        agentAddress: (identity.address ?? payload.address),
        operatorAddresses: body.operatorAddresses ?? [],
        identity,
      })
      return send(res, trace.decision.allow ? 200 : 403, { trace })
    } catch (e) {
      return send(res, 400, {
        trace: {
          counterparty: counterparty.name,
          gates: [
            {
              n: 1,
              name: 'Agent identity',
              question: 'Does the requester control the wallet it claims?',
              pass: false,
              how: 'parseAgentkitHeader',
              detail: { error: e instanceof Error ? e.message : String(e) },
            },
          ],
          decision: { allow: false, because: 'malformed agentkit header' },
          caveats: [],
        },
      })
    }
  })

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
  const { port: actual } = server.address()
  return {
    url: `http://127.0.0.1:${actual}/order`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
