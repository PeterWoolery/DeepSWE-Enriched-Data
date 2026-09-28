import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DatasetSchema } from '../src/lib/schema'
import { displayScoreValue, hasPercentageScoreScale } from '../src/lib/comparison'
import { segmentXY } from '../src/lib/xy'

const dataset = DatasetSchema.parse(JSON.parse(readFileSync(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')))
const rawTableScore = dataset.observations.find((row) => row.id === 'deepseek-v4.1-flash-mini-swe-v1.1')!.result
const explicitPercent = dataset.observations.find((row) => row.id === 'anthropic-claude-opus-5.5-v1.1')!.result

describe('source-unit-aware score display', () => {
  it('shows equal raw values differently when one source does not state a unit', () => {
    expect(rawTableScore.reportedValue).toBe(74.2)
    expect(explicitPercent.reportedValue).toBe(74.2)
    expect(rawTableScore.reportedUnit).toBe('raw table value; unit unspecified')
    expect(explicitPercent.reportedUnit).toBe('%')
    expect(displayScoreValue(rawTableScore)).toBe('74.2')
    expect(displayScoreValue(explicitPercent)).toBe('74.2%')
    expect(hasPercentageScoreScale(rawTableScore)).toBe(false)
    expect(hasPercentageScoreScale(explicitPercent)).toBe(true)
  })

  it('does not place a raw-unit result on the chart percentage axis', () => {
    const toPoint = (id: string, score: typeof rawTableScore) => {
      const percentageScale = hasPercentageScoreScale(score)
      return {
        id,
        x: 1,
        y: percentageScale ? score.value : null,
        yMissingReason: percentageScale ? undefined : 'unknown-score-scale' as const,
        effortOrder: null,
      }
    }
    const plot = segmentXY([toPoint('raw-table', rawTableScore), toPoint('explicit-percent', explicitPercent)])
    expect(plot.points.map((point) => point.id)).toEqual(['explicit-percent'])
    expect(plot.omitted).toEqual([{ id: 'raw-table', reason: 'unknown-score-scale' }])
  })
})
