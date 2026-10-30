export const AA_DEEP_SWE_DATASET_INDEX = 'deep-swe-v1.1'
export const AA_MAX_HTML_BYTES = 1_000_000

const MAX_SCRIPT_TAGS = 256
const MAX_JSON_SCRIPTS = 32
const MAX_FLIGHT_SEGMENTS = 128
const MAX_FLIGHT_OBJECTS = 20_000
const MAX_JSON_DEPTH = 64
const MAX_JSON_TOKENS = 100_000
const MAX_TREE_DEPTH = 64
const MAX_TREE_NODES = 100_000

export interface AaVariantIdentity {
  /** Stable reviewed key from usageFacts; AA's serialized row id is a separate, dynamic identifier. */
  variantKey: string
  displayLabel: string
  reportedModel: string
  modelSnapshot: string | null
  effort: string | null
  rawSetting: string | null
  fallback: boolean | null
  harness: string
  benchmarkVersion: string
  datasetIndexName: typeof AA_DEEP_SWE_DATASET_INDEX
}

/** Paths in the non-executed serialized AA variant record. */
export interface AaIdentityPaths {
  sourceVariantId: string
  displayLabel: string
  harness: string
  displayAgent: string
  displayModel: string
}

export interface AaReviewedTarget {
  factId: string
  targetObservationId: string
  sourceId: string
  identity: AaVariantIdentity
}

export interface AaUsageSourcePage {
  url: string
  sourceRevision: string | null
  identityPaths: AaIdentityPaths
  targets: AaReviewedTarget[]
}

export interface ParsedAaUsageTarget extends AaReviewedTarget {
  sourceVariantId: string
  value: number
  locator: string
}

type UnknownRecord = Record<string, unknown>

