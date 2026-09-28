import research from '../../data/research/usage-proxy-cross-platform-20260927.json'
import type { Observation } from './schema'
import type { Statistic, XMetric } from './comparison'

type ResearchScenario = typeof research.scenarios[number]

export interface UsageScenarioSource {
  id: string
  publisher: string
  url: string
  accessedOn: string
  evidenceLocator: string
}

export interface UsageScenario {
  id: string
  model: string
  effort: string
  targetObservationId: string
  targetReportedName: string
  targetPublisher: string
  targetHarness: string
  targetSourceCategory: string
  targetBenchmarkVersion: string
  targetScoreMetric: string
  targetScoreReportedText: string
  confidence: 'low' | 'very-low'
  confidenceNote: string
  aaCodingSuiteCostUsdPerTask: number
  aaCodingSuiteMixedTokensPerTask: number
  outputTokensPerScoredAttempt: number
  outputTokenSensitivityRange: [number, number] | null
  costUsdPerScoredAttempt: number
  costSensitivityRange: [number, number] | null
  outputCalibrationMethod: string
  costCalibrationMethod: string
  outputCalibrationDescription: string
  costCalibrationDescription: string
  outputCalibrationRows: { model: string; aaOutputTokens: number; deepSWEOutputTokens: number; scoredAttempts: number; ratio: number }[]
  costCalibrationRows: { model: string; aaUsd: number; deepSWEUsd: number; ratio: number; costBasisKnown: boolean }[]
  outputLeaveOneOutMapePercent: number | null
  costLeaveOneOutMapePercent: number | null
  sensitivityNote: string
  sources: UsageScenarioSource[]
  meanOnly: true
}

function sourceReference(id: string, evidenceLocator: string): UsageScenarioSource {
  const source = research.sources.find((item) => item.id === id)
  if (!source) throw new Error(`Missing public source evidence: ${id}`)
  const sourceFields = source as { id: string; publisher: string; url?: string; retrievedAt?: string; retrievedOn?: string; publicationDate?: string }
  if (!sourceFields.url) throw new Error(`Missing public source URL: ${id}`)
  const accessedOn = sourceFields.retrievedAt?.slice(0, 10) ?? sourceFields.retrievedOn ?? sourceFields.publicationDate ?? 'date not recorded'
  return { id: sourceFields.id, publisher: sourceFields.publisher, url: sourceFields.url, accessedOn, evidenceLocator }
}

function meanAbsolutePercentageError(errors: number[]): number | null {
  return errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null
}

function openAiOutputPairs() {
  return research.outputTokenCalibration.openaiMaxPairs.map((pair) => ({
    model: pair.model,
    aaOutputTokens: pair.aaIntelligenceIndexOutput.approxTokens,
    deepSWEOutputTokens: pair.deepSWEOutputTokensPerScoredAttempt,
    scoredAttempts: pair.datacurveScoredAttempts,
    ratio: pair.deepSWEOutputTokensPerScoredAttempt / pair.aaIntelligenceIndexOutput.approxTokens,
  }))
}

function opusOutputPair() {
  const pair = research.outputTokenCalibration.anthropicMaxPair
  return [{
    model: pair.calibrationModel,
    aaOutputTokens: pair.aaIntelligenceIndexOutput.approxTokens,
    deepSWEOutputTokens: pair.deepSWEOutputTokensPerScoredAttempt,
    scoredAttempts: pair.datacurveScoredAttempts,
    ratio: pair.deepSWEOutputTokensPerScoredAttempt / pair.aaIntelligenceIndexOutput.approxTokens,
  }]
}

function openAiCostPairs() {
  return research.costCalibration.openaiMaxPairs.map((pair) => ({
    model: pair.model,
    aaUsd: pair.aaPooledUsdPerTask,
    deepSWEUsd: pair.deepSWEUsdPerScoredAttempt,
    ratio: pair.deepSWEUsdPerScoredAttempt / pair.aaPooledUsdPerTask,
    costBasisKnown: pair.datacurveCostBasisKnown,
  }))
}

function opusCostPair() {
  const pair = research.costCalibration.anthropicOpusFamilyPair
  return [{
    model: pair.calibrationModel,
    aaUsd: pair.aaPooledUsdPerTask,
    deepSWEUsd: pair.deepSWEUsdPerScoredAttempt,
    ratio: pair.deepSWEUsdPerScoredAttempt / pair.aaPooledUsdPerTask,
    costBasisKnown: pair.datacurveCostBasisKnown,
  }]
}

