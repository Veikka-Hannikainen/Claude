import type { HourlyWind, WindForecast } from '../types'

const BASE = 'https://api.open-meteo.com/v1/forecast'
/** MET Nordic 1 km -malli ECMWF-jatkolla — paras tarkkuus Suomen järville */
const PREFERRED_MODEL = 'metno_seamless'
export const FORECAST_DAYS = 5

interface OpenMeteoHourly {
  time: string[]
  wind_speed_10m: (number | null)[]
  wind_direction_10m: (number | null)[]
  wind_gusts_10m: (number | null)[]
}

function buildUrl(lat: number, lon: number, model?: string): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: 'ms',
    timezone: 'Europe/Helsinki',
  })
  if (model) params.set('models', model)
  return `${BASE}?${params}`
}

async function tryFetch(url: string): Promise<OpenMeteoHourly | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  if (json.error || !json.hourly?.time) return null
  return json.hourly as OpenMeteoHourly
}

export async function fetchWindForecast(lat: number, lon: number): Promise<WindForecast> {
  // Kokeile pohjoismaista tarkkaa mallia; jos parametri ei kelpaa, oletusmalli
  const hourly =
    (await tryFetch(buildUrl(lat, lon, PREFERRED_MODEL)).catch(() => null)) ??
    (await tryFetch(buildUrl(lat, lon)))
  if (!hourly) throw new Error('Sääennusteen haku epäonnistui')

  const hours: HourlyWind[] = []
  for (let i = 0; i < hourly.time.length; i++) {
    const speed = hourly.wind_speed_10m[i]
    const dir = hourly.wind_direction_10m[i]
    if (speed == null || dir == null) continue
    hours.push({
      time: hourly.time[i],
      speedMs: speed,
      gustMs: hourly.wind_gusts_10m[i] ?? speed,
      directionDeg: dir,
    })
  }
  return { fetchedAt: Date.now(), lat, lon, hours }
}

export const FORECAST_CACHE_MS = 3600_000
