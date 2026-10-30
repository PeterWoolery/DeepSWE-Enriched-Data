import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stageRefreshCandidate } from '../src/lib/refresh-safety.ts'
import {
  AA_DEEP_SWE_DATASET_INDEX,
  parseAaUsageHtml,
  validateAaUsageSourcePage,
  type AaReviewedTarget,
  type AaUsageSourcePage,
  type AaVariantIdentity,
} from './lib/aa-usage-parser.ts'
import { readJson, sha256, stableJson, writeJsonAtomic } from './lib.ts'

export const AA_COMPARISON_URLS = [
  'https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-kimi-code-cli',
  'https://artificialanalysis.ai/agents/coding-agents/comparisons/claude-code-vs-codex',
  'https://artificialanalysis.ai/agents/coding-agents/comparisons/grok-build-vs-muse-code',
] as const

export const AA_MAX_FETCH_ATTEMPTS = 3
export const AA_FETCH_TIMEOUT_MS = 15_000
export const AA_MAX_RESPONSE_BYTES = 1_000_000

const RESEARCH_PATH = 'data/research/usage-proxy-cross-platform-20260927.json'
const META_RESEARCH_PATH = 'data/research/inference-meta-google-xai.json'
const CHINESE_RESEARCH_PATH = 'data/research/inference-chinese-models.json'
const RESEARCH_INPUT_PATHS = [RESEARCH_PATH, META_RESEARCH_PATH, CHINESE_RESEARCH_PATH]
const CANDIDATE_PATH = 'data/candidates/aa-usage-v1.1.json'
const STATUS_PATH = 'data/candidates/aa-usage-refresh-status.json'
const SOURCE_ID = 'artificial-analysis-coding-agent-html'
const ALLOWED_AA_URLS = new Set<string>(AA_COMPARISON_URLS)
const NEXT_FLIGHT_IDENTITY_PATHS = {
  sourceVariantId: 'id',
  displayLabel: 'displayLabel',
  harness: 'agentName',
  displayAgent: 'display.agent',
  displayModel: 'display.model',
}

export interface AaResearchIdentity extends Record<string, unknown> {
  sourceId: string
  variantKey: string
  displayLabel: string
  reportedModel: string
  snapshot: string | null
  effort: string | null
  rawSetting: string | null
  harness: string
  benchmarkVersion: string
  datasetIndexName: typeof AA_DEEP_SWE_DATASET_INDEX
}

export interface AaResearchEvidence extends Record<string, unknown> {
  url: string
  retrievedAt: string
  locator: string
  responseSha256: string | null
  hashStatus: string
  sourceRevision: string | null
  approvedDatasetRevision: string | null
  caveats: string[]
}

/** The read-only research-fact shape, preserved in the review candidate. */
export interface AaPreviousUsageFact extends Record<string, unknown> {
  id: string
  targetObservationId: string
  identity: AaResearchIdentity
  metric: 'outputTokens'
  value: number | null
  missingReason: string | null
  unit: string
  statistic: string
  definition: string
  population: string | null
  sampleCount: number | null
  includesReasoningTokens: boolean | null
  timingBoundaries: string | null
  pricingBasis: string | null
  relationship: string
  sourceIds: string[]
  evidence: AaResearchEvidence
}

export interface AaUsageFact extends AaPreviousUsageFact {
  value: number
  missingReason: null
  evidence: AaResearchEvidence & {
    responseSha256: string
    hashStatus: 'validated'
    retrievedAt: string
    locator: string
  }
}

export interface AaUsageRefreshConfig {
  schemaVersion: 1
  pages: AaUsageSourcePage[]
  previousFacts: AaPreviousUsageFact[]
  previousNumericRevision: string | null
}

export interface AaUsagePageRetrieval {
  url: string
  retrievedAt: string
  responseSha256: string
  httpStatus: 200
  byteLength: number
}

export interface AaUsageCandidate {
  schemaVersion: 1
  kind: 'aa-usage-refresh-proposal'
  status: 'pending-review'
  sourceId: typeof SOURCE_ID
  checkedAt: string
  numericRevision: string
  pages: Array<{
    url: string
    sourceRevision: string | null
    retrievedAt: string
    responseSha256: string
    byteLength: number
    targetCount: number
  }>
  changes: AaUsageDiff
  facts: AaUsageFact[]
  approvedFactsModified: false
  officialCandidateModified: false
}

