import { BEARING_COUNT, BEARING_STEP, FETCH_CAP_KM } from '../lib/types'
import { t } from '../i18n/fi'

const SIZE = 220
const C = SIZE / 2
const R_MIN = 14
const R_MAX = 96

function wedgePath(bearingDeg: number, r: number): string {
  const half = BEARING_STEP / 2 - 1
  const a0 = ((bearingDeg - half - 90) * Math.PI) / 180
  const a1 = ((bearingDeg + half - 90) * Math.PI) / 180
  const x0 = C + r * Math.cos(a0)
  const y0 = C + r * Math.sin(a0)
  const x1 = C + r * Math.cos(a1)
  const y1 = C + r * Math.sin(a1)
  return `M ${C} ${C} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`
}

/** Sekventiaalinen sininen ramppi: vaalea = lyhyt fetch (suojainen), tumma = pitkä (altis) */
function fetchColor(km: number): string {
  if (km < 0.5) return 'var(--rose-1)'
  if (km < 2) return 'var(--rose-2)'
  if (km < 8) return 'var(--rose-3)'
  return 'var(--rose-4)'
}

/** 24-sektorinen ruusu: sektorin pituus = avoin vesimatka siihen suuntaan */
export default function FetchRose({
  fetchKm,
  sunsetAzimuth,
}: {
  fetchKm: number[]
  sunsetAzimuth?: number
}) {
  const wedges = fetchKm.slice(0, BEARING_COUNT).map((km, i) => {
    const frac = Math.sqrt(Math.min(km, FETCH_CAP_KM) / FETCH_CAP_KM)
    const r = R_MIN + (R_MAX - R_MIN) * frac
    return { d: wedgePath(i * BEARING_STEP, r), fill: fetchColor(km), km, bearing: i * BEARING_STEP }
  })
  const sunset =
    sunsetAzimuth == null
      ? null
      : {
          x: C + (R_MAX + 8) * Math.cos(((sunsetAzimuth - 90) * Math.PI) / 180),
          y: C + (R_MAX + 8) * Math.sin(((sunsetAzimuth - 90) * Math.PI) / 180),
        }
  return (
    <figure className="fetch-rose">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t.spots.fetchRose}>
        <circle cx={C} cy={C} r={R_MAX} fill="none" stroke="currentColor" opacity={0.15} />
        <circle cx={C} cy={C} r={R_MIN + (R_MAX - R_MIN) * Math.sqrt(2 / FETCH_CAP_KM)} fill="none" stroke="currentColor" opacity={0.12} strokeDasharray="3 3" />
        {wedges.map((w) => (
          <path key={w.bearing} d={w.d} fill={w.fill} opacity={0.85}>
            <title>{`${w.bearing}°: ${w.km >= FETCH_CAP_KM ? `${t.spots.over} ${FETCH_CAP_KM}` : w.km} km`}</title>
          </path>
        ))}
        {(['P', 'I', 'E', 'L'] as const).map((label, i) => {
          const a = ((i * 90 - 90) * Math.PI) / 180
          return (
            <text
              key={label}
              x={C + (R_MAX + 14) * Math.cos(a)}
              y={C + (R_MAX + 14) * Math.sin(a) + 4}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              opacity={0.7}
            >
              {label}
            </text>
          )
        })}
        {sunset && (
          <g>
            <line x1={C} y1={C} x2={sunset.x} y2={sunset.y} stroke="#eb6834" strokeWidth={1.5} strokeDasharray="4 3" />
            <circle cx={sunset.x} cy={sunset.y} r={5} fill="#eb6834">
              <title>{t.spots.sunset}</title>
            </circle>
          </g>
        )}
      </svg>
      <figcaption>{t.spots.fetchRoseHint}</figcaption>
    </figure>
  )
}
