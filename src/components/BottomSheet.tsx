import { useEffect, useRef, type ReactNode } from 'react'
import { useApp, type SheetPos } from '../state/store'

const isMobile = () => window.matchMedia('(max-width: 720px)').matches

/** Sheetin näkyvä korkeus px per snap-asento (pidettävä synkassa CSS:n kanssa) */
function visibleHeights(): Record<SheetPos, number> {
  const vh = window.innerHeight
  return { peek: 132, half: vh * 0.46, full: vh * 0.92 }
}

/**
 * Mobiilissa raahattava bottom sheet kolmella snap-asennolla,
 * desktopissa kelluva kortti (CSS hoitaa asemoinnin).
 */
export default function BottomSheet({ children }: { children: ReactNode }) {
  const pos = useApp((s) => s.sheetPos)
  const view = useApp((s) => s.view)
  const selectedSpotId = useApp((s) => s.selectedSpotId)
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startVisible: number } | null>(null)

  // Näkymän tai valinnan vaihtuessa aloitetaan sisällön alusta
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [view, selectedSpotId])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handle = el.querySelector<HTMLElement>('.sheet-handle')
    if (!handle) return

    const onDown = (e: PointerEvent) => {
      if (!isMobile()) return
      drag.current = {
        startY: e.clientY,
        startVisible: visibleHeights()[useApp.getState().sheetPos],
      }
      el.classList.add('dragging')
      handle.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return
      const visible = drag.current.startVisible - (e.clientY - drag.current.startY)
      const vh = window.innerHeight
      const clamped = Math.max(60, Math.min(vh * 0.92, visible))
      el.style.height = `${clamped}px`
    }
    const onUp = (e: PointerEvent) => {
      if (!drag.current) return
      const visible = drag.current.startVisible - (e.clientY - drag.current.startY)
      drag.current = null
      el.classList.remove('dragging')
      el.style.height = ''
      // Snappaa lähimpään asentoon
      const h = visibleHeights()
      const best = (Object.entries(h) as [SheetPos, number][]).reduce((a, b) =>
        Math.abs(b[1] - visible) < Math.abs(a[1] - visible) ? b : a,
      )
      useApp.getState().setSheetPos(best[0])
    }

    handle.addEventListener('pointerdown', onDown)
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
    return () => {
      handle.removeEventListener('pointerdown', onDown)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div ref={ref} className={`sheet pos-${pos}`} data-testid="sheet">
      <div
        className="sheet-handle"
        data-testid="sheet-handle"
        onClick={() => {
          // Napautus kahvasta: peek → half → full → half
          const cur = useApp.getState().sheetPos
          useApp.getState().setSheetPos(cur === 'peek' ? 'half' : cur === 'half' ? 'full' : 'half')
        }}
      />
      <div className="sheet-body" ref={bodyRef}>{children}</div>
    </div>
  )
}
