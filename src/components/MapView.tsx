import maplibregl, { Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { FeatureCollection } from 'geojson'
import { computedKey, seedSpotsWithOverrides, useApp } from '../state/store'
import type { Settings, Spot } from '../lib/types'

const PAIJANNE_CENTER: [number, number] = [25.45, 61.6]
/** Zoom-taso jolta alkaen paikkojen nimet näytetään */
const LABEL_ZOOM = 10.5
/** Pitkän painalluksen kesto — riittävän pitkä, ettei tule vahingossa */
const LONG_PRESS_MS = 900

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
    sources.kartta = {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap © CARTO',
    }
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
  for (const id of ['water-render', 'depth-contours', 'fairway-areas', 'fairway-lines', 'safety-devices'])
    ensureSource(id)

  // Syvyyskäyrät hillittyinä sinisinä viivoina (jos aineistoa on saatu)
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
    map.on('click', () => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false
        return
      }
      useApp.getState().selectSpot(null)
    })

    // Pitkä painallus kartalla lisää oman paikan. Peruuntuu heti jos sormi
    // liikkuu, kartta liikkuu tai toinen sormi osuu näyttöön (pinch-zoom).
    const canvasEl = map.getCanvasContainer()
    let lpTimer: number | null = null
    let lpStart: { x: number; y: number } | null = null
    let activePointers = 0
    const cancelLongPress = () => {
      if (lpTimer !== null) clearTimeout(lpTimer)
      lpTimer = null
      lpStart = null
    }
    canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
      activePointers++
      if (activePointers > 1) {
        cancelLongPress()
        return
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // Painallus olemassa olevan merkin päällä ei luo uutta paikkaa
      if ((e.target as HTMLElement).closest?.('.spot-marker')) return
      lpStart = { x: e.clientX, y: e.clientY }
      lpTimer = window.setTimeout(() => {
        lpTimer = null
        if (!lpStart || activePointers !== 1) return
        const rect = canvasEl.getBoundingClientRect()
        const lngLat = map.unproject([lpStart.x - rect.left, lpStart.y - rect.top])
        lpStart = null
        suppressNextClick.current = true
        const id = `own-${Date.now()}`
        const st = useApp.getState()
        st.addSpot({ id, name: 'Uusi paikka', lat: lngLat.lat, lon: lngLat.lng, isIsland: true })
        st.selectSpot(id)
        st.setEditingSpot(id)
      }, LONG_PRESS_MS)
    })
    canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 10) cancelLongPress()
    })
    const onPointerEnd = () => {
      activePointers = Math.max(0, activePointers - 1)
      cancelLongPress()
    }
    canvasEl.addEventListener('pointerup', onPointerEnd)
    canvasEl.addEventListener('pointercancel', onPointerEnd)
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
    if (map.getLayer('water-outline')) {
      map.setLayoutProperty(
        'water-outline',
        'visibility',
        st.settings.showWaterOutline ? 'visible' : 'none',
      )
    }
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    syncOverlayData(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterRender, fairwayLines, fairwayAreas, safetyDevices, depthContours, showWaterOutline])

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
        marker = new Marker({ element: el, anchor: 'center', draggable }).setLngLat(pos).addTo(map)
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

  return <div ref={containerRef} className="map-container" data-testid="map" />
}
