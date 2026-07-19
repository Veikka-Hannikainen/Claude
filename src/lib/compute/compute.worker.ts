/// <reference lib="webworker" />
import { computeFetchRays } from '../geo/fetchRays'
import { fairwayDistance } from '../geo/fairwayDistance'
import type { ComputeRequest, ComputeResponse } from './protocol'
import type { FairwayAreas, FairwayLines, SpotComputed, WaterPolygon } from '../types'

let water: WaterPolygon | null = null
let fairwayLines: FairwayLines | null = null
let fairwayAreas: FairwayAreas | null = null

self.onmessage = (ev: MessageEvent<ComputeRequest>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    water = msg.water
    fairwayLines = msg.fairwayLines
    fairwayAreas = msg.fairwayAreas
    return
  }
  for (const spot of msg.spots) {
    try {
      if (!water) throw new Error('Ei vesiaineistoa')
      const rays = computeFetchRays(water, spot.lon, spot.lat)
      const target = rays.snapped ?? { lon: spot.lon, lat: spot.lat }
      const fairway = fairwayDistance(fairwayLines, fairwayAreas, target.lon, target.lat)
      const computed: SpotComputed = {
        fetchKm: rays.fetchKm,
        fairwayDistM: fairway?.distM ?? null,
        nearFairway: fairway?.nearFairway ?? null,
        farFromWater: rays.farFromWater,
        withFairways: fairwayLines != null,
        snapped: rays.snapped,
        computedAt: Date.now(),
      }
      const out: ComputeResponse = { type: 'result', spotId: spot.id, computed }
      self.postMessage(out)
    } catch (err) {
      const out: ComputeResponse = {
        type: 'error',
        spotId: spot.id,
        message: err instanceof Error ? err.message : 'Laskenta epäonnistui',
      }
      self.postMessage(out)
    }
  }
  self.postMessage({ type: 'done' } satisfies ComputeResponse)
}
