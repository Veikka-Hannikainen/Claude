# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Päijänne luonnonsatamat** — a Finnish-language PWA for finding natural harbours
(*luonnonsatamat*) on Lake Päijänne and judging how sheltered each one will be from
wind and waves over the next 5 days.

Hard constraints that shape every design decision here:

- **No backend.** Everything runs in the browser. User data lives in `localStorage`
  (via zustand `persist`), heavy geodata in IndexedDB (via `idb-keyval`).
- **Offline-capable.** Installable PWA; app shell, datasets and browsed map tiles work
  without network (the weather forecast does not).
- **Static hosting.** `vite.config.ts` uses `base: './'` so `dist/` works from any
  subpath. Deployed to GitHub Pages.
- **Not for navigation.** The app never claims to replace a nautical chart. Depths,
  rocks and shoals are not verified. Keep that framing in any UI text you add.

## Commands

```bash
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build  → dist/
npm run preview      # serve dist/ on :4173
npm test             # vitest, unit tests only (tests/unit/**)
npm run test:watch
npm run e2e          # Playwright; REQUIRES a fresh `npm run build` first (see below)
npm run data:fetch   # optional: pre-download datasets to public/data/
```

There is no linter or formatter configured. `tsc -b` (part of `npm run build`) is the
only static check — `strict`, `noUnusedLocals` and `noUnusedParameters` are all on, so
unused imports and parameters break the build.

### E2E gotchas

Both of these will bite you:

1. **Build first.** `playwright.config.ts` starts `npm run preview`, which serves
   `dist/`. Without a build, preview starts happily and serves **404 on every request** —
   the tests fail with confusing timeouts rather than a clear error.
2. **Browser path.** If Playwright's bundled Chromium build doesn't match what is
   installed, pass the binary explicitly — the config reads `PW_CHROMIUM_PATH`:

   ```bash
   npm run build
   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e
   ```

   Otherwise `npx playwright install chromium`.

Screenshots for docs are a separate opt-in run:
`SCREENSHOT_DIR=/tmp/shots npx playwright test -g screenshots`.

## Language conventions

The codebase is deliberately bilingual. Match what surrounds you:

| What | Language |
|---|---|
| UI strings | **Finnish**, centralised in `src/i18n/fi.ts` as the `t` object — never inline a user-visible string in a component |
| Code comments & JSDoc | **Finnish** |
| Commit messages | **Finnish**, imperative (`Korjaa…`, `Lisää…`, `Poista…`) |
| README | **Finnish** |
| Identifiers, file names | English |
| Test names (`describe`/`it`/`test`) | English |
| Domain values in types | Finnish where they are also displayed: `ShelterClass = 'suojassa' \| 'kohtalainen' \| 'altis'`, `SunsetOpenness = 'kyllä' \| 'osittain' \| 'ei'` |

