export interface RefreshStageResult<T> {
  candidate: T | null
  discardCandidate?: boolean
  status: Record<string, unknown>
  summary: string
}

/**
 * Stage a fully prepared candidate only after retrieval, normalization, schema
 * validation, and safety checks finish. There is intentionally no approved
 * data writer in this boundary.
 */
export async function stageRefreshCandidate<T>(
  prepare: () => Promise<RefreshStageResult<T>>,
  writeCandidate: (candidate: T) => Promise<void>,
  writeStatus: (status: Record<string, unknown>) => Promise<void>,
  clearCandidate: () => Promise<void> = async () => undefined,
  failureStatus: (error: unknown) => Record<string, unknown> = (error) => ({
    status: 'failed',
    failedAt: new Date().toISOString(),
    diagnostic: error instanceof Error ? error.message : 'Unknown refresh error.',
    approvedSnapshotModified: false,
  }),
): Promise<string> {
  try {
    const result = await prepare()
    if (result.discardCandidate) await clearCandidate()
    else if (result.candidate !== null) await writeCandidate(result.candidate)
    await writeStatus(result.status)
    return result.summary
  } catch (error) {
    await writeStatus(failureStatus(error))
    throw error
  }
}