const NEXT_FLIGHT_PUSH = /self\.__next_f\.push\(\s*\[\s*1\s*,\s*("(?:\\.|[^"\\])*")\s*\]\s*\)/gs

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertIdentity(identity: AaVariantIdentity, label: string): void {
  if (!identity || typeof identity !== 'object') throw new Error(`${label} has no reviewed variant identity.`)
  for (const field of ['variantKey', 'displayLabel', 'reportedModel', 'harness', 'benchmarkVersion'] as const) {
    if (typeof identity[field] !== 'string' || identity[field].length === 0) throw new Error(`${label} has an invalid ${field}.`)
  }
  if (identity.modelSnapshot !== null) throw new Error(`${label} specifies a model snapshot, but the reviewed AA page schema exposes no immutable checkpoint field.`)
  for (const field of ['effort', 'rawSetting'] as const) {
    if (identity[field] !== null && typeof identity[field] !== 'string') throw new Error(`${label} has an invalid ${field}.`)
  }
  if (identity.fallback !== null && typeof identity.fallback !== 'boolean') throw new Error(`${label} has an invalid fallback value.`)
  if (identity.benchmarkVersion !== '1.1') throw new Error(`${label} is not scoped to reviewed AA benchmark v1.1.`)
  if (identity.datasetIndexName !== AA_DEEP_SWE_DATASET_INDEX) throw new Error(`${label} is not scoped to ${AA_DEEP_SWE_DATASET_INDEX}.`)
}

function assertPath(path: string, label: string): void {
  if (typeof path !== 'string' || path.length === 0 || path.length > 160) throw new Error(`${label} has an invalid identity path.`)
  const segments = path.split('.')
  if (segments.length > 12 || segments.some((segment) => !/^[A-Za-z_$][\w$-]*$/.test(segment))) {
    throw new Error(`${label} has an unsupported identity path.`)
  }
}

export function validateAaUsageSourcePage(page: AaUsageSourcePage): void {
  if (!page || typeof page !== 'object') throw new Error('AA refresh page configuration is invalid.')
  if (typeof page.url !== 'string' || page.url.length === 0) throw new Error('AA refresh page has no URL.')
  if (page.sourceRevision !== null && typeof page.sourceRevision !== 'string') throw new Error(`AA page ${page.url} has an invalid source revision.`)
  if (!page.identityPaths || typeof page.identityPaths !== 'object') throw new Error(`AA page ${page.url} has no explicit identity paths.`)
  for (const field of ['sourceVariantId', 'displayLabel', 'harness', 'displayAgent', 'displayModel'] as const) {
    assertPath(page.identityPaths[field], `${page.url}.${field}`)
  }
  if (!Array.isArray(page.targets) || page.targets.length === 0) throw new Error(`AA page ${page.url} has no reviewed targets.`)

  const factIds = new Set<string>()
  const variantKeys = new Set<string>()
  const displayLabels = new Set<string>()
  for (const target of page.targets) {
    if (!target || typeof target !== 'object') throw new Error(`AA page ${page.url} has an invalid target.`)
    for (const [field, value] of Object.entries({
      factId: target.factId,
      targetObservationId: target.targetObservationId,
      sourceId: target.sourceId,
    })) {
      if (typeof value !== 'string' || value.length === 0) throw new Error(`AA page ${page.url} has a target with an invalid ${field}.`)
    }
    assertIdentity(target.identity, `AA target ${target.factId}`)
    if (factIds.has(target.factId)) throw new Error(`AA page ${page.url} repeats fact ID ${target.factId}.`)
    if (variantKeys.has(target.identity.variantKey)) throw new Error(`AA page ${page.url} repeats reviewed variant key ${target.identity.variantKey}.`)
    if (displayLabels.has(target.identity.displayLabel)) throw new Error(`AA page ${page.url} repeats reviewed display label ${target.identity.displayLabel}.`)
    if (!target.identity.displayLabel.startsWith(`${target.identity.harness} - `)) {
      throw new Error(`AA target ${target.factId} does not identify its exact harness in the reviewed display label.`)
    }
    factIds.add(target.factId)
    variantKeys.add(target.identity.variantKey)
    displayLabels.add(target.identity.displayLabel)
  }
}

function parseScriptAttributes(attributes: string): { mimeType: string; id: string } {
  const typeMatch = attributes.match(/(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const idMatch = attributes.match(/(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const mimeType = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').split(';', 1)[0].trim().toLowerCase()
  const id = idMatch?.[1] ?? idMatch?.[2] ?? idMatch?.[3] ?? ''
  return { mimeType, id }
}

function assertJsonLimits(text: string): void {
  let depth = 0
  let tokenCount = 1
  let inString = false
  let escaped = false
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      tokenCount += 1
    } else if (character === '{' || character === '[') {
      depth += 1
      tokenCount += 1
      if (depth > MAX_JSON_DEPTH) throw new Error('AA serialized JSON exceeds the supported nesting depth.')
    } else if (character === '}' || character === ']') {
      depth -= 1
      if (depth < 0) throw new Error('AA serialized JSON is malformed.')
    } else if (character === ',' || character === ':') {
      tokenCount += 1
    }
    if (tokenCount > MAX_JSON_TOKENS) throw new Error('AA serialized JSON exceeds the supported item limit.')
  }
  if (inString || depth !== 0) throw new Error('AA serialized JSON is malformed.')
}

function readPath(value: unknown, path: string): unknown {
  let current = value
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined
    current = current[segment]
  }
  return current
}

function collectRecords(value: unknown, records: UnknownRecord[], pageUrl: string): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
  let visited = 0
  while (stack.length > 0) {
    const next = stack.pop()!
    visited += 1
    if (visited > MAX_TREE_NODES || records.length > MAX_TREE_NODES) {
      throw new Error(`AA page ${pageUrl} exceeds the supported serialized item limit.`)
    }
    if (next.depth > MAX_TREE_DEPTH) throw new Error(`AA page ${pageUrl} exceeds the supported data nesting depth.`)
    if (Array.isArray(next.value)) {
      for (const item of next.value) stack.push({ value: item, depth: next.depth + 1 })
    } else if (isRecord(next.value)) {
      records.push(next.value)
      for (const child of Object.values(next.value)) stack.push({ value: child, depth: next.depth + 1 })
    }
  }
}

function matchingObjectEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') {
      depth += 1
      if (depth > MAX_JSON_DEPTH) return -1
    } else if (character === '}' && --depth === 0) return index + 1
  }
  return -1
}

