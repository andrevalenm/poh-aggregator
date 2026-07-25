import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { HumanityClaimed, HumanityRevoked, VouchRegistered } from '../generated/ProofOfHumanity/ProofOfHumanity'
import { PohHuman, PohVouch } from '../generated/schema'
import { bumpDay, observeCoverage } from './shared'

function loadOrCreate(idBytes: Bytes, timestamp: BigInt, block: BigInt): PohHuman {
  let id = idBytes.toHexString()
  let h = PohHuman.load(id)
  if (h == null) {
    h = new PohHuman(id)
    h.humanityId = idBytes
    h.claimedAt = timestamp
    h.claimedAtBlock = block
    h.requestId = BigInt.zero()
    h.claimObserved = false
    h.revoked = false
  }
  return h as PohHuman
}

export function handleHumanityClaimed(event: HumanityClaimed): void {
  observeCoverage('poh', 'HumanityClaimed', event)
  let h = loadOrCreate(event.params.humanityId, event.block.timestamp, event.block.number)
  // claimedAt is the point of this entity — the boolean alone is nearly meaningless.
  h.claimedAt = event.block.timestamp
  h.claimedAtBlock = event.block.number
  h.requestId = event.params.requestId
  // This is the issuance itself, so the date stops being an approximation. A re-claim
  // overwrites an earlier one: the entity holds the latest claim, which is what the contract's
  // own expirationTime arithmetic reports too.
  h.claimObserved = true
  h.revoked = false
  h.save()
  bumpDay('poh', event, 1, 0, 0)
}

export function handleHumanityRevoked(event: HumanityRevoked): void {
  observeCoverage('poh', 'HumanityRevoked', event)
  let id = event.params.humanityId.toHexString()
  let h = PohHuman.load(id)
  if (h == null) return
  h.revoked = true
  h.revokedAt = event.block.timestamp
  h.save()
  bumpDay('poh', event, 0, 1, 0)
}

export function handleVouchRegistered(event: VouchRegistered): void {
  observeCoverage('poh', 'VouchRegistered', event)
  // Both ends must exist as entities so the derived edges resolve, even if we have not seen
  // their claim event — which is the *ordinary* case for the vouched side, since a vouch is
  // cast on a request that has not resolved yet. Those entities keep claimObserved false, and
  // their claimedAt is this vouch's timestamp: earlier than the claim, never later.
  let voucher = loadOrCreate(event.params.voucherHumanityId, event.block.timestamp, event.block.number)
  voucher.save()
  let vouched = loadOrCreate(event.params.vouchedHumanityId, event.block.timestamp, event.block.number)
  vouched.save()
  let voucherId = voucher.id
  let vouchedId = vouched.id

  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let v = new PohVouch(id)
  v.voucher = voucherId
  v.vouched = vouchedId
  v.timestamp = event.block.timestamp
  v.block = event.block.number
  v.save()
}
