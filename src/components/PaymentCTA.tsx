import React, { useEffect, useState } from 'react'
import { PRODUCTS, type ProdutoInteresse } from '../config/pricing'
import { formatBRL as currency } from '../lib/currency'
import { centavosToBRL } from '../lib/currency'
import { supabase } from '../lib/supabase'
import { formatarDataBR } from '../lib/date'

type Props = {
  leadId: string
  produto: ProdutoInteresse
}

const WHATSAPP_NUMERO = '5511998541993'

// Único produto migrado pro checkout novo (turmas reais, preço vindo do banco).
// plataforma/ambos ainda não têm curso cadastrado — direcionam pro WhatsApp.
const SLUG_CHECKOUT: Partial<Record<ProdutoInteresse, string>> = {
  curso_pratico: 'procedimentos-emergencia',
}

export default function PaymentCTA({ leadId, produto }: Props) {
  const product = PRODUCTS[produto]
  const slugCheckout = SLUG_CHECKOUT[produto]

  const [precoCartao, setPrecoCartao] = useState<number | null>(null)
  const [precoPix, setPrecoPix] = useState<number | null>(null)
  const [datasTurmas, setDatasTurmas] = useState<string[]>([])

  useEffect(() => {
    if (!slugCheckout) return
    supabase.functions.invoke('validar-cupom', { body: { curso_slug: slugCheckout } }).then(({ data }) => {
      if (data?.valido && data?.curso) {
        setPrecoCartao(data.curso.preco_original_centavos)
        setPrecoPix(data.curso.preco_pix_original_centavos)
      }
    })
    supabase.functions.invoke('listar-turmas', { body: { curso_slug: slugCheckout } }).then(({ data }) => {
      const turmas = (data?.turmas as { data_turma: string; status: string }[] | undefined) ?? []
      setDatasTurmas(turmas.filter(t => t.status !== 'esgotada').map(t => formatarDataBR(t.data_turma)))
    })
  }, [slugCheckout])

  if (!slugCheckout) {
    const mensagem = `Olá! Tenho interesse n${produto === 'plataforma' ? 'a' : 'o'} ${product.label} da IEMESP. Pode me passar mais informações?`
    return (
      <div className="mt-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-5 text-left">
        <p className="font-poppins font-semibold text-iemesp-900">Quer saber mais?</p>
        <p className="mt-1 text-sm text-slate-600">
          {product.label} ainda está em preparação. Fale com a gente no WhatsApp pra saber data de lançamento e condições.
        </p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded bg-iemesp-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Falar no WhatsApp
        </a>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-iemesp-900/10 bg-iemesp-cream/60 p-5 text-left">
      <p className="font-poppins font-semibold text-iemesp-900">Quer garantir sua vaga agora?</p>
      <p className="mt-1 text-sm text-slate-600">
        {precoPix !== null && precoCartao !== null
          ? <>{product.label} — {centavosToBRL(precoPix)} no Pix ou {centavosToBRL(precoCartao)} no cartão. Pagamento seguro via Mercado Pago.</>
          : <>{product.label} — {currency(product.price)}. Pagamento via Pix ou cartão em até 12x, seguro via Mercado Pago.</>
        }
      </p>
      {datasTurmas.length > 0 && (
        <p className="mt-1 text-sm font-semibold text-iemesp-900">
          Turmas disponíveis: {datasTurmas.join(' ou ')}
        </p>
      )}
      <a
        href={`/checkout/${slugCheckout}?lead=${leadId}`}
        className="mt-3 inline-block rounded bg-iemesp-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Quero garantir minha vaga agora
      </a>
    </div>
  )
}
