import { useMemo } from 'react'
import type { RefObject } from 'react'
import { displayModelName, displayScoreResult, displayScoreValue, hasPercentageScoreScale, metricObservation, modelKey, scoreMetricLabels, xMetricLabels, type ScoreMetric, type Statistic, type XMetric } from '../lib/comparison'
import { segmentXY, type AxisScale, type XYObservation } from '../lib/xy'
import type { Observation } from '../lib/schema'
import { scenarioXValue, type UsageScenario } from '../lib/usage-scenarios'

const WIDTH = 1080
const HEIGHT = 470
const PLOT = { left: 82, right: 1008, top: 34, bottom: 398 }
function stableColor(identity: string): string {
  let hash = 2166136261
  for (const character of identity) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const value = hash >>> 0
  const hue = value % 360
  const saturation = 47 + ((value >>> 9) % 13)
  const darkTheme = document.documentElement.dataset.theme === 'dark'
  const lightness = darkTheme ? 62 + ((value >>> 17) % 12) : 29 + ((value >>> 17) % 9)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function xValue(observation: Observation, metric: XMetric, statistic: Statistic) {
  return metricObservation(observation, metric, statistic).value
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
}

function formatAxis(value: number, metric: XMetric): string {
  if (metric === 'cost') return `$${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)}`
  if (metric === 'outputTokens') return formatNumber(value)
  return `${formatNumber(value)}s`
}

function scaleX(value: number, scale: AxisScale, min: number, max: number): number {
  const ratio = scale === 'log'
    ? (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min) || 1)
    : (value - min) / (max - min || 1)
  return PLOT.left + ratio * (PLOT.right - PLOT.left)
}

function scaleY(value: number): number {
  return PLOT.bottom - value * (PLOT.bottom - PLOT.top)
}

function makeTicks(scale: AxisScale, min: number, max: number): number[] {
  if (scale === 'log') {
    const first = Math.floor(Math.log10(min))
    const last = Math.ceil(Math.log10(max))
    const ticks = Array.from({ length: Math.min(last - first + 1, 8) }, (_, index) => 10 ** (first + index))
      .filter((value) => value >= min && value <= max)
    return ticks.length ? ticks : [min, max].filter((value, index, list) => list.indexOf(value) === index)
  }
  return [0, 0.25, 0.5, 0.75, 1].map((fraction) => min + (max - min) * fraction)
}

