import { OfficialCandidateSchema } from '../src/lib/schema.ts'
import { maybeReadJson, readJson } from './lib.ts'

async function main() {
  const value = await maybeReadJson<unknown>('data/candidates/datacurve-v1.1.json')
  if (value === null) {
    const status = await readJson<Record<string, unknown>>('data/candidates/refresh-status.json')
    if (status.status === 'checked-unchanged' || status.status === 'checked-unchanged-recorded' || status.status === 'approved') {
      console.log(`No pending official candidate; latest refresh status is ${String(status.status)}.`)
      return
    }
    throw new Error(`No official candidate file exists for refresh status ${String(status.status)}.`)
  }
  const candidate = OfficialCandidateSchema.parse(value)
  if (candidate.sourceId !== 'datacurve-v1.1-json' || candidate.sourceUrl !== 'https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json') {
    throw new Error('Candidate source does not match the fixed Datacurve v1.1 allowlist.')
  }
  if (candidate.observations.some((observation) => observation.provenance.sourceId !== candidate.sourceId)) {
    throw new Error('Candidate includes an observation from a source outside the allowlist.')
  }
  if (candidate.observations.some((observation) => observation.id.startsWith('fixture-') || observation.id.startsWith('synthetic-'))) {
    throw new Error('Synthetic observations cannot appear in an official candidate.')
  }
  console.log(`Validated ${candidate.rowCount} source-allowlisted configurations in pending candidate ${candidate.retrieval.contentSha256}; approved snapshot remains separate.`)
}

main().catch((error: unknown) => {
  console.error(`Candidate validation failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
