import { useApp } from '../state/store'
import { t } from '../i18n/fi'

/** Näyttää aineistojen lataustilan ja virheet kartan yllä */
export default function DataBanner({ onRetry }: { onRetry: () => void }) {
  const waterState = useApp((s) => s.waterState)
  const fairwayState = useApp((s) => s.fairwayState)

  if (waterState.status === 'ready' && fairwayState.status !== 'error') return null

  return (
    <div className="data-banner" data-testid="data-banner">
      {waterState.status === 'downloading' && (
        <span>⏳ {waterState.progress ?? t.data.waterDownloading}</span>
      )}
      {waterState.status === 'error' && (
        <span className="err">
          ⚠ {t.data.waterError}: {waterState.message}{' '}
          <button className="link" onClick={onRetry}>
            {t.data.retry}
          </button>
        </span>
      )}
      {waterState.status === 'missing' && <span>{t.data.waterMissing}</span>}
      {fairwayState.status === 'error' && <span className="err">⚠ {t.data.fairwayError}</span>}
    </div>
  )
}
