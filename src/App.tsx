import { useEffect, useMemo, useRef, useState } from 'react'
import { ExplorerChart } from './components/ExplorerChart'
import { EvidencePanel } from './components/EvidencePanel'
import { MethodologyPage } from './components/MethodologyPage'
import { ResultsTable } from './components/ResultsTable'
import { ReviewQueue } from './components/ReviewQueue'
import { SourcesPage } from './components/SourcesPage'
import { displayModelName, displayScoreResult, displayScoreValue, filterObservations, getEfficiencyCoverage, hasPercentageScoreScale, modelKey, projectBest, scoreMetricLabels, scoreResult, strictExclusionReason, strictProtocolGroups, xMetricLabels, type ScoreMetric, type SourceCategory, type XMetric } from './lib/comparison'
import { downloadText, filteredCsvExport, filteredJsonExport, usageScenarioCsvExport, usageScenarioJsonExport } from './lib/exports'
import { CandidateQueueSchema, DatasetSchema, type Candidate, type Dataset, type Observation } from './lib/schema'
import { defaultExplorerState, parseExplorerUrl, serializeExplorerUrl, type ExplorerUrlState, type ExplorerView } from './lib/url-state'
import { usageScenarioForComparison } from './lib/usage-scenarios'

interface SourceEntry {
  id: string
  publisher: string
  title: string
  url: string | null
  category: string
  status: string
  sha256: string | null
  license?: string
  accessAndReuse: string
  notes: string[]
}

