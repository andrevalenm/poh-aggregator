import { ethereum } from '@graphprotocol/graph-ts'
import { ProtocolDay } from '../generated/schema'

/**
 * Daily rollups exist for one reason: registration rate over time is how you detect an
 * airdrop-inflated credential. PoH took ~95% of its lifetime registrations in a four-month
 * window tracking a $9.94 claim, and that is invisible in a cumulative count.
 */
export function bumpDay(
  protocol: string,
  event: ethereum.Event,
  registrations: i32,
  revocations: i32,
  trustEdges: i32,
): void {
  let day = event.block.timestamp.toI32() / 86400
  let id = protocol + '-' + day.toString()
  let d = ProtocolDay.load(id)
  if (d == null) {
    d = new ProtocolDay(id)
    d.protocol = protocol
    d.day = day
    d.registrations = 0
    d.revocations = 0
    d.trustEdges = 0
  }
  d.registrations = d.registrations + registrations
  d.revocations = d.revocations + revocations
  d.trustEdges = d.trustEdges + trustEdges
  d.save()
}
