import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AA_COMPARISON_URLS,
  AA_FETCH_TIMEOUT_MS,
  AA_MAX_FETCH_ATTEMPTS,
  buildAaUsageRefreshConfig,
  fetchAaComparisonPage,
  refreshAaUsage,
  type AaPreviousUsageFact,
  type AaUsageCandidate,
} from '../scripts/refresh-aa-usage.ts'
import {
  parseAaUsageHtml,
  type AaReviewedTarget,
  type AaUsageSourcePage,
  type AaVariantIdentity,
} from '../scripts/lib/aa-usage-parser.ts'
import { readJson, sha256, writeJsonAtomic } from '../scripts/lib.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/aa-usage/${name}`, import.meta.url), 'utf8')
const successHtml = fixture('codex-success.html')
const responseHash = sha256(new TextEncoder().encode(successHtml))
const sourceRevision = 'fixture-research-revision-1'
const temporaryRoots: string[] = []

const identityA: AaVariantIdentity = {
  variantKey: 'aa-fixture-codex-a',
  displayLabel: 'Codex - Fixture A (max)',
  reportedModel: 'Fixture A',
  modelSnapshot: null,
  effort: 'max',
  rawSetting: 'max',
  fallback: false,
  harness: 'Codex',
  benchmarkVersion: '1.1',
  datasetIndexName: 'deep-swe-v1.1',
}

const identityB: AaVariantIdentity = {
  variantKey: 'aa-fixture-codex-b-fallback',
  displayLabel: 'Codex - Fixture B (max) (with fallback)',
  reportedModel: 'Fixture B',
  modelSnapshot: null,
  effort: 'max',
  rawSetting: 'max',
  fallback: true,
  harness: 'Codex',
  benchmarkVersion: '1.1',
  datasetIndexName: 'deep-swe-v1.1',
}

const targetA: AaReviewedTarget = {
  factId: 'aa-fixture-a-output',
  targetObservationId: 'observation-fixture-a',
  sourceId: 'aa-fixture-source',
  identity: identityA,
}

const targetB: AaReviewedTarget = {
  factId: 'aa-fixture-b-output',
  targetObservationId: 'observation-fixture-b',
  sourceId: 'aa-fixture-source',
  identity: identityB,
}

const identityPaths = {
  sourceVariantId: 'id',
  displayLabel: 'displayLabel',
  harness: 'agentName',
  displayAgent: 'display.agent',
  displayModel: 'display.model',
}

const page: AaUsageSourcePage = {
  url: AA_COMPARISON_URLS[0],
  sourceRevision,
  identityPaths,
  targets: [targetA, targetB],
}

function locator(target: AaReviewedTarget, sourceVariantId: string): string {
  return `variants[id=${JSON.stringify(sourceVariantId)}][displayLabel=${JSON.stringify(target.identity.displayLabel)}].evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens`
}

function previousFact(
  target: AaReviewedTarget,
  value: number,
  hash = responseHash,
  sourceVariantId = target === targetA ? 'source-fixture-id-a' : 'source-fixture-id-b',
): AaPreviousUsageFact {
  return {
    id: target.factId,
    targetObservationId: target.targetObservationId,
    identity: {
      sourceId: target.sourceId,
      variantKey: target.identity.variantKey,
      displayLabel: target.identity.displayLabel,
      reportedModel: target.identity.reportedModel,
      snapshot: target.identity.modelSnapshot,
      effort: target.identity.effort,
      rawSetting: target.identity.rawSetting,
      harness: target.identity.harness,
      benchmarkVersion: target.identity.benchmarkVersion,
      datasetIndexName: target.identity.datasetIndexName,
    },
    metric: 'outputTokens',
    value,
    missingReason: null,
    unit: 'AA DeepSWE v1.1 output tokens per task attempt',
    statistic: 'mean',
    definition: 'Exact public AA variant evals[datasetIndexName=deep-swe-v1.1].mean.outputTokens.',
    population: 'Artificial Analysis DeepSWE v1.1 variant evaluation; output-specific telemetry count is not published.',
    sampleCount: null,
    includesReasoningTokens: null,
    timingBoundaries: null,
    pricingBasis: null,
    relationship: 'same-source-same-benchmark-reference',
    sourceIds: [target.sourceId],
    evidence: {
      url: page.url,
      retrievedAt: '2026-10-01T00:00:00.000Z',
      locator: locator(target, sourceVariantId),
      responseSha256: hash,
      hashStatus: 'validated',
      sourceRevision,
      approvedDatasetRevision: null,
      caveats: [
        'Output-specific telemetry count and reasoning-token inclusion are unspecified.',
      ],
    },
  }
}