function parseFlightObjects(flight: string, pageUrl: string): UnknownRecord[] {
  const roots: UnknownRecord[] = []
  let inString = false
  let escaped = false
  let objectAttempts = 0
  for (let index = 0; index < flight.length; index += 1) {
    const character = flight[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character !== '{') continue
    objectAttempts += 1
    if (objectAttempts > MAX_FLIGHT_OBJECTS) throw new Error(`AA page ${pageUrl} exceeds the supported Flight object scan limit.`)
    const end = matchingObjectEnd(flight, index)
    if (end < 0) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(flight.slice(index, end))
    } catch {
      continue
    }
    if (isRecord(parsed)) {
      roots.push(parsed)
      if (roots.length > MAX_FLIGHT_OBJECTS) throw new Error(`AA page ${pageUrl} contains too many serialized Flight objects.`)
      index = end - 1
    }
  }
  return roots
}

function parseSerializedRoots(html: string, pageUrl: string): unknown[] {
  const roots: unknown[] = []
  const flightSegments: string[] = []
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  let scriptCount = 0
  let jsonScriptCount = 0

  for (const match of html.matchAll(scriptPattern)) {
    scriptCount += 1
    if (scriptCount > MAX_SCRIPT_TAGS) throw new Error(`AA page ${pageUrl} contains too many script tags.`)
    const attributes = match[1] ?? ''
    const text = match[2] ?? ''
    const { mimeType, id } = parseScriptAttributes(attributes)

    if (mimeType === 'application/json' || id === '__NEXT_DATA__') {
      jsonScriptCount += 1
      if (jsonScriptCount > MAX_JSON_SCRIPTS) throw new Error(`AA page ${pageUrl} contains too many JSON scripts.`)
      assertJsonLimits(text)
      try {
        roots.push(JSON.parse(text))
      } catch {
        throw new Error(`AA page ${pageUrl} contains malformed serialized JSON (script ${jsonScriptCount}).`)
      }
    }

    const flightMarkers = (text.match(/self\.__next_f\.push\(\s*\[\s*1\s*,/g) ?? []).length
    let parsedSegments = 0
    for (const call of text.matchAll(NEXT_FLIGHT_PUSH)) {
      let segment: unknown
      try {
        segment = JSON.parse(call[1] ?? '')
      } catch {
        throw new Error(`AA page ${pageUrl} contains an invalid Next Flight string literal.`)
      }
      if (typeof segment !== 'string') throw new Error(`AA page ${pageUrl} contains a non-string Next Flight segment.`)
      flightSegments.push(segment)
      parsedSegments += 1
      if (flightSegments.length > MAX_FLIGHT_SEGMENTS) throw new Error(`AA page ${pageUrl} contains too many Next Flight segments.`)
    }
    if (parsedSegments !== flightMarkers) throw new Error(`AA page ${pageUrl} contains an unsupported Next Flight call encoding.`)
  }

  if (flightSegments.length > 0) {
    const flight = flightSegments.join('')
    if (Buffer.byteLength(flight, 'utf8') > AA_MAX_HTML_BYTES) throw new Error(`AA page ${pageUrl} exceeds the 1 MB decoded Flight limit.`)
    roots.push(...parseFlightObjects(flight, pageUrl))
  }
  if (roots.length === 0) throw new Error(`AA HTML has no supported serialized JSON or Next Flight data; page layout may have changed or access may be gated.`)
  return roots
}

function expectedRenderedModel(identity: AaVariantIdentity): string {
  const prefix = `${identity.harness} - `
  if (!identity.displayLabel.startsWith(prefix)) throw new Error(`AA display label does not match the reviewed harness for ${identity.variantKey}.`)
  return identity.displayLabel.slice(prefix.length)
}

function validateRenderedIdentity(target: AaReviewedTarget, renderedModel: string): void {
  const identity = target.identity
  if (renderedModel !== identity.reportedModel && !renderedModel.startsWith(`${identity.reportedModel} (`)) {
    throw new Error(`AA rendered model does not match reviewed model ${identity.reportedModel} for ${target.factId}.`)
  }
  if (identity.effort !== null && !renderedModel.includes(`(${identity.effort})`)) {
    throw new Error(`AA rendered model does not match reviewed effort ${identity.effort} for ${target.factId}.`)
  }
  if (identity.rawSetting !== null && !renderedModel.includes(`(${identity.rawSetting})`) && !identity.displayLabel.includes(`'${identity.rawSetting}'`)) {
    throw new Error(`AA rendered model does not match reviewed raw setting for ${target.factId}.`)
  }
  const labelDeclaresFallback = identity.displayLabel.endsWith('(with fallback)')
  if (identity.fallback !== null && identity.fallback !== labelDeclaresFallback) {
    throw new Error(`AA display label does not match reviewed fallback status for ${target.factId}.`)
  }
}

export function parseAaUsageHtml(html: string, page: AaUsageSourcePage): ParsedAaUsageTarget[] {
  validateAaUsageSourcePage(page)
  if (typeof html !== 'string' || html.length === 0) throw new Error(`AA page ${page.url} is empty.`)
  if (html.length > AA_MAX_HTML_BYTES || Buffer.byteLength(html, 'utf8') > AA_MAX_HTML_BYTES) {
    throw new Error(`AA page ${page.url} exceeds the 1 MB parser limit.`)
  }

  const records: UnknownRecord[] = []
  for (const root of parseSerializedRoots(html, page.url)) collectRecords(root, records, page.url)

  return page.targets.map((target) => {
    const candidates = records.filter((record) => readPath(record, page.identityPaths.displayLabel) === target.identity.displayLabel)
    if (candidates.length === 0) throw new Error(`AA reviewed variant ${target.identity.displayLabel} (${target.factId}) is missing.`)
    if (candidates.length !== 1) throw new Error(`AA reviewed variant ${target.identity.displayLabel} (${target.factId}) is ambiguous (${candidates.length} records).`)

    const variant = candidates[0]!
    const sourceVariantId = readPath(variant, page.identityPaths.sourceVariantId)
    const harness = readPath(variant, page.identityPaths.harness)
    const displayAgent = readPath(variant, page.identityPaths.displayAgent)
    const displayModel = readPath(variant, page.identityPaths.displayModel)
    if (typeof sourceVariantId !== 'string' || sourceVariantId.length === 0) {
      throw new Error(`AA variant ${target.identity.displayLabel} has no serialized source variant ID.`)
    }
    if (harness !== target.identity.harness || displayAgent !== target.identity.harness) {
      throw new Error(`AA variant identity mismatch for ${target.factId}: harness.`)
    }
    if (typeof displayModel !== 'string') throw new Error(`AA variant ${target.identity.displayLabel} has no serialized display model.`)
    const expectedModel = expectedRenderedModel(target.identity)
    if (displayModel !== expectedModel) throw new Error(`AA variant identity mismatch for ${target.factId}: display model.`)
    validateRenderedIdentity(target, displayModel)

    if (!Array.isArray(variant.evals)) throw new Error(`AA variant ${target.identity.displayLabel} has no evals array.`)
    const matchingEvals = variant.evals.filter((evaluation) => isRecord(evaluation) && evaluation.datasetIndexName === AA_DEEP_SWE_DATASET_INDEX)
    if (matchingEvals.length === 0) throw new Error(`AA variant ${target.identity.displayLabel} has no ${AA_DEEP_SWE_DATASET_INDEX} eval.`)
    if (matchingEvals.length !== 1) throw new Error(`AA variant ${target.identity.displayLabel} has ${matchingEvals.length} ${AA_DEEP_SWE_DATASET_INDEX} evals; exactly one is required.`)

    const evaluation = matchingEvals[0] as UnknownRecord
    const mean = evaluation.mean
    if (!isRecord(mean) || !Object.hasOwn(mean, 'outputTokens')) {
      throw new Error(`AA variant ${target.identity.displayLabel} has no ${AA_DEEP_SWE_DATASET_INDEX}.mean.outputTokens field.`)
    }
    const value = mean.outputTokens
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`AA variant ${target.identity.displayLabel} has an invalid ${AA_DEEP_SWE_DATASET_INDEX}.mean.outputTokens value.`)
    }

    return {
      ...target,
      sourceVariantId,
      value,
      locator: `variants[id=${JSON.stringify(sourceVariantId)}][displayLabel=${JSON.stringify(target.identity.displayLabel)}].evals[datasetIndexName="${AA_DEEP_SWE_DATASET_INDEX}"].mean.outputTokens`,
    }
  })
}
