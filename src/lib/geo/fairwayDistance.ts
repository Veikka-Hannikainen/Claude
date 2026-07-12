import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointToLineDistance from '@turf/point-to-line-distance'
import { point } from '@turf/helpers'
import { flattenEach } from '@turf/meta'
import type { Feature, LineString } from 'geojson'
import { FAIRWAY_WARN_M, type FairwayAreas, type FairwayLines } from '../types'

export interface FairwayResult {
  distM: number
  nearFairway: boolean
}

/** Etäisyys lähimpään väylään; 0 jos piste on väyläalueen sisällä */
export function fairwayDistance(
  lines: FairwayLines | null,
  areas: FairwayAreas | null,
  lon: number,
  lat: number,
): FairwayResult | null {
  if (!lines && !areas) return null
  const p = point([lon, lat])

  if (areas) {
    for (const f of areas.features) {
      if (booleanPointInPolygon(p, f)) return { distM: 0, nearFairway: true }
    }
  }

  let min = Infinity
  if (lines) {
    for (const f of lines.features) {
      flattenEach(f, (line) => {
        const d = pointToLineDistance(p, line as Feature<LineString>, { units: 'meters' })
        if (d < min) min = d
      })
    }
  }
  if (!isFinite(min)) return null
  return { distM: Math.round(min), nearFairway: min < FAIRWAY_WARN_M }
}
