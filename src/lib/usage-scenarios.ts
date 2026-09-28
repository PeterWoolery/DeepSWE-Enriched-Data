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
  aaCodingSuiteTimeSecondsPerTask: number
  aaCodingSuiteMixedTokensPerTask: number
  outputTokensPerScoredAttempt: number
  outputTokenSensitivityRange: [number, number] | null
  costUsdPerScoredAttempt: number
  costSensitivityRange: [number, number] | null
  timeSecondsPerScoredAttempt: number
  timeSensitivityRange: [number, number] | null
  outputCalibrationMethod: string
  costCalibrationMethod: string
  timeCalibrationMethod: string
  outputCalibrationDescription: string
  costCalibrationDescription: string
  timeCalibrationDescription: string
  outputCalibrationRows: { model: string; aaOutputTokens: number; deepSWEOutputTokens: number; scoredAttempts: number; ratio: number }[]
  costCalibrationRows: { model: string; aaUsd: number; deepSWEUsd: number; ratio: number; costBasisKnown: boolean }[]
  timeCalibrationRows: { model: string; aaSeconds: number; deepSWEDurationSeconds: number; scoredAttempts: number; ratio: number }[]
  outputLeaveOneOutMapePercent: number | null
  costLeaveOneOutMapePercent: number | null
  timeLeaveOneOutMapePercent: number | null
  directUsageReference: { configurationId: string; model: string; effort: string; harness: string; scoredAttempts: number; runs: number; costBasis: string | null } | null
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

function openAiTimePairs() {
  return research.timeCalibration.openaiMaxPairs.map((pair) => ({
    model: pair.model,
    aaSeconds: pair.aaTimePerTask.seconds,
    deepSWEDurationSeconds: pair.deepSWEMeanDurationSecondsPerScoredAttempt,
    scoredAttempts: pair.datacurveScoredAttempts,
    ratio: pair.transferRatio,
  }))
}

function opusTimePair() {
  const pair = research.timeCalibration.anthropicOpusFamilyPair
  return [{
    model: pair.calibrationModel,
    aaSeconds: pair.aaTimePerTask.seconds,
    deepSWEDurationSeconds: pair.deepSWEMeanDurationSecondsPerScoredAttempt,
    scoredAttempts: pair.datacurveScoredAttempts,
    ratio: pair.transferRatio,
  }]
}

