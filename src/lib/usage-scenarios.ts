import research from '../../data/research/usage-proxy-cross-platform-20260927.json'
import metaResearch from '../../data/research/inference-meta-google-xai.json'
import chineseResearch from '../../data/research/inference-chinese-models.json'
import type { Observation } from './schema'
import type { Statistic, XMetric } from './comparison'

type ResearchScenario = typeof research.scenarios[number]
type ResearchCostOnlyScenario = typeof research.costOnlyScenarios[number]

// Public AA variant evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens,
// reviewed 2026-09-29 (docs/inference-source-review.md). These are same-source
// benchmark means, unlike the separate Intelligence Index transfer hypotheses.
const aaDirectOutput = [
  { id: 'aa-codex-gpt-6-sol-max-v1.1', tokens: 70300.33038348083, page: 'codex' },
  { id: 'aa-codex-gpt-6-luna-max-v1.1', tokens: 108271.5634218289, page: 'codex' },
  { id: 'artificial-analysis-claude-code-opus-5.5-max-v1.1', tokens: 406479.005899705, page: 'claude' },
  { id: 'aa-claude-code-opus-5-max-v1.1', tokens: 129793.94690265486, page: 'claude' },
  { id: 'aa-codex-gpt-6-astra-max-v1.1', tokens: 56420.18289085546, page: 'codex' },
  { id: 'aa-codex-gpt-5.6-sol-max-v1.1', tokens: 56943.890855457226, page: 'codex' },
  { id: 'aa-codex-gpt-5.6-luna-max-v1.1', tokens: 75781.00294985251, page: 'codex' },
  { id: 'aa-claude-code-fable-5.1-max-v1.1', tokens: 155542.35398230088, page: 'claude' },
] as const

function aaDirectOutputSource(page: 'codex' | 'claude'): UsageScenarioSource {
  return {
    id: `aa-direct-deepswe-output-${page}`,
    publisher: 'Artificial Analysis',
    url: page === 'codex' ? 'https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli' : 'https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex',
    accessedOn: '2026-09-29',
    evidenceLocator: `Exact displayLabel → evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens; response SHA-256 ${page === 'codex' ? '38e53b663085602e147094f4afd61cc6a7f67fa0156921f3bcc9b9d8f' : '2150113e1b5c0e7a08d60defd83cbca160663769d15625a133e104c6bf8156e0'}; output-specific telemetry count unspecified.`,
  }
}

export type CostScenarioType = 'datacurve-usage-reference' | 'cross-platform-transfer' | 'aa-suite-proxy' | 'source-reported-cost'

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
  effort: string | null
  targetObservationId: string
  targetReportedName: string
  targetPublisher: string
  targetHarness: string | null
  targetSourceCategory: string
  targetBenchmarkVersion: string | null
  targetScoreMetric: string
  targetScoreReportedText: string
  costScenarioType: CostScenarioType
  confidence: 'low' | 'very-low'
  confidenceNote: string
  aaCodingSuiteCostUsdPerTask: number | null
  aaCodingSuiteTimeSecondsPerTask: number | null
  aaCodingSuiteMixedTokensPerTask: number | null
  outputTokensPerScoredAttempt: number | null
  outputUnit: string
  outputEvidenceType: 'cross-benchmark-transfer' | 'cross-experiment-reference' | 'same-source-deepswe-mean' | 'not-estimated'
  outputStatistic: 'source-deepswe-mean' | 'mean-only' | 'not-estimated'
  outputTokenSensitivityRange: [number, number] | null
  costUsd: number | null
  costUnit: string
  costSensitivityRange: [number, number] | null
  timeSecondsPerScoredAttempt: number | null
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
  scenarioStatistic: 'mean-only' | 'pooled-suite-average' | 'source-statistic-unspecified'
}

function sourceReference(id: string, evidenceLocator: string): UsageScenarioSource {
  const source = research.sources.find((item) => item.id === id)
  if (!source) throw new Error(`Missing public source evidence: ${id}`)
  const sourceFields = source as { id: string; publisher: string; url?: string; retrievedAt?: string; retrievedOn?: string; publicationDate?: string }
  if (!sourceFields.url) throw new Error(`Missing public source URL: ${id}`)
  const accessedOn = sourceFields.retrievedAt?.slice(0, 10) ?? sourceFields.retrievedOn ?? sourceFields.publicationDate ?? 'date not recorded'
  return { id: sourceFields.id, publisher: sourceFields.publisher, url: sourceFields.url, accessedOn, evidenceLocator }
}

