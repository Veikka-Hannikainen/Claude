import type { FairwayAreas, FairwayLines, SpotComputed, WaterPolygon } from '../types'

export interface ComputeSpotInput {
  id: string
  lon: number
  lat: number
}

/** Aineistot lähetetään workerille vain kerran (init) — spottierät viittaavat niihin */
export type ComputeRequest =
  | {
      type: 'init'
      water: WaterPolygon
      fairwayLines: FairwayLines | null
      fairwayAreas: FairwayAreas | null
    }
  | { type: 'compute'; spots: ComputeSpotInput[] }

export type ComputeResponse =
  | { type: 'result'; spotId: string; computed: SpotComputed }
  | { type: 'error'; spotId: string; message: string }
  | { type: 'done' }
