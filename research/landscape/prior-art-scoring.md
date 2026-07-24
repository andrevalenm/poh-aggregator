# Prior art: combining heterogeneous, correlated evidence into a single trust score

> STATUS: in progress

**Scope:** the mathematics and prior art behind our core product decision — how to turn N
heterogeneous personhood credentials into one humanity assertion (score, confidence, uniqueness
guarantee, underlying attestations).

**Three hard problems this file must attack** (from the project README):
1. **Commensurability** — what is a Circles trust position worth relative to an Orb scan or a
   passport proof?
2. **Correlated failure** — two credentials derived from one document are not two pieces of evidence.
3. **Privacy composition** — the aggregate must leak less than the sum of its parts.

**The empirical facts this formalism must accommodate** (delivered by the other research agents in
this batch; see the cited files for evidence):

- **~40 protocols in our roster collapse to ~6 trust roots**: iris registry (World ID), palm registry
  (Humanity Protocol), ICAO passport chip, national eID, a handful of KYC/liveness vendors, and web2
  account ownership. See `research/landscape/poh-landscape-sweep.md` and
  `research/landscape/kyc-liveness-vendors.md`.
- **Concrete multi-counting**: World ID's document tier, ZKPassport, Self and Rarimo all read the
  *same passport chip*; Coinbase Verifications, Civic, zkMe, Fractal and Linea PoH (Sumsub) all
  reduce to *a document check by a KYC vendor*; Humanity Protocol's own API defines `is_human` as
  "passed a KYC check **OR** palm enrollment". A naive additive score credits one passport five or
  six times.
- **Correlation is frequently unobservable.** Four incompatible nullifier derivations exist over the
  one shared preimage (the chip dump): Self and Rarimo publish *global, unscoped* per-document
  nullifiers on-chain; ZKPassport scopes per service and never publishes an unscoped value; World
  hashes a neighbouring field (`research/protocols/zk-passport-and-eid.md`). We therefore often
  **cannot detect** that two credentials came from one document. **Scoring must saturate rather than
  rely on dedup.** That is a hard constraint, not a preference.
- **Possession ≠ independent control.** Ohlhaver & Nikulin's Idena study
  (`research/references/ohlhaver-ethberlin-2024-transcript.md`): at the puppeteering peak in May 2022,
  **23 entities (<1% of distinct entities) controlled ≥40% of accounts and almost half of rewards**,
  and all 31 pools ever exceeding 100 accounts showed third-party key access. Every one of those
  accounts was a *verified unique human*. A uniqueness-only formalism scores this attack as perfect.
- **Publishing weights invites optimisation to the threshold.** Human Passport publishes its stamp
  weights in-repo and its threshold (20); farmers built baskets summing to just over 20. See §4.

---

## 1. Formal frameworks for combining evidence

### 1.0 What are we even estimating? Three latent variables, not one

Almost every failure in this literature starts by conflating things that must be kept apart. Define,
for a subject presenting credentials to us:

| Symbol | Hypothesis | Attacked by |
|---|---|---|
| **`L`** | *Liveness* — a human being was physically present at enrolment | deepfakes, injection attacks, presentation attacks |
| **`U`** | *Uniqueness* — this identity maps to a natural person **not already counted** in this scope | multi-document holders, registry gaps, cross-protocol non-dedup |
| **`C`** | *Independent control* — that natural person, and not a principal paying them, controls the key at use time | puppeteering, key custody, account rental/sale |

Standard practice (Passport, Trusta, essentially every web3 scorer) estimates a smear of `L` and `U`
and calls it "humanity". Ohlhaver's Idena result is the proof that `C` is not implied by `L ∧ U`: the
Idena puppets were live, unique, cognitively-tested humans and were still *de facto* sybils. Worse,
`C` is **not attested by any credential in our roster** — no protocol we surveyed proves at
verification time that the key-holder is the enrolled human acting on their own account.

Consequences we should state up front, because they constrain everything downstream:

1. Our output must be **at least two numbers**, not one. A single scalar cannot carry `U` and `C`.
2. `C` degrades **with the economic stakes of the query**. A $2 faucet does not induce puppeteering;
   a $2,000 airdrop does. So `P(C)` is a function of the *verifier's* payout, which is information
   only the verifier has. The honest architecture asks the verifier for it (see §7).
