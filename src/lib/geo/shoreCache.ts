import type { FeatureCollection, LineString } from 'geojson'
import { buildShoreIndex } from './landCrossing'
import type { WaterPolygon } from '../types'

let cachedWater: WaterPolygon | null = null
let cachedIndex: FeatureCollection<LineString> | null = null

/** Rantaviivaindeksi rakennetaan vain kerran per vesipolygoni (kallis operaatio) */
export function getShoreIndex(water: WaterPolygon): FeatureCollection<LineString> {
  if (water !== cachedWater || !cachedIndex) {
    cachedWater = water
    cachedIndex = buildShoreIndex(water)
  }
  return cachedIndex
}
