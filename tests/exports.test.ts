import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filteredCsvExport, filteredJsonExport, usageScenarioCsvExport, usageScenarioJsonExport } from '../src/lib/exports'
import { DatasetSchema } from '../src/lib/schema'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const observation = dataset.observations.find((row) => row.result.metric === 'pass_at_1' && row.additionalResults.some((result) => result.metric === 'pass_at_4'))!
const filters = {
  view: 'official', search: '', selectedModels: [], sources: ['organizer'], version: '1.1', harness: 'all', publisher: 'all', lastDeploymentAt: null, strict: false,
  effortMode: 'all', xMetric: 'time' as const, statistic: 'mean' as const, scoreMetric: 'pass_at_4' as const,
}

function csvFieldCount(line: string): number {
  let count = 1
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1
      else quoted = !quoted
    } else if (line[index] === ',' && !quoted) count += 1
  }
  return count
}

describe('approved-data exports', () => {
  it('exports selected pass@4 with its task denominator and snapshot/filter metadata', () => {
    const csv = filteredCsvExport(dataset, [observation], filters, '2026-09-26T17:00:00Z')
    expect(csv).toContain('# dataset_revision=')
    expect(csv).toContain('# x_metric=time')
    expect(csv).toContain('selected_score_metric')
    expect(csv).toContain('pass_at_4')
    expect(csv).toContain('unique tasks attempted')
    expect(csv).toContain(String(observation.additionalResults[0]!.denominatorCount))
    const json = filteredJsonExport(dataset, [observation], filters, '2026-09-26T17:00:00Z')
    expect(json.exportMetadata.observationCount).toBe(1)
    expect(json.exportMetadata.filters.scoreMetric).toBe('pass_at_4')
    expect(json.observations[0]?.id).toBe(observation.id)
  })

  it('keeps synthetic fixtures out of production exports and neutralizes formula-like CSV text', () => {
    const altered = structuredClone(observation)
    altered.model.reportedName = '=HYPERLINK("https://invalid.example")'
    const csv = filteredCsvExport(dataset, [altered], filters, '2026-09-26T17:00:00Z')
    expect(csv).toContain("'=HYPERLINK")
    const json = filteredJsonExport(dataset, [observation], filters, '2026-09-26T17:00:00Z')
    expect(json.observations.every((row) => !row.id.startsWith('fixture-') && !row.id.startsWith('synthetic-'))).toBe(true)
  })

  it('exports source-reported task cost separately from missing mean/median cost metrics', () => {
    const fireworks = dataset.observations.find((row) => row.id === 'fireworks-deepswe-deepseek-v4.1-flash-max')!
    expect(fireworks.metrics.cost.value).toBeNull()
    expect(fireworks.pricing.asReportedCost).toBe(0.43)
    const csv = filteredCsvExport(dataset, [fireworks], { ...filters, xMetric: 'cost' }, '2026-09-26T17:00:00Z')
    expect(csv).toContain('source_reported_cost_usd')
    expect(csv).toContain('source_reported_cost_basis')
    expect(csv).toContain('0.43')
    expect(csv).toContain('Cost/Task $0.430')
  })

  it('exports the raw reported score unit separately from its normalized numeric field', () => {
    const rawScore = dataset.observations.find((row) => row.id === 'deepseek-v4.1-flash-mini-swe-v1.1')!
    const csv = filteredCsvExport(dataset, [rawScore], { ...filters, scoreMetric: 'reported_score_unspecified' }, '2026-09-26T17:00:00Z')
    expect(csv).toContain('selected_score_normalized_value')
    expect(csv).toContain('selected_score_normalized_unit')
    expect(csv).toContain('selected_score_reported_unit')
    expect(csv).toContain('74.2')
    expect(csv).toContain('raw table value; unit unspecified')
    expect(csv).not.toContain('74.2%')
  })

  it('keeps scenario exports explicit and preserves unknown measurements as separate fields', () => {
    const luna = dataset.observations.find((row) => row.id === 'aa-codex-gpt-6-luna-max-v1.1')!
    const opus = dataset.observations.find((row) => row.id === 'artificial-analysis-claude-code-opus-5.5-max-v1.1')!
    const measuredJson = filteredJsonExport(dataset, [luna, opus], filters, '2026-09-26T17:00:00Z')
    const measuredCsv = filteredCsvExport(dataset, [luna, opus], filters, '2026-09-26T17:00:00Z')
    expect(measuredJson.observations.every((row) => row.metrics.cost.value === null && row.metrics.outputTokens.value === null)).toBe(true)
    expect(measuredCsv).not.toContain('scenario_mean_cost_usd')
    expect(measuredCsv).toContain('mean_cost_usd')

    const allJson = usageScenarioJsonExport(dataset, dataset.observations, filters, 'all', '2026-09-26T17:00:00Z')
    expect(allJson.exportMetadata.exportType).toBe('estimated-usage-scenarios-only')
    expect(allJson.exportMetadata.observationsAreNotModified).toBe(true)
    expect(allJson.scenarios).toHaveLength(7)
    const lunaRecord = allJson.scenarios.find((record) => record.targetObservationId === luna.id)!
    expect(lunaRecord.recordType).toBe('estimated_usage_scenario')
    expect(lunaRecord.measurement.meanCostUsd).toBeNull()
    expect(lunaRecord.measurement.meanOutputTokens).toBeNull()
    expect(lunaRecord.scenario.meanCostUsdPerScoredAttempt).toBeCloseTo(0.20668317244049378, 12)
    expect(lunaRecord.scenario.meanOutputTokensPerScoredAttempt).toBeCloseTo(98_421.65603779937, 7)
    expect(lunaRecord.scenario.meanReportedSecondsPerScoredAttempt).toBeCloseTo(1097.5267854181109, 7)
    expect(lunaRecord.scenario.aaCodingSuiteMixedTokensPerTask).toBe(10_200_000)
    expect(lunaRecord.scenario.timeCalibrationMethod).toBe('openai-max-arithmetic-mean-ratio')
    expect(lunaRecord.scenario.sources).toHaveLength(3)

    const filteredJson = usageScenarioJsonExport(dataset, [luna], filters, 'filtered', '2026-09-26T17:00:00Z')
    expect(filteredJson.scenarios).toHaveLength(1)
    expect(filteredJson.scenarios[0]?.targetObservationId).toBe(luna.id)
    const developerOnly = usageScenarioJsonExport(dataset, [dataset.observations.find((row) => row.id === 'openai-gpt-6-luna-v1.1-max')!], filters, 'filtered')
    expect(developerOnly.scenarios).toEqual([])

    const csv = usageScenarioCsvExport(dataset, [luna, opus], filters, 'filtered', '2026-09-26T17:00:00Z')
    expect(csv).toContain('# export_type=estimated-usage-scenarios-only')
    expect(csv).toContain('measurement_mean_cost_usd')
    expect(csv).toContain('scenario_mean_cost_usd_per_attempt')
    expect(csv).toContain('scenario_mean_output_tokens_per_attempt')
    expect(csv).toContain('scenario_mean_reported_seconds_per_attempt')
    expect(csv).toContain('scenario_confidence_quality')
    expect(csv).toContain('time_calibration_rows_json')
    expect(csv).toContain('sensitivity_note')
    expect(csv).toContain('aa-codex-vs-kimi-code-cli')
    const csvRows = csv.trimEnd().split('\n').filter((line) => !line.startsWith('#'))
    expect(new Set(csvRows.map(csvFieldCount)).size).toBe(1)
  })
})