function outputLeaveOneOutMape(rows: UsageScenario['outputCalibrationRows']): number | null {
  if (rows.length < 2) return null
  const errors = rows.map((heldOut, index) => {
    const training = rows.filter((_, rowIndex) => rowIndex !== index)
    const factor = training.reduce((sum, row) => sum + row.ratio, 0) / training.length
    const predicted = heldOut.aaOutputTokens * factor
    return (predicted - heldOut.deepSWEOutputTokens) / heldOut.deepSWEOutputTokens * 100
  })
  return meanAbsolutePercentageError(errors)
}

function throughOriginSlope(rows: UsageScenario['costCalibrationRows']): number {
  const numerator = rows.reduce((sum, row) => sum + row.aaUsd * row.deepSWEUsd, 0)
  const denominator = rows.reduce((sum, row) => sum + row.aaUsd ** 2, 0)
  return numerator / denominator
}

function costLeaveOneOutMape(rows: UsageScenario['costCalibrationRows']): number | null {
  if (rows.length < 2) return null
  const errors = rows.map((heldOut, index) => {
    const training = rows.filter((_, rowIndex) => rowIndex !== index)
    const predicted = throughOriginSlope(training) * heldOut.aaUsd
    return (predicted - heldOut.deepSWEUsd) / heldOut.deepSWEUsd * 100
  })
  return meanAbsolutePercentageError(errors)
}

function buildScenario(input: ResearchScenario): UsageScenario {
  if (input.evidenceQuality !== 'low' && input.evidenceQuality !== 'very-low') throw new Error(`Unsupported evidence quality for ${input.model}`)
  const targetVariant = research.aaCodingAgentVariants.find((variant) =>
    variant.model === input.model && variant.effort === input.effort && variant.harness === input.aaAgent)
  if (!targetVariant) throw new Error(`No exact AA model/effort/harness aggregate for ${input.model} ${input.effort}`)
  if (targetVariant.deepSWEv1_1Score !== input.aaDeepSWEv1_1Score
    || targetVariant.pooledCostPerTask.usd !== input.aaCodingSuiteCostUsdPerTask
    || targetVariant.pooledTokenUsagePerTask.tokens !== input.aaCodingSuiteTotalTokensPerTaskApprox) {
    throw new Error(`Scenario source aggregates do not match the exact AA target row for ${input.model} ${input.effort}`)
  }

  const outputCalibrationRows = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? openAiOutputPairs()
    : input.outputCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? opusOutputPair()
      : null
  const costCalibrationRows = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? openAiCostPairs()
    : input.costCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? opusCostPair()
      : null
  if (!outputCalibrationRows || !costCalibrationRows) throw new Error(`Unsupported calibration method for ${input.model}`)

  const outputFactors = outputCalibrationRows.map((row) => row.ratio)
  const outputFactor = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? outputFactors.reduce((sum, factor) => sum + factor, 0) / outputFactors.length
    : outputFactors[0]!
  const outputTokensPerScoredAttempt = input.aaIntelligenceIndexOutputTokensPerTaskApprox * outputFactor
  const outputTokenSensitivityRange = outputFactors.length > 1
    ? [Math.min(...outputFactors) * input.aaIntelligenceIndexOutputTokensPerTaskApprox, Math.max(...outputFactors) * input.aaIntelligenceIndexOutputTokensPerTaskApprox] as [number, number]
    : null

  const costUsdPerScoredAttempt = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? throughOriginSlope(costCalibrationRows) * targetVariant.pooledCostPerTask.usd
    : costCalibrationRows[0]!.ratio * targetVariant.pooledCostPerTask.usd
  const costFactors = costCalibrationRows.map((row) => row.ratio)
  const costSensitivityRange = costFactors.length > 1
    ? [Math.min(...costFactors) * targetVariant.pooledCostPerTask.usd, Math.max(...costFactors) * targetVariant.pooledCostPerTask.usd] as [number, number]
    : null

  const outputLooMape = outputLeaveOneOutMape(outputCalibrationRows)
  const costLooMape = costLeaveOneOutMape(costCalibrationRows)
  const unknownCostBases = costCalibrationRows.filter((row) => !row.costBasisKnown).length
  const confidenceNote = input.evidenceQuality === 'low'
    ? `Low confidence, not a probability: ${outputCalibrationRows.length} output-transfer pairs (output-token LOO MAPE ${outputLooMape?.toFixed(1) ?? 'not available'}%) and ${costCalibrationRows.length} cost pairs (cost LOO MAPE ${costLooMape?.toFixed(1) ?? 'not available'}%); ${unknownCostBases} calibration cost bases are unknown. The observed sensitivity envelopes are not confidence intervals.`
    : 'Very low confidence, not a probability: one adjacent-version Opus 5 max pair, with no holdout and no defensible sensitivity range or prediction interval.'
  const outputCalibrationDescription = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? 'Mean of two same-effort Datacurve DeepSWE output-token / AA Intelligence Index output-token ratios, transferred to the target AA Intelligence Index output/task figure.'
    : 'Single Opus 5 max Datacurve DeepSWE / AA Intelligence Index output-token ratio transferred to Opus 5.5.'
  const costCalibrationDescription = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? 'Through-origin proportional fit of three OpenAI max Datacurve DeepSWE USD/attempt values against AA pooled Coding Agent USD/task values, applied to the target AA suite cost.'
    : 'Single same-family Opus 5 max Datacurve USD/attempt divided by AA pooled USD/task, applied to Opus 5.5 suite cost.'
  const aaComparison = sourceReference(input.codingAgentComparisonSourceId, 'Coding Agent Index model-variant table; pooled suite cost and mixed-category total tokens')
  const aaOutput = sourceReference(input.intelligenceIndexOutputSourceId, 'Intelligence Index output tokens per task; separate from Coding Agent Index totals')
  const datacurve = sourceReference('datacurve-v1.1-json', `Exact calibration rows retained in this artifact; ${research.sources.find((item) => item.id === 'datacurve-v1.1-json')?.sha256 ?? 'source hash unavailable'}`)

  return {
    id: `${input.targetObservation.observationId}:usage-scenario`,
    model: input.model,
    effort: input.effort,
    targetObservationId: input.targetObservation.observationId,
    targetReportedName: input.targetObservation.reportedName,
    targetPublisher: input.targetObservation.publisher,
    targetHarness: input.targetObservation.harness,
    targetSourceCategory: input.targetSourceCategory,
    targetBenchmarkVersion: input.targetBenchmarkVersion,
    targetScoreMetric: input.targetObservation.scoreMetric,
    targetScoreReportedText: input.aaDeepSWEv1_1Score,
    confidence: input.evidenceQuality === 'low' ? 'low' : 'very-low',
    confidenceNote,
    aaCodingSuiteCostUsdPerTask: targetVariant.pooledCostPerTask.usd,
    aaCodingSuiteMixedTokensPerTask: targetVariant.pooledTokenUsagePerTask.tokens,
    outputTokensPerScoredAttempt,
    outputTokenSensitivityRange,
    costUsdPerScoredAttempt,
    costSensitivityRange,
    outputCalibrationMethod: input.outputCalibrationMethod,
    costCalibrationMethod: input.costCalibrationMethod,
    outputCalibrationDescription,
    costCalibrationDescription,
    outputCalibrationRows,
    costCalibrationRows,
    outputLeaveOneOutMapePercent: outputLooMape,
    costLeaveOneOutMapePercent: costLooMape,
    sensitivityNote: 'Observed small-sample transfer-factor envelope only; not a confidence interval, prediction interval, or probabilistic range.',
    sources: [aaComparison, aaOutput, datacurve],
    meanOnly: true,
  }
}

