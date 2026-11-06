import { CandidateQueueSchema, DatasetSchema, ResolvedCandidateQueueSchema } from '../src/lib/schema.ts'
import { normalizeApprovedReports, type ApprovedReport } from '../src/lib/normalize.ts'
import usageResearch from '../data/research/usage-proxy-cross-platform-20260927.json'
import metaResearch from '../data/research/inference-meta-google-xai.json'
import chineseResearch from '../data/research/inference-chinese-models.json'
import { usageConfigurationsFor, usageScenarioForObservation, usageScenarios } from '../src/lib/usage-scenarios.ts'
import type { SourceRetrievalEvent } from '../src/lib/retrieval.ts'
import { pathToFileURL } from 'node:url'
import { maybeReadJson, readJson } from './lib.ts'

const usageMetrics = ['cost', 'outputTokens', 'time'] as const
const validRelationships = new Set([
  'same-source-same-benchmark-reference', 'separate-experiment-reference', 'separate-benchmark-reference',
  'calibrated-transfer', 'pooled-suite-proxy', 'source-reported-unspecified', 'no-data',
])
const validHashStatuses = new Set(['validated', 'unavailable', 'malformed-historical'])

function sameStringSet(actual: string[], expected: string[]): boolean {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  return actual.length === actualSet.size && expected.length === expectedSet.size
    && actualSet.size === expectedSet.size && [...expectedSet].every((value) => actualSet.has(value))
}

function variantKeyFromDisplayLabel(displayLabel: string): string {
  return displayLabel.toLowerCase()
    .replace(/\s+-\s+/g, '-')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/with-/g, '')
    .replace(/[^a-z0-9.-]/g, '')
}

