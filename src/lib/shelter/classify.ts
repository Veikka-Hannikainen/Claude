import { BEARING_COUNT, BEARING_STEP, type HourlyWind, type ShelterClass } from '../types'

/** Suojassa-luokituksen yläraja aallonkorkeudelle (m) */
export const SHELTER_HS_CALM = 0.15
/** Kohtalainen-luokituksen yläraja aallonkorkeudelle (m) */
export const SHELTER_HS_MODERATE = 0.35
/** Puuskien painotus efektiivisessä tuulessa */
const GUST_FACTOR = 0.75
const G = 9.81

/**
 * Yksinkertaistettu SMB-aallonkorkeus syvälle vedelle:
 * Hs(m) = 0.0016 × U × sqrt(F / g), U = tuuli m/s, F = fetch metreinä.
 */
export function waveHeightM(windMs: number, fetchM: number): number {
  return 0.0016 * windMs * Math.sqrt(fetchM / G)
}

/**
 * Efektiivinen fetch tuulen suuntaan: pessimistisesti suurin arvo
 * kolmesta sektorista ±15° tuulen suunnasta. Huom: fetch-taulukko kertoo
 * avoimen veden SUUNTAAN X — tuuli suunnasta X nostaa aallokon sen matkan yli,
 * joten indeksöidään suoraan tuulen suunnalla (mistä tuulee = mistä aallot tulevat).
 */
export function effectiveFetchKm(fetchKm: number[], windDirDeg: number): number {
  const center = Math.round(((windDirDeg % 360) + 360) % 360 / BEARING_STEP) % BEARING_COUNT
  let max = 0
  for (const off of [-1, 0, 1]) {
    const i = (center + off + BEARING_COUNT) % BEARING_COUNT
    if (fetchKm[i] > max) max = fetchKm[i]
  }
  return max
}

export function classifyHs(hs: number): ShelterClass {
  if (hs <= SHELTER_HS_CALM) return 'suojassa'
  if (hs <= SHELTER_HS_MODERATE) return 'kohtalainen'
  return 'altis'
}

export interface HourShelter {
  time: string
  windMs: number
  gustMs: number
  directionDeg: number
  hs: number
  klass: ShelterClass
}

export function classifyHour(hour: HourlyWind, fetchKm: number[]): HourShelter {
  const u = Math.max(hour.speedMs, GUST_FACTOR * hour.gustMs)
  const fetchM = effectiveFetchKm(fetchKm, hour.directionDeg) * 1000
  const hs = waveHeightM(u, fetchM)
  return {
    time: hour.time,
    windMs: hour.speedMs,
    gustMs: hour.gustMs,
    directionDeg: hour.directionDeg,
    hs,
    klass: classifyHs(hs),
  }
}

export interface DayShelter {
  date: string
  worst: ShelterClass
  worstHs: number
  hours: HourShelter[]
}

/** Ryhmittele tunnit päiviksi; päivän luokka = pahin tunti klo 06–24 */
export function classifyDays(hours: HourlyWind[], fetchKm: number[]): DayShelter[] {
  const byDate = new Map<string, HourShelter[]>()
  for (const h of hours) {
    const date = h.time.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(classifyHour(h, fetchKm))
  }
  const order: Record<ShelterClass, number> = { suojassa: 0, kohtalainen: 1, altis: 2 }
  return [...byDate.entries()].map(([date, dayHours]) => {
    const daytime = dayHours.filter((h) => {
      const hh = Number(h.time.slice(11, 13))
      return hh >= 6
    })
    const source = daytime.length > 0 ? daytime : dayHours
    let worst: HourShelter = source[0]
    for (const h of source) {
      if (order[h.klass] > order[worst.klass] || (h.klass === worst.klass && h.hs > worst.hs)) {
        worst = h
      }
    }
    return { date, worst: worst.klass, worstHs: worst.hs, hours: dayHours }
  })
}
