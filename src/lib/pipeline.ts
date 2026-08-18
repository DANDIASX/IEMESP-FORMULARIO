export type PipelineStage = 'novo' | 'contatado' | 'negociando' | 'aguardando_pagamento' | 'matriculado' | 'perdido'

export type Lead = {
  id: string
  created_at: string
  nome: string
  email: string | null
  telefone: string
  produto_interesse: 'curso_pratico' | 'plataforma' | 'ambos' | null
  pipeline_stage: PipelineStage
  stage_updated_at: string
  valor_curso: number | null
  pago: boolean
  forma_pagamento: string | null
  data_pagamento: string | null
}

export const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'contatado', label: 'Contatado' },
  { key: 'negociando', label: 'Negociando' },
  { key: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { key: 'matriculado', label: 'Matriculado' },
  { key: 'perdido', label: 'Perdido' },
]

export const PRODUTO_LABELS: Record<string, string> = {
  curso_pratico: 'Curso Procedimentos 2.0 (presencial)',
  plataforma: 'Plataforma de Educação Permanente',
  ambos: 'Curso + Plataforma',
}

const MESSAGE_TEMPLATES: Partial<Record<PipelineStage, string>> = {
  novo: 'Olá {{nome}}! Aqui é da IEMESP. Recebemos seu interesse e posso te enviar mais detalhes sobre o curso/plataforma. Podemos conversar?',
  contatado: 'Oi {{nome}}, tudo bem? Ficou alguma dúvida sobre o curso? Estou à disposição para te ajudar.',
  negociando: 'Olá {{nome}}, conseguiu ver a proposta com calma? Posso te ajudar a garantir sua vaga hoje.',
  aguardando_pagamento: 'Oi {{nome}}, só confirmando: conseguiu fazer o pagamento? Assim que confirmar, já garanto sua vaga.',
}

export function messageTemplateFor(stage: PipelineStage): string | null {
  return MESSAGE_TEMPLATES[stage] ?? null
}

export function fillTemplate(template: string, lead: Lead): string {
  const primeiroNome = lead.nome.trim().split(/\s+/)[0] || lead.nome
  return template.replaceAll('{{nome}}', primeiroNome)
}

export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

export function whatsappLink(telefone: string, message: string): string {
  const digits = telefone.replace(/\D/g, '')
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}
