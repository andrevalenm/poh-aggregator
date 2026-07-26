# Wallet forensics — cost signals, never personhood

**One-liner:** Wallet age, activity, balances and flow measure what an address has *spent and
survived* — effort and capital, not humanity. They are shipped as their own signal class with a
permanent caveat, structurally separate from the personhood score, because folding them in would
let capital impersonate humanity — the exact substitution a funded sybil farm is optimised for.
**Category:** cost/effort signals (adjacent to behavioral P2 in `behavioral-scorers.md` §0, but
deliberately outside the evidence-class taxonomy — no trust root, no `Evidence`, no path into
`score()`)
**Chains:** Ethereum, Gnosis, Base (RPC + public Blockscout, keyless; see
`packages/sdk/src/signals/wallet.ts`)
**Status (2026-07):** implemented as `walletSignals()`; endpoints verified live 2026-07-25
**Aggregator verdict:** **Ship as a disclosed, separate result block; never mix into the score.**
The permanent caveat `wallet-forensics-are-not-personhood` is on every result and is not
suppressible.

---

## 1. What each metric can and cannot indicate

| Metric | Source | Can indicate | Cannot indicate | Gaming cost |
|---|---|---|---|---|
| **Wallet age** (`firstSeen`, `approxAgeDays`) | Blockscout first external tx | The address existed and was touched at time T. Age is the one metric that **cannot be rushed**: a two-year-old wallet took two years to make, and that is its only virtue. | Continuous use, single ownership, humanity. Aged wallets are a **commodity** — bought on secondary markets, or pre-farmed in bulk: an operator who funded 10,000 addresses in 2023 owns 10,000 "three-year-old wallets" today at the cost of dust plus patience. | Cannot be manufactured retroactively; can be **bought** (aged-wallet markets) or **pre-farmed** (dust 10k addresses now, harvest age later). Cost ≈ gas dust per address, amortised to near zero. |
| **Outgoing tx count** (`txCountOut`, nonce) | RPC `eth_getTransactionCount` | Gas was spent N times from this key — a real, unforgeable expenditure floor. | Who spent it or why. A relayer loop inflates nonce mechanically; the busiest nonces on mainnet belong to exchange hot wallets and MEV bots (our own live test discovers its subject this way — the "busiest sender in the latest block" is reliably a bot or an exchange). | Linear in gas: nonce N costs N × ~21k gas minimum. On an L2 that is fractions of a cent per tx — hundreds of txs per dollar. |
| **Native balance** (`nativeBalanceWei`) | RPC `eth_getBalance` | Capital is parked here *right now*. | That the capital stays, or belongs to one person, or belongs to a person at all. Balance is **rentable capital**: flash-loanable within a block, borrowable for the duration of any check, and one treasury can rotate through a thousand wallets ahead of a snapshot. | Near zero for point-in-time checks (flash loans, rotation); interest rate on the check window otherwise. The signal decays to worthless the instant an adversary knows when you look. |
| **Total received / flow** (`totalReceivedWei`, `totalTxCount`, `tokenTransferCount`) | Blockscout | Value moved through, and how often. High flow ⇒ the address participates in some economy. | Whose economy. Flow is self-dealable: A→B→C→A produces arbitrary "flow" at the cost of gas, and wash traffic between an operator's own wallets is indistinguishable from commerce without graph analysis we do not do here. | Gas on the round trips. Stablecoin wash loops on an L2 generate thousands of dollars of nominal flow per dollar of cost. |
| **Stable balances** (`erc20.usdc`) | RPC `eth_call balanceOf` | Same as native balance, denominated stably. | Same failures — rentable, rotatable, flash-loanable. | Same as native balance. |

The pattern: **age prices patience, everything else prices money — and money is rentable.** This
is the same rent-beats-forge logic that drives `effectiveCost()` in `scoring.ts`, applied to a
class where *everything except age* is pure rent.

## 2. Why this must never fold into the personhood score

1. **The correlation runs the wrong way.** The richest, oldest, busiest addresses on every chain
   are bots: exchange hot wallets, MEV searchers, relayers. Our live suite proves this by
   construction — it picks the busiest sender in the latest mainnet block and reliably lands on
   an exchange wallet with a seven-to-eight-digit nonce. Any weight on these metrics inside a
   personhood score *raises* the score of the least human actors on chain.
