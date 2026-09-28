import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { segmentXY, type XYObservation } from '../src/lib/xy'

const rawFixture = JSON.parse(readFileSync(new URL('./fixtures/connected-xy.json', import.meta.url), 'utf8')) as {
  series: { id: string; effortOrder: number | null; cost: number | null; score: number | null }[]
  withMissingMiddle: { id: string; effortOrder: number | null; cost: number | null; score: number | null }[]
  zeroAndUnordered: { id: string; effortOrder: number | null; cost: number | null; score: number | null }[]
}
const asXY = (observations: typeof rawFixture.series): XYObservation[] => observations.map(({ id, effortOrder, cost, score }) => ({
  id,
  effortOrder,
  x: cost,
  y: score,
}))
const fixture = {
  series: asXY(rawFixture.series),
  withMissingMiddle: asXY(rawFixture.withMissingMiddle),
  zeroAndUnordered: asXY(rawFixture.zeroAndUnordered),
}

describe('numeric connected XY series', () => {
  it('preserves reviewed effort order when both score and X move non-monotonically', () => {
    const result = segmentXY(fixture.series)
    expect(result.connected.map((path) => path.map(({ id, x, y }) => [id, x, y]))).toEqual([[
      ['low', 12, 0.61],
      ['medium', 8, 0.78],
      ['high', 10, 0.73],
    ]])
    expect(result.omitted).toEqual([])
  })

  it('connects numeric cost, output-token, and time coordinates in the same explicit effort order', () => {
    const metrics = [
      { name: 'cost', values: fixture.series.map((row) => row.x) },
      { name: 'output tokens', values: [30000, 42000, 35000] },
      { name: 'time', values: [11, 8, 13] },
    ]
    for (const metric of metrics) {
      const result = segmentXY(fixture.series.map((point, index) => ({ ...point, x: metric.values[index]! })))
      expect(result.connected[0]?.map(({ id }) => id), metric.name).toEqual(['low', 'medium', 'high'])
      expect(result.connected[0]?.map(({ x }) => x), metric.name).toEqual(metric.values)
    }
  })

  it('breaks at a null X instead of connecting across the missing observation', () => {
    const result = segmentXY(fixture.withMissingMiddle)
    expect(result.connected).toEqual([])
    expect(result.isolated.map(({ id }) => id)).toEqual(['low', 'high'])
    expect(result.omitted).toEqual([{ id: 'medium', reason: 'missing-x' }])
  })

  it('keeps zero on linear axes, omits it on log axes, and leaves unordered settings as dots', () => {
    const linear = segmentXY(fixture.zeroAndUnordered)
    expect(linear.connected[0]?.map(({ id }) => id)).toEqual(['zero', 'known-next'])
    expect(linear.isolated.map(({ id }) => id)).toEqual(['adaptive'])
    const log = segmentXY(fixture.zeroAndUnordered, 'log')
    expect(log.connected).toEqual([])
    expect(log.isolated.map(({ id }) => id)).toEqual(['known-next', 'adaptive'])
    expect(log.omitted).toEqual([{ id: 'zero', reason: 'non-positive-log-x' }])
  })
})
