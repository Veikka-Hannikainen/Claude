import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { FeatureCollection } from 'geojson'
import { useApp } from '../state/store'
import { SEED_SPOTS } from '../data/spotsSeed'
import { checkLegs, buildShoreIndex } from '../lib/geo/landCrossing'
import type { Settings, Spot, WaterPolygon } from '../lib/types'

const PAIJANNE_CENTER: [number, number] = [25.45, 61.6]

function basemapStyle(settings: Settings): maplibregl.StyleSpecification {
  const sources: Record<string, maplibregl.SourceSpecification> = {}
  let layerSource = 'osm'
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
  } else {
    sources.osm = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap-tekijät',
    }
  }
  return {
    version: 8,
    sources,
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b2233' } },
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
  for (const id of ['water-render', 'fairway-areas', 'fairway-lines', 'route-legs']) ensureSource(id)

  if (!map.getLayer('water-outline')) {
    map.addLayer({
      id: 'water-outline',
      type: 'line',
      source: 'water-render',
      paint: { 'line-color': '#3fa7dd', 'line-width': 1, 'line-opacity': 0.8 },
    })
  }
  if (!map.getLayer('fairway-areas-fill')) {
    map.addLayer({
      id: 'fairway-areas-fill',
      type: 'fill',
      source: 'fairway-areas',
      paint: { 'fill-color': '#ffb703', 'fill-opacity': 0.12 },
    })
  }
  if (!map.getLayer('fairway-lines-line')) {
    map.addLayer({
      id: 'fairway-lines-line',
      type: 'line',
      source: 'fairway-lines',
      paint: {
        'line-color': '#ffb703',
        'line-width': 1.5,
        'line-opacity': 0.7,
        'line-dasharray': [3, 2],
      },
    })
  }
  if (!map.getLayer('route-legs-line')) {
    map.addLayer({
      id: 'route-legs-line',
      type: 'line',
      source: 'route-legs',
      paint: {
        'line-color': ['case', ['get', 'crossesLand'], '#e63946', '#00b4d8'],
        'line-width': 3,
        'line-dasharray': ['case', ['get', 'crossesLand'], ['literal', [1.5, 1.5]], ['literal', [1, 0]]],
      },
    })
  }
}

function spotMarkerEl(spot: Spot, selected: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `spot-marker${spot.seed ? ' seed' : ' own'}${selected ? ' selected' : ''}`
  el.innerHTML = `<span class="dot">${spot.isIsland ? '⛰' : '⚓'}</span><span class="lbl">${spot.name}</span>`
  return el
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const spotMarkers = useRef(new Map<string, Marker>())
  const wpMarkers = useRef<Marker[]>([])
  const shoreRef = useRef<ReturnType<typeof buildShoreIndex> | null>(null)
  const waterForShoreRef = useRef<WaterPolygon | null>(null)

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
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left')
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }))
    map.on('style.load', () => {
      addOverlays(map)
      syncOverlayData(map)
    })
    map.on('click', (e) => {
      const { mode, activeRouteId } = useApp.getState()
      if (mode === 'add-spot') {
        const id = `own-${Date.now()}`
        useApp.getState().addSpot({
          id,
          name: 'Uusi paikka',
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          isIsland: true,
        })
        useApp.getState().selectSpot(id)
        useApp.getState().setEditingSpot(id)
        useApp.getState().setMode('browse')
      } else if (mode === 'edit-route' && activeRouteId) {
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
    mapRef.current = map
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

  function syncOverlayData(map: MlMap) {
    const st = useApp.getState()
    const setData = (id: string, data: unknown) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
      if (src) src.setData((data ?? EMPTY_FC) as GeoJSON.GeoJSON)
    }
    setData('water-render', st.waterRender)
    setData('fairway-lines', st.fairwayLines)
    setData('fairway-areas', st.fairwayAreas)
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
      if (waterForShoreRef.current !== st.waterCompute) {
        shoreRef.current = buildShoreIndex(st.waterCompute)
        waterForShoreRef.current = st.waterCompute
      }
      if (shoreRef.current) checks = checkLegs(st.waterCompute, shoreRef.current, route.waypoints)
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
  }, [waterRender, fairwayLines, fairwayAreas, routes, activeRouteId, waterCompute, showWaterOutline])

  // Spottimarkerit
  const userSpots = useApp((s) => s.userSpots)
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  const editingSpotId = useApp((s) => s.editingSpotId)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const all = [...SEED_SPOTS, ...userSpots]
    const seen = new Set<string>()
    for (const spot of all) {
      seen.add(spot.id)
      let marker = spotMarkers.current.get(spot.id)
      const draggable = spot.id === editingSpotId && !spot.seed
      if (!marker) {
        const el = spotMarkerEl(spot, spot.id === selectedSpotId)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          useApp.getState().selectSpot(spot.id)
        })
        marker = new Marker({ element: el, anchor: 'bottom', draggable })
          .setLngLat([spot.lon, spot.lat])
          .addTo(map)
        marker.on('dragend', () => {
          const pos = marker!.getLngLat()
          useApp.getState().updateSpot(spot.id, { lat: pos.lat, lon: pos.lng, coordsApproximate: false })
        })
        spotMarkers.current.set(spot.id, marker)
      } else {
        marker.setLngLat([spot.lon, spot.lat])
        marker.setDraggable(draggable)
        const el = marker.getElement()
        el.className = `spot-marker${spot.seed ? ' seed' : ' own'}${spot.id === selectedSpotId ? ' selected' : ''}${draggable ? ' draggable' : ''}`
        const lbl = el.querySelector('.lbl')
        if (lbl && lbl.textContent !== spot.name) lbl.textContent = spot.name
      }
    }
    for (const [id, marker] of spotMarkers.current) {
      if (!seen.has(id)) {
        marker.remove()
        spotMarkers.current.delete(id)
      }
    }
  }, [userSpots, selectedSpotId, editingSpotId])

  // Reittipistemarkerit (vain aktiivinen reitti muokkaustilassa)
  const mode = useApp((s) => s.mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    wpMarkers.current.forEach((m) => m.remove())
    wpMarkers.current = []
    const st = useApp.getState()
    const route = st.routes.find((r) => r.id === st.activeRouteId)
    if (!route) return
    route.waypoints.forEach((wp, i) => {
      const el = document.createElement('div')
      el.className = 'wp-marker'
      el.textContent = String(i + 1)
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
    })
  }, [routes, activeRouteId, mode])

  const modeClass = mode === 'browse' ? '' : ' crosshair'
  return <div ref={containerRef} className={`map-container${modeClass}`} data-testid="map" />
}