function config(previousFacts: AaPreviousUsageFact[] = [], previousNumericRevision: string | null = null) {
  return {
    schemaVersion: 1 as const,
    pages: [page],
    previousFacts,
    previousNumericRevision,
  }
}

async function readResearchBundle() {
  const [usageResearch, metaResearch, chineseResearch] = await Promise.all([
    readJson<unknown>('data/research/usage-proxy-cross-platform-20260927.json'),
    readJson<unknown>('data/research/inference-meta-google-xai.json'),
    readJson<unknown>('data/research/inference-chinese-models.json'),
  ])
  return { usageResearch, metaResearch, chineseResearch }
}

function response(html: string, status = 200, contentType = 'text/html; charset=utf-8'): Response {
  return new Response(html, { status, headers: { 'content-type': contentType } })
}

function mockDependencies(fetcher: typeof fetch) {
  const existingCandidate = { kind: 'older-valid-aa-proposal', generation: 3 }
  let candidate: unknown = existingCandidate
  let status: Record<string, unknown> | null = null
  const writeCandidate = vi.fn(async (next: AaUsageCandidate) => { candidate = next })
  const writeStatus = vi.fn(async (next: Record<string, unknown>) => { status = next })
  return {
    existingCandidate,
    get candidate() { return candidate },
    get status() { return status },
    writeCandidate,
    writeStatus,
    dependencies: {
      fetcher,
      sleep: async () => undefined,
      now: () => new Date('2026-10-04T12:00:00.000Z'),
      writeCandidate,
      writeStatus,
    },
  }
}

