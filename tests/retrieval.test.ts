import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DatasetSchema } from '../src/lib/schema'
import { mergeRetrievalEvents, recordUnchangedCheck, retrievalEvent } from '../src/lib/retrieval'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))

describe('approved source-check freshness', () => {
  it('updates only check/retrieval metadata for a matching unchanged content hash', () => {
    const checkedAt = '2026-09-27T17:37:00.000Z'
    const next = recordUnchangedCheck(dataset, checkedAt, dataset.sourceRetrieval.contentSha256, 304, null, null)
    expect(next.lastSuccessfulCheckAt).toBe(checkedAt)
    expect(next.lastDataChangeAt).toBe(dataset.lastDataChangeAt)
    expect(next.revisionId).toBe(dataset.revisionId)
    expect(next.observations).toBe(dataset.observations)
    expect(next.sourceRetrieval.retrievedAt).toBe(checkedAt)
  })

  it('rejects mismatched checks and deduplicates repeated retrieval events', () => {
    expect(() => recordUnchangedCheck(dataset, '2026-09-27T17:37:00Z', 'f'.repeat(64), 304, null, null)).toThrow('does not match')
    const event = retrievalEvent({
      sourceId: dataset.sourceRetrieval.sourceId,
      url: dataset.sourceRetrieval.url,
      checkedAt: dataset.lastSuccessfulCheckAt,
      generatedAt: dataset.sourceRetrieval.generatedAt,
      contentSha256: dataset.sourceRetrieval.contentSha256,
      httpStatus: 304,
      etag: dataset.sourceRetrieval.etag,
      lastModified: dataset.sourceRetrieval.lastModified,
      rowCount: dataset.sourceRetrieval.rowCount,
      outcome: 'checked-unchanged',
      reviewer: 'test',
    })
    expect(mergeRetrievalEvents([event], event)).toHaveLength(1)
  })
})