export interface AaUsageDiff {
  addedFactIds: string[]
  changedFactIds: string[]
  removedFactIds: string[]
  provenanceChangedFactIds: string[]
  unchangedFactIds: string[]
}

export interface AaUsageRefreshDependencies {
  writeCandidate(candidate: AaUsageCandidate): Promise<void>
  writeStatus(status: Record<string, unknown>): Promise<void>
  fetcher?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => Date
  maxResponseBytes?: number
  timeoutMs?: number
}

export interface FetchedAaPage {
  html: string
  retrieval: AaUsagePageRetrieval
}

interface FetchOptions {
  fetcher?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => Date
  maxResponseBytes?: number
  timeoutMs?: number
}

export interface AaUsageResearchBundle {
  usageResearch: unknown
  metaResearch: unknown
  chineseResearch: unknown
}

export type AaUsageInputLoader = () => Promise<unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAaComparisonUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !ALLOWED_AA_URLS.has(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
      && parsed.hostname === 'artificialanalysis.ai'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.search === ''
      && parsed.hash === ''
  } catch {
    return false
  }
}

function assertAaComparisonUrl(value: unknown): asserts value is string {
  if (!isAaComparisonUrl(value)) throw new Error('AA refresh URL is outside the exact HTTPS comparison-page allowlist.')
}

function assertFactIdentity(value: unknown, label: string): asserts value is AaResearchIdentity {
  if (!isRecord(value)) throw new Error(`${label} has no reviewed identity.`)
  for (const field of ['sourceId', 'variantKey', 'displayLabel', 'reportedModel', 'harness', 'benchmarkVersion'] as const) {
    if (typeof value[field] !== 'string' || value[field].length === 0) throw new Error(`${label} has an invalid identity.${field}.`)
  }
  if (value.snapshot !== null) throw new Error(`${label} supplies a non-null snapshot not supported by the AA public variant record.`)
  for (const field of ['effort', 'rawSetting'] as const) {
    if (value[field] !== null && typeof value[field] !== 'string') throw new Error(`${label} has an invalid identity.${field}.`)
  }
  if (value.benchmarkVersion !== '1.1' || value.datasetIndexName !== AA_DEEP_SWE_DATASET_INDEX) {
    throw new Error(`${label} is not an exact AA DeepSWE v1.1 fact.`)
  }
}

