import { expect, test, type Page } from '@playwright/test'
import {
  fairwayAreasFixture,
  fairwayLinesFixture,
  nameRefineFixture,
  ogcCollectionsFixture,
  openMeteoFixture,
  overpassFixture,
} from './fixtures'

/** 1×1 läpinäkyvä PNG karttatiiliksi */
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function mockNetwork(page: Page) {
  await page.route(/overpass/, (route) => {
    // Sama endpoint palvelee rantaviivan, rakennustarkistuksen ja nimitarkennuksen
    const body = decodeURIComponent((route.request().postData() ?? '').replace(/\+/g, ' '))
    if (body.includes('building')) return route.fulfill({ json: { elements: [] } })
    if (body.includes('out geom'))
      return route.fulfill({ json: overpassFixture, contentType: 'application/json' })
    if (body.includes('out center tags')) return route.fulfill({ json: nameRefineFixture })
    return route.fulfill({ json: { elements: [] } })
  })
  await page.route(/avoinapi\.vaylapilvi\.fi.*\/collections\?/, (route) =>
    route.fulfill({ json: ogcCollectionsFixture }),
  )
  await page.route(/avoinapi\.vaylapilvi\.fi.*vaylat_uusi/, (route) =>
    route.fulfill({ json: fairwayLinesFixture }),
  )
  await page.route(/avoinapi\.vaylapilvi\.fi.*vaylaalueet_uusi/, (route) =>
    route.fulfill({ json: fairwayAreasFixture }),
  )
  await page.route(/api\.open-meteo\.com/, (route) => route.fulfill({ json: openMeteoFixture() }))
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com|arcgisonline\.com|maanmittauslaitos\.fi/, (route) =>
    route.fulfill({ body: TILE, contentType: 'image/png' }),
  )
}

declare global {
  interface Window {
    __appStore: {
      getState: () => any
      setState: (s: any) => void
    }
  }
}

test.beforeEach(async ({ page }) => {
  await mockNetwork(page)
  await page.goto('/')
})

async function waitForWater(page: Page) {
  await page.waitForFunction(
    () => window.__appStore?.getState().waterState.status === 'ready',
    undefined,
    { timeout: 30_000 },
  )
}

/** Karttaklikkaus näkyvälle vesialueelle (sheetin ja kontrollien ulkopuolelle) */
async function clickMap(page: Page) {
  const vp = page.viewportSize()!
  await page.getByTestId('map').click({ position: { x: Math.round(vp.width * 0.4), y: 230 } })
}

test('app loads, downloads data and lists curated spots in the sheet', async ({ page }) => {
  await expect(page.getByTestId('map')).toBeVisible()
  await expect(page.getByTestId('sheet')).toBeVisible()
  await expect(page.getByTestId('spot-list')).toBeVisible()
  await expect(page.getByTestId('spot-list').getByText('Kelvenne · Kirkkosalmi')).toBeVisible()
  await waitForWater(page)
  // Banneri poistuu kun vesi + väylät ovat valmiit
  await expect(page.getByTestId('data-banner')).toHaveCount(0)
})

test('spot card shows day badges, analysis disclosure with rose and fairway distance', async ({
  page,
}) => {
  await waitForWater(page)
  await page.getByTestId('spot-list').getByText('Kelvenne · Kirkkosalmi').click()
  await expect(page.getByTestId('spot-panel')).toBeVisible()
  // 5 vrk suojaennuste haetaan automaattisesti kortille
  await expect(page.getByTestId('day-badges')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Auringonlasku:/)).toBeVisible()
  // Palveluikonit näkyvät
  await expect(
    page.getByTestId('feature-chips').locator('.feat-chip', { hasText: 'Nuotiopaikka' }),
  ).toBeVisible()
  // Suoja-analyysi aukeaa disclosuresta
  await page.getByTestId('analysis').locator('summary').click()
  await expect(page.locator('.fetch-rose svg path').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Etäisyys väylään/)).toBeVisible()
})

test('natural harbor shows building check and Karttapaikka link, official spot does not', async ({
  page,
}) => {
  await waitForWater(page)
  // Karhunkämmen on luonnonsatama → rakennustarkistus + jokamiehenoikeudet
  await page.getByTestId('spot-list').getByText('Karhunkämmen', { exact: false }).click()
  await expect(page.getByTestId('landing').locator('.badge.ok')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('landing').getByText(/Karttapaikasta/)).toBeVisible()
  // Kirkkosalmi on virallinen kohde → vihreä merkintä, ei rakennustarkistusta
  await page.getByTestId('spot-panel').getByText('‹').click()
  await page.getByTestId('spot-list').getByText('Kelvenne · Kirkkosalmi').click()
  await expect(page.locator('.badge', { hasText: 'Virallinen kohde' })).toBeVisible()
  await expect(page.getByTestId('landing')).toHaveCount(0)
  await expect(page.locator('.spot-marker.official').first()).toBeAttached()
})

