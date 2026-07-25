import { AdapterSet, AdapterLivenessSet } from '../generated/PersonhoodRegistry/PersonhoodRegistry'
import { Adapter, AdapterKey, LivenessChange, WeightChange } from '../generated/schema'

export function handleAdapterSet(event: AdapterSet): void {
  // The contract proved idString is the preimage of the key, so the plaintext id is safe
  // to use as the entity id — no off-chain reversal table needed.
  let id = event.params.idString
  let a = Adapter.load(id)
  if (a == null) a = new Adapter(id)

  a.keyHash = event.params.id
  a.name = event.params.name
  a.evidenceClass = event.params.evidenceClass
  a.trustRoot = event.params.trustRoot
  a.forgeCostCents = event.params.forgeCostCents
  a.rentCostCents = event.params.rentCostCents
  a.decayHalfLifeDays = event.params.decayHalfLifeDays.toI32()
  a.ageCurve = event.params.ageCurve
  a.live = event.params.live
  a.sourceURI = event.params.sourceURI
  a.revision = event.params.revision
  a.updatedAt = event.block.timestamp
  a.save()

  // AdapterLivenessSet carries only the hashed key, and a mapping cannot enumerate entities,
  // so the reverse record has to be written here — on the one event that carries both halves.
  let key = new AdapterKey(event.params.id.toHexString())
  key.adapter = id
  key.save()

  let c = new WeightChange(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  c.adapter = id
  c.forgeCostCents = event.params.forgeCostCents
  c.rentCostCents = event.params.rentCostCents
  c.live = event.params.live
  c.sourceURI = event.params.sourceURI
  c.revision = event.params.revision
  c.timestamp = event.block.timestamp
  c.block = event.block.number
  c.txHash = event.transaction.hash
  c.save()
}

/**
 * A protocol declared discontinued, or revived.
 *
 * This handler used to do `Adapter.load(event.params.id.toHexString())` — a load by hash hex
 * against entities keyed on the plaintext id, which matches nothing. Every liveness flip was
 * dropped and nothing said so: the adapter kept its old flag and the audit trail kept no
 * record. It survived because it has never fired on the deployed registry, so the bug had no
 * data to be wrong about. The SDK's as-of scoring is what made it matter — reconstructing the
 * ontology at a past block reads exactly these entities.
 *
 * It is worth the reverse index because `live: false` zeroes a credential's contribution
 * outright: this is the cheapest mutation the curator can make and the largest one a score can
 * feel. An unresolvable key should be impossible — `setAdapterLiveness` reverts for an unknown
 * adapter, so every event reaching here has had an AdapterSet before it — but the null checks
 * stay, because an indexer that guesses is worse than one that skips.
 */
export function handleAdapterLivenessSet(event: AdapterLivenessSet): void {
  let key = AdapterKey.load(event.params.id.toHexString())
  if (key == null) return

  let a = Adapter.load(key.adapter)
  if (a == null) return
  a.live = event.params.live
  a.revision = event.params.revision
  a.updatedAt = event.block.timestamp
  a.save()

  let c = new LivenessChange(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  c.adapter = a.id
  c.live = event.params.live
  c.reason = event.params.reason
  c.revision = event.params.revision
  c.timestamp = event.block.timestamp
  c.block = event.block.number
  c.txHash = event.transaction.hash
  c.save()
}