function assertPreviousFact(value: unknown, index: number): asserts value is AaPreviousUsageFact {
  const label = `AA usage fact ${index + 1}`
  if (!isRecord(value)) throw new Error(`${label} is invalid.`)
  if (typeof value.id !== 'string' || value.id.length === 0) throw new Error(`${label} has an invalid id.`)
  if (typeof value.targetObservationId !== 'string' || value.targetObservationId.length === 0) throw new Error(`${label} has an invalid target observation ID.`)
  assertFactIdentity(value.identity, label)
  if (value.metric !== 'outputTokens') throw new Error(`${label} is not an outputTokens fact.`)
  if (value.value !== null && (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0)) {
    throw new Error(`${label} has an invalid value.`)
  }
  if (value.missingReason !== null && typeof value.missingReason !== 'string') throw new Error(`${label} has an invalid missingReason.`)
  for (const field of ['unit', 'statistic', 'definition', 'relationship'] as const) {
    if (typeof value[field] !== 'string' || value[field].length === 0) throw new Error(`${label} has an invalid ${field}.`)
  }
  if (value.population !== null && typeof value.population !== 'string') throw new Error(`${label} has an invalid population.`)
  if (value.sampleCount !== null && (typeof value.sampleCount !== 'number' || !Number.isFinite(value.sampleCount) || value.sampleCount < 0)) {
    throw new Error(`${label} has an invalid sampleCount.`)
  }
  if (value.includesReasoningTokens !== null && typeof value.includesReasoningTokens !== 'boolean') {
    throw new Error(`${label} has an invalid reasoning-token flag.`)
  }
  if (value.timingBoundaries !== null && typeof value.timingBoundaries !== 'string') throw new Error(`${label} has invalid timing boundaries.`)
  if (value.pricingBasis !== null && typeof value.pricingBasis !== 'string') throw new Error(`${label} has invalid pricing basis.`)
  if (!Array.isArray(value.sourceIds) || value.sourceIds.length === 0
    || value.sourceIds.some((sourceId) => typeof sourceId !== 'string' || sourceId.length === 0)
    || new Set(value.sourceIds).size !== value.sourceIds.length
    || !value.sourceIds.includes(value.identity.sourceId)) {
    throw new Error(`${label} has invalid or incomplete source IDs.`)
  }
  if (!isRecord(value.evidence)) throw new Error(`${label} has invalid evidence.`)
  if (typeof value.evidence.url !== 'string' || !isAaComparisonUrl(value.evidence.url)) throw new Error(`${label} has a disallowed source URL.`)
  if (typeof value.evidence.retrievedAt !== 'string' || typeof value.evidence.locator !== 'string') throw new Error(`${label} has incomplete source evidence.`)
  if (value.evidence.sourceRevision !== null && typeof value.evidence.sourceRevision !== 'string') throw new Error(`${label} has an invalid source revision.`)
  if (value.evidence.approvedDatasetRevision !== null && typeof value.evidence.approvedDatasetRevision !== 'string') {
    throw new Error(`${label} has an invalid approved-dataset revision.`)
  }
  if (!Array.isArray(value.evidence.caveats) || value.evidence.caveats.some((caveat) => typeof caveat !== 'string')) {
    throw new Error(`${label} has invalid evidence caveats.`)
  }
  if (value.evidence.hashStatus === 'validated') {
    if (typeof value.evidence.responseSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(value.evidence.responseSha256)) {
      throw new Error(`${label} marks a malformed response hash as validated.`)
    }
  } else if (value.evidence.responseSha256 !== null && value.evidence.responseSha256 !== undefined) {
    throw new Error(`${label} has an unvalidated response hash in the active hash field.`)
  }
}

function identityForFact(fact: AaPreviousUsageFact): AaVariantIdentity {
  const fallback = fact.identity.displayLabel.endsWith('(with fallback)')
  return {
    variantKey: fact.identity.variantKey,
    displayLabel: fact.identity.displayLabel,
    reportedModel: fact.identity.reportedModel,
    modelSnapshot: fact.identity.snapshot,
    effort: fact.identity.effort,
    rawSetting: fact.identity.rawSetting,
    fallback,
    harness: fact.identity.harness,
    benchmarkVersion: fact.identity.benchmarkVersion,
    datasetIndexName: fact.identity.datasetIndexName,
  }
}

function sameStringSet(actual: string[], expected: string[]): boolean {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  return actual.length === actualSet.size
    && expected.length === expectedSet.size
    && actualSet.size === expectedSet.size
    && [...expectedSet].every((value) => actualSet.has(value))
}

function sourceIdsForFact(fact: AaPreviousUsageFact, researchData: Record<string, unknown>, chineseResearch: Record<string, unknown>): string[] {
  const scenarios = Array.isArray(researchData.scenarios) ? researchData.scenarios : []
  const costOnlyScenarios = Array.isArray(researchData.costOnlyScenarios) ? researchData.costOnlyScenarios : []
  const direct = scenarios.filter((row) => isRecord(row)
    && isRecord(row.targetObservation)
    && row.targetObservation.observationId === fact.targetObservationId)
  const costOnly = costOnlyScenarios.filter((row) => isRecord(row)
    && isRecord(row.targetObservation)
    && row.targetObservation.observationId === fact.targetObservationId)
  if (direct.length > 1 || costOnly.length > 1 || direct.length > 0 && costOnly.length > 0) {
    throw new Error(`AA fact ${fact.id} has ambiguous research source mappings.`)
  }
  if (direct.length === 1) {
    const sourceId = (direct[0] as Record<string, unknown>).codingAgentComparisonSourceId
    return typeof sourceId === 'string' && sourceId.length > 0 ? [sourceId] : []
  }
  if (costOnly.length === 1) {
    const row = costOnly[0] as Record<string, unknown>
    const chineseTargets = Array.isArray(chineseResearch.targets) ? chineseResearch.targets : []
    const chineseTarget = chineseTargets.find((target) => isRecord(target) && target.id === fact.targetObservationId)
    if (isRecord(chineseTarget) && Array.isArray(chineseTarget.sourceIds)) return chineseTarget.sourceIds as string[]
    return typeof row.sourceId === 'string' && row.sourceId.length > 0 ? [row.sourceId] : []
  }
  return []
}

