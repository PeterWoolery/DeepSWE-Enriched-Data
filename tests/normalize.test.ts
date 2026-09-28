import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeOfficialFeed } from '../src/lib/normalize'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/official-feed-small.json', import.meta.url), 'utf8'))
const effortOrder = JSON.parse(readFileSync(new URL('../data/sources/effort-order.json', import.meta.url), 'utf8'))
const retrieval = {
  retrievedAt: '2026-09-26T17:00:00.000Z',
  contentSha256: 'a'.repeat(64),
  httpStatus: 200 as const,
  etag: null,
  lastModified: null,
}

describe('Datacurve v1.1 normalization', () => {
  it('preserves full precision, exact CI method, and scored-attempt vs task denominators', () => {
    const result = normalizeOfficialFeed(fixture, retrieval, effortOrder)
    const medium = result.observations[0]!
    expect(medium.result.value).toBe(0.8123456789012345)
    expect(medium.result.confidenceInterval).toMatchObject({
      low: 0.7812345678901234,
      high: 0.8434567890123456,
      confidence: 0.95,
      method: 'fixture run-to-run method',
      attempted: 450,
    })
    expect(medium.result.denominatorCount).toBe(450)
    expect(medium.benchmark.taskCount).toBe(113)
    expect(medium.benchmark.runs).toBe(4)
    expect(medium.metrics.cost.sampleCount).toBe(450)
    expect(medium.metrics.time.sampleCount).toBeNull()
    expect(medium.metrics.time.sampleCountMissingReason).toContain('duration-specific sample count')
    expect(medium.additionalResults[0]).toMatchObject({ metric: 'pass_at_4', denominator: 'unique tasks attempted', denominatorCount: 113 })
    expect(medium.additionalResults[0]?.confidenceInterval).toMatchObject({ low: null, high: null, missingReason: 'Datacurve does not report a pass@4 confidence interval.' })
    expect(medium.metrics.cost.value).toBe(1.23456789012345)
    expect(medium.metrics.time.scope).toContain('timer boundaries unspecified')
    expect(medium.effort.orderEvidence).toContain('openai-reasoning-effort-docs')
  })

  it('keeps missing, zero, and median values distinct and records unknown field names only', () => {
    const result = normalizeOfficialFeed(fixture, retrieval, effortOrder)
    const adaptive = result.observations[1]!
    expect(adaptive.result.value).toBe(0)
    expect(adaptive.result.confidenceInterval.low).toBeNull()
    expect(adaptive.result.confidenceInterval.high).toBeNull()
    expect(adaptive.result.confidenceInterval.missingReason).toContain('not both reported')
    expect(adaptive.effort.order).toBeNull()
    expect(adaptive.effort.missingReason).toContain('No reviewed source-backed effort-order mapping')
    expect(adaptive.metrics.cost.value).toBeNull()
    expect(adaptive.metrics.cost.missingReason).toContain('mean_cost_usd')
    expect(adaptive.metrics.time.value).toBeNull()
    expect(adaptive.metrics.medianTime.value).toBe(0)
    expect(adaptive.metrics.time.statistic).toBe('mean')
    expect(adaptive.metrics.medianTime.statistic).toBe('median')
    expect(result.unknownOptionalFields).toEqual(['unexpected_optional_note'])
    expect(JSON.stringify(result)).not.toContain('must-not-be-copied')
  })

  it('rejects duplicate upstream configuration identifiers', () => {
    const duplicate = { ...fixture, rows: [...fixture.rows, fixture.rows[0]] }
    expect(() => normalizeOfficialFeed(duplicate, retrieval, effortOrder)).toThrow('Duplicate upstream configuration ID')
  })
})
