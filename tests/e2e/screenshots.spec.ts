import { test, type Page } from '@playwright/test'
import {
  fairwayAreasFixture,
  fairwayLinesFixture,
  ogcCollectionsFixture,
  openMeteoFixture,
  overpassFixture,
} from './fixtures'

/**
 * Kuvakaappausajo dokumentaatiota varten — ajetaan vain SCREENSHOT_DIR-ympäristö-
 * muuttujalla (esim. SCREENSHOT_DIR=/tmp/shots npx playwright test -g screenshots).
 */
const DIR = process.env.SCREENSHOT_DIR
test.skip(!DIR, 'SCREENSHOT_DIR ei asetettu')

const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function setup(page: Page) {
  await page.route(/overpass/, (r) => {
    const body = decodeURIComponent((r.request().postData() ?? '').replace(/\+/g, ' '))
    if (body.includes('out geom')) return r.fulfill({ json: overpassFixture })
    return r.fulfill({ json: { elements: [] } })
  })
  await page.route(/avoinapi\.vaylapilvi\.fi.*\/collections\?/, (r) =>
    r.fulfill({ json: ogcCollectionsFixture }),
  )
  await page.route(/avoinapi\.vaylapilvi\.fi.*vaylat_uusi/, (r) =>
    r.fulfill({ json: fairwayLinesFixture }),
  )
  await page.route(/avoinapi\.vaylapilvi\.fi.*vaylaalueet_uusi/, (r) =>
    r.fulfill({ json: fairwayAreasFixture }),
  )
  await page.route(/api\.open-meteo\.com/, (r) => r.fulfill({ json: openMeteoFixture() }))
  await page.route(/tile\.openstreetmap\.org|cartocdn\.com/, (r) =>
    r.fulfill({ body: TILE, contentType: 'image/png' }),
  )
  await page.goto('/')
  await page.waitForFunction(() => (window as any).__appStore?.getState().waterState.status === 'ready')
}

test('screenshots', async ({ page }, testInfo) => {
  const p = testInfo.project.name
  await setup(page)
  await page.screenshot({ path: `${DIR}/${p}-1-lista.png` })

  await page.getByTestId('spot-list').getByText('Kelvenne · Kirkkosalmi').click()
  await page.getByTestId('day-badges').waitFor({ timeout: 20_000 })
  await page.screenshot({ path: `${DIR}/${p}-2-paikkakortti.png` })

  await page.getByTestId('analysis').locator('summary').click()
  await page.locator('.fetch-rose svg path').first().waitFor({ timeout: 20_000 })
  await page.screenshot({ path: `${DIR}/${p}-3-analyysi.png` })

  await page.evaluate(() => {
    const app = (window as any).__appStore.getState()
    app.addRoute({
      id: 'shot-route',
      name: 'Kirkkosalmeen',
      waypoints: [
        { lat: 61.53, lon: 25.6 },
        { lat: 61.6, lon: 25.55 },
        { lat: 61.6, lon: 25.45 },
      ],
    })
    app.setView('route')
    app.setSheetPos('half')
  })
  await page.getByTestId('route-metrics').waitFor()
  await page.screenshot({ path: `${DIR}/${p}-4-reitti.png` })
})
