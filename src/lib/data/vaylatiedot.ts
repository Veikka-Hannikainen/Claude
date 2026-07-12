import type { Feature, FeatureCollection } from 'geojson'
import type { FairwayAreas, FairwayLines } from '../types'

const BASE = 'https://avoinapi.vaylapilvi.fi/vaylatiedot/ogc/features/v1'
/** Päijänteen bbox (länsi, etelä, itä, pohjoinen) — Asikkalasta Jyväskylään */
const BBOX = '24.9,61.0,26.4,62.35'
const PAGE_LIMIT = 2000
const MAX_PAGES = 30

interface OgcCollection {
  id: string
  title?: string
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } })
  if (!res.ok) throw new Error(`Väyläaineisto: HTTP ${res.status}`)
  return res.json()
}

/** Etsi kokoelmatunnisteet nimipäätteillä — API:n tarkka nimeäminen voi elää */
async function discoverCollections(): Promise<{ lines?: string; areas?: string }> {
  const json = await fetchJson(`${BASE}/collections?f=json`)
  const collections: OgcCollection[] = json.collections ?? []
  const find = (patterns: RegExp[]) =>
    collections.find((c) => patterns.some((p) => p.test(c.id) || (c.title ? p.test(c.title) : false)))?.id
  return {
    lines: find([/vaylat_uusi$/i, /^vaylat$/i, /vaylat/i]),
    areas: find([/vaylaalueet_uusi$/i, /vaylaalueet/i]),
  }
}

async function fetchAllItems(collectionId: string): Promise<Feature[]> {
  const features: Feature[] = []
  let url = `${BASE}/collections/${encodeURIComponent(collectionId)}/items?f=json&bbox=${BBOX}&limit=${PAGE_LIMIT}`
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const json: FeatureCollection & { links?: { rel: string; href: string }[] } = await fetchJson(url)
    features.push(...(json.features ?? []))
    url = json.links?.find((l) => l.rel === 'next')?.href ?? ''
  }
  return features
}

/** Karsi ominaisuudet — kartalla tarvitaan vain nimi ja väyläluokka */
function slimProps(f: Feature): Feature {
  const p = (f.properties ?? {}) as Record<string, unknown>
  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      nimi: p.nimifi ?? p.nimi ?? p.vay_nimisu ?? null,
      luokka: p.vaylalaji ?? p.vayla_lk ?? null,
    },
  }
}

export interface Fairways {
  lines: FairwayLines
  areas: FairwayAreas
}

export async function downloadFairways(onProgress?: (msg: string) => void): Promise<Fairways> {
  onProgress?.('Haetaan väyläkokoelmia (Väylävirasto)…')
  const ids = await discoverCollections()
  if (!ids.lines && !ids.areas) throw new Error('Väyläkokoelmia ei löytynyt rajapinnasta')

  onProgress?.('Ladataan väyliä…')
  const [lineFeats, areaFeats] = await Promise.all([
    ids.lines ? fetchAllItems(ids.lines) : Promise.resolve([]),
    ids.areas ? fetchAllItems(ids.areas) : Promise.resolve([]),
  ])
  const isLine = (f: Feature) =>
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  const isArea = (f: Feature) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  return {
    lines: {
      type: 'FeatureCollection',
      features: lineFeats.filter(isLine).map(slimProps),
    } as FairwayLines,
    areas: {
      type: 'FeatureCollection',
      features: areaFeats.filter(isArea).map(slimProps),
    } as FairwayAreas,
  }
}