function actualCodexSolTarget(): AaReviewedTarget {
  return {
    factId: 'aa-output-gpt-6-sol-max',
    targetObservationId: 'aa-codex-gpt-6-sol-max-v1.1',
    sourceId: 'aa-codex-vs-kimi-code-cli',
    identity: {
      variantKey: 'codex-gpt-6-sol-max',
      displayLabel: 'Codex - GPT-6 Sol (max)',
      reportedModel: 'GPT-6 Sol',
      modelSnapshot: null,
      effort: 'max',
      rawSetting: 'max',
      fallback: false,
      harness: 'Codex',
      benchmarkVersion: '1.1',
      datasetIndexName: 'deep-swe-v1.1',
    },
  }
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).__aaUsageFixtureSideEffect
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('AA serialized HTML parser', () => {
  it('parses a real Next Flight snippet without executing script code and selects only the reviewed DeepSWE output mean', () => {
    const actualPage: AaUsageSourcePage = {
      url: AA_COMPARISON_URLS[0],
      sourceRevision: 'AA-public-serialized-html-2026-10-04',
      identityPaths,
      targets: [actualCodexSolTarget()],
    }
    const parsed = parseAaUsageHtml(fixture('codex-next-flight-extract.html'), actualPage)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.sourceVariantId).toBe('7a0dfd2a7a9d93056f860d4675586d66')
    expect(parsed[0]?.value).toBe(70300.33038348083)
    expect(parsed[0]?.locator).toContain('evals[datasetIndexName="deep-swe-v1.1"].mean.outputTokens')
  })

  it('batches exact reviewed variants from serialized JSON scripts and ignores suite-level output decoys', () => {
    const parsed = parseAaUsageHtml(successHtml, page)
    expect(parsed.map(({ factId, value }) => [factId, value])).toEqual([
      ['aa-fixture-a-output', 410.5],
      ['aa-fixture-b-output', 520.75],
    ])
    expect(parsed.map(({ sourceVariantId }) => sourceVariantId)).toEqual(['source-fixture-id-a', 'source-fixture-id-b'])
    expect(parsed.some((fact) => 'cost' in fact || 'time' in fact)).toBe(false)
    expect((globalThis as unknown as Record<string, unknown>).__aaUsageFixtureSideEffect).toBeUndefined()
  })

  it.each([
    ['display label', { displayLabel: 'Codex - Fixture A (xhigh)' }],
    ['reported model', { reportedModel: 'Fixture A New' }],
    ['snapshot', { modelSnapshot: 'fixture-a-new' }],
    ['effort', { effort: 'xhigh' }],
    ['raw setting', { rawSetting: 'xhigh' }],
    ['fallback', { fallback: true }],
    ['harness', { harness: 'mini-swe-agent' }],
  ])('rejects a wrong reviewed %s instead of using a near variant', (_label, patch) => {
    const wrongTarget = { ...targetA, identity: { ...identityA, ...patch } }
    expect(() => parseAaUsageHtml(successHtml, { ...page, targets: [wrongTarget] })).toThrow()
  })

  it('rejects duplicate reviewed variants and duplicate matching benchmark evals', () => {
    expect(() => parseAaUsageHtml(fixture('codex-ambiguous.html'), { ...page, targets: [targetA] })).toThrow(/ambiguous/)
    expect(() => parseAaUsageHtml(fixture('codex-duplicate-eval.html'), { ...page, targets: [targetA] })).toThrow(/exactly one is required/)
  })

  it('rejects missing, malformed, null and nonfinite benchmark values without suite fallback', () => {
    expect(() => parseAaUsageHtml(fixture('codex-missing-eval.html'), { ...page, targets: [targetA] })).toThrow(/has no deep-swe-v1\.1 eval/)
    expect(() => parseAaUsageHtml(fixture('codex-malformed.html'), { ...page, targets: [targetA] })).toThrow(/serialized JSON is malformed/)

    const nullOutput = successHtml.replace('"outputTokens":410.5', '"outputTokens":null')
    expect(() => parseAaUsageHtml(nullOutput, { ...page, targets: [targetA] })).toThrow(/invalid .*outputTokens value/)
    const infiniteOutput = successHtml.replace('"outputTokens":410.5', '"outputTokens":1e999')
    expect(() => parseAaUsageHtml(infiniteOutput, { ...page, targets: [targetA] })).toThrow(/invalid .*outputTokens value/)
    const suiteOnly = fixture('codex-missing-eval.html').replace('"datasetIndexName":"terminal-bench-4.0"', '"datasetIndexName":"other-suite"')
    expect(() => parseAaUsageHtml(suiteOnly, { ...page, targets: [targetA] })).toThrow(/has no deep-swe-v1\.1 eval/)
  })
})

