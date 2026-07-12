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

  return (
    <div className="panel-content" data-testid="route-panel">
      <div className="panel-head">
        <h2>{t.route.title}</h2>
        {routes.length > 0 && (
          <select
            value={activeRouteId ?? ''}
            onChange={(e) => app.setActiveRoute(e.target.value || null)}
          >
            <option value="">—</option>
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
            className="primary"
            data-testid="new-route"
            onClick={() => {
              const id = `route-${Date.now()}`
              app.addRoute({ id, name: `Reitti ${routes.length + 1}`, waypoints: [] })
              app.setMode('edit-route')
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
          <p className="muted small">
            {route.waypoints.length} {t.route.waypoints}
            {mode === 'edit-route' && ` — ${t.route.editHint}`}
          </p>
          {crossing && (
            <p className="alert" data-testid="land-warning">
              ⚠ {t.route.landWarning}
              <br />
              {legChecks.map((c, i) => (c.crossesLand ? <span key={i}>{t.route.legCrossesLand(i + 1)} </span> : null))}
            </p>
          )}
          <dl className="metrics" data-testid="route-metrics">
            <div>
              <dt>{t.route.distance}</dt>
              <dd>
                {metrics.totalNm.toFixed(1)} {t.units.nm} ({metrics.totalKm.toFixed(1)} {t.units.km})
              </dd>
            </div>
            <div>
              <dt>
                {t.route.duration} @ {settings.cruiseKn} {t.units.kn}
              </dt>
              <dd>{formatDuration(metrics.hours)}</dd>
            </div>
            <div>
              <dt>{t.route.fuel}</dt>
              <dd>
                {metrics.fuelL.toFixed(0)} {t.units.l} · {metrics.fuelCostEur.toFixed(0)} {t.units.eur}
              </dd>
            </div>
          </dl>
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
          <div className="btn-row">
            {mode === 'edit-route' ? (
              <button className="primary" onClick={() => app.setMode('browse')}>
                {t.route.stopEditing}
              </button>
            ) : (
              <button className="primary" onClick={() => app.setMode('edit-route')}>
                {t.route.startEditing}
              </button>
            )}
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
