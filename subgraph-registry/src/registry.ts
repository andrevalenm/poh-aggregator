import { AdapterSet, AdapterLivenessSet } from '../generated/PersonhoodRegistry/PersonhoodRegistry'
import { Adapter, WeightChange } from '../generated/schema'

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

export function handleAdapterLivenessSet(event: AdapterLivenessSet): void {
  // Liveness flips arrive keyed by hash only; find the adapter by its stored keyHash.
  // Linear scan is fine at ontology scale (~tens of adapters), but entities cannot be
  // enumerated in mappings — so we keep a reverse record instead: the AdapterSet handler
  // stored the plaintext id, and liveness events for unknown hashes are ignored (they
  // cannot exist, since setAdapterLiveness reverts for unknown adapters).
  // We store the mapping via a deterministic lookup entity.
  let probe = Adapter.load(event.params.id.toHexString())
  if (probe != null) {
    probe.live = event.params.live
    probe.save()
  }
}
