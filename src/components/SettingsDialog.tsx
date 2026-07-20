import { useRef } from 'react'
import { useApp } from '../state/store'
import { buildExport, downloadJson, parseImport } from '../lib/io/exportImport'
import { dataDb } from '../lib/data/db'
import { t } from '../i18n/fi'

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const app = useApp.getState()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} data-testid="settings">
        <h2>{t.settings.title}</h2>
        <p className="muted small">{t.settings.boat}</p>
        <label>
          {t.settings.cruiseKn}
          <input
            type="number"
            min={1}
            max={40}
            value={settings.cruiseKn}
            onChange={(e) => app.setSettings({ cruiseKn: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          {t.settings.fuelLph}
          <input
            type="number"
            min={0}
            step={0.5}
            value={settings.fuelLph}
            onChange={(e) => app.setSettings({ fuelLph: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          {t.settings.fuelPrice}
          <input
            type="number"
            min={0}
            step={0.01}
            value={settings.fuelPriceEur}
            onChange={(e) => app.setSettings({ fuelPriceEur: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          {t.settings.basemap}
          <select
            value={settings.basemap}
            onChange={(e) => app.setSettings({ basemap: e.target.value as typeof settings.basemap })}
          >
            <option value="kartta">{t.settings.basemaps.kartta}</option>
            <option value="osm">{t.settings.basemaps.osm}</option>
            <option value="mml">{t.settings.basemaps.mml}</option>
            <option value="esri">{t.settings.basemaps.esri}</option>
          </select>
        </label>
        {settings.basemap === 'mml' && (
          <label>
            {t.settings.mmlKey}
            <input
              value={settings.mmlApiKey}
              onChange={(e) => app.setSettings({ mmlApiKey: e.target.value.trim() })}
              placeholder="xxxxxxxx-xxxx-…"
            />
            <span className="muted small">{t.settings.mmlKeyHint}</span>
          </label>
        )}
        <label className="row">
          <input
            type="checkbox"
            checked={settings.showWaterOutline}
            onChange={(e) => app.setSettings({ showWaterOutline: e.target.checked })}
          />
          {t.settings.showWaterOutline}
        </label>
        <label className="row">
          <input
            type="checkbox"
            data-testid="toggle-fairway-warn"
            checked={settings.warnNearFairway ?? false}
            onChange={(e) => app.setSettings({ warnNearFairway: e.target.checked })}
          />
          {t.settings.warnNearFairway}
        </label>

        <div className="btn-row">
          <button
            onClick={() => {
              const st = useApp.getState()
              downloadJson(
                buildExport(st.userSpots, st.settings),
                `paijanne-omat-${new Date().toISOString().slice(0, 10)}.json`,
              )
            }}
          >
            {t.settings.export}
          </button>
          <button onClick={() => fileRef.current?.click()}>{t.settings.import}</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                app.importUserData(parseImport(await file.text()))
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Tuonti epäonnistui')
              }
              e.target.value = ''
            }}
          />
        </div>
        <div className="btn-row">
          <button
            className="danger"
            onClick={async () => {
              await dataDb.clearAll()
              location.reload()
            }}
          >
            {t.settings.clearData}
          </button>
          <button className="primary" onClick={onClose}>
            {t.settings.close}
          </button>
        </div>
      </div>
    </div>
  )
}
