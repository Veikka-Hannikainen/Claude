import distance from '@turf/distance'
import { point } from '@turf/helpers'
import type { Spot } from '../types'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Kuinka kaukaa likimääräisestä sijainnista nimeä etsitään */
const SEARCH_RADIUS_M = 25000

export interface CoordOverride {
  lat: number
  lon: number
  refinedAt: number
}

interface OverpassNamed {
  tags?: { name?: string }
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

/**
 * Tarkenna likimääräiset seed-sijainnit OSM-paikannimillä: yhdellä
 * Overpass-kyselyllä haetaan kaikki nimet likimääräisten pisteiden läheltä ja
 * valitaan kullekin lähin osuma. Ajetaan selaimessa; epäonnistuminen on ok —
 * paikka jää silloin likimääräiseksi.
 */
export async function refineSeedCoords(
  spots: Pick<Spot, 'id' | 'lat' | 'lon' | 'osmName'>[],
): Promise<Record<string, CoordOverride>> {
  const targets = spots.filter((s) => s.osmName)
  if (targets.length === 0) return {}

  const clauses = targets
    .map(
      (s) =>
        `nwr["name"="${s.osmName!.replace(/"/g, '')}"](around:${SEARCH_RADIUS_M},${s.lat.toFixed(4)},${s.lon.toFixed(4)});`,
    )
    .join('\n')
  const query = `[out:json][timeout:60];\n(\n${clauses}\n);\nout center tags;`

  let elements: OverpassNamed[] | null = null
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }) })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      elements = (await res.json()).elements ?? []
      break
    } catch {
      // kokeile seuraavaa endpointtia
    }
  }
  if (!elements) return {}

  const overrides: Record<string, CoordOverride> = {}
  for (const spot of targets) {
    let best: { lat: number; lon: number; d: number } | null = null
    for (const el of elements) {
      if (el.tags?.name !== spot.osmName) continue
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      if (lat == null || lon == null) continue
      const d = distance(point([spot.lon, spot.lat]), point([lon, lat]), { units: 'meters' })
      if (d <= SEARCH_RADIUS_M && (!best || d < best.d)) best = { lat, lon, d }
    }
    if (best) overrides[spot.id] = { lat: best.lat, lon: best.lon, refinedAt: Date.now() }
  }
  return overrides
}
