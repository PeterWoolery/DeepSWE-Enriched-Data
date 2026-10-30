import research from '../../data/research/usage-proxy-cross-platform-20260927.json'
import metaResearch from '../../data/research/inference-meta-google-xai.json'
import chineseResearch from '../../data/research/inference-chinese-models.json'
import approvedData from '../../data/approved/dataset.json'
import type { Observation } from './schema'
import { metricObservation, type Statistic, type XMetric } from './comparison'

type ResearchScenario = typeof research.scenarios[number]
type ResearchCostOnlyScenario = typeof research.costOnlyScenarios[number]
type ResearchUsageFact = typeof research.usageFacts[number]
type ScenarioTargetConfig = {
  observationId: string
  sourceId: string
  canonicalId: string | null
  snapshot: string | null
  metrics: UsageScenarioMetricConfiguration
  scenarioFamily?: 'google-reference' | 'meta-transfer' | 'xai-transfer'
  reportedModel?: string
  publisher?: string
  sourceCategory?: string
  harness?: string | null
  effort?: string
  scoreMetric?: string
  scoreReportedText?: string
  benchmarkVersion?: string
  sourceEvidenceIds?: string[]
  contextSources?: UsageScenarioSource[]
}

export type UsageEvidenceKind = 'approved-measurement' | 'same-source-reference' | 'configured-fallback' | 'no-data'
export type UsageRelationship = 'same-source-same-benchmark-reference' | 'separate-experiment-reference' | 'separate-benchmark-reference' | 'calibrated-transfer' | 'pooled-suite-proxy' | 'source-reported-unspecified' | 'no-data'

export interface UsageMetricConfiguration {
  selection: 'same-source-reference' | 'fallback' | 'none'
  method: string
  relationship: UsageRelationship
  statistic: string
  sourceIds: string[]
  factIds: string[]
  referenceIds: string[]
}

export type UsageScenarioMetricConfiguration = Record<XMetric, UsageMetricConfiguration>

type EfficiencyReference = typeof research.efficiencyExtension.references[number]
type EfficiencyTarget = typeof research.efficiencyExtension.targets[number]

function efficiencyMetricConfiguration(reference: EfficiencyReference, metric: XMetric): UsageMetricConfiguration {
  const directOutput = reference.workload === 'coding' && metric === 'outputTokens'
  const anchors = reference.workload === 'ii'
    ? research.efficiencyExtension.iiAnchors.filter((anchor) => anchor.metrics.includes(metric)) : []
  return {
    selection: 'fallback',
    method: directOutput ? 'aa-deepswe-efficiency-reference'
      : reference.workload === 'coding' ? metric === 'cost' ? 'openai-max-through-origin-proportional-fit' : 'openai-max-arithmetic-mean-ratio'
        : metric === 'cost' ? 'openai-ii-through-origin-cost-fit' : 'openai-ii-mean-ratio-transfer',
    relationship: directOutput ? 'separate-experiment-reference' : 'calibrated-transfer',
    statistic: 'mean-only',
    sourceIds: [...new Set([reference.sourceId, ...(directOutput ? [] : ['datacurve-v1.1-json']),
      ...anchors.map((anchor) => research.efficiencyExtension.references.find((row) => row.id === anchor.referenceId)!.sourceId),
      ...(reference.workload === 'coding' && !directOutput ? ['aa-codex-vs-kimi-code-cli'] : []),
    ])],
    factIds: [],
    referenceIds: [reference.id, ...anchors.map((anchor) => anchor.configurationId),
      ...(reference.workload === 'coding' && !directOutput ? [metric === 'cost' ? 'openai-max-cost-calibration' : 'openai-max-time-calibration'] : []),
    ],
  }
}

export function usageConfigurationsFor(researchData: typeof research = research): ScenarioTargetConfig[] {
  const configs = researchData.scenarioConfig.targets.map((row) => ({ ...row, metrics: { ...row.metrics } })) as ScenarioTargetConfig[]
  for (const target of researchData.efficiencyExtension.targets) {
    const observation = approvedData.observations.find((row) => row.id === target.observationId)!
    const reference = researchData.efficiencyExtension.references.find((row) => row.id === target.referenceId)!
    let config = configs.find((row) => row.observationId === target.observationId)
    if (!config) {
      const none: UsageMetricConfiguration = { selection: 'none', method: 'not-estimated', relationship: 'no-data', statistic: 'not-estimated', sourceIds: [], factIds: [], referenceIds: [] }
      config = { observationId: observation.id, sourceId: observation.provenance.sourceId, canonicalId: observation.model.canonicalId, snapshot: observation.model.snapshot,
        metrics: { cost: { ...none }, outputTokens: { ...none }, time: { ...none } } }
      configs.push(config)
    }
    for (const metric of target.metrics as XMetric[]) config.metrics[metric] = efficiencyMetricConfiguration(reference, metric)
  }
  return configs
}

function scenarioConfigFor(observationId: string): ScenarioTargetConfig | null {
  return usageConfigurationsFor().find((row) => row.observationId === observationId) ?? null
}

function usageFactForId(factId: string): ResearchUsageFact | null {
  return research.usageFacts.find((fact) => fact.id === factId) ?? null
}

function directOutputFact(observationId: string): ResearchUsageFact | null {
  const config = scenarioConfigFor(observationId)
  const factId = config?.metrics.outputTokens.factIds[0]
  return factId ? usageFactForId(factId) : null
}

function requiredDirectOutputFact(observationId: string): ResearchUsageFact {
  const fact = directOutputFact(observationId)
  if (!fact || fact.value === null || !Number.isFinite(fact.value) || fact.value < 0) {
    throw new Error(`Missing valid same-source output fact for ${observationId}`)
  }
  return fact
}

function metricConfigurationFor(observationId: string): UsageScenarioMetricConfiguration {
  const config = scenarioConfigFor(observationId)
  if (!config) throw new Error(`Missing exact usage scenario configuration for ${observationId}`)
  return config.metrics as UsageScenarioMetricConfiguration
}

const pinnedApprovedRevision = research.scenarioConfig.approvedDatasetRevision

function approvedReferenceObservation(configurationId: string): Observation | null {
  if (approvedData.revisionId !== pinnedApprovedRevision) return null
  const row = approvedData.observations.find((observation) => observation.upstreamConfigurationId === configurationId
    && observation.provenance.sourceId === approvedData.sourceRetrieval.sourceId)
  return (row as Observation | undefined) ?? null
}

