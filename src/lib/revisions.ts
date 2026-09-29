import type { Observation } from './schema'

export interface FeedDiff {
  addedIds: string[]
  changedIds: string[]
  disappearedIds: string[]
  unchangedCount: number
  changeKinds: { id: string; kind: string }[]
}

export function observationChangeKinds(previous: Observation, next: Observation): string[] {
  const scoreChanged = JSON.stringify(previous.result) !== JSON.stringify(next.result) || JSON.stringify(previous.additionalResults) !== JSON.stringify(next.additionalResults)
  const costChanged = previous.metrics.cost.value !== next.metrics.cost.value || previous.metrics.medianCost.value !== next.metrics.medianCost.value ||
    JSON.stringify(previous.pricing) !== JSON.stringify(next.pricing)
  const efficiencyChanged =
    previous.metrics.outputTokens.value !== next.metrics.outputTokens.value || previous.metrics.time.value !== next.metrics.time.value ||
    previous.metrics.medianOutputTokens.value !== next.metrics.medianOutputTokens.value || previous.metrics.medianTime.value !== next.metrics.medianTime.value
  const kinds: string[] = []
  if (scoreChanged) kinds.push('changed-result')
  if (previous.result.metric !== next.result.metric || previous.result.metricLabel !== next.result.metricLabel || previous.result.unit !== next.result.unit) kinds.push('score-definition-change')
  if (costChanged) kinds.push(scoreChanged || efficiencyChanged ? 'cost-change' : 'pricing-only-change')
  if (efficiencyChanged) kinds.push('efficiency-change')
  const scopeChanged = Object.keys(previous.metrics).some((key) => {
    const left = previous.metrics[key as keyof Observation['metrics']]
    const right = next.metrics[key as keyof Observation['metrics']]
    return left.scope !== right.scope || left.population !== right.population || left.sampleCount !== right.sampleCount ||
      left.sampleCountMissingReason !== right.sampleCountMissingReason || left.definition !== right.definition || left.includesReasoningTokens !== right.includesReasoningTokens
  })
  if (scopeChanged) kinds.push('metric-scope-change')
  if (previous.effort.order !== next.effort.order || previous.effort.orderEvidence !== next.effort.orderEvidence) kinds.push('effort-order-change')
  if (previous.benchmark.runs !== next.benchmark.runs || previous.benchmark.attempts !== next.benchmark.attempts ||
    previous.benchmark.scoredAttempts !== next.benchmark.scoredAttempts || previous.benchmark.passedAttempts !== next.benchmark.passedAttempts ||
    previous.benchmark.tasksAttempted !== next.benchmark.tasksAttempted || previous.benchmark.tasksPassedAny !== next.benchmark.tasksPassedAny ||
    previous.benchmark.excludedPolicy !== next.benchmark.excludedPolicy || previous.benchmark.population !== next.benchmark.population) {
    kinds.push('benchmark-population-change')
  }
  const evidenceChanged = previous.provenance.sourceId !== next.provenance.sourceId || previous.provenance.title !== next.provenance.title ||
    previous.provenance.url !== next.provenance.url || previous.provenance.contentSha256 !== next.provenance.contentSha256 ||
    previous.provenance.evidenceLocator !== next.provenance.evidenceLocator || previous.provenance.publicationDate !== next.provenance.publicationDate ||
    previous.provenance.reviewStatus !== next.provenance.reviewStatus || previous.provenance.independentReplication !== next.provenance.independentReplication ||
    JSON.stringify(previous.provenance.notes) !== JSON.stringify(next.provenance.notes)
  if (evidenceChanged) kinds.push('evidence-change')
  const benchmarkScopeChanged = previous.benchmark.version !== next.benchmark.version || previous.benchmark.scope !== next.benchmark.scope ||
    previous.benchmark.taskSetRevision !== next.benchmark.taskSetRevision || previous.benchmark.taskCount !== next.benchmark.taskCount
  if (benchmarkScopeChanged) kinds.push('benchmark-scope-change')
  const protocolChanged = previous.publisher !== next.publisher || previous.evaluator !== next.evaluator || previous.sourceCategory !== next.sourceCategory ||
    JSON.stringify(previous.series) !== JSON.stringify(next.series)
  if (protocolChanged) kinds.push('protocol-change')
  if (previous.effort.reportedLabel !== next.effort.reportedLabel || previous.effort.rawSetting !== next.effort.rawSetting ||
    JSON.stringify(previous.model) !== JSON.stringify(next.model)) kinds.push('configuration-change')
  else if (previous.effort.missingReason !== next.effort.missingReason) kinds.push('effort-review-status-change')
  return kinds
}

export function diffOfficialObservations(previous: Observation[], next: Observation[]): FeedDiff {
  const previousById = new Map(previous.map((observation) => [observation.id, observation]))
  const nextById = new Map(next.map((observation) => [observation.id, observation]))
  const diff: FeedDiff = { addedIds: [], changedIds: [], disappearedIds: [], unchangedCount: 0, changeKinds: [] }
  for (const observation of next) {
    const old = previousById.get(observation.id)
    if (!old) {
      diff.addedIds.push(observation.id)
      diff.changeKinds.push({ id: observation.id, kind: 'new-configuration' })
      continue
    }
    const kinds = observationChangeKinds(old, observation)
    if (kinds.length) {
      diff.changedIds.push(observation.id)
      diff.changeKinds.push(...kinds.map((kind) => ({ id: observation.id, kind })))
    } else diff.unchangedCount += 1
  }
  for (const old of previous) {
    if (nextById.has(old.id)) continue
    diff.disappearedIds.push(old.id)
    diff.changeKinds.push({ id: old.id, kind: 'source-removal' })
  }
  return diff
}

