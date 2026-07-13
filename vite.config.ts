import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'Päijänne luonnonsatamat',
        short_name: 'Luonnonsatamat',
        description: 'Päijänteen luonnonsatamien löytäjä ja veneretkien suunnittelija',
        lang: 'fi',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#eef1f4',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,geojson,woff2}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        runtimeCaching: [
          {
            // Karttatiilet: kotona selatut alueet toimivat veneessä ilman verkkoa
            urlPattern: ({ url }) =>
              /tile\.openstreetmap\.org|avoin-karttakuva\.maanmittauslaitos\.fi|arcgisonline\.com|cartocdn\.com/.test(
                url.host,
              ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.host === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