function approvedReferenceMetric(configurationId: string, metric: XMetric): number | null {
  const row = approvedReferenceObservation(configurationId)
  const value = row ? metricObservation(row, metric, 'mean').value : null
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export type CostScenarioType = 'datacurve-usage-reference' | 'cross-platform-transfer' | 'aa-suite-proxy' | 'source-reported-cost'

export interface UsageScenarioSource {
  id: string
  publisher: string
  url: string
  accessedOn: string
  evidenceLocator: string
  responseSha256: string | null
  hashStatus: 'validated' | 'unavailable' | 'malformed-historical'
  historicalMalformedSha256?: string
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
  metricConfiguration: UsageScenarioMetricConfiguration
}

function sourceHashFields(source: { sha256?: string | null; sha256ResponseBytes?: string | null; responseSha256?: string | null; hashStatus?: string; historicalMalformedSha256?: string }) {
  const candidate = source.responseSha256 ?? source.sha256ResponseBytes ?? source.sha256 ?? null
  const inferredStatus = candidate === null ? 'unavailable' : /^[a-f0-9]{64}$/i.test(candidate) ? 'validated' : 'malformed-historical'
  const hashStatus = (source.hashStatus ?? inferredStatus) as UsageScenarioSource['hashStatus']
  const responseSha256 = hashStatus === 'validated' && candidate && /^[a-f0-9]{64}$/i.test(candidate) ? candidate : null
  return {
    responseSha256,
    hashStatus,
    ...(source.historicalMalformedSha256 ? { historicalMalformedSha256: source.historicalMalformedSha256 } : candidate && hashStatus === 'malformed-historical' ? { historicalMalformedSha256: candidate } : {}),
  } as const
}

function sourceReference(id: string, evidenceLocator: string): UsageScenarioSource {
  const source = [...research.sources, ...research.efficiencyExtension.sources].find((item) => item.id === id)
  if (!source) throw new Error(`Missing public source evidence: ${id}`)
  const sourceFields = source as { id: string; publisher: string; url?: string; retrievedAt?: string; retrievedOn?: string; publicationDate?: string; sha256?: string; sha256ResponseBytes?: string; hashStatus?: 'validated' | 'unavailable' | 'malformed-historical'; historicalMalformedSha256?: string }
  if (!sourceFields.url) throw new Error(`Missing public source URL: ${id}`)
  const accessedOn = sourceFields.retrievedAt?.slice(0, 10) ?? sourceFields.retrievedOn ?? sourceFields.publicationDate ?? 'date not recorded'
  return { id: sourceFields.id, publisher: sourceFields.publisher, url: sourceFields.url, accessedOn, evidenceLocator, ...sourceHashFields(source) }
}

function inferenceSourceReference(source: { id: string; url: string; retrievedOn: string; locator: string; sha256?: string | null; sha256ResponseBytes?: string | null; hashStatus?: string; historicalMalformedSha256?: string }, prefix: string): UsageScenarioSource {
  return { id: `${prefix}:${source.id}`, publisher: source.id === 'dc' || source.id === 'datacurve-feed' ? 'Datacurve' : source.id.startsWith('aa-') ? 'Artificial Analysis' : source.id === 'google-method' ? 'Google DeepMind' : source.id === 'meta-model' ? 'Meta' : source.id === 'xai-release' ? 'xAI' : source.id, url: source.url, accessedOn: source.retrievedOn, evidenceLocator: source.locator, ...sourceHashFields(source) }
}

function aaDirectOutputSource(fact: ResearchUsageFact): UsageScenarioSource {
  return {
    id: `aa-direct-deepswe-output-${fact.identity.harness === 'Codex' ? 'codex' : 'claude'}`,
    publisher: 'Artificial Analysis',
    url: fact.evidence.url,
    accessedOn: fact.evidence.retrievedAt,
    evidenceLocator: fact.evidence.locator,
    ...sourceHashFields(fact.evidence),
  }
}

function meanAbsolutePercentageError(errors: number[]): number | null {
  return errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null
}

function openAiCostPairs() {
  return research.costCalibration.openaiMaxPairs.flatMap((pair) => {
    const direct = research.datacurveDirectMatches.find((row) => row.scenarioModelLabel === pair.model)
    const aaVariant = research.aaCodingAgentVariants.find((row) => row.model === pair.model && row.effort === pair.effort)
    const value = direct ? approvedReferenceMetric(direct.configurationId, 'cost') : null
    const observation = direct ? approvedReferenceObservation(direct.configurationId) : null
    return direct && aaVariant && observation && value !== null ? [{
      model: pair.model,
      aaUsd: aaVariant.pooledCostPerTask.usd,
      deepSWEUsd: value,
      ratio: value / aaVariant.pooledCostPerTask.usd,
      costBasisKnown: observation.series.pricingBasis !== null,
    }] : []
  })
}

function opusCostPair() {
  const pair = research.costCalibration.anthropicOpusFamilyPair
  const direct = research.datacurveDirectMatches.find((row) => row.scenarioModelLabel === pair.calibrationModel)
  const aaVariant = research.aaCodingAgentVariants.find((row) => row.model === pair.calibrationModel && row.effort === pair.effort)
  const deepSWEUsd = direct ? approvedReferenceMetric(direct.configurationId, 'cost') : null
  if (!aaVariant || deepSWEUsd === null || !direct) return []
  return [{
    model: pair.calibrationModel,
    aaUsd: aaVariant.pooledCostPerTask.usd,
    deepSWEUsd,
    ratio: deepSWEUsd / aaVariant.pooledCostPerTask.usd,
    costBasisKnown: approvedReferenceObservation(direct.configurationId)?.series.pricingBasis !== null,
  }]
}

function openAiTimePairs() {
  return research.timeCalibration.openaiMaxPairs.flatMap((pair) => {
    const direct = research.datacurveDirectMatches.find((row) => row.scenarioModelLabel === pair.model)
    const aaVariant = research.aaCodingAgentVariants.find((row) => row.model === pair.model && row.effort === pair.effort)
    const value = direct ? approvedReferenceMetric(direct.configurationId, 'time') : null
    const observation = direct ? approvedReferenceObservation(direct.configurationId) : null
    return direct && aaVariant && observation && value !== null ? [{
      model: pair.model,
      aaSeconds: aaVariant.pooledExecutionTimePerTask.seconds,
      deepSWEDurationSeconds: value,
      scoredAttempts: observation.benchmark.scoredAttempts ?? 0,
      ratio: value / aaVariant.pooledExecutionTimePerTask.seconds,
    }] : []
  })
}

function opusTimePair() {
  const pair = research.timeCalibration.anthropicOpusFamilyPair
  const direct = research.datacurveDirectMatches.find((row) => row.scenarioModelLabel === pair.calibrationModel)
  const aaVariant = research.aaCodingAgentVariants.find((row) => row.model === pair.calibrationModel && row.effort === pair.effort)
  const deepSWEDurationSeconds = direct ? approvedReferenceMetric(direct.configurationId, 'time') : null
  const observation = direct ? approvedReferenceObservation(direct.configurationId) : null
  if (!aaVariant || deepSWEDurationSeconds === null || !direct) return []
  return [{
    model: pair.calibrationModel,
    aaSeconds: aaVariant.pooledExecutionTimePerTask.seconds,
    deepSWEDurationSeconds,
    scoredAttempts: observation?.benchmark.scoredAttempts ?? 0,
    ratio: deepSWEDurationSeconds / aaVariant.pooledExecutionTimePerTask.seconds,
  }]
}

function directUsageReference(input: ResearchScenario) {
  if (!input.directUsageReferenceConfigurationId) return null
  const reference = research.datacurveDirectMatches.find((row) => row.configurationId === input.directUsageReferenceConfigurationId)
  if (!reference) return null
  if (reference.scenarioModelLabel !== input.model || reference.effort !== input.effort || reference.harness !== 'mini-swe-agent') {
    return null
  }
  const observation = approvedReferenceObservation(reference.configurationId)
  if (!observation) return null
  return {
    ...reference,
    meanCostUsdPerScoredAttempt: approvedReferenceMetric(reference.configurationId, 'cost'),
    meanDurationSecondsPerScoredAttempt: approvedReferenceMetric(reference.configurationId, 'time'),
    scoredAttempts: observation.benchmark.scoredAttempts ?? 0,
    runs: observation.benchmark.runs ?? 0,
    costBasis: observation.series.pricingBasis,
  }
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
  if (targetVariant && targetVariant.deepSWEv1_1Score !== input.aaDeepSWEv1_1Score) throw new Error(`Scenario score does not match the exact AA target row for ${input.model} ${input.effort}`)

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
  const costRows = costCalibrationRows ?? []
  const timeRows = timeCalibrationRows ?? []
  const sourceSuiteCost = targetVariant?.pooledCostPerTask?.usd
  const sourceSuiteTime = targetVariant?.pooledExecutionTimePerTask?.seconds
  const suiteCost = typeof sourceSuiteCost === 'number' && Number.isFinite(sourceSuiteCost) && sourceSuiteCost >= 0
    ? sourceSuiteCost
    : null
  const suiteTime = typeof sourceSuiteTime === 'number' && Number.isFinite(sourceSuiteTime) && sourceSuiteTime >= 0
    ? sourceSuiteTime
    : null

  const sameSourceOutput = requiredDirectOutputFact(input.targetObservation.observationId)

  const costUsd = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit' && suiteCost !== null && costCalibrationRows
    ? throughOriginSlope(costRows) * suiteCost
    : input.costCalibrationMethod === 'exact-model-effort-deepswe-reference'
      ? direct?.meanCostUsdPerScoredAttempt ?? null
      : input.costCalibrationMethod === 'opus-5-max-single-pair-ratio' && suiteCost !== null && costCalibrationRows
        ? costRows[0] ? costRows[0].ratio * suiteCost : null
        : null
  const costFactors = costRows.map((row) => row.ratio)
  const costSensitivityRange = costFactors.length > 1
    ? suiteCost === null ? null : [Math.min(...costFactors) * suiteCost, Math.max(...costFactors) * suiteCost] as [number, number]
    : null
  const timeFactors = timeRows.map((row) => row.ratio)
  const timeFactor = input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? timeFactors.length ? timeFactors.reduce((sum, factor) => sum + factor, 0) / timeFactors.length : null
    : timeFactors[0] ?? null
  const timeSecondsPerScoredAttempt = input.timeCalibrationMethod === 'exact-model-effort-deepswe-reference'
    ? direct?.meanDurationSecondsPerScoredAttempt ?? null
    : (input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio' || input.timeCalibrationMethod === 'opus-5-max-single-pair-ratio') && timeCalibrationRows && suiteTime !== null && timeFactor !== null
      ? suiteTime * timeFactor
      : null
  const timeSensitivityRange = timeFactors.length > 1
    ? suiteTime === null ? null : [Math.min(...timeFactors) * suiteTime, Math.max(...timeFactors) * suiteTime] as [number, number]
    : null

  const costLooMape = costLeaveOneOutMape(costRows)
  const timeLooMape = timeLeaveOneOutMape(timeRows)
  const unknownCostBases = costRows.filter((row) => !row.costBasisKnown).length
  const opusCalibrationConfigurationId = research.datacurveDirectMatches.find((row) => row.scenarioModelLabel === research.costCalibration.anthropicOpusFamilyPair.calibrationModel)?.configurationId
  const confidenceNote = direct
    ? `Low qualitative evidence, not a probability: a separate Datacurve DeepSWE v1.1 ${direct.model} max mini-swe-agent row supplies ${direct.scoredAttempts} scored attempts across ${direct.runs} runs. Model and effort match, but evaluator/harness differ from the AA ${input.aaAgent} row. Cost basis ${direct.costBasis ? 'is reported' : 'is unspecified'}; Datacurve timer boundaries are unspecified. No prediction interval is justified.`
    : input.evidenceQuality === 'low'
       ? `Low qualitative dollar/time evidence, not a probability: ${costRows.length} cost pairs (LOO MAPE ${costLooMape?.toFixed(1) ?? 'not available'}%) and ${timeRows.length} measured wall-time pairs (LOO MAPE ${timeLooMape?.toFixed(1) ?? 'not available'}%); ${unknownCostBases} calibration cost bases are unknown. These small-sample envelopes are not confidence or prediction intervals.`
      : 'Very low qualitative evidence, not a probability: one adjacent-version Opus 5 max pair, with no holdout and no defensible sensitivity range or prediction interval; target time is additionally rounded to 0.1 hour.'
  const costCalibrationDescription = input.costCalibrationMethod === 'openai-max-through-origin-proportional-fit'
    ? 'Through-origin proportional fit of three OpenAI max Datacurve DeepSWE USD/attempt values against AA pooled Coding Agent USD/task values, applied to the target AA suite cost.'
    : input.costCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? `Adjacent-version Opus 5.5 cost transfer: Datacurve Opus 5 max mean USD per scored attempt (${opusCalibrationConfigurationId ?? 'pinned Opus 5 reference'}) divided by AA Opus 5 max pooled Coding Agent USD/task, applied to the Opus 5.5 ${targetVariant?.pooledCostPerTask.reportedText ?? 'reported suite-cost'} input. The Datacurve cost basis is unspecified; the AA input pools multiple benchmarks and is not a DeepSWE-only cost or target-run bill.`
    : direct
      ? `Same-model, same-max Datacurve mean USD per scored attempt from ${direct.configurationId}; carried as a separate cross-harness scenario. ${direct.costBasis ? 'The source cost basis is reported.' : 'The source cost basis is unspecified.'}`
      : 'No compatible cost reference is available.'
  const timeCalibrationDescription = input.timeCalibrationMethod === 'openai-max-arithmetic-mean-ratio'
    ? 'Mean of two measured same-model/max Datacurve mean-seconds-per-scored-attempt / AA wall-clock-seconds-per-task ratios, transferred to the target AA suite time. AA pools multiple benchmarks and Datacurve timer boundaries are unspecified; this is not a verified end-to-end duration.'
    : input.timeCalibrationMethod === 'opus-5-max-single-pair-ratio'
      ? `Adjacent-version Opus 5.5 duration transfer: Datacurve Opus 5 max mean duration per scored attempt (${opusCalibrationConfigurationId ?? 'pinned Opus 5 reference'}) divided by AA Opus 5 max pooled wall-clock seconds per task, applied to the Opus 5.5 ${targetVariant?.pooledExecutionTimePerTask.reportedText ?? 'reported time'} input. The AA target is rounded to 0.1 hour; Datacurve timer boundaries are unspecified, so this is not a verified end-to-end duration.`
    : direct
      ? `Same-model, same-max Datacurve reported mean seconds per scored attempt from ${direct.configurationId}; carried as a separate cross-harness scenario. Timer boundaries are unspecified, so it is not a verified end-to-end duration.`
      : 'No compatible time reference is available.'
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
    aaCodingSuiteCostUsdPerTask: suiteCost,
    aaCodingSuiteTimeSecondsPerTask: suiteTime,
    aaCodingSuiteMixedTokensPerTask: targetVariant?.pooledTokenUsagePerTask?.tokens ?? null,
    outputTokensPerScoredAttempt: sameSourceOutput.value,
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
    costCalibrationMethod: costUsd === null ? 'not-estimated' : input.costCalibrationMethod,
    timeCalibrationMethod: timeSecondsPerScoredAttempt === null ? 'not-estimated' : input.timeCalibrationMethod,
    outputCalibrationDescription: `AA public serialized variant data reports the exact ${input.model} ${input.effort} ${input.aaAgent} DeepSWE v1.1 mean.outputTokens. No cost-to-token conversion or Intelligence Index transfer is used for this output. Output-specific telemetry count and reasoning inclusion are unspecified.`,
    costCalibrationDescription,
    timeCalibrationDescription,
    outputCalibrationRows: [],
    costCalibrationRows: costRows,
    timeCalibrationRows: timeRows,
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
    sources: [aaComparison, datacurve, aaDirectOutputSource(sameSourceOutput)],
    scenarioStatistic: 'mean-only',
    metricConfiguration: metricConfigurationFor(input.targetObservation.observationId),
  }
}

function buildCostOnlyScenario(input: ResearchCostOnlyScenario): UsageScenario {
  if (input.evidenceQuality !== 'low' && input.evidenceQuality !== 'very-low') throw new Error(`Unsupported evidence quality for ${input.model}`)
  if (input.costScenarioType !== 'aa-suite-proxy' && input.costScenarioType !== 'source-reported-cost') throw new Error(`Unsupported cost scenario type for ${input.model}`)
  const targetVariant = input.costScenarioType === 'aa-suite-proxy'
    ? research.aaCodingAgentVariants.find((variant) =>
      variant.model === input.model && variant.effort === input.effort && variant.harness === input.targetObservation.harness)
    : null
  const suiteCostMatches = input.costScenarioType !== 'aa-suite-proxy' || Boolean(targetVariant
    && targetVariant.deepSWEv1_1Score === input.targetObservation.scoreReportedText
    && targetVariant.pooledCostPerTask.usd === input.costUsd)
  const validCost = Number.isFinite(input.costUsd) && input.costUsd >= 0 && suiteCostMatches ? input.costUsd : null

  const source = sourceReference(input.sourceId, input.evidenceLocator)
  const outputFact = directOutputFact(input.targetObservation.observationId)
  const hasDirectOutput = outputFact?.value !== null && outputFact?.value !== undefined
  const outputFactSource = outputFact && chineseResearch.sources.find((row) => row.id === outputFact.identity.sourceId)
  if (outputFact && hasDirectOutput && (outputFact.identity.reportedModel !== input.model || outputFact.identity.effort !== input.effort || outputFact.identity.harness !== input.targetObservation.harness || outputFact.identity.benchmarkVersion !== input.targetBenchmarkVersion)) throw new Error(`AA output evidence does not match the suite-cost target: ${input.model}`)
  const fableOutput = input.targetObservation.observationId === 'aa-claude-code-fable-5.1-max-v1.1' ? directOutputFact(input.targetObservation.observationId) : null
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
    outputTokensPerScoredAttempt: hasDirectOutput ? outputFact!.value : null,
    outputUnit: hasDirectOutput ? 'AA DeepSWE v1.1 output tokens / task attempt' : 'output tokens / scored rollout attempt',
    outputEvidenceType: hasDirectOutput ? 'same-source-deepswe-mean' : 'not-estimated',
    outputStatistic: hasDirectOutput ? 'source-deepswe-mean' : 'not-estimated',
    outputTokenSensitivityRange: null,
    costUsd: validCost,
    costUnit: input.costUnit,
    costSensitivityRange: null,
    timeSecondsPerScoredAttempt: null,
    timeSensitivityRange: null,
    outputCalibrationMethod: hasDirectOutput ? 'same-aa-variant-deepswe-mean' : 'not-estimated',
    costCalibrationMethod: validCost === null ? 'not-estimated' : input.costMethod,
    timeCalibrationMethod: 'not-estimated',
    outputCalibrationDescription: hasDirectOutput ? `Source-reported mean.outputTokens for the exact ${input.model} ${input.effort} ${input.targetObservation.harness} variant's DeepSWE v1.1 eval; token-telemetry-specific count and reasoning-token inclusion not established. This is not derived from pooled suite cost and does not populate the approved measurement field.` : 'No output-token estimate is attached to this cost-only scenario.',
    costCalibrationDescription: validCost === null ? 'No valid optional cost scenario is configured for this target.' : input.costDescription,
    timeCalibrationDescription: 'No time estimate is attached to this cost-only scenario.',
    outputCalibrationRows: [],
    costCalibrationRows: [],
    timeCalibrationRows: [],
    outputLeaveOneOutMapePercent: null,
    costLeaveOneOutMapePercent: null,
    timeLeaveOneOutMapePercent: null,
    directUsageReference: null,
    sensitivityNote: 'No cost sensitivity range or prediction interval is supported; same-source DeepSWE output means have no published output-token interval.',
    sources: hasDirectOutput && outputFactSource ? [source, inferenceSourceReference(outputFactSource, 'chinese')] : fableOutput ? [source, aaDirectOutputSource(fableOutput)] : [source],
    scenarioStatistic: input.costScenarioType === 'aa-suite-proxy' ? 'pooled-suite-average' : 'source-statistic-unspecified',
    metricConfiguration: metricConfigurationFor(input.targetObservation.observationId),
  }
}