3. The only signals in our roster that bear on `C` at all are (a) **key-freshness / behavioural
   independence** (does this key act synchronously with a cluster? — Idena's own detection method),
   (b) **social-graph position** with real off-chain relationships (Circles), and (c) **stake that
   the true human would not delegate** (Idena's identity staking; MACI-style anti-collusion). All
   three are weak, and we should say so rather than sell `C` we do not have.

### 1.1 Bayesian combination, and exactly how badly naive independence fails

Work in log-odds. For hypothesis `H` (take `H = U` for now) and evidence `e₁…e_n`:

```
logit P(H | e₁…e_n)  =  logit P(H)  +  Σᵢ log LRᵢ        (†)
        where   LRᵢ = P(eᵢ | H, e₁…e_{i-1}) / P(eᵢ | ¬H, e₁…e_{i-1})
```

(†) is exact. The naive-Bayes / additive-point-score family drops the conditioning and uses
`LRᵢ = P(eᵢ|H)/P(eᵢ|¬H)`. **Every additive credential score in production is an unconditional-LR
approximation to (†) with the weights rescaled into "points".** Passport's `score = Σ wᵢ` is exactly
this with `wᵢ ∝ log LRᵢ` up to an affine transform.

**The failure.** Suppose credentials 1…k are deterministically derived from one root — as
ZKPassport / Self / Rarimo / World-document literally are. Then given `e₁`, the others carry *zero*
additional information: `P(e_j | H, e₁) = P(e_j | ¬H, e₁) = 1`, so the true `log LR_j = 0`. The naive
score adds `k · log LR₁` instead of `log LR₁`. The posterior odds are inflated by a factor of

```
LR₁^(k-1)
```

**Numerically, with our actual roster.** Take a passport-chip credential at `LR = 20` (i.e. a
forged-or-borrowed-document rate around 5% among adversarial presenters, versus ~100% pass among
genuine holders — a generous but not absurd figure). Prior odds 1:1.

| | true posterior odds | true `P(U)` | naive posterior odds | naive `P(U)` |
|---|---|---|---|---|
| 1 passport credential | 20 | 0.952 | 20 | 0.952 |
| 5 passport-derived credentials, truly one chip | 20 | **0.952** | 20⁵ = 3.2 × 10⁶ | **0.9999997** |

The stated failure probability drops from **4.8%** to **3 × 10⁻⁷**: a **160,000×** understatement.
In a 1M-address airdrop that is the difference between budgeting for ~48,000 fake claimants and
budgeting for ~0.3.

**The asymmetry — this is the core argument, and it is why the error is not just noise.** The
over-counting is not symmetric between honest users and attackers:

- A **genuine user** who holds five credentials generally holds them across *different roots*: their
  state's passport, an iris scan at an Orb, a Coinbase account, a Circles trust position from people
  who actually know them, a five-year-old GitHub. Effective independent evidence ≈ 5.
- A **farm** that has bought or rented one document acquires the *same one root* and then mints
  credentials on every protocol that reads it, at near-zero marginal cost per additional protocol
  (each is an SDK call and an enrolment session, not a new identity document). Effective independent
  evidence ≈ 1, presented as 5.

Under additive scoring **both score 5**. Formally, define the *effective number of independent
evidences* via the participation ratio of the evidence correlation matrix `Σ`:

```
d_eff  =  (Σ_k λ_k)² / Σ_k λ_k²        (λ_k = eigenvalues of Σ)
```

`d_eff = n` under independence, `d_eff = 1` under perfect correlation. Naive additive scoring reports
`n`; the truth is `d_eff`. **The adversary's whole business is maximising `n / d_eff`.** Additive
scoring is therefore wrong *specifically in the adversary's favour*, and the size of the error is
proportional to how hard the attacker worked. This is the single strongest argument for
correlation-aware scoring and should be the first slide of any explanation of our product.

A second, subtler Bayesian point: **the population prior is adversarial too.** `P(H)` in (†) is the
base rate of genuine humans among *people who show up at this verifier*, which is endogenous to the
payout. High-value airdrops attract farms; the prior shifts adversarially precisely when you need the
score most. Any calibration measured on a low-stakes population is optimistic when deployed on a
high-stakes one. Cf. performative prediction (§1.6).

### 1.2 Dempster–Shafer and subjective logic: right instincts, wrong engine

**Dempster–Shafer (DS).** On a frame of discernment `Θ` (for us `Θ = {h, ¬h}`), a *mass function*
`m : 2^Θ → [0,1]` with `m(∅)=0`, `Σ_A m(A)=1`, gives

```
Bel(A) = Σ_{B ⊆ A} m(B)        Pl(A) = Σ_{B ∩ A ≠ ∅} m(B)        u(A) = Pl(A) − Bel(A)
```

The appeal for us is real: `m(Θ)` is **explicit ignorance**. A user with no credentials gets
`Bel(h)=0, Pl(h)=1` — "we know nothing", which is genuinely different from "we have evidence they are
a bot". Any point-estimate scorer collapses those two into the same low number, and that is a real
product defect (it punishes cold-start users identically to detected sybils).

Dempster's rule of combination:

```
m₁₂(A) = (1/(1−K)) · Σ_{B ∩ C = A} m₁(B) m₂(C),      K = Σ_{B ∩ C = ∅} m₁(B) m₂(C)
```

`K` is the **conflict mass**, and the `1/(1−K)` normalisation is where it goes wrong.

**Zadeh's counterexample** (Zadeh 1979; restated in *AI Magazine* 7(2), 1986). Two doctors,
`Θ = {meningitis, concussion, tumour}`. Doctor 1: `m(M)=0.99, m(T)=0.01`. Doctor 2: `m(C)=0.99,
m(T)=0.01`. Every mass pair intersects emptily except `T∩T`, so `K = 0.9999` and Dempster's rule
returns `m(T) = 1.0` — **certainty in the diagnosis both experts considered nearly impossible.**

Two things to take from this, one mild and one fatal:

- *Mild for us.* On a binary frame the pathology is much less dramatic — with `Θ={h,¬h}` the only
  empty intersection is `{h}∩{¬h}`, and combination degenerates to a product of odds, i.e. back to
  naive Bayes. Zadeh's counterexample is not, by itself, a reason to reject DS in our setting.
- *Fatal for us.* **Conflict between our credentials is the most valuable signal we have, and
  Dempster's rule normalises it away.** If a subject presents an Orb scan and a passport proof whose
  claimed nationalities are inconsistent, or a fresh key with an old-account credential, `K` is high
  — and high `K` is *evidence of fraud*, not a nuisance constant. Alternative rules
  (**Yager 1987** reassigns conflict to `m(Θ)`; **Dubois–Prade 1988** to the union) at least preserve
  it as ignorance. Our design should go further and **expose `K` as a first-class output** ("evidence
  conflict") rather than fold it into the score.

**The disqualifying issue, though, is different and is rarely stated plainly: Dempster's rule assumes
the sources are independent.** It is Shafer's own condition. DS therefore does *not* solve our
problem — it has exactly naive Bayes's independence assumption plus an extra uncertainty dimension.
Adopting DS because it "handles uncertain sources" would be a category error.

The part of the DS literature that *does* address us is **Denœux's cautious conjunctive rule**
(Denœux, "Conjunctive and disjunctive combination of belief functions induced by nondistinct bodies
of evidence", *Artificial Intelligence* 172(2–3), 2008). It combines via the minimum of the canonical
weight functions and is **idempotent**: `m ⊙ m = m`. Idempotency is *precisely* the property we want
for two credentials off one passport — combining a piece of evidence with itself must not strengthen
it. Cautious combination is the correct DS-family answer to "we cannot tell whether these sources are
distinct", and it is the DS analogue of the saturation rule we recommend in §7.

**Subjective logic (Jøsang).** An opinion is `ω = (b, d, u, a)` with `b + d + u = 1`, projected
probability `P = b + a·u`, and a bijection to a Beta density: from `r` positive and `s` negative
observations, `b = r/(r+s+2)`, `d = s/(r+s+2)`, `u = 2/(r+s+2)`. (Jøsang, *Subjective Logic: A
Formalism for Reasoning Under Uncertainty*, Springer 2016.) Two operators matter to us:

- **Trust discounting** `ω^A_C = ω^A_B ⊗ ω^B_C` — A's opinion about C via B. This is the right shape
  for *issuer reliability*: our opinion of a credential = our opinion of the issuer ⊗ the issuer's
  claim. It gives a principled way to say "zkMe's uniqueness assertion is only as good as zkMe's
  dedup gallery", and to downgrade a whole issuer after an incident without rewriting per-credential
  weights.
- **Fusion.** Jøsang distinguishes *cumulative* fusion (independent observations, evidence adds) from
  *averaging* fusion (dependent observations, evidence averages) and later *weighted/consensus*
  variants. The existence of the distinction is the admission that the algebra does not derive
  dependence — you must classify the sources yourself. That is the same manual step the factor model
  makes explicit and estimable.

**Assessment.** Borrow the **representation** — carry `(belief, disbelief, uncertainty)` and surface
conflict — because it fixes the cold-start defect and gives verifiers an honest "we don't know". Do
**not** adopt the fusion algebra as the engine, because its dependence handling is a manual
classification step dressed as arithmetic, and because it gives us no way to price *cost*, which is
what our commensurability problem actually needs.

### 1.3 Latent-factor / copula models — the recommended core

This is the formalism that maps directly onto our facts, because our correlation structure is
*known a priori by protocol design* even when it is *unobservable per user*.

**Model.** Let `Z₁ … Z_K ~ N(0,1)` be latent **root-compromise factors**: `Z_doc` (this passport
chip), `Z_iris`, `Z_palm`, `Z_eid`, `Z_vendor(v)` (this KYC vendor's document check), `Z_web2`,
`Z_device` (this farm's device/IP/behaviour fingerprint), `Z_cluster` (this social cluster). Give
credential `i` loadings `λ_{ik}` with `Σ_k λ_{ik}² ≤ 1`, and a latent liability

```
Xᵢ = Σ_k λ_{ik} Z_k  +  √(1 − Σ_k λ_{ik}²) · εᵢ ,      εᵢ ~ N(0,1) iid
```

Credential `i` is successfully faked iff `Xᵢ > τᵢ`, where `Φ(−τᵢ) = pᵢ` = the marginal probability an
adversarial presenter obtains credential `i`. The marginals `pᵢ` are per-protocol facts (forge cost,
rental market price, documented incident rate); the loadings `λ` encode which roots each protocol
reads. The joint failure law is a **Gaussian copula** with correlation `Σ = ΛΛᵀ + D`.

This is exactly the **Vasicek / CreditMetrics one-factor model** (Vasicek, "Loan Portfolio Value",
*Risk*, 2002) and the Li Gaussian copula (Li, "On Default Correlation: A Copula Function Approach",
*J. Fixed Income*, 2000). **The analogy is unflattering and we should keep it in front of us: our
aggregate humanity score is a senior tranche on a pool of correlated credentials.** AAA CDO tranches
did not fail because the marginal default probabilities were wrong; they failed because the
*correlation* was mis-specified and everything defaulted together (MacKenzie & Spears, "'The formula
that killed Wall Street'", *Social Studies of Science* 44(3), 2014). Our failure mode is identical in
structure: a passport-rental market opening up is a common-factor shock that flips five "independent"
credentials at once.

**Single-factor closed form.** With one shared factor and equal loading `√ρ` (`Xᵢ = √ρ Z + √(1−ρ) εᵢ`):

```
P(all n faked) = ∫ φ(z) · Πᵢ Φ( (√ρ·z − τᵢ) / √(1−ρ) ) dz
```

Numerically, with `pᵢ = 0.05` for every credential, and defining a score
**`S = −log₁₀ P(all faked)`** ("orders of magnitude of forgery difficulty"):

| `ρ` | n=3 → P(all faked) | S | n=5 → P(all faked) | S |
|---|---|---|---|---|
| 0.00 | 1.25 × 10⁻⁴ | 3.90 | 3.13 × 10⁻⁷ | 6.51 |
| 0.20 | 8.74 × 10⁻⁴ | 3.06 | 5.67 × 10⁻⁵ | 4.25 |
| 0.50 | 4.96 × 10⁻³ | 2.30 | 1.56 × 10⁻³ | 2.81 |
| 0.80 | 1.68 × 10⁻² | 1.77 | 1.07 × 10⁻² | 1.97 |
| 0.95 | 3.18 × 10⁻² | 1.50 | 2.67 × 10⁻² | 1.57 |
| 1.00 | 5.00 × 10⁻² | **1.30** | 5.00 × 10⁻² | **1.30** |

*(computed by Gauss–Legendre quadrature over the factor; script reproducible in a few lines of
Python — no external dependencies beyond `statistics.NormalDist`.)*

Read the last row. **At `ρ = 1`, five credentials are worth exactly one** — `S = −log₁₀(0.05) = 1.30`
regardless of `n`. Saturation is not a hack bolted onto the model; it is the model's `ρ → 1` limit.
That is the single most important property for us, because §1.5's constraint says we must saturate
when we cannot observe the link. And note how fast the credit decays: at `ρ = 0.5` — a *moderate*
shared-root assumption — five credentials are worth **less than three independent ones**.

**Why this formalism and not the others.** It is the only one on this list that (a) represents shared
roots as *first-class objects* rather than as pairwise fudge factors, (b) degrades to the right limits
automatically (`ρ=0` → additive log-scores, `ρ=1` → max), (c) lets us set correlations from
**protocol design knowledge** rather than from per-user link detection, and (d) has a directly
explainable reason-code story: "your five credentials load on two roots" is a sentence a user and a
regulator both understand.

**Honest limitations.** The Gaussian copula has *zero tail dependence*: `lim_{q→0} P(X₂ < q | X₁ < q)
= 0` for any `ρ < 1`. That is exactly the wrong tail behaviour for us — the scenario we fear (a
document-forgery service goes on sale; a vendor's liveness check is broken by a new deepfake model)
is a *joint tail event*. A **t-copula** (with degrees-of-freedom `ν` controlling tail dependence,
`λ_tail = 2·t_{ν+1}(−√((ν+1)(1−ρ)/(1+ρ)))`) or an explicit mixture with a "root broken" regime is the
correct fix, and it is cheap: add a small-probability catastrophic state per root. Do not ship the
plain Gaussian version and call the tail modelled.

**The implementable shadow of this model.** The copula is the statistical justification. What we
should actually run in production is its cost-space projection, because costs are what we can source
and defend:

```
Attack cost to reach score T  =  Σ_{k ∈ roots touched} c_k          (roots, not credentials)
```

Credentials sharing a root are near-free after the first (they still cost an enrolment session, not a
new identity). This is the `ρ→1`-within-root, `ρ→0`-between-roots limit of the factor model, written
in units a customer understands. See §7 for the full specification.

### 1.4 Item response theory / Rasch — the underused analogy, and it is a good one

Treat each credential as a *test item* and the subject's latent humanity/independence as *ability* `θ`.

```
Rasch (1PL):   P(pass item i | θ) = σ(θ − bᵢ)
2PL:           P = σ(aᵢ(θ − bᵢ))
3PL:           P = cᵢ + (1 − cᵢ)·σ(aᵢ(θ − bᵢ))
```

The parameter mapping is unusually clean for an analogy:

| IRT parameter | Our meaning |
|---|---|
| `θ` | latent humanity / independence of the subject |
| `bᵢ` (difficulty) | **forge/acquire cost** of credential `i` — the log-dollar figure |
| `aᵢ` (discrimination) | how sharply credential `i` separates humans from farms; **low `a`** = a credential everyone passes (Google account) or nobody does |
| `cᵢ` (guessing/floor) | **the probability a farm obtains it by purchase or brute force regardless of `θ`** — the credential-rental market, in one parameter |

Three things IRT gives us that nothing else on this list does:

1. **Weights estimated from data, not assigned by committee.** Marginal maximum likelihood (or a
   hierarchical Bayesian fit) estimates `(aᵢ, bᵢ, cᵢ)` *and* each user's `θ` jointly from the
   observed credential-possession matrix. Passport's weights are a hand-tuned table with
   three-decimal precision it cannot possibly justify (`0.202`, `16.021`, `5.892` — see §4); IRT is
   the standard, century-old machinery for producing exactly that table defensibly.
2. **Adaptive routing — our "1inch" primitive, already solved in psychometrics.** Item information
   `Iᵢ(θ) = aᵢ² · P(1−P)` is maximised near `θ ≈ bᵢ`. Computerised adaptive testing selects the next
   item that maximises information at the current `θ̂` and stops when the posterior SE falls below a
   target. That is *literally* "which protocol should we send this user to next, and when do we stop
   asking?" — the routing question at the centre of our product, with 40 years of operational
   literature behind it (Lord, *Applications of Item Response Theory*, 1980; van der Linden & Glas,
   *Computerized Adaptive Testing*, 2000).
3. **Ability *and* standard error.** IRT natively reports `SE(θ̂)`, which is the "confidence" half of
   our output contract, derived rather than invented.

**The catch, and the fix.** IRT assumes **local independence**: items are conditionally independent
given `θ`. That is our failing assumption again. But psychometrics hit this decades ago and solved it:
**testlet response theory** (Bradlow, Wainer & Wang, "A Bayesian random effects model for testlets",
*Psychometrika* 64(2), 1999) adds a random effect for items sharing a stimulus:

```
P(pass i | θ, γ) = σ( aᵢ(θ − bᵢ − γ_{j,d(i)}) )
```

where `d(i)` is the *testlet* item `i` belongs to and `γ_{j,d}` is subject `j`'s random effect for
that testlet. Several comprehension questions about one reading passage are not independent evidence
of reading ability — **which is exactly, structurally, our several credentials off one passport.** A
testlet *is* a trust root.

And note: **testlet IRT and the latent-factor copula of §1.3 are the same model in different
notation** (a logistic vs probit link on a shared random effect). That is a useful convergence, not a
coincidence, and it means we can pick the view per purpose: the **factor/copula view** for reasoning
about attack cost and tail risk, the **IRT view** for calibrating parameters from data and for
adaptive routing. One model, two dialects.

Limitation worth stating: IRT's estimation guarantees assume the response process is not adversarial.
Its equivalent of cheating (item pre-knowledge, item harvesting) is a known, actively-researched
weakness, and in our setting it is the norm rather than the exception. Fit parameters from data;
do not trust the fit to survive an adversary who reads §1.6.

### 1.5 The unobservable-correlation case, and why saturation is minimax-optimal

The ZK-passport finding — four incompatible nullifier derivations over one chip dump, two of them
publishing global nullifiers and two not — means we will routinely face two credentials that *may or
may not* share a root, with no way to test it. What does a correlation-aware score do then?

**Answer 1: correlation is a property of the credential class, not of the user.** We do not need to
detect that *this* user's ZKPassport proof and *this* user's Self proof came from one document. We
know from protocol design that ZKPassport, Self, Rarimo and World's document tier **all read the ICAO
chip**, and that a human with two valid passports is rare. The correlation matrix is therefore
populated from a **trust-root ontology maintained by us**, at the class level — a table we can build,
audit, publish, and version. This is the observation that makes the whole factor model implementable
without any cross-protocol linkability. It is also, conveniently, the one asset that gets more
valuable with scale and is genuinely hard to copy.

**Answer 2: when correlation is uncertain, assume it is 1 within a class.** Consider the two errors:

- *Over-crediting a farm:* if we assume independence and the truth is `ρ=1`, the attacker gains
  `Σᵢ wᵢ − max_i wᵢ` points for free, and this grows **linearly in the number of protocols reading
  that root** — an unbounded quantity that grows as our integration list grows. (Our own roadmap is
  the attacker's roadmap.)
- *Under-crediting an honest user:* if we assume `ρ=1` and the truth is independence, an honest user
  with two genuinely distinct documents loses at most one class's worth of points — **bounded by the
  class cap**, and empirically almost nobody is affected, because holding two valid unrelated
  passports is rare.

The loss is bounded on one side and unbounded on the other, so the minimax choice is unambiguous:
**saturate within class.** Formally, with per-class cap `W_k` and unknown within-class correlation
`ρ ∈ [0,1]`, the aggregation `S = Σ_k min(Σ_{i ∈ k} wᵢ, W_k)` is the one that minimises worst-case
adversarial gain over `ρ`, and its cost to honest users is at most `Σ_k (Σ_{i∈k} wᵢ − W_k)⁺` on a
population fraction we can measure. Saturation is not a conservatism tax; it is the correct answer.

A pleasant side effect: **saturation removes the incentive to farm redundant credentials**, which
reduces our own load and removes the "collect them all" UX that makes aggregate scores privacy-toxic
(§6).

### 1.6 Adversarial / minimax framing: your score's security is a knapsack optimum

Assume the adversary knows the weights `w`, the threshold `T`, and the acquisition cost `cᵢ` of each
credential. Their problem is:

```
minimise  Σᵢ cᵢ xᵢ      subject to      Σᵢ wᵢ xᵢ ≥ T,     xᵢ ∈ {0,1}
```

a **min-cost covering knapsack**. Its optimum is the *price of a fake identity* under our score.
Three consequences, all of which matter more than any accuracy metric:

1. **The security of a threshold score is `min-cost-cover(w, T)`, not its AUC, not its average
   behaviour.** A scorer with excellent average discrimination and one cheap high-weight credential
   is worth exactly the price of that credential. Every published-weight system should be audited by
   solving this knapsack against real market prices — an exercise we do against Passport's live
   weight table in §4, and one we must run against our own table before every re-weight.
2. **The robust-optimal weights equalise cost per point: `wᵢ / log cᵢ ≈ const`.** If any credential's
   points-per-dollar exceeds the others', the rational attacker buys only that one, and the rest of
   the table is decoration. Equivalently: **weight should be a monotone function of cost**, and any
   deviation is a vulnerability, not a modelling choice. Under the root model of §1.3 the constraint
   becomes a *weighted set cover over roots*, which is what we want, because it prices what the
   attacker actually has to buy.
3. **Deploying the score changes the population.** This is *performative prediction* (Perdomo,
   Zrnic, Mendler-Dünner, Hardt, "Performative Prediction", ICML 2020) and *strategic classification*
   (Hardt, Megiddo, Papadimitriou, Wootters, "Strategic Classification", ITCS 2016; Brückner &
   Scheffer's Stackelberg formulation, KDD 2011). The canonical result is that features which are
   *cheaply manipulable* lose all predictive value once the classifier is published, and the
   classifier should be built on features that are **causal or expensive**, not merely correlated.
   For us: behavioural/graph features (Trusta's MEDIA, account age, tx counts) are the cheaply
   manipulable class; expensive-root credentials are the causal class. Weight accordingly.

**Design implications we should adopt:**

- **Prefer `min` over `Σ` across roots** where the semantics allow. Requiring coverage of *k distinct
  roots* forces the attacker to pay `Σ c_k` rather than `min c_k`. This is the leximin/robust
  aggregation choice and it is much stronger than any weighting of a single sum.
- **Randomise.** A deterministic threshold lets the attacker stop at `T + ε`. A stochastic acceptance
  band, or a random audit with probability increasing as the score approaches `T`, forces overshoot
  and is minimax-optimal in the Stackelberg game (mixed strategies dominate pure ones for the
  defender). Passport's fixed `20` is the textbook failure here.
- **Do not publish weights at full precision, but do publish the ontology.** The tension is real (§2,
  §3); our resolution is in §7 — publish *which roots you have and which you lack* (explainable,
  actionable, and it is the user's own data), keep the *numeric* mapping from cost to points and the
  audit-probability curve unpublished and rotating.

## 2. Credit scoring as canonical prior art

Credit scoring is the only field that has run a heterogeneous-evidence trust score at population
scale for fifty years, under a regulator, against a motivated adversary. It is our best source of
hard-won operational lessons — and its differences from our case are as instructive as its
similarities.

### 2.1 What FICO/VantageScore actually is, mechanically

A FICO score is a **scorecard**: a segmented (by "scorecard assignment" — thin file, prior
derogatory, etc.) generalised-linear model over **binned, WOE-transformed** attributes, monotonicity
constrained, then rescaled to the 300–850 band. Two design choices in that sentence are directly
relevant to us:

- **Binning + weight-of-evidence** rather than raw features. Every attribute becomes a small number
  of ordered bins with a fitted point value. This is *deliberately* lossy: it buys monotonicity,
  stability under drift, and — crucially — reason codes, at the cost of some discrimination. That
  trade (accuracy for explainability and stability) is one they make consciously, every time.
- **Segmentation**. Different scorecards for different populations because the same attribute means
  different things in a thin file than in a thick one. Our analogue: a user with three credentials
  and a user with fifteen should not be scored by the same function; the marginal value of a
  credential depends on what else is present. (In our formalism this falls out of the factor model
  rather than needing separate scorecards — see §7.)

### 2.2 How they handle correlated features — and the honest answer is "crudely, but on purpose"

Credit attributes are enormously correlated (utilisation, balances, limits, number of accounts, all
move together). The industry's methods:

1. **Attribute selection with correlation screening** — drop one of any highly correlated pair
   before fitting. This is not a correlation *model*; it is correlation *avoidance*.
2. **The GLM handles residual collinearity by shrinking coefficients**, which produces stable
   predictions but unstable and uninterpretable individual weights — a known problem they live with.
3. **Monotonicity constraints** prevent the pathological sign-flips collinearity otherwise produces.

The key point for us: **credit scoring solves correlated evidence by throwing evidence away, because
it can.** They have hundreds of correlated attributes and can afford to keep one per family. We have
five to ten credentials per user and cannot afford to discard four of them — we need to *price* the
correlation, not avoid it. This is the main reason the scorecard tradition does not transfer directly
and the factor model does.

### 2.3 Reason codes and the regulatory explainability regime — transfer this wholesale

Under **ECOA / Regulation B, 12 CFR § 1002.9**, a creditor taking adverse action must give the
**specific principal reasons**. The official interpretation says disclosure of **more than four
reasons "is not likely to be helpful"** — hence the industry's four-reason-code convention
([CFPB Interp-9](https://www.consumerfinance.gov/rules-policy/regulations/1002/Interp-9),
[§1002.9](https://www.consumerfinance.gov/rules-policy/regulations/1002/9/)). Vague reasons
("you did not meet our internal standards", "your score was insufficient") **do not comply**, and
notably, disclosing the *credit-score* key factors does **not by itself** satisfy the ECOA
requirement to state reasons for the *credit decision*.

**CFPB Circular 2022-03** is the sentence to tattoo on the wall of anyone shipping a model-based
score ([CFPB](https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/),
[Federal Register](https://www.federalregister.gov/documents/2022/06/14/2022-12729/consumer-financial-protection-circular-2022-03-adverse-action-notification-requirements-in)):

> "ECOA and Regulation B do not permit creditors to use complex algorithms when doing so means they
> cannot provide the specific and accurate reasons for adverse actions."

> "A creditor cannot justify noncompliance with ECOA and Regulation B's requirements based on the
> mere fact that the technology it employs to evaluate applications is too complicated or opaque to
> understand. A creditor's lack of understanding of its own methods is therefore not a cognizable
> defense against liability."

FICO's own reason-code sheet exists precisely to serve this
([FICO — US FICO Score Reason Codes](https://www.fico.com/en/latest-thinking/product-sheet/us-fico-score-reason-codes);
consumer-facing explainer, [myFICO](https://www.myfico.com/credit-education/blog/reason-codes)),
with codes ordered by influence, top four surfaced.

**What transfers to us, and it is a lot:**

- **A denial must come with actionable, specific, ordered reasons.** Ours should be *root-shaped*:
  "you have evidence from 1 of 6 trust-root families; add a distinct root (state document, biometric
  registry, or an established social position)". That is specific, actionable, and — importantly —
  **it is a statement about the user's own evidence, not about our weights**, which is how you get
  explainability without full gameability (§1.6, §3.3).
- **The four-reason convention is a good product constraint**, not just a legal one. It forces the
  model to have a small number of legible drivers.
- **We are not currently in scope for Reg B** (we are not a creditor), but the moment a personhood
  score gates access to money — airdrops, grants, UBI-style distributions — the *shape* of the
  regulatory argument arrives regardless of the statute. And EU-side, if a score materially affects a
  person, GDPR Art. 22 (automated decisions) and the AI Act's transparency provisions land on very
  similar ground. Designing reason codes from day one is cheap; retrofitting explainability onto an
  opaque score is what Circular 2022-03 says is not permitted. `UNVERIFIED:` I have not checked
  whether any current EU instrument classifies a personhood score as high-risk under the AI Act —
  see `research/landscape/demand-and-regulation.md` and confirm before relying on this.

### 2.4 Score stability, population drift, and redevelopment

Three operational facts, all of which we inherit:

- **Scores drift because populations drift.** Scorecards are redeveloped every few years (FICO 8,
  9, 10/10T; VantageScore 3.0 → 4.0) because the relationship between attributes and default changes.
  The industry monitors this with **Population Stability Index** and characteristic-analysis reports,
  and has a well-understood tripwire convention (PSI > 0.25 → redevelop). We should adopt PSI
  monitoring per credential from day one: a stamp whose population distribution shifts sharply is
  either being farmed or has broken.
- **Score stability is a product requirement in its own right.** Lenders will not deploy a model
  whose output jumps under small input changes; consumers will not trust one. Our version:
  **credential expiry and graph churn must not cause discontinuous score drops.** Circles trust edges
  expire; Passport stamps expire (typically 90 days); Verax/Sumsub PoP has a ≤90-day window. A score
  that cliff-edges on expiry will generate exactly the support load and mistrust that FICO's
  smoothing conventions exist to avoid. Decay must be continuous.
- **Every model change is a redistribution of who passes**, and it is politically contested. Expect
  the same: our re-weight is somebody's airdrop eligibility.

### 2.5 Gaming — the part where credit scoring is a *closer* analogue than it first looks

The received wisdom is "credit scoring has no adversary". That is wrong in an instructive way. The
adversary is smaller and slower, but it exists, and the single best analogy in this whole document
lives here:

**Authorized-user tradelines ("piggybacking") are credential rental.** A stranger pays to be added as
an authorized user on an old, clean, high-limit account; the account's history flows onto their file;
their score jumps. The account holder rents out their reputation. This is *structurally identical* to
personhood-credential rental — the Idena human-farm, the sold World ID, the borrowed passport — right
down to the fact that the underlying credential is genuine and the *relationship* is the lie.

The industry's response is the interesting part. FICO announced it would drop authorized-user
accounts from FICO 08 and then **did not** — instead it kept them and added filters that attempt to
distinguish genuine household authorized users (spouses, children) from paid tradelines, using
relationship signals from the credit file, **and it does not publish how**
([Credit.com, secondary](https://www.credit.com/blog/piggybacking-to-boost-fico-scores-does-it-still-work/);
[creditscoring.com, secondary](https://www.creditscoring.com/creditscore/fico/quirks/authorizeduser.html);
academic treatment: [Federal Reserve FEDS 2010-23, "Credit Where None Is Due? Authorized User Account
Status and Piggybacking Credit"](https://www.federalreserve.gov/pubs/feds/2010/201023/201023pap.pdf)).
VantageScore's approach has been to exclude or discount them.

**Four lessons, all directly applicable:**

1. **Do not remove a gamed signal; discount it conditionally.** Authorized-user history is real
   evidence for real families. The fix was a *relationship* test, not deletion. Our analogue: a
   credential that is rentable is not worthless — it is worth less *when the surrounding context
   looks like rental* (fresh key, no social embedding, synchronous behaviour with a cluster). This is
   the `C` dimension of §1.0 doing real work.
2. **The anti-gaming layer is the part you don't publish.** FICO publishes the reason codes and the
   broad factor categories with percentage weights; it does not publish the piggybacking filter. That
   is precisely the explainability/gameability split we should copy (§7).
3. **A whole industry forms around any published threshold.** Tradeline brokers exist because the
   score matters and the mechanism is known. Assume the equivalent for us on day one of mattering.
4. **The gaming arrived only after the score had consequences.** The corollary is that *our* score
   being currently un-gamed is not evidence of robustness — it is evidence of irrelevance.

### 2.6 What does *not* transfer

- **Ground truth.** Credit has a clean, observable, time-boxed label: 90+ days delinquent in 24
  months. We have **no label at all** for "is a unique independently-controlled human". Everything we
  can build is semi-supervised at best, and every calibration claim we make will be against a proxy.
  This is the single biggest methodological gap between us and the prior art, and any honest version
  of our docs says so.
- **A repeated game with the same person.** Lenders observe outcomes and refit. We mostly observe
  nothing after issuance.
- **Bureau-level data monopoly.** FICO scores a file assembled by three bureaus with legal reporting
  obligations. Nobody is obliged to report anything to us; our data is voluntary and adversarially
  selected (users show us their *best* credentials, never their worst).
- **The adversary's speed.** Credit fraud iterates in months; airdrop farming iterates in hours, and
  the payoff per identity is immediate and liquid.

## 3. Anti-fraud / bot-detection scoring in production

This industry is a better *behavioural* match than credit scoring — real-time, adversarial, no clean
label, published scores — and its consensus design choices are worth reading as revealed preference.

### 3.1 The published surface, protocol by protocol

**Google reCAPTCHA v3** ([docs](https://developers.google.com/recaptcha/docs/v3)). Returns a
continuous score in `[0.0, 1.0]`: "1.0 is very likely a good interaction, 0.0 is very likely a bot",
with "by default, you can use a threshold of 0.5". No explanation of the score is given to the site,
let alone the user. The guidance is explicitly *not* to block on it: use it to trigger
step-up (2FA, moderation, manual review) "behind the scenes". Two things to steal:
**(a) ship a continuous score and let the relying party choose the threshold**, and **(b) design the
product around graded response rather than binary admit/deny.**

**Cloudflare Bot Management** ([Bot scores](https://developers.cloudflare.com/bots/concepts/bot-score/),
[Bot detection engines](https://developers.cloudflare.com/bots/concepts/bot-detection-engines/)).
Score `1–99`, 1 = almost certainly automated, 99 = almost certainly human; "<30" is the commonly-cited
bot band. What is architecturally interesting is that the score is the output of **several distinct
engines** — heuristics (deterministic, emits a hard `1`), supervised ML (produces most of the 2–99
range), anomaly detection, and JS detections — with the heuristic engine able to *override*. That is
the right structure for us too: **deterministic disqualifiers must not be averaged with a soft
model**. If we detect a shared global nullifier across two accounts, that is a hard `1`, not −3
points.

**Sift / Forter / Arkose.** Commercially, these sell scores plus decisions; the explainability they
offer is to the *merchant* (risk factors, "insights", decision reasons for chargeback
representment), never to the end user, and never at a fidelity that permits reconstruction of the
model. Arkose's public positioning is different in kind: instead of scoring you, it *prices* you —
escalating challenge difficulty so that the attacker's unit economics break. That is the closest
thing in industry to our §1.6 minimax framing, and it is a better idea than a threshold.
`UNVERIFIED:` I did not fetch current Sift/Forter/Arkose technical documentation in this pass;
statements here are from general knowledge of their public positioning and should be checked against
their docs before being cited externally.

### 3.2 What they publish about calibration — essentially nothing, and that is the finding

Not one of these vendors publishes a calibration curve, a reliability diagram, a confusion matrix at
a stated operating point, or a base rate. reCAPTCHA v3's own guidance says score distributions differ
per site and per environment (staging vs production), which is an admission that the score is **not
calibrated across contexts** — it is an ordinal ranking within a site's own traffic. Cloudflare's
score is likewise a supervised model's probability output mapped to 1–99, with no published
reliability data.

**Implication for our product, and it is a positive one:** *published calibration is an open
differentiator*. Nobody in adjacent industries does it, and our buyer (an airdrop or grant operator)
genuinely needs to know "if I set the threshold at 25, what fraction of accepted addresses are farm
addresses?" We cannot answer that honestly without labels (§2.6), but we can publish (a) the score
distribution by credential class, (b) results on any labelled sybil-cluster dataset we can get, and
(c) an explicit statement of what we cannot measure. Doing that badly is worse than not doing it;
doing it honestly is a real moat.

### 3.3 The explainability/gameability trade-off, as the industry actually resolves it

The resolution is consistent across every vendor above, and it is **asymmetric disclosure**:

| Disclosed | Withheld |
|---|---|
| The score, its range, its direction | The features |
| Recommended operating points | The weights |
| Coarse categories of signal ("automation detected") | Which signal fired, and its threshold |
| Guidance to step up rather than block | The detection cadence and rotation |

Nobody in production bot detection publishes weights. Human Passport did, and got exactly what §1.6
predicts (§4.1). The reconciliation with §2.3's legal requirement is subtler than "pick one":

> **Explain the *user's evidence*, not the *model's weights*.** "You have one trust root; a second,
> distinct root would materially raise your score" is specific, actionable, satisfies the spirit of a
> reason code, and reveals nothing exploitable — because the thing it tells the attacker to do (go
> acquire a genuinely distinct root) is *exactly the expensive thing we want to charge them for*.

That formulation is, I think, the cleanest resolution available to us, and it only works because our
score is cost-denominated. In a correlation-blind additive score, "add more stamps" is cheap advice;
in a root-cost score, the advice and the defence are the same sentence.


## 4. Web3 attempts at exactly this

### 4.1 Gitcoin / Human Passport — the direct predecessor, and a fully-readable natural experiment

Passport is the only prior art in our exact shape whose scoring model is **completely public**, which
makes it the most valuable object in this document: we can audit it with the tools of §1.

**The live weight table.** `api/scorer/settings/gitcoin_passport_weights.py` on `main`
([passportxyz/passport-scorer](https://github.com/passportxyz/passport-scorer/blob/main/api/scorer/settings/gitcoin_passport_weights.py),
retrieved 2026-07-24) — 50 stamps, `GITCOIN_PASSPORT_THRESHOLD = "20"`, weights summing to
**180.108**. Still actively maintained: last commits touching the file are **2026-01-06** (remove
`GuildPassportMember`), **2025-12-18** (add `X` at 3.2), **2025-12-02** (raise `Biometrics` and
`CleanHands`). Selected weights:

| Stamp | Weight | | Stamp | Weight |
|---|---|---|---|---|
| `NFTScore#50` | 16.246 | | `CivicUniquenessPass` | 5.005 |
| `CoinbaseDualVerification` | 16.042 | | `GitcoinContributorStatistics#…Gte#1000` | 4.997 |
| `HolonymGovIdProvider` | 16.026 | | `TrustedCitizen` | 4.009 |
| `BinanceBABT` | 16.021 | | `X` | 3.2 |
| `ETHScore#50` | 16.021 | | `CivicLivenessPass` | 3.038 |
| `CoinbaseDualVerification2` | 10.042 | | `CleanHands` | 3 |
| `BinanceBABT2` | 10.021 | | `Google` | 0.525 |
| `Biometrics` | 6.001 | | `Brightid` | 0.202 |
| `IdenaState#Newbie` | 5.892 | | `ETHDaysActive#50` | 0.207 |

**Finding 1 — they discovered within-root discounting and implemented it by hand, without naming it.**
`BinanceBABT` = 16.021 but `BinanceBABT2` = 10.021; `CoinbaseDualVerification` = 16.042 but
`CoinbaseDualVerification2` = 10.042. A second credential from the same issuer is deliberately worth
~62% of the first. That is a manual, per-pair, ungeneralised version of the saturation rule of §1.5.
It is the right instinct executed without a model, so it only covers the two cases somebody noticed.

**Finding 2 — the arithmetic is broken in exactly the way §1.1 predicts, and it is checkable.**
The model-based stamps come in stacking tiers (`#50`, `#75`, `#90` are "model score ≥ 50 / 75 / 90",
so a high-scoring address earns all three):

```
ETHScore#50 + ETHScore#75 + ETHScore#90  =  16.021 + 2.399 + 2.926  =  21.346   ← above threshold
NFTScore#50 + NFTScore#75 + NFTScore#90  =  16.246 + 2.362 + 2.413  =  21.021   ← above threshold
both families together                                              =  42.367
whole on-chain-activity family (incl. zkSync, gas, tx count, days)  =  50.210
```

**Two separate ML models, each scoring the same wallet's own transaction history, each independently
clear the humanity threshold on their own.** These are not independent evidence in any sense — they
are one root (this address's on-chain behaviour), read twice, tiered three ways each. And on-chain
behaviour is the *cheapest root in existence to fabricate*: it is the one thing a farm manufactures
at scale by construction. This is `n / d_eff` maximisation handed to the attacker for free.
(`UNCLEAR:` whether the three Idena tiers stack — Idena states are mutually exclusive at a point in
time, so `IdenaState#Newbie + #Human + #Verified = 9.737` is probably *not* simultaneously
attainable; worth confirming in the scorer code before citing that one.)

**Finding 3 — the knapsack (§1.6) is trivially solvable and someone already solved it.** A
community/analyst critique surfaced in search reports that "at least 44 points can be earned through
moderately simple sybil vectors (dupe social media accounts, low tier requirements for on-chain
activity)" and that "Holonym, Civic, and Coinbase are much more stout defenses against sybils than
ENS names, GTC holdings, or a Lens handle, yet this is not reflected in the scoring system"
(surfaced via [Delphi Digital, *Decentralized Identity: Gitcoin
Passport*](https://members.delphidigital.io/feed/decentralized-identity-gitcoin-passport) —
**secondary, paywalled, and I did not read the original**; treat the exact figure as `UNVERIFIED:`
but the structural claim is independently confirmed by the weight arithmetic above). The same
sources note that "before the Anti-Sybil Assembly program, there was little reason to strive for a
higher score once a user reaches 20" — i.e. **the published threshold created a mass point at 20**,
which is the strategic-classification result of §1.6 observed in the wild.

**Finding 4 — dead credentials linger in live weight tables.** `CivicCaptchaPass`,
`CivicLivenessPass` and `CivicUniquenessPass` (8.866 points combined from one Civic enrolment) are
still in the `main`-branch weights as of the 2026-01-06 commit, but Civic **sunset** CAPTCHA and IDV
on 2025-07-01 and Uniqueness and Liveness on 2025-07-31
(`research/landscape/identity-infra-prior-art.md`, citing
[Civic](https://www.civic.com/blog/an-update-on-civic-pass)). `UNVERIFIED:` whether the provider is
disabled elsewhere in the stack and the weight is merely vestigial. Either way the operational
lesson is ours to learn: **an aggregator's score silently changes meaning when an upstream provider
dies, and the weight table is the last place anyone looks.** We need a provider-liveness monitor and
an explicit "component retired" event in our score history.

**The deduplication rules — the most directly relevant published artefact in web3.**
([Human Passport docs, *Deduplicating
Stamps*](https://docs.passport.human.tech/building-with-passport/stamps/major-concepts/deduplicating-stamps),
retrieved 2026-07-24.) The mechanism:

- Each Stamp carries a **`hash` field** used as the dedup key.
- Policy is **LIFO**: *"if a Passport holder submits a Stamp that has already been submitted by
  another user, the duplicate Stamp is ignored and not counted towards the score."* First claimant
  keeps it; later claimants lose it.
- **Deduplication is scoped to a scoring instance, not global.** Verbatim: *"one user uses Passport
  holder A with one Twitter account in an application that uses scoring instance X, and another user
  uses the same Twitter account in a distinct Passport in an independent scoring instance Y. In this
  case, both users will get scored for the Twitter account."*

Three things follow, and they are load-bearing for our design:

1. **The aggregator, not the provider, is where cross-provider collision gets resolved** — and it is
   also where the user-facing unfairness lands. A legitimate user who shares a device or re-verifies
   from a new wallet can *lose* a stamp to whoever claimed it first. We will inherit this exact
   support burden, and we should decide the policy deliberately rather than defaulting to
   first-come-first-served, which is the policy that most rewards automation.
2. **Their dedup is intra-provider only** (same stamp hash), so it does not touch our hard case at
   all: two *different* providers reading one passport produce two different hashes and dedup never
   fires. Passport's model has **no answer** to the ZKPassport/Self/Rarimo/World-document collision.
   Saturation (§1.5) does, without needing linkability.
3. **Per-instance scoping is a deliberate privacy/linkability trade** and the same one we face in §6:
   global dedup is stronger sybil resistance and worse privacy. Passport chose privacy-ish and
   accepted cross-instance multi-counting. We should make that a *verifier-selectable* parameter and
   price it, not a silent default.

**Verdict.** Published: yes, unusually fully. Gameable: yes, demonstrably, and the weight file itself
is the proof. Survived: as a product, barely — acquired by Holonym Foundation for ~$10M in Feb 2025
with >2M users, >35M credentials and under $1M revenue (`research/landscape/identity-infra-prior-art.md`).
**Their scoring model is the single best "what not to do" specification available**, and it is free.

### 4.2 Trusta Labs — MEDIA score and TrustScan

Two products
([docs](https://trusta-labs.gitbook.io/trustalabs/trustgo/media-scoring-methodology),
[TrustScan](https://trusta-labs.gitbook.io/trustalabs/trustscan/introduction-to-sybil-score-and-media-score),
retrieved 2026-07-24):

- **MEDIA** — five dimensions of on-chain activity with a published point budget: Monetary (25),
  Engagement (30), Diversity (15), Identity (10), Age (20) = 100. Each dimension is a *weighted sum
  of variables within it*, i.e. additive at both levels.
- **TrustScan / Sybil Score** — 0–100 (higher = more sybil risk), built on **Asset Transfer Graphs**
  and four named structural patterns: star-like transfer graph, chain-like transfer graph, bulk
  operations, similar behaviour sequences. Coverage Ethereum + zkSync, Arbitrum, BNB, Optimism.

**Assessment.** MEDIA is a pure behavioural score with **no personhood root whatsoever** — it says
"this wallet behaves like an established user", which is exactly the *cheaply manipulable* feature
class of §1.6, and its "Identity" dimension is 10 of 100 points. Publishing the dimension weights
makes the knapsack easy. TrustScan is more interesting because it is **structural**: the four
patterns are motifs of funding topology that a farm must produce to fund N wallets, and topology is
harder to fake than volume (though CEX-hop laundering and randomised funding delays are the standard
evasions, and they are well known).

For us the usable part is TrustScan-style **cluster detection as a negative signal**, not MEDIA as a
positive one. Note the asymmetry: behavioural evidence is much better at *refuting* independence
(these 400 wallets were funded by one address in one block) than at *establishing* personhood.
**Behavioural signals belong on the `¬C` side of the ledger, as disqualifiers, not as points.**
Passport weights the whole `TrustaLabs` stamp at 0.511, which is roughly the right order of
magnitude as a positive signal, and misses that it is worth far more as a negative one.

### 4.3 Nomis, ARCx, Spectral — the DeFi-creditworthiness cluster

These solve a *different* problem (repayment risk of an address) and get cited as personhood prior
art mostly by confusion, but they are worth one paragraph because their fate is instructive.

- **ARCx** — "DeFi Credit Score" driving dynamic max-LTV loans on Polygon
  ([wiki](https://wiki.arcx.money/application/defi-credit-score)). Score derived from historical
  on-chain borrowing behaviour. `UNVERIFIED:` current operational status; the wiki and leaderboard
  are still reachable but I did not confirm live loan activity.
- **Spectral Finance** — originally MACRO, an on-chain credit score, **has pivoted to "onchain agent
  economy" / machine-intelligence products** (secondary:
  [Greythorn/Medium](https://medium.com/@0xgreythorn/spectrals-inference-powered-web3-vision-a1019d52720f)).
  A pivot away from credit scoring is the single most common outcome in this cluster.
- **Nomis** — `UNVERIFIED:` I did not confirm current status in this pass. Next step: check the
  Nomis app/docs and GitHub commit recency directly.

**The lesson, and it is the same lesson as §2.6.** These scores have the one thing we lack — a real
label (did the address repay?) — and they *still* mostly failed, because the addresses are
pseudonymous and unbanked-by-design: a defaulting borrower simply abandons the address. **Score
persistence requires that the subject cannot cheaply abandon the subject-identifier.** That is a
prerequisite our whole product depends on and should be stated openly: a humanity score attached to
a discardable address is worth roughly what a credit score attached to a discardable address is
worth. This is a strong argument for anchoring on credentials with a **persistent, non-transferable
root** (biometric registry, document nullifier) rather than on address behaviour, and an argument
against making address-behavioural signals a meaningful share of the score.

### 4.4 Karma3 Labs / OpenRank — EigenTrust, productised

OpenRank is an EigenTrust-derived reputation protocol ($4.5M seed led by Galaxy and IDEO CoLab,
announced March 2024; [CoinDesk press release,
secondary](https://www.coindesk.com/press-release/2024/03/03/karma3-labs-raises-a-45m-seed-round-led-by-galaxy-and-ideo-colab-to-build-openrank-a-decentralized-reputation-protocol)).
Open-source core: [`Karma3Labs/go-eigentrust`](https://github.com/Karma3Labs/go-eigentrust) ("EigenTrust
implementation in Go") and [`openrank-sdk`](https://github.com/Karma3Labs/openrank-sdk).

**Status check (GitHub org repo push dates, retrieved 2026-07-24):** the org is *active* but has
drifted away from generic reputation infrastructure — most-recently-pushed repos are `farcaster-graph`
(2026-04-01), `sentiment-rank` (2026-03-31), `reclaim-polymarket` (2026-03-17), `x-post-viewers`
(2026-02-12), `karmalaunch-evm` (2026-01-30), `eigencaster` (2025-12-12). The core
`go-eigentrust` engine was last pushed **2025-08-31**. Read as: the algorithm is stable/finished, and
the company's energy is in **Farcaster-specific ranking and social/consumer products**, not in a
general-purpose personhood reputation layer.

**Aggregator relevance.** The Farcaster social graph via OpenRank is a genuinely usable
*social-trust* input for a specific population, and it is EigenTrust so it inherits the seed-set
problem of §5.4. It is not personhood: Farcaster accounts are purchasable and the graph is farmable
(follow-farming is an established practice). Treat as a **low-weight social-trust signal for the
Farcaster subpopulation**, not as a root.

### 4.5 The pattern across all of them

Every web3 scoring attempt above shares three properties, and each is a lesson:

| Property | Instances | Lesson |
|---|---|---|
| **Additive over correlated features** | Passport (`Σ wᵢ`), Trusta MEDIA (weighted sums at two levels) | The entire category made the §1.1 error |
| **Published weights + published threshold** | Passport (20), Trusta (100-point budget) | Solve the knapsack for them, or they will |
| **Behavioural signals treated as positive evidence** | Trusta MEDIA, Passport's ETH/NFT/zkSync families, Nomis/ARCx/Spectral | The cheapest root gets the most points; put behaviour on the negative side |

And one absence worth naming: **no web3 scorer in this set publishes a calibration claim, an
uncertainty estimate, or a formal adversary model.** Not one. That is either an indictment of the
category or an opening for us; probably both.

## 5. Graph-based trust propagation

This is the only branch of the prior art that produces **theorems** rather than heuristics, so it
deserves careful treatment — including of why the theorems are weaker in practice than they read.

### 5.1 The two families

**(a) Random-walk / spectral: EigenTrust, TrustRank, personalised PageRank, SybilRank.**

EigenTrust (Kamvar, Schlosser, Garcia-Molina, WWW 2003) normalises local trust `c_ij` into a row-
stochastic matrix `C` and iterates to the principal eigenvector, with a **pre-trusted seed
distribution `p`** injected to guarantee convergence and break out of malicious collectives:

```
t^(k+1) = (1 − a)·Cᵀ t^(k)  +  a·p
```

which is personalised PageRank with teleport vector `p`, and TrustRank (Gyöngyi, Garcia-Molina,
Pedersen, VLDB 2004) is the same construction for web spam. SybilRank (Cao, Sirivianos, Yang,
Pregueiro, NSDI 2012, deployed at Tuenti) is an early-terminated power iteration from seeds with
degree normalisation, ranking rather than thresholding.

The essential structural fact: **`a·p` is the entire security argument.** Without the teleport, a
tightly-knit sybil collective is a perfectly good eigenvector and scores itself arbitrarily high.
Everything these algorithms guarantee is inherited from the seed.

**(b) Flow-based: SybilGuard, SybilLimit, SumUp, and Circles.**

Flow methods bound the adversary by the **min-cut between the sybil region and the honest region**,
which is at most the number of **attack edges** — honest→sybil trust relationships the attacker had
to socially engineer. The published bounds:

| Scheme | Guarantee |
|---|---|
| SybilGuard (SIGCOMM 2006) | accepts `O(√n log n)` sybils **per attack edge** |
| SybilLimit (IEEE S&P 2008 / ToN 2010) | `O(log n)` sybils per attack edge — near-optimal against the `Ω(1)` lower bound ([paper](https://www.cs.yale.edu/homes/aspnes/pinewiki/attachments/SybilAttack/sybillimit.pdf)) |
| SumUp (NSDI 2009) | adaptive **max-flow** vote aggregation; bounds bogus votes collected per attack edge |

The key qualitative property, and the reason this family is the right one: **the bound does not
depend on how many sybils the attacker creates.** Minting a million fake nodes does not increase
flow across a cut of fixed capacity. Cost scales with *social work*, not with compute or capital.

### 5.2 Circles' relative sybil resistance — the strongest formal result in our whole research set

From the Circles whitepaper (Köppelmann, Boes, Ernst, v2.2.1, §4.2–4.3,
<https://whitepaper.aboutcircles.com/>; analysis in `research/protocols/circles.md`).

**Transferable trusted balance.** For sender set `N_s`, receiver set `N_r`, network state `S`:

```
T(N_s → N_r | S)  :=  max_{S' : S →_{N_s} S'}  B(N_s → N_r | S')
```

— "the maximal achievable amount of CRC, trusted by at least one account in `N_r`, that accounts in
`N_s` can obtain by transitive transfers from state `S`". Mechanically this is **max-flow over the
trust graph with capacities given by actual CRC balances**. It is not an analogy for a trust score;
it is the protocol's native measure of embeddedness, and it is computed in production by the
pathfinder (`circlesV2_findPath`, `findMaxFlow`).

**The theorem (§4.3, boxed).** Let `M` = accounts controlled by the malicious party, `F` = the
"fooled" accounts that trust at least one account in `M`, `R` = the rest of the network. Then:

```
T(M → R | S)  ≤  B_T(F → R | S)
```

**In words: no matter how many sybils the attacker mints, or how densely those sybils trust each
other, the attacker's economic reach into the honest network is bounded by the trusted balance held
by the boundary set `F` — the humans they actually fooled.** Sybil creation is free and worthless;
only social work counts. This is the min-cut-over-attack-edges result of the SybilLimit/SumUp
literature, restated in economic units, proved by the protocol's own authors, and — uniquely in our
research set — **implemented in a live production service**.

**Why it is the strongest result we have.** Every other protocol in the roster asserts uniqueness by
authority (a registry says so) or by ceremony (a scan happened). Circles asserts a *bound*, and the
bound is (i) unconditional in the number of sybils, (ii) computable by us permissionlessly from
on-chain `Trust` logs and balances, and (iii) degrades gracefully to a real number rather than a
boolean.

**How far does it generalise beyond Circles?** Honestly: *the theorem does not generalise; the
pattern does.* Precisely:

- The proof depends on Circles' specific transfer semantics — flow is limited by *trusted balances*,
  and trust is a directed willingness to accept a specific personal currency. There is no
  corresponding conserved quantity across World ID + a passport proof + a KYC attestation, so there
  is nothing to take a max-flow of. **You cannot state a multi-protocol version of the theorem
  because there is no multi-protocol graph.**
- What *does* generalise is the **shape of the guarantee**, and we should adopt it as our target:
  *express the security of the aggregate as a bound on adversary reach per unit of irreproducible
  work*, rather than as a probability of humanity. Our root-cost model (§1.3, §7) is precisely that
  translation — attack cost is the conserved quantity that *is* commensurable across protocols, and
  min-cost-set-cover over roots is the analogue of min-cut over attack edges.
- Two real caveats on the Circles number itself, both from our own protocol write-up: flow is
  **balance-capped, not purely structural** (a rich sybil that has been gifted CRC scores high, a
  poor well-trusted human scores low), so we should compute the **unit-capacity** version alongside
  it — pure-structure max-flow = number of edge-disjoint trust paths = min number of attack edges,
  which is the cleaner sybil metric. And Circles' resistance is explicitly **relative**: the
  whitepaper concedes "the absence of gatekeeping or KYC mechanisms in principle allows users to
  create several accounts", and defines an honest user as one who uses a *single* account. Circles
  dilutes multi-accounting economically; it does not prevent it. For a currency that is sufficient.
  For a personhood aggregator it is not, because **we are exactly the party that "cares about" the
  sybil's otherwise-worthless tokens** — we would be re-introducing an advantage the currency
  withholds.

### 5.3 What the graph literature learned the hard way — three negative results

1. **All of these schemes are secretly the same algorithm, and it is community detection.**
   Viswanath, Post, Gummadi & Mislove, "An Analysis of Social Network-based Sybil Defenses", SIGCOMM
   2010 ([ACM](https://dl.acm.org/doi/10.1145/1851182.1851226),
   [PDF](http://ccr.sigcomm.org/online/files/p363.pdf)): *"despite their considerable differences,
   existing Sybil defense schemes work by detecting local communities (i.e., clusters of nodes more
   tightly knit than the rest of the graph) around a trusted node."* Consequences: they inherit
   community detection's failure modes, they can be *replaced* by off-the-shelf community detection,
   and — the sting — **they will happily classify a legitimate, loosely-connected community as
   sybil.** For a global personhood product that is a fairness disaster waiting to happen: the
   "sybil region" and "the Global South cohort onboarded last month by one field team" have the same
   graph signature.
2. **Real social graphs are not fast-mixing**, which is the assumption every random-walk bound rests
   on (Mohaisen, Yun & Kim, "Measuring the mixing time of social graphs", IMC 2010). The theorems are
   true; their preconditions are frequently false in the wild. `UNVERIFIED:` I did not re-read this
   paper in this pass — cite it only after checking the specific graphs measured.
3. **Targeted attacks beat them.** Alvisi, Clement, Epasto, Lattanzi & Panconesi, "SoK: The Evolution
   of Sybil Defense via Social Networks", IEEE S&P 2013, show that an attacker who *chooses where to
   attach* (rather than attaching randomly) defeats schemes that hold up against random attachment.
   `UNVERIFIED:` cite after re-reading. The intuition is sound and matches the Idena evidence: a
   real-world attacker does not add random edges, they **recruit** — and a puppeteer paying $2–4 per
   validation ceremony is buying attack edges wholesale from genuinely well-connected humans.

### 5.4 The seed-set problem — the recurring practical failure, and it is *our* problem specifically

Every method in §5.1 requires a trusted seed: EigenTrust's `p`, TrustRank's seed pages, SybilRank's
trusted nodes, our `T(user → Seed)` for Circles. Three observations:

1. **The seed is the trust root, and it is unavoidable.** No graph algorithm manufactures trust; they
   all *propagate* it. The security of the whole construction is the security of the seed.
2. **Choosing the seed by another credential re-introduces exactly the correlation we are trying to
   remove.** If we seed the Circles graph with "avatars holding a World ID Orb verification", then
   our Circles score is no longer independent evidence — it is a function of World ID, and its
   loading on `Z_iris` is large. We would be measuring the same root twice and congratulating
   ourselves on diversity. **This is the trap, stated plainly, and it is easy to walk into because
   credential-based seeding is the most convenient seeding method available.**
3. **Practical resolutions**, in decreasing order of preference:
   - **Seed from physical-world events we can independently attest**: in-person meetups, long-lived
     local groups, curated organisations with off-chain identity (Circles has curated groups; Idena's
     "solo accounts and family pools with strong social ties" were the *surviving* honest core in
     Ohlhaver's data). Loads on no protocol root.
   - **Seed from longevity + the absence of cluster signatures**, i.e. negative-evidence seeding.
     Weaker, but at least orthogonal to credentials.
   - **Seed from a credential, but then explicitly set the loading `λ` between the graph score and
     that credential's root to ~1** — i.e. accept the correlation and *price* it rather than pretend
     it away. This is the fallback, and the factor model makes it a one-line change instead of a
     silent bug.
   - **Multi-seed with disjointness auditing**: compute the score from several seed sets chosen to
     share no root, and take the **minimum**. Minimax again (§1.6), and it turns the seed problem
     into a diversity requirement we can state and check.

### 5.5 The puppeteering result destroys the graph frame's *interpretation*, not its math

Ohlhaver & Nikulin's Idena finding (`research/references/ohlhaver-ethberlin-2024-transcript.md`)
lands directly here and is worth restating in graph terms. At the May 2022 peak, **23 entities
(<1% of distinct entities) controlled ≥40% of accounts and almost half of rewards**; all 31 pools
that ever exceeded 100 accounts showed signs of **third-party private-key access**, *including after*
on-chain delegation removed the operational need for key access.

The graph-theoretic reading: **the attacker did not need attack edges, because the "sybils" were
genuine, well-embedded honest nodes whose keys they held.** Flow-based bounds are bounds on
*relationships*, and the puppeteer bought *control* without changing the relationship graph at all.
Every honest-graph assumption in §5.1 survives; the mapping from "node" to "independent agent" is what
fails. Two design consequences:

- **Trust-graph position measures `U` and social embeddedness, and says nothing about `C`.** A
  puppet's Circles max-flow is genuinely high, and correctly so — they really are trusted by their
  community. Our score must not read that as independence.
- **The signals that *did* detect puppeteering were behavioural, not structural**: synchronous or
  sequential transactions across accounts, one-way reward sweeps to a common address, and — the
  detail I find most instructive — Ohlhaver's *negative-space* argument that the **absence of
  marketing, disputes and customer complaints** was itself evidence that these were not accountable
  custody relationships. That is a genuinely novel evidence type ("this market is too quiet to be
  legitimate") and it has no equivalent in any scoring formalism in this document. Worth remembering
  when we are tempted to believe our feature set is complete.

## 6. Privacy composition

The README's requirement — "the aggregate must leak less than the sum of its parts" — is achievable,
but only because of a specific structural fact: **a score is a low-entropy function of a
high-entropy input.** Everything below is an elaboration of that.

### 6.1 Quantifying the leak: anonymity-set shrinkage is brutal and fast

Model a population of `N = 10⁶` aggregator users, each credential `i` held independently with
prevalence `qᵢ`. Revealing the full possession vector `x` costs `−log₂ P(x)` bits; the expected
anonymity set is `N · P(x)`. With illustrative prevalences (World ID Orb 12%, ZKPassport 5%,
Circles 2%, Coinbase 25%, Binance BABT 8%, GitHub-120d 6%, Idena 0.3%, Humanity palm 1%,
Google 55%, ENS 18% — **illustrative, not measured**):

| Disclosed credential set | `P(vector)` | bits | E[anonymity set] |
|---|---|---|---|
| {Google} | 2.4 × 10⁻¹ | 2.1 | 236,546 |
| {Google, Coinbase} | 7.9 × 10⁻² | 3.7 | 78,849 |
| {Google, Coinbase, ENS, GitHub-120d} | 1.1 × 10⁻³ | 9.8 | 1,105 |
| {World ID, Coinbase, Google} | 1.1 × 10⁻² | 6.5 | 10,752 |
| **{World ID, ZKPassport, Circles, Idena}** | 8.5 × 10⁻⁸ | **23.5** | **0.085** |
| {World ID, ZKPassport, Circles, Idena, palm, BABT} | 7.5 × 10⁻¹¹ | 33.6 | ~0 |

Identifying one person in `10⁶` requires **19.9 bits**. So:

- **Four credentials are enough to be globally unique** — if they are *rare* ones. And note the cruel
  inversion: **the users with the strongest humanity evidence are the most identifiable.** The user
  who did the most work to prove they are a real human is the one whose credential vector is a
  fingerprint. Any product that rewards credential breadth is a deanonymisation engine pointed at its
  best users.
- The **mean** entropy of the possession vector is only 4.28 bits, which is exactly why averages are
  the wrong statistic here. The tail is where the harm is, and the tail is where our high scores are.

**Now the good news, and it is the whole argument for shipping a score rather than a bundle:**

| Release | Max leak |
|---|---|
| Full credential vector (10 credentials) | up to **33.6 bits** (observed above) |
| Integer score in 0–100 | ≤ **6.66 bits** (and ~4–5 in practice, given the real distribution) |
| Single threshold bit `S ≥ T` | ≤ **1.00 bit** |

**The aggregate genuinely does leak less than the sum of its parts — by 20 to 30 bits — provided the
components are never revealed.** That is the privacy case for our product stated numerically, and it
is a strong one. It also immediately implies the design constraint: **the moment we return an
itemised list of contributing attestations "for explainability", we have given back all 30 bits.**
The reason-code design of §2.3 and §3.3 must therefore be *categorical* ("1 of 6 root families
present"), never itemised, on the verifier-facing path.

### 6.2 The fundamental tension: dedup scope *is* linkability scope

**Proposition.** For any credential system, the set of contexts across which two presentations can be
recognised as deriving from one root is *exactly* the set of contexts across which sybil
deduplication is possible. Cross-context sybil resistance and cross-context linkability are the same
quantity measured with different signs.

This is not a limitation of current engineering; it is what dedup *means*. And it explains, cleanly,
every design split in our roster:

| Scoping choice | Dedup reach | Linkability | Examples (from `research/protocols/zk-passport-and-eid.md`) |
|---|---|---|---|
| **Global nullifier** | universal | universal — a permanent pseudonymous identifier for that document, on-chain, forever | Self, Rarimo (per-document, unscoped, published) |
| **App/service-scoped** | none across apps | none across apps | ZKPassport (never publishes an unscoped value); World ID's per-app nullifiers |
| **Neighbouring-field hash** | partial/accidental | partial | World's document tier |
| **Instance-scoped** | within one verifier | within one verifier | Human Passport's per-scoring-instance dedup (§4.1) |

The escape hatch is the interesting part, and it is our business model: **a trusted aggregator is a
mechanism for holding linkability so that verifiers do not have to.** We can dedup globally across
our own customer base while each verifier learns only a boolean. That is a real, defensible service
— and it is also a concentration of exactly the data that makes us a target. The strong version,
which I think should be on the roadmap even if not in v1, is to **remove ourselves from the trust
assumption**: 
- **Oblivious PRF / private set intersection** on nullifiers, so we learn "this nullifier is or is not
  already registered" without learning the nullifier (the standard construction behind
  compromised-password checking, e.g. `k`-anonymity + OPRF as in HIBP's range API and Cloudflare's
  password-check protocol).
- **Rate-Limiting Nullifiers (RLN)** / Semaphore-style constructions, where exceeding a per-epoch
  quota reveals a secret share and slashes, giving sybil resistance *without* a persistent identifier.

`UNVERIFIED:` I have not costed an OPRF-based nullifier registry at our expected volumes; that is an
engineering spike, not a research question, but it should be done before promising it.

### 6.3 ZK proof of threshold satisfaction — the key product primitive, with its sharp edge

The primitive: prove `Σᵢ wᵢ xᵢ ≥ T` (or, in our model, prove the root-cost aggregate clears `T`)
**without revealing which credentials contributed**. Concretely: we issue a signed commitment to the
user's credential/root vector; the user proves in ZK that the committed vector, evaluated against a
committed weight table, clears a verifier-chosen threshold. The verifier learns one bit. This is
mature, cheap circuitry — a Merkle inclusion proof plus a weighted sum plus a comparison — and it is
the single highest-leverage thing we could build.

Two design details that decide whether it actually works:

1. **The weight table must be committed and versioned** (a published Merkle root per score version),
   or the verifier cannot trust the claim. Note that this is *not* the same as publishing the
   weights: we can commit to a table, prove statements about it, and publish only its root plus an
   audited description. That is the technical mechanism for the asymmetric disclosure of §3.3 — it
   gives verifiability without gameability, which is otherwise an uncomfortable circle to square.
2. **Threshold proofs compose badly, and this is the sharp edge.** A single proof at threshold `T`
   leaks ≤ 1 bit. But an adversarial verifier who can request proofs at thresholds of its choosing
   performs **binary search** and extracts the full score in `⌈log₂(range)⌉` queries — ~7 queries for
   a 0–100 score. Mitigations, all of which must be designed in from the start:
   - **Bind the proof to a verifier-scoped nullifier** so repeat queries are detectable and
     rate-limited.
   - **Quantise thresholds** to a small published set (e.g. 5 bands), capping the extractable
     information at `log₂(bands)`.
   - **Fresh randomness per epoch** so historical proofs cannot be pooled.

### 6.4 Differential privacy over score release — useful, but not for the thing people assume

Be precise about what DP can and cannot do here, because this is routinely overclaimed:

- **DP protects aggregate statistics**, not an individual's disclosure to a counterparty they are
  transacting with. Publishing "the distribution of scores by country" with `(ε, δ)`-DP is sound and
  we should do it (it is also how we would publish the calibration data of §3.2 without leaking).
- **DP on a per-user score is randomised response**, and it directly trades sybil resistance for
  privacy: noise of scale `Δ/ε` on the score means an attacker below the threshold passes with
  positive probability. Worse, **naive noise is defeated by retry** — query `k` times, average, and
  the noise shrinks as `1/√k`. The fix is standard but must not be forgotten: **sample the noise once
  per (user, verifier, epoch) and memoise it**, so repeated queries return the identical noisy value.
  With memoisation, per-user DP noise is actually *desirable* for a different reason — it is the
  randomised threshold of §1.6, which prevents optimisation to exactly `T`. **The privacy mechanism
  and the anti-gaming mechanism are the same mechanism.** That is a genuinely nice result and I would
  build on it.
- **Composition is the killer over time.** Each release of a user's score spends privacy budget; a
  score that is queried continuously leaks continuously. Budget per user per epoch, and say so in the
  API.

### 6.5 Anonymous credentials and selective disclosure — what is actually available

| Scheme | Selective disclosure | Unlinkable multi-show | Notes for us |
|---|---|---|---|
| **BBS+ / BBS signatures** | yes | **yes** | The right primitive. Being standardised for W3C VC Data Integrity; the only mainstream option with unlinkable multi-show. |
| **CL signatures / Idemix / AnonCreds** | yes | yes | Mature (Hyperledger), heavier, RSA-based; deployed in the Sovrin/Indy world. |
| **SD-JWT (+ SD-JWT VC)** | yes | **no** | Salted-hash disclosure over a *reused issuer signature*: presentations are trivially linkable unless the issuer batch-issues one-time credentials. This is the pragmatic-but-linkable option, and it is what most of the eIDAS2/EUDI stack actually ships. |
| **mdoc / ISO 18013-5 mDL** | yes | no (same reuse issue) | Same caveat; batch issuance is the mitigation everyone hand-waves at. |

The practical warning: **"selective disclosure" is routinely marketed as if it implied unlinkability,
and for SD-JWT and mdoc it does not.** If our score consumes a state eID credential presented over
SD-JWT, that presentation is linkable across verifiers even though only the requested attributes were
revealed. See `research/landscape/eidas2-eudi-wallet.md` for the standards detail; the scoring-side
consequence is that some inputs to our score carry a linkability cost we cannot remove, only
*absorb* — one more reason the aggregator should be the only party that ever sees them.

### 6.6 The synthesis for our design

Three rules, all of which fall out of the above:

1. **Verifiers get a band or a bit, never a vector.** 1–6.7 bits instead of 20–34.
2. **Reason codes are categorical and root-shaped, never itemised.** "1 of 6 root families" leaks
   ~2.6 bits; "World ID + ZKPassport + Circles + Idena" leaks 23.5.
3. **Whatever linkability the system needs, concentrate it in one place, minimise it, and put it on a
   path to removal** (OPRF/PSI, RLN). The concentration is the product; the removal is the roadmap.

## 7. Recommended scoring architecture
## 8. Worked toy example
## References
