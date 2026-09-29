import { CandidateQueueSchema, DatasetSchema, ResolvedCandidateQueueSchema } from '../src/lib/schema.ts'
import { normalizeApprovedReports, type ApprovedReport } from '../src/lib/normalize.ts'
import type { SourceRetrievalEvent } from '../src/lib/retrieval.ts'
import { maybeReadJson, readJson } from './lib.ts'

async function main() {
  const dataset = DatasetSchema.parse(await readJson<unknown>('data/approved/dataset.json'))
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
  console.log(`Validated ${dataset.observations.length} approved observations (${official.length} official; ${dataset.observations.length - official.length} supplemental), ${queue.candidates.length} pending candidates, and ${resolved.candidates.length} retained resolutions.`)
}

main().catch((error: unknown) => {
  console.error(`Data validation failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
