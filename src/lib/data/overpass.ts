import simplify from '@turf/simplify'
import { relationToMultiPolygon, type OsmRelMember } from '../geo/osmRings'
import type { WaterPolygon } from '../types'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Päijänteen bounding box (etelä, länsi, pohjoinen, itä) — Asikkalasta Jyväskylään */
const PAIJANNE_BBOX = '61.0,24.9,62.35,26.4'

const QUERY = `[out:json][timeout:300];
rel["natural"="water"]["name"="Päijänne"](${PAIJANNE_BBOX});
out geom;`

/** Yksinkertaistustoleranssit asteina: ~5 m laskentaan, ~20 m piirtoon */
const TOLERANCE_COMPUTE = 0.00005
const TOLERANCE_RENDER = 0.0002

export interface PaijanneWater {
  compute: WaterPolygon
  render: WaterPolygon
}

export async function downloadPaijanneWater(
  onProgress?: (msg: string) => void,
): Promise<PaijanneWater> {
  let lastError: unknown
  for (const endpoint of ENDPOINTS) {
    try {
      onProgress?.('Ladataan Päijänteen rantaviivaa (OpenStreetMap)…')
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = await res.json()
      const rel = (json.elements as { type: string; members?: OsmRelMember[] }[] | undefined)?.find(
        (e) => e.type === 'relation' && e.members,
      )
      if (!rel?.members) throw new Error('Päijänne-relaatiota ei löytynyt vastauksesta')

      onProgress?.('Kootaan rantaviivaa ja saaria…')
      const full = relationToMultiPolygon(rel.members)
      if (full.geometry.coordinates.length === 0) throw new Error('Rantaviivan kokoaminen epäonnistui')

      onProgress?.('Yksinkertaistetaan geometriaa…')
      const compute = simplify(full, { tolerance: TOLERANCE_COMPUTE, highQuality: false }) as WaterPolygon
      const render = simplify(full, { tolerance: TOLERANCE_RENDER, highQuality: false }) as WaterPolygon
      return { compute, render }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Rantaviivan lataus epäonnistui')
}