function verifyScenarioConfig(
  fact: AaPreviousUsageFact,
  scenarioConfig: unknown,
  researchData: Record<string, unknown>,
  chineseResearch: Record<string, unknown>,
  knownSourceIds: Set<string>,
): void {
  const expectedSourceIds = sourceIdsForFact(fact, researchData, chineseResearch)
  if (expectedSourceIds.length === 0
    || fact.identity.sourceId !== expectedSourceIds[0]
    || !sameStringSet(fact.sourceIds, expectedSourceIds)
    || fact.sourceIds.some((sourceId) => !knownSourceIds.has(sourceId))) {
    throw new Error(`AA fact ${fact.id} source IDs do not match authoritative fact provenance.`)
  }
  if (!isRecord(scenarioConfig) || !Array.isArray(scenarioConfig.targets)) throw new Error('AA scenarioConfig has no target list.')
  const matchingTargets = scenarioConfig.targets.filter((target) => isRecord(target) && target.observationId === fact.targetObservationId)
  if (matchingTargets.length !== 1) throw new Error(`AA fact ${fact.id} has no unique scenarioConfig target.`)
  const target = matchingTargets[0]
  if (!isRecord(target) || !isRecord(target.metrics) || !isRecord(target.metrics.outputTokens)) {
    throw new Error(`AA fact ${fact.id} has no outputTokens scenarioConfig entry.`)
  }
  const output = target.metrics.outputTokens
  if (output.selection !== 'same-source-reference' || output.relationship !== fact.relationship) {
    throw new Error(`AA fact ${fact.id} is not configured as its reviewed same-source output reference.`)
  }
  if (!Array.isArray(output.factIds) || output.factIds.filter((factId) => factId === fact.id).length !== 1) {
    throw new Error(`AA fact ${fact.id} is not uniquely wired by scenarioConfig.factIds.`)
  }
  if (!Array.isArray(output.sourceIds)
    || output.sourceIds.some((sourceId) => typeof sourceId !== 'string' || !knownSourceIds.has(sourceId))
    || !sameStringSet(output.sourceIds as string[], fact.sourceIds)) {
    throw new Error(`AA fact ${fact.id} source IDs do not match scenarioConfig metric provenance.`)
  }
}

/**
 * Build the fetch targets from the authoritative normalized facts. No model/variant
 * list is duplicated in code: scenarioConfig must explicitly reference each fact.
 */
function sourceIdsFromCatalog(value: unknown, label: string): string[] {
  if (!isRecord(value) || !Array.isArray(value.sources)) throw new Error(`${label} research artifact has no sources array.`)
  const ids = value.sources.map((source) => {
    if (!isRecord(source) || typeof source.id !== 'string' || source.id.length === 0) throw new Error(`${label} source catalog has an invalid ID.`)
    return source.id
  })
  return ids
}

