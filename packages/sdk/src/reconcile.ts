/**
 * Reconciling an index against a chain head.
 *
 * The bug this file exists to kill: probing the contract for *whether* a credential is held
 * and the index for *when* it was issued is a torn read. When the contract says held at
 * chain head but the index has not seen the credential yet, the old code returned
 * held-with-unknown-age, and unknown age on a `Ramp` curve scores at the 0.5 midpoint. So
 * index lag silently moved scores — and moved them upward for exactly the fresh cohort the
 * ramp exists to discount. Making our index lag was a cheap way for an attacker to buy 0.5
 * weight on a week-old registration worth ~0.02.
 *
 * The fix is to stop treating the two reads as one. Each read is a statement about a
 * *named block*: the index knows the world as of the block it reports, and the contract read
 * knows it at head. Absence in the index is only informative when the index has complete
 * history for that credential — and then it is genuinely informative, because "not present
 * at block B" means "created after block B", which bounds the credential's age from above.
 * Where the index cannot see the credential's history at all (a windowed data source), the
 * fallback is the contract read exactly as before, and it says so.
 *
 * Nothing here does I/O; it is the decision table, so every branch is unit-testable without
 * a network. The rule it encodes:
 *
 *   - the chain decides whether a credential is held *now* (a revocation must not be
 *     invisible for as long as the index lags)
 *   - the date comes from the most authoritative source available: the contract when the
 *     protocol exposes one, else the index at its named block, else a bound derived from
 *     the index's own absence, else nothing — and which one it was is always reported
 *   - a disagreement is never averaged away or silently resolved; it is flagged
 */

/** Where a piece of the answer came from. Every result carries one of these. */
export interface ProbeProvenance {
  /** Which source decided `held`. */
  heldFrom: 'chain' | 'index'
  /**
   * Which source dated the credential. The two `-bound` values mean the date is not known but
   * is bounded from below: `index-absence-bound` because the credential was absent from a
   * complete index at `indexedBlock`, so it was issued after that block's timestamp;
   * `index-side-event-bound` because the index holds the credential only through an event that
   * provably preceded its issuance, so it was issued after *that*.
   */
  dateFrom: 'chain' | 'index' | 'index-absence-bound' | 'index-side-event-bound' | 'none'
  /** Block the index had reached. Present whenever the index answered at all. */
  indexedBlock?: number
  /** Timestamp of `indexedBlock`, when it could be established. */
  indexedBlockTimestamp?: number
  /** Chain head the freshness check was taken at. */
  headBlock?: number
  /** Everything the caller should know about how this answer was reached. */
  notes: ProvenanceNote[]
}

/**
 * Conditions worth surfacing. Each maps to a caveat on the result — the point of the
 * inversion is that a degraded read is loud, not that it never happens.
 *
 * Most of these are about reconciling an index against a chain, and are produced here. The
 * last two are not: they are things a probe can only learn from the protocol it reads, and
 * they live in the same vocabulary because they answer the same question — *how far can this
 * date be trusted?* — and because carrying them here gets them the same caveat plumbing.
 */
