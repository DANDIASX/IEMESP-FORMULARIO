import React, { useState } from 'react'
import { PRODUCTS, type ProdutoInteresse } from '../config/pricing'
import { formatBRL as currency } from '../lib/currency'

type Props = {
  leadId: string
  produto: ProdutoInteresse
}

export default function PaymentCTA({ leadId, produto }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const product = PRODUCTS[produto]

  const handlePay = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, produto }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) throw new Error(data.error || 'Falha ao iniciar pagamento')
      window.location.href = data.init_point
    } catch {
      setError('Não foi possível iniciar o pagamento agora. Tente novamente em instantes.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-5 text-left">
      <p className="font-poppins font-semibold text-iemesp-900">Quer garantir sua vaga agora?</p>
      <p className="mt-1 text-sm text-slate-600">
        {product.label} — {currency(product.price)}. Pagamento via Pix ou cartão em até 12x, seguro via Mercado Pago.
      </p>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="mt-3 rounded bg-iemesp-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? 'Preparando pagamento...' : 'Quero garantir minha vaga agora'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
