import { describe, expect, it } from 'vitest'
import { defaultExplorerState, parseExplorerUrl, serializeExplorerUrl, type ExplorerUrlState } from '../src/lib/url-state'

describe('shareable query-state round trip', () => {
  it('round trips metric, series filters, selected models, scale, and evidence point', () => {
    const state: ExplorerUrlState = {
      ...defaultExplorerState,
      view: 'combined',
      xMetric: 'time',
      scale: 'log',
      effortMode: 'best',
      statistic: 'median',
      scoreMetric: 'reported_score_unspecified',
      query: 'Opus 5.5',
      selectedModels: ['provider/model,one', 'provider/model-two'],
      sources: ['developer', 'independent', 'local'],
      version: '1.1',
      harness: 'Claude Code',
      publisher: 'Artificial Analysis',
      strict: true,
      strictGroup: '{"version":"1.1","policy":"same"}',
      includeUsageScenarios: false,
      connections: false,
      selectedObservationId: 'report:opus-5.5',
    }
    const search = serializeExplorerUrl(state)
    expect(search).toContain('scenarios=0')
    expect(parseExplorerUrl(`?${search}`)).toEqual(state)
  })

  it('enables usage scenarios by default and restores the enabled state when the URL omits its opt-out', () => {
    expect(defaultExplorerState.includeUsageScenarios).toBe(true)
    expect(parseExplorerUrl('?x=outputTokens').includeUsageScenarios).toBe(true)
    expect(parseExplorerUrl('?scenarios=0').includeUsageScenarios).toBe(false)
  })

  it('round trips the source-defined task pass-rate metric', () => {
    const search = serializeExplorerUrl({ ...defaultExplorerState, scoreMetric: 'task_pass_rate' })
    expect(search).toContain('score=task_pass_rate')
    expect(parseExplorerUrl(`?${search}`).scoreMetric).toBe('task_pass_rate')
  })

  it('resets malformed choices to safe defaults without losing valid filters', () => {
    const state = parseExplorerUrl('?x=steps&scale=linear&view=combined&q=sol&model=a&model=b')
    expect(state.xMetric).toBe('cost')
    expect(state.view).toBe('combined')
    expect(state.query).toBe('sol')
    expect(state.selectedModels).toEqual(['a', 'b'])
  })
})
