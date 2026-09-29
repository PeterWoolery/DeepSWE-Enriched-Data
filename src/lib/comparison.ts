import type { Observation } from './schema'

export type XMetric = 'cost' | 'outputTokens' | 'time'
export type Statistic = 'mean' | 'median'
export type ScoreMetric = 'pass_at_1' | 'pass_at_4' | 'reported_score_unspecified' | 'task_pass_rate'
export type SourceCategory = Observation['sourceCategory']

export const xMetricLabels: Record<XMetric, { label: string; mean: string; median: string; axis: string; shortUnit: string }> = {
  cost: { label: 'Cost per task', mean: 'Mean cost per task', median: 'Median cost per task', axis: 'USD per scored rollout attempt; source-chart costs have unspecified task basis (see point)', shortUnit: 'USD' },
  outputTokens: { label: 'Output tokens per task', mean: 'Mean output tokens per task', median: 'Median output tokens per task', axis: 'output tokens per source-defined attempt · see point scope', shortUnit: 'tokens' },
  time: { label: 'Time per task', mean: 'Reported mean time per task', median: 'Reported median time per task', axis: 'reported seconds per scored rollout attempt · timer boundaries unspecified', shortUnit: 'seconds' },
}

export const scoreMetricLabels: Record<ScoreMetric, string> = {
  pass_at_1: 'pass@1 · scored attempt pass rate',
  pass_at_4: 'pass@4 · unique task pass rate',
  reported_score_unspecified: 'reported score · metric or unit unspecified',
  task_pass_rate: 'task pass rate · tasks passing both test suites',
}

export function metricObservation(observation: Observation, metric: XMetric, statistic: Statistic) {
  if (metric === 'cost') return statistic === 'mean' ? observation.metrics.cost : observation.metrics.medianCost
  if (metric === 'outputTokens') return statistic === 'mean' ? observation.metrics.outputTokens : observation.metrics.medianOutputTokens
  return statistic === 'mean' ? observation.metrics.time : observation.metrics.medianTime
}

export function scoreResult(observation: Observation, metric: ScoreMetric) {
  if (observation.result.metric === metric) return observation.result
  return observation.additionalResults.find((result) => result.metric === metric) ?? null
}

/** The score shown in the evidence table: selected metric when present, otherwise the source's primary result. */
export function displayScoreResult(observation: Observation, metric: ScoreMetric) {
  return scoreResult(observation, metric) ?? observation.result
}

export interface DisplayableScore {
  value: number
  reportedValue: number
  reportedUnit: string
  reportedText: string
}

export function hasPercentageScoreScale(score: DisplayableScore): boolean {
  return score.reportedUnit === '%' || score.reportedUnit === 'fraction'
}

/** Format from the source's unit and wording; normalized values are not presumed to be percentages. */
export function displayScoreValue(score: DisplayableScore): string {
  if (score.reportedUnit === '%') {
    const sourceNumber = score.reportedText.match(/^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))/)?.[1]
    return `${score.reportedText.trim().startsWith('≈') ? '≈' : ''}${sourceNumber ?? String(score.reportedValue)}%`
  }
  if (score.reportedUnit === 'fraction') return `${(score.value * 100).toFixed(1)}%`
  return score.reportedText
}