export type ProvenanceNote =
  /** No index view was supplied at all. Held and date come from the contract alone. */
  | 'index-unavailable'
  /** An index *was* configured and did not answer — an operational fault, not a choice. */
  | 'index-unreachable'
  /** The index answered but cannot see this credential's history (windowed data source). */
  | 'index-outside-coverage'
  /** Held on chain, absent from an index with complete history: age is bounded, not unknown. */
  | 'credential-not-yet-indexed'
  /** The index has it, the chain does not: revoked, expired or transferred since the index. */
  | 'credential-ceased-since-index'
  /** The index's date came from a side-event, so it is a lower bound on age, not the date. */
  | 'index-date-is-lower-bound'
  /**
   * The index's date came from a side-event that provably happened *before* issuance (a vouch is
   * cast on a claim that has not resolved yet), so it does not date the credential at all — it
   * bounds it. Using it as the date would make the credential look older than it is, and on a
   * survival ramp older is worth more, so this is the one direction that pays an adversary.
   */
  | 'index-date-precedes-issuance'
  /** Index and contract disagree about the issuance date by more than the tolerance. */
  | 'index-date-disagrees-with-chain'
  /** The contract read failed, so nothing confirms the index's state is still current. */
  | 'freshness-check-unavailable'
  /**
   * The credential's date is the block a successor deployment imported it in, not the block it
   * was issued in — so the credential is older than its date and its ramp weight is a floor.
   */
  | 'date-from-registry-import'
  /**
   * The credential is transferable and has changed hands, so it is dated from when the current
   * holder acquired it rather than from when it was created.
   */
  | 'credential-transferred-since-issuance'
  /**
   * The protocol publishes an expiry and no issuance date, and caps a credential's term. The
   * date is `expiry - that cap`: the earliest issuance the credential can have, so on a decay
   * curve the credential is at most this old and its weight here is a floor.
   */
  | 'date-from-expiry-and-max-term'
  /**
   * The credential is a renewable on-chain attestation, and the date is the most recent renewal
   * rather than the underlying enrolment — which the protocol keeps off chain, or overwrites.
   * The subject was enrolled before this date, so the weight it produces is a bound in whichever
   * direction the curve runs: a ceiling under `Decay`, a floor under `Ramp`.
   */
  | 'date-from-latest-reattestation'
  /**
   * The credential is held through a registry that records a binding and never an expiry, so the
   * date is the block that registration was mined in — the moment the protocol last accepted a
   * proof for this address. The enrolment behind it is older and is not published, so the weight
   * is a ceiling under `Decay` and a floor under `Ramp`, exactly as for a re-attestation.
   */
  | 'date-from-agent-registration'
  /**
   * The credential is not held now and the registry keeps the term of the binding that ended, so
   * the date is the start of a *closed window* — `heldUntil` is its other end. It dates nothing
   * about today, and exists so an as-of score can decide whether an instant falls inside a
   * credential the subject has since lost. Nothing at head weighs it: the credential is absent.
   *
   * Three registries produce it, and every one of them is a registry that declines to delete:
   * `WorldIDAddressBook` keeps a lapsed `addressVerifiedUntil` forever, PoH v1 never clears
   * `submission.registered` when a term runs out, and PoH v2 leaves `owner` and `expirationTime`
   * on an expired humanity. A protocol that erases the ending instead cannot produce this note,
   * and its credentials stay invisible to an as-of score — which is the honest outcome, not a
   * gap to paper over.
   */
  | 'date-from-lapsed-verification'
  /**
   * The credential has a dated ending and no usable start, so the window cannot be closed and
   * an as-of score can prove nothing about it. Reported rather than absorbed: a subject whose
   * evidence is excluded for want of a date should be told which credential and why.
   */
  | 'lapsed-credential-start-undated'

/** What the index says about one credential, as of the block it names. */
export interface IndexView {
  /** Block the index had reached when this read was taken. */
  block: number
  /** Timestamp of that block, when it could be established. */
  blockTimestamp?: number
  /**
   * The credential as the index has it, or `null` when the index reached `block` and has no
   * such credential. The distinction is the whole fix: `null` is a fact about the world,
   * an unreachable index is not.
   */
  entity: IndexedCredential | null
  /**
   * True when the index has complete history for this credential class from the protocol's
   * first block, so `entity: null` really does mean "did not exist at `block`". False for a
   * windowed data source, where absence means nothing at all.
   */
  completeHistory: boolean
}

export interface IndexedCredential {
  /** Issuance time as the index reports it. */
  issuedAt: number
  /**
   * True when the index observed the issuance event itself. False when the entity was
   * materialised as a side effect of another event (a vouch, a trust edge), in which case
   * `issuedAt` is that event's timestamp rather than the issuance.
   */
  issuanceObserved: boolean
  /**
   * Which side of the real issuance an unobserved `issuedAt` falls on. Only meaningful when
   * `issuanceObserved` is false, and the index that produced the view must be able to *prove*
   * it, because the two directions are handled oppositely:
   *
   * - `after-issuance` — the side-event cannot precede issuance. A Circles trust edge on an
   *   avatar whose registration was never indexed is one: the registration handler overwrites
   *   the date, so an unobserved registration is necessarily older than the indexed range.
   *   The date understates age, which understates weight on a ramp, so it is usable as a floor.
   * - `before-issuance` — the side-event cannot follow issuance. A PoH vouch is cast on a
   *   request that has not resolved, so with complete history an unobserved claim is one that
   *   had not happened yet. The date would *overstate* age, so it is not used as a date at all;
   *   it becomes a lower bound on issuance (`issuedAfter`), which caps ramp weight instead of
   *   granting it.
   *
   * Absent means the direction is unknown, which is treated as `before-issuance`: the safe
   * reading of a date nobody can place is the one that cannot inflate a score.
   */
  sideEventOrder?: 'after-issuance' | 'before-issuance'
  /** The index believes the credential has ended: revoked, stopped, expired. */
  ended: boolean
}