function buildMetaGoogleXaiScenario(input: typeof metaResearch.targets[number]): UsageScenario {
  const config = scenarioConfigFor(input.observationId)
  const family = config?.scenarioFamily
  if (!config || (family !== 'google-reference' && family !== 'meta-transfer' && family !== 'xai-transfer')) throw new Error(`Missing explicit usage configuration for ${input.observationId}`)
  const isGoogle = family === 'google-reference'
  const isMeta = family === 'meta-transfer'
  const calibrationGroup = isMeta ? metaResearch.calibration.meta : metaResearch.calibration.xai
  const target = {
    name: config.reportedModel!,
    publisher: config.publisher!,
    sourceCategory: config.sourceCategory!,
    harness: config.harness ?? null,
    effort: config.effort!,
    scoreMetric: config.scoreMetric!,
    benchmarkVersion: config.benchmarkVersion!,
    scoreReportedText: config.scoreReportedText!,
  }
  const outputCalibrationRows: UsageScenario['outputCalibrationRows'] = isGoogle ? [] : calibrationGroup.flatMap((row) => {
    if (!Number.isFinite(row.aaIITotalOutputMillions) || row.aaIITotalOutputMillions <= 0 || !Number.isFinite(row.meanOutputTokensPerScoredAttempt) || row.meanOutputTokensPerScoredAttempt < 0) return []
    return [{ model: `${row.model} ${row.effort} · AA II aggregate`, aaOutputTokens: row.aaIITotalOutputMillions * 1_000_000, deepSWEOutputTokens: row.meanOutputTokensPerScoredAttempt, scoredAttempts: row.attempts, ratio: row.meanOutputTokensPerScoredAttempt / (row.aaIITotalOutputMillions * 1_000_000) }]
  })
  const costCalibrationRows: UsageScenario['costCalibrationRows'] = isGoogle ? [] : calibrationGroup.flatMap((row) => {
    if (!Number.isFinite(row.aaIIUsdPerTask) || row.aaIIUsdPerTask <= 0 || !Number.isFinite(row.meanUsdPerScoredAttempt) || row.meanUsdPerScoredAttempt < 0) return []
    return [{ model: `${row.model} ${row.effort} · AA II cost/task`, aaUsd: row.aaIIUsdPerTask, deepSWEUsd: row.meanUsdPerScoredAttempt, ratio: row.meanUsdPerScoredAttempt / row.aaIIUsdPerTask, costBasisKnown: row.costBasis !== null }]
  })
  const referenceId = config.metrics.outputTokens.referenceIds[0] ?? null
  const referenceObservation = isGoogle && referenceId ? approvedReferenceObservation(referenceId) : null
  const referenceOutput = referenceObservation ? metricObservation(referenceObservation, 'outputTokens', 'mean').value : null
  const referenceCost = referenceObservation ? metricObservation(referenceObservation, 'cost', 'mean').value : null
  const targetOutputScale = typeof input.aaIITotalOutputMillions === 'number' && Number.isFinite(input.aaIITotalOutputMillions) && input.aaIITotalOutputMillions >= 0 ? input.aaIITotalOutputMillions * 1_000_000 : null
  const targetCostScale = typeof input.aaIIUsdPerTask === 'number' && Number.isFinite(input.aaIIUsdPerTask) && input.aaIIUsdPerTask >= 0 ? input.aaIIUsdPerTask : null
  const cost = isGoogle
    ? typeof referenceCost === 'number' && Number.isFinite(referenceCost) && referenceCost >= 0 ? referenceCost : null
    : targetCostScale !== null && costCalibrationRows.length ? costCalibrationRows.reduce((sum, row) => sum + row.ratio * targetCostScale, 0) / costCalibrationRows.length : null
  const output = isGoogle
    ? typeof referenceOutput === 'number' && Number.isFinite(referenceOutput) && referenceOutput >= 0 ? referenceOutput : null
    : targetOutputScale !== null && outputCalibrationRows.length
      ? outputCalibrationRows.reduce((sum, row) => sum + row.deepSWEOutputTokens / (row.aaOutputTokens / 1_000_000) * input.aaIITotalOutputMillions!, 0) / outputCalibrationRows.length
      : null
  const sourceIds = config.sourceEvidenceIds!
  const sources = sourceIds.flatMap((id) => {
    const source = metaResearch.sources.find((row) => row.id === id)
    return source ? [inferenceSourceReference({ ...source, locator: [source.locator, source.responseCaveat].filter(Boolean).join(' · ') }, 'meta-google-xai')] : []
  })
  const direct = isGoogle && referenceObservation && referenceId ? {
    configurationId: referenceId,
    model: target.name,
    effort: target.effort,
    harness: target.harness ?? 'mini-swe-agent',
    scoredAttempts: referenceObservation.benchmark.scoredAttempts ?? 0,
    runs: referenceObservation.benchmark.runs ?? 0,
    costBasis: referenceObservation.series.pricingBasis,
  } : null
  const outputRange = isGoogle || targetOutputScale === null || outputCalibrationRows.length === 0 ? null : [Math.min(...outputCalibrationRows.map((row) => row.ratio * targetOutputScale)), Math.max(...outputCalibrationRows.map((row) => row.ratio * targetOutputScale))] as [number, number]
  const costRange = isGoogle || targetCostScale === null || costCalibrationRows.length === 0 ? null : [Math.min(...costCalibrationRows.map((row) => row.ratio * targetCostScale)), Math.max(...costCalibrationRows.map((row) => row.ratio * targetCostScale))] as [number, number]
  const contextSources = (config.contextSources ?? []) as unknown as UsageScenarioSource[]
  return {
    id: `${input.observationId}:usage-scenario`, model: target.name, effort: target.effort,
    targetObservationId: input.observationId, targetReportedName: target.name, targetPublisher: target.publisher, targetHarness: target.harness, targetSourceCategory: target.sourceCategory, targetBenchmarkVersion: target.benchmarkVersion, targetScoreMetric: target.scoreMetric, targetScoreReportedText: target.scoreReportedText,
    costScenarioType: family === 'google-reference' ? 'datacurve-usage-reference' : 'cross-platform-transfer', confidence: family === 'google-reference' ? 'low' : 'very-low',
    confidenceNote: isGoogle ? 'Same reported API model, high thinking and mini-SWE-agent DeepSWE v1.1, but this is a separate Datacurve experiment, not the Google run. Immutable checkpoint, attempt set and cost basis are not established.' : isMeta ? 'Very weak adjacent-version 1.1/1.2 xhigh to 1.3 max transfer across DeepSWE and AA Intelligence Index workloads; effort differs. Two-predecessor output/cost LOO MAPE 59.1%/88.9%. A separate Muse Code 1.3 max AA DeepSWE variant directly reports ~122,492 output tokens/task attempt, but it is not Meta’s mini-swe-agent run and its $3.98/task is a three-benchmark suite average, not Meta’s bill.' : 'Very weak adjacent-version Grok 4.5/4.6 high to 4.7 high transfer across DeepSWE and AA Intelligence Index workloads; developer harness unknown. Output LOO MAPE 35.1%. A tight two-point cost fit does not imply a reliable bill.',
    aaCodingSuiteCostUsdPerTask: null, aaCodingSuiteTimeSecondsPerTask: null, aaCodingSuiteMixedTokensPerTask: null,
    outputTokensPerScoredAttempt: output, outputUnit: 'output tokens / scored rollout attempt', outputEvidenceType: isGoogle ? 'cross-experiment-reference' : 'cross-benchmark-transfer', outputStatistic: 'mean-only', outputTokenSensitivityRange: outputRange,
    costUsd: cost, costUnit: 'USD per scored rollout attempt', costSensitivityRange: costRange,
    timeSecondsPerScoredAttempt: null, timeSensitivityRange: null,
    outputCalibrationMethod: config.metrics.outputTokens.method, costCalibrationMethod: config.metrics.cost.method, timeCalibrationMethod: 'not-estimated',
    outputCalibrationDescription: isGoogle ? direct ? `Datacurve ${direct.configurationId} mean output tokens over ${direct.scoredAttempts} scored attempts in four runs; same API model/high thinking, separate Google experiment.` : 'No compatible separate Google usage reference is available.' : `Unweighted mean of two predecessor Datacurve DeepSWE output means scaled by target/reference AA Intelligence Index AGGREGATE output tokens (millions over entire evaluation, not tokens/task). Cross-benchmark adjacent-version transfer; ${isMeta ? 'Meta predecessors are xhigh while the target is max.' : 'Grok predecessors and target are all high effort.'}`,
    costCalibrationDescription: isGoogle ? direct ? `Datacurve ${direct.configurationId} mean USD per scored attempt; separate Google experiment, cost basis unreported.` : 'No compatible separate Google cost reference is available.' : 'Unweighted mean of two predecessor Datacurve DeepSWE USD/attempt scaled by target/reference AA Intelligence Index weighted USD/task. Different benchmarks and unknown Datacurve price bases; not the AA pooled Coding Agent suite cost.',
    timeCalibrationDescription: 'No time estimate is attached to this scenario.',
    outputCalibrationRows, costCalibrationRows, timeCalibrationRows: [], outputLeaveOneOutMapePercent: isGoogle ? null : outputLeaveOneOutMape(outputCalibrationRows), costLeaveOneOutMapePercent: isGoogle || costCalibrationRows.length !== 2 ? null : meanAbsolutePercentageError(costCalibrationRows.map((heldOut, index) => { const other = costCalibrationRows[1 - index]!; return (other.ratio * heldOut.aaUsd - heldOut.deepSWEUsd) / heldOut.deepSWEUsd * 100 })), timeLeaveOneOutMapePercent: null,
    directUsageReference: direct, sensitivityNote: isGoogle ? 'One separate run reference, not a confidence interval or a measurement of the Google run.' : 'Extrema of two predecessor transfers are sensitivity cases, not confidence or prediction intervals.',
    sources: [...sources, ...contextSources], scenarioStatistic: 'mean-only', metricConfiguration: metricConfigurationFor(input.observationId),
  }
}

