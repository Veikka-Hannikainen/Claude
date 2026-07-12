import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { useApp } from './state/store'
import './styles.css'

registerSW({ immediate: true })

// Konsoli-/testikäyttöön: store saataville selaimessa
;(window as unknown as { __appStore: typeof useApp }).__appStore = useApp

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
