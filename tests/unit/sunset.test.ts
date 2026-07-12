import { describe, expect, it } from 'vitest'
import { sunsetAzimuthDeg, sunsetOpenness } from '../../src/lib/sun/sunsetOpenness'
import { BEARING_COUNT } from '../../src/lib/types'

describe('sunsetAzimuthDeg', () => {
  it('midsummer sunset on Päijänne is to the northwest', () => {
    const az = sunsetAzimuthDeg(new Date('2026-06-21T12:00:00+03:00'), 61.5, 25.5)
    expect(az).toBeGreaterThan(295)
    expect(az).toBeLessThan(350)
  })
})

describe('sunsetOpenness', () => {
  const closed = new Array(BEARING_COUNT).fill(0.05)

  it('open water toward the sunset azimuth → kyllä', () => {
    const fetchKm = [...closed]
    fetchKm[21] = 3 // 315° = luode
    expect(sunsetOpenness(fetchKm, 315)).toBe('kyllä')
  })
  it('short fetch toward sunset → osittain', () => {
    const fetchKm = [...closed]
    fetchKm[21] = 0.3
    expect(sunsetOpenness(fetchKm, 315)).toBe('osittain')
  })
  it('closed toward sunset but open elsewhere → ei', () => {
    const fetchKm = [...closed]
    fetchKm[6] = 15 // itään avoin ei auta
    expect(sunsetOpenness(fetchKm, 315)).toBe('ei')
  })
})