describe('authoritative AA facts/config integration', () => {
  it('derives exact refresh targets from usageFacts and validates scenarioConfig links without a duplicated target list', async () => {
    const bundle = await readResearchBundle()
    const refreshConfig = buildAaUsageRefreshConfig(bundle)
    const source = bundle.usageResearch as {
      usageFacts: Array<{ id: string; metric: string; identity: { datasetIndexName: string }; evidence: { url: string } }>
    }
    const authoritativeFactIds = source.usageFacts
      .filter((fact) => fact.metric === 'outputTokens' && fact.identity.datasetIndexName === 'deep-swe-v1.1' && AA_COMPARISON_URLS.includes(fact.evidence.url as typeof AA_COMPARISON_URLS[number]))
      .map((fact) => fact.id)
      .sort()
    const configuredFactIds = refreshConfig.pages.flatMap((pageConfig) => pageConfig.targets.map((target) => target.factId)).sort()

    expect(configuredFactIds).toEqual(authoritativeFactIds)
    expect(new Set(configuredFactIds).size).toBe(configuredFactIds.length)
    expect(refreshConfig.pages.every((pageConfig) => pageConfig.targets.length > 0)).toBe(true)
  })

  it('rejects missing, empty, or unrelated fact sourceIds even when scenarioConfig names the identity source', async () => {
    type DirectFact = { id: string; targetObservationId: string; sourceIds: string[]; identity: { sourceId: string } }
    type ResearchShape = {
      usageFacts: DirectFact[]
      scenarioConfig: { targets: Array<{ observationId: string; metrics: { outputTokens: { sourceIds: string[] } } }> }
    }
    const original = await readResearchBundle()

    const empty = structuredClone(original)
    const emptyResearch = empty.usageResearch as ResearchShape
    emptyResearch.usageFacts[0]!.sourceIds = []
    expect(() => buildAaUsageRefreshConfig(empty)).toThrow(/source IDs/)

    const identityMissing = structuredClone(original)
    const identityMissingResearch = identityMissing.usageResearch as ResearchShape
    identityMissingResearch.usageFacts[0]!.sourceIds = ['aa-claude-code-vs-codex']
    expect(() => buildAaUsageRefreshConfig(identityMissing)).toThrow(/source IDs/)

    const scenarioMismatch = structuredClone(original)
    const scenarioMismatchResearch = scenarioMismatch.usageResearch as ResearchShape
    const scenarioFact = scenarioMismatchResearch.usageFacts[0]!
    const scenarioTarget = scenarioMismatchResearch.scenarioConfig.targets.find((item) => item.observationId === scenarioFact.targetObservationId)!
    scenarioTarget.metrics.outputTokens.sourceIds = ['aa-claude-code-vs-codex']
    expect(() => buildAaUsageRefreshConfig(scenarioMismatch)).toThrow(/source IDs/)

    const unrelatedKnownSource = structuredClone(original)
    const changedResearch = unrelatedKnownSource.usageResearch as ResearchShape
    const firstFact = changedResearch.usageFacts[0]!
    const target = changedResearch.scenarioConfig.targets.find((item) => item.observationId === firstFact.targetObservationId)!
    firstFact.sourceIds = [firstFact.identity.sourceId, 'aa-claude-code-vs-codex']
    target.metrics.outputTokens.sourceIds = [...firstFact.sourceIds]
    expect(() => buildAaUsageRefreshConfig(unrelatedKnownSource)).toThrow(/source IDs/)
  })
})

describe('AA bounded comparison retrieval', () => {
  it('requires the exact HTTPS page allowlist, rejects redirects, sets a timeout, and hashes response bytes', async () => {
    const disallowedCalls: string[] = []
    const disallowedFetcher: typeof fetch = async (input) => {
      disallowedCalls.push(String(input))
      return response(successHtml)
    }
    await expect(fetchAaComparisonPage('https://artificialanalysis.ai/agents/other', { fetcher: disallowedFetcher })).rejects.toThrow(/allowlist/)
    expect(disallowedCalls).toHaveLength(0)

    let requestInit: RequestInit | undefined
    const okFetcher: typeof fetch = async (_input, init) => {
      requestInit = init
      return response(successHtml)
    }
    const fetched = await fetchAaComparisonPage(page.url, {
      fetcher: okFetcher,
      now: () => new Date('2026-10-04T12:34:56.000Z'),
    })
    expect(requestInit?.redirect).toBe('error')
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal)
    expect(AA_FETCH_TIMEOUT_MS).toBe(15_000)
    expect(fetched.retrieval.responseSha256).toBe(sha256(new TextEncoder().encode(successHtml)))
    expect(fetched.retrieval.retrievedAt).toBe('2026-10-04T12:34:56.000Z')

    const redirectFetcher: typeof fetch = async () => response('', 302)
    await expect(fetchAaComparisonPage(page.url, { fetcher: redirectFetcher, sleep: async () => undefined })).rejects.toThrow(/unexpected HTTP 302/)
  })

  it('bounds streamed response bytes and retries transient status failures only within the fixed attempt limit', async () => {
    let oversizedCalls = 0
    const oversizedFetcher: typeof fetch = async () => {
      oversizedCalls += 1
      return response('x'.repeat(21))
    }
    await expect(fetchAaComparisonPage(page.url, { fetcher: oversizedFetcher, maxResponseBytes: 20, sleep: async () => undefined })).rejects.toThrow(/exceeds the 20-byte limit/)
    expect(oversizedCalls).toBe(AA_MAX_FETCH_ATTEMPTS)

    let attempts = 0
    const retryFetcher: typeof fetch = async () => {
      attempts += 1
      return attempts === 1 ? response('temporary failure', 503) : response(successHtml)
    }
    const fetched = await fetchAaComparisonPage(page.url, { fetcher: retryFetcher, sleep: async () => undefined })
    expect(attempts).toBe(2)
    expect(fetched.retrieval.httpStatus).toBe(200)
  })

  it('aborts an in-flight request when the bounded timeout signal expires', async () => {
    let abortedRequests = 0
    const blockingFetcher: typeof fetch = async (_input, init) => {
      const signal = init?.signal
      if (!(signal instanceof AbortSignal)) throw new Error('The fetch did not receive an AbortSignal.')
      await new Promise<never>((_resolve, reject) => {
        const onAbort = () => {
          abortedRequests += 1
          reject(signal.reason ?? new Error('Request aborted.'))
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })
      throw new Error('The timed-out request unexpectedly resolved.')
    }

    await expect(fetchAaComparisonPage(page.url, {
      fetcher: blockingFetcher,
      sleep: async () => undefined,
      timeoutMs: 5,
    })).rejects.toThrow()
    expect(abortedRequests).toBe(AA_MAX_FETCH_ATTEMPTS)
  })
})

