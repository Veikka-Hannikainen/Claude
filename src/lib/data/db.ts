import { get, set, del } from 'idb-keyval'
import type { DepthContours, FairwayAreas, FairwayLines, SafetyDevices, WaterPolygon } from '../types'

/** Isot aineistot IndexedDB:ssä — localStorage ei riitä megatavuille */
const KEYS = {
  waterCompute: 'water-compute-v1',
  waterRender: 'water-render-v1',
  fairwayLines: 'fairway-lines-v1',
  fairwayAreas: 'fairway-areas-v1',
  safetyDevices: 'safety-devices-v1',
  depthContours: 'depth-contours-v1',
  meta: 'datasets-meta-v1',
} as const

export interface DatasetsMeta {
  waterUpdatedAt?: number
  fairwaysUpdatedAt?: number
}

export const dataDb = {
  getWaterCompute: () => get<WaterPolygon>(KEYS.waterCompute),
  getWaterRender: () => get<WaterPolygon>(KEYS.waterRender),
  setWater: async (compute: WaterPolygon, render: WaterPolygon) => {
    await set(KEYS.waterCompute, compute)
    await set(KEYS.waterRender, render)
  },
  getFairwayLines: () => get<FairwayLines>(KEYS.fairwayLines),
  getFairwayAreas: () => get<FairwayAreas>(KEYS.fairwayAreas),
  getSafetyDevices: () => get<SafetyDevices>(KEYS.safetyDevices),
  getDepthContours: () => get<DepthContours>(KEYS.depthContours),
  setFairways: async (
    lines: FairwayLines,
    areas: FairwayAreas,
    safety: SafetyDevices,
    depths: DepthContours,
  ) => {
    await set(KEYS.fairwayLines, lines)
    await set(KEYS.fairwayAreas, areas)
    await set(KEYS.safetyDevices, safety)
    await set(KEYS.depthContours, depths)
  },
  getMeta: async (): Promise<DatasetsMeta> => (await get<DatasetsMeta>(KEYS.meta)) ?? {},
  setMeta: async (patch: Partial<DatasetsMeta>) => {
    const meta = (await get<DatasetsMeta>(KEYS.meta)) ?? {}
    await set(KEYS.meta, { ...meta, ...patch })
  },
  clearAll: async () => {
    for (const k of Object.values(KEYS)) await del(k)
  },
}
