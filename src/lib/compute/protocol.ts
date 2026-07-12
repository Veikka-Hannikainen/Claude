import type { FairwayAreas, FairwayLines, SpotComputed, WaterPolygon } from '../types'

export interface ComputeSpotInput {
  id: string
  lon: number
  lat: number
}

export interface ComputeRequest {
  water: WaterPolygon
  fairwayLines: FairwayLines | null
  fairwayAreas: FairwayAreas | null
  spots: ComputeSpotInput[]
}

export type ComputeResponse =
  | { type: 'result'; spotId: string; computed: SpotComputed }
  | { type: 'error'; spotId: string; message: string }
  | { type: 'done' }
