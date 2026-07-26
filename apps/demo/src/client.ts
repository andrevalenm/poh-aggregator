import { Print, defaultAdapters, DEFAULT_REGISTRY } from '@printid/sdk'
import type { Address, AdapterProbe, AdapterProbeResult } from '@printid/sdk'
import { knownIds, knownRoots } from './known.ts'

export { DEFAULT_REGISTRY }

/**
 * Optional subgraph. Without it PoH and Circles report no issuance date, and the Ramp age
 * curve halves their weight on principle — an attacker must not profit from an indexer
 * being unreachable. Set VITE_SUBGRAPH_URL once the subgraph is deployed and the caveat and
 * the discount both go away on their own.
 */
const SUBGRAPH_URL = import.meta.env['VITE_SUBGRAPH_URL'] as string | undefined

const baseAdapters = (): AdapterProbe[] =>
  SUBGRAPH_URL ? defaultAdapters({ subgraphUrl: SUBGRAPH_URL }) : defaultAdapters()

export type ProbeState = 'idle' | 'running' | 'held' | 'absent' | 'unavailable'

export interface ProbeEvent {
  adapterId: string
  address: Address
  state: ProbeState
  error?: string
  ms?: number
}

/**
 * `resolve()` fans out to every adapter internally, so there is no progress signal to hook.
 * We wrap each probe before handing the list to the client, which gives real per-adapter
 * loading state without the SDK having to know a UI exists.
 *
 * The distinction the wrapper preserves matters more than the spinner: a probe that failed
 * is `unavailable`, never `absent`. RPC trouble must not read as "not a person".
 */
export function instrumentedAdapters(onEvent: (e: ProbeEvent) => void): AdapterProbe[] {
  return baseAdapters().map((a) => ({
    adapterId: a.adapterId,
    async probe(subject: Address): Promise<AdapterProbeResult> {
      const started = performance.now()
      onEvent({ adapterId: a.adapterId, address: subject, state: 'running' })
      const result = await a.probe(subject)
      const ms = Math.round(performance.now() - started)
      onEvent({
        adapterId: a.adapterId,
        address: subject,
        ms,
        state: result.error ? 'unavailable' : result.held ? 'held' : 'absent',
        ...(result.error ? { error: result.error } : {}),
      })
      return result
    },
  }))
}

export function makeClient(onEvent?: (e: ProbeEvent) => void): Print {
  return new Print({
    knownIds,
    knownRoots,
    adapters: onEvent ? instrumentedAdapters(onEvent) : baseAdapters(),
  })
}

/** Adapter ids the demo probes live, in display order. */
export const LIVE_ADAPTER_IDS = baseAdapters().map((a) => a.adapterId)
