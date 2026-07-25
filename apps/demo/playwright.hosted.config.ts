import { defineConfig } from '@playwright/test'
// Smoke config for the hosted deployment: no webServer, points at ax41.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: { baseURL: process.env.HOSTED_URL ?? 'http://37.27.67.44:8788' },
  reporter: [['list']],
})
