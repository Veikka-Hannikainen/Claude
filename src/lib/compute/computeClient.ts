import type { ComputeRequest, ComputeResponse, ComputeSpotInput } from './protocol'
import type { FairwayAreas, FairwayLines, SpotComputed, WaterPolygon } from '../types'

type OnResult = (spotId: string, computed: SpotComputed) => void

interface Inited {
  water: WaterPolygon
  fairwayLines: FairwayLines | null
  fairwayAreas: FairwayAreas | null
}

/**
 * Laskentakaista: oma worker + jono. Aineistot lähetetään workerille vain
 * kerran per muutos (init) — spottierien kutsut ovat sen jälkeen kevyitä.
 */
function makeLane() {
  let worker: Worker | null = null
  let inited: Inited | null = null
  let queue = Promise.resolve()

  return function run(
    water: WaterPolygon,
    fairwayLines: FairwayLines | null,
    fairwayAreas: FairwayAreas | null,
    spots: ComputeSpotInput[],
    onResult: OnResult,
  ): Promise<void> {
    const exec = () =>
      new Promise<void>((resolve) => {
        if (spots.length === 0) return resolve()
        if (!worker) {
          worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' })
        }
        if (
          !inited ||
          inited.water !== water ||
          inited.fairwayLines !== fairwayLines ||
          inited.fairwayAreas !== fairwayAreas
        ) {
          const init: ComputeRequest = { type: 'init', water, fairwayLines, fairwayAreas }
          worker.postMessage(init)
          inited = { water, fairwayLines, fairwayAreas }
        }
        const handler = (ev: MessageEvent<ComputeResponse>) => {
          const msg = ev.data
          if (msg.type === 'result') onResult(msg.spotId, msg.computed)
          if (msg.type === 'done') {
            worker!.removeEventListener('message', handler)
            resolve()
          }
        }
        worker.addEventListener('message', handler)
        worker.postMessage({ type: 'compute', spots } satisfies ComputeRequest)
      })
    queue = queue.then(exec)
    return queue
  }
}

/** Taustalaskenta (kaikki spotit pienissä erissä) */
export const computeSpots = makeLane()
/** Pikakaista valitulle spotille — ei jonota taustaerien perässä */
export const computeSpotsPriority = makeLane()
