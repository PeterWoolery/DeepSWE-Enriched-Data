import { ObservationSchema, type Candidate, type Observation } from './schema'

export const DATACURVE_FEED_URL = 'https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json'
export const DATACURVE_SOURCE_ID = 'datacurve-v1.1-json'

export interface RetrievalMetadata {
  retrievedAt: string
  contentSha256: string
  httpStatus: 200
  etag: string | null
  lastModified: string | null
}

export interface OfficialFeed {
  scope: string
  unit: string
  generated_at: string
  n_tasks_in_set: number
  rows: Record<string, unknown>[]
  [key: string]: unknown
}

export interface NormalizedOfficialFeed {
  sourceId: string
  sourceUrl: string
  sourceGeneratedAt: string
  retrieval: RetrievalMetadata
  rowCount: number
  unknownOptionalFields: string[]
  observations: Observation[]
}

type EffortOrderFile = {
  models: Record<string, string[]>
  modelEvidence?: Record<string, { sources: string[]; rationale: string }>
}

function rawString(row: Record<string, unknown>, key: string, required = false): string | null {
  const value = row[key]
  if (value === null || value === undefined) {
    if (required) throw new Error(`Required field ${key} is missing.`)
    return null
  }
  if (typeof value !== 'string') throw new Error(`Field ${key} must be a string or null.`)
  return value
}

function rawNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Field ${key} must be a finite number or null.`)
  return value
}

function metric(args: {
  value: number | null
  sourceField: string
  unit: string
  reportedUnit: string
  statistic: 'mean' | 'median'
  locator: string
  population: string
  sampleCount: number | null
  sampleCountMissingReason: string | null
  scope: string
  definition: string
  inclusionNote?: string | null
}) {
  return {
    value: args.value,
    unit: args.unit,
    statistic: args.statistic,
    sourceField: args.sourceField,
    reportedValue: args.value,
    reportedUnit: args.reportedUnit,
    scope: args.scope,
    population: args.population,
    sampleCount: args.sampleCount,
    sampleCountMissingReason: args.sampleCount === null ? args.sampleCountMissingReason : null,
    definition: args.definition,
    sourceLocator: args.locator,
    missingReason: args.value === null ? `Datacurve did not report ${args.sourceField} for this configuration.` : null,
    includesReasoningTokens: null,
    inclusionNote: args.inclusionNote ?? null,
  }
}

function scoreValue(value: number | null, field: string, config: string): number {
  if (value === null || value < 0 || value > 1) {
    throw new Error(`Configuration ${config} has an invalid ${field} fraction: ${String(value)}.`)
  }
  return value
}

export function normalizeOfficialFeed(
  feed: OfficialFeed,
  retrieval: RetrievalMetadata,
  effortOrder: EffortOrderFile,
): NormalizedOfficialFeed {
  if (!feed.generated_at || !Number.isInteger(feed.n_tasks_in_set) || feed.n_tasks_in_set <= 0) {
    throw new Error('Official feed is missing a valid generated_at or task count.')
  }
  if (!feed.rows.length) throw new Error('Official feed is empty; approved data has not been changed.')

  const seen = new Set<string>()
  const allRowKeys = new Set<string>()
  const knownKeys = new Set([
    'config', 'model', 'harness', 'provider', 'reasoning_effort', 'source', 'pass_at_1', 'pass_at_4', 'pass_rate',
    'pass_rate_by_attempt', 'n_passed', 'n_attempted', 'n_tasks_attempted', 'n_tasks_passed_any', 'n_runs',
    'ci_lo', 'ci_hi', 'ci_half', 'ci_method', 'ci_passed', 'ci_attempted', 'mean_cost_usd', 'median_cost_usd',
    'cost_basis', 'mean_output_tokens', 'median_output_tokens', 'mean_duration_seconds', 'median_duration_seconds',
    'completed_by_attempt', 'mean_agent_steps', 'median_agent_steps', 'mean_cache_read_tokens', 'mean_cache_tokens',
    'mean_cache_write_tokens', 'mean_compute_units', 'mean_input_tokens', 'mean_reasoning_tokens', 'mean_uncached_input_tokens',
    'median_cache_read_tokens', 'median_cache_write_tokens', 'median_compute_units', 'median_input_tokens',
    'median_output_tokens_to_pass', 'median_peak_context_tokens', 'median_reasoning_tokens', 'median_uncached_input_tokens',
  ])

  const observations = feed.rows.map((row): Observation => {
    const config = rawString(row, 'config', true)!
    const model = rawString(row, 'model', true)!
    const harness = rawString(row, 'harness', true)!
    if (seen.has(config)) throw new Error(`Duplicate upstream configuration ID: ${config}`)
    seen.add(config)
    Object.keys(row).forEach((key) => allRowKeys.add(key))

    const provider = rawString(row, 'provider')
    const effort = rawString(row, 'reasoning_effort')
    const efforts = effortOrder.models[model] ?? []
    const modelOrderEvidence = effortOrder.modelEvidence?.[model]
    const effortPosition = effort === null ? -1 : efforts.indexOf(effort.toLowerCase())
    const effortOrderValue = effortPosition >= 0 && modelOrderEvidence ? effortPosition : null
    const scoredAttempts = rawNumber(row, 'ci_attempted')
    const attemptCount = rawNumber(row, 'n_attempted')
    const passedAttempts = rawNumber(row, 'n_passed')
    const runs = rawNumber(row, 'n_runs')
    const tasksAttempted = rawNumber(row, 'n_tasks_attempted')
    const tasksPassedAny = rawNumber(row, 'n_tasks_passed_any')
    const passAtOne = scoreValue(rawNumber(row, 'pass_at_1'), 'pass_at_1', config)
    const passAtFour = rawNumber(row, 'pass_at_4')
    const costBasis = rawString(row, 'cost_basis')
    const population = 'all scored rollout attempts in this configuration'
    const sampleCountMissingReason = 'A metric-specific sample count is not included in the feed.'
    const sampleCount = attemptCount
    const durationSampleCountMissingReason = 'Datacurve does not provide a duration-specific sample count; only the aggregate population is stated.'
    const seriesId = [DATACURVE_SOURCE_ID, model, harness, provider ?? 'provider-unknown', 'pass_at_1', 'scored-attempts']
      .map((part) => encodeURIComponent(part)).join('|')
    const isCostDiscrepancy = config === 'mini_swe_agent_gpt_5_6_sol_max'

    const observation = {
      id: `datacurve-v1.1:${config}`,
      upstreamConfigurationId: config,
      model: { reportedName: model, canonicalId: null, snapshot: null, aliasEvidence: null },
      publisher: 'Datacurve',
      evaluator: 'Datacurve',
      sourceCategory: 'organizer' as const,
      benchmark: {
        name: 'DeepSWE' as const,
        version: '1.1',
        scope: 'full' as const,
        taskSetRevision: null,
        taskCount: feed.n_tasks_in_set,
        tasksAttempted,
        tasksPassedAny,
        attempts: attemptCount,
        passedAttempts,
        scoredAttempts,
        runs,
        excludedPolicy: feed.unit,
        population: 'scored rollout attempts; attempt count is distinct from unique tasks',
      },
      result: {
        metric: 'pass_at_1',
        metricLabel: 'pass@1 — scored rollout attempt pass rate',
        value: passAtOne,
        unit: 'fraction',
        reportedValue: passAtOne,
        reportedUnit: 'fraction',
        reportedText: String(passAtOne),
        denominator: 'scored rollout attempts',
        denominatorCount: attemptCount,
        confidenceInterval: {
          low: rawNumber(row, 'ci_lo'),
          high: rawNumber(row, 'ci_hi'),
          confidence: row.ci_method === null || row.ci_method === undefined ? null : 0.95,
          method: rawString(row, 'ci_method'),
          passed: rawNumber(row, 'ci_passed'),
          attempted: rawNumber(row, 'ci_attempted'),
          missingReason: row.ci_lo == null || row.ci_hi == null ? 'Confidence bounds were not both reported.' : null,
        },
      },
      additionalResults: passAtFour === null ? [] : [{
        metric: 'pass_at_4',
        metricLabel: 'pass@4 — unique tasks with at least one passing attempt / tasks attempted',
        value: scoreValue(passAtFour, 'pass_at_4', config),
        unit: 'fraction',
        reportedValue: passAtFour,
        reportedUnit: 'fraction',
        reportedText: String(passAtFour),
        denominator: 'unique tasks attempted',
        denominatorCount: tasksAttempted,
        confidenceInterval: {
          low: null,
          high: null,
          confidence: null,
          method: null,
          passed: null,
          attempted: null,
          missingReason: 'Datacurve does not report a pass@4 confidence interval.',
        },
      }],
      effort: {
        reportedLabel: effort,
        rawSetting: effort,
        order: effortOrderValue,
        orderEvidence: effortOrderValue === null ? null : `${modelOrderEvidence?.rationale} Evidence source IDs: ${modelOrderEvidence?.sources.join(', ')}.`,
        missingReason: effort === null ? 'The feed does not report a reasoning_effort value.' : effortOrderValue === null ? 'No reviewed source-backed effort-order mapping exists for this exact model and setting.' : null,
      },
      series: {
        id: seriesId,
        connectionEvidence: 'Datacurve feed scope states configurations are grouped by harness, model, and reasoning effort; exact source, version, score metric, and population are shared within this feed series. Provider is part of the series key when reported. Unreported protocol details remain disclosed and strict mode excludes them.',
        connectable: effortOrderValue !== null,
        harness,
        harnessRevision: null,
        provider,
        evaluationPolicy: null,
        deployment: null,
        servingEndpoint: null,
        timingScope: 'Reported mean seconds over scored rollout attempts; timer boundaries are unspecified.',
        pricingBasis: costBasis,
      },
      metrics: {
        cost: metric({
          value: rawNumber(row, 'mean_cost_usd'), sourceField: 'mean_cost_usd', unit: 'USD', reportedUnit: 'USD per scored attempt', statistic: 'mean',
          locator: `rows[config=${config}].mean_cost_usd`, population, sampleCount, sampleCountMissingReason, scope: 'per scored rollout attempt',
          definition: costBasis ? `Source-reported mean USD per scored attempt; cost basis: ${costBasis}.` : 'Source-reported mean USD per scored attempt; pricing/billing basis is not reported for this configuration.',
        }),
        medianCost: metric({
          value: rawNumber(row, 'median_cost_usd'), sourceField: 'median_cost_usd', unit: 'USD', reportedUnit: 'USD per scored attempt', statistic: 'median',
          locator: `rows[config=${config}].median_cost_usd`, population, sampleCount, sampleCountMissingReason, scope: 'per scored rollout attempt',
          definition: costBasis ? `Source-reported median USD per scored attempt; cost basis: ${costBasis}.` : 'Source-reported median USD per scored attempt; pricing/billing basis is not reported for this configuration.',
        }),
        outputTokens: metric({
          value: rawNumber(row, 'mean_output_tokens'), sourceField: 'mean_output_tokens', unit: 'output tokens', reportedUnit: 'output tokens per scored attempt', statistic: 'mean',
          locator: `rows[config=${config}].mean_output_tokens`, population, sampleCount, sampleCountMissingReason, scope: 'per scored rollout attempt',
          definition: 'Source-reported mean output-token count per scored rollout attempt.',
          inclusionNote: 'Whether reasoning tokens are included is not established consistently by the feed; reasoning-token fields appear on only a subset of configurations.',
        }),
        medianOutputTokens: metric({
          value: rawNumber(row, 'median_output_tokens'), sourceField: 'median_output_tokens', unit: 'output tokens', reportedUnit: 'output tokens per scored attempt', statistic: 'median',
          locator: `rows[config=${config}].median_output_tokens`, population, sampleCount, sampleCountMissingReason, scope: 'per scored rollout attempt',
          definition: 'Source-reported median output-token count per scored rollout attempt.',
          inclusionNote: 'Whether reasoning tokens are included is not established consistently by the feed.',
        }),
        time: metric({
          value: rawNumber(row, 'mean_duration_seconds'), sourceField: 'mean_duration_seconds', unit: 'seconds', reportedUnit: 'seconds per scored attempt', statistic: 'mean',
          locator: `rows[config=${config}].mean_duration_seconds`, population, sampleCount: null, sampleCountMissingReason: durationSampleCountMissingReason, scope: 'reported mean seconds per scored rollout attempt; timer boundaries unspecified',
          definition: 'Reported duration; the feed does not specify timer start/end boundaries, model/tool/retry/setup/queue inclusion, timeout handling, serving environment, or a duration-specific sample count.',
        }),
        medianTime: metric({
          value: rawNumber(row, 'median_duration_seconds'), sourceField: 'median_duration_seconds', unit: 'seconds', reportedUnit: 'seconds per scored attempt', statistic: 'median',
          locator: `rows[config=${config}].median_duration_seconds`, population, sampleCount: null, sampleCountMissingReason: durationSampleCountMissingReason, scope: 'reported median seconds per scored rollout attempt; timer boundaries unspecified',
          definition: 'Reported median duration; timer boundaries and duration-specific sample count are unspecified. This median is not used as a fallback for mean time.',
        }),
      },
      pricing: {
        asReportedCost: rawNumber(row, 'mean_cost_usd'),
        currency: 'USD' as const,
        basis: costBasis,
        repricedCost: null,
        repricingSource: null,
        repricedAt: null,
        renderedLeaderboardCost: isCostDiscrepancy ? 6.46 : null,
        renderedCostEvidence: isCostDiscrepancy ? 'Datacurve rendered All effort levels table, GPT-5.6 Sol [max] row; $6.46. Value is retained separately and not reconciled to feed mean cost.' : null,
        renderedCostSourceTitle: isCostDiscrepancy ? 'Datacurve DeepSWE leaderboard · All effort levels table' : null,
        renderedCostSourceUrl: isCostDiscrepancy ? 'https://deepswe.datacurve.ai/' : null,
        renderedCostSourceRetrievedAt: isCostDiscrepancy ? '2026-09-26' : null,
        renderedCostSourceSha256: isCostDiscrepancy ? '14436c31be1e50a0b62171e4eaa4dd0ae0ce66b1e390af89c7e6e095ad59f1f1' : null,
        reconciliationStatus: isCostDiscrepancy ? 'unresolved-discrepancy' as const : rawNumber(row, 'mean_cost_usd') === null ? 'not-reported' as const : 'feed-only' as const,
      },
      provenance: {
        sourceId: DATACURVE_SOURCE_ID,
        title: 'DeepSWE v1.1 live leaderboard JSON',
        url: DATACURVE_FEED_URL,
        retrievedAt: retrieval.retrievedAt,
        contentSha256: retrieval.contentSha256,
        evidenceLocator: `rows[config=${config}]`,
        publicationDate: feed.generated_at,
        reviewStatus: 'source-reviewed' as const,
        reviewedAt: retrieval.retrievedAt.slice(0, 10),
        reviewer: 'DeepSWE Explorer source-data review',
        independentReplication: 'not-independently-reproduced' as const,
        notes: [
          'Normalization preserves raw feed precision; UI display rounding is separate.',
          'The public artifact has no confirmed feed-specific redistribution license; only normalized result facts and attribution are retained.',
          'Feed unit statement: efficiency aggregates cover every scored rollout attempt; time boundary/sample semantics remain unspecified.',
          ...(isCostDiscrepancy ? ['Rendered leaderboard cost differs from this feed cost; unresolved and not repriced.'] : []),
        ],
      },
    }
    return ObservationSchema.parse(observation)
  })

  return {
    sourceId: DATACURVE_SOURCE_ID,
    sourceUrl: DATACURVE_FEED_URL,
    sourceGeneratedAt: feed.generated_at,
    retrieval,
    rowCount: observations.length,
    unknownOptionalFields: [...allRowKeys].filter((key) => !knownKeys.has(key)).sort(),
    observations,
  }
}

export interface ApprovedReport {
  id: string
  sourceId: string
  sourceCategory: 'organizer' | 'developer' | 'independent' | 'local'
  publisher: string
  title: string
  url: string | null
  retrievedAt: string
  sha256: string
  evidenceLocator: string
  reviewedAt: string
  publicationDate?: string | null
  model: string
  canonicalId: string | null
  score: number
  normalizedScore: number
  scoreUnit: string
  normalizationBasis?: 'percentage' | 'fraction' | 'raw-table-value'
  reportedText: string
  metric: string
  metricLabel: string
  benchmarkVersion: string | null
  taskSetRevision?: string | null
  taskCount: number | null
  taskScope: 'full' | 'subset' | 'unknown'
  tasksAttempted?: number | null
  tasksPassedAny?: number | null
  attempts?: number | null
  passedAttempts?: number | null
  scoredAttempts?: number | null
  effort: string | null
  effortOrder?: number | null
  effortOrderEvidence?: string | null
  runs: number | null
  evaluator?: string | null
  harness?: string | null
  harnessRevision?: string | null
  provider?: string | null
  evaluationPolicy?: string | null
  deployment?: string | null
  seriesId?: string | null
  seriesConnectionEvidence?: string | null
  seriesConnectable?: boolean
  population?: string | null
  excludedPolicy?: string | null
  denominator?: string | null
  denominatorCount?: number | null
  confidenceInterval?: ReportConfidenceInterval | null
  additionalResults?: ReportAdditionalResult[]
  efficiencyMissingReason?: string | null
  costMetricMissingReason?: string | null
  medianCostMissingReason?: string | null
  pricingBasis?: string | null
  asReportedCost?: number | null
  metrics?: Partial<Observation['metrics']>
  notes: string[]
}

interface ReportConfidenceInterval {
  low: number | null
  high: number | null
  confidence: number | null
  method: string | null
  passed?: number | null
  attempted?: number | null
  missingReason?: string | null
}

interface ReportAdditionalResult {
  metric: string
  metricLabel: string
  score: number
  normalizedScore: number
  scoreUnit: string
  normalizationBasis?: 'percentage' | 'fraction' | 'raw-table-value'
  reportedText: string
  denominator?: string | null
  denominatorCount?: number | null
  confidenceInterval?: ReportConfidenceInterval | null
}

function missingMetric(reason: string) {
  return {
    value: null,
    unit: 'unknown',
    statistic: 'reported' as const,
    sourceField: null,
    reportedValue: null,
    reportedUnit: null,
    scope: null,
    population: null,
    sampleCount: null,
    sampleCountMissingReason: null,
    definition: null,
    sourceLocator: null,
    missingReason: reason,
    includesReasoningTokens: null,
    inclusionNote: null,
  }
}

function reportConfidenceInterval(interval?: ReportConfidenceInterval | null, fallback = 'The source does not report a confidence interval.') {
  if (!interval) {
    return {
      low: null,
      high: null,
      confidence: null,
      method: null,
      passed: null,
      attempted: null,
      missingReason: fallback,
    }
  }
  return {
    low: interval.low,
    high: interval.high,
    confidence: interval.confidence,
    method: interval.method,
    passed: interval.passed ?? null,
    attempted: interval.attempted ?? null,
    missingReason: interval.missingReason ?? (interval.low === null || interval.high === null ? fallback : null),
  }
}

export function normalizeApprovedReports(reports: ApprovedReport[]): Observation[] {
  return reports.map((report) => {
    const scoreUnit = report.normalizationBasis === 'raw-table-value'
      ? 'normalized numeric value (raw source unit unspecified)'
      : report.normalizationBasis === 'fraction'
        ? 'fraction'
        : 'fraction (normalized from reported percentage)'
    const efficiencyMissingReason = report.efficiencyMissingReason ?? 'The source does not report a DeepSWE-specific value.'
    return ObservationSchema.parse({
    id: report.id,
    upstreamConfigurationId: null,
    model: {
      reportedName: report.model,
      canonicalId: report.canonicalId,
      snapshot: null,
      aliasEvidence: report.canonicalId ? 'Explicit source-backed alias; see data/sources/aliases.json. Evaluation series remain separate.' : null,
    },
    publisher: report.publisher,
    evaluator: report.evaluator !== undefined
      ? report.evaluator
      : report.sourceCategory === 'independent' || report.sourceCategory === 'organizer' ? report.publisher : null,
    sourceCategory: report.sourceCategory,
    benchmark: {
      name: 'DeepSWE',
      version: report.benchmarkVersion,
      scope: report.taskScope,
      taskSetRevision: report.taskSetRevision ?? null,
      taskCount: report.taskCount,
      tasksAttempted: report.tasksAttempted ?? null,
      tasksPassedAny: report.tasksPassedAny ?? null,
      attempts: report.attempts ?? null,
      passedAttempts: report.passedAttempts ?? null,
      scoredAttempts: report.scoredAttempts ?? null,
      runs: report.runs,
      excludedPolicy: report.excludedPolicy ?? null,
      population: report.population ?? null,
    },
    result: {
      metric: report.metric,
      metricLabel: report.metricLabel,
      value: report.normalizedScore,
      unit: scoreUnit,
      reportedValue: report.score,
      reportedUnit: report.scoreUnit,
      reportedText: report.reportedText,
      denominator: report.denominator ?? null,
      denominatorCount: report.denominatorCount ?? null,
      confidenceInterval: reportConfidenceInterval(report.confidenceInterval),
    },
    additionalResults: (report.additionalResults ?? []).map((result) => ({
      metric: result.metric,
      metricLabel: result.metricLabel,
      value: result.normalizedScore,
      unit: result.normalizationBasis === 'raw-table-value'
        ? 'normalized numeric value (raw source unit unspecified)'
        : result.normalizationBasis === 'fraction'
          ? 'fraction'
          : 'fraction (normalized from reported percentage)',
      reportedValue: result.score,
      reportedUnit: result.scoreUnit,
      reportedText: result.reportedText,
      denominator: result.denominator ?? null,
      denominatorCount: result.denominatorCount ?? null,
      confidenceInterval: reportConfidenceInterval(result.confidenceInterval, 'The source does not report a confidence interval for this score.'),
    })),
    effort: {
      reportedLabel: report.effort,
      rawSetting: report.effort,
      order: report.effortOrder ?? null,
      orderEvidence: report.effortOrderEvidence ?? null,
      missingReason: report.effort === null
        ? 'The source does not specify an effort setting.'
        : report.seriesConnectable
          ? null
          : 'This source reports one configuration; no connected series order is asserted.',
    },
    series: {
      id: report.seriesId ?? `report:${report.id}`,
      connectionEvidence: report.seriesConnectionEvidence ?? 'Single source-attributed report; no other compatible effort configuration from this experiment is approved.',
      connectable: report.seriesConnectable ?? false,
      harness: report.harness !== undefined ? report.harness : report.sourceCategory === 'independent' ? 'Claude Code' : null,
      harnessRevision: report.harnessRevision ?? null,
      provider: report.provider !== undefined ? report.provider : report.sourceCategory === 'developer' ? report.publisher : null,
      evaluationPolicy: report.evaluationPolicy ?? null,
      deployment: report.deployment ?? null,
      servingEndpoint: null,
      timingScope: null,
      pricingBasis: report.pricingBasis ?? null,
    },
    metrics: {
      cost: report.metrics?.cost ?? missingMetric(report.costMetricMissingReason ?? `${efficiencyMissingReason} Mean task cost is not inferred.`),
      medianCost: report.metrics?.medianCost ?? missingMetric(report.medianCostMissingReason ?? `${efficiencyMissingReason} Median task cost is not inferred.`),
      outputTokens: report.metrics?.outputTokens ?? missingMetric(`${efficiencyMissingReason} Output-token counts are not inferred.`),
      medianOutputTokens: report.metrics?.medianOutputTokens ?? missingMetric(`${efficiencyMissingReason} Median output-token counts are not inferred.`),
      time: report.metrics?.time ?? missingMetric(`${efficiencyMissingReason} Task duration is not inferred.`),
      medianTime: report.metrics?.medianTime ?? missingMetric(`${efficiencyMissingReason} Median task duration is not inferred.`),
    },
    pricing: {
      asReportedCost: report.asReportedCost ?? null,
      currency: 'USD',
      basis: report.pricingBasis ?? null,
      repricedCost: null,
      repricingSource: null,
      repricedAt: null,
      renderedLeaderboardCost: null,
      renderedCostEvidence: null,
      renderedCostSourceTitle: null,
      renderedCostSourceUrl: null,
      renderedCostSourceRetrievedAt: null,
      renderedCostSourceSha256: null,
      reconciliationStatus: report.asReportedCost === null || report.asReportedCost === undefined ? 'not-reported' : 'single-source-reported',
    },
    provenance: {
      sourceId: report.sourceId,
      title: report.title,
      url: report.url,
      retrievedAt: report.retrievedAt,
      contentSha256: report.sha256,
      evidenceLocator: report.evidenceLocator,
      publicationDate: report.publicationDate ?? null,
      reviewStatus: 'source-reviewed',
      reviewedAt: report.reviewedAt,
      reviewer: 'DeepSWE Explorer source-research review; transcription only',
      independentReplication: 'not-independently-reproduced',
      notes: report.notes,
    },
  })
  })
}

export function currentEffortMap(value: unknown): EffortOrderFile {
  if (typeof value !== 'object' || value === null || !('models' in value)) throw new Error('Effort-order mapping is invalid.')
  const file = value as EffortOrderFile
  if (!file.models || typeof file.models !== 'object') throw new Error('Effort-order model map is invalid.')
  if (!file.modelEvidence || typeof file.modelEvidence !== 'object') throw new Error('Per-model effort-order evidence is missing.')
  for (const [model, levels] of Object.entries(file.models)) {
    if (!file.modelEvidence[model] || levels.some((level) => typeof level !== 'string')) throw new Error(`Effort-order evidence is incomplete for ${model}.`)
  }
  return file
}

export function toCandidateFile(observations: Observation[], metadata: Omit<NormalizedOfficialFeed, 'observations'>) {
  return { ...metadata, observations }
}

export type { Candidate }
