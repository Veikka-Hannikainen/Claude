import { useMemo, useState } from 'react'
import { computedKey, useAllSpots, useApp } from '../state/store'
import { sunsetAzimuthDeg, sunsetOpenness } from '../lib/sun/sunsetOpenness'
import { classifyHs, waveHeightM } from '../lib/shelter/classify'
import { FeatureIcon } from './FeatureIcons'
import { t } from '../i18n/fi'
import type { ShelterClass, Spot, SpotComputed } from '../lib/types'

type Filter = 'all' | 'favorites' | 'sauna' | 'laituri' | 'ankkurointi' | 'sheltered' | 'sunset'

/** Karkea suojaisuus listaan: mediaanifetch + 8 m/s referenssituuli → luokka */
function shelterClass(comp: SpotComputed | undefined): ShelterClass | null {
  if (!comp) return null
  const sorted = [...comp.fetchKm].sort((a, b) => a - b)
  const medianKm = sorted[Math.floor(sorted.length / 2)]
  return classifyHs(waveHeightM(8, medianKm * 1000))
}

function medianFetch(comp: SpotComputed | undefined): number {
  if (!comp) return Infinity
  const sorted = [...comp.fetchKm].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const FILTERS: [Filter, string][] = [
  ['all', t.spots.filterAll],
  ['favorites', t.spots.filterFavorites],
  ['sauna', t.features.sauna],
  ['laituri', t.features.laituri],
  ['ankkurointi', t.features.ankkurointi],
  ['sheltered', t.spots.filterSheltered],
  ['sunset', t.spots.filterSunset],
]

export default function SpotList() {
  const spots = useAllSpots()
  const computed = useApp((s) => s.computed)
  const favoriteIds = useApp((s) => s.favoriteIds)
  const [filter, setFilter] = useState<Filter>('all')
  const app = useApp.getState()

  const rows = useMemo(() => {
    let list: Spot[] = spots
    if (filter === 'favorites') list = list.filter((s) => favoriteIds.includes(s.id))
    if (filter === 'sauna' || filter === 'laituri' || filter === 'ankkurointi') {
      list = list.filter((s) => s.features?.includes(filter))
    }
    if (filter === 'sheltered') {
      list = [...list].sort(
        (a, b) => medianFetch(computed[computedKey(a)]) - medianFetch(computed[computedKey(b)]),
      )
    }
    if (filter === 'sunset') {
      list = list.filter((s) => {
        const comp = computed[computedKey(s)]
        if (!comp) return false
        return sunsetOpenness(comp.fetchKm, sunsetAzimuthDeg(new Date(), s.lat, s.lon)) !== 'ei'
      })
    }
    // Suosikit aina ensin
    return [...list].sort(
      (a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)),
    )
  }, [spots, computed, filter, favoriteIds])

  return (
    <div data-testid="spot-list">
      <div className="list-head">
        <h1>{t.spots.listTitle}</h1>
        <span className="count">{rows.length}</span>
      </div>
      <div className="chips-row">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            className={`chip${filter === f ? ' active' : ''}`}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="spot-list">
        {rows.map((s) => {
          const comp = computed[computedKey(s)]
          const klass = shelterClass(comp)
          const fav = favoriteIds.includes(s.id)
          return (
            <li key={s.id}>
              <button className="spot-row" onClick={() => app.selectSpot(s.id)}>
                <span className={`ico${s.official ? ' official' : ''}`}>
                  {s.isIsland ? '⛰' : '⚓'}
                </span>
                <span className="mid">
                  <span className="name">{s.name}</span>
                  {(s.features?.length || comp?.nearFairway) && (
                    <span className="feats">
                      {s.features?.slice(0, 5).map((f) => <FeatureIcon key={f} tag={f} />)}
                      {comp?.nearFairway && (
                        <span className="badge bad small">{t.spots.nearFairway}</span>
                      )}
                    </span>
                  )}
                </span>
                <span className="tail">
                  {klass && <span className={`shelter-dot ${klass}`} title={t.forecast.classes[klass]} />}
                  <span
                    className={`fav-star${fav ? ' on' : ''}`}
                    role="button"
                    aria-label={t.spots.favorite}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      app.toggleFavorite(s.id)
                    }}
                  >
                    ★
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && <p className="empty-note">{t.spots.empty}</p>}
    </div>
  )
}