const baseUrl = import.meta.env.BASE_URL
const deployedAt = import.meta.env.VITE_DEPLOYED_AT || null
const sourceCategories: SourceCategory[] = ['organizer', 'developer', 'independent', 'secondary', 'local']
const sourceLabels: Record<SourceCategory, string> = {
  organizer: 'Organizer', developer: 'Developer', independent: 'Independent', secondary: 'Secondary', local: 'Local evaluation',
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}).`)
  return response.json()
}

function freshness(lastChecked: string): { stale: boolean; label: string } {
  const age = Date.now() - Date.parse(lastChecked)
  const stale = !Number.isFinite(age) || age > 72 * 60 * 60 * 1000
  const hours = Number.isFinite(age) ? Math.max(0, Math.floor(age / 3_600_000)) : null
  return { stale, label: hours === null ? 'check date unknown' : hours < 24 ? `checked ${hours}h ago` : `checked ${Math.floor(hours / 24)}d ago` }
}

function App() {
  const [state, setState] = useState<ExplorerUrlState>(() => parseExplorerUrl(window.location.search))
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [sources, setSources] = useState<SourceEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null)
  const [connections, setConnections] = useState(state.connections)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('deepswe-theme') === 'dark' ? 'dark' : 'light')
  const [announcement, setAnnouncement] = useState('')
  const [modelMenuSearch, setModelMenuSearch] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetchJson('data/observations.json'),
      fetchJson('data/candidates.json'),
      fetchJson('data/source-registry.json'),
    ]).then(([data, queue, registry]) => {
      if (!active) return
      const parsedData = DatasetSchema.parse(data)
      const parsedQueue = CandidateQueueSchema.parse(queue)
      setDataset(parsedData)
      setCandidates(parsedQueue.candidates)
      if (typeof registry === 'object' && registry !== null && 'sources' in registry && Array.isArray(registry.sources)) {
        setSources(registry.sources as SourceEntry[])
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load the approved snapshot.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const next = serializeExplorerUrl({ ...state, connections })
    const target = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', target)
  }, [state, connections])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('deepswe-theme', theme)
  }, [theme])

  const stateWithConnections = useMemo(() => ({ ...state, connections }), [state, connections])
  const pageObservations = useMemo(() => {
    if (!dataset) return []
    return state.view === 'official'
      ? dataset.observations.filter((observation) => observation.provenance.sourceId === dataset.sourceRetrieval.sourceId)
      : dataset.observations
  }, [dataset, state.view])

  const availableModels = useMemo(() => {
    const seen = new Map<string, Observation>()
    for (const observation of pageObservations) {
      if (!state.sources.includes(observation.sourceCategory)) continue
      seen.set(modelKey(observation), observation)
    }
    const models = [...seen.entries()].map(([key, observation]) => ({
      key,
      observation,
      label: displayModelName(observation.model.reportedName),
    }))
    const labelCounts = new Map<string, number>()
    for (const model of models) labelCounts.set(model.label, (labelCounts.get(model.label) ?? 0) + 1)
    return models.map(({ key, observation, label }) => ({
      key,
      label: labelCounts.get(label)! > 1
        ? `${label} — ${observation.publisher} · ${observation.series.harness ?? 'harness unknown'}`
        : label,
    })).sort((left, right) => left.label.localeCompare(right.label))
  }, [pageObservations, state.sources])

  const versions = useMemo(() => [...new Set(pageObservations.map((observation) => observation.benchmark.version).filter((version): version is string => Boolean(version)))].sort(), [pageObservations])
  const harnesses = useMemo(() => [...new Set(pageObservations.map((observation) => observation.series.harness ?? 'unknown'))].sort(), [pageObservations])
  const publishers = useMemo(() => [...new Set(pageObservations.map((observation) => observation.publisher))].sort(), [pageObservations])
  const filterState = useMemo(() => ({
    view: state.view === 'official' ? 'official' as const : 'combined' as const,
    query: state.query,
    selectedModels: state.selectedModels,
    sources: state.sources,
    version: state.version,
    harness: state.harness,
    publisher: state.publisher,
    strict: false,
    strictGroup: '',
    statistic: state.statistic,
    scoreMetric: state.scoreMetric,
  }), [state])
  const unstrictObservations = useMemo(() => filterObservations(pageObservations, filterState, state.xMetric), [pageObservations, filterState, state.xMetric])
  const strictGroups = useMemo(() => strictProtocolGroups(unstrictObservations, state.xMetric, state.statistic, state.scoreMetric), [unstrictObservations, state.xMetric, state.statistic, state.scoreMetric])
  const filteredObservations = useMemo(() => state.strict
    ? filterObservations(pageObservations, { ...filterState, strict: true, strictGroup: state.strictGroup }, state.xMetric)
    : unstrictObservations,
  [pageObservations, filterState, unstrictObservations, state.strict, state.strictGroup, state.xMetric])

  const scoreMetrics = useMemo(() => [...new Set((dataset?.observations ?? []).flatMap((observation) => [observation.result.metric, ...observation.additionalResults.map((result) => result.metric)]))] as ScoreMetric[], [dataset])
  const displayedObservations = useMemo(() => {
    if (state.effortMode === 'all') return filteredObservations
    const best = projectBest(filteredObservations, state.scoreMetric)
    const bestIds = new Set(best.map((observation) => observation.id))
    return filteredObservations.filter((observation) => !scoreResult(observation, state.scoreMetric) || bestIds.has(observation.id))
  }, [filteredObservations, state.effortMode, state.scoreMetric])

  const visibleUsageScenarios = useMemo(() => {
    if (!state.includeUsageScenarios) return []
    return displayedObservations.flatMap((observation) => {
      const scenario = usageScenarioForComparison(observation, state.xMetric, state.statistic, state.strict)
      return scenario ? [{ observation, scenario }] : []
    })
  }, [displayedObservations, state.includeUsageScenarios, state.xMetric, state.statistic, state.strict])
  const usageScenariosByObservationId = useMemo(() => new Map(visibleUsageScenarios.map(({ observation, scenario }) => [observation.id, scenario])), [visibleUsageScenarios])

  const chartScoreDetails = useMemo(() => displayedObservations.map((observation) => ({ observation, score: displayScoreResult(observation, state.scoreMetric) })), [displayedObservations, state.scoreMetric])
  const chartScoreMetrics = new Set(chartScoreDetails.filter(({ score }) => hasPercentageScoreScale(score)).map(({ score }) => score.metric))
  const chartHasMixedDefinitions = chartScoreMetrics.size > 1 || chartScoreDetails.some(({ score }) => score.metric !== state.scoreMetric && hasPercentageScoreScale(score))
  const chartHasUnscaledScores = chartScoreDetails.some(({ score }) => !hasPercentageScoreScale(score))
  const chartableObservations = useMemo(() => chartScoreDetails.filter(({ score }) => hasPercentageScoreScale(score)).map(({ observation }) => observation), [chartScoreDetails])
  const scoreCompatible = useMemo(() => displayedObservations.filter((observation) => scoreResult(observation, state.scoreMetric)), [displayedObservations, state.scoreMetric])
  const coverage = useMemo(() => getEfficiencyCoverage(scoreCompatible, state.xMetric, state.statistic), [scoreCompatible, state.xMetric, state.statistic])
  const scoreOnly = useMemo(() => chartScoreDetails.filter(({ observation }) => {
    const metric = state.xMetric === 'cost'
      ? state.statistic === 'mean' ? observation.metrics.cost : observation.metrics.medianCost
      : state.xMetric === 'outputTokens'
        ? state.statistic === 'mean' ? observation.metrics.outputTokens : observation.metrics.medianOutputTokens
        : state.statistic === 'mean' ? observation.metrics.time : observation.metrics.medianTime
    return metric.value === null
  }), [chartScoreDetails, state.xMetric, state.statistic])
  const legendSeries = useMemo(() => {
    const groups = new Map<string, Observation[]>()
    for (const observation of chartableObservations) {
      const series = groups.get(observation.series.id) ?? []
      series.push(observation)
      groups.set(observation.series.id, series)
    }
    return [...groups.entries()].map(([id, rows]) => ({ id, first: rows[0]!, count: rows.length }))
      .sort((a, b) => displayModelName(a.first.model.reportedName).localeCompare(displayModelName(b.first.model.reportedName)))
  }, [chartableObservations])

  const selectedObservation = dataset?.observations.find((observation) => observation.id === state.selectedObservationId) ?? null
  const sourceFreshness = dataset ? freshness(dataset.lastSuccessfulCheckAt) : null
  const strictIncomplete = state.strict ? unstrictObservations.filter((observation) => strictExclusionReason(observation, state.xMetric, state.statistic, state.scoreMetric)).length : 0
  const strictExcluded = unstrictObservations.length - filteredObservations.length
  const strictReasons = state.strict ? unstrictObservations.reduce<Record<string, number>>((counts, observation) => {
    const reason = strictExclusionReason(observation, state.xMetric, state.statistic, state.scoreMetric)
    if (reason) counts[reason] = (counts[reason] ?? 0) + 1
    return counts
  }, {}) : {}
  const selectedStrictGroupAvailable = strictGroups.some((group) => group.key === state.strictGroup)

  function update(patch: Partial<ExplorerUrlState>) {
    const comparisonChanged = ['view', 'query', 'selectedModels', 'sources', 'version', 'harness', 'publisher', 'xMetric', 'statistic', 'scoreMetric'].some((key) => key in patch) || patch.strict !== undefined
    setState((current) => ({ ...current, ...patch, ...(comparisonChanged && patch.strictGroup === undefined ? { strictGroup: '' } : {}) }))
    if (patch.connections !== undefined) setConnections(patch.connections)
  }

  function selectObservation(id: string) {
    update({ selectedObservationId: id })
  }

  function isolateModel(modelId: string) {
    update({ selectedModels: [modelId] })
    setAnnouncement('Showing the selected model only. Use Reset filters to restore all models.')
  }

  function toggleSource(category: SourceCategory) {
    update({ sources: state.sources.includes(category) ? state.sources.filter((item) => item !== category) : [...state.sources, category] })
  }

  function toggleModel(modelId: string) {
    update({ selectedModels: state.selectedModels.includes(modelId) ? state.selectedModels.filter((item) => item !== modelId) : [...state.selectedModels, modelId] })
  }

  function resetAll() {
    setState(defaultExplorerState)
    setConnections(true)
    setModelMenuSearch('')
    setAnnouncement('Filters reset to Combined reports, all configurations, cost per task, and linear scale.')
  }

  async function copyShareUrl() {
    const query = serializeExplorerUrl(stateWithConnections)
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`
    try {
      await navigator.clipboard.writeText(url)
      setAnnouncement('Share URL copied.')
    } catch {
      setAnnouncement(url)
    }
  }

  function exportChartSvg() {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(svgRef.current.viewBox.baseVal.width))
    clone.setAttribute('height', String(svgRef.current.viewBox.baseVal.height))
    const styles = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styles.textContent = ':root{--paper-strong:#fbf9f2;--ink:#1d2624;--ink-soft:#4d5b57;--ink-faint:#78817b;--line:#cfc8b9;--line-strong:#aaa493;--teal:#006d68;--amber:#bd661d;--teal-soft:#dce9e4}.grid-line{stroke:#cfc8b9;stroke-width:1;stroke-dasharray:2 5}.axis-line{stroke:#aaa493;stroke-width:1.2}.tick-label{fill:#78817b;font:10px monospace}.axis-title{fill:#4d5b57;font:9px monospace;letter-spacing:.11em}.curve-path{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.point-hit-area{fill:transparent;stroke:transparent}.no-data-lane{fill:#f4f0e5;stroke:#cfc8b9;stroke-dasharray:3 4}.no-data-lane-divider{stroke:#aaa493;stroke-width:1.2;stroke-dasharray:3 4}.no-data-lane-title,.no-data-lane-count{fill:#9a551d;font:10px monospace;letter-spacing:.08em}.no-data-lane-note{fill:#78817b;font:8px monospace}.confidence-mark line{stroke:#1d2624;stroke-width:1.25}.point-label{fill:#1d2624;font:10px monospace;paint-order:stroke;stroke:#fbf9f2;stroke-width:3px}.selected-guide{pointer-events:none}.selected-guide-line{fill:none;stroke:#006d68;stroke-width:1.5;stroke-dasharray:4 3}.selected-guide.is-estimated .selected-guide-line{stroke:#bd661d;stroke-dasharray:2 3}.selected-guide-label{fill:#006d68;font:10px monospace;font-weight:700;paint-order:stroke;stroke:#fbf9f2;stroke-width:4px;stroke-linejoin:round}.selected-guide.is-estimated .selected-guide-label{fill:#bd661d}.selected-guide-missing-label{fill:#bd661d;font:9px monospace;font-weight:700;paint-order:stroke;stroke:#fbf9f2;stroke-width:4px;stroke-linejoin:round}'
    styles.textContent += '.estimated-diamond{fill:#fbf9f2;stroke:#bd661d;stroke-width:2.4;stroke-dasharray:2 2}.estimated-label{fill:#bd661d;font:9px monospace;paint-order:stroke;stroke:#fbf9f2;stroke-width:3px}'
    clone.insertBefore(styles, clone.firstChild)
    const svg = new XMLSerializer().serializeToString(clone)
    downloadText(`deepswe-${state.xMetric}-${state.scoreMetric}-${dataset?.revisionId ?? 'snapshot'}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, 'image/svg+xml')
    setAnnouncement('Current filtered chart saved as SVG.')
  }

  function exportFiltered(format: 'json' | 'csv') {
    if (!dataset) return
    const filters = {
      view: state.view,
      search: state.query,
      selectedModels: state.selectedModels,
      sources: state.sources,
      version: state.version,
      harness: state.harness,
      publisher: state.publisher,
      lastDeploymentAt: deployedAt,
      strict: state.strict,
      includeUsageScenarios: state.includeUsageScenarios,
      effortMode: state.effortMode,
      xMetric: state.xMetric,
      statistic: state.statistic,
      scoreMetric: state.scoreMetric,
    }
    if (format === 'json') {
      downloadText('deepswe-filtered-observations.json', `${JSON.stringify(filteredJsonExport(dataset, displayedObservations, filters), null, 2)}\n`, 'application/json')
    } else {
      downloadText('deepswe-filtered-observations.csv', filteredCsvExport(dataset, displayedObservations, filters), 'text/csv;charset=utf-8')
    }
    setAnnouncement(`Filtered ${format.toUpperCase()} export downloaded with revision and filter metadata.`)
  }

  function exportUsageScenarios(format: 'json' | 'csv', scope: 'filtered' | 'all') {
    if (!dataset) return
    const filters = {
      view: state.view,
      search: state.query,
      selectedModels: state.selectedModels,
      sources: state.sources,
      version: state.version,
      harness: state.harness,
      publisher: state.publisher,
      lastDeploymentAt: deployedAt,
      strict: state.strict,
      includeUsageScenarios: state.includeUsageScenarios,
      effortMode: state.effortMode,
      xMetric: state.xMetric,
      statistic: state.statistic,
      scoreMetric: state.scoreMetric,
    }
    const observations = scope === 'all' ? dataset.observations : visibleUsageScenarios.map(({ observation }) => observation)
    const filename = `deepswe-${scope}-usage-scenarios.${format}`
    const text = format === 'json'
      ? `${JSON.stringify(usageScenarioJsonExport(dataset, observations, filters, scope), null, 2)}\n`
      : usageScenarioCsvExport(dataset, observations, filters, scope)
    downloadText(filename, text, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8')
    setAnnouncement(`${scope === 'all' ? 'All' : 'Filtered'} usage scenario ${format.toUpperCase()} export downloaded separately from measured observations.`)
  }

  if (loadError) {
    return <main className="load-error" role="alert"><span className="section-kicker">APPROVED SNAPSHOT UNAVAILABLE</span><h1>Data could not be loaded.</h1><p>{loadError}</p><p>Build the site with <code>npm run build</code> to generate its same-origin approved data assets. The browser does not fetch upstream benchmark data.</p></main>
  }
  if (!dataset || !sourceFreshness) {
    return <main className="loading-state" aria-live="polite"><span className="loading-orbit" aria-hidden="true">◉</span><p>Opening the DeepSWE observation atlas…</p></main>
  }

  if (state.view === 'review') return (
    <div className="app-shell" data-theme={theme}>
      <SiteHeader state={state} onView={(view) => update({ view })} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
      <ReviewQueue candidates={candidates} />
      <SiteFooter revisionId={dataset.revisionId} checkedAt={dataset.lastSuccessfulCheckAt} deployedAt={deployedAt} onView={(view) => update({ view })} />
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  )
  if (state.view === 'methodology') return (
    <div className="app-shell" data-theme={theme}>
      <SiteHeader state={state} onView={(view) => update({ view })} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
      <MethodologyPage dataset={dataset} />
      <SiteFooter revisionId={dataset.revisionId} checkedAt={dataset.lastSuccessfulCheckAt} deployedAt={deployedAt} onView={(view) => update({ view })} />
    </div>
  )
  if (state.view === 'sources') return (
    <div className="app-shell" data-theme={theme}>
      <SiteHeader state={state} onView={(view) => update({ view })} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
      <SourcesPage sources={sources} />
      <SiteFooter revisionId={dataset.revisionId} checkedAt={dataset.lastSuccessfulCheckAt} deployedAt={deployedAt} onView={(view) => update({ view })} />
    </div>
  )

  const modelSearch = modelMenuSearch.trim().toLowerCase()
  const visibleModelOptions = availableModels.filter((model) => model.label.toLowerCase().includes(modelSearch))
  const selectedCount = displayedObservations.length
  const sourceCountText = `${dataset.sourceRetrieval.rowCount} official configurations · ${dataset.observations.length - dataset.sourceRetrieval.rowCount} approved supplemental reports`
  return (
    <div className="app-shell" data-theme={theme}>
      <a className="skip-link" href="#main-content">Skip to results</a>
      <SiteHeader state={state} onView={(view) => update({ view })} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />

      <main id="main-content">
        <section className="hero page-wrap">
          <div className="hero-topline"><span className="live-mark"><i aria-hidden="true" /> SOURCE-ATTRIBUTED SNAPSHOT</span><span className="hero-date">DEEPSWE v1.1 · UNOFFICIAL EXPLORER</span></div>
          <div className="hero-layout">
            <div className="hero-copy">
              <p className="hero-deck">A field guide to reported DeepSWE scores and the resources behind them. Follow each model’s own effort path—cost, output tokens, and reported time—without blending experiments.</p>
      <div className="hero-note"><span aria-hidden="true">↳</span><span>Measured curves connect only reported configurations. Hollow diamonds, when enabled, are separate usage scenarios—not measurements or interpolated effort levels.</span></div>
            </div>
            <div className="hero-aside">
              <span className="side-index">01 / MEASUREMENT ATLAS</span>
              <p>Compare configurations on two numeric axes. The path order is source-backed effort—not a sorting trick.</p>
              <div className="snapshot-count"><strong>{dataset.sourceRetrieval.rowCount}</strong><span>official configurations<br />in this snapshot</span></div>
              <span className="snapshot-source">{sourceCountText}</span>
            </div>
          </div>
          <div className="hero-bottomline"><span>DATA REVISION {dataset.revisionId}</span><span>LAST DATA CHANGE {new Date(dataset.lastDataChangeAt).toLocaleDateString()}</span><span className={sourceFreshness.stale ? 'stale-text' : ''}>{sourceFreshness.stale ? 'SOURCE CHECK STALE' : sourceFreshness.label.toUpperCase()}</span><span>{deployedAt ? `LAST DEPLOYED ${new Date(deployedAt).toLocaleString()}` : 'LOCAL BUILD · DEPLOYMENT NOT RECORDED'}</span></div>
        </section>

        <div className="page-wrap">
          {sourceFreshness.stale && <div className="stale-banner" role="status"><strong>Snapshot may be stale.</strong> The last approved upstream check was {sourceFreshness.label}. Scheduled checks can pause; the approved snapshot remains available offline.</div>}
          <div className="view-switcher" role="tablist" aria-label="Results view">
            <button type="button" role="tab" aria-selected={state.view === 'official'} className={state.view === 'official' ? 'active-tab' : ''} onClick={() => update({ view: 'official' })}>Official <span>{dataset.sourceRetrieval.rowCount}</span></button>
            <button type="button" role="tab" aria-selected={state.view === 'combined'} className={state.view === 'combined' ? 'active-tab' : ''} onClick={() => update({ view: 'combined' })}>Combined reports <span>{dataset.observations.length}</span></button>
            <button type="button" role="tab" aria-selected={false} onClick={() => update({ view: 'review' })}>Review queue <span>{candidates.length}</span></button>
              <div className="view-secondary-links"><button type="button" onClick={() => update({ view: 'methodology' })}>Methodology</button><button type="button" onClick={() => update({ view: 'sources' })}>Sources</button></div>
          </div>

          <section className="filters-panel" aria-labelledby="filters-title">
            <div className="filters-heading"><div><span className="section-kicker">COMPARISON CONTROLS</span><h2 id="filters-title">Shape the view</h2></div><button className="text-button reset-button" type="button" onClick={resetAll}>Reset all</button></div>
            <div className="filters-grid">
              <label className="search-control"><span>Search models / publishers</span><input value={state.query} onChange={(event) => update({ query: event.target.value })} placeholder="e.g. Claude, OpenAI…" type="search" /></label>
              <label><span>Benchmark version</span><select value={state.version} onChange={(event) => update({ version: event.target.value })}><option value="all">All versions</option>{versions.map((version) => <option key={version} value={version}>DeepSWE v{version}</option>)}</select></label>
              <label><span>Publisher / source</span><select value={state.publisher} onChange={(event) => update({ publisher: event.target.value })}><option value="all">All publishers</option>{publishers.map((publisher) => <option key={publisher} value={publisher}>{publisher}</option>)}</select></label>
              <label><span>Harness / protocol</span><select value={state.harness} onChange={(event) => update({ harness: event.target.value })}><option value="all">All reported harnesses</option>{harnesses.map((harness) => <option key={harness} value={harness}>{harness === 'unknown' ? 'Not reported' : harness}</option>)}</select></label>
              <label><span>Score metric on Y</span><select value={state.scoreMetric} onChange={(event) => update({ scoreMetric: event.target.value as ScoreMetric })}>{scoreMetrics.map((metric) => <option key={metric} value={metric}>{scoreMetricLabels[metric]}</option>)}</select></label>
              <details className="model-picker">
                <summary>Models <span>{state.selectedModels.length ? `${state.selectedModels.length} selected` : 'All models'}</span></summary>
                <div className="model-picker-body">
                  <input aria-label="Search model list" placeholder="Filter model list" value={modelMenuSearch} onChange={(event) => setModelMenuSearch(event.target.value)} />
                  <button className="text-button" type="button" onClick={() => update({ selectedModels: [] })}>Select all</button>
                  <div className="model-picker-list">
                    {visibleModelOptions.map((model) => <label key={model.key}><input type="checkbox" checked={state.selectedModels.includes(model.key)} onChange={() => toggleModel(model.key)} /><span>{model.label}</span></label>)}
                    {visibleModelOptions.length === 0 && <p>No model matches.</p>}
                  </div>
                </div>
              </details>
              <fieldset className="source-filter">
                <legend>Source type</legend>
                {sourceCategories.map((category) => <label key={category} className={`source-toggle source-toggle-${category}`}><input type="checkbox" checked={state.sources.includes(category)} onChange={() => toggleSource(category)} /><span>{category === 'organizer' ? '●' : category === 'developer' ? '◆' : category === 'independent' ? '▲' : category === 'local' ? '■' : '◇'}</span>{sourceLabels[category]}</label>)}
              </fieldset>
              <label className="strict-toggle"><input type="checkbox" checked={state.strict} onChange={(event) => update({ strict: event.target.checked })} /><span><strong>Strict comparisons</strong><small>Require known protocol and metric scope</small></span></label>
            </div>
          </section>

          <section className="chart-section" aria-labelledby="chart-title">
            <div className="section-title-row">
              <div><span className="section-kicker">THE EFFORT CURVE</span><h2 id="chart-title">One series. One path.</h2><p className="section-deck">Measured paths stay inside one evaluator, model, benchmark, and harness series. Usage scenarios are isolated marks and never join an effort path.</p></div>
              <div className="display-projection" role="group" aria-label="Configuration projection"><span>CONFIGURATIONS</span><button type="button" className={state.effortMode === 'all' ? 'selected' : ''} aria-pressed={state.effortMode === 'all'} onClick={() => update({ effortMode: 'all' })}>All levels</button><button type="button" className={state.effortMode === 'best' ? 'selected' : ''} aria-pressed={state.effortMode === 'best'} onClick={() => update({ effortMode: 'best' })}>Best only</button></div>
            </div>

            <div className="metric-toolbar">
              <div className="metric-choice" role="group" aria-label="Horizontal axis metric">
                {(Object.keys(xMetricLabels) as XMetric[]).map((metric) => <button key={metric} type="button" className={state.xMetric === metric ? 'active-metric' : ''} aria-pressed={state.xMetric === metric} onClick={() => update({ xMetric: metric })}>{xMetricLabels[metric].label}</button>)}
              </div>
              <div className="metric-options">
                <div className="metric-toggle" role="group" aria-label="Efficiency statistic"><button type="button" className={state.statistic === 'mean' ? 'selected' : ''} aria-pressed={state.statistic === 'mean'} onClick={() => update({ statistic: 'mean' })}>Mean</button><button type="button" className={state.statistic === 'median' ? 'selected' : ''} aria-pressed={state.statistic === 'median'} onClick={() => update({ statistic: 'median' })}>Median</button></div>
                <div className="metric-toggle" role="group" aria-label="Horizontal axis scale"><button type="button" className={state.scale === 'linear' ? 'selected' : ''} aria-pressed={state.scale === 'linear'} onClick={() => update({ scale: 'linear' })}>Linear</button><button type="button" className={state.scale === 'log' ? 'selected' : ''} aria-pressed={state.scale === 'log'} onClick={() => update({ scale: 'log' })}>Log</button></div>
                <label className="line-toggle"><input type="checkbox" checked={connections} onChange={(event) => { setConnections(event.target.checked); update({ connections: event.target.checked }) }} /> Connect levels</label>
                <label className="scenario-toggle"><input type="checkbox" checked={state.includeUsageScenarios} onChange={(event) => update({ includeUsageScenarios: event.target.checked })} /><span><strong>Include usage scenarios</strong><small>Estimated · low / very low evidence quality · not measured</small></span></label>
              </div>
            </div>

            {state.xMetric === 'time' && <div className="timing-scope-note"><strong>Reported time, scope incomplete.</strong> Measured values are source-reported seconds per scored rollout attempt; timer boundaries and duration-specific sample counts are not reported. Strict timing comparison excludes these rows. Optional scenarios are separate and are not verified end-to-end durations.</div>}
            {state.xMetric === 'outputTokens' && <div className="timing-scope-note token-scope-note"><strong>Output-token semantics are not fully matched.</strong> Reasoning-token inclusion is unknown for most configurations; strict comparisons require it to be known.</div>}
            {state.includeUsageScenarios && state.strict && <div className="usage-scenario-note" role="note"><strong>Strict comparison excludes usage scenarios.</strong> Only source-reported measurements are considered in strict groups.</div>}
            {state.includeUsageScenarios && !state.strict && state.statistic === 'median' && <div className="usage-scenario-note" role="note"><strong>Scenarios are mean-only.</strong> Median remains limited to source-reported measurements; scenario targets without median values are listed in the no-data gutter.</div>}
            {state.includeUsageScenarios && !state.strict && state.statistic === 'mean' && visibleUsageScenarios.length > 0 && <div className="usage-scenario-note" role="note">
              <strong>Estimated usage scenarios · not DeepSWE measurements.</strong> Hollow diamonds are standalone, mean-only scenarios for exact Artificial Analysis model/effort observations. The separate developer reports do not inherit them when their evaluation harness/protocol is unknown.
              <ul>{visibleUsageScenarios.map(({ observation, scenario }) => {
                const value = state.xMetric === 'cost'
                  ? `$${scenario.costUsdPerScoredAttempt.toFixed(2)}/attempt`
                  : state.xMetric === 'outputTokens'
                    ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(scenario.outputTokensPerScoredAttempt)} output tokens/attempt`
                    : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(scenario.timeSecondsPerScoredAttempt / 60)} min/attempt`
                const range = state.xMetric === 'cost' ? scenario.costSensitivityRange : state.xMetric === 'outputTokens' ? scenario.outputTokenSensitivityRange : scenario.timeSensitivityRange
                return <li key={scenario.id}>{observation.model.reportedName}: {scenario.confidence === 'low' ? 'low' : 'very low'} qualitative evidence; {value}{range ? ' · observed small-sample sensitivity only, not a confidence interval' : ' · no defensible range or prediction interval'}.</li>
              })}</ul>
              {state.xMetric === 'outputTokens'
                ? <p>Only output-only Intelligence Index counts or exact-model/effort DeepSWE measurements support output scenarios. Coding Agent suite totals mix input, cache, cache-write, reasoning, and output; they are never displayed as output tokens.</p>
                : state.xMetric === 'cost'
                  ? <p>Cost scenarios use separate source-reported DeepSWE rows or calibrated suite-cost transfer. Cost is not derived from scores, output counts, or current rate cards; source price-basis gaps make the sensitivity envelope especially wide.</p>
                  : <p>Time scenarios use measured per-task wall-clock pairs or an exact-model/effort DeepSWE reference. AA pools multiple benchmarks and Datacurve timer boundaries are unspecified; these are reported-time scenarios, not verified end-to-end durations.</p>}
              <p>Evidence grades are qualitative, not probabilities. Sensitivity envelopes are observed sample ranges, not confidence or prediction intervals. Strict comparisons exclude scenarios.</p>
            </div>}
            {(state.scoreMetric === 'reported_score_unspecified' || chartHasMixedDefinitions || chartHasUnscaledScores) && <div className="metric-chart-warning" role="note"><strong>Source scores retain their own definitions.</strong> Only explicit percentage/fraction values use the score axis; raw values with unspecified units are omitted. Each mark keeps its source metric and protocol—percent values alone do not make different evaluations comparable.</div>}
              {state.strict && <div className="strict-note" role="status">
                <div className="strict-note-copy"><strong>Strict mode groups exact known protocols.</strong><span>Protocol, task scope, score definition, population, and metric-specific scope must match. Incompatible groups are never overlaid; select one group explicitly.</span></div>
                <label className="strict-group-picker"><span>Compatible protocol group</span><select value={selectedStrictGroupAvailable ? state.strictGroup : ''} onChange={(event) => update({ strictGroup: event.target.value })}><option value="">{strictGroups.length ? 'Choose a protocol group' : 'No fully specified groups available'}</option>{strictGroups.map((group) => <option value={group.key} key={group.key}>{group.label}</option>)}</select></label>
                <p>{strictGroups.length === 0 ? 'No complete groups match the current filters. Unknown protocol fields fail closed.' : !selectedStrictGroupAvailable ? `${strictGroups.length} compatible group${strictGroups.length === 1 ? '' : 's'} available. Select a group to compare; no group is selected automatically.` : `${filteredObservations.length} observations in the selected protocol group; ${strictExcluded - strictIncomplete} selected rows belong to another incompatible group.`}</p>
                {Object.entries(strictReasons).length > 0 && <small>{Object.entries(strictReasons).slice(0, 3).map(([reason, count]) => `${count} excluded: ${reason}`).join(' · ')}</small>}
              </div>}
            <div className="coverage-row" role="status"><span className="coverage-big">{coverage.available}<i> / {coverage.total}</i></span><span>Source-reported {state.statistic} {xMetricLabels[state.xMetric].axis} values among observations reporting {scoreMetricLabels[state.scoreMetric]}.</span><span className="omission-count">{coverage.missing} without source value{visibleUsageScenarios.length ? ` · ${visibleUsageScenarios.length} scenario${visibleUsageScenarios.length === 1 ? '' : 's'} active` : ''}</span></div>

            <div className="analysis-grid">
              <div className="chart-card">
                <div className="chart-card-head"><div><strong>{scoreMetricLabels[state.scoreMetric]}</strong><span>Score axis · explicit percentage/fraction values; reference key gives each source metric</span></div><button className="icon-action" type="button" aria-label="Download current chart as SVG" onClick={exportChartSvg}>↓ SVG</button></div>
                <ExplorerChart
                  observations={displayedObservations}
                  usageScenarios={visibleUsageScenarios}
                  xMetric={state.xMetric}
                  statistic={state.statistic}
                  strict={state.strict}
                  includeUsageScenarios={state.includeUsageScenarios}
                  scoreMetric={state.scoreMetric}
                  scale={state.scale}
                  connections={connections}
                  selectedObservationId={state.selectedObservationId}
                  activeSeriesId={activeSeriesId}
                  onActiveSeries={setActiveSeriesId}
                  onSelect={selectObservation}
                  onIsolate={isolateModel}
                  svgRef={svgRef}
                />
              </div>
              <aside className="chart-side-rail">
                <section className="legend-card" aria-labelledby="legend-title">
                  <div className="side-card-head"><div><span className="section-kicker">SERIES INDEX</span><h3 id="legend-title">Models &amp; sources</h3></div><span className="count-stamp">{legendSeries.length}</span></div>
                  <p className="legend-note">Filled markers and paths are measured source rows; hollow amber diamonds are unconnected usage scenarios. No-data marks sit in a separate gutter outside the numeric X scale. Select a name to isolate its source series.</p>
                  <ul className="legend-list">
                    {legendSeries.map(({ id, first, count }) => <li key={id}>
                      <button type="button" className="legend-item" onClick={() => isolateModel(modelKey(first))} onMouseEnter={() => setActiveSeriesId(id)} onMouseLeave={() => setActiveSeriesId(null)} onFocus={() => setActiveSeriesId(id)} onBlur={() => setActiveSeriesId(null)}>
                        <span className={`legend-symbol source-${first.sourceCategory}`} aria-hidden="true">{first.sourceCategory === 'organizer' ? '●' : first.sourceCategory === 'developer' ? '◆' : first.sourceCategory === 'local' ? '■' : '▲'}</span>
                        <span className="legend-name">{displayModelName(first.model.reportedName)}<small>{first.publisher} · {first.series.harness ?? 'harness unknown'}</small></span>
                        <span className="legend-count">{count}</span>
                      </button>
                    </li>)}
                    {legendSeries.length === 0 && <li className="legend-empty">No explicit percentage/fraction score marks match these filters.</li>}
                  </ul>
                </section>
                <EvidencePanel observation={selectedObservation} xMetric={state.xMetric} statistic={state.statistic} scoreMetric={state.scoreMetric} usageScenario={selectedObservation ? usageScenariosByObservationId.get(selectedObservation.id) ?? null : null} />
              </aside>
            </div>
          </section>

          <section className="score-only-section" aria-labelledby="score-only-title">
            <div className="section-title-row"><div><span className="section-kicker">SCORE WITHOUT EFFICIENCY</span><h2 id="score-only-title">Still in the record.</h2><p className="section-deck">Approved scores without a comparable {xMetricLabels[state.xMetric].label.toLowerCase()} measurement stay visible here and in the evidence table—not at X = 0.</p></div><span className="count-stamp">{scoreOnly.length}</span></div>
            {scoreOnly.length ? <>
              {scoreOnly.some(({ score }) => !hasPercentageScoreScale(score)) && <p className="metric-warning">Some source values have unspecified units. They remain unscaled; a raw value is not treated as a percentage and does not establish apples-to-apples ordering.</p>}
              <ul className="score-only-list">{scoreOnly.map(({ observation, score: result }) => {
                const percentScale = hasPercentageScoreScale(result)
                const displayedScore = displayScoreValue(result)
                return <li key={observation.id}>
                  <button type="button" className="score-only-model" onClick={() => selectObservation(observation.id)}>{displayModelName(observation.model.reportedName)}<small>{observation.effort.reportedLabel ?? 'effort unreported'} · {observation.publisher}</small></button>
                  {percentScale
                    ? <div className="score-only-bar" role="img" aria-label={`${displayedScore} reported for ${observation.model.reportedName}`}><span style={{ width: `${Math.max(0, Math.min(100, result.value * 100))}%` }} /></div>
                    : <div className="score-only-unscaled" role="img" aria-label={`${displayedScore}; raw source value with unit unspecified for ${observation.model.reportedName}`}>Raw source value · unit unspecified</div>}
                  <strong>{displayedScore}</strong>
                </li>
              })}</ul>
            </> : <p className="score-only-empty">No filtered table scores are missing the selected efficiency metric.</p>}
          </section>

          <section className="results-section" aria-labelledby="results-title">
            <div className="section-title-row results-title-row"><div><span className="section-kicker">APPROVED OBSERVATIONS</span><h2 id="results-title">The evidence table</h2><p className="section-deck">{selectedCount} visible rows · full precision retained in data and exports · expand evidence locators by keyboard.</p></div>
              <div className="export-actions">
                <a className="export-link" href={`${baseUrl}data/observations.json`} download="deepswe-observations.json">All JSON</a>
                <a className="export-link" href={`${baseUrl}data/observations.csv`} download="deepswe-observations.csv">All CSV</a>
                <button className="export-link" type="button" onClick={() => exportFiltered('json')}>Filtered JSON</button>
                <button className="export-link" type="button" onClick={() => exportFiltered('csv')}>Filtered CSV</button>
                <details className="scenario-export-group"><summary>Separate usage scenario exports</summary><div>
                  <button className="export-link" type="button" onClick={() => exportUsageScenarios('json', 'filtered')}>Filtered scenarios JSON</button>
                  <button className="export-link" type="button" onClick={() => exportUsageScenarios('csv', 'filtered')}>Filtered scenarios CSV</button>
                  <button className="export-link" type="button" onClick={() => exportUsageScenarios('json', 'all')}>All scenarios JSON</button>
                  <button className="export-link" type="button" onClick={() => exportUsageScenarios('csv', 'all')}>All scenarios CSV</button>
                </div></details>
              </div>
            </div>
            <ResultsTable observations={displayedObservations} xMetric={state.xMetric} statistic={state.statistic} scoreMetric={state.scoreMetric} selectedId={state.selectedObservationId} usageScenarios={usageScenariosByObservationId} onSelect={selectObservation} onIsolate={isolateModel} />
          </section>

          <section className="share-strip">
            <div><span className="section-kicker">TAKE THIS VIEW WITH YOU</span><p>Metric, source filters, selected models, protocol, scale, configuration mode, and the usage-scenario toggle travel in the URL.</p></div>
            <div className="share-actions"><button className="button-secondary" type="button" onClick={copyShareUrl}>Copy share URL</button><button className="text-button" type="button" onClick={resetAll}>Reset view ↺</button></div>
          </section>
        </div>
      </main>
      <SiteFooter revisionId={dataset.revisionId} checkedAt={dataset.lastSuccessfulCheckAt} deployedAt={deployedAt} onView={(view) => update({ view })} />
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  )
}

interface SiteHeaderProps {
  state: ExplorerUrlState
  onView: (view: ExplorerView) => void
  theme: 'light' | 'dark'
  onTheme: () => void
}

function SiteHeader({ state, onView, theme, onTheme }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand-mark" href={baseUrl} onClick={(event) => { event.preventDefault(); onView('combined') }} aria-label="DeepSWE Explorer home">
        <span className="brand-glyph" aria-hidden="true">D<span>∿</span></span><span>DeepSWE<span>Explorer</span></span>
      </a>
      <nav className="site-nav" aria-label="Site navigation">
        <button type="button" className={state.view === 'official' ? 'nav-active' : ''} onClick={() => onView('official')}>Official</button>
        <button type="button" className={state.view === 'combined' ? 'nav-active' : ''} onClick={() => onView('combined')}>Combined reports</button>
        <button type="button" className={state.view === 'review' ? 'nav-active' : ''} onClick={() => onView('review')}>Review queue</button>
      </nav>
      <div className="header-actions"><button className="header-link" type="button" onClick={() => onView('methodology')}>Methodology</button><button className="header-link" type="button" onClick={() => onView('sources')}>Sources</button><button className="theme-button" type="button" onClick={onTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? '◐' : '☼'}<span>{theme === 'light' ? 'Dark' : 'Light'}</span></button></div>
    </header>
  )
}

interface SiteFooterProps {
  revisionId: string
  checkedAt: string
  deployedAt: string | null
  onView: (view: ExplorerView) => void
}

function SiteFooter({ revisionId, checkedAt, deployedAt, onView }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="page-wrap footer-main"><div><span className="brand-glyph" aria-hidden="true">D<span>∿</span></span><strong>DeepSWE Explorer</strong><p>Unofficial community explorer. Not affiliated with Datacurve.</p></div><div className="footer-links"><button type="button" onClick={() => onView('methodology')}>Methodology</button><button type="button" onClick={() => onView('sources')}>Source register</button><button type="button" onClick={() => onView('review')}>Submit a result</button></div><div className="footer-meta"><span>REVISION {revisionId}</span><span>APPROVED SOURCE CHECK {new Date(checkedAt).toLocaleDateString()}</span><span>{deployedAt ? `LAST DEPLOYED ${new Date(deployedAt).toLocaleString()}` : 'DEPLOYMENT NOT RECORDED FOR LOCAL BUILD'}</span><span>BUILDABLE OFFLINE · STATIC ASSETS</span></div></div>
      <div className="footer-bottom"><span>Source facts retain publisher attribution and evidence locators.</span><span>Made for careful comparison, not a universal winner.</span></div>
    </footer>
  )
}

export default App