function directUsageReference(input: ResearchScenario) {
  if (!input.directUsageReferenceConfigurationId) return null
  const reference = research.datacurveDirectMatches.find((row) => row.configurationId === input.directUsageReferenceConfigurationId)
  if (!reference) throw new Error(`Missing exact DeepSWE usage reference: ${input.directUsageReferenceConfigurationId}`)
  if (reference.scenarioModelLabel !== input.model || reference.effort !== input.effort || reference.harness !== 'mini-swe-agent') {
    throw new Error(`Incompatible exact DeepSWE usage reference for ${input.model} ${input.effort}`)
  }
  return reference
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

function timeLeaveOneOutMape(rows: UsageScenario['timeCalibrationRows']): number | null {
  if (rows.length < 2) return null
  const errors = rows.map((heldOut, index) => {
    const training = rows.filter((_, rowIndex) => rowIndex !== index)
    const factor = training.reduce((sum, row) => sum + row.ratio, 0) / training.length
    const predicted = heldOut.aaSeconds * factor
    return (predicted - heldOut.deepSWEDurationSeconds) / heldOut.deepSWEDurationSeconds * 100
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
    || targetVariant.pooledTokenUsagePerTask.tokens !== input.aaCodingSuiteTotalTokensPerTaskApprox
    || targetVariant.pooledExecutionTimePerTask.seconds !== input.aaCodingAgentTimePerTaskSeconds) {
    throw new Error(`Scenario source aggregates do not match the exact AA target row for ${input.model} ${input.effort}`)
  }

  const direct = directUsageReference(input)
  const outputCalibrationRows = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? openAiOutputPairs()
    : input.outputCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? opusOutputPair()
      : input.outputCalibrationMethod === 'exact-model-effort-deepswe-reference'
        ? []
        : null
  const costCalibrationRows = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? openAiCostPairs()
    : input.costCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? opusCostPair()
      : input.costCalibrationMethod === 'exact-model-effort-deepswe-reference'
        ? []
        : null
  const timeCalibrationRows = input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? openAiTimePairs()
    : input.timeCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? opusTimePair()
      : input.timeCalibrationMethod === 'exact-model-effort-deepswe-reference'
        ? []
        : null
  if (!outputCalibrationRows || !costCalibrationRows || !timeCalibrationRows) throw new Error(`Unsupported calibration method for ${input.model}`)
  if (input.directUsageReferenceConfigurationId && !direct) throw new Error(`Missing direct usage reference for ${input.model}`)
  if (!input.directUsageReferenceConfigurationId && direct) throw new Error(`Unexpected direct usage reference for ${input.model}`)

  const outputFactors = outputCalibrationRows.map((row) => row.ratio)
  const outputFactor = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? outputFactors.reduce((sum, factor) => sum + factor, 0) / outputFactors.length
    : outputFactors[0] ?? 0
  const outputTokensPerScoredAttempt = direct
    ? direct.meanOutputTokensPerScoredAttempt
    : input.aaIntelligenceIndexOutputTokensPerTaskApprox * outputFactor
  const outputTokenSensitivityRange = outputFactors.length > 1
    ? [Math.min(...outputFactors) * input.aaIntelligenceIndexOutputTokensPerTaskApprox, Math.max(...outputFactors) * input.aaIntelligenceIndexOutputTokensPerTaskApprox] as [number, number]
    : null

  const costUsdPerScoredAttempt = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? throughOriginSlope(costCalibrationRows) * targetVariant.pooledCostPerTask.usd
    : direct
      ? direct.meanCostUsdPerScoredAttempt
      : costCalibrationRows[0]!.ratio * targetVariant.pooledCostPerTask.usd
  const costFactors = costCalibrationRows.map((row) => row.ratio)
  const costSensitivityRange = costFactors.length > 1
    ? [Math.min(...costFactors) * targetVariant.pooledCostPerTask.usd, Math.max(...costFactors) * targetVariant.pooledCostPerTask.usd] as [number, number]
    : null
  const timeFactors = timeCalibrationRows.map((row) => row.ratio)
  const timeFactor = input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? timeFactors.reduce((sum, factor) => sum + factor, 0) / timeFactors.length
    : timeFactors[0] ?? 0
  const timeSecondsPerScoredAttempt = direct
    ? direct.meanDurationSecondsPerScoredAttempt
    : targetVariant.pooledExecutionTimePerTask.seconds * timeFactor
  const timeSensitivityRange = timeFactors.length > 1
    ? [Math.min(...timeFactors) * targetVariant.pooledExecutionTimePerTask.seconds, Math.max(...timeFactors) * targetVariant.pooledExecutionTimePerTask.seconds] as [number, number]
    : null

  const outputLooMape = outputLeaveOneOutMape(outputCalibrationRows)
  const costLooMape = costLeaveOneOutMape(costCalibrationRows)
  const timeLooMape = timeLeaveOneOutMape(timeCalibrationRows)
  const unknownCostBases = costCalibrationRows.filter((row) => !row.costBasisKnown).length
  const confidenceNote = direct
    ? `Low qualitative evidence, not a probability: a separate Datacurve DeepSWE v1.1 ${direct.model} max mini-swe-agent row supplies ${direct.scoredAttempts} scored attempts across ${direct.runs} runs. Model and effort match, but evaluator/harness differ from the AA ${input.aaAgent} row. Cost basis ${direct.costBasis ? 'is reported' : 'is unspecified'}; Datacurve timer boundaries are unspecified. No prediction interval is justified.`
    : input.evidenceQuality === 'low'
      ? `Low qualitative evidence, not a probability: ${outputCalibrationRows.length} output-transfer pairs (LOO MAPE ${outputLooMape?.toFixed(1) ?? 'not available'}%), ${costCalibrationRows.length} cost pairs (LOO MAPE ${costLooMape?.toFixed(1) ?? 'not available'}%), and ${timeCalibrationRows.length} measured wall-time pairs (LOO MAPE ${timeLooMape?.toFixed(1) ?? 'not available'}%); ${unknownCostBases} calibration cost bases are unknown. These small-sample envelopes are not confidence or prediction intervals.`
      : 'Very low qualitative evidence, not a probability: one adjacent-version Opus 5 max pair, with no holdout and no defensible sensitivity range or prediction interval; target time is additionally rounded to 0.1 hour.'
  const outputCalibrationDescription = input.outputCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? 'Mean of two same-effort Datacurve DeepSWE output-token / AA Intelligence Index output-token ratios, transferred to the target AA Intelligence Index output/task figure.'
    : direct
      ? `Same-model, same-max Datacurve DeepSWE mean output tokens from ${direct.configurationId}; carried as a separate cross-harness scenario, not the target AA run.`
      : 'Single Opus 5 max Datacurve DeepSWE / AA Intelligence Index output-token ratio transferred to Opus 5.5.'
  const costCalibrationDescription = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? 'Through-origin proportional fit of three OpenAI max Datacurve DeepSWE USD/attempt values against AA pooled Coding Agent USD/task values, applied to the target AA suite cost.'
    : direct
      ? `Same-model, same-max Datacurve mean USD per scored attempt from ${direct.configurationId}; carried as a separate cross-harness scenario. ${direct.costBasis ? 'The source cost basis is reported.' : 'The source cost basis is unspecified.'}`
      : 'Single same-family Opus 5 max Datacurve USD/attempt divided by AA pooled USD/task, applied to Opus 5.5 suite cost.'
  const timeCalibrationDescription = input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? 'Mean of two measured same-model/max Datacurve mean-seconds-per-scored-attempt / AA wall-clock-seconds-per-task ratios, transferred to the target AA suite time. AA pools multiple benchmarks and Datacurve timer boundaries are unspecified; this is not a verified end-to-end duration.'
    : direct
      ? `Same-model, same-max Datacurve reported mean seconds per scored attempt from ${direct.configurationId}; carried as a separate cross-harness scenario. Timer boundaries are unspecified, so it is not a verified end-to-end duration.`
      : 'Single same-family Opus 5 max measured Datacurve/AA wall-clock time ratio applied to Opus 5.5 AA reported 1.1h. The target input is rounded and timer boundaries are unspecified; this is not a verified end-to-end duration.'
  const aaComparison = sourceReference(input.codingAgentComparisonSourceId, 'Coding Agent Index model-variant table; pooled suite cost, reported time, and mixed-category total tokens')
  const aaOutput = sourceReference(input.intelligenceIndexOutputSourceId, direct ? 'Intelligence Index output-only reference; the scenario uses the separate exact-model/effort Datacurve DeepSWE row.' : 'Intelligence Index output tokens per task; separate from Coding Agent Index totals')
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
    aaCodingSuiteTimeSecondsPerTask: targetVariant.pooledExecutionTimePerTask.seconds,
    aaCodingSuiteMixedTokensPerTask: targetVariant.pooledTokenUsagePerTask.tokens,
    outputTokensPerScoredAttempt,
    outputTokenSensitivityRange,
    costUsdPerScoredAttempt,
    costSensitivityRange,
    timeSecondsPerScoredAttempt,
    timeSensitivityRange,
    outputCalibrationMethod: input.outputCalibrationMethod,
    costCalibrationMethod: input.costCalibrationMethod,
    timeCalibrationMethod: input.timeCalibrationMethod,
    outputCalibrationDescription,
    costCalibrationDescription,
    timeCalibrationDescription,
    outputCalibrationRows,
    costCalibrationRows,
    timeCalibrationRows,
    outputLeaveOneOutMapePercent: outputLooMape,
    costLeaveOneOutMapePercent: costLooMape,
    timeLeaveOneOutMapePercent: timeLooMape,
    directUsageReference: direct ? {
      configurationId: direct.configurationId,
      model: direct.model,
      effort: direct.effort,
      harness: direct.harness,
      scoredAttempts: direct.scoredAttempts,
      runs: direct.runs,
      costBasis: direct.costBasis,
    } : null,
    sensitivityNote: 'Observed small-sample transfer-factor envelopes are not confidence or prediction intervals. Exact-row matches and one-pair transfers have no defensible interval.',
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
  if (strict || statistic !== 'mean') return null
  const scenario = usageScenarioForObservation(observation)
  return scenario && Number.isFinite(scenarioXValue(scenario, metric)) ? scenario : null
}

export function scenarioXValue(scenario: UsageScenario, metric: XMetric): number {
  if (metric === 'cost') return scenario.costUsdPerScoredAttempt
  if (metric === 'outputTokens') return scenario.outputTokensPerScoredAttempt
  return scenario.timeSecondsPerScoredAttempt
}
