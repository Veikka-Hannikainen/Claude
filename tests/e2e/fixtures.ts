/**
 * Synteettiset verkkovastaukset e2e-testeihin: suorakulmainen "Päijänne"
 * (lon 24.95–26.05, lat 61.05–62.30), jonka keskellä saari (25.48–25.52 ×
 * 61.58–61.62). Kaikki oikeat seed-spotit osuvat veteen.
 */

const rect = (w: number, s: number, e: number, n: number) => [
  { lon: w, lat: s },
  { lon: e, lat: s },
  { lon: e, lat: n },
  { lon: w, lat: n },
  { lon: w, lat: s },
]

export const ISLAND = { w: 25.48, s: 61.58, e: 25.52, n: 61.62 }

export const overpassFixture = {
  elements: [
    {
      type: 'relation',
      id: 1,
      tags: { natural: 'water', name: 'Päijänne' },
      members: [
        { type: 'way', role: 'outer', geometry: rect(24.95, 61.05, 26.05, 62.3) },
        { type: 'way', role: 'inner', geometry: rect(ISLAND.w, ISLAND.s, ISLAND.e, ISLAND.n) },
      ],
    },
  ],
}

export const ogcCollectionsFixture = {
  collections: [
    { id: 'vesivaylatiedot:vaylat_uusi', title: 'Väylät' },
    { id: 'vesivaylatiedot:vaylaalueet_uusi', title: 'Väyläalueet' },
  ],
}

/** Väylälinja kulkee Pulkkilanharjun seed-spotin (61.28333, 25.53) vierestä */
export const fairwayLinesFixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nimifi: 'Testiväylä' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [25.53, 61.2],
          [25.53, 61.32],
        ],
      },
    },
  ],
  links: [],
}

export const fairwayAreasFixture = { type: 'FeatureCollection', features: [], links: [] }

/** OSM-nimitarkennuksen vastaus: Pirttisaari löytyy "oikeasta" paikasta */
export const nameRefineFixture = {
  elements: [
    { type: 'node', id: 900, lat: 62.0051, lon: 25.5449, tags: { name: 'Pirttisaari' } },
  ],
}

/** 5 vrk tasainen länsituuli 10 m/s puuskissa 12 m/s */
export function openMeteoFixture() {
  const time: string[] = []
  const speed: number[] = []
  const dir: number[] = []
  const gust: number[] = []
  const start = new Date()
  start.setMinutes(0, 0, 0)
  for (let i = 0; i < 120; i++) {
    const d = new Date(start.getTime() + i * 3600_000)
    time.push(`${d.toISOString().slice(0, 13)}:00`)
    speed.push(10)
    dir.push(270)
    gust.push(12)
  }
  return {
    latitude: 61.5,
    longitude: 25.5,
    hourly: { time, wind_speed_10m: speed, wind_direction_10m: dir, wind_gusts_10m: gust },
  }
}
