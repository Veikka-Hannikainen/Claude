import { useEffect, useMemo, useState } from 'react'
import { computedKey, findSpot, useApp } from '../state/store'
import { sunsetAzimuthDeg, sunsetOpenness } from '../lib/sun/sunsetOpenness'
import { checkBuildings } from '../lib/data/buildings'
import { karttapaikkaUrl } from '../lib/geo/tm35'
import { t } from '../i18n/fi'
import FetchRose from './FetchRose'
import SpotForm from './SpotForm'
import SpotList from './SpotList'
import { FeatureIcon } from './FeatureIcons'
import { DayBadges, HourStrips, useShelterDays } from './ShelterForecast'

export default function SpotPanel() {
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  const userSpots = useApp((s) => s.userSpots)
  const computed = useApp((s) => s.computed)
  const waterState = useApp((s) => s.waterState)
  const editingSpotId = useApp((s) => s.editingSpotId)
  const favoriteIds = useApp((s) => s.favoriteIds)
  const buildingChecks = useApp((s) => s.buildingChecks)
  const spot = findSpot(userSpots, selectedSpotId)

  const rawComp = spot ? computed[computedKey(spot)] : undefined
  /** Analyysi vain kun piste on oikeasti Päijänteellä */
  const comp = rawComp && !rawComp.farFromWater ? rawComp : undefined
  const sunset = useMemo(() => {
    if (!spot) return null
    const az = sunsetAzimuthDeg(new Date(), spot.lat, spot.lon)
    return { az, openness: comp ? sunsetOpenness(comp.fetchKm, az) : null }
  }, [spot, comp])
  const shelter = useShelterDays(spot, comp)

  // Yksityisranta-indikaattori: rakennukset lähistöllä (OSM), tulos cacheen
  const bCheck = spot ? buildingChecks[computedKey(spot)] : undefined
  const [bLoading, setBLoading] = useState(false)
  const [bError, setBError] = useState(false)
  useEffect(() => {
    if (!spot || bCheck) return
    let cancelled = false
    setBLoading(true)
    setBError(false)
    const key = computedKey(spot)
    checkBuildings(spot.lat, spot.lon)
      .then((c) => {
        if (!cancelled) useApp.getState().setBuildingCheck(key, c)
      })
      .catch(() => {
        if (!cancelled) setBError(true)
      })
      .finally(() => setBLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id, spot?.lat, spot?.lon, bCheck])

  if (!spot) return <SpotList />
  if (editingSpotId === spot.id) return <SpotForm spot={spot} />

  const app = useApp.getState()
  const fav = favoriteIds.includes(spot.id)
  return (
    <div data-testid="spot-panel">
      <div className="card-head">
        <button className="link back" onClick={() => app.selectSpot(null)}>
          ‹ {t.spots.listTitle}
        </button>
        <span className="spacer" />
        <span
          className={`fav-star${fav ? ' on' : ''}`}
          role="button"
          data-testid="fav-toggle"
          aria-label={t.spots.favorite}
          aria-pressed={fav}
          onClick={() => app.toggleFavorite(spot.id)}
        >
          ★
        </span>
      </div>
      <div className="panel-head">
        <h1>{spot.name}</h1>
        <div className="badges">
          <span className="badge">{spot.isIsland ? t.spots.island : t.spots.mainland}</span>
          {!spot.seed && <span className="badge">{t.spots.ownBadge}</span>}
          {spot.coordsApproximate && <span className="badge warn">{t.spots.approxBadge}</span>}
          {rawComp?.farFromWater && <span className="badge warn">{t.spots.farFromWater}</span>}
          {comp?.nearFairway && <span className="badge bad">{t.spots.nearFairway}</span>}
          {sunset?.openness && (
            <span className={`badge ${sunset.openness === 'kyllä' ? 'ok' : sunset.openness === 'osittain' ? 'warn' : ''}`}>
              {t.spots.sunset}: {t.spots.sunsetOpen[sunset.openness]}
            </span>
          )}
        </div>
        {spot.features && spot.features.length > 0 && (
          <div className="feat-chips" data-testid="feature-chips">
            {spot.features.map((f) => (
              <span key={f} className="feat-chip">
                <FeatureIcon tag={f} />
                {t.features[f]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5 vrk tuulensuoja suoraan kortissa */}
      {rawComp?.farFromWater ? null : shelter.days ? (
        <DayBadges days={shelter.days} />
      ) : shelter.loading ? (
        <p className="muted small">{t.forecast.loading}</p>
      ) : shelter.error ? (
        <p className="alert">{shelter.error}</p>
      ) : !comp && waterState.status !== 'ready' ? (
        <p className="muted small">{t.forecast.needsCompute}</p>
      ) : (
        <p className="muted small">{t.spots.computing}</p>
      )}

      {/* Rantautuminen: yksityisranta-indikaattori + jokamiehenoikeudet */}
      <section className="block" data-testid="landing">
        <h3>{t.spots.landing}</h3>
        <div className="badges">
          {bCheck ? (
            bCheck.distM === null ? (
              <span className="badge ok">{t.spots.buildingsNone(bCheck.radiusM)}</span>
            ) : bCheck.distM < 150 ? (
              <span className="badge bad">{t.spots.buildingsNear(bCheck.distM)}</span>
            ) : (
              <span className="badge warn">{t.spots.buildingsSome(bCheck.distM)}</span>
            )
          ) : bLoading ? (
            <span className="badge">{t.spots.buildingsChecking}</span>
          ) : bError ? (
            <span className="badge">{t.spots.buildingsError}</span>
          ) : null}
        </div>
        <p className="muted small">{t.spots.everymansRights}</p>
        <a className="link" href={karttapaikkaUrl(spot.lat, spot.lon)} target="_blank" rel="noreferrer">
          {t.spots.checkOwnership} ›
        </a>
      </section>

      {spot.notes && (
        <section className="block">
          <h3>{t.spots.notes}</h3>
          <p>{spot.notes}</p>
        </section>
      )}
      {spot.approach && (
        <section className="block">
          <h3>{t.spots.approach}</h3>
          <p>{spot.approach}</p>
        </section>
      )}

      <details className="block" data-testid="analysis">
        <summary>{t.spots.analysis}</summary>
        <div className="block-body">
          {comp ? (
            <>
              <FetchRose fetchKm={comp.fetchKm} sunsetAzimuth={sunset?.az} />
              {comp.fairwayDistM != null && (
                <p className="kv">
                  {t.spots.fairwayDist}:{' '}
                  <strong>
                    {comp.fairwayDistM >= 5000 ? `${t.spots.over} 5 km` : `${comp.fairwayDistM} m`}
                  </strong>
                </p>
              )}
              {shelter.days && <HourStrips days={shelter.days} />}
              {shelter.forecast && (
                <p className="muted small">
                  {t.forecast.updated}{' '}
                  {new Date(shelter.forecast.fetchedAt).toLocaleTimeString('fi-FI', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              {rawComp?.farFromWater
                ? t.spots.farFromWater
                : waterState.status === 'ready'
                  ? t.spots.computing
                  : t.spots.needsWater}
            </p>
          )}
        </div>
      </details>

      {(spot.sourceLinks?.length || spot.photoLinks?.length) ? (
        <details className="block">
          <summary>{t.spots.sources}</summary>
          <div className="block-body">
            <ul className="links">
              {[...(spot.sourceLinks ?? []), ...(spot.photoLinks ?? [])].map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {new URL(url).hostname}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <button
        className="cta"
        onClick={() => {
          const id = `route-${Date.now()}`
          app.addRoute({ id, name: spot.name, waypoints: [{ lat: spot.lat, lon: spot.lon }] })
          app.setMode('edit-route')
          app.setView('route')
          app.setSheetPos('peek')
        }}
      >
        {t.route.toSpot}
      </button>
      <div className="btn-row">
        {!spot.seed ? (
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
        ) : (
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
    </div>
  )
}
