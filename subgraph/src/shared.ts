import { ethereum } from '@graphprotocol/graph-ts'
import { IndexCoverage, ProtocolDay } from '../generated/schema'

/**
 * Record the lower edge of this data source's knowledge, once.
 *
 * Every handler calls this because the first event a data source sees is whichever kind comes
 * first, and the honest claim is "complete from here", not "complete from the block I happen to
 * have a registration for". Created on the first event and never moved afterwards, so it is one
 * store read per event and one write per data source per sync.
 */
export function observeCoverage(protocol: string, kind: string, event: ethereum.Event): void {
  let c = IndexCoverage.load(protocol)
  if (c != null) return
  c = new IndexCoverage(protocol)
  c.protocol = protocol
  c.firstEventBlock = event.block.number
  c.firstEventAt = event.block.timestamp
  c.firstEventKind = kind
  c.save()
}

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
