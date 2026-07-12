/**
 * Valinnainen esilatausskripti: hakee Päijänteen rantaviivan (OpenStreetMap)
 * ja Väyläviraston väylät staattisiksi tiedostoiksi public/data/-hakemistoon.
 * Sovellus käyttää näitä jos ne löytyvät; muuten se lataa samat aineistot
 * selaimessa ensimmäisellä käynnistyksellä.
 *
 * Aja omalla koneella (vaatii pääsyn overpass-api.de ja avoinapi.vaylapilvi.fi):
 *   npm run data:fetch
 */
import { mkdir, writeFile } from 'node:fs/promises'
import osmtogeojson from 'osmtogeojson'
import simplify from '@turf/simplify'

const OUT = new URL('../public/data/', import.meta.url)
const BBOX_SWNE = '61.0,24.9,62.35,26.4' // etelä, länsi, pohjoinen, itä
const BBOX_WSEN = '24.9,61.0,26.4,62.35' // länsi, etelä, itä, pohjoinen

async function fetchWater() {
  console.log('Ladataan Päijänteen rantaviivaa (Overpass)…')
  const query = `[out:json][timeout:300];
rel["natural"="water"]["name"="Päijänne"](${BBOX_SWNE});
out geom;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const geojson = osmtogeojson(await res.json())
  const feature = geojson.features.find(
    (f) => f.geometry?.type === 'MultiPolygon' || f.geometry?.type === 'Polygon',
  )
  if (!feature) throw new Error('Päijänne-polygonia ei löytynyt')
  feature.properties = {}

  const compute = simplify(feature, { tolerance: 0.00005, highQuality: false })
  const render = simplify(feature, { tolerance: 0.0002, highQuality: false })
  await writeFile(new URL('paijanne-water.geojson', OUT), JSON.stringify(compute))
  await writeFile(new URL('paijanne-water-render.geojson', OUT), JSON.stringify(render))
  console.log('  → paijanne-water.geojson + paijanne-water-render.geojson')
}

async function fetchCollection(id) {
  const features = []
  let url = `https://avoinapi.vaylapilvi.fi/vaylatiedot/ogc/features/v1/collections/${encodeURIComponent(id)}/items?f=json&bbox=${BBOX_WSEN}&limit=2000`
  for (let page = 0; page < 30 && url; page++) {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } })
    if (!res.ok) throw new Error(`Väyläaineisto ${id}: HTTP ${res.status}`)
    const json = await res.json()
    features.push(...(json.features ?? []))
    url = json.links?.find((l) => l.rel === 'next')?.href ?? ''
  }
  return features.map((f) => ({
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      nimi: f.properties?.nimifi ?? f.properties?.nimi ?? null,
      luokka: f.properties?.vaylalaji ?? null,
    },
  }))
}

async function fetchFairways() {
  console.log('Ladataan väyliä (Väylävirasto)…')
  const res = await fetch(
    'https://avoinapi.vaylapilvi.fi/vaylatiedot/ogc/features/v1/collections?f=json',
  )
  if (!res.ok) throw new Error(`Kokoelmalista: HTTP ${res.status}`)
  const { collections = [] } = await res.json()
  const find = (re) => collections.find((c) => re.test(c.id))?.id
  const linesId = find(/vaylat_uusi$/i) ?? find(/vaylat/i)
  const areasId = find(/vaylaalueet/i)
  const isLine = (f) => /LineString/.test(f.geometry?.type ?? '')
  const isArea = (f) => /Polygon/.test(f.geometry?.type ?? '')

  const lines = linesId ? (await fetchCollection(linesId)).filter(isLine) : []
  const areas = areasId ? (await fetchCollection(areasId)).filter(isArea) : []
  await writeFile(
    new URL('fairway-lines.geojson', OUT),
    JSON.stringify({ type: 'FeatureCollection', features: lines }),
  )
  await writeFile(
    new URL('fairway-areas.geojson', OUT),
    JSON.stringify({ type: 'FeatureCollection', features: areas }),
  )
  console.log(`  → fairway-lines.geojson (${lines.length}) + fairway-areas.geojson (${areas.length})`)
}

await mkdir(OUT, { recursive: true })
const results = await Promise.allSettled([fetchWater(), fetchFairways()])
for (const r of results) {
  if (r.status === 'rejected') console.error('VIRHE:', r.reason?.message ?? r.reason)
}
if (results.every((r) => r.status === 'fulfilled')) console.log('Valmis.')
else process.exitCode = 1
