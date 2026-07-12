import { describe, expect, it } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import { buildShoreIndex, checkLegs } from '../../src/lib/geo/landCrossing'

/** Järvi jossa saari keskellä */
const lake: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [25.0, 61.0],
        [26.0, 61.0],
        [26.0, 62.0],
        [25.0, 62.0],
        [25.0, 61.0],
      ],
      [
        [25.4, 61.4],
        [25.4, 61.6],
        [25.6, 61.6],
        [25.6, 61.4],
        [25.4, 61.4],
      ],
    ],
  },
}

describe('checkLegs', () => {
  const shore = buildShoreIndex(lake)

  it('flags a leg straight across the island', () => {
    const checks = checkLegs(lake, shore, [
      { lat: 61.5, lon: 25.2 },
      { lat: 61.5, lon: 25.8 },
    ])
    expect(checks).toHaveLength(1)
    expect(checks[0].crossesLand).toBe(true)
  })

  it('passes a leg through open water around the island', () => {
    const checks = checkLegs(lake, shore, [
      { lat: 61.5, lon: 25.2 },
      { lat: 61.8, lon: 25.5 },
      { lat: 61.5, lon: 25.8 },
    ])
    expect(checks.every((c) => !c.crossesLand)).toBe(true)
  })

  it('flags a waypoint on land (inside the island)', () => {
    const checks = checkLegs(lake, shore, [
      { lat: 61.5, lon: 25.2 },
      { lat: 61.5, lon: 25.5 },
    ])
    expect(checks[0].crossesLand).toBe(true)
  })
})