function inferenceSourceReference(source: { id: string; url: string; retrievedOn: string; locator: string }, prefix: string): UsageScenarioSource {
  return { id: `${prefix}:${source.id}`, publisher: source.id === 'dc' || source.id === 'datacurve-feed' ? 'Datacurve' : source.id.startsWith('aa-') ? 'Artificial Analysis' : source.id === 'google-method' ? 'Google DeepMind' : source.id === 'meta-model' ? 'Meta' : source.id === 'xai-release' ? 'xAI' : source.id, url: source.url, accessedOn: source.retrievedOn, evidenceLocator: source.locator }
}

function meanAbsolutePercentageError(errors: number[]): number | null {
  return errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null
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
  return meanAbsolutePercentageError(rows.map((heldOut, index) => {
    const training = rows.filter((_, rowIndex) => rowIndex !== index)
    const factor = training.reduce((sum, row) => sum + row.ratio, 0) / training.length
    return (heldOut.aaOutputTokens * factor - heldOut.deepSWEOutputTokens) / heldOut.deepSWEOutputTokens * 100
  }))
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
  if (!costCalibrationRows || !timeCalibrationRows) throw new Error(`Unsupported calibration method for ${input.model}`)
  if (input.directUsageReferenceConfigurationId && !direct) throw new Error(`Missing direct usage reference for ${input.model}`)
  if (!input.directUsageReferenceConfigurationId && direct) throw new Error(`Unexpected direct usage reference for ${input.model}`)

  const sameSourceOutput = aaDirectOutput.find((row) => row.id === input.targetObservation.observationId)
  if (!sameSourceOutput) throw new Error(`Missing direct AA DeepSWE output for ${input.model}`)

  const costUsd = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
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

  const costLooMape = costLeaveOneOutMape(costCalibrationRows)
  const timeLooMape = timeLeaveOneOutMape(timeCalibrationRows)
  const unknownCostBases = costCalibrationRows.filter((row) => !row.costBasisKnown).length
  const confidenceNote = direct
    ? `Low qualitative evidence, not a probability: a separate Datacurve DeepSWE v1.1 ${direct.model} max mini-swe-agent row supplies ${direct.scoredAttempts} scored attempts across ${direct.runs} runs. Model and effort match, but evaluator/harness differ from the AA ${input.aaAgent} row. Cost basis ${direct.costBasis ? 'is reported' : 'is unspecified'}; Datacurve timer boundaries are unspecified. No prediction interval is justified.`
    : input.evidenceQuality === 'low'
      ? `Low qualitative dollar/time evidence, not a probability: ${costCalibrationRows.length} cost pairs (LOO MAPE ${costLooMape?.toFixed(1) ?? 'not available'}%) and ${timeCalibrationRows.length} measured wall-time pairs (LOO MAPE ${timeLooMape?.toFixed(1) ?? 'not available'}%); ${unknownCostBases} calibration cost bases are unknown. These small-sample envelopes are not confidence or prediction intervals.`
      : 'Very low qualitative evidence, not a probability: one adjacent-version Opus 5 max pair, with no holdout and no defensible sensitivity range or prediction interval; target time is additionally rounded to 0.1 hour.'
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
    costScenarioType: direct ? 'datacurve-usage-reference' : 'cross-platform-transfer',
    confidence: input.evidenceQuality === 'low' ? 'low' : 'very-low',
    confidenceNote: `Exact AA variant DeepSWE v1.1 output mean is source-reported (output-specific telemetry count and reasoning scope unspecified). Dollar/time scenario evidence remains separate: ${confidenceNote}`,
    aaCodingSuiteCostUsdPerTask: targetVariant.pooledCostPerTask.usd,
    aaCodingSuiteTimeSecondsPerTask: targetVariant.pooledExecutionTimePerTask.seconds,
    aaCodingSuiteMixedTokensPerTask: targetVariant.pooledTokenUsagePerTask.tokens,
    outputTokensPerScoredAttempt: sameSourceOutput.tokens,
    outputUnit: 'AA DeepSWE v1.1 output tokens / task attempt',
    outputEvidenceType: 'same-source-deepswe-mean',
    outputStatistic: 'source-deepswe-mean',
    outputTokenSensitivityRange: null,
    costUsd,
    costUnit: 'USD per scored rollout attempt',
    costSensitivityRange,
    timeSecondsPerScoredAttempt,
    timeSensitivityRange,
    outputCalibrationMethod: 'same-aa-variant-deepswe-mean',
    costCalibrationMethod: input.costCalibrationMethod,
    timeCalibrationMethod: input.timeCalibrationMethod,
    outputCalibrationDescription: `AA public serialized variant data reports the exact ${input.model} ${input.effort} ${input.aaAgent} DeepSWE v1.1 mean.outputTokens. No cost-to-token conversion or Intelligence Index transfer is used for this output. Output-specific telemetry count and reasoning inclusion are unspecified.`,
    costCalibrationDescription,
    timeCalibrationDescription,
    outputCalibrationRows: [],
    costCalibrationRows,
    timeCalibrationRows,
    outputLeaveOneOutMapePercent: null,
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
    sensitivityNote: 'The same-source AA DeepSWE output mean has no reported output-token interval. Dollar/time transfer-factor envelopes are sensitivity choices, not confidence or prediction intervals.',
    sources: [aaComparison, datacurve, aaDirectOutputSource(sameSourceOutput.page)],
    scenarioStatistic: 'mean-only',
  }
}

