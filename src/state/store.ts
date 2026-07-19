import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_SPOTS } from '../data/spotsSeed'
import type { BuildingCheck } from '../lib/data/buildings'
import type { CoordOverride } from '../lib/data/refineSeeds'
import type { DepthContours, SafetyDevices } from '../lib/types'
import {
  DEFAULT_SETTINGS,
  type DatasetState,
  type FairwayAreas,
  type FairwayLines,
  type Route,
  type Settings,
  type Spot,
  type SpotComputed,
  type WaterPolygon,
  type WindForecast,
} from '../lib/types'

export type Mode = 'browse' | 'edit-route'
/** Sheetin näkymä: lista → paikkakortti → reittieditori */
export type View = 'list' | 'spot' | 'route'
export type SheetPos = 'peek' | 'half' | 'full'

/** Laskentatulos sidotaan koordinaattiin — spotin siirto mitätöi tuloksen */
export function computedKey(spot: Pick<Spot, 'id' | 'lat' | 'lon'>): string {
  return `${spot.id}:${spot.lat.toFixed(5)}:${spot.lon.toFixed(5)}`
}

interface AppState {
  // Aineistot (ei persistoida — IndexedDB säilöö raskaan datan)
  waterCompute: WaterPolygon | null
  waterRender: WaterPolygon | null
  fairwayLines: FairwayLines | null
  fairwayAreas: FairwayAreas | null
  safetyDevices: SafetyDevices | null
  depthContours: DepthContours | null
  waterState: DatasetState
  fairwayState: DatasetState
  setData: (
    d: Partial<
      Pick<
        AppState,
        | 'waterCompute'
        | 'waterRender'
        | 'fairwayLines'
        | 'fairwayAreas'
        | 'safetyDevices'
        | 'depthContours'
      >
    >,
  ) => void
  setWaterState: (s: DatasetState) => void
  setFairwayState: (s: DatasetState) => void

  // Käyttäjän data (persistoidaan localStorageen)
  userSpots: Spot[]
  computed: Record<string, SpotComputed>
  routes: Route[]
  settings: Settings
  forecasts: Record<string, WindForecast>
  favoriteIds: string[]
  /** Rakennukset lähistöllä -tarkistukset (avain = computedKey) */
  buildingChecks: Record<string, BuildingCheck>
  /** OSM-nimellä tarkennetut seed-sijainnit */
  seedCoordOverrides: Record<string, CoordOverride>

