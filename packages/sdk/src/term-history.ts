/**
 * A term, and when it was in force.
 *
 * Several protocols publish an *expiry* and no issuance date, and the date we score them on is a
 * subtraction: `expiry - term`. That subtraction has a premise nobody states — that the term read
 * at head is the term the expiry was written under — and the premise is a claim about the world
 * that can be false. Every protocol here makes the term governance-settable, none of them touch a
 * stored expiry when it changes, so one transaction re-dates an entire registry at once, in the
 * same direction, by the full size of the change.
 *
 * A tripwire ("assert the term is still 168 days") notices that. It cannot repair it: it fires
 * after the fact and has nothing to put in place of the broken date, so every credential of that
 * protocol goes undated at once. Reading the same governance action as **data** costs the same
 * request and produces a timeline, which keeps dating credentials correctly straight through the
 * change — each cohort under the term that was in force for it.
 *
 * This module is the protocol-independent half of that: the era shape, the assembly rule, and the
 * solver that decides which era an expiry belongs to. Where the events come from, and what makes a
 * sweep of them trustworthy, is protocol-specific and lives beside each adapter — `poh-term.ts`
 * for Proof of Humanity v2's `DurationsChanged`, `world-term.ts` for `WorldIDAddressBook`'s
 * `VerificationLengthUpdated`.
 */

/**
 * One stretch of a registry's life over which a single term was granted to every new credential.
 *
 * Eras are half-open in time — `[from, until)` — because that is exactly how these contracts
 * behave: a change takes effect for the block it is mined in and every block after it, and a
 * credential written in the same block is written under the new value.
 */
export interface TermEra {
  /** First second of the era. The deployment for the first era, the change's block for the rest. */
  from: number
  /** First second *after* the era; absent for the era still running at head. */
  until?: number
  /**
   * The term in force, in seconds. Absent only when the protocol never published it — Proof of
   * Humanity v2's `initialize` writes `humanityLifespan` with no event, so its first era has no
   * recoverable value. `WorldIDAddressBook` emits its constructor's term, so every era of that
   * timeline has one and this is never absent there.
   */
  seconds?: number
  /** Block the change that opened this era was mined in; absent for the first era. */
  block?: number
}

/** Every term a registry has granted, and when. */
export interface TermHistory {
  /** Chronological, contiguous, covering the deployment through head. Never empty. */
  eras: TermEra[]
  /**
   * The eras came from a completed sweep, so they are what the chain says. `false` means nobody
   * swept and head's term was *assumed* to have been in force all along — the assumption this
   * module exists to stop making silently.
   */
  observed: boolean
}

/** The history a caller who cannot sweep has to work with: head's term, assumed to be eternal. */
export function assumedTermHistory(term: number, deployedAt: number): TermHistory {
  return { eras: [{ from: deployedAt, ...(term > 0 ? { seconds: term } : {}) }], observed: false }
}

/**
 * Lay a sorted change list out as contiguous half-open eras.
 *
 * `first` is the era the deployment opened: `seconds` when the contract published its initial term
 * and absent when it did not. Every later era is opened by a change and closed by the next one.
 *
 * Two changes mined in the same second collapse to the later write, which is what the chain does:
 * the second `SSTORE` is the value every subsequent credential is written under, and an era of
 * zero length can hold no credential anyway.
 */
export function buildTermEras(
  first: { from: number; seconds?: number },
  changes: readonly { seconds: number; block: number; at: number }[],
): TermEra[] {
  const eras: TermEra[] = [{ ...first }]
  for (const change of changes) {
    if (eras[eras.length - 1]!.from === change.at) eras.pop()
    eras[eras.length - 1]!.until = change.at
    eras.push({ from: change.at, seconds: change.seconds, block: change.block })
  }
  return eras
}

/** Which term produced an expiry the contract wrote — or why that cannot be settled. */
export type TermResolution =
  /** Exactly one era can have produced it, so its term is the one to subtract. */
  | { kind: 'settled'; term: number; era: TermEra }
  /** No era can have: the expiry is not something a local write could have produced. */
  | { kind: 'no-era' }
  /** Two eras with different terms both explain it. Nothing distinguishes them; refuse. */
  | { kind: 'ambiguous'; terms: number[] }
  /** Only an era whose term the contract never published can explain it. */
  | { kind: 'era-unknown' }

/**
 * Solve `expiry = writtenAt + term` for the era `writtenAt` falls in.
 *
 * These contracts all write `expiry = block.timestamp + term`, so a candidate era explains an
 * expiry exactly when subtracting *that era's* term lands the write inside *that era*. With one
 * era — the state of every timeline read so far — this reduces to the deployment-floor guard the
 * probes have always applied, which is why nothing at head moves when a timeline is introduced.
 *
 * `now` is a ceiling on every era, not just the running one: no block has been mined in the
 * future, so no expiry can have been written after the block we read at.
 *
 * A known era wins over an unpublished one rather than being called ambiguous against it. An
 * unpublished era can be assigned a term to fit *any* expiry, so treating it as a rival would make
 * every date in the registry's history unrecoverable the moment governance touched the field once.
 * The cost is a coincidence — an expiry written in the unpublished era that a later era's term
 * also happens to explain — and that is written down rather than traded silently.
 */
export function termForLocalExpiry(h: TermHistory, expiry: number, now: number): TermResolution {
  const fits: { term: number; era: TermEra }[] = []
  let unpublishedEraCouldFit = false
  for (const era of h.eras) {
    const until = Math.min(era.until ?? Number.POSITIVE_INFINITY, now + 1)
    if (era.from >= until) continue
    if (era.seconds === undefined) {
      // Some term, we cannot say which, would place the write inside this era.
      if (expiry > era.from) unpublishedEraCouldFit = true
      continue
    }
    const writtenAt = expiry - era.seconds
    if (writtenAt >= era.from && writtenAt < until) fits.push({ term: era.seconds, era })
  }
  const terms = [...new Set(fits.map((f) => f.term))]
  if (terms.length > 1) return { kind: 'ambiguous', terms }
  if (fits.length > 0) return { kind: 'settled', term: fits[0]!.term, era: fits[0]!.era }
  return unpublishedEraCouldFit ? { kind: 'era-unknown' } : { kind: 'no-era' }
}
