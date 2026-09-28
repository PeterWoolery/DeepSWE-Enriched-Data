export type AxisScale = 'linear' | 'log'

export interface XYObservation {
  id: string
  x: number | null
  y: number | null
  yMissingReason?: 'missing-score' | 'unknown-score-scale'
  effortOrder: number | null
}

export interface XYPoint extends XYObservation {
  inputIndex: number
}

export interface XYSegments {
  points: XYPoint[]
  connected: XYPoint[][]
  isolated: XYPoint[]
  omitted: { id: string; reason: 'missing-x' | 'missing-score' | 'unknown-score-scale' | 'non-positive-log-x' | 'negative-x' }[]
}

/**
 * Build unsmoothed path segments in reviewed effort order. A missing value
 * breaks the line; it is never removed in a way that bridges its neighbours.
 * The caller supplies source-backed order numbers, never inferred chart order.
 */
export function segmentXY(
  observations: readonly XYObservation[],
  scale: AxisScale = 'linear',
): XYSegments {
  const ordered = observations
    .map((observation, inputIndex) => ({ ...observation, inputIndex }))
    .filter((point) => point.effortOrder !== null)
    .sort((left, right) => left.effortOrder! - right.effortOrder! || left.inputIndex - right.inputIndex)
  const unordered = observations
    .map((observation, inputIndex) => ({ ...observation, inputIndex }))
    .filter((point) => point.effortOrder === null)

  const result: XYSegments = { points: [], connected: [], isolated: [], omitted: [] }
  let run: XYPoint[] = []

  const flush = () => {
    if (run.length > 1) result.connected.push(run)
    else if (run.length === 1) result.isolated.push(run[0]!)
    run = []
  }

  const accept = (point: XYPoint, canConnect: boolean) => {
    if (point.y === null && point.yMissingReason === 'unknown-score-scale') {
      result.omitted.push({ id: point.id, reason: 'unknown-score-scale' })
      flush()
      return
    }
    if (point.x === null) {
      result.omitted.push({ id: point.id, reason: 'missing-x' })
      flush()
      return
    }
    if (point.y === null) {
      result.omitted.push({ id: point.id, reason: point.yMissingReason ?? 'missing-score' })
      flush()
      return
    }
    if (point.x < 0) {
      result.omitted.push({ id: point.id, reason: 'negative-x' })
      flush()
      return
    }
    if (scale === 'log' && point.x === 0) {
      result.omitted.push({ id: point.id, reason: 'non-positive-log-x' })
      flush()
      return
    }
    result.points.push(point)
    if (canConnect) run.push(point)
    else {
      flush()
      result.isolated.push(point)
    }
  }

  for (const point of ordered) accept(point, true)
  flush()
  for (const point of unordered) accept(point, false)
  return result
}
