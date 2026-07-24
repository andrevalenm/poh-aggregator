# Demand and Regulation — who pays for personhood, and what law forces it

> STATUS: in progress (started 2026-07-24)

**One-liner:** …
**Category:** landscape / commercial
**Status (2026-07):** …
**Verdict:** …

## 1. Regulatory forcing functions
### 1.1 Age assurance (the big one)
### 1.2 EU AI Act — synthetic content & bot disclosure
### 1.3 DSA — VLOP obligations on inauthentic behaviour
### 1.4 US and other bot-disclosure laws
### 1.5 MiCA / travel rule / crypto AML — and why personhood ≠ KYC

## 2. Where money is actually spent today
### 2.1 Airdrop sybil filtering
### 2.2 Quadratic funding / public goods
### 2.3 Bot mitigation & CAPTCHA (incumbent spend)
### 2.4 Fraud / AML tooling (adjacent market)

## 3. The AI-agent demand shift
### 3.1 Agent payments (x402 and friends)
### 3.2 Cloudflare Web Bot Auth / pay-per-crawl
### 3.3 Identity vendors' agent products
### 3.4 Reddit human verification — **PARTIALLY REFUTED** (important)

**Verdict: the "Reddit will mandate human verification" story is real but materially overstated,
and the way Reddit actually implemented it is bad news for our category.**

Confirmed from Reddit's own IR materials (primary source): Reddit Q1'26 earnings call transcript,
2026-04-30, hosted on Reddit's investor CDN
(https://s203.q4cdn.com/380862485/files/doc_financials/2026/q1/Reddit-Q1-26-Earnings-Call-Transcript.pdf).
CEO Steve Huffman, answering Ron Josey (Citi) on "verification processes and bot labeling":

> "So I'll start with the easiest one, bot verification. So we have what we call good bots on Reddit
> which are basically programs that mostly moderators have written to help run communities on
> Reddit. We're porting those over to our developer platform. That will both result in them being
> labeled on Reddit more transparently and also allow us to batten down the hatches more on
> unauthorized bot usage."

> "On the verification and login side, one of the key technologies there is something like passkeys.
> So passkeys is a general technology that includes things like [Face ID], Touch ID, Yubikeys --
> it's basically a log-in system that requires a person to do something, look at your phone, or
> touch something. This is both a more secure way of logging in, an easier way of logging in,
> which will help us just grow login users in general and then also serves as probably the lightest
> weight and most privacy- and user-acceptable way of doing human verification as well."

What this establishes:

1. **The demand is real.** The CEO of a ~$663M-revenue-per-quarter (Q1'26, +69% YoY, 40% adj.
   EBITDA margin — same transcript) social platform discussed human verification unprompted-ish
   on an earnings call, tied to bot defence and login growth. Authenticity is explicitly the
   company's positioning ("the most human place on the internet", same transcript).
2. **It is NOT a blanket mandate.** Per Huffman's 2026-03-25 u/spez post as reported by Engadget
   (secondary; Reddit's own domains are not fetchable by this agent), verification prompts apply
   only "in rare cases [to] accounts that seem 'fishy'" and "will not apply to most users." The
   "Reddit mandates ID for all users" framing circulating in March 2026 trade press
   (e.g. securityonline.info, recho.co — both secondary and both overstating it) is wrong.
   https://www.engadget.com/social-media/reddit-will-prompt-some-accounts-to-verify-humanness-in-latest-bot-crackdown-161000181.html
3. **They chose passkeys — the free primitive — not a personhood credential.** This is the single
   most commercially important fact in this file. Reddit evaluated the space and landed on
   device-bound WebAuthn because it is "the lightest weight and most privacy- and user-acceptable
   way of doing human verification." Passkeys prove *a device with a user-presence gesture*, i.e.
   **liveness-ish / not-a-headless-script**. They prove **nothing about uniqueness** — one person
   can enrol unlimited passkeys across unlimited accounts, and a farm with N phones has N
   "verified humans". Reddit is knowingly buying weak-but-free.
4. **World ID is "considering," not adopted.** Reported (secondary, Engadget/WinBuzzer, March 2026)
   as an alternative under consideration alongside government ID for age-verification regions.
   `UNVERIFIED:` no Reddit primary source names World ID. Do not cite this as a World ID win.
   Where to look next: Reddit Q2'26 earnings (due ~late July/early Aug 2026) and r/reddit /
   redditinc.com/blog, which this agent cannot fetch (Reddit blocks the crawler).

**Implication for us:** the flagship "reference customer" for the category picked a $0 solution that
our aggregator does not sell. If we pitch Reddit-shaped buyers, we are not competing against World
ID pricing — we are competing against **passkeys, which cost the platform nothing**. Our score has
to be worth more than the delta between "user-presence gesture" and "unique human", and Reddit's
revealed preference says that delta is currently not worth paying for at consumer-social scale.

## 4. Willingness to pay
## 5. Privacy law as a constraint on us
## 6. Verdict on commercial viability
## References
