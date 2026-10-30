import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { datacurveChartPrecedence, displayScoreResult, metricObservation } from '../src/lib/comparison'
import { DatasetSchema } from '../src/lib/schema'
import { resolveXUsage, scenarioXValue, usageScenarioForComparison, usageScenarioForObservation, usageScenarios } from '../src/lib/usage-scenarios'
import { validateUsageResearch } from '../scripts/validate-data'
import metaResearch from '../data/research/inference-meta-google-xai.json'
import chineseResearch from '../data/research/inference-chinese-models.json'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const research = JSON.parse(readFileSync(new URL('../data/research/usage-proxy-cross-platform-20260927.json', import.meta.url), 'utf8'))
const luna = dataset.observations.find((row) => row.id === 'aa-codex-gpt-6-luna-max-v1.1')!
const opus = dataset.observations.find((row) => row.id === 'artificial-analysis-claude-code-opus-5.5-max-v1.1')!

describe('cross-platform mean usage scenarios', () => {
  it('prefers same-source AA DeepSWE output over transferred output while retaining separate cost evidence', () => {
    const lunaScenario = usageScenarioForObservation(luna)!
    const opusScenario = usageScenarioForObservation(opus)!
    const costPairs = research.costCalibration.openaiMaxPairs as { model: string; effort: string }[]
    const resolvedCostPairs = costPairs.map((pair) => {
      const variant = research.aaCodingAgentVariants.find((row: { model: string; effort: string }) => row.model === pair.model && row.effort === pair.effort)!
      const reference = research.datacurveDirectMatches.find((row: { scenarioModelLabel: string }) => row.scenarioModelLabel === pair.model)!
      const approved = dataset.observations.find((row) => row.upstreamConfigurationId === reference.configurationId)!
      return { aa: variant.pooledCostPerTask.usd, deepSWE: metricObservation(approved, 'cost', 'mean').value! }
    })
    const costSlope = resolvedCostPairs.reduce((sum, pair) => sum + pair.aa * pair.deepSWE, 0)
      / resolvedCostPairs.reduce((sum, pair) => sum + pair.aa ** 2, 0)

    expect(lunaScenario.costUsd).toBeCloseTo(0.18 * costSlope, 12)
    expect(lunaScenario.outputTokensPerScoredAttempt).toBeCloseTo(108_271.5634218289, 7)
    expect(lunaScenario.outputTokenSensitivityRange).toBeNull()
    expect(lunaScenario.costSensitivityRange).toEqual([0.18067055413690158, 1.2387750587459414])
    expect(lunaScenario.outputLeaveOneOutMapePercent).toBeNull()
    expect(lunaScenario.costLeaveOneOutMapePercent).toBeCloseTo(46.724032053043665, 8)

    const opusReference = research.datacurveDirectMatches.find((row: { configurationId: string }) => row.configurationId === 'mini_swe_agent_claude_opus_5_max')!
    const opusApproved = dataset.observations.find((row) => row.upstreamConfigurationId === opusReference.configurationId)!
    const opusCalibrationCost = research.aaCodingAgentVariants.find((row: { model: string }) => row.model === 'Opus 5')!.pooledCostPerTask.usd
    const opus55SuiteCost = research.aaCodingAgentVariants.find((row: { model: string }) => row.model === 'Opus 5.5')!.pooledCostPerTask.usd
    expect(opusScenario.costUsd).toBeCloseTo(opus55SuiteCost * (metricObservation(opusApproved, 'cost', 'mean').value! / opusCalibrationCost), 12)
    expect(opusScenario.outputTokensPerScoredAttempt).toBeCloseTo(406_479.005899705, 7)
    expect(opusScenario.costUsd).toBeCloseTo(14.306032053661632, 11)
    expect(opusScenario.outputTokenSensitivityRange).toBeNull()
    expect(opusScenario.costSensitivityRange).toBeNull()
    expect(opusScenario.outputLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.costLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.confidence).toBe('very-low')
    expect(opusScenario.costCalibrationDescription).toContain('mini_swe_agent_claude_opus_5_max')
    expect(opusScenario.costCalibrationDescription).toContain('cost basis is unspecified')
    expect(opusScenario.timeCalibrationDescription).toContain('mini_swe_agent_claude_opus_5_max')
    expect(opusScenario.timeCalibrationDescription).toContain('1.1h')
    expect(opusScenario.timeCalibrationDescription).toContain('timer boundaries are unspecified')
    expect(opusScenario.timeCalibrationDescription).toContain('not a verified end-to-end duration')
  })

  it('uses per-variant AA DeepSWE output means, not mixed-token totals or cost-to-token conversion', () => {
    const lunaScenario = usageScenarioForObservation(luna)!
    const opusScenario = usageScenarioForObservation(opus)!
    expect(lunaScenario.aaCodingSuiteMixedTokensPerTask).toBe(10_200_000)
    expect(opusScenario.aaCodingSuiteMixedTokensPerTask).toBe(15_600_000)
    expect(lunaScenario.outputTokensPerScoredAttempt).not.toBe(lunaScenario.aaCodingSuiteMixedTokensPerTask)
    expect(opusScenario.outputTokensPerScoredAttempt).not.toBe(opusScenario.aaCodingSuiteMixedTokensPerTask)
    expect(lunaScenario.outputCalibrationDescription).toContain('mean.outputTokens')
    expect(lunaScenario.outputEvidenceType).toBe('same-source-deepswe-mean')
    expect(lunaScenario.costCalibrationDescription).toContain('USD/attempt')
    expect(research.outputTokenCalibration.costToOutputConversionUsed).toBe(false)
    expect(luna.metrics.cost.value).toBeNull()
    expect(luna.metrics.outputTokens.value).toBeNull()
    expect(luna.metrics.time.value).toBeNull()
    expect(opus.metrics.cost.value).toBeNull()
    expect(opus.metrics.outputTokens.value).toBeNull()
    expect(opus.metrics.time.value).toBeNull()
  })

  it('anchors scenarios to exact AA model/effort/source rows without alias inheritance', () => {
    expect(usageScenarioForObservation(luna)?.targetObservationId).toBe(luna.id)
    expect(usageScenarioForObservation(opus)?.targetObservationId).toBe(opus.id)
    expect(luna.model.reportedName).toBe('GPT-6 Luna (max)')
    expect(luna.effort.reportedLabel).toBe('max')
    expect(luna.series.harness).toBe('Codex')
    expect(opus.model.reportedName).toBe('Opus 5.5')
    expect(opus.effort.reportedLabel).toBe('max')
    expect(opus.series.harness).toBe('Claude Code')
    expect(displayScoreResult(luna, 'pass_at_4')).toBe(luna.result)
    expect(luna.result.metricLabel).toContain('Artificial Analysis per-benchmark score')
    expect(displayScoreResult(opus, 'reported_score_unspecified')).toBe(opus.result)
    expect(opus.result.metricLabel).toContain('Artificial Analysis per-benchmark score')

    const openAiDeveloper = dataset.observations.find((row) => row.id === 'openai-gpt-6-luna-v1.1-max')!
    const opusDeveloper = dataset.observations.find((row) => row.id === 'anthropic-claude-opus-5.5-v1.1')!
    const opusFive = dataset.observations.find((row) => row.id === 'datacurve-v1.1:mini_swe_agent_claude_opus_5_max')!
    const oldLunaCalibration = dataset.observations.find((row) => row.id === 'datacurve-v1.1:mini_swe_agent_gpt_5_6_luna_max')!
    expect(usageScenarioForObservation(openAiDeveloper)?.targetObservationId).toBe(openAiDeveloper.id)
    expect(usageScenarioForObservation(opusDeveloper)?.confidenceNote).toContain('sensitivity assumption')
    expect(usageScenarioForObservation(opusFive)).toBeNull()
    expect(usageScenarioForObservation(oldLunaCalibration)).toBeNull()

    const unknownEffort = structuredClone(luna)
    unknownEffort.effort.reportedLabel = null
    unknownEffort.effort.rawSetting = null
    expect(usageScenarioForObservation(unknownEffort)).toBeNull()
    const wrongHarness = structuredClone(opus)
    wrongHarness.series.harness = 'unknown'
    expect(usageScenarioForObservation(wrongHarness)).toBeNull()
  })

  it('excludes strict and median scenarios while supporting calibrated mean time', () => {
    expect(usageScenarioForComparison(luna, 'cost', 'mean', false)?.costUsd).toBeCloseTo(0.20668317244049378, 12)
    expect(usageScenarioForComparison(luna, 'outputTokens', 'mean', false)?.outputTokensPerScoredAttempt).toBeCloseTo(108_271.5634218289, 7)
    expect(usageScenarioForComparison(luna, 'time', 'mean', false)?.timeSecondsPerScoredAttempt).toBeCloseTo(1097.5267854181109, 7)
    expect(usageScenarioForComparison(luna, 'cost', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'outputTokens', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'time', 'mean', false)?.timeSecondsPerScoredAttempt).toBeCloseTo(3011.458500508611, 7)
    expect(usageScenarioForComparison(opus, 'time', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'cost', 'mean', true)).toBeNull()
    expect(scenarioXValue(usageScenarioForObservation(luna)!, 'cost')).toBeCloseTo(0.20668317244049378, 12)
    expect(scenarioXValue(usageScenarioForObservation(opus)!, 'outputTokens')).toBeCloseTo(406_479.005899705, 7)
    expect(scenarioXValue(usageScenarioForObservation(luna)!, 'time')).toBeCloseTo(1097.5267854181109, 7)
    expect(usageScenarios.slice(0, 17).map((scenario) => scenario.model)).toEqual([
      'GPT-6 Luna', 'Opus 5.5', 'GPT-6 Astra', 'GPT-6 Sol', 'Opus 5', 'GPT-5.6 Sol', 'GPT-5.6 Luna',
      'Fable 5.1 (max) (with fallback)', 'DeepSeek V4 Pro 0813', 'DeepSeek V4 Flash 0731',
      'DeepSeek V4.1-Flash', 'GPT-6-Astra', 'Gemini 3.8 Flash', 'Claude Opus 5',
      'Muse Spark 1.3', 'Gemini 3.8 Flash', 'Grok 4.7',
    ])
  })

  it('uses exact-AA-variant DeepSWE means, keeping separate Datacurve references for costs and time', () => {
    const targets = [
      ['aa-codex-gpt-6-astra-max-v1.1', 'mini_swe_agent_gpt_6_astra_max', 56420.18289085546],
      ['aa-claude-code-opus-5-max-v1.1', 'mini_swe_agent_claude_opus_5_max', 129793.94690265486],
      ['aa-codex-gpt-5.6-sol-max-v1.1', 'mini_swe_agent_gpt_5_6_sol_max', 56943.890855457226],
      ['aa-codex-gpt-5.6-luna-max-v1.1', 'mini_swe_agent_gpt_5_6_luna_max', 75781.00294985251],
    ] as const
    for (const [targetId, configurationId, expectedTokens] of targets) {
      const scenario = usageScenarioForObservation(dataset.observations.find((row) => row.id === targetId)!)!
      expect(scenario.directUsageReference?.configurationId).toBe(configurationId)
      const official = dataset.observations.find((row) => row.upstreamConfigurationId === configurationId)!
      expect(scenario.costUsd).toBe(metricObservation(official, 'cost', 'mean').value)
      expect(scenario.outputTokensPerScoredAttempt).toBe(expectedTokens)
      expect(scenario.timeSecondsPerScoredAttempt).toBe(metricObservation(official, 'time', 'mean').value)
      expect(scenario.costSensitivityRange).toBeNull()
      expect(scenario.timeSensitivityRange).toBeNull()
    }

    const sol = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'aa-codex-gpt-6-sol-max-v1.1')!)!
    expect(sol.timeSecondsPerScoredAttempt).toBeCloseTo(1143.6844539637325, 7)
    expect(sol.timeSensitivityRange).toEqual([1065.6050486855338, 1221.763859241931])
  })

  it('accounts for every baseline observation missing all three usage metrics', () => {
    const audit = research.coverageAudit
    const missing = dataset.observations.filter((row) => row.metrics.cost.value === null && row.metrics.outputTokens.value === null && row.metrics.time.value === null)
    const scenarioIds = new Set(audit.scenarioObservationIds as string[])
    const noDataIds = new Set(audit.noDataObservationIds as string[])
    const chartNoDataIds = new Set(audit.chartNoDataLaneObservationIds as string[])
    const unscaledIds = new Set(audit.unscaledNoDataScoreObservationIds as string[])
    expect(missing).toHaveLength(63)
    expect(scenarioIds.size).toBe(50)
    expect(usageScenarios.length).toBe(50)
    expect(noDataIds.size).toBe(13)
    expect(chartNoDataIds.size).toBe(10)
    expect(unscaledIds.size).toBe(3)
    expect(new Set([...scenarioIds, ...noDataIds]).size).toBe(missing.length)
    expect(missing.every((row) => scenarioIds.has(row.id) || noDataIds.has(row.id))).toBe(true)
    expect([...scenarioIds].every((id) => !noDataIds.has(id) && usageScenarios.some((scenario) => scenario.targetObservationId === id))).toBe(true)
    for (const metric of ['cost', 'outputTokens', 'time'] as const) {
      const remaining = dataset.observations.filter((row) => resolveXUsage(row, metric, 'mean', { scenariosEnabled: true }).value === null)
      expect(remaining.length).toBe(audit.perMetricCoverage[metric].remaining)
      expect(new Set([...audit.noDataObservationIds, ...audit.partialRemainingGaps.filter((gap: { metrics: string[] }) => gap.metrics.includes(metric)).flatMap((gap: { observationIds: string[] }) => gap.observationIds)])).toEqual(new Set(remaining.map((row) => row.id)))
    }
    expect([...chartNoDataIds].every((id) => noDataIds.has(id) && ['%', 'fraction'].includes(dataset.observations.find((row) => row.id === id)!.result.reportedUnit))).toBe(true)
    expect([...unscaledIds].every((id) => noDataIds.has(id) && !chartNoDataIds.has(id))).toBe(true)
    expect(usageScenarios.filter((scenario) => scenario.timeSecondsPerScoredAttempt !== null).every((scenario) => scenario.timeSecondsPerScoredAttempt! > 0)).toBe(true)
  })

  it('adds same-row suite-cost proxies and source-reported cost-only scenarios without inventing other metrics', () => {
    const costOnly = usageScenarios.filter((scenario) => scenario.costScenarioType === 'aa-suite-proxy' || scenario.costScenarioType === 'source-reported-cost')
    expect(costOnly).toHaveLength(7)
    expect(costOnly.every((scenario) => scenario.timeSecondsPerScoredAttempt! > 0)).toBe(true)
    expect(costOnly.filter((scenario) => scenario.outputTokensPerScoredAttempt !== null)).toHaveLength(7)
    expect(costOnly.every((scenario) => scenario.costSensitivityRange === null)).toBe(true)

    const aaCosts = costOnly.filter((scenario) => scenario.costScenarioType === 'aa-suite-proxy')
    expect(aaCosts.map((scenario) => [scenario.targetObservationId, scenario.costUsd])).toEqual([
      ['aa-claude-code-fable-5.1-max-v1.1', 12.39],
      ['aa-codex-deepseek-v4-pro-0813-max-v1.1', 0.24],
      ['aa-codex-deepseek-v4-flash-0731-max-v1.1', 0.09],
    ])
    expect(aaCosts.every((scenario) => scenario.costUnit.includes('three-benchmark suite proxy'))).toBe(true)
    expect(aaCosts.every((scenario) => scenario.scenarioStatistic === 'pooled-suite-average')).toBe(true)

    const fireworksCosts = costOnly.filter((scenario) => scenario.costScenarioType === 'source-reported-cost')
    expect(fireworksCosts.map((scenario) => [scenario.targetObservationId, scenario.costUsd])).toEqual([
      ['fireworks-deepswe-deepseek-v4.1-flash-max', 0.43],
      ['fireworks-deepswe-gpt-6-astra-xhigh', 6.524],
      ['fireworks-deepswe-gemini-3.8-flash-high', 2.362],
      ['fireworks-deepswe-claude-opus-5-max', 11.838],
    ])
    for (const scenario of fireworksCosts) {
      const target = dataset.observations.find((row) => row.id === scenario.targetObservationId)!
      expect(usageScenarioForObservation(target)?.costUsd).toBe(target.pricing.asReportedCost)
      expect(scenario.scenarioStatistic).toBe('source-statistic-unspecified')
      expect(target.metrics.cost.value).toBeNull()
      expect(target.metrics.outputTokens.value).toBeNull()
      expect(target.metrics.time.value).toBeNull()
    }

    const firework = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'fireworks-deepswe-gpt-6-astra-xhigh')!)!
    expect(scenarioXValue(firework, 'cost')).toBe(6.524)
    expect(scenarioXValue(firework, 'outputTokens')).toBeGreaterThan(0)
    expect(scenarioXValue(firework, 'time')).toBeGreaterThan(0)
    expect(research.coverageAudit.costOnlyScenarioObservationIds).toHaveLength(0)
    const fable = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'aa-claude-code-fable-5.1-max-v1.1')!)!
    expect(fable.outputTokensPerScoredAttempt).toBeCloseTo(155542.35398230088, 6)
    expect(fable.outputEvidenceType).toBe('same-source-deepswe-mean')
    expect(fable.outputStatistic).toBe('source-deepswe-mean')
    expect(fable.scenarioStatistic).toBe('pooled-suite-average')
    expect(fable.costUsd).toBe(12.39)
    expect(fable.costUnit).toContain('three-benchmark suite proxy')
  })

  it('uses AA per-benchmark output means on exact DeepSeek snapshots, independently of pooled-suite dollars', () => {
    for (const input of chineseResearch.targets.slice(0, 2)) {
      const row = dataset.observations.find((observation) => observation.id === input.id)!
      const scenario = usageScenarioForObservation(row)!
      const fact = research.usageFacts.find((candidate: { id: string }) => candidate.id === input.output?.factId)!
      expect(scenario.outputTokensPerScoredAttempt).toBe(fact.value)
      expect(input.output?.factId).toBeTruthy()
      expect(scenario.outputEvidenceType).toBe('same-source-deepswe-mean')
      expect(scenario.outputUnit).toContain('AA DeepSWE v1.1')
      expect(scenario.costUsd).toBe(input.cost?.usd)
      expect(scenario.costUnit).toContain('three-benchmark suite proxy')
      expect(scenario.timeSecondsPerScoredAttempt).toBeGreaterThan(0)
      expect(row.metrics.outputTokens.value).toBeNull()
      expect(usageScenarioForComparison(row, 'outputTokens', 'median', false)).toBeNull()
      expect(usageScenarioForComparison(row, 'outputTokens', 'mean', true)).toBeNull()
      const wrongSnapshot = structuredClone(row)
      wrongSnapshot.model.reportedName += ' updated'
      expect(usageScenarioForObservation(wrongSnapshot)).toBeNull()
    }
  })

  it('recomputes distinct Meta/xAI transfers and keeps Google high thinking a separate cross-run reference', () => {
    for (const input of metaResearch.targets) {
      const observation = dataset.observations.find((row) => row.id === input.observationId)!
      const scenario = usageScenarioForObservation(observation)!
      if (input.observationId.startsWith('google-')) {
        const direct = dataset.observations.find((row) => row.upstreamConfigurationId === input.directReferenceConfig)!
        expect(scenario.costUsd).toBe(metricObservation(direct, 'cost', 'mean').value)
        expect(scenario.outputTokensPerScoredAttempt).toBe(metricObservation(direct, 'outputTokens', 'mean').value)
      } else {
        const group = input.calibrationGroup === 'meta' ? metaResearch.calibration.meta : metaResearch.calibration.xai
        const cost = group.reduce((sum, row) => sum + row.meanUsdPerScoredAttempt / row.aaIIUsdPerTask * input.aaIIUsdPerTask!, 0) / group.length
        const output = group.reduce((sum, row) => sum + row.meanOutputTokensPerScoredAttempt / row.aaIITotalOutputMillions * input.aaIITotalOutputMillions!, 0) / group.length
        expect(scenario.costUsd).toBeCloseTo(cost, 8)
        expect(scenario.outputTokensPerScoredAttempt).toBeCloseTo(output, 5)
      }
      if (input.observationId.startsWith('xai-')) expect(scenario.timeSecondsPerScoredAttempt).toBeNull()
      else expect(scenario.timeSecondsPerScoredAttempt).toBeGreaterThan(0)
      expect(scenario.outputEvidenceType).toBe(input.observationId.startsWith('google-') ? 'cross-experiment-reference' : 'cross-benchmark-transfer')
      expect(observation.metrics.cost.value).toBeNull()
      expect(observation.metrics.outputTokens.value).toBeNull()
      expect(usageScenarioForComparison(observation, 'cost', 'median', false)).toBeNull()
      const wrongEffort = structuredClone(observation)
      wrongEffort.effort.rawSetting = 'default'
      expect(usageScenarioForObservation(wrongEffort)).toBeNull()
    }
    const meta = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'meta-muse-spark-1.3-v1.1-max')!)!
    const grok = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'xai-grok-4.7-high-v1.1')!)!
    expect(meta.outputLeaveOneOutMapePercent).toBeCloseTo(59.14610401685732, 5)
    expect(grok.costLeaveOneOutMapePercent).toBeCloseTo(1.47964379585927, 5)
    expect(meta.outputCalibrationDescription).toContain('Meta predecessors are xhigh while the target is max')
    expect(grok.outputCalibrationDescription).toContain('Grok predecessors and target are all high effort')
    expect(grok.outputCalibrationDescription).not.toContain('xhigh→max')
    meta.outputTokenSensitivityRange?.forEach((value, index) => expect(value).toBeCloseTo(metaResearch.targets[0]!.historicalComputedDiagnostics!.outputSensitivityEnvelope[index]!, 6))
    grok.costSensitivityRange?.forEach((value, index) => expect(value).toBeCloseTo(metaResearch.targets[2]!.historicalComputedDiagnostics!.costSensitivityEnvelopeUsd[index]!, 8))
    const google = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'google-gemini-3.8-flash-high-v1.1')!)!
    expect(google.directUsageReference?.configurationId).toBe('mini_swe_agent_gemini_3_8_flash_high')
    expect(google.costSensitivityRange).toBeNull()
    const tokenOnly = { ...google, costUsd: null, costUnit: 'not estimated' }
    expect(scenarioXValue(tokenOnly, 'cost')).toBeNull()
    expect(scenarioXValue(tokenOnly, 'outputTokens')).toBe(google.outputTokensPerScoredAttempt)
  })

  it('preserves all existing non-null per-metric values and methods while extending only gaps', () => {
    const baseline = [
      ['aa-codex-gpt-6-luna-max-v1.1', 0.20668317244049378, 108271.5634218289, 1097.5267854181109, 'openai-max-through-origin-proportional-fit', 'same-aa-variant-deepswe-mean', 'openai-max-arithmetic-mean-ratio'],
      ['artificial-analysis-claude-code-opus-5.5-max-v1.1', 14.306032053661632, 406479.005899705, 3011.458500508611, 'opus-5-max-single-pair-ratio', 'same-aa-variant-deepswe-mean', 'opus-5-max-single-pair-ratio'],
      ['aa-codex-gpt-6-astra-max-v1.1', 7.497827996681416, 56420.18289085546, 1982.966814159292, 'exact-model-effort-deepswe-reference', 'same-aa-variant-deepswe-mean', 'exact-model-effort-deepswe-reference'],
      ['aa-codex-gpt-6-sol-max-v1.1', 3.4332371422059804, 70300.33038348083, 1143.6844539637325, 'openai-max-through-origin-proportional-fit', 'same-aa-variant-deepswe-mean', 'openai-max-arithmetic-mean-ratio'],
      ['aa-claude-code-opus-5-max-v1.1', 11.837583271396396, 129793.94690265486, 1911.819866231982, 'exact-model-effort-deepswe-reference', 'same-aa-variant-deepswe-mean', 'exact-model-effort-deepswe-reference'],
      ['aa-codex-gpt-5.6-sol-max-v1.1', 8.386436346666667, 56943.890855457226, 1128.624910331111, 'exact-model-effort-deepswe-reference', 'same-aa-variant-deepswe-mean', 'exact-model-effort-deepswe-reference'],
      ['aa-codex-gpt-5.6-luna-max-v1.1', 3.028116810267857, 75781.00294985251, 1122.9470243995536, 'exact-model-effort-deepswe-reference', 'same-aa-variant-deepswe-mean', 'exact-model-effort-deepswe-reference'],
      ['aa-claude-code-fable-5.1-max-v1.1', 12.39, 155542.35398230088, null, 'same-row-aa-coding-agent-suite-cost-proxy', 'same-aa-variant-deepswe-mean', 'not-estimated'],
      ['aa-codex-deepseek-v4-pro-0813-max-v1.1', 0.24, 116676.62241887905, null, 'same-row-aa-coding-agent-suite-cost-proxy', 'same-aa-variant-deepswe-mean', 'not-estimated'],
      ['aa-codex-deepseek-v4-flash-0731-max-v1.1', 0.09, 97092.21238938053, null, 'same-row-aa-coding-agent-suite-cost-proxy', 'same-aa-variant-deepswe-mean', 'not-estimated'],
      ['fireworks-deepswe-deepseek-v4.1-flash-max', 0.43, null, null, 'same-row-source-reported-cost-task', 'not-estimated', 'not-estimated'],
      ['fireworks-deepswe-gpt-6-astra-xhigh', 6.524, null, null, 'same-row-source-reported-cost-task', 'not-estimated', 'not-estimated'],
      ['fireworks-deepswe-gemini-3.8-flash-high', 2.362, null, null, 'same-row-source-reported-cost-task', 'not-estimated', 'not-estimated'],
      ['fireworks-deepswe-claude-opus-5-max', 11.838, null, null, 'same-row-source-reported-cost-task', 'not-estimated', 'not-estimated'],
      ['meta-muse-spark-1.3-v1.1-max', 4.41661736979991, 101882.99744724302, null, 'two-predecessor-aa-ii-cost-transfer', 'two-predecessor-aa-ii-aggregate-output-transfer', 'not-estimated'],
      ['google-gemini-3.8-flash-high-v1.1', 2.362349413758389, 143242.6644295302, null, 'separate-experiment-same-model-effort-deepswe-reference', 'separate-experiment-same-model-effort-deepswe-reference', 'not-estimated'],
      ['xai-grok-4.7-high-v1.1', 6.38860063277689, 111201.62926772011, null, 'two-predecessor-aa-ii-cost-transfer', 'two-predecessor-aa-ii-aggregate-output-transfer', 'not-estimated'],
    ]
    for (const [id, cost, output, time, costMethod, outputMethod, timeMethod] of baseline) {
      const scenario = usageScenarios.find((row) => row.targetObservationId === id)!
      expect(scenario.costUsd).toBe(cost)
      expect(scenario.costCalibrationMethod).toBe(costMethod)
      if (output !== null) {
        expect(scenario.outputTokensPerScoredAttempt).toBe(output)
        expect(scenario.outputCalibrationMethod).toBe(outputMethod)
      }
      if (time !== null) {
        expect(scenario.timeSecondsPerScoredAttempt).toBe(time)
        expect(scenario.timeCalibrationMethod).toBe(timeMethod)
      }
    }
    expect(dataset.revisionId).toBe('dsv1.1-6684672fe564da3e')
    expect(dataset.observations).toHaveLength(138)
    expect(dataset.observations.filter((row) => row.provenance.sourceId === dataset.sourceRetrieval.sourceId)).toHaveLength(70)
    expect(dataset.observations.filter((row) => row.provenance.sourceId !== dataset.sourceRetrieval.sourceId)).toHaveLength(68)
    expect(['cost', 'outputTokens', 'time'].map((metric) => dataset.observations.filter((row) => metricObservation(row, metric as 'cost' | 'outputTokens' | 'time', 'mean').value !== null).length)).toEqual([75, 70, 70])
    expect(['cost', 'outputTokens', 'time'].map((metric) => usageScenarios.filter((scenario) => scenarioXValue(scenario, metric as 'cost' | 'outputTokens' | 'time') !== null).length)).toEqual([49, 50, 49])
    const suppressed = datacurveChartPrecedence(dataset.observations, dataset.sourceRetrieval.sourceId)
    expect(new Set(research.coverageAudit.chartPrecedenceSuppressedObservationIds)).toEqual(new Set(dataset.observations.filter((row) => row.metrics.cost.value === null && row.metrics.outputTokens.value === null && row.metrics.time.value === null && suppressed.has(row.id)).map((row) => row.id)))
  })

  it('resolves approved metrics before optional references, retaining per-metric fallbacks', () => {
    const measured = structuredClone(luna)
    measured.metrics.outputTokens = { ...measured.metrics.outputTokens, value: 1234, missingReason: null, statistic: 'mean' }
    const directOutput = resolveXUsage(measured, 'outputTokens', 'mean', { scenariosEnabled: true })
    expect(directOutput).toMatchObject({ value: 1234, evidenceKind: 'approved-measurement', sourceIds: [measured.provenance.sourceId] })
    expect(directOutput.alternatives[0]).toMatchObject({ value: 108271.5634218289, evidenceKind: 'same-source-reference', eligible: true })

    const cost = resolveXUsage(measured, 'cost', 'mean', { scenariosEnabled: true })
    expect(cost).toMatchObject({ value: 0.20668317244049378, evidenceKind: 'configured-fallback', method: 'openai-max-through-origin-proportional-fit' })
    expect(cost.sourceIds).toContain('datacurve-v1.1-json')
  })

  it('derives II transfers reproducibly from actual same-model OpenAI usage, independently for each metric', () => {
    const target = dataset.observations.find((row) => row.id === 'mistral-large-4-preview-v1.1')!
    const scenario = usageScenarioForObservation(target)!
    const extension = research.efficiencyExtension
    const reference = extension.references.find((row: { id: string }) => row.id === 'ii-mistral-large-4')!
    const pairs = (metric: 'cost' | 'outputTokens' | 'time') => extension.iiAnchors.filter((anchor: { metrics: string[] }) => anchor.metrics.includes(metric)).map((anchor: { referenceId: string; configurationId: string }) => ({
      aa: extension.references.find((row: { id: string }) => row.id === anchor.referenceId)[metric],
      measured: metricObservation(dataset.observations.find((row) => row.upstreamConfigurationId === anchor.configurationId)!, metric, 'mean').value!,
    }))
    const costs = pairs('cost')
    expect(scenario.costUsd).toBeCloseTo(reference.cost * costs.reduce((sum: number, row: { aa: number; measured: number }) => sum + row.aa * row.measured, 0) / costs.reduce((sum: number, row: { aa: number }) => sum + row.aa ** 2, 0), 12)
    for (const metric of ['outputTokens', 'time'] as const) {
      const rows = pairs(metric)
      expect(scenarioXValue(scenario, metric)).toBeCloseTo(reference[metric] * rows.reduce((sum: number, row: { aa: number; measured: number }) => sum + row.measured / row.aa, 0) / rows.length, 8)
    }
    expect(scenario.sources.every((source) => source.responseSha256 === null || /^[a-f0-9]{64}$/.test(source.responseSha256))).toBe(true)
    expect(scenario.outputCalibrationDescription).toContain('reasoning plus answer')
    expect(scenario.timeCalibrationDescription).toContain('not a verified end-to-end duration')
    expect(scenario.costSensitivityRange).toBeNull()
    expect(scenario.outputLeaveOneOutMapePercent).toBeNull()
    const measured = structuredClone(target)
    measured.metrics.time = { ...measured.metrics.time, value: 17, statistic: 'mean', missingReason: null }
    expect(resolveXUsage(measured, 'time', 'mean', { scenariosEnabled: true })).toMatchObject({ value: 17, evidenceKind: 'approved-measurement' })
    expect(usageScenarioForComparison(target, 'time', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(target, 'time', 'mean', true)).toBeNull()
  })

  it('uses exact AA coding output for latest models and leaves unsupported metrics and variants unknown', () => {
    for (const [targetId, referenceId] of [['google-gemini-4-argon-v1.1', 'coding-gemini-4'], ['anthropic-claude-sonnet-5.5-v1.1', 'coding-sonnet-5-5']]) {
      const target = dataset.observations.find((row) => row.id === targetId)!
      const scenario = usageScenarioForObservation(target)!
      const reference = research.efficiencyExtension.references.find((row: { id: string }) => row.id === referenceId)!
      expect(scenario.outputTokensPerScoredAttempt).toBe(reference.outputTokens)
      expect(scenario.outputEvidenceType).toBe('cross-experiment-reference')
      expect(scenario.costUsd).toBeCloseTo(reference.cost * 1.1482398468916322, 11)
      expect(scenario.timeSecondsPerScoredAttempt).toBeCloseTo(reference.time * 0.8547716397337312, 9)
      expect(target.metrics.cost.value).toBeNull()
      expect(scenario.outputCalibrationDescription).toContain('separate-experiment')
    }
    for (const id of research.coverageAudit.noDataObservationIds) expect(usageScenarioForObservation(dataset.observations.find((row) => row.id === id)!)).toBeNull()
    const mini = dataset.observations.find((row) => row.id === 'datacurve-paper-minimax-m2.7-default-version-unknown')!
    expect(resolveXUsage(mini, 'cost', 'mean', { scenariosEnabled: true }).value).toBeNull()
    expect(resolveXUsage(mini, 'outputTokens', 'mean', { scenariosEnabled: true }).value).toBeGreaterThan(0)
    const mimo = usageScenarios.find((row) => row.targetObservationId === 'xiaomi-mimo-v2.6-pro-table3-v1.1')!
    const averageAt3 = usageScenarios.find((row) => row.targetObservationId === 'xiaomi-mimo-v2.6-pro-average-at-3-endpoint-v1.1')!
    expect(averageAt3.costUsd).toBe(mimo.costUsd)
    expect(averageAt3.confidenceNote).toContain('do not multiply by three')
    const wrongEffort = structuredClone(research)
    wrongEffort.efficiencyExtension.targets.find((row: { observationId: string }) => row.observationId === 'anthropic-claude-opus-5-low-v1.1').referenceId = 'ii-opus-5-high'
    expect(() => validateUsageResearch(dataset, wrongEffort)).toThrow(/model\/effort mismatch/)
    const missingCost = structuredClone(research)
    missingCost.efficiencyExtension.targets.find((row: { observationId: string }) => row.observationId === mini.id).metrics.push('cost')
    expect(() => validateUsageResearch(dataset, missingCost)).toThrow(/Unsupported efficiency metric/)
  })

  it('gates optional means by toggle/strict/statistic and preserves valid zero without fallback', () => {
    const toggleOff = resolveXUsage(luna, 'cost', 'mean')
    expect(toggleOff).toMatchObject({ value: null, evidenceKind: 'no-data' })
    expect(toggleOff.reason).toContain('disabled')
    expect(resolveXUsage(luna, 'cost', 'mean', { scenariosEnabled: true, strict: true }).reason).toContain('strict')
    expect(resolveXUsage(luna, 'cost', 'median', { scenariosEnabled: true }).reason).toContain('mean-only')

    const measuredZero = structuredClone(luna)
    measuredZero.metrics.cost = { ...measuredZero.metrics.cost, value: 0, missingReason: null, statistic: 'mean' }
    const zero = resolveXUsage(measuredZero, 'cost', 'mean', { scenariosEnabled: true })
    expect(zero).toMatchObject({ value: 0, evidenceKind: 'approved-measurement' })
    expect(zero.alternatives[0]).toMatchObject({ value: 0.20668317244049378, eligible: true })
  })

  it('rejects altered exact identities and exposes revision-pinned fact/hash metadata', () => {
    for (const mutate of [
      (row: typeof luna) => { row.provenance.sourceId = 'another-source' },
      (row: typeof luna) => { row.model.snapshot = 'unknown-snapshot' },
      (row: typeof luna) => { row.effort.rawSetting = 'default' },
      (row: typeof luna) => { row.series.harness = 'another-harness' },
      (row: typeof luna) => { row.benchmark.version = '2.0' },
    ]) {
      const changed = structuredClone(luna)
      mutate(changed)
      expect(usageScenarioForObservation(changed)).toBeNull()
    }
    expect(usageScenarioForObservation(luna, 'another-revision')).toBeNull()
    const facts = research.usageFacts as { id: string; value: number; evidence: { responseSha256: string | null; hashStatus: string; historicalMalformedSha256?: string }; identity: { displayLabel: string; datasetIndexName: string } }[]
    expect(facts).toHaveLength(10)
    expect(facts.find((fact) => fact.id === 'aa-output-gpt-6-sol-max')?.evidence).toMatchObject({ responseSha256: null, hashStatus: 'malformed-historical' })
    expect(facts.find((fact) => fact.id === 'aa-output-gpt-6-sol-max')?.evidence.historicalMalformedSha256).toHaveLength(57)
    expect(facts.every((fact) => fact.identity.datasetIndexName === 'deep-swe-v1.1' && fact.identity.displayLabel.length > 0)).toBe(true)
    expect(research.scenarioConfig.approvedDatasetRevision).toBe('dsv1.1-6684672fe564da3e')
  })

  it('rejects known-but-unbound sources, empty provenance and substituted AA variants', () => {
    const unboundSource = structuredClone(research)
    const lunaConfig = unboundSource.scenarioConfig.targets.find((target: { observationId: string }) => target.observationId === luna.id)!
    lunaConfig.metrics.outputTokens.sourceIds = ['aa-claude-code-vs-codex']
    expect(() => validateUsageResearch(dataset, unboundSource)).toThrow(/source IDs do not match fact\/evidence provenance/)

    const missingSource = structuredClone(research)
    const missingSourceConfig = missingSource.scenarioConfig.targets.find((target: { observationId: string }) => target.observationId === luna.id)!
    missingSourceConfig.metrics.outputTokens.sourceIds = []
    expect(() => validateUsageResearch(dataset, missingSource)).toThrow(/has no source IDs/)

    const substitutedVariant = structuredClone(research)
    const lunaFact = substitutedVariant.usageFacts.find((fact: { id: string }) => fact.id === 'aa-output-gpt-6-luna-max')!
    lunaFact.identity.reportedModel = 'GPT-6 Astra'
    lunaFact.identity.displayLabel = 'Codex - GPT-6 Astra (max)'
    lunaFact.identity.variantKey = 'codex-gpt-6-astra-max'
    expect(() => validateUsageResearch(dataset, substitutedVariant)).toThrow(/Variant identity .* does not match/)
  })
})