export function buildAaUsageRefreshConfig(input: AaUsageResearchBundle): AaUsageRefreshConfig {
  if (!isRecord(input)) throw new Error('AA refresh source bundle is invalid.')
  const research = input.usageResearch
  const metaResearch = input.metaResearch
  const chineseResearch = input.chineseResearch
  if (!isRecord(research) || !Array.isArray(research.usageFacts)) throw new Error('Research artifact has no usageFacts array.')
  if (!isRecord(chineseResearch)) throw new Error('Chinese research artifact is missing.')
  const knownSourceIds = new Set([
    ...sourceIdsFromCatalog(research, 'Usage'),
    ...sourceIdsFromCatalog(metaResearch, 'Meta'),
    ...sourceIdsFromCatalog(chineseResearch, 'Chinese'),
  ])
  const scenarioConfig = research.scenarioConfig
  if (!isRecord(scenarioConfig)) throw new Error('Research artifact has no scenarioConfig object.')

  const selectedFacts = research.usageFacts.filter((fact) => {
    if (!isRecord(fact) || fact.metric !== 'outputTokens' || !isRecord(fact.identity) || !isRecord(fact.evidence)) return false
    return fact.identity.datasetIndexName === AA_DEEP_SWE_DATASET_INDEX && isAaComparisonUrl(fact.evidence.url)
  })
  if (selectedFacts.length === 0) throw new Error('Research artifact contains no reviewed AA DeepSWE output facts.')

  const previousFacts = selectedFacts.map((fact, index) => {
    assertPreviousFact(fact, index)
    verifyScenarioConfig(fact, scenarioConfig, research, chineseResearch, knownSourceIds)
    return fact
  })
  const ids = new Set<string>()
  const pagesByUrl = new Map<string, AaUsageSourcePage>()
  for (const fact of previousFacts) {
    if (ids.has(fact.id)) throw new Error(`Research artifact repeats AA usage fact ID ${fact.id}.`)
    ids.add(fact.id)
    const url = fact.evidence.url
    const identity: AaVariantIdentity = identityForFact(fact)
    const target: AaReviewedTarget = {
      factId: fact.id,
      targetObservationId: fact.targetObservationId,
      sourceId: fact.identity.sourceId,
      identity,
    }
    const existing = pagesByUrl.get(url)
    if (existing) {
      if (existing.sourceRevision !== fact.evidence.sourceRevision) throw new Error(`AA page ${url} has inconsistent source revisions in usageFacts.`)
      existing.targets.push(target)
    } else {
      pagesByUrl.set(url, {
        url,
        sourceRevision: fact.evidence.sourceRevision,
        identityPaths: { ...NEXT_FLIGHT_IDENTITY_PATHS },
        targets: [target],
      })
    }
  }

  const pages = [...pagesByUrl.values()]
  pages.forEach(validateAaUsageSourcePage)
  return {
    schemaVersion: 1,
    pages,
    previousFacts,
    previousNumericRevision: numericRevisionFor(previousFacts),
  }
}

function sameIdentity(left: AaVariantIdentity, right: AaVariantIdentity): boolean {
  return stableJson(left) === stableJson(right)
}

export function validateAaUsageRefreshConfig(value: unknown): AaUsageRefreshConfig {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('AA refresh config must use schemaVersion 1.')
  if (!Array.isArray(value.pages) || value.pages.length === 0) throw new Error('AA refresh config must include reviewed pages.')
  const pages = value.pages as AaUsageSourcePage[]
  const facts = value.previousFacts
  if (!Array.isArray(facts) || facts.length === 0) throw new Error('AA refresh config must include previousFacts as an array.')
  const validatedFacts = facts as AaPreviousUsageFact[]
  const factById = new Map<string, AaPreviousUsageFact>()
  validatedFacts.forEach((fact, index) => {
    assertPreviousFact(fact, index)
    if (factById.has(fact.id)) throw new Error(`AA refresh config repeats previous fact ID ${fact.id}.`)
    factById.set(fact.id, fact)
  })

  const seenUrls = new Set<string>()
  const seenFactIds = new Set<string>()
  for (const page of pages) {
    validateAaUsageSourcePage(page)
    assertAaComparisonUrl(page.url)
    if (seenUrls.has(page.url)) throw new Error(`AA refresh config repeats page URL ${page.url}.`)
    seenUrls.add(page.url)
    for (const target of page.targets) {
      if (seenFactIds.has(target.factId)) throw new Error(`AA refresh config repeats fact ID ${target.factId}.`)
      seenFactIds.add(target.factId)
      const fact = factById.get(target.factId)
      if (!fact) throw new Error(`AA target ${target.factId} has no authoritative usageFact.`)
      if (target.targetObservationId !== fact.targetObservationId || target.sourceId !== fact.identity.sourceId || !sameIdentity(target.identity, identityForFact(fact))) {
        throw new Error(`AA target ${target.factId} differs from its authoritative usageFact identity.`)
      }
      if (fact.evidence.url !== page.url || fact.evidence.sourceRevision !== page.sourceRevision) {
        throw new Error(`AA target ${target.factId} page provenance does not match usageFacts.`)
      }
    }
  }
  if (value.previousNumericRevision !== null && typeof value.previousNumericRevision !== 'string') {
    throw new Error('AA refresh config has an invalid previous numeric revision.')
  }
  return value as unknown as AaUsageRefreshConfig
}

