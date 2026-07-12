import { describe, expect, it } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import { computeFetchRays } from '../../src/lib/geo/fetchRays'
import { BEARING_COUNT, FETCH_CAP_KM } from '../../src/lib/types'

/** Synteettinen neliöjärvi ~55 km × 55 km, keskellä pieni neliösaari */
const LAKE_HALF_DEG = 0.25 // ~28 km pohjois-etelä
const CX = 25.5
const CY = 61.5
// Saari 2 km pohjoiseen keskipisteestä, ~1 km × 1 km
const ISLAND_CY = CY + 0.018
const ISLAND_HALF = 0.0045

const lake: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [CX - LAKE_HALF_DEG * 2, CY - LAKE_HALF_DEG],
        [CX + LAKE_HALF_DEG * 2, CY - LAKE_HALF_DEG],
        [CX + LAKE_HALF_DEG * 2, CY + LAKE_HALF_DEG],
        [CX - LAKE_HALF_DEG * 2, CY + LAKE_HALF_DEG],
        [CX - LAKE_HALF_DEG * 2, CY - LAKE_HALF_DEG],
      ],
      [
        [CX - ISLAND_HALF, ISLAND_CY - ISLAND_HALF],
        [CX - ISLAND_HALF, ISLAND_CY + ISLAND_HALF],
        [CX + ISLAND_HALF, ISLAND_CY + ISLAND_HALF],
        [CX + ISLAND_HALF, ISLAND_CY - ISLAND_HALF],
        [CX - ISLAND_HALF, ISLAND_CY - ISLAND_HALF],
      ],
    ],
  },
}

describe('computeFetchRays', () => {
  it('ray toward the island stops at its shore, open ray reaches the cap', () => {
    const { fetchKm } = computeFetchRays(lake, CX, CY)
    expect(fetchKm).toHaveLength(BEARING_COUNT)
    // Pohjoiseen (indeksi 0): saari ~1,5 km päässä (2 km keskipisteeseen − 0,5 km puolikas)
    expect(fetchKm[0]).toBeGreaterThan(1)
    expect(fetchKm[0]).toBeLessThan(2)
    // Itään (indeksi 6): järven reuna ~26 km → katto 20 km
    expect(fetchKm[6]).toBe(FETCH_CAP_KM)
    // Etelään (indeksi 12): rantaan ~28 km → katto
    expect(fetchKm[12]).toBe(FETCH_CAP_KM)
  })

  it('snaps a point on land to water and still computes', () => {
    // Piste saaren keskellä (maalla)
    const { fetchKm, snapped } = computeFetchRays(lake, CX, ISLAND_CY)
    expect(snapped).toBeDefined()
    expect(Math.max(...fetchKm)).toBeGreaterThan(0)
  })

  it('east shore of the island is sheltered from the west', () => {
    // Piste heti saaren itäpuolella
    const { fetchKm } = computeFetchRays(lake, CX + ISLAND_HALF + 0.002, ISLAND_CY)
    const westIdx = 18 // 270°
    // Länteen näkyy saaren ranta ~100-200 m päässä
    expect(fetchKm[westIdx]).toBeLessThan(0.5)
    // Itään avointa vettä kattoon asti
    expect(fetchKm[6]).toBe(FETCH_CAP_KM)
  })
})
