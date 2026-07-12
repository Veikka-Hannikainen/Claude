import { describe, expect, it } from 'vitest'
import { formatDuration, routeMetrics } from '../../src/lib/route/metrics'

describe('routeMetrics', () => {
  it('10 nm at 20 kn = 30 min = 11 L at 22 L/h', () => {
    // 10 mpk pohjoiseen: 18,52 km ≈ 0,16665° leveysastetta
    const start = { lat: 61.3, lon: 25.5 }
    const end = { lat: 61.3 + 18.52 / 111.32, lon: 25.5 }
    const m = routeMetrics([start, end], 20, 22, 2.0)
    expect(m.totalNm).toBeCloseTo(10, 1)
    expect(m.hours * 60).toBeCloseTo(30, 0)
    expect(m.fuelL).toBeCloseTo(11, 0)
    expect(m.fuelCostEur).toBeCloseTo(22, 0)
  })
  it('handles empty and single-waypoint routes', () => {
    expect(routeMetrics([], 20, 22, 2).totalKm).toBe(0)
    expect(routeMetrics([{ lat: 61, lon: 25 }], 20, 22, 2).legs).toHaveLength(0)
  })
})

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0.5)).toBe('30 min')
    expect(formatDuration(2.25)).toBe('2 h 15 min')
  })
})
