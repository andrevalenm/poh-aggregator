import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { RegisterHuman, Trust, Stopped } from '../generated/CirclesHub/CirclesHub'
import { CirclesAvatar, CirclesTrust } from '../generated/schema'
import { bumpDay, observeCoverage } from './shared'

function loadOrCreateAvatar(address: Bytes, timestamp: BigInt, block: BigInt): CirclesAvatar {
  let id = address.toHexString()
  let a = CirclesAvatar.load(id)
  if (a == null) {
    a = new CirclesAvatar(id)
    a.address = address
    a.registeredAt = timestamp
    a.registeredAtBlock = block
    a.trustedByCount = 0
    a.registrationObserved = false
    a.stopped = false
  }
  return a as CirclesAvatar
}

export function handleRegisterHuman(event: RegisterHuman): void {
  observeCoverage('circles', 'RegisterHuman', event)
  let a = loadOrCreateAvatar(event.params.avatar, event.block.timestamp, event.block.number)
  // The registration itself, so the date is the date. It overwrites any trust-edge timestamp
  // the trust handler had stamped: an avatar can be trusted before it registers, and that edge
  // must not be allowed to date the registration.
  a.registeredAt = event.block.timestamp
  a.registeredAtBlock = event.block.number
  a.registrationObserved = true
  a.inviter = event.params.inviter
  a.save()
  bumpDay('circles', event, 1, 0, 0)
}

/**
 * Trust edges are unilateral and gas-only, so an honest Circles graph should NOT be
 * tree-shaped. That is what makes inviter-concentration analysis valid here, and invalid on
 * invite-gated registries like PoH where a tree is the intended topology.
 */
export function handleTrust(event: Trust): void {
  observeCoverage('circles', 'Trust', event)
  // Registration emits a self-trust edge; counting it would gift every avatar in-degree 1.
  if (event.params.truster.equals(event.params.trustee)) return

  let trustee = loadOrCreateAvatar(event.params.trustee, event.block.timestamp, event.block.number)

  let id = event.params.truster.toHexString() + '-' + event.params.trustee.toHexString()
  let t = CirclesTrust.load(id)
  let isNew = t == null
  if (t == null) {
    t = new CirclesTrust(id)
    t.truster = event.params.truster
    t.trustee = trustee.id
  }

  // expiryTime in the past means the edge was revoked rather than granted.
  let active = event.params.expiryTime.gt(event.block.timestamp)
  let wasActive = !isNew && (t as CirclesTrust).active

  t.expiryTime = event.params.expiryTime
  t.updatedAt = event.block.timestamp
  t.active = active
  t.save()

  if (active && !wasActive) {
    trustee.trustedByCount = trustee.trustedByCount + 1
    // Only a net-new active edge is a new edge; renewals and revocations are not.
    bumpDay('circles', event, 0, 0, 1)
  } else if (!active && wasActive) {
    trustee.trustedByCount = trustee.trustedByCount - 1
  }
  trustee.save()
}

export function handleStopped(event: Stopped): void {
  observeCoverage('circles', 'Stopped', event)
  let a = CirclesAvatar.load(event.params.avatar.toHexString())
  if (a == null) return
  a.stopped = true
  a.save()
}
