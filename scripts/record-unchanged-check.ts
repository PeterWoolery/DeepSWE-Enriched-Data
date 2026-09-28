import { DatasetSchema } from '../src/lib/schema.ts'
import { mergeRetrievalEvents, recordUnchangedCheck, retrievalEvent, type SourceRetrievalEvent } from '../src/lib/retrieval.ts'
import { maybeReadJson, readJson, writeJsonAtomic } from './lib.ts'

async function main() {
  const args = process.argv.slice(2)
  const reviewerIndex = args.indexOf('--reviewer')
  const reviewer = reviewerIndex >= 0 ? args[reviewerIndex + 1] : null
  if (!reviewer || reviewer.startsWith('--')) throw new Error('Pass --reviewer <name-or-maintainer-id>.')
  if (!args.includes('--confirm-unchanged')) throw new Error('Only a verified unchanged-source result can update approved freshness metadata; pass --confirm-unchanged.')

  const status = await readJson<Record<string, unknown>>('data/candidates/refresh-status.json')
  if (status.status !== 'checked-unchanged' || status.approvedSnapshotModified !== false) {
    throw new Error('Refresh status is not a successful unchanged check; approved data was not modified.')
  }
  const dataset = DatasetSchema.parse(await readJson<unknown>('data/approved/dataset.json'))
  const checkedAt = String(status.checkedAt ?? '')
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('Unchanged check has no valid retrieval timestamp.')
  if (typeof status.contentSha256 !== 'string') throw new Error('Unchanged source response is missing its approved content hash.')
  if (status.httpStatus !== 200 && status.httpStatus !== 304) throw new Error('Unchanged check has no verified HTTP status.')
  const nextDataset = DatasetSchema.parse(recordUnchangedCheck(
    dataset,
    checkedAt,
    status.contentSha256,
    status.httpStatus,
    typeof status.etag === 'string' ? status.etag : null,
    typeof status.lastModified === 'string' ? status.lastModified : null,
  ))
  const previousEvents = await maybeReadJson<{ schemaVersion: number; events: SourceRetrievalEvent[] }>('data/approved/retrievals.json') ?? { schemaVersion: 1, events: [] }
  const event = retrievalEvent({
    sourceId: dataset.sourceRetrieval.sourceId,
    url: dataset.sourceRetrieval.url,
    checkedAt,
    generatedAt: dataset.sourceRetrieval.generatedAt,
    contentSha256: dataset.sourceRetrieval.contentSha256,
    httpStatus: status.httpStatus,
    etag: nextDataset.sourceRetrieval.etag,
    lastModified: nextDataset.sourceRetrieval.lastModified,
    rowCount: dataset.sourceRetrieval.rowCount,
    outcome: 'checked-unchanged',
    reviewer,
  })
  const events = mergeRetrievalEvents(previousEvents.events.map((previousEvent) => ({ ...previousEvent, httpStatus: previousEvent.httpStatus ?? null })), event)
  await writeJsonAtomic('data/approved/dataset.json', nextDataset)
  await writeJsonAtomic('data/approved/retrievals.json', { schemaVersion: 1, events })
  await writeJsonAtomic('data/approved/source-health.json', {
    lastSuccessfulCheckAt: checkedAt,
    lastDataChangeAt: dataset.lastDataChangeAt,
    sourceStatus: 'checked-and-approved',
    revisionId: dataset.revisionId,
    contentSha256: dataset.sourceRetrieval.contentSha256,
  })
  await writeJsonAtomic('data/candidates/refresh-status.json', {
    ...status,
    status: 'checked-unchanged-recorded',
    recordedAt: new Date().toISOString(),
    reviewer,
    approvedSnapshotModified: true,
    numericObservationsChanged: false,
  })
  console.log(`Recorded unchanged source check ${checkedAt} as metadata-only approval; revision ${dataset.revisionId} and all numeric observations are unchanged.`)
}

main().catch((error: unknown) => {
  console.error(`Unchanged-check recording failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
