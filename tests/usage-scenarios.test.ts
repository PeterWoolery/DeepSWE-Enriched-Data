import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { displayScoreResult } from '../src/lib/comparison'
import { DatasetSchema } from '../src/lib/schema'
import { scenarioXValue, usageScenarioForComparison, usageScenarioForObservation, usageScenarios } from '../src/lib/usage-scenarios'
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
    const costPairs = research.costCalibration.openaiMaxPairs as { aaPooledUsdPerTask: number; deepSWEUsdPerScoredAttempt: number }[]
    const costSlope = costPairs.reduce((sum, pair) => sum + pair.aaPooledUsdPerTask * pair.deepSWEUsdPerScoredAttempt, 0)
      / costPairs.reduce((sum, pair) => sum + pair.aaPooledUsdPerTask ** 2, 0)

    expect(lunaScenario.costUsd).toBeCloseTo(0.18 * costSlope, 12)
    expect(lunaScenario.outputTokensPerScoredAttempt).toBeCloseTo(108_271.5634218289, 7)
    expect(lunaScenario.outputTokenSensitivityRange).toBeNull()
    expect(lunaScenario.costSensitivityRange).toEqual([0.18067055413690158, 1.2387750587459414])
    expect(lunaScenario.outputLeaveOneOutMapePercent).toBeNull()
    expect(lunaScenario.costLeaveOneOutMapePercent).toBeCloseTo(46.724032053043665, 8)

    const opusCostPair = research.costCalibration.anthropicOpusFamilyPair
    expect(opusCostPair.ratio).toBe(opusCostPair.deepSWEUsdPerScoredAttempt / opusCostPair.aaPooledUsdPerTask)
    expect(opusScenario.costUsd).toBeCloseTo(13.04 * (opusCostPair.deepSWEUsdPerScoredAttempt / opusCostPair.aaPooledUsdPerTask), 12)
    expect(opusScenario.outputTokensPerScoredAttempt).toBeCloseTo(406_479.005899705, 7)
    expect(opusScenario.costUsd).toBeCloseTo(14.306032053661632, 11)
    expect(opusScenario.outputTokenSensitivityRange).toBeNull()
    expect(opusScenario.costSensitivityRange).toBeNull()
    expect(opusScenario.outputLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.costLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.confidence).toBe('very-low')
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
    expect(usageScenarioForObservation(openAiDeveloper)).toBeNull()
    expect(usageScenarioForObservation(opusDeveloper)).toBeNull()
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
    expect(usageScenarios.map((scenario) => scenario.model)).toEqual([
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
      const direct = research.datacurveDirectMatches.find((row: { configurationId: string }) => row.configurationId === configurationId)!
      expect(scenario.directUsageReference?.configurationId).toBe(configurationId)
      expect(scenario.costUsd).toBe(direct.meanCostUsdPerScoredAttempt)
      expect(scenario.outputTokensPerScoredAttempt).toBe(expectedTokens)
      expect(scenario.timeSecondsPerScoredAttempt).toBe(direct.meanDurationSecondsPerScoredAttempt)
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
    expect(missing).toHaveLength(58)
    expect(scenarioIds.size).toBe(14)
    expect(usageScenarios.length).toBe(17)
    expect(noDataIds.size).toBe(44)
    expect(chartNoDataIds.size).toBe(24)
    expect(unscaledIds.size).toBe(12)
    expect(new Set([...scenarioIds, ...noDataIds]).size).toBe(missing.length)
    expect(missing.every((row) => scenarioIds.has(row.id) || noDataIds.has(row.id))).toBe(true)
    expect([...chartNoDataIds].every((id) => noDataIds.has(id) && ['%', 'fraction'].includes(dataset.observations.find((row) => row.id === id)!.result.reportedUnit))).toBe(true)
    expect([...unscaledIds].every((id) => noDataIds.has(id) && !chartNoDataIds.has(id))).toBe(true)
    expect(usageScenarios.filter((scenario) => scenario.timeSecondsPerScoredAttempt !== null).every((scenario) => scenario.timeSecondsPerScoredAttempt! > 0)).toBe(true)
  })

  it('adds same-row suite-cost proxies and source-reported cost-only scenarios without inventing other metrics', () => {
    const costOnly = usageScenarios.filter((scenario) => scenario.costScenarioType === 'aa-suite-proxy' || scenario.costScenarioType === 'source-reported-cost')
    expect(costOnly).toHaveLength(7)
    expect(costOnly.every((scenario) => scenario.timeSecondsPerScoredAttempt === null)).toBe(true)
    expect(costOnly.filter((scenario) => scenario.outputTokensPerScoredAttempt !== null)).toHaveLength(3)
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
    expect(scenarioXValue(firework, 'outputTokens')).toBeNull()
    expect(scenarioXValue(firework, 'time')).toBeNull()
    expect(research.coverageAudit.costOnlyScenarioObservationIds).toHaveLength(7)
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
      expect(scenario.outputTokensPerScoredAttempt).toBe(input.output?.tokens)
      expect(scenario.outputEvidenceType).toBe('same-source-deepswe-mean')
      expect(scenario.outputUnit).toContain('AA DeepSWE v1.1')
      expect(scenario.costUsd).toBe(input.cost?.usd)
      expect(scenario.costUnit).toContain('three-benchmark suite proxy')
      expect(scenario.timeSecondsPerScoredAttempt).toBeNull()
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
      expect(scenario.costUsd).toBeCloseTo(input.usdPerScoredAttemptScenario, 8)
      expect(scenario.outputTokensPerScoredAttempt).toBeCloseTo(input.outputTokensPerScoredAttemptScenario, 5)
      expect(scenario.timeSecondsPerScoredAttempt).toBeNull()
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
    meta.outputTokenSensitivityRange?.forEach((value, index) => expect(value).toBeCloseTo(metaResearch.targets[0]!.outputSensitivityEnvelope![index]!, 6))
    grok.costSensitivityRange?.forEach((value, index) => expect(value).toBeCloseTo(metaResearch.targets[2]!.costSensitivityEnvelopeUsd![index]!, 8))
    const google = usageScenarioForObservation(dataset.observations.find((row) => row.id === 'google-gemini-3.8-flash-high-v1.1')!)!
    expect(google.directUsageReference?.configurationId).toBe('mini_swe_agent_gemini_3_8_flash_high')
    expect(google.costSensitivityRange).toBeNull()
    const tokenOnly = { ...google, costUsd: null, costUnit: 'not estimated' }
    expect(scenarioXValue(tokenOnly, 'cost')).toBeNull()
    expect(scenarioXValue(tokenOnly, 'outputTokens')).toBe(google.outputTokensPerScoredAttempt)
  })
})
