import { useState } from 'react'
import { useApp } from '../state/store'
import { t } from '../i18n/fi'
import type { Spot } from '../lib/types'

export default function SpotForm({ spot }: { spot: Spot }) {
  const app = useApp.getState()
  const [name, setName] = useState(spot.name)
  const [isIsland, setIsIsland] = useState(spot.isIsland)
  const [notes, setNotes] = useState(spot.notes ?? '')
  const [approach, setApproach] = useState(spot.approach ?? '')
  const [links, setLinks] = useState((spot.sourceLinks ?? []).join('\n'))

  return (
    <div className="panel-content" data-testid="spot-form">
      <h2>{t.spots.edit}</h2>
      <label>
        {t.spots.name}
        <input value={name} onChange={(e) => setName(e.target.value)} data-testid="spot-name" />
      </label>
      <label className="row">
        <input type="checkbox" checked={isIsland} onChange={(e) => setIsIsland(e.target.checked)} />
        {t.spots.island}
      </label>
      <label>
        {t.spots.notes}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label>
        {t.spots.approach}
        <textarea rows={2} value={approach} onChange={(e) => setApproach(e.target.value)} />
      </label>
      <label>
        {t.spots.sources} (yksi riville)
        <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} />
      </label>
      <p className="muted small">{t.spots.dragHint}</p>
      <div className="btn-row">
        <button
          className="primary"
          data-testid="spot-save"
          onClick={() => {
            app.updateSpot(spot.id, {
              name: name.trim() || spot.name,
              isIsland,
              notes: notes.trim() || undefined,
              approach: approach.trim() || undefined,
              sourceLinks: links
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
            })
            app.setEditingSpot(null)
          }}
        >
          {t.spots.save}
        </button>
        <button onClick={() => app.setEditingSpot(null)}>{t.spots.cancel}</button>
      </div>
    </div>
  )
}
