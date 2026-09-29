import { useMemo } from 'react'
import type { RefObject } from 'react'
import { displayModelName, displayScoreResult, displayScoreValue, hasPercentageScoreScale, metricObservation, modelKey, scoreMetricLabels, xMetricLabels, type ScoreMetric, type Statistic, type XMetric } from '../lib/comparison'
import { segmentXY, type AxisScale, type XYObservation } from '../lib/xy'
import type { Observation } from '../lib/schema'
import { scenarioXValue, usageScenarioForObservation, type UsageScenario } from '../lib/usage-scenarios'

const WIDTH = 1160
const HEIGHT = 470
const PLOT = { left: 82, right: 840, top: 44, bottom: 398 }
const NO_DATA_COLUMNS = 17
const NO_DATA_COLUMN_STEP = 18
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

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} min`
  return `${formatNumber(seconds)} s`
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

function sourceShape(category: Observation['sourceCategory'], x: number, y: number, color: string, selected: boolean, size = 1) {
  const stroke = selected ? '#171b1a' : '#f3f0e7'
  const strokeWidth = selected ? 3 : 1.8
  if (category === 'developer') return <path d={`M ${x} ${y - 7 * size} L ${x + 7 * size} ${y} L ${x} ${y + 7 * size} L ${x - 7 * size} ${y} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  if (category === 'independent') return <path d={`M ${x} ${y - 8 * size} L ${x + 7 * size} ${y + 6 * size} L ${x - 7 * size} ${y + 6 * size} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  if (category === 'local') return <path d={`M ${x - 6 * size} ${y - 6 * size} h ${12 * size} v ${12 * size} h ${-12 * size} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
  return <circle cx={x} cy={y} r={(selected ? 7.5 : 6) * size} fill={color} stroke={stroke} strokeWidth={strokeWidth} />
}

interface NoDataMark {
  series: { id: string; color: string }
  observation: Observation
  score: ReturnType<typeof displayScoreResult>
  missingReason: string
  scenarioNote: string | null
  x: number
  y: number
}

interface SelectedGuideMark {
  observation: Observation
  score: ReturnType<typeof displayScoreResult>
  x: number
  y: number
  xValue: number | null
  estimated: boolean
  scenarioType?: UsageScenario['costScenarioType'] | null
  scenarioOutputEvidenceType?: UsageScenario['outputEvidenceType'] | null
  scenarioCostUnit?: string | null
  missingReason: string | null
}

function arrangeNoDataMarks(items: Omit<NoDataMark, 'x' | 'y'>[]): NoDataMark[] {
  const columns = Array.from({ length: NO_DATA_COLUMNS }, () => [] as number[])
  const ordered = [...items].sort((left, right) => scaleY(left.score.value) - scaleY(right.score.value) || left.observation.id.localeCompare(right.observation.id))
  return ordered.map((item) => {
    const y = scaleY(item.score.value)
    const freeColumn = columns.findIndex((occupied) => occupied.every((occupiedY) => Math.abs(occupiedY - y) >= 17))
    const column = freeColumn >= 0 ? freeColumn : columns.reduce((best, occupied, index) => occupied.length < columns[best]!.length ? index : best, 0)
    columns[column]!.push(y)
    return { ...item, x: PLOT.right + 11 + column * NO_DATA_COLUMN_STEP, y }
  })
}

