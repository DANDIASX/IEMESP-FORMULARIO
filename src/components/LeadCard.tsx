import React, { useState } from 'react'
import { daysSince, STAGES, type Lead, type PipelineStage } from '../lib/pipeline'
import { PRODUCTS } from '../config/pricing'
import TemplatePicker from './TemplatePicker'

type Props = {
  lead: Lead
  onStageChange: (id: string, stage: PipelineStage) => void
  onMarkPaid: (id: string, payment: { valor_curso: number | null; forma_pagamento: string | null; data_pagamento: string }) => void
  onCreateStudent: (lead: Lead) => void
  onGeneratePaymentLink: (lead: Lead) => Promise<string>
}

export default function LeadCard({ lead, onStageChange, onMarkPaid, onCreateStudent, onGeneratePaymentLink }: Props){
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [valor, setValor] = useState(lead.valor_curso?.toString() ?? '')
  const [forma, setForma] = useState(lead.forma_pagamento ?? 'PIX')

  const dias = daysSince(lead.stage_updated_at)

  const savePayment = () => {
    onMarkPaid(lead.id, {
      valor_curso: valor ? Number(valor) : null,
      forma_pagamento: forma || null,
      data_pagamento: new Date().toISOString(),
    })
    setShowPaymentForm(false)
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
        <div className="text-xs text-slate-500">{PRODUCTS[lead.produto_interesse]?.label ?? lead.produto_interesse}</div>
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
        <button type="button" onClick={() => setShowTemplates(v => !v)} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
          {showTemplates ? 'Ocultar mensagens' : 'Mensagens'}
        </button>
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

      {showTemplates && (
        <div className="border-t pt-2">
          <TemplatePicker lead={lead} onGeneratePaymentLink={onGeneratePaymentLink} />
        </div>
      )}

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
