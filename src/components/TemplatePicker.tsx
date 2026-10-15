import React, { useEffect, useState } from 'react'
import {
  MESSAGE_TEMPLATES, OBJECTIVES, extractVariables, renderTemplate,
  type Channel, type Objective, type TemplateVariable,
} from '../lib/messageTemplates'
import { PRODUCTS } from '../config/pricing'
import { STAGES, whatsappLink, type Lead } from '../lib/pipeline'

const VARIABLE_LABELS: Record<TemplateVariable, string> = {
  nome: 'nome', curso: 'curso', estagio: 'estágio', link_pagamento: 'link de pagamento',
}

const META_CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação',
}

type Props = {
  lead: Lead
  onGeneratePaymentLink: (lead: Lead) => Promise<string>
}

export default function TemplatePicker({ lead, onGeneratePaymentLink }: Props) {
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [objective, setObjective] = useState<Objective | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [loadingLink, setLoadingLink] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const templates = MESSAGE_TEMPLATES.filter(
    t => t.channel === channel && (objective === 'all' || t.objective === objective)
  )
  const selected = templates.find(t => t.id === selectedId) ?? templates[0] ?? null

  useEffect(() => { setSelectedId(null); setCopied(false) }, [channel, objective])

  useEffect(() => {
    if (!selected) return
    const needsLink = extractVariables(selected.body).includes('link_pagamento')
    if (!needsLink || paymentLink || loadingLink) return

    setLoadingLink(true)
    setLinkError(null)
    onGeneratePaymentLink(lead)
      .then(setPaymentLink)
      .catch((err: any) => setLinkError(err?.message || 'Não foi possível gerar o link de pagamento.'))
      .finally(() => setLoadingLink(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  if (!selected) return <div className="text-xs text-slate-400">Nenhum template para esse filtro.</div>

  const values = {
    nome: lead.nome.trim().split(/\s+/)[0] || lead.nome,
    curso: lead.produto_interesse ? PRODUCTS[lead.produto_interesse].label : undefined,
    estagio: STAGES.find(s => s.key === lead.pipeline_stage)?.label,
    link_pagamento: paymentLink ?? undefined,
  }

  const { text: bodyPreview, missing } = renderTemplate(selected.body, values)
  const subjectPreview = selected.channel === 'email' ? renderTemplate(selected.subject, values).text : null
  const canSend = missing.length === 0 && !loadingLink

  const copy = async () => {
    const full = selected.channel === 'email' ? `Assunto: ${subjectPreview}\n\n${bodyPreview}` : bodyPreview
    await navigator.clipboard.writeText(full)
    setCopied(true)
  }

  const waLink = whatsappLink(lead.telefone, bodyPreview)
  const mailtoLink = `mailto:${lead.email ?? ''}?subject=${encodeURIComponent(subjectPreview ?? '')}&body=${encodeURIComponent(bodyPreview)}`

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2">
        <select
          value={channel}
          onChange={e => setChannel(e.target.value as Channel)}
          className="rounded border-gray-300 text-xs p-1"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-mail</option>
        </select>
        <select
          value={objective}
          onChange={e => setObjective(e.target.value as Objective | 'all')}
          className="rounded border-gray-300 text-xs p-1"
        >
          <option value="all">Todos os objetivos</option>
          {OBJECTIVES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1">
        {templates.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setSelectedId(t.id); setCopied(false) }}
            className={`text-xs px-2 py-1 rounded border ${
              t.id === selected.id ? 'bg-iemesp-900 text-white border-iemesp-900' : 'bg-white text-slate-600 border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selected.channel === 'whatsapp' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full ${selected.metaApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {selected.metaApproved ? 'Aprovado pela Meta' : 'Não aprovado pela Meta'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {META_CATEGORY_LABELS[selected.metaCategory]}
          </span>
          {selected.metaTemplateName && <span className="text-slate-400">#{selected.metaTemplateName}</span>}
        </div>
      )}

      <div className="border rounded-lg p-3 bg-slate-50 space-y-1">
        <div className="text-xs font-semibold text-slate-500">Preview</div>
        {subjectPreview !== null && <div className="text-sm font-medium">{subjectPreview}</div>}
        <div className="whitespace-pre-wrap text-sm">{bodyPreview}</div>
        {loadingLink && <div className="text-xs text-slate-400">Gerando link de pagamento...</div>}
        {linkError && <div className="text-xs text-red-600">{linkError}</div>}
        {missing.length > 0 && !loadingLink && !linkError && (
          <div className="text-xs text-amber-600">Faltam dados: {missing.map(m => VARIABLE_LABELS[m]).join(', ')}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!canSend}
          className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded disabled:opacity-50"
        >
          {copied ? 'Copiado!' : 'Copiar mensagem'}
        </button>
        {selected.channel === 'whatsapp' && (
          <a
            href={canSend ? waLink : undefined}
            target="_blank"
            rel="noreferrer"
            className={`text-xs px-2 py-1 rounded text-white ${canSend ? 'bg-[#25D366]' : 'bg-slate-300 pointer-events-none'}`}
          >
            Abrir no WhatsApp
          </a>
        )}
        {selected.channel === 'email' && (
          <a
            href={canSend && lead.email ? mailtoLink : undefined}
            className={`text-xs px-2 py-1 rounded text-white ${canSend && lead.email ? 'bg-iemesp-700' : 'bg-slate-300 pointer-events-none'}`}
          >
            Abrir e-mail
          </a>
        )}
      </div>
      {selected.channel === 'email' && !lead.email && (
        <div className="text-xs text-amber-600">Lead sem e-mail cadastrado.</div>
      )}
    </div>
  )
}
