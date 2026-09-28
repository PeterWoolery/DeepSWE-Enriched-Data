import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { displayScoreResult } from '../src/lib/comparison'
import { DatasetSchema } from '../src/lib/schema'
import { scenarioXValue, usageScenarioForComparison, usageScenarioForObservation, usageScenarios } from '../src/lib/usage-scenarios'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const research = JSON.parse(readFileSync(new URL('../data/research/usage-proxy-cross-platform-20260927.json', import.meta.url), 'utf8'))
const luna = dataset.observations.find((row) => row.id === 'aa-codex-gpt-6-luna-max-v1.1')!
const opus = dataset.observations.find((row) => row.id === 'artificial-analysis-claude-code-opus-5.5-max-v1.1')!

describe('cross-platform mean usage scenarios', () => {
  it('reproduces Luna and Opus scenarios from raw, exact-effort public aggregates', () => {
    const lunaScenario = usageScenarioForObservation(luna)!
    const opusScenario = usageScenarioForObservation(opus)!
    const outputRatios = research.outputTokenCalibration.openaiMaxPairs.map((pair: { deepSWEOutputTokensPerScoredAttempt: number; aaIntelligenceIndexOutput: { approxTokens: number } }) => pair.deepSWEOutputTokensPerScoredAttempt / pair.aaIntelligenceIndexOutput.approxTokens)
    const outputMean = outputRatios.reduce((sum: number, ratio: number) => sum + ratio, 0) / outputRatios.length
    const costPairs = research.costCalibration.openaiMaxPairs as { aaPooledUsdPerTask: number; deepSWEUsdPerScoredAttempt: number }[]
    const costSlope = costPairs.reduce((sum, pair) => sum + pair.aaPooledUsdPerTask * pair.deepSWEUsdPerScoredAttempt, 0)
      / costPairs.reduce((sum, pair) => sum + pair.aaPooledUsdPerTask ** 2, 0)

    expect(lunaScenario.outputTokensPerScoredAttempt).toBeCloseTo(51_000 * outputMean, 7)
    expect(lunaScenario.costUsdPerScoredAttempt).toBeCloseTo(0.18 * costSlope, 12)
    expect(lunaScenario.outputTokensPerScoredAttempt).toBeCloseTo(98_421.65603779937, 7)
    expect(lunaScenario.outputTokenSensitivityRange).toEqual([91_302.07529398955, 105_541.2367816092])
    expect(lunaScenario.costSensitivityRange).toEqual([0.18067055413690158, 1.2387750587459414])
    expect(lunaScenario.outputLeaveOneOutMapePercent).toBeCloseTo(14.543611181332372, 8)
    expect(lunaScenario.costLeaveOneOutMapePercent).toBeCloseTo(46.724032053043665, 8)

    const opusOutputPair = research.outputTokenCalibration.anthropicMaxPair
    const opusCostPair = research.costCalibration.anthropicOpusFamilyPair
    expect(opusOutputPair.calibrationModel).toBe('Opus 5')
    expect(opusCostPair.ratio).toBe(opusCostPair.deepSWEUsdPerScoredAttempt / opusCostPair.aaPooledUsdPerTask)
    expect(opusScenario.outputTokensPerScoredAttempt).toBeCloseTo(119_000 * (opusOutputPair.deepSWEOutputTokensPerScoredAttempt / opusOutputPair.aaIntelligenceIndexOutput.approxTokens), 7)
    expect(opusScenario.costUsdPerScoredAttempt).toBeCloseTo(13.04 * (opusCostPair.deepSWEUsdPerScoredAttempt / opusCostPair.aaPooledUsdPerTask), 12)
    expect(opusScenario.outputTokensPerScoredAttempt).toBeCloseTo(191_648.18561026783, 7)
    expect(opusScenario.costUsdPerScoredAttempt).toBeCloseTo(14.306032053661632, 11)
    expect(opusScenario.outputTokenSensitivityRange).toBeNull()
    expect(opusScenario.costSensitivityRange).toBeNull()
    expect(opusScenario.outputLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.costLeaveOneOutMapePercent).toBeNull()
    expect(opusScenario.confidence).toBe('very-low')
  })

  it('uses output-only Intelligence Index ratios, not mixed-token totals or cost-to-token conversion', () => {
    const lunaScenario = usageScenarioForObservation(luna)!
    const opusScenario = usageScenarioForObservation(opus)!
    expect(lunaScenario.aaCodingSuiteMixedTokensPerTask).toBe(10_200_000)
    expect(opusScenario.aaCodingSuiteMixedTokensPerTask).toBe(15_600_000)
    expect(lunaScenario.outputTokensPerScoredAttempt).not.toBe(lunaScenario.aaCodingSuiteMixedTokensPerTask)
    expect(opusScenario.outputTokensPerScoredAttempt).not.toBe(opusScenario.aaCodingSuiteMixedTokensPerTask)
    expect(lunaScenario.outputCalibrationDescription).toContain('output-token / AA Intelligence Index')
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

  it('excludes strict, median, and time scenarios and keeps scenario X values numeric', () => {
    expect(usageScenarioForComparison(luna, 'cost', 'mean', false)?.costUsdPerScoredAttempt).toBeCloseTo(0.20668317244049378, 12)
    expect(usageScenarioForComparison(luna, 'outputTokens', 'mean', false)?.outputTokensPerScoredAttempt).toBeCloseTo(98_421.65603779937, 7)
    expect(usageScenarioForComparison(luna, 'cost', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'outputTokens', 'median', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'time', 'mean', false)).toBeNull()
    expect(usageScenarioForComparison(opus, 'cost', 'mean', true)).toBeNull()
    expect(scenarioXValue(usageScenarioForObservation(luna)!, 'cost')).toBeCloseTo(0.20668317244049378, 12)
    expect(scenarioXValue(usageScenarioForObservation(opus)!, 'outputTokens')).toBeCloseTo(191_648.18561026783, 7)
    expect(usageScenarios.map((scenario) => scenario.model)).toEqual(['GPT-6 Luna', 'Opus 5.5'])
  })
})