function buildCostOnlyScenario(input: ResearchCostOnlyScenario): UsageScenario {
  if (input.evidenceQuality !== 'low' && input.evidenceQuality !== 'very-low') throw new Error(`Unsupported evidence quality for ${input.model}`)
  if (input.costScenarioType !== 'aa-suite-proxy' && input.costScenarioType !== 'source-reported-cost') throw new Error(`Unsupported cost scenario type for ${input.model}`)
  if (!Number.isFinite(input.costUsd) || input.costUsd < 0) throw new Error(`Invalid source cost scenario for ${input.model}`)

  const targetVariant = input.costScenarioType === 'aa-suite-proxy'
    ? research.aaCodingAgentVariants.find((variant) =>
      variant.model === input.model && variant.effort === input.effort && variant.harness === input.targetObservation.harness)
    : null
  if (input.costScenarioType === 'aa-suite-proxy' && (!targetVariant
    || targetVariant.deepSWEv1_1Score !== input.targetObservation.scoreReportedText
    || targetVariant.pooledCostPerTask.usd !== input.costUsd)) {
    throw new Error(`Suite-cost proxy does not match its exact AA result row for ${input.model}`)
  }

  const source = sourceReference(input.sourceId, input.evidenceLocator)
  const directOutput = chineseResearch.targets.find((row) => row.id === input.targetObservation.observationId && row.output?.method === 'aaDirectOutput')
  const fableOutput = aaDirectOutput.find((row) => row.id === input.targetObservation.observationId)
  if (directOutput && (input.costScenarioType !== 'aa-suite-proxy' || directOutput.cost?.usd !== input.costUsd || directOutput.modelSnapshot !== input.model || directOutput.effort !== input.effort || directOutput.harness !== input.targetObservation.harness)) throw new Error(`AA output evidence does not match the suite-cost target: ${input.model}`)
  const aaOutputSource = directOutput && chineseResearch.sources.find((row) => row.id === 'aa-codex-kimi-live')
  if (directOutput && !aaOutputSource) throw new Error(`Missing AA DeepSWE output source for ${input.model}`)
  return {
    id: input.id,
    model: input.model,
    effort: input.effort,
    targetObservationId: input.targetObservation.observationId,
    targetReportedName: input.targetObservation.reportedName,
    targetPublisher: input.targetObservation.publisher,
    targetHarness: input.targetObservation.harness,
    targetSourceCategory: input.targetSourceCategory,
    targetBenchmarkVersion: input.targetBenchmarkVersion,
    targetScoreMetric: input.targetObservation.scoreMetric,
    targetScoreReportedText: input.targetObservation.scoreReportedText,
    costScenarioType: input.costScenarioType,
    confidence: input.evidenceQuality,
    confidenceNote: input.confidenceNote,
    aaCodingSuiteCostUsdPerTask: targetVariant?.pooledCostPerTask.usd ?? null,
    aaCodingSuiteTimeSecondsPerTask: targetVariant?.pooledExecutionTimePerTask.seconds ?? null,
    aaCodingSuiteMixedTokensPerTask: targetVariant?.pooledTokenUsagePerTask.tokens ?? null,
    outputTokensPerScoredAttempt: directOutput?.output?.tokens ?? fableOutput?.tokens ?? null,
    outputUnit: directOutput || fableOutput ? 'AA DeepSWE v1.1 output tokens / task attempt' : 'output tokens / scored rollout attempt',
    outputEvidenceType: directOutput || fableOutput ? 'same-source-deepswe-mean' : 'not-estimated',
    outputStatistic: directOutput || fableOutput ? 'source-deepswe-mean' : 'not-estimated',
    outputTokenSensitivityRange: null,
    costUsd: input.costUsd,
    costUnit: input.costUnit,
    costSensitivityRange: null,
    timeSecondsPerScoredAttempt: null,
    timeSensitivityRange: null,
    outputCalibrationMethod: directOutput || fableOutput ? 'same-aa-variant-deepswe-mean' : 'not-estimated',
    costCalibrationMethod: input.costMethod,
    timeCalibrationMethod: 'not-estimated',
    outputCalibrationDescription: directOutput || fableOutput ? `Source-reported mean.outputTokens for the exact ${input.model} ${input.effort} ${input.targetObservation.harness} variant's DeepSWE v1.1 eval; token-telemetry-specific count and reasoning-token inclusion not established. This is not derived from pooled suite cost and does not populate the approved measurement field.` : 'No output-token estimate is attached to this cost-only scenario.',
    costCalibrationDescription: input.costDescription,
    timeCalibrationDescription: 'No time estimate is attached to this cost-only scenario.',
    outputCalibrationRows: [],
    costCalibrationRows: [],
    timeCalibrationRows: [],
    outputLeaveOneOutMapePercent: null,
    costLeaveOneOutMapePercent: null,
    timeLeaveOneOutMapePercent: null,
    directUsageReference: null,
    sensitivityNote: 'No cost sensitivity range or prediction interval is supported; same-source DeepSWE output means have no published output-token interval.',
    sources: aaOutputSource ? [source, inferenceSourceReference(aaOutputSource, 'chinese')] : fableOutput ? [source, aaDirectOutputSource(fableOutput.page)] : [source],
    scenarioStatistic: input.costScenarioType === 'aa-suite-proxy' ? 'pooled-suite-average' : 'source-statistic-unspecified',
  }
}

