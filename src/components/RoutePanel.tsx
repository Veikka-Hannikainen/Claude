import { useMemo } from 'react'
import { useApp } from '../state/store'
import { routeMetrics, formatDuration } from '../lib/route/metrics'
import { buildShoreIndex, checkLegs } from '../lib/geo/landCrossing'
import { t } from '../i18n/fi'

export default function RoutePanel() {
  const routes = useApp((s) => s.routes)
  const activeRouteId = useApp((s) => s.activeRouteId)
  const mode = useApp((s) => s.mode)
  const settings = useApp((s) => s.settings)
  const waterCompute = useApp((s) => s.waterCompute)
  const app = useApp.getState()
  const route = routes.find((r) => r.id === activeRouteId) ?? null

  const metrics = useMemo(
    () =>
      route ? routeMetrics(route.waypoints, settings.cruiseKn, settings.fuelLph, settings.fuelPriceEur) : null,
    [route, settings],
  )

  const legChecks = useMemo(() => {
    if (!route || !waterCompute || route.waypoints.length < 2) return []
    return checkLegs(waterCompute, buildShoreIndex(waterCompute), route.waypoints)
  }, [route, waterCompute])
  const crossing = legChecks.some((c) => c.crossesLand)

  const arrival =
    metrics && metrics.hours > 0
      ? new Date(Date.now() + metrics.hours * 3600_000).toLocaleTimeString('fi-FI', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  return (
    <div data-testid="route-panel">
      <div className="card-head">
        <button
          className="link back"
          onClick={() => {
            app.setMode('browse')
            app.setView(useApp.getState().selectedSpotId ? 'spot' : 'list')
          }}
        >
          ‹ {t.route.title}
        </button>
        <span className="spacer" />
        {routes.length > 1 && (
          <select
            style={{ width: 'auto', marginTop: 0 }}
            value={activeRouteId ?? ''}
            onChange={(e) => app.setActiveRoute(e.target.value || null)}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!route && (
        <>
          <p className="muted">{t.route.noRoute}</p>
          <button
            className="cta"
            data-testid="new-route"
            onClick={() => {
              const id = `route-${Date.now()}`
              app.addRoute({ id, name: `Reitti ${routes.length + 1}`, waypoints: [] })
              app.setMode('edit-route')
              app.setSheetPos('peek')
            }}
          >
            + {t.route.newRoute}
          </button>
        </>
      )}

      {route && metrics && (
        <>
          <input
            className="route-name"
            value={route.name}
            onChange={(e) => app.updateRoute(route.id, { name: e.target.value })}
          />
          <div className="route-hud" data-testid="route-metrics">
            <div className="big-time">{formatDuration(metrics.hours)}</div>
            <div className="meta-row">
              {arrival && (
                <>
                  {t.route.arrival} {arrival} ·{' '}
                </>
              )}
              {metrics.totalNm.toFixed(1)} {t.units.nm} · {metrics.fuelL.toFixed(0)} {t.units.l} (
              {metrics.fuelCostEur.toFixed(0)} {t.units.eur})
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              {route.waypoints.length} {t.route.waypoints} · {metrics.totalKm.toFixed(1)} {t.units.km}
            </p>
          </div>

          {crossing && (
            <p className="alert" data-testid="land-warning">
              ⚠ {t.route.landWarning}
              <br />
              {legChecks.map((c, i) =>
                c.crossesLand ? <span key={i}>{t.route.legCrossesLand(i + 1)} </span> : null,
              )}
            </p>
          )}

          <label className="slider">
            {t.route.speed}: {settings.cruiseKn} {t.units.kn}
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={settings.cruiseKn}
              onChange={(e) => app.setSettings({ cruiseKn: Number(e.target.value) })}
            />
          </label>
          {waterCompute && <p className="muted small">{t.route.shorelineCaveat}</p>}

          {mode === 'edit-route' ? (
            <button className="cta" onClick={() => app.setMode('browse')}>
              {t.route.done}
            </button>
          ) : (
            <button className="cta" onClick={() => { app.setMode('edit-route'); app.setSheetPos('peek') }}>
              {t.route.startEditing}
            </button>
          )}
          <div className="btn-row">
            <button
              className="danger"
              onClick={() => {
                app.removeRoute(route.id)
              }}
            >
              {t.route.remove}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
