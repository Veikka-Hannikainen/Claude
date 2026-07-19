import type { Feature, FeatureCollection } from 'geojson'
import type { DepthContours, FairwayAreas, FairwayLines, SafetyDevices } from '../types'

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
async function discoverCollections(): Promise<{
  lines?: string
  areas?: string
  safety?: string
  depths?: string
}> {
  const json = await fetchJson(`${BASE}/collections?f=json`)
  const collections: OgcCollection[] = json.collections ?? []
  const find = (patterns: RegExp[]) =>
    collections.find((c) => patterns.some((p) => p.test(c.id) || (c.title ? p.test(c.title) : false)))?.id
  return {
    lines: find([/vaylat_uusi$/i, /^vaylat$/i, /vaylat/i]),
    areas: find([/vaylaalueet_uusi$/i, /vaylaalueet/i]),
    safety: find([/turvalaitteet_uusi$/i, /turvalait/i]),
    depths: find([/syvyyskayra/i, /syvyys/i]),
  }
}

async function fetchAllItems(collectionId: string, maxPages = MAX_PAGES): Promise<Feature[]> {
  const features: Feature[] = []
  let url = `${BASE}/collections/${encodeURIComponent(collectionId)}/items?f=json&bbox=${BBOX}&limit=${PAGE_LIMIT}`
  for (let page = 0; page < maxPages && url; page++) {
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
  safety: SafetyDevices
  depths: DepthContours
}

/** Karsi turvalaite/syvyys-featuret piirtoon riittävään muotoon */
function slimGeneric(f: Feature): Feature {
  const p = (f.properties ?? {}) as Record<string, unknown>
  return {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      // Syvyyskäyrän syvyys ja turvalaitteen tyyppi eri nimeämisillä
      syvyys: p.syvyys ?? p.depth ?? p.arvo ?? null,
      tyyppi: p.turvalaitetyyppi ?? p.tyyppi ?? p.navl_tyyp ?? p.ty_jnr ?? null,
    },
  }
}

export async function downloadFairways(onProgress?: (msg: string) => void): Promise<Fairways> {
  onProgress?.('Haetaan väyläkokoelmia (Väylävirasto)…')
  const ids = await discoverCollections()
  if (!ids.lines && !ids.areas) throw new Error('Väyläkokoelmia ei löytynyt rajapinnasta')

  onProgress?.('Ladataan väyliä, turvalaitteita ja syvyyksiä…')
  const empty: Feature[] = []
  const [lineFeats, areaFeats, safetyFeats, depthFeats] = await Promise.all([
    ids.lines ? fetchAllItems(ids.lines) : Promise.resolve(empty),
    ids.areas ? fetchAllItems(ids.areas) : Promise.resolve(empty),
    ids.safety ? fetchAllItems(ids.safety).catch(() => empty) : Promise.resolve(empty),
    // Syvyyskäyriä voi olla paljon — rajataan sivumäärä
    ids.depths ? fetchAllItems(ids.depths, 15).catch(() => empty) : Promise.resolve(empty),
  ])
  const isLine = (f: Feature) =>
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  const isArea = (f: Feature) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  const isPoint = (f: Feature) => f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint'
  return {
    lines: {
      type: 'FeatureCollection',
      features: lineFeats.filter(isLine).map(slimProps),
    } as FairwayLines,
    areas: {
      type: 'FeatureCollection',
      features: areaFeats.filter(isArea).map(slimProps),
    } as FairwayAreas,
    safety: {
      type: 'FeatureCollection',
      features: safetyFeats.filter(isPoint).map(slimGeneric),
    } as SafetyDevices,
    depths: {
      type: 'FeatureCollection',
      features: depthFeats.filter(isLine).map(slimGeneric),
    } as DepthContours,
  }
}
