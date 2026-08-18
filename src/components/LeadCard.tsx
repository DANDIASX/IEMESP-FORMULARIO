import React, { useState } from 'react'
import { daysSince, fillTemplate, messageTemplateFor, whatsappLink, PRODUTO_LABELS, STAGES, type Lead, type PipelineStage } from '../lib/pipeline'

type Props = {
  lead: Lead
  onStageChange: (id: string, stage: PipelineStage) => void
  onMarkPaid: (id: string, payment: { valor_curso: number | null; forma_pagamento: string | null; data_pagamento: string }) => void
  onCreateStudent: (lead: Lead) => void
}

export default function LeadCard({ lead, onStageChange, onMarkPaid, onCreateStudent }: Props){
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [valor, setValor] = useState(lead.valor_curso?.toString() ?? '')
  const [forma, setForma] = useState(lead.forma_pagamento ?? 'PIX')

  const template = messageTemplateFor(lead.pipeline_stage)
  const message = template ? fillTemplate(template, lead) : null
  const dias = daysSince(lead.stage_updated_at)

  const savePayment = () => {
    onMarkPaid(lead.id, {
      valor_curso: valor ? Number(valor) : null,
      forma_pagamento: forma || null,
      data_pagamento: new Date().toISOString(),
    })
    setShowPaymentForm(false)
  }

  const copyMessage = async () => {
    if (!message) return
    await navigator.clipboard.writeText(message)
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-iemesp-900">{lead.nome}</div>
          <div className="text-slate-500">{lead.telefone}</div>
        </div>
        {lead.pago ? (
          <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Pago</span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">Não pago</span>
        )}
      </div>

      {lead.produto_interesse && (
        <div className="text-xs text-slate-500">{PRODUTO_LABELS[lead.produto_interesse] ?? lead.produto_interesse}</div>
      )}

      <div className="text-xs text-slate-400">
        Há {dias} {dias === 1 ? 'dia' : 'dias'} nesta fase
      </div>

      <select
        className="w-full rounded border-gray-300 p-1.5 text-sm"
        value={lead.pipeline_stage}
        onChange={e => onStageChange(lead.id, e.target.value as PipelineStage)}
      >
        {STAGES.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        {message && (
          <>
            <a
              href={whatsappLink(lead.telefone, message)}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-[#25D366] text-white px-2 py-1 rounded"
            >
              WhatsApp
            </a>
            <button type="button" onClick={copyMessage} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
              Copiar mensagem
            </button>
          </>
        )}
        {!lead.pago && (
          <button type="button" onClick={() => setShowPaymentForm(v => !v)} className="text-xs bg-iemesp-900 text-white px-2 py-1 rounded">
            Marcar como pago
          </button>
        )}
        {lead.pago && lead.pipeline_stage === 'matriculado' && (
          <button type="button" onClick={() => onCreateStudent(lead)} className="text-xs bg-iemesp-700 text-white px-2 py-1 rounded">
            Criar registro de aluno
          </button>
        )}
      </div>

      {showPaymentForm && (
        <div className="border-t pt-2 space-y-2">
          <div>
            <label className="block text-xs text-gray-600">Valor pago (R$)</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded border-gray-300 p-1.5 text-sm"
              value={valor}
              onChange={e => setValor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Forma de pagamento</label>
            <input
              className="mt-1 block w-full rounded border-gray-300 p-1.5 text-sm"
              value={forma}
              onChange={e => setForma(e.target.value)}
            />
          </div>
          <button type="button" onClick={savePayment} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">
            Confirmar pagamento
          </button>
        </div>
      )}
    </div>
  )
}
