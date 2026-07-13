import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/store'
import { fetchWindForecast, FORECAST_CACHE_MS } from '../lib/weather/openMeteo'
import { classifyDays, type DayShelter } from '../lib/shelter/classify'
import { t } from '../i18n/fi'
import type { Spot, SpotComputed } from '../lib/types'

export function useShelterDays(spot: Spot | null, comp: SpotComputed | undefined) {
  const forecasts = useApp((s) => s.forecasts)
  const forecast = spot ? forecasts[spot.id] : undefined
  const fresh = forecast && Date.now() - forecast.fetchedAt < FORECAST_CACHE_MS
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!spot || fresh) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchWindForecast(spot.lat, spot.lon)
      .then((f) => {
        if (!cancelled) useApp.getState().setForecast(spot.id, f)
      })
      .catch(() => {
        if (!cancelled) setError(navigator.onLine ? t.forecast.error : t.forecast.offline)
      })
      // Ehdoton: cleanup voi ajaa ennen tätä, eikä lataustila saa jäädä päälle
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id, fresh])

  const days = useMemo(() => {
    if (!forecast || !comp) return null
    return classifyDays(forecast.hours, comp.fetchKm)
  }, [forecast, comp])

  return { days, loading, error, forecast }
}

/** 5 päivän suojabadget — luokka kulkee aina tekstin kanssa, ei pelkkänä värinä */
export function DayBadges({ days }: { days: DayShelter[] }) {
  return (
    <div className="day-badges" data-testid="day-badges">
      {days.slice(0, 5).map((d) => {
        const date = new Date(`${d.date}T12:00:00`)
        return (
          <div key={d.date} className={`day-badge ${d.worst}`} data-class={d.worst}>
            <span className="dow">{t.forecast.dayNames[date.getDay()]}</span>
            <span className="dom">
              {date.getDate()}.{date.getMonth() + 1}.
            </span>
            <span className="klass">{t.forecast.classes[d.worst]}</span>
            <span className="hs">
              ~{d.worstHs.toFixed(2)} {t.units.m}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Tuntikohtaiset raidat tuulinuolineen (Orca-tyylinen jana) */
export function HourStrips({ days }: { days: DayShelter[] }) {
  return (
    <div className="hour-strips">
      {days.slice(0, 5).map((d) => (
        <div key={d.date} className="hour-strip-row">
          <span className="date-lbl">{t.forecast.dayNames[new Date(`${d.date}T12:00:00`).getDay()]}</span>
          <div className="hour-strip">
            {d.hours.map((h) => (
              <span
                key={h.time}
                className={`hour ${h.klass}`}
                title={`${h.time.slice(11, 16)} — ${t.forecast.wind} ${h.windMs.toFixed(0)} ${t.units.ms} (${t.forecast.gusts} ${h.gustMs.toFixed(0)}), ${t.forecast.waveEst} ${h.hs.toFixed(2)} ${t.units.m}`}
              >
                <i className="arrow" style={{ transform: `rotate(${h.directionDeg + 180}deg)` }}>
                  ↑
                </i>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
