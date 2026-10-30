import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initMetaPixel } from './lib/metaPixel'
import { getConsentimentoCookies } from './lib/cookieConsent'
import './styles/index.css'

// Só dispara o Pixel se a pessoa já aceitou cookies numa visita anterior —
// em visitas novas, o CookieConsentBanner decide isso depois que ela escolhe.
if (getConsentimentoCookies() === 'aceito') {
  initMetaPixel()
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
