import { displayModelName, displayScoreResult, displayScoreValue, hasPercentageScoreScale, scoreResult, scoreMetricLabels, xMetricLabels, type ScoreMetric, type Statistic, type XMetric } from '../lib/comparison'
import type { Observation } from '../lib/schema'
import type { ResolveXUsageResult, UsageScenario, UsageScenarioSource } from '../lib/usage-scenarios'

interface MetricSourceEvidence {
  id: string
  publisher: string
  url: string | null
  accessedOn: string
  evidenceLocator: string
  responseSha256: string | null
  hashStatus: UsageScenarioSource['hashStatus']
  historicalMalformedSha256?: string
  metricSourceIds: string[]
}

export interface EvidencePanelProps {
  observation: Observation | null
  xMetric: XMetric
  statistic: Statistic
  scoreMetric: ScoreMetric
  usageResolution?: ResolveXUsageResult | null
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

function sourceMatchesMetricId(sourceId: string, metricId: string): boolean {
  return sourceId === metricId || sourceId.endsWith(`:${metricId}`)
}

export function EvidencePanel({ observation, xMetric, statistic, scoreMetric, usageResolution = null, usageScenario = null, chartSuppression = null }: EvidencePanelProps) {
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
  const displayedUsageScenario = usageScenario
  const selectedOrAlternative = usageResolution
    ? usageResolution.value !== null && usageResolution.evidenceKind !== 'no-data' && usageResolution.evidenceKind !== 'approved-measurement'
      ? usageResolution
      : usageResolution.alternatives[0] ?? null
    : null
  const selectedKindLabel = usageResolution?.evidenceKind === 'approved-measurement'
    ? 'approved selected-statistic measurement'
    : usageResolution?.evidenceKind === 'same-source-reference' || selectedOrAlternative?.evidenceKind === 'same-source-reference'
      ? 'same-source reported reference'
      : usageResolution?.evidenceKind === 'configured-fallback' || selectedOrAlternative?.evidenceKind === 'configured-fallback'
        ? 'configured fallback'
        : 'no data'
  const selectedUsageText = usageResolution?.value === null || usageResolution?.value === undefined
    ? 'No selected X coordinate'
    : `${valueText(usageResolution.value, usageResolution.unit)} · ${usageResolution.statistic ?? statistic} · ${selectedKindLabel}`
  const selectedRelationship = usageResolution?.relationship ?? 'not recorded'
  const selectedSources = usageResolution?.sourceIds.join(', ') || 'not recorded'
  const selectedFactIds = usageResolution?.factIds.join(', ') || 'none'
  const selectedReferenceIds = usageResolution?.referenceIds.join(', ') || 'none'
  const selectedEvidenceLabel = usageResolution?.evidenceKind === 'approved-measurement'
    ? observation.approximation && xMetric === 'cost'
      ? 'APPROXIMATE APPROVED SOURCE-CHART COST · DISPLAYED UNDER MEAN'
      : `APPROVED ${statistic.toUpperCase()} MEASUREMENT · OPTIONAL EVIDENCE RETAINED`
    : selectedOrAlternative?.evidenceKind === 'same-source-reference' && xMetric === 'outputTokens'
      ? 'AA SOURCE-REPORTED DEEPSWE OUTPUT MEAN · COST EVIDENCE SEPARATE'
      : selectedOrAlternative?.relationship === 'source-reported-unspecified'
        ? 'SOURCE-REPORTED COST SCENARIO · BASIS INCOMPLETE'
        : selectedOrAlternative?.relationship === 'pooled-suite-proxy'
          ? 'AA SUITE-COST PROXY · NOT DEEPSWE-SPECIFIC'
          : selectedOrAlternative?.relationship === 'separate-experiment-reference' || selectedOrAlternative?.relationship === 'separate-benchmark-reference'
            ? 'SEPARATE EXPERIMENT REFERENCE · NOT A TARGET-RUN MEASUREMENT'
            : selectedOrAlternative?.evidenceKind === 'configured-fallback'
              ? 'ESTIMATED USAGE SCENARIO · NOT MEASURED'
              : 'OPTIONAL USAGE EVIDENCE · NOT SELECTED'
  const selectedMetricSourceIds = new Set(usageResolution?.sourceIds ?? [])
  const alternativeMetricSourceIds = new Set(usageResolution?.alternatives.flatMap((alternative) => alternative.sourceIds) ?? [])
  const allMetricSourceIds = new Set([...selectedMetricSourceIds, ...alternativeMetricSourceIds])
  const scenarioSources = displayedUsageScenario?.sources ?? []
  const sourceUrlMetricIds = new Map<string, Set<string>>()
  for (const source of scenarioSources) {
    const directMatches = [...allMetricSourceIds].filter((sourceId) => sourceMatchesMetricId(source.id, sourceId))
    if (!directMatches.length) continue
    const idsForUrl = sourceUrlMetricIds.get(source.url) ?? new Set<string>()
    directMatches.forEach((sourceId) => idsForUrl.add(sourceId))
    sourceUrlMetricIds.set(source.url, idsForUrl)
  }
  const metricSourceEvidence: MetricSourceEvidence[] = scenarioSources.map((source) => {
    const directMatches = [...allMetricSourceIds].filter((sourceId) => sourceMatchesMetricId(source.id, sourceId))
    return { ...source, metricSourceIds: directMatches.length ? directMatches : [...(sourceUrlMetricIds.get(source.url) ?? [])] }
  })
  const approvedSourceId = observation.provenance.sourceId
  const approvedSourceIsReferenced = allMetricSourceIds.has(approvedSourceId)
  const hasApprovedSourceRecord = metricSourceEvidence.some((source) => sourceMatchesMetricId(source.id, approvedSourceId))
  if (approvedSourceIsReferenced && !hasApprovedSourceRecord) {
    const sha256 = observation.provenance.contentSha256
    const hashIsValid = /^[a-f0-9]{64}$/i.test(sha256)
    metricSourceEvidence.push({
      id: approvedSourceId,
      publisher: observation.publisher,
      url: observation.provenance.url,
      accessedOn: observation.provenance.retrievedAt,
      evidenceLocator: observation.provenance.evidenceLocator,
      responseSha256: hashIsValid ? sha256 : null,
      hashStatus: hashIsValid ? 'validated' : 'malformed-historical',
      ...(!hashIsValid ? { historicalMalformedSha256: sha256 } : {}),
      metricSourceIds: [approvedSourceId],
    })
  }
  const matchedMetricSourceIds = new Set(metricSourceEvidence.flatMap((source) => source.metricSourceIds))
  if (approvedSourceIsReferenced) matchedMetricSourceIds.add(approvedSourceId)
  const unmatchedMetricSourceIds = [...allMetricSourceIds].filter((sourceId) => !matchedMetricSourceIds.has(sourceId))
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
         <div><dt className={xMetric === 'cost' ? 'selected-evidence-metric' : ''}>{xMetricLabels.cost.label}</dt><dd>{observation.approximation && cost.value !== null ? `≈${valueText(cost.value, cost.unit)} · source-chart cost; aggregation unknown` : cost.value === null ? sourceCostText ?? valueText(cost.value, cost.unit) : valueText(cost.value, cost.unit)}</dd></div>
        <div><dt className={xMetric === 'outputTokens' ? 'selected-evidence-metric' : ''}>{xMetricLabels.outputTokens.label}</dt><dd>{valueText(tokens.value, tokens.unit)}</dd></div>
        <div><dt className={xMetric === 'time' ? 'selected-evidence-metric' : ''}>{xMetricLabels.time.label}</dt><dd>{valueText(time.value, time.unit)}</dd></div>
      </dl>
      {usageResolution && <section className="selected-usage-evidence" aria-label="Selected X metric evidence">
        <h4>Selected {xMetricLabels[xMetric].label} coordinate</h4>
        <p><strong>{selectedUsageText}</strong>{usageResolution.value === null ? `: ${usageResolution.reason ?? 'No compatible value is available.'}` : `; relationship: ${selectedRelationship}.`}</p>
        {usageResolution.value !== null && <p>Method: {usageResolution.method ?? 'Approved source measurement'}. Source IDs: {selectedSources}. Fact IDs: {selectedFactIds}. Calibration/reference IDs: {selectedReferenceIds}.</p>}
        {usageResolution.alternatives.length > 0 && <div><strong>Alternative evidence for this metric</strong><ul>{usageResolution.alternatives.map((alternative) => <li key={`${alternative.scenarioId ?? 'alternative'}-${alternative.method ?? alternative.relationship}`}>
          {valueText(alternative.value, alternative.unit)} · {alternative.evidenceKind} · {alternative.relationship}; {alternative.statistic}. Method: {alternative.method ?? 'not recorded'}. Sources: {alternative.sourceIds.join(', ') || 'not recorded'}; facts: {alternative.factIds.join(', ') || 'none'}; references: {alternative.referenceIds.join(', ') || 'none'}.{alternative.exclusionReason ? ` ${alternative.exclusionReason}` : ''}
        </li>)}</ul></div>}
      </section>}
      {usageResolution && (metricSourceEvidence.length > 0 || unmatchedMetricSourceIds.length > 0) && <section className="usage-source-evidence" aria-label="Metric source hashes and locators">
        <h4>Metric source records</h4>
        <ul>{metricSourceEvidence.map((source) => {
          const selectedIds = source.metricSourceIds.filter((id) => selectedMetricSourceIds.has(id))
          const alternativeIds = source.metricSourceIds.filter((id) => alternativeMetricSourceIds.has(id))
          const association = selectedIds.length && alternativeIds.length
            ? 'Selected and alternative metric source'
            : selectedIds.length
              ? 'Selected metric source'
              : alternativeIds.length
                ? 'Alternative metric source'
                : 'Scenario context source'
          const hashDescription = source.hashStatus === 'validated'
            ? source.responseSha256
              ? <>Hash status: validated · response SHA-256: <code className="hash-value">{source.responseSha256}</code></>
              : 'Hash status: validated; digest not included in this record.'
            : source.hashStatus === 'malformed-historical'
              ? <>Hash status: malformed historical; not validated.{source.historicalMalformedSha256 ? <> Historical hash (not a SHA-256): <code className="hash-value">{source.historicalMalformedSha256}</code></> : ' No historical hash value is available.'}</>
              : 'Hash status: unavailable; no response hash was recorded.'
          return <li key={source.id}>
            <strong>{association} · {source.publisher} · {source.id}</strong>
            {source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">Open source</a></>}
            {source.metricSourceIds.length > 0 && <small>Metric source IDs: {source.metricSourceIds.join(', ')}.</small>}
            <small>{hashDescription}</small>
            <small>Locator: {source.evidenceLocator}</small>
          </li>
        })}
        {unmatchedMetricSourceIds.map((sourceId) => <li key={`unmatched-${sourceId}`}><strong>Metric source record unavailable · {sourceId}</strong><small>Hash status: unavailable; no matching source record or locator is present in the UI evidence.</small></li>)}
        </ul>
      </section>}
      {chartSuppression && <div className="chart-suppression-detail"><strong>Not plotted in the combined chart.</strong> {observation.benchmark.version === null ? `This report does not specify its benchmark version; Datacurve has a DeepSWE v${chartSuppression[0]?.benchmark.version} result for the same model.` : `Datacurve has an applicable DeepSWE v${chartSuppression[0]?.benchmark.version} result for the same model.`} Chart precedence does not merge results. This source row remains in the table and exports; no chart coordinate is assigned.</div>}
      {displayedUsageScenario && <section className="usage-evidence" aria-label="Metric-specific usage evidence and scenarios">
        <span className="scenario-label">{selectedEvidenceLabel}</span>
        {usageResolution?.evidenceKind === 'approved-measurement' && <p>The approved {statistic} value is selected for this metric. Optional facts below remain evidence only and do not replace or duplicate the approved coordinate.</p>}
        {usageResolution?.value === null && <p>This optional evidence is not selected: {usageResolution.reason ?? 'no compatible coordinate is available.'}</p>}
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
         <div><span>{observation.approximation ? 'Figure path order' : 'Effort order'}</span><strong>{observation.effort.order === null ? 'Unmapped; shown as a dot' : observation.approximation ? `Mark ${observation.effort.order + 1} of 5; no named effort inferred` : `Source-backed order ${observation.effort.order + 1}`}</strong></div>
      </div>
      <section className="evidence-subsection">
        <h4>Uncertainty and measurement scope</h4>
        {confidenceInterval && confidenceInterval.low !== null && confidenceInterval.high !== null ? (
          <p>{confidenceInterval.confidence === null ? 'Confidence interval' : `${confidenceInterval.confidence * 100}% CI`}: {valueText(confidenceInterval.low, 'fraction')}–{valueText(confidenceInterval.high, 'fraction')}. {confidenceInterval.method ?? 'Method not specified.'}</p>
        ) : <p>{confidenceInterval.missingReason ?? `No confidence interval is reported for ${displayedScore.metricLabel}.`}</p>}
         <p><strong>Score denominator:</strong> {displayedScore.denominator ?? 'Not reported'}{displayedScore.denominatorCount === null ? '' : ` (${displayedScore.denominatorCount})`}.</p>
         {observation.approximation && <p><strong>Approximate chart reading:</strong> score ≈{observation.approximation.scoreBoundsPercent.join('–')}%; cost ≈${observation.approximation.costBoundsUsd[0].toFixed(1)}–${observation.approximation.costBoundsUsd[1].toFixed(1)} per source-defined task. These are visual extraction/rounding bounds, not statistical confidence intervals. Cost aggregation, billing basis, and task/attempt denominator are unspecified. {observation.approximation.method}</p>}
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
           <div><dt>{observation.approximation ? 'Supplied screenshot filename date' : 'Retrieved'}</dt><dd>{observation.provenance.retrievedAt}</dd></div>
           <div><dt>{observation.approximation ? 'Supplied screenshot SHA-256' : 'Response SHA-256'}</dt><dd className="hash-value">{observation.provenance.contentSha256}</dd></div>
          <div><dt>Replication</dt><dd>{observation.provenance.independentReplication === 'not-independently-reproduced' ? 'Not independently reproduced' : observation.provenance.independentReplication}</dd></div>
        </dl>
      </section>
    </aside>
  )
}
