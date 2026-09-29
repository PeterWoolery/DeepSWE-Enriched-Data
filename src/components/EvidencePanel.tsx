import { displayModelName, displayScoreResult, displayScoreValue, hasPercentageScoreScale, scoreResult, scoreMetricLabels, xMetricLabels, type ScoreMetric, type Statistic, type XMetric } from '../lib/comparison'
import type { Observation } from '../lib/schema'
import type { UsageScenario } from '../lib/usage-scenarios'

export interface EvidencePanelProps {
  observation: Observation | null
  xMetric: XMetric
  statistic: Statistic
  scoreMetric: ScoreMetric
  usageScenario?: UsageScenario | null
  chartSuppression?: Observation[] | null
}

function valueText(value: number | null, unit: string, digits = 2): string {
  if (value === null) return 'Not reported'
  if (unit === 'fraction') return `${(value * 100).toFixed(1)}%`
  if (unit === 'USD') return `$${value.toFixed(digits)}`
  if (unit === 'seconds') return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)} s`
  if (unit === 'output tokens') return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
  return `${value} ${unit}`
}

function sourceTypeLabel(category: Observation['sourceCategory']): string {
  return category === 'organizer' ? 'Benchmark organizer' : category === 'developer' ? 'Developer report' : category === 'independent' ? 'Independent evaluator' : category === 'local' ? 'Local evaluation' : 'Secondary source'
}

export function EvidencePanel({ observation, xMetric, statistic, scoreMetric, usageScenario = null, chartSuppression = null }: EvidencePanelProps) {
  if (!observation) {
    return (
      <aside className="evidence-panel evidence-empty" aria-label="Evidence details">
        <span className="section-kicker">POINT DETAIL</span>
        <h3>Choose a point or result row</h3>
        <p>Source, harness, uncertainty, reported efficiency, and missing fields open here. Every point is also available through the keyboard-accessible table.</p>
      </aside>
    )
  }
  const selectedScore = scoreResult(observation, scoreMetric)
  const displayedScore = displayScoreResult(observation, scoreMetric)
  const confidenceInterval = displayedScore.confidenceInterval
  const cost = observation.metrics[statistic === 'mean' ? 'cost' : 'medianCost']
  const sourceCost = observation.pricing.asReportedCost
  const sourceCostText = sourceCost === null ? null : `$${new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(sourceCost)} per task (source-reported; aggregation basis unspecified)`
  const tokens = observation.metrics[statistic === 'mean' ? 'outputTokens' : 'medianOutputTokens']
  const time = observation.metrics[statistic === 'mean' ? 'time' : 'medianTime']
  const displayedUsageScenario = statistic === 'mean' ? usageScenario : null
  const missing = [
    observation.series.harnessRevision ? null : 'Harness revision is unreported.',
    observation.series.evaluationPolicy ? null : 'Evaluation / timeout policy is unreported.',
    observation.series.provider ? null : 'Serving provider is unreported.',
    observation.metrics.cost.value === null
      ? sourceCost === null
        ? 'DeepSWE-specific cost is unreported.'
        : 'A source-reported Cost/Task value exists, but its aggregation/billing basis is unspecified and it is not normalized as a mean/median metric.'
      : null,
    observation.metrics.outputTokens.value === null ? 'Output tokens are unreported.' : null,
    observation.metrics.time.value === null ? 'Task duration is unreported.' : null,
    !hasPercentageScoreScale(displayedScore) ? 'The source reports a raw score value without a unit; no percentage is assumed.' : null,
    confidenceInterval.low === null || confidenceInterval.high === null ? `A confidence interval is not reported for ${displayedScore.metricLabel}.` : null,
  ].filter((entry): entry is string => entry !== null)

  return (
    <aside className="evidence-panel" aria-label={`Evidence details for ${observation.model.reportedName}`}>
      <div className="evidence-topline">
        <span className="section-kicker">POINT DETAIL</span>
        <span className={`status-pill status-${observation.provenance.reviewStatus}`}>{observation.provenance.reviewStatus === 'source-reviewed' ? 'Transcription reviewed' : 'Pending review'}</span>
      </div>
      <h3>{displayModelName(observation.model.reportedName)}</h3>
      <p className="evidence-subtitle">Reported model: {observation.model.reportedName} <span>·</span> {observation.effort.reportedLabel ?? 'Effort not specified'} <span>·</span> {sourceTypeLabel(observation.sourceCategory)}</p>
      <div className="evidence-score">
        <span>{displayedScore.metricLabel}</span>
        <strong>{displayScoreValue(displayedScore)}</strong>
        <small>{selectedScore ? '' : `Different metric from selected ${scoreMetricLabels[scoreMetric]}. `}Source wording: {displayedScore.reportedText}</small>
      </div>
      <dl className="evidence-metrics">
        <div><dt className={xMetric === 'cost' ? 'selected-evidence-metric' : ''}>{xMetricLabels.cost.label}</dt><dd>{cost.value === null ? sourceCostText ?? valueText(cost.value, cost.unit) : valueText(cost.value, cost.unit)}</dd></div>
        <div><dt className={xMetric === 'outputTokens' ? 'selected-evidence-metric' : ''}>{xMetricLabels.outputTokens.label}</dt><dd>{valueText(tokens.value, tokens.unit)}</dd></div>
        <div><dt className={xMetric === 'time' ? 'selected-evidence-metric' : ''}>{xMetricLabels.time.label}</dt><dd>{valueText(time.value, time.unit)}</dd></div>
      </dl>
      {chartSuppression && <div className="chart-suppression-detail"><strong>Not plotted in the combined chart.</strong> {observation.benchmark.version === null ? `This report does not specify its benchmark version; Datacurve has a DeepSWE v${chartSuppression[0]?.benchmark.version} result for the same model.` : `Datacurve has an applicable DeepSWE v${chartSuppression[0]?.benchmark.version} result for the same model.`} Chart precedence does not merge results. This source row remains in the table and exports; no chart coordinate is assigned.</div>}
      {displayedUsageScenario && <section className="usage-evidence" aria-label="Metric-specific usage evidence and scenarios">
        <span className="scenario-label">{xMetric === 'outputTokens' && displayedUsageScenario.outputEvidenceType === 'same-source-deepswe-mean' ? 'AA SOURCE-REPORTED DEEPSWE OUTPUT MEAN · COST EVIDENCE SEPARATE' : displayedUsageScenario.costScenarioType === 'source-reported-cost' ? 'SOURCE-REPORTED COST SCENARIO · BASIS INCOMPLETE' : displayedUsageScenario.costScenarioType === 'aa-suite-proxy' ? 'AA SUITE-COST PROXY · NOT DEEPSWE-SPECIFIC' : 'ESTIMATED USAGE SCENARIO · NOT MEASURED'}</span>
        <dl>
          {displayedUsageScenario.costUsd !== null && <div><dt>Scenario cost · {displayedUsageScenario.costUnit}</dt><dd>${displayedUsageScenario.costUsd.toFixed(2)}</dd></div>}
          {displayedUsageScenario.outputTokensPerScoredAttempt !== null && <div><dt>{displayedUsageScenario.outputEvidenceType === 'same-source-deepswe-mean' ? 'Source-reported mean' : 'Scenario mean'} · {displayedUsageScenario.outputUnit}</dt><dd>{new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(displayedUsageScenario.outputTokensPerScoredAttempt)}</dd></div>}
          {displayedUsageScenario.timeSecondsPerScoredAttempt !== null && <div><dt>Mean reported time / scored attempt</dt><dd>{valueText(displayedUsageScenario.timeSecondsPerScoredAttempt, 'seconds')}</dd></div>}
        </dl>
        <p><strong>{displayedUsageScenario.confidence === 'low' ? 'Low' : 'Very low'} qualitative scenario evidence for transfers/proxies, not a probability.</strong> {displayedUsageScenario.confidenceNote}</p>
        <p><strong>Cost method:</strong> {displayedUsageScenario.costCalibrationDescription} {displayedUsageScenario.costUsd === null ? 'No cost estimate.' : displayedUsageScenario.costSensitivityRange ? `Sensitivity envelope: $${displayedUsageScenario.costSensitivityRange[0].toFixed(2)}–$${displayedUsageScenario.costSensitivityRange[1].toFixed(2)}; not a confidence interval.` : 'No defensible cost range is available.'}</p>
        {displayedUsageScenario.outputTokensPerScoredAttempt !== null && <p><strong>Output-token method:</strong> {displayedUsageScenario.outputCalibrationDescription} {displayedUsageScenario.aaCodingSuiteMixedTokensPerTask !== null ? `The Coding Agent suite total (${new Intl.NumberFormat('en').format(displayedUsageScenario.aaCodingSuiteMixedTokensPerTask)} tokens/task) mixes token categories and is not used as an output count; cost is not converted into tokens. ` : ''}{displayedUsageScenario.outputTokenSensitivityRange ? `Sensitivity envelope: ${new Intl.NumberFormat('en').format(displayedUsageScenario.outputTokenSensitivityRange[0])}–${new Intl.NumberFormat('en').format(displayedUsageScenario.outputTokenSensitivityRange[1])}; not a confidence interval.` : 'No defensible output-token range is available.'}</p>}
        {displayedUsageScenario.timeSecondsPerScoredAttempt !== null && <p><strong>Time method:</strong> {displayedUsageScenario.timeCalibrationDescription} {displayedUsageScenario.aaCodingSuiteTimeSecondsPerTask !== null ? `AA pooled time/task reference: ${valueText(displayedUsageScenario.aaCodingSuiteTimeSecondsPerTask, 'seconds')}. ` : ''}{displayedUsageScenario.timeSensitivityRange ? `Sensitivity envelope: ${valueText(displayedUsageScenario.timeSensitivityRange[0], 'seconds')}–${valueText(displayedUsageScenario.timeSensitivityRange[1], 'seconds')}; not a confidence interval.` : 'No defensible time range is available.'} Timer boundaries are unspecified; this is not a verified end-to-end duration.</p>}
        <p>{displayedUsageScenario.costScenarioType === 'source-reported-cost' ? 'This source-reported value belongs only to this publisher row.' : `This scenario belongs only to the ${displayedUsageScenario.targetPublisher} ${displayedUsageScenario.targetHarness ?? ''} observation.`} It does not modify the reported score or measurement fields.</p>
        <ul>{displayedUsageScenario.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher} · {source.id}</a> · accessed {source.accessedOn} · {source.evidenceLocator}</li>)}</ul>
      </section>}
      <div className="evidence-detail-grid">
        <div><span>Benchmark</span><strong>{observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'Version not specified'}</strong></div>
        <div><span>Task scope</span><strong>{observation.benchmark.scope === 'full' ? `Full · ${observation.benchmark.taskCount ?? 'count unknown'} tasks` : observation.benchmark.scope === 'subset' ? `Subset · ${observation.benchmark.taskCount ?? 'count unknown'} tasks` : 'Not specified'}</strong></div>
        <div><span>Attempts</span><strong>{observation.benchmark.attempts === null ? 'Not reported' : `${observation.benchmark.attempts} attempts`}</strong></div>
        <div><span>Benchmark runs / trials</span><strong>{observation.benchmark.runs === null ? 'Not reported' : observation.benchmark.runs}</strong></div>
        <div><span>Unique tasks attempted</span><strong>{observation.benchmark.tasksAttempted === null ? 'Not reported' : observation.benchmark.tasksAttempted}</strong></div>
        <div><span>Evaluator / publisher</span><strong>{observation.evaluator ?? observation.publisher}</strong></div>
        <div><span>Harness</span><strong>{observation.series.harness ?? 'Not reported'}</strong></div>
        <div><span>Provider</span><strong>{observation.series.provider ?? 'Not reported'}</strong></div>
        <div><span>Effort order</span><strong>{observation.effort.order === null ? 'Unmapped; shown as a dot' : `Source-backed order ${observation.effort.order + 1}`}</strong></div>
      </div>
      <section className="evidence-subsection">
        <h4>Uncertainty and measurement scope</h4>
        {confidenceInterval && confidenceInterval.low !== null && confidenceInterval.high !== null ? (
          <p>{confidenceInterval.confidence === null ? 'Confidence interval' : `${confidenceInterval.confidence * 100}% CI`}: {valueText(confidenceInterval.low, 'fraction')}–{valueText(confidenceInterval.high, 'fraction')}. {confidenceInterval.method ?? 'Method not specified.'}</p>
        ) : <p>{confidenceInterval.missingReason ?? `No confidence interval is reported for ${displayedScore.metricLabel}.`}</p>}
        <p><strong>Score denominator:</strong> {displayedScore.denominator ?? 'Not reported'}{displayedScore.denominatorCount === null ? '' : ` (${displayedScore.denominatorCount})`}.</p>
        {observation.benchmark.excludedPolicy && <p><strong>Attempt policy:</strong> {observation.benchmark.excludedPolicy}</p>}
        {observation.metrics.time.value !== null && <p><strong>Timing:</strong> {observation.metrics.time.definition}</p>}
        {observation.metrics.outputTokens.inclusionNote && <p><strong>Token scope:</strong> {observation.metrics.outputTokens.inclusionNote}</p>}
      </section>
      {observation.pricing.renderedLeaderboardCost !== null && (
        <div className="discrepancy-note"><p><strong>Unresolved cost discrepancy:</strong> feed mean {valueText(observation.pricing.asReportedCost, 'USD')} vs rendered site {valueText(observation.pricing.renderedLeaderboardCost, 'USD')}. Neither value is silently repriced or overwritten.</p><a href={observation.pricing.renderedCostSourceUrl ?? undefined} target="_blank" rel="noreferrer">{observation.pricing.renderedCostSourceTitle ?? 'Rendered leaderboard source'} ↗</a><small>Retrieved {observation.pricing.renderedCostSourceRetrievedAt ?? 'date unknown'} · SHA-256 {observation.pricing.renderedCostSourceSha256 ?? 'not recorded'}</small></div>
      )}
      <section className="evidence-subsection">
        <h4>Known gaps</h4>
        {missing.length ? <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No missing fields in the displayed summary.</p>}
        {observation.provenance.notes.map((note) => <p key={note}>{note}</p>)}
      </section>
      <section className="evidence-source">
        <h4>Source record</h4>
        <p>{observation.provenance.title} · {observation.publisher}</p>
        <p className="locator">{observation.provenance.evidenceLocator}</p>
        {observation.provenance.url
          ? <a href={observation.provenance.url} target="_blank" rel="noreferrer">Open original evidence <span aria-hidden="true">↗</span></a>
          : <p>Local artifact record; no public URL.</p>}
        <dl className="source-meta">
          <div><dt>Retrieved</dt><dd>{observation.provenance.retrievedAt}</dd></div>
          <div><dt>Response SHA-256</dt><dd className="hash-value">{observation.provenance.contentSha256}</dd></div>
          <div><dt>Replication</dt><dd>{observation.provenance.independentReplication === 'not-independently-reproduced' ? 'Not independently reproduced' : observation.provenance.independentReplication}</dd></div>
        </dl>
      </section>
    </aside>
  )
}
