export interface SourceRetrievalEvent {
  eventId: string
  sourceId: string
  url: string
  checkedAt: string
  generatedAt: string
  contentSha256: string
  httpStatus: 200 | 304 | null
  etag: string | null
  lastModified: string | null
  rowCount: number
  outcome: 'approved-candidate' | 'checked-unchanged'
  reviewer: string
}

export function mergeRetrievalEvents(previous: SourceRetrievalEvent[], next: SourceRetrievalEvent): SourceRetrievalEvent[] {
  if (previous.some((event) => event.eventId === next.eventId)) return previous
  return [...previous, next]
}

export function retrievalEvent(input: Omit<SourceRetrievalEvent, 'eventId'>): SourceRetrievalEvent {
  return { ...input, eventId: `${input.checkedAt}:${input.contentSha256}:${input.outcome}` }
}

export function recordUnchangedCheck(
  dataset: Dataset,
  checkedAt: string,
  contentSha256: string,
  httpStatus: 200 | 304,
  etag: string | null,
  lastModified: string | null,
): Dataset {
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('Source check time is invalid.')
  if (contentSha256 !== dataset.sourceRetrieval.contentSha256) throw new Error('Unchanged source hash does not match the approved snapshot.')
  return {
    ...dataset,
    lastSuccessfulCheckAt: checkedAt,
    sourceStatus: 'current',
    sourceRetrieval: {
      ...dataset.sourceRetrieval,
      retrievedAt: checkedAt,
      httpStatus,
      etag: etag ?? dataset.sourceRetrieval.etag,
      lastModified: lastModified ?? dataset.sourceRetrieval.lastModified,
    },
  }
}
import type { Dataset } from './schema'
