import React, { useState } from 'react'
import { getConsentimentoCookies, setConsentimentoCookies } from '../lib/cookieConsent'
import { initMetaPixel } from '../lib/metaPixel'

export default function CookieConsentBanner() {
  const [visivel, setVisivel] = useState(() => getConsentimentoCookies() === null)

  const aceitar = () => {
    setConsentimentoCookies('aceito')
    initMetaPixel()
    setVisivel(false)
  }

  const recusar = () => {
    setConsentimentoCookies('recusado')
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-slate-600">
          Usamos cookies pra entender como você chegou até aqui e melhorar nossos anúncios. Seus dados nunca são vendidos.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={recusar}
            className="rounded px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={aceitar}
            className="rounded bg-iemesp-900 px-4 py-2 text-sm font-semibold text-white hover:bg-iemesp-700"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
