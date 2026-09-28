import type { ScoreMetric, SourceCategory, Statistic, XMetric } from './comparison'

export type ExplorerView = 'official' | 'combined' | 'review' | 'methodology' | 'sources'
export type EffortMode = 'all' | 'best'
export type AxisScale = 'linear' | 'log'

export interface ExplorerUrlState {
  view: ExplorerView
  xMetric: XMetric
  scale: AxisScale
  effortMode: EffortMode
  statistic: Statistic
  scoreMetric: ScoreMetric
  query: string
  selectedModels: string[]
  sources: SourceCategory[]
  version: string
  harness: string
  publisher: string
  strict: boolean
  strictGroup: string
  includeUsageScenarios: boolean
  connections: boolean
  selectedObservationId: string | null
}

export const defaultExplorerState: ExplorerUrlState = {
  view: 'combined',
  xMetric: 'cost',
  scale: 'linear',
  effortMode: 'all',
  statistic: 'mean',
  scoreMetric: 'pass_at_1',
  query: '',
  selectedModels: [],
  sources: ['organizer', 'developer', 'independent', 'local'],
  version: 'all',
  harness: 'all',
  publisher: 'all',
  strict: false,
  strictGroup: '',
  includeUsageScenarios: true,
  connections: true,
  selectedObservationId: null,
}

function isOneOf<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && values.includes(value as T)
}

const sources: SourceCategory[] = ['organizer', 'developer', 'independent', 'secondary', 'local']

export function parseExplorerUrl(search: string): ExplorerUrlState {
  const params = new URLSearchParams(search)
  const rawSources = params.get('sources')
  const selectedSources = rawSources === '-' ? [] : (rawSources ?? '').split(',').filter((source): source is SourceCategory => sources.includes(source as SourceCategory))
  return {
    view: isOneOf(params.get('view'), ['official', 'combined', 'review', 'methodology', 'sources']) ? params.get('view') as ExplorerView : defaultExplorerState.view,
    xMetric: isOneOf(params.get('x'), ['cost', 'outputTokens', 'time']) ? params.get('x') as XMetric : defaultExplorerState.xMetric,
    scale: isOneOf(params.get('scale'), ['linear', 'log']) ? params.get('scale') as AxisScale : defaultExplorerState.scale,
    effortMode: isOneOf(params.get('effort'), ['all', 'best']) ? params.get('effort') as EffortMode : defaultExplorerState.effortMode,
    statistic: isOneOf(params.get('stat'), ['mean', 'median']) ? params.get('stat') as Statistic : defaultExplorerState.statistic,
    scoreMetric: isOneOf(params.get('score'), ['pass_at_1', 'pass_at_4', 'reported_score_unspecified', 'task_pass_rate']) ? params.get('score') as ScoreMetric : defaultExplorerState.scoreMetric,
    query: params.get('q') ?? '',
    selectedModels: [...new Set(params.getAll('model').filter(Boolean))],
    sources: params.has('sources') ? [...new Set(selectedSources)] : defaultExplorerState.sources,
    version: params.get('version') ?? defaultExplorerState.version,
    harness: params.get('harness') ?? defaultExplorerState.harness,
    publisher: params.get('publisher') ?? defaultExplorerState.publisher,
    strict: params.get('strict') === '1',
    strictGroup: params.get('protocol') ?? '',
    includeUsageScenarios: params.get('scenarios') !== '0',
    connections: params.get('lines') !== '0',
    selectedObservationId: params.get('point') || null,
  }
}

export function serializeExplorerUrl(state: ExplorerUrlState): string {
  const params = new URLSearchParams()
  if (state.view !== defaultExplorerState.view) params.set('view', state.view)
  if (state.xMetric !== defaultExplorerState.xMetric) params.set('x', state.xMetric)
  if (state.scale !== defaultExplorerState.scale) params.set('scale', state.scale)
  if (state.effortMode !== defaultExplorerState.effortMode) params.set('effort', state.effortMode)
  if (state.statistic !== defaultExplorerState.statistic) params.set('stat', state.statistic)
  if (state.scoreMetric !== defaultExplorerState.scoreMetric) params.set('score', state.scoreMetric)
  if (state.query) params.set('q', state.query)
  if (state.selectedModels.length) [...state.selectedModels].sort().forEach((model) => params.append('model', model))
  if (state.sources.join(',') !== defaultExplorerState.sources.join(',')) params.set('sources', state.sources.length ? [...state.sources].sort().join(',') : '-')
  if (state.version !== defaultExplorerState.version) params.set('version', state.version)
  if (state.harness !== defaultExplorerState.harness) params.set('harness', state.harness)
  if (state.publisher !== defaultExplorerState.publisher) params.set('publisher', state.publisher)
  if (state.strict) params.set('strict', '1')
  if (state.strict && state.strictGroup) params.set('protocol', state.strictGroup)
  if (!state.includeUsageScenarios) params.set('scenarios', '0')
  if (!state.connections) params.set('lines', '0')
  if (state.selectedObservationId) params.set('point', state.selectedObservationId)
  return params.toString()
}
