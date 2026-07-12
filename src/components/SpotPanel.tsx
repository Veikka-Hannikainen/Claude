import { useMemo } from 'react'
import { computedKey, findSpot, useApp } from '../state/store'
import { sunsetAzimuthDeg, sunsetOpenness } from '../lib/sun/sunsetOpenness'
import { t } from '../i18n/fi'
import FetchRose from './FetchRose'
import SpotForm from './SpotForm'
import SpotList from './SpotList'

export default function SpotPanel() {
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  const userSpots = useApp((s) => s.userSpots)
  const computed = useApp((s) => s.computed)
  const waterState = useApp((s) => s.waterState)
  const editingSpotId = useApp((s) => s.editingSpotId)
  const spot = findSpot(userSpots, selectedSpotId)

  const comp = spot ? computed[computedKey(spot)] : undefined
  const sunset = useMemo(() => {
    if (!spot) return null
    const az = sunsetAzimuthDeg(new Date(), spot.lat, spot.lon)
    return { az, openness: comp ? sunsetOpenness(comp.fetchKm, az) : null }
  }, [spot, comp])

  if (!spot) return <SpotList />
  if (editingSpotId === spot.id) return <SpotForm spot={spot} />

  const app = useApp.getState()
  return (
    <div className="panel-content" data-testid="spot-panel">
      <div className="panel-head">
        <button className="link" onClick={() => app.selectSpot(null)}>
          ‹ {t.spots.listTitle}
        </button>
        <h2>{spot.name}</h2>
        <div className="badges">
          <span className="badge">{spot.isIsland ? t.spots.island : t.spots.mainland}</span>
          {spot.seed && <span className="badge subtle">{t.spots.seedBadge}</span>}
          {spot.coordsApproximate && <span className="badge warn">{t.spots.approxBadge}</span>}
          {comp?.nearFairway && <span className="badge bad">{t.spots.nearFairway}</span>}
          {sunset?.openness && (
            <span className={`badge ${sunset.openness === 'kyllä' ? 'ok' : sunset.openness === 'osittain' ? 'warn' : 'subtle'}`}>
              {t.spots.sunset}: {t.spots.sunsetOpen[sunset.openness]}
            </span>
          )}
        </div>
      </div>

      {comp ? (
        <>
          <FetchRose fetchKm={comp.fetchKm} sunsetAzimuth={sunset?.az} />
          {comp.fairwayDistM != null && (
            <p className="kv">
              {t.spots.fairwayDist}: <strong>{comp.fairwayDistM >= 5000 ? `${t.spots.over} 5 km` : `${comp.fairwayDistM} m`}</strong>
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          {waterState.status === 'ready' ? t.spots.computing : t.spots.needsWater}
        </p>
      )}

      {spot.notes && (
        <section>
          <h3>{t.spots.notes}</h3>
          <p>{spot.notes}</p>
        </section>
      )}
      {spot.approach && (
        <section>
          <h3>{t.spots.approach}</h3>
          <p>{spot.approach}</p>
        </section>
      )}
      {(spot.sourceLinks?.length || spot.photoLinks?.length) ? (
        <section>
          <h3>{t.spots.sources}</h3>
          <ul className="links">
            {[...(spot.sourceLinks ?? []), ...(spot.photoLinks ?? [])].map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {new URL(url).hostname}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="btn-row">
        <button onClick={() => app.setTab('forecast')}>{t.forecast.title}</button>
        <button
          onClick={() => {
            const id = `route-${Date.now()}`
            app.addRoute({ id, name: spot.name, waypoints: [{ lat: spot.lat, lon: spot.lon }] })
            app.setMode('edit-route')
            app.setTab('route')
          }}
        >
          {t.route.toSpot}
        </button>
      </div>
      <div className="btn-row">
        {!spot.seed && (
          <>
            <button onClick={() => app.setEditingSpot(spot.id)}>{t.spots.edit}</button>
            <button
              className="danger"
              onClick={() => {
                if (confirm(t.spots.confirmRemove)) app.removeSpot(spot.id)
              }}
            >
              {t.spots.remove}
            </button>
          </>
        )}
        {spot.seed && (
          <button
            onClick={() => {
              const id = `own-${Date.now()}`
              app.addSpot({ ...spot, id, seed: false, name: `${spot.name} (oma)` })
              app.selectSpot(id)
              app.setEditingSpot(id)
            }}
          >
            {t.spots.copyToOwn}
          </button>
        )}
      </div>
      {!spot.seed && editingSpotId !== spot.id && <p className="muted small">{t.spots.dragHint}</p>}
    </div>
  )
}
