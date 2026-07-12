import { getPosition, getTimes } from 'suncalc'
import { BEARING_STEP } from '../types'

export type SunsetOpenness = 'kyllä' | 'osittain' | 'ei'

/** Auringonlaskun atsimuutti kompassiasteina (0 = pohjoinen, 90 = itä) */
export function sunsetAzimuthDeg(date: Date, lat: number, lon: number): number {
  const times = getTimes(date, lat, lon)
  const sunset = times.sunset instanceof Date && !isNaN(+times.sunset) ? times.sunset : date
  // SunCalcin atsimuutti: radiaaneja etelästä länteen päin
  const az = getPosition(sunset, lat, lon).azimuth
  return (az * (180 / Math.PI) + 180 + 360) % 360
}

const OPEN_SECTOR_DEG = 30
const OPEN_KM = 0.5
const PARTIAL_KM = 0.2

/** Onko spotilta avoin näkymä auringonlaskuun: max fetch ±30° laskusuunnasta */
export function sunsetOpenness(fetchKm: number[], azimuthDeg: number): SunsetOpenness {
  let max = 0
  for (let i = 0; i < fetchKm.length; i++) {
    const b = i * BEARING_STEP
    const diff = Math.abs(((b - azimuthDeg + 540) % 360) - 180)
    if (diff <= OPEN_SECTOR_DEG && fetchKm[i] > max) max = fetchKm[i]
  }
  if (max >= OPEN_KM) return 'kyllä'
  if (max >= PARTIAL_KM) return 'osittain'
  return 'ei'
}
