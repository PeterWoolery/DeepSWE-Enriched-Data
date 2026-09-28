import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CandidateQueueSchema, DatasetSchema, ResolvedCandidateQueueSchema } from '../src/lib/schema'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const candidates = CandidateQueueSchema.parse(JSON.parse(readFileSync(new URL('../data/candidates/queue.json', import.meta.url), 'utf8')))
const resolvedCandidates = ResolvedCandidateQueueSchema.parse(JSON.parse(readFileSync(new URL('../data/candidates/resolved.json', import.meta.url), 'utf8')))
const aliasMap = JSON.parse(readFileSync(new URL('../data/sources/aliases.json', import.meta.url), 'utf8')) as { explicitNonAliases: Array<{ names: string[] }> }

describe('approved observation boundaries', () => {
  it('retains all official configurations and keeps distinct publisher experiments separate', () => {
    const official = dataset.observations.filter((row) => row.provenance.sourceId === dataset.sourceRetrieval.sourceId)
    expect(official.length).toBe(dataset.sourceRetrieval.rowCount)
    expect(new Set(official.map((row) => row.upstreamConfigurationId)).size).toBe(official.length)
    const openAi = dataset.observations.filter((row) => row.provenance.sourceId === 'openai-gpt-6-sol-luna')
    const anthropic = dataset.observations.find((row) => row.id === 'anthropic-claude-opus-5.5-v1.1')!
    const independent = dataset.observations.find((row) => row.id === 'artificial-analysis-claude-code-opus-5.5-max-v1.1')!
    expect(openAi.map((row) => row.model.reportedName)).toEqual(['GPT-6 Sol', 'GPT-6 Luna'])
    expect(openAi.map((row) => row.metrics.cost.value)).toEqual([null, null])
    expect(anthropic.series.id).not.toBe(independent.series.id)
    expect(anthropic.result.value).toBe(0.742)
    expect(anthropic.benchmark.runs).toBe(5)
    expect(anthropic.result.denominatorCount).toBeNull()
    expect(independent.result.value).toBe(0.68)
    const feedSol = dataset.observations.find((row) => row.upstreamConfigurationId?.includes('gpt_5_6_sol_max'))!
    expect(feedSol.model.canonicalId).toBeNull()
    expect(aliasMap.explicitNonAliases.some((pair) => pair.names.includes('GPT-5.6 Sol') && pair.names.includes('GPT-6 Sol'))).toBe(true)
  })

  it('records Meta Muse Spark 1.3 with its task-pass metric and unreported usage/denominator fields', () => {
    const museRows = dataset.observations.filter((row) => row.model.reportedName === 'Muse Spark 1.3')
    expect(museRows).toHaveLength(1)
    const muse = museRows[0]!
    expect(muse.model.snapshot).toBe('muse-spark-1.3')
    expect(muse.benchmark).toMatchObject({ version: '1.1', scope: 'unknown', taskCount: 113, tasksAttempted: null, runs: null })
    expect(muse.result).toMatchObject({
      metric: 'task_pass_rate',
      metricLabel: 'Task pass rate — tasks whose functional and regression tests pass / tasks evaluated',
      value: 0.754,
      reportedValue: 75.4,
      reportedUnit: '%',
      reportedText: '75.4%',
      denominatorCount: null,
    })
    expect(muse.result.confidenceInterval.low).toBeNull()
    expect(muse.result.confidenceInterval.missingReason).toMatch(/does not report an uncertainty interval/i)
    expect(muse.effort.reportedLabel).toBe('max')
    expect(muse.series).toMatchObject({ harness: 'mini-swe-agent', provider: 'Meta Model API', connectable: false })
    expect(Object.values(muse.metrics).every((metric) => metric.value === null)).toBe(true)
    expect(muse.provenance).toMatchObject({
      sourceId: 'meta-muse-spark-1.3-model-page',
      reviewStatus: 'source-reviewed',
      contentSha256: 'ab71ea482b2034c2962a54e86ec8b2e980655009420eee74d704780f2db83bf5',
      publicationDate: '2026-09-02',
    })
    expect(dataset.observations.filter((row) => /muse-spark-1-[12]/i.test(row.model.reportedName))).toHaveLength(2)
  })

  it('does not attach composite costs to score-only reports and keeps the known site/feed mismatch', () => {
    const independent = dataset.observations.find((row) => row.id === 'artificial-analysis-claude-code-opus-5.5-max-v1.1')!
    expect(independent.metrics.cost.value).toBeNull()
    expect(independent.pricing.reconciliationStatus).toBe('not-reported')
    const mismatch = dataset.observations.find((row) => row.upstreamConfigurationId === 'mini_swe_agent_gpt_5_6_sol_max')!
    expect(mismatch.pricing.asReportedCost).toBe(8.386436346666667)
    expect(mismatch.pricing.renderedLeaderboardCost).toBe(6.46)
    expect(mismatch.pricing.reconciliationStatus).toBe('unresolved-discrepancy')
    expect(mismatch.pricing.renderedCostSourceUrl).toBe('https://deepswe.datacurve.ai/')
    expect(mismatch.pricing.renderedCostSourceSha256).toBe('14436c31be1e50a0b62171e4eaa4dd0ae0ce66b1e390af89c7e6e095ad59f1f1')
  })

  it('records reported time coverage but no duration-specific sample count or verified end-to-end scope', () => {
    const official = dataset.observations.filter((row) => row.provenance.sourceId === dataset.sourceRetrieval.sourceId)
    expect(official.every((row) => row.metrics.time.value !== null && row.metrics.medianTime.value !== null)).toBe(true)
    expect(official.every((row) => row.metrics.time.sampleCount === null)).toBe(true)
    expect(official.every((row) => row.metrics.time.sampleCountMissingReason?.includes('duration-specific'))).toBe(true)
    expect(official.every((row) => row.metrics.time.scope?.includes('boundaries unspecified'))).toBe(true)
  })

  it('keeps pending numeric claims outside approved observations and retains resolved-candidate audit records', () => {
    const approvedIds = new Set(dataset.observations.map((row) => row.id))
    expect(candidates.candidates.every((candidate) => candidate.status === 'pending-review' && !approvedIds.has(candidate.id))).toBe(true)
    expect(candidates.candidates.map((candidate) => candidate.id)).toEqual(expect.arrayContaining([
      'candidate-datalearner-qwen3.8-max-0902',
      'candidate-datalearner-step-5-preview',
    ]))
    expect(candidates.candidates).toHaveLength(2)
    expect(resolvedCandidates.candidates).toHaveLength(9)
    expect(resolvedCandidates.candidates.every((candidate) => !approvedIds.has(candidate.id) && approvedIds.has(candidate.matchedObservationId))).toBe(true)
    expect(resolvedCandidates.candidates.every((candidate) => candidate.resolution.length > 0)).toBe(true)
  })

  it('keeps the Anthropic Opus 5 effort series ordered and separates other harness experiments', () => {
    const opusSeries = dataset.observations.filter((row) => row.provenance.sourceId === 'anthropic-opus-5-system-card')
    expect(opusSeries.map((row) => [row.effort.reportedLabel, row.result.value, row.effort.order])).toEqual([
      ['low', 0.577, 0],
      ['medium', 0.669, 1],
      ['high', 0.68, 2],
      ['xhigh', 0.697, 3],
      ['max', 0.688, 4],
    ])
    expect(new Set(opusSeries.map((row) => row.series.id)).size).toBe(1)
    expect(opusSeries.every((row) => row.series.connectable && row.effort.orderEvidence)).toBe(true)
    const deepseek = dataset.observations.filter((row) => row.provenance.sourceId === 'deepseek-v4-1-flash-technical-report')
    expect(deepseek).toHaveLength(8)
    expect(new Set(deepseek.map((row) => row.series.harness)).size).toBe(8)
    expect(new Set(deepseek.map((row) => row.series.id)).size).toBe(8)
    expect(deepseek.every((row) => row.result.metric === 'reported_score_unspecified' && row.result.metricLabel.includes('Resolved'))).toBe(true)
  })

  it('keeps separate source statistics and the Datacurve paper version unknown', () => {
    const mimo = dataset.observations.filter((row) => row.provenance.sourceId === 'mimo-v2-6-technical-report')
    expect(mimo).toHaveLength(4)
    const table3 = mimo.filter((row) => row.provenance.evidenceLocator.includes('Table 3'))
    const averageAtThree = mimo.filter((row) => row.provenance.evidenceLocator.includes('Figure 3'))
    expect(table3.map((row) => row.result.reportedValue)).toEqual([71.9, 67.9])
    expect(averageAtThree.map((row) => row.result.reportedValue)).toEqual([72.57, 65.68])
    expect(new Set(mimo.map((row) => row.series.id)).size).toBe(4)

    const paper = dataset.observations.filter((row) => row.provenance.sourceId === 'datacurve-paper-arxiv-pdf')
    expect(paper).toHaveLength(16)
    expect(paper.every((row) => row.benchmark.version === null && row.benchmark.scope === 'full' && row.benchmark.taskCount === 113)).toBe(true)
    expect(paper.every((row) => row.series.harness === 'mini-swe-agent' && !row.series.connectable)).toBe(true)
    expect(paper.filter((row) => row.additionalResults.some((result) => result.metric === 'pass_at_4'))).toHaveLength(14)
    expect(paper.filter((row) => row.result.confidenceInterval.low !== null)).toHaveLength(3)
  })

  it('keeps separate Artificial Analysis and Fireworks evaluations without transferring suite costs', () => {
    const aa = dataset.observations.filter((row) => row.provenance.sourceId.startsWith('artificial-analysis-'))
    expect(aa.length).toBe(12)
    expect(aa.every((row) => row.metrics.cost.value === null && row.metrics.medianCost.value === null)).toBe(true)
    expect(aa.every((row) => row.metrics.outputTokens.value === null && row.metrics.time.value === null)).toBe(true)
    expect(aa.every((row) => row.provenance.independentReplication === 'not-independently-reproduced')).toBe(true)
    const existingOpus55 = aa.filter((row) => row.model.reportedName === 'Opus 5.5')
    expect(existingOpus55).toHaveLength(1)
    const fireworks = dataset.observations.filter((row) => row.provenance.sourceId === 'fireworks-deepswe-comparison')
    expect(fireworks).toHaveLength(4)
    expect(fireworks.map((row) => row.pricing.asReportedCost)).toEqual([0.43, 6.524, 2.362, 11.838])
    expect(fireworks.every((row) => row.pricing.reconciliationStatus === 'single-source-reported' && row.series.pricingBasis?.includes('Cost/Task'))).toBe(true)
    expect(fireworks.every((row) => row.series.harness === null && row.benchmark.version === null && row.benchmark.scope === 'unknown')).toBe(true)
    expect(fireworks.every((row) => row.metrics.cost.value === null && row.metrics.medianCost.value === null)).toBe(true)
    expect(fireworks.every((row) => row.metrics.cost.missingReason?.includes('aggregation or billing basis'))).toBe(true)
    expect(fireworks.every((row) => row.metrics.outputTokens.value === null && row.metrics.time.value === null)).toBe(true)
    const datacurveAstra = dataset.observations.find((row) => row.id === 'datacurve-v1.1:mini_swe_agent_gpt_6_astra_xhigh')!
    expect(datacurveAstra.pricing.asReportedCost).not.toBe(6.524)
    expect(fireworks.every((row) => row.series.id !== datacurveAstra.series.id)).toBe(true)
    const qwenMax = dataset.observations.find((row) => row.model.reportedName === 'Qwen3.8 Max')!
    expect(qwenMax.result.reportedValue).toBe(51)
    expect(aliasMap.explicitNonAliases.some((pair) => pair.names.includes('Qwen3.8 Max') && pair.names.includes('Qwen3.8-Max-0902'))).toBe(true)
  })

  it('marks source transcription reviewed without claiming independent replication and keeps source-only metrics null', () => {
    const sourceOnlyIds = [
      'anthropic-opus-5-system-card', 'anthropic-fable-5-1-system-card', 'deepseek-v4-1-flash-technical-report',
      'mimo-v2-6-technical-report', 'qwen-3-8-flash-next-card', 'google-gemini-3-8-evaluation',
      'xai-grok-4-7-release', 'tinfield-1-card', 'artificial-analysis-coding-agents',
      'artificial-analysis-codex-kimi-cli', 'datacurve-paper-arxiv-pdf', 'fireworks-deepswe-comparison',
      'meta-muse-spark-1.3-model-page',
    ]
    const rows = dataset.observations.filter((row) => sourceOnlyIds.includes(row.provenance.sourceId))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.provenance.reviewStatus === 'source-reviewed')).toBe(true)
    expect(rows.every((row) => row.provenance.independentReplication === 'not-independently-reproduced')).toBe(true)
    expect(rows.every((row) => row.metrics.cost.value === null && row.metrics.medianCost.value === null)).toBe(true)
    expect(rows.every((row) => row.metrics.outputTokens.value === null && row.metrics.medianOutputTokens.value === null)).toBe(true)
    expect(rows.every((row) => row.metrics.time.value === null && row.metrics.medianTime.value === null)).toBe(true)
  })
})
