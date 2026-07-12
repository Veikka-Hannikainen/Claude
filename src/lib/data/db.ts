import { get, set, del } from 'idb-keyval'
import type { FairwayAreas, FairwayLines, WaterPolygon } from '../types'

/** Isot aineistot IndexedDB:ssä — localStorage ei riitä megatavuille */
const KEYS = {
  waterCompute: 'water-compute-v1',
  waterRender: 'water-render-v1',
  fairwayLines: 'fairway-lines-v1',
  fairwayAreas: 'fairway-areas-v1',
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
  setFairways: async (lines: FairwayLines, areas: FairwayAreas) => {
    await set(KEYS.fairwayLines, lines)
    await set(KEYS.fairwayAreas, areas)
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