test('seed coordinates refine from OSM place names', async ({ page }) => {
  await page.waitForFunction(
    () => !!window.__appStore?.getState().seedCoordOverrides?.['seed-pvy-pirttisaari'],
    undefined,
    { timeout: 15_000 },
  )
  const o = await page.evaluate(
    () => window.__appStore.getState().seedCoordOverrides['seed-pvy-pirttisaari'],
  )
  expect(o.lat).toBeCloseTo(62.0051, 3)
  expect(o.lon).toBeCloseTo(25.5449, 3)
})

test('satellite toggle switches basemap and back', async ({ page }) => {
  await page.getByTestId('satellite-toggle').click()
  await page.waitForFunction(() =>
    ['esri', 'mml'].includes(window.__appStore.getState().settings.basemap),
  )
  await page.getByTestId('satellite-toggle').click()
  await page.waitForFunction(() => window.__appStore.getState().settings.basemap === 'kartta')
})

test('fairway proximity warning is opt-in via settings', async ({ page }) => {
  await waitForWater(page)
  await page.getByTestId('spot-list').getByText('Pulkkilanharju', { exact: false }).click()
  await expect(page.getByTestId('spot-panel')).toBeVisible()
  // Odota että laskenta toteaa väylän läheiseksi…
  await page.waitForFunction(
    () => {
      const st = window.__appStore.getState()
      const key = Object.keys(st.computed).find((k) => k.startsWith('seed-pulkkilanharju:'))
      return key && st.computed[key].nearFairway === true
    },
    undefined,
    { timeout: 20_000 },
  )
  // …mutta oletuksena varoitusta EI näytetä
  await expect(page.locator('.badge', { hasText: 'Väylä lähellä' })).toHaveCount(0)
  // Asetuksesta päälle → badge näkyy
  await page.evaluate(() => window.__appStore.getState().setSettings({ warnNearFairway: true }))
  await expect(page.locator('.badge', { hasText: 'Väylä lähellä' })).toBeVisible()
})

test('favorite toggle persists and favorites filter works', async ({ page }) => {
  await waitForWater(page)
  await page.getByTestId('spot-list').getByText('Kelvenne · Likolahti').click()
  await page.getByTestId('fav-toggle').click()
  await expect(page.getByTestId('fav-toggle')).toHaveClass(/on/)
  await page.reload()
  await page.getByTestId('filter-favorites').click()
  const rows = page.getByTestId('spot-list').locator('.spot-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Kelvenne · Likolahti')
})

test('sauna filter shows only spots with a sauna', async ({ page }) => {
  await waitForWater(page)
  await page.getByTestId('filter-sauna').click()
  const list = page.getByTestId('spot-list')
  await expect(list.getByText('Sahanranta', { exact: false })).toBeVisible()
  await expect(list.getByText('Kelvenne · Kirkkosalmi')).toHaveCount(0)
})

