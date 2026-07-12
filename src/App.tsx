import { useEffect, useRef, useState } from 'react'
import MapView from './components/MapView'
import SpotPanel from './components/SpotPanel'
import RoutePanel from './components/RoutePanel'
import ForecastPanel from './components/ForecastPanel'
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
  const tab = useApp((s) => s.tab)
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
    <div className="app">
      <header className="topbar">
        <h1>{t.appName}</h1>
        <button className="icon-btn" aria-label={t.settings.title} onClick={() => setShowSettings(true)}>
          ⚙
        </button>
      </header>
      <div className="main">
        <div className="map-wrap">
          <DataBanner
            onRetry={() => {
              void bootstrap()
            }}
          />
          <MapView />
        </div>
        <aside className="panel">
          <nav className="tabs">
            {(
              [
                ['spot', t.tabs.spot],
                ['route', t.tabs.route],
                ['forecast', t.tabs.forecast],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                data-testid={`tab-${id}`}
                onClick={() => useApp.getState().setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === 'spot' && <SpotPanel />}
          {tab === 'route' && <RoutePanel />}
          {tab === 'forecast' && <ForecastPanel />}
        </aside>
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
