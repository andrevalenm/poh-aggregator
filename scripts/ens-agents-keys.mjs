#!/usr/bin/env node
/**
 * Generate the demo agents' keypairs and append them to `.env.local`.
 *
 * The agents in the ENS tree are real wallets whose keys we hold — unlike the AgentBook
 * fixtures, which belong to strangers and therefore cannot sign. Holding the keys is what
 * makes a later challenge/response gate possible ("prove you are the address this name
 * resolves to") without re-doing the tree.
 *
 * Idempotent: a key already present in `.env.local` is left alone.
 */

import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_PATH = resolvePath(REPO_ROOT, '.env.local')
const NAMES = ['AGENT_ALPHA_PRIVATE_KEY', 'AGENT_BETA_PRIVATE_KEY', 'AGENT_UNVERIFIED_PRIVATE_KEY']

const existing = readFileSync(ENV_PATH, 'utf8')
const missing = NAMES.filter((n) => !new RegExp(`^${n}=`, 'm').test(existing))

if (missing.length === 0) {
  console.log('all agent keys already present in .env.local')
} else {
  const lines = missing.map((name) => {
    const key = generatePrivateKey()
    console.log(`${name} → ${privateKeyToAccount(key).address}`)
    return `${name}=${key}`
  })
  appendFileSync(ENV_PATH, `\n# Demo agent wallets for the ENS agent tree (Sepolia only, no funds).\n${lines.join('\n')}\n`)
  console.log(`appended ${missing.length} key(s) to .env.local`)
}

for (const name of NAMES) {
  const m = readFileSync(ENV_PATH, 'utf8').match(new RegExp(`^${name}=(0x[0-9a-fA-F]{64})$`, 'm'))
  if (m) console.log(`${name.padEnd(30)} ${privateKeyToAccount(m[1]).address}`)
}
