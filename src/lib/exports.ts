import type { Dataset, Observation } from './schema'
import { modelKey, scoreResult, type ScoreMetric, type Statistic, type XMetric } from './comparison'
import { usageScenarioForObservation } from './usage-scenarios'

export interface ExportFilters {
  view: string
  search: string
  selectedModels: string[]
  sources: string[]
  version: string
  harness: string
  publisher: string
  lastDeploymentAt: string | null
  strict: boolean
  includeUsageScenarios?: boolean
  effortMode: string
  xMetric: XMetric
  statistic: Statistic
  scoreMetric: ScoreMetric
}

function csv(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const text = typeof value === 'string' && /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${text.replaceAll('"', '""')}"`
}

export function filteredJsonExport(dataset: Dataset, observations: Observation[], filters: ExportFilters, exportedAt = new Date().toISOString()) {
  return {
    exportMetadata: {
      exportedAt,
      datasetRevision: dataset.revisionId,
      sourceRetrieval: dataset.sourceRetrieval,
      filters,
      observationCount: observations.length,
      attribution: 'Unofficial community explorer. Each observation retains its source URL, publisher, evidence locator, and retrieval hash.',
      dataNotice: 'Normalized result facts only; no benchmark task bodies, solutions, trajectories, or source documents are included.',
    },
    observations,
  }
}

function scenarioExportRows(observations: Observation[]) {
  return observations.flatMap((observation) => {
    const scenario = usageScenarioForObservation(observation)
    return scenario ? [{ observation, scenario }] : []
  })
}

function scenarioExportRecord(observation: Observation, scenario: NonNullable<ReturnType<typeof usageScenarioForObservation>>) {
  return {
    recordType: 'estimated_usage_scenario' as const,
    scenarioId: scenario.id,
    model: scenario.model,
    targetObservationId: observation.id,
    reportedModel: observation.model.reportedName,
    publisher: observation.publisher,
    sourceCategory: observation.sourceCategory,
    benchmarkVersion: observation.benchmark.version,
    effort: observation.effort.reportedLabel,
    harness: observation.series.harness,
    sourceScore: {
      metric: observation.result.metric,
      metricLabel: observation.result.metricLabel,
      reportedText: observation.result.reportedText,
      reportedUnit: observation.result.reportedUnit,
    },
    measurement: {
      meanCostUsd: observation.metrics.cost.value,
      medianCostUsd: observation.metrics.medianCost.value,
      meanOutputTokens: observation.metrics.outputTokens.value,
      medianOutputTokens: observation.metrics.medianOutputTokens.value,
      meanReportedSeconds: observation.metrics.time.value,
      medianReportedSeconds: observation.metrics.medianTime.value,
      sourceReportedCostUsd: observation.pricing.asReportedCost,
    },
    scenario: {
      statistic: 'mean-only',
      meanCostUsdPerScoredAttempt: scenario.costUsdPerScoredAttempt,
      costSensitivityUsdPerScoredAttempt: scenario.costSensitivityRange,
      meanOutputTokensPerScoredAttempt: scenario.outputTokensPerScoredAttempt,
      outputTokenSensitivityPerScoredAttempt: scenario.outputTokenSensitivityRange,
      meanReportedSecondsPerScoredAttempt: scenario.timeSecondsPerScoredAttempt,
      timeSensitivitySecondsPerScoredAttempt: scenario.timeSensitivityRange,
      aaCodingSuiteCostUsdPerTask: scenario.aaCodingSuiteCostUsdPerTask,
      aaCodingSuiteTimeSecondsPerTask: scenario.aaCodingSuiteTimeSecondsPerTask,
      aaCodingSuiteMixedTokensPerTask: scenario.aaCodingSuiteMixedTokensPerTask,
      sensitivityNote: scenario.sensitivityNote,
      confidence: scenario.confidence,
      confidenceNote: scenario.confidenceNote,
      outputCalibrationMethod: scenario.outputCalibrationMethod,
      outputCalibrationDescription: scenario.outputCalibrationDescription,
      outputCalibrationRows: scenario.outputCalibrationRows,
      outputLeaveOneOutMapePercent: scenario.outputLeaveOneOutMapePercent,
      costCalibrationMethod: scenario.costCalibrationMethod,
      costCalibrationDescription: scenario.costCalibrationDescription,
      costCalibrationRows: scenario.costCalibrationRows,
      costLeaveOneOutMapePercent: scenario.costLeaveOneOutMapePercent,
      timeCalibrationMethod: scenario.timeCalibrationMethod,
      timeCalibrationDescription: scenario.timeCalibrationDescription,
      timeCalibrationRows: scenario.timeCalibrationRows,
      timeLeaveOneOutMapePercent: scenario.timeLeaveOneOutMapePercent,
      directUsageReference: scenario.directUsageReference,
      sources: scenario.sources,
    },
    scoreSourceEvidence: {
      title: observation.provenance.title,
      url: observation.provenance.url,
      retrievedAt: observation.provenance.retrievedAt,
      sha256: observation.provenance.contentSha256,
      evidenceLocator: observation.provenance.evidenceLocator,
    },
  }
}

