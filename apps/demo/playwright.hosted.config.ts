import { defineConfig } from '@playwright/test'
// Smoke config for the hosted deployment: no webServer, points at HOSTED_URL.
// Set HOSTED_URL to the deployed origin, e.g.
//   HOSTED_URL=https://example.com npx playwright test -c playwright.hosted.config.ts
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: { baseURL: process.env.HOSTED_URL },
  reporter: [['list']],
})
