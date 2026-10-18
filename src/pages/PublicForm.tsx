import React, { useEffect, useState } from 'react'
import LeadForm from '../components/LeadForm'
import { trackPurchase } from '../lib/metaPixel'
import { PRODUCTS, type ProdutoInteresse } from '../config/pricing'

type MpStatus = 'approved' | 'pending' | 'failure'

const STATUS_MESSAGE: Record<MpStatus, string> = {
  approved: 'Pagamento confirmado! Sua vaga está garantida.',
  pending: 'Pagamento pendente. Assim que for confirmado, sua vaga é garantida.',
  failure: 'Não foi possível concluir o pagamento. Você pode tentar novamente.',
}

export default function PublicForm(){
  const [mpStatus, setMpStatus] = useState<MpStatus | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('mp_status') as MpStatus | null
    if (!status || !(status in STATUS_MESSAGE)) return

    setMpStatus(status)

    if (status === 'approved') {
      const produto = params.get('produto') as ProdutoInteresse | null
      const price = produto && produto in PRODUCTS ? PRODUCTS[produto].price : undefined
      if (price) trackPurchase(price)
    }
  }, [])

  return (
    <div className="min-h-screen bg-iemesp-cream text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <img
              src="/logo-iemesp.png"
              alt="IEMESP — Emergência para Emergencistas"
              className="mx-auto w-full max-w-xs rounded-2xl sm:max-w-sm"
            />
            <h1 className="mt-6 text-4xl font-poppins font-bold text-iemesp-900">Formulário de Inscrição</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">Preencha seus dados para receber informações sobre cursos e eventos da IEMESP.</p>
          </div>

          {mpStatus && (
            <div className="mb-6 rounded-xl bg-iemesp-900/5 p-4 text-center text-sm font-medium text-iemesp-900">
              {STATUS_MESSAGE[mpStatus]}
            </div>
          )}

          <LeadForm />
        </div>
      </div>
    </div>
  )
}
