import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { HumanityClaimed, HumanityRevoked, VouchRegistered } from '../generated/ProofOfHumanity/ProofOfHumanity'
import { PohHuman, PohVouch } from '../generated/schema'
import { bumpDay } from './shared'

function loadOrCreate(idBytes: Bytes, timestamp: BigInt, block: BigInt): PohHuman {
  let id = idBytes.toHexString()
  let h = PohHuman.load(id)
  if (h == null) {
    h = new PohHuman(id)
    h.humanityId = idBytes
    h.claimedAt = timestamp
    h.claimedAtBlock = block
    h.requestId = BigInt.zero()
    h.revoked = false
  }
  return h as PohHuman
}

export function handleHumanityClaimed(event: HumanityClaimed): void {
  let h = loadOrCreate(event.params.humanityId, event.block.timestamp, event.block.number)
  // claimedAt is the point of this entity — the boolean alone is nearly meaningless.
  h.claimedAt = event.block.timestamp
  h.claimedAtBlock = event.block.number
  h.requestId = event.params.requestId
  h.revoked = false
  h.save()
  bumpDay('poh', event, 1, 0, 0)
}

export function handleHumanityRevoked(event: HumanityRevoked): void {
  let id = event.params.humanityId.toHexString()
  let h = PohHuman.load(id)
  if (h == null) return
  h.revoked = true
  h.revokedAt = event.block.timestamp
  h.save()
  bumpDay('poh', event, 0, 1, 0)
}

export function handleVouchRegistered(event: VouchRegistered): void {
  // Both ends must exist as entities so the derived edges resolve, even if we have not seen
  // their claim event (possible when a vouch precedes the claim).
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
