import { describe, expect, it } from 'vitest'
import {
  classifyDays,
  classifyHour,
  effectiveFetchKm,
  waveHeightM,
} from '../../src/lib/shelter/classify'
import { BEARING_COUNT } from '../../src/lib/types'

const uniformFetch = (km: number) => new Array(BEARING_COUNT).fill(km)

describe('waveHeightM (SMB-ankkuriarvot)', () => {
  it('10 m/s × 10 km ≈ 0.51 m', () => {
    expect(waveHeightM(10, 10_000)).toBeCloseTo(0.51, 1)
  })
  it('8 m/s × 2 km ≈ 0.18 m', () => {
    expect(waveHeightM(8, 2_000)).toBeCloseTo(0.18, 1)
  })
})

describe('classifyHour', () => {
  it('8 m/s over 8 km fetch → altis', () => {
    const h = classifyHour(
      { time: '2026-07-12T12:00', speedMs: 8, gustMs: 8, directionDeg: 270 },
      uniformFetch(8),
    )
    expect(h.klass).toBe('altis')
  })
  it('8 m/s over 0.3 km fetch → suojassa', () => {
    const h = classifyHour(
      { time: '2026-07-12T12:00', speedMs: 8, gustMs: 8, directionDeg: 270 },
      uniformFetch(0.3),
    )
    expect(h.klass).toBe('suojassa')
  })
  it('gusts dominate when much stronger than mean wind', () => {
    const calm = classifyHour(
      { time: '2026-07-12T12:00', speedMs: 4, gustMs: 4, directionDeg: 0 },
      uniformFetch(8),
    )
    const gusty = classifyHour(
      { time: '2026-07-12T12:00', speedMs: 4, gustMs: 14, directionDeg: 0 },
      uniformFetch(8),
    )
    expect(gusty.hs).toBeGreaterThan(calm.hs)
  })
})

describe('effectiveFetchKm', () => {
  it('uses the worst of the three sectors around the wind direction', () => {
    const fetchKm = uniformFetch(0.2)
    fetchKm[1] = 12 // 15°
    // Tuuli suunnasta 0° — viereinen 15°-sektori on avoin
    expect(effectiveFetchKm(fetchKm, 0)).toBe(12)
    // Tuuli suunnasta 90° — avoin sektori ei enää osu ikkunaan
    expect(effectiveFetchKm(fetchKm, 90)).toBe(0.2)
  })
  it('wraps around north', () => {
    const fetchKm = uniformFetch(0.2)
    fetchKm[23] = 9 // 345°
    expect(effectiveFetchKm(fetchKm, 0)).toBe(9)
  })
})

describe('classifyDays', () => {
  it('groups hours by day and takes the worst daytime hour', () => {
    const hours = [
      { time: '2026-07-12T03:00', speedMs: 15, gustMs: 20, directionDeg: 270 }, // yötunti — ei saa määrätä
      { time: '2026-07-12T10:00', speedMs: 2, gustMs: 3, directionDeg: 270 },
      { time: '2026-07-12T15:00', speedMs: 9, gustMs: 12, directionDeg: 270 },
      { time: '2026-07-13T12:00', speedMs: 1, gustMs: 2, directionDeg: 90 },
    ]
    const days = classifyDays(hours, uniformFetch(10))
    expect(days).toHaveLength(2)
    expect(days[0].date).toBe('2026-07-12')
    expect(days[0].worst).toBe('altis') // 9 m/s / 10 km — ei yön 15 m/s
    expect(days[0].worstHs).toBeCloseTo(waveHeightM(0.75 * 12, 10_000), 5)
    expect(days[1].worst).toBe('suojassa')
  })
})
