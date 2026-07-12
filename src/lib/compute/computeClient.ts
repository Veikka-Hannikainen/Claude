import type { ComputeRequest, ComputeResponse, ComputeSpotInput } from './protocol'
import type { FairwayAreas, FairwayLines, SpotComputed, WaterPolygon } from '../types'

let worker: Worker | null = null
let queue = Promise.resolve()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

/**
 * Laske spottien fetch-säteet ja väyläetäisyydet taustasäikeessä.
 * Kutsut jonotetaan, jotta workerin viestit eivät sekoitu keskenään.
 */
export function computeSpots(
  water: WaterPolygon,
  fairwayLines: FairwayLines | null,
  fairwayAreas: FairwayAreas | null,
  spots: ComputeSpotInput[],
  onResult: (spotId: string, computed: SpotComputed) => void,
): Promise<void> {
  const run = () =>
    new Promise<void>((resolve) => {
      if (spots.length === 0) return resolve()
      const w = getWorker()
      const handler = (ev: MessageEvent<ComputeResponse>) => {
        const msg = ev.data
        if (msg.type === 'result') onResult(msg.spotId, msg.computed)
        if (msg.type === 'done') {
          w.removeEventListener('message', handler)
          resolve()
        }
      }
      w.addEventListener('message', handler)
      const req: ComputeRequest = { water, fairwayLines, fairwayAreas, spots }
      w.postMessage(req)
    })
  queue = queue.then(run)
  return queue
}