function iiCalibrationRows(metric: XMetric) {
  return research.efficiencyExtension.iiAnchors.filter((anchor) => anchor.metrics.includes(metric)).flatMap((anchor) => {
    const reference = research.efficiencyExtension.references.find((row) => row.id === anchor.referenceId)!
    const aa = reference[metric]
    const value = approvedReferenceMetric(anchor.configurationId, metric)
    const observation = approvedReferenceObservation(anchor.configurationId)
    return aa !== null && aa > 0 && value !== null && observation ? [{
      model: reference.model, aa, value, ratio: value / aa,
      scoredAttempts: observation.benchmark.scoredAttempts ?? 0, costBasisKnown: observation.series.pricingBasis !== null,
    }] : []
  })
}

function extendEfficiencyScenario(input: EfficiencyTarget, existing?: UsageScenario): UsageScenario {
  const observation = approvedData.observations.find((row) => row.id === input.observationId)! as Observation
  const reference = research.efficiencyExtension.references.find((row) => row.id === input.referenceId)!
  const coding = reference.workload === 'coding'
  const outputRows = coding ? [] : iiCalibrationRows('outputTokens').map((row) => ({ model: row.model, aaOutputTokens: row.aa, deepSWEOutputTokens: row.value, scoredAttempts: row.scoredAttempts, ratio: row.ratio }))
  const costRows = coding ? openAiCostPairs() : iiCalibrationRows('cost').map((row) => ({ model: row.model, aaUsd: row.aa, deepSWEUsd: row.value, ratio: row.ratio, costBasisKnown: row.costBasisKnown }))
  const timeRows = coding ? openAiTimePairs() : iiCalibrationRows('time').map((row) => ({ model: row.model, aaSeconds: row.aa, deepSWEDurationSeconds: row.value, scoredAttempts: row.scoredAttempts, ratio: row.ratio }))
  const averageRatio = (rows: { ratio: number }[]) => rows.length ? rows.reduce((sum, row) => sum + row.ratio, 0) / rows.length : null
  const scaled = (value: number | null, factor: number | null) => value !== null && factor !== null && Number.isFinite(factor) ? value * factor : null
  const config = metricConfigurationFor(input.observationId)
  const scenario: UsageScenario = existing ? { ...existing, metricConfiguration: config, sources: [...existing.sources] } : {
    id: `${observation.id}:usage-scenario`, model: observation.model.reportedName, effort: observation.effort.reportedLabel,
    targetObservationId: observation.id, targetReportedName: observation.model.reportedName, targetPublisher: observation.publisher,
    targetHarness: observation.series.harness, targetSourceCategory: observation.sourceCategory, targetBenchmarkVersion: observation.benchmark.version ?? null,
    targetScoreMetric: observation.result.metric, targetScoreReportedText: observation.result.reportedText,
    costScenarioType: 'cross-platform-transfer', confidence: 'very-low', confidenceNote: '',
    aaCodingSuiteCostUsdPerTask: coding ? reference.cost : null, aaCodingSuiteTimeSecondsPerTask: coding ? reference.time : null, aaCodingSuiteMixedTokensPerTask: null,
    outputTokensPerScoredAttempt: null, outputUnit: 'output tokens / scored rollout attempt', outputEvidenceType: 'not-estimated', outputStatistic: 'not-estimated', outputTokenSensitivityRange: null,
    costUsd: null, costUnit: 'USD per scored rollout attempt', costSensitivityRange: null,
    timeSecondsPerScoredAttempt: null, timeSensitivityRange: null,
    outputCalibrationMethod: 'not-estimated', costCalibrationMethod: 'not-estimated', timeCalibrationMethod: 'not-estimated',
    outputCalibrationDescription: 'No supported output reference.', costCalibrationDescription: 'No supported cost reference.', timeCalibrationDescription: 'No supported time reference.',
    outputCalibrationRows: [], costCalibrationRows: [], timeCalibrationRows: [],
    outputLeaveOneOutMapePercent: null, costLeaveOneOutMapePercent: null, timeLeaveOneOutMapePercent: null, directUsageReference: null,
    sensitivityNote: 'Exploratory reference/transfer only; no confidence or prediction interval is supported.', sources: [], scenarioStatistic: 'mean-only', metricConfiguration: config,
  }
  const caveat = `${input.assumption} ${coding ? research.efficiencyExtension.semantics.coding : research.efficiencyExtension.semantics.ii}`
  scenario.confidenceNote = [existing?.confidenceNote, `Very low qualitative evidence for additional metrics, not a probability. ${caveat} ${research.efficiencyExtension.semantics.limits}`].filter(Boolean).join(' ')
  for (const metric of input.metrics as XMetric[]) {
    if (scenarioXValue(scenario, metric) !== null) throw new Error(`Efficiency extension would replace an existing ${metric} reference for ${input.observationId}`)
    const method = config[metric].method
    if (metric === 'outputTokens') {
      scenario.outputTokensPerScoredAttempt = coding ? reference.outputTokens : scaled(reference.outputTokens, averageRatio(outputRows))
      scenario.outputEvidenceType = coding ? 'cross-experiment-reference' : 'cross-benchmark-transfer'
      scenario.outputStatistic = 'mean-only'
      scenario.outputCalibrationMethod = method
      scenario.outputCalibrationRows = outputRows
      scenario.outputCalibrationDescription = `${coding ? 'Carry the same-model AA DeepSWE v1.1 mean.outputTokens as a separate-experiment reference, without scaling.' : 'AA II output tokens/task (reasoning plus answer) multiplied by the mean of two approved OpenAI max DeepSWE-output / II-output ratios.'} ${caveat}`
    } else if (metric === 'cost') {
      scenario.costUsd = scaled(reference.cost, costRows.length ? throughOriginSlope(costRows) : null)
      scenario.costCalibrationMethod = method
      scenario.costCalibrationRows = costRows
      scenario.costCalibrationDescription = `AA ${coding ? 'pooled Coding Agent suite' : 'weighted II'} USD/task multiplied by sum(AA_i * approved_DeepSWE_i) / sum(AA_i^2), using three OpenAI max anchors. ${research.efficiencyExtension.semantics.calibration} ${caveat}`
    } else {
      scenario.timeSecondsPerScoredAttempt = scaled(reference.time, averageRatio(timeRows))
      scenario.timeCalibrationMethod = method
      scenario.timeCalibrationRows = timeRows
      scenario.timeCalibrationDescription = `AA ${coding ? 'pooled agentWallTimeSec' : 'weighted II seconds/task'} multiplied by mean(approved_DeepSWE_seconds_i / AA_seconds_i), using ${timeRows.length} OpenAI max anchors. Timer scopes differ; not a verified end-to-end duration. ${research.efficiencyExtension.semantics.calibration} ${caveat}`
    }
  }
  scenario.sources.push(sourceReference(reference.sourceId, `${reference.locator}; ${coding ? 'mean.costUsd; mean.agentWallTimeSec; evals[datasetIndexName=deep-swe-v1.1].mean.outputTokens' : 'intelligenceIndexCostPerTask.cost.total; intelligenceIndexOutputTokensPerTask.output; intelligenceIndexTimePerTask'}`))
  scenario.sources.push(sourceReference('datacurve-v1.1-json', `Approved full-precision OpenAI max calibration metrics; revision ${pinnedApprovedRevision}`))
  if (!coding) for (const anchor of research.efficiencyExtension.iiAnchors) {
    const fact = research.efficiencyExtension.references.find((row) => row.id === anchor.referenceId)!
    scenario.sources.push(sourceReference(fact.sourceId, `${fact.locator}; II per-task efficiency calibration inputs`))
  }
  if (coding) scenario.sources.push(sourceReference('aa-codex-vs-kimi-code-cli', 'Pinned historical OpenAI max pooled Coding Agent cost/time inputs; existing membership and coefficients retained.'))
  scenario.sources = scenario.sources.filter((source, index, all) => all.findIndex((row) => row.id === source.id && row.evidenceLocator === source.evidenceLocator) === index)
  return scenario
}

