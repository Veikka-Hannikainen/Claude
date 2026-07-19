import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { FeatureCollection } from 'geojson'
import { computedKey, seedSpotsWithOverrides, useApp } from '../state/store'
import { checkLegs } from '../lib/geo/landCrossing'
import { getShoreIndex } from '../lib/geo/shoreCache'
import { routeMetrics } from '../lib/route/metrics'
import type { Settings, Spot } from '../lib/types'

const PAIJANNE_CENTER: [number, number] = [25.45, 61.6]
/** Zoom-taso jolta alkaen paikkojen nimet näytetään */
const LABEL_ZOOM = 10.5

function basemapStyle(settings: Settings): maplibregl.StyleSpecification {
  const sources: Record<string, maplibregl.SourceSpecification> = {}
  let layerSource = 'kartta'
  if (settings.basemap === 'mml' && settings.mmlApiKey) {
    sources.mml = {
      type: 'raster',
      tiles: [
        `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key=${encodeURIComponent(settings.mmlApiKey)}`,
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© Maanmittauslaitos',
    }
    layerSource = 'mml'
  } else if (settings.basemap === 'esri') {
    sources.esri = {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    }
    layerSource = 'esri'
  } else if (settings.basemap === 'kartta') {
    sources.kartta = {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap © CARTO',
    }
    layerSource = 'kartta'
  } else if (settings.basemap === 'osm') {
    sources.osm = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap-tekijät',
    }
    layerSource = 'osm'
  } else {
    // Oletus: Traficomin avoin rasterimerikartta (sarja J = Päijänne) — syvyydet,
    // väylät ja merkinnät. Ei navigointikäyttöön.
    sources.merikartta = {
      type: 'raster',
      tiles: [
        'https://julkinen.traficom.fi/rasteripalvelu/wmts?request=GetTile&version=1.0.0&service=wmts&layer=Traficom:Merikarttasarja%20J%20public&TILEMATRIXSET=WGS84_Pseudo-Mercator&TileMatrix=WGS84_Pseudo-Mercator:{z}&tilerow={y}&tilecol={x}&format=image/png&style=default',
      ],
      tileSize: 256,
      maxzoom: 15,
      attribution: '© Traficom (CC BY 4.0) — ei navigointikäyttöön',
    }
    layerSource = 'merikartta'
  }
  return {
    version: 8,
    sources,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#eef1f4' } },
      { id: 'basemap', type: 'raster', source: layerSource },
    ],
  }
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Overlay-lähteet ja -tasot — lisätään uudelleen aina style-vaihdon jälkeen */
function addOverlays(map: MlMap) {
  const ensureSource = (id: string) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY_FC })
  }
  for (const id of [
    'water-render',
    'depth-contours',
    'fairway-areas',
    'fairway-lines',
    'safety-devices',
    'route-legs',
  ])
    ensureSource(id)

  // Syvyyskäyrät hillittyinä sinisinä viivoina pohjimmaiseksi
  if (!map.getLayer('depth-contours-line')) {
    map.addLayer({
      id: 'depth-contours-line',
      type: 'line',
      source: 'depth-contours',
      minzoom: 10,
      paint: { 'line-color': '#7fa8d9', 'line-width': 0.8, 'line-opacity': 0.5 },
    })
  }
  if (!map.getLayer('water-outline')) {
    map.addLayer({
      id: 'water-outline',
      type: 'line',
      source: 'water-render',
      paint: { 'line-color': 'rgba(42,120,214,0.5)', 'line-width': 1 },
    })
  }
  if (!map.getLayer('fairway-areas-fill')) {
    map.addLayer({
      id: 'fairway-areas-fill',
      type: 'fill',
      source: 'fairway-areas',
      paint: { 'fill-color': '#d9a20b', 'fill-opacity': 0.08 },
    })
  }
  if (!map.getLayer('fairway-lines-line')) {
    map.addLayer({
      id: 'fairway-lines-line',
      type: 'line',
      source: 'fairway-lines',
      paint: {
        'line-color': '#d9a20b',
        'line-width': 1.2,
        'line-opacity': 0.55,
        'line-dasharray': [3, 2],
      },
    })
  }
  // Turvalaitteet (poijut, viitat) pieninä täplinä zoomilta 10.5
  if (!map.getLayer('safety-devices-dot')) {
    map.addLayer({
      id: 'safety-devices-dot',
      type: 'circle',
      source: 'safety-devices',
      minzoom: 10.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.5, 2, 14, 4.5],
        'circle-color': '#c9860b',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    })
  }
  // Reitti: valkoinen reunus + sininen viiva; maata leikkaava etappi punaisella
  if (!map.getLayer('route-casing')) {
    map.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'route-legs',
      filter: ['!', ['get', 'crossesLand']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 },
    })
  }
  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route-legs',
      filter: ['!', ['get', 'crossesLand']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#2f6fed', 'line-width': 5 },
    })
  }
  if (!map.getLayer('route-bad')) {
    map.addLayer({
      id: 'route-bad',
      type: 'line',
      source: 'route-legs',
      filter: ['get', 'crossesLand'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#d03b3b', 'line-width': 4, 'line-dasharray': [1.4, 1.6] },
    })
  }
}

