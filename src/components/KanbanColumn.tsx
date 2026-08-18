import React from 'react'
import LeadCard from './LeadCard'
import type { Lead, PipelineStage } from '../lib/pipeline'

type Props = {
  label: string
  leads: Lead[]
  onStageChange: (id: string, stage: PipelineStage) => void
  onMarkPaid: (id: string, payment: { valor_curso: number | null; forma_pagamento: string | null; data_pagamento: string }) => void
  onCreateStudent: (lead: Lead) => void
}

export default function KanbanColumn({ label, leads, onStageChange, onMarkPaid, onCreateStudent }: Props){
  return (
    <div className="flex-shrink-0 w-72 bg-slate-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-semibold text-iemesp-900 text-sm">{label}</h2>
        <span className="text-xs bg-white rounded-full px-2 py-0.5 text-slate-500">{leads.length}</span>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onStageChange={onStageChange}
            onMarkPaid={onMarkPaid}
            onCreateStudent={onCreateStudent}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-4">Nenhum lead nesta fase</div>
        )}
      </div>
    </div>
  )
}
