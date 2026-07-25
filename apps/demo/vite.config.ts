import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * The SDK is declared as a `file:` workspace dependency in package.json, but resolved here
 * to its TypeScript *source* rather than `dist/`.
 *
 * Two reasons, both practical:
 *  1. The SDK is edited concurrently during the build; aliasing to source means the demo can
 *     never render a score computed by a stale `dist/`.
 *  2. `dist/*.d.ts` currently re-exports with `.ts` specifiers (a side effect of
 *     `rewriteRelativeImportExtensions`, which rewrites value imports but not declaration
 *     re-exports), so type resolution through the package entrypoint fails.
 *
 * Drop the alias once dist emits `.js` specifiers in its declarations.
 */
const sdkSrc = fileURLToPath(new URL('../../packages/sdk/src/index.ts', import.meta.url))
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@corroborate/sdk': sdkSrc },
  },
  // The ontology JSON lives at the repo root and is imported at build time.
  server: { fs: { allow: [repoRoot] } },
  build: { target: 'es2022' },
})
