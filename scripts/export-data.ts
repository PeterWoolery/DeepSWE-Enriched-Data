import { CandidateQueueSchema, DatasetSchema } from '../src/lib/schema.ts'
import { normalizeApprovedReports, type ApprovedReport } from '../src/lib/normalize.ts'
import { buildRevisionEvents, mergeRevisionEvents, type RevisionEvent } from '../src/lib/revisions.ts'
import { readJson, sha256, writeJsonAtomic } from './lib.ts'

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const text = typeof value === 'string' && /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${text.replaceAll('"', '""')}"`
}

async function main() {
  let dataset = DatasetSchema.parse(await readJson<unknown>('data/approved/dataset.json'))
  if (process.argv.includes('--sync-supplemental')) {
    const reports = await readJson<{ reports: ApprovedReport[] }>('data/sources/approved-reports.json')
    const approved = normalizeApprovedReports(reports.reports)
    const existing = new Set(dataset.observations.map((row) => row.id))
    const added = approved.filter((row) => !existing.has(row.id))
    if (added.length) {
      const now = new Date().toISOString()
      const revisionId = `dsv1.1-${sha256(`${dataset.revisionId}:${JSON.stringify(added)}`).slice(0, 16)}`
      const revisions = await readJson<{ schemaVersion: number; events: RevisionEvent[] }>('data/approved/revisions.json')
      const events = mergeRevisionEvents(revisions.events, buildRevisionEvents([], added, sha256(JSON.stringify(added)), now))
      dataset = DatasetSchema.parse({ ...dataset, observations: [...dataset.observations, ...added], revisionId, lastDataChangeAt: now })
      await writeJsonAtomic('data/approved/revisions.json', { schemaVersion: 1, events })
    }
    await writeJsonAtomic('data/approved/dataset.json', dataset)
  }
  const candidateQueue = CandidateQueueSchema.parse(await readJson<unknown>('data/candidates/queue.json'))
  const registry = await readJson<unknown>('data/sources/registry.json')
  const aliases = await readJson<unknown>('data/sources/aliases.json')
  const headers = [
    'id', 'upstream_configuration_id', 'model_reported', 'canonical_model_id', 'publisher', 'evaluator', 'source_category',
    'benchmark_version', 'task_scope', 'task_count', 'tasks_attempted', 'tasks_passed_any', 'attempts', 'passed_attempts',
    'scored_attempts', 'benchmark_runs', 'score_metric', 'score_metric_label', 'score_value_normalized', 'score_normalized_unit', 'score_reported_value', 'score_reported_unit',
    'score_reported_text', 'denominator', 'denominator_count', 'pass_at_4_fraction', 'pass_at_4_denominator_count', 'ci_low', 'ci_high', 'ci_confidence', 'ci_method', 'effort_label',
    'effort_order', 'harness', 'provider', 'mean_cost_usd_per_scored_attempt', 'median_cost_usd_per_scored_attempt', 'source_reported_cost_usd',
    'approx_source_chart_cost_usd_per_task', 'approx_cost_reading_low_usd', 'approx_cost_reading_high_usd', 'approx_score_reading_low_percent', 'approx_score_reading_high_percent', 'approx_extraction_method', 'approx_bounds_note', 'approx_image_sha256',
    'mean_output_tokens_per_scored_attempt', 'median_output_tokens_per_scored_attempt', 'reported_mean_seconds_per_scored_attempt',
    'reported_median_seconds_per_scored_attempt', 'time_scope', 'cost_basis', 'rendered_leaderboard_cost_usd', 'rendered_cost_source_title',
    'rendered_cost_source_url', 'rendered_cost_source_retrieved_at', 'rendered_cost_source_sha256', 'cost_reconciliation_status', 'source_title', 'source_url', 'evidence_locator',
    'source_retrieved_at', 'source_sha256', 'review_status', 'independent_replication',
  ]
  const rows = dataset.observations.map((observation) => [
    observation.id,
    observation.upstreamConfigurationId,
    observation.model.reportedName,
    observation.model.canonicalId,
    observation.publisher,
    observation.evaluator,
    observation.sourceCategory,
    observation.benchmark.version,
    observation.benchmark.scope,
    observation.benchmark.taskCount,
    observation.benchmark.tasksAttempted,
    observation.benchmark.tasksPassedAny,
    observation.benchmark.attempts,
    observation.benchmark.passedAttempts,
    observation.benchmark.scoredAttempts,
    observation.benchmark.runs,
    observation.result.metric,
    observation.result.metricLabel,
    observation.result.value,
    observation.result.unit,
    observation.result.reportedValue,
    observation.result.reportedUnit,
    observation.result.reportedText,
    observation.result.denominator,
    observation.result.denominatorCount,
    observation.additionalResults.find((result) => result.metric === 'pass_at_4')?.value ?? null,
    observation.additionalResults.find((result) => result.metric === 'pass_at_4')?.denominatorCount ?? null,
    observation.result.confidenceInterval.low,
    observation.result.confidenceInterval.high,
    observation.result.confidenceInterval.confidence,
    observation.result.confidenceInterval.method,
    observation.effort.reportedLabel,
    observation.effort.order,
    observation.series.harness,
    observation.series.provider,
    observation.metrics.cost.statistic === 'mean' ? observation.metrics.cost.value : null,
    observation.metrics.medianCost.value,
    observation.pricing.asReportedCost,
    observation.approximation ? observation.metrics.cost.value : null,
    observation.approximation?.costBoundsUsd[0] ?? null,
    observation.approximation?.costBoundsUsd[1] ?? null,
    observation.approximation?.scoreBoundsPercent[0] ?? null,
    observation.approximation?.scoreBoundsPercent[1] ?? null,
    observation.approximation?.method ?? null,
    observation.approximation?.boundsNote ?? null,
    observation.approximation?.imageSha256 ?? null,
    observation.metrics.outputTokens.value,
    observation.metrics.medianOutputTokens.value,
    observation.metrics.time.value,
    observation.metrics.medianTime.value,
    observation.metrics.time.scope,
    observation.pricing.basis,
    observation.pricing.renderedLeaderboardCost,
    observation.pricing.renderedCostSourceTitle,
    observation.pricing.renderedCostSourceUrl,
    observation.pricing.renderedCostSourceRetrievedAt,
    observation.pricing.renderedCostSourceSha256,
    observation.pricing.reconciliationStatus,
    observation.provenance.title,
    observation.provenance.url,
    observation.provenance.evidenceLocator,
    observation.provenance.retrievedAt,
    observation.provenance.contentSha256,
    observation.provenance.reviewStatus,
    observation.provenance.independentReplication,
  ])
  const metadata = [
    `# dataset_revision=${dataset.revisionId}`,
    `# data_last_changed=${dataset.lastDataChangeAt}`,
    `# last_successful_source_check=${dataset.lastSuccessfulCheckAt}`,
    `# last_deployment=${process.env.VITE_DEPLOYED_AT ?? 'not recorded for this build'}`,
    `# source=${dataset.sourceRetrieval.url}`,
    `# source_sha256=${dataset.sourceRetrieval.contentSha256}`,
    '# data note: metric definitions, denominators, timing scope, and source constraints are in docs/methodology.md',
  ]
  const csv = [...metadata, headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n') + '\n'
  await writeJsonAtomic('public/data/observations.json', {
    exportMetadata: {
      datasetRevision: dataset.revisionId,
      lastDataChangeAt: dataset.lastDataChangeAt,
      lastSuccessfulSourceCheckAt: dataset.lastSuccessfulCheckAt,
      lastDeploymentAt: process.env.VITE_DEPLOYED_AT ?? null,
      sourceRetrieval: dataset.sourceRetrieval,
      observationCount: dataset.observations.length,
      filters: { view: 'all-approved', benchmarkVersion: 'all', sourceCategory: 'all', xMetric: 'all', scoreMetric: 'all', strict: false, effortMode: 'all' },
      candidatesIncluded: false,
      attribution: 'Unofficial community explorer; each observation retains its source publisher, URL, evidence locator, and retrieval hash.',
      dataNotice: 'Normalized result facts only; no benchmark tasks, solutions, trajectories, source pages, or PDFs are included.',
    },
    ...dataset,
  })
  await writeJsonAtomic('public/data/candidates.json', candidateQueue)
  await writeJsonAtomic('public/data/source-registry.json', registry)
  await writeJsonAtomic('public/data/aliases.json', aliases)
  await writeJsonAtomic('public/data/metadata.json', {
    schemaVersion: dataset.schemaVersion,
    revisionId: dataset.revisionId,
    lastDataChangeAt: dataset.lastDataChangeAt,
    lastSuccessfulCheckAt: dataset.lastSuccessfulCheckAt,
    lastDeploymentAt: process.env.VITE_DEPLOYED_AT ?? null,
    sourceStatus: dataset.sourceStatus,
    sourceNote: dataset.sourceNote,
    sourceRetrieval: dataset.sourceRetrieval,
    approvedObservationCount: dataset.observations.length,
    officialConfigurationCount: dataset.sourceRetrieval.rowCount,
  })
  const { writeFile } = await import('node:fs/promises')
  const { projectPath } = await import('./lib.ts')
  await writeFile(projectPath('public/data/observations.csv'), csv, 'utf8')
  console.log(`Generated same-origin JSON/CSV exports for revision ${dataset.revisionId}; ${dataset.observations.length} approved observations, no candidates or fixtures in the leaderboard export.`)
}

main().catch((error: unknown) => {
  console.error(`Data export failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