describe('AA usage reviewed refresh proposal', () => {
  it('stages a pending-review proposal with changed and removed fact IDs', async () => {
    const changedHtml = successHtml.replace('"outputTokens":520.75', '"outputTokens":521.75')
    const obsoleteTarget = { ...targetA, factId: 'aa-fixture-obsolete-output' }
    const oldFacts = [previousFact(targetA, 410.5), previousFact(targetB, 520.75), previousFact(obsoleteTarget, 100)]
    const oldFactsSnapshot = structuredClone(oldFacts)
    const store = mockDependencies(async () => response(changedHtml))

    const summary = await refreshAaUsage(config(oldFacts, 'old-numeric-revision'), store.dependencies)
    const candidate = store.candidate as AaUsageCandidate
    expect(summary).toContain('pending-review proposal')
    expect(store.writeCandidate).toHaveBeenCalledTimes(1)
    expect(candidate.kind).toBe('aa-usage-refresh-proposal')
    expect(candidate.status).toBe('pending-review')
    expect(candidate.approvedFactsModified).toBe(false)
    expect(candidate.officialCandidateModified).toBe(false)
    expect(candidate.facts.map((fact) => [fact.id, fact.value])).toEqual([
      ['aa-fixture-a-output', 410.5],
      ['aa-fixture-b-output', 521.75],
    ])
    expect(candidate.changes.changedFactIds).toEqual(['aa-fixture-b-output'])
    expect(candidate.changes.removedFactIds).toEqual(['aa-fixture-obsolete-output'])
    expect(candidate.facts.every((fact) => fact.evidence.responseSha256 === sha256(new TextEncoder().encode(changedHtml)))).toBe(true)
    expect(candidate.facts.every((fact) => fact.evidence.hashStatus === 'validated')).toBe(true)
    expect(candidate.facts.every((fact) => fact.identity.datasetIndexName === 'deep-swe-v1.1')).toBe(true)
    expect(candidate.facts.every((fact) => fact.sampleCount === null && fact.includesReasoningTokens === null)).toBe(true)
    expect(candidate.numericRevision).not.toBe('old-numeric-revision')
    expect(oldFacts).toEqual(oldFactsSnapshot)
    expect(store.status?.approvedFactsModified).toBe(false)
  })

  it('keeps an unchanged numeric revision and writes only check status when response facts are unchanged', async () => {
    const previousFacts = [previousFact(targetA, 410.5), previousFact(targetB, 520.75)]
    const priorNumericRevision = 'preserve-this-numeric-revision'
    const store = mockDependencies(async () => response(successHtml))
    const summary = await refreshAaUsage(config(previousFacts, priorNumericRevision), store.dependencies)

    expect(summary).toContain('checked unchanged')
    expect(store.writeCandidate).not.toHaveBeenCalled()
    expect(store.candidate).toBe(store.existingCandidate)
    expect(store.status?.status).toBe('checked-unchanged')
    expect(store.status?.numericRevision).toBe(priorNumericRevision)
    expect(store.status?.approvedFactsModified).toBe(false)
  })

  it.each([
    ['fetch', async () => { throw new TypeError('fixture network failure') }],
    ['parse', async () => response(fixture('codex-malformed.html'))],
  ])('preserves the prior valid proposal and source facts on %s failure', async (_kind, fetchImplementation) => {
    const previousFacts = [previousFact(targetA, 410.5), previousFact(targetB, 520.75)]
    const previousSnapshot = structuredClone(previousFacts)
    const store = mockDependencies(async () => fetchImplementation() as Promise<Response>)
    const oldCandidateRef = store.candidate
    await expect(refreshAaUsage(config(previousFacts, 'stable-revision'), store.dependencies)).rejects.toThrow()

    expect(store.writeCandidate).not.toHaveBeenCalled()
    expect(store.candidate).toBe(oldCandidateRef)
    expect(store.status?.status).toBe('failed')
    expect(store.status?.existingProposalPreserved).toBe(true)
    expect(store.status?.approvedFactsModified).toBe(false)
    expect(store.status?.officialCandidateModified).toBe(false)
    expect(previousFacts).toEqual(previousSnapshot)
  })

  it.each([
    ['missing', async () => { throw Object.assign(new Error('source artifact not found'), { code: 'ENOENT' }) }],
    ['invalid JSON', async () => { throw new SyntaxError('source artifact is not valid JSON') }],
  ])('records a separate failure status for a %s source artifact load error', async (_kind, loadResearch) => {
    const store = mockDependencies(async () => { throw new Error('No network request should occur before config loads.') })
    const previousCandidateRef = store.candidate
    await expect(refreshAaUsage(loadResearch, store.dependencies)).rejects.toThrow()

    expect(store.writeCandidate).not.toHaveBeenCalled()
    expect(store.candidate).toBe(previousCandidateRef)
    expect(store.status?.status).toBe('failed')
    expect(store.status?.sourceArtifactPaths).toContain('data/research/usage-proxy-cross-platform-20260927.json')
    expect(store.status?.sourceArtifactPaths).toContain('data/research/inference-chinese-models.json')
    expect(store.status?.existingProposalPreserved).toBe(true)
    expect(store.status?.approvedFactsModified).toBe(false)
  })

  it('preserves real candidate and approved files on a source JSON load failure using only temporary paths', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aa-usage-refresh-lkg-'))
    temporaryRoots.push(root)
    const candidatePath = join(root, 'aa-usage-v1.1.json')
    const statusPath = join(root, 'aa-usage-refresh-status.json')
    const approvedPath = join(root, 'approved-facts.json')
    const priorCandidate = { kind: 'aa-usage-refresh-proposal', status: 'pending-review', facts: [{ id: 'lkg-fact', value: 123 }] }
    const approvedFacts = { revision: 'approved-baseline', facts: [{ id: 'approved-fact', value: 456 }] }
    writeFileSync(candidatePath, `${JSON.stringify(priorCandidate, null, 2)}\n`)
    writeFileSync(approvedPath, `${JSON.stringify(approvedFacts, null, 2)}\n`)
    const candidateBefore = readFileSync(candidatePath, 'utf8')
    const approvedBefore = readFileSync(approvedPath, 'utf8')

    await expect(refreshAaUsage(async () => {
      throw new SyntaxError('simulated invalid research JSON')
    }, {
      fetcher: async () => { throw new Error('No network request should occur before config loads.') },
      now: () => new Date('2026-10-04T12:00:00.000Z'),
      writeCandidate: (candidate) => writeJsonAtomic(candidatePath, candidate),
      writeStatus: (status) => writeJsonAtomic(statusPath, status),
    })).rejects.toThrow(/simulated invalid research JSON/)

    expect(readFileSync(candidatePath, 'utf8')).toBe(candidateBefore)
    expect(readFileSync(approvedPath, 'utf8')).toBe(approvedBefore)
    const status = JSON.parse(readFileSync(statusPath, 'utf8')) as Record<string, unknown>
    expect(status.status).toBe('failed')
    expect(status.existingProposalPreserved).toBe(true)
    expect(status.approvedFactsModified).toBe(false)
  })
})
