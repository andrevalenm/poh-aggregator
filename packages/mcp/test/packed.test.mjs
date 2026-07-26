/**
 * Tests the artifact users install, not the workspace they don't have.
 *
 * @printid/mcp 0.1.0 passed every test that ran against `packages/mcp/dist` and was still
 * broken on npm: `dist/server.js` read the ontology from '../../../ontology/adapters.json',
 * which is the repo root from inside the monorepo and `node_modules/ontology` from inside an
 * install. The read failed, a silent catch left the adapter-id preimage lists empty, and every
 * lookup came back score 0 with "no credentials found" — the answer that favours the adversary,
 * for a real Proof of Humanity member. Nothing in the workspace could see it, because in the
 * workspace the path resolves.
 *
 * So this suite packs the tarballs, installs them into a clean directory outside the repo, and
 * asks the installed server. The structural checks run everywhere and are what actually catch
 * the regression; LIVE=1 adds the end-to-end proof against public chains.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MCP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(MCP_DIR, '..', '..')
const SDK_DIR = join(REPO_ROOT, 'packages', 'sdk')
const LIVE = process.env.LIVE === '1'

// A real Proof of Humanity v2 registrant on Gnosis. The whole point of the address is that a
// correct install must find something for it: it is the case 0.1.0 got wrong.
const POH_MEMBER = '0xd267eba602e692216703626a81157214b24c85fb'

let work
let installDir
let mcpTarball

const npm = (args, cwd) =>
  execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

before(() => {
  work = mkdtempSync(join(tmpdir(), 'printid-packed-'))
  installDir = join(work, 'install')
  const tarballs = join(work, 'tarballs')
  mkdirSync(tarballs, { recursive: true })

  // Build first: the tarball only contains what the build put in dist/.
  npm(['run', 'build'], SDK_DIR)
  npm(['run', 'build'], MCP_DIR)

  const sdkTarball = join(tarballs, npm(['pack', '--pack-destination', tarballs], SDK_DIR))
  const rawMcp = join(tarballs, npm(['pack', '--pack-destination', tarballs], MCP_DIR))

  // `npm pack` leaves the `workspace:` dependency protocol verbatim and npm cannot install
  // it, so rewrite it to the concrete version the way a pnpm publish does — the published
  // 0.1.0 tarball carries "@printid/sdk": "^0.1.0", not "workspace:^0.1.0". Doing it here
  // keeps the test on npm alone while still installing what a release would.
  const sdkVersion = JSON.parse(readFileSync(join(SDK_DIR, 'package.json'), 'utf8')).version
  const staged = join(work, 'staged')
  execFileSync('tar', ['xzf', rawMcp, '-C', work])
  renameSync(join(work, 'package'), staged)
  const stagedPkgPath = join(staged, 'package.json')
  const stagedPkg = JSON.parse(readFileSync(stagedPkgPath, 'utf8'))
  for (const [name, spec] of Object.entries(stagedPkg.dependencies ?? {})) {
    if (typeof spec === 'string' && spec.startsWith('workspace:')) {
      stagedPkg.dependencies[name] = spec.slice('workspace:'.length).replace(/^\*$/, sdkVersion)
    }
  }
  writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2))
  mcpTarball = join(tarballs, npm(['pack', '--pack-destination', tarballs], staged))

  mkdirSync(installDir, { recursive: true })
  npm(['init', '-y'], installDir)
  // No registry resolution for @printid/*: both come from the tarballs under test.
  npm(['install', '--no-audit', '--no-fund', sdkTarball, mcpTarball], installDir)
})

after(() => {
  if (work) rmSync(work, { recursive: true, force: true })
})

const installedMcp = () => join(installDir, 'node_modules', '@printid', 'mcp')

describe('packed artifact', () => {
  test('the mcp tarball carries its own copy of the ontology', () => {
    const entries = execFileSync('tar', ['tzf', mcpTarball], { encoding: 'utf8' }).split('\n')
    assert.ok(
      entries.includes('package/dist/ontology-data.json'),
      `ontology missing from the tarball; it contains only:\n${entries.join('\n')}`,
    )
  })

  test('the shipped copy is identical to the source of truth', () => {
    // If someone edits ontology/adapters.json and ships without rebuilding, the installed
    // server reverses hashes with a stale preimage list while the registry has moved on.
    const source = readFileSync(join(REPO_ROOT, 'ontology', 'adapters.json'), 'utf8')
    const shipped = readFileSync(join(installedMcp(), 'dist', 'ontology-data.json'), 'utf8')
    assert.equal(shipped, source, 'run `npm run build` in packages/mcp to resync ontology-data.json')
  })

  test('the installed server reads nothing from outside its own package', () => {
    // The exact shape of the 0.1.0 bug: any relative path that climbs above the package root
    // resolves somewhere else once installed, and there is nothing above node_modules/@printid/mcp
    // that we are entitled to read.
    const js = readFileSync(join(installedMcp(), 'dist', 'server.js'), 'utf8')
    const escapes = [...js.matchAll(/['"](\.\.\/)+[^'"]*['"]/g)].map((m) => m[0])
    assert.deepEqual(escapes, [], `server.js escapes its package: ${escapes.join(', ')}`)
  })

  test('the ontology loads in the installed tree with a non-empty preimage list', () => {
    // Empty lists are what turned a failed read into score 0. Assert the counts the server
    // actually derives, in the installed layout, rather than trusting the file's presence.
    const probe = `
      import o from '${join(installedMcp(), 'dist', 'ontology-data.json')}' with { type: 'json' }
      const roots = [...Object.keys(o.trustRoots), ...Object.keys(o.retiredTrustRoots ?? {})]
      console.log(JSON.stringify({ ids: o.adapters.length, roots: roots.length }))
    `
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: installDir,
      encoding: 'utf8',
    })
    const { ids, roots } = JSON.parse(out)
    assert.ok(ids > 0, 'no adapter ids to reverse hashes into')
    assert.ok(roots > 0, 'no trust-root names to reverse hashes into')
  })

  test('the installed server speaks MCP and lists its tools', async () => {
    const { rpc, notify, kill } = startInstalledServer()
    try {
      const init = await rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'packed-test', version: '0' },
      })
      assert.equal(init.result.serverInfo.name, 'print')
      notify('notifications/initialized')
      const tools = await rpc('tools/list', {})
      const names = tools.result.tools.map((t) => t.name)
      for (const expected of [
        'lookup_personhood',
        'check_personhood',
        'explain_trust_roots',
        'explain_weight_history',
      ]) {
        assert.ok(names.includes(expected), `missing tool: ${expected}`)
      }
    } finally {
      kill()
    }
  })

  test(
    'lookup_personhood leads on independent trust roots, not on the score',
    { skip: !LIVE && 'set LIVE=1 to read public chains' },
    async () => {
      // Ordering is a correctness property here: costs saturate within a trust root and sum
      // across them, so on the deployed ontology four credentials off one passport chip score
      // 3.30 with 1 root while four credentials off four roots score 2.85 with 4. An agent
      // reading the first number it sees would rank the farm above the person.
      const { rpc, notify, kill } = startInstalledServer()
      try {
        await rpc('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'packed-test', version: '0' },
        })
        notify('notifications/initialized')
        const call = await rpc('tools/call', {
          name: 'lookup_personhood',
          arguments: { subject: '0x0000000000000000000000000000000000000001' },
        })
        assert.ok(!call.result.isError, call.result.content?.[0]?.text)
        const text = call.result.content[0].text
        const rootsAt = text.indexOf('independent trust roots:')
        const scoreAt = text.indexOf('score:')
        assert.ok(rootsAt >= 0, 'no independent-trust-root count in the output')
        assert.ok(scoreAt >= 0, 'the score was dropped; it is real data and stays')
        assert.ok(rootsAt < scoreAt, 'the score precedes the root count — that ordering misleads')
        // The caveats that can never be earned away.
        assert.match(text, /independent-control-not-attested/)
        assert.match(text, /no-evidence/)
      } finally {
        kill()
      }
    },
  )

  test(
    'the installed server finds a real PoH member instead of returning zero',
    { skip: !LIVE && 'set LIVE=1 to read public chains' },
    async () => {
      const { rpc, notify, kill } = startInstalledServer()
      try {
        await rpc('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'packed-test', version: '0' },
        })
        notify('notifications/initialized')
        const call = await rpc('tools/call', {
          name: 'lookup_personhood',
          arguments: { subject: POH_MEMBER },
        })
        assert.ok(!call.result.isError, call.result.content?.[0]?.text)
        const text = call.result.content[0].text
        console.log(text)
        assert.match(text, /Proof of Humanity/, 'the PoH credential was not reported')
        assert.match(text, /root=social-vouching:poh/, 'the trust root printed as a raw hash')
        assert.doesNotMatch(text, /^score: 0\.00/m, 'scored zero for a registered human')
        assert.doesNotMatch(text, /credentials: none found/, 'found nothing for a registered human')
        const roots = Number(/independent trust roots: (\d+)/.exec(text)?.[1])
        assert.ok(roots >= 1, `expected at least one independent root, got ${roots}`)
      } finally {
        kill()
      }
    },
  )

  test(
    'the installed sdk treats an empty preimage list as unset, not as "reverse nothing"',
    { skip: !LIVE && 'set LIVE=1 to read public chains' },
    async () => {
      // The second half of the 0.1.0 failure. `opts.knownIds ?? bundled` does not fall back on
      // [], so a caller whose own ontology read failed got hashes and a zero score. Both calls
      // must now agree.
      const probe = `
        import { Print } from '@printid/sdk'
        const subject = '${POH_MEMBER}'
        const empty = await new Print({ knownIds: [], knownRoots: [] }).resolve(subject)
        const bundled = await new Print({}).resolve(subject)
        console.log(JSON.stringify({
          empty: { score: empty.score, roots: empty.independentRoots },
          bundled: { score: bundled.score, roots: bundled.independentRoots },
        }))
      `
      const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
        cwd: installDir,
        encoding: 'utf8',
        timeout: 180_000,
      })
      const { empty, bundled } = JSON.parse(out)
      console.log('knownIds: []  ->', JSON.stringify(empty))
      console.log('knownIds unset ->', JSON.stringify(bundled))
      assert.ok(bundled.score > 0, `bundled defaults scored ${bundled.score} for a PoH member`)
      assert.deepEqual(empty, bundled, 'an empty preimage list still degrades the answer')
    },
  )
})

/** Spawn the installed server over real stdio and speak JSON-RPC line protocol at it. */
function startInstalledServer() {
  const entry = join(installedMcp(), 'dist', 'server.js')
  assert.ok(existsSync(entry), `installed server missing at ${entry}`)
  const env = { ...process.env }
  if (LIVE && !env.PRINT_SUBGRAPH_URL) {
    env.PRINT_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/77602/poh/version/latest'
  }
  const child = spawn(process.execPath, [entry], {
    cwd: installDir,
    stdio: ['pipe', 'pipe', 'inherit'],
    env,
  })
  const pending = new Map()
  let nextId = 1
  let buf = ''
  child.stdout.on('data', (d) => {
    buf += d.toString()
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      const msg = JSON.parse(line)
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    }
  })
  return {
    rpc(method, params, timeoutMs = 180_000) {
      const id = nextId++
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      return new Promise((resolve, reject) => {
        pending.set(id, resolve)
        setTimeout(() => reject(new Error(`rpc timeout: ${method}`)), timeoutMs).unref()
      })
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
    },
    kill: () => child.kill(),
  }
}
