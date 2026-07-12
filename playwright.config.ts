import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    // Service worker ohittaisi page.route-mockit (mm. Open-Meteo NetworkFirst)
    serviceWorkers: 'block',
    // Esiasennettu Chromium (ks. ympäristön PLAYWRIGHT_BROWSERS_PATH);
    // polku toimii myös paikallisesti kun se on olemassa
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
