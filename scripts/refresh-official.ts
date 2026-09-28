import { z } from 'zod'
import { currentEffortMap, DATACURVE_FEED_URL, normalizeOfficialFeed, type OfficialFeed } from '../src/lib/normalize.ts'
import { assertNoSuspiciousRemoval, diffOfficialObservations } from '../src/lib/revisions.ts'
import { stageRefreshCandidate } from '../src/lib/refresh-safety.ts'
import { DatasetSchema, OfficialCandidateSchema } from '../src/lib/schema.ts'
import { maybeReadJson, projectPath, readJson, sha256, writeJsonAtomic } from './lib.ts'
import { rm } from 'node:fs/promises'

const MAX_RESPONSE_BYTES = 1_000_000
const MAX_ATTEMPTS = 3
const ApprovedForRefreshSchema = DatasetSchema
const FeedSchema = z.object({
  scope: z.string().min(1),
  unit: z.string().min(1),
  generated_at: z.string().datetime({ offset: true }),
  n_tasks_in_set: z.number().int().positive(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
}).passthrough()

type ApprovedSnapshot = z.infer<typeof ApprovedForRefreshSchema>

function getOfficialRows(dataset: ApprovedSnapshot | null) {
  return dataset?.observations.filter((observation) => observation.provenance.sourceId === 'datacurve-v1.1-json') ?? []
}

async function fetchFeed(etag: string | null): Promise<{ unchanged: true; retrievedAt: string; httpStatus: 304; etag: string | null; lastModified: string | null } | { unchanged: false; feed: OfficialFeed; retrieval: { retrievedAt: string; contentSha256: string; httpStatus: 200; etag: string | null; lastModified: string | null } }> {
  const allowlisted = new URL(DATACURVE_FEED_URL)
  if (allowlisted.hostname !== 'deepswe.datacurve.ai' || allowlisted.pathname !== '/artifacts/v1.1/leaderboard-live.json') {
    throw new Error('Configured feed URL is outside the Datacurve v1.1 allowlist.')
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (etag) headers['if-none-match'] = etag
      const response = await fetch(DATACURVE_FEED_URL, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      })
      if (response.status === 304) return {
        unchanged: true,
        retrievedAt: new Date().toISOString(),
        httpStatus: 304,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      }
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500))
          continue
        }
        throw new Error(`Feed request failed with HTTP ${response.status}.`)
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.toLowerCase().includes('application/json')) throw new Error(`Expected application/json; received ${contentType || 'no content type'}.`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error(`Feed body size ${bytes.byteLength} is empty or exceeds the 1 MB safety limit.`)
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('Feed response was not valid JSON.')
      }
      const feed = FeedSchema.parse(parsed) as OfficialFeed
      return {
        unchanged: false,
        feed,
        retrieval: {
          retrievedAt: new Date().toISOString(),
          contentSha256: sha256(bytes),
          httpStatus: 200,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
        },
      }
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Feed retrieval failed after bounded retries.')
}

async function main(): Promise<void> {
  const statusPath = 'data/candidates/refresh-status.json'
  const approvedValue = await maybeReadJson<unknown>('data/approved/dataset.json')
  const approved = approvedValue === null ? null : ApprovedForRefreshSchema.parse(approvedValue)
  const existingRetrieval = approved?.sourceRetrieval
  const startedAt = new Date().toISOString()
  const forceFetch = process.argv.includes('--force')
  const message = await stageRefreshCandidate(async () => {
    const fetched = await fetchFeed(forceFetch ? null : existingRetrieval?.etag ?? null)
    if (fetched.unchanged) {
      return {
        candidate: null,
        discardCandidate: true,
        status: {
          status: 'checked-unchanged',
          checkedAt: fetched.retrievedAt,
          sourceId: 'datacurve-v1.1-json',
          url: DATACURVE_FEED_URL,
          contentSha256: existingRetrieval?.contentSha256 ?? null,
          httpStatus: 304,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
          message: 'Conditional request returned 304; approved observations were not modified.',
          approvedSnapshotModified: false,
        },
        summary: 'Datacurve v1.1: checked unchanged (HTTP 304); approved snapshot retained.',
      }
    }

    const effortOrder = currentEffortMap(await readJson<unknown>('data/sources/effort-order.json'))
    const normalized = normalizeOfficialFeed(fetched.feed, fetched.retrieval, effortOrder)
    const currentRows = getOfficialRows(approved)
    const changeReport = diffOfficialObservations(currentRows, normalized.observations)
    assertNoSuspiciousRemoval(currentRows.length, normalized.rowCount)

    const candidate = OfficialCandidateSchema.parse({
      status: 'pending-review',
      sourceId: normalized.sourceId,
      sourceUrl: normalized.sourceUrl,
      sourceGeneratedAt: normalized.sourceGeneratedAt,
      retrieval: fetched.retrieval,
      rowCount: normalized.rowCount,
      unknownOptionalFields: normalized.unknownOptionalFields,
      changeReport,
      observations: normalized.observations,
    })
    const hasCandidateChanges = changeReport.addedIds.length > 0 || changeReport.changedIds.length > 0 || changeReport.disappearedIds.length > 0
    const statusValue = fetched.retrieval.contentSha256 === existingRetrieval?.contentSha256 && !hasCandidateChanges ? 'checked-unchanged' : 'candidate-ready'
    const status = {
      status: statusValue,
      checkedAt: fetched.retrieval.retrievedAt,
      sourceId: normalized.sourceId,
      url: normalized.sourceUrl,
      sourceGeneratedAt: normalized.sourceGeneratedAt,
      contentSha256: fetched.retrieval.contentSha256,
      httpStatus: fetched.retrieval.httpStatus,
      rowCount: normalized.rowCount,
      unknownOptionalFields: normalized.unknownOptionalFields,
      changes: candidate.changeReport,
      approvedSnapshotModified: false,
    }
    const statusLabel = status.status === 'checked-unchanged' ? 'checked unchanged' : 'candidate ready for review'
    return {
      candidate: statusValue === 'checked-unchanged' ? null : candidate,
      discardCandidate: statusValue === 'checked-unchanged',
      status,
      summary: `Datacurve v1.1: ${statusLabel}; ${normalized.rowCount} normalized rows; ${changeReport.addedIds.length} added, ${changeReport.changedIds.length} changed, ${changeReport.disappearedIds.length} disappeared; raw response not saved.`,
    }
  },
  (candidate) => writeJsonAtomic('data/candidates/datacurve-v1.1.json', candidate),
  (status) => writeJsonAtomic(statusPath, status),
  () => rm(projectPath('data/candidates/datacurve-v1.1.json'), { force: true }),
  (error) => ({
    status: 'failed',
    startedAt,
    failedAt: new Date().toISOString(),
    sourceId: 'datacurve-v1.1-json',
    url: DATACURVE_FEED_URL,
    diagnostic: error instanceof Error ? error.message : 'Unknown refresh error.',
    approvedSnapshotModified: false,
  }))
  console.log(message)
}

main().catch((error: unknown) => {
  console.error(`Official source refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
