import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from 'geojson'

/** Paikan palvelut ja ominaisuudet */
export type FeatureTag =
  | 'sauna'
  | 'laituri'
  | 'ankkurointi'
  | 'ravintola'
  | 'nuotiopaikka'
  | 'wc'
  | 'uimaranta'
  | 'telttailu'
  | 'polku'

export const FEATURE_TAGS: FeatureTag[] = [
  'sauna',
  'laituri',
  'ankkurointi',
  'ravintola',
  'nuotiopaikka',
  'wc',
  'uimaranta',
  'telttailu',
  'polku',
]

export interface Spot {
  id: string
  name: string
  lat: number
  lon: number
  isIsland: boolean
  notes?: string
  /** Tuloväylä, matalikot, varoitukset */
  approach?: string
  features?: FeatureTag[]
  sourceLinks?: string[]
  photoLinks?: string[]
  /** Kuratoitu aloituslistan paikka (ei muokattavissa) */
  seed?: boolean
  /** Virallinen/huollettu kohde (vierassatama, PVY, kansallispuisto) — vihreä merkki */
  official?: boolean
  /** Koordinaatti karkea — tarkenna satelliittikuvasta raahaamalla */
  coordsApproximate?: boolean
  /** OSM-paikannimi, jolla likimääräinen sijainti tarkennetaan automaattisesti */
  osmName?: string
}

/** 24 suuntimaa 15° välein, indeksi 0 = pohjoinen */
export const BEARING_COUNT = 24
export const BEARING_STEP = 360 / BEARING_COUNT
/** Avoimen vesimatkan katto (km) — tätä pidempää fetchiä ei eroteta */
export const FETCH_CAP_KM = 20
/** Väylän läheisyysvaroituksen raja metreinä */
export const FAIRWAY_WARN_M = 500

export interface SpotComputed {
  fetchKm: number[]
  fairwayDistM: number | null
  nearFairway: boolean | null
  /** Piste on kaukana Päijänteen rantaviivasta (esim. toinen vesistö) — analyysi ei päde */
  farFromWater?: boolean
  /** Oliko väyläaineisto käytössä — jos ei, lasketaan uudelleen kun se saapuu */
  withFairways?: boolean
  /** Laskennassa käytetty vesipiste (snapattu jos spotti oli rannalla) */
  snapped?: { lat: number; lon: number }
  computedAt: number
}

export interface Waypoint {
  lat: number
  lon: number
}

export interface Route {
  id: string
  name: string
  waypoints: Waypoint[]
}

export type BasemapId = 'kartta' | 'osm' | 'mml' | 'esri'

export interface Settings {
  cruiseKn: number
  fuelLph: number
  fuelPriceEur: number
  mmlApiKey: string
  basemap: BasemapId
  showWaterOutline: boolean
  /** Näytä "Väylä lähellä" -varoitus (< 500 m) — oletuksena pois */
  warnNearFairway?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  cruiseKn: 20,
  fuelLph: 22,
  fuelPriceEur: 2.2,
  mmlApiKey: '',
  basemap: 'kartta',
  showWaterOutline: false,
  warnNearFairway: false,
}

export type ShelterClass = 'suojassa' | 'kohtalainen' | 'altis'

export interface HourlyWind {
  time: string
  speedMs: number
  gustMs: number
  directionDeg: number
}

export interface WindForecast {
  fetchedAt: number
  lat: number
  lon: number
  hours: HourlyWind[]
}

export type WaterPolygon = Feature<Polygon | MultiPolygon>
export type FairwayLines = FeatureCollection<LineString>
export type FairwayAreas = FeatureCollection<Polygon | MultiPolygon>
/** Turvalaitteet (poijut, viitat, merkit) pisteinä */
export type SafetyDevices = FeatureCollection
/** Syvyyskäyrät viivoina */
export type DepthContours = FeatureCollection

export type DatasetState =
  | { status: 'missing' }
  | { status: 'downloading'; progress?: string }
  | { status: 'ready'; updatedAt: number; sizeBytes?: number }
  | { status: 'error'; message: string }
