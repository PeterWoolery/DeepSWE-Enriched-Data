import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EvidencePanel } from '../src/components/EvidencePanel'
import { DatasetSchema } from '../src/lib/schema'
import { resolveXUsage, usageScenarioForObservation, type UsageScenario } from '../src/lib/usage-scenarios'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const astraXhigh = dataset.observations.find((observation) => observation.upstreamConfigurationId === 'mini_swe_agent_gpt_6_astra_xhigh')!
const luna = dataset.observations.find((observation) => observation.id === 'openai-gpt-6-luna-v1.1-max')!

describe('metric-specific evidence details', () => {
  it('shows pass@4 task denominator and never leaks pass@1 confidence details', () => {
    const html = renderToStaticMarkup(<EvidencePanel observation={astraXhigh} xMetric="cost" statistic="mean" scoreMetric="pass_at_4" />)
    expect(html).toContain('pass@4')
    expect(html).toContain('unique tasks attempted (113)')
    expect(html).not.toContain('scored rollout attempts (452)')
    expect(html).not.toContain('95% CI')
    expect(html).not.toContain('run-to-run')
    expect(html).toContain('A confidence interval is not reported for pass@4')
  })

  it('shows the pass@1 denominator and interval only when pass@1 is selected', () => {
    const html = renderToStaticMarkup(<EvidencePanel observation={astraXhigh} xMetric="cost" statistic="mean" scoreMetric="pass_at_1" />)
    expect(html).toContain('scored rollout attempts (452)')
    expect(html).toContain('95% CI')
    expect(html).toContain('run-to-run')
  })

  it('shows the same source-labeled fallback score as the results table', () => {
    const html = renderToStaticMarkup(<EvidencePanel observation={luna} xMetric="cost" statistic="mean" scoreMetric="pass_at_1" />)
    expect(html).toContain('Different metric from selected pass@1')
    expect(html).toContain('Developer-reported DeepSWE score; exact score metric not specified')
    expect(html).toContain('66.6%')
  })

  it('shows the selected metric provenance and retains an optional alternative beside an approved value', () => {
    const luna = dataset.observations.find((observation) => observation.id === 'aa-codex-gpt-6-luna-max-v1.1')!
    const overlap = structuredClone(luna)
    overlap.metrics.outputTokens.value = 42
    overlap.metrics.outputTokens.statistic = 'mean'
    overlap.metrics.outputTokens.unit = 'output tokens'
    overlap.metrics.outputTokens.missingReason = null
    const scenario = usageScenarioForObservation(overlap, dataset.revisionId)
    const resolution = resolveXUsage(overlap, 'outputTokens', 'mean', {
      scenariosEnabled: true,
      strict: false,
      approvedDatasetRevision: dataset.revisionId,
    })
    const html = renderToStaticMarkup(<EvidencePanel
      observation={overlap}
      xMetric="outputTokens"
      statistic="mean"
      scoreMetric="pass_at_1"
      usageResolution={resolution}
      usageScenario={scenario}
    />)

    expect(resolution.evidenceKind).toBe('approved-measurement')
    expect(resolution.value).toBe(42)
    expect(resolution.alternatives[0]?.factIds).toContain('aa-output-gpt-6-luna-max')
    expect(html).toContain('Selected Output tokens per task coordinate')
    expect(html).toContain('approved selected-statistic measurement')
    expect(html).toContain('Alternative evidence for this metric')
    expect(html).toContain('aa-output-gpt-6-luna-max')
    expect(html).toContain('APPROVED MEAN MEASUREMENT · OPTIONAL EVIDENCE RETAINED')
  })

  it('keeps optional evidence visible with its exclusion reason when the selected view disallows it', () => {
    const luna = dataset.observations.find((observation) => observation.id === 'aa-codex-gpt-6-luna-max-v1.1')!
    const scenario = usageScenarioForObservation(luna, dataset.revisionId)
    const resolution = resolveXUsage(luna, 'outputTokens', 'median', {
      scenariosEnabled: false,
      strict: true,
      approvedDatasetRevision: dataset.revisionId,
    })
    const html = renderToStaticMarkup(<EvidencePanel
      observation={luna}
      xMetric="outputTokens"
      statistic="median"
      scoreMetric="pass_at_1"
      usageResolution={resolution}
      usageScenario={scenario}
    />)

    expect(html).toContain('Optional usage scenarios are excluded in strict mode.')
    expect(html).toContain('AA SOURCE-REPORTED DEEPSWE OUTPUT MEAN · COST EVIDENCE SEPARATE')
    expect(html).toContain('Source-reported mean · AA DeepSWE v1.1 output tokens / task attempt')
  })

  it('associates metric source IDs with hash status, available hashes, and locators', () => {
    const luna = dataset.observations.find((observation) => observation.id === 'aa-codex-gpt-6-luna-max-v1.1')!
    const overlap = structuredClone(luna)
    overlap.metrics.outputTokens.value = 42
    overlap.metrics.outputTokens.statistic = 'mean'
    overlap.metrics.outputTokens.unit = 'output tokens'
    overlap.metrics.outputTokens.missingReason = null
    const baseScenario = usageScenarioForObservation(overlap, dataset.revisionId)!
    const resolution = resolveXUsage(overlap, 'outputTokens', 'mean', {
      scenariosEnabled: true,
      approvedDatasetRevision: dataset.revisionId,
    })
    const selectedSourceId = overlap.provenance.sourceId
    const alternativeSourceId = resolution.alternatives[0]!.sourceIds[0]!
    const validHash = 'a'.repeat(64)
    const malformedHistoricalHash = 'f'.repeat(57)
    const scenario: UsageScenario = {
      ...baseScenario,
      sources: [
        {
          id: selectedSourceId,
          publisher: overlap.publisher,
          url: overlap.provenance.url!,
          accessedOn: overlap.provenance.retrievedAt,
          evidenceLocator: 'Approved output metric locator',
          responseSha256: validHash,
          hashStatus: 'validated',
        },
        {
          id: alternativeSourceId,
          publisher: 'Artificial Analysis',
          url: 'https://evidence.example/aa-output',
          accessedOn: '2026-09-29',
          evidenceLocator: 'Exact DeepSWE output field; historical capture hash was malformed',
          responseSha256: null,
          hashStatus: 'malformed-historical',
          historicalMalformedSha256: malformedHistoricalHash,
        },
        {
          id: 'unavailable-aa-capture',
          publisher: 'Artificial Analysis archive',
          url: 'https://evidence.example/aa-output',
          accessedOn: '2026-09-29',
          evidenceLocator: 'Archived capture has no recorded response digest',
          responseSha256: null,
          hashStatus: 'unavailable',
        },
      ],
    }
    const html = renderToStaticMarkup(<EvidencePanel
      observation={overlap}
      xMetric="outputTokens"
      statistic="mean"
      scoreMetric="pass_at_1"
      usageResolution={resolution}
      usageScenario={scenario}
    />)

    expect(html).toContain(`Selected metric source · ${overlap.publisher} · ${selectedSourceId}`)
    expect(html).toContain('Hash status: validated · response SHA-256:')
    expect(html).toContain(validHash)
    expect(html).toContain(`Locator: Approved output metric locator`)
    expect(html).toContain(`Alternative metric source · Artificial Analysis · ${alternativeSourceId}`)
    expect(html).toContain(`Hash status: malformed historical; not validated.`)
    expect(html).toContain('Historical hash (not a SHA-256):')
    expect(html).toContain(malformedHistoricalHash)
    expect(html).toContain('Hash status: unavailable; no response hash was recorded.')
    expect(html).toContain('Locator: Archived capture has no recorded response digest')
  })
})
