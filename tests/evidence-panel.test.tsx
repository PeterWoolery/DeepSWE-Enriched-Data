import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EvidencePanel } from '../src/components/EvidencePanel'
import { DatasetSchema } from '../src/lib/schema'

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
})
