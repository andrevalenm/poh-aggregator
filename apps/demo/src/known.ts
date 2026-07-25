/**
 * The registry stores adapter ids and trust roots as keccak hashes to keep storage cheap, so
 * a consumer has to supply the preimages to get readable names back. The SDK does not ship
 * them — the ontology JSON at the repo root is the single source of truth — so we import it
 * at build time and hand the lists to the client.
 *
 * Adapters absent from this list still load; they just render under their hash.
 */
import ontologyJson from '../../../ontology/adapters.json'

interface OntologyFile {
  trustRoots: Record<string, string>
  adapters: { id: string; notes?: string }[]
}

const file = ontologyJson as unknown as OntologyFile

export const knownIds: string[] = file.adapters.map((a) => a.id)
export const knownRoots: string[] = Object.keys(file.trustRoots)

/** Human-readable descriptions of each trust root, for the correlation callouts. */
export const rootDescriptions: Record<string, string> = file.trustRoots

/** The registry's own notes on each adapter — why a weight is what it is. */
export const adapterNotes: Record<string, string> = Object.fromEntries(
  file.adapters.filter((a) => a.notes).map((a) => [a.id, a.notes!]),
)
