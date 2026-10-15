import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import KanbanColumn from '../components/KanbanColumn'
import { STAGES, daysSince, type Lead, type PipelineStage } from '../lib/pipeline'

const STALE_CONTACT_STAGES: PipelineStage[] = ['novo', 'contatado', 'negociando']
const STALE_CONTACT_DAYS = 3
const STALE_PAYMENT_DAYS = 2

export default function AdminDashboard(){
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeads = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('leads')
      .select('id, created_at, nome, email, telefone, produto_interesse, pipeline_stage, stage_updated_at, valor_curso, pago, forma_pagamento, data_pagamento')
      .order('stage_updated_at', { ascending: true })
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [])

  const onStageChange = async (id: string, stage: PipelineStage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, pipeline_stage: stage } : l))
    const { error: updateError } = await supabase.from('leads').update({ pipeline_stage: stage }).eq('id', id)
    if (updateError) setError(updateError.message)
    loadLeads()
  }

  const onMarkPaid = async (id: string, payment: { valor_curso: number | null; forma_pagamento: string | null; data_pagamento: string }) => {
    const { error: updateError } = await supabase.from('leads').update({ ...payment, pago: true }).eq('id', id)
    if (updateError) { setError(updateError.message); return }
    loadLeads()
  }

  const onCreateStudent = async (lead: Lead) => {
    const { error: insertError } = await supabase.from('students').insert([{
      lead_id: lead.id,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
    }])
    if (insertError) { setError(insertError.message); return }
    alert(`Aluno "${lead.nome}" criado com sucesso.`)
  }

  const onGeneratePaymentLink = async (lead: Lead): Promise<string> => {
    if (!lead.produto_interesse) throw new Error('Lead sem produto de interesse definido.')
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, produto: lead.produto_interesse }),
    })
    const data = await res.json()
    if (!res.ok || !data.init_point) throw new Error(data.error || 'Falha ao gerar link de pagamento.')
    return data.init_point as string
  }

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const staleContact = leads.filter(l =>
    STALE_CONTACT_STAGES.includes(l.pipeline_stage) && daysSince(l.stage_updated_at) >= STALE_CONTACT_DAYS
  )
  const stalePayment = leads.filter(l =>
    l.pipeline_stage === 'aguardando_pagamento' && daysSince(l.stage_updated_at) >= STALE_PAYMENT_DAYS
  )

  return (
    <div className="min-h-screen bg-iemesp-cream">
      <header className="bg-iemesp-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-poppins font-bold">Central de Vendas IEMESP</h1>
        <button onClick={logout} className="text-sm underline">Sair</button>
      </header>

      <div className="p-4 space-y-4">
        {error && <div className="bg-red-100 text-red-700 text-sm rounded p-2">{error}</div>}

        {(staleContact.length > 0 || stalePayment.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {staleContact.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-amber-800">Sem contato há {STALE_CONTACT_DAYS}+ dias ({staleContact.length})</div>
                <ul className="text-sm text-amber-700 mt-1 space-y-0.5">
                  {staleContact.map(l => <li key={l.id}>{l.nome} — {daysSince(l.stage_updated_at)} dias</li>)}
                </ul>
              </div>
            )}
            {stalePayment.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-rose-800">Aguardando pagamento há {STALE_PAYMENT_DAYS}+ dias ({stalePayment.length})</div>
                <ul className="text-sm text-rose-700 mt-1 space-y-0.5">
                  {stalePayment.map(l => <li key={l.id}>{l.nome} — {daysSince(l.stage_updated_at)} dias</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-slate-500">Carregando leads...</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.key}
                label={stage.label}
                leads={leads.filter(l => l.pipeline_stage === stage.key)}
                onStageChange={onStageChange}
                onMarkPaid={onMarkPaid}
                onCreateStudent={onCreateStudent}
                onGeneratePaymentLink={onGeneratePaymentLink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
