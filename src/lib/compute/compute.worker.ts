/// <reference lib="webworker" />
import { computeFetchRays } from '../geo/fetchRays'
import { fairwayDistance } from '../geo/fairwayDistance'
import type { ComputeRequest, ComputeResponse } from './protocol'
import type { SpotComputed } from '../types'

self.onmessage = (ev: MessageEvent<ComputeRequest>) => {
  const { water, fairwayLines, fairwayAreas, spots } = ev.data
  for (const spot of spots) {
    try {
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
      const msg: ComputeResponse = { type: 'result', spotId: spot.id, computed }
      self.postMessage(msg)
    } catch (err) {
      const msg: ComputeResponse = {
        type: 'error',
        spotId: spot.id,
        message: err instanceof Error ? err.message : 'Laskenta epäonnistui',
      }
      self.postMessage(msg)
    }
  }
  self.postMessage({ type: 'done' } satisfies ComputeResponse)
}
