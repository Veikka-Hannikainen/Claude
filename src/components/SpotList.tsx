import { useMemo, useState } from 'react'
import { computedKey, useAllSpots, useApp } from '../state/store'
import { sunsetAzimuthDeg, sunsetOpenness } from '../lib/sun/sunsetOpenness'
import { t } from '../i18n/fi'
import type { Spot, SpotComputed } from '../lib/types'

type Filter = 'all' | 'islands' | 'sheltered' | 'sunset'

/** Karkea suojaisuusmittari listajärjestykseen: mediaanifetch pienestä suureen */
function shelterScore(comp: SpotComputed | undefined): number {
  if (!comp) return Infinity
  const sorted = [...comp.fetchKm].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export default function SpotList() {
  const spots = useAllSpots()
  const computed = useApp((s) => s.computed)
  const app = useApp.getState()
  const [filter, setFilter] = useState<Filter>('all')

  const rows = useMemo(() => {
    let list: Spot[] = spots
    if (filter === 'islands') list = list.filter((s) => s.isIsland)
    if (filter === 'sheltered') {
      list = [...list].sort(
        (a, b) => shelterScore(computed[computedKey(a)]) - shelterScore(computed[computedKey(b)]),
      )
    }
    if (filter === 'sunset') {
      list = list.filter((s) => {
        const comp = computed[computedKey(s)]
        if (!comp) return false
        const az = sunsetAzimuthDeg(new Date(), s.lat, s.lon)
        return sunsetOpenness(comp.fetchKm, az) !== 'ei'
      })
    }
    return list
  }, [spots, computed, filter])

  return (
    <div className="panel-content" data-testid="spot-list">
      <div className="panel-head">
        <h2>{t.spots.listTitle}</h2>
        <div className="btn-row wrap">
          {(
            [
              ['all', t.spots.filterAll],
              ['islands', t.spots.filterIslands],
              ['sheltered', t.spots.filterSheltered],
              ['sunset', t.spots.filterSunset],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="spot-list">
        {rows.map((s) => {
          const comp = computed[computedKey(s)]
          return (
            <li key={s.id}>
              <button className="spot-row" onClick={() => app.selectSpot(s.id)}>
                <span className="ico">{s.isIsland ? '⛰' : '⚓'}</span>
                <span className="name">{s.name}</span>
                {comp?.nearFairway && <span className="badge bad small">{t.spots.nearFairway}</span>}
                {!s.seed && <span className="badge subtle small">oma</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        className="primary"
        data-testid="add-spot"
        onClick={() => {
          app.setMode('add-spot')
          app.selectSpot(null)
        }}
      >
        + {t.spots.addSpot}
      </button>
      {useApp.getState().mode === 'add-spot' && <p className="muted">{t.spots.addHint}</p>}
    </div>
  )
}
