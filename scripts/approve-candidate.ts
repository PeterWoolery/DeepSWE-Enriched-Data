import { createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { DatasetSchema, OfficialCandidateSchema } from '../src/lib/schema.ts'
import { normalizeApprovedReports, type ApprovedReport } from '../src/lib/normalize.ts'
import { buildRevisionEvents, mergeRevisionEvents, type RevisionEvent } from '../src/lib/revisions.ts'
import { mergeRetrievalEvents, retrievalEvent, type SourceRetrievalEvent } from '../src/lib/retrieval.ts'
import { maybeReadJson, projectPath, readJson, sha256, writeJsonAtomic } from './lib.ts'

function fingerprint(observations: Array<Record<string, any>>): string {
  const rows = observations.map((observation) => ({
    id: observation.id,
    publisher: observation.publisher,
    evaluator: observation.evaluator,
    sourceCategory: observation.sourceCategory,
    model: observation.model,
    benchmark: observation.benchmark,
    result: observation.result,
    additionalResults: observation.additionalResults,
    effort: observation.effort,
    series: observation.series,
    metrics: observation.metrics,
    pricing: observation.pricing,
    provenance: {
      sourceId: observation.provenance.sourceId,
      title: observation.provenance.title,
      url: observation.provenance.url,
      contentSha256: observation.provenance.contentSha256,
      evidenceLocator: observation.provenance.evidenceLocator,
      publicationDate: observation.provenance.publicationDate,
      reviewStatus: observation.provenance.reviewStatus,
      reviewer: observation.provenance.reviewer,
      independentReplication: observation.provenance.independentReplication,
      notes: observation.provenance.notes,
    },
  }))
  return sha256(JSON.stringify(rows))
}

function parseArgs(args: string[]) {
  const options = new Set(args)
  const reviewerIndex = args.indexOf('--reviewer')
  const reviewer = reviewerIndex >= 0 ? args[reviewerIndex + 1] : null
  if (!reviewer || reviewer.startsWith('--')) throw new Error('Pass --reviewer <name-or-maintainer-id>.')
  if (!options.has('--confirm-source-review')) throw new Error('Approval requires --confirm-source-review after human inspection of the candidate diff.')
  return { reviewer, allowRemovals: options.has('--allow-source-removals') }
}

async function main(): Promise<void> {
  const { reviewer, allowRemovals } = parseArgs(process.argv.slice(2))
  const candidate = OfficialCandidateSchema.parse(await readJson<unknown>('data/candidates/datacurve-v1.1.json'))
  const oldDatasetValue = await maybeReadJson<unknown>('data/approved/dataset.json')
  const oldDataset = oldDatasetValue === null ? null : DatasetSchema.parse(oldDatasetValue)
  if (candidate.changeReport.disappearedIds.length && !allowRemovals) {
    throw new Error(`Candidate removes ${candidate.changeReport.disappearedIds.length} approved configurations. Review the diff and explicitly pass --allow-source-removals to accept those removals.`)
  }
  if (candidate.observations.some((observation) => observation.provenance.sourceId !== candidate.sourceId)) {
    throw new Error('Official candidate contains a non-allowlisted source ID.')
  }
  const reportsFile = await readJson<{ reports: ApprovedReport[] }>('data/sources/approved-reports.json')
  const supplemental = normalizeApprovedReports(reportsFile.reports)
  const observations = [...candidate.observations, ...supplemental]
  const allIds = new Set<string>()
  for (const observation of observations) {
    if (allIds.has(observation.id)) throw new Error(`Observation ID collision during approval: ${observation.id}`)
    allIds.add(observation.id)
  }

  const checkedAt = candidate.retrieval.retrievedAt
  const previousRevisions = await maybeReadJson<{ schemaVersion: number; events: RevisionEvent[] }>('data/approved/revisions.json')
  const previousRetrievals = await maybeReadJson<{ schemaVersion: number; events: SourceRetrievalEvent[] }>('data/approved/retrievals.json')
  const retrievals = mergeRetrievalEvents((previousRetrievals?.events ?? []).map((event) => ({ ...event, httpStatus: event.httpStatus ?? null })), retrievalEvent({
    sourceId: candidate.sourceId,
    url: candidate.sourceUrl,
    checkedAt,
    generatedAt: candidate.sourceGeneratedAt,
    contentSha256: candidate.retrieval.contentSha256,
    httpStatus: candidate.retrieval.httpStatus,
    etag: candidate.retrieval.etag,
    lastModified: candidate.retrieval.lastModified,
    rowCount: candidate.rowCount,
    outcome: 'approved-candidate',
    reviewer,
  }))
  const previousMetadata = oldDataset
  const previousFingerprint = oldDataset ? fingerprint(oldDataset.observations as unknown as Array<Record<string, any>>) : null
  const currentFingerprint = fingerprint(observations as unknown as Array<Record<string, any>>)
  const revisionEvents = buildRevisionEvents(oldDataset?.observations ?? [], observations, sha256(`${candidate.retrieval.contentSha256}:${currentFingerprint}`), checkedAt)
  const events = mergeRevisionEvents(previousRevisions?.events ?? [], revisionEvents)
  const hasDataChange = previousFingerprint !== currentFingerprint
  const revisionId = `dsv1.1-${createHash('sha256').update(`${candidate.retrieval.contentSha256}:${currentFingerprint}`).digest('hex').slice(0, 16)}`
  const dataset = DatasetSchema.parse({
    schemaVersion: 1,
    revisionId,
    lastDataChangeAt: hasDataChange ? checkedAt : previousMetadata?.lastDataChangeAt ?? checkedAt,
    lastSuccessfulCheckAt: checkedAt,
    sourceStatus: 'current',
    sourceNote: 'Last successful upstream check is recorded separately from the last data change. Feed duration is a reported mean per scored attempt with unspecified timer boundaries; the source-check date is not an end-to-end timing guarantee.',
    sourceRetrieval: {
      sourceId: candidate.sourceId,
      url: candidate.sourceUrl,
      generatedAt: candidate.sourceGeneratedAt,
      retrievedAt: candidate.retrieval.retrievedAt,
      contentSha256: candidate.retrieval.contentSha256,
      httpStatus: candidate.retrieval.httpStatus,
      etag: candidate.retrieval.etag,
      lastModified: candidate.retrieval.lastModified,
      rowCount: candidate.rowCount,
    },
    observations,
  })

  await writeJsonAtomic('data/approved/dataset.json', dataset)
  await writeJsonAtomic('data/approved/revisions.json', { schemaVersion: 1, events })
  await writeJsonAtomic('data/approved/retrievals.json', { schemaVersion: 1, events: retrievals })
  await writeJsonAtomic('data/approved/source-health.json', {
    lastSuccessfulCheckAt: checkedAt,
    lastDataChangeAt: dataset.lastDataChangeAt,
    sourceStatus: 'checked-and-approved',
    revisionId,
    contentSha256: candidate.retrieval.contentSha256,
  })
  const manifest = await maybeReadJson<{ schemaVersion: number; revisions: Array<Record<string, unknown>> }>('data/snapshots/manifest.json')
  const manifestRevisions = manifest?.revisions ?? []
  if (!manifestRevisions.some((entry) => entry['revisionId'] === revisionId)) {
    manifestRevisions.push({ revisionId, approvedAt: checkedAt, contentSha256: candidate.retrieval.contentSha256, normalizedObservationCount: candidate.rowCount, approvedObservationCount: observations.length, sourceId: candidate.sourceId, snapshotFile: `datacurve-v1.1-${revisionId}.json` })
  }
  await writeJsonAtomic('data/snapshots/manifest.json', { schemaVersion: 1, revisions: manifestRevisions })
  await writeJsonAtomic('data/candidates/refresh-status.json', {
    status: 'approved',
    approvedAt: checkedAt,
    reviewer,
    revisionId,
    approvedObservationCount: observations.length,
    sourceChangeKinds: [...new Set(candidate.changeReport.changeKinds.map((change) => change.kind))],
    approvedSnapshotModified: true,
  })
  await writeJsonAtomic(`data/snapshots/datacurve-v1.1-${revisionId}.json`, {
    ...candidate,
    status: 'approved-source-snapshot',
    approval: { reviewer, approvedAt: checkedAt, revisionId },
  })
  await unlink(projectPath('data/candidates/datacurve-v1.1.json'))
  console.log(`Approved ${candidate.rowCount} official configurations and ${supplemental.length} separately attributed reports; revision ${revisionId}; ${events.length} retained revision events.`)
}

main().catch((error: unknown) => {
  console.error(`Candidate approval failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