export const usageScenarios: UsageScenario[] = research.scenarios.map(buildScenario)

/** Exact Artificial Analysis observation identity is required; aliases and other harness reports never inherit a scenario. */
export function usageScenarioForObservation(observation: Observation): UsageScenario | null {
  const scenario = usageScenarios.find((item) => item.targetObservationId === observation.id)
  if (!scenario) return null
  if (observation.model.reportedName !== scenario.targetReportedName
    || observation.publisher !== scenario.targetPublisher
    || observation.sourceCategory !== scenario.targetSourceCategory
    || observation.series.harness !== scenario.targetHarness
    || observation.effort.reportedLabel !== scenario.effort
    || observation.effort.rawSetting !== scenario.effort
    || observation.benchmark.version !== scenario.targetBenchmarkVersion
    || observation.result.metric !== scenario.targetScoreMetric
    || observation.result.reportedText !== scenario.targetScoreReportedText) return null
  return scenario
}

/** Scenarios are mean-only X coordinates and are never part of a strict comparison. */
export function usageScenarioForComparison(
  observation: Observation,
  metric: XMetric,
  statistic: Statistic,
  strict: boolean,
): UsageScenario | null {
  if (strict || statistic !== 'mean' || metric === 'time') return null
  return usageScenarioForObservation(observation)
}

export function scenarioXValue(scenario: UsageScenario, metric: Exclude<XMetric, 'time'>): number {
  return metric === 'cost' ? scenario.costUsdPerScoredAttempt : scenario.outputTokensPerScoredAttempt
}
