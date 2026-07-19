import type { JSX } from 'react'
import type { FeatureTag } from '../lib/types'
import { t } from '../i18n/fi'

/** Minimalistiset viivaikonit palveluille (SF Symbols -henki, currentColor) */
const ICONS: Record<FeatureTag, JSX.Element> = {
  sauna: (
    <>
      <path d="M4 20v-8l8-6 8 6v8" />
      <path d="M9.5 12.5c-.8 1 .8 1.5 0 2.5M12.5 12.5c-.8 1 .8 1.5 0 2.5M15.5 12.5c-.8 1 .8 1.5 0 2.5" />
      <path d="M7 20h10" />
    </>
  ),
  laituri: (
    <>
      <path d="M2 10h20" />
      <path d="M5 10v7M12 10v7M19 10v7" />
      <path d="M2 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    </>
  ),
  ankkurointi: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2V20" />
      <path d="M7.5 10h9" />
      <path d="M5 14c0 4 3 6 7 6s7-2 7-6" />
    </>
  ),
  ravintola: (
    <>
      <path d="M7 3v7M5 3v4.5a2 2 0 0 0 4 0V3" />
      <path d="M7 12v9" />
      <path d="M16 3c-1.7 0-3 2-3 5s1.3 4 3 4V3z" />
      <path d="M16 12v9" />
    </>
  ),
  nuotiopaikka: (
    <>
      <path d="M12 4c1.8 2.6 4.5 4.4 4.5 8a4.5 4.5 0 0 1-9 0c0-2 1-3.4 2-4.6.3 1 .8 1.8 1.7 2.4C11 7.6 11.4 5.7 12 4z" />
      <path d="M5 21l14-4M19 21L5 17" />
    </>
  ),
  wc: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="4" />
      <path d="M7 10l1.4 4.5L10 10l1.4 4.5L13 10" strokeWidth="1.6" />
      <path d="M17.5 10.3a2.3 2.3 0 1 0 0 3.9" strokeWidth="1.6" />
    </>
  ),
  uimaranta: (
    <>
      <circle cx="17.5" cy="6.5" r="2.5" />
      <path d="M2 14c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
      <path d="M2 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    </>
  ),
  telttailu: (
    <>
      <path d="M12 4L3 20h18L12 4z" />
      <path d="M12 12l-3.5 8M12 12l3.5 8" />
    </>
  ),
  polku: (
    <>
      <path d="M5 20c6 0 2-6 8-6s2-8 6-8" strokeDasharray="2.6 2.8" />
      <circle cx="19" cy="5" r="1.4" />
      <circle cx="5" cy="20" r="1.4" />
    </>
  ),
}

export function FeatureIcon({ tag, size = 16 }: { tag: FeatureTag; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={t.features[tag]}
    >
      <title>{t.features[tag]}</title>
      {ICONS[tag]}
    </svg>
  )
}
