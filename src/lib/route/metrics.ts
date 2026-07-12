import distance from '@turf/distance'
import { point } from '@turf/helpers'
import type { Waypoint } from '../types'

export const KM_PER_NM = 1.852

export interface LegMetrics {
  km: number
  nm: number
}

export interface RouteMetrics {
  legs: LegMetrics[]
  totalKm: number
  totalNm: number
  hours: number
  fuelL: number
  fuelCostEur: number
}

export function routeMetrics(
  waypoints: Waypoint[],
  cruiseKn: number,
  fuelLph: number,
  fuelPriceEur: number,
): RouteMetrics {
  const legs: LegMetrics[] = []
  let totalKm = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const km = distance(
      point([waypoints[i].lon, waypoints[i].lat]),
      point([waypoints[i + 1].lon, waypoints[i + 1].lat]),
      { units: 'kilometers' },
    )
    legs.push({ km, nm: km / KM_PER_NM })
    totalKm += km
  }
  const totalNm = totalKm / KM_PER_NM
  const hours = cruiseKn > 0 ? totalNm / cruiseKn : 0
  const fuelL = hours * fuelLph
  return { legs, totalKm, totalNm, hours, fuelL, fuelCostEur: fuelL * fuelPriceEur }
}

export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}
