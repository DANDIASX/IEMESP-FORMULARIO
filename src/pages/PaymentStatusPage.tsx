import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { baixarIcs } from '../lib/ics'

// TODO: substituir pelo link real do grupo de WhatsApp da turma quando você definir.
const LINK_GRUPO_WHATSAPP = ''

type PedidoStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'reembolsado' | 'excedente'

type TurmaResumo = {
  nome: string
  data_turma: string
  horario: string | null
  local: string | null
  curso_titulo: string | null
}

const formatarData = (iso: string) => {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const STATUS_MESSAGE: Record<PedidoStatus, { titulo: string; texto: string }> = {
  aprovado: { titulo: 'Pagamento confirmado!', texto: 'Sua vaga está garantida. Em breve você recebe mais informações.' },
  pendente: { titulo: 'Pagamento em processamento', texto: 'Estamos confirmando seu pagamento. Isso pode levar alguns minutos — não é necessário tentar de novo.' },
  recusado: { titulo: 'Pagamento não aprovado', texto: 'Não foi possível concluir o pagamento. Você pode tentar novamente.' },
  cancelado: { titulo: 'Pagamento cancelado', texto: 'O pagamento foi cancelado.' },
  reembolsado: { titulo: 'Pagamento reembolsado', texto: 'O valor deste pedido foi reembolsado.' },
  excedente: {
    titulo: 'Pagamento recebido — turma lotou nesse meio tempo',
    texto: 'Seu pagamento foi recebido, mas a turma lotou antes da confirmação. Vamos te colocar na lista de espera ou reembolsar — entraremos em contato pelo WhatsApp.',
  },
}

const TENTATIVAS = 5
const INTERVALO_MS = 3000

export default function PaymentStatusPage(){
  const [searchParams] = useSearchParams()
  const pedidoId = searchParams.get('pedido')

  const [status, setStatus] = useState<PedidoStatus | null>(null)
  const [turma, setTurma] = useState<TurmaResumo | null>(null)
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
      setTurma(data.turma ?? null)

      tentativaRef.current += 1
      if (data.status === 'pendente' && tentativaRef.current < TENTATIVAS) {
        setTimeout(consultar, INTERVALO_MS)
      }
    }

    consultar()
    return () => { cancelado = true }
  }, [pedidoId])

  const mensagem = status ? STATUS_MESSAGE[status] : null
  const mostrarResumoTurma = status === 'aprovado' && turma

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

          {mostrarResumoTurma && turma && (
            <div className="mt-6 space-y-4 text-left">
              <div className="rounded-xl bg-iemesp-cream/60 p-4 text-sm">
                <p className="font-semibold text-iemesp-900">{turma.curso_titulo} — {turma.nome}</p>
                <p className="text-slate-600">{formatarData(turma.data_turma)}{turma.horario ? ` · ${turma.horario}` : ''}</p>
                {turma.local && <p className="text-slate-600">{turma.local}</p>}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => baixarIcs({
                    titulo: `${turma.curso_titulo ?? 'Curso IEMESP'} — ${turma.nome}`,
                    dataTurma: turma.data_turma,
                    horario: turma.horario,
                    local: turma.local,
                  })}
                  className="flex-1 rounded bg-iemesp-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  Adicionar à agenda
                </button>
                {LINK_GRUPO_WHATSAPP && (
                  <a
                    href={LINK_GRUPO_WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded bg-iemesp-700 px-4 py-3 text-center text-sm font-semibold text-white"
                  >
                    Entrar no grupo do WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