function isoNow(now: () => Date): string {
  const value = now()
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error('AA refresh clock returned an invalid date.')
  return value.toISOString()
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The response is already being discarded; cancellation errors are immaterial.
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length')
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new Error('AA response has an invalid Content-Length header.')
    if (Number(contentLength) > maxBytes) throw new Error(`AA response exceeds the ${maxBytes}-byte limit.`)
  }
  if (!response.body) throw new Error('AA response has no readable body.')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    byteLength += value.byteLength
    if (byteLength > maxBytes) {
      await reader.cancel('AA response exceeded the byte limit.')
      throw new Error(`AA response exceeds the ${maxBytes}-byte limit.`)
    }
    chunks.push(value)
  }
  if (byteLength === 0) throw new Error('AA response body is empty.')
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function fetchAaComparisonPage(url: string, options: FetchOptions = {}): Promise<FetchedAaPage> {
  assertAaComparisonUrl(url)
  const maxResponseBytes = options.maxResponseBytes ?? AA_MAX_RESPONSE_BYTES
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > AA_MAX_RESPONSE_BYTES) {
    throw new Error(`AA response byte limit must be between 1 and ${AA_MAX_RESPONSE_BYTES}.`)
  }
  const timeoutMs = options.timeoutMs ?? AA_FETCH_TIMEOUT_MS
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > AA_FETCH_TIMEOUT_MS) {
    throw new Error(`AA fetch timeout must be between 1 and ${AA_FETCH_TIMEOUT_MS} milliseconds.`)
  }
  const fetcher = options.fetcher ?? fetch
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, milliseconds)))
  const now = options.now ?? (() => new Date())
  let lastError: unknown

  for (let attempt = 1; attempt <= AA_MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { accept: 'text/html' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.status === 429 || response.status >= 500) {
        await cancelBody(response)
        if (attempt < AA_MAX_FETCH_ATTEMPTS) {
          await sleep(attempt * 500)
          continue
        }
        throw new Error(`AA comparison request failed after ${attempt} attempts with HTTP ${response.status}.`)
      }
      if (response.status !== 200 || response.redirected) {
        await cancelBody(response)
        throw new Error(`AA comparison request returned unexpected HTTP ${response.status}.`)
      }
      if (response.url && response.url !== url) {
        await cancelBody(response)
        throw new Error('AA comparison request did not remain on the exact reviewed URL.')
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!/^text\/html(?:\s*;|$)/i.test(contentType)) {
        await cancelBody(response)
        throw new Error(`AA comparison response is not text/html (${contentType || 'no content type'}).`)
      }
      const bytes = await readBoundedBody(response, maxResponseBytes)
      let html: string
      try {
        html = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        throw new Error('AA comparison response is not valid UTF-8.')
      }
      return {
        html,
        retrieval: {
          url,
          retrievedAt: isoNow(now),
          responseSha256: sha256(bytes),
          httpStatus: 200,
          byteLength: bytes.byteLength,
        },
      }
    } catch (error) {
      lastError = error
      if (attempt < AA_MAX_FETCH_ATTEMPTS) await sleep(attempt * 500)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AA comparison retrieval failed after bounded retries.')
}

function candidateFactFromTarget(
  target: AaReviewedTarget & { sourceVariantId: string; value: number; locator: string },
  page: AaUsageSourcePage,
  retrieval: AaUsagePageRetrieval,
  previousFact: AaPreviousUsageFact,
): AaUsageFact {
  return {
    ...previousFact,
    value: target.value,
    missingReason: null,
    evidence: {
      ...previousFact.evidence,
      url: retrieval.url,
      retrievedAt: retrieval.retrievedAt,
      locator: target.locator,
      responseSha256: retrieval.responseSha256,
      hashStatus: 'validated',
      sourceRevision: page.sourceRevision,
      caveats: [...previousFact.evidence.caveats],
    },
  }
}

function numericProjection(fact: AaPreviousUsageFact | AaUsageFact): Record<string, unknown> {
  const { evidence: _evidence, ...semanticFact } = fact
  return semanticFact
}

