import distance from '@turf/distance'
import { point } from '@turf/helpers'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Säde jolta rakennuksia etsitään — pihapiiri/mökkiranta-indikaattori */
export const BUILDING_RADIUS_M = 300

export interface BuildingCheck {
  /** Etäisyys lähimpään rakennukseen metreinä; null = ei rakennuksia säteellä */
  distM: number | null
  radiusM: number
  checkedAt: number
}

interface OverpassElement {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

/**
 * Tarkista OpenStreetMapista, onko pisteen lähellä rakennuksia (mökki, sauna,
 * talo…). Rakennus rannassa tarkoittaa yleensä yksityisrantaa, jonka
 * pihapiiriin ei jokamiehenoikeudella saa rantautua.
 */
export async function checkBuildings(lat: number, lon: number): Promise<BuildingCheck> {
  const query = `[out:json][timeout:25];
nwr["building"](around:${BUILDING_RADIUS_M},${lat.toFixed(6)},${lon.toFixed(6)});
out center 40;`
  let lastError: unknown
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }) })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = await res.json()
      const origin = point([lon, lat])
      let min: number | null = null
      for (const el of (json.elements ?? []) as OverpassElement[]) {
        const elLat = el.lat ?? el.center?.lat
        const elLon = el.lon ?? el.center?.lon
        if (elLat == null || elLon == null) continue
        const d = distance(origin, point([elLon, elLat]), { units: 'meters' })
        if (min === null || d < min) min = d
      }
      return { distM: min === null ? null : Math.round(min), radiusM: BUILDING_RADIUS_M, checkedAt: Date.now() }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Rakennustarkistus epäonnistui')
}
