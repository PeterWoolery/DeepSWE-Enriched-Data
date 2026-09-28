import { z } from 'zod'

const nullableNumber = z.number().finite().nullable()
const nullableString = z.string().nullable()

export const MetricSchema = z.object({
  value: nullableNumber,
  unit: z.string().min(1),
  statistic: z.enum(['mean', 'median', 'reported']),
  sourceField: nullableString,
  reportedValue: nullableNumber,
  reportedUnit: nullableString,
  scope: nullableString,
  population: nullableString,
  sampleCount: z.number().int().nonnegative().nullable(),
  sampleCountMissingReason: nullableString,
  definition: nullableString,
  sourceLocator: nullableString,
  missingReason: nullableString,
  includesReasoningTokens: z.boolean().nullable(),
  inclusionNote: nullableString,
}).superRefine((metric, context) => {
  if (metric.value === null && !metric.missingReason) {
    context.addIssue({ code: 'custom', path: ['missingReason'], message: 'Null metrics require an explicit reason.' })
  }
  if (metric.value !== null && metric.missingReason !== null) {
    context.addIssue({ code: 'custom', path: ['missingReason'], message: 'Observed metrics cannot have a missing-value reason.' })
  }
  if (metric.value !== null && metric.value < 0) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'Efficiency metrics cannot be negative.' })
  }
})

export const ConfidenceIntervalSchema = z.object({
  low: nullableNumber,
  high: nullableNumber,
  confidence: nullableNumber,
  method: nullableString,
  passed: z.number().int().nonnegative().nullable(),
  attempted: z.number().int().nonnegative().nullable(),
  missingReason: nullableString,
})

export const ObservationSchema = z.object({
  id: z.string().min(1),
  upstreamConfigurationId: nullableString,
  model: z.object({
    reportedName: z.string().min(1),
    canonicalId: nullableString,
    snapshot: nullableString,
    aliasEvidence: nullableString,
  }),
  publisher: z.string().min(1),
  evaluator: nullableString,
  sourceCategory: z.enum(['organizer', 'developer', 'independent', 'secondary', 'local']),
  benchmark: z.object({
    name: z.literal('DeepSWE'),
    version: nullableString,
    scope: z.enum(['full', 'subset', 'unknown']),
    taskSetRevision: nullableString,
    taskCount: z.number().int().positive().nullable(),
    tasksAttempted: z.number().int().nonnegative().nullable(),
    tasksPassedAny: z.number().int().nonnegative().nullable(),
    attempts: z.number().int().nonnegative().nullable(),
    passedAttempts: z.number().int().nonnegative().nullable(),
    scoredAttempts: z.number().int().nonnegative().nullable(),
    runs: z.number().int().nonnegative().nullable().default(null),
    excludedPolicy: nullableString,
    population: nullableString,
  }),
  result: z.object({
    metric: z.string().min(1),
    metricLabel: z.string().min(1),
    value: z.number().finite().min(0).max(1),
    unit: z.string().min(1),
    reportedValue: z.number().finite(),
    reportedUnit: z.string().min(1),
    reportedText: z.string().min(1),
    denominator: nullableString,
    denominatorCount: z.number().int().nonnegative().nullable(),
    confidenceInterval: ConfidenceIntervalSchema,
  }),
  additionalResults: z.array(z.object({
    metric: z.string().min(1),
    metricLabel: z.string().min(1),
    value: z.number().finite().min(0).max(1),
    unit: z.string().min(1),
    reportedValue: z.number().finite(),
    reportedUnit: z.string().min(1),
    reportedText: z.string().min(1),
    denominator: nullableString,
    denominatorCount: z.number().int().nonnegative().nullable(),
    confidenceInterval: ConfidenceIntervalSchema.default({
      low: null,
      high: null,
      confidence: null,
      method: null,
      passed: null,
      attempted: null,
      missingReason: 'This alternate score has no reported confidence interval.',
    }),
  })),
  effort: z.object({
    reportedLabel: nullableString,
    rawSetting: nullableString,
    order: z.number().int().nonnegative().nullable(),
    orderEvidence: nullableString,
    missingReason: nullableString,
  }),
  series: z.object({
    id: z.string().min(1),
    connectionEvidence: z.string().min(1),
    connectable: z.boolean(),
    harness: nullableString,
    harnessRevision: nullableString,
    provider: nullableString,
    evaluationPolicy: nullableString,
    deployment: nullableString,
    servingEndpoint: nullableString,
    timingScope: nullableString,
    pricingBasis: nullableString,
  }),
  metrics: z.object({
    cost: MetricSchema,
    medianCost: MetricSchema,
    outputTokens: MetricSchema,
    medianOutputTokens: MetricSchema,
    time: MetricSchema,
    medianTime: MetricSchema,
  }),
  pricing: z.object({
    asReportedCost: nullableNumber,
    currency: z.literal('USD'),
    basis: nullableString,
    repricedCost: nullableNumber,
    repricingSource: nullableString,
    repricedAt: nullableString,
    renderedLeaderboardCost: nullableNumber,
    renderedCostEvidence: nullableString,
    renderedCostSourceTitle: nullableString.default(null),
    renderedCostSourceUrl: z.string().url().nullable().default(null),
    renderedCostSourceRetrievedAt: nullableString.default(null),
    renderedCostSourceSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
    reconciliationStatus: z.enum(['feed-only', 'single-source-reported', 'unresolved-discrepancy', 'not-reported']),
  }),
  provenance: z.object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().nullable(),
    retrievedAt: z.union([
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ]),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceLocator: z.string().min(1),
    publicationDate: nullableString,
    reviewStatus: z.enum(['source-reviewed', 'pending-review']),
    reviewedAt: nullableString,
    reviewer: nullableString,
    independentReplication: z.enum(['not-assessed', 'not-independently-reproduced', 'independently-reproduced']),
    notes: z.array(z.string()),
  }),
}).superRefine((observation, context) => {
  const ci = observation.result.confidenceInterval
  if (ci.low !== null && ci.high !== null && ci.low > ci.high) {
    context.addIssue({ code: 'custom', path: ['result', 'confidenceInterval'], message: 'Confidence interval lower bound exceeds upper bound.' })
  }
  if (ci.low !== null && ci.low > 1 || ci.high !== null && ci.high > 1) {
    context.addIssue({ code: 'custom', path: ['result', 'confidenceInterval'], message: 'Fraction score bounds cannot exceed 1.' })
  }
  for (const metric of Object.values(observation.metrics)) {
    if (metric.value !== null && metric.missingReason !== null) {
      context.addIssue({ code: 'custom', path: ['metrics'], message: 'Observed values and missing reasons are mutually exclusive.' })
    }
  }
  if (observation.effort.order !== null && !observation.effort.orderEvidence) {
    context.addIssue({ code: 'custom', path: ['effort', 'orderEvidence'], message: 'Ordered effort points require evidence.' })
  }
  if (observation.series.connectable && observation.effort.order === null) {
    context.addIssue({ code: 'custom', path: ['series', 'connectable'], message: 'Connected series points require a source-backed effort order.' })
  }
})

