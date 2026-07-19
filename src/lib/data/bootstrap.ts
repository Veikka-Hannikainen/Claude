import { dataDb } from './db'
import { downloadPaijanneWater } from './overpass'
import { downloadFairways } from './vaylatiedot'
import type {
  DatasetState,
  DepthContours,
  FairwayAreas,
  FairwayLines,
  SafetyDevices,
  WaterPolygon,
} from '../types'

export interface LoadedData {
  waterCompute: WaterPolygon | null
  waterRender: WaterPolygon | null
  fairwayLines: FairwayLines | null
  fairwayAreas: FairwayAreas | null
  safetyDevices: SafetyDevices | null
  depthContours: DepthContours | null
}

/** Lue aineistot IndexedDB:stä (ladattu aiemmin tässä selaimessa) */
export async function loadFromDb(): Promise<LoadedData> {
  const [waterCompute, waterRender, fairwayLines, fairwayAreas, safetyDevices, depthContours] =
    await Promise.all([
      dataDb.getWaterCompute(),
      dataDb.getWaterRender(),
      dataDb.getFairwayLines(),
      dataDb.getFairwayAreas(),
      dataDb.getSafetyDevices(),
      dataDb.getDepthContours(),
    ])
  return {
    waterCompute: waterCompute ?? null,
    waterRender: waterRender ?? null,
    fairwayLines: fairwayLines ?? null,
    fairwayAreas: fairwayAreas ?? null,
    safetyDevices: safetyDevices ?? null,
    depthContours: depthContours ?? null,
  }
}

export interface BootstrapCallbacks {
  onWaterState: (s: DatasetState) => void
  onFairwayState: (s: DatasetState) => void
  onData: (data: Partial<LoadedData>) => void
}

/** Repoon esiladatut aineistot (scripts/fetch-data.mjs) — käytetään jos löytyvät */
async function tryStatic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function staticWater(): Promise<{ compute: WaterPolygon; render: WaterPolygon } | null> {
  const compute = await tryStatic<WaterPolygon>('data/paijanne-water.geojson')
  if (!compute) return null
  const render = (await tryStatic<WaterPolygon>('data/paijanne-water-render.geojson')) ?? compute
  return { compute, render }
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as SafetyDevices

async function staticFairways(): Promise<{
  lines: FairwayLines
  areas: FairwayAreas
  safety: SafetyDevices
  depths: DepthContours
} | null> {
  const lines = await tryStatic<FairwayLines>('data/fairway-lines.geojson')
  if (!lines) return null
  const areas =
    (await tryStatic<FairwayAreas>('data/fairway-areas.geojson')) ?? (EMPTY_FC as FairwayAreas)
  const safety = (await tryStatic<SafetyDevices>('data/safety-devices.geojson')) ?? EMPTY_FC
  const depths = (await tryStatic<DepthContours>('data/depth-contours.geojson')) ?? EMPTY_FC
  return { lines, areas, safety, depths }
}

/** Lataa puuttuvat aineistot (esiladattu tiedosto tai verkko) ja tallenna selaimeen */
export async function downloadMissing(current: LoadedData, cb: BootstrapCallbacks): Promise<void> {
  const jobs: Promise<void>[] = []

  if (!current.waterCompute || !current.waterRender) {
    cb.onWaterState({ status: 'downloading' })
    jobs.push(
      staticWater()
        .then(
          (found) =>
            found ??
            downloadPaijanneWater((msg) => cb.onWaterState({ status: 'downloading', progress: msg })),
        )
        .then(async ({ compute, render }) => {
          await dataDb.setWater(compute, render)
          await dataDb.setMeta({ waterUpdatedAt: Date.now() })
          cb.onData({ waterCompute: compute, waterRender: render })
          cb.onWaterState({ status: 'ready', updatedAt: Date.now() })
        })
        .catch((err) => {
          cb.onWaterState({ status: 'error', message: err?.message ?? 'Lataus epäonnistui' })
        }),
    )
  } else {
    cb.onWaterState({ status: 'ready', updatedAt: 0 })
  }

  // safetyDevices puuttuu myös vanhoilta asennuksilta → haetaan paketti uudelleen
  if (!current.fairwayLines || !current.safetyDevices) {
    cb.onFairwayState({ status: 'downloading' })
    jobs.push(
      staticFairways()
        .then(
          (found) =>
            found ??
            downloadFairways((msg) => cb.onFairwayState({ status: 'downloading', progress: msg })),
        )
        .then(async ({ lines, areas, safety, depths }) => {
          await dataDb.setFairways(lines, areas, safety, depths)
          await dataDb.setMeta({ fairwaysUpdatedAt: Date.now() })
          cb.onData({
            fairwayLines: lines,
            fairwayAreas: areas,
            safetyDevices: safety,
            depthContours: depths,
          })
          cb.onFairwayState({ status: 'ready', updatedAt: Date.now() })
        })
        .catch((err) => {
          cb.onFairwayState({ status: 'error', message: err?.message ?? 'Lataus epäonnistui' })
        }),
    )
  } else {
    cb.onFairwayState({ status: 'ready', updatedAt: 0 })
  }

  await Promise.all(jobs)
}

/** Käyttäjän oma GeoJSON-tuonti varapolkuna, jos rajapinnat eivät aukea */
export async function importWaterGeojson(file: File): Promise<{ compute: WaterPolygon; render: WaterPolygon }> {
  const json = JSON.parse(await file.text())
  const feature: WaterPolygon =
    json.type === 'FeatureCollection'
      ? json.features.find(
          (f: { geometry?: { type?: string } }) =>
            f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
        )
      : json
  if (!feature?.geometry) throw new Error('Tiedostosta ei löytynyt polygonia')
  await dataDb.setWater(feature, feature)
  await dataDb.setMeta({ waterUpdatedAt: Date.now() })
  return { compute: feature, render: feature }
}
