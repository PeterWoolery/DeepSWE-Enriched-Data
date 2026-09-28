import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeOfficialFeed } from '../src/lib/normalize'
import { assertNoSuspiciousRemoval, buildRevisionEvents, diffOfficialObservations, mergeRevisionEvents } from '../src/lib/revisions'
import { stageRefreshCandidate } from '../src/lib/refresh-safety'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/official-feed-small.json', import.meta.url), 'utf8'))
const effortOrder = JSON.parse(readFileSync(new URL('../data/sources/effort-order.json', import.meta.url), 'utf8'))
const retrieval = { retrievedAt: '2026-09-26T17:00:00.000Z', contentSha256: 'c'.repeat(64), httpStatus: 200 as const, etag: null, lastModified: null }
const rows = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations

describe('safe source revisions', () => {
  it('is idempotent for the same observations and does not create duplicate experiments', () => {
    expect(diffOfficialObservations(rows, rows)).toEqual({ addedIds: [], changedIds: [], disappearedIds: [], unchangedCount: 2, changeKinds: [] })
    expect(buildRevisionEvents(rows, rows, retrieval.contentSha256, retrieval.retrievedAt)).toEqual([])
  })

  it('classifies score corrections, pricing-only changes, and source removals', () => {
    const costCorrected = structuredClone(rows)
    costCorrected[0]!.metrics.cost.value = 9.5
    const priceDiff = diffOfficialObservations(rows, costCorrected)
    expect(priceDiff.changedIds).toEqual([rows[0]!.id])
    expect(priceDiff.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'pricing-only-change' })

    const scoreCorrected = structuredClone(rows)
    scoreCorrected[0]!.result.value = 0.9
    const scoreDiff = diffOfficialObservations(rows, scoreCorrected)
    expect(scoreDiff.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'changed-result' })
    const events = buildRevisionEvents(rows, scoreCorrected, 'd'.repeat(64), '2026-09-26T18:00:00Z')
    expect(events[0]?.previous?.score).toBe(rows[0]!.result.value)
    expect(events[0]?.current?.score).toBe(0.9)
    expect(mergeRevisionEvents(events, events)).toHaveLength(events.length)

    const removed = diffOfficialObservations(rows, rows.slice(1))
    expect(removed.disappearedIds).toEqual([rows[0]!.id])
    expect(removed.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'source-removal' })

    const orderChanged = structuredClone(rows)
    orderChanged[0]!.effort.order = 4
    const orderDiff = diffOfficialObservations(rows, orderChanged)
    expect(orderDiff.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'effort-order-change' })

    const reviewStatusChanged = structuredClone(rows)
    reviewStatusChanged[0]!.effort.missingReason = 'Previously unmapped; source evidence now pending.'
    const reviewDiff = diffOfficialObservations(rows, reviewStatusChanged)
    expect(reviewDiff.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'effort-review-status-change' })

    const scopeChanged = structuredClone(rows)
    scopeChanged[0]!.metrics.time.sampleCount = 450
    scopeChanged[0]!.metrics.time.sampleCountMissingReason = null
    const scopeDiff = diffOfficialObservations(rows, scopeChanged)
    expect(scopeDiff.changeKinds).toContainEqual({ id: rows[0]!.id, kind: 'metric-scope-change' })
  })

  it('rejects suspicious mass removals while permitting a candidate for explicit review', () => {
    expect(() => assertNoSuspiciousRemoval(70, 55)).toThrow('Suspicious source removal')
    expect(() => assertNoSuspiciousRemoval(70, 0)).toThrow('Suspicious source removal')
    expect(() => assertNoSuspiciousRemoval(70, 69)).not.toThrow()
  })

  it('keeps last-known-good approved data and the previous candidate when preparation fails', async () => {
    const approved = { revision: 'last-good' }
    let candidate: unknown = { id: 'prior-candidate' }
    const statuses: Record<string, unknown>[] = []
    await expect(stageRefreshCandidate(
      async () => { throw new Error('upstream unavailable') },
      async (next) => { candidate = next },
      async (status) => { statuses.push(status) },
    )).rejects.toThrow('upstream unavailable')
    expect(approved).toEqual({ revision: 'last-good' })
    expect(candidate).toEqual({ id: 'prior-candidate' })
    expect(statuses[0]).toMatchObject({ status: 'failed', approvedSnapshotModified: false })
  })

  it('stages a reviewed candidate without any approved-snapshot write path', async () => {
    const approved = { revision: 'last-good' }
    let candidate: unknown = null
    const message = await stageRefreshCandidate(
      async () => ({ candidate: { revision: 'candidate-only' }, status: { status: 'candidate-ready' }, summary: 'staged' }),
      async (next) => { candidate = next },
      async () => undefined,
    )
    expect(message).toBe('staged')
    expect(candidate).toEqual({ revision: 'candidate-only' })
    expect(approved).toEqual({ revision: 'last-good' })
  })

  it('discards a superseded pending candidate after a verified unchanged source check', async () => {
    let candidate: unknown = { sourceHash: 'superseded' }
    const approved = { revision: 'last-good' }
    await stageRefreshCandidate(
      async () => ({ candidate: null, discardCandidate: true, status: { status: 'checked-unchanged' }, summary: '304' }),
      async (next) => { candidate = next },
      async () => undefined,
      async () => { candidate = null },
    )
    expect(candidate).toBeNull()
    expect(approved).toEqual({ revision: 'last-good' })
  })
})
