import type { Route, Settings, Spot } from '../types'

export interface ExportBlob {
  app: 'paijanne-luonnonsatamat'
  version: 1
  exportedAt: string
  userSpots: Spot[]
  routes: Route[]
  settings: Settings
}

export function buildExport(userSpots: Spot[], routes: Route[], settings: Settings): string {
  const blob: ExportBlob = {
    app: 'paijanne-luonnonsatamat',
    version: 1,
    exportedAt: new Date().toISOString(),
    userSpots,
    routes,
    settings,
  }
  return JSON.stringify(blob, null, 2)
}

export function downloadJson(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImport(text: string): Pick<ExportBlob, 'userSpots' | 'routes' | 'settings'> {
  const json = JSON.parse(text)
  if (json.app !== 'paijanne-luonnonsatamat') throw new Error('Tuntematon tiedostomuoto')
  return {
    userSpots: Array.isArray(json.userSpots) ? json.userSpots : [],
    routes: Array.isArray(json.routes) ? json.routes : [],
    settings: json.settings ?? {},
  }
}