const baselineScenarios: UsageScenario[] = [
  ...research.scenarios.map(buildScenario),
  ...research.costOnlyScenarios.map(buildCostOnlyScenario),
  ...metaResearch.targets.map(buildMetaGoogleXaiScenario),
]

export const usageScenarios: UsageScenario[] = [
  ...baselineScenarios.map((scenario) => {
    const extension = research.efficiencyExtension.targets.find((row) => row.observationId === scenario.targetObservationId)
    return extension ? extendEfficiencyScenario(extension, scenario) : scenario
  }),
  ...research.efficiencyExtension.targets.filter((row) => !baselineScenarios.some((scenario) => scenario.targetObservationId === row.observationId)).map((row) => extendEfficiencyScenario(row)),
]

/** Exact Artificial Analysis observation identity is required; aliases and other harness reports never inherit a scenario. */
export function usageScenarioForObservation(observation: Observation, approvedDatasetRevision?: string): UsageScenario | null {
  const scenario = usageScenarios.find((item) => item.targetObservationId === observation.id)
  if (!scenario) return null
  const config = scenarioConfigFor(observation.id)
  const pinnedObservation = approvedData.observations.find((item) => item.id === observation.id) as Observation | undefined
  if (!config || !pinnedObservation || approvedData.revisionId !== research.scenarioConfig.approvedDatasetRevision
    || (approvedDatasetRevision !== undefined && approvedDatasetRevision !== research.scenarioConfig.approvedDatasetRevision)) return null
  if (observation.provenance.sourceId !== config.sourceId
    || observation.model.canonicalId !== config.canonicalId
    || observation.model.snapshot !== config.snapshot
    || observation.model.reportedName !== scenario.targetReportedName
    || observation.publisher !== scenario.targetPublisher
    || observation.sourceCategory !== scenario.targetSourceCategory
    || observation.series.harness !== scenario.targetHarness
    || observation.effort.reportedLabel !== scenario.effort
    || observation.effort.rawSetting !== scenario.effort
    || observation.benchmark.version !== scenario.targetBenchmarkVersion
    || observation.benchmark.scope !== pinnedObservation.benchmark.scope
    || observation.benchmark.taskCount !== pinnedObservation.benchmark.taskCount
    || observation.benchmark.taskSetRevision !== pinnedObservation.benchmark.taskSetRevision
    || observation.result.metric !== scenario.targetScoreMetric
    || observation.result.reportedText !== scenario.targetScoreReportedText) return null
  if (scenario.costScenarioType === 'source-reported-cost' && observation.pricing.asReportedCost !== scenario.costUsd) return null
  return scenario
}