  setBuildingCheck: (key: string, check: BuildingCheck) => void
  addSeedCoordOverrides: (o: Record<string, CoordOverride>) => void
  toggleFavorite: (id: string) => void
  addSpot: (spot: Spot) => void
  updateSpot: (id: string, patch: Partial<Spot>) => void
  removeSpot: (id: string) => void
  setComputed: (key: string, value: SpotComputed) => void
  addRoute: (route: Route) => void
  updateRoute: (id: string, patch: Partial<Route>) => void
  removeRoute: (id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  setForecast: (spotId: string, f: WindForecast) => void
  importUserData: (data: { userSpots?: Spot[]; routes?: Route[]; settings?: Partial<Settings> }) => void

  // UI-tila
  selectedSpotId: string | null
  activeRouteId: string | null
  mode: Mode
  view: View
  sheetPos: SheetPos
  editingSpotId: string | null
  /** Kertaluonteinen kartan lento kohteeseen (ei persistoida) */
  flyTarget: { lon: number; lat: number; zoom: number; ts: number } | null
  flyTo: (lon: number, lat: number, zoom?: number) => void
  selectSpot: (id: string | null) => void
  setActiveRoute: (id: string | null) => void
  setMode: (m: Mode) => void
  setView: (v: View) => void
  setSheetPos: (p: SheetPos) => void
  setEditingSpot: (id: string | null) => void
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      waterCompute: null,
      waterRender: null,
      fairwayLines: null,
      fairwayAreas: null,
      safetyDevices: null,
      depthContours: null,
      waterState: { status: 'missing' },
      fairwayState: { status: 'missing' },
      setData: (d) => set(d),
      setWaterState: (waterState) => set({ waterState }),
      setFairwayState: (fairwayState) => set({ fairwayState }),

      userSpots: [],
      computed: {},
      routes: [],
      settings: DEFAULT_SETTINGS,
      forecasts: {},
      favoriteIds: [],
      buildingChecks: {},
      seedCoordOverrides: {},

      setBuildingCheck: (key, check) =>
        set((s) => ({ buildingChecks: { ...s.buildingChecks, [key]: check } })),
      addSeedCoordOverrides: (o) =>
        set((s) => ({ seedCoordOverrides: { ...s.seedCoordOverrides, ...o } })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((f) => f !== id)
            : [...s.favoriteIds, id],
        })),
      addSpot: (spot) => set((s) => ({ userSpots: [...s.userSpots, spot] })),
      updateSpot: (id, patch) =>
        set((s) => ({
          userSpots: s.userSpots.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)),
        })),
      removeSpot: (id) =>
        set((s) => ({
          userSpots: s.userSpots.filter((sp) => sp.id !== id),
          favoriteIds: s.favoriteIds.filter((f) => f !== id),
          selectedSpotId: s.selectedSpotId === id ? null : s.selectedSpotId,
          view: s.selectedSpotId === id ? 'list' : s.view,
        })),
      setComputed: (key, value) => set((s) => ({ computed: { ...s.computed, [key]: value } })),
      addRoute: (route) => set((s) => ({ routes: [...s.routes, route], activeRouteId: route.id })),
      updateRoute: (id, patch) =>
        set((s) => ({ routes: s.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeRoute: (id) =>
        set((s) => ({
          routes: s.routes.filter((r) => r.id !== id),
          activeRouteId: s.activeRouteId === id ? null : s.activeRouteId,
          mode: s.activeRouteId === id && s.mode === 'edit-route' ? 'browse' : s.mode,
          view: s.activeRouteId === id && s.view === 'route' ? 'list' : s.view,
        })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setForecast: (spotId, f) =>
        set((s) => {
          // Pidä enintään 15 tuoreinta ennustetta
          const entries = Object.entries({ ...s.forecasts, [spotId]: f })
          entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
          return { forecasts: Object.fromEntries(entries.slice(0, 15)) }
        }),
      importUserData: (data) =>
        set((s) => ({
          userSpots: data.userSpots ?? s.userSpots,
          routes: data.routes ?? s.routes,
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
        })),

      selectedSpotId: null,
      activeRouteId: null,
      mode: 'browse',
      view: 'list',
      sheetPos: 'half',
      editingSpotId: null,
      flyTarget: null,
      flyTo: (lon, lat, zoom = 16) => set({ flyTarget: { lon, lat, zoom, ts: Date.now() } }),
      selectSpot: (selectedSpotId) =>
        set((s) => ({
          selectedSpotId,
          view: selectedSpotId ? 'spot' : s.view === 'spot' ? 'list' : s.view,
          // Kartalta valittu paikka nostaa peek-sheetin näkyviin
          sheetPos: selectedSpotId && s.sheetPos === 'peek' ? 'half' : s.sheetPos,
          editingSpotId: null,
        })),
      setActiveRoute: (activeRouteId) => set({ activeRouteId }),
      setMode: (mode) => set({ mode }),
      setView: (view) => set({ view }),
      setSheetPos: (sheetPos) => set({ sheetPos }),
      setEditingSpot: (editingSpotId) => set({ editingSpotId }),
    }),
    {
      name: 'paijanne-v1',
      version: 2,
      migrate: (persisted: unknown) => {
        // v2: merikartta uudeksi oletuspohjaksi käyttäjille, jotka eivät ole
        // itse vaihtaneet pohjaa (vanha oletus oli 'kartta')
        const state = persisted as { settings?: { basemap?: string } } | undefined
        if (state?.settings?.basemap === 'kartta') state.settings.basemap = 'merikartta'
        return state
      },
      partialize: (s) => ({
        userSpots: s.userSpots,
        computed: s.computed,
        routes: s.routes,
        settings: s.settings,
        forecasts: s.forecasts,
        favoriteIds: s.favoriteIds,
        buildingChecks: s.buildingChecks,
        seedCoordOverrides: s.seedCoordOverrides,
        activeRouteId: s.activeRouteId,
      }),
    },
  ),
)

/** Seed-spotit OSM-nimitarkennukset huomioiden. Override pätee vain jos
 *  spotilla on yhä osmName — muuten seedin lähteistetty tarkka sijainti voittaa
 *  (vanha selaimeen tallennettu tarkennus voisi muuten ylikirjoittaa sen). */
export function seedSpotsWithOverrides(overrides: Record<string, CoordOverride>): Spot[] {
  return SEED_SPOTS.map((s) => {
    const o = s.osmName ? overrides[s.id] : undefined
    if (!o) return s
    return { ...s, lat: o.lat, lon: o.lon, coordsApproximate: false }
  })
}

export function useAllSpots(): Spot[] {
  const userSpots = useApp((s) => s.userSpots)
  const overrides = useApp((s) => s.seedCoordOverrides)
  return [...seedSpotsWithOverrides(overrides), ...userSpots]
}

export function findSpot(userSpots: Spot[], id: string | null): Spot | null {
  if (!id) return null
  const overrides = useApp.getState().seedCoordOverrides
  return (
    seedSpotsWithOverrides(overrides).find((s) => s.id === id) ??
    userSpots.find((s) => s.id === id) ??
    null
  )
}
