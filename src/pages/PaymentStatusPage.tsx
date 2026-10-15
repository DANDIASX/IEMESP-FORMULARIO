import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type PedidoStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'reembolsado'

const STATUS_MESSAGE: Record<PedidoStatus, { titulo: string; texto: string }> = {
  aprovado: { titulo: 'Pagamento confirmado!', texto: 'Sua vaga está garantida. Em breve você recebe mais informações.' },
  pendente: { titulo: 'Pagamento em processamento', texto: 'Estamos confirmando seu pagamento. Isso pode levar alguns minutos — não é necessário tentar de novo.' },
  recusado: { titulo: 'Pagamento não aprovado', texto: 'Não foi possível concluir o pagamento. Você pode tentar novamente.' },
  cancelado: { titulo: 'Pagamento cancelado', texto: 'O pagamento foi cancelado.' },
  reembolsado: { titulo: 'Pagamento reembolsado', texto: 'O valor deste pedido foi reembolsado.' },
}

const TENTATIVAS = 5
const INTERVALO_MS = 3000

export default function PaymentStatusPage(){
  const [searchParams] = useSearchParams()
  const pedidoId = searchParams.get('pedido')

  const [status, setStatus] = useState<PedidoStatus | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const tentativaRef = useRef(0)

  useEffect(() => {
    if (!pedidoId) {
      setErro('Não foi possível identificar o pedido.')
      return
    }

    let cancelado = false

    const consultar = async () => {
      const { data, error } = await supabase.functions.invoke('status-pedido', { body: { pedido_id: pedidoId } })
      if (cancelado) return

      if (error || !data?.status) {
        setErro('Não foi possível confirmar o status do pagamento agora. Se o valor foi debitado, fale com a gente.')
        return
      }

      setStatus(data.status)

      tentativaRef.current += 1
      if (data.status === 'pendente' && tentativaRef.current < TENTATIVAS) {
        setTimeout(consultar, INTERVALO_MS)
      }
    }

    consultar()
    return () => { cancelado = true }
  }, [pedidoId])

  const mensagem = status ? STATUS_MESSAGE[status] : null

  return (
    <div className="min-h-screen bg-iemesp-cream text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white p-8 shadow-2xl text-center">
          <h1 className="text-2xl font-poppins font-bold text-iemesp-900">
            {mensagem?.titulo ?? (erro ? 'Não foi possível confirmar' : 'Confirmando pagamento...')}
          </h1>
          <p className="mt-4 text-slate-600">
            {mensagem?.texto ?? erro ?? 'Aguarde um instante enquanto confirmamos com o Mercado Pago.'}
          </p>
        </div>
      </div>
    </div>
  )
}