function buildMetaGoogleXaiScenario(input: typeof metaResearch.targets[number]): UsageScenario {
  const isGoogle = input.observationId === 'google-gemini-3.8-flash-high-v1.1'
  const isMeta = input.observationId === 'meta-muse-spark-1.3-v1.1-max'
  const group = isMeta ? metaResearch.calibration.meta : metaResearch.calibration.xai
  const target = isGoogle
    ? { name: 'Gemini 3.8 Flash', publisher: 'Google DeepMind', sourceCategory: 'developer', harness: 'mini-SWE-agent', effort: 'high thinking', scoreMetric: 'pass_at_1' }
    : isMeta
      ? { name: 'Muse Spark 1.3', publisher: 'Meta', sourceCategory: 'developer', harness: 'mini-swe-agent', effort: 'max', scoreMetric: 'task_pass_rate' }
      : { name: 'Grok 4.7', publisher: 'xAI / SpaceXAI', sourceCategory: 'developer', harness: null, effort: 'high', scoreMetric: 'reported_score_unspecified' }
  if (input.reportedModel !== target.name || input.publisher !== (isGoogle ? 'Google' : isMeta ? 'Meta' : 'xAI') || input.scoreReportedText !== (isGoogle ? '73.7%' : isMeta ? '75.4%' : '71.0%*')) throw new Error(`Mismatched research target: ${input.observationId}`)
  const outputCalibrationRows: UsageScenario['outputCalibrationRows'] = isGoogle ? [] : group.map((row) => ({ model: `${row.model} ${row.effort} · AA II aggregate`, aaOutputTokens: row.aaIITotalOutputMillions * 1_000_000, deepSWEOutputTokens: row.meanOutputTokensPerScoredAttempt, scoredAttempts: row.attempts, ratio: row.meanOutputTokensPerScoredAttempt / (row.aaIITotalOutputMillions * 1_000_000) }))
  const costCalibrationRows: UsageScenario['costCalibrationRows'] = isGoogle ? [] : group.map((row) => ({ model: `${row.model} ${row.effort} · AA II cost/task`, aaUsd: row.aaIIUsdPerTask, deepSWEUsd: row.meanUsdPerScoredAttempt, ratio: row.meanUsdPerScoredAttempt / row.aaIIUsdPerTask, costBasisKnown: row.costBasis !== null }))
  const cost = isGoogle ? input.usdPerScoredAttemptScenario : costCalibrationRows.reduce((sum, row) => sum + row.ratio * input.aaIIUsdPerTask!, 0) / costCalibrationRows.length
  const output = isGoogle ? input.outputTokensPerScoredAttemptScenario : outputCalibrationRows.reduce((sum, row) => sum + row.ratio * input.aaIITotalOutputMillions! * 1_000_000, 0) / outputCalibrationRows.length
  if (Math.abs(cost - input.usdPerScoredAttemptScenario) > 1e-8 || Math.abs(output - input.outputTokensPerScoredAttemptScenario) > 1e-6) throw new Error(`Inconsistent research arithmetic for ${input.observationId}`)
  const sourceIds = isGoogle ? ['google-method', 'dc'] : isMeta ? ['meta-model', 'dc', 'aa-muse-1.1-xhigh', 'aa-muse-1.2-xhigh', 'aa-muse-1.3-max'] : ['xai-release', 'dc', 'aa-grok-4.5-high', 'aa-grok-4.6-high', 'aa-grok-4.7-high']
  const sources = sourceIds.map((id) => {
    const source = metaResearch.sources.find((row) => row.id === id)
    if (!source) throw new Error(`Missing ${id} research source`)
    return inferenceSourceReference({ ...source, locator: [source.locator, source.responseCaveat].filter(Boolean).join(' · ') }, 'meta-google-xai')
  })
  const direct = isGoogle ? { configurationId: input.directReferenceConfig!, model: 'Gemini 3.8 Flash', effort: 'high thinking', harness: 'mini-swe-agent', scoredAttempts: input.directReferenceAttempts!, runs: input.directReferenceRuns!, costBasis: input.directReferenceCostBasis! } : null
  return {
    id: `${input.observationId}:usage-scenario`, model: target.name, effort: target.effort,
    targetObservationId: input.observationId, targetReportedName: target.name, targetPublisher: target.publisher, targetHarness: target.harness, targetSourceCategory: target.sourceCategory, targetBenchmarkVersion: '1.1', targetScoreMetric: target.scoreMetric, targetScoreReportedText: input.scoreReportedText,
    costScenarioType: isGoogle ? 'datacurve-usage-reference' : 'cross-platform-transfer', confidence: isGoogle ? 'low' : 'very-low',
    confidenceNote: isGoogle ? 'Same reported API model, high thinking and mini-SWE-agent DeepSWE v1.1, but this is a separate Datacurve experiment (447 attempts, four runs), not the Google run. Immutable checkpoint, attempt set and cost basis are not established.' : isMeta ? 'Very weak adjacent-version 1.1/1.2 xhigh to 1.3 max transfer across DeepSWE and AA Intelligence Index workloads; effort differs. Two-predecessor output/cost LOO MAPE 59.1%/88.9%. A separate Muse Code 1.3 max AA DeepSWE variant directly reports ~122,492 output tokens/task attempt, but it is not Meta’s mini-swe-agent run and its $3.98/task is a three-benchmark suite average, not Meta’s bill.' : 'Very weak adjacent-version Grok 4.5/4.6 high to 4.7 high transfer across DeepSWE and AA Intelligence Index workloads; developer harness unknown. Output LOO MAPE 35.1%. A tight two-point cost fit does not imply a reliable bill.',
    aaCodingSuiteCostUsdPerTask: null, aaCodingSuiteTimeSecondsPerTask: null, aaCodingSuiteMixedTokensPerTask: null,
    outputTokensPerScoredAttempt: output, outputUnit: 'output tokens / scored rollout attempt', outputEvidenceType: isGoogle ? 'cross-experiment-reference' : 'cross-benchmark-transfer', outputStatistic: 'mean-only', outputTokenSensitivityRange: isGoogle ? null : [Math.min(...outputCalibrationRows.map((row) => row.ratio * input.aaIITotalOutputMillions! * 1_000_000)), Math.max(...outputCalibrationRows.map((row) => row.ratio * input.aaIITotalOutputMillions! * 1_000_000))],
    costUsd: cost, costUnit: 'USD per scored rollout attempt', costSensitivityRange: isGoogle ? null : [Math.min(...costCalibrationRows.map((row) => row.ratio * input.aaIIUsdPerTask!)), Math.max(...costCalibrationRows.map((row) => row.ratio * input.aaIIUsdPerTask!))],
    timeSecondsPerScoredAttempt: null, timeSensitivityRange: null,
    outputCalibrationMethod: isGoogle ? 'separate-experiment-same-model-effort-deepswe-reference' : 'two-predecessor-aa-ii-aggregate-output-transfer',
    costCalibrationMethod: isGoogle ? 'separate-experiment-same-model-effort-deepswe-reference' : 'two-predecessor-aa-ii-cost-transfer', timeCalibrationMethod: 'not-estimated',
    outputCalibrationDescription: isGoogle ? `Datacurve ${direct!.configurationId} mean output tokens over ${direct!.scoredAttempts} scored attempts in four runs; same API model/high thinking, separate Google experiment.` : `Unweighted mean of two predecessor Datacurve DeepSWE output means scaled by target/reference AA Intelligence Index AGGREGATE output tokens (millions over entire evaluation, not tokens/task). Cross-benchmark adjacent-version transfer; ${isMeta ? 'Meta predecessors are xhigh while the target is max.' : 'Grok predecessors and target are all high effort.'}`,
    costCalibrationDescription: isGoogle ? `Datacurve ${direct!.configurationId} mean USD per scored attempt; separate Google experiment, cost basis unreported.` : 'Unweighted mean of two predecessor Datacurve DeepSWE USD/attempt scaled by target/reference AA Intelligence Index weighted USD/task. Different benchmarks and unknown Datacurve price bases; not the AA pooled Coding Agent suite cost.',
    timeCalibrationDescription: 'No time estimate is attached to this scenario.',
    outputCalibrationRows, costCalibrationRows, timeCalibrationRows: [], outputLeaveOneOutMapePercent: isGoogle ? null : outputLeaveOneOutMape(outputCalibrationRows), costLeaveOneOutMapePercent: isGoogle ? null : meanAbsolutePercentageError(costCalibrationRows.map((heldOut, index) => { const other = costCalibrationRows[1 - index]!; return (other.ratio * heldOut.aaUsd - heldOut.deepSWEUsd) / heldOut.deepSWEUsd * 100 })), timeLeaveOneOutMapePercent: null,
    directUsageReference: direct, sensitivityNote: isGoogle ? 'One separate run reference, not a confidence interval or a measurement of the Google run.' : 'Extrema of two predecessor transfers are sensitivity cases, not confidence or prediction intervals.',
    sources: isMeta ? [...sources, { id: 'aa-muse-code-1.3-max-direct-output-context', publisher: 'Artificial Analysis', url: 'https://artificialanalysis.ai/agents/coding-agents/comparisons/grok-build-vs-muse-code', accessedOn: '2026-09-29', evidenceLocator: 'Muse Code 1.3 max evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens=122491.69026548673, a different harness from Meta mini-swe-agent; $3.98/task pooled suite; response SHA-256 1b2fbd39cab29eb8c3d399f948adb82260f1c47ab8dfc0cc419690a506fc70be' }] : sources, scenarioStatistic: 'mean-only',
  }
}

export const usageScenarios: UsageScenario[] = [
  ...research.scenarios.map(buildScenario),
  ...research.costOnlyScenarios.map(buildCostOnlyScenario),
  ...metaResearch.targets.map(buildMetaGoogleXaiScenario),
]

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
  if (scenario.costScenarioType === 'source-reported-cost' && observation.pricing.asReportedCost !== scenario.costUsd) return null
  return scenario
}

/** Scenarios are shown only with the Mean control and are never part of a strict comparison. Source-statistic gaps remain explicit. */
export function usageScenarioForComparison(
  observation: Observation,
  _metric: XMetric,
  statistic: Statistic,
  strict: boolean,
): UsageScenario | null {
  if (strict || statistic !== 'mean') return null
  return usageScenarioForObservation(observation)
}

export function scenarioXValue(scenario: UsageScenario, metric: XMetric): number | null {
  if (metric === 'cost') return scenario.costUsd
  if (metric === 'outputTokens') return scenario.outputTokensPerScoredAttempt
  return scenario.timeSecondsPerScoredAttempt
}