/** Separate opt-in export: observed metrics remain under measurement; estimates are nested and labeled as scenarios. */
export function usageScenarioJsonExport(dataset: Dataset, observations: Observation[], filters: ExportFilters, scope: 'filtered' | 'all', exportedAt = new Date().toISOString()) {
  const rows = scenarioExportRows(observations)
  return {
    exportMetadata: {
      exportType: 'estimated-usage-scenarios-only',
      scope,
      exportedAt,
      datasetRevision: dataset.revisionId,
      filters: scope === 'filtered' ? filters : null,
      scenarioCount: rows.length,
      observationsAreNotModified: true,
      attribution: 'Estimated cross-platform usage scenarios are separate from approved DeepSWE observations and must not be interpreted as measurements.',
    },
    scenarios: rows.map(({ observation, scenario }) => scenarioExportRecord(observation, scenario)),
  }
}

/** Separate opt-in CSV export with distinct measured and scenario columns. */
export function usageScenarioCsvExport(dataset: Dataset, observations: Observation[], filters: ExportFilters, scope: 'filtered' | 'all', exportedAt = new Date().toISOString()): string {
  const meta = [
    '# export_type=estimated-usage-scenarios-only',
    `# scope=${scope}`,
    `# dataset_revision=${dataset.revisionId}`,
    `# exported_at=${exportedAt}`,
    ...(scope === 'filtered' ? [`# filters=${JSON.stringify(filters)}`] : []),
    '# These rows are scenarios, not measurements. Measured columns are source-reported and are never replaced by scenario values.',
  ]
  const headers = [
    'record_type', 'scenario_id', 'model_scenario_label', 'target_observation_id', 'model_reported', 'publisher', 'source_category', 'benchmark_version', 'effort_label', 'harness',
    'source_score_metric', 'source_score_metric_label', 'source_score_reported_text',
    'measurement_mean_cost_usd', 'measurement_median_cost_usd', 'measurement_mean_output_tokens', 'measurement_median_output_tokens', 'measurement_mean_reported_seconds', 'measurement_median_reported_seconds', 'source_reported_cost_usd',
    'scenario_mean_cost_usd_per_attempt', 'scenario_cost_sensitivity_low_usd', 'scenario_cost_sensitivity_high_usd',
    'scenario_mean_output_tokens_per_attempt', 'scenario_output_sensitivity_low_tokens', 'scenario_output_sensitivity_high_tokens',
    'scenario_mean_reported_seconds_per_attempt', 'scenario_time_sensitivity_low_seconds', 'scenario_time_sensitivity_high_seconds',
    'aa_coding_suite_cost_usd_per_task', 'aa_coding_suite_time_seconds_per_task', 'aa_coding_suite_mixed_tokens_per_task', 'scenario_statistic', 'scenario_confidence_quality', 'scenario_confidence_note',
    'cost_calibration_method', 'cost_calibration_description', 'cost_leave_one_out_mape_percent', 'output_calibration_method', 'output_calibration_description', 'output_leave_one_out_mape_percent',
    'time_calibration_method', 'time_calibration_description', 'time_leave_one_out_mape_percent',
    'output_calibration_rows_json', 'cost_calibration_rows_json', 'time_calibration_rows_json', 'direct_usage_reference_json',
    'sensitivity_note', 'score_source_title', 'score_source_url', 'score_source_retrieved_at', 'score_source_sha256', 'score_evidence_locator', 'scenario_sources_json',
  ]
  const rows = scenarioExportRows(observations).map(({ observation, scenario }) => {
    const costRange = scenario.costSensitivityRange
    const outputRange = scenario.outputTokenSensitivityRange
    const timeRange = scenario.timeSensitivityRange
    return [
      'estimated_usage_scenario', scenario.id, scenario.model, observation.id, observation.model.reportedName, observation.publisher, observation.sourceCategory, observation.benchmark.version,
      observation.effort.reportedLabel, observation.series.harness, observation.result.metric, observation.result.metricLabel, observation.result.reportedText,
      observation.metrics.cost.value, observation.metrics.medianCost.value, observation.metrics.outputTokens.value, observation.metrics.medianOutputTokens.value,
      observation.metrics.time.value, observation.metrics.medianTime.value, observation.pricing.asReportedCost,
      scenario.costUsdPerScoredAttempt, costRange?.[0] ?? null, costRange?.[1] ?? null,
      scenario.outputTokensPerScoredAttempt, outputRange?.[0] ?? null, outputRange?.[1] ?? null,
      scenario.timeSecondsPerScoredAttempt, timeRange?.[0] ?? null, timeRange?.[1] ?? null,
      scenario.aaCodingSuiteCostUsdPerTask, scenario.aaCodingSuiteTimeSecondsPerTask, scenario.aaCodingSuiteMixedTokensPerTask, 'mean-only', scenario.confidence, scenario.confidenceNote,
      scenario.costCalibrationMethod, scenario.costCalibrationDescription, scenario.costLeaveOneOutMapePercent,
      scenario.outputCalibrationMethod, scenario.outputCalibrationDescription, scenario.outputLeaveOneOutMapePercent,
      scenario.timeCalibrationMethod, scenario.timeCalibrationDescription, scenario.timeLeaveOneOutMapePercent,
      JSON.stringify(scenario.outputCalibrationRows), JSON.stringify(scenario.costCalibrationRows), JSON.stringify(scenario.timeCalibrationRows), JSON.stringify(scenario.directUsageReference),
      scenario.sensitivityNote, observation.provenance.title, observation.provenance.url, observation.provenance.retrievedAt,
      observation.provenance.contentSha256, observation.provenance.evidenceLocator, JSON.stringify(scenario.sources),
    ]
  })
  return `${meta.join('\n')}\n${headers.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}\n`
}

