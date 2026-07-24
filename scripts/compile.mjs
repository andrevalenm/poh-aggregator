#!/usr/bin/env node
// Compile contracts/src/*.sol -> contracts/out/<Name>.json  ({abi, bytecode})
import solc from 'solc'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const SRC = 'contracts/src'
const OUT = 'contracts/out'

const sources = Object.fromEntries(
  readdirSync(SRC)
    .filter((f) => f.endsWith('.sol'))
    .map((f) => [f, { content: readFileSync(join(SRC, f), 'utf8') }]),
)

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))

const errors = (output.errors ?? []).filter((e) => e.severity === 'error')
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage)
  process.exit(1)
}
for (const w of (output.errors ?? []).filter((e) => e.severity === 'warning')) {
  console.warn('warning:', w.formattedMessage.split('\n')[0])
}

mkdirSync(OUT, { recursive: true })
let n = 0
for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, c] of Object.entries(contracts)) {
    writeFileSync(
      join(OUT, `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2),
    )
    const size = c.evm.bytecode.object.length / 2
    console.log(`compiled ${name} (${basename(file)}) — ${size} bytes`)
    n++
  }
}
if (!n) {
  console.error('no contracts produced')
  process.exit(1)
}