export const DatasetSchema = z.object({
  schemaVersion: z.literal(1),
  revisionId: z.string().min(1),
  lastDataChangeAt: z.string().datetime({ offset: true }),
  lastSuccessfulCheckAt: z.string().datetime({ offset: true }),
  sourceStatus: z.enum(['current', 'stale', 'candidate-pending-review']),
  sourceNote: z.string().min(1),
  sourceRetrieval: z.object({
    sourceId: z.string().min(1),
    url: z.string().url(),
    generatedAt: z.string().datetime({ offset: true }),
    retrievedAt: z.string().datetime({ offset: true }),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    httpStatus: z.union([z.literal(200), z.literal(304)]).default(200),
    etag: z.string().nullable(),
    lastModified: z.string().nullable(),
    rowCount: z.number().int().positive(),
  }),
  observations: z.array(ObservationSchema).min(1),
}).superRefine((dataset, context) => {
  const identifiers = new Set<string>()
  for (const observation of dataset.observations) {
    if (identifiers.has(observation.id)) {
      context.addIssue({ code: 'custom', path: ['observations'], message: `Duplicate observation ID: ${observation.id}` })
    }
    identifiers.add(observation.id)
  }
})

export const CandidateSchema = z.object({
  id: z.string().min(1),
  modelReported: z.string().min(1),
  publisher: z.string().min(1),
  sourceCategory: z.enum(['developer', 'independent', 'secondary']),
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().url(),
  evidenceLocator: z.string().min(1),
  reportedScore: z.number().finite().nullable(),
  normalizedScore: z.number().finite().min(0).max(1).nullable(),
  scoreUnit: z.string().min(1),
  rawScoreText: z.string().min(1),
  benchmarkVersion: z.string().nullable(),
  effortLabel: z.string().nullable(),
  harness: z.string().nullable(),
  status: z.literal('pending-review'),
  reason: z.string().min(1),
  missing: z.array(z.string()),
})

export const CandidateQueueSchema = z.object({
  schemaVersion: z.literal(1),
  candidates: z.array(CandidateSchema),
})

export const ResolvedCandidateQueueSchema = z.object({
  schemaVersion: z.literal(1),
  candidates: z.array(CandidateSchema.extend({
    status: z.literal('resolved'),
    resolvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    resolution: z.string().min(1),
    matchedObservationId: z.string().min(1),
  })),
})

export const OfficialCandidateSchema = z.object({
  status: z.literal('pending-review'),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceGeneratedAt: z.string().datetime({ offset: true }),
  retrieval: z.object({
    retrievedAt: z.string().datetime({ offset: true }),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    httpStatus: z.union([z.literal(200), z.literal(304)]).default(200),
    etag: z.string().nullable(),
    lastModified: z.string().nullable(),
  }),
  rowCount: z.number().int().positive(),
  unknownOptionalFields: z.array(z.string()),
  changeReport: z.object({
    addedIds: z.array(z.string()),
    changedIds: z.array(z.string()),
    disappearedIds: z.array(z.string()),
    unchangedCount: z.number().int().nonnegative(),
    changeKinds: z.array(z.object({ id: z.string(), kind: z.string() })),
  }),
  observations: z.array(ObservationSchema).min(1),
})

export type Observation = z.infer<typeof ObservationSchema>
export type Dataset = z.infer<typeof DatasetSchema>
export type Candidate = z.infer<typeof CandidateSchema>
export type OfficialCandidate = z.infer<typeof OfficialCandidateSchema>