2. **The converse harms real people.** A fresh, empty wallet is what a new human looks like —
   privacy-conscious users rotate addresses precisely to avoid linkage. Discounting freshness
   inside a personhood score punishes exactly the behaviour the rest of this SDK exists to
   protect (see the multi-address reasoning in `types.ts`).
3. **It creates a purchase path into the score.** The score's unit is *adversary cost across
   independent trust roots*. Wallet metrics have no trust root and their marginal cost is gas.
   Folding them in would let an adversary buy score with capital — cheaper than forging any
   credential in the ontology, and at base-rate arithmetic (`behavioral-scorers.md` §6) that is
   the whole ballgame.
4. **Base rates.** At a plausible 2% sybil rate, a classifier that leans on wallet wealth is
   wrong about most of the people it flags *and* most of the bots it passes. A signal that is
   simultaneously forgeable-by-the-rich and failing-for-the-new has no operating point that
   helps a personhood decision.

Hence the mechanical separation in the SDK: `walletSignals()` returns its own result type with
its own permanent caveat; nothing it produces is an `Evidence`, has a `trustRoot`, or can reach
`score()`. The caveat text, verbatim (`WALLET_FORENSICS_CAVEAT` in
`packages/sdk/src/signals/wallet.ts`):

> **`wallet-forensics-are-not-personhood`** — "Wallet age, activity, balances and flow price
> effort, not humanity. A rich, old, busy wallet can be one bot among thousands run by a single
> operator, and a brand-new empty wallet can be a real person arriving for the first time. These
> signals measure what an address has spent and survived; they say nothing about whether a human
> is behind it, and they must never be folded into a personhood score."

## 3. How a consumer might legitimately combine them

Their policy, their threshold — never ours. The legitimate pattern is **conjunction with
personhood, decided by the caller**, in the same spirit as `isHuman(threshold)` refusing to ship
a default:

- **Cost floor for abuse pricing, not identity.** "Reject if `approxAgeDays < 7` *and*
  `totalTxOut == 0`" is a defensible *rate-limiting* policy: it prices retries for an attacker
  who must now pre-age wallets. It says nothing about humanity and should never be described as
  a humanity check. Age is the right metric for this because it is the only one that cannot be
  rushed — an attacker can pay every other cost on demand, but a seven-day wait is seven days.
- **Two independent axes, two independent thresholds.** A faucet might require
  `personhood.isHuman(callerThreshold)` **and** `wallet.summary.anyActivity == false` (serve the
  new); an airdrop might require personhood **and** age (raise pre-farm cost). The axes stay
  separate all the way to the caller's own policy — the SDK never blends them into one number,
  because a blended number is exactly the laundering §2 forbids.
- **Snapshot discipline for anything balance-shaped.** Balance and flow are only meaningful
  against retroactive, unannounced observation windows (rentable capital, §1). A consumer who
  must use them should sample the past, not the present, and still treat them as effort pricing.
- **Read the errors.** Every field is optional and per-source attributed; `anyActivity: false`
  with `errors` populated means *the sources were down*, not *the wallet is fresh*. The
  degraded-read philosophy is the same as `reconcile.ts`: noise over silence, and absence of
  evidence is never evidence of absence.

What a consumer may **not** legitimately do — and what the caveat exists to make impossible to
miss — is add any of these numbers to a personhood score, theirs or ours.

## 4. Operational notes (measured 2026-07-25)

- RPC (`eth_getTransactionCount`, `eth_getBalance`, `eth_call balanceOf`) is the source of
  record; keyless fallback lists per chain in `WALLET_RPCS`, endpoint discipline inherited from
  `adapters/poh-v1.ts`.
- Blockscout (`eth.` / `gnosis.` / `base.blockscout.com`) supplies first-seen and totals via
  `/api/v2/addresses/{addr}/counters`, the v1 `txlist&sort=asc` endpoint, and
  `/api/v2/addresses/{addr}/transactions?filter=to` (summed only when the incoming history is
  complete in one page — a partial sum would understate flow while looking like a measurement).
  Blockscout **lags and lies by omission**: the same instance served a complete 29.7M-tx history
  for one address and an empty page for another on the same day. It is enrichment, never the
  decider; when it is down, the RPC fields still return, and nothing throws.
- `firstSeen` covers external transactions only, so an address first funded by an internal
  transfer looks younger than it is. The error direction is safe: age can be understated, never
  overstated.