/** Scenarios are shown only with the Mean control and are never part of a strict comparison. Source-statistic gaps remain explicit. */
export function usageScenarioForComparison(
  observation: Observation,
  metric: XMetric,
  statistic: Statistic,
  strict: boolean,
): UsageScenario | null {
  if (strict || statistic !== 'mean') return null
  const scenario = usageScenarioForObservation(observation)
  return scenario && scenarioXValue(scenario, metric) !== null ? scenario : null
}

export function scenarioXValue(scenario: UsageScenario, metric: XMetric): number | null {
  if (metric === 'cost') return scenario.costUsd
  if (metric === 'outputTokens') return scenario.outputTokensPerScoredAttempt
  return scenario.timeSecondsPerScoredAttempt
}

export interface ResolvedUsageCandidate {
  value: number
  unit: string
  statistic: string
  evidenceKind: Exclude<UsageEvidenceKind, 'no-data'>
  relationship: string
  method: string | null
  sourceIds: string[]
  factIds: string[]
  referenceIds: string[]
  scenarioId: string | null
  eligible: boolean
  exclusionReason: string | null
}

export interface ResolveXUsageOptions {
  /** Enables optional facts for Mean/non-strict chart contexts. Defaults to false. */
  scenariosEnabled?: boolean
  strict?: boolean
  /** Pass the active approved dataset revision; a mismatched pinned config is not used. */
  approvedDatasetRevision?: string
}

