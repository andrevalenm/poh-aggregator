/**
 * Configuration.
 *
 * Everything that differs between the hackathon demo and a production deployment lives
 * here, so "swap staging for production" is a one-line change and not a code change.
 *
 * Secrets are read from the repo-root `.env.local` at runtime and never logged. The only
 * secret this app can touch is the RP signing key, and it is used exclusively inside
 * `signRequest()` in `world/worldid.js`.
 */

import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '../../..')

loadEnv({ path: resolve(REPO_ROOT, '.env.local'), quiet: true })

/**
 * World ID environment.
 *
 * `staging` routes proof requests to the World ID Simulator (simulator.worldcoin.org) so the
 * flow can be exercised without an Orb-verified World App. `production` routes them to real
 * World App. Nothing else in the codebase branches on this.
 */
export const WORLD_ENV = process.env.WORLD_ENV === 'production' ? 'production' : 'staging'

export const world = {
  environment: WORLD_ENV,
  appId: process.env.WORLD_APP_ID,
  rpId: process.env.WORLD_RP_ID,
  /** The action registered in the Developer Portal for this RP. */
  action: process.env.WORLD_ACTION ?? 'verify-personhood',

  /**
   * Verification host.
   *
   * Both environments verify against `developer.world.org`; the environment is carried in
   * the request *body*, not the hostname. `staging-developer.worldcoin.org` rejects this RP
   * with `app_not_migrated` — see README, "What we learned about the verify API".
   */
  verifyHost: process.env.WORLD_VERIFY_HOST ?? 'https://developer.world.org',

  /**
   * AgentBook is deployed once, on World Chain mainnet, and AgentKit resolves against it
   * regardless of which chain the agent signed on. There is no staging AgentBook.
   */
  agentBookAddress: '0xA23aB2712eA7BBa896930544C7d6636a96b944dA',
  worldChainRpc: process.env.WORLDCHAIN_RPC_URL ?? 'https://worldchain-mainnet.g.alchemy.com/public',
}

/** Present only if the operator wants to run the interactive World ID proof leg. */
export const hasRpSigningKey = Boolean(process.env.WORLD_SIGNER_PRIVATE_KEY)

/** Read lazily and never returned to a caller that might print it. */
export const rpSigningKey = () => process.env.WORLD_SIGNER_PRIVATE_KEY

export const corroborate = {
  /**
   * Sepolia registry holding the trust-root ontology and its weights.
   *
   * Left undefined so the SDK's own `DEFAULT_REGISTRY` wins. Pinning the address here once
   * cost an hour when the registry was redeployed underneath us; the package that ships the
   * ABI should own the address that ABI matches.
   */
  registryAddress: process.env.REGISTRY_ADDRESS,
  registryRpcUrl: process.env.SEPOLIA_RPC_URL,
  subgraphUrl: process.env.SUBGRAPH_URL,
}

/**
 * A locally-generated agent key, when the judge wants to run the signed request path with a
 * wallet they have registered themselves via `npx @worldcoin/agentkit-cli register`.
 */
export const agentPrivateKey = process.env.AGENT_PRIVATE_KEY
