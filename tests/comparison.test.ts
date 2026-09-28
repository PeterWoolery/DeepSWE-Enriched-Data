import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { displayModelName, displayScoreResult, filterObservations, getEfficiencyCoverage, metricObservation, modelKey, projectBest, scoreResult, strictExclusionReason, strictProtocolGroups, type SourceCategory } from '../src/lib/comparison'
import { normalizeOfficialFeed } from '../src/lib/normalize'
import { ObservationSchema } from '../src/lib/schema'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/official-feed-small.json', import.meta.url), 'utf8'))
const effortOrder = JSON.parse(readFileSync(new URL('../data/sources/effort-order.json', import.meta.url), 'utf8'))
const retrieval = { retrievedAt: '2026-09-26T17:00:00.000Z', contentSha256: 'b'.repeat(64), httpStatus: 200 as const, etag: null, lastModified: null }
const fixtureObservations = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations

function strictObservation(source: typeof fixtureObservations[number], id: string, modelName: string) {
  const observation = structuredClone(source)
  observation.id = id
  observation.model.reportedName = modelName
  observation.model.canonicalId = null
  observation.series.id = `strict-series:${id}`
  observation.series.harness = 'mini-swe-agent'
  observation.series.harnessRevision = 'mini-swe-agent@1.2'
  observation.series.provider = 'OpenAI'
  observation.series.evaluationPolicy = 'context failures and agent timeouts score as failures'
  observation.series.deployment = 'region-a / single deployment'
  observation.series.servingEndpoint = 'endpoint-a'
  observation.series.timingScope = 'wall clock from first model request through final verifier response'
  observation.series.pricingBasis = 'same published USD rate card'
  observation.benchmark.taskSetRevision = 'task-set-sha256:abc'
  observation.benchmark.population = 'all scored rollout attempts'
  observation.benchmark.excludedPolicy = 'provider/verifier/network errors excluded'
  observation.metrics.cost.value = 3
  observation.metrics.cost.reportedValue = 3
  observation.metrics.cost.sampleCount = 450
  observation.metrics.cost.sampleCountMissingReason = null
  observation.metrics.cost.scope = 'per scored attempt'
  observation.metrics.cost.population = 'all scored rollout attempts'
  observation.metrics.cost.definition = 'mean USD using same rate card'
  observation.metrics.cost.missingReason = null
  observation.metrics.outputTokens.includesReasoningTokens = true
  observation.metrics.outputTokens.scope = 'per scored attempt'
  observation.metrics.outputTokens.population = 'all scored rollout attempts'
  observation.metrics.outputTokens.definition = 'mean output tokens including reasoning'
  observation.metrics.time.value = 60
  observation.metrics.time.reportedValue = 60
  observation.metrics.time.sampleCount = 450
  observation.metrics.time.sampleCountMissingReason = null
  observation.metrics.time.scope = 'same end-to-end wall-clock boundaries per scored attempt'
  observation.metrics.time.population = 'all scored rollout attempts'
  observation.metrics.time.definition = 'end-to-end time from first model request through final verifier response'
  observation.metrics.time.missingReason = null
  observation.pricing.basis = 'same published USD rate card'
  return ObservationSchema.parse(observation)
}

