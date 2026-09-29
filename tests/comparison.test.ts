import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { datacurveChartPrecedence, displayModelName, displayScoreResult, filterObservations, getEfficiencyCoverage, metricObservation, modelKey, projectBest, scoreResult, strictExclusionReason, strictProtocolGroups, type SourceCategory } from '../src/lib/comparison'
import { normalizeOfficialFeed } from '../src/lib/normalize'
import { DatasetSchema, ObservationSchema } from '../src/lib/schema'
import { segmentXY } from '../src/lib/xy'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/official-feed-small.json', import.meta.url), 'utf8'))
const effortOrder = JSON.parse(readFileSync(new URL('../data/sources/effort-order.json', import.meta.url), 'utf8'))
const approvedDataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
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
  it('keeps the five approximate GPT-6.1 Sol source marks linked and separate from other Sol models', () => {
    const rows = approvedDataset.observations.filter((row) => row.model.canonicalId === 'openai:gpt-6.1-sol')
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.effort.reportedLabel)).toEqual(['Setting 1', 'Setting 2', 'Setting 3', 'Setting 4', 'Setting 5'])
    expect(rows.map((row) => [row.metrics.cost.value, row.result.value])).toEqual([[0.2, 0.64], [0.4, 0.72], [0.7, 0.75], [0.8, 0.72], [1.6, 0.71]])
    expect(new Set(rows.map((row) => row.series.id).values()).size).toBe(1)
    const segments = segmentXY(rows.map((row) => ({ id: row.id, x: row.metrics.cost.value, y: row.result.value, effortOrder: row.effort.order })))
    expect(segments.connected).toHaveLength(1)
    expect(segments.connected[0]).toHaveLength(5)
    expect(rows.every((row) => row.approximation && row.metrics.cost.statistic === 'reported' && row.metrics.medianCost.value === null && row.metrics.outputTokens.value === null && row.metrics.time.value === null)).toBe(true)
    expect(rows.every((row) => strictExclusionReason(row, 'cost', 'mean', 'reported_score_unspecified') !== null)).toBe(true)
    expect(projectBest(rows, 'reported_score_unspecified').map((row) => row.effort.reportedLabel)).toEqual(['Setting 3'])
    expect(new Set([modelKey(rows[0]!), 'openai:gpt-6-sol', 'gpt-5-6-sol', 'gpt-6-astra']).size).toBe(4)
  })
  it('formats model strings for display without changing source identity', () => {
    const observation = normalizeOfficialFeed(fixture, retrieval, effortOrder).observations[0]!
    expect(displayModelName('gpt-5-6-sol')).toBe('GPT 5.6 Sol')
    expect(displayModelName('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(modelKey(observation)).toBe('gpt-6-astra')
    expect(observation.model.reportedName).toBe('gpt-6-astra')
  })

  it('applies Datacurve chart precedence before source filters while preserving distinct reports', () => {
    const official = structuredClone(fixtureObservations[0]!)
    official.id = 'fixture-datacurve-astra'
    official.publisher = 'Datacurve'
    official.provenance.sourceId = 'fixture-datacurve'

    const report = structuredClone(official)
    report.id = 'fixture-aa-astra-max'
    report.model.reportedName = 'GPT-6 Astra (max)'
    report.model.canonicalId = null
    report.publisher = 'Artificial Analysis'
    report.sourceCategory = 'independent'
    report.provenance.sourceId = 'fixture-aa'
    report.effort.reportedLabel = 'max'
    report.effort.rawSetting = 'max'
    report.series.harness = 'Codex'
    report.result.metric = 'reported_score_unspecified'
    report.additionalResults = []

    const precedence = datacurveChartPrecedence([official, report], 'fixture-datacurve')
    expect(precedence.get(report.id)).toEqual([official])

    const filteredAfterPrecedence = filterObservations(
      [official, report].filter((observation) => !precedence.has(observation.id)),
      {
        view: 'combined', query: '', selectedModels: [], sources: ['independent'], version: 'all', harness: 'all', publisher: 'all',
        strict: false, strictGroup: '', statistic: 'mean', scoreMetric: 'pass_at_1',
      },
      'cost',
    )
    expect(filteredAfterPrecedence).toEqual([])

    const versionUnknownPaper = structuredClone(report)
    versionUnknownPaper.id = 'fixture-paper-astra-unknown-version'
    versionUnknownPaper.publisher = 'Datacurve'
    versionUnknownPaper.sourceCategory = 'organizer'
    versionUnknownPaper.provenance.sourceId = 'fixture-datacurve-paper'
    versionUnknownPaper.benchmark.version = null
    const versionUnknownSupplemental = structuredClone(report)
    versionUnknownSupplemental.id = 'fixture-fireworks-astra-unknown-version'
    versionUnknownSupplemental.publisher = 'Fireworks AI'
    versionUnknownSupplemental.provenance.sourceId = 'fixture-fireworks'
    versionUnknownSupplemental.series.harness = null
    versionUnknownSupplemental.benchmark.version = null
    const unknownVersionPrecedence = datacurveChartPrecedence([official, versionUnknownSupplemental], 'fixture-datacurve')
    const filteredAfterSourceAndHarness = filterObservations(
      [official, versionUnknownSupplemental].filter((observation) => !unknownVersionPrecedence.has(observation.id)),
      {
        view: 'combined', query: '', selectedModels: [], sources: ['independent'], version: 'all', harness: 'unknown', publisher: 'Fireworks AI',
        strict: false, strictGroup: '', statistic: 'mean', scoreMetric: 'pass_at_1',
      },
      'cost',
    )
    expect(filteredAfterSourceAndHarness).toEqual([])
    official.additionalResults = []
    const differentSnapshot = structuredClone(report)
    differentSnapshot.id = 'fixture-astra-different-snapshot'
    official.model.canonicalId = 'datacurve:gpt-6-astra'
    official.model.snapshot = 'astra-snapshot-a'
    differentSnapshot.model.snapshot = 'astra-snapshot-b'
    const differentVersion = structuredClone(report)
    differentVersion.id = 'fixture-astra-v1.0'
    differentVersion.benchmark.version = '1.0'
    const previewModel = structuredClone(report)
    previewModel.id = 'fixture-astra-preview'
    previewModel.model.reportedName = 'GPT-6 Astra Preview'
    const differentModelVersion = structuredClone(report)
    differentModelVersion.id = 'fixture-gpt-56-astra'
    differentModelVersion.model.reportedName = 'GPT-56 Astra'
    const conflictingCanonicalId = structuredClone(report)
    conflictingCanonicalId.id = 'fixture-astra-conflicting-canonical-id'
    conflictingCanonicalId.model.canonicalId = 'another-model-id'
    const incompatibleMetric = structuredClone(report)
    incompatibleMetric.id = 'fixture-astra-pass-at-four'
    incompatibleMetric.result.metric = 'pass_at_4'
    incompatibleMetric.additionalResults = []
    const incompatibleScope = structuredClone(report)
    incompatibleScope.id = 'fixture-astra-different-task-count'
    incompatibleScope.benchmark.taskCount = 112

    const distinct = datacurveChartPrecedence(
      [official, versionUnknownPaper, versionUnknownSupplemental, differentSnapshot, differentVersion, previewModel, differentModelVersion, conflictingCanonicalId, incompatibleMetric, incompatibleScope],
      'fixture-datacurve',
    )
    expect(distinct.has(versionUnknownPaper.id)).toBe(false)
    expect(distinct.has(versionUnknownSupplemental.id)).toBe(true)
    expect(distinct.has(differentSnapshot.id)).toBe(false)
    expect(distinct.has(differentVersion.id)).toBe(false)
    expect(distinct.has(previewModel.id)).toBe(false)
    expect(distinct.has(differentModelVersion.id)).toBe(false)
    expect(distinct.has(conflictingCanonicalId.id)).toBe(false)
    expect(distinct.has(incompatibleMetric.id)).toBe(false)
    expect(distinct.has(incompatibleScope.id)).toBe(false)
  })

  it('suppresses only the compatible current-snapshot reports and leaves their source rows untouched', () => {
    const suppressed = datacurveChartPrecedence(approvedDataset.observations, approvedDataset.sourceRetrieval.sourceId)
    const researchAudit = JSON.parse(readFileSync(new URL('../data/research/usage-proxy-cross-platform-20260927.json', import.meta.url), 'utf8'))
    expect([...suppressed.keys()].sort()).toEqual([
      'aa-claude-code-opus-5-max-v1.1',
      'aa-claude-code-qwen3.8-max-v1.1',
      'aa-codex-gpt-5.6-luna-max-v1.1',
      'aa-codex-gpt-5.6-sol-max-v1.1',
      'aa-codex-gpt-6-astra-max-v1.1',
      'aa-kimi-code-cli-kimi-k3-v1.1',
      'anthropic-claude-opus-5-high-v1.1',
      'anthropic-claude-opus-5-low-v1.1',
      'anthropic-claude-opus-5-max-v1.1',
      'anthropic-claude-opus-5-medium-v1.1',
      'anthropic-claude-opus-5-xhigh-v1.1',
      'fireworks-deepswe-claude-opus-5-max',
      'fireworks-deepswe-gemini-3.8-flash-high',
      'fireworks-deepswe-gpt-6-astra-xhigh',
      'google-gemini-3.8-flash-high-v1.1',
    ].sort())
    expect([...suppressed.keys()].sort()).toEqual([...researchAudit.coverageAudit.chartPrecedenceSuppressedObservationIds].sort())
    expect(approvedDataset.observations).toHaveLength(133)
    expect(approvedDataset.observations.some((observation) => observation.id === 'datacurve-paper-gpt-5.5-xhigh-version-unknown')).toBe(true)
    expect(suppressed.has('datacurve-paper-gpt-5.5-xhigh-version-unknown')).toBe(false)
    expect(suppressed.has('meta-muse-spark-1.3-v1.1-max')).toBe(false)
    expect(suppressed.has('fireworks-deepswe-gpt-6-astra-xhigh')).toBe(true)
    expect(suppressed.has('fireworks-deepswe-gemini-3.8-flash-high')).toBe(true)
    expect(suppressed.has('fireworks-deepswe-claude-opus-5-max')).toBe(true)
    expect(approvedDataset.observations.find((observation) => observation.id === 'fireworks-deepswe-gpt-6-astra-xhigh')?.benchmark.version).toBeNull()
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
