import bboxClip from '@turf/bbox-clip'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import destination from '@turf/destination'
import distance from '@turf/distance'
import lineIntersect from '@turf/line-intersect'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import polygonToLine from '@turf/polygon-to-line'
import bearing from '@turf/bearing'
import { point, lineString, featureCollection } from '@turf/helpers'
import { flattenEach } from '@turf/meta'
import type { BBox, Feature, LineString, MultiLineString, Position } from 'geojson'
import { BEARING_COUNT, BEARING_STEP, FETCH_CAP_KM, type WaterPolygon } from '../types'

/** Klippauslaatikon puolikoko km — oltava > FETCH_CAP_KM, jotta laatikon
 *  keinotekoiset reunat eivät koskaan lyhennä sädettä. */
const CLIP_HALF_KM = FETCH_CAP_KM + 1

export interface FetchRaysResult {
  fetchKm: number[]
  snapped?: { lat: number; lon: number }
}

function boundaryLines(water: WaterPolygon): Feature<LineString>[] {
  const out: Feature<LineString>[] = []
  const lines = polygonToLine(water)
  const collect = (f: Feature<LineString | MultiLineString>) => {
    flattenEach(f, (line) => out.push(line as Feature<LineString>))
  }
  if (lines.type === 'FeatureCollection') lines.features.forEach(collect)
  else collect(lines)
  return out
}

/** Klippaa vesipolygoni spotin ympäriltä ja palauta rantaviivat + klipattu polygoni */
export function clipAroundPoint(water: WaterPolygon, lon: number, lat: number) {
  const p = point([lon, lat])
  const west = destination(p, CLIP_HALF_KM, -90).geometry.coordinates[0]
  const east = destination(p, CLIP_HALF_KM, 90).geometry.coordinates[0]
  const south = destination(p, CLIP_HALF_KM, 180).geometry.coordinates[1]
  const north = destination(p, CLIP_HALF_KM, 0).geometry.coordinates[1]
  const bbox: BBox = [west, south, east, north]
  const clipped = bboxClip(water, bbox) as WaterPolygon
  return { clipped, lines: boundaryLines(clipped) }
}

/** Siirrä rannalle digitoitu piste lähimpään kohtaan vedessä */
export function snapToWater(
  water: WaterPolygon,
  lines: Feature<LineString>[],
  lon: number,
  lat: number,
): Position | null {
  const p = point([lon, lat])
  if (booleanPointInPolygon(p, water)) return [lon, lat]
  let best: { pos: Position; d: number } | null = null
  for (const line of lines) {
    const near = nearestPointOnLine(line, p, { units: 'kilometers' })
    const d = near.properties.dist ?? Infinity
    if (!best || d < best.d) best = { pos: near.geometry.coordinates, d }
  }
  if (!best) return null
  // Työnnä rantapistettä hieman kumpaankin suuntaan ja valitse vedessä oleva
  const dir = bearing(p, point(best.pos))
  for (const nudgeKm of [0.015, 0.04, 0.1]) {
    for (const b of [dir, dir + 180]) {
      const cand = destination(point(best.pos), nudgeKm, b).geometry.coordinates
      if (booleanPointInPolygon(point(cand), water)) return cand
    }
  }
  return null
}

/**
 * Avoin vesimatka (fetch) 24 suuntimaan spotista: säde katkaistaan
 * ensimmäiseen rantaviivaosumaan, muuten FETCH_CAP_KM.
 */
export function computeFetchRays(water: WaterPolygon, lon: number, lat: number): FetchRaysResult {
  const { clipped, lines } = clipAroundPoint(water, lon, lat)
  const start = snapToWater(clipped, lines, lon, lat)
  if (!start) {
    // Piste kaukana vedestä — ei laskettavaa
    return { fetchKm: new Array(BEARING_COUNT).fill(0) }
  }
  const origin = point(start)
  const boundary = featureCollection(lines)
  const fetchKm: number[] = []
  for (let i = 0; i < BEARING_COUNT; i++) {
    const b = i * BEARING_STEP
    const tip = destination(origin, FETCH_CAP_KM, b)
    const ray = lineString([origin.geometry.coordinates, tip.geometry.coordinates])
    let min = FETCH_CAP_KM
    for (const hit of lineIntersect(ray, boundary).features) {
      const d = distance(origin, hit, { units: 'kilometers' })
      if (d < min) min = d
    }
    fetchKm.push(Math.round(min * 100) / 100)
  }
  const snappedChanged = start[0] !== lon || start[1] !== lat
  return {
    fetchKm,
    snapped: snappedChanged ? { lon: start[0], lat: start[1] } : undefined,
  }
}
