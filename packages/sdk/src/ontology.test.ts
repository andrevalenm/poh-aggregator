import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defaultAdapters } from './adapters/index.ts'
import ontologyData from './ontology-data.json' with { type: 'json' }

/**
 * Invariants over the ontology itself.
 *
 * The ontology is data, not code, and it is edited by hand from research — which is exactly
 * the shape of thing that rots silently. Two of these tests were written because the defect
 * they catch was already in the file: Civic sat on Persona's root when its vendor is FaceTec,
 * and BrightID sat on Proof of Humanity's, which would have saturated two independent
 * vouching graphs against each other. Neither changed a score, because both adapters are
 * discontinued — but a wrong root is a latent scoring bug waiting for the protocol to revive.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')

const EVIDENCE_CLASSES = ['Uniqueness', 'StateIdentity', 'SocialTrust', 'Liveness', 'Behavioral']
const AGE_CURVES = ['None', 'Decay', 'Ramp']

const { adapters, trustRoots } = ontologyData

describe('ontology', () => {
  test('the SDK copy is identical to the source of truth', () => {
    // `npm run build` copies ontology/adapters.json over src/ontology-data.json. If someone
    // edits the ontology and ships without rebuilding, the published package prices
    // credentials from a stale file while the registry prices them from the new one.
    const source = readFileSync(join(REPO_ROOT, 'ontology', 'adapters.json'), 'utf8')
    const shipped = readFileSync(join(HERE, 'ontology-data.json'), 'utf8')
    assert.equal(shipped, source, 'run `npm run build` in packages/sdk to resync ontology-data.json')
  })

  test('ids are unique and stable-looking', () => {
    const ids = adapters.map((a) => a.id)
    assert.equal(new Set(ids).size, ids.length, 'duplicate adapter id')
    for (const id of ids) {
      // Ids are hashed into the on-chain registry key, so a rename is a new adapter and
      // silently drops the old one's history. Keep them boring.
      assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id not kebab-case: ${id}`)
    }
  })

  test('every trust root an adapter claims is declared, and every declared root is used', () => {
    const declared = new Set(Object.keys(trustRoots))
    const used = new Set(adapters.map((a) => a.trustRoot))
    for (const root of used) assert.ok(declared.has(root), `undeclared trust root: ${root}`)
    for (const root of declared) {
      // An orphan root is either a deleted adapter or a typo in a live one. Both are
      // failures of the correlation model, which is the only thing the roots are for.
      assert.ok(used.has(root), `declared but unused trust root: ${root}`)
    }
  })

  test('retired roots are named, explained, and no longer in use', () => {
    // Retired names exist so that as-of scoring can reverse a hash the registry still carries
    // at an old revision. Two failure modes: a retired name that is still claimed by a live
    // adapter (then it is not retired), and a name in both tables (then the same hash has two
    // meanings, and the one that wins depends on map insertion order).
    const retired = (ontologyData as { retiredTrustRoots?: Record<string, string> })
      .retiredTrustRoots
    assert.ok(retired, 'retiredTrustRoots is missing')
    const declared = new Set(Object.keys(trustRoots))
    for (const [name, why] of Object.entries(retired)) {
      assert.ok(!declared.has(name), `${name} is both current and retired`)
      assert.ok(!adapters.some((a) => a.trustRoot === name), `${name} is retired but still in use`)
      assert.ok(why.length > 40, `${name} was retired without saying why`)
    }
  })

  test('no adapter sits on an unresolved root', () => {
    // "unknown" used to be a legal value. It is not a root — it is a research debt that
    // scores as full independence, which is the direction that pays the adversary.
    for (const a of adapters) {
      assert.notEqual(a.trustRoot, 'unknown', `${a.id} has an unresolved trust root`)
    }
  })

  test('enumerations are in range and half-lives match their curve', () => {
    for (const a of adapters) {
      assert.ok(EVIDENCE_CLASSES.includes(a.evidenceClass), `${a.id}: ${a.evidenceClass}`)
      assert.ok(AGE_CURVES.includes(a.ageCurve), `${a.id}: ${a.ageCurve}`)
      if (a.ageCurve === 'None') {
        assert.equal(a.decayHalfLifeDays, 0, `${a.id}: half-life on a None curve is ignored, so it lies`)
      } else {
        assert.ok(a.decayHalfLifeDays > 0, `${a.id}: ${a.ageCurve} curve needs a half-life`)
      }
    }
  })

  test('costs are whole cents and rental is never dearer than forgery', () => {
    for (const a of adapters) {
      for (const [field, v] of [
        ['forgeCostCents', a.forgeCostCents],
        ['rentCostCents', a.rentCostCents],
      ] as const) {
        assert.ok(Number.isInteger(v) && v >= 0, `${a.id}.${field} = ${v}`)
        // uint64 on-chain.
        assert.ok(v <= Number.MAX_SAFE_INTEGER, `${a.id}.${field} overflows`)
      }
      // Nothing in the landscape is rental-resistant — every row of the sale-vs-rental table
      // in research/landscape/sybil-incidents-antipatterns.md is rentable, and rental is the
      // cheaper attack in every case. An adapter priced the other way round is claiming a
      // protocol hardened against rental, which would need its own evidence.
      assert.ok(
        a.rentCostCents <= a.forgeCostCents,
        `${a.id}: rent ${a.rentCostCents} > forge ${a.forgeCostCents}`,
      )
    }
  })

  test('every adapter cites a source file that exists', () => {
    for (const a of adapters) {
      assert.ok(a.sourceURI, `${a.id} has no sourceURI`)
      assert.ok(
        existsSync(join(REPO_ROOT, a.sourceURI)),
        `${a.id} cites ${a.sourceURI}, which does not exist`,
      )
    }
  })

  test('every discontinued adapter says why it is discontinued', () => {
    // live:false zeroes the credential's contribution outright, so it is the single most
    // consequential field in the file. It never gets set without a stated reason.
    for (const a of adapters.filter((x) => !x.live)) {
      assert.ok(a.notes && a.notes.length > 40, `${a.id} is not live and does not say why`)
    }
  })

  test('implemented adapters have a probe, and every probe has an ontology entry', () => {
    const byId = new Map(adapters.map((a) => [a.id, a]))
    const probeIds = new Set(defaultAdapters().map((p) => p.adapterId))
    const claimed = adapters.filter((a) => a.implemented).map((a) => a.id)

    for (const id of claimed) assert.ok(probeIds.has(id), `${id} claims implemented but has no probe`)
    for (const id of probeIds) {
      const a = byId.get(id)
      assert.ok(a, `probe ${id} has no ontology entry, so its evidence would be dropped`)
      assert.ok(a.implemented, `probe ${id} exists but the ontology says implemented:false`)
      // A probe against a dead protocol returns evidence worth zero. That is legal, but it
      // must be a decision, not a leftover — decisions are recorded here, with their grounds
      // in each adapter's notes: checked, found, reported, not counted.
      const DELIBERATELY_PROBED_DEAD = new Set(['idena', 'brightid', 'civic-pass'])
      if (!a.live) {
        assert.ok(
          DELIBERATELY_PROBED_DEAD.has(id),
          `probe ${id} runs against an adapter marked not live, and no decision is recorded for it`,
        )
      }
    }
  })

  test('the landscape claim the product makes is the one the file supports', () => {
    // The pitch is that many protocols collapse onto few roots. If that ever stops being
    // true of the actual file, the pitch is the thing that has to change.
    const counts = new Map<string, number>()
    for (const a of adapters) counts.set(a.trustRoot, (counts.get(a.trustRoot) ?? 0) + 1)
    const top6 = [...counts.values()].sort((x, y) => y - x).slice(0, 6)
    const covered = top6.reduce((x, y) => x + y, 0)
    assert.ok(
      covered >= adapters.length / 2,
      `the six largest roots cover only ${covered} of ${adapters.length} adapters`,
    )
    assert.ok(counts.size < adapters.length, 'no adapter shares a root with any other')
  })
})