/** What the contract says at chain head. This is the freshness check. */
export interface ChainView {
  held: boolean
  /**
   * Issuance time when the protocol exposes one on chain. Authoritative: it is read at head
   * and needs no indexer. PoH v2 gives this up as `expirationTime - humanityLifespan`.
   */
  issuedAt?: number
  /**
   * The instant the contract says this credential stopped counting, for a credential it says is
   * *not* held now — a term that ran out, an expiry that passed. Only ever a number the protocol
   * stores; never inferred from absence. Together with `issuedAt` it closes a window an as-of
   * score can decide membership of, which is the only thing that reads it.
   */
  heldUntil?: number
  block?: number
  /** Set when the contract read itself failed. */
  unavailable?: boolean
}

export interface Reconciled {
  held: boolean
  issuedAt?: number
  /** See `ChainView.heldUntil`. Passed through untouched: nothing here infers an ending. */
  heldUntil?: number
  /**
   * Lower bound on issuance: the credential provably did not exist at this time. Set only
   * when the exact date is unknown. Scoring uses it as an upper bound on age, which on a
   * survival ramp is a *cap* on weight — never a grant.
   */
  issuedAfter?: number
  provenance: ProbeProvenance
  /** Set when neither source could answer. The caller reports it as an error, not a negative. */
  error?: string
}

/**
 * Dates from two sources never match to the second — the index stamps the block timestamp of
 * the event, the contract derives it from an expiry — so only a real disagreement should be
 * flagged. One hour is far below the resolution of any age curve in the ontology (the
 * shortest half-life is 90 days) and far above block-time jitter.
 */
export const DATE_AGREEMENT_TOLERANCE_SECONDS = 3600

/**
 * True when an unobserved index date cannot be used as a date, because it sits *below* the real
 * issuance and would therefore overstate the credential's age.
 *
 * The default matters: a missing `sideEventOrder` means nobody established the direction, and an
 * unplaced date is treated as the unsafe one. Only an index that can prove its side-events follow
 * issuance gets to have its date used, which is the reverse of the old behaviour — that assumed
 * `after-issuance` for every protocol, on an argument that happens to hold for Circles trust
 * edges and is false for PoH vouches.
 */
function datesFromBelow(entity: IndexedCredential): boolean {
  return entity.sideEventOrder !== 'after-issuance'
}