Domain vocabulary worth knowing: *luonnonsatama* natural harbour, *fetch* open-water
distance, *väylä* fairway, *turvalaite* aid to navigation, *syvyyskäyrä* depth contour,
*rantaviiva* shoreline, *suoja* shelter, *puuska* gust, *jokamiehenoikeus* right of
public access, *seed*/*kuratoitu* the curated built-in spot list.

## Architecture

```
index.html → src/main.tsx → src/App.tsx
                              ├─ components/MapView.tsx      MapLibre map + markers (imperative, not React-rendered)
                              ├─ components/BottomSheet.tsx  mobile drag sheet / desktop floating card
                              │   └─ SpotList | SpotPanel (→ SpotForm, FetchRose, ShelterForecast)
                              └─ components/SettingsDialog.tsx

src/state/store.ts     single zustand store, the only cross-component state
src/lib/
  geo/       fetchRays (24-bearing fetch), osmRings (OSM relation → MultiPolygon),
             fairwayDistance, tm35 (WGS84 → EPSG:3067 + Karttapaikka link)
  shelter/   classify — wind + fetch → SMB wave height → shelter class
  sun/       sunsetOpenness — SunCalc azimuth vs. fetch rose
  weather/   openMeteo — 5-day hourly wind
  data/      bootstrap (orchestration), overpass (shoreline), vaylatiedot (fairways),
             buildings (private-shore check), refineSeeds (OSM name → coords), db (IndexedDB)
  compute/   compute.worker.ts + computeClient.ts + protocol.ts
  io/        exportImport — JSON round-trip of user data
src/data/spotsSeed.ts  ~48 curated spots (~29 marked `official`)
src/i18n/fi.ts         all UI copy
src/styles.css         all styling (plain CSS + custom properties, no framework)
```

### Data flow

1. `App.bootstrap()` calls `loadFromDb()` (IndexedDB), then `downloadMissing()`.
2. `downloadMissing()` prefers pre-baked `public/data/*.geojson` (written by
   `scripts/fetch-data.mjs`), falling back to live Overpass + Väylävirasto downloads.
   Results go into IndexedDB and the store; progress/errors surface via `DataBanner`.
3. Once `waterCompute` exists, an effect in `App.tsx` dispatches shelter analysis to the
   web worker for every spot missing a result.
4. Results land in `store.computed`, keyed by `computedKey(spot)`, and are persisted.
5. `SpotPanel` fetches the wind forecast on demand and combines it with the spot's fetch
   table in `classifyDays()`.

## Invariants — break these and things go subtly wrong

**`computedKey(spot)` = `` `${id}:${lat.toFixed(5)}:${lon.toFixed(5)}` ``.** Analysis
results are bound to a *coordinate*, not a spot id, so dragging a spot automatically
invalidates its cached analysis. Anything caching per-spot derived geodata (`computed`,
`buildingChecks`) must key on `computedKey`, never on `spot.id` alone.

**Two compute lanes, one init.** `computeSpots` (background, dispatched in chunks of 4)
and `computeSpotsPriority` (the selected spot, so it never queues behind background
batches) are separate workers. Datasets are shipped to a worker once via an `init`
message and re-sent only on identity change — keep the `compute` message payload small
and never inline geodata into it.

**Persisted state is versioned.** `store.ts` has `name: 'paijanne-v1'`, `version: 3`,
a `migrate` function and an explicit `partialize`. If you change the shape of anything
in `partialize`, bump `version` and extend `migrate`. Large datasets must **never** enter
`partialize` — localStorage cannot hold megabytes; they belong in `dataDb`.

**Seed spots are immutable.** `SEED_SPOTS` entries carry `seed: true` and have no
edit/delete path — the UI offers "Kopioi omaksi" instead. `seedCoordOverrides` from OSM
name refinement apply **only** when the spot still has an `osmName`; a spot with sourced
exact coordinates always wins (`seedSpotsWithOverrides`).

**Geometry limits are linked.** In `fetchRays.ts`, `CLIP_HALF_KM` must stay greater than
`FETCH_CAP_KM` (20 km), or the clipping box's artificial edges get counted as shoreline
and shorten rays. `BEARING_COUNT` is 24 (15° steps, index 0 = north) and the fetch array
length is assumed to match it in `classify.ts` and `sunsetOpenness.ts`.

**Points get snapped to water.** A spot digitised on the shore is moved to the nearest
water point (`snapToWater`, max 1.5 km); beyond that the result is flagged
`farFromWater` and the UI must suppress the analysis rather than show zeros. Map markers
render at `computed.snapped` when present, not at the raw coordinate.

**Test hooks are load-bearing.** `main.tsx` exposes `window.__appStore` and `MapView`
exposes `window.__map`. The E2E suite drives the app through both. Don't remove them.

**Status is never colour-only.** Shelter classes, badges and day chips always carry a
text label alongside the colour (`DayBadges` also sets `data-class`). Keep that when
adding indicators.

**MapLibre overlays re-add on style change.** Changing the basemap calls `map.setStyle()`,
which drops sources and layers; `addOverlays()` + `syncOverlayData()` run again from the
`style.load` handler. Any new overlay must be registered in `addOverlays()`, not added
ad hoc after init.

## External APIs and their quirks

| Service | Used for | Quirk to preserve |
|---|---|---|
| Overpass (`overpass-api.de`, `overpass.kumi.systems`) | shoreline relation, building check, name refinement | Two endpoints tried in order; failure is non-fatal for buildings/refinement |
| Väylävirasto OGC Features (`avoinapi.vaylapilvi.fi`) | fairway lines/areas, aids to navigation, depth contours | Collection ids are **discovered by regex** against `/collections` because the API's naming changes; paginated via `links[rel=next]` |
| Open-Meteo | 5-day hourly wind | Tries `models=metno_seamless` first, falls back to the default model; cached 1 h in the store, max 15 forecasts kept |
| MML / Esri / CARTO / OSM tiles | basemaps | MML aerial needs a user-supplied personal API key, stored only in the browser |

All of these are also mocked in `tests/e2e/app.spec.ts` via `page.route` — if you add or
change an outbound host, add a matching route there or the E2E suite will hang on live
network calls.

## Testing conventions

- **Unit tests** (`tests/unit/`, vitest, `environment: 'node'`) cover pure logic only:
  geometry, ring assembly, coordinate conversion, the SMB wave model, sunset openness.
  Assertions are anchored to physical sanity checks (e.g. 10 m/s over 10 km fetch ≈
  0.51 m Hs, 1° latitude ≈ 111 km). Keep new pure functions testable at this level.
- **E2E tests** (`tests/e2e/`) run against `desktop` (1280×800) and `mobile`
  (390×844, touch) projects with all network mocked from `tests/e2e/fixtures.ts` — a
  synthetic rectangular "Päijänne" with one island in the middle, and a steady 10 m/s
  westerly. Real seed spots land in water in that fixture, so tests can reference them
  by name.
- Service workers are **blocked** in Playwright (`serviceWorkers: 'block'`), otherwise
  the PWA's NetworkFirst caching intercepts `page.route` mocks.
- Select elements by `data-testid` (see `spot-list`, `spot-panel`, `spot-form`, `sheet`,
  `day-badges`, `analysis`, `landing`, `filter-*`, `feature-*`). Add a testid rather than
  relying on CSS classes when writing new UI that tests need to reach.

## Deployment

`.github/workflows/deploy.yml` runs on pushes to **`claude/paijanne-harbor-finder-6xnk9x`**
(the repo's working branch — there is no `main`) or via `workflow_dispatch`: `npm ci` →
`npm test` → `npm run build` → force-push `dist/` to the `gh-pages` branch. Unit tests
gate the deploy; E2E does not run in CI.

## Known drift

Worth knowing before you trust the docs or dead code:

- **`README.md` is partly stale.** It still documents route planning (`lib/route/`,
  distance/duration/fuel estimates, land-crossing warnings) and a nautical-chart basemap.
  Both were removed in `fd0a7cb` / `ea32288`; `src/lib/route/` does not exist. Update the
  README if you touch these areas.
- **Boat settings are vestigial.** `Settings.cruiseKn`, `fuelLph` and `fuelPriceEur` are
  still edited in `SettingsDialog` and persisted, but nothing consumes them since routing
  was removed. Removing them requires a persist `version` bump and `migrate` step.
- **`store.ts` migrate v3** rewrites the removed `'merikartta'` basemap to `'kartta'`;
  don't drop it while old installs may still exist.

## Working style

- Prefer editing `src/i18n/fi.ts` over hardcoding copy; prefer extending `src/styles.css`
  custom properties over introducing a styling dependency.
- Keep new heavy geometry work inside the worker (`compute.worker.ts`) — the main thread
  drives a full-screen map and must stay responsive.
- Curated spots need sourced coordinates: add `sourceLinks`, and set
  `coordsApproximate: true` (optionally `osmName`) when the position is a best guess.
- Commit in Finnish, on the branch you were assigned; do not push to `main`-like or
  `gh-pages` branches directly.