export interface ExplorerChartProps {
  observations: Observation[]
  usageScenarios: { observation: Observation; scenario: UsageScenario }[]
  chartSuppressions: ReadonlyMap<string, Observation[]>
  suppressedCount: number
  xMetric: XMetric
  statistic: Statistic
  strict: boolean
  includeUsageScenarios: boolean
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
  chartSuppressions,
  suppressedCount,
  xMetric,
  statistic,
  strict,
  includeUsageScenarios,
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
  const hasApproximateCost = xMetric === 'cost' && statistic === 'mean' && observations.some((observation) => Boolean(observation.approximation))
  const scenarioCandidates = usageScenarios.flatMap(({ observation, scenario }) => {
    const score = displayScoreResult(observation, scoreMetric)
    if (!hasPercentageScoreScale(score)) return []
    const x = scenarioXValue(scenario, xMetric)
    return [{ observation, scenario, score, x }]
  })
  const estimatedPlotPoints = scenarioCandidates.filter(
    (point): point is (typeof scenarioCandidates)[number] & { x: number } =>
      point.x !== null && Number.isFinite(point.x) && point.x >= 0 && (scale === 'linear' || point.x > 0),
  )
  const scenarioCandidateIds = new Set(estimatedPlotPoints.map(({ observation }) => observation.id))
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
  const noDataMarks = arrangeNoDataMarks(plotSeries.flatMap((series) => series.rows.flatMap((observation) => {
    const score = displayScoreResult(observation, scoreMetric)
    const metric = metricObservation(observation, xMetric, statistic)
    if (metric.value !== null || !hasPercentageScoreScale(score) || scenarioCandidateIds.has(observation.id)) return []
    const scenario = usageScenarioForObservation(observation)
    const scenarioMetricValue = scenario ? scenarioXValue(scenario, xMetric) : null
    const scenarioNote = !scenario
      ? null
      : scenarioMetricValue === null
         ? `A scenario exists${scenario.costUsd === null ? '' : ` (${scenario.costUnit})`}; no ${xMetricLabels[xMetric].label.toLowerCase()} estimate is available.`
        : !includeUsageScenarios
        ? 'A cost/usage scenario exists, but the scenario toggle is off.'
        : strict
          ? 'A cost/usage scenario exists, but strict comparisons exclude scenarios.'
         : statistic === 'median'
             ? xMetric === 'outputTokens' && scenario.outputStatistic === 'source-deepswe-mean'
               ? 'A same-source AA DeepSWE output mean exists; no median output statistic is reported.'
               : scenario.scenarioStatistic === 'source-statistic-unspecified'
              ? 'This source-reported task cost has no mean/median statistic and is not shown in this Median view.'
              : scenario.scenarioStatistic === 'pooled-suite-average'
                ? 'This pooled-suite-average cost proxy is not converted to a median and is not shown in this view.'
                : 'A mean-only usage estimate exists; no median scenario is available.'
            : 'A scenario estimate is not active for this view.'
    return [{
      series: { id: series.id, color: series.color },
      observation,
      score,
      missingReason: metric.missingReason ?? `${statistic} ${xMetricLabels[xMetric].label} is not reported.`,
      scenarioNote,
    }]
  })))
  const scenarioOmitted = scenarioCandidates.filter(
    (point): point is (typeof scenarioCandidates)[number] & { x: number } =>
      point.x !== null && (!Number.isFinite(point.x) || point.x < 0 || scale === 'log' && point.x === 0),
  )
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
      : plottedMetricIds.size === 1 && plottedMetricIds.has('task_pass_rate')
        ? 'TASK PASS RATE (%)'
      : 'SCORE (%)'
  const hasChartMarks = plottedRows.length > 0 || estimatedPlotPoints.length > 0 || noDataMarks.length > 0
  const selectedGuide: SelectedGuideMark | null = (() => {
    if (!selectedObservationId) return null
    const measured = plottedRows.find(({ observation }) => observation.id === selectedObservationId)
    if (measured) {
      const score = displayScoreResult(measured.observation, scoreMetric)
      return {
        observation: measured.observation,
        score,
        x: scaleX(measured.point.x!, scale, xMin, xMax),
        y: scaleY(measured.point.y!),
        xValue: measured.point.x!,
        estimated: false,
         scenarioType: null,
         scenarioOutputEvidenceType: null,
        scenarioCostUnit: null,
        missingReason: null,
      }
    }
    const estimated = estimatedPlotPoints.find(({ observation }) => observation.id === selectedObservationId)
    if (estimated) {
      return {
        observation: estimated.observation,
        score: estimated.score,
        x: scaleX(estimated.x, scale, xMin, xMax),
        y: scaleY(estimated.score.value),
        xValue: estimated.x,
        estimated: true,
         scenarioType: estimated.scenario.costScenarioType,
         scenarioOutputEvidenceType: estimated.scenario.outputEvidenceType,
        scenarioCostUnit: estimated.scenario.costUnit,
        missingReason: null,
      }
    }
    const missing = noDataMarks.find(({ observation }) => observation.id === selectedObservationId)
    if (!missing) return null
    return {
      observation: missing.observation,
      score: missing.score,
      x: missing.x,
      y: missing.y,
        xValue: null,
        estimated: false,
         scenarioType: null,
         scenarioOutputEvidenceType: null,
        scenarioCostUnit: null,
        missingReason: missing.missingReason,
    }
  })()
  const selectedGuideLabel = selectedGuide
    ? selectedGuide.xValue === null
      ? `${selectedGuide.observation.model.reportedName}; ${displayScoreValue(selectedGuide.score)} ${selectedGuide.score.metricLabel}; no ${xMetricLabels[xMetric].label.toLowerCase()} value is reported: ${selectedGuide.missingReason}. No numeric X guide is shown.`
       : selectedGuide.scenarioOutputEvidenceType === 'same-source-deepswe-mean' && xMetric === 'outputTokens'
         ? `${selectedGuide.observation.model.reportedName}; ${displayScoreValue(selectedGuide.score)} ${selectedGuide.score.metricLabel}; source-reported AA DeepSWE output mean per task attempt (output-telemetry sample count unspecified): ${formatAxis(selectedGuide.xValue, xMetric)} tokens. This is a separate scenario-layer reference, not a populated approved measurement.`
       : selectedGuide.scenarioType === 'source-reported-cost'
        ? `${selectedGuide.observation.model.reportedName}; ${displayScoreValue(selectedGuide.score)} ${selectedGuide.score.metricLabel}; source-reported cost scenario: ${formatAxis(selectedGuide.xValue, xMetric)} ${selectedGuide.scenarioCostUnit}.`
       : selectedGuide.scenarioType === 'aa-suite-proxy' && xMetric === 'cost'
          ? `${selectedGuide.observation.model.reportedName}; ${displayScoreValue(selectedGuide.score)} ${selectedGuide.score.metricLabel}; pooled-suite cost proxy: ${formatAxis(selectedGuide.xValue, xMetric)} ${selectedGuide.scenarioCostUnit}.`
           : selectedGuide.observation.approximation && xMetric === 'cost'
             ? `${selectedGuide.observation.model.reportedName}; ${selectedGuide.observation.effort.reportedLabel}; approximate screenshot-derived score ${displayScoreValue(selectedGuide.score)}; approximate source-chart Cost per task ${formatAxis(selectedGuide.xValue, xMetric)}; aggregation and task denominator unspecified. Reading bounds ${selectedGuide.observation.approximation.costBoundsUsd.join('–')} USD and ${selectedGuide.observation.approximation.scoreBoundsPercent.join('–')}%; not a confidence interval.`
             : `${selectedGuide.observation.model.reportedName}; ${displayScoreValue(selectedGuide.score)} ${selectedGuide.score.metricLabel}; ${selectedGuide.estimated ? 'estimated scenario' : 'reported'} ${statistic} ${xMetricLabels[xMetric].axis}: ${formatAxis(selectedGuide.xValue, xMetric)}.`
    : null
  const selectedGuideXAnchor = selectedGuide && selectedGuide.x <= PLOT.left + 54
    ? 'start'
    : selectedGuide && selectedGuide.x >= PLOT.right - 54
      ? 'end'
      : 'middle'
  const selectedGuideLabelX = selectedGuide
    ? selectedGuideXAnchor === 'start'
      ? Math.min(selectedGuide.x + 7, PLOT.right - 24)
      : selectedGuideXAnchor === 'end'
        ? Math.max(selectedGuide.x - 7, PLOT.left + 24)
        : selectedGuide.x
    : 0
  const selectedGuideScoreX = selectedGuide && selectedGuide.xValue !== null && selectedGuide.x <= PLOT.left + 55
    ? Math.min(selectedGuide.x + 12, PLOT.right - 52)
    : PLOT.left + 8
  const selectedGuideScoreY = selectedGuide && selectedGuide.y <= PLOT.top + 12
    ? selectedGuide.y + 16
    : (selectedGuide?.y ?? 0) - 7
  const selectedGuideMissingLabel = xMetric === 'outputTokens'
    ? 'NO OUTPUT-TOKEN DATA'
    : xMetric === 'time'
      ? 'NO TIME DATA'
      : 'NO COST DATA'
  const selectedGuideMissingX = selectedGuide && selectedGuide.x > WIDTH - 110 ? selectedGuide.x - 12 : (selectedGuide?.x ?? 0) + 12
  const selectedGuideMissingAnchor = selectedGuide && selectedGuide.x > WIDTH - 110 ? 'end' : 'start'
  const selectedGuideMissingY = selectedGuide && selectedGuide.y > PLOT.bottom - 12 ? selectedGuide.y - 11 : (selectedGuide?.y ?? 0) + 4
  const selectedSuppression = selectedObservationId ? chartSuppressions.get(selectedObservationId) : undefined

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
          role="group"
             aria-label={`Score chart. Horizontal axis: ${hasXAxisExtent ? `${hasApproximateCost ? 'mixed mean-per-attempt and approximate source-chart' : statistic} ${xMetricLabels[xMetric].label}` : `no usable numeric ${xMetricLabels[xMetric].label} values`}; vertical axis: ${scoreAxisLabel}. Connected segments follow one source series; screenshot-derived coordinates are approximate and have unknown cost aggregation. Hollow diamonds are standalone cost/usage scenarios with point-specific evidence and units; they are never connected. The far-right no-data lane is outside the numeric X axis; horizontal position in that lane encodes no X value.`}
        >
          {hasApproximateCost && <desc>GPT-6.1 Sol source path: five screenshot-derived approximate coordinates. Cost is source-chart Cost per task with unknown task denominator and aggregation; reading bounds are not confidence intervals. Point details retain the screenshot hash and source.</desc>}
          <defs>
            <pattern id="chart-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#d7d0c1" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="var(--paper-strong)" />
          {noDataMarks.length > 0 && <>
            <rect x={PLOT.right + 2} y={PLOT.top} width={WIDTH - PLOT.right - 14} height={PLOT.bottom - PLOT.top} className="no-data-lane" />
            <line x1={PLOT.right + 1} x2={PLOT.right + 1} y1={PLOT.top} y2={PLOT.bottom} className="no-data-lane-divider" />
            <text x={PLOT.right + 13} y={PLOT.top - 25} className="no-data-lane-title">NO DATA</text>
            <text x={WIDTH - 17} y={PLOT.top - 25} className="no-data-lane-count" textAnchor="end">{noDataMarks.length}</text>
            <text x={PLOT.right + 13} y={PLOT.top - 13} className="no-data-lane-note">outside numeric X scale</text>
          </>}
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
             {hasXAxisExtent ? hasApproximateCost ? 'COST (USD / TASK) · SOURCE SCOPE VARIES BY POINT' : `${statistic === 'mean' ? 'MEAN' : 'MEDIAN'} ${xMetricLabels[xMetric].axis.toUpperCase()}` : 'SCORE-ONLY · NO NUMERIC X DATA'}
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
          {noDataMarks.map(({ series, observation, score, missingReason, scenarioNote, x, y }) => {
            const highlight = activeSeriesId === series.id || selectedObservationId === observation.id
            const seriesDimmed = Boolean(activeSeriesId && activeSeriesId !== series.id)
            const protocol = `${observation.publisher}; ${observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'DeepSWE version unspecified'}; protocol ${observation.series.harness ?? 'not reported'}; evaluation policy ${observation.series.evaluationPolicy ?? 'not reported'}`
            const selectedMetricNote = score.metric === scoreMetric ? '' : `Different metric from selected ${scoreMetricLabels[scoreMetric]}. `
            const scenarioText = scenarioNote ? ` ${scenarioNote}` : ''
            const detail = `${observation.model.reportedName}; ${score.reportedText}; source metric: ${score.metricLabel}. ${selectedMetricNote}Source/protocol: ${protocol}. The selected ${statistic} ${xMetricLabels[xMetric].label} measurement is not reported: ${missingReason}.${scenarioText} This mark is in the separate no-data lane; its horizontal position encodes no X value.`
            const onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(observation.id)
              }
            }
            return (
              <g
                key={observation.id}
                className={`no-data-point ${highlight ? 'is-highlighted' : ''} ${seriesDimmed ? 'is-dimmed' : ''}`}
                role="button"
                tabIndex={0}
                data-no-data-observation-id={observation.id}
                data-series-id={series.id}
                data-observation-id={observation.id}
                data-score-metric={score.metric}
                aria-label={`${detail} Activate to open evidence details.`}
                aria-pressed={selectedObservationId === observation.id}
                onMouseEnter={() => onActiveSeries(series.id)}
                onMouseLeave={() => onActiveSeries(null)}
                onFocus={() => onActiveSeries(series.id)}
                onBlur={() => onActiveSeries(null)}
                onClick={() => onSelect(observation.id)}
                onDoubleClick={() => onIsolate(modelKey(observation))}
                onKeyDown={onKeyDown}
              >
                <title>{detail}</title>
                <circle cx={x} cy={y} r="8" className="point-hit-area" />
                {sourceShape(observation.sourceCategory, x, y, series.color, selectedObservationId === observation.id, 0.9)}
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
             const label = `${observation.model.reportedName}; ${displayScoreValue(result)}; source metric: ${result.metricLabel}.${metricNote} Source/protocol: ${protocol}; ${observation.effort.reportedLabel ?? 'effort unreported'}; ${observation.approximation && xMetric === 'cost' ? `approximate screenshot-derived Cost per task ${formatAxis(point.x!, xMetric)}; aggregation and denominator unknown; reading bounds ${observation.approximation.costBoundsUsd.join('–')} USD and ${observation.approximation.scoreBoundsPercent.join('–')}%, not a confidence interval` : `${formatAxis(point.x!, xMetric)} ${xMetricLabels[xMetric].axis}`}`
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
                 {activeSeriesId === series.id && <text x={x + 9} y={y - (index % 2 ? 10 : -18)} className="point-label">{observation.effort.reportedLabel ?? 'effort ?'}{observation.approximation ? ' ≈' : ''}</text>}
              </g>
            )
          })}
          {estimatedPlotPoints.map(({ observation, scenario, score, x }) => {
            const px = scaleX(x, scale, xMin, xMax)
            const py = scaleY(score.value)
            const seriesId = observation.series.id
            const highlight = activeSeriesId === seriesId || selectedObservationId === observation.id
            const seriesDimmed = Boolean(activeSeriesId && activeSeriesId !== seriesId)
            const estimate = xMetric === 'cost'
              ? `$${x.toFixed(2)} · ${scenario.costUnit}`
              : xMetric === 'outputTokens'
                 ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(x)} ${scenario.outputUnit}`
                : `${formatDuration(x)} reported time per scored attempt`
            const range = xMetric === 'cost' ? scenario.costSensitivityRange : xMetric === 'outputTokens' ? scenario.outputTokenSensitivityRange : scenario.timeSensitivityRange
            const sensitivity = range
              ? ` Observed sensitivity envelope: ${xMetric === 'cost' ? `$${range[0].toFixed(2)}–$${range[1].toFixed(2)}` : xMetric === 'outputTokens' ? `${new Intl.NumberFormat('en').format(range[0])}–${new Intl.NumberFormat('en').format(range[1])} tokens` : `${formatDuration(range[0])}–${formatDuration(range[1])}`}; not a confidence interval.`
              : ' No defensible sensitivity range or prediction interval is available.'
            const method = xMetric === 'cost' ? scenario.costCalibrationDescription : xMetric === 'outputTokens' ? scenario.outputCalibrationDescription : scenario.timeCalibrationDescription
            const sourceNotes = scenario.sources.map((source) => `${source.publisher} ${source.id}, accessed ${source.accessedOn}`).join('; ')
            const tokenNote = xMetric === 'outputTokens' && scenario.aaCodingSuiteMixedTokensPerTask !== null
              ? ` AA Coding Agent suite total ${new Intl.NumberFormat('en').format(scenario.aaCodingSuiteMixedTokensPerTask)} tokens/task mixes categories and is not used as output; cost is not converted into tokens.`
              : ''
             const directNote = xMetric === 'outputTokens' && scenario.outputEvidenceType === 'same-source-deepswe-mean'
               ? scenario.costScenarioType === 'aa-suite-proxy'
                 ? ' The output is this AA variant’s DeepSWE mean; its separate dollar value is a three-benchmark pooled-suite proxy, not a DeepSWE-only cost.'
                 : scenario.directUsageReference
                   ? ' The output is this AA variant’s DeepSWE mean; its separate cost/time scenario uses a different Datacurve run, not an AA DeepSWE bill.'
                   : ' The output is this AA variant’s DeepSWE mean; its separate cost/time scenarios are cross-benchmark transfers, not AA DeepSWE measurements.'
               : scenario.costScenarioType === 'source-reported-cost'
               ? ' This publisher-reported Cost/Task value is shown only for this exact report; the benchmark version, harness, denominator, run identity, and cost accounting basis are unspecified, so it is not normalized as a mean cost per scored attempt.'
               : scenario.costScenarioType === 'aa-suite-proxy' && xMetric === 'cost'
                ? ' The Artificial Analysis cost is a same-row pooled Coding Agent suite value across DeepSWE v1.1, Terminal-Bench 4.0, and SWE-Atlas-QnA; it is carried unchanged as a proxy, not allocated to DeepSWE.'
                : scenario.directUsageReference
               ? ` The scenario uses a separate same-model/effort Datacurve DeepSWE row (${scenario.directUsageReference.configurationId}, ${scenario.directUsageReference.scoredAttempts} scored attempts, ${scenario.directUsageReference.runs} runs); it is not the target source run.`
               : ' These are cross-benchmark transfer inputs; their task populations and source cost bases are not established as equal.'
            const timeNote = xMetric === 'time' ? ' Timer boundaries are unspecified for the Datacurve mean; this is not a verified end-to-end duration.' : ''
            const scenarioLead = scenario.costScenarioType === 'source-reported-cost'
              ? 'Source-reported cost scenario — not a normalized DeepSWE measurement.'
               : scenario.costScenarioType === 'aa-suite-proxy' && xMetric === 'cost'
                 ? 'Estimated suite-cost proxy — not a DeepSWE-only measurement.'
                 : scenario.outputEvidenceType === 'same-source-deepswe-mean' && xMetric === 'outputTokens'
                   ? 'Same-source AA DeepSWE mean — separate scenario layer, not a normalized approved measurement.'
                : 'Estimated usage scenario — not a DeepSWE measurement.'
             const detail = `${scenarioLead} ${observation.model.reportedName}, ${observation.effort.reportedLabel ?? 'effort unreported'}, ${observation.series.harness ?? 'harness unknown'}; source score ${score.reportedText} (${score.metricLabel}); ${estimate}. ${scenario.outputEvidenceType === 'same-source-deepswe-mean' && xMetric === 'outputTokens' ? 'Output is a same-source DeepSWE mean; the separate dollar/time evidence is qualitative.' : `Evidence quality: ${scenario.confidence === 'low' ? 'low' : 'very low'}, qualitative and not probabilistic.`} Method: ${method}.${sensitivity}${tokenNote}${directNote}${timeNote} Evidence: ${sourceNotes}.`
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
                 {(activeSeriesId === seriesId || selectedObservationId === observation.id) && <text x={px + 10} y={py - 9} className="estimated-label">{xMetric === 'outputTokens' && scenario.outputEvidenceType === 'same-source-deepswe-mean' ? 'AA MEAN' : 'EST'} · {observation.effort.reportedLabel}</text>}
              </g>
            )
          })}
          {selectedGuide && selectedGuideLabel && (
            <g
              className={`selected-guide${selectedGuide.estimated ? ' is-estimated' : ''}${selectedGuide.xValue === null ? ' is-no-data' : ''}`}
              data-selected-guide-for={selectedGuide.observation.id}
              data-selected-guide-type={selectedGuide.xValue === null ? 'no-data' : xMetric === 'outputTokens' && selectedGuide.scenarioOutputEvidenceType === 'same-source-deepswe-mean' ? 'source-output' : selectedGuide.estimated ? 'estimated' : 'measured'}
              data-x-metric={xMetric}
              data-x-value={selectedGuide.xValue ?? 'missing'}
              role="img"
              aria-label={selectedGuideLabel}
              style={{ pointerEvents: 'none' }}
            >
              <title>{selectedGuideLabel}</title>
              <line className="selected-guide-line selected-guide-y" x1={PLOT.left} x2={selectedGuide.x} y1={selectedGuide.y} y2={selectedGuide.y} />
              {selectedGuide.xValue !== null && <line className="selected-guide-line selected-guide-x" x1={selectedGuide.x} x2={selectedGuide.x} y1={selectedGuide.y} y2={PLOT.bottom} />}
              <text className="selected-guide-label selected-guide-y-label" data-guide-axis="y" x={selectedGuideScoreX} y={selectedGuideScoreY} textAnchor="start">{displayScoreValue(selectedGuide.score)}</text>
              {selectedGuide.xValue !== null
                 ? <text className="selected-guide-label selected-guide-x-label" data-guide-axis="x" x={selectedGuideLabelX} y={PLOT.bottom + 35} textAnchor={selectedGuideXAnchor}>{selectedGuide.observation.approximation && xMetric === 'cost' ? '≈ SRC · ' : selectedGuide.scenarioOutputEvidenceType === 'same-source-deepswe-mean' && xMetric === 'outputTokens' ? 'AA MEAN · ' : selectedGuide.scenarioType === 'source-reported-cost' ? 'SRC · ' : selectedGuide.scenarioType === 'aa-suite-proxy' && xMetric === 'cost' ? 'PROXY · ' : selectedGuide.estimated ? 'EST · ' : ''}{formatAxis(selectedGuide.xValue, xMetric)}</text>
                : <text className="selected-guide-missing-label" data-guide-axis="x-missing" x={selectedGuideMissingX} y={selectedGuideMissingY} textAnchor={selectedGuideMissingAnchor}>{selectedGuideMissingLabel}</text>}
            </g>
          )}
        </svg>
      )}
      {noDataMarks.length > 0 && <details className="no-data-key">
        <summary>No data for selected X <span>{noDataMarks.length} · gutter is outside the numeric axis</span></summary>
        <ul className="no-data-list">
          {noDataMarks.map(({ series, observation, score, missingReason, scenarioNote }) => {
            const protocol = `${observation.publisher}; ${observation.benchmark.version ? `DeepSWE v${observation.benchmark.version}` : 'DeepSWE version unspecified'}; protocol ${observation.series.harness ?? 'not reported'}; evaluation policy ${observation.series.evaluationPolicy ?? 'not reported'}`
            const selectedMetricNote = score.metric === scoreMetric ? '' : ` Different metric from selected ${scoreMetricLabels[scoreMetric]}.`
            const scenarioText = scenarioNote ? ` ${scenarioNote}` : ''
            const detail = `${observation.model.reportedName}; ${score.reportedText}; source metric: ${score.metricLabel}.${selectedMetricNote} Source/protocol: ${protocol}. The selected ${statistic} ${xMetricLabels[xMetric].label} value is not reported: ${missingReason}.${scenarioText} The far-right lane has no X value.`
            const selected = selectedObservationId === observation.id
            return <li key={observation.id}>
              <button
                type="button"
                className={`no-data-entry ${selected ? 'is-selected' : ''}`}
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
                <span className="no-data-entry-swatch" style={{ borderColor: series.color }} aria-hidden="true" />
                <span className="no-data-entry-copy"><strong>{displayModelName(observation.model.reportedName)} · {displayScoreValue(score)}</strong><small>{score.metricLabel} · {protocol} · {statistic} {xMetricLabels[xMetric].label}: {missingReason}.{scenarioText}</small></span>
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
      {scenarioOmitted.length > 0 && (
        <p className="chart-footnote" role="status">
          {scenarioOmitted.length} estimated configuration{scenarioOmitted.length === 1 ? '' : 's'} omitted from this axis: {countReasons(scenarioOmitted.map(({ x }) => x === 0 && scale === 'log' ? 'non-positive-log-x' : x < 0 ? 'negative-x' : 'non-finite-x'))}. Known zero estimates remain distinct from missing data.
        </p>
      )}
      <div className="chart-caption-row">
           <span>{plottedRows.length} source coordinates{hasApproximateCost ? ' (including 5 approximate screenshot readings; cost aggregation unspecified)' : ''} · {estimatedPlotPoints.length} scenario · {noDataMarks.length} no-data. Hollow amber diamonds are standalone cost/usage scenarios and never join effort paths; task-cost source statistics remain point-specific. The far-right no-data lane is outside the numeric X axis.</span>
          <span>Source marks: ● organizer · ◆ developer · ▲ independent · ■ local evaluation · expand the no-data key for source, metric and omission notes.</span>
      </div>
      {suppressedCount > 0 && <p className="chart-footnote chart-precedence-note" role="status">{suppressedCount} matching non-Datacurve report{suppressedCount === 1 ? ' is' : 's are'} retained in the evidence table and exports but omitted from this chart by display precedence. An unspecified source version is not treated as a version conflict; known model, version, scope, and score-metric conflicts remain separate. Source rows are not merged.</p>}
      {selectedSuppression && <p className="chart-footnote chart-precedence-note" role="status" data-suppressed-selection={selectedObservationId}>The selected report is not plotted: {selectedSuppression[0]?.publisher} has a DeepSWE v{selectedSuppression[0]?.benchmark.version} result for this model{selectedSuppression[0]?.benchmark.version && ' while no different benchmark version is established'}. This is chart precedence, not a data merge; no chart position or guide is assigned.</p>}
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
    'non-finite-x': 'non-finite estimate omitted',
  }
  const counts = new Map<string, number>()
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts.entries()].map(([reason, count]) => `${count} ${labels[reason] ?? reason}`).join('; ')
}