export interface ResolveXUsageResult {
  observationId: string
  metric: XMetric
  requestedStatistic: Statistic
  value: number | null
  unit: string
  statistic: string | null
  evidenceKind: UsageEvidenceKind
  relationship: string | null
  method: string | null
  sourceIds: string[]
  factIds: string[]
  referenceIds: string[]
  scenarioId: string | null
  reason: string | null
  alternatives: ResolvedUsageCandidate[]
}

function scenarioMetricValue(scenario: UsageScenario, metric: XMetric): number | null {
  return scenarioXValue(scenario, metric)
}

function scenarioMetricUnit(scenario: UsageScenario, metric: XMetric): string {
  if (metric === 'cost') return scenario.costUnit
  if (metric === 'outputTokens') return scenario.outputUnit
  return 'seconds per scored rollout attempt'
}

/** Selects one coordinate for a single observation/metric. Call after full-dataset chart precedence and before axis-scale handling. */
export function resolveXUsage(
  observation: Observation,
  metric: XMetric,
  statistic: Statistic,
  options: ResolveXUsageOptions = {},
): ResolveXUsageResult {
  const selectedMeasurement = metricObservation(observation, metric, statistic)
  const scenario = usageScenarioForObservation(observation, options.approvedDatasetRevision)
  const scenarioConfig = scenario?.metricConfiguration[metric]
  const scenarioValue = scenario ? scenarioMetricValue(scenario, metric) : null
  const optionalAllowed = options.scenariosEnabled === true && options.strict !== true && statistic === 'mean'
  const scenarioExclusionReason = options.strict
    ? 'Optional usage scenarios are excluded in strict mode.'
    : statistic !== 'mean'
      ? 'Optional usage scenarios provide mean-only evidence; medians are not inferred.'
      : options.scenariosEnabled !== true
        ? 'Optional usage scenarios are disabled.'
        : null
  const alternative: ResolvedUsageCandidate | null = scenario && scenarioConfig && scenarioConfig.selection !== 'none' && scenarioValue !== null
    ? {
      value: scenarioValue,
      unit: scenarioMetricUnit(scenario, metric),
      statistic: scenarioConfig.statistic,
      evidenceKind: scenarioConfig.selection === 'same-source-reference' ? 'same-source-reference' : 'configured-fallback',
      relationship: scenarioConfig.relationship,
      method: scenarioConfig.method,
      sourceIds: [...scenarioConfig.sourceIds],
      factIds: [...scenarioConfig.factIds],
      referenceIds: [...scenarioConfig.referenceIds],
      scenarioId: scenario.id,
      eligible: optionalAllowed && Number.isFinite(scenarioValue) && scenarioValue >= 0,
      exclusionReason: !Number.isFinite(scenarioValue) || scenarioValue < 0 ? 'Optional value is not a finite nonnegative coordinate.' : scenarioExclusionReason,
    }
    : null
  const alternatives = alternative ? [alternative] : []
  if (selectedMeasurement.value !== null) {
    if (!Number.isFinite(selectedMeasurement.value) || selectedMeasurement.value < 0) {
      return {
        observationId: observation.id, metric, requestedStatistic: statistic, value: null, unit: selectedMeasurement.unit,
        statistic: selectedMeasurement.statistic, evidenceKind: 'no-data', relationship: null, method: null,
        sourceIds: [], factIds: [], referenceIds: [], scenarioId: null,
        reason: `Selected approved ${statistic} value is not a finite nonnegative coordinate.`, alternatives,
      }
    }
    return {
      observationId: observation.id, metric, requestedStatistic: statistic, value: selectedMeasurement.value, unit: selectedMeasurement.unit,
      statistic: selectedMeasurement.statistic, evidenceKind: 'approved-measurement', relationship: 'approved-observation-measurement', method: null,
      sourceIds: [observation.provenance.sourceId], factIds: [], referenceIds: [], scenarioId: null,
      reason: null, alternatives,
    }
  }
  if (optionalAllowed && alternative?.eligible) {
    return {
      observationId: observation.id, metric, requestedStatistic: statistic, value: alternative.value, unit: alternative.unit,
      statistic: alternative.statistic, evidenceKind: alternative.evidenceKind, relationship: alternative.relationship, method: alternative.method,
      sourceIds: alternative.sourceIds, factIds: alternative.factIds, referenceIds: alternative.referenceIds, scenarioId: alternative.scenarioId,
      reason: null, alternatives: [],
    }
  }
  const noScenarioReason = scenarioConfig?.selection === 'none' ? 'No configured value is available for this metric.' : scenario ? `No valid optional value is available for this metric; ${selectedMeasurement.missingReason ?? 'approved value is absent.'}` : 'No exact usage scenario matches this observation identity.'
  const reason = scenarioConfig?.selection === 'none'
    ? selectedMeasurement.missingReason ?? noScenarioReason
    : scenarioExclusionReason ?? selectedMeasurement.missingReason ?? noScenarioReason
  return {
    observationId: observation.id, metric, requestedStatistic: statistic, value: null, unit: selectedMeasurement.unit,
    statistic: null, evidenceKind: 'no-data', relationship: null, method: null,
    sourceIds: [], factIds: [], referenceIds: [], scenarioId: null,
    reason, alternatives,
  }
}
