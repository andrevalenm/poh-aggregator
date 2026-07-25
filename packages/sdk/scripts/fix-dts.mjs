// tsc's rewriteRelativeImportExtensions rewrites .ts -> .js in emitted JS but leaves
// declaration re-exports pointing at '.ts', which breaks type resolution for any consumer
// of the built package. Rewrite them here until tsc does it natively.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.d.ts')) {
      const s = readFileSync(p, 'utf8')
      const out = s.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1$2.js$3')
      if (out !== s) writeFileSync(p, out)
    }
  }
}
walk('dist')
console.log('dist declarations rewritten to .js specifiers')