export function validateUsageResearch(dataset: ReturnType<typeof DatasetSchema.parse>, researchData: typeof usageResearch = usageResearch) {
  const facts = researchData.usageFacts as unknown as Array<{
    id: string; targetObservationId: string; metric: string; value: number | null; missingReason: string | null;
    unit: string; statistic: string; relationship: string; sourceIds: string[];
    identity: { sourceId: string; variantKey: string; displayLabel: string; reportedModel: string; snapshot: string | null; effort: string | null; rawSetting: string | null; harness: string | null; benchmarkVersion: string | null; datasetIndexName: string | null };
    evidence: { url: string; retrievedAt: string; locator: string; responseSha256: string | null; hashStatus: string; historicalMalformedSha256?: string; sourceRevision: string | null; approvedDatasetRevision: string | null; caveats: string[] };
  }>
  const factIds = new Set<string>()
  const evidenceSources = [
    ...researchData.sources.map((source) => source.id),
    ...researchData.efficiencyExtension.sources.map((source) => source.id),
    ...metaResearch.sources.map((source) => source.id),
    ...chineseResearch.sources.map((source) => source.id),
  ].map((id) => ({ id, source: researchData.sources.find((row) => row.id === id) ?? metaResearch.sources.find((row) => row.id === id) ?? chineseResearch.sources.find((row) => row.id === id) }))
  const sourceIds = new Set(evidenceSources.map((entry) => entry.id))
  const config = { ...researchData.scenarioConfig, targets: usageConfigurationsFor(researchData) }
  const allowedMethods = new Set([
    'same-aa-variant-deepswe-mean', 'openai-max-arithmetic-mean-ratio', 'openai-max-through-origin-proportional-fit',
    'opus-5-max-single-pair-ratio', 'exact-model-effort-deepswe-reference', 'same-row-aa-coding-agent-suite-cost-proxy',
    'same-row-source-reported-cost-task', 'two-predecessor-aa-ii-aggregate-output-transfer',
    'two-predecessor-aa-ii-cost-transfer', 'separate-experiment-same-model-effort-deepswe-reference', 'not-estimated',
    'aa-deepswe-efficiency-reference', 'openai-ii-through-origin-cost-fit', 'openai-ii-mean-ratio-transfer',
  ])
  const extension = researchData.efficiencyExtension
  const referenceIds = new Set<string>()
  for (const source of extension.sources) {
    if (!/^https:\/\//.test(source.url) || !source.retrievedOn || source.hashStatus !== 'validated' || !/^[a-f0-9]{64}$/.test(source.responseSha256)) throw new Error(`Invalid efficiency source provenance: ${source.id}`)
  }
  for (const reference of extension.references) {
    if (referenceIds.has(reference.id) || !extension.sources.some((source) => source.id === reference.sourceId) || !reference.locator || !reference.model || !['coding', 'ii'].includes(reference.workload)) throw new Error(`Invalid efficiency reference: ${reference.id}`)
    referenceIds.add(reference.id)
    for (const metric of usageMetrics) if (reference[metric] !== null && (!Number.isFinite(reference[metric]) || reference[metric]! < 0)) throw new Error(`Invalid efficiency ${metric}: ${reference.id}`)
  }
  const normalizedModel = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const extensionTargets = new Set<string>()
  for (const target of extension.targets) {
    const observation = dataset.observations.find((row) => row.id === target.observationId)
    const reference = extension.references.find((row) => row.id === target.referenceId)
    const effort = observation?.effort.reportedLabel?.replace(' thinking', '')
    if (extensionTargets.has(target.observationId) || !observation || !reference || !target.assumption
      || normalizedModel(observation.model.reportedName) !== normalizedModel(reference.model)
      || effort && !effort.startsWith('provider default') && effort !== reference.effort) throw new Error(`Efficiency reference model/effort mismatch: ${target.observationId}`)
    extensionTargets.add(target.observationId)
    if (!target.metrics.length || new Set(target.metrics).size !== target.metrics.length) throw new Error(`Invalid efficiency metric selection: ${target.observationId}`)
    for (const metric of target.metrics) {
      if (!usageMetrics.includes(metric as typeof usageMetrics[number]) || reference[metric as typeof usageMetrics[number]] === null) throw new Error(`Unsupported efficiency metric for ${target.observationId}: ${metric}`)
      if (observation.metrics[metric as typeof usageMetrics[number]].value !== null) throw new Error(`Efficiency extension may only fill missing approved metrics: ${target.observationId}`)
    }
  }
  for (const anchor of extension.iiAnchors) {
    const reference = extension.references.find((row) => row.id === anchor.referenceId)
    const observation = dataset.observations.find((row) => row.upstreamConfigurationId === anchor.configurationId)
    if (!reference || reference.workload !== 'ii' || !observation || normalizedModel(observation.model.reportedName) !== normalizedModel(reference.model) || reference.effort !== observation.effort.reportedLabel) throw new Error(`Invalid exact OpenAI II anchor: ${anchor.configurationId}`)
    for (const metric of anchor.metrics) {
      const key = metric as typeof usageMetrics[number]
      if (!usageMetrics.includes(key) || reference[key] === null || reference[key]! <= 0 || observation.metrics[key].value === null || observation.metrics[key].statistic !== 'mean' || observation.provenance.sourceId !== dataset.sourceRetrieval.sourceId) throw new Error(`Missing measured II calibration pair: ${anchor.configurationId}/${metric}`)
    }
  }
  for (const scenario of researchData.scenarios) {
    if (!['low', 'very-low'].includes(scenario.evidenceQuality) || !allowedMethods.has(scenario.outputCalibrationMethod)
      || !allowedMethods.has(scenario.costCalibrationMethod) || !allowedMethods.has(scenario.timeCalibrationMethod)
      || !sourceIds.has(scenario.codingAgentComparisonSourceId)) throw new Error(`Invalid source or method configuration for ${scenario.targetObservation.observationId}.`)
    if (scenario.directUsageReferenceConfigurationId && !dataset.observations.some((row) => row.upstreamConfigurationId === scenario.directUsageReferenceConfigurationId)) {
      throw new Error(`Unresolved approved Datacurve reference ${scenario.directUsageReferenceConfigurationId}.`)
    }
  }
  for (const scenario of researchData.costOnlyScenarios) {
    if (!Number.isFinite(scenario.costUsd) || scenario.costUsd < 0 || !allowedMethods.has(scenario.costMethod)
      || !sourceIds.has(scenario.sourceId) || !['aa-suite-proxy', 'source-reported-cost'].includes(scenario.costScenarioType)) {
      throw new Error(`Invalid optional cost configuration for ${scenario.targetObservation.observationId}.`)
    }
  }
  for (const fact of facts) {
    if (!fact.id || factIds.has(fact.id)) throw new Error(`Duplicate or empty usage fact ID: ${fact.id || '(empty)'}`)
    factIds.add(fact.id)
    if (!dataset.observations.some((observation) => observation.id === fact.targetObservationId)) throw new Error(`Usage fact ${fact.id} references an unknown target.`)
    if (fact.metric !== 'outputTokens' || (fact.value !== null && (!Number.isFinite(fact.value) || fact.value < 0)) || (fact.value === null && !fact.missingReason)) throw new Error(`Invalid metric value in usage fact ${fact.id}.`)
    if (!fact.unit || fact.statistic !== 'mean' || !validRelationships.has(fact.relationship) || !fact.sourceIds.length) throw new Error(`Invalid metric semantics in usage fact ${fact.id}.`)
    if (!fact.identity.sourceId || !fact.identity.datasetIndexName || !fact.identity.effort || !fact.identity.rawSetting || !fact.identity.harness || !fact.identity.benchmarkVersion) throw new Error(`Incomplete variant identity in usage fact ${fact.id}.`)
    if (!/^https:\/\//.test(fact.evidence.url) || !fact.evidence.retrievedAt || !fact.evidence.locator || !fact.evidence.sourceRevision) throw new Error(`Incomplete source evidence in usage fact ${fact.id}.`)
    if (!fact.sourceIds.every((id) => sourceIds.has(id)) || new Set(fact.sourceIds).size !== fact.sourceIds.length
      || !fact.sourceIds.includes(fact.identity.sourceId) || !validHashStatuses.has(fact.evidence.hashStatus)) throw new Error(`Unknown or inconsistent source/hash provenance in usage fact ${fact.id}.`)
    const scenarioInput = researchData.scenarios.find((row) => row.targetObservation.observationId === fact.targetObservationId)
    const costOnlyInput = researchData.costOnlyScenarios.find((row) => row.targetObservation.observationId === fact.targetObservationId)
    const targetConfig = config.targets.find((row) => row.observationId === fact.targetObservationId)
    const expectedModel = scenarioInput?.model ?? costOnlyInput?.model
    const expectedEffort = scenarioInput?.effort ?? costOnlyInput?.effort
    const expectedHarness = scenarioInput?.aaAgent ?? costOnlyInput?.targetObservation.harness
    const expectedBenchmarkVersion = scenarioInput?.targetBenchmarkVersion ?? costOnlyInput?.targetBenchmarkVersion
    const expectedSourceIds = scenarioInput
      ? [scenarioInput.codingAgentComparisonSourceId]
      : costOnlyInput
        ? chineseResearch.targets.find((row) => row.id === fact.targetObservationId)?.sourceIds ?? [costOnlyInput.sourceId]
        : []
    const harnessPrefix = expectedHarness === 'Codex' ? 'Codex' : expectedHarness === 'Claude Code' ? 'Claude Code' : null
    const variantModelLabel = expectedModel && expectedEffort && expectedModel.includes(`(${expectedEffort})`)
      ? expectedModel
      : expectedModel && expectedEffort ? `${expectedModel} (${expectedEffort})` : null
    const expectedDisplayLabel = harnessPrefix && variantModelLabel ? `${harnessPrefix} - ${variantModelLabel}` : null
    if (!targetConfig || !expectedModel || !expectedEffort || !expectedHarness || !expectedBenchmarkVersion
      || fact.identity.sourceId !== expectedSourceIds[0] || !sameStringSet(fact.sourceIds, expectedSourceIds)
      || fact.identity.reportedModel !== expectedModel || fact.identity.effort !== expectedEffort || fact.identity.rawSetting !== expectedEffort
      || fact.identity.harness !== expectedHarness || fact.identity.snapshot !== targetConfig.snapshot
      || fact.identity.benchmarkVersion !== expectedBenchmarkVersion || fact.identity.datasetIndexName !== 'deep-swe-v1.1'
      || fact.identity.displayLabel !== expectedDisplayLabel || fact.identity.variantKey !== variantKeyFromDisplayLabel(expectedDisplayLabel ?? '')) {
      throw new Error(`Variant identity for usage fact ${fact.id} does not match the exact configured target/source variant.`)
    }
    const factSource = researchData.sources.find((source) => source.id === fact.identity.sourceId)
      ?? chineseResearch.sources.find((source) => source.id === fact.identity.sourceId)
    if (!factSource || fact.evidence.url !== factSource.url) throw new Error(`Usage fact ${fact.id} evidence URL does not match its source ID.`)
    if (fact.evidence.hashStatus === 'validated') {
      if (!fact.evidence.responseSha256 || !/^[a-f0-9]{64}$/i.test(fact.evidence.responseSha256) || fact.evidence.historicalMalformedSha256) throw new Error(`Validated fact hash is not a SHA-256 in ${fact.id}.`)
    } else if (fact.evidence.responseSha256 !== null || fact.evidence.hashStatus === 'malformed-historical' && (!fact.evidence.historicalMalformedSha256 || /^[a-f0-9]{64}$/i.test(fact.evidence.historicalMalformedSha256))) {
      throw new Error(`Unavailable or malformed historical hash is misrepresented in ${fact.id}.`)
    }
    if (fact.evidence.approvedDatasetRevision !== null) throw new Error(`Unapproved source fact ${fact.id} must not claim an approved dataset revision.`)
  }

  if (config.approvedDatasetRevision !== dataset.revisionId) throw new Error(`Usage scenario revision mismatch: pinned ${config.approvedDatasetRevision}; approved dataset revision ${dataset.revisionId}. Review and update scenarioConfig.approvedDatasetRevision in data/research/usage-proxy-cross-platform-20260927.json as described in CONTRIBUTING.md#reviewing-the-shared-usage-scenario-revision-pin.`)
  const targetIds = new Set<string>()
  const calibratedReferenceIds = new Set([
    ...extension.references.map((reference) => reference.id),
    ...(researchData.costCalibration.openaiMaxPairs.length === 3 ? ['openai-max-cost-calibration'] : []),
    ...(researchData.timeCalibration.openaiMaxPairs.length === 2 ? ['openai-max-time-calibration'] : []),
    ...(researchData.costCalibration.anthropicOpusFamilyPair.calibrationModel ? ['opus-5-max-cost-calibration'] : []),
    ...(researchData.timeCalibration.anthropicOpusFamilyPair.calibrationModel ? ['opus-5-max-time-calibration'] : []),
    ...(metaResearch.calibration.meta.length === 2 ? ['meta-calibration'] : []),
    ...(metaResearch.calibration.xai.length === 2 ? ['xai-calibration'] : []),
  ])
  const availableReferences = (referenceId: string) => calibratedReferenceIds.has(referenceId)
    || dataset.observations.some((observation) => observation.upstreamConfigurationId === referenceId)
  if (config.targets.length !== usageScenarios.length) throw new Error('Usage scenario configuration/runtime target counts differ.')
  for (const target of config.targets) {
    if (targetIds.has(target.observationId)) throw new Error(`Duplicate usage scenario target: ${target.observationId}`)
    targetIds.add(target.observationId)
    const observation = dataset.observations.find((row) => row.id === target.observationId)
    if (!observation || observation.provenance.sourceId !== target.sourceId || observation.model.canonicalId !== target.canonicalId || observation.model.snapshot !== target.snapshot) {
      throw new Error(`Usage scenario target identity changed: ${target.observationId}`)
    }
    if (!usageScenarioForObservation(observation, dataset.revisionId)) throw new Error(`Usage scenario no longer matches its exact approved target: ${target.observationId}`)
    const runtimeScenario = usageScenarios.find((scenario) => scenario.targetObservationId === target.observationId)!
    for (const metric of usageMetrics) {
      const definition = target.metrics[metric]
      if (!['same-source-reference', 'fallback', 'none'].includes(definition.selection) || !definition.method || !validRelationships.has(definition.relationship)
        || !['mean-only', 'source-deepswe-mean', 'pooled-suite-average', 'source-statistic-unspecified', 'not-estimated'].includes(definition.statistic)) throw new Error(`Invalid ${metric} scenario configuration for ${target.observationId}.`)
      if (!definition.factIds.every((id) => factIds.has(id)) || !definition.referenceIds.every(availableReferences)
        || definition.selection === 'same-source-reference' && definition.factIds.length === 0) throw new Error(`Unresolved ${metric} evidence reference for ${target.observationId}.`)
      for (const factId of definition.factIds) {
        const fact = facts.find((row) => row.id === factId)
        if (!fact || fact.targetObservationId !== target.observationId || fact.metric !== metric) throw new Error(`Fact ${factId} is not an exact ${metric} target fact for ${target.observationId}.`)
      }
      const factSources = [...new Set(definition.factIds.flatMap((factId) => facts.find((fact) => fact.id === factId)?.sourceIds ?? []))]
      const targetDetails = target as typeof target & { scenarioFamily?: string }
      const linkedResearchTarget = metaResearch.targets.find((row) => row.observationId === target.observationId)
      let expectedSources: string[] = []
      if (definition.selection !== 'none') {
        const extensionTarget = extension.targets.find((row) => row.observationId === target.observationId && row.metrics.includes(metric))
        if (extensionTarget) {
          const reference = extension.references.find((row) => row.id === extensionTarget.referenceId)!
          const directOutput = reference.workload === 'coding' && metric === 'outputTokens'
          expectedSources = [...new Set([reference.sourceId, ...(directOutput ? [] : ['datacurve-v1.1-json']),
            ...(reference.workload === 'coding' && !directOutput ? ['aa-codex-vs-kimi-code-cli'] : []),
            ...(reference.workload === 'ii' ? extension.iiAnchors.filter((anchor) => anchor.metrics.includes(metric)).map((anchor) => extension.references.find((row) => row.id === anchor.referenceId)!.sourceId) : []),
          ])]
        } else if (factSources.length) expectedSources = factSources
        else if (targetDetails.scenarioFamily === 'google-reference') expectedSources = ['google-method', 'dc']
        else if (targetDetails.scenarioFamily === 'meta-transfer' || targetDetails.scenarioFamily === 'xai-transfer') {
          const groupName = linkedResearchTarget?.calibrationGroup
          const calibration = groupName === 'meta' ? metaResearch.calibration.meta : groupName === 'xai' ? metaResearch.calibration.xai : []
          const targetSource = linkedResearchTarget?.aaSource
          expectedSources = groupName && targetSource
            ? [groupName === 'meta' ? 'meta-model' : 'xai-release', 'dc', ...calibration.map((row) => row.aaSource), targetSource]
            : []
        } else {
          const sourceScenario = researchData.scenarios.find((row) => row.targetObservation.observationId === target.observationId)
          const costOnlyScenario = researchData.costOnlyScenarios.find((row) => row.targetObservation.observationId === target.observationId)
          if (sourceScenario) expectedSources = [sourceScenario.codingAgentComparisonSourceId, 'datacurve-v1.1-json']
          else if (costOnlyScenario) expectedSources = [costOnlyScenario.sourceId]
        }
      }
      if (definition.selection !== 'none' && definition.sourceIds.length === 0) throw new Error(`Configured ${metric} evidence for ${target.observationId} has no source IDs.`)
      if (!definition.sourceIds.every((id) => sourceIds.has(id)) || !sameStringSet(definition.sourceIds, expectedSources)) {
        throw new Error(`Configured ${metric} source IDs do not match fact/evidence provenance for ${target.observationId}.`)
      }
      const runtimeValue = metric === 'cost' ? runtimeScenario.costUsd : metric === 'outputTokens' ? runtimeScenario.outputTokensPerScoredAttempt : runtimeScenario.timeSecondsPerScoredAttempt
      const runtimeMethod = metric === 'cost' ? runtimeScenario.costCalibrationMethod : metric === 'outputTokens' ? runtimeScenario.outputCalibrationMethod : runtimeScenario.timeCalibrationMethod
      if (runtimeValue !== null && runtimeMethod !== definition.method) throw new Error(`Runtime ${metric} method differs from the explicit target config: ${target.observationId}.`)
    }
  }
  if (targetIds.size !== usageScenarios.length || usageScenarios.some((scenario) => !targetIds.has(scenario.targetObservationId))) throw new Error('Runtime scenarios and explicit target configuration differ.')

  const historicalAaSource = chineseResearch.sources.find((source) => source.id === 'aa-codex-kimi-live') as unknown as { sha256: string | null; hashStatus: string; historicalMalformedSha256: string }
  if (!historicalAaSource || historicalAaSource.sha256 !== null || historicalAaSource.hashStatus !== 'malformed-historical' || /^[a-f0-9]{64}$/i.test(historicalAaSource.historicalMalformedSha256)) {
    throw new Error('The malformed historical AA Codex response hash must remain explicitly unavailable/malformed; do not infer a replacement.')
  }
}

async function main() {
  const dataset = DatasetSchema.parse(await readJson<unknown>('data/approved/dataset.json'))
  validateUsageResearch(dataset)
  const queue = CandidateQueueSchema.parse(await readJson<unknown>('data/candidates/queue.json'))
  const resolved = ResolvedCandidateQueueSchema.parse(await readJson<unknown>('data/candidates/resolved.json'))
  const reports = await readJson<{ reports: ApprovedReport[] }>('data/sources/approved-reports.json')
  const retrievalHistory = await readJson<{ schemaVersion: number; events: SourceRetrievalEvent[] }>('data/approved/retrievals.json')
  const snapshotManifest = await readJson<{ schemaVersion: number; revisions: Array<{ revisionId: string; snapshotFile: string; normalizedObservationCount: number }> }>('data/snapshots/manifest.json')
  const supplemental = normalizeApprovedReports(reports.reports)
  const ids = new Set(dataset.observations.map((observation) => observation.id))
  for (const report of supplemental) {
    const stored = dataset.observations.find((observation) => observation.id === report.id)
    if (!stored || JSON.stringify(stored) !== JSON.stringify(report)) throw new Error(`Approved supplemental report is missing or differs from normalized source: ${report.id}`)
  }
  const pendingIds = new Set(queue.candidates.map((candidate) => candidate.id))
  for (const candidate of queue.candidates) {
    if (ids.has(candidate.id)) throw new Error(`Pending candidate leaked into approved observations: ${candidate.id}`)
    if (candidate.status !== 'pending-review') throw new Error(`Non-pending candidate in review queue: ${candidate.id}`)
  }
  const resolvedIds = new Set<string>()
  for (const candidate of resolved.candidates) {
    if (resolvedIds.has(candidate.id)) throw new Error(`Duplicate resolved candidate ID: ${candidate.id}`)
    resolvedIds.add(candidate.id)
    if (pendingIds.has(candidate.id)) throw new Error(`Candidate appears in both pending and resolved queues: ${candidate.id}`)
    if (ids.has(candidate.id)) throw new Error(`Resolved candidate ID leaked into approved observations: ${candidate.id}`)
    if (!ids.has(candidate.matchedObservationId)) throw new Error(`Resolved candidate ${candidate.id} has no matching approved observation.`)
  }
  if (dataset.observations.some((observation) => observation.id.startsWith('fixture-') || observation.id.startsWith('synthetic-'))) {
    throw new Error('Synthetic test observations are not allowed in approved production data.')
  }
  const official = dataset.observations.filter((observation) => observation.provenance.sourceId === dataset.sourceRetrieval.sourceId)
  if (official.length !== dataset.sourceRetrieval.rowCount) {
    throw new Error(`Approved official row count (${official.length}) differs from retrieval manifest (${dataset.sourceRetrieval.rowCount}).`)
  }
  const retrievalIds = retrievalHistory.events.map((event) => event.eventId)
  if (new Set(retrievalIds).size !== retrievalIds.length) throw new Error('Duplicate source retrieval event IDs were found.')
  if (!retrievalHistory.events.some((event) => event.contentSha256 === dataset.sourceRetrieval.contentSha256)) {
    throw new Error('Approved source retrieval hash is absent from retrieval history.')
  }
  if (official.some((observation) => observation.metrics.time.value !== null && observation.metrics.time.sampleCount !== null)) {
    throw new Error('Feed time samples cannot be reported as duration-specific when the source does not provide them.')
  }
  for (const revision of snapshotManifest.revisions) {
    const snapshot = await maybeReadJson<{ status: string; approval?: { revisionId: string }; observations: unknown[] }>(`data/snapshots/${revision.snapshotFile}`)
    if (!snapshot || snapshot.status !== 'approved-source-snapshot' || snapshot.approval?.revisionId !== revision.revisionId || snapshot.observations.length !== revision.normalizedObservationCount) {
      throw new Error(`Snapshot manifest entry ${revision.revisionId} has no matching normalized snapshot file.`)
    }
  }
  console.log(`Validated ${dataset.observations.length} approved observations (${official.length} official; ${dataset.observations.length - official.length} supplemental), ${usageScenarios.length} exact usage scenarios and facts, ${queue.candidates.length} pending candidates, and ${resolved.candidates.length} retained resolutions.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Data validation failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    process.exitCode = 1
  })
}
