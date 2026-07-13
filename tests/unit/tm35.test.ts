import { describe, expect, it } from 'vitest'
import { karttapaikkaUrl, toTm35fin } from '../../src/lib/geo/tm35'

describe('toTm35fin', () => {
  it('central meridian (27°E) maps to false easting 500000', () => {
    const { e } = toTm35fin(61.5, 27.0)
    expect(e).toBeCloseTo(500000, -1)
  })
  it('northing grows with latitude and is in Finland range', () => {
    const a = toTm35fin(61.0, 25.5)
    const b = toTm35fin(62.0, 25.5)
    expect(b.n).toBeGreaterThan(a.n)
    expect(a.n).toBeGreaterThan(6_700_000)
    expect(b.n).toBeLessThan(6_950_000)
    // 1° leveysastetta ≈ 111 km
    expect(b.n - a.n).toBeGreaterThan(110_000)
    expect(b.n - a.n).toBeLessThan(113_000)
  })
  it('west of central meridian → easting < 500000', () => {
    expect(toTm35fin(61.5, 25.5).e).toBeLessThan(500000)
  })
  it('karttapaikkaUrl embeds coordinates', () => {
    const url = karttapaikkaUrl(61.5, 25.5)
    expect(url).toContain('karttapaikka')
    expect(url).toMatch(/n=\d{7}/)
    expect(url).toMatch(/e=\d{6}/)
  })
})