export function assertNoSuspiciousRemoval(previousCount: number, nextCount: number): void {
  if (previousCount > 0 && (nextCount === 0 || nextCount < Math.floor(previousCount * 0.8))) {
    throw new Error(`Suspicious source removal: configuration count fell from ${previousCount} to ${nextCount}.`)
  }
}

export function revisionValues(observation: Observation) {
  return {
    publisher: observation.publisher,
    evaluator: observation.evaluator,
    sourceCategory: observation.sourceCategory,
    model: observation.model,
    benchmark: {
      version: observation.benchmark.version,
      scope: observation.benchmark.scope,
      taskSetRevision: observation.benchmark.taskSetRevision,
      taskCount: observation.benchmark.taskCount,
      tasksAttempted: observation.benchmark.tasksAttempted,
      attempts: observation.benchmark.attempts,
      scoredAttempts: observation.benchmark.scoredAttempts,
      runs: observation.benchmark.runs,
      excludedPolicy: observation.benchmark.excludedPolicy,
    },
    scoreMetric: observation.result.metric,
    resultDetails: observation.result,
    score: observation.result.value,
    reportedScore: observation.result.reportedValue,
    confidenceInterval: observation.result.confidenceInterval,
    additionalResults: observation.additionalResults,
    meanCostUsd: observation.metrics.cost.statistic === 'mean' ? observation.metrics.cost.value : null,
    ...(observation.approximation ? {
      approximateSourceChartCostUsd: observation.metrics.cost.value,
      approximation: observation.approximation,
    } : {}),
    medianCostUsd: observation.metrics.medianCost.value,
    meanOutputTokens: observation.metrics.outputTokens.value,
    medianOutputTokens: observation.metrics.medianOutputTokens.value,
    meanDurationSeconds: observation.metrics.time.value,
    medianDurationSeconds: observation.metrics.medianTime.value,
    pricing: observation.pricing,
    metricScopeDetails: Object.fromEntries(Object.entries(observation.metrics).map(([key, metric]) => [key, {
      scope: metric.scope,
      population: metric.population,
      sampleCount: metric.sampleCount,
      sampleCountMissingReason: metric.sampleCountMissingReason,
      definition: metric.definition,
    }])),
    contentSha256: observation.provenance.contentSha256,
    sourceId: observation.provenance.sourceId,
    sourceTitle: observation.provenance.title,
    sourceUrl: observation.provenance.url,
    evidenceLocator: observation.provenance.evidenceLocator,
    reviewStatus: observation.provenance.reviewStatus,
    independentReplication: observation.provenance.independentReplication,
    effortLabel: observation.effort.reportedLabel,
    effortOrder: observation.effort.order,
    effortOrderEvidence: observation.effort.orderEvidence,
    seriesId: observation.series.id,
    protocol: observation.series,
    benchmarkRuns: observation.benchmark.runs,
    attemptCount: observation.benchmark.attempts,
    scoredAttemptCount: observation.benchmark.scoredAttempts,
  }
}

export interface RevisionEvent {
  eventId: string
  observedAt: string
  observationId: string
  kind: string
  sourceId: string
  previous: ReturnType<typeof revisionValues> | null
  current: ReturnType<typeof revisionValues> | null
}

export function buildRevisionEvents(previous: Observation[], next: Observation[], contentSha256: string, observedAt: string): RevisionEvent[] {
  const previousById = new Map(previous.map((observation) => [observation.id, observation]))
  const nextById = new Map(next.map((observation) => [observation.id, observation]))
  const events: RevisionEvent[] = []
  for (const observation of next) {
    const old = previousById.get(observation.id)
    const kinds = old ? observationChangeKinds(old, observation) : ['new-configuration']
    for (const kind of kinds) events.push({
      eventId: `${contentSha256.slice(0, 16)}:${kind}:${observation.id}`,
      observedAt,
      observationId: observation.id,
      kind,
      sourceId: observation.provenance.sourceId,
      previous: old ? revisionValues(old) : null,
      current: revisionValues(observation),
    })
  }
  for (const observation of previous) {
    if (nextById.has(observation.id)) continue
    events.push({
      eventId: `${contentSha256.slice(0, 16)}:source-removal:${observation.id}`,
      observedAt,
      observationId: observation.id,
      kind: 'source-removal',
      sourceId: observation.provenance.sourceId,
      previous: revisionValues(observation),
      current: null,
    })
  }
  return events
}

export function mergeRevisionEvents<T extends { eventId: string }>(previous: T[], next: T[]): T[] {
  const known = new Set(previous.map((event) => event.eventId))
  return [...previous, ...next.filter((event) => !known.has(event.eventId))]
}