function sourceShape(category: Observation['sourceCategory'], x: number, y: number, color: string, selected: boolean) {
  const stroke = selected ? '#171b1a' : '#f3f0e7'
  const strokeWidth = selected ? 3 : 1.8
  if (category === 'developer') return <path d={`M ${x} ${y - 7} L ${x + 7} ${y} L ${x} ${y + 7} L ${x - 7} ${y} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  if (category === 'independent') return <path d={`M ${x} ${y - 8} L ${x + 7} ${y + 6} L ${x - 7} ${y + 6} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  if (category === 'local') return <path d={`M ${x - 6} ${y - 6} h 12 v 12 h -12 Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  return <circle cx={x} cy={y} r={selected ? 7.5 : 6} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
}

export interface ExplorerChartProps {
  observations: Observation[]
  usageScenarios: { observation: Observation; scenario: UsageScenario }[]
  xMetric: XMetric
  statistic: Statistic
  scoreMetric: ScoreMetric
  scale: AxisScale
  connections: boolean
  selectedObservationId: string | null
  activeSeriesId: string | null
  onActiveSeries: (seriesId: string | null) => void
  onSelect: (observationId: string) => void
  onIsolate: (modelId: string) => void
  svgRef: RefObject<SVGSVGElement | null>
}

export function ExplorerChart({
  observations,
  usageScenarios,
  xMetric,
  statistic,
  scoreMetric,
  scale,
  connections,
  selectedObservationId,
  activeSeriesId,
  onActiveSeries,
  onSelect,
  onIsolate,
  svgRef,
}: ExplorerChartProps) {
  const plotSeries = useMemo(() => {
    const grouped = new Map<string, Observation[]>()
    for (const observation of observations) {
      const series = grouped.get(observation.series.id) ?? []
      series.push(observation)
      grouped.set(observation.series.id, series)
    }
    return [...grouped.entries()].map(([id, rows]) => {
      const first = rows[0]!
      const byId = new Map(rows.map((observation) => [observation.id, observation]))
      const input: XYObservation[] = rows.map((observation) => {
        const score = displayScoreResult(observation, scoreMetric)
        const percentageScale = hasPercentageScoreScale(score)
        return {
          id: observation.id,
          x: xValue(observation, xMetric, statistic),
          y: percentageScale ? score.value : null,
          yMissingReason: !percentageScale ? 'unknown-score-scale' : undefined,
          effortOrder: observation.effort.order,
        }
      })
      return {
        id,
        rows,
        first,
        byId,
        color: stableColor(modelKey(first)),
        segments: segmentXY(input, scale),
      }
    })
  }, [observations, xMetric, statistic, scoreMetric, scale])

  const accepted = plotSeries.flatMap((series) => series.segments.points)
  const estimatedPlotPoints = usageScenarios.flatMap(({ observation, scenario }) => {
    if (xMetric === 'time') return []
    const score = displayScoreResult(observation, scoreMetric)
    if (!hasPercentageScoreScale(score)) return []
    const x = scenarioXValue(scenario, xMetric)
    if (!Number.isFinite(x) || x < 0 || scale === 'log' && x === 0) return []
    return [{ observation, scenario, score, x }]
  })
  const estimatedObservationIds = new Set(estimatedPlotPoints.map(({ observation }) => observation.id))
  const xValues = [
    ...accepted.map((point) => point.x),
    ...estimatedPlotPoints.map((point) => point.x),
  ]
  const positiveValues = xValues.filter((value): value is number => value !== null && value > 0)
  const linearValues = xValues.filter((value): value is number => value !== null)
  let xMin = scale === 'log' ? Math.min(...(positiveValues.length ? positiveValues : [1])) : 0
  let xMax = Math.max(...(scale === 'log' ? positiveValues : linearValues), xMin)
  if (xMax === xMin) xMax = scale === 'log' ? xMin * 10 : xMin + 1
  const hasXAxisExtent = linearValues.length > 0
  const ticks = hasXAxisExtent ? makeTicks(scale, xMin, xMax) : []
  const plottedRows = plotSeries.flatMap((series) => series.segments.points.map((point) => ({ series, point, observation: series.byId.get(point.id)! })))
  const references = plotSeries.flatMap((series) => series.rows.flatMap((observation) => {
    const score = displayScoreResult(observation, scoreMetric)
    const metric = metricObservation(observation, xMetric, statistic)
    return metric.value === null && hasPercentageScoreScale(score) && !estimatedObservationIds.has(observation.id)
      ? [{ series, observation, score, missingReason: metric.missingReason ?? `${statistic} ${xMetricLabels[xMetric].label} is not reported.` }]
      : []
  }))
  const omitted = plotSeries.flatMap((series) => series.segments.omitted
    .filter((item) => item.reason !== 'missing-x')
    .map((item) => ({ ...item, observation: series.byId.get(item.id)! })))
  const plottedMetricIds = new Set(plotSeries.flatMap((series) => series.rows.flatMap((observation) => {
    const score = displayScoreResult(observation, scoreMetric)
    const x = xValue(observation, xMetric, statistic)
    return hasPercentageScoreScale(score) && (x === null || scale === 'linear' || x > 0) ? [score.metric] : []
  })))
  const scoreAxisLabel = plottedMetricIds.size === 1 && plottedMetricIds.has('pass_at_1')
    ? 'PASS@1 (%)'
    : plottedMetricIds.size === 1 && plottedMetricIds.has('pass_at_4')
      ? 'PASS@4 (%)'
      : 'SCORE (%)'
  const hasChartMarks = plottedRows.length > 0 || estimatedPlotPoints.length > 0 || references.length > 0

  return (
    <div className="chart-frame">
      {!hasChartMarks ? (
        <div className="chart-empty" role="status">
          <span className="empty-index">NO MATCHED PAIRS</span>
          <h3>{xMetric === 'time' ? 'No timing points match these settings.' : 'No paired score and efficiency points match these settings.'}</h3>
          <p>{xMetric === 'time' ? 'Reported mean and median seconds are shown only when published by the source. This view will not substitute tokens, steps, or an inferred runtime.' : 'Observations without an explicit percentage/fraction score or a usable X measurement remain in the table and evidence details.'}</p>
        </div>
      ) : (
        <svg
          id="effort-curve"
          ref={svgRef}
          className="effort-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Score chart. Horizontal axis: ${hasXAxisExtent ? `${statistic} ${xMetricLabels[xMetric].label}` : `no measured ${xMetricLabels[xMetric].label} extent`}; vertical axis: ${scoreAxisLabel}. Connected segments use only measured configurations from one evaluation series. Hollow diamonds are standalone estimated usage scenarios and are never connected. Dashed references show source scores without a selected X value; their horizontal span has no X meaning.`}
        >
          <defs>
            <pattern id="chart-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#d7d0c1" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="var(--paper-strong)" />
          {Array.from({ length: 5 }, (_, index) => {
            const value = index / 4
            const y = scaleY(value)
            return (
              <g key={`y-${value}`}>
                <line x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} className="grid-line" />
                <text x={PLOT.left - 14} y={y + 4} className="tick-label" textAnchor="end">{Math.round(value * 100)}%</text>
              </g>
            )
          })}
          {hasXAxisExtent && ticks.map((value, index) => {
            const x = scaleX(value, scale, xMin, xMax)
            return (
              <g key={`x-${index}`}>
                <line y1={PLOT.top} y2={PLOT.bottom} x1={x} x2={x} className="grid-line vertical" />
                <text x={x} y={PLOT.bottom + 22} className="tick-label x-tick-label" textAnchor="middle">{formatAxis(value, xMetric)}</text>
              </g>
            )
          })}
          <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className="axis-line" />
          <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} className="axis-line" />
          <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 10} className="axis-title x-axis-title" textAnchor="middle">
            {hasXAxisExtent ? `${statistic === 'mean' ? 'MEAN' : 'MEDIAN'} ${xMetricLabels[xMetric].axis.toUpperCase()}` : 'SCORE-ONLY REFERENCES · NO MEASURED X EXTENT'}
          </text>
          <text x="21" y={(PLOT.top + PLOT.bottom) / 2} className="axis-title y-title" textAnchor="middle" transform={`rotate(-90 21 ${(PLOT.top + PLOT.bottom) / 2})`}>
            {scoreAxisLabel}
          </text>
          {connections && plotSeries.map((series) => series.segments.connected.map((segment, index) => {
            const points = segment.map((point) => `${scaleX(point.x!, scale, xMin, xMax)},${scaleY(point.y!)}`).join(' L ')
            const opacity = activeSeriesId && activeSeriesId !== series.id ? 0.16 : 0.72
            const dash = series.first.sourceCategory === 'developer' ? '8 6' : series.first.sourceCategory === 'independent' ? '2 6' : undefined
            return <path key={`${series.id}-${index}`} d={`M ${points}`} className="curve-path" data-series-id={series.id} data-observation-ids={segment.map((point) => point.id).join(' ')} style={{ stroke: series.color, opacity }} strokeDasharray={dash} />
          }))}
          {references.map(({ series, observation, score, missingReason }) => {
            const y = scaleY(score.value)
            const highlight = activeSeriesId === series.id || selectedObservationId === observation.id
            const seriesDimmed = Boolean(activeSeriesId && activeSeriesId !== series.id)
            const protocol = `${observation.publisher}; ${observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'DeepSWE version unspecified'}; protocol ${observation.series.harness ?? 'not reported'}; evaluation policy ${observation.series.evaluationPolicy ?? 'not reported'}`
            const selectedMetricNote = score.metric === scoreMetric ? '' : `Different metric from selected ${scoreMetricLabels[scoreMetric]}. `
            const detail = `${observation.model.reportedName}; ${score.reportedText}; source metric: ${score.metricLabel}. ${selectedMetricNote}Source/protocol: ${protocol}. The selected X measurement is not reported: ${missingReason}. The horizontal span is visual only and does not encode X values.`
            return (
              <g
                key={observation.id}
                className={`score-reference ${highlight ? 'is-highlighted' : ''} ${seriesDimmed ? 'is-dimmed' : ''}`}
                aria-hidden="true"
                pointerEvents="none"
                data-series-id={series.id}
                data-observation-id={observation.id}
                data-score-metric={score.metric}
              >
                <title>{detail}</title>
                <line x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} className="score-reference-line" style={{ stroke: series.color, opacity: 0.88, strokeWidth: highlight ? 3 : 2, strokeDasharray: '6 5' }} />
                {sourceShape(observation.sourceCategory, PLOT.left, y, series.color, selectedObservationId === observation.id)}
              </g>
            )
          })}
          {plottedRows.map(({ series, point, observation }, index) => {
            const x = scaleX(point.x!, scale, xMin, xMax)
            const y = scaleY(point.y!)
            const result = displayScoreResult(observation, scoreMetric)
            const confidence = result.confidenceInterval
            const highlight = activeSeriesId === series.id || selectedObservationId === observation.id
            const seriesDimmed = Boolean(activeSeriesId && activeSeriesId !== series.id)
            const metricNote = result.metric === scoreMetric ? '' : ` Different metric from selected ${scoreMetricLabels[scoreMetric]}.`
            const protocol = `${observation.publisher}; ${observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'DeepSWE version unspecified'}; protocol ${observation.series.harness ?? 'not reported'}; evaluation policy ${observation.series.evaluationPolicy ?? 'not reported'}`
            const label = `${observation.model.reportedName}; ${displayScoreValue(result)}; source metric: ${result.metricLabel}.${metricNote} Source/protocol: ${protocol}; ${observation.effort.reportedLabel ?? 'effort unreported'}; ${formatAxis(point.x!, xMetric)} ${xMetricLabels[xMetric].axis}`
            const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(observation.id)
              }
            }
            return (
              <g
                key={observation.id}
                className={`plot-point ${highlight ? 'is-highlighted' : ''} ${seriesDimmed ? 'is-dimmed' : ''}`}
                role="button"
                tabIndex={0}
                data-series-id={series.id}
                data-observation-id={observation.id}
                data-score-metric={result.metric}
                aria-label={`${label}. Activate to open evidence details.`}
                onMouseEnter={() => onActiveSeries(series.id)}
                onMouseLeave={() => onActiveSeries(null)}
                onFocus={() => onActiveSeries(series.id)}
                onBlur={() => onActiveSeries(null)}
                onClick={() => onSelect(observation.id)}
                onDoubleClick={() => onIsolate(modelKey(observation))}
                onKeyDown={onKeyDown}
              >
                <title>{label}{confidence && confidence.low !== null ? `; 95% CI ${(confidence.low * 100).toFixed(1)}–${((confidence.high ?? confidence.low) * 100).toFixed(1)}%` : ''}</title>
                {confidence && confidence.low !== null && confidence.high !== null && (
                  <g className="confidence-mark" aria-hidden="true">
                    <line x1={x} x2={x} y1={scaleY(confidence.high)} y2={scaleY(confidence.low)} />
                    <line x1={x - 5} x2={x + 5} y1={scaleY(confidence.high)} y2={scaleY(confidence.high)} />
                    <line x1={x - 5} x2={x + 5} y1={scaleY(confidence.low)} y2={scaleY(confidence.low)} />
                  </g>
                )}
                <circle cx={x} cy={y} r="13" className="point-hit-area" />
                {sourceShape(observation.sourceCategory, x, y, series.color, selectedObservationId === observation.id)}
                {activeSeriesId === series.id && <text x={x + 9} y={y - (index % 2 ? 10 : -18)} className="point-label">{observation.effort.reportedLabel ?? 'effort ?'}</text>}
              </g>
            )
          })}
          {estimatedPlotPoints.map(({ observation, scenario, score, x }) => {
            const px = scaleX(x, scale, xMin, xMax)
            const py = scaleY(score.value)
            const seriesId = observation.series.id
            const highlight = activeSeriesId === seriesId || selectedObservationId === observation.id
            const seriesDimmed = Boolean(activeSeriesId && activeSeriesId !== seriesId)
            const estimate = xMetric === 'cost' ? `$${x.toFixed(2)} per scored attempt` : `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(x)} output tokens per scored attempt`
            const range = xMetric === 'cost' ? scenario.costSensitivityRange : scenario.outputTokenSensitivityRange
            const sensitivity = range
              ? ` Observed sensitivity envelope: ${xMetric === 'cost' ? `$${range[0].toFixed(2)}–$${range[1].toFixed(2)}` : `${new Intl.NumberFormat('en').format(range[0])}–${new Intl.NumberFormat('en').format(range[1])} tokens`}; not a confidence interval.`
              : ' No defensible sensitivity range or prediction interval is available.'
            const method = xMetric === 'cost' ? scenario.costCalibrationDescription : scenario.outputCalibrationDescription
            const sourceNotes = scenario.sources.map((source) => `${source.publisher} ${source.id}, accessed ${source.accessedOn}`).join('; ')
            const tokenNote = xMetric === 'outputTokens'
              ? ` AA Coding Agent suite total ${new Intl.NumberFormat('en').format(scenario.aaCodingSuiteMixedTokensPerTask)} tokens/task mixes categories and is not used as output; cost is not converted into tokens.`
              : ''
            const detail = `Estimated usage scenario — not a DeepSWE measurement. ${observation.model.reportedName}, ${observation.effort.reportedLabel ?? 'effort unreported'}, ${observation.series.harness ?? 'harness unknown'}; source score ${score.reportedText} (${score.metricLabel}); ${estimate}. Evidence quality: ${scenario.confidence === 'low' ? 'low' : 'very low'}, qualitative and not probabilistic. Method: ${method}.${sensitivity}${tokenNote} Cross-harness transfer; the developer-report harness is unknown. Evidence: ${sourceNotes}.`
            const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(observation.id)
              }
            }
            return (
              <g
                key={scenario.id}
                className={`estimated-point ${highlight ? 'is-highlighted' : ''} ${seriesDimmed ? 'is-dimmed' : ''}`}
                role="button"
                tabIndex={0}
                data-usage-scenario-id={scenario.id}
                data-observation-id={observation.id}
                data-series-id={seriesId}
                data-score-metric={score.metric}
                data-x-metric={xMetric}
                aria-label={`${detail} Activate to open the source observation and scenario evidence.`}
                onMouseEnter={() => onActiveSeries(seriesId)}
                onMouseLeave={() => onActiveSeries(null)}
                onFocus={() => onActiveSeries(seriesId)}
                onBlur={() => onActiveSeries(null)}
                onClick={() => onSelect(observation.id)}
                onDoubleClick={() => onIsolate(modelKey(observation))}
                onKeyDown={onKeyDown}
              >
                <title>{detail}</title>
                <circle cx={px} cy={py} r="13" className="point-hit-area" />
                <path d={`M ${px} ${py - 8} L ${px + 8} ${py} L ${px} ${py + 8} L ${px - 8} ${py} Z`} className="estimated-diamond" />
                {(activeSeriesId === seriesId || selectedObservationId === observation.id) && <text x={px + 10} y={py - 9} className="estimated-label">EST · {observation.effort.reportedLabel}</text>}
              </g>
            )
          })}
          <g className="chart-callout" transform={`translate(${PLOT.right + 12} ${PLOT.top + 4})`}>
            <rect width="52" height="42" rx="2" />
            <text x="26" y="17" textAnchor="middle">{plottedRows.length}</text>
            <text x="26" y="32" textAnchor="middle" className="callout-caption">MEASURED</text>
          </g>
          {estimatedPlotPoints.length > 0 && <g className="chart-callout scenario-count-callout" transform={`translate(${PLOT.right + 12} ${PLOT.top + 52})`}>
            <rect width="52" height="42" rx="2" />
            <text x="26" y="17" textAnchor="middle">{estimatedPlotPoints.length}</text>
            <text x="26" y="32" textAnchor="middle" className="callout-caption">EST.</text>
          </g>}
          {references.length > 0 && <g className="chart-callout" transform={`translate(${PLOT.right + 12} ${PLOT.top + (estimatedPlotPoints.length ? 100 : 52)})`}>
            <rect width="52" height="42" rx="2" />
            <text x="26" y="17" textAnchor="middle">{references.length}</text>
            <text x="26" y="32" textAnchor="middle" className="callout-caption">REFS</text>
          </g>}
        </svg>
      )}
      {references.length > 0 && <details className="score-reference-key">
        <summary>Score-only references <span>{references.length} · dashed lines have no X value</span></summary>
        <ul className="score-reference-list">
          {references.map(({ series, observation, score, missingReason }) => {
            const protocol = `${observation.publisher}; ${observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'DeepSWE version unspecified'}; protocol ${observation.series.harness ?? 'not reported'}; evaluation policy ${observation.series.evaluationPolicy ?? 'not reported'}`
            const selectedMetricNote = score.metric === scoreMetric ? '' : ` Different metric from selected ${scoreMetricLabels[scoreMetric]}.`
            const detail = `${observation.model.reportedName}; ${score.reportedText}; source metric: ${score.metricLabel}.${selectedMetricNote} Source/protocol: ${protocol}. The selected ${statistic} ${xMetricLabels[xMetric].label} value is not reported: ${missingReason}. The horizontal span is visual only and encodes no X values.`
            const selected = selectedObservationId === observation.id
            return <li key={observation.id}>
              <button
                type="button"
                className={`score-reference-entry ${selected ? 'is-selected' : ''}`}
                data-observation-id={observation.id}
                data-series-id={series.id}
                data-score-metric={score.metric}
                aria-label={detail}
                aria-pressed={selected}
                onMouseEnter={() => onActiveSeries(series.id)}
                onMouseLeave={() => onActiveSeries(null)}
                onFocus={() => onActiveSeries(series.id)}
                onBlur={() => onActiveSeries(null)}
                onClick={() => onSelect(observation.id)}
              >
                <span className="score-reference-swatch" style={{ borderColor: series.color }} aria-hidden="true" />
                <span className="score-reference-copy"><strong>{displayModelName(observation.model.reportedName)} · {displayScoreValue(score)}</strong><small>{score.metricLabel} · {protocol} · {statistic} {xMetricLabels[xMetric].label}: {missingReason}</small></span>
              </button>
            </li>
          })}
        </ul>
      </details>}
      {omitted.length > 0 && (
        <p className="chart-footnote" role="status">
          {omitted.length} selected configuration{omitted.length === 1 ? '' : 's'} omitted from this percentage plot: {countReasons(omitted.map((entry) => entry.reason))}. The source records remain available below.
        </p>
      )}
      <div className="chart-caption-row">
        <span>Filled points are measured configurations. Hollow amber diamonds are standalone, estimated scenarios and never join effort paths. Dashed references have no X value and encode no cost, token, or time range.</span>
        <span>Source marks: ● organizer · ◆ developer · ▲ independent · ■ local evaluation · expand the score-only reference key for metric and protocol labels.</span>
      </div>
    </div>
  )
}

function countReasons(reasons: string[]): string {
  const labels: Record<string, string> = {
    'missing-x': 'metric not reported',
    'missing-score': 'selected score metric not reported',
    'unknown-score-scale': 'source score unit not established for the percentage axis',
    'non-positive-log-x': 'zero omitted on log scale',
    'negative-x': 'invalid negative value',
  }
  const counts = new Map<string, number>()
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts.entries()].map(([reason, count]) => `${count} ${labels[reason] ?? reason}`).join('; ')
}