export function strictExclusionReason(
  observation: Observation,
  metric: XMetric,
  statistic: Statistic = 'mean',
  scoreMetric: ScoreMetric = observation.result.metric as ScoreMetric,
): string | null {
  const score = scoreResult(observation, scoreMetric)
  if (!score) return 'selected score metric is not reported'
  if (!observation.benchmark.version) return 'benchmark version is unknown'
  if (observation.approximation) return 'screenshot-derived coordinates and protocol are approximate or unknown'
  if (observation.benchmark.scope === 'unknown' || observation.benchmark.taskCount === null) return 'task scope or task count is unknown'
  if (!observation.benchmark.taskSetRevision) return 'task-set revision is unknown'
  if (!observation.benchmark.population) return 'measurement population is unknown'
  if (!observation.benchmark.excludedPolicy) return 'attempt exclusion policy is unknown'
  if (!score.metric || !score.metricLabel || !score.denominator) return 'selected score metric or denominator is unknown'
  if (!observation.evaluator) return 'evaluator is unknown'
  if (!observation.series.harness) return 'harness is unknown'
  if (!observation.series.harnessRevision) return 'harness revision is unknown'
  if (!observation.series.evaluationPolicy) return 'evaluation / timeout policy is unknown'
  if (!observation.series.provider) return 'serving provider is unknown'
  if (!observation.series.deployment && !observation.series.servingEndpoint) return 'deployment / serving configuration is unknown'
  const selectedMetric = metricObservation(observation, metric, statistic)
  if (!selectedMetric.definition || !selectedMetric.scope || !selectedMetric.population) return `${metric} measurement scope is unknown`
  if (metric === 'cost' && (!observation.series.pricingBasis || !selectedMetric.unit)) return 'cost basis is unknown'
  if (metric === 'outputTokens' && observation.metrics.outputTokens.includesReasoningTokens === null) return 'reasoning-token inclusion is unknown'
  if (metric === 'time' && (!observation.series.timingScope || /unspecified/i.test(observation.series.timingScope))) return 'timing boundaries are unspecified'
  if (metric === 'time' && selectedMetric.sampleCount === null) return 'duration-specific sample count is unknown'
  return null
}

export interface StrictProtocolGroup {
  key: string
  label: string
  observations: Observation[]
}

export function strictProtocolGroups(
  observations: Observation[],
  metric: XMetric,
  statistic: Statistic,
  scoreMetric: ScoreMetric,
): StrictProtocolGroup[] {
  const groups = new Map<string, Observation[]>()
  for (const observation of observations) {
    if (strictExclusionReason(observation, metric, statistic, scoreMetric)) continue
    const score = scoreResult(observation, scoreMetric)!
    const x = metricObservation(observation, metric, statistic)
    const key = JSON.stringify({
      evaluator: observation.evaluator,
      sourceCategory: observation.sourceCategory,
      benchmark: {
        version: observation.benchmark.version,
        scope: observation.benchmark.scope,
        taskSetRevision: observation.benchmark.taskSetRevision,
        taskCount: observation.benchmark.taskCount,
        population: observation.benchmark.population,
        excludedPolicy: observation.benchmark.excludedPolicy,
      },
      score: { metric: score.metric, label: score.metricLabel, unit: score.unit, denominator: score.denominator },
      protocol: {
        provider: observation.series.provider,
        harness: observation.series.harness,
        harnessRevision: observation.series.harnessRevision,
        evaluationPolicy: observation.series.evaluationPolicy,
        deployment: observation.series.deployment,
        servingEndpoint: observation.series.servingEndpoint,
      },
      xMetric: {
        metric,
        statistic,
        unit: x.unit,
        scope: x.scope,
        population: x.population,
        definition: x.definition,
        pricingBasis: metric === 'cost' ? observation.series.pricingBasis : null,
        reasoningTokensIncluded: metric === 'outputTokens' ? x.includesReasoningTokens : null,
        timingScope: metric === 'time' ? observation.series.timingScope : null,
        sampleCount: metric === 'time' ? x.sampleCount : null,
      },
    })
    const members = groups.get(key) ?? []
    members.push(observation)
    groups.set(key, members)
  }
  return [...groups.entries()].map(([key, members]) => {
    const first = members[0]!
    const score = scoreResult(first, scoreMetric)!
    const suffix = metric === 'cost' ? `cost basis ${first.series.pricingBasis}` : metric === 'time' ? first.series.timingScope! : 'reasoning-token scope known'
    return {
      key,
      label: `${first.evaluator} · ${first.benchmark.version} ${first.benchmark.scope} (${first.benchmark.taskCount} tasks) · ${first.series.harness} ${first.series.harnessRevision} · ${score.metricLabel} · ${suffix} · ${members.length} observations`,
      observations: members,
    }
  })
}

export function modelKey(observation: Observation): string {
  return observation.model.canonicalId ?? observation.model.reportedName
}

