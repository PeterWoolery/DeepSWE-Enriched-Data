import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResultsTable } from '../src/components/ResultsTable'
import { DatasetSchema } from '../src/lib/schema'
import { resolveXUsage, usageScenarioForObservation } from '../src/lib/usage-scenarios'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))

describe('ResultsTable selected usage evidence', () => {
  it('shows one approved selected-statistic value while retaining its scenario alternative', () => {
    const observation = structuredClone(dataset.observations.find((row) => row.id === 'aa-codex-gpt-6-luna-max-v1.1')!)
    observation.metrics.outputTokens.value = 42
    observation.metrics.outputTokens.unit = 'output tokens'
    observation.metrics.outputTokens.statistic = 'mean'
    observation.metrics.outputTokens.missingReason = null
    const scenario = usageScenarioForObservation(observation, dataset.revisionId)!
    const resolution = resolveXUsage(observation, 'outputTokens', 'mean', {
      scenariosEnabled: true,
      approvedDatasetRevision: dataset.revisionId,
    })
    const html = renderToStaticMarkup(<ResultsTable
      observations={[observation]}
      xMetric="outputTokens"
      statistic="mean"
      scoreMetric="pass_at_1"
      selectedId={null}
      usageResolutions={new Map([[observation.id, resolution]])}
      usageScenarios={new Map([[observation.id, scenario]])}
      chartSuppressions={new Map()}
      onSelect={() => undefined}
      onIsolate={() => undefined}
    />)

    expect(resolution.evidenceKind).toBe('approved-measurement')
    expect(resolution.value).toBe(42)
    expect(html).toContain('Approved selected-statistic measurement · mean')
    expect(html).toContain('Optional same-source aa deepswe output mean · not selected; approved mean value takes precedence')
    expect(html).toContain('aa-output-gpt-6-luna-max')
    expect(html).toContain('108,272 AA DeepSWE v1.1 output tokens / task attempt')
  })
})