function provenanceProjection(fact: AaPreviousUsageFact | AaUsageFact): unknown {
  return {
    url: fact.evidence.url,
    locator: fact.evidence.locator,
    responseSha256: fact.evidence.responseSha256,
    hashStatus: fact.evidence.hashStatus,
    sourceRevision: fact.evidence.sourceRevision,
    approvedDatasetRevision: fact.evidence.approvedDatasetRevision,
    historicalMalformedSha256: fact.evidence.historicalMalformedSha256 ?? null,
    caveats: fact.evidence.caveats,
  }
}

function numericRevisionFor(facts: Array<AaPreviousUsageFact | AaUsageFact>): string {
  const payload = facts
    .map((fact) => numericProjection(fact))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  return sha256(stableJson(payload))
}

function diffFacts(previousFacts: AaPreviousUsageFact[], currentFacts: AaUsageFact[]): AaUsageDiff {
  const previousById = new Map(previousFacts.map((fact) => [fact.id, fact]))
  const currentById = new Map(currentFacts.map((fact) => [fact.id, fact]))
  const addedFactIds: string[] = []
  const changedFactIds: string[] = []
  const removedFactIds: string[] = []
  const provenanceChangedFactIds: string[] = []
  const unchangedFactIds: string[] = []

  for (const fact of currentFacts) {
    const previous = previousById.get(fact.id)
    if (!previous) {
      addedFactIds.push(fact.id)
      continue
    }
    const semanticChanged = stableJson(numericProjection(previous)) !== stableJson(numericProjection(fact))
    const provenanceChanged = stableJson(provenanceProjection(previous)) !== stableJson(provenanceProjection(fact))
    if (semanticChanged) changedFactIds.push(fact.id)
    if (provenanceChanged) provenanceChangedFactIds.push(fact.id)
    if (!semanticChanged && !provenanceChanged) unchangedFactIds.push(fact.id)
  }
  for (const fact of previousFacts) {
    if (!currentById.has(fact.id)) removedFactIds.push(fact.id)
  }

  for (const ids of [addedFactIds, changedFactIds, removedFactIds, provenanceChangedFactIds, unchangedFactIds]) ids.sort()
  return { addedFactIds, changedFactIds, removedFactIds, provenanceChangedFactIds, unchangedFactIds }
}

function hasProposalChanges(diff: AaUsageDiff): boolean {
  return diff.addedFactIds.length > 0
    || diff.changedFactIds.length > 0
    || diff.removedFactIds.length > 0
    || diff.provenanceChangedFactIds.length > 0
}

function candidateUrls(value: unknown): string[] {
  if (!isRecord(value)) return []
  if (Array.isArray(value.pages)) return value.pages.flatMap((page) => isRecord(page) && isAaComparisonUrl(page.url) ? [page.url] : [])
  const research = isRecord(value.usageResearch) ? value.usageResearch : value
  if (!Array.isArray(research.usageFacts)) return []
  return [...new Set(research.usageFacts.flatMap((fact) => {
    if (!isRecord(fact) || !isRecord(fact.evidence) || !isAaComparisonUrl(fact.evidence.url)) return []
    return [fact.evidence.url]
  }))]
}

