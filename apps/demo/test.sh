#!/usr/bin/env bash
# Run the full Print test sweep: contracts, SDK (unit + live chains), browser E2E.
# Live suites hit real RPCs and take a few minutes; nothing is mocked, deliberately.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.foundry/bin:$PATH"

echo "── contracts (forge) ──────────────────────────"
forge test

echo "── sdk unit ───────────────────────────────────"
(cd packages/sdk && node --test --experimental-strip-types "src/scoring.test.ts")

echo "── sdk live (real chains) ─────────────────────"
(cd packages/sdk && node --test --experimental-strip-types "src/live.test.ts")

echo "── demo E2E (real browser, real chains) ───────"
(cd apps/demo && npx playwright test)

echo "all suites green"
