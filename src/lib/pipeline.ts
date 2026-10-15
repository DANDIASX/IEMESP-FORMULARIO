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