describe('comparison projections', () => {
  it('formats model strings for display without changing source identity', () => {
    const observation = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations[0]!
    expect(displayModelName('gpt-5-6-sol')).toBe('GPT 5.6 Sol')
    expect(displayModelName('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(modelKey(observation)).toBe('gpt-6-astra')
    expect(observation.model.reportedName).toBe('gpt-6-astra')
  })

  it('selects best per exact source series using full precision before display rounding', () => {
    const feed = structuredClone(fixture)
    feed.rows[0].reasoning_effort = 'low'
    feed.rows[0].pass_at_1 = 0.812341
    feed.rows[1].reasoning_effort = 'high'
    feed.rows[1].pass_at_1 = 0.812349
    const observations = normalizeOfficialFeed(feed, retrieval, effortOrder).observations
    expect(projectBest(observations, 'pass_at_1').map((row) => row.effort.reportedLabel)).toEqual(['high'])
  })

  it('keeps pass@1 and pass@4 as distinct denominator-defined metrics', () => {
    const observation = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations[0]!
    expect(scoreResult(observation, 'pass_at_1')?.denominator).toBe('scored rollout attempts')
    expect(scoreResult(observation, 'pass_at_4')?.denominator).toBe('unique tasks attempted')
    expect(scoreResult(observation, 'reported_score_unspecified')).toBeNull()
  })

  it('uses the selected score when present and otherwise preserves the source primary score', () => {
    const observation = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations[0]!
    expect(displayScoreResult(observation, 'pass_at_1')).toBe(observation.result)
    expect(displayScoreResult(observation, 'reported_score_unspecified')).toBe(observation.result)
    expect(displayScoreResult(observation, 'pass_at_4')).toBe(scoreResult(observation, 'pass_at_4'))
  })

  it('excludes unknown protocol fields from strict matching and keeps metric coverage separate', () => {
    const observations = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations
    expect(strictExclusionReason(observations[0]!, 'cost')).toBe('task-set revision is unknown')
    expect(metricObservation(observations[1]!, 'time', 'mean').value).toBeNull()
    expect(metricObservation(observations[1]!, 'time', 'median').value).toBe(0)
    expect(getEfficiencyCoverage(observations, 'time', 'mean')).toEqual({ available: 1, total: 2, missing: 1 })
    expect(filterObservations(observations, {
      view: 'official', query: '', selectedModels: [], sources: ['organizer'], version: 'all', harness: 'all', publisher: 'all', strict: true,
      strictGroup: '', statistic: 'mean', scoreMetric: 'pass_at_1',
    }, 'cost')).toEqual([])
  })

  it('keeps benchmark revisions in distinct version filters', () => {
    const observations = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations
    const older = structuredClone(observations[0]!)
    older.id = 'fixture-v1.0-distinct'
    older.series.id = `${older.series.id}|v1.0`
    older.benchmark.version = '1.0'
    const all = [...observations, older]
    const filtered = filterObservations(all, {
      view: 'official', query: '', selectedModels: [], sources: ['organizer'], version: '1.1', harness: 'all', publisher: 'all', strict: false,
      strictGroup: '', statistic: 'mean', scoreMetric: 'pass_at_1',
    }, 'cost')
    expect(filtered.some((row) => row.benchmark.version === '1.0')).toBe(false)
  })

  it('requires one explicitly selected protocol group and excludes unequal strict fields', () => {
    const compatibleA = strictObservation(fixtureObservations[0]!, 'strict-a', 'Model A')
    const compatibleB = strictObservation(fixtureObservations[1]!, 'strict-b', 'Model B')
    const mismatchCases = [
      ['version', (row: typeof compatibleA) => { row.benchmark.version = '1.0' }],
      ['task scope', (row: typeof compatibleA) => { row.benchmark.scope = 'subset' }],
      ['harness', (row: typeof compatibleA) => { row.series.harness = 'other-harness' }],
      ['evaluation policy', (row: typeof compatibleA) => { row.series.evaluationPolicy = 'different failure policy' }],
      ['population', (row: typeof compatibleA) => { row.benchmark.population = 'successful attempts only' }],
      ['cost basis', (row: typeof compatibleA) => { row.series.pricingBasis = 'different USD basis' }],
    ] as const
    const incompatible = mismatchCases.map(([label, change], index) => {
      const row = structuredClone(compatibleA)
      row.id = `strict-${label.replaceAll(' ', '-')}-${index}`
      row.series.id = `strict-series:${row.id}`
      change(row)
      return ObservationSchema.parse(row)
    })
    const observations = [compatibleA, compatibleB, ...incompatible]
    const groups = strictProtocolGroups(observations, 'cost', 'mean', 'pass_at_1')
    expect(groups).toHaveLength(7)
    const compatibleGroup = groups.find((group) => group.observations.some((row) => row.id === compatibleA.id))!
    expect(compatibleGroup.observations.map((row) => row.id)).toEqual([compatibleA.id, compatibleB.id])

    const filters = {
      view: 'combined' as const, query: '', selectedModels: [], sources: ['organizer'] as SourceCategory[], version: 'all', harness: 'all', publisher: 'all',
      strict: true, strictGroup: '', statistic: 'mean' as const, scoreMetric: 'pass_at_1' as const,
    }
    expect(filterObservations(observations, filters, 'cost')).toEqual([])
    expect(filterObservations(observations, { ...filters, strictGroup: compatibleGroup.key }, 'cost').map((row) => row.id)).toEqual([compatibleA.id, compatibleB.id])
  })

  it('separates timing bases and excludes a missing selected score metric in strict mode', () => {
    const timeA = strictObservation(fixtureObservations[0]!, 'time-a', 'Model A')
    const timeB = strictObservation(fixtureObservations[1]!, 'time-b', 'Model B')
    timeB.series.timingScope = 'model inference only'
    timeB.metrics.time.scope = 'inference-only seconds per scored attempt'
    timeB.metrics.time.definition = 'inference-only timer'
    const timeGroups = strictProtocolGroups([timeA, timeB], 'time', 'mean', 'pass_at_1')
    expect(timeGroups).toHaveLength(2)

    const noPassAtFour = structuredClone(timeA)
    noPassAtFour.additionalResults = []
    expect(strictExclusionReason(noPassAtFour, 'cost', 'mean', 'pass_at_4')).toBe('selected score metric is not reported')
  })
})
