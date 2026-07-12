import { describe, expect, it } from 'vitest'
import { relationToMultiPolygon } from '../../src/lib/geo/osmRings'

const pt = (lon: number, lat: number) => ({ lon, lat })

describe('relationToMultiPolygon', () => {
  it('stitches split outer ways (with reversed segments) and assigns inner rings as holes', () => {
    const members = [
      // Ulkoreuna kahtena pätkänä, jälkimmäinen väärinpäin
      { type: 'way', role: 'outer', geometry: [pt(0, 0), pt(4, 0), pt(4, 4)] },
      { type: 'way', role: 'outer', geometry: [pt(0, 0), pt(0, 4), pt(4, 4)] },
      // Saari sisällä
      {
        type: 'way',
        role: 'inner',
        geometry: [pt(1, 1), pt(2, 1), pt(2, 2), pt(1, 2), pt(1, 1)],
      },
      // Toinen relaation ulkopuolinen saari — ei osu mihinkään outeriin, hylätään
      {
        type: 'way',
        role: 'inner',
        geometry: [pt(10, 10), pt(11, 10), pt(11, 11), pt(10, 10)],
      },
    ]
    const mp = relationToMultiPolygon(members)
    expect(mp.geometry.type).toBe('MultiPolygon')
    expect(mp.geometry.coordinates).toHaveLength(1)
    const [rings] = mp.geometry.coordinates
    expect(rings).toHaveLength(2) // ulkoreuna + yksi reikä
    // Ulkorengas suljettu
    const outer = rings[0]
    expect(outer[0]).toEqual(outer[outer.length - 1])
  })

  it('returns empty MultiPolygon for garbage input', () => {
    const mp = relationToMultiPolygon([{ type: 'way', role: 'outer', geometry: [pt(0, 0), pt(1, 1)] }])
    expect(mp.geometry.coordinates).toHaveLength(0)
  })
})
