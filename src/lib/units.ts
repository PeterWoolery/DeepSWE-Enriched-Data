export type DurationUnit = 'seconds' | 'minutes' | 'milliseconds' | 'hours'

const secondsPerUnit: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  milliseconds: 0.001,
  hours: 3600,
}

export function durationToSeconds(value: number, unit: DurationUnit): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Duration must be a finite, non-negative value.')
  const seconds = value * secondsPerUnit[unit]
  if (!Number.isFinite(seconds)) throw new Error('Converted duration is outside the supported numeric range.')
  return seconds
}
