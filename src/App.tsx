import { useEffect, useRef, useState } from 'react'
import MapView from './components/MapView'
import BottomSheet from './components/BottomSheet'
import SpotList from './components/SpotList'
import SpotPanel from './components/SpotPanel'
import RoutePanel from './components/RoutePanel'
import SettingsDialog from './components/SettingsDialog'
import DataBanner from './components/DataBanner'
import { computedKey, seedSpotsWithOverrides, useApp } from './state/store'
import { SEED_SPOTS } from './data/spotsSeed'
import type { SpotComputed } from './lib/types'
import { downloadMissing, loadFromDb } from './lib/data/bootstrap'
import { refineSeedCoords } from './lib/data/refineSeeds'
import { computeSpots, computeSpotsPriority } from './lib/compute/computeClient'
import { t } from './i18n/fi'

async function bootstrap() {
  const st = useApp.getState()
  const current = await loadFromDb()
  st.setData(current)
  await downloadMissing(current, {
    onWaterState: (s) => useApp.getState().setWaterState(s),
    onFairwayState: (s) => useApp.getState().setFairwayState(s),
    onData: (d) => useApp.getState().setData(d),
  })
}

export default function App() {
  const view = useApp((s) => s.view)
  const mode = useApp((s) => s.mode)
  const sheetPos = useApp((s) => s.sheetPos)
  const basemap = useApp((s) => s.settings.basemap)
  const satellite = basemap === 'mml' || basemap === 'esri'
  const [showSettings, setShowSettings] = useState(false)
  const inflight = useRef(new Set<string>())

  useEffect(() => {
    void bootstrap()
  }, [])

  // Tarkenna likimääräiset seed-sijainnit OSM-paikannimillä (kerran per selain)
  const refineTried = useRef(false)
  useEffect(() => {
    if (refineTried.current) return
    const pending = SEED_SPOTS.filter(
      (s) => s.osmName && !useApp.getState().seedCoordOverrides[s.id],
    )
    if (pending.length === 0) return
    refineTried.current = true
    void refineSeedCoords(pending).then((o) => {
      if (Object.keys(o).length > 0) useApp.getState().addSeedCoordOverrides(o)
    })
  }, [])

  // Laske suoja-analyysi spoteille, joilta tulos puuttuu (tai väylädata saapui myöhemmin).
  // Valittu spotti menee pikakaistalle (oma worker), muut taustalle pieninä erinä.
  const waterCompute = useApp((s) => s.waterCompute)
  const fairwayLines = useApp((s) => s.fairwayLines)
  const fairwayAreas = useApp((s) => s.fairwayAreas)
  const userSpots = useApp((s) => s.userSpots)
  const computed = useApp((s) => s.computed)
  const seedCoordOverrides = useApp((s) => s.seedCoordOverrides)
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  useEffect(() => {
    if (!waterCompute) return
    const all = [...seedSpotsWithOverrides(seedCoordOverrides), ...userSpots]
    const needed = all.filter((sp) => {
      const key = computedKey(sp)
      if (inflight.current.has(key)) return false
      const c = computed[key]
      if (!c) return true
      return !c.withFairways && fairwayLines != null
    })
    if (needed.length === 0) return

    const onResult = (key: string, result: SpotComputed) => {
      inflight.current.delete(key)
      useApp.getState().setComputed(key, result)
    }
    const dispatch = (
      lane: typeof computeSpots,
      spots: typeof needed,
    ) => {
      spots.forEach((sp) => inflight.current.add(computedKey(sp)))
      void lane(
        waterCompute,
        fairwayLines,
        fairwayAreas,
        spots.map((sp) => ({ id: computedKey(sp), lon: sp.lon, lat: sp.lat })),
        onResult,
      ).then(() => spots.forEach((sp) => inflight.current.delete(computedKey(sp))))
    }

    const selected = needed.filter((sp) => sp.id === selectedSpotId)
    const rest = needed.filter((sp) => sp.id !== selectedSpotId)
    if (selected.length > 0) dispatch(computeSpotsPriority, selected)
    const CHUNK = 4
    for (let i = 0; i < rest.length; i += CHUNK) dispatch(computeSpots, rest.slice(i, i + CHUNK))
  }, [waterCompute, fairwayLines, fairwayAreas, userSpots, computed, seedCoordOverrides, selectedSpotId])

  return (
    <div className={`app sheet-${sheetPos}`}>
      <div className="map-wrap">
        <MapView />
      </div>

      <div className="brand-pill">
        <span className="wave">⚓</span>
        {t.appName}
      </div>
      <button
        className="round-btn settings-btn"
        aria-label={t.settings.title}
        data-testid="open-settings"
        onClick={() => setShowSettings(true)}
      >
        ⚙
      </button>
      <DataBanner
        onRetry={() => {
          void bootstrap()
        }}
      />

      <button
        className="chip satellite-btn"
        data-testid="satellite-toggle"
        onClick={() => {
          const st = useApp.getState()
          if (satellite) st.setSettings({ basemap: 'merikartta' })
          else st.setSettings({ basemap: st.settings.mmlApiKey ? 'mml' : 'esri' })
        }}
      >
        {satellite ? `🗺 ${t.map.map}` : `🛰 ${t.map.aerial}`}
      </button>
      {mode === 'edit-route' && (
        <div className="hint-pill" style={{ top: 'calc(64px + env(safe-area-inset-top))' }}>
          {t.route.editHint}
        </div>
      )}

      <BottomSheet>
        {view === 'list' && <SpotList />}
        {view === 'spot' && <SpotPanel />}
        {view === 'route' && <RoutePanel />}
      </BottomSheet>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