test('adding an own spot via FAB and map click persists across reload', async ({ page }) => {
  await waitForWater(page)
  await page.getByTestId('add-spot').click()
  await clickMap(page)
  await expect(page.getByTestId('spot-form')).toBeVisible()
  await page.getByTestId('spot-name').fill('Testipoukama')
  // Palvelutagi mukaan
  await page.getByTestId('feature-sauna').click()
  await page.getByTestId('spot-save').click()
  await expect(page.getByTestId('spot-panel')).toBeVisible()
  await expect(
    page.getByTestId('feature-chips').locator('.feat-chip', { hasText: 'Sauna' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('spot-list').getByText('Testipoukama')).toBeVisible()
})

test('route across the island warns, route around it does not', async ({ page }) => {
  await waitForWater(page)
  // Reitti suoraan fixture-saaren yli
  await page.evaluate(() => {
    const app = window.__appStore.getState()
    app.addRoute({
      id: 'e2e-route',
      name: 'Testireitti',
      waypoints: [
        { lat: 61.6, lon: 25.45 },
        { lat: 61.6, lon: 25.55 },
      ],
    })
    app.setView('route')
  })
  await expect(page.getByTestId('route-panel')).toBeVisible()
  await expect(page.getByTestId('land-warning')).toBeVisible()
  await expect(page.getByText('Etappi 1 leikkaa maata')).toBeVisible()
  // Sama reitti saaren pohjoispuolelta — ei varoitusta
  await page.evaluate(() => {
    window.__appStore.getState().updateRoute('e2e-route', {
      waypoints: [
        { lat: 61.6, lon: 25.45 },
        { lat: 61.65, lon: 25.5 },
        { lat: 61.6, lon: 25.55 },
      ],
    })
  })
  await expect(page.getByTestId('land-warning')).toHaveCount(0)
  const metrics = page.getByTestId('route-metrics')
  await expect(metrics).toContainText('mpk')
  await expect(metrics).toContainText('min')
  await expect(metrics).toContainText('l (')
})

test('route metrics: ~10 nm at 20 kn ≈ 30 min and ~11 L', async ({ page }) => {
  await waitForWater(page)
  await page.evaluate(() => {
    const app = window.__appStore.getState()
    // 10 mpk pohjoiseen avovedessä
    app.addRoute({
      id: 'e2e-metrics',
      name: 'Mittari',
      waypoints: [
        { lat: 61.1, lon: 25.2 },
        { lat: 61.1 + 18.52 / 111.32, lon: 25.2 },
      ],
    })
    app.setView('route')
  })
  const metrics = page.getByTestId('route-metrics')
  await expect(metrics).toContainText('10.0 mpk')
  await expect(metrics).toContainText('30 min')
  await expect(metrics).toContainText('11 l')
})

test('5-day shelter: west wind → east-of-island sheltered, open west shore exposed', async ({
  page,
}) => {
  await waitForWater(page)
  // Kaksi testipistettä fixture-saaren ympärillä
  await page.evaluate(() => {
    const app = window.__appStore.getState()
    app.addSpot({ id: 'e2e-east', name: 'Saaren itäpuoli', lat: 61.6, lon: 25.5305, isIsland: true })
    app.addSpot({ id: 'e2e-west', name: 'Avoin länsiranta', lat: 61.6, lon: 25.2, isIsland: false })
  })
  await page.waitForFunction(() => {
    const st = window.__appStore.getState()
    const keys = Object.keys(st.computed)
    return keys.some((k) => k.startsWith('e2e-east:')) && keys.some((k) => k.startsWith('e2e-west:'))
  }, undefined, { timeout: 20_000 })

  // Itäpuoli: länsituulelta suojassa
  await page.evaluate(() => {
    window.__appStore.getState().selectSpot('e2e-east')
  })
  await expect(page.getByTestId('day-badges')).toBeVisible({ timeout: 15_000 })
  const eastBadges = page.locator('.day-badge')
  await expect(eastBadges).toHaveCount(5)
  for (const badge of await eastBadges.all()) {
    await expect(badge).toHaveAttribute('data-class', 'suojassa')
  }

  // Avoin länsiranta: altis
  await page.evaluate(() => {
    window.__appStore.getState().selectSpot('e2e-west')
  })
  await expect(page.getByTestId('day-badges')).toBeVisible({ timeout: 15_000 })
  for (const badge of await page.locator('.day-badge').all()) {
    await expect(badge).toHaveAttribute('data-class', 'altis')
  }
})

test('export and import round-trip preserves own spots', async ({ page }) => {
  await waitForWater(page)
  await page.evaluate(() => {
    window.__appStore
      .getState()
      .addSpot({ id: 'e2e-exp', name: 'Vientipaikka', lat: 61.5, lon: 25.3, isIsland: true })
  })
  const blob = await page.evaluate(() => {
    const st = window.__appStore.getState()
    return JSON.stringify({
      app: 'paijanne-luonnonsatamat',
      version: 1,
      exportedAt: new Date().toISOString(),
      userSpots: st.userSpots,
      routes: st.routes,
      settings: st.settings,
    })
  })
  // Tyhjennä ja tuo takaisin
  await page.evaluate(() => {
    window.__appStore.setState({ userSpots: [], routes: [], selectedSpotId: null, view: 'list' })
  })
  await expect(page.getByTestId('spot-list').getByText('Vientipaikka')).toHaveCount(0)
  await page.evaluate((text) => {
    const json = JSON.parse(text)
    window.__appStore.getState().importUserData(json)
  }, blob)
  await expect(page.getByTestId('spot-list').getByText('Vientipaikka')).toBeVisible()
})

test('markers stay anchored to their geographic position across zooms', async ({ page }) => {
  await waitForWater(page)
  const spot = { lon: 25.452, lat: 61.3287 } // Kirkkosalmi = ensimmäinen seed-spotti
  for (const zoom of [8, 10.8, 13]) {
    await page.evaluate(
      ([lon, lat, z]) => (window as any).__map.jumpTo({ center: [lon, lat], zoom: z }),
      [spot.lon, spot.lat, zoom],
    )
    await page.waitForTimeout(250)
    const projected = await page.evaluate(([lon, lat]) => {
      const p = (window as any).__map.project([lon, lat])
      return { x: p.x, y: p.y }
    }, [spot.lon, spot.lat])
    const box = await page.locator('.spot-marker').first().boundingBox()
    expect(box).not.toBeNull()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2
    // Markerin keskipisteen on oltava kartan projisoimassa pisteessä
    expect(Math.abs(cx - projected.x)).toBeLessThan(3)
    expect(Math.abs(cy - projected.y)).toBeLessThan(3)
  }
})

test('mobile: sheet snaps between positions via handle taps', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 720, 'vain mobiilissa')
  await expect(page.getByTestId('sheet')).toHaveClass(/pos-half/)
  await page.getByTestId('sheet-handle').click()
  await expect(page.getByTestId('sheet')).toHaveClass(/pos-full/)
  await page.getByTestId('sheet-handle').click()
  await expect(page.getByTestId('sheet')).toHaveClass(/pos-half/)
})