function normalizedChartModelIdentity(observation: Observation): string {
  const name = observation.model.reportedName
    .replace(/\s*\((?:low|medium|high|xhigh|max)\)\s*$/i, '')
    .replace(/^claude[\s._-]+(?=(?:opus|sonnet|haiku|fable)\b)/i, '')
  return name.toLowerCase()
    .replace(/(\d)\.(\d)/g, '$1-$2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function chartModelIdentityMatches(left: Observation, right: Observation): boolean {
  if (left.model.canonicalId && right.model.canonicalId && left.model.canonicalId !== right.model.canonicalId) return false
  if (left.model.snapshot && right.model.snapshot && left.model.snapshot !== right.model.snapshot) return false
  return normalizedChartModelIdentity(left) === normalizedChartModelIdentity(right)
}

function chartBenchmarkContextMatches(left: Observation, right: Observation): boolean {
  if (left.benchmark.version && right.benchmark.version && left.benchmark.version !== right.benchmark.version) return false
  if (left.benchmark.scope !== 'unknown' && right.benchmark.scope !== 'unknown' && left.benchmark.scope !== right.benchmark.scope) return false
  if (left.benchmark.taskCount !== null && right.benchmark.taskCount !== null && left.benchmark.taskCount !== right.benchmark.taskCount) return false
  if (left.benchmark.taskSetRevision && right.benchmark.taskSetRevision && left.benchmark.taskSetRevision !== right.benchmark.taskSetRevision) return false
  return true
}

const recognizedScoreMetrics = new Set(['pass_at_1', 'pass_at_4', 'task_pass_rate'])

function chartScoreMetrics(observation: Observation): Set<string> {
  return new Set([observation.result, ...observation.additionalResults]
    .map((result) => result.metric)
    .filter((metric) => recognizedScoreMetrics.has(metric)))
}

function chartScoreMetricCompatible(left: Observation, right: Observation): boolean {
  const leftMetrics = chartScoreMetrics(left)
  const rightMetrics = chartScoreMetrics(right)
  if (!leftMetrics.size || !rightMetrics.size) return true
  return [...leftMetrics].some((metric) => rightMetrics.has(metric))
}

/**
 * Non-Datacurve reports with an applicable live Datacurve result stay in the
 * evidence table and exports, but do not compete for a second chart mark.
 * Effort and harness are intentionally not identity keys; known model,
 * snapshot, version, task-scope, or score-metric conflicts remain separate.
 */
export function datacurveChartPrecedence(observations: Observation[], datacurveSourceId: string): Map<string, Observation[]> {
  const datacurveRows = observations.filter((observation) =>
    observation.sourceCategory === 'organizer' && observation.publisher === 'Datacurve' && observation.provenance.sourceId === datacurveSourceId,
  )
  const suppressed = new Map<string, Observation[]>()
  for (const observation of observations) {
    if (observation.provenance.sourceId === datacurveSourceId
      || observation.sourceCategory === 'organizer' && observation.publisher === 'Datacurve') continue
    const matches = datacurveRows.filter((official) =>
      chartModelIdentityMatches(observation, official)
      && chartBenchmarkContextMatches(observation, official)
      && chartScoreMetricCompatible(observation, official),
    )
    if (matches.length) suppressed.set(observation.id, matches)
  }
  return suppressed
}

function titleModelWords(value: string): string {
  return value.split('-').map((part) => part.length ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(' ')
}

/** Presentation formatting only; the exact source name remains on the observation. */
export function displayModelName(name: string): string {
  let match = name.match(/^gpt-(\d+)-(\d+)(?:-(.+))?$/i)
  if (match) return `GPT ${match[1]}.${match[2]}${match[3] ? ` ${titleModelWords(match[3])}` : ''}`
  match = name.match(/^gpt-(\d+)-(.+)$/i)
  if (match) return `GPT-${match[1]} ${titleModelWords(match[2])}`
  match = name.match(/^claude-([a-z]+)-(\d+)-(\d+)$/i)
  if (match) return `Claude ${titleModelWords(match[1]!)} ${match[2]}.${match[3]}`
  match = name.match(/^claude-([a-z]+)-(\d+)$/i)
  if (match) return `Claude ${titleModelWords(match[1]!)} ${match[2]}`
  match = name.match(/^gemini-(\d+)-(\d+)-(.+)$/i)
  if (match) return `Gemini ${match[1]}.${match[2]} ${titleModelWords(match[3]!)}`
  match = name.match(/^grok-(\d+)-(\d+)(?:-(.+))?$/i)
  if (match) return `Grok ${match[1]}.${match[2]}${match[3] ? ` ${titleModelWords(match[3])}` : ''}`
  match = name.match(/^glm-(\d+)-(\d+)(?:-(.+))?$/i)
  if (match) return `GLM-${match[1]}.${match[2]}${match[3] ? ` ${titleModelWords(match[3])}` : ''}`
  match = name.match(/^gemini(\d+)-(\d+)-(.+)$/i)
  if (match) return `Gemini ${match[1]}.${match[2]} ${titleModelWords(match[3]!)}`
  match = name.match(/^qwen(\d+)-(\d+)-(.+)$/i)
  if (match) return `Qwen${match[1]}.${match[2]} ${titleModelWords(match[3]!)}`
  match = name.match(/^deepseek-v(\d+)-(.+)$/i)
  if (match) return `DeepSeek V${match[1]} ${titleModelWords(match[2]!)}`
  match = name.match(/^muse-spark-(\d+)-(\d+)$/i)
  if (match) return `Muse Spark ${match[1]}.${match[2]}`
  match = name.match(/^kimi-k(\d+)(?:-(\d+)-(.+))?$/i)
  if (match) return `Kimi K${match[1]}${match[2] ? `.${match[2]} ${titleModelWords(match[3]!)}` : ''}`
  return titleModelWords(name).replace(/\bGpt\b/g, 'GPT').replace(/\bGlm\b/g, 'GLM')
}

export function projectBest(observations: Observation[], metric: ScoreMetric): Observation[] {
  const bestBySeries = new Map<string, { observation: Observation; score: number }>()
  for (const observation of observations) {
    const result = scoreResult(observation, metric)
    if (!result) continue
    const existing = bestBySeries.get(observation.series.id)
    if (!existing || result.value > existing.score) bestBySeries.set(observation.series.id, { observation, score: result.value })
  }
  return observations.filter((observation) => {
    const result = scoreResult(observation, metric)
    const best = bestBySeries.get(observation.series.id)
    return result !== null && best !== undefined && best.score === result.value
  })
}

export interface FilterState {
  view: 'official' | 'combined'
  query: string
  selectedModels: string[]
  sources: SourceCategory[]
  version: string
  harness: string
  publisher: string
  strict: boolean
  strictGroup: string
  statistic: Statistic
  scoreMetric: ScoreMetric
}

export function filterObservations(observations: Observation[], state: FilterState, metric: XMetric): Observation[] {
  const query = state.query.trim().toLowerCase()
  const candidates = observations.filter((observation) => {
    if (state.view === 'official' && observation.sourceCategory !== 'organizer') return false
    if (!state.sources.includes(observation.sourceCategory)) return false
    if (state.version !== 'all' && observation.benchmark.version !== state.version) return false
    if (state.harness !== 'all' && (observation.series.harness ?? 'unknown') !== state.harness) return false
    if (state.publisher !== 'all' && observation.publisher !== state.publisher) return false
    if (state.selectedModels.length && !state.selectedModels.includes(modelKey(observation))) return false
    if (query && !`${observation.model.reportedName} ${observation.publisher} ${observation.series.harness ?? ''}`.toLowerCase().includes(query)) return false
    return true
  })
  if (!state.strict) return candidates
  if (!state.strictGroup) return []
  return strictProtocolGroups(candidates, metric, state.statistic, state.scoreMetric)
    .find((group) => group.key === state.strictGroup)?.observations ?? []
}

export function getEfficiencyCoverage(observations: Observation[], metric: XMetric, statistic: Statistic) {
  const available = observations.filter((observation) => metricObservation(observation, metric, statistic).value !== null).length
  return { available, total: observations.length, missing: observations.length - available }
}
