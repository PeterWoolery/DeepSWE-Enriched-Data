import { displayModelName, displayScoreResult, displayScoreValue, hasPercentageScoreScale, metricObservation, modelKey, scoreMetricLabels, scoreResult, type ScoreMetric, type Statistic, type XMetric } from '../lib/comparison'
import type { Observation } from '../lib/schema'
import type { UsageScenario } from '../lib/usage-scenarios'

export interface ResultsTableProps {
  observations: Observation[]
  xMetric: XMetric
  statistic: Statistic
  scoreMetric: ScoreMetric
  selectedId: string | null
  usageScenarios: ReadonlyMap<string, UsageScenario>
  onSelect: (id: string) => void
  onIsolate: (modelId: string) => void
}

function display(value: number | null, unit: string) {
  if (value === null) return '—'
  if (unit === 'fraction') return `${(value * 100).toFixed(1)}%`
  if (unit === 'USD') return `$${value.toFixed(2)}`
  if (unit === 'seconds') return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} s`
  if (unit === 'output tokens') return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
  return String(value)
}

function categoryClass(category: Observation['sourceCategory']) {
  return `source-mark source-${category}`
}

export function ResultsTable({ observations, xMetric, statistic, scoreMetric, selectedId, usageScenarios, onSelect, onIsolate }: ResultsTableProps) {
  const sorted = [...observations].sort((left, right) => {
    const modelOrder = left.model.reportedName.localeCompare(right.model.reportedName)
    return modelOrder || (left.effort.order ?? Number.MAX_SAFE_INTEGER) - (right.effort.order ?? Number.MAX_SAFE_INTEGER)
  })
  return (
    <div className="table-scroll">
      <table className="results-table">
        <caption>Approved source observations after the filters above. Rows without the selected score or efficiency metric remain visible.</caption>
        <thead>
          <tr>
            <th scope="col">Model / series</th>
            <th scope="col">Benchmark version</th>
            <th scope="col">Effort</th>
            <th scope="col">{scoreMetricLabels[scoreMetric]}</th>
            <th scope="col">{xMetric === 'cost' ? `${statistic} cost` : xMetric === 'outputTokens' ? `${statistic} output tokens` : `reported ${statistic} time`}</th>
            <th scope="col">Attempts / tasks</th>
            <th scope="col">Source / harness</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((observation) => {
            const selectedScore = scoreResult(observation, scoreMetric)
            const reportedScore = displayScoreResult(observation, scoreMetric)
            const metric = metricObservation(observation, xMetric, statistic)
            const sourceReportedCost = xMetric === 'cost' && metric.value === null ? observation.pricing.asReportedCost : null
            const sourceReportedCostText = sourceReportedCost === null
              ? null
              : `$${new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(sourceReportedCost)} per task`
            const scenario = usageScenarios.get(observation.id)
            const scenarioValue = !scenario || xMetric === 'time'
              ? null
              : xMetric === 'cost'
                ? `$${scenario.costUsdPerScoredAttempt.toFixed(2)} / scored attempt`
                : `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(scenario.outputTokensPerScoredAttempt)} output tokens / scored attempt`
            const scenarioRange = !scenario || xMetric === 'time'
              ? null
              : xMetric === 'cost' ? scenario.costSensitivityRange : scenario.outputTokenSensitivityRange
            const isSelected = selectedId === observation.id
            return (
              <tr key={observation.id} className={isSelected ? 'selected-row' : ''} data-observation-id={observation.id}>
                <th scope="row">
                  <button className="table-model-button" type="button" onClick={() => onSelect(observation.id)} aria-pressed={isSelected}>
                    {displayModelName(observation.model.reportedName)}
                  </button>
                  <span className="table-subline">Reported: {observation.model.reportedName}</span>
                  <span className="table-subline">{observation.publisher}</span>
                </th>
                <td>{observation.benchmark.version === null ? <span className="unknown-value">unspecified</span> : `v${observation.benchmark.version}`}</td>
                <td>{observation.effort.reportedLabel ?? <span className="unknown-value">not reported</span>}</td>
                <td>
                  {reportedScore ? displayScoreValue(reportedScore) : <span className="unknown-value">not reported</span>}
                  {!selectedScore && <span className="table-subline">Different metric: {reportedScore.metricLabel}</span>}
                  {reportedScore.confidenceInterval.low !== null && reportedScore.confidenceInterval.high !== null && <span className="table-subline">{reportedScore.confidenceInterval.confidence === null ? 'Confidence interval' : `${reportedScore.confidenceInterval.confidence * 100}% CI`}{reportedScore.confidenceInterval.method ? ` · ${reportedScore.confidenceInterval.method}` : ''}</span>}
                  {!hasPercentageScoreScale(reportedScore) && <span className="table-subline">Raw source value · unit unspecified</span>}
                </td>
                <td>
                  {sourceReportedCostText ? <><span className="unknown-value">Not a mean/median metric</span><span className="table-subline">Source-reported Cost/Task {sourceReportedCostText}</span></> : display(metric.value, metric.unit)}
                  {metric.value === null && <span className="table-subline">{metric.missingReason}</span>}
                  {scenarioValue && scenario && <span className="table-usage-scenario">
                    <strong>Estimated scenario · {scenario.confidence === 'low' ? 'low' : 'very low'} qualitative confidence · not measured</strong>
                    <small>Qualitative evidence grade, not a probability.</small>
                    <span>{scenarioValue}</span>
                    {scenarioRange
                      ? <small>Sensitivity envelope {xMetric === 'cost' ? `$${scenarioRange[0].toFixed(2)}–$${scenarioRange[1].toFixed(2)}` : `${new Intl.NumberFormat('en').format(scenarioRange[0])}–${new Intl.NumberFormat('en').format(scenarioRange[1])} tokens`}; not a confidence interval.</small>
                      : <small>No defensible range or prediction interval is available.</small>}
                    <small>{xMetric === 'cost' ? scenario.costCalibrationDescription : scenario.outputCalibrationDescription}</small>
                    {xMetric === 'outputTokens' && <small>{new Intl.NumberFormat('en').format(scenario.aaCodingSuiteMixedTokensPerTask)} AA suite total tokens/task mixes categories and is not used as output; cost is not converted into tokens.</small>}
                    <small>Evidence: {scenario.sources.map((source, index) => <span key={source.id}>{index ? ' · ' : ''}<a href={source.url} target="_blank" rel="noreferrer">{source.publisher} ({source.accessedOn})</a></span>)}</small>
                  </span>}
                </td>
                <td>
                  {observation.benchmark.attempts === null ? '—' : `${observation.benchmark.attempts} attempts`}
                  <span className="table-subline">{observation.benchmark.tasksAttempted === null ? 'task count unknown' : `${observation.benchmark.tasksAttempted} unique tasks attempted`}{observation.benchmark.runs === null ? '' : ` · ${observation.benchmark.runs} runs`}</span>
                </td>
                <td>
                  <span className={categoryClass(observation.sourceCategory)} aria-label={observation.sourceCategory}>{observation.sourceCategory === 'organizer' ? '●' : observation.sourceCategory === 'developer' ? '◆' : observation.sourceCategory === 'local' ? '■' : '▲'}</span>
                  {' '}{observation.sourceCategory}
                  <span className="table-subline">{observation.series.harness ?? 'harness unknown'}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="text-button" type="button" onClick={() => onSelect(observation.id)}>Details</button>
                    <button className="text-button" type="button" onClick={() => onIsolate(modelKey(observation))}>Isolate</button>
                  </div>
                  <details className="row-evidence">
                    <summary>Evidence locator</summary>
                    <p>{observation.provenance.evidenceLocator}</p>
                    {observation.provenance.url
                      ? <a href={observation.provenance.url} target="_blank" rel="noreferrer">{observation.provenance.title} ↗</a>
                      : <span>{observation.provenance.title} · local artifact; no public URL</span>}
                  </details>
                </td>
              </tr>
            )
          })}
          {observations.length === 0 && <tr><td colSpan={8} className="empty-table-cell">No approved observations match the current filters.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
