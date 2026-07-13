import { useEffect, useRef, useState } from 'react'
import MapView from './components/MapView'
import BottomSheet from './components/BottomSheet'
import SpotList from './components/SpotList'
import SpotPanel from './components/SpotPanel'
import RoutePanel from './components/RoutePanel'
import SettingsDialog from './components/SettingsDialog'
import DataBanner from './components/DataBanner'
import { computedKey, useApp } from './state/store'
import { SEED_SPOTS } from './data/spotsSeed'
import { downloadMissing, loadFromDb } from './lib/data/bootstrap'
import { computeSpots } from './lib/compute/computeClient'
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
  const [showSettings, setShowSettings] = useState(false)
  const inflight = useRef(new Set<string>())

  useEffect(() => {
    void bootstrap()
  }, [])

  // Laske suoja-analyysi spoteille, joilta tulos puuttuu (tai väylädata saapui myöhemmin)
  const waterCompute = useApp((s) => s.waterCompute)
  const fairwayLines = useApp((s) => s.fairwayLines)
  const fairwayAreas = useApp((s) => s.fairwayAreas)
  const userSpots = useApp((s) => s.userSpots)
  const computed = useApp((s) => s.computed)
  useEffect(() => {
    if (!waterCompute) return
    const all = [...SEED_SPOTS, ...userSpots]
    const needed = all.filter((sp) => {
      const key = computedKey(sp)
      if (inflight.current.has(key)) return false
      const c = computed[key]
      if (!c) return true
      return !c.withFairways && fairwayLines != null
    })
    if (needed.length === 0) return
    needed.forEach((sp) => inflight.current.add(computedKey(sp)))
    void computeSpots(
      waterCompute,
      fairwayLines,
      fairwayAreas,
      needed.map((sp) => ({ id: computedKey(sp), lon: sp.lon, lat: sp.lat })),
      (key, result) => {
        inflight.current.delete(key)
        useApp.getState().setComputed(key, result)
      },
    ).then(() => {
      needed.forEach((sp) => inflight.current.delete(computedKey(sp)))
    })
  }, [waterCompute, fairwayLines, fairwayAreas, userSpots, computed])

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
        className={`fab${mode === 'add-spot' ? ' active' : ''}`}
        aria-label={t.spots.addSpot}
        data-testid="add-spot"
        onClick={() => {
          const st = useApp.getState()
          if (st.mode === 'add-spot') {
            st.setMode('browse')
          } else {
            st.setMode('add-spot')
            st.setSheetPos('peek')
          }
        }}
      >
        {mode === 'add-spot' ? '×' : '+'}
      </button>
      {mode === 'add-spot' && (
        <div className="hint-pill" style={{ bottom: 'calc(50% - 20px)' }}>
          {t.spots.addHint}
        </div>
      )}
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