export function filteredCsvExport(dataset: Dataset, observations: Observation[], filters: ExportFilters, exportedAt = new Date().toISOString()): string {
  const meta = [
    `# dataset_revision=${dataset.revisionId}`,
    `# exported_at=${exportedAt}`,
    `# last_deployment=${filters.lastDeploymentAt ?? 'not recorded for this build'}`,
    `# x_metric=${filters.xMetric}`,
    `# statistic=${filters.statistic}`,
    `# score_metric=${filters.scoreMetric}`,
    `# filters=${JSON.stringify(filters)}`,
    `# source=${dataset.sourceRetrieval.url}`,
    '# attribution and scope details are retained in the source columns and docs/methodology.md',
  ]
  const headers = [
    'id', 'model_reported', 'canonical_model_id', 'publisher', 'source_category', 'benchmark_version', 'task_scope', 'task_count',
    'selected_score_metric', 'selected_score_metric_label', 'selected_score_normalized_value', 'selected_score_normalized_unit', 'selected_score_reported_value', 'selected_score_reported_unit',
    'selected_score_reported_text', 'selected_score_denominator', 'selected_score_denominator_count', 'primary_score_metric', 'primary_score_normalized_value', 'primary_score_normalized_unit', 'benchmark_runs', 'additional_results_json',
    'effort_label', 'effort_order', 'harness', 'x_metric', 'x_statistic', 'x_value', 'x_unit', 'mean_cost_usd', 'median_cost_usd',
    'mean_output_tokens', 'median_output_tokens', 'reported_mean_seconds', 'reported_median_seconds', 'source_reported_cost_usd', 'source_reported_cost_basis',
    'rendered_leaderboard_cost_usd', 'rendered_cost_source_url', 'rendered_cost_source_sha256', 'cost_reconciliation_status', 'source_title', 'source_url',
    'evidence_locator', 'source_retrieved_at', 'source_sha256', 'model_filter_key',
  ]
  const rows = observations.map((observation) => {
    const selectedScore = scoreResult(observation, filters.scoreMetric)
    return [
    observation.id,
    observation.model.reportedName,
    observation.model.canonicalId,
    observation.publisher,
    observation.sourceCategory,
    observation.benchmark.version,
    observation.benchmark.scope,
    observation.benchmark.taskCount,
    selectedScore?.metric ?? filters.scoreMetric,
    selectedScore?.metricLabel ?? 'Not reported for this observation',
    selectedScore?.value ?? null,
    selectedScore?.unit ?? null,
    selectedScore?.reportedValue ?? null,
    selectedScore?.reportedUnit ?? null,
    selectedScore?.reportedText ?? null,
    selectedScore?.denominator ?? null,
    selectedScore?.denominatorCount ?? null,
    observation.result.metric,
    observation.result.value,
    observation.result.unit,
    observation.benchmark.runs,
    JSON.stringify(observation.additionalResults),
    observation.effort.reportedLabel,
    observation.effort.order,
    observation.series.harness,
    filters.xMetric,
    filters.statistic,
    filters.xMetric === 'cost'
      ? filters.statistic === 'mean' ? observation.metrics.cost.value : observation.metrics.medianCost.value
      : filters.xMetric === 'outputTokens'
        ? filters.statistic === 'mean' ? observation.metrics.outputTokens.value : observation.metrics.medianOutputTokens.value
        : filters.statistic === 'mean' ? observation.metrics.time.value : observation.metrics.medianTime.value,
    filters.xMetric === 'cost' ? 'USD/scored attempt' : filters.xMetric === 'outputTokens' ? 'output tokens/scored attempt' : 'seconds/scored attempt; boundaries unspecified',
    observation.metrics.cost.value,
    observation.metrics.medianCost.value,
    observation.metrics.outputTokens.value,
    observation.metrics.medianOutputTokens.value,
    observation.metrics.time.value,
    observation.metrics.medianTime.value,
    observation.pricing.asReportedCost,
    observation.pricing.basis,
    observation.pricing.renderedLeaderboardCost,
    observation.pricing.renderedCostSourceUrl,
    observation.pricing.renderedCostSourceSha256,
    observation.pricing.reconciliationStatus,
    observation.provenance.title,
    observation.provenance.url,
    observation.provenance.evidenceLocator,
    observation.provenance.retrievedAt,
    observation.provenance.contentSha256,
    modelKey(observation),
  ]
  })
  return `${meta.join('\n')}\n${headers.map(csv).join(',')}\n${rows.map((row) => row.map(csv).join(',')).join('\n')}\n`
}

export function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 0)
}