function spotMarkerEl(spot: Spot): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = `<span class="dot"><span class="fav-dot" hidden>★</span></span><span class="lbl"></span>`
  el.querySelector('.lbl')!.textContent = spot.name
  return el
}

function markerClass(spot: Spot, selected: boolean, favorite: boolean, draggable: boolean): string {
  return `spot-marker${spot.seed ? ' seed' : ' own'}${spot.official ? ' official' : ''}${selected ? ' selected' : ''}${draggable ? ' draggable' : ''}${favorite ? ' fav' : ''}`
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const spotMarkers = useRef(new Map<string, Marker>())
  const wpMarkers = useRef<Marker[]>([])
  const suppressNextClick = useRef(false)

  // Init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle(useApp.getState().settings),
      center: PAIJANNE_CENTER,
      zoom: 8,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.on('style.load', () => {
      addOverlays(map)
      syncOverlayData(map)
    })
    map.on('zoom', () => {
      containerRef.current?.classList.toggle('show-labels', map.getZoom() >= LABEL_ZOOM)
    })
    map.on('click', (e) => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false
        return
      }
      const { mode, activeRouteId } = useApp.getState()
      if (mode === 'edit-route' && activeRouteId) {
        const route = useApp.getState().routes.find((r) => r.id === activeRouteId)
        if (route) {
          useApp.getState().updateRoute(activeRouteId, {
            waypoints: [...route.waypoints, { lat: e.lngLat.lat, lon: e.lngLat.lng }],
          })
        }
      } else {
        useApp.getState().selectSpot(null)
      }
    })

    // Pitkä painallus kartalla lisää oman paikan (iOS/Orca-tapa)
    const canvasEl = map.getCanvasContainer()
    let lpTimer: number | null = null
    let lpStart: { x: number; y: number } | null = null
    const cancelLongPress = () => {
      if (lpTimer !== null) clearTimeout(lpTimer)
      lpTimer = null
      lpStart = null
    }
    canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      lpStart = { x: e.clientX, y: e.clientY }
      lpTimer = window.setTimeout(() => {
        lpTimer = null
        if (!lpStart) return
        const rect = canvasEl.getBoundingClientRect()
        const lngLat = map.unproject([lpStart.x - rect.left, lpStart.y - rect.top])
        lpStart = null
        suppressNextClick.current = true
        const id = `own-${Date.now()}`
        const st = useApp.getState()
        st.addSpot({ id, name: 'Uusi paikka', lat: lngLat.lat, lon: lngLat.lng, isIsland: true })
        st.selectSpot(id)
        st.setEditingSpot(id)
      }, 550)
    })
    canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 10) cancelLongPress()
    })
    canvasEl.addEventListener('pointerup', cancelLongPress)
    canvasEl.addEventListener('pointercancel', cancelLongPress)
    map.on('move', cancelLongPress)
    map.on('zoom', cancelLongPress)
    mapRef.current = map
    // Testi-/konsolikäyttöön (mm. markerien asemoinnin regressiotesti)
    ;(window as unknown as { __map?: MlMap }).__map = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Basemap-vaihto
  const basemap = useApp((s) => s.settings.basemap)
  const mmlKey = useApp((s) => s.settings.mmlApiKey)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(basemapStyle(useApp.getState().settings))
    // 'style.load'-käsittelijä lisää overlayt takaisin
  }, [basemap, mmlKey])

  // Overlay-datan synkka
  const waterRender = useApp((s) => s.waterRender)
  const fairwayLines = useApp((s) => s.fairwayLines)
  const fairwayAreas = useApp((s) => s.fairwayAreas)
  const routes = useApp((s) => s.routes)
  const activeRouteId = useApp((s) => s.activeRouteId)
  const waterCompute = useApp((s) => s.waterCompute)
  const showWaterOutline = useApp((s) => s.settings.showWaterOutline)
  const safetyDevices = useApp((s) => s.safetyDevices)
  const depthContours = useApp((s) => s.depthContours)

  function syncOverlayData(map: MlMap) {
    const st = useApp.getState()
    const setData = (id: string, data: unknown) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
      if (src) src.setData((data ?? EMPTY_FC) as GeoJSON.GeoJSON)
    }
    setData('water-render', st.waterRender)
    setData('depth-contours', st.depthContours)
    setData('fairway-lines', st.fairwayLines)
    setData('fairway-areas', st.fairwayAreas)
    setData('safety-devices', st.safetyDevices)
    setData('route-legs', routeLegsFc())
    if (map.getLayer('water-outline')) {
      map.setLayoutProperty(
        'water-outline',
        'visibility',
        st.settings.showWaterOutline ? 'visible' : 'none',
      )
    }
  }

  function routeLegsFc(): FeatureCollection {
    const st = useApp.getState()
    const route = st.routes.find((r) => r.id === st.activeRouteId)
    if (!route || route.waypoints.length < 2) return EMPTY_FC
    let checks: { crossesLand: boolean }[] = route.waypoints.slice(1).map(() => ({ crossesLand: false }))
    if (st.waterCompute) {
      checks = checkLegs(st.waterCompute, getShoreIndex(st.waterCompute), route.waypoints)
    }
    return {
      type: 'FeatureCollection',
      features: checks.map((c, i) => ({
        type: 'Feature',
        properties: { crossesLand: c.crossesLand, leg: i + 1 },
        geometry: {
          type: 'LineString',
          coordinates: [
            [route.waypoints[i].lon, route.waypoints[i].lat],
            [route.waypoints[i + 1].lon, route.waypoints[i + 1].lat],
          ],
        },
      })),
    }
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    syncOverlayData(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterRender, fairwayLines, fairwayAreas, safetyDevices, depthContours, routes, activeRouteId, waterCompute, showWaterOutline])

  // Kertaluonteinen lento kohteeseen (esim. "Näytä ilmakuvassa")
  const flyTarget = useApp((s) => s.flyTarget)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTarget) return
    map.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: flyTarget.zoom, duration: 1200 })
  }, [flyTarget])

  // Spottimarkerit
  const userSpots = useApp((s) => s.userSpots)
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  const editingSpotId = useApp((s) => s.editingSpotId)
  const favoriteIds = useApp((s) => s.favoriteIds)
  const seedCoordOverrides = useApp((s) => s.seedCoordOverrides)
  const computedMap = useApp((s) => s.computed)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const all = [...seedSpotsWithOverrides(seedCoordOverrides), ...userSpots]
    const seen = new Set<string>()
    for (const spot of all) {
      seen.add(spot.id)
      let marker = spotMarkers.current.get(spot.id)
      const draggable = spot.id === editingSpotId && !spot.seed
      const favorite = favoriteIds.includes(spot.id)
      // Merkki rantaan snapattuun pisteeseen, ei esim. saaren keskelle
      const snapped = computedMap[computedKey(spot)]?.snapped
      const pos: [number, number] = snapped ? [snapped.lon, snapped.lat] : [spot.lon, spot.lat]
      if (!marker) {
        const el = spotMarkerEl(spot)
        el.className = markerClass(spot, spot.id === selectedSpotId, favorite, draggable)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          useApp.getState().selectSpot(spot.id)
        })
        marker = new Marker({ element: el, anchor: 'center', draggable })
          .setLngLat(pos)
          .addTo(map)
        marker.on('dragend', () => {
          const p = marker!.getLngLat()
          useApp.getState().updateSpot(spot.id, { lat: p.lat, lon: p.lng, coordsApproximate: false })
        })
        spotMarkers.current.set(spot.id, marker)
      } else {
        marker.setLngLat(pos)
        marker.setDraggable(draggable)
        const el = marker.getElement()
        el.className = markerClass(spot, spot.id === selectedSpotId, favorite, draggable)
        const lbl = el.querySelector('.lbl')
        if (lbl && lbl.textContent !== spot.name) lbl.textContent = spot.name
      }
      const favDot = marker.getElement().querySelector<HTMLElement>('.fav-dot')
      if (favDot) favDot.hidden = !favorite
    }
    for (const [id, marker] of spotMarkers.current) {
      if (!seen.has(id)) {
        marker.remove()
        spotMarkers.current.delete(id)
      }
    }
  }, [userSpots, selectedSpotId, editingSpotId, favoriteIds, seedCoordOverrides, computedMap])

  // Reittipisteet + kumulatiiviset aikapillerit (aktiivinen reitti)
  const mode = useApp((s) => s.mode)
  const cruiseKn = useApp((s) => s.settings.cruiseKn)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    wpMarkers.current.forEach((m) => m.remove())
    wpMarkers.current = []
    const st = useApp.getState()
    const route = st.routes.find((r) => r.id === st.activeRouteId)
    if (!route) return

    const metrics = routeMetrics(route.waypoints, st.settings.cruiseKn, st.settings.fuelLph, st.settings.fuelPriceEur)
    const departure = Date.now()
    let cumulativeNm = 0

    route.waypoints.forEach((wp, i) => {
      const el = document.createElement('div')
      el.className = 'wp-marker'
      const marker = new Marker({ element: el, draggable: mode === 'edit-route' })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        const r = useApp.getState().routes.find((x) => x.id === route.id)
        if (!r) return
        const waypoints = r.waypoints.map((w, j) => (j === i ? { lat: pos.lat, lon: pos.lng } : w))
        useApp.getState().updateRoute(route.id, { waypoints })
      })
      if (mode === 'edit-route') {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const r = useApp.getState().routes.find((x) => x.id === route.id)
          if (!r) return
          useApp.getState().updateRoute(route.id, { waypoints: r.waypoints.filter((_, j) => j !== i) })
        })
      }
      wpMarkers.current.push(marker)

      // Aikapilleri: arvioitu kellonaika tälle pisteelle
      if (i > 0 && st.settings.cruiseKn > 0 && metrics.legs[i - 1]) {
        cumulativeNm += metrics.legs[i - 1].nm
        const etaMs = departure + (cumulativeNm / st.settings.cruiseKn) * 3600_000
        const pill = document.createElement('div')
        pill.className = 'time-pill'
        pill.textContent = new Date(etaMs).toLocaleTimeString('fi-FI', {
          hour: '2-digit',
          minute: '2-digit',
        })
        wpMarkers.current.push(
          new Marker({ element: pill, anchor: 'bottom', offset: [0, -14] })
            .setLngLat([wp.lon, wp.lat])
            .addTo(map),
        )
      }
    })
  }, [routes, activeRouteId, mode, cruiseKn])

  const modeClass = mode === 'browse' ? '' : ' crosshair'
  return <div ref={containerRef} className={`map-container${modeClass}`} data-testid="map" />
}