export async function refreshAaUsage(configInput: unknown, dependencies: AaUsageRefreshDependencies): Promise<string> {
  const now = dependencies.now ?? (() => new Date())
  const startedAt = isoNow(now)
  let urls = candidateUrls(configInput)

  return stageRefreshCandidate<AaUsageCandidate>(async () => {
    const loadedInput = typeof configInput === 'function'
      ? await (configInput as AaUsageInputLoader)()
      : configInput
    urls = candidateUrls(loadedInput)
    const config = isRecord(loadedInput) && Array.isArray(loadedInput.pages)
      ? validateAaUsageRefreshConfig(loadedInput)
      : buildAaUsageRefreshConfig(loadedInput as AaUsageResearchBundle)
    const previousFactsById = new Map(config.previousFacts.map((fact) => [fact.id, fact]))
    const facts: AaUsageFact[] = []
    const retrievedPages: AaUsageCandidate['pages'] = []

    for (const page of config.pages) {
      const fetched = await fetchAaComparisonPage(page.url, {
        fetcher: dependencies.fetcher,
        sleep: dependencies.sleep,
        now,
        maxResponseBytes: dependencies.maxResponseBytes,
        timeoutMs: dependencies.timeoutMs,
      })
      const parsed = parseAaUsageHtml(fetched.html, page)
      facts.push(...parsed.map((target) => {
        const previousFact = previousFactsById.get(target.factId)
        if (!previousFact) throw new Error(`AA parser returned unconfigured fact ${target.factId}.`)
        return candidateFactFromTarget(target, page, fetched.retrieval, previousFact)
      }))
      retrievedPages.push({
        url: fetched.retrieval.url,
        sourceRevision: page.sourceRevision,
        retrievedAt: fetched.retrieval.retrievedAt,
        responseSha256: fetched.retrieval.responseSha256,
        byteLength: fetched.retrieval.byteLength,
        targetCount: parsed.length,
      })
    }

    facts.sort((left, right) => left.id.localeCompare(right.id))
    retrievedPages.sort((left, right) => left.url.localeCompare(right.url))
    const checkedAt = isoNow(now)
    const diff = diffFacts(config.previousFacts, facts)
    const currentNumericRevision = numericRevisionFor(facts)
    const previousNumericRevisionMatches = config.previousFacts.length > 0
      && numericRevisionFor(config.previousFacts) === currentNumericRevision
    const numericRevision = previousNumericRevisionMatches && config.previousNumericRevision
      ? config.previousNumericRevision
      : currentNumericRevision
    const candidate: AaUsageCandidate = {
      schemaVersion: 1,
      kind: 'aa-usage-refresh-proposal',
      status: 'pending-review',
      sourceId: SOURCE_ID,
      checkedAt,
      numericRevision,
      pages: retrievedPages,
      changes: diff,
      facts,
      approvedFactsModified: false,
      officialCandidateModified: false,
    }
    const changed = hasProposalChanges(diff)
    const status = {
      status: changed ? 'candidate-ready' : 'checked-unchanged',
      checkedAt,
      sourceId: SOURCE_ID,
      pageUrls: retrievedPages.map((page) => page.url),
      pageResponseSha256: retrievedPages.map(({ url, responseSha256 }) => ({ url, responseSha256 })),
      numericRevision,
      changes: diff,
      candidateStatus: changed ? 'pending-review' : 'unchanged',
      approvedFactsModified: false,
      officialCandidateModified: false,
      message: changed
        ? 'AA usage changes are staged only as a separate proposal for explicit review.'
        : 'AA usage values and source evidence are unchanged; existing proposal artifacts were retained.',
    }
    const summary = changed
      ? `AA usage: pending-review proposal; ${diff.addedFactIds.length} added, ${diff.changedFactIds.length} changed, ${diff.removedFactIds.length} removed, ${diff.provenanceChangedFactIds.length} provenance updates; approved facts untouched.`
      : 'AA usage: checked unchanged; numeric revision and existing proposal artifacts retained.'

    return { candidate: changed ? candidate : null, status, summary }
  }, dependencies.writeCandidate, dependencies.writeStatus, undefined, (error) => ({
    status: 'failed',
    startedAt,
    failedAt: isoNow(now),
    sourceId: SOURCE_ID,
    sourceArtifactPaths: RESEARCH_INPUT_PATHS,
    pageUrls: urls,
    diagnostic: error instanceof Error ? error.message : 'Unknown AA refresh error.',
    approvedFactsModified: false,
    officialCandidateModified: false,
    existingProposalPreserved: true,
  }))
}

async function main(): Promise<void> {
  if (process.argv.length > 2) throw new Error('AA refresh uses the authoritative usageFacts/scenarioConfig artifact; no target/config argument is accepted.')
  const summary = await refreshAaUsage(async () => {
    const [usageResearch, metaResearch, chineseResearch] = await Promise.all([
      readJson<unknown>(RESEARCH_PATH),
      readJson<unknown>(META_RESEARCH_PATH),
      readJson<unknown>(CHINESE_RESEARCH_PATH),
    ])
    return { usageResearch, metaResearch, chineseResearch } satisfies AaUsageResearchBundle
  }, {
    writeCandidate: (candidate) => writeJsonAtomic(CANDIDATE_PATH, candidate),
    writeStatus: (status) => writeJsonAtomic(STATUS_PATH, status),
  })
  console.log(summary)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(`AA usage refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    process.exitCode = 1
  })
}
