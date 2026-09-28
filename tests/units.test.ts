import { describe, expect, it } from 'vitest'
import { durationToSeconds } from '../src/lib/units'

describe('reported duration unit conversion', () => {
  it('converts supported original units to seconds without rounding', () => {
    expect(durationToSeconds(1.234, 'minutes')).toBe(74.03999999999999)
    expect(durationToSeconds(125, 'milliseconds')).toBe(0.125)
    expect(durationToSeconds(0, 'seconds')).toBe(0)
  })

  it('rejects negative, non-finite, and unknown-unit values', () => {
    expect(() => durationToSeconds(-1, 'seconds')).toThrow('non-negative')
    expect(() => durationToSeconds(Number.NaN, 'seconds')).toThrow('finite')
    expect(() => durationToSeconds(3, 'fortnights' as never)).toThrow()
  })
})
