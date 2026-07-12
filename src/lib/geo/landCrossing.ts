import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import lineIntersect from '@turf/line-intersect'
import polygonToLine from '@turf/polygon-to-line'
import { point, lineString, featureCollection } from '@turf/helpers'
import { flattenEach } from '@turf/meta'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { Waypoint, WaterPolygon } from '../types'

export interface LegCheck {
  crossesLand: boolean
}

/** Rantaviivat kerran koko järvelle — reittitarkistus käyttää näitä toistuvasti */
export function buildShoreIndex(water: WaterPolygon): FeatureCollection<LineString> {
  const out: Feature<LineString>[] = []
  const lines = polygonToLine(water)
  const push = (f: Feature) => flattenEach(f, (l) => out.push(l as Feature<LineString>))
  if (lines.type === 'FeatureCollection') lines.features.forEach(push)
  else push(lines)
  return featureCollection(out)
}

/**
 * Tarkista reittietapit: etappi "leikkaa maata" jos se risteää rantaviivan
 * kanssa tai jompikumpi päätepiste ei ole vedessä.
 */
export function checkLegs(
  water: WaterPolygon,
  shore: FeatureCollection<LineString>,
  waypoints: Waypoint[],
): LegCheck[] {
  const inWater = waypoints.map((w) => booleanPointInPolygon(point([w.lon, w.lat]), water))
  const checks: LegCheck[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    let crosses = !inWater[i] || !inWater[i + 1]
    if (!crosses) {
      const leg = lineString([
        [a.lon, a.lat],
        [b.lon, b.lat],
      ])
      crosses = lineIntersect(leg, shore).features.length > 0
    }
    checks.push({ crossesLand: crosses })
  }
  return checks
}
