#!/usr/bin/env node
/**
 * Commit the working tree through `git fast-import`, so the new objects land in a **pack**
 * instead of as loose objects.
 *
 * Why this exists: on ax41 another process runs git in this repo as root, and the loose-object
 * directories it happens to create (`.git/objects/f5`, `.git/objects/fe` on 2026-07-25) end up
 * owned by root and mode 755. Any object whose SHA-1 starts with one of those two bytes then
 * fails to write — `insufficient permission for adding an object to repository database` — and
 * neither the file nor the directory can be removed without root, because deleting an entry
 * needs write permission on its parent. It is a 2-in-256 lottery per object, which is why most
 * commits succeed and some cannot.
 *
 * `.git/objects/pack` is writable, and fast-import writes there, so this routes around the
 * problem without touching anything root owns and without a single byte of the repository being
 * rewritten. It is a workaround for a broken environment, not a replacement for `git commit`:
 * use plain git whenever plain git works. See MORNING.md, "Needs you".
 *
 *   node scripts/commit-via-fast-import.mjs <message-file>
 *
 * Commits every change `git status --porcelain` reports, on the current branch, with the repo's
 * configured identity. Symlinks and submodules are refused rather than mishandled.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, lstatSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

const messageFile = process.argv[2]
if (!messageFile) {
  console.error('usage: commit-via-fast-import.mjs <message-file>')
  process.exit(2)
}
const message = readFileSync(messageFile)

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const parent = git('rev-parse', 'HEAD')
const name = git('config', 'user.name')
const email = git('config', 'user.email')
const when = `${Math.floor(Date.now() / 1000)} ${(() => {
  const off = -new Date().getTimezoneOffset()
  const sign = off < 0 ? '-' : '+'
  const a = Math.abs(off)
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}${String(a % 60).padStart(2, '0')}`
})()}`

// -z gives NUL-terminated records, so a path with a space or a quote cannot be misread.
const raw = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
  encoding: 'utf8',
  maxBuffer: 1 << 28,
})
const records = raw.split('\0').filter((r) => r.length > 0)

const changes = []
for (let i = 0; i < records.length; i++) {
  const status = records[i].slice(0, 2)
  const path = records[i].slice(3)
  if (status[0] === 'R' || status[0] === 'C') {
    // A rename record is followed by its source path; both ends are handled explicitly.
    const from = records[++i]
    changes.push({ op: 'delete', path: from })
    changes.push({ op: 'write', path })
    continue
  }
  if (status.includes('D')) changes.push({ op: 'delete', path })
  else changes.push({ op: 'write', path })
}
if (changes.length === 0) {
  console.error('nothing to commit')
  process.exit(1)
}

const chunks = []
const push = (s) => chunks.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'))

let mark = 0
const writes = []
for (const c of changes.filter((c) => c.op === 'write')) {
  const st = lstatSync(c.path, { throwIfNoEntry: false })
  if (!st) throw new Error(`${c.path}: disappeared while committing`)
  if (st.isSymbolicLink() || st.isDirectory()) throw new Error(`${c.path}: not a regular file`)
  const data = readFileSync(c.path)
  const mode = st.mode & 0o111 ? '100755' : '100644'
  mark++
  push(`blob\nmark :${mark}\ndata ${data.length}\n`)
  push(data)
  push('\n')
  writes.push({ path: c.path, mark, mode })
}

push(`commit refs/heads/${branch}\n`)
push(`author ${name} <${email}> ${when}\n`)
push(`committer ${name} <${email}> ${when}\n`)
push(`data ${message.length}\n`)
push(message)
push(`\nfrom ${parent}\n`)
for (const c of changes.filter((c) => c.op === 'delete')) push(`D ${c.path}\n`)
for (const w of writes) push(`M ${w.mode} :${w.mark} ${w.path}\n`)
push('\ndone\n')

const r = spawnSync('git', ['fast-import', '--done', '--quiet'], {
  input: Buffer.concat(chunks),
  stdio: ['pipe', 'inherit', 'inherit'],
})
if (r.status !== 0) process.exit(r.status ?? 1)

// fast-import moves the ref and leaves the index holding the old tree, so refresh it against
// the new HEAD without touching a single file in the working tree.
execFileSync('git', ['reset', '--mixed'], { stdio: 'inherit' })
console.log(git('log', '--oneline', '-1'))