export function reconcileIndexAndChain(input: {
  chain: ChainView
  index?: IndexView
}): Reconciled {
  const { chain, index } = input
  const notes: ProvenanceNote[] = []
  const base = {
    ...(index ? { indexedBlock: index.block } : {}),
    ...(index?.blockTimestamp !== undefined ? { indexedBlockTimestamp: index.blockTimestamp } : {}),
    ...(chain.block !== undefined ? { headBlock: chain.block } : {}),
  }

  // ---- the freshness check failed. The index, if it answered, is all we have.
  if (chain.unavailable) {
    if (!index) {
      return {
        held: false,
        provenance: { heldFrom: 'chain', dateFrom: 'none', ...base, notes: ['index-unavailable'] },
        error: 'contract read failed and no index answered',
      }
    }
    notes.push('freshness-check-unavailable')
    if (!index.entity) {
      // Nothing says this subject holds the credential. Absence in the index is not a
      // negative unless the index can actually see the history, so this is an error rather
      // than a `false` — a failed probe must never read as "not a human".
      if (!index.completeHistory) notes.push('index-outside-coverage')
      return {
        held: false,
        provenance: { heldFrom: 'index', dateFrom: 'none', ...base, notes },
        error: 'contract read failed and the index has no record to fall back on',
      }
    }
    if (index.entity.ended) {
      return { held: false, provenance: { heldFrom: 'index', dateFrom: 'none', ...base, notes } }
    }
    if (!index.entity.issuanceObserved) {
      if (datesFromBelow(index.entity)) {
        notes.push('index-date-precedes-issuance')
        return {
          held: true,
          issuedAfter: index.entity.issuedAt,
          provenance: { heldFrom: 'index', dateFrom: 'index-side-event-bound', ...base, notes },
        }
      }
      notes.push('index-date-is-lower-bound')
    }
    return {
      held: true,
      issuedAt: index.entity.issuedAt,
      provenance: { heldFrom: 'index', dateFrom: 'index', ...base, notes },
    }
  }

  // ---- no index answered: contract only, exactly as before, and it says so.
  if (!index) notes.push('index-unavailable')

  // ---- the credential is gone at head. The index, if it answered, may not know that yet.
  if (!chain.held) {
    if (index?.entity && !index.entity.ended) notes.push('credential-ceased-since-index')
    // A protocol that keeps the ending of a credential it no longer honours hands us a closed
    // window. It changes nothing today — `held` stays false and nothing at head weighs it —
    // and it is the only way an as-of score can see a credential the subject has since lost.
    if (chain.heldUntil !== undefined) {
      if (chain.issuedAt === undefined) {
        notes.push('lapsed-credential-start-undated')
        return {
          held: false,
          heldUntil: chain.heldUntil,
          provenance: { heldFrom: 'chain', dateFrom: 'none', ...base, notes },
        }
      }
      notes.push('date-from-lapsed-verification')
      return {
        held: false,
        issuedAt: chain.issuedAt,
        heldUntil: chain.heldUntil,
        provenance: { heldFrom: 'chain', dateFrom: 'chain', ...base, notes },
      }
    }
    return { held: false, provenance: { heldFrom: 'chain', dateFrom: 'none', ...base, notes } }
  }

  if (!index) {
    return {
      held: true,
      ...(chain.issuedAt !== undefined ? { issuedAt: chain.issuedAt } : {}),
      provenance: {
        heldFrom: 'chain',
        dateFrom: chain.issuedAt !== undefined ? 'chain' : 'none',
        ...base,
        notes,
      },
    }
  }

  // ---- held at head. Date it as precisely as the evidence allows.
  if (chain.issuedAt !== undefined) {
    // The contract dates it itself, so index lag cannot move this score at all. The index
    // becomes a cross-check: a disagreement is a fact about our own pipeline and is reported.
    if (
      index.entity &&
      Math.abs(index.entity.issuedAt - chain.issuedAt) > DATE_AGREEMENT_TOLERANCE_SECONDS
    ) {
      notes.push(
        index.entity.issuanceObserved
          ? 'index-date-disagrees-with-chain'
          : datesFromBelow(index.entity)
            ? 'index-date-precedes-issuance'
            : 'index-date-is-lower-bound',
      )
    }
    return {
      held: true,
      issuedAt: chain.issuedAt,
      provenance: { heldFrom: 'chain', dateFrom: 'chain', ...base, notes },
    }
  }

  if (index.entity && !index.entity.issuanceObserved) {
    if (datesFromBelow(index.entity)) {
      // The side-event provably precedes issuance, so its timestamp would make the credential
      // look *older* than it is — the direction that pays an adversary on a survival ramp. It
      // bounds issuance from below instead, which caps ramp weight exactly as an absence bound
      // does. This is the whole reason the index reports which events it actually saw.
      notes.push('index-date-precedes-issuance')
      return {
        held: true,
        issuedAfter: index.entity.issuedAt,
        provenance: { heldFrom: 'chain', dateFrom: 'index-side-event-bound', ...base, notes },
      }
    }
    // The entity exists because something else touched it (a trust edge on an avatar registered
    // before the indexed range), and that event cannot precede issuance. Using its timestamp
    // understates the credential's age, which on a survival ramp understates its weight —
    // wrong, but wrong in the subject's disfavour rather than the adversary's, so we keep it
    // and flag it.
    notes.push('index-date-is-lower-bound')
    return {
      held: true,
      issuedAt: index.entity.issuedAt,
      provenance: { heldFrom: 'chain', dateFrom: 'index', ...base, notes },
    }
  }

  if (index.entity) {
    return {
      held: true,
      issuedAt: index.entity.issuedAt,
      provenance: { heldFrom: 'chain', dateFrom: 'index', ...base, notes },
    }
  }

  // ---- the torn read. Held at head, absent from the index.
  if (index.completeHistory && index.blockTimestamp !== undefined) {
    // The index has complete history and does not have this credential at `block`, so the
    // credential was issued after that block. That is a real fact, not a guess, and it caps
    // the age at the index's lag — which for a synced index means "brand new", which is
    // exactly what it is.
    notes.push('credential-not-yet-indexed')
    return {
      held: true,
      issuedAfter: index.blockTimestamp,
      provenance: { heldFrom: 'chain', dateFrom: 'index-absence-bound', ...base, notes },
    }
  }

  // A windowed index (or one whose block timestamp we could not establish) tells us nothing
  // by absence. Fall back to the contract read alone and carry the caveat.
  notes.push('index-outside-coverage')
  return {
    held: true,
    provenance: { heldFrom: 'chain', dateFrom: 'none', ...base, notes },
  }
}
